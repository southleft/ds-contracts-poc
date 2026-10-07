import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {chromium} from 'playwright-core';
import {PNG} from 'pngjs';
import {emitReact} from './emit-react.js';
import {emitReactInline} from './emit-react-inline.js';
import {emitWebComponent} from '../packages/emitter-web-components/src/emit-wc.js';
import {mountGenerated} from './react-test-runtime.js';
import {createFigmaEngine} from './emit-figma-script.js';
import {ContractSchema,resolveLayout} from '../scripts/contract-schema.js';
import {childPaintOrderPlans} from '../packages/core/src/child-paint-order.js';
import {proposeBatchFromDump} from './propose-figma.js';
import {tokenCorpusFromJson} from './token-corpus.js';

function linkedPaintFixture(){
 const layout={mode:'HORIZONTAL',primary:'MIN',counter:'MIN',spacing:0,padding:[0,0,0,0],primarySizing:'FIXED',counterSizing:'FIXED'};
 const propertyDefinitions={Order:{type:'VARIANT',defaultValue:'Front',variantOptions:['Front','Back']}};
 const child={setName:'Paint child',type:'COMPONENT_SET',key:'paint-child-key',propertyDefinitions,variants:['Front','Back'].map((value,i)=>({
  name:'Order='+value,type:'COMPONENT',variantProperties:{Order:value},bbox:{width:20,height:20},layout,itemReverseZIndex:i===0,
  children:[{name:'A',type:'FRAME',bbox:{width:10,height:20},fill:{hex:'ff0000'}},{name:'B',type:'FRAME',bbox:{width:10,height:20},fill:{hex:'0000ff'}}]}))};
 const parent={setName:'Paint parent',type:'COMPONENT_SET',key:'paint-parent-key',propertyDefinitions,variants:['Front','Back'].map((value,i)=>({
  name:'Order='+value,type:'COMPONENT',variantProperties:{Order:value},bbox:{width:20,height:20},layout,
  children:[{name:'Paint child',type:'INSTANCE',instanceOf:'Paint child',instanceSetKey:'paint-child-key',componentProperties:{Order:value},bbox:{width:20,height:20},layout,itemReverseZIndex:i===0}]}))};
 return {child,parent};
}
test('a key-linked child owns matching paint order for each applied instance variant',()=>{
 const result=proposeBatchFromDump(linkedPaintFixture() as any,{fileKey:'paint-file',corpus:tokenCorpusFromJson({primitives:{},semantic:{},light:{},brandDefault:{}}),contractIdByName:new Map(),mintUnbound:true});
 assert.deepEqual(result.skipped,[]);
 const parent=result.proposals.find(p=>(p.contract as any).name==='PaintParent')!;
 assert(parent.notes.some(n=>n.includes('the child retains ownership of its internal stacking')));
 const contract=ContractSchema.parse(parent.contract);
 const instance=Object.values(contract.anatomy.root.parts??{}).find(p=>p.component)!;
 assert(instance.component);assert.equal(instance.layout?.reversePaint,undefined,'the parent must not acquire the child\'s stacking context');
});
test('instance paint-order drift or missing key authority still refuses the parent',()=>{
 for(const mutation of ['order','key','layout'] as const){
  const dump=linkedPaintFixture();
  for(const v of dump.parent.variants){const n=v.children[0];if(mutation==='order')n.itemReverseZIndex=true;else if(mutation==='key')n.instanceSetKey='other-key';else n.layout={...n.layout,mode:'VERTICAL'};}
  const result=proposeBatchFromDump(dump as any,{fileKey:'paint-file',corpus:tokenCorpusFromJson({primitives:{},semantic:{},light:{},brandDefault:{}}),contractIdByName:new Map(),mintUnbound:true});
  assert(result.skipped.some(p=>p.reason.includes('child-paint-order-owner-unqualified')),JSON.stringify({mutation,skipped:result.skipped}));
 }
});

