/**
 * Browser entry: Google sign-in for the Antigravity CLI inside the Models
 * page's Gemini provider card. The plugin mounts its own generated Remote and
 * fills the keyed `settings.models.provider-card` slot for the Gemini adapter
 * row, so the card offers sign-in only where the Gemini route lives.
 */
import type { Context } from '@deepseek-ai/cordis'
import remote from '@deepseek-ai/dsh-client-ui-gemini-sign-in/remote'
import type {} from '@deepseek-ai/dsh-client-ui-gemini-sign-in/remote'
import type {} from '@deepseek-ai/dsh-api-remotes/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings-models/client'
import { GeminiSignIn, type GeminiSignInInjected } from './GeminiSignIn.tsx'
import { en, NS, zh } from './locales.ts'

export { AGY_INSTALL_COMMAND, GeminiSignIn } from './GeminiSignIn.tsx'
export type { GeminiSignInInjected, GeminiSignInProps } from './GeminiSignIn.tsx'
export type { GeminiSignInKey } from './locales.ts'
export type { GeminiSignInStatus } from '../types.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap { geminiSignIn: import('./locales.ts').GeminiSignInKey }
}

/**
 * Settings namespace of the shipped Gemini adapter row (`llm-gemini` in the
 * base bundle); the Models page keys each provider card by its row's namespace.
 */
export const GEMINI_SETTINGS_NS = 'llm-gemini'

/** Required services: the Remote mount, the slot registry, and the locale runtime. */
export const inject = ['remote', 'slots', 'locale']

/**
 * Mount the sign-in Remote, then the card occupant and its dictionaries.
 * @param ctx - browser plugin context.
 * @returns disposer withdrawing the UI before the Remote.
 */
export async function apply(ctx: Context): Promise<() => Promise<void>> {
  const unmountRemote = await ctx.remote.$mount(remote)
  const ui = ctx.inject(['remote.geminiSignIn', 'slots', 'locale'], (child) => {
    child.effect(() => child.locale.register(NS, { en, zh }), 'ui-gemini-sign-in: dictionaries')
    const injected = (): GeminiSignInInjected => ({
      status: signal => child.remote.geminiSignIn.status(signal),
      begin: () => child.remote.geminiSignIn.begin(),
      complete: code => child.remote.geminiSignIn.complete(code),
      cancel: () => child.remote.geminiSignIn.cancel(),
    })
    child.slots.inject('settings.models.provider-card', () => child.slots.register({
      name: 'settings.models.provider-card', key: GEMINI_SETTINGS_NS, locale: NS, inject: injected,
    }, GeminiSignIn))
  })
  try {
    await ui
  } catch (error) {
    await ui.dispose()
    await unmountRemote()
    throw error
  }
  return async () => {
    await ui.dispose()
    await unmountRemote()
  }
}
