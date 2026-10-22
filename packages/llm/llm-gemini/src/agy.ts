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
import { existsSync } from 'node:fs'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import { join } from 'node:path'
import { LlmError } from '@deepseek-ai/dsh-llm'
import type { ContentBlock, GenerateOptions } from '@deepseek-ai/dsh-llm'
import type { AttachmentId, ImageMediaType, RequestImageAttachment } from '@deepseek-ai/dsh-attachment'

/** Warning agy prints before replacing an unknown `--model` id with its default model. */
const UNKNOWN_MODEL_WARNING = /not recognized as a known model/i
/** Prompt agy prints, then waits on for a minute, when no Google sign-in is stored. */
const AUTH_REQUIRED = /authentication required/i
/** `error` agy reports in its JSON result after that wait expires. */
const AUTH_FAILED = /authentication failed/i

/** One parsed `agy --output-format json` run. */
export interface AgyResult {
  conversation_id?: string
  status?: string
  response?: string
  /** Failure summary agy reports beside `status: 'ERROR'`. */
  error?: string
  duration_seconds?: number
  usage?: {
    input_tokens?: number
    output_tokens?: number
    thinking_tokens?: number
    total_tokens?: number
  }
}

/**
 * Resolve the agy binary: the `GEMINI_AGY_BINARY` override, then the
 * installer's default `~/.local/bin/agy` when that file exists, then bare
 * `agy`, which `spawn` looks up on PATH.
 * @returns the path or command name to spawn.
 */
export function agyBinary(): string {
  const override = process.env.GEMINI_AGY_BINARY
  if (override !== undefined && override !== '') return override
  const installed = join(os.homedir(), '.local', 'bin', 'agy')
  return existsSync(installed) ? installed : 'agy'
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

/** Flatten model-visible text and image blocks, preserving staged image positions; other blocks carry no prompt text. */
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
    }
  }
  return out
}

/**
 * Opening of every agy prompt. agy runs its own agent with its own tools, so
 * the request states that agy serves here as the model of another application:
 * the tools the application's instructions name do not exist in this transport,
 * and application context is environment data rather than something the human said.
 */
export const AGY_FRAMING = [
  'Você está respondendo como o modelo de linguagem do aplicativo CurupiraCode, por meio do Antigravity CLI.',
  'Responda diretamente à última mensagem do Usuário na conversa abaixo, no idioma dela.',
  'Não use ferramentas, não leia nem altere arquivos e não execute comandos: as ferramentas citadas nas instruções do aplicativo não estão disponíveis neste modo.',
  'Blocos marcados como "Contexto do aplicativo" descrevem o ambiente; não são pedidos do usuário.',
].join('\n')

/** Transcript label of one message: the human, the assistant, a tool result, or application context. */
function speaker(message: GenerateOptions['messages'][number]): string {
  switch (message.role) {
    case 'assistant': return 'Assistente'
    case 'tool': return 'Resultado de ferramenta'
    case 'system':
    case 'developer': return 'Contexto do aplicativo'
    // Only a human-sourced user message is the human speaking; other producers inject context in the user role.
    case 'user': return message.source === undefined || message.source.kind === 'user' ? 'Usuário' : 'Contexto do aplicativo'
  }
}

/**
 * Flatten a provider-neutral request into the single prompt string `agy -p`
 * consumes: {@link AGY_FRAMING}, the application's system text, then the
 * conversation with each message labelled by speaker. Reasoning blocks are
 * internal scratch space and are skipped.
 * @param options - bounded provider-neutral request.
 * @param imagePaths - staged path of each image attachment the request carries.
 * @returns the prompt text.
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
    const text = blockText(message.content, imagePaths)
    if (text.length > 0) turns.push(`${speaker(message)}: ${text}`)
  }
  const sections: string[] = [AGY_FRAMING]
  if (system.length > 0) sections.push(`Instruções do aplicativo:\n\n${system.join('\n\n')}`)
  if (turns.length > 0) sections.push(`Conversa:\n\n${turns.join('\n\n')}`)
  return sections.join('\n\n---\n\n')
}

/** Staged Antigravity prompt and its exact temporary workspace directory. */
export interface PreparedAgyPrompt {
  /** Text prompt containing `@path` references at each durable image position. */
  prompt: string
  /**
   * Empty private directory the Antigravity subprocess runs in, so the CLI's
   * own agent sees no user files; staged images live inside it.
   */
  workingDirectory: string
  /** Directories granted to the Antigravity subprocess for staged images; empty without images. */
  addDirs: readonly string[]
  /** Remove the request-owned temporary files. Safe after partial preparation. */
  dispose: () => Promise<void>
}

