/**
 * Receipts for BASE-INSTANCE FLATTENING + the SELF-REFERENCE GUARD —
 * `npm run extract:figma:base:check`.
 *
 * Field case (Eventz DS Button, file E7oXr98i91HYQGZxA2USOQ, node 2313-42).
 * TWO fixtures referee it:
 *
 *   · extract/figma/fixtures/eventz-button.rest-dump.json — the REAL REST
 *     dump of the live set. Ground truth: 20/24 variants are the styled
 *     COMPONENT itself (swap-bound "Icon" instances whose visibility rides
 *     hasStartIcon/hasEndIcon, a text-bound "Label", a "Focus ring" on the
 *     focus variants); only the 4 state=focus, isDisabled=true variants wrap
 *     an INSTANCE of the set's own "Button" (componentProperties captured)
 *     beside the ring. The variables endpoint was unavailable, so every
 *     bound fact arrives as a resolved literal — the minting path.
 *   · extract/figma/fixtures/base-instance-dump.json — the HAND-CRAFTED
 *     wrapper-set shape (every variant a thin wrapper solely around the base
 *     instance), kept for the promotion + fallback paths.
 *
 * proposeFromDump used to (a) name-match the nested instance to the set's
 * OWN contract id and emit a self-referencing component ref (refused by the
 * generator), and (b) merge same-named siblings into one — the real set's
 * startIcon/endIcon "Icon" instances collapsed to a single slot. This
 * receipt asserts, per fixture:
 *
 *   1. NO SELF-REF   no component ref anywhere resolves to the set's own id
 *                    — in fact none is emitted at all (no cycle possible)
 *   2. FLATTENING    variants wrapping a base instance dissolve it in place:
 *                    the INSTANCE's styling speaks for the variant, captured
 *                    componentProperties promote (exact Figma spellings) or
 *                    hand observed defaults to props the drawn structure
 *                    already discovered
 *   3. STRUCTURE     duplicate sibling names survive as SEPARATE parts named
 *                    by their INSTANCE_SWAP properties (startIcon/endIcon),
 *                    visibility bindings become boolean props + visibleWhen,
 *                    part keys are identifier-safe ("Focus ring" → focusRing)
 *   4. STYLES        the minted layer lands and binds — including the root
 *                    background, a function of BOTH the variant and state
 *                    axes ({imported.button.root.background-color.{variant}.{state}})
 *   5. GENERATION    emitReact + emitHtml run green with the minted layer
 *   6. NOTES         every promotion, flatten, and fidelity limit is named
 *   7. FALLBACK      without componentProperties (dump v1) the skip is
 *                    NAMED, still no component ref, and generation stays green
 *
 * Node script over pure functions (core/propose-figma.ts) — the same
 * shell/core split as core/mint-check.ts.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { ContractSchema, type Contract } from '../../scripts/contract-schema.js';
import type { DumpNode, DumpSet } from './types.js';
import { loadTokenCorpus } from './tokens.js';
import { proposeFromDump, type FigmaProposalResult } from './propose.js';
import { emitReact } from '../../core/emit-react.js';
import { emitHtml } from '../../core/emit-html.js';
import { tokenInventoryFromJson } from '../../core/tokens.js';

const ROOT = process.cwd();
const read = (p: string) => JSON.parse(readFileSync(path.join(ROOT, p), 'utf8')) as Record<string, unknown>;

const failures: string[] = [];
const check = (label: string, cond: boolean) => {
  if (!cond) failures.push(label);
  console.log(`  ${cond ? '✔' : '✖'} ${label}`);
};

type J = Record<string, any>;

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
const corpus = loadTokenCorpus(ROOT);
// Simulate the field: a shipping ds.button contract is in scope, so the
// name-match "Button" resolves to the very id the proposal claims.
const opts = { corpus, contractIdByName: new Map([['Button', 'ds.button']]), fileKey: null };

/** Walk every part of an anatomy and collect its component refs. */
function componentRefs(anatomy: J): string[] {
  const out: string[] = [];
  const visit = (part: J) => {
    if (part.component?.id) out.push(String(part.component.id));
    for (const child of Object.values((part.parts as J) ?? {})) visit(child as J);
  };
  for (const part of Object.values(anatomy)) visit(part as J);
  return out;
}

/** The proposal must pass the generator: emitReact + emitHtml green with an
 *  inventory of the repo trees + whatever the proposal minted. */