test('paint-order variants preserve content order on both React surfaces and compensate native reverse flow',async()=>{
 const c=JSON.parse(readFileSync(new URL('../contracts/badge.contract.json',import.meta.url),'utf8'));
 c.props=[{name:'order',type:{enum:['front','back']},default:'front',bindings:{code:{prop:'order'},figma:{kind:'VARIANT',property:'Order'}}}];
 c.states=[];delete c.a11y;c.semantics={element:'div'};
 c.anatomy={root:{layout:{display:'flex',direction:'row',align:'center',justify:'center',reversePaint:true},layoutByProp:{prop:'order',map:{back:{reversePaint:false}}},declared:{position:'relative'},literals:{width:'20px',height:'20px'},parts:{
  ink:{element:'div',literals:{width:'8px',height:'8px','background-color':'#ff0000'}},
  background:{element:'div',declared:{position:'absolute'},literals:{left:'0px',top:'0px',width:'20px',height:'20px','background-color':'#0000ff'}}}}};
 const tokens={primitives:{},semantic:{},light:{},dark:{},brands:{default:{}}};
 const ctx={tokens:new Set<string>(),tokenValues:tokens,icons:new Map<string,string>(),contracts:new Map([[c.id,c]])};
 const browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:40,height:40},deviceScaleFactor:1});
 try{for(const surface of ['module','inline']){
  const out=surface==='module'?emitReact(c,ctx):emitReactInline(c,{...ctx,tokens});
  const render=await mountGenerated(page,c.name,out.tsx,'css'in out?String(out.css):'');
  await page.addStyleTag({content:'html,body{margin:0}#root{width:20px;height:20px}'});
  for(const order of ['front','back','front']){
   await render({order});const png=PNG.sync.read(await page.locator('#root').screenshot());
   assert.deepEqual([...png.data.subarray((10*20+10)*4,(10*20+10)*4+4)],order==='front'?[255,0,0,255]:[0,0,255,255],surface+' '+order);
   assert.equal(await page.locator('#root > * > *').count(),2,'no DOM reorder or wrapper');
  }
 }}finally{await browser.close();}
 const engine=createFigmaEngine({tokens,icons:new Map(),variableCollection:'Paint order'});
 for(const direction of ['row','row-reverse']){
  c.anatomy.root.layout.direction=direction;
  const data=engine.compileComponentData(c,ctx.contracts);
  assert.deepEqual(data.variants.map(v=>v.spec.itemReverseZIndex),direction==='row'?[true,false]:[false,true]);
 }
 c.props=[{name:'front',type:'boolean',default:true,bindings:{code:{prop:'front'},figma:{kind:'VARIANT',property:'Front'}}}];
 c.anatomy.root.layout.direction='row';delete c.anatomy.root.layoutByProp;
 c.anatomy.root.layoutByCombination={props:['front'],rows:['false','true'].map(value=>({values:[value],layout:{direction:'row',justify:'center',align:'center',reversePaint:value==='true'}}))};
 const b=await chromium.launch({headless:true}),p=await b.newPage({viewport:{width:40,height:40}});
 try{for(const surface of ['module','inline']){
  const out=surface==='module'?emitReact(c,ctx):emitReactInline(c,{...ctx,tokens});
  const render=await mountGenerated(p,c.name,out.tsx,'css'in out?String(out.css):'');
  await p.addStyleTag({content:'html,body{margin:0}#root{width:20px;height:20px}'});
  for(const front of [true,false,true]){
   await render({front});const png=PNG.sync.read(await p.locator('#root').screenshot());
   assert.deepEqual([...png.data.subarray(840,844)],front?[255,0,0,255]:[0,0,255,255],surface+' boolean '+front);
  }
 }}finally{await b.close();}
});

test('source boolean paint order survives proposal without replacing flow layout',async()=>{
 const {proposeFromDump}=await import('./propose-figma.js');
 const {tokenCorpusFromJson}=await import('./token-corpus.js');
 const source:any={setName:'PaintOrderSource',type:'COMPONENT_SET',propertyDefinitions:{Front:{type:'VARIANT',defaultValue:'True',variantOptions:['True','False']}},variants:['True','False'].map(Front=>({name:`Front=${Front}`,type:'COMPONENT',variantProperties:{Front},...(Front==='True'?{itemReverseZIndex:true}:{}),layout:{mode:'HORIZONTAL',primary:'MIN',counter:'MIN',spacing:0,padding:[0,0,0,0],primarySizing:'FIXED',counterSizing:'FIXED'},fixedSize:{width:20,height:20},children:[{name:'mark',type:'RECTANGLE',shape:{kind:'rect',width:8,height:8}}]}))};
 const before=JSON.stringify(source);
 const proposal=proposeFromDump(source,{corpus:tokenCorpusFromJson({primitives:{},semantic:{},light:{},brandDefault:{}}),mintUnbound:true,contractIdByName:new Map()});
 const c=ContractSchema.parse(proposal.contract);
 assert.equal(resolveLayout(c.anatomy.root,{front:'true'})?.reversePaint,true);
 assert.equal(resolveLayout(c.anatomy.root,{front:'false'})?.reversePaint,false);
 assert.equal(resolveLayout(c.anatomy.root,{front:'false'})?.direction,'row');
 assert.equal(JSON.stringify(source),before);
});

