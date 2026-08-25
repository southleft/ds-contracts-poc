/**
 * Re-export shim — the REQUIRED-FACTS referee SOURCE lives in
 * packages/core/src/required-facts.ts (@ds-contracts/core) so an emitter
 * plugin outside this repo gets the same refusal the repo's own bundler
 * applies. Every repo import path keeps working through this shim; there is
 * still exactly ONE fact table.
 */
export * from '../packages/core/src/required-facts.js';
