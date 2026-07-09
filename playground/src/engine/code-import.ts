/**
 * Code → contract, LAZY by design: proposeFromCode rides the TypeScript
 * compiler (~5 MB min). This module is only ever reached via
 * `await import('./code-import.js')` behind the "Propose contract" action,
 * so Rollup assigns the compiler to this chunk — the initial page never
 * pays for it. (See playground/PLAN.md "Risks & mitigations".)
 */
import { proposeFromCode, type ProposeCodeResult, type SourceFileInput } from '../../../core/index.js';
import { activeTokens } from './token-source.js';

export type { ProposeCodeResult };

export function proposeFromCodeText(tsx: string, css: string, sourcePath: string): ProposeCodeResult {
  return proposeFromCode(
    { sourcePath, source: tsx, ...(css.trim() ? { css } : {}) },
    // The ACTIVE trees — var(--…) → {token.ref} bindings referee against the
    // user's pasted tree when one is applied (token-source.ts). mintUnbound:
    // raw literals and foreign var()s the tree cannot bind become provisional
    // `imported.*` tokens the proposal binds — a wild stylesheet stays styled
    // at literal fidelity (core/mint-code.ts), matching the Figma path.
    { tokens: activeTokens().treesForCode, prefix: 'ds', mintUnbound: true },
  );
}

/** Multi-file variant — the GitHub tracer's SourceFileInput[] (entry first,
 *  followed imports after, stylesheets attached per file) through the same
 *  proposer. First definition wins on duplicate component names, matching
 *  the CLI's directory walk. `extraCss` carries discovered token stylesheets
 *  (a tokens.css no component imports) — the :root vocabulary foreign var()s
 *  mint against. */
export function proposeFromCodeFiles(files: SourceFileInput[], extraCss: string[] = []): ProposeCodeResult {
  return proposeFromCode(files, {
    tokens: activeTokens().treesForCode,
    prefix: 'ds',
    mintUnbound: true,
    extraCss,
  });
}
