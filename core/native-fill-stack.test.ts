import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import test from 'node:test';
import vm from 'node:vm';
import {qualifySolidFillColorBinding} from '../packages/schema/src/solid-fill-binding.js';
import {planSolidFillBindingTokens} from './solid-fill-binding-tokens.js';
import {compileNativeFillStack,nativeFillStackMatches,NATIVE_FILL_STACK_RUNTIME,type NativeFillStackReadback} from './native-fill-stack.js';

const png='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=';
const image=`url('data:image/png;base64,${png}')`;
const solid=(index:number,opacity=1,visible=true)=>({index,type:'SOLID' as const,visible,opacity,blendMode:'NORMAL' as const,color:{r:.25,g:.5,b:.75}});
const bitmap=(index:number,scaleMode:'FILL'|'FIT'|'CROP'|'STRETCH'='FILL',visible=true)=>({index,type:'IMAGE' as const,visible,opacity:.5,blendMode:'NORMAL' as const,imageHash:'source-image',image,scaleMode,
  ...(['CROP','STRETCH'].includes(scaleMode)?{imageTransform:[[.5,0,.125],[0,.25,.375]]}:{}),rotation:0 as const,scalingFactor:1 as const,filters:{contrast:0 as const}});
const fixture=()=>({version:1 as const,order:'bottom-to-top' as const,paints:[solid(0),bitmap(1,'FILL',false),solid(2,0,false),bitmap(3,'STRETCH')]});
function boundFixture(){
  const paint={color:{r:.25,g:.5,b:.75},opacity:.5,blendMode:'NORMAL' as const};
  const value={...paint.color,a:paint.opacity};
  const binding=qualifySolidFillColorBinding({variableId:'source-color',paint},{'source-color':{name:'paint',collectionId:'source-paint',modeId:'source-base',modeName:'Base',resolvedType:'COLOR',value,selectedValue:value}});
  const token=planSolidFillBindingTokens([binding]).requestedTokenPaths[0];
  return {token,value,stack:{version:1 as const,order:'bottom-to-top' as const,paints:[{...solid(0,.5,false),token,sourceBinding:{owner:'root',nodeName:'Paint',variantName:'Default',binding}},bitmap(1)]}};
}

function runtime(variables=new Map<string,any>(),corrupt=false){
  const assets=new Map<string,Uint8Array>();let creates=0,assignments=0;
  const previous=[{type:'SOLID',color:{r:1,g:0,b:0},opacity:1}];
  let fills:any[]=structuredClone(previous);
  const node:any={width:80,height:40,children:[{id:'existing-content'}],opacity:.75,blendMode:'PASS_THROUGH'};
  Object.defineProperty(node,'fills',{get:()=>fills,set:(input:any[])=>{
    assignments++;
    // Independent mock of native variable normalization: read the actual
    // variable selected by the paint's binding ID, never the expected plan.
    fills=structuredClone(input).map(p=>{
      const id=p.boundVariables?.color?.id,variable=variables.get(id);
      if(variable){const c=variable.resolveForConsumer(node).value;p.color={r:c.r,g:c.g,b:c.b};p.opacity=c.a??1;}
      if(corrupt&&p.type==='IMAGE')p.opacity=.125;
      return p;
    });
  }});
  const figma:any={
    base64Decode:(encoded:string)=>new Uint8Array(Buffer.from(encoded,'base64')),
    createImage:(bytes:Uint8Array)=>{creates++;const hash=createHash('sha1').update(bytes).digest('hex');assets.set(hash,Uint8Array.from(bytes));return{hash};},
    getImageByHash:(hash:string)=>assets.has(hash)?{getBytesAsync:async()=>Uint8Array.from(assets.get(hash)!)}:null,
    variables:{setBoundVariableForPaint:(paint:any,field:string,variable:any)=>({...paint,boundVariables:{[field]:{type:'VARIABLE_ALIAS',id:variable.id}}})},
    createRectangle(){throw Error('fill arrays must not add nodes');},
  };
  const apply=vm.runInNewContext(`${NATIVE_FILL_STACK_RUNTIME};applyFillStack`,{figma});
  const readback=async(tokens:Record<string,any>={}):Promise<{fills:any[];context:NativeFillStackReadback}>=>{
    const observed=structuredClone(node.fills),imageBase64ByHash:Record<string,string>={},bindingsByToken:Record<string,any>={};
    for(const p of observed)if(p.type==='IMAGE'){
      const source=figma.getImageByHash(p.imageHash);
      if(source)imageBase64ByHash[p.imageHash]=Buffer.from(await source.getBytesAsync()).toString('base64');
    }
    for(const [token,variable]of Object.entries(tokens))bindingsByToken[token]={id:variable.id,color:variable.resolveForConsumer(node).value};
    return{fills:observed,context:{imageBase64ByHash,bindingsByToken}};
  };
  return{node,figma,apply,readback,previous,assets,get creates(){return creates;},get assignments(){return assignments;}};
}