test('paint ordering refuses expanding children and competing authored ranks',()=>{
 const c=JSON.parse(readFileSync(new URL('../contracts/badge.contract.json',import.meta.url),'utf8'));
 c.anatomy={root:{layout:{display:'flex',reversePaint:true},parts:{child:{element:'div'}}}};
 for(const child of [{slot:'body'},{repeat:{prop:'items'}},{component:{id:'unknown'}},{declared:{'z-index':'4'}},{declaredStates:{hover:{'z-index':'4'}}},{literalsByProp:[{prop:'size',map:{large:{'z-index':'4'}}}]}]){
  c.anatomy.root.parts.child=child;assert.throws(()=>childPaintOrderPlans(c),/child-paint-order/);
 }
});

test('explicit slot hosts retain native overlap order across defaults, fragments and clearing',async t=>{
 const dir=new URL('./fixtures/slot-paint-order-native/',import.meta.url);
 const source=JSON.parse(readFileSync(new URL('SOURCE.json',dir),'utf8'));
 const c=JSON.parse(readFileSync(new URL('contract.json',dir),'utf8'));
 const child=structuredClone(c);child.id='qualification.slot-ink';child.name='SlotInk';child.props=[];child.anatomy={root:{literals:{width:'8px',height:'8px','background-color':'#ff0000'}}};
 c.anatomy.root.parts.ink={element:'div',layout:{display:'flex'},literals:{width:'8px',height:'8px'},slot:{name:'children',renderDefault:true,defaultContent:[{id:child.id}]}};
 const contracts=new Map([[c.id,c],[child.id,child]]),tokens={primitives:{},semantic:{},light:{},dark:{},brands:{default:{}}};
 const b=await chromium.launch();t.after(()=>b.close());const page=await b.newPage({viewport:{width:40,height:40}});let exact=0;
 for(const surface of ['module','inline']){
 const emit=(x:any)=>surface==='module'?emitReact(x,{tokens:new Set(),icons:new Map(),contracts}):emitReactInline(x,{tokens,icons:new Map(),contracts});const out=emit(c),dep=emit(child);
 const harness=`import {${c.name}} from './${c.name}';export function Harness({order='front',flow='forward',replacement=0}){return <${c.name} order={order} flow={flow}>{replacement===0?undefined:replacement===1?<><i style={{display:'block',width:4,height:8,background:'red'}}/><i style={{display:'block',width:4,height:8,background:'red'}}/></>:null}</${c.name}>}`;
 const render=await mountGenerated(page,'Harness',harness,'',{[c.name]:out,[child.name]:dep});await page.addStyleTag({content:'html,body{margin:0;background:transparent}#root{width:20px;height:20px}'});
 for(const row of source.rows)for(const replacement of [0,1]){
 await render({order:row.props.Order,flow:row.props.Flow,replacement});
 const actual=PNG.sync.read(await page.locator('#root').screenshot({omitBackground:true})),expected=PNG.sync.read(readFileSync(new URL(row.png,dir)));assert.deepEqual(actual.data,expected.data,surface+' '+row.name+' '+replacement);exact++;
 assert.equal(await page.locator('#root > * > *').count(),2,'slot content remains inside its one ranked host');
 }
 await render({order:'front',flow:'forward',replacement:2});const clear=PNG.sync.read(await page.locator('#root').screenshot());assert.deepEqual([...clear.data.subarray(840,844)],[0,0,255,255]);
 }
 assert.equal(exact,16);
 const data=createFigmaEngine({tokens,icons:new Map()}).compileComponentData(c,contracts);assert(data.variants.every(v=>v.spec.children?.find(n=>n.name==='ink')?.type==='slot'));
 for(const mutation of [{element:'span'},{declared:{'z-index':'9'}}]){const bad=structuredClone(c);Object.assign(bad.anatomy.root.parts.ink,mutation);assert.throws(()=>childPaintOrderPlans(bad,contracts),/child-paint-order/);}
});


