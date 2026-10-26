import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {mapRestToDump,type RestNode} from './map.js';
import {nestedInstanceProperties} from './nested-instance-properties.js';
import type {DumpSet} from '../types.js';
function fixture(){
 const components=new Map([['owner',{key:'owner-key'}],['day-disabled',{key:'disabled-key',componentSetId:'days'}],['selected',{key:'selected-key'}]]);
 const sets=new Map([['days',{key:'days-key'}]]);
 const root:RestNode={id:'usage',name:'Week',type:'INSTANCE',componentId:'owner',children:[{id:'other',name:'Day',type:'FRAME'},
  {id:'Iusage;day',name:'Day',type:'INSTANCE',componentId:'day-disabled',componentProperties:{'Value#1:2':{type:'TEXT',value:'27'},Disabled:{type:'VARIANT',value:'true'},Shown:{type:'BOOLEAN',value:false},Icon:{type:'INSTANCE_SWAP',value:'selected'}}}],overrides:[{id:'Iusage;day',overriddenFields:['componentProperties']}]};
 return {root,components,sets};
}
test('REST captures nested properties with native-reader parity and duplicate-name-safe paths',async()=>{
 const f=fixture(),before=JSON.stringify(f.root),actual=nestedInstanceProperties(f.root,'Iusage;day',f.components,f.sets)!;
 assert.equal(actual.properties['Value#1:2'].value,'27');assert.deepEqual(actual.path,[1]);assert.equal(actual.componentSetKey,'days-key');
 const source=readFileSync(new URL('../dump.plugin.js',import.meta.url),'utf8');
 const helper=source.slice(source.indexOf('async function dumpNestedInstanceProperties('),source.indexOf('async function dumpSwapInstances('));
 const main=(id:string)=>({id,...f.components.get(id),type:'COMPONENT',...(id==='day-disabled'?{parent:{type:'COMPONENT_SET',key:'days-key'}}:{})});
 const pluginRoot:any={...f.root,getMainComponentAsync:async()=>main('owner')};
 pluginRoot.children=f.root.children!.map(n=>({...n,parent:pluginRoot,getMainComponentAsync:async()=>main(n.componentId!)}));
 const capture=new Function('figma',helper+'return dumpNestedInstanceProperties;')({getNodeByIdAsync:async(id:string)=>main(id)});
 assert.deepEqual(actual,await capture(pluginRoot,pluginRoot.children[1]));assert.equal(JSON.stringify(f.root),before);
 const mapped=mapRestToDump({name:'Test',nodes:{source:{document:{id:'source',name:'Source',type:'COMPONENT',children:[f.root]},components:Object.fromEntries([...f.components].map(([k,v])=>[k,{...v,name:k}])),componentSets:{days:{name:'Days',key:'days-key'}}}}});
 const row=(mapped.dump.Source as DumpSet).variants[0].children![0].hostOverrides![0];assert.deepEqual(row.instanceProperties,actual);
});
test('partial identities, ambiguous targets and unsupported values never produce partial nested properties',()=>{
 for(const mode of ['owner','main','set','swap','scalar','boolean','duplicate','missing','self']){
  const f=fixture(),n=f.root.children![1];
  if(mode==='owner')f.components.delete('owner');if(mode==='main')f.components.delete('day-disabled');if(mode==='set')f.sets.clear();if(mode==='swap')f.components.delete('selected');
  if(mode==='scalar')n.componentProperties!.Slot={type:'SLOT',value:{guid:'x'}};
  if(mode==='boolean')n.componentProperties!.Shown.value='false';
  if(mode==='duplicate')f.root.children!.push(structuredClone(n));
  if(mode==='missing')delete n.componentProperties;
  assert.equal(nestedInstanceProperties(f.root,mode==='self'?f.root.id:n.id,f.components,f.sets),undefined,mode);
 }
});

