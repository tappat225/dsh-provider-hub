/** Stylesheet for the Provider Hub model-configuration panel (inlined as text at build time).
 *  Card-dashboard recipe modelled on the reference dsh-provider-hub: brand hero
 *  card with a StateDot headline, segmented tabs, a responsive provider-card
 *  grid (model chips, hover lift, quiet row actions) and a two-column form
 *  editor — all on --dsw-alias-* tokens so it follows the DSH theme. */
export default `
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
