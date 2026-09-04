/**
 * Provider Hub — settings page component (client half).
 * Environment-neutral: driven only by `t` (translate) and `call` (one host
 * RPC returning `{ ok, ... } | { ok: false, error }`).
 *
 * Layout (card-dashboard shell + cc-switch-style editor): a brand hero card,
 * a segmented tab bar (providers / built-in catalog) and a responsive card
 * grid where every gateway is a card (name + key Pill, endpoint meta, model
 * chips, per-card test/edit/delete). The inline editor follows the cc-switch
 * configurator recipe: basic fields, a Headers key-value row editor, a model
 * LIST (id + display name rows), and a "config JSON" section holding the
 * detailed per-model parameters. The two sync BOTH WAYS client-side: row
 * edits migrate JSON groups, and a valid JSON edit rebuilds the rows from
 * its group keys (hand-writing a group adds the model, deleting one removes
 * it), so the JSON alone is a complete editing surface. Every group always
 * reserves the complete parameter framework (name / contextWindow /
 * maxTokens / input / reasoningEfforts; null = unset). The model-id input
 * offers catalog suggestions from the first typed letter, but ONLY an
 * explicit pick (click, or arrows + Enter) applies preset parameters —
 * typing a full catalog id by hand never auto-fills. ONE 保存 at the card
 * footer commits basic fields + headers (save-config) and the whole model
 * list + params (save-models).
 *
 * @module dsh-provider-hub/client/page
 */
import type * as ReactTypes from 'react';
// Real value import: the DSH client module system resolves `react` through
// its platform seed table, so the built bundle calls require("react") and
// gets the renderer's React instance (no global dependency).
import React from 'react';
import {
  Button,
  Pill,
  StateDot,
  Menu,
  IconChevronDownOutline14,
  IconPlusOutline16,
  IconRefreshOutline16,
  IconTrashOutline16,
  IconLoadingOutline16,
} from '@deepseek-ai/dsh-client-ui-primitives';
import css from './page.css.ts';
import { zh, en } from './locales.ts';

export type Translate = (key: string) => string;
export type Call = (method: string, payload?: Record<string, unknown>) => Promise<Record<string, unknown> & { ok: boolean }>;

export { css, zh, en };

export interface PageProps {
  t: Translate;
  call: Call;
}

type Status = { kind: 'ok' | 'err'; text: string } | null;

interface GatewayEntry {
  index: number;
  gateway: Record<string, unknown>;
  models: Array<Record<string, unknown>>;
}

interface State {
  gateways: GatewayEntry[];
  /**
   * Built-in catalog presets served by the host (MODEL_CATALOG). Seeding a
   * model row from a catalog hit writes its full capability set into the
   * config-JSON group, so the user can see and edit input / reasoningEfforts
   * directly instead of relying on catalog inheritance.
   */
  catalog: Record<string, {
    name: string;
    contextWindow: number;
    maxTokens: number;
    input?: string[];
    reasoning?: Record<string, string | null>;
  }>;
  selected: number | null;
}

interface DiscoveredModel {
  id: string;
  name?: string;
  contextWindow?: number;
  maxTokens?: number;
}

/** One connection-test outcome, keyed by gateway index (null = cleared). */
interface TestResult {
  ok: boolean;
  endpoint?: string;
  latencyMs?: number;
  modelCount?: number;
  models?: DiscoveredModel[];
  error?: string;
}

/** One editable request-header row (extraHeaders key-value). */
interface HeadersRow {
  name: string;
  value: string;
}

/** One editable model-list row: the id + display name only. */
interface ModelRow {
  id: string;
  name: string;
}

/**
 * The client-side editor draft for ONE gateway (rebuilt from saved config on
 * refresh/add). `params` + `paramsText` are the "config JSON" section and
 * the source of truth for WHICH models exist: every group key is a model
 * (its optional `name` field is the display name). `modelRows` is the
 * reconciled list view plus pending rows (empty id, not yet in the JSON).
 * Row edits write through to `params` (an id edit moves the group, a name
 * edit writes group.name); a VALID JSON edit rebuilds the rows from the
 * group keys. When the textarea holds invalid JSON, `paramsValid` goes
 * false, the last parsed object stays authoritative, and model-list edits
 * are refused so the in-flight text is never clobbered.
 */
interface EditorDraft {
  headersRows: HeadersRow[];
  modelRows: ModelRow[];
  params: Record<string, Record<string, unknown>>;
  paramsText: string;
  paramsValid: boolean;
}

function posInt(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0;
}

/**
 * Complete parameter framework for ONE config-JSON group: the fixed field
 * order name → contextWindow → maxTokens → input → reasoningEfforts, with
 * `null` standing for "not set" (a catalog id inherits its preset value on
 * save; a custom model must fill contextWindow/maxTokens by hand). The
 * framework is ALWAYS reserved in the config JSON so every field stays
 * visible and hand-editable — the user can fill parameters one by one
 * without ever touching the model list. Unknown extra keys from the source
 * fields ride along at the tail; `name` is owned by the caller (the row).
 */
function frameworkGroup(fields: Record<string, unknown> | null | undefined, name: string | null): Record<string, unknown> {
  const src = fields ?? {};
  const group: Record<string, unknown> = {
    name,
    contextWindow: src.contextWindow ?? null,
    maxTokens: src.maxTokens ?? null,
    input: src.input ?? null,
    reasoningEfforts: src.reasoningEfforts ?? null,
  };
  for (const [key, value] of Object.entries(src)) {
    if (!(key in group)) group[key] = value;
  }
  return group;
}

/**
 * Catalog suggestions for one model-id input value: ids (and display names)
 * containing the typed text, case-insensitive — prefix hits first, then
 * substring hits, each alphabetical, capped at 8. From the FIRST typed
 * letter the id input offers these as a dropdown, but ONLY an explicit pick
 * (click, or arrows + Enter) applies preset parameters; typing a full
 * catalog id by hand never auto-fills anything.
 */
function suggestMatches(needle: string, catalog: State['catalog']): string[] {
  const q = needle.trim().toLowerCase();
  if (q === '') return [];
  const prefix: string[] = [];
  const contains: string[] = [];
  for (const id of Object.keys(catalog)) {
    const preset = catalog[id];
    const idLower = id.toLowerCase();
    const nameLower = String(preset?.name ?? '').toLowerCase();
    if (!idLower.includes(q) && !nameLower.includes(q)) continue;
    (idLower.startsWith(q) || nameLower.startsWith(q) ? prefix : contains).push(id);
  }
  const order = (list: string[]) => list.sort((a, b) => a.localeCompare(b));
  return [...order(prefix), ...order(contains)].slice(0, 8);
}

/**
 * Build the editor draft from one SAVED gateway. Rows come from
 * enabledModels (built-in ids, configured override name only) + customModels
 * (in storage order). The params groups reserve the COMPLETE parameter
 * framework for every row: saved fields kept as real values, every other
 * field explicitly `null` (= unset). Catalog values never leak into the
 * JSON — a null field inherits its catalog preset on save, exactly like an
 * absent field. Enabled ids unknown to the catalog (legacy hand-edited data
 * or retired presets) still list as rows; saving one requires filling its
 * capacities (the host refuses otherwise).
 */
