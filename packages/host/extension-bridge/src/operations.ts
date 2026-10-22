/**
 * The fixed `v1` endpoint set. Session work goes through the Typert Gateway
 * as the bridge's own owner Peer, so every call carries the same argument
 * validation and invocation context as a Web client's; history reads use the
 * Session Controller's in-process `inspect`. Every session-scoped endpoint
 * first reads the Session's current `agentPreset` projection and refuses a
 * Session whose preset is not admitted, so the extension cannot drive a
 * Session that has tools even when it knows its id.
 */

import type { Context } from '@deepseek-ai/cordis'
import { brandString } from '@deepseek-ai/dsh-brand'
import type {
  SessionCreateValue,
  SessionProjectionsValue,
  SessionRequestId,
} from '@deepseek-ai/dsh-api-session-controller/types'
import type {} from '@deepseek-ai/dsh-api-session-controller'
import type {} from '@deepseek-ai/dsh-api-gateway'
import type { SessionId } from '@deepseek-ai/dsh-session'
import type { PeerScope } from '@deepseek-ai/dsh-typert-protocol'
import type {} from '@deepseek-ai/dsh-knowledge'
import { z } from 'zod'
import { conversationMessages, replyState } from './conversation.ts'
import { BridgeRequestError } from './http.ts'
import type {
  ExtensionKnowledgeIngestValue,
  ExtensionSessionCancelValue,
  ExtensionSessionCreateValue,
  ExtensionSessionMessagesValue,
  ExtensionSessionPromptValue,
  ExtensionSessionReplyValue,
  ExtensionStatusValue,
} from './types.ts'

/** Deployment bounds applied by the endpoints. */
export interface BridgeLimits {
  /** Largest decoded document `knowledge/ingest` accepts. */
  readonly maxDocumentBytes: number
  /** Longest extracted text `knowledge/ingest` returns. */
  readonly maxDocumentTextChars: number
  /** Most messages `sessions/messages` returns. */
  readonly maxHistoryMessages: number
}

const sessionIdSchema = z.string().min(1).max(256)
const requestIdSchema = z.string().regex(/^[A-Za-z0-9_-]{8,128}$/u)
const BASE64_PATTERN = /^[A-Za-z0-9+/]+={0,2}$/u

const schemas = {
  status: z.object({}).strict(),
  create: z.object({ agentPreset: z.string().min(1), title: z.string().trim().min(1).max(200) }).strict(),
  prompt: z.object({
    sessionId: sessionIdSchema,
    requestId: requestIdSchema,
    content: z.array(z.discriminatedUnion('type', [
      z.object({ type: z.literal('text'), text: z.string() }).strict(),
      z.object({
        type: z.literal('image'),
        mediaType: z.string().min(1).max(100),
        data: z.string().min(1),
        name: z.string().min(1).max(255).optional(),
      }).strict(),
    ])).min(1),
    clientTimeZone: z.string().min(1).max(64).optional(),
  }).strict(),
  reply: z.object({ sessionId: sessionIdSchema, requestId: requestIdSchema }).strict(),
  session: z.object({ sessionId: sessionIdSchema }).strict(),
  ingest: z.object({
    name: z.string().min(1).max(255),
    data: z.string().min(1),
    format: z.string().min(1).max(16).optional(),
  }).strict(),
}

function parse<T>(schema: z.ZodType<T>, body: unknown): T {
  const parsed = schema.safeParse(body)
  if (!parsed.success) throw new BridgeRequestError(400, 'extension-bridge/bad-request', z.prettifyError(parsed.error))
  return parsed.data
}

/** Endpoint implementations bound to one plugin activation. */
export class ExtensionOperations {
  /**
   * @param ctx - plugin context holding the Gateway, Session Controller, and optional knowledge service.
   * @param peer - owner Peer every Gateway call speaks for.
   * @param agentPresets - presets the extension may create and drive.
   * @param limits - deployment bounds.
   */
  constructor(
    private readonly ctx: Context,
    private readonly peer: PeerScope,
    private readonly agentPresets: ReadonlySet<string>,
    private readonly limits: BridgeLimits,
  ) {}

  /**
   * Run one endpoint.
   * @param endpoint - path below `/extension-bridge/v1/`.
   * @param body - parsed JSON request body.
   * @param signal - request lifetime.
   * @returns the endpoint's JSON value.
   * @throws {@link BridgeRequestError} for unknown endpoints, invalid bodies, and refused Sessions;
   * Session and knowledge failures keep their own errors.
   */
  dispatch(endpoint: string, body: unknown, signal: AbortSignal): Promise<unknown> {
    switch (endpoint) {
      case 'status':
        parse(schemas.status, body)
        return Promise.resolve(this.status())
      case 'sessions/create':
        return this.create(parse(schemas.create, body), signal)
      case 'sessions/prompt':
        return this.prompt(parse(schemas.prompt, body), signal)
      case 'sessions/reply':
        return this.reply(parse(schemas.reply, body), signal)
      case 'sessions/messages':
        return this.messages(parse(schemas.session, body), signal)
      case 'sessions/cancel':
        return this.cancel(parse(schemas.session, body), signal)
      case 'knowledge/ingest':
        return this.ingest(parse(schemas.ingest, body), signal)
      default:
        throw new BridgeRequestError(404, 'extension-bridge/not-found', `unknown extension endpoint ${JSON.stringify(endpoint)}`)
    }
  }

