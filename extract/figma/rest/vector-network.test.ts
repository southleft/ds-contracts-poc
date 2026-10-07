import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {networkPath} from './vector-network.js';
import {mapRestToDump} from './map.js';
const source=JSON.parse(readFileSync(new URL('../fixtures/original-network-rest.json',import.meta.url),'utf8'));
function capture(mutate:(node:any)=>void=()=>{}) {
 const response=structuredClone(source);mutate(response.nodes['1027:7113'].document.children[0]);
 const result=mapRestToDump(response);const shapes:any[]=[];
 const walk=(n:any)=>{if(n?.shape)shapes.push(n.shape);for(const v of Object.values(n??{}))if(v&&typeof v==='object')walk(v);};
 walk(result.dump);return {shapes,result};
}
test('public REST mapping retains original warning centerline with all three subpaths',()=>{
 const r=capture(),s=r.shapes.find(s=>s.kind==='stroked-path');assert.ok(s);
 const n=source.nodes['1027:7113'].document.children[0];
 assert.equal(s.strokePath.data,networkPath(n.vectorNetwork).data);
 assert.equal(s.width,n.size.x);assert.equal((s.strokePath.data.match(/M/g)||[]).length,3);
});
test('unknown decoration, effects, branching, offsets and region paint remain refused',()=>{
 for(const mutate of [
  (n:any)=>n.vectorNetwork.vertices[0].strokeCap='SQUARE',
  (n:any)=>n.vectorNetwork.vertices[0].meta=2,
  (n:any)=>n.vectorNetwork.regions[0].fills=[{type:'SOLID'}],
  (n:any)=>n.vectorNetwork.segments.push({...n.vectorNetwork.segments[0]}),
  (n:any)=>n.effects=[{type:'DROP_SHADOW',visible:true}],
  (n:any)=>n.strokeJoin='MITER',
  (n:any)=>n.complexStrokeProperties={strokeType:'BRUSH'},
  (n:any)=>n.vectorNetwork.vertices.forEach((v:any)=>v.position.x+=0.01),
 ])assert.equal(capture(mutate).shapes.some(s=>s.kind==='stroked-path'),false);
});
test('reverse traversal preserves control points and separate paths',()=>{
 const r=networkPath({vertices:[{position:{x:.125,y:.25}},{position:{x:4.5,y:6.75}}],segments:[{start:1,end:0,startTangent:{x:-.5,y:.25},endTangent:{x:.125,y:-.125}}]});
 assert.equal(r.data,'M0.125 0.25 C0.25 0.125 4 7 4.5 6.75');
});
