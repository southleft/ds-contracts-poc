/**
 * Walkthrough receipt — `npx tsx playground/scripts/flow-check.ts`.
 *
 * The Playground's two guided tours (playground/src/engine/tours.ts, driven
 * by pages/Playground.tsx) print numbers: Badge 11/4/0, ToggleSwitch 14
 * code-only facts, Button 0, top-nav-item's unbound TEXT property, a dump
 * grammar, fixture labels, refusal sentences quoted from source. Every one
 * of those is produced by an engine call over a committed input; this
 * script re-runs the SAME calls headless (playground/src/engine/flow-engine.ts
 * is node-importable by design) and refuses when the tour's inputs, the
 * engine and the committed receipts disagree. Without it the walkthrough
 * would be self-attested, which the repo's truth rule forbids.
 *
 *   1. Badge (extract/figma/fixtures/main-file-dumps.json) proposes in
 *      reviewable-inversion, exact refuses it EXACT_DEFINITIONS_MISSING, and
 *      ROUNDTRIP.md's Badge rows parse to 11 / 4 / 0 with the table and the
 *      section agreeing.
 *   2. The Badge proposal's root background-color ref equals the shipping
 *      contract's ({color.feedback.{variant}.background}) — the ENUM SUBST
 *      rule the tour quotes.
 *   3. contracts/button.contract.json compiles to 12 variants, first
 *      `Variant=Primary, Size=Medium`, root fill
 *      `color/action/primary/background`, 0 code-only facts; the emitted
 *      figma-script carries the `"fill": "color/action/primary/background"`
 *      line the Script step excerpts.
 *   4. contracts/top-nav-item.contract.json compiles to textProps
 *      [{ property: "Href", default: "#" }] — the value-only carriage the
 *      worked example E3 describes.
 *   5. The Flowbite ToggleSwitch (from examples/tailwind/figma/
 *      tailwind.bundle.json) compiles to 14 code-only facts that agree
 *      key-for-key with the bundle's committed row; the figma-script carries
 *      the MIN/left and MAX/right thumb placements.
 *   6. flowbite-eight.dump.json's ToggleSwitch proposes in exact mode with
 *      provenance tool-generated; with propertyDefinitions removed in memory
 *      exact refuses by an EXACT_* code from accuracy/grammar.json.
 *   7. The printed producer grammar is REST_DUMP_VERSION (never a literal in
 *      the tour modules), and each fixture's label is its own
 *      _provenance.dumpVersion (main-file-dumps: absent; flowbite-eight: 1.32
 *      as committed — read from the file, not asserted here).
 *   8. Every QUOTED_REFUSALS fragment exists verbatim in its source file.
 *   9. The Badge proposal emits React whose CSS carries
 *      var(--color-feedback-info-background) — the Generate step's excerpt.
 */
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { ContractSchema, emitters, generateCss, tokenCorpusFromJson, tokenInventoryFromJson, validateContract, type Contract } from '../../core/index.js';
import { REST_DUMP_VERSION } from '../../extract/figma/rest/map.js';
import type { DumpSet } from '../../extract/figma/types.js';
import {
  canvasProvenanceOf,
  compileReceipt,
  CONTRACT_ID_STAMP_SINCE,
  corpusFromTokenSet,
  exactRefusalOf,
  excerptOf,
  factsAgreeWithBundle,
  fixtureLabel,
  parseRoundtripReceipt,
  PRODUCER_DUMP_GRAMMAR,
  proposeFixtureSet,
  rootTokenAgreement,
  summarizeDump,
  withoutPropertyDefinitions,
  type BundleFactRow,
} from '../src/engine/flow-engine.js';
import { QUOTED_REFUSALS } from '../src/engine/tours.js';

const ROOT = process.cwd();
const read = (p: string) => readFileSync(path.join(ROOT, p), 'utf8');
const readJson = <T = unknown>(p: string): T => JSON.parse(read(p)) as T;

const failures: string[] = [];
let checks = 0;
const check = (label: string, condition: boolean, detail?: string): void => {
  checks += 1;
  if (!condition) failures.push(`${label}${detail ? ` — ${detail}` : ''}`);
  console.log(`  ${condition ? '✔' : '✖'} ${label}${!condition && detail ? ` — ${detail}` : ''}`);
};

