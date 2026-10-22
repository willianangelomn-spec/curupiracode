/**
 * The browser-extension bridge in the real `dsh --profile web` process: a
 * signed-in browser pairs the extension origin on the pairing page, then that
 * origin with its token creates a `browser-chat` Session, prompts it, reads
 * the reply produced by the shipped DeepSeek adapter against the mock
 * provider, and adds a document to Curupira Memory. Foreign origins, forged
 * Hosts, missing or revoked tokens, and Sessions with tools are refused, and
 * the pairing survives a restart.
 */

import type { ChildProcess } from 'node:child_process'
import { spawn } from 'node:child_process'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { request as httpRequest } from 'node:http'
import { createRequire } from 'node:module'
import { createServer } from 'node:net'
import type { AddressInfo } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { startMockLlmServer, type MockLlmServer } from '@deepseek-ai/dsh-llm-mock-server'
import { describe, expect, it } from 'vitest'

const REPO_ROOT = fileURLToPath(new URL('../../..', import.meta.url))
const DSH_SOURCE_BIN = join(REPO_ROOT, 'apps/cli/src/bin.ts')
const TSX_LOADER = pathToFileURL(createRequire(join(REPO_ROOT, 'package.json')).resolve('tsx')).href
const EXTENSION_ORIGIN = 'chrome-extension://ndfighammhdpfaejmadojjaaelmpadek'
const API_KEY = 'extension-bridge-mock-key'
const REPLY = 'Olá! Sou o Curupira.'

interface RunningWeb {
  readonly child: ChildProcess
  readonly launchUrl: string
  readonly base: string
}

interface HttpResult {
  readonly status: number
  readonly headers: Readonly<Record<string, string | string[] | undefined>>
  readonly body: string
}

async function freePort(): Promise<number> {
  const server = createServer()
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })
  const port = (server.address() as AddressInfo).port
  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error === undefined) resolve()
      else reject(error)
    })
  })
  return port
}

function redact(output: string): string {
  return output.replace(/([?&]token=)[^\s)]+/gu, '$1<redacted>')
}

