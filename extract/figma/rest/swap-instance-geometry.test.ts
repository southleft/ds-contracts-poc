import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { mapRestToDump, REST_DUMP_VERSION, type RestNode } from './map.js';
import type { DumpFixedSwap, DumpSet } from '../types.js';
import { createFigmaMock } from '../../../scripts/plugin-engine-mock-figma.mjs';
import { chromium } from 'playwright-core';
import { proposeFromDump } from '../../../core/propose-figma.js';
import { tokenCorpusFromJson } from '../../../core/token-corpus.js';
import { tokenInventoryFromJson } from '../../../core/tokens.js';
import { mintedTokenCss } from '../../../core/mint-tokens.js';
import { emitReact } from '../../../core/emit-react.js';
import { mountGenerated } from '../../../core/react-test-runtime.js';
import { ContractSchema } from '../../../scripts/contract-schema.js';

const plugin = readFileSync(new URL('../dump.plugin.js', import.meta.url), 'utf8');
const capturePlugin = vm.runInNewContext(`${plugin.slice(plugin.indexOf('async function dumpSwapInstances('), plugin.indexOf('async function dumpNode('))}; dumpSwapInstances`) as
  (root: unknown, property: string) => Promise<DumpFixedSwap['observedInstances']>;
const property = 'Content#101:3';
const leaf = (id: string, ref = property): RestNode => ({
  id, name: 'Display names do not identify content', type: 'INSTANCE', componentId: '3:1',
  componentPropertyReferences: { mainComponent: ref },
  size: { x: 12.125, y: 9.375 }, relativeTransform: [[1, 0, 1.124997854232788], [0, 1, 2.375]],
  constraints: { horizontal: 'SCALE', vertical: 'SCALE' }, children: [],
});
const fixture = (): RestNode => ({
  id: '2:1', name: 'Host', type: 'INSTANCE', componentId: '2:0', size: { x: 20.25, y: 16.875 },
  componentProperties: { [property]: { type: 'INSTANCE_SWAP', value: '3:1' } },
  children: [leaf('4:1'), leaf('4:2', 'Content#different'), {
    id: '4:3', name: 'Container', type: 'FRAME', size: { x: 15.5, y: 10.25 },
    children: [{ ...leaf('4:4'), visible: false, componentId: 'different-main' }],
  }],
});
function captureRest(node = fixture()) {
  const { dump } = mapRestToDump({ name: 'Fixture', nodes: { '1:1': { document: {
    id: '1:1', name: 'Source', type: 'COMPONENT', children: [node],
  }, components: { '2:0': { name: 'Host', key: 'host-key' }, '3:1': { name: 'Selected', key: 'selected-key' } } } } } as never);
  return (dump.Source as DumpSet).variants[0].children![0].fixedSwaps!.Content;
}
const pluginNode = (node: RestNode): unknown => ({
  ...node,
  ...(node.size ? { width: node.size.x, height: node.size.y } : {}),
  ...(node.children ? { children: node.children.map(pluginNode) } : {}),
  getMainComponentAsync: async () => node.componentId ? { id: node.componentId } : null,
});
const plain = (value: unknown) => value === undefined ? undefined : JSON.parse(JSON.stringify(value));

test('both readers preserve exact selected occurrence geometry, including hidden and multiple uses', async () => {
  const input = fixture(), before = JSON.stringify(input), swap = captureRest(input);
  assert.equal(JSON.stringify(input), before);
  assert.equal(swap.id, '3:1'); assert.equal(swap.key, 'selected-key');
  assert.deepEqual(swap.observedInstances, [
    { nodeId: '4:1', path: [0], componentId: '3:1', size: { width: 12.125, height: 9.375 },
      parentSize: { width: 20.25, height: 16.875 }, relativeTransform: [[1, 0, 1.124997854232788], [0, 1, 2.375]],
      constraints: { horizontal: 'SCALE', vertical: 'SCALE' } },
    { nodeId: '4:4', path: [2, 0], componentId: 'different-main', size: { width: 12.125, height: 9.375 },
      parentSize: { width: 15.5, height: 10.25 }, relativeTransform: [[1, 0, 1.124997854232788], [0, 1, 2.375]],
      constraints: { horizontal: 'SCALE', vertical: 'SCALE' } },
  ]);
  assert.deepEqual(plain(await capturePlugin(pluginNode(input), property)), swap.observedInstances);
  for (const child of input.children!) child.name = 'Renamed';
  assert.deepEqual(captureRest(input).observedInstances, swap.observedInstances);
});

