/**
 * Provider Hub — settings page component (client half).
 * Environment-neutral: driven only by `t` (translate) and `call` (one host
 * RPC returning `{ ok, ... } | { ok: false, error }`).
 *
 * Layout (DSH settings design recipe — dsh-better-sidebar style): an intro
 * line, a gateway-list group card (rows with icon chip + title/desc, a dashed
 * add card), and per-gateway editor/model groups with DSH switch rows.
 * All mutations carry the gateway index.
 *
 * @module dsh-provider-hub/client/page
 */
import type * as ReactTypes from 'react';
// Real value import: the DSH client module system resolves `react` through
// its platform seed table, so the built bundle calls require("react") and
// gets the renderer's React instance (no global dependency).
import React from 'react';
import { Menu, IconChevronDownOutline14 } from '@deepseek-ai/dsh-client-ui-primitives';
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
  catalog: Record<string, { name: string; contextWindow: number; maxTokens: number }>;
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

/** In-progress edit of one enabled model: `custom` models update their entry,
 * built-in catalog ids update their per-model override. */
interface EditTarget {
  id: string;
  custom: boolean;
}

function tokenize(value: string): string[] {
  return value.toLowerCase().split(/[^a-z0-9]+/).filter((token) => token.length > 0);
}

/** Longest run of consecutive shared tokens ("claude-opus-4-5-20260101" vs
 * "claude-opus-4-8" shares [claude, opus, 4]). */
function sharedTokenRun(a: string[], b: string[]): number {
  let best = 0;
  for (let i = 0; i < a.length; i++) {
    for (let j = 0; j < b.length; j++) {
      let run = 0;
      while (i + run < a.length && j + run < b.length && a[i + run] === b[j + run]) run++;
      if (run > best) best = run;
    }
  }
  return best;
}

/**
 * Best built-in catalog hit for a model id (case-insensitive): exact match
 * first, then prefix / token-run matching so gateway spellings like
 * "deepseek-v3.2-exp" or "claude-opus-4-5-20260101" still find their preset.
 * Drives the contextual "use preset parameters" button; no hit = no button.
 */
function matchCatalog(id: string, catalog: State['catalog']): string | undefined {
  const key = id.trim().toLowerCase();
  if (key === '') return undefined;
  if (catalog[key] !== undefined) return key;
  const keyTokens = tokenize(key);
  let best: string | undefined;
  let bestScore = 0;
  for (const catId of Object.keys(catalog)) {
    const lower = catId.toLowerCase();
    let score = 0;
    // Typed id extends a catalog id ("deepseek-v3.2-exp" ⊃ "deepseek-v3").
    if (key.startsWith(lower)) score = 2 + lower.length;
    // Typed id is a meaningful prefix of a catalog id ("gpt-5" ⊂ "gpt-5.6-*").
    else if (lower.startsWith(key) && key.length >= 5) score = 1 + key.length;
    else {
      // Family match across version/date suffixes.
      const catTokens = tokenize(catId);
      const run = sharedTokenRun(keyTokens, catTokens);
      if (run >= 2 && run / catTokens.length >= 0.5) score = 1 + run;
    }
    if (score > bestScore) {
      bestScore = score;
      best = catId;
    }
  }
  return best;
}

/** Whole modelOverrides map after editing one built-in model: non-empty form
 * fields become that id's override; an all-empty edit drops it, so the
 * catalog defaults apply again. */
function overrideMapWith(entry: GatewayEntry, id: string, name: string, ctx: string, max: string): Record<string, unknown> {
  const overrides: Record<string, Record<string, unknown>> = { ...((entry.gateway.modelOverrides as Record<string, Record<string, unknown>>) ?? {}) };
  const next: Record<string, unknown> = {};
  if (name !== '') next.name = name;
  if (ctx !== '' && Number(ctx) > 0) next.contextWindow = Number(ctx);
  if (max !== '' && Number(max) > 0) next.maxTokens = Number(max);
  if (Object.keys(next).length === 0) delete overrides[id];
  else overrides[id] = next;
  return overrides;
}

