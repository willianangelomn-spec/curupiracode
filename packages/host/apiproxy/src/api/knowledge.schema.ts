/** Runtime schemas for the Curupira Memory browser-upload boundary. */

import { z } from 'zod'
import type { RequestPayload, ResponseValue } from './rpc-map.ts'
import type { Wire } from './rpc.schema.ts'

export const knowledgeIngestRequestSchema = z.object({
  name: z.string().min(1).max(255),
  data: z.string().min(1),
  format: z.string().min(1).max(16).optional(),
}) satisfies z.ZodType<Wire<RequestPayload<'knowledge.ingest'>>>

export const knowledgeIngestValueSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  passageCount: z.number().int().nonnegative(),
  alreadyPresent: z.boolean(),
  extractor: z.string().min(1),
  text: z.string(),
  truncated: z.boolean(),
}) satisfies z.ZodType<Wire<ResponseValue<'knowledge.ingest'>>>
