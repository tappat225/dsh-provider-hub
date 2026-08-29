/**
 * Anthropic-messages wire protocol: DSH provider-neutral messages -> wire
 * body pieces, and the SSE response -> DSH StreamChunk conversion.
 *
 * @module dsh-provider-hub/wire/anthropic
 */
import type { ContentBlock, StreamChunk, ToolSchema } from '@deepseek-ai/dsh-llm';
import type { AnthropicSsePayload, WireInputMessage } from '../types.ts';
import { errorFinish, iterateSse } from './sse.ts';

interface AnthropicTextPart { type: 'text'; text: string }
interface AnthropicImagePart {
  type: 'image';
  source: { type: 'base64'; media_type: string; data: string };
}
interface AnthropicToolResultPart {
  type: 'tool_result';
  tool_use_id: string;
  is_error?: boolean;
  content: string;
}
interface AnthropicToolUsePart {
  type: 'tool_use';
  id: string;
  name: string;
  input: Record<string, unknown>;
}
type AnthropicContentPart = AnthropicTextPart | AnthropicImagePart | AnthropicToolResultPart | AnthropicToolUsePart;

export interface AnthropicWireMessage {
  role: 'user' | 'assistant';
  content: AnthropicContentPart[];
}

function safeJsonParse(text: string): Record<string, unknown> {
  try { return JSON.parse(text) as Record<string, unknown>; } catch { return {}; }
}

/**
 * Convert DSH provider-neutral messages into Anthropic wire messages.
 * Text / reasoning / tool-call / tool-result blocks are mapped; image blocks
 * are sent only when the block carries inline base64 source data (durable
 * attachment references require the attachment service and are skipped).
 */
export function toAnthropicMessages(messages: readonly WireInputMessage[]): AnthropicWireMessage[] {
  const wire: AnthropicWireMessage[] = [];
  for (const message of messages) {
    const blocks: readonly ContentBlock[] | string = message.content as readonly ContentBlock[] | string;
    const list: readonly ContentBlock[] = typeof blocks === 'string'
      ? [{ type: 'text', text: blocks }]
      : blocks;
    if (message.role === 'user') {
      const content: AnthropicContentPart[] = [];
      for (const block of list) {
        if (block.type === 'text') {
          content.push({ type: 'text', text: block.text });
        } else if (block.type === 'image') {
          const source = extractInlineImage(block);
          if (source !== undefined) content.push({ type: 'image', source });
        } else if (block.type === 'tool-result') {
          content.push({
            type: 'tool_result',
            tool_use_id: block.toolCallId,
            ...(block.isError ? { is_error: true } : {}),
            content: serializeToolResult(block.content),
          });
        }
        // reasoning blocks inside user messages are dropped (never legal on the wire)
      }
      wire.push({ role: 'user', content });
    } else if (message.role === 'assistant') {
      const content: AnthropicContentPart[] = [];
      for (const block of list) {
        if (block.type === 'text') {
          content.push({ type: 'text', text: block.text });
        } else if (block.type === 'reasoning') {
          // Some gateways echo reasoning back as text; harmless either way.
          content.push({ type: 'text', text: block.text });
        } else if (block.type === 'tool-call') {
          content.push({
            type: 'tool_use',
            id: block.id,
            name: block.name,
            input: safeJsonParse(block.arguments ?? '{}'),
          });
        }
      }
      wire.push({ role: 'assistant', content });
    }
  }
  return wire;
}

function extractInlineImage(block: ContentBlock & { type: 'image' }): AnthropicImagePart['source'] | undefined {
  // Adapters receiving inline base64 usually expose it as `source`; durable
  // references (ImageAttachmentRef) carry no payload and are skipped.
  const candidate = (block as unknown as { source?: unknown }).source;
  if (typeof candidate === 'string' && candidate.length > 0) {
    return {
      type: 'base64',
      media_type: (block as unknown as { mediaType?: string }).mediaType ?? 'image/png',
      data: candidate,
    };
  }
  if (candidate !== null && typeof candidate === 'object') {
    const obj = candidate as { type?: unknown; media_type?: unknown; data?: unknown };
    if (obj.type === 'base64' && typeof obj.data === 'string' && obj.data.length > 0) {
      return {
        type: 'base64',
        media_type: typeof obj.media_type === 'string' ? obj.media_type : 'image/png',
        data: obj.data,
      };
    }
  }
  return undefined;
}

function serializeToolResult(content: unknown): string {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content.map((part) => {
      if (part !== null && typeof part === 'object' && (part as { type?: string }).type === 'text') {
        return (part as { text?: string }).text ?? '';
      }
      return JSON.stringify(part);
    }).join('\n');
  }
  return JSON.stringify(content ?? '');
}

