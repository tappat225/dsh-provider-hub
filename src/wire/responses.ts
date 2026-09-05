/**
 * OpenAI-responses wire protocol: DSH provider-neutral messages -> Responses
 * API request pieces, and the Responses SSE event stream -> DSH StreamChunk
 * conversion.
 *
 * Request side (Responses protocol structure, NOT the Chat Completions shapes):
 *   - conversation history rides in `input` as typed items: user text is
 *     `input_text`, assistant text is `output_text`, an assistant tool request
 *     is a top-level `function_call` item and its result a
 *     `function_call_output` item correlated by `call_id`;
 *   - system/developer instruction content is collected out of the
 *     conversation and returned separately (`systemText`), so the adapter can
 *     place it in the top-level `instructions` parameter or a `developer`-role
 *     input item per the gateway's systemRole;
 *   - tools use the flat Responses function shape
 *     (`{ type: 'function', name, description, parameters }`);
 *   - inline base64 image blocks map to `input_image` data URLs; blocks that
 *     only reference the durable attachment service carry no payload and are
 *     skipped (never fabricated).
 *
 * Response side: the SSE events the Responses API streams —
 * `response.created`, `response.output_item.added/done`,
 * `response.output_text.delta`, `response.refusal.delta`,
 * `response.reasoning_text.delta`, `response.reasoning_summary_text.delta`,
 * `response.function_call_arguments.delta/done`, `response.completed`,
 * `response.incomplete`, `response.failed`, `response.error` — map onto text /
 * reasoning / tool-call blocks. Tool blocks close at `response.output_item.done`
 * (the protocol's block-stop analog) and any block still open at stream end is
 * closed before the terminal chunks, so `response.completed` never discards
 * already-emitted chunks. The finish kind reflects the protocol's own stop
 * semantics: `tool-calls` when a function call streamed, `max-tokens` when the
 * response ended incomplete with `incomplete_details.reason === 'max_output_tokens'`,
 * `stop` otherwise. Every other ending is a CLASSIFIED failure (see
 * ./failure.ts) rather than a silent `stop`, because the host's retry executor
 * routes on the failure code alone: `response.failed` / `response.error` /
 * a data-`error` event map the upstream's own code onto a DSH code, a torn read
 * is a transport failure, a stream that never reached a terminal event is a
 * truncated reply, and a completed response that carried no output at all is
 * EMPTY_RESPONSE. Caller aborts produce an aborted finish, which is not a
 * failure and no policy may act on.
 *
 * @module dsh-provider-hub/wire/responses
 */
import type { ContentBlock, StreamChunk, TokenUsage, ToolSchema } from '@deepseek-ai/dsh-llm';
import type { WireInputMessage } from '../types.ts';
import { classifyProviderError, classifyStreamEnd, classifyTransportError } from './failure.ts';
import { abortedFinish, errorFinish, iterateSse } from './sse.ts';

// ---------------------------------------------------------------------------
// Request-side shapes
// ---------------------------------------------------------------------------

export interface ResponsesInputTextPart { type: 'input_text'; text: string }
/** Inline raster input; only produced when a block actually carries base64 data. */
export interface ResponsesInputImagePart { type: 'input_image'; image_url: string }
export interface ResponsesOutputTextPart { type: 'output_text'; text: string }

export interface ResponsesMessageItem {
  role: 'user' | 'assistant' | 'developer' | 'system';
  content: Array<ResponsesInputTextPart | ResponsesInputImagePart | ResponsesOutputTextPart>;
}

/** An assistant tool request replayed into `input` (top-level item, correlated by call_id). */
export interface ResponsesFunctionCallItem {
  type: 'function_call';
  call_id: string;
  name: string;
  arguments: string;
}

/** A tool result replayed into `input` (top-level item, correlated by call_id). */
export interface ResponsesFunctionCallOutputItem {
  type: 'function_call_output';
  call_id: string;
  output: string;
}

export type ResponsesInputItem = ResponsesMessageItem | ResponsesFunctionCallItem | ResponsesFunctionCallOutputItem;

