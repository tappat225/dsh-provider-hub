// Render-smoke test for the Provider Hub settings page (src/client/page.tsx).
// The client-loader test only executes the module factory; this one executes
// the page component itself against a minimal React-hook shim and walks the
// produced element tree, guarding the card-dashboard structure:
//   1. the page renders without throwing (hooks called in a stable order);
//   2. the hero card, segmented tabs and provider-card grid exist;
//   3. the cc-switch-style editor renders headers/model key-value rows and
//      exactly ONE save button;
//   4. the model list ⇄ config-JSON contract (both directions): every row
//      reserves the complete parameter framework (null = unset, no catalog
//      leak); hand-typing a full catalog id does NOT auto-fill preset
//      params; clicking the id-input suggestion (or arrows + Enter) DOES;
//      hand-written JSON groups become rows and deleted groups drop them;
//      an invalid JSON text locks model-list edits;
//   5. the catalog tab renders one card per built-in preset.
// esbuild bundles the page alone; `react` aliases to test/helpers/react-shim.cjs
// and @deepseek-ai/dsh-client-ui-primitives is stubbed (host seed table at
// runtime). Assertion vocabulary comes from the real zh dictionary.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { build } from 'esbuild';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
let failures = 0;
function check(label, cond, detail = '') {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}${detail ? `  ${detail}` : ''}`);
  if (!cond) failures++;
}

const outfile = path.join(os.tmpdir(), `phub-page-smoke-${process.pid}.cjs`);
await build({
  entryPoints: ['src/client/page.tsx'],
  bundle: true,
  format: 'cjs',
  platform: 'node',
  target: 'node22',
  outfile,
  charset: 'utf8',
  logLevel: 'silent',
  // `react` stays external (exactly like lib/client.js): the sandbox require
  // hands the bundle the SAME shim instance this test drives, so hook state
  // (store + cursor) is shared between the harness and the page.
  external: ['@deepseek-ai/dsh-client-ui-primitives', 'react'],
});

const primitivesStub = {
  Button: () => null,
  Pill: () => null,
  StateDot: () => null,
  Menu: () => null,
  IconChevronDownOutline14: () => null,
  IconPlusOutline16: () => null,
  IconRefreshOutline16: () => null,
  IconTrashOutline16: () => null,
  IconLoadingOutline16: () => null,
};

const code = fs.readFileSync(outfile, 'utf8');
const sandboxModule = { exports: {} };
const shim = require('./helpers/react-shim.cjs');
vm.runInNewContext(code, {
  module: sandboxModule,
  require: (spec) => {
    if (spec === '@deepseek-ai/dsh-client-ui-primitives') return primitivesStub;
    if (spec === 'react') return shim;
    throw new Error(`unexpected require: ${spec}`);
  },
  console,
});
fs.rmSync(outfile, { force: true });

const page = sandboxModule.exports;
check('page module exports ProviderHubPage + dictionaries', typeof page.ProviderHubPage === 'function' && typeof page.zh === 'object');

const zh = page.zh;
const t = (key) => (Object.hasOwn(zh, key) ? zh[key] : key);

const gateway = {
  index: 0,
  gateway: {
    provider: 'test',
    displayName: 'Test GW',
    api: 'anthropic-messages',
    baseURL: 'https://upstream.test',
    endpointMode: 'auto',
    endpoint: '',
    userAgent: '',
    apiKey: '',
    apiKeyEnv: 'TEST_KEY',
    apiKeyConfigured: true,
    extraHeaders: { 'x-a': '1' },
    enabledModels: ['m-1', 'm-2', 'm-3', 'm-4', 'm-5', 'm-6'],
    modelOverrides: { 'm-1': { name: 'Model One' } },
    customModels: [],
  },
  models: [
    { id: 'm-1', name: 'Model One', contextWindow: 128000, maxTokens: 8192 },
    { id: 'm-2', name: 'Model Two' },
    { id: 'm-3', name: 'Model Three' },
    { id: 'm-4', name: 'Model Four' },
    { id: 'm-5', name: 'Model Five' },
    { id: 'm-6', name: 'Model Six' },
  ],
};
const catalog = {
  'm-1': { name: 'Model One', contextWindow: 128000, maxTokens: 8192 },
  'preset-2': {
    name: 'Preset Two', contextWindow: 200000, maxTokens: 8192, input: ['text', 'image'],
    reasoning: { low: 'low', high: 'high', max: 'max' },
  },
};

const calls = [];
const call = async (method, payload) => {
  calls.push({ method, payload });
  if (method === 'get-state') return { ok: true, gateways: [gateway], catalog };
  return { ok: true };
};

// ---- Element-tree helpers (shim element = { type, props, children }) ----
function walk(node, fn) {
  if (node === null || node === undefined || typeof node === 'boolean') return;
  if (Array.isArray(node)) {
    for (const child of node) walk(child, fn);
    return;
  }
  if (typeof node === 'object' && node.type !== undefined) {
    fn(node);
    walk(node.children, fn);
  }
}
function all(root, predicate) {
  const out = [];
  walk(root, (node) => { if (predicate(node)) out.push(node); });
  return out;
}
const byClass = (root, cls) => all(root, (n) => typeof n.props?.className === 'string' && n.props.className.split(/\s+/).includes(cls));
function textOf(node) {
  let out = '';
  const collect = (value) => {
    if (value === null || value === undefined || typeof value === 'boolean') return;
    if (typeof value === 'string' || typeof value === 'number') {
      out += String(value);
      return;
    }
    if (Array.isArray(value)) {
      for (const child of value) collect(child);
      return;
    }
    if (typeof value === 'object' && value.children !== undefined) collect(value.children);
  };
  collect(node?.children);
  return out;
}
const flush = () => new Promise((resolve) => setImmediate(resolve));

// ---- Mount: initial state is empty; the inline useEffect triggers get-state. ----
shim.__reset();
const render = () => {
  shim.__beginRender();
  return page.ProviderHubPage({ t, call });
};

let root = render();
await flush();
await flush();
root = render(); // re-render with refreshed state (gateways loaded)

check('hero card renders', byClass(root, 'phub-hero').length === 1);
check('hero shows provider/model/preset counts', textOf(all(root, (n) => n.props?.className === 'phub-heroMeta')[0]).includes(`1 ${zh.unitProviders}`));
check('segmented tabs render (providers + catalog)', byClass(root, 'phub-tab').length === 2);
check('provider card renders for the gateway', byClass(root, 'phub-card').length === 1);
check('card name = displayName', textOf(byClass(root, 'phub-cardName')[0]) === 'Test GW');
check('model chips capped at 5 (+N)', byClass(root, 'phub-chip').length === 6);
const chips = byClass(root, 'phub-chip').map((n) => textOf(n));
check('chip shows display name', chips.includes('Model One'), chips.join('|'));
check('overflow chip +1', chips.includes('+1'));
check('editor closed while no gateway selected', byClass(root, 'phub-editorCard').length === 0);

// ---- Open the editor via the card's 编辑 button. ----
const editButton = all(root, (n) => n.props?.variant === 'ghost' && textOf(n) === zh.edit);
check('card has an edit button', editButton.length === 1, `got ${editButton.length}`);
editButton[0].props.onClick();
root = render();

const kvRows = (cls) => all(root, (n) => typeof n.props?.className === 'string'
  && n.props.className.split(/\s+/).includes('phub-kvGrid')
  && n.props.className.split(/\s+/).includes(cls));
const firstInput = (rowNode) => {
  const inputs = [];
  walk(rowNode, (n) => { if (n.type === 'input') inputs.push(n); });
  return inputs[0];
};
const buttonByText = (label) => all(root, (n) => typeof n.props?.onClick === 'function' && textOf(n) === label);

check('editor card opens', byClass(root, 'phub-editorCard').length === 1);
check('editor renders a two-column form grid', byClass(root, 'phub-form').length === 1);
check('editor renders >= 8 labeled fields', byClass(root, 'phub-field').length >= 8, `got ${byClass(root, 'phub-field').length}`);

// ---- Display name DEFAULTS to the provider id: it follows provider edits
// until the user fills in a display name of their own ----
const formInputs = () => {
  const out = [];
  walk(byClass(root, 'phub-form')[0], (n) => { if (n.type === 'input') out.push(n); });
  return out;
};
let fi = formInputs();
check('form: provider input first, display-name second', fi[0]?.props?.value === 'test' && fi[1]?.props?.value === 'Test GW', `${fi[0]?.props?.value} / ${fi[1]?.props?.value}`);
// A display name the user filled in (≠ provider) survives a provider rename.
fi[0].props.onChange({ target: { value: 'renamed-gw' } });
root = render();
fi = formInputs();
check('customized display name preserved on provider rename', fi[0].props.value === 'renamed-gw' && fi[1].props.value === 'Test GW', `${fi[0].props.value} / ${fi[1].props.value}`);
// Clearing the display name (unset = default) makes it follow the provider id.
fi[1].props.onChange({ target: { value: '' } });
root = render();
fi = formInputs();
fi[0].props.onChange({ target: { value: 'follow-gw' } });
root = render();
fi = formInputs();
check('unset display name follows the provider id', fi[0].props.value === 'follow-gw' && fi[1].props.value === 'follow-gw', `${fi[0].props.value} / ${fi[1].props.value}`);
// A display name still equal to the previous provider id (the default add
// state) also follows renames.
fi[1].props.onChange({ target: { value: 'follow-gw' } });
root = render();
fi = formInputs();
fi[0].props.onChange({ target: { value: 'next-gw' } });
root = render();
fi = formInputs();
check('display name equal to the previous provider id follows renames', fi[0].props.value === 'next-gw' && fi[1].props.value === 'next-gw', `${fi[0].props.value} / ${fi[1].props.value}`);

// ---- Headers: key-value rows from saved extraHeaders ----
check('headers section renders the saved header as a row', kvRows('phub-kvHeaders').length === 1, `got ${kvRows('phub-kvHeaders').length}`);
const addHeaderButton = buttonByText(zh.addHeader);
check('add-header button renders', addHeaderButton.length === 1);
addHeaderButton[0].props.onClick();
root = render();
check('add-header appends an empty row', kvRows('phub-kvHeaders').length === 2);

// ---- Models: the brief list (id + display name rows) ----
check('model list renders one row per enabled model', kvRows('phub-kvModels').length === 6, `got ${kvRows('phub-kvModels').length}`);
check('exactly ONE save button exists', buttonByText(zh.save).length === 1, `got ${buttonByText(zh.save).length}`);
check('config JSON textarea renders', byClass(root, 'phub-textarea').length === 1);
const paramsTextarea = byClass(root, 'phub-textarea')[0];
// The framework is ALWAYS reserved: every model row carries its complete
// parameter framework with null = unset, and catalog values never leak in
// as real numbers (m-1's catalog contextWindow is 128000).
check('config JSON reserves the complete framework for every row (null = unset, no catalog leak)',
  paramsTextarea.props.value.includes('"m-1"')
    && paramsTextarea.props.value.includes('"name": "Model One"')
    && paramsTextarea.props.value.includes('"contextWindow": null')
    && paramsTextarea.props.value.includes('"maxTokens": null')
    && paramsTextarea.props.value.includes('"input": null')
    && paramsTextarea.props.value.includes('"reasoningEfforts": null')
    && !paramsTextarea.props.value.includes('128000'),
  JSON.stringify(paramsTextarea.props.value));

// ---- List ⇄ config-JSON sync: typing alone NEVER fills preset params ----
const addModelButton = buttonByText(zh.addModel);
check('add-model button renders', addModelButton.length === 1);
addModelButton[0].props.onClick();
root = render();
check('add-model appends an empty row', kvRows('phub-kvModels').length === 7);
const newRow = kvRows('phub-kvModels')[6];
// Type a FULL catalog id BY HAND: only the all-null framework is reserved —
// the preset values must NOT be auto-filled (the old exact-match seeding
// behavior is gone).
firstInput(newRow).props.onChange({ target: { value: 'preset-2' } });
root = render();
const typedTextarea = byClass(root, 'phub-textarea')[0];
check('typing a full catalog id reserves the framework but does NOT auto-fill preset params',
  typedTextarea.props.value.includes('"preset-2"')
    && typedTextarea.props.value.includes('"contextWindow": null')
    && !typedTextarea.props.value.includes('200000'),
  JSON.stringify(typedTextarea.props.value));
// The suggestion dropdown follows the typing from the first letter on.
const acItems = () => all(root, (n) => typeof n.props?.className === 'string' && n.props.className.split(/\s+/).includes('phub-acItem'));
check('id input opens the catalog suggestion dropdown while typing', acItems().length === 1 && textOf(acItems()[0]).includes('preset-2'), `got ${acItems().length}`);
// EXPLICIT pick (click) is what applies the preset parameters.
acItems()[0].props.onClick();
root = render();
const pickedTextarea = byClass(root, 'phub-textarea')[0];
check('clicking the suggestion seeds the full preset params',
  pickedTextarea.props.value.includes('"preset-2"')
    && pickedTextarea.props.value.includes('"contextWindow": 200000')
    && pickedTextarea.props.value.includes('"input"')
    && pickedTextarea.props.value.includes('"reasoningEfforts"')
    && pickedTextarea.props.value.includes('"max"')
    && pickedTextarea.props.value.includes('"name": "Preset Two"'),
  JSON.stringify(pickedTextarea.props.value));

// ---- JSON → list sync: hand-written groups become rows (skip the list) ----
const handJson = JSON.stringify({
  'm-1': { name: 'Model One', contextWindow: null, maxTokens: null, input: null, reasoningEfforts: null },
  'hand-written': { name: 'Hand Model', contextWindow: 123000, maxTokens: 4567 },
}, null, 2);
byClass(root, 'phub-textarea')[0].props.onChange({ target: { value: handJson } });
root = render();
const handRows = kvRows('phub-kvModels');
check('hand-written JSON groups rebuild the rows (name from the group; deleted groups vanish)',
  handRows.length === 2 && firstInput(handRows[1]).props.value === 'hand-written',
  `${handRows.length} rows`);
const handRow = handRows[1];
const nameInput = all(handRow, (n) => n.type === 'input')[1];
check('hand-written group name drives the display-name input', nameInput.props.value === 'Hand Model', nameInput.props.value);
// Removing a row drops its config-JSON group again.
const trash = [];
walk(handRow, (n) => { if (typeof n.props?.['aria-label'] === 'string' && n.props['aria-label'] === zh.remove) trash.push(n); });
check('model row carries a remove button', trash.length === 1);
trash[0].props.onClick();
root = render();
check('removing the row drops its config-JSON group',
  kvRows('phub-kvModels').length === 1 && !byClass(root, 'phub-textarea')[0].props.value.includes('hand-written'),
  byClass(root, 'phub-textarea')[0].props.value);

// ---- Invalid JSON text locks model-list edits (never clobbers the text) ----
byClass(root, 'phub-textarea')[0].props.onChange({ target: { value: '{"broken":' } });
root = render();
const lockedText = byClass(root, 'phub-textarea')[0].props.value;
const lockedRows = kvRows('phub-kvModels').length;
firstInput(kvRows('phub-kvModels')[0]).props.onChange({ target: { value: 'zzz' } });
root = render();
check('model-list edits are refused while the config JSON is invalid',
  byClass(root, 'phub-textarea')[0].props.value === lockedText
    && kvRows('phub-kvModels').length === lockedRows
    && firstInput(kvRows('phub-kvModels')[0]).props.value === 'm-1',
  'row edit should be a no-op');
check('a status flash explains the lock', byClass(root, 'phub-statusFlash-err').some((n) => textOf(n).includes(zh.fixJsonFirst)));
// A valid JSON re-unlocks the list; the rows rebuild from the keys ({} = none).
byClass(root, 'phub-textarea')[0].props.onChange({ target: { value: '{}' } });
root = render();
check('valid JSON re-unlocks the list (rows rebuild from keys)', kvRows('phub-kvModels').length === 0);

// ---- Keyboard pick (ArrowDown + Enter) is also an explicit selection. ----
buttonByText(zh.addModel)[0].props.onClick();
root = render();
firstInput(kvRows('phub-kvModels')[0]).props.onKeyDown({ key: 'ArrowDown', preventDefault: () => {} }); // closed: no-op
firstInput(kvRows('phub-kvModels')[0]).props.onChange({ target: { value: 'm-1' } });
root = render();
firstInput(kvRows('phub-kvModels')[0]).props.onKeyDown({ key: 'ArrowDown', preventDefault: () => {} });
root = render();
firstInput(kvRows('phub-kvModels')[0]).props.onKeyDown({ key: 'Enter', preventDefault: () => {} });
root = render();
const kbTextarea = byClass(root, 'phub-textarea')[0];
check('ArrowDown + Enter picks the highlighted suggestion (explicit keyboard pick)',
  kbTextarea.props.value.includes('"m-1"') && kbTextarea.props.value.includes('"contextWindow": 128000'),
  JSON.stringify(kbTextarea.props.value));

// ---- Switch to the catalog tab. ----
const catalogTab = byClass(root, 'phub-tab').find((n) => textOf(n).includes(zh.tabCatalog));
check('catalog tab present', catalogTab !== undefined);
catalogTab.props.onClick();
root = render();

check('catalog renders one card per preset', byClass(root, 'phub-card').length === Object.keys(catalog).length, `got ${byClass(root, 'phub-card').length}`);
check('catalog card shows preset name', byClass(root, 'phub-cardName').some((n) => textOf(n) === 'Preset Two'));
check('editor hidden on catalog tab', byClass(root, 'phub-editorCard').length === 0);

// ---- Host RPC surface still exercised exactly as before. ----
check('get-state was the only host call so far', calls.every((c) => c.method === 'get-state'));

if (failures > 0) process.exit(1);
console.log('\nclient page render verification OK');
