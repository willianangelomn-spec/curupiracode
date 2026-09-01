/**
 * Service Definition for the knowledge capability seam (`ctx.knowledge`): an
 * extractor registry, one active store, and the ingest/retrieve operations over
 * them.
 *
 * The seam — not the store — owns hashing and passage splitting, so every store
 * receives identical passages for identical bytes and a citation means the same
 * thing regardless of which store produced it.
 * @module @deepseek-ai/dsh-knowledge
 */

import { createHash } from 'node:crypto'
import { Context, Service } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import type {
  KnowledgeDocument,
  KnowledgeExtractor,
  KnowledgeIngestRequest,
  KnowledgeIngestResult,
  KnowledgeRelation,
  KnowledgeSearchRequest,
  KnowledgeSearchResult,
  KnowledgeStore,
  KnowledgeStoredPassage,
} from './types.ts'
import { KnowledgeError } from './types.ts'

export { KnowledgeError } from './types.ts'
export type {
  KnowledgeDocument,
  KnowledgeErrorCode,
  KnowledgeExtraction,
  KnowledgeExtractor,
  KnowledgeIngestRequest,
  KnowledgeIngestResult,
  KnowledgePassage,
  KnowledgeRelation,
  KnowledgeRegion,
  KnowledgeSearchRequest,
  KnowledgeSearchResult,
  KnowledgeStore,
  KnowledgeStoredDocument,
  KnowledgeStoredPassage,
} from './types.ts'

declare module '@deepseek-ai/cordis' {
  interface Context {
    knowledge: KnowledgeRuntime
  }
}

/**
 * Config for the knowledge seam. `store` pins which store wins when more than
 * one is registered; a single registered usable store auto-selects.
 */
export interface KnowledgeRuntimeConfig {
  /** Explicit store id. Omitted = auto-select when exactly one is usable. */
  readonly store?: string
  /**
   * Target passage size in characters. Passages are the retrieval unit: too
   * small loses the context that makes a hit intelligible, too large returns
   * pages where a paragraph was wanted.
   */
  readonly passageChars?: number
  /**
   * Characters each passage repeats from the previous one, so a statement
   * spanning a boundary stays retrievable from both sides.
   */
  readonly passageOverlapChars?: number
}

/** Default target passage size. */
export const DEFAULT_PASSAGE_CHARS = 1200

/** Default overlap between adjacent passages. */
export const DEFAULT_PASSAGE_OVERLAP_CHARS = 150

/** Upper bound applied when a search omits `maxResults`. */
export const DEFAULT_MAX_RESULTS = 10

/**
 * The knowledge service. Registered as `ctx.knowledge` (one per context).
 *
 * Store selection resolves at call time, never by registration order:
 * - a configured id that is registered and usable wins;
 * - a configured id that is missing or unusable throws;
 * - with no id configured, exactly one usable store wins;
 * - zero or several usable stores throw rather than guess.
 */
export class KnowledgeRuntime extends Service {
  static Config: z<KnowledgeRuntimeConfig> = z.object({
    store: z.string(),
    passageChars: z.number(),
    passageOverlapChars: z.number(),
  })

  private stores = new Map<string, KnowledgeStore>()
  private extractors = new Map<string, KnowledgeExtractor>()
  private readonly storeId: string | undefined
  private readonly passageChars: number
  private readonly passageOverlapChars: number

  constructor(ctx: Context, config: KnowledgeRuntimeConfig = {}) {
    super(ctx, 'knowledge')
    this.storeId = config.store ?? process.env.DSH_KNOWLEDGE_STORE
    this.passageChars = config.passageChars ?? DEFAULT_PASSAGE_CHARS
    this.passageOverlapChars = config.passageOverlapChars ?? DEFAULT_PASSAGE_OVERLAP_CHARS
    if (this.passageOverlapChars >= this.passageChars) {
      throw new KnowledgeError(
        `passageOverlapChars (${this.passageOverlapChars}) must be smaller than passageChars (${this.passageChars})`,
        'KNOWLEDGE_STORE_ERROR',
      )
    }
  }

  /**
   * Register the durable store. Throws when its id is already registered.
   * @param store - the store; its `id` is the registry key.
   * @returns the disposer that unregisters the store.
   */
  registerStore(store: KnowledgeStore): () => void {
    if (this.stores.has(store.id)) {
      throw new KnowledgeError(`a knowledge store with id "${store.id}" is already registered`, 'KNOWLEDGE_STORE_ERROR')
    }
    const stores = this.stores
    const dispose = this.ctx.effect(function* () {
      stores.set(store.id, store)
      yield () => stores.delete(store.id)
    }, 'knowledge.registerStore()')
    return () => void dispose()
  }

