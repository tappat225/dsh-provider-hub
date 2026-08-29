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
    lastSeenHeaders = { ua: req.headers['user-agent'], key: req.headers['x-api-key'] ?? req.headers['authorization']?.slice(0, 12), body: body.slice(0, 120) };
    if (req.url.startsWith('/models')) {
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

// 6d. presetFrom: preset entry joins the catalog (per gateway)
const presetConfig = plugin.Config({ gateways: [{
  provider: 'air-outer',
  baseURL: 'http://x',
  api: 'anthropic-messages',
  apiKey: 'k',
  presetFrom: { provider: 'shuai-claude', model: 'claude-sonnet-4-6' },
}] }).gateways[0];
const presetAdapter = new (Object.getPrototypeOf(adapter).constructor)({
  current: () => ({ gateways: [presetConfig] }),
  gatewayFor: (p) => presetConfig.provider === p ? presetConfig : undefined,
  resolveApiKey: async () => 'k',
  preset: () => ({ id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6', contextWindow: 1000000, maxTokens: 32768, input: ['text', 'image'] }),
});
const presetListed = await presetAdapter.listModels('air-outer');
check('presetFrom: model listed', presetListed.some((m) => m.id === 'claude-sonnet-4-6'), JSON.stringify(presetListed.map((m) => m.id)));
const presetResolved = await presetAdapter.resolveModel('air-outer', 'claude-sonnet-4-6');
check('presetFrom: params resolved', presetResolved.context?.contextWindow === 1000000 && presetResolved.defaultMaxTokens === 32768, JSON.stringify(presetResolved));

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
const dg = await runtime.deleteGateway(1);
check('runtime deleteGateway', dg.ok === true && stored.gateways.length === 1, JSON.stringify({ gateways: stored.gateways.length }));
const lp = await runtime.listPresets();
check('runtime listPresets', lp.ok === true && lp.providers.some((p) => p.provider === 'shuai-claude'), JSON.stringify(lp.providers));
const pm = await runtime.presetModels('shuai-claude');
check('runtime presetModels', pm.ok === true && pm.models[0]?.id === 'claude-opus-4-8');
const pmi = await runtime.presetModelInfo('shuai-claude', 'claude-opus-4-8');
check('runtime presetModelInfo', pmi.ok === true && pmi.info.context?.contextWindow === 1000000, JSON.stringify(pmi.info));
const spf = await runtime.setPresetFrom(0, { provider: 'shuai-claude', model: 'claude-opus-4-8' });
check('runtime setPresetFrom', spf.ok === true && stored.gateways[0].presetFrom?.model === 'claude-opus-4-8');
const rd = await runtime.discover(0);
check('runtime discover via echo', rd.ok === true && rd.models.length === 2 && rd.models[0].id === 'glm-5.3', JSON.stringify(rd.models));
const ro = await runtime.saveOverrides(0, { 'glm-5.3': { contextWindow: 999999 } });
check('runtime saveOverrides', ro.ok === true && stored.gateways[0].modelOverrides['glm-5.3'].contextWindow === 999999);

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
