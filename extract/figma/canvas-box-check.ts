/**
 * CANVAS METRICS PARITY receipt — `npm run extract:figma:canvas:check`.
 *
 * Fixture: extract/figma/fixtures/cbds-plugin-button-brand-primary.dump.json
 * (the owner's live CBDS "Button-Brand Primary" send, dump v1.4).
 *
 * The field failure: the Code preview rendered his Button correctly
 * (padding-inline 16/12, heights 48/40/32, receipt-pinned in
 * cbds-bridge-check.ts) but the CANVAS view drew visibly wrong boxes — too
 * tall/padded, and the three sizes near-identical. TWO root causes, both
 * fixed and both pinned here:
 *
 *   1. compileComponentData applied `root.tokens` directly instead of
 *      resolveTokens(root, subst): the ROOT's tokensByProp overrides (his
 *      per-size padding-inline {spacing.150} and height {component-size.
 *      large|medium}) never reached the compiled specs — every cell got the
 *      base large values (fixedHeight 48, padding 16), so all 15 cells drew
 *      IDENTICAL. Child parts already resolved through resolveTokens; the
 *      root was the one caller that didn't.
 *   2. the canvas preview rendered content-box divs: a bound height (48px)
 *      PLUS padding-block (8px top and bottom) drew a 64px cell — Figma
 *      boxes are border-box (a FIXED height includes padding), and the code
 *      preview was right only because <button> is border-box by UA
 *      stylesheet. The canvas stylesheet now declares border-box.
 *
 * DEFINITION OF DONE (this receipt): every compiled canvas cell's box equals
 * the dump's own captured variant node box, numerically, for all 15 cells —
 * height exact (the border-box cell height IS spec.fixedHeight.px), padding
 * exact per side, the height BINDING carries the same variable the canvas
 * captured, hug width by the same named rule on both sides, and the
 * per-size differences actually differ. Width note: the dump captures
 * primarySizing AUTO (hug) and no numeric width — width parity is BY
 * CONSTRUCTION when both sides hug with equal padding, gap, and text
 * metrics, all of which are pinned below.
 *
 * Node script over pure functions — same shell/core split as
 * extract/figma/cbds-bridge-check.ts. The compile step exercised here
 * (createFigmaEngine().compileComponentData) is EXACTLY what the playground
 * canvas preview renders (playground/src/engine/canvas-preview.ts) and what
 * the sync-script runtime executes.
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { ContractSchema, type Contract } from '../../scripts/contract-schema.js';
import { loadTokenCorpus } from './tokens.js';
import { loadContracts } from './propose.js';
import { proposeBatchFromDump } from '../../core/propose-figma.js';
import { capturedTokensFromDump } from '../../core/captured-tokens.js';
import { createFigmaEngine, type NodeSpec, type VariantSpec } from '../../core/emit-figma-script.js';
import type { DumpNode, DumpVariable } from './types.js';

const ROOT = process.cwd();
const read = (p: string) => JSON.parse(readFileSync(path.join(ROOT, p), 'utf8')) as Record<string, unknown>;

const failures: string[] = [];
const check = (label: string, cond: boolean) => {
  if (!cond) failures.push(label);
  console.log(`  ${cond ? '✔' : '✖'} ${label}`);
};

// ---------------------------------------------------------------------------
// Replay the owner's send (the SAME batch function the playground runs),
// then compile the canvas cells with the SAME engine the canvas preview and
// the sync script share.
// ---------------------------------------------------------------------------

console.log('CANVAS METRICS PARITY (canvas cells vs the captured Figma variant boxes)');
const dump = read(path.join('extract', 'figma', 'fixtures', 'cbds-plugin-button-brand-primary.dump.json'));
const corpus = loadTokenCorpus(ROOT);
const loaded = loadContracts(path.resolve(ROOT, 'contracts'));
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
const captured = capturedTokensFromDump(dump)!;

// The playground's layer composition (token-source recompose), mirrored:
// repo trees with captured + minted deep-merged into the semantic slot.
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
const byId = new Map<string, Contract>([[contract.id, contract]]);
for (const s of stubs) byId.set(s.id, s);
const data = engine.compileComponentData(contract, byId);
const cells: VariantSpec[] = [...data.variants, ...(data.stateVariants ?? [])];

// ---------------------------------------------------------------------------
// 1. Cell ↔ captured-variant mapping (size × state; 15 of each)
// ---------------------------------------------------------------------------

console.log('\n1. Every canvas cell maps to a captured variant');
type DumpVariant = DumpNode & { name: string };
const set = dump['Button-Brand Primary'] as { variants: DumpVariant[] };
check(`15 canvas cells compile (got ${cells.length})`, cells.length === 15);
check(`15 captured variants in the dump (got ${set.variants.length})`, set.variants.length === 15);

// Cell name → dump variant name. Base cells carry the size axis only
// (state=default); state-preview cells append the State label the contract's
// promoted state names spell (active was promoted FROM pressed; focus-visible
// is the drawn Focus ring variant).
const STATE_LABEL_TO_DUMP: Record<string, string> = {
  Hover: 'hover',
  Active: 'pressed',
  'Focus Visible': 'focus',
  Disabled: 'disabled',
};
function dumpVariantFor(cellName: string): DumpVariant | undefined {
  const segs = Object.fromEntries(
    cellName.split(',').map((s) => {
      const [k, v] = s.split('=').map((x) => x.trim());
      return [k, v];
    }),
  );
  const size = segs['size'];
  const state = segs['State'] ? STATE_LABEL_TO_DUMP[segs['State']] : 'default';
  return set.variants.find((v) => v.name === `size=${size}, state=${state}`);
}
check('every cell name maps to a distinct captured variant', new Set(cells.map((c) => dumpVariantFor(c.name)?.name).filter(Boolean)).size === 15);

// ---------------------------------------------------------------------------
// 2. Box parity, numerically, per cell — the definition of done
// ---------------------------------------------------------------------------

console.log('\n2. Canvas cell box == captured variant box (all 15 cells)');
const vars = dump['_variables'] as Record<string, DumpVariable>;
const varPx = (name: string | undefined): number | undefined => {
  if (!name) return undefined;
  const v = vars[name];
  return v && typeof v.value === 'number' ? v.value : undefined;
};
// The canvas draws border-box (pinned in §4): the rendered cell height IS
// spec.fixedHeight.px; padding sides resolve through the bound variables.
const cellBox = (spec: NodeSpec) => ({
  height: spec.fixedHeight?.px,
  heightVar: spec.fixedHeight?.varName,
  padTop: varPx(spec.bindings?.paddingTop),
  padRight: varPx(spec.bindings?.paddingRight),
  padBottom: varPx(spec.bindings?.paddingBottom),
  padLeft: varPx(spec.bindings?.paddingLeft),
  gap: varPx(spec.bindings?.itemSpacing),
  hugWidth: spec.fixedWidth === undefined,
});
const capturedBox = (v: DumpVariant) => {
  const [t, r, b, l] = v.layout?.padding ?? [NaN, NaN, NaN, NaN]; // CSS order [top,right,bottom,left]
  return {
    height: varPx(v.bound?.['height']),
    heightVar: v.bound?.['height'],
    padTop: t,
    padRight: r,
    padBottom: b,
    padLeft: l,
    gap: v.layout?.spacing,
    hugWidth: v.layout?.primarySizing === 'AUTO',
  };
};
const heightsBySize = new Map<string, number>();
const padInlineBySize = new Map<string, number>();
for (const cell of cells) {
  const dv = dumpVariantFor(cell.name);
  if (!dv) {
    check(`cell "${cell.name}" has a captured variant`, false);
    continue;
  }
  const got = cellBox(cell.spec);
  const want = capturedBox(dv);
  const same =
    got.height === want.height &&
    got.heightVar === want.heightVar &&
    got.padTop === want.padTop &&
    got.padRight === want.padRight &&
    got.padBottom === want.padBottom &&
    got.padLeft === want.padLeft &&
    got.gap === want.gap &&
    got.hugWidth === want.hugWidth;
  check(
    `cell "${cell.name}" box == captured "${dv.name}" box (h=${want.height} via ${want.heightVar}, pad=[${want.padTop},${want.padRight},${want.padBottom},${want.padLeft}], gap=${want.gap}, hug width)` +
      (same ? '' : ` — GOT h=${got.height} via ${got.heightVar}, pad=[${got.padTop},${got.padRight},${got.padBottom},${got.padLeft}], gap=${got.gap}, hug=${got.hugWidth}`),
    same,
  );
  const size = cell.name.match(/size=([a-z]+)/)?.[1] ?? '?';
  if (got.height !== undefined) heightsBySize.set(size, got.height);
  if (got.padLeft !== undefined) padInlineBySize.set(size, got.padLeft);
}

// Width parity by construction: both sides hug; equal padding + gap pinned
// above; the remaining input is the text run — pin its metrics per size.
console.log('\n   width inputs (hug): text metrics per size match the captured text');
for (const cell of cells) {
  const dv = dumpVariantFor(cell.name)!;
  const text = (cell.spec.children ?? []).find((c) => c.type === 'text');
  const dumpText = (dv.children ?? []).find((c) => c.type === 'TEXT') as (DumpNode & { text?: { fontSize?: number; lineHeight?: number } }) | undefined;
  check(
    `cell "${cell.name}" text ${text?.fontSize}px/${text?.lineHeight}px == captured ${dumpText?.text?.fontSize}px/${dumpText?.text?.lineHeight}px`,
    text?.fontSize === dumpText?.text?.fontSize && text?.lineHeight === dumpText?.text?.lineHeight,
  );
}

// ---------------------------------------------------------------------------
// 3. Per-size differences actually DIFFER (the uniform-cells complaint)
// ---------------------------------------------------------------------------

console.log('\n3. Per-size differences differ (the uniform-cells complaint)');
check(
  `heights 48/40/32 per size, DISTINCT (got large=${heightsBySize.get('large')}, medium=${heightsBySize.get('medium')}, small=${heightsBySize.get('small')})`,
  heightsBySize.get('large') === 48 && heightsBySize.get('medium') === 40 && heightsBySize.get('small') === 32,
);
check(
  `padding-inline 16/16/12 — small DIFFERS (got large=${padInlineBySize.get('large')}, medium=${padInlineBySize.get('medium')}, small=${padInlineBySize.get('small')})`,
  padInlineBySize.get('large') === 16 && padInlineBySize.get('medium') === 16 && padInlineBySize.get('small') === 12,
);
check(
  'min-height 44 stays CSS-side BY DESIGN (the canvas draws the real per-variant height; the contract carries the fact for the code surfaces)',
  typeof (contract.anatomy.root.tokens ?? {})['min-height'] === 'string' &&
    cells.every((c) => !JSON.stringify(c.spec).includes('minHeight')),
);

// ---------------------------------------------------------------------------
// 4. The canvas renderer draws border-box — the too-tall bug class
// ---------------------------------------------------------------------------

console.log('\n4. The playground canvas surface renders these specs border-box');
const canvasPreviewPath = path.join(ROOT, 'playground', 'src', 'engine', 'canvas-preview.ts');
check('playground/src/engine/canvas-preview.ts present', existsSync(canvasPreviewPath));
const canvasSrc = existsSync(canvasPreviewPath) ? readFileSync(canvasPreviewPath, 'utf8') : '';
check(
  'the canvas stylesheet declares box-sizing: border-box (a FIXED height includes padding, like Figma — 48px means 48px, not 48+8+8)',
  canvasSrc.includes('box-sizing: border-box'),
);
check(
  'fixedHeight renders as the cell height declaration (height: var(name, px))',
  canvasSrc.includes('spec.fixedHeight') && canvasSrc.includes('cssVarWithFallback'),
);

// ---------------------------------------------------------------------------

if (failures.length > 0) {
  console.error(`\n✖ ${failures.length} canvas-parity invariant(s) failed`);
  process.exit(1);
}
console.log(
  '\n✔ canvas metrics parity holds: all 15 cells box-equal the captured variant boxes (heights 48/40/32 bound to his component-size variables, padding exact per side, hug width by construction), per-size differences differ, and the canvas draws border-box',
);
