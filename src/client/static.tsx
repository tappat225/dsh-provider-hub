/**
 * Provider Hub — client entry (static bundle → lib/client.js, ModuleLoader
 * format). Mounts the `providerHub` Remote namespace and registers the
 * settings page section.
 *
 * Every operation is defensive: the client half runs inside DSH's renderer,
 * where an uncaught error can block the startup handshake and push Desktop
 * into recovery mode. Nothing here may throw.
 *
 * @module dsh-provider-hub/client/static
 */
import type * as ReactTypes from 'react';
// Real value import: the DSH client module system resolves `react` through
// its platform seed table, so the built bundle calls require("react") and
// gets the renderer's React instance (no global dependency).
import React from 'react';
import { ProviderHubPage, css, zh, en, type Translate, type Call } from './page.tsx';
// Strict Typert invocation descriptors for the `providerHub` Remote; the
// client half mounts them through ctx.remote.$mount (same wire contract the
// host registers through ctx.typert.register).
import { INVOCATIONS } from '../host/contract.ts';

export const name = 'provider-hub';
/** Cordis service injections (official client-plugin pattern): wait for the
 *  slots (settings sections), locale and remote (Client Remote service from
 *  @deepseek-ai/dsh-api-gateway) services before activating, so
 *  `ctx.remote.$mount` is available at apply time. All three are built-in
 *  services every DSH profile provides. */
export const inject: string[] = ['slots', 'locale', 'remote'];

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
};

function adoptStyles(): void {
  try {
    if (typeof document === 'undefined') return;
    if (document.getElementById(STYLE_ID) !== null) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = css;
    document.head.appendChild(style);
  } catch {
    // style adoption is cosmetic; never let it break the renderer
  }
}

/** Safe translate fallback: never throws, always returns a string. */
function safeTranslate(locale: unknown, ns: string): Translate {
  try {
    if (locale !== null && typeof locale === 'object' && typeof (locale as { bind?: unknown }).bind === 'function') {
      const bound = (locale as { bind(ns: string): Translate }).bind(ns);
      if (typeof bound === 'function') return bound;
    }
  } catch {
    // fall through
  }
  return (key: string) => key;
}

/**
 * Render error boundary for the settings section. A renderer-side throw in
 * the page (e.g. a React hook-order violation) would otherwise blank the
 * whole settings panel with no feedback; this shows the message + a retry.
 * The class component only touches React, which is safe inside the renderer.
 */
class PageBoundary extends React.Component<{ children: ReactTypes.ReactNode }, { error: string | null }> {
  constructor(props: { children: ReactTypes.ReactNode }) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: unknown): { error: string } {
    return { error: error instanceof Error ? error.message : String(error) };
  }

  componentDidCatch(error: unknown): void {
    try {
      console.error('provider-hub settings page error', error);
    } catch {
      // console must never break the boundary
    }
  }

  render(): ReactTypes.ReactNode {
    if (this.state.error !== null) {
      return React.createElement('div', { className: 'phub-page' },
        React.createElement('p', { className: 'phub-intro' }, 'Provider Hub page crashed'),
        React.createElement('pre', { className: 'phub-error' }, this.state.error),
        React.createElement('button', {
          className: 'phub-btn',
          onClick: () => this.setState({ error: null }),
        }, '重试 / Retry'),
      );
    }
    return this.props.children;
  }
}

