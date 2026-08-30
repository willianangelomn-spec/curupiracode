/**
 * Internal wire and storage types for the Gemini (Google-account-OAuth) adapter.
 *
 * @module dsh-llm-gemini/types
 */

import type { ModelModality } from '@deepseek-ai/dsh-llm'

/** One curated Gemini model the adapter advertises. */
export interface GeminiModelDef {
  /** Gemini model id passed to the API path (`models/<id>:streamGenerateContent`). */
  id: string
  /** Human-readable name for selectors and diagnostics. */
  name: string
  /** Maximum combined request + response context in tokens. */
  contextWindow: number
  /** Accepted request modalities. */
  inputModalities: ModelModality[]
  /** Whether this model performs reasoning (thinking) the adapter can enable. */
  reasoning: boolean
}

/**
 * Stored OAuth grant for the Gemini (Google) login. Persisted verbatim as a
 * credential `grant` record; the harness credential seam treats it as opaque
 * JSON, which is what lets this adapter own the token format (and its refresh
 * fields) without the seam knowing Google's shape.
 */
export interface GeminiGrant {
  /** OAuth access token; sent as `Authorization: Bearer` on every request. */
  accessToken: string
  /** OAuth refresh token; exchanged for a new access token before expiry. */
  refreshToken: string
  /** Epoch milliseconds at which {@link accessToken} expires. */
  expiresAt: number
  /** Granted scope string, for diagnostics. */
  scope: string
  /** OAuth client id used for the authorization and every refresh. */
  clientId: string
  /**
   * Code Assist project id this account is onboarded to (`cloudaicompanionProject`).
   * Resolved once after the first sign-in and cached here so later requests skip
   * the `loadCodeAssist`/`onboardUser` handshake.
   */
  projectId?: string
}

/** Reasoning effort the harness may request, mapped to a Gemini thinking budget. */
export type GeminiEffort = 'off' | 'low' | 'medium' | 'high'

/** A resolved thinking budget, or undefined when thinking is disabled. */
export type GeminiBudget = number | undefined
