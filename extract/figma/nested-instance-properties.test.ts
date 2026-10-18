import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {nestedInstanceProperties} from './rest/nested-instance-properties.js';
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

function layoutFixture(){
 const f=fixture();
 Object.assign(f.root,{width:300,height:72,layoutMode:'VERTICAL'});
 Object.assign(f.node,{width:300,height:36,relativeTransform:[[1,0,0],[0,1,30]],layoutSizingHorizontal:'FILL',layoutSizingVertical:'HUG',layoutPositioning:'AUTO',boundVariables:{},minWidth:0,minHeight:0,maxWidth:null,maxHeight:null});
 const restParent:any={id:f.root.id,type:'INSTANCE',componentId:'main:1',size:{x:f.root.width,y:f.root.height},layoutMode:f.root.layoutMode,children:[]};
 const restNode:any={id:f.node.id,type:'INSTANCE',componentId:'main:2',size:{x:f.node.width,y:f.node.height},relativeTransform:structuredClone(f.node.relativeTransform),layoutSizingHorizontal:f.node.layoutSizingHorizontal,layoutSizingVertical:f.node.layoutSizingVertical,layoutPositioning:f.node.layoutPositioning,boundVariables:{},minWidth:0,minHeight:0,maxWidth:null,maxHeight:null,componentProperties:structuredClone(f.node.componentProperties)};
 restParent.children=[{id:'sibling',name:'Duplicate',type:'FRAME'},restNode];
 const components=new Map([['main:1',{key:'owner-key'}],['main:2',{key:'nested-key',componentSetId:'set'}],['selected:1',{key:'selected-key'}]]),sets=new Map([['set',{key:'set-key'}]]);
 return {...f,restParent,restNode,components,sets};
}
test('optional nested layout preserves actual HUG occurrence geometry with exact REST/native parity',async()=>{
 const f=layoutFixture(),before=JSON.stringify(f.restParent),native=await f.capture(f.root,f.node),rest=nestedInstanceProperties(f.restParent,f.restNode.id,f.components,f.sets)!;
 assert.deepEqual(rest,native);assert.equal(JSON.stringify(f.restParent),before);
 assert.deepEqual(rest.layout,{kind:'nested-instance-layout-v1',nodeId:'usage:2',componentId:'main:2',parentId:'usage:1',localSize:{width:300,height:36},parentSize:{width:300,height:72},relativeTransform:[[1,0,0],[0,1,30]],sizing:{horizontal:'FILL',vertical:'HUG'},inFlow:true,sizeBound:false});
 assert(!Object.hasOwn(rest.layout!.sizing,'width'));assert(!Object.hasOwn(rest.layout!.sizing,'height'));
 for(const mode of ['FIXED','FILL','HUG']){
  f.node.layoutSizingHorizontal=mode;f.restNode.layoutSizingHorizontal=mode;
  f.node.layoutSizingVertical=mode;f.restNode.layoutSizingVertical=mode;
  const actual=nestedInstanceProperties(f.restParent,f.restNode.id,f.components,f.sets)!;
  assert.deepEqual(actual,await f.capture(f.root,f.node));
  assert.equal(Object.hasOwn(actual.layout!.sizing,'width'),mode==='FIXED');assert.equal(Object.hasOwn(actual.layout!.sizing,'height'),mode==='FIXED');
 }
 f.node.layoutPositioning='ABSOLUTE';f.restNode.layoutPositioning='ABSOLUTE';
 assert.equal(nestedInstanceProperties(f.restParent,f.restNode.id,f.components,f.sets)!.layout!.inFlow,false);
 assert.deepEqual(nestedInstanceProperties(f.restParent,f.restNode.id,f.components,f.sets),await f.capture(f.root,f.node));
});
test('unqualified optional layout is omitted without losing nested typed properties',async()=>{
 const changes:Array<(f:ReturnType<typeof layoutFixture>)=>void>=[
  f=>{delete f.restNode.size;delete f.node.width;},
  f=>{f.restNode.size.y=0;f.node.height=0;},
  f=>{f.restParent.size.y=NaN;f.root.height=NaN;},
  f=>{delete f.restParent.layoutMode;delete f.root.layoutMode;},
  f=>{f.restParent.layoutMode='NONE';f.root.layoutMode='NONE';},
  f=>{f.restNode.relativeTransform=[[1,0],[0,1,30]];f.node.relativeTransform=[[1,0],[0,1,30]];},
  f=>{delete f.restNode.relativeTransform[0][1];delete f.node.relativeTransform[0][1];},
  f=>{f.restNode.layoutSizingVertical='UNKNOWN';f.node.layoutSizingVertical='UNKNOWN';},
  f=>{f.restNode.layoutPositioning='UNKNOWN';f.node.layoutPositioning='UNKNOWN';},
  f=>{f.restNode.minHeight=-1;f.node.minHeight=-1;},
  f=>{f.restNode.boundVariables=[];f.node.boundVariables=[];},
 ];
 for(const change of changes){
  const f=layoutFixture(),expected=nestedInstanceProperties(f.restParent,f.restNode.id,f.components,f.sets)!;delete expected.layout;change(f);
  assert.deepEqual(nestedInstanceProperties(f.restParent,f.restNode.id,f.components,f.sets),expected,String(change));assert.deepEqual(await f.capture(f.root,f.node),expected,String(change));
 }
});
test('nested layout names size bindings, non-default bounds and aspect locks without changing property evidence',async()=>{
 for(const extra of [{boundVariables:{size:{type:'VARIABLE_ALIAS',id:'size'}}},{boundVariables:{height:{type:'VARIABLE_ALIAS',id:'height'}}},{boundVariables:{minHeight:{type:'VARIABLE_ALIAS',id:'floor'}}},{minWidth:1},{minHeight:1},{maxWidth:0},{maxHeight:36},{targetAspectRatio:{x:1,y:1}}]){
  const f=layoutFixture();Object.assign(f.restNode,extra);Object.assign(f.node,extra);
  const actual=nestedInstanceProperties(f.restParent,f.restNode.id,f.components,f.sets)!;
  assert.equal(actual.layout!.sizeBound,true,JSON.stringify(extra));assert.deepEqual(actual,await f.capture(f.root,f.node));
 }
});
