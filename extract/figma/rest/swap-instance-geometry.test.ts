import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { mapRestToDump, type RestNode } from './map.js';
import type { DumpFixedSwap, DumpSet } from '../types.js';
import { createFigmaMock } from '../../../scripts/plugin-engine-mock-figma.mjs';

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
  assert.equal(captureRest(input).observedInstances, undefined);
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
});
