/**
 * Built-in mainstream model catalog (Cherry-Studio-style capability table)
 * and model-entry resolution (catalog + field-level overrides + custom
 * models). All functions operate on ONE gateway's config — the plugin routes
 * each provider request to its gateway first, then resolves models within it.
 *
 * `reasoning` maps offered effort ids to their wire spellings; a valueless
 * `off` means "thinking disabled". Values follow the model families' public
 * specs; the Models page "discover" button can refresh real parameters for
 * the configured gateway.
 *
 * @module dsh-provider-hub/catalog
 */
import { ReasoningEffortId, type ModelModality } from '@deepseek-ai/dsh-llm';
import type { GatewayConfig, ReasoningEffortMap, WireModelEntry } from './types.ts';

interface CatalogEntry {
  name: string;
  contextWindow: number;
  maxTokens: number;
  input: ModelModality[];
  reasoning?: ReasoningEffortMap;
}

/** Built-in catalog: id -> capability entry. */
export const MODEL_CATALOG: Record<string, CatalogEntry> = {
  'glm-5.3': {
    name: 'GLM-5.3',
    contextWindow: 200000,
    maxTokens: 131072,
    input: ['text', 'image'],
    reasoning: { off: null, low: 'low', medium: 'medium', high: 'high' },
  },
  'glm-5.3-flash': {
    name: 'GLM-5.3-Flash',
    contextWindow: 1000000,
    maxTokens: 131072,
    input: ['text', 'image'],
    reasoning: { off: null, low: 'low', high: 'high', max: 'max' },
  },
  'claude-opus-4-8': {
    name: 'Claude Opus 4.8',
    contextWindow: 1000000,
    maxTokens: 32768,
    input: ['text', 'image'],
    reasoning: { off: null, low: 'low', medium: 'medium', high: 'high', xhigh: 'xhigh', max: 'max' },
  },
  'claude-sonnet-4-6': {
    name: 'Claude Sonnet 4.6',
    contextWindow: 1000000,
    maxTokens: 32768,
    input: ['text', 'image'],
    reasoning: { off: null, low: 'low', medium: 'medium', high: 'high', max: 'max' },
  },
  'gpt-5.6-sol': {
    name: 'GPT-5.6 Sol',
    contextWindow: 1000000,
    maxTokens: 32768,
    input: ['text', 'image'],
    reasoning: { off: null, low: 'low', medium: 'medium', high: 'high', xhigh: 'xhigh', max: 'max' },
  },
  'gpt-5.6-luna': {
    name: 'GPT-5.6 Luna',
    contextWindow: 1000000,
    maxTokens: 32768,
    input: ['text', 'image'],
    reasoning: { off: null, low: 'low', medium: 'medium', high: 'high', max: 'max' },
  },
  'gpt-5.6-terra': {
    name: 'GPT-5.6 Terra',
    contextWindow: 1000000,
    maxTokens: 32768,
    input: ['text', 'image'],
    reasoning: { off: null, low: 'low', medium: 'medium', high: 'high', xhigh: 'xhigh', max: 'max' },
  },
  'qwen3.8-max': {
    name: 'Qwen3.8-Max',
    contextWindow: 256000,
    maxTokens: 32768,
    input: ['text', 'image'],
    reasoning: { off: null, low: 'low', medium: 'medium', xhigh: 'xhigh' },
  },
  'qwen3.8-27b': {
    name: 'Qwen3.8-27B',
    contextWindow: 256000,
    maxTokens: 32768,
    input: ['text', 'image'],
    reasoning: { off: null, low: 'low', medium: 'medium', xhigh: 'xhigh' },
  },
  'deepseek-v4-flash': {
    name: 'DeepSeek V4 Flash',
    contextWindow: 128000,
    maxTokens: 8192,
    input: ['text', 'image'],
    reasoning: { off: null, low: 'low', medium: 'medium', high: 'high', max: 'max' },
  },
  // --- 2026-08 catalog expansion: parameters from public specs / provider listings ---
  'claude-haiku-4-5': {
    name: 'Claude Haiku 4.5',
    contextWindow: 200000,
    maxTokens: 8192,
    input: ['text', 'image'],
    reasoning: { off: null, low: 'low', medium: 'medium' },
  },
  'deepseek-v3': {
    name: 'DeepSeek V3',
    contextWindow: 128000,
    maxTokens: 8192,
    input: ['text'],
    reasoning: { off: null },
  },
  'deepseek-r1': {
    name: 'DeepSeek R1',
    contextWindow: 128000,
    maxTokens: 8192,
    input: ['text'],
    reasoning: { off: null, low: 'low', medium: 'medium', high: 'high', max: 'max' },
  },
  'kimi-k2': {
    name: 'Kimi K2',
    contextWindow: 128000,
    maxTokens: 16384,
    input: ['text', 'image'],
    reasoning: { off: null, low: 'low', medium: 'medium', high: 'high', max: 'max' },
  },
  'gpt-4o': {
    name: 'GPT-4o',
    contextWindow: 128000,
    maxTokens: 16384,
    input: ['text', 'image'],
    reasoning: { off: null },
  },
  'gpt-4o-mini': {
    name: 'GPT-4o mini',
    contextWindow: 128000,
    maxTokens: 16384,
    input: ['text', 'image'],
    reasoning: { off: null },
  },
};

