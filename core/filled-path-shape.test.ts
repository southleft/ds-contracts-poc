import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { PNG } from 'pngjs';
import { ContractSchema, filledPathIssue, filledPathsIssue, filledPathMask, lowerFilledPathVariants, shapeCssDecls, type Contract, type FilledPath } from '../scripts/contract-schema.js';
import { mapRestToDump, type RestNode } from '../extract/figma/rest/map.js';
import { proposeFromDump } from './propose-figma.js';
import { tokenCorpusFromJson } from './token-corpus.js';
import { validateContract, emitReact } from './emit-react.js';
import { emitReactInline } from './emit-react-inline.js';
import { mountGenerated, generatedTypeErrors } from './react-test-runtime.js';
import { createFigmaEngine } from './emit-figma-script.js';
import { walkAnatomy } from '../scripts/contract-schema.js';
import { fetchObservation } from '../sync/observe.js';
import { nativeFilledPathMatches, nativeFilledPathResizeMatches, lowerNativeFilledPath } from './native-filled-path.js';

test('native normalization preserves an exact zero endpoint at a float32 origin',()=>{
 const fixture=JSON.parse(readFileSync(new URL('../extract/figma/fixtures/filled-path-native-origin.json',import.meta.url),'utf8'));
 for(const state of fixture.states){
  assert(nativeFilledPathMatches(fixture.shape,state.paths,state.x,state.y));
  const moved=structuredClone(state.paths);
  moved[0].data=moved[0].data.replace('L 0 6.', 'L 0.00000001 6.');
  assert.notEqual(moved[0].data,state.paths[0].data);
  assert(!nativeFilledPathMatches(fixture.shape,moved,state.x,state.y));
  assert(!nativeFilledPathMatches(fixture.shape,state.paths,state.x+0.0001,state.y));
 }
});

const triangle = { data: 'M0 0L12 0L6 10Z', windingRule: 'NONZERO' as const };
const inset = { data: 'M0 0L12 0L12 10L0 10Z M3 3L9 3L9 7L3 7Z', windingRule: 'EVENODD' as const };
const badPaths = ['', 'M0 0', 'M0 0Z', 'M0 0L1Z', 'M0 0L1 2 M2 3L4 5Z', 'L0 0L1 2Z', 'M0 0H2V4Z', 'M0 0A2 2 0 1 1 4 4Z', 'm0 0l1 1z', 'M0 0L1e999 2Z', 'M0 0L1000001 2Z', 'M0 0L1 1Z<script>', 'M0 0L1 1Z" onload="x', 'M0 0L1 1Z; color:red'];
const plugin = readFileSync(new URL('../extract/figma/dump.plugin.js', import.meta.url), 'utf8');
const gateStart = plugin.indexOf('function filledPathIssue(data)');
const gateEnd = plugin.indexOf('function dumpShape(', gateStart);
const pluginGate = vm.runInNewContext(`${plugin.slice(gateStart, gateEnd)}; filledPathIssue`) as typeof filledPathIssue;

