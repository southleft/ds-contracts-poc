import vm from 'node:vm';
import {createFigmaEngine} from './emit-figma-script.js';
import {createFigmaMock} from '../scripts/plugin-engine-mock-figma.mjs';
import test from 'node:test';import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
import {proposeBatchFromDump} from './propose-figma.js';import {tokenCorpusFromJson} from './token-corpus.js';
import {ContractSchema,walkAnatomy} from '../scripts/contract-schema.js';import {reactEmitter,reactInlineEmitter} from './emitter.js';import {mountGenerated} from './react-test-runtime.js';
import {settleNestedPropertyInputs,nestedPropertySourceNodes,scopedCaller} from './nested-property-inputs.js';
const opts={fileKey:'file',corpus:tokenCorpusFromJson({primitives:{},semantic:{},light:{},brandDefault:{}}),contractIdByName:new Map<string,string>(),mintUnbound:true};
function fixture(){
 const layout={mode:'HORIZONTAL',primary:'MIN',counter:'MIN',spacing:0,padding:[0,0,0,0],primarySizing:'AUTO',counterSizing:'AUTO'};
 const Day:any={setName:'Day',type:'COMPONENT_SET',key:'day-set',nodeId:'day-set-id',propertyDefinitions:{Disabled:{type:'VARIANT',defaultValue:'False',variantOptions:['False','True']},'Value#1:2':{type:'TEXT',defaultValue:'0'}},variants:['False','True'].map((v,i)=>({name:'Disabled='+v,type:'COMPONENT',nodeId:'day-'+i,componentKey:'day-key-'+i,variantProperties:{Disabled:v},layout,children:[{name:'Value',type:'TEXT',nodeId:'text-'+i,propRefs:{characters:'Value'},text:{characters:'0',fontFamily:'Arial',fontStyle:'Regular',fontSize:14,fontWeight:400,lineHeight:20}}]}))};
 const Week:any={setName:'Week',type:'COMPONENT',key:'week-key',nodeId:'week-main',propertyDefinitions:{},variants:[{name:'Week',type:'COMPONENT',nodeId:'week-main',layout,children:[0,1,2].map(i=>({name:'Day',type:'INSTANCE',nodeId:'inner-'+i,instanceOf:'Day',instanceKey:'day-key-0',instanceSetKey:'day-set',instanceGeometry:{componentId:'day-0'},componentProperties:{Disabled:'False','Value#1:2':String(i)},layout}))}]};
 const Calendar:any={setName:'Calendar',type:'COMPONENT',key:'calendar-key',nodeId:'calendar-main',propertyDefinitions:{},variants:[{name:'Calendar',type:'COMPONENT',nodeId:'calendar-main',layout,children:[0,1].map(i=>({name:'Week',type:'INSTANCE',nodeId:'week-use-'+i,instanceOf:'Week',instanceKey:'week-key',instanceGeometry:{componentId:'week-main'},layout,hostOverrides:[0,1,2].map(j=>({path:'Day',fields:['componentProperties'],instanceProperties:{ownerId:'week-use-'+i,ownerComponentId:'week-main',ownerComponentKey:'week-key',nodeId:'Iweek-use-'+i+';inner-'+j,componentId:'day-'+(j%2),componentKey:'day-key-'+(j%2),componentSetKey:'day-set',path:[j],properties:{Disabled:{type:'VARIANT',value:j%2?'True':'False'},'Value#1:2':{type:'TEXT',value:String(27+i*3+j)}}}}))}))}]};
 return {Day,Week,Calendar};
}
function swapFixture(){
 const dump:any=fixture();
 for(const name of ['DefaultMark','ChosenMark'])dump[name]={setName:name,type:'COMPONENT',key:name+'-key',nodeId:name+'-main',variants:[{name,type:'COMPONENT',nodeId:name+'-main',componentKey:name+'-key',layout:dump.Week.variants[0].layout,children:[{name:'label',type:'TEXT',text:{characters:name,fontFamily:'Arial',fontStyle:'Regular',fontSize:14,fontWeight:400,lineHeight:20}}]}]};
 dump.Day.propertyDefinitions['Mark#1:3']={type:'INSTANCE_SWAP',defaultValue:'DefaultMark-main'};
 for(const [i,v]of dump.Day.variants.entries())v.children.push({name:'mark',type:'INSTANCE',nodeId:'mark-'+i,instanceOf:'DefaultMark',instanceKey:'DefaultMark-key',propRefs:{mainComponent:'Mark'},bbox:{width:16,height:16},instanceSizing:{horizontal:'FIXED',vertical:'FIXED',width:16,height:16},instanceGeometry:{componentId:'DefaultMark-main',localSize:{width:16,height:16},transform:[[1,0,0],[0,1,0]]}});
 for(const n of dump.Calendar.variants[0].children)for(const h of n.hostOverrides)h.instanceProperties.properties['Mark#1:3']={type:'INSTANCE_SWAP',value:'ChosenMark-main',selected:{nodeId:'ChosenMark-main',componentKey:'ChosenMark-key'}};
 const base=structuredClone(dump.Week.variants[0]);dump.Week.type='COMPONENT_SET';dump.Week.key='week-set';dump.Week.propertyDefinitions={Mode:{type:'VARIANT',defaultValue:'First',variantOptions:['First','Second']}};
 dump.Week.variants=['First','Second'].map((mode,i)=>{const v=structuredClone(base);v.name='Mode='+mode;v.nodeId='week-main-'+i;v.componentKey='week-key-'+i;v.variantProperties={Mode:mode};for(const child of v.children)child.nodeId+='-'+i;return v;});
 for(const [i,n]of dump.Calendar.variants[0].children.entries()){n.instanceSetKey='week-set';n.instanceKey='week-key-'+i;n.instanceGeometry.componentId='week-main-'+i;n.componentProperties={Mode:i?'Second':'First'};for(const h of n.hostOverrides){const w=h.instanceProperties;w.ownerComponentId='week-main-'+i;w.ownerComponentKey='week-key-'+i;w.nodeId+='-'+i;}}
 return dump;
}
test('nested swaps render captured targets through both React emitters and preserve wrapper defaults',async t=>{
 const dump=swapFixture(),before=JSON.stringify(dump),result=proposeBatchFromDump(dump,opts);assert.deepEqual(result.skipped,[]);assert.equal(JSON.stringify(dump),before);
 const contracts=new Map(result.proposals.map(p=>{const c=ContractSchema.parse(p.contract);return[c.id,c]as const;}));
 const baselineDump=swapFixture();for(const n of baselineDump.Calendar.variants[0].children)for(const h of n.hostOverrides)delete h.instanceProperties.properties['Mark#1:3'];
 const baseline=proposeBatchFromDump(baselineDump,opts);const baselineContracts=new Map(baseline.proposals.map(p=>{const c=ContractSchema.parse(p.contract);return[c.id,c]as const;}));
 const browser=await chromium.launch();t.after(()=>browser.close());
 const merge=(a:any,b:any)=>{for(const[k,v]of Object.entries(b??{}))a[k]=v&&typeof v==='object'&&!Array.isArray(v)?merge(a[k]??{},v):v;return a;};
 const tokens={primitives:result.proposals.reduce((a,p)=>merge(a,p.mintedTokens?.tree),{}),semantic:{},light:{},dark:{},brands:{default:{}}};
 for(const emitter of [reactEmitter,reactInlineEmitter]){
  const dependencies=Object.fromEntries([...contracts.values()].map(c=>{const f=emitter.emit(c,{contracts,tokens,icons:new Map()});return[c.name,{tsx:f[0].contents,css:f.find(f=>f.path.endsWith('.css'))?.contents}];}));
  const page=await browser.newPage();try{
   const root=contracts.get('ds.calendar')!,rootCode=dependencies[root.name];await mountGenerated(page,root.name,rootCode.tsx,rootCode.css,dependencies);
   assert.equal(await page.getByText('ChosenMark',{exact:true}).count(),6);assert.equal(await page.getByText('DefaultMark',{exact:true}).count(),0);
   const oldDependencies=Object.fromEntries([...baselineContracts.values()].map(c=>{const f=emitter.emit(c,{contracts:baselineContracts,tokens,icons:new Map()});return[c.name,{tsx:f[0].contents,css:f.find(f=>f.path.endsWith('.css'))?.contents}];}));
   const oldWeek=baselineContracts.get('ds.week')!,oldCode=oldDependencies[oldWeek.name];await mountGenerated(page,oldWeek.name,oldCode.tsx,oldCode.css,oldDependencies);
   const beforeDefault=await page.locator('#root').innerText();
   const week=contracts.get('ds.week')!,code=dependencies[week.name];await mountGenerated(page,week.name,code.tsx,code.css,dependencies);
   assert.equal(await page.locator('#root').innerText(),beforeDefault,'wrapper standalone default stays unchanged');
   assert.equal(await page.getByText('ChosenMark',{exact:true}).count(),0);
  }finally{await page.close();}
 }
});
test('nested swap identity conflicts retain the caller default without partial forwarding',()=>{
 for(const mode of ['key','node','value','missing','duplicate']){
  const d=swapFixture(),w=d.Calendar.variants[0].children[0].hostOverrides[0].instanceProperties.properties['Mark#1:3'];
  if(mode==='key')w.selected.componentKey='wrong';if(mode==='node')w.selected.nodeId='wrong';if(mode==='value')w.value='wrong';if(mode==='missing')delete w.selected;
  if(mode==='duplicate')d.Duplicate={...structuredClone(d.ChosenMark),setName:'Duplicate'};
  const r=proposeBatchFromDump(d,opts),parent=r.proposals.find(p=>p.setName==='Calendar')!;
  assert(parent.notes.some(n=>n.includes('nested-property-input-not-carried')),mode);
  const c=ContractSchema.parse(parent.contract);assert.equal(c.anatomy.root.parts!.Week.component!.contentSlots,undefined,mode);
 }
});
test('repeated same-name nested instances forward independent labels and variants without changing wrapper defaults',async()=>{
 const dump=fixture(),before=JSON.stringify(dump),r=proposeBatchFromDump(dump,opts);assert.deepEqual(r.skipped,[]);assert.equal(JSON.stringify(dump),before);
 const contracts=new Map(r.proposals.map(p=>{const c=ContractSchema.parse(p.contract);return[c.id,c] as const;}));const root=contracts.get('ds.calendar')!,week=contracts.get('ds.week')!;
 assert(r.proposals.find(p=>p.setName==='Calendar')!.notes.some(n=>n.includes('nested property occurrences forwarded')),JSON.stringify(r.proposals.map(p=>({name:p.setName,parts:p.sourceInstanceParts,notes:p.notes.filter(n=>n.includes('nested-property'))}))));
 const merge=(a:any,b:any)=>{for(const[k,v]of Object.entries(b??{}))a[k]=v&&typeof v==='object'&&!Array.isArray(v)?merge(a[k]??{},v):v;return a;};
 const ctx={contracts,icons:new Map<string,string>(),tokens:{primitives:r.proposals.reduce((a,p)=>merge(a,p.mintedTokens?.tree),{}),semantic:{},light:{},dark:{},brands:{default:{}}}};
 const browser=await chromium.launch();try{for(const emitter of [reactEmitter,reactInlineEmitter]){
  const dependencies=Object.fromEntries([...contracts.values()].map(c=>{const f=emitter.emit(c,ctx);return[c.name,{tsx:f[0].contents,css:f.find(f=>f.path.endsWith('.css'))?.contents}];}));
  const page=await browser.newPage();try{
   const code=dependencies[root.name];await mountGenerated(page,root.name,code.tsx,code.css,dependencies);
   for(const v of ['27','28','29','30','31','32'])assert.equal(await page.getByText(v,{exact:true}).count(),1);
   assert.equal(await page.locator('[data-disabled="true"]').count(),2);
   const wc=dependencies[week.name];await mountGenerated(page,week.name,wc.tsx,wc.css,dependencies);
   for(const v of ['0','1','2'])assert.equal(await page.getByText(v,{exact:true}).count(),1,await page.locator('#root').innerHTML());
   assert.equal(await page.locator('[data-disabled="true"]').count(),0);
  }finally{await page.close();}
 }}finally{await browser.close();}
 const engine=createFigmaEngine(ctx),mock=createFigmaMock(),sandbox=vm.createContext({figma:mock.figma,console:{log(){},warn(){},error(){}}});
 const run=(code:string)=>vm.runInContext('(async()=>{'+code+'\n})()',sandbox);
 await run(engine.buildTokensScript(null));
 for(const c of contracts.values())await run(engine.buildComponentScript(c,contracts));
 const host=mock.root.findOne(n=>n.getSharedPluginData('ds_contracts','contractId')===root.id)!;assert(host);
 const texts=host.findAll(n=>n.type==='TEXT').map(n=>(n as any).characters);
 for(const v of ['27','28','29','30','31','32'])assert.equal(texts.filter(x=>x===v).length,1,JSON.stringify(texts));
 const dayMains:string[]=[];for(const n of host.findAll(n=>n.type==='INSTANCE')){const main=await(n as any).getMainComponentAsync();if(main?.parent?.getSharedPluginData('ds_contracts','contractId')==='ds.day')dayMains.push(String((n as any).componentProperties.Disabled?.value));}
 assert.equal(dayMains.filter(n=>n==='True').length,2,JSON.stringify(dayMains));
});
test('ambiguous or stale nested properties do not rewrite the affected caller',()=>{
 for(const mode of ['node','owner','path','set','main','value','duplicate','stamped','missing-main-key']){
  const d=fixture(),n=d.Calendar.variants[0].children[0],w=n.hostOverrides[0].instanceProperties;
  if(mode==='node')w.nodeId='unrelated';if(mode==='owner')w.ownerComponentKey='wrong';if(mode==='path')w.path=[99];if(mode==='set')w.componentSetKey='wrong';if(mode==='main')w.componentId='day-1';if(mode==='value')w.properties.Disabled.value='True';if(mode==='duplicate')n.hostOverrides.push(structuredClone(n.hostOverrides[0]));if(mode==='stamped')d.Week.contractId='ds.week';
  if(mode==='missing-main-key'){delete d.Day.variants[0].componentKey;w.componentKey=d.Day.key;}
  const r=proposeBatchFromDump(d,opts),c=r.proposals.find(p=>p.setName==='Calendar')!;
  assert(c.notes.some(n=>n.includes('nested-property-input-not-carried'))||mode==='stamped',mode);
  assert(!JSON.stringify(c.contract).includes('"27"'),mode);
 }
});

