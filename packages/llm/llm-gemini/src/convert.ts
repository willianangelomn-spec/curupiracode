/**
 * Translation between the harness provider-neutral request/stream vocabulary and
 * Gemini's `generateContent` wire format. Request building walks the harness
 * messages into Gemini `contents`; streaming walks each SSE chunk's parts into
 * provider-neutral blocks, and the converter tracks the running block index so
 * deltas and ends stay correlated.
 *
 * @module dsh-llm-gemini/convert
 */

import type {
  CallId,
  ContentBlock,
  FinishReason,
  GenerateOptions,
  ReasoningEffortId,
  StreamChunk,
  ToolSchema,
} from '@deepseek-ai/dsh-llm'
import { LlmError } from '@deepseek-ai/dsh-llm'
import type { GeminiBudget } from './types.ts'

/** One Gemini content part; `thought` marks a reasoning (thinking) part. */
interface GeminiPart {
  text?: string
  thought?: boolean
  functionCall?: { name: string; args: unknown }
  functionResponse?: { name: string; response: unknown }
}

/** One Gemini message in `contents`. */
interface GeminiContent {
  role: 'user' | 'model'
  parts: GeminiPart[]
}

/** One tool declaration handed to Gemini's `tools`. */
interface GeminiFunctionDecl {
  name: string
  description: string
  parameters: Record<string, unknown>
}

/** A complete Gemini `streamGenerateContent` request body. */
export interface GeminiRequest {
  systemInstruction?: { parts: { text: string }[] }
  contents: GeminiContent[]
  tools?: { functionDeclarations: GeminiFunctionDecl[] }[]
  generationConfig: {
    temperature?: number
    maxOutputTokens?: number
    stopSequences?: string[]
    thinkingConfig?: { thinkingBudget: number; includeThoughts: boolean }
  }
}

/** A single streamed Gemini response object (one SSE `data:` payload). */
interface GeminiResponse {
  candidates?: { content?: { parts?: GeminiPart[] }; finishReason?: string }[]
  usageMetadata?: {
    promptTokenCount?: number
    candidatesTokenCount?: number
    totalTokenCount?: number
  }
}

/** Flatten text-bearing blocks (recursing into tool results) into one string. */
function blockText(blocks: readonly ContentBlock[]): string {
  let out = ''
  for (const block of blocks) {
    if (block.type === 'text' || block.type === 'reasoning') out += block.text
    else if (block.type === 'tool-result') out += blockText(block.content)
  }
  return out
}

/** Translate one harness tool schema into a Gemini function declaration. */
function toolToDecl(tool: ToolSchema): GeminiFunctionDecl {
  return { name: tool.name, description: tool.description, parameters: tool.parameters }
}

/**
 * Map a harness reasoning effort to a Gemini thinking budget. Non-reasoning
 * models and the `off` effort return undefined, which omits `thinkingConfig`
 * entirely so the model uses its own default.
 * @param effort - the requested effort, if any.
 * @param reasoning - whether the model supports reasoning at all.
 * @returns a thinking budget, or undefined to disable thinking.
 */
export function effortToBudget(effort: ReasoningEffortId | undefined, reasoning: boolean): GeminiBudget {
  if (!reasoning) return undefined
  const e = effort as string | undefined
  if (e === undefined || e === 'off') return undefined
  switch (e) {
    case 'low': return 2048
    case 'medium': return 8192
    case 'high': return 24576
    default: return undefined
  }
}

/**
 * Build a Gemini request body from a provider-neutral request. Tool calls and
 * tool results are correlated by `CallId` so a tool result carries the matching
 * function name Gemini requires.
 * @param options - the harness request.
 * @param budget - resolved thinking budget, or undefined to disable thinking.
 * @returns the Gemini request body.
 * @throws {LlmError} code `UNSUPPORTED_CONTENT` when an image block is present (not yet supported).
 */
