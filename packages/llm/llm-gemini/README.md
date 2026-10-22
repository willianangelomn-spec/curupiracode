---
description: "Google Gemini through the locally signed-in Antigravity CLI, for users who want Gemini 4 Argon and other Gemini models without an API key and for maintainers of the adapter."
kind: "package-reference"
---

# @deepseek-ai/dsh-llm-gemini

English | [中文](README.zh.md)

## Summary

This adapter serves Google **Gemini** through a **Google account sign-in** instead of an API key. Its primary transport is the locally installed and signed-in Antigravity CLI (`agy`); an existing Google OAuth grant can serve a Code Assist fallback when that binary is absent. The `gemini` route ships a curated catalog led by Gemini 4 Argon, and the `models` setting adds any other id the local CLI accepts.

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

The base bundle mounts the adapter, so a CurupiraCode installation only needs the CLI:

1. Install the Antigravity CLI and run `agy` once in a terminal to sign in with your Google account.
2. Pick a model of the **Google Gemini** provider in the model selector.

```yaml
- id: llm-gemini
  name: '@deepseek-ai/dsh-llm-gemini'
  config:
    # Extra ids the local CLI accepts (list them with `agy models`).
    models:
      - id: claude-opus-5-5-thinking
        name: Claude Opus 5.5 (Thinking)
```

### Choose a model

The shipped catalog follows `agy`, where the reasoning effort is part of the id: Gemini 4 Argon (`gemini-4-argon-high`, `-medium`, `-low`), Gemini 3.8 Flash, Gemini 3.7 Flash, Gemini 3.6 Flash, Gemini 3.5 Flash, Gemini 3.1 Pro, plus the Claude and GPT-OSS ids the CLI offered when the catalog was written. Gemini entries accept text and image input; the others are text-only. Which ids work depends on your Google plan and CLI version: Gemini 4 Argon needs agy 1.4.3 or later and a plan that includes it. When agy does not recognize an id it would silently answer with its default model; the adapter refuses that answer with `UNKNOWN_MODEL` and says how to fix it.

### Configure

| Field | Default | Meaning |
|---|---|---|
| `models` | `[]` | Models added to the catalog; an entry with a shipped id replaces it in place. Each entry takes `id`, optional `name`, `contextWindow` (default 1,048,576), and `images` (default false). |
| `requestImagePixelBudget` | `4194304` | Pixels per request image (2048 × 2048). |
| `requestImageMaxBytes` | `4194304` | Encoded bytes per request image. |
| `maxRequestImageBytes` | `20971520` | Base64 image payload per request; beyond it the request asks the conversation to offload its oldest images. |
| `retryPolicy` | `null` | Provider-owned retry policy; `null` uses normal mode with five retries. |

`GEMINI_AGY_BINARY` overrides the CLI path (default `~/.local/bin/agy`), and `GEMINI_OAUTH_CLIENT_ID` overrides the OAuth client of the fallback transport.

-----

<a id="understand-the-implementation"></a>
## Understand the implementation

<details>
<summary>Implementation internals — click to expand</summary>

[`index.ts`](src/index.ts) registers the `gemini` route, its configurable-provider directory entry, model discovery over the effective catalog, and the Google sign-in flow on the authorization seam. [`agy.ts`](src/agy.ts) flattens the request into one `agy -p` prompt, stages request images as private temporary files referenced with `@path` and granted through `--add-dir`, and parses the JSON result. [`convert.ts`](src/convert.ts) builds the Code Assist `streamGenerateContent` body for the fallback: tool-role messages become `functionResponse` parts named after the assistant call they answer, consecutive results share one turn, and images travel as `inlineData`. [`images.ts`](src/images.ts) reads deterministic request versions and, like the other adapters, fails with `IMAGE_OFFLOAD_REQUIRED` instead of dropping images itself. [`models.ts`](src/models.ts) holds the shipped catalog and merges configured models over it.

</details>

-----

<a id="further-exploration"></a>
## Further Exploration

- [llm](../llm/README.md) — the provider-neutral request vocabulary and adapter contract.
- [llm-pi-ai](../llm-pi-ai/README.md) — Gemini with a `GEMINI_API_KEY` through the pi-ai `google` provider.
- [authorization](../../credentials/authorization/README.md) — the seam that carries the fallback sign-in flow.

-----

<a id="model-experience"></a>
## Model Experience

### Gemini request

#### What the model sees

Through `agy`, the model receives one flattened prompt: system text, then the conversation labelled by role, with each retained image referenced by a private `@path` at its original position. Through the fallback, it receives Gemini `contents` with the system instruction, `functionCall` and `functionResponse` pairs, and `inlineData` images. Every image is preceded by its stable attachment handle and request dimensions; images the conversation offloaded appear as deterministic placeholders.

#### Token effect

Gemini owns text and image tokenization. Retained images consume visual tokens; handles add a small text cost, while placeholders avoid resending older images.

#### KV Cache effect

An unchanged request prefix and deterministic image projection stay eligible for provider cache reuse. Changing the model, prompt, image policy, or an earlier message prevents reuse from the first changed position.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

- **The agy transport answers in text only** — the CLI runs its own agent and returns one final text, so harness tools (files, shell, web) are not offered to a Gemini session served by `agy`; the Code Assist fallback carries function calls.
- **Sign-in happens in the terminal** — the Google sign-in flow registered on the authorization seam has no surface in the Web client yet; run `agy` to sign in.
- **The catalog is written by hand** — ids follow `agy models` at the time of writing; add newer ids through `models`.
- **Images are input only** — native image generation needs a separate Gemini image model and transport.

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

- Parsing `agy models` at discovery time would remove the hand-written catalog once its output format is documented.

</details>