test('public generation supplies the dependency graph to composed paint-order CSS',async()=>{
 const {mkdtempSync,writeFileSync,rmSync}=await import('node:fs');
 const {tmpdir}=await import('node:os');const path=await import('node:path');
 const {generateComponents}=await import('../scripts/generate-components.js');
 const dir=mkdtempSync(path.join(tmpdir(),'paint-order-generator-'));
 try {
 const c=JSON.parse(readFileSync(new URL('../contracts/badge.contract.json',import.meta.url),'utf8'));
 c.id='test.paint-parent';c.name='PaintParent';c.props=[];c.states=[];delete c.a11y;c.semantics={element:'div'};
 const child=structuredClone(c);child.id='test.paint-child';child.name='PaintChild';child.anatomy={root:{element:'div',literals:{width:'8px',height:'8px','background-color':'#ff0000'}}};
 c.anatomy={root:{element:'div',layout:{display:'flex',direction:'row',reversePaint:true},parts:{ink:{component:{id:child.id}},background:{element:'div',literals:{width:'20px',height:'20px','background-color':'#0000ff'}}}}};
 const contractFiles=[child,c].map((v,i)=>{const file=path.join(dir,i+'.contract.json');writeFileSync(file,JSON.stringify(v));return file;});
 const result=await generateComponents({contractFiles,tokenFiles:[],outDir:path.join(dir,'out'),stories:false});
 assert.equal(result.generated.length,2);
 const css=readFileSync(path.join(dir,'out','PaintParent','PaintParent.module.css'),'utf8');
 assert.match(css,/z-index: 2/);assert.match(css,/z-index: 1/);
 } finally {rmSync(dir,{recursive:true,force:true});}
});


test('default div slot hosts have the same paint-order rendering and native plan as explicit hosts',()=>{
 const c=JSON.parse(readFileSync(new URL('./fixtures/slot-paint-order-native/contract.json',import.meta.url),'utf8'));
 const child=structuredClone(c);child.id='qualification.default-slot-ink';child.name='DefaultSlotInk';child.props=[];child.anatomy={root:{literals:{width:'8px',height:'8px','background-color':'#ff0000'}}};
 c.anatomy.root.parts.ink={element:'div',slot:{name:'children',renderDefault:true,defaultContent:[{id:child.id}]}};
 const implicit=structuredClone(c);delete implicit.anatomy.root.parts.ink.element;
 const tokens={primitives:{},semantic:{},light:{},dark:{},brands:{default:{}}};
 const ctx={tokens:new Set<string>(),icons:new Map<string,string>(),contracts:new Map([[c.id,c],[child.id,child]])};
 assert.deepEqual(childPaintOrderPlans(implicit,ctx.contracts),childPaintOrderPlans(c,ctx.contracts));
 assert.deepEqual(emitReact(implicit,ctx),emitReact(c,ctx));
 assert.deepEqual(emitReactInline(implicit,{...ctx,tokens}),emitReactInline(c,{...ctx,tokens}));
 const engine=createFigmaEngine({tokens,icons:new Map()});
 assert.deepEqual(engine.compileComponentData(implicit,ctx.contracts),engine.compileComponentData(c,ctx.contracts));
 assert.throws(()=>emitWebComponent(implicit,ctx),/WEB_COMPONENT_JOINT_LAYOUT_UNSUPPORTED/);
 const caller=structuredClone(child);caller.id='qualification.paint-caller';caller.name='PaintCaller';caller.anatomy={root:{parts:{child:{component:{id:implicit.id}}}}};
 assert.throws(()=>emitWebComponent(caller,{...ctx,contracts:new Map([...ctx.contracts,[caller.id,caller]])}),/WEB_COMPONENT_JOINT_LAYOUT_UNSUPPORTED/);
});