test('native compiler retains complete order, hidden/zero layers, original bytes and STRETCH source mode',()=>{
  const input=fixture(),before=structuredClone(input),plan=compileNativeFillStack(input);
  assert.deepEqual(plan.paints.map(p=>[p.index,p.type,p.visible,p.opacity]),[[0,'SOLID',true,1],[1,'IMAGE',false,.5],[2,'SOLID',false,0],[3,'IMAGE',true,.5]]);
  assert.equal((plan.paints[1] as any).base64,png);
  assert.equal((plan.paints[3] as any).scaleMode,'STRETCH');
  assert.deepEqual(input,before);
  assert.deepEqual(compileNativeFillStack({version:1,order:'bottom-to-top',paints:[]}).paints,[]);
});

test('writer replaces the array without extra nodes and memoizes identical original image bytes',async()=>{
  const plan=compileNativeFillStack(fixture()),r=runtime(),children=r.node.children;
  r.apply(r.node,{fillStack:plan});
  assert.equal(r.node.fills.length,4);assert.equal(r.node.fills[3].scaleMode,'CROP');
  assert.equal(r.node.children,children);assert.deepEqual([r.node.width,r.node.height,r.node.opacity,r.node.blendMode],[80,40,.75,'PASS_THROUGH']);
  assert.equal(r.creates,1);assert.equal(r.assignments,1);
  r.apply(r.node,{fillStack:plan});assert.equal(r.creates,1,'asset cache keys original bytes');
  const actual=await r.readback();assert(nativeFillStackMatches(plan,actual.fills,actual.context));
  r.apply(r.node,{fillStack:compileNativeFillStack({version:1,order:'bottom-to-top',paints:[]})});assert.deepEqual(r.node.fills,[]);
});

test('qualified token carries exact selected alpha once, with independent native binding identity',async()=>{
  const f=boundFixture(),plan=compileNativeFillStack(f.stack,()=>f.value);
  const variable={id:'new-native-variable',resolvedType:'COLOR',resolveForConsumer:()=>({resolvedType:'COLOR',value:{...f.value}})};
  const r=runtime(new Map([[variable.id,variable]]));
  r.apply(r.node,{fillStack:plan},(token:string)=>token===f.token?variable:undefined);
  assert.equal(r.node.fills[0].opacity,.5,'variable alpha is not multiplied twice');
  assert.equal(r.node.fills[0].visible,false);
  assert.equal(r.node.fills[0].boundVariables.color.id,variable.id);
  const actual=await r.readback({[f.token]:variable});assert(nativeFillStackMatches(plan,actual.fills,actual.context));
  assert.equal(nativeFillStackMatches(plan,actual.fills,{imageBase64ByHash:actual.context.imageBase64ByHash}),false);
  const foreign={...actual.context,bindingsByToken:{[f.token]:{id:'foreign-same-color',color:f.value}}};
  assert.equal(nativeFillStackMatches(plan,actual.fills,foreign),false);
});

test('source proof rejects an equal-valued foreign token and missing/mismatched binding provenance',()=>{
  const f=boundFixture();
  const foreign=structuredClone(f.stack);(foreign.paints[0] as any).token='other.same-color';
  assert.throws(()=>compileNativeFillStack(foreign,()=>f.value),/source-token-identity/);
  assert.throws(()=>compileNativeFillStack(f.stack,()=>({...f.value,a:1})),/token-value-disagreement/);
  const missing=structuredClone(f.stack);delete (missing.paints[0] as any).sourceBinding;
  assert.throws(()=>compileNativeFillStack(missing,()=>f.value),/binding-proof-conflict/);
  assert.throws(()=>compileNativeFillStack(f.stack),/token-value-disagreement/);
});

