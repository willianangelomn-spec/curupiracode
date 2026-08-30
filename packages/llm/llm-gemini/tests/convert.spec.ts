import { describe, expect, it } from 'vitest'
import type { GenerateOptions, Message } from '@deepseek-ai/dsh-llm'
import { buildRequestBody, effortToBudget, GeminiStreamConverter } from '../src/convert.ts'
import { GEMINI_MODELS, modelById } from '../src/models.ts'

function userMessage(text: string): Message {
  return {
    id: `u-${text}` as Message['id'],
    role: 'user',
    content: [{ type: 'text', text }],
    source: { kind: 'user' },
  } as unknown as Message
}

function assistantToolCall(): Message {
  return {
    id: 'a1' as Message['id'],
    role: 'assistant',
    content: [{ type: 'tool-call', id: 'c1' as never, name: 'getWeather', arguments: '{"city":"Paris"}' }],
    source: { kind: 'model', provider: 'gemini', model: 'gemini-2.5-flash' },
  } as unknown as Message
}

function toolResult(): Message {
  return {
    id: 't1' as Message['id'],
    role: 'user',
    content: [{ type: 'tool-result', toolCallId: 'c1' as never, content: [{ type: 'text', text: 'sunny' }], isError: false }],
    source: { kind: 'tool', callId: 'c1' as never },
  } as unknown as Message
}

function baseOptions(messages: Message[]): GenerateOptions {
  return {
    provider: 'gemini',
    model: 'gemini-2.5-flash',
    messages,
  } as GenerateOptions
}

describe('catalog', () => {
  it('lists curated models with context windows', () => {
    expect(GEMINI_MODELS.length).toBeGreaterThan(0)
    expect(modelById('gemini-2.5-flash')?.contextWindow).toBe(1_048_576)
    expect(modelById('gemini-2.5-pro')?.reasoning).toBe(true)
  })
})

describe('effortToBudget', () => {
  it('returns undefined for non-reasoning models', () => {
    expect(effortToBudget('high', false)).toBeUndefined()
  })
  it('returns undefined when off or absent', () => {
    expect(effortToBudget('off', true)).toBeUndefined()
    expect(effortToBudget(undefined, true)).toBeUndefined()
  })
  it('maps levels to budgets', () => {
    expect(effortToBudget('low' as never, true)).toBe(2048)
    expect(effortToBudget('high' as never, true)).toBe(24576)
  })
})

describe('buildRequestBody', () => {
  it('serializes a user message into Gemini contents', () => {
    const body = buildRequestBody(baseOptions([userMessage('hello')]), undefined)
    expect(body.contents).toHaveLength(1)
    expect(body.contents[0]?.role).toBe('user')
    expect(body.contents[0]?.parts).toEqual([{ text: 'hello' }])
  })

  it('correlates a tool call with its result by id', () => {
    const body = buildRequestBody(baseOptions([assistantToolCall(), toolResult()]), undefined)
    const assistant = body.contents.find(c => c.role === 'model')
    const user = body.contents.find(c => c.role === 'user' && c.parts.some(p => p.functionResponse))
    expect(assistant?.parts[0]?.functionCall?.name).toBe('getWeather')
    expect(user?.parts[0]?.functionResponse?.name).toBe('getWeather')
    expect((user?.parts[0]?.functionResponse?.response as { result: string }).result).toBe('sunny')
  })

  it('adds a thinking config when a budget is supplied', () => {
    const body = buildRequestBody(baseOptions([userMessage('think')]), 8192)
    expect(body.generationConfig.thinkingConfig).toEqual({ thinkingBudget: 8192, includeThoughts: true })
  })

  it('omits thinking config when no budget', () => {
    const body = buildRequestBody(baseOptions([userMessage('go')]), undefined)
    expect(body.generationConfig.thinkingConfig).toBeUndefined()
  })

  it('serializes tool schemas', () => {
    const options = baseOptions([userMessage('use a tool')])
    options.tools = [{ name: 'ping', description: 'ping', parameters: { type: 'object' } }]
    const body = buildRequestBody(options, undefined)
    expect(body.tools?.[0]?.functionDeclarations[0]?.name).toBe('ping')
  })
})

describe('GeminiStreamConverter', () => {
  it('emits text, usage, and a stop finish from streamed parts', () => {
    const converter = new GeminiStreamConverter()
    const first = converter.push({
      candidates: [{ content: { parts: [{ text: 'Hello' }] } }],
    })
    // block-start, text-delta, block-end
    expect(first.filter(c => c.type === 'text-delta').map(c => (c as { text: string }).text)).toEqual(['Hello'])

    const second = converter.push({
      candidates: [{ content: { parts: [{ text: ' world' }] }, finishReason: 'STOP' }],
      usageMetadata: { promptTokenCount: 3, candidatesTokenCount: 5 },
    })
    expect(second.find(c => c.type === 'usage')).toBeDefined()
    const finish = converter.finish().find(c => c.type === 'finish')
    expect(finish).toBeDefined()
    expect((finish as { reason: { kind: string } }).reason.kind).toBe('stop')
  })

  it('emits a tool-call block and a tool-calls finish', () => {
    const converter = new GeminiStreamConverter()
    converter.push({
      candidates: [{
        content: { parts: [{ functionCall: { name: 'getWeather', args: { city: 'Paris' } } }] },
        finishReason: 'STOP',
      }],
    })
    const finish = converter.finish().find(c => c.type === 'finish') as { reason: { kind: string } }
    expect(finish.reason.kind).toBe('tool-calls')
  })

  it('emits a reasoning block for thought parts', () => {
    const converter = new GeminiStreamConverter()
    const chunks = converter.push({
      candidates: [{ content: { parts: [{ thought: true, text: 'hmm' }] } }],
    })
    expect(chunks.some(c => c.type === 'reasoning-delta')).toBe(true)
    expect(chunks.some(c => c.type === 'block-end' && (c as { block: { type: string } }).block.type === 'reasoning')).toBe(true)
  })
})
