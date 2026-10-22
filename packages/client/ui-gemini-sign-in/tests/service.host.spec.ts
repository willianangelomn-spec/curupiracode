/** The Remote walks agy from signed-out to signed-in and validates pasted codes. */
import { Context } from '@deepseek-ai/cordis'
import { RemoteError } from '@deepseek-ai/dsh-typert-protocol'
import { afterEach, describe, expect, it, vi } from 'vitest'
import GeminiSignInService from '../src/index.ts'
import { FAKE_URL, GOOD_CODE, installFakeAgy, type FakeAgy } from './fake-agy.ts'

const cleanups: Array<() => Promise<void>> = []
afterEach(async () => {
  vi.unstubAllEnvs()
  for (const cleanup of cleanups.splice(0).reverse()) await cleanup()
})

async function fixture(binary?: string): Promise<{ ctx: Context; service: GeminiSignInService; agy: FakeAgy }> {
  const agy = await installFakeAgy()
  cleanups.push(agy.dispose)
  vi.stubEnv('GEMINI_AGY_BINARY', binary ?? agy.binary)
  const ctx = new Context()
  const fiber = ctx.plugin(GeminiSignInService)
  await fiber.await()
  cleanups.push(() => fiber.dispose())
  return { ctx, service: ctx.get('geminiSignIn') as GeminiSignInService, agy }
}

const live = (): AbortSignal => new AbortController().signal

describe.skipIf(process.platform === 'win32')('Gemini sign-in Remote', () => {
  it('signs agy in with the pasted code', async () => {
    const { service } = await fixture()
    expect(await service.status(live())).toEqual({ state: 'signed-out' })
    expect(await service.begin(live())).toEqual({ state: 'pending', url: FAKE_URL })
    expect(await service.status(live())).toEqual({ state: 'pending', url: FAKE_URL })
    expect(await service.complete(`  ${GOOD_CODE}\n`)).toEqual({ state: 'signed-in' })
    expect(await service.status(live())).toEqual({ state: 'signed-in' })
  })

  it('reports a refused code and starts over with a fresh sign-in', async () => {
    const { service } = await fixture()
    await service.begin(live())
    expect(await service.complete('wrong')).toEqual({
      state: 'signed-out', failure: 'Authentication failed: oauth2: "invalid_grant" "Bad Request"',
    })
    expect(await service.complete(GOOD_CODE)).toEqual({ state: 'signed-out', failure: 'no sign-in is waiting for a code; start again' })
    await service.begin(live())
    expect(await service.complete(GOOD_CODE)).toEqual({ state: 'signed-in' })
  })

  it('rejects an empty or multi-line code before reaching agy', async () => {
    const { service } = await fixture()
    await service.begin(live())
    await expect(service.complete('   ')).rejects.toBeInstanceOf(RemoteError)
    await expect(service.complete('a\nb')).rejects.toBeInstanceOf(RemoteError)
    expect(await service.status(live())).toEqual({ state: 'pending', url: FAKE_URL })
  })

  it('reports a missing CLI', async () => {
    const { service } = await fixture('/nonexistent/agy')
    expect(await service.status(live())).toEqual({ state: 'cli-missing' })
    expect(await service.begin(live())).toEqual({ state: 'cli-missing' })
  })

  it('stops the waiting sign-in on cancel and on unload', async () => {
    const { service, ctx } = await fixture()
    await service.begin(live())
    await service.cancel()
    expect(await service.status(live())).toEqual({ state: 'signed-out' })
    await service.begin(live())
    await ctx.fiber.dispose()
    expect(await service.status(live())).toEqual({ state: 'signed-out' })
  })
})
