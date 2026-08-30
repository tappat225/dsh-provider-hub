/**
 * OpenAI-completions wire protocol: DSH provider-neutral messages -> wire
 * body pieces, and the SSE response -> DSH StreamChunk conversion.
 *
 * Supports text, `reasoning_content`, and streaming `tool_calls` deltas;
 * each logical block (text / reasoning / one tool call) gets its own DSH
 * block index.
 *
 * @module dsh-provider-hub/wire/openai
 */
import type { ContentBlock, StreamChunk, ToolSchema, TokenUsage } from '@deepseek-ai/dsh-llm';
import type { OpenAIChatChunk, OpenAIChatUsage, WireInputMessage } from '../types.ts';
import { errorFinish, iterateSse } from './sse.ts';

/**
 * One OpenAI chat wire message (the subset this adapter emits). Tool
 * correlation follows the OpenAI protocol: an assistant message that requests
 * tool executions carries `tool_calls[]`, and every result comes back as its
 * own `role: 'tool'` message with `tool_call_id` set to the matching call id.
 */
export interface OpenAIWireMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  /** Text content; `null` on assistant messages that only carry tool_calls. */
  content: string | null;
  /** Present on assistant messages that request tool executions. */
  tool_calls?: Array<{
    id: string;
    type: 'function';
    function: { name: string; arguments: string };
  }>;
  /** Present on tool-role messages; correlates with the assistant call id. */
  tool_call_id?: string;
}

/** Tool correlation id off a tool-result block, tolerating a legacy `callId` spelling. */
function toolResultCallId(block: Extract<ContentBlock, { type: 'tool-result' }>): string {
  const structural = block as unknown as { toolCallId?: unknown; callId?: unknown };
  const id = structural.toolCallId ?? structural.callId;
  return typeof id === 'string' ? id : '';
}

/** Serialize tool-result content into the flat text a `tool` message carries. */
function toolResultText(content: unknown): string {
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

/**
 * Convert DSH provider-neutral messages into OpenAI chat messages. Multi-turn
 * tool use maps losslessly onto the OpenAI protocol: assistant `tool-call`
 * blocks become `tool_calls`, user `tool-result` blocks become one `tool`
 * message per call id, text blocks keep their roles, reasoning blocks are
 * dropped (no OpenAI replay slot), and image blocks carry no inline payload.
 */
export function toOpenAIMessages(messages: readonly WireInputMessage[]): OpenAIWireMessage[] {
  const wire: OpenAIWireMessage[] = [];
  for (const message of messages) {
    const raw = message.content;
    const blocks: readonly ContentBlock[] = typeof raw === 'string'
      ? [{ type: 'text', text: raw }]
      : Array.isArray(raw) ? (raw as readonly ContentBlock[]) : [];
    if (message.role === 'assistant') {
      const texts: string[] = [];
      const toolCalls: NonNullable<OpenAIWireMessage['tool_calls']> = [];
      for (const block of blocks) {
        if (block.type === 'text') {
          if (block.text !== '') texts.push(block.text);
        } else if (block.type === 'tool-call') {
          toolCalls.push({
            id: block.id,
            type: 'function',
            function: { name: block.name, arguments: toolArguments(block.arguments) },
          });
        }
        // reasoning / image blocks have no OpenAI wire representation here.
      }
      if (texts.length > 0 || toolCalls.length > 0) {
        wire.push({
          role: 'assistant',
          content: texts.length > 0 ? texts.join('\n') : null,
          ...(toolCalls.length > 0 ? { tool_calls: toolCalls } : {}),
        });
      }
      continue;
    }
    // user/system: text accumulates into one message; every tool-result
    // becomes its own `tool` message so tool_call_id correlation stays intact.
    const role = message.role === 'system' ? 'system' : 'user';
    let texts: string[] = [];
    const flushText = (): void => {
      if (texts.length > 0) {
        wire.push({ role, content: texts.join('\n') });
        texts = [];
      }
    };
    for (const block of blocks) {
      if (block.type === 'text') {
        if (block.text !== '') texts.push(block.text);
      } else if (block.type === 'tool-result') {
        flushText();
        wire.push({ role: 'tool', tool_call_id: toolResultCallId(block), content: toolResultText(block.content) });
      }
    }
    flushText();
  }
  return wire;
}

/** OpenAI function-tool shape. */
export function toOpenAITools(tools: readonly ToolSchema[] | undefined): Array<{
  type: 'function';
  function: { name: string; description: string; parameters: Record<string, unknown> };
}> {
  return (tools ?? []).map((tool) => ({
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description ?? '',
      parameters: tool.parameters ?? { type: 'object', properties: {} },
    },
  }));
}

interface ToolCallPartial {
  dshIndex: number;
  id: string;
  name: string;
  arguments: string;
}

/**
 * Map an OpenAI usage block to the DSH TokenUsage vocabulary.
 *
 * OpenAI-compatible streams report cached input inside `prompt_tokens`
 * (a merged total); TokenUsage requires DISJOINT counts, so the cached
 * portion is split out via `prompt_tokens_details.cached_tokens`
 * (DeepSeek's convention) and reported as `cacheReadTokens`.
 */
