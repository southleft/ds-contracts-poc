import test from 'node:test';
import assert from 'node:assert/strict';
import {nativeComparisonFixture} from './native-contract-comparison-test-fixture.js';
import {emitNativeContractReadbackScript,verifyNativeContractReadback,type NativeContractObservationInput} from './native-source-observation.js';
import {emitNativeContractComparisonReadbackScript,verifyNativeContractComparisonReadback} from './native-contract-comparison-observation.js';
import {prepareNativeContractComparison} from './native-contract-comparison.js';
import {revisionOf} from './contract-provenance.js';
import {lowerPaddingBoxBackground,rootSlotFlowSpecValid,nativeRootSlotFlowGeometry} from './figma-background-clip.js';
import {prepareNativeContractDraft} from './native-contract-draft.js';
import type {NodeSpec} from './emit-figma-script.js';

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
 assert.deepEqual(compile().variants[0].spec.children?.[0].rootSlotFlow,{inset:2,radius:12});
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


test('HUG row padding-box roots lower to a closed flow frame and preserve native SLOT bindings',async()=>{
 const f=await nativeComparisonFixture(),c=structuredClone(f.main);
 c.anatomy.root.declared={'background-clip':'padding-box'};
 c.anatomy.root.literals={height:'36px','border-width':'1px','border-radius':'8px','padding-top':'2px','padding-bottom':'3px'};
 c.anatomy.root.tokens={...c.anatomy.root.tokens,'padding-left':'{size}','padding-right':'{size}',gap:'{size}'};
 const compiled=f.engine.compileNativeContractDraft(c,new Map([[c.id,c]]),f.source),root=compiled.component.variants[0].spec;
 const flow=root.children![0],slot=flow.children![0];
 assert.deepEqual(flow.rootSlotFlow,{inset:1,radius:7});assert.equal(rootSlotFlowSpecValid(root,flow),true);
 assert.equal(root.strokesIncludedInLayout,true);assert.equal(root.fill,undefined);assert.equal(root.fixedHeight?.px??root.lits?.height,36);
 assert.equal(root.bindings?.paddingLeft,undefined);assert.equal(root.lits?.paddingTop,undefined);
 assert.equal(flow.fill,'surface');assert.equal(flow.bindings?.paddingLeft,'size');assert.equal(flow.bindings?.itemSpacing,'size');
 assert.equal(flow.lits?.paddingTop,2);assert.equal(flow.lits?.paddingBottom,3);assert.equal(slot.type,'slot');
 assert.equal(slot.bindings?.itemSpacing,'size');assert.deepEqual(slot.children??[],[]);
 assert.deepEqual([root.nativeContractPart?.specPath,flow.nativeContractPart?.specPath,slot.nativeContractPart?.specPath],[[],[0],[0,0]]);
 const data=f.engine.compileComponentData(c,new Map([[c.id,c]]));
 for(const change of [
  (r:NodeSpec)=>{r.children![0].absolute={h:'STRETCH',v:'STRETCH',left:1,right:1,top:1,bottom:1};},
  (r:NodeSpec)=>{r.children![0].children![0].children=[{type:'text',name:'forged',characters:'x'}];},
  (r:NodeSpec)=>{r.children![0].lits!.radius=8;},
  (r:NodeSpec)=>{r.children![0].children![0].rootSlotContent=undefined;},
  (r:NodeSpec)=>{r.bindings={...r.bindings,paddingLeft:'size'};},
  (r:NodeSpec)=>{r.children!.push({type:'frame',name:'extra'});},
 ]){const bad=structuredClone(data);change(bad.variants[0].spec);assert.throws(()=>prepareNativeContractDraft(c,bad,f.source,revisionOf(f.tokens),{mode:'light',brand:'default'}),/ROOT_SLOT_FLOW_UNQUALIFIED/);}
 const script=f.engine.buildNativeContractDraftScript(c,new Map([[c.id,c]]),f.source,f.supplemental);
 assert.match(script,/if \(spec.rootSlotFlow\) sizeRootContent\(child, child.children\[0\], spec.children\[0\]\)/);
});

