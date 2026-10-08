import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { collectRestImageAssets, restImagePaints } from './image-assets.js';
import { mapRestToDump, type RestNode } from './map.js';
import type { DumpFile } from '../types.js';
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64');
const hash = createHash('sha1').update(png).digest('hex');
const dump = (): DumpFile => ({ probe: { variants: [{ imagePaints: [{ index: 0, imageHash: hash }] }, { imagePaints: [{ index: 0, imageHash: hash }] }] } } as unknown as DumpFile);
const imageMap = async () => ({ meta: { images: { [hash]: 'https://s3-alpha.figma.com/image' } } });
test('REST reader retains image reference, stack index, transforms and visible paint facts', () => {
 const fills = [{ type: 'SOLID' }, { type: 'IMAGE', visible: false, imageRef: 'hidden' }, { type: 'IMAGE', imageRef: hash, scaleMode: 'CROP', imageTransform: [[.5,0,.1],[0,.5,.2]], opacity: .7, blendMode: 'MULTIPLY', filters: { exposure: .2 } }];
 const paints = restImagePaints(fills)!;assert.equal(paints.length,1);assert.equal(paints[0].index,2);assert.equal(paints[0].imageHash,hash);assert.deepEqual(paints[0].imageTransform,fills[2].imageTransform);assert.equal(paints[0].opacity,.7);
 const node={id:'1:1',name:'Photo',type:'COMPONENT',absoluteBoundingBox:{x:0,y:0,width:24,height:24},fills} as RestNode;
 const mapped=mapRestToDump({nodes:{'1:1':{document:node}}},{fileKey:'test'});
 assert.deepEqual((mapped.dump.Photo as any).variants[0].imagePaints,paints);
 assert.equal((mapped.dump.Photo as any).variants[0].imageFill,true);
});
test('original bytes are deduplicated and authenticated by the source hash', async () => {
 let calls=0;const result=await collectRestImageAssets(dump(),imageMap,async url=>{assert.equal(url,'https://s3-alpha.figma.com/image');calls++;return new Response(png);});
 assert.equal(calls,1);assert.deepEqual(result[hash],{imageHash:hash,mimeType:'image/png',byteLength:png.length,base64:png.toString('base64')});
});
test('no images makes no network request; map and byte failures stay named', async () => {
 const fail=async()=>{throw Error('must not fetch')};assert.deepEqual(Object.keys(await collectRestImageAssets({} as DumpFile,fail,fail)),[]);
 assert.deepEqual((await collectRestImageAssets(dump(),fail,fail))[hash],{imageHash:hash,refused:'rest-image-map-unavailable'});
 assert.equal(((await collectRestImageAssets(dump(),imageMap,async()=>new Response(Buffer.from('wrong'))))[hash] as any).refused,'rest-image-hash-mismatch');
 const missing=await collectRestImageAssets(dump(),async()=>({meta:{images:{}}}),fail);assert.equal((missing[hash] as any).refused,'rest-image-ref-unavailable');
 const untrusted=await collectRestImageAssets(dump(),async()=>({meta:{images:{[hash]:'https://figma.com.evil.invalid/image'}}}),fail);assert.equal((untrusted[hash] as any).refused,'rest-image-origin-unqualified');
});
test('oversized streamed assets are canceled at the native per-asset budget', async () => {
 let canceled=false;const stream=new ReadableStream<Uint8Array>({pull(controller){controller.enqueue(new Uint8Array(8*1024*1024+1));},cancel(){canceled=true;}});
 const assets=await collectRestImageAssets(dump(),imageMap,async()=>new Response(stream));assert.equal(canceled,true);assert.equal((assets[hash] as any).refused,'native-image-byte-budget-unqualified');
});

test('ordinary URL import uses API credentials only on API reads and returns original assets', async () => {
 const { importFromUrl } = await import('./fetch.js');
 const node={id:'1:1',name:'Photo',type:'COMPONENT',absoluteBoundingBox:{x:0,y:0,width:24,height:24},fills:[{type:'IMAGE',imageRef:hash,scaleMode:'FILL'}]};
 let assetReads=0;
 const result=await importFromUrl('https://www.figma.com/design/fixture/Photo?node-id=1-1','test-secret',{
  fetchImpl:async(url,init)=>{
   const u=new URL(url);
   if(u.hostname==='s3-alpha.figma.com'){assert.equal(init?.headers,undefined);assetReads++;return new Response(png);}
   assert.equal(u.hostname,'api.figma.com');assert.equal(init?.headers?.['X-Figma-Token'],'test-secret');
   if(u.pathname.endsWith('/variables/local'))return Response.json({error:'file_variables:read'},{status:403});
   if(u.pathname.endsWith('/nodes'))return Response.json({version:'1',nodes:{'1:1':{document:node}}});
   if(u.pathname.endsWith('/images'))return Response.json(await imageMap());
   throw Error('unexpected-api-path');
  },
 });
 assert.equal(assetReads,1);assert.equal((result.dump._imageAssets?.[hash] as any).base64,png.toString('base64'));
 assert.equal((result.dump.Photo as any).variants[0].imagePaints[0].imageHash,hash);
});

test('multi-megabyte originals retain exact bytes through REST, CSS and native fill projection',async()=>{
 const {PNG}=await import('pngjs');const {randomFillSync}=await import('node:crypto');
 const {projectNativeImagePaints,nativeImageProjection}=await import('../../../core/native-image-paint.js');
 const {nativeImageFill}=await import('../../../core/native-image-fill.js');
 const image=new PNG({width:1024,height:512});randomFillSync(image.data);
 const bytes=PNG.sync.write(image),key=createHash('sha1').update(bytes).digest('hex');assert(bytes.length>1024*1024);
 const set:any={setName:'Photo',variants:[{name:'Default',type:'COMPONENT',imagePaints:[{index:0,imageHash:key,scaleMode:'FILL'}]}]};
 const assets=await collectRestImageAssets({Photo:set} as DumpFile,async()=>({meta:{images:{[key]:'https://s3.amazonaws.com/original.png'}}}),async()=>new Response(new Uint8Array(bytes)));
 assert.equal((assets[key] as any).base64,bytes.toString('base64'));
 const result=projectNativeImagePaints(set,assets),projection=nativeImageProjection(result.set.variants[0])!;
 assert.equal(nativeImageFill(projection.image,projection.declared).base64,bytes.toString('base64'));
 const invalid=structuredClone(assets);(invalid[key] as any).base64=(invalid[key] as any).base64.slice(0,-1)+'!';
 assert.throws(()=>projectNativeImagePaints(set,invalid),/original-asset-integrity/);
});
