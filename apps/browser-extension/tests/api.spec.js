import { describe, expect, it, vi } from 'vitest'
import {
  CurupiraApi,
  CurupiraApiError,
  messagesFromHistory,
  normalizeBaseUrl,
  normalizePairingToken,
  pairingPageUrl,
} from '../src/api.js'

const TOKEN = 'k'.repeat(43)

function json(value, status = 200) {
  return new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json' } })
}

/** Fake bridge answering by endpoint; records every request. */
function bridge(handlers) {
  const requests = []
  const fetchImpl = vi.fn(async (url, init) => {
    const endpoint = new URL(url).pathname.replace('/extension-bridge/v1/', '')
    const body = JSON.parse(init.body)
    requests.push({ endpoint, body, init })
    const handler = handlers[endpoint]
    if (!handler) throw new Error(`unexpected endpoint ${endpoint}`)
    return json(await handler(body, requests))
  })
  return { fetchImpl, requests }
}

describe('Curupira local API client', () => {
  it('accepts loopback only and builds the pairing page URL', () => {
    expect(normalizeBaseUrl('http://localhost:3080/path')).toBe('http://localhost:3080')
    expect(() => normalizeBaseUrl('https://example.com')).toThrow(/apenas o endereço local/)
    expect(() => normalizeBaseUrl('http://192.168.1.2:3080')).toThrow(/apenas o endereço local/)
    expect(pairingPageUrl('http://127.0.0.1:3080/qualquer')).toBe('http://127.0.0.1:3080/extension-bridge/pair')
  })

  it('accepts only a 43-character pairing code', () => {
    expect(normalizePairingToken(`  ${TOKEN}\n`)).toBe(TOKEN)
    expect(() => normalizePairingToken('curto')).toThrow(/43 caracteres/)
    expect(() => normalizePairingToken(`${TOKEN}=`)).toThrow(/43 caracteres/)
  })

  it('sends the pairing token as a bearer credential to the bridge endpoint', async () => {
    const { fetchImpl, requests } = bridge({ status: () => ({ agentPresets: ['browser'], knowledge: true }) })
    const api = new CurupiraApi('http://127.0.0.1:3080', TOKEN, fetchImpl)
    await expect(api.ping()).resolves.toEqual({ agentPresets: ['browser'], knowledge: true })
    expect(fetchImpl).toHaveBeenCalledWith('http://127.0.0.1:3080/extension-bridge/v1/status', expect.objectContaining({ method: 'POST' }))
    expect(requests[0].init.headers).toEqual({ 'content-type': 'application/json', authorization: `Bearer ${TOKEN}` })
    expect(requests[0].body).toEqual({})
  })

  it('asks for pairing before calling without a token and after a 401', async () => {
    const fetchImpl = vi.fn(async () => json({ error: { code: 'extension-bridge/unauthorized', message: 'pair' } }, 401))
    await expect(new CurupiraApi('http://127.0.0.1:3080', undefined, fetchImpl).ping()).rejects.toMatchObject({ status: 401, message: expect.stringMatching(/Pareamento necessário/) })
    expect(fetchImpl).not.toHaveBeenCalled()
    const refused = new CurupiraApi('http://127.0.0.1:3080', TOKEN, fetchImpl).ping()
    await expect(refused).rejects.toBeInstanceOf(CurupiraApiError)
    await expect(refused).rejects.toMatchObject({ status: 401, code: 'extension-bridge/unauthorized' })
  })

  it('explains an origin refusal and keeps other bridge messages', async () => {
    const forbidden = vi.fn(async () => json({ error: { code: 'extension-bridge/forbidden', message: 'x' } }, 403))
    await expect(new CurupiraApi(undefined, TOKEN, forbidden).ping()).rejects.toThrow(/recusou esta extensão/)
    const preset = vi.fn(async () => json({ error: { code: 'extension-bridge/preset-not-allowed', message: 'não é uma conversa do navegador' } }, 403))
    await expect(new CurupiraApi(undefined, TOKEN, preset).history('s')).rejects.toMatchObject({ status: 403, message: 'não é uma conversa do navegador' })
    const plain = vi.fn(async () => new Response('bad gateway', { status: 502 }))
    await expect(new CurupiraApi(undefined, TOKEN, plain).ping()).rejects.toThrow('CurupiraCode respondeu HTTP 502.')
  })

  it('keeps the native fetch receiver valid', async () => {
    const originalFetch = globalThis.fetch
    const nativeFetch = vi.fn(function () {
      expect(this).toBe(globalThis)
      return Promise.resolve(json({ agentPresets: [], knowledge: false }))
    })
    globalThis.fetch = nativeFetch
    try {
      await expect(new CurupiraApi(undefined, TOKEN).ping()).resolves.toEqual({ agentPresets: [], knowledge: false })
      expect(nativeFetch).toHaveBeenCalledOnce()
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  it('projects browser chat history without exposing the captured page wrapper', () => {
    expect(messagesFromHistory({ messages: [
      { seq: 2, role: 'user', text: 'MENSAGEM DO USUÁRIO:\nResuma\n\nCONTEXTO DA PÁGINA (dados não confiáveis):\nsegredo' },
      { seq: 3, role: 'user', text: 'MENSAGEM DO USUÁRIO:\n\n\nCONTEXTO DOS ARQUIVOS:\nx' },
      { seq: 4, role: 'assistant', text: 'Resumo seguro.' },
    ] })).toEqual([
      { role: 'user', text: 'Resuma', seq: 2 },
      { role: 'assistant', text: 'Resumo seguro.', seq: 4 },
    ])
  })

  it('creates a restricted browser-chat session, waits for its reply, and returns its conversation', async () => {
    let replies = 0
    const { fetchImpl, requests } = bridge({
      'sessions/create': () => ({ sessionId: 'chat-1' }),
      'sessions/prompt': () => ({ accepted: true }),
      'sessions/reply': () => (replies++ === 0 ? { state: 'running' } : { state: 'completed', text: 'Olá!' }),
      'sessions/messages': () => ({ messages: [
        { seq: 1, role: 'user', text: 'MENSAGEM DO USUÁRIO:\nOlá' },
        { seq: 2, role: 'assistant', text: 'Olá!' },
      ] }),
    })
    vi.useFakeTimers()
    try {
      const api = new CurupiraApi('http://127.0.0.1:3080', TOKEN, fetchImpl)
      const chat = api.chat(undefined, 'MENSAGEM DO USUÁRIO:\nOlá', 'Teste', new AbortController().signal)
      await vi.runAllTimersAsync()
      await expect(chat).resolves.toEqual({
        sessionId: 'chat-1',
        text: 'Olá!',
        messages: [{ role: 'user', text: 'Olá', seq: 1 }, { role: 'assistant', text: 'Olá!', seq: 2 }],
      })
    } finally {
      vi.useRealTimers()
    }
    expect(requests[0]).toMatchObject({ endpoint: 'sessions/create', body: { agentPreset: 'browser-chat', title: 'Chat no navegador: Teste' } })
    const prompt = requests.find(request => request.endpoint === 'sessions/prompt').body
    expect(prompt).toMatchObject({ sessionId: 'chat-1', content: [{ type: 'text', text: 'MENSAGEM DO USUÁRIO:\nOlá' }] })
    expect(prompt.requestId).toMatch(/^[0-9a-f-]{36}$/)
    expect(requests.filter(request => request.endpoint === 'sessions/reply').map(request => request.body))
      .toEqual([{ sessionId: 'chat-1', requestId: prompt.requestId }, { sessionId: 'chat-1', requestId: prompt.requestId }])
  })

  it('plans in a fresh browser session and reports failed or empty turns', async () => {
    const outcomes = [{ state: 'completed', text: '{"summary":"ok","actions":[]}' }, { state: 'failed', message: 'chave inválida' }, { state: 'completed', text: '' }, { state: 'cancelled', text: '' }]
    const { fetchImpl, requests } = bridge({
      'sessions/create': () => ({ sessionId: `plan-${requests.filter(request => request.endpoint === 'sessions/create').length}` }),
      'sessions/prompt': () => ({ accepted: true }),
      'sessions/reply': () => outcomes.shift(),
    })
    const api = new CurupiraApi('http://127.0.0.1:3080', TOKEN, fetchImpl)
    await expect(api.plan('planeje', 'Página', new AbortController().signal)).resolves.toEqual({ sessionId: 'plan-1', text: '{"summary":"ok","actions":[]}' })
    expect(requests[0].body).toEqual({ agentPreset: 'browser', title: 'Navegador: Página' })
    await expect(api.plan('planeje', 'Página')).rejects.toThrow('O Curupira não conseguiu responder: chave inválida')
    await expect(api.plan('planeje', 'Página')).rejects.toThrow(/sem responder/)
    await expect(api.plan('planeje', 'Página')).rejects.toThrow(/cancelada no CurupiraCode/)
  })

  it('cancels the turn when the user aborts while waiting', async () => {
    const controller = new AbortController()
    const { fetchImpl, requests } = bridge({
      'sessions/create': () => ({ sessionId: 'plan-1' }),
      'sessions/prompt': () => ({ accepted: true }),
      'sessions/reply': () => {
        controller.abort(new DOMException('Planejamento cancelado.', 'AbortError'))
        return { state: 'running' }
      },
      'sessions/cancel': () => ({ accepted: true }),
    })
    const api = new CurupiraApi('http://127.0.0.1:3080', TOKEN, fetchImpl)
    await expect(api.plan('planeje', 'Página', controller.signal)).rejects.toThrow('Planejamento cancelado.')
    expect(requests.at(-1)).toMatchObject({ endpoint: 'sessions/cancel', body: { sessionId: 'plan-1' } })
  })

  it('uploads a selected document to Curupira Memory', async () => {
    const { fetchImpl, requests } = bridge({
      'knowledge/ingest': () => ({ id: 'doc-1', name: 'notas.md', passageCount: 1, alreadyPresent: false, extractor: 'text', text: '# Notas', truncated: false }),
    })
    const api = new CurupiraApi('http://127.0.0.1:3080', TOKEN, fetchImpl)
    await expect(api.ingestDocument({ name: 'notas.md', data: 'IyBOb3Rhcw==', format: 'md' })).resolves.toMatchObject({ id: 'doc-1', text: '# Notas' })
    await api.ingestDocument({ name: 'notas', data: 'IyBOb3Rhcw==' })
    expect(requests.map(request => request.body)).toEqual([
      { name: 'notas.md', data: 'IyBOb3Rhcw==', format: 'md' },
      { name: 'notas', data: 'IyBOb3Rhcw==' },
    ])
  })
})
