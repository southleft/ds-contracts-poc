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
  ['background-color (default)', D('root.background-color'), C('background-color.primary')],
  [
    'background-color (hover)',
    D('state-hover.background-color'),
    C('hover.background-color.primary'),
    'SAME mechanism now: the drawn state axis PROMOTED into contract states — design states.hover ≡ code `:hover:not(:disabled)`',
  ],
  [
    'background-color (pressed/active)',
    D('state-active.background-color'),
    C('active.background-color.primary'),
    'design State=Pressed variant promoted to states.active ≡ code `&:active:not(:disabled)` (state-axis promotion + scorecard punch 4)',
  ],
  ['background-color (disabled)', D('state-disabled.background-color'), C('disabled.background-color.primary')],
  ['label color (default)', D('button.color'), C('color.primary')],
  [
    'label color (disabled)',
    D('button-state-disabled.color'),
    C('disabled.color'),
    'SAME mechanism now (P18 v13 — B7 retired): the drawn disabled label fill PROPOSES as a part-level state override (Part.states on the label part) ≡ code `.root:disabled .label { color }`. Both sides finally SPEAK — and they genuinely DISAGREE: the kit draws #556275, the shipped CSS uses #738094. A REAL design↔code drift the matrix could not see while the design side was silent (was CODE-ONLY under B7); surfaced, not smoothed',
  ],
  ['border-radius', '{imported.shared.size-8}', C('border-radius')],
  ['padding-block', '{imported.shared.size-8}', C('padding-block')],
  ['padding-inline (small)', D('root.padding-inline.small'), C('padding-inline.small')],
  ['padding-inline (medium)', D('root.padding-inline.medium'), C('padding-inline.medium')],
  ['padding-inline (large)', D('root.padding-inline.large'), C('padding-inline.large')],
  ['gap', '{imported.shared.size-8}', C('gap')],
  ['font-size (large)', D('button.font-size.large'), C('font-size.large'), 'design side now mints font-size PER SIZE (typography-uniformity guard) — no more first-variant constant'],
  [
    'font-size (small)',
    D('button.font-size.small'),
    C('font-size.small'),
    'kit dump truth for small IS 14px and the design proposal now carries it exactly — the flattening bug (font.title adopted from the first variant) is fixed',
  ],
  [
    'font-weight',
    D('button.font-weight'),
    C('font-weight'),
    'design side now MINTS the weight (600 — the font-weight minting shipped after the original matrix run); previously NAMED-only ("Semi Bold" had no token identity)',
  ],
  [
    'focus ring color',
    D('state-focus-visible.outline-color'),
    C('focus-visible.outline-color'),
    'SAME mechanism now: the drawn Focus ring child inverted to focus-visible OUTLINE overrides (state promotion) ≡ code `&:focus-visible { outline: 2px solid … }`',
  ],
  ['focus ring width', D('state-focus-visible.outline-width'), C('focus-visible.outline-width'), ''],
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
    design: `contract states ${JSON.stringify(dContract.states)} + a native \`disabled\` boolean — PROMOTED from the drawn state axis (default|hover|focus|pressed|disabled); figmaStatePreviews round-trips it`,
    code: `contract states ${JSON.stringify(cContract.states)} (CSS pseudo-classes)`,
    verdict: JSON.stringify(dContract.states) === JSON.stringify(cContract.states) ? 'AGREE' : 'PARTIAL',
    note: 'ONE mechanism now: both sides declare the SAME contract states — the drawn axis never ships as a code prop (state-axis promotion)',
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
    design: 'hidden `Tooltip` text drawn only in the disabled variants — dropped with a NAMED receipt (design-time helper; state promotion keeps per-state anatomy out of the contract)',
    code: '(absent)',
    verdict: 'DESIGN-ONLY',
    note: 'the kit draws helper UI inside the component set that the shipped component never had; the proposal names it instead of modeling it',
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
