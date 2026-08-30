/**
 * Model catalog served through the Antigravity CLI (`agy`). The adapter spawns
 * the locally installed, already-authenticated `agy` binary (consumer Google
 * account) and therefore advertises exactly the models the CLI exposes; the
 * reasoning effort is part of the model id itself (…-high/-medium/-low), so no
 * separate effort knob is offered. Context windows follow Google's published
 * capabilities for each family.
 *
 * @module dsh-llm-gemini/models
 */

import type { GeminiModelDef } from './types.ts'

/** The models this adapter serves through `agy`, in display order. */
export const GEMINI_MODELS: readonly GeminiModelDef[] = [
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

/** Look up one catalog model by id, or undefined when the id is unknown. */
export function modelById(id: string): GeminiModelDef | undefined {
  return GEMINI_MODELS.find(model => model.id === id)
}