function generates(label: string, proposal: FigmaProposalResult): { tsxCss: string; htmlCss: string } {
  const contract: Contract = ContractSchema.parse(proposal.contract);
  const inventory = tokenInventoryFromJson([
    read('tokens/primitives.tokens.json'),
    read('tokens/semantic.tokens.json'),
    read('tokens/modes/semantic.light.tokens.json'),
    read('tokens/modes/semantic.dark.tokens.json'),
    proposal.mintedTokens?.tree ?? {},
  ]);
  const emitCtx = { tokens: inventory, icons: new Map<string, string>(), contracts: new Map([[contract.id, contract]]) };
  let ok = true;
  let tsxCss = '';
  let htmlCss = '';
  try {
    tsxCss = emitReact(contract, emitCtx).css;
    htmlCss = emitHtml(contract, emitCtx).css;
  } catch (e) {
    ok = false;
    console.error(String(e));
  }
  check(`${label}: emitReact + emitHtml run green (generator ACCEPTS)`, ok);
  return { tsxCss, htmlCss };
}

// ===========================================================================
// REAL fixture: the live Eventz Button REST dump
// ===========================================================================

console.log('\nReal Eventz Button dump (eventz-button.rest-dump.json)');
const realSet = read(path.join('extract', 'figma', 'fixtures', 'eventz-button.rest-dump.json'))
  .Button as unknown as DumpSet;
const real = proposeFromDump(clone(realSet), { ...opts, mintUnbound: true });
const rc = real.contract as J;
const rProps = rc.props as J[];
const rByName = new Map(rProps.map((p) => [p.name as string, p]));
const rParts = (rc.anatomy as J).root.parts as J;

// 1. Self-reference guard — no component ref, no cycle possible.
check('no component ref anywhere in the anatomy (no ds.button self-reference, no cycle)', componentRefs(rc.anatomy as J).length === 0);
check('no "Button" wrapper part survives (the 4 focus+disabled base instances flattened)', rParts.Button === undefined);

// 2. Axes intact — variant × state × isDisabled.
check(
  'axis `variant` proposed as an enum [primary, knockout, secondary, bare]',
  JSON.stringify(rByName.get('variant')?.type) === JSON.stringify({ enum: ['primary', 'knockout', 'secondary', 'bare'] }),
);
check(
  'axis `state` proposed as an enum [default, hover, active, focus]',
  JSON.stringify(rByName.get('state')?.type) === JSON.stringify({ enum: ['default', 'hover', 'active', 'focus'] }),
);
const rDisabled = rByName.get('isDisabled');
check(
  'axis `isDisabled` INTACT: camelCase boolean bound to VARIANT property "isDisabled", default false',
  rDisabled !== undefined &&
    rDisabled.type === 'boolean' &&
    rDisabled.default === false &&
    rDisabled.bindings.figma.kind === 'VARIANT' &&
    rDisabled.bindings.figma.property === 'isDisabled',
);

// 3. BOTH icon booleans — discovered from the drawn visibility bindings,
//    defaults adopted from the flattened base instance's captured values.
for (const name of ['hasStartIcon', 'hasEndIcon'] as const) {
  const p = rByName.get(name);
  check(
    `boolean "${name}" proposed: type boolean, default true, figma BOOLEAN property "${name}"`,
    p !== undefined &&
      p.type === 'boolean' &&
      p.default === true &&
      p.bindings.figma.kind === 'BOOLEAN' &&
      p.bindings.figma.property === name &&
      p.bindings.code.prop === name,
  );
}
check('no mangled spelling ("hasendicon"/"starticon") anywhere in the proposal', !JSON.stringify(rc).includes('hasendicon') && !JSON.stringify(rc).includes('"starticon"'));

// 4. The text prop from the bound Label.
const rText = rByName.get('text');
check(
  'text prop `text` proposed: default "Label", figma TEXT property "text"',
  rText !== undefined && rText.type === 'text' && rText.default === 'Label' && rText.bindings.figma.kind === 'TEXT',
);
check('no extra props invented (3 axes + text + 2 icon booleans)', rProps.length === 6);

// 5. Anatomy: the same-named "Icon" siblings survive as SEPARATE slot parts
//    named by their swap properties, each visible when its boolean is set;
//    the "Focus ring" rides an identifier-safe key and the state axis.
check(
  'startIcon slot part: slot name "startIcon" (NOT judged the default slot), visibleWhen hasStartIcon',
  rParts.startIcon?.slot?.name === 'startIcon' && rParts.startIcon?.visibleWhen?.prop === 'hasStartIcon',
);
check(
  'endIcon slot part: slot name "endIcon", visibleWhen hasEndIcon',
  rParts.endIcon?.slot?.name === 'endIcon' && rParts.endIcon?.visibleWhen?.prop === 'hasEndIcon',
);
check('Label part binds content to the `text` prop', rParts.Label?.content?.prop === 'text');
check(
  'Focus ring → part key "focusRing" (identifier-safe), visible when state=focus',
  rParts.focusRing !== undefined &&
    rParts.focusRing.visibleWhen?.prop === 'state' &&
    rParts.focusRing.visibleWhen?.equals === 'focus',
);