// ---------------------------------------------------------------- inputs
const tokens = {
  primitives: readJson<Record<string, unknown>>('tokens/primitives.tokens.json'),
  semantic: readJson<Record<string, unknown>>('tokens/semantic.tokens.json'),
  light: readJson<Record<string, unknown>>('tokens/modes/semantic.light.tokens.json'),
  dark: readJson<Record<string, unknown>>('tokens/modes/semantic.dark.tokens.json'),
  brands: { default: readJson<Record<string, unknown>>('tokens/modes/brand.default.tokens.json') },
};
const repoCorpus = tokenCorpusFromJson({
  primitives: tokens.primitives,
  semantic: tokens.semantic,
  light: tokens.light,
  brandDefault: tokens.brands.default,
});
const icons = new Map(
  readdirSync(path.join(ROOT, 'assets', 'icons'))
    .filter((f) => f.endsWith('.svg'))
    .map((f) => [f.replace(/\.svg$/, ''), read(`assets/icons/${f}`).trim()]),
);
const contractsById = new Map<string, Contract>();
for (const f of readdirSync(path.join(ROOT, 'contracts'))) {
  if (!f.endsWith('.contract.json')) continue;
  const c = ContractSchema.parse(readJson(`contracts/${f}`));
  contractsById.set(c.id, c);
}
const badge = contractsById.get('ds.badge')!;
const button = contractsById.get('ds.button')!;
const topNav = contractsById.get('ds.top-nav-item')!;
const emitCtx = (contracts: Map<string, Contract>, tree: typeof tokens, extraIcons = icons) => ({
  tokens: tree,
  icons: extraIcons,
  contracts,
});

// ------------------------------------------------------ 1. Badge, hop 4
console.log('Figma → code — Badge (main-file-dumps.json)');
const badgeDump = readJson<Record<string, unknown>>('extract/figma/fixtures/main-file-dumps.json');
const badgeSummary = summarizeDump(badgeDump);
check('main-file-dumps.json has no _provenance.dumpVersion (label says so)', badgeSummary.dumpVersion === null && fixtureLabel(badgeSummary).startsWith('dumpVersion absent'));
const badgeResult = proposeFixtureSet({
  dump: badgeDump,
  setName: 'Badge',
  corpus: repoCorpus,
  contractsById,
  projectionMode: 'reviewable-inversion',
  mintUnbound: true,
});
check('Badge proposes in reviewable-inversion', badgeResult.proposal !== null, badgeResult.skipped.map((s) => s.reason).join('; '));
check(
  'exact refuses Badge EXACT_DEFINITIONS_MISSING (no propertyDefinitions)',
  badgeResult.exactRefusal?.code === 'EXACT_DEFINITIONS_MISSING',
  badgeResult.exactRefusal?.code,
);
check('Badge projection status is legacy-unverified', badgeResult.proposal?.projection.status === 'legacy-unverified', badgeResult.proposal?.projection.status);
check('Badge canvas provenance is unrecorded (capture predates the contractId stamp)', badgeResult.provenance === 'unrecorded', badgeResult.provenance);
check('Badge proposal id is ds.badge', badgeResult.proposal?.contract.id === 'ds.badge', String(badgeResult.proposal?.contract.id));

const rt = parseRoundtripReceipt(read('extract/figma/ROUNDTRIP.md'), 'Badge');
check('ROUNDTRIP.md Badge = 11 / 4 / 0', rt.counts.matched === 11 && rt.counts.canvasAbsent === 4 && rt.counts.mismatch === 0, `${rt.counts.matched}/${rt.counts.canvasAbsent}/${rt.counts.mismatch}`);
check(
  'ROUNDTRIP.md Badge CANVAS-ABSENT names semantics, a11y, font-weight, font-family',
  ['semantics', 'a11y', 'text root font-weight (effective)', 'text root font-family (effective)'].every((s) => rt.canvasAbsent.some((r) => r.subject === s)),
);
if (badgeResult.proposal) {
  const live = rootTokenAgreement(badgeResult.proposal.contract, badge);
  const bg = live.find((r) => r.channel === 'background-color');
  check(
    'Badge proposal root background-color = {color.feedback.{variant}.background} (ENUM SUBST)',
    bg?.same === true && bg.proposed === '{color.feedback.{variant}.background}',
    JSON.stringify(bg),
  );
  const proposed = ContractSchema.parse(badgeResult.proposal.contract);
  const react = emitters.find((e) => e.name === 'react')!;
  const files = react.emit(proposed, emitCtx(new Map([[proposed.id, proposed]]), tokens));
  check('Badge proposal → React CSS carries var(--color-feedback-info-background)', excerptOf(files, 'var(--color-feedback-info-background)') !== null);
}

