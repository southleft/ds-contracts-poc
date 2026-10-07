import {affineLayoutFixture} from './fixtures/instance-affine-layout.js';
import {instanceAffineCss} from './instance-affine-css.js';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {createFigmaMock} from '../scripts/plugin-engine-mock-figma.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
import {ContractSchema,allocateInstanceAffine} from '../scripts/contract-schema.js';
import {emitReact,validateContract} from './emit-react.js';
import {emitReactInline} from './emit-react-inline.js';
import {createFigmaEngine} from './emit-figma-script.js';
import {mountGenerated,generatedTypeErrors} from './react-test-runtime.js';
const tokens={primitives:{},semantic:{},light:{},dark:{},brands:{default:{}}};
function fixture(){const base={version:'1.0.0',archetype:'none',description:'Affine instance',semantics:{element:'div'},props:[],states:[],bindings:{code:{anchors:{importPath:'./Ink',export:'Ink'}},figma:{anchors:{fileKey:null,componentSetKey:null}}}};
 const child=ContractSchema.parse({...base,id:'probe.ink',name:'Ink',anatomy:{root:{layout:{display:'flex'},literals:{width:'40px',height:'12px'},parts:{mark:{literals:{width:'10px',height:'12px','background-color':'#6750a4'}}}}}});
 const parent=ContractSchema.parse({...base,id:'probe.host',name:'Host',bindings:{...base.bindings,code:{anchors:{importPath:'./Host',export:'Host'}}},anatomy:{root:{layout:{display:'flex',align:'start'},parts:{turned:{component:{id:child.id},instanceAffine:{localSize:{width:40,height:12},transform:[[0,-1,12],[1,0,0]]}},sibling:{literals:{width:'10px',height:'10px'}}}}}});
 return {child,parent};}
test('generated React consumers and native spec preserve rotated allocation and child local size',async()=>{
 const {child,parent}=fixture(),contracts=new Map([[child.id,child],[parent.id,parent]]),icons=new Map<string,string>();
 const errors:string[]=[];validateContract(parent,contracts,errors,icons);assert.deepEqual(errors,[]);
 const engine=createFigmaEngine({tokens,icons});const data=engine.compileComponentData(parent,contracts);
 const host=data.variants[0].spec.children![0];assert.equal(host.affineViewport,true);assert.deepEqual(host.lits,{width:12,height:40});
 assert.deepEqual(host.children![0].instanceAffineAllocation!.normalizedTransform,[[0,-1,12],[1,0,0]]);
 const script=engine.buildComponentScript(parent,contracts);assert(script.includes("if (spec.affineViewport) node.layoutMode = 'NONE'"));
 const start=script.indexOf('  if (childSpec.instanceAffineAllocation) {'),end=script.indexOf('\n  try {',start);assert(start>0&&end>start);
 const place=new Function('parent','childNode','childSpec',script.slice(start,end));
 const node:any={width:40,height:12};place({layoutMode:'NONE'},node,host.children![0]);assert.deepEqual(node.relativeTransform,[[0,-1,12],[1,0,0]]);
 assert.throws(()=>place({layoutMode:'NONE'},{width:41,height:12},host.children![0]),/local-size-mismatch/);
 const browser=await chromium.launch();try{for(const inline of [false,true]){
  const emit=(c:typeof child)=>inline?{...emitReactInline(c,{contracts,icons,tokens}),css:''}:emitReact(c,{contracts,icons,tokens:new Set()});
  const dep=emit(child),code=emit(parent);assert.deepEqual(generatedTypeErrors(parent.name,code.tsx,{Ink:dep.tsx}),[]);
  const page=await browser.newPage();try{const render=await mountGenerated(page,parent.name,code.tsx,code.css,{Ink:dep});await render({});
   const b=await page.locator('#root > *').evaluate(root=>{const host=root.children[0],child=host.children[0].children[0],next=root.children[1];const r=root.getBoundingClientRect(),h=host.getBoundingClientRect(),c=child.getBoundingClientRect(),n=next.getBoundingClientRect();return {host:[h.width,h.height],child:[c.width,c.height],next:n.x-r.x};});
   assert.deepEqual(b,{host:[12,40],child:[12,40],next:12});
  }finally{await page.close();}
 }}finally{await browser.close();}
});
test('unproven child sizes and competing geometry refuse before rendering',()=>{
 for(const change of [(p:any,c:any)=>c.anatomy.root.literals.width='41px',(p:any)=>p.anatomy.root.parts.turned.layout={grow:true},(p:any)=>p.anatomy.root.parts.turned.repeat={prop:'items'}]){
  const {parent,child}=fixture();change(parent,child);const errors:string[]=[];validateContract(parent,new Map([[parent.id,parent],[child.id,child]]),errors,new Map());assert(errors.some(e=>e.includes('instance-affine-host-unproven')));
 }
});

