import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import Loader from '@deepseek-ai/cordis-plugin-loader'
import Include from '@deepseek-ai/cordis-plugin-include'
import {
  createLaunchEnvironmentSnapshot,
  DSH_LAUNCH_ENVIRONMENT_KEY,
} from '@deepseek-ai/dsh-launch-environment'
import WebRuntime from '@deepseek-ai/dsh-web'
import * as searxngPlugin from '@deepseek-ai/dsh-web-search-searxng'
import {
  mapSearxngResponse,
  SEARXNG_PROVIDER_ID,
  searxngSearchUrl,
  SearxngSearchProvider,
} from '../src/provider.ts'
import type { SearxngSearchProviderOptions } from '../src/provider.ts'

const options: SearxngSearchProviderOptions = {
  baseURL: 'https://search.example/curupira/',
  categories: ['general', 'news'],
  language: 'pt-BR',
  engines: ['duckduckgo', 'wikipedia'],
  safeSearch: 1,
  timeRange: 'month',
  timeoutMs: 5000,
}

const responsePayload = {
  answers: ['Resposta curta', 'Contexto adicional'],
  results: [
    {
      url: 'https://example.com/guia',
      title: 'Guia aberto',
      content: 'Uma referência pública.',
      publishedDate: '2026-08-28T12:00:00Z',
    },
    {
      url: 'https://example.org/projeto',
      title: 'Projeto Curupira',
      content: 'Código brasileiro.',
      published_date: '2026-08-27',
    },
  ],
}

let root: string | undefined
let context: Context | undefined

afterEach(async () => {
  await context?.fiber.dispose()
  context = undefined
  if (root !== undefined) await rm(root, { recursive: true, force: true })
  root = undefined
  vi.unstubAllGlobals()
})

describe('SearXNG response mapping', () => {
  it('normalizes answers, sources, snippets, and both publication date spellings', () => {
    expect(mapSearxngResponse(responsePayload)).toEqual({
      content: 'Resposta curta\n\nContexto adicional',
      sources: [
        {
          url: 'https://example.com/guia',
          title: 'Guia aberto',
          snippet: 'Uma referência pública.',
          publishedAt: '2026-08-28T12:00:00Z',
        },
        {
          url: 'https://example.org/projeto',
          title: 'Projeto Curupira',
          snippet: 'Código brasileiro.',
          publishedAt: '2026-08-27',
        },
      ],
      truncated: false,
    })
  })

  it('drops malformed and duplicate rows without inventing metadata', () => {
    expect(mapSearxngResponse({
      results: [
        { url: 'javascript:alert(1)', title: 'unsafe' },
        { title: 'missing URL' },
        { url: 'https://example.com/path', title: 'first' },
        { url: 'https://example.com/path', title: 'duplicate' },
        { url: 'https://example.net/' },
      ],
    })).toEqual({
      sources: [
        { url: 'https://example.com/path', title: 'first' },
        { url: 'https://example.net/' },
      ],
      truncated: false,
    })
  })

  it('rejects a malformed response envelope', () => {
    expect(() => mapSearxngResponse({ results: 'not-an-array' }))
      .toThrow(expect.objectContaining({ code: 'WEB_PROVIDER_ERROR' }))
  })

  it('preserves a base path when building the search endpoint', () => {
    expect(searxngSearchUrl('https://example.com/prefix').href)
      .toBe('https://example.com/prefix/search')
  })
})

