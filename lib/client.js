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

// src/client/page.css.ts
var page_css_default = `
.phub-page { padding: 4px 0 24px; max-width: 860px; }
.phub-section { margin-bottom: 20px; }
.phub-section h3 { margin: 0 0 10px; font-size: 14px; font-weight: 600; }
.phub-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 12px; }
.phub-field { display: flex; flex-direction: column; gap: 3px; }
.phub-field label { font-size: 12px; opacity: 0.8; }
.phub-field input, .phub-field select { height: 30px; padding: 0 8px; border: 1px solid var(--dsw-alias-border-l2, #444); border-radius: 6px; background: var(--dsw-alias-bg-layer-3, #1e1e1e); color: inherit; font: inherit; }
.phub-field .phub-hint { font-size: 11px; opacity: 0.55; }
.phub-actions { margin-top: 10px; display: flex; gap: 8px; align-items: center; }
.phub-btn { height: 30px; padding: 0 14px; border: 1px solid var(--dsw-alias-border-l2, #444); border-radius: 6px; background: var(--dsw-alias-bg-layer-3, #1e1e1e); color: inherit; cursor: pointer; font: inherit; }
.phub-btn:hover:not(:disabled) { border-color: var(--dsw-alias-brand-primary, #4f8cff); }
.phub-btn:disabled { opacity: 0.5; cursor: default; }
.phub-status { font-size: 12px; opacity: 0.8; }
.phub-status.err { color: #e06c75; }
.phub-status.ok { color: #98c379; }
.phub-builtin { display: flex; flex-direction: column; gap: 4px; }
.phub-builtin label { display: flex; align-items: center; gap: 6px; font-size: 13px; }
.phub-builtin .phub-params { font-size: 11px; opacity: 0.55; }
.phub-overrides textarea, .phub-custom textarea, .phub-headers textarea { width: 100%; min-height: 60px; border: 1px solid var(--dsw-alias-border-l2, #444); border-radius: 6px; background: var(--dsw-alias-bg-layer-3, #1e1e1e); color: inherit; font: 12px/1.5 ui-monospace, monospace; padding: 6px 8px; resize: vertical; box-sizing: border-box; }
.phub-custom-item { display: grid; grid-template-columns: 1.4fr 1fr 0.7fr 0.7fr auto; gap: 6px; margin-bottom: 6px; align-items: center; }
.phub-custom-item input { height: 28px; padding: 0 8px; border: 1px solid var(--dsw-alias-border-l2, #444); border-radius: 6px; background: var(--dsw-alias-bg-layer-3, #1e1e1e); color: inherit; font: 12px ui-monospace, monospace; }
.phub-preset { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.phub-preset select, .phub-preset input { height: 30px; padding: 0 8px; border: 1px solid var(--dsw-alias-border-l2, #444); border-radius: 6px; background: var(--dsw-alias-bg-layer-3, #1e1e1e); color: inherit; font: inherit; }
.phub-discover-list { margin-top: 8px; display: flex; flex-direction: column; gap: 4px; }
.phub-discover-item { display: flex; align-items: center; gap: 8px; font-size: 13px; }
.phub-discover-item button { margin-left: auto; }
`;

