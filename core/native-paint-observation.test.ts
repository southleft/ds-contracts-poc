import test from 'node:test';
import assert from 'node:assert/strict';
import {nativeComparisonFixture} from './native-contract-comparison-test-fixture.js';
import {emitNativeContractReadbackScript,verifyNativeContractReadback,type NativeContractObservationInput} from './native-source-observation.js';
import {revisionOf} from './contract-provenance.js';
import {nativePaintSpecSupported,nativePaintStackMatches,nativeBoundPaintColor} from './native-paint-observation.js';
import type {NodeSpec} from './emit-figma-script.js';

const gradient='linear-gradient(to right, rgba(20, 100, 180, 0.6) 0%, rgba(0, 0, 0, 0) 100%)';
for (const kind of ['shape','frame','root'] as const) {
  test(`${kind}: actual native script retains the base, gradient and shadow; readback rejects altered layers`,async()=>{
    const f=await nativeComparisonFixture();
    const part={...(kind === 'shape' ? {shape:{kind:'rect',width:35,height:20}} : {layout:{display:'flex',direction:'row'}}),
      literals:{width:'35px',height:'20px','background-color':'rgba(18, 52, 86, 0.5)',
        'background-image':gradient,'box-shadow':'0px 1px 2px 0px #00000080'}};
    const c=f.contract(`fixture.${kind}-paint`,{root:kind === 'root' ? part : {layout:{display:'flex',direction:'row'},parts:{track:part}}});
    const byId=new Map([[c.id,c]]), compiled=f.engine.compileNativeContractDraft(c,byId,f.source);
    const rootSpec=compiled.component.variants[0].spec, spec=kind === 'root' ? rootSpec : rootSpec.children![0];
    assert.equal(spec.gradient?.stops.length,2);
    const script=f.engine.buildNativeContractDraftScript(c,byId,f.source,f.supplemental);
    const creation=await f.run(script);
    assert.equal(creation.status,'created-candidate',JSON.stringify(creation));
    const input:NativeContractObservationInput={operation:f.supplemental.operation,planRevision:revisionOf(kind),
      projection:compiled.projection,component:compiled.component,tokenInput:f.supplemental.tokens.input,
      tokenIdentity:f.supplemental.tokens.identity,creation};
    const receipt=await f.run(emitNativeContractReadbackScript(input));
    const verdict=verifyNativeContractReadback(input,receipt);
    assert.equal(verdict.status,'supported-structure-observed',JSON.stringify(verdict));
    const index=receipt.nodes.findIndex((n:any)=>n.values.fills?.some((p:any)=>p.type === 'GRADIENT_LINEAR'));
    assert(index >= 0);
    const v=receipt.nodes[index].values;
    assert.deepEqual(v.fills.map((p:any)=>p.type),['SOLID','GRADIENT_LINEAR']);
    assert.equal(v.fills[0].opacity,0.5);
    assert.equal(v.effects.length,1);
    const corruptions:Array<(v:any)=>void>=[
      v=>v.fills.pop(),v=>v.fills.shift(),v=>v.fills.reverse(),v=>v.fills.push(v.fills[1]),
      v=>{v.fills[0].color.r=0;},v=>{v.fills[0].opacity=1;},
      v=>{v.fills[0].visible=false;},v=>{v.fills[0].blendMode='MULTIPLY';},
      v=>{v.fills[0].boundVariables={color:{type:'VARIABLE_ALIAS',id:'unowned'}};},
      v=>{v.fills[1].type='GRADIENT_RADIAL';},v=>{v.fills[1].opacity=0.5;},
      v=>{v.fills[1].visible=false;},v=>{v.fills[1].blendMode='SCREEN';},
      v=>{v.fills[1].opacity=null;},v=>{v.fills[1].blendMode=null;},
      v=>{v.fills[1].gradientTransform[0][2]+=0.001;},
      v=>{v.fills[1].gradientStops.reverse();},v=>{v.fills[1].gradientStops[0].position=0.01;},
      v=>{v.fills[1].gradientStops[0].color.a=1;},v=>{v.fills[1].gradientStops[0].color.g=0;},
      v=>{v.fills[1].gradientStops[0].boundVariables={color:{type:'VARIABLE_ALIAS',id:'unowned'}};},
      v=>{v.boundVariables.fills=[{type:'VARIABLE_ALIAS',id:'unowned'}];},
      v=>{v.effects[0].radius=3;},v=>{v.effects=[];},
    ];
    for (const [i,corrupt] of corruptions.entries()) {
      const bad=structuredClone(receipt);corrupt(bad.nodes[index].values);
      assert.equal(verifyNativeContractReadback(input,bad).status,'refused',`tamper ${i}`);
    }
    const ids=f.figma.root.findAll(()=>true).map((n:any)=>n.id);
    const repeat=await f.run(script);
    assert.equal(repeat.status,'refused');assert.equal(repeat.allocationAttempted,false);
    assert.deepEqual(f.figma.root.findAll(()=>true).map((n:any)=>n.id),ids);
    assert.deepEqual(await f.run(emitNativeContractReadbackScript(input)),receipt);
  });
}

