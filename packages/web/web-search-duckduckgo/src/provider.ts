/**
 * Keyless search provider for the DeepSeek Harness web capability seam (`ctx.web`).
 * Queries DuckDuckGo's HTML endpoint (no API key, no credential plane) and blends
 * in Google News RSS items (also keyless, officially offered as RSS) so a search
 * carries both organic web results and dated news coverage.
 * @module @deepseek-ai/dsh-web-search-duckduckgo/provider
 */

import { WebError } from '@deepseek-ai/dsh-web'
import type {
  WebSearchProvider,
  WebSearchRequest,
  WebSearchResult,
  WebSearchSource,
} from '@deepseek-ai/dsh-web'

/** Stable id this provider registers under. */
export const DUCKDUCKGO_PROVIDER_ID = 'duckduckgo-html'

/** Default DuckDuckGo HTML results endpoint (`q` posted as a form field). */
export const DUCKDUCKGO_DEFAULT_BASE_URL = 'https://html.duckduckgo.com/html/'

/** Default Google News RSS search endpoint (`q`, locale params appended). */
export const GOOGLE_NEWS_DEFAULT_BASE_URL = 'https://news.google.com/rss/search'

/** Default Bing HTML results endpoint used as the keyless organic fallback. */
export const BING_DEFAULT_BASE_URL = 'https://www.bing.com/search'

/** Default browser user agent sent to the HTML endpoint. */
export const DEFAULT_USER_AGENT =
  'Mozilla/5.0 (X11; Linux x86_64; rv:132.0) Gecko/20100101 Firefox/132.0'

/** Default per-engine fetch budget (ms). */
export const DEFAULT_TIMEOUT_MS = 15000

/** Resolved provider options (the plugin's `apply` supplies defaults). */
export interface DuckDuckGoSearchProviderOptions {
  /** DuckDuckGo HTML endpoint base. */
  baseURL: string
  /** Google News RSS search endpoint base. */
  newsBaseURL: string
  /** Bing HTML endpoint used when DuckDuckGo fails or returns no organic results. */
  bingBaseURL: string
  /** Bing market code. */
  bingMarket: string
  /** Whether Bing may replace an unavailable or empty DuckDuckGo response. */
  fallbackToBing: boolean
  /** Content language for Google News (`hl` param). */
  locale: string
  /** Content country for Google News (`gl`/`ceid` param). */
  country: string
  /** Whether Google News RSS items join the merged result. */
  includeGoogleNews: boolean
  /** Upper bound of Google News slots reserved in one merged result. */
  googleNewsMax: number
  /** Per-request fetch budget (ms). */
  timeoutMs: number
}

/** One parsed organic result before normalization. */
interface ParsedResult {
  url: string
  title: string
  snippet?: string
}

/**
 * Decode the handful of HTML entities the two endpoints emit and strip the
 * inline tags (`<b>` highlights, `<span>` wrappers) from titles and snippets.
 * @param input - endpoint text that may contain inline tags and HTML entities.
 * @returns plain normalized text.
 */
export function decodeHtmlText(input: string): string {
  const text = input
    .replace(/<[^>]*>/g, '')
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => safeFromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec: string) => safeFromCodePoint(parseInt(dec, 10)))
  return text
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, '\'')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Map a code point to a one-character string, or '' when out of range. */
function safeFromCodePoint(codePoint: number): string {
  return Number.isInteger(codePoint) && codePoint > 0 && codePoint <= 0x10ffff
    ? String.fromCodePoint(codePoint)
    : ''
}

/**
 * Resolve one result anchor's `href` into a real target URL. DuckDuckGo wraps
 * organic hits in `/l/?uddg=<encoded>` redirects (and ads in `/y.js`), while
 * Bing may base64-wrap targets in `/ck/a`; unwrap those and reject non-http
 * targets.
 *
 * @param href - absolute, protocol-relative, or DuckDuckGo-wrapped result href.
 * @returns the unwrapped http(s) URL, or `undefined` for ads and junk links.
 */