test('unresolved binding refuses before any callback, allocation or native write',()=>{
  let calls=0;
  const unresolved={version:1,order:'bottom-to-top',paints:[{...solid(0),unresolvedBinding:{variableId:'missing',reason:'consumer-unavailable',bindingRecreated:false}}]};
  assert.throws(()=>compileNativeFillStack(unresolved,()=>{calls++;return undefined;}),/native-fill-stack-unqualified:unresolved-binding/);
  assert.equal(calls,0);
  const r=runtime(),plan=compileNativeFillStack(fixture()) as any;
  plan.paints[0].unresolvedBinding=unresolved.paints[0].unresolvedBinding;
  assert.throws(()=>r.apply(r.node,{fillStack:plan}),/native-fill-stack-unqualified/);
  assert.equal(r.creates,0);assert.equal(r.assignments,0);assert.deepEqual(r.node.fills,r.previous);
});

test('independent readback rejects changed order, count, hidden alpha, pixels, transforms and extra paint data',async()=>{
  const plan=compileNativeFillStack(fixture()),r=runtime();r.apply(r.node,{fillStack:plan});const actual=await r.readback();
  const changed:Array<(rows:any[])=>void>=[
    rows=>rows.pop(),rows=>rows.reverse(),rows=>{rows[1].visible=true;},rows=>{rows[2].opacity=1;},
    rows=>{rows[3].imageTransform[0][2]=.25;},rows=>{rows[0].boundVariables={color:{type:'VARIABLE_ALIAS',id:'extra'}};},
    rows=>{rows[1].filters.contrast=.5;},rows=>{rows[3].scaleMode='STRETCH';},rows=>{rows[0].unexpected=true;}
  ];
  for(const change of changed){const rows=structuredClone(actual.fills);change(rows);assert.equal(nativeFillStackMatches(plan,rows,actual.context),false);}
  assert.equal(nativeFillStackMatches(plan,actual.fills,{}),false,'missing original bytes are not inferred from expected');
  const wrong={...actual.context,imageBase64ByHash:{[actual.fills[1].imageHash]:'different bytes'}};
  assert.equal(nativeFillStackMatches(plan,actual.fills,wrong),false);
  assert(nativeFillStackMatches(plan,actual.fills,{imageBase64ByHash:new Map(Object.entries(actual.context.imageBase64ByHash!))}));
});

test('runtime refuses wrong variable values before allocating images and rolls back altered native paint writes',()=>{
  const f=boundFixture(),plan=compileNativeFillStack(f.stack,()=>f.value),r=runtime();
  const wrong={id:'wrong',resolvedType:'COLOR',resolveForConsumer:()=>({resolvedType:'COLOR',value:{...f.value,a:1}})};
  assert.throws(()=>r.apply(r.node,{fillStack:plan},()=>wrong),/variable-value-disagreement/);
  assert.equal(r.creates,0);assert.equal(r.assignments,0);
  const altered=runtime(new Map(),true);
  assert.throws(()=>altered.apply(altered.node,{fillStack:compileNativeFillStack(fixture())}),/written-paint-disagreement/);
  assert.deepEqual(altered.node.fills,altered.previous);
});

test('malformed/native-unsupported schema values fail and absent stack is a no-op',()=>{
  const cases:Array<(stack:any)=>void>=[
    s=>{s.paints[1].index=4;},s=>{s.paints[0].blendMode='MULTIPLY';},s=>{s.paints[0].opacity=.1;},
    s=>{s.paints[1].filters.contrast=.1;},s=>{s.paints[3].imageTransform[0][1]=.1;},s=>{s.paints[1].image='url(https://example.com/image.png)';}
  ];
  for(const change of cases){const input=fixture();change(input);assert.throws(()=>compileNativeFillStack(input),/native-fill-stack-unqualified/);}
  const r=runtime();r.apply(r.node,{});assert.equal(r.creates,0);assert.equal(r.assignments,0);assert.deepEqual(r.node.fills,r.previous);
});
