import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { PNG } from 'pngjs';
import { ContractSchema, filledPathIssue, filledPathMask, lowerFilledPathVariants, shapeCssDecls, type Contract, type FilledPath } from '../scripts/contract-schema.js';
import { mapRestToDump, type RestNode } from '../extract/figma/rest/map.js';
import { proposeFromDump } from './propose-figma.js';
import { tokenCorpusFromJson } from './token-corpus.js';
import { validateContract, emitReact } from './emit-react.js';
import { emitReactInline } from './emit-react-inline.js';
import { mountGenerated } from './react-test-runtime.js';
import { createFigmaEngine } from './emit-figma-script.js';
import { walkAnatomy } from '../scripts/contract-schema.js';

const triangle = { data: 'M0 0L12 0L6 10Z', windingRule: 'NONZERO' as const };
const inset = { data: 'M0 0L12 0L12 10L0 10Z M3 3L9 3L9 7L3 7Z', windingRule: 'EVENODD' as const };
const badPaths = ['', 'M0 0', 'M0 0Z', 'M0 0L1Z', 'M0 0L1 2 M2 3L4 5Z', 'L0 0L1 2Z', 'M0 0H2V4Z', 'M0 0A2 2 0 1 1 4 4Z', 'm0 0l1 1z', 'M0 0L1e999 2Z', 'M0 0L1000001 2Z', 'M0 0L1 1Z<script>', 'M0 0L1 1Z" onload="x', 'M0 0L1 1Z; color:red'];
const plugin = readFileSync(new URL('../extract/figma/dump.plugin.js', import.meta.url), 'utf8');
const gateStart = plugin.indexOf('function filledPathIssue(data)');
const gateEnd = plugin.indexOf('function dumpShape(', gateStart);
const pluginGate = vm.runInNewContext(`${plugin.slice(gateStart, gateEnd)}; filledPathIssue`) as typeof filledPathIssue;

test('filled paths reject malformed, open, unsafe and approximated geometry in both readers', () => {
  for (const path of [triangle.data, inset.data, 'M0 0C1 -1 2 -1 3 0Q4 1 3 2L0 0Z', 'M0 0L1e-3 2Z', 'M0,0 L12,0 6,10Z']) {
    assert.equal(filledPathIssue(path), undefined, path);
    assert.equal(pluginGate(path), undefined, path);
  }
  for (const path of [...badPaths, ',M0 0L1 1Z', 'M,0 0L1 1Z', 'M0,,0L1 1Z', 'M0 0L1,1,Z', 'M0 0L1 1Z,']) {
    assert.ok(filledPathIssue(path), path);
    assert.equal(pluginGate(path), filledPathIssue(path), path);
    assert.throws(() => filledPathMask({ width: 12, height: 10, paths: [{ ...triangle, data: path }] }));
  }
});
const paint = [{ type: 'SOLID', color: { r: 0.2, g: 0.3, b: 0.4, a: 1 } }];
const vector = (path: FilledPath = triangle): RestNode => ({ id: '3:1', name: 'Mark', type: 'VECTOR', size: { x: 12, y: 10 }, relativeTransform: [[1, 0, 2.742499828338623], [0, 1, 4.242500305175781]], fillGeometry: [{ path: path.data, windingRule: path.windingRule }], fills: paint, strokes: [], effects: [], absoluteBoundingBox: { x: 0, y: 0, width: 12, height: 10 } });
const mapped = (nodes: RestNode[]) => mapRestToDump({ name: 'probe', nodes: { '1:1': { document: { id: '1:1', name: 'GeometryProbe', type: 'COMPONENT_SET', children: nodes.map((node, i) => ({ id: `2:${i}`, name: `Kind=${i ? 'Inset' : 'Triangle'}`, type: 'COMPONENT', children: [node], absoluteBoundingBox: { x: 0, y: 0, width: 20, height: 20 } })) } } } } as never);

