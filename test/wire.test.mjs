// Offline unit tests for the wire layer (localhost streams only, no network):
//   1. SSE framing: LF / CRLF / lone-CR line endings, mixed endings, CRLF pairs
//      split across read chunks, comment lines, multi-line data joins,
//      multibyte characters split across chunks, the end-of-stream flush of a
//      trailing event that lacks a final blank line, and reader-lock cleanup
//      on early generator exit.
//   2. OpenAI multi-turn tool-message conversion: assistant `tool_calls`,
//      `tool`-role results with tool_call_id correlation, reasoning dropped,
//      system role preserved, legacy `callId` tolerated.
//   3. The OpenAI SSE converter end-to-end over a CRLF-framed stream.
//   4. The unified endpoint resolver: auto (/v1 normalization) and custom
//      (verbatim complete URLs) modes across every request path, plus
//      dangerous/invalid URL refusal with credential redaction.
//   5. OpenAI Responses conversion: input items (text / function_call /
//      function_call_output / system collection / images), tools, usage
//      mapping, and the SSE event fixtures (text / reasoning / tool arguments
//      deltas, output_item added/done, completed / incomplete / failed /
//      error, abort).
import { iterateSse } from '../src/wire/sse.ts';
import { openaiCompletionsToChunks, toOpenAIMessages } from '../src/wire/openai.ts';
import {
  responsesSseToChunks,
  toResponsesInput,
  toResponsesTokenUsage,
  toResponsesTools,
} from '../src/wire/responses.ts';
import { effectiveEndpointMode, resolveEndpointUrl } from '../src/url.ts';

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
async function recordsOf(chunks) {
  const records = [];
  for await (const record of iterateSse(responseOf(chunks))) records.push(record);
  return records;
}

// 1. SSE framing
let r = await recordsOf(['data: {"a":1}\n\ndata: [DONE]\n\n']);
check('sse: LF framing yields both records', r.length === 2 && r[0].data === '{"a":1}' && r[1].data === '[DONE]', JSON.stringify(r));

r = await recordsOf(['event: error\r\ndata: boom\r\n\r\n']);
check('sse: CRLF framing + event field', r.length === 1 && r[0].event === 'error' && r[0].data === 'boom', JSON.stringify(r));

r = await recordsOf(['data: a\r\ndata: b\n\r\ndata: c\n\n']);
check('sse: mixed CRLF/LF endings', r.length === 2 && r[0].data === 'a\nb' && r[1].data === 'c', JSON.stringify(r));

r = await recordsOf(['data: {"x"', ':1}\n\n']);
check('sse: event split across chunks', r.length === 1 && r[0].data === '{"x":1}', JSON.stringify(r));

r = await recordsOf(['data: x\r', '\n\ndata: y\n\n']);
check('sse: CRLF pair split across chunks', r.length === 2 && r[0].data === 'x' && r[1].data === 'y', JSON.stringify(r));

r = await recordsOf(['data: a\r\rdata: b\r']);
check('sse: lone CR line endings + EOF flush', r.length === 2 && r[0].data === 'a' && r[1].data === 'b', JSON.stringify(r));

r = await recordsOf(['data: {"tail":true}']);
check('sse: trailing event without blank line flushed at EOF', r.length === 1 && r[0].data === '{"tail":true}', JSON.stringify(r));

r = await recordsOf([': keep-alive\n\ndata: 1\n\n']);
check('sse: comment lines ignored', r.length === 1 && r[0].data === '1', JSON.stringify(r));

r = await recordsOf(['event: ping\n\n']);
check('sse: data-less event skipped (historical behavior)', r.length === 0, JSON.stringify(r));

{
  const bytes = encoder.encode('data: 你好\n\n');
  r = await recordsOf([bytes.slice(0, 8), bytes.slice(8)]);
  check('sse: multibyte char split across chunks (streaming decoder)', r.length === 1 && r[0].data === '你好', JSON.stringify(r));
}

r = await recordsOf([]);
check('sse: empty body yields nothing', r.length === 0, JSON.stringify(r));

