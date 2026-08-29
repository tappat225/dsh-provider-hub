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

/* Editor internals. */
.phub-editor-note { font-size: 12px; line-height: 18px; color: var(--dsw-alias-label-tertiary); padding: 0 8px; }
.phub-actions { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; padding: 10px 8px 0; }
.phub-models-list { display: flex; flex-direction: column; }
.phub-model-params { font-variant-numeric: tabular-nums; font-size: 11px; line-height: 16px; color: var(--dsw-alias-label-tertiary); }
.phub-custom-item { display: grid; grid-template-columns: 1.3fr 1fr 0.8fr 0.8fr auto; gap: 6px; padding: 6px 8px 0; align-items: center; }
.phub-custom-item .phub-input { min-width: 0; width: 100%; }
.phub-discover-list { display: flex; flex-direction: column; padding: 0 8px; }
.phub-discover-item { display: flex; align-items: center; gap: 8px; font-size: 13px; line-height: 22px; padding: 4px 0; }
.phub-discover-item .phub-btn { margin-left: auto; }
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
  baseURLPlaceholder: "https://api.example.com",
  api: "协议",
  userAgent: "User-Agent",
  apiKey: "API Key",
  apiKeyEnv: "Key 环境变量",
  apiKeyHint: "字面量优先于环境变量",
  extraHeaders: "附加请求头",
  systemRole: "系统提示词角色",
  anthropicThinking: "Anthropic thinking 透传（reasoningEffort → thinking.budget_tokens）",
  save: "保存",
  saved: "已保存",
  saveFailed: "保存失败",
  models: "模型管理",
  modelsEnabled: "已启用的模型",
  addModel: "添加模型",
  addModelHint: "模型 ID 命中内置目录时自动带参；否则按自定义模型保存。",
  remove: "移除",
  builtin: "内置目录",
  builtinHint: "勾选即出现在 DSH 模型选择器",
  overrides: "参数覆盖（可选）",
  overridesHint: "按模型 id 覆盖内置参数",
  custom: "自定义模型",
  addCustom: "添加",
  delete: "删除",
  modelId: "模型 ID",
  modelName: "显示名",
  contextWindow: "上下文",
  maxTokens: "最大输出",
  reasoning: "推理档位",
  presetFrom: "预设导入",
  presetProvider: "来源路由",
  presetModel: "模型",
  importPreset: "导入",
  presetHint: "从已注册路由复制模型参数",
  discover: "发现模型",
  discoverHint: "从网关 /models 拉取（带自定义 UA）",
  discovered: "发现结果",
  adopt: "采纳为自定义",
  enable: "一键启用",
  snapshot: "快照",
  restore: "回退",
  snapshotHint: "写入前自动快照，删空可回退",
  empty: "（空）",
  status: "状态",
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
  baseURLPlaceholder: "https://api.example.com",
  api: "Protocol",
  userAgent: "User-Agent",
  apiKey: "API Key",
  apiKeyEnv: "Key env var",
  apiKeyHint: "literal takes precedence over env",
  extraHeaders: "Extra headers",
  systemRole: "System role",
  anthropicThinking: "Forward reasoningEffort as Anthropic thinking (budget_tokens)",
  save: "Save",
  saved: "Saved",
  saveFailed: "Save failed",
  models: "Models",
  modelsEnabled: "Enabled models",
  addModel: "Add model",
  addModelHint: "An id matching the built-in catalog auto-fills parameters; anything else is saved as a custom model.",
  remove: "Remove",
  builtin: "Built-in catalog",
  builtinHint: "ticked models appear in the DSH model picker",
  overrides: "Overrides (optional)",
  overridesHint: "field-level override per model id",
  custom: "Custom models",
  addCustom: "Add",
  delete: "Delete",
  modelId: "Model ID",
  modelName: "Name",
  contextWindow: "Context",
  maxTokens: "Max output",
  reasoning: "Reasoning",
  presetFrom: "Preset import",
  presetProvider: "Source route",
  presetModel: "Model",
  importPreset: "Import",
  presetHint: "copy capability params from a registered route",
  discover: "Discover",
  discoverHint: "fetch GET {baseURL}/models with the custom UA",
  discovered: "Discovered",
  adopt: "Adopt as custom",
  enable: "Enable",
  snapshot: "Snapshot",
  restore: "Restore",
  snapshotHint: "auto-snapshot before bulk enable; restore when cleared",
  empty: "(empty)",
  status: "Status",
  required: "required",
  remotePending: "remote service not ready yet",
  callFailed: "call failed"
};

