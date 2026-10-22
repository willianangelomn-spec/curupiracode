/**
 * Model catalog served through the Antigravity CLI (`agy`). The adapter spawns
 * the locally installed, already-authenticated `agy` binary (consumer Google
 * account) and therefore advertises exactly the models the CLI exposes; the
 * reasoning effort is part of the model id itself (…-high/-medium/-low), so no
 * separate effort knob is offered. Context windows follow Google's published
 * capabilities for each family. Availability depends on the signed-in Google
 * plan and the installed `agy` version (Gemini 4 Argon needs agy 1.4.3 or
 * later); `agy models` lists the ids the local CLI accepts, and the `models`
 * row config adds ids this catalog does not ship.
 *
 * @module dsh-llm-gemini/models
 */

import type { GeminiModelDef } from './types.ts'

/** The models this adapter serves through `agy`, in display order. */
export const GEMINI_MODELS: readonly GeminiModelDef[] = [
  {
    id: 'gemini-4-argon-high',
    name: 'Gemini 4 Argon (High)',
    contextWindow: 1_048_576,
    inputModalities: ['text', 'image'],
    reasoning: false,
  },
  {
    id: 'gemini-4-argon-medium',
    name: 'Gemini 4 Argon (Medium)',
    contextWindow: 1_048_576,
    inputModalities: ['text', 'image'],
    reasoning: false,
  },
  {
    id: 'gemini-4-argon-low',
    name: 'Gemini 4 Argon (Low)',
    contextWindow: 1_048_576,
    inputModalities: ['text', 'image'],
    reasoning: false,
  },
  {
    id: 'gemini-3.8-flash-high',
    name: 'Gemini 3.8 Flash (High)',
    contextWindow: 1_048_576,
    inputModalities: ['text', 'image'],
    reasoning: false,
  },
  {
    id: 'gemini-3.8-flash-medium',
    name: 'Gemini 3.8 Flash (Medium)',
    contextWindow: 1_048_576,
    inputModalities: ['text', 'image'],
    reasoning: false,
  },
  {
    id: 'gemini-3.8-flash-low',
    name: 'Gemini 3.8 Flash (Low)',
    contextWindow: 1_048_576,
    inputModalities: ['text', 'image'],
    reasoning: false,
  },
  {
    id: 'gemini-3.7-flash-high',
    name: 'Gemini 3.7 Flash (High)',
    contextWindow: 1_048_576,
    inputModalities: ['text', 'image'],
    reasoning: false,
  },
  {
    id: 'gemini-3.7-flash-medium',
    name: 'Gemini 3.7 Flash (Medium)',
    contextWindow: 1_048_576,
    inputModalities: ['text', 'image'],
    reasoning: false,
  },
  {
    id: 'gemini-3.7-flash-low',
    name: 'Gemini 3.7 Flash (Low)',
    contextWindow: 1_048_576,
    inputModalities: ['text', 'image'],
    reasoning: false,
  },
  {
    id: 'gemini-3.6-flash-high',
    name: 'Gemini 3.6 Flash (High)',
    contextWindow: 1_048_576,
    inputModalities: ['text', 'image'],
    reasoning: false,
  },
  {
    id: 'gemini-3.6-flash-medium',
    name: 'Gemini 3.6 Flash (Medium)',
    contextWindow: 1_048_576,
    inputModalities: ['text', 'image'],
    reasoning: false,
  },
  {
    id: 'gemini-3.6-flash-low',
    name: 'Gemini 3.6 Flash (Low)',
    contextWindow: 1_048_576,
    inputModalities: ['text', 'image'],
    reasoning: false,
  },
  {
    id: 'gemini-3.5-flash-high',
    name: 'Gemini 3.5 Flash (High)',
    contextWindow: 1_048_576,
    inputModalities: ['text', 'image'],
    reasoning: false,
  },
  {
    id: 'gemini-3.5-flash-medium',
    name: 'Gemini 3.5 Flash (Medium)',
    contextWindow: 1_048_576,
    inputModalities: ['text', 'image'],
    reasoning: false,
  },
  {
    id: 'gemini-3.5-flash-low',
    name: 'Gemini 3.5 Flash (Low)',
    contextWindow: 1_048_576,
    inputModalities: ['text', 'image'],
    reasoning: false,
  },
  {
    id: 'gemini-3.1-pro-high',
    name: 'Gemini 3.1 Pro (High)',
    contextWindow: 1_048_576,
    inputModalities: ['text', 'image'],
    reasoning: false,
  },
  {
    id: 'gemini-3.1-pro-low',
    name: 'Gemini 3.1 Pro (Low)',
    contextWindow: 1_048_576,
    inputModalities: ['text', 'image'],
    reasoning: false,
  },
  {
    id: 'claude-sonnet-4-6',
    name: 'Claude Sonnet 4.6 (Thinking)',
    contextWindow: 200_000,
    inputModalities: ['text'],
    reasoning: false,
  },
  {
    id: 'claude-opus-4-6-thinking',
    name: 'Claude Opus 4.6 (Thinking)',
    contextWindow: 200_000,
    inputModalities: ['text'],
    reasoning: false,
  },
  {
    id: 'gpt-oss-120b-medium',
    name: 'GPT-OSS 120B (Medium)',
    contextWindow: 128_000,
    inputModalities: ['text'],
    reasoning: false,
  },
]

/**
 * Merge configured models over the shipped catalog: a configured id replaces
 * the shipped entry of the same id in place, and new ids follow the catalog in
 * configuration order.
 * @param configured - models declared in the row config.
 * @returns the effective catalog in display order.
 */
export function mergeModels(configured: readonly GeminiModelDef[]): readonly GeminiModelDef[] {
  if (configured.length === 0) return GEMINI_MODELS
  const byId = new Map(configured.map(model => [model.id, model]))
  const merged = GEMINI_MODELS.map(model => byId.get(model.id) ?? model)
  const shipped = new Set(GEMINI_MODELS.map(model => model.id))
  for (const model of configured) if (!shipped.has(model.id)) merged.push(model)
  return merged
}
