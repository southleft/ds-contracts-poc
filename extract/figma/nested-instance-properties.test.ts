import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('./dump.plugin.js',import.meta.url),'utf8');
const helper=source.slice(source.indexOf('async function dumpNestedInstanceProperties('),source.indexOf('async function dumpSwapInstances('));
function fixture(){
 const selected={type:'COMPONENT',id:'selected:1',key:'selected-key'};
 const ownerMain={id:'main:1',key:'owner-key'};
 const main={id:'main:2',key:'nested-key',parent:{type:'COMPONENT_SET',key:'set-key'}};
 const root:any={type:'INSTANCE',id:'usage:1',children:[],getMainComponentAsync:async()=>ownerMain};
 const node:any={type:'INSTANCE',id:'usage:2',name:'Duplicate',parent:root,getMainComponentAsync:async()=>main,
  componentProperties:{'Icon#1:2':{type:'INSTANCE_SWAP',value:selected.id},Size:{type:'VARIANT',value:'Medium'},Label:{type:'TEXT',value:'Text'},Shown:{type:'BOOLEAN',value:false}}};
 root.children=[{name:'Duplicate',parent:root},node];
 const figma={getNodeByIdAsync:async(id:string)=>id===selected.id?selected:null};
 const capture=new Function('figma',helper+'return dumpNestedInstanceProperties;')(figma);
 return{root,node,main,ownerMain,selected,capture};
}
test('nested selections retain full property names, values, numeric paths and independent identities',async()=>{
 const f=fixture(),before=JSON.stringify(f.node.componentProperties),r=await f.capture(f.root,f.node);
 assert.deepEqual(r,{ownerId:'usage:1',ownerComponentId:'main:1',ownerComponentKey:'owner-key',nodeId:'usage:2',componentId:'main:2',componentKey:'nested-key',componentSetKey:'set-key',path:[1],properties:{
 'Icon#1:2':{type:'INSTANCE_SWAP',value:'selected:1',selected:{nodeId:'selected:1',componentKey:'selected-key'}},Size:{type:'VARIANT',value:'Medium'},Label:{type:'TEXT',value:'Text'},Shown:{type:'BOOLEAN',value:false}}});
 assert.equal(JSON.stringify(f.node.componentProperties),before);
});
test('unresolved selections, malformed values and unrelated owners cannot produce partial property witnesses',async()=>{
 for(const mode of ['selection','owner','main','parent','type','boolean','self']){
  const f=fixture();
  if(mode==='selection')f.node.componentProperties['Icon#1:2'].value='unavailable';
  if(mode==='owner')f.ownerMain.key='';
  if(mode==='main')f.main.key='';
  if(mode==='parent')f.node.parent=null;
  if(mode==='type')f.node.componentProperties.Size.type='UNKNOWN';
  if(mode==='boolean')f.node.componentProperties.Shown.value='false';
  assert.equal(await f.capture(f.root,mode==='self'?f.root:f.node),undefined,mode);
 }
});
