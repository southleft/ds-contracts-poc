/**
 * Re-export shim — the grid CSS inversion (the code-side half of the A2
 * layout grammar: track / area / line / flow parsers with G7 named refusals)
 * moved to packages/core/src/grid-css.ts (@ds-contracts/core). Every existing
 * import path keeps working through this shim; there is still exactly ONE
 * implementation.
 */
export * from '../packages/core/src/grid-css.js';
