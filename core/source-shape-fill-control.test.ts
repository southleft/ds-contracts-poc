import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';
import {chromium} from 'playwright-core';
import {proposeFromDump,proposeBatchFromDump} from './propose-figma.js';import {tokenCorpusFromJson} from './token-corpus.js';
import {ContractSchema,walkAnatomy} from '../scripts/contract-schema.js';
import {shapeFillDemandsFromDumps,demandedShapeFillNodes,shapeFillBindingMatches} from './source-shape-fill-control.js';
import {reactEmitter,reactInlineEmitter} from './emitter.js';import {mountGenerated,generatedTypeErrors} from './react-test-runtime.js';
import {createFigmaEngine} from './emit-figma-script.js';import {createFigmaMock} from '../scripts/plugin-engine-mock-figma.mjs';
const corpus=tokenCorpusFromJson({primitives:{},semantic:{},light:{},brandDefault:{}}),opts={fileKey:'file',corpus,contractIdByName:new Map<string,string>(),mintUnbound:true,hiddenCaptured:true,stampsObservable:true};
function fixture(){
 const layout={mode:'HORIZONTAL',primary:'MIN',counter:'MIN',spacing:0,padding:[0,0,0,0],primarySizing:'AUTO',counterSizing:'AUTO'};
 const paint={paint:{color:{r:.5,g:.25,b:0},opacity:1,blendMode:'NORMAL'}};
 const child:any={setName:'ShapeChild',key:'child-key',nodeId:'set-child',type:'COMPONENT_SET',propertyDefinitions:{Mode:{type:'VARIANT',defaultValue:'Off',variantOptions:['Off','On']}},variants:['Off','On'].map((mode,i)=>({name:'Mode='+mode,type:'COMPONENT',nodeId:'main-'+i,variantProperties:{Mode:mode},layout,children:[{name:'Duplicate',type:'RECTANGLE',nodeId:'other-'+i,width:12,height:12,fill:{hex:'804000'},sourceNormalFillComposition:paint},{name:'Duplicate',type:'RECTANGLE',nodeId:'target-'+i,width:12,height:12,fill:{hex:'804000'},sourceNormalFillComposition:paint}]}))};
 const target={nodeId:'Iusage;target-0',instanceId:'usage',componentId:'main-0',instancePath:[],childPath:[1]};
 const parent:any={setName:'ShapeParent',key:'parent-key',nodeId:'set-parent',type:'COMPONENT_SET',propertyDefinitions:{Case:{type:'VARIANT',defaultValue:'One',variantOptions:['One','Two']}},variants:['One','Two'].map((v,i)=>({name:'Case='+v,type:'COMPONENT',nodeId:'parent-'+i,variantProperties:{Case:v},layout,children:[{name:'ShapeChild',type:'INSTANCE',nodeId:i?'usage-two':'usage',instanceOf:'ShapeChild',instanceKey:'child-key',componentProperties:{Mode:'Off'},...(i?{}:{hostOverrides:[{path:'Duplicate',fields:['fills'],fill:{hex:'008040',alpha:.5},shapeFillTarget:target,sourceNormalFillComposition:{paint:{color:{r:0,g:.5,b:.25},opacity:.5,blendMode:'NORMAL'}}}]})}]}))};return {child,parent,target};
}
test('shape demands bind exact duplicate-name owner and refuse stale identity or unobserved paint',()=>{
 const {child,parent,target}=fixture(),demands=shapeFillDemandsFromDumps({parent},'file'),p=proposeFromDump(child,{...opts,shapeFillDemands:demands}),c=ContractSchema.parse(p.contract),b=p.shapeFillBindings![0];
 assert.equal(b.childPath[0],1);assert(shapeFillBindingMatches(b,c,'file',target));const bad=structuredClone(c);bad.description+=' stale';assert(!shapeFillBindingMatches(b,bad,'file',target));
 assert.throws(()=>demandedShapeFillNodes(child,'file',[{...demands[0],target:{...target,nodeId:'Iusage;other-0'}}]),/source-target-unqualified/);
 assert.throws(()=>demandedShapeFillNodes(child,'other',demands),/source-identity-unqualified/);
 const h=parent.variants[0].children[0].hostOverrides[0];delete h.sourceNormalFillComposition;assert.deepEqual(shapeFillDemandsFromDumps({parent},'file'),[]);
});
for(const sourceType of ['RECTANGLE','ELLIPSE','FRAME'])test(`source ${sourceType} input preserves omitted defaults in both React emitters and linked native instances`,async()=>{
 const {child,parent}=fixture();for(const v of child.variants)for(const n of v.children)n.type=sourceType;const r=proposeBatchFromDump({ShapeParent:parent,ShapeChild:child},opts);assert.deepEqual(r.skipped,[]);
 const cp=r.proposals.find(p=>p.setName==='ShapeChild')!,pp=r.proposals.find(p=>p.setName==='ShapeParent')!,cc=ContractSchema.parse(cp.contract),pc=ContractSchema.parse(pp.contract),prop=cp.shapeFillBindings![0].prop;
 const ref=walkAnatomy(pc).find(w=>w.part.component)!.part.component!;assert.deepEqual(ref.props![prop],{prop:'caseProp',map:{one:'rgba(0,127.5,63.75,0.5)'}});
 const merge=(a:any,b:any)=>{for(const [k,v] of Object.entries(b??{})){if(v&&typeof v==='object'&&!Array.isArray(v))a[k]=merge(a[k]??{},v);else a[k]=v;}return a;};
 const tokens={primitives:r.proposals.reduce((a,p)=>merge(a,p.mintedTokens?.tree),{}),semantic:{},light:{},dark:{},brands:{default:{}}},contracts=new Map([[cc.id,cc],[pc.id,pc]]),icons=new Map<string,string>(),ctx={tokens,contracts,icons};
 const browser=await chromium.launch();try{for(const emitter of [reactEmitter,reactInlineEmitter]){
  const c=emitter.emit(cc,ctx),p=emitter.emit(pc,ctx);assert.deepEqual(generatedTypeErrors(pc.name,p[0].contents,{[cc.name]:c[0].contents}),[]);
  const page=await browser.newPage();try{const render=await mountGenerated(page,pc.name,p[0].contents,p.find(f=>f.path.endsWith('.css'))?.contents,{[cc.name]:{tsx:c[0].contents,css:c.find(f=>f.path.endsWith('.css'))?.contents}});
   for(const [value,count] of [['one',1],['two',0],['one',1]] as const){await render({caseProp:value});assert.equal(await page.locator('#root').evaluate(n=>Array.from(n.querySelectorAll('*')).filter(x=>(x as HTMLElement).style.backgroundColor==='rgba(0, 128, 64, 0.5)').length),count);}
  }finally{await page.close();}
 }}finally{await browser.close();}
 const engine=createFigmaEngine(ctx),mock=createFigmaMock(),context=vm.createContext({figma:mock.figma,console:{log(){},warn(){},error(){}}}),run=(script:string)=>vm.runInContext('(async()=>{'+script+'\n})()',context);
 await run(engine.buildTokensScript(null));await run(engine.buildComponentScript(cc,contracts));await run(engine.buildComponentScript(pc,contracts));
 const host=mock.root.findOne(n=>n.type==='COMPONENT_SET'&&n.getSharedPluginData('ds_contracts','contractId')===pc.id)!;
 const instances=host.findAll(n=>n.type==='INSTANCE');assert.equal(instances.length,2);
 for(const [i,instance] of instances.entries()){
  const target:any=instance.findOne(n=>n.getSharedPluginData('ds_contracts','shapeFillOverride')===cc.id+':'+prop)!;assert(target);const main=await (instance as any).getMainComponentAsync();assert.equal(main.parent.getSharedPluginData('ds_contracts','contractId'),cc.id);assert.equal(target.fills[0].opacity,i===0?.5:1);assert.equal(target.fills[0].color.g,i===0?.5:64/255);
 }
});
test('nested paint remains an explicit limitation and incompatible shape inputs refuse',()=>{
 const {child,parent,target}=fixture(),h=parent.variants[0].children[0].hostOverrides[0];h.shapeFillTarget={...target,instancePath:[0]};assert.deepEqual(shapeFillDemandsFromDumps({parent},'file'),[]);
 const f=fixture(),r=proposeBatchFromDump({ShapeParent:f.parent,ShapeChild:f.child},opts),cc=ContractSchema.parse(r.proposals.find(p=>p.setName==='ShapeChild')!.contract),part=walkAnatomy(cc).find(w=>w.part.shapeFillOverrideProp)!.part;
 part.text='not a shape';assert.equal(ContractSchema.safeParse(cc).success,false);
 delete part.text;part.declared={...part.declared,'background-image':'linear-gradient(red,blue)'};assert.equal(ContractSchema.safeParse(cc).success,false);
});


