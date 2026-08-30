/**
 * Shared wire helpers: a minimal SSE parser over a web ReadableStream and
 * the terminal error finish chunk.
 *
 * @module dsh-provider-hub/wire/sse
 */
import type { StreamChunk } from '@deepseek-ai/dsh-llm';

/** One parsed SSE record. */
export interface SseRecord {
  event: string;
  data: string;
}

/** Minimal SSE parser over a web ReadableStream, yielding {event, data} records. */
export async function* iterateSse(response: Response, signal?: AbortSignal): AsyncGenerator<SseRecord> {
  const reader = response.body?.getReader();
  if (reader === undefined) return;
  const decoder = new TextDecoder();
  let buffer = '';
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let idx: number;
      while ((idx = buffer.indexOf('\n\n')) !== -1) {
        const raw = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 2);
        let event = 'message';
        const data: string[] = [];
        for (const line of raw.split('\n')) {
          if (line.startsWith('event:')) event = line.slice(6).trim();
          else if (line.startsWith('data:')) data.push(line.slice(5).trim());
        }
        if (data.length > 0) yield { event, data: data.join('\n') };
      }
    }
  } finally {
    reader.releaseLock();
  }
}

/** Terminal error finish chunk carrying a readable message. */
export function errorFinish(message: string, code = 'UPSTREAM_ERROR'): StreamChunk {
  return {
    type: 'finish',
    reason: { kind: 'error', failure: { code, message } },
  };
}
