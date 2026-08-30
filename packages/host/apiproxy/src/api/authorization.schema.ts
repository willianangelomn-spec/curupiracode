/**
 * authorization domain zod schemas (names derived from map keys:
 * authorizationListRequestSchema / authorizationListValueSchema / …). Validates
 * the wire shape on both planes before a value reaches a consumer.
 */

import { z } from 'zod'
import type { RequestPayload, ResponseValue } from './rpc-map.ts'
import type { Wire } from './rpc.schema.ts'
import type { AuthorizationEntryView, AuthorizationMethodView } from './authorization.ts'

/** One login method offered by a flow. */
export const authorizationMethodViewSchema = z.object({
  id: z.string(),
  label: z.string(),
}) satisfies z.ZodType<Wire<AuthorizationMethodView>>

/** One flow entry: its record key, label, methods, and live auth state. */
export const authorizationEntryViewSchema = z.object({
  key: z.string(),
  label: z.string(),
  methods: z.array(authorizationMethodViewSchema),
  configured: z.boolean(),
  inFlight: z.boolean(),
}) satisfies z.ZodType<Wire<AuthorizationEntryView>>

/** authorization.list request payload. */
export const authorizationListRequestSchema = z.object({}) satisfies z.ZodType<Wire<RequestPayload<'authorization.list'>>>

/** authorization.list response value. */
export const authorizationListValueSchema = z.object({
  flows: z.array(authorizationEntryViewSchema),
}) satisfies z.ZodType<Wire<ResponseValue<'authorization.list'>>>

/** authorization.begin request payload. */
export const authorizationBeginRequestSchema = z.object({
  key: z.string().min(1),
  method: z.string().min(1),
}) satisfies z.ZodType<Wire<RequestPayload<'authorization.begin'>>>

/** authorization.begin response value. */
export const authorizationBeginValueSchema = z.object({
  status: z.enum(['started', 'authorized', 'cancelled']),
  message: z.string().optional(),
  url: z.string().optional(),
}) satisfies z.ZodType<Wire<ResponseValue<'authorization.begin'>>>

/** authorization.cancel request payload. */
export const authorizationCancelRequestSchema = z.object({
  key: z.string().min(1),
}) satisfies z.ZodType<Wire<RequestPayload<'authorization.cancel'>>>

/** authorization.cancel response value. */
export const authorizationCancelValueSchema = z.object({}) satisfies z.ZodType<Wire<ResponseValue<'authorization.cancel'>>>