// Reader cleanup: breaking out of the loop must release the lock (unchanged
// abort/cleanup contract — the body stream stays usable by nobody else, but
// the lock is gone so the connection can be torn down).
{
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode('data: one\n\n'));
      // never closes: the generator must release the lock on early exit
    },
  });
  const response = new Response(stream);
  let first;
  for await (const record of iterateSse(response)) {
    first = record;
    break;
  }
  check('sse: early break parses first record', first?.data === 'one', JSON.stringify(first));
  check('sse: early break releases the reader lock', response.body !== null && response.body.locked === false, String(response.body?.locked));
}

// 2. OpenAI multi-turn tool-message conversion
const wire = toOpenAIMessages([
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
]);

check('openai-conv: system role preserved', wire[0]?.role === 'system' && wire[0]?.content === 'sys prompt', JSON.stringify(wire[0]));
check('openai-conv: plain user text', wire[1]?.role === 'user' && wire[1]?.content === 'pick a color', JSON.stringify(wire[1]));
check('openai-conv: assistant text + tool_calls', wire[2]?.role === 'assistant' && wire[2]?.content === 'Let me check.'
  && JSON.stringify(wire[2]?.tool_calls) === JSON.stringify([{ id: 'call_1', type: 'function', function: { name: 'lookup', arguments: '{"q":"blue"}' } }]), JSON.stringify(wire[2]));
check('openai-conv: tool result message', wire[3]?.role === 'tool' && wire[3]?.tool_call_id === 'call_1' && wire[3]?.content === '#0000ff', JSON.stringify(wire[3]));
check('openai-conv: multiple tool results in order (legacy callId tolerated)', wire[4]?.tool_call_id === 'call_2' && wire[4]?.content === 'plain'
  && wire[5]?.tool_call_id === 'call_3' && wire[5]?.content === '{"ok":true}', JSON.stringify([wire[4], wire[5]]));
check('openai-conv: reasoning dropped from assistant', wire[6]?.role === 'assistant' && wire[6]?.content === 'Blue.' && wire[6]?.tool_calls === undefined, JSON.stringify(wire[6]));
check('openai-conv: assistant-only tool_calls keeps content null + normalizes empty args', wire[7]?.role === 'assistant' && wire[7]?.content === null
  && wire[7]?.tool_calls?.[0]?.id === 'call_4' && wire[7]?.tool_calls?.[0]?.function?.arguments === '{}', JSON.stringify(wire[7]));
check('openai-conv: no stray empty messages', wire.length === 8, `got ${wire.length}`);

// 3. CRLF-framed stream end-to-end through the OpenAI chunk converter
// (records separated by a BLANK CRLF line — SSE spec framing).
const sseBody = [
  'data: {"choices":[{"index":0,"delta":{"role":"assistant","content":"hi"}}]}',
  'data: {"choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"id":"call_9","function":{"name":"ping","arguments":"{}"}}]}}]}',
  'data: {"choices":[{"index":0,"delta":{},"finish_reason":"tool_calls"}],"usage":{"prompt_tokens":90,"completion_tokens":10,"total_tokens":100}}',
  'data: [DONE]',
].join('\r\n\r\n') + '\r\n\r\n';
const chunks = [];
for await (const chunk of openaiCompletionsToChunks(responseOf([sseBody]))) chunks.push(chunk);
check('crlf e2e: text delta', chunks.some((c) => c.type === 'text-delta' && c.text === 'hi'), JSON.stringify(chunks.map((c) => c.type)));
check('crlf e2e: tool-call block-end with name', chunks.some((c) => c.type === 'block-end' && c.block?.type === 'tool-call' && c.block?.name === 'ping'), JSON.stringify(chunks));
const usageChunk = chunks.find((c) => c.type === 'usage');
check('crlf e2e: usage chunk parsed (disjoint input)', usageChunk?.usage?.inputTokens === 90 && usageChunk?.usage?.outputTokens === 10, JSON.stringify(usageChunk));
check('crlf e2e: finish tool-calls last', chunks.at(-1)?.type === 'finish' && chunks.at(-1)?.reason?.kind === 'tool-calls', JSON.stringify(chunks.at(-1)));

if (failures > 0) process.exit(1);

