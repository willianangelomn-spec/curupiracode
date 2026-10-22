/**
 * CurupiraCode occupants for the generic browser-brand slots, plus the brand
 * palette. The palette rides {@link ThemeRuntime.overrideTokens}: it recolors
 * the static `deepseek` accent ramp (the shell's primary accent) to forest
 * green and the `amber` ramp to the mark's footprint gold in both color
 * schemes, so every stock and plugin theme keeps its surfaces while the accent
 * follows the brand. Disabling the plugin removes the occupants and the layer
 * together.
 */
import type { Context as ClientContext } from '@deepseek-ai/cordis'
// Type-only: the slot registry and the brand-slot declarations this plugin occupies.
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
// Type-only: the theme plugin's Context merge (ctx.theme) and its override-layer shape.
import type { ThemeTokenOverrides } from '@deepseek-ai/dsh-client-ui-theme/client'
import { CurupiraBrandMark, CurupiraBrandName } from './Brand.tsx'

export { CurupiraBrandMark, CurupiraBrandName } from './Brand.tsx'

/** Source label of the brand palette override layer. */
export const PALETTE_SOURCE = '@deepseek-ai/dsh-client-ui-brand-curupira'

/** Forest-green accent ramp and footprint-gold amber ramp, identical in both schemes. */
const PALETTE: Readonly<Record<string, string>> = {
  '--dsw-static-deepseek-50': 'rgb(240, 248, 242)',
  '--dsw-static-deepseek-100': 'rgb(226, 243, 230)',
  '--dsw-static-deepseek-200': 'rgb(198, 230, 207)',
  '--dsw-static-deepseek-300': 'rgb(156, 210, 172)',
  '--dsw-static-deepseek-400': 'rgb(106, 197, 135)',
  '--dsw-static-deepseek-450': 'rgb(79, 180, 119)',
  '--dsw-static-deepseek-500': 'rgb(58, 148, 89)',
  '--dsw-static-deepseek-600': 'rgb(47, 125, 76)',
  '--dsw-static-deepseek-700-delete': 'rgb(39, 92, 59)',
  '--dsw-static-deepseek-800': 'rgb(29, 72, 45)',
  '--dsw-static-deepseek-900': 'rgb(18, 53, 32)',
  '--dsw-static-amber-100': 'rgb(249, 242, 228)',
  '--dsw-static-amber-400': 'rgb(226, 181, 99)',
  '--dsw-static-amber-500': 'rgb(214, 160, 74)',
  '--dsw-static-amber-600': 'rgb(181, 126, 48)',
  '--dsw-static-amber-900': 'rgb(48, 37, 20)',
}

/** The palette shaped for the two-mode override layer. */
export const PALETTE_LAYER: ThemeTokenOverrides = Object.fromEntries(
  Object.entries(PALETTE).map(([name, value]) => [name, { light: value, dark: value }]),
)

/** Required services: the UI slot registry and the theme runtime. */
export const inject = ['slots', 'theme']

/**
 * Fill the sidebar and hero brand slots as one declaration-aware registration
 * set and mount the brand palette layer.
 * @param ctx - Client root context.
 */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.theme.overrideTokens(PALETTE_SOURCE, PALETTE_LAYER), 'ui-brand-curupira: palette')
  ctx.slots.inject('sidebar.brand.mark', () =>
    ctx.slots.inject('sidebar.brand.name', function* () {
      yield ctx.slots.register({ name: 'sidebar.brand.mark' }, CurupiraBrandMark)
      yield ctx.slots.register({ name: 'sidebar.brand.name' }, CurupiraBrandName)
    }))
  ctx.slots.inject('conversation.hero.brand.mark', () =>
    ctx.slots.register({ name: 'conversation.hero.brand.mark' }, CurupiraBrandMark))
}
