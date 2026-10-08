import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {mapStraightVector} from '../extract/figma/rest/straight-vector.js';
import {mapRestToDump,type RestNode} from '../extract/figma/rest/map.js';
import type {DumpNode} from '../extract/figma/types.js';
const source=JSON.parse(readFileSync(new URL('../extract/figma/fixtures/straight-vector-network.json',import.meta.url),'utf8'));
function fixture(){
 const node=structuredClone(source.nodes[0]) as RestNode;
 const parent={id:'owner',name:'FlatSegment',type:'COMPONENT',size:{x:40,y:12},relativeTransform:[[1,0,0],[0,1,0]],absoluteBoundingBox:{x:0,y:0,width:40,height:12},children:[node]} as RestNode;
 const mapped:DumpNode={name:node.name,type:'VECTOR',stroke:{hex:'6750a4',var:'palette.ink'},strokeWeight:4,strokeAlign:'CENTER',cornerRadius:24,abs:{x:0,y:6,right:0,bottom:6,width:40,height:0}};
 return {node,parent,mapped};
}
test('straight vector lowering preserves source paint and explicit placement with canonical neutral join provenance',()=>{
 const {node,parent,mapped}=fixture(),out=mapStraightVector(node,parent,mapped)!;
 assert(out);assert.equal(out.shape?.height,0);assert.equal(out.abs,undefined);assert.equal(out.cornerRadius,undefined);assert.deepEqual(out.stroke,mapped.stroke);
 assert.deepEqual(out.shape?.strokePath?.constraints,{horizontal:'STRETCH',vertical:'STRETCH'});
 assert.deepEqual(out.shape?.strokePath?.viewport,{width:40,height:12,x:0,y:6});
 assert.equal(out.straightVectorSource?.nodeId,node.id);assert.equal(out.straightVectorSource?.canonicalJoin,'MITER');assert.equal(mapped.cornerRadius,24);
});
test('inspection map is opt-in and preserves unresolved paint bindings as named source limitations',()=>{
 const {node,parent}=fixture();node.absoluteBoundingBox={x:0,y:6,width:40,height:0};
 const response={name:'probe',version:source.version,nodes:{owner:{document:parent}}};
 const options={fileKey:'source'};
 const ordinary=mapRestToDump(response as never,options),inspected=mapRestToDump(response as never,{...options,inspectStraightVectorNetworks:true});
 assert(!JSON.stringify(ordinary.dump).includes('straightVectorSource'));assert(JSON.stringify(inspected.dump).includes('straightVectorSource'));
 assert(inspected.report.notes.some(n=>n.includes('generated MITER/4')));
 // A missing variable response is still surfaced; this lowering does not
 // turn a mapped literal into an authenticated variable definition.
 assert(JSON.stringify(inspected.dump).includes('54778:407'));
});
test('straight vector inspection refuses unsupported parent allocation and conflicting mapped paint',()=>{
 for(const change of [(p:any)=>p.layoutMode='HORIZONTAL',(p:any)=>p.paddingLeft=1,(p:any)=>p.relativeTransform[0][0]=-1,(p:any)=>p.size.y=0,(p:any)=>p.strokes=[{type:'SOLID'}]]){
  const {node,parent,mapped}=fixture();change(parent);assert.equal(mapStraightVector(node,parent,mapped),undefined);
 }
 const {node,parent,mapped}=fixture();node.constraints={horizontal:'CENTER',vertical:'TOP'};assert.equal(mapStraightVector(node,parent,mapped),undefined);
 const other=fixture();other.mapped.strokeWeight=8;assert.equal(mapStraightVector(other.node,other.parent,other.mapped),undefined);
});
