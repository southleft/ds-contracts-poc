/**
 * grid-css-emitters check (A2 — the CSS-emitter surface of the pinned layout
 * grammar, docs/research/layout-grammar-proposal.md G1–G6).
 *
 * The canvas half of the canonical bento is pinned by
 * evals/fixtures/grid-bento-check.ts (the P8 carriage receipt). THIS file
 * pins the CODE half across all three CSS surfaces — core/emit-html.ts,
 * core/emit-react.ts (CSS Modules + TSX), core/emit-react-inline.ts — with
 * the G6-pinned CANONICAL spellings the code-side proposer parses back:
 *
 *   1. Tracks:   px → `Npx`, fr → `Nfr`, fit → `fit-content(100%)` (P14).
 *   2. Gaps:     `row-gap` / `column-gap` — the independent pair, px numbers
 *                or var(--…) token refs (resolved literals on the inline
 *                surface); a SUBSTITUTED gap ref refuses BY NAME.
 *   3. Placement: `grid-row: r+1[ / span n]` / `grid-column` (CSS is
 *                1-based — the +1 is the emitter fact; spans of 1 unspelled),
 *                `justify-self` / `align-self` for alignX/alignY (auto
 *                omitted — stretch-by-absence IS the G3 fill spelling).
 *   4. Areas:    `grid-template-areas` + `grid-area: <name>` (G4 — the area
 *                name IS the slot anchor); an EMPTY area renders a
 *                placeholder element carrying the slot class on BOTH the
 *                markup and stylesheet sides (the dual-slot convention).
 *   5. Flow:     `grid-auto-flow: row`, rows OMITTED (G5 — placement fact is
 *                child order; the derived explicit row list is a CANVAS
 *                obligation, P9).
 *   6. Instances: a component-ref cell rides a wrapper whose class takes the
 *                placement + `display: grid` (the CSS spelling of the canvas
 *                FILL default, G3/P12).
 *   7. Byte-determinism ×2 per surface.
 *
 * Exits non-zero with a named failure on any violated expectation.
 */
import { ContractSchema, type Contract } from '../../scripts/contract-schema.js';
import { emitHtml } from '../../core/emit-html.js';
import { emitReact, type EmitCtx } from '../../core/emit-react.js';
import { emitReactInline, type EmitReactInlineCtx } from '../../core/emit-react-inline.js';

const fail = (msg: string): never => {
  console.error(`✘ grid-css-emitters: ${msg}`);
  process.exit(1);
};
const has = (label: string, text: string, needle: string): void => {
  if (!text.includes(needle)) {
    fail(`${label}: missing canonical spelling ${JSON.stringify(needle)}\n--- got ---\n${text}`);
  }
};
const lacks = (label: string, text: string, needle: string): void => {
  if (text.includes(needle)) {
    fail(`${label}: must NOT contain ${JSON.stringify(needle)}`);
  }
};

// --- shared contract scaffolding -------------------------------------------
const base = {
  version: '0.1.0',
  status: 'draft',
  semantics: { element: 'div' },
  props: [],
  states: [],
  anchors: { figma: { fileKey: null, componentSetKey: null }, code: { importPath: 'x', export: 'X' } },
};
const parse = (raw: Record<string, unknown>): Contract => ContractSchema.parse({ ...base, ...raw }) as Contract;

// The canonical bento (grid-bento-span-matrix, P8) + one aligned FIXED child
// and one fit-content column exercised on a second contract below.
const bento = (): Contract =>
  parse({
    id: 'ds.eval-bento-css',
    name: 'EvalBentoCss',
    description: 'grid-bento-span-matrix fixture — the CSS half of the P8 receipt',
    anatomy: {
      root: {
        layout: {
          display: 'grid',
          rows: [{ px: 80 }, { fr: 1 }, { fr: 2 }],
          columns: [{ px: 160 }, { fr: 1 }, { fr: 1 }, { px: 120 }],
          gap: { row: 12, column: 16 },
        },
        literals: { width: '640px', height: '480px' },
        parts: {
          header: { placement: { row: 0, column: 0, columnSpan: 4 }, literals: { 'background-color': '#e0e0e0' } },
          sidebar: { placement: { row: 1, column: 0, rowSpan: 2 }, literals: { 'background-color': '#d0d0d0' } },
          main: { placement: { row: 1, column: 1, columnSpan: 2 }, literals: { 'background-color': '#f0f0f0' } },
          rail: { placement: { row: 1, column: 3, rowSpan: 2 }, literals: { 'background-color': '#c0c0c0' } },
          footer: {
            placement: { row: 2, column: 1, columnSpan: 2, alignX: 'center', alignY: 'end' },
            literals: { 'background-color': '#b0b0b0', width: '120px', height: '40px' },
          },
        },
      },
    },
  });