test('full native generation and canonical capture preserve linked instance geometry through its allocation frame',async()=>{
 const {parent,child}=fixture(),contracts=new Map([[child.id,child],[parent.id,parent]]);
 const engine=createFigmaEngine({tokens,icons:new Map()});
 const {figma,root}=createFigmaMock();const context=vm.createContext({figma,console:{log(){},warn(){},error(){}}});
 const run=(script:string)=>vm.runInContext(`(async()=>{${script}\n})()`,context,{timeout:20000});
 await run(engine.buildTokensScript(null));await run(engine.buildComponentScript(child,contracts));await run(engine.buildComponentScript(parent,contracts));
 const host:any=root.findOne((n:any)=>n.type==='COMPONENT'&&n.getSharedPluginData('ds_contracts','contractId')===parent.id);assert(host);
 const allocation=host.children[0];assert.equal(allocation.layoutMode,'NONE');assert.deepEqual([allocation.width,allocation.height],[12,40]);
 const instance=allocation.children[0];assert.equal(instance.type,'INSTANCE');assert.deepEqual(JSON.parse(JSON.stringify(instance.relativeTransform)),[[0,-1,12],[1,0,0]]);
 assert.equal((await instance.getMainComponentAsync()).getSharedPluginData('ds_contracts','contractId'),child.id);
 // Exercise the canonical producer against the complete generated hierarchy,
 // including the allocation wrapper; helper-only capture misses this boundary.
 const reader=readFileSync(new URL('../extract/figma/dump.plugin.js',import.meta.url),'utf8')
  .replace(/^const TARGET_SETS = \[[^\n]*\];$/m,"const TARGET_SETS = ['Host'];");
 const captured:any=await run(reader);
 const observed=captured.Host.variants[0].children[0];
 assert.equal(observed.type,'FRAME');
 const linked=observed.children[0];
 assert.equal(linked.type,'INSTANCE');
 assert.deepEqual(JSON.parse(JSON.stringify(linked.instanceGeometry)),{
  nodeId:instance.id,componentId:(await instance.getMainComponentAsync()).id,
  localSize:{width:40,height:12},transform:[[0,-1,12],[1,0,0]],
 });
});

test('token-sized children require matching values in every supplied scope',()=>{
 const {parent,child}=fixture();delete child.anatomy.root.literals!.width;delete child.anatomy.root.literals!.height;
 child.anatomy.root.tokens={width:'{size.w}',height:'{size.h}'};child.anatomy.root.declared={position:'relative'};
 const contracts=new Map([[parent.id,parent],[child.id,child]]),icons=new Map<string,string>();
 const values={...tokens,primitives:{size:{w:{$type:'dimension',$value:'40px'},h:{$type:'dimension',$value:'12px'}}}};
 const inventory=new Set(['size.w','size.h']);
 assert.doesNotThrow(()=>emitReact(parent,{contracts,icons,tokens:inventory,tokenValues:values}));
 assert.doesNotThrow(()=>emitReactInline(parent,{contracts,icons,tokens:values}));
 assert.doesNotThrow(()=>createFigmaEngine({tokens:values,icons}).buildComponentScript(parent,contracts));
 assert.throws(()=>emitReact(parent,{contracts,icons,tokens:inventory}),/token-dimension-unproven/);
 const bad={...values,dark:{size:{w:{$type:'dimension',$value:'41px'}}}};
 assert.throws(()=>emitReact(parent,{contracts,icons,tokens:inventory,tokenValues:bad}),/token-dimension-unproven/);
 assert.throws(()=>emitReactInline(parent,{contracts,icons,tokens:bad}),/token-dimension-unproven/);
 assert.throws(()=>createFigmaEngine({tokens:bad,icons}).buildComponentScript(parent,contracts),/token-dimension-unproven/);
});

