import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {nativeComparisonFixture} from './native-contract-comparison-test-fixture.js';
import {revisionOf} from './contract-provenance.js';
import {emitNativeContractReadbackScript,verifyNativeContractReadback} from './native-source-observation.js';
import {lowerNativeFilledPath} from './native-filled-path.js';
test('native painted mask retains outer sibling ownership and independently observes both editable paths',async()=>{
 const f=await nativeComparisonFixture();
 // Synthetic host records exact paths; this test makes no pixel or live-native claim.
 f.figma.createVector=()=>{const n=f.figma.createRectangle();n.type='VECTOR';n.isMask=false;n.blendMode='PASS_THROUGH';n.relativeTransform=[[1,0,0],[0,1,0]];
  Object.defineProperty(n,'vectorPaths',{configurable:true,get(){return this._fixturePaths;},set(paths){this._fixturePaths=structuredClone(paths);this.resize(18,18);}});return n;};
 const source=JSON.parse(readFileSync(new URL('../extract/figma/rest/painted-stroke-mask.fixture.json',import.meta.url),'utf8'));
 const paths=(key:string)=>source[key].map((p:any)=>({data:p.path,windingRule:p.windingRule}));
 const box={box:{x:0,y:0,width:18,height:18,right:0,bottom:0,constraints:{horizontal:'SCALE',vertical:'SCALE'}},parent:{width:18,height:18},border:{left:0,right:0,top:0,bottom:0}};
 const c=f.contract('fixture.painted-mask',{root:{declared:{position:'relative'},literals:{width:'18px',height:'18px'},parts:{
  aperture:{mask:{type:'ALPHA',paintedStroke:{paths:paths('strokeGeometry'),color:{r:source.strokes[0].color.r,g:source.strokes[0].color.g,b:source.strokes[0].color.b}}},absoluteGeometry:box,shape:{kind:'path',width:18,height:18,paths:paths('fillGeometry')}},
  paint:{shape:{kind:'rect',width:18,height:18},absoluteGeometry:box,tokens:{'background-color':'{surface}'}}
 }}});
 const byId=new Map([[c.id,c]]),compiled=f.engine.compileNativeContractDraft(c,byId,f.source),spec=compiled.component.variants[0].spec.children![0];
 assert.equal(spec.type,'frame');assert.equal(spec.nativePaintedStrokeMask,true);assert.equal(spec.children!.length,2);assert.equal(spec.children![0].mask!.type,'VECTOR');assert.equal(spec.children![1].mask,undefined);
 const context=await f.context('30000000-0000-4000-8000-000000000002');
 const creation=await f.run(f.engine.buildNativeContractDraftScript(c,byId,f.source,context));assert.equal(creation.status,'created-candidate',JSON.stringify(creation));
 const input={operation:context.operation,planRevision:revisionOf(c),projection:compiled.projection,component:compiled.component,tokenInput:context.tokens.input,tokenIdentity:context.tokens.identity,creation};
 const receipt=await f.run(emitNativeContractReadbackScript(input));assert.equal(verifyNativeContractReadback(input,receipt).status,'supported-structure-observed',JSON.stringify({result:verifyNativeContractReadback(input,receipt),paths:receipt.nodes.filter((n:any)=>['Interior clip','Painted stroke ink'].includes(n.name))}));
 const outer=receipt.nodes.find((n:any)=>n.name==='aperture'),clip=receipt.nodes.find((n:any)=>n.name==='Interior clip'),ink=receipt.nodes.find((n:any)=>n.name==='Painted stroke ink');assert.equal(outer.values.isMask,true);assert.equal(outer.values.maskType,'ALPHA');assert.equal(clip.parentId,outer.id);assert.equal(ink.parentId,outer.id);
 for(const corruption of ['clip-path','ink-path','clip-mask','clip-order','outer-mask','ink-fill']){
  const changed=structuredClone(receipt),o=changed.nodes.find((n:any)=>n.id===outer.id),a=changed.nodes.find((n:any)=>n.id===clip.id),b=changed.nodes.find((n:any)=>n.id===ink.id);
  if(corruption==='clip-path')a.values.vectorPaths=[];
  if(corruption==='ink-path')b.values.vectorPaths=[];
  if(corruption==='clip-mask')a.values.isMask=false;
  if(corruption==='clip-order')o.childIds.reverse();
  if(corruption==='outer-mask')o.values.isMask=false;
  if(corruption==='ink-fill')b.values.fills=[];
  assert.equal(verifyNativeContractReadback(input,changed).status,'refused',corruption);
 }
 const bad=structuredClone(f.engine.compileComponentData(c,byId)).variants[0].spec.children![0];bad.bindings={width:'foreign'};assert.throws(()=>lowerNativeFilledPath(bad),/NATIVE_PAINTED_MASK_OWNERSHIP_UNQUALIFIED/);
});
