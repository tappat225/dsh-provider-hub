/**
 * Local types for dsh-provider-hub: the validated plugin configuration
 * (mirror of the Config schema), resolved model entries, and the wire
 * event shapes consumed from Anthropic / OpenAI streams.
 *
 * @module dsh-provider-hub/types
 */
import type { ModelModality } from '@deepseek-ai/dsh-llm';

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

/** Fully-specified custom model entries (Cherry-Studio style manual entries). */
export interface CustomModel {
  id: string;
  name?: string;
  contextWindow: number;
  maxTokens: number;
  input?: ModelModality[];
  reasoningEfforts?: ReasoningEffortMap;
}

/** Import one model's capability parameters from another registered provider route. */
export interface PresetFrom {
  /** Provider route already registered in DSH (e.g. a configured llm-pi-ai route like `shuai-claude`). */
  provider: string;
  /** Exact model id to import. */
  model: string;
}

/**
 * One gateway (provider route) configuration. Mirrors the per-gateway object
 * schema in `src/index.ts`; keep both in sync.
 */
export interface GatewayConfig {
  /** Provider route this gateway registers (unique; change requires restart). */
  provider: string;
  /** Display name in model pickers. */
  displayName: string;
  /** Upstream base URL (required; the request path is appended automatically). */
  baseURL?: string;
  /** Wire protocol. */
  api: 'anthropic-messages' | 'openai-completions';
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
  /** When true, the anthropic-messages path forwards reasoningEffort as Anthropic `thinking`. */
  anthropicThinking: boolean;
  /** Built-in catalog model ids to enable in the picker. */
  enabledModels: string[];
  /** Field-level parameter overrides for built-in catalog models (id -> partial entry). */
  modelOverrides: Record<string, ModelOverride>;
  /** Fully-specified custom models. */
  customModels: CustomModel[];
  /** Import one model's capability parameters from another registered provider route. */
  presetFrom?: PresetFrom;
}

/**
 * Validated plugin configuration: the whole plugin owns a list of gateways,
 * each a complete provider route with its own protocol/UA/credentials/models.
 */
export interface WireConfig {
  gateways: GatewayConfig[];
}

/** One resolved model entry after catalog + overrides + custom merging. */
export interface WireModelEntry {
  id: string;
  name: string;
  contextWindow: number;
  maxTokens: number;
  input?: ModelModality[];
  reasoning?: ReasoningEffortMap;
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