async function startWeb(root: string, dshHome: string, port: number, overlay: string, mock: MockLlmServer): Promise<RunningWeb> {
  const env = Object.fromEntries(Object.entries(process.env).filter(([name]) => !/(?:KEY|SECRET|TOKEN|PASSWORD)/iu.test(name)))
  const child = spawn(process.execPath, [
    '--import', TSX_LOADER, DSH_SOURCE_BIN,
    '--profile', 'web', '--patch', overlay,
    '--no-open', '--port', String(port),
  ], {
    cwd: root,
    env: {
      ...env,
      DEEPSEEK_API_KEY: API_KEY,
      DEEPSEEK_BASE_URL: mock.baseURL,
      DSH_AGENTS_HOME: join(root, '.agents'),
      DSH_HOME: dshHome,
      DSH_TELEMETRY_DISABLED: '1',
      NODE_NO_WARNINGS: '1',
      SSH_CONNECTION: '',
      SSH_TTY: '',
      TSX_TSCONFIG_PATH: join(REPO_ROOT, 'tsconfig.json'),
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  let output = ''
  const launchUrl = await new Promise<string>((resolve, reject) => {
    const timer = setTimeout(() => { reject(new Error(`dsh web did not become ready:\n${redact(output)}`)) }, 90_000)
    const append = (chunk: Buffer | string): void => {
      output = `${output}${String(chunk)}`.slice(-100_000)
      const match = /dsh web: (http:\/\/[^\s]+)/u.exec(output)
      if (match?.[1] === undefined) return
      clearTimeout(timer)
      resolve(match[1])
    }
    child.stdout?.on('data', append)
    child.stderr?.on('data', append)
    child.once('error', (error) => { clearTimeout(timer); reject(error) })
    child.once('exit', (code) => { clearTimeout(timer); reject(new Error(`dsh web exited before readiness (${String(code)}):\n${redact(output)}`)) })
  })
  return { child, launchUrl, base: new URL(launchUrl).origin }
}

async function stopWeb(running: RunningWeb): Promise<void> {
  if (running.child.exitCode !== null) return
  const exited = new Promise<void>((resolve) => { running.child.once('exit', () => { resolve() }) })
  running.child.kill('SIGTERM')
  const forced = setTimeout(() => { running.child.kill('SIGKILL') }, 10_000)
  forced.unref()
  await exited
  clearTimeout(forced)
}

interface SendOptions {
  readonly method?: string
  readonly headers?: Record<string, string>
  readonly body?: string
}

/** One HTTP exchange with full control of Host, Origin, and Authorization. */
function send(base: string, path: string, options: SendOptions = {}): Promise<HttpResult> {
  const url = new URL(path, base)
  return new Promise((resolve, reject) => {
    const req = httpRequest({ hostname: url.hostname, port: url.port, path: url.pathname + url.search, method: options.method ?? 'GET', headers: options.headers }, (res) => {
      const chunks: Buffer[] = []
      res.on('data', (chunk: Buffer) => { chunks.push(chunk) })
      res.on('end', () => { resolve({ status: res.statusCode ?? 0, headers: res.headers, body: Buffer.concat(chunks).toString('utf8') }) })
    })
    req.once('error', reject)
    req.end(options.body)
  })
}

/** Exchange the printed launch token for the browser cookie, as a browser does on first open. */
async function signIn(web: RunningWeb): Promise<string> {
  const exchange = await send(web.base, new URL(web.launchUrl).pathname + new URL(web.launchUrl).search)
  expect(exchange.status).toBe(303)
  const setCookie = exchange.headers['set-cookie']?.[0]
  if (setCookie === undefined) throw new Error('launch-token exchange set no cookie')
  return setCookie.split(';', 1)[0]!
}

function pairingForm(web: RunningWeb, path: 'pair' | 'revoke', cookie: string, origin = web.base): Promise<HttpResult> {
  return send(web.base, `/extension-bridge/${path}`, {
    method: 'POST',
    headers: { cookie, origin, 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ origin: EXTENSION_ORIGIN }).toString(),
  })
}

async function api(
  web: RunningWeb,
  endpoint: string,
  body: unknown,
  token: string | undefined,
  headers: Record<string, string> = {},
): Promise<{ readonly status: number; readonly json: unknown }> {
  const result = await send(web.base, `/extension-bridge/v1/${endpoint}`, {
    method: 'POST',
    headers: {
      origin: EXTENSION_ORIGIN,
      'content-type': 'application/json',
      ...token === undefined ? {} : { authorization: `Bearer ${token}` },
      ...headers,
    },
    body: JSON.stringify(body),
  })
  const json: unknown = JSON.parse(result.body)
  return { status: result.status, json }
}

describe('the extension bridge in the real Web process', () => {
  it('pairs on the signed-in page, chats in a browser-chat Session, and refuses everything else', { timeout: 300_000 }, async () => {
    const root = await mkdtemp(join(tmpdir(), 'dsh-extension-bridge-'))
    const dshHome = join(root, '.dsh')
    const overlay = join(root, 'overlay.yml')
    // Lexical-only Curupira Memory: semantic indexing would download a model.
    await writeFile(overlay, '- id: knowledge-local\n  config:\n    semantic: false\n')
    const mock = await startMockLlmServer({ sequence: ['success'], repeatLast: true, apiKey: API_KEY, successText: REPLY })
    const port = await freePort()
    let web: RunningWeb | undefined
    try {
      web = await startWeb(root, dshHome, port, overlay, mock)
      expect((await send(web.base, '/extension-bridge/pair')).status).toBe(401)
      const cookie = await signIn(web)
      const page = await send(web.base, '/extension-bridge/pair', { headers: { cookie } })
      expect(page.status).toBe(200)
      expect(page.body).toContain(EXTENSION_ORIGIN)
      expect(page.body).toContain('<code>browser</code>, <code>browser-chat</code>')
      // The extension origin cannot approve itself even with the browser cookie attached.
      expect((await pairingForm(web, 'pair', cookie, EXTENSION_ORIGIN)).status).toBe(403)
      const issued = await pairingForm(web, 'pair', cookie)
      const token = /<code class="token">([^<]+)<\/code>/u.exec(issued.body)?.[1]
      if (token === undefined) throw new Error('the pairing page issued no token')
      expect(await readFile(join(dshHome, '.credentials.yaml'), 'utf8')).not.toContain(token)

      expect((await api(web, 'status', {}, undefined)).status).toBe(401)
      expect((await api(web, 'status', {}, 'x'.repeat(43))).status).toBe(401)
      expect((await api(web, 'status', {}, token, { origin: 'chrome-extension://aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' })).status).toBe(403)
      expect((await api(web, 'status', {}, token, { origin: web.base })).status).toBe(403)
      expect((await api(web, 'status', {}, token, { host: `evil.example:${String(port)}` })).status).toBe(403)
      // A pairing token is no credential for the Web API.
      expect((await send(web.base, '/api/session/list', { method: 'POST', headers: { origin: EXTENSION_ORIGIN, authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: '{}' })).status).toBe(403)
      expect(await api(web, 'status', {}, token)).toEqual({ status: 200, json: { agentPresets: ['browser', 'browser-chat'], knowledge: true } })
      expect((await api(web, 'sessions/create', { agentPreset: 'standard', title: 'x' }, token)).status).toBe(403)

      const created = await api(web, 'sessions/create', { agentPreset: 'browser-chat', title: 'Chat no navegador: Teste' }, token)
      expect(created.status).toBe(200)
      const { sessionId } = created.json as { readonly sessionId: string }
      const prompt = { sessionId, requestId: 'extension-bridge-e2e-1', content: [{ type: 'text', text: 'MENSAGEM DO USUÁRIO:\nOlá' }], clientTimeZone: 'America/Sao_Paulo' }
      expect(await api(web, 'sessions/prompt', prompt, token)).toEqual({ status: 200, json: { accepted: true } })
      let reply: unknown
      for (let attempt = 0; attempt < 120; attempt += 1) {
        reply = (await api(web, 'sessions/reply', { sessionId, requestId: prompt.requestId }, token)).json
        if ((reply as { readonly state: string }).state !== 'queued' && (reply as { readonly state: string }).state !== 'running') break
        await new Promise(resolve => setTimeout(resolve, 250))
      }
      expect(reply).toEqual({ state: 'completed', text: REPLY })
      expect((await api(web, 'sessions/messages', { sessionId }, token)).json).toEqual({ messages: [
        { seq: expect.any(Number) as number, role: 'user', text: 'MENSAGEM DO USUÁRIO:\nOlá' },
        { seq: expect.any(Number) as number, role: 'assistant', text: REPLY },
      ] })
      // The model behind the extension sees only the process-global directory tool: no shell, file, web, or vault access.
      const modelRequest = mock.requests.find(request => JSON.stringify(request.body).includes('MENSAGEM DO USUÁRIO'))
      const tools = (modelRequest?.body as { readonly tools?: readonly { readonly name: string }[] } | undefined)?.tools
      expect(tools?.map(tool => tool.name)).toEqual(['working_directory'])

      const ingested = await api(web, 'knowledge/ingest', { name: 'notas.md', data: Buffer.from('# Notas\n\nO Curupira protege a floresta.\n').toString('base64'), format: 'md' }, token)
      expect(ingested).toMatchObject({ status: 200, json: { name: 'notas.md', passageCount: 1, text: '# Notas\n\nO Curupira protege a floresta.\n', truncated: false } })

      // A Session the Web interface created with tools stays out of the extension's reach.
      const standard = await send(web.base, '/api/session/create', {
        method: 'POST',
        headers: { cookie, origin: web.base, 'content-type': 'application/json' },
        body: JSON.stringify({ type: 'client-request', rpcId: 'bridge-e2e-standard', method: 'session/create', payload: { args: { request: { agentPreset: 'standard' } } } }),
      })
      const standardResponse = JSON.parse(standard.body) as { readonly result: { readonly value: { readonly sessionId: string } } }
      const standardId = standardResponse.result.value.sessionId
      expect((await api(web, 'sessions/prompt', { ...prompt, sessionId: standardId, requestId: 'extension-bridge-e2e-2' }, token)).status).toBe(403)

      await stopWeb(web)
      web = await startWeb(root, dshHome, port, overlay, mock)
      expect((await api(web, 'status', {}, token)).status).toBe(200)
      expect((await pairingForm(web, 'revoke', cookie)).status).toBe(200)
      expect((await api(web, 'status', {}, token)).status).toBe(401)
    } finally {
      if (web !== undefined) await stopWeb(web)
      await mock.close()
      await rm(root, { recursive: true, force: true })
    }
  })
})
