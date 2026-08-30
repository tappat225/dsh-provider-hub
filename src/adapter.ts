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
import { effectiveUserAgent, type GatewayConfig, type WireConfig } from './types.ts';
import { joinEndpoint } from './url.ts';
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
    return Promise.resolve(resolveModelEntries(gw).map((entry) => ({
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
    const entry = catalogEntryFor(gw, model);
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
    // Dispatch needs the model's reasoning-effort map, so the entry must
    // resolve before any credential work — and a model that is not enabled
    // fails here with the same message resolveModel would throw.
    const entry = catalogEntryFor(gw, options.model);
    if (entry === undefined) {
      yield errorFinish(
        `llm-provider-hub: model "${options.model}" is not enabled on gateway "${provider}"; enable it in the provider-hub plugin settings`,
        'UNKNOWN_MODEL',
      );
      return;
    }
    // Effort resolution per the reasoning map's semantics (key = selector
    // level, value = wire spelling): a level the map does not declare is
    // refused BEFORE network I/O instead of reaching the gateway; a valueless
    // `off` sends nothing; `off` with a value sends that value; every other
    // declared level dispatches its wire spelling.
    const effort = options.reasoningEffort as string | undefined;
    let wireEffort: string | undefined;
    let thinkingLevel: string | undefined;
    if (effort !== undefined) {
      const map = entry.reasoning;
      if (map === undefined || !Object.prototype.hasOwnProperty.call(map, effort)) {
        const offered = map === undefined ? 'none' : Object.keys(map).join(', ');
        yield errorFinish(
          `llm-provider-hub: model "${options.model}" on gateway "${provider}" does not support reasoning effort "${effort}" (offered: ${offered})`,
          'UNSUPPORTED_REASONING_EFFORT',
        );
        return;
      }
      const wire = map[effort];
      if (typeof wire === 'string') wireEffort = wire;
      if (effort !== 'off') thinkingLevel = effort;
    }
    let apiKey: string;
    try {
      apiKey = await this.deps.resolveApiKey(gw);
    } catch (error) {
      yield errorFinish(error instanceof Error ? error.message : String(error));
      return;
    }
    const headers: Record<string, string> = {
      'user-agent': effectiveUserAgent(gw.userAgent),
      ...gw.extraHeaders,
    };
    const baseURL = gw.baseURL.replace(/\/+$/, '');
    if (gw.api === 'openai-completions') {
      yield* this.streamOpenAI(options, gw, baseURL, headers, apiKey, wireEffort);
      return;
    }
    yield* this.streamAnthropic(options, gw, baseURL, headers, apiKey, thinkingLevel);
  }

  /** Anthropic thinking budget (tokens) per selector level. */
  private static readonly ANTHROPIC_THINKING_BUDGET: Record<string, number> = {
    minimal: 512,
    low: 1024,
    medium: 4096,
    high: 8192,
    xhigh: 16384,
    max: 24576,
  };

  private async *streamAnthropic(
    options: GenerateOptions,
    gw: GatewayConfig,
    baseURL: string,
    headers: Record<string, string>,
    apiKey: string,
    thinkingLevel: string | undefined,
  ): AsyncGenerator<StreamChunk> {
    // When anthropicThinking is enabled, the validated effort level maps to
    // Anthropic thinking through the budget table. Anthropic requires
    // max_tokens > budget_tokens; adjust upward when needed. An effort whose
    // level has no budget mapping is refused before the request instead of
    // silently taking a fallback budget.
    let thinking: { type: 'enabled'; budget_tokens: number } | undefined;
    if (gw.anthropicThinking && thinkingLevel !== undefined) {
      const budget = GatewayAdapter.ANTHROPIC_THINKING_BUDGET[thinkingLevel];
      if (budget === undefined) {
        yield errorFinish(
          `llm-provider-hub: model "${options.model}" declares effort "${thinkingLevel}", but the anthropicThinking passthrough has no budget mapped for it`
            + ` (mapped levels: ${Object.keys(GatewayAdapter.ANTHROPIC_THINKING_BUDGET).join(', ')}); use a standard level or disable anthropicThinking`,
          'UNSUPPORTED_REASONING_EFFORT',
        );
        return;
      }
      thinking = { type: 'enabled', budget_tokens: budget };
    }
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
    // joinEndpoint accepts both `https://gw.example.com` and
    // `https://gw.example.com/v1` (an explicit /vN root is never doubled).
    const posted = await this.post(joinEndpoint(baseURL, '/messages'), {
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
    wireEffort: string | undefined,
  ): AsyncGenerator<StreamChunk> {
    const converted = toOpenAIMessages(options.messages);
    const system = options.system;
    const body = {
      model: options.model,
      max_tokens: options.maxTokens ?? 4096,
      ...(options.temperature === undefined ? {} : { temperature: options.temperature }),
      // The declared wire spelling, not the canonical level id: a map like
      // `{ high: 'ultra' }` sends `reasoning_effort: "ultra"`; a valueless
      // `off` (and no effort at all) omits the parameter.
      ...(wireEffort === undefined ? {} : { reasoning_effort: wireEffort }),
      messages: system === undefined ? converted : [{ role: gw.systemRole, content: system }, ...converted],
      ...(options.tools !== undefined && options.tools.length > 0 ? { tools: toOpenAITools(options.tools) } : {}),
      stream: true,
    };
    const posted = await this.post(joinEndpoint(baseURL, '/chat/completions'), {
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
