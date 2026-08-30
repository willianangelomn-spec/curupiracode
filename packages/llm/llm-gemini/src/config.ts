/**
 * Configuration schema for the Gemini adapter. The route is fixed (`gemini`);
 * configuration today owns only the provider request retry policy. The
 * credential plane owns the Google sign-in, so nothing secret lives here.
 *
 * @module dsh-llm-gemini/config
 */

import z from '@deepseek-ai/schemastery'
import { RetryPolicySchema } from '@deepseek-ai/dsh-llm'
import type { RetryPolicyConfig } from '@deepseek-ai/dsh-llm'

/**
 * Plugin configuration: the Gemini adapter owns a single route and reads its
 * sign-in from the credential seam, so the only configurable knob is the
 * provider-owned retry policy.
 */
export interface Config {
  /** Provider-owned model-request retry policy; omission uses normal mode with five retries. */
  retryPolicy: RetryPolicyConfig | null
}

/** Runtime schema for {@link Config}. */
export const Config: z<Config> = z.object({
  retryPolicy: z.union([RetryPolicySchema, z.const(null)]).default(null),
})
