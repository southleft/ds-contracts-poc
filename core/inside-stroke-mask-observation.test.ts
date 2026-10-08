import assert from 'node:assert/strict';
import test from 'node:test';
import {nativeMaskStrokeMatches} from './native-source-observation.js';
const stroke={align:'INSIDE' as const,weight:5,color:{r:.1,g:.2,b:.3},cap:'NONE' as const,join:'MITER' as const,miterLimit:4};
const observed=()=>({strokes:[{type:'SOLID',color:{...stroke.color},opacity:1,blendMode:'NORMAL'}],strokeAlign:'INSIDE',strokeWeight:5,strokeCap:'NONE',strokeJoin:'MITER',strokeMiterLimit:4,dashPattern:[],boundVariables:{}});
test('independent mask stroke observation accepts exact native values and float32 color storage',()=>{
 assert(nativeMaskStrokeMatches(stroke,observed()));const v=observed();for(const k of ['r','g','b'] as const)v.strokes[0].color[k]=Math.fround(v.strokes[0].color[k]);assert(nativeMaskStrokeMatches(stroke,v));
});
test('stroke readback refuses altered geometry, paint, opacity, bindings and missing fields',()=>{
 const changes:Array<(v:any)=>void>=[v=>v.strokeWeight=4,v=>v.strokeAlign='CENTER',v=>v.strokeCap='ROUND',v=>v.strokeJoin='BEVEL',v=>v.strokeMiterLimit=5,v=>v.dashPattern=[1,2],v=>delete v.dashPattern,v=>v.strokes.push(v.strokes[0]),v=>v.strokes[0].visible=false,v=>v.strokes[0].opacity=.5,v=>v.strokes[0].blendMode='MULTIPLY',v=>v.strokes[0].color.r+=.001,v=>v.strokes[0].boundVariables={color:{type:'VARIABLE_ALIAS',id:'foreign'}},v=>v.boundVariables={strokeWeight:{type:'VARIABLE_ALIAS',id:'foreign'}},v=>delete v.strokeMiterLimit];
 for(const change of changes){const v=observed();change(v);assert.equal(nativeMaskStrokeMatches(stroke,v),false,String(change));}
});

test('draft writer keeps the mask as its original sibling and independently refuses stroke corruption',async()=>{
 const {nativeComparisonFixture}=await import('./native-contract-comparison-test-fixture.js');
 const {revisionOf}=await import('./contract-provenance.js');
 const {emitNativeContractReadbackScript,verifyNativeContractReadback}=await import('./native-source-observation.js');
 const f=await nativeComparisonFixture();
 // State-machine host lacks vectors; model only this fixture's exact triangle bounds.
 // This synthetic host is never live native geometry or image evidence.
 f.figma.createVector=()=>{const n=f.figma.createRectangle();n.type='VECTOR';n.blendMode='PASS_THROUGH';n.relativeTransform=[[1,0,0],[0,1,0]];
  Object.defineProperty(n,'vectorPaths',{configurable:true,get(){return this._fixturePaths;},set(paths){this._fixturePaths=structuredClone(paths);this.resize(18,18);}});return n;};
 const box={box:{x:0,y:0,width:18,height:18,right:0,bottom:0,constraints:{horizontal:'SCALE',vertical:'SCALE'}},parent:{width:18,height:18},border:{left:0,right:0,top:0,bottom:0}};
 const c=f.contract('fixture.inside-stroke-mask',{root:{declared:{position:'relative'},literals:{width:'18px',height:'18px'},parts:{
  aperture:{mask:{type:'ALPHA',stroke},absoluteGeometry:box,shape:{kind:'path',width:18,height:18,paths:[{data:'M0 18L9 0L18 18Z',windingRule:'NONZERO'}]}},
  paint:{shape:{kind:'rect',width:18,height:18},absoluteGeometry:box,tokens:{'background-color':'{surface}'}}
 }}});
 const byId=new Map([[c.id,c]]);
 const compiled=f.engine.compileNativeContractDraft(c,byId,f.source);
 const specs=compiled.component.variants[0].spec.children!;assert.equal(specs[0].nativeMaskPath,true);assert.equal(specs[0].type,'shape');assert.equal(specs.length,2);
 for(const patch of [{gradient:{type:'linear',angle:0,stops:[]}}, {fill:'surface'}, {children:[{type:'frame',name:'foreign'}]}, {capturedAbsoluteGeometry:undefined}]){
  const bad=structuredClone(f.engine.compileComponentData(c,byId));Object.assign(bad.variants[0].spec.children![0],patch);
  const {annotateNativeContractProjection}=await import('./native-contract-draft.js');
  assert.throws(()=>annotateNativeContractProjection(c,bad,structuredClone(compiled.projection)),/NATIVE_MASK_PATH_OWNERSHIP_UNQUALIFIED/);
 }
 const context=await f.context('30000000-0000-4000-8000-000000000001');
 const creation=await f.run(f.engine.buildNativeContractDraftScript(c,byId,f.source,context));assert.equal(creation.status,'created-candidate',JSON.stringify(creation));
 const input={operation:context.operation,planRevision:revisionOf(c),projection:compiled.projection,component:compiled.component,tokenInput:context.tokens.input,tokenIdentity:context.tokens.identity,creation};
 const receipt=await f.run(emitNativeContractReadbackScript(input));
 assert.equal(verifyNativeContractReadback(input,receipt).status,'supported-structure-observed',JSON.stringify(verifyNativeContractReadback(input,receipt)));
 for(const field of ['vectorPaths','strokeWeight','strokeAlign','strokeCap','strokeJoin','strokeMiterLimit','dashPattern','strokes','fills']){
  const changed=structuredClone(receipt),mask=changed.nodes.find((n:any)=>n.name==='aperture');
  mask.values[field]=field==='vectorPaths'?[{data:'M0 18L8 0L18 18Z',windingRule:'NONZERO'}]:field==='fills'?[{type:'SOLID',color:stroke.color}]:field==='strokes'?[]:field==='dashPattern'?[2]:null;
  assert.equal(verifyNativeContractReadback(input,changed).status,'refused',field);
 }
});
