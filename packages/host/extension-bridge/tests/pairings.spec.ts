import { createHash } from 'node:crypto'
import { Context } from '@deepseek-ai/cordis'
import { credentialKey, type CredentialRecord } from '@deepseek-ai/dsh-credentials'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MemoryCredentials } from '../../../credentials/credentials/tests/memory.ts'
import { PAIRINGS_RECORD_KEY, PairingStore } from '../src/pairings.ts'

const ORIGIN = 'chrome-extension://ndfighammhdpfaejmadojjaaelmpadek'
const OTHER = 'chrome-extension://aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'

const roots: Context[] = []
afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => root.fiber.dispose()))
})

async function harness(): Promise<{ readonly ctx: Context; readonly credentials: MemoryCredentials }> {
  const root = new Context()
  roots.push(root)
  await root.plugin(MemoryCredentials)
  return { ctx: root, credentials: root.credentials as MemoryCredentials }
}

async function seed(credentials: MemoryCredentials, record: CredentialRecord): Promise<void> {
  await credentials.modifyRecord(PAIRINGS_RECORD_KEY, () => Promise.resolve(record))
}

describe('extension pairing store', () => {
  it('starts unpaired and verifies an issued token only for its origin', async () => {
    const { ctx, credentials } = await harness()
    const store = await PairingStore.create(ctx, credentials)
    expect(store.get(ORIGIN)).toBeUndefined()
    const token = await store.pair(ORIGIN)
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/u)
    expect(store.verify(ORIGIN, token)).toBe(true)
    expect(store.verify(OTHER, token)).toBe(false)
    expect(store.verify(ORIGIN, `${token}x`)).toBe(false)
    expect(store.verify(ORIGIN, 'x'.repeat(43))).toBe(false)
    expect(store.get(ORIGIN)?.pairedAt).toBeTypeOf('number')
  })

  it('stores only the token digest and reloads it in a new activation', async () => {
    const { ctx, credentials } = await harness()
    const token = await (await PairingStore.create(ctx, credentials)).pair(ORIGIN)
    const record = await credentials.readRecord(PAIRINGS_RECORD_KEY)
    expect(JSON.stringify(record)).not.toContain(token)
    expect(record).toMatchObject({ kind: 'grant', payload: { version: 1, pairings: [{ origin: ORIGIN }] } })
    const reloaded = await PairingStore.create(ctx, credentials)
    expect(reloaded.verify(ORIGIN, token)).toBe(true)
  })

  it('rotates on re-approval and stops verifying after revocation', async () => {
    const { ctx, credentials } = await harness()
    const store = await PairingStore.create(ctx, credentials)
    const first = await store.pair(ORIGIN)
    const kept = await store.pair(OTHER)
    const second = await store.pair(ORIGIN)
    expect(store.verify(ORIGIN, first)).toBe(false)
    expect(store.verify(ORIGIN, second)).toBe(true)
    await store.revoke(ORIGIN)
    expect(store.verify(ORIGIN, second)).toBe(false)
    expect(store.verify(OTHER, kept)).toBe(true)
    await store.revoke(ORIGIN)
    expect(store.get(ORIGIN)).toBeUndefined()
  })

  it('fails activation on a record it cannot read', async () => {
    const { ctx, credentials } = await harness()
    await seed(credentials, { kind: 'api-key', key: 'nope' })
    await expect(PairingStore.create(ctx, credentials)).rejects.toThrow(/not a grant record/)
    await seed(credentials, { kind: 'grant', payload: { version: 2, pairings: [] } })
    await expect(PairingStore.create(ctx, credentials)).rejects.toThrow(/malformed/)
  })

  it('applies an external revocation and fails closed on an external malformed write', async () => {
    const { ctx, credentials } = await harness()
    const store = await PairingStore.create(ctx, credentials)
    const token = await store.pair(ORIGIN)
    const error = vi.spyOn(ctx.logger, 'error').mockImplementation(() => {})
    await credentials.deleteRecord(PAIRINGS_RECORD_KEY)
    await vi.waitFor(() => { expect(store.verify(ORIGIN, token)).toBe(false) })

    const again = await store.pair(ORIGIN)
    await seed(credentials, { kind: 'grant', payload: { version: 1, pairings: 'broken' } })
    await vi.waitFor(() => { expect(store.verify(ORIGIN, again)).toBe(false) })
    expect(error).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringMatching(/malformed/) as string }))
  })

  it('fails closed when an external change cannot be read, and ignores other records', async () => {
    const { ctx, credentials } = await harness()
    const token = 'k'.repeat(43)
    const tokenSha256 = createHash('sha256').update(token).digest('hex')
    await seed(credentials, { kind: 'grant', payload: { version: 1, pairings: [{ origin: ORIGIN, tokenSha256, pairedAt: 1 }] } })
    const store = await PairingStore.create(ctx, credentials)
    expect(store.verify(ORIGIN, token)).toBe(true)
    const read = vi.spyOn(credentials, 'readRecord')
    ctx.emit('credentials/record-updated', credentialKey('other-plugin', 'record'))
    await new Promise(resolve => setTimeout(resolve, 10))
    expect(read).not.toHaveBeenCalled()
    const error = vi.spyOn(ctx.logger, 'error').mockImplementation(() => {})
    read.mockRejectedValueOnce(new Error('disk gone'))
    ctx.emit('credentials/record-updated', PAIRINGS_RECORD_KEY)
    await vi.waitFor(() => { expect(store.verify(ORIGIN, token)).toBe(false) })
    expect(error).toHaveBeenCalledWith(expect.objectContaining({ message: 'disk gone' }))
  })

  it('reports a failed write to its caller and keeps later writes ordered', async () => {
    const { ctx, credentials } = await harness()
    const store = await PairingStore.create(ctx, credentials)
    vi.spyOn(credentials, 'modifyRecord').mockRejectedValueOnce(new Error('locked'))
    await expect(store.pair(ORIGIN)).rejects.toThrow('locked')
    const token = await store.pair(ORIGIN)
    expect(store.verify(ORIGIN, token)).toBe(true)
  })

  it('waits for an admitted write before its context finishes disposing', async () => {
    const { ctx, credentials } = await harness()
    const child = ctx.extend()
    let release!: () => void
    const gate = new Promise<void>((resolve) => { release = resolve })
    const fiber = child.plugin({
      name: 'pairing-owner',
      async apply(owner: Context) {
        const store = await PairingStore.create(owner, credentials)
        const modify = credentials.modifyRecord.bind(credentials)
        vi.spyOn(credentials, 'modifyRecord').mockImplementationOnce(async (key, mutate) => {
          await gate
          return modify(key, mutate)
        })
        void store.pair(ORIGIN)
      },
    })
    await fiber
    let disposed = false
    const disposing = fiber.dispose().then(() => { disposed = true })
    await new Promise(resolve => setTimeout(resolve, 10))
    expect(disposed).toBe(false)
    release()
    await disposing
    expect((await credentials.readRecord(PAIRINGS_RECORD_KEY))?.kind).toBe('grant')
  })
})
