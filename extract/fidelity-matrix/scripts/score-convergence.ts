/**
 * Step 4 — D-CONVERGENCE: the thesis measurement.
 *
 * The SAME component (CBDS Button) proposed from its Figma design
 * (out/cbds-button-design/contract.json) and from its shipping TSX+CSS
 * (out/cbds-button-code/contract.json). This script diffs the two proposals:
 * prop axes, enum values, defaults, anatomy correspondence, and — the core —
 * resolved style facts on the shared surface (the design set is only the
 * Brand Primary variant, i.e. code's variant=primary).
 *
 * Verdicts: AGREE (same fact, same resolved value), DIVERGE (both sides
 * speak, values differ), DESIGN-ONLY / CODE-ONLY (one side silent).
 *
 *   npx tsx extract/fidelity-matrix/scripts/score-convergence.ts
 *
 * Writes out/d-convergence.json.
 */
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { loadRepoData, MATRIX, readJson } from './lib.js';

const data = loadRepoData();

const minted = (id: string): Map<string, string> => {
  const p = readJson(path.join(MATRIX, 'out', id, 'proposal.json')) as {
    minted: { entries: { ref: string; value: string }[] } | null;
  };
  return new Map((p.minted?.entries ?? []).map((e) => [e.ref, e.value]));
};

const design = minted('cbds-button-design');
const code = minted('cbds-button-code');

function resolveRepo(ref: string, seen = new Set<string>()): string | undefined {
  if (seen.has(ref)) return undefined;
  seen.add(ref);
  const segs = ref.replace(/^\{|\}$/g, '').split('.');
  for (const tree of [data.tokens.semantic, data.tokens.light, data.tokens.primitives, data.tokens.dark]) {
    let cur: unknown = tree;
    for (const s of segs) {
      cur = cur !== null && typeof cur === 'object' ? (cur as Record<string, unknown>)[s] : undefined;
      if (cur === undefined) break;
    }
    const v = (cur as { $value?: unknown } | undefined)?.$value;
    if (typeof v === 'string') return v.startsWith('{') ? resolveRepo(v, seen) : v;
    if (typeof v === 'number') return String(v);
  }
  return undefined;
}

const resolve = (side: Map<string, string>, ref: string | null): string | null =>
  ref === null ? null : (side.get(ref) ?? resolveRepo(ref) ?? `UNRESOLVED ${ref}`);

const px = (v: string | null): string | null => {
  if (v === null) return null;
  const m = v.match(/^(-?[\d.]+)rem$/);
  return m ? `${parseFloat(m[1]) * 16}px` : v.toLowerCase();
};

// ---------------------------------------------------------------------------
// style facts on the shared surface (design's whole set ≡ code's primary)

interface FactRow {
  fact: string;
  designRef: string | null;
  codeRef: string | null;
  design: string | null;
  code: string | null;
  verdict: 'AGREE' | 'DIVERGE' | 'DESIGN-ONLY' | 'CODE-ONLY';
  note?: string;
}

const D = (r: string) => `{imported.button-brand-primary.${r}}`;
const C = (r: string) => `{imported.button.root.${r}}`;

