import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {emitBoundFillLayerReadbackScript,verifyBoundFillLayerReadback} from './solid-fill-layer-observation.js';

const source=JSON.parse(readFileSync(new URL('./fixtures/bound-fill-layer-readback/SOURCE.json',import.meta.url),'utf8'));

test('independent live bound-paint receivers retain variable alpha and stacking in all four host contexts',()=>{
  assert.equal(source.receipts.length,4);
  for(const [i,expected] of source.expected.entries())
    assert.deepEqual(verifyBoundFillLayerReadback(expected,source.receipts[i]),{status:'bound-fill-layer-observed'});
  assert.equal(source.expected[3].paint.opacity,Math.fround(.00001));
});

test('bound paint readback refuses binding, opacity, geometry, hierarchy and mode drift',()=>{
  const mutations:Record<string,(r:any)=>void>={
    file:r=>{r.fileKey='other';},
    parent:r=>{r.layer.parentId='other';},
    missingBinding:r=>{delete r.layer.fills[0].boundVariables;},
    wrongBinding:r=>{r.layer.fills[0].boundVariables.color.id='other';},
    wrongVariable:r=>{r.variable.id='other';},
    wrongSelectedValue:r=>{r.variable.resolved.value.a=.25;},
    doubledAlpha:r=>{r.layer.opacity=.5;},
    paintBlend:r=>{r.layer.fills[0].blendMode='MULTIPLY';},
    nodeBlend:r=>{r.layer.blendMode='NORMAL';},
    residualHostFill:r=>{r.host.fills=[r.layer.fills[0]];},
    rotated:r=>{r.layer.rotation=1;},
    sheared:r=>{r.layer.relativeTransform[0][1]=.1;},
    stroke:r=>{r.layer.strokes=[{type:'SOLID'}];},
    effect:r=>{r.layer.effects=[{type:'DROP_SHADOW'}];},
    mask:r=>{r.layer.isMask=true;},
    shifted:r=>{r.layer.x=1;},
    resized:r=>{r.layer.width=39;},
    wrongHostSize:r=>{r.host.height=41;},
    visible:r=>{r.layer.visible=false;},
    flowing:r=>{r.layer.layoutPositioning='AUTO';},
    constraints:r=>{r.layer.constraints.horizontal='MIN';},
    corners:r=>{r.layer.corners.topLeftRadius=0;},
    missingContent:r=>{r.host.childIds.pop();},
    reordered:r=>{r.host.childIds.reverse();},
    duplicateLayer:r=>{r.host.childIds.push(r.layer.id);},
    changedInk:r=>{r.layer.fills[0].color.r=0;},
  };
  for(const [name,mutate] of Object.entries(mutations)){
    const receipt=structuredClone(source.receipts[1]);mutate(receipt);
    assert.equal(verifyBoundFillLayerReadback(source.expected[1],receipt).status,'refused',name);
  }
  for(const value of [null,{},[],{version:1}])assert.equal(verifyBoundFillLayerReadback(source.expected[0],value).status,'refused');
});

test('generated readback observes the requested identities in a separate read-only execution',async()=>{
  const expected=source.expected[1],receipt=source.receipts[1];
  const host={...receipt.host,...receipt.host.corners,children:receipt.host.childIds.map((id:string)=>({id}))};
  const layer={...receipt.layer,...receipt.layer.corners,parent:{id:receipt.layer.parentId}};
  const figma={fileKey:expected.fileKey,getNodeByIdAsync:async(id:string)=>id===host.id?host:id===layer.id?layer:null,
    variables:{getVariableByIdAsync:async(id:string)=>id===expected.variableId?{id,resolveForConsumer:(node:any)=>{
      assert.equal(node,layer);return receipt.variable.resolved;
    }}:null}};
  const run=new Function('figma','return (async()=>{'+emitBoundFillLayerReadbackScript(expected)+'})();');
  const observed=await run(figma);
  assert.deepEqual(verifyBoundFillLayerReadback(expected,observed),{status:'bound-fill-layer-observed'});
  await assert.rejects(run({...figma,fileKey:'other'}),/readback-file/);
});
