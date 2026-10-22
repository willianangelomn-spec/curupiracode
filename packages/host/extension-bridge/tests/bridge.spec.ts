/**
 * The plugin over a real WebServer and the in-memory credential provider:
 * pairing-page admission, the extension endpoint fence, every endpoint's
 * mapping onto the Session Remote and the knowledge service, failure
 * statuses, and teardown. Connection, the Gateway, and the Session
 * Controller are stubs here; the CLI e2e drives the shipped ones.
 */

import { request as httpRequest, type IncomingHttpHeaders } from 'node:http'
import { Context } from '@deepseek-ai/cordis'
import WebServer from '@deepseek-ai/dsh-host-webserver'
import { KnowledgeError } from '@deepseek-ai/dsh-knowledge'
import type { SessionEvent } from '@deepseek-ai/dsh-session'
import { RemoteError } from '@deepseek-ai/dsh-typert-protocol'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MemoryCredentials } from '../../../credentials/credentials/tests/memory.ts'
import * as Bridge from '../src/index.ts'

const ORIGIN = 'chrome-extension://ndfighammhdpfaejmadojjaaelmpadek'
const OTHER_ORIGIN = 'chrome-extension://aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
const BROWSER_PEER = { id: 'browser-peer' }
const BRIDGE_PEER = { id: 'bridge-peer' }

interface InvokeCall {
  readonly namespace: string
  readonly method: string
  readonly args: { readonly request: Record<string, unknown> }
  readonly peer: object
  readonly signal: AbortSignal
}

interface Response {
  readonly status: number
  readonly headers: IncomingHttpHeaders
  readonly text: string
}

let root: Context | undefined
afterEach(async () => {
  await root?.fiber.dispose()
  root = undefined
})

function send(base: string, path: string, options: {
  readonly method?: string
  readonly headers?: Record<string, string>
  readonly body?: string
  readonly chunks?: readonly string[]
} = {}): Promise<Response> {
  const url = new URL(path, base)
  return new Promise((resolve, reject) => {
    const req = httpRequest({ hostname: url.hostname, port: url.port, path: url.pathname, method: options.method ?? 'POST', headers: options.headers }, (res) => {
      const chunks: Buffer[] = []
      res.on('data', (chunk: Buffer) => { chunks.push(chunk) })
      res.on('end', () => { resolve({ status: res.statusCode ?? 0, headers: res.headers, text: Buffer.concat(chunks).toString('utf8') }) })
    })
    req.once('error', reject)
    for (const chunk of options.chunks ?? []) req.write(chunk)
    req.end(options.body)
  })
}

interface Harness {
  readonly base: string
  readonly ctx: Context
  readonly calls: InvokeCall[]
  /** Current preset projection per Session id; absent ids read as missing Sessions. */
  readonly presets: Map<string, string | null>
  /** Session ids whose projections read as migration-required. */
  readonly migrating: Set<string>
  /** Events `inspect` returns per Session id. */
  readonly events: Map<string, SessionEvent[]>
  /** Overrides one Gateway method's implementation. */
  readonly methods: Map<string, (call: InvokeCall) => Promise<unknown>>
  /** Disposes the bridge plugin alone, leaving its services mounted. */
  dispose(): Promise<void>
  admission: { readonly peer: object } | { readonly rejection: 401 | 403 }
  pair(origin?: string): Promise<string>
  api(
    endpoint: string,
    body: unknown,
    options?: { readonly token?: string; readonly origin?: string },
  ): Promise<Response & { readonly json: unknown }>
}

