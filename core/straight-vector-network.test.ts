import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from 'playwright-core';
import {observeStraightVectorNetwork} from '../extract/figma/rest/straight-vector-network.js';
import {readPng,diffPair} from '../extract/figma/visual-parity/img.js';
const source=JSON.parse(fs.readFileSync(new URL('../extract/figma/fixtures/straight-vector-network.json',import.meta.url),'utf8'));

test('explicit straight networks preserve every vertex and match captured ink on both backgrounds',async()=>{
 const browser=await chromium.launch();try{
 const page=await browser.newPage({viewport:{width:512,height:64},deviceScaleFactor:1});
 for(const node of source.nodes){
  const result=observeStraightVectorNetwork(node);assert('observation' in result,JSON.stringify(result));const o=result.observation;
  assert.deepEqual(o.vertexOrder,[2,0,1,3]);assert.equal(o.width,node.size.x);assert.equal(o.height,0);
  assert.deepEqual(o.constraints,node.constraints);assert.deepEqual(o.paint,node.strokes[0]);assert.deepEqual(o.transform,node.relativeTransform);
  const color='#'+['r','g','b'].map(k=>Math.round(node.strokes[0].color[k]*255).toString(16).padStart(2,'0')).join('');
  const markup=(body:string)=>`<style>html,body{margin:0;background:transparent}</style><svg width="512" height="64"><g transform="translate(16 32)">${body}</g></svg>`;
  await page.setContent(markup(node.strokeGeometry.map((p:any)=>`<path d="${p.path}" fill="${color}" fill-rule="${p.windingRule==='NONZERO'?'nonzero':'evenodd'}"/>`).join('')));
  const reference=await page.screenshot({omitBackground:true});
  await page.setContent(markup(`<path d="${o.data}" fill="none" stroke="${color}" stroke-width="${o.strokeWeight}" stroke-linecap="${o.cap==='NONE'?'butt':o.cap.toLowerCase()}"/>`));
  const actual=await page.screenshot({omitBackground:true});
  for(const bg of [0,255]){const a=readPng(actual),b=readPng(reference);for(const p of [a,b])for(let i=0;i<p.data.length;i+=4){const alpha=p.data[i+3]!/255;for(let k=0;k<3;k++)p.data[i+k]=Math.round(p.data[i+k]!*alpha+bg*(1-alpha));p.data[i+3]=255;}
   const pair={a,b,width:512,height:64,aContent:{width:512,height:64},bContent:{width:512,height:64},aOffset:{x:0,y:0},aTrimOrigin:{x:0,y:0}};
   assert.equal(diffPair(pair,[]).diffCount,0,`${node.id}/${bg}`);
  }
 }
 }finally{await browser.close();}
});

test('straight network observation refuses curved, disconnected, overlapping, filled and ambiguous sources',()=>{
 const changes:Array<[string,(n:any)=>void]>=[
  ['curve',n=>n.vectorNetwork.segments[0].startTangent.y=1],
  ['off-axis',n=>n.vectorNetwork.vertices[1].position.y=1],
  ['branch',n=>n.vectorNetwork.segments[2].start=0],
  ['disconnected duplicate',n=>n.vectorNetwork.segments[2]=structuredClone(n.vectorNetwork.segments[1])],
  ['overlap',n=>n.vectorNetwork.vertices[0].position.x=35],
  ['collapsed edge',n=>n.vectorNetwork.vertices[0].position.x=0],
  ['region',n=>n.vectorNetwork.regions=[{}]],
  ['rotated',n=>n.relativeTransform=[[0,-1,0],[1,0,6]]],
  ['nonzero height',n=>n.size.y=1],
  ['zero width',n=>n.size.x=0],
  ['overflowing scale',n=>n.vectorNetwork={vertices:[{position:{x:0,y:0}},{position:{x:Number.MIN_VALUE,y:0}}],segments:[{start:0,end:1,startTangent:{x:0,y:0},endTangent:{x:0,y:0}}]}],
  ['fill',n=>n.fills=[{type:'SOLID'}]],
  ['effect',n=>n.effects=[{type:'DROP_SHADOW'}]],
  ['dash',n=>n.strokeDashes=[2,2]],
  ['opacity',n=>n.opacity=.5],
  ['multiple strokes',n=>n.strokes.push(structuredClone(n.strokes[0]))],
  ['alignment',n=>n.strokeAlign='INSIDE'],
  ['bound weight',n=>n.boundVariables.strokeWeight={type:'VARIABLE_ALIAS',id:'w'}],
  ['override',n=>n.strokeOverrideTable={0:{strokeWeight:9}}],
  ['brush',n=>n.complexStrokeProperties={strokeType:'BRUSH'}],
  ['bad paints',n=>n.strokes=[null]],
  ['bad graph',n=>n.vectorNetwork.regions={}],
 ];
 for(const [label,change]of changes){const n=structuredClone(source.nodes[0]);change(n);assert('issue' in observeStraightVectorNetwork(n),label);}
 for(const value of [null,{},[],false])assert('issue' in observeStraightVectorNetwork(value));
});

test('observations do not mutate or alias captured source facts',()=>{
 const n=structuredClone(source.nodes[0]),before=structuredClone(n),r=observeStraightVectorNetwork(n);assert('observation'in r);r.observation.paint.color={};r.observation.transform[0]![2]=99;r.observation.constraints.horizontal='RIGHT';assert.deepEqual(n,before);
});