/** Whether a value should be treated as "not set" (schemastery materializes absent arrays/dicts as [] / {}). */
function isUnset(value: unknown): boolean {
  if (value === undefined || value === null) return true;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === 'object') return Object.keys(value as object).length === 0;
  return value === '';
}

/**
 * Resolve every model one gateway serves: enabled built-in catalog entries
 * (with field-level `modelOverrides`) and fully-specified custom models.
 */
export function resolveModelEntries(gw: GatewayConfig): WireModelEntry[] {
  const out: WireModelEntry[] = [];
  const overrides = gw.modelOverrides ?? {};
  for (const id of gw.enabledModels ?? []) {
    const entry = MODEL_CATALOG[id];
    if (entry === undefined) continue;
    const ov = overrides[id];
    out.push({
      id,
      name: entry.name,
      contextWindow: entry.contextWindow,
      maxTokens: entry.maxTokens,
      input: [...entry.input],
      reasoning: entry.reasoning,
      ...(ov === undefined ? {} : {
        ...(isUnset(ov.name) ? {} : { name: ov.name }),
        ...(isUnset(ov.contextWindow) ? {} : { contextWindow: ov.contextWindow as number }),
        ...(isUnset(ov.maxTokens) ? {} : { maxTokens: ov.maxTokens as number }),
        ...(isUnset(ov.input) ? {} : { input: [...(ov.input as ModelModality[])] }),
        ...(isUnset(ov.reasoningEfforts) ? {} : { reasoning: ov.reasoningEfforts as ReasoningEffortMap }),
      }),
    });
  }
  for (const custom of gw.customModels ?? []) {
    out.push({
      id: custom.id,
      name: custom.name || custom.id,
      contextWindow: custom.contextWindow,
      maxTokens: custom.maxTokens,
      input: custom.input ?? ['text'],
      reasoning: custom.reasoningEfforts,
    });
  }
  return out;
}

/** Capability entry for one exact model id on one gateway, or undefined when not enabled. */
export function catalogEntryFor(gw: GatewayConfig, model: string): WireModelEntry | undefined {
  return resolveModelEntries(gw).find((entry) => entry.id === model);
}

/** Convert a reasoning-effort map into DSH LlmModelReasoningInfo shape. */
export function reasoningMetadata(entry: WireModelEntry): {
  efforts: Array<{ id: ReturnType<typeof ReasoningEffortId>; name: string }>;
  defaultEffort?: ReturnType<typeof ReasoningEffortId>;
} | undefined {
  const map = entry.reasoning;
  if (map === undefined || Object.keys(map).length === 0) return undefined;
  const efforts = Object.keys(map).map((id) => ({ id: ReasoningEffortId(id), name: id }));
  return { efforts, defaultEffort: efforts[0]?.id === 'off' ? undefined : efforts[0]?.id };
}