function sharedCallerFixture(){
 const d:any=fixture(),original=d.Calendar.variants[0];
 d.Calendar.type='COMPONENT_SET';d.Calendar.key='calendar-set';d.Calendar.propertyDefinitions={Mode:{type:'VARIANT',defaultValue:'A',variantOptions:['A','B','C']}};
 d.Calendar.variants=['A','B','C'].map((mode,i)=>{
  const variant=structuredClone(original);variant.name='Mode='+mode;variant.nodeId='calendar-'+i;variant.componentKey='calendar-key-'+i;variant.variantProperties={Mode:mode};
  for(const [j,n]of variant.children.entries()){
   n.nodeId='week-use-'+i+'-'+j;
   if(mode==='C'){delete n.hostOverrides;continue;}
   for(const [k,h]of n.hostOverrides.entries()){
    const w=h.instanceProperties;w.ownerId=n.nodeId;w.nodeId='I'+n.nodeId+';inner-'+k;
    w.properties['Value#1:2'].value=mode+(j*3+k);h.fields=[];
   }
  }
  return variant;
 });return d;
}
test('shared caller parts carry exact nested observations per original tuple and preserve unwitnessed defaults',async()=>{
 const dump=sharedCallerFixture(),before=JSON.stringify(dump),result=proposeBatchFromDump(dump,opts);
 assert.deepEqual(result.skipped,[]);assert.equal(JSON.stringify(dump),before);
 const contracts=new Map(result.proposals.map(p=>{const c=ContractSchema.parse(p.contract);return[c.id,c] as const;}));
 const parent=contracts.get('ds.calendar')!,wrapper=contracts.get('ds.week')!;
 assert(result.proposals.find(p=>p.setName==='Calendar')!.notes.filter(n=>n.includes('nested property occurrences forwarded')).length===4);
 const merge=(a:any,b:any)=>{for(const[k,v]of Object.entries(b??{}))a[k]=v&&typeof v==='object'&&!Array.isArray(v)?merge(a[k]??{},v):v;return a;};
 const ctx={contracts,icons:new Map<string,string>(),tokens:{primitives:result.proposals.reduce((a,p)=>merge(a,p.mintedTokens?.tree),{}),semantic:{},light:{},dark:{},brands:{default:{}}}};
 const browser=await chromium.launch();try{for(const emitter of [reactEmitter,reactInlineEmitter]){
  const dependencies=Object.fromEntries([...contracts.values()].map(c=>{const files=emitter.emit(c,ctx);return[c.name,{tsx:files[0].contents,css:files.find(f=>f.path.endsWith('.css'))?.contents}];}));
  const page=await browser.newPage();try{
   const code=dependencies[parent.name],render=await mountGenerated(page,parent.name,code.tsx,code.css,dependencies);
   for(const mode of ['a','b','c','a']){
    await render({mode});const values=mode==='c'?['0','1','2','0','1','2']:Array.from({length:6},(_,i)=>mode.toUpperCase()+i);
    assert.deepEqual((await page.locator('#root').innerText()).split('\n').filter(Boolean),values);
   }
   const codeWrapper=dependencies[wrapper.name];await mountGenerated(page,wrapper.name,codeWrapper.tsx,codeWrapper.css,dependencies);
   assert.deepEqual((await page.locator('#root').innerText()).split('\n').filter(Boolean),['0','1','2']);
  }finally{await page.close();}
 }}finally{await browser.close();}
});

test('shared caller partition refuses missing, duplicated or unmapped source tuples without partial contract changes',()=>{
 for(const mutate of [
  (d:any)=>{delete d.Calendar.variants[1].variantProperties;},
  (d:any)=>{d.Calendar.variants[1].variantProperties.Mode='A';},
  (d:any)=>{d.Calendar.variants[1].variantProperties.Extra='value';},
  (d:any)=>{d.Calendar.variants[1].variantProperties.Mode='unknown';},
  (d:any)=>{d.Calendar.variants[1].children[0].nodeId=d.Calendar.variants[0].children[0].nodeId;},
 ]){
  const d=sharedCallerFixture();for(const variant of d.Calendar.variants)variant.children=variant.children.slice(0,1);
  for(const variant of d.Calendar.variants)for(const n of variant.children)for(const h of n.hostOverrides??[])h.instanceProperties.ownerComponentKey='stale';
  const baseline=proposeBatchFromDump(d,opts);assert.deepEqual(baseline.skipped,[]);
  const source=sharedCallerFixture();for(const variant of source.Calendar.variants)variant.children=variant.children.slice(0,1);
  for(const variant of source.Calendar.variants.slice(1))for(const n of variant.children)delete n.hostOverrides;
  mutate(source);
  const before=JSON.stringify(baseline.proposals.map(p=>p.contract));
  settleNestedPropertyInputs(source,'file',baseline.proposals,new Set());
  assert.equal(JSON.stringify(baseline.proposals.map(p=>p.contract)),before,String(mutate));
 }
});

