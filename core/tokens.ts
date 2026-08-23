/**
 * Re-export shim — the token resolver SOURCE moved to
 * packages/core/src/tokens.ts (@ds-contracts/core) so an emitter built
 * outside this repo resolves tokens with the same code the CLI runs. Every
 * existing import path (`../core/tokens.js`) keeps working through this shim;
 * there is still exactly ONE implementation.
 */
export * from '../packages/core/src/tokens.js';
