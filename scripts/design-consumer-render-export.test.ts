import test from 'node:test';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {PNG} from 'pngjs';
import {qualifyRenderBoundsExport} from './design-consumer-render-export.js';
const png=(w:number,h:number,draw:(x:number,y:number)=>number[])=>{const p=new PNG({width:w,height:h});for(let y=0;y<h;y++)for(let x=0;x<w;x++)p.data.set(draw(x,y),(y*w+x)*4);return PNG.sync.write(p);};
const frame=(layout:any,render:any)=>({version:'fixed-version',lastModified:'unchanged',nodes:{'1:1':{document:{id:'1:1',absoluteBoundingBox:layout,absoluteRenderBounds:render}}}});
const ink=(x:number,y:number)=>x===2&&y===1?[10,80,200,255]:[0,0,0,0];
const layout=png(8,6,ink),outside=png(11,6,(x,y)=>x<3?[200,20,30,128]:ink(x-3,y));
const snapshot=frame({x:10.5,y:20.5,width:8,height:6},{x:7.5,y:20.5,width:11,height:6});
test('outside paint keeps a source-derived origin and the complete raster',()=>{
 const result=qualifyRenderBoundsExport(snapshot,snapshot,'1:1',layout,outside);
 assert('proof'in result);assert.deepEqual(result.proof.layoutInRender,{x:3,y:0});assert.equal(result.proof.overlapPixels,48);assert.equal(result.proof.paintedOverlapPixels,1);
});
test('transparent layout margins can surround the render bounds',()=>{
 const s=frame({x:0,y:0,width:8,height:6},{x:1,y:1,width:4,height:3});
 const rendered=png(4,3,(x,y)=>ink(x+1,y+1));
 const result=qualifyRenderBoundsExport(s,s,'1:1',layout,rendered);assert('proof'in result);assert.deepEqual(result.proof.layoutInRender,{x:-1,y:-1});
});
test('wrong origin, missing ink, wrong cell and truncated exports are refused',()=>{
 const shifted=png(11,6,(x,y)=>x<3?[200,20,30,128]:ink(x-4,y));
 const missing=png(11,6,(x)=>x<3?[200,20,30,128]:[0,0,0,0]);
 const wrong=png(11,6,()=>[0,255,0,255]);
 for(const image of [shifted,missing,wrong])assert.deepEqual(qualifyRenderBoundsExport(snapshot,snapshot,'1:1',layout,image),{refused:'render-export-overlap-mismatch'});
 assert.deepEqual(qualifyRenderBoundsExport(snapshot,snapshot,'1:1',layout,png(10,6,ink)),{refused:'render-export-span-mismatch'});
 assert.deepEqual(qualifyRenderBoundsExport(snapshot,snapshot,'1:1',png(7,6,ink),outside),{refused:'layout-export-span-mismatch'});
});
test('unobservable origins, changed source and fractional translations stay unqualified',()=>{
 const s=frame({x:0,y:0,width:8,height:6},{x:0,y:0,width:8,height:6});
 for(const color of [[0,0,0,0],[20,30,40,255]]){const p=png(8,6,()=>color);assert.deepEqual(qualifyRenderBoundsExport(s,s,'1:1',p,p),{refused:'render-export-origin-unobservable'});}
 assert('refused'in qualifyRenderBoundsExport(snapshot,{...snapshot,version:'changed'},'1:1',layout,outside));
 const fractional=structuredClone(snapshot);fractional.nodes['1:1'].document.absoluteRenderBounds.x+=0.5;
 assert.deepEqual(qualifyRenderBoundsExport(fractional,fractional,'1:1',layout,outside),{refused:'render-export-fractional-origin'});
 const changed=structuredClone(snapshot);Object.assign(changed.nodes['1:1'].document,{clipsContent:true});
 assert('refused'in qualifyRenderBoundsExport(snapshot,changed,'1:1',layout,outside));
});

