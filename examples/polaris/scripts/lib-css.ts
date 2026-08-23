/**
 * Compatibility shim. The Polaris CSS-module inversion is CODE, not a capture
 * artifact, so it lives with the other extraction code at
 * extract/computed/lib-css.ts (research-boundary prep, 2026-08-23). This
 * re-export keeps the old import path resolving; new importers should use the
 * new path directly.
 */
export * from '../../../extract/computed/lib-css.js';
