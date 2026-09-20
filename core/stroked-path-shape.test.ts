import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { ContractSchema, strokedPathIssue, strokedPathGeometryIssue, strokedPathSvg, lowerStrokedPathPaint, walkAnatomy, type Contract } from '../scripts/contract-schema.js';
import { validateContract, emitReact } from './emit-react.js';
import { emitReactInline } from './emit-react-inline.js';
import { emitHtml } from './emit-html.js';
import { emitWebComponent } from '../packages/emitter-web-components/src/emit-wc.js';
import { mountGenerated } from './react-test-runtime.js';
import { createFigmaEngine } from './emit-figma-script.js';
import { proposeFromDump } from './propose-figma.js';
import { tokenCorpusFromJson } from './token-corpus.js';

const data = 'M0 0L5 8L10 2';
const shape = () => ({ kind: 'stroked-path' as const, width: 10, height: 8, strokePath: {
  data, cap: 'ROUND' as const, join: 'BEVEL' as const, miterLimit: 4,
  viewport: { width: 20, height: 16, x: 2.375, y: 3.125 },
} });
const tokens = { primitives: {}, semantic: {}, light: {}, dark: {}, brands: { default: {} } };
function contract(): Contract {
  return ContractSchema.parse({ id: 'probe.strokes', name: 'StrokeProbe', version: '1.0.0', archetype: 'none', description: 'Open path geometry.', semantics: { element: 'div' },
    props: [{ name: 'tone', type: { enum: ['cool', 'warm'] }, default: 'cool', bindings: { code: { prop: 'tone' }, figma: { kind: 'VARIANT', property: 'Tone', values: { cool: 'Cool', warm: 'Warm' } } } }], states: [],
    anatomy: { root: { layout: { display: 'flex' }, parts: { viewport: { declared: { position: 'relative' }, literals: { width: '20px', height: '16px' }, parts: {
      stroke: { shape: shape(), literals: { 'border-color': '#334455', 'border-width': '1.25px' }, literalsByProp: [{ prop: 'tone', map: { warm: { 'border-color': '#aa2200', 'border-width': '2px' } } }] },
    } } } } }, bindings: { code: { anchors: { importPath: './StrokeProbe', export: 'StrokeProbe' } }, figma: { anchors: { fileKey: null, componentSetKey: null } } },
  });
}
const leaf = (c: Contract) => c.anatomy.root!.parts!.viewport!.parts!.stroke!;
const parent = (c: Contract) => c.anatomy.root!.parts!.viewport!;
const errorsOf = (c: Contract) => { const errors: string[] = []; validateContract(c, new Map([[c.id, c]]), errors, new Map()); return errors; };
const plugin = readFileSync(new URL('../extract/figma/dump.plugin.js', import.meta.url), 'utf8');
const start = plugin.indexOf('function strokedPathIssue('), end = plugin.indexOf('function dumpShape(', start);
const reader = vm.runInNewContext(`${plugin.slice(start, end)}; ({ issue: strokedPathIssue, shape: dumpStrokedPath })`);

test('open path parser agrees with canonical capture and rejects malformed or unsafe geometry', () => {
  for (const path of [data, 'M0\t0L5\r\n8L10 2', 'M0,0 3,4 8,2', 'M0 0C1 -2 3 9 10 2Q12 1 9 4', 'M0 0L1e-3 2']) {
    assert.equal(strokedPathIssue(path), undefined); assert.equal(reader.issue(path), undefined);
  }
  for (const path of ['M0\u00a00L5\u00a08L10\u00a02', 'M0\u000b0L5\u000b8L10\u000b2', 'M0\u000c0L5\u000c8L10\u000c2', 'M0\u20280L5\u20288L10\u20282', '', 'M0 0', 'M0 0Z', 'M0 0L1', 'L0 0L1 2', 'M0 0L1 1M2 3L4 5', 'M0 0A1 2 0 0 0 3 4', 'm0 0l1 1', 'M0 0H1V2', 'M0 0L1e999 2', 'M0 0L1000001 2', 'M0,,0L1 2', 'M0 0L1,2,', 'M0 0L1 2<script>', 'M0 0L1 2" onload="x']) {
    assert.ok(strokedPathIssue(path), path); assert.equal(reader.issue(path), strokedPathIssue(path));
    assert.throws(() => strokedPathSvg({ ...shape(), strokePath: { ...shape().strokePath, data: path } }));
  }
  assert.ok(strokedPathGeometryIssue({ ...shape(), strokePath: { ...shape().strokePath, viewport: { width: 0, height: 16, x: 0, y: 0 } } }));
  for (const path of ['M1 1L6 9L11 3', 'M0 0C0 80 10 0 10 8', 'M0 0L10 9'])
    assert.equal(strokedPathGeometryIssue({ ...shape(), strokePath: { ...shape().strokePath, data: path } }), 'stroked-path-bounds-mismatch');
  for (const path of ['M0 0C0 8 10 0 10 8L5 4', 'M0 0Q0 8 10 8'])
    assert.equal(strokedPathGeometryIssue({ ...shape(), strokePath: { ...shape().strokePath, data: path } }), undefined);
});

