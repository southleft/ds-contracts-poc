import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { createFigmaMock } from '../../../scripts/plugin-engine-mock-figma.mjs';
import { mapRestToDump, type RestNode } from './map.js';
import type { DumpSet } from '../types.js';
const box = { x: 100, y: 100, width: 18.125, height: 20.0625 };
const child = (extra: Partial<RestNode> = {}): RestNode => ({ id: '1:3', name: 'Indicator', type: 'FRAME', absoluteBoundingBox: box, layoutSizingHorizontal: 'FIXED', layoutSizingVertical: 'FIXED', ...extra });
function capture(node = child(), parent: Partial<RestNode> = {}) {
  const component = { id: '1:2', name: 'Only', type: 'COMPONENT', layoutMode: 'HORIZONTAL', children: [node], ...parent };
  const result = mapRestToDump({ name: 'fixture', nodes: { '1:2': { document: component } } } as never);
  const set = (result.dump as unknown as Record<string, DumpSet>).Only;
  return set.variants[0].children![0];
}
test('REST carries each explicit fixed in-flow manual-box dimension exactly', () => {
  assert.deepEqual(capture().fixedSize, { width: 18.125, height: 20.0625 });
  assert.deepEqual(capture(child({ layoutSizingVertical: 'HUG' })).fixedSize, { width: 18.125 });
  assert.deepEqual(capture(child({ layoutSizingHorizontal: 'FILL' })).fixedSize, { height: 20.0625 });
  assert.equal(capture(child({ layoutSizingHorizontal: undefined, layoutSizingVertical: undefined })).fixedSize, undefined);
});
test('fixedSize never duplicates another geometry class or infers a size from an unconstrained axis', () => {
  for (const extra of [{ type: 'TEXT' }, { type: 'INSTANCE' }, { type: 'COMPONENT' }, { layoutMode: 'HORIZONTAL' }, { layoutPositioning: 'ABSOLUTE' }, { absoluteBoundingBox: null }] as Partial<RestNode>[]) {
    assert.equal(capture(child(extra)).fixedSize, undefined, JSON.stringify(extra));
  }
  assert.equal(capture(child(), { layoutMode: 'NONE' }).fixedSize, undefined);
  assert.equal(capture(child({ layoutSizingHorizontal: 'FILL', layoutSizingVertical: 'HUG' })).fixedSize, undefined);
});
test('a rotated manual box requires both fixed axes; a small nonzero rotation is not rounded away', () => {
  for (const rotation of [Math.PI / 2, 0.00000001]) {
    assert.deepEqual(capture(child({ rotation })).fixedSize, { width: 18.125, height: 20.0625 });
    assert.equal(capture(child({ rotation, layoutSizingVertical: 'HUG' })).fixedSize, undefined);
  }
});


test('plugin and REST fixed manual-box capture agree, including fractions, invalid dimensions and tiny rotations', async () => {
  const specs = [{}, {layoutSizingVertical:'HUG'}, {layoutSizingHorizontal:'FILL'},
    {rotation: 0.00000001, layoutSizingVertical:'HUG'}, {rotation:90},
    {absoluteBoundingBox:{...box,width:NaN}}, {absoluteBoundingBox:{...box,height:-1}},
    {layoutPositioning:'ABSOLUTE'}, {layoutMode:'HORIZONTAL'},
    {layoutSizingHorizontal:undefined,layoutSizingVertical:undefined}];
  const {figma: mockFigma} = createFigmaMock();
  const figma: any = mockFigma;
  const context = vm.createContext({figma, console:{log(){},warn(){},error(){}}});
  const run = (code:string) => vm.runInContext(`(async()=>{${code}})()`,context,{timeout:20000}) as Promise<any>;
  const variants = [];
  for (const [i, spec] of specs.entries()) {
    const c=figma.createComponent(); variants.push(c); c.name=`Case=${i}`; c.layoutMode='HORIZONTAL';
    const n=figma.createFrame(); n.name='Indicator'; n.layoutMode='NONE';
    const {id:_id,type:_type,absoluteBoundingBox,...values}=child(spec as Partial<RestNode>);
    Object.assign(n,values);
    Object.defineProperty(n,'absoluteBoundingBox',{value:absoluteBoundingBox}); c.appendChild(n);
  }
  const set=figma.combineAsVariants(variants,figma.currentPage); set.name='MeasuredBox';
  const source=readFileSync(new URL('../dump.plugin.js',import.meta.url),'utf8')
    .replace(/^const TARGET_SETS = \[[^\n]*\];$/m, `const TARGET_SETS = ['MeasuredBox'];`);
  const dumps=await run(source);
  assert.equal(dumps._provenance.dumpVersion,'1.39');
  assert.deepEqual(Array.from(dumps.MeasuredBox.variants, (v:any)=>v.children[0].fixedSize && JSON.parse(JSON.stringify(v.children[0].fixedSize))),
    specs.map(spec=>capture(child(spec as Partial<RestNode>)).fixedSize));
});