test('partitioned caller siblings retain their explicit content-slot route exactly once',()=>{
 const source=sharedCallerFixture(),stale=structuredClone(source);
 for(const variant of stale.Calendar.variants)for(const n of variant.children)for(const h of n.hostOverrides??[])h.instanceProperties.ownerComponentKey='stale';
 const batch=proposeBatchFromDump(stale,opts),parent=batch.proposals.find(p=>p.setName==='Calendar')!;
 const root=(parent.contract.anatomy as any).root,original=root.parts;
 const keys=Object.keys(original);
 root.parts={holder:{component:{id:'review.box',contentSlots:{body:keys}},parts:original}};
 const box=ContractSchema.parse({
  id:'review.box',name:'ReviewBox',version:'0.1.0',status:'draft',description:'Test',semantics:{element:'div'},props:[],states:[],
  bindings:{code:{anchors:{importPath:'./ReviewBox',export:'ReviewBox'}},figma:{anchors:{fileKey:'file',componentSetKey:'review-box'}}},
  anatomy:{root:{parts:{body:{slot:{name:'body'}}}}},
 });
 batch.proposals.push({setName:'Review box',contract:box as any,notes:[],unbound:[]} as any);
 settleNestedPropertyInputs(source,'file',batch.proposals,new Set());
 const contract=ContractSchema.parse(parent.contract),holder=contract.anatomy.root.parts!.holder;
 const isolated=Object.keys(holder.parts!).filter(key=>key.includes('SourceCaller'));
 assert(isolated.length>0);
 for(const key of Object.keys(holder.parts!))assert.equal(holder.component!.contentSlots!.body.filter(item=>item===key).length,1);
 const parsed=ContractSchema.safeParse(parent.contract);assert.equal(parsed.success,true);
});

test('schema-only single-target controls refuse caller cloning atomically',()=>{
 const source=sharedCallerFixture(),stale=structuredClone(source);
 for(const variant of stale.Calendar.variants)for(const n of variant.children)for(const h of n.hostOverrides??[])h.instanceProperties.ownerComponentKey='stale';
 const batch=proposeBatchFromDump(stale,opts),parent=batch.proposals.find(p=>p.setName==='Calendar')!;
 const c=ContractSchema.parse(parent.contract);
 c.props.push({name:'showWeek',type:'boolean',bindings:{code:{prop:'showWeek'},figma:{kind:'NONE'}}});
 c.anatomy.root.parts!.Week.visibilityOverrideProp='showWeek';
 parent.contract=ContractSchema.parse(c) as any;
 // Exercise only this shared caller; another independent sibling may still
 // qualify on its own and should not mask atomicity of the refused branch.
 for(const variant of source.Calendar.variants)for(const n of variant.children.slice(1))delete n.hostOverrides;
 const before=JSON.stringify(batch.proposals.map(p=>p.contract));
 assert.doesNotThrow(()=>settleNestedPropertyInputs(source,'file',batch.proposals,new Set()));
 assert.equal(JSON.stringify(batch.proposals.map(p=>p.contract)),before);
 assert(parent.notes.some(note=>note.includes('forwarding violates the owner or caller schema')));
});


test('conditional HUG basis and shared nested callers preserve geometry and defaults across A B A',async()=>{
 const dump=sharedCallerFixture();
 dump.Calendar.propertyDefinitions.Mode.variantOptions=['A','B'];
 dump.Calendar.variants=dump.Calendar.variants.slice(0,2);
 for(const variant of dump.Calendar.variants){
  const shown=variant.variantProperties.Mode==='A',size={width:160,height:shown?112:22};
  variant.bbox=size;
  variant.layout={mode:'VERTICAL',primary:'MIN',counter:'MIN',spacing:0,padding:[1,1,1,1],primarySizing:'AUTO',counterSizing:'FIXED'};
  variant.children=variant.children.slice(0,1);
  if(!shown){delete variant.children[0].hostOverrides;continue;}
  const nodeId=variant.nodeId+'-field',localSize={width:158,height:90};
  variant.children.unshift({name:'Field',type:'FRAME',nodeId,fillWidth:true,fillHeight:true,clipsContent:true,
   layout:{mode:'VERTICAL',primary:'MIN',counter:'MIN',spacing:0,padding:[5,12,5,12],primarySizing:'FIXED',counterSizing:'FIXED'},
   localGeometry:{nodeId,parentId:variant.nodeId,transform:[[1,0,1],[0,1,1]],localSize,parentSize:size},
   children:[{name:'Field label',type:'TEXT',nodeId:nodeId+'-label',fillWidth:true,fillHeight:true,
    localGeometry:{nodeId:nodeId+'-label',parentId:nodeId,transform:[[1,0,12],[0,1,5]],localSize:{width:134,height:80},parentSize:localSize},
    text:{characters:'Original text',fontFamily:'Arial',fontStyle:'Regular',fontWeight:400,fontSize:14,lineHeight:20,textAutoResize:'TRUNCATE'}}]});
 }
 const before=JSON.stringify(dump),result=proposeBatchFromDump(dump,opts);
 assert.deepEqual(result.skipped,[]);assert.equal(JSON.stringify(dump),before);
 const contracts=new Map(result.proposals.map(p=>{const c=ContractSchema.parse(p.contract);return[c.id,c] as const;}));
 const parent=contracts.get('ds.calendar')!,wrapper=contracts.get('ds.week')!;
 const merge=(a:any,b:any)=>{for(const[k,v]of Object.entries(b??{}))a[k]=v&&typeof v==='object'&&!Array.isArray(v)?merge(a[k]??{},v):v;return a;};
 const tree=result.proposals.reduce((a,p)=>merge(a,p.mintedTokens?.tree),{});
 const ctx={contracts,icons:new Map<string,string>(),tokens:{primitives:tree,semantic:{},light:{},dark:{},brands:{default:{}}}};
 const {mintedTokenCss}=await import('./mint-tokens.js');
 const browser=await chromium.launch();try{for(const emitter of [reactEmitter,reactInlineEmitter]){
  const dependencies=Object.fromEntries([...contracts.values()].map(c=>{const files=emitter.emit(c,ctx);return[c.name,{tsx:files[0].contents,css:files.find(f=>f.path.endsWith('.css'))?.contents}];}));
  const page=await browser.newPage();try{
   const code=dependencies[parent.name],render=await mountGenerated(page,parent.name,code.tsx,(code.css??'')+mintedTokenCss(tree),dependencies);
   for(const mode of ['a','b','a']){
    await render({mode});
    const actual=await page.locator('#root > :first-child').evaluate(root=>{
     const box=root.getBoundingClientRect(),field=[...root.children].find(node=>node.textContent==='Original text');
     return {text:(root as HTMLElement).innerText.split('\n').filter(Boolean),children:root.children.length,
      height:box.height,field:field?{height:field.getBoundingClientRect().height,width:field.getBoundingClientRect().width,
       textHeight:field.firstElementChild!.getBoundingClientRect().height}:null};
    });
    assert.deepEqual(actual,mode==='a'
     ?{text:['Original text','A0','A1','A2'],children:2,height:112,field:{height:90,width:158,textHeight:80}}
     :{text:['0','1','2'],children:1,height:22,field:null},emitter===reactEmitter?'css '+mode:'inline '+mode);
   }
   const standalone=dependencies[wrapper.name];
   await mountGenerated(page,wrapper.name,standalone.tsx,(standalone.css??'')+mintedTokenCss(tree),dependencies);
   assert.deepEqual((await page.locator('#root').innerText()).split('\n').filter(Boolean),['0','1','2']);
  }finally{await page.close();}
 }}finally{await browser.close();}
});


