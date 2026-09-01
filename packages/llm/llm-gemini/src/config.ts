/**
 * Configuration schema for the Gemini adapter. The route is fixed (`gemini`);
 * configuration owns image request bounds and the provider request retry
 * policy. The credential plane owns the Google sign-in, so nothing secret
 * lives here.
 *
 * @module dsh-llm-gemini/config
 */

import z from '@deepseek-ai/schemastery'
import { RetryPolicySchema } from '@deepseek-ai/dsh-llm'
import type { RetryPolicyConfig } from '@deepseek-ai/dsh-llm'

/** Default total-pixel budget preserves a normalized 2048px square attachment. */
export const DEFAULT_REQUEST_IMAGE_PIXEL_BUDGET = 2048 * 2048
/** Default raw encoded-byte cap for one deterministic Gemini request image. */
export const DEFAULT_REQUEST_IMAGE_MAX_BYTES = 4 * 1024 * 1024
/** Default accumulated inline-base64 image payload for one Gemini request. */
export const DEFAULT_MAX_REQUEST_IMAGE_BYTES = 20 * 1024 * 1024

/**
 * Plugin configuration: the Gemini adapter owns a single route and reads its
 * sign-in from the credential seam.
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
}

/** Runtime schema for {@link Config}. */
export const Config: z<Config> = z.object({
  requestImagePixelBudget: z.number().step(1).min(1).default(DEFAULT_REQUEST_IMAGE_PIXEL_BUDGET),
  requestImageMaxBytes: z.number().step(1).min(1).default(DEFAULT_REQUEST_IMAGE_MAX_BYTES),
  maxRequestImageBytes: z.number().step(1).min(1).default(DEFAULT_MAX_REQUEST_IMAGE_BYTES),
  retryPolicy: z.union([RetryPolicySchema, z.const(null)]).default(null),
})