export function buildRequestBody(options: GenerateOptions, budget: GeminiBudget): GeminiRequest {
  const callNameById = new Map<string, string>()
  const systemParts: { text: string }[] = []
  const contents: GeminiContent[] = []

  for (const message of options.messages) {
    if (message.role === 'system') {
      for (const block of message.content) {
        if (block.type === 'text') systemParts.push({ text: block.text })
      }
      continue
    }
    const role: 'user' | 'model' = message.role === 'assistant' ? 'model' : 'user'
    const parts: GeminiPart[] = []
    for (const block of message.content) {
      switch (block.type) {
        case 'text':
          parts.push({ text: block.text })
          break
        case 'reasoning':
          parts.push({ thought: true, text: block.text })
          break
        case 'image':
          throw new LlmError(`llm-gemini does not support image input yet (model ${options.model})`, 'UNSUPPORTED_CONTENT')
        case 'tool-call': {
          callNameById.set(block.id, block.name)
          let args: unknown = {}
          try {
            args = JSON.parse(block.arguments)
          } catch {
            args = {}
          }
          parts.push({ functionCall: { name: block.name, args } })
          break
        }
        case 'tool-result': {
          const name = callNameById.get(block.toolCallId) ?? 'tool'
          parts.push({ functionResponse: { name, response: { result: blockText(block.content) } } })
          break
        }
      }
    }
    if (parts.length > 0) contents.push({ role, parts })
  }

  const generationConfig: GeminiRequest['generationConfig'] = {}
  if (options.temperature !== undefined) generationConfig.temperature = options.temperature
  if (options.maxTokens !== undefined) generationConfig.maxOutputTokens = options.maxTokens
  if (options.stop !== undefined && options.stop.length > 0) generationConfig.stopSequences = options.stop
  if (budget !== undefined) generationConfig.thinkingConfig = { thinkingBudget: budget, includeThoughts: true }

  const request: GeminiRequest = { contents, generationConfig }
  if (systemParts.length > 0) request.systemInstruction = { parts: systemParts }
  if (options.tools !== undefined && options.tools.length > 0) {
    request.tools = [{ functionDeclarations: options.tools.map(toolToDecl) }]
  }
  return request
}

/**
 * Stateful converter from streamed Gemini responses to provider-neutral chunks.
 * Each streamed part becomes one block; the converter emits the block-start,
 * delta, and block-end for it, then publishes usage and the terminal finish.
 */
export class GeminiStreamConverter {
  private index = 0
  private callSeq = 0
  private sawToolCall = false
  private usage: { inputTokens: number; outputTokens: number } | undefined
  private finishReason: string | undefined
  private raw: unknown[] = []

  /** Convert one streamed Gemini response into chunks (may be empty). */
  push(response: GeminiResponse): StreamChunk[] {
    this.raw.push(response)
    const chunks: StreamChunk[] = []
    const candidate = response.candidates?.[0]
    const parts = candidate?.content?.parts
    if (parts !== undefined) {
      for (const part of parts) {
        if (part.functionCall !== undefined) {
          this.sawToolCall = true
          const id = `gemini-${++this.callSeq}` as CallId
          const args = JSON.stringify(part.functionCall.args ?? {})
          const idx = this.index++
          chunks.push({ type: 'block-start', index: idx, blockType: 'tool-call' })
          chunks.push({ type: 'tool-call-delta', index: idx, id, name: part.functionCall.name, argumentsDelta: args })
          chunks.push({ type: 'block-end', index: idx, block: { type: 'tool-call', id, name: part.functionCall.name, arguments: args } })
        } else if (part.thought === true) {
          const text = part.text ?? ''
          const idx = this.index++
          chunks.push({ type: 'block-start', index: idx, blockType: 'reasoning' })
          if (text.length > 0) chunks.push({ type: 'reasoning-delta', index: idx, text })
          chunks.push({ type: 'block-end', index: idx, block: { type: 'reasoning', text } })
        } else if (part.text !== undefined) {
          const text = part.text
          const idx = this.index++
          chunks.push({ type: 'block-start', index: idx, blockType: 'text' })
          if (text.length > 0) chunks.push({ type: 'text-delta', index: idx, text })
          chunks.push({ type: 'block-end', index: idx, block: { type: 'text', text } })
        }
      }
    }
    if (response.usageMetadata !== undefined) {
      this.usage = {
        inputTokens: response.usageMetadata.promptTokenCount ?? 0,
        outputTokens: response.usageMetadata.candidatesTokenCount ?? 0,
      }
    }
    if (candidate?.finishReason !== undefined) this.finishReason = candidate.finishReason
    return chunks
  }

  /** Emit the trailing usage and finish chunks once the stream ends. */
  finish(): StreamChunk[] {
    const chunks: StreamChunk[] = []
    if (this.usage !== undefined) chunks.push({ type: 'usage', usage: this.usage })
    const reason = this.resolveFinish()
    chunks.push({
      type: 'finish',
      reason,
      replayState: { response: { chunks: this.raw }, blocks: [] },
    })
    return chunks
  }

  private resolveFinish(): FinishReason {
    const fr = this.finishReason
    if (this.sawToolCall) return { kind: 'tool-calls' }
    if (fr === 'MAX_TOKENS') return { kind: 'max-tokens' }
    if (fr === 'SAFETY' || fr === 'RECITATION' || fr === 'OTHER') {
      return { kind: 'error', failure: { message: `Gemini stopped: ${fr ?? 'unknown'}`, code: 'PROVIDER' } }
    }
    return { kind: 'stop' }
  }
}
