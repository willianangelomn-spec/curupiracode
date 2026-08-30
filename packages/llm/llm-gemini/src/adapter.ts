/**
 * Google Gemini adapter for the harness LLM seam. One route (`gemini`).
 * Primary transport spawns the locally installed Antigravity CLI (`agy`),
 * which owns the consumer Google-account login; when the binary is absent the
 * adapter falls back to the Google-account-OAuth Code Assist transport
 * (stored token refresh + `streamGenerateContent` SSE).
 *
 * @module dsh-llm-gemini/adapter
 */

import type { Context } from '@deepseek-ai/cordis'
import {
  attributionHeaders,
  LlmAdapter,
  LlmError,
  ReasoningEffortId,
} from '@deepseek-ai/dsh-llm'
import type {
  GenerateOptions,
  LlmModelInfo,
  LlmProviderInfo,
  LlmResolvedModelInfo,
  ResolvedRetryPolicy,
  StreamChunk,
} from '@deepseek-ai/dsh-llm'
import { ensureAccessToken, readGrant, writeGrant } from './auth.ts'
import { agyBinary, flattenPrompt, generateViaAgy } from './agy.ts'
import type { AgyResult } from './agy.ts'
import {
  codeAssistEnvelope,
  codeAssistStreamUrl,
  resolveCodeAssistProject,
} from './codeassist.ts'
import { buildRequestBody, effortToBudget, GeminiStreamConverter } from './convert.ts'
import { GEMINI_MODELS, modelById } from './models.ts'

/** The single provider route this adapter owns. */
export const PROVIDER = 'gemini'

/** The public display name for the route. */
export const PROVIDER_NAME = 'Google Gemini'

/** Selectable reasoning efforts offered on reasoning-capable models. */
const REASONING_EFFORTS = ['off', 'low', 'medium', 'high'] as const

/** Constructor options for {@link GeminiAdapter}. */
export interface GeminiAdapterOptions {
  /** Plugin context carrying the optional `ctx.credentials` seam. */
  ctx: Context
  /** Provider-owned request retry policy, resolved once at registration. */
  retryPolicy: ResolvedRetryPolicy
}

/** Google-account-OAuth Gemini adapter. */
export class GeminiAdapter extends LlmAdapter {
  constructor(private readonly options: GeminiAdapterOptions) {
    super()
  }

  override providerInfo(provider: string): LlmProviderInfo {
    if (provider !== PROVIDER) throw new LlmError(`llm-gemini does not own provider "${provider}"`, 'NO_ADAPTER')
    return { id: PROVIDER, name: PROVIDER_NAME }
  }

  override providerRetryPolicy(_provider: string): ResolvedRetryPolicy | undefined {
    return this.options.retryPolicy
  }

  override listModels(_provider: string): Promise<readonly LlmModelInfo[]> {
    return Promise.resolve(GEMINI_MODELS.map(model => ({
      provider: PROVIDER,
      id: model.id,
      name: model.name,
      inputModalities: model.inputModalities,
    })))
  }

  override resolveModel(provider: string, model: string): Promise<LlmResolvedModelInfo> {
    if (provider !== PROVIDER) throw new LlmError(`llm-gemini does not own provider "${provider}"`, 'NO_ADAPTER')
    const def = modelById(model)
    if (def === undefined) throw new LlmError(`llm-gemini has no model "${model}"`, 'UNKNOWN_MODEL')
    const resolved: LlmResolvedModelInfo = {
      provider: PROVIDER,
      id: model,
      name: def.name,
      inputModalities: def.inputModalities,
      context: { contextWindow: def.contextWindow },
    }
    if (def.reasoning) {
      resolved.reasoning = {
        efforts: REASONING_EFFORTS.map(effort => ({
          id: ReasoningEffortId(effort),
          name: effort.charAt(0).toUpperCase() + effort.slice(1),
        })),
        defaultEffort: ReasoningEffortId('medium'),
      }
    }
    return Promise.resolve(resolved)
  }

  override prepareCall(provider: string, model: string): Promise<{
    model: LlmResolvedModelInfo
    stream: (options: GenerateOptions) => AsyncIterable<StreamChunk>
  }> {
    return this.resolveModel(provider, model).then(info => ({
      model: info,
      stream: (options: GenerateOptions) => this.stream(options),
    }))
  }

  override stream(options: GenerateOptions): AsyncIterable<StreamChunk> {
    return this.streamImpl(options)
  }

