/**
 * Local types for dsh-provider-hub: the validated plugin configuration
 * (mirror of the Config schema), resolved model entries, and the wire
 * event shapes consumed from Anthropic / OpenAI streams.
 *
 * @module dsh-provider-hub/types
 */
import type { ModelModality } from '@deepseek-ai/dsh-llm';
import type { EndpointMode } from './url.ts';

/** User-Agent used when a gateway leaves the field empty (schema default). */
export const DEFAULT_USER_AGENT = 'claude-cli/2.0.1 (external, cli)';

/** The UA actually sent on the wire: an explicitly emptied field falls back
 * to the default (an empty header would fail UA-whitelisted gateways). */
export function effectiveUserAgent(userAgent: string | undefined): string {
  const value = (userAgent ?? '').trim();
  return value === '' ? DEFAULT_USER_AGENT : value;
}

/** Reasoning-effort map from the panel: offered level -> wire spelling (`off` maps to null). */
export type ReasoningEffortMap = Record<string, string | null>;

/** Field-level overrides for built-in catalog models (all fields optional). */
export interface ModelOverride {
  name?: string;
  contextWindow?: number;
  maxTokens?: number;
  input?: ModelModality[];
  reasoningEfforts?: ReasoningEffortMap;
}

/**
 * Custom model entries (Cherry-Studio style manual entries). Capacities are
 * optional in stored configurations: when a custom entry omits them, the
 * gateway's `defaultContextWindow` / `defaultMaxTokens` fill them at
 * resolution (entry source `gateway-default`) — there is no hard-coded
 * fallback anywhere in the read path.
 */
export interface CustomModel {
  id: string;
  name?: string;
  contextWindow?: number;
  maxTokens?: number;
  input?: ModelModality[];
  reasoningEfforts?: ReasoningEffortMap;
}

/** The wire protocols a gateway can speak. */
export type WireApi = 'anthropic-messages' | 'openai-completions' | 'openai-responses';

/**
 * One gateway (provider route) configuration. Mirrors the per-gateway object
 * schema in `src/index.ts`; keep both in sync.
 */
export interface GatewayConfig {
  /** Provider route this gateway registers (unique; changes apply live). */
  provider: string;
  /** Display name in model pickers. */
  displayName: string;
  /** Upstream base URL. In auto mode an API root; in custom mode the complete model-listing URL. */
  baseURL?: string;
  /** Wire protocol. */
  api: WireApi;
  /**
   * Endpoint addressing mode (see url.ts). Absent means `auto`: stored
   * configurations saved before the field existed keep the /v1
   * auto-normalization behavior.
   */
  endpointMode?: EndpointMode;
  /**
   * Complete chat-style request URL used verbatim in custom mode — the
   * /chat/completions, /responses, or /messages address of whatever protocol
   * `api` names. Unused in auto mode.
   */
  endpoint?: string;
  /** User-Agent sent on the wire (gateway whitelist). */
  userAgent: string;
  /** Credential-ref env var name; resolved through the credentials service or launch environment. */
  apiKeyEnv: string;
  /** Literal key, optional; takes precedence over apiKeyEnv. */
  apiKey: string;
  /** Extra headers merged into every request. */
  extraHeaders: Record<string, string>;
  /** Role used for the system prompt on the openai-completions path. */
  systemRole: 'system' | 'developer';
  /**
   * When false, openai-completions streaming omits `stream_options.include_usage`
   * (strict gateways that reject the parameter). Default: request the final
   * usage chunk. Treated as true when absent (configurations saved before the
   * field existed).
   */
  streamUsage?: boolean;
  /** When true, the anthropic-messages path forwards reasoningEffort as Anthropic `thinking`. */
  anthropicThinking: boolean;
  /**
   * Default context window for custom model entries that omit `contextWindow`.
   * Optional: absent means no gateway fallback (a custom entry must then carry
   * its own capacity; resolution serves none). Old configurations without the
   * field keep their previous behavior.
   */
  defaultContextWindow?: number;
  /**
   * Default per-request output cap. Fills a custom entry's absent `maxTokens`
   * at resolution and backs the adapter's request default when DSH sends no
   * maxTokens. Optional; absent keeps the historical 4096 floor.
   */
  defaultMaxTokens?: number;
  /** Default input modalities for custom entries that omit `input` (legacy fallback: text). */
  defaultInput?: ModelModality[];
  /**
   * Anthropic thinking budget (tokens) per reasoning level, overriding the
   * adapter's built-in per-level table. Unset levels — and an unset field —
   * fall back to the built-in table.
   */
  anthropicThinkingBudgets?: Record<string, number>;
  /** Built-in catalog model ids to enable in the picker. */
  enabledModels: string[];
  /** Field-level parameter overrides for built-in catalog models (id -> partial entry). */
  modelOverrides: Record<string, ModelOverride>;
  /** Fully-specified custom models. */
  customModels: CustomModel[];
}

