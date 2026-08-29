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
 * WRITE MODEL (important): the dsh-settings `mutate` path ops only walk
 * plain objects — array indices (`['gateways', '0', ...]`) would turn the
 * gateways array into `{ '0': ... }` and the schema rejects it with
 * `$gateways expected array but got [object Object]`. Every mutation
 * therefore rewrites the WHOLE gateways array through one `['gateways']` op,
 * computed from the live configuration.
 *
 * @module dsh-provider-hub/host/runtime
 */
import { TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol';
import type { LlmDiscoveredModel } from '@deepseek-ai/dsh-llm';
import { MODEL_CATALOG, resolveModelEntries } from '../catalog.ts';
import { discoverModels } from '../discovery.ts';
import type { GatewayConfig, WireConfig } from '../types.ts';
import { joinEndpoint } from '../url.ts';

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
  mutate(ns: string, ops: unknown[], expectedRevision?: number): Promise<unknown>;
  describe?(options?: { redactSecrets?: boolean }): Array<{ ns: string; value?: unknown; user?: unknown; revision: number }>;
  writable?: boolean;
}

/** Namespace view of the settings document (what describe() reports). */
interface SettingsView {
  gateways?: unknown;
  revision: number;
}

/** A settings write refused because the namespace moved since it was read. */
function isSettingsConflict(error: unknown): boolean {
  return error instanceof Error && error.message.includes('SETTINGS_CONFLICT') || (error !== null && typeof error === 'object' && (error as { code?: unknown }).code === 'SETTINGS_CONFLICT');
}

export interface ProviderHubRuntimeDeps {
  /** Current configuration (live-updating via installSettingsSection). */
  current(): WireConfig;
  /** API-key resolver for one gateway. */
  resolveApiKey(gw: GatewayConfig): Promise<string>;
  /** Gateway config by provider route. */
  gatewayFor(provider: string): GatewayConfig | undefined;
  /** Diagnostic sink (logger.info) for the settings write/read chain. */
  log(message: string): void;
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

  /** Live namespace view (describe mirrors the current map registration). */
  private view(): SettingsView | undefined {
    try {
      const s = this.settings();
      const d = s?.describe?.({ redactSecrets: true })?.find((c) => c.ns === 'llm-provider-hub');
      if (d === undefined) return undefined;
      return { gateways: (d.value as { gateways?: unknown } | undefined)?.gateways, revision: d.revision };
    } catch {
      return undefined;
    }
  }

  /**
   * Serialized settings write with revision guard: reads the current revision,
   * applies the ops, retries ONCE on a namepsace conflict, and returns the
   * post-write revision so the caller can verify the commit landed.
   */
  private async writeOps(st: SettingsLike, ops: Op[]): Promise<{ revision?: number; committed: boolean }> {
    for (let attempt = 0; attempt < 2; attempt++) {
      const view = this.view();
      try {
        await st.mutate('llm-provider-hub', ops, view?.revision);
        const after = this.view();
        return { revision: after?.revision, committed: after !== undefined };
      } catch (error) {
        if (attempt === 0 && isSettingsConflict(error)) continue;
        throw error;
      }
    }
    // Unreachable: the loop returns on success or throws.
    return { committed: false };
  }

  /** Replace the whole gateways array in the settings document (one flat op). */
  private async setGateways(st: SettingsLike, gateways: GatewayConfig[]): Promise<{ revision?: number; committed: boolean }> {
    return this.writeOps(st, [{ op: 'set', path: ['gateways'], value: gateways }]);
  }

  /** Gateway at index, or undefined. */
  private gatewayAt(index: number): GatewayConfig | undefined {
    return this.deps.current().gateways[index];
  }

