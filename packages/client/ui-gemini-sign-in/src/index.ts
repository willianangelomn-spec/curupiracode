/**
 * Host half of the Gemini sign-in card: a Remote that drives the Antigravity
 * CLI's own Google sign-in, so the Web client can sign agy in without a
 * terminal. agy stores the sign-in where `agy -p` reads it, which is the
 * transport `@deepseek-ai/dsh-llm-gemini` serves Gemini through.
 */

import { Context, Service } from '@deepseek-ai/cordis'
import { Remote, RemoteError, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'
import { AgyLogin, AgyMissingError, agyBinary, agySignedIn, MAX_AUTHORIZATION_CODE_LENGTH } from './agy-auth.ts'
import type { GeminiSignInStatus } from './types.ts'

export type { GeminiSignInStatus } from './types.ts'

declare module '@deepseek-ai/cordis' {
  interface Context {
    /** Antigravity CLI sign-in driven from the Web client. */
    geminiSignIn: GeminiSignInService
  }
}

/** One agy sign-in at a time for the whole Host; the account belongs to the machine, not to a page. */
export default class GeminiSignInService extends TypertRemoteService {
  private login: AgyLogin | undefined

  /**
   * @param ctx - owning Host context.
   */
  constructor(ctx: Context) {
    super(ctx, 'geminiSignIn', { namespace: 'geminiSignIn' })
  }

  protected [Service.init](): void {
    this.ctx.effect(() => async () => {
      await this.login?.cancel()
      this.login = undefined
    }, 'gemini-sign-in: running agy login')
  }

  /**
   * Read whether agy holds a Google sign-in, or the URL of the sign-in in progress.
   * @param signal - Remote call cancellation; aborting stops the check.
   * @returns the current sign-in state.
   */
  @Remote
  async status(signal: AbortSignal): Promise<GeminiSignInStatus> {
    if (this.login?.waiting === true) return { state: 'pending', url: this.login.url }
    try {
      return { state: await agySignedIn(agyBinary(), signal) ? 'signed-in' : 'signed-out' }
    } catch (error) {
      if (error instanceof AgyMissingError) return { state: 'cli-missing' }
      throw error
    }
  }

  /**
   * Start a fresh agy sign-in, replacing one still waiting for its code.
   * @param signal - Remote call cancellation; aborting stops agy before it prints a URL.
   * @returns `pending` with the Google authorization URL, or `cli-missing`.
   */
  @Remote
  async begin(signal: AbortSignal): Promise<GeminiSignInStatus> {
    await this.login?.cancel()
    this.login = undefined
    try {
      this.login = await AgyLogin.start(agyBinary(), signal)
    } catch (error) {
      if (error instanceof AgyMissingError) return { state: 'cli-missing' }
      throw error
    }
    return { state: 'pending', url: this.login.url }
  }

  /**
   * Hand the code Google showed to the waiting agy sign-in.
   * @param code - authorization code pasted by the human.
   * @returns `signed-in` when agy stored the sign-in; otherwise `signed-out` with agy's reason.
   * @throws {RemoteError} `gateway/bad-request` for an empty, multi-line, or oversized code.
   */
  @Remote
  async complete(code: string): Promise<GeminiSignInStatus> {
    const trimmed = code.trim()
    if (trimmed === '' || /[\r\n]/u.test(trimmed) || trimmed.length > MAX_AUTHORIZATION_CODE_LENGTH) {
      throw new RemoteError('gateway/bad-request', 'the authorization code must be one non-empty line', {})
    }
    const login = this.login
    if (login?.waiting !== true) return { state: 'signed-out', failure: 'no sign-in is waiting for a code; start again' }
    const outcome = await login.submit(trimmed)
    if (this.login === login) this.login = undefined
    return outcome.ok ? { state: 'signed-in' } : { state: 'signed-out', failure: outcome.message }
  }

  /**
   * Abandon the sign-in waiting for a code.
   * @returns after agy exited.
   */
  @Remote
  async cancel(): Promise<void> {
    const login = this.login
    this.login = undefined
    await login?.cancel()
  }
}