// 6. Styles LAND: the minted layer binds the wrapper's resolved literals —
//    including the root background, a function of BOTH variant and state.
const rRootTokens = (rc.anatomy as J).root.tokens ?? {};
check(
  'root background bound to the two-axis minted ref {imported.button.root.background-color.{variant}.{state}}',
  rRootTokens['background-color'] === '{imported.button.root.background-color.{variant}.{state}}',
);
for (const [prop, ref] of [
  ['padding-inline', '{imported.button.root.padding-inline}'],
  ['padding-block', '{imported.button.root.padding-block}'],
  ['gap', '{imported.button.root.gap}'],
  ['border-radius', '{imported.button.root.border-radius}'],
  ['border-width', '{imported.button.root.border-width.{variant}}'],
] as const) {
  check(`root ${prop} bound to ${ref}`, rRootTokens[prop] === ref);
}
check(
  'label color bound per variant, focus ring styled',
  rParts.Label?.tokens?.color === '{imported.button.label.color.{variant}}' &&
    rParts.focusRing?.tokens?.['border-color'] === '{imported.button.focus-ring.border-color}',
);
check(`minted layer is not empty (${real.mintedTokens?.count ?? 0} leaves ≥ 30)`, (real.mintedTokens?.count ?? 0) >= 30);
check(
  'the ONE honest refusal survives: root stroke (absent on knockout/bare) stays a NAMED unbound entry',
  real.unbound.length === 1 && real.unbound[0].property === 'stroke',
);

// 7. Flatten + promotion notes are NAMED.
check(
  'flatten note names the 4/24 wrapped variants and the fidelity limit',
  real.notes.some((n) => n.includes("4/24 variant(s) wrap an instance of the set's own base component") && n.includes('dump v1 stops at instances')),
);
check(
  'boolean defaults adopted from the base instance are named',
  ['hasStartIcon', 'hasEndIcon'].every((n) =>
    real.notes.some((note) => note.includes(`prop \`${n}\`: default true adopted from the base instance "Button"`)),
  ),
);

// 8. Generation: both emitters green; the two-axis binding renders as
//    compound enum classes referencing the minted custom properties.
const rCss = generates('real Eventz proposal', real);
check(
  'React CSS renders the compound two-axis rule (.variant-primary.state-hover)',
  rCss.tsxCss.includes('.variant-primary.state-hover') &&
    rCss.tsxCss.includes('var(--imported-button-root-background-color-primary-hover)'),
);
check(
  'HTML CSS renders the compound two-axis rule (.button--variant-primary.button--state-hover)',
  rCss.htmlCss.includes('.button--variant-primary.button--state-hover'),
);

// Classic pass (no minting): the proposal still parses and generates; the
// resolved literals stay NAMED report entries instead of bindings.
const realClassic = proposeFromDump(clone(realSet), opts);
check(
  'classic pass (mintUnbound off): resolved literals stay NAMED unbound entries',
  realClassic.unbound.length > 0 && realClassic.unbound.some((u) => u.property === 'padding'),
);
generates('real classic proposal', realClassic);

// ===========================================================================
// Synthetic wrapper-set fixture (every variant a thin wrapper)
// ===========================================================================

console.log('\nSynthetic wrapper-set fixture (base-instance-dump.json)');
const set = read(path.join('extract', 'figma', 'fixtures', 'base-instance-dump.json')).Button as unknown as DumpSet;
const flat = proposeFromDump(clone(set), { ...opts, mintUnbound: true });
const contract = flat.contract as J;
const props = contract.props as J[];
const byName = new Map(props.map((p) => [p.name as string, p]));

// 1. Self-reference guard: no component ref anywhere — least of all ds.button.
const refs = componentRefs(contract.anatomy as J);
check('no component ref anywhere in the anatomy (no ds.button self-reference)', refs.length === 0);

