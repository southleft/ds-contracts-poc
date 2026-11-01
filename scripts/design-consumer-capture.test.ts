import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, readFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {PNG} from 'pngjs';
import {figmaImagesFromCapture, type PluginCapture} from './design-consumer-capture.js';
import {alignRecordedFrames, imageSha256, type ConsumerFrame, type FigmaFrame} from './design-consumer-framing-v2.js';
import {qualifyRenderBoundsExport} from './design-consumer-render-export.js';

const png=(w:number,h:number,draw:(x:number,y:number)=>number[])=>{const p=new PNG({width:w,height:h});for(let y=0;y<h;y++)for(let x=0;x<w;x++)p.data.set(draw(x,y),(y*w+x)*4);return PNG.sync.write(p);};
const ink=(x:number,y:number)=>x===2&&y===1?[10,80,200,255]:[0,0,0,0];
const layout=png(8,6,ink), outside=png(11,6,(x,y)=>x<3?[200,20,30,128]:ink(x-3,y));
const b64=(bytes:Buffer)=>bytes.toString('base64');
function capture(over:(c:PluginCapture)=>void=()=>{}):PluginCapture {
  const boxA={x:0,y:0,width:8,height:6}, boxB={x:10,y:20,width:8,height:6}, paintB={x:7,y:20,width:11,height:6};
  const c:PluginCapture={kind:'ds-contracts-plugin-capture',version:2,fileKey:'draft',set:'Badge',nodeId:'1:1',variants:[
    {nodeId:'1:2',box:{bounds:boxA,png:b64(layout)},after:{layout:{...boxA},render:{...boxA}}},
    {nodeId:'1:3',box:{bounds:boxB,png:b64(layout)},paint:{bounds:paintB,png:b64(outside)},after:{layout:{...boxB},render:{...paintB}}},
  ]};
  over(c);
  return c;
}
const run=(t:test.TestContext,c:PluginCapture,expected={fileKey:'draft',setNodeId:'1:1'})=>{
  const out=mkdtempSync(path.join(tmpdir(),'capture-check-'));t.after(()=>rmSync(out,{recursive:true,force:true}));
  return figmaImagesFromCapture(c,expected,['1:2','1:3','9:9'],out);
};

test('a capture gives each variant its layout-box image, and a proven painted extent replaces it where paint reaches past the box',t=>{
  const r=run(t,capture());
  assert.equal(r.status,'figma-images-collected');assert.equal(r.framingRefusal,undefined);
  assert.deepEqual(r.frames['1:2']!.raster,{kind:'figma-plugin-layout-box-v1',scale:1});
  assert.equal(r.frames['1:2']!.pngSha256,imageSha256(layout));
  const paired=r.frames['1:3']!.raster as {kind:string;proof:{layoutInRender:{x:number;y:number}}};
  assert.equal(paired.kind,'figma-plugin-paired-render-v1');assert.deepEqual(paired.proof.layoutInRender,{x:3,y:0});
  assert.deepEqual(readFileSync(r.files['1:3']!),outside);
  assert.equal(r.files['9:9'],undefined,'a variant the capture lacks has no image, so the check names it missing');
});

test('a node that moved during the export, another set, another file or an old capture is refused by name',t=>{
  assert.equal(run(t,capture(c=>{c.variants[0]!.after.layout.x=1;})).framingRefusal,'figma-bounds-changed-during-export:1:2');
  assert.equal(run(t,capture(),{fileKey:'draft',setNodeId:'4:4'}).reason,'capture-set-mismatch:1:1');
  assert.equal(run(t,capture(),{fileKey:'other',setNodeId:'1:1'}).reason,'capture-file-mismatch:draft');
  assert.equal(run(t,capture(c=>{c.version=1;})).reason,'capture-kind-unsupported');
});

test('a fractional painted-extent offset stays unqualified, as it does for REST exports',t=>{
  const r=run(t,capture(c=>{c.variants[1]!.paint!.bounds.x=7.5;c.variants[1]!.after.render.x=7.5;}));
  assert.equal(r.frames['1:3']!.refused,'render-export-fractional-origin');
});

test('alignment accepts the plugin kinds with the same proof checks as REST, and nothing else',()=>{
  const read=(name:string)=>readFileSync(new URL('./fixtures/render-export-blockquote/'+name,import.meta.url));
  const snapshots=JSON.parse(read('snapshots.json').toString()), bytes=read('render.png');
  const qualified=qualifyRenderBoundsExport(snapshots.before,snapshots.after,'854:34261',read('layout.png'),bytes);
  assert('proof'in qualified);const proof=qualified.proof;
  const consumer:ConsumerFrame={layout:{x:25,y:10,width:138,height:60},capture:{x:10,y:10,width:153,height:60},deviceScaleFactor:1,pngSha256:imageSha256(bytes),raster:{kind:'browser-paint-extent-v1',paint:{x:10,y:10,width:153,height:60}}};
  const figma:FigmaFrame={layout:proof.layout,render:proof.render,pngSha256:imageSha256(bytes),raster:{kind:'figma-plugin-paired-render-v1',scale:1,proof}};
  assert('aligned'in alignRecordedFrames(bytes,bytes,consumer,figma,255));
  assert.deepEqual(alignRecordedFrames(bytes,bytes,consumer,{...figma,raster:{kind:'figma-plugin-paired-render-v1',scale:1,proof:{...proof,layoutInRender:{x:0,y:0}}}},0),{refused:'figma-render-origin-proof-mismatch'});
  assert.deepEqual(alignRecordedFrames(bytes,bytes,consumer,{...figma,raster:{kind:'figma-plugin-unknown-v1',scale:1}} as unknown as FigmaFrame,0),{refused:'figma-raster-model-unsupported'});
});
