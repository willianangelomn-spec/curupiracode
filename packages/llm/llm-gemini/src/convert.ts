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
  ContentBlock,
  FinishReason,
  GenerateOptions,
  ImageAttachmentAccessResolver,
  ReasoningEffortId,
  StreamChunk,
  ToolSchema,
} from '@deepseek-ai/dsh-llm'
import { LlmError, requestImageHandleText, ToolCallId } from '@deepseek-ai/dsh-llm'
import type { AttachmentId, RequestImageAttachment } from '@deepseek-ai/dsh-attachment'
import type { GeminiBudget } from './types.ts'

/** One Gemini content part; `thought` marks a reasoning (thinking) part. */
interface GeminiPart {
  text?: string
  thought?: boolean
  inlineData?: { mimeType: string; data: string }
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

/** Join the text blocks of one message. */
function blockText(blocks: readonly ContentBlock[]): string {
  let out = ''
  for (const block of blocks) {
    if (block.type === 'text') out += block.text
  }
  return out
}

/** Append every retained image in one message as Gemini inline media, each after its handle text. */
function appendImages(
  blocks: readonly ContentBlock[],
  images: ReadonlyMap<AttachmentId, RequestImageAttachment>,
  resolveImageAccess: ImageAttachmentAccessResolver,
  parts: GeminiPart[],
): void {
  for (const block of blocks) {
    if (block.type !== 'image') continue
    const image = images.get(block.attachment.attachmentId)
    if (image === undefined) {
      throw new LlmError(
        `Gemini request image ${block.attachment.attachmentId} was not prepared.`,
        'INVALID_REQUEST',
      )
    }
    parts.push({ text: requestImageHandleText(block.attachment, image, resolveImageAccess(block.attachment)) })
    parts.push({
      inlineData: {
        mimeType: image.mediaType,
        data: Buffer.from(image.data).toString('base64'),
      },
    })
  }
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
 * Build a Gemini request body from a provider-neutral request. Tool-role
 * messages become `functionResponse` parts carrying the function name of the
 * assistant tool call they answer; consecutive results share one user turn,
 * as Gemini expects one response turn per function-call turn. Developer text
 * becomes user-turn text, and tool-change blocks are omitted because every
 * request declares its complete tool set.
 * @param options - the harness request, with offloaded images already projected to text.
 * @param budget - resolved thinking budget, or undefined to disable thinking.
 * @param images - exact request images retained for this call.
 * @param resolveImageAccess - current tool-world path shown beside each image.
 * @returns the Gemini request body.
 */
export function buildRequestBody(
  options: GenerateOptions,
  budget: GeminiBudget,
  images: ReadonlyMap<AttachmentId, RequestImageAttachment> = new Map(),
  resolveImageAccess: ImageAttachmentAccessResolver = () => undefined,
): GeminiRequest {
  const callNameById = new Map<ToolCallId, string>()
  const systemParts: { text: string }[] = []
  if (options.system !== undefined && options.system.length > 0) systemParts.push({ text: options.system })
  const contents: GeminiContent[] = []
  const append = (role: GeminiContent['role'], parts: GeminiPart[], merge: boolean): void => {
    if (parts.length === 0) return
    const last = contents.at(-1)
    if (merge && last?.role === role && last.parts.every(part => part.functionResponse !== undefined)) {
      last.parts.push(...parts)
      return
    }
    contents.push({ role, parts })
  }

  for (const message of options.messages) {
    switch (message.role) {
      case 'system':
        for (const block of message.content) {
          if (block.type === 'text' && block.text.length > 0) systemParts.push({ text: block.text })
        }
        break
      case 'tool': {
        const name = callNameById.get(message.toolCallId) ?? 'tool'
        const result = blockText(message.content)
        const parts: GeminiPart[] = [{
          functionResponse: {
            name,
            response: message.isError === true ? { error: result } : { result },
          },
        }]
        append('user', parts, true)
        const media: GeminiPart[] = []
        appendImages(message.content, images, resolveImageAccess, media)
        append('user', media, false)
        break
      }
      case 'assistant': {
        const parts: GeminiPart[] = []
        for (const block of message.content) {
          switch (block.type) {
            case 'text':
              if (block.text.length > 0) parts.push({ text: block.text })
              break
            case 'reasoning':
              // Gemini cannot accept prior thoughts back as input; they stay in the session log.
              break
            case 'tool-call': {
              callNameById.set(block.id, block.name)
              let args: unknown = {}
              try {
                args = JSON.parse(block.arguments)
              } catch {
                // A malformed argument string still replays as an empty call.
                args = {}
              }
              parts.push({ functionCall: { name: block.name, args } })
              break
            }
            default:
              // Other assistant blocks have no Gemini wire representation.
              break
          }
        }
        append('model', parts, false)
        break
      }
      case 'developer':
      case 'user': {
        const parts: GeminiPart[] = []
        for (const block of message.content) {
          if (block.type === 'text' && block.text.length > 0) parts.push({ text: block.text })
          else if (block.type === 'image') appendImages([block], images, resolveImageAccess, parts)
        }
        append('user', parts, false)
        break
      }
    }
  }

  const generationConfig: GeminiRequest['generationConfig'] = {}
  if (options.temperature !== undefined) generationConfig.temperature = options.temperature
  if (options.maxTokens !== undefined) generationConfig.maxOutputTokens = options.maxTokens
  if (options.stop !== undefined && options.stop.length > 0) generationConfig.stopSequences = options.stop
  if (budget !== undefined) generationConfig.thinkingConfig = { thinkingBudget: budget, includeThoughts: true }

  const request: GeminiRequest = { contents, generationConfig }
  if (systemParts.length > 0) request.systemInstruction = { parts: systemParts }
  const tools = options.tools?.filter(tool => tool.deferLoading !== true) ?? []
  if (tools.length > 0) request.tools = [{ functionDeclarations: tools.map(toolToDecl) }]
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
          const id = ToolCallId(`gemini-${++this.callSeq}`)
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
      return { kind: 'error', failure: { message: `Gemini stopped: ${fr}`, code: 'PROVIDER' } }
    }
    return { kind: 'stop' }
  }
}
