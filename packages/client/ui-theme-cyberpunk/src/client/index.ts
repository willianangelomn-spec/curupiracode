/**
 * Curupira Forest theme, browser half — one token override layer plus one
 * detail sheet. The visual identity rides {@link ThemeRuntime.overrideTokens}:
 * the layer composes ABOVE whatever theme preference is active (and whatever
 * the durable settings later adopt), so boot races between plugin activation
 * and settings delivery cannot revert the look. Disabling the bundle removes
 * exactly that layer and restores the stock palette, fonts, and scrollbar
 * styling with no residue — enable/disable of the bundle is the on/off switch.
 *
 * Only what cannot ride a token lives in the detail sheet: the webfont
 * `@import` (stylesheet-level, not a variable) and pseudo-element decoration.
 */

import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
// Type-only: pulls the theme plugin's Context merge (ctx.theme service face)
// and the two-mode token-layer shape it validates at its boundary.
import type { ThemeTokenOverrides } from '@deepseek-ai/dsh-client-ui-theme/client'
import cyberpunkCss from '../styles/cyberpunk.css?inline'

/** Plugin-owned identities: stylesheet tag and override-layer source label. */
export const PLUGIN_ID = '@deepseek-ai/dsh-client-ui-theme-cyberpunk'

const UI_STACK = "'Chakra Petch', 'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif"
const DISPLAY_STACK = "'Orbitron', 'Chakra Petch', sans-serif"
const MONO_STACK = "'Share Tech Mono', 'JetBrains Mono', Consolas, monospace"

/**
 * The full alias-token override set. Palette values follow the CurupiraCode
 * forest/circuit mark; typography entries reuse the product's own font tokens with their
 * original metrics preserved, so only the family changes. None of these are
 * scheme-dependent, so every token repeats its value across both modes below.
 */