// src/client/locales.ts
var zh = {
  nav: "Provider Hub",
  gateways: "网关列表",
  addGateway: "添加网关",
  gateway: "网关设置",
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
  gateways: "Gateways",
  addGateway: "Add gateway",
  gateway: "Gateway",
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
function ProviderHubPage(props) {
  const { t, call } = props;
  const [state, setState] = import_react.default.useState({ gateways: [], catalog: {}, selected: null });
  const [status, setStatus] = import_react.default.useState(null);
  const [busy, setBusy] = import_react.default.useState(false);
  const [customRows, setCustomRows] = import_react.default.useState({});
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
      const nextCustom = {};
      const nextOverrides = {};
      const nextHeaders = {};
      for (const g of value.gateways) {
        nextCustom[g.index] = (g.gateway.customModels ?? []).map((m) => ({
          id: String(m.id ?? ""),
          name: String(m.name ?? ""),
          contextWindow: String(m.contextWindow ?? ""),
          maxTokens: String(m.maxTokens ?? ""),
          reasoningEfforts: JSON.stringify(m.reasoningEfforts ?? {})
        }));
        nextOverrides[g.index] = JSON.stringify(g.gateway.modelOverrides ?? {}, null, 2);
        nextHeaders[g.index] = JSON.stringify(g.gateway.extraHeaders ?? {}, null, 2);
      }
      setCustomRows(nextCustom);
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
      const r = await call("add-gateway", {});
      if (!r.ok) setStatus({ kind: "err", text: String(r.error ?? "") });
      else {
        const index = r.index;
        setStatus({ kind: "ok", text: t("saved") });
        void refresh();
        setState((s) => ({ ...s, selected: index }));
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
  const addCustomRow = () => {
    const selected2 = state.selected;
    if (selected2 === null) return;
    setCustomRows((rows) => ({
      ...rows,
      [selected2]: [...rows[selected2] ?? [], { id: "", name: "", contextWindow: "", maxTokens: "", reasoningEfforts: "{}" }]
    }));
  };
  const saveCustomRow = async (rowIndex) => {
    const selected2 = state.selected;
    if (selected2 === null) return;
    const row = (customRows[selected2] ?? [])[rowIndex];
    if (row === void 0 || row.id.trim() === "") {
      setStatus({ kind: "err", text: t("modelId") + " " + t("required") });
      return;
    }
    let reasoningEfforts = {};
    try {
      reasoningEfforts = JSON.parse(row.reasoningEfforts || "{}");
    } catch {
      setStatus({ kind: "err", text: "reasoningEfforts: invalid JSON" });
      return;
    }
    const entry = {
      id: row.id.trim(),
      name: row.name.trim(),
      contextWindow: Number(row.contextWindow) || void 0,
      maxTokens: Number(row.maxTokens) || void 0,
      reasoningEfforts
    };
    const r = await call("upsert-custom", { index: selected2, entry, originalId: { id: row.id.trim() } });
    if (!r.ok) setStatus({ kind: "err", text: String(r.error ?? "") });
    else void refresh();
  };
  const deleteCustomRow = async (id) => {
    const selected2 = state.selected;
    if (selected2 === null) return;
    const r = await call("delete-custom", { index: selected2, id });
    if (!r.ok) setStatus({ kind: "err", text: String(r.error ?? "") });
    else void refresh();
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
    const r2 = await call("upsert-custom", { index: selected2, entry, originalId: null });
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
  const field = (key, label, hint, placeholder) => {
    const selected2 = state.selected;
    const entry = state.gateways.find((g) => g.index === selected2);
    const cfg2 = entry?.gateway ?? {};
    return import_react.default.createElement(
      "div",
      { className: "phub-field", key },
      import_react.default.createElement("label", null, label),
      import_react.default.createElement("input", {
        value: String(cfg2[key] ?? ""),
        placeholder,
        onChange: (e) => setField(key, e.target.value)
      }),
      hint === void 0 ? null : import_react.default.createElement("span", { className: "phub-hint" }, hint)
    );
  };
  const selected = state.selected;
  const selectedEntry = state.gateways.find((g) => g.index === selected);
  const cfg = selectedEntry?.gateway ?? {};
  return import_react.default.createElement(
    "div",
    { className: "phub-page" },
    // ---- Gateway list ----
    import_react.default.createElement(
      "section",
      { className: "phub-section" },
      import_react.default.createElement("h3", null, t("gateways")),
      state.gateways.length === 0 ? import_react.default.createElement("span", { className: "phub-hint" }, t("empty")) : state.gateways.map((g) => import_react.default.createElement(
        "div",
        {
          key: g.index,
          className: `phub-gw-item${selected === g.index ? " phub-gw-item-selected" : ""}`
        },
        import_react.default.createElement(
          "button",
          {
            className: "phub-gw-name",
            onClick: () => setState((s) => ({ ...s, selected: s.selected === g.index ? null : g.index }))
          },
          `${String(g.gateway.displayName ?? g.gateway.provider ?? "")} (${String(g.gateway.provider ?? "")})`
        ),
        import_react.default.createElement(
          "span",
          { className: "phub-hint" },
          `${String(g.gateway.api ?? "")}${g.gateway.baseURL ? ` · ${String(g.gateway.baseURL)}` : ""}`
        ),
        import_react.default.createElement("button", { className: "phub-btn phub-gw-del", onClick: () => deleteGateway(g.index) }, t("delete"))
      )),
      import_react.default.createElement(
        "div",
        { className: "phub-actions" },
        import_react.default.createElement("button", { className: "phub-btn", onClick: addGateway }, `+ ${t("addGateway")}`),
        // Surface operation outcomes (success/failure) even before any
        // gateway is selected; otherwise a failed call looks like a dead
        // button (the editor status line only renders when selected != null).
        status === null ? null : import_react.default.createElement("span", { className: `phub-status ${status.kind}` }, status.text)
      )
    ),
    // ---- Per-gateway editor ----
    selected === null || selectedEntry === void 0 ? null : import_react.default.createElement(
      "section",
      { className: "phub-section" },
      import_react.default.createElement("h3", null, `${t("gateway")}: ${String(cfg.displayName ?? cfg.provider ?? "")}`),
      import_react.default.createElement(
        "div",
        { className: "phub-grid" },
        field("provider", t("providerName"), t("providerNameHint")),
        field("displayName", t("displayName")),
        field("baseURL", `${t("baseURL")} *`, void 0, t("baseURLPlaceholder")),
        import_react.default.createElement(
          "div",
          { className: "phub-field" },
          import_react.default.createElement("label", null, t("api")),
          import_react.default.createElement(
            "select",
            {
              value: String(cfg.api ?? "anthropic-messages"),
              onChange: (e) => setField("api", e.target.value)
            },
            import_react.default.createElement("option", { value: "anthropic-messages" }, "anthropic-messages"),
            import_react.default.createElement("option", { value: "openai-completions" }, "openai-completions")
          )
        ),
        field("userAgent", t("userAgent")),
        import_react.default.createElement(
          "div",
          { className: "phub-field" },
          import_react.default.createElement("label", null, t("systemRole")),
          import_react.default.createElement(
            "select",
            {
              value: String(cfg.systemRole ?? "system"),
              onChange: (e) => setField("systemRole", e.target.value)
            },
            import_react.default.createElement("option", { value: "system" }, "system"),
            import_react.default.createElement("option", { value: "developer" }, "developer")
          )
        ),
        field("apiKey", t("apiKey")),
        field("apiKeyEnv", t("apiKeyEnv"), t("apiKeyHint")),
        import_react.default.createElement(
          "label",
          { style: { display: "flex", alignItems: "center", gap: 8 } },
          import_react.default.createElement("input", {
            type: "checkbox",
            checked: Boolean(cfg.anthropicThinking),
            onChange: (e) => setField("anthropicThinking", e.target.checked)
          }),
          t("anthropicThinking")
        )
      ),
      import_react.default.createElement(
        "div",
        { className: "phub-field phub-headers" },
        import_react.default.createElement("label", null, `${t("extraHeaders")} (JSON)`),
        import_react.default.createElement("textarea", {
          value: headersText[selected] ?? "",
          onChange: (e) => setHeadersText((h) => ({ ...h, [selected]: e.target.value }))
        })
      ),
      import_react.default.createElement(
        "div",
        { className: "phub-actions" },
        import_react.default.createElement("button", { className: "phub-btn", disabled: busy, onClick: () => void save() }, t("save")),
        status === null ? null : import_react.default.createElement("span", { className: `phub-status ${status.kind}` }, status.text)
      ),
      // ---- Models ----
      import_react.default.createElement("h3", { style: { marginTop: 16 } }, t("models")),
      import_react.default.createElement(
        "div",
        { className: "phub-builtin" },
        import_react.default.createElement("span", { className: "phub-hint" }, t("builtinHint")),
        Object.entries(state.catalog).map(([id, entry]) => import_react.default.createElement(
          "label",
          { key: id },
          import_react.default.createElement("input", {
            type: "checkbox",
            checked: (cfg.enabledModels ?? []).includes(id),
            onChange: (e) => toggleBuiltin(id, e.target.checked)
          }),
          import_react.default.createElement("span", null, entry.name),
          import_react.default.createElement("span", { className: "phub-params" }, `${entry.contextWindow} / ${entry.maxTokens}`)
        ))
      ),
      import_react.default.createElement(
        "div",
        { className: "phub-field phub-overrides", style: { marginTop: 10 } },
        import_react.default.createElement("label", null, `${t("overrides")} (JSON)`),
        import_react.default.createElement("textarea", {
          value: overridesText[selected] ?? "",
          onChange: (e) => setOverridesText((o) => ({ ...o, [selected]: e.target.value }))
        }),
        import_react.default.createElement(
          "div",
          { className: "phub-actions" },
          import_react.default.createElement("button", { className: "phub-btn", onClick: saveOverrides }, t("save"))
        )
      ),
      import_react.default.createElement(
        "div",
        { className: "phub-custom", style: { marginTop: 12 } },
        import_react.default.createElement("label", null, t("custom")),
        (customRows[selected] ?? []).length === 0 ? import_react.default.createElement("span", { className: "phub-hint" }, t("empty")) : null,
        (customRows[selected] ?? []).map((row, rowIndex) => import_react.default.createElement(
          "div",
          { className: "phub-custom-item", key: rowIndex },
          import_react.default.createElement("input", {
            placeholder: t("modelId"),
            value: row.id,
            onChange: (e) => {
              const next = [...customRows[selected] ?? []];
              next[rowIndex] = { ...row, id: e.target.value };
              setCustomRows((rows) => ({ ...rows, [selected]: next }));
            }
          }),
          import_react.default.createElement("input", {
            placeholder: t("modelName"),
            value: row.name,
            onChange: (e) => {
              const next = [...customRows[selected] ?? []];
              next[rowIndex] = { ...row, name: e.target.value };
              setCustomRows((rows) => ({ ...rows, [selected]: next }));
            }
          }),
          import_react.default.createElement("input", {
            placeholder: t("contextWindow"),
            value: row.contextWindow,
            onChange: (e) => {
              const next = [...customRows[selected] ?? []];
              next[rowIndex] = { ...row, contextWindow: e.target.value };
              setCustomRows((rows) => ({ ...rows, [selected]: next }));
            }
          }),
          import_react.default.createElement("input", {
            placeholder: t("maxTokens"),
            value: row.maxTokens,
            onChange: (e) => {
              const next = [...customRows[selected] ?? []];
              next[rowIndex] = { ...row, maxTokens: e.target.value };
              setCustomRows((rows) => ({ ...rows, [selected]: next }));
            }
          }),
          import_react.default.createElement("button", { className: "phub-btn", onClick: () => void saveCustomRow(rowIndex) }, t("save")),
          import_react.default.createElement("button", { className: "phub-btn", onClick: () => void deleteCustomRow(row.id) }, t("delete"))
        )),
        import_react.default.createElement(
          "div",
          { className: "phub-actions" },
          import_react.default.createElement("button", { className: "phub-btn", onClick: addCustomRow }, `+ ${t("addCustom")}`)
        )
      ),
      import_react.default.createElement(
        "div",
        { className: "phub-preset", style: { marginTop: 12 } },
        import_react.default.createElement("span", { className: "phub-hint" }, t("presetHint")),
        import_react.default.createElement(
          "select",
          {
            value: presetProvider[selected] ?? "",
            onChange: (e) => void loadPresetModels(e.target.value)
          },
          import_react.default.createElement("option", { value: "" }, "—"),
          presetProviders.map((p) => import_react.default.createElement("option", { key: p.provider, value: p.provider }, `${p.displayName} (${p.provider})`))
        ),
        import_react.default.createElement(
          "select",
          {
            value: presetModel[selected] ?? "",
            disabled: (presetModels[selected] ?? []).length === 0,
            onChange: (e) => setPresetModel((p) => ({ ...p, [selected]: e.target.value }))
          },
          import_react.default.createElement("option", { value: "" }, "—"),
          (presetModels[selected] ?? []).map((m) => import_react.default.createElement("option", { key: m.id, value: m.id }, m.name ?? m.id))
        ),
        import_react.default.createElement("button", { className: "phub-btn", disabled: (presetModel[selected] ?? "") === "", onClick: () => void importPreset() }, t("importPreset"))
      ),
      import_react.default.createElement(
        "div",
        { className: "phub-actions", style: { marginTop: 12 } },
        import_react.default.createElement("button", { className: "phub-btn", disabled: busy, onClick: () => void runDiscover() }, t("discover")),
        import_react.default.createElement("span", { className: "phub-hint" }, t("discoverHint"))
      ),
      import_react.default.createElement(
        "div",
        { className: "phub-actions", style: { marginTop: 8 } },
        import_react.default.createElement("button", { className: "phub-btn", onClick: () => void snapshotCatalog() }, t("snapshot")),
        import_react.default.createElement("button", { className: "phub-btn", onClick: () => void restoreCatalog() }, t("restore")),
        import_react.default.createElement("span", { className: "phub-hint" }, t("snapshotHint"))
      ),
      discovered[selected] === null || discovered[selected] === void 0 ? null : import_react.default.createElement(
        "div",
        { className: "phub-discover-list" },
        (discovered[selected] ?? []).map((model) => import_react.default.createElement(
          "div",
          { className: "phub-discover-item", key: model.id },
          import_react.default.createElement("span", null, `${model.id}${model.contextWindow !== void 0 ? ` · ${model.contextWindow}` : ""}${model.maxTokens !== void 0 ? ` / ${model.maxTokens}` : ""}`),
          import_react.default.createElement("button", { className: "phub-btn", onClick: () => void enableDiscovered(model) }, t("enable")),
          import_react.default.createElement("button", { className: "phub-btn", onClick: () => void adoptDiscovered(model) }, t("adopt"))
        ))
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
