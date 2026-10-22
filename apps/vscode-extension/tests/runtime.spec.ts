/** The runtime client against a stand-in that speaks the SDK JSON-RPC protocol. */
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CurupiraRuntime, type RuntimeListener } from '../src/runtime.ts'

const entry = fileURLToPath(new URL('./fake-runtime.mjs', import.meta.url))
const runtimes: CurupiraRuntime[] = []
afterEach(async () => { await Promise.all(runtimes.splice(0).map(runtime => runtime.dispose())) })

function listener(): RuntimeListener & { events: unknown[]; statuses: string[]; exits: string[] } {
  const events: unknown[] = []
  const statuses: string[] = []
  const exits: string[] = []
  return {
    events, statuses, exits,
    onEvent: (sessionId, event) => { events.push([sessionId, event]) },
    onStatus: (_sessionId, status) => { statuses.push(status) },
    onExit: (detail) => { exits.push(detail) },
  }
}

function start(mode: string, observer: RuntimeListener, timeoutMs = 10_000): Promise<CurupiraRuntime> {
  return CurupiraRuntime.start(
    { node: process.execPath, entry, cwd: process.cwd(), env: { ...process.env, FAKE_RUNTIME: mode } },
    { provider: 'gemini', model: 'gemini-4-argon-low' },
    observer,
    timeoutMs,
  ).then((runtime) => {
    runtimes.push(runtime)
    return runtime
  })
}

describe('CurupiraRuntime', () => {
  it('initializes the route, queues a prompt, and reports its events and status', async () => {
    const observer = listener()
    const runtime = await start('normal', observer)
    expect(await runtime.prompt('s1', 'oi')).toBe('m1')
    await vi.waitFor(() => { expect(observer.statuses).toEqual(['running', 'idle']) })
    expect(observer.events).toEqual([
      ['s1', { type: 'tool/call', data: { name: 'read' } }],
      ['s1', { type: 'assistant/message', data: { message: { content: [{ type: 'text', text: `gemini/gemini-4-argon-low em ${process.cwd()}: oi` }] } } }],
    ])
    expect(await runtime.resume('known')).toBe(true)
    expect(await runtime.resume('missing')).toBe(false)
    await runtime.dispose()
    expect(observer.exits).toEqual([])
  })

  it('explains a runtime that exits during startup with its stderr', async () => {
    await expect(start('crash', listener())).rejects.toThrow(/encerrou ao iniciar \(código 3\)\.\nError: plugin llm-gemini failed/)
  })

  it('gives up on a runtime that never answers and reaps it', async () => {
    await expect(start('silent', listener(), 300)).rejects.toThrow('não respondeu em 0.3 s')
  })

  it('names a missing Node.js', async () => {
    await expect(CurupiraRuntime.start(
      { node: '/nonexistent/node', entry, cwd: process.cwd(), env: process.env },
      { provider: 'gemini', model: 'x' }, listener(), 5000,
    )).rejects.toThrow('Node.js não encontrado em "/nonexistent/node".')
  })
})
