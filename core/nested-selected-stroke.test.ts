import test from 'node:test';import assert from 'node:assert/strict';
import {qualifyNestedSelectedStroke} from './nested-selected-stroke.js';
import {selectedStrokeDrawing} from '../extract/figma/rest/selected-stroke.js';
function fixture(){
 const nodeId='Ihost;nested;slot',vector=nodeId+';vector';
 const row:any={nodeId,path:[0],componentId:'glyph',size:{width:16,height:16},parentSize:{width:28,height:28},relativeTransform:[[1,0,6],[0,1,6]],
  selectedRoot:{kind:'selected-slot-root-v1',hostId:'Ihost;nested',hostMainId:'nested-main',property:'Mark#1:2',componentKey:'glyph-key',mainSize:{width:24,height:24},parentId:'Ihost;nested',parentLayout:{mode:'HORIZONTAL',primary:'CENTER',counter:'CENTER',primarySizing:'FIXED',counterSizing:'FIXED'},sizing:{horizontal:'FIXED',vertical:'FIXED',width:16,height:16},fields:['boundVariables'],properties:{},inFlow:true,sizeBound:true,layoutGrow:0},
  strokeDrawing:{nodeId:vector,parentId:nodeId,width:Math.fround(14*2/3),height:Math.fround(14*2/3),relativeTransform:[[1,0,Math.fround(5*2/3)],[0,1,Math.fround(5*2/3)]],edges:[[0,7,7,0],[7,0,14,7],[7,14,7,0]],cap:'ROUND',join:'ROUND',strokeWeight:Math.fround(1.33),color:'#ffffff'}};
 const w:any={ownerId:'host',ownerComponentId:'wrapper-main',ownerComponentKey:'wrapper-key',nodeId:'Ihost;nested',componentId:'nested-main',componentKey:'nested-key',path:[0],layout:{nodeId:'Ihost;nested',componentId:'nested-main',localSize:{width:28,height:28}},properties:{'Mark#1:2':{type:'INSTANCE_SWAP',value:'glyph',selected:{nodeId:'glyph',componentKey:'glyph-key'},observedInstances:[row]}}};
 const usage:any={nodeId:'host',instanceKey:'wrapper-key',instanceGeometry:{componentId:'wrapper-main'},hostOverrides:[{fields:['boundVariables','fills','strokes','strokeWeight'],sourceEmptyFill:true,stroke:{hex:'ffffff'},strokeWeight:Math.fround(1.33),solidStrokeTarget:{nodeId:vector,instanceId:nodeId,componentId:'glyph',instancePath:[0,0],childPath:[0]}}]};
 const owner:any={nodeId:'nested-main',componentKey:'nested-key',bbox:{width:28,height:28},children:[{nodeId:'slot',type:'INSTANCE',propRefs:{mainComponent:'Mark'}}]};
 const main:any={nodeId:'glyph',componentKey:'glyph-key',bbox:{width:24,height:24},children:[{nodeId:'vector'}]};
 const contract:any={props:[],bindings:{figma:{anchors:{nodeId:'glyph',componentSetKey:'glyph-key'}}},anatomy:{root:{overridable:['size','color','stroke-width'],parts:{glyph:{shape:{kind:'stroked-path',width:14,height:14,strokePath:{data:'M14 7L7 0L0 7M7 0V14',cap:'ROUND',join:'ROUND',miterLimit:4,viewport:{width:24,height:24,x:5,y:5}}}}}}}};
 return {usage,w,owner,main,contract,row};
}
const qualify=(f:ReturnType<typeof fixture>)=>qualifyNestedSelectedStroke(f.usage,f.w,'Mark#1:2',f.owner,f.main,f.contract);
test('fixed selected stroke retains size, source ink and non-scaling weight from independent current network',()=>{
 const f=fixture(),before=JSON.stringify(f);assert.deepEqual(qualify(f),{size:16,color:'#ffffff',strokeWidth:Math.fround(1.33)});assert.equal(JSON.stringify(f),before);
 f.row.strokeDrawing.edges.reverse();f.row.strokeDrawing.edges=f.row.strokeDrawing.edges.map((e:number[])=>[...e.slice(2),...e.slice(0,2)]);assert(qualify(f),'edge order and direction are not painted geometry');
});
test('selected stroke rejects stale geometry, transformed paths, wrong ink/weight and mutable ownership',()=>{
 const changes:Array<(f:ReturnType<typeof fixture>)=>void>=[
  f=>{f.row.size.width=17;},f=>{f.row.relativeTransform[0][2]=7;},f=>{f.row.relativeTransform[0][1]=.1;},
  f=>{f.row.strokeDrawing.width+=.001;},f=>{f.row.strokeDrawing.relativeTransform[1][2]+=.001;},f=>{f.row.strokeDrawing.edges[0][0]=1;},
  f=>{f.row.strokeDrawing.color='#000000';},f=>{f.row.strokeDrawing.strokeWeight=2;},f=>{f.row.strokeDrawing.strokeWeight=30;f.usage.hostOverrides[0].strokeWeight=30;},f=>{f.row.strokeDrawing.join='MITER';},f=>{f.row.strokeDrawing.join='BEVEL';},f=>{f.row.strokeDrawing.cap='SQUARE';},f=>{f.row.strokeDrawing.cap='NONE';},
  f=>{f.row.selectedRoot.sizing.horizontal='FILL';},f=>{f.row.selectedRoot.fields.push('rotation');},f=>{f.row.selectedRoot.layoutGrow=1;},
  f=>{f.contract.props=[{name:'show',default:false,type:'boolean'}];f.row.selectedRoot.properties.Show=true;},f=>{f.row.selectedRoot.properties.Unknown=true;},f=>{f.w.ownerComponentKey='wrong';},f=>{f.w.componentKey='wrong';},f=>{f.row.selectedRoot.componentKey='wrong';},
  f=>{f.usage.hostOverrides[0].solidStrokeTarget.instancePath=[0,1];},f=>{f.usage.hostOverrides[0].stroke.alpha=.5;},
  f=>{f.usage.hostOverrides.push(structuredClone(f.usage.hostOverrides[0]));},f=>{f.row.strokeDrawing=undefined;},
 ];
 for(const change of changes){const f=fixture();change(f);assert.equal(qualify(f),undefined,String(change));}
});
test('REST selected stroke capture refuses fill, alpha, curves, extra descendants and unknown network fields',()=>{
 const vector:any={id:'selected;v',type:'VECTOR',size:{x:14,y:14},relativeTransform:[[1,0,5],[0,1,5]],constraints:{horizontal:'SCALE',vertical:'SCALE'},strokeAlign:'CENTER',strokeCap:'ROUND',strokeJoin:'ROUND',strokeWeight:2,fills:[],strokes:[{type:'SOLID',color:{r:1,g:1,b:1,a:1}}],effects:[],complexStrokeProperties:{strokeType:'BASIC'},vectorNetwork:{vertices:[{position:{x:0,y:0}},{position:{x:14,y:14}}],segments:[{start:0,end:1,startTangent:{x:0,y:0},endTangent:{x:0,y:0}}]}};
 const root:any={id:'selected',type:'INSTANCE',size:{x:24,y:24},relativeTransform:[[1,0,0],[0,1,0]],fills:[],strokes:[],effects:[],children:[vector]};assert(selectedStrokeDrawing(root));
 for(const change of [(n:any)=>{n.children.push({type:'FRAME'});},(n:any)=>{n.fills=[{type:'SOLID'}];},(n:any)=>{n.children[0].strokes[0].color.a=.5;},(n:any)=>{n.children[0].vectorNetwork.segments[0].startTangent.x=1;},(n:any)=>{n.children[0].vectorNetwork.extra=true;},(n:any)=>{n.children[0].isMask=true;},(n:any)=>{n.children[0].strokeAlign='INSIDE';},(n:any)=>{n.children[0].strokeJoin='BEVEL';},(n:any)=>{n.children[0].strokeCap='NONE';}]){
  const n=structuredClone(root);change(n);assert.equal(selectedStrokeDrawing(n),undefined,String(change));
 }
});