  /**
   * Register a format extractor. Extractors are additive: several coexist and
   * are matched per document, so adding a format never displaces another.
   * @param extractor - the extractor; its `id` is the registry key.
   * @returns the disposer that unregisters the extractor.
   */
  registerExtractor(extractor: KnowledgeExtractor): () => void {
    if (this.extractors.has(extractor.id)) {
      throw new KnowledgeError(
        `a knowledge extractor with id "${extractor.id}" is already registered`,
        'KNOWLEDGE_EXTRACTION_FAILED',
      )
    }
    const extractors = this.extractors
    const dispose = this.ctx.effect(function* () {
      extractors.set(extractor.id, extractor)
      yield () => extractors.delete(extractor.id)
    }, 'knowledge.registerExtractor()')
    return () => void dispose()
  }

  /**
   * Ingest one document: identify it by content hash, extract its text, split
   * it into passages, and index them.
   *
   * Identical bytes ingested twice are a no-op that reports `alreadyPresent`,
   * so re-scanning a folder is cheap and never duplicates.
   * @param request - the bytes plus naming and format hints.
   * @param signal - cancellation forwarded to extractor and store.
   * @returns The document identity and how much was indexed.
   */
  async ingest(request: KnowledgeIngestRequest, signal?: AbortSignal): Promise<KnowledgeIngestResult> {
    const store = this.resolveStore()
    const extractor = this.resolveExtractor(request)
    const id = hashContent(request.content)

    let extraction
    try {
      extraction = await extractor.extract(request.content, signal)
    } catch (error: unknown) {
      if (signal?.aborted) throw new KnowledgeError('knowledge ingest was cancelled', 'KNOWLEDGE_ABORTED', { cause: error })
      throw new KnowledgeError(
        `extractor "${extractor.id}" failed on "${request.name}": ${String(error)}`,
        'KNOWLEDGE_EXTRACTION_FAILED',
        { cause: error },
      )
    }

    const passages = splitIntoPassages(extraction.text, this.passageChars, this.passageOverlapChars, extraction.regions)
    const { alreadyPresent } = await store.put(
      {
        id,
        name: request.name,
        ...request.origin !== undefined ? { origin: request.origin } : {},
        extractor: extractor.id,
        passageCount: passages.length,
        ingestedAt: Date.now(),
        content: request.content,
        text: extraction.text,
      },
      passages,
      signal,
    )
    return { id, passageCount: passages.length, alreadyPresent, extractor: extractor.id }
  }

  /**
   * Retrieve passages relevant to a query. The seam enforces `maxResults` even
   * if a store over-returns.
   * @param request - the query and optional bounds.
   * @param signal - cancellation forwarded to the store.
   * @returns Matching passages with provenance, best match first.
   */
  async search(request: KnowledgeSearchRequest, signal?: AbortSignal): Promise<KnowledgeSearchResult> {
    const store = this.resolveStore()
    const limit = request.maxResults ?? DEFAULT_MAX_RESULTS
    const found = await store.search(request, signal)
    const passages = found.slice(0, limit)
    return { passages, truncated: passages.length < found.length }
  }

  /**
   * List every document in the vault.
   * @param signal - cancellation forwarded to the store.
   * @returns The stored documents.
   */
  async documents(signal?: AbortSignal): Promise<readonly KnowledgeDocument[]> {
    return this.resolveStore().list(signal)
  }

  /** Find materials semantically related to one stored document. */
  async related(id: string, maxResults = 8, signal?: AbortSignal): Promise<readonly KnowledgeRelation[]> {
    const store = this.resolveStore()
    if (store.related === undefined) {
      throw new KnowledgeError('the configured knowledge store has no semantic relation index', 'KNOWLEDGE_STORE_ERROR')
    }
    return (await store.related(id, maxResults, signal)).slice(0, maxResults)
  }

  /**
   * Read one document's full extracted text, for verifying a citation in place.
   * @param id - the document's content hash.
   * @param signal - cancellation forwarded to the store.
   * @returns The text.
   */
  async text(id: string, signal?: AbortSignal): Promise<string> {
    const text = await this.resolveStore().text(id, signal)
    if (text === undefined) throw new KnowledgeError(`no document with id "${id}"`, 'KNOWLEDGE_NOT_FOUND')
    return text
  }

  /**
   * Remove one document and everything derived from it.
   * @param id - the document's content hash.
   * @param signal - cancellation forwarded to the store.
   * @returns Whether a document was removed.
   */
  async forget(id: string, signal?: AbortSignal): Promise<boolean> {
    return this.resolveStore().remove(id, signal)
  }