  /** Full state for the settings page: gateways + per-gateway resolved models + shared catalog. */
  async getState(): Promise<Envelope> {
    try {
      const config = this.deps.current();
      const view = this.view();
      const liveG = Array.isArray(view?.gateways) ? (view.gateways as unknown[]).length : undefined;
      this.deps.log(
        `getState: current()=${config.gateways.length} describe=${String(liveG)} scope-user=${String(Array.isArray(view?.gateways) ? (view.gateways as unknown[]).length : 'n/a')} revision=${String(view?.revision)}`,
      );
      return ok({
        config,
        gateways: config.gateways.map((gw, index) => ({
          index,
          gateway: gw,
          models: resolveModelEntries(gw),
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
      this.deps.log(`addGateway: before mutate current()=${config.gateways.length} describe=${String(this.view()?.revision)}`);
      const used = new Set(config.gateways.map((gw) => gw.provider));
      let base = 'hub-gateway';
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
      const index = config.gateways.length;
      const committed = await this.setGateways(st, [...config.gateways, gw]);
      const after = this.deps.current();
      const afterView = this.view();
      this.deps.log(
        `addGateway: after current()=${after.gateways.length} describe=${String(Array.isArray(afterView?.gateways) ? (afterView.gateways as unknown[]).length : 'n/a')} revision=${String(afterView?.revision)} committed=${String(committed.committed)}`,
      );
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
      await this.setGateways(st, next);
      return ok({ removed: index, gateways: next.length });
    } catch (error) {
      return fail(error);
    }
  }

  /** Write one or more fields of one gateway (whole-array write). */
  async saveConfig(index: number, patch: Record<string, unknown>): Promise<Envelope> {
    try {
      const st = this.settings();
      if (st === undefined) return fail('settings service unavailable');
      if (st.writable === false) return fail('settings are read-only');
      const gw = this.gatewayAt(index);
      if (gw === undefined) return fail('gateway index out of range');
      const config = this.deps.current();
      const next = config.gateways.map((g, i) => (i === index ? ({ ...g, ...patch } as GatewayConfig) : g));
      await this.setGateways(st, next);
      return ok({ config: this.deps.current() });
    } catch (error) {
      return fail(error);
    }
  }

  /** Enable/disable a built-in catalog model id on one gateway. */
  async toggleBuiltin(index: number, id: string, enabled: boolean): Promise<Envelope> {
    try {
      const gw = this.gatewayAt(index);
      if (gw === undefined) return fail('gateway index out of range');
      const set = new Set(gw.enabledModels ?? []);
      if (enabled) set.add(id);
      else set.delete(id);
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
      const custom = [...(gw.customModels ?? [])] as unknown as Array<Record<string, unknown>>;
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

  /** Discover models with the saved gateway configuration. */
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

  /**
   * Test an unsaved gateway draft against GET {baseURL}/models. This is kept
   * separate from discover(): the settings page can verify a freshly typed
   * URL/key/UA/header combination without persisting it first. The FULL model
   * listing rides along in the envelope so the client can seed its discovery
   * list without a second round-trip.
   */
  async testConnection(index: number, draft: Record<string, unknown>): Promise<Envelope> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);
    try {
      const saved = this.gatewayAt(index);
      if (saved === undefined) return fail('gateway index out of range');
      // The draft crosses the typert boundary as a plain object: merge it over
      // the saved gateway field by field, keeping every field type-safe
      // (an ill-typed draft falls back to the saved value instead of
      // corrupting the probe).
      const str = (v: unknown, fallback: string): string => (typeof v === 'string' ? v : fallback);
      const api = draft.api;
      const headers: unknown = draft.extraHeaders === undefined ? saved.extraHeaders : draft.extraHeaders;
      if (headers === null || typeof headers !== 'object' || Array.isArray(headers)) {
        return fail('extraHeaders must be a JSON object');
      }
      for (const [name, value] of Object.entries(headers)) {
        if (typeof value !== 'string') return fail(`extraHeaders.${name} must be a string`);
      }
      const testGateway: GatewayConfig = {
        ...saved,
        provider: str(draft.provider, saved.provider),
        displayName: str(draft.displayName, saved.displayName),
        baseURL: str(draft.baseURL, saved.baseURL ?? ''),
        api: api === 'openai-completions' || api === 'anthropic-messages' ? api : saved.api,
        userAgent: str(draft.userAgent, saved.userAgent),
        apiKey: str(draft.apiKey, saved.apiKey),
        apiKeyEnv: str(draft.apiKeyEnv, saved.apiKeyEnv),
        anthropicThinking: typeof draft.anthropicThinking === 'boolean' ? draft.anthropicThinking : saved.anthropicThinking,
        extraHeaders: headers as Record<string, string>,
      };
      // str() guarantees a string, but the GatewayConfig annotation widens the
      // field back to `string | undefined`.
      const baseURL = (testGateway.baseURL ?? '').trim();
      if (baseURL === '') return fail('Base URL is required');
      let parsed: URL;
      try {
        parsed = new URL(baseURL);
      } catch {
        return fail('Base URL is not a valid URL');
      }
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return fail('Base URL must use http or https');
      const started = Date.now();
      const models = await discoverModels(
        { baseURL, signal: controller.signal },
        testGateway,
        () => this.deps.resolveApiKey(testGateway),
      );
      return ok({
        endpoint: joinEndpoint(baseURL, '/models'),
        latencyMs: Date.now() - started,
        modelCount: models.length,
        models,
      });
    } catch (error) {
      if (controller.signal.aborted) return fail('Connection timed out after 15 seconds');
      return fail(error);
    } finally {
      clearTimeout(timeout);
    }
  }

  /**
   * Enable one model on one gateway: if the id hits the built-in catalog,
   * enable it in `enabledModels` (discovery/preset params richer than the
   * catalog seed an override); otherwise insert it as a custom model. One
   * whole-array write.
   */
  async enableDiscovered(index: number, model: Record<string, unknown>): Promise<Envelope> {
    try {
      const st = this.settings();
      if (st === undefined) return fail('settings service unavailable');
      const gw = this.gatewayAt(index);
      if (gw === undefined) return fail('gateway index out of range');
      const id = typeof model.id === 'string' ? model.id.trim() : '';
      if (id === '') return fail('model needs a non-empty id');
      let next: GatewayConfig;
      let kind: string;
      if (MODEL_CATALOG[id] !== undefined) {
        // Built-in: enable it (optionally seeding an override from parameters).
        const set = new Set(gw.enabledModels ?? []);
        set.add(id);
        const patch: Record<string, unknown> = { enabledModels: [...set] };
        const discoveredCtx = typeof model.contextWindow === 'number' && Number.isFinite(model.contextWindow) ? model.contextWindow as number : undefined;
        const discoveredMax = typeof model.maxTokens === 'number' && Number.isFinite(model.maxTokens) ? model.maxTokens as number : undefined;
        if (discoveredCtx !== undefined || discoveredMax !== undefined) {
          const overrides = { ...(gw.modelOverrides ?? {}) } as Record<string, Record<string, unknown>>;
          const cur = overrides[id] ?? {};
          const nextOv: Record<string, unknown> = { ...cur };
          if (discoveredCtx !== undefined) nextOv.contextWindow = discoveredCtx;
          if (discoveredMax !== undefined) nextOv.maxTokens = discoveredMax;
          overrides[id] = nextOv;
          patch.modelOverrides = overrides;
        }
        next = { ...gw, ...patch };
        kind = 'builtin';
      } else {
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
        next = { ...gw, customModels: custom as unknown as typeof gw.customModels };
        kind = 'custom';
      }
      const config = this.deps.current();
      const gws = config.gateways.map((g, i) => (i === index ? next : g));
      await this.setGateways(st, gws);
      return ok({ enabled: id, kind });
    } catch (error) {
      return fail(error);
    }
  }
}