test('native path comparison accounts for explicit closure, rebased points and float32 curve handles', () => {
  const matches = (source: string, observed: string, x = 0, y = 0) => nativeFilledPathMatches(
    { kind: 'path', width: 12, height: 10, paths: [{ data: source, windingRule: 'NONZERO' }] },
    [{ data: observed, windingRule: 'NONZERO' }], x, y);
  assert(matches('M0,0 12,0 6,10Z', 'M 0 0 L 12 0 L 6 10 L 0 0 Z'));
  assert(matches('M3 3L9 3L6 7Z', 'M 0 0 L 6 0 L 3 4 L 0 0 Z', 3, 3));
  // Captured from the native quadratic probe, not computed by the comparator.
  assert(matches('M0 0Q6 10 12 0L0 0Z', 'M 0 0 C 4 6.666666507720947 8 6.666666507720947 12 0 L 0 0 Z'));
  for (const changed of ['M0 0L12 0L5 10Z', 'M0 0L12 0L6 10', 'M0 0L6 10L12 0Z', 'M0 0L12 0L6 10Z M0 0L1 0L0 1Z'])
    assert(!matches(triangle.data, changed), changed);
  assert(!matches(triangle.data, triangle.data, 0.125));
  assert(!matches('M0 0Q6 10 12 0L0 0Z', 'M0 0C4 6.66 8 6.666666507720947 12 0L0 0Z'));
  assert(!nativeFilledPathMatches({ kind: 'path', width: 12, height: 10, paths: [triangle] }, [{...triangle,windingRule:'EVENODD'}], 0, 0));
  assert(!nativeFilledPathMatches({ kind: 'path', width: 12, height: 10, paths: [triangle] }, [triangle, triangle], 0, 0));
});

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
const vector = (path: FilledPath & {windingRule:'NONZERO'|'EVENODD'} = triangle): RestNode => ({ id: '3:1', name: 'Mark', type: 'VECTOR', size: { x: 12, y: 10 }, relativeTransform: [[1, 0, 2.742499828338623], [0, 1, 4.242500305175781]], fillGeometry: [{ path: path.data, windingRule: path.windingRule }], fills: paint, strokes: [], effects: [], absoluteBoundingBox: { x: 0, y: 0, width: 12, height: 10 } });
const mapped = (nodes: RestNode[]) => mapRestToDump({ name: 'probe', nodes: { '1:1': { document: { id: '1:1', name: 'GeometryProbe', type: 'COMPONENT_SET', children: nodes.map((node, i) => ({ id: `2:${i}`, name: `Kind=${i ? 'Inset' : 'Triangle'}`, type: 'COMPONENT', children: [node], absoluteBoundingBox: { x: 0, y: 0, width: 20, height: 20 } })) } } } } as never);

test('REST carries original path bytes and fractional local placement, refusing unsupported paints and transforms', () => {
  const result = mapped([vector()]);
  const set = result.dump.GeometryProbe as never as { variants: Array<{ children: Array<{ shape: unknown }> }> };
  assert.deepEqual(set.variants[0]!.children[0]!.shape, { kind: 'path', width: 12, height: 10, paths: [triangle], x: 2.742499828338623, y: 4.242500305175781, right: 5.257500171661377, bottom: 5.757499694824219 });
  for (const patch of [{ fillGeometry: undefined }, { strokes: paint }, { fills: [...paint, ...paint] }, { effects: [{ type: 'DROP_SHADOW' }] }, { blendMode: 'MULTIPLY' }, { cornerRadius: 2 }, { fillGeometry: [vector().fillGeometry![0], {path:'M0 0Z',windingRule:'NONZERO'}] }, { relativeTransform: [[1, 0.1, 0], [0, 1, 0]] }, { fillGeometry: [{ path: 'M0 0H2Z', windingRule: 'NONZERO' }] }]) {
    const refused = mapped([{ ...vector(), ...patch } as RestNode]);
    assert.ok(refused.report.degradations.some((d) => d.code === 'vector-geometry-unsupported'));
  }
});

test('REST and plugin readers preserve supported mask paths and refuse unsupported mask kinds', () => {
  const end = plugin.indexOf('const capturedVariables', gateEnd);
  assert.ok(end > gateEnd);
  const pluginShape = vm.runInNewContext(`${plugin.slice(gateStart, end)}; dumpShape`) as (node: unknown, parent: unknown) => unknown;
  const pluginNode = { ...vector(), width: 12, height: 10, vectorPaths: [triangle] };
  for (const isMask of [undefined, false]) {
    const result = mapped([{ ...vector(), isMask }]);
    assert.equal((result.dump.GeometryProbe as any).variants[0].children[0].shape.kind, 'path');
    assert.ok(pluginShape({ ...pluginNode, isMask }, null));
  }
  for (const [isMask, maskType] of [[true, 'ALPHA'], [true, 'VECTOR'], [true, 'LUMINANCE'], [null, 'ALPHA'], ['false', 'ALPHA']] as const) {
    const input = { ...vector(), isMask, maskType } as RestNode;
    const before = JSON.stringify(input);
    const result = mapped([input]);
    assert.equal(JSON.stringify(input), before, 'captured evidence stays unchanged');
    const node=(result.dump.GeometryProbe as any).variants[0].children[0];
    if(isMask===true && ['ALPHA','VECTOR'].includes(maskType)){
      assert.equal(node.mask.type,maskType);assert.deepEqual(node.shape.paths,[triangle]);
      assert.ok(pluginShape({...pluginNode,isMask,maskType},null));continue;
    }
    assert.equal(node.shape, undefined);
    assert.ok(result.report.degradations.some(d => d.code === 'vector-mask-unsupported'));
    assert.ok(result.report.degradations.some(d => d.code === 'vector-geometry-unsupported'));
    assert.equal(pluginShape({ ...pluginNode, isMask, maskType }, null), null);
  }
});

