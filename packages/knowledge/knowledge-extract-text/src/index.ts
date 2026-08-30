/**
 * Zero-dependency knowledge extractor plugin: plain text, Markdown, HTML, DOCX.
 * @module @deepseek-ai/dsh-knowledge-extract-text
 */

import { Context } from '@deepseek-ai/cordis'
import { BUILTIN_EXTRACTORS } from './extractors.ts'

export {
  BUILTIN_EXTRACTORS,
  docxExtractor,
  htmlExtractor,
  textExtractor,
} from './extractors.ts'

/** Cordis plugin name. */
export const name = 'knowledge-extract-text'

/** Services required before this plugin can register its extractors. */
export const inject = ['knowledge']

/**
 * Register every zero-dependency extractor with the knowledge seam.
 * @param ctx - Cordis context carrying the knowledge service.
 * @returns Nothing; extractors unregister with the calling fiber.
 */
export function apply(ctx: Context): void {
  for (const extractor of BUILTIN_EXTRACTORS) ctx.knowledge.registerExtractor(extractor)
}