// Minimal original Form -> carrier INSTANCE_SWAP -> Form-item -> Input shape.
// The source override is a selected Input variant, not a Form-item size prop.
function selectedBoundaryFixture(){
 const make=(id:string,name:string,key:string,nodeId:string,props:any[],root:any)=>ContractSchema.parse({id,name,description:'Selected boundary regression',version:'0.1.0',status:'draft',semantics:{element:'div'},states:[],props,
  bindings:{code:{anchors:{importPath:'./'+name,export:name}},figma:{anchors:{fileKey:'file',componentSetKey:key,nodeId}}},anatomy:{root}});
 const variant=(name:string,property:string,values:string[],fallback:string)=>({name,type:{enum:values},default:fallback,bindings:{code:{prop:name},figma:{kind:'VARIANT',property,values:Object.fromEntries(values.map(v=>[v,v]))}}});
 const Input:any={setName:'Input',type:'COMPONENT_SET',nodeId:'input-set-id',key:'input-set',propertyDefinitions:{Size:{type:'VARIANT',defaultValue:'medium',variantOptions:['medium','large']}},variants:['medium','large'].map(size=>({name:'Size='+size,nodeId:'input-'+size,type:'COMPONENT',componentKey:'input-key-'+size,variantProperties:{Size:size}}))};
 const Item:any={setName:'Item',type:'COMPONENT_SET',nodeId:'item-set-id',key:'item-set',propertyDefinitions:{Layout:{type:'VARIANT',defaultValue:'vertical',variantOptions:['vertical']}},variants:[{name:'Layout=vertical',type:'COMPONENT',nodeId:'item-vertical',componentKey:'item-key-vertical',variantProperties:{Layout:'vertical'},children:[{name:'Input',type:'INSTANCE',nodeId:'inner-input',instanceSetKey:'input-set',instanceKey:'input-key-medium',instanceGeometry:{componentId:'input-medium'},componentProperties:{Size:'medium'}}]}]};
 const Carrier:any={setName:'Carrier',type:'COMPONENT',nodeId:'carrier-main',key:'carrier-key',propertyDefinitions:{'Payload#1:2':{type:'INSTANCE_SWAP',defaultValue:'item-vertical'}},variants:[{name:'Carrier',type:'COMPONENT',nodeId:'carrier-main',children:[{name:'Placeholder',type:'INSTANCE',nodeId:'slot-node',instanceSetKey:'item-set',instanceKey:'item-key-vertical',propRefs:{mainComponent:'Payload'}}]}]};
 const host:any={name:'Carrier',type:'INSTANCE',nodeId:'carrier-use',instanceKey:'carrier-key',instanceGeometry:{componentId:'carrier-main'},fixedSwaps:{Payload:{id:'item-vertical',key:'item-key-vertical',observedInstances:[{nodeId:'Icarrier-use;slot-node',componentId:'item-vertical',path:[0]}]}},hostOverrides:[{path:'Item/Input',fields:['componentProperties','counterAxisSizingMode'],instanceProperties:{ownerId:'carrier-use',ownerComponentId:'carrier-main',ownerComponentKey:'carrier-key',nodeId:'Icarrier-use;slot-node;inner-input',componentId:'input-large',componentKey:'input-key-large',componentSetKey:'input-set',path:[0,0],properties:{Size:{type:'VARIANT',value:'large'}}}}]};
 const Parent:any={setName:'Parent',type:'COMPONENT',nodeId:'parent-main',key:'parent-key',variants:[{name:'Parent',type:'COMPONENT',nodeId:'parent-main',children:[host]}]};
 const input=make('ds.input','Input','input-set','input-set-id',[variant('p8','Size',['medium','large'],'medium')],{instanceRootInputs:['width','height'],tokens:{height:'{input.height.{p8}}'}});
 const item=make('ds.item','Item','item-set','item-set-id',[variant('p2','Layout',['vertical'],'vertical'),{name:'p1',type:'boolean',default:false,bindings:{code:{prop:'p1'},figma:{kind:'NONE'}}}],{instanceRootInputs:['width','height'],parts:{input:{component:{id:input.id,props:{p8:'medium'},rootOverrides:{width:'{existing.width}',height:'{existing.height.{p2}}'}}}}});
 const carrier=make('ds.carrier','Carrier','carrier-key','carrier-main',[],{parts:{payload:{slot:{name:'payload',bindings:{figma:{property:'Payload'}},defaultContent:[{id:item.id,props:{p2:'vertical'}}],renderDefault:true},parts:{fallback:{component:{id:item.id,props:{p2:'vertical'}}}}}}});
 const parent=make('ds.parent','Parent','parent-key','parent-main',[],{parts:{host:{component:{id:carrier.id,contentSlots:{payload:['selected']}},parts:{selected:{component:{id:item.id,props:{p2:'vertical',p1:false},rootOverrides:{width:'{current.width}'}}}}}}});
 const proposal=(setName:string,contract:any,sourceInstanceParts:any[]=[])=>({setName,contract,notes:[],unbound:[],sourceInstanceParts});
 const proposals:any[]=[proposal('Input',input),proposal('Item',item,[{nodeId:'inner-input',partKey:'input',childId:input.id}]),proposal('Carrier',carrier),proposal('Parent',parent,[{nodeId:'carrier-use',partKey:'host',childId:carrier.id}])];
 return {dump:{Input,Item,Carrier,Parent},host,proposals,input,item,carrier,parent};
}
test('selected nested boundary forwards exact typed variant and preserves scoped sizing limits',()=>{
 const f=selectedBoundaryFixture(),before=JSON.stringify(f.dump),originalItem=structuredClone(f.item),originalCarrier=structuredClone(f.carrier);
 assert(nestedPropertySourceNodes(f.dump).has('inner-input'));
 settleNestedPropertyInputs(f.dump,'file',f.proposals,new Set());
 const parent=ContractSchema.parse(f.proposals[3].contract),item=ContractSchema.parse(f.proposals[1].contract);
 const selected=parent.anatomy.root.parts!.host.parts!.selected;
 assert.equal(selected.component!.props!.p2,'vertical');assert.equal(selected.component!.props!.p1,false,'unrelated colon Boolean stays false');
 const supplied=Object.values(selected.parts??{}).find(p=>p.component?.id==='ds.input');assert(supplied);
 assert.equal(supplied.component!.props!.p8,'large');
 assert.deepEqual(supplied.component!.rootOverrides,{width:'{existing.width}',height:'{existing.height.vertical}'},'preserve existing dimensions without capturing caller p2 or inventing new height');
 assert.equal(item.anatomy.root.parts!.input.slot!.defaultContent![0].props!.p8,'medium');
 const fallback=Object.values(item.anatomy.root.parts!.input.parts!)[0];assert.deepEqual(fallback,originalItem.anatomy.root.parts!.input);
 assert.deepEqual(f.proposals[2].contract,originalCarrier);assert.equal(JSON.stringify(f.dump),before);
 assert(f.proposals[3].notes.some((n:string)=>n.includes('nested-property-size-not-carried')));
});
test('selected nested boundary refuses stale identities paths slots and new owner violations atomically',()=>{
 const mutations:Array<(f:ReturnType<typeof selectedBoundaryFixture>)=>void>=[
  f=>{f.host.fixedSwaps.Payload.key='wrong';},f=>{f.host.fixedSwaps.Payload.observedInstances[0].nodeId='Iwrong;slot-node';},
  f=>{f.host.fixedSwaps.Payload.observedInstances[0].selectedRoot={hostId:'wrong'};},f=>{f.dump.Item.contractId='authored.item';},f=>{f.dump.Input.variants.push(structuredClone(f.dump.Input.variants[1]));},
  f=>{f.host.fixedSwaps.Payload.observedInstances[0].path=[1];},f=>{f.host.fixedSwaps.Payload.observedInstances.push(structuredClone(f.host.fixedSwaps.Payload.observedInstances[0]));},
  f=>{f.host.hostOverrides[0].instanceProperties.ownerComponentKey='wrong';},f=>{f.host.hostOverrides[0].instanceProperties.nodeId='Icarrier-use;inner-input';},
  f=>{f.host.hostOverrides[0].instanceProperties.properties.Size.value='unknown';},f=>{f.dump.Item.variants.push(structuredClone(f.dump.Item.variants[0]));},
  f=>{f.proposals[3].contract.anatomy.root.parts.host.component.contentSlots.payload=['selected','selected'];},
  f=>{f.proposals[1].contract.anatomy.root.parts.input.component.rootOverrides.height='{existing.height.{unknown}}';},
  f=>{f.proposals[1].contract.props.push({name:'show',type:'boolean',bindings:{code:{prop:'show'},figma:{kind:'NONE'}}});f.proposals[1].contract.anatomy.root.parts.input.visibilityOverrideProp='show';},
 ];
 for(const mutate of mutations){const f=selectedBoundaryFixture();mutate(f);const before=JSON.stringify(f.proposals.map(p=>p.contract));settleNestedPropertyInputs(f.dump,'file',f.proposals,new Set());assert.equal(JSON.stringify(f.proposals.map(p=>p.contract)),before,String(mutate));assert(f.proposals[3].notes.some((n:string)=>n.includes('nested-property-input-not-carried')));}
 const protectedCase=selectedBoundaryFixture(),before=JSON.stringify(protectedCase.proposals.map(p=>p.contract));settleNestedPropertyInputs(protectedCase.dump,'file',protectedCase.proposals,new Set(['ds.item']));assert.equal(JSON.stringify(protectedCase.proposals.map(p=>p.contract)),before);
});

