# CurupiraCode DuckDuckGo search

English | [中文](README.zh.md)

A keyless provider for the `web_search` capability. It queries **DuckDuckGo** HTML, falls back to **Bing** HTML when the primary engine fails or returns no results, and blends the organic result with **Google News** RSS items. No commercial-service credential is required.

## Why it exists

CurupiraCode needs search to work from the first launch. This package keeps search available in local installations without requiring the user to subscribe to another service or store another key. Its multi-engine fallback direction was inspired by [dsh-free-web-search](https://github.com/delef/dsh-free-web-search); this package remains an independent implementation over the Harness `ctx.web` seam.

## Results

- Organic DuckDuckGo results lead; redirects are resolved and advertisements are discarded.
- Bing replaces the organic source only when DuckDuckGo fails or returns no usable result.
- Up to `googleNewsMax` news entries complete the list with publication dates.
- Duplicate URLs are removed and `maxResults` is respected.

## Configuration

| Field | Default |
| --- | --- |
| `baseURL` | `https://html.duckduckgo.com/html/` |
| `newsBaseURL` | `https://news.google.com/rss/search` |
| `bingBaseURL` | `https://www.bing.com/search` |
| `bingMarket` | `pt-BR` |
| `fallbackToBing` | `true` |
| `locale` | `pt-BR` (Google News `hl`) |
| `country` | `BR` (Google News `gl`/`ceid`) |
| `includeGoogleNews` | `true` |
| `googleNewsMax` | `3` |
| `timeoutMs` | `15000` |

Every field is optional. The default CurupiraCode bundle already loads the provider and selects `duckduckgo-html`.

## Manual loading

```yaml
- insert:
    - id: web-search-duckduckgo
      name: '@deepseek-ai/dsh-web-search-duckduckgo'
- id: web
  config:
    searchProvider: duckduckgo-html
```

The internal `@deepseek-ai/dsh-web-search-duckduckgo` identifier remains in this phase for binary compatibility with the inherited plugin ecosystem. The public brand and distribution are CurupiraCode.

## Model Experience

Indirectly, through [`dsh-tool-web`](../tool-web/README.md), which renders the normalized organic/news URLs, titles, snippets, publication dates, and stable provider errors. The model is not told to choose or retry an engine; fallback is an implementation detail completed before the result reaches the tool.

#### KV Cache effect

No direct invalidation; the named consumer owns any request-prefix changes.

## Known Limitations and Deferred Work

- **HTML layouts can change without notice** — fixture-covered parsers may need maintenance when DuckDuckGo or Bing changes markup.
- **Public endpoints may rate-limit automated traffic** — the provider reports combined organic failures instead of promising a commercial SLA.
- **Google News is an optional enhancement** — an RSS failure does not sink a usable organic search.
- **Only one fallback hop is attempted** — operator-controlled SearXNG is available as a separate provider rather than silently routing through public instances.
