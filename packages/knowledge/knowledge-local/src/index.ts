/**
 * Local knowledge store plugin: opens the vault under the harness home and
 * registers it with the knowledge seam.
 * @module @deepseek-ai/dsh-knowledge-local
 */

import { homedir } from 'node:os'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { LocalKnowledgeStore, VAULT_VERSION } from './store.ts'
import { DEFAULT_EMBEDDING_MODEL, TransformersTextEmbedder } from './embedder.ts'

export { LOCAL_STORE_ID, LocalKnowledgeStore, VAULT_VERSION, toMatchExpression } from './store.ts'
export type { LocalKnowledgeStoreOptions } from './store.ts'
export { DEFAULT_EMBEDDING_MODEL, TransformersTextEmbedder } from './embedder.ts'
export type { TextEmbedder } from './embedder.ts'

/** Cordis plugin name. */
export const name = 'knowledge-local'

/** Services required before this plugin can register its store. */
export const inject = ['knowledge']

/** Plugin config. */
export interface LocalKnowledgeConfig {
  /**
   * Vault root. Defaults to `<harness home>/knowledge/<version>`; point it at a
   * Markdown folder's sibling to keep a user's own vault as the origin of
   * record while the index stays disposable.
   */
  readonly root?: string
  /** Enable multilingual local neural retrieval (no hosted API). */
  readonly semantic?: boolean
  /** Hugging Face model id; cached under the portable vault root. */
  readonly model?: string
}

/** Config schema. */
export const Config: z<LocalKnowledgeConfig> = z.object({
  root: z.string(),
  semantic: z.boolean().default(true),
  model: z.string().default(DEFAULT_EMBEDDING_MODEL),
})

/** Resolve the default vault root from the harness home. */
function defaultRoot(): string {
  const home = process.env.DSH_HOME ?? process.env.CURUPIRA_HOME ?? join(homedir(), '.dsh')
  return join(home, 'knowledge', VAULT_VERSION)
}

/**
 * Open the local vault and register it as the knowledge store.
 * @param ctx - Cordis context carrying the knowledge service.
 * @param config - optional vault root override.
 * @returns Nothing; the store closes and unregisters with the calling fiber.
 */
export async function apply(ctx: Context, config: LocalKnowledgeConfig = {}): Promise<void> {
  const root = config.root ?? defaultRoot()
  const semantic = config.semantic ?? true
  const embedder = semantic
    ? new TransformersTextEmbedder(config.model ?? DEFAULT_EMBEDDING_MODEL, join(root, 'models'))
    : undefined
  let warned = false
  const store = new LocalKnowledgeStore({
    root,
    Database: DatabaseSync,
    ...(embedder === undefined ? {} : { embedder }),
    onSemanticError: (error) => {
      if (warned) return
      warned = true
      ctx.logger.warn(`Curupira Memória neural index unavailable; using lexical search: ${String(error)}`)
    },
  })
  await store.open()
  ctx.effect(function* () {
    const dispose = ctx.knowledge.registerStore(store)
    yield () => {
      dispose()
      store.close()
    }
  }, 'knowledge-local.apply()')
}
