/**
 * Local knowledge store: immutable content-addressed originals on disk plus a
 * SQLite FTS5 index over their passages.
 *
 * Everything ships with Node — `node:sqlite` provides FTS5 — so a fresh install
 * searches its own material with no database, server, service, or model to
 * install first.
 * @module @deepseek-ai/dsh-knowledge-local/store
 */

import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import type { DatabaseSync } from 'node:sqlite'
import { KnowledgeError } from '@deepseek-ai/dsh-knowledge'
import type {
  KnowledgeDocument,
  KnowledgePassage,
  KnowledgeRelation,
  KnowledgeSearchRequest,
  KnowledgeStore,
  KnowledgeStoredDocument,
  KnowledgeStoredPassage,
} from '@deepseek-ai/dsh-knowledge'
import type { TextEmbedder } from './embedder.ts'

/** Stable id this store registers under. */
export const LOCAL_STORE_ID = 'local-sqlite'

/** Layout version; a breaking change to the vault bumps this directory. */
export const VAULT_VERSION = 'v1'

/**
 * On-disk layout under the vault root:
 * - `objects/<aa>/<hash>` — original bytes, never rewritten
 * - `index.db` — SQLite catalog and FTS5 passage index
 *
 * The originals are the source of truth: the index can be deleted and rebuilt
 * from them, but nothing rebuilds a lost original.
 */
export interface LocalKnowledgeStoreOptions {
  /** Vault root directory. */
  readonly root: string
  /** `node:sqlite`'s DatabaseSync constructor, injected for testability. */
  readonly Database: typeof DatabaseSync
  /** Optional local embedder; omission keeps the original FTS-only mode. */
  readonly embedder?: TextEmbedder
  /** Receives recoverable semantic-index failures; lexical storage remains usable. */
  readonly onSemanticError?: (error: unknown) => void
}

interface DocumentRow {
  readonly id: string
  readonly name: string
  readonly origin: string | null
  readonly extractor: string
  readonly passage_count: number
  readonly ingested_at: number
}

interface PassageRow {
  readonly passage_rowid: number
  readonly document_id: string
  readonly name: string
  readonly origin: string | null
  readonly text: string
  readonly start_offset: number
  readonly end_offset: number
  readonly locator: string | null
  readonly rank: number
}

interface VectorPassageRow extends PassageRow {
  readonly passage_rowid: number
  readonly embedding: Uint8Array
}

interface MissingPassageRow {
  readonly passage_rowid: number
  readonly document_id: string
  readonly text: string
}

interface DocumentVectorRow {
  readonly document_id: string
  readonly name: string
  readonly origin: string | null
  readonly embedding: Uint8Array
}

const EMBEDDING_BATCH_SIZE = 16
const SEMANTIC_SCAN_LIMIT = 50_000

/** The local store implementation. */
export class LocalKnowledgeStore implements KnowledgeStore {
  readonly id = LOCAL_STORE_ID
  private readonly root: string
  private db: DatabaseSync | undefined
  private readonly Database: typeof DatabaseSync
  private readonly embedder: TextEmbedder | undefined
  private readonly onSemanticError: ((error: unknown) => void) | undefined
  private semanticTail: Promise<unknown> = Promise.resolve()

  constructor(options: LocalKnowledgeStoreOptions) {
    this.root = options.root
    this.Database = options.Database
    this.embedder = options.embedder
    this.onSemanticError = options.onSemanticError
  }

