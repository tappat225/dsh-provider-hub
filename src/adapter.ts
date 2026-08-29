/**
 * GatewayAdapter — the LlmAdapter implementation for dsh-provider-hub.
 *
 * One adapter instance serves every gateway route (`registerAdapter` binds
 * it to all provider names). Every call is routed by `provider` to the
 * matching gateway config: `options.provider` selects the gateway for
 * `stream`, `listModels(provider)` / `resolveModel(provider, model)` resolve
 * against that gateway's model catalog.
 *
 * The adapter owns the entire wire path: requests are sent with the gateway's
 * custom User-Agent / headers (bypassing DSH's hard-coded
 * `deepseek-harness/...` attribution UA), and responses are converted into
 * the DSH StreamChunk protocol. Both supported protocols share the same
 * takeover: anthropic-messages and openai-completions.
 *
 * @module dsh-provider-hub/adapter
 */
import {
  LlmAdapter,
  LlmError,
  resolveRetryPolicy,
  type GenerateOptions,
  type LlmModelInfo,
  type LlmResolvedModelInfo,
  type StreamChunk,
} from '@deepseek-ai/dsh-llm';
import { catalogEntryFor, reasoningMetadata, resolveModelEntries } from './catalog.ts';
import type { GatewayConfig, WireConfig, WireModelEntry } from './types.ts';
import { errorFinish } from './wire/sse.ts';
import { anthropicSseToChunks, toAnthropicMessages, toAnthropicTools } from './wire/anthropic.ts';
import { openaiCompletionsToChunks, toOpenAIMessages, toOpenAITools } from './wire/openai.ts';

/** Dynamic configuration source and API-key resolver supplied by the plugin entry. */
export interface AdapterDeps {
  /** Whole-plugin configuration (live-updating via installSettingsSection). */
  current(): WireConfig;
  /** Gateway config by provider route (undefined when unknown). */
  gatewayFor(provider: string): GatewayConfig | undefined;
  /** API-key resolver for one gateway. */
  resolveApiKey(gw: GatewayConfig): Promise<string>;
  /** Runtime entry imported from another provider route for one gateway (may be undefined). */
  preset(provider: string): WireModelEntry | undefined;
}

export class GatewayAdapter extends LlmAdapter {
  private readonly deps: AdapterDeps;

  constructor(deps: AdapterDeps) {
    super();
    this.deps = deps;
  }

  providerInfo(provider: string) {
    const gw = this.deps.gatewayFor(provider);
    return { id: provider, name: gw?.displayName || provider };
  }

  providerRetryPolicy() {
    return resolveRetryPolicy(undefined, 'llm-provider-hub retryPolicy');
  }

  listModels(provider: string): Promise<readonly LlmModelInfo[]> {
    const gw = this.deps.gatewayFor(provider);
    if (gw === undefined) return Promise.resolve([]);
    return Promise.resolve(resolveModelEntries(gw, this.deps.preset(provider)).map((entry) => ({
      provider,
      id: entry.id,
      name: entry.name,
    })));
  }

  resolveModel(provider: string, model: string, _signal?: AbortSignal): Promise<LlmResolvedModelInfo> {
    const gw = this.deps.gatewayFor(provider);
    if (gw === undefined) {
      return Promise.reject(new LlmError(
        `llm-provider-hub: no gateway for provider route "${provider}"; add it in the plugin settings`,
        'UNKNOWN_MODEL',
      ));
    }
    const entry = catalogEntryFor(gw, model, this.deps.preset(provider));
    if (entry === undefined) {
      return Promise.reject(new LlmError(
        `llm-provider-hub: model "${model}" is not enabled on gateway "${provider}"; enable it in the provider-hub plugin settings`,
        'UNKNOWN_MODEL',
      ));
    }
    const info: LlmResolvedModelInfo = {
      provider,
      id: model,
      name: entry.name,
      context: { contextWindow: entry.contextWindow },
      defaultMaxTokens: entry.maxTokens,
      ...(entry.input === undefined ? {} : { inputModalities: [...entry.input] }),
    };
    const reasoning = reasoningMetadata(entry);
    if (reasoning !== undefined) info.reasoning = reasoning;
    return Promise.resolve(info);
  }

  async prepareCall(provider: string, model: string, signal?: AbortSignal) {
    const modelInfo = await this.resolveModel(provider, model, signal);
    return {
      model: modelInfo,
      stream: (options: GenerateOptions): AsyncIterable<StreamChunk> => this.stream(options),
    };
  }

