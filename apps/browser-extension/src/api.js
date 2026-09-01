const DEFAULT_BASE_URL = 'http://127.0.0.1:3080'

function normalizeBaseUrl(value) {
  const url = new URL(value || DEFAULT_BASE_URL)
  if (url.protocol !== 'http:' || (url.hostname !== '127.0.0.1' && url.hostname !== 'localhost')) {
    throw new Error('Use apenas o endereço local http://127.0.0.1 ou http://localhost.')
  }
  url.pathname = ''
  url.search = ''
  url.hash = ''
  return url.toString().replace(/\/$/, '')
}

function messageText(message) {
  const content = message?.content
  if (!Array.isArray(content)) return ''
  return content.filter(block => block?.type === 'text' && typeof block.text === 'string').map(block => block.text).join('\n').trim()
}

function eventSeq(item, fallback = -1) {
  return typeof item?.event?.seq === 'number' ? item.event.seq : fallback
}

function assistantText(page, afterSeq = -1) {
  for (let index = page.events.length - 1; index >= 0; index -= 1) {
    const item = page.events[index]
    if (eventSeq(item, index) <= afterSeq) continue
    const event = item?.event
    if (event?.type !== 'assistant/message') continue
    const text = messageText(event.data?.message)
    if (text !== '') return text
  }
  return undefined
}

function visibleUserText(text) {
  const prefix = 'MENSAGEM DO USUÁRIO:\n'
  if (!text.startsWith(prefix)) return text
  const withoutPrefix = text.slice(prefix.length)
  return withoutPrefix.split(/\n\nCONTEXTO (?:DA PÁGINA|DOS ARQUIVOS)/)[0].trim()
}

/** Project durable session history into the plain conversation shown by the extension. */
export function messagesFromHistory(page) {
  const messages = []
  for (const item of page?.events ?? []) {
    const event = item?.event
    if (event?.type === 'user/message' && event.data?.source?.kind === 'user') {
      const text = visibleUserText(messageText(event.data))
      if (text !== '') messages.push({ role: 'user', text, seq: eventSeq(item, messages.length) })
    } else if (event?.type === 'assistant/message') {
      const text = messageText(event.data?.message)
      if (text !== '') messages.push({ role: 'assistant', text, seq: eventSeq(item, messages.length) })
    }
  }
  return messages
}

export class CurupiraApi {
  constructor(baseUrl = DEFAULT_BASE_URL, fetchImpl = (...args) => globalThis.fetch(...args)) {
    this.baseUrl = normalizeBaseUrl(baseUrl)
    this.fetchImpl = fetchImpl
  }

  async call(method, payload, signal) {
    const response = await this.fetchImpl(`${this.baseUrl}/api/${method}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        type: 'client-request',
        rpcId: crypto.randomUUID(),
        method,
        payload,
      }),
      signal,
    })
    if (!response.ok) throw new Error(`CurupiraCode respondeu HTTP ${response.status}.`)
    const envelope = await response.json()
    if (envelope?.result?.ok !== true) {
      const error = envelope?.result?.error
      throw new Error(error?.message || `Falha em ${method}.`)
    }
    return envelope.result.value
  }

  async ping(signal) {
    return await this.call('host.describe', {}, signal)
  }

  async waitForTurn(sessionId, afterSeq, signal) {
    const deadline = Date.now() + 180000
    while (Date.now() < deadline) {
      signal?.throwIfAborted()
      const page = await this.call('session.history', { sessionId, maxMessages: 100 }, signal)
      const text = assistantText(page, afterSeq)
      const ended = page.events.some((item, index) => eventSeq(item, index) > afterSeq && item.event?.type === 'turn/end')
      if (text !== undefined && ended) return { text, page }
      await new Promise((resolve, reject) => {
        const onAbort = () => {
          clearTimeout(timer)
          reject(signal.reason)
        }
        const timer = setTimeout(() => {
          signal?.removeEventListener('abort', onAbort)
          resolve()
        }, 900)
        signal?.addEventListener('abort', onAbort, { once: true })
      })
    }
    await this.call('session.cancel', { sessionId }).catch(() => undefined)
    throw new Error('O Curupira demorou mais de três minutos para responder.')
  }

  async prompt(sessionId, content, signal) {
    const before = await this.call('session.history', { sessionId, maxMessages: 1 }, signal)
    const afterSeq = before.events.reduce((max, item, index) => Math.max(max, eventSeq(item, index)), -1)
    await this.call('session.prompt', {
      sessionId,
      mode: 'queue',
      content: typeof content === 'string' ? [{ type: 'text', text: content }] : content,
      clientTimeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    }, signal)
    return await this.waitForTurn(sessionId, afterSeq, signal)
  }

  async history(sessionId, signal) {
    const page = await this.call('session.history', { sessionId, maxMessages: 100 }, signal)
    return messagesFromHistory(page)
  }

  async chat(sessionId, content, title, signal) {
    let activeSessionId = sessionId
    if (!activeSessionId) {
      const created = await this.call('session.create', { agentPreset: 'browser-chat' }, signal)
      activeSessionId = created.sessionId
      await this.call('session.rename', { sessionId: activeSessionId, title: `Chat no navegador: ${title.slice(0, 70)}` }, signal)
    }
    try {
      const response = await this.prompt(activeSessionId, content, signal)
      return { sessionId: activeSessionId, text: response.text, messages: messagesFromHistory(response.page) }
    } catch (error) {
      if (signal?.aborted) await this.call('session.cancel', { sessionId: activeSessionId }).catch(() => undefined)
      throw error
    }
  }

  async ingestDocument({ name, data, format }, signal) {
    return await this.call('knowledge.ingest', {
      name,
      data,
      ...(format ? { format } : {}),
    }, signal)
  }

  async plan(prompt, title, signal) {
    const created = await this.call('session.create', { agentPreset: 'browser' }, signal)
    const sessionId = created.sessionId
    await this.call('session.rename', { sessionId, title: `Navegador: ${title.slice(0, 80)}` }, signal)
    try {
      const response = await this.prompt(sessionId, prompt, signal)
      return { sessionId, text: response.text }
    } catch (error) {
      if (signal?.aborted) await this.call('session.cancel', { sessionId }).catch(() => undefined)
      throw error
    }
  }
}

export { DEFAULT_BASE_URL, normalizeBaseUrl }
