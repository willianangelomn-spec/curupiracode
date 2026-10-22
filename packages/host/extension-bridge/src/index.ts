/**
 * Host bridge between the CurupiraCode browser extension and this server.
 *
 * Two route families live under `/extension-bridge`. The pairing page
 * (`pair`, `revoke`) admits only the signed-in browser through Connection's
 * `admit`, so its Host/Origin fence and SameSite=Strict cookie decide who can
 * approve an extension. The `v1/*` endpoints admit only a loopback Host, an
 * exact configured extension Origin, and the bearer token that origin's
 * pairing issued; they send no CORS headers because extension pages reach
 * loopback through their host permissions.
 * @module @deepseek-ai/dsh-host-extension-bridge
 */

import { randomBytes } from 'node:crypto'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-connection'
import type {} from '@deepseek-ai/dsh-credentials'
import type {} from '@deepseek-ai/dsh-host-webserver'
import { KnowledgeError } from '@deepseek-ai/dsh-knowledge'
import { remoteErrorOf } from '@deepseek-ai/dsh-typert-protocol'
import z from '@deepseek-ai/schemastery'
import { BridgeRequestError, mediaType, readBody, sendError, sendHtml, sendJson } from './http.ts'
import { ExtensionOperations } from './operations.ts'
import { renderPairingPage, renderRefused, renderSignInRequired, type PairingPageModel } from './pairing-page.ts'
import { PairingStore } from './pairings.ts'
import { admitExtensionRequest, assertExtensionOrigin } from './request-trust.ts'

export type * from './types.ts'

/** Stable Cordis plugin name; also the scope of the pairings credential record. */
export const name = 'host-extension-bridge'

/** The route carrier, the browser-session fence, durable pairings, and the Session API. */
export const inject = ['webServer', 'connection', 'credentials', 'typertGateway', 'sessionController']

/** Path prefix owning every bridge route. */
export const EXTENSION_BRIDGE_PATH = '/extension-bridge'
const PAIR_PATH = `${EXTENSION_BRIDGE_PATH}/pair`
const REVOKE_PATH = `${EXTENSION_BRIDGE_PATH}/revoke`
const API_PREFIX = `${EXTENSION_BRIDGE_PATH}/v1/`
/** A pairing form carries one origin field. */
const MAX_FORM_BYTES = 4096

/** Extension bridge deployment configuration. */
export interface ExtensionBridgeConfig {
  /**
   * Exact `chrome-extension://<id>` origins the pairing page offers. An entry
   * that is not such an origin, or an empty list, fails plugin load.
   */
  allowedOrigins: string[]
  /**
   * Agent presets the extension may create Sessions with and keep driving;
   * session-scoped endpoints refuse a Session whose current preset is not
   * listed. An empty list fails plugin load.
   */
  agentPresets: string[]
  /** Largest buffered JSON request body. Default 160 MiB: five 20 MiB images as base64 plus prompt text. */
  maxRequestBodyBytes?: number
  /** Largest decoded `knowledge/ingest` document. Default 20 MiB. */
  maxDocumentBytes?: number
  /** Longest extracted document text returned for prompt use. Default 120000 characters. */
  maxDocumentTextChars?: number
  /** Most messages `sessions/messages` returns. Default 100. */
  maxHistoryMessages?: number
}

type ResolvedConfig = Required<ExtensionBridgeConfig>

export const Config: z<ExtensionBridgeConfig, ResolvedConfig> = z.object({
  allowedOrigins: z.array(String).required(),
  agentPresets: z.array(String).required(),
  maxRequestBodyBytes: z.natural().min(1).default(160 * 1024 * 1024),
  maxDocumentBytes: z.natural().min(1).default(20 * 1024 * 1024),
  maxDocumentTextChars: z.natural().min(1).default(120_000),
  maxHistoryMessages: z.natural().min(1).default(100),
})

/** Map a failed operation to the response the extension receives. */
function toRequestError(ctx: Context, error: unknown, signal: AbortSignal): BridgeRequestError {
  if (error instanceof BridgeRequestError) return error
  if (signal.aborted) return new BridgeRequestError(503, 'extension-bridge/cancelled', 'the request was cancelled')
  const remote = remoteErrorOf(error)
  if (remote !== undefined) return new BridgeRequestError(422, remote.code, remote.message)
  if (error instanceof KnowledgeError) return new BridgeRequestError(422, error.code, error.message)
  ctx.logger.error(error)
  return new BridgeRequestError(500, 'extension-bridge/internal', 'the extension bridge failed; see the CurupiraCode log')
}

