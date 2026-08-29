window.__ModuleLoader__.load({
  id: "dsh-provider-hub",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;

"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name2 in all)
    __defProp(target, name2, { get: all[name2], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/client/static.tsx
var static_exports = {};
__export(static_exports, {
  apply: () => apply,
  inject: () => inject,
  name: () => name
});
module.exports = __toCommonJS(static_exports);
var import_react2 = __toESM(require("react"), 1);

// src/client/page.tsx
var import_react = __toESM(require("react"), 1);
var import_dsh_client_ui_primitives = require("@deepseek-ai/dsh-client-ui-primitives");

// src/client/page.css.ts
var page_css_default = `
.phub-page { max-width: 760px; padding: 4px 2px 32px; display: flex; flex-direction: column; gap: 22px; }
.phub-intro { margin: 0; padding: 0 2px; font-size: 13px; line-height: 20px; color: var(--dsw-alias-label-tertiary); }

.phub-group-heading { display: flex; align-items: baseline; gap: 7px; padding: 0 2px 8px; font-size: 13px; line-height: 20px; font-weight: 600; color: var(--dsw-alias-label-primary); }
.phub-count { padding: 1px 8px; border-radius: 999px; background: var(--dsw-alias-accent-soft, var(--dsw-alias-bg-layer-2)); font-size: 11px; line-height: 16px; font-weight: 500; color: var(--dsw-alias-label-secondary); font-variant-numeric: tabular-nums; }

.phub-group { display: flex; flex-direction: column; padding: 4px 20px 16px; box-sizing: border-box; border: 1px solid var(--dsw-alias-border-l2); border-radius: 16px; background: var(--dsw-alias-bg-layer-3); }

/* Row recipe: title/desc left, control right, hairline separators. */
.phub-row { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 12px 8px; border-bottom: 1px solid var(--dsw-alias-border-l2); min-height: 40px; border-radius: 8px; }
.phub-row:last-child { border-bottom: none; }
.phub-clickable { cursor: pointer; }
.phub-clickable:hover { background: var(--dsw-alias-interactive-bg-hover); }
.phub-row-selected { background: var(--dsw-alias-interactive-bg-active); border-bottom-color: transparent; }
.phub-rowText { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.phub-rowTitle { font-size: 14px; line-height: 22px; color: var(--dsw-alias-label-primary); }
.phub-rowDesc { font-size: 12px; line-height: 18px; color: var(--dsw-alias-label-tertiary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 460px; }
.phub-control { flex: none; display: flex; align-items: center; gap: 8px; }

/* Icon chip: 28px, rounded 8, layer-2 fill + hairline. */
.phub-icon-chip { display: inline-flex; align-items: center; justify-content: center; flex: none; width: 28px; height: 28px; border-radius: 8px; border: 1px solid var(--dsw-alias-border-l2); background: var(--dsw-alias-bg-layer-2); font-size: 12px; font-weight: 600; color: var(--dsw-alias-label-secondary); text-transform: uppercase; }

/* Custom switch: hidden native checkbox driving a 36x20 track + 14px thumb. */
.phub-switch { position: relative; display: inline-flex; flex: none; cursor: pointer; }
.phub-switch-input { position: absolute; width: 1px; height: 1px; margin: 0; opacity: 0; }
.phub-switch-track { display: inline-flex; align-items: center; width: 36px; height: 20px; padding: 2px; box-sizing: border-box; border-radius: 10px; border: 1px solid var(--dsw-alias-border-l2); background: var(--dsw-alias-bg-layer-2); transition: background 0.15s ease, border-color 0.15s ease; }
.phub-switch-thumb { display: block; width: 14px; height: 14px; border-radius: 50%; background: var(--dsw-alias-label-tertiary); transition: transform 0.15s ease, background 0.15s ease; }
.phub-switch:hover .phub-switch-track { border-color: var(--dsw-alias-label-dimmed); }
.phub-switch-input:checked + .phub-switch-track { border-color: var(--dsw-alias-button-primary-fill); background: var(--dsw-alias-button-primary-fill); }
.phub-switch-input:checked + .phub-switch-track .phub-switch-thumb { transform: translateX(16px); background: var(--dsw-alias-bg-layer-3); }
.phub-switch-input:disabled + .phub-switch-track { opacity: 0.5; cursor: default; }
.phub-switch-input:focus-visible + .phub-switch-track { outline: 2px solid var(--dsw-alias-state-business-primary); outline-offset: 2px; }

/* Inputs / selects / textareas. */
.phub-input { height: 32px; padding: 0 10px; border: 1px solid var(--dsw-alias-border-l2); border-radius: 8px; background: var(--dsw-alias-bg-layer-2); color: var(--dsw-alias-label-primary); font: inherit; box-sizing: border-box; min-width: 220px; }
.phub-input:focus { outline: none; border-color: var(--dsw-alias-state-business-primary); }
/* Dropdown anchor (primitives Menu trigger): looks like an input, acts like
   a button. The popup itself is the platform Menu (dark theme, check mark). */
.phub-select-anchor { display: inline-flex; align-items: center; gap: 6px; height: 32px; min-width: 160px; max-width: 260px; padding: 0 10px; box-sizing: border-box; border: 1px solid var(--dsw-alias-border-l2); border-radius: 8px; background: var(--dsw-alias-bg-layer-2); color: var(--dsw-alias-label-primary); font: inherit; font-size: 13px; line-height: 20px; cursor: pointer; transition: border-color 0.12s ease; }
.phub-select-anchor:hover:not(:disabled) { border-color: var(--dsw-alias-label-dimmed); }
.phub-select-anchor:disabled { opacity: 0.5; cursor: default; }
.phub-select-anchor-text { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; text-align: left; }
.phub-select-anchor:focus-visible { outline: 2px solid var(--dsw-alias-state-business-primary); outline-offset: 2px; }
.phub-textarea { width: 100%; min-height: 72px; padding: 8px 10px; border: 1px solid var(--dsw-alias-border-l2); border-radius: 8px; background: var(--dsw-alias-bg-layer-2); color: var(--dsw-alias-label-primary); font: 12px/1.5 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; box-sizing: border-box; resize: vertical; }
.phub-textarea:focus { outline: none; border-color: var(--dsw-alias-state-business-primary); }

/* Buttons: neutral chrome; hover lifts via interactive fill. */
.phub-btn { height: 32px; padding: 0 14px; border: 1px solid var(--dsw-alias-border-l2); border-radius: 8px; background: var(--dsw-alias-bg-layer-2); color: var(--dsw-alias-label-primary); font: inherit; cursor: pointer; transition: background 0.12s ease, border-color 0.12s ease, color 0.12s ease; }
.phub-btn:hover:not(:disabled) { background: var(--dsw-alias-interactive-bg-hover-accent); border-color: var(--dsw-alias-interactive-bg-hover-accent); color: var(--dsw-alias-brand-primary); }
.phub-btn:disabled { opacity: 0.5; cursor: default; }
.phub-btn-danger:hover:not(:disabled) { color: #e06c75; border-color: #e06c75; background: var(--dsw-alias-interactive-bg-hover); }

/* Dashed add card (the DSH "add plugin" card recipe). */
.phub-add-card { margin-top: 12px; display: flex; align-items: center; justify-content: center; gap: 8px; min-height: 48px; border: 1px dashed var(--dsw-alias-border-l2); border-radius: 12px; background: transparent; color: var(--dsw-alias-label-secondary); font: inherit; cursor: pointer; transition: background 0.12s ease, border-color 0.12s ease, color 0.12s ease; }
.phub-add-card:hover { border-color: var(--dsw-alias-label-dimmed); background: var(--dsw-alias-interactive-bg-hover); color: var(--dsw-alias-label-primary); }

/* Empty state. */
.phub-empty { display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 26px 12px 8px; text-align: center; }
.phub-empty-title { font-size: 14px; line-height: 22px; color: var(--dsw-alias-label-secondary); }
.phub-empty-desc { font-size: 12px; line-height: 18px; color: var(--dsw-alias-label-tertiary); max-width: 440px; }

/* Status line. */
.phub-status { font-size: 12px; line-height: 18px; }
.phub-status-ok { color: #98c379; }
.phub-status-err { color: #e06c75; }

/* Error-boundary fallback. */
.phub-error { margin: 0; padding: 10px 12px; border: 1px solid var(--dsw-alias-border-l2); border-radius: 8px; background: var(--dsw-alias-bg-layer-2); color: var(--dsw-alias-label-secondary); font: 12px/1.6 ui-monospace, monospace; white-space: pre-wrap; word-break: break-word; }

/* Editor internals. */
.phub-editor-note { font-size: 12px; line-height: 18px; color: var(--dsw-alias-label-tertiary); padding: 0 8px; }
.phub-actions { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; padding: 10px 8px 0; }
.phub-models-list { display: flex; flex-direction: column; }
.phub-model-params { font-variant-numeric: tabular-nums; font-size: 11px; line-height: 16px; color: var(--dsw-alias-label-tertiary); }
.phub-custom-item { display: grid; grid-template-columns: 1.3fr 1fr 0.8fr 0.8fr auto; gap: 6px; padding: 6px 8px 0; align-items: center; }
.phub-custom-item .phub-input { min-width: 0; width: 100%; }
.phub-custom-item .phub-input:disabled { opacity: 0.65; }
.phub-form-buttons { display: inline-flex; gap: 6px; align-items: center; }

/* Contextual "use preset parameters" offer (pill button, brand tinted). */
.phub-suggest { height: 28px; padding: 0 12px; border: 1px solid var(--dsw-alias-border-l2); border-radius: 999px; background: transparent; color: var(--dsw-alias-brand-primary); font: inherit; font-size: 12px; line-height: 18px; cursor: pointer; transition: border-color 0.12s ease, background 0.12s ease; }
.phub-suggest:hover { border-color: var(--dsw-alias-brand-primary); background: var(--dsw-alias-interactive-bg-hover); }

/* Sub-section heading inside a group card (enabled / add / overrides). */
.phub-subhead { display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap; padding: 14px 8px 6px; }
.phub-subhead:first-child { padding-top: 8px; }
.phub-subhead-title { font-size: 12px; line-height: 18px; font-weight: 600; color: var(--dsw-alias-label-secondary); }
.phub-subhead-hint { font-size: 12px; line-height: 18px; color: var(--dsw-alias-label-tertiary); }

/* Stacked field: label above a full-width control. JSON editors use this —
   a narrow right-hand box makes JSON unreadable. */
.phub-stack { display: flex; flex-direction: column; gap: 8px; padding: 12px 8px; }
.phub-stack-label { font-size: 14px; line-height: 22px; color: var(--dsw-alias-label-primary); }
.phub-stack-foot { display: flex; justify-content: flex-end; }

/* Connection-test banner (green ok / red fail, sample ids in mono). */
.phub-test-result { display: flex; flex-direction: column; gap: 3px; margin: 10px 8px 0; padding: 10px 12px; box-sizing: border-box; border: 1px solid; border-radius: 10px; font-size: 12px; line-height: 18px; }
.phub-test-ok { border-color: rgba(152, 195, 121, 0.45); background: rgba(152, 195, 121, 0.08); color: #98c379; }
.phub-test-err { border-color: rgba(224, 108, 117, 0.45); background: rgba(224, 108, 117, 0.08); color: #e06c75; }
.phub-test-detail { color: var(--dsw-alias-label-secondary); font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; word-break: break-all; }
`;

// src/client/locales.ts
var zh = {
  nav: "Provider Hub",
  intro: "统一管理网关路由、模型目录与模型发现；所有改动即时生效，无需手改 settings.yaml。",
  gateways: "网关列表",
  addGateway: "添加网关",
  gateway: "网关设置",
  emptyTitle: "还没有网关",
  emptyHint: "添加一个网关路由，配置上游端点后即可在 DSH 模型选择器中使用其模型。",
  providerName: "路由名",
  providerNameHint: "改动需重启",
  displayName: "显示名",
  baseURL: "上游地址",
  baseURLHint: "末尾带不带 /v1 均可，自动适配",
  baseURLPlaceholder: "https://api.example.com",
  api: "协议",
  userAgent: "User-Agent",
  apiKey: "API Key",
  apiKeyEnv: "Key 环境变量",
  apiKeyHint: "字面量优先于环境变量",
  extraHeaders: "附加请求头",
  anthropicThinking: "Anthropic thinking 透传（reasoningEffort → thinking.budget_tokens）",
  save: "保存",
  saved: "已保存",
  saveFailed: "保存失败",
  testConnection: "测试连接",
  testOk: "连接成功",
  testFailed: "连接失败",
  testModels: "个模型",
  testSeeded: "已填充下方模型下拉",
  models: "模型管理",
  modelsEnabled: "已启用的模型",
  modelsEmptyHint: "还没有启用模型——拉取上游模型列表，或手动添加。",
  addModel: "添加模型",
  addModelHint: "手动输入 ID 或从拉取列表选择；命中内置目录时可一键套用预设参数。",
  fetchedModels: "拉取到的模型",
  discoverRun: "拉取模型列表",
  presetApply: "使用预设参数",
  edit: "编辑",
  update: "更新",
  cancel: "取消",
  remove: "移除",
  overrides: "参数覆盖（可选）",
  overridesHint: "按模型 id 覆盖内置参数",
  custom: "自定义模型",
  addCustom: "添加",
  delete: "删除",
  modelId: "模型 ID",
  modelName: "显示名",
  contextWindow: "上下文",
  maxTokens: "最大输出",
  alreadyEnabled: "已启用",
  enable: "一键启用",
  required: "必填",
  remotePending: "远程服务尚未就绪",
  callFailed: "调用失败"
};
var en = {
  nav: "Provider Hub",
  intro: "Manage gateway routes, model catalogs and model discovery. Every change applies live — no hand-editing settings.yaml.",
  gateways: "Gateways",
  addGateway: "Add gateway",
  gateway: "Gateway",
  emptyTitle: "No gateways yet",
  emptyHint: "Add a gateway route, point it at an upstream endpoint, and its models become available in the DSH model picker.",
  providerName: "Route name",
  providerNameHint: "change requires restart",
  displayName: "Display name",
  baseURL: "Base URL",
  baseURLHint: "with or without a trailing /v1 — both work",
  baseURLPlaceholder: "https://api.example.com",
  api: "Protocol",
  userAgent: "User-Agent",
  apiKey: "API Key",
  apiKeyEnv: "Key env var",
  apiKeyHint: "literal takes precedence over env",
  extraHeaders: "Extra headers",
  anthropicThinking: "Forward reasoningEffort as Anthropic thinking (budget_tokens)",
  save: "Save",
  saved: "Saved",
  saveFailed: "Save failed",
  testConnection: "Test connection",
  testOk: "Connection OK",
  testFailed: "Connection failed",
  testModels: "models",
  testSeeded: "listed in the dropdown below",
  models: "Models",
  modelsEnabled: "Enabled models",
  modelsEmptyHint: "No models yet — fetch the upstream listing, or add one by hand.",
  addModel: "Add model",
  addModelHint: "Type an id or pick from the fetched listing; an id matching the built-in catalog offers one-click preset parameters.",
  fetchedModels: "Fetched models",
  discoverRun: "Fetch model list",
  presetApply: "Use preset",
  edit: "Edit",
  update: "Update",
  cancel: "Cancel",
  remove: "Remove",
  overrides: "Overrides (optional)",
  overridesHint: "field-level override per model id",
  custom: "Custom models",
  addCustom: "Add",
  delete: "Delete",
  modelId: "Model ID",
  modelName: "Name",
  contextWindow: "Context",
  maxTokens: "Max output",
  alreadyEnabled: "enabled",
  enable: "Enable",
  required: "required",
  remotePending: "remote service not ready yet",
  callFailed: "call failed"
};

// src/client/page.tsx
function tokenize(value) {
  return value.toLowerCase().split(/[^a-z0-9]+/).filter((token) => token.length > 0);
}
function sharedTokenRun(a, b) {
  let best = 0;
  for (let i = 0; i < a.length; i++) {
    for (let j = 0; j < b.length; j++) {
      let run = 0;
      while (i + run < a.length && j + run < b.length && a[i + run] === b[j + run]) run++;
      if (run > best) best = run;
    }
  }
  return best;
}
function matchCatalog(id, catalog) {
  const key = id.trim().toLowerCase();
  if (key === "") return void 0;
  if (catalog[key] !== void 0) return key;
  const keyTokens = tokenize(key);
  let best;
  let bestScore = 0;
  for (const catId of Object.keys(catalog)) {
    const lower = catId.toLowerCase();
    let score = 0;
    if (key.startsWith(lower)) score = 2 + lower.length;
    else if (lower.startsWith(key) && key.length >= 5) score = 1 + key.length;
    else {
      const catTokens = tokenize(catId);
      const run = sharedTokenRun(keyTokens, catTokens);
      if (run >= 2 && run / catTokens.length >= 0.5) score = 1 + run;
    }
    if (score > bestScore) {
      bestScore = score;
      best = catId;
    }
  }
  return best;
}
function overrideMapWith(entry, id, name2, ctx, max) {
  const overrides = { ...entry.gateway.modelOverrides ?? {} };
  const next = {};
  if (name2 !== "") next.name = name2;
  if (ctx !== "" && Number(ctx) > 0) next.contextWindow = Number(ctx);
  if (max !== "" && Number(max) > 0) next.maxTokens = Number(max);
  if (Object.keys(next).length === 0) delete overrides[id];
  else overrides[id] = next;
  return overrides;
}
function Row(props) {
  const cls = ["phub-row"];
  if (props.onClick !== void 0) cls.push("phub-clickable");
  if (props.selected === true) cls.push("phub-row-selected");
  if (props.className !== void 0) cls.push(props.className);
  return import_react.default.createElement(
    "div",
    { key: props.key, className: cls.join(" "), onClick: props.onClick },
    import_react.default.createElement(
      "div",
      { className: "phub-rowText" },
      import_react.default.createElement("span", { className: "phub-rowTitle" }, props.title),
      props.desc === void 0 ? null : import_react.default.createElement("span", { className: "phub-rowDesc" }, props.desc)
    ),
    props.control === void 0 ? null : import_react.default.createElement("span", { className: "phub-control" }, props.control)
  );
}
function SwitchUI(props) {
  return import_react.default.createElement(
    "label",
    { className: "phub-switch" },
    import_react.default.createElement("input", {
      type: "checkbox",
      className: "phub-switch-input",
      checked: props.checked,
      disabled: props.disabled === true,
      onChange: (e) => props.onChange(e.target.checked)
    }),
    import_react.default.createElement(
      "span",
      { className: "phub-switch-track" },
      import_react.default.createElement("span", { className: "phub-switch-thumb" })
    )
  );
}
function ChipUI(props) {
  const ch = (props.text || "?").charAt(0);
  return import_react.default.createElement("span", { className: "phub-icon-chip" }, ch);
}
function SubHead(title, hint) {
  return import_react.default.createElement(
    "div",
    { className: "phub-subhead" },
    import_react.default.createElement("span", { className: "phub-subhead-title" }, title),
    hint === void 0 ? null : import_react.default.createElement("span", { className: "phub-subhead-hint" }, hint)
  );
}
function SelectMenu(props) {
  const [open, setOpen] = import_react.default.useState(false);
  const selected = props.options.find((o) => o.value === props.value);
  const anchor = import_react.default.createElement(
    "button",
    {
      type: "button",
      className: "phub-select-anchor",
      disabled: props.disabled === true,
      "aria-haspopup": "listbox",
      "aria-expanded": open,
      "aria-label": props.label,
      onClick: () => setOpen((now) => !now)
    },
    import_react.default.createElement("span", { className: "phub-select-anchor-text" }, selected?.title ?? (props.value.length > 0 ? props.value : "—")),
    import_react.default.createElement(import_dsh_client_ui_primitives.IconChevronDownOutline14, { size: 12 })
  );
  return import_react.default.createElement(import_dsh_client_ui_primitives.Menu, {
    open,
    anchor,
    items: props.options.map((o) => ({ id: o.value, label: o.title })),
    selectedId: props.value,
    onSelect: (id) => {
      props.onChange(id);
      setOpen(false);
    },
    onClose: () => setOpen(false),
    portal: true
  });
}
function ProviderHubPage(props) {
  const { t, call } = props;
  const [state, setState] = import_react.default.useState({ gateways: [], catalog: {}, selected: null });
  const [status, setStatus] = import_react.default.useState(null);
  const [busy, setBusy] = import_react.default.useState(false);
  const [addModelDraft, setAddModelDraft] = import_react.default.useState(
    { id: "", name: "", contextWindow: "", maxTokens: "" }
  );
  const [fetchedPick, setFetchedPick] = import_react.default.useState("");
  const [editing, setEditing] = import_react.default.useState(null);
  const [overridesText, setOverridesText] = import_react.default.useState({});
  const [headersText, setHeadersText] = import_react.default.useState({});
  const [discovered, setDiscovered] = import_react.default.useState({});
  const [testing, setTesting] = import_react.default.useState(false);
  const [discovering, setDiscovering] = import_react.default.useState(false);
  const [testResult, setTestResult] = import_react.default.useState({});
  const refresh = import_react.default.useCallback(async () => {
    try {
      const r = await call("get-state");
      if (!r.ok) {
        setStatus({ kind: "err", text: String(r.error ?? "getState failed") });
        return;
      }
      const value = r;
      setState((s) => ({ ...s, gateways: value.gateways, catalog: value.catalog }));
      const nextOverrides = {};
      const nextHeaders = {};
      for (const g of value.gateways) {
        nextOverrides[g.index] = JSON.stringify(g.gateway.modelOverrides ?? {}, null, 2);
        nextHeaders[g.index] = JSON.stringify(g.gateway.extraHeaders ?? {}, null, 2);
      }
      setOverridesText(nextOverrides);
      setHeadersText(nextHeaders);
    } catch {
      setStatus({ kind: "err", text: t("remotePending") });
    }
  }, [call, t]);
  import_react.default.useEffect(() => {
    void refresh();
  }, [refresh]);
  const save = async (success = t("saved")) => {
    setBusy(true);
    try {
      const selected2 = state.selected;
      if (selected2 === null) return false;
      const entry = state.gateways.find((g) => g.index === selected2);
      if (entry === void 0) return false;
      const patch = {
        provider: entry.gateway.provider,
        displayName: entry.gateway.displayName,
        baseURL: entry.gateway.baseURL,
        api: entry.gateway.api,
        userAgent: entry.gateway.userAgent,
        apiKey: entry.gateway.apiKey,
        apiKeyEnv: entry.gateway.apiKeyEnv,
        systemRole: entry.gateway.systemRole,
        anthropicThinking: Boolean(entry.gateway.anthropicThinking)
      };
      try {
        patch.extraHeaders = JSON.parse(headersText[selected2] || "{}");
      } catch {
        setStatus({ kind: "err", text: "extraHeaders: invalid JSON" });
        return false;
      }
      const r = await call("save-config", { index: selected2, patch });
      if (!r.ok) {
        setStatus({ kind: "err", text: `${t("saveFailed")}: ${String(r.error ?? "")}` });
        return false;
      }
      setStatus({ kind: "ok", text: success });
      void refresh();
      return true;
    } finally {
      setBusy(false);
    }
  };
  const setField = (key, value) => {
    const selected2 = state.selected;
    if (selected2 === null) return;
    setState((s) => ({
      ...s,
      gateways: s.gateways.map((g) => g.index === selected2 ? { ...g, gateway: { ...g.gateway, [key]: value } } : g)
    }));
    setTestResult((tr) => tr[selected2] === void 0 || tr[selected2] === null ? tr : { ...tr, [selected2]: null });
  };
  const clearTestResult = () => {
    const selected2 = state.selected;
    if (selected2 === null) return;
    setTestResult((tr) => tr[selected2] === void 0 || tr[selected2] === null ? tr : { ...tr, [selected2]: null });
  };
  const buildDraft = () => {
    const selected2 = state.selected;
    if (selected2 === null) return null;
    const entry = state.gateways.find((g) => g.index === selected2);
    if (entry === void 0) return null;
    const cfg2 = entry.gateway;
    const draft = {
      provider: cfg2.provider,
      displayName: cfg2.displayName,
      baseURL: cfg2.baseURL,
      api: cfg2.api,
      userAgent: cfg2.userAgent,
      apiKey: cfg2.apiKey,
      apiKeyEnv: cfg2.apiKeyEnv,
      anthropicThinking: Boolean(cfg2.anthropicThinking),
      extraHeaders: {}
    };
    const raw = (headersText[selected2] ?? "").trim();
    if (raw !== "") {
      try {
        const parsed = JSON.parse(raw);
        if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("not an object");
        draft.extraHeaders = parsed;
      } catch {
        return null;
      }
    }
    return draft;
  };
  const applyTestResult = (index, r) => {
    if (!r.ok) {
      setTestResult((tr) => ({ ...tr, [index]: { ok: false, error: String(r.error ?? "") } }));
      return;
    }
    const res = r;
    const models = Array.isArray(res.models) ? res.models : [];
    setTestResult((tr) => ({ ...tr, [index]: { ok: true, endpoint: res.endpoint, latencyMs: res.latencyMs, modelCount: res.modelCount, models } }));
    setDiscovered((d) => ({ ...d, [index]: models }));
  };
  const runTest = () => {
    const selected2 = state.selected;
    if (selected2 === null) return;
    const draft = buildDraft();
    if (draft === null) {
      setTestResult((tr) => ({ ...tr, [selected2]: { ok: false, error: "extraHeaders: invalid JSON" } }));
      return;
    }
    void (async () => {
      setTesting(true);
      try {
        const r = await call("test-connection", { index: selected2, draft });
        applyTestResult(selected2, r);
      } finally {
        setTesting(false);
      }
    })();
  };
  const addGateway = () => {
    void (async () => {
      setBusy(true);
      try {
        const r = await call("add-gateway", {});
        if (!r.ok) setStatus({ kind: "err", text: String(r.error ?? "") });
        else {
          const index = r.index;
          setStatus({ kind: "ok", text: t("saved") });
          void refresh();
          setState((s) => ({ ...s, selected: index }));
        }
      } finally {
        setBusy(false);
      }
    })();
  };
  const deleteGateway = (index) => {
    void (async () => {
      const r = await call("delete-gateway", { index });
      if (!r.ok) setStatus({ kind: "err", text: String(r.error ?? "") });
      else {
        setStatus({ kind: "ok", text: t("saved") });
        void refresh();
        setState((s) => ({ ...s, selected: null }));
      }
    })();
  };
  const saveOverrides = () => {
    const selected2 = state.selected;
    if (selected2 === null) return;
    try {
      const overrides = JSON.parse(overridesText[selected2] || "{}");
      void (async () => {
        const r = await call("save-overrides", { index: selected2, overrides });
        if (!r.ok) setStatus({ kind: "err", text: String(r.error ?? "") });
        else setStatus({ kind: "ok", text: t("saved") });
      })();
    } catch {
      setStatus({ kind: "err", text: "modelOverrides: invalid JSON" });
    }
  };
  const startEdit = (id) => {
    const selected2 = state.selected;
    if (selected2 === null) return;
    const entry = state.gateways.find((g) => g.index === selected2);
    const model = (entry?.models ?? []).find((m) => String(m.id) === id);
    if (model === void 0) return;
    setEditing({ id, custom: state.catalog[id] === void 0 });
    setFetchedPick("");
    setAddModelDraft({
      id,
      name: String(model.name ?? "") === id ? "" : String(model.name ?? ""),
      contextWindow: model.contextWindow === void 0 ? "" : String(model.contextWindow),
      maxTokens: model.maxTokens === void 0 ? "" : String(model.maxTokens)
    });
  };
  const cancelEdit = () => {
    setEditing(null);
    setAddModelDraft({ id: "", name: "", contextWindow: "", maxTokens: "" });
  };
  const submitModelForm = () => {
    const selected2 = state.selected;
    if (selected2 === null) return;
    const entry = state.gateways.find((g) => g.index === selected2);
    if (entry === void 0) return;
    const id = addModelDraft.id.trim();
    const name2 = addModelDraft.name.trim();
    const ctx = addModelDraft.contextWindow.trim();
    const max = addModelDraft.maxTokens.trim();
    if (editing !== null) {
      void (async () => {
        const r = editing.custom ? await call("upsert-custom", {
          index: selected2,
          // Omitted fields keep their previous value (partial update).
          entry: { id: editing.id, ...name2 === "" ? {} : { name: name2 }, ...ctx === "" ? {} : { contextWindow: Number(ctx) || void 0 }, ...max === "" ? {} : { maxTokens: Number(max) || void 0 } },
          originalId: { id: editing.id }
        }) : await call("save-config", {
          index: selected2,
          patch: { modelOverrides: overrideMapWith(entry, editing.id, name2, ctx, max) }
        });
        if (!r.ok) setStatus({ kind: "err", text: String(r.error ?? "") });
        else {
          setStatus({ kind: "ok", text: `${editing.id} ✓` });
          cancelEdit();
          void refresh();
        }
      })();
      return;
    }
    if (id === "") {
      setStatus({ kind: "err", text: t("modelId") + " " + t("required") });
      return;
    }
    void (async () => {
      const model = {
        id,
        ...name2 === "" ? {} : { name: name2 },
        ...ctx === "" ? {} : { contextWindow: Number(ctx) || void 0 },
        ...max === "" ? {} : { maxTokens: Number(max) || void 0 }
      };
      const r = await call("enable-discovered", { index: selected2, model });
      if (!r.ok) setStatus({ kind: "err", text: String(r.error ?? "") });
      else {
        setStatus({ kind: "ok", text: `${id} ${t("enable")} ✓` });
        setAddModelDraft({ id: "", name: "", contextWindow: "", maxTokens: "" });
        void refresh();
      }
    })();
  };
  const removeModel = (id) => {
    const selected2 = state.selected;
    if (selected2 === null) return;
    void (async () => {
      const builtin = state.catalog[id] !== void 0;
      const r = builtin ? await call("toggle-builtin", { index: selected2, id, enabled: false }) : await call("delete-custom", { index: selected2, id });
      if (!r.ok) setStatus({ kind: "err", text: String(r.error ?? "") });
      else {
        setStatus({ kind: "ok", text: `${id} ${t("remove")} ✓` });
        void refresh();
      }
    })();
  };
  const runFetchModels = () => {
    const selected2 = state.selected;
    if (selected2 === null) return;
    const draft = buildDraft();
    if (draft === null) {
      setStatus({ kind: "err", text: "extraHeaders: invalid JSON" });
      return;
    }
    void (async () => {
      setDiscovering(true);
      setDiscovered((d) => ({ ...d, [selected2]: null }));
      try {
        const r = await call("test-connection", { index: selected2, draft });
        if (!r.ok) {
          setStatus({ kind: "err", text: String(r.error ?? "") });
          return;
        }
        const modelsRaw = r.models;
        const models = Array.isArray(modelsRaw) ? modelsRaw : [];
        setDiscovered((d) => ({ ...d, [selected2]: models }));
        setStatus({ kind: "ok", text: `${models.length} ${t("testModels")}` });
      } finally {
        setDiscovering(false);
      }
    })();
  };
  const fieldRow = (key, label, hint, placeholder) => {
    const selected2 = state.selected;
    const entry = state.gateways.find((g) => g.index === selected2);
    const cfg2 = entry?.gateway ?? {};
    return Row({
      title: label,
      desc: hint,
      control: import_react.default.createElement("input", {
        className: "phub-input",
        value: String(cfg2[key] ?? ""),
        placeholder,
        onChange: (e) => setField(key, e.target.value)
      })
    });
  };
  const selected = state.selected;
  const selectedEntry = state.gateways.find((g) => g.index === selected);
  const cfg = selectedEntry?.gateway ?? {};
  const statusLine = status === null ? null : import_react.default.createElement("span", { className: `phub-status phub-status-${status.kind}` }, status.text);
  const test = selected === null ? null : testResult[selected] ?? null;
  const testModels = test?.models ?? [];
  const testBanner = test === null ? null : import_react.default.createElement(
    "div",
    {
      className: `phub-test-result ${test.ok ? "phub-test-ok" : "phub-test-err"}`
    },
    import_react.default.createElement("span", null, test.ok ? `✓ ${t("testOk")} · ${String(test.latencyMs ?? 0)}ms · ${String(test.modelCount ?? 0)} ${t("testModels")}${testModels.length > 0 ? ` · ${t("testSeeded")}` : ""}` : `✕ ${t("testFailed")}`),
    import_react.default.createElement(
      "span",
      { className: "phub-test-detail" },
      test.ok ? `GET ${String(test.endpoint ?? "")}${testModels.length > 0 ? ` → ${testModels.slice(0, 3).map((m) => m.id).join(", ")}${testModels.length > 3 ? " …" : ""}` : ""}` : String(test.error ?? "")
    )
  );
  const enabledIds = new Set((selectedEntry?.models ?? []).map((m) => String(m.id)));
  const presetHit = matchCatalog(addModelDraft.id, state.catalog);
  const fetchedList = selected === null ? void 0 : discovered[selected];
  return import_react.default.createElement(
    "div",
    { className: "phub-page" },
    import_react.default.createElement("p", { className: "phub-intro" }, t("intro")),
    // ---- Gateway list ----
    import_react.default.createElement(
      "section",
      null,
      import_react.default.createElement(
        "div",
        { className: "phub-group-heading" },
        t("gateways"),
        import_react.default.createElement("span", { className: "phub-count" }, String(state.gateways.length))
      ),
      import_react.default.createElement(
        "div",
        { className: "phub-group" },
        state.gateways.length === 0 ? import_react.default.createElement(
          "div",
          { className: "phub-empty" },
          import_react.default.createElement("span", { className: "phub-empty-title" }, t("emptyTitle")),
          import_react.default.createElement("span", { className: "phub-empty-desc" }, t("emptyHint"))
        ) : state.gateways.map((g) => {
          const name2 = String(g.gateway.displayName ?? g.gateway.provider ?? "");
          const provider = String(g.gateway.provider ?? "");
          const api = String(g.gateway.api ?? "");
          const base = String(g.gateway.baseURL ?? "");
          const desc = base === "" ? `${provider} · ${api} · ${t("baseURL")} —` : `${provider} · ${api} · ${base}`;
          return Row({
            key: g.index,
            selected: selected === g.index,
            onClick: () => setState((s) => ({ ...s, selected: s.selected === g.index ? null : g.index })),
            title: import_react.default.createElement(
              "span",
              { style: { display: "inline-flex", alignItems: "center", gap: 10 } },
              ChipUI({ text: name2 }),
              import_react.default.createElement("span", null, name2)
            ),
            desc,
            control: import_react.default.createElement("button", {
              className: "phub-btn phub-btn-danger",
              title: t("delete"),
              onClick: (e) => {
                e.stopPropagation();
                deleteGateway(g.index);
              }
            }, t("delete"))
          });
        }),
        import_react.default.createElement(
          "button",
          { className: "phub-add-card", disabled: busy, onClick: addGateway },
          `+ ${t("addGateway")}`
        ),
        statusLine === null ? null : import_react.default.createElement("div", { className: "phub-actions" }, statusLine)
      )
    ),
    // ---- Gateway editor ----
    selected === null || selectedEntry === void 0 ? null : import_react.default.createElement(
      "section",
      null,
      import_react.default.createElement(
        "div",
        { className: "phub-group-heading" },
        `${t("gateway")}: ${String(cfg.displayName ?? cfg.provider ?? "")}`,
        import_react.default.createElement("span", { className: "phub-count" }, String(cfg.api ?? "anthropic-messages"))
      ),
      import_react.default.createElement(
        "div",
        { className: "phub-group" },
        fieldRow("provider", t("providerName"), t("providerNameHint")),
        fieldRow("displayName", t("displayName")),
        fieldRow("baseURL", `${t("baseURL")} *`, t("baseURLHint"), t("baseURLPlaceholder")),
        Row({
          title: t("api"),
          // MUST be a React element (createElement), never a direct call:
          // SelectMenu holds hooks (useState) and a direct call would attach
          // them to the parent fiber with a conditional order — React throws
          // "rendered more/less hooks" and the settings panel blanks.
          control: import_react.default.createElement(SelectMenu, {
            label: t("api"),
            value: String(cfg.api ?? "anthropic-messages"),
            options: [{ value: "anthropic-messages", title: "anthropic-messages" }, { value: "openai-completions", title: "openai-completions" }],
            onChange: (next) => setField("api", next)
          })
        }),
        fieldRow("userAgent", t("userAgent")),
        fieldRow("apiKey", t("apiKey")),
        fieldRow("apiKeyEnv", t("apiKeyEnv"), t("apiKeyHint")),
        Row({
          title: t("anthropicThinking"),
          control: SwitchUI({
            checked: Boolean(cfg.anthropicThinking),
            onChange: (next) => setField("anthropicThinking", next)
          })
        }),
        // JSON editors get the full card width: a narrow right-hand box
        // makes JSON unreadable.
        import_react.default.createElement(
          "div",
          { className: "phub-stack" },
          import_react.default.createElement("span", { className: "phub-stack-label" }, `${t("extraHeaders")} (JSON)`),
          import_react.default.createElement("textarea", {
            className: "phub-textarea",
            value: headersText[selected] ?? "",
            onChange: (e) => {
              setHeadersText((h) => ({ ...h, [selected]: e.target.value }));
              clearTestResult();
            }
          })
        ),
        import_react.default.createElement(
          "div",
          { className: "phub-actions" },
          import_react.default.createElement("button", { className: "phub-btn", disabled: busy, onClick: () => void save() }, t("save")),
          // Probe GET {baseURL}/models with the form values — no save needed.
          import_react.default.createElement("button", {
            className: "phub-btn",
            disabled: busy || testing || String(cfg.baseURL ?? "").trim() === "",
            onClick: runTest
          }, testing ? `${t("testConnection")}…` : t("testConnection")),
          statusLine
        ),
        testBanner
      )
    ),
    // ---- Models ----
    // Stable reading order: enabled list (editable) → add form → overrides.
    selected === null || selectedEntry === void 0 ? null : import_react.default.createElement(
      "section",
      null,
      import_react.default.createElement(
        "div",
        { className: "phub-group-heading" },
        t("models"),
        import_react.default.createElement(
          "span",
          { className: "phub-count" },
          String((selectedEntry.models ?? []).length)
        )
      ),
      import_react.default.createElement(
        "div",
        { className: "phub-group" },
        // -- Enabled models (catalog entries + custom models): edit fills the
        //    form below, remove deletes.
        SubHead(t("modelsEnabled")),
        import_react.default.createElement(
          "div",
          { className: "phub-models-list" },
          (selectedEntry.models ?? []).length === 0 ? import_react.default.createElement("span", { className: "phub-editor-note", style: { padding: "2px 8px 6px" } }, t("modelsEmptyHint")) : (selectedEntry.models ?? []).map((m) => {
            const id = String(m.id ?? "");
            const name2 = String(m.name ?? id);
            const ctx = String(m.contextWindow ?? "");
            const max = String(m.maxTokens ?? "");
            const active = editing?.id === id;
            return Row({
              key: id,
              className: active ? "phub-row-selected" : void 0,
              title: name2,
              desc: import_react.default.createElement(
                "span",
                { className: "phub-model-params" },
                `${id}${ctx === "" ? "" : ` · ${ctx}`}${max === "" ? "" : ` · ${max}`}${state.catalog[id] !== void 0 ? "" : ` · ${t("custom")}`}`
              ),
              control: import_react.default.createElement(
                import_react.default.Fragment,
                null,
                import_react.default.createElement("button", {
                  className: "phub-btn",
                  title: t("edit"),
                  onClick: () => startEdit(id)
                }, t("edit")),
                import_react.default.createElement("button", {
                  className: "phub-btn phub-btn-danger",
                  title: t("remove"),
                  onClick: () => void removeModel(id)
                }, t("remove"))
              )
            });
          })
        ),
        // -- Add: fetch the upstream listing into a dropdown (with the current
        //    form values), pick or type an id, optionally apply preset params.
        SubHead(editing === null ? t("addModel") : `${t("addModel")} · ${t("edit")}: ${editing.id}`, t("addModelHint")),
        import_react.default.createElement(
          "div",
          { className: "phub-actions", style: { paddingTop: 0 } },
          import_react.default.createElement("button", {
            className: "phub-btn",
            disabled: discovering || String(cfg.baseURL ?? "").trim() === "",
            onClick: runFetchModels
          }, discovering ? `${t("discoverRun")}…` : t("discoverRun")),
          fetchedList !== void 0 && fetchedList !== null ? import_react.default.createElement("span", { className: "phub-editor-note" }, `${fetchedList.length} ${t("testModels")}`) : null
        ),
        // Dropdown over the fetched listing — the normal flow: fetch, pick, add.
        fetchedList === null || fetchedList === void 0 || fetchedList.length === 0 ? null : Row({
          title: t("fetchedModels"),
          control: import_react.default.createElement(SelectMenu, {
            label: t("fetchedModels"),
            value: fetchedPick,
            options: fetchedList.map((model) => ({
              value: model.id,
              title: `${model.id}${model.contextWindow !== void 0 ? ` · ${model.contextWindow}` : ""}${model.maxTokens !== void 0 ? ` / ${model.maxTokens}` : ""}${enabledIds.has(model.id) ? ` · ${t("alreadyEnabled")}` : ""}`
            })),
            onChange: (next) => {
              setFetchedPick(next);
              const model = fetchedList.find((m) => m.id === next);
              if (model === void 0) return;
              setEditing(null);
              setAddModelDraft({
                id: model.id,
                name: model.name !== void 0 && model.name !== "" && model.name !== model.id ? model.name : "",
                contextWindow: model.contextWindow !== void 0 ? String(model.contextWindow) : "",
                maxTokens: model.maxTokens !== void 0 ? String(model.maxTokens) : ""
              });
            }
          })
        }),
        import_react.default.createElement(
          "div",
          { className: "phub-custom-item" },
          import_react.default.createElement("input", {
            className: "phub-input",
            placeholder: t("modelId"),
            value: addModelDraft.id,
            disabled: editing !== null,
            onChange: (e) => setAddModelDraft((d) => ({ ...d, id: e.target.value }))
          }),
          import_react.default.createElement("input", {
            className: "phub-input",
            placeholder: t("modelName"),
            value: addModelDraft.name,
            onChange: (e) => setAddModelDraft((d) => ({ ...d, name: e.target.value }))
          }),
          import_react.default.createElement("input", {
            className: "phub-input",
            placeholder: t("contextWindow"),
            value: addModelDraft.contextWindow,
            onChange: (e) => setAddModelDraft((d) => ({ ...d, contextWindow: e.target.value }))
          }),
          import_react.default.createElement("input", {
            className: "phub-input",
            placeholder: t("maxTokens"),
            value: addModelDraft.maxTokens,
            onChange: (e) => setAddModelDraft((d) => ({ ...d, maxTokens: e.target.value }))
          }),
          import_react.default.createElement(
            "span",
            { className: "phub-form-buttons" },
            import_react.default.createElement(
              "button",
              { className: "phub-btn", disabled: busy, onClick: submitModelForm },
              editing === null ? t("addCustom") : t("update")
            ),
            editing === null ? null : import_react.default.createElement("button", { className: "phub-btn", onClick: cancelEdit }, t("cancel"))
          )
        ),
        // Contextual preset offer: the typed/selected id matches the built-in
        // catalog (exact or fuzzy) — one click applies its parameters.
        presetHit === void 0 ? null : import_react.default.createElement(
          "div",
          { className: "phub-actions", style: { paddingTop: 6 } },
          import_react.default.createElement("button", {
            className: "phub-suggest",
            onClick: () => {
              const preset = state.catalog[presetHit];
              if (preset === void 0) return;
              setAddModelDraft((d) => ({ ...d, contextWindow: String(preset.contextWindow), maxTokens: String(preset.maxTokens) }));
            }
          }, `${t("presetApply")} · ${state.catalog[presetHit]?.name ?? presetHit} (${state.catalog[presetHit]?.contextWindow ?? ""} / ${state.catalog[presetHit]?.maxTokens ?? ""})`)
        ),
        // -- Overrides: full-width JSON editor + save.
        SubHead(t("overrides"), t("overridesHint")),
        import_react.default.createElement(
          "div",
          { className: "phub-stack" },
          import_react.default.createElement("textarea", {
            className: "phub-textarea",
            value: overridesText[selected] ?? "",
            onChange: (e) => setOverridesText((o) => ({ ...o, [selected]: e.target.value }))
          }),
          import_react.default.createElement(
            "div",
            { className: "phub-stack-foot" },
            import_react.default.createElement("button", { className: "phub-btn", onClick: saveOverrides }, t("save"))
          )
        )
      )
    )
  );
}

// src/host/contract.ts
var schema = (parse) => ({ parse });
var stringSchema = schema((v) => {
  if (typeof v !== "string") throw new TypeError("expected a string");
  return v;
});
var booleanSchema = schema((v) => {
  if (typeof v !== "boolean") throw new TypeError("expected a boolean");
  return v;
});
var numberSchema = schema((v) => {
  if (typeof v !== "number" || !Number.isInteger(v)) throw new TypeError("expected an integer");
  return v;
});
var objectSchema = schema((v) => {
  if (v === null || typeof v !== "object" || Array.isArray(v)) throw new TypeError("expected an object");
  return v;
});
var nullishObjectSchema = schema((v) => {
  if (v !== null && (typeof v !== "object" || Array.isArray(v))) throw new TypeError("expected an object or null");
  return v;
});
var resultEnvelopeSchema = schema((v) => {
  if (v === null || typeof v !== "object" || typeof v.ok !== "boolean") {
    throw new TypeError("expected an { ok, ... } envelope");
  }
  return v;
});
var codec = (name2, sch) => ({
  mode: "strict",
  typeSymbol: `dsh-provider-hub#${name2}`,
  schema: sch
});
var stringParam = (name2) => ({
  name: name2,
  wire: name2,
  source: "json",
  codec: codec("String", stringSchema)
});
var booleanParam = (name2) => ({
  name: name2,
  wire: name2,
  source: "json",
  codec: codec("Boolean", booleanSchema)
});
var numberParam = (name2) => ({
  name: name2,
  wire: name2,
  source: "json",
  codec: codec("Number", numberSchema)
});
var objectParam = (name2) => ({
  name: name2,
  wire: name2,
  source: "json",
  codec: codec("Object", objectSchema)
});
var nullishObjectParam = (name2) => ({
  name: name2,
  wire: name2,
  source: "json",
  codec: codec("ObjectOrNull", nullishObjectSchema)
});
var invocation = (id, method, parameters) => ({
  id: `dsh-provider-hub#providerHub/${id}`,
  service: "providerHub",
  namespace: "providerHub",
  method,
  invocation: { kind: "direct" },
  parameters,
  result: { mode: "strict", typeSymbol: `dsh-provider-hub#${id}Result`, schema: resultEnvelopeSchema }
});
var INVOCATIONS = [
  invocation("getState", "getState", []),
  invocation("addGateway", "addGateway", []),
  invocation("deleteGateway", "deleteGateway", [numberParam("index")]),
  invocation("saveConfig", "saveConfig", [numberParam("index"), objectParam("patch")]),
  invocation("toggleBuiltin", "toggleBuiltin", [numberParam("index"), stringParam("id"), booleanParam("enabled")]),
  invocation("saveOverrides", "saveOverrides", [numberParam("index"), objectParam("overrides")]),
  invocation("upsertCustom", "upsertCustom", [numberParam("index"), objectParam("entry"), nullishObjectParam("originalId")]),
  invocation("deleteCustom", "deleteCustom", [numberParam("index"), stringParam("id")]),
  invocation("discover", "discover", [numberParam("index")]),
  invocation("testConnection", "testConnection", [numberParam("index"), objectParam("draft")]),
  invocation("enableDiscovered", "enableDiscovered", [numberParam("index"), objectParam("model")])
];

// src/client/static.tsx
var name = "provider-hub";
var inject = ["slots", "locale", "remote"];
var NS = "settings.provider-hub";
var SLOT_ID = "provider-hub-settings";
var SLOT_ORDER = 30;
var STYLE_ID = "dsh-provider-hub-styles";
var METHOD_MAP = {
  "get-state": "getState",
  "add-gateway": "addGateway",
  "delete-gateway": "deleteGateway",
  "save-config": "saveConfig",
  "toggle-builtin": "toggleBuiltin",
  "save-overrides": "saveOverrides",
  "upsert-custom": "upsertCustom",
  "delete-custom": "deleteCustom",
  "discover": "discover",
  "test-connection": "testConnection",
  "enable-discovered": "enableDiscovered"
};
var PARAM_ORDER = {
  "delete-gateway": ["index"],
  "save-config": ["index", "patch"],
  "toggle-builtin": ["index", "id", "enabled"],
  "save-overrides": ["index", "overrides"],
  "upsert-custom": ["index", "entry", "originalId"],
  "delete-custom": ["index", "id"],
  "discover": ["index"],
  "test-connection": ["index", "draft"],
  "enable-discovered": ["index", "model"]
};
function adoptStyles() {
  try {
    if (typeof document === "undefined") return;
    if (document.getElementById(STYLE_ID) !== null) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = page_css_default;
    document.head.appendChild(style);
  } catch {
  }
}
function safeTranslate(locale, ns) {
  try {
    if (locale !== null && typeof locale === "object" && typeof locale.bind === "function") {
      const bound = locale.bind(ns);
      if (typeof bound === "function") return bound;
    }
  } catch {
  }
  return (key) => key;
}
var PageBoundary = class extends import_react2.default.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
  componentDidCatch(error) {
    try {
      console.error("provider-hub settings page error", error);
    } catch {
    }
  }
  render() {
    if (this.state.error !== null) {
      return import_react2.default.createElement(
        "div",
        { className: "phub-page" },
        import_react2.default.createElement("p", { className: "phub-intro" }, "Provider Hub page crashed"),
        import_react2.default.createElement("pre", { className: "phub-error" }, this.state.error),
        import_react2.default.createElement("button", {
          className: "phub-btn",
          onClick: () => this.setState({ error: null })
        }, "重试 / Retry")
      );
    }
    return this.props.children;
  }
};
function apply(ctx) {
  try {
    let locale;
    try {
      locale = (ctx?.get ?? (() => void 0))("locale") ?? ctx?.locale;
    } catch {
      locale = void 0;
    }
    const t = safeTranslate(locale, NS);
    if (locale !== void 0 && locale !== null && typeof ctx?.effect === "function") {
      try {
        const l = locale;
        ctx.effect(() => l.register?.(NS, { zh, en }) ?? void 0, "dsh-provider-hub: dictionaries");
      } catch {
      }
    }
    adoptStyles();
    let remote = null;
    let remoteError;
    const waitForRemote = async () => {
      for (let i = 0; i < 100; i++) {
        if (remote !== null) return remote;
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      return null;
    };
    try {
      const remoteService = ctx?.remote;
      if (remoteService !== null && typeof remoteService === "object" && typeof remoteService.$mount === "function" && typeof ctx?.effect === "function" && typeof ctx?.inject === "function") {
        ctx.effect(() => {
          let cancelled = false;
          let unmount;
          const contribution = { package: "dsh-provider-hub", descriptors: INVOCATIONS };
          void remoteService.$mount(contribution).then((dispose) => {
            if (cancelled) {
              void dispose();
              return;
            }
            unmount = dispose;
            ctx.inject(["remote.providerHub"], (nsCtx) => {
              remote = nsCtx?.remote?.providerHub ?? null;
            });
          }, (error) => {
            remoteError = error instanceof Error ? error.message : String(error);
          });
          return () => {
            cancelled = true;
            if (unmount !== void 0) void unmount();
          };
        }, "dsh-provider-hub: remote mount");
      }
    } catch {
      remote = null;
    }
    const call = async (method, payload) => {
      try {
        const ns = await waitForRemote();
        if (ns === null) return { ok: false, error: remoteError ?? t("remotePending") };
        const remoteName = METHOD_MAP[method];
        if (remoteName === void 0) return { ok: false, error: `unknown method ${method}` };
        const args = (PARAM_ORDER[method] ?? []).map((key) => (payload ?? {})[key]);
        const r = await ns[remoteName](...args);
        const msgOf = (e) => typeof e === "string" ? e : e !== null && typeof e === "object" && typeof e.message === "string" ? e.message : "";
        if (r === null || typeof r !== "object" || r.ok !== true) {
          return { ok: false, error: msgOf(r?.error) || t("callFailed") };
        }
        const value = r.value;
        if (typeof value !== "object" || value === null || value.ok !== true) {
          return { ok: false, error: msgOf(value?.error) || t("callFailed") };
        }
        return value;
      } catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : String(error) };
      }
    };
    const slots = (ctx?.get ?? (() => void 0))("slots") ?? ctx?.slots;
    if (slots === void 0 || typeof slots.inject !== "function") return;
    try {
      slots.inject("settings.section", () => {
        try {
          return slots.register(
            { name: "settings.section", id: SLOT_ID, order: SLOT_ORDER, label: () => t("nav") },
            () => import_react2.default.createElement(PageBoundary, null, import_react2.default.createElement(ProviderHubPage, { t, call }))
          );
        } catch {
          return void 0;
        }
      });
    } catch {
    }
  } catch {
  }
}

    return module.exports;
  }
});

//# sourceMappingURL=client.js.map
