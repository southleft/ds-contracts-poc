import vm from 'node:vm';
import {createFigmaEngine} from './emit-figma-script.js';
import {createFigmaMock} from '../scripts/plugin-engine-mock-figma.mjs';
import test from 'node:test';import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
import {proposeBatchFromDump} from './propose-figma.js';import {tokenCorpusFromJson} from './token-corpus.js';
import {ContractSchema} from '../scripts/contract-schema.js';import {reactEmitter,reactInlineEmitter} from './emitter.js';import {mountGenerated} from './react-test-runtime.js';
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
