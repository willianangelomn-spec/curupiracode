import { describe, expect, it } from 'vitest'
import { defineTool } from '@deepseek-ai/dsh-tools'
import type { ToolRunContext } from '@deepseek-ai/dsh-tools'

/**
 * Models sometimes emit a scalar where an array of strings is declared —
 * `{"queries": "term"}` instead of `{"queries": ["term"]}`. A real session
 * looped eight times on that exact mistake before abandoning `web_search`.
 * The harness wraps that lone string; every other mismatch still fails.
 */

const exec = { signal: new AbortController().signal } as ToolRunContext

/** Echoes the arguments `execute` actually received after coercion. */
function echoTool(parameters: Parameters<typeof defineTool>[0]['parameters']) {
  return defineTool({
    name: 'echo',
    description: 'Returns the arguments execute received.',
    parameters,
    output: { schema: { type: 'json' }, render: () => [] },
    async execute(args) {
      return args as never
    },
  })
}

describe('lone-string coercion for string-array parameters', () => {
  const searchLike = echoTool({
    queries: { type: 'array', required: true, items: { type: 'string' } },
  })

  it('wraps a lone string so the declared single-item intent runs', async () => {
    await expect(searchLike.execute({ queries: 'Mundo Novo Mato Grosso do Sul' }, exec))
      .resolves.toEqual({ queries: ['Mundo Novo Mato Grosso do Sul'] })
  })

  it('leaves a correctly typed array untouched', async () => {
    await expect(searchLike.execute({ queries: ['a', 'b'] }, exec))
      .resolves.toEqual({ queries: ['a', 'b'] })
  })

  it('still rejects shapes the wrap cannot explain', async () => {
    // A number is not the known model mistake: it stays a hard failure.
    await expect(searchLike.execute({ queries: 42 }, exec)).rejects.toThrow(/must be an array/)
    // An object likewise carries no unambiguous single-item reading.
    await expect(searchLike.execute({ queries: { q: 'a' } }, exec)).rejects.toThrow(/must be an array/)
    // A wrong element type inside a real array is a genuine error.
    await expect(searchLike.execute({ queries: [1] }, exec)).rejects.toThrow(/must be a string/)
  })

  it('does not touch arrays of non-strings', async () => {
    const numeric = echoTool({ sizes: { type: 'array', required: true, items: { type: 'number' } } })
    await expect(numeric.execute({ sizes: '3' }, exec)).rejects.toThrow(/must be an array/)
  })

  it('does not touch a parameter that is genuinely a string', async () => {
    const scalar = echoTool({ url: { type: 'string', required: true } })
    await expect(scalar.execute({ url: 'https://example.com' }, exec))
      .resolves.toEqual({ url: 'https://example.com' })
  })

  it('coerces only the eligible property and preserves the rest', async () => {
    const mixed = echoTool({
      queries: { type: 'array', required: true, items: { type: 'string' } },
      limit: { type: 'integer' },
    })
    await expect(mixed.execute({ queries: 'solo', limit: 5 }, exec))
      .resolves.toEqual({ queries: ['solo'], limit: 5 })
  })
})