test('two-axis shape paint uses complete finite arguments on both renderers and native plans',async()=>{
 const {child,parent}=fixture(),original=structuredClone(parent.variants[0]);
 parent.propertyDefinitions.Tone={type:'VARIANT',defaultValue:'Cold',variantOptions:['Cold','Warm']};
 parent.variants=['One','Two'].flatMap((which,i)=>['Cold','Warm'].map((tone,j)=>{const v=structuredClone(original),id='usage-'+i+j;v.name=`Case=${which}, Tone=${tone}`;v.nodeId='parent-'+i+j;v.variantProperties={Case:which,Tone:tone};v.children[0].nodeId=id;if(i!==j)delete v.children[0].hostOverrides;else v.children[0].hostOverrides[0].shapeFillTarget={nodeId:`I${id};target-0`,instanceId:id,componentId:'main-0',instancePath:[],childPath:[1]};return v;}));
 const r=proposeBatchFromDump({ShapeParent:parent,ShapeChild:child},opts);assert.deepEqual(r.skipped,[]);
 const cp=r.proposals.find(p=>p.setName==='ShapeChild')!,cc=ContractSchema.parse(cp.contract),pc=ContractSchema.parse(r.proposals.find(p=>p.setName==='ShapeParent')!.contract),prop=cp.shapeFillBindings![0].prop,ref=walkAnatomy(pc).find(w=>w.part.component)!.part.component!;
 assert.equal(ref.paintPropsByCombination![prop].rows.length,4);assert.equal(ref.props?.[prop],undefined);
 const {resolveBooleanArguments}=await import('./component-boolean-arguments.js');
 for(const [caseProp,tone,expected] of [['one','cold',true],['one','warm',false],['two','cold',false],['two','warm',true]] as const)assert.equal(resolveBooleanArguments(cc,ref,{caseProp,tone})[prop]!==undefined,expected);
 const broken=structuredClone(pc);walkAnatomy(broken).find(w=>w.part.component)!.part.component!.paintPropsByCombination![prop].rows.pop();assert.equal(ContractSchema.safeParse(broken).success,false);
 const merge=(a:any,b:any)=>{for(const [k,v] of Object.entries(b??{})){if(v&&typeof v==='object'&&!Array.isArray(v))a[k]=merge(a[k]??{},v);else a[k]=v;}return a;};
 const tokens={primitives:r.proposals.reduce((a,p)=>merge(a,p.mintedTokens?.tree),{}),semantic:{},light:{},dark:{},brands:{default:{}}},contracts=new Map([[cc.id,cc],[pc.id,pc]]),ctx={tokens,contracts,icons:new Map<string,string>()};
 const browser=await chromium.launch();try{for(const emitter of [reactEmitter,reactInlineEmitter]){
  const c=emitter.emit(cc,ctx),p=emitter.emit(pc,ctx);assert.deepEqual(generatedTypeErrors(pc.name,p[0].contents,{[cc.name]:c[0].contents}),[]);
  const page=await browser.newPage();try{const render=await mountGenerated(page,pc.name,p[0].contents,p.find(f=>f.path.endsWith('.css'))?.contents,{[cc.name]:{tsx:c[0].contents,css:c.find(f=>f.path.endsWith('.css'))?.contents}});
   for(const [caseProp,tone,count] of [['one','cold',1],['one','warm',0],['two','cold',0],['two','warm',1]] as const){await render({caseProp,tone});assert.equal(await page.locator('#root').evaluate(n=>Array.from(n.querySelectorAll('*')).filter(x=>(x as HTMLElement).style.backgroundColor==='rgba(0, 128, 64, 0.5)').length),count);}
  }finally{await page.close();}
 }}finally{await browser.close();}
 const data=createFigmaEngine(ctx).compileComponentData(pc,contracts),desc=(n:any):any[]=>[n,...(n.children??[]).flatMap(desc)];
 assert.equal(data.variants.filter(v=>desc(v.spec).some(n=>n.instanceShapeFills)).length,2);
});