// ---- Small presentational helpers (DSH settings recipe) ----

interface RowProps {
  title: ReactTypes.ReactNode;
  desc?: ReactTypes.ReactNode;
  control?: ReactTypes.ReactNode;
  selected?: boolean;
  onClick?: () => void;
  className?: string;
  key?: string | number;
}

/** One settings row: title/desc left, control right, hairline separators. */
function Row(props: RowProps): ReactTypes.ReactElement {
  const cls = ['phub-row'];
  if (props.onClick !== undefined) cls.push('phub-clickable');
  if (props.selected === true) cls.push('phub-row-selected');
  if (props.className !== undefined) cls.push(props.className);
  return React.createElement('div', { key: props.key, className: cls.join(' '), onClick: props.onClick },
    React.createElement('div', { className: 'phub-rowText' },
      React.createElement('span', { className: 'phub-rowTitle' }, props.title),
      props.desc === undefined ? null : React.createElement('span', { className: 'phub-rowDesc' }, props.desc),
    ),
    props.control === undefined ? null : React.createElement('span', { className: 'phub-control' }, props.control),
  );
}

/** DSH-style switch: hidden checkbox + 36x20 track with sliding thumb. */
function SwitchUI(props: { checked: boolean; onChange: (next: boolean) => void; disabled?: boolean }): ReactTypes.ReactElement {
  return React.createElement('label', { className: 'phub-switch' },
    React.createElement('input', {
      type: 'checkbox',
      className: 'phub-switch-input',
      checked: props.checked,
      disabled: props.disabled === true,
      onChange: (e: ReactTypes.ChangeEvent<HTMLInputElement>) => props.onChange(e.target.checked),
    }),
    React.createElement('span', { className: 'phub-switch-track' },
      React.createElement('span', { className: 'phub-switch-thumb' }),
    ),
  );
}

/** Small uppercase icon chip (first letter of the gateway display name). */
function ChipUI(props: { text: string }): ReactTypes.ReactElement {
  const ch = (props.text || '?').charAt(0);
  return React.createElement('span', { className: 'phub-icon-chip' }, ch);
}

/**
 * Sub-section heading inside a group card (12px secondary title + tertiary
 * hint): gives the models card a stable reading order — enabled / discover /
 * add / overrides — instead of one undifferentiated stack of rows.
 */