test('source inference carries complete uniform or single-enum rigid geometry with same-file key identity',async()=>{
 const {proposeFromDump,asMinimalChildContract}=await import('./propose-figma.js');
 const {tokenCorpusFromJson}=await import('./token-corpus.js');
 const {child}=fixture();child.bindings.figma.anchors={fileKey:'fixture',componentSetKey:'ink-key'};
 const make=()=>({setName:'SourceHost',type:'COMPONENT_SET',propertyDefinitions:{State:{type:'VARIANT',defaultValue:'A',variantOptions:['A','B']}},variants:['A','B'].map(state=>({name:`State=${state}`,type:'COMPONENT',variantProperties:{State:state},layout:{mode:'HORIZONTAL',primary:'MIN',counter:'MIN',spacing:0,padding:[0,0,0,0],primarySizing:'AUTO',counterSizing:'AUTO'},children:[{name:'turned',type:'INSTANCE',instanceOf:'Ink',instanceKey:'ink-key',instanceGeometry:{nodeId:'n'+state,componentId:'main',localSize:{width:40,height:12},transform:[[-1,0,40],[0,-1,12]]}}]}))});
 const options={corpus:tokenCorpusFromJson({primitives:{},semantic:{},light:{},brandDefault:{}}),mintUnbound:true,fileKey:'fixture',contractIdByName:new Map([['Ink',child.id]]),contractIdByKey:new Map([['ink-key',child.id]]),contractsById:new Map([[child.id,asMinimalChildContract(child)]])};
 const run=(dump:any)=>ContractSchema.parse(proposeFromDump(dump,options).contract).anatomy.root.parts!.turned;
 assert(run(make()).instanceAffine);
 const varying=make();varying.variants[1].children[0].instanceGeometry.transform=[[0,-1,12],[1,0,0]];
 const mapped=run(varying);assert.equal(mapped.instanceAffine,undefined);assert.deepEqual(Object.keys(mapped.instanceAffineByProp!.map),['a','b']);
 assert.deepEqual(mapped.instanceAffineByProp!.map.b.transform,[[0,-1,12],[1,0,0]]);
 for(const change of [(d:any)=>delete d.variants[1].children[0].instanceGeometry,(d:any)=>d.variants[1].children[0].instanceGeometry.transform[0][0]=2,(d:any)=>d.variants[1].children[0].fillWidth=true]){const d=make();change(d);assert.equal(run(d).instanceAffine,undefined);assert.equal(run(d).instanceAffineByProp,undefined);}
 child.bindings.figma.anchors.fileKey='other';options.contractsById.set(child.id,asMinimalChildContract(child));assert.equal(run(make()).instanceAffine,undefined);
});

test('inline child roots do not introduce a baseline offset inside the affine host',async()=>{
 const {parent,child}=fixture();delete child.anatomy.root.layout;child.anatomy.root.element='span';
 const contracts=new Map([[parent.id,parent],[child.id,child]]),icons=new Map<string,string>();
 const browser=await chromium.launch();try{for(const inline of [false,true]){
  const emit=(c:typeof child)=>inline?{...emitReactInline(c,{contracts,icons,tokens}),css:''}:emitReact(c,{contracts,icons,tokens:new Set()});
  const output=emit(parent),dep=emit(child),page=await browser.newPage();try{const render=await mountGenerated(page,parent.name,output.tsx,output.css,{Ink:dep});await render({});
   const delta=await page.locator('#root > * > :first-child').evaluate(host=>{const child=host.children[0].children[0];const h=host.getBoundingClientRect(),c=child.getBoundingClientRect();return [c.x-h.x,c.y-h.y];});assert.deepEqual(delta,[0,0]);
  }finally{await page.close();}
 }}finally{await browser.close();}
});

