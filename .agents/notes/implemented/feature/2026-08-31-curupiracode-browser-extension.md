# Agent Note: CurupiraCode browser extension preview executor

Status: implemented

English | [中文](2026-08-31-curupiracode-browser-extension.zh.md)

## Problem

CurupiraCode needs an open browser extension that can turn a user's instruction into actions on the active page without giving page content authority over the agent or silently exposing the host computer. The first version must be useful in a fresh installation, reuse the model already configured in the local harness, avoid embedding an API key, and make every page mutation reviewable.

The ordinary Web API rejects extension origins by design. Opening it broadly with `Access-Control-Allow-Origin: *` or `<all_urls>` would weaken the existing DNS-rebinding and cross-site request boundary. Mounting the normal agent preset would also expose Bash, filesystem, Curupira Memória, and unrelated tools to a job that only needs to transform a bounded page snapshot into JSON.

## Decision

`apps/browser-extension` ships a Chromium Manifest V3 side-panel extension for Chrome and Edge 116 or newer. The browser action opens the side panel. `activeTab` plus `scripting` injects the content script only after a user gesture; the manifest has no `<all_urls>` grant and its only persistent host permissions are HTTP loopback at `127.0.0.1` and `localhost`. A public manifest key fixes the extension id so the local bridge can recognize one reproducible origin without shipping private key material.

The content script captures the title, URL, selected text, bounded visible page text, and a bounded list of interactive elements. It never captures current field values. Elements receive short snapshot-local identifiers; the model never writes CSS selectors. The new `browser` agent preset contains only a complete persona, no model-facing tools or runtime context, and treats all page text and labels as untrusted data. Curupira Memória's model-facing plugin moved from the process-global composition into the ordinary `standard`, `code`, and `cordis` agent scopes so the restricted preset remains empty while the underlying knowledge service remains shared.

The side panel separates **Conversation** from **Automation**. Conversation creates or restores one durable Harness session, stores only its session id in extension storage, and projects human and assistant messages back from `session.history`; internal page wrappers never render in the transcript. The optional page-context checkbox captures the current page at send time. A distinct `browser-chat` preset is tool-free, answers conversationally in Brazilian Portuguese, refuses instructions embedded in captured page data, and directs page-changing requests to Automation. Starting a new conversation detaches the panel from the previous session without deleting its durable history.

The extension creates a local `browser` session, asks the user's configured provider for exactly one JSON plan, polls durable history, parses and validates the response, and renders a human-readable preview. Only a separate **Execute approved actions** gesture runs `click`, `fill`, `select`, `check`, or `scroll` against identifiers from the current snapshot. Passwords, payment-card fields, authentication codes, file uploads, and browser-internal pages are always blocked. Submit-like or otherwise consequential actions receive a risk label and require an additional checkbox plus confirmation. A navigation invalidates the snapshot and requires a fresh capture and plan.

The dedicated **Answer form** path reuses the restricted planner but narrows its accepted result further to `fill`, `select`, and `check`. Its request includes only eligible field metadata and explicitly separates user-supplied facts from untrusted form text. It forbids invented personal facts, requests answer confidence, and omits unsupported or sensitive fields. The preview gives every action an approval toggle and editable value; low-confidence answers start disabled. Even adversarial model output cannot click a submit control in this mode because the local validator rejects the whole result before rendering it.

Form macros provide a separate deterministic path that does not call a model. Explicit **Copy macro** recording captures non-sensitive field changes and intermediate Next/Continue/Advance controls on the authorized tab. A field fingerprint combines semantic labels, question context, type, name, accessibility attributes, and an ordinal rather than screen coordinates or executable selectors. The service worker serializes recording updates through session storage, reinjects the recorder into every authorized frame after same-origin navigation under the existing `activeTab` grant, then persists a finished versioned macro locally. Start and finish also enumerate all injectable frames so embedded forms are flushed before validation. Replay scores each recorded step read-only against every frame, selects the best matching frame, resolves its fingerprints, and never leaves the recorded origin. A per-document token distinguishes full reloads even when URL and field signatures remain unchanged. The validator removes every advance from the final known page, including imported files, so replay cannot submit the form's last step.

