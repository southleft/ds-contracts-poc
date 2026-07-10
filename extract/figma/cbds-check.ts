/**
 * Receipts for the OWNER P0 field case — `npm run extract:figma:cbds:check`.
 *
 * Fixture: extract/figma/fixtures/cbds-button-brand-primary.rest-dump.json —
 * the LIVE REST dump of the owner's CBDS "Button-Brand Primary" set
 * (file WofZT8xaxXuc2Q6Je9S4XE, node 258-1838; axes size=large|medium|small ×
 * state=default|hover|focus|pressed|disabled). The original import produced:
 * a BUTTON rendering as an unfocusable div, a fake `state` enum prop shipped
 * to code, two "ds.icon has no contract in scope" refusals, and — worst —
 * WRONG padding/font-size (the first variant's values shipped as constants).
 * This receipt pins every fix:
 *
 *   1. SEMANTICS      element "button" inferred DETERMINISTICALLY (name/axis
 *                     table in core/propose-figma.ts inferSemantics — zero AI,
 *                     runs inside proposeFromDump) and NOTED; plus table
 *                     cases: link → a, tooltip → div+role, no-match → div
 *   2. STATE AXIS     `state` never becomes a prop; hover→hover,
 *                     pressed→active, focus→focus-visible land as root
 *                     `states` overrides; disabled → a `disabled` BOOLEAN
 *                     prop; figmaStatePreviews: true (canvas round-trip)
 *   3. EXACT VALUES   per SIZE variant, the emitted CSS's padding (all four
 *                     sides) and font-size RESOLVE to byte-equal values from
 *                     the dump — a wrong-but-plausible constant is the worst
 *                     outcome and is refused here by equality
 *   4. CHILD STUBS    ds.icon childStub parses; emitReact WITH the stub in
 *                     scope succeeds; WITHOUT it refuses BY NAME ("no
 *                     contract in scope") — the owner's refusal, pinned
 *   5. SURFACES       emitReact: <button, ButtonHTMLAttributes, native
 *                     disabled; emitHtml: <button + :hover/:focus-visible
 *                     rules (the preview is genuinely focusable); canvas
 *                     script constructs the State preview axis
 *
 * Node script over pure functions (core/propose-figma.ts) — the same
 * shell/core split as extract/figma/base-instance-check.ts.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { ContractSchema, type Contract } from '../../scripts/contract-schema.js';
import type { DumpNode, DumpSet } from './types.js';
import { loadTokenCorpus } from './tokens.js';
import { proposeFromDump } from './propose.js';
import { emitReact } from '../../core/emit-react.js';
import { emitHtml } from '../../core/emit-html.js';
import { emitFigmaScript } from '../../core/emit-figma-script.js';
import { flattenTokens, tokenInventoryFromJson, type TokenTreeInput } from '../../core/tokens.js';

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
const opts = { corpus, contractIdByName: new Map<string, string>(), fileKey: null };

// ===========================================================================
// 1. Semantics inference — deterministic name/axis table, INSIDE the proposer
// ===========================================================================

console.log('Semantics inference (deterministic table, zero AI)');

/** Minimal one-variant dump set with a given name. */
const miniSet = (setName: string): DumpSet => ({
  setName,
  type: 'COMPONENT',
  variants: [
    {
      name: setName,
      type: 'COMPONENT',
      layout: {
        mode: 'HORIZONTAL', primary: 'CENTER', counter: 'CENTER',
        spacing: 0, padding: [0, 0, 0, 0], primarySizing: 'AUTO', counterSizing: 'AUTO',
      },
      children: [],
    } as DumpNode,
  ],
});

const semanticsOf = (setName: string) => {
  const r = proposeFromDump(miniSet(setName), opts);
  return { semantics: (r.contract as J).semantics as J, notes: r.notes };
};

{
  const link = semanticsOf('Nav Link');
  check('name "Nav Link" → element "a", with a named inference note', link.semantics.element === 'a' && link.notes.some((n) => n.includes('inferred from the set name')));
  const tooltip = semanticsOf('Tooltip');
  check('name "Tooltip" → element "div" + role "tooltip"', tooltip.semantics.element === 'div' && tooltip.semantics.role === 'tooltip');
  const chip = semanticsOf('Chip');
  check(
    'no table match ("Chip") → element stays "div" with the existing hedge note',
    chip.semantics.element === 'div' && chip.semantics.role === undefined && chip.notes.some((n) => n.includes('semantics.element defaulted to "div"')),
  );
  const btn = semanticsOf('Primary Btn');
  check('name "Primary Btn" → element "button"', btn.semantics.element === 'button');
}

// ===========================================================================
// 2–5. The owner's exact component — fixture replay
// ===========================================================================

