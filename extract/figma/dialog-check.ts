/**
 * Receipts for the OWNER'S DIALOG SEND (global part-name dedup) —
 * `npm run extract:figma:dialog:check`.
 *
 * Fixture: extract/figma/fixtures/cbds-plugin-dialog.dump.json — the owner's
 * CBDS "Dialog" set, sliced verbatim from the committed all-sets dump
 * (extract/figma/fixtures/cbds-plugin-all-sets.dump.json; import frontier
 * frozen — no re-fetch).
 *
 * The field failure: his Dialog REFUSED with 'duplicate anatomy part name
 * "Title"' + '"Icon"'. Root cause: part names are CONTRACT-WIDE identity
 * (CSS classes, swap layers, note paths — emit-react's validateContract
 * refuses duplicates anywhere in the anatomy), but the proposer deduped only
 * among SIBLINGS. His canvas draws Title[FRAME] > Title[TEXT] (wrapper and
 * text at different depths) and two Icon instances under DIFFERENT parents
 * (Title vs Frame 2) — legal on the canvas, refused at emit.
 *
 * THE DEDUP RULE, as shipped (core/propose-figma.ts partKey): one GLOBAL
 * part-name registry per proposal; keys claimed in anatomy order, parents
 * before children (pre-order) — the FIRST drawn part keeps its name; a later
 * collision takes the PARENT-DERIVED PREFIX (parentKey + PascalName —
 * "Icon" under "Frame 2" → "frame2Icon") when the parent key adds
 * information and is itself free, else an ORDINAL SUFFIX ("Title" inside
 * the "Title" wrapper → "Title2"). Every rename is a NAMED note carrying
 * the node path.
 *
 * Referee inventory note: this slice is dump v1.3 (no `_variables` channel),
 * so there is no captured-token layer to register values from. His LIVE
 * sends are v1.4 — the plugin registers every bound variable name before the
 * referee runs (cbds-bridge-check pins that path end-to-end, values
 * included). The referee is a NAME referee (Set<string> of token paths);
 * this check mirrors the v1.4 registration by registering the dump's own
 * bound-name channel (names only — no values invented), and REPRODUCES the
 * name refusals as a control when the layer is withheld.
 *
 * Node script over pure functions — the cbds-bridge-check pattern.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { ContractSchema, walkAnatomy, type Contract } from '../../scripts/contract-schema.js';
import { loadTokenCorpus } from './tokens.js';
import { loadContracts } from './propose.js';
import { proposeBatchFromDump } from '../../core/propose-figma.js';
import { emitHtml } from '../../core/emit-html.js';
import { generateCss } from '../../core/emit-react.js';
import { createFigmaEngine } from '../../core/emit-figma-script.js';
import { flattenTokens, tokenInventoryFromJson } from '../../core/tokens.js';
import type { DumpNode } from './types.js';

const ROOT = process.cwd();
const read = (p: string) => JSON.parse(readFileSync(path.join(ROOT, p), 'utf8')) as Record<string, unknown>;

const failures: string[] = [];
const check = (label: string, cond: boolean) => {
  if (!cond) failures.push(label);
  console.log(`  ${cond ? '✔' : '✖'} ${label}`);
};

// ---------------------------------------------------------------------------
// The send, replayed
// ---------------------------------------------------------------------------

console.log('CBDS Dialog send (cbds-plugin-dialog.dump.json — global part-name dedup)');
const dump = read(path.join('extract', 'figma', 'fixtures', 'cbds-plugin-dialog.dump.json'));
const corpus = loadTokenCorpus(ROOT);
const loaded = loadContracts(path.resolve(ROOT, 'contracts'));
const batch = proposeBatchFromDump(dump, {
  corpus,
  contractIdByName: loaded.byName,
  contractsById: loaded.byId,
  fileKey: 'WofZT8xaxXuc2Q6Je9S4XE',
  mintUnbound: true,
});
check('1 proposed, 0 skipped (the send completes)', batch.proposals.length === 1 && batch.skipped.length === 0);
const proposal = batch.proposals[0];
const contract: Contract = ContractSchema.parse(proposal.contract);
const stubs = (proposal.childStubs ?? []).map((s) => ContractSchema.parse(s));

// ---------------------------------------------------------------------------
// 1. Global dedup: unique names everywhere, renames NAMED with node paths
// ---------------------------------------------------------------------------

console.log('\n1. Global part-name dedup (the duplicate-"Title"/"Icon" refusal class)');
const walked = walkAnatomy(contract);
const names = walked.map((w) => w.name);
check(`part names are UNIQUE contract-wide (${names.length} parts, ${new Set(names).size} distinct)`, new Set(names).size === names.length);
check('the drawn "Title" WRAPPER keeps its name (first drawn part wins)', names.includes('Title'));
check('the "Title" TEXT inside it takes the ordinal — "Title2" (parent key IS the colliding name, so no prefix)', names.includes('Title2'));
check('the first drawn "Icon" (title icon) keeps its name', names.includes('Icon'));
check('the second "Icon" (close icon, under "Frame 2") takes the parent-derived prefix — "frame2Icon"', names.includes('frame2Icon'));
check(
  'the "Title" rename is a NAMED note carrying the node path',
  proposal.notes.some((n) => n.startsWith('Dialog:root/Container/Header/Title/Title:') && n.includes('renamed to "Title2"')),
);
check(
  'the "Icon" rename is a NAMED note carrying the node path',
  proposal.notes.some((n) => n.startsWith('Dialog:root/Container/Header/Frame 2/Icon:') && n.includes('renamed to "frame2Icon"')),
);
check(
  'the dedup rule is SPELLED in the notes (first drawn part keeps the name; parent-derived prefix, else ordinal)',
  proposal.notes.some((n) => n.includes('first drawn part keeps the name') && n.includes('parent-derived prefix, else an ordinal suffix')),
);
check(
  'the lorem-ipsum body text keys identifier-safe (camel, punctuation stripped — CSS classes must parse)',
  names.every((n) => /^[A-Za-z][A-Za-z0-9]*$/.test(n)),
);

// ---------------------------------------------------------------------------
// 2. Part inventory complete vs the dump tree
// ---------------------------------------------------------------------------

console.log('\n2. Part inventory complete vs the dump tree');
const partByName = new Map(walked.map((w) => [w.name, w.part]));
check('Container / Header / Actions structure carried', names.includes('Container') && names.includes('Header') && names.includes('Actions'));
check(
  'BOTH _Slot-Dialog underscore-instances carry as slots (swap-bound INSTANCE_SWAP → slot parts, sanitized names)',
  partByName.get('swapSlotItem1')?.slot !== undefined && partByName.get('swapSlotItem2')?.slot !== undefined,
);
check(
  'the slot names ride the canonicalPropName sanitize rule ("swap-slot-item-1"/"-2" → swapSlotItem1/2)',
  partByName.get('swapSlotItem1')?.slot?.name === 'swapSlotItem1' && partByName.get('swapSlotItem2')?.slot?.name === 'swapSlotItem2',
);
const actionRefs = ['buttonNeutralTertiary', 'buttonBrandSecondary', 'buttonBrandPrimary', 'buttonDangerPrimary'];
check(
  'all FOUR action-button component refs present under Actions',
  actionRefs.every((n) => partByName.get(n)?.component !== undefined),
);
const stubIds = new Set(stubs.map((s) => s.id));
check(
  'the four action buttons resolve to stub contracts (ds.button-neutral-tertiary / -brand-secondary / -brand-primary / -danger-primary)',
  ['ds.button-neutral-tertiary', 'ds.button-brand-secondary', 'ds.button-brand-primary', 'ds.button-danger-primary'].every(
    (id) => stubIds.has(id) && actionRefs.some((n) => partByName.get(n)?.component?.id === id),
  ),
);
check(
  'BOTH Icon instances (title icon + close icon) reference the ds.icon stub',
  partByName.get('Icon')?.component?.id === 'ds.icon' && partByName.get('frame2Icon')?.component?.id === 'ds.icon',
);
check('the scroll bar carries (hidden RECTANGLE → "scrollBar" part)', names.includes('scrollBar'));
check(`5 child stubs total (icon + 4 buttons; got ${stubs.length})`, stubs.length === 5);
// Every drawn node accounted for: dump tree leaves vs anatomy names.
const dumpNames: string[] = [];
const walkDump = (n: DumpNode & { name?: string }) => {
  dumpNames.push(String(n.name ?? ''));
  for (const c of n.children ?? []) walkDump(c);
};
const set = dump['Dialog'] as { variants: Array<DumpNode & { name: string }> };
for (const c of set.variants[0].children ?? []) walkDump(c);
check(
  `every drawn node maps to a part (${dumpNames.length} drawn nodes → ${names.length - 1} parts + root)`,
  dumpNames.length === names.length - 1,
);

// ---------------------------------------------------------------------------
// 3. ZERO referee violations (duplicate refusal RETIRED; names registered)
// ---------------------------------------------------------------------------

console.log('\n3. Referee: zero violations');
const repoInventory = tokenInventoryFromJson([
  read('tokens/primitives.tokens.json'),
  read('tokens/semantic.tokens.json'),
  read('tokens/modes/semantic.light.tokens.json'),
  read('tokens/modes/semantic.dark.tokens.json'),
]);
const minted = flattenTokens((proposal.mintedTokens?.tree ?? {}) as Record<string, unknown>);
// The dump's own bound-name channel, dot-form — the SAME names a v1.4 send
// registers as the captured layer (names only; no values invented here).
const boundNames = new Set<string>();
const collectBound = (n: DumpNode) => {
  for (const v of Object.values(n.bound ?? {})) boundNames.add(String(v).split('/').join('.'));
  if (n.fill?.var) boundNames.add(n.fill.var.split('/').join('.'));
  if (n.stroke?.var) boundNames.add(n.stroke.var.split('/').join('.'));
  if (n.text?.fillVar) boundNames.add(n.text.fillVar.split('/').join('.'));
  for (const c of n.children ?? []) collectBound(c);
};
for (const v of set.variants) collectBound(v);
const layeredInventory = new Set<string>([...repoInventory, ...boundNames, ...minted.keys()]);
const refusals: string[] = [];
generateCss(contract, layeredInventory, refusals);
check(`ZERO referee violations (got ${refusals.length})`, refusals.length === 0);
check(
  'in particular: zero \'duplicate anatomy part name\' refusals (the owner\'s Dialog refusal class)',
  !refusals.some((e) => e.includes('duplicate anatomy part name')),
);
// Control: withholding the registered names reproduces the NAME refusal
// class (his real refs refuse by name against the repo-only inventory) —
// the registration is doing work, and honestly.
const withoutNames: string[] = [];
generateCss(contract, new Set<string>([...repoInventory, ...minted.keys()]), withoutNames);
check(
  `control: WITHOUT the registered names the referee refuses his refs by name (got ${withoutNames.filter((e) => e.includes('does not exist in tokens/')).length} refusals)`,
  withoutNames.filter((e) => e.includes('does not exist in tokens/')).length >= 10,
);

// ---------------------------------------------------------------------------
// 4. Renders on the CSS surface; the canvas compiles
// ---------------------------------------------------------------------------

console.log('\n4. Surfaces: emitHtml renders, canvas compiles');
const contracts = new Map<string, Contract>([[contract.id, contract]]);
for (const s of stubs) contracts.set(s.id, s);
let html = '';
let css = '';
try {
  const emitted = emitHtml(contract, { tokens: layeredInventory, icons: new Map(), contracts });
  html = emitted.html;
  css = emitted.css;
} catch (e) {
  check(`emitHtml green — ${String(e).split('\n')[0]}`, false);
}
check('emitHtml renders (validateContract passed — the duplicate refusal is GONE)', html.length > 0);
check('the renamed Title text styles under its OWN class (__Title2, distinct from the __Title wrapper)', css.includes('__Title2'));

// Canvas: the SAME engine the canvas preview and sync script share, over the
// repo trees + the minted layer (canvas literal resolution — font sizes and
// line heights mint as imported.* px facts; bound color/padding names bind
// without literal resolution).
const mergeTrees = (a: Record<string, unknown>, b: Record<string, unknown>): Record<string, unknown> => {
  const out: Record<string, unknown> = { ...a };
  for (const [k, v] of Object.entries(b)) {
    const prev = out[k];
    out[k] =
      prev && v && typeof prev === 'object' && typeof v === 'object' && !Array.isArray(prev) && !Array.isArray(v)
        ? mergeTrees(prev as Record<string, unknown>, v as Record<string, unknown>)
        : v;
  }
  return out;
};
let canvasVariants: number | string = 0;
try {
  const engine = createFigmaEngine({
    tokens: {
      primitives: read('tokens/primitives.tokens.json'),
      semantic: mergeTrees(read('tokens/semantic.tokens.json'), (proposal.mintedTokens?.tree ?? {}) as Record<string, unknown>),
      light: read('tokens/modes/semantic.light.tokens.json'),
      dark: read('tokens/modes/semantic.dark.tokens.json'),
      brands: { default: read('tokens/modes/brand.default.tokens.json') },
    },
    icons: new Map(),
  });
  canvasVariants = engine.compileComponentData(contract, contracts).variants.length;
} catch (e) {
  canvasVariants = String(e).split('\n')[0];
}
check(`the canvas compiles — 4 variants (size axis; got ${canvasVariants})`, canvasVariants === 4);

// ---------------------------------------------------------------------------
// 5. The neighboring sanitize rules still behave (same live file)
// ---------------------------------------------------------------------------

console.log('\n5. Sanitize rules on the neighboring set names (all-sets dump)');
const allSets = read(path.join('extract', 'figma', 'fixtures', 'cbds-plugin-all-sets.dump.json'));
const modalOnly: Record<string, unknown> = {
  _provenance: allSets['_provenance'],
  'Modal / Confirmation Dialog': allSets['Modal / Confirmation Dialog'],
};
const modalBatch = proposeBatchFromDump(modalOnly, {
  corpus,
  contractIdByName: loaded.byName,
  contractsById: loaded.byId,
  fileKey: 'WofZT8xaxXuc2Q6Je9S4XE',
  mintUnbound: true,
});
check('"Modal / Confirmation Dialog" proposes (0 skips)', modalBatch.proposals.length === 1 && modalBatch.skipped.length === 0);
const modalId = (modalBatch.proposals[0]?.contract as { id?: string } | undefined)?.id;
check(`its id rides the sanitize rule — "ds.modal-confirmation-dialog" (got ${modalId})`, modalId === 'ds.modal-confirmation-dialog');
const modalContract = ContractSchema.parse(modalBatch.proposals[0].contract);
const modalNames = walkAnatomy(modalContract).map((w) => w.name);
check('its part names are unique contract-wide too (global registry holds everywhere)', new Set(modalNames).size === modalNames.length);

// ---------------------------------------------------------------------------

if (failures.length > 0) {
  console.error(`\n✖ ${failures.length} dialog-send invariant(s) failed`);
  process.exit(1);
}
console.log(
  '\n✔ the Dialog send holds: global part-name dedup (Title2 / frame2Icon, renames NAMED with node paths), full part inventory (both _Slot-Dialog slots, 4 action-button refs + stubs, both icons, scroll bar), ZERO referee violations, CSS surface renders, canvas compiles',
);
