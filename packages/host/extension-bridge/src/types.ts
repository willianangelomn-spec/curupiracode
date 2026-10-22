/**
 * Wire payloads of the extension bridge's `v1` endpoints. Every endpoint is a
 * `POST` with an `application/json` body; a success answers HTTP 200 with the
 * value below, and a refusal answers a non-2xx status with
 * {@link ExtensionBridgeErrorBody}.
 * @module @deepseek-ai/dsh-host-extension-bridge/types
 */

import type { Branded } from '@deepseek-ai/dsh-brand'

/** Bearer secret issued by one approved pairing; only its SHA-256 digest is stored. */
export type ExtensionPairingToken = Branded<'extension-pairing-token'>

/** Failure body of every refused bridge request. */
export interface ExtensionBridgeErrorBody {
  readonly error: {
    /** Stable failure code, such as `extension-bridge/unauthorized` or a Session Remote code. */
    readonly code: string
    /** Human diagnostic. */
    readonly message: string
  }
}

/** `status` answer: what this deployment lets the paired extension do. */
export interface ExtensionStatusValue {
  /** Agent presets `sessions/create` accepts and session-scoped endpoints admit. */
  readonly agentPresets: readonly string[]
  /** Whether `knowledge/ingest` reaches a mounted knowledge service. */
  readonly knowledge: boolean
}

/** `sessions/create` request: a new Session running one admitted preset, titled for the Web sidebar. */
export interface ExtensionSessionCreateRequest {
  readonly agentPreset: string
  readonly title: string
}

/** `sessions/create` answer. */
export interface ExtensionSessionCreateValue {
  readonly sessionId: string
}

/** Prompt part accepted by `sessions/prompt`: text, or one inline base64 image. */
export type ExtensionPromptPart =
  | { readonly type: 'text'; readonly text: string }
  | { readonly type: 'image'; readonly mediaType: string; readonly data: string; readonly name?: string }

/** `sessions/prompt` request; `requestId` is minted by the extension and later names the reply. */
export interface ExtensionSessionPromptRequest {
  readonly sessionId: string
  readonly requestId: string
  readonly content: readonly ExtensionPromptPart[]
  /** IANA zone or `UTC` recorded on the prompt; the Session Controller rejects any other value. */
  readonly clientTimeZone?: string
}

/** `sessions/reply` request. */
export interface ExtensionSessionReplyRequest {
  readonly sessionId: string
  readonly requestId: string
}

/**
 * `sessions/reply` answer for one prompt. `queued` means the prompt has not
 * entered a turn yet; `running` means its turn has not ended. The terminal
 * states carry the last assistant text of that turn, which is empty when the
 * turn produced none.
 */
export type ExtensionSessionReplyValue =
  | { readonly state: 'queued' }
  | { readonly state: 'running' }
  | { readonly state: 'completed'; readonly text: string }
  | { readonly state: 'cancelled'; readonly text: string }
  | { readonly state: 'failed'; readonly text: string; readonly reason: string; readonly message: string }

/** Request naming one Session (`sessions/messages`, `sessions/cancel`). */
export interface ExtensionSessionRequest {
  readonly sessionId: string
}

/** One human or assistant message of a Session, with its durable event sequence. */
export interface ExtensionMessage {
  readonly seq: number
  readonly role: 'user' | 'assistant'
  readonly text: string
}

/** `sessions/messages` answer: the most recent messages, oldest first. */
export interface ExtensionSessionMessagesValue {
  readonly messages: readonly ExtensionMessage[]
}

/** `sessions/cancel` answer. */
export interface ExtensionSessionCancelValue {
  readonly accepted: true
}

/** `sessions/prompt` answer. */
export interface ExtensionSessionPromptValue {
  readonly accepted: true
}

/** `knowledge/ingest` request: one document as strict base64. */
export interface ExtensionKnowledgeIngestRequest {
  readonly name: string
  readonly data: string
  readonly format?: string
}

/** `knowledge/ingest` answer, including the extracted text bounded for prompt use. */
export interface ExtensionKnowledgeIngestValue {
  readonly id: string
  readonly name: string
  readonly passageCount: number
  readonly alreadyPresent: boolean
  readonly extractor: string
  readonly text: string
  readonly truncated: boolean
}
