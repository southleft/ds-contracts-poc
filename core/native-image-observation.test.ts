import test from 'node:test';
import assert from 'node:assert/strict';
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
