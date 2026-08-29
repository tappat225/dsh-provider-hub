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

export const name = 'provider-hub';
/** No hard inject: every dependency is acquired defensively at apply time. */
export const inject: string[] = [];

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

    // --- Remote namespace (defensive) ---
    // The host registers the `providerHub` Remote through typert; the client
    // runtime exposes it as `ctx.remote.providerHub` (a generated proxy).
    // There is NO `$mount` on the client remote service — calling it throws.
    let remote: any = null;
    const tryGetRemote = (): any => {
      try {
        const r = ctx?.remote;
        if (r === null || typeof r !== 'object') return null;
        return r.providerHub ?? null;
      } catch {
        return null;
      }
    };
    remote = tryGetRemote();
    if (remote === null && typeof ctx?.effect === 'function') {
      try {
        // The Remote proxy may appear after the host manifest registers;
        // retry briefly (a few ticks) without ever throwing.
        ctx.effect(async () => {
          try {
            for (let i = 0; i < 50; i++) {
              const hit = tryGetRemote();
              if (hit !== null) {
                remote = hit;
                return;
              }
              await new Promise((resolve) => setTimeout(resolve, 50));
            }
          } catch {
            remote = null;
          }
        }, 'dsh-provider-hub: remote wait');
      } catch {
        remote = null;
      }
    }

    /** Unwrap the business envelope. NEVER throws: a failed/unavailable
     *  remote returns `{ ok: false, error }` so React callers cannot crash
     *  the renderer with an unhandled rejection. */
    const call: Call = async (method, payload) => {
      try {
        if (remote === null) return { ok: false, error: t('remotePending') };
        const remoteName = METHOD_MAP[method];
        if (remoteName === undefined) return { ok: false, error: `unknown method ${method}` };
        const args = (PARAM_ORDER[method] ?? []).map((key) => (payload ?? {})[key]);
        const r = await remote[remoteName](...args);
        const msgOf = (e: unknown): string =>
          typeof e === 'string' ? e : (e !== null && typeof e === 'object' && typeof (e as { message?: unknown }).message === 'string' ? (e as { message: string }).message : '');
        if (r === null || typeof r !== 'object' || (r as { ok?: unknown }).ok !== true) {
          return { ok: false, error: msgOf((r as { error?: unknown })?.error) || t('callFailed') };
        }
        return r as Record<string, unknown> & { ok: boolean };
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
            () => React.createElement(ProviderHubPage, { t, call }),
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