test('uncaptured dimensions, identity and transforms are never inferred from bounding boxes or selected mains', async () => {
  const input = fixture(); input.children = [leaf('4:1')];
  const child = input.children[0];
  delete child.size; delete child.componentId;
  child.relativeTransform = [[1, 0, Infinity], [0, 1, 0]];
  child.absoluteBoundingBox = { x: 0, y: 0, width: 999, height: 999 };
  delete child.constraints;
  const expected = [{ nodeId: '4:1', path: [0], parentSize: { width: 20.25, height: 16.875 } }];
  assert.deepEqual(captureRest(input).observedInstances, expected);
  assert.deepEqual(plain(await capturePlugin(pluginNode(input), property)), expected);
  delete input.children;
  assert.equal(captureRest(input).observedInstances, undefined);
  assert.equal(await capturePlugin(pluginNode(input), property), undefined);
  input.children = [];
  assert.deepEqual(captureRest(input).observedInstances, []);
  assert.deepEqual(plain(await capturePlugin(pluginNode(input), property)), []);
});

test('rotation and non-scale constraints remain observations rather than a claim of uniform scaling', async () => {
  const input = fixture(); input.children = [leaf('4:1')];
  input.children[0].relativeTransform = [[0, -1, 8], [1, 0, 2]];
  input.children[0].constraints = { horizontal: 'LEFT', vertical: 'BOTTOM' };
  const native = pluginNode(input) as any;
  native.children[0].constraints = { horizontal: 'MIN', vertical: 'MAX' };
  assert.deepEqual(plain(await capturePlugin(native, property)), captureRest(input).observedInstances);
  assert.deepEqual(captureRest(input).observedInstances![0].relativeTransform, [[0, -1, 8], [1, 0, 2]]);
});

test('the complete plugin capture attaches selected occurrence geometry without changing native nodes', async () => {
  const { figma: mock } = createFigmaMock(), figma = mock as any;
  const selected = figma.createComponent(); selected.name = 'Selected'; selected.resize(24, 24);
  figma.currentPage.appendChild(selected);
  const host = figma.createComponent(); host.name = 'Host'; figma.currentPage.appendChild(host);
  const outer = figma.createComponent(); outer.name = 'Source'; figma.currentPage.appendChild(outer);
  const instance = host.createInstance(); outer.appendChild(instance);
  instance._allProps[property] = { type: 'INSTANCE_SWAP', value: selected.id };
  const content = selected.createInstance(); instance.appendChild(content);
  content.resize(12.125, 9.375); content.componentPropertyReferences = { mainComponent: property };
  content.constraints = { horizontal: 'SCALE', vertical: 'SCALE' };
  const before = [content.id, content.width, content.height, selected.width, selected.height];
  const source = plugin.replace(/^const TARGET_SETS = \[[^\n]*\];$/m, "const TARGET_SETS = ['Source'];");
  const context = vm.createContext({ figma, console: { log() {}, warn() {}, error() {} } });
  const dump = await vm.runInContext(`(async()=>{${source}})()`, context);
  const row = dump.Source.variants[0].children[0].fixedSwaps.Content.observedInstances[0];
  assert.deepEqual(plain(row.size), { width: 12.125, height: 9.375 });
  assert.equal(row.nodeId, content.id); assert.equal(row.componentId, selected.id);
  assert.deepEqual([content.id, content.width, content.height, selected.width, selected.height], before);
  const broken = selected.createInstance(); instance.appendChild(broken);
  broken.componentPropertyReferences = { mainComponent: property };
  Object.defineProperty(broken, 'width', { get() { throw Error('unreadable geometry'); } });
  const refused = await vm.runInContext(`(async()=>{${source}})()`, context);
  const retained = refused.Source.variants[0].children[0].fixedSwaps.Content;
  assert.equal(retained.id, selected.id);
  assert.equal(retained.observedInstances, undefined, 'a failure after one observation must not retain a partial list');
  assert(refused._degradations.some((d: any) => d.message.includes('no partial sizing evidence')));
  content.remove(); broken.remove();
  const empty = await vm.runInContext(`(async()=>{${source}})()`, context);
  assert.deepEqual(plain(empty.Source.variants[0].children[0].fixedSwaps.Content.observedInstances), [], 'complete native capture retains empty inventory rather than an unknown observation');
});