// ---------------------------------------------- 3/4. Button + TopNav, hop 2
console.log('Code → Figma — Button, TopNavItem (contracts/)');
const buttonReceipt = compileReceipt(button, contractsById, tokens, icons);
check('Button compiles to 12 variants', buttonReceipt.variantCount === 12, String(buttonReceipt.variantCount));
check('Button first variant is Variant=Primary, Size=Medium', buttonReceipt.firstVariantName === 'Variant=Primary, Size=Medium', buttonReceipt.firstVariantName ?? 'null');
check('Button root fill binds color/action/primary/background', buttonReceipt.rootFill === 'color/action/primary/background', buttonReceipt.rootFill ?? 'null');
check('Button code-only facts = 0', buttonReceipt.codeOnlyFacts.length === 0, String(buttonReceipt.codeOnlyFacts.length));
check('Button statePreviews on → State previews compiled', buttonReceipt.statePreviews && buttonReceipt.stateVariantCount > 0, String(buttonReceipt.stateVariantCount));
{
  const fs = emitters.find((e) => e.name === 'figma-script')!;
  const files = fs.emit(button, emitCtx(contractsById, tokens));
  check('Button figma-script carries "fill": "color/action/primary/background"', excerptOf(files, '"fill": "color/action/primary/background"') !== null);
}
const topNavReceipt = compileReceipt(topNav, contractsById, tokens, icons);
check(
  'TopNavItem textProps = [{ Href, "#" }] (href VALUE rides as an unbound TEXT property)',
  JSON.stringify(topNavReceipt.textProps) === JSON.stringify([{ property: 'Href', default: '#' }]),
  JSON.stringify(topNavReceipt.textProps),
);
const topNavFactsByChannel = new Map(topNavReceipt.codeOnlyFacts.map((f) => [f.channel, f]));
check(
  'TopNavItem code-only facts = 2, both NAMED by channel (the undrawn hover plane — FC-STATE-PLANE-UNDRAWN; the empty `icon` slot\'s design-time content — RC5; the attrs binding is not a canvas fact — docs/29 E3)',
  topNavReceipt.codeOnlyFacts.length === 2 &&
    /FC-STATE-PLANE-UNDRAWN/.test(topNavFactsByChannel.get('background-color [hover]')?.reason ?? '') &&
    /no defaultContent and not the default `children` slot/.test(
      topNavFactsByChannel.get('slot "icon" design-time content')?.reason ?? '',
    ),
  JSON.stringify(topNavReceipt.codeOnlyFacts),
);

