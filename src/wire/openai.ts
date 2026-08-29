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
import type { StreamChunk, ToolSchema, TokenUsage } from '@deepseek-ai/dsh-llm';
import type { OpenAIChatChunk, OpenAIChatUsage, WireInputMessage } from '../types.ts';
import { errorFinish, iterateSse } from './sse.ts';

/** Convert DSH provider-neutral messages into OpenAI chat messages (plain text). */
export function toOpenAIMessages(messages: readonly WireInputMessage[]): Array<{ role: string; content: string }> {
  return messages.map((message) => {
    const blocks = typeof message.content === 'string'
      ? [{ type: 'text' as const, text: message.content }]
      : (message.content as Array<{ type?: string; text?: string; callId?: string; content?: unknown }>);
    const text = (blocks ?? []).map((block) => {
      if (block.type === 'text') return block.text ?? '';
      if (block.type === 'reasoning') return '';
      if (block.type === 'tool-call') return '';
      if (block.type === 'tool-result') {
        const payload = typeof block.content === 'string' ? block.content : JSON.stringify(block.content ?? '');
        return `[tool result of ${block.callId ?? '?'}: ${payload}]`;
      }
      return '';
    }).filter((part) => part.length > 0).join('\n');
    return { role: message.role === 'assistant' ? 'assistant' : 'user', content: text };
  });
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
