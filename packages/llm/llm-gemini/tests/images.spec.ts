import { describe, expect, it, vi } from 'vitest'
import type { GenerateOptions, Message } from '@deepseek-ai/dsh-llm'
import type { AttachmentStore, ImageAttachmentRef, RequestImageAttachment } from '@deepseek-ai/dsh-attachment'
import { prepareGeminiImages } from '../src/images.ts'
import type { GeminiImageRequestContext } from '../src/images.ts'

function ref(id: string, bytes = 3): ImageAttachmentRef {
  return {
    attachmentId: `sha256:${id}` as ImageAttachmentRef['attachmentId'],
    mediaType: 'image/png',
    bytes,
    width: 1,
    height: 1,
  }
}

function message(...refs: ImageAttachmentRef[]): Message {
  return {
    id: 'user-images' as Message['id'],
    role: 'user',
    content: refs.map(attachment => ({ type: 'image' as const, attachment })),
    source: { kind: 'user' },
  } as unknown as Message
}

function requestImage(attachment: ImageAttachmentRef): RequestImageAttachment {
  return {
    variantId: `variant:${attachment.attachmentId}` as RequestImageAttachment['variantId'],
    attachment,
    data: Uint8Array.from([1, 2, 3]),
    mediaType: 'image/png',
    bytes: 3,
    width: 1,
    height: 1,
    depth: 'uchar',
    space: 'srgb',
    hasAlpha: false,
  }
}

function context(readImageRequest: AttachmentStore['readImageRequest'], maxRequestImageBytes: number): GeminiImageRequestContext {
  return {
    attachments: { readImageRequest } as unknown as AttachmentStore,
    resolveImageAccess: () => undefined,
    budget: { maxPixels: 100, maxBytes: 10 },
    maxRequestImageBytes,
  }
}

describe('prepareGeminiImages', () => {
  it('derives each retained durable image under the Gemini request budget', async () => {
    const first = ref('first')
    const second = ref('second')
    const readImageRequest = vi.fn(async (attachment: ImageAttachmentRef) => requestImage(attachment))
    const options = {
      provider: 'gemini',
      model: 'gemini-3.1-pro-high',
      messages: [message(first, second)],
    } as GenerateOptions
    const prepared = await prepareGeminiImages(options, context(readImageRequest, 100))
    expect(readImageRequest).toHaveBeenCalledTimes(2)
    expect(readImageRequest).toHaveBeenNthCalledWith(1, first, { width: 1, height: 1, maxBytes: 10 }, undefined)
    expect([...prepared.images.keys()]).toEqual([first.attachmentId, second.attachmentId])
    expect(prepared.options).toBe(options)
  })

  it('asks the surface to offload the oldest images when the aggregate bound is exceeded', async () => {
    const first = ref('first')
    const second = ref('second')
    const readImageRequest = vi.fn(async (attachment: ImageAttachmentRef) => requestImage(attachment))
    const options = {
      provider: 'gemini',
      model: 'gemini-3.1-pro-high',
      messages: [message(first, second)],
    } as GenerateOptions
    // Each 3-byte version is 4 base64 bytes; a 5-byte bound keeps only one.
    await expect(prepareGeminiImages(options, context(readImageRequest, 5))).rejects.toMatchObject({
      code: 'IMAGE_OFFLOAD_REQUIRED',
      failure: { offloadImages: 1 },
    })
  })

  it('sends a surface-offloaded image as its placeholder and never reads it', async () => {
    const first = ref('first')
    const second = ref('second')
    const readImageRequest = vi.fn(async (attachment: ImageAttachmentRef) => requestImage(attachment))
    const offloaded = message(first, second) as unknown as { content: Record<string, unknown>[] }
    offloaded.content[0] = { ...offloaded.content[0], offloaded: true }
    const options = {
      provider: 'gemini',
      model: 'gemini-3.1-pro-high',
      messages: [offloaded as unknown as Message],
    } as GenerateOptions
    const prepared = await prepareGeminiImages(options, context(readImageRequest, 100))
    expect(readImageRequest).toHaveBeenCalledTimes(1)
    expect(readImageRequest).toHaveBeenCalledWith(second, { width: 1, height: 1, maxBytes: 10 }, undefined)
    expect(prepared.options.messages[0]?.content[0]).toMatchObject({ type: 'text' })
    expect(prepared.options.messages[0]?.content[1]).toMatchObject({ type: 'image', attachment: second })
  })
})
