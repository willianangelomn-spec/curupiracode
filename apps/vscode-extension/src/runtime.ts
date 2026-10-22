/**
 * One CurupiraCode SDK runtime (`dsh --profile sdk`) owned by the extension.
 * The runtime speaks newline-delimited JSON-RPC on stdio; `initialize` fixes
 * the workspace directory and the provider/model route for the whole process,
 * so changing the model means starting another runtime and resuming the
 * conversation there.
 */

import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { JsonRpcLineTransport } from '@deepseek-ai/dsh-sdk-protocol'

/** How to start the runtime. */
export interface RuntimeLaunch {
  /** System Node.js executable. */
  readonly node: string
  /** Built CurupiraCode CLI entry. */
  readonly entry: string
  /** Workspace directory every conversation runs in. */
  readonly cwd: string
  /** Complete child environment. */
  readonly env: NodeJS.ProcessEnv
}

/** Provider route and model the runtime answers with. */
export interface RuntimeRoute {
  readonly provider: string
  readonly model: string
}

/** One session-log event as the runtime notifies it. */
export interface RuntimeSessionEvent {
  readonly type: string
  readonly data?: unknown
}

/** What the runtime reports while it runs. */
export interface RuntimeListener {
  /** A durable event of one session. */
  onEvent(sessionId: string, event: RuntimeSessionEvent): void
  /** A session's agent started or stopped working. */
  onStatus(sessionId: string, status: 'idle' | 'running'): void
  /** The process ended; `detail` carries its exit status and stderr tail. */
  onExit(detail: string): void
}

/** Lines of stderr kept to explain a failed start or an unexpected exit. */
const STDERR_TAIL_LINES = 30
/** Bound on the protocol `shutdown` request before the process is signalled. */
const SHUTDOWN_TIMEOUT_MS = 2000
/** Grace between closing stdin, SIGTERM, and SIGKILL. */
const EXIT_GRACE_MS = 2000

/** Read the session id and event out of one `session.event` notification. */
function sessionEvent(params: Record<string, unknown>): [string, RuntimeSessionEvent] | undefined {
  const event = params.event
  if (typeof params.sessionId !== 'string' || typeof event !== 'object' || event === null) return undefined
  const type = (event as { type?: unknown }).type
  if (typeof type !== 'string') return undefined
  return [params.sessionId, { type, data: (event as { data?: unknown }).data }]
}

/** Resolve after `ms`, or immediately when the promise settles first. */
function within<T>(promise: Promise<T>, ms: number): Promise<T | undefined> {
  return Promise.race([promise, new Promise<undefined>((resolve) => { setTimeout(() => { resolve(undefined) }, ms).unref() })])
}

/** A started runtime; {@link dispose} always reaps the process. */
export class CurupiraRuntime {
  private disposed = false

  private constructor(
    private readonly child: ChildProcessWithoutNullStreams,
    private readonly transport: JsonRpcLineTransport,
    private readonly exited: Promise<number | null>,
  ) {}