describe('SearxngSearchProvider', () => {
  it('posts every configured search control and rejects redirects', async () => {
    const fetchMock = vi.fn(async (_url: string | URL, _init?: RequestInit) => Response.json(responsePayload))
    vi.stubGlobal('fetch', fetchMock)

    const result = await new SearxngSearchProvider(() => options)
      .search({ query: '  agentes brasileiros  ', maxResults: 2 })

    expect(result.sources).toHaveLength(2)
    expect(fetchMock).toHaveBeenCalledOnce()
    const [url, init] = fetchMock.mock.calls[0] ?? []
    expect(String(url)).toBe('https://search.example/curupira/search')
    expect(init).toMatchObject({ method: 'POST', redirect: 'error' })
    if (typeof init?.body !== 'string') throw new Error('expected a form-encoded string request body')
    const body = new URLSearchParams(init.body)
    expect(Object.fromEntries(body)).toEqual({
      q: 'agentes brasileiros',
      format: 'json',
      categories: 'general,news',
      language: 'pt-BR',
      engines: 'duckduckgo,wikipedia',
      safesearch: '1',
      time_range: 'month',
    })
  })

  it('reports availability from local configuration only', () => {
    expect(new SearxngSearchProvider(() => options).available()).toBe(true)
    expect(new SearxngSearchProvider(() => ({ ...options, baseURL: '' })).available()).toBe(false)
    expect(new SearxngSearchProvider(() => ({ ...options, baseURL: 'file:///tmp/search' })).available()).toBe(false)
    expect(new SearxngSearchProvider(() => ({ ...options, categories: [] })).available()).toBe(false)
    expect(new SearxngSearchProvider(() => ({ ...options, safeSearch: 3 })).available()).toBe(false)
  })

  it('classifies HTTP, network, caller-abort, and deadline failures', async () => {
    const provider = new SearxngSearchProvider(() => options)
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 403 })))
    await expect(provider.search({ query: 'q' })).rejects.toThrow(/JSON format is enabled/)

    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('offline') }))
    await expect(provider.search({ query: 'q' }))
      .rejects.toThrow(expect.objectContaining({ code: 'WEB_PROVIDER_ERROR' }))

    const controller = new AbortController()
    controller.abort('cancelled')
    await expect(provider.search({ query: 'q' }, controller.signal))
      .rejects.toThrow(expect.objectContaining({ code: 'WEB_ABORTED' }))

    const short = new SearxngSearchProvider(() => ({ ...options, timeoutMs: 1 }))
    vi.stubGlobal('fetch', vi.fn((_url: URL, init?: RequestInit) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => {
        reject(new Error('request aborted', { cause: init.signal?.reason }))
      }, { once: true })
    })))
    await expect(short.search({ query: 'q' })).rejects.toThrow(/timed out after 1 ms/)
  })
})

describe('web-search-searxng plugin', () => {
  it('has named exports only and resolves SEARXNG_URL from the launch snapshot', async () => {
    expect('default' in searxngPlugin).toBe(false)
    context = new Context()
    context.provide(DSH_LAUNCH_ENVIRONMENT_KEY, createLaunchEnvironmentSnapshot([
      { source: 'process', values: { SEARXNG_URL: 'https://environment.example/' } },
    ]))
    expect(searxngPlugin.resolveOptions(context)).toMatchObject({
      baseURL: 'https://environment.example/',
      categories: ['general'],
      timeoutMs: 15000,
    })
  })

  it('unregisters its provider when the plugin fiber is disposed (HMR safety)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json(responsePayload)))
    context = new Context()
    await context.plugin(WebRuntime, { searchProvider: SEARXNG_PROVIDER_ID })
    const fiber = await context.plugin(searxngPlugin, { baseURL: options.baseURL })
    await expect(context.web.search({ query: 'curupira', maxResults: 1 }))
      .resolves.toMatchObject({ sources: [{ url: 'https://example.com/guia' }] })
    await fiber.dispose()
    await expect(context.web.search({ query: 'curupira' }))
      .rejects.toThrow(expect.objectContaining({ code: 'WEB_PROVIDER_CONFIGURED_MISSING' }))
  })
})

describe('real Loader composition', () => {
  it('unwraps the named plugin, executes search, and unloads the registration', async () => {
    root = await mkdtemp(join(tmpdir(), 'curupiracode-searxng-loader-'))
    const configPath = join(root, 'cordis.yml')
    await writeFile(configPath, [
      "- name: '@deepseek-ai/dsh-web'",
      '  config:',
      '    searchProvider: searxng',
      "- name: '@deepseek-ai/dsh-web-search-searxng'",
      '  config:',
      '    baseURL: https://search.example/curupira/',
      '',
    ].join('\n'))
    vi.stubGlobal('fetch', vi.fn(async () => Response.json(responsePayload)))

    context = new Context()
    context.baseUrl = pathToFileURL(root).href + '/'
    await context.plugin(Loader)
    context.loader.builtins.include = Include
    const modules = new Map<string, unknown>([
      ['@deepseek-ai/dsh-web', WebRuntime],
      ['@deepseek-ai/dsh-web-search-searxng', searxngPlugin],
    ])
    context.loader.internal = {
      version: 'v2',
      async import(specifier: string) {
        if (!modules.has(specifier)) throw new Error(`unexpected Loader import: ${specifier}`)
        return modules.get(specifier)
      },
    } as unknown as NonNullable<typeof context.loader.internal>
    await context.loader.create({
      name: 'cordis:include',
      config: { path: pathToFileURL(configPath).href },
    })
    await context.loader.await()

    await expect(context.web.search({ query: 'curupira', maxResults: 1 }))
      .resolves.toMatchObject({ sources: [{ title: 'Guia aberto' }] })
    const entry = [...context.loader.entries()]
      .find(candidate => candidate.options.name === '@deepseek-ai/dsh-web-search-searxng')
    expect(entry?.fiber).toBeDefined()
    await entry?.fiber?.dispose()
    await expect(context.web.search({ query: 'curupira' }))
      .rejects.toThrow(expect.objectContaining({ code: 'WEB_PROVIDER_CONFIGURED_MISSING' }))
  })
})
