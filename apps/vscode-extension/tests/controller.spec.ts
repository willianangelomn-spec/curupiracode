/** The panel state machine with a stand-in runtime and VS Code host. */
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ChatController, type ControllerHost, type RuntimeStarter, type ToPanel } from '../src/controller.ts'
import type { EditorContext } from '../src/conversation.ts'
import { RUNTIME_ENTRY } from '../src/locate.ts'
import type { RuntimeListener, RuntimeRoute } from '../src/runtime.ts'

const roots: string[] = []
afterEach(async () => { await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true }))) })

async function checkout(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'curupira-checkout-'))
  roots.push(root)
  await mkdir(join(root, 'apps', 'cli', 'lib'), { recursive: true })
  await writeFile(join(root, RUNTIME_ENTRY), '')
  return root
}

/** A host over in-memory settings and a runtime that answers every prompt with its route. */
async function bench(options: { editor?: EditorContext; installPath?: string } = {}) {
  const installPath = options.installPath ?? await checkout()
  let model = 'gemini/gemini-4-argon-low'
  let session: string | undefined
  let next = 0
  const posted: ToPanel[] = []
  const routes: RuntimeRoute[] = []
  const disposed: RuntimeRoute[] = []
  let listener: RuntimeListener | undefined
  const openLink = vi.fn<(url: string) => void>()
  const pickInstallation = vi.fn(async (_message: string): Promise<string | undefined> => undefined)
  const prompt = vi.fn(async (sessionId: string, text: string) => {
    const route = routes.at(-1) as RuntimeRoute
    listener?.onStatus(sessionId, 'running')
    listener?.onEvent(sessionId, { type: 'assistant/message', data: { message: { content: [{ type: 'text', text: `${route.model}: ${text}` }] } } })
    listener?.onStatus(sessionId, 'idle')
    return 'm'
  })
  const start: RuntimeStarter = async (launch, route, observer) => {
    expect(launch.entry).toBe(join(installPath, RUNTIME_ENTRY))
    routes.push(route)
    listener = observer
    return { prompt, resume: vi.fn(async () => true), dispose: vi.fn(async () => { disposed.push(route) }) }
  }
  const host: ControllerHost = {
    workspaceFolders: () => ['/workspace'],
    installPath: () => installPath,
    nodePath: () => process.execPath,
    model: () => model,
    setModel: async (id) => { model = id },
    savedSession: () => session,
    saveSession: async (id) => { session = id },
    newSessionId: () => `s${String(++next)}`,
    editorContext: () => options.editor,
    openFull: vi.fn(),
    openLink,
    pickInstallation,
    post: (message) => { posted.push(message) },
  }
  const controller = new ChatController(host, start)
  const items = () => posted.flatMap(message => message.type === 'item' ? [message.item] : [])
  return { controller, host, prompt, openLink, pickInstallation, routes, disposed, items, session: () => session, state: () => posted.filter(message => message.type === 'state').at(-1) }
}

describe('ChatController', () => {
  it('starts the runtime on the first message and shows the answer', async () => {
    const b = await bench()
    await b.controller.handle({ type: 'send', text: '  oi  ', includeEditor: false })
    expect(b.routes).toEqual([{ provider: 'gemini', model: 'gemini-4-argon-low' }])
    expect(b.prompt).toHaveBeenCalledWith('s1', 'oi')
    expect(b.items()).toEqual([{ kind: 'user', text: 'oi' }, { kind: 'assistant', text: 'gemini-4-argon-low: oi' }])
    expect(b.session()).toBe('s1')
    expect(b.state()).toMatchObject({ busy: false, status: '' })
  })

  it('attaches the editor selection and notes when no editor is open', async () => {
    const editor: EditorContext = { path: 'a.ts', languageId: 'ts', text: 'x', startLine: 1, endLine: 1, selection: true }
    const withEditor = await bench({ editor })
    await withEditor.controller.handle({ type: 'send', text: 'explique', includeEditor: true })
    expect(withEditor.prompt.mock.calls[0]?.[1]).toContain('Contexto do editor (linhas 1–1 de a.ts):')
    const without = await bench()
    await without.controller.handle({ type: 'send', text: 'explique', includeEditor: true })
    expect(without.items()[0]).toEqual({ kind: 'notice', text: 'Nenhum arquivo aberto no editor; a mensagem vai sem contexto.' })
    expect(without.prompt).toHaveBeenCalledWith('s1', 'explique')
  })

  it('restarts on the new model and keeps the conversation', async () => {
    const b = await bench()
    await b.controller.handle({ type: 'send', text: 'um', includeEditor: false })
    await b.controller.handle({ type: 'selectModel', id: 'gemini/gemini-3.8-flash-low' })
    expect(b.disposed).toEqual([{ provider: 'gemini', model: 'gemini-4-argon-low' }])
    await b.controller.handle({ type: 'send', text: 'dois', includeEditor: false })
    expect(b.routes.at(-1)).toEqual({ provider: 'gemini', model: 'gemini-3.8-flash-low' })
    expect(b.prompt).toHaveBeenLastCalledWith('s1', 'dois')
  })

  it('starts a new conversation on request', async () => {
    const b = await bench()
    await b.controller.handle({ type: 'send', text: 'um', includeEditor: false })
    await b.controller.handle({ type: 'newConversation' })
    expect(b.session()).toBeUndefined()
    await b.controller.handle({ type: 'send', text: 'dois', includeEditor: false })
    expect(b.prompt).toHaveBeenLastCalledWith('s2', 'dois')
  })

  it('asks for the checkout when none is found and reports a refusal', async () => {
    const b = await bench({ installPath: '/nonexistent/curupiracode' })
    await b.controller.handle({ type: 'send', text: 'oi', includeEditor: false })
    expect(b.pickInstallation).toHaveBeenCalledOnce()
    expect(b.routes).toEqual([])
    expect(b.state()).toMatchObject({ busy: false })
  })

  it('opens only web links from answers', async () => {
    const b = await bench()
    await b.controller.handle({ type: 'openLink', url: 'https://ai.google.dev' })
    await b.controller.handle({ type: 'openLink', url: 'file:///etc/passwd' })
    expect(b.openLink).toHaveBeenCalledExactlyOnceWith('https://ai.google.dev')
  })
})
