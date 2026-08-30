# Agent Note: CurupiraCode foundation

Status: implemented

English | [中文](2026-08-28-curupiracode-foundation.zh.md)

## Problem

The derivative project needs an identity that cannot be mistaken for an official DeepSeek distribution, while retaining enough package compatibility to use the existing plugin ecosystem. A local-first distribution also needs search to work on first launch without requiring a second commercial credential, and every shipped capability must be reproducible outside the founding contributor's machine.

## Decision

The public product identity is CurupiraCode. The Web document, PWA metadata, brand slots, onboarding copy, CLI help, and readiness messages use that name. The mark combines an open trail-circuit C with reversed footprints, and the public command is `curupiracode`; `dsh` remains a compatibility alias.

Internal package names under `@deepseek-ai/dsh-*`, profile storage, environment variables, and stable protocol identifiers remain unchanged during this foundation phase. Their migration belongs to a separately versioned compatibility project because changing them together would break installed plugins, saved profiles, and automation without improving the visible product.

The base bundle mounts `@deepseek-ai/dsh-web-search-duckduckgo` and selects `duckduckgo-html`. The provider posts to DuckDuckGo HTML for organic results, falls back to Bing HTML after a failed or empty primary response, optionally blends dated Google News RSS entries, and needs no credential. The multi-engine fallback direction is credited to `dsh-free-web-search`, while the implementation remains native to the provider-neutral `ctx.web` seam and follows the Harness redirect and lifecycle rules.

The bundle also mounts `@deepseek-ai/dsh-web-search-searxng` as an unavailable-until-configured alternative. It resolves an operator-controlled endpoint from row config or `SEARXNG_URL`, requires JSON output, rejects redirects, and never selects or hardcodes a public instance. The existing DeepSeek search provider remains mounted as another explicit opt-in alternative.

The root documentation states the derivative relationship, independent status, MIT inheritance, third-party inspiration, visual rules, and milestone roadmap. It does not claim a public CurupiraCode repository or package registry entry before one exists. Repository code and distributable configuration contain no personal filesystem path, account password, or live OpenRouter-style key.

## Verification

Brand-slot tests cover registration, teardown, wordmark accessibility, and host-selected mark sizes. Keyless-provider tests cover redirect unwrapping, DuckDuckGo/Bing HTML and RSS parsing, fallback, result caps, optional-news failure, request mapping, and credential-free registration. SearXNG tests cover JSON mapping, invalid-row filtering, endpoint construction, form fields, abort/error classification, environment resolution, HMR disposal, and named-plugin loading through a real Loader composition. Host and client builds include the new packages and branded interface artifacts; the composed Web profile selects only `duckduckgo-html` while keeping SearXNG unavailable until configured.

## Alternatives considered

**Rename every package and persisted identifier immediately.** Rejected because it would force a flag-day migration for plugins and local profiles. The visible identity can be independent while the compatibility seam is migrated deliberately.

**Keep keyless search only in the user's profile.** Rejected because a local patch is not a reproducible product capability and disappears for every fresh installation.

**Vendor `dsh-free-web-search` as one monolithic plugin.** Rejected because it duplicates the existing web tool and provider packages, introduces provider-specific request fields outside the shared seam, and includes a general fetch path that follows redirects without the repository's SSRF controls. CurupiraCode instead adopts the useful multi-engine idea in small, testable native providers and preserves attribution.

**Automatically rotate through public SearXNG instances.** Rejected because instance availability and JSON policy change independently, and silent routing would make privacy and data destination unpredictable. Operators choose an endpoint explicitly.

**Retain the upstream public brand and add a subtitle.** Rejected because it risks user confusion and conflicts with the upstream brand guidance for derivative projects.

## Consequences

Users see a coherent independent product and can search on first launch without another key. A DuckDuckGo outage can fall back to Bing, while privacy-conscious deployments can select their own SearXNG instance. Existing plugins continue to load, at the cost of internal `dsh` terminology remaining visible to maintainers and diagnostic tools until the namespace migration is designed. Public HTML and RSS endpoints can change or rate-limit, so parsing is fixture-tested and failures remain provider errors rather than a guaranteed commercial SLA.
