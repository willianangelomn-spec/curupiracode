// @vitest-environment jsdom
import { Context } from '@deepseek-ai/cordis'
import { describe, expect, it, vi } from 'vitest'
import { apply, inject, PLUGIN_ID } from '../src/client/index.ts'

describe('Curupira Forest browser theme', () => {
  it('keeps markdown code surfaces dark and readable under either stock scheme', async () => {
    const ctx = new Context()
    const disposeLayer = vi.fn()
    const overrideTokens = vi.fn((_source: unknown, _tokens: unknown) => disposeLayer)
    ctx.provide('theme', { overrideTokens } as never)

    const fiber = ctx.plugin({ inject: [...inject], apply })
    await fiber.await()

    expect(overrideTokens).toHaveBeenCalledOnce()
    const [source, tokens] = overrideTokens.mock.calls[0]!
    expect(source).toBe(PLUGIN_ID)
    expect(tokens).toMatchObject({
      '--dsw-alias-markdown-code-block': { light: '#0e2718', dark: '#0e2718' },
      '--dsw-alias-markdown-inline-code': { light: '#1e482d', dark: '#1e482d' },
    })

    await fiber.dispose()
    expect(disposeLayer).toHaveBeenCalledOnce()
  })
})
