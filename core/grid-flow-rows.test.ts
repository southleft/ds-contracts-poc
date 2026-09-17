import test from 'node:test';
import assert from 'node:assert/strict';
import { ContractSchema } from '../scripts/contract-schema.js';
import { materializeFlowRows, readGridFlowRows, type GridFlowRows } from './grid-flow-rows.js';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { createFigmaMock } from '../scripts/plugin-engine-mock-figma.mjs';
import { createFigmaEngine } from './emit-figma-script.js';
import { proposeFromDump } from './propose-figma.js';
import { tokenCorpusFromJson } from './token-corpus.js';
import { tokens } from './figma-root-slot.fixture.js';
import { rootSlotSeed } from './figma-root-slot.fixture.js';
import { proposeFromCode } from './propose-code.js';

test('flow rows preserve declared empty tracks and size additional rows from the reusable rule', () => {
  const recipe: GridFlowRows = { version: 1, rows: [{ type: 'FIXED', value: 24 }], autoRows: { type: 'HUG', value: 1 } };
  assert.deepEqual(materializeFlowRows(recipe, 2, 0), recipe.rows);
  const grown = materializeFlowRows(recipe, 2, 5);
  assert.deepEqual(grown, [recipe.rows[0], recipe.autoRows, recipe.autoRows]);
  assert.deepEqual(readGridFlowRows(recipe, 2, 5, grown), recipe);
  assert.throws(() => readGridFlowRows(recipe, 2, 3, grown), /readback-mismatch/);
  assert.throws(() => readGridFlowRows({ ...recipe, autoRows: { type: 'HUG', value: 24 } }, 2, 5, grown), /invalid-recipe/);
  assert.deepEqual(materializeFlowRows(recipe, 2, 1), recipe.rows, 'removal drops only derived rows');
  assert.deepEqual(recipe.rows, [{ type: 'FIXED', value: 24 }], 'materialization never changes the recipe');
  const fractional: GridFlowRows = { version: 1, rows: [], autoRows: { type: 'FIXED', value: 33.3 } };
  assert.deepEqual(readGridFlowRows(fractional, 1, 1, [{ type: 'FIXED', value: Math.fround(33.3) }]), fractional);
  assert.throws(() => readGridFlowRows(fractional, 1, 1, [{ type: 'FIXED', value: 33.4 }]), /readback-mismatch/);
});

test('intrinsic flow rows require row flow and retain the definite-axis and placement fences', () => {
  const c = rootSlotSeed();
  c.anatomy.root.layout = { display: 'grid', columns: [{ fr: 1 }], flow: 'row', autoRows: { fit: true } };
  c.anatomy.root.literals = { width: '300px', height: 'fit-content' };
  assert.ok(ContractSchema.safeParse(c).success);
  for (const mutate of [
    (x: typeof c) => { delete x.anatomy.root.layout!.flow; },
    (x: typeof c) => { x.anatomy.root.layout!.display = 'flex'; },
    (x: typeof c) => { x.anatomy.root.layout!.autoRows = { fr: 1 }; },
    (x: typeof c) => { delete x.anatomy.root.literals!.height; },
  ]) { const bad = structuredClone(c); mutate(bad); assert.equal(ContractSchema.safeParse(bad).success, false); }
  delete c.anatomy.root.slot;
  c.anatomy.root.layout.rows = [{ px: 24 }];
  c.anatomy.root.parts = { a: { text: 'A' }, b: { text: 'B' }, c: { text: 'C' } };
  assert.ok(ContractSchema.safeParse(c).success, 'managed rows cover declared anatomy overflow');
  delete c.anatomy.root.layout.autoRows;
  assert.equal(ContractSchema.safeParse(c).success, false, 'old declared-only grids still refuse overflow');
});

test('code extraction preserves one implicit track rule and refuses repeating lists or unsupported flow', () => {
  const source = `import styles from './Flow.module.css'; export interface FlowProps {} export function Flow({}:FlowProps){return <div className={styles.root}><div className={styles.a}/></div>}`;
  const tokens = [{}];
  for (const flow of ['row', 'column', 'row dense']) for (const track of ['fit-content(100%)', '24px', '24px 32px']) {
    const result = proposeFromCode({ sourcePath: 'Flow.tsx', source,
      css: `.root{display:grid;grid-template-columns:1fr;grid-auto-flow:${flow};grid-auto-rows:${track};width:300px;height:fit-content}.a{height:20px}` }, { tokens, prefix: 'ds' });
    const root = (result.proposals[0].proposal.contract as any).anatomy.root;
    assert.deepEqual(root.layout.autoRows, flow === 'row' && !track.includes('24px 32px') ? track === '24px' ? { px: 24 } : { fit: true } : undefined);
  }
});


test('regular anatomy grids retain the declared and implicit row distinction through native extraction', async () => {
  const c=rootSlotSeed(); delete c.anatomy.root.slot;
  c.anatomy.root.layout={display:'grid',columns:[{fr:1}],rows:[{px:24}],autoRows:{fit:true},flow:'row'};
  c.anatomy.root.literals={width:'300px',height:'fit-content'};
  c.anatomy.root.parts={a:{text:'A'},b:{text:'B'},c:{text:'C'}};
  ContractSchema.parse(c);
  const engine=createFigmaEngine({tokens,icons:new Map()}),{figma,root}=createFigmaMock();
  const context=vm.createContext({figma,console:{log(){},warn(){},error(){}}});
  const run=(code:string)=>vm.runInContext(`(async()=>{${code}\n})()`,context,{timeout:20000}) as Promise<any>;
  await run(engine.buildTokensScript(null));
  await run(engine.buildComponentScript(c,new Map([[c.id,c]])));
  const comp=root.findOne((n:any)=>n.type==='COMPONENT'&&n.getSharedPluginData('ds_contracts','contractId')===c.id);
  assert.ok(comp);
  assert.deepEqual(JSON.parse(JSON.stringify(comp.gridRowSizes)),[{type:'FIXED',value:24},{type:'HUG',value:1},{type:'HUG',value:1}]);
  const script=readFileSync(new URL('../extract/figma/dump.plugin.js',import.meta.url),'utf8').replace(/^const TARGET_SETS = \[[^\n]*\];$/m,`const TARGET_SETS = ${JSON.stringify([comp.name])};`);
  const dump=JSON.parse(JSON.stringify((await run(script))[comp.name]));
  const result=proposeFromDump(dump,{corpus:tokenCorpusFromJson({primitives:tokens.primitives,semantic:{},light:{},brandDefault:{}}),contractIdByName:new Map(),mintUnbound:true});
  const restored=ContractSchema.parse(result.contract);
  assert.deepEqual(restored.anatomy.root.layout?.rows,[{px:24}]);
  assert.deepEqual(restored.anatomy.root.layout?.autoRows,{fit:true});
  const bad=structuredClone(dump);bad.variants[0].layout.grid.rows[2]={px:24};
  assert.throws(()=>proposeFromDump(bad,{corpus:tokenCorpusFromJson({primitives:tokens.primitives,semantic:{},light:{},brandDefault:{}}),contractIdByName:new Map(),mintUnbound:true}),/grid-flow-rows-readback-mismatch/);
});
