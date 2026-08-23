/**
 * @ds-contracts/core — what an emitter needs from the engine, published.
 *
 * Dependency policy (enforced by scripts/verify-published-packages.mjs): this
 * package depends on @ds-contracts/schema and nothing else. No TypeScript
 * compiler, no prettier, no playwright, no node:* at import — every module
 * here is pure data-in/strings-out and browser-importable. The reference
 * repo's core/tokens.ts, core/contract-provenance.ts, core/emitter.ts and
 * extract/types.ts (kebab) are re-export shims over THIS source, so repo
 * and package cannot drift.
 */

// The emitter contract + the registry.
export {
  emitterByName,
  emitters,
  getEmitters,
  registerEmitter,
  type EmittedFile,
  type Emitter,
  type EmitterCtx,
} from './emitter.js';

// Token loading from JSON objects (never paths).
export {
  aliasTarget,
  collectTokenPaths,
  flattenTokens,
  makeResolveLiteral,
  px,
  pxOrNull,
  tokenInventoryFromJson,
  type TokenEntry,
  type TokenTreeInput,
} from './tokens.js';

// Naming.
export { kebab } from './naming.js';

// Optional provenance + stale-source state machine (browser-safe).
export {
  assertContractProvenance,
  canonicalJson,
  canonicalRevisionOf,
  markAwaitingCodeAdoption,
  revisionOf,
  type AwaitingCodeAdoption,
  type ContractProvenance,
  type ContractSourceProvenance,
  type ProvenancedContract,
} from './contract-provenance.js';
