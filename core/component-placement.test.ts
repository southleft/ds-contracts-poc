import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {chromium} from 'playwright-core';
import {ContractSchema} from '../scripts/contract-schema.js';
import {validateContract} from '../packages/core/src/validate.js';
import {createFigmaEngine} from './emit-figma-script.js';
import {reactEmitter,reactInlineEmitter,htmlEmitter} from './emitter.js';
import {mountGenerated,generatedTypeErrors} from './react-test-runtime.js';
import {createFigmaMock} from '../scripts/plugin-engine-mock-figma.mjs';
import {resolveComponentPlacement} from '../scripts/contract-schema.js';

function fixture(left=1,top=1,border=0){
 const make=(id:string,name:string,root:unknown)=>ContractSchema.parse({id,name,description:'Fixed component placement fixture',version:'0.1.0',status:'draft',props:[],states:[],semantics:{element:'div'},anatomy:{root},bindings:{code:{anchors:{importPath:'./'+name,export:name}},figma:{anchors:{fileKey:null,componentSetKey:null}}}});
 const child=make('fixture.marker','Marker',{layout:{display:'flex'},declared:{position:'relative'},literals:{width:'18px',height:'10px','background-color':'#cc2211'}});
 const parent=make('fixture.panel','Panel',{layout:{display:'flex'},declared:{position:'relative'},literals:{width:'40px',height:'24px','background-color':'#eeeeee','border-width':border+'px','border-color':'#334455'},parts:{marker:{component:{id:child.id,props:{}},absolutePlacement:{left,top}}}});
 const ctx={contracts:new Map([[child.id,child],[parent.id,parent]]),icons:new Map<string,string>(),tokens:{primitives:{},semantic:{},light:{},dark:{},brands:{default:{}}}};
 const engine=createFigmaEngine({tokens:ctx.tokens,icons:ctx.icons});
 return {parent,child,ctx,engine};
}
function errors(f:ReturnType<typeof fixture>){const out:string[]=[];validateContract(f.parent,f.ctx.contracts,out,f.ctx.icons);return out;}

function combinationFixture() {
 const f=fixture(0,0,2);
 f.parent.props=[
  {name:'active',type:'boolean',bindings:{code:{prop:'active'},figma:{kind:'VARIANT',property:'Active',values:{false:'Off',true:'On'},unsetValue:'(unset)'}}},
  {name:'size',type:{enum:['small','large']},bindings:{code:{prop:'size'},figma:{kind:'VARIANT',property:'Size',values:{small:'Small',large:'Large'},unsetValue:'(unset)'}}},
 ];
 const part=f.parent.anatomy.root.parts!.marker;delete part.absolutePlacement;
 part.absolutePlacementByCombination={props:['active','size'],rows:[null,'false','true'].flatMap((active,i)=>[null,'small','large'].map((size,j)=>({values:[active,size],left:i*7.015625-3,top:j*2.125-1})))};
 return {...f,part,rows:part.absolutePlacementByCombination.rows};
}

test('complete placement tables retain one native dependency identity across all omitted and explicit tuples',async()=>{
 const f=combinationFixture();assert.deepEqual(errors(f),[]);assert(ContractSchema.safeParse(f.parent).success);
 const before=structuredClone(f.parent),data=f.engine.compileComponentData(f.parent,f.ctx.contracts);
 assert.equal(data.variants.length,9);
 const {figma,root}=createFigmaMock(),context=vm.createContext({figma,console:{log(){},warn(){},error(){}}});
 const run=(script:string)=>vm.runInContext(`(async()=>{${script}\n})()`,context,{timeout:20000});
 await run(f.engine.buildTokensScript(null));await run(f.engine.buildComponentScript(f.child,f.ctx.contracts));
 const script=f.engine.buildComponentScript(f.parent,f.ctx.contracts);await run(script);
 const main=root.findOne((n:any)=>n.type==='COMPONENT'&&n.getSharedPluginData('ds_contracts','contractId')===f.child.id);assert(main);
 const set=root.findOne((n:any)=>n.type==='COMPONENT_SET'&&n.getSharedPluginData('ds_contracts','contractId')===f.parent.id);assert(set);
 for(const row of f.rows){
  const subst=Object.fromEntries(row.values.flatMap((v,i)=>v===null?[]:[[i?'size':'active',v]]));
  assert.deepEqual(resolveComponentPlacement(f.part,subst),{left:row.left,top:row.top});
  const name=`Active=${row.values[0]===null?'(unset)':row.values[0]==='true'?'On':'Off'}, Size=${row.values[1]===null?'(unset)':row.values[1]==='small'?'Small':'Large'}`;
  const variant=data.variants.find(v=>v.name===name);assert(variant,name);
  const spec=variant.spec.children![0];assert.equal(spec.type,'instance');assert.equal(spec.depContractId,f.child.id);
  assert.deepEqual(spec.absolute,{h:'MIN',v:'MIN',left:row.left+2,top:row.top+2});
  const nativeVariant:any=set.children?.find((n:any)=>n.name===name);assert(nativeVariant?.children);
  const instance:any=nativeVariant.children.find((n:any)=>n.type==='INSTANCE');assert(instance);
  assert.equal((await instance.getMainComponentAsync()).id,main.id);assert.equal(instance.x,row.left+2);assert.equal(instance.y,row.top+2);
 }
 const ids=root.findAll((n:any)=>['COMPONENT','COMPONENT_SET','INSTANCE'].includes(n.type)).map((n:any)=>n.id);
 await run(script);assert.deepEqual(root.findAll((n:any)=>['COMPONENT','COMPONENT_SET','INSTANCE'].includes(n.type)).map((n:any)=>n.id),ids);
 assert.deepEqual(f.parent,before);
});

