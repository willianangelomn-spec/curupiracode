/**
 * The chat panel's state machine, independent of the VS Code API: it starts
 * the runtime on the first message, keeps one conversation per workspace,
 * restarts the runtime when the model changes, and turns runtime events into
 * transcript entries.
 */

import { chatItemOf, modelChoices, routeOf, withEditorContext, type ChatItem, type EditorContext, type ModelChoice } from './conversation.ts'
import { findInstallation, findNode, runtimeEnvironment } from './locate.ts'
import { CurupiraRuntime, type RuntimeLaunch, type RuntimeListener, type RuntimeRoute, type RuntimeSessionEvent } from './runtime.ts'

/** Messages the panel sends. */
export type FromPanel =
  | { readonly type: 'ready' }
  | { readonly type: 'send'; readonly text: string; readonly includeEditor: boolean }
  | { readonly type: 'newConversation' }
  | { readonly type: 'selectModel'; readonly id: string }
  | { readonly type: 'stop' }
  | { readonly type: 'openFull' }
  | { readonly type: 'openLink'; readonly url: string }

/** Messages the panel receives. */
export type ToPanel =
  | { readonly type: 'state'; readonly models: readonly ModelChoice[]; readonly model: string; readonly busy: boolean; readonly status: string }
  | { readonly type: 'reset'; readonly items: readonly ChatItem[] }
  | { readonly type: 'item'; readonly item: ChatItem }

/** What the controller needs from VS Code. */
export interface ControllerHost {
  /** Open workspace folder paths; the first one is the conversation's directory. */
  workspaceFolders(): readonly string[]
  /** `curupiracode.installPath`; empty when unset. */
  installPath(): string
  /** `curupiracode.nodePath`; empty when unset. */
  nodePath(): string
  /** `curupiracode.model` as `provider/model`. */
  model(): string
  /** Persist the `curupiracode.model` choice. */
  setModel(id: string): Promise<void>
  /** Conversation id stored for this workspace. */
  savedSession(): string | undefined
  /** Store or clear this workspace's conversation id. */
  saveSession(id: string | undefined): Promise<void>
  /** A fresh conversation id. */
  newSessionId(): string
  /** The active editor's selection, or its whole file without a selection; undefined without an editor. */
  editorContext(): EditorContext | undefined
  /** Open the full Web interface in the browser. */
  openFull(): void
  /** Open one http(s) link from an answer in the browser. */
  openLink(url: string): void
  /** Ask the user to pick the CurupiraCode checkout; resolves to the chosen path, or undefined. */
  pickInstallation(message: string): Promise<string | undefined>
  /** Deliver one message to the panel; dropped while the panel is hidden. */
  post(message: ToPanel): void
}

/** Bound on runtime startup plus handshake; the first start compiles nothing but loads every plugin. */
export const INITIALIZE_TIMEOUT_MS = 120_000

/** Starts runtimes; replaced in tests. */
export type RuntimeStarter = (launch: RuntimeLaunch, route: RuntimeRoute, listener: RuntimeListener) => Promise<Pick<CurupiraRuntime, 'prompt' | 'resume' | 'dispose'>>

const startRuntime: RuntimeStarter = (launch, route, listener) => CurupiraRuntime.start(launch, route, listener, INITIALIZE_TIMEOUT_MS)

/** The chat panel controller for one VS Code window. */
export class ChatController {
  private runtime: Awaited<ReturnType<RuntimeStarter>> | undefined
  private runtimeModel: string | undefined
  private starting: Promise<void> | undefined
  private readonly items: ChatItem[] = []
  private busy = false
  private status = ''
  private sessionId: string | undefined
  private disposed = false

  /**
   * @param host - VS Code services and settings.
   * @param start - runtime factory.
   */
  constructor(private readonly host: ControllerHost, private readonly start: RuntimeStarter = startRuntime) {
    this.sessionId = host.savedSession()
  }

