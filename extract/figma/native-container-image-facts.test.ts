import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import {createFigmaMock} from '../../scripts/plugin-engine-mock-figma.mjs';
import {PLUGIN_DUMP_VERSION,type DumpSet} from './types.js';
const source=readFileSync(new URL('./dump.plugin.js',import.meta.url),'utf8');
const start=source.indexOf('// --- NATIVE GROUP AND IMAGE FACTS (start)');
const end=source.indexOf('// --- NATIVE GROUP AND IMAGE FACTS (end)');
const helpers=vm.runInNewContext(`(()=>{${source.slice(start,end)};return{dumpNativeContainerPlane,dumpNativeImagePaints};})()`);
const plain=(value:unknown)=>JSON.parse(JSON.stringify(value));

test('GROUP capture preserves the containing-frame basis and never manufactures group constraints',()=>{
 const frame={id:'frame',type:'COMPONENT',width:18,height:18,absoluteTransform:[[1,0,767],[0,1,2952]]};
 const outer={id:'outer',type:'GROUP',parent:frame};
 const group={id:'group',type:'GROUP',parent:outer,width:20,height:20,relativeTransform:[[1,0,-1],[0,1,-1]],absoluteTransform:[[1,0,766],[0,1,2951]]};
 const child={id:'child',type:'RECTANGLE',parent:group,width:12,height:14,relativeTransform:[[1,0,3],[0,1,2]],absoluteTransform:[[1,0,770],[0,1,2954]],constraints:{horizontal:'SCALE',vertical:'SCALE'}};
 const groupFacts=plain(helpers.dumpNativeContainerPlane(group)),childFacts=plain(helpers.dumpNativeContainerPlane(child));
 assert.equal(groupFacts.parentId,'outer');assert.equal(groupFacts.containerId,'frame');assert.equal(groupFacts.constraints,undefined);
 assert.deepEqual(groupFacts.relativeTransform,[[1,0,-1],[0,1,-1]]);
 assert.deepEqual(childFacts.relativeTransform,[[1,0,3],[0,1,2]]);
 assert.deepEqual(childFacts.containerSize,{width:18,height:18});
 assert.deepEqual(childFacts.constraints,{horizontal:'SCALE',vertical:'SCALE'});
 childFacts.relativeTransform[0][2]=999;assert.equal(child.relativeTransform[0][2],3,'capture does not alias the native transform array');
 const skew={...child,relativeTransform:[[1,.2,3],[0,1,2]]};
 assert.deepEqual(plain(helpers.dumpNativeContainerPlane(skew)).relativeTransform,skew.relativeTransform,'unsupported affine facts remain visible for later refusal');
 assert.equal(helpers.dumpNativeContainerPlane({...child,parent:frame}),undefined,'ordinary frame children keep their previous projection');
 assert.equal(helpers.dumpNativeContainerPlane({...group,parent:{type:'PAGE'}}).issue,'native-container-missing');
});

test('IMAGE capture retains crop transforms and paint-stack indices without assuming cover or exporting bytes',()=>{
 const node={fills:[{type:'SOLID'},{type:'IMAGE',visible:false,imageHash:'hidden'},{type:'IMAGE',imageHash:'crop',scaleMode:'CROP',imageTransform:[[.9,0,.05],[0,.58,.2]],opacity:.7,blendMode:'MULTIPLY',filters:{contrast:.2}},{type:'IMAGE',imageHash:'tile',scaleMode:'TILE',scalingFactor:2,rotation:30}]};
 const before=JSON.stringify(node),paints=plain(helpers.dumpNativeImagePaints(node));
 assert.deepEqual(paints,[{index:2,imageHash:'crop',scaleMode:'CROP',imageTransform:[[.9,0,.05],[0,.58,.2]],opacity:.7,blendMode:'MULTIPLY',filters:{contrast:.2}},{index:3,imageHash:'tile',scaleMode:'TILE',rotation:30,scalingFactor:2}]);
 assert(paints[0]?.imageTransform);paints[0].imageTransform[0]![0]=4;assert.equal(JSON.stringify(node),before);
 assert.equal(helpers.dumpNativeImagePaints({fills:[{type:'SOLID'}]}),undefined);
 assert.equal(helpers.dumpNativeImagePaints({fills:[{type:'IMAGE',scaleMode:'UNKNOWN'}]})[0].scaleMode,'UNKNOWN','unknown native values do not become FILL');
});