// 4. Unified endpoint resolver ------------------------------------------------
// auto (default; also when endpointMode is absent/unknown): /v1 normalization
// per request path. custom: complete URLs verbatim — models from baseURL,
// chat/responses/messages from endpoint. No path is ever appended in custom.
const AUTO_CASES = [
  ['https://gw.example.com', '/chat/completions', 'https://gw.example.com/v1/chat/completions'],
  ['https://gw.example.com/v1', '/responses', 'https://gw.example.com/v1/responses'],
  ['https://gateway.example/openai/v1/', '/messages', 'https://gateway.example/openai/v1/messages'],
  ['https://gw.example.com', '/models', 'https://gw.example.com/v1/models'],
];
for (const [base, path, want] of AUTO_CASES) {
  const r = resolveEndpointUrl({ baseURL: base }, path);
  check(`resolver auto: ${base} + ${path}`, r.ok === true && r.url === want, JSON.stringify(r));
  const absent = resolveEndpointUrl({ baseURL: base, endpointMode: undefined }, path);
  check(`resolver auto (endpointMode absent -> auto): ${path}`, absent.ok === true && absent.url === want, JSON.stringify(absent));
}
check('resolver: unknown endpointMode value behaves as auto (backward compat)', effectiveEndpointMode(undefined) === 'auto' && effectiveEndpointMode('weird') === 'auto' && effectiveEndpointMode('custom') === 'custom');

const CUSTOM_CASES = [
  // chat completions / responses / messages dial the complete `endpoint`;
  // models dials the complete `baseURL`. Nothing joined, nothing appended.
  ['https://api.example.com/custom/chat', '/chat/completions', 'endpoint'],
  ['https://api.example.com/my/openai/responses', '/responses', 'endpoint'],
  ['https://relay.example/claude/messages', '/messages', 'endpoint'],
  ['https://api.example.com/api/models', '/models', 'baseURL'],
];
for (const [url, path, field] of CUSTOM_CASES) {
  const inputs = field === 'endpoint'
    ? { baseURL: 'https://unused.example', endpoint: url, endpointMode: 'custom' }
    : { baseURL: url, endpointMode: 'custom' };
  const r = resolveEndpointUrl(inputs, path);
  check(`resolver custom: ${path} dials ${field} verbatim`, r.ok === true && r.url === url, JSON.stringify(r));
}
// A /vN-suffixed custom endpoint is NEVER re-normalized (no join at all).
{
  const r = resolveEndpointUrl({ baseURL: 'https://api.example.com', endpoint: 'https://api.example.com/v1/chat/completions', endpointMode: 'custom' }, '/chat/completions');
  check('resolver custom: explicit /v1 path kept verbatim (no auto-append)', r.ok === true && r.url === 'https://api.example.com/v1/chat/completions', JSON.stringify(r));
}
{
  // Custom chat with empty endpoint refused; custom discovery with empty
  // baseURL refused; the error names the field.
  const noEndpoint = resolveEndpointUrl({ baseURL: 'https://api.example.com', endpoint: '  ', endpointMode: 'custom' }, '/chat/completions');
  check('resolver custom: empty endpoint refused with a field-naming error', noEndpoint.ok === false && /endpoint \(the complete request URL\)/.test(noEndpoint.error), JSON.stringify(noEndpoint));
  const noBase = resolveEndpointUrl({ baseURL: '', endpointMode: 'custom' }, '/models');
  check('resolver custom: empty baseURL refused for /models', noBase.ok === false && /baseURL \(the complete model-listing URL\)/.test(noBase.error), JSON.stringify(noBase));
  const autoNoBase = resolveEndpointUrl({ baseURL: '  ' }, '/chat/completions');
  check('resolver auto: empty baseURL refused', autoNoBase.ok === false && /baseURL is required/.test(autoNoBase.error), JSON.stringify(autoNoBase));
}
{
  // Dangerous / invalid URLs are refused before any dialing, with the URL
  // credential-redacted in the message.
  const bad = [
    ['javascript:alert(1)', 'http or https'],
    ['ftp://gw.example.com/x', 'http or https'],
    ['://nope', 'valid URL'],
    ['http://user:sekret@gw.example.com/\r\nX-Inject: 1', 'control characters'],
  ];
  for (const [url, why] of bad) {
    const r = resolveEndpointUrl({ baseURL: url }, '/models');
    const hit = r.ok === false && r.error.includes(why);
    check(`resolver: dangerous URL refused (${why})`, hit, JSON.stringify(r));
  }
  const cred = resolveEndpointUrl({ baseURL: 'http://user:sekret@gw.example.com/nope-xyz' }, '/models');
  check('resolver: invalid URL error redacts embedded credentials', cred.ok === true || (!cred.error.includes('sekret') && cred.error.includes('***')), JSON.stringify(cred));
}

