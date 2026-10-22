/**
 * Pure projections of one Session's events into what the extension renders:
 * the state of one prompt's reply and the plain human/assistant transcript.
 * Only direct human prompts (`source.kind === 'user'`) count as user
 * messages; injected context and other producers' user-role messages stay out.
 */

import type { ContentBlock, MessageSource } from '@deepseek-ai/dsh-llm'
import type { SessionEvent } from '@deepseek-ai/dsh-session'
import type {} from '@deepseek-ai/dsh-api-session-controller/types'
import type { ExtensionMessage, ExtensionSessionReplyValue } from './types.ts'

function textOf(content: readonly ContentBlock[]): string {
  return content.flatMap(block => block.type === 'text' ? [block.text] : []).join('\n').trim()
}

function isPromptOf(source: MessageSource, requestId: string): boolean {
  return source.kind === 'user' && 'rpcId' in source && source.rpcId === requestId
}

/**
 * Locate the turn one prompt entered and report how it ended.
 * @param events - the Session's events in sequence order.
 * @param requestId - the extension-minted id the prompt was admitted under.
 * @returns `queued` before the prompt enters a turn, `running` until that turn ends, then its outcome and last assistant text.
 */
export function replyState(events: readonly SessionEvent[], requestId: string): ExtensionSessionReplyValue {
  const start = events.findIndex(event => event.type === 'user/message' && isPromptOf(event.data.source, requestId))
  if (start === -1) return { state: 'queued' }
  let text = ''
  for (const event of events.slice(start + 1)) {
    if (event.type === 'assistant/message') {
      const assistant = textOf(event.data.message.content)
      if (assistant !== '') text = assistant
      continue
    }
    if (event.type !== 'turn/end') continue
    const { reason } = event.data
    switch (reason.kind) {
      case 'completed':
      case 'max-tokens':
        return { state: 'completed', text }
      case 'aborted':
        return { state: 'cancelled', text }
      case 'error':
        return { state: 'failed', text, reason: reason.kind, message: reason.error.message }
      default:
        // Merge-extensible reasons (blocked, interrupted, forked, plugin kinds) end the turn without a reply.
        return { state: 'failed', text, reason: reason.kind, message: `the turn ended: ${reason.kind}` }
    }
  }
  return { state: 'running' }
}

/**
 * Project the human prompts and assistant messages of a Session.
 * @param events - the Session's events in sequence order.
 * @param limit - positive maximum number of messages returned.
 * @returns the latest `limit` non-empty messages, oldest first.
 */
export function conversationMessages(events: readonly SessionEvent[], limit: number): ExtensionMessage[] {
  const messages: ExtensionMessage[] = []
  for (const event of events) {
    if (event.type === 'user/message' && event.data.source.kind === 'user') {
      const text = textOf(event.data.content)
      if (text !== '') messages.push({ seq: event.seq, role: 'user', text })
    } else if (event.type === 'assistant/message') {
      const text = textOf(event.data.message.content)
      if (text !== '') messages.push({ seq: event.seq, role: 'assistant', text })
    }
  }
  return messages.slice(-limit)
}