// ---------------------------------------------- 5. ToggleSwitch, hop 2
console.log('Code → Figma — ToggleSwitch (tailwind.bundle.json)');
const bundle = readJson<{
  type: string;
  tokenSet: { base: Record<string, unknown>; minted: Record<string, unknown> | null };
  icons?: Record<string, string>;
  contracts: unknown[];
  codeOnlyFacts: BundleFactRow[];
}>('examples/tailwind/figma/tailwind.bundle.json');
check('bundle.type is CONTRACTS-BUNDLE', bundle.type === 'CONTRACTS-BUNDLE', bundle.type);
const bundleContracts = new Map<string, Contract>();
for (const doc of bundle.contracts) {
  const c = ContractSchema.parse(doc);
  bundleContracts.set(c.id, c);
}
const toggle = bundleContracts.get('flowbite.toggleswitch')!;
const bundleTree = {
  primitives: {},
  semantic: (() => {
    // Same composition the playground's user-token source builds: base +
    // minted merged into one modeless tree in the semantic slot.
    const merge = (a: Record<string, unknown>, b: Record<string, unknown>): Record<string, unknown> => {
      const out: Record<string, unknown> = { ...a };
      for (const [k, v] of Object.entries(b)) {
        const prev = out[k];
        out[k] =
          prev && v && typeof prev === 'object' && typeof v === 'object' && !Array.isArray(prev) && !Array.isArray(v)
            ? merge(prev as Record<string, unknown>, v as Record<string, unknown>)
            : v;
      }
      return out;
    };
    return merge(bundle.tokenSet.base, bundle.tokenSet.minted ?? {});
  })(),
  light: {},
  dark: {},
  brands: { default: {} },
};
const bundleIcons = new Map([...icons, ...Object.entries(bundle.icons ?? {})]);
const toggleReceipt = compileReceipt(toggle, bundleContracts, bundleTree, bundleIcons);
check('ToggleSwitch code-only facts = 14', toggleReceipt.codeOnlyFacts.length === 14, String(toggleReceipt.codeOnlyFacts.length));
const toggleRow = bundle.codeOnlyFacts.find((r) => r.contractId === 'flowbite.toggleswitch');
const agreement = factsAgreeWithBundle(toggleReceipt.codeOnlyFacts, toggleRow);
check('ToggleSwitch live facts agree with the committed bundle row', agreement.agree, agreement.detail);
check(
  'ToggleSwitch facts: 4 channel on part-0 + 2 [focus-visible] outline on root, 7 declared, 1 event toggle/onToggle',
  toggleReceipt.codeOnlyFacts.filter((f) => f.kind === 'channel' && f.part === 'part-0').length === 4 &&
    toggleReceipt.codeOnlyFacts.filter((f) => f.kind === 'channel' && f.part === 'root' && /\[focus-visible\]/.test(f.channel)).length === 2 &&
    toggleReceipt.codeOnlyFacts.filter((f) => f.kind === 'declared').length === 7 &&
    toggleReceipt.codeOnlyFacts.some((f) => f.kind === 'event' && f.channel === 'toggle' && f.value === 'onToggle'),
);
{
  const fs = emitters.find((e) => e.name === 'figma-script')!;
  const files = fs.emit(toggle, emitCtx(bundleContracts, bundleTree, bundleIcons));
  check('ToggleSwitch figma-script carries the MIN/left thumb placement', excerptOf(files, '"h": "MIN"') !== null);
  check('ToggleSwitch figma-script carries the MAX/right thumb placement', excerptOf(files, '"h": "MAX"') !== null);
}
const bundleTotal = bundle.codeOnlyFacts.reduce((n, r) => n + r.facts.length, 0);
check('bundle codeOnlyFacts total = 56 (docs/BETA.md, README)', bundleTotal === 56, String(bundleTotal));

