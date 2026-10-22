/** agy's check and login actions, driven against a shell stand-in. */
import { access, readFile } from 'node:fs/promises'
import { afterEach, describe, expect, it } from 'vitest'
import { AgyLogin, AgyMissingError, agySignedIn } from '../src/agy-auth.ts'
import { FAKE_URL, GOOD_CODE, installFakeAgy, type FakeAgy } from './fake-agy.ts'

const installs: FakeAgy[] = []
afterEach(async () => { await Promise.all(installs.splice(0).map(install => install.dispose())) })

async function fake(variant?: 'normal' | 'early-exit'): Promise<FakeAgy> {
  const install = await installFakeAgy(variant)
  installs.push(install)
  return install
}

const live = (): AbortSignal => new AbortController().signal

describe.skipIf(process.platform === 'win32')('agy authentication actions', () => {
  it('reports a missing executable as AgyMissingError', async () => {
    await expect(agySignedIn('/nonexistent/agy', live())).rejects.toBeInstanceOf(AgyMissingError)
    await expect(AgyLogin.start('/nonexistent/agy', live())).rejects.toBeInstanceOf(AgyMissingError)
  })

  it('reads the URL without colors, stores the sign-in for an accepted code, and runs in a removed private directory', async () => {
    const agy = await fake()
    expect(await agySignedIn(agy.binary, live())).toBe(false)
    const login = await AgyLogin.start(agy.binary, live())
    expect(login.url).toBe(FAKE_URL)
    expect(login.waiting).toBe(true)
    expect(await login.submit(GOOD_CODE)).toEqual({ ok: true })
    expect(login.waiting).toBe(false)
    expect(await agySignedIn(agy.binary, live())).toBe(true)
    const cwd = (await readFile(agy.loginCwdFile, 'utf8')).trim()
    expect(cwd).toContain('dsh-gemini-auth-')
    await expect(access(cwd)).rejects.toThrow()
  })

  it('returns agy\'s reason when the code is refused', async () => {
    const agy = await fake()
    const login = await AgyLogin.start(agy.binary, live())
    expect(await login.submit('wrong')).toEqual({
      ok: false, message: 'Authentication failed: oauth2: "invalid_grant" "Bad Request"',
    })
    expect(await agySignedIn(agy.binary, live())).toBe(false)
  })

  it('stops a waiting login on cancel and refuses a later code', async () => {
    const agy = await fake()
    const login = await AgyLogin.start(agy.binary, live())
    await login.cancel()
    expect(login.waiting).toBe(false)
    expect((await login.submit(GOOD_CODE)).ok).toBe(false)
    expect(await agySignedIn(agy.binary, live())).toBe(false)
  })

  it('fails with agy\'s last line when it exits before printing a URL', async () => {
    const agy = await fake('early-exit')
    await expect(AgyLogin.start(agy.binary, live())).rejects.toThrow('Error: keyring unavailable')
  })

  it('stops starting when the caller aborts', async () => {
    const agy = await fake()
    const controller = new AbortController()
    controller.abort(new Error('caller left'))
    await expect(AgyLogin.start(agy.binary, controller.signal)).rejects.toThrow('caller left')
  })
})
