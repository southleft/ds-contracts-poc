/**
 * Card — constructable shadow stylesheet from contract
 * ds.card v1.1.0 (@ds-contracts/emitter-web-components). Do not edit.
 * Composed dependencies style themselves in their own shadow roots —
 * this sheet carries ONLY this contract's anatomy.
 */
export const css = "/* Card — shadow stylesheet from ds.card v1.1.0 (@ds-contracts/emitter-web-components) */\n\n:host {\n  display: contents;\n}\n\n*, *::before, *::after {\n  box-sizing: border-box;\n}\n\n[part='root'] {\n  display: flex;\n  flex-direction: column;\n  align-items: stretch;\n  border-style: solid;\n  width: 100%;\n  min-width: fit-content;\n  background-color: var(--color-surface-raised);\n  border-color: var(--color-border-subtle);\n  border-width: var(--border-width-100);\n  border-radius: var(--radius-card);\n  max-width: var(--size-card-width);\n}\n\n[part='header'] {\n  display: flex;\n  flex-direction: row;\n  align-items: center;\n  gap: var(--space-gap-control);\n  padding-inline: var(--space-inset-x-md);\n  padding-block: var(--space-inset-y-md);\n}\n\n[part='title'] {\n  color: var(--color-surface-foreground);\n  font-family: var(--font-control-family);\n  font-size: var(--font-title-size);\n  font-weight: var(--font-title-weight);\n}\n\n[part='body'] {\n  display: flex;\n  flex-direction: column;\n  align-items: stretch;\n  gap: var(--space-gap-control);\n  padding-inline: var(--space-inset-x-md);\n  padding-block: var(--space-inset-y-md);\n  color: var(--color-surface-foreground);\n  font-family: var(--font-control-family);\n  font-size: var(--font-control-size-sm);\n}\n\n[part='footer'] {\n  display: flex;\n  flex-direction: row;\n  align-items: center;\n  justify-content: flex-end;\n  gap: var(--space-gap-control);\n  padding-inline: var(--space-inset-x-md);\n  padding-block: var(--space-inset-y-md);\n}";

const sheet = new CSSStyleSheet();
sheet.replaceSync(css);

export default sheet;
