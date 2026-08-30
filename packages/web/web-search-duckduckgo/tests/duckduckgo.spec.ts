import { Context } from '@deepseek-ai/cordis'
import WebRuntime from '@deepseek-ai/dsh-web'
import * as duckDuckGoPlugin from '@deepseek-ai/dsh-web-search-duckduckgo'
import {
  decodeHtmlText,
  DuckDuckGoSearchProvider,
  DUCKDUCKGO_PROVIDER_ID,
  mergeResults,
  parseBingHtml,
  parseDuckDuckGoHtml,
  parseGoogleNewsRss,
  resolveResultHref,
} from '../src/provider.ts'
import type { DuckDuckGoSearchProviderOptions } from '../src/provider.ts'
import { afterEach, describe, expect, it, vi } from 'vitest'

const options: DuckDuckGoSearchProviderOptions = {
  baseURL: 'https://duckduckgo.test/html/',
  newsBaseURL: 'https://news.test/rss/search',
  bingBaseURL: 'https://bing.test/search',
  bingMarket: 'pt-BR',
  fallbackToBing: true,
  locale: 'pt-BR',
  country: 'BR',
  includeGoogleNews: true,
  googleNewsMax: 1,
  timeoutMs: 5000,
}

const organicHtml = `
  <a class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.com%2Fguia">Guia <b>aberto</b></a>
  <a class="result__snippet" href="#">Uma resposta &amp; referência.</a>
  <a class="result__a" href="https://example.org/projeto">Projeto Curupira</a>
  <a class="result__snippet" href="#">Código brasileiro.</a>
`

const newsRss = `
  <rss><channel><item>
    <title><![CDATA[Curupira &amp; tecnologia]]></title>
    <link>https://news.example/item?x=1&amp;y=2</link>
    <pubDate>Fri, 28 Aug 2026 12:00:00 GMT</pubDate>
  </item></channel></rss>
`

const bingTarget = Buffer.from('https://fallback.example/guia').toString('base64')

const bingHtml = `
  <ol id="b_results">
    <li class="b_algo"><h2><a href="https://www.bing.com/ck/a?x=1&amp;u=a1${bingTarget}&amp;ntb=1">Guia no Bing</a></h2>
      <div><p>Resultado de contingência.</p></div></li>
  </ol>
`

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('DuckDuckGo result parsing', () => {
  it('decodes highlighted text and unwraps result redirects', () => {
    expect(decodeHtmlText('Curupira <b>Code</b> &amp; comunidade')).toBe('Curupira Code & comunidade')
    expect(resolveResultHref('//duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.com%2Fguia'))
      .toBe('https://example.com/guia')
    expect(resolveResultHref(`https://www.bing.com/ck/a?x=1&amp;u=a1${bingTarget}&amp;ntb=1`))
      .toBe('https://fallback.example/guia')
    expect(resolveResultHref('javascript:alert(1)')).toBeUndefined()
  })

  it('parses organic results and RSS publication dates', () => {
    expect(parseDuckDuckGoHtml(organicHtml)).toEqual([
      { url: 'https://example.com/guia', title: 'Guia aberto', snippet: 'Uma resposta & referência.' },
      { url: 'https://example.org/projeto', title: 'Projeto Curupira', snippet: 'Código brasileiro.' },
    ])
    expect(parseGoogleNewsRss(newsRss)).toEqual([{
      title: 'Curupira & tecnologia',
      link: 'https://news.example/item?x=1&y=2',
      publishedAt: '2026-08-28T12:00:00.000Z',
    }])
  })

  it('parses Bing organic results for the independent fallback', () => {
    expect(parseBingHtml(bingHtml)).toEqual([{
      url: 'https://fallback.example/guia',
      title: 'Guia no Bing',
      snippet: 'Resultado de contingência.',
    }])
  })

  it('reserves configured tail slots for news and respects the result cap', () => {
    expect(mergeResults(parseDuckDuckGoHtml(organicHtml), parseGoogleNewsRss(newsRss), options, 2))
      .toEqual([
        { url: 'https://example.com/guia', title: 'Guia aberto', snippet: 'Uma resposta & referência.' },
        {
          url: 'https://news.example/item?x=1&y=2',
          title: 'Curupira & tecnologia',
          publishedAt: '2026-08-28T12:00:00.000Z',
        },
      ])
  })
})

