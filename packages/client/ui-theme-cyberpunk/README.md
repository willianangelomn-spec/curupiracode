# dsh-client-ui-theme-cyberpunk

English | [中文](README.zh.md)

Profile Bundle supplying the **Curupira Forest** browser theme: deep pine surfaces and related leaf greens taken from the CurupiraCode mark, with restrained amber reserved for folklore accents and attention states. Theme-scoped typography uses Chakra Petch for the interface, Orbitron for display headings, and Share Tech Mono for code. The bundle mounts one token override layer into @deepseek-ai/dsh-client-ui-theme's runtime and keeps it alive for exactly as long as the bundle is composed, so enable/disable of the bundle is the on/off switch; removing it restores the stock themes, fonts, and scrollbar styling without residue.

## How the theme is expressed

Everything visual rides two channels that already exist. The palette plus the font stacks ride a token override layer: ui-layout's presenter folds `overrideTokens` layers into the composed active snapshot and projects the result as inline CSS variables on body, so removing the layer removes the values again — the typefaces are tokens like any color, not a stylesheet patch. Only what cannot be a variable lives in the bundle's detail sheet: the webfont `@import` (Google Fonts, degrading silently to the stock fallback stacks offline) and pseudo-element decoration (`::selection`, gradient scrollbars).

The heading and title composite tokens are restated with their original metrics (`700 24px/34px`, …) and only the family swapped, so line grids and sizes stay pixel-identical to the stock theme.

## Activation model

The layer sits ABOVE whatever preference resolves — stored, adopted from settings mid-boot, or switched in the Appearance row — because override layers compose after the active theme regardless of ordering between plugin activation and settings delivery. While the bundle is composed, Curupira Forest is what renders; uncomposing it hands control fully back to the stored preference, which itself is never written.

## Model Experience

None, as this package registers no prompt, tool, message, or provider request.

#### KV Cache effect

None; this package never assembles model input.

## Known Limitations and Deferred Work

- **The layer masks every theme while composed** — the Appearance row still switches the underlying preference, but the rendered look stays Curupira Forest until the bundle is removed; there is no light counterpart to switch to.
- **Webfonts need network** — faces load from Google Fonts; offline, the stacks fall back to system fonts while the forest palette still applies.
- **Dark-styled values over any scheme** — the layer repeats its dark-tuned values for both modes, so a user preference of light renders forest-dark surfaces while composed.
