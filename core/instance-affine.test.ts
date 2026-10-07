import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {chromium} from 'playwright-core';
import {allocateInstanceAffine, type InstanceAffineObservation} from '../packages/schema/src/instance-affine.js';
const cases:InstanceAffineObservation[]=[
 {localSize:{width:40,height:12},transform:[[-1,0,40],[0,-1,12]]},
 {localSize:{width:40,height:12},transform:[[0,-1,12],[1,0,0]]},
 {localSize:{width:40,height:12},transform:[[-1,0,40],[0,1,0]]},
 {localSize:{width:40,height:12},transform:[[Math.SQRT1_2,-Math.SQRT1_2,30],[Math.SQRT1_2,Math.SQRT1_2,20]]},
];
test('actual source instances recover allocation independently of the local transform origin',()=>{
 const rows=JSON.parse(readFileSync(new URL('../extract/figma/fixtures/instance-transform.json',import.meta.url),'utf8')).rows;
 for(const row of rows){const result=allocateInstanceAffine({localSize:{width:row.size.x,height:row.size.y},transform:row.matrix});assert('allocation'in result);
 assert.deepEqual(result.allocation,{localSize:{width:40,height:12},allocation:{left:0,top:0,width:40,height:12},normalizedTransform:[[-1,0,40],[0,-1,12]]});}
});
test('rotation and reflection allocate the painted child bounds and preserve sibling flow in a browser',async()=>{
 const browser=await chromium.launch();try{const page=await browser.newPage();try{
 for(const observation of cases){const result=allocateInstanceAffine(observation);assert('allocation'in result);const {allocation,localSize,normalizedTransform:m}=result.allocation;
 const css=`matrix(${m[0][0]},${m[1][0]},${m[0][1]},${m[1][1]},${m[0][2]},${m[1][2]})`;
 await page.setContent(`<div style="display:flex;gap:7px"><div id="host" style="position:relative;flex:none;width:${allocation.width}px;height:${allocation.height}px"><div id="child" style="position:absolute;left:0;top:0;width:${localSize.width}px;height:${localSize.height}px;transform-origin:0 0;transform:${css};background:#6750a4"></div></div><div id="sibling" style="width:10px;height:10px"></div></div>`);
 const measured=await page.evaluate(()=>{const h=document.querySelector('#host')!.getBoundingClientRect(),c=document.querySelector('#child')!.getBoundingClientRect(),s=document.querySelector('#sibling')!.getBoundingClientRect();return {x:c.x-h.x,y:c.y-h.y,width:c.width,height:c.height,next:s.x-h.x};});
 for(const [key,expected] of Object.entries({x:0,y:0,width:allocation.width,height:allocation.height,next:allocation.width+7}))assert(Math.abs(measured[key as keyof typeof measured]-expected)<.02,`${key}: ${JSON.stringify(measured)}`);
 }
 }finally{await page.close();}}finally{await browser.close();}
});
test('scaling, skew, malformed geometry and missing local size do not become rotation claims',()=>{
 for(const transform of [[[2,0,0],[0,1,0]],[[1,.2,0],[0,1,0]],[[0,0,0],[0,0,0]],[[1,0,Infinity],[0,1,0]]] as InstanceAffineObservation['transform'][])
 assert('issue'in allocateInstanceAffine({transform,localSize:{width:40,height:12}}));
 assert('issue'in allocateInstanceAffine({transform:cases[0].transform,localSize:{width:0,height:12}}));
});
