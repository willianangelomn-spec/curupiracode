# @deepseek-ai/dsh-knowledge-local

English | [中文](README.zh.md)

Local-first Curupira Memória store. It keeps content-addressed originals and passages in a versioned vault, indexes lexical search with SQLite FTS5, and can add multilingual neural retrieval through a locally cached Hugging Face model.

## Configuration

- `root` selects the vault directory and defaults under the Curupira home.
- `semantic` enables local neural retrieval and defaults to `true`.
- `model` selects the Hugging Face embedding model cached under the vault.

When the semantic model cannot load, the store reports the problem once and continues with lexical search.

## Model Experience

### Local retrieval

#### What the model sees

Nothing directly. A search consumer can expose ranked `KnowledgeSearchResult` passages and provenance returned by the local store; original files and embeddings are not model-visible.

#### Token effect

Embedding and retrieval are local and consume no LLM tokens. Only passages inserted into a later model request contribute tokens.

#### KV Cache effect

The store has no direct provider-cache effect. Different search results can change a consumer's inserted context and invalidate reuse after that insertion point.

## Known Limitations and Deferred Work

- The first semantic use may download the configured model and therefore needs network access.
- Semantic failure degrades to lexical retrieval rather than blocking the vault.
- The index is local to one vault root; synchronization between computers is not included.