test('REST carries original path bytes and fractional local placement, refusing unsupported paints and transforms', () => {
  const result = mapped([vector()]);
  const set = result.dump.GeometryProbe as never as { variants: Array<{ children: Array<{ shape: unknown }> }> };
  assert.deepEqual(set.variants[0]!.children[0]!.shape, { kind: 'path', width: 12, height: 10, paths: [triangle], x: 2.742499828338623, y: 4.242500305175781, right: 5.257500171661377, bottom: 5.757499694824219 });
  for (const patch of [{ fillGeometry: undefined }, { strokes: paint }, { fills: [...paint, ...paint] }, { effects: [{ type: 'DROP_SHADOW' }] }, { blendMode: 'MULTIPLY' }, { cornerRadius: 2 }, { fillGeometry: [vector().fillGeometry![0], vector().fillGeometry![0]] }, { relativeTransform: [[1, 0.1, 0], [0, 1, 0]] }, { fillGeometry: [{ path: 'M0 0H2Z', windingRule: 'NONZERO' }] }]) {
    const refused = mapped([{ ...vector(), ...patch } as RestNode]);
    assert.ok(refused.report.degradations.some((d) => d.code === 'vector-geometry-unsupported'));
  }
});

test('unsupported path paints cannot enter through conditional or state channels', () => {
  const patches = [
    { states: { hover: { 'border-color': '{ink}' } } },
    { tokensByProp: { prop: 'kind', map: { triangle: { 'box-shadow': '{ink}' }, inset: { 'box-shadow': '{ink}' } } } },
    { statesByProp: [{ prop: 'kind', state: 'hover', map: { triangle: { 'border-color': '{ink}' } } }] },
    { literalsByProp: [{ prop: 'kind', map: { triangle: { 'border-width': '1px' } } }] },
    { stylesWhen: [{ when: { kind: 'triangle' }, styles: { 'clip-path': 'none' } }] },
  ];
  for (const patch of patches) {
    const c = contract(); Object.assign(c.anatomy.root!.parts!.mark!, patch);
    assert.ok(errorsOf(c).some((e) => e.includes('filled-path-unsupported-paint-or-mask')), JSON.stringify(patch));
  }
  assert.equal(ContractSchema.safeParse({ ...contract(), anatomy: { root: { parts: { mark: { shape: { kind: 'path', width: 12, height: 10, paths: [triangle, inset] } } } } } }).success, false);
});

function contract(): Contract {
  return ContractSchema.parse({ id: 'probe.paths', name: 'PathProbe', version: '1.0.0', archetype: 'none', description: 'Bounded filled path conformance.', semantics: { element: 'div' },
    props: [{ name: 'kind', type: { enum: ['triangle', 'inset'] }, default: 'triangle', bindings: { code: { prop: 'kind' }, figma: { kind: 'VARIANT', property: 'Kind', values: { triangle: 'Triangle', inset: 'Inset' } } } }], states: [],
    anatomy: { root: { layout: { display: 'flex' }, parts: { mark: { shape: { kind: 'path', width: 12, height: 10, paths: [triangle], pathsByProp: { prop: 'kind', map: { triangle: { width: 12, height: 10, paths: [triangle] }, inset: { width: 12, height: 10, paths: [inset] } } } }, literals: { 'background-color': '#334455' } } } } },
    bindings: { code: { anchors: { importPath: './PathProbe', export: 'PathProbe' } }, figma: { anchors: { fileKey: null, componentSetKey: null } } },
  });
}
const errorsOf = (c: Contract) => { const errors: string[] = []; validateContract(c, new Map([[c.id, c]]), errors, new Map()); return errors; };

test('all enum values need geometry and non-path shapes cannot smuggle paths', () => {
  const c = contract(); assert.deepEqual(errorsOf(c), []);
  delete c.anatomy.root!.parts!.mark!.shape!.pathsByProp!.map.inset;
  assert.ok(errorsOf(c).some((e) => e.includes('filled-path-axis-coverage')));
  const d = contract(); d.anatomy.root!.parts!.mark!.shape!.kind = 'ellipse';
  assert.ok(errorsOf(d).some((e) => e.includes('filled-path-on-non-path-shape')));
});

