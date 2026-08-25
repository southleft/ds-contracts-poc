/**
 * `light-dark()` — the ONE reader, in a module with NO dependencies.
 *
 * WHY IT LIVES ALONE. This function used to sit in core/stylex-tokens.ts,
 * which opens `import ts from 'typescript'` because it parses a StyleX
 * `defineVars` call. core/emit-figma-script.ts needs the light-dark split for
 * shadow layer colours, and importing it from there pulled the TypeScript
 * COMPILER into the Figma plugin's engine bundle: 820,666 -> 4,437,732
 * minified bytes, measured, for a 25-line string split. A plugin bundle is
 * shipped code, so that is a real regression and not a build detail.
 */

/** Split `light-dark(a, b)` into its two branches — paren-aware so nested
 *  `rgba(…, …)` commas do not split. Returns null unless the WHOLE value is
 *  exactly one light-dark() call with exactly two top-level arguments. */
export function splitLightDark(value: string): { light: string; dark: string } | null {
  const m = value.trim().match(/^light-dark\((.*)\)$/s);
  if (!m) return null;
  const inner = m[1];
  const parts: string[] = [];
  let depth = 0;
  let current = '';
  for (const ch of inner) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (depth < 0) return null; // unbalanced — not a clean light-dark()
    if (ch === ',' && depth === 0) {
      parts.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  parts.push(current);
  if (depth !== 0 || parts.length !== 2) return null;
  const [light, dark] = parts.map((p) => p.trim());
  if (!light || !dark) return null;
  return { light, dark };
}