test('live sync observation detects a path-only edit with unchanged bounds and stamp', async () => {
  let currentPath = triangle;
  const fetchImpl = async (url: string) => {
    const u = new URL(url);
    if (!u.pathname.endsWith('/nodes')) return new Response(JSON.stringify({ version: '1' }));
    assert.equal(u.searchParams.get('plugin_data'), 'shared');
    const mark = vector(currentPath);
    if (u.searchParams.get('geometry') !== 'paths') delete mark.fillGeometry;
    return new Response(JSON.stringify({ name: 'Probe', nodes: { '1:1': { document: {
      id: '1:1', name: 'PathProbe', type: 'COMPONENT_SET',
      sharedPluginData: { ds_contracts: { canvasFingerprint: 'v6:unchanged' } },
      children: [{ id: '2:1', name: 'State=Default', type: 'COMPONENT',
        absoluteBoundingBox: { x: 0, y: 0, width: 20, height: 20 }, children: [mark] }],
    } } } }));
  };
  const before = await fetchObservation('synthetic', ['1:1'], 'test-only', { fetchImpl });
  currentPath = { ...triangle, data: 'M0 0L12 0L12 10Z' };
  const after = await fetchObservation('synthetic', ['1:1'], 'test-only', { fetchImpl });
  assert.equal(before.observations.length, 1);
  assert.equal(after.observations.length, 1);
  assert.equal(before.observations[0]!.stamp, after.observations[0]!.stamp);
  assert.notEqual(before.observations[0]!.dumpFingerprint, after.observations[0]!.dumpFingerprint);
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
  assert.equal(ContractSchema.safeParse({ ...contract(), anatomy: { root: { parts: { mark: { shape: { kind: 'path', width: 12, height: 10, paths: Array.from({length:33},()=>triangle) } } } } } }).success, false);
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
  assert.ok(paths.length > 0, p.notes.join('\n'));
  const tokens={primitives:p.mintedTokens!.tree,semantic:{},light:{},dark:{},brands:{default:{}}};
  const data=createFigmaEngine({tokens,icons:new Map()}).compileComponentData(parsed,new Map([[parsed.id,parsed]]));
  assert.equal(data.variants.length,6);
  for(const row of data.variants){
    const actual:unknown[]=[];const walk=(node:any)=>{if(node.shape?.kind==='path')actual.push(node.shape.paths);for(const child of node.children??[])walk(child);};walk(row.spec);
    const visible=row.name.includes('Outer=Present')&&!row.name.includes('Kind=Off');
    assert.deepEqual(actual,visible?[row.name.includes('Kind=Triangle')?[triangle]:[inset]]:[],row.name);
  }
  assert(paths.some(w=>w.part.stylesWhen?.some(s=>s.styles.left==='2.742499828338623px')),JSON.stringify(paths));
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
        const leaf = page.locator('#root > * > :not(svg)');
        await render({ kind: 'triangle' });
        const a = await leaf.screenshot();
        const maskA = await page.locator('#root clipPath path').evaluateAll(paths => paths.map(p => p.getAttribute('d')).join(' '));
        assert.match(decodeURIComponent(maskA), /M0 0L12 0L6 10Z/);
        await render({ kind: 'inset' });
        const b = await leaf.screenshot();
        const raster = PNG.sync.read(b);
        const pixel = (x: number, y: number) => Array.from(raster.data.subarray((y * raster.width + x) * 4, (y * raster.width + x) * 4 + 4));
        assert.deepEqual(pixel(6, 5), [255, 255, 255, 255], `${surface}: the evenodd hole exposes the page`);
        assert.deepEqual(pixel(1, 5), [51, 68, 85, 255], `${surface}: the surrounding path remains filled`);
        assert.notDeepEqual(a, b, `${surface}: the enum must change pixels`);
        const maskB = await page.locator('#root clipPath').evaluate(el => el.innerHTML);
        assert.match(decodeURIComponent(maskB), /clip-rule="evenodd"/);
        assert.match(decodeURIComponent(maskB), /M3 3L9 3L9 7L3 7Z/);
        const bounds = await leaf.boundingBox();
        assert.equal(bounds!.width, 12); assert.equal(bounds!.height, 10);
      } finally { await page.close(); }
    }
  } finally { await browser.close(); }
});

