/**
 * Built-in mainstream model catalog (Cherry-Studio-style capability table)
 * and model-entry resolution (catalog + field-level overrides + custom
 * models, with gateway-level defaults filling absent custom capacities).
 * All functions operate on ONE gateway's config — the plugin routes
 * each provider request to its gateway first, then resolves models within it.
 *
 * `reasoning` maps offered effort ids to their wire spellings: the KEY is the
 * level the DSH selector offers, the VALUE is what the adapter dispatches on
 * the wire (`reasoning_effort` on the openai-completions path; the level
 * drives the thinking budget on the anthropic path). A valueless `off` means
 * "thinking disabled, send nothing" (the parameter's absence); an `off` with
 * a value is that value's explicit spelling. Values follow the model
 * families' public specs; the Models page "discover" button can refresh real
 * parameters for the configured gateway.
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

/** Whether a number is a usable capacity: a positive integer (schemastery leaves absent optionals undefined; hand-edited configs may carry junk). */
export function positiveInt(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0;
}

/** The gateway-level model defaults (validated snapshot; unset/invalid fields dropped). */
export interface GatewayModelDefaults {
  contextWindow?: number;
  maxTokens?: number;
  input?: ModelModality[];
}

/**
 * One gateway's model-parameter defaults (`defaultContextWindow`,
 * `defaultMaxTokens`, `defaultInput`), validated: junk values behave as unset
 * so a hand-edited config can never crash resolution. Shared by the read side
 * (resolution) and the write side (model RPCs) so both agree on what
 * "the gateway's defaults" are.
 */
export function gatewayModelDefaults(gw: GatewayConfig): GatewayModelDefaults {
  return {
    ...(positiveInt(gw.defaultContextWindow) ? { contextWindow: gw.defaultContextWindow } : {}),
    ...(positiveInt(gw.defaultMaxTokens) ? { maxTokens: gw.defaultMaxTokens } : {}),
    ...(Array.isArray(gw.defaultInput) && gw.defaultInput.length > 0 ? { input: [...(gw.defaultInput as ModelModality[])] } : {}),
  };
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
  },
  'gpt-4o-mini': {
    name: 'GPT-4o mini',
    contextWindow: 128000,
    maxTokens: 16384,
    input: ['text', 'image'],
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
 * Validate one resolved reasoning-effort map — fail-loud at resolution, so a
 * malformed map names its gateway/model/level instead of silently offering a
 * control the dispatch cannot spell (mirrors the llm-pi-ai reference):
 *   - every level except `off` must carry the wire value dispatch sends;
 *   - an empty-string value is never a spelling;
 *   - a map offering nothing beyond `off` is a control that cannot do
 *     anything — a non-reasoning model declares no map at all.
 * An empty/absent map stays legal: schemastery materializes an absent dict
 * as `{}`, which is how custom models without reasoningEfforts arrive.
 */
function assertValidReasoningMap(gateway: string, model: string, map: ReasoningEffortMap): void {
  const levels = Object.keys(map);
  if (levels.length === 0) return;
  for (const level of levels) {
    const wire = map[level];
    if (wire === null) {
      if (level !== 'off') {
        throw new Error(`llm-provider-hub: gateway "${gateway}" model "${model}" reasoningEfforts.${level} needs the wire value dispatch should send; only "off" may leave it empty (remove the key to not offer the level)`);
      }
    } else if (wire.length === 0) {
      throw new Error(`llm-provider-hub: gateway "${gateway}" model "${model}" reasoningEfforts.${level} must not be an empty string`);
    }
  }
  if (!levels.some((level) => level !== 'off')) {
    throw new Error(`llm-provider-hub: gateway "${gateway}" model "${model}" reasoningEfforts offers no level beyond "off"; declare a thinking level, or remove the field for a non-reasoning model`);
  }
}

/**
 * Resolve every model one gateway serves: enabled built-in catalog entries
 * (with field-level `modelOverrides`) and custom models.
 *
 * Custom entries without explicit capacities fall back to the gateway's
 * `defaultContextWindow` / `defaultMaxTokens` / `defaultInput` — never to any
 * hard-coded value; an entry with neither explicit nor default capacities
 * resolves with the field undefined (the adapter then omits it). Every entry
 * carries a `source` tag telling catalog / override / custom /
 * gateway-default apart, and `maxTokensExplicit` marks a user-declared
 * maxTokens (the adapter serves `defaultMaxTokens` only from those).
 */
export function resolveModelEntries(gw: GatewayConfig): WireModelEntry[] {
  const out: WireModelEntry[] = [];
  const overrides = gw.modelOverrides ?? {};
  for (const id of gw.enabledModels ?? []) {
    const entry = MODEL_CATALOG[id];
    if (entry === undefined) continue; // unknown enabled ids keep read-side compat: skipped, not fatal
    const ov = overrides[id];
    const applied = ov === undefined || isUnset(ov) ? undefined : {
      ...(isUnset(ov.name) ? {} : { name: ov.name }),
      ...(isUnset(ov.contextWindow) ? {} : { contextWindow: ov.contextWindow as number }),
      ...(isUnset(ov.maxTokens) ? {} : { maxTokens: ov.maxTokens as number }),
      ...(isUnset(ov.input) ? {} : { input: [...(ov.input as ModelModality[])] }),
      ...(isUnset(ov.reasoningEfforts) ? {} : { reasoning: ov.reasoningEfforts as ReasoningEffortMap }),
    };
    out.push({
      id,
      name: entry.name,
      contextWindow: entry.contextWindow,
      maxTokens: entry.maxTokens,
      input: [...entry.input],
      reasoning: entry.reasoning,
      ...(applied ?? {}),
      source: applied === undefined ? 'catalog' : 'override',
      ...(applied?.maxTokens !== undefined ? { maxTokensExplicit: true } : {}),
    });
  }
  const defaults = gatewayModelDefaults(gw);
  for (const custom of gw.customModels ?? []) {
    const explicitCtx = positiveInt(custom.contextWindow);
    const explicitMax = positiveInt(custom.maxTokens);
    const contextWindow = explicitCtx ? custom.contextWindow : defaults.contextWindow;
    const maxTokens = explicitMax ? custom.maxTokens : defaults.maxTokens;
    out.push({
      id: custom.id,
      name: custom.name || custom.id,
      contextWindow,
      maxTokens,
      input: Array.isArray(custom.input) && custom.input.length > 0 ? [...custom.input] : (defaults.input ?? ['text']),
      reasoning: custom.reasoningEfforts,
      source: explicitCtx && explicitMax ? 'custom' : 'gateway-default',
      ...(explicitMax ? { maxTokensExplicit: true } : {}),
    });
  }
  // Resolution is the earliest point that can name a malformed map: refuse it
  // here so the gateway's model list (and every picker fed by it) fails with
  // the offending key instead of serving an unspellable control.
  for (const entry of out) {
    if (entry.reasoning !== undefined) assertValidReasoningMap(gw.provider, entry.id, entry.reasoning);
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
  // Capitalized display names for selectors, matching the llm-pi-ai seam.
  const efforts = Object.keys(map).map((id) => ({ id: ReasoningEffortId(id), name: id.charAt(0).toUpperCase() + id.slice(1) }));
  return { efforts, defaultEffort: efforts[0]?.id === 'off' ? undefined : efforts[0]?.id };
}
