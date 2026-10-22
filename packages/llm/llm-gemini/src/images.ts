/** Gemini request-image preparation from durable attachment references. @module dsh-llm-gemini/images */

import {
  IMAGE_OFFLOAD_REQUIRED_CODE,
  LlmError,
  offloadedImageText,
  projectOffloadedImages,
  requiredImageOffload,
} from '@deepseek-ai/dsh-llm'
import type { ContentBlock, GenerateOptions, ImageAttachmentAccessResolver } from '@deepseek-ai/dsh-llm'
import { requestImageDimensions } from '@deepseek-ai/dsh-attachment'
import type {
  AttachmentId,
  AttachmentStore,
  ImageAttachmentRef,
  ImageRequestTarget,
  RequestImageAttachment,
} from '@deepseek-ai/dsh-attachment'

/** Route-owned budgets from which each Gemini request image's target is derived. */
export interface GeminiImageBudget {
  /** Total-pixel budget; larger sources are downscaled proportionally. */
  maxPixels: number
  /** Encoded-byte target for one request image. */
  maxBytes: number
}

/** Durable image inputs and limits for one Gemini request. */
export interface GeminiImageRequestContext {
  /** Durable provider that resolves request-image bytes. */
  attachments: AttachmentStore
  /** Resolve the current tool-world path shown beside an image or its placeholder. */
  resolveImageAccess: ImageAttachmentAccessResolver
  /** Per-image pixel and encoded-byte budget. */
  budget: GeminiImageBudget
  /** Request-level bound on the base64-encoded payload of retained images. */
  maxRequestImageBytes: number
}

/** Prepared provider-neutral request plus the exact retained Gemini image versions. */
export interface PreparedGeminiImages {
  /** Request whose surface-offloaded image occurrences are text placeholders. */
  options: GenerateOptions
  /** Deterministic request versions keyed by durable attachment id. */
  images: ReadonlyMap<AttachmentId, RequestImageAttachment>
}

/**
 * Resolve the request target for one source under the route budgets.
 * @param ref - normalized source image.
 * @param budget - resolved route pixel and byte limits.
 * @returns dimensions and byte target used for the request version.
 */
export function geminiImageTarget(ref: ImageAttachmentRef, budget: GeminiImageBudget): ImageRequestTarget {
  return { ...requestImageDimensions(ref.width, ref.height, budget.maxPixels), maxBytes: budget.maxBytes }
}

/** Collect unique retained durable image references in message order. */
function collectImageRefs(
  blocks: readonly ContentBlock[],
  refs: Map<AttachmentId, ImageAttachmentRef>,
): void {
  for (const block of blocks) {
    if (block.type === 'image' && block.offloaded !== true) refs.set(block.attachment.attachmentId, block.attachment)
  }
}

/**
 * Derive retained Gemini request images under route-owned pixel and aggregate
 * inline-byte bounds without mutating durable session history. The adapter
 * never drops an image by itself: when the retained images still exceed the
 * aggregate bound, the call fails with `IMAGE_OFFLOAD_REQUIRED` naming how many
 * more oldest occurrences the surface must offload.
 * @param options - complete provider-neutral request.
 * @param context - attachment provider, path resolver, and request limits.
 * @returns the request with offloaded placeholders and its exact image versions.
 * @throws {LlmError} `IMAGE_OFFLOAD_REQUIRED` when the retained images exceed `maxRequestImageBytes`.
 */
export async function prepareGeminiImages(
  options: GenerateOptions,
  context: GeminiImageRequestContext,
): Promise<PreparedGeminiImages> {
  const refs = new Map<AttachmentId, ImageAttachmentRef>()
  for (const message of options.messages) collectImageRefs(message.content, refs)
  const ordered = [...refs.values()]
  const projected = await Promise.all(ordered.map(
    ref => context.attachments.readImageRequest(ref, geminiImageTarget(ref, context.budget), options.signal),
  ))
  const images = new Map(ordered.map((ref, index) => (
    [ref.attachmentId, projected[index] as RequestImageAttachment]
  )))
  const offloadImages = requiredImageOffload(
    options.messages,
    { representation: 'base64', maxBytes: context.maxRequestImageBytes },
    block => (images.get(block.attachment.attachmentId) as RequestImageAttachment).bytes,
  )
  if (offloadImages > 0) {
    throw new LlmError(
      `Gemini request images exceed the ${context.maxRequestImageBytes}-byte base64 bound; ${offloadImages} more oldest occurrence(s) must be offloaded.`,
      IMAGE_OFFLOAD_REQUIRED_CODE,
      { offloadImages },
    )
  }
  const messages = projectOffloadedImages(
    options.messages,
    ref => offloadedImageText(ref, context.resolveImageAccess(ref)),
  )
  const unchanged = messages.every((message, index) => message === options.messages[index])
  return {
    options: unchanged ? options : { ...options, messages: [...messages] },
    images,
  }
}