test('structured variants lower without mutating the source and native scripts keep editable vectors', () => {
  const c = contract(); const before = JSON.stringify(c); const lowered = lowerFilledPathVariants(c);
  assert.equal(JSON.stringify(c), before);
  assert.equal(lowered.anatomy.root!.parts!.mark!.stylesWhen?.length, 2);
  assert.match(shapeCssDecls(c.anatomy.root!.parts!.mark!.shape!).join(';'), /data:image\/svg\+xml/);
  const engine = createFigmaEngine({ tokens: { primitives: {}, semantic: {}, light: {}, dark: {}, brands: { default: {} } }, icons: new Map() });
  const script = engine.buildComponentScript(c, new Map([[c.id, c]]));
  assert.match(script, /figma.createVector\(\)/);
  assert.match(script, /node.vectorPaths = spec.shape.paths/);
  assert.match(script, /filled-path-native-size-mismatch/);
  assert.ok(script.includes(triangle.data)); assert.ok(script.includes(inset.data));
  const start = script.indexOf("    if (spec.shape.kind === 'path') {");
  const end = script.indexOf('node.resize(spec.shape.width, spec.shape.height);', start) + 'node.resize(spec.shape.width, spec.shape.height);'.length;
  assert.ok(start >= 0 && end > start);
  const branch = script.slice(start, end);
  for (const [expected, observed, shouldRefuse] of [[12, 12, false], [12, 12.01, true], [12.515, Math.fround(12.515), false]] as const) {
    let resized = false;
    const node = { id: 'test:vector', width: observed, height: 10, vectorPaths: [], strokes: [], resize: () => { resized = true; } };
    const run = () => vm.runInNewContext(branch, { node, spec: { shape: { kind: 'path', width: expected, height: 10, paths: [triangle] } }, Math });
    if (shouldRefuse) assert.throws(run, /filled-path-native-size-mismatch:test:vector/); else run();
    assert.equal(resized, false, 'a path is never resized to hide a native geometry mismatch');
  }
});

test('an exact global child gate is retained even when its parent has the same gate', () => {
  const variants = ['Outer=Absent', 'Outer=Present'].map((name, i) => ({ id: `2:${i}`, name, type: 'COMPONENT', layoutMode: 'HORIZONTAL', children: i === 0 ? [] : [{ id: '4:1', name: 'Parent', type: 'FRAME', layoutMode: 'HORIZONTAL', children: [{ id: '5:1', name: 'Inner', type: 'FRAME', layoutMode: 'HORIZONTAL', children: [] }] }] }));
  const m = mapRestToDump({ name: 'probe', nodes: { '1:1': { document: { id: '1:1', name: 'GlobalGateProbe', type: 'COMPONENT_SET', children: variants } } } } as never);
  const p = proposeFromDump(m.dump.GlobalGateProbe as never, { corpus: tokenCorpusFromJson({ primitives: {}, semantic: {}, light: {}, brandDefault: {} }), contractIdByName: new Map(), fileKey: null, projectionMode: 'reviewable-inversion', mintUnbound: true });
  const parts = walkAnatomy(ContractSchema.parse(p.contract));
  const parent = parts.find(w => w.name === 'Parent');
  const child = parts.find(w => w.name === 'Inner');
  assert.ok(parent && child, JSON.stringify(parts));
  assert.deepEqual(child.part.visibleWhen, parent.part.visibleWhen);
  assert.deepEqual(child.part.visibleWhen, { prop: 'outer', equals: 'present' });
});

