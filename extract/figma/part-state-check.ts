/**
 * PART-LEVEL STATE OVERRIDES receipt (P18 second half, v13 — STYLE-FIDELITY
 * B7 retired) — `npm run extract:figma:partstate:check`.
 *
 * Fixture: extract/figma/fixtures/cbds-plugin-button-brand-primary.dump.json
 * — the owner's live CBDS Button send. The field failure, hit twice: his kit
 * draws the DISABLED button label at {text.disabled} #556275 on the
 * {bg.disabled} #dfe3eb fill; the part-level diff used to be a NAMED note
 * ('part-level state overrides are outside the contract vocabulary (root
 * states only, B7); NAMED, not proposed') so the preview rendered the label
 * at the default #fcfeff — near-invisible on the disabled background.
 *
 * THE VOCABULARY, as shipped (bounded):
 *   · Part.states — per-state token overrides on NON-ref parts (text/icon/
 *     box), COLOR-KIND channels only (color, background-color, border-color
 *     — emit-react PART_STATE_CHANNELS; extend only when fixtures demand).
 *   · Refusal-ruled in validateContract: unknown state names, undeclared
 *     states, ref/slot parts, non-color channels — all BY NAME.
 *   · Proposer: proposeStateDiffs PROPOSES depth-1 child color diffs on
 *     state-promoted axes (same occurrence machinery — per-variant refs
 *     unify, raw literals mint per `imported.<comp>.<part>-state-<state>.
 *     <channel>`); B7 receipts retire where the channel carries, stay
 *     NARROW elsewhere (ref/slot children).
 *   · Emitters: react css-modules + html render descendant rules under the
 *     root's state selector (.root:disabled .label { color: … } — the
 *     STATE_SELECTORS discipline); react-inline documents the declared
 *     limit; the canvas State-preview variants apply part overrides
 *     (the drawn State=Disabled cell shows the gray label).
 *
 * Node script over pure functions — the cbds-bridge-check pattern.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { ContractSchema, type Contract } from '../../scripts/contract-schema.js';
import { loadTokenCorpus } from './tokens.js';
import { loadContracts } from './propose.js';
import { proposeBatchFromDump } from '../../core/propose-figma.js';
import { capturedTokensFromDump } from '../../core/captured-tokens.js';
import { createFigmaEngine, type NodeSpec } from '../../core/emit-figma-script.js';
import { emitHtml } from '../../core/emit-html.js';
import { emitReactInline } from '../../core/emit-react-inline.js';
import { generateCss, validateContract } from '../../core/emit-react.js';
import { tokenInventoryFromJson } from '../../core/tokens.js';

const ROOT = process.cwd();
const read = (p: string) => JSON.parse(readFileSync(path.join(ROOT, p), 'utf8')) as Record<string, unknown>;

const failures: string[] = [];
const check = (label: string, cond: boolean) => {
  if (!cond) failures.push(label);
  console.log(`  ${cond ? '✔' : '✖'} ${label}`);
};

console.log('Part-level state overrides (P18 v13 — the B7 retirement), owner Button replay');

// ---------------------------------------------------------------------------
// 1. Proposal: the disabled label diff PROPOSES (no longer a B7 receipt)
// ---------------------------------------------------------------------------

console.log('\n1. The proposer carries the disabled label color as a part-level state override');
const corpus = loadTokenCorpus(ROOT);
const loaded = loadContracts(path.resolve(ROOT, 'contracts'));
const dump = read('extract/figma/fixtures/cbds-plugin-button-brand-primary.dump.json');
const batch = proposeBatchFromDump(dump, {
  corpus,
  contractIdByName: loaded.byName,
  contractsById: loaded.byId,
  fileKey: 'WofZT8xaxXuc2Q6Je9S4XE',
  mintUnbound: true,
});
const proposal = batch.proposals[0];
const contract: Contract = ContractSchema.parse(proposal.contract);
const stubs = (proposal.childStubs ?? []).map((s) => ContractSchema.parse(s));
const labelPart = contract.anatomy.root.parts?.['Button'];
check(
  'the label part carries states.disabled.color = {text.disabled} (his real bound variable)',
  labelPart?.states?.['disabled']?.['color'] === '{text.disabled}',
);
check(
  'the promotion is a NAMED note (part-level override proposed; formerly the B7 named gap)',
  proposal.notes.some(
    (n) =>
      n.startsWith('Button-Brand Primary:root/Button: state "disabled" part-level override proposed') &&
      n.includes('color: {text.disabled}') &&
      n.includes('formerly the STYLE-FIDELITY B7 named gap'),
  ),
);
check(
  'the blanket B7 receipt is GONE from the notes (retired where the channel carries)',
  !proposal.notes.some((n) => n.includes('part-level state overrides are outside the contract vocabulary')),
);
check(
  'hover/active/focus keep the label UNSTYLED at part level (no diff — nothing invented)',
  ['hover', 'active', 'focus-visible'].every((s) => labelPart?.states?.[s] === undefined),
);
check('root states still carry their own channels (disabled background {bg.disabled})',
  contract.anatomy.root.states?.['disabled']?.['background-color'] === '{bg.disabled}');
check('figmaStatePreviews stays on (the State axis still previews)', contract.figmaStatePreviews === true);

// ---------------------------------------------------------------------------
// 2. Referee: the vocabulary is refusal-ruled, BY NAME
// ---------------------------------------------------------------------------

console.log('\n2. Refusal rules (validateContract — never silent)');
const contracts = new Map<string, Contract>([[contract.id, contract]]);
for (const s of stubs) contracts.set(s.id, s);
const refuse = (mutate: (c: Contract) => void): string[] => {
  const clone = structuredClone(contract);
  mutate(clone);
  const errors: string[] = [];
  validateContract(clone, new Map([...contracts, [clone.id, clone]]), errors, new Map());
  return errors;
};
check(
  'the shipped proposal itself validates clean (zero violations)',
  refuse(() => {}).length === 0,
);
check(
  'unknown state name refuses BY NAME ("sparkle" is not a STATE_SELECTORS state)',
  refuse((c) => {
    c.anatomy.root.parts!['Button']!.states = { sparkle: { color: '{text.disabled}' } };
  }).some((e) => e.includes('unknown state "sparkle"')),
);
check(
  'an UNDECLARED state refuses (states.hover on the part with `states: ["disabled"]` on the contract)',
  refuse((c) => {
    c.states = ['disabled'];
    c.anatomy.root.parts!['Button']!.states = { hover: { color: '{text.disabled}' } };
  }).some((e) => e.includes('declares "hover" but the contract\'s `states` does not')),
);
check(
  'a non-color channel refuses BY NAME (font-size is not a part-state channel)',
  refuse((c) => {
    c.anatomy.root.parts!['Button']!.states = { disabled: { 'font-size': '{text.disabled}' } };
  }).some((e) => e.includes('"font-size" which is not a part-state channel')),
);
check(
  'a component-ref part refuses (the child contract owns its styling)',
  refuse((c) => {
    c.anatomy.root.parts!['Icon']!.states = { disabled: { color: '{text.disabled}' } };
  }).some((e) => e.includes('is a component instance — states cannot restyle it')),
);

// ---------------------------------------------------------------------------
// 3. Surfaces: css-modules rule, html rule, canvas State=Disabled cell
// ---------------------------------------------------------------------------

console.log('\n3. Every surface renders the disabled label override');
const captured = capturedTokensFromDump(dump)!;
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
const semantic = mergeTrees(
  mergeTrees(read('tokens/semantic.tokens.json'), captured.tree),
  (proposal.mintedTokens?.tree ?? {}) as Record<string, unknown>,
);
const inventory = tokenInventoryFromJson([
  read('tokens/primitives.tokens.json'),
  semantic,
  read('tokens/modes/semantic.light.tokens.json'),
  read('tokens/modes/semantic.dark.tokens.json'),
]);
const cssErrors: string[] = [];
const css = generateCss(contract, inventory, cssErrors);
check(`generateCss: zero violations over the layered inventory (got ${cssErrors.length})`, cssErrors.length === 0);
check(
  'css-modules: .root:disabled .Button { color: var(--text-disabled) } (descendant rule under the root state selector)',
  /\.root:disabled \.Button \{\n {2}color: var\(--text-disabled\);\n\}/.test(css),
);
const emitted = emitHtml(contract, { tokens: inventory, icons: new Map(), contracts });
check(
  'emit-html: .button-brand-primary:disabled .button-brand-primary__Button { color: var(--text-disabled) }',
  emitted.css.includes(
    '.button-brand-primary:disabled .button-brand-primary__Button {\n  color: var(--text-disabled);\n}',
  ),
);
const { tsx: inlineTsx } = emitReactInline(contract, {
  tokens: {
    primitives: read('tokens/primitives.tokens.json'),
    semantic,
    light: read('tokens/modes/semantic.light.tokens.json'),
    dark: read('tokens/modes/semantic.dark.tokens.json'),
    brands: { default: read('tokens/modes/brand.default.tokens.json') },
  },
  icons: new Map(),
  contracts,
});
check(
  'react-inline documents the declared limit (part-level state overrides omitted, like hover states)',
  inlineTsx.includes('PART-level state overrides (Part.states, v13) are omitted'),
);

// Canvas: the State=Disabled PREVIEW cell draws the gray label.
const engine = createFigmaEngine({
  tokens: {
    primitives: read('tokens/primitives.tokens.json'),
    semantic,
    light: read('tokens/modes/semantic.light.tokens.json'),
    dark: read('tokens/modes/semantic.dark.tokens.json'),
    brands: { default: read('tokens/modes/brand.default.tokens.json') },
  },
  icons: new Map(),
});
const data = engine.compileComponentData(contract, contracts);
const findText = (s: NodeSpec): NodeSpec | undefined =>
  s.type === 'text' ? s : (s.children ?? []).map(findText).find(Boolean);
const disabledCells = (data.stateVariants ?? []).filter((v) => v.name.includes('State=Disabled'));
check(`the State axis compiles Disabled preview cells (got ${disabledCells.length})`, disabledCells.length > 0);
check(
  'EVERY State=Disabled cell draws the label bound to text/disabled (the gray label) on the bg/disabled fill',
  disabledCells.length > 0 &&
    disabledCells.every((v) => findText(v.spec)?.textFill === 'text/disabled' && v.spec.fill === 'bg/disabled'),
);
const defaultLabel = findText(data.variants[0].spec);
check(
  'the base variants keep the default label fill (text/inverse-primary — overrides never leak out of the state cells)',
  defaultLabel?.textFill === 'text/inverse-primary' &&
    (data.stateVariants ?? [])
      .filter((v) => v.name.includes('State=Hover'))
      .every((v) => findText(v.spec)?.textFill === 'text/inverse-primary'),
);

// ---------------------------------------------------------------------------

if (failures.length > 0) {
  console.error(`\n✖ ${failures.length} part-state invariant(s) failed`);
  process.exit(1);
}
console.log(
  '\n✔ part-level state overrides hold: the disabled label PROPOSES ({text.disabled}), refusal rules refuse by name (unknown state / undeclared state / non-color channel / ref part), and every surface carries it — .root:disabled .Button on css-modules, the prefixed html rule, the canvas State=Disabled cells drawing text/disabled on bg/disabled; B7 retired where the channel carries',
);