  private resolveStore(): KnowledgeStore {
    if (this.storeId !== undefined) {
      const configured = this.stores.get(this.storeId)
      if (configured === undefined) {
        throw new KnowledgeError(`configured knowledge store "${this.storeId}" is not registered`, 'KNOWLEDGE_STORE_ERROR')
      }
      if (!configured.available()) {
        throw new KnowledgeError(`configured knowledge store "${this.storeId}" is unavailable`, 'KNOWLEDGE_STORE_ERROR')
      }
      return configured
    }
    const usable = [...this.stores.values()].filter(store => store.available())
    if (usable.length === 1) return usable[0] as KnowledgeStore
    if (usable.length === 0) {
      throw new KnowledgeError('no usable knowledge store is registered', 'KNOWLEDGE_STORE_ERROR')
    }
    const ids = usable.map(store => store.id).sort().join(', ')
    throw new KnowledgeError(
      `several knowledge stores are usable (${ids}); configure one explicitly`,
      'KNOWLEDGE_STORE_ERROR',
    )
  }

  private resolveExtractor(request: KnowledgeIngestRequest): KnowledgeExtractor {
    const candidates = [...this.extractors.values()]
    const hinted = request.format?.toLowerCase().replace(/^\./, '')
    if (hinted !== undefined) {
      // A hint only narrows: bytes that contradict it still fall through to
      // sniffing, so a mislabeled file is read rather than silently emptied.
      const declared = candidates.filter(extractor => extractor.formats.includes(hinted))
      const match = declared.find(extractor => extractor.canExtract(request.content, request.name))
      if (match !== undefined) return match
    }
    const sniffed = candidates.find(extractor => extractor.canExtract(request.content, request.name))
    if (sniffed !== undefined) return sniffed
    throw new KnowledgeError(
      `no registered extractor can read "${request.name}"${hinted === undefined ? '' : ` (format "${hinted}")`}`,
      'KNOWLEDGE_UNSUPPORTED_FORMAT',
    )
  }
}

/** Content hash used as a document's stable identity. */
function hashContent(content: Uint8Array): string {
  return createHash('sha256').update(content).digest('hex')
}

/**
 * Split extracted text into overlapping passages, preferring paragraph and
 * sentence boundaries so a passage reads as a unit rather than cutting a word.
 *
 * Exported for tests and for stores that need to reproduce the seam's split.
 * @param text - the full extracted text.
 * @param size - target passage length in characters.
 * @param overlap - characters repeated from the previous passage.
 * @param regions - optional labeled spans used to locate each passage.
 * @returns Passages in document order.
 */
export function splitIntoPassages(
  text: string,
  size: number = DEFAULT_PASSAGE_CHARS,
  overlap: number = DEFAULT_PASSAGE_OVERLAP_CHARS,
  regions?: readonly { readonly start: number; readonly end: number; readonly locator: string }[],
): KnowledgeStoredPassage[] {
  const passages: KnowledgeStoredPassage[] = []
  if (text.trim().length === 0) return passages
  const step = Math.max(1, size - overlap)
  let start = 0
  while (start < text.length) {
    const hardEnd = Math.min(text.length, start + size)
    const end = hardEnd >= text.length ? text.length : preferredBreak(text, start, hardEnd)
    const slice = text.slice(start, end)
    if (slice.trim().length > 0) {
      const locator = regions === undefined ? undefined : locatorFor(regions, start, end)
      passages.push({ text: slice, start, end, ...locator === undefined ? {} : { locator } })
    }
    if (end >= text.length) break
    start = Math.max(start + step, end - overlap)
  }
  return passages
}

/**
 * Find a readable cut near `hardEnd`: last paragraph break, else sentence end,
 * else whitespace, else the hard limit.
 */
function preferredBreak(text: string, start: number, hardEnd: number): number {
  // Only look back over the final quarter so a break never shrinks a passage
  // drastically just because an earlier boundary existed.
  const floor = start + Math.floor((hardEnd - start) * 0.75)
  const window = text.slice(floor, hardEnd)
  const paragraph = window.lastIndexOf('\n\n')
  if (paragraph > 0) return floor + paragraph + 2
  const sentence = Math.max(window.lastIndexOf('. '), window.lastIndexOf('.\n'))
  if (sentence > 0) return floor + sentence + 2
  const space = window.lastIndexOf(' ')
  if (space > 0) return floor + space + 1
  return hardEnd
}

/** Label a passage with the locator of the region holding most of it. */
function locatorFor(
  regions: readonly { readonly start: number; readonly end: number; readonly locator: string }[],
  start: number,
  end: number,
): string | undefined {
  let best: string | undefined
  let bestOverlap = 0
  for (const region of regions) {
    const shared = Math.min(end, region.end) - Math.max(start, region.start)
    if (shared > bestOverlap) {
      bestOverlap = shared
      best = region.locator
    }
  }
  return best
}

/** Mount the knowledge runtime as a Cordis plugin (bundle row entry point). */
export default KnowledgeRuntime