test('REST selected-root witness separates current FILL/HUG allocation from the placeholder main',()=>{
 const host=fixture();host.children=[leaf('4:1')];host.layoutMode='VERTICAL';host.paddingLeft=0;host.paddingRight=0;host.paddingTop=0;host.paddingBottom=0;host.size={x:220,y:104};
 const selected=host.children[0];selected.size={x:220,y:52};selected.relativeTransform=[[1,0,0],[0,1,0]];selected.layoutSizingHorizontal='FILL';selected.layoutSizingVertical='HUG';selected.overrides=[{id:selected.id,overriddenFields:['layoutAlign','primaryAxisSizingMode']}];selected.componentProperties={Mode:{type:'VARIANT',value:'Active'}};
 const response:any={name:'Fixture',version:'frozen',nodes:{source:{document:{id:'source',name:'Source',type:'COMPONENT',children:[host]},components:{'2:0':{name:'Host',key:'host-key'},'3:1':{name:'Selected',key:'selected-key'}}},selected:{document:{id:'3:1',name:'Selected',type:'COMPONENT',size:{x:360,y:52}}}}};
 const before=JSON.stringify(response),result=mapRestToDump(response,{fileKey:'fixture'}),row=(result.dump.Source as DumpSet).variants[0].children![0].fixedSwaps!.Content.observedInstances![0];
 assert.equal(result.dump._provenance!.dumpVersion,REST_DUMP_VERSION);assert.equal(JSON.stringify(response),before);
 assert.deepEqual(row.selectedRoot?.sizing,{horizontal:'FILL',vertical:'HUG'});assert.deepEqual(row.selectedRoot?.mainSize,{width:360,height:52});assert.deepEqual(row.selectedRoot?.fields,['layoutAlign','primaryAxisSizingMode']);assert.deepEqual(row.selectedRoot?.properties,{Mode:'Active'});assert.equal(row.selectedRoot?.hostMainId,'2:0');assert.equal(row.selectedRoot?.parentId,'2:1');assert.equal(row.selectedRoot?.layoutGrow,0);assert.equal(row.selectedRoot?.sizeBound,false);
 delete response.nodes.selected;assert.equal((mapRestToDump(response,{fileKey:'fixture'}).dump.Source as DumpSet).variants[0].children![0].fixedSwaps!.Content.observedInstances![0].selectedRoot,undefined,'missing original selected main grants no selected-root authority');
});

