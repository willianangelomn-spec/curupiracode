/**
 * Google Gemini adapter plugin. One provider route (`gemini`), served through
 * the locally installed and signed-in Antigravity CLI, with a Google-account
 * OAuth Code Assist transport as fallback — no API key required. The route
 * registers live on mount (the sign-in, not the route, is what must exist
 * first), and the Models page offers it through the configurable-provider
 * directory and model discovery.
 *
 * ```yaml
 * - id: llm-gemini
 *   name: '@deepseek-ai/dsh-llm-gemini'
 *   config:
 *     # Extra ids the local CLI accepts (see `agy models`).
 *     models:
 *       - id: gemini-4-argon-high
 *         name: Gemini 4 Argon (High)
 *         images: true
 * ```
 *
 * @module @deepseek-ai/dsh-llm-gemini
 */

import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/cordis-plugin-loader'
import type {} from '@deepseek-ai/dsh-fs'
import { resolveImageAttachmentAccess, resolveRetryPolicy } from '@deepseek-ai/dsh-llm'
import type { LlmConfigurableProvider, LlmDiscoveredModel } from '@deepseek-ai/dsh-llm'
import type { AuthorizationSession } from '@deepseek-ai/dsh-authorization'
import { Config, configuredModels } from './config.ts'
import { GeminiAdapter, PROVIDER, PROVIDER_NAME } from './adapter.ts'
import { clientId, clientSecret, recordKey, writeGrant } from './auth.ts'
import { beginGoogleLogin } from './oauth.ts'
import { mergeModels } from './models.ts'

export { Config } from './config.ts'
export type { GeminiModelConfig } from './config.ts'
export { GeminiAdapter, PROVIDER, PROVIDER_NAME } from './adapter.ts'
export { GEMINI_MODELS } from './models.ts'
export { agyBinary } from './agy.ts'
export type { GeminiModelDef, GeminiGrant } from './types.ts'

/** Plugin id; also the settings namespace and the registered provider route. */
export const name = 'llm-gemini'
/** The LLM seam this plugin extends. */
export const inject = ['llm']

/** Settings namespace used when the Loader row carries no id. */
const NS = 'llm-gemini'

/**
 * Register the Gemini adapter, its configuration surface, and its Google
 * sign-in flow. The flow is offered even before a settings section exists,
 * because signing in is what makes the route worth configuring.
 * @param ctx - the plugin context carrying `ctx.llm`, `ctx.credentials`, and `ctx.authorization`.
 * @param config - retry policy, deterministic image request bounds, and configured models.
 */
export function apply(ctx: Context, config: Config): void {
  const settingsNs = ctx.fiber.entry?.options.id ?? NS
  const retryPolicy = resolveRetryPolicy(config.retryPolicy ?? undefined, 'llm-gemini retryPolicy')
  const models = () => mergeModels(configuredModels(config.models.get()))
  const adapter = new GeminiAdapter({
    ctx,
    retryPolicy,
    models,
    resolveAttachments: () => ctx.get('attachments'),
    resolveImageAccess: (attachments, ref) => resolveImageAttachmentAccess(
      attachments, hostPath => ctx.get('fs')?.processPathFromHostPath(hostPath), ref,
    ),
    imageBudget: {
      maxPixels: config.requestImagePixelBudget,
      maxBytes: config.requestImageMaxBytes,
    },
    maxRequestImageBytes: config.maxRequestImageBytes,
  })

  // One adapter instance owns the single `gemini` route.
  ctx.llm.registerAdapter([PROVIDER], adapter)

  // Configurable-provider directory entry so the Models page can show and edit
  // it. The route reads no API key: the Antigravity CLI or a stored Google
  // sign-in authenticates it, so the page offers no key field.
  const directoryEntry: LlmConfigurableProvider = {
    provider: PROVIDER,
    displayName: PROVIDER_NAME,
    settingsNs,
    settingsPath: [],
    declared: false,
    nativeAuth: { env: [], oauth: true },
  }
  ctx.llm.registerConfigurableProviders([directoryEntry])

  // Interrogate the Gemini endpoint for its models (the curated catalog here).
  ctx.llm.registerModelDiscovery(settingsNs, (): Promise<readonly LlmDiscoveredModel[]> => Promise.resolve(
    models().map(model => ({
      id: model.id,
      name: model.name,
      contextWindow: model.contextWindow,
    }))))

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
