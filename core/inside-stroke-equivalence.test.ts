import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {inspectOpaqueInsideStroke} from './inside-stroke-equivalence.js';
const source=JSON.parse(readFileSync(new URL('./fixtures/inside-stroke-equivalence/SOURCE.json',import.meta.url),'utf8'));
test('three native overrides prove same opaque bound paint and preserve all stroke authorship',()=>{
 for(const row of source.rows){const h=row.hostOverrides[0],before=JSON.stringify(h),proof=inspectOpaqueInsideStroke(h);assert.equal(proof.kind,'opaque-same-paint-inside-stroke');assert.deepEqual(proof.source,h);assert.notEqual(proof.source,h);assert.equal(JSON.stringify(h),before);assert.equal(proof.source.vectorStrokeGeometry!.strokeMiterLimit,4);}
});
test('appearance equality alone never authorizes different bindings, opacity, clipping or stroke ownership',()=>{
 const changes:Array<(h:any)=>void>=[
 h=>h.solidFillTarget.childPath=[1],h=>h.solidStrokeTarget.instanceId='other',h=>h.vectorStrokeGeometry.target.nodeId='other',
 h=>h.fields.push('vectorNetwork'),h=>h.fields=['fills'],
 h=>h.vectorStrokeGeometry.strokeAlign='CENTER',h=>h.vectorStrokeGeometry.strokeAlign='OUTSIDE',
 h=>h.vectorStrokeGeometry.opacity=.5,h=>h.vectorStrokeGeometry.blendMode='MULTIPLY',h=>h.vectorStrokeGeometry.effects=[{type:'LAYER_BLUR',radius:1}],
 h=>h.vectorStrokeGeometry.strokeWeight=0,h=>h.vectorStrokeGeometry.strokeMiterLimit=NaN,h=>h.vectorStrokeGeometry.dashPattern=[1,1],
 h=>h.vectorStrokeGeometry.fillGeometry=[],h=>h.vectorStrokeGeometry.centeredStrokeGeometry=[],h=>h.vectorStrokeGeometry.relativeTransform[0][0]=NaN,
 h=>h.sourceNormalStrokeComposition.paint.color.r=.5,h=>h.sourceNormalStrokeComposition.paint.opacity=.5,h=>h.sourceNormalStrokeComposition.paint.blendMode='MULTIPLY',
 h=>{const id=h.sourceNormalStrokeComposition.variableId;h.variableConsumers.other=structuredClone(h.variableConsumers[id]);h.sourceNormalStrokeComposition.variableId='other'},
 h=>delete h.variableConsumers,h=>delete h.sourceNormalStrokeComposition,
 h=>{delete h.sourceNormalFillComposition.variableId;delete h.sourceNormalStrokeComposition.variableId;},
 ];
 for(const change of changes){const h=structuredClone(source.rows[0].hostOverrides[0]);change(h);assert.throws(()=>inspectOpaqueInsideStroke(h),String(change));}
});
test('independent literal paints require exact original colors without quantizing to 8-bit',()=>{
 const h=structuredClone(source.rows[0].hostOverrides[0]);for(const channel of ['Fill','Stroke'])delete h['sourceNormal'+channel+'Composition'].variableId;
 h.fill={hex:'c6c6c6'};h.stroke={hex:'c6c6c6'};assert(inspectOpaqueInsideStroke(h));h.sourceNormalStrokeComposition.paint.color.r=Math.fround(h.sourceNormalStrokeComposition.paint.color.r+.00001);assert.throws(()=>inspectOpaqueInsideStroke(h),/paint-composition/);
});