test('multiple ordered regions survive readers, schema, native lowering and exact readback comparison',()=>{
 const paths=[{data:'M0 0L4 0L4 4L0 4Z',windingRule:'NONZERO' as const},{data:'M8 6L12 6L12 10L8 10Z',windingRule:'EVENODD' as const}];
 const node={...vector(),fillGeometry:paths.map(p=>({path:p.data,windingRule:p.windingRule}))};
 const dump=mapped([node]);assert.deepEqual((dump.dump.GeometryProbe as any).variants[0].children[0].shape.paths,paths);
 const c=contract();delete c.anatomy.root.parts!.mark!.shape!.pathsByProp;c.anatomy.root.parts!.mark!.shape!.paths=paths;
 assert.equal(ContractSchema.safeParse(c).success,true);assert.deepEqual(errorsOf(c),[]);
 const specs=createFigmaEngine({tokens:{primitives:{},semantic:{},light:{},dark:{},brands:{default:{}}},icons:new Map()}).compileComponentData(c,new Map([[c.id,c]])).variants;
 const leaf=specs[0].spec.children![0];assert.equal(leaf.nativePathViewport,true);assert.deepEqual(leaf.lits,{width:12,height:10});assert.deepEqual(leaf.children![0].shape!.paths,paths);
 const wanted={kind:'path' as const,width:12,height:10,paths};
 assert(nativeFilledPathMatches(wanted,paths,0,0));
 assert(!nativeFilledPathMatches(wanted,paths.slice(0,1),0,0));
 assert(!nativeFilledPathMatches(wanted,[paths[1],paths[0]],0,0));
 assert(!nativeFilledPathMatches(wanted,[paths[0],{...paths[1],data:'M8 6L12 6L12 9.9L8 10Z'}],0,0));
 assert(!nativeFilledPathMatches(wanted,[paths[0],{...paths[1],windingRule:'NONZERO'}],0,0));
});

test('both React surfaces draw two distinct filled regions and preserve their empty gap',async()=>{
 const browser=await chromium.launch();
 try{
  const c=contract(),shape=c.anatomy.root.parts!.mark!.shape!;delete shape.pathsByProp;
  shape.paths=[{data:'M0 0L4 0L4 10L0 10Z',windingRule:'NONZERO'},{data:'M8 0L12 0L12 10L8 10Z',windingRule:'EVENODD'}];
  const contracts=new Map([[c.id,c]]),icons=new Map<string,string>(),tokens={primitives:{},semantic:{},light:{},dark:{},brands:{default:{}}};
  for(const surface of ['module','inline']){
   const page=await browser.newPage();try{
    const out=surface==='module'?emitReact(c,{contracts,icons,tokens:new Set()}):{...emitReactInline(c,{contracts,icons,tokens}),css:''};
    await mountGenerated(page,c.name,out.tsx,out.css);const leaf=page.locator('#root > * > :not(svg)');const image=PNG.sync.read(await leaf.screenshot());
    const pixel=(x:number)=>Array.from(image.data.subarray((5*image.width+x)*4,(5*image.width+x)*4+4));
    assert.deepEqual(pixel(1),[51,68,85,255],surface);assert.deepEqual(pixel(6),[255,255,255,255],surface);assert.deepEqual(pixel(10),[51,68,85,255],surface);
   }finally{await page.close();}
  }
 }finally{await browser.close();}
});


