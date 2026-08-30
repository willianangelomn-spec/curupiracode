/**
 * Google account OAuth for the Gemini adapter: Authorization Code flow with
 * PKCE and a host-side localhost redirect listener — the same posture the
 * official `gemini-cli` uses, which works for both the CLI and the local web
 * surface (the browser redirects back to a port the host catches). The resulting
 * access/refresh tokens are handed to the credential seam, never surfaced here.
 *
 * @module dsh-llm-gemini/oauth
 */

import { createServer, type Server } from 'node:http'
import { randomBytes } from 'node:crypto'
import { URL, URLSearchParams } from 'node:url'
import type { GeminiGrant } from './types.ts'

/** Google's OAuth endpoints for the Gemini (Generative Language) scope. */
const AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth'
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token'
/**
 * Scopes the official `gemini-cli` requests for "Login with Google". The base
 * `generative-language` scope is NOT registered on the shared client (Google
 * answers it with 403 `restricted_client`), while `cloud-platform` is — the
 * resulting token authorizes the Code Assist backend this adapter talks to.
 */
const SCOPE = [
  'https://www.googleapis.com/auth/cloud-platform',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
].join(' ')

/** Options for one login attempt. */
export interface GoogleLoginOptions {
  /** OAuth client id; callers supply the deployment's configured client. */
  clientId: string
  /**
   * The client's secret. Google requires it on the token exchange for
   * installed-app clients even under PKCE; omitting it fails with
   * `invalid_client` right after the consent screen closes.
   */
  clientSecret: string
  /** Cancellation for the whole attempt (also fires when the human withdraws). */
  signal?: AbortSignal
  /** Report the authorization URL for the human to open. */
  onUrl: (url: string) => void
}

/** Generate a PKCE code verifier and its S256 challenge. */
async function generatePkce(): Promise<{ verifier: string; challenge: string }> {
  const verifier = randomBytes(32).toString('base64url')
  const digest = await crypto.subtle.digest('SHA-256', Buffer.from(verifier))
  const challenge = Buffer.from(digest).toString('base64url')
  return { verifier, challenge }
}

/** A short random base64url state value. */
function randomState(): string {
  return randomBytes(16).toString('base64url')
}

/** Minimal HTML page returned to the browser after a successful sign-in. */
function successHtml(): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Signed in</title>`
    + `<style>body{font-family:system-ui,sans-serif;background:#09090b;color:#fafafa;display:flex;`
    + `min-height:100vh;align-items:center;justify-content:center;margin:0}main{text-align:center;padding:24px}`
    + `h1{font-size:24px;margin:0 0 8px}p{color:#a1a1aa;line-height:1.6}</style></head>`
    + `<body><main><h1>Authentication successful</h1>`
    + `<p>You can close this tab and return to CurupiraCode.</p></main></body></html>`
}

interface TokenResponse {
  access_token: string
  refresh_token?: string
  expires_in: number
  scope?: string
}

async function exchange(
  body: URLSearchParams,
  clientSecret: string,
  signal: AbortSignal | undefined,
): Promise<TokenResponse> {
  // Installed-app clients must present their secret on every token grant,
  // alongside the PKCE verifier.
  body.set('client_secret', clientSecret)
  const response = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
    signal: signal ?? null,
  })
  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(`Gemini OAuth token request failed (status ${response.status}): ${text}`)
  }
  return await response.json() as TokenResponse
}

/**
 * Run one Google sign-in and return the stored grant. Resolves only after the
 * token exchange succeeds; rejects on error, cancellation, or a denied consent.
 * @param options - the client id, cancellation signal, and URL reporter.
 * @returns the access/refresh grant to persist.
 */
export async function beginGoogleLogin(options: GoogleLoginOptions): Promise<GeminiGrant> {
  const { signal, onUrl } = options
  const { verifier, challenge } = await generatePkce()
  const state = randomState()

  const server: Server = createServer()
  const port = await new Promise<number>((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      if (address === null || typeof address === 'string') {
        reject(new Error('Gemini OAuth: localhost listener did not bind a port'))
        return
      }
      resolve(address.port)
    })
  })

  const redirectUri = `http://localhost:${port}`
  const authUrl = new URL(AUTH_ENDPOINT)
  authUrl.searchParams.set('client_id', options.clientId)
  authUrl.searchParams.set('redirect_uri', redirectUri)
  authUrl.searchParams.set('response_type', 'code')
  authUrl.searchParams.set('scope', SCOPE)
  authUrl.searchParams.set('code_challenge', challenge)
  authUrl.searchParams.set('code_challenge_method', 'S256')
  authUrl.searchParams.set('access_type', 'offline')
  authUrl.searchParams.set('prompt', 'consent')
  authUrl.searchParams.set('state', state)

  const abort = (): void => { server.close(() => {}) }
  signal?.addEventListener('abort', abort, { once: true })

  try {
    const code = await new Promise<string>((resolve, reject) => {
      server.on('request', (req, res) => {
        const url = req.url === undefined ? null : new URL(req.url, redirectUri)
        const params = url?.searchParams
        const returnedState = params?.get('state')
        if (params?.has('error')) {
          res.writeHead(400, { 'Content-Type': 'text/plain' })
          res.end('Authorization failed.')
          reject(new Error(`Gemini OAuth: ${params.get('error')}`))
          return
        }
        const returnedCode = params?.get('code')
        if (returnedCode !== null && returnedCode !== undefined && returnedState === state) {
          res.writeHead(200, { 'Content-Type': 'text/html' })
          res.end(successHtml())
          resolve(returnedCode)
          return
        }
        res.writeHead(400, { 'Content-Type': 'text/plain' })
        res.end('Missing code or state.')
        reject(new Error('Gemini OAuth: callback missing code or state'))
      })
      onUrl(authUrl.toString())
    })

    const token = await exchange(new URLSearchParams({
      client_id: options.clientId,
      code,
      code_verifier: verifier,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
    }), options.clientSecret, signal)

    if (token.refresh_token === undefined) {
      throw new Error('Gemini OAuth: no refresh token returned (request offline access again)')
    }
    return {
      accessToken: token.access_token,
      refreshToken: token.refresh_token,
      expiresAt: Date.now() + token.expires_in * 1000,
      scope: token.scope ?? SCOPE,
      clientId: options.clientId,
    }
  } finally {
    signal?.removeEventListener('abort', abort)
    server.close(() => {})
  }
}

/**
 * Exchange a refresh token for a fresh access token.
 * @param clientId - the OAuth client id used at authorization time.
 * @param clientSecret - the matching client secret (required by installed-app clients).
 * @param refreshToken - the stored refresh token.
 * @param signal - cancellation for the network request.
 * @returns the new access token and its expiry.
 */
export async function refreshGoogleToken(
  clientId: string,
  clientSecret: string,
  refreshToken: string,
  signal: AbortSignal | undefined,
): Promise<{ accessToken: string; expiresAt: number }> {
  const token = await exchange(new URLSearchParams({
    client_id: clientId,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  }), clientSecret, signal)
  return {
    accessToken: token.access_token,
    expiresAt: Date.now() + token.expires_in * 1000,
  }
}
