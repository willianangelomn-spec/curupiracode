# @deepseek-ai/dsh-knowledge-extract-pdf

English | [中文](README.zh.md)

PDF extractor for Curupira Memória, built on Mozilla `pdfjs-dist`. It extracts page text and records page locators such as `p. 7`, allowing retrieved passages to cite a location the user can verify.

## Behavior

The plugin lazily loads PDF.js, gives it a disposable byte copy, extracts pages in order, and registers the `pdf` extractor with `ctx.knowledge`. Original bytes remain available for durable storage after extraction.

## Model Experience

### PDF extraction

#### What the model sees

Nothing directly. Search consumers may later show the model extracted passages with the PDF name, origin, offsets, and a `locator` such as `p. 7`.

#### Token effect

PDF parsing uses no model tokens. Only passages selected for a later request add text tokens.

#### KV Cache effect

No direct effect. Retrieved PDF passages change a request only where the consuming package inserts them.

## Known Limitations and Deferred Work

- Image-only scanned PDFs need OCR, which this package does not perform.
- Reading order follows PDF.js text extraction and may be imperfect for complex multi-column layouts.
- Password-protected or malformed PDFs fail extraction explicitly.