test('selected nested boundary rekeys shared caller content and preserves unchanged semantic adornments',()=>{
 const f=selectedBoundaryFixture();
 const marker=ContractSchema.parse({...structuredClone(f.input),id:'ds.marker',name:'Marker',props:[],bindings:{code:{anchors:{importPath:'./Marker',export:'Marker'}},figma:{anchors:{fileKey:'file',componentSetKey:'marker-key',nodeId:'marker-main'}}},anatomy:{root:{overridable:['size'],tokens:{width:'{marker.size}',height:'{marker.size}'}}}});
 f.proposals.push({setName:'Marker',contract:marker,notes:[],unbound:[],sourceInstanceParts:[]});
 (f.dump as any).Marker={setName:'Marker',type:'COMPONENT',key:'marker-key',nodeId:'marker-main',contractId:marker.id,variants:[{name:'Marker',type:'COMPONENT',nodeId:'marker-main',componentKey:'marker-key'}]};
 f.input.anatomy.root.parts={mark:{slot:{name:'mark',bindings:{figma:{property:'Mark'}},renderDefault:true,defaultContent:[{id:marker.id}]},parts:{defaultMark:{component:{id:marker.id}}}}};
 f.item.anatomy.root.parts!.input.component!.contentSlots={mark:['mark']};
 f.item.anatomy.root.parts!.input.parts={mark:{component:{id:marker.id,overrides:{size:'{marker.size}'}}}};
 f.dump.Item.variants[0].children[0].fixedSwaps={Mark:{id:'marker-main',key:'marker-key'}};
 f.host.hostOverrides[0].instanceProperties.properties.Mark={type:'INSTANCE_SWAP',value:'marker-main',selected:{nodeId:'marker-main',componentKey:'marker-key'}};
 f.item.props[0].type={enum:['垂直']};f.item.props[0].default='垂直';f.item.props[0].bindings.figma.values={'垂直':'垂直'};
 f.dump.Item.propertyDefinitions.Layout.defaultValue='垂直';f.dump.Item.propertyDefinitions.Layout.variantOptions=['垂直'];f.dump.Item.variants[0].variantProperties.Layout='垂直';
 f.parent.anatomy.root.parts!.host.parts!.selected.component!.props!.p2='垂直';
 f.parent.props.push({name:'p2',type:{enum:['垂直','水平']},default:'垂直',bindings:{code:{prop:'p2'},figma:{kind:'VARIANT',property:'Layout',values:{'垂直':'垂直','水平':'水平'}}}});
 f.dump.Parent.type='COMPONENT_SET';f.dump.Parent.propertyDefinitions={Layout:{type:'VARIANT',defaultValue:'垂直',variantOptions:['垂直','水平']}};
 f.dump.Parent.variants[0].variantProperties={Layout:'垂直'};
 const second=structuredClone(f.dump.Parent.variants[0]);second.nodeId='parent-second';second.variantProperties.Layout='水平';second.children[0].nodeId='carrier-second';delete second.children[0].hostOverrides;f.dump.Parent.variants.push(second);
 f.proposals[3].sourceInstanceParts.push({nodeId:'carrier-second',partKey:'host',childId:f.carrier.id});
 const before=JSON.stringify(f.dump),markerBefore=JSON.stringify(marker);
 settleNestedPropertyInputs(f.dump,'file',f.proposals,new Set());
 const parent=ContractSchema.parse(f.proposals[3].contract),parts=walkAnatomy(parent),input=parts.find(p=>p.part.component?.id==='ds.input');assert(input,JSON.stringify(f.proposals[3].notes));
 assert.equal(new Set(parts.map(p=>p.name)).size,parts.length,'cloned parts use globally unique keys');
 assert.equal(input.part.component!.props!.p8,'large');assert.equal(input.part.component!.rootOverrides!.height,'{existing.height.{p2}}','Unicode token path stays in a same-valued isolated caller scope');
 const adornment=Object.values(input.part.parts??{})[0];assert.deepEqual(adornment.component,{id:'ds.marker',overrides:{size:'{marker.size}'}});
 const route=input.part.component!.contentSlots!.mark;assert.equal(route.length,1);assert.equal(input.part.parts![route[0]],adornment);
 assert.equal(JSON.stringify(f.dump),before);assert.equal(JSON.stringify(f.proposals[4].contract),markerBefore);
});

function capturedHugFixture(){
 const f=selectedBoundaryFixture(),source=f.dump.Item.variants[0].children[0],selected=f.dump.Input.variants[1];
 source.instanceSizing={horizontal:'FILL',vertical:'HUG'};
 selected.bbox={width:220,height:36};selected.layout={mode:'HORIZONTAL',primarySizing:'FIXED',counterSizing:'AUTO'};
 f.host.fixedSwaps.Payload.observedInstances[0].size={width:300,height:86};
 f.host.hostOverrides[0].instanceProperties.layout={kind:'nested-instance-layout-v1',nodeId:'Icarrier-use;slot-node;inner-input',componentId:'input-large',parentId:'Icarrier-use;slot-node',localSize:{width:300,height:36},parentSize:{width:300,height:86},relativeTransform:[[1,0,0],[0,1,30]],sizing:{horizontal:'FILL',vertical:'HUG'},inFlow:true,sizeBound:false};
 return f;
}
test('selected nested HUG occurrence retires only the old height without inventing dimensions',()=>{
 const f=capturedHugFixture(),before=JSON.stringify(f.dump);settleNestedPropertyInputs(f.dump,'file',f.proposals,new Set());
 const parent=ContractSchema.parse(f.proposals[3].contract),selected=parent.anatomy.root.parts!.host.parts!.selected;
 const input=Object.values(selected.parts??{}).find(p=>p.component?.id==='ds.input')!;assert(input);
 assert.equal(input.component!.props!.p8,'large');assert.deepEqual(input.component!.rootOverrides,{width:'{existing.width}'});
 const owner=ContractSchema.parse(f.proposals[1].contract),fallback=Object.values(owner.anatomy.root.parts!.input.parts!)[0];
 assert.equal(fallback.component!.rootOverrides!.height,'{existing.height.{p2}}','standalone default stays unchanged');
 assert(f.proposals[3].notes.some((n:string)=>n.includes('nested-property-height-retired')));assert.equal(JSON.stringify(f.dump),before);
});
test('selected nested HUG height authority refuses missing stale fixed bound and contradictory observations',()=>{
 const mutations:Array<(f:ReturnType<typeof capturedHugFixture>)=>void>=[
  f=>{delete f.host.hostOverrides[0].instanceProperties.layout;},
  f=>{f.host.hostOverrides[0].instanceProperties.layout.nodeId='other';},
  f=>{f.host.hostOverrides[0].instanceProperties.layout.componentId='input-medium';},
  f=>{f.host.hostOverrides[0].instanceProperties.layout.parentId='other';},
  f=>{f.host.hostOverrides[0].instanceProperties.layout.localSize.height=35;},
  f=>{f.host.hostOverrides[0].instanceProperties.layout.parentSize.height=87;},
  f=>{f.host.hostOverrides[0].instanceProperties.layout.relativeTransform=[[1,1,0],[0,1,30]];},
  f=>{f.host.hostOverrides[0].instanceProperties.layout.relativeTransform=new Array(2);},
  f=>{f.host.hostOverrides[0].instanceProperties.layout.sizing.width=300;},
  f=>{f.host.hostOverrides[0].instanceProperties.layout.sizing={horizontal:'FILL',vertical:'FIXED',height:36};},
  f=>{f.host.hostOverrides[0].instanceProperties.layout.sizing.height=36;},
  f=>{f.host.hostOverrides[0].instanceProperties.layout.sizeBound=true;},
  f=>{f.host.hostOverrides[0].instanceProperties.layout.inFlow=false;},
  f=>{f.dump.Input.variants[1].layout.counterSizing='FIXED';},
  f=>{f.dump.Item.variants[0].children[0].instanceSizing.vertical='FIXED';},
 ];
 for(const mutate of mutations){const f=capturedHugFixture();mutate(f);settleNestedPropertyInputs(f.dump,'file',f.proposals,new Set());
  const parent=ContractSchema.parse(f.proposals[3].contract),selected=parent.anatomy.root.parts!.host.parts!.selected,input=Object.values(selected.parts??{}).find(p=>p.component?.id==='ds.input')!;assert(input,String(mutate));
  assert.equal(input.component!.props!.p8,'large');assert.equal(input.component!.rootOverrides!.height,'{existing.height.vertical}',String(mutate));
  assert(f.proposals[3].notes.some((n:string)=>n.includes('nested-property-size-not-carried')),String(mutate));
 }
});

function ordinaryBoundaryFixture(){
 const f=selectedBoundaryFixture();
 delete f.host.fixedSwaps;
 const source=f.dump.Carrier.variants[0].children[0];delete source.propRefs;source.instanceGeometry={componentId:'item-vertical'};source.componentProperties={Layout:'vertical'};
 f.carrier.props.push({name:'state',type:{enum:['vertical','horizontal']},default:'vertical',bindings:{code:{prop:'state'},figma:{kind:'NONE'}}});
 f.carrier.anatomy.root.parts={item:{component:{id:f.item.id,props:{p2:'{state}',p1:false},rootOverrides:{width:'{height}'}}}};
 f.parent.anatomy.root.parts={host:{component:{id:f.carrier.id,props:{state:'vertical'}}}};
 f.proposals[2].sourceInstanceParts=[{nodeId:'slot-node',partKey:'item',childId:f.item.id}];
 return f;
}
test('ordinary two-boundary forwarding preserves scoped fallbacks and token names',()=>{
 const f=ordinaryBoundaryFixture(),before=JSON.stringify(f.dump),hostBefore=structuredClone(f.carrier.anatomy.root.parts!.item),leafBefore=structuredClone(f.item.anatomy.root.parts!.input);
 assert(nestedPropertySourceNodes(f.dump).has('inner-input'));
 settleNestedPropertyInputs(f.dump,'file',f.proposals,new Set());
 const parent=ContractSchema.parse(f.proposals[3].contract),wrapper=ContractSchema.parse(f.proposals[2].contract),owner=ContractSchema.parse(f.proposals[1].contract);
 const group=walkAnatomy(parent).find(row=>row.part.component?.id===f.item.id)?.part;
 assert(group,JSON.stringify(f.proposals[3].notes));assert.equal(group.component!.props!.p2,'vertical');assert.equal(group.component!.rootOverrides!.width,'{height}');
 const leaf=Object.values(group.parts??{}).find(part=>part.component?.id===f.input.id);assert(leaf);assert.equal(leaf.component!.props!.p8,'large');
 assert.deepEqual(leaf.component!.rootOverrides,{width:'{existing.width}',height:'{existing.height.vertical}'});
 assert.deepEqual(wrapper.anatomy.root.parts!.item.parts!.nestedDefaultitem,hostBefore);
 assert.deepEqual(owner.anatomy.root.parts!.input.parts!.nestedDefaultinput,leafBefore);
 assert.equal(JSON.stringify(f.dump),before);
});
test('ordinary two-boundary forwarding refuses ambiguous identities mappings and conflicting witnesses',()=>{
 const mutations:Array<(f:ReturnType<typeof ordinaryBoundaryFixture>)=>void>=[
  f=>{f.dump.Carrier.variants[0].children[0].instanceKey='wrong';},
  f=>{f.dump.Carrier.variants[0].children[0].instanceGeometry.componentId='wrong';},
  f=>{f.dump.Item.variants.push(structuredClone(f.dump.Item.variants[0]));},
  f=>{f.proposals[2].sourceInstanceParts.push({...f.proposals[2].sourceInstanceParts[0]});},
  f=>{f.carrier.anatomy.root.parts!.item.component!.props!.p2='{unknown}';},
  f=>{f.item.anatomy.root.parts!.input.component!.rootOverrides!.height='{size.{unknown}}';},
  f=>{const row=structuredClone(f.host.hostOverrides[0]);row.instanceProperties.properties.Size.value='medium';f.host.hostOverrides.push(row);},
 ];
 for(const mutate of mutations){const f=ordinaryBoundaryFixture();mutate(f);const before=JSON.stringify(f.proposals.map(p=>p.contract));settleNestedPropertyInputs(f.dump,'file',f.proposals,new Set());assert.equal(JSON.stringify(f.proposals.map(p=>p.contract)),before,String(mutate));}
});
test('ordinary forwarding uses globally unique caller names despite part-name collisions',()=>{
 const f=ordinaryBoundaryFixture();f.parent.anatomy.root.parts!.nestedOwnerUsage0={text:'collision'};f.parent.anatomy.root.parts!.nestedUsage0_0={text:'leaf collision'};
 settleNestedPropertyInputs(f.dump,'file',f.proposals,new Set());const parent=ContractSchema.parse(f.proposals[3].contract),parts=walkAnatomy(parent);
 assert.equal(new Set(parts.map(p=>p.name)).size,parts.length);assert.equal(parent.anatomy.root.parts!.nestedOwnerUsage0.text,'collision');assert.equal(parent.anatomy.root.parts!.nestedUsage0_0.text,'leaf collision');assert(parts.some(p=>p.part.component?.id==='ds.input'));
});