// 5. OpenAI Responses conversion ----------------------------------------------
// input items: user text, assistant text + function_call, tool outputs with
// call_id correlation (legacy callId tolerated), system text collected,
// reasoning dropped, inline image kept, attachment-ref image skipped.
const responsesInput = toResponsesInput([
  { role: 'system', content: 'be terse' },
  { role: 'user', content: 'pick a color' },
  { role: 'assistant', content: [
    { type: 'text', text: 'Let me check.' },
    { type: 'tool-call', id: 'call_1', name: 'lookup', arguments: '{"q":"blue"}' },
  ] },
  { role: 'user', content: [
    { type: 'tool-result', toolCallId: 'call_1', content: [{ type: 'text', text: '#0000ff' }] },
  ] },
  { role: 'user', content: [
    { type: 'tool-result', callId: 'call_2', content: { ok: true } },
    { type: 'image', source: 'aGVsbG8=', mediaType: 'image/png' },
    { type: 'image', attachment: { id: 'att-1' } },
  ] },
  { role: 'assistant', content: [{ type: 'reasoning', text: 'hidden chain' }, { type: 'text', text: 'Blue.' }] },
]);
check('responses-conv: system text collected out of input', responsesInput.systemText === 'be terse', JSON.stringify(responsesInput.systemText));
const rItems = responsesInput.input;
check('responses-conv: user text item (input_text)', rItems[0]?.role === 'user' && JSON.stringify(rItems[0]?.content) === JSON.stringify([{ type: 'input_text', text: 'pick a color' }]), JSON.stringify(rItems[0]));
check('responses-conv: assistant text item (output_text)', rItems[1]?.role === 'assistant' && rItems[1]?.content?.[0]?.type === 'output_text' && rItems[1]?.content?.[0]?.text === 'Let me check.', JSON.stringify(rItems[1]));
check('responses-conv: function_call item with call_id + normalized args', JSON.stringify(rItems[2]) === JSON.stringify({ type: 'function_call', call_id: 'call_1', name: 'lookup', arguments: '{"q":"blue"}' }), JSON.stringify(rItems[2]));
check('responses-conv: function_call_output item', JSON.stringify(rItems[3]) === JSON.stringify({ type: 'function_call_output', call_id: 'call_1', output: '#0000ff' }), JSON.stringify(rItems[3]));
check('responses-conv: legacy callId tolerated + object output serialized', rItems[4]?.type === 'function_call_output' && rItems[4]?.call_id === 'call_2' && rItems[4]?.output === '{"ok":true}', JSON.stringify(rItems[4]));
check('responses-conv: inline image -> input_image data URL', rItems[5]?.role === 'user' && rItems[5]?.content?.length === 1 && rItems[5]?.content?.[0]?.type === 'input_image' && rItems[5]?.content?.[0]?.image_url === 'data:image/png;base64,aGVsbG8=', JSON.stringify(rItems[5]));
check('responses-conv: attachment-ref image skipped (no fabrication)', rItems[6]?.role === 'assistant' && rItems[6]?.content?.length === 1 && rItems[6]?.content?.[0]?.text === 'Blue.', JSON.stringify(rItems[6]));
check('responses-conv: reasoning has no input item', rItems.length === 7, `got ${rItems.length}`);

