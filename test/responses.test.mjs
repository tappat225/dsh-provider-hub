// Offline unit tests for the Responses wire layer (localhost streams only, no
// network):
//   1. Input conversion: system text collected out (rides `instructions`),
//      user/assistant text parts, assistant tool-call -> function_call,
//      tool-result -> function_call_output with call_id correlation (legacy
//      `callId` tolerated), empty arguments normalized, reasoning dropped.
//   2. Tool conversion: flat Responses function shape, parameter default.
//   3. Text SSE: output_text.delta stream, usage disjoint split on
//      response.completed, stop finish, unknown events skipped.
//   4. Function-args SSE over CRLF framing: output_item.added records
//      id/name, arguments deltas stream, done finalizes, tool-calls finish.
//   5. output_item.done closes the tool block before the terminal event.
//   6. incomplete -> max-tokens finish (usage still emitted).
//   7. response.failed / response.error / data-JSON `error` -> error finish;
//      bare `event: error` text framing stays compatible.
//   8. Unknown events / malformed data skipped safely.
//   9. block-start emitted exactly once (duplicate added tolerated; delta
//      without item_id reuses the partial via output_index; delta-only
//      streams still open the block).
//   10. output_item.done gating: identity-less unknown items ignored;
//       done-only items with identity close a block; empty args -> '{}'.
//   11. Top-level `usage` on completed/incomplete/failed honored when
//       response.usage is absent.
import {
  openaiResponsesToChunks,
  toOpenAIResponsesInput,
  toOpenAIResponsesTools,
  toResponsesInput,
} from '../src/wire/responses.ts';