test('React placement tables preserve omission, exact pixels and the mounted child across live input changes',async t=>{
 const browser=await chromium.launch();t.after(()=>browser.close());
 for(const emitter of [reactEmitter,reactInlineEmitter]){
  const f=combinationFixture(),files=emitter.emit(f.parent,f.ctx),childFiles=emitter.emit(f.child,f.ctx);
  assert.deepEqual(generatedTypeErrors('Panel',files[0].contents,{Marker:childFiles[0].contents}),[]);
  const page=await browser.newPage(),oracle=await browser.newPage();
  await mountGenerated(page,'Panel',files[0].contents,files.find(f=>f.path.endsWith('.css'))?.contents,{Marker:{tsx:childFiles[0].contents,css:childFiles.find(f=>f.path.endsWith('.css'))?.contents}});
  const css=childFiles.find(f=>f.path.endsWith('.css'))?.contents;if(css)await page.addStyleTag({content:css});
  await page.addStyleTag({content:'body{margin:0}#root{padding:12px}'});
  await page.evaluate(()=>{(window as any).originalChild=document.querySelector('#root > * > *');});
  for(const row of [...f.rows,...f.rows.slice().reverse()]){
   const props=Object.fromEntries(row.values.flatMap((v,i)=>v===null?[]:[[i?'size':'active',i?v:v==='true']]));
   await page.evaluate(props=>(window as any).renderSubject(props),props);
   const geometry=await page.locator('#root > *').evaluate(root=>{const child=root.children[0],a=root.getBoundingClientRect(),b=child.getBoundingClientRect();return{x:b.x-a.x,y:b.y-a.y,width:b.width,height:b.height,count:root.children.length,same:child===(window as any).originalChild};});
   assert.deepEqual(geometry,{x:row.left+2,y:row.top+2,width:18,height:10,count:1,same:true},emitter.name+':'+JSON.stringify(props));
   await oracle.setContent(`<style>body{margin:0}#root{padding:12px}.panel{position:relative;display:flex;box-sizing:border-box;width:40px;height:24px;background:#eee;border:2px solid #345}.marker{position:absolute;box-sizing:border-box;left:${row.left}px;top:${row.top}px;width:18px;height:10px;background:#c21}</style><div id="root"><div class="panel"><div class="marker"></div></div></div>`);
   assert.deepEqual(await page.locator('#root').screenshot(),await oracle.locator('#root').screenshot(),emitter.name+':'+JSON.stringify(props));
  }
  await page.close();await oracle.close();
 }
});

test('placement table rejects incomplete domains, competing geometry, invalid tuples and unsupported surfaces',()=>{
 const mutations:Array<(f:ReturnType<typeof combinationFixture>)=>void>=[
  f=>{f.rows.pop();},f=>{f.rows[1]=structuredClone(f.rows[0]);},f=>{f.rows[0].values=['unknown',null];},
  f=>{f.rows[0].values=[null];},f=>{f.part.absolutePlacement={left:0,top:0};},
  f=>{f.part.absolutePlacementByCombination!.props=['active','active'];},
  f=>{f.parent.props[0].bindings.figma.kind='BOOLEAN';},
  f=>{f.child.anatomy.root.literals!.left='2px';},f=>{f.part.layout={grow:true};},
  f=>{f.parent.anatomy.root.declared=undefined;},
 ];
 for(const mutate of mutations){const f=combinationFixture();mutate(f);assert(errors(f).length,'invalid placement must refuse');}
 for(const value of [NaN,Infinity,-Infinity]){const f=combinationFixture();f.rows[0].left=value;assert(!ContractSchema.safeParse(f.parent).success);}
 const f=combinationFixture();assert.throws(()=>resolveComponentPlacement(f.part,{active:'unknown',size:'small'}),/combination-unavailable/);
 assert.throws(()=>htmlEmitter.emit(f.parent,f.ctx),/HTML_COMPONENT_ABSOLUTE_PLACEMENT_UNSUPPORTED/);
});