check('responses-conv: tools use the flat function shape', JSON.stringify(toResponsesTools([
  { name: 'web_search', description: 'search', parameters: { type: 'object', properties: { q: { type: 'string' } } } },
  { name: 'bare', description: '', parameters: undefined },
])) === JSON.stringify([
  { type: 'function', name: 'web_search', description: 'search', parameters: { type: 'object', properties: { q: { type: 'string' } } } },
  { type: 'function', name: 'bare', description: '', parameters: { type: 'object', properties: {} } },
]), JSON.stringify(toResponsesTools([])));

check('responses-usage: cached split out of input_tokens + reasoning mapped', JSON.stringify(toResponsesTokenUsage({
  input_tokens: 120,
  output_tokens: 30,
  output_tokens_details: { reasoning_tokens: 12 },
  input_tokens_details: { cached_tokens: 100 },
})) === JSON.stringify({ inputTokens: 20, outputTokens: 30, cacheReadTokens: 100, reasoningTokens: 12 }), JSON.stringify(toResponsesTokenUsage({ input_tokens: 120, output_tokens: 30, input_tokens_details: { cached_tokens: 100 }, output_tokens_details: { reasoning_tokens: 12 } })));
check('responses-usage: absent/empty usage yields undefined', toResponsesTokenUsage(undefined) === undefined && toResponsesTokenUsage({}) === undefined);

// SSE fixtures (offline, no network). Framing matches the protocol: event
// name + JSON data carrying `type`.
async function responsesChunksOf(chunks) {
  const out = [];
  for await (const chunk of responsesSseToChunks(responseOf(chunks))) out.push(chunk);
  return out;
}
const sseOf = (obj) => `event: ${obj.type}\ndata: ${JSON.stringify(obj)}\n\n`;

// 5a. pure text + completed usage + finish stop (completed must not discard chunks)
{
  const events = [
    { type: 'response.created', response: { id: 'resp_1' } },
    { type: 'response.output_item.added', output_index: 0, item: { type: 'message', role: 'assistant', id: 'msg_1' } },
    { type: 'response.output_text.delta', item_id: 'msg_1', delta: 'Hello' },
    { type: 'response.output_text.delta', item_id: 'msg_1', delta: ' world' },
    { type: 'response.output_text.done', item_id: 'msg_1', text: 'Hello world' },
    { type: 'response.output_item.done', output_index: 0, item: { type: 'message', role: 'assistant', id: 'msg_1' } },
    { type: 'response.completed', response: { id: 'resp_1', status: 'completed', usage: { input_tokens: 50, output_tokens: 6, input_tokens_details: { cached_tokens: 20 } } } },
  ];
  const chunks = await responsesChunksOf(events.map(sseOf));
  check('responses-sse: text deltas in order', chunks.filter((c) => c.type === 'text-delta').map((c) => c.text).join('') === 'Hello world', JSON.stringify(chunks.map((c) => c.type)));
  const endIdx = chunks.findIndex((c) => c.type === 'block-end');
  const finishIdx = chunks.findIndex((c) => c.type === 'finish');
  check('responses-sse: text block closes BEFORE the finish (completed never drops chunks)', endIdx >= 0 && finishIdx > endIdx && chunks[endIdx]?.block?.type === 'text' && chunks[endIdx]?.block?.text === 'Hello world', JSON.stringify(chunks));
  const usage = chunks.find((c) => c.type === 'usage')?.usage;
  check('responses-sse: usage chunk before finish with cached split', usage?.inputTokens === 30 && usage?.outputTokens === 6 && usage?.cacheReadTokens === 20, JSON.stringify(usage));
  check('responses-sse: finish stop (no tool call)', chunks.at(-1)?.type === 'finish' && chunks.at(-1)?.reason?.kind === 'stop', JSON.stringify(chunks.at(-1)));
}

