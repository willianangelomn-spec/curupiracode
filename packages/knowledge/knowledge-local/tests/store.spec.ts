import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { splitIntoPassages } from '@deepseek-ai/dsh-knowledge'
import { LocalKnowledgeStore, toMatchExpression } from '../src/store.ts'

/**
 * The store is the claim that a fresh install can search its own material with
 * nothing installed: these run against real `node:sqlite` FTS5 and a real
 * directory, never a stub, because a mocked index would prove nothing about
 * whether the shipped runtime actually has FTS5.
 */

const encoder = new TextEncoder()

/** Build a stored document plus seam-split passages, as `ingest` would. */
function documentOf(id: string, name: string, text: string, origin?: string) {
  return {
    document: {
      id,
      name,
      ...origin === undefined ? {} : { origin },
      extractor: 'text',
      passageCount: 0,
      ingestedAt: Date.now(),
      content: encoder.encode(text),
      text,
    },
    passages: splitIntoPassages(text, 200, 40),
  }
}

describe('the local knowledge store', () => {
  let root: string
  let store: LocalKnowledgeStore

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'curupira-knowledge-'))
    store = new LocalKnowledgeStore({ root, Database: DatabaseSync })
    await store.open()
  })

  afterEach(async () => {
    store.close()
    await rm(root, { recursive: true, force: true })
  })

  it('reports unusable until opened', () => {
    const closed = new LocalKnowledgeStore({ root, Database: DatabaseSync })
    expect(closed.available()).toBe(false)
    expect(store.available()).toBe(true)
  })

  it('indexes a document and returns passages with verifiable provenance', async () => {
    const text = [
      'O prazo para reclamar de vício aparente é de noventa dias para produto durável.',
      'A reclamação formulada perante o fornecedor obsta a decadência até a resposta negativa.',
    ].join('\n\n')
    const { document, passages } = documentOf('a1', 'cdc.md', text, '/docs/cdc.md')
    await expect(store.put(document, passages)).resolves.toEqual({ alreadyPresent: false })

    const found = await store.search({ query: 'decadência reclamação' })
    expect(found.length).toBeGreaterThan(0)
    const hit = found[0]!
    expect(hit.documentId).toBe('a1')
    expect(hit.documentName).toBe('cdc.md')
    expect(hit.origin).toBe('/docs/cdc.md')
    // The offsets must locate the passage inside the stored text, which is what
    // makes a citation checkable rather than merely plausible.
    expect(text.slice(hit.start, hit.end)).toBe(hit.text)
  })

  it('treats identical bytes as already present rather than duplicating', async () => {
    const { document, passages } = documentOf('b2', 'nota.md', 'Conteúdo idêntico reindexado duas vezes.')
    await store.put(document, passages)
    await expect(store.put(document, passages)).resolves.toEqual({ alreadyPresent: true })
    await expect(store.list()).resolves.toHaveLength(1)
  })

  it('matches accent-insensitively so pt-BR queries find pt-BR text', async () => {
    const { document, passages } = documentOf('c3', 'acentos.md', 'A indenização por dano moral foi majorada.')
    await store.put(document, passages)
    // A user typing without accents must still reach accented source text.
    await expect(store.search({ query: 'indenizacao' })).resolves.not.toHaveLength(0)
  })

  it('restricts retrieval to the requested documents', async () => {
    const first = documentOf('d4', 'um.md', 'Contrato de locação residencial urbana.')
    const second = documentOf('e5', 'dois.md', 'Contrato de locação comercial.')
    await store.put(first.document, first.passages)
    await store.put(second.document, second.passages)

    const all = await store.search({ query: 'locação' })
    expect(new Set(all.map(p => p.documentId))).toEqual(new Set(['d4', 'e5']))

    const only = await store.search({ query: 'locação', documentIds: ['e5'] })
    expect(only.every(passage => passage.documentId === 'e5')).toBe(true)
    expect(only.length).toBeGreaterThan(0)
  })

  it('keeps the original bytes retrievable and drops everything on removal', async () => {
    const { document, passages } = documentOf('f6', 'original.md', 'Bytes preservados exatamente.')
    await store.put(document, passages)
    await expect(store.original('f6')).resolves.toEqual(document.content)
    await expect(store.text('f6')).resolves.toBe(document.text)

    await expect(store.remove('f6')).resolves.toBe(true)
    await expect(store.list()).resolves.toHaveLength(0)
    await expect(store.search({ query: 'preservados' })).resolves.toHaveLength(0)
    await expect(store.original('f6')).resolves.toBeUndefined()
    await expect(store.remove('f6')).resolves.toBe(false)
  })

  it('survives a query written as a question rather than as index syntax', async () => {
    const { document, passages } = documentOf('g7', 'faq.md', 'A taxa de conveniência deve ser informada antes da compra.')
    await store.put(document, passages)
    // Punctuation and operators here are FTS5 syntax; unescaped they raise a
    // syntax error instead of searching.
    const hostile = 'a taxa "de" conveniência (não informada) OR AND * ^ -'
    await expect(store.search({ query: hostile })).resolves.not.toHaveLength(0)
  })

  it('returns nothing rather than throwing for a query with no usable term', async () => {
    const { document, passages } = documentOf('h8', 'x.md', 'Qualquer conteúdo.')
    await store.put(document, passages)
    await expect(store.search({ query: '?! ( ) *' })).resolves.toEqual([])
  })

  it('rejects use after close instead of silently doing nothing', async () => {
    store.close()
    await expect(store.search({ query: 'qualquer' })).rejects.toThrow(/not open/)
  })

  it('persists across reopen, since the vault outlives the process', async () => {
    const { document, passages } = documentOf('i9', 'persistente.md', 'Sobrevive ao reinício do processo.')
    await store.put(document, passages)
    store.close()

    const reopened = new LocalKnowledgeStore({ root, Database: DatabaseSync })
    await reopened.open()
    try {
      await expect(reopened.search({ query: 'reinício' })).resolves.not.toHaveLength(0)
    } finally {
      reopened.close()
    }
  })

  it('honors cancellation before touching the index', async () => {
    const controller = new AbortController()
    controller.abort()
    await expect(store.search({ query: 'x' }, controller.signal)).rejects.toThrow(/cancelled/)
  })
})

describe('the FTS5 match expression builder', () => {
  it('quotes every term so user punctuation cannot become syntax', () => {
    expect(toMatchExpression('dano moral')).toBe('"dano" OR "moral"')
    expect(toMatchExpression('a "citação" (direta)')).toBe('"citação" OR "direta"')
  })

  it('drops single characters and yields nothing when no term survives', () => {
    expect(toMatchExpression('a e o')).toBeUndefined()
    expect(toMatchExpression('*** ???')).toBeUndefined()
  })
})
