/**
 * @ds-contracts/schema — the contract spec as a package.
 *
 * One live Zod document (contract-schema.ts, spec v17), the schema-level
 * validateContract referee, the v16 → v17 migrate codemod, and the generated JSON Schema
 * (./contract.schema.json, emitted from the same Zod document at build).
 * The repo's scripts/contract-schema.ts is a re-export shim over this
 * source — repo and package cannot drift.
 */
export * from './contract-schema.js';
export { migrateDocumentToV17, mayCarryV16Spelling, type MigrationResult } from './migrate.js';
export {
  validateContract,
  validateContractSet,
  type ValidateResult,
  type ValidateSetResult,
} from './validate.js';
