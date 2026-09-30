import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { createFigmaMock } from '../../../scripts/plugin-engine-mock-figma.mjs';
import { mapRestToDump, type RestNode } from './map.js';
import type { DumpSet } from '../types.js';
import { chromium } from 'playwright-core';
import { proposeFromDump } from '../../../core/propose-figma.js';
import { tokenCorpusFromJson } from '../../../core/token-corpus.js';
import { tokenInventoryFromJson } from '../../../core/tokens.js';
import { mintedTokenCss } from '../../../core/mint-tokens.js';
import { emitReact } from '../../../core/emit-react.js';
import { emitReactInline } from '../../../core/emit-react-inline.js';
import { mountGenerated } from '../../../core/react-test-runtime.js';
import { ContractSchema } from '../../../scripts/contract-schema.js';
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

function constrainedBoxes(mode: 'HORIZONTAL' | 'VERTICAL'): DumpSet {
  const row = mode === 'HORIZONTAL';
  const component: RestNode = {
    id: '8:1', name: 'ConstrainedBoxes', type: 'COMPONENT', layoutMode: mode,
    primaryAxisSizingMode: 'FIXED', counterAxisSizingMode: 'FIXED',
    absoluteBoundingBox: { x: 0, y: 0, width: 80, height: 80 },
    children: ['First', 'Second'].map((name, i) => child({
      id: `8:${i + 2}`, name,
      absoluteBoundingBox: { x: row ? i * 60 : 0, y: row ? 0 : i * 60, width: 60, height: 60 },
      fills: [{ type: 'SOLID', color: { r: 0.2, g: 0.3, b: 0.4, a: 1 } }],
    })),
  };
  return (mapRestToDump({ name: 'fixture', nodes: { '8:1': { document: component } } }).dump as unknown as Record<string, DumpSet>).ConstrainedBoxes;
}
const proposeBoxes = (set: DumpSet) => proposeFromDump(set, {
  corpus: tokenCorpusFromJson({ primitives: {}, semantic: {}, light: {}, brandDefault: {} }),
  contractIdByName: new Map(), fileKey: null, projectionMode: 'reviewable-inversion', mintUnbound: true,
});

test('fixed children retain their drawn main-axis size in constrained rows and columns on both React surfaces', async () => {
  // Chakra Progress exposed this: once the parent width was carried, its fixed
  // stripe children shrank. This independent fixture overflows 80px with two
  // 60px boxes so preserving only the CSS width/height cannot pass the test.
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    for (const mode of ['HORIZONTAL', 'VERTICAL'] as const) {
      const proposed = proposeBoxes(constrainedBoxes(mode));
      const contract = ContractSchema.parse(proposed.contract), tree = proposed.mintedTokens!.tree;
      const contracts = new Map([[contract.id, contract]]), icons = new Map<string, string>();
      const css = emitReact(contract, { contracts, icons, tokens: tokenInventoryFromJson([tree]) });
      const inline = emitReactInline(contract, { contracts, icons, tokens: { primitives: tree, semantic: {}, light: {}, dark: {}, brands: { default: {} } } });
      for (const output of [css, { ...inline, css: '' }]) {
        await mountGenerated(page, contract.name, output.tsx, mintedTokenCss(tree) + output.css);
        const boxes = await page.locator('#root > *').evaluate(root => ({
          parent: { width: root.getBoundingClientRect().width, height: root.getBoundingClientRect().height },
          children: Array.from(root.children, el => ({ width: el.getBoundingClientRect().width, height: el.getBoundingClientRect().height })),
        }));
        const axis = mode === 'HORIZONTAL' ? 'width' : 'height';
        assert.equal(boxes.parent[axis], 80, mode);
        assert.deepEqual(boxes.children.map(b => b[axis]), [60, 60], mode);
      }
    }
  } finally { await browser.close(); }
});

test('a fixed cross axis or a mixed main-axis sizing mode does not disable flex shrinking', () => {
  for (const mode of ['HORIZONTAL', 'VERTICAL'] as const) {
    const set = constrainedBoxes(mode), axis = mode === 'HORIZONTAL' ? 'width' : 'height';
    for (const node of set.variants[0].children!) delete node.fixedSize![axis];
    const contract = ContractSchema.parse(proposeBoxes(set).contract);
    for (const part of Object.values(contract.anatomy.root.parts!)) assert.equal(part.tokens?.['flex-shrink'], undefined);
  }
  const set = constrainedBoxes('HORIZONTAL');
  const second = structuredClone(set.variants[0]);
  set.propertyDefinitions = { Mode: { type: 'VARIANT', defaultValue: 'Fixed', variantOptions: ['Fixed', 'Flexible'] } };
  set.variants[0].name = 'Mode=Fixed'; second.name = 'Mode=Flexible';
  set.variants[0].variantProperties = { Mode: 'Fixed' }; second.variantProperties = { Mode: 'Flexible' };
  for (const node of second.children!) delete node.fixedSize!.width;
  set.variants.push(second);
  const contract = ContractSchema.parse(proposeBoxes(set).contract);
  for (const part of Object.values(contract.anatomy.root.parts!)) assert.equal(part.tokens?.['flex-shrink'], undefined);
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
  assert.equal(dumps._provenance.dumpVersion,'1.48');
  assert.deepEqual(Array.from(dumps.MeasuredBox.variants, (v:any)=>v.children[0].fixedSize && JSON.parse(JSON.stringify(v.children[0].fixedSize))),
    specs.map(spec=>capture(child(spec as Partial<RestNode>)).fixedSize));
});