  /**
   * Open the vault and index, creating them when absent.
   * @returns Nothing; the store is usable once this resolves.
   */
  async open(): Promise<void> {
    await mkdir(join(this.root, 'objects'), { recursive: true })
    const db = new this.Database(join(this.root, 'index.db'))
    // WAL keeps a long ingest from blocking concurrent reads; FTS5 is built in,
    // so no extension has to be loaded (and loading is left disabled).
    db.exec('PRAGMA journal_mode = WAL')
    db.exec('PRAGMA foreign_keys = ON')
    db.exec(`
      CREATE TABLE IF NOT EXISTS documents (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        origin TEXT,
        extractor TEXT NOT NULL,
        passage_count INTEGER NOT NULL,
        ingested_at INTEGER NOT NULL,
        text TEXT NOT NULL
      )
    `)
    // Only `text` is indexed; the rest ride along so a hit returns its
    // provenance without a second query.
    db.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS passages USING fts5(
        text,
        document_id UNINDEXED,
        start_offset UNINDEXED,
        end_offset UNINDEXED,
        locator UNINDEXED,
        tokenize = 'unicode61 remove_diacritics 2'
      )
    `)
    db.exec(`
      CREATE TABLE IF NOT EXISTS passage_vectors (
        passage_rowid INTEGER NOT NULL,
        document_id TEXT NOT NULL,
        model TEXT NOT NULL,
        embedding BLOB NOT NULL,
        PRIMARY KEY (passage_rowid, model)
      )
    `)
    db.exec(`
      CREATE TABLE IF NOT EXISTS document_vectors (
        document_id TEXT NOT NULL,
        model TEXT NOT NULL,
        embedding BLOB NOT NULL,
        PRIMARY KEY (document_id, model),
        FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
      )
    `)
    this.db = db
  }

  /** Close the index. */
  close(): void {
    this.db?.close()
    this.db = undefined
    void this.embedder?.dispose()
  }

  /** @inheritdoc */
  available(): boolean {
    return this.db !== undefined
  }

  /** @inheritdoc */
  async put(
    document: KnowledgeStoredDocument,
    passages: readonly KnowledgeStoredPassage[],
    signal?: AbortSignal,
  ): Promise<{ alreadyPresent: boolean }> {
    const db = this.require(signal)
    const existing = db.prepare('SELECT id FROM documents WHERE id = ?').get(document.id)
    if (existing !== undefined) {
      await this.trySemantic(() => this.serializeSemantic(() => this.indexMissingVectors(document.id, signal)))
      return { alreadyPresent: true }
    }

    // The original lands before the catalog row: a crash between the two leaves
    // an unreferenced blob (harmless, re-ingest overwrites) rather than a
    // catalog entry pointing at bytes that were never written.
    const objectPath = this.objectPath(document.id)
    await mkdir(dirname(objectPath), { recursive: true })
    await writeFile(objectPath, document.content)

    db.exec('BEGIN')
    try {
      db.prepare(`
        INSERT INTO documents (id, name, origin, extractor, passage_count, ingested_at, text)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        document.id,
        document.name,
        document.origin ?? null,
        document.extractor,
        document.passageCount,
        document.ingestedAt,
        document.text,
      )
      const insert = db.prepare(`
        INSERT INTO passages (text, document_id, start_offset, end_offset, locator)
        VALUES (?, ?, ?, ?, ?)
      `)
      for (const passage of passages) {
        insert.run(passage.text, document.id, passage.start, passage.end, passage.locator ?? null)
      }
      db.exec('COMMIT')
    } catch (error: unknown) {
      db.exec('ROLLBACK')
      throw new KnowledgeError(`failed to index "${document.name}"`, 'KNOWLEDGE_STORE_ERROR', { cause: error })
    }
    await this.trySemantic(() => this.serializeSemantic(() => this.indexMissingVectors(document.id, signal)))
    return { alreadyPresent: false }
  }

  /** @inheritdoc */
  async search(request: KnowledgeSearchRequest, signal?: AbortSignal): Promise<readonly KnowledgePassage[]> {
    const db = this.require(signal)
    const match = toMatchExpression(request.query)
    const ids = request.documentIds
    const filter = ids !== undefined && ids.length > 0
      ? ` AND p.document_id IN (${ids.map(() => '?').join(', ')})`
      : ''
    const limit = request.maxResults ?? 10
    const lexicalLimit = Math.max(20, limit * 4)
    let lexicalRows: PassageRow[] = []
    if (match !== undefined) {
      const sql = `
        SELECT p.rowid AS passage_rowid, p.document_id, p.text, p.start_offset, p.end_offset, p.locator,
               d.name, d.origin, -bm25(passages) AS rank
        FROM passages p
        JOIN documents d ON d.id = p.document_id
        WHERE passages MATCH ?${filter}
        ORDER BY rank DESC
        LIMIT ?
      `
      const params: (string | number)[] = [
        match,
        ...ids !== undefined && ids.length > 0 ? ids : [],
        lexicalLimit,
      ]
      try {
        lexicalRows = db.prepare(sql).all(...params) as unknown as PassageRow[]
      } catch (error: unknown) {
        throw new KnowledgeError(`knowledge search failed for "${request.query}"`, 'KNOWLEDGE_STORE_ERROR', { cause: error })
      }
    }

    const semanticRows = await this.trySemanticResult(async () => {
      await this.serializeSemantic(() => this.indexMissingVectors(undefined, signal))
      const embedder = this.embedder as TextEmbedder
      const [queryVector] = await embedder.embed([request.query], 'query', signal)
      if (queryVector === undefined) return []
      const vectorFilter = ids !== undefined && ids.length > 0
        ? ` AND p.document_id IN (${ids.map(() => '?').join(', ')})`
        : ''
      const rows = db.prepare(`
        SELECT p.rowid AS passage_rowid, p.document_id, p.text, p.start_offset, p.end_offset, p.locator,
               d.name, d.origin, v.embedding, 0 AS rank
        FROM passage_vectors v
        JOIN passages p ON p.rowid = v.passage_rowid
        JOIN documents d ON d.id = p.document_id
        WHERE v.model = ?${vectorFilter}
        LIMIT ${SEMANTIC_SCAN_LIMIT}
      `).all(embedder.model, ...(ids ?? [])) as unknown as VectorPassageRow[]
      return rows
        .map(row => ({ row, similarity: dot(queryVector, decodeVector(row.embedding)) }))
        .sort((left, right) => right.similarity - left.similarity)
        .slice(0, lexicalLimit)
    }) ?? []

    const combined = new Map<number, { row: PassageRow; score: number }>()
    lexicalRows.forEach((row, index) => {
      combined.set(row.passage_rowid, { row, score: 0.45 / (index + 1) })
    })
    semanticRows.forEach(({ row, similarity }) => {
      const semanticScore = 0.55 * Math.max(0, (similarity + 1) / 2)
      const current = combined.get(row.passage_rowid)
      combined.set(row.passage_rowid, {
        row,
        score: semanticScore + (current?.score ?? 0),
      })
    })
    return [...combined.values()]
      .sort((left, right) => right.score - left.score)
      .slice(0, limit)
      .map(({ row, score }) => passageFromRow(row, score))
  }

  /** @inheritdoc */
  list(signal?: AbortSignal): Promise<readonly KnowledgeDocument[]> {
    const db = this.require(signal)
    const rows = db.prepare(`
      SELECT id, name, origin, extractor, passage_count, ingested_at
      FROM documents ORDER BY ingested_at DESC
    `).all() as unknown as DocumentRow[]
    return Promise.resolve(rows.map((row): KnowledgeDocument => ({
      id: row.id,
      name: row.name,
      ...row.origin === null ? {} : { origin: row.origin },
      extractor: row.extractor,
      passageCount: row.passage_count,
      ingestedAt: row.ingested_at,
    })))
  }

  /** @inheritdoc */
  async related(id: string, maxResults = 8, signal?: AbortSignal): Promise<readonly KnowledgeRelation[]> {
    const db = this.require(signal)
    const exists = db.prepare('SELECT id FROM documents WHERE id = ?').get(id)
    if (exists === undefined) throw new KnowledgeError(`no document with id "${id}"`, 'KNOWLEDGE_NOT_FOUND')
    const related = await this.trySemanticResult(async () => {
      await this.serializeSemantic(() => this.indexMissingVectors(undefined, signal))
      const embedder = this.embedder as TextEmbedder
      const source = db.prepare(`
        SELECT embedding FROM document_vectors WHERE document_id = ? AND model = ?
      `).get(id, embedder.model) as { embedding: Uint8Array } | undefined
      if (source === undefined) return []
      const sourceVector = decodeVector(source.embedding)
      const rows = db.prepare(`
        SELECT v.document_id, d.name, d.origin, v.embedding
        FROM document_vectors v
        JOIN documents d ON d.id = v.document_id
        WHERE v.model = ? AND v.document_id <> ?
      `).all(embedder.model, id) as unknown as DocumentVectorRow[]
      return rows
        .map((row): KnowledgeRelation => ({
          documentId: row.document_id,
          documentName: row.name,
          ...row.origin === null ? {} : { origin: row.origin },
          score: dot(sourceVector, decodeVector(row.embedding)),
        }))
        .sort((left, right) => right.score - left.score)
        .slice(0, maxResults)
    })
    return related ?? []
  }

  /** @inheritdoc */
  text(id: string, signal?: AbortSignal): Promise<string | undefined> {
    const db = this.require(signal)
    const row = db.prepare('SELECT text FROM documents WHERE id = ?').get(id) as { text: string } | undefined
    return Promise.resolve(row?.text)
  }

  /** Read one document's stored original bytes. */
  async original(id: string): Promise<Uint8Array | undefined> {
    try {
      return new Uint8Array(await readFile(this.objectPath(id)))
    } catch {
      return undefined
    }
  }

  /** @inheritdoc */
  async remove(id: string, signal?: AbortSignal): Promise<boolean> {
    const db = this.require(signal)
    db.exec('BEGIN')
    let removed: boolean
    try {
      db.prepare('DELETE FROM passage_vectors WHERE document_id = ?').run(id)
      db.prepare('DELETE FROM passages WHERE document_id = ?').run(id)
      const result = db.prepare('DELETE FROM documents WHERE id = ?').run(id)
      removed = Number(result.changes) > 0
      db.exec('COMMIT')
    } catch (error: unknown) {
      db.exec('ROLLBACK')
      throw new KnowledgeError(`failed to remove document "${id}"`, 'KNOWLEDGE_STORE_ERROR', { cause: error })
    }
    if (removed) await rm(this.objectPath(id), { force: true })
    return removed
  }

  private objectPath(id: string): string {
    return join(this.root, 'objects', id.slice(0, 2), id)
  }

  /** Fill vectors missing for the active model and refresh document centroids. */
  private async indexMissingVectors(documentId?: string, signal?: AbortSignal): Promise<void> {
    const embedder = this.embedder
    if (embedder === undefined) return
    const db = this.require(signal)
    const rows = db.prepare(`
      SELECT p.rowid AS passage_rowid, p.document_id, p.text
      FROM passages p
      LEFT JOIN passage_vectors v ON v.passage_rowid = p.rowid AND v.model = ?
      WHERE v.passage_rowid IS NULL${documentId === undefined ? '' : ' AND p.document_id = ?'}
      ORDER BY p.rowid
      LIMIT ${SEMANTIC_SCAN_LIMIT}
    `).all(embedder.model, ...(documentId === undefined ? [] : [documentId])) as unknown as MissingPassageRow[]
    const affected = new Set<string>()
    for (let offset = 0; offset < rows.length; offset += EMBEDDING_BATCH_SIZE) {
      signal?.throwIfAborted()
      const batch = rows.slice(offset, offset + EMBEDDING_BATCH_SIZE)
      const vectors = await embedder.embed(batch.map(row => row.text), 'passage', signal)
      db.exec('BEGIN')
      try {
        const insert = db.prepare(`
          INSERT OR REPLACE INTO passage_vectors (passage_rowid, document_id, model, embedding)
          VALUES (?, ?, ?, ?)
        `)
        batch.forEach((row, index) => {
          const vector = vectors[index]
          if (vector === undefined) throw new Error('embedding batch returned fewer vectors than passages')
          insert.run(row.passage_rowid, row.document_id, embedder.model, encodeVector(vector))
          affected.add(row.document_id)
        })
        db.exec('COMMIT')
      } catch (error: unknown) {
        db.exec('ROLLBACK')
        throw error
      }
    }
    if (documentId !== undefined) affected.add(documentId)
    for (const id of affected) this.refreshDocumentVector(id, embedder.model)
  }

  /** Recompute one document centroid from its normalized passage vectors. */
  private refreshDocumentVector(documentId: string, model: string): void {
    const db = this.require()
    const rows = db.prepare(`
      SELECT embedding FROM passage_vectors WHERE document_id = ? AND model = ? ORDER BY passage_rowid
    `).all(documentId, model) as unknown as Array<{ embedding: Uint8Array }>
    if (rows.length === 0) return
    const centroid = normalizedMean(rows.map(row => decodeVector(row.embedding)))
    db.prepare(`
      INSERT INTO document_vectors (document_id, model, embedding) VALUES (?, ?, ?)
      ON CONFLICT(document_id, model) DO UPDATE SET embedding = excluded.embedding
    `).run(documentId, model, encodeVector(centroid))
  }

  /** Serialize local model work so concurrent search/ingest shares one ONNX pipeline. */
  private serializeSemantic<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.semanticTail.then(operation, operation)
    this.semanticTail = result.then(() => undefined, () => undefined)
    return result
  }

  private async trySemantic(operation: () => Promise<unknown>): Promise<void> {
    await this.trySemanticResult(operation)
  }

  private async trySemanticResult<T>(operation: () => Promise<T>): Promise<T | undefined> {
    if (this.embedder === undefined) return undefined
    try {
      return await operation()
    } catch (error: unknown) {
      this.onSemanticError?.(error)
      return undefined
    }
  }

  private require(signal?: AbortSignal): DatabaseSync {
    if (signal?.aborted) throw new KnowledgeError('knowledge operation was cancelled', 'KNOWLEDGE_ABORTED')
    if (this.db === undefined) throw new KnowledgeError('the local knowledge store is not open', 'KNOWLEDGE_STORE_ERROR')
    return this.db
  }
}

