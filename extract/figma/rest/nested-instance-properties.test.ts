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
