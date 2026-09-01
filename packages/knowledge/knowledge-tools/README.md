# @deepseek-ai/dsh-knowledge-tools

English | [中文](README.zh.md)

Agent tools for Curupira Memória. The package lets an agent ingest authorized local files or folders, search grounded passages, list stored documents, and discover semantic relations through the shared knowledge seam.

## Tools

- `knowledge_ingest` indexes supported files from one local path.
- `knowledge_search` returns ranked passages with document provenance.
- `knowledge_documents` lists the vault contents.
- `knowledge_related` finds semantically connected documents.

Folder traversal skips hidden and build directories, accepts Markdown, text, HTML, DOCX, and PDF, and enforces file-count and byte limits.

## Model Experience

### Curupira Memória tools

#### What the model sees

The model receives four tool schemas, including `knowledge_search`, plus a system-prompt instruction to search the user's stored material proactively, ground claims in returned passages, and cite the document and locator without inventing evidence.

#### Token effect

Tool schemas add a stable request cost. Tool results add only the bounded passage text and provenance returned for that call.

#### KV Cache effect

Stable schemas preserve their prefix identity. Each tool call and result appends new content; a changed result affects reuse only after its insertion point.

## Known Limitations and Deferred Work

- One folder walk indexes at most `500` supported files and each file must fit within `20 MiB`.
- The tools read only paths already authorized by the local Curupira process; they do not provide remote-drive synchronization.
- OCR and unsupported formats require additional extractor plugins.
