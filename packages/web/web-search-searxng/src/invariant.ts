/**
 * Package-owned invariant companion for `@deepseek-ai/dsh-web-search-searxng`.
 * @module @deepseek-ai/dsh-web-search-searxng/invariant
 */

/* jscpd:ignore-start */
import type { Context } from '@deepseek-ai/cordis'
import type { InvariantInstaller } from '@deepseek-ai/dsh-invariants'

const PACKAGE_NAME = '@deepseek-ai/dsh-web-search-searxng'

/** Cordis companion plugin name. */
export const name = 'web-search-searxng-invariant'
/** Service required before the companion can reserve package ownership. */
export const inject = ['invariants']

/** No runtime invariant: the provider is a stateless HTTP adapter. */
const install: InvariantInstaller = () => {}

/** Register this package's invariant companion. */
export const apply = (ctx: Context): Promise<() => void> =>
  Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install))
/* jscpd:ignore-end */
