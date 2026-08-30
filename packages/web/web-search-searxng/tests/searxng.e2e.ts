import { describe, expect, it } from 'vitest'
import { SearxngSearchProvider } from '../src/provider.ts'

const baseURL = process.env.SEARXNG_URL?.trim()

describe.skipIf(baseURL === undefined || baseURL.length === 0)('SearXNG live endpoint', () => {
  it('returns portable sources from the configured instance', async () => {
    const provider = new SearxngSearchProvider(() => ({
      baseURL: baseURL ?? '',
      categories: ['general'],
      language: 'pt-BR',
      timeoutMs: 15000,
    }))
    const result = await provider.search({ query: 'Curupira Brasil', maxResults: 5 })
    expect(result.sources.length).toBeGreaterThan(0)
    expect(result.sources.slice(0, 5).every(source => URL.canParse(source.url))).toBe(true)
  })
})
