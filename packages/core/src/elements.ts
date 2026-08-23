/**
 * Element metadata — which HTML elements a contract root may claim, the
 * React attribute/element type names each maps to, and whether the element
 * carries a native `disabled`. A contract fact (validateContract refuses an
 * element outside this table; generateCss keys `:disabled` on
 * supportsDisabled), so it lives in the analysis layer even though two of
 * its columns are only read by the React projection. Moved verbatim from
 * the reference repo's core/emit-react.ts.
 */
export const ELEMENT_META: Record<string, { attrs: string; el: string; supportsDisabled: boolean }> = {
  button: { attrs: 'ButtonHTMLAttributes', el: 'HTMLButtonElement', supportsDisabled: true },
  span: { attrs: 'HTMLAttributes', el: 'HTMLSpanElement', supportsDisabled: false },
  div: { attrs: 'HTMLAttributes', el: 'HTMLDivElement', supportsDisabled: false },
  a: { attrs: 'AnchorHTMLAttributes', el: 'HTMLAnchorElement', supportsDisabled: false },
  input: { attrs: 'InputHTMLAttributes', el: 'HTMLInputElement', supportsDisabled: true },
  article: { attrs: 'HTMLAttributes', el: 'HTMLElement', supportsDisabled: false },
  section: { attrs: 'HTMLAttributes', el: 'HTMLElement', supportsDisabled: false },
  header: { attrs: 'HTMLAttributes', el: 'HTMLElement', supportsDisabled: false },
  footer: { attrs: 'HTMLAttributes', el: 'HTMLElement', supportsDisabled: false },
  label: { attrs: 'LabelHTMLAttributes', el: 'HTMLLabelElement', supportsDisabled: false },
  nav: { attrs: 'HTMLAttributes', el: 'HTMLElement', supportsDisabled: false },
  hr: { attrs: 'HTMLAttributes', el: 'HTMLHRElement', supportsDisabled: false },
  ul: { attrs: 'HTMLAttributes', el: 'HTMLUListElement', supportsDisabled: false },
  li: { attrs: 'LiHTMLAttributes', el: 'HTMLLIElement', supportsDisabled: false },
  p: { attrs: 'HTMLAttributes', el: 'HTMLParagraphElement', supportsDisabled: false },
  textarea: { attrs: 'TextareaHTMLAttributes', el: 'HTMLTextAreaElement', supportsDisabled: true },
  select: { attrs: 'SelectHTMLAttributes', el: 'HTMLSelectElement', supportsDisabled: true },
  fieldset: { attrs: 'FieldsetHTMLAttributes', el: 'HTMLFieldSetElement', supportsDisabled: true },
  // Plain HTMLAttributes: BlockquoteHTMLAttributes declares `cite: string`,
  // which collides with slot props named cite (Astryx Blockquote API).
  blockquote: { attrs: 'HTMLAttributes', el: 'HTMLQuoteElement', supportsDisabled: false },
  code: { attrs: 'HTMLAttributes', el: 'HTMLElement', supportsDisabled: false },
  kbd: { attrs: 'HTMLAttributes', el: 'HTMLElement', supportsDisabled: false },
  h1: { attrs: 'HTMLAttributes', el: 'HTMLHeadingElement', supportsDisabled: false },
  h2: { attrs: 'HTMLAttributes', el: 'HTMLHeadingElement', supportsDisabled: false },
  h3: { attrs: 'HTMLAttributes', el: 'HTMLHeadingElement', supportsDisabled: false },
  h4: { attrs: 'HTMLAttributes', el: 'HTMLHeadingElement', supportsDisabled: false },
  h5: { attrs: 'HTMLAttributes', el: 'HTMLHeadingElement', supportsDisabled: false },
  h6: { attrs: 'HTMLAttributes', el: 'HTMLHeadingElement', supportsDisabled: false },
};