/** Mount the pairing page and the extension endpoints on the Web server. */
export async function apply(ctx: Context, config: ResolvedConfig): Promise<void> {
  if (config.allowedOrigins.length === 0) throw new Error('host-extension-bridge: allowedOrigins must name at least one extension origin')
  if (config.agentPresets.length === 0) throw new Error('host-extension-bridge: agentPresets must name at least one preset')
  for (const origin of config.allowedOrigins) assertExtensionOrigin(origin)
  const allowedOrigins = new Set(config.allowedOrigins)
  const pairings = await PairingStore.create(ctx, ctx.credentials)
  const operations = new ExtensionOperations(
    ctx,
    ctx.connection.createPeer({ principal: { kind: 'owner' }, interactions: 'none' }),
    new Set(config.agentPresets),
    config,
  )
  const lifetime = new AbortController()
  const inFlight = new Set<Promise<void>>()

  const pageModel = (extra: Pick<PairingPageModel, 'issued' | 'revoked'> = {}): PairingPageModel => ({
    origins: config.allowedOrigins.map(origin => ({ origin, pairing: pairings.get(origin) })),
    agentPresets: config.agentPresets,
    knowledge: operations.status().knowledge,
    ...extra,
  })

  const handlePairing = async (req: IncomingMessage, res: ServerResponse, path: string): Promise<void> => {
    const nonce = randomBytes(16).toString('base64')
    const admission = ctx.connection.admit(req)
    if ('rejection' in admission && admission.rejection === 403) {
      req.resume()
      sendHtml(res, 403, renderRefused(nonce), nonce)
      return
    }
    if ('rejection' in admission || admission.peer !== ctx.connection.browserPeer) {
      req.resume()
      sendHtml(res, 401, renderSignInRequired(nonce), nonce)
      return
    }
    if (path === PAIR_PATH && req.method === 'GET') {
      sendHtml(res, 200, renderPairingPage(pageModel(), nonce), nonce)
      return
    }
    if (req.method !== 'POST') {
      req.resume()
      res.writeHead(405, { allow: path === PAIR_PATH ? 'GET, POST' : 'POST' })
      res.end()
      return
    }
    if (mediaType(req) !== 'application/x-www-form-urlencoded') {
      throw new BridgeRequestError(415, 'extension-bridge/unsupported-media-type', 'pairing forms must be application/x-www-form-urlencoded')
    }
    const origins = new URLSearchParams(await readBody(req, MAX_FORM_BYTES)).getAll('origin')
    const origin = origins[0]
    if (origins.length !== 1 || origin === undefined || !allowedOrigins.has(origin)) {
      throw new BridgeRequestError(400, 'extension-bridge/bad-request', 'the form must name exactly one allowed extension origin')
    }
    if (path === PAIR_PATH) {
      const token = await pairings.pair(origin)
      sendHtml(res, 200, renderPairingPage(pageModel({ issued: { origin, token } }), nonce), nonce)
      return
    }
    await pairings.revoke(origin)
    sendHtml(res, 200, renderPairingPage(pageModel({ revoked: origin }), nonce), nonce)
  }

  const handleApi = async (req: IncomingMessage, res: ServerResponse, endpoint: string, signal: AbortSignal): Promise<void> => {
    const admission = admitExtensionRequest(req.headers, allowedOrigins, pairings)
    if ('rejection' in admission) {
      throw admission.rejection === 401
        ? new BridgeRequestError(401, 'extension-bridge/unauthorized', 'pair the extension from the CurupiraCode pairing page')
        : new BridgeRequestError(403, 'extension-bridge/forbidden', 'only the paired extension may call this endpoint over loopback')
    }
    if (req.method !== 'POST') {
      res.setHeader('allow', 'POST')
      throw new BridgeRequestError(405, 'extension-bridge/method-not-allowed', 'extension endpoints accept POST only')
    }
    if (mediaType(req) !== 'application/json') {
      throw new BridgeRequestError(415, 'extension-bridge/unsupported-media-type', 'extension endpoints accept application/json only')
    }
    let body: unknown
    try {
      body = JSON.parse(await readBody(req, config.maxRequestBodyBytes))
    } catch (error) {
      if (error instanceof BridgeRequestError) throw error
      throw new BridgeRequestError(400, 'extension-bridge/bad-request', 'the request body is not JSON')
    }
    sendJson(res, 200, await operations.dispatch(endpoint, body, signal))
  }

  const handle = async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    const request = new AbortController()
    res.once('close', () => { if (!res.writableFinished) request.abort() })
    const signal = AbortSignal.any([lifetime.signal, request.signal])
    /* v8 ignore next -- node:http always supplies url on server requests. */
    const path = new URL(req.url ?? '/', 'http://extension-bridge.invalid').pathname
    try {
      if (path === PAIR_PATH || path === REVOKE_PATH) await handlePairing(req, res, path)
      else if (path.startsWith(API_PREFIX)) await handleApi(req, res, path.slice(API_PREFIX.length), signal)
      else throw new BridgeRequestError(404, 'extension-bridge/not-found', 'unknown extension bridge path')
    } catch (error) {
      // Every response is written in one call after its value is complete, so a failure precedes the headers.
      req.resume()
      sendError(res, toRequestError(ctx, error, signal))
    }
  }

  // Registered before the route: reverse-order teardown removes the route, then cancels and awaits admitted requests.
  ctx.effect(() => async () => {
    lifetime.abort()
    await Promise.allSettled([...inFlight])
  }, 'host-extension-bridge: in-flight requests')
  ctx.effect(() => ctx.webServer.register({
    kind: 'prefix',
    path: EXTENSION_BRIDGE_PATH,
    handler: (req, res) => {
      const task = handle(req, res)
      inFlight.add(task)
      return task.finally(() => { inFlight.delete(task) })
    },
  }), 'host-extension-bridge: /extension-bridge routes')
}
