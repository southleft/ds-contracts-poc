/**
 * Re-export shim — the shared Figma name spellings (`camel`,
 * `canonicalPropName`) moved to packages/core/src/figma-names.ts
 * (@ds-contracts/core). Every existing import path keeps working through
 * this shim; there is still exactly ONE implementation.
 */
export * from "../packages/core/src/figma-names.js";