async function boot(options: {
  readonly knowledge?: object
  readonly config?: Partial<Bridge.ExtensionBridgeConfig>
} = {}): Promise<Harness> {
  const ctx = new Context()
  root = ctx
  const calls: InvokeCall[] = []
  const presets = new Map<string, string | null>()
  const migrating = new Set<string>()
  const events = new Map<string, SessionEvent[]>()
  const methods = new Map<string, (call: InvokeCall) => Promise<unknown>>()
  const harness: Harness = {
    base: '',
    ctx,
    calls,
    presets,
    migrating,
    events,
    methods,
    admission: { peer: BROWSER_PEER },
    dispose: () => Promise.resolve(),
    async pair(origin = ORIGIN) {
      const page = await send(this.base, '/extension-bridge/pair', {
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ origin }).toString(),
      })
      expect(page.status).toBe(200)
      const token = /<code class="token">([^<]+)<\/code>/u.exec(page.text)?.[1]
      if (token === undefined) throw new Error('pairing page issued no token')
      return token
    },
    async api(endpoint, body, { token, origin = ORIGIN } = {}) {
      const response = await send(this.base, `/extension-bridge/v1/${endpoint}`, {
        headers: {
          'content-type': 'application/json',
          origin,
          ...token === undefined ? {} : { authorization: `Bearer ${token}` },
        },
        body: JSON.stringify(body),
      })
      const json: unknown = JSON.parse(response.text)
      return { ...response, json }
    },
  }
  await ctx.plugin(MemoryCredentials)
  ctx.provide('connection', {
    admit: () => harness.admission,
    browserPeer: BROWSER_PEER,
    createPeer: () => BRIDGE_PEER,
  } as never)
  ctx.provide('typertGateway', {
    invoke: (call: InvokeCall) => {
      calls.push(call)
      const override = methods.get(call.method)
      if (override !== undefined) return override(call)
      switch (call.method) {
        case 'projections': {
          const sessionId = String(call.args.request['sessionId'])
          if (migrating.has(sessionId)) return Promise.resolve({ kind: 'migration-required', values: {} })
          if (!presets.has(sessionId)) return Promise.resolve(null)
          return Promise.resolve({ kind: 'sequenced', asOfSeq: 0, values: { agentPreset: presets.get(sessionId) } })
        }
        case 'create':
          presets.set('created-session', String(call.args.request['agentPreset']))
          return Promise.resolve({ sessionId: 'created-session', agentPreset: call.args.request['agentPreset'] })
        case 'rename':
          return Promise.resolve({ title: call.args.request['title'], seq: 1 })
        case 'prompt':
        case 'cancel':
          return Promise.resolve({ accepted: true })
        default:
          return Promise.reject(new Error(`unexpected session method ${call.method}`))
      }
    },
  } as never)
  ctx.provide('sessionController', {
    inspect: (sessionId: string) => Promise.resolve({ meta: {}, inheritedEventCount: 0, events: events.get(sessionId) ?? [] }),
  } as never)
  if (options.knowledge !== undefined) ctx.provide('knowledge', options.knowledge as never)
  await ctx.plugin(WebServer, { host: '127.0.0.1', port: 0 })
  const bridge = ctx.plugin(Bridge, { allowedOrigins: [ORIGIN, OTHER_ORIGIN], agentPresets: ['browser', 'browser-chat'], ...options.config })
  await bridge
  return Object.assign(harness, {
    base: `http://127.0.0.1:${String(ctx.webServer.port)}`,
    dispose: async () => { await bridge.dispose() },
  })
}

let seq = 0
function event(type: string, data: object): SessionEvent {
  seq += 1
  return { type, seq, time: seq, data } as SessionEvent
}

describe('extension bridge configuration', () => {
  it('fails load without an allowed origin, with a malformed origin, or without presets', async () => {
    const ctx = new Context()
    root = ctx
    const valid = { allowedOrigins: [ORIGIN], agentPresets: ['browser'], maxRequestBodyBytes: 1, maxDocumentBytes: 1, maxDocumentTextChars: 1, maxHistoryMessages: 1 }
    await expect(Bridge.apply(ctx, { ...valid, allowedOrigins: [] })).rejects.toThrow(/allowedOrigins must name/)
    await expect(Bridge.apply(ctx, { ...valid, allowedOrigins: ['https://example.com'] })).rejects.toThrow(/not a chrome-extension/)
    await expect(Bridge.apply(ctx, { ...valid, agentPresets: [] })).rejects.toThrow(/agentPresets must name/)
  })
})