const emptyTokens = { primitives: {}, semantic: {}, light: {}, dark: {}, brands: { default: {} } };
const htmlCtx = (contracts: Map<string, Contract>): EmitCtx => ({
  tokens: new Set<string>(['space.200']),
  icons: new Map(),
  contracts,
});
const inlineCtx = (contracts: Map<string, Contract>): EmitReactInlineCtx => ({
  tokens: {
    ...emptyTokens,
    primitives: { space: { $type: 'dimension', '200': { $value: '16px' } } },
  },
  icons: new Map(),
  contracts,
});
const soloMap = (c: Contract): Map<string, Contract> => new Map([[c.id, c]]);

// ---- 1. the bento: canonical parent + placement spellings, all 3 surfaces --
{
  const c = bento();
  const html = emitHtml(c, htmlCtx(soloMap(c)));
  const react = emitReact(c, htmlCtx(soloMap(c)));
  const inline = emitReactInline(c, inlineCtx(soloMap(c)));

  for (const [label, css] of [
    ['emit-html css', html.css],
    ['emit-react css', react.css],
  ] as const) {
    has(label, css, 'display: grid;');
    has(label, css, 'grid-template-rows: 80px 1fr 2fr;');
    has(label, css, 'grid-template-columns: 160px 1fr 1fr 120px;');
    has(label, css, 'row-gap: 12px;');
    has(label, css, 'column-gap: 16px;');
    // 1-based lines, span-1 unspelled, aligns only where declared (G3:
    // stretch is the absence of alignment — no justify-self elsewhere).
    has(label, css, 'grid-row: 1;');
    has(label, css, 'grid-column: 1 / span 4;');
    has(label, css, 'grid-row: 2 / span 2;');
    has(label, css, 'grid-column: 2 / span 2;');
    has(label, css, 'grid-row: 3;');
    has(label, css, 'justify-self: center;');
    has(label, css, 'align-self: end;');
    lacks(label, css, 'grid-auto-flow');
    lacks(label, css, 'justify-self: start');
  }
  // the inline surface carries the same facts camelCased with literal values
  has('inline tsx', inline.tsx, '"display": "grid"');
  has('inline tsx', inline.tsx, '"gridTemplateRows": "80px 1fr 2fr"');
  has('inline tsx', inline.tsx, '"gridTemplateColumns": "160px 1fr 1fr 120px"');
  has('inline tsx', inline.tsx, '"rowGap": "12px"');
  has('inline tsx', inline.tsx, '"columnGap": "16px"');
  has('inline tsx', inline.tsx, '"gridRow": "1"');
  has('inline tsx', inline.tsx, '"gridColumn": "1 / span 4"');
  has('inline tsx', inline.tsx, '"gridRow": "2 / span 2"');
  has('inline tsx', inline.tsx, '"justifySelf": "center"');
  has('inline tsx', inline.tsx, '"alignSelf": "end"');

  // ---- byte-determinism ×2 per surface ----
  const c2 = bento();
  const html2 = emitHtml(c2, htmlCtx(soloMap(c2)));
  const react2 = emitReact(c2, htmlCtx(soloMap(c2)));
  const inline2 = emitReactInline(c2, inlineCtx(soloMap(c2)));
  if (html.css !== html2.css || html.html !== html2.html) fail('emit-html is not byte-deterministic ×2');
  if (react.css !== react2.css || react.tsx !== react2.tsx) fail('emit-react is not byte-deterministic ×2');
  if (inline.tsx !== inline2.tsx) fail('emit-react-inline is not byte-deterministic ×2');
}

