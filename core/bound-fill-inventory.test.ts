import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {boundFillInventory} from './bound-fill-inventory.js';

const rows=JSON.parse(readFileSync(new URL('./fixtures/bound-fill-layer-readback/CARBON.json',import.meta.url),'utf8'));
function fixture(row:any){
 const {expected:e,receipt:r}=structuredClone(row),mode={collection:'selected'};
 const host={id:r.host.id,type:r.host.type,name:'host',parentId:'parent',childIds:r.host.childIds,metadata:{},values:{...r.host,...r.host.corners}};
 const layer={id:r.layer.id,type:r.layer.type,name:'[ds-contracts bound paint]',parentId:r.layer.parentId,childIds:[],metadata:{},values:{...r.layer,...r.layer.corners,explicitVariableModes:{},resolvedVariableModes:mode,boundVariables:{fills:[{type:'VARIABLE_ALIAS',id:e.variableId}]}}};
 const spec:any={type:'frame',solidFillComposition:e.paint,solidFillCompositionToken:'paint',children:e.contentIds.map(()=>({type:'frame',name:'child'}))};
 const nodes=new Map([[host.id,host],[layer.id,layer]]),bound={id:e.variableId,color:r.variable.resolved.value};
 return {host,layer,spec,mode,bound,verify:()=>boundFillInventory(spec,host,nodes,e.fileKey,bound,mode)};
}
test('inventory adapter carries all four live Carbon receivers into explicit content mappings',()=>{
 for(const row of rows){const f=fixture(row);assert.deepEqual(f.verify(),{layerId:row.expected.layerId,contentIds:row.expected.contentIds});}
});
test('inventory rejects unverified helper identity, extra bindings, changed modes and hidden content',()=>{
 const mutations:Record<string,(f:ReturnType<typeof fixture>)=>void>={
  name:f=>{f.layer.name='foreground';},
  geometry:f=>{f.layer.values.width-=.25;},
  inheritedMode:f=>{f.layer.values.resolvedVariableModes={collection:'other'};},
  explicitMode:f=>{f.layer.values.explicitVariableModes={collection:'selected'};},
  binding:f=>{f.bound.id='other';},
  extraBinding:f=>{(f.layer.values.boundVariables as any).opacity={type:'VARIABLE_ALIAS',id:'other'};},
  aggregate:f=>{f.layer.values.boundVariables.fills=[];},
  children:f=>{f.layer.childIds.push('hidden' as never);},
  missingContent:f=>{f.host.childIds.pop();},
  tokenValue:f=>{f.bound.color.a=.5;},
 };
 for(const [name,mutate]of Object.entries(mutations)){const f=fixture(rows[0]);mutate(f);assert('refused'in f.verify(),name);}
});
