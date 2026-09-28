/**
 * Free text written into emitted source. Figma text reaches generated React
 * verbatim: a TEXT property default ("We're rolling out a new theming
 * engine…"), an instance's text override, a component description. Written
 * unescaped, an apostrophe ended the string literal early and the whole
 * library refused with a parse error (cold-start test, 2026-09-28: Altitude
 * Banner, `react-library-generation-refused: ds.banner: emit failed — ","
 * expected`).
 *
 * Every helper keeps text that needs no escaping in its historical spelling,
 * byte for byte, so committed generated output does not move. Anything that
 * would end the literal early or change its value is written as a JSON
 * string, which is also a valid JavaScript and TypeScript string literal.
 * (JSX children use literalTextJsx in root-content.ts, the same rule.)
 */

/** A JavaScript string literal: `'text'`, or a JSON string when the text holds
 *  a single quote, a backslash or a line break. */
export function literalStringJs(text: string): string {
  return /['\\\r\n]/.test(text) ? JSON.stringify(text) : `'${text}'`;
}

/** A JSX attribute `name="text"`. A JSX attribute string has no escapes: a
 *  double quote ends it and `&…;` decodes as an HTML entity, so such text (and
 *  a line break, which formatting may not preserve) becomes an expression. */
export function literalAttrJsx(name: string, text: string): string {
  return /["&\r\n]/.test(text) ? `${name}={${JSON.stringify(text)}}` : `${name}="${text}"`;
}

/** Text inside a JSDoc block. A `*` followed by `/` would close the comment
 *  and leave the rest of the text as source code. */
export function literalDocText(text: string): string {
  return text.replaceAll('*/', '*\\/');
}