test('variant transforms preserve allocation and child identity across both React emitters and native variants',async t=>{
 const {parent,child}=fixture(),part=parent.anatomy.root.parts!.turned;
 parent.props=[{name:'orientation',type:{enum:['normal','turned','reflected']},default:'normal',bindings:{code:{prop:'direction'},figma:{kind:'VARIANT',property:'Orientation',values:{normal:'Normal',turned:'Turned',reflected:'Reflected'}}}}];
 const geometry=part.instanceAffine!;delete part.instanceAffine;
 part.instanceAffineByProp={prop:'orientation',map:{normal:{...geometry,transform:[[1,0,0],[0,1,0]]},turned:geometry,reflected:{...geometry,transform:[[1,0,0],[0,-1,12]]}}};
 assert(ContractSchema.safeParse(parent).success);
 const contracts=new Map([[parent.id,parent],[child.id,child]]),icons=new Map<string,string>();
 const native=createFigmaEngine({tokens,icons}).compileComponentData(parent,contracts);
 assert.deepEqual(native.variants.map(v=>[v.spec.children![0].lits!.width,v.spec.children![0].lits!.height]),[[40,12],[12,40],[40,12]]);
 assert.deepEqual(native.variants.map(v=>v.spec.children![0].children![0].instanceAffineAllocation!.normalizedTransform),Object.values(part.instanceAffineByProp.map).map(value=>allocateInstanceAffine(value)).map(result=>'allocation'in result?result.allocation.normalizedTransform:null));
 const engine=createFigmaEngine({tokens,icons}),mock=createFigmaMock();
 const context=vm.createContext({figma:mock.figma,console:{log(){},warn(){},error(){}}});
 const run=(script:string)=>vm.runInContext(`(async()=>{${script}\n})()`,context,{timeout:20000});
 await run(engine.buildTokensScript(null));await run(engine.buildComponentScript(child,contracts));await run(engine.buildComponentScript(parent,contracts));
 const generated:any[]=mock.root.findOne((n:any)=>n.type==='COMPONENT_SET'&&n.getSharedPluginData('ds_contracts','contractId')===parent.id)!.children!;
 assert.equal(generated.length,3);
 for(const [index,node] of generated.entries()){
  const instance=node.children[0].children[0];assert.equal(instance.type,'INSTANCE');
  assert.equal((await instance.getMainComponentAsync()).getSharedPluginData('ds_contracts','contractId'),child.id);
  assert.deepEqual(JSON.parse(JSON.stringify(instance.relativeTransform)),native.variants[index].spec.children![0].children![0].instanceAffineAllocation!.normalizedTransform);
 }
 const browser=await chromium.launch();t.after(()=>browser.close());
 for(const inline of [false,true]){
  const emit=(c:typeof child)=>inline?{...emitReactInline(c,{contracts,icons,tokens}),css:''}:emitReact(c,{contracts,icons,tokens:new Set()});
  const dep=emit(child),out=emit(parent);assert.deepEqual(generatedTypeErrors(parent.name,out.tsx,{Ink:dep.tsx}),[]);
  const page=await browser.newPage(),render=await mountGenerated(page,parent.name,out.tsx,out.css,{Ink:dep});
  for(const [direction,expected] of [['normal',[40,12]],['turned',[12,40]],['reflected',[40,12]]] as const){
   await render({direction});
   assert.deepEqual(await page.locator('#root > *').evaluate(root=>{const h=root.children[0].getBoundingClientRect(),child=root.children[0].children[0].children[0].getBoundingClientRect(),next=root.children[1].getBoundingClientRect();return [h.width,h.height,child.width,child.height,next.x-root.getBoundingClientRect().x];}),[...expected,...expected,expected[0]]);
   assert.equal(await page.locator('#root > * > :first-child > :first-child').evaluate(n=>getComputedStyle(n).transform),direction==='normal'?'matrix(1, 0, 0, 1, 0, 0)':direction==='turned'?'matrix(0, 1, -1, 0, 12, 0)':'matrix(1, 0, 0, -1, 0, 12)');
  }
  await render({});assert.equal(await page.locator('#root > * > :first-child').evaluate(n=>n.getBoundingClientRect().width),40);
  await page.close();
 }
 for(const edit of [(p:any)=>delete p.anatomy.root.parts.turned.instanceAffineByProp.map.reflected,
  (p:any)=>p.anatomy.root.parts.turned.instanceAffineByProp.map.reflected.localSize={width:41,height:12},
  (p:any)=>delete p.props[0].default,
  (p:any)=>p.anatomy.root.parts.turned.instanceAffine=geometry]){
  const bad=structuredClone(parent);edit(bad);assert.equal(ContractSchema.safeParse(bad).success,false);
 }
});

