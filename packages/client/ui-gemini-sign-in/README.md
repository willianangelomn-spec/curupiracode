---
description: "Google sign-in for the Antigravity CLI from the Models page, for users who want Gemini without a terminal and maintainers of the Gemini adapter."
kind: "package-reference"
---

# @deepseek-ai/dsh-client-ui-gemini-sign-in

English | [中文](README.zh.md)

## Summary

This package adds a Google sign-in to the **Google Gemini** card on **Settings → Models**. The card shows whether the local Antigravity CLI (`agy`) holds a Google sign-in; **Sign in with Google** links to Google's consent page, and the code Google shows at the end is pasted back into the card. agy stores the sign-in itself, so the [Gemini adapter](../../llm/llm-gemini/README.md) can use it without an API key. When agy is missing, the card shows the installer command.

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

The CurupiraCode Web bundle mounts the plugin after the Models page:

```yaml
- id: ui-gemini-sign-in
  name: '@deepseek-ai/dsh-client-ui-gemini-sign-in'
```

1. Open **Settings → Models** and find **Google Gemini**.
2. Select **Sign in with Google**, then **Open the Google sign-in page**, and allow access.
3. Copy the code Google shows at the end, paste it into **Authorization code**, and select **Confirm**.

The card reads agy from the same place as the adapter: `GEMINI_AGY_BINARY`, then `~/.local/bin/agy`, then `PATH`. One sign-in runs at a time for the whole server; starting another replaces the one waiting for a code.

-----

<a id="understand-the-implementation"></a>
## Understand the implementation

<details>
<summary>Implementation internals — click to expand</summary>

[`src/agy-auth.ts`](src/agy-auth.ts) runs agy with `AGY_CLI_CDE_AUTH_ACTION`: `check` exits 0 only when a sign-in is stored, and `login` prints the Google URL, reads one code line from stdin without a time limit, and exits 0 after storing the sign-in. Each run uses an empty private working directory. [`src/index.ts`](src/index.ts) is the `geminiSignIn` Remote: `status`, `begin`, `complete`, and `cancel`, with a refused code reported as `signed-out` plus agy's last output line. [`src/client/index.ts`](src/client/index.ts) mounts that Remote and fills the keyed `settings.models.provider-card` slot for the `llm-gemini` row; [`src/client/GeminiSignIn.tsx`](src/client/GeminiSignIn.tsx) renders the states.

</details>

-----

<a id="further-exploration"></a>
## Further Exploration

- [llm-gemini](../../llm/llm-gemini/README.md) — the adapter that serves Gemini through the signed-in agy.
- [ui-settings-models](../ui-settings-models/README.md) — declares the provider-card slot this plugin fills.
- [API Gateway](../../api/gateway/README.md) — carries the `geminiSignIn` Remote.

-----

<a id="model-experience"></a>
## Model Experience

None, as the package signs agy in to Google and contributes nothing to a model request.

#### KV Cache effect

None; this package neither assembles nor sends a provider request.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

- **The card follows the shipped row id** — the Models page keys provider cards by settings namespace, and the plugin fills the `llm-gemini` card; a Gemini row mounted under another id shows no sign-in.
- **agy owns the sign-in protocol** — the card depends on agy's `AGY_CLI_CDE_AUTH_ACTION` actions as agy 1.4.5 implements them; a later agy that changes them needs this package updated.

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

None.

</details>
