// Verify dsh-provider-hub (multi-gateway): Config schema, adapter catalog/resolve,
// stream conversion (anthropic + openai paths), model discovery, multi-gateway
// isolation, and a live probe through the UA gate.
import http from 'node:http';
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
check('Config customModels kept', config.gateways[0].customModels.length === 1);

// 3. Model entries + adapter resolve (single gateway = gateway at index 0)
const gw0 = config.gateways[0];
const entries = plugin.resolveModelEntries(gw0);
check('entries: 3 (2 builtin + 1 custom)', entries.length === 3, `got ${entries.length}: ${entries.map((e) => e.id).join(',')}`);
const builtin = entries.find((e) => e.id === 'claude-opus-4-8');
check('builtin entry params', builtin.contextWindow === 1000000 && builtin.maxTokens === 32768 && builtin.input.includes('image'));
const overridden = entries.find((e) => e.id === 'glm-5.3');
check('modelOverrides applied field-wise', overridden.contextWindow === 999999 && overridden.maxTokens === 8888 && overridden.input.includes('image') && overridden.name === 'GLM-5.3', JSON.stringify({ cw: overridden.contextWindow, mt: overridden.maxTokens, input: overridden.input, name: overridden.name }));
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
check('resolveModel claude', resolved.context?.contextWindow === 1000000 && resolved.defaultMaxTokens === 32768 && resolved.reasoning?.efforts?.length === 6, JSON.stringify(resolved.reasoning));
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
const server = http.createServer((req, res) => {
  let body = '';
  req.on('data', (c) => (body += c));
  req.on('end', () => {
    lastSeenHeaders = { url: req.url, ua: req.headers['user-agent'], key: req.headers['x-api-key'] ?? req.headers['authorization']?.slice(0, 12), body: body.slice(0, 120) };
    if (req.url.endsWith('/models')) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ object: 'list', data: [
        { id: 'glm-5.3', object: 'model', context_window: 200000, max_output_tokens: 131072 },
        { id: 'glm-4.6', object: 'model' },
        { id: '', object: 'model' },
      ] }));
      return;
    }
    if (req.url.includes('/chat/completions')) {
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
const runtime = new ProviderHubRuntime(
  {
    get: (n) => (n === 'settings' ? fakeSettings : n === 'llm' ? fakeLlm : undefined),
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

// 9a. testConnection: probe an UNSAVED draft (URL/key/headers) against /models.
// The full listing rides along so the settings page can seed its discovery
// list without a second fetch; a bare host is normalized to /v1/models.
const tc = await runtime.testConnection(0, { baseURL: 'http://127.0.0.1:18996/', apiKey: 'sk-draft', extraHeaders: {} });
check('runtime testConnection ok (draft, bare host -> /v1/models)', tc.ok === true && tc.modelCount === 2 && tc.models.length === 2 && typeof tc.latencyMs === 'number' && tc.endpoint === 'http://127.0.0.1:18996/v1/models', JSON.stringify(tc));
const tcV1 = await runtime.testConnection(0, { baseURL: 'http://127.0.0.1:18996/v1', apiKey: 'sk-draft', extraHeaders: {} });
check('runtime testConnection ok (draft, explicit /v1 root not doubled)', tcV1.ok === true && tcV1.endpoint === 'http://127.0.0.1:18996/v1/models' && tcV1.modelCount === 2, JSON.stringify(tcV1));
// A draft apiKey merges over the saved one (empty literal -> env fallback).
const tcKey = await runtime.testConnection(0, { apiKey: '' });
check('runtime testConnection: empty draft apiKey falls back (env path)', tcKey.ok === true, String(tcKey.error));
const tcBadUrl = await runtime.testConnection(0, { baseURL: '://nope' });
check('runtime testConnection rejects invalid URL', tcBadUrl.ok === false && /valid URL/.test(String(tcBadUrl.error)), String(tcBadUrl.error));
const tcBadHeaders = await runtime.testConnection(0, { extraHeaders: { 'x-a': 1 } });
check('runtime testConnection rejects non-string header value', tcBadHeaders.ok === false && /extraHeaders/.test(String(tcBadHeaders.error)), String(tcBadHeaders.error));
const tcDead = await runtime.testConnection(0, { baseURL: 'http://127.0.0.1:1/' });
check('runtime testConnection unreachable endpoint fails', tcDead.ok === false && /could not reach/.test(String(tcDead.error)), String(tcDead.error));
const ro = await runtime.saveOverrides(0, { 'glm-5.3': { contextWindow: 999999 } });
check('runtime saveOverrides', ro.ok === true && stored.gateways[0].modelOverrides['glm-5.3'].contextWindow === 999999);

// 9b. REGRESSION: the post-apply settings rebind must be visible to the
// typert runtime. apply() captures `current` into the runtime deps; if it
// captures the binding VALUE (the composition entry) instead of a thunk, the
// settings page reads the entry forever ("saved but list empty") even though
// settings.yaml holds the section and writes commit fine.
const rebindDoc = { gateways: [{ provider: 'hub-gateway', displayName: 'hub-gateway', baseURL: '', api: 'anthropic-messages', userAgent: 'claude-cli/2.0.1 (external, cli)', apiKeyEnv: 'GATEWAY_API_KEY', apiKey: '', extraHeaders: {}, systemRole: 'system', anthropicThinking: false, enabledModels: ['glm-5.3'], modelOverrides: {}, customModels: [] }] };
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

// 7. Model discovery (echo /models) — draft request routed by baseURL
const discovered = await registered.discovery.fn({ baseURL: 'http://127.0.0.1:18996', apiKey: 'sk-test' });
check('discovery: 2 models', discovered.length === 2, JSON.stringify(discovered));
check('discovery: params mapped', discovered[0].contextWindow === 200000 && discovered[0].maxTokens === 131072, JSON.stringify(discovered[0]));

// 8. Live probe (fake key) through the adapter
const liveConfig = plugin.Config({ gateways: [{
  provider: 'air-outer',
  baseURL: 'https://ps.air-outer.com',
  api: 'anthropic-messages',
  userAgent: 'claude-cli/2.0.1 (external, cli)',
  apiKey: 'sk-aQ3po5zL-FAKE-KEY',
  enabledModels: ['glm-5.3'],
}] }).gateways[0];
const liveAdapter = new (Object.getPrototypeOf(adapter).constructor)({
  current: () => ({ gateways: [liveConfig] }),
  gatewayFor: (p) => liveConfig.provider === p ? liveConfig : undefined,
  resolveApiKey: async () => 'sk-aQ3po5zL-FAKE-KEY',
  preset: () => undefined,
});
const liveStream = liveAdapter.stream({ provider: 'air-outer', model: 'glm-5.3', maxTokens: 8, messages: [{ role: 'user', content: [{ type: 'text', text: 'hi' }] }] });
const liveChunks = [];
for await (const c of liveStream) liveChunks.push(c);
const liveFinish = liveChunks.find((c) => c.type === 'finish');
console.log('[live] finish:', JSON.stringify(liveFinish?.reason ?? null).slice(0, 250));
check('live: UA gate passed (invalid token, not unauthorized client)', liveFinish?.reason?.kind === 'error' && !/unauthorized client/.test(liveFinish?.reason?.failure?.message ?? ''), liveFinish?.reason?.failure?.message?.slice(0, 150));

server.close();
console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