export interface ResponsesTool {
  type: 'function';
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface ToResponsesInputResult {
  input: ResponsesInputItem[];
  /** System-role message text collected out of the conversation (joined with '\n'). */
  systemText: string;
}

/** Tool correlation id off a tool-result block, tolerating a legacy `callId` spelling. */
function resultCallId(block: Extract<ContentBlock, { type: 'tool-result' }>): string {
  const value = block as unknown as { toolCallId?: unknown; callId?: unknown };
  return typeof (value.toolCallId ?? value.callId) === 'string' ? String(value.toolCallId ?? value.callId) : '';
}

/** Serialize tool-result content into the flat text a function_call_output carries. */
function resultText(content: unknown): string {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content.map((part) => {
      if (part !== null && typeof part === 'object' && (part as { type?: unknown }).type === 'text') {
        return String((part as { text?: unknown }).text ?? '');
      }
      return JSON.stringify(part);
    }).join('\n');
  }
  return JSON.stringify(content ?? '');
}

/** OpenAI expects a JSON-object string even when the model produced no arguments. */
function toolArguments(arguments_: string | undefined): string {
  return arguments_ === undefined || arguments_.trim() === '' ? '{}' : arguments_;
}

/** Inline base64 payload off an image block as a data URL, or undefined when the block only references the attachment service. */
function inlineImageDataUrl(block: ContentBlock & { type: 'image' }): string | undefined {
  const candidate = (block as unknown as { source?: unknown }).source;
  if (typeof candidate === 'string' && candidate.length > 0) {
    const mediaType = (block as unknown as { mediaType?: string }).mediaType ?? 'image/png';
    return `data:${mediaType};base64,${candidate}`;
  }
  if (candidate !== null && typeof candidate === 'object') {
    const obj = candidate as { type?: unknown; media_type?: unknown; data?: unknown };
    if (obj.type === 'base64' && typeof obj.data === 'string' && obj.data.length > 0) {
      const mediaType = typeof obj.media_type === 'string' ? obj.media_type : 'image/png';
      return `data:${mediaType};base64,${obj.data}`;
    }
  }
  return undefined;
}

function blocksOf(raw: unknown): readonly ContentBlock[] {
  return typeof raw === 'string' ? [{ type: 'text', text: raw }] : Array.isArray(raw) ? (raw as readonly ContentBlock[]) : [];
}

/**
 * Convert DSH provider-neutral messages into Responses `input` items.
 * Multi-turn tool use maps losslessly (assistant `tool-call` -> `function_call`,
 * `tool-result` -> `function_call_output` correlated by call id); text blocks
 * keep their roles; reasoning blocks are dropped (no Responses replay slot);
 * system-role message text is collected into `systemText` for the caller to
 * place in `instructions` or a developer item; image blocks carry inline base64
 * when present and are silently skipped when they hold only an attachment
 * reference.
 */
export function toResponsesInput(messages: readonly WireInputMessage[]): ToResponsesInputResult {
  const input: ResponsesInputItem[] = [];
  const systemParts: string[] = [];
  for (const message of messages) {
    const blocks = blocksOf(message.content);
    if (message.role === 'system') {
      for (const block of blocks) {
        if (block.type === 'text' && block.text !== '') systemParts.push(block.text);
      }
      continue;
    }
    // user/assistant: text accumulates into one message item; tool-call /
    // tool-result blocks become their own top-level items so call_id
    // correlation stays intact.
    const role = message.role === 'assistant' ? 'assistant' : 'user';
    let parts: Array<ResponsesInputTextPart | ResponsesInputImagePart | ResponsesOutputTextPart> = [];
    const flushParts = (): void => {
      if (parts.length > 0) {
        input.push({ role, content: parts });
        parts = [];
      }
    };
    for (const block of blocks) {
      if (block.type === 'text') {
        if (block.text !== '') {
          parts.push(role === 'assistant'
            ? { type: 'output_text', text: block.text }
            : { type: 'input_text', text: block.text });
        }
      } else if (block.type === 'image') {
        const dataUrl = inlineImageDataUrl(block);
        if (dataUrl !== undefined) parts.push({ type: 'input_image', image_url: dataUrl });
        // attachment-ref-only blocks degrade: no payload, nothing fabricated.
      } else if (block.type === 'tool-call' && role === 'assistant') {
        flushParts();
        input.push({
          type: 'function_call',
          call_id: block.id,
          name: block.name,
          arguments: toolArguments(block.arguments),
        });
      } else if (block.type === 'tool-result') {
        flushParts();
        input.push({
          type: 'function_call_output',
          call_id: resultCallId(block),
          output: resultText(block.content),
        });
      }
      // reasoning blocks have no Responses wire representation here.
    }
    flushParts();
  }
  return { input, systemText: systemParts.join('\n') };
}