// ------------------------------------------ 6. ToggleSwitch, hop 4 (stamped)
console.log('Figma → code — ToggleSwitch (flowbite-eight.dump.json)');
const fe = readJson<Record<string, unknown>>('extract/figma/fixtures/flowbite-eight.dump.json');
const feSummary = summarizeDump(fe);
const feProv = (fe as { _provenance?: { dumpVersion?: string } })._provenance?.dumpVersion ?? null;
check('flowbite-eight label is its own _provenance.dumpVersion', feSummary.dumpVersion === feProv && feProv !== null && fixtureLabel(feSummary).includes(`dump v${feProv}`), fixtureLabel(feSummary));
const feCorpus = corpusFromTokenSet(bundle.tokenSet.base, bundle.tokenSet.minted);
const toggleResult = proposeFixtureSet({
  dump: fe,
  setName: 'ToggleSwitch',
  corpus: feCorpus,
  contractsById: bundleContracts,
  projectionMode: 'exact',
  mintUnbound: true,
});
check('ToggleSwitch proposes in exact mode', toggleResult.proposal !== null && toggleResult.exactRefusal === null, toggleResult.skipped.map((s) => s.reason).join('; '));
check('ToggleSwitch projection status verified-exact', toggleResult.proposal?.projection.status === 'verified-exact', toggleResult.proposal?.projection.status);
check('ToggleSwitch provenance tool-generated (contractId stamp)', toggleResult.provenance === 'tool-generated', toggleResult.provenance);
check('ToggleSwitch proposal id is the stamped flowbite.toggleswitch', toggleResult.proposal?.contract.id === 'flowbite.toggleswitch', String(toggleResult.proposal?.contract.id));
check(
  'ToggleSwitch proposal declares no events (canvas cannot run behaviour); the bundle row names the event',
  ((toggleResult.proposal?.contract as { events?: unknown[] }).events?.length ?? 0) === 0 && toggleRow?.facts.some((f) => f.kind === 'event') === true,
);
{
  // The tour's "Stamped set" step shows the editor referee ACCEPTING the
  // ToggleSwitch proposal: since dump v1.32 the ds_contracts/semantics stamp
  // carries element/role/roleException, so the role="switch"-on-<button>
  // exception is re-proposed with a review note (the authored exception
  // sentence itself is not canvas-recoverable). Pinned so the tour copy and
  // the engine move together — if propose ever stops carrying roleException,
  // these checks fail and the copy gets rewritten.
  const proposed = ContractSchema.safeParse(toggleResult.proposal?.contract);
  check('ToggleSwitch proposal parses against the schema', proposed.success, proposed.success ? '' : proposed.error.message.slice(0, 200));
  if (proposed.success) {
    const errors: string[] = [];
    const scope = new Map(bundleContracts);
    scope.set(proposed.data.id, proposed.data);
    validateContract(proposed.data, scope, errors, bundleIcons);
    generateCss(proposed.data, tokenInventoryFromJson([bundle.tokenSet.base, bundle.tokenSet.minted ?? {}]), errors);
    check(
      'ToggleSwitch proposal is accepted by the referee (roleException rides the v1.32 semantics stamp — the tour names it)',
      errors.length === 0,
      errors.join(' | ').slice(0, 300),
    );
    check('shipping toggleswitch.contract.json declares semantics.roleException', typeof (toggle.semantics as { roleException?: unknown }).roleException === 'string');
    check(
      'proposed ToggleSwitch carries a stamped semantics.roleException naming the review obligation',
      typeof (proposed.data.semantics as { roleException?: unknown }).roleException === 'string' &&
        /re-declare it in review/.test(String((proposed.data.semantics as { roleException?: unknown }).roleException)),
      String((proposed.data.semantics as { roleException?: unknown }).roleException),
    );
  }
}
const brokenFe = withoutPropertyDefinitions(fe, 'ToggleSwitch');
const exactCodes = new Set((read('accuracy/grammar.json').match(/"EXACT_[A-Z_]+"/g) ?? []).map((s) => s.slice(1, -1)));
const brokenRefusal = exactRefusalOf(brokenFe.ToggleSwitch as DumpSet, {
  corpus: feCorpus,
  contractIdByName: new Map([...bundleContracts.values()].map((c) => [c.name, c.id])),
  fileKey: feSummary.fileKey,
});
check(
  'ToggleSwitch without propertyDefinitions: exact refuses by an EXACT_* code from accuracy/grammar.json',
  brokenRefusal !== null && exactCodes.has(brokenRefusal.code),
  brokenRefusal ? brokenRefusal.code : 'no refusal',
);
check('that refusal is EXACT_DEFINITIONS_MISSING', brokenRefusal?.code === 'EXACT_DEFINITIONS_MISSING', brokenRefusal?.code);
// docs/29 §3 and the break-step tour copy name ONE exact-refusal code outside
// the grammar receipt: EXACT_SEMANTIC_PROJECTION_AMBIGUOUS, thrown only by
// core/propose-figma.ts. Pin both directions so the sentence goes stale
// loudly if the code is ever receipted, renamed, or removed.
check(
  'core/propose-figma.ts throws EXACT_SEMANTIC_PROJECTION_AMBIGUOUS and accuracy/grammar.json does not receipt it',
  /EXACT_SEMANTIC_PROJECTION_AMBIGUOUS/.test(read('core/propose-figma.ts')) && !exactCodes.has('EXACT_SEMANTIC_PROJECTION_AMBIGUOUS'),
);
check(
  'docs/29 and the tour copy name the unreceipted 14th code beside the receipted 13',
  read('docs/29-how-it-flows.md').includes('EXACT_SEMANTIC_PROJECTION_AMBIGUOUS') &&
    read('playground/src/engine/tours.ts').includes('EXACT_SEMANTIC_PROJECTION_AMBIGUOUS'),
);
check(
  'canvasProvenanceOf: unstamped set on a stamp-reading producer reads hand-built',
  canvasProvenanceOf(brokenFe.ToggleSwitch as DumpSet, feSummary) === 'tool-generated' &&
    canvasProvenanceOf({ ...(brokenFe.ToggleSwitch as DumpSet), contractId: undefined }, feSummary) === 'hand-built',
);