// 2. Booleans promoted with the EXACT Figma property spellings.
for (const name of ['hasEndIcon', 'hasStartIcon'] as const) {
  const p = byName.get(name);
  check(
    `boolean "${name}" promoted: type boolean, default false, figma BOOLEAN property "${name}"`,
    p !== undefined &&
      p.type === 'boolean' &&
      p.default === false &&
      p.bindings.figma.kind === 'BOOLEAN' &&
      p.bindings.figma.property === name &&
      p.bindings.code.prop === name,
  );
}
check('no mangled spelling ("hasendicon") anywhere in the proposal', !JSON.stringify(contract).includes('hasendicon'));

// 3. The TEXT property promoted (suffix stripped, canonical camelCase name).
const label = byName.get('label');
check(
  'text "Label#1:0" promoted: prop `label`, type text, default "Label", figma TEXT property "Label"',
  label !== undefined &&
    label.type === 'text' &&
    label.default === 'Label' &&
    label.bindings.figma.kind === 'TEXT' &&
    label.bindings.figma.property === 'Label',
);

// 4. The three axes survive as the set's own API — including the camelCase
//    axis spelling ("isDisabled", never "isdisabled").
check(
  'axis `variant` proposed as an enum [primary, secondary]',
  JSON.stringify(byName.get('variant')?.type) === JSON.stringify({ enum: ['primary', 'secondary'] }),
);
check(
  'axis `state` proposed as an enum [default, hover]',
  JSON.stringify(byName.get('state')?.type) === JSON.stringify({ enum: ['default', 'hover'] }),
);
const isDisabled = byName.get('isDisabled');
check(
  'axis `isDisabled` keeps its camelCase spelling and is a boolean (true/false axis)',
  isDisabled !== undefined && isDisabled.type === 'boolean' && isDisabled.bindings.figma.property === 'isDisabled',
);
check('no extra props invented', props.length === 6);

// 5. Promotion + fidelity notes are NAMED.
check(
  'each promotion carries a note (promoted from the base instance "Button")',
  ['hasEndIcon', 'hasStartIcon', 'label'].every((n) =>
    flat.notes.some((note) => note.includes(`prop \`${n}\``) && note.includes('promoted from the base instance "Button"')),
  ),
);
check(
  'flatten + anatomy fidelity limit named (dump v1 stops at instances)',
  flat.notes.some((n) => n.includes("wrap an instance of the set's own base component") && n.includes('dump v1 stops at instances')),
);

// 6. The wrapper's own observable structure survives: its unbound literal is
//    minted, bound at the root, and the generator accepts the proposal.
check(
  'wrapper cornerRadius minted and bound at the root ({imported.button.root.border-radius})',
  ((contract.anatomy as J).root.tokens ?? {})['border-radius'] === '{imported.button.root.border-radius}',
);
check('no unbound value survives (the single literal is fully minted)', flat.unbound.length === 0);
const css = generates('flattened proposal', flat);
check('emitted css references the minted custom property', css.tsxCss.includes('var(--imported-button-root-border-radius)'));

// Classic pass (no minting): the literal stays a NAMED report entry.
const classic = proposeFromDump(clone(set), opts);
check(
  'classic pass (mintUnbound off): cornerRadius stays a named UNBOUND entry',
  classic.unbound.length === 1 && classic.unbound[0].property === 'cornerRadius' && classic.unbound[0].value === 8,
);
generates('classic proposal', classic);

// ---------------------------------------------------------------------------
// Fallback: dump v1 (no componentProperties) — flattening confidence NOT met
// ---------------------------------------------------------------------------

console.log('\nFallback: componentProperties not captured (dump v1)');
const v1 = clone(set);
for (const variant of v1.variants) for (const child of variant.children ?? []) delete (child as DumpNode).componentProperties;
const fallbackA = proposeFromDump(v1, { ...opts, mintUnbound: true });
const aContract = fallbackA.contract as J;
check('still no component ref (self-reference guard holds without flattening)', componentRefs(aContract.anatomy as J).length === 0);
check(
  'nothing promoted — props are the axes alone',
  (aContract.props as J[]).length === 3 && !(aContract.props as J[]).some((p) => ['hasEndIcon', 'hasStartIcon', 'label'].includes(p.name)),
);
check(
  "NAMED skip: nested instance of the set's own base component, props not extracted, reason given",
  fallbackA.notes.some(
    (n) =>
      n.includes("nested instance of the set's own base component") &&
      n.includes('not extracted') &&
      n.includes('componentProperties not captured — dump v1 stops at instances'),
  ),
);
generates('fallback A proposal', fallbackA);