test('ordinary forwarding retains dynamic and lookup fallbacks verbatim',()=>{
 const f=ordinaryBoundaryFixture();
 f.item.props.push({name:'value',type:'text',default:'owner default',bindings:{code:{prop:'value'},figma:{kind:'TEXT',property:'Value'}}});
 f.input.props.push({name:'value',type:'text',default:'child default',bindings:{code:{prop:'value'},figma:{kind:'TEXT',property:'Value'}}});
 f.item.anatomy.root.parts!.input.component!.props!.value='{value}';
 f.item.anatomy.root.parts!.input.component!.props!.p8={prop:'p2',map:{vertical:'medium'}};
 f.host.hostOverrides[0].instanceProperties.properties.Value={type:'TEXT',value:'captured'};
 const before=structuredClone(f.item.anatomy.root.parts!.input);
 settleNestedPropertyInputs(f.dump,'file',f.proposals,new Set());
 const owner=ContractSchema.parse(f.proposals[1].contract),parent=ContractSchema.parse(f.proposals[3].contract);
 assert.deepEqual(owner.anatomy.root.parts!.input.parts!.nestedDefaultinput,before);
 const leaf=walkAnatomy(parent).find(row=>row.part.component?.id===f.input.id)!.part;
 assert.equal(leaf.component!.props!.value,'captured');assert.equal(leaf.component!.props!.p8,'large');
});
test('ordinary forwarding admits only a unique false optional slot at its captured off default',()=>{
 for(const mode of ['false','true','ambiguous','wrong-default','visible-default']){
  const f=ordinaryBoundaryFixture();f.input.anatomy.root.parts={left:{optional:true,slot:{name:'left',bindings:{figma:{property:'Left Icon'}}}}};
  f.dump.Input.propertyDefinitions['Show Left Icon#1:3']={type:'BOOLEAN',defaultValue:mode==='wrong-default'};
  f.host.hostOverrides[0].instanceProperties.properties['Show Left Icon#1:3']={type:'BOOLEAN',value:mode==='true'};
  if(mode==='visible-default'){f.input.anatomy.root.parts.left.slot!.renderDefaultAnatomy=true;f.input.anatomy.root.parts.left.parts={visibleDefault:{text:'visible'}};}
  if(mode==='ambiguous')f.input.anatomy.root.parts.right={optional:true,slot:{name:'right',bindings:{figma:{property:'Left Icon'}}}};
  const before=JSON.stringify(f.proposals.map(p=>p.contract));settleNestedPropertyInputs(f.dump,'file',f.proposals,new Set());
  if(mode==='false')assert(walkAnatomy(ContractSchema.parse(f.proposals[3].contract)).some(p=>p.part.component?.id==='ds.input'));
  else assert.equal(JSON.stringify(f.proposals.map(p=>p.contract)),before,mode);
 }
});
test('ordinary forwarding is observation-order independent and refuses property spelling conflicts',()=>{
 const make=()=>{const f=ordinaryBoundaryFixture(),second=structuredClone(f.dump.Item.variants[0].children[0]);second.nodeId='second-input';f.dump.Item.variants[0].children.push(second);
  f.item.anatomy.root.parts!.input2=structuredClone(f.item.anatomy.root.parts!.input);f.proposals[1].sourceInstanceParts.push({nodeId:'second-input',partKey:'input2',childId:'ds.input'});
  const observation=structuredClone(f.host.hostOverrides[0]);observation.instanceProperties.path=[0,1];observation.instanceProperties.nodeId='Icarrier-use;slot-node;second-input';f.host.hostOverrides.push(observation);return f;};
 const values=[];for(const reverse of [false,true]){const f=make();if(reverse)f.host.hostOverrides.reverse();settleNestedPropertyInputs(f.dump,'file',f.proposals,new Set());
  values.push(walkAnatomy(ContractSchema.parse(f.proposals[3].contract)).filter(p=>p.part.component?.id==='ds.input').map(p=>p.part.component!.props!.p8).sort());}
 assert.deepEqual(values,[['large','large'],['large','large']]);
 const f=ordinaryBoundaryFixture();f.host.hostOverrides[0].instanceProperties.properties['Size#1:9']={type:'VARIANT',value:'medium'};
 const before=JSON.stringify(f.proposals.map(p=>p.contract));settleNestedPropertyInputs(f.dump,'file',f.proposals,new Set());assert.equal(JSON.stringify(f.proposals.map(p=>p.contract)),before);
});
test('ordinary forwarding preserves React caller replacement and standalone dynamic defaults',async t=>{
 const f=ordinaryBoundaryFixture();
 f.item.props=f.item.props.filter(p=>p.name!=='p1');delete f.carrier.anatomy.root.parts!.item.component!.props!.p1;
 f.carrier.props=[];f.carrier.anatomy.root.parts!.item.component!.props!.p2='vertical';delete f.parent.anatomy.root.parts!.host.component!.props!.state;
 f.input.props.push({name:'value',type:'text',default:'child default',bindings:{code:{prop:'value'},figma:{kind:'TEXT',property:'Value'}}});
 delete f.input.anatomy.root.tokens;f.input.anatomy.root.parts={value:{content:{prop:'value'}}};
 f.item.props.push({name:'value',type:'text',default:'owner default',bindings:{code:{prop:'value'},figma:{kind:'TEXT',property:'Value'}}});
 f.item.anatomy.root.parts!.input.component!.props!.value='{value}';delete f.item.anatomy.root.parts!.input.component!.rootOverrides;
 f.carrier.props.push({name:'value',type:'text',default:'wrapper default',bindings:{code:{prop:'value'},figma:{kind:'TEXT',property:'Value'}}});
 f.carrier.anatomy.root.parts!.item.component!.props!.value='{value}';delete f.carrier.anatomy.root.parts!.item.component!.rootOverrides;
 f.host.hostOverrides[0].instanceProperties.properties.Value={type:'TEXT',value:'captured'};
 settleNestedPropertyInputs(f.dump,'file',f.proposals,new Set());
 const contracts=new Map(f.proposals.map(p=>{const c=ContractSchema.parse(p.contract);return[c.id,c]as const;}));
 const browser=await chromium.launch();t.after(()=>browser.close());
 for(const emitter of [reactEmitter,reactInlineEmitter]){const dependencies=Object.fromEntries([...contracts.values()].map(c=>{const files=emitter.emit(c,{contracts,icons:new Map(),tokens:{primitives:{},semantic:{},light:{},dark:{},brands:{default:{}}}});return[c.name,{tsx:files[0].contents,css:files.find(f=>f.path.endsWith('.css'))?.contents}];}));
  const page=await browser.newPage();try{
   for(const [name,expected]of [['Parent','captured'],['Carrier','wrapper default'],['Item','owner default']]as const){const code=dependencies[name];const render=await mountGenerated(page,name,code.tsx,code.css,dependencies);assert.equal(await page.locator('#root').innerText(),expected);
    if(name!=='Parent'){await render({value:'edited default'});assert.equal(await page.locator('#root').innerText(),'edited default');}}
  }finally{await page.close();}
 }
});

test('ordinary relocation refuses references to mutable owner state',()=>{
 for(const initial of [false,true]){
  const f=ordinaryBoundaryFixture();f.carrier.props[0].bindings.figma={kind:'VARIANT',property:'State',values:{vertical:'Vertical',horizontal:'Horizontal'}};
  f.carrier.events=[{name:'change',trigger:'root',bindings:{code:{prop:'onStateChange'}},toggles:{prop:'state',between:['vertical','horizontal']}}];
  if(initial)f.carrier.props[0].bindings.code.initial={prop:'defaultState',default:'vertical'};
  const before=JSON.stringify(f.proposals.map(p=>p.contract));settleNestedPropertyInputs(f.dump,'file',f.proposals,new Set());assert.equal(JSON.stringify(f.proposals.map(p=>p.contract)),before);
 }
});


