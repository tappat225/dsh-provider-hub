/**
 * Provider Hub — client entry (static bundle → lib/client.js, ModuleLoader
 * format). Mounts the `providerHub` Remote namespace and registers the
 * settings page section.
 *
 * @module dsh-provider-hub/client/static
 */
import type * as ReactTypes from 'react';
import { INVOCATIONS } from '../host/contract.ts';
import { ProviderHubPage, css, zh, en, type Translate, type Call } from './page.tsx';

// React is provided as a global by the DSH client runtime.
declare const React: typeof ReactTypes;

export const name = 'provider-hub';
export const inject = ['slots', 'remote', 'locale'];

const NS = 'settings.provider-hub';
const SLOT_ID = 'provider-hub-settings';
const SLOT_ORDER = 30;
const STYLE_ID = 'dsh-provider-hub-styles';

/** Wire method name → Remote handle method. */
const METHOD_MAP: Record<string, string> = {
  'get-state': 'getState',
  'add-gateway': 'addGateway',
  'delete-gateway': 'deleteGateway',
  'save-config': 'saveConfig',
  'toggle-builtin': 'toggleBuiltin',
  'save-overrides': 'saveOverrides',
  'upsert-custom': 'upsertCustom',
  'delete-custom': 'deleteCustom',
  'set-preset-from': 'setPresetFrom',
  'list-presets': 'listPresets',
  'preset-models': 'presetModels',
  'preset-model-info': 'presetModelInfo',
  'discover': 'discover',
  'enable-discovered': 'enableDiscovered',
  'snapshot-catalog': 'snapshotCatalog',
  'restore-catalog': 'restoreCatalog',
};

/** Wire method name → positional argument order on the Remote handle. */
const PARAM_ORDER: Record<string, string[]> = {
  'delete-gateway': ['index'],
  'save-config': ['index', 'patch'],
  'toggle-builtin': ['index', 'id', 'enabled'],
  'save-overrides': ['index', 'overrides'],
  'upsert-custom': ['index', 'entry', 'originalId'],
  'delete-custom': ['index', 'id'],
  'set-preset-from': ['index', 'preset'],
  'preset-models': ['provider'],
  'preset-model-info': ['provider', 'model'],
  'discover': ['index'],
  'enable-discovered': ['index', 'model'],
  'snapshot-catalog': ['index'],
  'restore-catalog': ['index'],
};

function adoptStyles(cssText: string): void {
  if (document.getElementById(STYLE_ID) !== null) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = cssText;
  document.head.appendChild(style);
}

export function apply(ctx: any): void {
  const locale = ctx.get('locale') ?? ctx.locale;
  if (locale !== undefined) {
    ctx.effect(() => locale.register(NS, { zh, en }), 'dsh-provider-hub: dictionaries');
  }
  const t: Translate = locale !== undefined ? locale.bind(NS) : (key: string) => key;
  adoptStyles(css);

  // Mount the providerHub Remote namespace, then resolve its handle through
  // the service store (ctx.reflect.get), not a dotted ctx read.
  let remote: any = null;
  ctx.effect(async () => {
    const dispose = await ctx.remote.$mount({ package: name, descriptors: INVOCATIONS });
    const handle = ctx.reflect.get('remote.providerHub');
    if (handle === undefined) {
      throw new Error('dsh-provider-hub: the providerHub Remote namespace did not mount');
    }
    remote = handle;
    return () => { remote = null; void dispose(); };
  }, 'dsh-provider-hub: remote');

  /** Unwrap the transport envelope, then the business envelope. */
  const call: Call = async (method, payload) => {
    if (remote === null) throw new Error(t('remotePending'));
    const remoteName = METHOD_MAP[method];
    const args = (PARAM_ORDER[method] ?? []).map((key) => (payload ?? {})[key]);
    const r = await remote[remoteName](...args);
    const msgOf = (e: unknown): string =>
      typeof e === 'string' ? e : (e !== null && typeof e === 'object' && typeof (e as { message?: unknown }).message === 'string' ? (e as { message: string }).message : '');
    if (r === null || typeof r !== 'object' || (r as { ok?: unknown }).ok !== true) {
      throw new Error(msgOf((r as { error?: unknown })?.error) || t('callFailed'));
    }
    const value = (r as { value?: unknown }).value;
    if (value !== null && typeof value === 'object' && (value as { ok?: unknown }).ok === true) return value as Record<string, unknown> & { ok: boolean };
    throw new Error(msgOf((value as { error?: unknown } | null | undefined)?.error) || t('callFailed'));
  };

  const slots = ctx.get('slots') ?? ctx.slots;
  if (slots === undefined) return;
  slots.inject('settings.section', () => slots.register(
    { name: 'settings.section', id: SLOT_ID, order: SLOT_ORDER, label: () => t('nav') },
    () => React.createElement(ProviderHubPage, { t, call }),
  ));
}
