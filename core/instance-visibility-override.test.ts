import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {ContractSchema} from '../scripts/contract-schema.js';
import {visibilityFixture,visibilityParentFixture} from './visibility-override.test.js';
import {createFigmaEngine} from './emit-figma-script.js';
import {createFigmaMock} from '../scripts/plugin-engine-mock-figma.mjs';
import {emitReact} from './emit-react.js';
import {emitReactInline} from './emit-react-inline.js';
import {mountGenerated} from './react-test-runtime.js';
import {chromium} from 'playwright-core';

test('instance-root visibility preserves dependency identity and omission on browser and native paths',async()=>{
 const leaf=visibilityFixture();leaf.id='test.leaf';leaf.name='Leaf';leaf.props=[];
 leaf.anatomy.root.parts={label:{text:'Separator'}};
 const child=visibilityFixture(),part=child.anatomy.root.parts!.ink;
 delete part.text;delete part.literals;part.component={id:leaf.id};
 ContractSchema.parse(child);
 const parent=visibilityParentFixture(),contracts=new Map([leaf,child,parent].map(c=>[c.id,c]));
 const tokens={primitives:{},semantic:{},light:{},dark:{},brands:{default:{}}};
 const browser=await chromium.launch();try{for(const inline of [false,true]){
  const emit=(c:typeof child)=>inline?{...emitReactInline(c,{tokens,contracts,icons:new Map()}),css:''}:emitReact(c,{tokens:new Set(),contracts,icons:new Map()});
  const a=emit(child),b=emit(leaf),page=await browser.newPage();
  try{const render=await mountGenerated(page,child.name,a.tsx,a.css,{Leaf:{tsx:b.tsx,css:b.css}});
   for(const appearance of ['plain','decorated'])for(const showInk of [undefined,true,false,undefined]){
    await render({appearance,showInk});assert.equal((await page.locator('#root').innerText()).includes('Separator'),showInk??appearance==='decorated');
   }
  }finally{await page.close();}
 }}finally{await browser.close();}
 const engine=createFigmaEngine({tokens,icons:new Map()}),mock=createFigmaMock();
 const context=vm.createContext({figma:mock.figma,console:{log(){},warn(){},error(){}}});
 const run=(s:string)=>vm.runInContext('(async()=>{'+s+'\n})()',context);
 await run(engine.buildTokensScript(null));for(const c of [leaf,child,parent])await run(engine.buildComponentScript(c,contracts));
 const set=mock.root.findOne(n=>n.type==='COMPONENT_SET'&&n.getSharedPluginData('ds_contracts','contractId')===parent.id)!;
 for(const variant of set.children!){
  const target=variant.findOne(n=>n.getSharedPluginData('ds_contracts','visibilityOverride')===child.id+':inkVisible')!;
  assert(target);assert.equal(target.type,'INSTANCE');assert.equal(target.visible,variant.name==='Shown=True');
  assert.equal((await (target as any).getMainComponentAsync()).getSharedPluginData('ds_contracts','contractId'),leaf.id);
 }
});