test('the flow branch leaves fixed, minimum, template, default, column and non-root topology on the legacy path',()=>{
 const fresh=():NodeSpec=>({type:'root',name:'Root',layout:{mode:'HORIZONTAL',primary:'CENTER',counter:'CENTER'},
  fill:'surface',lits:{strokeWeight:1,radius:8,paddingLeft:10},children:[{type:'slot',name:'children',slotProperty:'Children',rootSlotContent:true,
   layout:{mode:'HORIZONTAL',primary:'CENTER',counter:'CENTER'}}]});
 const mutations:Array<(r:NodeSpec)=>void>=[r=>{r.lits!.width=100},r=>{r.pct=0.5},r=>{r.fixedWidth={px:100,varName:'width'}},r=>{r.lits!.minWidth=0},
  r=>{r.bindings={maxWidth:'width'}},r=>{r.lits!.minHeight=0},r=>{r.bindings={maxHeight:'height'}},r=>{r.rootFillWidth=true},r=>{r.layout!.mode='VERTICAL'},r=>{r.type='frame'},
  r=>{r.children![0].children=[{type:'text',name:'Content text template',slotTextTemplate:true}]},
  r=>{r.children![0].slotDefault=[{dep:'Other',contractId:'other'}]},r=>{r.strokesIncludedInLayout=false}];
 for(const mutate of mutations){const root=fresh();mutate(root);assert.equal(lowerPaddingBoxBackground(root,()=>undefined),true);
  assert.equal(root.children![0].rootSlotFlow,undefined);assert.deepEqual(root.children![0].backgroundPaint,{inset:1,radius:7});}
});

test('flow geometry accepts the two live-proved extents and rejects seed overshoot, offset and sizing corruption',()=>{
 // Synthetic values based on the retained live diagnostic; no mock or fixture is claimed as a native observation.
 const parent=(width:number)=>({width,height:36,layoutMode:'HORIZONTAL',layoutSizingHorizontal:'HUG',primaryAxisSizingMode:'AUTO',counterAxisSizingMode:'FIXED',
  primaryAxisAlignItems:'CENTER',counterAxisAlignItems:'CENTER',strokesIncludedInLayout:true,strokeAlign:'INSIDE',strokeTopWeight:1,strokeRightWeight:1,
  strokeBottomWeight:1,strokeLeftWeight:1,paddingTop:0,paddingRight:0,paddingBottom:0,paddingLeft:0,itemSpacing:0,cornerRadius:8,topLeftRadius:8,topRightRadius:8,bottomLeftRadius:8,bottomRightRadius:8});
 const frame=(width:number)=>({width:width-2,height:34,x:1,y:1,relativeTransform:[[1,0,1],[0,1,1]],layoutMode:'HORIZONTAL',layoutPositioning:'AUTO',
  layoutSizingHorizontal:'HUG',layoutSizingVertical:'FILL',primaryAxisSizingMode:'AUTO',primaryAxisAlignItems:'CENTER',counterAxisAlignItems:'CENTER',
  cornerRadius:7,topLeftRadius:7,topRightRadius:7,bottomLeftRadius:7,bottomRightRadius:7,visible:true,opacity:1,clipsContent:false,strokes:[],effects:[]});
 for(const width of [116,155])assert.equal(nativeRootSlotFlowGeometry({inset:1,radius:7},parent(width),frame(width)),true);
 for(const fields of [{width:114.01000213623047},{x:0},{height:36},{cornerRadius:8},{layoutPositioning:'ABSOLUTE'},
  {layoutSizingHorizontal:'FILL'},{opacity:0.5},{effects:[{}]},{relativeTransform:[[1,0,0],[0,1,1]]}])
  assert.equal(nativeRootSlotFlowGeometry({inset:1,radius:7},parent(116),{...frame(116),...fields}),false,JSON.stringify(fields));
 assert.equal(nativeRootSlotFlowGeometry({inset:1,radius:7},{...parent(116),strokesIncludedInLayout:false},frame(116)),false);
 assert.equal(nativeRootSlotFlowGeometry({inset:1,radius:7},{...parent(116),counterAxisSizingMode:'unknown'},frame(116)),false);
});

// Absence of a border still means a zero inset, rather than Figma's default
// birth-node stroke weight. This retains the broad no-stroke HUG-row case.
test('zero-border flow records the derived zero and constrained height stays legacy',()=>{
 const make=():NodeSpec=>({type:'root',name:'Root',layout:{mode:'HORIZONTAL',primary:'CENTER',counter:'CENTER'},fill:'surface',
   children:[{type:'slot',name:'children',slotProperty:'Children',rootSlotContent:true,layout:{mode:'HORIZONTAL',primary:'CENTER',counter:'CENTER'}}]});
 const none=make();assert.equal(lowerPaddingBoxBackground(none,()=>undefined),true);
 assert.equal(none.lits?.strokeWeight,0);assert.deepEqual(none.children![0].rootSlotFlow,{inset:0,radius:0});
 const fixed=make();fixed.lits={height:36,minHeight:20};fixed.bindings={maxHeight:'size'};
 assert.equal(lowerPaddingBoxBackground(fixed,()=>40),true);assert.ok(fixed.children![0].rootSlotFlow);
});