test('quarter-turn allocation keeps live FILL extents through parent resizing without paint scaling',async()=>{
 const browser=await chromium.launch();try{const page=await browser.newPage();
  for(const transform of [[[0,1,0],[-1,0,169]],[[0,-1,16],[1,0,0]],[[0,1,0],[1,0,0]],[[0,-1,16],[-1,0,169]]] as const){
   const observation={localSize:{width:169,height:16},transform:transform.map(row=>[...row]) as [[number,number,number],[number,number,number]]};
   const plan=instanceAffineCss(observation,{height:true});
   await page.setContent('<script>globalThis.__name=value=>value</script><div id="parent"><div id="host"><div id="local"><div id="ink"></div></div></div><div id="fixed"></div></div>');
   await page.evaluate(({outer,inner,child})=>{
    const apply=(id:string,styles:Record<string,string|number>)=>{const e=document.getElementById(id)!;for(const [key,value] of Object.entries(styles))(e.style as any)[key]=typeof value==='number'&& !['flexShrink','flexGrow'].includes(key)?value+'px':String(value);};
    apply('parent',{display:'flex',flexDirection:'column',width:44,height:185,alignItems:'center',gap:6});
    apply('host',{...outer,flex:'1 1 0px'});apply('local',inner);apply('ink',{...child!,border:'2px solid black',boxSizing:'border-box',background:'purple'});apply('fixed',{width:44,height:10,flex:'none'});
   },plan);
   for(const height of [185,285,135]){
    await page.locator('#parent').evaluate((e,h)=>e.style.height=h+'px',height);
    const actual=await page.locator('#ink').evaluate(e=>({local:[(e as HTMLElement).offsetWidth,(e as HTMLElement).offsetHeight],paint:[e.getBoundingClientRect().width,e.getBoundingClientRect().height],border:getComputedStyle(e).borderLeftWidth,host:[e.parentElement!.parentElement!.getBoundingClientRect().width,e.parentElement!.parentElement!.getBoundingClientRect().height]}));
    assert.deepEqual(actual,{local:[height-16,16],paint:[16,height-16],border:'2px',host:[16,height-16]});
   }
  }
 }finally{await browser.close()}
});
test('live fill rejects oblique transforms while fixed allocation keeps them',()=>{
 const observation={localSize:{width:40,height:12},transform:[[Math.SQRT1_2,-Math.SQRT1_2,0],[Math.SQRT1_2,Math.SQRT1_2,0]] as [[number,number,number],[number,number,number]]};
 assert.doesNotThrow(()=>instanceAffineCss(observation));assert.throws(()=>instanceAffineCss(observation,{width:true}),/fill-requires-quarter-turn/);
});

test('axis-preserving rotations and reflections retain width and height FILL independently',async()=>{
 const browser=await chromium.launch();try{const page=await browser.newPage();
  for(const signs of [[1,1],[-1,1],[1,-1],[-1,-1]])for(const axis of ['width','height'] as const){
   const observation={localSize:{width:40,height:12},transform:[[signs[0],0,0],[0,signs[1],0]] as [[number,number,number],[number,number,number]]};
   const plan=instanceAffineCss(observation,{[axis]:true});
   await page.setContent('<script>globalThis.__name=value=>value</script><div id="host"><div id="local"><div id="ink"></div></div></div>');
   await page.evaluate(({outer,inner,child})=>{const apply=(id:string,s:Record<string,string|number>)=>{const e=document.getElementById(id)!;for(const [k,v]of Object.entries(s))(e.style as any)[k]=typeof v==='number'&&k!=='flexShrink'?v+'px':String(v);};apply('host',outer);apply('local',inner);apply('ink',child!);},plan);
   for(const extent of [50,100,20]){
    await page.locator('#host').evaluate((e,{axis,extent})=>e.style[axis]=extent+'px',{axis,extent});
    const actual=await page.locator('#ink').evaluate(e=>{const a=e.getBoundingClientRect(),b=e.parentElement!.parentElement!.getBoundingClientRect();return {width:a.width,height:a.height,dx:a.x-b.x,dy:a.y-b.y}});
    assert.deepEqual(actual,{width:axis==='width'?extent:40,height:axis==='height'?extent:12,dx:0,dy:0});
   }
  }
 }finally{await browser.close()}
});

