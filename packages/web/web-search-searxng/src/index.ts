/**
 * Register an operator-controlled SearXNG instance as a credential-free search
 * provider on `ctx.web`. The endpoint comes from row config or `SEARXNG_URL`.
 * @module @deepseek-ai/dsh-web-search-searxng
 */

import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { launchEnvironmentOf } from '@deepseek-ai/dsh-launch-environment'
import type {} from '@deepseek-ai/dsh-web'
import {
  SEARXNG_DEFAULT_TIMEOUT_MS,
  SEARXNG_URL_ENV,
  SearxngSearchProvider,
} from './provider.ts'
import type { SearxngSearchProviderOptions, SearxngTimeRange } from './provider.ts'

export {
  mapSearxngResponse,
  SEARXNG_DEFAULT_TIMEOUT_MS,
  SEARXNG_PROVIDER_ID,
  SEARXNG_URL_ENV,
  searxngSearchUrl,
  SearxngSearchProvider,
} from './provider.ts'
export type { SearxngSearchProviderOptions, SearxngTimeRange } from './provider.ts'

/** Cordis plugin name used by loader diagnostics. */
export const name = 'web-search-searxng'

/** The web seam this provider registers into. */
export const inject = ['web']

/** Public, portable plugin configuration. */
export interface Config {
  /** SearXNG root URL. An omitted/empty value falls back to `$SEARXNG_URL`. */
  baseURL?: string
  /** Search categories. Defaults to `['general']`. */
  categories?: string[]
  /** Optional SearXNG language code. */
  language?: string
  /** Optional engine allowlist. */
  engines?: string[]
  /** Optional safe-search level from `0` through `2`. */
  safeSearch?: number
  /** Optional recency filter. */
  timeRange?: SearxngTimeRange
  /** Request deadline in milliseconds. Defaults to `15000`. */
  timeoutMs?: number
}

/** Loader-visible schema for config files and settings UIs. */
export const Config: z<Config> = z.object({
  baseURL: z.string().default(''),
  categories: z.array(z.string().min(1)).default(['general']),
  language: z.string(),
  engines: z.array(z.string().min(1)),
  safeSearch: z.number().step(1).min(0).max(2),
  timeRange: z.union(['day', 'month', 'year']),
  timeoutMs: z.number().step(1).min(1).default(SEARXNG_DEFAULT_TIMEOUT_MS),
})

/**
 * Resolve one row against the immutable launch environment snapshot.
 * @param ctx - Cordis context carrying the optional launch environment.
 * @param config - normalized plugin row configuration.
 * @returns fully resolved provider options.
 */
export function resolveOptions(ctx: Context, config: Config = {}): SearxngSearchProviderOptions {
  const configuredURL = config.baseURL?.trim()
  const environmentURL = launchEnvironmentOf(ctx).get(SEARXNG_URL_ENV)?.value.trim()
  return {
    baseURL: configuredURL !== undefined && configuredURL.length > 0 ? configuredURL : environmentURL ?? '',
    categories: config.categories ?? ['general'],
    timeoutMs: config.timeoutMs ?? SEARXNG_DEFAULT_TIMEOUT_MS,
    ...(config.language === undefined ? {} : { language: config.language }),
    ...(config.engines === undefined ? {} : { engines: config.engines }),
    ...(config.safeSearch === undefined ? {} : { safeSearch: config.safeSearch }),
    ...(config.timeRange === undefined ? {} : { timeRange: config.timeRange }),
  }
}

/** Register the SearXNG provider; the web seam owns its HMR-safe disposer. */
export function apply(ctx: Context, config: Config = {}): void {
  ctx.web.registerSearchProvider(new SearxngSearchProvider(() => resolveOptions(ctx, config)))
}
