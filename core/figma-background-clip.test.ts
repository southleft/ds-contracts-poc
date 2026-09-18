import test from 'node:test';
import assert from 'node:assert/strict';
import {nativeComparisonFixture} from './native-contract-comparison-test-fixture.js';
import {emitNativeContractReadbackScript,verifyNativeContractReadback,type NativeContractObservationInput} from './native-source-observation.js';
import {emitNativeContractComparisonReadbackScript,verifyNativeContractComparisonReadback} from './native-contract-comparison-observation.js';
import {prepareNativeContractComparison} from './native-contract-comparison.js';
import {revisionOf} from './contract-provenance.js';

test('padding-box paint preserves outer layout and token colour through native creation and independent readback',async()=>{
 const f=await nativeComparisonFixture();
 const c=structuredClone(f.main);
 c.anatomy.root.declared={'background-clip':'padding-box'};
 c.anatomy.root.literals={width:'116px',height:'36px','border-width':'1px','border-radius':'8px'};
 const byId=new Map([[c.id,c]]),compiled=f.engine.compileNativeContractDraft(c,byId,f.source);
 const spec=compiled.component.variants[0].spec;
 assert.equal(spec.fill,undefined);assert.equal(spec.lits?.width,116);assert.equal(spec.lits?.height,36);
 assert.equal(spec.children?.[1].type,'slot');
 assert.equal(spec.children?.[0].fill,'surface');
 assert.deepEqual(spec.children?.[0].backgroundPaint,{inset:1,radius:7});
 assert.ok(!compiled.component.codeOnlyFacts?.some(f=>f.channel==='background-clip'));
 const creation=await f.run(f.engine.buildNativeContractDraftScript(c,byId,f.source,f.supplemental));
 assert.equal(creation.status,'created-candidate',JSON.stringify(creation));
 const input:NativeContractObservationInput={operation:f.supplemental.operation,planRevision:revisionOf('padding-box'),
  projection:compiled.projection,component:compiled.component,tokenInput:f.supplemental.tokens.input,tokenIdentity:f.supplemental.tokens.identity,creation};
 const receipt=await f.run(emitNativeContractReadbackScript(input));
 assert.equal(verifyNativeContractReadback(input,receipt).status,'supported-structure-observed',JSON.stringify(verifyNativeContractReadback(input,receipt)));
 const root=receipt.nodes.find((n:any)=>n.type==='COMPONENT'),paint=receipt.nodes.find((n:any)=>n.type==='RECTANGLE');
 assert.equal(root.values.width,116);assert.equal(root.values.height,36);assert.deepEqual(root.values.fills,[]);
 assert.equal(paint.values.width,114);assert.equal(paint.values.height,34);assert.equal(paint.values.cornerRadius,7);
 for(const corrupt of [
  (r:any)=>{r.nodes.find((n:any)=>n.type==='RECTANGLE').values.width=116;},
  (r:any)=>{r.nodes.find((n:any)=>n.type==='RECTANGLE').values.x=0;},
  (r:any)=>{r.nodes.find((n:any)=>n.type==='RECTANGLE').values.cornerRadius=8;},
  (r:any)=>{r.nodes.find((n:any)=>n.type==='RECTANGLE').values.constraints.horizontal='MIN';},
  (r:any)=>{r.nodes.find((n:any)=>n.type==='RECTANGLE').values.fills[0].boundVariables.color.id='wrong';},
  (r:any)=>{r.nodes.find((n:any)=>n.type==='COMPONENT').values.fills=structuredClone(paint.values.fills);},
  (r:any)=>{r.nodes.find((n:any)=>n.type==='COMPONENT').childIds.reverse();},
 ]){const changed=structuredClone(receipt);corrupt(changed);assert.equal(verifyNativeContractReadback(input,changed).status,'refused');}
 const context=await f.context('10000000-0000-4000-8000-000000000003');
 const comparison={parent:input,receipt,caseId:'inset-content',variantName:compiled.component.variants[0].name,slotSpecPath:[1]};
 const contentById=new Map([[f.content.id,f.content]]);
 const prepared=prepareNativeContractComparison(f.content,f.engine.compileComponentData(f.content,contentById),f.source,revisionOf(f.tokens),{mode:'light',brand:'default'},comparison);
 const filled=await f.run(f.engine.buildNativeContractComparisonScript(f.content,contentById,f.source,context,comparison));
 assert.equal(filled.status,'created-candidate',JSON.stringify(filled));
 const comparisonInput={operation:context.operation,planRevision:revisionOf('inset comparison'),comparison:prepared,
  tokenInput:context.tokens.input,tokenIdentity:context.tokens.identity,creation:filled};
 const comparisonReceipt=await f.run(emitNativeContractComparisonReadbackScript(comparisonInput));
 const verdict=verifyNativeContractComparisonReadback(comparisonInput,comparisonReceipt);
 assert.equal(verdict.status,'supported-comparison-structure-observed',JSON.stringify(verdict));
 const damaged=structuredClone(comparisonReceipt);
 damaged.content.nodes.find((n:any)=>n.type==='RECTANGLE').values.constraints.horizontal='MIN';
 assert.equal(verifyNativeContractComparisonReadback(comparisonInput,damaged).status,'refused');
 const wrongExtent=structuredClone(comparisonReceipt);
 wrongExtent.content.nodes.find((n:any)=>n.type==='RECTANGLE').values.width=116;
 assert.equal(verifyNativeContractComparisonReadback(comparisonInput,wrongExtent).status,'refused');
});

