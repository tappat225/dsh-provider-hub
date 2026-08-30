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
 * the DSH StreamChunk protocol. The three supported protocols share the same
 * takeover and the same unified endpoint resolver (auto /v1-normalization or
 * custom complete-URL dialing): anthropic-messages, openai-completions, and
 * openai-responses.
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
import { catalogEntryFor, gatewayModelDefaults, reasoningMetadata, resolveModelEntries } from './catalog.ts';
import { effectiveUserAgent, type GatewayConfig, type WireConfig } from './types.ts';
import { effectiveEndpointMode, redactUrl, resolveEndpointUrl } from './url.ts';
import { errorFinish } from './wire/sse.ts';
import { anthropicSseToChunks, toAnthropicMessages, toAnthropicTools } from './wire/anthropic.ts';
import { openaiCompletionsToChunks, toOpenAIMessages, toOpenAITools } from './wire/openai.ts';
import { responsesSseToChunks, toResponsesInput, toResponsesTools } from './wire/responses.ts';

/**
 * Header names `extraHeaders` may never place on the wire, matched
 * case-insensitively against the header NAME. Three groups:
 *   - credentials: `authorization`, `proxy-authorization`, `x-api-key`,
 *     `cookie` — must never override the protocol-correct auth added per path,
 *     nor smuggle a cross-protocol credential (e.g. a stale Bearer onto the
 *     Anthropic path, or a stale x-api-key onto an OpenAI path);
 *   - protocol pins: `anthropic-version`, `content-type` — set by the adapter
 *     to the protocol-correct values;
 *   - transport-managed: `content-length`, `content-encoding`,
 *     `transfer-encoding`, `connection`, `host` (framing/routing derived from
 *     the serialized request) and `user-agent` (the gateway's configured UA,
 *     applied by the adapter right after sanitization).
 */
const RESERVED_HEADERS: ReadonlySet<string> = new Set([
  'authorization',
  'proxy-authorization',
  'x-api-key',
  'cookie',
  'anthropic-version',
  'content-type',
  'content-length',
  'content-encoding',
  'transfer-encoding',
  'connection',
  'host',
  'user-agent',
]);

/**
 * Copy `extraHeaders` without the reserved headers above (case-insensitive on
 * the header name; values are untouched). Returns a fresh object the caller
 * owns, so the authoritative auth/UA/protocol headers can be added afterwards
 * without an extraHeaders entry ever winning. Shared by the adapter wire paths
 * and model discovery.
 */
