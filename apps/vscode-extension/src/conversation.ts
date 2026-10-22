/**
 * What the chat panel shows for runtime events, and the editor context a
 * message can carry. Pure functions, so the panel and the tests share them.
 */

import type { RuntimeRoute, RuntimeSessionEvent } from './runtime.ts'

/** One entry of the chat transcript. */
export type ChatItem =
  | { readonly kind: 'user'; readonly text: string }
  | { readonly kind: 'assistant'; readonly text: string }
  | { readonly kind: 'tool'; readonly name: string }
  | { readonly kind: 'notice'; readonly text: string }
  | { readonly kind: 'error'; readonly text: string }

/** Text of the text blocks of one message content array. */
function textOf(content: unknown): string {
  if (!Array.isArray(content)) return ''
  return content
    .filter((block): block is { type: 'text'; text: string } =>
      typeof block === 'object' && block !== null && (block as { type?: unknown }).type === 'text'
      && typeof (block as { text?: unknown }).text === 'string')
    .map(block => block.text)
    .join('')
    .trim()
}

/**
 * Map one session event to the transcript entry it shows, if any.
 * The panel adds the user's own messages when it sends them, so `user/message`
 * events are not repeated here.
 * @param event - one durable session event.
 * @returns the entry, or undefined for events the panel does not show.
 */
export function chatItemOf(event: RuntimeSessionEvent): ChatItem | undefined {
  const data = event.data as Record<string, unknown> | undefined
  switch (event.type) {
    case 'assistant/message': {
      const text = textOf((data?.message as { content?: unknown } | undefined)?.content)
      return text === '' ? undefined : { kind: 'assistant', text }
    }
    case 'tool/call':
      return typeof data?.name === 'string' ? { kind: 'tool', name: data.name } : undefined
    case 'turn/end': {
      const reason = data?.reason as { kind?: unknown; error?: { message?: unknown } } | undefined
      if (reason?.kind === 'error') {
        return { kind: 'error', text: typeof reason.error?.message === 'string' ? reason.error.message : 'A resposta falhou.' }
      }
      if (reason?.kind === 'aborted') return { kind: 'notice', text: 'Resposta interrompida.' }
      if (reason?.kind === 'max-tokens') return { kind: 'notice', text: 'A resposta atingiu o limite de tokens.' }
      return undefined
    }
    default:
      return undefined
  }
}

/** Upper bound on the editor text one message carries. */
export const MAX_EDITOR_CONTEXT_CHARS = 60_000

/** The active editor's text the user chose to send. */
export interface EditorContext {
  /** Path relative to the workspace, or the file name outside it. */
  readonly path: string
  readonly languageId: string
  readonly text: string
  /** 1-based first and last line of `text`. */
  readonly startLine: number
  readonly endLine: number
  /** Whether `text` is a selection rather than the whole file. */
  readonly selection: boolean
}

/**
 * Prefix a message with the editor text it is about, bounded and fenced.
 * @param message - what the user typed.
 * @param context - the active editor's file or selection.
 * @returns the message text the runtime receives.
 */
export function withEditorContext(message: string, context: EditorContext): string {
  const truncated = context.text.length > MAX_EDITOR_CONTEXT_CHARS
  const text = truncated ? context.text.slice(0, MAX_EDITOR_CONTEXT_CHARS) : context.text
  const fence = text.includes('```') ? '~~~~' : '```'
  const scope = context.selection ? `linhas ${String(context.startLine)}–${String(context.endLine)} de` : 'arquivo'
  return [
    message,
    '',
    `Contexto do editor (${scope} ${context.path}${truncated ? ', truncado' : ''}):`,
    `${fence}${context.languageId}`,
    text,
    fence,
  ].join('\n')
}

/** One model the panel offers. */
export interface ModelChoice {
  /** `provider/model`, the form the `curupiracode.model` setting stores. */
  readonly id: string
  readonly label: string
}

/** Models offered in the panel; any other `provider/model` from the setting is added to the list. */
export const MODEL_CHOICES: readonly ModelChoice[] = [
  { id: 'gemini/gemini-4-argon-low', label: 'Gemini 4 Argon (Low)' },
  { id: 'gemini/gemini-4-argon-medium', label: 'Gemini 4 Argon (Medium)' },
  { id: 'gemini/gemini-4-argon-high', label: 'Gemini 4 Argon (High)' },
  { id: 'gemini/gemini-3.8-flash-low', label: 'Gemini 3.8 Flash (Low)' },
  { id: 'gemini/gemini-3.8-flash-medium', label: 'Gemini 3.8 Flash (Medium)' },
  { id: 'gemini/gemini-3.8-flash-high', label: 'Gemini 3.8 Flash (High)' },
  { id: 'gemini/claude-sonnet-5-5-medium', label: 'Claude Sonnet 5.5 (Medium) · Antigravity' },
  { id: 'gemini/claude-opus-5-5-medium', label: 'Claude Opus 5.5 (Medium) · Antigravity' },
  { id: 'deepseek-official/deepseek-v4-flash', label: 'DeepSeek V4 Flash · chave de API' },
  { id: 'deepseek-official/deepseek-v4-pro', label: 'DeepSeek V4 Pro · chave de API' },
]

/**
 * Split a `provider/model` setting value.
 * @param id - setting value.
 * @returns the route, or undefined when the value names no provider and model.
 */
export function routeOf(id: string): RuntimeRoute | undefined {
  const slash = id.indexOf('/')
  if (slash <= 0 || slash === id.length - 1) return undefined
  return { provider: id.slice(0, slash), model: id.slice(slash + 1) }
}

/**
 * The panel's model list for the current setting.
 * @param selected - current `provider/model` setting value.
 * @returns the shipped choices, plus the selected value when it is not among them.
 */
export function modelChoices(selected: string): readonly ModelChoice[] {
  return MODEL_CHOICES.some(choice => choice.id === selected) || routeOf(selected) === undefined
    ? MODEL_CHOICES
    : [...MODEL_CHOICES, { id: selected, label: selected }]
}
