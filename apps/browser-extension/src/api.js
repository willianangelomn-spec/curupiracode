const DEFAULT_BASE_URL = 'http://127.0.0.1:3080'
const BRIDGE_PATH = '/extension-bridge'
const PAIRING_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/
const REPLY_POLL_MS = 900
const REPLY_DEADLINE_MS = 180000

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

/** Validate a pairing code copied from the CurupiraCode pairing page. */
function normalizePairingToken(value) {
  const token = String(value ?? '').trim()
  if (!PAIRING_TOKEN_PATTERN.test(token)) {
    throw new Error('Cole o código de pareamento de 43 caracteres mostrado pelo CurupiraCode.')
  }
  return token
}

/** Pairing page the user opens in a normal tab while signed in to CurupiraCode. */
function pairingPageUrl(baseUrl) {
  return `${normalizeBaseUrl(baseUrl)}${BRIDGE_PATH}/pair`
}

function visibleUserText(text) {
  const prefix = 'MENSAGEM DO USUÁRIO:\n'
  if (!text.startsWith(prefix)) return text
  const withoutPrefix = text.slice(prefix.length)
  return withoutPrefix.split(/\n\nCONTEXTO (?:DA PÁGINA|DOS ARQUIVOS)/)[0].trim()
}

/** Project bridge messages into the plain conversation shown by the extension, hiding the page wrapper. */
export function messagesFromHistory(value) {
  const messages = []
  for (const message of value?.messages ?? []) {
    const text = message.role === 'user' ? visibleUserText(message.text) : message.text
    if (text !== '') messages.push({ role: message.role, text, seq: message.seq })
  }
  return messages
}

/** Failure reported by the CurupiraCode bridge, with its HTTP status and stable code. */
export class CurupiraApiError extends Error {
  constructor(message, status, code) {
    super(message)
    this.name = 'CurupiraApiError'
    this.status = status
    this.code = code
  }
}

function failureMessage(status, body) {
  if (status === 401) return 'Pareamento necessário: abra «Conexão local», clique em Parear e cole o código mostrado pelo CurupiraCode.'
  if (status === 403 && body?.error?.code === 'extension-bridge/forbidden') {
    return 'O CurupiraCode recusou esta extensão. Use o endereço local (127.0.0.1 ou localhost) e pareie de novo.'
  }
  return body?.error?.message || `CurupiraCode respondeu HTTP ${status}.`
}

function sleep(ms, signal) {
  return new Promise((resolve, reject) => {
    const onAbort = () => {
      clearTimeout(timer)
      reject(signal.reason)
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort)
      resolve()
    }, ms)
    signal?.addEventListener('abort', onAbort, { once: true })
  })
}

export class CurupiraApi {
  constructor(baseUrl = DEFAULT_BASE_URL, token = undefined, fetchImpl = (...args) => globalThis.fetch(...args)) {
    this.baseUrl = normalizeBaseUrl(baseUrl)
    this.token = token
    this.fetchImpl = fetchImpl
  }

  async call(endpoint, payload, signal) {
    if (!this.token) throw new CurupiraApiError(failureMessage(401), 401, 'extension-bridge/unauthorized')
    const response = await this.fetchImpl(`${this.baseUrl}${BRIDGE_PATH}/v1/${endpoint}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${this.token}` },
      body: JSON.stringify(payload),
      signal,
    })
    let body
    try {
      body = await response.json()
    } catch {
      // A body that is not JSON carries no bridge error code; the status alone describes it.
      body = undefined
    }
    if (!response.ok) throw new CurupiraApiError(failureMessage(response.status, body), response.status, body?.error?.code)
    return body
  }

  async ping(signal) {
    return await this.call('status', {}, signal)
  }

  async waitForReply(sessionId, requestId, signal) {
    const deadline = Date.now() + REPLY_DEADLINE_MS
    while (Date.now() < deadline) {
      signal?.throwIfAborted()
      const reply = await this.call('sessions/reply', { sessionId, requestId }, signal)
      if (reply.state === 'completed') {
        if (reply.text === '') throw new Error('O Curupira terminou o turno sem responder.')
        return reply.text
      }
      if (reply.state === 'cancelled') throw new Error('A resposta foi cancelada no CurupiraCode.')
      if (reply.state === 'failed') throw new Error(`O Curupira não conseguiu responder: ${reply.message}`)
      await sleep(REPLY_POLL_MS, signal)
    }
    await this.call('sessions/cancel', { sessionId }).catch(() => undefined)
    throw new Error('O Curupira demorou mais de três minutos para responder.')
  }

  async prompt(sessionId, content, signal) {
    const requestId = crypto.randomUUID()
    await this.call('sessions/prompt', {
      sessionId,
      requestId,
      content: typeof content === 'string' ? [{ type: 'text', text: content }] : content,
      clientTimeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    }, signal)
    return { text: await this.waitForReply(sessionId, requestId, signal) }
  }

  async history(sessionId, signal) {
    return messagesFromHistory(await this.call('sessions/messages', { sessionId }, signal))
  }

  async createSession(agentPreset, title, signal) {
    const created = await this.call('sessions/create', { agentPreset, title }, signal)
    return created.sessionId
  }

  async chat(sessionId, content, title, signal) {
    const activeSessionId = sessionId || await this.createSession('browser-chat', `Chat no navegador: ${title.slice(0, 70)}`, signal)
    try {
      const response = await this.prompt(activeSessionId, content, signal)
      return { sessionId: activeSessionId, text: response.text, messages: await this.history(activeSessionId, signal) }
    } catch (error) {
      if (signal?.aborted) await this.call('sessions/cancel', { sessionId: activeSessionId }).catch(() => undefined)
      throw error
    }
  }

  async ingestDocument({ name, data, format }, signal) {
    return await this.call('knowledge/ingest', {
      name,
      data,
      ...(format ? { format } : {}),
    }, signal)
  }

  async plan(prompt, title, signal) {
    const sessionId = await this.createSession('browser', `Navegador: ${title.slice(0, 80)}`, signal)
    try {
      const response = await this.prompt(sessionId, prompt, signal)
      return { sessionId, text: response.text }
    } catch (error) {
      if (signal?.aborted) await this.call('sessions/cancel', { sessionId }).catch(() => undefined)
      throw error
    }
  }
}

export { DEFAULT_BASE_URL, normalizeBaseUrl, normalizePairingToken, pairingPageUrl }