function SubHead(title: string, hint?: string): ReactTypes.ReactElement {
  return React.createElement('div', { className: 'phub-subhead' },
    React.createElement('span', { className: 'phub-subhead-title' }, title),
    hint === undefined ? null : React.createElement('span', { className: 'phub-subhead-hint' }, hint),
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
 * settings theme (the better-sidebar SelectMenu recipe).
 */
function SelectMenu(props: {
  label: string;
  value: string;
  options: SelectMenuOption[];
  onChange: (next: string) => void;
  disabled?: boolean;
}): ReactTypes.ReactElement {
  const [open, setOpen] = React.useState(false);
  const selected = props.options.find((o) => o.value === props.value);
  const anchor = React.createElement('button', {
    type: 'button',
    className: 'phub-select-anchor',
    disabled: props.disabled === true,
    'aria-haspopup': 'listbox',
    'aria-expanded': open,
    'aria-label': props.label,
    onClick: () => setOpen((now) => !now),
  },
    React.createElement('span', { className: 'phub-select-anchor-text' }, selected?.title ?? (props.value.length > 0 ? props.value : '—')),
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
  const [addModelDraft, setAddModelDraft] = React.useState<{ id: string; name: string; contextWindow: string; maxTokens: string }>(
    { id: '', name: '', contextWindow: '', maxTokens: '' });
  const [fetchedPick, setFetchedPick] = React.useState('');
  const [editing, setEditing] = React.useState<EditTarget | null>(null);
  const [overridesText, setOverridesText] = React.useState<Record<number, string>>({});
  const [headersText, setHeadersText] = React.useState<Record<number, string>>({});
  const [discovered, setDiscovered] = React.useState<Record<number, DiscoveredModel[] | null>>({});
  const [testing, setTesting] = React.useState(false);
  const [discovering, setDiscovering] = React.useState(false);
  const [testResult, setTestResult] = React.useState<Record<number, TestResult | null>>({});

  const refresh = React.useCallback(async () => {
    try {
      const r = await call('get-state');
      if (!r.ok) {
        setStatus({ kind: 'err', text: String((r as { error?: unknown }).error ?? 'getState failed') });
        return;
      }
      const value = r as unknown as { gateways: GatewayEntry[]; catalog: State['catalog'] };
      setState((s) => ({ ...s, gateways: value.gateways, catalog: value.catalog }));
      const nextOverrides: Record<number, string> = {};
      const nextHeaders: Record<number, string> = {};
      for (const g of value.gateways) {
        nextOverrides[g.index] = JSON.stringify(g.gateway.modelOverrides ?? {}, null, 2);
        nextHeaders[g.index] = JSON.stringify(g.gateway.extraHeaders ?? {}, null, 2);
      }
      setOverridesText(nextOverrides);
      setHeadersText(nextHeaders);
    } catch {
      // Remote may not be ready yet (or a transient call failure): show a
      // hint instead of crashing the renderer.
      setStatus({ kind: 'err', text: t('remotePending') });
    }
  }, [call, t]);

  React.useEffect(() => { void refresh(); }, [refresh]);

  const save = async (success = t('saved')): Promise<boolean> => {
    setBusy(true);
    try {
      const selected = state.selected;
      if (selected === null) return false;
      const entry = state.gateways.find((g) => g.index === selected);
      if (entry === undefined) return false;
      const patch: Record<string, unknown> = {
        provider: entry.gateway.provider,
        displayName: entry.gateway.displayName,
        baseURL: entry.gateway.baseURL,
        api: entry.gateway.api,
        userAgent: entry.gateway.userAgent,
        apiKey: entry.gateway.apiKey,
        apiKeyEnv: entry.gateway.apiKeyEnv,
        systemRole: entry.gateway.systemRole,
        anthropicThinking: Boolean(entry.gateway.anthropicThinking),
      };
      try {
        patch.extraHeaders = JSON.parse(headersText[selected] || '{}') as Record<string, unknown>;
      } catch {
        setStatus({ kind: 'err', text: 'extraHeaders: invalid JSON' });
        return false;
      }
      const r = await call('save-config', { index: selected, patch });
      if (!r.ok) {
        setStatus({ kind: 'err', text: `${t('saveFailed')}: ${String((r as { error?: unknown }).error ?? '')}` });
        return false;
      }
      setStatus({ kind: 'ok', text: success });
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

  /**
   * Current form values as a gateway draft for connection probing (the Test
   * button and the model fetch both use it, so UNSAVED edits are reflected
   * immediately). Returns null when the extra-headers JSON cannot be parsed.
   */
  const buildDraft = (): Record<string, unknown> | null => {
    const selected = state.selected;
    if (selected === null) return null;
    const entry = state.gateways.find((g) => g.index === selected);
    if (entry === undefined) return null;
    const cfg = entry.gateway;
    const draft: Record<string, unknown> = {
      provider: cfg.provider,
      displayName: cfg.displayName,
      baseURL: cfg.baseURL,
      api: cfg.api,
      userAgent: cfg.userAgent,
      apiKey: cfg.apiKey,
      apiKeyEnv: cfg.apiKeyEnv,
      anthropicThinking: Boolean(cfg.anthropicThinking),
      extraHeaders: {},
    };
    const raw = (headersText[selected] ?? '').trim();
    if (raw !== '') {
      try {
        const parsed: unknown = JSON.parse(raw);
        if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('not an object');
        draft.extraHeaders = parsed;
      } catch {
        return null;
      }
    }
    return draft;
  };

  /** Adopt a test-connection envelope: banner + (on success) seed the discovery list. */
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

  /** Probe GET {baseURL}/models with the CURRENT form values (no save needed). */
  const runTest = () => {
    const selected = state.selected;
    if (selected === null) return;
    const draft = buildDraft();
    if (draft === null) {
      setTestResult((tr) => ({ ...tr, [selected]: { ok: false, error: 'extraHeaders: invalid JSON' } }));
      return;
    }
    void (async () => {
      setTesting(true);
      try {
        const r = await call('test-connection', { index: selected, draft });
        applyTestResult(selected, r);
      } finally {
        setTesting(false);
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
          const index = (r as unknown as { index: number }).index;
          setStatus({ kind: 'ok', text: t('saved') });
          void refresh();
          setState((s) => ({ ...s, selected: index }));
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
        setStatus({ kind: 'ok', text: t('saved') });
        void refresh();
        setState((s) => ({ ...s, selected: null }));
      }
    })();
  };

  const saveOverrides = () => {
    const selected = state.selected;
    if (selected === null) return;
    try {
      const overrides = JSON.parse(overridesText[selected] || '{}') as Record<string, unknown>;
      void (async () => {
        const r = await call('save-overrides', { index: selected, overrides });
        if (!r.ok) setStatus({ kind: 'err', text: String((r as { error?: unknown }).error ?? '') });
        else setStatus({ kind: 'ok', text: t('saved') });
      })();
    } catch {
      setStatus({ kind: 'err', text: 'modelOverrides: invalid JSON' });
    }
  };

  /** Fill the form from one enabled model and switch it to edit mode. */
  const startEdit = (id: string) => {
    const selected = state.selected;
    if (selected === null) return;
    const entry = state.gateways.find((g) => g.index === selected);
    const model = (entry?.models ?? []).find((m) => String(m.id) === id);
    if (model === undefined) return;
    setEditing({ id, custom: state.catalog[id] === undefined });
    setFetchedPick('');
    setAddModelDraft({
      id,
      name: String(model.name ?? '') === id ? '' : String(model.name ?? ''),
      contextWindow: model.contextWindow === undefined ? '' : String(model.contextWindow),
      maxTokens: model.maxTokens === undefined ? '' : String(model.maxTokens),
    });
  };

  /** Leave edit mode and clear the form. */
  const cancelEdit = () => {
    setEditing(null);
    setAddModelDraft({ id: '', name: '', contextWindow: '', maxTokens: '' });
  };

  /**
   * Submit the add/edit form. New models: ids matching the built-in catalog
   * are enabled as catalog entries (explicit params become field overrides);
   * anything else is stored as a custom model (runtime enableDiscovered).
   * Edits: custom models rewrite their entry (upsert-custom); built-in ids
   * rewrite only their per-model override via a whole-map save (an empty
   * field drops that override and falls back to the catalog default).
   */
  const submitModelForm = () => {
    const selected = state.selected;
    if (selected === null) return;
    const entry = state.gateways.find((g) => g.index === selected);
    if (entry === undefined) return;
    const id = addModelDraft.id.trim();
    const name = addModelDraft.name.trim();
    const ctx = addModelDraft.contextWindow.trim();
    const max = addModelDraft.maxTokens.trim();
    if (editing !== null) {
      void (async () => {
        const r = editing.custom
          ? await call('upsert-custom', {
            index: selected,
            // Omitted fields keep their previous value (partial update).
            entry: { id: editing.id, ...(name === '' ? {} : { name }), ...(ctx === '' ? {} : { contextWindow: Number(ctx) || undefined }), ...(max === '' ? {} : { maxTokens: Number(max) || undefined }) },
            originalId: { id: editing.id },
          })
          : await call('save-config', {
            index: selected,
            patch: { modelOverrides: overrideMapWith(entry, editing.id, name, ctx, max) },
          });
        if (!r.ok) setStatus({ kind: 'err', text: String((r as { error?: unknown }).error ?? '') });
        else {
          setStatus({ kind: 'ok', text: `${editing.id} ✓` });
          cancelEdit();
          void refresh();
        }
      })();
      return;
    }
    if (id === '') {
      setStatus({ kind: 'err', text: t('modelId') + ' ' + t('required') });
      return;
    }
    void (async () => {
      const model: Record<string, unknown> = {
        id,
        ...(name === '' ? {} : { name }),
        ...(ctx === '' ? {} : { contextWindow: Number(ctx) || undefined }),
        ...(max === '' ? {} : { maxTokens: Number(max) || undefined }),
      };
      const r = await call('enable-discovered', { index: selected, model });
      if (!r.ok) setStatus({ kind: 'err', text: String((r as { error?: unknown }).error ?? '') });
      else {
        setStatus({ kind: 'ok', text: `${id} ${t('enable')} ✓` });
        setAddModelDraft({ id: '', name: '', contextWindow: '', maxTokens: '' });
        void refresh();
      }
    })();
  };

  /** Remove one enabled model: built-in catalog ids toggle off, custom models delete. */
  const removeModel = (id: string) => {
    const selected = state.selected;
    if (selected === null) return;
    void (async () => {
      const builtin = state.catalog[id] !== undefined;
      const r = builtin ? await call('toggle-builtin', { index: selected, id, enabled: false })
        : await call('delete-custom', { index: selected, id });
      if (!r.ok) setStatus({ kind: 'err', text: String((r as { error?: unknown }).error ?? '') });
      else {
        setStatus({ kind: 'ok', text: `${id} ${t('remove')} ✓` });
        void refresh();
      }
    })();
  };

  /**
   * Fetch the upstream model listing with the CURRENT form values (the same
   * draft the Test button probes — unsaved URL/key edits are included), then
   * show the list for one-click enabling. Falls back to an error status when
   * the extra-headers JSON is invalid.
   */
  const runFetchModels = () => {
    const selected = state.selected;
    if (selected === null) return;
    const draft = buildDraft();
    if (draft === null) {
      setStatus({ kind: 'err', text: 'extraHeaders: invalid JSON' });
      return;
    }
    void (async () => {
      setDiscovering(true);
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
        setDiscovering(false);
      }
    })();
  };

  /** One editor field as a settings row (title/desc left, input right). */
  const fieldRow = (key: string, label: string, hint?: string, placeholder?: string) => {
    const selected = state.selected;
    const entry = state.gateways.find((g) => g.index === selected);
    const cfg = entry?.gateway ?? {};
    return Row({
      title: label,
      desc: hint,
      control: React.createElement('input', {
        className: 'phub-input',
        value: String(cfg[key] ?? ''),
        placeholder,
        onChange: (e: ReactTypes.ChangeEvent<HTMLInputElement>) => setField(key, e.target.value),
      }),
    });
  };

  const selected = state.selected;
  const selectedEntry = state.gateways.find((g) => g.index === selected);
  const cfg = selectedEntry?.gateway ?? {};
  const statusLine = status === null ? null
    : React.createElement('span', { className: `phub-status phub-status-${status.kind}` }, status.text);
  // Connection-test banner for the selected gateway (null until first test;
  // cleared on any field edit so it can never describe stale values).
  const test = selected === null ? null : testResult[selected] ?? null;
  const testModels = test?.models ?? [];
  const testBanner = test === null ? null : React.createElement('div', {
    className: `phub-test-result ${test.ok ? 'phub-test-ok' : 'phub-test-err'}`,
  },
    React.createElement('span', null, test.ok
      ? `✓ ${t('testOk')} · ${String(test.latencyMs ?? 0)}ms · ${String(test.modelCount ?? 0)} ${t('testModels')}${testModels.length > 0 ? ` · ${t('testSeeded')}` : ''}`
      : `✕ ${t('testFailed')}`),
    React.createElement('span', { className: 'phub-test-detail' },
      test.ok
        ? `GET ${String(test.endpoint ?? '')}${testModels.length > 0
            ? ` → ${testModels.slice(0, 3).map((m) => m.id).join(', ')}${testModels.length > 3 ? ' …' : ''}`
            : ''}`
        : String(test.error ?? '')),
  );
  // Model ids already enabled on the selected gateway (marks fetched options).
  const enabledIds = new Set((selectedEntry?.models ?? []).map((m) => String(m.id)));
  // Contextual preset hit for whatever id is currently in the add form.
  const presetHit = matchCatalog(addModelDraft.id, state.catalog);
  // The fetched (or test-probed) model listing, when one exists.
  const fetchedList = selected === null ? undefined : discovered[selected];

  return React.createElement('div', { className: 'phub-page' },
    React.createElement('p', { className: 'phub-intro' }, t('intro')),

    // ---- Gateway list ----
    React.createElement('section', null,
      React.createElement('div', { className: 'phub-group-heading' },
        t('gateways'),
        React.createElement('span', { className: 'phub-count' }, String(state.gateways.length)),
      ),
      React.createElement('div', { className: 'phub-group' },
        state.gateways.length === 0
          ? React.createElement('div', { className: 'phub-empty' },
            React.createElement('span', { className: 'phub-empty-title' }, t('emptyTitle')),
            React.createElement('span', { className: 'phub-empty-desc' }, t('emptyHint')),
          )
          : state.gateways.map((g) => {
            const name = String(g.gateway.displayName ?? g.gateway.provider ?? '');
            const provider = String(g.gateway.provider ?? '');
            const api = String(g.gateway.api ?? '');
            const base = String(g.gateway.baseURL ?? '');
            const desc = base === '' ? `${provider} · ${api} · ${t('baseURL')} —` : `${provider} · ${api} · ${base}`;
            return Row({
              key: g.index,
              selected: selected === g.index,
              onClick: () => setState((s) => ({ ...s, selected: s.selected === g.index ? null : g.index })),
              title: React.createElement('span', { style: { display: 'inline-flex', alignItems: 'center', gap: 10 } },
                ChipUI({ text: name }),
                React.createElement('span', null, name),
              ),
              desc,
              control: React.createElement('button', {
                className: 'phub-btn phub-btn-danger',
                title: t('delete'),
                onClick: (e: ReactTypes.MouseEvent<HTMLButtonElement>) => {
                  e.stopPropagation();
                  deleteGateway(g.index);
                },
              }, t('delete')),
            });
          }),
        React.createElement('button', { className: 'phub-add-card', disabled: busy, onClick: addGateway },
          `+ ${t('addGateway')}`,
        ),
        statusLine === null ? null : React.createElement('div', { className: 'phub-actions' }, statusLine),
      ),
    ),

    // ---- Gateway editor ----
    selected === null || selectedEntry === undefined ? null : React.createElement('section', null,
      React.createElement('div', { className: 'phub-group-heading' },
        `${t('gateway')}: ${String(cfg.displayName ?? cfg.provider ?? '')}`,
        React.createElement('span', { className: 'phub-count' }, String(cfg.api ?? 'anthropic-messages')),
      ),
      React.createElement('div', { className: 'phub-group' },
        fieldRow('provider', t('providerName'), t('providerNameHint')),
        fieldRow('displayName', t('displayName')),
        fieldRow('baseURL', `${t('baseURL')} *`, t('baseURLHint'), t('baseURLPlaceholder')),
        Row({
          title: t('api'),
          // MUST be a React element (createElement), never a direct call:
          // SelectMenu holds hooks (useState) and a direct call would attach
          // them to the parent fiber with a conditional order — React throws
          // "rendered more/less hooks" and the settings panel blanks.
          control: React.createElement(SelectMenu, {
            label: t('api'),
            value: String(cfg.api ?? 'anthropic-messages'),
            options: [{ value: 'anthropic-messages', title: 'anthropic-messages' }, { value: 'openai-completions', title: 'openai-completions' }],
            onChange: (next) => setField('api', next),
          }),
        }),
        fieldRow('userAgent', t('userAgent')),
        fieldRow('apiKey', t('apiKey')),
        fieldRow('apiKeyEnv', t('apiKeyEnv'), t('apiKeyHint')),
        Row({
          title: t('anthropicThinking'),
          control: SwitchUI({
            checked: Boolean(cfg.anthropicThinking),
            onChange: (next) => setField('anthropicThinking', next),
          }),
        }),
        // JSON editors get the full card width: a narrow right-hand box
        // makes JSON unreadable.
        React.createElement('div', { className: 'phub-stack' },
          React.createElement('span', { className: 'phub-stack-label' }, `${t('extraHeaders')} (JSON)`),
          React.createElement('textarea', {
            className: 'phub-textarea',
            value: headersText[selected] ?? '',
            onChange: (e: ReactTypes.ChangeEvent<HTMLTextAreaElement>) => {
              setHeadersText((h) => ({ ...h, [selected]: e.target.value }));
              clearTestResult();
            },
          }),
        ),
        React.createElement('div', { className: 'phub-actions' },
          React.createElement('button', { className: 'phub-btn', disabled: busy, onClick: () => void save() }, t('save')),
          // Probe GET {baseURL}/models with the form values — no save needed.
          React.createElement('button', {
            className: 'phub-btn',
            disabled: busy || testing || String(cfg.baseURL ?? '').trim() === '',
            onClick: runTest,
          }, testing ? `${t('testConnection')}…` : t('testConnection')),
          statusLine,
        ),
        testBanner,
      ),
    ),

    // ---- Models ----
    // Stable reading order: enabled list (editable) → add form → overrides.
    selected === null || selectedEntry === undefined ? null : React.createElement('section', null,
      React.createElement('div', { className: 'phub-group-heading' },
        t('models'),
        React.createElement('span', { className: 'phub-count' },
          String((selectedEntry.models ?? []).length),
        ),
      ),
      React.createElement('div', { className: 'phub-group' },
        // -- Enabled models (catalog entries + custom models): edit fills the
        //    form below, remove deletes.
        SubHead(t('modelsEnabled')),
        React.createElement('div', { className: 'phub-models-list' },
          (selectedEntry.models ?? []).length === 0
            ? React.createElement('span', { className: 'phub-editor-note', style: { padding: '2px 8px 6px' } }, t('modelsEmptyHint'))
            : (selectedEntry.models ?? []).map((m) => {
              const id = String(m.id ?? '');
              const name = String(m.name ?? id);
              const ctx = String(m.contextWindow ?? '');
              const max = String(m.maxTokens ?? '');
              const active = editing?.id === id;
              return Row({
                key: id,
                className: active ? 'phub-row-selected' : undefined,
                title: name,
                desc: React.createElement('span', { className: 'phub-model-params' },
                  `${id}${ctx === '' ? '' : ` · ${ctx}`}${max === '' ? '' : ` · ${max}`}${
                    state.catalog[id] !== undefined ? '' : ` · ${t('custom')}`}`,
                ),
                control: React.createElement(React.Fragment, null,
                  React.createElement('button', {
                    className: 'phub-btn',
                    title: t('edit'),
                    onClick: () => startEdit(id),
                  }, t('edit')),
                  React.createElement('button', {
                    className: 'phub-btn phub-btn-danger',
                    title: t('remove'),
                    onClick: () => void removeModel(id),
                  }, t('remove')),
                ),
              });
            }),
        ),
        // -- Add: fetch the upstream listing into a dropdown (with the current
        //    form values), pick or type an id, optionally apply preset params.
        SubHead(editing === null ? t('addModel') : `${t('addModel')} · ${t('edit')}: ${editing.id}`, t('addModelHint')),
        React.createElement('div', { className: 'phub-actions', style: { paddingTop: 0 } },
          React.createElement('button', {
            className: 'phub-btn',
            disabled: discovering || String(cfg.baseURL ?? '').trim() === '',
            onClick: runFetchModels,
          }, discovering ? `${t('discoverRun')}…` : t('discoverRun')),
          fetchedList !== undefined && fetchedList !== null
            ? React.createElement('span', { className: 'phub-editor-note' }, `${fetchedList.length} ${t('testModels')}`)
            : null,
        ),
        // Dropdown over the fetched listing — the normal flow: fetch, pick, add.
        fetchedList === null || fetchedList === undefined || fetchedList.length === 0 ? null
          : Row({
            title: t('fetchedModels'),
            control: React.createElement(SelectMenu, {
              label: t('fetchedModels'),
              value: fetchedPick,
              options: fetchedList.map((model) => ({
                value: model.id,
                title: `${model.id}${model.contextWindow !== undefined ? ` · ${model.contextWindow}` : ''}${model.maxTokens !== undefined ? ` / ${model.maxTokens}` : ''}${enabledIds.has(model.id) ? ` · ${t('alreadyEnabled')}` : ''}`,
              })),
              onChange: (next) => {
                setFetchedPick(next);
                const model = fetchedList.find((m) => m.id === next);
                if (model === undefined) return;
                setEditing(null);
                setAddModelDraft({
                  id: model.id,
                  name: model.name !== undefined && model.name !== '' && model.name !== model.id ? model.name : '',
                  contextWindow: model.contextWindow !== undefined ? String(model.contextWindow) : '',
                  maxTokens: model.maxTokens !== undefined ? String(model.maxTokens) : '',
                });
              },
            }),
          }),
        React.createElement('div', { className: 'phub-custom-item' },
          React.createElement('input', {
            className: 'phub-input',
            placeholder: t('modelId'),
            value: addModelDraft.id,
            disabled: editing !== null,
            onChange: (e: ReactTypes.ChangeEvent<HTMLInputElement>) => setAddModelDraft((d) => ({ ...d, id: e.target.value })),
          }),
          React.createElement('input', {
            className: 'phub-input',
            placeholder: t('modelName'),
            value: addModelDraft.name,
            onChange: (e: ReactTypes.ChangeEvent<HTMLInputElement>) => setAddModelDraft((d) => ({ ...d, name: e.target.value })),
          }),
          React.createElement('input', {
            className: 'phub-input',
            placeholder: t('contextWindow'),
            value: addModelDraft.contextWindow,
            onChange: (e: ReactTypes.ChangeEvent<HTMLInputElement>) => setAddModelDraft((d) => ({ ...d, contextWindow: e.target.value })),
          }),
          React.createElement('input', {
            className: 'phub-input',
            placeholder: t('maxTokens'),
            value: addModelDraft.maxTokens,
            onChange: (e: ReactTypes.ChangeEvent<HTMLInputElement>) => setAddModelDraft((d) => ({ ...d, maxTokens: e.target.value })),
          }),
          React.createElement('span', { className: 'phub-form-buttons' },
            React.createElement('button', { className: 'phub-btn', disabled: busy, onClick: submitModelForm },
              editing === null ? t('addCustom') : t('update')),
            editing === null ? null : React.createElement('button', { className: 'phub-btn', onClick: cancelEdit }, t('cancel')),
          ),
        ),
        // Contextual preset offer: the typed/selected id matches the built-in
        // catalog (exact or fuzzy) — one click applies its parameters.
        presetHit === undefined ? null : React.createElement('div', { className: 'phub-actions', style: { paddingTop: 6 } },
          React.createElement('button', {
            className: 'phub-suggest',
            onClick: () => {
              const preset = state.catalog[presetHit];
              if (preset === undefined) return;
              setAddModelDraft((d) => ({ ...d, contextWindow: String(preset.contextWindow), maxTokens: String(preset.maxTokens) }));
            },
          }, `${t('presetApply')} · ${state.catalog[presetHit]?.name ?? presetHit} (${state.catalog[presetHit]?.contextWindow ?? ''} / ${state.catalog[presetHit]?.maxTokens ?? ''})`),
        ),
        // -- Overrides: full-width JSON editor + save.
        SubHead(t('overrides'), t('overridesHint')),
        React.createElement('div', { className: 'phub-stack' },
          React.createElement('textarea', {
            className: 'phub-textarea',
            value: overridesText[selected] ?? '',
            onChange: (e: ReactTypes.ChangeEvent<HTMLTextAreaElement>) => setOverridesText((o) => ({ ...o, [selected]: e.target.value })),
          }),
          React.createElement('div', { className: 'phub-stack-foot' },
            React.createElement('button', { className: 'phub-btn', onClick: saveOverrides }, t('save')),
          ),
        ),
      ),
    ),
  );
}
