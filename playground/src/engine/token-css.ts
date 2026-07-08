/**
 * Token tree → CSS custom properties, PURE — derived from the repo's token
 * build (scripts/build-tokens.mjs: flatten / cssName / cssValue / emit),
 * minus the file I/O and the repo's mode/brand layering. The playground uses
 * it to REGENERATE the preview stylesheet when the user pastes their own
 * DTCG trees; the bundled src/styles/tokens*.css remain the repo build's
 * verbatim output. Same dialect, same rules: hex-string colors, unit-string
 * dimensions, single-level `{path.to.token}` aliases preserved as var()
 * references; an alias into nothing is a NAMED error, never a guess.
 */
import { flattenTokens } from '../../../core/index.js';

const cssName = (path: string) => `--${path.split('.').join('-')}`;
const ALIAS = /^\{([^}]+)\}$/;

export interface TokenCssResult {
  css: string;
  /** One entry per alias that points at a token the tree does not define —
   *  the same condition scripts/build-tokens.mjs fails the build on. */
  errors: string[];
}

/** One selector block over a merged DTCG tree (the pasted documents,
 *  deep-merged). Aliases resolve against the same tree — a pasted user set
 *  is ONE layer by construction. */
export function tokenTreeToCss(tree: Record<string, unknown>, selector = ':root'): TokenCssResult {
  const flat = flattenTokens(tree);
  const errors: string[] = [];
  const lines = [
    '/* Regenerated in the browser from the pasted DTCG tree(s) —',
    '   same rules as scripts/build-tokens.mjs, session-only. */',
    '',
    `${selector} {`,
  ];
  for (const [path, entry] of flat) {
    const value = entry.value;
    let cssValue: string;
    if (typeof value === 'string') {
      const alias = value.match(ALIAS);
      if (alias) {
        if (!flat.has(alias[1])) {
          errors.push(`Token "${path}" references "{${alias[1]}}" which does not exist in the pasted tree`);
          continue;
        }
        cssValue = `var(${cssName(alias[1])})`;
      } else {
        cssValue = value;
      }
    } else {
      cssValue = String(value);
    }
    lines.push(`  ${cssName(path)}: ${cssValue};`);
  }
  lines.push('}', '');
  return { css: lines.join('\n'), errors };
}
