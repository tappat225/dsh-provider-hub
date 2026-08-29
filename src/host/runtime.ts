/**
 * ProviderHubRuntime — the Typert Remote service backing the client-side
 * settings page. Reads/writes the `llm-provider-hub` settings section and
 * serves model management operations (built-in toggles, overrides, custom
 * models, preset import, discovery), each scoped to ONE gateway by index.
 *
 * Every method answers the business envelope `{ ok: true, ... }` or
 * `{ ok: false, error }`; the typert boundary adds its own transport
 * envelope.
 *
 * @module dsh-provider-hub/host/runtime
 */
import { TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol';
import type { LlmModelInfo, LlmDiscoveredModel, LlmResolvedModelInfo } from '@deepseek-ai/dsh-llm';
import { MODEL_CATALOG, resolveModelEntries } from '../catalog.ts';
import { discoverModels } from '../discovery.ts';
import type { GatewayConfig, PresetFrom, WireConfig } from '../types.ts';

/** Business envelope: every method answers `{ ok, ... }` or `{ ok: false, error }`. */
type Envelope = { ok: boolean } & Record<string, unknown>;

function ok(value: Record<string, unknown>): Envelope {
  return { ok: true, ...value };
}
function fail(error: unknown): Envelope {
  return { ok: false, error: error instanceof Error ? error.message : String(error) };
}

/** Minimal ctx surface used by the runtime (settings / llm services). */
interface ContextLike {
  get<T = unknown>(name: string): T | undefined;
  effect?: (fn: () => unknown, label?: string) => unknown;
}

/** Settings service surface used by the runtime. */
interface SettingsLike {
  mutate(ns: string, ops: unknown[]): Promise<unknown>;
  writable?: boolean;
}

/** LLM service surface used by the runtime. */
interface LlmLike {
  listProviders(): Array<{ id: string; name: string }>;
  listConfigurableProviders(): Array<{ provider: string; displayName: string }>;
  listModels(provider: string): Promise<readonly LlmModelInfo[]>;
  resolveModelInfo(provider: string, model: string): Promise<LlmResolvedModelInfo>;
}

export interface ProviderHubRuntimeDeps {
  /** Current configuration (live-updating via installSettingsSection). */
  current(): WireConfig;
  /** API-key resolver for one gateway. */
  resolveApiKey(gw: GatewayConfig): Promise<string>;
  /** Gateway config by provider route. */
  gatewayFor(provider: string): GatewayConfig | undefined;
}

/** Settings mutate op shape (schemastery settings service). */
interface Op {
  op: 'set' | 'unset';
  path: string[];
  value?: unknown;
}

export class ProviderHubRuntime extends TypertRemoteService {
  private readonly hostCtx: ContextLike;
  private readonly deps: ProviderHubRuntimeDeps;

  constructor(ctx: ContextLike, deps: ProviderHubRuntimeDeps) {
    super(ctx as never, 'providerHub');
    this.hostCtx = ctx;
    this.deps = deps;
  }

  private settings(): SettingsLike | undefined {
    return this.hostCtx.get<SettingsLike>('settings');
  }

  private llm(): LlmLike | undefined {
    return this.hostCtx.get<LlmLike>('llm');
  }

  /** Gateway at index, or undefined. */
  private gatewayAt(index: number): GatewayConfig | undefined {
    return this.deps.current().gateways[index];
  }

  /** Path prefix for gateway-scoped settings ops. */
  private path(index: number, ...rest: string[]): string[] {
    return ['gateways', String(index), ...rest];
  }

  /** Full state for the settings page: gateways + per-gateway resolved models + shared catalog. */
  async getState(): Promise<Envelope> {
    try {
      const config = this.deps.current();
      return ok({
        config,
        gateways: config.gateways.map((gw, index) => ({
          index,
          gateway: gw,
          models: resolveModelEntries(gw),
          preset: gw.presetFrom,
        })),
        catalog: MODEL_CATALOG,
      });
    } catch (error) {
      return fail(error);
    }
  }

  /** Append a new gateway with defaults; returns its index. */
  async addGateway(): Promise<Envelope> {
    try {
      const st = this.settings();
      if (st === undefined) return fail('settings service unavailable');
      if (st.writable === false) return fail('settings are read-only');
      const config = this.deps.current();
      const used = new Set(config.gateways.map((gw) => gw.provider));
      let base = 'gateway';
      let provider = base;
      for (let i = 1; used.has(provider); i++) provider = `${base}-${i}`;
      const gw: GatewayConfig = {
        provider,
        displayName: provider,
        baseURL: '',
        api: 'anthropic-messages',
        userAgent: 'claude-cli/2.0.1 (external, cli)',
        apiKeyEnv: 'GATEWAY_API_KEY',
        apiKey: '',
        extraHeaders: {},
        systemRole: 'system',
        anthropicThinking: false,
        enabledModels: ['glm-5.3'],
        modelOverrides: {},
        customModels: [],
      };
      const ops: Op[] = [{ op: 'set', path: ['gateways'], value: [...config.gateways, gw] }];
      const index = config.gateways.length;
      await st.mutate('llm-provider-hub', ops);
      return ok({ index, gateway: gw });
    } catch (error) {
      return fail(error);
    }
  }

  /** Remove one gateway by index. */
  async deleteGateway(index: number): Promise<Envelope> {
    try {
      const st = this.settings();
      if (st === undefined) return fail('settings service unavailable');
      if (st.writable === false) return fail('settings are read-only');
      const config = this.deps.current();
      if (index < 0 || index >= config.gateways.length) return fail('gateway index out of range');
      const next = config.gateways.filter((_, i) => i !== index);
      await st.mutate('llm-provider-hub', [{ op: 'set', path: ['gateways'], value: next }]);
      return ok({ removed: index, gateways: next.length });
    } catch (error) {
      return fail(error);
    }
  }

  /** Write one or more fields of one gateway through the settings service. */
  async saveConfig(index: number, patch: Record<string, unknown>): Promise<Envelope> {
    try {
      const st = this.settings();
      if (st === undefined) return fail('settings service unavailable');
      if (st.writable === false) return fail('settings are read-only');
      const gw = this.gatewayAt(index);
      if (gw === undefined) return fail('gateway index out of range');
      const ops = Object.entries(patch).map(([key, value]) => ({ op: 'set', path: this.path(index, key), value }));
      await st.mutate('llm-provider-hub', ops);
      return ok({ config: this.deps.current() });
    } catch (error) {
      return fail(error);
    }
  }

  /** Enable/disable a built-in catalog model id on one gateway. Auto-snapshots before a toggle-off that would clear the last enabled model. */
  async toggleBuiltin(index: number, id: string, enabled: boolean): Promise<Envelope> {
    try {
      const gw = this.gatewayAt(index);
      if (gw === undefined) return fail('gateway index out of range');
      const set = new Set(gw.enabledModels ?? []);
      if (enabled) set.add(id);
      else {
        // Snapshot before clearing the last enabled model so it can be restored.
        if (set.size === 1 && set.has(id)) {
          const existingSnapshot = gw.catalogSnapshot;
          if (existingSnapshot === undefined || existingSnapshot.enabledModels.length === 0) {
            const st = this.settings();
            if (st !== undefined) {
              await st.mutate('llm-provider-hub', [{
                op: 'set', path: this.path(index, 'catalogSnapshot'), value: {
                  enabledModels: [...(gw.enabledModels ?? [])],
                  customModels: [...(gw.customModels ?? [])],
                },
              }]);
            }
          }
        }
        set.delete(id);
      }
      return this.saveConfig(index, { enabledModels: [...set] });
    } catch (error) {
      return fail(error);
    }
  }

  /** Replace the modelOverrides map of one gateway wholesale. */
  async saveOverrides(index: number, overrides: Record<string, unknown>): Promise<Envelope> {
    try {
      return this.saveConfig(index, { modelOverrides: overrides });
    } catch (error) {
      return fail(error);
    }
  }

  /** Insert or update one custom model entry on one gateway. */
  async upsertCustom(index: number, entry: Record<string, unknown>, originalId: Record<string, unknown> | null): Promise<Envelope> {
    try {
      const gw = this.gatewayAt(index);
      if (gw === undefined) return fail('gateway index out of range');
      const custom = (gw.customModels ?? []) as unknown as Array<Record<string, unknown>>;
      const id = typeof entry.id === 'string' && entry.id.trim() !== '' ? entry.id.trim() : undefined;
      if (id === undefined) return fail('custom model needs a non-empty id');
      const prevId = originalId !== null && typeof (originalId as { id?: unknown }).id === 'string'
        ? (originalId as { id: string }).id
        : id;
      const idx = custom.findIndex((item) => item.id === prevId);
      if (idx >= 0) custom[idx] = { ...custom[idx], ...entry, id };
      else custom.push({ ...entry, id });
      return this.saveConfig(index, { customModels: custom });
    } catch (error) {
      return fail(error);
    }
  }

  /** Delete one custom model entry from one gateway. */
  async deleteCustom(index: number, id: string): Promise<Envelope> {
    try {
      const gw = this.gatewayAt(index);
      if (gw === undefined) return fail('gateway index out of range');
      const custom = (gw.customModels ?? []).filter((item) => item.id !== id);
      return this.saveConfig(index, { customModels: custom });
    } catch (error) {
      return fail(error);
    }
  }

  /** Set or clear the presetFrom import on one gateway. */
  async setPresetFrom(index: number, preset: PresetFrom | null): Promise<Envelope> {
    try {
      const st = this.settings();
      if (st === undefined) return fail('settings service unavailable');
      const gw = this.gatewayAt(index);
      if (gw === undefined) return fail('gateway index out of range');
      const ops = preset === null
        ? [{ op: 'unset', path: this.path(index, 'presetFrom') }]
        : [{ op: 'set', path: this.path(index, 'presetFrom'), value: preset }];
      await st.mutate('llm-provider-hub', ops);
      return ok({});
    } catch (error) {
      return fail(error);
    }
  }

  /** Registered provider routes the user can import presets from. */
  async listPresets(): Promise<Envelope> {
    try {
      const llm = this.llm();
      if (llm === undefined) return fail('llm service unavailable');
      const registered = new Map(llm.listProviders().map((p) => [p.id, p.name]));
      const dir = llm.listConfigurableProviders();
      const seen = new Set<string>();
      const providers: Array<{ provider: string; displayName: string }> = [];
      for (const entry of dir) {
        if (seen.has(entry.provider)) continue;
        seen.add(entry.provider);
        providers.push({ provider: entry.provider, displayName: entry.displayName });
      }
      for (const [id, name] of registered) {
        if (seen.has(id)) continue;
        seen.add(id);
        providers.push({ provider: id, displayName: name });
      }
      return ok({ providers });
    } catch (error) {
      return fail(error);
    }
  }

  /** Models one preset provider currently advertises. */
  async presetModels(provider: string): Promise<Envelope> {
    try {
      const llm = this.llm();
      if (llm === undefined) return fail('llm service unavailable');
      const models = await llm.listModels(provider);
      return ok({ models: [...models] });
    } catch (error) {
      return fail(error);
    }
  }

  /** One preset model's full capability metadata. */
  async presetModelInfo(provider: string, model: string): Promise<Envelope> {
    try {
      const llm = this.llm();
      if (llm === undefined) return fail('llm service unavailable');
      const info = await llm.resolveModelInfo(provider, model);
      return ok({ info });
    } catch (error) {
      return fail(error);
    }
  }

  /** Discover models from one gateway (custom UA applied). */
  async discover(index: number): Promise<Envelope> {
    try {
      const gw = this.gatewayAt(index);
      if (gw === undefined) return fail('gateway index out of range');
      const models: LlmDiscoveredModel[] = await discoverModels({}, gw, () => this.deps.resolveApiKey(gw));
      return ok({ models });
    } catch (error) {
      return fail(error);
    }
  }

  /** Snapshot current catalog state (enabledModels + customModels) of one gateway. */
  async snapshotCatalog(index: number): Promise<Envelope> {
    try {
      const st = this.settings();
      if (st === undefined) return fail('settings service unavailable');
      const gw = this.gatewayAt(index);
      if (gw === undefined) return fail('gateway index out of range');
      const snapshot = {
        enabledModels: [...(gw.enabledModels ?? [])],
        customModels: [...(gw.customModels ?? [])],
      };
      await st.mutate('llm-provider-hub', [{ op: 'set', path: this.path(index, 'catalogSnapshot'), value: snapshot }]);
      return ok({ snapshot });
    } catch (error) {
      return fail(error);
    }
  }

  /** Restore the last catalog snapshot (if any) of one gateway. */
  async restoreCatalog(index: number): Promise<Envelope> {
    try {
      const st = this.settings();
      if (st === undefined) return fail('settings service unavailable');
      const gw = this.gatewayAt(index);
      if (gw === undefined) return fail('gateway index out of range');
      const snapshot = gw.catalogSnapshot;
      if (snapshot === undefined || (snapshot.enabledModels.length === 0 && snapshot.customModels.length === 0)) {
        return fail('no catalog snapshot to restore');
      }
      await st.mutate('llm-provider-hub', [
        { op: 'set', path: this.path(index, 'enabledModels'), value: snapshot.enabledModels },
        { op: 'set', path: this.path(index, 'customModels'), value: snapshot.customModels },
      ]);
      return ok({ restored: snapshot });
    } catch (error) {
      return fail(error);
    }
  }

  /**
   * Enable one discovered model on one gateway directly: if the id hits the
   * built-in catalog, enable it in `enabledModels`; otherwise insert it as a
   * custom model. Takes a snapshot before the first enable of a session so
   * bulk enables can be rolled back when they clear the catalog.
   */
  async enableDiscovered(index: number, model: Record<string, unknown>): Promise<Envelope> {
    try {
      const st = this.settings();
      if (st === undefined) return fail('settings service unavailable');
      const gw = this.gatewayAt(index);
      if (gw === undefined) return fail('gateway index out of range');
      const id = typeof model.id === 'string' ? model.id.trim() : '';
      if (id === '') return fail('discovered model needs a non-empty id');
      // Snapshot before first mutation of this session (idempotent guard: only when absent or empty).
      const existingSnapshot = gw.catalogSnapshot;
      const shouldSnapshot = existingSnapshot === undefined
        || (existingSnapshot.enabledModels.length === 0 && existingSnapshot.customModels.length === 0);
      if (shouldSnapshot) {
        await st.mutate('llm-provider-hub', [{
          op: 'set', path: this.path(index, 'catalogSnapshot'), value: {
            enabledModels: [...(gw.enabledModels ?? [])],
            customModels: [...(gw.customModels ?? [])],
          },
        }]);
      }
      if (MODEL_CATALOG[id] !== undefined) {
        // Built-in: enable it (and optionally seed override from discovery params).
        const set = new Set(gw.enabledModels ?? []);
        set.add(id);
        const ops: unknown[] = [{ op: 'set', path: this.path(index, 'enabledModels'), value: [...set] }];
        // If discovery supplied richer params than catalog, seed an override.
        const discoveredCtx = typeof model.contextWindow === 'number' && Number.isFinite(model.contextWindow) ? model.contextWindow as number : undefined;
        const discoveredMax = typeof model.maxTokens === 'number' && Number.isFinite(model.maxTokens) ? model.maxTokens as number : undefined;
        if (discoveredCtx !== undefined || discoveredMax !== undefined) {
          const overrides = { ...(gw.modelOverrides ?? {}) } as Record<string, Record<string, unknown>>;
          const cur = overrides[id] ?? {};
          const next: Record<string, unknown> = { ...cur };
          if (discoveredCtx !== undefined) next.contextWindow = discoveredCtx;
          if (discoveredMax !== undefined) next.maxTokens = discoveredMax;
          overrides[id] = next;
          ops.push({ op: 'set', path: this.path(index, 'modelOverrides'), value: overrides });
        }
        await st.mutate('llm-provider-hub', ops as never[]);
        return ok({ enabled: id, kind: 'builtin' });
      }
      // Non-catalog: insert as custom model.
      const custom = [...(gw.customModels ?? [])] as unknown as Array<Record<string, unknown>>;
      if (custom.some((item) => item.id === id)) return ok({ enabled: id, kind: 'custom-existing' });
      const entry: Record<string, unknown> = {
        id,
        name: typeof model.name === 'string' && model.name.trim() !== '' ? model.name : id,
        contextWindow: typeof model.contextWindow === 'number' && Number.isFinite(model.contextWindow) ? model.contextWindow : 128000,
        maxTokens: typeof model.maxTokens === 'number' && Number.isFinite(model.maxTokens) ? model.maxTokens : 8192,
      };
      custom.push(entry);
      await st.mutate('llm-provider-hub', [{ op: 'set', path: this.path(index, 'customModels'), value: custom }]);
      return ok({ enabled: id, kind: 'custom' });
    } catch (error) {
      return fail(error);
    }
  }
}
