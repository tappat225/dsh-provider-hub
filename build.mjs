// Bundle both halves of dsh-provider-hub:
//   - host:  src/index.ts           -> lib/index.js  (ESM, node)
//   - client: src/client/static.tsx -> lib/client.js (ModuleLoader CJS, browser)
// @deepseek-ai/* and react stay external (the DSH profile / the renderer's
// client module-system seed table provide them at runtime).
import { build } from 'esbuild';

const host = await build({
  entryPoints: ['src/index.ts'],
  bundle: true,
  format: 'esm',
  platform: 'node',
  target: 'node22',
  outfile: 'lib/index.js',
  sourcemap: true,
  external: ['@deepseek-ai/*'],
  logLevel: 'info',
});

// The loader entry name MUST equal the npm package name (cordis.patch.yml
// `name`): the boot graph advertises the client bundle under
// /plugins/<name>/client.js. Kept in sync by test/plugin.test.mjs.
const CLIENT_LOADER_ID = '@tappat225/dsh-provider-hub';

const client = await build({
  // DSH's client module system (@deepseek-ai/dsh-client-modules) requires
  // every `dsh.client` bundle to register through
  // `window.__ModuleLoader__.load({ id, factory })`. The factory receives the
  // module system's require (seed words such as `react`) and must return the
  // plugin exports. Without this wrapper the web boot fails with "entries
  // did not activate" and Desktop enters recovery mode.
  //
  // The banner/footer wrap the whole CJS output inside the factory, so the
  // emitted `require("react")` calls resolve against the factory parameter
  // (no top-level require in the browser). `id` must equal the loader entry
  // name of the package (cordis.patch.yml `name`), the id the boot graph
  // advertises under /plugins/<id>/client.js.
  entryPoints: ['src/client/static.tsx'],
  bundle: true,
  format: 'cjs',
  platform: 'browser',
  target: ['es2020'],
  // Keep CJK characters readable in the bundle (default charset 'ascii'
  // would escape every non-ASCII char to \uXXXX and bloat the file).
  charset: 'utf8',
  jsxFactory: 'React.createElement',
  jsxFragment: 'React.Fragment',
  outfile: 'lib/client.js',
  sourcemap: true,
  external: ['@deepseek-ai/*', 'react'],
  banner: {
    js: `window.__ModuleLoader__.load({\n  id: ${JSON.stringify(CLIENT_LOADER_ID)},\n  factory: (require) => {\n    var module = { exports: {} };\n    var exports = module.exports;\n`,
  },
  footer: {
    js: `\n    return module.exports;\n  }\n});\n`,
  },
  logLevel: 'info',
});

console.log(`host: lib/index.js (${host.metafile !== undefined ? 'built' : 'built'}), client: lib/client.js`);
