import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {nativeFilledPathMatches} from './native-filled-path.js';
import {sourcePathBounds} from '../packages/schema/src/stroked-path.js';

const fixture=JSON.parse(readFileSync(new URL('../extract/figma/fixtures/filled-path-source-bounds-checkbox.json',import.meta.url),'utf8'));
type Row=typeof fixture.cases[number];
const matches=(r:Row)=>nativeFilledPathMatches(r.shape,r.observed.vectorPaths,r.observed.x,r.observed.y,r.observed.width,r.observed.height);
const changed=(r:Row,mutate:(r:Row)=>void)=>{const copy=structuredClone(r);mutate(copy);assert.equal(matches(copy),false,r.id);};
const f32=new Float32Array(1),u32=new Uint32Array(f32.buffer);
function next32(value:number){f32[0]=value;u32[0]+=value>=0?1:-1;return f32[0]!;}
function changeCoordinates(data:string,apply:(value:number,index:number)=>number){
 let i=0;
 return data.replace(/[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g,s=>String(apply(Number(s),i++)));
}

test('source double extrema explain all six retained native paths without using their origin as an oracle',()=>{
 assert.equal(fixture.cases.length,6);
 assert.equal(new Set(fixture.cases.map((r:Row)=>r.id)).size,6);
 for(const r of fixture.cases){
  assert.equal(nativeFilledPathMatches(r.shape,r.observed.vectorPaths,r.observed.x,r.observed.y),false,r.id+' needs independent extents');
  assert.equal(matches(r),true,r.id);
 }
});

test('source-normalized paths reject translated geometry and changed native origins',()=>{
 // Retain the exact failed V1 case as an explicit equivalent legacy rebase.
 const rebased=structuredClone(fixture.cases[0]);
 rebased.observed.x-=1;rebased.observed.y-=2;
 rebased.observed.vectorPaths[0].data=changeCoordinates(rebased.observed.vectorPaths[0].data,(v,i)=>v+(i%2?2:1));
 assert.equal(matches(rebased),true,'243:99469 keeps the same world geometry');
 for(const r of fixture.cases){
  for(const field of ['x','y'])changed(r,c=>{c.observed[field]=next32(c.observed[field]);});
  changed(r,c=>{c.observed.vectorPaths[0].data=changeCoordinates(c.observed.vectorPaths[0].data,(v,i)=>v+(i%2?2:1));});
  changed(r,c=>{c.observed.x+=1;c.observed.y+=2;c.observed.vectorPaths[0].data=changeCoordinates(c.observed.vectorPaths[0].data,(v,i)=>v+(i%2?2:1));});
 }
});

test('source-normalized paths reject scaled geometry even with proportionally changed extents',()=>{
 for(const r of fixture.cases)changed(r,c=>{
  for(const field of ['x','y','width','height'])c.observed[field]*=2;
  c.observed.vectorPaths[0].data=changeCoordinates(c.observed.vectorPaths[0].data,v=>v*2);
 });
});

test('source-normalized paths reject altered source and observed control points',()=>{
 for(const r of fixture.cases){
  changed(r,c=>{c.shape.paths[0].data=changeCoordinates(c.shape.paths[0].data,(v,i)=>i===2?v+0.001:v);});
  changed(r,c=>{c.observed.vectorPaths[0].data=changeCoordinates(c.observed.vectorPaths[0].data,(v,i)=>i===2?v+0.001:v);});
  changed(r,c=>{c.observed.vectorPaths[0].data=changeCoordinates(c.observed.vectorPaths[0].data,(v,i)=>i===0?next32(v):v);});
 }
});

test('source-normalized paths require present finite exact native width and height',()=>{
 for(const r of fixture.cases)for(const field of ['width','height']){
  for(const value of [undefined,NaN,Infinity,0,-1,next32(r.observed[field])])changed(r,c=>{c.observed[field]=value;});
 }
});

test('source-normalized paths retain winding, region count, closure and grammar refusals',()=>{
 for(const r of fixture.cases){
  changed(r,c=>{c.observed.vectorPaths[0].windingRule='NONZERO';});
  changed(r,c=>{c.observed.vectorPaths.push(structuredClone(c.observed.vectorPaths[0]));});
  changed(r,c=>{c.observed.vectorPaths[0].data=c.observed.vectorPaths[0].data.replace(/Z\s*$/,'');});
  for(const data of ['', 'M0 0H2V4Z', 'm0 0l1 1z', 'M0 0CNaN 1 2 3 4 5Z', 'M0 0L1e999 2Z'])changed(r,c=>{c.shape.paths[0].data=data;});
 }
});

test('shared source polynomial bounds preserve exact quadratic and cubic extrema across contours',()=>{
 assert.deepEqual(sourcePathBounds('M0 0C0 -4 4 -4 4 0L0 0Z M10 0L12 0L12 2L10 2Z'),{x:0,y:-3,width:12,height:5});
 assert.deepEqual(sourcePathBounds('M0 0Q2 -4 4 0L0 0Z'),{x:0,y:-2,width:4,height:2});
 const shape={kind:'path' as const,width:12,height:5,paths:[
  {data:'M0 0C0 -4 4 -4 4 0L0 0Z',windingRule:'NONZERO' as const},
  {data:'M10 0L12 0L12 2L10 2Z',windingRule:'EVENODD' as const}
 ]};
 const observed=[{data:'M0 3C0 -1 4 -1 4 3L0 3Z',windingRule:'NONZERO'},{data:'M10 3L12 3L12 5L10 5Z',windingRule:'EVENODD'}];
 assert.equal(nativeFilledPathMatches(shape,observed,0,-3,12,5),true);
 assert.equal(nativeFilledPathMatches(shape,[...observed].reverse(),0,-3,12,5),false);
});