const nativeParent = () => ({ type: 'FRAME', layoutMode: 'NONE', relativeTransform: [[1, 0, 40], [0, 1, 50]], width: 20, height: 16, paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0, strokes: [], clipsContent: false });
const nativeNode = () => ({ type: 'VECTOR', width: 10, height: 8, relativeTransform: [[1, 0, 2.375], [0, 1, 3.125]], isMask: false, fills: [], effects: [],
  strokes: [{ type: 'SOLID', blendMode: 'NORMAL' }], blendMode: 'PASS_THROUGH', strokeAlign: 'CENTER', strokeWeight: 1.25,
  strokeCap: 'ROUND', strokeJoin: 'BEVEL', strokeMiterLimit: 4, dashPattern: [], cornerRadius: 0,
  variableWidthStrokeProperties: { widthProfile: 'UNIFORM', variableWidthPoints: [] }, complexStrokeProperties: { type: 'BASIC' }, constraints: { horizontal: 'SCALE', vertical: 'SCALE' },
  vectorPaths: [{ data, windingRule: 'NONE' }], vectorNetwork: { vertices: [{ x: 0, y: 0 }, { x: 5, y: 8 }, { x: 10, y: 2 }], regions: [] },
});
test('capture refuses altered origin, flow, paint, network decoration and outlined paths', () => {
  assert.deepEqual(JSON.parse(JSON.stringify(reader.shape(nativeNode(), nativeParent()))), shape());
  const patches = [{ isMask: true }, { fills: [{ type: 'SOLID' }] }, { dashPattern: [2, 2] }, { strokeAlign: 'INSIDE' }, { strokeCap: 'ARROW_LINES' },
    { effects: [{ type: 'DROP_SHADOW' }] }, { strokeJoin: Symbol('mixed') }, { cornerRadius: 1 }, { variableWidthStrokeProperties: { widthProfile: 'CUSTOM' } },
    { complexStrokeProperties: { type: 'BRUSH' } }, { vectorNetwork: { vertices: [{ strokeCap: 'SQUARE' }] } }, { boundVariables: { strokeMiterLimit: {} } },
    { constraints: { horizontal: 'MIN', vertical: 'SCALE' } }, { relativeTransform: [[1, 0.01, 0], [0, 1, 0]] }, { vectorPaths: [{ data: 'M0 0L10 8Z', windingRule: 'NONZERO' }] }];
  for (const patch of patches) assert.equal(reader.shape({ ...nativeNode(), ...patch }, nativeParent()), null, String(Object.keys(patch)));
  for (const patch of [{ layoutMode: 'HORIZONTAL' }, { paddingLeft: 1 }, { width: 0 }, { clipsContent: true }, { relativeTransform: [[0, 1, 0], [-1, 0, 0]] }])
    assert.equal(reader.shape(nativeNode(), { ...nativeParent(), ...patch }), null);
});

test('all style maps and viewport geometry obey the bounded paint-only grammar', () => {
  assert.deepEqual(errorsOf(contract()), []);
  for (const patch of [{ literals: { 'background-color': '#111111' } }, { tokensByProp: { prop: 'tone', map: { warm: { 'box-shadow': '{shadow}' } } } },
    { states: { hover: { 'border-top-color': '{ink}' } } }, { declaredStates: { hover: { transform: 'rotate(1deg)' } } },
    { stylesWhen: [{ prop: 'tone', equals: 'warm', styles: { left: '1px' } }] }, { animation: 'spin' }, { element: 'button' }]) {
    const c = contract(); Object.assign(leaf(c), patch); assert.ok(errorsOf(c).some(e => /stroked-path/.test(e)), JSON.stringify(patch));
  }
  for (const patch of [{ literals: { width: '20px', height: '16px', padding: '1px' } }, { layout: { display: 'flex' } },
    { stylesWhen: [{ prop: 'tone', equals: 'warm', styles: { height: '32px' } }] }, { declared: { position: 'absolute' } },
    { text: 'unrepresented content' }, { repeat: { prop: 'items' } }, { slot: { name: 'children' } }, { content: { prop: 'label' } }]) {
    const c = contract(); Object.assign(parent(c), patch); assert.ok(errorsOf(c).some(e => /stroked-path-parent/.test(e)));
  }
  const c = contract(), before = JSON.stringify(c), lowered = lowerStrokedPathPaint(c);
  assert.equal(JSON.stringify(c), before); assert.equal(leaf(lowered).literals!['stroke-width'], '1.25px');
  assert.equal(leaf(lowered).literalsByProp![0]!.map.warm!['stroke'], '#aa2200');
});

