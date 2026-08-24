/**
 * ANT DESIGN FLOOR PROMOTION — `npx tsx examples/antd/scripts/promote-floor.mjs`
 * (tsx, not bare node: the shared pipeline is TypeScript, and its state-preview
 * probe calls the REAL referee rather than re-implementing its rules.)
 *
 * SHIM over the ONE shared pipeline (`packages/cli/src/promote.ts` — source-
 * alias pass, provenance anchors, statePreviews probe, minted merge,
 * resolution guard), driven by `examples/antd/ds-library.json`.
 *
 * Equivalent:
 *
 *   ds-contracts promote --config examples/antd/ds-library.json
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promoteFromConfigFile } from '../../../packages/cli/src/promote.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
promoteFromConfigFile(path.join(HERE, '..', 'ds-library.json'));