let failures = 0;
function check(label, cond, detail = '') {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}${detail ? `  ${detail}` : ''}`);
  if (!cond) failures++;
}

const encoder = new TextEncoder();
function responseOf(chunks) {
  const stream = new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(typeof chunk === 'string' ? encoder.encode(chunk) : chunk);
      controller.close();
    },
  });
  return new Response(stream);
}
function eventOf(type, data) {
  return `event: ${type}\ndata: ${JSON.stringify({ type, ...data })}`;
}

// 1. Input conversion
const messages = [
  { role: 'system', content: 'sys prompt' },
  { role: 'user', content: 'pick a color' },
  { role: 'assistant', content: [
    { type: 'text', text: 'Let me check.' },
    { type: 'tool-call', id: 'call_1', name: 'lookup', arguments: '{"q":"blue"}' },
  ] },
  { role: 'user', content: [{ type: 'tool-result', toolCallId: 'call_1', content: [{ type: 'text', text: '#0000ff' }] }] },
  { role: 'user', content: [{ type: 'tool-result', toolCallId: 'call_2', content: 'plain' }, { type: 'tool-result', callId: 'call_3', content: { ok: true } }] },
  { role: 'assistant', content: [{ type: 'reasoning', text: 'hidden chain' }, { type: 'text', text: 'Blue.' }] },
  { role: 'assistant', content: [{ type: 'tool-call', id: 'call_4', name: 'finish', arguments: '' }] },
];
const converted = toResponsesInput(messages);
const input = toOpenAIResponsesInput(messages);

check('responses-input: contract alias matches core converter', JSON.stringify(input) === JSON.stringify(converted.input), JSON.stringify(input));
check('responses-input: system text collected for instructions', converted.systemText === 'sys prompt', JSON.stringify(converted.systemText));
check('responses-input: no system input item (rides instructions)', input.every((item) => item.role !== 'system'), JSON.stringify(input[0]));
check('responses-input: plain user text (input_text)', input[0]?.role === 'user' && input[0]?.content?.[0]?.type === 'input_text' && input[0]?.content?.[0]?.text === 'pick a color', JSON.stringify(input[0]));
check('responses-input: assistant text (output_text)', input[1]?.role === 'assistant' && input[1]?.content?.[0]?.type === 'output_text' && input[1]?.content?.[0]?.text === 'Let me check.', JSON.stringify(input[1]));
check('responses-input: assistant tool-call item', JSON.stringify(input[2]) === JSON.stringify({ type: 'function_call', call_id: 'call_1', name: 'lookup', arguments: '{"q":"blue"}' }), JSON.stringify(input[2]));
check('responses-input: tool result output item', input[3]?.type === 'function_call_output' && input[3]?.call_id === 'call_1' && input[3]?.output === '#0000ff', JSON.stringify(input[3]));
check('responses-input: multiple tool results in order (legacy callId tolerated)', input[4]?.call_id === 'call_2' && input[4]?.output === 'plain' && input[5]?.call_id === 'call_3' && input[5]?.output === '{"ok":true}', JSON.stringify([input[4], input[5]]));
check('responses-input: reasoning dropped from assistant', input[6]?.role === 'assistant' && input[6]?.content?.[0]?.text === 'Blue.' && input[6]?.type === undefined, JSON.stringify(input[6]));
check('responses-input: empty args normalized to {}', JSON.stringify(input[7]) === JSON.stringify({ type: 'function_call', call_id: 'call_4', name: 'finish', arguments: '{}' }), JSON.stringify(input[7]));
check('responses-input: no stray empty items', input.length === 8, `got ${input.length}`);

// 2. Tool conversion (flat Responses shape, unlike chat completions' nested function)
const tools = toOpenAIResponsesTools([
  { name: 'lookup', description: 'Look up a color', parameters: { type: 'object', properties: { q: { type: 'string' } } } },
  { name: 'bare', description: '', parameters: undefined },
]);
check('responses-tools: flat function shape', JSON.stringify(tools[0]) === JSON.stringify({ type: 'function', name: 'lookup', description: 'Look up a color', parameters: { type: 'object', properties: { q: { type: 'string' } } } }), JSON.stringify(tools[0]));
check('responses-tools: missing parameters defaults to empty object schema', JSON.stringify(tools[1]?.parameters) === JSON.stringify({ type: 'object', properties: {} }), JSON.stringify(tools[1]));
check('responses-tools: undefined tools -> empty list', toOpenAIResponsesTools(undefined).length === 0);

// 3. Text SSE: deltas stream, message item added emits nothing, completed
// carries the usage (cached input split out disjointly), finish stop last.
{
  const body = [
    eventOf('response.created', { response: { id: 'resp_1' } }),
    eventOf('response.output_item.added', { output_index: 0, item: { type: 'message', role: 'assistant', content: [] } }),
    eventOf('response.output_text.delta', { item_id: 'msg_1', output_index: 0, delta: 'Hel' }),
    eventOf('response.output_text.delta', { item_id: 'msg_1', output_index: 0, delta: 'lo' }),
    eventOf('response.completed', { response: { id: 'resp_1', usage: { input_tokens: 90, output_tokens: 10, input_tokens_details: { cached_tokens: 20 } } } }),
  ].join('\n\n') + '\n\n';
  const chunks = [];
  for await (const chunk of openaiResponsesToChunks(responseOf([body]))) chunks.push(chunk);
  check('responses-sse-text: chunk order (deltas, block-end, usage, finish)', JSON.stringify(chunks.map((c) => c.type)) === JSON.stringify(['text-delta', 'text-delta', 'block-end', 'usage', 'finish']), JSON.stringify(chunks.map((c) => c.type)));
  const deltas = chunks.filter((c) => c.type === 'text-delta');
  check('responses-sse-text: two text deltas, one block index', deltas.length === 2 && deltas[0].text === 'Hel' && deltas[1].text === 'lo' && deltas[0].index === deltas[1].index, JSON.stringify(deltas));
  const textEnd = chunks.find((c) => c.type === 'block-end');
  check('responses-sse-text: block-end assembles full text', textEnd?.block?.type === 'text' && textEnd?.block?.text === 'Hello', JSON.stringify(textEnd));
  const usage = chunks.find((c) => c.type === 'usage');
  check('responses-sse-text: usage disjoint split (cached out of input)', usage?.usage?.inputTokens === 70 && usage?.usage?.outputTokens === 10 && usage?.usage?.cacheReadTokens === 20, JSON.stringify(usage));
  check('responses-sse-text: finish stop last', chunks.at(-1)?.type === 'finish' && chunks.at(-1)?.reason?.kind === 'stop', JSON.stringify(chunks.at(-1)));
}

// 4. Function-args SSE over CRLF framing: added records call id/name, deltas
// stream, done finalizes, terminal finish is tool-calls.
{
  const body = [
    eventOf('response.output_item.added', { output_index: 0, item: { type: 'function_call', id: 'fc_1', call_id: 'call_9', name: 'ping', arguments: '' } }),
    eventOf('response.function_call_arguments.delta', { item_id: 'fc_1', output_index: 0, delta: '{"x":' }),
    eventOf('response.function_call_arguments.delta', { item_id: 'fc_1', output_index: 0, delta: '1}' }),
    eventOf('response.function_call_arguments.done', { item_id: 'fc_1', output_index: 0, arguments: '{"x":1}' }),
    eventOf('response.completed', { response: { id: 'resp_2', usage: { input_tokens: 5, output_tokens: 7 } } }),
  ].join('\r\n\r\n') + '\r\n\r\n';
  const chunks = [];
  for await (const chunk of openaiResponsesToChunks(responseOf([body]))) chunks.push(chunk);
  const start = chunks.find((c) => c.type === 'block-start');
  check('responses-sse-call: block-start tool-call', start?.blockType === 'tool-call', JSON.stringify(start));
  const firstDelta = chunks.find((c) => c.type === 'tool-call-delta');
  check('responses-sse-call: added records call id + name', firstDelta?.id === 'call_9' && firstDelta?.name === 'ping', JSON.stringify(firstDelta));
  const argDeltas = chunks.filter((c) => c.type === 'tool-call-delta' && c.argumentsDelta !== '');
  check('responses-sse-call: argument deltas streamed (CRLF framing)', argDeltas.map((c) => c.argumentsDelta).join('') === '{"x":1}', JSON.stringify(argDeltas));
  const callEnd = chunks.find((c) => c.type === 'block-end');
  check('responses-sse-call: block-end carries id/name/final arguments', callEnd?.block?.type === 'tool-call' && callEnd?.block?.id === 'call_9' && callEnd?.block?.name === 'ping' && callEnd?.block?.arguments === '{"x":1}', JSON.stringify(callEnd));
  const usage = chunks.find((c) => c.type === 'usage');
  check('responses-sse-call: usage emitted before finish', usage?.usage?.inputTokens === 5 && usage?.usage?.outputTokens === 7, JSON.stringify(usage));
  check('responses-sse-call: finish tool-calls last', chunks.at(-1)?.type === 'finish' && chunks.at(-1)?.reason?.kind === 'tool-calls', JSON.stringify(chunks.at(-1)));
}

// 5. output_item.done closes the tool block before the terminal event; a done
// event without deltas is authoritative (dropped-delta recovery).
{
  const body = [
    eventOf('response.output_item.added', { output_index: 0, item: { type: 'function_call', id: 'fc_2', call_id: 'call_10', name: 'go' } }),
    eventOf('response.function_call_arguments.done', { item_id: 'fc_2', output_index: 0, arguments: '{"y":2}' }),
    eventOf('response.output_item.done', { output_index: 0, item: { type: 'function_call', id: 'fc_2', call_id: 'call_10', name: 'go', arguments: '{"y":2}' } }),
    eventOf('response.completed', { response: { id: 'resp_3' } }),
  ].join('\n\n') + '\n\n';
  const chunks = [];
  for await (const chunk of openaiResponsesToChunks(responseOf([body]))) chunks.push(chunk);
  const callEnd = chunks.find((c) => c.type === 'block-end');
  check('responses-sse-call: done recovers arguments without deltas', callEnd?.block?.arguments === '{"y":2}' && callEnd?.block?.id === 'call_10', JSON.stringify(callEnd));
  check('responses-sse-call: done-block closes before completed finish', JSON.stringify(chunks.map((c) => c.type)) === JSON.stringify(['block-start', 'tool-call-delta', 'tool-call-delta', 'block-end', 'finish']), JSON.stringify(chunks.map((c) => c.type)));
  check('responses-sse-call: single block-end (done event does not double-close)', chunks.filter((c) => c.type === 'block-end').length === 1, JSON.stringify(chunks.map((c) => c.type)));
}

// 6. incomplete with max_output_tokens -> max-tokens finish (usage still emitted)
{
  const body = [
    eventOf('response.output_text.delta', { item_id: 'msg_2', output_index: 0, delta: 'partial' }),
    eventOf('response.incomplete', { response: { id: 'resp_4', incomplete_details: { reason: 'max_output_tokens' }, usage: { input_tokens: 3, output_tokens: 9 } } }),
  ].join('\n\n') + '\n\n';
  const chunks = [];
  for await (const chunk of openaiResponsesToChunks(responseOf([body]))) chunks.push(chunk);
  const usage = chunks.find((c) => c.type === 'usage');
  check('responses-sse-incomplete: usage emitted', usage?.usage?.inputTokens === 3 && usage?.usage?.outputTokens === 9, JSON.stringify(usage));
  check('responses-sse-incomplete: finish max-tokens last', chunks.at(-1)?.type === 'finish' && chunks.at(-1)?.reason?.kind === 'max-tokens', JSON.stringify(chunks.at(-1)));
}

// 7. response.failed / response.error -> error finish
{
  const body = [eventOf('response.failed', { response: { id: 'resp_5', error: { code: 'server_error', message: 'boom' } } })].join('\n\n') + '\n\n';
  const chunks = [];
  for await (const chunk of openaiResponsesToChunks(responseOf([body]))) chunks.push(chunk);
  check('responses-sse-failed: error finish with upstream message + code', chunks.length === 1 && chunks[0].type === 'finish' && chunks[0].reason?.kind === 'error' && chunks[0].reason?.failure?.message === 'boom' && chunks[0].reason?.failure?.code === 'server_error', JSON.stringify(chunks));
}
{
  const body = [eventOf('response.error', { code: 'overloaded', message: 'slow down' })].join('\n\n') + '\n\n';
  const chunks = [];
  for await (const chunk of openaiResponsesToChunks(responseOf([body]))) chunks.push(chunk);
  check('responses-sse-error: error finish with code passthrough', chunks.length === 1 && chunks[0].type === 'finish' && chunks[0].reason?.kind === 'error' && chunks[0].reason?.failure?.code === 'overloaded' && chunks[0].reason?.failure?.message === 'slow down', JSON.stringify(chunks));
}

// 8. Unknown events / malformed data are skipped safely; the stream still terminates.
{
  const body = [
    eventOf('response.some_future_event', { mysterious: { deep: true } }),
    'data: not-json',
    eventOf('response.output_text.delta', { item_id: 'msg_3', output_index: 0, delta: 'ok' }),
    eventOf('response.completed', { response: {} }),
  ].join('\n\n') + '\n\n';
  const chunks = [];
  for await (const chunk of openaiResponsesToChunks(responseOf([body]))) chunks.push(chunk);
  check('responses-sse-unknown: unknown events skipped, deltas still parsed', chunks.some((c) => c.type === 'text-delta' && c.text === 'ok'), JSON.stringify(chunks));
  check('responses-sse-unknown: still terminates with stop', chunks.at(-1)?.type === 'finish' && chunks.at(-1)?.reason?.kind === 'stop', JSON.stringify(chunks.at(-1)));
}

// 9. Data-JSON `error` event -> structured error finish; bare `event: error`
//    with non-JSON text data stays compatible (raw text becomes the message).
{
  const body = [eventOf('error', { code: 'insufficient_quota', message: 'quota exceeded' })].join('\n\n') + '\n\n';
  const chunks = [];
  for await (const chunk of openaiResponsesToChunks(responseOf([body]))) chunks.push(chunk);
  check('responses-sse-error-data: data-JSON error -> structured error finish', chunks.length === 1 && chunks[0].type === 'finish' && chunks[0].reason?.kind === 'error' && chunks[0].reason?.failure?.code === 'insufficient_quota' && chunks[0].reason?.failure?.message === 'quota exceeded', JSON.stringify(chunks));
}
{
  const body = 'event: error\ndata: upstream exploded (not json)\n\n';
  const chunks = [];
  for await (const chunk of openaiResponsesToChunks(responseOf([body]))) chunks.push(chunk);
  check('responses-sse-error-text: bare event:error text -> error finish with raw message', chunks.length === 1 && chunks[0].type === 'finish' && chunks[0].reason?.kind === 'error' && chunks[0].reason?.failure?.message === 'upstream exploded (not json)' && chunks[0].reason?.failure?.code === 'UPSTREAM_ERROR', JSON.stringify(chunks));
}

// 10. block-start emitted exactly once: duplicate added tolerated, and a delta
//     without item_id reuses the added-created partial via output_index.
{
  const body = [
    eventOf('response.output_item.added', { output_index: 0, item: { type: 'function_call', id: 'fc_9', call_id: 'call_20', name: 'reuse' } }),
    eventOf('response.output_item.added', { output_index: 0, item: { type: 'function_call', id: 'fc_9', call_id: 'call_20', name: 'reuse' } }),
    eventOf('response.function_call_arguments.delta', { output_index: 0, delta: '{"a"' }),
    eventOf('response.function_call_arguments.delta', { output_index: 0, delta: ':1}' }),
    eventOf('response.output_item.done', { output_index: 0, item: { type: 'function_call', id: 'fc_9', call_id: 'call_20', name: 'reuse', arguments: '{"a":1}' } }),
    eventOf('response.completed', { response: { id: 'resp_9' } }),
  ].join('\n\n') + '\n\n';
  const chunks = [];
  for await (const chunk of openaiResponsesToChunks(responseOf([body]))) chunks.push(chunk);
  const starts = chunks.filter((c) => c.type === 'block-start');
  check('responses-sse-call-start: block-start emitted exactly once (duplicate added tolerated)', starts.length === 1, JSON.stringify(chunks.map((c) => c.type)));
  const argDeltas = chunks.filter((c) => c.type === 'tool-call-delta' && c.argumentsDelta !== '');
  check('responses-sse-call-start: delta without item_id reuses partial via output_index', argDeltas.length === 2 && argDeltas.every((d) => d.index === starts[0]?.index) && argDeltas[0]?.id === 'call_20' && argDeltas[0]?.name === 'reuse', JSON.stringify(argDeltas));
  const callEnd = chunks.find((c) => c.type === 'block-end');
  check('responses-sse-call-start: reused partial closes with full arguments', callEnd?.block?.arguments === '{"a":1}' && callEnd?.block?.id === 'call_20' && callEnd?.block?.name === 'reuse', JSON.stringify(callEnd));
}
// delta-only stream (gateway skips added): block-start emitted on creation.
{
  const body = [
    eventOf('response.function_call_arguments.delta', { output_index: 0, delta: '{"z":0}' }),
    eventOf('response.completed', { response: { id: 'resp_14' } }),
  ].join('\n\n') + '\n\n';
  const chunks = [];
  for await (const chunk of openaiResponsesToChunks(responseOf([body]))) chunks.push(chunk);
  const callEnd = chunks.find((c) => c.type === 'block-end');
  check('responses-sse-delta-create: delta-created partial emits block-start once, closes', JSON.stringify(chunks.map((c) => c.type)) === JSON.stringify(['block-start', 'tool-call-delta', 'block-end', 'finish']) && callEnd?.block?.arguments === '{"z":0}', JSON.stringify(chunks.map((c) => c.type)));
}

// 11. output_item.done gating: an identity-less unknown item is ignored; a
//     done-only item with identity closes a tool block (empty args -> '{}').
{
  const body = [
    eventOf('response.output_item.done', { output_index: 0, item: { type: 'function_call', id: 'fc_ghost' } }),
    eventOf('response.completed', { response: { id: 'resp_10' } }),
  ].join('\n\n') + '\n\n';
  const chunks = [];
  for await (const chunk of openaiResponsesToChunks(responseOf([body]))) chunks.push(chunk);
  check('responses-sse-done-gate: identity-less unknown done ignored (stop finish, no tool block)', JSON.stringify(chunks.map((c) => c.type)) === JSON.stringify(['finish']) && chunks[0].reason?.kind === 'stop', JSON.stringify(chunks));
}
{
  const body = [
    eventOf('response.output_item.done', { output_index: 0, item: { type: 'function_call', id: 'fc_done', call_id: 'call_21', name: 'onlyDone', arguments: '' } }),
    eventOf('response.completed', { response: { id: 'resp_11' } }),
  ].join('\n\n') + '\n\n';
  const chunks = [];
  for await (const chunk of openaiResponsesToChunks(responseOf([body]))) chunks.push(chunk);
  const callEnd = chunks.find((c) => c.type === 'block-end');
  check('responses-sse-done-gate: done-only with identity closes block; empty arguments -> {}', JSON.stringify(chunks.map((c) => c.type)) === JSON.stringify(['block-end', 'finish']) && callEnd?.block?.id === 'call_21' && callEnd?.block?.name === 'onlyDone' && callEnd?.block?.arguments === '{}', JSON.stringify(chunks));
  check('responses-sse-done-gate: finish tool-calls', chunks.at(-1)?.type === 'finish' && chunks.at(-1)?.reason?.kind === 'tool-calls', JSON.stringify(chunks.at(-1)));
}

// 12. Top-level `usage` on terminal events is honored when response.usage is
//     absent (gateway variation).
{
  const body = [eventOf('response.completed', { response: { id: 'resp_12' }, usage: { input_tokens: 11, output_tokens: 4 } })].join('\n\n') + '\n\n';
  const chunks = [];
  for await (const chunk of openaiResponsesToChunks(responseOf([body]))) chunks.push(chunk);
  const usage = chunks.find((c) => c.type === 'usage');
  check('responses-sse-usage-fallback: completed payload.usage honored', usage?.usage?.inputTokens === 11 && usage?.usage?.outputTokens === 4, JSON.stringify(usage));
}
{
  const body = [eventOf('response.incomplete', { response: { id: 'resp_15', incomplete_details: { reason: 'max_output_tokens' } }, usage: { output_tokens: 8 } })].join('\n\n') + '\n\n';
  const chunks = [];
  for await (const chunk of openaiResponsesToChunks(responseOf([body]))) chunks.push(chunk);
  const usage = chunks.find((c) => c.type === 'usage');
  check('responses-sse-usage-fallback: incomplete payload.usage honored (max-tokens finish)', usage?.usage?.outputTokens === 8 && chunks.at(-1)?.reason?.kind === 'max-tokens', JSON.stringify(chunks));
}
{
  const body = [eventOf('response.failed', { response: { id: 'resp_13', error: { code: 'server_error', message: 'boom' } }, usage: { input_tokens: 6, output_tokens: 2 } })].join('\n\n') + '\n\n';
  const chunks = [];
  for await (const chunk of openaiResponsesToChunks(responseOf([body]))) chunks.push(chunk);
  const usage = chunks.find((c) => c.type === 'usage');
  check('responses-sse-usage-fallback: failed payload.usage honored (usage before error finish)', usage?.usage?.inputTokens === 6 && usage?.usage?.outputTokens === 2 && chunks.at(-1)?.reason?.kind === 'error' && chunks.at(-1)?.reason?.failure?.message === 'boom', JSON.stringify(chunks));
}

if (failures > 0) process.exit(1);
console.log('\nresponses tests OK');