Macros are portable JSON with explicit export/import. Import accepts only the versioned `fill`, `select`, `check`, and intermediate `advance` vocabulary, bounds pages/actions/value lengths, and requires every page to use one HTTP origin. Password, payment-card, authentication-code, and upload controls are excluded at capture and checked again at replay. Because exported values can contain personal information, the UI and README identify the file as user-controlled local data rather than a share-safe template.

The Host connection adds `trustedExtensionIds`, defaulting to the manifest-derived CurupiraCode id. An exact `chrome-extension://<id>` origin may preflight and POST only when `Host` is loopback. Extension GETs, WebSocket upgrades, malformed or undeclared ids, ordinary cross-site pages, and non-loopback hosts stay denied. Privileged RPCs retain an inner same-origin loopback check, so extension CORS cannot open configuration, credentials, native desktop actions, or preset authoring. This is a development bridge based on installed-origin identity, not user authentication; token pairing remains roadmap work.

## Portability

The extension stores only its loopback base URL, defaults to `http://127.0.0.1:3080`, and rejects non-loopback configuration. No personal path, provider credential, model name, or API key appears in the artifact. `pnpm --filter @deepseek-ai/dsh-browser-extension build` produces a self-contained unpacked extension under `apps/browser-extension/dist`; the same directory loads in Chrome and Edge. A Firefox build remains separate because its sidebar manifest API is incompatible with Chromium's `sidePanel` API.

## Verification

Unit tests pin loopback URL normalization, native Fetch invocation, complete RPC envelopes, chat-session creation, transcript projection without page-wrapper disclosure, strict JSON planning, bounded element identifiers, sensitive-field refusal, risk classification, form-only action enforcement, valid select options, exclusion of sensitive and submit controls from form prompts, macro event deduplication, portable-schema validation, same-origin enforcement, executable-action refusal, and final-step advance removal. The real shipped composition e2e mounts both `browser` and `browser-chat`, asserts their exact prompt snapshots and empty tool catalogs, and separately proves ordinary presets retain Curupira Memória. Host tests cover valid and invalid extension ids, loopback-only origin recognition, accepted preflight headers, and impostor denial. A built Host was restarted locally: the shipped origin received 204 for preflight and 200 for `host.describe`, an undeclared extension id received 403, and the live preset roster exposed both restricted browser modes. Manifest verification derives and pins the stable id and rejects non-loopback host permissions.

## Alternatives considered

**Give the extension the ordinary Web origin.** Rejected because extension pages do not share the served application's origin and pretending they do would bypass rather than extend the existing trust boundary.

**Allow every extension origin or every website.** Rejected because a locally reachable unauthenticated RPC endpoint must not become a browser-wide ambient capability. Exact installed-origin recognition and loopback are both mandatory for this prototype.

**Mount the standard agent and ask it not to use tools.** Rejected because prompt instructions are not a capability boundary. The restricted preset's tool catalog is structurally empty.

**Embed an existing extension wholesale.** Page Assist (MIT), Nanobrowser (Apache-2.0), and WebBrain (current GPL-3.0 releases) validate side-panel chat and Ask/Act separation, but each owns its own provider, session, permission, and agent loop. Replacing those layers would duplicate or bypass the Harness. Their public product patterns inform the split interface; no third-party source is copied into this implementation.

**Execute model output immediately.** Rejected because page interpretation can be wrong or adversarial. Validation, preview, and an explicit execution gesture are separate enforced states.

**Automate passwords, payment, and uploads after confirmation.** Deferred because those capabilities require stronger policy, field-level disclosure, token pairing, and dedicated adversarial tests.

## Consequences

The prototype now supports durable conversation and bounded automation on the active page with the user's existing CurupiraCode provider and no extra API credential. Replies currently arrive after the durable turn completes rather than token-by-token. It deliberately handles one captured page at a time; streaming, multi-tab comparison, durable citations, resumable navigation workflows, a local action-log viewer, token pairing, store packaging, and Firefox support remain future work. The public manifest key stabilizes identity but does not authenticate a person, so the bridge remains loopback-only and must not be reused as remote-access security.
