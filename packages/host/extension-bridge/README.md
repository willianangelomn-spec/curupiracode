---
description: "Host bridge for the CurupiraCode browser extension: a pairing page on the signed-in Web server issues a revocable token for one allowed extension origin, and a fixed loopback endpoint set lets that origin drive tool-free browser-preset Sessions and add documents to Curupira Memory."
kind: "package-reference"
---

# @deepseek-ai/dsh-host-extension-bridge

English | [中文](README.zh.md)

## Summary

The [CurupiraCode browser extension](../../../apps/browser-extension/README.md) runs at a `chrome-extension://` origin, which Connection's `/api` fence refuses by design. This package gives that origin its own route family on the Web server. A person signed in to CurupiraCode approves the extension on `/extension-bridge/pair` and receives a pairing token; the extension then calls a fixed set of `v1` endpoints with that token to create, prompt, read, and cancel Sessions running the configured browser presets, and to add documents to Curupira Memory. Every other origin, a forged Host, a missing or revoked token, and a Session whose preset is not admitted are refused.

## Table of Contents

- [Use this package](#use-this-package)
- [Understand the implementation](#understand-the-implementation)
- [Further Exploration](#further-exploration)
- [Model Experience](#model-experience)
- [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)
- [Dev Note](#dev-note)

-----

<a id="use-this-package"></a>
## Use this package

The `dsh-web-app` bundle mounts the plugin as the `extension-bridge` row with the extension's manifest-derived origin and the `browser` and `browser-chat` presets. The plugin waits for `webServer`, `connection`, `credentials`, `typertGateway`, and `sessionController`; `knowledge` is optional.

### Configuration

| Field | Meaning |
|---|---|
| `allowedOrigins` | Required. Exact `chrome-extension://<32-letter id>` origins the pairing page offers; an empty list or any other value fails plugin load. |
| `agentPresets` | Required. Presets the extension may create Sessions with and keep driving; an empty list fails plugin load. |
| `maxRequestBodyBytes` | Largest buffered JSON body. Default 160 MiB, which covers five 20 MiB images as base64 plus prompt text. |
| `maxDocumentBytes` | Largest decoded `knowledge/ingest` document. Default 20 MiB. |
| `maxDocumentTextChars` | Longest extracted text `knowledge/ingest` returns. Default 120000 characters. |
| `maxHistoryMessages` | Most messages `sessions/messages` returns. Default 100. |

### Pairing

`GET /extension-bridge/pair` shows every allowed origin, its pairing date, and what a token grants. Its **Aprovar e gerar código** (or **Gerar novo código**) button posts the origin back and answers with the token once; approving again replaces the previous token, and **Revogar** removes it. The extension opens this page with `chrome.tabs.create`, so the navigation carries the browser's SameSite=Strict session cookie. The page and its two form posts pass `ctx.connection.admit` and must resolve to the shared browser Peer: a request without the cookie receives a sign-in page with HTTP 401, a request Connection's Host/Origin fence refuses receives HTTP 403, and an API operator credential from `/connect` is not accepted. The extension's own origin therefore cannot approve itself, even with the cookie attached.

The page carries no script. Its Content-Security-Policy allows only the nonced inline style and same-origin form posts, forbids framing, and the responses are never cached. The referrer policy is `same-origin`: under `no-referrer` the browser sends `Origin: null` with the page's own form posts, which Connection refuses.

### Endpoints

Every endpoint is `POST /extension-bridge/v1/<endpoint>` with an `application/json` body and the header `Authorization: Bearer <token>`. The request must carry a loopback `Host` (`localhost`, `[::1]`, or any 127/8 address) and an `Origin` equal to the allowed origin the token was issued to. Responses carry no CORS headers; extension pages reach loopback through their host permissions. [`src/types.ts`](src/types.ts) declares every request and answer.

| Endpoint | Request | Answer |
|---|---|---|
| `status` | `{}` | Admitted presets and whether `knowledge` is mounted |
| `sessions/create` | `agentPreset`, `title` | `sessionId` of a new Session running that preset, renamed to `title` |
| `sessions/prompt` | `sessionId`, `requestId`, `content`, optional `clientTimeZone` | `{ accepted: true }` once the prompt is queued |
| `sessions/reply` | `sessionId`, `requestId` | `queued`, `running`, or the ended turn's state with its last assistant text |
| `sessions/messages` | `sessionId` | The latest human prompts and assistant messages, oldest first |
| `sessions/cancel` | `sessionId` | `{ accepted: true }` once cancellation is admitted |
| `knowledge/ingest` | `name`, strict base64 `data`, optional `format` | The ingest result plus the extracted text, truncated to `maxDocumentTextChars` |

`content` accepts text parts and inline base64 image parts. A reply is `completed` for a turn that ended `completed` or `max-tokens`, `cancelled` for `aborted`, and `failed` for every other ending, with the turn's reason and message.

### Refusals

Every refusal answers `{ "error": { "code", "message" } }`.

| Status | Cause |
|---|---|
| 400 | Invalid JSON, a body that does not match the endpoint, or invalid base64 |
| 401 | Missing, malformed, or unpaired token; the response carries `WWW-Authenticate: Bearer` |
| 403 | Non-loopback Host, an Origin that is not allowed, a preset that is not admitted, or a Session whose current preset is not admitted |
| 404 | Unknown endpoint or Session |
| 405, 413, 415 | Wrong method, body or document over its limit, wrong media type |
| 409 | A Session that needs migration; opening it once in CurupiraCode migrates it |
| 422 | A Session Remote or knowledge failure, with its own code and message |
| 500 | Any other failure; the message names no internals and the Host log records the error |
| 503 | Knowledge is not mounted, or the plugin is disposing |

-----

<a id="understand-the-implementation"></a>
## Understand the implementation

<details>
<summary>Implementation internals — click to expand</summary>

### Pairing records

All pairings live in one credential grant record, `host-extension-bridge/pairings`, as `{ origin, tokenSha256, pairedAt }` entries; the token itself is never stored. A token is 32 random bytes in base64url, and verification compares SHA-256 digests in constant time. Activation fails on a record it cannot read. Writes go through `modifyRecord` and update the in-memory view only after they commit; a `credentials/record-updated` notice for the record reloads it, so a revocation written by another process applies here, and an unreadable or malformed reload revokes every pairing in this process. Loads and writes run in arrival order.

### Session work

The plugin creates one owner Peer with `interactions: 'none'` and calls `session/create`, `session/rename`, `session/prompt`, `session/cancel`, and `session/projections` through `ctx.typertGateway.invoke` as that Peer. Before any session-scoped endpoint runs, the Session's current `agentPreset` projection must name an admitted preset, so a known id of a Session with tools is refused. Replies and messages read `ctx.sessionController.inspect`; a reply is located by the user message whose source carries the prompt's `requestId` and ends at the first `turn/end` after it.

### Lifecycle

One prefix route serves `/extension-bridge`. Each request's signal aborts when its client disconnects or the plugin disposes. Teardown removes the route, aborts admitted requests and waits for them, then waits for an admitted pairing write.

### Source map

| File | Role |
|---|---|
| [`src/index.ts`](src/index.ts) | Plugin, `Config`, routing, pairing-page admission, failure mapping, lifecycle |
| [`src/request-trust.ts`](src/request-trust.ts) | Loopback Host, allowed Origin, and bearer admission |
| [`src/pairings.ts`](src/pairings.ts) | Durable pairing record and token verification |
| [`src/operations.ts`](src/operations.ts) | The `v1` endpoints over the Session Remote and the knowledge service |
| [`src/conversation.ts`](src/conversation.ts) | Reply state and message projection from Session events |
| [`src/pairing-page.ts`](src/pairing-page.ts) | Server-rendered pairing, sign-in, and refusal pages |
| [`src/http.ts`](src/http.ts) | Bounded body reading and response headers |
| [`src/types.ts`](src/types.ts) | Wire payload types |

</details>

-----

<a id="further-exploration"></a>
## Further Exploration

Read these for the other sides of the bridge: the extension that calls it, the fence it reuses for pairing, and the APIs it calls.

- [CurupiraCode browser extension](../../../apps/browser-extension/README.md) — the side panel that pairs and calls these endpoints.
- [Connection](../../client/connection/README.md) — the Host/Origin fence and browser cookie behind the pairing page.
- [Session Controller](../../api/session-controller/README.md) — the Session Remote the endpoints call.
- [Browser extension Agent Note](../../../.agents/notes/implemented/feature/2026-08-31-curupiracode-browser-extension.md) — why the bridge pairs a token instead of trusting the extension id.

-----

<a id="model-experience"></a>
## Model Experience

Indirectly, through the Session prompt path: extension prompts enter admitted browser-preset Sessions as ordinary user messages, and that preset composes every other part of the request.

#### KV Cache effect

None; each prompt appends to its Session like any other user message, and the bridge adds nothing to the request prefix.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

- **Polled replies** — `sessions/reply` and `sessions/messages` copy the Session's whole event log on each call and answer after the turn ends; the extension polls them and receives no streaming deltas.
- **Chromium origins only** — `allowedOrigins` accepts `chrome-extension://` origins; a Firefox `moz-extension://` origin, whose id differs per installation, is refused.
- **Pairing does not confine the paired extension** — an extension with loopback host permissions can also script the signed-in Web interface; pairing proves a person approved the origin, not what its code does.
- **Single-language page** — the pairing page is Brazilian Portuguese, the language of the extension that opens it.

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

None.

</details>