function buildEditorDraft(gateway: Record<string, unknown>): EditorDraft {
  const overrides = (gateway.modelOverrides ?? {}) as Record<string, Record<string, unknown>>;
  const customs = (gateway.customModels ?? []) as Array<Record<string, unknown>>;
  const headers = (gateway.extraHeaders ?? {}) as Record<string, unknown>;
  const modelRows: ModelRow[] = [];
  const params: Record<string, Record<string, unknown>> = {};
  const seen = new Set<string>();
  const adopt = (id: string, name: string, fields: Record<string, unknown> | null | undefined) => {
    modelRows.push({ id, name });
    seen.add(id);
    params[id] = frameworkGroup(fields, name !== '' ? name : null);
  };
  for (const id of Array.isArray(gateway.enabledModels) ? gateway.enabledModels as string[] : []) {
    if (typeof id !== 'string' || id === '' || seen.has(id)) continue;
    const ov = overrides[id];
    const hasOverride = ov !== null && typeof ov === 'object';
    const name = hasOverride && typeof (ov as Record<string, unknown>).name === 'string' ? (ov as Record<string, string>).name : '';
    let fields: Record<string, unknown> | undefined;
    if (hasOverride) {
      const { name: _rowOwned, ...rest } = ov as Record<string, unknown>;
      if (Object.keys(rest).length > 0) fields = rest;
    }
    adopt(id, name, fields);
  }
  for (const entry of customs) {
    if (entry === null || typeof entry !== 'object') continue;
    const id = String(entry.id ?? '');
    if (id === '' || seen.has(id)) continue;
    const name = typeof entry.name === 'string' ? entry.name : '';
    const { id: _i, name: _rowOwned, ...rest } = entry as Record<string, unknown>;
    adopt(id, name, Object.keys(rest).length > 0 ? rest : undefined);
  }
  const headersRows: HeadersRow[] = Object.entries(headers).map(([name, value]) => ({ name, value: String(value ?? '') }));
  return {
    headersRows,
    modelRows,
    params,
    paramsText: JSON.stringify(params, null, 2),
    paramsValid: true,
  };
}

/**
 * Common client User-Agent presets (the cc-switch-style quick picks for
 * UA-whitelisted gateways). Selecting one only fills the editable input —
 * presets are starting points, not constraints. The two Claude forms are
 * wire-verified (air-outer relay + pi-ai's Claude Code identity header);
 * others use each client's known format with a recent version.
 */
const UA_PRESETS: Array<{ value: string; title: string }> = [
  { value: 'claude-cli/2.0.1 (external, cli)', title: 'Claude CLI (external)' },
  { value: 'claude-cli/2.1.75', title: 'Claude Code 2.1.75' },
  { value: 'codex_cli_rs/0.42.0 (Ubuntu 22.04.3 LTS; x86_64) Linux', title: 'Codex CLI' },
  { value: 'CherryStudio/1.5.0', title: 'Cherry Studio' },
  { value: 'Cline/3.17.8', title: 'Cline' },
  { value: 'Roo-Code/3.20.5', title: 'Roo Code' },
  { value: 'GeminiCLI/0.8.1', title: 'Gemini CLI' },
  { value: 'Raycast/1.98.0', title: 'Raycast' },
  { value: 'Chatbox/1.9.0', title: 'Chatbox' },
  { value: 'Zed/0.192.0', title: 'Zed' },
];

// ---- Small presentational helpers (card-dashboard recipe) ----

/**
 * One form field: label above the control, hint below. Pure (no hooks), so
 * it may be called directly — control elements must be pre-created by the
 * caller with React.createElement.
 */
function Field(label: string, hint: string | undefined, control: ReactTypes.ReactNode, wide = false): ReactTypes.ReactElement {
  return React.createElement('div', { className: wide ? 'phub-field phub-wide' : 'phub-field' },
    React.createElement('span', { className: 'phub-label' }, label),
    control,
    hint === undefined ? null : React.createElement('span', { className: 'phub-hint' }, hint),
  );
}

/** Section head inside the editor card: title + hint left, actions right. */
function SectionHead(title: string, hint: string, actions?: ReactTypes.ReactNode): ReactTypes.ReactElement {
  return React.createElement('div', { className: 'phub-sectionHead' },
    React.createElement('div', { className: 'phub-sectionHeadText' },
      React.createElement('span', { className: 'phub-subhead-title' }, title),
      React.createElement('span', { className: 'phub-subhead-hint' }, hint),
    ),
    actions === undefined ? null : React.createElement('div', { className: 'phub-actions' }, actions),
  );
}

/** Connection-test banner: green ok (endpoint/latency/sample ids) or red error. */
function TestBanner(props: { test: TestResult; t: Translate }): ReactTypes.ReactElement {
  const { test, t } = props;
  const models = test.models ?? [];
  return React.createElement('div', { className: `phub-test-result ${test.ok ? 'phub-test-ok' : 'phub-test-err'}` },
    React.createElement('span', null, test.ok
      ? `✓ ${t('testOk')} · ${String(test.latencyMs ?? 0)}ms · ${String(test.modelCount ?? 0)} ${t('testModels')}${models.length > 0 ? ` · ${t('testSeeded')}` : ''}`
      : `✕ ${t('testFailed')}`),
    React.createElement('span', { className: 'phub-test-detail' },
      test.ok
        ? `GET ${String(test.endpoint ?? '')}${models.length > 0
            ? ` → ${models.slice(0, 3).map((m) => m.id).join(', ')}${models.length > 3 ? ' …' : ''}`
            : ''}`
        : String(test.error ?? '')),
  );
}

interface SelectMenuOption {
  value: string;
  title: string;
}

/**
 * DSH-style dropdown: a closed anchor button (like an input) + the platform
 * `Menu` primitive (dark-theme list, check mark on the selected item, portal
 * positioning). Replaces native <select>, whose chrome clashes with the DSH
 * settings theme. MUST be created via React.createElement — it holds hooks
 * (useState); a direct call would attach them to the parent fiber and crash
 * React's hook order.
 */
function SelectMenu(props: {
  label: string;
  value: string;
  options: SelectMenuOption[];
  onChange: (next: string) => void;
  disabled?: boolean;
  /** Slim anchor for inline use beside an input (e.g. UA presets). */
  compact?: boolean;
  /** Full-width anchor for form fields. */
  block?: boolean;
  /** Anchor text when no option is selected (defaults to "—"). */
  placeholder?: string;
}): ReactTypes.ReactElement {
  const [open, setOpen] = React.useState(false);
  const selected = props.options.find((o) => o.value === props.value);
  const cls = ['phub-select-anchor'];
  if (props.compact === true) cls.push('phub-select-compact');
  if (props.block === true) cls.push('phub-select-anchor-block');
  const anchor = React.createElement('button', {
    type: 'button',
    className: cls.join(' '),
    disabled: props.disabled === true,
    'aria-haspopup': 'listbox',
    'aria-expanded': open,
    'aria-label': props.label,
    onClick: () => setOpen((now) => !now),
  },
    React.createElement('span', { className: 'phub-select-anchor-text' },
      selected?.title ?? props.placeholder ?? (props.value.length > 0 ? props.value : '—')),
    React.createElement(IconChevronDownOutline14, { size: 12 }),
  );
  return React.createElement(Menu, {
    open,
    anchor,
    items: props.options.map((o) => ({ id: o.value, label: o.title })),
    selectedId: props.value,
    onSelect: (id: string) => {
      props.onChange(id);
      setOpen(false);
    },
    onClose: () => setOpen(false),
    portal: true,
  });
}

