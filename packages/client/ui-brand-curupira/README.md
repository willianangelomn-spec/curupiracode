---
description: "The CurupiraCode brand occupants and palette for the Web client, for users choosing the brand presentation and maintainers replacing it."
kind: "package-reference"
---

# @deepseek-ai/dsh-client-ui-brand-curupira

English | [中文](README.zh.md)

## Summary

This package gives the Web client the CurupiraCode identity: the trail-circuit mark with its reversed footprints in the sidebar and the empty-conversation hero, the **CurupiraCode** wordmark beside the sidebar mark, and the forest-green accent with footprint-gold amber in both color schemes. It has no runtime state and does not affect model requests.

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

The CurupiraCode Web bundle mounts the plugin in place of the official brand package:

```yaml
- id: ui-brand-curupira
  name: '@deepseek-ai/dsh-client-ui-brand-curupira'
```

Disabling the row restores the shell fallbacks and the stock accent color together.

-----

<a id="understand-the-implementation"></a>
## Understand the implementation

<details>
<summary>Implementation internals — click to expand</summary>

[`src/client/index.ts`](src/client/index.ts) occupies `sidebar.brand.mark`, `sidebar.brand.name`, and `conversation.hero.brand.mark` through nested `ctx.slots.inject()` calls, so the occupants follow their declarations through activation order and HMR. The palette is one `ctx.theme.overrideTokens()` layer over the static `deepseek` and `amber` ramps; every theme keeps its surfaces while the accent follows the brand. Each rendered mark owns its gradient id, because the sidebar, the rail, and the hero can show the mark at once.

</details>

-----

<a id="further-exploration"></a>
## Further Exploration

- [ui-sidebar](../ui-sidebar/README.md) — declares the sidebar brand slots.
- [ui-conversation](../ui-conversation/README.md) — declares the hero brand slot.
- [ui-theme](../ui-theme/README.md) — the token override layer.
- [Brand guidelines](../../../BRAND.md) — the CurupiraCode identity rules.

-----

<a id="model-experience"></a>
## Model Experience

None, as the package contributes browser presentation only; nothing here reaches a model request.

#### KV Cache effect

None; this package neither assembles nor sends a provider request.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

- **The browser title is independent** — `DSH_CLIENT_TITLE` (default `CurupiraCode` in this distribution) selects the title at build time, outside the slot system.

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

None.

</details>
