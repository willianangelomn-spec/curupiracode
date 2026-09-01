/** Browser-safe contract for explicitly uploading a document to Curupira Memory. */

import type { RpcRequest, RpcResponse } from './rpc.ts'

/** One document selected by the user in a browser surface. */
export interface KnowledgeUpload {
  /** Display name used by citations and the attachment chip. */
  name: string
  /** Base64-encoded original bytes (without a data-URL prefix). */
  data: string
  /** Lowercase extension hint such as `pdf`, `docx`, `md`, or `txt`. */
  format?: string
}

/** Result returned after extraction and durable local indexing. */
export interface KnowledgeUploadResult {
  id: string
  name: string
  passageCount: number
  alreadyPresent: boolean
  extractor: string
  /** Extracted text made available to restricted, tool-free browser chat. */
  text: string
  /** True when `text` is only a bounded prefix; the complete document remains in Memory. */
  truncated: boolean
}

export interface KnowledgeApi {
  ingest(request: RpcRequest<KnowledgeUpload>, signal: AbortSignal): Promise<RpcResponse<KnowledgeUploadResult>>
}