  private async * streamImpl(options: GenerateOptions): AsyncIterable<StreamChunk> {
    if (options.provider !== PROVIDER) {
      throw new LlmError(`llm-gemini does not own provider "${options.provider}"`, 'NO_ADAPTER')
    }
    const def = modelById(options.model)
    if (def === undefined) throw new LlmError(`llm-gemini has no model "${options.model}"`, 'UNKNOWN_MODEL')

    const budget = effortToBudget(options.reasoningEffort, def.reasoning)

    // Primary transport: the locally installed Antigravity CLI (`agy`), which
    // owns the consumer Google-account login. When the binary is absent, fall
    // back to the OAuth Code Assist transport below.
    let agyResult: AgyResult | undefined
    try {
      agyResult = await generateViaAgy({
        binary: agyBinary(),
        model: options.model,
        prompt: flattenPrompt(options),
        signal: options.signal,
      })
    } catch (error: unknown) {
      if (error instanceof LlmError) throw error
      if ((error as NodeJS.ErrnoException | undefined)?.code !== 'ENOENT') {
        throw new LlmError(
          `agy failed: ${error instanceof Error ? error.message : String(error)}`,
          'PROVIDER',
          { cause: error },
        )
      }
      // Missing binary: fall back to the OAuth transport only when a Google
      // grant already exists; fresh installs get the actionable message.
      const grant = await readGrant(this.options.ctx)
      if (grant === undefined) {
        throw new LlmError(
          'O Antigravity CLI (`agy`) não está instalado nesta máquina.'
            + ' Instale-o, rode `agy` no terminal e faça login com sua conta Google uma vez;'
            + ' depois os modelos Gemini funcionam aqui sem nenhuma chave de API.',
          'PROVIDER',
          { cause: error },
        )
      }
    }
    if (agyResult !== undefined) {
      const index = 0
      const text = agyResult.response ?? ''
      yield { type: 'block-start', index, blockType: 'text' }
      if (text.length > 0) yield { type: 'text-delta', index, text }
      yield { type: 'block-end', index, block: { type: 'text', text } }
      const usage = agyResult.usage
      if (usage !== undefined) {
        yield {
          type: 'usage',
          usage: {
            inputTokens: usage.input_tokens ?? 0,
            outputTokens: usage.output_tokens ?? 0,
            ...(usage.thinking_tokens !== undefined ? { reasoningTokens: usage.thinking_tokens } : {}),
          },
        }
      }
      yield { type: 'finish', reason: { kind: 'stop' } }
      return
    }

    yield* this.streamCodeAssist(options, budget)
  }

  /** OAuth Code Assist transport: bearer token + `streamGenerateContent` SSE. */
  private async * streamCodeAssist(options: GenerateOptions, budget: ReturnType<typeof effortToBudget>): AsyncIterable<StreamChunk> {
    const token = await ensureAccessToken(this.options.ctx, options.signal)
    // The Code Assist project id is resolved once per account and cached in
    // the stored grant, so steady-state requests skip the onboarding handshake.
    const grant = await readGrant(this.options.ctx)
    let project = grant?.projectId
    if (project === undefined) {
      project = await resolveCodeAssistProject(token, options.signal)
      if (grant !== undefined) {
        await writeGrant(this.options.ctx, { ...grant, projectId: project })
      }
    }

    const body = codeAssistEnvelope(
      options.model,
      project,
      buildRequestBody(options, budget),
    )
    const url = codeAssistStreamUrl()

    let response: Response
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          ...attributionHeaders(),
        },
        body: JSON.stringify(body),
        signal: options.signal ?? null,
      })
    } catch (error: unknown) {
      if (options.signal?.aborted) {
        throw new LlmError('llm-gemini request aborted by caller', 'ABORTED', { cause: error })
      }
      throw new LlmError(`llm-gemini request failed: ${error instanceof Error ? error.message : String(error)}`, 'PROVIDER', { cause: error })
    }

    if (!response.ok) {
      const text = await response.text().catch(() => '')
      const code = response.status === 401 || response.status === 403
        ? 'AUTH'
        : response.status === 429
          ? 'RATE_LIMIT'
          : 'PROVIDER'
      const message = code === 'AUTH'
        ? 'Gemini rejected the Google sign-in; sign in again from the Models page. If this'
          + ' persists, your Google account may not be eligible for the Gemini free tier.'
        : `Gemini request failed (status ${response.status}): ${text}`
      throw new LlmError(message, code, { status: response.status })
    }

    const reader = response.body?.getReader()
    if (reader === undefined) throw new LlmError('llm-gemini: Gemini returned no response body', 'PROVIDER')

    const converter = new GeminiStreamConverter()
    const decoder = new TextDecoder()
    let buffer = ''
    try {
      while (true) {
        const chunk = await reader.read()
        if (chunk.done) break
        if (options.signal?.aborted) {
          await reader.cancel().catch(() => {})
          throw new LlmError('llm-gemini request aborted by caller', 'ABORTED')
        }
        buffer += decoder.decode(chunk.value, { stream: true })
        let newline: number
        while ((newline = buffer.indexOf('\n')) >= 0) {
          const line = buffer.slice(0, newline).trim()
          buffer = buffer.slice(newline + 1)
          if (!line.startsWith('data:')) continue
          const data = line.slice(5).trim()
          if (data.length === 0 || data === '[DONE]') continue
          try {
            const json = JSON.parse(data) as Parameters<GeminiStreamConverter['push']>[0]
            // Code Assist nests the standard GenerateContentResponse under
            // `response` (with a `traceId` beside it); unwrap before converting.
            const frame = (json as { response?: unknown }).response !== undefined
              && (json as { candidates?: unknown }).candidates === undefined
              ? (json as { response: Parameters<GeminiStreamConverter['push']>[0] }).response
              : json
            for (const chunk of converter.push(frame)) yield chunk
          } catch {
            // A non-JSON keepalive or partial frame: ignore rather than fail the stream.
          }
        }
      }
      // Flush any trailing buffered line.
      const trailing = buffer.trim()
      if (trailing.startsWith('data:')) {
        const data = trailing.slice(5).trim()
        if (data.length > 0 && data !== '[DONE]') {
          try {
            const json = JSON.parse(data) as Parameters<GeminiStreamConverter['push']>[0]
            const frame = (json as { response?: unknown }).response !== undefined
              && (json as { candidates?: unknown }).candidates === undefined
              ? (json as { response: Parameters<GeminiStreamConverter['push']>[0] }).response
              : json
            for (const chunk of converter.push(frame)) yield chunk
          } catch {
            /* ignore */
          }
        }
      }
      for (const chunk of converter.finish()) yield chunk
    } finally {
      reader.releaseLock()
    }
  }
}