console.log('\nCBDS Button-Brand Primary (cbds-button-brand-primary.rest-dump.json)');
const dump = read(path.join('extract', 'figma', 'fixtures', 'cbds-button-brand-primary.rest-dump.json'));
const setRaw = dump['Button-Brand Primary'] as unknown as DumpSet;
const real = proposeFromDump(clone(setRaw), { ...opts, mintUnbound: true });
const c = real.contract as J;
const props = c.props as J[];
const byName = new Map(props.map((p) => [p.name as string, p]));
const rootTokens = (c.anatomy as J).root.tokens ?? {};
const rootStates = (c.anatomy as J).root.states ?? {};

// -- semantics ---------------------------------------------------------------
check(
  'element "button" inferred (deterministic, inside proposeFromDump) and NOTED',
  c.semantics.element === 'button' && real.notes.some((n) => n.includes('element "button"') && n.includes('inferred')),
);

// -- state axis promotion -----------------------------------------------------
check('NO `state` prop ships in the API', byName.get('state') === undefined);
check(
  'contract states [hover, active, focus-visible, disabled] declared',
  JSON.stringify(c.states) === JSON.stringify(['hover', 'active', 'focus-visible', 'disabled']),
);
check(
  'hover/active/disabled carry background overrides (hover #003e81, pressed→active #002854, disabled #dfe3eb through minted refs)',
  ['hover', 'active', 'disabled'].every((s) => typeof rootStates[s]?.['background-color'] === 'string'),
);
check(
  'the drawn Focus ring (stroke #0e61ba / 2px, focus variants only) inverted to focus-visible OUTLINE overrides',
  typeof rootStates['focus-visible']?.['outline-color'] === 'string' &&
    typeof rootStates['focus-visible']?.['outline-width'] === 'string',
);
const disabled = byName.get('disabled');
check(
  '`disabled` is a real BOOLEAN prop (default false) — never an enum value shipped to code',
  disabled !== undefined && disabled.type === 'boolean' && disabled.default === false,
);
check('figmaStatePreviews: true (the canvas round-trips the states as a State preview axis)', c.figmaStatePreviews === true);
check(
  'the State-axis rename consequence is DOCUMENTED (property "State", statePreviewLabel values)',
  real.notes.some((n) => n.includes('RENAME relative to the imported axis "state"')),
);

// -- exact per-size values (owner correction: "it needs to match exactly") ----
const minted = new Map<string, string>();
for (const [p, entry] of flattenTokens((real.mintedTokens?.tree ?? {}) as Record<string, unknown>)) {
  minted.set(p, String(entry.value));
}
/** Resolve a contract token ref for a concrete size value → literal. */
const resolve = (ref: string | undefined, size: string): string | undefined => {
  if (typeof ref !== 'string') return undefined;
  const p = ref.slice(1, -1).replaceAll('{size}', size);
  return minted.get(p);
};
const defaultVariantOf = (size: string): DumpNode =>
  setRaw.variants.find((v) => v.name === `size=${size}, state=default`)!;
for (const size of ['large', 'medium', 'small'] as const) {
  const v = defaultVariantOf(size);
  const [top, right, bottom, left] = v.layout!.padding;
  const inline = resolve(rootTokens['padding-inline'], size);
  const block = resolve(rootTokens['padding-block'], size);
  check(
    `size=${size}: padding EXACT — emitted padding-inline resolves to ${right}px/${left}px, padding-block to ${top}px/${bottom}px (dump values)`,
    right === left && top === bottom && inline === `${right}px` && block === `${top}px`,
  );
  const textNode = (v.children ?? []).find((ch) => ch.type === 'TEXT')!;
  const fontSize = resolve(((c.anatomy as J).root.parts?.Button?.tokens ?? {})['font-size'], size);
  check(
    `size=${size}: font-size EXACT — emitted value resolves to ${textNode.text!.fontSize}px (dump value)`,
    fontSize === `${textNode.text!.fontSize}px`,
  );
}
check(
  'per-size values genuinely DIFFER in the emitted output (small ≠ large padding and font-size — no first-variant constant)',
  resolve(rootTokens['padding-inline'], 'small') !== resolve(rootTokens['padding-inline'], 'large') &&
    resolve(((c.anatomy as J).root.parts?.Button?.tokens ?? {})['font-size'], 'small') !==
      resolve(((c.anatomy as J).root.parts?.Button?.tokens ?? {})['font-size'], 'large'),
);
check(
  'the typography variance is RECEIPTED (no silent single-style adoption)',
  real.notes.some((n) => n.includes('typography varies across variants')),
);

// -- child stubs ---------------------------------------------------------------
const stubs = (real.childStubs ?? []).map((s) => ContractSchema.parse(s));
check(
  'ds.icon child STUB auto-proposed alongside (parses against the contract schema)',
  stubs.length === 1 && stubs[0].id === 'ds.icon',
);