// A swap property's declared default, drawn by the set at every use, with no linked contract in scope.
const swapDefaultSet = (main = (i: number) => '3:1', paths: boolean | ((i: number) => boolean) = true, conventions = ['observed-swap-default-drawn'], strip = false, bare = false) => {
  const swap = 'Glyph slot#1:9';
  const variant = (i: number, size: string, s: number, white: boolean): RestNode => ({ id: `5:${i}`, name: `Size=${size}`, type: 'COMPONENT',
    layoutMode: 'HORIZONTAL', primaryAxisSizingMode: 'AUTO', counterAxisSizingMode: 'AUTO', size: { x: s, y: s }, absoluteBoundingBox: { x: 0, y: 0, width: s, height: s },
    children: [((inst: RestNode) => bare ? inst : { id: `6:${i}`, name: 'Wrapper', type: 'FRAME', layoutSizingHorizontal: 'FIXED', layoutSizingVertical: 'FIXED', size: { x: s, y: s },
      absoluteBoundingBox: { x: 0, y: 0, width: s, height: s }, relativeTransform: [[1, 0, 0], [0, 1, 0]],
      children: [inst] } as RestNode)({ ...leaf(`7:${i}`, swap), componentId: main(i), size: { x: s, y: s }, relativeTransform: [[1, 0, 0], [0, 1, 0]], absoluteBoundingBox: { x: 0, y: 0, width: s, height: s },
        children: [{ id: `I7:${i};8:1`, name: 'Glyph', type: 'VECTOR', size: { x: s / 2, y: s / 2 }, relativeTransform: [[1, 0, s / 4], [0, 1, s / 4]],
          absoluteBoundingBox: { x: s / 4, y: s / 4, width: s / 2, height: s / 2 }, constraints: { horizontal: 'SCALE', vertical: 'SCALE' },
          fills: [{ type: 'SOLID', color: { r: +white, g: +white, b: 1, a: 1 } }],
          ...((typeof paths === 'function' ? paths(i) : paths) ? { fillGeometry: [{ path: `M0 0L${s / 2} 0L${s / 2} ${s / 2}L0 ${s / 2}Z`, windingRule: 'NONZERO' }] } : {}) }] })] } as RestNode);
  const document = { id: '5:0', name: 'GlyphHost', type: 'COMPONENT_SET', componentPropertyDefinitions: {
    Size: { type: 'VARIANT', defaultValue: 'Small', variantOptions: ['Small', 'Large'] }, [swap]: { type: 'INSTANCE_SWAP', defaultValue: '3:1', preferredValues: [] } },
    children: [variant(1, 'Small', 16, true), variant(2, 'Large', 20, false)] };
  const components = { '3:1': { name: 'Selected', key: 'selected-key' }, '3:2': { name: 'Other', key: 'other-key' } };
  const set = (mapRestToDump({ name: 'Fixture', nodes: { '5:0': { document, components } } } as never).dump as unknown as Record<string, DumpSet>).GlyphHost;
  if (strip) for (const v of set.variants) delete (bare ? v.children![0] : v.children![0].children![0]).instanceSwapContent;
  const proposed = proposeFromDump(set, { corpus: tokenCorpusFromJson({ primitives: {}, semantic: {}, light: {}, brandDefault: {} }),
    contractIdByName: new Map(), fileKey: null, projectionMode: 'reviewable-inversion', mintUnbound: true, conventions });
  const contract = ContractSchema.parse(proposed.contract);
  return { set, contract, proposed, tree: proposed.mintedTokens!.tree, slot: Object.values(contract.anatomy.root.parts!).find(p => p.slot)!.slot! };
};

test('a declared swap default drawn at every use is captured and renders as the omitted-caller fallback, with per-use paint and size', async () => {
  const { set, contract, tree, slot } = swapDefaultSet();
  for (const v of set.variants) assert.equal(v.children![0].children![0].instanceSwapContent?.root.children?.[0]?.type, 'VECTOR');
  assert.equal(slot.renderDefaultAnatomy, true);
  assert.equal(slot.defaultContent, undefined);
  const output = emitReact(contract, { contracts: new Map([[contract.id, contract]]), icons: new Map(), tokens: tokenInventoryFromJson([tree]) });
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage(), render = await mountGenerated(page, contract.name, output.tsx, mintedTokenCss(tree) + output.css);
    const glyph = () => page.locator('#root [class$=_Glyph]');
    for (const [size, edge, offset, color] of [['small', 8, 4, 'rgb(255, 255, 255)'], ['large', 10, 5, 'rgb(0, 0, 255)']] as const) {
      await render({ size });
      assert.deepEqual(await glyph().evaluate(el => { const r = el.getBoundingClientRect(), o = el.closest('#root > * > *')!.getBoundingClientRect();
        return [r.width, r.height, r.x - o.x, r.y - o.y, getComputedStyle(el).backgroundColor]; }), [edge, edge, offset, offset, color], size);
    }
    await render({ size: 'small', children: 'Caller content' });
    assert.equal(await glyph().count(), 0);
    assert.match(await page.locator('#root').innerText(), /Caller content/);
  } finally { await browser.close(); }
});