/**
 * Validated plugin configuration: the whole plugin owns a list of gateways,
 * each a complete provider route with its own protocol/UA/credentials/models.
 */
export interface WireConfig {
  gateways: GatewayConfig[];
}

/**
 * Where one resolved model entry's parameters come from:
 *
 *   - `catalog`: built-in entry serving the built-in catalog values;
 *   - `override`: built-in entry with a field-level `modelOverrides` entry applied;
 *   - `custom`: custom model entry whose contextWindow/maxTokens are both explicit;
 *   - `gateway-default`: custom entry with at least one capacity filled from the
 *     gateway's `defaultContextWindow` / `defaultMaxTokens`.
 */
export type WireModelSource = 'catalog' | 'override' | 'custom' | 'gateway-default';

/** One resolved model entry after catalog + overrides + custom merging. */
export interface WireModelEntry {
  id: string;
  name: string;
  /**
   * Resolved context window: the catalog/override value, the custom entry's
   * explicit value, or the gateway default. Undefined only when a custom entry
   * carries no capacity and the gateway declares no default.
   */
  contextWindow?: number;
  /** Same resolution chain as `contextWindow`. */
  maxTokens?: number;
  input?: ModelModality[];
  reasoning?: ReasoningEffortMap;
  /** Origin of the entry's parameters (see {@link WireModelSource}). */
  source: WireModelSource;
  /**
   * True when `maxTokens` is a user-declared capacity (an override or custom
   * entry field) rather than an inherited catalog/gateway value. The adapter
   * serves `defaultMaxTokens` ONLY from explicit capacities or gateway
   * defaults — never from an inherited catalog value.
   */
  maxTokensExplicit?: boolean;
}

/** Provider-neutral message shape accepted by the wire converters. */
export interface WireInputMessage {
  role: 'user' | 'assistant' | 'system';
  content: unknown;
}

// ---------------------------------------------------------------------------
// Anthropic wire events (the subset we consume)
// ---------------------------------------------------------------------------

export interface AnthropicContentBlockStart {
  type: 'content_block_start';
  index: number;
  content_block: {
    type: 'text' | 'thinking' | 'tool_use';
    id?: string;
    name?: string;
  };
}

export interface AnthropicContentBlockDelta {
  type: 'content_block_delta';
  index: number;
  delta: {
    type: 'text_delta' | 'thinking_delta' | 'input_json_delta';
    text?: string;
    thinking?: string;
    partial_json?: string;
  };
}

export interface AnthropicContentBlockStop {
  type: 'content_block_stop';
  index: number;
}

export interface AnthropicMessageDelta {
  type: 'message_delta';
  delta?: { stop_reason?: string };
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    cache_read_input_tokens?: number;
    cache_creation_input_tokens?: number;
  };
}

export interface AnthropicMessageStart {
  type: 'message_start';
}

export interface AnthropicMessageStop {
  type: 'message_stop';
}

export type AnthropicSsePayload =
  | AnthropicContentBlockStart
  | AnthropicContentBlockDelta
  | AnthropicContentBlockStop
  | AnthropicMessageDelta
  | AnthropicMessageStart
  | AnthropicMessageStop;

/** OpenAI chat.completion.chunk delta subset we consume. */
export interface OpenAIChatDelta {
  content?: string;
  reasoning_content?: string;
  tool_calls?: Array<{
    index?: number;
    id?: string;
    function?: { name?: string; arguments?: string };
  }>;
}

/**
 * Usage block on the final chunk of an OpenAI-compatible stream.
 * `prompt_tokens` may include cached input; `prompt_tokens_details.cached_tokens`
 * lets adapters split it into the disjoint TokenUsage fields.
 */
export interface OpenAIChatUsage {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
  prompt_tokens_details?: { cached_tokens?: number };
}

export interface OpenAIChatChunk {
  choices?: Array<{
    index?: number;
    delta?: OpenAIChatDelta;
    finish_reason?: string | null;
  }>;
  usage?: OpenAIChatUsage;
}
