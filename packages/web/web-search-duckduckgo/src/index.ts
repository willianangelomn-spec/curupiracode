/**
 * Register a keyless search provider in `ctx.web`: DuckDuckGo's HTML endpoint
 * blended with Google News RSS. It needs NO credential plane at all — no API
 * key, no `$DEEPSEEK_API_KEY`, no credentials service — which is the point:
 * search keeps working on deployments that never stored a provider key.
 * @module @deepseek-ai/dsh-web-search-duckduckgo
 */

import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import type {} from '@deepseek-ai/dsh-web'
import {
  DEFAULT_TIMEOUT_MS,
  DuckDuckGoSearchProvider,
  BING_DEFAULT_BASE_URL,
  DUCKDUCKGO_DEFAULT_BASE_URL,
  GOOGLE_NEWS_DEFAULT_BASE_URL,
} from './provider.ts'
import type { DuckDuckGoSearchProviderOptions } from './provider.ts'

export {
  DEFAULT_TIMEOUT_MS,
  BING_DEFAULT_BASE_URL,
  DuckDuckGoSearchProvider,
  DEFAULT_USER_AGENT,
  DUCKDUCKGO_DEFAULT_BASE_URL,
  DUCKDUCKGO_PROVIDER_ID,
  GOOGLE_NEWS_DEFAULT_BASE_URL,
} from './provider.ts'
export type { DuckDuckGoSearchProviderOptions } from './provider.ts'

/** Cordis plugin name used by loader diagnostics. */
export const name = 'web-search-duckduckgo'

/** The web seam this provider registers into. */
export const inject = ['web']

/** Row config (all optional — `apply` fills constant defaults). No secrets exist here. */
export interface Config {
  /** DuckDuckGo HTML endpoint base. Defaults to `https://html.duckduckgo.com/html/`. */
  baseURL?: string
  /** Google News RSS endpoint base. Defaults to `https://news.google.com/rss/search`. */
  newsBaseURL?: string
  /** Bing HTML endpoint used for organic fallback. */
  bingBaseURL?: string
  /** Bing market code. Defaults to `pt-BR`. */
  bingMarket?: string
  /** Fall back to Bing when DuckDuckGo fails or is empty. Defaults to `true`. */
  fallbackToBing?: boolean
  /** Google News content language (`hl`). Defaults to `pt-BR`. */
  locale?: string
  /** Google News content country (`gl`/`ceid`). Defaults to `BR`. */
  country?: string
  /** Blend Google News items into results. Defaults to `true`. */
  includeGoogleNews?: boolean
  /** Upper bound of news slots per merged result. Defaults to `3`. */
  googleNewsMax?: number
  /** Per-request fetch budget (ms). Defaults to `15000`. */
  timeoutMs?: number
}

/** Loader-visible schema for safe editing through plugin configuration UIs. */
export const Config: z<Config> = z.object({
  baseURL: z.string().default(DUCKDUCKGO_DEFAULT_BASE_URL),
  newsBaseURL: z.string().default(GOOGLE_NEWS_DEFAULT_BASE_URL),
  bingBaseURL: z.string().default(BING_DEFAULT_BASE_URL),
  bingMarket: z.string().default('pt-BR'),
  fallbackToBing: z.boolean().default(true),
  locale: z.string().default('pt-BR'),
  country: z.string().default('BR'),
  includeGoogleNews: z.boolean().default(true),
  googleNewsMax: z.number().step(1).min(0).default(3),
  timeoutMs: z.number().step(1).min(1).default(DEFAULT_TIMEOUT_MS),
})

/** Project one row config into fully-defaulted provider options. */
function resolveOptions(config: Config = {}): DuckDuckGoSearchProviderOptions {
  const section = config
  return {
    baseURL: section.baseURL ?? DUCKDUCKGO_DEFAULT_BASE_URL,
    newsBaseURL: section.newsBaseURL ?? GOOGLE_NEWS_DEFAULT_BASE_URL,
    bingBaseURL: section.bingBaseURL ?? BING_DEFAULT_BASE_URL,
    bingMarket: section.bingMarket ?? 'pt-BR',
    fallbackToBing: section.fallbackToBing ?? true,
    locale: section.locale ?? 'pt-BR',
    country: section.country ?? 'BR',
    includeGoogleNews: section.includeGoogleNews ?? true,
    googleNewsMax: section.googleNewsMax ?? 3,
    timeoutMs: section.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  }
}

/** Register the keyless search provider with `ctx.web`. */
export function apply(ctx: Context, config: Config = {}): void {
  ctx.web.registerSearchProvider(new DuckDuckGoSearchProvider(() => resolveOptions(config)))
}
