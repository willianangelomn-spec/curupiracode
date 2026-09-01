/**
 * Antigravity CLI (`agy`) transport for the Gemini adapter. The adapter spawns
 * the locally installed, already-authenticated `agy` binary (consumer Google
 * account login stored under `~/.gemini`) with a single flattened prompt and
 * parses its JSON output — the same integration pattern proven by downstream
 * deployments: the CLI owns auth, backend routing and model availability, the
 * adapter only maps the harness request/response shapes around it.
 *
 * @module dsh-llm-gemini/agy
 */

import { spawn } from 'node:child_process'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import { join } from 'node:path'
import { LlmError } from '@deepseek-ai/dsh-llm'
import type { ContentBlock, GenerateOptions } from '@deepseek-ai/dsh-llm'
import type { AttachmentId, ImageMediaType, RequestImageAttachment } from '@deepseek-ai/dsh-attachment'

/** One parsed `agy --output-format json` run. */
export interface AgyResult {
  conversation_id?: string
  status?: string
  response?: string
  duration_seconds?: number
  usage?: {
    input_tokens?: number
    output_tokens?: number
    thinking_tokens?: number
    total_tokens?: number
  }
}

/**
 * Resolve the agy binary path: `GEMINI_AGY_BINARY` override, then the default
 * user-local install location, then bare `agy` (PATH lookup by spawn).
 */
export function agyBinary(): string {
  return process.env.GEMINI_AGY_BINARY
    ?? os.homedir() + '/.local/bin/agy'
}

/** File extension accepted by Antigravity's workspace image reader. */
function imageExtension(mediaType: ImageMediaType): string {
  switch (mediaType) {
    case 'image/png': return 'png'
    case 'image/jpeg': return 'jpg'
    case 'image/webp': return 'webp'
    case 'image/gif': return 'gif'
  }
}

/** Flatten model-visible blocks, preserving staged image positions. */
function blockText(
  blocks: readonly ContentBlock[],
  imagePaths: ReadonlyMap<AttachmentId, string> | undefined,
): string {
  let out = ''
  for (const block of blocks) {
    if (block.type === 'text') out += block.text
    else if (block.type === 'image') {
      const path = imagePaths?.get(block.attachment.attachmentId)
      if (path === undefined) {
        throw new LlmError(
          `agy image ${block.attachment.attachmentId} was not staged for the request`,
          'INVALID_REQUEST',
        )
      }
      out += `\nImagem anexada: @${path}\n`
    } else if (block.type === 'tool-result') out += blockText(block.content, imagePaths)
  }
  return out
}

/**
 * Flatten a provider-neutral request into the single prompt string `agy -p`
 * consumes: system text first, then the conversation turns. Reasoning blocks
 * are internal scratch space and are skipped.
 */
export function flattenPrompt(
  options: GenerateOptions,
  imagePaths?: ReadonlyMap<AttachmentId, string>,
): string {
  const system: string[] = []
  const turns: string[] = []
  if (options.system !== undefined && options.system.length > 0) system.push(options.system)
  for (const message of options.messages) {
    if (message.role === 'system') {
      for (const block of message.content) {
        if (block.type === 'text') system.push(block.text)
      }
      continue
    }
    const who = message.role === 'assistant' ? 'Assistente' : 'Usuário'
    const text = blockText(message.content, imagePaths)
    if (text.length > 0) turns.push(`${who}: ${text}`)
  }
  const sections: string[] = []
  if (system.length > 0) sections.push(system.join('\n\n'))
  if (turns.length > 0) sections.push(turns.join('\n\n'))
  return sections.join('\n\n---\n\n')
}

/** Staged Antigravity prompt and its exact temporary workspace directory. */
export interface PreparedAgyPrompt {
  /** Text prompt containing `@path` references at each durable image position. */
  prompt: string
  /** Directory granted to the Antigravity subprocess. */
  addDirs: readonly string[]
  /** Remove the request-owned temporary files. Safe after partial preparation. */
  dispose: () => Promise<void>
}