export function apply(ctx: any): void {
  try {
    // --- locale dictionaries (defensive) ---
    let locale: unknown;
    try {
      locale = (ctx?.get ?? (() => undefined))('locale') ?? ctx?.locale;
    } catch {
      locale = undefined;
    }
    const t: Translate = safeTranslate(locale, NS);
    if (locale !== undefined && locale !== null && typeof ctx?.effect === 'function') {
      try {
        const l = locale as { register?(ns: string, dicts: unknown): unknown };
        ctx.effect(() => l.register?.(NS, { zh, en }) ?? undefined, 'dsh-provider-hub: dictionaries');
      } catch {
        // registration failed; t falls back to identity
      }
    }
    adoptStyles();

    // --- Remote namespace (official client pattern: $mount + inject) ---
    // The host registers the `providerHub` Typert Remote (ctx.typert.register
    // in src/index.ts). The client half must mount the matching contribution
    // through the Client Remote service ($mount, provided by
    // @deepseek-ai/dsh-api-gateway) which installs a `remote.providerHub`
    // Cordis service; access it via ctx.inject(["remote.providerHub"]).
    // Method calls are transported over connection.rpc.call("/api", ...) and
    // return the transport envelope { ok, value } wrapping the business
    // envelope from the host runtime.
    let remote: any = null;
    let remoteError: string | undefined;
    const waitForRemote = async (): Promise<any> => {
      for (let i = 0; i < 100; i++) {
        if (remote !== null) return remote;
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      return null;
    };
    try {
      const remoteService: unknown = ctx?.remote;
      if (remoteService !== null && typeof remoteService === 'object' && typeof (remoteService as { $mount?: unknown }).$mount === 'function'
        && typeof ctx?.effect === 'function' && typeof ctx?.inject === 'function') {
        ctx.effect(() => {
          let cancelled = false;
          let unmount: (() => Promise<void>) | undefined;
          const contribution = { package: 'dsh-provider-hub', descriptors: INVOCATIONS };
          void (remoteService as { $mount(c: unknown): Promise<() => Promise<void>> }).$mount(contribution).then((dispose) => {
            if (cancelled) {
              void dispose();
              return;
            }
            unmount = dispose;
            ctx.inject(['remote.providerHub'], (nsCtx: any) => {
              remote = nsCtx?.remote?.providerHub ?? null;
            });
          }, (error: unknown) => {
            remoteError = error instanceof Error ? error.message : String(error);
          });
          return () => {
            cancelled = true;
            if (unmount !== undefined) void unmount();
          };
        }, 'dsh-provider-hub: remote mount');
      }
    } catch {
      remote = null;
    }

    /** Unwrap the transport + business envelopes. NEVER throws: a failed or
     *  unavailable remote returns `{ ok: false, error }` so React callers
     *  cannot crash the renderer with an unhandled rejection. */
    const call: Call = async (method, payload) => {
      try {
        const ns = await waitForRemote();
        if (ns === null) return { ok: false, error: remoteError ?? t('remotePending') };
        const remoteName = METHOD_MAP[method];
        if (remoteName === undefined) return { ok: false, error: `unknown method ${method}` };
        const args = (PARAM_ORDER[method] ?? []).map((key) => (payload ?? {})[key]);
        const r = await ns[remoteName](...args);
        const msgOf = (e: unknown): string =>
          typeof e === 'string' ? e : (e !== null && typeof e === 'object' && typeof (e as { message?: unknown }).message === 'string' ? (e as { message: string }).message : '');
        if (r === null || typeof r !== 'object' || (r as { ok?: unknown }).ok !== true) {
          return { ok: false, error: msgOf((r as { error?: unknown })?.error) || t('callFailed') };
        }
        // Transport envelope: { ok: true, value: <business envelope> }.
        const value = (r as { value?: unknown }).value;
        if (typeof value !== 'object' || value === null || (value as { ok?: unknown }).ok !== true) {
          return { ok: false, error: msgOf((value as { error?: unknown })?.error) || t('callFailed') };
        }
        return value as Record<string, unknown> & { ok: boolean };
      } catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : String(error) };
      }
    };

    // --- settings section slot (defensive, mirror official inject pattern) ---
    const slots = (ctx?.get ?? (() => undefined))('slots') ?? ctx?.slots;
    if (slots === undefined || typeof slots.inject !== 'function') return;
    try {
      slots.inject('settings.section', () => {
        try {
          return slots.register(
            { name: 'settings.section', id: SLOT_ID, order: SLOT_ORDER, label: () => t('nav') },
            () => React.createElement(PageBoundary, null, React.createElement(ProviderHubPage, { t, call })),
          );
        } catch {
          return undefined;
        }
      });
    } catch {
      // slot registration failed; nothing else to do
    }
  } catch {
    // last-resort: never let the client half break the renderer
  }
}