/** Convert DSH tool definitions into the flat Responses function-tool shape. */
export function toResponsesTools(tools: readonly ToolSchema[] | undefined): ResponsesTool[] {
  return (tools ?? []).map((tool) => ({
    type: 'function' as const,
    name: tool.name,
    description: tool.description ?? '',
    parameters: tool.parameters ?? { type: 'object', properties: {} },
  }));
}

// ---------------------------------------------------------------------------
// Response-side shapes (the subset we consume; unknown fields are ignored)
// ---------------------------------------------------------------------------

export interface ResponsesUsage {
  input_tokens?: number;
  output_tokens?: number;
  total_tokens?: number;
  input_tokens_details?: { cached_tokens?: number };
  output_tokens_details?: { reasoning_tokens?: number };
}

export interface ResponsesOutputItem {
  type?: string;
  id?: string;
  role?: string;
  call_id?: string;
  name?: string;
  arguments?: string;
}

export interface ResponsesResponseObject {
  status?: string;
  usage?: ResponsesUsage;
  incomplete_details?: { reason?: string };
  error?: { code?: string; message?: string } | null;
}

/** The Responses SSE payload subset this converter reads; `type` is authoritative. */
export interface ResponsesSsePayload {
  type?: string;
  item_id?: string;
  output_index?: number;
  call_id?: string;
  name?: string;
  delta?: string;
  arguments?: string;
  item?: ResponsesOutputItem;
  response?: ResponsesResponseObject;
  /** Terminal-event usage fallback: some gateways put `usage` at the top level. */
  usage?: ResponsesUsage;
  /** OpenAI-style error object riding a data-JSON `error` event. */
  error?: { code?: string; message?: string } | null;
  code?: string;
  message?: string;
}

/**
 * Map a Responses usage block to the DSH TokenUsage vocabulary.
 *
 * `input_tokens` folds cached input into the total (OpenAI semantics), so the
 * cached portion is split out via `input_tokens_details.cached_tokens` and
 * reported as the disjoint `cacheReadTokens`. `reasoning_tokens` is copied to
 * `reasoningTokens` only when numeric (uncertain fields are never guessed).
 * Tolerates Chat-shaped fallbacks (`prompt_tokens`/`completion_tokens`) for
 * gateways that bridge the two protocols. A block with no numeric tokens yields
 * undefined.
 */
export function toResponsesTokenUsage(usage: ResponsesUsage | undefined): TokenUsage | undefined {
  if (usage === undefined || usage === null || typeof usage !== 'object') return undefined;
  const raw = usage as ResponsesUsage & {
    prompt_tokens?: number;
    completion_tokens?: number;
    prompt_tokens_details?: { cached_tokens?: number };
  };
  const input = raw.input_tokens ?? raw.prompt_tokens;
  const output = raw.output_tokens ?? raw.completion_tokens;
  const cached = raw.input_tokens_details?.cached_tokens ?? raw.prompt_tokens_details?.cached_tokens;
  const reasoning = raw.output_tokens_details?.reasoning_tokens;
  if (typeof input !== 'number' && typeof output !== 'number' && typeof cached !== 'number') return undefined;
  const total = typeof input === 'number' ? input : 0;
  const uncached = Math.max(0, total - (typeof cached === 'number' ? cached : 0));
  return {
    inputTokens: uncached,
    outputTokens: typeof output === 'number' ? output : 0,
    ...(typeof cached === 'number' && cached > 0 ? { cacheReadTokens: cached } : {}),
    ...(typeof reasoning === 'number' && reasoning >= 0 ? { reasoningTokens: reasoning } : {}),
  };
}

interface ToolPartial {
  dshIndex: number;
  callId: string;
  name: string;
  arguments: string;
  closed: boolean;
  /** block-start has been emitted for this block (at most once per block). */
  started: boolean;
}

/**
 * Convert an OpenAI-responses SSE stream into DSH StreamChunks.
 *
 * Ordering guarantees: deltas are yielded as they arrive; tool blocks close at
 * `response.output_item.done`; any block still open at stream end (text /
 * reasoning / a tool whose done event never arrived) closes before the usage
 * and terminal finish chunks — `response.completed` can therefore never
 * discard already-emitted chunks. Finish kinds: `tool-calls` when any function
 * call streamed, `max-tokens` when incomplete with `max_output_tokens`,
 * `stop` otherwise; `response.failed` / `response.error` / a data-`error` event produce an error
 * finish; caller aborts produce an aborted finish.
 */