export function resolveResultHref(href: string): string | undefined {
  let candidate = href.replace(/&amp;/g, '&')
  if (candidate.startsWith('//')) candidate = `https:${candidate}`
  let parsed: URL
  try {
    parsed = new URL(candidate)
  } catch {
    return undefined
  }
  if (parsed.hostname.endsWith('duckduckgo.com')) {
    if (!parsed.pathname.startsWith('/l/')) return undefined // ads (`/y.js`) and internal links
    const target = parsed.searchParams.get('uddg')
    if (target === null || target.length === 0) return undefined
    try {
      parsed = new URL(target)
    } catch {
      return undefined
    }
  }
  if (parsed.hostname.endsWith('bing.com') && parsed.pathname.startsWith('/ck/')) {
    const wrapped = parsed.searchParams.get('u')
    if (wrapped === null || !wrapped.startsWith('a1')) return undefined
    try {
      parsed = new URL(Buffer.from(wrapped.slice(2), 'base64').toString('utf8'))
    } catch {
      return undefined
    }
  }
  return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.href : undefined
}

/**
 * Parse every organic result out of one DuckDuckGo HTML page.
 * @param html - complete DuckDuckGo HTML response body.
 * @returns parsed organic result candidates in document order.
 */
export function parseDuckDuckGoHtml(html: string): ParsedResult[] {
  // Walk the two anchor kinds sequentially instead of pairing by list index:
  // ads and dropped links sit between organic hits, so only
  // "result anchor, then its snippet" adjacency is trustworthy.
  const tokens = [
    ...html.matchAll(/<a\s+([^>]*class="(result__a|result__snippet)"[^>]*)>([\s\S]*?)<\/a>/g),
  ]
  const results: ParsedResult[] = []
  let pending: ParsedResult | undefined
  for (const token of tokens) {
    const [, attributes, kind, inner] = token
    if (kind === 'result__a') {
      if (pending !== undefined) results.push(pending)
      const hrefMatch = /href="([^"]*)"/.exec(attributes ?? '')
      const url = hrefMatch !== null ? resolveResultHref(hrefMatch[1] ?? '') : undefined
      const title = decodeHtmlText(inner ?? '')
      pending = url !== undefined && title.length > 0 ? { url, title } : undefined
    } else if (pending !== undefined) {
      const snippet = decodeHtmlText(inner ?? '')
      if (snippet.length > 0) pending.snippet = snippet
      results.push(pending)
      pending = undefined
    }
  }
  if (pending !== undefined) results.push(pending)
  return results
}

/**
 * Parse organic results from Bing's HTML result list.
 * @param html - complete Bing HTML response body.
 * @returns parsed organic result candidates in document order.
 */
export function parseBingHtml(html: string): ParsedResult[] {
  const results: ParsedResult[] = []
  for (const match of html.matchAll(/<li\b[^>]*class="[^"]*\bb_algo\b[^"]*"[^>]*>([\s\S]*?)<\/li>/gi)) {
    const block = match[1] ?? ''
    const heading = /<h2\b[^>]*>([\s\S]*?)<\/h2>/i.exec(block)?.[1] ?? block
    const anchor = /<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i.exec(heading)
    if (anchor === null) continue
    const url = resolveResultHref(anchor[1] ?? '')
    const title = decodeHtmlText(anchor[2] ?? '')
    if (url === undefined || title.length === 0) continue
    const snippetBlock = /<p\b[^>]*>([\s\S]*?)<\/p>/i.exec(block)?.[1]
    const snippet = snippetBlock === undefined ? undefined : decodeHtmlText(snippetBlock)
    results.push({ url, title, ...(snippet === undefined || snippet.length === 0 ? {} : { snippet }) })
  }
  return results
}

/** One parsed RSS item before normalization. */
interface ParsedItem {
  title: string
  link: string
  publishedAt?: string
}

/** Pull CDATA-wrapped or plain element text out of one XML block. */
function xmlText(block: string, tag: string): string {
  const match = new RegExp(`<${tag}>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?</${tag}>`).exec(block)
  return match !== null ? (match[1] ?? '').trim() : ''
}

/**
 * Parse Google News RSS `<item>` entries into normalized candidates.
 * @param xml - complete Google News RSS response body.
 * @returns parsed news items in feed order.
 */