test('recorded real Blockquote exports preserve the independently observed 15px outside stroke',()=>{
 const read=(name:string)=>readFileSync(new URL('./fixtures/render-export-blockquote/'+name,import.meta.url));
 const snapshots=JSON.parse(read('snapshots.json').toString());
 const result=qualifyRenderBoundsExport(snapshots.before,snapshots.after,'854:34261',read('layout.png'),read('render.png'));
 assert('proof'in result);assert.deepEqual(result.proof.layoutInRender,{x:15,y:0});assert.equal(result.proof.overlapPixels,8280);
 const render=PNG.sync.read(read('render.png'));let count=0;for(let y=0;y<60;y++)for(let x=0;x<15;x++){
  assert.deepEqual([...render.data.subarray((y*render.width+x)*4,(y*render.width+x)*4+4)],[0,62,255,62]);count++;
 }assert.equal(count,900);
 const node=snapshots.before.nodes['854:34261'].document;
 assert.equal(node.strokeAlign,'OUTSIDE');assert.equal(node.individualStrokeWeights.left,15);
});

import {alignRecordedFrames,imageSha256,type ConsumerFrame,type FigmaFrame} from './design-consumer-framing-v2.js';
test('paired render origin aligns complete outside paint and refuses incomplete evidence',()=>{
 const read=(name:string)=>readFileSync(new URL('./fixtures/render-export-blockquote/'+name,import.meta.url));
 const snapshots=JSON.parse(read('snapshots.json').toString()), bytes=read('render.png');
 const qualified=qualifyRenderBoundsExport(snapshots.before,snapshots.after,'854:34261',read('layout.png'),bytes);
 assert('proof'in qualified);const proof=qualified.proof;
 const consumer:ConsumerFrame={layout:{x:25,y:10,width:138,height:60},capture:{x:10,y:10,width:153,height:60},deviceScaleFactor:1,pngSha256:imageSha256(bytes),raster:{kind:'browser-paint-extent-v1',paint:{x:10,y:10,width:153,height:60}}};
 const figma:FigmaFrame={layout:proof.layout,render:proof.render,pngSha256:imageSha256(bytes),raster:{kind:'figma-rest-paired-render-v1',scale:1,proof}};
 for(const background of [0,255] as const){const pair=alignRecordedFrames(bytes,bytes,consumer,figma,background);assert('aligned'in pair);assert.deepEqual(pair.aligned.a.data,pair.aligned.b.data);}
 const wrong={...proof,layoutInRender:{x:0,y:0}};
 assert.deepEqual(alignRecordedFrames(bytes,bytes,consumer,{...figma,raster:{kind:'figma-rest-paired-render-v1',scale:1,proof:wrong}},0),{refused:'figma-render-origin-proof-mismatch'});
 assert.deepEqual(alignRecordedFrames(bytes,bytes,{...consumer,capture:{...consumer.capture,width:152}},figma,0),{refused:'consumer-capture-span-mismatch'});
 const oldConsumer={layout:{x:10,y:10,width:138,height:60},capture:{x:10,y:10,width:138,height:60},deviceScaleFactor:1,pngSha256:imageSha256(read('layout.png'))};
 assert.deepEqual(alignRecordedFrames(read('layout.png'),bytes,oldConsumer,figma,0),{refused:'render-outside-layout-capture-unqualified'});
 assert.deepEqual(alignRecordedFrames(bytes,bytes,consumer,{...figma,refused:'source-changed'},0),{refused:'source-changed'});
 const missing=PNG.sync.read(bytes);for(let y=0;y<60;y++)for(let x=0;x<15;x++)missing.data.fill(0,(y*153+x)*4,(y*153+x)*4+4);
 const missingBytes=PNG.sync.write(missing), pair=alignRecordedFrames(missingBytes,bytes,{...consumer,pngSha256:imageSha256(missingBytes)},figma,255);
 assert('aligned'in pair);assert.notDeepEqual(pair.aligned.a.data,pair.aligned.b.data);
});


test('full subtree bounds qualify overflowing Slider thumbs that shallow bounds truncate at the same version',()=>{
 const read=(name:string)=>readFileSync(new URL('./fixtures/render-export-slider/'+name,import.meta.url));
 const s=JSON.parse(read('snapshots.json').toString());
 assert.equal(s.before.version,s.shallow.version);
 assert.deepEqual(qualifyRenderBoundsExport(s.shallow,s.shallow,'884:120261',read('layout.png'),read('render.png')),{refused:'render-export-span-mismatch'});
 const result=qualifyRenderBoundsExport(s.before,s.after,'884:120261',read('layout.png'),read('render.png'));
 assert('proof'in result);assert.deepEqual(result.proof.layoutInRender,{x:0,y:3});
 assert.equal(result.proof.layout.height,6);assert.equal(result.proof.render.height,12);
 assert.equal(result.proof.overlapPixels,1800);
});
