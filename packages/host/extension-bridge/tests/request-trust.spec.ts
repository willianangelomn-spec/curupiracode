import { describe, expect, it } from 'vitest'
import { admitExtensionRequest, assertExtensionOrigin, isLoopbackAuthority } from '../src/request-trust.ts'

const ORIGIN = 'chrome-extension://ndfighammhdpfaejmadojjaaelmpadek'
const TOKEN = 'a'.repeat(43)
const pairings = { verify: (origin: string, token: string) => origin === ORIGIN && token === TOKEN }

describe('extension request admission', () => {
  it('accepts exactly a chrome-extension origin with a 32-letter a-p id', () => {
    expect(() => { assertExtensionOrigin(ORIGIN) }).not.toThrow()
    for (const entry of [
      'chrome-extension://NDFIGHAMMHDPFAEJMADOJJAAELMPADEK',
      `${ORIGIN}/`,
      'chrome-extension://ndfighammhdpfaejmadojjaaelmpade',
      'moz-extension://ndfighammhdpfaejmadojjaaelmpadek',
      'https://example.com',
    ]) {
      expect(() => { assertExtensionOrigin(entry) }).toThrow(/not a chrome-extension:\/\/<id> origin/)
    }
  })

  it('treats localhost, IPv6 loopback, and 127/8 on any port as loopback', () => {
    for (const host of ['localhost', 'localhost:3080', '127.0.0.1:3080', '127.9.8.7', '[::1]:3080']) {
      expect(isLoopbackAuthority(host)).toBe(true)
    }
    for (const host of ['example.com', 'localhost.example.com', '127.0.0.1.example.com', '192.168.1.2:3080', '[::2]', 'bad host']) {
      expect(isLoopbackAuthority(host)).toBe(false)
    }
  })

  it('refuses a foreign Host or Origin before reading the token', () => {
    const allowed = new Set([ORIGIN])
    const authorization = `Bearer ${TOKEN}`
    expect(admitExtensionRequest({ host: '127.0.0.1:3080', origin: ORIGIN, authorization }, allowed, pairings)).toEqual({ origin: ORIGIN })
    expect(admitExtensionRequest({ origin: ORIGIN, authorization }, allowed, pairings)).toEqual({ rejection: 403 })
    expect(admitExtensionRequest({ host: 'evil.example:3080', origin: ORIGIN, authorization }, allowed, pairings)).toEqual({ rejection: 403 })
    expect(admitExtensionRequest({ host: '127.0.0.1:3080', authorization }, allowed, pairings)).toEqual({ rejection: 403 })
    expect(admitExtensionRequest({ host: '127.0.0.1:3080', origin: 'http://127.0.0.1:3080', authorization }, allowed, pairings)).toEqual({ rejection: 403 })
    expect(admitExtensionRequest({ host: '127.0.0.1:3080', origin: 'chrome-extension://aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', authorization }, allowed, pairings)).toEqual({ rejection: 403 })
  })

  it('answers 401 for a missing, malformed, or unpaired bearer token', () => {
    const allowed = new Set([ORIGIN])
    const base = { host: 'localhost:3080', origin: ORIGIN }
    expect(admitExtensionRequest(base, allowed, pairings)).toEqual({ rejection: 401 })
    expect(admitExtensionRequest({ ...base, authorization: TOKEN }, allowed, pairings)).toEqual({ rejection: 401 })
    expect(admitExtensionRequest({ ...base, authorization: `Basic ${TOKEN}` }, allowed, pairings)).toEqual({ rejection: 401 })
    expect(admitExtensionRequest({ ...base, authorization: `Bearer ${'b'.repeat(43)}` }, allowed, pairings)).toEqual({ rejection: 401 })
    expect(admitExtensionRequest({ ...base, authorization: `Bearer ${TOKEN}` }, allowed, pairings)).toEqual({ origin: ORIGIN })
  })
})
