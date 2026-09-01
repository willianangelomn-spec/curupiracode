/**
 * Vocabulary for the knowledge capability seam (`ctx.knowledge`) — the local
 * "second brain" that answers from material the user explicitly authorized.
 *
 * Ingestion, retrieval, and format extraction share one seam so provenance has
 * a single owner: a passage is only useful if the exact source, revision, and
 * offsets that produced it travel with it. Splitting retrieval from ingestion
 * would let an index outlive the document it describes and cite text that no
 * longer exists.
 * @module @deepseek-ai/dsh-knowledge/types
 */

import { HarnessError } from '@deepseek-ai/dsh-llm'

/**
 * A document as accepted for ingestion. Bytes are passed rather than a path so
 * the seam never reads the filesystem on a caller's behalf: whoever holds the
 * bytes already passed whatever permission gate applies.
 */
export interface KnowledgeIngestRequest {
  /** Original bytes, stored verbatim and never rewritten. */
  readonly content: Uint8Array
  /**
   * Display name, typically the file name. Carried for citation rendering; it
   * is not an identity (identity is the content hash) and need not be unique.
   */
  readonly name: string
  /**
   * Where the bytes came from, when a stable locator exists (an absolute path
   * or URL). Optional because pasted content has no origin to record, and an
   * invented one would make a citation unverifiable.
   */
  readonly origin?: string
  /**
   * Format hint (`'md'`, `'pdf'`, ...). Extractor selection falls back to
   * sniffing the bytes when omitted, so a wrong extension cannot silently
   * produce an empty document.
   */
  readonly format?: string
}

/** Outcome of ingesting one document. */
export interface KnowledgeIngestResult {
  /** Content hash; the stable identity of these exact bytes. */
  readonly id: string
  /** Passages produced and indexed. */
  readonly passageCount: number
  /**
   * True when these bytes were already present. Re-ingesting is safe and
   * cheap: the vault is content-addressed, so identical bytes never duplicate.
   */
  readonly alreadyPresent: boolean
  /** Extractor id that produced the text. */
  readonly extractor: string
}

/** A retrieval request against the local index. */
export interface KnowledgeSearchRequest {
  readonly query: string
  /** Upper bound on returned passages; the seam truncates to it. */
  readonly maxResults?: number
  /** Restrict retrieval to these document ids; omitted searches everything. */
  readonly documentIds?: readonly string[]
}

/** Normalized retrieval outcome. */
export interface KnowledgeSearchResult {
  /** Matching passages, already truncated to `maxResults`, best match first. */
  readonly passages: readonly KnowledgePassage[]
  /** True when the seam dropped passages to honor `maxResults`. */
  readonly truncated: boolean
}

/**
 * One retrieved passage with the provenance needed to verify it.
 *
 * `documentId` plus `[start, end)` locate the text inside the immutable stored
 * original, so a citation can always be checked against bytes that cannot have
 * changed underneath it.
 */
export interface KnowledgePassage {
  /** Content hash of the document this text came from. */
  readonly documentId: string
  /** Display name of the source document, for rendering the citation. */
  readonly documentName: string
  /** Stable locator of the source, when one was recorded at ingestion. */
  readonly origin?: string
  /** The passage text, exactly as extracted. */
  readonly text: string
  /** Byte-independent character offset of `text` within the extracted document. */
  readonly start: number
  /** Exclusive end offset of `text` within the extracted document. */
  readonly end: number
  /**
   * Human-facing location within the source (`'p. 4'`, `'§ Introdução'`) when
   * the extractor knows one. Absent rather than guessed: a wrong page number
   * in a citation is worse than none.
   */
  readonly locator?: string
  /**
   * Relevance score from the index, higher is better. Comparable only within
   * one result set — it is not a probability or a cross-query constant.
   */
  readonly score: number
}

/** A document currently held in the vault. */
export interface KnowledgeDocument {
  readonly id: string
  readonly name: string
  readonly origin?: string
  /** Extractor id that produced this document's text. */
  readonly extractor: string
  /** Passages indexed for this document. */
  readonly passageCount: number
  /** Ingestion timestamp, epoch milliseconds. */
  readonly ingestedAt: number
}

/** One semantically related document in the user's local vault. */
export interface KnowledgeRelation {
  readonly documentId: string
  readonly documentName: string
  readonly origin?: string
  /** Cosine similarity between normalized local document embeddings. */
  readonly score: number
}

/**
 * Turns one document's bytes into plain text. Extractors are plugins so a new
 * format never edits the core; each declares the formats it handles and may
 * decline bytes it cannot read.
 */