describe('DuckDuckGoSearchProvider', () => {
  it('posts the query and blends keyless organic and news results', async () => {
    const fetchMock = vi.fn(async (url: string | URL, _init?: RequestInit) => {
      if (String(url) === options.baseURL) return new Response(organicHtml)
      return new Response(newsRss)
    })
    vi.stubGlobal('fetch', fetchMock)

    const result = await new DuckDuckGoSearchProvider(() => options)
      .search({ query: '  agentes brasileiros  ', maxResults: 2 })

    expect(result.sources).toHaveLength(2)
    const organicCall = fetchMock.mock.calls.find(([url]) => String(url) === options.baseURL)
    expect(organicCall?.[1]).toMatchObject({ method: 'POST', body: 'q=agentes+brasileiros' })
    const newsCall = fetchMock.mock.calls.find(([url]) => String(url).startsWith(options.newsBaseURL))
    expect(String(newsCall?.[0])).toContain('hl=pt-BR')
    expect(String(newsCall?.[0])).toContain('gl=BR')
  })

  it('keeps organic search usable when the optional news feed fails', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string | URL) => {
      if (String(url) === options.baseURL) return new Response(organicHtml)
      return new Response('unavailable', { status: 503 })
    }))
    const result = await new DuckDuckGoSearchProvider(() => options).search({ query: 'q', maxResults: 2 })
    expect(result.sources).toHaveLength(2)
    expect(result.sources[0]).toMatchObject({ url: 'https://example.com/guia' })
  })

  it('falls back to Bing when DuckDuckGo fails', async () => {
    const fetchMock = vi.fn(async (url: string | URL, _init?: RequestInit) => {
      if (String(url) === options.baseURL) return new Response('unavailable', { status: 503 })
      if (String(url).startsWith(options.bingBaseURL)) return new Response(bingHtml)
      return new Response('unavailable', { status: 503 })
    })
    vi.stubGlobal('fetch', fetchMock)

    const result = await new DuckDuckGoSearchProvider(() => options)
      .search({ query: 'curupira', maxResults: 1 })

    expect(result.sources).toEqual([{
      url: 'https://fallback.example/guia',
      title: 'Guia no Bing',
      snippet: 'Resultado de contingência.',
    }])
    const bingCall = fetchMock.mock.calls.find(([url]) => String(url).startsWith(options.bingBaseURL))
    expect(String(bingCall?.[0])).toContain('q=curupira')
    expect(String(bingCall?.[0])).toContain('mkt=pt-BR')
    expect(bingCall?.[1]).toMatchObject({ redirect: 'error' })
  })

  it('can disable Bing fallback explicitly', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('unavailable', { status: 503 })))
    const provider = new DuckDuckGoSearchProvider(() => ({ ...options, fallbackToBing: false }))
    await expect(provider.search({ query: 'curupira' })).rejects.toThrow(/DuckDuckGo returned HTTP 503/)
  })
})

describe('web-search-duckduckgo plugin registration', () => {
  it('registers the selected provider without a credential', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string | URL) =>
      new Response(String(url).includes('duckduckgo') ? organicHtml : newsRss)))
    const ctx = new Context()
    await ctx.plugin(WebRuntime, { searchProvider: DUCKDUCKGO_PROVIDER_ID })
    const fiber = await ctx.plugin(duckDuckGoPlugin, { includeGoogleNews: false })
    await expect(ctx.web.search({ query: 'curupira', maxResults: 1 }))
      .resolves.toMatchObject({ sources: [{ url: 'https://example.com/guia' }] })
    await fiber.dispose()
    await expect(ctx.web.search({ query: 'curupira' }))
      .rejects.toThrow(expect.objectContaining({ code: 'WEB_PROVIDER_CONFIGURED_MISSING' }))
  })
})
