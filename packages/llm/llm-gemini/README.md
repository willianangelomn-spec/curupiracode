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

1. Install the Antigravity CLI, then sign in with your Google account from the Google Gemini card on **Settings → Models** ([ui-gemini-sign-in](../../client/ui-gemini-sign-in/README.md)) or by running `agy` once in a terminal.
2. Pick a model of the **Google Gemini** provider in the model selector. **Settings → Models** lists the provider without a key field.

```yaml
- id: llm-gemini
  name: '@deepseek-ai/dsh-llm-gemini'
  config:
    # Extra ids the local CLI accepts (list them with `agy models`).
    models:
      - id: gemini-3.1-pro-high
        name: Gemini 3.1 Pro (High)
        images: true
```

### Choose a model

The shipped catalog follows `agy models` of agy 1.4.5, where the reasoning effort is part of the id: Gemini 4 Argon (`gemini-4-argon-high`, `-medium`, `-low`), Gemini 3.8 Flash, Claude Opus 5.5, Claude Sonnet 5.5, each at high, medium, and low effort, and GPT-OSS 120B (Medium). Gemini entries accept text and image input; the others are text-only. Which ids work depends on your Google plan and CLI version: Gemini 4 Argon needs agy 1.4.3 or later and a plan that includes it, and it runs only inside the agy harness, so it never uses the Code Assist fallback. When agy does not recognize an id it would silently answer with its default model; the adapter refuses that answer with `UNKNOWN_MODEL` and says how to fix it. When agy has no Google sign-in it waits a minute for one and exits; the adapter then fails with `SIGN_IN_REQUIRED` and asks you to run `agy` in a terminal.

### Configure

| Field | Default | Meaning |
|---|---|---|
| `models` | `[]` | Models added to the catalog; an entry with a shipped id replaces it in place. Each entry takes `id`, optional `name`, `contextWindow` (default 1,048,576), and `images` (default false). Edits apply without restarting the server. |
| `requestImagePixelBudget` | `4194304` | Pixels per request image (2048 × 2048). |
| `requestImageMaxBytes` | `4194304` | Encoded bytes per request image. |
| `maxRequestImageBytes` | `20971520` | Base64 image payload per request; beyond it the request asks the conversation to offload its oldest images. |
| `retryPolicy` | `null` | Provider-owned retry policy; `null` uses normal mode with five retries. |

The adapter runs `GEMINI_AGY_BINARY` when it is set, otherwise the installer's `~/.local/bin/agy` when it exists, otherwise `agy` from `PATH`. `GEMINI_OAUTH_CLIENT_ID` overrides the OAuth client of the fallback transport.

-----

<a id="understand-the-implementation"></a>
## Understand the implementation

<details>
<summary>Implementation internals — click to expand</summary>

[`index.ts`](src/index.ts) registers the `gemini` route, its configurable-provider directory entry, model discovery over the effective catalog, and the Google sign-in flow on the authorization seam. [`agy.ts`](src/agy.ts) flattens the request into one `agy -p` prompt, runs agy in an empty private temporary directory so the CLI's own agent sees no user files, stages request images in that directory referenced with `@path` and granted through `--add-dir`, and parses the JSON result. [`convert.ts`](src/convert.ts) builds the Code Assist `streamGenerateContent` body for the fallback: tool-role messages become `functionResponse` parts named after the assistant call they answer, consecutive results share one turn, and images travel as `inlineData`. [`images.ts`](src/images.ts) reads deterministic request versions and, like the other adapters, fails with `IMAGE_OFFLOAD_REQUIRED` instead of dropping images itself. [`models.ts`](src/models.ts) holds the shipped catalog and merges configured models over it.

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

Through `agy`, the model receives one flattened prompt: a fixed Portuguese opening saying that it answers as CurupiraCode's model, must answer the last human message, and has no tools in this transport; then the application's system text; then the conversation, where only human-sourced user messages are labelled `Usuário` and context that other plugins inject in the user role is labelled `Contexto do aplicativo`. Each retained image is referenced by a private `@path` at its original position. agy adds its own agent instructions and the user's agy rules around this prompt. Through the fallback, it receives Gemini `contents` with the system instruction, `functionCall` and `functionResponse` pairs, and `inlineData` images. Every image is preceded by its stable attachment handle and request dimensions; images the conversation offloaded appear as deterministic placeholders.

#### Token effect

Gemini owns text and image tokenization. Retained images consume visual tokens; handles add a small text cost, while placeholders avoid resending older images.

#### KV Cache effect

An unchanged request prefix and deterministic image projection stay eligible for provider cache reuse. Changing the model, prompt, image policy, or an earlier message prevents reuse from the first changed position.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

- **The agy transport answers in text only** — the CLI runs its own agent and returns one final text, so harness tools (files, shell, web) are not offered to a Gemini session served by `agy`; the Code Assist fallback carries function calls.
- **The Code Assist sign-in has no Web surface** — the Google OAuth flow registered on the authorization seam for the fallback transport is not offered in the Web client; the Models page signs in agy instead.
- **The catalog is written by hand** — ids follow `agy models` at the time of writing; add newer ids through `models`.
- **Images are input only** — native image generation needs a separate Gemini image model and transport.

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

- Parsing `agy models` at discovery time would remove the hand-written catalog once its output format is documented.

</details>
