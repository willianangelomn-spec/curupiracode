import { access, chmod, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { GenerateOptions, Message } from '@deepseek-ai/dsh-llm'
import type { ImageAttachmentRef, RequestImageAttachment } from '@deepseek-ai/dsh-attachment'
import { flattenPrompt, generateViaAgy, prepareAgyPrompt } from '../src/agy.ts'

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
    await prepared.dispose()
    await expect(access(directory)).rejects.toThrow()
    await expect(prepared.dispose()).resolves.toBeUndefined()
  })
})

/** Run one fake agy executable that prints the given stderr and success JSON. */
async function runFakeAgy(stderr: string): Promise<unknown> {
  const directory = await mkdtemp(join(tmpdir(), 'dsh-gemini-fake-agy-'))
  try {
    const binary = join(directory, 'agy')
    await writeFile(binary, [
      '#!/bin/sh',
      `printf '%s\\n' ${JSON.stringify(stderr)} >&2`,
      `printf '%s' '${JSON.stringify({ status: 'SUCCESS', response: 'ok' })}'`,
      '',
    ].join('\n'))
    await chmod(binary, 0o755)
    return await generateViaAgy({ binary, model: 'gemini-4-argon-high', prompt: 'oi' })
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
})
