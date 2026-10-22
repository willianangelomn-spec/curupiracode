/**
 * Configuration schema for the Gemini adapter. The route is fixed (`gemini`);
 * configuration owns image request bounds, the provider request retry policy,
 * and extra model ids the local Antigravity CLI accepts. The CLI and the
 * credential plane own the Google sign-in, so nothing secret lives here.
 *
 * @module dsh-llm-gemini/config
 */

import z from '@deepseek-ai/schemastery'
import { RetryPolicySchema } from '@deepseek-ai/dsh-llm'
import type { ModelModality, RetryPolicyConfig } from '@deepseek-ai/dsh-llm'
import type { GeminiModelDef } from './types.ts'

/** Default total-pixel budget preserves a normalized 2048px square attachment. */
export const DEFAULT_REQUEST_IMAGE_PIXEL_BUDGET = 2048 * 2048
/** Default raw encoded-byte cap for one deterministic Gemini request image. */
export const DEFAULT_REQUEST_IMAGE_MAX_BYTES = 4 * 1024 * 1024
/** Default accumulated inline-base64 image payload for one Gemini request. */
export const DEFAULT_MAX_REQUEST_IMAGE_BYTES = 20 * 1024 * 1024
/** Context window assumed for a configured model that states none. */
export const DEFAULT_MODEL_CONTEXT_WINDOW = 1_048_576

/** One model declared in configuration, beside or over the shipped catalog. */
export interface GeminiModelConfig {
  /** Exact id passed to `agy --model` (see `agy models`). */
  id: string
  /** Display name; defaults to the id. */
  name?: string
  /** Combined request and response context in tokens. */
  contextWindow?: number
  /** Whether the model accepts image input. */
  images?: boolean
}

/**
 * Plugin configuration: the Gemini adapter owns a single route and reads its
 * sign-in from the Antigravity CLI or the credential seam.
 */
export interface Config {
  /** Total-pixel budget for each deterministic Gemini request image. */
  requestImagePixelBudget: number
  /** Raw encoded-byte cap for each deterministic Gemini request image. */
  requestImageMaxBytes: number
  /** Maximum accumulated base64 image payload in one Gemini request. */
  maxRequestImageBytes: number
  /** Provider-owned model-request retry policy; omission uses normal mode with five retries. */
  retryPolicy: RetryPolicyConfig | null
  /** Models added to (or replacing entries of) the shipped catalog. */
  models: GeminiModelConfig[]
}

/** Runtime schema for {@link Config}. */
export const Config: z<Config> = z.object({
  requestImagePixelBudget: z.number().step(1).min(1).default(DEFAULT_REQUEST_IMAGE_PIXEL_BUDGET),
  requestImageMaxBytes: z.number().step(1).min(1).default(DEFAULT_REQUEST_IMAGE_MAX_BYTES),
  maxRequestImageBytes: z.number().step(1).min(1).default(DEFAULT_MAX_REQUEST_IMAGE_BYTES),
  retryPolicy: z.union([RetryPolicySchema, z.const(null)]).default(null),
  models: z.array(z.object({
    id: z.string().pattern(/^[A-Za-z0-9][A-Za-z0-9._-]*$/).required(),
    name: z.string(),
    contextWindow: z.number().step(1).min(1),
    images: z.boolean(),
  })).default([]),
})

/**
 * Project configured models into catalog entries.
 * @param models - validated row-config models.
 * @returns catalog entries with defaults applied.
 */
export function configuredModels(models: readonly GeminiModelConfig[]): GeminiModelDef[] {
  return models.map((model) => {
    const inputModalities: ModelModality[] = model.images === true ? ['text', 'image'] : ['text']
    return {
      id: model.id,
      name: model.name ?? model.id,
      contextWindow: model.contextWindow ?? DEFAULT_MODEL_CONTEXT_WINDOW,
      inputModalities,
      reasoning: false,
    }
  })
}