test('qualified resized instance contracts preserve FILL on both React surfaces and native plans',async()=>{
 const {parent,child,contracts,icons,tokens,inventory}=affineLayoutFixture();
 const engine=createFigmaEngine({tokens,icons}),data=engine.compileComponentData(parent,contracts);
 assert.equal(data.variants.length,4);
 for(const variant of data.variants){const host=variant.spec.children![0],ink=host.children![0];assert(host.affineViewport);assert(ink.instanceAffineFill);assert.equal(!!host.fillW,ink.instanceAffineFill.width);assert.equal(!!host.fillH,ink.instanceAffineFill.height);}
 const mock=createFigmaMock(),context=vm.createContext({figma:mock.figma,console:{log(){},warn(){},error(){}}});const run=(s:string)=>vm.runInContext(`(async()=>{${s}\n})()`,context);
 await run(engine.buildTokensScript(null));await run(engine.buildComponentScript(child,contracts));await run(engine.buildComponentScript(parent,contracts));
 const native:any=mock.root.findOne((n:any)=>n.getSharedPluginData('ds_contracts','contractId')===parent.id);assert(native);
 const instances=native.findAll((n:any)=>n.type==='INSTANCE');assert.equal(instances.length,4);
 assert(instances.some((n:any)=>n.constraints.vertical==='STRETCH'));assert(instances.some((n:any)=>n.constraints.horizontal==='STRETCH'));
 const browser=await chromium.launch();try{for(const inline of [false,true]){
  const emit=(c:typeof parent)=>inline?{...emitReactInline(c,{contracts,icons,tokens}),css:''}:emitReact(c,{contracts,icons,tokens:inventory,tokenValues:tokens});
  const code=emit(parent),dep=emit(child);assert.deepEqual(generatedTypeErrors(parent.name,code.tsx,{[child.name]:dep.tsx}),[]);
  const page=await browser.newPage(),render=await mountGenerated(page,parent.name,code.tsx,code.css,{[child.name]:dep});
  for(const orientation of ['normal','turned'])for(const extent of ['short','long']){
   await render({orientation,extent});
   for(const length of [extent==='short'?80:120,180]){
    await page.locator('#root > *').evaluate((e,{orientation,length})=>e.style[orientation==='normal'?'width':'height']=length+'px',{orientation,length});
    const actual=await page.locator('#root > * > span > span > *').evaluate(e=>({width:e.getBoundingClientRect().width,height:e.getBoundingClientRect().height,localWidth:(e as HTMLElement).offsetWidth,localHeight:(e as HTMLElement).offsetHeight}));
    assert.deepEqual(actual,{width:orientation==='normal'?length:12,height:orientation==='normal'?12:length,localWidth:length,localHeight:12});
   }
  }await page.close();
 }}finally{await browser.close()}
});
test('resized allocation rejects incomplete rows, wrong child inputs, geometry competition and unproved cross dimensions',()=>{
 for(const mutate of [(p:any)=>p.anatomy.root.parts.ink.instanceAffineLayout.rows.pop(),(p:any)=>p.anatomy.root.parts.ink.instanceAffineLayout.rows[0].values=['normal','bogus']]){const {parent}=affineLayoutFixture();mutate(parent);assert.equal(ContractSchema.safeParse(parent).success,false);}
 for(const mutate of [(p:any,c:any)=>c.anatomy.root.instanceRootInputs=['width'],(p:any)=>p.anatomy.root.parts.ink.declared={transform:'rotate(10deg)'},(p:any)=>p.anatomy.root.parts.ink.layout.grow=false,(p:any)=>p.anatomy.root.parts.ink.literalsByProp=[{prop:'extent',map:{short:{width:'999px'}}}]]){
  const {parent,child,contracts,icons}=affineLayoutFixture();mutate(parent,child);const errors:string[]=[];validateContract(parent,contracts,errors,icons);assert(errors.some(e=>e.includes('instance-affine-layout')));
 }
 const stateFixture=affineLayoutFixture();stateFixture.child.anatomy.root.declaredStates={hover:{height:'99px'}};
 assert.throws(()=>emitReact(stateFixture.parent,{contracts:stateFixture.contracts,icons:stateFixture.icons,tokens:stateFixture.inventory,tokenValues:stateFixture.tokens}),/instance-affine-layout-size-unproven/);
 const {parent,contracts,icons,tokens,inventory}=affineLayoutFixture();tokens.primitives.dims.h.$value='13px';
 assert.throws(()=>emitReact(parent,{contracts,icons,tokens:inventory,tokenValues:tokens}),/instance-affine-layout-size-unproven/);
 assert.throws(()=>createFigmaEngine({tokens,icons}).buildComponentScript(parent,contracts),/instance-affine-layout-size-unproven/);
});