export function sanitizeExtraHeaders(extraHeaders: Record<string, string> | undefined): Record<string, string> {
  const clean: Record<string, string> = {};
  for (const [name, value] of Object.entries(extraHeaders ?? {})) {
    if (RESERVED_HEADERS.has(name.toLowerCase())) continue;
    clean[name] = value;
  }
  return clean;
}

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
    // defaultMaxTokens is a REQUEST default, not a capability display: only a
    // user-declared capacity (an explicit override or custom-entry maxTokens)
    // serves as the default. Inherited catalog values and gateway-default
    // fills do not — the fallback chain is the gateway's defaultMaxTokens,
    // then the historical 4096 floor.
    const defaults = gatewayModelDefaults(gw);
    const defaultMaxTokens = entry.maxTokensExplicit === true && entry.maxTokens !== undefined
      ? entry.maxTokens
      : defaults.maxTokens ?? 4096;
    const info: LlmResolvedModelInfo = {
      provider,
      id: model,
      name: entry.name,
      // Context capacity rides along only when resolution produced one (a
      // capacity-less custom entry with no gateway default omits the field).
      ...(entry.contextWindow === undefined ? {} : { context: { contextWindow: entry.contextWindow } }),
      defaultMaxTokens,
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
      // Custom mode may leave baseURL empty (the chat request dials the
      // complete `endpoint` field instead); only auto mode requires it up front.
      if (effectiveEndpointMode(gw.endpointMode) !== 'custom') {
        yield errorFinish(`llm-provider-hub: baseURL is not set for gateway "${provider}"; configure it in the plugin settings`);
        return;
      }
    } else {
      // Wire-input sanity: refuse a non-http(s) URL before any credential work
      // so the failure names the misconfiguration instead of surfacing as an
      // opaque fetch error. (The unified endpoint resolver re-validates every
      // resolved URL — including the custom-mode `endpoint` field — with
      // credential redaction.)
      try {
        const parsed = new URL(gw.baseURL);
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') throw new Error('unsupported scheme');
      } catch {
        yield errorFinish(`llm-provider-hub: baseURL "${redactUrl(gw.baseURL)}" for gateway "${provider}" must be a valid http(s) URL`);
        return;
      }
    }
    // Wire-input sanity: refuse an unknown protocol value, a non-http(s) URL,
    // and header-injecting (CR/LF-carrying) UA/header values BEFORE any
    // credential work, so the failure names the misconfiguration instead of
    // surfacing as an opaque fetch error.
    if (gw.api !== 'openai-completions' && gw.api !== 'openai-responses' && gw.api !== 'anthropic-messages') {
      yield errorFinish(`llm-provider-hub: gateway "${provider}" has an unknown api protocol "${String(gw.api)}"; use "anthropic-messages", "openai-completions" or "openai-responses"`);
      return;
    }
    const userAgent = effectiveUserAgent(gw.userAgent);
    if (/[\r\n]/.test(userAgent)) {
      yield errorFinish(`llm-provider-hub: gateway "${provider}" userAgent must not contain line breaks`);
      return;
    }
    for (const [name, value] of Object.entries(gw.extraHeaders ?? {})) {
      if (/[\r\n]/.test(name) || /[\r\n]/.test(value)) {
        yield errorFinish(`llm-provider-hub: gateway "${provider}" extraHeaders.${name} must not contain line breaks`);
        return;
      }
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
    // Sanitize extraHeaders FIRST (case-insensitive, shared with discovery):
    // credential/protocol/transport-critical names are dropped so they can
    // neither override the protocol-correct auth added per path below nor
    // smuggle a cross-protocol credential onto the wire (e.g. a stale
    // x-api-key on an OpenAI path, a stale Bearer on the Anthropic path).
    // The gateway's configured UA is applied right after and always wins.
    const headers = sanitizeExtraHeaders(gw.extraHeaders);
    headers['user-agent'] = userAgent;
    if (gw.api === 'openai-completions') {
      yield* this.streamOpenAI(options, gw, headers, apiKey, wireEffort);
      return;
    }
    if (gw.api === 'openai-responses') {
      yield* this.streamResponses(options, gw, headers, apiKey, wireEffort);
      return;
    }
    yield* this.streamAnthropic(options, gw, headers, apiKey, thinkingLevel);
  }

  /** Anthropic's built-in thinking budget table, matching pi-ai defaults. */
  private static readonly ANTHROPIC_THINKING_BUDGET: Record<string, number> = {
    minimal: 512,
    low: 1024,
    medium: 4096,
    high: 8192,
    xhigh: 16384,
    max: 24576,
  };

  /**
   * Per-request output cap when the caller (DSH) sends none: the gateway's
   * `defaultMaxTokens`, else the historical 4096 floor. Applied on all three
   * wire paths so every protocol still carries a reasonable max token.
   */
  private requestMaxTokens(gw: GatewayConfig): number {
    return gatewayModelDefaults(gw).maxTokens ?? 4096;
  }

  /** One endpoint resolution surfaced as an error finish (message already redacted by the resolver). */
  private endpointOrFinish(provider: string | undefined, gw: GatewayConfig, path: '/chat/completions' | '/responses' | '/messages'): { url: string } | { fail: StreamChunk } {
    const resolved = resolveEndpointUrl(gw, path);
    if (resolved.ok) return { url: resolved.url };
    return { fail: errorFinish(`llm-provider-hub: gateway "${provider ?? ''}": ${resolved.error}`) };
  }

  private async *streamAnthropic(
    options: GenerateOptions,
    gw: GatewayConfig,
    headers: Record<string, string>,
    apiKey: string,
    thinkingLevel: string | undefined,
  ): AsyncGenerator<StreamChunk> {
    // Anthropic's native path automatically treats every selected non-off
    // reasoning level as enabled thinking; the adapter owns the canonical
    // level-to-budget mapping, so there is no per-gateway configuration.
    const budgets = GatewayAdapter.ANTHROPIC_THINKING_BUDGET;
    let thinking: { type: 'enabled'; budget_tokens: number } | undefined;
    if (thinkingLevel !== undefined) {
      const budget = budgets[thinkingLevel];
      if (budget === undefined) {
        yield errorFinish(
          `llm-provider-hub: model "${options.model}" declares effort "${thinkingLevel}", but Anthropic thinking has no built-in budget for it`,
          'UNSUPPORTED_REASONING_EFFORT',
        );
        return;
      }
      thinking = { type: 'enabled', budget_tokens: budget };
    }
    let maxTokens = options.maxTokens ?? this.requestMaxTokens(gw);
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
    // The unified endpoint resolver: auto mode normalizes /v1 (both
    // `https://gw.example.com` and `https://gw.example.com/v1` work); custom
    // mode dials the complete `endpoint` URL verbatim.
    const endpoint = this.endpointOrFinish(options.provider, gw, '/messages');
    if ('fail' in endpoint) {
      yield endpoint.fail;
      return;
    }
    const posted = await this.post(endpoint.url, {
      ...headers,
      // Added AFTER the merged headers: extraHeaders cannot override the
      // credential/protocol-critical auth of the anthropic-messages path.
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    }, body, options.signal, apiKey);
    if (!posted.ok) {
      yield errorFinish(posted.message);
      return;
    }
    yield* anthropicSseToChunks(posted.response, options.signal);
  }

  private async *streamOpenAI(
    options: GenerateOptions,
    gw: GatewayConfig,
    headers: Record<string, string>,
    apiKey: string,
    wireEffort: string | undefined,
  ): AsyncGenerator<StreamChunk> {
    const converted = toOpenAIMessages(options.messages);
    const system = options.system;
    const body = {
      model: options.model,
      max_tokens: options.maxTokens ?? this.requestMaxTokens(gw),
      ...(options.temperature === undefined ? {} : { temperature: options.temperature }),
      // The declared wire spelling, not the canonical level id: a map like
      // `{ high: 'ultra' }` sends `reasoning_effort: "ultra"`; a valueless
      // `off` (and no effort at all) omits the parameter.
      ...(wireEffort === undefined ? {} : { reasoning_effort: wireEffort }),
      messages: system === undefined ? converted : [{ role: gw.systemRole, content: system }, ...converted],
      ...(options.tools !== undefined && options.tools.length > 0 ? { tools: toOpenAITools(options.tools) } : {}),
      stream: true,
      // Ask the gateway for the final usage chunk (OpenAI stream_options
      // semantics). Opt out per gateway: strict OpenAI-compatible servers
      // reject unknown body parameters.
      ...(gw.streamUsage === false ? {} : { stream_options: { include_usage: true } }),
    };
    const endpoint = this.endpointOrFinish(options.provider, gw, '/chat/completions');
    if ('fail' in endpoint) {
      yield endpoint.fail;
      return;
    }
    const posted = await this.post(endpoint.url, {
      ...headers,
      // Added AFTER the merged headers: extraHeaders cannot override auth.
      'content-type': 'application/json',
      authorization: `Bearer ${apiKey}`,
    }, body, options.signal, apiKey);
    if (!posted.ok) {
      yield errorFinish(posted.message);
      return;
    }
    yield* openaiCompletionsToChunks(posted.response, options.signal);
  }

  private async *streamResponses(
    options: GenerateOptions,
    gw: GatewayConfig,
    headers: Record<string, string>,
    apiKey: string,
    wireEffort: string | undefined,
  ): AsyncGenerator<StreamChunk> {
    const converted = toResponsesInput(options.messages);
    // System/developer instruction: the system slot plus any system-role
    // conversation text, combined. systemRole 'developer' sends it as a
    // developer-role input item; the default 'system' uses the Responses
    // top-level `instructions` parameter.
    const systemText = [options.system, converted.systemText]
      .filter((part): part is string => typeof part === 'string' && part.trim() !== '')
      .join('\n');
    let input: unknown = converted.input;
    let instructions: string | undefined;
    if (systemText !== '') {
      if (gw.systemRole === 'developer') {
        input = [{ role: 'developer', content: [{ type: 'input_text', text: systemText }] }, ...converted.input];
      } else {
        instructions = systemText;
      }
    }
    const body = {
      model: options.model,
      // The Responses parameter spelling (NOT the Chat `max_tokens`).
      max_output_tokens: options.maxTokens ?? this.requestMaxTokens(gw),
      ...(options.temperature === undefined ? {} : { temperature: options.temperature }),
      // Effort values come from the same reasoningEfforts wire-spelling map as
      // the Chat path; the Responses endpoint carries them in its native
      // `reasoning.effort` slot. A valueless `off` (and no effort at all)
      // omits the parameter.
      ...(wireEffort === undefined ? {} : { reasoning: { effort: wireEffort } }),
      ...(instructions === undefined ? {} : { instructions }),
      input,
      ...(options.tools !== undefined && options.tools.length > 0 ? { tools: toResponsesTools(options.tools) } : {}),
      stream: true,
      // NOTE: no `stream_options` — that parameter is Chat Completions-only
      // and strict Responses endpoints reject it. Usage arrives on the
      // terminal response event regardless (the streamUsage flag governs the
      // Chat path's stream_options only).
    };
    const endpoint = this.endpointOrFinish(options.provider, gw, '/responses');
    if ('fail' in endpoint) {
      yield endpoint.fail;
      return;
    }
    const posted = await this.post(endpoint.url, {
      ...headers,
      // Added AFTER the merged headers: extraHeaders cannot override auth.
      'content-type': 'application/json',
      authorization: `Bearer ${apiKey}`,
    }, body, options.signal, apiKey);
    if (!posted.ok) {
      yield errorFinish(posted.message);
      return;
    }
    yield* responsesSseToChunks(posted.response, options.signal);
  }

  /**
   * POST one JSON body to the upstream. Transport failures surface as an
   * error finish chunk; HTTP errors surface as an error finish chunk with the
   * upstream status/message. `redact` (the API key) is scrubbed from any
   * upstream-echoed text so a misconfigured gateway cannot bounce the
   * credential back into the DSH error surface.
   */
  private async post(
    url: string,
    headers: Record<string, string>,
    body: unknown,
    signal?: AbortSignal,
    redact?: string,
  ): Promise<{ ok: true; response: Response } | { ok: false; message: string }> {
    const scrub = (text: string): string =>
      redact === undefined || redact === '' || !text.includes(redact) ? text : text.split(redact).join('***');
    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        ...(signal === undefined ? {} : { signal }),
      });
    } catch (error) {
      return { ok: false, message: `fetch failed: ${scrub(error instanceof Error ? error.message : String(error))}` };
    }
    if (!response.ok) {
      let text = await response.text().catch(() => '');
      text = scrub(text);
      return { ok: false, message: `upstream ${response.status}: ${text.slice(0, 300)}` };
    }
    return { ok: true, response };
  }
}
