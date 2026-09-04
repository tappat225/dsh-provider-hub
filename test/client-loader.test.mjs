// Verify the client bundle (lib/client.js) conforms to DSH's client module
// system contract:
//   1. the bundle registers itself via window.__ModuleLoader__.load;
//   2. the registration id equals the loader entry name
//      (@tappat225/dsh-provider-hub = the package name);
//   3. the factory resolves `react` through the module system's require and
//      returns { apply, inject, name };
//   4. apply() never throws on an empty/degraded ctx;
//   5. apply() mounts a standalone workspace and does not require a settings slot.
//
// This is the regression guard for the recovery-mode bug: a bundle that does
// not register a factory makes the web boot fail with "entries did not
// activate" and pushes Desktop into recovery mode.
import fs from 'node:fs';
import vm from 'node:vm';

let failures = 0;
function check(label, cond, detail = '') {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}${detail ? `  ${detail}` : ''}`);
  if (!cond) failures++;
}

const code = fs.readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8');

// Simulate the HTML-installed loader facade in queue mode.
const registrations = [];
const window = {
  __ModuleLoader__: {
    mode: 'queue',
    pendingQueue: registrations,
    load(registration) {
      registrations.push(registration);
    },
  },
};
const sandbox = {
  window,
  console,
  // The factory body references module/exports (banner-provided) and nothing
  // else from the outer scope; provide document for style adoption.
  document: undefined,
};
vm.runInNewContext(code, sandbox);

check('bundle registered exactly once', registrations.length === 1, `got ${registrations.length}`);
if (registrations.length !== 1) process.exit(failures > 0 ? 1 : 0);

const registration = registrations[0];
check('registration id = @tappat225/dsh-provider-hub (loader entry name)', registration.id === '@tappat225/dsh-provider-hub', `got ${registration.id}`);
check('factory is a function', typeof registration.factory === 'function');

// Materialize: the module system's require answers seed words only.
// PageBoundary extends React.Component, so the stub carries a base class.
const reactStub = {
  createElement: () => ({}),
  Fragment: Symbol('fragment'),
  Component: class {
    constructor(props) { this.props = props ?? {}; this.state = null; }
    setState(patch) { this.state = { ...this.state, ...patch }; }
  },
};
// The renderer seed table provides dsh-client-ui-primitives (see
// dsh-web-frontend/dist/assets/index-*.js seed map); the page imports its
// Menu primitive + chevron icon. Stub both (the page component never renders
// inside this test, only the module factory runs).
const primitivesStub = { Menu: () => null, IconChevronDownOutline14: () => null };
const runtimeClientStub = { defineStore: () => ({}) };
let exports;
try {
  exports = registration.factory((specifier) => {
    if (specifier === 'react') return reactStub;
    if (specifier === '@deepseek-ai/dsh-client-ui-primitives') return primitivesStub;
    if (specifier === '@deepseek-ai/dsh-client-runtime/client') return runtimeClientStub;
    throw new Error(`unexpected require: ${specifier}`);
  });
  check('factory did not throw', true);
} catch (error) {
  check('factory did not throw', false, String(error));
}

if (exports !== undefined) {
  check('exports.apply is a function', typeof exports.apply === 'function');
  check('exports.inject is an array', Array.isArray(exports.inject));
  check('exports.inject includes sidebar slots', exports.inject.includes('slots'));

  // apply() must never throw, even on a minimal ctx.
  try {
    const emptyCtx = { get: () => undefined, effect: () => () => undefined, remote: undefined };
    exports.apply(emptyCtx);
    check('apply() tolerates an empty ctx', true);
  } catch (error) {
    check('apply() tolerates an empty ctx', false, String(error));
  }

  // apply() must mount the providerHub Remote and tolerate a missing slots.
  const mounts = [];
  const injected = [];
  let invokeTarget = null;
  const remoteMock = {
    async $mount(contribution) {
      mounts.push(contribution);
      return async () => {};
    },
  };
  const registeredSlots = [];
  const slotsMock = {
    inject(name, callback) { registeredSlots.push({ phase: 'inject', name }); callback(); },
    register(meta, component) { registeredSlots.push({ phase: 'register', meta, component }); return () => {}; },
  };
  const slotsCtx = {
    get: (name) => name === 'slots' ? slotsMock : undefined,
    effect: (fn) => fn(),
    inject(deps, callback) {
      injected.push(deps);
      if (deps[0] === 'remote.providerHub') {
        invokeTarget = callback;
        callback({ remote: { providerHub: { getState: async () => ({ ok: true, value: { ok: true, gateways: [], catalog: {} } }) } } });
      }
    },
    remote: remoteMock,
  };
  try {
    exports.apply(slotsCtx);
    check('apply() tolerates missing slots', true);
  } catch (error) {
    check('apply() tolerates missing slots', false, String(error));
  }
  await new Promise((resolve) => setTimeout(resolve, 20));
  check('registered model configuration launcher above settings', registeredSlots.some((item) => item.phase === 'register' && item.meta?.name === 'sidebar.footer.action' && item.meta?.id === 'model-config' && item.meta?.order === 10));
  check('registered model configuration shell overlay', registeredSlots.some((item) => item.phase === 'register' && item.meta?.name === 'shell.overlay' && item.meta?.id === 'model-config'));
  check('apply() mounted the providerHub contribution', mounts.length === 1, `got ${mounts.length}`);
  if (mounts.length === 1) {
    check('contribution package = @tappat225/dsh-provider-hub', mounts[0].package === '@tappat225/dsh-provider-hub');
    check('contribution carries providerHub descriptors', Array.isArray(mounts[0].descriptors) && mounts[0].descriptors.length > 0 && mounts[0].descriptors.every((d) => d.namespace === 'providerHub'), `descriptors=${mounts[0].descriptors?.length}`);
    check('descriptor for addGateway present', mounts[0].descriptors.some((d) => d.method === 'addGateway'));
    check('descriptors are strict (result mode strict)', mounts[0].descriptors.every((d) => d.result?.mode === 'strict' && d.invocation?.kind === 'direct'));
  }
  check('injected remote.providerHub', injected.some((deps) => deps[0] === 'remote.providerHub'));
  if (invokeTarget !== null) {
    try {
      invokeTarget({ remote: { providerHub: { getState: async () => ({ ok: true, value: { ok: true, gateways: [], catalog: {} } }) } } });
      check('inject callback resolves providerHub', true);
    } catch (error) {
      check('inject callback resolves providerHub', false, String(error));
    }
  }
}

// The bundle must not reference any bare module besides the seed words.
const externalRequires = [...code.matchAll(/require\(\s*"([^"]+)"\s*\)/g)].map((m) => m[1]);
const unexpected = [...new Set(externalRequires)].filter((spec) => !['react', '@deepseek-ai/dsh-client-runtime/client', '@deepseek-ai/dsh-client-ui-primitives'].includes(spec));
check('only seed-word requires remain', unexpected.length === 0, unexpected.join(', '));

if (failures > 0) process.exit(1);
console.log('\nclient loader verification OK');
