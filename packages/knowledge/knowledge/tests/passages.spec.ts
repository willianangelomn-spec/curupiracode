import { describe, expect, it } from 'vitest'
import { DEFAULT_PASSAGE_CHARS, splitIntoPassages } from '../src/index.ts'

/**
 * Passage offsets are the whole basis of a checkable citation: if `[start,end)`
 * does not reproduce the passage inside the stored text, every citation the
 * system emits is unverifiable. Each case therefore asserts the slice, not just
 * the count.
 */

/** Assert every passage's offsets reproduce its text within the source. */
function expectOffsetsResolve(text: string, passages: readonly { text: string; start: number; end: number }[]): void {
  for (const passage of passages) expect(text.slice(passage.start, passage.end)).toBe(passage.text)
}

describe('passage splitting', () => {
  it('keeps a short document as a single passage covering it', () => {
    const text = 'Um parágrafo curto que cabe inteiro numa passagem.'
    const passages = splitIntoPassages(text)
    expect(passages).toHaveLength(1)
    expect(passages[0]).toMatchObject({ start: 0, end: text.length, text })
  })

  it('produces offsets that resolve back to the source text', () => {
    const paragraph = 'Frase de tamanho médio para forçar várias passagens no documento. '
    const text = paragraph.repeat(60)
    const passages = splitIntoPassages(text, 300, 60)
    expect(passages.length).toBeGreaterThan(1)
    expectOffsetsResolve(text, passages)
  })

  it('covers the document from start to end without a gap', () => {
    const text = 'abcdefghij '.repeat(80)
    const passages = splitIntoPassages(text, 200, 40)
    expect(passages[0]!.start).toBe(0)
    expect(passages.at(-1)!.end).toBe(text.length)
    // Consecutive passages must overlap or touch; a gap would make the text
    // between them unretrievable.
    for (let i = 1; i < passages.length; i++) {
      expect(passages[i]!.start).toBeLessThanOrEqual(passages[i - 1]!.end)
    }
  })

  it('overlaps neighbours so a sentence on a boundary stays findable', () => {
    const text = 'palavra '.repeat(200)
    const passages = splitIntoPassages(text, 300, 80)
    expect(passages.length).toBeGreaterThan(1)
    expect(passages[1]!.start).toBeLessThan(passages[0]!.end)
  })

  it('prefers a paragraph break over cutting mid-word', () => {
    const first = 'A'.repeat(180)
    const second = 'B'.repeat(180)
    const text = `${first}\n\n${second}`
    const passages = splitIntoPassages(text, 200, 20)
    expect(passages[0]!.text.endsWith('\n\n')).toBe(true)
    expect(passages[0]!.text).toContain(first)
    expectOffsetsResolve(text, passages)
  })

  it('labels each passage with the region holding most of it', () => {
    const text = `${'x'.repeat(150)}${'y'.repeat(150)}`
    const regions = [
      { start: 0, end: 150, locator: 'p. 1' },
      { start: 150, end: 300, locator: 'p. 2' },
    ]
    const passages = splitIntoPassages(text, 120, 10, regions)
    expect(passages[0]!.locator).toBe('p. 1')
    expect(passages.at(-1)!.locator).toBe('p. 2')
  })

  it('omits a locator when no region was supplied, rather than inventing one', () => {
    const passages = splitIntoPassages('Texto sem estrutura conhecida.', 100, 10)
    expect(passages[0]!.locator).toBeUndefined()
  })

  it('yields nothing for blank input instead of an empty passage', () => {
    expect(splitIntoPassages('')).toEqual([])
    expect(splitIntoPassages('   \n\n\t  ')).toEqual([])
  })

  it('terminates on text with no break opportunity at all', () => {
    // A single unbroken token cannot honor a preferred break; splitting must
    // still advance rather than loop.
    const text = 'z'.repeat(1000)
    const passages = splitIntoPassages(text, 100, 20)
    expect(passages.length).toBeGreaterThan(1)
    expect(passages.at(-1)!.end).toBe(text.length)
    expectOffsetsResolve(text, passages)
  })

  it('exposes a default passage size the callers can rely on', () => {
    expect(DEFAULT_PASSAGE_CHARS).toBeGreaterThan(0)
  })
})
