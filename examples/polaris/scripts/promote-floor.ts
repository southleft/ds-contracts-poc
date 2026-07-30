/**
 * POLARIS FLOOR PROMOTION — `npx tsx examples/polaris/scripts/promote-floor.ts`
 *
 * SHIM since the task-#26 recapture round (2026-07-29). The bespoke v0.3.2
 * pipeline this file used to carry inline — the LAST pre-generalization
 * promoter, with no source-alias pass — now lives ONCE in
 * `packages/cli/src/promote.ts`, driven by `examples/polaris/ds-library.json`.
 * The recapture round was the right moment to move: the round re-ran every
 * capture with the CSS-vars reader on (`varPrefix: "--p-"` + `tokenGroup:
 * "p"`), so the contracts were changing anyway and the alias pass is the
 * entire payoff — minted leaves whose covering combos agree on one verified
 * source token become DTCG aliases to Polaris's own `{p.*}` names instead of
 * anonymous literals.
 *
 * Equivalent, and the reason this file still exists: PROVENANCE and docs
 * name this path, and so does the promoted-contract description line.
 *
 *   ds-contracts promote --config examples/polaris/ds-library.json
 *
 * Astryx is now the one library with its own promote script (the re-anchor
 * decisions ledger, docs/23 §3.1).
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promoteFromConfigFile } from '../../../packages/cli/src/promote.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
promoteFromConfigFile(path.join(HERE, '..', 'ds-library.json'));
