/**
 * Provider Hub — settings page component (client half).
 * Environment-neutral: driven only by `t` (translate) and `call` (one host
 * RPC returning `{ ok, ... } | { ok: false, error }`).
 *
 * Layout: a list of gateway cards; clicking one expands its full editor
 * (gateway fields + model management). All mutations carry the gateway index.
 *
 * @module dsh-provider-hub/client/page
 */
import type * as ReactTypes from 'react';
// Real value import: the DSH client module system resolves `react` through
// its platform seed table, so the built bundle calls require("react") and
// gets the renderer's React instance (no global dependency).
import React from 'react';
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

const REASONING_PRESETS = [
  'off', 'low', 'medium', 'high', 'xhigh', 'max',
];

export function ProviderHubPage(props: PageProps): React.ReactElement {
  const { t, call } = props;
  const [state, setState] = React.useState<State>({ gateways: [], catalog: {}, selected: null });
  const [status, setStatus] = React.useState<Status>(null);
  const [busy, setBusy] = React.useState(false);
  const [customRows, setCustomRows] = React.useState<Record<number, Array<Record<string, string>>>>({});
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
      const nextCustom: Record<number, Array<Record<string, string>>> = {};
      const nextOverrides: Record<number, string> = {};
      const nextHeaders: Record<number, string> = {};
      for (const g of value.gateways) {
        nextCustom[g.index] = (g.gateway.customModels as Array<Record<string, unknown>> | undefined ?? []).map((m) => ({
          id: String(m.id ?? ''),
          name: String(m.name ?? ''),
          contextWindow: String(m.contextWindow ?? ''),
          maxTokens: String(m.maxTokens ?? ''),
          reasoningEfforts: JSON.stringify(m.reasoningEfforts ?? {}),
        }));
        nextOverrides[g.index] = JSON.stringify(g.gateway.modelOverrides ?? {}, null, 2);
        nextHeaders[g.index] = JSON.stringify(g.gateway.extraHeaders ?? {}, null, 2);
      }
      setCustomRows(nextCustom);
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
      const r = await call('add-gateway', {});
      if (!r.ok) setStatus({ kind: 'err', text: String((r as { error?: unknown }).error ?? '') });
      else {
        const index = (r as unknown as { index: number }).index;
        setStatus({ kind: 'ok', text: t('saved') });
        void refresh();
        setState((s) => ({ ...s, selected: index }));
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

  const addCustomRow = () => {
    const selected = state.selected;
    if (selected === null) return;
    setCustomRows((rows) => ({
      ...rows,
      [selected]: [...(rows[selected] ?? []), { id: '', name: '', contextWindow: '', maxTokens: '', reasoningEfforts: '{}' }],
    }));
  };

  const saveCustomRow = async (rowIndex: number) => {
    const selected = state.selected;
    if (selected === null) return;
    const row = (customRows[selected] ?? [])[rowIndex];
    if (row === undefined || row.id.trim() === '') {
      setStatus({ kind: 'err', text: t('modelId') + ' ' + t('required') });
      return;
    }
    let reasoningEfforts: unknown = {};
    try {
      reasoningEfforts = JSON.parse(row.reasoningEfforts || '{}');
    } catch {
      setStatus({ kind: 'err', text: 'reasoningEfforts: invalid JSON' });
      return;
    }
    const entry: Record<string, unknown> = {
      id: row.id.trim(),
      name: row.name.trim(),
      contextWindow: Number(row.contextWindow) || undefined,
      maxTokens: Number(row.maxTokens) || undefined,
      reasoningEfforts,
    };
    const r = await call('upsert-custom', { index: selected, entry, originalId: { id: row.id.trim() } });
    if (!r.ok) setStatus({ kind: 'err', text: String((r as { error?: unknown }).error ?? '') });
    else void refresh();
  };

  const deleteCustomRow = async (id: string) => {
    const selected = state.selected;
    if (selected === null) return;
    const r = await call('delete-custom', { index: selected, id });
    if (!r.ok) setStatus({ kind: 'err', text: String((r as { error?: unknown }).error ?? '') });
    else void refresh();
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
    const r2 = await call('upsert-custom', { index: selected, entry, originalId: null });
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

  const field = (key: string, label: string, hint?: string, placeholder?: string) => {
    const selected = state.selected;
    const entry = state.gateways.find((g) => g.index === selected);
    const cfg = entry?.gateway ?? {};
    return React.createElement('div', { className: 'phub-field', key },
      React.createElement('label', null, label),
      React.createElement('input', {
        value: String(cfg[key] ?? ''),
        placeholder,
        onChange: (e: React.ChangeEvent<HTMLInputElement>) => setField(key, e.target.value),
      }),
      hint === undefined ? null : React.createElement('span', { className: 'phub-hint' }, hint),
    );
  };

  const selected = state.selected;
  const selectedEntry = state.gateways.find((g) => g.index === selected);
  const cfg = selectedEntry?.gateway ?? {};

  return React.createElement('div', { className: 'phub-page' },
    // ---- Gateway list ----
    React.createElement('section', { className: 'phub-section' },
      React.createElement('h3', null, t('gateways')),
      state.gateways.length === 0
        ? React.createElement('span', { className: 'phub-hint' }, t('empty'))
        : state.gateways.map((g) => React.createElement('div', {
          key: g.index,
          className: `phub-gw-item${selected === g.index ? ' phub-gw-item-selected' : ''}`,
        },
          React.createElement('button', {
            className: 'phub-gw-name',
            onClick: () => setState((s) => ({ ...s, selected: s.selected === g.index ? null : g.index })),
          },
            `${String(g.gateway.displayName ?? g.gateway.provider ?? '')} (${String(g.gateway.provider ?? '')})`,
          ),
          React.createElement('span', { className: 'phub-hint' },
            `${String(g.gateway.api ?? '')}${g.gateway.baseURL ? ` · ${String(g.gateway.baseURL)}` : ''}`,
          ),
          React.createElement('button', { className: 'phub-btn phub-gw-del', onClick: () => deleteGateway(g.index) }, t('delete')),
        )),
      React.createElement('div', { className: 'phub-actions' },
        React.createElement('button', { className: 'phub-btn', onClick: addGateway }, `+ ${t('addGateway')}`),
        // Surface operation outcomes (success/failure) even before any
        // gateway is selected; otherwise a failed call looks like a dead
        // button (the editor status line only renders when selected != null).
        status === null ? null : React.createElement('span', { className: `phub-status ${status.kind}` }, status.text),
      ),
    ),
    // ---- Per-gateway editor ----
    selected === null || selectedEntry === undefined ? null : React.createElement('section', { className: 'phub-section' },
      React.createElement('h3', null, `${t('gateway')}: ${String(cfg.displayName ?? cfg.provider ?? '')}`),
      React.createElement('div', { className: 'phub-grid' },
        field('provider', t('providerName'), t('providerNameHint')),
        field('displayName', t('displayName')),
        field('baseURL', `${t('baseURL')} *`, undefined, t('baseURLPlaceholder')),
        React.createElement('div', { className: 'phub-field' },
          React.createElement('label', null, t('api')),
          React.createElement('select', {
            value: String(cfg.api ?? 'anthropic-messages'),
            onChange: (e: React.ChangeEvent<HTMLSelectElement>) => setField('api', e.target.value),
          },
          React.createElement('option', { value: 'anthropic-messages' }, 'anthropic-messages'),
          React.createElement('option', { value: 'openai-completions' }, 'openai-completions'),
          ),
        ),
        field('userAgent', t('userAgent')),
        React.createElement('div', { className: 'phub-field' },
          React.createElement('label', null, t('systemRole')),
          React.createElement('select', {
            value: String(cfg.systemRole ?? 'system'),
            onChange: (e: React.ChangeEvent<HTMLSelectElement>) => setField('systemRole', e.target.value),
          },
          React.createElement('option', { value: 'system' }, 'system'),
          React.createElement('option', { value: 'developer' }, 'developer'),
          ),
        ),
        field('apiKey', t('apiKey')),
        field('apiKeyEnv', t('apiKeyEnv'), t('apiKeyHint')),
        React.createElement('label', { style: { display: 'flex', alignItems: 'center', gap: 8 } },
          React.createElement('input', {
            type: 'checkbox',
            checked: Boolean(cfg.anthropicThinking),
            onChange: (e: React.ChangeEvent<HTMLInputElement>) => setField('anthropicThinking', e.target.checked),
          }),
          t('anthropicThinking'),
        ),
      ),
      React.createElement('div', { className: 'phub-field phub-headers' },
        React.createElement('label', null, `${t('extraHeaders')} (JSON)`),
        React.createElement('textarea', {
          value: headersText[selected] ?? '',
          onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => setHeadersText((h) => ({ ...h, [selected]: e.target.value })),
        }),
      ),
      React.createElement('div', { className: 'phub-actions' },
        React.createElement('button', { className: 'phub-btn', disabled: busy, onClick: () => void save() }, t('save')),
        status === null ? null : React.createElement('span', { className: `phub-status ${status.kind}` }, status.text),
      ),
      // ---- Models ----
      React.createElement('h3', { style: { marginTop: 16 } }, t('models')),
      React.createElement('div', { className: 'phub-builtin' },
        React.createElement('span', { className: 'phub-hint' }, t('builtinHint')),
        Object.entries(state.catalog).map(([id, entry]) => React.createElement('label', { key: id },
          React.createElement('input', {
            type: 'checkbox',
            checked: (cfg.enabledModels as string[] | undefined ?? []).includes(id),
            onChange: (e: React.ChangeEvent<HTMLInputElement>) => toggleBuiltin(id, e.target.checked),
          }),
          React.createElement('span', null, entry.name),
          React.createElement('span', { className: 'phub-params' }, `${entry.contextWindow} / ${entry.maxTokens}`),
        )),
      ),
      React.createElement('div', { className: 'phub-field phub-overrides', style: { marginTop: 10 } },
        React.createElement('label', null, `${t('overrides')} (JSON)`),
        React.createElement('textarea', {
          value: overridesText[selected] ?? '',
          onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => setOverridesText((o) => ({ ...o, [selected]: e.target.value })),
        }),
        React.createElement('div', { className: 'phub-actions' },
          React.createElement('button', { className: 'phub-btn', onClick: saveOverrides }, t('save')),
        ),
      ),
      React.createElement('div', { className: 'phub-custom', style: { marginTop: 12 } },
        React.createElement('label', null, t('custom')),
        ((customRows[selected] ?? []).length === 0 ? React.createElement('span', { className: 'phub-hint' }, t('empty')) : null),
        (customRows[selected] ?? []).map((row, rowIndex) => React.createElement('div', { className: 'phub-custom-item', key: rowIndex },
          React.createElement('input', {
            placeholder: t('modelId'),
            value: row.id,
            onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
              const next = [...(customRows[selected] ?? [])];
              next[rowIndex] = { ...row, id: e.target.value };
              setCustomRows((rows) => ({ ...rows, [selected]: next }));
            },
          }),
          React.createElement('input', {
            placeholder: t('modelName'),
            value: row.name,
            onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
              const next = [...(customRows[selected] ?? [])];
              next[rowIndex] = { ...row, name: e.target.value };
              setCustomRows((rows) => ({ ...rows, [selected]: next }));
            },
          }),
          React.createElement('input', {
            placeholder: t('contextWindow'),
            value: row.contextWindow,
            onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
              const next = [...(customRows[selected] ?? [])];
              next[rowIndex] = { ...row, contextWindow: e.target.value };
              setCustomRows((rows) => ({ ...rows, [selected]: next }));
            },
          }),
          React.createElement('input', {
            placeholder: t('maxTokens'),
            value: row.maxTokens,
            onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
              const next = [...(customRows[selected] ?? [])];
              next[rowIndex] = { ...row, maxTokens: e.target.value };
              setCustomRows((rows) => ({ ...rows, [selected]: next }));
            },
          }),
          React.createElement('button', { className: 'phub-btn', onClick: () => void saveCustomRow(rowIndex) }, t('save')),
          React.createElement('button', { className: 'phub-btn', onClick: () => void deleteCustomRow(row.id) }, t('delete')),
        )),
        React.createElement('div', { className: 'phub-actions' },
          React.createElement('button', { className: 'phub-btn', onClick: addCustomRow }, `+ ${t('addCustom')}`),
        ),
      ),
      React.createElement('div', { className: 'phub-preset', style: { marginTop: 12 } },
        React.createElement('span', { className: 'phub-hint' }, t('presetHint')),
        React.createElement('select', {
          value: presetProvider[selected] ?? '',
          onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void loadPresetModels(e.target.value),
        },
        React.createElement('option', { value: '' }, '—'),
        presetProviders.map((p) => React.createElement('option', { key: p.provider, value: p.provider }, `${p.displayName} (${p.provider})`)),
        ),
        React.createElement('select', {
          value: presetModel[selected] ?? '',
          disabled: (presetModels[selected] ?? []).length === 0,
          onChange: (e: React.ChangeEvent<HTMLSelectElement>) => setPresetModel((p) => ({ ...p, [selected]: e.target.value })),
        },
        React.createElement('option', { value: '' }, '—'),
        (presetModels[selected] ?? []).map((m) => React.createElement('option', { key: m.id, value: m.id }, m.name ?? m.id)),
        ),
        React.createElement('button', { className: 'phub-btn', disabled: (presetModel[selected] ?? '') === '', onClick: () => void importPreset() }, t('importPreset')),
      ),
      React.createElement('div', { className: 'phub-actions', style: { marginTop: 12 } },
        React.createElement('button', { className: 'phub-btn', disabled: busy, onClick: () => void runDiscover() }, t('discover')),
        React.createElement('span', { className: 'phub-hint' }, t('discoverHint')),
      ),
      React.createElement('div', { className: 'phub-actions', style: { marginTop: 8 } },
        React.createElement('button', { className: 'phub-btn', onClick: () => void snapshotCatalog() }, t('snapshot')),
        React.createElement('button', { className: 'phub-btn', onClick: () => void restoreCatalog() }, t('restore')),
        React.createElement('span', { className: 'phub-hint' }, t('snapshotHint')),
      ),
      discovered[selected] === null || discovered[selected] === undefined ? null : React.createElement('div', { className: 'phub-discover-list' },
        (discovered[selected] ?? []).map((model) => React.createElement('div', { className: 'phub-discover-item', key: model.id },
          React.createElement('span', null, `${model.id}${model.contextWindow !== undefined ? ` · ${model.contextWindow}` : ''}${model.maxTokens !== undefined ? ` / ${model.maxTokens}` : ''}`),
          React.createElement('button', { className: 'phub-btn', onClick: () => void enableDiscovered(model) }, t('enable')),
          React.createElement('button', { className: 'phub-btn', onClick: () => void adoptDiscovered(model) }, t('adopt')),
        )),
      ),
    ),
  );
}