describe('pairing page', () => {
  it('admits only the signed-in browser and refuses other Connection outcomes', async () => {
    const harness = await boot()
    harness.admission = { rejection: 401 }
    const signIn = await send(harness.base, '/extension-bridge/pair', { method: 'GET' })
    expect(signIn.status).toBe(401)
    expect(signIn.text).toContain('Entre no CurupiraCode primeiro')
    harness.admission = { rejection: 403 }
    expect((await send(harness.base, '/extension-bridge/pair', { method: 'POST', body: `origin=${ORIGIN}` })).text).toContain('Pedido recusado')
    harness.admission = { peer: { id: 'api-operator' } }
    expect((await send(harness.base, '/extension-bridge/pair', { method: 'GET' })).status).toBe(401)

    harness.admission = { peer: BROWSER_PEER }
    const page = await send(harness.base, '/extension-bridge/pair', { method: 'GET' })
    expect(page.status).toBe(200)
    expect(page.headers['content-security-policy']).toMatch(/frame-ancestors 'none'/)
    expect(page.headers['x-frame-options']).toBe('DENY')
    expect(page.headers['cache-control']).toBe('no-store')
    expect(page.headers['referrer-policy']).toBe('same-origin')
    expect(page.text).toContain(ORIGIN)
    expect(page.text).toContain(OTHER_ORIGIN)
    expect(page.text).not.toContain('Memória Curupira')
  })

  it('validates the method, media type, and origin field of pairing forms', async () => {
    const harness = await boot()
    const put = await send(harness.base, '/extension-bridge/pair', { method: 'PUT' })
    expect([put.status, put.headers.allow]).toEqual([405, 'GET, POST'])
    const get = await send(harness.base, '/extension-bridge/revoke', { method: 'GET' })
    expect([get.status, get.headers.allow]).toEqual([405, 'POST'])
    expect((await send(harness.base, '/extension-bridge/pair', { headers: { 'content-type': 'text/plain' }, body: `origin=${ORIGIN}` })).status).toBe(415)
    const form = { 'content-type': 'application/x-www-form-urlencoded; charset=utf-8' }
    expect((await send(harness.base, '/extension-bridge/pair', { headers: form, body: '' })).status).toBe(400)
    expect((await send(harness.base, '/extension-bridge/pair', { headers: form, body: `origin=${ORIGIN}&origin=${OTHER_ORIGIN}` })).status).toBe(400)
    expect((await send(harness.base, '/extension-bridge/pair', { headers: form, body: 'origin=chrome-extension%3A%2F%2Fbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' })).status).toBe(400)
    expect((await send(harness.base, '/extension-bridge/pair', { headers: form, body: 'x'.repeat(5000) })).status).toBe(413)
  })

  it('issues a token that authenticates only its origin until it is revoked', async () => {
    const harness = await boot()
    const token = await harness.pair()
    expect((await harness.api('status', {}, { token })).status).toBe(200)
    expect((await harness.api('status', {}, { token, origin: OTHER_ORIGIN })).status).toBe(401)
    const paired = await send(harness.base, '/extension-bridge/pair', { method: 'GET' })
    expect(paired.text).toContain('Gerar novo código')
    const revoked = await send(harness.base, '/extension-bridge/revoke', {
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ origin: ORIGIN }).toString(),
    })
    expect(revoked.status).toBe(200)
    expect(revoked.text).toContain('revogado')
    const refused = await harness.api('status', {}, { token })
    expect(refused.status).toBe(401)
    expect(refused.headers['www-authenticate']).toBe('Bearer realm="curupiracode-extension"')
    expect(refused.json).toEqual({ error: { code: 'extension-bridge/unauthorized', message: expect.any(String) as string } })
  })
})