test('complete override indexing retains a selected instance beyond 200 descendants',()=>{
 const f=fixture(),target=f.root.children![1];
 f.root.children=[...Array.from({length:211},(_,i):RestNode=>({id:`filler-${i}`,name:`Filler ${i}`,type:'FRAME'})),target];
 const before=JSON.stringify(f.root);
 const mapped=mapRestToDump({name:'Test',nodes:{source:{document:{id:'source',name:'Source',type:'COMPONENT',children:[f.root]},components:Object.fromEntries([...f.components].map(([k,v])=>[k,{...v,name:k}])),componentSets:{days:{name:'Days',key:'days-key'}}}}});
 const usage=(mapped.dump.Source as DumpSet).variants[0].children![0];
 assert.deepEqual(usage.hostOverrides![0].fields,['componentProperties']);
 assert.deepEqual(usage.hostOverrides![0].instanceProperties,nestedInstanceProperties(f.root,target.id,f.components,f.sets));
 assert.deepEqual(usage.hostOverrides![0].instanceProperties!.path,[211]);
 assert.equal(usage.hostOverrides![0].instanceProperties!.properties.Disabled.value,'true');
 assert(!mapped.report.degradations.some(d=>d.code==='host-override-unlocated'||d.code==='host-override-index-incomplete'));
 assert.equal(JSON.stringify(f.root),before);
});

test('override index admits the exact node bound and refuses the whole prefix beyond either bound',()=>{
 for(const mode of ['exact','nodes','depth'] as const){
  const f=fixture(),target=f.root.children![1];
  f.root.children=[target,...Array.from({length:mode==='exact'?998:mode==='nodes'?999:0},(_,i):RestNode=>({id:`filler-${i}`,name:`Filler ${i}`,type:'FRAME'}))];
  if(mode==='depth'){
   const branch:RestNode={id:'depth-0',name:'Deep',type:'FRAME'};f.root.children.push(branch);
   let leaf=branch;
   for(let i=1;i<33;i++){const child:RestNode={id:`depth-${i}`,name:'Deep',type:'FRAME'};leaf.children=[child];leaf=child;}
  }
  const before=JSON.stringify(f.root);
  const mapped=mapRestToDump({name:'Test',nodes:{source:{document:{id:'source',name:'Source',type:'COMPONENT',children:[f.root]},components:Object.fromEntries([...f.components].map(([k,v])=>[k,{...v,name:k}])),componentSets:{days:{name:'Days',key:'days-key'}}}}});
  const usage=(mapped.dump.Source as DumpSet).variants[0].children![0];
  if(mode==='exact'){
   assert.equal(usage.hostOverrides![0].instanceProperties!.nodeId,target.id);
   assert(!mapped.report.degradations.some(d=>d.code==='host-override-index-incomplete'));
  }else{
   assert.equal(usage.hostOverrides,undefined,`${mode}: early target must not survive a partial index`);
   assert.equal(usage.textOverrides,undefined);
   assert.equal(mapped.report.degradations.filter(d=>d.code==='host-override-index-incomplete').length,1);
  }
  assert.equal(JSON.stringify(f.root),before,mode);
 }
});


test('nested swap capture delegates exact current owner and property without inventing missing geometry',()=>{
 const f=fixture(),target=f.root.children![1],calls:any[]=[];
 const row:any={nodeId:'Iusage;day;icon',path:[0],componentId:'selected',size:{width:16,height:16},parentSize:{width:28,height:28},relativeTransform:[[1,0,6],[0,1,6]]};
 const before=JSON.stringify(f.root),result=nestedInstanceProperties(f.root,target.id,f.components,f.sets,(node,property)=>{calls.push({node,property});return [row];})!;
 assert.equal(calls.length,1);assert.equal(calls[0].node,target);assert.equal(calls[0].property,'Icon');assert.deepEqual(result.properties.Icon.observedInstances,[row]);assert.equal(JSON.stringify(f.root),before);
 assert.deepEqual(nestedInstanceProperties(f.root,target.id,f.components,f.sets,()=>[])!.properties.Icon.observedInstances,[]);
 assert.equal(nestedInstanceProperties(f.root,target.id,f.components,f.sets,()=>undefined)!.properties.Icon.observedInstances,undefined);
});