export function parseGoogleNewsRss(xml: string): ParsedItem[] {
  const items: ParsedItem[] = []
  for (const match of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const block = match[1] ?? ''
    const title = decodeHtmlText(xmlText(block, 'title'))
    const link = decodeHtmlText(xmlText(block, 'link'))
    if (title.length === 0 || !/^https?:\/\//.test(link)) continue
    const rawDate = xmlText(block, 'pubDate')
    const published = rawDate !== '' ? new Date(rawDate) : undefined
    items.push({
      title,
      link,
      ...(published !== undefined && !Number.isNaN(published.getTime())
        ? { publishedAt: published.toISOString() }
        : {}),
    })
  }
  return items
}

/**
 * Merge organic and news candidates: organic results lead, news items fill the
 * reserved tail slots, deduped by URL, capped at `maxResults`.
 * @param organic - ordered organic search candidates.
 * @param news - ordered Google News feed items.
 * @param options - resolved provider configuration controlling news slots.
 * @param maxResults - final source count cap.
 * @returns deduplicated portable web sources.
 */
export function mergeResults(
  organic: readonly ParsedResult[],
  news: readonly ParsedItem[],
  options: DuckDuckGoSearchProviderOptions,
  maxResults: number,
): WebSearchSource[] {
  const newsSlots = options.includeGoogleNews
    ? Math.min(Math.max(options.googleNewsMax, 0), news.length, maxResults)
    : 0
  const organicSlots = maxResults - newsSlots
  const seen = new Set<string>()
  const sources: WebSearchSource[] = []
  for (const result of organic) {
    if (sources.length >= organicSlots) break
    if (seen.has(result.url)) continue
    seen.add(result.url)
    sources.push({
      url: result.url,
      title: result.title,
      ...result.snippet !== undefined ? { snippet: result.snippet } : {},
    })
  }
  for (const item of news) {
    if (sources.length >= maxResults) break
    if (seen.has(item.link)) continue
    seen.add(item.link)
    sources.push({
      url: item.link,
      title: item.title,
      ...item.publishedAt !== undefined ? { publishedAt: item.publishedAt } : {},
    })
  }
  return sources
}

/** The keyless DuckDuckGo(+Google News)-backed search provider. */
export class DuckDuckGoSearchProvider implements WebSearchProvider {
  readonly id = DUCKDUCKGO_PROVIDER_ID

  /**
   * @param resolveOptions - snapshotted once per operation so one search never
   * mixes two option generations.
   */
  constructor(private readonly resolveOptions: () => DuckDuckGoSearchProviderOptions) {}

  available(): boolean {
    return URL.canParse(this.resolveOptions().baseURL)
  }

  async search(request: WebSearchRequest, signal?: AbortSignal): Promise<WebSearchResult> {
    throwIfAborted(signal)
    const options = this.resolveOptions()
    const query = request.query.trim()
    const [organic, news] = await Promise.all([
      this.fetchOrganicWithFallback(query, options, signal),
      options.includeGoogleNews
        ? withDeadline(options.timeoutMs, signal, composite => this.fetchNews(query, options, composite)).catch((error: unknown) => {
          rethrowIfCallerAborted(signal, error)
          // News is an enhancement: an RSS outage must not sink the search.
          return [] as ParsedItem[]
        })
        : Promise.resolve([] as ParsedItem[]),
    ])
    const maxResults = request.maxResults ?? organic.length + news.length
    return { sources: mergeResults(organic, news, options, maxResults), truncated: false }
  }

  /** Try DuckDuckGo first and use Bing only for a failed or empty response. */
  private async fetchOrganicWithFallback(
    query: string,
    options: DuckDuckGoSearchProviderOptions,
    signal?: AbortSignal,
  ): Promise<ParsedResult[]> {
    let primaryFailure: unknown
    try {
      const results = await withDeadline(
        options.timeoutMs,
        signal,
        composite => this.fetchOrganic(query, options, composite),
      )
      if (results.length > 0 || !options.fallbackToBing) return results
      primaryFailure = new WebError('DuckDuckGo returned no organic results', 'WEB_PROVIDER_ERROR')
    } catch (error: unknown) {
      rethrowIfCallerAborted(signal, error)
      if (!options.fallbackToBing) throw error
      primaryFailure = error
    }

    try {
      return await withDeadline(
        options.timeoutMs,
        signal,
        composite => this.fetchBing(query, options, composite),
      )
    } catch (error: unknown) {
      rethrowIfCallerAborted(signal, error)
      throw new WebError(
        `keyless organic search failed in DuckDuckGo (${messageOf(primaryFailure)}) and Bing (${messageOf(error)})`,
        'WEB_PROVIDER_ERROR',
        { cause: error },
      )
    }
  }

  /** POST the HTML endpoint and parse its organic results. */
  private async fetchOrganic(
    query: string,
    options: DuckDuckGoSearchProviderOptions,
    signal: AbortSignal,
  ): Promise<ParsedResult[]> {
    let response: Response
    try {
      response = await fetch(options.baseURL, {
        method: 'POST',
        redirect: 'error',
        headers: {
          'user-agent': DEFAULT_USER_AGENT,
          'content-type': 'application/x-www-form-urlencoded',
          'accept': 'text/html',
        },
        body: new URLSearchParams({ q: query }).toString(),
        signal,
      })
    } catch (error: unknown) {
      throw wrappedFetchError('DuckDuckGo', error)
    }
    if (!response.ok) {
      throw new WebError(`DuckDuckGo returned HTTP ${response.status}`, 'WEB_PROVIDER_ERROR')
    }
    const html = await response.text().catch((error: unknown) => {
      throw wrappedFetchError('DuckDuckGo', error)
    })
    const results = parseDuckDuckGoHtml(html)
    if (results.length === 0 && /anomaly|captcha|challenge|enable javascript/i.test(html)) {
      throw new WebError(
        'DuckDuckGo served a bot-challenge page instead of results; retry later',
        'WEB_PROVIDER_ERROR',
      )
    }
    return results
  }

  /** Query Bing's public HTML result page as an independent keyless fallback. */
  private async fetchBing(
    query: string,
    options: DuckDuckGoSearchProviderOptions,
    signal: AbortSignal,
  ): Promise<ParsedResult[]> {
    const url = new URL(options.bingBaseURL)
    url.searchParams.set('q', query)
    url.searchParams.set('mkt', options.bingMarket)
    let response: Response
    try {
      response = await fetch(url, {
        redirect: 'error',
        headers: {
          'user-agent': DEFAULT_USER_AGENT,
          accept: 'text/html',
        },
        signal,
      })
    } catch (error: unknown) {
      throw wrappedFetchError('Bing', error)
    }
    if (!response.ok) {
      throw new WebError(`Bing returned HTTP ${response.status}`, 'WEB_PROVIDER_ERROR')
    }
    const html = await response.text().catch((error: unknown) => {
      throw wrappedFetchError('Bing', error)
    })
    const results = parseBingHtml(html)
    if (results.length === 0) {
      throw new WebError('Bing returned no organic results', 'WEB_PROVIDER_ERROR')
    }
    return results
  }

  /** GET the Google News RSS feed and parse its items. */
  private async fetchNews(
    query: string,
    options: DuckDuckGoSearchProviderOptions,
    signal: AbortSignal,
  ): Promise<ParsedItem[]> {
    const url = `${options.newsBaseURL}?${new URLSearchParams({
      q: query,
      hl: options.locale,
      gl: options.country,
      ceid: `${options.country}:${options.locale}`,
    }).toString()}`
    let response: Response
    try {
      response = await fetch(url, {
        redirect: 'error',
        headers: { 'user-agent': DEFAULT_USER_AGENT, accept: 'application/rss+xml, application/xml, text/xml' },
        signal,
      })
    } catch (error: unknown) {
      throw wrappedFetchError('Google News', error)
    }
    if (!response.ok) {
      throw new WebError(`Google News returned HTTP ${response.status}`, 'WEB_PROVIDER_ERROR')
    }
    const xml = await response.text().catch((error: unknown) => {
      throw wrappedFetchError('Google News', error)
    })
    return parseGoogleNewsRss(xml)
  }
}

/** Wrap a low-level network failure as the seam's provider error. */
function wrappedFetchError(engine: string, error: unknown): WebError {
  if (error instanceof WebError) return error
  return new WebError(`${engine} search request failed: ${String(error)}`, 'WEB_PROVIDER_ERROR', { cause: error })
}

/** Throw the stable cancellation error when the caller already aborted. */
function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted === true) {
    throw new WebError('DuckDuckGo search aborted', 'WEB_ABORTED', { cause: signal.reason })
  }
}

/** Let caller cancellation win over engine-level failures racing the same signal. */
function rethrowIfCallerAborted(signal: AbortSignal | undefined, error: unknown): void {
  if (signal?.aborted === true && !(error instanceof WebError && error.code === 'WEB_ABORTED')) {
    throw new WebError('DuckDuckGo search aborted', 'WEB_ABORTED', { cause: signal.reason })
  }
}

/** Give each independent endpoint its own deadline while sharing caller cancellation. */
function withDeadline<T>(
  timeoutMs: number,
  signal: AbortSignal | undefined,
  operation: (signal: AbortSignal) => Promise<T>,
): Promise<T> {
  const deadline = AbortSignal.timeout(timeoutMs)
  return operation(signal === undefined ? deadline : AbortSignal.any([signal, deadline]))
}

/** Stable one-line error detail for a combined fallback failure. */
function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
