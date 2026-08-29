/** Stylesheet for the Provider Hub settings page (inlined as text at build time). */
export default `
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
