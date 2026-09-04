// Verify dsh-provider-hub (multi-gateway): Config schema, adapter catalog/resolve,
// stream conversion (anthropic + openai paths), model discovery, multi-gateway
// isolation, and offline wire probes through the UA gate (localhost echo
// server only — no real network).
import http from 'node:http';
import { readFileSync } from 'node:fs';
import { BlockAssembler, LlmError } from '@deepseek-ai/dsh-llm';
import * as plugin from '../lib/index.js';

let failures = 0;
function check(label, cond, detail = '') {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}${detail ? `  ${detail}` : ''}`);
  if (!cond) failures++;
}

// 1. Module shape
check('name', plugin.name === 'provider-hub');
check('apply', typeof plugin.apply === 'function');
check('Config', !!plugin.Config);
check('MODEL_CATALOG has glm-5.3', plugin.MODEL_CATALOG['glm-5.3']?.contextWindow > 0);
check('NS', plugin.NS === 'llm-provider-hub');

// 1c. Scoped package identity: package.json name == cordis.patch.yml `name` ==
// build.mjs CLIENT_LOADER_ID == dsh.plugin.json id (the boot graph advertises
// the client bundle under that loader entry name; a mismatch breaks web boot
// into recovery mode). The cordis fiber id stays the short 'provider-hub'.
const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
check('scoped package name @tappat225/dsh-provider-hub', pkg.name === '@tappat225/dsh-provider-hub');
check('cordis patch name = package name (quoted, YAML @ reserved)', readFileSync(new URL('../cordis.patch.yml', import.meta.url), 'utf8').includes(`name: '${pkg.name}'`));
check('client loader id = package name', readFileSync(new URL('../build.mjs', import.meta.url), 'utf8').includes(`CLIENT_LOADER_ID = '${pkg.name}'`));
check('dsh.plugin.json id = package name', JSON.parse(readFileSync(new URL('../dsh.plugin.json', import.meta.url), 'utf8')).id === pkg.name);

// 1b. Endpoint URL joining: both baseURL spellings (bare host and explicit
// /v1 root) must resolve to the same endpoint set — the historical bug was
// chat hard-coding /v1/... while /models appended a bare path.
const { joinEndpoint } = await import('../src/url.ts');
check('joinEndpoint: bare host gets /v1 inserted', joinEndpoint('https://gw.example.com', '/chat/completions') === 'https://gw.example.com/v1/chat/completions' && joinEndpoint('https://gw.example.com', '/models') === 'https://gw.example.com/v1/models', joinEndpoint('https://gw.example.com', '/models'));
check('joinEndpoint: explicit /v1 root is not doubled', joinEndpoint('https://gw.example.com/v1', '/chat/completions') === 'https://gw.example.com/v1/chat/completions' && joinEndpoint('https://gw.example.com/v1', '/models') === 'https://gw.example.com/v1/models', joinEndpoint('https://gw.example.com/v1', '/models'));
check('joinEndpoint: trailing slash + deployment sub-paths keep segments', joinEndpoint('https://gateway.example/openai/v1/', '/chat/completions') === 'https://gateway.example/openai/v1/chat/completions', joinEndpoint('https://gateway.example/openai/v1/', '/chat/completions'));
check('joinEndpoint: any /vN root stays the root', joinEndpoint('https://gw.example.com/v2', '/models') === 'https://gw.example.com/v2/models');

// 2. Config schema (multi-gateway)
const config = plugin.Config({
  gateways: [{
    provider: 'air-outer',
    baseURL: 'http://127.0.0.1:18996',
    api: 'anthropic-messages',
    userAgent: 'claude-cli/2.0.1 (external, cli)',
    apiKey: 'sk-test',
    enabledModels: ['glm-5.3', 'claude-opus-4-8'],
    modelOverrides: { 'glm-5.3': { contextWindow: 999999, maxTokens: 8888 } },
    customModels: [{ id: 'my-model', name: 'My Model', contextWindow: 64000, maxTokens: 4096, input: ['text'], reasoningEfforts: { off: null, high: 'high' } }],
  }],
});
check('Config defaults', config.gateways[0].provider === 'air-outer' && config.gateways[0].userAgent === 'claude-cli/2.0.1 (external, cli)');
check('Config displayName defaults to empty (resolves to provider id)', config.gateways[0].displayName === '', JSON.stringify(config.gateways[0].displayName));
check('Anthropic thinking is adapter-owned', config.gateways[0].anthropicThinking === undefined && config.gateways[0].anthropicThinkingBudgets === undefined);
check('Config customModels kept', config.gateways[0].customModels.length === 1);
const defaultModelConfig = plugin.Config({ gateways: [{
  provider: 'defaults-gw',
  baseURL: 'http://127.0.0.1:18996',
  defaultContextWindow: 65536,
  defaultMaxTokens: 4096,
  defaultInput: ['image'],
  customModels: [{ id: 'defaulted-model', name: 'Defaulted Model' }],
}] }).gateways[0];
const defaultedEntry = plugin.resolveModelEntries(defaultModelConfig).find((entry) => entry.id === 'defaulted-model');
check('gateway model defaults fill omitted custom fields', defaultedEntry?.contextWindow === 65536 && defaultedEntry?.maxTokens === 4096 && JSON.stringify(defaultedEntry?.input) === JSON.stringify(['image']) && defaultedEntry?.source === 'gateway-default', JSON.stringify(defaultedEntry));

// 3. Model entries + adapter resolve (single gateway = gateway at index 0)
const gw0 = config.gateways[0];
const entries = plugin.resolveModelEntries(gw0);
check('entries: 3 (2 builtin + 1 custom)', entries.length === 3, `got ${entries.length}: ${entries.map((e) => e.id).join(',')}`);
const builtin = entries.find((e) => e.id === 'claude-opus-4-8');
check('builtin entry params', builtin.contextWindow === 1000000 && builtin.maxTokens === 131072 && builtin.input.includes('image'));
const overridden = entries.find((e) => e.id === 'glm-5.3');
check('modelOverrides applied field-wise', overridden.contextWindow === 999999 && overridden.maxTokens === 8888 && overridden.input.includes('text') && !overridden.input.includes('image') && overridden.name === 'GLM-5.3', JSON.stringify({ cw: overridden.contextWindow, mt: overridden.maxTokens, input: overridden.input, name: overridden.name }));
const custom = entries.find((e) => e.id === 'my-model');
check('custom entry params', custom.contextWindow === 64000 && custom.maxTokens === 4096);

// 4. Adapter behavior (fake ctx, no settings service) — multi-gateway apply
let registered = {};
const fakeCtx = {
  get: () => undefined,
  llm: {
    registerConfigurableProviders: (entries) => { registered.providers = entries; },
    registerAdapter: (providers, adapter) => { registered.adapter = { providers, adapter }; },
    registerModelDiscovery: (ns, fn) => { registered.discovery = { ns, fn }; },
  },
  inject: () => {},
  logger: { info: () => {}, warn: () => {} },
};
const multiConfig = plugin.Config({
  gateways: [
    {
      provider: 'air-outer',
      baseURL: 'http://127.0.0.1:18996',
      api: 'anthropic-messages',
      userAgent: 'claude-cli/2.0.1 (external, cli)',
      apiKey: 'sk-test',
      enabledModels: ['glm-5.3', 'claude-opus-4-8'],
    },
    {
      provider: 'gw-b',
      baseURL: 'http://127.0.0.1:18996',
      api: 'openai-completions',
      userAgent: 'openai-gpt/4.0',
      apiKey: 'sk-b',
      enabledModels: ['gpt-4o'],
    },
  ],
});
plugin.apply(fakeCtx, multiConfig);
check('registerConfigurableProviders: 2 gateways', registered.providers.length === 2 && registered.providers[0].provider === 'air-outer' && registered.providers[1].provider === 'gw-b', JSON.stringify(registered.providers));
check('registerAdapter: 2 routes', registered.adapter?.providers?.length === 2 && registered.adapter.providers.includes('air-outer') && registered.adapter.providers.includes('gw-b'), JSON.stringify(registered.adapter?.providers));

// 4b. Empty-gateway startup must not throw (dsh-llm rejects empty configurable-provider registration)
const emptyRegistered = { providers: undefined, adapter: undefined };
const emptyCtx = {
  get: () => undefined,
  llm: {
    registerConfigurableProviders: (entries) => { emptyRegistered.providers = entries; },
    registerAdapter: (providers, adapter) => { emptyRegistered.adapter = { providers, adapter }; },
    registerModelDiscovery: () => {},
  },
  inject: () => {},
  logger: { info: () => {}, warn: () => {} },
};
let emptyThrew = false;
try {
  plugin.apply(emptyCtx, plugin.Config({ gateways: [] }));
} catch (e) {
  emptyThrew = true;
  console.log('[empty-gateway] threw:', e?.message);
}
check('empty gateway: apply does not throw', !emptyThrew);
check('empty gateway: no providers registered', emptyRegistered.providers === undefined && emptyRegistered.adapter === undefined, JSON.stringify({ providers: emptyRegistered.providers, adapter: emptyRegistered.adapter }));

const adapter = registered.adapter.adapter;
const listedA = await adapter.listModels('air-outer');
const listedB = await adapter.listModels('gw-b');
check('listModels gateway A: no gpt-4o (isolation)', listedA.length === 2 && !listedA.some((m) => m.id === 'gpt-4o'), JSON.stringify(listedA.map((m) => m.id)));
check('listModels gateway B: gpt-4o only (isolation)', listedB.length === 1 && listedB[0].id === 'gpt-4o', JSON.stringify(listedB.map((m) => m.id)));
const resolved = await adapter.resolveModel('air-outer', 'claude-opus-4-8');
check('resolveModel claude', resolved.context?.contextWindow === 1000000 && resolved.defaultMaxTokens === 4096 && resolved.reasoning?.efforts?.length === 6, JSON.stringify(resolved));
try {
  await adapter.resolveModel('air-outer', 'not-enabled');
  check('resolveModel unknown throws', false);
} catch (e) {
  check('resolveModel unknown throws', e instanceof LlmError && e.code === 'UNKNOWN_MODEL');
}
const prepared = await adapter.prepareCall('air-outer', 'glm-5.3');
check('prepareCall returns stream fn', typeof prepared.stream === 'function' && prepared.model.id === 'glm-5.3');

// 5. Stream conversion via echo server (anthropic path, text + tool_use)
const sseEvents = [
  { type: 'message_start', message: { id: 'msg_1', type: 'message', role: 'assistant', model: 't', content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 5, output_tokens: 3 } } },
  { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } },
  { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'Hello' } },
  { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: ' world' } },
  { type: 'content_block_stop', index: 0 },
  { type: 'content_block_start', index: 1, content_block: { type: 'tool_use', id: 'toolu_1', name: 'web_search', input: {} } },
  { type: 'content_block_delta', index: 1, delta: { type: 'input_json_delta', partial_json: '{"q' } },
  { type: 'content_block_delta', index: 1, delta: { type: 'input_json_delta', partial_json: '":"test"}' } },
  { type: 'content_block_stop', index: 1 },
  { type: 'message_delta', delta: { stop_reason: 'end_turn', stop_sequence: null }, usage: { output_tokens: 30 } },
  { type: 'message_stop' },
];
let lastSeenHeaders = null;
let lastBody = '';
let requestCount = 0;
const server = http.createServer((req, res) => {
  let body = '';
  req.on('data', (c) => (body += c));
  req.on('end', () => {
    requestCount += 1;
    lastBody = body;
    lastSeenHeaders = { url: req.url, ua: req.headers['user-agent'], key: req.headers['x-api-key'] ?? req.headers['authorization']?.slice(0, 12), body: body.slice(0, 120), full: req.headers };
    if (req.url.endsWith('/models')) {
      if (req.headers['x-test-models-down']) {
        // Gateways without (or gating) the /models listing: the connection
        // test must fall back to the live-chat probe instead.
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: { message: 'no model listing here' } }));
        return;
      }
      if (req.headers['x-test-big']) {
        // >4 MiB listing: discovery must refuse via its read cap (offline test
        // for the body cap — never a real upstream).
        const items = Array.from({ length: 220_000 }, (_, i) => ({ id: `model-${i}`, object: 'model' }));
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ object: 'list', data: items }));
        return;
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ object: 'list', data: [
        { id: 'glm-5.3', object: 'model', context_window: 200000, max_output_tokens: 131072 },
        { id: 'glm-4.6', object: 'model' },
        { id: 'glm-4.6', object: 'model' }, // duplicate id: discovery must dedupe (first wins)
        { id: '', object: 'model' },
      ] }));
      return;
    }
    if (req.url.includes('/responses')) {
      // OpenAI-responses SSE (auto/custom endpoint tests). Emits a text item;
      // when the request carried tools, a function_call item streams too.
      res.writeHead(200, { 'Content-Type': 'text/event-stream' });
      let parsedBody = {};
      try { parsedBody = JSON.parse(body || '{}'); } catch { /* probe body */ }
      const events = [
        { type: 'response.created', response: { id: 'resp_1' } },
        { type: 'response.output_item.added', output_index: 0, item: { type: 'message', role: 'assistant', id: 'msg_1' } },
        { type: 'response.output_text.delta', item_id: 'msg_1', delta: 'hello from responses' },
        { type: 'response.output_text.done', item_id: 'msg_1', text: 'hello from responses' },
        { type: 'response.output_item.done', output_index: 0, item: { type: 'message', role: 'assistant', id: 'msg_1' } },
      ];
      if (Array.isArray(parsedBody.tools) && parsedBody.tools.length > 0) {
        events.push(
          { type: 'response.output_item.added', output_index: 1, item: { type: 'function_call', id: 'fc_1', call_id: 'call_r1', name: String(parsedBody.tools[0]?.name ?? 'tool'), arguments: '' } },
          { type: 'response.function_call_arguments.delta', item_id: 'fc_1', delta: '{"q":"hub"}' },
          { type: 'response.output_item.done', output_index: 1, item: { type: 'function_call', id: 'fc_1', call_id: 'call_r1', name: String(parsedBody.tools[0]?.name ?? 'tool'), arguments: '{"q":"hub"}' } },
        );
      }
      events.push({ type: 'response.completed', response: { id: 'resp_1', status: 'completed', usage: { input_tokens: 100, output_tokens: 20, input_tokens_details: { cached_tokens: 40 }, output_tokens_details: { reasoning_tokens: 5 } } } });
      for (const ev of events) res.write(`event: ${ev.type}\ndata: ${JSON.stringify(ev)}\n\n`);
      res.end();
      return;
    }
    if (req.url.includes('/chat/completions')) {
      if (req.headers['x-test-echo-key']) {
        // Echo the Authorization header back in an error body: the adapter
        // must scrub the API key from the surfaced failure message.
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: { message: `auth failed for ${req.headers['authorization']}` } }));
        return;
      }
      if (req.headers['x-test-tools']) {
        // Streaming tool-call variant
        res.writeHead(200, { 'Content-Type': 'text/event-stream' });
        res.write(`data: ${JSON.stringify({ id: 'chatcmpl-2', object: 'chat.completion.chunk', created: 1, model: 't', choices: [{ index: 0, delta: { tool_calls: [{ index: 0, id: 'call_1', function: { name: 'web_search', arguments: '' } }] }, finish_reason: null }] })}\n\n`);
        res.write(`data: ${JSON.stringify({ id: 'chatcmpl-2', object: 'chat.completion.chunk', created: 1, model: 't', choices: [{ index: 0, delta: { tool_calls: [{ index: 0, function: { arguments: '{"q' } }] }, finish_reason: null }] })}\n\n`);
        res.write(`data: ${JSON.stringify({ id: 'chatcmpl-2', object: 'chat.completion.chunk', created: 1, model: 't', choices: [{ index: 0, delta: { tool_calls: [{ index: 0, function: { arguments: '":"test"}' } }] }, finish_reason: 'tool_calls' }] })}\n\n`);
        res.write(`data: ${JSON.stringify({ id: 'chatcmpl-2', object: 'chat.completion.chunk', created: 1, model: 't', choices: [], usage: { prompt_tokens: 100, completion_tokens: 25, total_tokens: 125, prompt_tokens_details: { cached_tokens: 60 } } })}\n\n`);
        res.write('data: [DONE]\n\n');
        res.end();
        return;
      }
      // OpenAI-format SSE (used by the openai-completions path test)
      res.writeHead(200, { 'Content-Type': 'text/event-stream' });
      const oaiEvents = [
        { id: 'chatcmpl-1', object: 'chat.completion.chunk', created: 1, model: 't', choices: [{ index: 0, delta: { role: 'assistant', reasoning_content: 'let me think' }, finish_reason: null }] },
        { id: 'chatcmpl-1', object: 'chat.completion.chunk', created: 1, model: 't', choices: [{ index: 0, delta: { content: 'hi there' }, finish_reason: null }] },
        { id: 'chatcmpl-1', object: 'chat.completion.chunk', created: 1, model: 't', choices: [{ index: 0, delta: {}, finish_reason: 'stop' }], usage: { prompt_tokens: 42, completion_tokens: 7, total_tokens: 49 } },
      ];
      for (const ev of oaiEvents) res.write(`data: ${JSON.stringify(ev)}\n\n`);
      res.write('data: [DONE]\n\n');
      res.end();
      return;
    }
    if (req.url.endsWith('/messages') && req.headers['x-test-echo-key']) {
      // Chat-probe auth failure: echo the x-api-key back in an error body —
      // the probe must scrub the credential from the surfaced failure.
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: { message: `auth failed for ${req.headers['x-api-key']}` } }));
      return;
    }
    res.writeHead(200, { 'Content-Type': 'text/event-stream' });
    for (const ev of sseEvents) res.write(`event: ${ev.type}\ndata: ${JSON.stringify(ev)}\n\n`);
    res.end();
  });
});
await new Promise((r) => server.listen(18996, '127.0.0.1', r));

const options = {
  provider: 'air-outer',
  model: 'glm-5.3',
  maxTokens: 32,
  messages: [{ role: 'user', content: [{ type: 'text', text: 'hi' }] }],
  tools: [{ name: 'web_search', description: 'search', inputSchema: { type: 'object', properties: { q: { type: 'string' } } } }],
};
const assembler = new BlockAssembler();
for await (const chunk of prepared.stream(options)) assembler.push(chunk);
const blocks = assembler.blocks();
check('anthropic: 2 blocks', blocks.length === 2, `got ${blocks.length}`);
check('anthropic: text block', blocks[0]?.type === 'text' && blocks[0]?.text === 'Hello world');
check('anthropic: tool block', blocks[1]?.type === 'tool-call' && blocks[1]?.name === 'web_search' && blocks[1]?.arguments === '{"q":"test"}');
check('anthropic: finish', assembler.finish?.kind === 'stop');
check('anthropic: wire UA + key', lastSeenHeaders?.ua === 'claude-cli/2.0.1 (external, cli)' && lastSeenHeaders?.key === 'sk-test', JSON.stringify(lastSeenHeaders));

// 5b. multi-gateway: gateway B routes by provider and carries its own UA/key
const gwB = multiConfig.gateways[1];
const streamB = adapter.stream({ provider: 'gw-b', model: 'gpt-4o', maxTokens: 16, messages: [{ role: 'user', content: 'hi' }] });
const chunksB = [];
for await (const c of streamB) chunksB.push(c);
check('multi-gateway B: openai stream works', chunksB.some((c) => c.type === 'text-delta'), JSON.stringify(chunksB.map((c) => c.type)));
check('multi-gateway B: wire UA openai-gpt/4.0 + key Bearer sk-b', lastSeenHeaders?.ua === 'openai-gpt/4.0' && lastSeenHeaders?.key === 'Bearer sk-b', JSON.stringify(lastSeenHeaders));
check('multi-gateway B: bare host gets /v1 inserted on the wire', lastSeenHeaders?.url === '/v1/chat/completions', String(lastSeenHeaders?.url));

// 5c. explicit /v1 baseURL: the version segment must not double (the
// "configure /v1 for the model list, chat then posts /v1/v1/..." bug).
const v1Config = plugin.Config({ gateways: [{ ...config.gateways[0], api: 'openai-completions', baseURL: 'http://127.0.0.1:18996/v1' }] }).gateways[0];
const v1Adapter = new (Object.getPrototypeOf(adapter).constructor)({
  current: () => ({ gateways: [v1Config] }),
  gatewayFor: (p) => v1Config.provider === p ? v1Config : undefined,
  resolveApiKey: async () => 'sk-v1',
});
for await (const _c of v1Adapter.stream({ provider: 'air-outer', model: 'glm-5.3', maxTokens: 8, messages: [{ role: 'user', content: 'hi' }] })) { /* drain */ }
check('openai /v1 root: single version segment on the wire', lastSeenHeaders?.url === '/v1/chat/completions', String(lastSeenHeaders?.url));

// 6. openai path with reasoning_content + system prompt (systemRole)
const oaiConfig = plugin.Config({ gateways: [{ ...config.gateways[0], api: 'openai-completions', systemRole: 'system' }] }).gateways[0];
const oaiAdapter = new (Object.getPrototypeOf(adapter).constructor)({
  current: () => ({ gateways: [oaiConfig] }),
  gatewayFor: (p) => oaiConfig.provider === p ? oaiConfig : undefined,
  resolveApiKey: async () => 'sk-oai',
  preset: () => undefined,
});
const oaiStream = oaiAdapter.stream({ provider: 'air-outer', model: 'glm-5.3', maxTokens: 16, reasoningEffort: 'high', system: 'You are a helpful assistant.', messages: [{ role: 'user', content: [{ type: 'text', text: 'hi' }] }] });
const oaiChunks = [];
for await (const c of oaiStream) oaiChunks.push(c);
check('openai: reasoning+text deltas', oaiChunks.some((c) => c.type === 'reasoning-delta') && oaiChunks.some((c) => c.type === 'text-delta'), JSON.stringify(oaiChunks.map((c) => c.type)));
check('openai: finish stop', oaiChunks.at(-1)?.reason?.kind === 'stop');
const oaiUsage = oaiChunks.find((c) => c.type === 'usage')?.usage;
check('openai: usage chunk emitted before finish', oaiUsage !== undefined && oaiChunks.indexOf({ type: 'usage', usage: oaiUsage }) === -1 ? true : oaiChunks.findIndex((c) => c.type === 'usage') < oaiChunks.length - 1, JSON.stringify(oaiUsage));
check('openai: usage values (input 42, output 7)', oaiUsage?.inputTokens === 42 && oaiUsage?.outputTokens === 7, JSON.stringify(oaiUsage));
check('openai: wire key bearer', 'Bearer sk-oai'.startsWith(lastSeenHeaders?.key ?? ''), JSON.stringify(lastSeenHeaders));
check('openai: system prompt sent as system role', (lastSeenHeaders?.body ?? '').includes('"role":"system"') && (lastSeenHeaders?.body ?? '').includes('You are a helpful'), JSON.stringify(lastSeenHeaders?.body));
check('openai: default streams request usage (stream_options.include_usage)', lastBody.includes('"stream_options":{"include_usage":true}'), lastBody.slice(0, 200));

// 6b. systemRole: developer
const oaiDevConfig = plugin.Config({ gateways: [{ ...config.gateways[0], api: 'openai-completions', systemRole: 'developer' }] }).gateways[0];
const oaiDevAdapter = new (Object.getPrototypeOf(adapter).constructor)({
  current: () => ({ gateways: [oaiDevConfig] }),
  gatewayFor: (p) => oaiDevConfig.provider === p ? oaiDevConfig : undefined,
  resolveApiKey: async () => 'sk-oai',
  preset: () => undefined,
});
for await (const _c of oaiDevAdapter.stream({ provider: 'air-outer', model: 'glm-5.3', maxTokens: 8, system: 'sys', messages: [{ role: 'user', content: 'hi' }] })) { /* drain */ }
check('openai: systemRole developer honored', (lastSeenHeaders?.body ?? '').includes('"role":"developer"'), JSON.stringify(lastSeenHeaders?.body));

// 6b-2. streamUsage=false: strict gateways that reject stream_options must be
// configurable — the body then carries no stream_options at all.
const oaiNoUsageConfig = plugin.Config({ gateways: [{ ...config.gateways[0], api: 'openai-completions', streamUsage: false }] }).gateways[0];
const oaiNoUsageAdapter = new (Object.getPrototypeOf(adapter).constructor)({
  current: () => ({ gateways: [oaiNoUsageConfig] }),
  gatewayFor: (p) => oaiNoUsageConfig.provider === p ? oaiNoUsageConfig : undefined,
  resolveApiKey: async () => 'sk-oai',
  preset: () => undefined,
});
for await (const _c of oaiNoUsageAdapter.stream({ provider: 'air-outer', model: 'glm-5.3', maxTokens: 8, messages: [{ role: 'user', content: 'hi' }] })) { /* drain */ }
check('openai: streamUsage=false omits stream_options', !lastBody.includes('stream_options'), lastBody.slice(0, 200));

// 6c. openai path: streaming tool_calls
const oaiToolsConfig = plugin.Config({ gateways: [{ ...config.gateways[0], api: 'openai-completions', extraHeaders: { 'x-test-tools': '1' } }] }).gateways[0];
const oaiToolsAdapter = new (Object.getPrototypeOf(adapter).constructor)({
  current: () => ({ gateways: [oaiToolsConfig] }),
  gatewayFor: (p) => oaiToolsConfig.provider === p ? oaiToolsConfig : undefined,
  resolveApiKey: async () => 'sk-oai',
  preset: () => undefined,
});
const oaiToolsStream = oaiToolsAdapter.stream({
  provider: 'air-outer',
  model: 'glm-5.3',
  maxTokens: 16,
  messages: [{ role: 'user', content: 'hi' }],
  tools: [{ name: 'web_search', description: 'search', parameters: { type: 'object', properties: { q: { type: 'string' } } } }],
});
const oaiToolChunks = [];
for await (const c of oaiToolsStream) oaiToolChunks.push(c);
const toolAssembler = new BlockAssembler();
for (const c of oaiToolChunks) toolAssembler.push(c);
const toolBlocks = toolAssembler.blocks();
check('openai tools: 1 tool block', toolBlocks.length === 1 && toolBlocks[0]?.type === 'tool-call', JSON.stringify(toolBlocks));
check('openai tools: name + args', toolBlocks[0]?.name === 'web_search' && toolBlocks[0]?.arguments === '{"q":"test"}', JSON.stringify(toolBlocks[0]));
check('openai tools: finish tool-calls', toolAssembler.finish?.kind === 'tool-calls', JSON.stringify(toolAssembler.finish));
const oaiToolsUsage = oaiToolChunks.find((c) => c.type === 'usage')?.usage;
check('openai tools: usage chunk emitted', oaiToolsUsage !== undefined, JSON.stringify(oaiToolsUsage));
check('openai tools: cached input split (input 40, cacheRead 60, output 25)', oaiToolsUsage?.inputTokens === 40 && oaiToolsUsage?.cacheReadTokens === 60 && oaiToolsUsage?.outputTokens === 25, JSON.stringify(oaiToolsUsage));
check('openai tools: wire tools param', (lastSeenHeaders?.body ?? '').includes('"tools"'), JSON.stringify(lastSeenHeaders?.body));

// 6d. custom model with empty params defaults (kept for catalog coverage)
// (presetFrom was removed by design — no cross-provider import feature.)

// 6e. reasoning-effort dispatch: the map's VALUE is the wire spelling
// (llm-pi-ai semantics: key = selector level, value = wire value; valueless
// off sends nothing; off with a value sends it; undeclared levels are
// refused BEFORE network I/O).
const effConfig = plugin.Config({ gateways: [{
  provider: 'eff-gw',
  baseURL: 'http://127.0.0.1:18996',
  api: 'openai-completions',
  userAgent: 'ua-eff',
  apiKey: 'sk-eff',
  enabledModels: [],
  customModels: [
    { id: 'dialect-model', name: 'Dialect', contextWindow: 64000, maxTokens: 4096, reasoningEfforts: { off: null, high: 'ultra' } },
    { id: 'offval-model', name: 'OffVal', contextWindow: 64000, maxTokens: 4096, reasoningEfforts: { off: 'none', high: 'high' } },
    { id: 'plain-model', name: 'Plain', contextWindow: 64000, maxTokens: 4096 },
  ],
}] }).gateways[0];
const effAdapter = new (Object.getPrototypeOf(adapter).constructor)({
  current: () => ({ gateways: [effConfig] }),
  gatewayFor: (p) => effConfig.provider === p ? effConfig : undefined,
  resolveApiKey: async () => 'sk-eff',
});
const effResolved = await effAdapter.resolveModel('eff-gw', 'dialect-model');
check('effort metadata: map keys offered with capitalized names', JSON.stringify(effResolved.reasoning?.efforts) === JSON.stringify([{ id: 'off', name: 'Off' }, { id: 'high', name: 'High' }]) && effResolved.reasoning?.defaultEffort === undefined, JSON.stringify(effResolved.reasoning));
const plainResolved = await effAdapter.resolveModel('eff-gw', 'plain-model');
check('effort metadata: map-less model exposes no reasoning', plainResolved.reasoning === undefined, JSON.stringify(plainResolved.reasoning));
const effStream = (model, effort) => effAdapter.stream({ provider: 'eff-gw', model, maxTokens: 8, ...(effort === undefined ? {} : { reasoningEffort: effort }), messages: [{ role: 'user', content: 'hi' }] });
for await (const _c of effStream('dialect-model', 'high')) { /* drain */ }
check('effort wire: declared spelling "ultra" sent for high', lastBody.includes('"reasoning_effort":"ultra"'), lastBody.slice(0, 200));
for await (const _c of effStream('dialect-model', 'off')) { /* drain */ }
check('effort wire: valueless off omits the parameter', !lastBody.includes('reasoning_effort'), lastBody.slice(0, 200));
for await (const _c of effStream('dialect-model', undefined)) { /* drain */ }
check('effort wire: no effort selected omits the parameter', !lastBody.includes('reasoning_effort'), lastBody.slice(0, 200));
for await (const _c of effStream('offval-model', 'off')) { /* drain */ }
check('effort wire: off with declared value sends "none"', lastBody.includes('"reasoning_effort":"none"'), lastBody.slice(0, 200));
const beforeUnsupported = requestCount;
const unsupportedChunks = [];
for await (const c of effStream('dialect-model', 'max')) unsupportedChunks.push(c);
const unsupportedFinish = unsupportedChunks.at(-1);
check('effort unsupported: refused before network I/O', unsupportedFinish?.reason?.kind === 'error'
  && unsupportedFinish?.reason?.failure?.code === 'UNSUPPORTED_REASONING_EFFORT'
  && /does not support reasoning effort "max"/.test(unsupportedFinish?.reason?.failure?.message ?? '')
  && requestCount === beforeUnsupported, JSON.stringify(unsupportedFinish?.reason));
const plainChunks = [];
for await (const c of effStream('plain-model', 'high')) plainChunks.push(c);
check('effort on non-reasoning model refused', plainChunks.at(-1)?.reason?.kind === 'error' && /does not support reasoning effort/.test(plainChunks.at(-1)?.reason?.failure?.message ?? ''), JSON.stringify(plainChunks.at(-1)?.reason));
const ghostChunks = [];
for await (const c of effStream('ghost-model', undefined)) ghostChunks.push(c);
check('stream: non-enabled model refused (UNKNOWN_MODEL)', ghostChunks.at(-1)?.reason?.kind === 'error' && ghostChunks.at(-1)?.reason?.failure?.code === 'UNKNOWN_MODEL', JSON.stringify(ghostChunks.at(-1)?.reason));

// 6f. anthropic thinking passthrough: level -> budget_tokens, max_tokens guard
const thinkConfig = plugin.Config({ gateways: [{
  provider: 'think-gw',
  baseURL: 'http://127.0.0.1:18996',
  api: 'anthropic-messages',
  userAgent: 'ua-think',
  apiKey: 'sk-think',
  enabledModels: ['glm-5.3'],
  customModels: [{ id: 'turbo-model', name: 'Turbo', contextWindow: 64000, maxTokens: 4096, reasoningEfforts: { off: null, turbo: 'turbo' } }],
}] }).gateways[0];
const thinkAdapter = new (Object.getPrototypeOf(adapter).constructor)({
  current: () => ({ gateways: [thinkConfig] }),
  gatewayFor: (p) => thinkConfig.provider === p ? thinkConfig : undefined,
  resolveApiKey: async () => 'sk-think',
});
for await (const _c of thinkAdapter.stream({ provider: 'think-gw', model: 'glm-5.3', maxTokens: 32, reasoningEffort: 'high', messages: [{ role: 'user', content: 'hi' }] })) { /* drain */ }
check('anthropic thinking: high -> budget 8192, max_tokens lifted to budget+1024', lastBody.includes('"thinking":{"type":"enabled","budget_tokens":8192}') && lastBody.includes('"max_tokens":9216'), lastBody.slice(0, 200));
const beforeThinkOff = requestCount;
let thinkLast;
for await (const _c of thinkAdapter.stream({ provider: 'think-gw', model: 'glm-5.3', maxTokens: 32, reasoningEffort: 'off', messages: [{ role: 'user', content: 'hi' }] })) thinkLast = _c;
check('anthropic thinking: GLM-5.3 no longer offers off (always-on thinking, refused before I/O)', thinkLast?.reason?.kind === 'error'
  && thinkLast?.reason?.failure?.code === 'UNSUPPORTED_REASONING_EFFORT'
  && /does not support reasoning effort "off"/.test(thinkLast?.reason?.failure?.message ?? '')
  && requestCount === beforeThinkOff, JSON.stringify(thinkLast?.reason));
const beforeTurbo = requestCount;
const turboChunks = [];
for await (const c of thinkAdapter.stream({ provider: 'think-gw', model: 'turbo-model', maxTokens: 32, reasoningEffort: 'turbo', messages: [{ role: 'user', content: 'hi' }] })) turboChunks.push(c);
check('anthropic thinking: unmapped level refused before network I/O', turboChunks.at(-1)?.reason?.kind === 'error'
  && /no built-in budget/.test(turboChunks.at(-1)?.reason?.failure?.message ?? '')
  && requestCount === beforeTurbo, JSON.stringify(turboChunks.at(-1)?.reason));

// 6g. reasoning map validation (fail-loud at resolution, reference semantics)
const mapConfigOf = (efforts) => plugin.Config({ gateways: [{ ...effConfig, customModels: [{ id: 'bad-model', name: 'Bad', contextWindow: 64000, maxTokens: 4096, reasoningEfforts: efforts }] }] }).gateways[0];
let threwNonOffNull = false;
try { plugin.resolveModelEntries(mapConfigOf({ off: null, low: null })); } catch (e) { threwNonOffNull = /reasoningEfforts\.low needs the wire value/.test(e.message); }
check('map validation: non-off null refused', threwNonOffNull);
let threwOnlyOff = false;
try { plugin.resolveModelEntries(mapConfigOf({ off: null })); } catch (e) { threwOnlyOff = /offers no level beyond "off"/.test(e.message); }
check('map validation: only-off map refused', threwOnlyOff);
let threwEmpty = false;
try { plugin.resolveModelEntries(mapConfigOf({ high: '' })); } catch (e) { threwEmpty = /must not be an empty string/.test(e.message); }
check('map validation: empty wire value refused', threwEmpty);
const gpt4oResolved = await adapter.resolveModel('gw-b', 'gpt-4o');
check('non-reasoning builtin: no reasoning advertised (no lone-off control)', gpt4oResolved.reasoning === undefined, JSON.stringify(gpt4oResolved.reasoning));

// 9. ProviderHubRuntime (client-half remote service) with fake settings/llm — gateway-indexed
const { ProviderHubRuntime } = await import('../src/host/runtime.ts');
const stored = { ...config };
const fakeSettings = {
  writable: true,
  mutate: async (ns, ops) => {
    for (const op of ops) {
      if (op.op === 'set') {
        // handle ['gateways', index, ...] paths
        const [head, idx, ...rest] = op.path;
        if (head === 'gateways' && rest.length > 0) {
          const gw = stored.gateways[Number(idx)];
          if (gw !== undefined) gw[rest[0]] = op.value;
        } else {
          stored[head] = op.value;
        }
      } else if (op.op === 'unset') {
        const [head, idx, ...rest] = op.path;
        if (head === 'gateways' && rest.length > 0) {
          const gw = stored.gateways[Number(idx)];
          if (gw !== undefined) delete gw[rest[0]];
        } else {
          delete stored[head];
        }
      }
    }
  },
};
const fakeLlm = {
  listProviders: () => [{ id: 'shuai-claude', name: 'Shuai Claude' }],
  listConfigurableProviders: () => [{ provider: 'shuai-claude', displayName: 'Shuai Claude', settingsNs: 'llm-pi-ai', settingsPath: [] }],
  listModels: async () => [{ provider: 'shuai-claude', id: 'claude-opus-4-8', name: 'Claude Opus 4.8' }],
  resolveModelInfo: async () => ({ provider: 'shuai-claude', id: 'claude-opus-4-8', name: 'Claude Opus 4.8', context: { contextWindow: 1000000 }, defaultMaxTokens: 32768 }),
};
const runtimeCredentialValues = new Map();
const runtimeCredentials = {
  async resolve(ref) { const value = runtimeCredentialValues.get(String(ref)); return value === undefined ? undefined : { value }; },
  async describe(ref) { return { configured: runtimeCredentialValues.has(String(ref)) }; },
  async set(ref, value) { runtimeCredentialValues.set(String(ref), value); },
};
const runtime = new ProviderHubRuntime(
  {
    get: (n) => (n === 'settings' ? fakeSettings : n === 'llm' ? fakeLlm : n === 'credentials' ? runtimeCredentials : undefined),
    reflect: { provide: () => {} },
  },
  {
    current: () => stored,
    resolveApiKey: async () => 'sk-test',
    gatewayFor: (p) => stored.gateways.find((g) => g.provider === p),
    log: () => {},
  },
);
const st = await runtime.getState();
check('runtime getState', st.ok === true && st.gateways.length === 1 && st.gateways[0].models.length === 3 && st.catalog['glm-5.3'] !== undefined, JSON.stringify({ ok: st.ok, gateways: st.gateways.length }));
check('runtime getState redacts literal apiKey', st.gateways[0].gateway.apiKey === undefined && st.gateways[0].gateway.apiKeyConfigured === true && !JSON.stringify(st).includes('sk-test'), JSON.stringify(st.gateways[0].gateway));
const newKeyWrite = await runtime.saveConfig(0, { apiKey: 'sk-runtime-new' });
check('runtime saveConfig stores new apiKey in credentials only', newKeyWrite.ok === true && runtimeCredentialValues.get('GATEWAY_API_KEY') === 'sk-runtime-new' && stored.gateways[0].apiKey === '', JSON.stringify({ ok: newKeyWrite.ok, stored: stored.gateways[0].apiKey, hasCredential: runtimeCredentialValues.has('GATEWAY_API_KEY') }));
const keptKey = await runtime.saveConfig(0, { apiKey: '' });
check('runtime saveConfig empty apiKey preserves credential', keptKey.ok === true && runtimeCredentialValues.get('GATEWAY_API_KEY') === 'sk-runtime-new', JSON.stringify({ ok: keptKey.ok, key: runtimeCredentialValues.get('GATEWAY_API_KEY') }));
const sc = await runtime.saveConfig(0, { displayName: 'Hub Test' });
check('runtime saveConfig writes (index 0)', sc.ok === true && stored.gateways[0].displayName === 'Hub Test', JSON.stringify(stored.gateways[0].displayName));
const tb = await runtime.toggleBuiltin(0, 'glm-5.3-flash', true);
check('runtime toggleBuiltin on', tb.ok === true && stored.gateways[0].enabledModels.includes('glm-5.3-flash'), JSON.stringify(stored.gateways[0].enabledModels));
const tb2 = await runtime.toggleBuiltin(0, 'glm-5.3-flash', false);
check('runtime toggleBuiltin off', tb2.ok === true && !stored.gateways[0].enabledModels.includes('glm-5.3-flash'));
const uc = await runtime.upsertCustom(0, { id: 'my-model', name: 'My Model', contextWindow: 64000, maxTokens: 4096 }, null);
check('runtime upsertCustom', uc.ok === true && stored.gateways[0].customModels.some((m) => m.id === 'my-model'), JSON.stringify(stored.gateways[0].customModels));
const dc = await runtime.deleteCustom(0, 'my-model');
check('runtime deleteCustom', dc.ok === true && !stored.gateways[0].customModels.some((m) => m.id === 'my-model'));
const ag = await runtime.addGateway();
check('runtime addGateway', ag.ok === true && stored.gateways.length === 2 && ag.index === 1, JSON.stringify({ gateways: stored.gateways.length, index: ag.index }));
check('runtime addGateway name hub-gateway', (ag.gateway?.provider ?? '').startsWith('hub-gateway'), JSON.stringify(ag.gateway?.provider));
const ag2 = await runtime.addGateway();
check('runtime addGateway dedupe hub-gateway-1', ag2.ok === true && (ag2.gateway?.provider ?? '') === 'hub-gateway-1', JSON.stringify(ag2.gateway?.provider));
const dg2 = await runtime.deleteGateway(2);
check('runtime deleteGateway 2', dg2.ok === true && stored.gateways.length === 2, JSON.stringify({ gateways: stored.gateways.length }));
const dg = await runtime.deleteGateway(1);
check('runtime deleteGateway', dg.ok === true && stored.gateways.length === 1, JSON.stringify({ gateways: stored.gateways.length }));
const rd = await runtime.discover(0);
check('runtime discover via echo', rd.ok === true && rd.models.length === 2 && rd.models[0].id === 'glm-5.3', JSON.stringify(rd.models));

// 9a. testConnection, TWO stages over an UNSAVED draft (URL/key/headers/model):
// stage 1 checks GET {baseURL}/models — success proves the gateway and rides
// the listing along (no chat request); stage 2, only when the listing fails,
// sends ONE real "hi" chat request through the current preferred model
// (draft.model verbatim, else the first resolved entry). The provider is
// unavailable only when BOTH fail — the combined error names both probes.
const tc = await runtime.testConnection(0, { baseURL: 'http://127.0.0.1:18996/', apiKey: 'sk-draft', extraHeaders: {} });
check('runtime testConnection ok (models stage, bare host -> /v1/models, listing rides along)', tc.ok === true && tc.via === 'models' && tc.modelCount === 2 && tc.models.length === 2 && typeof tc.latencyMs === 'number' && tc.endpoint === 'http://127.0.0.1:18996/v1/models', JSON.stringify(tc));
const tcV1 = await runtime.testConnection(0, { baseURL: 'http://127.0.0.1:18996/v1', apiKey: 'sk-draft', extraHeaders: {} });
check('runtime testConnection ok (explicit /v1 root not doubled)', tcV1.ok === true && tcV1.via === 'models' && tcV1.endpoint === 'http://127.0.0.1:18996/v1/models' && tcV1.modelCount === 2, JSON.stringify(tcV1));
// A working listing ends the test: exactly ONE request, no chat dial.
const beforeModelsOnly = requestCount;
const tcModelsOnly = await runtime.testConnection(0, { apiKey: 'sk-draft', extraHeaders: {} });
check('runtime testConnection: models OK means no chat request (exactly one dial)', tcModelsOnly.ok === true && tcModelsOnly.via === 'models' && requestCount === beforeModelsOnly + 1, JSON.stringify({ via: tcModelsOnly.via, dials: requestCount - beforeModelsOnly }));
// /models gated (404): the chat fallback through the preferred model proves
// the provider usable — stage 2's endpoint, model, and reply all reported.
const tcChat = await runtime.testConnection(0, { extraHeaders: { 'x-test-models-down': '1' } });
check('runtime testConnection: /models down -> live-chat fallback via /v1/messages (glm-5.3)', tcChat.ok === true && tcChat.via === 'chat' && tcChat.model === 'glm-5.3' && tcChat.endpoint === 'http://127.0.0.1:18996/v1/messages' && String(tcChat.reply ?? '').includes('Hello world'), JSON.stringify(tcChat));
// draft.model wins and is dispatched verbatim (an unsaved editor row is testable).
const tcModel = await runtime.testConnection(0, { model: 'brand-new-model', extraHeaders: { 'x-test-models-down': '1' } });
check('runtime testConnection: draft.model probed verbatim (unsaved id ok)', tcModel.ok === true && tcModel.via === 'chat' && tcModel.model === 'brand-new-model' && lastBody.includes('"brand-new-model"'), JSON.stringify({ ok: tcModel.ok, model: tcModel.model, error: tcModel.error }));
// Protocol dispatch through the draft api field: each chat path dials its
// own endpoint shape and reads the reply from the matching SSE dialect.
const tcOai = await runtime.testConnection(0, { api: 'openai-completions', apiKey: 'sk-draft', extraHeaders: { 'x-test-models-down': '1' } });
check('runtime testConnection: openai fallback probes /v1/chat/completions and reads the reply', tcOai.ok === true && tcOai.via === 'chat' && tcOai.endpoint === 'http://127.0.0.1:18996/v1/chat/completions' && String(tcOai.reply ?? '').includes('hi there'), JSON.stringify(tcOai));
const tcResp = await runtime.testConnection(0, { api: 'openai-responses', apiKey: 'sk-draft', extraHeaders: { 'x-test-models-down': '1' } });
check('runtime testConnection: responses fallback probes /v1/responses and reads the reply', tcResp.ok === true && tcResp.via === 'chat' && tcResp.endpoint === 'http://127.0.0.1:18996/v1/responses' && String(tcResp.reply ?? '').includes('hello from responses'), JSON.stringify(tcResp));
// A draft apiKey merges over the saved one (empty literal -> env fallback).
const tcKey = await runtime.testConnection(0, { apiKey: '' });
check('runtime testConnection: empty draft apiKey falls back (env path)', tcKey.ok === true, String(tcKey.error));
const tcBadUrl = await runtime.testConnection(0, { baseURL: '://nope' });
check('runtime testConnection rejects invalid URL', tcBadUrl.ok === false && /valid URL/.test(String(tcBadUrl.error)), String(tcBadUrl.error));
const tcBadHeaders = await runtime.testConnection(0, { extraHeaders: { 'x-a': 1 } });
check('runtime testConnection rejects non-string header value', tcBadHeaders.ok === false && /extraHeaders/.test(String(tcBadHeaders.error)), String(tcBadHeaders.error));
const tcDead = await runtime.testConnection(0, { baseURL: 'http://127.0.0.1:1/' });
check('runtime testConnection: both stages fail -> combined error naming both probes', tcDead.ok === false && /models endpoint failed/.test(String(tcDead.error)) && /also failed/.test(String(tcDead.error)) && /could not reach/.test(String(tcDead.error)), String(tcDead.error));
// URL-embedded credentials must never surface in error messages.
const tcCred = await runtime.testConnection(0, { baseURL: 'http://user:sekret@127.0.0.1:1/' });
check('runtime testConnection: URL credentials redacted in errors', tcCred.ok === false && !String(tcCred.error).includes('sekret') && /\*\*\*/.test(String(tcCred.error)), String(tcCred.error));
// An upstream error body echoing the API key (misconfigured gateways bounce
// credentials back) must surface scrubbed, with the check-the-key hint.
const tcEcho = await runtime.testConnection(0, { extraHeaders: { 'x-test-models-down': '1', 'x-test-echo-key': '1' } });
check('runtime testConnection: upstream 401 echo scrubbed of the API key + key hint', tcEcho.ok === false && String(tcEcho.error).includes('upstream 401') && String(tcEcho.error).includes('check the API key') && !String(tcEcho.error).includes('sk-test'), String(tcEcho.error));
// /models gated AND no model configured: the chat fallback cannot run — the
// failure must say so, and only the listing dial happened (no chat request).
const noModelStored = { gateways: [{ ...stored.gateways[0], enabledModels: [], modelOverrides: {}, customModels: [] }] };
const noModelRuntime = new ProviderHubRuntime(
  { get: (n) => (n === 'settings' ? fakeSettings : n === 'llm' ? fakeLlm : n === 'credentials' ? runtimeCredentials : undefined), reflect: { provide: () => {} } },
  { current: () => noModelStored, resolveApiKey: async () => 'sk-test', gatewayFor: (p) => noModelStored.gateways.find((g) => g.provider === p), log: () => {} },
);
const beforeNoModel = requestCount;
const tcNoModel = await noModelRuntime.testConnection(0, { extraHeaders: { 'x-test-models-down': '1' } });
check('runtime testConnection: /models down + no model fails with guidance (listing dial only)', tcNoModel.ok === false && /models endpoint failed/.test(String(tcNoModel.error)) && /no model is configured for a chat probe/.test(String(tcNoModel.error)) && requestCount === beforeNoModel + 1, String(tcNoModel.error));
const tcBadHeaderInject = await runtime.testConnection(0, { extraHeaders: { 'x-a': 'v\nX-Inject: y' } });
check('runtime testConnection rejects CRLF header value', tcBadHeaderInject.ok === false && /line breaks/.test(String(tcBadHeaderInject.error)), String(tcBadHeaderInject.error));
// The 4 MiB listing read cap also guards testConnection's stage 1.
const rdBig = await runtime.discover(0, { extraHeaders: { 'x-test-big': '1' } });
check('runtime discover (draft): >4 MiB listing refused by read cap', rdBig.ok === false && /4 MiB/.test(String(rdBig.error)), String(rdBig.error));
const rdDraft = await runtime.discover(0, { baseURL: 'http://127.0.0.1:18996', apiKey: 'sk-draft' });
check('runtime discover (draft): listing fetched with the current form values', rdDraft.ok === true && rdDraft.models?.length === 2, JSON.stringify({ ok: rdDraft.ok, error: rdDraft.error }));
const ro = await runtime.saveOverrides(0, { 'glm-5.3': { contextWindow: 999999 } });
check('runtime saveOverrides', ro.ok === true && stored.gateways[0].modelOverrides['glm-5.3'].contextWindow === 999999);

// 9b. REGRESSION: the post-apply settings rebind must be visible to the
// typert runtime. apply() captures `current` into the runtime deps; if it
// captures the binding VALUE (the composition entry) instead of a thunk, the
// settings page reads the entry forever ("saved but list empty") even though
// settings.yaml holds the section and writes commit fine.
const rebindDoc = { gateways: [{ provider: 'hub-gateway', displayName: 'hub-gateway', baseURL: '', api: 'anthropic-messages', userAgent: 'claude-cli/2.0.1 (external, cli)', apiKeyEnv: 'GATEWAY_API_KEY', apiKey: '', extraHeaders: {}, systemRole: 'system', enabledModels: ['glm-5.3'], modelOverrides: {}, customModels: [] }] };
const cloneJson = (v) => JSON.parse(JSON.stringify(v));
let rebindRevision = 0;
let rebindWatcher = null;
const rebindSettings = {
  writable: true,
  register: () => ({
    get: () => cloneJson(rebindDoc),
    watch: (cb) => { rebindWatcher = cb; return () => {}; },
  }),
  describe: () => [{ ns: 'llm-provider-hub', value: cloneJson(rebindDoc), user: cloneJson(rebindDoc), revision: rebindRevision }],
  mutate: async (ns, ops) => {
    for (const op of ops) {
      const [head, idx, ...rest] = op.path;
      if (head === 'gateways' && op.op === 'set' && rest.length === 0) rebindDoc.gateways = op.value;
      else if (head === 'gateways' && rest.length > 0 && op.op === 'set') rebindDoc.gateways[Number(idx)][rest[0]] = op.value;
      else if (head === 'gateways' && rest.length > 0 && op.op === 'unset') delete rebindDoc.gateways[Number(idx)][rest[0]];
    }
    rebindRevision += 1;
    rebindWatcher?.(cloneJson(rebindDoc));
  },
};
const rebindInjects = {};
const rebindLlmCalls = { directory: [], adapter: [], discovery: 0 };
const rebindCtx = {
  get: () => undefined,
  llm: {
    registerConfigurableProviders: (entries) => { rebindLlmCalls.directory = entries; return { replace: (next) => { rebindLlmCalls.directory = next; } }; },
    registerAdapter: (providers, adapter) => { rebindLlmCalls.adapter = { providers: [...providers], adapter }; return { replace: (next) => { rebindLlmCalls.adapter.providers = [...next]; } }; },
    registerModelDiscovery: () => { rebindLlmCalls.discovery += 1; return () => {}; },
  },
  inject: (services, cb) => { rebindInjects[services[0]] = cb; },
  logger: { info: () => {}, warn: () => {} },
};
plugin.apply(rebindCtx, plugin.Config({ gateways: [] }));
const rebindServices = {};
const rebindTypertCtx = {
  get: (n) => (n === 'settings' ? rebindSettings : n === 'llm' ? { listProviders: () => [], listConfigurableProviders: () => [], listModels: async () => [], resolveModelInfo: async () => ({}) } : undefined),
  logger: { info: () => {}, warn: () => {} },
  typert: { register: () => {} },
  reflect: { provide: (name, value) => { rebindServices[name] = value; } },
};
rebindInjects['settings']({ settings: rebindSettings, effect: (fn) => { fn(); return () => {}; }, get: () => undefined });
rebindInjects['typert'](rebindTypertCtx);
// The model-picker fix: routes must be registered once settings binds — not
// gated on the (empty) composition entry at apply time.
check('rebind: adapter routes registered on settings bind (hub-gateway)', rebindLlmCalls.adapter.providers.includes('hub-gateway'), JSON.stringify(rebindLlmCalls.adapter.providers));
check('rebind: configurable-provider directory declared', rebindLlmCalls.directory.some((e) => e.provider === 'hub-gateway'), JSON.stringify(rebindLlmCalls.directory));
check('rebind: model discovery registered once', rebindLlmCalls.discovery === 1, String(rebindLlmCalls.discovery));
const rebindRuntime = rebindServices.providerHub;
check('rebind: runtime captured (providerHub service)', rebindRuntime !== undefined, String(rebindRuntime));
const rebindState = await rebindRuntime.getState();
check('rebind: getState sees settings doc (1 gateway, not entry 0)', rebindState.ok === true && rebindState.gateways.length === 1, JSON.stringify({ ok: rebindState.ok, gateways: rebindState.gateways?.length }));
const rebindAdd = await rebindRuntime.addGateway();
check('rebind: addGateway appends (2 gateways, index 1)', rebindAdd.ok === true && rebindDoc.gateways.length === 2 && rebindAdd.index === 1, JSON.stringify({ ok: rebindAdd.ok, n: rebindDoc.gateways.length, index: rebindAdd.index }));
check('rebind: addGateway dedupes to hub-gateway-1', rebindAdd.gateway?.provider === 'hub-gateway-1', String(rebindAdd.gateway?.provider));
const rebindState2 = await rebindRuntime.getState();
check('rebind: getState after add sees 2 gateways', rebindState2.ok === true && rebindState2.gateways.length === 2, JSON.stringify({ gateways: rebindState2.gateways?.length }));

// 9b-2. Provider rename applies LIVE (routes are re-registered on every
// settings commit) — the old "change requires restart" hint was stale. Also
// guard the new collision checks: a rename onto another gateway's route name
// or onto an empty string must be refused at write time.
const rename = await rebindRuntime.saveConfig(1, { provider: 'renamed-gw' });
check('rename: saveConfig ok', rename.ok === true, String(rename.error));
check('rename: adapter routes re-synced live (no restart)', rebindLlmCalls.adapter.providers.includes('renamed-gw') && !rebindLlmCalls.adapter.providers.includes('hub-gateway-1'), JSON.stringify(rebindLlmCalls.adapter.providers));
check('rename: configurable-provider directory re-synced live', rebindLlmCalls.directory.some((e) => e.provider === 'renamed-gw') && !rebindLlmCalls.directory.some((e) => e.provider === 'hub-gateway-1'), JSON.stringify(rebindLlmCalls.directory));
const renameTrimmed = await rebindRuntime.saveConfig(1, { provider: '  trimmed-gw  ' });
const renameTrimmedState = await rebindRuntime.getState();
check('rename: provider id is trimmed before save', renameTrimmed.ok === true && renameTrimmedState.gateways?.[1]?.gateway?.provider === 'trimmed-gw', JSON.stringify(renameTrimmedState.gateways?.[1]?.gateway?.provider));
const renameCollide = await rebindRuntime.saveConfig(1, { provider: 'hub-gateway' });
check('rename: collision with another gateway refused', renameCollide.ok === false && /already used/.test(String(renameCollide.error)), String(renameCollide.error));
const renameEmpty = await rebindRuntime.saveConfig(1, { provider: '  ' });
check('rename: empty provider id refused', renameEmpty.ok === false && /must not be empty/.test(String(renameEmpty.error)), String(renameEmpty.error));
// 9b-3. Display name DEFAULTS to the provider id: an empty/whitespace display
// name is normalized to the provider id on save (clearing the field resets
// it), a filled-in name is trimmed and kept, and the re-synced directory
// shows the provider id when no display name was given.
const dnBlank = await rebindRuntime.saveConfig(1, { displayName: '   ' });
check('saveConfig: blank displayName defaults to the provider id', dnBlank.ok === true && rebindDoc.gateways[1].displayName === 'trimmed-gw', JSON.stringify(rebindDoc.gateways[1].displayName));
check('saveConfig: blank displayName re-syncs directory with the provider id', rebindLlmCalls.directory.some((e) => e.provider === 'trimmed-gw' && e.displayName === 'trimmed-gw'), JSON.stringify(rebindLlmCalls.directory));
const dnCustom = await rebindRuntime.saveConfig(1, { displayName: '  Custom GW  ' });
check('saveConfig: custom displayName trimmed and kept', dnCustom.ok === true && rebindDoc.gateways[1].displayName === 'Custom GW', JSON.stringify(rebindDoc.gateways[1].displayName));
const dnBad = await rebindRuntime.saveConfig(1, { displayName: 42 });
check('saveConfig: non-string displayName refused', dnBad.ok === false && /displayName must be a string/.test(String(dnBad.error)), String(dnBad.error));
const dnKeep = await rebindRuntime.saveConfig(1, { displayName: 'trimmed-gw' });
check('saveConfig: displayName equal to the provider id stored as-is', dnKeep.ok === true && rebindDoc.gateways[1].displayName === 'trimmed-gw', JSON.stringify(rebindDoc.gateways[1].displayName));

// 9b-3. saveConfig wire-field validation: bad protocol values, URLs, and
// header-injecting CR/LF values are refused at write time.
const badApi = await rebindRuntime.saveConfig(1, { api: 'grpc' });
check('saveConfig: unknown api protocol refused', badApi.ok === false && /api must be/.test(String(badApi.error)), String(badApi.error));
const okApi = await rebindRuntime.saveConfig(1, { api: 'openai-completions' });
check('saveConfig: valid api accepted', okApi.ok === true, String(okApi.error));
const badSystemRole = await rebindRuntime.saveConfig(1, { systemRole: 'assistant' });
check('saveConfig: unknown systemRole refused', badSystemRole.ok === false && /systemRole/.test(String(badSystemRole.error)), String(badSystemRole.error));
const badBaseURL = await rebindRuntime.saveConfig(1, { baseURL: '://nope' });
check('saveConfig: invalid baseURL refused', badBaseURL.ok === false && /valid URL/.test(String(badBaseURL.error)), String(badBaseURL.error));
const badScheme = await rebindRuntime.saveConfig(1, { baseURL: 'ftp://gw.example.com' });
check('saveConfig: non-http(s) baseURL refused', badScheme.ok === false && /http or https/.test(String(badScheme.error)), String(badScheme.error));
const okBaseURL = await rebindRuntime.saveConfig(1, { baseURL: 'http://127.0.0.1:18996/v1' });
check('saveConfig: valid baseURL accepted', okBaseURL.ok === true, String(okBaseURL.error));
const badUA = await rebindRuntime.saveConfig(1, { userAgent: 'ua\r\nX-Inject: 1' });
check('saveConfig: CRLF userAgent refused', badUA.ok === false && /line breaks/.test(String(badUA.error)), String(badUA.error));
const badHeaderName = await rebindRuntime.saveConfig(1, { extraHeaders: { 'x-a\r\nX-Inject': 'v' } });
check('saveConfig: CRLF header name refused', badHeaderName.ok === false && /line breaks/.test(String(badHeaderName.error)), String(badHeaderName.error));
const okHeaders = await rebindRuntime.saveConfig(1, { extraHeaders: { 'x-fine': 'v' } });
check('saveConfig: clean headers accepted', okHeaders.ok === true, String(okHeaders.error));
const badStreamUsage = await rebindRuntime.saveConfig(1, { streamUsage: 'yes' });
check('saveConfig: non-boolean streamUsage refused', badStreamUsage.ok === false && /streamUsage/.test(String(badStreamUsage.error)), String(badStreamUsage.error));

// 9c. Model-edit phase 1: unified upsertModel/deleteModel RPCs (offline:
// pure settings mutation through the fake settings service — no network).
const gwSnap = () => JSON.stringify(stored.gateways[0]);

// 9c-1. builtin add with params: ensures enabledModels + writes the override
const upB = await runtime.upsertModel(0, { id: 'deepseek-v3', name: 'DS V3 Hub', contextWindow: 131072, reasoningEfforts: { off: null, low: 'low' } }, false, []);
const ovB = stored.gateways[0].modelOverrides['deepseek-v3'];
check('upsertModel builtin add: enables + writes override fields', upB.ok === true && upB.kind === 'builtin'
  && stored.gateways[0].enabledModels.includes('deepseek-v3')
  && ovB?.name === 'DS V3 Hub' && ovB?.contextWindow === 131072 && ovB?.reasoningEfforts?.low === 'low' && !('maxTokens' in (ovB ?? {})), JSON.stringify({ ok: upB.ok, ov: ovB }));
check('upsertModel builtin add: envelope carries resolved models', upB.models?.some((m) => m.id === 'deepseek-v3' && m.name === 'DS V3 Hub' && m.reasoning?.low === 'low'), JSON.stringify(upB.models?.find((m) => m.id === 'deepseek-v3')));

// 9c-2. overwrite=false refuses an already-configured builtin, config unchanged
const snapB = gwSnap();
const upB2 = await runtime.upsertModel(0, { id: 'deepseek-v3', maxTokens: 4096 }, false, []);
check('upsertModel builtin overwrite=false refused', upB2.ok === false && /already has saved overrides/.test(String(upB2.error)), String(upB2.error));
check('upsertModel builtin refusal left config unchanged', gwSnap() === snapB);

// 9c-3. override merge + clearFields: fields merge, cleared field falls back to catalog
const upB3 = await runtime.upsertModel(0, { id: 'deepseek-v3', name: 'DS V3 Renamed', maxTokens: 4096 }, true, ['contextWindow']);
const ovB3 = stored.gateways[0].modelOverrides['deepseek-v3'];
check('upsertModel merge: fields merged, clearFields removed contextWindow', upB3.ok === true
  && ovB3?.name === 'DS V3 Renamed' && ovB3?.maxTokens === 4096 && ovB3?.reasoningEfforts?.low === 'low' && !('contextWindow' in (ovB3 ?? {})), JSON.stringify(ovB3));
const resolvedB3 = upB3.models?.find((m) => m.id === 'deepseek-v3');
check('upsertModel merge: cleared field falls back to catalog values', resolvedB3?.contextWindow === 128000 && resolvedB3?.maxTokens === 4096 && resolvedB3?.name === 'DS V3 Renamed', JSON.stringify(resolvedB3));

// 9c-4. custom add: capacities required (no silent 128000/8192), input filtered + deduped
const upC = await runtime.upsertModel(0, { id: 'hub-custom-1', name: 'Hub Custom', contextWindow: 32000, maxTokens: 2048, input: ['text', 'image', 'audio', 'text'] }, false, []);
check('upsertModel custom add: stored with positive capacities + filtered input', upC.ok === true && upC.kind === 'custom'
  && stored.gateways[0].customModels.some((m) => m.id === 'hub-custom-1' && m.contextWindow === 32000 && m.maxTokens === 2048 && JSON.stringify(m.input) === JSON.stringify(['text', 'image'])), JSON.stringify(stored.gateways[0].customModels));

const snapC = gwSnap();
const upC2 = await runtime.upsertModel(0, { id: 'hub-custom-2', name: 'No Caps' }, false, []);
check('upsertModel custom add without capacities refused (no silent fallback)', upC2.ok === false && /positive integer contextWindow/.test(String(upC2.error)), String(upC2.error));
const upC3 = await runtime.upsertModel(0, { id: 'hub-custom-2', contextWindow: 0, maxTokens: 2048 }, false, []);
check('upsertModel custom add with non-positive contextWindow refused', upC3.ok === false, String(upC3.error));
const upC4 = await runtime.upsertModel(0, { id: 'hub-custom-2', contextWindow: 32000.5, maxTokens: 2048 }, false, []);
check('upsertModel custom add with non-integer contextWindow refused', upC4.ok === false, String(upC4.error));
check('upsertModel custom refusals left config unchanged', gwSnap() === snapC);

// 9c-5. custom edit (overwrite=true): unedited fields kept, wire values trimmed
const upC5 = await runtime.upsertModel(0, { id: 'hub-custom-1', contextWindow: 48000, reasoningEfforts: { off: null, high: ' HIGH ' } }, true, []);
const edited = stored.gateways[0].customModels.find((m) => m.id === 'hub-custom-1');
check('upsertModel custom edit: kept fields + trimmed wire value', upC5.ok === true
  && edited?.name === 'Hub Custom' && edited?.contextWindow === 48000 && edited?.maxTokens === 2048
  && edited?.reasoningEfforts?.high === 'HIGH' && edited?.reasoningEfforts?.off === null, JSON.stringify(edited));

// 9c-6. reasoningEfforts=false on a custom entry clears the map (non-reasoning)
const upC6 = await runtime.upsertModel(0, { id: 'hub-custom-1', reasoningEfforts: false }, true, []);
const nonReasoning = stored.gateways[0].customModels.find((m) => m.id === 'hub-custom-1');
check('upsertModel custom: reasoningEfforts=false clears the map', upC6.ok === true && nonReasoning?.reasoningEfforts === undefined, JSON.stringify(nonReasoning));

// 9c-7. rename: editing with a changed id forms a NEW custom, old entry removed
const upR = await runtime.upsertModel(0, { id: 'hub-custom-2', name: 'Renamed Model', originalId: 'hub-custom-1' }, false, []);
check('upsertModel rename: old id removed, new id present with kept params', upR.ok === true && upR.kind === 'custom'
  && !stored.gateways[0].customModels.some((m) => m.id === 'hub-custom-1')
  && stored.gateways[0].customModels.some((m) => m.id === 'hub-custom-2' && m.name === 'Renamed Model' && m.contextWindow === 48000 && m.maxTokens === 2048), JSON.stringify(stored.gateways[0].customModels));

// 9c-8. overwrite=false refuses an existing custom id
const upD = await runtime.upsertModel(0, { id: 'hub-custom-2', name: 'Dup', contextWindow: 32000, maxTokens: 2048 }, false, []);
check('upsertModel custom overwrite=false refused', upD.ok === false && /already exists/.test(String(upD.error)), String(upD.error));

// 9c-9. builtin/custom same-id conflict (the legacy upsertCustom RPC can create the shadow)
const mkShadow = await runtime.upsertCustom(0, { id: 'glm-5.3', name: 'Shadow GLM', contextWindow: 200000, maxTokens: 131072 }, null);
check('setup: legacy upsertCustom created a same-id shadow (old RPC unchanged)', mkShadow.ok === true && stored.gateways[0].customModels.some((m) => m.id === 'glm-5.3'));
const snapX = gwSnap();
const upX = await runtime.upsertModel(0, { id: 'glm-5.3', maxTokens: 1 }, true, []);
check('upsertModel conflict: builtin id shadowed by custom entry refused', upX.ok === false && /custom model with the same id/.test(String(upX.error)), String(upX.error));
const upX2 = await runtime.upsertModel(0, { id: 'glm-5.3-flash', originalId: 'hub-custom-2', name: 'Nope' }, true, []);
check('upsertModel conflict: renaming a custom onto a built-in id refused', upX2.ok === false && /onto built-in id/.test(String(upX2.error)), String(upX2.error));
check('upsertModel conflict refusals left config unchanged', gwSnap() === snapX);
const cleanupShadow = await runtime.deleteCustom(0, 'glm-5.3');
check('cleanup: shadow removed via legacy deleteCustom', cleanupShadow.ok === true);

// 9c-10. delete builtin removes enabledModels AND the override together
const upK = await runtime.upsertModel(0, { id: 'kimi-k2', name: 'Kimi Hub', contextWindow: 131072, maxTokens: 16384, reasoningEfforts: { off: null, max: 'max' } }, false, []);
check('setup: kimi-k2 builtin configured via upsertModel', upK.ok === true && stored.gateways[0].enabledModels.includes('kimi-k2') && stored.gateways[0].modelOverrides['kimi-k2']?.maxTokens === 16384, String(upK.error));
const delB = await runtime.deleteModel(0, 'kimi-k2');
check('deleteModel builtin: removes enabledModels + override together', delB.ok === true && delB.kind === 'builtin'
  && !stored.gateways[0].enabledModels.includes('kimi-k2') && stored.gateways[0].modelOverrides['kimi-k2'] === undefined, JSON.stringify({ ok: delB.ok, err: delB.error }));

// 9c-11. delete custom removes the entry; unknown/unconfigured ids refused
const delC = await runtime.deleteModel(0, 'hub-custom-2');
check('deleteModel custom: removes the entry', delC.ok === true && delC.kind === 'custom' && !stored.gateways[0].customModels.some((m) => m.id === 'hub-custom-2'), String(delC.error));
const delGhost = await runtime.deleteModel(0, 'hub-custom-2');
check('deleteModel unknown id refused', delGhost.ok === false && /does not exist/.test(String(delGhost.error)), String(delGhost.error));
const delUnset = await runtime.deleteModel(0, 'kimi-k2');
check('deleteModel unconfigured builtin refused', delUnset.ok === false && /not configured/.test(String(delUnset.error)), String(delUnset.error));

// 9c-12. invalid reasoning maps refused at validation; config untouched
const snapReason = gwSnap();
const upBad1 = await runtime.upsertModel(0, { id: 'gpt-4o-mini', reasoningEfforts: { off: null, low: null } }, false, []);
check('upsertModel: non-off null wire value refused', upBad1.ok === false && /needs the wire value/.test(String(upBad1.error)), String(upBad1.error));
const upBad2 = await runtime.upsertModel(0, { id: 'gpt-4o-mini', reasoningEfforts: { off: null } }, false, []);
check('upsertModel: off-only map refused', upBad2.ok === false && /non-off level/.test(String(upBad2.error)), String(upBad2.error));
const upBad3 = await runtime.upsertModel(0, { id: 'gpt-4o-mini', reasoningEfforts: { off: null, turbo: 'turbo' } }, false, []);
check('upsertModel: unknown level refused', upBad3.ok === false && /unknown reasoning level/.test(String(upBad3.error)), String(upBad3.error));
const upBad4 = await runtime.upsertModel(0, { id: 'gpt-4o-mini', reasoningEfforts: { off: null, high: '' } }, false, []);
check('upsertModel: empty wire value refused', upBad4.ok === false && /non-empty string/.test(String(upBad4.error)), String(upBad4.error));
const upBad5 = await runtime.upsertModel(0, { id: 'gpt-4o-mini', reasoningEfforts: false }, false, []);
check('upsertModel builtin: reasoningEfforts=false refused (catalog reasoning only clearable via override)', upBad5.ok === false && /cannot declare reasoningEfforts: false/.test(String(upBad5.error)), String(upBad5.error));
check('upsertModel: refused writes left config unchanged', gwSnap() === snapReason);

// 9c-13. saveOverrides pre-write resolve check: a map the read side would refuse never lands
const roBad = await runtime.saveOverrides(0, { 'glm-5.3': { reasoningEfforts: { off: null } } });
check('saveOverrides: off-only map refused before write', roBad.ok === false && /refusing to save/.test(String(roBad.error)) && /no level beyond "off"/.test(String(roBad.error)), String(roBad.error));
check('saveOverrides refusal left config unchanged', gwSnap() === snapReason);

// 9c-14. legacy-compat delete: an id unknown to the catalog but present in
// enabledModels (hand-edited settings / retired catalog entry) is cleaned up
// instead of wedging the unified delete; the read side keeps skipping it.
const toggleUnknown = await runtime.toggleBuiltin(0, 'retired-legacy-model', true);
check('setup: unknown id enabled via legacy toggleBuiltin (read-side compat kept)', toggleUnknown.ok === true && stored.gateways[0].enabledModels.includes('retired-legacy-model'));
const delOrphan = await runtime.deleteModel(0, 'retired-legacy-model');
check('deleteModel legacy unknown id: cleaned from enabledModels (orphan path)', delOrphan.ok === true && delOrphan.kind === 'orphan' && !stored.gateways[0].enabledModels.includes('retired-legacy-model'), String(delOrphan.error));

// 9d. Whole-list model save (save-models): the LIST is the source of truth,
// the params groups ride along; this backs the cc-switch-style single-保存
// editor. State at this point: enabledModels [glm-5.3, claude-opus-4-8,
// deepseek-v3], overrides {glm-5.3: {contextWindow: 999999}}, customModels [].
const smState = () => stored.gateways[0];
const sm1 = await runtime.saveModels(0, [
  { id: 'glm-5.3', name: 'GLM via list' },
  { id: 'deepseek-v3' },
  { id: 'claude-opus-4-8' },
  { id: 'cc-custom', name: 'CC Custom' },
], {
  'glm-5.3': { contextWindow: 200000 },
  'cc-custom': { contextWindow: 64000, maxTokens: 4096 },
});
check('saveModels: list replace ok + resolved models ride the envelope', sm1.ok === true && Array.isArray(sm1.models) && sm1.models.some((m) => m.id === 'cc-custom'), JSON.stringify({ ok: sm1.ok, error: sm1.error }));
check('saveModels: builtin rows land in enabledModels (list order)', JSON.stringify(smState().enabledModels) === JSON.stringify(['glm-5.3', 'deepseek-v3', 'claude-opus-4-8']), JSON.stringify(smState().enabledModels));
check('saveModels: builtin group rebuilt + row name wins', smState().modelOverrides['glm-5.3']?.contextWindow === 200000 && smState().modelOverrides['glm-5.3']?.name === 'GLM via list', JSON.stringify(smState().modelOverrides));
check('saveModels: builtin row without a group keeps only unmanaged override keys', smState().modelOverrides['deepseek-v3']?.reasoningEfforts?.low === 'low'
  && smState().modelOverrides['deepseek-v3']?.name === undefined && smState().modelOverrides['deepseek-v3']?.maxTokens === undefined, JSON.stringify(smState().modelOverrides));
check('saveModels: custom row becomes a customModels entry with group params', smState().customModels.some((m) => m.id === 'cc-custom' && m.name === 'CC Custom' && m.contextWindow === 64000 && m.maxTokens === 4096), JSON.stringify(smState().customModels));

// 9d-2. unmanaged keys (input / reasoningEfforts) survive a group that omits them
await runtime.saveConfig(0, { modelOverrides: { ...smState().modelOverrides, 'deepseek-v3': { input: ['image'], reasoningEfforts: { off: null, low: 'low' } } } });
const sm2 = await runtime.saveModels(0, [
  { id: 'glm-5.3', name: 'GLM via list' },
  { id: 'deepseek-v3' },
  { id: 'claude-opus-4-8' },
  { id: 'cc-custom', name: 'CC Custom' },
], { 'glm-5.3': { contextWindow: 250000 } });
const sm2Ov = smState().modelOverrides;
check('saveModels: unmanaged override keys preserved, managed keys from group', sm2.ok === true
  && sm2Ov['deepseek-v3']?.input?.[0] === 'image' && sm2Ov['deepseek-v3']?.reasoningEfforts?.low === 'low' && sm2Ov['deepseek-v3']?.contextWindow === undefined && sm2Ov['deepseek-v3']?.name === undefined
  && sm2Ov['glm-5.3']?.contextWindow === 250000, JSON.stringify(sm2Ov));

// 9d-3. ids configured before but absent from the submitted list are dropped
const sm3 = await runtime.saveModels(0, [{ id: 'glm-5.3', name: 'GLM via list' }], { 'glm-5.3': { contextWindow: 250000 } });
check('saveModels: removed ids dropped from enabledModels + overrides + customModels', sm3.ok === true
  && JSON.stringify(smState().enabledModels) === JSON.stringify(['glm-5.3'])
  && smState().modelOverrides['deepseek-v3'] === undefined && smState().customModels.length === 0, JSON.stringify({ e: smState().enabledModels, o: smState().modelOverrides, c: smState().customModels }));

// 9d-4. refusals leave the config untouched
const smSnap = JSON.stringify(smState());
const sm4 = await runtime.saveModels(0, [{ id: 'no-caps' }], {});
check('saveModels: custom row without capacities refused (no silent fallback)', sm4.ok === false && /positive integer contextWindow/.test(String(sm4.error)), String(sm4.error));
const sm5 = await runtime.saveModels(0, [{ id: 'glm-5.3' }], { 'glm-5.3': { reasoningEfforts: false } });
check('saveModels: builtin group with reasoningEfforts=false refused', sm5.ok === false && /cannot declare reasoningEfforts: false/.test(String(sm5.error)), String(sm5.error));
const sm6 = await runtime.saveModels(0, [{ id: 'glm-5.3' }, { id: 'glm-5.3' }], {});
check('saveModels: duplicate row ids refused', sm6.ok === false && /duplicate model id/.test(String(sm6.error)), String(sm6.error));
const sm7 = await runtime.saveModels(0, [{ id: '   ' }], {});
check('saveModels: empty row id refused', sm7.ok === false && /non-empty id/.test(String(sm7.error)), String(sm7.error));
const sm8 = await runtime.saveModels(0, [{ id: 'glm-5.3' }], { 'glm-5.3': { contextWindow: 0 } });
check('saveModels: invalid group capacity refused with params.<id> context', sm8.ok === false && /params\.glm-5\.3/.test(String(sm8.error)) && /positive integer/.test(String(sm8.error)), String(sm8.error));
check('saveModels: refusals left config unchanged', JSON.stringify(smState()) === smSnap);

// 9d-5. custom entry with reasoningEfforts=false stores NO map; group name loses to the row name
const sm9 = await runtime.saveModels(0, [
  { id: 'cc-flat', name: 'Flat' },
  { id: 'glm-5.3', name: 'RowName' },
], {
  'cc-flat': { contextWindow: 64000, maxTokens: 4096, reasoningEfforts: false },
  'glm-5.3': { name: 'JsonName', contextWindow: 1000 },
});
check('saveModels: custom reasoningEfforts=false clears the map', sm9.ok === true
  && smState().customModels.some((m) => m.id === 'cc-flat' && m.contextWindow === 64000 && !('reasoningEfforts' in m)), JSON.stringify(smState().customModels));
check('saveModels: group name ignored (list row display name wins)', smState().modelOverrides['glm-5.3']?.name === 'RowName' && smState().modelOverrides['glm-5.3']?.contextWindow === 1000, JSON.stringify(smState().modelOverrides));

// 7. Model discovery (echo /models) — draft request routed by baseURL.
// The echo listing holds 3 non-empty ids with one duplicate: the count of 2
// proves id dedupe (first occurrence wins).
const discovered = await registered.discovery.fn({ baseURL: 'http://127.0.0.1:18996', apiKey: 'sk-test' });
check('discovery: duplicate ids deduped (2 of 3 kept)', discovered.length === 2 && discovered[0].id === 'glm-5.3' && discovered[1].id === 'glm-4.6', JSON.stringify(discovered));
check('discovery: params mapped', discovered[0].contextWindow === 200000 && discovered[0].maxTokens === 131072, JSON.stringify(discovered[0]));

// 8. Offline wire probe through the adapter (the historical live probe against
// an external gateway was retired — tests must not touch the network). The
// regression intent is kept: the custom UA and the credential must actually
// reach the wire (UA-gate semantics), and the stream must complete.
const offlineConfig = plugin.Config({ gateways: [{
  provider: 'air-outer',
  baseURL: 'http://127.0.0.1:18996',
  api: 'anthropic-messages',
  userAgent: 'claude-cli/2.0.1 (external, cli)',
  apiKey: 'sk-aQ3po5zL-FAKE-KEY',
  enabledModels: ['glm-5.3'],
}] }).gateways[0];
const offlineAdapter = new (Object.getPrototypeOf(adapter).constructor)({
  current: () => ({ gateways: [offlineConfig] }),
  gatewayFor: (p) => offlineConfig.provider === p ? offlineConfig : undefined,
  resolveApiKey: async () => 'sk-aQ3po5zL-FAKE-KEY',
  preset: () => undefined,
});
const offlineStream = offlineAdapter.stream({ provider: 'air-outer', model: 'glm-5.3', maxTokens: 8, messages: [{ role: 'user', content: [{ type: 'text', text: 'hi' }] }] });
const offlineChunks = [];
for await (const c of offlineStream) offlineChunks.push(c);
const offlineFinish = offlineChunks.find((c) => c.type === 'finish');
check('offline probe: custom UA + key reach the wire', lastSeenHeaders?.ua === 'claude-cli/2.0.1 (external, cli)' && lastSeenHeaders?.key === 'sk-aQ3po5zL-FAKE-KEY', JSON.stringify(lastSeenHeaders));
check('offline probe: stream completes (finish stop)', offlineFinish?.reason?.kind === 'stop', JSON.stringify(offlineFinish?.reason ?? null));

// 8b. An upstream error body echoing the API key (misconfigured gateways do
// bounce the Authorization header back) must come back scrubbed.
const echoConfig = plugin.Config({ gateways: [{
  provider: 'echo-key',
  baseURL: 'http://127.0.0.1:18996',
  api: 'openai-completions',
  userAgent: 'ua-echo',
  apiKey: 'sk-ECHO-SECRET-123',
  extraHeaders: { 'x-test-echo-key': '1' },
  enabledModels: ['glm-5.3'],
}] }).gateways[0];
const echoAdapter = new (Object.getPrototypeOf(adapter).constructor)({
  current: () => ({ gateways: [echoConfig] }),
  gatewayFor: (p) => echoConfig.provider === p ? echoConfig : undefined,
  resolveApiKey: async () => 'sk-ECHO-SECRET-123',
  preset: () => undefined,
});
const echoChunks = [];
for await (const c of echoAdapter.stream({ provider: 'echo-key', model: 'glm-5.3', maxTokens: 8, messages: [{ role: 'user', content: 'hi' }] })) echoChunks.push(c);
const echoFailure = echoChunks.at(-1)?.reason?.failure;
check('upstream error echoes are scrubbed of the API key', echoFailure?.code === 'UPSTREAM_ERROR'
  && String(echoFailure?.message ?? '').includes('upstream 401')
  && !String(echoFailure?.message ?? '').includes('sk-ECHO-SECRET-123'), JSON.stringify(echoFailure ?? null));

// 10. Three-protocol + endpoint-mode coverage (offline echo server only).
// 10a. openai-responses path: auto mode (bare host) dials /v1/responses with a
// Responses-shaped body and Bearer auth; the stream converts text + tool call
// + usage + finish.
const respConfig = plugin.Config({ gateways: [{
  provider: 'resp-gw',
  baseURL: 'http://127.0.0.1:18996',
  api: 'openai-responses',
  userAgent: 'ua-resp',
  apiKey: 'sk-resp',
  enabledModels: ['glm-5.3'],
}] }).gateways[0];
check('schema defaults: endpointMode auto + endpoint empty (old configs stay auto)', respConfig.endpointMode === 'auto' && respConfig.endpoint === '', JSON.stringify({ mode: respConfig.endpointMode, endpoint: respConfig.endpoint }));
const respAdapter = new (Object.getPrototypeOf(adapter).constructor)({
  current: () => ({ gateways: [respConfig] }),
  gatewayFor: (p) => respConfig.provider === p ? respConfig : undefined,
  resolveApiKey: async () => 'sk-resp',
});
const respChunks = [];
for await (const c of respAdapter.stream({
  provider: 'resp-gw',
  model: 'glm-5.3',
  maxTokens: 64,
  reasoningEffort: 'high',
  system: 'You are terse.',
  tools: [{ name: 'web_search', description: 'search', parameters: { type: 'object', properties: { q: { type: 'string' } } } }],
  messages: [{ role: 'user', content: [{ type: 'text', text: 'hi' }] }],
})) respChunks.push(c);
check('responses e2e: text delta converted', respChunks.some((c) => c.type === 'text-delta' && c.text === 'hello from responses'), JSON.stringify(respChunks.map((c) => c.type)));
check('responses e2e: tool-call block closed with name + args', respChunks.some((c) => c.type === 'block-end' && c.block?.type === 'tool-call' && c.block?.name === 'web_search' && c.block?.arguments === '{"q":"hub"}'), JSON.stringify(respChunks));
const respUsage = respChunks.find((c) => c.type === 'usage')?.usage;
check('responses e2e: usage mapped (input split cached, reasoning carried)', respUsage?.inputTokens === 60 && respUsage?.cacheReadTokens === 40 && respUsage?.outputTokens === 20 && respUsage?.reasoningTokens === 5, JSON.stringify(respUsage));
check('responses e2e: finish tool-calls (function call streamed)', respChunks.at(-1)?.reason?.kind === 'tool-calls', JSON.stringify(respChunks.at(-1)));
check('responses e2e: wire URL /v1/responses (auto, bare host)', lastSeenHeaders?.url === '/v1/responses', String(lastSeenHeaders?.url));
check('responses e2e: wire UA + Bearer auth', lastSeenHeaders?.full?.['user-agent'] === 'ua-resp' && lastSeenHeaders?.full?.authorization === 'Bearer sk-resp', JSON.stringify(lastSeenHeaders?.full));
check('responses e2e: body uses model/input/instructions/tools/stream', ['"model":"glm-5.3"', '"input"', '"instructions":"You are terse."', '"tools":[{"type":"function","name":"web_search"', '"stream":true'].every((s) => lastBody.includes(s)), lastBody.slice(0, 400));
check('responses e2e: max_output_tokens (not Chat max_tokens)', lastBody.includes('"max_output_tokens":64') && !lastBody.includes('"max_tokens"'), lastBody.slice(0, 200));
check('responses e2e: effort in reasoning.effort (existing mapping)', lastBody.includes('"reasoning":{"effort":"high"}'), lastBody.slice(0, 200));
check('responses e2e: no Chat-only stream_options on the Responses wire', !lastBody.includes('stream_options'), lastBody.slice(0, 200));

// 10b. responses + systemRole developer: instruction rides as a developer
// input item instead of the top-level instructions parameter.
const respDevConfig = plugin.Config({ gateways: [{ ...respConfig, systemRole: 'developer' }] }).gateways[0];
const respDevAdapter = new (Object.getPrototypeOf(adapter).constructor)({
  current: () => ({ gateways: [respDevConfig] }),
  gatewayFor: (p) => respDevConfig.provider === p ? respDevConfig : undefined,
  resolveApiKey: async () => 'sk-resp',
});
for await (const _c of respDevAdapter.stream({ provider: 'resp-gw', model: 'glm-5.3', maxTokens: 8, system: 'sys text', messages: [{ role: 'user', content: 'hi' }] })) { /* drain */ }
check('responses e2e: systemRole developer -> developer input item, no instructions param', lastBody.includes('"role":"developer"') && lastBody.includes('sys text') && !lastBody.includes('"instructions"'), lastBody.slice(0, 300));

// 10c. custom endpoint mode: the chat request dials the COMPLETE endpoint URL
// verbatim (no path appended, no /v1 inserted) and an empty baseURL is legal.
const customConfig = plugin.Config({ gateways: [{
  provider: 'custom-gw',
  baseURL: '',
  endpointMode: 'custom',
  endpoint: 'http://127.0.0.1:18996/custom/v1/chat/completions',
  api: 'openai-completions',
  userAgent: 'ua-custom',
  apiKey: 'sk-custom',
  enabledModels: ['glm-5.3'],
}] }).gateways[0];
const customAdapter = new (Object.getPrototypeOf(adapter).constructor)({
  current: () => ({ gateways: [customConfig] }),
  gatewayFor: (p) => customConfig.provider === p ? customConfig : undefined,
  resolveApiKey: async () => 'sk-custom',
});
const customChunks = [];
for await (const c of customAdapter.stream({ provider: 'custom-gw', model: 'glm-5.3', maxTokens: 16, messages: [{ role: 'user', content: 'hi' }] })) customChunks.push(c);
check('custom mode chat: complete endpoint dialed verbatim (/custom/v1/... kept, no /v1 insert)', lastSeenHeaders?.url === '/custom/v1/chat/completions', String(lastSeenHeaders?.url));
check('custom mode chat: stream works with empty baseURL', customChunks.some((c) => c.type === 'text-delta') && customChunks.at(-1)?.reason?.kind === 'stop', JSON.stringify(customChunks.map((c) => c.type)));

// 10d. custom mode responses endpoint: same verbatim rule for /responses.
const customRespConfig = plugin.Config({ gateways: [{ ...customConfig, endpoint: 'http://127.0.0.1:18996/my-responses', api: 'openai-responses' }] }).gateways[0];
const customRespAdapter = new (Object.getPrototypeOf(adapter).constructor)({
  current: () => ({ gateways: [customRespConfig] }),
  gatewayFor: (p) => customRespConfig.provider === p ? customRespConfig : undefined,
  resolveApiKey: async () => 'sk-custom',
});
for await (const _c of customRespAdapter.stream({ provider: 'custom-gw', model: 'glm-5.3', maxTokens: 8, messages: [{ role: 'user', content: 'hi' }] })) { /* drain */ }
check('custom mode responses: complete endpoint dialed verbatim', lastSeenHeaders?.url === '/my-responses', String(lastSeenHeaders?.url));

// 10e. custom mode anthropic messages endpoint + auth headers.
const customAnthropicConfig = plugin.Config({ gateways: [{ ...customConfig, endpoint: 'http://127.0.0.1:18996/my-messages', api: 'anthropic-messages' }] }).gateways[0];
const customAnthropicAdapter = new (Object.getPrototypeOf(adapter).constructor)({
  current: () => ({ gateways: [customAnthropicConfig] }),
  gatewayFor: (p) => customAnthropicConfig.provider === p ? customAnthropicConfig : undefined,
  resolveApiKey: async () => 'sk-anthropic',
});
const customAnthropicChunks = [];
for await (const c of customAnthropicAdapter.stream({ provider: 'custom-gw', model: 'glm-5.3', maxTokens: 8, messages: [{ role: 'user', content: 'hi' }] })) customAnthropicChunks.push(c);
check('custom mode anthropic: complete endpoint dialed verbatim', lastSeenHeaders?.url === '/my-messages', String(lastSeenHeaders?.url));
check('custom mode anthropic: x-api-key + anthropic-version on the wire (no Bearer)', lastSeenHeaders?.full?.['x-api-key'] === 'sk-anthropic' && lastSeenHeaders?.full?.['anthropic-version'] === '2023-06-01' && lastSeenHeaders?.full?.authorization === undefined, JSON.stringify(lastSeenHeaders?.full));
check('custom mode anthropic: stream completes', customAnthropicChunks.at(-1)?.reason?.kind === 'stop', JSON.stringify(customAnthropicChunks.at(-1)));

// 10f. custom mode chat without endpoint refused BEFORE network I/O.
// Counting order (same bracket discipline as 6e/6f): the requestCount snapshot
// is taken immediately BEFORE the drain — after all (synchronous) setup — so
// the bracket covers only the operation under test and any increment inside
// it means the refusal leaked network I/O. The strict equality and the
// refusal-message match must both stay intact.
const noEndpointConfig = plugin.Config({ gateways: [{ ...customConfig, endpoint: '  ' }] }).gateways[0];
const noEndpointAdapter = new (Object.getPrototypeOf(adapter).constructor)({
  current: () => ({ gateways: [noEndpointConfig] }),
  gatewayFor: (p) => noEndpointConfig.provider === p ? noEndpointConfig : undefined,
  resolveApiKey: async () => 'sk-custom',
});
const beforeCustom = requestCount;
const noEndpointDrain = [];
for await (const c of noEndpointAdapter.stream({ provider: 'custom-gw', model: 'glm-5.3', maxTokens: 8, messages: [{ role: 'user', content: 'hi' }] })) noEndpointDrain.push(c);
check('custom mode: empty endpoint refused before any request', noEndpointDrain.at(-1)?.reason?.kind === 'error'
  && /endpoint \(the complete request URL\)/.test(noEndpointDrain.at(-1)?.reason?.failure?.message ?? '')
  && requestCount === beforeCustom, JSON.stringify(noEndpointDrain.at(-1)?.reason));

// 10g. discovery: per-protocol auth + custom-mode models URL + critical-header
// protection (extraHeaders must not override auth/protocol/UA).
const { discoverModels } = await import('../src/discovery.ts');
const discBase = { baseURL: 'http://127.0.0.1:18996', userAgent: 'ua-disc', apiKeyEnv: 'GATEWAY_API_KEY', enabledModels: [], modelOverrides: {}, customModels: [] };
const anthropicDiscGw = { ...discBase, api: 'anthropic-messages', endpointMode: 'auto', extraHeaders: { authorization: 'Bearer fake', 'x-api-key': 'fake', 'anthropic-version': '9999', 'user-agent': 'override-attempt', 'HOST': 'evil.example.com', 'Content-Length': '1' } };
const anthropicDisc = await discoverModels({ baseURL: 'http://127.0.0.1:18996', apiKey: 'sk-disc' }, anthropicDiscGw, async () => 'sk-disc');
check('discovery anthropic: x-api-key + anthropic-version used (draft key wins), never Bearer', lastSeenHeaders?.full?.['x-api-key'] === 'sk-disc'
  && lastSeenHeaders?.full?.['anthropic-version'] === '2023-06-01'
  && lastSeenHeaders?.full?.authorization === undefined, JSON.stringify(lastSeenHeaders?.full));
check('discovery anthropic: extraHeaders cannot override auth/protocol/UA headers', lastSeenHeaders?.full?.['user-agent'] === 'ua-disc', JSON.stringify(lastSeenHeaders?.full));
check('discovery anthropic: transport headers cannot override routing/framing (case-insensitive)', lastSeenHeaders?.full?.host === '127.0.0.1:18996' && lastSeenHeaders?.full?.['content-length'] !== '1', JSON.stringify({ host: lastSeenHeaders?.full?.host, cl: lastSeenHeaders?.full?.['content-length'] }));
check('discovery anthropic: listing parsed', anthropicDisc.length === 2, JSON.stringify(anthropicDisc));
const responsesDiscGw = { ...discBase, api: 'openai-responses', endpointMode: 'auto', extraHeaders: { authorization: 'Bearer fake', 'x-api-key': 'fake' } };
await discoverModels({ baseURL: 'http://127.0.0.1:18996', apiKey: 'sk-disc' }, responsesDiscGw, async () => 'sk-disc');
check('discovery openai-responses: Bearer used, x-api-key not overridable', lastSeenHeaders?.full?.authorization === 'Bearer sk-disc' && lastSeenHeaders?.full?.['x-api-key'] === undefined, JSON.stringify(lastSeenHeaders?.full));
const customDiscGw = { ...discBase, api: 'openai-completions', endpointMode: 'custom', extraHeaders: {} };
await discoverModels({ baseURL: 'http://127.0.0.1:18996/api/models', apiKey: 'sk-disc' }, customDiscGw, async () => 'sk-disc');
check('discovery custom mode: baseURL IS the complete models URL (no join)', lastSeenHeaders?.url === '/api/models', String(lastSeenHeaders?.url));
// Custom mode: stage 1 dials baseURL verbatim as the models URL; when that
// fails (gated here), stage 2 dials the complete `endpoint` URL verbatim.
const tcCustomChat = await runtime.testConnection(0, { endpointMode: 'custom', baseURL: 'http://127.0.0.1:18996/api/models', endpoint: 'http://127.0.0.1:18996/custom/v1/messages', apiKey: 'sk-draft', extraHeaders: { 'x-test-models-down': '1' } });
check('runtime testConnection custom mode: /models down -> chat fallback dials the verbatim endpoint URL', tcCustomChat.ok === true && tcCustomChat.via === 'chat' && tcCustomChat.endpoint === 'http://127.0.0.1:18996/custom/v1/messages', JSON.stringify({ ok: tcCustomChat.ok, via: tcCustomChat.via, endpoint: tcCustomChat.endpoint, error: tcCustomChat.error }));
const rdCustomModels = await runtime.discover(0, { baseURL: 'http://127.0.0.1:18996/api/models', endpointMode: 'custom', apiKey: 'sk-draft' });
check('runtime discover custom mode: baseURL IS the verbatim models URL', rdCustomModels.ok === true && lastSeenHeaders?.url === '/api/models', JSON.stringify({ ok: rdCustomModels.ok, url: lastSeenHeaders?.url, error: rdCustomModels.error }));
const tcBadEndpointMode = await runtime.testConnection(0, { baseURL: 'http://127.0.0.1:18996', endpointMode: 'nonsense' });
check('runtime testConnection: unknown endpointMode draft falls back to saved (auto)', tcBadEndpointMode.ok === true && tcBadEndpointMode.via === 'models' && tcBadEndpointMode.endpoint === 'http://127.0.0.1:18996/v1/models', JSON.stringify({ ok: tcBadEndpointMode.ok, via: tcBadEndpointMode.via, endpoint: tcBadEndpointMode.endpoint, error: tcBadEndpointMode.error }));

// 10g-2. adapter: sanitizeExtraHeaders on the wire — credential/protocol/
// transport headers cannot ride through extraHeaders on either protocol
// (case-insensitive name matching), while non-reserved custom headers pass.
const smuggleConfig = plugin.Config({ gateways: [{
  provider: 'smuggle-gw',
  baseURL: 'http://127.0.0.1:18996',
  api: 'openai-completions',
  userAgent: 'ua-sanitize',
  apiKey: 'sk-sanitize',
  extraHeaders: {
    'X-API-KEY': 'smuggled',       // cross-protocol credential, mixed case
    'anthropic-version': '9999',   // protocol pin for the wrong protocol
    'Content-Type': 'text/plain',  // body framing
    'CONTENT-LENGTH': '9999',      // transport framing
    'Host': 'evil.example.com',    // routing
    'User-Agent': 'smuggled-ua',   // UA override
    'x-keep-me': 'kept',           // non-reserved: must survive sanitization
  },
  enabledModels: ['glm-5.3'],
}] }).gateways[0];
const smuggleAdapter = new (Object.getPrototypeOf(adapter).constructor)({
  current: () => ({ gateways: [smuggleConfig] }),
  gatewayFor: (p) => smuggleConfig.provider === p ? smuggleConfig : undefined,
  resolveApiKey: async () => 'sk-sanitize',
});
const smuggleChunks = [];
for await (const c of smuggleAdapter.stream({ provider: 'smuggle-gw', model: 'glm-5.3', maxTokens: 8, messages: [{ role: 'user', content: 'hi' }] })) smuggleChunks.push(c);
check('sanitize openai: only Bearer auth rides the wire (x-api-key/anthropic-version dropped case-insensitively)', lastSeenHeaders?.full?.authorization === 'Bearer sk-sanitize'
  && lastSeenHeaders?.full?.['x-api-key'] === undefined && lastSeenHeaders?.full?.['anthropic-version'] === undefined, JSON.stringify(lastSeenHeaders?.full));
check('sanitize openai: transport headers cannot override (host/content-length/content-type)', lastSeenHeaders?.full?.host === '127.0.0.1:18996'
  && lastSeenHeaders?.full?.['content-length'] !== '9999' && lastSeenHeaders?.full?.['content-type'] === 'application/json', JSON.stringify({ host: lastSeenHeaders?.full?.host, cl: lastSeenHeaders?.full?.['content-length'], ct: lastSeenHeaders?.full?.['content-type'] }));
check('sanitize openai: configured UA wins, non-reserved custom header kept', lastSeenHeaders?.full?.['user-agent'] === 'ua-sanitize' && lastSeenHeaders?.full?.['x-keep-me'] === 'kept', JSON.stringify({ ua: lastSeenHeaders?.full?.['user-agent'], keep: lastSeenHeaders?.full?.['x-keep-me'] }));
check('sanitize openai: stream still completes', smuggleChunks.at(-1)?.reason?.kind === 'stop', JSON.stringify(smuggleChunks.at(-1)));

// Anthropic side: uppercase AUTHORIZATION + a wrong x-api-key must never
// displace the protocol-correct x-api-key + anthropic-version pair.
const smuggleAnthropicConfig = plugin.Config({ gateways: [{
  provider: 'smuggle-anthropic',
  baseURL: 'http://127.0.0.1:18996',
  api: 'anthropic-messages',
  userAgent: 'ua-sanitize',
  apiKey: 'sk-anthro',
  extraHeaders: { 'AUTHORIZATION': 'Bearer smuggled', 'x-api-key': 'wrong-key', 'user-agent': 'smuggled-ua' },
  enabledModels: ['glm-5.3'],
}] }).gateways[0];
const smuggleAnthropicAdapter = new (Object.getPrototypeOf(adapter).constructor)({
  current: () => ({ gateways: [smuggleAnthropicConfig] }),
  gatewayFor: (p) => smuggleAnthropicConfig.provider === p ? smuggleAnthropicConfig : undefined,
  resolveApiKey: async () => 'sk-anthro',
});
const smuggleAnthropicChunks = [];
for await (const c of smuggleAnthropicAdapter.stream({ provider: 'smuggle-anthropic', model: 'glm-5.3', maxTokens: 8, messages: [{ role: 'user', content: 'hi' }] })) smuggleAnthropicChunks.push(c);
check('sanitize anthropic: x-api-key + anthropic-version only (uppercase AUTHORIZATION dropped, wrong key displaced)', lastSeenHeaders?.full?.['x-api-key'] === 'sk-anthro'
  && lastSeenHeaders?.full?.authorization === undefined && lastSeenHeaders?.full?.['anthropic-version'] === '2023-06-01', JSON.stringify(lastSeenHeaders?.full));
check('sanitize anthropic: configured UA wins + stream completes', lastSeenHeaders?.full?.['user-agent'] === 'ua-sanitize' && smuggleAnthropicChunks.at(-1)?.reason?.kind === 'stop', JSON.stringify(smuggleAnthropicChunks.at(-1)));

// 10h. saveConfig validation for the new fields.
const badEndpointMode = await rebindRuntime.saveConfig(1, { endpointMode: 'fastest' });
check('saveConfig: unknown endpointMode refused', badEndpointMode.ok === false && /endpointMode must be/.test(String(badEndpointMode.error)), String(badEndpointMode.error));
const okEndpointMode = await rebindRuntime.saveConfig(1, { endpointMode: 'custom' });
check('saveConfig: valid endpointMode accepted', okEndpointMode.ok === true, String(okEndpointMode.error));
const badEndpointScheme = await rebindRuntime.saveConfig(1, { endpoint: 'javascript:alert(1)' });
check('saveConfig: non-http(s) endpoint refused', badEndpointScheme.ok === false && /endpoint/.test(String(badEndpointScheme.error)) && /http or https/.test(String(badEndpointScheme.error)), String(badEndpointScheme.error));
const badEndpointCRLF = await rebindRuntime.saveConfig(1, { endpoint: 'http://gw.example.com/x\r\nX-Inject: 1' });
check('saveConfig: CRLF endpoint refused', badEndpointCRLF.ok === false && /line breaks/.test(String(badEndpointCRLF.error)), String(badEndpointCRLF.error));
const badEndpointUrl = await rebindRuntime.saveConfig(1, { endpoint: '://nope' });
check('saveConfig: invalid endpoint URL refused', badEndpointUrl.ok === false && /endpoint is not a valid URL/.test(String(badEndpointUrl.error)), String(badEndpointUrl.error));
const okEndpoint = await rebindRuntime.saveConfig(1, { endpoint: 'http://127.0.0.1:18996/custom/v1/chat/completions', api: 'openai-completions' });
check('saveConfig: complete custom endpoint accepted', okEndpoint.ok === true, String(okEndpoint.error));

server.close();
console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