test('shared rule derives bound radii and border widths and leaves unsupported clipping explicit',async()=>{
 const f=await nativeComparisonFixture(),c=structuredClone(f.main);
 c.anatomy.root.declared={'background-clip':'padding-box'};
 c.anatomy.root.tokens!['border-radius']='{size}';
 c.anatomy.root.literals={'border-width':'2px'};
 const compile=()=>f.engine.compileComponentData(c,new Map([[c.id,c]]));
 assert.deepEqual(compile().variants[0].spec.children?.[0].backgroundPaint,{inset:2,radius:12});
 c.anatomy.root.literals['border-left-width']='3px';
 const asymmetric=compile();
 assert.equal(asymmetric.variants[0].spec.backgroundClip,undefined);
 assert.ok(asymmetric.codeOnlyFacts?.some(f=>f.channel==='background-clip'));
 delete c.anatomy.root.literals['border-left-width'];
 for(const clip of ['content-box','text','padding-box, border-box']){
  c.anatomy.root.declared['background-clip']=clip;
  assert.equal(compile().variants[0].spec.backgroundClip,undefined);
  assert.ok(compile().codeOnlyFacts?.some(f=>f.channel==='background-clip'));
 }
});

test('nested literal backgrounds retain alpha and zero inner radii',async()=>{
 const f=await nativeComparisonFixture();
 const c=f.contract('fixture.nested-paint',{root:{layout:{display:'flex',direction:'column'},parts:{
  panel:{layout:{display:'flex',direction:'row'},declared:{'background-clip':'padding-box'},
   literals:{width:'80px',height:'40px','background-color':'rgba(18,52,86,0.5)','border-width':'4px','border-radius':'2px'}}}}});
 const byId=new Map([[c.id,c]]),compiled=f.engine.compileNativeContractDraft(c,byId,f.source);
 const panel=compiled.component.variants[0].spec.children![0];
 assert.deepEqual(panel.children![0].backgroundPaint,{inset:4,radius:0});
 const creation=await f.run(f.engine.buildNativeContractDraftScript(c,byId,f.source,f.supplemental));
 assert.equal(creation.status,'created-candidate',JSON.stringify(creation));
 const input:NativeContractObservationInput={operation:f.supplemental.operation,planRevision:revisionOf('nested paint'),
  projection:compiled.projection,component:compiled.component,tokenInput:f.supplemental.tokens.input,tokenIdentity:f.supplemental.tokens.identity,creation};
 const receipt=await f.run(emitNativeContractReadbackScript(input)),verdict=verifyNativeContractReadback(input,receipt);
 assert.equal(verdict.status,'supported-structure-observed',JSON.stringify(verdict));
 const bad=structuredClone(receipt);bad.nodes.find((n:any)=>n.type==='RECTANGLE').values.fills[0].opacity=1;
 assert.equal(verifyNativeContractReadback(input,bad).status,'refused');
});
