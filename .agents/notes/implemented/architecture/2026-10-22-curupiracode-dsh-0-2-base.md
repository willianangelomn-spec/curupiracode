# Agent Note: CurupiraCode on the DeepSeek Harness 0.2 base

Status: implemented

English | [中文](2026-10-22-curupiracode-dsh-0-2-base.zh.md)

## Problem

CurupiraCode carried much of its product behavior as edits inside upstream packages: the Web shell brand, the locale tables, the Models page sign-in card, the session controller, and the connection's CORS handling. DeepSeek Harness 0.2 replaced the `/api/<method>` RPC with the Typert gateway, put browser access behind a launch token and a signed cookie, moved language registration to `ctx.locale.addLanguage`, removed runtime invariants, and changed tool results into `role: 'tool'` messages. Re-applying the in-place edits conflicted with most of those changes, and several of them no longer had an upstream location to attach to.

## Decision

The fork tracks upstream as one squash of the upstream tag `dsh-v0.2.1-rc.2` over the previous CurupiraCode tree. Curupira-specific behavior lives in Curupira-owned packages that bundle rows mount, so upstream files carry only composition rows and package-convention changes:

- `@deepseek-ai/dsh-client-ui-brand-curupira` replaces the `ui-brand-official` row of the Web bundle. It fills the sidebar and hero brand slots and mounts the forest-green palette as a theme override layer on the static accent ramps, so every stock and plugin theme keeps its surfaces.
- `@deepseek-ai/dsh-client-ui-language-pt-br` follows the `locale` row. It adds `pt-BR` with English fallback and registers one dictionary per namespace. Each dictionary `satisfies` its namespace's typed key set, so an upstream key that is added, renamed, or removed fails the client typecheck until the pack follows.
- The `browser` and `browser-chat` presets are preset patch files of the Web bundle, and the `knowledge-tools` row sits in the `standard`, `ptc`, and `cordis` presets, so the tool-free browser presets cannot read the vault.
- `@deepseek-ai/dsh-llm-gemini` uses the 0.2 LLM contract: tool-role messages become `functionResponse` parts, images that exceed the request budget fail with `IMAGE_OFFLOAD_REQUIRED`, and the catalog starts with Gemini 4 Argon. Its `models` field is volatile and its directory entry reports keyless native authentication, so **Settings → Models** lists Google Gemini without a key field.
- The knowledge, DuckDuckGo search, SearXNG search, and Cyberpunk theme packages follow the 0.2 package conventions: no invariant companions, explicit Typert parameter annotations, and the current client package layout.

### Withdrawn features

- Permanent session deletion, decided in the [semantic memory note](../feature/2026-08-30-curupira-semantic-memory-and-session-deletion.md), is withdrawn. It was an edit to the session controller, and the 0.2 controller is a Typert Remote whose session lifecycle and Remote access rules belong upstream. Archive is the only removal action.
- The `trustedExtensionIds` CORS bridge of the [browser extension note](../feature/2026-08-31-curupiracode-browser-extension.md) is withdrawn. The 0.2 connection admits `/api` only for same-origin requests with the browser cookie or a Peer credential, so the extension's requests receive HTTP 403. Its replacement is a Host bridge with visible token pairing, tracked in the roadmap's browser milestone.
- The Gemini sign-in card that ran the adapter's own Google OAuth flow is withdrawn because the 0.2 Models page has no surface for authorization-seam flows. `@deepseek-ai/dsh-client-ui-gemini-sign-in` replaces it: it fills the keyed `settings.models.provider-card` slot of the `llm-gemini` row and signs in agy itself through agy's `AGY_CLI_CDE_AUTH_ACTION` check and login actions, so the transport that serves Gemini owns the sign-in. The Google OAuth flow stays registered on the authorization seam for the Code Assist fallback.

## Alternatives considered

**Re-apply the previous in-place patch to the new upstream.** Rejected because every later sync would conflict in the same files, and the locale tables and session controller changed shape in 0.2.

**Merge upstream with its full history.** Rejected because the CurupiraCode history starts from a snapshot without upstream ancestry. A true merge would import thousands of upstream commits into a repository that never contained them; a squash from the recorded upstream tag keeps the fork's history linear and the next sync repeatable.

**Port the extension through a generic proxy of every owner Remote.** Rejected because it would give an extension origin owner-equivalent access without a pairing step a person approves. The bridge deserves its own design and review.

## Consequences

Upstream syncs now touch CurupiraCode at bundle rows, preset files, and package conventions instead of inside upstream components. The pt-BR pack must be updated whenever upstream changes a translated namespace, and the typecheck reports exactly which keys moved. Users lose permanent session deletion and the extension's server connection until the paired bridge exists; the root README and the extension README state that gap. Gemini users sign in from the Gemini card, and the card depends on agy's authentication actions as agy 1.4.5 implements them.
