/**
 * dsh-provider-hub wire contract: strict Typert invocation descriptors and
 * the host manifest for the `providerHub` Remote namespace.
 *
 * Shared by both halves: the client entry (src/client/static.tsx) imports
 * INVOCATIONS to `$mount` the namespace; the host entry registers the
 * TYPERT_MANIFEST through `ctx.typert.register`. Both get inlined by
 * esbuild into their respective bundles (lib/client.js / lib/index.js).
 *
 * Every business method answers `{ ok: true, ... }` or `{ ok: false, error }`.
 *
 * @module dsh-provider-hub/host/contract
 */

/** One strict codec: only `parse` is required by the typert boundary. */
const schema = (parse: (v: unknown) => unknown) => ({ parse });

const stringSchema = schema((v) => {
  if (typeof v !== 'string') throw new TypeError('expected a string');
  return v;
});
const booleanSchema = schema((v) => {
  if (typeof v !== 'boolean') throw new TypeError('expected a boolean');
  return v;
});
const numberSchema = schema((v) => {
  if (typeof v !== 'number' || !Number.isInteger(v)) throw new TypeError('expected an integer');
  return v;
});
const objectSchema = schema((v) => {
  if (v === null || typeof v !== 'object' || Array.isArray(v)) throw new TypeError('expected an object');
  return v;
});
const nullishObjectSchema = schema((v) => {
  if (v !== null && (typeof v !== 'object' || Array.isArray(v))) throw new TypeError('expected an object or null');
  return v;
});
const resultEnvelopeSchema = schema((v) => {
  if (v === null || typeof v !== 'object' || typeof (v as { ok?: unknown }).ok !== 'boolean') {
    throw new TypeError('expected an { ok, ... } envelope');
  }
  return v;
});

const codec = (name: string, sch: { parse: (v: unknown) => unknown }) => ({
  mode: 'strict',
  typeSymbol: `dsh-provider-hub#${name}`,
  schema: sch,
});

const stringParam = (name: string) => ({
  name,
  wire: name,
  source: 'json',
  codec: codec('String', stringSchema),
});
const booleanParam = (name: string) => ({
  name,
  wire: name,
  source: 'json',
  codec: codec('Boolean', booleanSchema),
});
const numberParam = (name: string) => ({
  name,
  wire: name,
  source: 'json',
  codec: codec('Number', numberSchema),
});
const objectParam = (name: string) => ({
  name,
  wire: name,
  source: 'json',
  codec: codec('Object', objectSchema),
});
const nullishObjectParam = (name: string) => ({
  name,
  wire: name,
  source: 'json',
  codec: codec('ObjectOrNull', nullishObjectSchema),
});

/** Wire method names — the client maps these to Remote handle methods. */
export const METHODS = {
  getState: 'get-state',
  addGateway: 'add-gateway',
  deleteGateway: 'delete-gateway',
  saveConfig: 'save-config',
  toggleBuiltin: 'toggle-builtin',
  saveOverrides: 'save-overrides',
  upsertCustom: 'upsert-custom',
  deleteCustom: 'delete-custom',
  discover: 'discover',
  enableDiscovered: 'enable-discovered',
} as const;

const invocation = (id: string, method: string, parameters: unknown[]) => ({
  id: `dsh-provider-hub#providerHub/${id}`,
  service: 'providerHub',
  namespace: 'providerHub',
  method,
  invocation: { kind: 'direct' },
  parameters,
  result: { mode: 'strict', typeSymbol: `dsh-provider-hub#${id}Result`, schema: resultEnvelopeSchema },
});

export const INVOCATIONS = [
  invocation('getState', 'getState', []),
  invocation('addGateway', 'addGateway', []),
  invocation('deleteGateway', 'deleteGateway', [numberParam('index')]),
  invocation('saveConfig', 'saveConfig', [numberParam('index'), objectParam('patch')]),
  invocation('toggleBuiltin', 'toggleBuiltin', [numberParam('index'), stringParam('id'), booleanParam('enabled')]),
  invocation('saveOverrides', 'saveOverrides', [numberParam('index'), objectParam('overrides')]),
  invocation('upsertCustom', 'upsertCustom', [numberParam('index'), objectParam('entry'), nullishObjectParam('originalId')]),
  invocation('deleteCustom', 'deleteCustom', [numberParam('index'), stringParam('id')]),
  invocation('discover', 'discover', [numberParam('index')]),
  invocation('enableDiscovered', 'enableDiscovered', [numberParam('index'), objectParam('model')]),
];

/** Host manifest registered through `ctx.typert.register`. */
export const TYPERT_MANIFEST = {
  package: 'dsh-provider-hub',
  face: 'host',
  schemas: [],
  model: {
    services: [
      {
        key: 'providerHub',
        exportName: 'ProviderHubRuntime',
        description: 'Manage the provider-hub gateways and their model catalogs: read/write the llm-provider-hub settings section, add/remove gateways, toggle built-in catalog models, edit overrides and custom models, import presets, and discover models from each gateway.',
        tags: [],
        members: [
          { kind: 'method', name: 'getState', signature: 'getState(): Promise<object>' },
          { kind: 'method', name: 'addGateway', signature: 'addGateway(): Promise<object>' },
          { kind: 'method', name: 'deleteGateway', signature: 'deleteGateway(index: number): Promise<object>' },
          { kind: 'method', name: 'saveConfig', signature: 'saveConfig(index: number, patch: object): Promise<object>' },
          { kind: 'method', name: 'toggleBuiltin', signature: 'toggleBuiltin(index: number, id: string, enabled: boolean): Promise<object>' },
          { kind: 'method', name: 'saveOverrides', signature: 'saveOverrides(index: number, overrides: object): Promise<object>' },
          { kind: 'method', name: 'upsertCustom', signature: 'upsertCustom(index: number, entry: object, originalId: object | null): Promise<object>' },
          { kind: 'method', name: 'deleteCustom', signature: 'deleteCustom(index: number, id: string): Promise<object>' },
          { kind: 'method', name: 'discover', signature: 'discover(index: number): Promise<object>' },
          { kind: 'method', name: 'enableDiscovered', signature: 'enableDiscovered(index: number, model: object): Promise<object>' },
        ],
        types: [],
      },
    ],
    events: [],
    objects: [],
  },
  invocations: INVOCATIONS,
};
