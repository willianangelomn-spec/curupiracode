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
  KnowledgeSearchRequest,
  KnowledgeStore,
  KnowledgeStoredDocument,
  KnowledgeStoredPassage,
} from '@deepseek-ai/dsh-knowledge'

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
  readonly document_id: string
  readonly name: string
  readonly origin: string | null
  readonly text: string
  readonly start_offset: number
  readonly end_offset: number
  readonly locator: string | null
  readonly rank: number
}

/** The local store implementation. */
export class LocalKnowledgeStore implements KnowledgeStore {
  readonly id = LOCAL_STORE_ID
  private readonly root: string
  private db: DatabaseSync | undefined
  private readonly Database: typeof DatabaseSync

  constructor(options: LocalKnowledgeStoreOptions) {
    this.root = options.root
    this.Database = options.Database
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
    this.db = db
  }

  /** Close the index. */
  close(): void {
    this.db?.close()
    this.db = undefined
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
    if (existing !== undefined) return { alreadyPresent: true }

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
    return { alreadyPresent: false }
  }

  /** @inheritdoc */
  async search(request: KnowledgeSearchRequest, signal?: AbortSignal): Promise<readonly KnowledgePassage[]> {
    const db = this.require(signal)
    const match = toMatchExpression(request.query)
    if (match === undefined) return []

    const ids = request.documentIds
    const filter = ids !== undefined && ids.length > 0
      ? ` AND p.document_id IN (${ids.map(() => '?').join(', ')})`
      : ''
    // bm25() is more negative for better matches; negate so callers can treat
    // the score as "higher is better" without knowing the index's convention.
    const sql = `
      SELECT p.document_id, p.text, p.start_offset, p.end_offset, p.locator,
             d.name, d.origin, -bm25(passages) AS rank
      FROM passages p
      JOIN documents d ON d.id = p.document_id
      WHERE passages MATCH ?${filter}
      ORDER BY rank DESC
      LIMIT ?
    `
    const limit = request.maxResults ?? 10
    const params: (string | number)[] = [match, ...ids !== undefined && ids.length > 0 ? ids : [], limit]
    let rows: PassageRow[]
    try {
      rows = db.prepare(sql).all(...params) as unknown as PassageRow[]
    } catch (error: unknown) {
      throw new KnowledgeError(`knowledge search failed for "${request.query}"`, 'KNOWLEDGE_STORE_ERROR', { cause: error })
    }
    return rows.map((row): KnowledgePassage => ({
      documentId: row.document_id,
      documentName: row.name,
      ...row.origin === null ? {} : { origin: row.origin },
      text: row.text,
      start: row.start_offset,
      end: row.end_offset,
      ...row.locator === null ? {} : { locator: row.locator },
      score: row.rank,
    }))
  }

  /** @inheritdoc */
  async list(signal?: AbortSignal): Promise<readonly KnowledgeDocument[]> {
    const db = this.require(signal)
    const rows = db.prepare(`
      SELECT id, name, origin, extractor, passage_count, ingested_at
      FROM documents ORDER BY ingested_at DESC
    `).all() as unknown as DocumentRow[]
    return rows.map((row): KnowledgeDocument => ({
      id: row.id,
      name: row.name,
      ...row.origin === null ? {} : { origin: row.origin },
      extractor: row.extractor,
      passageCount: row.passage_count,
      ingestedAt: row.ingested_at,
    }))
  }

  /** @inheritdoc */
  async text(id: string, signal?: AbortSignal): Promise<string | undefined> {
    const db = this.require(signal)
    const row = db.prepare('SELECT text FROM documents WHERE id = ?').get(id) as { text: string } | undefined
    return row?.text
  }

  /** Read one document's stored original bytes. */
  async original(id: string): Promise<Uint8Array | undefined> {
    try {
      return await readFile(this.objectPath(id))
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

  private require(signal?: AbortSignal): DatabaseSync {
    if (signal?.aborted) throw new KnowledgeError('knowledge operation was cancelled', 'KNOWLEDGE_ABORTED')
    if (this.db === undefined) throw new KnowledgeError('the local knowledge store is not open', 'KNOWLEDGE_STORE_ERROR')
    return this.db
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