/** Stable little-endian vector encoding shared across operating systems. */
function encodeVector(vector: Float32Array): Buffer {
  const encoded = Buffer.allocUnsafe(vector.length * 4)
  vector.forEach((value, index) => encoded.writeFloatLE(value, index * 4))
  return encoded
}

function decodeVector(encoded: Uint8Array): Float32Array {
  const bytes = Buffer.from(encoded.buffer, encoded.byteOffset, encoded.byteLength)
  const vector = new Float32Array(bytes.length / 4)
  for (let index = 0; index < vector.length; index++) vector[index] = bytes.readFloatLE(index * 4)
  return vector
}

function dot(left: Float32Array, right: Float32Array): number {
  if (left.length !== right.length) return -1
  let score = 0
  for (let index = 0; index < left.length; index++) score += (left[index] ?? 0) * (right[index] ?? 0)
  return score
}

function normalizedMean(vectors: readonly Float32Array[]): Float32Array {
  const dimensions = vectors[0]?.length ?? 0
  const mean = new Float32Array(dimensions)
  for (const vector of vectors) {
    if (vector.length !== dimensions) throw new Error('cannot average embeddings with different dimensions')
    vector.forEach((value, index) => { mean[index] = (mean[index] ?? 0) + value })
  }
  let norm = 0
  mean.forEach((value) => { norm += value * value })
  norm = Math.sqrt(norm)
  if (norm > 0) mean.forEach((value, index) => { mean[index] = value / norm })
  return mean
}

function passageFromRow(row: PassageRow, score: number): KnowledgePassage {
  return {
    documentId: row.document_id,
    documentName: row.name,
    ...row.origin === null ? {} : { origin: row.origin },
    text: row.text,
    start: row.start_offset,
    end: row.end_offset,
    ...row.locator === null ? {} : { locator: row.locator },
    score,
  }
}

/**
 * Build a safe FTS5 MATCH expression from free user text.
 *
 * FTS5's query language treats `"`, `*`, `:`, `^`, `-`, `(`, `)`, and `OR`/`AND`
 * as syntax, so passing a natural-language question through raw turns a search
 * into a syntax error. Every term is quoted as a literal and the terms are
 * OR-ed, which matches how people phrase questions: a document need not contain
 * every word to be worth reading.
 * @param query - the user's raw query text.
 * @returns A MATCH expression, or `undefined` when the query has no usable term.
 */
export function toMatchExpression(query: string): string | undefined {
  const terms = query
    .split(/[^\p{L}\p{N}_]+/u)
    .filter(term => term.length > 1)
    .map(term => `"${term.replace(/"/g, '""')}"`)
  return terms.length === 0 ? undefined : terms.join(' OR ')
}