const factSpecs: [string, string | null, string | null, string?][] = [
  ['background-color (default)', D('root.background-color.default'), C('background-color.primary')],
  ['background-color (hover)', D('root.background-color.hover'), C('hover.background-color.primary')],
  [
    'background-color (pressed/active)',
    D('root.background-color.pressed'),
    null,
    'the traced CSS HAS `&:active:not(:disabled)` (bg brand-pressed) — the code extractor dropped the state; the gap is in the code PROPOSAL, not the code truth',
  ],
  ['background-color (disabled)', D('root.background-color.disabled'), C('disabled.background-color.primary')],
  ['label color (default)', D('button.color.default'), C('color.primary')],
  ['label color (disabled)', D('button.color.disabled'), C('disabled.color')],
  ['border-radius', '{imported.shared.size-8}', C('border-radius')],
  ['padding-block', '{imported.shared.size-8}', C('padding-block')],
  ['padding-inline (small)', D('root.padding-inline.small'), C('padding-inline.small')],
  ['padding-inline (medium)', D('root.padding-inline.medium'), C('padding-inline.medium')],
  ['padding-inline (large)', D('root.padding-inline.large'), C('padding-inline.large')],
  ['gap', '{imported.shared.size-8}', C('gap')],
  ['font-size (large)', '{font.title.size}', C('font-size.large'), 'design side bound a REPO token (font.title.size) — reconcile hit, not a mint'],
  [
    'font-size (small)',
    '{font.title.size}',
    C('font-size.small'),
    'kit dump truth for small IS 14px — the DESIGN proposal flattened font-size across sizes; the code side is the faithful one here',
  ],
  ['font-weight', '{font.title.weight}', C('font-weight'), 'design side bound a REPO token'],
  [
    'focus ring border-color',
    D('focus-ring.border-color'),
    null,
    'the traced CSS HAS `&:focus-visible { outline: 2px solid … }` — the code proposal declares the state but minted no facts (outline not in the extracted property set)',
  ],
  ['focus ring border-width', D('focus-ring.border-width'), null, ''],
  ['min-height (per size)', null, C('min-height.medium'), 'design auto-layout implies height; no explicit fact proposed'],
  ['line-height (per size)', null, C('line-height.medium'), 'design text style not token-derived — typography not proposed (see proposal note)'],
];

const factRows: FactRow[] = factSpecs.map(([fact, dRef, cRef, note]) => {
  const dv = resolve(design, dRef);
  const cv = resolve(code, cRef);
  let verdict: FactRow['verdict'];
  if (dv !== null && cv !== null) verdict = px(dv) === px(cv) ? 'AGREE' : 'DIVERGE';
  else verdict = dv !== null ? 'DESIGN-ONLY' : 'CODE-ONLY';
  return { fact, designRef: dRef, codeRef: cRef, design: dv, code: cv, verdict, ...(note ? { note } : {}) };
});

// ---------------------------------------------------------------------------
// prop-axis correspondence (hand-mapped, values checked from the contracts)

interface Axis {
  axis: string;
  design: string;
  code: string;
  verdict: 'AGREE' | 'PARTIAL' | 'DIVERGE' | 'DESIGN-ONLY' | 'CODE-ONLY';
  note: string;
}

const dContract = readJson(path.join(MATRIX, 'out', 'cbds-button-design', 'contract.json')) as {
  props: { name: string; type: unknown; default?: unknown }[];
  states?: string[];
};
const cContract = readJson(path.join(MATRIX, 'out', 'cbds-button-code', 'contract.json')) as {
  props: { name: string; type: unknown; default?: unknown }[];
  states?: string[];
};
const prop = (c: typeof dContract, name: string) => c.props.find((p) => p.name === name);

const dSize = prop(dContract, 'size');
const cSize = prop(cContract, 'size');
const sizeValuesAgree =
  JSON.stringify([...((dSize?.type as { enum: string[] }).enum ?? [])].sort()) === JSON.stringify([...((cSize?.type as { enum: string[] }).enum ?? [])].sort());