test('a child presence gate is scoped to the exact parent domain; both path variants survive', () => {
  const variants = ['Outer=Absent, Kind=Off', 'Outer=Absent, Kind=Triangle', 'Outer=Absent, Kind=Inset', 'Outer=Present, Kind=Off', 'Outer=Present, Kind=Triangle', 'Outer=Present, Kind=Inset'].map((name, i) => ({ id: `2:${i}`, name, type: 'COMPONENT', layoutMode: 'HORIZONTAL', children: i < 3 ? [] : [{ id: `4:${i}`, name: 'Parent', type: 'FRAME', layoutMode: 'HORIZONTAL', children: i === 3 ? [] : [{ id: `5:${i}`, name: 'GlyphBox', type: 'FRAME', layoutMode: 'NONE', absoluteBoundingBox: { x: 0, y: 0, width: 20, height: 20 }, children: [vector(i === 4 ? triangle : inset)] }] }] }));
  const m = mapRestToDump({ name: 'probe', nodes: { '1:1': { document: { id: '1:1', name: 'NestedProbe', type: 'COMPONENT_SET', children: variants } } } } as never);
  const p = proposeFromDump(m.dump.NestedProbe as never, { corpus: tokenCorpusFromJson({ primitives: {}, semantic: {}, light: {}, brandDefault: {} }), contractIdByName: new Map(), fileKey: null, projectionMode: 'reviewable-inversion', mintUnbound: true });
  const parsed = ContractSchema.parse(p.contract);
  const paths = walkAnatomy(parsed).filter((w) => w.part.shape?.kind === 'path');
  assert.equal(paths.length, 1, p.notes.join('\n'));
  assert.equal(paths[0]!.part.shape!.pathsByProp!.prop, 'kind');
  assert.ok(paths[0]!.part.stylesWhen!.some((s) => s.styles.left === '2.742499828338623px'), JSON.stringify(paths[0]!.part));
});


test('generated React surfaces render both path variants, including an evenodd hole', async () => {
  const browser = await chromium.launch();
  try {
    const c = contract(), contracts = new Map([[c.id, c]]), icons = new Map<string, string>();
    const tokens = { primitives: {}, semantic: {}, light: {}, dark: {}, brands: { default: {} } };
    for (const surface of ['module', 'inline']) {
      const page = await browser.newPage();
      try {
        const out = surface === 'module' ? emitReact(c, { contracts, icons, tokens: new Set() }) : { ...emitReactInline(c, { contracts, icons, tokens }), css: '' };
        const render = await mountGenerated(page, c.name, out.tsx, out.css);
        // CSS modules are identity-mapped by this fixture runtime; inline
        // parts use data-part, so select the actual leaf for both surfaces.
        const leaf = page.locator('#root > * > *');
        await render({ kind: 'triangle' });
        const a = await leaf.screenshot();
        const maskA = await leaf.evaluate((el) => getComputedStyle(el).maskImage);
        assert.match(decodeURIComponent(maskA), /M0 0L12 0L6 10Z/);
        await render({ kind: 'inset' });
        const b = await leaf.screenshot();
        const raster = PNG.sync.read(b);
        const pixel = (x: number, y: number) => Array.from(raster.data.subarray((y * raster.width + x) * 4, (y * raster.width + x) * 4 + 4));
        assert.deepEqual(pixel(6, 5), [255, 255, 255, 255], `${surface}: the evenodd hole exposes the page`);
        assert.deepEqual(pixel(1, 5), [51, 68, 85, 255], `${surface}: the surrounding path remains filled`);
        assert.notDeepEqual(a, b, `${surface}: the enum must change pixels`);
        const maskB = await leaf.evaluate((el) => getComputedStyle(el).maskImage);
        assert.match(decodeURIComponent(maskB), /fill-rule="evenodd"/);
        assert.match(decodeURIComponent(maskB), /M3 3L9 3L9 7L3 7Z/);
        const bounds = await leaf.boundingBox();
        assert.equal(bounds!.width, 12); assert.equal(bounds!.height, 10);
      } finally { await page.close(); }
    }
  } finally { await browser.close(); }
});