describe('extension endpoints', () => {
  it('refuses foreign callers and malformed requests before dispatch', async () => {
    const harness = await boot()
    const token = await harness.pair()
    expect((await harness.api('status', {})).status).toBe(401)
    expect((await harness.api('status', {}, { token, origin: 'http://127.0.0.1' })).status).toBe(403)
    const headers = { origin: ORIGIN, authorization: `Bearer ${token}` }
    const get = await send(harness.base, '/extension-bridge/v1/status', { method: 'GET', headers })
    expect([get.status, get.headers.allow]).toEqual([405, 'POST'])
    expect((await send(harness.base, '/extension-bridge/v1/status', { headers: { ...headers, 'content-type': 'text/plain' }, body: '{}' })).status).toBe(415)
    expect((await send(harness.base, '/extension-bridge/v1/status', { headers: { ...headers, 'content-type': 'application/json' }, body: '{' })).status).toBe(400)
    expect((await harness.api('status', { extra: true }, { token })).status).toBe(400)
    expect((await harness.api('sessions/unknown', {}, { token })).status).toBe(404)
    expect((await send(harness.base, '/extension-bridge/elsewhere', { headers })).status).toBe(404)
    expect(harness.calls).toEqual([])
  })

  it('bounds the buffered JSON body by its declared and streamed length', async () => {
    const harness = await boot({ config: { maxRequestBodyBytes: 16 } })
    const token = await harness.pair()
    const headers = { origin: ORIGIN, authorization: `Bearer ${token}`, 'content-type': 'application/json' }
    const declared = await send(harness.base, '/extension-bridge/v1/status', { headers, body: JSON.stringify({ padding: 'x'.repeat(32) }) })
    expect(declared.status).toBe(413)
    const streamed = await send(harness.base, '/extension-bridge/v1/status', { headers: { ...headers, 'transfer-encoding': 'chunked' }, chunks: ['{"padding":"', 'x'.repeat(32), '"}'] })
    expect(streamed.status).toBe(413)
    expect((await send(harness.base, '/extension-bridge/v1/status', { headers, body: '{}' })).status).toBe(200)
  })

  it('reports admitted presets and knowledge availability', async () => {
    const without = await boot()
    expect((await without.api('status', {}, { token: await without.pair() })).json).toEqual({ agentPresets: ['browser', 'browser-chat'], knowledge: false })
    await root?.fiber.dispose()
    const withKnowledge = await boot({ knowledge: {} })
    expect((await withKnowledge.api('status', {}, { token: await withKnowledge.pair() })).json).toEqual({ agentPresets: ['browser', 'browser-chat'], knowledge: true })
    expect((await send(withKnowledge.base, '/extension-bridge/pair', { method: 'GET' })).text).toContain('Memória Curupira')
  })

  it('creates and titles Sessions only with admitted presets, as the bridge Peer', async () => {
    const harness = await boot()
    const token = await harness.pair()
    const refused = await harness.api('sessions/create', { agentPreset: 'standard', title: 'x' }, { token })
    expect([refused.status, refused.json]).toEqual([403, { error: { code: 'extension-bridge/preset-not-allowed', message: expect.any(String) as string } }])
    expect((await harness.api('sessions/create', { agentPreset: 'browser', title: '   ' }, { token })).status).toBe(400)
    const created = await harness.api('sessions/create', { agentPreset: 'browser-chat', title: ' Chat no navegador ' }, { token })
    expect([created.status, created.json]).toEqual([200, { sessionId: 'created-session' }])
    expect(harness.calls.map(call => [call.namespace, call.method, call.args.request, call.peer])).toEqual([
      ['session', 'create', { agentPreset: 'browser-chat' }, BRIDGE_PEER],
      ['session', 'rename', { sessionId: 'created-session', title: 'Chat no navegador' }, BRIDGE_PEER],
    ])
  })

  it('refuses session-scoped work on missing, unmigrated, or non-browser Sessions', async () => {
    const harness = await boot()
    const token = await harness.pair()
    harness.presets.set('standard-session', 'standard')
    harness.presets.set('bare-session', null)
    harness.migrating.add('old-session')
    const body = (sessionId: string) => ({ sessionId, requestId: 'request-0001', content: [{ type: 'text', text: 'rm -rf /' }] })
    expect((await harness.api('sessions/prompt', body('missing-session'), { token })).status).toBe(404)
    expect((await harness.api('sessions/prompt', body('old-session'), { token })).status).toBe(409)
    expect((await harness.api('sessions/prompt', body('standard-session'), { token })).status).toBe(403)
    expect((await harness.api('sessions/prompt', body('bare-session'), { token })).status).toBe(403)
    expect((await harness.api('sessions/cancel', { sessionId: 'standard-session' }, { token })).status).toBe(403)
    expect((await harness.api('sessions/messages', { sessionId: 'standard-session' }, { token })).status).toBe(403)
    expect((await harness.api('sessions/reply', { sessionId: 'standard-session', requestId: 'request-0001' }, { token })).status).toBe(403)
    expect(harness.calls.every(call => call.method === 'projections')).toBe(true)
  })

  it('queues prompts, reads replies and messages, and cancels browser Sessions', async () => {
    const harness = await boot({ config: { maxHistoryMessages: 1 } })
    const token = await harness.pair()
    harness.presets.set('chat-session', 'browser-chat')
    const content = [{ type: 'image', mediaType: 'image/png', data: 'iVBORw0KGgo=', name: 'tela.png' }, { type: 'text', text: 'Olá' }]
    expect((await harness.api('sessions/prompt', { sessionId: 'chat-session', requestId: 'request-0001', content }, { token })).json).toEqual({ accepted: true })
    expect(harness.calls.at(-1)?.args.request).toEqual({ requestId: 'request-0001', sessionId: 'chat-session', mode: 'queue', content })
    await harness.api('sessions/prompt', { sessionId: 'chat-session', requestId: 'request-0002', content, clientTimeZone: 'America/Sao_Paulo' }, { token })
    expect(harness.calls.at(-1)?.args.request).toMatchObject({ requestId: 'request-0002', clientTimeZone: 'America/Sao_Paulo' })
    expect((await harness.api('sessions/prompt', { sessionId: 'chat-session', requestId: 'short', content }, { token })).status).toBe(400)
    expect((await harness.api('sessions/prompt', { sessionId: 'chat-session', requestId: 'request-0001', content: [] }, { token })).status).toBe(400)

    const reply = () => harness.api('sessions/reply', { sessionId: 'chat-session', requestId: 'request-0001' }, { token })
    expect((await reply()).json).toEqual({ state: 'queued' })
    harness.events.set('chat-session', [
      event('user/message', { id: 'u1', role: 'user', content: [{ type: 'text', text: 'Olá' }], source: { kind: 'user', rpcId: 'request-0001' } }),
      event('assistant/message', { turn: 1, step: 0, stream: [], message: { id: 'a1', role: 'assistant', source: { kind: 'model' }, content: [{ type: 'text', text: 'Olá!' }] } }),
      event('turn/end', { turn: 1, reason: { kind: 'completed' } }),
    ])
    expect((await reply()).json).toEqual({ state: 'completed', text: 'Olá!' })
    expect((await harness.api('sessions/messages', { sessionId: 'chat-session' }, { token })).json)
      .toEqual({ messages: [{ seq: expect.any(Number) as number, role: 'assistant', text: 'Olá!' }] })
    expect((await harness.api('sessions/cancel', { sessionId: 'chat-session' }, { token })).json).toEqual({ accepted: true })
    expect(harness.calls.at(-1)).toMatchObject({ method: 'cancel', args: { request: { sessionId: 'chat-session' } } })
  })

  it('maps Session and unexpected failures to statuses without leaking internals', async () => {
    const harness = await boot()
    const token = await harness.pair()
    harness.presets.set('chat-session', 'browser-chat')
    harness.methods.set('cancel', () => Promise.reject(new RemoteError('gateway/internal', 'no live agent', {})))
    const remote = await harness.api('sessions/cancel', { sessionId: 'chat-session' }, { token })
    expect([remote.status, remote.json]).toEqual([422, { error: { code: 'gateway/internal', message: 'no live agent' } }])
    const logged = vi.spyOn(harness.ctx.logger, 'error').mockImplementation(() => {})
    harness.methods.set('cancel', () => Promise.reject(new Error('secret stack detail')))
    const internal = await harness.api('sessions/cancel', { sessionId: 'chat-session' }, { token })
    expect(internal.status).toBe(500)
    expect(internal.text).not.toContain('secret stack detail')
    expect(logged).toHaveBeenCalledWith(expect.objectContaining({ message: 'secret stack detail' }))
  })
})

