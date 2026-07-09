/**
 * Receipts for BASE-INSTANCE FLATTENING + the SELF-REFERENCE GUARD —
 * `npm run extract:figma:base:check`.
 *
 * Field case (Eventz DS Button, file E7oXr98i91HYQGZxA2USOQ, node 2313-42):
 * every variant of the set is a thin wrapper around an INSTANCE of a shared
 * base "Button" component carrying componentProperties (hasEndIcon /
 * hasStartIcon booleans + a "Label#1:0" TEXT property). proposeFromDump used
 * to name-match that nested instance to the set's OWN contract id and emit a
 * self-referencing component ref with mangled prop spellings — which the
 * generator refused ('part "Button" sets unknown ds.button prop
 * "hasendicon"'). The fixture (extract/figma/fixtures/base-instance-dump.json)
 * is hand-crafted on that exact shape; this receipt asserts:
 *
 *   1. NO SELF-REF   no component ref anywhere in the proposal resolves to
 *                    the set's own id — in fact none is emitted at all
 *   2. PROMOTION     the base instance's booleans become boolean props bound
 *                    to the exact Figma property spellings (hasEndIcon, not
 *                    hasendicon), the TEXT property becomes a text prop
 *   3. GENERATION    the proposal passes the generator — emitReact + emitHtml
 *                    run green with the minted layer covering the wrapper's
 *                    unbound literal
 *   4. NOTES         every promotion and the anatomy fidelity limit are named
 *   5. FALLBACKS     when the heuristic is NOT confidently met (dump v1
 *                    without componentProperties; instance not the sole
 *                    wrapped child) the skip is NAMED, still no component
 *                    ref, and the proposal still generates green
 *   6. CYCLE REFUSAL a hand-edited contract whose anatomy composes itself
 *                    (directly or transitively via the byId graph) is
 *                    refused BY NAME by validateContract on every emitter —
 *                    never a 'Maximum call stack size exceeded' crash
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

const fixture = read(path.join('extract', 'figma', 'fixtures', 'base-instance-dump.json'));
const set = fixture.Button as unknown as DumpSet;
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
function generates(label: string, proposal: FigmaProposalResult): string {
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
  let css = '';
  try {
    emitReact(contract, emitCtx);
    css = emitHtml(contract, emitCtx).css;
  } catch (e) {
    ok = false;
    console.error(String(e));
  }
  check(`${label}: emitReact + emitHtml run green (generator ACCEPTS)`, ok);
  return css;
}

// ---------------------------------------------------------------------------
// The field shape: flattening promotes the base instance's properties
// ---------------------------------------------------------------------------

console.log('\nBase-instance flattening (Eventz Button shape)');
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
    flat.notes.some((note) => note.includes(`prop \`${n}\`` ) && note.includes('promoted from the base instance "Button"')),
  ),
);
check(
  'anatomy fidelity limit named (dump v1 stops at instances; anatomy reflects the wrapper)',
  flat.notes.some((n) => n.includes('base component internals not captured — dump v1 stops at instances; anatomy reflects the wrapper')),
);

// 6. The wrapper's own observable structure survives: its unbound literal is
//    minted, bound at the root, and the generator accepts the proposal.
check(
  "wrapper cornerRadius minted and bound at the root ({imported.button.root.border-radius})",
  ((contract.anatomy as J).root.tokens ?? {})['border-radius'] === '{imported.button.root.border-radius}',
);
check('no unbound value survives (the single literal is fully minted)', flat.unbound.length === 0);
const css = generates('flattened proposal', flat);
check('emitted css references the minted custom property', css.includes('var(--imported-button-root-border-radius)'));

// Classic pass (no minting): the literal stays a NAMED report entry.
const classic = proposeFromDump(clone(set), opts);
check(
  'classic pass (mintUnbound off): cornerRadius stays a named UNBOUND entry',
  classic.unbound.length === 1 && classic.unbound[0].property === 'cornerRadius' && classic.unbound[0].value === 8,
);
generates('classic proposal', classic);

// ---------------------------------------------------------------------------
// Fallback A: dump v1 (no componentProperties) — heuristic NOT met
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
  'NAMED skip: nested instance of the set\'s own base component, props not extracted, reason given',
  fallbackA.notes.some(
    (n) =>
      n.includes("nested instance of the set's own base component") &&
      n.includes('not extracted') &&
      n.includes('componentProperties not captured — dump v1 stops at instances'),
  ),
);
generates('fallback A proposal', fallbackA);

// ---------------------------------------------------------------------------
// Fallback B: instance is not the sole wrapped child — heuristic NOT met
// ---------------------------------------------------------------------------

console.log('\nFallback: base instance has a sibling (not a thin wrapper)');
const siblings = clone(set);
for (const variant of siblings.variants) {
  (variant.children as DumpNode[]).push({
    name: 'caption',
    type: 'TEXT',
    text: { characters: 'Caption', fontSize: 12, fontStyle: 'Medium' },
  });
}
const fallbackB = proposeFromDump(siblings, { ...opts, mintUnbound: true });
const bContract = fallbackB.contract as J;
check('still no component ref (guard fires on the non-sole instance)', componentRefs(bContract.anatomy as J).length === 0);
check(
  'NAMED skip names the captured props and the unmet heuristic',
  fallbackB.notes.some(
    (n) =>
      n.includes("nested instance of the set's own base component") &&
      n.includes('hasEndIcon, hasStartIcon, Label') &&
      n.includes('flattening heuristic not met'),
  ),
);
check(
  'the wrapper structure survives (Button part kept, without a component ref)',
  (bContract.anatomy as J).root.parts?.Button !== undefined && (bContract.anatomy as J).root.parts.Button.component === undefined,
);
generates('fallback B proposal', fallbackB);

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

// ---------------------------------------------------------------------------

if (failures.length > 0) {
  console.error(`\n✖ ${failures.length} base-instance invariant(s) failed`);
  process.exit(1);
}
console.log('\n✔ all base-instance invariants hold (no self-ref, promotion, generation, named fallbacks, cycle refusal)');