// ---- 2. named areas ARE slot anchors (G4) + the dual placeholder ----------
{
  const c = parse({
    id: 'ds.eval-areas-css',
    name: 'EvalAreasCss',
    description: 'G4 named-area fixture — header/nav/content, nav EMPTY',
    anatomy: {
      root: {
        layout: {
          display: 'grid',
          rows: [{ px: 64 }, { fr: 1 }],
          columns: [{ px: 240 }, { fit: true }],
          gap: { row: 8, column: 8 },
          areas: {
            header: { row: 0, column: 0, columnSpan: 2 },
            nav: { row: 1, column: 0 },
            content: { row: 1, column: 1 },
          },
        },
        parts: {
          header: { literals: { 'background-color': '#eee' } },
          content: { literals: { 'background-color': '#fff' } },
        },
      },
    },
  });
  const html = emitHtml(c, htmlCtx(soloMap(c)));
  const react = emitReact(c, htmlCtx(soloMap(c)));
  const inline = emitReactInline(c, inlineCtx(soloMap(c)));

  for (const [label, css] of [
    ['emit-html css', html.css],
    ['emit-react css', react.css],
  ] as const) {
    has(label, css, 'grid-template-areas: "header header" "nav content";');
    // P14: a fit track's exact code spelling
    has(label, css, 'grid-template-columns: 240px fit-content(100%);');
    has(label, css, 'grid-area: header;');
    has(label, css, 'grid-area: content;');
    // the EMPTY area owns a placeholder rule (dual-slot convention)
    has(label, css, 'grid-area: nav;');
  }
  // …and a placeholder ELEMENT on both markup surfaces
  has('emit-html html', html.html, 'class="eval-areas-css__nav"');
  has('emit-html html', html.html, 'nav area: empty (grid placeholder)');
  has('emit-react tsx', react.tsx, '<div className={styles.nav} />');
  has('inline tsx', inline.tsx, '"gridTemplateAreas": "\\"header header\\" \\"nav content\\""');
  has('inline tsx', inline.tsx, '"gridArea": "nav"');
}

// ---- 3. bounded auto-flow (G5): rows omitted, order places ----------------
{
  const c = parse({
    id: 'ds.eval-flow-css',
    name: 'EvalFlowCss',
    description: 'G5 fixture — 3 columns, flow row, placement = child order',
    anatomy: {
      root: {
        layout: {
          display: 'grid',
          columns: [{ fr: 1 }, { fr: 1 }, { fr: 1 }],
          gap: { row: 4, column: 4 },
          flow: 'row',
        },
        parts: {
          a: { literals: { 'background-color': '#111' } },
          b: { literals: { 'background-color': '#222' } },
          c: { literals: { 'background-color': '#333' } },
          d: { literals: { 'background-color': '#444' } },
        },
      },
    },
  });
  const html = emitHtml(c, htmlCtx(soloMap(c)));
  const react = emitReact(c, htmlCtx(soloMap(c)));
  for (const [label, css] of [
    ['emit-html css', html.css],
    ['emit-react css', react.css],
  ] as const) {
    has(label, css, 'grid-auto-flow: row;');
    has(label, css, 'grid-template-columns: 1fr 1fr 1fr;');
    lacks(label, css, 'grid-template-rows'); // G5: rows derive from order — never spelled in CSS
    lacks(label, css, 'grid-row:'); // placement fact is CHILD ORDER, not coordinates
  }
}

// ---- 4. gaps: token refs ride each surface's own spelling -----------------
{
  const c = parse({
    id: 'ds.eval-gap-css',
    name: 'EvalGapCss',
    description: 'token-gap fixture — var(--…) on stylesheets, literal inline',
    anatomy: {
      root: {
        layout: {
          display: 'grid',
          rows: [{ fr: 1 }],
          columns: [{ fr: 1 }, { fr: 1 }],
          gap: { row: '{space.200}', column: 4.5 },
        },
        parts: {
          a: { placement: { row: 0, column: 0 } },
          b: { placement: { row: 0, column: 1 } },
        },
      },
    },
  });
  const html = emitHtml(c, htmlCtx(soloMap(c)));
  const react = emitReact(c, htmlCtx(soloMap(c)));
  const inline = emitReactInline(c, inlineCtx(soloMap(c)));
  has('emit-html css', html.css, 'row-gap: var(--space-200);');
  has('emit-html css', html.css, 'column-gap: 4.5px;'); // P2b: fractional px carried exactly
  has('emit-react css', react.css, 'row-gap: var(--space-200);');
  has('inline tsx', inline.tsx, '"rowGap": "16px"'); // resolved literal — the inline surface's whole claim
}