/**
 * Create the private working directory, materialize deterministic request
 * images in it, and build the `@path` prompt Antigravity understands.
 * @param options - bounded provider-neutral request.
 * @param images - exact request images retained for this call.
 * @returns prompt, working and allowed directories, and an idempotent cleanup operation.
 */
export async function prepareAgyPrompt(
  options: GenerateOptions,
  images: ReadonlyMap<AttachmentId, RequestImageAttachment>,
): Promise<PreparedAgyPrompt> {
  const directory = await mkdtemp(join(os.tmpdir(), 'dsh-gemini-'))
  let disposed = false
  const dispose = async (): Promise<void> => {
    if (disposed) return
    disposed = true
    await rm(directory, { recursive: true, force: true })
  }
  try {
    if (images.size === 0) {
      return { prompt: flattenPrompt(options), workingDirectory: directory, addDirs: [], dispose }
    }
    const imagePaths = new Map<AttachmentId, string>()
    let ordinal = 0
    for (const [attachmentId, image] of images) {
      options.signal?.throwIfAborted()
      const path = join(directory, `image-${++ordinal}.${imageExtension(image.mediaType)}`)
      await writeFile(path, image.data, { mode: 0o600, signal: options.signal })
      imagePaths.set(attachmentId, path)
    }
    return { prompt: flattenPrompt(options, imagePaths), workingDirectory: directory, addDirs: [directory], dispose }
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
 * @param options - binary, model id, flattened prompt, working directory, granted image directories, and cancellation.
 * @returns the parsed JSON result with `status: 'SUCCESS'`.
 * @throws {LlmError} code `ABORTED` when the caller signal fires;
 * `SIGN_IN_REQUIRED` when agy has no Google sign-in; `UNKNOWN_MODEL` when agy
 * does not recognize the model; `PROVIDER` when the binary fails, returns a
 * non-zero exit, or emits unusable output. A missing binary rejects with the raw ENOENT error so the
 * caller can fall back to the OAuth transport.
 */
export function generateViaAgy(options: {
  binary: string
  model: string
  prompt: string
  cwd: string
  addDirs?: readonly string[]
  signal?: AbortSignal | undefined
}): Promise<AgyResult> {
  const { binary, model, prompt, cwd, addDirs = [], signal } = options
  return new Promise((resolve, reject) => {
    const child = spawn(binary, [
      '-p', prompt,
      '--output-format', 'json',
      '--model', model,
      '--disable-slash-commands',
      ...addDirs.flatMap(directory => ['--add-dir', directory]),
    ], {
      cwd,
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
      // agy substitutes its default model for an id it does not know and still
      // reports success; answering from another model than the one selected
      // must fail instead of passing silently.
      if (UNKNOWN_MODEL_WARNING.test(stderr)) {
        reject(new LlmError(
          `O Antigravity CLI não reconhece o modelo "${model}" e trocaria por outro.`
            + ' Atualize o agy (o Gemini 4 Argon exige a versão 1.4.3 ou mais recente),'
            + ' confira com `agy models` se o seu plano Google libera esse modelo'
            + ' ou escolha outro modelo do Gemini.',
          'UNKNOWN_MODEL',
        ))
        return
      }
      // Without a stored sign-in agy prints a login URL, waits a minute, and
      // exits; the URL belongs to that dead process, so the fix is a sign-in.
      // `AUTH` is not used because Clients render it as an invalid API key.
      if (AUTH_REQUIRED.test(stderr) || AUTH_FAILED.test(parsed?.error ?? '')) {
        reject(new LlmError(
          'O Antigravity CLI (`agy`) não está conectado a uma conta Google.'
            + ' Abra um terminal, rode `agy`, faça login com sua conta Google e envie a mensagem de novo.',
          'SIGN_IN_REQUIRED',
        ))
        return
      }
      if (code !== 0) {
        const detail = [parsed?.error, parsed?.response, stderr.trim().slice(0, 400)]
          .find(text => text !== undefined && text.length > 0) ?? `exit code ${code}`
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
