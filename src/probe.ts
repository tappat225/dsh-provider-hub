/**
 * Connection probe, stage 2: send ONE real "hi" chat request through a
 * gateway's current preferred model and judge connectivity from the
 * response. The settings page's Test button runs the models listing FIRST
 * (src/discovery.ts); this chat probe is the FALLBACK for gateways whose
 * /models endpoint is absent or gated — what actually matters there is the
 * chat path, so the probe dials exactly the wire path the live adapter
 * uses: protocol-correct auth, the gateway's custom User-Agent, the unified
 * endpoint resolver (auto /v1 normalization or a verbatim custom URL), and
 * streaming SSE.
 *
 * Failure surfaces as an LlmError with a user-facing, credential-redacted
 * message (the runtime combines it with the stage-1 failure); success
 * returns the dialed endpoint, round-trip latency, the probed model, a
 * capped reply snippet, and (when the gateway reported it) token usage.
 *
 * @module dsh-provider-hub/probe
 */
import { LlmError, type StreamChunk } from '@deepseek-ai/dsh-llm';
import { sanitizeExtraHeaders } from './adapter.ts';
import { effectiveUserAgent, type GatewayConfig } from './types.ts';
import { redactUrl, resolveEndpointUrl } from './url.ts';
import { anthropicSseToChunks, toAnthropicMessages } from './wire/anthropic.ts';
import { openaiCompletionsToChunks, toOpenAIMessages } from './wire/openai.ts';
import { responsesSseToChunks, toResponsesInput } from './wire/responses.ts';

/**
 * Output cap for the probe request. A "hi" answer needs no more, and the cap
 * bounds both cost and probe latency (the reply is judged, not collected).
 */
const PROBE_MAX_TOKENS = 64;

/** Longest reply snippet carried back to the settings-page banner. */
const REPLY_SNIPPET_MAX = 120;

/** The one probe message: minimal, model-agnostic, cheap. */
const PROBE_MESSAGES: ReadonlyArray<{ role: 'user'; content: string }> = [{ role: 'user', content: 'hi' }];

/** Successful probe outcome (failures throw LlmError with a user-facing message). */
export interface ChatProbeResult {
  /** Redacted chat endpoint URL actually dialed. */
  endpoint: string;
  /** Request → stream end, in milliseconds. */
  latencyMs: number;
  /** Model id the probe sent. */
  model: string;
  /** Reply text (whitespace-collapsed, capped); empty when the model returned none. */
  reply: string;
  /** Token usage when the gateway reported it. */
  usage?: { inputTokens: number; outputTokens: number };
}

/** Collapse whitespace and cap the reply snippet for display. */
function snippet(text: string): string {
  const collapsed = text.replace(/\s+/g, ' ').trim();
  return collapsed.length > REPLY_SNIPPET_MAX ? `${collapsed.slice(0, REPLY_SNIPPET_MAX)}…` : collapsed;
}

/**
 * Probe one gateway with a real minimal chat request. `model` is the
 * preferred model id (chosen by the caller — the settings page sends the
 * editor's first model row, or the gateway's first resolved entry); it is
 * dispatched verbatim so an UNSAVED draft model id can be tested too.
 * `resolveApiKey` follows the same chain the live adapter uses; a resolve
 * failure probes unauthenticated and lets the response judge (mirrors model
 * discovery — local no-auth gateways stay testable).
 */
