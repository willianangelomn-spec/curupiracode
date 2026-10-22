/**
 * Admission of extension endpoint requests. The browser fills `Host` from the
 * URL it dials and `Origin` from the calling extension, and neither can be
 * set by page or extension script, so requiring a loopback Host and an exact
 * configured extension Origin keeps web pages, rebound DNS names, and other
 * extensions out before the bearer token is read. The token is the
 * authentication: Host and Origin are browser facts that any non-browser
 * client can forge.
 */

import type { IncomingHttpHeaders } from 'node:http'
import { isLoopbackHost } from '@deepseek-ai/dsh-host-webserver'
import type { PairingStore } from './pairings.ts'

/** Exact Chromium extension origin: the scheme plus the 32-letter `a`–`p` id derived from the manifest key. */
const EXTENSION_ORIGIN_PATTERN = /^chrome-extension:\/\/[a-p]{32}$/
const BEARER_PATTERN = /^Bearer ([^\s]+)$/

/** Outcome of admitting one extension request. */
export type ExtensionAdmission =
  | { readonly origin: string }
  | { readonly rejection: 401 | 403 }

/**
 * Assert one configured `allowedOrigins` entry names a Chromium extension origin exactly.
 * @param entry - the configured value, verbatim.
 */
export function assertExtensionOrigin(entry: string): void {
  if (!EXTENSION_ORIGIN_PATTERN.test(entry)) {
    throw new Error(`host-extension-bridge: allowedOrigins entry ${JSON.stringify(entry)} is not a chrome-extension://<id> origin`)
  }
}

function single(value: string | readonly string[] | undefined): string | undefined {
  return typeof value === 'string' ? value : undefined
}

/**
 * Whether a Host header names this machine's loopback authority.
 * @param host - verbatim Host header value.
 * @returns true for `localhost`, `[::1]`, and any 127/8 address, on any port.
 */
export function isLoopbackAuthority(host: string): boolean {
  let hostname: string
  try {
    hostname = new URL(`http://${host}`).hostname
  } catch {
    // Swallows the URL parse error: an unparsable Host is exactly the non-loopback case.
    return false
  }
  return hostname === 'localhost' || isLoopbackHost(hostname.replace(/^\[(.*)\]$/u, '$1'))
}

/**
 * Admit one extension endpoint request.
 * @param headers - node:http request headers.
 * @param allowedOrigins - validated extension origins of this deployment.
 * @param pairings - current pairings, read synchronously.
 * @returns the paired origin, 403 for a non-loopback Host or a foreign Origin, or 401 for a missing or unpaired token.
 */
export function admitExtensionRequest(
  headers: IncomingHttpHeaders,
  allowedOrigins: ReadonlySet<string>,
  pairings: Pick<PairingStore, 'verify'>,
): ExtensionAdmission {
  const host = single(headers.host)
  const origin = single(headers.origin)
  if (host === undefined || !isLoopbackAuthority(host)) return { rejection: 403 }
  if (origin === undefined || !allowedOrigins.has(origin)) return { rejection: 403 }
  const token = BEARER_PATTERN.exec(single(headers.authorization) ?? '')?.[1]
  if (token === undefined || !pairings.verify(origin, token)) return { rejection: 401 }
  return { origin }
}