describe('knowledge ingestion', () => {
  it('answers 503 when no knowledge service is mounted', async () => {
    const harness = await boot()
    const response = await harness.api('knowledge/ingest', { name: 'notas.md', data: 'IyBOb3Rhcw==' }, { token: await harness.pair() })
    expect(response.status).toBe(503)
  })

  it('ingests strict base64 and returns the bounded extracted text', async () => {
    const ingest = vi.fn((request: { readonly content: Uint8Array }) => Promise.resolve({
      id: `doc-${String(request.content.byteLength)}`, passageCount: 1, alreadyPresent: false, extractor: 'text',
    }))
    const text = vi.fn(() => Promise.resolve('# Notas sobre a floresta'))
    const harness = await boot({ knowledge: { ingest, text }, config: { maxDocumentBytes: 8, maxDocumentTextChars: 7 } })
    const token = await harness.pair()
    const ingested = await harness.api('knowledge/ingest', { name: 'notas.md', data: 'IyBOb3Rhcw==', format: 'md' }, { token })
    expect(ingested.json).toEqual({ id: 'doc-7', name: 'notas.md', passageCount: 1, alreadyPresent: false, extractor: 'text', text: '# Notas', truncated: true })
    const [request] = ingest.mock.calls[0] ?? []
    expect(request).toMatchObject({ name: 'notas.md', format: 'md' })
    expect(Object.getPrototypeOf(request?.content)).toBe(Uint8Array.prototype)
    await harness.api('knowledge/ingest', { name: 'notas', data: 'IyBOb3Rhcw==' }, { token })
    expect(ingest.mock.calls[1]?.[0]).not.toHaveProperty('format')
    text.mockResolvedValueOnce('curto')
    expect((await harness.api('knowledge/ingest', { name: 'a.txt', data: 'YQ==' }, { token })).json).toMatchObject({ text: 'curto', truncated: false })

    expect((await harness.api('knowledge/ingest', { name: 'x', data: 'abc' }, { token })).status).toBe(400)
    expect((await harness.api('knowledge/ingest', { name: 'x', data: 'ab$=' }, { token })).status).toBe(400)
    expect((await harness.api('knowledge/ingest', { name: 'x', data: 'A'.repeat(16) }, { token })).status).toBe(413)
    expect((await harness.api('knowledge/ingest', { name: 'x', data: 'AAAAAAAAAAAA' }, { token })).status).toBe(413)
    ingest.mockRejectedValueOnce(new KnowledgeError('no extractor reads x', 'KNOWLEDGE_UNSUPPORTED_FORMAT'))
    expect((await harness.api('knowledge/ingest', { name: 'x', data: 'YQ==' }, { token })).json)
      .toEqual({ error: { code: 'KNOWLEDGE_UNSUPPORTED_FORMAT', message: 'no extractor reads x' } })
  })
})