/** Convert DSH tool definitions into Anthropic tool shape. */
export function toAnthropicTools(tools: readonly ToolSchema[] | undefined): Array<{
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}> {
  return (tools ?? []).map((tool) => ({
    name: tool.name,
    description: tool.description ?? '',
    input_schema: tool.parameters ?? { type: 'object', properties: {} },
  }));
}

interface PartialBlock {
  blockType: 'text' | 'reasoning' | 'tool-call';
  text: string;
  toolId?: string;
  toolName?: string;
  arguments: string;
}

/**
 * Convert an Anthropic SSE response into the DSH StreamChunk protocol.
 * Text / thinking / streaming tool_use blocks are all supported; the stream
 * always terminates with a `finish` chunk (stop / max-tokens / error / aborted).
 */
export async function* anthropicSseToChunks(response: Response, signal?: AbortSignal): AsyncGenerator<StreamChunk> {
  const partials = new Map<number, PartialBlock>();
  let sawStop = false;
  try {
    for await (const sse of iterateSse(response, signal)) {
      if (sse.event === 'error') {
        yield errorFinish(sse.data);
        return;
      }
      let payload: AnthropicSsePayload;
      try { payload = JSON.parse(sse.data) as AnthropicSsePayload; } catch { continue; }
      switch (payload.type) {
        case 'content_block_start': {
          const index = payload.index;
          if (payload.content_block.type === 'tool_use') {
            partials.set(index, {
              blockType: 'tool-call',
              text: '',
              toolId: payload.content_block.id,
              toolName: payload.content_block.name,
              arguments: '',
            });
            yield { type: 'block-start', index, blockType: 'tool-call' };
          } else if (payload.content_block.type === 'text') {
            partials.set(index, { blockType: 'text', text: '', arguments: '' });
            yield { type: 'block-start', index, blockType: 'text' };
          } else if (payload.content_block.type === 'thinking') {
            partials.set(index, { blockType: 'reasoning', text: '', arguments: '' });
            yield { type: 'block-start', index, blockType: 'reasoning' };
          }
          break;
        }
        case 'content_block_delta': {
          const index = payload.index;
          const partial = partials.get(index);
          if (partial === undefined) break;
          if (payload.delta.type === 'text_delta' && payload.delta.text !== undefined) {
            partial.text += payload.delta.text;
            yield { type: 'text-delta', index, text: payload.delta.text };
          } else if (payload.delta.type === 'thinking_delta' && payload.delta.thinking !== undefined) {
            partial.text += payload.delta.thinking;
            yield { type: 'reasoning-delta', index, text: payload.delta.thinking };
          } else if (payload.delta.type === 'input_json_delta' && payload.delta.partial_json !== undefined) {
            partial.arguments += payload.delta.partial_json;
            yield {
              type: 'tool-call-delta',
              index,
              id: partial.toolId as never,
              name: partial.toolName,
              argumentsDelta: payload.delta.partial_json,
            };
          }
          break;
        }
        case 'content_block_stop': {
          const index = payload.index;
          const partial = partials.get(index);
          if (partial === undefined) break;
          const block: ContentBlock = partial.blockType === 'tool-call'
            ? { type: 'tool-call', id: partial.toolId as never, name: partial.toolName ?? '', arguments: partial.arguments }
            : partial.blockType === 'reasoning'
              ? { type: 'reasoning', text: partial.text }
              : { type: 'text', text: partial.text };
          yield { type: 'block-end', index, block };
          partials.delete(index);
          break;
        }
        case 'message_delta': {
          if (payload.usage !== undefined) {
            yield {
              type: 'usage',
              usage: {
                inputTokens: payload.usage.input_tokens ?? 0,
                outputTokens: payload.usage.output_tokens ?? 0,
                ...(payload.usage.cache_read_input_tokens === undefined ? {} : { cacheReadTokens: payload.usage.cache_read_input_tokens }),
                ...(payload.usage.cache_creation_input_tokens === undefined ? {} : { cacheWriteTokens: payload.usage.cache_creation_input_tokens }),
              },
            };
          }
          if (payload.delta?.stop_reason === 'max_tokens') {
            yield { type: 'finish', reason: { kind: 'max-tokens' } };
            sawStop = true;
            return;
          }
          break;
        }
        case 'message_stop': {
          yield { type: 'finish', reason: { kind: 'stop' } };
          sawStop = true;
          return;
        }
        default:
          break;
      }
    }
  } catch (error) {
    if (signal?.aborted) yield { type: 'finish', reason: { kind: 'aborted', failure: { code: 'ABORTED', message: 'aborted' } } };
    else yield errorFinish(error instanceof Error ? error.message : String(error));
    return;
  }
  if (!sawStop) yield { type: 'finish', reason: { kind: 'stop' } };
}
