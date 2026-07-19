/**
 * Switch — constructable shadow stylesheet from contract
 * ds.switch v2.0.0 (@ds-contracts/emitter-web-components). Do not edit.
 * Composed dependencies style themselves in their own shadow roots —
 * this sheet carries ONLY this contract's anatomy.
 */
export const css = "/* Switch — shadow stylesheet from ds.switch v2.0.0 (@ds-contracts/emitter-web-components) */\n\n:host {\n  display: contents;\n}\n\n*, *::before, *::after {\n  box-sizing: border-box;\n}\n\n[part='root'] {\n  display: flex;\n  flex-direction: row;\n  align-items: flex-start;\n  border: 0;\n  gap: var(--space-gap-sm);\n  font-family: var(--font-control-family);\n  color: var(--color-surface-foreground);\n}\n\n[part='track'] {\n  display: flex;\n  flex-direction: row;\n  align-items: center;\n  width: var(--size-switch-width);\n  height: var(--size-switch-height);\n  border-radius: var(--radius-pill);\n  padding-inline: var(--space-inset-y-xs);\n  padding-block: var(--space-inset-y-xs);\n  position: relative;\n}\n\n[part='root']:where([data-value='off']) [part='track'] {\n  background-color: var(--color-switch-off-track);\n}\n\n[part='root']:where([data-value='on']) [part='track'] {\n  background-color: var(--color-switch-on-track);\n}\n\n[part='track']:has(> [part='input']:focus-visible) {\n  outline-style: solid;\n  outline-offset: 2px;\n}\n\n[part='input'] {\n  position: absolute;\n  inset: 0;\n  width: 100%;\n  height: 100%;\n  margin: 0;\n  padding: 0;\n  opacity: 0;\n  cursor: pointer;\n}\n\n[part='spacerStart'] {\n  display: flex;\n  flex: 1 1 auto;\n  min-width: 0;\n}\n\n[part='thumb'] {\n  width: var(--size-switch-thumb);\n  height: var(--size-switch-thumb);\n  background-color: var(--color-switch-thumb);\n  border-radius: var(--radius-pill);\n}\n\n[part='spacerEnd'] {\n  display: flex;\n  flex: 1 1 auto;\n  min-width: 0;\n}\n\n[part='textCol'] {\n  display: flex;\n  flex-direction: column;\n  flex: 1 1 auto;\n  min-width: 0;\n  gap: var(--space-inset-y-xs);\n}\n\n[part='labelText'] {\n  font-size: var(--font-control-size-sm);\n  font-weight: var(--font-control-weight);\n}\n\n[part='descriptionText'] {\n  font-size: var(--font-control-size-sm);\n  color: var(--color-text-secondary);\n}";

const sheet = new CSSStyleSheet();
sheet.replaceSync(css);

export default sheet;
