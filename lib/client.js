window.__ModuleLoader__.load({
  id: "@tappat225/dsh-provider-hub",
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
var import_client = require("@deepseek-ai/dsh-client-runtime/client");

// src/client/page.tsx
var import_react = __toESM(require("react"), 1);
var import_dsh_client_ui_primitives = require("@deepseek-ai/dsh-client-ui-primitives");

// src/client/page.css.ts
var page_css_default = `
/* Community Market-style first-class panel: a footer action above settings
   opens an accessible shell.overlay dialog rather than injecting DOM nodes. */
.phub-panel-launcher { flex: none; box-sizing: border-box; appearance: none; -webkit-appearance: none; display: inline-flex; align-items: center; width: calc(100% + 4px); height: 42px; margin: 4px -2px; padding: 0 10px 0 8px; gap: 8px; justify-content: flex-start !important; overflow: hidden; border: 0 !important; border-radius: 12px; outline: none; background: transparent !important; color: var(--dsw-alias-label-secondary) !important; font: inherit; font-size: 13px; line-height: 20px; cursor: pointer; white-space: nowrap; box-shadow: none !important; }
.phub-panel-launcher[data-wide='false'] { width: 36px; height: 36px; margin: 8px 0 10px; justify-content: center !important; gap: 0; padding: 0; border-radius: 50%; }
.phub-panel-launcher:hover { background: var(--dsw-alias-interactive-bg-hover) !important; color: var(--dsw-alias-label-primary) !important; }
.phub-panel-launcher:focus { outline: none; }
.phub-panel-launcher:focus-visible { outline: 2px solid var(--dsw-alias-state-business-primary); outline-offset: 2px; }
.phub-panel-overlay { position: fixed; inset: 0; z-index: 1000; display: flex; align-items: center; justify-content: center; padding: 24px; pointer-events: auto; }
.phub-panel-mask { position: absolute; inset: 0; border: 0; background: var(--dsw-alias-bg-mask-1); backdrop-filter: var(--dsw-mask-blur); cursor: default; }
.phub-panel-sheet { position: relative; z-index: 1; display: flex; flex-direction: column; width: min(1060px, 100%); height: min(820px, calc(100vh - 48px)); min-width: 0; min-height: 0; overflow: hidden; border: 1px solid var(--dsw-alias-border-inverted, var(--dsw-alias-border-l2)); border-radius: 24px; background: var(--dsw-alias-bg-layer-2); box-shadow: var(--dsw-shadow-lv3); }
.phub-panel-header { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex: none; padding: 18px 20px 16px 24px; border-bottom: 1px solid var(--dsw-alias-border-l1, var(--dsw-alias-border-l2)); }
.phub-brand { display: flex; align-items: center; gap: 12px; min-width: 0; }
.phub-brandMark { width: 36px; height: 36px; flex: none; display: grid; place-items: center; border-radius: 10px; background: var(--dsw-alias-brand-primary); color: var(--dsw-alias-bg-base, #fff); box-shadow: 0 8px 24px color-mix(in srgb, var(--dsw-alias-brand-primary) 28%, transparent); }
.phub-panel-header h1 { margin: 0; font-size: 18px; line-height: 26px; color: var(--dsw-alias-label-primary); }
.phub-panel-header p { margin: 2px 0 0; color: var(--dsw-alias-label-tertiary); font-size: 12px; line-height: 18px; }
.phub-iconBtn { width: 32px; height: 32px; flex: none; display: inline-flex; align-items: center; justify-content: center; border: 1px solid var(--dsw-alias-border-l2); border-radius: 8px; background: transparent; color: var(--dsw-alias-label-secondary); font: inherit; font-size: 16px; line-height: 1; cursor: pointer; transition: background 0.12s ease, color 0.12s ease; }
.phub-iconBtn:hover { background: var(--dsw-alias-interactive-bg-hover); color: var(--dsw-alias-label-primary); }
.phub-panel-body { container-type: inline-size; container-name: phub; flex: 1 1 auto; min-width: 0; min-height: 0; overflow: auto; overscroll-behavior: contain; padding: 18px 22px 26px; }

/* Page column. */
.phub-page { display: flex; flex-direction: column; gap: 16px; padding: 0; }
.phub-intro { margin: 0; padding: 0 2px; font-size: 13px; line-height: 20px; color: var(--dsw-alias-label-tertiary); }

/* Hero card: brand-tinted gradient + StateDot headline + primary actions. */
.phub-hero { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; padding: 18px; box-sizing: border-box; border: 1px solid color-mix(in srgb, var(--dsw-alias-brand-primary) 22%, var(--dsw-alias-border-l2)); border-radius: 14px; background: linear-gradient(135deg, color-mix(in srgb, var(--dsw-alias-brand-primary) 9%, var(--dsw-alias-bg-layer-2)), var(--dsw-alias-bg-layer-3)); box-shadow: 0 12px 36px color-mix(in srgb, #000 7%, transparent); }
.phub-heroMain { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
.phub-heroStatus { display: flex; align-items: center; gap: 8px; }
.phub-heroTitle { margin: 0; font-size: 16px; line-height: 24px; font-weight: 650; color: var(--dsw-alias-label-primary); }
.phub-heroMeta { font-size: 13px; line-height: 20px; color: var(--dsw-alias-label-secondary); font-variant-numeric: tabular-nums; }
.phub-heroHelp { font-size: 12px; line-height: 1.55; color: var(--dsw-alias-label-tertiary); max-width: 640px; }
.phub-actions { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }

/* Transient status flash (saved / model ops / remote errors). */
.phub-statusFlash { padding: 8px 12px; border: 1px solid; border-radius: 9px; font-size: 12px; line-height: 18px; overflow-wrap: anywhere; }
.phub-statusFlash-ok { color: var(--dsw-alias-state-success-primary, #98c379); border-color: color-mix(in srgb, var(--dsw-alias-state-success-primary, #98c379) 40%, transparent); background: color-mix(in srgb, var(--dsw-alias-state-success-primary, #98c379) 9%, transparent); }
.phub-statusFlash-err { color: var(--dsw-alias-state-error-primary, #e06c75); border-color: color-mix(in srgb, var(--dsw-alias-state-error-primary, #e06c75) 40%, transparent); background: color-mix(in srgb, var(--dsw-alias-state-error-primary, #e06c75) 9%, transparent); }

/* Segmented tabs (providers / catalog). */
.phub-tabs { display: flex; gap: 4px; width: max-content; max-width: 100%; padding: 4px; box-sizing: border-box; border: 1px solid var(--dsw-alias-border-l2); border-radius: 10px; background: var(--dsw-alias-bg-layer-1); }
.phub-tab { display: inline-flex; align-items: center; gap: 6px; padding: 7px 14px; border: 0; border-radius: 7px; background: transparent; color: var(--dsw-alias-label-secondary); font: inherit; font-size: 13px; line-height: 18px; cursor: pointer; transition: background 0.12s ease, color 0.12s ease; white-space: nowrap; }
.phub-tab:hover { color: var(--dsw-alias-label-primary); }
.phub-tab[data-active='true'] { background: var(--dsw-alias-interactive-bg-active); color: var(--dsw-alias-label-primary); font-weight: 600; box-shadow: 0 1px 4px color-mix(in srgb, #000 8%, transparent); }
.phub-tab:focus-visible { outline: 2px solid var(--dsw-alias-brand-primary); outline-offset: 2px; }
.phub-tabCount { font-size: 11px; color: var(--dsw-alias-label-tertiary); font-variant-numeric: tabular-nums; }

/* Section title row: h3 + help on the left, actions on the right. */
.phub-sectionTitle { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; margin-top: 2px; }
.phub-sectionTitle h3 { margin: 0 0 4px; font-size: 15px; line-height: 22px; color: var(--dsw-alias-label-primary); }
.phub-sectionHelp { font-size: 12px; line-height: 1.55; color: var(--dsw-alias-label-tertiary); max-width: 620px; }

/* Card grid: one provider per card, auto-fit with a floor width. */
.phub-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(330px, 100%), 1fr)); gap: 12px; }
.phub-card { display: flex; flex-direction: column; min-width: 0; padding: 14px; box-sizing: border-box; border: 1px solid color-mix(in srgb, var(--dsw-alias-border-l2) 82%, transparent); border-radius: 12px; background: var(--dsw-alias-bg-layer-3); box-shadow: 0 7px 24px color-mix(in srgb, #000 5%, transparent); transition: transform 0.16s ease, border-color 0.16s ease, box-shadow 0.16s ease; }
.phub-card:hover { transform: translateY(-1px); border-color: color-mix(in srgb, var(--dsw-alias-brand-primary) 30%, var(--dsw-alias-border-l2)); box-shadow: 0 10px 30px color-mix(in srgb, #000 8%, transparent); }
.phub-cardHead { display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; }
.phub-cardName { font-size: 14px; font-weight: 600; color: var(--dsw-alias-label-primary); overflow-wrap: anywhere; }
.phub-meta { margin-top: 6px; font-size: 12px; line-height: 1.5; color: var(--dsw-alias-label-secondary); overflow-wrap: anywhere; }
.phub-models { display: flex; gap: 5px; flex-wrap: wrap; margin: 12px 0; }
.phub-chip { font-size: 11px; line-height: 16px; padding: 3px 8px; border-radius: 999px; background: var(--dsw-alias-bg-layer-2); color: var(--dsw-alias-label-secondary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 100%; }
.phub-cardFoot { font-size: 12px; line-height: 1.5; color: var(--dsw-alias-label-tertiary); overflow-wrap: anywhere; }
.phub-rowActions { display: flex; gap: 4px; justify-content: flex-end; margin-top: 12px; }
.phub-danger { color: var(--dsw-alias-state-error-primary, #e06c75) !important; }

/* Editor card: two-column form grid with label-over-control fields. */
.phub-editorCard { gap: 14px; padding: 16px; }
/* The JSON editor grows via CSS resize; keep the card's action row in reach
   by pinning it to the bottom of the scrollable panel body while content
   above it scrolls. No negative margins: the connection-test banner may
   follow the row in flow and must never slide under it. */
.phub-editorCard > .phub-actions { position: sticky; bottom: 0; z-index: 2; justify-content: flex-end; padding-top: 10px; margin-top: 4px; background: linear-gradient(color-mix(in srgb, var(--dsw-alias-bg-layer-3) 82%, transparent), var(--dsw-alias-bg-layer-3)); }
.phub-form { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
.phub-field { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
.phub-wide { grid-column: 1 / -1; }
.phub-label { font-size: 12px; line-height: 18px; font-weight: 600; color: var(--dsw-alias-label-secondary); }
.phub-hint { font-size: 12px; line-height: 1.5; color: var(--dsw-alias-label-tertiary); }
.phub-inline { display: flex; gap: 8px; align-items: center; min-width: 0; }
.phub-inline > .phub-input { flex: 1; min-width: 0; width: auto; }
.phub-divider { border: 0; border-top: 1px solid var(--dsw-alias-border-l2); margin: 2px 0; }

/* Editor section head (请求头 / 模型配置 / 配置 JSON): title+hint left, actions right. */
.phub-sectionHead { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; }
.phub-sectionHeadText { display: flex; flex-direction: column; gap: 3px; min-width: 0; }

/* Key-value row grids (headers / model rows, cc-switch recipe): inputs left,
   trash right; a column-label head row shares the same grid template. */
.phub-kvWrap { display: flex; flex-direction: column; gap: 8px; }
.phub-kvHead { align-items: end; padding-bottom: 2px; }
.phub-kvLabel { font-size: 11px; line-height: 16px; color: var(--dsw-alias-label-tertiary); }
.phub-kvGrid { display: grid; gap: 8px; align-items: center; min-width: 0; }
.phub-kvGrid .phub-input { min-width: 0; width: 100%; }
.phub-kvHeaders { grid-template-columns: minmax(0, 1fr) minmax(0, 1.6fr) auto; }
.phub-kvModels { grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr) auto; }

/* Model-id autocomplete: a relative wrapper around the row's id input; the
   suggestion list drops below it and overlays the rows underneath (above
   the sticky action row, which sits at z-index 2). */
.phub-acWrap { position: relative; min-width: 0; }
.phub-acList { position: absolute; top: calc(100% + 4px); left: 0; right: 0; z-index: 30; max-height: 264px; overflow-y: auto; padding: 4px; box-sizing: border-box; border: 1px solid var(--dsw-alias-border-l2); border-radius: 10px; background: var(--dsw-alias-bg-layer-2); box-shadow: 0 12px 32px color-mix(in srgb, #000 18%, transparent); }
.phub-acItem { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 6px 8px; border-radius: 7px; cursor: pointer; }
.phub-acItem:hover, .phub-acItem[data-active='true'] { background: var(--dsw-alias-interactive-bg-hover); }
.phub-acItem[data-taken='true'] { opacity: 0.55; }
.phub-acId { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 12px; line-height: 18px; color: var(--dsw-alias-label-primary); font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
.phub-acMeta { flex: none; max-width: 58%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 11px; line-height: 16px; color: var(--dsw-alias-label-tertiary); font-variant-numeric: tabular-nums; }
.phub-acEmpty { padding: 6px 8px; font-size: 11px; line-height: 16px; color: var(--dsw-alias-label-tertiary); }

/* Inputs / selects / textareas. */
.phub-input { height: 32px; padding: 0 10px; border: 1px solid var(--dsw-alias-border-l2); border-radius: 8px; background: var(--dsw-alias-bg-layer-2); color: var(--dsw-alias-label-primary); font: inherit; box-sizing: border-box; min-width: 0; width: 100%; }
.phub-input:focus { outline: none; border-color: var(--dsw-alias-state-business-primary); }
/* Dropdown anchor (primitives Menu trigger): looks like an input, acts like
   a button. The popup itself is the platform Menu (dark theme, check mark). */
.phub-select-anchor { display: inline-flex; align-items: center; gap: 6px; height: 32px; min-width: 160px; max-width: 260px; padding: 0 10px; box-sizing: border-box; border: 1px solid var(--dsw-alias-border-l2); border-radius: 8px; background: var(--dsw-alias-bg-layer-2); color: var(--dsw-alias-label-primary); font: inherit; font-size: 13px; line-height: 20px; cursor: pointer; transition: border-color 0.12s ease; }
.phub-select-anchor:hover:not(:disabled) { border-color: var(--dsw-alias-label-dimmed); }
.phub-select-anchor:disabled { opacity: 0.5; cursor: default; }
.phub-select-anchor-text { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; text-align: left; }
.phub-select-anchor:focus-visible { outline: 2px solid var(--dsw-alias-state-business-primary); outline-offset: 2px; }
/* Compact anchor for inline use beside an input (UA presets etc.). */
.phub-select-compact { min-width: 0; }
/* Block anchor fills its form field. */
.phub-select-anchor-block { width: 100%; min-width: 0; max-width: none; justify-content: space-between; }
.phub-textarea { width: 100%; min-height: 96px; max-height: 280px; padding: 8px 10px; border: 1px solid var(--dsw-alias-border-l2); border-radius: 8px; background: var(--dsw-alias-bg-layer-2); color: var(--dsw-alias-label-primary); font: 12px/1.5 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; box-sizing: border-box; resize: vertical; display: block; }
.phub-textarea:focus { outline: none; border-color: var(--dsw-alias-state-business-primary); }
.phub-textarea-invalid, .phub-textarea-invalid:focus { border-color: var(--dsw-alias-state-error-primary, #e06c75); }

/* Dashed add card (the DSH "add plugin" card recipe) as a grid item. */
.phub-add-card { display: flex; align-items: center; justify-content: center; gap: 8px; min-height: 64px; border: 1px dashed var(--dsw-alias-border-l2); border-radius: 12px; background: transparent; color: var(--dsw-alias-label-secondary); font: inherit; cursor: pointer; transition: background 0.12s ease, border-color 0.12s ease, color 0.12s ease; }
.phub-add-card:hover { border-color: var(--dsw-alias-label-dimmed); background: var(--dsw-alias-interactive-bg-hover); color: var(--dsw-alias-label-primary); }

/* Empty state. */
.phub-empty { display: flex; flex-direction: column; align-items: center; gap: 6px; grid-column: 1 / -1; padding: 30px 14px; text-align: center; border: 1px dashed var(--dsw-alias-border-l2); border-radius: 12px; color: var(--dsw-alias-label-tertiary); }
.phub-empty-title { font-size: 14px; line-height: 22px; color: var(--dsw-alias-label-secondary); }
.phub-empty-desc { font-size: 12px; line-height: 18px; color: var(--dsw-alias-label-tertiary); max-width: 460px; }

/* Sub-section heading inside the editor card. */
.phub-subhead { display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap; }
.phub-subhead-title { font-size: 12px; line-height: 18px; font-weight: 600; color: var(--dsw-alias-label-secondary); }
.phub-subhead-hint { font-size: 12px; line-height: 18px; color: var(--dsw-alias-label-tertiary); }

/* Connection-test banner (green ok / red fail, sample ids in mono). */
.phub-test-result { display: flex; flex-direction: column; gap: 3px; padding: 10px 12px; box-sizing: border-box; border: 1px solid; border-radius: 10px; font-size: 12px; line-height: 18px; }
.phub-test-ok { border-color: color-mix(in srgb, var(--dsw-alias-state-success-primary, #98c379) 45%, transparent); background: color-mix(in srgb, var(--dsw-alias-state-success-primary, #98c379) 8%, transparent); color: var(--dsw-alias-state-success-primary, #98c379); }
.phub-test-err { border-color: color-mix(in srgb, var(--dsw-alias-state-error-primary, #e06c75) 45%, transparent); background: color-mix(in srgb, var(--dsw-alias-state-error-primary, #e06c75) 8%, transparent); color: var(--dsw-alias-state-error-primary, #e06c75); }
.phub-test-detail { color: var(--dsw-alias-label-secondary); font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; word-break: break-all; }

/* Spinner (loading icon while testing / fetching). */
.phub-spin { animation: phub-spin 1s linear infinite; }
@keyframes phub-spin { to { transform: rotate(360deg); } }

/* Error-boundary fallback. */
.phub-error { margin: 0; padding: 10px 12px; border: 1px solid var(--dsw-alias-border-l2); border-radius: 8px; background: var(--dsw-alias-bg-layer-2); color: var(--dsw-alias-label-secondary); font: 12px/1.6 ui-monospace, monospace; white-space: pre-wrap; word-break: break-word; }
/* Boundary retry button (plain neutral chrome). */
.phub-btn { height: 32px; padding: 0 14px; border: 1px solid var(--dsw-alias-border-l2); border-radius: 8px; background: var(--dsw-alias-bg-layer-2); color: var(--dsw-alias-label-primary); font: inherit; cursor: pointer; }
.phub-btn:hover:not(:disabled) { background: var(--dsw-alias-interactive-bg-hover); }

/* Narrow sheets: stack the form, single-column grid. */
@container phub (max-width: 780px) {
  .phub-form { grid-template-columns: minmax(0, 1fr); }
  .phub-grid { grid-template-columns: minmax(0, 1fr); }
  .phub-kvHeaders { grid-template-columns: minmax(0, 1fr) auto; }
  .phub-kvModels { grid-template-columns: minmax(0, 1fr) auto; }
  .phub-kvHead > span:nth-child(2) { display: none; }
  .phub-kvGrid .phub-kvValue { grid-column: 1 / -1; }
  .phub-hero { flex-direction: column; align-items: stretch; }
  .phub-sectionTitle { flex-direction: column; align-items: flex-start; gap: 8px; }
  .phub-panel-body { padding: 14px 14px 22px; }
}
`;

// src/client/locales.ts
var zh = {
  nav: "Provider Hub",
  panelTitle: "Provider Hub",
  panelSubtitle: "多提供方模型网关、凭据与模型目录",
  panelClose: "关闭模型配置",
  intro: "统一管理提供方、模型目录与模型发现；所有改动即时生效，无需手改 settings.yaml。",
  gateways: "提供方",
  addGateway: "添加提供方",
  gateway: "提供方设置",
  emptyTitle: "还没有提供方",
  emptyHint: "添加一个提供方，配置上游端点后即可在 DSH 模型选择器中使用其模型。",
  providerName: "提供方 ID",
  providerNameHint: "模型选择器中的分组标识",
  displayName: "显示名",
  baseURL: "上游地址",
  baseURLHint: "末尾带不带 /v1 均可，自动适配",
  baseURLHintCustom: "custom 模式：完整模型列表 URL（原样使用，不自动补 /v1）",
  baseURLPlaceholder: "https://api.example.com",
  api: "协议",
  endpointMode: "端点模式",
  endpointModeHint: "auto=自动补全请求路径（/v1 自适应）；custom=完整地址原样请求",
  endpointModeAuto: "自动补齐 (auto)",
  endpointModeCustom: "完整地址 (custom)",
  endpoint: "对话请求地址",
  endpointHint: "custom 模式：完整对话请求 URL（含路径），原样使用，不再追加 /v1",
  endpointPlaceholder: "https://api.example.com/v1/chat/completions",
  userAgent: "User-Agent",
  userAgentHint: "留空则用默认；选预设可快速填写",
  uaPreset: "UA 预设",
  apiKey: "API Key",
  apiKeyConfiguredHint: "已配置；留空保持现有凭据。新 Key 只写入 DSH credentials。",
  show: "显示",
  hide: "隐藏",
  apiKeyEnv: "Key 环境变量",
  apiKeyHint: "字面量优先于环境变量",
  extraHeaders: "附加请求头",
  save: "保存",
  saveFailed: "保存失败",
  testConnection: "测试连接",
  testOk: "连接成功",
  testFailed: "连接失败",
  testModels: "个模型",
  testSeeded: "已填充下方模型下拉",
  testViaChat: "/models 不通，实聊验证通过",
  testNoReply: "模型未返回文本",
  models: "模型管理",
  modelsEnabled: "已启用的模型",
  modelsEmptyHint: "还没有启用模型——拉取上游模型列表，或手动添加。",
  addModel: "添加模型",
  addModelHint: "手动输入 ID 或从拉取列表选择；输入时联想内置目录，点选条目才套用预设参数（手动输完不套用）。",
  fetchedModels: "拉取到的模型",
  discoverRun: "拉取模型列表",
  presetApply: "使用预设参数",
  noPresetMatch: "无匹配的内置预设",
  fixJsonFirst: "配置 JSON 当前无效：请先修正，再编辑模型列表",
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
  callFailed: "调用失败",
  tabCatalog: "模型目录",
  refresh: "刷新",
  heroReady: "模型网关已就绪",
  heroEmpty: "尚未配置提供方",
  unitProviders: "个提供方",
  unitModels: "个模型",
  unitPresets: "个目录预设",
  badgeConfigured: "已配置",
  badgeNoKey: "未配置 Key",
  sectionProvidersHint: "每个提供方一张卡片：测试连通性、编辑端点与凭据；已启用模型经 DSH 模型选择器即时可用。",
  sectionCatalogHint: "内置预设参数目录；模型 ID 输入时联想、点选条目即套用参数（拉取列表点选同理）。",
  modeAuto: "自动端点",
  modeCustom: "自定义端点",
  keyInline: "内联 Key",
  collapse: "收起",
  discoverHint: "用当前表单探测上游 /models，结果填充下方选择器。",
  catalogEmpty: "目录为空",
  testing: "测试中",
  headersSection: "请求头",
  headersHint: "随上游请求发送的可选 HTTP 请求头，如 HTTP-Referer 或 X-Title。",
  addHeader: "添加请求头",
  headerName: "请求头名",
  headerValue: "值",
  headerNameRequired: "请求头名不能为空",
  modelSection: "模型配置",
  modelRowsHint: "配置可用的模型及其显示名称；模型 ID 输入时联想内置目录（点选条目才套用预设参数，手动输完不自动套用）；详细参数在下方「配置 JSON」编辑。",
  configJson: "配置 JSON",
  configJsonHint: "按模型 id 的完整参数框架：name / contextWindow / maxTokens / input / reasoningEfforts，null = 未设置（内置模型保存时继承目录值，自定义模型需填 contextWindow 与 maxTokens，除非网关配置了默认值）。与模型列表双向同步：在 JSON 中手写新组即新增模型（组内 name 即显示名）、删除组即删除模型——可以完全不碰模型列表，直接在此逐项填参。点选目录预设（下拉/拉取列表）会写入完整预设值。",
  jsonInvalid: "配置 JSON 不是有效的 JSON 对象",
  modelIdRequired: "模型 ID 不能为空",
  modelIdDuplicate: "模型 ID 重复",
  alreadyInList: "已在列表中"
};
var en = {
  nav: "Provider Hub",
  panelTitle: "Provider Hub",
  panelSubtitle: "Multi-provider model gateway, credentials and catalogs",
  panelClose: "Close model configuration",
  intro: "Manage providers, model catalogs and model discovery. Every change applies live — no hand-editing settings.yaml.",
  gateways: "Providers",
  addGateway: "Add provider",
  gateway: "Provider settings",
  emptyTitle: "No providers yet",
  emptyHint: "Add a provider, point it at an upstream endpoint, and its models become available in the DSH model picker.",
  providerName: "Provider ID",
  providerNameHint: "the id that groups models in the model picker",
  displayName: "Display name",
  baseURL: "Base URL",
  baseURLHint: "with or without a trailing /v1 — both work",
  baseURLHintCustom: "custom mode: the complete model-listing URL, used verbatim (no /v1 appended)",
  baseURLPlaceholder: "https://api.example.com",
  api: "Protocol",
  endpointMode: "Endpoint mode",
  endpointModeHint: "auto derives request paths from the base URL (/v1 adaptive); custom dials the complete URLs verbatim",
  endpointModeAuto: "Auto (auto)",
  endpointModeCustom: "Complete URL (custom)",
  endpoint: "Chat request URL",
  endpointHint: "custom mode: the complete chat request URL (with path), used verbatim — no /v1 appended",
  endpointPlaceholder: "https://api.example.com/v1/chat/completions",
  userAgent: "User-Agent",
  userAgentHint: "empty uses the default; presets fill it in",
  uaPreset: "UA preset",
  apiKey: "API Key",
  apiKeyConfiguredHint: "configured; leave blank to keep the existing credential. New keys are stored only in DSH credentials.",
  show: "Show",
  hide: "Hide",
  apiKeyEnv: "Key env var",
  apiKeyHint: "literal takes precedence over env",
  extraHeaders: "Extra headers",
  save: "Save",
  saveFailed: "Save failed",
  testConnection: "Test connection",
  testOk: "Connection OK",
  testFailed: "Connection failed",
  testModels: "models",
  testSeeded: "listed in the dropdown below",
  testViaChat: "/models unreachable — verified via live chat",
  testNoReply: "model returned no text",
  models: "Models",
  modelsEnabled: "Enabled models",
  modelsEmptyHint: "No models yet — fetch the upstream listing, or add one by hand.",
  addModel: "Add model",
  addModelHint: "Type an id or pick from the fetched listing; typing suggests built-in presets and only a clicked entry applies its parameters (typing a full id alone does not).",
  fetchedModels: "Fetched models",
  discoverRun: "Fetch model list",
  presetApply: "Use preset",
  noPresetMatch: "no matching preset",
  fixJsonFirst: "the config JSON is invalid — fix it before editing the model list",
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
  callFailed: "call failed",
  tabCatalog: "Model catalog",
  refresh: "Refresh",
  heroReady: "Model gateways ready",
  heroEmpty: "No providers yet",
  unitProviders: "providers",
  unitModels: "models",
  unitPresets: "catalog presets",
  badgeConfigured: "Key set",
  badgeNoKey: "No key",
  sectionProvidersHint: "One card per provider: test connectivity, edit endpoint and credentials; enabled models appear in the DSH model picker immediately.",
  sectionCatalogHint: "Built-in preset catalog; the model-id input suggests these while typing and a clicked entry applies its parameters (fetched-list picks work the same way).",
  modeAuto: "Auto endpoint",
  modeCustom: "Custom endpoint",
  keyInline: "inline key",
  collapse: "Collapse",
  discoverHint: "Probe GET {baseURL}/models with the current form; results fill the picker below.",
  catalogEmpty: "Catalog is empty",
  testing: "Testing",
  headersSection: "Headers",
  headersHint: "Optional HTTP headers sent with upstream requests, e.g. HTTP-Referer or X-Title.",
  addHeader: "Add header",
  headerName: "Header name",
  headerValue: "Value",
  headerNameRequired: "header name must not be empty",
  modelSection: "Models",
  modelRowsHint: "Configure available models and display names; the id input suggests built-in presets while typing (only a clicked entry applies preset parameters — typing a full id alone never does); detailed parameters live in the config JSON below.",
  configJson: "Config JSON",
  configJsonHint: "Complete per-model parameter framework: name / contextWindow / maxTokens / input / reasoningEfforts, null = unset (built-in ids inherit catalog values on save; custom models need contextWindow and maxTokens unless the gateway sets defaults). Synced both ways with the model list: hand-writing a group adds the model (its name field is the display name), deleting a group removes it — you can skip the model list entirely and fill parameters here one by one. Clicking a catalog preset (dropdown / fetched list) writes its full values.",
  jsonInvalid: "Config JSON is not a valid JSON object",
  modelIdRequired: "model id must not be empty",
  modelIdDuplicate: "duplicate model id",
  alreadyInList: "already in the list"
};

// src/client/page.tsx
function posInt(value) {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}
function frameworkGroup(fields, name2) {
  const src = fields ?? {};
  const group = {
    name: name2,
    contextWindow: src.contextWindow ?? null,
    maxTokens: src.maxTokens ?? null,
    input: src.input ?? null,
    reasoningEfforts: src.reasoningEfforts ?? null
  };
  for (const [key, value] of Object.entries(src)) {
    if (!(key in group)) group[key] = value;
  }
  return group;
}
function suggestMatches(needle, catalog) {
  const q = needle.trim().toLowerCase();
  if (q === "") return [];
  const prefix = [];
  const contains = [];
  for (const id of Object.keys(catalog)) {
    const preset = catalog[id];
    const idLower = id.toLowerCase();
    const nameLower = String(preset?.name ?? "").toLowerCase();
    if (!idLower.includes(q) && !nameLower.includes(q)) continue;
    (idLower.startsWith(q) || nameLower.startsWith(q) ? prefix : contains).push(id);
  }
  const order = (list) => list.sort((a, b) => a.localeCompare(b));
  return [...order(prefix), ...order(contains)].slice(0, 8);
}
function buildEditorDraft(gateway) {
  const overrides = gateway.modelOverrides ?? {};
  const customs = gateway.customModels ?? [];
  const headers = gateway.extraHeaders ?? {};
  const modelRows = [];
  const params = {};
  const seen = /* @__PURE__ */ new Set();
  const adopt = (id, name2, fields) => {
    modelRows.push({ id, name: name2 });
    seen.add(id);
    params[id] = frameworkGroup(fields, name2 !== "" ? name2 : null);
  };
  for (const id of Array.isArray(gateway.enabledModels) ? gateway.enabledModels : []) {
    if (typeof id !== "string" || id === "" || seen.has(id)) continue;
    const ov = overrides[id];
    const hasOverride = ov !== null && typeof ov === "object";
    const name2 = hasOverride && typeof ov.name === "string" ? ov.name : "";
    let fields;
    if (hasOverride) {
      const { name: _rowOwned, ...rest } = ov;
      if (Object.keys(rest).length > 0) fields = rest;
    }
    adopt(id, name2, fields);
  }
  for (const entry of customs) {
    if (entry === null || typeof entry !== "object") continue;
    const id = String(entry.id ?? "");
    if (id === "" || seen.has(id)) continue;
    const name2 = typeof entry.name === "string" ? entry.name : "";
    const { id: _i, name: _rowOwned, ...rest } = entry;
    adopt(id, name2, Object.keys(rest).length > 0 ? rest : void 0);
  }
  const headersRows = Object.entries(headers).map(([name2, value]) => ({ name: name2, value: String(value ?? "") }));
  return {
    headersRows,
    modelRows,
    params,
    paramsText: JSON.stringify(params, null, 2),
    paramsValid: true
  };
}
var UA_PRESETS = [
  { value: "claude-cli/2.0.1 (external, cli)", title: "Claude CLI (external)" },
  { value: "claude-cli/2.1.75", title: "Claude Code 2.1.75" },
  { value: "codex_cli_rs/0.42.0 (Ubuntu 22.04.3 LTS; x86_64) Linux", title: "Codex CLI" },
  { value: "CherryStudio/1.5.0", title: "Cherry Studio" },
  { value: "Cline/3.17.8", title: "Cline" },
  { value: "Roo-Code/3.20.5", title: "Roo Code" },
  { value: "GeminiCLI/0.8.1", title: "Gemini CLI" },
  { value: "Raycast/1.98.0", title: "Raycast" },
  { value: "Chatbox/1.9.0", title: "Chatbox" },
  { value: "Zed/0.192.0", title: "Zed" }
];
function Field(label, hint, control, wide = false) {
  return import_react.default.createElement(
    "div",
    { className: wide ? "phub-field phub-wide" : "phub-field" },
    import_react.default.createElement("span", { className: "phub-label" }, label),
    control,
    hint === void 0 ? null : import_react.default.createElement("span", { className: "phub-hint" }, hint)
  );
}
function SectionHead(title, hint, actions) {
  return import_react.default.createElement(
    "div",
    { className: "phub-sectionHead" },
    import_react.default.createElement(
      "div",
      { className: "phub-sectionHeadText" },
      import_react.default.createElement("span", { className: "phub-subhead-title" }, title),
      import_react.default.createElement("span", { className: "phub-subhead-hint" }, hint)
    ),
    actions === void 0 ? null : import_react.default.createElement("div", { className: "phub-actions" }, actions)
  );
}
function TestBanner(props) {
  const { test, t } = props;
  const usage = test.usage;
  const reply = String(test.reply ?? "");
  const models = test.models ?? [];
  const viaChat = test.via === "chat";
  return import_react.default.createElement(
    "div",
    { className: `phub-test-result ${test.ok ? "phub-test-ok" : "phub-test-err"}` },
    import_react.default.createElement("span", null, !test.ok ? `✕ ${t("testFailed")}` : viaChat ? `✓ ${t("testOk")} · ${String(test.latencyMs ?? 0)}ms · ${String(test.model ?? "")} · ${t("testViaChat")}` : `✓ ${t("testOk")} · ${String(test.latencyMs ?? 0)}ms · ${String(test.modelCount ?? 0)} ${t("testModels")}${models.length > 0 ? ` · ${t("testSeeded")}` : ""}`),
    import_react.default.createElement(
      "span",
      { className: "phub-test-detail" },
      !test.ok ? String(test.error ?? "") : viaChat ? `POST ${String(test.endpoint ?? "")} → ${reply !== "" ? `"${reply}"` : t("testNoReply")}${usage !== void 0 ? ` · in ${String(usage.inputTokens)} / out ${String(usage.outputTokens)}` : ""}` : `GET ${String(test.endpoint ?? "")}${models.length > 0 ? ` → ${models.slice(0, 3).map((m) => m.id).join(", ")}${models.length > 3 ? " …" : ""}` : ""}`
    )
  );
}
function SelectMenu(props) {
  const [open, setOpen] = import_react.default.useState(false);
  const selected = props.options.find((o) => o.value === props.value);
  const cls = ["phub-select-anchor"];
  if (props.compact === true) cls.push("phub-select-compact");
  if (props.block === true) cls.push("phub-select-anchor-block");
  const anchor = import_react.default.createElement(
    "button",
    {
      type: "button",
      className: cls.join(" "),
      disabled: props.disabled === true,
      "aria-haspopup": "listbox",
      "aria-expanded": open,
      "aria-label": props.label,
      onClick: () => setOpen((now) => !now)
    },
    import_react.default.createElement(
      "span",
      { className: "phub-select-anchor-text" },
      selected?.title ?? props.placeholder ?? (props.value.length > 0 ? props.value : "—")
    ),
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
  const [tab, setTab] = import_react.default.useState("providers");
  const [drafts, setDrafts] = import_react.default.useState({});
  const [discovered, setDiscovered] = import_react.default.useState({});
  const [testing, setTesting] = import_react.default.useState(null);
  const [discovering, setDiscovering] = import_react.default.useState(null);
  const [testResult, setTestResult] = import_react.default.useState({});
  const [showKey, setShowKey] = import_react.default.useState({});
  const [ac, setAc] = import_react.default.useState(null);
  const refresh = import_react.default.useCallback(async () => {
    try {
      const r = await call("get-state");
      if (!r.ok) {
        setStatus({ kind: "err", text: String(r.error ?? "getState failed") });
        return;
      }
      const value = r;
      setState((s) => ({ ...s, gateways: value.gateways, catalog: value.catalog }));
      const nextDrafts = {};
      for (const g of value.gateways) nextDrafts[g.index] = buildEditorDraft(g.gateway);
      setDrafts(nextDrafts);
    } catch {
      setStatus({ kind: "err", text: t("remotePending") });
    }
  }, [call, t]);
  import_react.default.useEffect(() => {
    void refresh();
  }, [refresh]);
  const updateDraft = (index, next) => {
    setDrafts((d) => d[index] === void 0 ? d : { ...d, [index]: next(d[index]) });
  };
  const save = async () => {
    setBusy(true);
    try {
      const selected2 = state.selected;
      if (selected2 === null) return false;
      const entry = state.gateways.find((g) => g.index === selected2);
      if (entry === void 0) return false;
      const draft2 = drafts[selected2];
      const modelRows = draft2?.modelRows ?? [];
      const ids = modelRows.map((row) => row.id.trim());
      if (ids.some((id) => id === "")) {
        setStatus({ kind: "err", text: t("modelIdRequired") });
        return false;
      }
      if (new Set(ids).size !== ids.length) {
        setStatus({ kind: "err", text: t("modelIdDuplicate") });
        return false;
      }
      const params = draft2?.params ?? {};
      if (draft2 !== void 0 && !draft2.paramsValid) {
        setStatus({ kind: "err", text: t("jsonInvalid") });
        return false;
      }
      const extraHeaders = {};
      for (const row of draft2?.headersRows ?? []) {
        const name2 = row.name.trim();
        if (name2 === "" && row.value.trim() === "") continue;
        if (name2 === "") {
          setStatus({ kind: "err", text: t("headerNameRequired") });
          return false;
        }
        extraHeaders[name2] = row.value;
      }
      const cfg2 = entry.gateway;
      const patch = {
        provider: cfg2.provider,
        displayName: cfg2.displayName,
        baseURL: cfg2.baseURL,
        api: cfg2.api,
        endpointMode: cfg2.endpointMode ?? "auto",
        endpoint: cfg2.endpoint ?? "",
        userAgent: cfg2.userAgent,
        apiKey: cfg2.apiKey,
        apiKeyEnv: cfg2.apiKeyEnv,
        systemRole: cfg2.systemRole,
        extraHeaders
      };
      const r = await call("save-config", { index: selected2, patch });
      if (!r.ok) {
        setStatus({ kind: "err", text: `${t("saveFailed")}: ${String(r.error ?? "")}` });
        return false;
      }
      const rm = await call("save-models", {
        index: selected2,
        models: modelRows.map((row) => ({ id: row.id.trim(), name: row.name.trim() })),
        params
      });
      if (!rm.ok) {
        setStatus({ kind: "err", text: `${t("saveFailed")}: ${String(rm.error ?? "")}` });
        return false;
      }
      setStatus(null);
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
  const forgetTestResult = (index) => {
    setTestResult((tr) => {
      if (tr[index] === void 0 || tr[index] === null) return tr;
      const next = { ...tr };
      delete next[index];
      return next;
    });
  };
  const editorModel = () => {
    const selected2 = state.selected;
    if (selected2 === null) return "";
    for (const row of drafts[selected2]?.modelRows ?? []) {
      const id = row.id.trim();
      if (id !== "") return id;
    }
    return "";
  };
  const buildDraft = () => {
    const selected2 = state.selected;
    if (selected2 === null) return null;
    const entry = state.gateways.find((g) => g.index === selected2);
    if (entry === void 0) return null;
    const cfg2 = entry.gateway;
    const extraHeaders = {};
    for (const row of drafts[selected2]?.headersRows ?? []) {
      const name2 = row.name.trim();
      if (name2 === "") continue;
      extraHeaders[name2] = row.value;
    }
    return {
      provider: cfg2.provider,
      displayName: cfg2.displayName,
      baseURL: cfg2.baseURL,
      api: cfg2.api,
      endpointMode: cfg2.endpointMode ?? "auto",
      endpoint: cfg2.endpoint ?? "",
      userAgent: cfg2.userAgent,
      apiKey: cfg2.apiKey,
      apiKeyEnv: cfg2.apiKeyEnv,
      extraHeaders,
      // The chat probe's preferred model (see editorModel).
      model: editorModel()
    };
  };
  const buildSavedDraft = (index) => {
    const entry = state.gateways.find((g) => g.index === index);
    if (entry === void 0) return null;
    const cfg2 = entry.gateway;
    return {
      provider: cfg2.provider,
      displayName: cfg2.displayName,
      baseURL: cfg2.baseURL,
      api: cfg2.api,
      endpointMode: cfg2.endpointMode ?? "auto",
      endpoint: cfg2.endpoint ?? "",
      userAgent: cfg2.userAgent,
      apiKey: cfg2.apiKey,
      apiKeyEnv: cfg2.apiKeyEnv,
      extraHeaders: cfg2.extraHeaders ?? {}
    };
  };
  const applyTestResult = (index, r) => {
    if (!r.ok) {
      setTestResult((tr) => ({ ...tr, [index]: { ok: false, error: String(r.error ?? "") } }));
      return;
    }
    const res = r;
    const models = Array.isArray(res.models) ? res.models : void 0;
    setTestResult((tr) => ({
      ...tr,
      [index]: {
        ok: true,
        via: res.via,
        endpoint: res.endpoint,
        latencyMs: res.latencyMs,
        modelCount: res.modelCount,
        models,
        model: res.model,
        reply: res.reply,
        usage: res.usage
      }
    }));
    if (models !== void 0) setDiscovered((d) => ({ ...d, [index]: models }));
  };
  const runTest = () => {
    const selected2 = state.selected;
    if (selected2 === null) return;
    const draft2 = buildDraft();
    if (draft2 === null) return;
    void (async () => {
      setTesting(selected2);
      try {
        const r = await call("test-connection", { index: selected2, draft: draft2 });
        applyTestResult(selected2, r);
      } finally {
        setTesting((current) => current === selected2 ? null : current);
      }
    })();
  };
  const runCardTest = (index) => {
    const draft2 = buildSavedDraft(index);
    if (draft2 === null) return;
    void (async () => {
      setTesting(index);
      try {
        const r = await call("test-connection", { index, draft: draft2 });
        applyTestResult(index, r);
      } finally {
        setTesting((current) => current === index ? null : current);
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
          const result = r;
          const index = result.index;
          const gateway = result.gateway;
          forgetTestResult(index);
          setTab("providers");
          if (gateway !== null && typeof gateway === "object" && !Array.isArray(gateway)) {
            const entry = { index, gateway, models: [] };
            setState((s) => ({
              ...s,
              gateways: s.gateways.some((g) => g.index === index) ? s.gateways.map((g) => g.index === index ? entry : g) : [...s.gateways, entry],
              selected: index
            }));
            setDrafts((d) => ({ ...d, [index]: buildEditorDraft(entry.gateway) }));
          } else {
            setState((s) => ({ ...s, selected: index }));
            void refresh();
          }
          setStatus(null);
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
        setStatus(null);
        setShowKey({});
        forgetTestResult(index);
        void refresh();
        setState((s) => ({ ...s, selected: s.selected === index ? null : s.selected }));
      }
    })();
  };
  const runFetchModels = () => {
    const selected2 = state.selected;
    if (selected2 === null) return;
    const draft2 = buildDraft();
    if (draft2 === null) return;
    void (async () => {
      setDiscovering(selected2);
      setDiscovered((d) => ({ ...d, [selected2]: null }));
      try {
        const r = await call("discover", { index: selected2, draft: draft2 });
        if (!r.ok) {
          setStatus({ kind: "err", text: String(r.error ?? "") });
          return;
        }
        const modelsRaw = r.models;
        const models = Array.isArray(modelsRaw) ? modelsRaw : [];
        setDiscovered((d) => ({ ...d, [selected2]: models }));
        setStatus({ kind: "ok", text: `${models.length} ${t("testModels")}` });
      } finally {
        setDiscovering((current) => current === selected2 ? null : current);
      }
    })();
  };
  const catalogSeedGroup = (id) => {
    const preset = state.catalog[id];
    if (preset === void 0) return null;
    const group = {
      contextWindow: preset.contextWindow,
      maxTokens: preset.maxTokens
    };
    if (Array.isArray(preset.input) && preset.input.length > 0) group.input = [...preset.input];
    if (preset.reasoning !== void 0 && preset.reasoning !== null && typeof preset.reasoning === "object") {
      const efforts = {};
      let hasLevel = false;
      for (const [level, wire] of Object.entries(preset.reasoning)) {
        efforts[level] = wire === void 0 || wire === null ? null : wire;
        hasLevel = true;
      }
      if (hasLevel) group.reasoningEfforts = efforts;
    }
    return group;
  };
  const seedGroup = (model) => {
    if (posInt(model.contextWindow) || posInt(model.maxTokens)) {
      const seed = {};
      if (posInt(model.contextWindow)) seed.contextWindow = model.contextWindow;
      if (posInt(model.maxTokens)) seed.maxTokens = model.maxTokens;
      const presetGroup = catalogSeedGroup(model.id);
      if (presetGroup !== null) {
        for (const [key, value] of Object.entries(presetGroup)) {
          if (seed[key] === void 0) seed[key] = value;
        }
      }
      return Object.keys(seed).length > 0 ? seed : null;
    }
    return catalogSeedGroup(model.id);
  };
  const jsonLocked = () => {
    const selected2 = state.selected;
    if (selected2 === null) return false;
    const draft2 = drafts[selected2];
    if (draft2 !== void 0 && !draft2.paramsValid) {
      setStatus({ kind: "err", text: t("fixJsonFirst") });
      return true;
    }
    return false;
  };
  const addFetchedRow = (model) => {
    const selected2 = state.selected;
    if (selected2 === null) return;
    setAc(null);
    if (jsonLocked()) return;
    if ((drafts[selected2]?.modelRows ?? []).some((row) => row.id === model.id)) {
      setStatus({ kind: "err", text: `${model.id} ${t("alreadyInList")}` });
      return;
    }
    updateDraft(selected2, (cur) => {
      if (cur.modelRows.some((row) => row.id === model.id)) return cur;
      const name2 = model.name !== void 0 && model.name !== "" && model.name !== model.id ? model.name : "";
      const params = { ...cur.params };
      if (params[model.id] === void 0) {
        params[model.id] = frameworkGroup(seedGroup(model), name2 !== "" ? name2 : null);
      }
      return {
        ...cur,
        modelRows: [...cur.modelRows, { id: model.id, name: name2 }],
        params,
        paramsText: JSON.stringify(params, null, 2),
        paramsValid: true
      };
    });
  };
  const addModelRow = () => {
    const selected2 = state.selected;
    if (selected2 === null) return;
    setAc(null);
    updateDraft(selected2, (cur) => ({ ...cur, modelRows: [...cur.modelRows, { id: "", name: "" }] }));
  };
  const removeModelRow = (rowIndex) => {
    const selected2 = state.selected;
    if (selected2 === null) return;
    setAc(null);
    if (jsonLocked()) return;
    updateDraft(selected2, (cur) => {
      const row = cur.modelRows[rowIndex];
      const params = { ...cur.params };
      const key = row?.id.trim() ?? "";
      if (key !== "") delete params[key];
      return {
        ...cur,
        modelRows: cur.modelRows.filter((_, i) => i !== rowIndex),
        params,
        paramsText: JSON.stringify(params, null, 2),
        paramsValid: true
      };
    });
  };
  const setModelRowId = (rowIndex, nextId) => {
    const selected2 = state.selected;
    if (selected2 === null) return;
    if (jsonLocked()) return;
    updateDraft(selected2, (cur) => {
      const row = cur.modelRows[rowIndex];
      if (row === void 0) return cur;
      const oldKey = row.id.trim();
      const nextKey = nextId.trim();
      const modelRows = cur.modelRows.map((r, i) => i === rowIndex ? { ...r, id: nextId } : r);
      if (oldKey === nextKey) {
        return { ...cur, modelRows };
      }
      const params = { ...cur.params };
      const oldGroup = oldKey === "" ? void 0 : params[oldKey];
      if (oldKey !== "") delete params[oldKey];
      if (nextKey !== "" && params[nextKey] === void 0) {
        const moved = oldGroup !== null && typeof oldGroup === "object" && !Array.isArray(oldGroup) ? oldGroup : void 0;
        params[nextKey] = frameworkGroup(moved, row.name.trim() !== "" ? row.name : null);
      }
      return { ...cur, modelRows, params, paramsText: JSON.stringify(params, null, 2), paramsValid: true };
    });
  };
  const setModelRowName = (rowIndex, nextName) => {
    const selected2 = state.selected;
    if (selected2 === null) return;
    if (jsonLocked()) return;
    updateDraft(selected2, (cur) => {
      const row = cur.modelRows[rowIndex];
      if (row === void 0) return cur;
      const modelRows = cur.modelRows.map((r, i) => i === rowIndex ? { ...r, name: nextName } : r);
      const key = row.id.trim();
      if (key === "" || cur.params[key] === void 0) return { ...cur, modelRows };
      const params = { ...cur.params, [key]: { ...cur.params[key], name: nextName.trim() !== "" ? nextName : null } };
      return { ...cur, modelRows, params, paramsText: JSON.stringify(params, null, 2), paramsValid: true };
    });
  };
  const pickCatalogModel = (rowIndex, id) => {
    const selected2 = state.selected;
    if (selected2 === null) return;
    setAc(null);
    if (jsonLocked()) return;
    const draft2 = drafts[selected2];
    const preset = state.catalog[id];
    if (draft2 === void 0 || preset === void 0) return;
    if (draft2.modelRows.some((row, i) => i !== rowIndex && row.id.trim() === id)) {
      setStatus({ kind: "err", text: `${id} ${t("alreadyInList")}` });
      return;
    }
    updateDraft(selected2, (cur) => {
      const row = cur.modelRows[rowIndex];
      if (row === void 0) return cur;
      const params = { ...cur.params };
      const oldKey = row.id.trim();
      if (oldKey !== "" && oldKey !== id) delete params[oldKey];
      const nextName = row.name.trim() !== "" ? row.name : preset.name !== "" && preset.name !== id ? preset.name : "";
      params[id] = frameworkGroup(catalogSeedGroup(id), nextName !== "" ? nextName : null);
      const modelRows = cur.modelRows.map((r, i) => i === rowIndex ? { ...r, id, name: nextName } : r);
      return { ...cur, modelRows, params, paramsText: JSON.stringify(params, null, 2), paramsValid: true };
    });
  };
  const addHeaderRow = () => {
    const selected2 = state.selected;
    if (selected2 === null) return;
    updateDraft(selected2, (cur) => ({ ...cur, headersRows: [...cur.headersRows, { name: "", value: "" }] }));
  };
  const removeHeaderRow = (rowIndex) => {
    const selected2 = state.selected;
    if (selected2 === null) return;
    updateDraft(selected2, (cur) => ({
      ...cur,
      headersRows: cur.headersRows.filter((_, i) => i !== rowIndex)
    }));
  };
  const setHeaderRow = (rowIndex, key, value) => {
    const selected2 = state.selected;
    if (selected2 === null) return;
    updateDraft(selected2, (cur) => ({
      ...cur,
      headersRows: cur.headersRows.map((row, i) => i === rowIndex ? { ...row, [key]: value } : row)
    }));
    clearTestResult();
  };
  const setParamsText = (text) => {
    const selected2 = state.selected;
    if (selected2 === null) return;
    updateDraft(selected2, (cur) => {
      try {
        const parsed = JSON.parse(text);
        if (parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)) {
          const params = parsed;
          const modelRows = [];
          const seen = /* @__PURE__ */ new Set();
          for (const key of Object.keys(params)) {
            if (key === "" || seen.has(key)) continue;
            seen.add(key);
            const group = params[key];
            const rawName = group !== null && typeof group === "object" && !Array.isArray(group) ? group.name : void 0;
            const prev = cur.modelRows.find((r) => r.id === key);
            const name2 = rawName === void 0 ? prev?.name ?? "" : typeof rawName === "string" && rawName.trim() !== "" ? rawName : "";
            modelRows.push({ id: key, name: name2 });
          }
          for (const row of cur.modelRows) {
            if (row.id === "") modelRows.push(row);
          }
          return { ...cur, params, modelRows, paramsText: text, paramsValid: true };
        }
      } catch {
      }
      return { ...cur, paramsText: text, paramsValid: false };
    });
  };
  const selected = state.selected;
  const selectedEntry = state.gateways.find((g) => g.index === selected);
  const cfg = selectedEntry?.gateway ?? {};
  const providerKey = String(cfg.provider ?? "");
  const draft = selected === null ? void 0 : drafts[selected];
  const catalogIds = Object.keys(state.catalog);
  const totalModels = state.gateways.reduce((sum, g) => sum + (g.models?.length ?? 0), 0);
  const statusFlash = status === null ? null : import_react.default.createElement("div", { className: `phub-statusFlash phub-statusFlash-${status.kind}` }, status.text);
  const fetchedList = selected === null ? void 0 : discovered[selected];
  const listedIds = new Set((draft?.modelRows ?? []).map((row) => row.id.trim()).filter((id) => id !== ""));
  const probeReady = String(cfg.endpointMode ?? "auto") === "custom" ? String(cfg.endpoint ?? "").trim() !== "" || String(cfg.baseURL ?? "").trim() !== "" : String(cfg.baseURL ?? "").trim() !== "";
  const gatewayCard = (g) => {
    const name2 = String(g.gateway.displayName ?? g.gateway.provider ?? "");
    const provider = String(g.gateway.provider ?? "");
    const api = String(g.gateway.api ?? "");
    const base = String(g.gateway.baseURL ?? "");
    const models = g.models ?? [];
    const endpointMode = String(g.gateway.endpointMode ?? "auto");
    const apiKeyEnv = String(g.gateway.apiKeyEnv ?? "");
    const configured = g.gateway.apiKeyConfigured === true;
    const tr = testResult[g.index] ?? null;
    return import_react.default.createElement(
      "article",
      { key: g.index, className: "phub-card" },
      import_react.default.createElement(
        "div",
        { className: "phub-cardHead" },
        import_react.default.createElement("div", { className: "phub-cardName" }, name2),
        import_react.default.createElement(import_dsh_client_ui_primitives.Pill, { active: configured }, configured ? t("badgeConfigured") : t("badgeNoKey"))
      ),
      import_react.default.createElement(
        "div",
        { className: "phub-meta" },
        base === "" ? `${provider} · ${api}` : `${provider} · ${api} · ${base}`
      ),
      models.length > 0 ? import_react.default.createElement(
        "div",
        { className: "phub-models" },
        models.slice(0, 5).map((m) => import_react.default.createElement("span", { key: String(m.id), className: "phub-chip" }, String(m.name ?? m.id))),
        models.length > 5 ? import_react.default.createElement("span", { className: "phub-chip" }, `+${models.length - 5}`) : null
      ) : null,
      import_react.default.createElement(
        "div",
        { className: "phub-cardFoot" },
        `${models.length} ${t("unitModels")} · ${endpointMode === "custom" ? t("modeCustom") : t("modeAuto")} · ${apiKeyEnv !== "" ? apiKeyEnv : t("keyInline")}`
      ),
      // The editor shows the banner for its own gateway; the card shows it otherwise.
      tr !== null && selected !== g.index ? TestBanner({ test: tr, t }) : null,
      import_react.default.createElement(
        "div",
        { className: "phub-rowActions" },
        import_react.default.createElement(import_dsh_client_ui_primitives.Button, {
          variant: "ghost",
          size: "sm",
          disabled: testing !== null,
          icon: testing === g.index ? import_react.default.createElement(import_dsh_client_ui_primitives.IconLoadingOutline16, { size: 14, className: "phub-spin" }) : void 0,
          onClick: () => runCardTest(g.index)
        }, testing === g.index ? t("testing") : t("testConnection")),
        import_react.default.createElement(import_dsh_client_ui_primitives.Button, {
          variant: "ghost",
          size: "sm",
          onClick: () => setState((s) => ({ ...s, selected: s.selected === g.index ? null : g.index }))
        }, t("edit")),
        import_react.default.createElement(import_dsh_client_ui_primitives.Button, {
          variant: "ghost",
          size: "sm",
          className: "phub-danger",
          "aria-label": t("delete"),
          title: t("delete"),
          icon: import_react.default.createElement(import_dsh_client_ui_primitives.IconTrashOutline16, { size: 14 }),
          onClick: () => deleteGateway(g.index)
        })
      )
    );
  };
  const fieldInput = (key, label, hint, placeholder, wide = false) => {
    return Field(label, hint, import_react.default.createElement("input", {
      className: "phub-input",
      value: String(cfg[key] ?? ""),
      placeholder,
      spellCheck: false,
      onChange: (e) => setField(key, e.target.value)
    }), wide);
  };
  const headerRow = (row, rowIndex) => {
    return import_react.default.createElement(
      "div",
      { key: rowIndex, className: "phub-kvGrid phub-kvHeaders" },
      import_react.default.createElement("input", {
        className: "phub-input",
        value: row.name,
        placeholder: t("headerName"),
        spellCheck: false,
        onChange: (e) => setHeaderRow(rowIndex, "name", e.target.value)
      }),
      import_react.default.createElement("input", {
        className: "phub-input phub-kvValue",
        value: row.value,
        placeholder: t("headerValue"),
        spellCheck: false,
        onChange: (e) => setHeaderRow(rowIndex, "value", e.target.value)
      }),
      import_react.default.createElement(import_dsh_client_ui_primitives.Button, {
        variant: "ghost",
        size: "sm",
        className: "phub-danger",
        "aria-label": t("remove"),
        title: t("remove"),
        icon: import_react.default.createElement(import_dsh_client_ui_primitives.IconTrashOutline16, { size: 14 }),
        onClick: () => removeHeaderRow(rowIndex)
      })
    );
  };
  const modelRow = (row, rowIndex) => {
    const matches = suggestMatches(row.id, state.catalog);
    const open = ac !== null && ac.row === rowIndex && row.id.trim() !== "";
    const highlight = open ? ac.highlight : -1;
    const listId = `phub-ac-list-${rowIndex}`;
    return import_react.default.createElement(
      "div",
      { key: rowIndex, className: "phub-kvGrid phub-kvModels" },
      import_react.default.createElement(
        "div",
        { className: "phub-acWrap" },
        import_react.default.createElement("input", {
          className: "phub-input",
          value: row.id,
          placeholder: t("modelId"),
          spellCheck: false,
          autoComplete: "off",
          role: "combobox",
          "aria-expanded": open,
          "aria-autocomplete": "list",
          "aria-controls": listId,
          onChange: (e) => {
            setModelRowId(rowIndex, e.target.value);
            setAc({ row: rowIndex, highlight: -1 });
          },
          onFocus: () => setAc({ row: rowIndex, highlight: -1 }),
          onBlur: () => setAc(null),
          onKeyDown: (e) => {
            if (!open) return;
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setAc({ row: rowIndex, highlight: Math.min(highlight + 1, matches.length - 1) });
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setAc({ row: rowIndex, highlight: Math.max(highlight - 1, -1) });
            } else if (e.key === "Enter") {
              e.preventDefault();
              if (highlight >= 0 && matches[highlight] !== void 0) pickCatalogModel(rowIndex, matches[highlight]);
              else setAc(null);
            } else if (e.key === "Escape") {
              e.preventDefault();
              setAc(null);
            }
          }
        }),
        open ? import_react.default.createElement(
          "div",
          { className: "phub-acList", id: listId, role: "listbox" },
          matches.length === 0 ? import_react.default.createElement("div", { className: "phub-acEmpty" }, t("noPresetMatch")) : matches.map((id, i) => {
            const preset = state.catalog[id];
            const taken = id !== row.id.trim() && listedIds.has(id);
            return import_react.default.createElement(
              "div",
              {
                key: id,
                className: "phub-acItem",
                "data-active": highlight === i,
                "data-taken": taken,
                role: "option",
                "aria-selected": highlight === i,
                onMouseDown: (e) => {
                  e.preventDefault();
                },
                onClick: () => {
                  pickCatalogModel(rowIndex, id);
                }
              },
              import_react.default.createElement("span", { className: "phub-acId" }, id),
              import_react.default.createElement(
                "span",
                { className: "phub-acMeta" },
                taken ? t("alreadyInList") : `${String(preset?.name ?? "")} · ${String(preset?.contextWindow ?? "—")}/${String(preset?.maxTokens ?? "—")}`
              )
            );
          })
        ) : null
      ),
      import_react.default.createElement("input", {
        className: "phub-input phub-kvValue",
        value: row.name,
        placeholder: t("modelName"),
        onChange: (e) => setModelRowName(rowIndex, e.target.value)
      }),
      import_react.default.createElement(import_dsh_client_ui_primitives.Button, {
        variant: "ghost",
        size: "sm",
        className: "phub-danger",
        "aria-label": t("remove"),
        title: t("remove"),
        icon: import_react.default.createElement(import_dsh_client_ui_primitives.IconTrashOutline16, { size: 14 }),
        onClick: () => removeModelRow(rowIndex)
      })
    );
  };
  const catalogSection = import_react.default.createElement(
    import_react.default.Fragment,
    null,
    import_react.default.createElement(
      "div",
      { className: "phub-sectionTitle" },
      import_react.default.createElement(
        "div",
        null,
        import_react.default.createElement("h3", null, t("tabCatalog")),
        import_react.default.createElement("div", { className: "phub-sectionHelp" }, t("sectionCatalogHint"))
      )
    ),
    catalogIds.length === 0 ? import_react.default.createElement("div", { className: "phub-empty" }, t("catalogEmpty")) : import_react.default.createElement(
      "div",
      { className: "phub-grid" },
      catalogIds.slice().sort().map((id) => {
        const preset = state.catalog[id];
        return import_react.default.createElement(
          "article",
          { key: id, className: "phub-card" },
          import_react.default.createElement(
            "div",
            { className: "phub-cardHead" },
            import_react.default.createElement("div", { className: "phub-cardName" }, preset?.name ?? id),
            import_react.default.createElement(import_dsh_client_ui_primitives.Pill, { active: false }, id)
          ),
          import_react.default.createElement(
            "div",
            { className: "phub-models" },
            import_react.default.createElement("span", { className: "phub-chip" }, `${t("contextWindow")} ${preset?.contextWindow ?? "—"}`),
            import_react.default.createElement("span", { className: "phub-chip" }, `${t("maxTokens")} ${preset?.maxTokens ?? "—"}`)
          )
        );
      })
    )
  );
  const editorSection = selected === null || selectedEntry === void 0 ? null : import_react.default.createElement(
    import_react.default.Fragment,
    null,
    import_react.default.createElement(
      "div",
      { className: "phub-sectionTitle" },
      import_react.default.createElement(
        "div",
        null,
        import_react.default.createElement("h3", null, `${t("gateway")} · ${String(cfg.displayName ?? cfg.provider ?? "")}`),
        import_react.default.createElement(
          "div",
          { className: "phub-sectionHelp" },
          `${String(cfg.api ?? "anthropic-messages")} · ${String(cfg.endpointMode ?? "auto") === "custom" ? t("modeCustom") : t("modeAuto")}`
        )
      ),
      import_react.default.createElement(
        "div",
        { className: "phub-actions" },
        import_react.default.createElement(import_dsh_client_ui_primitives.Button, {
          variant: "ghost",
          size: "sm",
          onClick: () => setState((s) => ({ ...s, selected: null }))
        }, t("collapse"))
      )
    ),
    import_react.default.createElement(
      "div",
      { className: "phub-card phub-editorCard" },
      // ---- Basic fields ----
      import_react.default.createElement(
        "div",
        { className: "phub-form" },
        fieldInput("provider", t("providerName"), t("providerNameHint")),
        fieldInput("displayName", t("displayName")),
        // baseURL meaning depends on the endpoint mode: auto = API root
        // (/v1 auto-completed), custom = the COMPLETE model-listing URL.
        fieldInput(
          "baseURL",
          `${t("baseURL")} *`,
          String(cfg.endpointMode ?? "auto") === "custom" ? t("baseURLHintCustom") : t("baseURLHint"),
          t("baseURLPlaceholder"),
          true
        ),
        Field(
          t("endpointMode"),
          t("endpointModeHint"),
          import_react.default.createElement(SelectMenu, {
            label: t("endpointMode"),
            block: true,
            value: String(cfg.endpointMode ?? "auto"),
            options: [
              { value: "auto", title: t("endpointModeAuto") },
              { value: "custom", title: t("endpointModeCustom") }
            ],
            onChange: (next) => setField("endpointMode", next)
          })
        ),
        Field(
          t("api"),
          void 0,
          // MUST be a React element (createElement), never a direct call:
          // SelectMenu holds hooks (useState) — see its doc comment.
          import_react.default.createElement(SelectMenu, {
            label: t("api"),
            block: true,
            value: String(cfg.api ?? "anthropic-messages"),
            options: [
              { value: "anthropic-messages", title: "anthropic-messages" },
              { value: "openai-completions", title: "openai-completions" },
              { value: "openai-responses", title: "openai-responses" }
            ],
            onChange: (next) => setField("api", next)
          })
        ),
        // custom mode: the complete chat request URL of the selected protocol,
        // dialed verbatim (no path or /v1 is ever appended).
        String(cfg.endpointMode ?? "auto") === "custom" ? fieldInput("endpoint", `${t("endpoint")} *`, t("endpointHint"), t("endpointPlaceholder"), true) : null,
        // UA quick-picks: selecting a preset only fills the editable input.
        Field(
          t("userAgent"),
          t("userAgentHint"),
          import_react.default.createElement(
            "div",
            { className: "phub-inline" },
            import_react.default.createElement(SelectMenu, {
              label: t("userAgent"),
              compact: true,
              placeholder: t("uaPreset"),
              value: UA_PRESETS.find((p) => p.value === String(cfg.userAgent ?? ""))?.value ?? "",
              options: UA_PRESETS.map((p) => ({ value: p.value, title: p.title })),
              onChange: (next) => setField("userAgent", next)
            }),
            import_react.default.createElement("input", {
              className: "phub-input",
              value: String(cfg.userAgent ?? ""),
              spellCheck: false,
              onChange: (e) => setField("userAgent", e.target.value)
            })
          ),
          true
        ),
        // API key: masked by default, per-provider reveal toggle.
        Field(
          t("apiKey"),
          cfg.apiKeyConfigured === true ? t("apiKeyConfiguredHint") : t("apiKeyHint"),
          import_react.default.createElement(
            "div",
            { className: "phub-inline" },
            import_react.default.createElement("input", {
              className: "phub-input",
              type: showKey[providerKey] === true ? "text" : "password",
              value: String(cfg.apiKey ?? ""),
              placeholder: cfg.apiKeyConfigured === true ? t("apiKeyConfiguredHint") : void 0,
              autoComplete: "new-password",
              spellCheck: false,
              onChange: (e) => setField("apiKey", e.target.value)
            }),
            import_react.default.createElement(import_dsh_client_ui_primitives.Button, {
              variant: "ghost",
              size: "sm",
              onClick: () => setShowKey((s) => ({ ...s, [providerKey]: s[providerKey] === true ? false : true }))
            }, showKey[providerKey] === true ? t("hide") : t("show"))
          )
        ),
        fieldInput("apiKeyEnv", t("apiKeyEnv"), t("apiKeyHint"))
      ),
      // ---- Headers: key-value rows (cc-switch recipe) ----
      import_react.default.createElement("hr", { className: "phub-divider" }),
      SectionHead(
        t("headersSection"),
        t("headersHint"),
        import_react.default.createElement(import_dsh_client_ui_primitives.Button, {
          variant: "outline",
          size: "sm",
          icon: import_react.default.createElement(import_dsh_client_ui_primitives.IconPlusOutline16, { size: 13 }),
          onClick: addHeaderRow
        }, t("addHeader"))
      ),
      (draft?.headersRows.length ?? 0) > 0 ? import_react.default.createElement(
        "div",
        { className: "phub-kvWrap" },
        import_react.default.createElement(
          "div",
          { className: "phub-kvHead phub-kvHeaders" },
          import_react.default.createElement("span", { className: "phub-kvLabel" }, t("headerName")),
          import_react.default.createElement("span", { className: "phub-kvLabel" }, t("headerValue")),
          import_react.default.createElement("span", null)
        ),
        (draft?.headersRows ?? []).map(headerRow)
      ) : null,
      // ---- Models: the brief list (id + display name) ----
      import_react.default.createElement("hr", { className: "phub-divider" }),
      SectionHead(
        t("modelSection"),
        t("modelRowsHint"),
        import_react.default.createElement(
          import_react.default.Fragment,
          null,
          import_react.default.createElement(import_dsh_client_ui_primitives.Button, {
            variant: "outline",
            size: "sm",
            disabled: discovering !== null || String(cfg.baseURL ?? "").trim() === "",
            icon: discovering === selected ? import_react.default.createElement(import_dsh_client_ui_primitives.IconLoadingOutline16, { size: 13, className: "phub-spin" }) : import_react.default.createElement(import_dsh_client_ui_primitives.IconRefreshOutline16, { size: 13 }),
            onClick: runFetchModels
          }, discovering === selected ? `${t("discoverRun")}…` : t("discoverRun")),
          import_react.default.createElement(import_dsh_client_ui_primitives.Button, {
            variant: "outline",
            size: "sm",
            icon: import_react.default.createElement(import_dsh_client_ui_primitives.IconPlusOutline16, { size: 13 }),
            onClick: addModelRow
          }, t("addModel"))
        )
      ),
      // Fetched listing picker: picking a model adds its row (+ seeded params).
      fetchedList === null || fetchedList === void 0 || fetchedList.length === 0 ? null : Field(
        t("fetchedModels"),
        void 0,
        import_react.default.createElement(SelectMenu, {
          label: t("fetchedModels"),
          block: true,
          value: "",
          placeholder: `${fetchedList.length} ${t("testModels")}`,
          options: fetchedList.map((model) => ({
            value: model.id,
            title: `${model.id}${model.contextWindow !== void 0 ? ` · ${model.contextWindow}` : ""}${model.maxTokens !== void 0 ? ` / ${model.maxTokens}` : ""}${listedIds.has(model.id) ? ` · ${t("alreadyInList")}` : ""}`
          })),
          onChange: (next) => {
            const model = fetchedList.find((m) => m.id === next);
            if (model !== void 0) addFetchedRow(model);
          }
        })
      ),
      (draft?.modelRows.length ?? 0) > 0 ? import_react.default.createElement(
        "div",
        { className: "phub-kvWrap" },
        import_react.default.createElement(
          "div",
          { className: "phub-kvHead phub-kvModels" },
          import_react.default.createElement("span", { className: "phub-kvLabel" }, t("modelId")),
          import_react.default.createElement("span", { className: "phub-kvLabel" }, t("modelName")),
          import_react.default.createElement("span", null)
        ),
        (draft?.modelRows ?? []).map(modelRow)
      ) : import_react.default.createElement("div", { className: "phub-hint" }, t("modelsEmptyHint")),
      // ---- Config JSON: the complete per-model parameter framework,
      // synced BOTH WAYS with the list (JSON keys rebuild the rows) ----
      import_react.default.createElement("hr", { className: "phub-divider" }),
      SectionHead(t("configJson"), t("configJsonHint")),
      import_react.default.createElement("textarea", {
        className: draft?.paramsValid === false ? "phub-textarea phub-textarea-invalid" : "phub-textarea",
        value: draft?.paramsText ?? "{\n}",
        spellCheck: false,
        onChange: (e) => setParamsText(e.target.value)
      }),
      // ---- Footer: the ONE save button ----
      import_react.default.createElement(
        "div",
        { className: "phub-actions" },
        import_react.default.createElement(import_dsh_client_ui_primitives.Button, {
          variant: "primary",
          size: "sm",
          disabled: busy || draft?.paramsValid === false,
          onClick: () => void save()
        }, t("save")),
        import_react.default.createElement(import_dsh_client_ui_primitives.Button, {
          variant: "outline",
          size: "sm",
          disabled: busy || testing !== null || !probeReady,
          icon: testing === selected ? import_react.default.createElement(import_dsh_client_ui_primitives.IconLoadingOutline16, { size: 14, className: "phub-spin" }) : void 0,
          onClick: runTest
        }, testing === selected ? t("testing") : t("testConnection")),
        import_react.default.createElement(import_dsh_client_ui_primitives.Button, {
          variant: "ghost",
          size: "sm",
          onClick: () => setState((s) => ({ ...s, selected: null }))
        }, t("collapse"))
      ),
      (testResult[selected] ?? null) !== null ? TestBanner({ test: testResult[selected], t }) : null
    )
  );
  const providersSection = import_react.default.createElement(
    import_react.default.Fragment,
    null,
    import_react.default.createElement(
      "div",
      { className: "phub-sectionTitle" },
      import_react.default.createElement(
        "div",
        null,
        import_react.default.createElement("h3", null, t("gateways")),
        import_react.default.createElement("div", { className: "phub-sectionHelp" }, t("sectionProvidersHint"))
      )
    ),
    import_react.default.createElement(
      "div",
      { className: "phub-grid" },
      state.gateways.length === 0 ? import_react.default.createElement(
        "div",
        { className: "phub-empty" },
        import_react.default.createElement("span", { className: "phub-empty-title" }, t("emptyTitle")),
        import_react.default.createElement("span", { className: "phub-empty-desc" }, t("emptyHint"))
      ) : state.gateways.map(gatewayCard),
      import_react.default.createElement(
        "button",
        { className: "phub-add-card", disabled: busy, onClick: addGateway },
        `+ ${t("addGateway")}`
      )
    ),
    editorSection
  );
  return import_react.default.createElement(
    "div",
    { className: "phub-page" },
    // ---- Hero: brand status card + primary actions ----
    import_react.default.createElement(
      "div",
      { className: "phub-hero" },
      import_react.default.createElement(
        "div",
        { className: "phub-heroMain" },
        import_react.default.createElement(
          "div",
          { className: "phub-heroStatus" },
          import_react.default.createElement(import_dsh_client_ui_primitives.StateDot, { state: state.gateways.length > 0 ? "done" : "warning" }),
          import_react.default.createElement(
            "h2",
            { className: "phub-heroTitle" },
            state.gateways.length > 0 ? t("heroReady") : t("heroEmpty")
          )
        ),
        import_react.default.createElement(
          "div",
          { className: "phub-heroMeta" },
          `${state.gateways.length} ${t("unitProviders")} · ${totalModels} ${t("unitModels")} · ${catalogIds.length} ${t("unitPresets")}`
        ),
        import_react.default.createElement("div", { className: "phub-heroHelp" }, t("intro"))
      ),
      import_react.default.createElement(
        "div",
        { className: "phub-actions" },
        import_react.default.createElement(import_dsh_client_ui_primitives.Button, {
          variant: "ghost",
          size: "sm",
          disabled: busy,
          icon: import_react.default.createElement(import_dsh_client_ui_primitives.IconRefreshOutline16, { size: 14 }),
          onClick: () => void refresh()
        }, t("refresh")),
        import_react.default.createElement(import_dsh_client_ui_primitives.Button, {
          variant: "primary",
          size: "sm",
          disabled: busy,
          icon: import_react.default.createElement(import_dsh_client_ui_primitives.IconPlusOutline16, { size: 14 }),
          onClick: addGateway
        }, t("addGateway"))
      )
    ),
    statusFlash,
    // ---- Tabs: providers / built-in catalog ----
    import_react.default.createElement(
      "div",
      { className: "phub-tabs" },
      import_react.default.createElement("button", {
        type: "button",
        className: "phub-tab",
        "data-active": tab === "providers",
        onClick: () => setTab("providers")
      }, t("gateways"), import_react.default.createElement("span", { className: "phub-tabCount" }, String(state.gateways.length))),
      import_react.default.createElement("button", {
        type: "button",
        className: "phub-tab",
        "data-active": tab === "catalog",
        onClick: () => setTab("catalog")
      }, t("tabCatalog"), import_react.default.createElement("span", { className: "phub-tabCount" }, String(catalogIds.length)))
    ),
    tab === "catalog" ? catalogSection : providersSection
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
var nullishStringArraySchema = schema((v) => {
  if (v === void 0 || v === null) return [];
  if (!Array.isArray(v)) throw new TypeError("expected an array of strings");
  return v.map((item) => {
    if (typeof item !== "string") throw new TypeError("expected an array of strings");
    return item;
  });
});
var objectArraySchema = schema((v) => {
  if (!Array.isArray(v)) throw new TypeError("expected an array of objects");
  return v.map((item) => {
    if (item === null || typeof item !== "object" || Array.isArray(item)) throw new TypeError("expected an array of objects");
    return item;
  });
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
var nullishStringArrayParam = (name2) => ({
  name: name2,
  wire: name2,
  source: "json",
  codec: codec("StringArrayOrNull", nullishStringArraySchema)
});
var objectArrayParam = (name2) => ({
  name: name2,
  wire: name2,
  source: "json",
  codec: codec("ObjectArray", objectArraySchema)
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
  invocation("upsertModel", "upsertModel", [numberParam("index"), objectParam("entry"), booleanParam("overwrite"), nullishStringArrayParam("clearFields")]),
  invocation("deleteModel", "deleteModel", [numberParam("index"), stringParam("id")]),
  invocation("saveModels", "saveModels", [numberParam("index"), objectArrayParam("models"), objectParam("params")]),
  invocation("discover", "discover", [numberParam("index"), nullishObjectParam("draft")]),
  invocation("testConnection", "testConnection", [numberParam("index"), objectParam("draft")]),
  invocation("enableDiscovered", "enableDiscovered", [numberParam("index"), objectParam("model")])
];

// src/client/static.tsx
var name = "provider-hub";
var inject = ["slots", "locale", "remote"];
var NS = "settings.provider-hub";
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
  "upsert-model": "upsertModel",
  "delete-model": "deleteModel",
  "save-models": "saveModels",
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
  "upsert-model": ["index", "entry", "overwrite", "clearFields"],
  "delete-model": ["index", "id"],
  "save-models": ["index", "models", "params"],
  "discover": ["index", "draft"],
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
function ProviderHubIcon(props) {
  const size = props.size ?? 20;
  return import_react2.default.createElement(
    "svg",
    {
      width: size,
      height: size,
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: 2,
      strokeLinecap: "round",
      strokeLinejoin: "round",
      "aria-hidden": "true"
    },
    import_react2.default.createElement("rect", { x: 16, y: 16, width: 6, height: 6, rx: 1 }),
    import_react2.default.createElement("rect", { x: 2, y: 16, width: 6, height: 6, rx: 1 }),
    import_react2.default.createElement("rect", { x: 9, y: 2, width: 6, height: 6, rx: 1 }),
    import_react2.default.createElement("path", { d: "M5 16v-3a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v3M12 12V8" })
  );
}
var hubViewStore = (0, import_client.defineStore)({
  init: () => ({ open: false }),
  actions: {
    open: (draft) => {
      draft.open = true;
    },
    close: (draft) => {
      draft.open = false;
    }
  }
});
function HubLauncher(props) {
  const open = props.useStore((state) => state.open);
  return import_react2.default.createElement(
    "button",
    {
      type: "button",
      className: "phub-panel-launcher",
      "data-wide": props.wide,
      "aria-label": props.t("panelTitle"),
      "aria-haspopup": "dialog",
      "aria-expanded": open,
      onClick: () => props.actions.open()
    },
    import_react2.default.createElement(ProviderHubIcon, { size: props.wide ? 16 : 18 }),
    props.wide ? props.t("panelTitle") : null
  );
}
function HubOverlay(props) {
  const open = props.useStore((state) => state.open);
  const panel = import_react2.default.useRef(null);
  import_react2.default.useEffect(() => {
    if (!open) return;
    panel.current?.querySelector("button")?.focus();
    const onKeyDown = (event) => {
      if (event.key !== "Escape") return;
      if (document.querySelectorAll('[role="dialog"]').length > 1) return;
      props.actions.close();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, props.actions]);
  if (!open) return null;
  return import_react2.default.createElement(
    "div",
    {
      className: "phub-panel-overlay",
      role: "dialog",
      "aria-modal": "true",
      "aria-label": props.t("panelTitle")
    },
    import_react2.default.createElement("button", {
      type: "button",
      className: "phub-panel-mask",
      "aria-label": props.t("panelClose"),
      onClick: () => props.actions.close()
    }),
    import_react2.default.createElement(
      "section",
      { ref: panel, className: "phub-panel-sheet" },
      import_react2.default.createElement(
        "header",
        { className: "phub-panel-header" },
        import_react2.default.createElement(
          "div",
          { className: "phub-brand" },
          import_react2.default.createElement("span", { className: "phub-brandMark" }, import_react2.default.createElement(ProviderHubIcon, { size: 20 })),
          import_react2.default.createElement(
            "div",
            null,
            import_react2.default.createElement("h1", null, props.t("panelTitle")),
            import_react2.default.createElement("p", null, props.t("panelSubtitle"))
          )
        ),
        import_react2.default.createElement("button", { type: "button", className: "phub-iconBtn", "aria-label": props.t("panelClose"), onClick: () => props.actions.close() }, "×")
      ),
      import_react2.default.createElement(
        "div",
        { className: "phub-panel-body" },
        import_react2.default.createElement(PageBoundary, null, import_react2.default.createElement(ProviderHubPage, { t: props.t, call: props.call }))
      )
    )
  );
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
          const contribution = { package: "@tappat225/dsh-provider-hub", descriptors: INVOCATIONS };
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
    if (slots !== null && slots !== void 0 && typeof slots.inject === "function") {
      try {
        slots.inject("sidebar.footer.action", () => slots.register({
          name: "sidebar.footer.action",
          id: "model-config",
          order: 10,
          locale: NS,
          store: hubViewStore
        }, HubLauncher));
        slots.inject("shell.overlay", () => slots.register({
          name: "shell.overlay",
          id: "model-config",
          order: 10,
          locale: NS,
          store: hubViewStore
        }, (slotProps) => import_react2.default.createElement(HubOverlay, { ...slotProps, t, call })));
      } catch {
      }
    }
  } catch {
  }
}

    return module.exports;
  }
});

//# sourceMappingURL=client.js.map
