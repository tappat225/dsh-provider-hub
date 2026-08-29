/**
 * dsh-provider-hub — a general-purpose DSH LLM provider plugin for gateway
 * endpoints (any OpenAI / Anthropic compatible API), including gateways that
 * whitelist client User-Agents. One plugin instance manages any number of
 * gateways (provider routes), each with its own protocol, User-Agent,
 * credentials, and model catalog — all editable in a single settings page.
 *
 * Integration pattern (DSH standard plugin capabilities):
 *
 *   - `Config` schema renders a dedicated settings panel (plugin page);
 *   - `installSettingsSection` mounts the panel values as a settings
 *     namespace (`llm-provider-hub`), so edits apply live, no settings.yaml
 *     hand-editing;
 *   - `ctx.llm.registerConfigurableProviders` shows a card per gateway on the
 *     Models page;
 *   - `ctx.llm.registerAdapter` registers every gateway route, so enabled
 *     models appear in DSH's model picker (the adapter routes each request by
 *     `options.provider`);
 *   - `ctx.llm.registerModelDiscovery` lets the Models page interrogate
 *     `GET {baseURL}/models` (with the custom UA) and adopt discovered
 *     models;
 *   - the adapter implements `stream` itself (custom User-Agent / headers),
 *     bypassing DSH's hard-coded `deepseek-harness/...` attribution UA
 *     (`user-agent` is a reserved header in llm-pi-ai and cannot be
 *     overridden through configuration).
 *
 * @module dsh-provider-hub
 */
import z from '@deepseek-ai/schemastery';
import type { Context } from '@deepseek-ai/cordis';
import { LlmAdapter, LlmError, assertUsableApiKey } from '@deepseek-ai/dsh-llm';
import { credentialRef } from '@deepseek-ai/dsh-credentials';
import { launchEnvironmentOf } from '@deepseek-ai/dsh-launch-environment';
import { installSettingsSection, settingsNamespace } from '@deepseek-ai/dsh-settings';
import { GatewayAdapter } from './adapter.ts';
import { MODEL_CATALOG, resolveModelEntries } from './catalog.ts';
import { discoverModels } from './discovery.ts';
import { ProviderHubRuntime } from './host/runtime.ts';
import { TYPERT_MANIFEST } from './host/contract.ts';
import type { GatewayConfig, WireConfig, WireModelEntry } from './types.ts';

export const name = 'provider-hub';

/** Services required by this plugin. */
export const inject = ['llm'];

/** The settings namespace owning this provider's panel values. */
export const NS = settingsNamespace('llm-provider-hub');

export const DEFAULT_API_KEY_ENV = 'GATEWAY_API_KEY';

/** Default display name for a gateway entry. */
export const DEFAULT_DISPLAY_NAME = 'Gateway';

/** One gateway (provider route) schema — the unit of configuration. */
const GatewaySchema = z.object({
  /** Provider route this gateway registers (unique across gateways; change requires restart). */
  provider: z.string(),
  /** Display name in model pickers. */
  displayName: z.string().default(DEFAULT_DISPLAY_NAME),
  /** Upstream base URL (required; the request path is appended automatically). */
  baseURL: z.string(),
  /** Wire protocol. */
  api: z.union(['anthropic-messages', 'openai-completions']).default('anthropic-messages'),
  /** User-Agent sent on the wire (gateway whitelist). */
  userAgent: z.string().default('claude-cli/2.0.1 (external, cli)'),
  /** Credential-ref env var name; resolved through the credentials service or launch environment. */
  apiKeyEnv: z.string().role('credential-ref').default(DEFAULT_API_KEY_ENV),
  /** Literal key, optional; takes precedence over apiKeyEnv. */
  apiKey: z.string(),
  /** Extra headers merged into every request. */
  extraHeaders: z.dict(z.string()).default({}),
  /** Role used for the system prompt on the openai-completions path ('developer' fixes strict GPT-lineage gateways). */
  systemRole: z.union(['system', 'developer']).default('system'),
  /** When true, the anthropic-messages path forwards reasoningEffort as Anthropic `thinking` (budget_tokens by effort). */
  anthropicThinking: z.boolean().default(false),
  /** Field-level parameter overrides for built-in catalog models (id -> partial entry). */
  modelOverrides: z.dict(z.object({
    name: z.string(),
    contextWindow: z.number().step(1).min(1),
    maxTokens: z.number().step(1).min(1),
    input: z.array(z.union(['text', 'image', 'audio'])),
    reasoningEfforts: z.dict(z.union([z.string(), z.const(null)])),
  })).default({}),
  /** Built-in catalog model ids to enable in the picker. */
  enabledModels: z.array(z.string()).default(['glm-5.3']),
  /** Fully-specified custom models (Cherry-Studio style manual entries). */
  customModels: z.array(z.object({
    id: z.string(),
    name: z.string(),
    contextWindow: z.number().step(1).min(1),
    maxTokens: z.number().step(1).min(1),
    input: z.array(z.union(['text', 'image', 'audio'])).default(['text']),
    reasoningEfforts: z.dict(z.union([z.string(), z.const(null)])),
  })).default([]),
  /** Import one model's capability parameters from another registered provider route. */
  presetFrom: z.object({
    provider: z.string(),
    model: z.string(),
  }),
  /** Snapshot of catalog state before the last bulk enable (for rollback). */
  catalogSnapshot: z.object({
    enabledModels: z.array(z.string()).default([]),
    customModels: z.array(z.object({
      id: z.string(),
      name: z.string(),
      contextWindow: z.number().step(1).min(1),
      maxTokens: z.number().step(1).min(1),
      input: z.array(z.union(['text', 'image', 'audio'])).default(['text']),
      reasoningEfforts: z.dict(z.union([z.string(), z.const(null)])),
    })).default([]),
  }),
});