// 5b. tool call: output_item.added -> arguments delta/done -> output_item.done -> completed
{
  const events = [
    { type: 'response.created', response: {} },
    { type: 'response.output_item.added', output_index: 1, item: { type: 'function_call', id: 'fc_1', call_id: 'call_9', name: 'web_search', arguments: '' } },
    { type: 'response.function_call_arguments.delta', item_id: 'fc_1', delta: '{"q' },
    { type: 'response.function_call_arguments.delta', item_id: 'fc_1', delta: '":"test"}' },
    { type: 'response.function_call_arguments.done', item_id: 'fc_1', arguments: '{"q":"test"}' },
    { type: 'response.output_item.done', output_index: 1, item: { type: 'function_call', id: 'fc_1', call_id: 'call_9', name: 'web_search', arguments: '{"q":"test"}' } },
    { type: 'response.completed', response: { status: 'completed', usage: { input_tokens: 10, output_tokens: 5 } } },
  ];
  const chunks = await responsesChunksOf(events.map(sseOf));
  check('responses-sse tools: block-start tool-call emitted', chunks.some((c) => c.type === 'block-start' && c.blockType === 'tool-call'), JSON.stringify(chunks.map((c) => c.type)));
  check('responses-sse tools: argument deltas streamed', chunks.some((c) => c.type === 'tool-call-delta' && c.argumentsDelta === '{"q') && chunks.some((c) => c.type === 'tool-call-delta' && c.argumentsDelta === '":"test"}'), JSON.stringify(chunks.filter((c) => c.type === 'tool-call-delta')));
  const toolEnd = chunks.find((c) => c.type === 'block-end' && c.block?.type === 'tool-call');
  check('responses-sse tools: block-end carries id/name/final arguments', toolEnd?.block?.id === 'call_9' && toolEnd?.block?.name === 'web_search' && toolEnd?.block?.arguments === '{"q":"test"}', JSON.stringify(toolEnd));
  check('responses-sse tools: finish tool-calls last', chunks.at(-1)?.type === 'finish' && chunks.at(-1)?.reason?.kind === 'tool-calls', JSON.stringify(chunks.at(-1)));
}

// 5c. shims that omit item_id on arguments events (output_index keying) and
// omit output_item.added entirely.
{
  const events = [
    { type: 'response.function_call_arguments.delta', output_index: 0, call_id: 'call_x', name: 'lookup', delta: '{"a"' },
    { type: 'response.function_call_arguments.delta', output_index: 0, delta: ':1}' },
    { type: 'response.completed', response: { status: 'completed' } },
  ];
  const chunks = await responsesChunksOf(events.map(sseOf));
  const toolEnd = chunks.find((c) => c.type === 'block-end' && c.block?.type === 'tool-call');
  check('responses-sse tools: no added event -> lazily created block still closes with full args', toolEnd?.block?.arguments === '{"a":1}' && toolEnd?.block?.name === 'lookup' && toolEnd?.block?.id === 'call_x', JSON.stringify(toolEnd));
  check('responses-sse tools: finish tool-calls', chunks.at(-1)?.reason?.kind === 'tool-calls', JSON.stringify(chunks.at(-1)));
}

// 5d. reasoning + refusal deltas map to reasoning/text
{
  const events = [
    { type: 'response.output_item.added', output_index: 0, item: { type: 'reasoning', id: 'rs_1' } },
    { type: 'response.reasoning_summary_text.delta', item_id: 'rs_1', delta: 'thinking' },
    { type: 'response.reasoning_text.delta', item_id: 'rs_1', delta: ' harder' },
    { type: 'response.refusal.delta', item_id: 'rs_1', delta: 'I cannot.' },
    { type: 'response.completed', response: {} },
  ];
  const chunks = await responsesChunksOf(events.map(sseOf));
  check('responses-sse: reasoning deltas (summary + text)', chunks.filter((c) => c.type === 'reasoning-delta').map((c) => c.text).join('') === 'thinking harder', JSON.stringify(chunks));
  check('responses-sse: refusal mapped to text', chunks.some((c) => c.type === 'text-delta' && c.text === 'I cannot.'), JSON.stringify(chunks));
  const closes = chunks.filter((c) => c.type === 'block-end');
  check('responses-sse: reasoning + text blocks both closed', closes.some((c) => c.block?.type === 'reasoning') && closes.some((c) => c.block?.type === 'text'), JSON.stringify(closes));
}

