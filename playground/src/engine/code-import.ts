/**
 * Code → contract, LAZY by design: proposeFromCode rides the TypeScript
 * compiler (~5 MB min). This module is only ever reached via
 * `await import('./code-import.js')` behind the "Propose contract" action,
 * so Rollup assigns the compiler to this chunk — the initial page never
 * pays for it. (See playground/PLAN.md "Risks & mitigations".)
 */
import { proposeFromCode, type ProposeCodeResult } from '../../../core/index.js';
import { activeTokens } from './token-source.js';

export function proposeFromCodeText(tsx: string, css: string, sourcePath: string): ProposeCodeResult {
  return proposeFromCode(
    { sourcePath, source: tsx, ...(css.trim() ? { css } : {}) },
    // The ACTIVE trees — var(--…) → {token.ref} bindings referee against the
    // user's pasted tree when one is applied (token-source.ts).
    { tokens: activeTokens().treesForCode, prefix: 'ds' },
  );
}