test('native shape supports a token base under a gradient and refuses alias, color and opacity drift',async()=>{
  const f=await nativeComparisonFixture();
  const c=f.contract('fixture.bound-paint',{root:{layout:{display:'flex',direction:'row'},parts:{track:{
    shape:{kind:'rect',width:35,height:20},tokens:{'background-color':'{surface}'},literals:{'background-image':gradient}}}}});
  const byId=new Map([[c.id,c]]), compiled=f.engine.compileNativeContractDraft(c,byId,f.source);
  const creation=await f.run(f.engine.buildNativeContractDraftScript(c,byId,f.source,f.supplemental));
  assert.equal(creation.status,'created-candidate',JSON.stringify(creation));
  const input:NativeContractObservationInput={operation:f.supplemental.operation,planRevision:revisionOf('bound'),
    projection:compiled.projection,component:compiled.component,tokenInput:f.supplemental.tokens.input,
    tokenIdentity:f.supplemental.tokens.identity,creation};
  const receipt=await f.run(emitNativeContractReadbackScript(input));
  assert.equal(verifyNativeContractReadback(input,receipt).status,'supported-structure-observed',JSON.stringify(verifyNativeContractReadback(input,receipt)));
  for (const corrupt of [(p:any)=>{p.opacity=0.9;},(p:any)=>{p.color.r=0;},
    (p:any)=>{p.boundVariables.color.id='unowned';}]) {
    const bad=structuredClone(receipt);corrupt(bad.nodes.find((n:any)=>n.type === 'RECTANGLE').values.fills[0]);
    assert.equal(verifyNativeContractReadback(input,bad).status,'refused');
  }
});

test('literal-only and gradient-only native shapes preserve exactly the declared layers',async()=>{
  for(const shape of ['rect','ellipse']) for(const imageOnly of [false,true]) {
    const f=await nativeComparisonFixture();
    const c=f.contract('fixture.single-paint',{root:{layout:{display:'flex',direction:'row'},parts:{track:{
      shape:{kind:shape,width:35,height:20},literals:imageOnly ? {'background-image':gradient} : {'background-color':'rgba(18, 52, 86, 0.5)'}}}}});
    const byId=new Map([[c.id,c]]), compiled=f.engine.compileNativeContractDraft(c,byId,f.source);
    const creation=await f.run(f.engine.buildNativeContractDraftScript(c,byId,f.source,f.supplemental));
    assert.equal(creation.status,'created-candidate',JSON.stringify(creation));
    const input:NativeContractObservationInput={operation:f.supplemental.operation,planRevision:revisionOf('single'),
      projection:compiled.projection,component:compiled.component,tokenInput:f.supplemental.tokens.input,
      tokenIdentity:f.supplemental.tokens.identity,creation};
    const receipt=await f.run(emitNativeContractReadbackScript(input));
    assert.equal(verifyNativeContractReadback(input,receipt).status,'supported-structure-observed',JSON.stringify(verifyNativeContractReadback(input,receipt)));
    const node=receipt.nodes.find((n:any)=>n.type === (shape === 'rect' ? 'RECTANGLE' : 'ELLIPSE'));
    assert.deepEqual(node.values.fills.map((p:any)=>p.type),[imageOnly ? 'GRADIENT_LINEAR' : 'SOLID']);
  }
});

test('paint admission rejects ambiguous and malformed plans; empty transparent paint is distinct from a solid',()=>{
  const spec:NodeSpec={type:'shape',name:'track',shape:{kind:'rect',width:35,height:20},
    gradient:{angle:90,stops:[{position:0,color:{r:0.2,g:0.3,b:0.4,a:0}},{position:1,color:{r:0.2,g:0.3,b:0.4,a:0}}]}};
  const paint={type:'GRADIENT_LINEAR',gradientTransform:[[1,0,0],[0,1,0]],gradientStops:structuredClone(spec.gradient!.stops)};
  assert(nativePaintStackMatches(spec,[paint]));
  assert(!nativePaintStackMatches(spec,[{type:'SOLID',color:{r:0,g:0,b:0},opacity:0},paint]));
  for (const mutate of [(s:NodeSpec)=>{s.gradient!.angle=Infinity;},(s:NodeSpec)=>{s.gradient!.angle=Number.MAX_VALUE;},(s:NodeSpec)=>{s.gradient!.stops[0].position=-1;},
    (s:NodeSpec)=>{s.gradient!.stops[0].position=0.8;s.gradient!.stops[1].position=0.2;},
    (s:NodeSpec)=>{s.gradient!.stops[0].color.r=2;},(s:NodeSpec)=>{s.gradient!.stops=[];},
    (s:NodeSpec)=>{s.fill='surface';s.lits={fillColor:{r:0,g:0,b:0}};}]) {
    const bad=structuredClone(spec);mutate(bad);assert(!nativePaintSpecSupported(bad));assert(!nativePaintStackMatches(bad,[paint]));
  }
  const rounded=structuredClone(paint);for(const stop of rounded.gradientStops)for(const k of ['r','g','b','a'] as const)stop.color[k]=Math.fround(stop.color[k]!);
  assert(nativePaintStackMatches(spec,[rounded]));
  rounded.gradientStops[0].color.r+=0.000001;assert(!nativePaintStackMatches(spec,[rounded]));
});

test('bound color resolution follows verified modes and aliases, preserving alpha and refusing missing modes or cycles',()=>{
  const values=[{id:'a',name:'surface',resolvedType:'COLOR',variableCollectionId:'c',valuesByMode:{light:{type:'VARIABLE_ALIAS',id:'b'}}},
    {id:'b',name:'palette',resolvedType:'COLOR',variableCollectionId:'d',valuesByMode:{dark:{r:0.1,g:0.2,b:0.3,a:0.4}}}];
  assert.deepEqual(nativeBoundPaintColor('surface',values,{c:'light',d:'dark'},'c'),{id:'a',color:{r:0.1,g:0.2,b:0.3,a:0.4}});
  assert.equal(nativeBoundPaintColor('surface',values,{c:'light'},'c'),undefined);
  const cycle:any=structuredClone(values);cycle[1].valuesByMode.dark={type:'VARIABLE_ALIAS',id:'a'};
  assert.equal(nativeBoundPaintColor('surface',cycle,{c:'light',d:'dark'},'c'),undefined);
});
