/**
 * The three adapters between the Google OAuth grant and the harness credential
 * plane. The grant is stored verbatim as an opaque `grant` record under this
 * plugin's scope, so the credential seam never learns Google's token shape and
 * this adapter stays the single writer (and refresher) of it.
 *
 * @module dsh-llm-gemini/auth
 */

import { credentialKey } from '@deepseek-ai/dsh-credentials'
import type { CredentialRecord } from '@deepseek-ai/dsh-credentials'
import type { Context } from '@deepseek-ai/cordis'
import { LlmError } from '@deepseek-ai/dsh-llm'
import { refreshGoogleToken } from './oauth.ts'
import type { GeminiGrant } from './types.ts'

/**
 * The record scope every credential this adapter stores is written under. It is
 * the plugin's registered name, which tells a later reader — a configuration UI
 * or a second adapter — that this plugin owns the format inside the record.
 */
export const RECORD_SCOPE = 'llm-gemini'

/** The credential record this adapter reads and writes. */
export const recordKey = credentialKey(RECORD_SCOPE, 'gemini')

/**
 * Default OAuth client id. This is the installed-app client the official
 * `gemini-cli` ships for the Code Assist "Login with Google" flow; deployments
 * may override it with `GEMINI_OAUTH_CLIENT_ID` to use their own consent screen.
 */
export const DEFAULT_CLIENT_ID = '681255809395-oo8ft2oprdrnp9e3aqf6av3hmdib135j.apps.googleusercontent.com'

/**
 * The matching client secret. The client is an *installed* app, so Google
 * requires the secret on every token exchange even though the flow is
 * PKCE-protected; `gemini-cli` ships the same value in open source, and a
 * deployment may override it with `GEMINI_OAUTH_CLIENT_SECRET`.
 */
export const DEFAULT_CLIENT_SECRET = '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'

/** Resolve the OAuth client id, preferring the deployment override. */
export function clientId(): string {
  return process.env.GEMINI_OAUTH_CLIENT_ID ?? DEFAULT_CLIENT_ID
}

/** Resolve the OAuth client secret, preferring the deployment override. */
export function clientSecret(): string {
  return process.env.GEMINI_OAUTH_CLIENT_SECRET ?? DEFAULT_CLIENT_SECRET
}

/** How long before expiry a stored access token is proactively refreshed. */
const REFRESH_SLACK_MS = 60_000

function credentialsService(ctx: Context): NonNullable<Context['credentials']> {
  const credentials = ctx.get('credentials')
  if (credentials === undefined) {
    throw new LlmError(
      'llm-gemini: this composition mounts no credentials service, so there is nowhere to store the'
      + ' Google sign-in grant; mount dsh-credentials-local to sign in',
      'NO_CREDENTIAL_STORE',
    )
  }
  return credentials
}

/** Read the stored grant, or undefined when the user has not signed in. */
export async function readGrant(ctx: Context): Promise<GeminiGrant | undefined> {
  const credentials = ctx.get('credentials')
  if (credentials === undefined) return undefined
  const record: CredentialRecord | undefined = await credentials.readRecord(recordKey)
  if (record === undefined || record.kind !== 'grant') return undefined
  return record.payload as GeminiGrant
}

/** Persist the grant as an opaque `grant` record. */
export async function writeGrant(ctx: Context, grant: GeminiGrant): Promise<void> {
  await credentialsService(ctx).modifyRecord(recordKey, async () => ({
    kind: 'grant',
    payload: grant,
  }))
}

/** Remove the stored grant. */
export async function clearGrant(ctx: Context): Promise<void> {
  const credentials = ctx.get('credentials')
  if (credentials === undefined) return
  await credentials.deleteRecord(recordKey)
}

/**
 * Resolve a usable access token, refreshing the stored grant when it is missing
 * or about to expire. The refreshed tokens are written back through the same
 * record, so a later request reuses them without another sign-in.
 * @param ctx - the plugin context carrying the optional `ctx.credentials`.
 * @param signal - cancellation for any refresh network request.
 * @returns a non-expired OAuth access token.
 * @throws {LlmError} code `AUTH` when the user has not signed in, or a refresh fails.
 */
export async function ensureAccessToken(ctx: Context, signal?: AbortSignal): Promise<string> {
  const grant = await readGrant(ctx)
  if (grant === undefined) {
    throw new LlmError(
      'llm-gemini: not signed in with Google. Authorize the "Google Gemini" provider from the'
      + ' Models page or the authorization panel before sending a request.',
      'AUTH',
    )
  }
  if (grant.expiresAt - Date.now() > REFRESH_SLACK_MS) return grant.accessToken

  const refreshed = await refreshGoogleToken(grant.clientId, clientSecret(), grant.refreshToken, signal)
  const next: GeminiGrant = {
    ...grant,
    accessToken: refreshed.accessToken,
    expiresAt: refreshed.expiresAt,
  }
  await writeGrant(ctx, next)
  return next.accessToken
}