// 5e. incomplete (max_output_tokens) -> max-tokens; other reasons -> error
{
  const chunks = await responsesChunksOf([sseOf({ type: 'response.output_text.delta', delta: 'partial' }), sseOf({ type: 'response.incomplete', response: { status: 'incomplete', incomplete_details: { reason: 'max_output_tokens' }, usage: { input_tokens: 4, output_tokens: 2 } } })]);
  check('responses-sse: incomplete max_output_tokens -> max-tokens finish', chunks.at(-1)?.reason?.kind === 'max-tokens', JSON.stringify(chunks.at(-1)));
  check('responses-sse: text still closed before the max-tokens finish', chunks.some((c) => c.type === 'block-end' && c.block?.text === 'partial'), JSON.stringify(chunks));
  const other = await responsesChunksOf([sseOf({ type: 'response.incomplete', response: { incomplete_details: { reason: 'content_filter' } } })]);
  check('responses-sse: other incomplete reason -> error finish naming the reason', other.at(-1)?.reason?.kind === 'error' && /content_filter/.test(other.at(-1)?.reason?.failure?.message ?? ''), JSON.stringify(other.at(-1)));
}

// 5f. failed / error events
{
  const failed = await responsesChunksOf([sseOf({ type: 'response.output_text.delta', delta: 'par' }), sseOf({ type: 'response.failed', response: { error: { code: 'server_error', message: 'boom upstream' } } })]);
  check('responses-sse: response.failed -> error finish (message from response.error)', failed.at(-1)?.reason?.kind === 'error' && failed.at(-1)?.reason?.failure?.message === 'boom upstream' && failed.at(-1)?.reason?.failure?.code === 'server_error', JSON.stringify(failed.at(-1)));
  check('responses-sse: deltas before the failure are not discarded', failed.some((c) => c.type === 'text-delta' && c.text === 'par'), JSON.stringify(failed.map((c) => c.type)));
  const errored = await responsesChunksOf([sseOf({ type: 'response.error', code: 'rate_limit', message: 'slow down' })]);
  check('responses-sse: response.error -> error finish', errored.at(-1)?.reason?.kind === 'error' && errored.at(-1)?.reason?.failure?.message === 'slow down', JSON.stringify(errored.at(-1)));
  const bare = await responsesChunksOf(['event: error\r\ndata: gateway exploded\r\n\r\n']);
  check('responses-sse: bare event:error framing -> error finish', bare.at(-1)?.reason?.kind === 'error' && /gateway exploded/.test(bare.at(-1)?.reason?.failure?.message ?? ''), JSON.stringify(bare.at(-1)));
}

// 5g. early stream end without a terminal event still closes + finishes
{
  const chunks = await responsesChunksOf([sseOf({ type: 'response.output_text.delta', delta: 'cut' })]);
  check('responses-sse: early stream end closes text + finish stop', chunks.some((c) => c.type === 'block-end' && c.block?.text === 'cut') && chunks.at(-1)?.reason?.kind === 'stop', JSON.stringify(chunks));
}

// 5h. abort -> aborted finish (signal aborts, stream then errors like a torn fetch)
{
  const controller = new AbortController();
  controller.abort();
  const stream = new ReadableStream({
    start(c) {
      c.enqueue(encoder.encode(sseOf({ type: 'response.output_text.delta', delta: 'pre' })));
      setTimeout(() => c.error(new Error('The operation was aborted')), 5);
    },
  });
  const chunks = [];
  for await (const chunk of responsesSseToChunks(new Response(stream), controller.signal)) chunks.push(chunk);
  check('responses-sse: abort -> aborted finish (delta already delivered)', chunks.at(-1)?.reason?.kind === 'aborted' && chunks.some((c) => c.type === 'text-delta'), JSON.stringify(chunks));
}

// 5i. data-only shims: `type` from data when the event name is missing
{
  const chunks = await responsesChunksOf([`data: ${JSON.stringify({ type: 'response.output_text.delta', delta: 'plain' })}\n\n`, `data: ${JSON.stringify({ type: 'response.completed', response: {} })}\n\n`]);
  check('responses-sse: data-only framing (no event field) parsed', chunks.some((c) => c.type === 'text-delta' && c.text === 'plain') && chunks.at(-1)?.reason?.kind === 'stop', JSON.stringify(chunks));
}

console.log('\nwire tests OK');
process.exit(failures === 0 ? 0 : 1);
