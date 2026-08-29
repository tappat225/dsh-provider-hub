/** Stylesheet for the Provider Hub settings page (inlined as text at build time).
 *  Follows the DSH settings design recipe (dsh-better-sidebar / DSH General
 *  section): `--dsw-alias-*` tokens, 16px group cards with l2 hairlines,
 *  title/desc-left + control-right rows, custom 36x20 switches. */
export default `
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
