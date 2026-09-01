/**
 * Zero-dependency knowledge extractors: plain text, Markdown, HTML, and DOCX.
 *
 * Every format here is read with what Node already ships, so this set works in
 * an install that downloaded nothing. DOCX qualifies because the format is a
 * ZIP of XML parts and `node:zlib` inflates it — no Office runtime, no parser
 * library.
 * @module @deepseek-ai/dsh-knowledge-extract-text/extractors
 */

import { inflateRawSync } from 'node:zlib'
import type { KnowledgeExtraction, KnowledgeExtractor, KnowledgeRegion } from '@deepseek-ai/dsh-knowledge'

/** Extensions treated as plain text. */
const TEXT_FORMATS = ['txt', 'text', 'log', 'csv', 'json', 'yaml', 'yml'] as const

/** Extensions treated as Markdown. */
const MARKDOWN_FORMATS = ['md', 'markdown', 'mdx'] as const

/** Extensions treated as HTML. */
const HTML_FORMATS = ['html', 'htm', 'xhtml'] as const

/** Lowercased extension of a file name, without the dot. */
function extensionOf(name: string): string {
  const dot = name.lastIndexOf('.')
  return dot < 0 ? '' : name.slice(dot + 1).toLowerCase()
}

/**
 * Whether bytes look like text rather than a binary container.
 *
 * A NUL byte in the first few KB is the reliable tell: real text files do not
 * contain one, and every binary container this package might be handed (ZIP,
 * PDF, images) does. Prevents a mislabeled `.txt` from indexing mojibake.
 */
function looksTextual(content: Uint8Array): boolean {
  const window = content.subarray(0, Math.min(content.length, 4096))
  return !window.includes(0)
}

/** Decode as UTF-8, tolerating a BOM. */
function decode(content: Uint8Array): string {
  return new TextDecoder('utf-8').decode(content).replace(/^﻿/, '')
}

/**
 * Split text into regions labeled by their nearest preceding Markdown heading,
 * so a passage cites `§ Introdução` instead of an anonymous offset.
 */
function headingRegions(text: string): KnowledgeRegion[] {
  const regions: KnowledgeRegion[] = []
  const heading = /^#{1,6}[ \t]+(.+)$/gm
  let match = heading.exec(text)
  while (match !== null) {
    const start = match.index
    const next = heading.exec(text)
    regions.push({
      start,
      end: next === null ? text.length : next.index,
      locator: `§ ${(match[1] ?? '').trim()}`,
    })
    match = next
  }
  return regions
}

/** Plain-text and Markdown extractor. */
export const textExtractor: KnowledgeExtractor = {
  id: 'text',
  formats: [...TEXT_FORMATS, ...MARKDOWN_FORMATS],
  canExtract(content, name) {
    const extension = extensionOf(name)
    const known = (TEXT_FORMATS as readonly string[]).includes(extension)
      || (MARKDOWN_FORMATS as readonly string[]).includes(extension)
    // An unknown extension still extracts when the bytes are clearly textual:
    // refusing would leave ordinary notes unindexed over a naming detail.
    return (known || extension === '') && looksTextual(content)
  },
  extract(content) {
    const text = decode(content)
    const regions = headingRegions(text)
    return Promise.resolve({ text, ...regions.length > 0 ? { regions } : {} } satisfies KnowledgeExtraction)
  },
}

/** Elements whose contents are markup machinery, never readable prose. */
const NON_CONTENT = /<(script|style|template|noscript)\b[^>]*>[\s\S]*?<\/\1>/gi

/** Minimal HTML entity set; numeric references are handled generically. */
const ENTITIES: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
}

/** Decode HTML entities in already-stripped text. */
function decodeEntities(text: string): string {
  return text.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (whole, body: string) => {
    if (body.startsWith('#')) {
      const codePoint = body[1]?.toLowerCase() === 'x'
        ? Number.parseInt(body.slice(2), 16)
        : Number.parseInt(body.slice(1), 10)
      return Number.isFinite(codePoint) && codePoint > 0 ? String.fromCodePoint(codePoint) : whole
    }
    return ENTITIES[body.toLowerCase()] ?? whole
  })
}

