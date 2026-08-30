/**
 * SearXNG-backed implementation of the DeepSeek Harness web search seam.
 * The adapter carries no credential and accepts any operator-controlled
 * SearXNG base URL whose JSON search format is enabled.
 * @module @deepseek-ai/dsh-web-search-searxng/provider
 */

import { WebError } from '@deepseek-ai/dsh-web'
import type {
  WebSearchProvider,
  WebSearchRequest,
  WebSearchResult,
  WebSearchSource,
} from '@deepseek-ai/dsh-web'

/** Stable id this provider registers under. */
export const SEARXNG_PROVIDER_ID = 'searxng'

/** Environment variable used when the row omits `baseURL`. */
export const SEARXNG_URL_ENV = 'SEARXNG_URL'

/** Default request budget in milliseconds. */
export const SEARXNG_DEFAULT_TIMEOUT_MS = 15000

/** Search recency values accepted by SearXNG. */
export type SearxngTimeRange = 'day' | 'month' | 'year'

/** Fully resolved provider options. */
export interface SearxngSearchProviderOptions {
  /** Operator-controlled SearXNG root URL; may include a path prefix. */
  baseURL: string
  /** Comma-separated by the adapter for SearXNG's `categories` form field. */
  categories: readonly string[]
  /** Optional SearXNG language code; omitted delegates to instance policy. */
  language?: string
  /** Optional engine allowlist; omitted delegates to instance policy. */
  engines?: readonly string[]
  /** Optional SearXNG safe-search level (`0`, `1`, or `2`). */
  safeSearch?: number
  /** Optional recency filter. */
  timeRange?: SearxngTimeRange
  /** Request deadline in milliseconds. */
  timeoutMs: number
}

/** Return a non-empty trimmed string, or `undefined` for every other value. */
function textOf(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const text = value.trim()
  return text.length > 0 ? text : undefined
}

/** Return an absolute HTTP(S) URL in canonical form. */
function webUrlOf(value: unknown): string | undefined {
  const text = textOf(value)
  if (text === undefined) return undefined
  try {
    const parsed = new URL(text)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.href : undefined
  } catch {
    return undefined
  }
}

/** Narrow an unknown JSON value to an object. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Normalize one SearXNG JSON response into the provider-neutral web shape.
 * Malformed result rows are dropped, while a malformed envelope is rejected.
 * @param payload - decoded JSON response of unknown shape.
 * @returns a provider-neutral search result.
 */
export function mapSearxngResponse(payload: unknown): WebSearchResult {
  if (!isRecord(payload) || !Array.isArray(payload.results)) {
    throw new WebError('SearXNG returned an invalid JSON response', 'WEB_PROVIDER_ERROR')
  }

  const sources: WebSearchSource[] = []
  const seen = new Set<string>()
  for (const candidate of payload.results) {
    if (!isRecord(candidate)) continue
    const url = webUrlOf(candidate.url)
    if (url === undefined || seen.has(url)) continue
    seen.add(url)
    const title = textOf(candidate.title)
    const snippet = textOf(candidate.content)
    const publishedAt = textOf(candidate.publishedDate) ?? textOf(candidate.published_date)
    sources.push({
      url,
      ...(title === undefined ? {} : { title }),
      ...(snippet === undefined ? {} : { snippet }),
      ...(publishedAt === undefined ? {} : { publishedAt }),
    })
  }

  const answers = Array.isArray(payload.answers)
    ? payload.answers.map(textOf).filter((answer): answer is string => answer !== undefined)
    : []
  return {
    ...(answers.length === 0 ? {} : { content: answers.join('\n\n') }),
    sources,
    truncated: false,
  }
}

/**
 * Build `/search` without discarding an operator-supplied path prefix.
 * @param baseURL - operator-controlled SearXNG root URL.
 * @returns the absolute SearXNG search endpoint.
 */
export function searxngSearchUrl(baseURL: string): URL {
  return new URL('search', baseURL.endsWith('/') ? baseURL : `${baseURL}/`)
}

/** The configurable, credential-free SearXNG search provider. */
export class SearxngSearchProvider implements WebSearchProvider {
  readonly id = SEARXNG_PROVIDER_ID

  /**
   * @param resolveOptions - snapshotted once per operation so one search never
   * mixes two configuration generations.
   */
  constructor(private readonly resolveOptions: () => SearxngSearchProviderOptions) {}

  available(): boolean {
    const options = this.resolveOptions()
    const baseURL = webUrlOf(options.baseURL)
    return baseURL !== undefined
      && options.categories.length > 0
      && options.categories.every(category => category.trim().length > 0)
      && Number.isInteger(options.timeoutMs)
      && options.timeoutMs > 0
      && (options.safeSearch === undefined
        || (Number.isInteger(options.safeSearch) && options.safeSearch >= 0 && options.safeSearch <= 2))
  }

  async search(request: WebSearchRequest, signal?: AbortSignal): Promise<WebSearchResult> {
    throwIfAborted(signal)
    const options = this.resolveOptions()
    const deadline = AbortSignal.timeout(options.timeoutMs)
    const composite = signal === undefined ? deadline : AbortSignal.any([signal, deadline])
    const body = new URLSearchParams({
      q: request.query.trim(),
      format: 'json',
      categories: options.categories.join(','),
    })
    if (options.language !== undefined && options.language.trim().length > 0) {
      body.set('language', options.language.trim())
    }
    if (options.engines !== undefined && options.engines.length > 0) {
      body.set('engines', options.engines.join(','))
    }
    if (options.safeSearch !== undefined) body.set('safesearch', String(options.safeSearch))
    if (options.timeRange !== undefined) body.set('time_range', options.timeRange)

    try {
      const response = await fetch(searxngSearchUrl(options.baseURL), {
        method: 'POST',
        redirect: 'error',
        headers: {
          accept: 'application/json',
          'content-type': 'application/x-www-form-urlencoded',
        },
        body: body.toString(),
        signal: composite,
      })
      if (!response.ok) {
        const hint = response.status === 403 ? '; confirm that JSON format is enabled' : ''
        throw new WebError(`SearXNG returned HTTP ${response.status}${hint}`, 'WEB_PROVIDER_ERROR')
      }
      return mapSearxngResponse(await response.json())
    } catch (error: unknown) {
      if (signal?.aborted === true) {
        throw new WebError('SearXNG search aborted', 'WEB_ABORTED', { cause: signal.reason })
      }
      if (deadline.aborted) {
        throw new WebError(
          `SearXNG search timed out after ${options.timeoutMs} ms`,
          'WEB_PROVIDER_ERROR',
          { cause: error },
        )
      }
      if (error instanceof WebError) throw error
      throw new WebError(`SearXNG search request failed: ${String(error)}`, 'WEB_PROVIDER_ERROR', { cause: error })
    }
  }
}

/** Throw the stable seam cancellation error before starting a request. */
function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted === true) {
    throw new WebError('SearXNG search aborted', 'WEB_ABORTED', { cause: signal.reason })
  }
}
