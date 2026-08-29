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
  preset: Record<string, unknown> | null;
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
    React.createElement('span', { className: 'phub-select-anchor-text' }, selected?.title ?? props.value ?? '—'),
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
  const [overridesText, setOverridesText] = React.useState<Record<number, string>>({});
  const [headersText, setHeadersText] = React.useState<Record<number, string>>({});
  const [presetProviders, setPresetProviders] = React.useState<Array<{ provider: string; displayName: string }>>([]);
  const [presetModels, setPresetModels] = React.useState<Record<number, Array<{ id: string; name: string }>>>({});
  const [presetProvider, setPresetProvider] = React.useState<Record<number, string>>({});
  const [presetModel, setPresetModel] = React.useState<Record<number, string>>({});
  const [discovered, setDiscovered] = React.useState<Record<number, DiscoveredModel[] | null>>({});

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
      const rp = await call('list-presets');
      if (rp.ok) setPresetProviders((rp as unknown as { providers: Array<{ provider: string; displayName: string }> }).providers);
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

  const toggleBuiltin = (id: string, enabled: boolean) => {
    const selected = state.selected;
    if (selected === null) return;
    void (async () => {
      const r = await call('toggle-builtin', { index: selected, id, enabled });
      if (!r.ok) setStatus({ kind: 'err', text: String((r as { error?: unknown }).error ?? '') });
      else void refresh();
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

  /**
   * Add one model: ids matching the built-in catalog are enabled as catalog
   * entries (params auto-filled; non-default inputs become field overrides);
   * anything else is stored as a custom model with the given (or default)
   * params. Backed by the runtime's enableDiscovered.
   */
  const submitAddModel = () => {
    const selected = state.selected;
    if (selected === null) return;
    const id = addModelDraft.id.trim();
    if (id === '') {
      setStatus({ kind: 'err', text: t('modelId') + ' ' + t('required') });
      return;
    }
    void (async () => {
      const entry: Record<string, unknown> = {
        id,
        ...(addModelDraft.name.trim() === '' ? {} : { name: addModelDraft.name.trim() }),
        ...(addModelDraft.contextWindow.trim() === '' ? {} : { contextWindow: Number(addModelDraft.contextWindow) || undefined }),
        ...(addModelDraft.maxTokens.trim() === '' ? {} : { maxTokens: Number(addModelDraft.maxTokens) || undefined }),
      };
      const r = await call('enable-discovered', { index: selected, model: entry });
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

  const importPreset = async () => {
    const selected = state.selected;
    if (selected === null) return;
    const pv = presetProvider[selected] ?? '';
    const mv = presetModel[selected] ?? '';
    if (pv === '' || mv === '') return;
    const r = await call('preset-model-info', { provider: pv, model: mv });
    if (!r.ok) {
      setStatus({ kind: 'err', text: String((r as { error?: unknown }).error ?? '') });
      return;
    }
    const info = (r as unknown as { info: { id: string; name?: string; context?: { contextWindow?: number }; defaultMaxTokens?: number } }).info;
    const entry: Record<string, unknown> = {
      id: info.id,
      name: info.name ?? info.id,
      contextWindow: info.context?.contextWindow,
      maxTokens: info.defaultMaxTokens,
    };
    // enable-discovered applies catalog auto-config when the id hits the
    // built-in catalog; otherwise it inserts a custom model.
    const r2 = await call('enable-discovered', { index: selected, model: entry });
    if (!r2.ok) setStatus({ kind: 'err', text: String((r2 as { error?: unknown }).error ?? '') });
    else {
      setStatus({ kind: 'ok', text: `${info.id} ${t('importPreset')} ✓` });
      void refresh();
    }
  };

  const loadPresetModels = async (provider: string) => {
    const selected = state.selected;
    if (selected === null) return;
    setPresetProvider((p) => ({ ...p, [selected]: provider }));
    setPresetModel((p) => ({ ...p, [selected]: '' }));
    if (provider === '') {
      setPresetModels((p) => ({ ...p, [selected]: [] }));
      return;
    }
    const r = await call('preset-models', { provider });
    if (r.ok) setPresetModels((p) => ({ ...p, [selected]: (r as unknown as { models: Array<{ id: string; name: string }> }).models }));
  };

  const runDiscover = async () => {
    const selected = state.selected;
    if (selected === null) return;
    setDiscovered((d) => ({ ...d, [selected]: null }));
    setBusy(true);
    try {
      const r = await call('discover', { index: selected });
      if (!r.ok) {
        setStatus({ kind: 'err', text: String((r as { error?: unknown }).error ?? '') });
        return;
      }
      setDiscovered((d) => ({ ...d, [selected]: (r as unknown as { models: DiscoveredModel[] }).models }));
      setStatus({ kind: 'ok', text: t('discovered') });
    } finally {
      setBusy(false);
    }
  };

  const adoptDiscovered = async (model: DiscoveredModel) => {
    const selected = state.selected;
    if (selected === null) return;
    const entry: Record<string, unknown> = {
      id: model.id,
      name: model.name ?? model.id,
      contextWindow: model.contextWindow,
      maxTokens: model.maxTokens,
    };
    const r = await call('upsert-custom', { index: selected, entry, originalId: null });
    if (!r.ok) setStatus({ kind: 'err', text: String((r as { error?: unknown }).error ?? '') });
    else {
      setStatus({ kind: 'ok', text: `${model.id} ✓` });
      void refresh();
    }
  };

  const enableDiscovered = async (model: DiscoveredModel) => {
    const selected = state.selected;
    if (selected === null) return;
    const r = await call('enable-discovered', { index: selected, model: model as unknown as Record<string, unknown> });
    if (!r.ok) setStatus({ kind: 'err', text: String((r as { error?: unknown }).error ?? '') });
    else {
      setStatus({ kind: 'ok', text: `${model.id} ${t('enable')} ✓` });
      void refresh();
    }
  };

  const snapshotCatalog = async () => {
    const selected = state.selected;
    if (selected === null) return;
    const r = await call('snapshot-catalog', { index: selected });
    if (!r.ok) setStatus({ kind: 'err', text: String((r as { error?: unknown }).error ?? '') });
    else setStatus({ kind: 'ok', text: `${t('snapshot')} ✓` });
  };

  const restoreCatalog = async () => {
    const selected = state.selected;
    if (selected === null) return;
    const r = await call('restore-catalog', { index: selected });
    if (!r.ok) setStatus({ kind: 'err', text: String((r as { error?: unknown }).error ?? '') });
    else {
      setStatus({ kind: 'ok', text: `${t('restore')} ✓` });
      void refresh();
    }
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
        fieldRow('baseURL', `${t('baseURL')} *`, undefined, t('baseURLPlaceholder')),
        Row({
          title: t('api'),
          control: SelectMenu({
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
        Row({
          title: `${t('extraHeaders')} (JSON)`,
          control: React.createElement('textarea', {
            className: 'phub-textarea',
            style: { width: 320 },
            value: headersText[selected] ?? '',
            onChange: (e: ReactTypes.ChangeEvent<HTMLTextAreaElement>) => setHeadersText((h) => ({ ...h, [selected]: e.target.value })),
          }),
        }),
        React.createElement('div', { className: 'phub-actions' },
          React.createElement('button', { className: 'phub-btn', disabled: busy, onClick: () => void save() }, t('save')),
          statusLine,
        ),
      ),
    ),

    // ---- Models ----
    selected === null || selectedEntry === undefined ? null : React.createElement('section', null,
      React.createElement('div', { className: 'phub-group-heading' },
        t('models'),
        React.createElement('span', { className: 'phub-count' },
          String((selectedEntry.models ?? []).length),
        ),
      ),
      React.createElement('div', { className: 'phub-group' },
        // Enabled model list: catalog entries + custom models, each removable.
        React.createElement('div', { className: 'phub-editor-note', style: { paddingTop: 10 } }, t('modelsEnabled')),
        React.createElement('div', { className: 'phub-models-list', style: { marginTop: 4 } },
          (selectedEntry.models ?? []).length === 0
            ? React.createElement('span', { className: 'phub-editor-note', style: { padding: '6px 8px' } }, `${t('empty')} — ${t('addModelHint')}`)
            : (selectedEntry.models ?? []).map((m) => {
              const id = String(m.id ?? '');
              const name = String(m.name ?? id);
              const ctx = String(m.contextWindow ?? '');
              const max = String(m.maxTokens ?? '');
              return Row({
                key: id,
                title: name,
                desc: React.createElement('span', { className: 'phub-model-params' },
                  `${id}${ctx === '' ? '' : ` · ${ctx}`}${max === '' ? '' : ` · ${max}`}${
                    state.catalog[id] !== undefined ? '' : ` · ${t('custom')}`}`,
                ),
                control: React.createElement('button', {
                  className: 'phub-btn phub-btn-danger',
                  title: t('remove'),
                  onClick: () => void removeModel(id),
                }, t('remove')),
              });
            }),
        ),
        React.createElement('div', { className: 'phub-actions' },
          React.createElement('button', { className: 'phub-btn', disabled: busy, onClick: () => void runDiscover() }, t('discover')),
          React.createElement('span', { className: 'phub-editor-note' }, t('discoverHint')),
        ),
        discovered[selected] === null || discovered[selected] === undefined ? null
          : React.createElement('div', { className: 'phub-discover-list' },
            (discovered[selected] ?? []).map((model) => React.createElement('div', { className: 'phub-discover-item', key: model.id },
              React.createElement('span', null,
                `${model.id}${model.contextWindow !== undefined ? ` · ${model.contextWindow}` : ''}${model.maxTokens !== undefined ? ` / ${model.maxTokens}` : ''}`,
              ),
              React.createElement('button', { className: 'phub-btn', onClick: () => void enableDiscovered(model) }, t('enable')),
            )),
          ),
        // Add-model row: catalog ids auto-fill params, others become custom.
        Row({
          title: t('addModel'),
          desc: t('addModelHint'),
        }),
        React.createElement('div', { className: 'phub-custom-item' },
          React.createElement('input', {
            className: 'phub-input',
            placeholder: t('modelId'),
            value: addModelDraft.id,
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
          React.createElement('button', { className: 'phub-btn', disabled: busy, onClick: submitAddModel }, t('addCustom')),
        ),
        Row({
          title: `${t('overrides')} (JSON)`,
          desc: t('overridesHint'),
          control: React.createElement('textarea', {
            className: 'phub-textarea',
            style: { width: 320 },
            value: overridesText[selected] ?? '',
            onChange: (e: ReactTypes.ChangeEvent<HTMLTextAreaElement>) => setOverridesText((o) => ({ ...o, [selected]: e.target.value })),
          }),
        }),
        React.createElement('div', { className: 'phub-actions' },
          React.createElement('button', { className: 'phub-btn', onClick: saveOverrides }, `${t('overrides')}: ${t('save')}`),
        ),
        Row({
          title: t('presetFrom'),
          desc: t('presetHint'),
          control: React.createElement('span', { className: 'phub-control' },
            SelectMenu({
              label: t('presetProvider'),
              value: presetProvider[selected] ?? '',
              options: [
                { value: '', title: '—' },
                ...presetProviders.map((p) => ({ value: p.provider, title: `${p.displayName} (${p.provider})` })),
              ],
              onChange: (next) => void loadPresetModels(next),
            }),
            SelectMenu({
              label: t('presetModel'),
              value: presetModel[selected] ?? '',
              disabled: (presetModels[selected] ?? []).length === 0,
              options: [
                { value: '', title: '—' },
                ...(presetModels[selected] ?? []).map((m) => ({ value: m.id, title: m.name ?? m.id })),
              ],
              onChange: (next) => setPresetModel((p) => ({ ...p, [selected]: next })),
            }),
            React.createElement('button', { className: 'phub-btn', disabled: (presetModel[selected] ?? '') === '', onClick: () => void importPreset() }, t('importPreset')),
          ),
        }),
        React.createElement('div', { className: 'phub-actions' },
          React.createElement('button', { className: 'phub-btn', disabled: busy, onClick: () => void runDiscover() }, t('discover')),
          React.createElement('span', { className: 'phub-editor-note' }, t('discoverHint')),
        ),
        React.createElement('div', { className: 'phub-actions' },
          React.createElement('button', { className: 'phub-btn', onClick: () => void snapshotCatalog() }, t('snapshot')),
          React.createElement('button', { className: 'phub-btn', onClick: () => void restoreCatalog() }, t('restore')),
          React.createElement('span', { className: 'phub-editor-note' }, t('snapshotHint')),
        ),
        discovered[selected] === null || discovered[selected] === undefined ? null
          : React.createElement('div', { className: 'phub-discover-list' },
            (discovered[selected] ?? []).map((model) => React.createElement('div', { className: 'phub-discover-item', key: model.id },
              React.createElement('span', null,
                `${model.id}${model.contextWindow !== undefined ? ` · ${model.contextWindow}` : ''}${model.maxTokens !== undefined ? ` / ${model.maxTokens}` : ''}`,
              ),
              React.createElement('button', { className: 'phub-btn', onClick: () => void enableDiscovered(model) }, t('enable')),
              React.createElement('button', { className: 'phub-btn', onClick: () => void adoptDiscovered(model) }, t('adopt')),
            )),
          ),
      ),
    ),
  );
}
