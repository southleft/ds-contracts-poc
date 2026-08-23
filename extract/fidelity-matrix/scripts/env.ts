/**
 * Compatibility shim. The FIGMA_TOKEN reader is CODE, not a fidelity-matrix
 * capture artifact, so it lives with the visual-parity code at
 * extract/figma/visual-parity/env.ts (research-boundary prep, 2026-08-23).
 * This re-export keeps the old import path resolving; new importers should
 * use the new path directly.
 */
export { figmaToken } from '../../figma/visual-parity/env.js';
