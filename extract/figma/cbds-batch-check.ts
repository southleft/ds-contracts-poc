/**
 * Receipts for the OWNER FIELD FAILURE (first live Send-to-Playground) —
 * `npm run extract:figma:cbds:batch:check`.
 *
 * Fixtures: the LIVE plugin-transport dumps of the owner's CBDS UI Kit Demo
 * (file WofZT8xaxXuc2Q6Je9S4XE, captured 2026-07-10 through the repo's
 * VERBATIM dump.plugin.js):
 *
 *   cbds-plugin-button-brand-primary.dump.json   TARGET_SETS=["Button-Brand Primary"]
 *   cbds-plugin-all-sets.dump.json               TARGET_SETS=[] — exactly what the
 *                                                plugin's empty names box sent
 *
 * The failure: the all-sets dump carries 59 sets whose derived contract ids
 * violated the id pattern — 30 underscore-led private helpers
 * ("_variable-list-item" → "ds.-variable-list-item"), 13 template/slash
 * names ("Button / Primary / Medium", "Type=Text, Variant=Error",
 * "Badge (ds.badge) — token-bound"), and 16 clean-named sets whose CHILD
 * STUB ids derived from those helpers ("Avatar" → stub "ds.-avatar-
 * indicator"). ContractSchema.parse threw on the FIRST one, the whole
 * receive died, and the raw zod issue array rendered verbatim in the rail.
 *
 * This receipt pins both fixes on the real dumps:
 *
 *   1. ID SANITIZE at proposal (componentIdSlug): every previously-failing
 *      name proposes; sanitized ids carry a NAMED note with the original
 *      spelling; component refs and their child-stub ids stay consistent
 *      (one shared function).
 *   2. BATCH ISOLATION (proposeBatchFromDump — the function the playground
 *      receive paths run): the ALL-SETS replay completes, N proposed +
 *      M named skips, ZERO raw errors; a deliberately poisoned set becomes a
 *      plain-words skip (never a thrown zod array) while the rest import.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { ContractSchema } from '../../scripts/contract-schema.js';
import type { DumpSet } from './types.js';
import { loadTokenCorpus } from './tokens.js';
import { loadContracts } from './propose.js';
import {
  componentIdSlug,
  plainWordsProposalError,
  proposeBatchFromDump,
  proposeFromDump,
} from '../../core/propose-figma.js';

const ROOT = process.cwd();
const failures: string[] = [];
const check = (label: string, cond: boolean) => {
  if (!cond) failures.push(label);
  console.log(`  ${cond ? '✔' : '✖'} ${label}`);
};

const corpus = loadTokenCorpus(ROOT);
const loaded = loadContracts(path.resolve(ROOT, 'contracts'));
const readDump = (name: string) =>
  JSON.parse(readFileSync(path.join(ROOT, 'extract', 'figma', 'fixtures', name), 'utf8')) as Record<string, unknown>;

const allDump = readDump('cbds-plugin-all-sets.dump.json');
const scopedDump = readDump('cbds-plugin-button-brand-primary.dump.json');
const opts = {
  corpus,
  contractIdByName: loaded.byName,
  contractsById: loaded.byId,
  fileKey: 'WofZT8xaxXuc2Q6Je9S4XE',
  mintUnbound: true,
};

// ---------------------------------------------------------------------------
console.log('\n1. componentIdSlug — the sanitize rule, pinned on the failing spellings');
const SLUG_CASES: Array<[string, string]> = [
  ['_variable-list-item', 'variable-list-item'], // the FIRST set the live batch died on
  ['_Avatar Indicator', 'avatar-indicator'],
  ['Button / Primary / Medium', 'button-primary-medium'],
  ['Type=Text, Variant=Error', 'type-text-variant-error'],
  ['Badge (ds.badge) — token-bound', 'badge-ds-badge-token-bound'],
  ['Button-Brand Primary', 'button-brand-primary'], // kebab-clean names pass through unchanged
  ['01 Icons', 'c-01-icons'], // digit-led → deterministic "c-" prefix
  ['✏️', 'c'], // all-illegal → deterministic "c"
];
for (const [name, slug] of SLUG_CASES) {
  check(`componentIdSlug(${JSON.stringify(name)}) = "${slug}"`, componentIdSlug(name) === slug);
}

// ---------------------------------------------------------------------------
console.log('\n2. Previously-failing sets propose, ids sanitized + noted (original spelling carried)');
const underscore = proposeFromDump(allDump['_variable-list-item'] as DumpSet, opts);
check(
  '"_variable-list-item" proposes with id "ds.variable-list-item"',
  (underscore.contract as { id?: string }).id === 'ds.variable-list-item',
);
check(
  'its sanitize note NAMES the original spelling and the rule',
  underscore.notes.some(
    (n) => n.includes('drawn set name "_variable-list-item"') && n.includes('"ds.variable-list-item"') && n.includes('illegal characters → hyphens'),
  ),
);
const template = proposeFromDump(allDump['Button / Primary / Medium'] as DumpSet, opts);
check(
  '"Button / Primary / Medium" proposes with id "ds.button-primary-medium"',
  (template.contract as { id?: string }).id === 'ds.button-primary-medium',
);
check(
  'its sanitize note carries the original spelling',
  template.notes.some((n) => n.includes('"Button / Primary / Medium"') && n.includes('"ds.button-primary-medium"')),
);

// ---------------------------------------------------------------------------
console.log('\n3. Child-stub ids and component refs stay consistent (one shared function)');
const avatar = proposeFromDump(allDump['Avatar'] as DumpSet, opts);
const avatarStubIds = (avatar.childStubs ?? []).map((s) => (s as { id?: string }).id);
check('"Avatar" proposes (its "_Avatar Indicator" child no longer kills it)', avatarStubIds.length > 0);
check('"Avatar" child stub id is "ds.avatar-indicator"', avatarStubIds.includes('ds.avatar-indicator'));
const avatarJson = JSON.stringify(avatar.contract);
check(
  'the anatomy component ref uses the SAME sanitized id as the stub',
  avatarJson.includes('"ds.avatar-indicator"'),
);
check(
  'no "ds.-" id survives anywhere in the Avatar proposal or its stubs',
  !avatarJson.includes('"ds.-') && !JSON.stringify(avatar.childStubs ?? []).includes('"ds.-'),
);
check(
  'the stub-id sanitize note NAMES "_Avatar Indicator" → "ds.avatar-indicator"',
  avatar.notes.some((n) => n.includes('"_Avatar Indicator"') && n.includes('"ds.avatar-indicator"')),
);

// ---------------------------------------------------------------------------
console.log('\n4. Scoped dump (the set he meant to send) — proposes, element "button", states promoted');
const scopedBatch = proposeBatchFromDump(scopedDump, opts);
check('scoped dump: 1 proposed, 0 skipped', scopedBatch.proposals.length === 1 && scopedBatch.skipped.length === 0);
const scoped = scopedBatch.proposals[0];
const scopedContract = scoped.contract as { id?: string; semantics?: { element?: string }; states?: string[] };
check('id "ds.button-brand-primary"', scopedContract.id === 'ds.button-brand-primary');
check('semantics.element "button"', scopedContract.semantics?.element === 'button');
check(
  'states promoted (hover/active/focus-visible present)',
  ['hover', 'active', 'focus-visible'].every((s) => scopedContract.states?.includes(s)),
);
check('ds.icon child stub proposed alongside', (scoped.childStubs ?? []).some((s) => (s as { id?: string }).id === 'ds.icon'));

// ---------------------------------------------------------------------------
console.log('\n5. BATCH ISOLATION — the full ALL-SETS replay (the empty-names-box send)');
const batch = proposeBatchFromDump(allDump, opts);
const total = Object.entries(allDump).filter(([k, v]) => k !== '_provenance' && !!v && typeof v === 'object' && 'variants' in (v as object)).length;
console.log(`  (replayed ${total} sets: ${batch.proposals.length} proposed, ${batch.skipped.length} skipped)`);
check('every set accounted for: proposed + skipped = total', batch.proposals.length + batch.skipped.length === total);
check(`ALL ${total} sets propose (zero skips on the live dump after sanitize)`, batch.skipped.length === 0);
check(
  'every proposed id satisfies the schema pattern',
  batch.proposals.every((p) => /^[a-z][a-z0-9-]*\.[a-z][a-z0-9-]*$/.test((p.contract as { id?: string }).id ?? '')),
);
// The live kit REALLY collides: the Phosphor icon "RadioButton" and the kit's
// "Radio button" set both sanitize to ds.radio-button — the note must name both.
check(
  'the real id collision ("RadioButton" vs "Radio button" → ds.radio-button) is NAMED, never silent',
  batch.notes.length === 1 &&
    batch.notes[0].includes('"ds.radio-button"') &&
    batch.notes[0].includes('"RadioButton"') &&
    batch.notes[0].includes('"Radio button"'),
);

// ---------------------------------------------------------------------------
console.log('\n6. One poisoned set becomes a plain-words skip — the batch survives, no raw error as headline');
const poisoned = JSON.parse(JSON.stringify(scopedDump)) as Record<string, unknown>;
// A malformed set (no variants at all) — the engine throws, the batch must not die.
poisoned['Poisoned'] = { setName: 'Poisoned', type: 'COMPONENT_SET', nodeId: '0:0', key: 'poisoned', variants: [] };
const poisonedBatch = proposeBatchFromDump(poisoned, opts);
check('the healthy set still proposes', poisonedBatch.proposals.some((p) => p.setName === 'Button-Brand Primary'));
check('the poisoned set is a NAMED skip', poisonedBatch.skipped.length === 1 && poisonedBatch.skipped[0].setName === 'Poisoned');
const skip = poisonedBatch.skipped[0];
check(
  'the skip reason is plain words ("Set "Poisoned" could not be proposed: …"), not machine output',
  skip !== undefined && skip.reason.startsWith('Set "Poisoned" could not be proposed:') && !/[[{]/.test(skip.reason.charAt(0)),
);

// The EXACT failure class he saw: a thrown ContractSchema (zod) error whose
// .message IS the raw issue-array JSON. It must never headline again.
let zodThrow: unknown = null;
try {
  ContractSchema.parse({ id: 'ds.-illegal' });
} catch (e) {
  zodThrow = e;
}
const rendered = plainWordsProposalError(zodThrow);
check(
  'a thrown zod error formats as words ("the proposed contract did not fit the contract schema — …")',
  rendered.headline.startsWith('the proposed contract did not fit the contract schema'),
);
check('the raw zod text survives as expandable detail, not the headline', typeof rendered.detail === 'string' && /"code"/.test(rendered.detail));
check('the headline itself is never machine-looking', !/^\s*[[{]/.test(rendered.headline));

// ---------------------------------------------------------------------------
if (failures.length > 0) {
  console.error(`\n✖ ${failures.length} check(s) failed`);
  process.exit(1);
}
console.log('\n✔ all CBDS batch invariants hold (sanitized ids + named notes, ref/stub consistency, full-batch replay with zero raw errors, poisoned-set isolation)');
