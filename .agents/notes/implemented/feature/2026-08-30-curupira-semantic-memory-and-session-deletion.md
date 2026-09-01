# Agent Note: Curupira semantic memory and session deletion

Status: implemented

English | [中文](2026-08-30-curupira-semantic-memory-and-session-deletion.zh.md)

## Problem

Curupira Memória needs to retrieve a user's authorized materials by meaning, not only by matching the same words, while remaining useful without a hosted model or API key. The session list also needs a clear distinction between reversible archiving and permanent deletion so disposable test conversations can be removed safely.

Both capabilities must be part of the distributable composition. They cannot depend on a contributor-specific path, an already-populated machine cache, or a private service.

## Decision

The local knowledge store keeps SQLite FTS5 as the mandatory baseline and adds optional local multilingual embeddings through Transformers.js. The default model is `Xenova/multilingual-e5-small`, loaded lazily with quantized ONNX weights and cached under the versioned knowledge vault. Search combines lexical and semantic candidates, backfills vectors for existing passages, and stores normalized document centroids for a `knowledge_related` operation. A recoverable model or download failure logs once and leaves lexical search operational.

The base knowledge tools register `knowledge_related` and a system-prompt section that directs the agent to search the user's vault proactively when a request may depend on it, preserve passage provenance, and never invent citations. The originals remain content-addressed and unchanged. This milestone supplies the semantic engine and relation API; an Obsidian-style graph/editor interface remains a later interface milestone.

Each ordinary session row now exposes a destructive `Apagar conversa` action beside the existing non-destructive archive action. The UI requires explicit confirmation. The RPC refuses subagent-owned or foreign-live sessions, retires a Host-owned live agent, detaches workspace memberships, and permanently deletes durable JSONL or SQLite session data. The destructive RPC is loopback-only until the Host has real remote authentication.

## Portability

No personal filesystem path is embedded. The vault defaults to `<DSH_HOME>/knowledge/v1`, then `<CURUPIRA_HOME>/knowledge/v1`, then the current user's home-based harness directory. Model artifacts are downloaded on first semantic use into `<vault>/models` and reused offline afterward. A fresh installation receives the dependency, plugin composition, schema migration, fallback behavior, and user-visible locale strings from the repository itself.

## Verification

Store tests cover semantic retrieval beyond shared keywords, related-document ranking, vector backfill, lexical fallback, provenance, deduplication, and removal. A real ONNX smoke test produced normalized 384-dimensional embeddings using the portable cache. Session tests cover JSONL and SQLite durable deletion, API transport, confirmation gating, danger styling, and client state removal. The client bundles and the local Web composition build and serve after restart.

## Alternatives considered

**Require a hosted embeddings API.** Rejected because the local second brain must work without an additional credential, recurring charge, or disclosure of private vault text.

**Replace FTS5 with neural search.** Rejected because first-use model download, unsupported hardware, or an unavailable model must not disable retrieval. Hybrid search also retains exact-term strength.

**Use only archive for unwanted conversations.** Rejected because archive is intentionally reversible and retains the durable conversation. The two actions now communicate distinct retention outcomes.

**Delete a live session by identifier without ownership checks.** Rejected because another Host consumer or a parent agent may own capabilities that require orderly retirement. Deletion is limited to ordinary sessions safely owned by this Host.

## Consequences

Curupira Memória can discover Portuguese and multilingual conceptual matches locally and expose related materials without Gemini, DeepSeek, or another paid API. The first neural search may take longer while the model downloads, and semantic ranking currently scans at most 50,000 stored passage vectors in-process; larger vaults will need a dedicated approximate-nearest-neighbor index. Permanent deletion cannot be undone, so the confirmation describes that boundary and archiving remains available for reversible cleanup.