test('owned fixed frames carry exact rigid matrices through both React consumers and native compilation',async t=>{
 const browser=await chromium.launch();t.after(()=>browser.close());
 const matrices=[[[0,-1,12],[1,0,0]],[[-1,0,40],[0,1,0]],[[Math.SQRT1_2,-Math.SQRT1_2,0],[Math.SQRT1_2,Math.SQRT1_2,0]],[[1,5.551115123125783e-17,5],[-5.551115123125783e-17,1,5]]];
 for(const transform of matrices){
  const {parent,child}=fixture();const part=parent.anatomy.root.parts!.turned;
  delete part.component;Object.assign(part,structuredClone(child.anatomy.root));
  part.instanceAffine={localSize:{width:40,height:12},transform:transform as any};
  const contracts=new Map([[parent.id,parent]]),icons=new Map<string,string>(),errors:string[]=[];
  validateContract(parent,contracts,errors,icons);assert.deepEqual(errors,[]);
  const allocation=allocateInstanceAffine(part.instanceAffine);assert('allocation' in allocation);
  const a=allocation.allocation,engine=createFigmaEngine({tokens,icons}),data=engine.compileComponentData(parent,contracts);
  const host=data.variants[0].spec.children![0];assert.equal(host.affineViewport,true);
  assert.equal(host.children![0].type,'frame');assert.deepEqual(host.children![0].instanceAffineAllocation,a);
  assert.equal(host.children![0].children![0].name,'mark');
  const script=engine.buildComponentScript(parent,contracts),mock=createFigmaMock();
  const context=vm.createContext({figma:mock.figma,console:{log(){},warn(){},error(){}}});
  await vm.runInContext(`(async()=>{${script}\n})()`,context);
  const target:any=mock.root.findOne((n:any)=>n.getSharedPluginData('ds_contracts','contractId')===parent.id);
  const nativeLocal=target.children[0].children[0];
  assert.deepEqual(JSON.parse(JSON.stringify(nativeLocal.relativeTransform)),a.normalizedTransform);
  assert.equal(nativeLocal.type,'FRAME');assert.equal(nativeLocal.children[0].name,'mark');
  for(const inline of [false,true]){
   const code=inline?{...emitReactInline(parent,{contracts,icons,tokens}),css:''}:emitReact(parent,{contracts,icons,tokens:new Set()});
   assert.deepEqual(generatedTypeErrors(parent.name,code.tsx),[]);
   const page=await browser.newPage();try{
    const render=await mountGenerated(page,parent.name,code.tsx,code.css);await render({});
    const actual=await page.locator('#root > *').evaluate(root=>{const h=root.children[0].getBoundingClientRect(),local=root.children[0].children[0].children[0].getBoundingClientRect(),s=root.children[1].getBoundingClientRect();return {host:[h.width,h.height],local:[local.width,local.height],gap:s.x-h.right};});
    for(const size of [actual.host,actual.local]){assert(Math.abs(size[0]-a.allocation.width)<.02);assert(Math.abs(size[1]-a.allocation.height)<.02);}
    assert(Math.abs(actual.gap)<.02);
   }finally{await page.close();}
  }
 }
});
test('owned affine frames reject variable sizes, positioning and layout competition',()=>{
 for(const mutate of [
  (p:any)=>p.literals.width='41px',
  (p:any)=>p.tokens={width:'{size.dynamic}'},
  (p:any)=>p.literals['padding-inline']='100px',
  (p:any)=>p.literals['min-inline-size']='100px',
  (p:any)=>p.element='button',
  (p:any)=>p.declared={position:'absolute'},
  (p:any)=>p.layout.grow=true,
  (p:any)=>p.stylesWhen=[{prop:'mode',equals:'large',styles:{width:'80px'}}],
  (p:any)=>p.declaredStates={hover:{transform:'rotate(5deg)'}},
 ]){
  const {parent,child}=fixture();const part=parent.anatomy.root.parts!.turned;delete part.component;Object.assign(part,structuredClone(child.anatomy.root));mutate(part);
  const errors:string[]=[];validateContract(parent,new Map([[parent.id,parent]]),errors,new Map());
  assert(errors.some(e=>e.includes('owned-affine-host-unproven')),JSON.stringify(errors));
 }
});