export interface KnowledgeExtractor {
  /** Stable id recorded on every document this extractor produced. */
  readonly id: string
  /**
   * Lowercase format tags handled (`['md', 'markdown']`). Matching is by tag,
   * never by MIME type, because ingestion accepts bytes without a transport.
   */
  readonly formats: readonly string[]
  /**
   * Decide whether these bytes are readable by this extractor. Used when no
   * format hint is supplied and to reject a hint contradicted by the bytes.
   * @param content - the document bytes.
   * @param name - the document's display name, for extension sniffing.
   * @returns Whether extraction should be attempted.
   */
  canExtract(content: Uint8Array, name: string): boolean
  /**
   * Produce plain text plus optional per-region locators.
   * @param content - the document bytes.
   * @param signal - cancellation for a long extraction.
   * @returns The extracted document text and any known locators.
   */
  extract(content: Uint8Array, signal?: AbortSignal): Promise<KnowledgeExtraction>
}

/** What an extractor produces from one document. */
export interface KnowledgeExtraction {
  /** The document's full plain text. */
  readonly text: string
  /**
   * Regions carrying a human-facing locator (pages, headings), used to label
   * passages. May be empty when the format has no such structure; passages
   * then simply carry no locator.
   */
  readonly regions?: readonly KnowledgeRegion[]
}

/** A labeled span of extracted text. */
export interface KnowledgeRegion {
  /** Character offset where the region starts. */
  readonly start: number
  /** Exclusive character offset where the region ends. */
  readonly end: number
  /** Human-facing label for this span (`'p. 2'`). */
  readonly locator: string
}

/**
 * Durable vault and retrieval index behind the seam.
 *
 * Unlike extractors — which are additive, one per format — exactly one store is
 * active: it owns both the immutable originals and the index over them, because
 * an index that can outlive its originals would cite text nobody can verify.
 */
export interface KnowledgeStore {
  /** Stable id recorded for diagnostics. */
  readonly id: string
  /**
   * Whether this store can currently be used (its directory is writable, its
   * index opened). Checked at call time so a broken store fails loudly.
   * @returns Whether the store is usable.
   */
  available(): boolean
  /**
   * Persist one document's original bytes, text, and passages.
   *
   * Implementations must be idempotent on `document.id`: re-putting identical
   * content replaces nothing and reports `alreadyPresent`.
   * @param document - the document metadata and content-addressed identity.
   * @param passages - the seam-produced passages to index.
   * @param signal - cancellation for a long write.
   * @returns Whether the document was already present.
   */
  put(
    document: KnowledgeStoredDocument,
    passages: readonly KnowledgeStoredPassage[],
    signal?: AbortSignal,
  ): Promise<{ alreadyPresent: boolean }>
  /**
   * Retrieve passages matching a query.
   * @param request - query, optional bound, optional document filter.
   * @param signal - cancellation for a long read.
   * @returns Matching passages, best match first.
   */
  search(request: KnowledgeSearchRequest, signal?: AbortSignal): Promise<readonly KnowledgePassage[]>
  /**
   * Find documents whose meaning is closest to one stored document. Stores
   * without a semantic index may omit this capability.
   */
  related?(id: string, maxResults?: number, signal?: AbortSignal): Promise<readonly KnowledgeRelation[]>
  /**
   * List every document currently held.
   * @param signal - cancellation for a long read.
   * @returns The stored documents.
   */
  list(signal?: AbortSignal): Promise<readonly KnowledgeDocument[]>
  /**
   * Read one stored document's full extracted text.
   * @param id - the document's content hash.
   * @param signal - cancellation for a long read.
   * @returns The text, or `undefined` when the id is unknown.
   */
  text(id: string, signal?: AbortSignal): Promise<string | undefined>
  /**
   * Remove one document, its original, and its passages.
   * @param id - the document's content hash.
   * @param signal - cancellation for a long write.
   * @returns Whether a document was removed.
   */
  remove(id: string, signal?: AbortSignal): Promise<boolean>
}

/** A document as handed to the store for persistence. */
export interface KnowledgeStoredDocument extends KnowledgeDocument {
  /** Original bytes, stored verbatim. */
  readonly content: Uint8Array
  /** Full extracted text, retained so citations resolve without re-extraction. */
  readonly text: string
}

/** A passage as handed to the store for indexing. */
export interface KnowledgeStoredPassage {
  readonly text: string
  readonly start: number
  readonly end: number
  readonly locator?: string
}

/** Failure taxonomy for the knowledge seam. */
export type KnowledgeErrorCode =
  /** The operation was cancelled by its caller. */
  | 'KNOWLEDGE_ABORTED'
  /** No registered extractor could read the supplied bytes. */
  | 'KNOWLEDGE_UNSUPPORTED_FORMAT'
  /** An extractor failed on bytes it accepted. */
  | 'KNOWLEDGE_EXTRACTION_FAILED'
  /** The vault or index could not be read or written. */
  | 'KNOWLEDGE_STORE_ERROR'
  /** The requested document is not in the vault. */
  | 'KNOWLEDGE_NOT_FOUND'

/**
 * An error raised by the knowledge seam or one of its providers. The code is
 * narrowed to {@link KnowledgeErrorCode} so callers route on a closed set
 * rather than parsing messages.
 */
export class KnowledgeError extends HarnessError {}