  /**
   * Act on one panel message.
   * @param message - what the panel sent.
   * @returns after the action's synchronous part; long work reports through the panel.
   */
  async handle(message: FromPanel): Promise<void> {
    switch (message.type) {
      case 'ready':
        this.host.post({ type: 'reset', items: [...this.items] })
        this.postState()
        return
      case 'send':
        await this.send(message.text, message.includeEditor)
        return
      case 'newConversation':
        await this.newConversation()
        return
      case 'selectModel':
        await this.selectModel(message.id)
        return
      case 'stop':
        await this.stop()
        return
      case 'openFull':
        this.host.openFull()
        return
      case 'openLink':
        // Answers are model output: only web links leave the panel.
        if (/^https?:\/\//u.test(message.url)) this.host.openLink(message.url)
        return
    }
  }

  /**
   * Send one message, starting or restarting the runtime when needed.
   * @param text - what the user typed.
   * @param includeEditor - whether to attach the active editor's selection or file.
   */
  async send(text: string, includeEditor: boolean): Promise<void> {
    const trimmed = text.trim()
    if (trimmed === '' || this.busy) return
    let prompt = trimmed
    if (includeEditor) {
      const context = this.host.editorContext()
      if (context === undefined) this.push({ kind: 'notice', text: 'Nenhum arquivo aberto no editor; a mensagem vai sem contexto.' })
      else prompt = withEditorContext(trimmed, context)
    }
    this.push({ kind: 'user', text: trimmed })
    this.setBusy(true, 'Iniciando o CurupiraCode…')
    try {
      await this.ensureRuntime()
      const runtime = this.runtime
      if (runtime === undefined) {
        this.setBusy(false, '')
        return
      }
      if (this.sessionId === undefined) {
        this.sessionId = this.host.newSessionId()
        await this.host.saveSession(this.sessionId)
      }
      this.setBusy(true, 'Pensando…')
      await runtime.prompt(this.sessionId, prompt)
    } catch (error) {
      this.push({ kind: 'error', text: error instanceof Error ? error.message : String(error) })
      this.setBusy(false, '')
    }
  }

  /** Forget the current conversation; the next message starts a new one. */
  async newConversation(): Promise<void> {
    this.sessionId = undefined
    await this.host.saveSession(undefined)
    this.items.length = 0
    this.host.post({ type: 'reset', items: [] })
    this.postState()
  }

  /**
   * Switch the model; the next message starts a runtime on the new route and resumes the conversation.
   * @param id - `provider/model`.
   */
  async selectModel(id: string): Promise<void> {
    if (routeOf(id) === undefined || id === this.host.model()) return
    await this.host.setModel(id)
    if (!this.busy) await this.stopRuntime()
    this.postState()
  }

  /** Interrupt the answer by stopping the runtime; the next message resumes the conversation. */
  async stop(): Promise<void> {
    if (!this.busy) return
    await this.stopRuntime()
    this.push({ kind: 'notice', text: 'Resposta interrompida.' })
    this.setBusy(false, '')
  }

  /** Stop the runtime for good. */
  async dispose(): Promise<void> {
    this.disposed = true
    await this.stopRuntime()
  }

  private async ensureRuntime(): Promise<void> {
    while (this.starting !== undefined) await this.starting
    if (this.runtime !== undefined && this.runtimeModel === this.host.model()) return
    const starting = this.startRuntime()
    this.starting = starting
    try {
      await starting
    } finally {
      this.starting = undefined
    }
  }

  private async startRuntime(): Promise<void> {
    await this.stopRuntime()
    const model = this.host.model()
    const route = routeOf(model)
    if (route === undefined) throw new Error(`Modelo inválido em curupiracode.model: "${model}". Use provedor/modelo, por exemplo gemini/gemini-4-argon-low.`)
    const cwd = this.host.workspaceFolders()[0]
    if (cwd === undefined) throw new Error('Abra uma pasta no VS Code: o CurupiraCode trabalha dentro dela.')
    let installation = findInstallation(this.host.installPath(), this.host.workspaceFolders())
    if (!installation.ok) {
      const picked = await this.host.pickInstallation(installation.reason === 'configured-invalid'
        ? `A pasta configurada em curupiracode.installPath não tem o CurupiraCode compilado: ${installation.configured}. Rode "pnpm install && pnpm run build" nela ou escolha outra pasta.`
        : 'Escolha a pasta onde você clonou e compilou o CurupiraCode (pnpm install && pnpm run build).')
      if (picked === undefined) return
      installation = findInstallation(picked, [])
      if (!installation.ok) throw new Error(`A pasta ${picked} não tem o CurupiraCode compilado (apps/cli/lib/bin.js). Rode "pnpm install && pnpm run build" nela.`)
    }
    const node = await findNode(this.host.nodePath())
    const listener: RuntimeListener = {
      onEvent: (sessionId, event) => { this.onEvent(sessionId, event) },
      onStatus: (sessionId, status) => { this.onStatus(sessionId, status) },
      onExit: (detail) => { this.onExit(detail) },
    }
    const runtime = await this.start({ node, entry: installation.entry, cwd, env: runtimeEnvironment(node) }, route, listener)
    if (this.disposed) {
      await runtime.dispose()
      return
    }
    this.runtime = runtime
    this.runtimeModel = model
    if (this.sessionId !== undefined && !await runtime.resume(this.sessionId)) {
      this.sessionId = undefined
      await this.host.saveSession(undefined)
    }
  }

  private async stopRuntime(): Promise<void> {
    const runtime = this.runtime
    this.runtime = undefined
    this.runtimeModel = undefined
    await runtime?.dispose()
  }

  private onEvent(sessionId: string, event: RuntimeSessionEvent): void {
    if (sessionId !== this.sessionId) return
    const item = chatItemOf(event)
    if (item !== undefined) this.push(item)
    if (item?.kind === 'tool') this.setBusy(true, `Usando ${item.name}…`)
  }

  private onStatus(sessionId: string, status: 'idle' | 'running'): void {
    if (sessionId !== this.sessionId) return
    this.setBusy(status === 'running', status === 'running' ? 'Pensando…' : '')
  }

  private onExit(detail: string): void {
    this.runtime = undefined
    this.runtimeModel = undefined
    if (this.disposed) return
    this.push({ kind: 'error', text: detail })
    this.setBusy(false, '')
  }

  private push(item: ChatItem): void {
    this.items.push(item)
    this.host.post({ type: 'item', item })
  }

  private setBusy(busy: boolean, status: string): void {
    this.busy = busy
    this.status = status
    this.postState()
  }

  private postState(): void {
    const model = this.host.model()
    this.host.post({ type: 'state', models: modelChoices(model), model, busy: this.busy, status: this.status })
  }
}
