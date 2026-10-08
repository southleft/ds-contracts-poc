import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
import {buildNativeStrokeCapture} from './native-stroke-capture.js';
const plugin=fs.readFileSync(new URL('../extract/figma/dump.plugin.js',import.meta.url),'utf8');
test('capture verifies file identity before any node access and refuses missing source nodes',async()=>{
 const code=buildNativeStrokeCapture(plugin,'SourceFile',['12:34']);let reads=0;
 const run=(fileKey:string)=>vm.runInNewContext('(async()=>{'+code+'})()',{figma:{fileKey,getNodeByIdAsync:async()=>{reads++;return null;}}});
 await assert.rejects(run('WrongFile'),/file-mismatch/);assert.equal(reads,0);
 await assert.rejects(run('SourceFile'),/vector-missing/);assert.equal(reads,1);assert(code.length<50000);
});
test('bounded capture rejects ambiguous requests and missing canonical reader',()=>{
 for(const ids of [[],['1:2','1:2'],['1:2; throw Error()'],Array.from({length:129},(_,i)=>`1:${i}`)])assert.throws(()=>buildNativeStrokeCapture(plugin,'SourceFile',ids),/input-invalid/);
 assert.throws(()=>buildNativeStrokeCapture('','SourceFile',['1:2']),/reader-missing/);
});

import {applyNativeStrokeCapture} from './native-stroke-capture.js';
function pair(){
 const localGeometry={nodeId:'1:2',parentId:'1:1',transform:[[1,0,8],[0,1,6]],localSize:{width:7,height:7},parentSize:{width:20,height:20}};
 const dump={_provenance:{fileKey:'SourceFile'},Example:{variants:[{children:[{nodeId:'1:2',type:'VECTOR',localGeometry,strokeWeight:1,strokeAlign:'CENTER',stroke:{hex:'ffffff'}}]}]}};
 const receipt={version:1,kind:'native-stroke-capture',fileKey:'SourceFile',records:[{nodeId:'1:2',parentId:'1:1',localGeometry:{transform:localGeometry.transform,localSize:localGeometry.localSize,parentSize:localGeometry.parentSize},strokeWeight:1,strokeAlign:'CENTER',strokes:[{type:'SOLID',blendMode:'NORMAL',color:{r:1,g:1,b:1}}],issue:null,shape:{kind:'stroked-path',width:7,height:7,strokePath:{data:'M0 7L7 0M4 7L7 4',cap:'NONE',join:'MITER',miterLimit:4,constraints:{horizontal:'MAX',vertical:'MAX'},viewport:{width:20,height:20,x:8,y:6}}}}]};return {dump,receipt};
}
test('native supplement applies atomically with provenance and never changes the source dump',()=>{
 const {dump,receipt}=pair(),before=JSON.stringify(dump);const out=applyNativeStrokeCapture(dump,receipt);
 assert.equal(JSON.stringify(dump),before);assert.deepEqual(out.Example.variants[0].children[0].shape,receipt.records[0].shape);assert.match(out._provenance.nativeStrokeSupplement.receiptSha256,/^[0-9a-f]{64}$/);
 for(const change of [(r:any)=>r.fileKey='Wrong',(r:any)=>r.records.push(r.records[0]),(r:any)=>r.records[0].parentId='1:9',(r:any)=>r.records[0].localGeometry.transform[0][2]++,(r:any)=>r.records[0].strokeWeight=2,(r:any)=>r.records[0].strokes[0].color.r=0,(r:any)=>r.records[0].shape.strokePath.data='M0 0L8 8']){
  const r=structuredClone(receipt);change(r);assert.throws(()=>applyNativeStrokeCapture(dump,r),/native-stroke-supplement-/);assert.equal(JSON.stringify(dump),before);
 }
});