function directScopedFixture(){
 const f=selectedBoundaryFixture();delete f.host.fixedSwaps;
 const target=structuredClone(f.dump.Item.variants[0].children[0]);
 f.dump.Carrier.variants[0].children=[target];
 const mode:any={name:'mode',type:{enum:['compact','other']},default:'compact',bindings:{code:{prop:'mode'},figma:{kind:'NONE'}}};
 f.carrier.props=[mode];
 f.carrier.anatomy.root.parts={input:{component:{id:f.input.id,props:{p8:{prop:'mode',map:{compact:'medium',other:'medium'}}},rootOverrides:{width:'{old.width.{mode}}',height:'{old.height}'}}}};
 f.parent.anatomy.root.parts={host:{component:{id:f.carrier.id,props:{mode:'compact'}}}};
 f.proposals[2].sourceInstanceParts=[{nodeId:'inner-input',partKey:'input',childId:f.input.id}];
 const w=f.host.hostOverrides[0].instanceProperties;w.path=[0];w.nodeId='Icarrier-use;inner-input';
 w.layout={kind:'nested-instance-layout-v1',nodeId:w.nodeId,componentId:'input-large',parentId:'carrier-use',localSize:{width:28,height:28},parentSize:{width:40,height:40},relativeTransform:[[1,0,0],[0,1,0]],sizing:{horizontal:'FIXED',vertical:'FIXED',width:28,height:28},inFlow:true,sizeBound:true};
 for(const [i,main]of f.dump.Input.variants.entries()){main.bbox={width:i?28:55,height:i?28:24};main.layout={mode:'HORIZONTAL',primary:'MIN',counter:'MIN',spacing:0,padding:[0,0,0,0],primarySizing:'FIXED',counterSizing:'FIXED'};}
 f.input.anatomy.root={instanceRootInputs:['width','height'],literalsByProp:[{prop:'p8',map:{medium:{width:'55px',height:'24px'},large:{width:'28px',height:'28px'}}}]};
 return f;
}
test('direct nested caller localizes immutable mappings and retires only independently proven fixed clamps',()=>{
 const f=directScopedFixture(),before=structuredClone(f.carrier.anatomy.root.parts!.input),source=JSON.stringify(f.dump);
 settleNestedPropertyInputs(f.dump,'file',f.proposals,new Set());
 const parent=ContractSchema.parse(f.proposals[3].contract),carrier=ContractSchema.parse(f.proposals[2].contract);
 const supplied=walkAnatomy(parent).find(p=>p.part.component?.id===f.input.id)?.part;assert(supplied,JSON.stringify(f.proposals[3].notes));
 assert.equal(supplied.component!.props!.p8,'large');assert.equal(supplied.component!.rootOverrides,undefined);
 assert.deepEqual(carrier.anatomy.root.parts!.input.parts!.nestedDefaultinput,before);assert.equal(JSON.stringify(f.dump),source);
});
test('direct nested caller refuses unresolved mutable or geometrically contradictory copies atomically',()=>{
 const mutations:Array<(f:ReturnType<typeof directScopedFixture>)=>void>=[
  f=>{delete f.parent.anatomy.root.parts!.host.component!.props!.mode;},
  f=>{f.carrier.props[0].bindings.code.initial={prop:'defaultMode',default:'compact'};f.carrier.events=[{name:'change',trigger:'root',bindings:{code:{prop:'onModeChange'}},toggles:{prop:'mode',between:['compact','other']}}];},
  f=>{(f.carrier.anatomy.root.parts!.input.component!.props!.p8 as any).map={other:'medium'};},
  f=>{f.host.hostOverrides[0].instanceProperties.layout!.nodeId='wrong';},
  f=>{f.host.hostOverrides[0].instanceProperties.layout!.parentId='wrong';},
  f=>{f.host.hostOverrides[0].instanceProperties.layout!.relativeTransform[0][1]=1;},
  f=>{f.host.hostOverrides[0].instanceProperties.layout!.sizeBound=false;},
  f=>{f.host.hostOverrides[0].instanceProperties.layout!.sizing.horizontal='HUG';},
  f=>{f.host.hostOverrides[0].instanceProperties.layout!.localSize.width=29;},
  f=>{f.dump.Input.variants[1].bbox!.height=29;},
  f=>{f.input.anatomy.root.literalsByProp![0].map.large.height='29px';},
  f=>{delete f.input.anatomy.root.literalsByProp![0].map.large.width;},
  f=>{f.carrier.anatomy.root.parts!.input.component!.rootFill=['width'];},
  f=>{f.carrier.anatomy.root.parts!.input.layout={grow:true};},
  f=>{f.input.anatomy.root.stylesWhen=[{prop:'p8',equals:'large',styles:{width:'29px'}}];},
 ];
 for(const mutate of mutations){const f=directScopedFixture();mutate(f);for(const p of f.proposals){const parsed=ContractSchema.safeParse(p.contract);assert(parsed.success,JSON.stringify({mutation:String(mutate),set:p.setName,errors:parsed.success?[]:parsed.error.issues}));}const before=JSON.stringify(f.proposals.map(p=>p.contract));settleNestedPropertyInputs(f.dump,'file',f.proposals,new Set());assert.equal(JSON.stringify(f.proposals.map(p=>p.contract)),before,String(mutate));}
});
function directSlotFixture(){
 const f=directScopedFixture(),layout=f.dump.Input.variants[1].layout;
 const mark=(name:string)=>({setName:name,type:'COMPONENT',nodeId:name+'-main',key:name+'-key',variants:[{name,type:'COMPONENT',nodeId:name+'-main',componentKey:name+'-key',layout}]});
 const makeMark=(name:string)=>ContractSchema.parse({id:'ds.'+name.toLowerCase(),name,description:'Direct slot marker',version:'0.1.0',status:'draft',semantics:{element:'div'},states:[],props:[],bindings:{code:{anchors:{importPath:'./'+name,export:name}},figma:{anchors:{fileKey:'file',componentSetKey:name+'-key',nodeId:name+'-main'}}},anatomy:{root:{text:name}}});
 for(const name of ['DefaultMark','ChosenMark']){(f.dump as any)[name]=mark(name);f.proposals.push({setName:name,contract:makeMark(name),notes:[],unbound:[],sourceInstanceParts:[]});}
 for(const [name,property]of [['left','Left Icon'],['right','Right Icon']]){(f.dump.Input.propertyDefinitions as any)['Show '+property]={type:'BOOLEAN',defaultValue:false};(f.dump.Input.propertyDefinitions as any)[property]={type:'INSTANCE_SWAP',defaultValue:'DefaultMark-main'};}
 const slot=(name:string,property:string)=>({slot:{name,bindings:{figma:{property}},defaultContent:[{id:'ds.defaultmark'}],renderDefault:true},optional:true});
 f.input.anatomy.root.parts={left:slot('left','Left Icon') as any,right:{...slot('right','Right Icon'),presenceByCombination:{props:['p8'],rows:[{values:['medium'],present:true},{values:['large'],present:false}]}} as any};
 f.dump.Input.variants[1].children=[{name:'DefaultMark',type:'INSTANCE',nodeId:'large-left',instanceOf:'DefaultMark',instanceKey:'DefaultMark-key',propRefs:{mainComponent:'Left Icon'}}] as any;
 const original=f.carrier.anatomy.root.parts!.input;original.component!.contentSlots={left:['leftContent'],right:['rightContent']};original.parts={leftContent:{component:{id:'ds.defaultmark',overrides:{size:'{marker.size}'}}},rightContent:{component:{id:'ds.defaultmark'},presenceByCombination:{props:['mode'],rows:[{values:['compact'],present:true},{values:['other'],present:false}]}}};
 const w=f.host.hostOverrides[0].instanceProperties;
 for(const property of ['Left Icon','Right Icon'])w.properties[property]={type:'INSTANCE_SWAP',value:'ChosenMark-main',selected:{nodeId:'ChosenMark-main',componentKey:'ChosenMark-key'}};
 for(const property of ['Show Left Icon','Show Right Icon'])w.properties[property]={type:'BOOLEAN',value:false};
 return f;
}
test('direct selected-main slots keep unbound visible content and omit absent slots despite inactive false Booleans',()=>{
 const f=directSlotFixture(),before=structuredClone(f.carrier.anatomy.root.parts!.input);
 for(const p of f.proposals){const parsed=ContractSchema.safeParse(p.contract);assert(parsed.success,JSON.stringify({name:p.setName,errors:parsed.success?[]:parsed.error.issues}));}
 // Marker tokens remain pure aliases, not looked up as caller props.
 settleNestedPropertyInputs(f.dump,'file',f.proposals,new Set());
 const parent=ContractSchema.parse(f.proposals[3].contract),carrier=ContractSchema.parse(f.proposals[2].contract);
 const leaf=walkAnatomy(parent).find(p=>p.part.component?.id===f.input.id)?.part;assert(leaf,JSON.stringify(f.proposals[3].notes));
 assert.equal(leaf.component!.props!.p8,'large');assert.equal(leaf.component!.contentSlots!.right.length,0);
 const left=leaf.component!.contentSlots!.left;assert.equal(left.length,1);assert.equal(leaf.parts![left[0]].component!.id,'ds.chosenmark');
 assert.deepEqual(carrier.anatomy.root.parts!.input.parts!.nestedDefaultinput,before);
});


