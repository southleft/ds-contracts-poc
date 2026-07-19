/**
 * Badge — constructable shadow stylesheet from contract
 * ds.badge v1.1.0 (@ds-contracts/emitter-web-components). Do not edit.
 * Composed dependencies style themselves in their own shadow roots —
 * this sheet carries ONLY this contract's anatomy.
 */
export const css = "/* Badge — shadow stylesheet from ds.badge v1.1.0 (@ds-contracts/emitter-web-components) */\n\n:host {\n  display: contents;\n}\n\n*, *::before, *::after {\n  box-sizing: border-box;\n}\n\n[part='root'] {\n  display: inline-flex;\n  align-items: center;\n  justify-content: center;\n  border: 0;\n  padding-inline: var(--space-inset-x-sm);\n  padding-block: var(--space-inset-y-sm);\n  border-radius: var(--radius-badge);\n  font-family: var(--font-control-family);\n  font-weight: var(--font-control-weight);\n  font-size: var(--font-badge-size);\n}\n\n[part='root']:where([data-variant='info']) {\n  background-color: var(--color-feedback-info-background);\n  color: var(--color-feedback-info-foreground);\n}\n\n[part='root']:where([data-variant='success']) {\n  background-color: var(--color-feedback-success-background);\n  color: var(--color-feedback-success-foreground);\n}\n\n[part='root']:where([data-variant='warning']) {\n  background-color: var(--color-feedback-warning-background);\n  color: var(--color-feedback-warning-foreground);\n}\n\n[part='root']:where([data-variant='danger']) {\n  background-color: var(--color-feedback-danger-background);\n  color: var(--color-feedback-danger-foreground);\n}\n\n[part='root']:where([data-variant='error']) {\n  background-color: var(--color-feedback-error-background);\n  color: var(--color-feedback-error-foreground);\n}";

const sheet = new CSSStyleSheet();
sheet.replaceSync(css);

export default sheet;
