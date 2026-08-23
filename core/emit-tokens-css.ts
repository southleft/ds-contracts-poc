/**
 * Re-export shim — the tokens.css emitter (DTCG trees → the custom-property
 * sheet every code target references) moved to
 * packages/core/src/emit-tokens-css.ts (@ds-contracts/core) so an emitter
 * built outside this repo emits the same sheet the CLI does. Every existing
 * import path keeps working through this shim; there is still exactly ONE
 * implementation.
 */
export * from '../packages/core/src/emit-tokens-css.js';