test('a swap use that is not the declared default, or an incomplete drawing, keeps the default as sample content only', () => {
  assert.equal(swapDefaultSet(i => i === 1 ? '3:1' : '3:2').slot.renderDefaultAnatomy, undefined);
  const { set, slot } = swapDefaultSet(undefined, false);
  assert.equal(slot.renderDefaultAnatomy, undefined);
  assert(set.variants.every(v => v.children![0].children![0].instanceSwapContent === undefined), 'unfetched paths are a lost drawing, not a recorded one');
});

test('profile convention off: the recorded drawing is unread, so the proposal is byte-identical to one without it', () => {
  const off = swapDefaultSet(undefined, true, []), without = swapDefaultSet(undefined, true, [], true);
  assert(off.set.variants.every(v => v.children![0].children![0].instanceSwapContent), 'capture stays general');
  assert.equal(off.slot.renderDefaultAnatomy, undefined);
  assert.deepEqual(off.slot.defaultContent?.length, 1);
  assert.equal(JSON.stringify(off.proposed), JSON.stringify(without.proposed));
});

test('a use without a complete drawing draws nothing in its variant and is named; the other uses keep their own', async () => {
  const { set, contract, tree, slot, proposed } = swapDefaultSet(undefined, i => i === 1);
  assert.equal(set.variants[1].children![0].children![0].instanceSwapContent, undefined);
  assert.equal(slot.renderDefaultAnatomy, true);
  assert(proposed.notes.some(n => n.includes('observed-swap-default-drawing-missing') && n.includes('1 of 2') && n.includes('Size=Large')));
  const output = emitReact(contract, { contracts: new Map([[contract.id, contract]]), icons: new Map(), tokens: tokenInventoryFromJson([tree]) });
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage(), render = await mountGenerated(page, contract.name, output.tsx, mintedTokenCss(tree) + output.css);
    const glyph = () => page.locator('#root [class$=_Glyph]');
    await render({ size: 'small' });
    assert.equal(await glyph().count(), 1);
    await render({ size: 'large' });
    assert.equal(await glyph().count(), 0, 'never another use\'s drawing');
  } finally { await browser.close(); }
});

test('a swap-bound instance with no wrapper frame carries the same omitted-caller fallback (bare slot path)', async () => {
  const { contract, tree, slot } = swapDefaultSet(undefined, true, undefined, false, true);
  assert.equal(slot.renderDefaultAnatomy, true);
  const output = emitReact(contract, { contracts: new Map([[contract.id, contract]]), icons: new Map(), tokens: tokenInventoryFromJson([tree]) });
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage(), render = await mountGenerated(page, contract.name, output.tsx, mintedTokenCss(tree) + output.css);
    for (const [size, edge] of [['small', 8], ['large', 10]] as const) {
      await render({ size });
      assert.deepEqual(await page.locator('#root [class$=_Glyph]').evaluate(el => [el.getBoundingClientRect().width, el.getBoundingClientRect().height]), [edge, edge], size);
    }
  } finally { await browser.close(); }
  assert.equal(swapDefaultSet(undefined, true, [], false, true).slot.renderDefaultAnatomy, undefined, 'off without the convention');
});