  /**
   * Describe what a paired extension may do.
   * @returns admitted presets and knowledge availability.
   */
  status(): ExtensionStatusValue {
    return { agentPresets: [...this.agentPresets], knowledge: this.ctx.get('knowledge') !== undefined }
  }

  private async create(request: z.infer<typeof schemas.create>, signal: AbortSignal): Promise<ExtensionSessionCreateValue> {
    if (!this.agentPresets.has(request.agentPreset)) {
      throw new BridgeRequestError(403, 'extension-bridge/preset-not-allowed', `agent preset ${JSON.stringify(request.agentPreset)} is not available to the extension`)
    }
    const created = await this.invoke<SessionCreateValue>('create', { agentPreset: request.agentPreset }, signal)
    await this.invoke('rename', { sessionId: created.sessionId, title: request.title }, signal)
    return { sessionId: created.sessionId }
  }

  private async prompt(request: z.infer<typeof schemas.prompt>, signal: AbortSignal): Promise<ExtensionSessionPromptValue> {
    const sessionId = await this.admittedSession(request.sessionId, signal)
    await this.invoke('prompt', {
      requestId: brandString<SessionRequestId>(request.requestId),
      sessionId,
      mode: 'queue',
      content: request.content,
      ...request.clientTimeZone === undefined ? {} : { clientTimeZone: request.clientTimeZone },
    }, signal)
    return { accepted: true }
  }

  private async reply(request: z.infer<typeof schemas.reply>, signal: AbortSignal): Promise<ExtensionSessionReplyValue> {
    const sessionId = await this.admittedSession(request.sessionId, signal)
    const { events } = await this.ctx.sessionController.inspect(sessionId, signal)
    return replyState(events, request.requestId)
  }

  private async messages(request: z.infer<typeof schemas.session>, signal: AbortSignal): Promise<ExtensionSessionMessagesValue> {
    const sessionId = await this.admittedSession(request.sessionId, signal)
    const { events } = await this.ctx.sessionController.inspect(sessionId, signal)
    return { messages: conversationMessages(events, this.limits.maxHistoryMessages) }
  }

  private async cancel(request: z.infer<typeof schemas.session>, signal: AbortSignal): Promise<ExtensionSessionCancelValue> {
    const sessionId = await this.admittedSession(request.sessionId, signal)
    await this.invoke('cancel', { sessionId }, signal)
    return { accepted: true }
  }

  private async ingest(request: z.infer<typeof schemas.ingest>, signal: AbortSignal): Promise<ExtensionKnowledgeIngestValue> {
    const knowledge = this.ctx.get('knowledge')
    if (knowledge === undefined) {
      throw new BridgeRequestError(503, 'extension-bridge/knowledge-unavailable', 'Curupira Memory is not mounted in this installation')
    }
    const content = this.decodeDocument(request.data)
    const result = await knowledge.ingest({
      content,
      name: request.name,
      ...request.format === undefined ? {} : { format: request.format },
    }, signal)
    const text = await knowledge.text(result.id, signal)
    const truncated = text.length > this.limits.maxDocumentTextChars
    return {
      ...result,
      name: request.name,
      text: truncated ? text.slice(0, this.limits.maxDocumentTextChars) : text,
      truncated,
    }
  }

  /** Strict base64: canonical alphabet and padding, non-empty, within the document bound. */
  private decodeDocument(data: string): Uint8Array {
    const { maxDocumentBytes } = this.limits
    if (data.length > Math.ceil(maxDocumentBytes / 3) * 4) {
      throw new BridgeRequestError(413, 'extension-bridge/document-too-large', `document exceeds ${String(maxDocumentBytes)} bytes`)
    }
    if (data.length % 4 !== 0 || !BASE64_PATTERN.test(data)) {
      throw new BridgeRequestError(400, 'extension-bridge/bad-request', 'document data is not valid base64')
    }
    const decoded = Buffer.from(data, 'base64')
    if (decoded.byteLength > maxDocumentBytes) {
      throw new BridgeRequestError(413, 'extension-bridge/document-too-large', `document exceeds ${String(maxDocumentBytes)} bytes`)
    }
    // Extractors such as pdfjs refuse Buffer, the Uint8Array subclass, so the bytes move to a plain view.
    return new Uint8Array(decoded.buffer, decoded.byteOffset, decoded.byteLength)
  }

  /** Read the Session's current preset projection and refuse it unless the extension may drive it. */
  private async admittedSession(sessionId: string, signal: AbortSignal): Promise<SessionId> {
    const id = brandString<SessionId>(sessionId)
    const projections = await this.invoke<SessionProjectionsValue>('projections', { sessionId: id }, signal)
    if (projections === null) {
      throw new BridgeRequestError(404, 'extension-bridge/session-not-found', `session ${JSON.stringify(sessionId)} does not exist`)
    }
    if (projections.kind === 'migration-required') {
      throw new BridgeRequestError(409, 'extension-bridge/migration-required', 'open this conversation in CurupiraCode once to migrate it')
    }
    const preset = projections.values.agentPreset
    if (typeof preset !== 'string' || !this.agentPresets.has(preset)) {
      throw new BridgeRequestError(403, 'extension-bridge/preset-not-allowed', `session ${JSON.stringify(sessionId)} does not run a preset available to the extension`)
    }
    return id
  }

  private async invoke<T = unknown>(method: string, request: object, signal: AbortSignal): Promise<T> {
    return await this.ctx.typertGateway.invoke({ namespace: 'session', method, args: { request }, peer: this.peer, signal }) as T
  }
}