const CURUPIRA_TOKENS: Readonly<Record<string, string>> = {
  // Foundation stays fully opaque: every translucent surface composes over it.
  '--dsw-alias-bg-base': '#07140d',
  // Glass surfaces stay within the same pine-to-leaf range as the mark.
  '--dsw-alias-bg-layer-1': 'rgba(14, 39, 24, 0.82)',
  '--dsw-alias-bg-layer-2': 'rgba(22, 56, 35, 0.74)',
  '--dsw-alias-bg-layer-3': 'rgba(30, 72, 45, 0.94)',
  '--dsw-alias-bg-overlay': 'rgba(7, 24, 14, 0.94)',
  '--dsw-alias-border-l1': '#275c3b',
  '--dsw-alias-border-l2': '#4fb477',
  '--dsw-alias-brand-primary': '#6ac587',
  '--dsw-alias-brand-text': '#6ac587',
  '--dsw-alias-button-elevated-fill': 'rgba(22, 56, 35, 0.90)',
  '--dsw-alias-button-floating-fill': 'rgba(30, 72, 45, 0.95)',
  '--dsw-alias-button-floating-hover': '#376d48',
  '--dsw-alias-button-primary-fill': '#2f7d4c',
  '--dsw-alias-button-primary-hover': '#3a9459',
  '--dsw-alias-interactive-bg-active': 'rgba(106, 197, 135, 0.16)',
  '--dsw-alias-interactive-bg-hover': 'rgba(106, 197, 135, 0.09)',
  '--dsw-alias-interactive-bg-hover-accent': 'rgba(106, 197, 135, 0.20)',
  '--dsw-alias-interactive-bg-hover-solid': '#275c3b',
  '--dsw-alias-label-primary': '#f0f6f1',
  '--dsw-alias-label-primary-bluish': '#bfe7cc',
  '--dsw-alias-label-secondary': '#aac6b1',
  '--dsw-alias-label-tertiary': '#7fa18a',
  '--dsw-alias-label-caption': '#7fa18a',
  // Markdown surfaces must be overridden with the dark foundation. Leaving
  // them to the selected stock scheme can pair its light code backgrounds
  // with this layer's light labels, making inline tokens and results vanish.
  '--dsw-alias-markdown-code-block-banner': '#102a1a',
  '--dsw-alias-markdown-code-block': '#0e2718',
  '--dsw-alias-markdown-code-segment-selected': '#1e482d',
  '--dsw-alias-markdown-code-segment-unselected': '#163823',
  '--dsw-alias-markdown-inline-code': '#1e482d',
  '--dsw-alias-markdown-placeholder': '#163823',
  '--dsw-alias-markdown-tag': '#163823',
  '--dsw-alias-state-business-primary': '#6ac587',
  '--dsw-alias-state-business-tertiary': 'rgba(106, 197, 135, 0.13)',
  '--dsw-alias-state-error-primary': '#ff6b6b',
  '--dsw-alias-state-success-primary': '#5cbc76',
  '--dsw-alias-state-warn-primary': '#d6a04a',
  '--dsw-alias-scrollbar-bg-l1': 'rgba(106, 197, 135, 0.20)',
  '--dsw-alias-scrollbar-bg-l2': 'rgba(106, 197, 135, 0.27)',
  '--dsw-alias-scrollbar-hover-l1': 'rgba(106, 197, 135, 0.40)',
  '--dsw-alias-scrollbar-hover-l2': 'rgba(106, 197, 135, 0.50)',
  '--dsw-specific-bubble': 'rgba(22, 56, 35, 0.82)',
  '--dsw-specific-input-major': 'rgba(22, 56, 35, 0.90)',
  '--dsw-specific-menu': 'rgba(30, 72, 45, 0.97)',
  '--dsw-specific-sidebar-fill': 'rgba(10, 31, 19, 0.84)',

  // Theme-scoped typography: the base stacks ride the generic family token,
  // display faces ride the heading/title composite tokens (metrics kept).
  '--dsw-font-family': UI_STACK,
  '--ds-font-family-code': MONO_STACK,
  '--dsw-font-mono': MONO_STACK,

  '--dsw-font-markdown-h1': `700 24px/34px ${DISPLAY_STACK}`,
  '--dsw-font-markdown-h1-font-family': DISPLAY_STACK,
  '--dsw-font-markdown-h2': `700 22px/32px ${DISPLAY_STACK}`,
  '--dsw-font-markdown-h2-font-family': DISPLAY_STACK,
  '--dsw-font-markdown-h3': `700 20px/30px ${DISPLAY_STACK}`,
  '--dsw-font-markdown-h3-font-family': DISPLAY_STACK,
  '--dsw-font-markdown-h4': `600 16px/28px ${DISPLAY_STACK}`,
  '--dsw-font-markdown-h4-font-family': DISPLAY_STACK,

  '--dsw-font-xl-24': `600 24px/32px ${DISPLAY_STACK}`,
  '--dsw-font-xl-24-font-family': DISPLAY_STACK,
  '--dsw-font-l-20': `500 20px/28px ${DISPLAY_STACK}`,
  '--dsw-font-l-20-font-family': DISPLAY_STACK,
  '--dsw-font-m-18': `500 16px/28px ${DISPLAY_STACK}`,
  '--dsw-font-m-18-font-family': DISPLAY_STACK,
}

/** The same set shaped for the two-mode override layer (scheme-invariant). */
const CURUPIRA_LAYER: ThemeTokenOverrides = Object.fromEntries(
  Object.entries(CURUPIRA_TOKENS).map(([name, value]) => [name, { light: value, dark: value }]),
)

/**
 * Hard dependency: the theme runtime owned by @deepseek-ai/dsh-client-ui-theme.
 */
export const inject = ['theme']

/**
 * Client plugin body: mount the override layer and the webfont/detail sheet
 * for exactly this bundle's lifetime. No preference write happens — the layer
 * wins visually over any stored or adopted theme while it exists.
 * @param ctx - client cordis context.
 */
export function apply(ctx: ClientContext): void {
  const disposeLayer = ctx.theme.overrideTokens(PLUGIN_ID, CURUPIRA_LAYER)
  ctx.effect(() => disposeLayer, 'ui-theme-cyberpunk: curupira forest token layer')

  ctx.effect(() => {
    if (typeof document === 'undefined') return () => {}
    const tag = document.createElement('style')
    tag.dataset.plugin = PLUGIN_ID
    tag.dataset.pluginCss = `${PLUGIN_ID}/cyberpunk.css`
    tag.textContent = cyberpunkCss
    document.head.appendChild(tag)
    return () => {
      tag.remove()
    }
  }, 'ui-theme-cyberpunk: curupira forest detail stylesheet')
}
