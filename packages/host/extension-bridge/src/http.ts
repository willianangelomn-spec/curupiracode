/** node:http request-body and response helpers for the bridge routes. */

import type { IncomingMessage, ServerResponse } from 'node:http'
import type { ExtensionBridgeErrorBody } from './types.ts'

/** Typed refusal carrying the HTTP status and stable code of one bridge response. */
export class BridgeRequestError extends Error {
  /**
   * @param status - HTTP status sent to the caller.
   * @param code - stable failure code.
   * @param message - human diagnostic.
   */
  constructor(readonly status: number, readonly code: string, message: string) {
    super(message)
  }
}

/**
 * Lowercased media type of a request without parameters.
 * @param req - incoming request.
 * @returns the media type, or undefined when absent.
 */
export function mediaType(req: IncomingMessage): string | undefined {
  return req.headers['content-type']?.split(';', 1)[0]?.trim().toLowerCase()
}

/**
 * Buffer a request body up to a byte limit.
 * @param req - incoming request whose body is unread.
 * @param maxBytes - largest accepted body.
 * @returns the body text decoded as UTF-8.
 * @throws {@link BridgeRequestError} 413 once the body exceeds the limit; the rest is drained so the refusal stays readable.
 */
export async function readBody(req: IncomingMessage, maxBytes: number): Promise<string> {
  const declared = Number(req.headers['content-length'])
  if (Number.isFinite(declared) && declared > maxBytes) {
    req.resume()
    throw new BridgeRequestError(413, 'extension-bridge/body-too-large', `request body exceeds ${String(maxBytes)} bytes`)
  }
  const chunks: Buffer[] = []
  let size = 0
  // node:http yields Buffer chunks when no encoding is set.
  for await (const chunk of req as AsyncIterable<Buffer>) {
    size += chunk.byteLength
    if (size > maxBytes) {
      req.resume()
      throw new BridgeRequestError(413, 'extension-bridge/body-too-large', `request body exceeds ${String(maxBytes)} bytes`)
    }
    chunks.push(chunk)
  }
  return Buffer.concat(chunks, size).toString('utf8')
}

/**
 * Send a JSON response that no cache keeps.
 * @param res - response owned by the caller.
 * @param status - HTTP status.
 * @param value - JSON-serializable body.
 */
export function sendJson(res: ServerResponse, status: number, value: unknown): void {
  const body = JSON.stringify(value)
  res.writeHead(status, {
    'cache-control': 'no-store',
    'content-type': 'application/json; charset=utf-8',
  })
  res.end(body)
}

/**
 * Send one refusal in the bridge error body.
 * @param res - response owned by the caller.
 * @param error - refusal to report.
 */
export function sendError(res: ServerResponse, error: BridgeRequestError): void {
  const body: ExtensionBridgeErrorBody = { error: { code: error.code, message: error.message } }
  if (error.status === 401) res.setHeader('www-authenticate', 'Bearer realm="curupiracode-extension"')
  sendJson(res, error.status, body)
}

/**
 * Send one HTML page with the headers every pairing page needs: no caching for
 * a page that may show a token, no framing, and only the nonced inline style
 * and same-origin form posts. The referrer policy is `same-origin` because
 * under `no-referrer` the browser sends `Origin: null` with the page's own form
 * posts, which Connection's Origin fence refuses.
 * @param res - response owned by the caller.
 * @param status - HTTP status.
 * @param html - complete document.
 * @param nonce - the style nonce the document uses.
 */
export function sendHtml(res: ServerResponse, status: number, html: string, nonce: string): void {
  res.writeHead(status, {
    'cache-control': 'no-store',
    'content-security-policy': `default-src 'none'; style-src 'nonce-${nonce}'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'`,
    'content-type': 'text/html; charset=utf-8',
    'referrer-policy': 'same-origin',
    'x-content-type-options': 'nosniff',
    'x-frame-options': 'DENY',
  })
  res.end(html)
}
