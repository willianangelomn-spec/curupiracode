import { access, chmod, mkdir, mkdtemp, readFile, readdir, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { GenerateOptions, Message } from '@deepseek-ai/dsh-llm'
import type { ImageAttachmentRef, RequestImageAttachment } from '@deepseek-ai/dsh-attachment'
import { agyBinary, flattenPrompt, generateViaAgy, prepareAgyPrompt } from '../src/agy.ts'

const ref: ImageAttachmentRef = {
  attachmentId: 'sha256:agy-image' as ImageAttachmentRef['attachmentId'],
  mediaType: 'image/png',
  bytes: 4,
  width: 2,
  height: 2,
}

function options(): GenerateOptions {
  const message: Message = {
    id: 'user-image' as Message['id'],
    role: 'user',
    content: [
      { type: 'text', text: 'Descreva.' },
      { type: 'image', attachment: ref },
    ],
    source: { kind: 'user' },
  } as unknown as Message
  return { provider: 'gemini', model: 'gemini-3.1-pro-high', messages: [message] }
}

function image(): RequestImageAttachment {
  return {
    variantId: 'variant:agy-image' as RequestImageAttachment['variantId'],
    attachment: ref,
    data: Uint8Array.from([1, 2, 3, 4]),
    mediaType: 'image/png',
    bytes: 4,
    width: 2,
    height: 2,
    depth: 'uchar',
    space: 'srgb',
    hasAlpha: false,
  }
}

describe('Antigravity image prompt', () => {
  it('refuses to flatten an unstaged image instead of silently dropping it', () => {
    expect(() => flattenPrompt(options())).toThrow(/was not staged/)
  })

  it('stages exact bytes, references the image path, and removes the temporary directory', async () => {
    const prepared = await prepareAgyPrompt(options(), new Map([[ref.attachmentId, image()]]))
    const directory = prepared.addDirs[0] as string
    const match = prepared.prompt.match(/@([^\s]+\/image-1\.png)/)
    expect(match?.[1]).toBeDefined()
    expect(await readFile(match?.[1] as string)).toEqual(Buffer.from([1, 2, 3, 4]))
    expect(prepared.prompt).toContain('Descreva.')
    expect(prepared.workingDirectory).toBe(directory)
    await prepared.dispose()
    await expect(access(directory)).rejects.toThrow()
    await expect(prepared.dispose()).resolves.toBeUndefined()
  })

  it('gives a text-only request an empty private working directory and grants no extra directory', async () => {
    const prepared = await prepareAgyPrompt({ provider: 'gemini', model: 'gemini-4-argon-high', messages: [] }, new Map())
    expect(prepared.addDirs).toEqual([])
    expect(await readdir(prepared.workingDirectory)).toEqual([])
    await prepared.dispose()
    await expect(access(prepared.workingDirectory)).rejects.toThrow()
  })
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('Antigravity binary resolution', () => {
  it('prefers GEMINI_AGY_BINARY, then the installer location, then PATH', async () => {
    const home = await mkdtemp(join(tmpdir(), 'dsh-gemini-home-'))
    try {
      vi.stubEnv('HOME', home)
      vi.stubEnv('GEMINI_AGY_BINARY', '/opt/agy/bin/agy')
      expect(agyBinary()).toBe('/opt/agy/bin/agy')
      vi.stubEnv('GEMINI_AGY_BINARY', '')
      expect(agyBinary()).toBe('agy')
      await mkdir(join(home, '.local', 'bin'), { recursive: true })
      await writeFile(join(home, '.local', 'bin', 'agy'), '')
      expect(agyBinary()).toBe(join(home, '.local', 'bin', 'agy'))
    } finally {
      await rm(home, { recursive: true, force: true })
    }
  })
})

/** Run one fake agy executable that prints the given stderr and JSON, then exits with `exit`. */
async function runFakeAgy(
  stderr: string,
  result: object = { status: 'SUCCESS', response: 'ok' },
  exit = 0,
  cwd?: string,
): Promise<unknown> {
  const directory = await mkdtemp(join(tmpdir(), 'dsh-gemini-fake-agy-'))
  try {
    const binary = join(directory, 'agy')
    await writeFile(binary, [
      '#!/bin/sh',
      `printf '%s\\n' ${JSON.stringify(stderr)} >&2`,
      `printf '%s' '${JSON.stringify(result)}' | sed "s|@PWD@|$(pwd)|"`,
      `exit ${String(exit)}`,
      '',
    ].join('\n'))
    await chmod(binary, 0o755)
    return await generateViaAgy({ binary, model: 'gemini-4-argon-high', prompt: 'oi', cwd: cwd ?? directory })
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
}

describe.skipIf(process.platform === 'win32')('Antigravity model selection', () => {
  it('refuses an answer agy produced after replacing an unknown model id', async () => {
    await expect(runFakeAgy(
      'model gemini-4-argon-high is not recognized as a known model or custom model in settings.',
    )).rejects.toMatchObject({ code: 'UNKNOWN_MODEL', message: expect.stringContaining('1.4.3') as unknown })
  })

  it('accepts a successful run of a recognized model', async () => {
    await expect(runFakeAgy('')).resolves.toMatchObject({ status: 'SUCCESS', response: 'ok' })
  })

  it('runs agy inside the given working directory', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'dsh-gemini-cwd-'))
    try {
      await expect(runFakeAgy('', { status: 'SUCCESS', response: '@PWD@' }, 0, cwd))
        .resolves.toMatchObject({ response: await realpath(cwd) })
    } finally {
      await rm(cwd, { recursive: true, force: true })
    }
  })
})

describe.skipIf(process.platform === 'win32')('Antigravity failures', () => {
  it('asks for a terminal sign-in when agy has no Google account', async () => {
    const failure = runFakeAgy(
      'Authentication required. Please visit the URL to log in:\n  https://accounts.google.com/o/oauth2/auth?client_id=x',
      { status: 'ERROR', response: '', error: 'authentication failed or timed out' },
      1,
    )
    await expect(failure).rejects.toMatchObject({ code: 'SIGN_IN_REQUIRED' })
    await expect(failure).rejects.toThrow(/rode `agy`, faça login/)
  })

  it('reports the error agy states in its JSON result', async () => {
    await expect(runFakeAgy('', { status: 'ERROR', response: '', error: 'quota exhausted' }, 1))
      .rejects.toMatchObject({ code: 'PROVIDER', message: 'agy falhou (código 1): quota exhausted' })
  })
})
