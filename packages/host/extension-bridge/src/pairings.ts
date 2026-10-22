/**
 * Durable extension pairings: one bearer token per allowed extension origin,
 * persisted as SHA-256 digests in one credential grant record.
 */

import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import type { Context } from '@deepseek-ai/cordis'
import { brandString } from '@deepseek-ai/dsh-brand'
import { credentialKey } from '@deepseek-ai/dsh-credentials'
import type { CredentialProvider, CredentialRecord } from '@deepseek-ai/dsh-credentials'
import { z } from 'zod'
import type { ExtensionPairingToken } from './types.ts'

/** Credential record holding every pairing of this plugin. */
export const PAIRINGS_RECORD_KEY = credentialKey('host-extension-bridge', 'pairings')

const STORED_VERSION = 1
const TOKEN_BYTES = 32
/** Base64url text of {@link TOKEN_BYTES} random bytes. */
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/
const DIGEST_PATTERN = /^[0-9a-f]{64}$/

const storedPayloadSchema = z.object({
  version: z.literal(STORED_VERSION),
  pairings: z.array(z.object({
    origin: z.string().min(1),
    tokenSha256: z.string().regex(DIGEST_PATTERN),
    pairedAt: z.number().int().nonnegative(),
  }).strict()),
}).strict()

/** One approved extension origin. */
export interface Pairing {
  readonly origin: string
  /** Hex SHA-256 of the issued token. */
  readonly tokenSha256: string
  /** Unix epoch milliseconds of the approval. */
  readonly pairedAt: number
}

type StoredPayload = z.infer<typeof storedPayloadSchema>

function digest(token: string): Buffer {
  return createHash('sha256').update(token, 'utf8').digest()
}

function parseRecord(record: CredentialRecord | undefined): ReadonlyMap<string, Pairing> {
  if (record === undefined) return new Map()
  if (record.kind !== 'grant') {
    throw new Error('host-extension-bridge: the pairings credential record is not a grant record')
  }
  const parsed = storedPayloadSchema.safeParse(record.payload)
  if (!parsed.success) {
    throw new Error(`host-extension-bridge: the pairings credential record is malformed: ${parsed.error.message}`)
  }
  return new Map(parsed.data.pairings.map(pairing => [pairing.origin, pairing]))
}

function recordOf(pairings: ReadonlyMap<string, Pairing>): CredentialRecord {
  const payload: StoredPayload = { version: STORED_VERSION, pairings: [...pairings.values()] }
  return { kind: 'grant', payload }
}

/**
 * In-memory view of the pairings record. Verification is synchronous against
 * the view; every change commits through `modifyRecord` before the view
 * changes, and a `credentials/record-updated` notice for the record reloads it,
 * so a revocation written by another process applies here once read.
 * Loads and writes run one at a time in arrival order, so an older read never
 * replaces a newer one.
 */
export class PairingStore {
  private pairings: ReadonlyMap<string, Pairing>
  private tail: Promise<void> = Promise.resolve()

  private constructor(
    private readonly ctx: Context,
    private readonly credentials: CredentialProvider,
    initial: ReadonlyMap<string, Pairing>,
  ) {
    this.pairings = initial
    ctx.on('credentials/record-updated', (key) => {
      if (key !== PAIRINGS_RECORD_KEY) return
      void this.serialize(() => this.reload())
    })
    // Teardown waits for an admitted write so its committed record is never orphaned mid-update.
    ctx.effect(() => () => this.tail, 'host-extension-bridge: pairing writes')
  }

  /**
   * Load the stored pairings; a malformed record fails plugin activation.
   * @param ctx - plugin context owning the reload listener.
   * @param credentials - persistent credential provider holding the record.
   * @returns the loaded store.
   */
  static async create(ctx: Context, credentials: CredentialProvider): Promise<PairingStore> {
    return new PairingStore(ctx, credentials, parseRecord(await credentials.readRecord(PAIRINGS_RECORD_KEY)))
  }

  /**
   * Read one origin's pairing.
   * @param origin - exact extension origin.
   * @returns the pairing, or undefined while the origin is unpaired.
   */
  get(origin: string): Pairing | undefined {
    return this.pairings.get(origin)
  }

  /**
   * Check a presented bearer token against the origin's pairing in constant time.
   * @param origin - exact extension origin the request came from.
   * @param token - bearer text from the Authorization header.
   * @returns true only when the token was issued to this origin and not revoked.
   */
  verify(origin: string, token: string): boolean {
    const pairing = this.pairings.get(origin)
    if (pairing === undefined || !TOKEN_PATTERN.test(token)) return false
    return timingSafeEqual(Buffer.from(pairing.tokenSha256, 'hex'), digest(token))
  }

  /**
   * Issue a new token for the origin, replacing and revoking its previous one.
   * @param origin - allowed extension origin the user approved.
   * @returns the token, which exists nowhere else once this response is sent.
   */
  pair(origin: string): Promise<ExtensionPairingToken> {
    return this.serialize(async () => {
      const token = brandString<ExtensionPairingToken>(randomBytes(TOKEN_BYTES).toString('base64url'))
      const pairing: Pairing = { origin, tokenSha256: digest(token).toString('hex'), pairedAt: Date.now() }
      await this.write(current => new Map([...current, [origin, pairing]]))
      return token
    })
  }

  /**
   * Remove the origin's pairing; its token stops verifying once the write commits.
   * @param origin - extension origin to revoke; an unpaired origin is a no-op.
   */
  revoke(origin: string): Promise<void> {
    return this.serialize(() => this.write((current) => {
      const next = new Map(current)
      next.delete(origin)
      return next
    }))
  }

  private async write(change: (current: ReadonlyMap<string, Pairing>) => ReadonlyMap<string, Pairing>): Promise<void> {
    const record = await this.credentials.modifyRecord(PAIRINGS_RECORD_KEY,
      current => Promise.resolve(recordOf(change(parseRecord(current)))))
    this.pairings = parseRecord(record)
  }

  /** An unreadable or malformed record fails closed: every pairing in this process stops verifying. */
  private async reload(): Promise<void> {
    try {
      this.pairings = parseRecord(await this.credentials.readRecord(PAIRINGS_RECORD_KEY))
    } catch (error) {
      this.pairings = new Map()
      this.ctx.logger.error(error)
    }
  }

  private serialize<T>(task: () => Promise<T>): Promise<T> {
    const run = this.tail.then(task)
    // Swallows `run`'s failure on the ordering chain only; the caller awaiting `run` receives it.
    this.tail = run.then(() => undefined, () => undefined)
    return run
  }
}