test('closed NONE contours retain their native winding only with a convex single-contour proof', () => {
  const pluginPathsGate = vm.runInNewContext(`${plugin.slice(gateStart, gateEnd)}; filledPathsIssue`) as typeof filledPathsIssue;
  const shapeEnd = plugin.indexOf('const capturedVariables', gateEnd);
  const pluginShape = vm.runInNewContext(`${plugin.slice(gateStart, shapeEnd)}; dumpShape`) as (node: unknown, parent: unknown) => any;
  const accepted = [
    'M 0 0 L 161 0 L 161 10 L 0 10 L 0 0 Z',
    'M 0 0 L 53.66666793823242 0 L 53.66666793823242 10 L 0 10 L 0 0 Z',
    'M0 0L12 0L6 10Z', 'M6 10L12 0L0 0Z',
    'M0 0 12 0 6 10Z',
  ];
  for (const data of accepted) {
    const paths: FilledPath[] = [{data,windingRule:'NONE'}];
    assert.equal(filledPathsIssue(paths), undefined, data);
    assert.equal(pluginPathsGate(paths), undefined, data);
    const node = {...vector(), width:161,height:10,vectorPaths:paths};
    const captured = pluginShape(node, null);
    assert.equal(captured.paths[0].windingRule, 'NONE');assert.equal(captured.paths[0].data,data);
    const mask=filledPathMask({width:161,height:10,paths});
    assert.ok(mask.includes(encodeURIComponent('fill-rule="nonzero"')));
    assert(nativeFilledPathMatches({kind:'path',width:161,height:10,paths},paths,0,0));
    assert(!nativeFilledPathMatches({kind:'path',width:161,height:10,paths},[{data,windingRule:'NONZERO'}],0,0));
  }
  const refused = [
    'M0 0L12 0L6 10', 'M0 0Q6 10 12 0L0 0Z',
    'M0 0L12 0L4 4L12 10L0 10Z', 'M0 0L12 10L0 10L12 0Z',
    'M0 0L12 0L12 10L0 10Z M3 3L9 3L9 7L3 7Z',
    'M0 0L12 0L6 10L12 0Z', 'M0 0L6 0L12 0Z',
    'M0 0L12.1 0L6 10Z',
    'M0 3L12 3L2 10L6 0L10 10Z',
  ];
  for(const data of refused){
    const paths:FilledPath[]=[{data,windingRule:'NONE'}];
    assert.ok(filledPathsIssue(paths),data);assert.equal(pluginPathsGate(paths),filledPathsIssue(paths),data);
    assert.throws(()=>filledPathMask({width:161,height:10,paths}));
    assert.equal(pluginShape({...vector(),width:161,height:10,vectorPaths:paths},null),null);
    const c=contract();c.anatomy.root!.parts!.mark!.shape!.paths=paths;
    assert.equal(ContractSchema.safeParse(c).success,false,data);
  }
  for(const invalid of [[null],[{}],[42],[{data:triangle.data,windingRule:'UNKNOWN'}]]){
    assert.ok(filledPathsIssue(invalid as any));assert.equal(pluginPathsGate(invalid as any),filledPathsIssue(invalid as any));
    assert.equal(nativeFilledPathResizeMatches(invalid,invalid,1,1),false);
  }
  const mixed:FilledPath[]=[{data:accepted[0]!,windingRule:'NONE'},triangle];
  assert.equal(filledPathsIssue(mixed),'filled-path-none-multiple-contours');
  assert.throws(()=>filledPathMask({width:161,height:10,paths:mixed}));
  const c=contract();const shape=c.anatomy.root!.parts!.mark!.shape!;
  shape.paths=[{data:triangle.data,windingRule:'NONE'}];delete shape.pathsByProp;
  assert.equal(ContractSchema.safeParse(c).success,true);assert.deepEqual(errorsOf(c),[]);
  const engine=createFigmaEngine({tokens:{primitives:{},semantic:{},light:{},dark:{},brands:{default:{}}},icons:new Map()});
  const script=engine.buildComponentScript(c,new Map([[c.id,c]]));
  assert.match(script,/"windingRule"\s*:\s*"NONE"/);
});


