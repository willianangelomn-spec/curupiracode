/** Package-owned invariant companion for `@deepseek-ai/dsh-knowledge-local`. */

/* jscpd:ignore-start */
import type { Context } from '@deepseek-ai/cordis'
import type { InvariantInstaller } from '@deepseek-ai/dsh-invariants'

const PACKAGE_NAME = '@deepseek-ai/dsh-knowledge-local'

/** Cordis companion plugin name. */
export const name = 'knowledge-local-invariant'
/** Service required before package ownership can be reserved. */
export const inject = ['invariants']

/** No runtime invariant: SQLite and vector-index consistency is enforced inside the local store. */
const install: InvariantInstaller = () => {}

/** Register this package's invariant companion. */
export const apply = (ctx: Context): Promise<() => void> =>
  Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install))
/* jscpd:ignore-end */
