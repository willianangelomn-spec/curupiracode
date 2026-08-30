/**
 * authorization domain contract: the web face of the authorization seam
 * (`ctx.authorization`). A provider that ships a login registers a flow under the
 * credential key that flow writes; this surface lists those flows, lets the browser
 * start one, and lets it cancel an attempt.
 *
 * The interaction travelling with `begin` is deliberately light for this build:
 * the flow's first notice is returned (for the sign-in URL) rather than streamed,
 * so a control in the Models page can hand the human the link, and completion is
 * observed by re-listing the flow's `configured` bit. Prompts are not surfaced
 * yet — a flow that asks one fails closed rather than hanging the browser.
 */

import type { RpcRequest, RpcResponse } from './rpc.ts'

/** Wire view of one login method a flow offers. */
export interface AuthorizationMethodView {
  /** Method id (`oauth`, `api-key`, …). */
  id: string
  /** Human-readable sign-in verb for the control. */
  label: string
}

/** Wire view of one authorization flow, for a control listing what can be signed into. */
export interface AuthorizationEntryView {
  /** The credential record this flow writes; also the handle `begin`/`cancel` take. */
  key: string
  /** User-facing name of what is being authorized. */
  label: string
  /** The methods offered, most preferred first. */
  methods: AuthorizationMethodView[]
  /** Whether the flow's credential record is currently present (signed in). */
  configured: boolean
  /** Whether an attempt for this key is currently in flight. */
  inFlight: boolean
}

/** The begun attempt's immediate report: the sign-in link, when the flow surfaces one. */
export interface AuthorizationBeginView {
  /** `started` means the flow began and is waiting on the human; an outcome means it already settled. */
  status: 'started' | 'authorized' | 'cancelled'
  /** The message the flow asked the human to see (drives the button's copy). */
  message?: string
  /** The page to open to continue signing in, when the flow offers one. */
  url?: string
}

/** Authorization-domain unary methods (the map keys authorization.* of RpcMethodMap). */
export interface AuthorizationApi {
  /**
   * List every registered authorization flow, in registration order, with the
   * flow's configured state. A surface renders one method per flow as a sign-in
   * button.
   */
  list(request: RpcRequest<{}>): Promise<RpcResponse<{ flows: AuthorizationEntryView[] }>>

  /**
   * Start one authorization attempt. The flow runs in the background; the
   * response carries the first notice the flow produced (usually the sign-in
   * URL) so the browser can hand it to the human. The attempt settles when the
   * human finishes the handshake, and the flow's credential is committed through
   * the credentials seam — detect it by re-listing (`configured` flips true).
   * @throws `no-auth-flow` for an unregistered key, `unknown-auth-method` for a
   *   method the flow does not offer.
   */
  begin(request: RpcRequest<{ key: string; method: string }>): Promise<RpcResponse<AuthorizationBeginView>>

  /**
   * Withdraw the in-flight attempt for a key, if any. Idempotent: cancelling an
   * absent attempt succeeds.
   */
  cancel(request: RpcRequest<{ key: string }>): Promise<RpcResponse<{}>>
}