test('flow geometry checks the rounded outer extent of all seven observed empty HUG variants',()=>{
 // Reduced checked fields from FLOW-GEOMETRY-DIAGNOSTIC.json (SHA256
 // 9840cd76d016633ae3d724d8f210c9d50e18500eb918f470ec333e84bdff14e2).
 // This regression replays recorded numbers, not a new native observation.
 const observations:Array<[string,number,number,number,number]>=[
  ['size=null, variant=default',2.009999990463257,2,0.009999999776482582,0],
  ['size=null, variant=null',2.009999990463257,2,0.009999999776482582,0],
  ['size=null, variant=outline',2.009999990463257,2,0.009999999776482582,0],
  ['size=null, variant=secondary',2.009999990463257,2,0.009999999776482582,0],
  ['size=null, variant=ghost',2.009999990463257,2,0.009999999776482582,0],
  ['size=null, variant=destructive',2.009999990463257,2,0.009999999776482582,0],
  ['size=null, variant=link',2.009999990463257,2,0.009999999776482582,0],
 ];
 const rootFields={layoutMode:'HORIZONTAL',layoutSizingHorizontal:'HUG',primaryAxisSizingMode:'AUTO',counterAxisSizingMode:'AUTO',
  primaryAxisAlignItems:'CENTER',counterAxisAlignItems:'CENTER',strokesIncludedInLayout:true,strokeAlign:'INSIDE',strokeTopWeight:1,strokeRightWeight:1,
  strokeBottomWeight:1,strokeLeftWeight:1,paddingTop:0,paddingRight:0,paddingBottom:0,paddingLeft:0,itemSpacing:0,cornerRadius:8,topLeftRadius:8,topRightRadius:8,bottomLeftRadius:8,bottomRightRadius:8};
 const flowFields={x:1,y:1,relativeTransform:[[1,0,1],[0,1,1]],layoutMode:'HORIZONTAL',layoutPositioning:'AUTO',layoutSizingHorizontal:'HUG',
  layoutSizingVertical:'HUG',primaryAxisSizingMode:'AUTO',primaryAxisAlignItems:'CENTER',counterAxisAlignItems:'CENTER',cornerRadius:7,topLeftRadius:7,
  topRightRadius:7,bottomLeftRadius:7,bottomRightRadius:7,visible:true,opacity:1,clipsContent:false,strokes:[],effects:[]};
 for(const [variant,width,height,innerWidth,innerHeight] of observations){
  const parent={...rootFields,width,height},carrier={...flowFields,width:innerWidth,height:innerHeight};
  assert.notEqual(innerWidth,width-2,variant);
  assert.notEqual(innerWidth,Math.fround(width-2),variant);
  assert.equal(width,Math.fround(innerWidth+2),variant);
  assert.equal(nativeRootSlotFlowGeometry({inset:1,radius:7},parent,carrier),true,variant);
  // Do not widen the accepted relation to a neighbouring float32 outer size.
  assert.equal(nativeRootSlotFlowGeometry({inset:1,radius:7},{...parent,width:2.010000228881836},carrier),false,variant);
  for(const invalid of [-1,NaN,Infinity,-Infinity]){
   assert.equal(nativeRootSlotFlowGeometry({inset:1,radius:7},parent,{...carrier,width:invalid}),false,variant);
   assert.equal(nativeRootSlotFlowGeometry({inset:1,radius:7},parent,{...carrier,height:invalid}),false,variant);
  }
 }
 // The original inherited STRETCH overshoot is still a geometric mismatch.
 const filledParent={...rootFields,width:116,height:36,counterAxisSizingMode:'FIXED'};
 const filledCarrier={...flowFields,width:114,height:34,layoutSizingVertical:'FILL'};
 assert.equal(nativeRootSlotFlowGeometry({inset:1,radius:7},filledParent,filledCarrier),true);
 assert.equal(nativeRootSlotFlowGeometry({inset:1,radius:7},filledParent,{...filledCarrier,width:114.01000213623047}),false);
});
