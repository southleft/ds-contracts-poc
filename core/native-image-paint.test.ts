import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {projectNativeImagePaints,nativeImageProjection} from './native-image-paint.js';
import {proposeFromDump} from './propose-figma.js';
import {tokenCorpusFromJson} from './token-corpus.js';
import {ContractSchema} from '../scripts/contract-schema.js';
import type {DumpImageAsset,DumpSet} from '../extract/figma/types.js';
const bytes=readFileSync(new URL('../extract/figma/fixtures/native-group-plane/18x18.png',import.meta.url));
const assets:Record<string,DumpImageAsset>={original:{imageHash:'original',mimeType:'image/png',byteLength:bytes.length,base64:bytes.toString('base64')}};
function fixture(mode='CROP'):DumpSet{return{setName:'CroppedBitmap',type:'COMPONENT',variants:[{name:'CroppedBitmap',type:'FRAME',bbox:{width:18,height:18},imageFill:true,imagePaints:[{index:0,imageHash:'original',scaleMode:mode,imageTransform:[[.5,0,.25],[0,.5,.25]],opacity:1,blendMode:'NORMAL'}]}]};}
test('native original bytes and CROP placement reach the actual proposed contract without rewriting source facts',()=>{
 const set=fixture(),before=JSON.stringify(set),r=proposeFromDump(set,{corpus:tokenCorpusFromJson({primitives:{},semantic:{},light:{},brandDefault:{}}),contractIdByName:new Map(),mintUnbound:true,imageAssets:assets}),c=ContractSchema.parse(r.contract);
 assert.equal(JSON.stringify(set),before);assert.equal(c.anatomy.root.declared?.['background-size'],'200% 200%');assert.equal(c.anatomy.root.declared?.['background-position'],'50% 50%');
 assert(r.mintedTokens?.entries.some(e=>e.value===`url('data:image/png;base64,${bytes.toString('base64')}')`));assert(r.notes.some(n=>n.includes('No rendered-node screenshot')));
});
test('unsupported original asset and affine/paint ownership refuse by name instead of claiming cover',()=>{
 for(const mode of ['CROP','STRETCH'])for(const fault of ['asset','skew','singular','blend','stack','rotation']){
  const set=fixture(mode),paint=set.variants[0].imagePaints![0];let input=assets;
  if(fault==='asset')input={original:{...assets.original,byteLength:1} as DumpImageAsset};
  if(fault==='skew')paint.imageTransform=[[.5,.1,.25],[0,.5,.25]];
  if(fault==='singular')paint.imageTransform=[[1,0,.25],[0,.5,.25]];
  if(fault==='rotation')paint.rotation=90;
  if(fault==='blend')paint.blendMode='MULTIPLY';
  if(fault==='stack')set.variants[0].imagePaints!.push({...paint,index:1});
  assert.throws(()=>projectNativeImagePaints(set,input),/native-image-paint-unqualified/,fault);
 }
 assert.equal(projectNativeImagePaints(fixture(),undefined).notes.length,0,'older captures keep legacy semantics');
 assert(projectNativeImagePaints(fixture(),{original:{imageHash:'original',refused:'native-image-unavailable'}}).notes.some(n=>n.includes('not visual equivalence')));
});
test('both generated React surfaces load original bytes and apply observed CROP through shipped tokens',async t=>{
 const {chromium}=await import('playwright-core'),{PNG}=await import('pngjs'),{mountGenerated}=await import('./react-test-runtime.js'),{emitReact}=await import('./emit-react.js'),{emitReactInline}=await import('./emit-react-inline.js'),{tokenInventoryFromJson}=await import('./tokens.js');
 for(const mode of ['CROP','STRETCH']){
 const r=proposeFromDump(fixture(mode),{corpus:tokenCorpusFromJson({primitives:{},semantic:{},light:{},brandDefault:{}}),contractIdByName:new Map(),mintUnbound:true,imageAssets:assets}),c=ContractSchema.parse(r.contract);
 const tokens={primitives:r.mintedTokens!.tree,semantic:{},light:{},dark:{},brands:{default:{}}},inventory=tokenInventoryFromJson([tokens.primitives]),values=tokenCorpusFromJson({...tokens,brandDefault:{}}),contracts=new Map([[c.id,c]]);
 const browser=await chromium.launch({headless:true});t.after(()=>browser.close());
 for(const surface of ['module','inline']){
  const output=surface==='module'?emitReact(c,{tokens:inventory,tokenValues:tokens,icons:new Map(),contracts}):{...emitReactInline(c,{tokens,icons:new Map(),contracts}),css:''};
  const page=await browser.newPage({viewport:{width:80,height:80}});try{
   const render=await mountGenerated(page,c.name,output.tsx,output.css);await page.addStyleTag({content:'body{margin:0;background:transparent}:root{'+[...inventory].map(path=>'--'+path.replaceAll('.','-')+':'+values.resolveLiteral(path)+';').join('')+'}'});await render({});
   await page.evaluate(async()=>{const node=document.querySelector('body div div')!;const style=getComputedStyle(node);const match=style.backgroundImage.match(/url\(["']?(.*?)["']?\)/);if(!match)throw Error('original image absent');const i=new Image();i.src=match[1];await i.decode();if(i.naturalWidth!==18||style.backgroundSize!=='200% 200%'||style.backgroundPosition!=='50% 50%')throw Error('native crop not applied');});
   const png=PNG.sync.read(await page.screenshot({clip:{x:0,y:0,width:18,height:18},omitBackground:true}));const i=(9*18+9)*4;assert.deepEqual([...png.data.slice(i,i+4)],[255,0,0,255],surface);
  }finally{await page.close();}
 }
 }
});

test('REST STRETCH preserves the affine crop and original observation',()=>{
 const set=fixture('STRETCH');
 set.variants[0].imagePaints![0].imageTransform=[[.8,0,.1],[0,.5,.2]];
 const observed=JSON.stringify(set);
 const projected=projectNativeImagePaints(set,assets);
 assert.equal(JSON.stringify(set),observed);
 const crop=fixture('CROP');crop.variants[0].imagePaints![0].imageTransform=[[.8,0,.1],[0,.5,.2]];
 const comparison=projectNativeImagePaints(crop,assets);
 assert.deepEqual(nativeImageProjection(projected.set.variants[0]),nativeImageProjection(comparison.set.variants[0]));
 assert.equal(projected.set.variants[0].imagePaints![0].scaleMode,'STRETCH');
});
