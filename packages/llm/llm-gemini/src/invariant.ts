/** Package-owned invariant companion for `@deepseek-ai/dsh-llm-gemini`. */

/* jscpd:ignore-start */
import type { Context } from '@deepseek-ai/cordis'
import type { InvariantInstaller } from '@deepseek-ai/dsh-invariants'

const PACKAGE_NAME = '@deepseek-ai/dsh-llm-gemini'

/** Cordis companion plugin name. */
export const name = 'llm-gemini-invariant'
/** Service required before package ownership can be reserved. */
export const inject = ['invariants']

/** No runtime invariant: the LLM and attachment seams enforce this adapter's runtime contracts. */
const install: InvariantInstaller = () => {}

/** Register this package's invariant companion. */
export const apply = (ctx: Context): Promise<() => void> =>
  Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install))
/* jscpd:ignore-end */