test('identical observed mask paint does not demand a normal-shape input',()=>{
 const {child,parent}=fixture(),target=child.variants[0].children[1];target.mask={type:'ALPHA'};
 const h=parent.variants[0].children[0].hostOverrides[0];h.fill=structuredClone(target.fill);h.sourceNormalFillComposition=structuredClone(target.sourceNormalFillComposition);
 const demands=shapeFillDemandsFromDumps({parent},'file'),before=JSON.stringify(child);
 assert.equal(demandedShapeFillNodes(child,'file',demands).size,0);
 assert.equal(JSON.stringify(child),before);
 assert.throws(()=>demandedShapeFillNodes(child,'file',[{...demands[0],color:'rgba(0,0,0,0.5)'}]),/mask-paint-change-unqualified/);
 delete target.sourceNormalFillComposition;
 assert.throws(()=>demandedShapeFillNodes(child,'file',demands),/mask-paint-change-unqualified/);
});

test('state-dependent nested paint keeps its drawn enum and absent-instance rows on both React surfaces',async()=>{
 const {child,parent}=fixture(),original=structuredClone(parent.variants[0]);
 parent.propertyDefinitions={Case:{type:'VARIANT',defaultValue:'One',variantOptions:['One','Two','Absent']},State:{type:'VARIANT',defaultValue:'Default',variantOptions:['Default','Hover']}};
 parent.variants=['One','Two','Absent'].flatMap((which,i)=>['Default','Hover'].map((state,j)=>{
  const v=structuredClone(original),id=`state-use-${i}-${j}`;v.name=`Case=${which}, State=${state}`;v.nodeId=`parent-${i}-${j}`;v.variantProperties={Case:which,State:state};
  v.fill={hex:j?'eeeeee':'ffffff'};
  if(which==='Absent')v.children=[];
  else {const n=v.children[0],h=n.hostOverrides[0],green=i===j;n.nodeId=id;
   h.shapeFillTarget={nodeId:`I${id};target-0`,instanceId:id,componentId:'main-0',instancePath:[],childPath:[1]};
   h.fill={hex:green?'008040':'0000ff'};h.sourceNormalFillComposition={paint:{color:green?{r:0,g:.5,b:.25}:{r:0,g:0,b:1},opacity:1,blendMode:'NORMAL'}};
  }return v;
 }));
 const before=JSON.stringify({parent,child});
 assert.throws(()=>proposeFromDump(parent,opts),/state-axis-state-not-carried:nested-shape-fill/);
 const r=proposeBatchFromDump({ShapeParent:parent,ShapeChild:child},{...opts,drawnVariantSurface:'react-runtime'});assert.deepEqual(r.skipped,[]);
 const cp=r.proposals.find(p=>p.setName==='ShapeChild')!,cc=ContractSchema.parse(cp.contract),pc=ContractSchema.parse(r.proposals.find(p=>p.setName==='ShapeParent')!.contract),prop=cp.shapeFillBindings![0].prop;
 assert.deepEqual(pc.props.find(p=>p.name==='state')!.type,{enum:['default','hover']});assert.deepEqual(pc.states,[]);
 const ref=walkAnatomy(pc).find(w=>w.part.component)!.part.component!;
 assert.equal(ref.paintPropsByCombination![prop].rows.length,6);assert.equal(ref.paintPropsByCombination![prop].rows.filter(r=>r.value===null).length,2);
 assert.equal(JSON.stringify({parent,child}),before);
 const merge=(a:any,b:any)=>{for(const [k,v] of Object.entries(b??{})){if(v&&typeof v==='object'&&!Array.isArray(v))a[k]=merge(a[k]??{},v);else a[k]=v;}return a;};
 const ctx={tokens:{primitives:r.proposals.reduce((a,p)=>merge(a,p.mintedTokens?.tree),{}),semantic:{},light:{},dark:{},brands:{default:{}}},contracts:new Map([[cc.id,cc],[pc.id,pc]]),icons:new Map<string,string>()};
 const browser=await chromium.launch();try{for(const emitter of [reactEmitter,reactInlineEmitter]){
  const c=emitter.emit(cc,ctx),p=emitter.emit(pc,ctx);assert.deepEqual(generatedTypeErrors(pc.name,p[0].contents,{[cc.name]:c[0].contents}),[]);
  const page=await browser.newPage();try{
   const render=await mountGenerated(page,pc.name,p[0].contents,p.find(f=>f.path.endsWith('.css'))?.contents,{[cc.name]:{tsx:c[0].contents,css:c.find(f=>f.path.endsWith('.css'))?.contents}});
   for(const [caseProp,state,color] of [['one','default','rgb(0, 128, 64)'],['one','hover','rgb(0, 0, 255)'],['two','default','rgb(0, 0, 255)'],['two','hover','rgb(0, 128, 64)'],['absent','default',null],['absent','hover',null],['one','default','rgb(0, 128, 64)']] as const){
    await render({caseProp,state});const paints=await page.locator('#root').evaluate(n=>Array.from(n.querySelectorAll('*')).map(x=>(x as HTMLElement).style.backgroundColor).filter(c=>c==='rgb(0, 128, 64)'||c==='rgb(0, 0, 255)'));
    assert.deepEqual(paints,color?[color]:[]);
   }
  }finally{await page.close();}
 }}finally{await browser.close();}
});

