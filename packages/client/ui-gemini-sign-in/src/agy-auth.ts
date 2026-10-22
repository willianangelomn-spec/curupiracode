/**
 * Antigravity CLI (`agy`) authentication actions. agy reads
 * `AGY_CLI_CDE_AUTH_ACTION` before anything else: `check` exits 0 only when a
 * Google sign-in is stored, and `login` prints the Google authorization URL on
 * stdout, reads the authorization code from stdin without a time limit, stores
 * the sign-in, and exits 0. Both run in an empty private directory so agy never
 * reads the server's working directory.
 */

import { spawn, type ChildProcessByStdio } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import { join } from 'node:path'
import type { Readable, Writable } from 'node:stream'

/** Environment variable selecting agy's authentication action. */
const AUTH_ACTION = 'AGY_CLI_CDE_AUTH_ACTION'
/** Google authorization URL agy prints for the human to open. */
const AUTHORIZATION_URL = /https:\/\/accounts\.google\.com\/o\/oauth2\/[^\s\u001B]+/u
/** Terminal color sequences agy writes around its prompts. */
const ANSI_SEQUENCE = /\u001B\[[0-9;]*m/gu
/** Upper bound on the characters of an authorization code a human pastes. */
export const MAX_AUTHORIZATION_CODE_LENGTH = 2048

/**
 * Resolve agy in the order `@deepseek-ai/dsh-llm-gemini` uses for generation,
 * so the card signs in the binary that later answers: `GEMINI_AGY_BINARY`, then
 * the installer's `~/.local/bin/agy` when it exists, then `agy` on `PATH`.
 * @returns the path or command name to spawn.
 */
export function agyBinary(): string {
  const override = process.env.GEMINI_AGY_BINARY
  if (override !== undefined && override !== '') return override
  const installed = join(os.homedir(), '.local', 'bin', 'agy')
  return existsSync(installed) ? installed : 'agy'
}

/** Raised when the agy executable cannot be started because it does not exist. */
export class AgyMissingError extends Error {
  override name = 'AgyMissingError'
}

/** Outcome of handing agy one authorization code. */
export type AgyLoginOutcome = { readonly ok: true } | { readonly ok: false; readonly message: string }

/** Remove terminal colors and surrounding whitespace from agy output. */
function plain(text: string): string {
  return text.replace(ANSI_SEQUENCE, '').trim()
}

/** Last non-empty line of agy output, without the URL, for a failure message. */
function lastLine(text: string): string {
  const lines = plain(text).split('\n').map(line => line.trim()).filter(line => line !== '' && !AUTHORIZATION_URL.test(line))
  return lines.at(-1) ?? ''
}

/**
 * Report whether agy holds a Google sign-in.
 * @param binary - agy executable path or command name.
 * @param signal - caller cancellation; aborting kills agy.
 * @returns true when agy reports a stored sign-in.
 * @throws {AgyMissingError} when the executable does not exist.
 */
export async function agySignedIn(binary: string, signal: AbortSignal): Promise<boolean> {
  const directory = await mkdtemp(join(os.tmpdir(), 'dsh-gemini-auth-'))
  try {
    return await new Promise<boolean>((resolve, reject) => {
      const child = spawn(binary, [], {
        cwd: directory,
        env: { ...process.env, [AUTH_ACTION]: 'check' },
        signal,
        stdio: ['ignore', 'ignore', 'ignore'],
      })
      child.on('error', (error: NodeJS.ErrnoException) => {
        reject(error.code === 'ENOENT' ? new AgyMissingError(`agy executable not found: ${binary}`, { cause: error }) : error)
      })
      child.on('close', (code) => { resolve(code === 0) })
    })
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
}

/** One running `agy` login, between printing its URL and receiving the code. */
export class AgyLogin {
  private output = ''
  private settled = false
  private readonly exit: Promise<number | null>

  private constructor(
    private readonly child: ChildProcessByStdio<Writable, Readable, Readable>,
    private readonly directory: string,
    /** Google authorization URL the human opens. */
    readonly url: string,
    exit: Promise<number | null>,
    output: string,
  ) {
    this.output = output
    this.exit = exit.then(async (code) => {
      this.settled = true
      await rm(this.directory, { recursive: true, force: true })
      return code
    })
    child.stdout.on('data', (data: Buffer) => { this.output += data.toString() })
    child.stderr.on('data', (data: Buffer) => { this.output += data.toString() })
  }

  /** Whether agy still waits for an authorization code. */
  get waiting(): boolean {
    return !this.settled
  }

  /**
   * Start `agy` in login mode and wait until it prints the authorization URL.
   * @param binary - agy executable path or command name.
   * @param signal - cancellation of this start; aborting kills agy.
   * @returns the running login.
   * @throws {AgyMissingError} when the executable does not exist; an Error with agy's last line when it exits before printing a URL.
   */
  static async start(binary: string, signal: AbortSignal): Promise<AgyLogin> {
    const directory = await mkdtemp(join(os.tmpdir(), 'dsh-gemini-auth-'))
    const child = spawn(binary, [], {
      cwd: directory,
      env: { ...process.env, [AUTH_ACTION]: 'login' },
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    const exit = new Promise<number | null>((resolve) => { child.on('close', resolve) })
    // EPIPE when agy exited before reading its code; the exit status reports that outcome.
    child.stdin.on('error', () => {})
    let output = ''
    let onAbort: (() => void) | undefined
    try {
      const url = await new Promise<string>((resolve, reject) => {
        onAbort = (): void => { reject(signal.reason instanceof Error ? signal.reason : new Error('agy sign-in start was cancelled')) }
        if (signal.aborted) onAbort()
        signal.addEventListener('abort', onAbort, { once: true })
        const read = (data: Buffer): void => {
          output += data.toString()
          const match = AUTHORIZATION_URL.exec(plain(output))
          if (match !== null) resolve(match[0])
        }
        child.stdout.on('data', read)
        child.stderr.on('data', read)
        child.on('error', (error: NodeJS.ErrnoException) => {
          reject(error.code === 'ENOENT' ? new AgyMissingError(`agy executable not found: ${binary}`, { cause: error }) : error)
        })
        void exit.then((code) => {
          reject(new Error(lastLine(output) || `agy exited with code ${String(code)} before printing a sign-in URL`))
        })
      }).finally(() => {
        if (onAbort !== undefined) signal.removeEventListener('abort', onAbort)
        child.stdout.removeAllListeners('data')
        child.stderr.removeAllListeners('data')
      })
      return new AgyLogin(child, directory, url, exit, output)
    } catch (error) {
      child.kill()
      await exit
      await rm(directory, { recursive: true, force: true })
      throw error
    }
  }

  /**
   * Hand agy the authorization code and wait for it to store the sign-in.
   * @param code - code Google showed after the human authorized the URL; one line.
   * @returns `ok` when agy exited 0, otherwise agy's last output line.
   */
  async submit(code: string): Promise<AgyLoginOutcome> {
    if (this.settled) return { ok: false, message: lastLine(this.output) || 'agy is no longer waiting for a code' }
    this.child.stdin.end(`${code}\n`)
    const status = await this.exit
    return status === 0 ? { ok: true } : { ok: false, message: lastLine(this.output) || `agy exited with code ${String(status)}` }
  }

  /** Stop waiting for a code and wait until agy exited. */
  async cancel(): Promise<void> {
    if (!this.settled) this.child.kill()
    await this.exit
  }
}