test('the actual canonical reader emits GROUP and image facts together and restores its traversal flag',async()=>{
 const {figma:mock}=createFigmaMock();const figma:any=mock;
 const sourceBytes=readFileSync(new URL('./fixtures/native-group-plane/18x18.png',import.meta.url));
 figma.getImageByHash=(hash:string)=>({getBytesAsync:async()=>sourceBytes});
 figma.base64Encode=(bytes:Uint8Array)=>Buffer.from(bytes).toString('base64');
 const component=figma.createComponent();component.name='NativeFactsProbe';component.resize(18,18);figma.currentPage.appendChild(component);
 const group=figma.createFrame();group.type='GROUP';group.name='layers';group.resize(20,20);component.appendChild(group);
 Object.defineProperty(group,'constraints',{value:undefined,configurable:true});
 const bitmap=figma.createRectangle();bitmap.name='bitmap';bitmap.resize(12,14);group.appendChild(bitmap);
 bitmap.fills=[{type:'IMAGE',imageHash:'source-hash',scaleMode:'CROP',imageTransform:[[.9,0,.05],[0,.58,.2]],opacity:1,visible:true}];
 const scoped=source.replace(/^const TARGET_SETS = \[[^\n]*\];$/m,'const TARGET_SETS = ["NativeFactsProbe"];');
 figma.skipInvisibleInstanceChildren=true;
 const dump=plain(await vm.runInNewContext(`(async()=>{${scoped}\n})()`,{figma,console:{log(){},warn(){},error(){}}})) as {_provenance:{dumpVersion:string};NativeFactsProbe:DumpSet};
 assert.equal(dump._provenance.dumpVersion,PLUGIN_DUMP_VERSION);
 const captured=dump.NativeFactsProbe.variants[0].children![0],image=captured.children![0];
 assert.equal(dump.NativeFactsProbe.variants[0].nodeId,component.id);
 assert.equal(captured.nodeId,group.id);assert.equal(image.nodeId,bitmap.id);
 assert.equal(captured.nativeContainerPlane?.containerId,component.id);assert.equal(captured.nativeContainerPlane?.constraints,undefined);
 assert.equal(image.nativeContainerPlane?.parentId,group.id);
 assert.deepEqual(image.imagePaints,[{index:0,imageHash:'source-hash',scaleMode:'CROP',imageTransform:[[.9,0,.05],[0,.58,.2]],opacity:1}]);
 assert.equal(image.imageFill,true,'legacy marker does not silently claim crop is CSS cover');
 const asset=(dump as any)._imageAssets['source-hash'];assert.equal(asset.mimeType,'image/png');assert.deepEqual(Buffer.from(asset.base64,'base64'),sourceBytes);
 assert.equal(figma.skipInvisibleInstanceChildren,true);
});


test('original IMAGE bytes deduplicate by hash without requiring getSizeAsync or rasterizing nodes',async()=>{
 const bytes=readFileSync(new URL('./fixtures/native-group-plane/18x18.png',import.meta.url));let reads=0;
 const figma={getImageByHash(hash:string){assert.equal(hash,'original');return{async getBytesAsync(){reads++;return bytes},async getSizeAsync(){throw Error('must not use dimension lookup')}}},base64Encode(value:Uint8Array){return Buffer.from(value).toString('base64')}};
 const h=vm.runInNewContext(`(()=>{${source.slice(start,end)};return{captureNativeImageAsset,nativeImageAssets};})()`,{figma});
 await Promise.all([h.captureNativeImageAsset('original'),h.captureNativeImageAsset('original')]);
 assert.equal(reads,1);const asset=plain(h.nativeImageAssets.original);
 assert.equal(asset.mimeType,'image/png');assert.equal(asset.byteLength,bytes.length);
 assert.deepEqual(Buffer.from(asset.base64,'base64'),bytes,'original bytes are preserved exactly');
 assert.equal(asset.imageHash,'original');
});

test('missing, oversized and unknown native image assets retain named refusals',async()=>{
 for(const reason of ['missing','budget','format']){
  const figma={getImageByHash(){return reason==='missing'?null:{async getBytesAsync(){return reason==='budget'?new Uint8Array(8*1024*1024+1):new Uint8Array([1,2,3])}}},base64Encode(){throw Error('refusal must not encode')}};
  const h=vm.runInNewContext(`(()=>{${source.slice(start,end)};return{captureNativeImageAsset,nativeImageAssets};})()`,{figma});
  await h.captureNativeImageAsset(reason);
  assert.equal(h.nativeImageAssets[reason].refused,reason==='missing'?'native-image-unavailable':reason==='budget'?'native-image-byte-budget-unqualified':'native-image-format-unqualified');
  assert.equal(h.nativeImageAssets[reason].base64,undefined);
 }
});


test('canonical reader distinguishes explicitly empty fills from absent, mixed, hidden and text paint',async()=>{
 const {figma:mock}=createFigmaMock();const figma:any=mock;
 const component=figma.createComponent();component.name='EmptyFillProbe';figma.currentPage.appendChild(component);
 const fixtures=[['empty',[]],['absent',undefined],['mixed',Symbol('mixed')],['hidden',[{type:'SOLID',visible:false,color:{r:1,g:0,b:0},opacity:1}]]] as const;
 for(const [name,fills] of fixtures){const n=figma.createRectangle();n.name=name;n.fills=fills;component.appendChild(n);}
 const text=figma.createText();text.name='text';text.characters='Example';text.fills=[];component.appendChild(text);
 const scoped=source.replace(/^const TARGET_SETS = \[[^\n]*\];$/m,'const TARGET_SETS = ["EmptyFillProbe"];');
 const dump=plain(await vm.runInNewContext(`(async()=>{${scoped}\n})()`,{figma,console:{log(){},warn(){},error(){}}}));
 const children=dump.EmptyFillProbe.variants[0].children;
 assert.equal(children.find((n:any)=>n.name==='empty').sourceEmptyFill,true);
 for(const name of ['absent','mixed','hidden','text'])assert.equal(children.find((n:any)=>n.name===name).sourceEmptyFill,undefined,name);
 assert.equal(dump._provenance.dumpVersion,PLUGIN_DUMP_VERSION);
});