test('explicit empty child fill clears ink and restores the inherited default in both React renderers',async()=>{
 const {child,parent}=fixture(),h=parent.variants[0].children[0].hostOverrides[0];
 delete h.fill;delete h.sourceNormalFillComposition;h.sourceEmptyFill=true;
 const {shapeFillValue}=await import('./source-shape-fill-control.js');
 assert.equal(shapeFillValue(h),'rgba(0,0,0,0)');
 assert.equal(shapeFillValue({...h,sourceEmptyFill:undefined}),undefined);
 assert.equal(shapeFillValue({...h,fill:{hex:'ffffff'}}),undefined);
 const r=proposeBatchFromDump({ShapeParent:parent,ShapeChild:child},opts);assert.deepEqual(r.skipped,[]);
 const cp=r.proposals.find(p=>p.setName==='ShapeChild')!,cc=ContractSchema.parse(cp.contract),pc=ContractSchema.parse(r.proposals.find(p=>p.setName==='ShapeParent')!.contract),prop=cp.shapeFillBindings![0].prop;
 const ref=walkAnatomy(pc).find(w=>w.part.component)!.part.component!;assert.deepEqual(ref.props![prop],{prop:'caseProp',map:{one:'rgba(0,0,0,0)'}});
 const merge=(a:any,b:any)=>{for(const [k,v] of Object.entries(b??{})){if(v&&typeof v==='object'&&!Array.isArray(v))a[k]=merge(a[k]??{},v);else a[k]=v;}return a;};
 const ctx={tokens:{primitives:r.proposals.reduce((a,p)=>merge(a,p.mintedTokens?.tree),{}),semantic:{},light:{},dark:{},brands:{default:{}}},contracts:new Map([[cc.id,cc],[pc.id,pc]]),icons:new Map<string,string>()};
 const browser=await chromium.launch();try{for(const emitter of [reactEmitter,reactInlineEmitter]){
  const c=emitter.emit(cc,ctx),p=emitter.emit(pc,ctx),page=await browser.newPage();try{
   const render=await mountGenerated(page,pc.name,p[0].contents,p.find(f=>f.path.endsWith('.css'))?.contents,{[cc.name]:{tsx:c[0].contents,css:c.find(f=>f.path.endsWith('.css'))?.contents}});
   for(const [caseProp,count] of [['one',1],['two',0],['one',1]] as const){await render({caseProp});assert.equal(await page.locator('#root').evaluate(n=>Array.from(n.querySelectorAll('*')).filter(x=>(x as HTMLElement).style.backgroundColor==='rgba(0, 0, 0, 0)').length),count);}
  }finally{await page.close();}
 }}finally{await browser.close();}
});

 test('a proven empty sibling variant does not reject an identity-qualified fill input',async()=>{
 const {child,parent}=fixture(),blank=child.variants[1].children[1];
 delete blank.fill;delete blank.sourceNormalFillComposition;blank.sourceEmptyFill=true;
 const result=proposeBatchFromDump({ShapeParent:parent,ShapeChild:child},opts);assert.deepEqual(result.skipped,[]);
 const cp=result.proposals.find(p=>p.setName==='ShapeChild')!;
 assert.equal(cp.shapeFillBindings!.length,1);
 const cc=ContractSchema.parse(cp.contract),prop=cp.shapeFillBindings![0].prop;
 assert(walkAnatomy(cc).some(w=>w.part.shapeFillOverrideProp));
 const ctx={contracts:new Map([[cc.id,cc]]),icons:new Map<string,string>(),tokens:{primitives:cp.mintedTokens?.tree??{},semantic:{},light:{},dark:{},brands:{default:{}}}};
 const browser=await chromium.launch();try{for(const emitter of [reactEmitter,reactInlineEmitter]){
  const code=emitter.emit(cc,ctx),page=await browser.newPage();
  try{const render=await mountGenerated(page,cc.name,code[0].contents,code.find(f=>f.path.endsWith('.css'))?.contents);
   for(const [mode,color] of [['off',undefined],['on',undefined],['on','rgba(0,127.5,63.75,0.5)'],['off',undefined]] as const){
    await render({mode,[prop]:color});const colors=await page.locator('#root').evaluate(n=>Array.from(n.querySelectorAll('*')).map(x=>getComputedStyle(x).backgroundColor));
    assert.equal(colors.filter(c=>c==='rgba(0, 128, 64, 0.5)').length,color?1:0);
   }
  }finally{await page.close();}
 }}finally{await browser.close();}

 delete blank.sourceEmptyFill;
 const unknown=proposeBatchFromDump({ShapeParent:parent,ShapeChild:child},opts);
 assert(unknown.skipped.some(s=>s.reason.includes('shape-fill-demand-owned-part-unqualified')));
 blank.sourceEmptyFill=true;blank.fill={hex:'ffffff'};
 const conflicting=proposeBatchFromDump({ShapeParent:parent,ShapeChild:child},opts);
 assert(conflicting.skipped.some(s=>s.reason.includes('shape-fill-demand-owned-part-unqualified')));
 });
