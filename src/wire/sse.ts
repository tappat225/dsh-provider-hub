/**
 * Shared wire helpers: a minimal SSE parser over a web ReadableStream and
 * the terminal error finish chunk.
 *
 * @module dsh-provider-hub/wire/sse
 */
import type { StreamChunk } from '@deepseek-ai/dsh-llm';
import type { ProviderErrorPayload } from '../types.ts';
import {
  ABORTED_CODE,
  UPSTREAM_ERROR_CODE,
  classifyProviderError,
  classifyProviderErrorPayload,
  type FailureFacts,
} from './failure.ts';

/** One parsed SSE record. */
export interface SseRecord {
  event: string;
  data: string;
}

/**
 * Minimal SSE parser over a web ReadableStream, yielding {event, data} records.
 *
 * Framing follows the SSE spec so gateways that deviate from bare-LF still
 * parse: a line ends with CRLF, LF, or a lone CR (streams may mix them), and a
 * CRLF pair split across two read chunks is still one terminator. A blank line
 * closes the pending event; consecutive `data:` lines are joined with '\n';
 * comment lines (`:...`) and `id`/`retry` fields carry no payload here. The
 * trailing event of a body that ends without a final blank line is flushed at
 * end-of-stream, so abrupt upstream responses still surface their last event.
 */
export async function* iterateSse(response: Response, signal?: AbortSignal): AsyncGenerator<SseRecord> {
  // `signal` stays in the signature for call-site compatibility: aborts surface
  // through the rejected reader.read() below (fetch is signalled upstream), and
  // early exit releases the reader lock in the finally block.
  void signal;
  const reader = response.body?.getReader();
  if (reader === undefined) return;
  const decoder = new TextDecoder();
  let buffer = '';
  let event = 'message';
  let data: string[] = [];
  /** Events closed while parsing the current chunk, drained before the next read. */
  const closed: SseRecord[] = [];

  /** Ingest one terminated line (no trailing CR/LF); '' closes the pending event. */
  const ingest = (line: string): void => {
    if (line === '') {
      if (data.length > 0) closed.push({ event, data: data.join('\n') });
      event = 'message';
      data = [];
      return;
    }
    const colon = line.indexOf(':');
    const field = colon === -1 ? line : line.slice(0, colon);
    let value = colon === -1 ? '' : line.slice(colon + 1);
    if (value.startsWith(' ')) value = value.slice(1);
    if (field === 'event') {
      if (value !== '') event = value;
    } else if (field === 'data') {
      data.push(value);
    }
  };

  /**
   * Pop the next terminated line from the buffer. A trailing lone CR stays
   * buffered while more chunks may follow (it may pair with the next chunk's
   * leading LF); at EOF it terminates the line.
   */
  const nextLine = (atEof: boolean): string | undefined => {
    const nl = buffer.indexOf('\n');
    const cr = buffer.indexOf('\r');
    if (nl === -1 && cr === -1) return undefined;
    if (cr !== -1 && (nl === -1 || cr < nl)) {
      if (cr === buffer.length - 1 && !atEof) return undefined;
      const line = buffer.slice(0, cr);
      buffer = buffer.startsWith('\n', cr + 1) ? buffer.slice(cr + 2) : buffer.slice(cr + 1);
      return line;
    }
    const line = buffer.slice(0, nl);
    buffer = buffer.slice(nl + 1);
    return line;
  };

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      for (let line = nextLine(false); line !== undefined; line = nextLine(false)) ingest(line);
      if (closed.length > 0) yield* closed.splice(0);
    }
    // EOF: flush the decoder, drain the final terminated lines, then flush the
    // residual (unterminated) event the upstream ended without a blank line.
    buffer += decoder.decode();
    for (let line = nextLine(true); line !== undefined; line = nextLine(true)) ingest(line);
    if (buffer.length > 0) ingest(buffer);
    if (data.length > 0) closed.push({ event, data: data.join('\n') });
    if (closed.length > 0) yield* closed.splice(0);
  } finally {
    reader.releaseLock();
  }
}

/**
 * Terminal error finish chunk.
 *
 * `code` is the failure's ROUTING identity, not decoration: the host's retry
 * executor re-attempts the step only when the code is a member of the route
 * policy's retryable set (EMPTY_RESPONSE / RATE_LIMIT / SERVER / TIMEOUT /
 * TRANSPORT by default). Classify with `./failure.ts` rather than passing a
 * blanket code, or a transient upstream failure ends the turn instead of being
 * retried. The blanket default stays for genuinely unclassifiable upstreams.
 *
 * `facts` carries the structured provider details (HTTP status, a capped
 * Retry-After delay) the executor and the failure surface can use.
 */
export function errorFinish(message: string, code = UPSTREAM_ERROR_CODE, facts: FailureFacts = {}): StreamChunk {
  return {
    type: 'finish',
    reason: { kind: 'error', failure: { code, message, ...facts } },
  };
}

/**
 * Terminal aborted finish chunk for a CALLER cancellation. Reported distinctly
 * from an error because it is not a failure: the user stopped the request, and
 * no retry policy may act on it.
 */
export function abortedFinish(message = 'aborted'): StreamChunk {
  return {
    type: 'finish',
    reason: { kind: 'aborted', failure: { code: ABORTED_CODE, message } },
  };
}

/**
 * Terminal error finish for a failure the upstream reported INSIDE the
 * response stream. `raw` is the unparsed event data: JSON when the gateway
 * follows its protocol's error shape, plain text when it streams a bare
 * message instead. Both are read for the failure message and classified, so a
 * transient in-stream relay failure is retried rather than ending the turn.
 */
export function providerErrorFinish(raw: string): StreamChunk {
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { parsed = undefined; }
  if (parsed !== null && typeof parsed === 'object') {
    const classified = classifyProviderErrorPayload(parsed as ProviderErrorPayload, raw);
    return errorFinish(classified.message, classified.code);
  }
  const message = raw === '' ? 'the upstream reported an error inside the response stream' : raw;
  return errorFinish(message, classifyProviderError(undefined, message).code);
}