export function ProviderHubPage(props: PageProps): React.ReactElement {
  const { t, call } = props;
  const [state, setState] = React.useState<State>({ gateways: [], catalog: {}, selected: null });
  const [status, setStatus] = React.useState<Status>(null);
  const [busy, setBusy] = React.useState(false);
  const [tab, setTab] = React.useState<'providers' | 'catalog'>('providers');
  // Per-gateway editor drafts (see EditorDraft). Rebuilt from saved config on
  // every refresh / gateway add; row edits mutate only the open index.
  const [drafts, setDrafts] = React.useState<Record<number, EditorDraft>>({});
  const [discovered, setDiscovered] = React.useState<Record<number, DiscoveredModel[] | null>>({});
  // Per-gateway probe state: which gateway is being tested / fetched (null = none).
  const [testing, setTesting] = React.useState<number | null>(null);
  const [discovering, setDiscovering] = React.useState<number | null>(null);
  const [testResult, setTestResult] = React.useState<Record<number, TestResult | null>>({});
  // Key reveal state follows the provider identity rather than its array
  // index. Indexes are reused after deletion, which could otherwise reveal a
  // different provider's key when the list shifts.
  const [showKey, setShowKey] = React.useState<Record<string, boolean>>({});
  // Model-id autocomplete: which row's id input shows the catalog suggestion
  // dropdown, and the keyboard-highlighted match (-1 = none). Only the
  // focused row's dropdown can be open at a time.
  const [ac, setAc] = React.useState<{ row: number; highlight: number } | null>(null);

  const refresh = React.useCallback(async () => {
    try {
      const r = await call('get-state');
      if (!r.ok) {
        setStatus({ kind: 'err', text: String((r as { error?: unknown }).error ?? 'getState failed') });
        return;
      }
      const value = r as unknown as { gateways: GatewayEntry[]; catalog: State['catalog'] };
      setState((s) => ({ ...s, gateways: value.gateways, catalog: value.catalog }));
      const nextDrafts: Record<number, EditorDraft> = {};
      for (const g of value.gateways) nextDrafts[g.index] = buildEditorDraft(g.gateway);
      setDrafts(nextDrafts);
    } catch {
      // Remote may not be ready yet (or a transient call failure): show a
      // hint instead of crashing the renderer.
      setStatus({ kind: 'err', text: t('remotePending') });
    }
  }, [call, t]);

  React.useEffect(() => { void refresh(); }, [refresh]);

  /** Mutate the open gateway's draft. */
  const updateDraft = (index: number, next: (draft: EditorDraft) => EditorDraft) => {
    setDrafts((d) => (d[index] === undefined ? d : { ...d, [index]: next(d[index]) }));
  };

  const save = async (): Promise<boolean> => {
    setBusy(true);
    try {
      const selected = state.selected;
      if (selected === null) return false;
      const entry = state.gateways.find((g) => g.index === selected);
      if (entry === undefined) return false;
      const draft = drafts[selected];
      const modelRows = draft?.modelRows ?? [];
      // ---- client-side validation before any write ----
      const ids = modelRows.map((row) => row.id.trim());
      if (ids.some((id) => id === '')) {
        setStatus({ kind: 'err', text: t('modelIdRequired') });
        return false;
      }
      if (new Set(ids).size !== ids.length) {
        setStatus({ kind: 'err', text: t('modelIdDuplicate') });
        return false;
      }
      const params = draft?.params ?? {};
      if (draft !== undefined && !draft.paramsValid) {
        setStatus({ kind: 'err', text: t('jsonInvalid') });
        return false;
      }
      const extraHeaders: Record<string, string> = {};
      for (const row of draft?.headersRows ?? []) {
        const name = row.name.trim();
        if (name === '' && row.value.trim() === '') continue; // fully empty row
        if (name === '') {
          setStatus({ kind: 'err', text: t('headerNameRequired') });
          return false;
        }
        extraHeaders[name] = row.value;
      }
      const cfg = entry.gateway;
      const patch: Record<string, unknown> = {
        provider: cfg.provider,
        displayName: cfg.displayName,
        baseURL: cfg.baseURL,
        api: cfg.api,
        endpointMode: cfg.endpointMode ?? 'auto',
        endpoint: cfg.endpoint ?? '',
        userAgent: cfg.userAgent,
        apiKey: cfg.apiKey,
        apiKeyEnv: cfg.apiKeyEnv,
        systemRole: cfg.systemRole,
        extraHeaders,
      };
      const r = await call('save-config', { index: selected, patch });
      if (!r.ok) {
        setStatus({ kind: 'err', text: `${t('saveFailed')}: ${String((r as { error?: unknown }).error ?? '')}` });
        return false;
      }
      const rm = await call('save-models', {
        index: selected,
        models: modelRows.map((row) => ({ id: row.id.trim(), name: row.name.trim() })),
        params,
      });
      if (!rm.ok) {
        setStatus({ kind: 'err', text: `${t('saveFailed')}: ${String((rm as { error?: unknown }).error ?? '')}` });
        return false;
      }
      // Saving is intentionally silent on this page; errors remain visible.
      setStatus(null);
      void refresh();
      return true;
    } finally {
      setBusy(false);
    }
  };

  const setField = (key: string, value: unknown) => {
    const selected = state.selected;
    if (selected === null) return;
    setState((s) => ({
      ...s,
      gateways: s.gateways.map((g) => (g.index === selected ? { ...g, gateway: { ...g.gateway, [key]: value } } : g)),
    }));
    // Any edit invalidates the last connection test (it probed other values).
    setTestResult((tr) => (tr[selected] === undefined || tr[selected] === null ? tr : { ...tr, [selected]: null }));
  };

  /** Clear the connection-test banner for the selected gateway. */
  const clearTestResult = () => {
    const selected = state.selected;
    if (selected === null) return;
    setTestResult((tr) => (tr[selected] === undefined || tr[selected] === null ? tr : { ...tr, [selected]: null }));
  };

  /** Forget one gateway's test banner (deletion / fresh add on the same index). */
  const forgetTestResult = (index: number) => {
    setTestResult((tr) => {
      if (tr[index] === undefined || tr[index] === null) return tr;
      const next = { ...tr };
      delete next[index];
      return next;
    });
  };

  /**
   * Current form values as a gateway draft for connection probing (the editor
   * Test button uses it, so UNSAVED edits are reflected immediately).
   */
  const buildDraft = (): Record<string, unknown> | null => {
    const selected = state.selected;
    if (selected === null) return null;
    const entry = state.gateways.find((g) => g.index === selected);
    if (entry === undefined) return null;
    const cfg = entry.gateway;
    const extraHeaders: Record<string, string> = {};
    for (const row of drafts[selected]?.headersRows ?? []) {
      const name = row.name.trim();
      if (name === '') continue;
      extraHeaders[name] = row.value;
    }
    return {
      provider: cfg.provider,
      displayName: cfg.displayName,
      baseURL: cfg.baseURL,
      api: cfg.api,
      endpointMode: cfg.endpointMode ?? 'auto',
      endpoint: cfg.endpoint ?? '',
      userAgent: cfg.userAgent,
      apiKey: cfg.apiKey,
      apiKeyEnv: cfg.apiKeyEnv,
      extraHeaders,
    };
  };

  /** Saved-config draft for a card-level probe (no editor open). */
  const buildSavedDraft = (index: number): Record<string, unknown> | null => {
    const entry = state.gateways.find((g) => g.index === index);
    if (entry === undefined) return null;
    const cfg = entry.gateway;
    return {
      provider: cfg.provider,
      displayName: cfg.displayName,
      baseURL: cfg.baseURL,
      api: cfg.api,
      endpointMode: cfg.endpointMode ?? 'auto',
      endpoint: cfg.endpoint ?? '',
      userAgent: cfg.userAgent,
      apiKey: cfg.apiKey,
      apiKeyEnv: cfg.apiKeyEnv,
      extraHeaders: (cfg.extraHeaders as Record<string, unknown> | undefined) ?? {},
    };
  };

  /** Adopt a test-connection envelope: banner + (on success) seed the fetch list. */
  const applyTestResult = (index: number, r: Record<string, unknown> & { ok: boolean }): void => {
    if (!r.ok) {
      setTestResult((tr) => ({ ...tr, [index]: { ok: false, error: String((r as { error?: unknown }).error ?? '') } }));
      return;
    }
    const res = r as unknown as { endpoint: string; latencyMs: number; modelCount: number; models?: DiscoveredModel[] };
    const models = Array.isArray(res.models) ? res.models : [];
    setTestResult((tr) => ({ ...tr, [index]: { ok: true, endpoint: res.endpoint, latencyMs: res.latencyMs, modelCount: res.modelCount, models } }));
    // The probe already fetched the listing: reuse it so models can be
    // enabled without a second round-trip.
    setDiscovered((d) => ({ ...d, [index]: models }));
  };

  /** Probe GET {baseURL}/models with the CURRENT editor form values (no save needed). */
  const runTest = () => {
    const selected = state.selected;
    if (selected === null) return;
    const draft = buildDraft();
    if (draft === null) return;
    void (async () => {
      setTesting(selected);
      try {
        const r = await call('test-connection', { index: selected, draft });
        applyTestResult(selected, r);
      } finally {
        setTesting((current) => (current === selected ? null : current));
      }
    })();
  };

  /** Probe a card straight from its SAVED config (editor may be closed). */
  const runCardTest = (index: number) => {
    const draft = buildSavedDraft(index);
    if (draft === null) return;
    void (async () => {
      setTesting(index);
      try {
        const r = await call('test-connection', { index, draft });
        applyTestResult(index, r);
      } finally {
        setTesting((current) => (current === index ? null : current));
      }
    })();
  };

  const addGateway = () => {
    void (async () => {
      setBusy(true);
      try {
        const r = await call('add-gateway', {});
        if (!r.ok) setStatus({ kind: 'err', text: String((r as { error?: unknown }).error ?? '') });
        else {
          const result = r as unknown as { index: number; gateway?: unknown };
          const index = result.index;
          const gateway = result.gateway;
          forgetTestResult(index);
          setTab('providers');
          // addGateway returns the complete freshly-created config. Insert it
          // directly instead of waiting for a second get-state round-trip;
          // that round-trip was the visible delay after clicking Add.
          if (gateway !== null && typeof gateway === 'object' && !Array.isArray(gateway)) {
            const entry: GatewayEntry = { index, gateway: gateway as Record<string, unknown>, models: [] };
            setState((s) => ({
              ...s,
              gateways: s.gateways.some((g) => g.index === index)
                ? s.gateways.map((g) => (g.index === index ? entry : g))
                : [...s.gateways, entry],
              selected: index,
            }));
            setDrafts((d) => ({ ...d, [index]: buildEditorDraft(entry.gateway) }));
          } else {
            // Defensive fallback for older hosts that do not return the entry.
            setState((s) => ({ ...s, selected: index }));
            void refresh();
          }
          setStatus(null);
        }
      } finally {
        setBusy(false);
      }
    })();
  };

  const deleteGateway = (index: number) => {
    void (async () => {
      const r = await call('delete-gateway', { index });
      if (!r.ok) setStatus({ kind: 'err', text: String((r as { error?: unknown }).error ?? '') });
      else {
        setStatus(null);
        // A deleted provider may be added again later with the same id; never
        // carry a prior reveal choice or stale test banner into that new
        // credential.
        setShowKey({});
        forgetTestResult(index);
        void refresh();
        setState((s) => ({ ...s, selected: s.selected === index ? null : s.selected }));
      }
    })();
  };

  /**
   * Fetch the upstream model listing with the CURRENT form values (the same
   * draft the Test button probes — unsaved URL/key edits are included), then
   * offer it in the picker for one-click row adds.
   */
  const runFetchModels = () => {
    const selected = state.selected;
    if (selected === null) return;
    const draft = buildDraft();
    if (draft === null) return;
    void (async () => {
      setDiscovering(selected);
      setDiscovered((d) => ({ ...d, [selected]: null }));
      try {
        const r = await call('test-connection', { index: selected, draft });
        if (!r.ok) {
          setStatus({ kind: 'err', text: String((r as { error?: unknown }).error ?? '') });
          return;
        }
        const modelsRaw = (r as { models?: unknown }).models;
        const models = Array.isArray(modelsRaw) ? modelsRaw as DiscoveredModel[] : [];
        setDiscovered((d) => ({ ...d, [selected]: models }));
        setStatus({ kind: 'ok', text: `${models.length} ${t('testModels')}` });
      } finally {
        setDiscovering((current) => (current === selected ? null : current));
      }
    })();
  };

  // ---- Draft row operations (list ⇄ config-JSON sync) ----

  /**
   * Full params group for one catalog preset: every user-tweakable field is
   * written out explicitly (capacity + modalities + reasoningEfforts), so the
   * config JSON shows the complete capability set and each field can be
   * edited directly. The catalog's `reasoning` map uses the same
   * level→wireSpelling shape as the JSON's `reasoningEfforts`. Seeding from
   * this happens ONLY on an explicit pick (dropdown click / arrows + Enter /
   * fetched-list pick) — hand-typing an id, even a complete catalog id,
   * never seeds preset values.
   */
  const catalogSeedGroup = (id: string): Record<string, unknown> | null => {
    const preset = state.catalog[id];
    if (preset === undefined) return null;
    const group: Record<string, unknown> = {
      contextWindow: preset.contextWindow,
      maxTokens: preset.maxTokens,
    };
    if (Array.isArray(preset.input) && preset.input.length > 0) group.input = [...preset.input];
    if (preset.reasoning !== undefined && preset.reasoning !== null && typeof preset.reasoning === 'object') {
      const efforts: Record<string, string | null> = {};
      let hasLevel = false;
      for (const [level, wire] of Object.entries(preset.reasoning)) {
        efforts[level] = wire === undefined || wire === null ? null : wire;
        hasLevel = true;
      }
      if (hasLevel) group.reasoningEfforts = efforts;
    }
    return group;
  };

  /**
   * Seed one params group: discovery payload first (real gateway capacities
   * win over catalog presets), catalog preset second — the preset now carries
   * the full explicit field set (input + reasoningEfforts), not just capacity.
   */
  const seedGroup = (model: DiscoveredModel): Record<string, unknown> | null => {
    if (posInt(model.contextWindow) || posInt(model.maxTokens)) {
      const seed: Record<string, unknown> = {};
      if (posInt(model.contextWindow)) seed.contextWindow = model.contextWindow;
      if (posInt(model.maxTokens)) seed.maxTokens = model.maxTokens;
      // A discovery payload discloses only capacity (id/name/context/max);
      // keep the rest explicit from the catalog so the group stays complete.
      const presetGroup = catalogSeedGroup(model.id);
      if (presetGroup !== null) {
        for (const [key, value] of Object.entries(presetGroup)) {
          if (seed[key] === undefined) seed[key] = value;
        }
      }
      return Object.keys(seed).length > 0 ? seed : null;
    }
    return catalogSeedGroup(model.id);
  };

  /**
   * Model-list edits are refused while the config-JSON text does not parse:
   * the JSON is a co-equal editing surface, and applying a row edit against
   * the stale last-valid object would clobber the user's in-flight text.
   * The refusal flashes an explanation; the user fixes the JSON first.
   */
  const jsonLocked = (): boolean => {
    const selected = state.selected;
    if (selected === null) return false;
    const draft = drafts[selected];
    if (draft !== undefined && !draft.paramsValid) {
      setStatus({ kind: 'err', text: t('fixJsonFirst') });
      return true;
    }
    return false;
  };

  /** Pick from the fetched listing → add a row immediately (+ seeded params). */
  const addFetchedRow = (model: DiscoveredModel) => {
    const selected = state.selected;
    if (selected === null) return;
    setAc(null);
    if (jsonLocked()) return;
    if ((drafts[selected]?.modelRows ?? []).some((row) => row.id === model.id)) {
      setStatus({ kind: 'err', text: `${model.id} ${t('alreadyInList')}` });
      return;
    }
    updateDraft(selected, (cur) => {
      if (cur.modelRows.some((row) => row.id === model.id)) return cur;
      const name = model.name !== undefined && model.name !== '' && model.name !== model.id ? model.name : '';
      const params = { ...cur.params };
      if (params[model.id] === undefined) {
        // An explicit pick (this is one): seed real values where known —
        // discovery capacities first, catalog preset second — and keep the
        // complete framework visible for everything else.
        params[model.id] = frameworkGroup(seedGroup(model), name !== '' ? name : null);
      }
      return {
        ...cur,
        modelRows: [...cur.modelRows, { id: model.id, name }],
        params,
        paramsText: JSON.stringify(params, null, 2),
        paramsValid: true,
      };
    });
  };

  /** Add an empty model row for hand-typing an id. */
  const addModelRow = () => {
    const selected = state.selected;
    if (selected === null) return;
    setAc(null);
    updateDraft(selected, (cur) => ({ ...cur, modelRows: [...cur.modelRows, { id: '', name: '' }] }));
  };

  /** Remove one model row and its config-JSON group. */
  const removeModelRow = (rowIndex: number) => {
    const selected = state.selected;
    if (selected === null) return;
    setAc(null);
    if (jsonLocked()) return;
    updateDraft(selected, (cur) => {
      const row = cur.modelRows[rowIndex];
      const params = { ...cur.params };
      const key = row?.id.trim() ?? '';
      if (key !== '') delete params[key];
      return {
        ...cur,
        modelRows: cur.modelRows.filter((_, i) => i !== rowIndex),
        params,
        paramsText: JSON.stringify(params, null, 2),
        paramsValid: true,
      };
    });
  };

  /**
   * Row id edit (hand typing): move the row's params group to the new id.
   * A fresh id reserves the all-null parameter framework — preset values are
   * NEVER auto-filled by typing, not even on an exact catalog-id match. The
   * dropdown's explicit pick (pickCatalogModel) is the only typing-adjacent
   * path that writes preset parameters. Group keys are the TRIMMED id, so a
   * stray trailing space never forks the group away from its row.
   */
  const setModelRowId = (rowIndex: number, nextId: string) => {
    const selected = state.selected;
    if (selected === null) return;
    if (jsonLocked()) return;
    updateDraft(selected, (cur) => {
      const row = cur.modelRows[rowIndex];
      if (row === undefined) return cur;
      const oldKey = row.id.trim();
      const nextKey = nextId.trim();
      const modelRows = cur.modelRows.map((r, i) => (i === rowIndex ? { ...r, id: nextId } : r));
      if (oldKey === nextKey) {
        // same key after trim (e.g. a trailing space): keep params and the
        // user's textarea text untouched.
        return { ...cur, modelRows };
      }
      const params = { ...cur.params };
      const oldGroup = oldKey === '' ? undefined : params[oldKey];
      if (oldKey !== '') delete params[oldKey];
      if (nextKey !== '' && params[nextKey] === undefined) {
        // fresh key: a rename carries the old group's fields; a brand-new id
        // reserves the complete framework with every field explicitly null
        // (fill in by hand, or pick the preset from the dropdown).
        const moved = oldGroup !== null && typeof oldGroup === 'object' && !Array.isArray(oldGroup) ? oldGroup : undefined;
        params[nextKey] = frameworkGroup(moved, row.name.trim() !== '' ? row.name : null);
      }
      // nextKey already present (another row's group): that group stays —
      // duplicate ids are refused at save time with a clear error.
      return { ...cur, modelRows, params, paramsText: JSON.stringify(params, null, 2), paramsValid: true };
    });
  };

  /**
   * Row display-name edit: the name lives in the group's `name` field so the
   * config JSON stays the single source of truth (a JSON rebuild reads it
   * back); an empty name clears the field to null. Pending rows (no id yet)
   * hold the name in the row until their id materializes the group.
   */
  const setModelRowName = (rowIndex: number, nextName: string) => {
    const selected = state.selected;
    if (selected === null) return;
    if (jsonLocked()) return;
    updateDraft(selected, (cur) => {
      const row = cur.modelRows[rowIndex];
      if (row === undefined) return cur;
      const modelRows = cur.modelRows.map((r, i) => (i === rowIndex ? { ...r, name: nextName } : r));
      const key = row.id.trim();
      if (key === '' || cur.params[key] === undefined) return { ...cur, modelRows };
      const params = { ...cur.params, [key]: { ...cur.params[key], name: nextName.trim() !== '' ? nextName : null } };
      return { ...cur, modelRows, params, paramsText: JSON.stringify(params, null, 2), paramsValid: true };
    });
  };

  /**
   * EXPLICIT catalog pick from the model-id suggestion dropdown (click, or
   * ArrowUp/Down + Enter): the ONE typing-adjacent action that applies
   * preset parameters. Replaces the row's group with the full catalog preset
   * (complete framework, real values) and fills the display name from the
   * preset when the row's name is empty. Picking an id another row already
   * owns is refused (the duplicate would be rejected at save time anyway).
   */
  const pickCatalogModel = (rowIndex: number, id: string) => {
    const selected = state.selected;
    if (selected === null) return;
    setAc(null);
    if (jsonLocked()) return;
    const draft = drafts[selected];
    const preset = state.catalog[id];
    if (draft === undefined || preset === undefined) return;
    if (draft.modelRows.some((row, i) => i !== rowIndex && row.id.trim() === id)) {
      setStatus({ kind: 'err', text: `${id} ${t('alreadyInList')}` });
      return;
    }
    updateDraft(selected, (cur) => {
      const row = cur.modelRows[rowIndex];
      if (row === undefined) return cur;
      const params = { ...cur.params };
      const oldKey = row.id.trim();
      if (oldKey !== '' && oldKey !== id) delete params[oldKey];
      const nextName = row.name.trim() !== '' ? row.name : (preset.name !== '' && preset.name !== id ? preset.name : '');
      params[id] = frameworkGroup(catalogSeedGroup(id), nextName !== '' ? nextName : null);
      const modelRows = cur.modelRows.map((r, i) => (i === rowIndex ? { ...r, id, name: nextName } : r));
      return { ...cur, modelRows, params, paramsText: JSON.stringify(params, null, 2), paramsValid: true };
    });
  };

  const addHeaderRow = () => {
    const selected = state.selected;
    if (selected === null) return;
    updateDraft(selected, (cur) => ({ ...cur, headersRows: [...cur.headersRows, { name: '', value: '' }] }));
  };

  const removeHeaderRow = (rowIndex: number) => {
    const selected = state.selected;
    if (selected === null) return;
    updateDraft(selected, (cur) => ({
      ...cur,
      headersRows: cur.headersRows.filter((_, i) => i !== rowIndex),
    }));
  };

  const setHeaderRow = (rowIndex: number, key: 'name' | 'value', value: string) => {
    const selected = state.selected;
    if (selected === null) return;
    updateDraft(selected, (cur) => ({
      ...cur,
      headersRows: cur.headersRows.map((row, i) => (i === rowIndex ? { ...row, [key]: value } : row)),
    }));
    // Headers feed the connection probe: any edit invalidates its banner.
    clearTestResult();
  };

  /**
   * Config-JSON textarea edit: a VALID object text becomes the params object
   * AND the model list is reconciled from its group keys — hand-writing a
   * group adds the model (its `name` field is the display name), deleting a
   * group removes it, so the JSON alone is a complete editing surface and
   * the model list can be skipped entirely. Pending (empty-id) rows survive
   * until their id is typed. While the text is invalid, the last parsed
   * object stays authoritative and model-list edits are refused (see
   * jsonLocked) so this in-flight text is never clobbered.
   */
  const setParamsText = (text: string) => {
    const selected = state.selected;
    if (selected === null) return;
    updateDraft(selected, (cur) => {
      try {
        const parsed: unknown = JSON.parse(text);
        if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) {
          const params = parsed as Record<string, Record<string, unknown>>;
          const modelRows: ModelRow[] = [];
          const seen = new Set<string>();
          for (const key of Object.keys(params)) {
            if (key === '' || seen.has(key)) continue;
            seen.add(key);
            const group = params[key];
            const rawName = group !== null && typeof group === 'object' && !Array.isArray(group)
              ? (group as Record<string, unknown>).name
              : undefined;
            // The group's name wins (the user just edited it here); a group
            // with NO name key keeps the row's current display name, null
            // or whitespace explicitly clears it.
            const prev = cur.modelRows.find((r) => r.id === key);
            const name = rawName === undefined
              ? (prev?.name ?? '')
              : (typeof rawName === 'string' && rawName.trim() !== '' ? rawName : '');
            modelRows.push({ id: key, name });
          }
          for (const row of cur.modelRows) {
            if (row.id === '') modelRows.push(row); // pending rows stay until their id is typed
          }
          return { ...cur, params, modelRows, paramsText: text, paramsValid: true };
        }
      } catch {
        // partial/invalid JSON: keep the text, block save until it parses
      }
      return { ...cur, paramsText: text, paramsValid: false };
    });
  };

  // ---- Derived render data ----

  const selected = state.selected;
  const selectedEntry = state.gateways.find((g) => g.index === selected);
  const cfg = selectedEntry?.gateway ?? {};
  const providerKey = String(cfg.provider ?? '');
  const draft = selected === null ? undefined : drafts[selected];
  const catalogIds = Object.keys(state.catalog);
  const totalModels = state.gateways.reduce((sum, g) => sum + (g.models?.length ?? 0), 0);
  const statusFlash = status === null ? null
    : React.createElement('div', { className: `phub-statusFlash phub-statusFlash-${status.kind}` }, status.text);
  // The fetched (or test-probed) model listing, when one exists.
  const fetchedList = selected === null ? undefined : discovered[selected];
  // Model ids already in the open editor's rows (marks fetched / dropdown
  // options as taken). Trimmed: group keys and save-time ids are trimmed.
  const listedIds = new Set((draft?.modelRows ?? []).map((row) => row.id.trim()).filter((id) => id !== ''));

  /** One provider card for the grid. */
  const gatewayCard = (g: GatewayEntry): ReactTypes.ReactElement => {
    const name = String(g.gateway.displayName ?? g.gateway.provider ?? '');
    const provider = String(g.gateway.provider ?? '');
    const api = String(g.gateway.api ?? '');
    const base = String(g.gateway.baseURL ?? '');
    const models = g.models ?? [];
    const endpointMode = String(g.gateway.endpointMode ?? 'auto');
    const apiKeyEnv = String(g.gateway.apiKeyEnv ?? '');
    const configured = g.gateway.apiKeyConfigured === true;
    const tr = testResult[g.index] ?? null;
    return React.createElement('article', { key: g.index, className: 'phub-card' },
      React.createElement('div', { className: 'phub-cardHead' },
        React.createElement('div', { className: 'phub-cardName' }, name),
        React.createElement(Pill, { active: configured }, configured ? t('badgeConfigured') : t('badgeNoKey')),
      ),
      React.createElement('div', { className: 'phub-meta' },
        base === '' ? `${provider} · ${api}` : `${provider} · ${api} · ${base}`),
      models.length > 0
        ? React.createElement('div', { className: 'phub-models' },
          models.slice(0, 5).map((m) => React.createElement('span', { key: String(m.id), className: 'phub-chip' }, String(m.name ?? m.id))),
          models.length > 5 ? React.createElement('span', { className: 'phub-chip' }, `+${models.length - 5}`) : null,
        )
        : null,
      React.createElement('div', { className: 'phub-cardFoot' },
        `${models.length} ${t('unitModels')} · ${endpointMode === 'custom' ? t('modeCustom') : t('modeAuto')} · ${apiKeyEnv !== '' ? apiKeyEnv : t('keyInline')}`),
      // The editor shows the banner for its own gateway; the card shows it otherwise.
      tr !== null && selected !== g.index ? TestBanner({ test: tr, t }) : null,
      React.createElement('div', { className: 'phub-rowActions' },
        React.createElement(Button, {
          variant: 'ghost', size: 'sm', disabled: testing !== null,
          icon: testing === g.index ? React.createElement(IconLoadingOutline16, { size: 14, className: 'phub-spin' }) : undefined,
          onClick: () => runCardTest(g.index),
        }, testing === g.index ? t('testing') : t('testConnection')),
        React.createElement(Button, {
          variant: 'ghost', size: 'sm',
          onClick: () => setState((s) => ({ ...s, selected: s.selected === g.index ? null : g.index })),
        }, t('edit')),
        React.createElement(Button, {
          variant: 'ghost', size: 'sm', className: 'phub-danger', 'aria-label': t('delete'), title: t('delete'),
          icon: React.createElement(IconTrashOutline16, { size: 14 }),
          onClick: () => deleteGateway(g.index),
        }),
      ),
    );
  };

  /** Editor field bound to one gateway config key. */
  const fieldInput = (key: string, label: string, hint?: string, placeholder?: string, wide = false) => {
    return Field(label, hint, React.createElement('input', {
      className: 'phub-input',
      value: String(cfg[key] ?? ''),
      placeholder,
      spellCheck: false,
      onChange: (e: ReactTypes.ChangeEvent<HTMLInputElement>) => setField(key, e.target.value),
    }), wide);
  };

  /** A request-header row: name + value inputs + trash (cc-switch recipe). */
  const headerRow = (row: HeadersRow, rowIndex: number): ReactTypes.ReactElement => {
    return React.createElement('div', { key: rowIndex, className: 'phub-kvGrid phub-kvHeaders' },
      React.createElement('input', {
        className: 'phub-input',
        value: row.name,
        placeholder: t('headerName'),
        spellCheck: false,
        onChange: (e: ReactTypes.ChangeEvent<HTMLInputElement>) => setHeaderRow(rowIndex, 'name', e.target.value),
      }),
      React.createElement('input', {
        className: 'phub-input phub-kvValue',
        value: row.value,
        placeholder: t('headerValue'),
        spellCheck: false,
        onChange: (e: ReactTypes.ChangeEvent<HTMLInputElement>) => setHeaderRow(rowIndex, 'value', e.target.value),
      }),
      React.createElement(Button, {
        variant: 'ghost', size: 'sm', className: 'phub-danger', 'aria-label': t('remove'), title: t('remove'),
        icon: React.createElement(IconTrashOutline16, { size: 14 }),
        onClick: () => removeHeaderRow(rowIndex),
      }),
    );
  };

  /**
   * A model row: id + display name + trash (the brief list; params → JSON).
   * The id input carries the catalog suggestion dropdown: open while THIS
   * row's input is active and holds a non-empty value. Clicking a suggestion
   * (or ArrowUp/Down + Enter) applies the preset parameters; plain typing —
   * even a complete catalog id — never does. Item mousedown is prevented so
   * the click never blurs the input first.
   */
  const modelRow = (row: ModelRow, rowIndex: number): ReactTypes.ReactElement => {
    const matches = suggestMatches(row.id, state.catalog);
    const open = ac !== null && ac.row === rowIndex && row.id.trim() !== '';
    const highlight = open ? ac.highlight : -1;
    const listId = `phub-ac-list-${rowIndex}`;
    return React.createElement('div', { key: rowIndex, className: 'phub-kvGrid phub-kvModels' },
      React.createElement('div', { className: 'phub-acWrap' },
        React.createElement('input', {
          className: 'phub-input',
          value: row.id,
          placeholder: t('modelId'),
          spellCheck: false,
          autoComplete: 'off',
          role: 'combobox',
          'aria-expanded': open,
          'aria-autocomplete': 'list',
          'aria-controls': listId,
          onChange: (e: ReactTypes.ChangeEvent<HTMLInputElement>) => {
            setModelRowId(rowIndex, e.target.value);
            setAc({ row: rowIndex, highlight: -1 });
          },
          onFocus: () => setAc({ row: rowIndex, highlight: -1 }),
          onBlur: () => setAc(null),
          onKeyDown: (e: ReactTypes.KeyboardEvent<HTMLInputElement>) => {
            if (!open) return;
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setAc({ row: rowIndex, highlight: Math.min(highlight + 1, matches.length - 1) });
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setAc({ row: rowIndex, highlight: Math.max(highlight - 1, -1) });
            } else if (e.key === 'Enter') {
              // Enter only picks when a match is deliberately highlighted;
              // with no highlight it just closes the dropdown (a typed id
              // stays un-seeded).
              e.preventDefault();
              if (highlight >= 0 && matches[highlight] !== undefined) pickCatalogModel(rowIndex, matches[highlight]);
              else setAc(null);
            } else if (e.key === 'Escape') {
              e.preventDefault();
              setAc(null);
            }
          },
        }),
        open
          ? React.createElement('div', { className: 'phub-acList', id: listId, role: 'listbox' },
            matches.length === 0
              ? React.createElement('div', { className: 'phub-acEmpty' }, t('noPresetMatch'))
              : matches.map((id, i) => {
                const preset = state.catalog[id];
                const taken = id !== row.id.trim() && listedIds.has(id);
                return React.createElement('div', {
                  key: id,
                  className: 'phub-acItem',
                  'data-active': highlight === i,
                  'data-taken': taken,
                  role: 'option',
                  'aria-selected': highlight === i,
                  onMouseDown: (e: ReactTypes.MouseEvent<HTMLDivElement>) => { e.preventDefault(); },
                  onClick: () => { pickCatalogModel(rowIndex, id); },
                },
                  React.createElement('span', { className: 'phub-acId' }, id),
                  React.createElement('span', { className: 'phub-acMeta' },
                    taken
                      ? t('alreadyInList')
                      : `${String(preset?.name ?? '')} · ${String(preset?.contextWindow ?? '—')}/${String(preset?.maxTokens ?? '—')}`),
                );
              }),
          )
          : null,
      ),
      React.createElement('input', {
        className: 'phub-input phub-kvValue',
        value: row.name,
        placeholder: t('modelName'),
        onChange: (e: ReactTypes.ChangeEvent<HTMLInputElement>) => setModelRowName(rowIndex, e.target.value),
      }),
      React.createElement(Button, {
        variant: 'ghost', size: 'sm', className: 'phub-danger', 'aria-label': t('remove'), title: t('remove'),
        icon: React.createElement(IconTrashOutline16, { size: 14 }),
        onClick: () => removeModelRow(rowIndex),
      }),
    );
  };

  const catalogSection = React.createElement(React.Fragment, null,
    React.createElement('div', { className: 'phub-sectionTitle' },
      React.createElement('div', null,
        React.createElement('h3', null, t('tabCatalog')),
        React.createElement('div', { className: 'phub-sectionHelp' }, t('sectionCatalogHint')),
      ),
    ),
    catalogIds.length === 0
      ? React.createElement('div', { className: 'phub-empty' }, t('catalogEmpty'))
      : React.createElement('div', { className: 'phub-grid' },
        catalogIds.slice().sort().map((id) => {
          const preset = state.catalog[id];
          return React.createElement('article', { key: id, className: 'phub-card' },
            React.createElement('div', { className: 'phub-cardHead' },
              React.createElement('div', { className: 'phub-cardName' }, preset?.name ?? id),
              React.createElement(Pill, { active: false }, id),
            ),
            React.createElement('div', { className: 'phub-models' },
              React.createElement('span', { className: 'phub-chip' }, `${t('contextWindow')} ${preset?.contextWindow ?? '—'}`),
              React.createElement('span', { className: 'phub-chip' }, `${t('maxTokens')} ${preset?.maxTokens ?? '—'}`),
            ),
          );
        }),
      ),
  );

  const editorSection = selected === null || selectedEntry === undefined ? null : React.createElement(React.Fragment, null,
    React.createElement('div', { className: 'phub-sectionTitle' },
      React.createElement('div', null,
        React.createElement('h3', null, `${t('gateway')} · ${String(cfg.displayName ?? cfg.provider ?? '')}`),
        React.createElement('div', { className: 'phub-sectionHelp' },
          `${String(cfg.api ?? 'anthropic-messages')} · ${String(cfg.endpointMode ?? 'auto') === 'custom' ? t('modeCustom') : t('modeAuto')}`),
      ),
      React.createElement('div', { className: 'phub-actions' },
        React.createElement(Button, {
          variant: 'ghost', size: 'sm',
          onClick: () => setState((s) => ({ ...s, selected: null })),
        }, t('collapse')),
      ),
    ),
    React.createElement('div', { className: 'phub-card phub-editorCard' },
      // ---- Basic fields ----
      React.createElement('div', { className: 'phub-form' },
        fieldInput('provider', t('providerName'), t('providerNameHint')),
        fieldInput('displayName', t('displayName')),
        // baseURL meaning depends on the endpoint mode: auto = API root
        // (/v1 auto-completed), custom = the COMPLETE model-listing URL.
        fieldInput('baseURL', `${t('baseURL')} *`,
          String(cfg.endpointMode ?? 'auto') === 'custom' ? t('baseURLHintCustom') : t('baseURLHint'),
          t('baseURLPlaceholder'), true),
        Field(t('endpointMode'), t('endpointModeHint'),
          React.createElement(SelectMenu, {
            label: t('endpointMode'),
            block: true,
            value: String(cfg.endpointMode ?? 'auto'),
            options: [
              { value: 'auto', title: t('endpointModeAuto') },
              { value: 'custom', title: t('endpointModeCustom') },
            ],
            onChange: (next) => setField('endpointMode', next),
          })),
        Field(t('api'), undefined,
          // MUST be a React element (createElement), never a direct call:
          // SelectMenu holds hooks (useState) — see its doc comment.
          React.createElement(SelectMenu, {
            label: t('api'),
            block: true,
            value: String(cfg.api ?? 'anthropic-messages'),
            options: [
              { value: 'anthropic-messages', title: 'anthropic-messages' },
              { value: 'openai-completions', title: 'openai-completions' },
              { value: 'openai-responses', title: 'openai-responses' },
            ],
            onChange: (next) => setField('api', next),
          })),
        // custom mode: the complete chat request URL of the selected protocol,
        // dialed verbatim (no path or /v1 is ever appended).
        String(cfg.endpointMode ?? 'auto') === 'custom'
          ? fieldInput('endpoint', `${t('endpoint')} *`, t('endpointHint'), t('endpointPlaceholder'), true)
          : null,
        // UA quick-picks: selecting a preset only fills the editable input.
        Field(t('userAgent'), t('userAgentHint'),
          React.createElement('div', { className: 'phub-inline' },
            React.createElement(SelectMenu, {
              label: t('userAgent'),
              compact: true,
              placeholder: t('uaPreset'),
              value: UA_PRESETS.find((p) => p.value === String(cfg.userAgent ?? ''))?.value ?? '',
              options: UA_PRESETS.map((p) => ({ value: p.value, title: p.title })),
              onChange: (next) => setField('userAgent', next),
            }),
            React.createElement('input', {
              className: 'phub-input',
              value: String(cfg.userAgent ?? ''),
              spellCheck: false,
              onChange: (e: ReactTypes.ChangeEvent<HTMLInputElement>) => setField('userAgent', e.target.value),
            }),
          ), true),
        // API key: masked by default, per-provider reveal toggle.
        Field(t('apiKey'), cfg.apiKeyConfigured === true ? t('apiKeyConfiguredHint') : t('apiKeyHint'),
          React.createElement('div', { className: 'phub-inline' },
            React.createElement('input', {
              className: 'phub-input',
              type: showKey[providerKey] === true ? 'text' : 'password',
              value: String(cfg.apiKey ?? ''),
              placeholder: cfg.apiKeyConfigured === true ? t('apiKeyConfiguredHint') : undefined,
              autoComplete: 'new-password',
              spellCheck: false,
              onChange: (e: ReactTypes.ChangeEvent<HTMLInputElement>) => setField('apiKey', e.target.value),
            }),
            React.createElement(Button, {
              variant: 'ghost', size: 'sm',
              onClick: () => setShowKey((s) => ({ ...s, [providerKey]: s[providerKey] === true ? false : true })),
            }, showKey[providerKey] === true ? t('hide') : t('show')),
          )),
        fieldInput('apiKeyEnv', t('apiKeyEnv'), t('apiKeyHint')),
      ),
      // ---- Headers: key-value rows (cc-switch recipe) ----
      React.createElement('hr', { className: 'phub-divider' }),
      SectionHead(t('headersSection'), t('headersHint'),
        React.createElement(Button, {
          variant: 'outline', size: 'sm',
          icon: React.createElement(IconPlusOutline16, { size: 13 }),
          onClick: addHeaderRow,
        }, t('addHeader'))),
      (draft?.headersRows.length ?? 0) > 0
        ? React.createElement('div', { className: 'phub-kvWrap' },
          React.createElement('div', { className: 'phub-kvHead phub-kvHeaders' },
            React.createElement('span', { className: 'phub-kvLabel' }, t('headerName')),
            React.createElement('span', { className: 'phub-kvLabel' }, t('headerValue')),
            React.createElement('span', null),
          ),
          (draft?.headersRows ?? []).map(headerRow),
        )
        : null,
      // ---- Models: the brief list (id + display name) ----
      React.createElement('hr', { className: 'phub-divider' }),
      SectionHead(t('modelSection'), t('modelRowsHint'),
        React.createElement(React.Fragment, null,
          React.createElement(Button, {
            variant: 'outline', size: 'sm',
            disabled: discovering !== null || String(cfg.baseURL ?? '').trim() === '',
            icon: discovering === selected ? React.createElement(IconLoadingOutline16, { size: 13, className: 'phub-spin' }) : React.createElement(IconRefreshOutline16, { size: 13 }),
            onClick: runFetchModels,
          }, discovering === selected ? `${t('discoverRun')}…` : t('discoverRun')),
          React.createElement(Button, {
            variant: 'outline', size: 'sm',
            icon: React.createElement(IconPlusOutline16, { size: 13 }),
            onClick: addModelRow,
          }, t('addModel')),
        )),
      // Fetched listing picker: picking a model adds its row (+ seeded params).
      fetchedList === null || fetchedList === undefined || fetchedList.length === 0 ? null
        : Field(t('fetchedModels'), undefined,
          React.createElement(SelectMenu, {
            label: t('fetchedModels'),
            block: true,
            value: '',
            placeholder: `${fetchedList.length} ${t('testModels')}`,
            options: fetchedList.map((model) => ({
              value: model.id,
              title: `${model.id}${model.contextWindow !== undefined ? ` · ${model.contextWindow}` : ''}${model.maxTokens !== undefined ? ` / ${model.maxTokens}` : ''}${listedIds.has(model.id) ? ` · ${t('alreadyInList')}` : ''}`,
            })),
            onChange: (next) => {
              const model = fetchedList.find((m) => m.id === next);
              if (model !== undefined) addFetchedRow(model);
            },
          })),
      (draft?.modelRows.length ?? 0) > 0
        ? React.createElement('div', { className: 'phub-kvWrap' },
          React.createElement('div', { className: 'phub-kvHead phub-kvModels' },
            React.createElement('span', { className: 'phub-kvLabel' }, t('modelId')),
            React.createElement('span', { className: 'phub-kvLabel' }, t('modelName')),
            React.createElement('span', null),
          ),
          (draft?.modelRows ?? []).map(modelRow),
        )
        : React.createElement('div', { className: 'phub-hint' }, t('modelsEmptyHint')),
      // ---- Config JSON: the complete per-model parameter framework,
      // synced BOTH WAYS with the list (JSON keys rebuild the rows) ----
      React.createElement('hr', { className: 'phub-divider' }),
      SectionHead(t('configJson'), t('configJsonHint')),
      React.createElement('textarea', {
        className: draft?.paramsValid === false ? 'phub-textarea phub-textarea-invalid' : 'phub-textarea',
        value: draft?.paramsText ?? '{\n}',
        spellCheck: false,
        onChange: (e: ReactTypes.ChangeEvent<HTMLTextAreaElement>) => setParamsText(e.target.value),
      }),
      // ---- Footer: the ONE save button ----
      React.createElement('div', { className: 'phub-actions' },
        React.createElement(Button, {
          variant: 'primary', size: 'sm', disabled: busy || draft?.paramsValid === false,
          onClick: () => void save(),
        }, t('save')),
        React.createElement(Button, {
          variant: 'outline', size: 'sm',
          disabled: busy || testing !== null || String(cfg.baseURL ?? '').trim() === '',
          icon: testing === selected ? React.createElement(IconLoadingOutline16, { size: 14, className: 'phub-spin' }) : undefined,
          onClick: runTest,
        }, testing === selected ? t('testing') : t('testConnection')),
        React.createElement(Button, {
          variant: 'ghost', size: 'sm',
          onClick: () => setState((s) => ({ ...s, selected: null })),
        }, t('collapse')),
      ),
      (testResult[selected] ?? null) !== null ? TestBanner({ test: testResult[selected] as TestResult, t }) : null,
    ),
  );

  const providersSection = React.createElement(React.Fragment, null,
    React.createElement('div', { className: 'phub-sectionTitle' },
      React.createElement('div', null,
        React.createElement('h3', null, t('gateways')),
        React.createElement('div', { className: 'phub-sectionHelp' }, t('sectionProvidersHint')),
      ),
    ),
    React.createElement('div', { className: 'phub-grid' },
      state.gateways.length === 0
        ? React.createElement('div', { className: 'phub-empty' },
          React.createElement('span', { className: 'phub-empty-title' }, t('emptyTitle')),
          React.createElement('span', { className: 'phub-empty-desc' }, t('emptyHint')),
        )
        : state.gateways.map(gatewayCard),
      React.createElement('button', { className: 'phub-add-card', disabled: busy, onClick: addGateway },
        `+ ${t('addGateway')}`,
      ),
    ),
    editorSection,
  );

  return React.createElement('div', { className: 'phub-page' },
    // ---- Hero: brand status card + primary actions ----
    React.createElement('div', { className: 'phub-hero' },
      React.createElement('div', { className: 'phub-heroMain' },
        React.createElement('div', { className: 'phub-heroStatus' },
          React.createElement(StateDot, { state: state.gateways.length > 0 ? 'done' : 'warning' }),
          React.createElement('h2', { className: 'phub-heroTitle' },
            state.gateways.length > 0 ? t('heroReady') : t('heroEmpty')),
        ),
        React.createElement('div', { className: 'phub-heroMeta' },
          `${state.gateways.length} ${t('unitProviders')} · ${totalModels} ${t('unitModels')} · ${catalogIds.length} ${t('unitPresets')}`),
        React.createElement('div', { className: 'phub-heroHelp' }, t('intro')),
      ),
      React.createElement('div', { className: 'phub-actions' },
        React.createElement(Button, {
          variant: 'ghost', size: 'sm', disabled: busy,
          icon: React.createElement(IconRefreshOutline16, { size: 14 }),
          onClick: () => void refresh(),
        }, t('refresh')),
        React.createElement(Button, {
          variant: 'primary', size: 'sm', disabled: busy,
          icon: React.createElement(IconPlusOutline16, { size: 14 }),
          onClick: addGateway,
        }, t('addGateway')),
      ),
    ),
    statusFlash,
    // ---- Tabs: providers / built-in catalog ----
    React.createElement('div', { className: 'phub-tabs' },
      React.createElement('button', {
        type: 'button', className: 'phub-tab', 'data-active': tab === 'providers',
        onClick: () => setTab('providers'),
      }, t('gateways'), React.createElement('span', { className: 'phub-tabCount' }, String(state.gateways.length))),
      React.createElement('button', {
        type: 'button', className: 'phub-tab', 'data-active': tab === 'catalog',
        onClick: () => setTab('catalog'),
      }, t('tabCatalog'), React.createElement('span', { className: 'phub-tabCount' }, String(catalogIds.length))),
    ),
    tab === 'catalog' ? catalogSection : providersSection,
  );
}