export async function probeChatConnection(
  gw: GatewayConfig,
  model: string,
  resolveApiKey: () => Promise<string>,
  signal?: AbortSignal,
): Promise<ChatProbeResult> {
  if (gw.api !== 'anthropic-messages' && gw.api !== 'openai-completions' && gw.api !== 'openai-responses') {
    throw new LlmError(`gateway "${gw.provider}" has an unknown api protocol "${String(gw.api)}"; use "anthropic-messages", "openai-completions" or "openai-responses"`, 'UPSTREAM_ERROR');
  }
  const path = gw.api === 'anthropic-messages' ? '/messages' : gw.api === 'openai-responses' ? '/responses' : '/chat/completions';
  // The unified endpoint resolver: auto mode derives the chat path from
  // baseURL with /v1 normalization; custom mode dials the complete
  // `endpoint` URL verbatim. Errors arrive pre-redacted.
  const resolved = resolveEndpointUrl(gw, path);
  if (!resolved.ok) {
    throw new LlmError(`gateway "${gw.provider}": ${resolved.error}`, 'UPSTREAM_ERROR');
  }
  const url = resolved.url;
  let supplied: string | undefined;
  try {
    supplied = await resolveApiKey();
  } catch {
    supplied = undefined; // probe unauthenticated when no key resolves
  }
  // extraHeaders merge FIRST, sanitized (case-insensitive, same reserved set
  // as the adapter wire paths): credential/protocol/transport-critical names
  // are dropped BEFORE the authoritative values are set, so they can neither
  // override the protocol-correct auth below nor smuggle a cross-protocol
  // credential onto the wire. The gateway's configured UA is applied right
  // after and always wins.
  const headers = sanitizeExtraHeaders(gw.extraHeaders);
  headers['user-agent'] = effectiveUserAgent(gw.userAgent);
  headers['content-type'] = 'application/json';
  if (gw.api === 'anthropic-messages') {
    if (supplied !== undefined && supplied !== '') headers['x-api-key'] = supplied;
    headers['anthropic-version'] = '2023-06-01';
  } else if (supplied !== undefined && supplied !== '') {
    headers.authorization = `Bearer ${supplied}`;
  }
  // Minimal protocol-correct body: one "hi" user message, a small output
  // cap, streaming. No system prompt, no tools, no reasoning effort — the
  // probe exercises the plain chat path every real request shares.
  const body = gw.api === 'anthropic-messages'
    ? {
      model,
      max_tokens: PROBE_MAX_TOKENS,
      messages: toAnthropicMessages(PROBE_MESSAGES),
      stream: true,
    }
    : gw.api === 'openai-responses'
      ? {
        model,
        max_output_tokens: PROBE_MAX_TOKENS,
        input: toResponsesInput(PROBE_MESSAGES).input,
        stream: true,
      }
      : {
        model,
        max_tokens: PROBE_MAX_TOKENS,
        messages: toOpenAIMessages(PROBE_MESSAGES),
        stream: true,
        // Mirror the adapter: strict gateways reject the parameter, so the
        // per-gateway opt-out applies to the probe too.
        ...(gw.streamUsage === false ? {} : { stream_options: { include_usage: true } }),
      };
  const started = Date.now();
  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      ...(signal === undefined ? {} : { signal }),
    });
  } catch (error) {
    if (signal?.aborted) throw new LlmError('probe aborted by caller', 'ABORTED', { cause: error });
    throw new LlmError(`could not reach ${redactUrl(url)}`, 'UPSTREAM_ERROR', { cause: error });
  }
  if (!response.ok) {
    let text = await response.text().catch(() => '');
    // Scrub an upstream-echoed credential (the adapter does the same): a
    // misconfigured gateway must not bounce the API key into the banner.
    if (supplied !== undefined && supplied !== '' && text.includes(supplied)) {
      text = text.split(supplied).join('***');
    }
    throw new LlmError(
      `upstream ${response.status}${response.status === 401 || response.status === 403 ? '; check the API key' : ''}: ${text.slice(0, 300)}`,
      'UPSTREAM_ERROR',
    );
  }
  // Consume the SAME SSE→StreamChunk converter the live adapter uses and
  // judge from the stream: an error/aborted finish fails the probe; any
  // other terminal chunk (stop / max-tokens / tool-calls) proves the whole
  // chain. A stream that carries no model output at all (a 200 with a
  // non-SSE body — e.g. a UA-gate HTML page) is a FAILURE, not a pass.
  const chunks: AsyncGenerator<StreamChunk> = gw.api === 'anthropic-messages'
    ? anthropicSseToChunks(response, signal)
    : gw.api === 'openai-responses'
      ? responsesSseToChunks(response, signal)
      : openaiCompletionsToChunks(response, signal);
  let reply = '';
  let sawOutput = false;
  let usage: { inputTokens: number; outputTokens: number } | undefined;
  for await (const chunk of chunks) {
    if (chunk.type === 'text-delta') {
      sawOutput = true;
      reply += chunk.text;
    } else if (chunk.type === 'usage') {
      sawOutput = true;
      usage = { inputTokens: chunk.usage.inputTokens ?? 0, outputTokens: chunk.usage.outputTokens ?? 0 };
    } else if (chunk.type === 'finish') {
      const reason = chunk.reason;
      if (reason.kind === 'error') {
        throw new LlmError(reason.failure?.message ?? 'the model stream ended with an error', 'UPSTREAM_ERROR');
      }
      if (reason.kind === 'aborted') throw new LlmError('probe aborted by caller', 'ABORTED');
      if (!sawOutput) {
        throw new LlmError(`${redactUrl(url)} answered, but the response stream carried no model output`, 'UPSTREAM_ERROR');
      }
      return {
        endpoint: redactUrl(url),
        latencyMs: Date.now() - started,
        model,
        reply: snippet(reply),
        ...(usage === undefined ? {} : { usage }),
      };
    } else {
      // block-start / block-end / reasoning / tool-call deltas: real stream
      // content — proof enough even when no text block ever opens.
      sawOutput = true;
    }
  }
  // The converters always terminate with a finish chunk; reaching here means
  // the stream ended without one (defensive, never expected).
  throw new LlmError(`${redactUrl(url)} closed the response without a terminal event`, 'UPSTREAM_ERROR');
}
