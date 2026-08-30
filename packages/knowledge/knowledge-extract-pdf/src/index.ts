/**
 * PDF knowledge extractor plugin.
 *
 * PDF is the one format in the default set that no amount of `node:` builtins
 * can read honestly: text lives in content streams with font-specific encodings
 * and no reading order, so a hand-rolled parser produces plausible-looking
 * garbage. `pdfjs-dist` (Mozilla's, the engine behind Firefox's viewer) is
 * bundled into the build — the person installing still installs nothing extra;
 * the weight is paid once, here, and isolated to this package so an install
 * that does not want it can drop the plugin.
 * @module @deepseek-ai/dsh-knowledge-extract-pdf
 */

import { Context } from '@deepseek-ai/cordis'
import type { KnowledgeExtraction, KnowledgeExtractor, KnowledgeRegion } from '@deepseek-ai/dsh-knowledge'

/** Stable id this extractor registers under. */
export const PDF_EXTRACTOR_ID = 'pdf'

/** Cordis plugin name. */
export const name = 'knowledge-extract-pdf'

/** Services required before this plugin can register its extractor. */
export const inject = ['knowledge']

/** A PDF always begins with `%PDF-`. */
function isPdf(content: Uint8Array): boolean {
  return content.length > 4
    && content[0] === 0x25 && content[1] === 0x50 && content[2] === 0x44 && content[3] === 0x46
}

/** Minimal shape used from pdfjs, kept local so the seam has no pdfjs types. */
interface PdfTextItem { readonly str?: string; readonly hasEOL?: boolean }

/**
 * The PDF extractor. Pages become labeled regions so a retrieved passage can
 * cite `p. 7` — the locator a reader can actually check.
 */
export const pdfExtractor: KnowledgeExtractor = {
  id: PDF_EXTRACTOR_ID,
  formats: ['pdf'],
  canExtract(content) {
    return isPdf(content)
  },
  async extract(content, signal): Promise<KnowledgeExtraction> {
    // Imported lazily so an install that never opens a PDF never pays the
    // module's startup cost.
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
    const task = pdfjs.getDocument({
      data: content,
      // The extractor wants text, not rendering: skip the optional assets a
      // headless run cannot use anyway.
      disableFontFace: true,
      useSystemFonts: false,
      isEvalSupported: false,
    })
    const document = await task.promise
    try {
      const parts: string[] = []
      const regions: KnowledgeRegion[] = []
      let offset = 0
      for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber++) {
        if (signal?.aborted) throw new Error('aborted')
        const page = await document.getPage(pageNumber)
        const content_ = await page.getTextContent()
        const pageText = (content_.items as PdfTextItem[])
          .map(item => (item.str ?? '') + (item.hasEOL === true ? '\n' : ''))
          .join('')
          .replace(/[ \t]+/g, ' ')
          .replace(/\n{3,}/g, '\n\n')
          .trim()
        page.cleanup()
        if (pageText.length === 0) continue
        const start = offset
        parts.push(pageText)
        offset += pageText.length + 2
        regions.push({ start, end: start + pageText.length, locator: `p. ${pageNumber}` })
      }
      return { text: parts.join('\n\n'), ...regions.length > 0 ? { regions } : {} }
    } finally {
      await document.destroy()
    }
  },
}

/**
 * Register the PDF extractor with the knowledge seam.
 * @param ctx - Cordis context carrying the knowledge service.
 * @returns Nothing; the extractor unregisters with the calling fiber.
 */
export function apply(ctx: Context): void {
  ctx.knowledge.registerExtractor(pdfExtractor)
}