export async function* responsesSseToChunks(response: Response, signal?: AbortSignal): AsyncGenerator<StreamChunk> {
  let nextIndex = 0;
  let textIndex = -1;
  let reasoningIndex = -1;
  let text = '';
  let reasoning = '';
  let sawText = false;
  let sawReasoning = false;
  let sawToolCall = false;
  let terminal: 'completed' | 'incomplete' | 'failed' | undefined;
  let incompleteReason: string | undefined;
  let errorMessage: string | undefined;
  /** The upstream's own error code, mapped onto a DSH code at the terminal chunk. */
  let errorCode: string | undefined;
  let usage: TokenUsage | undefined;
  /** Streaming function-call blocks keyed by item id. */
  const toolPartials = new Map<string, ToolPartial>();
  /** item id by output index — `function_call_arguments.*` events carry both;
   * some shims drop `item_id`, so the output index is the fallback key. */
  const keyByOutputIndex = new Map<number, string>();

  const toolKey = (payload: ResponsesSsePayload): string => {
    if (typeof payload.item_id === 'string' && payload.item_id !== '') return payload.item_id;
    const outputIndex = typeof payload.output_index === 'number' ? payload.output_index : undefined;
    if (outputIndex !== undefined) {
      const mapped = keyByOutputIndex.get(outputIndex);
      if (mapped !== undefined) return mapped;
      const created = `output-${String(outputIndex)}`;
      keyByOutputIndex.set(outputIndex, created);
      return created;
    }
    return `anon-${String(nextIndex)}`;
  };

  /** Get-or-create the streaming tool block for one item key (defensive against
   * gateways that skip output_item.added). */
  const partialFor = (key: string, item?: ResponsesOutputItem): ToolPartial => {
    let partial = toolPartials.get(key);
    if (partial === undefined) {
      partial = {
        dshIndex: nextIndex++,
        callId: item?.call_id ?? '',
        name: item?.name ?? '',
        arguments: '',
        closed: false,
        started: false,
      };
      toolPartials.set(key, partial);
      sawToolCall = true;
      return partial;
    }
    return partial;
  };

  /**
   * Close every block still open, in DSH index order. Emitted before ANY
   * terminal chunk: a completed response, a failure, or an early stream end
   * must never discard the deltas already delivered above.
   */
  const closePending = (): StreamChunk[] => {
    const pending: StreamChunk[] = [];
    if (sawReasoning && reasoningIndex >= 0) {
      pending.push({ type: 'block-end', index: reasoningIndex, block: { type: 'reasoning', text: reasoning } });
    }
    if (sawText && textIndex >= 0) {
      pending.push({ type: 'block-end', index: textIndex, block: { type: 'text', text } });
    }
    for (const partial of [...toolPartials.values()].sort((a, b) => a.dshIndex - b.dshIndex)) {
      if (!partial.closed) {
        pending.push({
          type: 'block-end',
          index: partial.dshIndex,
          block: { type: 'tool-call', id: partial.callId as never, name: partial.name, arguments: toolArguments(partial.arguments) },
        });
      }
    }
    return pending;
  };

  try {
    for await (const sse of iterateSse(response, signal)) {
      let payload: ResponsesSsePayload | undefined;
      try {
        const parsed: unknown = JSON.parse(sse.data);
        payload = parsed !== null && typeof parsed === 'object' ? (parsed as ResponsesSsePayload) : undefined;
      } catch { payload = undefined; }
      if (payload === undefined) {
        // Non-JSON (or scalar) data: only the bare `event: error` framing is
        // meaningful here — some gateways stream the failure message as plain
        // text, so it becomes the error finish's message.
        if (sse.event === 'error') {
          terminal = 'failed';
          errorMessage = sse.data === '' ? undefined : sse.data;
          break;
        }
        continue;
      }
      // The data object's `type` field is authoritative; the SSE `event:` name
      // is the fallback for shims that omit it.
      const type = typeof payload.type === 'string' && payload.type !== '' ? payload.type : sse.event;
      switch (type) {
        case 'response.created':
        case 'response.in_progress':
        case 'response.queued':
          break;
        case 'response.output_item.added': {
          const item = payload.item ?? {};
          if (item.type === 'function_call') {
            const key = typeof item.id === 'string' && item.id !== '' ? item.id : toolKey(payload);
            // Always record the output_index -> key mapping: later
            // `function_call_arguments.*` events may drop `item_id` and can
            // only be correlated through the output index.
            if (typeof payload.output_index === 'number') keyByOutputIndex.set(payload.output_index, key);
            const partial = partialFor(key, item);
            if (partial.callId === '' && typeof item.call_id === 'string') partial.callId = item.call_id;
            if (partial.name === '' && typeof item.name === 'string') partial.name = item.name;
            if (typeof item.arguments === 'string' && item.arguments.length > partial.arguments.length) {
              partial.arguments = item.arguments;
            }
            if (!partial.started) {
              partial.started = true;
              yield { type: 'block-start', index: partial.dshIndex, blockType: 'tool-call' };
            }
            yield {
              type: 'tool-call-delta',
              index: partial.dshIndex,
              id: partial.callId as never,
              ...(partial.name === '' ? {} : { name: partial.name }),
              argumentsDelta: '',
            };
          }
          break;
        }
        case 'response.output_text.delta':
        case 'response.refusal.delta': {
          // A refusal is visible assistant text; map it honestly onto text.
          const delta = payload.delta;
          if (typeof delta !== 'string' || delta === '') break;
          if (textIndex < 0) textIndex = nextIndex++;
          sawText = true;
          text += delta;
          yield { type: 'text-delta', index: textIndex, text: delta };
          break;
        }
        case 'response.reasoning_text.delta':
        case 'response.reasoning_summary_text.delta': {
          const delta = payload.delta;
          if (typeof delta !== 'string' || delta === '') break;
          if (reasoningIndex < 0) reasoningIndex = nextIndex++;
          sawReasoning = true;
          reasoning += delta;
          yield { type: 'reasoning-delta', index: reasoningIndex, text: delta };
          break;
        }
        case 'response.function_call_arguments.delta': {
          const key = toolKey(payload);
          const partial = partialFor(key);
          if (partial.callId === '' && typeof payload.call_id === 'string') partial.callId = payload.call_id;
          if (partial.name === '' && typeof payload.name === 'string') partial.name = payload.name;
          // Gateways that skip output_item.added still get a block-start —
          // emitted exactly once per tool block.
          if (!partial.started) {
            partial.started = true;
            yield { type: 'block-start', index: partial.dshIndex, blockType: 'tool-call' };
          }
          const delta = payload.delta;
          if (typeof delta === 'string' && delta !== '') {
            partial.arguments += delta;
            yield {
              type: 'tool-call-delta',
              index: partial.dshIndex,
              id: partial.callId as never,
              name: partial.name,
              argumentsDelta: delta,
            };
          }
          break;
        }
        case 'response.function_call_arguments.done': {
          const key = toolKey(payload);
          const partial = partialFor(key);
          if (typeof payload.arguments === 'string' && payload.arguments.length > partial.arguments.length && !partial.closed) {
            // The done event finalized more arguments than the deltas carried
            // (dropped-delta recovery): surface the recovered tail as a delta
            // so consumers see the same incremental stream the protocol sent.
            const recovered = payload.arguments.slice(partial.arguments.length);
            partial.arguments = payload.arguments;
            yield {
              type: 'tool-call-delta',
              index: partial.dshIndex,
              id: partial.callId as never,
              name: partial.name,
              argumentsDelta: recovered,
            };
          }
          break;
        }
        case 'response.output_item.done': {
          const item = payload.item ?? {};
          if (item.type === 'function_call') {
            const key = typeof item.id === 'string' && item.id !== '' ? item.id : toolKey(payload);
            // Process only when the item is already streaming or carries a
            // usable identity — otherwise an anonymous done would fabricate an
            // empty tool block (and flip the finish kind to tool-calls).
            const hasIdentity = (typeof item.call_id === 'string' && item.call_id !== '')
              || (typeof item.name === 'string' && item.name !== '')
              || (typeof item.arguments === 'string' && item.arguments.trim() !== '');
            if (!toolPartials.has(key) && !hasIdentity) break;
            const partial = partialFor(key, item);
            if (typeof item.call_id === 'string' && item.call_id !== '') partial.callId = item.call_id;
            if (typeof item.name === 'string' && item.name !== '') partial.name = item.name;
            if (typeof item.arguments === 'string' && item.arguments.length > partial.arguments.length) {
              partial.arguments = item.arguments;
            }
            if (!partial.closed) {
              partial.closed = true;
              yield {
                type: 'block-end',
                index: partial.dshIndex,
                block: { type: 'tool-call', id: partial.callId as never, name: partial.name, arguments: toolArguments(partial.arguments) },
              };
            }
          }
          break;
        }
        // Explicitly-ignored protocol events (kept listed so a typo in a new
        // handler cannot silently regress into the default case).
        case 'response.output_text.done':
        case 'response.refusal.done':
        case 'response.reasoning_text.done':
        case 'response.reasoning_summary_text.done':
        case 'response.content_part.added':
        case 'response.content_part.done':
        case 'response.output_text.annotation.added':
        case 'response.reasoning_summary_part.added':
        case 'response.reasoning_summary_part.done':
          break;
        case 'response.completed': {
          usage = toResponsesTokenUsage(payload.response?.usage ?? payload.usage) ?? usage;
          terminal = 'completed';
          break;
        }
        case 'response.incomplete': {
          usage = toResponsesTokenUsage(payload.response?.usage ?? payload.usage) ?? usage;
          terminal = 'incomplete';
          incompleteReason = payload.response?.incomplete_details?.reason;
          break;
        }
        case 'response.failed': {
          usage = toResponsesTokenUsage(payload.response?.usage ?? payload.usage) ?? usage;
          terminal = 'failed';
          errorCode = payload.response?.error?.code ?? payload.code ?? errorCode;
          errorMessage = payload.response?.error?.message ?? payload.message ?? 'the upstream reported a failed response';
          break;
        }
        case 'response.error':
        case 'error': {
          // `response.error` is the protocol's own event; a bare `error` type
          // is the data-JSON error object some gateways emit instead.
          terminal = 'failed';
          errorCode = payload.code ?? payload.error?.code ?? errorCode;
          errorMessage = payload.message ?? payload.error?.message ?? payload.response?.error?.message
            ?? 'the upstream reported an error';
          break;
        }
        default:
          break;
      }
      if (terminal !== undefined) break;
    }
  } catch (error) {
    // A caller cancellation is not a failure: no retry policy may act on it.
    if (signal?.aborted) {
      yield abortedFinish();
      return;
    }
    const classified = classifyTransportError(error);
    yield* closePending();
    if (usage !== undefined) yield { type: 'usage', usage };
    yield errorFinish(classified.message, classified.code);
    return;
  }

  yield* closePending();
  if (usage !== undefined) yield { type: 'usage', usage };
  if (terminal === 'failed') {
    const message = errorMessage ?? 'the upstream reported a failed response';
    const classified = classifyProviderError(errorCode, message);
    // The mapped code is the ROUTING identity the host's retry executor reads;
    // the upstream's own spelling stays in the message so a gateway-specific
    // condition remains diagnosable after the mapping.
    const annotated = errorCode === undefined || errorCode === classified.code ? message : `${message} (${errorCode})`;
    yield errorFinish(annotated, classified.code);
    return;
  }
  if (terminal === 'incomplete') {
    if (incompleteReason === 'max_output_tokens' || incompleteReason === 'max_tokens') {
      yield { type: 'finish', reason: { kind: 'max-tokens' } };
      return;
    }
    yield errorFinish(
      `the upstream response ended incomplete${incompleteReason ? `: ${incompleteReason}` : ''}`,
      'INCOMPLETE_RESPONSE',
    );
    return;
  }
  // No `response.completed`: either the stream was cut mid-reply or the
  // upstream produced nothing at all. Both are classified failures, not a
  // `stop` that would present a truncated or empty answer as complete.
  const endFailure = classifyStreamEnd(terminal === 'completed', sawText || sawReasoning || sawToolCall);
  if (endFailure !== undefined) {
    yield errorFinish(endFailure.message, endFailure.code);
    return;
  }
  yield { type: 'finish', reason: sawToolCall ? { kind: 'tool-calls' } : { kind: 'stop' } };
}

// ---------------------------------------------------------------------------
// Contract-named exports (thin aliases). The task-facing API names the entry
// points `toOpenAIResponsesInput` / `toOpenAIResponsesTools` /
// `openaiResponsesToChunks`; the implementations above keep their fuller
// semantics (system-text collection, complete event coverage) and are
// re-exported here under the contract names.
// ---------------------------------------------------------------------------

/** Contract alias for {@link toResponsesInput}: the Responses `input` items only (system text rides `instructions`, see {@link toResponsesInput}). */
export function toOpenAIResponsesInput(messages: readonly WireInputMessage[]): ResponsesInputItem[] {
  return toResponsesInput(messages).input;
}

/** Contract alias for {@link toResponsesTools}. */
export function toOpenAIResponsesTools(tools: readonly ToolSchema[] | undefined): ResponsesTool[] {
  return toResponsesTools(tools);
}

/** Contract alias for {@link responsesSseToChunks}: the Responses SSE -> StreamChunk converter. */
export const openaiResponsesToChunks = responsesSseToChunks;
