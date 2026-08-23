/**
 * ALTITUDE FLOOR PROMOTION — `npx tsx examples/altitude/scripts/promote-floor.mjs`
 * (tsx, not bare node: the shared pipeline is TypeScript, and its state-preview
 * probe calls the REAL referee rather than re-implementing its rules.)
 *
 * SHIM. The pipeline this file used to carry inline — source-alias pass,
 * provenance anchors, statePreviews probe, minted merge, resolution guard
 * — now lives ONCE in `packages/cli/src/promote.ts`, driven by
 * `examples/altitude/ds-library.json`. Six near-identical copies meant a fix in
 * one (the class-stem join defect, task #25) stayed latent in the other five.
 *
 * Equivalent, and the reason this file still exists: every PROVENANCE block and
 * docs/21 §2.6 names this path, and so does the FLOOR-PROMOTED line inside each
 * promoted contract's description.
 *
 *   ds-contracts promote --config examples/altitude/ds-library.json
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promoteFromConfigFile } from '../../../packages/cli/src/promote.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
promoteFromConfigFile(path.join(HERE, '..', 'ds-library.json'));