/** Config schema rendered as the plugin settings panel: a list of gateways. */
export const Config = z.object({
  gateways: z.array(GatewaySchema).default([]),
});

/**
 * Plugin entry.
 * @param ctx - owning cordis context.
 * @param config - validated Config values (composition entry).
 */
export function apply(ctx: Context, config: WireConfig) {
  let current: () => WireConfig = () => config;

  /** Gateway by provider route (cached per current() call). */
  const gatewayFor = (provider: string): GatewayConfig | undefined =>
    current().gateways.find((gw) => gw.provider === provider);

  // Runtime entries imported from another provider route (presetFrom), one per
  // gateway. Loaded asynchronously at startup; a failure degrades to "not
  // imported" instead of blocking plugin mount.
  const presetEntries = new Map<string, WireModelEntry>();
  const loadPreset = async (): Promise<void> => {
    const next = new Map<string, WireModelEntry>();
    for (const gw of current().gateways) {
      const preset = gw.presetFrom;
      if (preset === undefined) continue;
      try {
        const info = await ctx.llm.resolveModelInfo(preset.provider, preset.model);
        next.set(gw.provider, {
          id: preset.model,
          name: info.name ?? preset.model,
          contextWindow: info.context?.contextWindow ?? 128000,
          maxTokens: info.defaultMaxTokens ?? 8192,
          ...(info.inputModalities === undefined ? {} : { input: [...info.inputModalities] }),
          ...(info.reasoning === undefined
            ? {}
            : { reasoning: Object.fromEntries(info.reasoning.efforts.map((effort) => [effort.id, effort.id])) }),
        });
      } catch {
        // keep undefined for this gateway: preset import degrades gracefully
      }
    }
    presetEntries.clear();
    for (const [provider, entry] of next) presetEntries.set(provider, entry);
  };
  void loadPreset();

  const resolveApiKey = async (gw: GatewayConfig): Promise<string> => {
    if (typeof gw.apiKey === 'string' && gw.apiKey.trim() !== '') {
      return assertUsableApiKey(gw.apiKey.trim(), 'llm-provider-hub', 'config.apiKey');
    }
    const ref = credentialRef(gw.apiKeyEnv ?? DEFAULT_API_KEY_ENV);
    const credentials = ctx.get('credentials');
    const hit = credentials !== undefined
      ? (await credentials.resolve(ref))?.value
      : launchEnvironmentOf(ctx).get(ref)?.value;
    if (hit !== undefined && hit.length > 0) return assertUsableApiKey(hit, 'llm-provider-hub', gw.apiKeyEnv);
    throw new LlmError(
      `llm-provider-hub: no API key for provider route "${gw.provider}"; set config.apiKey in the plugin settings, store ${gw.apiKeyEnv} in the credentials service, or export it in the launching environment`,
      'MISSING_CREDENTIAL',
    );
  };

  const adapter: LlmAdapter = new GatewayAdapter({
    current,
    gatewayFor,
    resolveApiKey,
    preset: (provider: string) => presetEntries.get(provider),
  });

  const providers = current().gateways.map((gw) => gw.provider);
  if (providers.length > 0) {
    ctx.llm.registerConfigurableProviders(current().gateways.map((gw) => ({
      provider: gw.provider,
      displayName: gw.displayName || DEFAULT_DISPLAY_NAME,
      settingsNs: NS,
      settingsPath: [],
    })));
    ctx.llm.registerAdapter(providers, adapter);
  }
  ctx.llm.registerModelDiscovery(NS, (request) => {
    // The discovery request is a draft (baseURL/apiKey), not a stored route:
    // find the gateway whose baseURL matches, else fall back to the first.
    const gw = current().gateways.find((g) => {
      const base = g.baseURL?.replace(/\/+$/, '');
      const want = request.baseURL?.replace(/\/+$/, '');
      return base !== undefined && want !== undefined && base === want;
    }) ?? current().gateways[0];
    if (gw === undefined) {
      throw new LlmError('llm-provider-hub: model discovery needs a gateway with a baseURL; add one in the plugin settings', 'DISCOVERY_FAILED');
    }
    return discoverModels(request, gw, () => resolveApiKey(gw));
  });

  // Client-half remote service: the settings page (lib/client.js) manages
  // the same configuration through this namespace.
  ctx.inject(['typert'], (typertCtx) => {
    new ProviderHubRuntime(typertCtx as never, { current, resolveApiKey, gatewayFor });
    // Mirror the official dsh-typert-loader pattern: ctx.typert.register(manifest)
    // (keeps `this` bound — destructuring the method would crash the loader).
    (typertCtx.typert as unknown as { register(manifest: unknown): unknown }).register(TYPERT_MANIFEST);
  });

  installSettingsSection(ctx, NS, Config, config, {
    setSource: (source: () => WireConfig) => {
      current = source;
    },
    onChange: () => {},
  });

  ctx.logger.info(
    `provider-hub: registered ${current().gateways.length} gateway(s): ${current().gateways.map((gw) => `${gw.provider}(${gw.api}${gw.baseURL ? ` -> ${gw.baseURL}` : ''})`).join(', ')}`,
  );
}

export { MODEL_CATALOG, resolveModelEntries };
export { GatewayAdapter } from './adapter.ts';