test('both generated React surfaces match the actual native closed NONE rectangle raster', async () => {
  const native = PNG.sync.read(readFileSync(new URL('./fixtures/closed-none-rectangle-native.png', import.meta.url)));
  assert.equal(native.width,161);assert.equal(native.height,10);
  const browser=await chromium.launch();
  try{
    const c=contract(),shape=c.anatomy.root!.parts!.mark!.shape!;
    delete shape.pathsByProp;shape.width=161;shape.height=10;
    shape.paths=[{data:'M 0 0 L 161 0 L 161 10 L 0 10 L 0 0 Z',windingRule:'NONE'}];
    c.anatomy.root!.parts!.mark!.literals={'background-color':'#e8e8e8'};
    const contracts=new Map([[c.id,c]]),icons=new Map<string,string>(),tokens={primitives:{},semantic:{},light:{},dark:{},brands:{default:{}}};
    for(const surface of ['module','inline']){
      const page=await browser.newPage();try{
        const out=surface==='module'?emitReact(c,{contracts,icons,tokens:new Set()}):{...emitReactInline(c,{contracts,icons,tokens}),css:''};
        await mountGenerated(page,c.name,out.tsx,out.css);
        for(const background of ['white','black']){
          await page.addStyleTag({content:`body{background:${background}}`});
          const actual=PNG.sync.read(await page.locator('#root > * > :not(svg)').screenshot());
          assert.equal(actual.width,native.width);assert.equal(actual.height,native.height);
          assert.deepEqual(actual.data,native.data,`${surface} on ${background}: actual native filled NONE pixels`);
        }
      }finally{await page.close();}
    }
  }finally{await browser.close();}
});

test('native convexity gate works without BigInt and matches the exact integer oracle',()=>{
 const portable=vm.runInNewContext(`${plugin.slice(gateStart,gateEnd)}; filledPathsIssue`,{BigInt:undefined}) as typeof filledPathsIssue;
 type Point=[number,number];
 const oracle=(points:Point[])=>{
  const p=points.map(point=>point.map(value=>BigInt(value*2**149)));
  let direction=0;
  for(let i=0;i<p.length;i++)for(let j=0;j<p.length;j++){
   if(j===i||j===(i+1)%p.length)continue;
   const a=p[i]!,b=p[(i+1)%p.length]!,c=p[j]!;
   const determinant=(b[0]!-a[0]!)*(c[1]!-a[1]!)-(b[1]!-a[1]!)*(c[0]!-a[0]!);
   const sign=determinant===0n?0:determinant>0n?1:-1;
   if(!sign||(direction&&direction!==sign))return false;
   direction=sign;
  }
  return true;
 };
 const tiny=2**-149,large=2**19;
 const cases:Point[][]=[[[0,0],[1,1],[2,2]],[[-large,-large],[large,large],[tiny,0]],[[-large,-large],[tiny,0],[large,large]],[[0,0],[tiny,0],[0,tiny]]];
 const [a,b,c]=cases[1]!;
 assert.equal((b![0]-a![0])*(c![1]-a![1])-(b![1]-a![1])*(c![0]-a![0]),0,'ordinary double determinant loses this nonzero orientation');
 assert.equal(oracle(cases[1]!),true);
 let seed=0x51a77e;const buffer=new ArrayBuffer(4),view=new DataView(buffer);
 const coordinate=()=>{for(;;){seed=(Math.imul(seed,1664525)+1013904223)>>>0;view.setUint32(0,seed);const value=view.getFloat32(0);if(Number.isFinite(value)&&Math.abs(value)<=1e6)return value;}};
 for(let i=0;i<6000;i++)cases.push(Array.from({length:i<5000?3:4+i%5},()=>[coordinate(),coordinate()] as Point));
 for(const points of cases){
  const paths:FilledPath[]=[{data:'M'+points.map(p=>p.join(' ')).join('L')+'Z',windingRule:'NONE'}];
  const expected=oracle(points);
  assert.equal(filledPathsIssue(paths)===undefined,expected,paths[0]!.data);
  assert.equal(portable(paths)===undefined,expected,paths[0]!.data+' sandbox');
 }
});

