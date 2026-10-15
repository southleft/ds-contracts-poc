import vm from 'node:vm';
import {createFigmaEngine} from './emit-figma-script.js';
import {createFigmaMock} from '../scripts/plugin-engine-mock-figma.mjs';
import test from 'node:test';import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
import {proposeBatchFromDump} from './propose-figma.js';import {tokenCorpusFromJson} from './token-corpus.js';
import {ContractSchema} from '../scripts/contract-schema.js';import {reactEmitter,reactInlineEmitter} from './emitter.js';import {mountGenerated} from './react-test-runtime.js';
import {settleNestedPropertyInputs} from './nested-property-inputs.js';
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