// ------------------------------------------------- 7. grammar + literals
console.log('Dump grammar');
check('PRODUCER_DUMP_GRAMMAR === REST_DUMP_VERSION', PRODUCER_DUMP_GRAMMAR === REST_DUMP_VERSION, `${PRODUCER_DUMP_GRAMMAR} vs ${REST_DUMP_VERSION}`);
const pluginGrammar = read('extract/figma/dump.plugin.js').match(/dumpVersion:\s*'([\d.]+)'/)?.[1] ?? null;
check('dump.plugin.js writes the same grammar as the REST mapper', pluginGrammar === REST_DUMP_VERSION, `${pluginGrammar} vs ${REST_DUMP_VERSION}`);
// The tour COPY may never state a grammar version as a literal — it reads
// PRODUCER_DUMP_GRAMMAR. (Playground.tsx's older "dump v1.4" notes name the
// producer version a CHANNEL appeared in, which is a different claim.)
for (const file of ['playground/src/engine/tours.ts', 'playground/src/components/FlowPanel.tsx', 'playground/src/pages/Flow.tsx']) {
  const src = read(file);
  const literals = [...src.matchAll(/dump v(\d+\.\d+)/g)].map((m) => m[1]);
  check(`${file} carries no "dump vN.N" literal (grammar is read from REST_DUMP_VERSION)`, literals.length === 0, literals.join(', '));
}
{
  // The one producer-version constant the engine module keeps (the
  // contractId stamp's first reader) is pinned to the dump grammar's own
  // documentation of that field.
  const types = read('extract/figma/types.ts');
  const i = types.indexOf('contractId?: string;');
  const doc = i === -1 ? '' : types.slice(Math.max(0, i - 400), i);
  const documented = doc.match(/dump v(\d+\.\d+)/)?.[1] ?? null;
  check(
    `CONTRACT_ID_STAMP_SINCE (${CONTRACT_ID_STAMP_SINCE}) matches extract/figma/types.ts on DumpSet.contractId`,
    documented !== null && Number(documented) === CONTRACT_ID_STAMP_SINCE,
    documented ?? 'no "dump vN.N" in the field doc',
  );
}
{
  const src = read('playground/src/pages/Playground.tsx');
  check('Playground.tsx no longer mentions the dead run-send relay', !src.includes('run-send'));
  check('Playground.tsx no longer quotes v1.5 / v1.13 dump versions', !/v1\.5\b|v1\.13\b/.test(src));
  // The production bundle drops core/emitter.ts (root package.json
  // sideEffects) unless a value export is referenced; engine/emitters.ts is
  // that reference and refuses at load when the registry is empty. A direct
  // `emitters` import from core here would reopen the hole silently.
  check(
    'Playground.tsx reads the emitter registry through engine/emitters.ts (the value-import that keeps core/emitter.ts in the production bundle)',
    src.includes("import { emitters } from '../engine/emitters'") && !/import \{[^}]*\bemitters\b[^}]*\} from '\.\.\/\.\.\/\.\.\/core\/index\.js'/.test(src),
  );
  const guard = read('playground/src/engine/emitters.ts');
  check(
    'engine/emitters.ts references the four built-in emitters by value and guards the registry',
    ['reactEmitter', 'htmlEmitter', 'reactInlineEmitter', 'figmaScriptEmitter'].every((n) => guard.includes(n)) && guard.includes('withBuiltins(registry)'),
  );
}

// ------------------------------------------------- 8. quoted refusals
console.log('Quoted refusal sentences');
for (const [key, q] of Object.entries(QUOTED_REFUSALS)) {
  check(`QUOTED_REFUSALS.${key} fragment exists verbatim in ${q.file}`, read(q.file).includes(q.fragment));
}

// ---------------------------------------------------------------- verdict
console.log('');
if (failures.length > 0) {
  console.error(`✖ playground flow-check: ${failures.length} of ${checks} checks failed`);
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log(`✔ playground flow-check: ${checks} checks passed — the walkthrough's numbers come from the engine and the committed receipts`);
