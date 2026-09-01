/** Gemini request-image preparation from durable attachment references. @module dsh-llm-gemini/images */

import { offloadRequestImagesWithPolicy } from '@deepseek-ai/dsh-llm'
import type { ContentBlock, GenerateOptions } from '@deepseek-ai/dsh-llm'
import type {
  AttachmentId,
  AttachmentStore,
  ImageAttachmentRef,
  ImageRequestPolicy,
  RequestImageAttachment,
} from '@deepseek-ai/dsh-attachment'

/** Prepared provider-neutral request plus the exact retained Gemini image versions. */
export interface PreparedGeminiImages {
  /** Request whose over-budget oldest images are transient text placeholders. */
  options: GenerateOptions
  /** Deterministic request versions keyed by durable attachment id. */
  images: ReadonlyMap<AttachmentId, RequestImageAttachment>
}

/** Collect unique durable image references in message and nested tool-result order. */
/* jscpd:ignore-start -- provider-local traversal mirrors the pi-ai adapter boundary */
function collectImageRefs(
  blocks: readonly ContentBlock[],
  refs: Map<AttachmentId, ImageAttachmentRef>,
): void {
  for (const block of blocks) {
    if (block.type === 'image') refs.set(block.attachment.attachmentId, block.attachment)
    else if (block.type === 'tool-result') collectImageRefs(block.content, refs)
  }
}
/* jscpd:ignore-end */

/**
 * Derive retained Gemini request images under route-owned pixel and aggregate
 * inline-byte bounds without mutating durable session history.
 * @param options - complete provider-neutral request.
 * @param attachments - durable attachment resolver.
 * @param policy - deterministic per-image projection limits.
 * @param maxRequestImageBytes - accumulated base64 request-image limit.
 * @returns bounded request messages and their exact image versions.
 */
export async function prepareGeminiImages(
  options: GenerateOptions,
  attachments: AttachmentStore,
  policy: ImageRequestPolicy,
  maxRequestImageBytes: number,
): Promise<PreparedGeminiImages> {
  const conservative = offloadRequestImagesWithPolicy(options.messages, {
    representation: 'base64',
    maxBytes: maxRequestImageBytes,
    byteQuantum: 1,
    byteLength: ref => Math.min(ref.bytes, policy.maxBytes),
  })
  const refs = new Map<AttachmentId, ImageAttachmentRef>()
  for (const message of conservative) collectImageRefs(message.content, refs)
  const ordered = [...refs.values()]
  const projected = await Promise.all(ordered.map(
    ref => attachments.readImageRequest(ref, policy, options.signal),
  ))
  const images = new Map(ordered.map((ref, index) => (
    [ref.attachmentId, projected[index] as RequestImageAttachment]
  )))
  const exact = offloadRequestImagesWithPolicy(conservative, {
    representation: 'base64',
    maxBytes: maxRequestImageBytes,
    byteQuantum: 1,
    byteLength: ref => (images.get(ref.attachmentId) as RequestImageAttachment).bytes,
  })
  return {
    options: exact === options.messages ? options : { ...options, messages: [...exact] },
    images,
  }
}
