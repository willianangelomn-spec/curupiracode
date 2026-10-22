---
description: "The Brazilian Portuguese language pack for the Web client, for users who read the interface in Portuguese and maintainers adding or updating its translations."
kind: "package-reference"
---

# @deepseek-ai/dsh-client-ui-language-pt-br

English | [中文](README.zh.md)

## Summary

This package adds **Português (Brasil)** to the language picker and registers a pt-BR dictionary for every shipped UI namespace. A browser that asks for `pt-BR` or bare `pt` opens in Portuguese; a key missing from a dictionary falls back to English. It has no runtime state and does not affect model requests.

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

The CurupiraCode Web bundle mounts the pack after the locale plugin:

```yaml
- id: ui-language-pt-br
  name: '@deepseek-ai/dsh-client-ui-language-pt-br'
```

Pick the language under **Settings → General → Language**, or let the browser's language list choose it.

### Update a translation

Each dictionary module under [`src/client/dictionaries/`](src/client/dictionaries/) belongs to one owning package and is checked with `satisfies LocaleDictOf<namespace>`: when an owner adds, renames, or removes a key, the client typecheck names the exact entry to translate here.

-----

<a id="understand-the-implementation"></a>
## Understand the implementation

<details>
<summary>Implementation internals — click to expand</summary>

[`src/client/index.ts`](src/client/index.ts) calls `ctx.locale.addLanguage()` with English as the fallback and registers each dictionary with the single-locale `ctx.locale.register(namespace, 'pt-BR', dictionary)` form, one effect per namespace, so disposing the plugin removes the language and every dictionary. The node half is an empty Loader seat.

</details>

-----

<a id="further-exploration"></a>
## Further Exploration

- [locale](../locale/README.md) — the locale registry, language packs, and the per-key fallback chain.
- [Web client architecture](../../../docs/subsystems/web-client.md) — how browser plugin rows load.

-----

<a id="model-experience"></a>
## Model Experience

None, as the package contributes browser presentation only; nothing here reaches a model request.

#### KV Cache effect

None; this package neither assembles nor sends a provider request.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

- **Experimental plugins stay in English** — namespaces of packages under `packages/experimental` carry no pt-BR dictionary.
- **Package metadata stays in English** — plugin titles and descriptions come from each package's `locale/<language>.json`, which this pack does not extend.

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

None.

</details>