test('Web Components preserve qualified child paint order across slot content and enum changes',async()=>{
 const fs=await import('node:fs'),os=await import('node:os'),path=await import('node:path');
 const {build}=await import('esbuild');const {tagOf}=await import('../packages/emitter-web-components/src/emit-wc.js');
 const c=JSON.parse(readFileSync(new URL('./fixtures/slot-paint-order-native/contract.json',import.meta.url),'utf8'));
 c.id='qualification.wc-paint';c.name='WcPaint';c.props=c.props.filter((p:any)=>p.name==='order');
 delete c.anatomy.root.layoutByCombination;
 c.anatomy.root.layoutByProp={prop:'order',map:{front:{direction:'row',justify:'center',align:'center',reversePaint:true},back:{direction:'row',justify:'center',align:'center',reversePaint:false}}};
 c.anatomy.root.parts.ink={slot:{name:'children'},literals:{width:'8px',height:'8px'}};
 const ctx={tokens:new Set<string>(),icons:new Map<string,string>(),contracts:new Map([[c.id,c]])};
 const result=emitWebComponent(c,ctx),tag=tagOf(c),dir=fs.mkdtempSync(path.join(os.tmpdir(),'wc-paint-order-'));
 const browser=await chromium.launch();try{
  fs.writeFileSync(path.join(dir,tag+'.ts'),result.element);fs.writeFileSync(path.join(dir,tag+'.css.ts'),result.stylesheet);
  const bundle=await build({entryPoints:[path.join(dir,tag+'.ts')],bundle:true,write:false,format:'iife',target:'es2022'});
  const page=await browser.newPage({viewport:{width:80,height:80}});
  await page.setContent(`<style>html,body{margin:0}</style><${tag}><div style="width:8px;height:8px;background:red"></div></${tag}>`);
  await page.addScriptTag({content:bundle.outputFiles[0].text});
  for(const order of ['front','back','front']){
   await page.locator(tag).evaluate((node,order)=>node.setAttribute('order',order),order);
   const root=page.locator(tag).locator('[part="root"]');const png=PNG.sync.read(await root.screenshot());
   const pixel=(10*png.width+10)*4;
   assert.deepEqual([...png.data.subarray(pixel,pixel+4)],order==='front'?[255,0,0,255]:[0,0,255,255],order);
   assert.deepEqual(await root.locator(':scope > *').evaluateAll(ns=>ns.map(n=>n.getAttribute('part'))),['ink','background']);
  }
 }finally{await browser.close();fs.rmSync(dir,{recursive:true,force:true});}
 const bad=structuredClone(c);bad.anatomy.root.parts.ink.declared={'z-index':'9'};
 assert.throws(()=>emitWebComponent(bad,{...ctx,contracts:new Map([[bad.id,bad]])}),/child-paint-order-authored-rank/);
});


test('filled-path definitions do not consume child paint ranks on either React surface',async()=>{
 const c=JSON.parse(readFileSync(new URL('../contracts/badge.contract.json',import.meta.url),'utf8'));
 c.props=[{name:'order',type:{enum:['front','back']},default:'front',bindings:{code:{prop:'order'},figma:{kind:'VARIANT',property:'Order'}}}];
 c.states=[];delete c.a11y;c.semantics={element:'div'};
 c.anatomy={root:{layout:{display:'flex',direction:'row',align:'center',justify:'center',reversePaint:true},layoutByProp:{prop:'order',map:{back:{reversePaint:false}}},declared:{position:'relative'},literals:{width:'20px',height:'20px'},parts:{
  ink:{element:'div',shape:{kind:'path',width:8,height:8,paths:[{data:'M0 0L8 0L8 8L0 8Z',windingRule:'NONZERO'}]},literals:{'background-color':'#ff0000'}},
  background:{element:'div',declared:{position:'absolute'},literals:{left:'0px',top:'0px',width:'20px',height:'20px','background-color':'#0000ff'}}}}};
 const tokens={primitives:{},semantic:{},light:{},dark:{},brands:{default:{}}};
 const ctx={tokens:new Set<string>(),tokenValues:tokens,icons:new Map<string,string>(),contracts:new Map([[c.id,c]])};
 const browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:40,height:40},deviceScaleFactor:1});
 try{for(const surface of ['module','inline']){
  const out=surface==='module'?emitReact(c,ctx):emitReactInline(c,{...ctx,tokens});
  const render=await mountGenerated(page,c.name,out.tsx,'css'in out?String(out.css):'');
  await page.addStyleTag({content:'html,body{margin:0}#root{width:20px;height:20px}'});
  for(const order of ['front','back','front']){
   await render({order});const png=PNG.sync.read(await page.locator('#root').screenshot());
   assert.deepEqual([...png.data.subarray((10*20+10)*4,(10*20+10)*4+4)],order==='front'?[255,0,0,255]:[0,0,255,255],surface+' '+order);
   assert.equal(await page.locator('#root > * > :not([data-dsc-paint-layer])').count(),2,'only the two painted children consume ranks');
  }
 }}finally{await browser.close();}

});