test('direct fixed geometry is generic and requires resolved nonconflicting token values',()=>{
 const make=()=>{const f=directScopedFixture();const root=f.input.anatomy.root;delete root.literalsByProp![0].map.large.width;root.tokens={width:'{measure.width.{p8}}'};f.proposals[0].mintedTokens={tree:{measure:{width:{large:{$value:'{measure.actual}',$type:'dimension'}},actual:{$value:'28px',$type:'dimension'}}}};return f;};
 const good=make();settleNestedPropertyInputs(good.dump,'file',good.proposals,new Set());assert(walkAnatomy(ContractSchema.parse(good.proposals[3].contract)).some(p=>p.part.component?.id===good.input.id));
 for(const change of [
  (f:ReturnType<typeof make>)=>{f.proposals[0].mintedTokens.tree.measure.actual.$value='29px';},
  (f:ReturnType<typeof make>)=>{f.proposals[0].mintedTokens.tree.measure.actual.$value='{measure.width.large}';},
  (f:ReturnType<typeof make>)=>{delete f.proposals[0].mintedTokens.tree.measure.actual;},
  (f:ReturnType<typeof make>)=>{f.proposals[1].mintedTokens={tree:{measure:{actual:{$value:'29px',$type:'dimension'}}}};},
  (f:ReturnType<typeof make>)=>{f.input.anatomy.root.literalsByProp![0].map.large['min-width']='29px';},
 ]){const f=make();change(f);const before=JSON.stringify(f.proposals.map(p=>p.contract));settleNestedPropertyInputs(f.dump,'file',f.proposals,new Set());assert.equal(JSON.stringify(f.proposals.map(p=>p.contract)),before,String(change));}
 const other=directScopedFixture(),w=other.host.hostOverrides[0].instanceProperties;
 w.layout!.localSize={width:37,height:19};w.layout!.sizing={horizontal:'FIXED',vertical:'FIXED',width:37,height:19};other.dump.Input.variants[1].bbox={width:37,height:19};other.input.anatomy.root.literalsByProp![0].map.large={width:'37px',height:'19px'};
 settleNestedPropertyInputs(other.dump,'file',other.proposals,new Set());const leaf=walkAnatomy(ContractSchema.parse(other.proposals[3].contract)).find(p=>p.part.component?.id===other.input.id)?.part;assert(leaf);assert.equal(leaf.component!.rootOverrides,undefined);
});
test('direct slot copy refuses hidden or controlled selected content and unauthenticated swaps',()=>{
 for(const change of [
  (f:ReturnType<typeof directSlotFixture>)=>{f.dump.Input.variants[1].children![0].hidden=true;},
  (f:ReturnType<typeof directSlotFixture>)=>{f.dump.Input.variants[1].children![0].propRefs!.visible='Show Left Icon';},
  (f:ReturnType<typeof directSlotFixture>)=>{f.host.hostOverrides[0].instanceProperties.properties['Left Icon'].selected!.componentKey='foreign';},
  (f:ReturnType<typeof directSlotFixture>)=>{f.dump.Input.variants[1].children!.push(structuredClone(f.dump.Input.variants[1].children![0]));},
 ]){const f=directSlotFixture();change(f);const before=JSON.stringify(f.proposals.map(p=>p.contract));settleNestedPropertyInputs(f.dump,'file',f.proposals,new Set());assert.equal(JSON.stringify(f.proposals.map(p=>p.contract)),before,String(change));}
});


test('scoped caller preserves typed Boolean equality while filtering only proven inactive children',()=>{
 const f=directScopedFixture();f.carrier.props.push({name:'flag',type:'boolean',default:true,bindings:{code:{prop:'flag'},figma:{kind:'NONE'}}});
 const part:any={component:{id:'ds.input',contentSlots:{body:['on','off']}},parts:{on:{component:{id:'ds.input'},visibleWhen:{prop:'flag',equals:true}},off:{component:{id:'ds.input'},visibleWhen:{prop:'flag',equals:false}}}};
 const before=structuredClone(part),yes=scopedCaller(part,f.carrier,{mode:'compact',flag:true},true),no=scopedCaller(part,f.carrier,{mode:'compact',flag:false},true);
 assert.deepEqual(Object.keys(yes!.parts!),['on']);assert.deepEqual(yes!.component!.contentSlots!.body,['on']);assert.deepEqual(Object.keys(no!.parts!),['off']);assert.deepEqual(no!.component!.contentSlots!.body,['off']);assert.deepEqual(part,before);
 assert.equal(scopedCaller(part,f.carrier,{mode:'compact'},true),undefined);
});
test('fixed clamp retirement refuses state sizing and resolved layout growth modifiers',()=>{
 const changes:Array<(f:ReturnType<typeof directScopedFixture>)=>void>=[
  f=>{f.input.states=['hover'];f.input.anatomy.root.statesByProp=[{prop:'p8',state:'hover',map:{large:{width:'{other.width}'}}}];},
  f=>{f.input.states=['hover'];f.input.anatomy.root.declaredStates={hover:{'box-sizing':'content-box'}};},
  f=>{f.input.anatomy.root.tokens={'flex-grow':'{other.grow}'};},
  f=>{f.input.anatomy.root.layout={grow:true};},
  f=>{f.input.anatomy.root.layoutByProp={prop:'p8',map:{large:{grow:true}}};},
  f=>{f.input.anatomy.root.layoutByCombination={props:['p8'],rows:[{values:['medium'],layout:{grow:false}},{values:['large'],layout:{grow:true}}]};},
  f=>{f.input.anatomy.root.declared={transform:'scale(2)'};},
  f=>{f.input.anatomy.root.tokensByProp={prop:'p8',map:{large:{width:'{bad.width}'}}};f.proposals[0].mintedTokens={tree:{bad:{width:{$value:'29px',$type:'dimension'}}}};},
  f=>{f.input.props.push({name:'tone',type:{enum:['a','b']},default:'a',bindings:{code:{prop:'tone'},figma:{kind:'NONE'}}});f.input.anatomy.root.tokens={width:'{dim.{tone}.{p8}}'};f.input.anatomy.root.tokensByProp={prop:'p8',map:{large:{width:'{dim.fixed}'}}};f.proposals[0].mintedTokens={tree:{dim:{a:{large:{$value:'29px',$type:'dimension'}},fixed:{$value:'28px',$type:'dimension'}}}};},
 ];
 for(const change of changes){const f=directScopedFixture();change(f);for(const p of f.proposals){const parsed=ContractSchema.safeParse(p.contract);assert(parsed.success,JSON.stringify({change:String(change),set:p.setName,errors:parsed.success?[]:parsed.error.issues}));}const before=JSON.stringify(f.proposals.map(p=>p.contract));settleNestedPropertyInputs(f.dump,'file',f.proposals,new Set());assert.equal(JSON.stringify(f.proposals.map(p=>p.contract)),before,String(change));}
 const absent=directSlotFixture();absent.input.anatomy.root.parts!.right.presenceByCombination!.rows[1].present=true;const before=JSON.stringify(absent.proposals.map(p=>p.contract));settleNestedPropertyInputs(absent.dump,'file',absent.proposals,new Set());assert.equal(JSON.stringify(absent.proposals.map(p=>p.contract)),before);
});

test('fixed clamp retirement refuses a CSS padding floor wider than the captured fixed box',()=>{
 const f=directScopedFixture();f.input.anatomy.root.tokens={'padding-inline':'{spacing.fixed}'};f.proposals[0].mintedTokens={tree:{spacing:{fixed:{$value:'16px',$type:'dimension'}}}};
 const before=JSON.stringify(f.proposals.map(p=>p.contract));settleNestedPropertyInputs(f.dump,'file',f.proposals,new Set());assert.equal(JSON.stringify(f.proposals.map(p=>p.contract)),before,'28px width cannot establish a28px border box with32px padding');
});

test('fixed clamp retirement refuses real or unresolved borders even when padding alone fits',()=>{
 const changes:Array<(f:ReturnType<typeof directScopedFixture>)=>void>=[
  f=>{f.input.anatomy.root.literals={...f.input.anatomy.root.literals,'padding-inline':'12px','padding-block':'12px','border-width':'4px'};f.input.anatomy.root.declared={'border-style':'solid'};},
  f=>{f.input.anatomy.root.tokens={'border-width':'{stroke.actual}'};f.proposals[0].mintedTokens={tree:{stroke:{actual:{$value:'4px',$type:'dimension'}}}};},
  f=>{f.input.anatomy.root.declared={'border-style':'solid'};},
  f=>{f.input.anatomy.root.declared={'border-width':'4px','border-style':'solid'};},
  f=>{f.input.states=['hover'];f.input.anatomy.root.declaredStates={hover:{'border-width':'4px'}};},
  f=>{f.input.states=['hover'];f.input.anatomy.root.declared={'border-style':'solid'};f.input.anatomy.root.declaredStates={hover:{'border-width':'0px'}};},
  f=>{f.input.anatomy.root.tokens={'border-width':'{missing.width}'};},
 ];
 for(const change of changes){const f=directScopedFixture();change(f);for(const p of f.proposals){const parsed=ContractSchema.safeParse(p.contract);assert(parsed.success,JSON.stringify({change:String(change),errors:parsed.success?[]:parsed.error.issues}));}const before=JSON.stringify(f.proposals.map(p=>p.contract));settleNestedPropertyInputs(f.dump,'file',f.proposals,new Set());assert.equal(JSON.stringify(f.proposals.map(p=>p.contract)),before,String(change));}
 const clear=directScopedFixture();clear.input.anatomy.root.literals={'border-width':'0px'};clear.input.anatomy.root.declared={'border-style':'solid'};
 settleNestedPropertyInputs(clear.dump,'file',clear.proposals,new Set());
 const leaf=walkAnatomy(ContractSchema.parse(clear.proposals[3].contract)).find(p=>p.part.component?.id===clear.input.id)?.part;
 assert(leaf);assert.equal(leaf.component!.rootOverrides,undefined,'explicit zero border keeps the qualified path');
});
