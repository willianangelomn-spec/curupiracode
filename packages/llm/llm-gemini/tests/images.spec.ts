import { describe, expect, it, vi } from 'vitest'
import type { GenerateOptions, Message } from '@deepseek-ai/dsh-llm'
import type { AttachmentStore, ImageAttachmentRef, RequestImageAttachment } from '@deepseek-ai/dsh-attachment'
import { prepareGeminiImages } from '../src/images.ts'

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

describe('prepareGeminiImages', () => {
  it('derives each retained durable image under the Gemini request policy', async () => {
    const first = ref('first')
    const second = ref('second')
    const readImageRequest = vi.fn(async (attachment: ImageAttachmentRef) => requestImage(attachment))
    const attachments = { readImageRequest } as unknown as AttachmentStore
    const options = {
      provider: 'gemini',
      model: 'gemini-3.1-pro-high',
      messages: [message(first, second)],
    } as GenerateOptions
    const prepared = await prepareGeminiImages(options, attachments, { maxPixels: 100, maxBytes: 10 }, 100)
    expect(readImageRequest).toHaveBeenCalledTimes(2)
    expect(readImageRequest).toHaveBeenNthCalledWith(1, first, { maxPixels: 100, maxBytes: 10 }, undefined)
    expect([...prepared.images.keys()]).toEqual([first.attachmentId, second.attachmentId])
    expect(prepared.options).toBe(options)
  })

  it('offloads the oldest image before reading when the conservative bound is exceeded', async () => {
    const first = ref('first', 10)
    const second = ref('second', 10)
    const readImageRequest = vi.fn(async (attachment: ImageAttachmentRef) => requestImage(attachment))
    const attachments = { readImageRequest } as unknown as AttachmentStore
    const options = {
      provider: 'gemini',
      model: 'gemini-3.1-pro-high',
      messages: [message(first, second)],
    } as GenerateOptions
    const prepared = await prepareGeminiImages(options, attachments, { maxPixels: 100, maxBytes: 10 }, 16)
    expect(readImageRequest).toHaveBeenCalledTimes(1)
    expect(readImageRequest).toHaveBeenCalledWith(second, { maxPixels: 100, maxBytes: 10 }, undefined)
    expect(prepared.options.messages[0]?.content[0]).toMatchObject({ type: 'text' })
    expect(prepared.options.messages[0]?.content[1]).toMatchObject({ type: 'image', attachment: second })
  })
})