test('native compilation refuses a mismatched resolved parent basis before producing a write script', () => {
  const engine = createFigmaEngine({ tokens, icons: new Map() });
  const c = contract(); parent(c).literals!.width = '21px';
  assert.throws(() => engine.buildComponentScript(c, new Map([[c.id, c]])), /stroked-path-parent-basis-mismatch/);
  const d = contract(); parent(d).literals!.width = '100%';
  assert.throws(() => engine.buildComponentScript(d, new Map([[d.id, d]])), /stroked-path-parent-dimension-unsupported/);
});

test('stroke widths and viewport dimensions refuse invalid or context-relative measures, including resolved tokens', () => {
  for (const value of ['50%', '-1px', '0px', '2em', '1rem', 'inherit', '1000001px']) {
    const c = contract(); leaf(c).literals!['border-width'] = value;
    assert.ok(errorsOf(c).some(e => e.includes('stroked-path-width-unsupported')), value);
    const d = contract(); parent(d).literals!.width = value;
    assert.ok(errorsOf(d).some(e => e.includes('stroked-path-parent-dimension-unsupported')), value);
    const e = contract(); delete leaf(e).literals!['border-width']; leaf(e).tokens = { 'border-width': '{probe.width}' };
    const engine = createFigmaEngine({ tokens: { ...tokens, primitives: { probe: { width: { $type: 'dimension', $value: value } } } }, icons: new Map() });
    assert.throws(() => engine.buildComponentScript(e, new Map([[e.id, e]])), /stroked-path-width-unsupported/);
  }
  for (const value of ['inherit', 'currentColor']) {
    const c = contract(); leaf(c).literals!['border-color'] = value;
    assert.ok(errorsOf(c).some(e => e.includes('stroked-path-inherited-paint-unsupported')));
  }
});

test('inversion preserves complete strokes and refuses partial or changing centerline geometry', () => {
  const stroke = () => ({ name: 'Curve', type: 'VECTOR', shape: shape(), stroke: { hex: '334455' }, strokeWeight: 1.25, strokeAlign: 'CENTER' });
  const make = () => ({ setName: 'IndependentPath', type: 'COMPONENT_SET', variants: ['Tone=Cool', 'Tone=Warm'].map(name => ({ name, type: 'COMPONENT', variantProperties: { Tone: name.slice(5) }, layout: { mode: 'HORIZONTAL', primary: 'MIN', counter: 'MIN', spacing: 0, padding: [0, 0, 0, 0], primarySizing: 'AUTO', counterSizing: 'AUTO' }, children: [{ name: 'Viewport', type: 'FRAME', fixedSize: { width: 20, height: 16 }, children: [stroke()] }] })) });
  const propose = (dump: ReturnType<typeof make>) => proposeFromDump(dump as never, { corpus: tokenCorpusFromJson({ primitives: {}, semantic: {}, light: {}, brandDefault: {} }), contractIdByName: new Map(), fileKey: null, projectionMode: 'reviewable-inversion', mintUnbound: true });
  const complete = propose(make());
  assert.deepEqual(walkAnatomy(ContractSchema.parse(complete.contract)).find(w => w.part.shape)?.part.shape, shape());
  for (const mode of ['missing', 'different'] as const) {
    const dump = make(); const target = dump.variants[1]!.children[0]!.children[0]!;
    if (mode === 'missing') delete (target as Partial<typeof target>).shape;
    else target.shape.strokePath.data = 'M0 0L10 8L0 8';
    const proposed = propose(dump);
    assert.ok(proposed.notes.some(n => n.includes(mode === 'missing' ? 'stroked-path-incomplete-capture' : 'stroked-path-inconsistent-or-unsupported-geometry')), proposed.notes.join('\n'));
    assert.equal(walkAnatomy(ContractSchema.parse(proposed.contract)).some(w => w.part.shape?.kind === 'stroked-path'), false);
  }
});