  /**
   * Start the runtime and complete the `initialize` handshake.
   * @param launch - executable, entry, workspace, and environment.
   * @param route - provider and model for every conversation of this runtime.
   * @param listener - receives events, status changes, and the exit.
   * @param initializeTimeoutMs - bound on startup plus handshake.
   * @returns the ready runtime.
   * @throws {Error} with the runtime's stderr tail when it fails to start, exits, or does not answer in time.
   */
  static async start(
    launch: RuntimeLaunch,
    route: RuntimeRoute,
    listener: RuntimeListener,
    initializeTimeoutMs: number,
  ): Promise<CurupiraRuntime> {
    const child = spawn(launch.node, [launch.entry, '--profile', 'sdk'], { cwd: launch.cwd, env: launch.env, stdio: ['pipe', 'pipe', 'pipe'] })
    const stderr: string[] = []
    child.stderr.setEncoding('utf8')
    child.stderr.on('data', (chunk: string) => {
      stderr.push(...chunk.split('\n').filter(line => line.trim() !== ''))
      stderr.splice(0, Math.max(0, stderr.length - STDERR_TAIL_LINES))
    })
    // EPIPE when the runtime already exited; the exit status reports that outcome.
    child.stdin.on('error', () => {})
    const transport = new JsonRpcLineTransport(child.stdout, child.stdin)
    let ready = false
    const owner: { runtime?: CurupiraRuntime } = {}
    const exited = new Promise<number | null>((resolve) => {
      child.on('close', (code) => {
        transport.close()
        // Only an exit nobody asked for is news; dispose() reaps the process on purpose.
        if (ready && owner.runtime?.disposed !== true) {
          listener.onExit(`O CurupiraCode encerrou (código ${String(code)}).\n${stderr.join('\n')}`.trim())
        }
        resolve(code)
      })
    })
    const spawnFailed = new Promise<never>((_resolve, reject) => {
      child.on('error', (error: NodeJS.ErrnoException) => {
        reject(new Error(error.code === 'ENOENT' ? `Node.js não encontrado em "${launch.node}".` : error.message, { cause: error }))
      })
    })
    transport.onNotification((method, params) => {
      if (method === 'session.event') {
        const read = sessionEvent(params)
        if (read !== undefined) listener.onEvent(...read)
      } else if (method === 'session.status' && typeof params.sessionId === 'string' && (params.status === 'idle' || params.status === 'running')) {
        listener.onStatus(params.sessionId, params.status)
      }
    })
    transport.start()
    const runtime = new CurupiraRuntime(child, transport, exited)
    owner.runtime = runtime
    const timeout = new AbortController()
    try {
      await Promise.race([
        transport.request('initialize', { cwd: launch.cwd, provider: route.provider, model: route.model }, timeout.signal)
          .catch(async (error: unknown) => {
            // A runtime that dies first closes stdout before its exit status arrives; report the exit.
            const code = await within(exited, EXIT_GRACE_MS)
            throw code === undefined ? error : new Error(`O CurupiraCode encerrou ao iniciar (código ${String(code)}).`)
          }),
        spawnFailed,
        exited.then((code) => { throw new Error(`O CurupiraCode encerrou ao iniciar (código ${String(code)}).`) }),
        new Promise<never>((_resolve, reject) => {
          setTimeout(() => { reject(new Error(`O CurupiraCode não respondeu em ${String(initializeTimeoutMs / 1000)} s.`)) }, initializeTimeoutMs).unref()
        }),
      ])
      ready = true
      return runtime
    } catch (error) {
      timeout.abort()
      await runtime.dispose()
      const message = error instanceof Error ? error.message : String(error)
      throw new Error(`${message}\n${stderr.join('\n')}`.trim(), { cause: error })
    }
  }

  /**
   * Queue one user message; the answer arrives through the listener.
   * @param sessionId - conversation id; an unknown id starts a new conversation.
   * @param text - message text, editor context included.
   * @returns the queued message id.
   */
  async prompt(sessionId: string, text: string): Promise<string> {
    const result = await this.transport.request('session/prompt', { sessionId, contentBlocks: [{ type: 'text', text }] })
    const messageId = (result as { messageId?: unknown } | null)?.messageId
    if (typeof messageId !== 'string') throw new Error('O CurupiraCode respondeu fora do protocolo ao enviar a mensagem.')
    return messageId
  }

  /**
   * Reopen a stored conversation in this runtime.
   * @param sessionId - persisted conversation id.
   * @returns false when the runtime has no such conversation.
   */
  resume(sessionId: string): Promise<boolean> {
    // A rejection means a missing, unreadable, or occupied session; the caller starts a new conversation instead.
    return this.transport.request('session/resume', { sessionId }).then(() => true, () => false)
  }

  /** Stop the runtime: protocol shutdown, then stdin EOF, SIGTERM, and SIGKILL until it exited. Idempotent. */
  async dispose(): Promise<void> {
    if (!this.disposed) {
      this.disposed = true
      if (this.child.exitCode === null && this.child.signalCode === null) {
        await within(this.transport.request('shutdown', {}).catch(() => undefined), SHUTDOWN_TIMEOUT_MS)
        this.child.stdin.end()
        if (await within(this.exited, EXIT_GRACE_MS) === undefined) {
          this.child.kill('SIGTERM')
          if (await within(this.exited, EXIT_GRACE_MS) === undefined) this.child.kill('SIGKILL')
        }
      }
    }
    await this.exited
  }
}
