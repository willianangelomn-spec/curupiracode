/**
 * Google-account-OAuth Gemini adapter plugin. One provider route (`gemini`),
 * authenticated through a Google sign-in flow whose OAuth grant lands in the
 * harness credential seam — no API key required. The route registers live on
 * mount (the credential, not the route, is what must be signed in first), and
 * the Models page offers it through the configurable-provider directory and model
 * discovery.
 *
 * ```yaml
 * - id: llm-gemini
 *   name: '@deepseek-ai/dsh-llm-gemini'
 * ```
 *
 * @module @deepseek-ai/dsh-llm-gemini
 */

import type { Context } from '@deepseek-ai/cordis'
import { installSettingsSection, settingsNamespace } from '@deepseek-ai/dsh-settings'
import { resolveRetryPolicy } from '@deepseek-ai/dsh-llm'
import type { LlmConfigurableProvider, LlmDiscoveredModel } from '@deepseek-ai/dsh-llm'
import type { AuthorizationSession } from '@deepseek-ai/dsh-authorization'
import { Config } from './config.ts'
import { GeminiAdapter, PROVIDER, PROVIDER_NAME } from './adapter.ts'
import { clientId, clientSecret, recordKey, writeGrant } from './auth.ts'
import { beginGoogleLogin } from './oauth.ts'
import { GEMINI_MODELS } from './models.ts'

export { Config } from './config.ts'
export { GeminiAdapter, PROVIDER, PROVIDER_NAME } from './adapter.ts'
export type { GeminiModelDef, GeminiGrant } from './types.ts'

/** Plugin id; also the settings namespace and the registered provider route. */
export const name = 'llm-gemini'
/** The LLM seam this plugin extends. */
export const inject = ['llm']

/** The user-settings namespace this plugin owns. */
const NS = settingsNamespace('llm-gemini')

/**
 * Register the Gemini adapter, its configuration surface, and its Google
 * sign-in flow. The flow is offered even before a settings section exists,
 * because signing in is what makes the route worth configuring.
 * @param ctx - the plugin context carrying `ctx.llm`, `ctx.credentials`, and `ctx.authorization`.
 * @param config - resolved retry policy and deterministic image request bounds.
 */
export function apply(ctx: Context, config: Config): void {
  const retryPolicy = resolveRetryPolicy(config.retryPolicy ?? undefined, 'llm-gemini retryPolicy')
  const adapter = new GeminiAdapter({
    ctx,
    retryPolicy,
    resolveAttachments: () => ctx.get('attachments'),
    imagePolicy: {
      maxPixels: config.requestImagePixelBudget,
      maxBytes: config.requestImageMaxBytes,
    },
    maxRequestImageBytes: config.maxRequestImageBytes,
  })

  // One adapter instance owns the single `gemini` route.
  ctx.llm.registerAdapter([PROVIDER], adapter)

  // Configurable-provider directory entry so the Models page can show and edit it.
  const directoryEntry: LlmConfigurableProvider = {
    provider: PROVIDER,
    displayName: PROVIDER_NAME,
    settingsNs: NS,
    settingsPath: [],
    declared: false,
  }
  ctx.llm.registerConfigurableProviders([directoryEntry])

  // Interrogate the Gemini endpoint for its models (the curated catalog here).
  ctx.llm.registerModelDiscovery(NS, (): Promise<readonly LlmDiscoveredModel[]> => Promise.resolve(
    GEMINI_MODELS.map(model => ({
      id: model.id,
      name: model.name,
      contextWindow: model.contextWindow,
    }))))

  // User-settings document for retry and deterministic image request bounds.
  installSettingsSection(ctx, NS, Config, config, {
    setSource: () => {},
    onChange: () => {},
  })

  // Google sign-in flow. Scoped to the authorization seam: a composition without
  // it (headless, ACP) simply offers no way to sign in, while everything else
  // this plugin does still works.
  ctx.inject(['authorization'], (authorized) => {
    authorized.authorization.registerFlow({
      key: recordKey,
      label: PROVIDER_NAME,
      methods: [{ id: 'oauth', label: 'Sign in with Google' }],
      async run(session: AuthorizationSession) {
        const grant = await beginGoogleLogin({
          clientId: clientId(),
          clientSecret: clientSecret(),
          signal: session.signal,
          onUrl: (url) => {
            session.notify({
              message: 'Continue signing in to Google Gemini in your browser.',
              url,
            })
          },
        })
        await writeGrant(ctx, grant)
      },
    })
  })
}