test('all code surfaces emit the same safe path and paint; native vectors retain exact geometry and SCALE placement', () => {
  const c = contract(), contracts = new Map([[c.id, c]]), icons = new Map<string, string>();
  const module = emitReact(c, { contracts, icons, tokens: new Set() });
  const inline = emitReactInline(c, { contracts, icons, tokens });
  const html = emitHtml(c, { contracts, icons, tokens: new Set() });
  const wc = emitWebComponent(c, { contracts, icons, tokens: new Set() });
  for (const text of [module.tsx, inline.tsx, html.html, wc.element]) {
    assert.ok(text.includes(data)); assert.match(text, /non-scaling-stroke/); assert.match(text, /stroke-linejoin/);
  }
  for (const css of [module.css, html.css, wc.stylesheet]) {
    assert.match(css, /stroke-width: 1.25px/); assert.match(css, /stroke: #aa2200/);
  }
  const engine = createFigmaEngine({ tokens, icons });
  const script = engine.buildComponentScript(c, contracts);
  assert.match(script, /figma.createVector\(\)/); assert.match(script, /stroked-path-native-size-mismatch/);
  assert.match(script, /horizontal: 'SCALE', vertical: 'SCALE'/); assert.match(script, /if \(spec.strokeViewport\) node.layoutMode = 'NONE'/);
  const branchStart = script.indexOf("    if (spec.shape.kind === 'stroked-path') {"), branchEnd = script.indexOf('node.resize(spec.shape.width, spec.shape.height);', branchStart) + 'node.resize(spec.shape.width, spec.shape.height);'.length;
  const branch = script.slice(branchStart, branchEnd);
  for (const observed of [10, 10.01]) {
    let resized = false;
    const node = { id: 'probe:vector', width: observed, height: 8, resize: () => { resized = true; } };
    const run = () => vm.runInNewContext(branch, { node, spec: { shape: shape() }, Math });
    if (observed === 10) run(); else assert.throws(run, /stroked-path-native-size-mismatch/);
    assert.equal(resized, false);
  }
});

test('both React consumers render the original geometry and keep stroke weight through nonuniform resizing', async () => {
  const browser = await chromium.launch();
  try {
    // Only SVG's four ASCII whitespace separators are admitted. JavaScript's
    // broader \s also accepted NBSP/vertical tab, which render an empty path.
    const grammarPage = await browser.newPage();
    try {
      for (const separator of [' ', '\t', '\r', '\n']) {
        const geometry = shape(); geometry.strokePath.data = `M0${separator}0L5${separator}8L10${separator}2`;
        await grammarPage.setContent(strokedPathSvg(geometry));
        const box = await grammarPage.locator('path').evaluate(node => {
          const b = (node as SVGPathElement).getBBox(); return [b.x, b.y, b.width, b.height];
        });
        assert.deepEqual(box, [0, 0, 10, 8]);
      }
    } finally { await grammarPage.close(); }
    for (const surface of ['module', 'inline']) {
      const c = contract(), contracts = new Map([[c.id, c]]), icons = new Map<string, string>();
      const out = surface === 'module' ? emitReact(c, { contracts, icons, tokens: new Set() }) : { ...emitReactInline(c, { contracts, icons, tokens }), css: '' };
      const page = await browser.newPage();
      try {
        const render = await mountGenerated(page, c.name, out.tsx, out.css);
        for (const tone of ['cool', 'warm']) {
          await render({ tone });
          for (const [width, height] of [[20, 16], [40, 24], [10, 32]]) {
            const result = await page.locator('#root path').evaluate((p, size) => {
              const path = p as SVGPathElement, viewport = path.closest('svg')!.parentElement!.parentElement!;
              viewport.style.width = `${size[0]}px`; viewport.style.height = `${size[1]}px`;
              const b = path.getBoundingClientRect(), host = viewport.getBoundingClientRect(), s = getComputedStyle(path);
              return { x: b.x - host.x, y: b.y - host.y, width: b.width, height: b.height, stroke: s.stroke, weight: s.strokeWidth, effect: s.vectorEffect, fill: s.fill };
            }, [width, height]);
            assert.deepEqual([result.x, result.y, result.width, result.height].map(Math.fround), [2.375 * width! / 20, 3.125 * height! / 16, 10 * width! / 20, 8 * height! / 16].map(Math.fround), surface);
            assert.equal(result.weight, tone === 'cool' ? '1.25px' : '2px');
            assert.equal(result.stroke, tone === 'cool' ? 'rgb(51, 68, 85)' : 'rgb(170, 34, 0)');
            assert.equal(result.effect, 'non-scaling-stroke'); assert.equal(result.fill, 'none');
          }
        }
      } finally { await page.close(); }
    }
  } finally { await browser.close(); }
});
