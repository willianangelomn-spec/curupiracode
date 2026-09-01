# @deepseek-ai/dsh-llm-gemini

English | [中文](README.zh.md)

A DeepSeek Harness LLM adapter that serves Google's **Gemini** through a **Google account sign-in** instead of an API key. Its primary transport is the locally installed and authenticated Antigravity CLI (`agy`); an existing Google OAuth grant can provide a Code Assist fallback when that binary is absent.

## Why a separate package

The bundled multi-provider adapter (`llm-pi-ai`) ships Google's provider, but that provider authenticates with a static `GEMINI_API_KEY` and exposes no login flow. Gemini-via-login therefore lives in its own adapter.

## Flow

1. The adapter registers the `gemini` route, a configurable-provider directory entry, and model discovery against the curated Gemini catalog.
2. Text requests are flattened into an `agy -p` prompt. Image-capable models receive deterministic request-sized images through private temporary files, `@path` prompt references, and request-scoped `--add-dir` access. Temporary files are removed after the call.
3. If `agy` is unavailable and an OAuth grant already exists, the adapter uses Code Assist `streamGenerateContent`; images are sent as Gemini `inlineData`.
4. Models whose catalog metadata omits the `image` input modality reject a new image before provider execution instead of silently ignoring it.

## Configuration

The route is fixed (`gemini`). The settings section (`llm-gemini`) owns the provider retry policy plus these image bounds:

- `requestImagePixelBudget`: deterministic pixels per request image (default `4194304`, or 2048 × 2048).
- `requestImageMaxBytes`: encoded bytes per request image (default `4194304`).
- `maxRequestImageBytes`: accumulated base64-equivalent request image payload (default `20971520`). Oldest images beyond the bound become stable text placeholders without changing durable history.

### OAuth client id

The default client id is the public Google client used by the Generative Language API. Override it per deployment with:

```sh
GEMINI_OAUTH_CLIENT_ID=your-oauth-client-id
```

## Supported models

The curated catalog follows the models offered by `agy`: Gemini 3.7 Flash, Gemini 3.6 Flash, Gemini 3.5 Flash, and Gemini 3.1 Pro variants. These Gemini entries advertise text and image input. Catalog entries such as Claude or GPT-OSS remain text-only unless their transport is explicitly validated for images.

## Model Experience

### Gemini request

#### What the model sees

The selected Gemini model receives the flattened system prompt and conversation, with every retained image at its original logical position. The `agy` transport sees private `@path` references, while the OAuth fallback receives `inlineData`. Each image is preceded by its stable attachment handle and actual request dimensions. Images beyond the aggregate bound become deterministic placeholders instead of being silently dropped.

#### Token effect

Gemini owns the exact text and image tokenization. Retained images consume visual tokens; stable handles add a small text cost, while offloaded placeholders avoid resending older visual content.

#### KV Cache effect

An unchanged request prefix and deterministic image projection can remain eligible for provider cache reuse. Changing the model, prompt, image policy, or an earlier message can prevent reuse from the first changed position.

## Known Limitations and Deferred Work

- A working local `agy` installation and its Google sign-in are required for the primary transport. Run `agy` once after installing CurupiraCode on a new computer.
- The request can reference PNG, JPEG, WebP, and GIF attachments after the shared attachment layer has normalized and bounded them.
- The current Antigravity catalog accepts image input but returns text output. Native image generation requires a separate Gemini image model and API transport.
- The adapter is a sibling of `llm-pi-ai`; both mount from the base bundle.
