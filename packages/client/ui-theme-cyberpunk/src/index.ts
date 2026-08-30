/**
 * Curupira Forest theme bundle, node half. The empty apply exists so the
 * plugin row appears in the host cordis.yml / Loader tree; the browser half
 * owns everything visual through exports["./client"], discovered from the
 * package.json dsh.client declaration. Nothing here touches Host state: the
 * theme itself lives in @deepseek-ai/dsh-client-ui-theme's registry, which
 * the client half consumes as an ordinary service.
 */

/** Host plugin body — no host-side behavior for this theme bundle. */
export function apply(): void {}
