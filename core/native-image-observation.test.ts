import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {nativeImageOverrideMatches} from './native-image-observation.js';
import type {NativeImageFill} from './native-image-fill.js';
const expected:NativeImageFill={base64:'originalBytes',scaleMode:'CROP',imageTransform:[[.5,0,.125],[0,.25,.5625]]};
const observed={type:'IMAGE',imageHash:'observedHash',scaleMode:'CROP',imageTransform:[[.5,0,.125],[0,.25,.5625]]};
test('independent image observation requires original bytes and unaltered placement',()=>{
 assert(nativeImageOverrideMatches(expected,observed,'originalBytes'));
 for(const bytes of [undefined,'wrongBytes'])assert.equal(nativeImageOverrideMatches(expected,observed,bytes),false);
 for(const change of [{imageHash:''},{type:'SOLID'},{scaleMode:'FIT'},{opacity:.9},{visible:false},{blendMode:'MULTIPLY'},{rotation:90},{scalingFactor:2},{filters:{contrast:.1}},{boundVariables:{opacity:{id:'x'}}},{imageTransform:[[.5,0,.25],[0,.25,.5625]]},{imageTransform:[[NaN,0,.125],[0,.25,.5625]]}])assert.equal(nativeImageOverrideMatches(expected,{...observed,...change},'originalBytes'),false);
 assert(nativeImageOverrideMatches(expected,{...observed,filters:{contrast:0}},'originalBytes'));
});
test('fill and fit refuse hidden crop transforms',()=>{
 for(const scaleMode of ['FILL','FIT'] as const){
  const e={base64:'originalBytes',scaleMode},p={type:'IMAGE',imageHash:'hash',scaleMode};
  assert(nativeImageOverrideMatches(e,p,'originalBytes'));
  assert.equal(nativeImageOverrideMatches(e,{...p,imageTransform:observed.imageTransform},'originalBytes'),false);
 }
});

test('five retained original FILL image records accept only exact identity canonicalization',()=>{
 const fixture=JSON.parse(readFileSync(new URL('../extract/figma/fixtures/native-image-identity-five.json',import.meta.url),'utf8'));
 assert.equal(fixture.cases.length,5);assert.equal(new Set(fixture.cases.map((r:any)=>r.id)).size,5);
 for(const row of fixture.cases){
  assert.equal(fixture.expected.scaleMode,'FILL');assert.deepEqual(row.observed.imageTransform,[[1,0,0],[0,1,0]]);
  assert.equal(nativeImageOverrideMatches(fixture.expected,row.observed,fixture.originalBase64),true,row.id);
  assert.equal(nativeImageOverrideMatches(fixture.expected,row.observed,'wrong independent bytes'),false,row.id);
 }
});

test('FILL and FIT identity canonicalization rejects every changed or malformed matrix entry',()=>{
 const bits=new Uint32Array(1),floats=new Float32Array(bits.buffer);
 const next=(value:number)=>{floats[0]=value;bits[0]++;return floats[0];};
 for(const scaleMode of ['FILL','FIT'] as const){
  const e={base64:'originalBytes',scaleMode},p={type:'IMAGE',imageHash:'observed',scaleMode,imageTransform:[[1,0,0],[0,1,0]]};
  assert(nativeImageOverrideMatches(e,p,'originalBytes'));
  assert(nativeImageOverrideMatches(e,{...p,imageTransform:undefined},'originalBytes'));
  for(let i=0;i<2;i++)for(let j=0;j<3;j++){
   const matrix=structuredClone(p.imageTransform);matrix[i][j]=next(matrix[i][j]);
   assert.equal(nativeImageOverrideMatches(e,{...p,imageTransform:matrix},'originalBytes'),false,`${scaleMode}:${i},${j}`);
  }
  const sparseRow=Array(3),sparseMatrix=Array(2);
  for(const matrix of [null,[],[[1,0,0]],[[1,0,0],[0,1]],[[1,0,0,0],[0,1,0]],sparseMatrix,[sparseRow,[0,1,0]],[[true,0,0],[0,1,0]],[[1,0,0],[0,NaN,0]],[[1,0,0],[0,1,Infinity]],[[1,0,0.01],[0,1,0]],[[1,0.01,0],[0,1,0]],[[2,0,0],[0,1,0]]])
   assert.equal(nativeImageOverrideMatches(e,{...p,imageTransform:matrix},'originalBytes'),false);
 }
});

test('canonical FILL and FIT retain every original-byte and neutral-paint guard',()=>{
 for(const scaleMode of ['FILL','FIT'] as const){
  const e={base64:'originalBytes',scaleMode},p={type:'IMAGE',imageHash:'hash',scaleMode,imageTransform:[[1,0,0],[0,1,0]]};
  for(const change of [{imageHash:''},{type:'SOLID'},{scaleMode:scaleMode==='FILL'?'FIT':'FILL'},{opacity:.9},{visible:false},{blendMode:'MULTIPLY'},{rotation:90},{scalingFactor:2},{filters:{contrast:.1}},{boundVariables:{opacity:{id:'x'}}}])
   assert.equal(nativeImageOverrideMatches(e,{...p,...change},'originalBytes'),false);
  for(const bytes of [undefined,'wrongBytes'])assert.equal(nativeImageOverrideMatches(e,p,bytes),false);
 }
});
