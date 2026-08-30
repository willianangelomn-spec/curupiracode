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
import os from 'node:os'
import { LlmError } from '@deepseek-ai/dsh-llm'
import type { ContentBlock, GenerateOptions } from '@deepseek-ai/dsh-llm'

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

/** Flatten text-bearing blocks (recursing into tool results) into one string. */
function blockText(blocks: readonly ContentBlock[]): string {
  let out = ''
  for (const block of blocks) {
    if (block.type === 'text') out += block.text
    else if (block.type === 'tool-result') out += blockText(block.content)
  }
  return out
}

/**
 * Flatten a provider-neutral request into the single prompt string `agy -p`
 * consumes: system text first, then the conversation turns. Reasoning blocks
 * are internal scratch space and are skipped.
 */
export function flattenPrompt(options: GenerateOptions): string {
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
    const text = blockText(message.content)
    if (text.length > 0) turns.push(`${who}: ${text}`)
  }
  const sections: string[] = []
  if (system.length > 0) sections.push(system.join('\n\n'))
  if (turns.length > 0) sections.push(turns.join('\n\n'))
  return sections.join('\n\n---\n\n')
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
  signal?: AbortSignal | undefined
}): Promise<AgyResult> {
  const { binary, model, prompt, signal } = options
  return new Promise((resolve, reject) => {
    const child = spawn(binary, [
      '-p', prompt,
      '--output-format', 'json',
      '--model', model,
      '--disable-slash-commands',
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