// ---------------------------------------------------------------------------
// Sibling shape: the base instance flattens IN PLACE, siblings survive
// (this is exactly the real set's focus+disabled variants — a Focus ring
// beside the instance; the old sole-child heuristic wrongly skipped it)
// ---------------------------------------------------------------------------

console.log('\nSibling shape: base instance + caption sibling');
const siblings = clone(set);
for (const variant of siblings.variants) {
  (variant.children as DumpNode[]).push({
    name: 'caption',
    type: 'TEXT',
    text: { characters: 'Caption', fontSize: 12, fontStyle: 'Medium' },
  });
}
const withSibling = proposeFromDump(siblings, { ...opts, mintUnbound: true });
const bContract = withSibling.contract as J;
check('still no component ref (the instance dissolved, never referenced)', componentRefs(bContract.anatomy as J).length === 0);
check(
  'flattening fires with siblings present — booleans + text still promoted',
  ['hasEndIcon', 'hasStartIcon', 'label'].every((n) => (bContract.props as J[]).some((p) => p.name === n)),
);
check(
  'the sibling survives as its own part (caption), the instance leaves no part behind',
  (bContract.anatomy as J).root.parts?.caption !== undefined && (bContract.anatomy as J).root.parts?.Button === undefined,
);
generates('sibling-shape proposal', withSibling);

// ---------------------------------------------------------------------------

if (failures.length > 0) {
  console.error(`\n✖ ${failures.length} base-instance invariant(s) failed`);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Generator-level cycle refusal (hand-edited contracts)
// ---------------------------------------------------------------------------
// The proposer never emits a self-reference, but hand-authored/edited
// contracts can still contain one. Live owner repro: after hand-deleting the
// two icon props, the surviving {"component":{"id":"ds.button"}} inside
// ds.button's own anatomy crashed the emitters with 'Maximum call stack size
// exceeded'. validateContract must refuse the cycle BY NAME instead —
// directly and transitively — on every emitter that routes through it.

console.log('\nGenerator-level cycle refusal (hand-edited contracts)');

const inventory = tokenInventoryFromJson([
  read('tokens/primitives.tokens.json'),
  read('tokens/semantic.tokens.json'),
  read('tokens/modes/semantic.light.tokens.json'),
  read('tokens/modes/semantic.dark.tokens.json'),
  flat.mintedTokens?.tree ?? {},
]);
const refusal = (fn: () => void): string => {
  try {
    fn();
    return '';
  } catch (e) {
    return String(e);
  }
};

// Direct self-reference: the owner's hand-edit, verbatim shape.
const selfRef = clone(flat.contract) as J;
(selfRef.anatomy as J).root.parts = {
  Button: { component: { id: 'ds.button', props: { label: 'Label' } } },
};
const selfRefContract: Contract = ContractSchema.parse(selfRef);
const selfCtx = {
  tokens: inventory,
  icons: new Map<string, string>(),
  contracts: new Map([[selfRefContract.id, selfRefContract]]),
};
const wanted = 'component ref creates a cycle (ds.button → ds.button) — a contract cannot compose itself';
const reactMsg = refusal(() => emitReact(selfRefContract, selfCtx));
check('emitReact REFUSES the direct self-ref by name (no stack overflow)', reactMsg.includes(wanted));
const htmlMsg = refusal(() => emitHtml(selfRefContract, selfCtx));
check('emitHtml REFUSES the direct self-ref by name (routes through validateContract)', htmlMsg.includes(wanted));

// Transitive cycle: ds.alpha → ds.beta → ds.alpha, refused at the entry part
// with the whole chain spelled out.
const mkContract = (id: string, name: string, depId: string): Contract => {
  const c = clone(flat.contract) as J;
  c.id = id;
  c.name = name;
  (c.anatomy as J).root.parts = { dep: { component: { id: depId } } };
  return ContractSchema.parse(c);
};
const alpha = mkContract('ds.alpha', 'Alpha', 'ds.beta');
const beta = mkContract('ds.beta', 'Beta', 'ds.alpha');
const cycleCtx = {
  tokens: inventory,
  icons: new Map<string, string>(),
  contracts: new Map([
    [alpha.id, alpha],
    [beta.id, beta],
  ]),
};
const transMsg = refusal(() => emitReact(alpha, cycleCtx));
check(
  'transitive cycle refused with the chain spelled out (ds.alpha → ds.beta → ds.alpha)',
  transMsg.includes('creates a cycle (ds.alpha → ds.beta → ds.alpha) — a contract cannot compose itself'),
);

console.log('\n✔ all base-instance invariants hold (no self-ref, flattening, promotion, styles, generation, named fallbacks)');
