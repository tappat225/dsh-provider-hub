// Verify the client bundle (lib/client.js) conforms to DSH's client module
// system contract:
//   1. the bundle registers itself via window.__ModuleLoader__.load;
//   2. the registration id equals the loader entry name (dsh-provider-hub);
//   3. the factory resolves `react` through the module system's require and
//      returns { apply, inject, name };
//   4. apply() never throws on an empty/degraded ctx.
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
check('registration id = dsh-provider-hub (loader entry name)', registration.id === 'dsh-provider-hub', `got ${registration.id}`);
check('factory is a function', typeof registration.factory === 'function');

// Materialize: the module system's require answers seed words only.
const reactStub = { createElement: () => ({}), Fragment: Symbol('fragment') };
let exports;
try {
  exports = registration.factory((specifier) => {
    if (specifier === 'react') return reactStub;
    throw new Error(`unexpected require: ${specifier}`);
  });
  check('factory did not throw', true);
} catch (error) {
  check('factory did not throw', false, String(error));
}

if (exports !== undefined) {
  check('exports.apply is a function', typeof exports.apply === 'function');
  check('exports.inject is an array', Array.isArray(exports.inject));
  check('exports.name = provider-hub', exports.name === 'provider-hub');

  // apply() must never throw, even on a minimal ctx.
  try {
    const emptyCtx = { get: () => undefined, effect: () => () => undefined, remote: undefined };
    exports.apply(emptyCtx);
    check('apply() tolerates an empty ctx', true);
  } catch (error) {
    check('apply() tolerates an empty ctx', false, String(error));
  }

  // apply() must tolerate an unavailable "slots" service.
  try {
    const slotsCtx = { get: () => undefined, effect: () => () => undefined, remote: { providerHub: { getState: async () => ({ ok: true, gateways: [], catalog: {} }) } } };
    exports.apply(slotsCtx);
    check('apply() tolerates missing slots', true);
  } catch (error) {
    check('apply() tolerates missing slots', false, String(error));
  }
}

// The bundle must not reference any bare module besides the seed words.
const externalRequires = [...code.matchAll(/require\(\s*"([^"]+)"\s*\)/g)].map((m) => m[1]);
const unexpected = [...new Set(externalRequires)].filter((spec) => !['react'].includes(spec));
check('only seed-word requires remain', unexpected.length === 0, unexpected.join(', '));

if (failures > 0) process.exit(1);
console.log('\nclient loader verification OK');
