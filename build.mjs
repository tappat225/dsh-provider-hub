// Bundle both halves of dsh-provider-hub:
//   - host:  src/index.ts            -> lib/index.js  (ESM, node)
//   - client: src/client/static.tsx  -> lib/client.js (ModuleLoader CJS, browser)
// @deepseek-ai/* stays external (provided by the DSH profile at runtime).
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

const client = await build({
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
  external: ['@deepseek-ai/*'],
  logLevel: 'info',
});

console.log(`host: lib/index.js (${host.metafile !== undefined ? 'built' : 'built'}), client: lib/client.js`);