// src/client/page.tsx
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
    import_react.default.createElement("span", { className: "phub-select-anchor-text" }, selected?.title ?? props.value ?? "—"),
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
  const [overridesText, setOverridesText] = import_react.default.useState({});
  const [headersText, setHeadersText] = import_react.default.useState({});
  const [presetProviders, setPresetProviders] = import_react.default.useState([]);
  const [presetModels, setPresetModels] = import_react.default.useState({});
  const [presetProvider, setPresetProvider] = import_react.default.useState({});
  const [presetModel, setPresetModel] = import_react.default.useState({});
  const [discovered, setDiscovered] = import_react.default.useState({});
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
      const rp = await call("list-presets");
      if (rp.ok) setPresetProviders(rp.providers);
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
  const toggleBuiltin = (id, enabled) => {
    const selected2 = state.selected;
    if (selected2 === null) return;
    void (async () => {
      const r = await call("toggle-builtin", { index: selected2, id, enabled });
      if (!r.ok) setStatus({ kind: "err", text: String(r.error ?? "") });
      else void refresh();
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
  const submitAddModel = () => {
    const selected2 = state.selected;
    if (selected2 === null) return;
    const id = addModelDraft.id.trim();
    if (id === "") {
      setStatus({ kind: "err", text: t("modelId") + " " + t("required") });
      return;
    }
    void (async () => {
      const entry = {
        id,
        ...addModelDraft.name.trim() === "" ? {} : { name: addModelDraft.name.trim() },
        ...addModelDraft.contextWindow.trim() === "" ? {} : { contextWindow: Number(addModelDraft.contextWindow) || void 0 },
        ...addModelDraft.maxTokens.trim() === "" ? {} : { maxTokens: Number(addModelDraft.maxTokens) || void 0 }
      };
      const r = await call("enable-discovered", { index: selected2, model: entry });
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
  const importPreset = async () => {
    const selected2 = state.selected;
    if (selected2 === null) return;
    const pv = presetProvider[selected2] ?? "";
    const mv = presetModel[selected2] ?? "";
    if (pv === "" || mv === "") return;
    const r = await call("preset-model-info", { provider: pv, model: mv });
    if (!r.ok) {
      setStatus({ kind: "err", text: String(r.error ?? "") });
      return;
    }
    const info = r.info;
    const entry = {
      id: info.id,
      name: info.name ?? info.id,
      contextWindow: info.context?.contextWindow,
      maxTokens: info.defaultMaxTokens
    };
    const r2 = await call("enable-discovered", { index: selected2, model: entry });
    if (!r2.ok) setStatus({ kind: "err", text: String(r2.error ?? "") });
    else {
      setStatus({ kind: "ok", text: `${info.id} ${t("importPreset")} ✓` });
      void refresh();
    }
  };
  const loadPresetModels = async (provider) => {
    const selected2 = state.selected;
    if (selected2 === null) return;
    setPresetProvider((p) => ({ ...p, [selected2]: provider }));
    setPresetModel((p) => ({ ...p, [selected2]: "" }));
    if (provider === "") {
      setPresetModels((p) => ({ ...p, [selected2]: [] }));
      return;
    }
    const r = await call("preset-models", { provider });
    if (r.ok) setPresetModels((p) => ({ ...p, [selected2]: r.models }));
  };
  const runDiscover = async () => {
    const selected2 = state.selected;
    if (selected2 === null) return;
    setDiscovered((d) => ({ ...d, [selected2]: null }));
    setBusy(true);
    try {
      const r = await call("discover", { index: selected2 });
      if (!r.ok) {
        setStatus({ kind: "err", text: String(r.error ?? "") });
        return;
      }
      setDiscovered((d) => ({ ...d, [selected2]: r.models }));
      setStatus({ kind: "ok", text: t("discovered") });
    } finally {
      setBusy(false);
    }
  };
  const adoptDiscovered = async (model) => {
    const selected2 = state.selected;
    if (selected2 === null) return;
    const entry = {
      id: model.id,
      name: model.name ?? model.id,
      contextWindow: model.contextWindow,
      maxTokens: model.maxTokens
    };
    const r = await call("upsert-custom", { index: selected2, entry, originalId: null });
    if (!r.ok) setStatus({ kind: "err", text: String(r.error ?? "") });
    else {
      setStatus({ kind: "ok", text: `${model.id} ✓` });
      void refresh();
    }
  };
  const enableDiscovered = async (model) => {
    const selected2 = state.selected;
    if (selected2 === null) return;
    const r = await call("enable-discovered", { index: selected2, model });
    if (!r.ok) setStatus({ kind: "err", text: String(r.error ?? "") });
    else {
      setStatus({ kind: "ok", text: `${model.id} ${t("enable")} ✓` });
      void refresh();
    }
  };
  const snapshotCatalog = async () => {
    const selected2 = state.selected;
    if (selected2 === null) return;
    const r = await call("snapshot-catalog", { index: selected2 });
    if (!r.ok) setStatus({ kind: "err", text: String(r.error ?? "") });
    else setStatus({ kind: "ok", text: `${t("snapshot")} ✓` });
  };
  const restoreCatalog = async () => {
    const selected2 = state.selected;
    if (selected2 === null) return;
    const r = await call("restore-catalog", { index: selected2 });
    if (!r.ok) setStatus({ kind: "err", text: String(r.error ?? "") });
    else {
      setStatus({ kind: "ok", text: `${t("restore")} ✓` });
      void refresh();
    }
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
        fieldRow("baseURL", `${t("baseURL")} *`, void 0, t("baseURLPlaceholder")),
        Row({
          title: t("api"),
          control: SelectMenu({
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
        Row({
          title: `${t("extraHeaders")} (JSON)`,
          control: import_react.default.createElement("textarea", {
            className: "phub-textarea",
            style: { width: 320 },
            value: headersText[selected] ?? "",
            onChange: (e) => setHeadersText((h) => ({ ...h, [selected]: e.target.value }))
          })
        }),
        import_react.default.createElement(
          "div",
          { className: "phub-actions" },
          import_react.default.createElement("button", { className: "phub-btn", disabled: busy, onClick: () => void save() }, t("save")),
          statusLine
        )
      )
    ),
    // ---- Models ----
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
        // Enabled model list: catalog entries + custom models, each removable.
        import_react.default.createElement("div", { className: "phub-editor-note", style: { paddingTop: 10 } }, t("modelsEnabled")),
        import_react.default.createElement(
          "div",
          { className: "phub-models-list", style: { marginTop: 4 } },
          (selectedEntry.models ?? []).length === 0 ? import_react.default.createElement("span", { className: "phub-editor-note", style: { padding: "6px 8px" } }, `${t("empty")} — ${t("addModelHint")}`) : (selectedEntry.models ?? []).map((m) => {
            const id = String(m.id ?? "");
            const name2 = String(m.name ?? id);
            const ctx = String(m.contextWindow ?? "");
            const max = String(m.maxTokens ?? "");
            return Row({
              key: id,
              title: name2,
              desc: import_react.default.createElement(
                "span",
                { className: "phub-model-params" },
                `${id}${ctx === "" ? "" : ` · ${ctx}`}${max === "" ? "" : ` · ${max}`}${state.catalog[id] !== void 0 ? "" : ` · ${t("custom")}`}`
              ),
              control: import_react.default.createElement("button", {
                className: "phub-btn phub-btn-danger",
                title: t("remove"),
                onClick: () => void removeModel(id)
              }, t("remove"))
            });
          })
        ),
        import_react.default.createElement(
          "div",
          { className: "phub-actions" },
          import_react.default.createElement("button", { className: "phub-btn", disabled: busy, onClick: () => void runDiscover() }, t("discover")),
          import_react.default.createElement("span", { className: "phub-editor-note" }, t("discoverHint"))
        ),
        discovered[selected] === null || discovered[selected] === void 0 ? null : import_react.default.createElement(
          "div",
          { className: "phub-discover-list" },
          (discovered[selected] ?? []).map((model) => import_react.default.createElement(
            "div",
            { className: "phub-discover-item", key: model.id },
            import_react.default.createElement(
              "span",
              null,
              `${model.id}${model.contextWindow !== void 0 ? ` · ${model.contextWindow}` : ""}${model.maxTokens !== void 0 ? ` / ${model.maxTokens}` : ""}`
            ),
            import_react.default.createElement("button", { className: "phub-btn", onClick: () => void enableDiscovered(model) }, t("enable"))
          ))
        ),
        // Add-model row: catalog ids auto-fill params, others become custom.
        Row({
          title: t("addModel"),
          desc: t("addModelHint")
        }),
        import_react.default.createElement(
          "div",
          { className: "phub-custom-item" },
          import_react.default.createElement("input", {
            className: "phub-input",
            placeholder: t("modelId"),
            value: addModelDraft.id,
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
          import_react.default.createElement("button", { className: "phub-btn", disabled: busy, onClick: submitAddModel }, t("addCustom"))
        ),
        Row({
          title: `${t("overrides")} (JSON)`,
          desc: t("overridesHint"),
          control: import_react.default.createElement("textarea", {
            className: "phub-textarea",
            style: { width: 320 },
            value: overridesText[selected] ?? "",
            onChange: (e) => setOverridesText((o) => ({ ...o, [selected]: e.target.value }))
          })
        }),
        import_react.default.createElement(
          "div",
          { className: "phub-actions" },
          import_react.default.createElement("button", { className: "phub-btn", onClick: saveOverrides }, `${t("overrides")}: ${t("save")}`)
        ),
        Row({
          title: t("presetFrom"),
          desc: t("presetHint"),
          control: import_react.default.createElement(
            "span",
            { className: "phub-control" },
            SelectMenu({
              label: t("presetProvider"),
              value: presetProvider[selected] ?? "",
              options: [
                { value: "", title: "—" },
                ...presetProviders.map((p) => ({ value: p.provider, title: `${p.displayName} (${p.provider})` }))
              ],
              onChange: (next) => void loadPresetModels(next)
            }),
            SelectMenu({
              label: t("presetModel"),
              value: presetModel[selected] ?? "",
              disabled: (presetModels[selected] ?? []).length === 0,
              options: [
                { value: "", title: "—" },
                ...(presetModels[selected] ?? []).map((m) => ({ value: m.id, title: m.name ?? m.id }))
              ],
              onChange: (next) => setPresetModel((p) => ({ ...p, [selected]: next }))
            }),
            import_react.default.createElement("button", { className: "phub-btn", disabled: (presetModel[selected] ?? "") === "", onClick: () => void importPreset() }, t("importPreset"))
          )
        }),
        import_react.default.createElement(
          "div",
          { className: "phub-actions" },
          import_react.default.createElement("button", { className: "phub-btn", disabled: busy, onClick: () => void runDiscover() }, t("discover")),
          import_react.default.createElement("span", { className: "phub-editor-note" }, t("discoverHint"))
        ),
        import_react.default.createElement(
          "div",
          { className: "phub-actions" },
          import_react.default.createElement("button", { className: "phub-btn", onClick: () => void snapshotCatalog() }, t("snapshot")),
          import_react.default.createElement("button", { className: "phub-btn", onClick: () => void restoreCatalog() }, t("restore")),
          import_react.default.createElement("span", { className: "phub-editor-note" }, t("snapshotHint"))
        ),
        discovered[selected] === null || discovered[selected] === void 0 ? null : import_react.default.createElement(
          "div",
          { className: "phub-discover-list" },
          (discovered[selected] ?? []).map((model) => import_react.default.createElement(
            "div",
            { className: "phub-discover-item", key: model.id },
            import_react.default.createElement(
              "span",
              null,
              `${model.id}${model.contextWindow !== void 0 ? ` · ${model.contextWindow}` : ""}${model.maxTokens !== void 0 ? ` / ${model.maxTokens}` : ""}`
            ),
            import_react.default.createElement("button", { className: "phub-btn", onClick: () => void enableDiscovered(model) }, t("enable")),
            import_react.default.createElement("button", { className: "phub-btn", onClick: () => void adoptDiscovered(model) }, t("adopt"))
          ))
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
  invocation("setPresetFrom", "setPresetFrom", [numberParam("index"), nullishObjectParam("preset")]),
  invocation("listPresets", "listPresets", []),
  invocation("presetModels", "presetModels", [stringParam("provider")]),
  invocation("presetModelInfo", "presetModelInfo", [stringParam("provider"), stringParam("model")]),
  invocation("discover", "discover", [numberParam("index")]),
  invocation("enableDiscovered", "enableDiscovered", [numberParam("index"), objectParam("model")]),
  invocation("snapshotCatalog", "snapshotCatalog", [numberParam("index")]),
  invocation("restoreCatalog", "restoreCatalog", [numberParam("index")])
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
  "set-preset-from": "setPresetFrom",
  "list-presets": "listPresets",
  "preset-models": "presetModels",
  "preset-model-info": "presetModelInfo",
  "discover": "discover",
  "enable-discovered": "enableDiscovered",
  "snapshot-catalog": "snapshotCatalog",
  "restore-catalog": "restoreCatalog"
};
var PARAM_ORDER = {
  "delete-gateway": ["index"],
  "save-config": ["index", "patch"],
  "toggle-builtin": ["index", "id", "enabled"],
  "save-overrides": ["index", "overrides"],
  "upsert-custom": ["index", "entry", "originalId"],
  "delete-custom": ["index", "id"],
  "set-preset-from": ["index", "preset"],
  "preset-models": ["provider"],
  "preset-model-info": ["provider", "model"],
  "discover": ["index"],
  "enable-discovered": ["index", "model"],
  "snapshot-catalog": ["index"],
  "restore-catalog": ["index"]
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
            () => import_react2.default.createElement(ProviderHubPage, { t, call })
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
