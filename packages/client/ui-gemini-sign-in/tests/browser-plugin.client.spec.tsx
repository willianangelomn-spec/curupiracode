// @vitest-environment jsdom
/** The Gemini card walks the human through agy's code-paste sign-in and leaves with its plugin. */
import { Context, Service } from '@deepseek-ai/cordis'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { SlotRegistry } from '@deepseek-ai/dsh-client-ui-renderer/client'
import { LocaleRuntime } from '@deepseek-ai/dsh-client-locale/client'
import { makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
import { RemoteError, type RemoteResult, type TypertRemoteContribution } from '@deepseek-ai/dsh-typert-protocol'
import { AGY_INSTALL_COMMAND, GeminiSignIn, type GeminiSignInInjected, type GeminiSignInProps } from '../src/client/GeminiSignIn.tsx'
import { en } from '../src/client/locales.ts'
import type { GeminiSignInStatus } from '../src/types.ts'

afterEach(() => { cleanup() })

const URL = 'https://accounts.google.com/o/oauth2/auth?client_id=fake'
const ok = (value: GeminiSignInStatus): RemoteResult<GeminiSignInStatus> => ({ ok: true, value })

function card(face: Partial<GeminiSignInInjected> & Pick<GeminiSignInInjected, 'status'>) {
  const injected: GeminiSignInInjected = {
    begin: vi.fn(async () => ok({ state: 'pending', url: URL })),
    complete: vi.fn(async () => ok({ state: 'signed-in' })),
    cancel: vi.fn(async () => ({ ok: true as const, value: undefined })),
    ...face,
  }
  const props = {
    ...injected,
    provider: { provider: 'gemini', displayName: 'Google Gemini', settingsNs: 'llm-gemini', settingsPath: [] },
    configured: true,
    keyConfigured: false,
    t: makeTranslate(en),
  } as GeminiSignInProps
  return { injected, view: render(<GeminiSignIn {...props} />) }
}

describe('Gemini sign-in card', () => {
  it('signs in with the pasted code', async () => {
    const status = vi.fn(async () => ok({ state: 'signed-out' }))
    const { injected } = card({ status })
    fireEvent.click(await screen.findByRole('button', { name: en.signIn }))
    expect((await screen.findByRole('link', { name: en.openPage })).getAttribute('href')).toBe(URL)
    fireEvent.change(screen.getByLabelText(en.codeLabel), { target: { value: '4/abc' } })
    fireEvent.click(screen.getByRole('button', { name: en.confirm }))
    expect(await screen.findByText(en.signedIn)).toBeTruthy()
    expect(injected.complete).toHaveBeenCalledWith('4/abc')
  })

  it('shows the reason agy refused the code and offers a fresh sign-in', async () => {
    const { injected } = card({
      status: vi.fn(async () => ok({ state: 'pending', url: URL })),
      complete: vi.fn(async () => ok({ state: 'signed-out', failure: 'invalid_grant' })),
    })
    fireEvent.change(await screen.findByLabelText(en.codeLabel), { target: { value: 'wrong' } })
    fireEvent.click(screen.getByRole('button', { name: en.confirm }))
    expect((await screen.findByRole('alert')).textContent).toBe('The sign-in did not complete: invalid_grant')
    expect(screen.getByRole('button', { name: en.signIn })).toBeTruthy()
    expect(injected.begin).not.toHaveBeenCalled()
  })

  it('cancels a waiting sign-in and reads the state again', async () => {
    const status = vi.fn<GeminiSignInInjected['status']>()
      .mockResolvedValueOnce(ok({ state: 'pending', url: URL }))
      .mockResolvedValue(ok({ state: 'signed-out' }))
    const { injected } = card({ status })
    fireEvent.click(await screen.findByRole('button', { name: en.cancel }))
    expect(await screen.findByRole('button', { name: en.signIn })).toBeTruthy()
    expect(injected.cancel).toHaveBeenCalledOnce()
  })

  it('names the installer when agy is missing and reports an unreadable state', async () => {
    card({ status: vi.fn(async () => ok({ state: 'cli-missing' })) })
    expect(await screen.findByText(AGY_INSTALL_COMMAND)).toBeTruthy()
    cleanup()
    card({ status: vi.fn<GeminiSignInInjected['status']>(async () => ({ ok: false, error: new RemoteError('gateway/internal', 'offline', {}) })) })
    expect((await screen.findByRole('alert')).textContent).toBe('The sign-in state could not be read: offline')
  })
})

describe('Gemini sign-in plugin', () => {
  it('fills only the Gemini card and withdraws the card before its Remote', async () => {
    const contribution: TypertRemoteContribution = { package: '@deepseek-ai/dsh-client-ui-gemini-sign-in', descriptors: [] }
    const ctx = new Context()
    const unmount = vi.fn(async () => {})
    class TestRemote extends Service {
      constructor() { super(ctx, 'remote') }
      async $mount(value: TypertRemoteContribution) { expect(value).toBe(contribution); return unmount }
    }
    new TestRemote()
    ctx.provide('remote.geminiSignIn', { status: vi.fn(), begin: vi.fn(), complete: vi.fn(), cancel: vi.fn() } as never)
    ctx.provide('locale', new LocaleRuntime(ctx))
    await ctx.plugin(SlotRegistry)
    ctx.slots.register({ name: 'root', children: { 'settings.models.provider-card': { kind: 'keyed', scope: 'root' } } } as never, () => null)
    vi.doMock('@deepseek-ai/dsh-client-ui-gemini-sign-in/remote', () => ({ default: contribution }))
    try {
      const browser = await import('../src/client/index.ts')
      const fiber = ctx.plugin({ inject: [...browser.inject], apply: browser.apply })
      await fiber
      const entries = ctx.slots.entries('settings.models.provider-card')
      expect(entries).toHaveLength(1)
      expect(entries[0]?.options).toMatchObject({ key: browser.GEMINI_SETTINGS_NS })
      expect(ctx.locale.bind('geminiSignIn')('signIn')).toBe(en.signIn)
      await fiber.dispose()
      expect(ctx.slots.entries('settings.models.provider-card')).toHaveLength(0)
      expect(unmount).toHaveBeenCalledOnce()
    } finally {
      vi.doUnmock('@deepseek-ai/dsh-client-ui-gemini-sign-in/remote')
      await ctx.fiber.dispose()
    }
  })
})
