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
import { settingsNamespace } from '@deepseek-ai/dsh-settings';
import { GatewayAdapter } from './adapter.ts';
import { MODEL_CATALOG, resolveModelEntries } from './catalog.ts';
import { discoverModels } from './discovery.ts';
import { ProviderHubRuntime } from './host/runtime.ts';
import { TYPERT_MANIFEST } from './host/contract.ts';
import type { GatewayConfig, WireConfig } from './types.ts';
import { DEFAULT_USER_AGENT } from './types.ts';

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
  /** Provider route this gateway registers (unique across gateways; changes apply live). */
  provider: z.string(),
  /** Display name in model pickers. */
  displayName: z.string().default(DEFAULT_DISPLAY_NAME),
  /** Upstream base URL (auto: API root; custom: the complete model-listing URL). */
  baseURL: z.string(),
  /** Wire protocol. */
  api: z.union(['anthropic-messages', 'openai-completions', 'openai-responses']).default('anthropic-messages'),
  /**
   * Endpoint addressing mode. auto (default; older stored configs behave as
   * auto): the /v1-normalized request paths are derived from baseURL. custom:
   * no path is appended — `endpoint` is the complete chat request URL and
   * `baseURL` the complete model-listing URL, both used verbatim.
   */
  endpointMode: z.union(['auto', 'custom']).default('auto'),
  /** Complete chat request URL used verbatim in custom mode (per the gateway's api). */
  endpoint: z.string().default(''),
  /** User-Agent sent on the wire (gateway whitelist; empty falls back to the default). */
  userAgent: z.string().default(DEFAULT_USER_AGENT),
  /** Credential-ref env var name; resolved through the credentials service or launch environment. */
  apiKeyEnv: z.string().role('credential-ref').default(DEFAULT_API_KEY_ENV),
  /** Literal key, optional; accepted only for legacy migration and never returned to the client. */
  apiKey: z.string().role('secret'),
  /** Extra headers merged into every request. */
  extraHeaders: z.dict(z.string()).default({}),
  /** Role used for the system prompt on the openai-completions path ('developer' fixes strict GPT-lineage gateways). */
  systemRole: z.union(['system', 'developer']).default('system'),
  /** Request the final usage chunk on the openai-completions path (stream_options.include_usage; disable for gateways that reject the parameter). */
  streamUsage: z.boolean().default(true),
  /** When true, the anthropic-messages path forwards reasoningEffort as Anthropic `thinking` (budget_tokens by effort). */
  anthropicThinking: z.boolean().default(false),
  /** Default context window for custom models that omit contextWindow (optional: unset means no gateway fallback). */
  defaultContextWindow: z.number().step(1).min(1),
  /** Default per-request output cap (fills custom entries without maxTokens and requests DSH sends without one; unset keeps the 4096 floor). */
  defaultMaxTokens: z.number().step(1).min(1),
  /** Default input modalities for custom models that omit input. */
  defaultInput: z.array(z.union(['text', 'image', 'audio'])),
  /** Anthropic thinking budget (tokens) per reasoning level; unset levels fall back to the adapter's built-in table. */
  anthropicThinkingBudgets: z.dict(z.number().step(1).min(1)),
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
    input: z.array(z.union(['text', 'image', 'audio'])),
    reasoningEfforts: z.dict(z.union([z.string(), z.const(null)])),
  })).default([]),
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
  // How many times the settings inject callback (re)bound `current`; a second
  // bind while the plugin still runs would prove the settings fiber was
  // disposed/recreated (the suspected "list empty" root cause).
  let settingsBind = 0;
  /** Legacy literal keys captured before settings redaction; keyed by credential ref. */
  const legacyLiteralKeys = new Map<string, string>();
  for (const gw of config.gateways) {
    if (typeof gw.apiKey === 'string' && gw.apiKey.trim() !== '') legacyLiteralKeys.set(gw.apiKeyEnv, gw.apiKey.trim());
  }

  /** Gateway by provider route (cached per current() call). */
  const gatewayFor = (provider: string): GatewayConfig | undefined =>
    current().gateways.find((gw) => gw.provider === provider);

  const resolveApiKey = async (gw: GatewayConfig): Promise<string> => {
    const refName = gw.apiKeyEnv ?? DEFAULT_API_KEY_ENV;
    const ref = credentialRef(refName);
    const credentials = ctx.get('credentials');
    // Credentials are authoritative after migration or a later key rotation.
    const stored = credentials !== undefined ? (await credentials.resolve(ref))?.value : undefined;
    if (stored !== undefined && stored.length > 0) return assertUsableApiKey(stored, 'llm-provider-hub', refName);
    const literal = typeof gw.apiKey === 'string' && gw.apiKey.trim() !== ''
      ? gw.apiKey.trim() : legacyLiteralKeys.get(refName);
    if (literal !== undefined) {
      const key = assertUsableApiKey(literal, 'llm-provider-hub', refName);
      // Migrate legacy settings literals on first use. Failure to persist does
      // not break the current request; the literal remains an internal fallback.
      if (credentials !== undefined) {
        try { await credentials.set(ref, key); legacyLiteralKeys.delete(refName); } catch { /* request can still use the validated legacy key */ }
      }
      return key;
    }
    const hit = launchEnvironmentOf(ctx).get(ref)?.value;
    if (hit !== undefined && hit.length > 0) return assertUsableApiKey(hit, 'llm-provider-hub', refName);
    throw new LlmError(
      `llm-provider-hub: no API key for provider route "${gw.provider}"; set the API key in the plugin settings, store ${refName} in the credentials service, or export it in the launching environment`,
      'MISSING_CREDENTIAL',
    );
  };

  const adapter: LlmAdapter = new GatewayAdapter({
    // NOTE: `current` must be a thunk reading the mutable binding — the
    // settings inject reassigns `current` AFTER this constructor captures the
    // deps object. Passing `current` directly would freeze the composition
    // entry forever (settings page always empty, routes never see new gateways).
    current: () => current(),
    gatewayFor,
    resolveApiKey,
  });

  // Live LLM route registration. The configuration at apply time is the
  // composition entry (normally `{}`); the real gateways arrive through the
  // settings service, which binds asynchronously AFTER apply. dsh-llm
  // registrations are fiber-bound and expose `handle.replace(next)` for an
  // atomic swap, so the routes are synced — at apply, at settings bind, and
  // on every settings commit — through registerLlmRoutes(). Without this the
  // model picker never sees the gateways' models ("registered 0 gateways").
  type DirectoryEntry = { provider: string; displayName: string; settingsNs: string; settingsPath: string[] };
  let directoryHandle: { replace(next: DirectoryEntry[]): void } | undefined;
  let adapterHandle: { replace(next: string[]): void } | undefined;
  const registerLlmRoutes = (): void => {
    const gateways = current().gateways;
    const providers = gateways.map((gw) => gw.provider);
    try {
      const entries: DirectoryEntry[] = gateways.map((gw) => ({
        provider: gw.provider,
        displayName: gw.displayName || DEFAULT_DISPLAY_NAME,
        settingsNs: NS,
        settingsPath: [],
      }));
      if (directoryHandle !== undefined) directoryHandle.replace(entries);
      else if (entries.length > 0) directoryHandle = ctx.llm.registerConfigurableProviders(entries);
    } catch (error) {
      ctx.logger.warn(`provider-hub: configurable-provider sync failed: ${error instanceof Error ? error.message : String(error)}`);
    }
    try {
      if (adapterHandle !== undefined) adapterHandle.replace(providers);
      else if (providers.length > 0) adapterHandle = ctx.llm.registerAdapter(providers, adapter);
    } catch (error) {
      ctx.logger.warn(`provider-hub: adapter sync failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  // Model discovery offer: namespace-keyed, one per plugin, independent of
  // how many gateways exist (the request is a draft, not a stored route).
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
  registerLlmRoutes();

  // Client-half remote service: the settings page (lib/client.js) manages
  // the same configuration through this namespace.
  ctx.inject(['typert'], (typertCtx) => {
    try {
      new ProviderHubRuntime(typertCtx as never, {
        // Same capture trap as the adapter: pass a thunk, not the binding.
        current: () => current(),
        resolveApiKey,
        gatewayFor,
        log: (message) => typertCtx.logger.info(`provider-hub: ${message}`),
      });
      // Mirror the official dsh-typert-loader pattern: ctx.typert.register(manifest)
      // (keeps `this` bound — destructuring the method would crash the loader).
      (typertCtx.typert as unknown as { register(manifest: unknown): unknown }).register(TYPERT_MANIFEST);
    } catch (error) {
      // Never let the Remote service or typert registration take down the
      // plugin tree: the provider routes still work without the settings page.
      ctx.logger.warn(`provider-hub: typert/Remote setup failed (settings page unavailable): ${error instanceof Error ? error.message : String(error)}`);
    }
  });

  // Settings wiring, mirroring official installSettingsSection semantics but
  // under our own control so every read/write can be audited:
  //   - `current` reads the namespace THROUGH settings.describe() on each call
  //     (always the live registration's value + revision), falling back to the
  //     owner scope, then to the composition entry;
  //   - every commit rebinds `current` and logs a cross-check
  //     (scope value vs describe value vs describe.user vs revision), which
  //     pinpoints whether the cached resolved value, the map registration or
  //     the raw user section drift apart — the "saved but list empty" bug.
  ctx.inject(['settings'], (sctx) => {
    try {
      const s = sctx.settings as unknown as {
        register(ns: string, schema: unknown, options?: { base?: unknown }): {
          get(): WireConfig;
          watch(cb: (next: unknown, prev: unknown) => void): () => void;
        };
        describe?(options?: { redactSecrets?: boolean }): Array<{
          ns: string;
          value?: unknown;
          user?: unknown;
          revision: number;
        }>;
      };
      const scope = s.register(NS, Config, { base: config });
      // Capture literals from the user settings layer before describe() redacts
      // secret fields. They are only an internal migration fallback and are
      // transferred to credentials on first request.
      try {
        for (const gw of scope.get().gateways) {
          if (typeof gw.apiKey === 'string' && gw.apiKey.trim() !== '') legacyLiteralKeys.set(gw.apiKeyEnv, gw.apiKey.trim());
        }
      } catch { /* a malformed/disposed scope is handled by the normal fallback */ }
      settingsBind += 1;
      const bindMark = settingsBind;
      /** Live read: describe() mirrors the current map registration; the
       *  owner scope mirrors the cached resolved snapshot. describe wins —
       *  it never serves a stale registration. */
      const read = (): WireConfig => {
        let live: unknown;
        try {
          const d = s.describe?.({ redactSecrets: true })?.find((c) => c.ns === NS);
          live = d?.value;
        } catch {
          live = undefined;
        }
        if (live !== undefined && typeof live === 'object' && live !== null
          && Array.isArray((live as { gateways?: unknown }).gateways)) {
          return live as WireConfig;
        }
        return scope.get();
      };
      current = read;
      ctx.logger.info(`provider-hub: settings source bound ${bindMark} (describe live read)`);
      const report = (tag: string): void => {
        let scopeCount = -1;
        let descCount: number | undefined;
        let userCount: number | undefined;
        let revision: number | undefined;
        try { scopeCount = scope.get().gateways.length; } catch { /* disposed */ }
        try {
          const d = s.describe?.({ redactSecrets: true })?.find((c) => c.ns === NS);
          descCount = (d?.value as { gateways?: unknown[] } | undefined)?.gateways?.length;
          userCount = (d?.user as { gateways?: unknown[] } | undefined)?.gateways?.length;
          revision = d?.revision;
        } catch { /* transient */ }
        ctx.logger.info(
          `provider-hub: ${tag} bind=${bindMark} scope=${scopeCount} describe=${String(descCount)} user=${String(userCount)} revision=${String(revision)}`,
        );
      };
      report('settings setup');
      // THE model-picker fix: at apply time no gateways were known (entry
      // config), so registerLlmRoutes() was a no-op. Now that the live
      // configuration is bound, register the adapter/directory routes (and
      // re-sync on every commit) so the model picker sees the gateways.
      registerLlmRoutes();
      ctx.logger.info(`provider-hub: llm routes synced: ${current().gateways.length} gateway(s) bound=${bindMark}`);
      // Every commit rebinds the live reader and cross-checks the views.
      scope.watch(() => {
        current = read;
        report('settings watch');
        registerLlmRoutes();
      });
      // Settings fiber disposed while the plugin lives: fall back to the
      // composition entry (the official installSettingsSection behaviour);
      // log it — this path is the prime suspect for "saved but list empty".
      sctx.effect(() => () => {
        try {
          const state = (ctx as { fiber?: { state?: number } }).fiber?.state ?? 0;
          if (state === 4 || state === 5) return; // plugin itself unloading
        } catch { /* keep logging */ }
        current = () => config;
        report('settings disposed');
      });
    } catch (error) {
      ctx.logger.warn(`provider-hub: settings setup failed (entry fallback): ${error instanceof Error ? error.message : String(error)}`);
    }
  });

  ctx.logger.info(
    `provider-hub: registered ${current().gateways.length} gateway(s): ${current().gateways.map((gw) => `${gw.provider}(${gw.api}${gw.baseURL ? ` -> ${gw.baseURL}` : ''})`).join(', ')}`,
  );
}

export { MODEL_CATALOG, resolveModelEntries };
export { GatewayAdapter } from './adapter.ts';
