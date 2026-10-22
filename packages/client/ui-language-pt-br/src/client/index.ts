/**
 * Brazilian Portuguese language pack, browser half. It adds `pt-BR` to the
 * locale catalog with English as its fallback and registers one pt-BR
 * dictionary per shipped UI namespace. A namespace whose owning plugin is not
 * mounted simply stays unused; a key absent here falls back to English through
 * the locale runtime's per-key chain.
 */
import type { Context as ClientContext } from '@deepseek-ai/cordis'
// Type-only: pulls the locale plugin's Context merge (ctx.locale).
import type {} from '@deepseek-ai/dsh-client-locale/client'
import { PT_BR_DICTIONARIES } from './dictionaries/index.ts'

export { PT_BR_DICTIONARIES } from './dictionaries/index.ts'

/** BCP 47 tag stored as the locale preference when the user picks this language. */
export const PT_BR_LOCALE = 'pt-BR'

/** Display name written in the represented language. */
export const PT_BR_LABEL = 'Português (Brasil)'

/** Required service: the locale registry. */
export const inject = ['locale']

/**
 * Register pt-BR and its dictionaries for this plugin's lifetime.
 * @param ctx - client root context.
 */
export function apply(ctx: ClientContext): void {
  ctx.effect(
    () => ctx.locale.addLanguage({ id: PT_BR_LOCALE, label: PT_BR_LABEL, fallback: 'en' }),
    'ui-language-pt-br: language',
  )
  for (const [namespace, dictionary] of Object.entries(PT_BR_DICTIONARIES)) {
    ctx.effect(
      () => ctx.locale.register(namespace, PT_BR_LOCALE, dictionary),
      `ui-language-pt-br: ${namespace} dictionary`,
    )
  }
}