test('scaled filled paths retain a painted parent plane on both React surfaces and native specs', async () => {
  const c=contract(); c.props=[];
  c.anatomy.root={declared:{position:'relative'},literals:{width:'24px',height:'24px','background-color':'#eebb88'},parts:{ink:{
    literals:{'background-color':'#224466'},shape:{kind:'path',width:12,height:10,paths:[inset],parentViewport:{width:24,height:24,x:3,y:4}}
  }}};
  assert.deepEqual(errorsOf(c),[]);
  const contracts=new Map([[c.id,c]]),icons=new Map(),tokens={primitives:{},semantic:{},light:{},dark:{},brands:{default:{}}};
  const native=createFigmaEngine({tokens,icons}).compileComponentData(c,contracts).variants[0]!.spec;
  assert.deepEqual(native.lits?.fillColor,{r:238/255,g:187/255,b:136/255});
  assert.equal(native.scalablePathParent,true);
  assert.deepEqual(native.children?.[0]?.absolute,{h:'MIN',v:'MIN',left:3,top:4});
  Object.assign(c.anatomy.root!.literals!,{'padding-top':'0px','padding-right':'0px','padding-bottom':'0px','padding-left':'0px'});
  const browser=await chromium.launch();
  try {
    for(const surface of ['module','inline'])for(const size of [24,48]) {
      const code=surface==='module'?emitReact(c,{contracts,icons,tokens:new Set()}):{...emitReactInline(c,{contracts,icons,tokens}),css:''};
      const page=await browser.newPage({viewport:{width:size,height:size}});
      await mountGenerated(page,c.name,code.tsx,code.css);
      await page.addStyleTag({content:`body{margin:0}#root>*{width:${size}px!important;height:${size}px!important}`});
      const actual=PNG.sync.read(await page.screenshot());
      await page.setContent(`<style>body{margin:0}</style><svg width="${size}" height="${size}" viewBox="0 0 24 24"><rect width="24" height="24" fill="#eebb88"/><path d="${inset.data}" transform="translate(3 4)" fill-rule="evenodd" fill="#224466"/></svg>`);
      const expected=PNG.sync.read(await page.screenshot());
      assert.deepEqual(actual.data,expected.data,`${surface} ${size}: background, scaled path and origin`);
      await page.close();
    }
  } finally {await browser.close();}
  const rejected=structuredClone(c);rejected.anatomy.root!.literals!['padding']='2px';
  assert(errorsOf(rejected).some(e=>e.includes('filled-path-parent-channel-unsupported:padding')));
});