test('placement tables use canonical values behind renamed typed inputs and defaults',async t=>{
 const browser=await chromium.launch();t.after(()=>browser.close());
 for(const defaults of [false,true])for(const emitter of [reactEmitter,reactInlineEmitter]){
  const f=combinationFixture();
  f.parent.props[0].bindings.code.prop='enabled';
  f.parent.props[1].bindings.code={prop:'scale',values:{small:false,large:2}};
  if(defaults){
   f.parent.props[0].default=true;f.parent.props[1].default='large';
   for(const prop of f.parent.props)delete prop.bindings.figma.unsetValue;
   f.rows=f.rows.filter(row=>row.values.every(value=>value!==null));
   f.part.absolutePlacementByCombination!.rows=f.rows;
  }
  assert.deepEqual(errors(f),[]);
  const files=emitter.emit(f.parent,f.ctx),childFiles=emitter.emit(f.child,f.ctx);
  assert.deepEqual(generatedTypeErrors('Panel',files[0].contents,{Marker:childFiles[0].contents}),[]);
  const page=await browser.newPage();
  await mountGenerated(page,'Panel',files[0].contents,files.find(f=>f.path.endsWith('.css'))?.contents,{Marker:{tsx:childFiles[0].contents,css:childFiles.find(f=>f.path.endsWith('.css'))?.contents}});
  const inputs=[{},...f.rows.map(row=>Object.fromEntries(row.values.flatMap((v,i)=>v===null?[]:[[i?'scale':'enabled',i?(v==='small'?false:2):v==='true']]))),{}];
  for(const props of inputs){
   await page.evaluate(props=>(window as any).renderSubject(props),props);
   const values=[props.enabled===undefined?(defaults?'true':null):String(props.enabled),props.scale===undefined?(defaults?'large':null):props.scale===false?'small':'large'];
   const row=f.rows.find(row=>JSON.stringify(row.values)===JSON.stringify(values));assert(row);
   const geometry=await page.locator('#root > *').evaluate(root=>{const a=root.getBoundingClientRect(),b=root.children[0].getBoundingClientRect();return{x:b.x-a.x,y:b.y-a.y};});
   assert.deepEqual(geometry,{x:row.left+2,y:row.top+2},emitter.name+JSON.stringify(props));
  }
  await page.close();
 }
});

test('parent placement retains real native instances, exact borders/offsets and stable repeated creation',async()=>{
 for(const [left,top,border] of [[1,1,0],[16,1,0],[-7.015625,2.125,2]]){
  const f=fixture(left,top,border);assert.deepEqual(errors(f),[]);
  const before=structuredClone(f.parent),data=f.engine.compileComponentData(f.parent,f.ctx.contracts),spec=data.variants[0].spec.children![0];
  assert.equal(spec.type,'instance');assert.equal(spec.depContractId,f.child.id);
  assert.deepEqual(spec.absolute,{h:'MIN',v:'MIN',left:left+border,top:top+border});
  const {figma,root}=createFigmaMock(),context=vm.createContext({figma,console:{log(){},warn(){},error(){}}});
  const run=(script:string)=>vm.runInContext(`(async()=>{${script}\n})()`,context,{timeout:20000});
  await run(f.engine.buildTokensScript(null));
  await run(f.engine.buildComponentScript(f.child,f.ctx.contracts));
  const script=f.engine.buildComponentScript(f.parent,f.ctx.contracts);await run(script);
  const find=(id:string)=>root.findOne((n:any)=>n.type==='COMPONENT'&&n.getSharedPluginData('ds_contracts','contractId')===id);
  const main=find(f.child.id),parent=find(f.parent.id);assert(main);assert(parent?.children);const instance:any=parent.children.find((n:any)=>n.type==='INSTANCE');
  assert(instance);assert.equal((await instance.getMainComponentAsync()).id,main.id);assert.equal(instance.layoutPositioning,'ABSOLUTE');
  assert.equal(instance.x,left+border);assert.equal(instance.y,top+border);assert.equal(instance.width,18);assert.equal(instance.height,10);
  const ids=root.findAll((n:any)=>['COMPONENT','INSTANCE'].includes(n.type)).map((n:any)=>n.id);
  await run(script);assert.deepEqual(root.findAll((n:any)=>['COMPONENT','INSTANCE'].includes(n.type)).map((n:any)=>n.id),ids);
  assert.deepEqual(f.parent,before);
 }
});

