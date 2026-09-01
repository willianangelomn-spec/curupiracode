/** Package-owned invariant companion for `@deepseek-ai/dsh-knowledge-extract-text`. */

/* jscpd:ignore-start */
import type { Context } from '@deepseek-ai/cordis'
import type { InvariantInstaller } from '@deepseek-ai/dsh-invariants'

const PACKAGE_NAME = '@deepseek-ai/dsh-knowledge-extract-text'

/** Cordis companion plugin name. */
export const name = 'knowledge-extract-text-invariant'
/** Service required before package ownership can be reserved. */
export const inject = ['invariants']

/** No runtime invariant: extraction is stateless; the knowledge seam owns its registry invariants. */
const install: InvariantInstaller = () => {}

/** Register this package's invariant companion. */
export const apply = (ctx: Context): Promise<() => void> =>
  Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install))
/* jscpd:ignore-end */