test('captured vector branches retain their own path bytes and never substitute for uncaptured geometry',()=>{
 const variants=['Triangle','Inset','Uncaptured'].map((kind,i)=>({id:`2:${i}`,name:`Kind=${kind}`,variantProperties:{Kind:kind},type:'COMPONENT',absoluteBoundingBox:{x:0,y:0,width:20,height:20},children:[kind==='Uncaptured'?{...vector(),fillGeometry:undefined}:vector(kind==='Triangle'?triangle:inset)]}));
 const input={name:'partition',nodes:{'1:1':{document:{id:'1:1',name:'PartitionProbe',type:'COMPONENT_SET',componentPropertyDefinitions:{Kind:{type:'VARIANT',defaultValue:'Triangle',variantOptions:['Triangle','Inset','Uncaptured']}},children:variants}}}};
 const mapped=mapRestToDump(input as never),dump=mapped.dump.PartitionProbe as any,before=JSON.stringify(dump);
 const p=proposeFromDump(dump,{corpus:tokenCorpusFromJson({primitives:{},semantic:{},light:{},brandDefault:{}}),contractIdByName:new Map(),mintUnbound:true,stampsObservable:true});
 assert.equal(JSON.stringify(dump),before);assert.equal(p.projection.status,'verified-exact');
 const c=ContractSchema.parse(p.contract),tokens={primitives:p.mintedTokens!.tree,semantic:{},light:{},dark:{},brands:{default:{}}};
 const compiled=createFigmaEngine({tokens,icons:new Map()}).compileComponentData(c,new Map([[c.id,c]]));
 assert.equal(compiled.variants.length,3);
 for(const row of compiled.variants){
  const paths:unknown[]=[];const walk=(node:any)=>{if(node.shape?.kind==='path')paths.push(node.shape.paths);for(const child of node.children??[])walk(child);};walk(row.spec);
  const expected=row.name.includes('Uncaptured')?[]:[row.name.includes('Triangle')?[triangle]:[inset]];
  assert.deepEqual(paths,expected,row.name);
 }
 assert(mapped.report.degradations.some(d=>d.code==='vector-geometry-unsupported'));
});

 test('native path viewport preserves declared bounds independently of decimal path ink',()=>{
 const c=contract(),part=c.anatomy.root.parts!.mark!;delete part.shape!.pathsByProp;part.shape!.height=10.000019;part.shape!.paths=[triangle];part.literals={...part.literals,opacity:'0.5'};
 const before=JSON.stringify(c);const engine=createFigmaEngine({tokens:{primitives:{},semantic:{},light:{},dark:{},brands:{default:{}}},icons:new Map()});
 const data=engine.compileComponentData(c,new Map([[c.id,c]]));assert.equal(JSON.stringify(c),before);
 for(const variant of data.variants){const viewport=variant.spec.children![0];assert.equal(viewport.nativePathViewport,true);assert.equal(viewport.lits!.height,10.000019);assert.equal(viewport.opacity,0.5);assert.deepEqual(viewport.children![0].shape!.paths,[triangle]);assert(nativeFilledPathMatches(viewport.children![0].shape,[triangle],0,0));}
 });


test('filled path generated packages typecheck constant and prop-selected geometry',()=>{
 for(const dynamic of [false,true])for(const name of ['PathProbe','Error']){
  const c=contract();c.name=name;if(!dynamic)delete c.anatomy.root.parts!.mark!.shape!.pathsByProp;
  const contracts=new Map([[c.id,c]]),icons=new Map<string,string>();
  const tokens={primitives:{},semantic:{},light:{},dark:{},brands:{default:{}}};
  for(const surface of ['module','inline']){
   const out=surface==='module'?emitReact(c,{contracts,icons,tokens:new Set()}):emitReactInline(c,{contracts,icons,tokens});
   assert.deepEqual(generatedTypeErrors(c.name,out.tsx),[],surface+' dynamic='+dynamic);
  }
 }
});


test('nested boolean visibility keeps unreachable geometry type-safe without changing rendered states', async () => {
  const c = contract();
  c.props.push({name:'checked',type:'boolean',default:false,bindings:{code:{prop:'checked'},figma:{kind:'BOOLEAN',property:'Checked'}}});
  const mark = c.anatomy.root.parts!.mark!;
  c.anatomy.root.parts = {outer:{visibleWhen:{prop:'checked'},parts:{
    hidden:{...structuredClone(mark),visibleWhen:{prop:'checked',equals:false}},
    shown:{...structuredClone(mark),visibleWhen:{prop:'checked',equals:true}},
  }}};
  const browser = await chromium.launch();
  try {
    for (const surface of ['module','inline']) {
      const contracts = new Map([[c.id,c]]), icons = new Map<string,string>();
      const tokens = {primitives:{},semantic:{},light:{},dark:{},brands:{default:{}}};
      const out = surface === 'module' ? emitReact(c,{contracts,icons,tokens:new Set()}) : {...emitReactInline(c,{contracts,icons,tokens}),css:''};
      assert.deepEqual(generatedTypeErrors(c.name,out.tsx),[],surface);
      const page = await browser.newPage();
      try {
        const render = await mountGenerated(page,c.name,out.tsx,out.css);
        for (const checked of [false,true,false]) {
          await render({checked,kind:'triangle'});
          assert.equal(await page.locator('#root clipPath').count(),checked ? 1 : 0,surface);
        }
      } finally { await page.close(); }
    }
  } finally { await browser.close(); }
});
