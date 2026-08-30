/**
 * Code Assist backend client — the wire the official `gemini-cli` speaks when
 * the user logs in with their Google account. Three calls matter here:
 *
 * - `loadCodeAssist` reports the caller's tier and, when already onboarded, the
 *   managed `cloudaicompanionProject` id the requests must carry.
 * - `onboardUser` provisions that project for first-time (free-tier) accounts
 *   as a long-running operation the client polls until done.
 * - `streamGenerateContent` runs one generation; the standard Gemini
 *   `GenerateContentRequest` travels inside a `{model, project, request}`
 *   envelope and the SSE frames nest the response under `response`.
 *
 * @module dsh-llm-gemini/codeassist
 */

import { randomUUID } from 'node:crypto'
import { LlmError } from '@deepseek-ai/dsh-llm'

/** Code Assist private backend used by the official CLI for Google logins. */
export const CODE_ASSIST_ENDPOINT = 'https://cloudcode-pa.googleapis.com'
/** The API version the Code Assist surface speaks. */
export const CODE_ASSIST_API_VERSION = 'v1internal'

/** Client metadata every Code Assist call carries. */
function clientMetadata(): Record<string, string> {
  return {
    ideType: 'IDE_UNSPECIFIED',
    platform: 'PLATFORM_UNSPECIFIED',
    pluginType: 'GEMINI',
  }
}

function methodUrl(method: string): string {
  return `${CODE_ASSIST_ENDPOINT}/${CODE_ASSIST_API_VERSION}:${method}`
}

async function parseError(response: Response): Promise<never> {
  const text = await response.text().catch(() => '')
  throw new LlmError(
    `Gemini Code Assist request failed (status ${response.status}): ${text}`,
    response.status === 401 || response.status === 403 ? 'AUTH' : 'PROVIDER',
    { status: response.status },
  )
}

/** POST one Code Assist method and parse the JSON answer. */
async function callMethod<T>(
  method: string,
  body: unknown,
  token: string,
  signal: AbortSignal | undefined,
): Promise<T> {
  const response = await fetch(methodUrl(method), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    signal: signal ?? null,
  })
  if (!response.ok) await parseError(response)
  return await response.json() as T
}

interface LoadCodeAssistResponse {
  currentTier?: { id?: string; name?: string }
  paidTier?: { id?: string; name?: string }
  cloudaicompanionProject?: string | { id?: string; name?: string }
  allowedTiers?: readonly { id?: string; isDefault?: boolean }[]
  ineligibleTiers?: readonly unknown[]
}

interface OperationResponse {
  name?: string
  done?: boolean
  response?: { cloudaicompanionProject?: string | { id?: string; name?: string } }
}

/** The many shapes `cloudaicompanionProject` arrives in across the surface. */
type ProjectRef = string | { id?: string; name?: string } | undefined | null

/** Normalize the many shapes `cloudaicompanionProject` arrives in. */
function projectOf(value: ProjectRef): string | undefined {
  if (value === undefined || value === null) return undefined
  if (typeof value === 'string') return value === '' ? undefined : value
  return value.id ?? value.name
}

/**
 * Resolve the Code Assist project id for a signed-in account, onboarding a
 * first-time (free-tier) account through the long-running operation when the
 * load call reports none. Mirrors the official CLI's `setupUser` flow.
 * @param token - a fresh OAuth access token with the `cloud-platform` scope.
 * @param signal - cancellation for the network round-trips.
 * @returns the `cloudaicompanionProject` id every generation request carries.
 */
export async function resolveCodeAssistProject(
  token: string,
  signal: AbortSignal | undefined,
): Promise<string> {
  const metadata = clientMetadata()
  const load = await callMethod<LoadCodeAssistResponse>('loadCodeAssist', {
    metadata,
  }, token, signal)

  const direct = projectOf(load.cloudaicompanionProject)
  if (direct !== undefined) return direct

  // Pick the default tier the account is allowed to onboard onto (the free
  // tier is the default for personal accounts), defaulting to legacy.
  const tierId = load.allowedTiers?.find(tier => tier.isDefault === true)?.id
    ?? load.currentTier?.id
    ?? 'legacy-tier'

  // The free tier uses a managed Google Cloud project: sending one is a
  // Precondition Failed, exactly as the CLI documents.
  const operation = await callMethod<OperationResponse>('onboardUser', {
    tierId,
    cloudaicompanionProject: undefined,
    metadata,
  }, token, signal)

  let pending = operation
  while (pending.done !== true && pending.name !== undefined) {
    await new Promise(resolve => setTimeout(resolve, 2_000))
    if (signal?.aborted) {
      throw new LlmError('llm-gemini: Code Assist onboarding aborted', 'ABORTED')
    }
    const polled = await fetch(`${CODE_ASSIST_ENDPOINT}/${CODE_ASSIST_API_VERSION}/${pending.name}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: signal ?? null,
    })
    if (!polled.ok) await parseError(polled)
    pending = await polled.json() as OperationResponse
  }

  const onboarded = projectOf(pending.response?.cloudaicompanionProject)
  if (onboarded === undefined) {
    throw new LlmError(
      'llm-gemini: Code Assist onboarding finished without a project id; this Google account'
      + ' may not be eligible for the Gemini free tier.',
      'AUTH',
    )
  }
  return onboarded
}

/**
 * The payload one streaming generation posts: the standard Gemini request
 * wrapped in the Code Assist envelope. `user_prompt_id` is an opaque
 * per-request correlation id, mirroring the CLI.
 */
export function codeAssistEnvelope(
  model: string,
  project: string,
  request: unknown,
): Record<string, unknown> {
  return {
    model,
    project,
    user_prompt_id: randomUUID(),
    request,
  }
}

/** The URL one streaming generation posts to. */
export function codeAssistStreamUrl(): string {
  return `${CODE_ASSIST_ENDPOINT}/${CODE_ASSIST_API_VERSION}:streamGenerateContent?alt=sse`
}