const axes: Axis[] = [
  {
    axis: 'size',
    design: `enum ${JSON.stringify((dSize?.type as { enum: string[] }).enum)} default ${JSON.stringify(dSize?.default)}`,
    code: `enum ${JSON.stringify((cSize?.type as { enum: string[] }).enum)} default ${JSON.stringify(cSize?.default)}`,
    verdict: sizeValuesAgree && dSize?.default !== cSize?.default ? 'PARTIAL' : sizeValuesAgree ? 'AGREE' : 'DIVERGE',
    note: 'values identical; DEFAULTS differ (design large, code medium) — a real divergence between the kit and the shipped component',
  },
  {
    axis: 'interaction states',
    design: `state variant axis ${JSON.stringify((prop(dContract, 'state')?.type as { enum: string[] })?.enum)}`,
    code: `contract states ${JSON.stringify(cContract.states)} (CSS pseudo-classes)`,
    verdict: 'PARTIAL',
    note: 'same facts on two different mechanisms: design draws states as variants, code styles real pseudo-states; hover+focus+disabled overlap, pressed exists in BOTH truths but only the design proposal kept it (code extractor dropped &:active), and "default" is implicit in code',
  },
  {
    axis: 'label content',
    design: 'TEXT prop `text` (Figma property "✏️text" — emoji sanitized at proposal, default "Button")',
    code: 'anatomy slot `children`',
    verdict: 'PARTIAL',
    note: 'same job, different shape — a text prop vs a ReactNode slot; reconcile would need a text⇄slot rule',
  },
  {
    axis: 'icons',
    design: 'boolean props `iconLeft`/`iconRight` (Figma "↪️icon-left"/"↪️icon-right", defaults false) toggling `Icon`/`icon2` component-ref parts via visibleWhen (child = auto-proposed ds.icon stub)',
    code: 'optional `iconLeft`/`iconRight` slots (from ReactNode props)',
    verdict: 'PARTIAL',
    note: 'both sides keep two OPTIONAL icon positions around the label (punch-3 recovered the design toggles); shapes still differ — boolean-toggled component refs vs ReactNode slots — a bool⇄slot reconcile rule away from AGREE',
  },
  {
    axis: 'variant (primary/surface/danger/ghost)',
    design: '(absent — the kit set is only Button-Brand Primary)',
    code: `enum ${JSON.stringify((prop(cContract, 'variant')?.type as { enum: string[] }).enum)} default "primary"`,
    verdict: 'CODE-ONLY',
    note: 'the design library spreads brand variants across separate sets; single-set import cannot see the axis',
  },
  {
    axis: 'fullWidth',
    design: '(absent)',
    code: 'boolean default false',
    verdict: 'CODE-ONLY',
    note: 'layout behavior — rarely drawn as a Figma variant',
  },
  {
    axis: 'disabled tooltip',
    design: '`Tooltip` part visibleWhen state=disabled ("This action is currently unavailable")',
    code: '(absent)',
    verdict: 'DESIGN-ONLY',
    note: 'the kit draws helper UI inside the component set that the shipped component never had',
  },
];

// ---------------------------------------------------------------------------
// tallies + report

const factTally = { AGREE: 0, DIVERGE: 0, 'DESIGN-ONLY': 0, 'CODE-ONLY': 0 };
for (const r of factRows) factTally[r.verdict] += 1;
const axisTally = { AGREE: 0, PARTIAL: 0, DIVERGE: 0, 'DESIGN-ONLY': 0, 'CODE-ONLY': 0 };
for (const a of axes) axisTally[a.verdict] += 1;

writeFileSync(
  path.join(MATRIX, 'out', 'd-convergence.json'),
  JSON.stringify({ subject: 'D. CBDS Button — design-proposed vs code-proposed', axisTally, axes, factTally, factRows }, null, 2) + '\n',
);

console.log('── D-convergence: prop axes ──');
for (const a of axes) console.log(`  ${a.verdict.padEnd(12)} ${a.axis}\n    design: ${a.design}\n    code:   ${a.code}\n    ${a.note}`);
console.log('\n── D-convergence: style facts (shared surface = design set ≡ code primary) ──');
for (const r of factRows) {
  console.log(`  ${r.verdict.padEnd(12)} ${r.fact}: design=${r.design ?? '—'} code=${r.code ?? '—'}${r.note ? `  (${r.note})` : ''}`);
}
console.log(`\naxes: ${JSON.stringify(axisTally)}\nfacts: ${JSON.stringify(factTally)}`);
