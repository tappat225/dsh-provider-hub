/**
 * ProviderHubRuntime — the Typert Remote service backing the client-side
 * settings page. Reads/writes the `llm-provider-hub` settings section and
 * serves model management operations (built-in toggles, overrides, custom
 * models, unified model upsert/delete, preset import, discovery), each scoped
 * to ONE gateway by index.
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
import { assertUsableApiKey, type LlmDiscoveredModel } from '@deepseek-ai/dsh-llm';
import { credentialRef } from '@deepseek-ai/dsh-credentials';
import { MODEL_CATALOG, gatewayModelDefaults, positiveInt, resolveModelEntries } from '../catalog.ts';
import { discoverModels } from '../discovery.ts';
import { DEFAULT_USER_AGENT, type GatewayConfig, type WireConfig } from '../types.ts';
import { redactUrl, resolveEndpointUrl } from '../url.ts';

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

/** Reasoning-effort levels a model entry may declare (escalation order). */
const REASONING_LEVELS = ['off', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max'] as const;

/** A validated/normalized upsertModel payload: id (+ optional edit source id) and the fields it provides. */
interface ValidatedModelEntry {
  id: string;
  /** When set: the client is EDITING this existing entry (allows an id change / rename). */
  originalId?: string;
  /** Provided fields only — the caller merges these over the stored entry field by field. */
  fields: Record<string, unknown>;
}

/**
 * Validate and normalize one model-entry payload (unified entry validation):
 * id non-empty; name optional (trimmed, empty dropped); contextWindow/maxTokens
 * positive integers when provided; input filtered to text/image and deduped;
 * reasoningEfforts either `false` (non-reasoning marker) or a level->wire map
 * whose keys are off/minimal/low/medium/high/xhigh/max, where every non-off
 * level carries a non-empty wire value and at least one non-off level exists.
 *
 * Throws Error with a user-facing message; upsertModel converts it to
 * `{ ok: false, error }` before any settings mutation, so a rejected entry
 * never touches stored configuration.
 */
function validateModelEntry(raw: unknown): ValidatedModelEntry {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('model entry must be a JSON object');
  }
  const entry = raw as Record<string, unknown>;
  const id = typeof entry.id === 'string' ? entry.id.trim() : '';
  if (id === '') throw new Error('model entry needs a non-empty id');
  const originalIdRaw = entry.originalId;
  const originalId = typeof originalIdRaw === 'string' && originalIdRaw.trim() !== '' ? originalIdRaw.trim() : undefined;
  const fields: Record<string, unknown> = {};
  if (entry.name !== undefined && entry.name !== null) {
    if (typeof entry.name !== 'string') throw new Error('name must be a string');
    const name = entry.name.trim();
    if (name !== '') fields.name = name;
  }
  for (const key of ['contextWindow', 'maxTokens'] as const) {
    const value = entry[key];
    if (value === undefined || value === null) continue;
    if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0) {
      throw new Error(`${key} must be a positive integer`);
    }
    fields[key] = value;
  }
  if (entry.input !== undefined && entry.input !== null) {
    if (!Array.isArray(entry.input)) throw new Error('input must be an array');
    const input = [...new Set(entry.input.filter((m) => m === 'text' || m === 'image'))];
    if (input.length > 0) fields.input = input;
  }
  if (entry.reasoningEfforts !== undefined && entry.reasoningEfforts !== null) {
    if (entry.reasoningEfforts === false) {
      fields.reasoningEfforts = false;
    } else if (typeof entry.reasoningEfforts === 'object' && !Array.isArray(entry.reasoningEfforts)) {
      const efforts: Record<string, string | null> = {};
      let thinking = false;
      for (const level of Object.keys(entry.reasoningEfforts as object)) {
        if (!(REASONING_LEVELS as readonly string[]).includes(level)) {
          throw new Error(`unknown reasoning level "${level}"; allowed levels: ${REASONING_LEVELS.join(', ')}`);
        }
        if (level === 'off') {
          efforts.off = null;
          continue;
        }
        const wire = (entry.reasoningEfforts as Record<string, unknown>)[level];
        if (wire === null) throw new Error(`reasoningEfforts.${level} needs the wire value dispatch should send; only "off" may be empty`);
        if (typeof wire !== 'string' || wire.trim() === '') throw new Error(`reasoningEfforts.${level} must be a non-empty string`);
        efforts[level] = wire.trim();
        thinking = true;
      }
      if (Object.keys(efforts).length === 0) throw new Error('reasoningEfforts is empty: declare at least one level, or mark the model non-reasoning with false');
      if (!thinking) throw new Error('reasoningEfforts must include at least one non-off level');
      fields.reasoningEfforts = efforts;
    } else {
      throw new Error('reasoningEfforts must be false (non-reasoning) or a { level: wireValue } map');
    }
  }
  return { id, originalId, fields };
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

  /**
   * Commit one gateway's NEXT configuration through the whole-array write —
   * but only after the resulting model list still resolves. resolveModelEntries
   * is the read-side contract (the adapter resolves through it on every
   * request), so a write that would break it — e.g. a reasoning map with no
   * spellable level — is refused here, before any settings mutation.
   */
  private async commitGateway(st: SettingsLike, index: number, next: GatewayConfig): Promise<Envelope> {
    let models: ReturnType<typeof resolveModelEntries>;
    try {
      models = resolveModelEntries(next);
    } catch (error) {
      return fail(`refusing to write: the gateway's model list would not resolve — ${error instanceof Error ? error.message : String(error)}`);
    }
    const config = this.deps.current();
    await this.setGateways(st, config.gateways.map((g, i) => (i === index ? next : g)));
    return ok({ index, models });
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
      const credentials = this.hostCtx.get<{
        describe?(ref: unknown): Promise<{ configured?: boolean } | undefined>;
      }>('credentials');
      const publicGateways = await Promise.all(config.gateways.map(async (gw) => {
        const { apiKey: _secret, ...safe } = gw;
        let configured = typeof _secret === 'string' && _secret.trim() !== '';
        try {
          const description = credentials?.describe !== undefined
            ? await credentials.describe(credentialRef(gw.apiKeyEnv))
            : undefined;
          configured ||= description?.configured === true;
        } catch { /* an unavailable credential descriptor is not a page failure */ }
        return { gateway: { ...safe, apiKeyConfigured: configured }, models: resolveModelEntries(gw) };
      }));
      const safeConfig = { gateways: publicGateways.map((item) => item.gateway) };
      return ok({
        config: safeConfig,
        gateways: publicGateways.map((item, index) => ({ index, gateway: item.gateway, models: item.models })),
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
        endpointMode: 'auto',
        endpoint: '',
        userAgent: DEFAULT_USER_AGENT,
        apiKeyEnv: 'GATEWAY_API_KEY',
        apiKey: '',
        extraHeaders: {},
        systemRole: 'system',
        streamUsage: true,
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
      // Provider renames apply live (routes are re-registered on every commit),
      // but two gateways sharing one route name would silently shadow each
      // other in the llm registry — refuse the collision at write time.
      let normalizedPatch = patch;
      if (patch.provider !== undefined) {
        const provider = typeof patch.provider === 'string' ? patch.provider.trim() : '';
        if (provider === '') return fail('provider id must not be empty');
        if (config.gateways.some((g, i) => i !== index && g.provider.trim() === provider)) {
          return fail(`provider id "${provider}" is already used by another gateway`);
        }
        normalizedPatch = { ...patch, provider };
      }
      // Wire-critical field validation: refuse a bad protocol value, URL, UA,
      // or header at write time instead of failing at request time. Header
      // names/values carrying CR/LF would let a request inject upstream
      // headers, so they are refused here AND in the adapter (hand-edited
      // settings.yaml skips this path).
      if (patch.api !== undefined
        && patch.api !== 'anthropic-messages' && patch.api !== 'openai-completions' && patch.api !== 'openai-responses') {
        return fail('api must be "anthropic-messages", "openai-completions" or "openai-responses"');
      }
      if (patch.endpointMode !== undefined && patch.endpointMode !== 'auto' && patch.endpointMode !== 'custom') {
        return fail('endpointMode must be "auto" or "custom"');
      }
      if (patch.endpoint !== undefined) {
        if (typeof patch.endpoint !== 'string') return fail('endpoint must be a string');
        const endpoint = patch.endpoint.trim();
        if (endpoint !== '') {
          if (/[\r\n]/.test(endpoint)) return fail('endpoint must not contain line breaks');
          try {
            const parsed = new URL(endpoint);
            if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return fail('endpoint must use http or https');
          } catch {
            return fail('endpoint is not a valid URL');
          }
        }
      }
      if (patch.systemRole !== undefined && patch.systemRole !== 'system' && patch.systemRole !== 'developer') {
        return fail('systemRole must be "system" or "developer"');
      }
      if (patch.baseURL !== undefined) {
        if (typeof patch.baseURL !== 'string') return fail('baseURL must be a string');
        const base = patch.baseURL.trim();
        if (base !== '') {
          try {
            const parsed = new URL(base);
            if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return fail('baseURL must use http or https');
          } catch {
            return fail('baseURL is not a valid URL');
          }
        }
      }
      if (patch.userAgent !== undefined) {
        if (typeof patch.userAgent !== 'string') return fail('userAgent must be a string');
        if (/[\r\n]/.test(patch.userAgent)) return fail('userAgent must not contain line breaks');
      }
      if (patch.extraHeaders !== undefined) {
        const headers = patch.extraHeaders;
        if (headers === null || typeof headers !== 'object' || Array.isArray(headers)) return fail('extraHeaders must be a JSON object');
        for (const [name, value] of Object.entries(headers)) {
          if (typeof value !== 'string') return fail(`extraHeaders.${name} must be a string`);
          if (/[\r\n]/.test(name) || /[\r\n]/.test(value)) return fail(`extraHeaders.${name} must not contain line breaks`);
        }
      }
      if (patch.streamUsage !== undefined && typeof patch.streamUsage !== 'boolean') {
        return fail('streamUsage must be a boolean');
      }
      // Model-parameter defaults: positive-integer capacities, a modality
      // list, and a level->tokens budget dict (values feed the Anthropic
      // budget table, so zero/negative/fractal values are refused).
      if (patch.defaultContextWindow !== undefined && patch.defaultContextWindow !== null && !positiveInt(patch.defaultContextWindow)) {
        return fail('defaultContextWindow must be a positive integer');
      }
      if (patch.defaultMaxTokens !== undefined && patch.defaultMaxTokens !== null && !positiveInt(patch.defaultMaxTokens)) {
        return fail('defaultMaxTokens must be a positive integer');
      }
      if (patch.defaultInput !== undefined && patch.defaultInput !== null) {
        if (!Array.isArray(patch.defaultInput)) return fail('defaultInput must be an array');
        for (const modality of patch.defaultInput) {
          if (modality !== 'text' && modality !== 'image' && modality !== 'audio') {
            return fail('defaultInput must contain only "text", "image" or "audio"');
          }
        }
      }
      // API keys are write-only: store a newly entered key in credentials and
      // never persist or forward the literal through the settings document.
      // An empty/omitted value means "keep the existing credential".
      const requestedApiKey = patch.apiKey;
      const patchWithoutSecret = { ...normalizedPatch };
      delete patchWithoutSecret.apiKey;
      if (requestedApiKey !== undefined) {
        if (typeof requestedApiKey !== 'string') return fail('apiKey must be a string');
        const literal = requestedApiKey.trim();
        if (literal !== '') {
          const envName = typeof patchWithoutSecret.apiKeyEnv === 'string' && patchWithoutSecret.apiKeyEnv.trim() !== ''
            ? patchWithoutSecret.apiKeyEnv.trim() : gw.apiKeyEnv;
          try {
            const credentials = this.hostCtx.get<{ set(ref: unknown, value: string): Promise<void> }>('credentials');
            if (credentials === undefined) return fail('credentials service unavailable; API key was not stored');
            await credentials.set(credentialRef(envName), assertUsableApiKey(literal, 'llm-provider-hub', envName));
          } catch (error) {
            return fail(error);
          }
        }
      }
      const next = config.gateways.map((g, i) => (i === index ? ({ ...g, ...patchWithoutSecret, apiKey: '' } as GatewayConfig) : g));
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

  /**
   * Replace the modelOverrides map of one gateway wholesale. The resulting
   * model list must still resolve (the same read-side contract the unified
   * write path enforces), so a map the resolution would refuse — e.g. an
   * off-only reasoning map — is rejected BEFORE the settings write instead of
   * bricking the gateway's read side.
   */
  async saveOverrides(index: number, overrides: Record<string, unknown>): Promise<Envelope> {
    try {
      const gw = this.gatewayAt(index);
      if (gw === undefined) return fail('gateway index out of range');
      if (overrides === null || typeof overrides !== 'object' || Array.isArray(overrides)) {
        return fail('modelOverrides must be a JSON object');
      }
      try {
        resolveModelEntries({ ...gw, modelOverrides: overrides as GatewayConfig['modelOverrides'] });
      } catch (error) {
        return fail(`refusing to save: the gateway's model list would not resolve — ${error instanceof Error ? error.message : String(error)}`);
      }
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

  /**
   * Unified model upsert for ONE gateway (model-edit phase 1). Dispatch is by
   * id, mirroring the reference configurator's applyModelConfig semantics on
   * this plugin's storage shape:
   *
   *   - built-in catalog id: ensures `enabledModels`, merges the provided
   *     fields into `modelOverrides[id]` field by field, drops the fields
   *     named in `clearFields` (they fall back to catalog inheritance), and
   *     deletes the override entirely once it ends up empty.
   *   - any other id: upserts a `customModels` entry; contextWindow/maxTokens
   *     must be positive integers — a NEW custom entry gets no hard-coded
   *     128000/8192 fallback (it may omit a capacity only when the gateway
   *     declares the matching default, which resolution then applies), and
   *     an EDIT keeps the previous entry's values.
   *   - `entry.reasoningEfforts: false` declares a non-reasoning model: for a
   *     custom entry it removes the map (resolution serves no reasoning
   *     control); on a BUILT-IN id it is refused, because the override shape
   *     can only express reasoning by inheritance — silently clearing would
   *     keep the catalog's control alive while looking disabled.
   *   - a same-id builtin/custom collision is refused explicitly (the
   *     resolution would serve two entries with one id).
   *   - overwrite=false refuses an already-configured target: for a custom id
   *     that means the entry exists; for a built-in id that means it is
   *     enabled AND already carries a non-empty override.
   *   - `entry.originalId` (optional) marks an EDIT: renaming a custom entry
   *     onto a fresh id forms a NEW entry and removes the old one; renaming
   *     onto a built-in id (or between built-in ids) is refused.
   *
   * The write is gated on resolveModelEntries, so a configuration the read
   * side could not resolve never lands.
   */
  async upsertModel(index: number, entry: Record<string, unknown>, overwrite: boolean, clearFields: unknown): Promise<Envelope> {
    try {
      const st = this.settings();
      if (st === undefined) return fail('settings service unavailable');
      if (st.writable === false) return fail('settings are read-only');
      const gw = this.gatewayAt(index);
      if (gw === undefined) return fail('gateway index out of range');
      const { id, originalId, fields } = validateModelEntry(entry);
      const clears = new Set(Array.isArray(clearFields) ? clearFields.filter((k): k is string => typeof k === 'string') : []);
      if (MODEL_CATALOG[id] !== undefined) {
        // ---- built-in path: enabledModels + modelOverrides[id] ----
        if (fields.reasoningEfforts === false) {
          return fail(`built-in model "${id}" cannot declare reasoningEfforts: false; a built-in model inherits the catalog's reasoning map unless the override clears it (clearFields: ["reasoningEfforts"])`);
        }
        if (originalId !== undefined && originalId !== id) {
          return fail(MODEL_CATALOG[originalId] !== undefined
            ? `cannot rename built-in model "${originalId}" to "${id}"; built-in model ids are fixed`
            : `cannot rename custom model "${originalId}" onto built-in id "${id}"; configure the built-in override directly`);
        }
        if ((gw.customModels ?? []).some((c) => c.id === id)) {
          return fail(`model id "${id}" is a built-in catalog model, but a custom model with the same id exists on this gateway; remove the custom entry first`);
        }
        const wasEnabled = (gw.enabledModels ?? []).includes(id);
        const prevOverride = (gw.modelOverrides ?? {})[id];
        const hadOverride = prevOverride !== undefined && prevOverride !== null && typeof prevOverride === 'object' && Object.keys(prevOverride).length > 0;
        if (wasEnabled && hadOverride && overwrite !== true) {
          return fail(`built-in model "${id}" already has saved overrides; confirm overwrite to merge`);
        }
        const enabled = new Set(gw.enabledModels ?? []);
        enabled.add(id);
        const overrides = { ...(gw.modelOverrides ?? {}) } as Record<string, Record<string, unknown>>;
        const merged: Record<string, unknown> = { ...(prevOverride ?? {}) };
        for (const key of clears) delete merged[key];
        for (const [key, value] of Object.entries(fields)) merged[key] = value;
        if (Object.keys(merged).length === 0) delete overrides[id];
        else overrides[id] = merged;
        const next: GatewayConfig = { ...gw, enabledModels: [...enabled], modelOverrides: overrides };
        const committed = await this.commitGateway(st, index, next);
        return committed.ok ? ok({ ...committed, model: id, kind: 'builtin', override: overrides[id] }) : committed;
      }
      // ---- custom path: customModels entry ----
      if (originalId !== undefined && MODEL_CATALOG[originalId] !== undefined) {
        return fail(`model "${originalId}" is a built-in catalog model and cannot be edited as a custom entry; configure its override instead`);
      }
      const custom = [...(gw.customModels ?? [])] as unknown as Array<Record<string, unknown>>;
      const sourceId = originalId ?? id;
      const sourceIdx = custom.findIndex((item) => item.id === sourceId);
      if (originalId !== undefined && sourceIdx < 0) {
        return fail(`model "${sourceId}" does not exist on this gateway; refresh and retry`);
      }
      const targetIdx = custom.findIndex((item) => item.id === id);
      if (targetIdx >= 0 && overwrite !== true) {
        return fail(`model "${id}" already exists on this gateway; confirm overwrite to replace it`);
      }
      // A `false` reasoningEfforts declares a non-reasoning model: with no map
      // stored, resolution serves no reasoning control at all. Drop the
      // marker from the built fields so the stored entry carries NO map.
      const builtFields: Record<string, unknown> = { ...fields };
      if (builtFields.reasoningEfforts === false) {
        clears.add('reasoningEfforts');
        delete builtFields.reasoningEfforts;
      }
      // Keep every field the caller did not send (and did not clear) from the
      // entry being edited; a rename onto an existing id overwrites THAT
      // entry's fields instead (mirrors the reference's kept/built merge).
      const prevBase = targetIdx >= 0 ? custom[targetIdx] : (sourceIdx >= 0 ? custom[sourceIdx] : undefined);
      const kept: Record<string, unknown> = {};
      if (prevBase !== null && typeof prevBase === 'object') {
        for (const [key, value] of Object.entries(prevBase as Record<string, unknown>)) {
          if (key !== 'id' && !clears.has(key)) kept[key] = value;
        }
      }
      const finalEntry: Record<string, unknown> = { ...kept, ...builtFields, id };
      // Custom capacities are REQUIRED data unless this gateway declares the
      // matching default: when `defaultContextWindow` / `defaultMaxTokens`
      // exist, an entry may omit the capacity and resolution fills it (entry
      // source "gateway-default"). There is no hard-coded fallback: with no
      // gateway default the omission is refused, exactly as before. A kept
      // value that is not a positive integer is dropped in favor of the
      // default, refused otherwise.
      const defaults = gatewayModelDefaults(gw);
      for (const key of ['contextWindow', 'maxTokens'] as const) {
        if (positiveInt(finalEntry[key])) continue;
        if (defaults[key] !== undefined) {
          delete finalEntry[key];
          continue;
        }
        return fail(`custom model "${id}" needs a positive integer ${key} (none provided, none kept from the previous entry, and the gateway has no ${key === 'contextWindow' ? 'defaultContextWindow' : 'defaultMaxTokens'} fallback)`);
      }
      if (finalEntry.name !== undefined && (typeof finalEntry.name !== 'string' || (finalEntry.name as string).trim() === '')) {
        delete finalEntry.name;
      }
      const nextCustom: Array<Record<string, unknown>> = [];
      for (let i = 0; i < custom.length; i++) {
        if (i === sourceIdx && sourceIdx !== targetIdx) continue; // renamed away: old slot removed
        if (i === targetIdx) nextCustom.push(finalEntry); // slot replaced by the merged entry
        else nextCustom.push(custom[i]);
      }
      if (targetIdx < 0) nextCustom.push(finalEntry); // new slot (create or rename to a fresh id)
      const next: GatewayConfig = { ...gw, customModels: nextCustom as unknown as typeof gw.customModels };
      const committed = await this.commitGateway(st, index, next);
      return committed.ok ? ok({ ...committed, model: id, kind: 'custom', custom: finalEntry }) : committed;
    } catch (error) {
      return fail(error);
    }
  }

  /**
   * Unified model delete for ONE gateway: a built-in catalog id is removed
   * from `enabledModels` TOGETHER with its `modelOverrides` entry; any other
   * id is removed from `customModels`. An id unknown to the catalog but
   * present in `enabledModels`/`modelOverrides` (hand-edited settings or a
   * retired catalog entry) is cleaned up too, so the unified delete still
   * works on legacy data. Unknown/unconfigured ids are refused.
   */
  async deleteModel(index: number, id: string): Promise<Envelope> {
    try {
      const st = this.settings();
      if (st === undefined) return fail('settings service unavailable');
      if (st.writable === false) return fail('settings are read-only');
      const gw = this.gatewayAt(index);
      if (gw === undefined) return fail('gateway index out of range');
      const modelId = typeof id === 'string' ? id.trim() : '';
      if (modelId === '') return fail('model id must not be empty');
      let next: GatewayConfig;
      let kind: string;
      if (MODEL_CATALOG[modelId] !== undefined) {
        const wasEnabled = (gw.enabledModels ?? []).includes(modelId);
        const hadOverride = (gw.modelOverrides ?? {})[modelId] !== undefined;
        if (!wasEnabled && !hadOverride) return fail(`built-in model "${modelId}" is not configured on this gateway`);
        next = {
          ...gw,
          enabledModels: (gw.enabledModels ?? []).filter((m) => m !== modelId),
          modelOverrides: Object.fromEntries(Object.entries(gw.modelOverrides ?? {}).filter(([key]) => key !== modelId)) as GatewayConfig['modelOverrides'],
        };
        kind = 'builtin';
      } else if ((gw.customModels ?? []).some((item) => item.id === modelId)) {
        next = { ...gw, customModels: (gw.customModels ?? []).filter((item) => item.id !== modelId) };
        kind = 'custom';
      } else if ((gw.enabledModels ?? []).includes(modelId) || (gw.modelOverrides ?? {})[modelId] !== undefined) {
        next = {
          ...gw,
          enabledModels: (gw.enabledModels ?? []).filter((m) => m !== modelId),
          modelOverrides: Object.fromEntries(Object.entries(gw.modelOverrides ?? {}).filter(([key]) => key !== modelId)) as GatewayConfig['modelOverrides'],
        };
        kind = 'orphan';
      } else {
        return fail(`model "${modelId}" does not exist on this gateway`);
      }
      const committed = await this.commitGateway(st, index, next);
      return committed.ok ? ok({ ...committed, model: modelId, kind }) : committed;
    } catch (error) {
      return fail(error);
    }
  }

  /**
   * Whole-list model save for ONE gateway (cc-switch-style editor): the model
   * LIST (id + display name rows) is the source of truth for WHICH models
   * exist, and `params` carries the detailed per-id groups from the page's
   * "config JSON" section ({ contextWindow, maxTokens, input,
   * reasoningEfforts, ... }). Reconciliation per row:
   *
   *   - built-in catalog id: ensured in `enabledModels`; its override is
   *     rebuilt from the group (row-managed keys name/contextWindow/maxTokens
     *     come from the row + group, any OTHER previous override key — input,
   *     reasoningEfforts, ... — is preserved unless the group provides it).
   *   - any other id: a `customModels` entry rebuilt the same way; capacities
   *     come from the group, falling back to the PREVIOUS entry's value, then
   *     the gateway default — with none of the three the write is refused
   *     (no silent fallback), mirroring upsertModel.
   *   - `name` inside a group is ignored — the list row's display name wins.
   *   - ids configured before but absent from the submitted list are dropped
   *     from enabledModels/modelOverrides/customModels (orphan cleanup).
   *
   * The write is gated on resolveModelEntries (commitGateway), so an
   * unresolvable configuration never lands. One whole-array write — this is
   * the single-save path behind the settings page's one 保存 button.
   */
  async saveModels(index: number, models: unknown, params: unknown): Promise<Envelope> {
    try {
      const st = this.settings();
      if (st === undefined) return fail('settings service unavailable');
      if (st.writable === false) return fail('settings are read-only');
      const gw = this.gatewayAt(index);
      if (gw === undefined) return fail('gateway index out of range');
      if (!Array.isArray(models)) return fail('models must be an array');
      if (params === null || typeof params !== 'object' || Array.isArray(params)) {
        return fail('params must be a JSON object');
      }
      const rows: Array<{ id: string; name: string }> = [];
      const seen = new Set<string>();
      for (const raw of models) {
        if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
          return fail('each model row must be an object');
        }
        const id = typeof (raw as { id?: unknown }).id === 'string' ? ((raw as { id: string }).id).trim() : '';
        if (id === '') return fail('every model row needs a non-empty id');
        if (seen.has(id)) return fail(`duplicate model id "${id}"`);
        seen.add(id);
        const nameRaw = (raw as { name?: unknown }).name;
        if (nameRaw !== undefined && nameRaw !== null && typeof nameRaw !== 'string') {
          return fail(`model "${id}": name must be a string`);
        }
        rows.push({ id, name: typeof nameRaw === 'string' ? nameRaw.trim() : '' });
      }
      // Validate + normalize every non-empty group through the shared entry
      // validator (positive-integer capacities, filtered input, reasoning-map
      // shape). A group's `name` is row-owned and stripped before validation.
      const normalized: Record<string, Record<string, unknown>> = {};
      for (const [id, group] of Object.entries(params as Record<string, unknown>)) {
        if (group === undefined || group === null) continue;
        if (typeof group !== 'object' || Array.isArray(group)) return fail(`params.${id} must be a JSON object`);
        const { name: _rowOwned, ...rest } = group as Record<string, unknown>;
        if (Object.keys(rest).length === 0) continue;
        try {
          normalized[id] = validateModelEntry({ ...rest, id }).fields;
        } catch (error) {
          return fail(`params.${id}: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
      const defaults = gatewayModelDefaults(gw);
      const nextEnabled: string[] = [];
      const nextOverrides: Record<string, Record<string, unknown>> = {};
      const nextCustom: Array<Record<string, unknown>> = [];
      for (const row of rows) {
        const group = normalized[row.id] ?? {};
        const prevSource: Record<string, unknown> | undefined = MODEL_CATALOG[row.id] !== undefined
          ? (gw.modelOverrides ?? {})[row.id] as Record<string, unknown> | undefined
          : (gw.customModels ?? []).find((c) => c.id === row.id) as Record<string, unknown> | undefined;
        // Unmanaged = every key the row/group does not own (input,
        // reasoningEfforts, ...) from the previously stored entry/override.
        const unmanaged: Record<string, unknown> = {};
        if (prevSource !== null && typeof prevSource === 'object') {
          for (const [key, value] of Object.entries(prevSource)) {
            if (key !== 'id' && key !== 'name' && key !== 'contextWindow' && key !== 'maxTokens') unmanaged[key] = value;
          }
        }
        const built: Record<string, unknown> = { ...unmanaged, ...group };
        if (row.name !== '') built.name = row.name;
        if (MODEL_CATALOG[row.id] !== undefined) {
          if (group.reasoningEfforts === false) {
            return fail(`built-in model "${row.id}" cannot declare reasoningEfforts: false; remove the key to inherit the catalog's reasoning map`);
          }
          nextEnabled.push(row.id);
          if (Object.keys(built).length > 0) nextOverrides[row.id] = built;
        } else {
          // Custom capacities: the group wins; when it omits a capacity the
          // PREVIOUS entry's value is kept (the same edit semantics as
          // upsertModel), then the gateway default, then the write is refused.
          for (const key of ['contextWindow', 'maxTokens'] as const) {
            if (positiveInt(built[key])) continue;
            const prevValue = prevSource?.[key];
            if (positiveInt(prevValue)) {
              built[key] = prevValue;
              continue;
            }
            if (defaults[key] !== undefined) {
              delete built[key];
              continue;
            }
            return fail(`custom model "${row.id}" needs a positive integer ${key} (provide it in the gateway's config JSON, or set the gateway's default${key === 'contextWindow' ? 'ContextWindow' : 'MaxTokens'})`);
          }
          // A `false` reasoningEfforts declares a non-reasoning model: with no
          // map stored, resolution serves no reasoning control. Drop the
          // marker so the stored entry carries NO map (upsertModel semantics).
          if (built.reasoningEfforts === false) delete built.reasoningEfforts;
          built.id = row.id;
          nextCustom.push(built);
        }
      }
      const next: GatewayConfig = {
        ...gw,
        enabledModels: nextEnabled,
        modelOverrides: nextOverrides,
        customModels: nextCustom as unknown as typeof gw.customModels,
      };
      return await this.commitGateway(st, index, next);
    } catch (error) {
      return fail(error);
    }
  }

  /** Discover models with the saved gateway configuration. */
  async discover(index: number): Promise<Envelope> {    try {
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
        if (/[\r\n]/.test(name) || /[\r\n]/.test(value)) return fail(`extraHeaders.${name} must not contain line breaks`);
      }
      const testGateway: GatewayConfig = {
        ...saved,
        provider: str(draft.provider, saved.provider),
        displayName: str(draft.displayName, saved.displayName),
        baseURL: str(draft.baseURL, saved.baseURL ?? ''),
        api: api === 'openai-completions' || api === 'anthropic-messages' || api === 'openai-responses' ? api : saved.api,
        endpointMode: draft.endpointMode === 'custom' || draft.endpointMode === 'auto' ? draft.endpointMode : saved.endpointMode,
        endpoint: str(draft.endpoint, saved.endpoint ?? ''),
        userAgent: str(draft.userAgent, saved.userAgent),
        apiKey: str(draft.apiKey, saved.apiKey),
        apiKeyEnv: str(draft.apiKeyEnv, saved.apiKeyEnv),
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
      if (/[\r\n]/.test(testGateway.userAgent)) return fail('userAgent must not contain line breaks');
      const endpoint = (testGateway.endpoint ?? '').trim();
      if (endpoint !== '') {
        if (/[\r\n]/.test(endpoint)) return fail('endpoint must not contain line breaks');
        try {
          const parsedEndpoint = new URL(endpoint);
          if (parsedEndpoint.protocol !== 'http:' && parsedEndpoint.protocol !== 'https:') return fail('endpoint must use http or https');
        } catch {
          return fail('endpoint is not a valid URL');
        }
      }
      const started = Date.now();
      // The probe dials through the same unified resolver as the live adapter:
      // auto mode derives {baseURL}/models with /v1 normalization; custom mode
      // dials baseURL verbatim as the complete models URL.
      const resolved = resolveEndpointUrl({ baseURL, endpointMode: testGateway.endpointMode }, '/models');
      if (!resolved.ok) return fail(resolved.error);
      const models = await discoverModels(
        { baseURL, signal: controller.signal },
        testGateway,
        () => this.deps.resolveApiKey(testGateway),
      );
      return ok({
        endpoint: redactUrl(resolved.url),
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
        // Non-catalog: insert as custom model. Capacities come from the
        // discovery payload when disclosed; an undisclosed capacity is NOT
        // hard-coded (no 128000/8192 invention) — the entry omits it and
        // resolution fills it from the gateway's defaults, or leaves it
        // undefined when the gateway declares none.
        const custom = [...(gw.customModels ?? [])] as unknown as Array<Record<string, unknown>>;
        if (custom.some((item) => item.id === id)) return ok({ enabled: id, kind: 'custom-existing' });
        const entry: Record<string, unknown> = {
          id,
          name: typeof model.name === 'string' && model.name.trim() !== '' ? model.name : id,
          ...(positiveInt(model.contextWindow) ? { contextWindow: model.contextWindow as number } : {}),
          ...(positiveInt(model.maxTokens) ? { maxTokens: model.maxTokens as number } : {}),
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