export function toTokenUsage(usage: OpenAIChatUsage | undefined): TokenUsage | undefined {
  if (usage === undefined) return undefined;
  const total = usage.prompt_tokens ?? 0;
  const cached = usage.prompt_tokens_details?.cached_tokens ?? 0;
  const uncached = Math.max(0, total - cached);
  return {
    inputTokens: uncached,
    outputTokens: usage.completion_tokens ?? 0,
    ...(cached > 0 ? { cacheReadTokens: cached } : {}),
  };
}

/**
 * Convert an OpenAI chat.completion.chunk SSE stream into DSH StreamChunks.
 * Text / reasoning_content / streaming tool_calls each map to their own
 * block; usage from the final chunk is emitted as a `usage` chunk before the
 * terminal `finish`.
 */
export async function* openaiCompletionsToChunks(response: Response, signal?: AbortSignal): AsyncGenerator<StreamChunk> {
  let nextIndex = 0;
  let textIndex = -1;
  let reasoningIndex = -1;
  let text = '';
  let reasoning = '';
  let sawText = false;
  let sawReasoning = false;
  let sawToolCall = false;
  let finished = false;
  let usage: TokenUsage | undefined;
  const toolCalls = new Map<number, ToolCallPartial>();
  try {
    for await (const sse of iterateSse(response, signal)) {
      if (sse.data === '[DONE]') break;
      let payload: OpenAIChatChunk;
      try { payload = JSON.parse(sse.data) as OpenAIChatChunk; } catch { continue; }
      if (payload.usage !== undefined) usage = toTokenUsage(payload.usage);
      const choice = payload.choices?.[0];
      if (finished) continue;
      const delta = choice?.delta;
      if (delta === undefined) continue;
      if (delta.reasoning_content !== undefined) {
        if (reasoningIndex < 0) reasoningIndex = nextIndex++;
        sawReasoning = true;
        reasoning += delta.reasoning_content;
        yield { type: 'reasoning-delta', index: reasoningIndex, text: delta.reasoning_content };
        continue;
      }
      if (delta.content !== undefined) {
        if (textIndex < 0) textIndex = nextIndex++;
        sawText = true;
        text += delta.content;
        yield { type: 'text-delta', index: textIndex, text: delta.content };
      }
      if (delta.tool_calls !== undefined) {
        for (const call of delta.tool_calls) {
          if (call === undefined) continue;
          const wireIndex = call.index ?? 0;
          let partial = toolCalls.get(wireIndex);
          if (partial === undefined) {
            partial = { dshIndex: nextIndex++, id: call.id ?? '', name: '', arguments: '' };
            toolCalls.set(wireIndex, partial);
            sawToolCall = true;
            yield { type: 'block-start', index: partial.dshIndex, blockType: 'tool-call' };
            if (call.id !== undefined) {
              partial.id = call.id;
              yield { type: 'tool-call-delta', index: partial.dshIndex, id: call.id as never, argumentsDelta: '' };
            }
          }
          if (call.function?.name !== undefined && partial.name === '') {
            partial.name = call.function.name;
            yield { type: 'tool-call-delta', index: partial.dshIndex, id: partial.id as never, name: partial.name, argumentsDelta: '' };
          }
          if (call.function?.arguments !== undefined) {
            partial.arguments += call.function.arguments;
            yield { type: 'tool-call-delta', index: partial.dshIndex, id: partial.id as never, name: partial.name, argumentsDelta: call.function.arguments };
          }
        }
      }
      if (choice?.finish_reason === 'tool_calls') {
        // Tool blocks are flushed below; stop processing deltas but keep
        // reading so a trailing usage chunk is still captured.
        finished = true;
      }
    }
  } catch (error) {
    if (signal?.aborted) yield { type: 'finish', reason: { kind: 'aborted', failure: { code: 'ABORTED', message: 'aborted' } } };
    else yield errorFinish(error instanceof Error ? error.message : String(error));
    return;
  }
  // Close blocks in DSH index order (reasoning/text/tools may interleave).
  const closes: StreamChunk[] = [];
  if (sawReasoning) closes.push({ type: 'block-end', index: reasoningIndex, block: { type: 'reasoning', text: reasoning } });
  if (sawText) closes.push({ type: 'block-end', index: textIndex, block: { type: 'text', text } });
  for (const partial of [...toolCalls.values()].sort((a, b) => a.dshIndex - b.dshIndex)) {
    closes.push({
      type: 'block-end',
      index: partial.dshIndex,
      block: { type: 'tool-call', id: partial.id as never, name: partial.name, arguments: partial.arguments },
    });
  }
  for (const chunk of closes.sort((a, b) => (a as { index: number }).index - (b as { index: number }).index)) yield chunk;
  if (usage !== undefined) yield { type: 'usage', usage };
  yield {
    type: 'finish',
    reason: sawToolCall ? { kind: 'tool-calls' } : { kind: 'stop' },
  };
}
