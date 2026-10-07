import test from 'node:test';
import assert from 'node:assert/strict';
import {sourceImageInput,selectSourceImage} from './source-image-input.js';
import type {SourceImageDemand} from './source-image-control.js';
const bytes='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a3ioAAAAASUVORK5CYII=';
const demand=():SourceImageDemand=>({fileKey:'file',setKey:'set',componentId:'main',instanceId:'instance',sourceNodeId:'leaf',instanceNodeId:'Iinstance;leaf',childPath:[0],imageHash:'hash',image:`url('data:image/png;base64,${bytes}')`,declared:{'background-repeat':'no-repeat','background-size':'cover','background-position':'50% 50%'}});
test('finite image input retains default omission and distinct crops of the same original',()=>{
 const a=demand(),b={...demand(),instanceId:'second',instanceNodeId:'Isecond;leaf',declared:{...a.declared,'background-size':'200% 200%','background-position':'25% 50%'}};
 const input=sourceImageInput([b,a,a]);assert.equal(input.choices.length,2);assert.equal(input.callers.length,2);
 assert.deepEqual(sourceImageInput([a,b]),input);
 assert.equal(selectSourceImage(input,undefined),undefined);
 for(const caller of input.callers){const choice=selectSourceImage(input,caller.value)!;assert.equal(choice.native.base64,bytes);assert.equal(choice.native.scaleMode,caller.instanceId==='instance'?'FILL':'CROP');}
 const selected=selectSourceImage(input,input.choices[0].value)!;selected.declared['background-size']='broken';assert.notEqual(input.choices[0].declared['background-size'],'broken');
});
test('finite image input rejects foreign owners, conflicting callers and arbitrary URLs',()=>{
 const d=demand(),input=sourceImageInput([d]);
 assert.throws(()=>sourceImageInput([d,{...d,sourceNodeId:'other'}]),/mixed-source-owner/);
 assert.throws(()=>sourceImageInput([d,{...d,declared:{...d.declared,'background-size':'contain'}}]),/conflicting-caller/);
 for(const value of ['https://example.com/image.png','image99',null,{}])assert.throws(()=>selectSourceImage(input,value),/value-unqualified/);
 assert.throws(()=>sourceImageInput([]),/image-input-empty/);
});
