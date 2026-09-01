import { deflateRawSync } from 'node:zlib'
import { describe, expect, it } from 'vitest'
import { BUILTIN_EXTRACTORS, docxExtractor, htmlExtractor, textExtractor } from '../src/extractors.ts'

/**
 * These extractors are the zero-install promise: if DOCX needs a library, the
 * claim breaks. The DOCX cases therefore build real ZIP containers — stored and
 * deflated — rather than asserting against a fixture the parser never sees.
 */

const encoder = new TextEncoder()

/** Build a minimal ZIP holding one entry, stored or deflated. */
function zipWith(entryName: string, body: string, deflate = false): Uint8Array {
  const nameBytes = encoder.encode(entryName)
  const raw = encoder.encode(body)
  const data = deflate ? new Uint8Array(deflateRawSync(raw)) : raw
  const header = new Uint8Array(30 + nameBytes.length)
  const view = new DataView(header.buffer)
  view.setUint32(0, 0x04034b50, true)
  view.setUint16(4, 20, true)
  view.setUint16(6, 0, true)
  view.setUint16(8, deflate ? 8 : 0, true)
  view.setUint32(18, data.length, true)
  view.setUint32(22, raw.length, true)
  view.setUint16(26, nameBytes.length, true)
  view.setUint16(28, 0, true)
  header.set(nameBytes, 30)
  const out = new Uint8Array(header.length + data.length)
  out.set(header, 0)
  out.set(data, header.length)
  return out
}

/** Wrap paragraphs in the WordprocessingML a real DOCX carries. */
function documentXml(paragraphs: readonly string[]): string {
  const body = paragraphs
    .map(text => `<w:p><w:r><w:t xml:space="preserve">${text}</w:t></w:r></w:p>`)
    .join('')
  return `<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="x"><w:body>${body}</w:body></w:document>`
}

describe('the plain-text and Markdown extractor', () => {
  it('preserves the text verbatim', async () => {
    const text = 'Primeira linha.\n\nSegunda linha com acentuação.'
    await expect(textExtractor.extract(encoder.encode(text))).resolves.toMatchObject({ text })
  })

  it('labels regions by heading so a passage can cite its section', async () => {
    const markdown = '# Introdução\n\nTexto um.\n\n## Detalhes\n\nTexto dois.'
    const result = await textExtractor.extract(encoder.encode(markdown))
    expect(result.regions?.map(region => region.locator)).toEqual(['§ Introdução', '§ Detalhes'])
    const second = result.regions?.[1]
    expect(second).toBeDefined()
    if (second === undefined) throw new Error('expected the second Markdown region')
    expect(markdown.slice(second.start, second.end)).toContain('Texto dois.')
  })

  it('accepts textual bytes with an unknown extension but refuses binary', () => {
    expect(textExtractor.canExtract(encoder.encode('anotações soltas'), 'notas')).toBe(true)
    // A NUL byte marks a container, not prose.
    expect(textExtractor.canExtract(new Uint8Array([0x41, 0x00, 0x42]), 'falso.txt')).toBe(false)
  })

  it('strips a UTF-8 BOM rather than indexing it as content', async () => {
    const withBom = new Uint8Array([0xEF, 0xBB, 0xBF, ...encoder.encode('Conteúdo.')])
    await expect(textExtractor.extract(withBom)).resolves.toMatchObject({ text: 'Conteúdo.' })
  })
})

describe('the HTML extractor', () => {
  it('keeps readable prose and drops markup machinery', async () => {
    const html = [
      '<!doctype html><html><head><style>p{color:red}</style>',
      '<script>var x = "não é texto";</script></head>',
      '<body><h1>Título</h1><p>Primeiro parágrafo.</p><p>Segundo &amp; último.</p>',
      '<!-- comentário --></body></html>',
    ].join('')
    const { text } = await htmlExtractor.extract(encoder.encode(html))
    expect(text).toContain('Título')
    expect(text).toContain('Primeiro parágrafo.')
    expect(text).toContain('Segundo & último.')
    expect(text).not.toContain('color:red')
    expect(text).not.toContain('var x')
    expect(text).not.toContain('comentário')
  })

  it('decodes numeric entities', async () => {
    const { text } = await htmlExtractor.extract(encoder.encode('<p>&#231;&#227;o &#x41;</p>'))
    expect(text).toBe('ção A')
  })

  it('recognizes HTML by content when the name does not say so', () => {
    expect(htmlExtractor.canExtract(encoder.encode('<!DOCTYPE html><html></html>'), 'sem-extensao')).toBe(true)
    expect(htmlExtractor.canExtract(encoder.encode('texto comum'), 'nota.txt')).toBe(false)
  })
})

describe('the DOCX extractor', () => {
  it('reads a stored (uncompressed) container', async () => {
    const docx = zipWith('word/document.xml', documentXml(['Primeiro parágrafo.', 'Segundo parágrafo.']))
    const { text } = await docxExtractor.extract(docx)
    expect(text).toContain('Primeiro parágrafo.')
    expect(text).toContain('Segundo parágrafo.')
  })

  it('reads a deflated container, which is what Word actually writes', async () => {
    const docx = zipWith('word/document.xml', documentXml(['Conteúdo comprimido.']), true)
    await expect(docxExtractor.extract(docx)).resolves.toMatchObject({ text: 'Conteúdo comprimido.' })
  })

  it('identifies a DOCX by its ZIP signature and its document part', () => {
    const docx = zipWith('word/document.xml', documentXml(['x']))
    expect(docxExtractor.canExtract(docx, 'contrato.docx')).toBe(true)
    // Same bytes, misleading name: the container still decides.
    expect(docxExtractor.canExtract(docx, 'contrato')).toBe(true)
    // A ZIP that is not a DOCX must be declined, not half-read.
    expect(docxExtractor.canExtract(zipWith('outro.txt', 'nada'), 'arquivo.zip')).toBe(false)
    expect(docxExtractor.canExtract(encoder.encode('texto'), 'nota.txt')).toBe(false)
  })

  it('fails loudly when the container lacks a document part', async () => {
    const notDocx = zipWith('word/settings.xml', '<settings/>')
    await expect(docxExtractor.extract(notDocx)).rejects.toThrow(/document\.xml/)
  })
})

describe('extractor match order', () => {
  it('checks binary containers before the permissive text extractor', () => {
    // The text extractor accepts anything that merely looks textual, so a
    // container must be offered to its own extractor first or DOCX would be
    // indexed as XML soup.
    const ids = BUILTIN_EXTRACTORS.map(extractor => extractor.id)
    expect(ids.indexOf('docx')).toBeLessThan(ids.indexOf('text'))
    expect(ids.indexOf('html')).toBeLessThan(ids.indexOf('text'))
  })
})