test('explicit partial permutations preserve flow and paint on both React surfaces and native generation',async()=>{
 const c=JSON.parse(readFileSync(new URL('../contracts/badge.contract.json',import.meta.url),'utf8'));
 c.props=[{name:'order',type:{enum:['abc','cab']},default:'abc',bindings:{code:{prop:'order'},figma:{kind:'VARIANT',property:'Order'}}}];
 c.states=[];delete c.a11y;c.semantics={element:'div'};
 c.anatomy={root:{layout:{display:'flex',direction:'row',align:'start',justify:'start',reversePaint:true,childOrder:['a','b','c']},layoutByProp:{prop:'order',map:{cab:{childOrder:['c','a','b']}}},literals:{width:'30px',height:'10px'},parts:Object.fromEntries(['a','b','c'].map((name,i)=>[name,{element:'div',literals:{width:'10px',height:'10px','background-color':['#ff0000','#00ff00','#0000ff'][i]}}]))}};
 const tokens={primitives:{},semantic:{},light:{},dark:{},brands:{default:{}}};
 const ctx={tokens:new Set<string>(),tokenValues:tokens,icons:new Map<string,string>(),contracts:new Map([[c.id,c]])};
 const browser=await chromium.launch({headless:true});
 try{for(const surface of ['module','inline']){
  const page=await browser.newPage();const out=surface==='module'?emitReact(c,ctx):emitReactInline(c,{...ctx,tokens});
  const render=await mountGenerated(page,c.name,out.tsx,'css'in out?String(out.css):'');
  for(const order of ['abc','cab','abc']){
   await render({order});const png=PNG.sync.read(await page.locator('#root > *').screenshot());
   const colors=[0,1,2].map(i=>[...png.data.subarray((5*png.width+i*10+5)*4,(5*png.width+i*10+5)*4+4)]);
   assert.deepEqual(colors,order==='abc'?[[255,0,0,255],[0,255,0,255],[0,0,255,255]]:[[0,0,255,255],[255,0,0,255],[0,255,0,255]],surface+' '+order);
  }
  await page.close();
 }}finally{await browser.close();}
 for(const part of Object.values(c.anatomy.root.parts) as any[]){part.declared={position:'absolute'};part.literals.left='0px';part.literals.top='0px';}
 c.anatomy.root.declared={position:'relative'};
 const overlapBrowser=await chromium.launch({headless:true});
 try{for(const surface of ['module','inline']){
  const page=await overlapBrowser.newPage(),out=surface==='module'?emitReact(c,ctx):emitReactInline(c,{...ctx,tokens});
  const render=await mountGenerated(page,c.name,out.tsx,'css'in out?String(out.css):'');
  for(const order of ['abc','cab']){
   await render({order});const png=PNG.sync.read(await page.locator('#root > *').screenshot());
   const offset=(5*png.width+5)*4;
   assert.deepEqual([...png.data.subarray(offset,offset+4)],order==='abc'?[255,0,0,255]:[0,0,255,255],surface+' overlap '+order);
  }
  await page.close();
 }}finally{await overlapBrowser.close();}
 const engine=createFigmaEngine({tokens,icons:new Map()});
 const data=engine.compileComponentData(c,ctx.contracts);
 assert.deepEqual(data.variants.map(v=>v.spec.children!.map(n=>n.name)),[['a','b','c'],['c','a','b']]);
 assert(data.variants.every(v=>v.spec.itemReverseZIndex===true));
 for(const order of [['a','a','c'],['a','b'],['a','b','unknown']]){
  const bad=structuredClone(c);bad.anatomy.root.layout.childOrder=order;
  assert.throws(()=>childPaintOrderPlans(bad,ctx.contracts),/permutation-invalid/);
 }
});

test('source partial permutations become explicit orders without mutating the dump',()=>{
 const dump=linkedPaintFixture();
 for(const [i,v] of dump.child.variants.entries()){
  v.children.push({...structuredClone(v.children[0]),name:'C'});
  if(i===1)v.children=[v.children[2],v.children[0],v.children[1]];
 }
 const before=JSON.stringify(dump.child);
 const result=proposeBatchFromDump({child:dump.child} as any,{fileKey:'paint-file',corpus:tokenCorpusFromJson({primitives:{},semantic:{},light:{},brandDefault:{}}),contractIdByName:new Map(),mintUnbound:true});
 assert.deepEqual(result.skipped,[]);
 const c=ContractSchema.parse(result.proposals[0].contract),keys=Object.keys(c.anatomy.root.parts!);
 assert.equal(keys.length,3);
 assert.deepEqual(resolveLayout(c.anatomy.root,{order:'front'})?.childOrder,keys);
 assert.deepEqual(resolveLayout(c.anatomy.root,{order:'back'})?.childOrder,[keys[2],keys[0],keys[1]]);
 assert.equal(JSON.stringify(dump.child),before);
});