describe('extension bridge lifecycle', () => {
  it('aborts an operation whose client disconnected', async () => {
    const harness = await boot()
    const token = await harness.pair()
    harness.presets.set('chat-session', 'browser-chat')
    let signal: AbortSignal | undefined
    harness.methods.set('cancel', call => new Promise((_resolve, reject) => {
      signal = call.signal
      call.signal.addEventListener('abort', () => { reject(new Error('aborted')) }, { once: true })
    }))
    const url = new URL('/extension-bridge/v1/sessions/cancel', harness.base)
    const req = httpRequest({ hostname: url.hostname, port: url.port, path: url.pathname, method: 'POST', headers: { origin: ORIGIN, authorization: `Bearer ${token}`, 'content-type': 'application/json' } })
    req.once('error', () => {})
    req.end(JSON.stringify({ sessionId: 'chat-session' }))
    await vi.waitFor(() => { expect(signal).toBeDefined() })
    req.destroy()
    await vi.waitFor(() => { expect(signal?.aborted).toBe(true) })
  })

  it('cancels and awaits admitted requests, then removes its route on dispose', async () => {
    const harness = await boot()
    const token = await harness.pair()
    harness.presets.set('chat-session', 'browser-chat')
    let settled = false
    harness.methods.set('cancel', call => new Promise((_resolve, reject) => {
      call.signal.addEventListener('abort', () => {
        setTimeout(() => {
          settled = true
          reject(new Error('aborted'))
        }, 20)
      }, { once: true })
    }))
    const pending = harness.api('sessions/cancel', { sessionId: 'chat-session' }, { token })
    await vi.waitFor(() => { expect(harness.calls.some(call => call.method === 'cancel')).toBe(true) })
    await harness.dispose()
    expect(settled).toBe(true)
    const answer = await pending
    expect([answer.status, answer.json]).toEqual([503, { error: { code: 'extension-bridge/cancelled', message: 'the request was cancelled' } }])
    expect((await send(harness.base, '/extension-bridge/pair', { method: 'GET' })).status).toBe(404)
    await harness.ctx.plugin(Bridge, { allowedOrigins: [ORIGIN], agentPresets: ['browser'] })
    expect((await harness.api('status', {}, { token })).status).toBe(200)
  })
})
