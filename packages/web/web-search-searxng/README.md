# CurupiraCode SearXNG search

English | [中文](README.zh.md)

A portable, credential-free `web_search` provider backed by an operator-controlled [SearXNG](https://docs.searxng.org/) instance. CurupiraCode sends the query to SearXNG's JSON search API and maps the response into the shared `ctx.web` seam.

## Why it exists

DuckDuckGo HTML remains CurupiraCode's zero-configuration default, while this package gives communities, schools, teams, and local deployments a more controllable open-source search backend without tying the project to a paid model or search API.

## Configuration

| Field | Default | Meaning |
| --- | --- | --- |
| `baseURL` | `$SEARXNG_URL` | Root URL of a SearXNG instance with JSON output enabled. Empty or absent makes this provider unavailable. |
| `categories` | `['general']` | SearXNG categories sent with every query. |
| `language` | instance default | Optional language code such as `pt-BR`. |
| `engines` | instance default | Optional engine allowlist. |
| `safeSearch` | instance default | Optional level: `0`, `1`, or `2`. |
| `timeRange` | unset | Optional `day`, `month`, or `year` filter. |
| `timeoutMs` | `15000` | Per-request deadline in milliseconds. |

Set the endpoint in the launch environment and select the provider in the web row:

```sh
export SEARXNG_URL=http://127.0.0.1:8080/
```

```yaml
- id: web
  name: '@deepseek-ai/dsh-web'
  config:
    searchProvider: searxng

- id: web-search-searxng
  name: '@deepseek-ai/dsh-web-search-searxng'
  config:
    language: pt-BR
    categories: [general, news]
    safeSearch: 1
```

The SearXNG instance must allow `format=json`. See the official [search API](https://docs.searxng.org/dev/search_api.html) and [container installation](https://docs.searxng.org/admin/installation-docker.html) documentation. CurupiraCode deliberately does not hardcode or silently route through a public instance.

## Mapping and safety

The provider posts form-encoded queries to `/search`, rejects HTTP redirects, accepts only absolute HTTP(S) result URLs, removes duplicates, and maps `title`, `content`, and publication dates into the portable result fields. Caller cancellation surfaces as `WEB_ABORTED`; endpoint, timeout, HTTP, parsing, and response-shape failures surface as `WEB_PROVIDER_ERROR`.

## Model Experience

Indirectly, through [`dsh-tool-web`](../tool-web/README.md), which renders this provider's normalized answer text, URLs, titles, snippets, and publication dates or its stable web-provider failures under the consumer's error wrapper.

#### KV Cache effect

No direct invalidation; the named consumer owns any request-prefix changes.

## Known Limitations and Deferred Work

- **A running SearXNG endpoint is required** — this adapter does not install or operate the service.
- **JSON output can be disabled by an instance operator** — such an endpoint cannot serve this provider until `format=json` is enabled.
- **Public instances are intentionally not selected automatically** — availability and API policies vary, so operators must choose an endpoint they trust.
- **SearXNG-specific ranking metadata stays private to the adapter** — only provider-neutral web fields enter model context.