/**
 * Materialize deterministic request images in a private temporary directory
 * and build the `@path` prompt Antigravity understands.
 * @param options - bounded provider-neutral request.
 * @param images - exact request images retained for this call.
 * @returns prompt, allowed directory, and an idempotent cleanup operation.
 */
export async function prepareAgyPrompt(
  options: GenerateOptions,
  images: ReadonlyMap<AttachmentId, RequestImageAttachment>,
): Promise<PreparedAgyPrompt> {
  if (images.size === 0) {
    return { prompt: flattenPrompt(options), addDirs: [], dispose: () => Promise.resolve() }
  }
  const directory = await mkdtemp(join(os.tmpdir(), 'dsh-gemini-'))
  let disposed = false
  const dispose = async (): Promise<void> => {
    if (disposed) return
    disposed = true
    await rm(directory, { recursive: true, force: true })
  }
  try {
    const imagePaths = new Map<AttachmentId, string>()
    let ordinal = 0
    for (const [attachmentId, image] of images) {
      options.signal?.throwIfAborted()
      const path = join(directory, `image-${++ordinal}.${imageExtension(image.mediaType)}`)
      await writeFile(path, image.data, { mode: 0o600, signal: options.signal })
      imagePaths.set(attachmentId, path)
    }
    return { prompt: flattenPrompt(options, imagePaths), addDirs: [directory], dispose }
  } catch (error: unknown) {
    await dispose().catch(() => {
      // The preparation error remains authoritative; the OS can reclaim an
      // unlinked request directory if cleanup itself is unavailable.
    })
    throw error
  }
}

/**
 * Run one non-interactive agy generation.
 * @returns the parsed JSON result with `status: 'SUCCESS'`.
 * @throws {LlmError} code `ABORTED` when the caller signal fires; `PROVIDER`
 * when the binary fails, returns a non-zero exit, or emits unusable output.
 * A missing binary rejects with the raw ENOENT error so the caller can fall
 * back to the OAuth transport.
 */
export function generateViaAgy(options: {
  binary: string
  model: string
  prompt: string
  addDirs?: readonly string[]
  signal?: AbortSignal | undefined
}): Promise<AgyResult> {
  const { binary, model, prompt, addDirs = [], signal } = options
  return new Promise((resolve, reject) => {
    const child = spawn(binary, [
      '-p', prompt,
      '--output-format', 'json',
      '--model', model,
      '--disable-slash-commands',
      ...addDirs.flatMap(directory => ['--add-dir', directory]),
    ], {
      signal,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (data: Buffer) => { stdout += data.toString() })
    child.stderr.on('data', (data: Buffer) => { stderr += data.toString() })
    child.on('error', (error: NodeJS.ErrnoException) => {
      if (signal?.aborted) {
        reject(new LlmError('llm-gemini request aborted by caller', 'ABORTED', { cause: error }))
      } else if (error.code === 'ENOENT') {
        reject(error)
      } else {
        reject(new LlmError(`agy failed to start: ${error.message}`, 'PROVIDER', { cause: error }))
      }
    })
    child.on('close', (code: number | null) => {
      if (signal?.aborted) {
        reject(new LlmError('llm-gemini request aborted by caller', 'ABORTED'))
        return
      }
      let parsed: AgyResult | undefined
      try {
        parsed = JSON.parse(stdout.trim()) as AgyResult
      } catch {
        parsed = undefined
      }
      if (code !== 0) {
        const detail = (parsed?.response !== undefined && parsed.response.length > 0
          ? parsed.response
          : stderr.trim().slice(0, 400)) || `exit code ${code}`
        reject(new LlmError(`agy falhou (código ${code}): ${detail}`, 'PROVIDER'))
        return
      }
      if (parsed === undefined) {
        reject(new LlmError(`agy retornou saída não-JSON: ${stdout.trim().slice(0, 200)}`, 'PROVIDER'))
        return
      }
      if (parsed.status !== 'SUCCESS' || typeof parsed.response !== 'string') {
        reject(new LlmError(
          `agy retornou status inesperado: ${JSON.stringify(parsed).slice(0, 300)}`,
          'PROVIDER',
        ))
        return
      }
      resolve(parsed)
    })
  })
}
