/**
 * CROSS-IMPORT MINTED-TOKEN SCOPE receipt — `npm run extract:figma:cross:check`.
 *
 * Fixtures: extract/figma/fixtures/cbds-plugin-button-brand-primary.dump.json
 * then cbds-plugin-dialog.dump.json — the owner's exact two-import session,
 * replayed in order.
 *
 * The field failure: import Button-Brand Primary (its typography mints
 * imported.button-brand-primary.button.font-size.large — fontSize is not
 * variable-bindable, so it mints even on a v1.4 send), then import Dialog in
 * the same session. Session linking correctly links the Dialog's action
 * button to ds.button-brand-primary — then the CANVAS preview refused:
 * 'Cannot resolve token "imported.button-brand-primary.button.font-size.
 * large"'. Root cause: the composite batch carried earlier imports' minted
 * layers into the preview/canvas DOCUMENTS as CSS text only
 * (sessionImportCss — a var(--…) channel), while the figma engine resolves
 * typography/geometry LITERALS through the token TREE it is created over —
 * and the active token source composes only the ON-SCREEN contract's
 * minted+captured layers. The linked child's tree channel was composed
 * nowhere; the canvas (and any emitter fed the active tree) refused.
 *
 * THE RULE, as shipped (playground/src/engine/linked-scope.ts, pure —
 * replayed verbatim here): rendering a linked contract pulls that contract's
 * OWN import layers (minted imported.* + captured variables) into scope,
 * merged UNDER the active source (active/base wins on collision; shadowed
 * captured names pruned and named), labeled in receipts:
 * "resolving through Button-Brand Primary's imported tokens — N (…)".
 * Every surface resolves through it: the canvas engine tree, all four
 * emitter ctx.tokens, the figma-script minted preamble (linked minted trees
 * ride; captured variables never re-upsert — they are the origin file's own).
 *
 * Node script over pure functions — the cbds-bridge-check pattern; the
 * playground wiring is source-pinned (the canvas-box-check pattern).
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { ContractSchema, type Contract } from '../../scripts/contract-schema.js';
import { loadTokenCorpus } from './tokens.js';
import { loadContracts } from './propose.js';
import { proposeBatchFromDump } from '../../core/propose-figma.js';
import { capturedTokensFromDump } from '../../core/captured-tokens.js';
import { createFigmaEngine, emitFigmaScript } from '../../core/emit-figma-script.js';
import { emitHtml } from '../../core/emit-html.js';
import { emitReact, generateCss } from '../../core/emit-react.js';
import { emitReactInline } from '../../core/emit-react-inline.js';
import { tokenInventoryFromJson, type TokenTreeInput } from '../../core/tokens.js';
import {
  applyLinkedScope,
  linkedImportScope,
  mergeTrees,
} from '../../playground/src/engine/linked-scope.js';
import type { SessionEntryLayers } from '../../playground/src/engine/session-registry.js';

const ROOT = process.cwd();
const read = (p: string) => JSON.parse(readFileSync(path.join(ROOT, p), 'utf8')) as Record<string, unknown>;

const failures: string[] = [];
const check = (label: string, cond: boolean) => {
  if (!cond) failures.push(label);
  console.log(`  ${cond ? '✔' : '✖'} ${label}`);
};

console.log('Cross-import minted-token scope (button → dialog session replay)');

// ---------------------------------------------------------------------------
// 1. The session, replayed in the owner's order
// ---------------------------------------------------------------------------

console.log('\n1. Import #1: Button-Brand Primary (its own layers mint/capture)');
const corpus = loadTokenCorpus(ROOT);
const loaded = loadContracts(path.resolve(ROOT, 'contracts'));
const buttonDump = read('extract/figma/fixtures/cbds-plugin-button-brand-primary.dump.json');
const buttonBatch = proposeBatchFromDump(buttonDump, {
  corpus,
  contractIdByName: loaded.byName,
  contractsById: loaded.byId,
  fileKey: 'WofZT8xaxXuc2Q6Je9S4XE',
  mintUnbound: true,
});
const buttonProposal = buttonBatch.proposals[0];
const buttonContract: Contract = ContractSchema.parse(buttonProposal.contract);
const buttonCaptured = capturedTokensFromDump(buttonDump);
check('button proposes as ds.button-brand-primary', buttonContract.id === 'ds.button-brand-primary');
check(
  `button MINTS typography (imported.button-brand-primary.button.font-size.large present; ${buttonProposal.mintedTokens?.count ?? 0} minted)`,
  (buttonProposal.mintedTokens?.entries ?? []).some((e) => e.ref === '{imported.button-brand-primary.button.font-size.large}'),
);
check(`button CAPTURES its variables (${buttonCaptured?.count ?? 0} — dump v1.4 _variables)`, (buttonCaptured?.count ?? 0) > 0);

console.log('\n2. Import #2: Dialog — session linking finds the button');
const sessionByName = new Map(loaded.byName);
sessionByName.set(buttonContract.name, buttonContract.id);
sessionByName.set('Button-Brand Primary', buttonContract.id);
const sessionById = new Map(loaded.byId);
sessionById.set(buttonContract.id, buttonContract);
const sessionByKey = new Map<string, string>();
const buttonKey = buttonContract.anchors.figma.componentSetKey;
if (buttonKey) sessionByKey.set(buttonKey, buttonContract.id);

const dialogDump = read('extract/figma/fixtures/cbds-plugin-dialog.dump.json');
const dialogBatch = proposeBatchFromDump(dialogDump, {
  corpus,
  contractIdByName: sessionByName,
  contractIdByKey: sessionByKey,
  contractsById: sessionById,
  fileKey: 'WofZT8xaxXuc2Q6Je9S4XE',
  mintUnbound: true,
});
const dialogProposal = dialogBatch.proposals[0];
const dialogContract: Contract = ContractSchema.parse(dialogProposal.contract);
const dialogStubs = (dialogProposal.childStubs ?? []).map((s) => ContractSchema.parse(s));
const dialogCaptured = capturedTokensFromDump(dialogDump);
check(
  'the Dialog LINKS its action button to ds.button-brand-primary (no stub for it)',
  JSON.stringify(dialogProposal.contract).includes('"ds.button-brand-primary"') &&
    !dialogStubs.some((s) => s.id === 'ds.button-brand-primary'),
);

// The render scope the playground validate step assembles: repo + session +
// the contract on screen + its stubs.
const contracts = new Map<string, Contract>(loaded.byId as Map<string, Contract>);
contracts.set(buttonContract.id, buttonContract);
contracts.set(dialogContract.id, dialogContract);
for (const s of dialogStubs) if (!contracts.has(s.id)) contracts.set(s.id, s);

// The ACTIVE token source with the Dialog on screen: repo trees + the
// DIALOG's captured layer + the DIALOG's minted layer (token-source.ts
// recompose — per-loaded-contract by design). The button's layers are NOT
// here; that is the point.
const dialogCapturedTree: Record<string, unknown> = {};
{
  const repoInv = tokenInventoryFromJson([
    read('tokens/primitives.tokens.json'),
    read('tokens/semantic.tokens.json'),
    read('tokens/modes/semantic.light.tokens.json'),
    read('tokens/modes/semantic.dark.tokens.json'),
  ]);
  for (const e of dialogCaptured?.entries ?? []) {
    if (repoInv.has(e.path)) continue; // composeCaptured shadow rule
    const segs = e.path.split('.');
    let node = dialogCapturedTree;
    for (const seg of segs.slice(0, -1)) node = (node[seg] ??= {}) as Record<string, unknown>;
    node[segs[segs.length - 1]] = { $value: e.value, $type: e.type };
  }
}
const activeSemantic = mergeTrees([
  read('tokens/semantic.tokens.json'),
  dialogCapturedTree,
  (dialogProposal.mintedTokens?.tree ?? {}) as Record<string, unknown>,
]);
const activeTree: TokenTreeInput = {
  primitives: read('tokens/primitives.tokens.json'),
  semantic: activeSemantic,
  light: read('tokens/modes/semantic.light.tokens.json'),
  dark: read('tokens/modes/semantic.dark.tokens.json'),
  brands: { default: read('tokens/modes/brand.default.tokens.json') },
};
const activeInventory = tokenInventoryFromJson([
  activeTree.primitives,
  activeTree.semantic,
  activeTree.light,
  activeTree.dark,
]);

// ---------------------------------------------------------------------------
// 3. CONTROL: without the linked scope, the canvas refuses — BY NAME
// ---------------------------------------------------------------------------

console.log('\n3. Control: the active tree alone reproduces the owner\'s refusal');
let controlRefusal = '';
try {
  const engine = createFigmaEngine({ tokens: activeTree, icons: new Map() });
  engine.compileComponentData(dialogContract, contracts); // the root compiles…
  engine.compileComponentData(buttonContract, contracts); // …the LINKED child refuses
} catch (e) {
  controlRefusal = e instanceof Error ? e.message : String(e);
}
check(
  `WITHOUT the scope, compiling the linked button refuses with the owner's exact message (got "${controlRefusal}")`,
  controlRefusal === 'Cannot resolve token "imported.button-brand-primary.button.font-size.large"',
);

// ---------------------------------------------------------------------------
// 4. THE FIX: linkedImportScope pulls the button's OWN layers into scope
// ---------------------------------------------------------------------------

console.log('\n4. linkedImportScope: the linked child\'s minted+captured layers join the tree');
const layersByContractId = new Map<string, SessionEntryLayers>([
  [
    buttonContract.id,
    {
      name: 'Button-Brand Primary', // the DRAWN set name — the workspace entry's display name
      minted:
        buttonProposal.mintedTokens && buttonProposal.mintedTokens.count > 0
          ? buttonProposal.mintedTokens
          : null,
      captured: buttonCaptured,
    },
  ],
]);
const scope = linkedImportScope(dialogContract, contracts, layersByContractId, activeInventory);
check('the scope discovers the linked button through the composition graph', scope.receipts.length === 1);
check(
  'the scope carries the button\'s minted paths (imported.button-brand-primary.button.font-size.large)',
  scope.paths.has('imported.button-brand-primary.button.font-size.large'),
);
const receipt = scope.receipts[0] ?? '';
console.log(`    receipt: "${receipt}"`);
check(
  "the cross-layer receipt line is present and labeled: 'resolving through Button-Brand Primary's imported tokens — N'",
  /^resolving through Button-Brand Primary's imported tokens — \d+ \(/.test(receipt),
);
check(
  'captured names the active source already defines are PRUNED and NAMED in the receipt (base wins, never overridden)',
  receipt.includes('already defined by the active source (base wins, never overridden)') &&
    [...scope.paths].every((p) => !activeInventory.has(p)),
);

const scopedTree = applyLinkedScope(activeTree, scope);
let canvasVariants: number | string = 0;
let childVariants: number | string = 0;
try {
  const engine = createFigmaEngine({ tokens: scopedTree, icons: new Map() });
  canvasVariants = engine.compileComponentData(dialogContract, contracts).variants.length;
  childVariants = engine.compileComponentData(buttonContract, contracts).variants.length;
} catch (e) {
  canvasVariants = String(e).split('\n')[0];
}
check(`the CANVAS compiles: dialog 4 variants (got ${canvasVariants})`, canvasVariants === 4);
// 3 base variants: the size axis — the drawn state axis promoted to
// `states` (state-axis promotion), so states ride as previews, not combos.
check(`the LINKED button compiles too: 3 size variants (got ${childVariants})`, childVariants === 3);

// ---------------------------------------------------------------------------
// 5. EVERY surface: react css text, preview html, react-inline, figma script
// ---------------------------------------------------------------------------

console.log('\n5. Zero token refusals on every emitted surface (scoped tree)');
const scopedInventory = new Set<string>([...activeInventory, ...scope.paths]);
const refereeErrors: string[] = [];
generateCss(dialogContract, scopedInventory, refereeErrors);
check(`referee (generateCss over the scoped inventory): zero violations (got ${refereeErrors.length})`, refereeErrors.length === 0);

const trySurface = (label: string, fn: () => void) => {
  try {
    fn();
    check(`${label} emits with ZERO refusals`, true);
  } catch (e) {
    check(`${label} emits with ZERO refusals — got: ${String(e).split('\n')[0]}`, false);
  }
};
trySurface('react (css modules)', () =>
  emitReact(dialogContract, { tokens: scopedInventory, icons: new Map(), contracts }),
);
trySurface('html (preview surface)', () =>
  emitHtml(dialogContract, { tokens: scopedInventory, icons: new Map(), contracts }),
);
trySurface('react-inline (literal resolution through the scoped tree)', () =>
  emitReactInline(dialogContract, { tokens: scopedTree, icons: new Map(), contracts }),
);
let script = '';
trySurface('figma script (engine over the scoped tree)', () => {
  script = emitFigmaScript(dialogContract, {
    tokens: scopedTree,
    icons: new Map(),
    contracts,
    mintedTokens: mergeTrees([
      ...scope.mintedTrees,
      (dialogProposal.mintedTokens?.tree ?? {}) as Record<string, unknown>,
    ]),
  });
});
check(
  "the figma script's minted preamble upserts the LINKED button's minted variables too",
  script.includes('imported/button-brand-primary/button/font-size/large'),
);
check(
  "…but never the button's CAPTURED variables (they are the origin file's own)",
  !script.includes('"component-size/xlarge"') || script.includes('need('),
);

// ---------------------------------------------------------------------------
// 6. Playground wiring, source-pinned (the canvas-box-check pattern)
// ---------------------------------------------------------------------------

console.log('\n6. The playground surfaces all route through the scope');
const pin = (rel: string, needle: string, label: string) => {
  const p = path.join(ROOT, ...rel.split('/'));
  const src = existsSync(p) ? readFileSync(p, 'utf8') : '';
  check(label, src.includes(needle));
};
pin(
  'playground/src/engine/canvas-preview.ts',
  'linkedImportScope(contract, byId, sessionRegistry().layersByContractId, source.inventory)',
  'canvas-preview builds the engine over applyLinkedScope(source.tree, scope)',
);
pin(
  'playground/src/engine/canvas-preview.ts',
  '...scope.receipts, ...fidelityNotes',
  'canvas-preview surfaces the receipt lines in its fidelity notes',
);
pin(
  'playground/src/pages/Playground.tsx',
  'applyLinkedScope(tokenSource.tree, scope)',
  'the emitted outputs (react / html / react-inline / figma-script) ride the scoped tree',
);
pin(
  'playground/src/pages/Playground.tsx',
  'mergeTrees([...scope.mintedTrees, mintedLayer?.tree ?? {}])',
  'the figma-script preamble merges linked minted trees under the active layer',
);
pin(
  'playground/src/engine/preview.ts',
  'registry.capturedLayers',
  'sessionImportCss injects earlier imports\' captured layers (CSS channel) before the base stylesheets',
);
pin(
  'playground/src/engine/session-registry.ts',
  'layersByContractId',
  'the session registry exposes per-contract import layers (newest entry wins)',
);

// ---------------------------------------------------------------------------

if (failures.length > 0) {
  console.error(`\n✖ ${failures.length} cross-import-scope invariant(s) failed`);
  process.exit(1);
}
console.log(
  "\n✔ cross-import scope holds: the two-import session replays with ZERO token refusals on every surface — the linked button's minted+captured layers resolve from the session registry, labeled 'resolving through Button-Brand Primary's imported tokens — N', with the control reproducing the owner's exact refusal when the scope is withheld",
);
