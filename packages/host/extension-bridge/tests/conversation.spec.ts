import type { SessionEvent } from '@deepseek-ai/dsh-session'
import { describe, expect, it } from 'vitest'
import { conversationMessages, replyState } from '../src/conversation.ts'

let seq = 0
function event(type: string, data: object): SessionEvent {
  seq += 1
  return { type, seq, time: seq, data } as SessionEvent
}

const prompt = (requestId: string, text: string): SessionEvent =>
  event('user/message', { id: `u-${requestId}`, role: 'user', content: [{ type: 'text', text }], source: { kind: 'user', rpcId: requestId } })
const assistant = (text: string): SessionEvent =>
  event('assistant/message', { turn: 1, step: 0, stream: [], message: { id: `a-${String(seq)}`, role: 'assistant', source: { kind: 'model' }, content: [{ type: 'reasoning', text: 'hidden' }, { type: 'text', text }] } })
const turnEnd = (reason: object): SessionEvent => event('turn/end', { turn: 1, reason })

describe('reply state of one prompt', () => {
  it('is queued until the prompt enters and running until its turn ends', () => {
    const events = [event('turn/start', { turn: 1 }), prompt('other-request', 'Outro')]
    expect(replyState(events, 'request-1')).toEqual({ state: 'queued' })
    expect(replyState([...events, prompt('request-1', 'Olá')], 'request-1')).toEqual({ state: 'running' })
  })

  it('reports the last non-empty assistant text of the ending turn', () => {
    const events = [
      prompt('earlier-request', 'Antes'), assistant('Resposta antiga'), turnEnd({ kind: 'completed' }),
      prompt('request-1', 'Olá'), event('step/start', { turn: 2, step: 0 }), assistant('Primeiro passo'), assistant(''), assistant('Olá!'), turnEnd({ kind: 'completed' }),
      prompt('request-2', 'Depois'), assistant('Resposta posterior'),
    ]
    expect(replyState(events, 'request-1')).toEqual({ state: 'completed', text: 'Olá!' })
    expect(replyState([prompt('request-3', 'Longo'), assistant('Corte'), turnEnd({ kind: 'max-tokens' })], 'request-3'))
      .toEqual({ state: 'completed', text: 'Corte' })
  })

  it('distinguishes cancellation, provider errors, and other turn endings', () => {
    expect(replyState([prompt('request-1', 'Olá'), assistant('Parcial'), turnEnd({ kind: 'aborted', reason: { kind: 'user' } })], 'request-1'))
      .toEqual({ state: 'cancelled', text: 'Parcial' })
    expect(replyState([prompt('request-1', 'Olá'), turnEnd({ kind: 'error', error: { message: 'chave inválida', code: 'AUTH' } })], 'request-1'))
      .toEqual({ state: 'failed', text: '', reason: 'error', message: 'chave inválida' })
    expect(replyState([prompt('request-1', 'Olá'), turnEnd({ kind: 'blocked' })], 'request-1'))
      .toEqual({ state: 'failed', text: '', reason: 'blocked', message: 'the turn ended: blocked' })
  })

  it('matches only direct human prompts carrying the request id', () => {
    const injected = event('user/message', { id: 'ctx', role: 'user', content: [{ type: 'text', text: 'ctx' }], source: { kind: 'skill' } })
    const plain = event('user/message', { id: 'plain', role: 'user', content: [{ type: 'text', text: 'plain' }], source: { kind: 'user' } })
    expect(replyState([injected, plain], 'request-1')).toEqual({ state: 'queued' })
  })
})

describe('conversation messages', () => {
  it('keeps human prompts and assistant text, oldest first, bounded to the latest messages', () => {
    const injected = event('user/message', { id: 'ctx', role: 'user', content: [{ type: 'text', text: 'injected context' }], source: { kind: 'skill' } })
    const imageOnly = event('user/message', { id: 'img', role: 'user', content: [{ type: 'image', mediaType: 'image/png' }], source: { kind: 'user' } })
    const first = prompt('request-1', '  Primeira  ')
    const reply = assistant('Resposta')
    const second = prompt('request-2', 'Segunda')
    const events = [injected, imageOnly, first, assistant(''), reply, turnEnd({ kind: 'completed' }), second]
    expect(conversationMessages(events, 10)).toEqual([
      { seq: first.seq, role: 'user', text: 'Primeira' },
      { seq: reply.seq, role: 'assistant', text: 'Resposta' },
      { seq: second.seq, role: 'user', text: 'Segunda' },
    ])
    expect(conversationMessages(events, 2).map(message => message.text)).toEqual(['Resposta', 'Segunda'])
  })
})
