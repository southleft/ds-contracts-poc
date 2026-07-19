/**
 * Re-export shim — the contract schema SOURCE moved to
 * packages/schema/src/contract-schema.ts (@ds-contracts/schema) so it can
 * ship as a standalone package versioned with the spec. Every existing
 * import path (`../scripts/contract-schema.js`) keeps working through this
 * shim; there is still exactly ONE live Zod document.
 */
export * from '../packages/schema/src/contract-schema.js';
