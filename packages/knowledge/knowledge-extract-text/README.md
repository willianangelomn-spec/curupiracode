# @deepseek-ai/dsh-knowledge-extract-text

English | [中文](README.zh.md)

Built-in Curupira Memória extractors for plain text, Markdown, HTML, and DOCX. The plugin registers every extractor with `ctx.knowledge` and adds no remote service or API credential.

## Supported content

- Plain text and Markdown preserve readable source text.
- HTML removes non-content markup before indexing.
- DOCX extracts text from the document XML contained in the archive.

## Model Experience

### Text extraction

#### What the model sees

Nothing directly. The extractor returns normalized text and regions to `ctx.knowledge`; a later search consumer decides which passages reach the model.

#### Token effect

Extraction consumes no model tokens. Retrieved text affects tokens only when another package adds it to a model request.

#### KV Cache effect

No direct effect. A changed extracted passage matters only when a consumer inserts that passage into a later request.

## Known Limitations and Deferred Work

- The package performs no OCR and does not extract text embedded only in images.
- DOCX support targets document text, not exact Word layout, comments, or tracked changes.
- Malformed or encrypted documents fail extraction instead of producing speculative text.