const contract: Contract = ContractSchema.parse(c);
const inventory = tokenInventoryFromJson([
  read('tokens/primitives.tokens.json'),
  read('tokens/semantic.tokens.json'),
  read('tokens/modes/semantic.light.tokens.json'),
  read('tokens/modes/semantic.dark.tokens.json'),
  real.mintedTokens?.tree ?? {},
]);
const icons = new Map<string, string>();

// WITHOUT the stub in scope: the owner's exact refusal, BY NAME.
let withoutStub = '';
try {
  emitReact(contract, { tokens: inventory, icons, contracts: new Map([[contract.id, contract]]) });
} catch (e) {
  withoutStub = String(e);
}
check(
  'WITHOUT the stub registered, emitReact refuses BY NAME ("ds.icon" … no contract in scope) — the owner\'s refusal, pinned',
  withoutStub.includes('ds.icon') && withoutStub.includes('no contract in scope'),
);

// WITH the stub in scope (what the playground + fidelity harness register).
const contracts = new Map<string, Contract>([[contract.id, contract]]);
for (const s of stubs) contracts.set(s.id, s);
let tsx = '';
let reactCss = '';
try {
  const emitted = emitReact(contract, { tokens: inventory, icons, contracts });
  tsx = emitted.tsx;
  reactCss = emitted.css;
} catch (e) {
  check(`emitReact green with the stub in scope — ${String(e).split('\n')[0]}`, false);
}
check('emitReact: root renders <button (not a div)', tsx.includes('<button'));
check('emitReact: props extend ButtonHTMLAttributes<HTMLButtonElement>', tsx.includes('ButtonHTMLAttributes<HTMLButtonElement>'));
check('emitReact: NATIVE disabled attribute (disabled={disabled})', tsx.includes('disabled={disabled}'));
check(
  'emitReact: no root type="button" — parity with the repo\'s own generated Button (root buttons carry no type attr; a golden-pinned generator shape, divergence NAMED here)',
  !tsx.includes('type="button"') === !readFileSync(path.join(ROOT, 'src/components/Button/Button.tsx'), 'utf8').includes('type="button"'),
);
check('emitReact CSS: real :hover rule', reactCss.includes(':hover:not(:disabled)'));
check('emitReact CSS: real :active rule (pressed promoted)', reactCss.includes(':active:not(:disabled)'));
check('emitReact CSS: real :focus-visible outline', reactCss.includes(':focus-visible'));

let html = '';
let htmlCss = '';
try {
  const emitted = emitHtml(contract, { tokens: inventory, icons, contracts });
  html = emitted.html;
  htmlCss = emitted.css;
} catch (e) {
  check(`emitHtml green with the stub in scope — ${String(e).split('\n')[0]}`, false);
}
check('emitHtml: renders <button — the preview is genuinely focusable', html.includes('<button'));
check(
  'emitHtml CSS: :hover and :focus-visible rules present (the preview hovers and shows a ring on Tab)',
  htmlCss.includes(':hover:not(:disabled)') && htmlCss.includes(':focus-visible'),
);

// -- canvas round trip -----------------------------------------------------------
let script = '';
try {
  const tokenTree: TokenTreeInput = {
    primitives: read('tokens/primitives.tokens.json'),
    // The minted layer joins the semantic slot — the same composition the
    // playground (token-source.ts) and the fidelity harness apply.
    semantic: { ...read('tokens/semantic.tokens.json'), ...((real.mintedTokens?.tree ?? {}) as Record<string, unknown>) },
    light: read('tokens/modes/semantic.light.tokens.json'),
    dark: read('tokens/modes/semantic.dark.tokens.json'),
    brands: {
      default: read('tokens/modes/brand.default.tokens.json'),
      aurora: read('tokens/modes/brand.aurora.tokens.json'),
    },
  };
  script = emitFigmaScript(contract, {
    tokens: tokenTree,
    icons,
    contracts,
    mintedTokens: real.mintedTokens?.tree,
  });
} catch (e) {
  check(`emitFigmaScript green — ${String(e).split('\n')[0]}`, false);
}
check(
  'canvas script constructs the State preview axis (State=Hover / State=Active / State=Focus Visible / State=Disabled)',
  ['State=Hover', 'State=Active', 'State=Focus Visible', 'State=Disabled'].every((s) => script.includes(s)),
);

// -- receipts, not silence ---------------------------------------------------------
check('zero UNBOUND leftovers (every raw literal minted or refused by name)', real.unbound.length === 0);

// ---------------------------------------------------------------------------

if (failures.length > 0) {
  console.error(`\n✖ ${failures.length} CBDS invariant(s) failed`);
  process.exit(1);
}
console.log('\n✔ all CBDS owner-case invariants hold (semantics, state promotion, exact per-size values, stubs, surfaces, canvas)');