/** HTML extractor producing readable text, not a DOM. */
export const htmlExtractor: KnowledgeExtractor = {
  id: 'html',
  formats: [...HTML_FORMATS],
  canExtract(content, name) {
    if ((HTML_FORMATS as readonly string[]).includes(extensionOf(name))) return looksTextual(content)
    if (!looksTextual(content)) return false
    const head = decode(content.subarray(0, 1024)).toLowerCase()
    return head.includes('<!doctype html') || head.includes('<html')
  },
  extract(content) {
    const raw = decode(content)
    const text = decodeEntities(
      raw
        .replace(NON_CONTENT, ' ')
        .replace(/<!--[\s\S]*?-->/g, ' ')
        // Block-level ends become newlines so paragraphs survive as paragraphs.
        .replace(/<\/(p|div|section|article|li|tr|h[1-6]|blockquote)\s*>/gi, '\n\n')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<[^>]+>/g, ' '),
    )
      .replace(/[ \t ]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
    return Promise.resolve({ text } satisfies KnowledgeExtraction)
  },
}

/** Local ZIP file header signature. */
const ZIP_LOCAL_HEADER = 0x04034b50

/**
 * Read one named entry out of a ZIP container.
 *
 * Walks local file headers rather than the central directory: the entry needed
 * here (`word/document.xml`) always appears as a local record, and skipping the
 * directory keeps this to the few dozen lines that justify avoiding a ZIP
 * dependency.
 * @param zip - the container bytes.
 * @param wanted - the entry path to extract.
 * @returns The entry's uncompressed bytes, or `undefined` when absent.
 */
function readZipEntry(zip: Uint8Array, wanted: string): Uint8Array | undefined {
  const view = new DataView(zip.buffer, zip.byteOffset, zip.byteLength)
  let offset = 0
  while (offset + 30 <= zip.length) {
    if (view.getUint32(offset, true) !== ZIP_LOCAL_HEADER) break
    const method = view.getUint16(offset + 8, true)
    const compressedSize = view.getUint32(offset + 18, true)
    const nameLength = view.getUint16(offset + 26, true)
    const extraLength = view.getUint16(offset + 28, true)
    const nameStart = offset + 30
    const name = new TextDecoder().decode(zip.subarray(nameStart, nameStart + nameLength))
    const dataStart = nameStart + nameLength + extraLength
    if (name === wanted) {
      const body = zip.subarray(dataStart, dataStart + compressedSize)
      // 0 = stored, 8 = deflate; DOCX writers use these two.
      if (method === 0) return body
      if (method === 8) return inflateRawSync(body)
      return undefined
    }
    // A streamed entry (sizes in a trailing descriptor) cannot be skipped by
    // arithmetic; stop rather than misread the next header.
    if (compressedSize === 0 && (view.getUint16(offset + 6, true) & 0x08) !== 0) break
    offset = dataStart + compressedSize
  }
  return undefined
}

/** DOCX extractor: ZIP container plus WordprocessingML, no library. */
export const docxExtractor: KnowledgeExtractor = {
  id: 'docx',
  formats: ['docx'],
  canExtract(content, name) {
    if (content.length < 4) return false
    // Every DOCX is a ZIP: 'PK\x03\x04'.
    const isZip = content[0] === 0x50 && content[1] === 0x4B && content[2] === 0x03 && content[3] === 0x04
    if (!isZip) return false
    return extensionOf(name) === 'docx' || readZipEntry(content, 'word/document.xml') !== undefined
  },
  extract(content) {
    const part = readZipEntry(content, 'word/document.xml')
    // Rejected rather than thrown: `extract` is declared to return a Promise,
    // so a synchronous throw would escape a caller that only attaches
    // `.catch()` instead of awaiting inside a try block.
    if (part === undefined) {
      return Promise.reject(new Error('no word/document.xml part in the DOCX container'))
    }
    const xml = new TextDecoder('utf-8').decode(part)
    const text = decodeEntities(
      xml
        // Paragraph and line breaks carry the document's structure.
        .replace(/<w:p\b[^>]*\/>/g, '\n')
        .replace(/<\/w:p>/g, '\n')
        .replace(/<w:br\b[^>]*\/?>/g, '\n')
        .replace(/<w:tab\b[^>]*\/?>/g, '\t')
        .replace(/<[^>]+>/g, ''),
    )
      .replace(/[ \t ]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
    return Promise.resolve({ text } satisfies KnowledgeExtraction)
  },
}

/** Every zero-dependency extractor, in match order. */
export const BUILTIN_EXTRACTORS: readonly KnowledgeExtractor[] = [
  // Binary containers are checked first: their signatures are decisive, while
  // the text extractor deliberately accepts anything that merely looks textual.
  docxExtractor,
  htmlExtractor,
  textExtractor,
]
