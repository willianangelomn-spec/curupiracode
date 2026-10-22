import { Context } from '@deepseek-ai/cordis'
import { describe, expect, it, vi } from 'vitest'
import type { LlmAdapter, LlmConfigurableProvider, LlmDiscoveredModel } from '@deepseek-ai/dsh-llm'
import * as plugin from '../src/index.ts'

/** Mount the plugin beside a recording `llm` service and return what it registered. */
async function mount(models: readonly Record<string, unknown>[] = []) {
  const ctx = new Context()
  const adapters: LlmAdapter[] = []
  const directory: LlmConfigurableProvider[] = []
  const discoveries = new Map<string, () => Promise<readonly LlmDiscoveredModel[]>>()
  ctx.provide('llm', {
    registerAdapter: vi.fn((_routes: readonly string[], adapter: LlmAdapter) => { adapters.push(adapter); return () => {} }),
    registerConfigurableProviders: vi.fn((entries: readonly LlmConfigurableProvider[]) => { directory.push(...entries); return () => {} }),
    registerModelDiscovery: vi.fn((ns: string, discover: () => Promise<readonly LlmDiscoveredModel[]>) => {
      discoveries.set(ns, discover)
      return () => {}
    }),
  } as never)
  // The Loader passes raw config; the plugin schema wraps `models` in its volatile reference.
  const fiber = ctx.plugin(plugin, { models } as never)
  await fiber.await()
  return { adapters, directory, discoveries, fiber }
}

describe('llm-gemini plugin', () => {
  it('lists Google Gemini as a keyless configurable provider', async () => {
    const { directory } = await mount()
    expect(directory).toEqual([{
      provider: 'gemini',
      displayName: plugin.PROVIDER_NAME,
      settingsNs: 'llm-gemini',
      settingsPath: [],
      declared: false,
      nativeAuth: { env: [], oauth: true },
    }])
  })

  it('discovers Gemini 4 Argon first and the configured models over the shipped catalog', async () => {
    const { adapters, discoveries } = await mount([
      { id: 'claude-opus-5-5-thinking', name: 'Claude Opus 5.5 (Thinking)' },
      { id: 'gemini-4-argon-low', name: 'Argon Low (custom)', images: true },
    ])
    const discovered = await discoveries.get('llm-gemini')?.()
    expect(discovered?.[0]?.id).toBe('gemini-4-argon-high')
    expect(discovered?.find(model => model.id === 'gemini-4-argon-low')?.name).toBe('Argon Low (custom)')
    expect(discovered?.at(-1)).toEqual({ id: 'claude-opus-5-5-thinking', name: 'Claude Opus 5.5 (Thinking)', contextWindow: 1_048_576 })
    const resolved = await adapters[0]?.resolveModel('gemini', 'claude-opus-5-5-thinking')
    expect(resolved?.name).toBe('Claude Opus 5.5 (Thinking)')
  })

  it('refuses a model id outside the effective catalog', async () => {
    const { adapters } = await mount()
    await expect(Promise.resolve().then(() => adapters[0]?.resolveModel('gemini', 'gemini-unknown')))
      .rejects.toMatchObject({ code: 'UNKNOWN_MODEL' })
  })
})