  async *stream(options: GenerateOptions): AsyncGenerator<StreamChunk> {
    const provider = options.provider;
    const gw = provider !== undefined ? this.deps.gatewayFor(provider) : undefined;
    if (gw === undefined) {
      yield errorFinish(`llm-provider-hub: no gateway for provider route "${provider ?? ''}"; add it in the plugin settings`);
      return;
    }
    if (gw.baseURL === undefined || gw.baseURL.trim() === '') {
      yield errorFinish(`llm-provider-hub: baseURL is not set for gateway "${provider}"; configure it in the plugin settings`);
      return;
    }
    let apiKey: string;
    try {
      apiKey = await this.deps.resolveApiKey(gw);
    } catch (error) {
      yield errorFinish(error instanceof Error ? error.message : String(error));
      return;
    }
    const headers: Record<string, string> = {
      'user-agent': gw.userAgent,
      ...gw.extraHeaders,
    };
    const baseURL = gw.baseURL.replace(/\/+$/, '');
    if (gw.api === 'openai-completions') {
      yield* this.streamOpenAI(options, gw, baseURL, headers, apiKey);
      return;
    }
    yield* this.streamAnthropic(options, gw, baseURL, headers, apiKey);
  }

  private static readonly ANTHROPIC_THINKING_BUDGET: Record<string, number> = {
    low: 1024,
    medium: 4096,
    high: 8192,
    xhigh: 16384,
    max: 24576,
  };

  private anthropicThinkingFor(effort: string): { type: 'enabled'; budget_tokens: number } | undefined {
    if (effort === 'off') return undefined;
    const budget = GatewayAdapter.ANTHROPIC_THINKING_BUDGET[effort] ?? 4096;
    return { type: 'enabled', budget_tokens: budget };
  }

  private async *streamAnthropic(
    options: GenerateOptions,
    gw: GatewayConfig,
    baseURL: string,
    headers: Record<string, string>,
    apiKey: string,
  ): AsyncGenerator<StreamChunk> {
    // When anthropicThinking is enabled, map reasoningEffort -> Anthropic thinking.
    // Anthropic requires max_tokens > budget_tokens; adjust upward when needed.
    const effort = options.reasoningEffort as string | undefined;
    const thinking = gw.anthropicThinking && effort !== undefined && effort !== 'off'
      ? this.anthropicThinkingFor(effort)
      : undefined;
    let maxTokens = options.maxTokens ?? 4096;
    if (thinking !== undefined && maxTokens <= thinking.budget_tokens) {
      maxTokens = thinking.budget_tokens + 1024;
    }
    const body = {
      model: options.model,
      max_tokens: maxTokens,
      ...(options.temperature === undefined ? {} : { temperature: options.temperature }),
      ...(thinking === undefined ? {} : { thinking }),
      messages: toAnthropicMessages(options.messages),
      ...(options.system === undefined ? {} : { system: options.system }),
      ...(options.tools !== undefined && options.tools.length > 0 ? { tools: toAnthropicTools(options.tools) } : {}),
      stream: true,
    };
    const posted = await this.post(`${baseURL}/v1/messages`, {
      ...headers,
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    }, body, options.signal);
    if (!posted.ok) {
      yield errorFinish(posted.message);
      return;
    }
    yield* anthropicSseToChunks(posted.response, options.signal);
  }

  private async *streamOpenAI(
    options: GenerateOptions,
    gw: GatewayConfig,
    baseURL: string,
    headers: Record<string, string>,
    apiKey: string,
  ): AsyncGenerator<StreamChunk> {
    const reasoningEffort = options.reasoningEffort;
    const converted = toOpenAIMessages(options.messages);
    const system = options.system;
    const body = {
      model: options.model,
      max_tokens: options.maxTokens ?? 4096,
      ...(options.temperature === undefined ? {} : { temperature: options.temperature }),
      ...(reasoningEffort !== undefined && reasoningEffort !== 'off' ? { reasoning_effort: reasoningEffort } : {}),
      messages: system === undefined ? converted : [{ role: gw.systemRole, content: system }, ...converted],
      ...(options.tools !== undefined && options.tools.length > 0 ? { tools: toOpenAITools(options.tools) } : {}),
      stream: true,
    };
    const posted = await this.post(`${baseURL}/v1/chat/completions`, {
      ...headers,
      'content-type': 'application/json',
      authorization: `Bearer ${apiKey}`,
    }, body, options.signal);
    if (!posted.ok) {
      yield errorFinish(posted.message);
      return;
    }
    yield* openaiCompletionsToChunks(posted.response, options.signal);
  }

  /**
   * POST one JSON body to the upstream. Transport failures surface as an
   * error finish chunk; HTTP errors surface as an error finish chunk with
   * the upstream status/message.
   */
  private async post(
    url: string,
    headers: Record<string, string>,
    body: unknown,
    signal?: AbortSignal,
  ): Promise<{ ok: true; response: Response } | { ok: false; message: string }> {
    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        ...(signal === undefined ? {} : { signal }),
      });
    } catch (error) {
      return { ok: false, message: `fetch failed: ${error instanceof Error ? error.message : String(error)}` };
    }
    if (!response.ok) {
      const text = await response.text().catch(() => '');
      return { ok: false, message: `upstream ${response.status}: ${text.slice(0, 300)}` };
    }
    return { ok: true, response };
  }
}
