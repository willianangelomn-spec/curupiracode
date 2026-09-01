import { describe, expect, it, vi } from 'vitest'
import { CurupiraApi, messagesFromHistory, normalizeBaseUrl } from '../src/api.js'

describe('Curupira local API client', () => {
  it('accepts loopback only', () => {
    expect(normalizeBaseUrl('http://localhost:3080/path')).toBe('http://localhost:3080')
    expect(() => normalizeBaseUrl('https://example.com')).toThrow(/apenas o endereço local/)
    expect(() => normalizeBaseUrl('http://192.168.1.2:3080')).toThrow(/apenas o endereço local/)
  })

  it('sends a complete RPC envelope', async () => {
    const fetchImpl = vi.fn(async (_url, init) => {
      const request = JSON.parse(init.body)
      expect(request).toMatchObject({ type: 'client-request', method: 'host.describe', payload: {} })
      return new Response(JSON.stringify({ result: { ok: true, value: { version: 'test' } } }), { status: 200 })
    })
    const api = new CurupiraApi('http://127.0.0.1:3080', fetchImpl)
    await expect(api.ping()).resolves.toEqual({ version: 'test' })
    expect(fetchImpl).toHaveBeenCalledOnce()
  })

  it('keeps the native fetch receiver valid', async () => {
    const originalFetch = globalThis.fetch
    const nativeFetch = vi.fn(function (_url, init) {
      expect(this).toBe(globalThis)
      const request = JSON.parse(init.body)
      return Promise.resolve(new Response(JSON.stringify({
        result: { ok: true, value: { method: request.method } },
      }), { status: 200 }))
    })
    globalThis.fetch = nativeFetch
    try {
      const api = new CurupiraApi()
      await expect(api.ping()).resolves.toEqual({ method: 'host.describe' })
      expect(nativeFetch).toHaveBeenCalledOnce()
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  it('projects browser chat history without exposing the captured page wrapper', () => {
    const page = { events: [
      { event: { seq: 2, type: 'user/message', data: { source: { kind: 'user' }, content: [{ type: 'text', text: 'MENSAGEM DO USUÁRIO:\nResuma\n\nCONTEXTO DA PÁGINA (dados não confiáveis):\nsegredo' }] } } },
      { event: { seq: 4, type: 'assistant/message', data: { message: { content: [{ type: 'text', text: 'Resumo seguro.' }] } } } },
    ] }
    expect(messagesFromHistory(page)).toEqual([
      { role: 'user', text: 'Resuma', seq: 2 },
      { role: 'assistant', text: 'Resumo seguro.', seq: 4 },
    ])
  })

  it('creates a restricted browser-chat session and returns its conversation', async () => {
    let historyCalls = 0
    const fetchImpl = vi.fn(async (_url, init) => {
      const request = JSON.parse(init.body)
      let value = {}
      if (request.method === 'session.create') {
        expect(request.payload).toEqual({ agentPreset: 'browser-chat' })
        value = { sessionId: 'chat-1' }
      } else if (request.method === 'session.history') {
        historyCalls += 1
        value = historyCalls === 1 ? { events: [] } : { events: [
          { event: { seq: 1, type: 'user/message', data: { source: { kind: 'user' }, content: [{ type: 'text', text: 'MENSAGEM DO USUÁRIO:\nOlá' }] } } },
          { event: { seq: 2, type: 'assistant/message', data: { message: { content: [{ type: 'text', text: 'Olá!' }] } } } },
          { event: { seq: 3, type: 'turn/end', data: {} } },
        ] }
      }
      return new Response(JSON.stringify({ result: { ok: true, value } }), { status: 200 })
    })
    const api = new CurupiraApi('http://127.0.0.1:3080', fetchImpl)
    await expect(api.chat(undefined, 'MENSAGEM DO USUÁRIO:\nOlá', 'Teste', new AbortController().signal)).resolves.toMatchObject({
      sessionId: 'chat-1',
      text: 'Olá!',
      messages: [{ role: 'user', text: 'Olá', seq: 1 }, { role: 'assistant', text: 'Olá!', seq: 2 }],
    })
  })

  it('uploads a selected document to Curupira Memory', async () => {
    const fetchImpl = vi.fn(async (_url, init) => {
      const request = JSON.parse(init.body)
      expect(request.method).toBe('knowledge.ingest')
      expect(request.payload).toEqual({ name: 'notas.md', data: 'IyBOb3Rhcw==', format: 'md' })
      return new Response(JSON.stringify({ result: { ok: true, value: {
        id: 'doc-1', name: 'notas.md', passageCount: 1, alreadyPresent: false,
        extractor: 'text', text: '# Notas', truncated: false,
      } } }), { status: 200 })
    })
    const api = new CurupiraApi('http://127.0.0.1:3080', fetchImpl)
    await expect(api.ingestDocument({ name: 'notas.md', data: 'IyBOb3Rhcw==', format: 'md' }))
      .resolves.toMatchObject({ id: 'doc-1', text: '# Notas' })
  })
})
