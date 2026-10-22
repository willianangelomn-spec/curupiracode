/** Transcript entries, editor context, and model choices the panel derives from runtime events and settings. */
import { describe, expect, it } from 'vitest'
import { chatItemOf, MAX_EDITOR_CONTEXT_CHARS, MODEL_CHOICES, modelChoices, routeOf, withEditorContext } from '../src/conversation.ts'

describe('chatItemOf', () => {
  it('shows assistant text, tool calls, and failed or cut turns', () => {
    expect(chatItemOf({ type: 'assistant/message', data: { message: { content: [{ type: 'text', text: 'Olá' }, { type: 'reasoning', text: 'x' }] } } }))
      .toEqual({ kind: 'assistant', text: 'Olá' })
    expect(chatItemOf({ type: 'tool/call', data: { name: 'read' } })).toEqual({ kind: 'tool', name: 'read' })
    expect(chatItemOf({ type: 'turn/end', data: { reason: { kind: 'error', error: { message: 'agy falhou' } } } }))
      .toEqual({ kind: 'error', text: 'agy falhou' })
    expect(chatItemOf({ type: 'turn/end', data: { reason: { kind: 'max-tokens' } } })?.kind).toBe('notice')
  })

  it('skips events the panel does not show', () => {
    expect(chatItemOf({ type: 'user/message', data: {} })).toBeUndefined()
    expect(chatItemOf({ type: 'turn/end', data: { reason: { kind: 'completed' } } })).toBeUndefined()
    expect(chatItemOf({ type: 'assistant/message', data: { message: { content: [{ type: 'tool-call' }] } } })).toBeUndefined()
  })
})

describe('withEditorContext', () => {
  it('fences a selection with its path, lines, and language', () => {
    expect(withEditorContext('Explique.', { path: 'src/a.ts', languageId: 'typescript', text: 'const a = 1', startLine: 3, endLine: 3, selection: true }))
      .toBe('Explique.\n\nContexto do editor (linhas 3–3 de src/a.ts):\n```typescript\nconst a = 1\n```')
  })

  it('switches fences around fenced text and truncates long files', () => {
    const message = withEditorContext('Resuma.', {
      path: 'README.md', languageId: 'markdown', text: '```\n'.padEnd(MAX_EDITOR_CONTEXT_CHARS + 10, 'x'), startLine: 1, endLine: 9, selection: false,
    })
    expect(message).toContain('Contexto do editor (arquivo README.md, truncado):\n~~~~markdown\n')
    expect(message.endsWith('\n~~~~')).toBe(true)
    expect(message.length).toBeLessThan(MAX_EDITOR_CONTEXT_CHARS + 200)
  })
})

describe('model routes', () => {
  it('splits provider and model and keeps a custom setting selectable', () => {
    expect(routeOf('gemini/gemini-4-argon-low')).toEqual({ provider: 'gemini', model: 'gemini-4-argon-low' })
    expect(routeOf('gemini')).toBeUndefined()
    expect(routeOf('/x')).toBeUndefined()
    expect(MODEL_CHOICES[0]?.id).toBe('gemini/gemini-4-argon-low')
    expect(modelChoices('gemini/gemini-4-argon-low')).toBe(MODEL_CHOICES)
    expect(modelChoices('gemini/custom-1').at(-1)).toEqual({ id: 'gemini/custom-1', label: 'gemini/custom-1' })
  })
})