test('both generated React surfaces match original parent/child geometry and pixels without wrappers',async t=>{
 const browser=await chromium.launch();t.after(()=>browser.close());
 for(const [left,top,border] of [[1,1,0],[16,1,0],[-7.015625,2.125,2]])for(const emitter of [reactEmitter,reactInlineEmitter]){
  const f=fixture(left,top,border),files=emitter.emit(f.parent,f.ctx),childFiles=emitter.emit(f.child,f.ctx);
  assert.deepEqual(generatedTypeErrors('Panel',files[0].contents,{Marker:childFiles[0].contents}),[]);
  const page=await browser.newPage();
  await mountGenerated(page,'Panel',files[0].contents,files.find(f=>f.path.endsWith('.css'))?.contents,{Marker:{tsx:childFiles[0].contents,css:childFiles.find(f=>f.path.endsWith('.css'))?.contents}});
  // Keep dependency CSS last: parent placement must not depend on bundler order.
  const css=childFiles.find(f=>f.path.endsWith('.css'))?.contents;if(css){const style=await page.locator('style').allTextContents();await page.addStyleTag({content:style.join('\n')});}
  await page.addStyleTag({content:'body{margin:0}#root{padding:12px}'});
  const measured=await page.locator('#root > *').evaluate(root=>{const c=root.children[0],r=root.getBoundingClientRect(),b=c.getBoundingClientRect();return {x:b.x-r.x,y:b.y-r.y,width:b.width,height:b.height,children:root.children.length,grandchildren:c.children.length};});
  assert.deepEqual(measured,{x:left+border,y:top+border,width:18,height:10,children:1,grandchildren:0},emitter.name);
  const generated=await page.locator('#root').screenshot();
  await page.setContent(`<style>body{margin:0}#root{padding:12px}.panel{position:relative;display:flex;box-sizing:border-box;width:40px;height:24px;background:#eee;border:${border}px solid #345}.marker{position:absolute;box-sizing:border-box;left:${left}px;top:${top}px;width:18px;height:10px;background:#c21}</style><div id="root"><div class="panel"><div class="marker"></div></div></div>`);
  assert.deepEqual(await page.locator('#root').screenshot(),generated,emitter.name+':'+left);
  await page.close();
 }
});

test('unknown hosts, competing geometry and mixed placement refuse by name',()=>{
 const mutations:Array<(f:ReturnType<typeof fixture>)=>void>=[
  f=>{f.parent.anatomy.root.parts!.marker.component=undefined;},
  f=>{f.parent.anatomy.root.declared=undefined;},
  f=>{f.parent.anatomy.root.declaredStates={hover:{position:'static'}};},
  f=>{f.child.anatomy.root.declaredStates={hover:{position:'relative'}};},
  f=>{f.child.anatomy.root.declared={transform:'matrix(1, 0, 0, 1, 3, 0)'};},
  f=>{f.child.anatomy.root.literals!.left='2px';},
  f=>{f.parent.anatomy.root.parts!.marker.layout={grow:true};},
  f=>{f.parent.anatomy.root.parts!.marker.parts={label:{}};},
  f=>{f.parent.anatomy.root.parts!.marker.literals={'background-color':'#000000'};},
  f=>{f.child.anatomy.root.literals!['margin-left']='1px';},
  f=>{f.child.props=[{name:'style',type:'text',bindings:{code:{prop:'style'},figma:{kind:'TEXT',property:'Style'}}}];},
 ];
 for(const mutate of mutations){const f=fixture();mutate(f);assert(errors(f).some(e=>e.includes('component-absolute-placement-unproven')));}
 const html=fixture();assert.throws(()=>htmlEmitter.emit(html.parent,html.ctx),/HTML_COMPONENT_ABSOLUTE_PLACEMENT_UNSUPPORTED/);
 const c=fixture().parent;for(const value of [NaN,Infinity,-Infinity]){c.anatomy.root.parts!.marker.absolutePlacement!.left=value;assert.equal(ContractSchema.safeParse(c).success,false);}
});
