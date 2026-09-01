# @deepseek-ai/dsh-knowledge

English | [中文](README.zh.md)

Provider-neutral knowledge seam for Curupira Memória. It owns extractor and store registration, content-addressed ingestion, deterministic passage splitting, provenance, retrieval, document listing, related-document lookup, and deletion through `ctx.knowledge`.

## Configuration

- `store` selects one registered store; with no value, exactly one usable store must exist.
- `passageChars` controls the target retrieval-passage size and defaults to `1200`.
- `passageOverlapChars` repeats boundary context and defaults to `150`.

The seam hashes original bytes before storage, so ingesting identical content again reports `alreadyPresent` instead of duplicating it.

## Model Experience

### Knowledge service

#### What the model sees

Nothing directly. Consumers such as `@deepseek-ai/dsh-knowledge-tools` decide when retrieved passages, provenance, and tool schemas enter a model request.

#### Token effect

The service itself adds no tokens. A consumer that inserts search results pays for the selected passage text and provenance.

#### KV Cache effect

No direct effect. Consumer-inserted passages change the request at their insertion point and can prevent cache reuse after that point.

## Known Limitations and Deferred Work

- This package supplies no extractor or durable store by itself.
- Store selection fails explicitly when zero or several usable stores exist and no `store` is configured.
- Passage splitting is character-based; format-specific structure comes only from extractor regions.
