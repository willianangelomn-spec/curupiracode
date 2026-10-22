/** Google sign-in for the Antigravity CLI, rendered inside the Gemini provider card. */
import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { Button, Input, StateDot } from '@deepseek-ai/dsh-client-ui-primitives'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { RemoteResult } from '@deepseek-ai/dsh-typert-protocol'
import type { GeminiSignInStatus } from '../types.ts'
import type { NS } from './locales.ts'
import css from './GeminiSignIn.module.css'

/** Official installer command for the Antigravity CLI on macOS and Linux. */
export const AGY_INSTALL_COMMAND = 'curl -fsSL https://antigravity.google/cli/install.sh | bash'

/** Remote calls the card makes; each resolves to a Remote result and never rejects for a carrier failure. */
export interface GeminiSignInInjected {
  /** Read the current sign-in state. */
  status: (signal: AbortSignal) => Promise<RemoteResult<GeminiSignInStatus>>
  /** Start a sign-in and receive the Google URL. */
  begin: () => Promise<RemoteResult<GeminiSignInStatus>>
  /** Hand the pasted authorization code to the waiting sign-in. */
  complete: (code: string) => Promise<RemoteResult<GeminiSignInStatus>>
  /** Abandon the waiting sign-in. */
  cancel: () => Promise<RemoteResult<void>>
}

/** Composed props of the provider-card occupant. */
export type GeminiSignInProps = PropsRuntime<'settings.models.provider-card'> & PropsLocale<typeof NS> & InjectFace<GeminiSignInInjected>

type View =
  | { readonly kind: 'loading' }
  | { readonly kind: 'status'; readonly status: GeminiSignInStatus }
  | { readonly kind: 'failed'; readonly message: string }

/**
 * Show whether agy is signed in and walk the human through Google's code-paste sign-in.
 * @param props - card owner props, locale reader, and the sign-in Remote calls.
 * @returns the sign-in area of the Gemini provider card.
 */
export function GeminiSignIn(props: GeminiSignInProps) {
  const { t, status, begin, complete, cancel } = props
  const [view, setView] = useState<View>({ kind: 'loading' })
  const [busy, setBusy] = useState(false)
  const [code, setCode] = useState('')
  const codeId = useId()
  const mounted = useRef(true)
  useEffect(() => () => { mounted.current = false }, [])

  const settle = useCallback((result: RemoteResult<GeminiSignInStatus>) => {
    if (!mounted.current) return
    setView(result.ok ? { kind: 'status', status: result.value } : { kind: 'failed', message: result.error.message })
  }, [])

  const refresh = useCallback(async (signal: AbortSignal) => {
    setView({ kind: 'loading' })
    const result = await status(signal)
    if (!signal.aborted) settle(result)
  }, [status, settle])

  useEffect(() => {
    const lifetime = new AbortController()
    void refresh(lifetime.signal)
    return () => { lifetime.abort() }
  }, [refresh])

  const run = useCallback(async (call: () => Promise<RemoteResult<GeminiSignInStatus>>) => {
    setBusy(true)
    try {
      settle(await call())
    } finally {
      if (mounted.current) setBusy(false)
    }
  }, [settle])

  const recheck = <Button size="sm" disabled={busy} onClick={() => { void refresh(new AbortController().signal) }}>{t('recheck')}</Button>

  if (view.kind === 'loading') return <p className={css.notice} role="status">{t('checking')}</p>
  if (view.kind === 'failed') {
    return <div className={css.area}>
      <p className={css.error} role="alert">{t('unavailable', { reason: view.message })}</p>
      <div className={css.actions}>{recheck}</div>
    </div>
  }
  const current = view.status
  switch (current.state) {
    case 'signed-in':
      return <div className={css.area}>
        <p className={css.success} role="status"><StateDot state="done" />{t('signedIn')}</p>
        <div className={css.actions}>{recheck}</div>
      </div>
    case 'cli-missing':
      return <div className={css.area}>
        <p className={css.notice}>{t('cliMissing')}</p>
        <code className={css.command}>{AGY_INSTALL_COMMAND}</code>
        <div className={css.actions}>{recheck}</div>
      </div>
    case 'signed-out':
      return <div className={css.area}>
        <p className={css.notice}>{t('signedOut')}</p>
        {current.failure !== undefined && <p className={css.error} role="alert">{t('refused', { reason: current.failure })}</p>}
        <div className={css.actions}>
          <Button variant="primary" size="sm" disabled={busy} onClick={() => { setCode(''); void run(begin) }}>
            {busy ? t('starting') : t('signIn')}
          </Button>
        </div>
      </div>
    case 'pending':
      return <form className={css.area} onSubmit={(event) => {
        event.preventDefault()
        if (code.trim() !== '') void run(() => complete(code))
      }}>
        <p className={css.notice}>{t('stepOpen')}</p>
        <a className={css.link} href={current.url} target="_blank" rel="noreferrer">{t('openPage')}</a>
        <label className={css.notice} htmlFor={codeId}>{t('stepPaste')}</label>
        <Input id={codeId} value={code} autoComplete="off" spellCheck={false} disabled={busy}
          aria-label={t('codeLabel')} placeholder={t('codePlaceholder')}
          onChange={(event) => { setCode(event.target.value) }} />
        <div className={css.actions}>
          <Button type="submit" variant="primary" size="sm" disabled={busy || code.trim() === ''}>
            {busy ? t('confirming') : t('confirm')}
          </Button>
          <Button size="sm" disabled={busy} onClick={() => {
            void cancel().then(() => refresh(new AbortController().signal))
          }}>{t('cancel')}</Button>
        </div>
      </form>
  }
}