test('partial child order excludes only instances already omitted as unbound and always hidden',()=>{
 const dump=linkedPaintFixture();
 for(const [i,v] of dump.child.variants.entries()){
  v.children.push({...structuredClone(v.children[0]),name:'C'});
  const hidden={name:'Hidden instance',type:'INSTANCE',instanceOf:'Unknown hidden main',hidden:true,bbox:{width:10,height:20}};
  v.children=(i===0?[v.children[0],hidden,v.children[1],v.children[2]]:[v.children[2],v.children[0],hidden,v.children[1]]) as any;
 }
 const options={fileKey:'paint-file',corpus:tokenCorpusFromJson({primitives:{},semantic:{},light:{},brandDefault:{}}),contractIdByName:new Map(),mintUnbound:true};
 const source=JSON.stringify(dump.child);
 const result=proposeBatchFromDump({child:dump.child} as any,options);
 assert.deepEqual(result.skipped,[]);
 const c=ContractSchema.parse(result.proposals[0].contract),keys=Object.keys(c.anatomy.root.parts!);
 assert.equal(keys.length,3);
 assert.deepEqual(resolveLayout(c.anatomy.root,{order:'front'})?.childOrder,keys);
 assert.deepEqual(resolveLayout(c.anatomy.root,{order:'back'})?.childOrder,[keys[2],keys[0],keys[1]]);
 assert.equal(JSON.stringify(dump.child),source);
 for(const binding of [{visible:'Show hidden'},{mainComponent:'Swap hidden'}]){
  const live=structuredClone(dump.child);
  for(const v of live.variants)(v.children.find(n=>n.name==='Hidden instance') as any).propRefs=binding;
  const projected=proposeBatchFromDump({child:live} as any,options);
  // A caller-controlled source cannot disappear merely to satisfy order proof.
  if(!projected.skipped.length){
   const contract=ContractSchema.parse(projected.proposals[0].contract);
   assert.equal(Object.keys(contract.anatomy.root.parts!).length,4);
  }
 }
});


test('root paint-order metadata preserves elided centered layout for every tuple',()=>{
 const {child}=linkedPaintFixture();
 for(const variant of child.variants){variant.layout={...variant.layout,primary:'CENTER',counter:'CENTER'};}
 const r=proposeBatchFromDump({child} as any,{fileKey:'paint-file',corpus:tokenCorpusFromJson({primitives:{},semantic:{},light:{},brandDefault:{}}),contractIdByName:new Map(),mintUnbound:true});
 assert.deepEqual(r.skipped,[]);
 const c=ContractSchema.parse(r.proposals[0].contract);
 for(const order of ['Front','Back']){
  const layout=resolveLayout(c.anatomy.root,{order});
  assert.equal(layout?.justify,'center');assert.equal(layout?.align,'center');
  assert.equal(layout?.direction,'row');
 }
});

test('normal source order remains explicit when absolute and flow siblings overlap',()=>{
 const dump=linkedPaintFixture();
 for(const v of dump.child.variants){
  v.itemReverseZIndex=false;
  Object.assign(v.children[0],{abs:{x:0,y:0,right:10,bottom:0,width:10,height:20,constraints:{horizontal:'LEFT',vertical:'TOP'}}});
 }
 const result=proposeBatchFromDump({child:dump.child} as any,{fileKey:'paint-file',corpus:tokenCorpusFromJson({primitives:{},semantic:{},light:{},brandDefault:{}}),contractIdByName:new Map(),mintUnbound:true});
 assert.deepEqual(result.skipped,[]);
 const c=ContractSchema.parse(result.proposals[0].contract);
 assert.equal(c.anatomy.root.layout?.reversePaint,false,'CSS positioned painting must not lift the first source sibling over the later flow sibling');
 assert.equal(childPaintOrderPlans(c).length,1);
});
