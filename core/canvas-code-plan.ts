/**
 * Re-export shim — the canvas → code plan (file paths per target, the
 * provenance sentence, the proposal file-name spellings) moved to
 * packages/core/src/canvas-code-plan.ts (@ds-contracts/core) so the CLI and
 * a third-party tool name the same files. Every existing import path keeps
 * working through this shim; there is still exactly ONE implementation.
 */
export * from '../packages/core/src/canvas-code-plan.js';