// ---- 5. a SUBSTITUTED gap ref refuses BY NAME on the static surfaces ------
{
  const c = parse({
    id: 'ds.eval-gap-subst-css',
    name: 'EvalGapSubstCss',
    description: 'substituted grid gap — refused by name, never a dead var()',
    props: [
      {
        name: 'size',
        type: { enum: ['sm', 'lg'] },
        default: 'sm',
        bindings: {
          code: { prop: 'size' },
          figma: { kind: 'VARIANT', property: 'Size', values: { sm: 'Sm', lg: 'Lg' } },
        },
      },
    ],
    anatomy: {
      root: {
        layout: {
          display: 'grid',
          rows: [{ fr: 1 }],
          columns: [{ fr: 1 }],
          gap: { row: '{space.{size}}', column: 4 },
        },
        parts: { a: { placement: { row: 0, column: 0 } } },
      },
    },
  });
  let threw = '';
  try {
    emitHtml(c, htmlCtx(soloMap(c)));
  } catch (e) {
    threw = String(e);
  }
  if (!threw.includes('grid-gap-substituted-ref')) {
    fail(`substituted gap ref must refuse BY NAME (grid-gap-substituted-ref) — got: ${threw || 'NO THROW'}`);
  }
}

// ---- 6. an instance cell rides a wrapper (G3/P12) -------------------------
{
  const dep = parse({
    id: 'ds.eval-cell-dep',
    name: 'EvalCellDep',
    description: 'minimal dependency for the instance-in-grid fixture',
    anchors: { figma: { fileKey: null, componentSetKey: null }, code: { importPath: 'x', export: 'EvalCellDep' } },
    anatomy: { root: { literals: { 'background-color': '#abc' } } },
  });
  const c = parse({
    id: 'ds.eval-cell-host',
    name: 'EvalCellHost',
    description: 'instance-in-grid fixture — the wrapper IS the grid item',
    anatomy: {
      root: {
        layout: {
          display: 'grid',
          rows: [{ fr: 1 }],
          columns: [{ px: 100 }, { fr: 1 }],
        },
        parts: {
          label: { placement: { row: 0, column: 0 }, literals: { color: '#000' } },
          widget: { placement: { row: 0, column: 1 }, component: { id: 'ds.eval-cell-dep' } },
        },
      },
    },
  });
  const contracts = new Map([[c.id, c], [dep.id, dep]]);
  const html = emitHtml(c, htmlCtx(contracts));
  const react = emitReact(c, htmlCtx(contracts));
  // the wrapper class takes the cell + display: grid (canvas FILL spelling)
  for (const [label, css] of [
    ['emit-html css', html.css],
    ['emit-react css', react.css],
  ] as const) {
    has(label, css, 'grid-column: 2;');
    const widgetRule = new RegExp(String.raw`__widget \{[^}]*display: grid;`).test(css) ||
      /\.widget \{[^}]*display: grid;/.test(css);
    if (!widgetRule) fail(`${label}: instance wrapper rule must carry display: grid (canvas FILL spelling)`);
  }
  has('emit-html html', html.html, 'class="eval-cell-host__widget"');
  has('emit-react tsx', react.tsx, '<span className={styles.widget}>');
}

console.log(
  'grid-css-emitters ok: canonical G6 spellings pinned on all 3 CSS surfaces ' +
    '(tracks px/fr/fit-content(100%), row-gap/column-gap pair, 1-based grid-row/column with spans, ' +
    'justify-self/align-self, grid-template-areas + grid-area slot anchors with dual placeholders, ' +
    'grid-auto-flow: row with rows unspelled, instance cells on display:grid wrappers, ' +
    'substituted gap refs refused by name, byte-deterministic ×2)',
);
