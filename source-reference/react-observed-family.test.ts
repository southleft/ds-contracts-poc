import assert from 'node:assert/strict';
import test from 'node:test';
import {createHash} from 'node:crypto';
import {isObservedFamilySelection,observedFamilyInputs,assembleObservedFamily,observedFamilyFacts} from './react-observed-family.js';
import {isReactObservedFamilyNativeRequest,reactObservedFamilyReservation} from './react-observed-family-native.js';
import {isReactComparisonRequest,reactComparisonReservation,reactComparisonContentOperation,reactComparisonContentScope} from './react-comparison-request.js';
import type {ReactNativeRequest} from './react-native-request.js';

const selection={version:1 as const,kind:'react-observed-one-axis-family' as const,axis:'size',baseCaseId:'small',caseIds:['small','large']};
const mount={module:'./component.tsx',export:'Component',props:{children:'hello'}};
const rows=()=>[{caseId:'small',props:{size:'small',tone:'quiet',children:'hello'},mount:structuredClone(mount)},
  {caseId:'large',props:{size:'large',tone:'quiet',children:'hello'},mount:structuredClone(mount)}];

test('selected family is canonical over input order and preserves its explicit baseline',()=>{
  assert(isObservedFamilySelection(selection));
  const a=observedFamilyInputs('size',rows(),'small');
  assert.deepEqual(observedFamilyInputs('size',rows().reverse(),'small'),a);
  assert.equal(a.baseValue,'small');
  assert.deepEqual(a.members.map(m=>m.value),['large','small']);
});
test('selection refuses invented fields, repeated rows, missing baseline and reserved axes',()=>{
  for(const value of [{...selection,caseIds:['small','small']},{...selection,caseIds:['small']},
    {...selection,baseCaseId:'absent'},{...selection,axis:'children'},
    {...selection,axis:'__proto__'},{...selection,domain:['small','large']}])assert.equal(isObservedFamilySelection(value),false);
});
test('only the selected scalar changes; held props, children and outer mount must agree',()=>{
  for(const mutate of [
    (r:any[])=>{r[1].props.tone='loud';},
    (r:any[])=>{r[1].props.children='different';},
    (r:any[])=>{r[1].mount.props.children='different';},
    (r:any[])=>{r[1].mount={tag:'div',children:[r[1].mount]};},
  ]){const r=rows();mutate(r);assert.throws(()=>observedFamilyInputs('size',r,'small'),/react-family-(held-inputs|surrounding-mount)-differ/);}
});
test('omission, null, boolean, object, duplicate values and variant syntax do not become a family',()=>{
  for(const value of [undefined,null,false,{initial:'large'},'small','large, tone=loud','']){
    const r:any[]=rows();if(value===undefined)delete r[1].props.size;else r[1].props.size=value;
    assert.throws(()=>observedFamilyInputs('size',r,'small'),/react-family-/);
  }
});
test('plain objects cannot counterfeit re-opened source authority',()=>{
  const fake:any={record:{axis:{prop:'size',values:['small','large']}},planes:[],pin:{id:'a'.repeat(64)}};
  assert.throws(()=>assembleObservedFamily(fake),/verified-evidence-required/);
  assert.throws(()=>observedFamilyFacts(fake),/verified-evidence-required/);
});

const root:ReactNativeRequest={version:1,kind:'react-root-draft',referenceId:'a'.repeat(64),
  ownership:{id:'10000000-0000-4000-8000-000000000001',sha256:'b'.repeat(64)},caseId:'small',
  inventorySha256:'c'.repeat(64),matrixRevision:'sha256:'+'d'.repeat(64)};
const family={version:1 as const,kind:'react-observed-family-draft' as const,referenceId:root.referenceId,
  family:{id:'e'.repeat(64),recordSha256:'f'.repeat(64),inventorySha256:'1'.repeat(64)},compilation:'current' as const};
const content={id:'10000000-0000-4000-8000-000000000003',reportSha256:'2'.repeat(64),inventorySha256:'3'.repeat(64)};
const parentOperationId='10000000-0000-4000-8000-000000000002';
test('new family request and member comparison use exact, disjoint versioned shapes',()=>{
  assert(isReactObservedFamilyNativeRequest(family));
  assert(!isReactObservedFamilyNativeRequest({...family,nodeId:'1:2'}));
  assert(!isReactObservedFamilyNativeRequest({...family,family:{...family.family,path:'/tmp/input'}}));
  const request={version:5 as const,kind:'react-content-comparison' as const,parentOperationId,familyRoot:family,root,content};
  assert(isReactComparisonRequest(request));
  for(const extra of [{mainRoot:root},{parentUpdate:{proposalId:'a'.repeat(64),observationRevision:'sha256:'+'b'.repeat(64)}},
    {composition:{revision:'sha256:'+'c'.repeat(64)}},{familyRoot:undefined}])assert(!isReactComparisonRequest({...request,...extra}));
  assert.equal(reactComparisonContentOperation(request),reactComparisonContentScope(parentOperationId,root));
  for(const changed of [{...request,root:{...root,caseId:'large'}},
    {...request,familyRoot:{...family,family:{...family.family,recordSha256:'4'.repeat(64)}}},
    {...request,content:{...content,reportSha256:'5'.repeat(64)}}])assert.notEqual(reactComparisonReservation(request),reactComparisonReservation(changed));
  assert.notEqual(reactObservedFamilyReservation(family),reactObservedFamilyReservation({...family,family:{...family.family,id:'6'.repeat(64)}}));
});
test('legacy comparison versions retain their original reservation and content-scope algorithms',()=>{
  const old={version:1 as const,kind:'react-content-comparison' as const,parentOperationId,root,content};
  const composition={revision:'sha256:'+'4'.repeat(64)},parentUpdate={proposalId:'5'.repeat(64),observationRevision:'sha256:'+'6'.repeat(64)};
  const inputs=[old,{...old,version:2 as const,composition},{...old,version:3 as const,mainRoot:root},
    {...old,version:4 as const,mainRoot:root,parentUpdate}];
  const originalInputs=[['react-content-comparison',parentOperationId],['react-content-comparison-v2',parentOperationId,composition.revision],
    ['react-content-comparison-v3',parentOperationId,root.caseId,null],['react-content-comparison-v4',parentOperationId,root,root,parentUpdate,null]];
  inputs.forEach((request,i)=>{
    assert(isReactComparisonRequest(request));
    const h=createHash('sha256').update(JSON.stringify(originalInputs[i])).digest('hex').slice(0,32);
    assert.equal(reactComparisonReservation(request),`${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`);
    assert.equal(reactComparisonContentOperation(request),i<2?parentOperationId:reactComparisonContentScope(parentOperationId,root));
    assert(!isReactComparisonRequest({...request,familyRoot:family}));
  });
});


// The authenticated family assembler uses the same shared sweep for every
// selected source plane. These pure fixtures retain the real size/tracking
// pattern; they do not stand in for source capture or native measurements.
import {ContractSchema} from '../scripts/contract-schema.js';
import {compileReactRootSweep} from './react-root-sweep.js';
import {prepareReactRootTextTemplate,type ReactRootTextPlane} from './react-root-text-template.js';
import {createFigmaEngine} from '../core/emit-figma-script.js';
import {planNativeRootTextTemplate} from '../core/native-root-text-template-plan.js';
import {canonicalJson,revisionOf} from '../core/contract-provenance.js';
import {enumerate,normalizeValue,type CapturedNode} from '../extract/computed/lib.js';
import {evidenceSha} from './react-validation-evidence.js';
import type {TextFontEvidence} from './text-fonts.js';

function trackingSweep(tracking: string[] = ['0.03px','0.03px','normal']) {
  const values = tracking.map((_, i) => String(i + 1));
  const contract = ContractSchema.parse({id:'test.observed-tracking',name:'ObservedTracking',description:'Observed size tracking fixture',
    version:'0.1.0',status:'draft',props:[{name:'size',type:{enum:values},default:values[0],
      bindings:{code:{prop:'size'},figma:{kind:'VARIANT',property:'Size'}}}],states:[],semantics:{element:'span'},
    anatomy:{root:{slot:{name:'children'},layout:{display:'inline-flex',direction:'row'}}},
    bindings:{code:{anchors:{importPath:'test/ObservedTracking',export:'ObservedTracking'}},figma:{anchors:{fileKey:null,componentSetKey:null}}}});
  const axes = [{prop:'size',values}], baseAxisValues = {size:values[0]};
  const combos = enumerate(axes,[],256,baseAxisValues).combos;
  const roots = new Map<string,CapturedNode>(combos.map((combo,i) => [combo.key,{
    tag:'span',classes:[],nodes:[{t:'text',v:'New'}],pseudo:{},style:{
      display:'inline-flex','flex-direction':'row','align-items':'center','justify-content':'center',
      'font-family':'"Inter"','font-style':'normal','font-weight':'500','font-size':i===2?'14px':'12px',
      'line-height':i===2?'20px':'16px','letter-spacing':tracking[i],color:'rgb(17, 51, 85)',
      'text-transform':'none','text-align':'left','text-decoration-line':'none',
    },
  }]));
  const planes = (): ReactRootTextPlane[] => combos.map((combo,i) => {
    const tree = structuredClone(roots.get(combo.key)!);
    const fonts:TextFontEvidence = {version:1,treeRevision:revisionOf(tree),status:'observed',problems:[],rows:[{
      path:[],text:'New',cssFamily:tree.style['font-family'],cssWeight:'500',cssStyle:'normal',
      fonts:[{familyName:'Inter',postScriptName:'Inter-Regular_Medium',isCustomFont:true,glyphCount:3}],
    }]};
    const bounds = {x:0,y:0,width:38,height:20};
    return {snapshot:{propertyCaptureVersion:2,tree,fonts,bounds,boundsSha256:evidenceSha(JSON.stringify(bounds))} as ReactRootTextPlane['snapshot'],
      row:{id:String(i),status:'observed',propertyCaptureVersion:2,fontsSha256:evidenceSha(JSON.stringify(fonts)),boundsSha256:evidenceSha(JSON.stringify(bounds))},
      rootPath:'',caller:'New',actualProps:{size:combo.axisValues.size,children:'New'}};
  });
  // Production adapters pass private normalized roots to the sweep. Raw
  // Chromium rgb() is not the sweep's canonical rgba() token input.
  const normalized = new Map([...roots].map(([key,root])=>[key,{...root,nodes:[],
    style:Object.fromEntries(Object.entries(root.style).map(([channel,value])=>[channel,normalizeValue(value)]))}]));
  const result = compileReactRootSweep(contract,axes,baseAxisValues,normalized);
  return {contract,roots,planes,result};
}

function compiledTracking(f: ReturnType<typeof trackingSweep>, planes = f.planes()) {
  const admission = prepareReactRootTextTemplate(f.result.enriched,f.result.tokens,planes);
  assert.equal(admission.admitted,true,admission.limitation??'template admission failed');
  const component = createFigmaEngine({tokens:{primitives:f.result.tokens,semantic:{},light:{},dark:{},brands:{default:{}}},icons:new Map()})
    .compileComponentData(admission.contract,new Map([[admission.contract.id,admission.contract]]));
  return {admission,component,plan:planNativeRootTextTemplate(component,{contractRevision:revisionOf(admission.contract),tokenRevision:revisionOf(f.result.tokens)})!};
}

test('observed size tracking retains .03px/.03px/normal through sweep and exact template selection',()=>{
  const f = trackingSweep(), before = JSON.stringify([...f.roots]), {component,plan} = compiledTracking(f);
  assert.equal(f.result.residuals.some(r=>r.channel==='letter-spacing'),false);
  assert.deepEqual(component.variants.map(v=>[v.name,v.spec.children![0].children![0].letterSpacing]),
    [['Size=1',0.03],['Size=2',0.03],['Size=3',0]]);
  assert.equal(Object.hasOwn(plan.typography,'letterSpacing'),false);
  for (const [name,expected] of [['Size=1',0.03],['Size=2',0.03],['Size=3',0]] as const) {
    assert.equal(plan.variants.find(v=>v.name===name)!.letterSpacing,expected);
  }
  assert.equal(Object.keys(plan.aliases).length,4);
  assert.equal(JSON.stringify([...f.roots]),before,'source trees are not normalized in place');
});

test('tracking admission refuses exchanged source cases, missing planes and unsupported or lost tracking',()=>{
  const f = trackingSweep();
  const changed = f.planes();
  [changed[0].actualProps,changed[2].actualProps] = [changed[2].actualProps,changed[0].actualProps];
  assert.equal(prepareReactRootTextTemplate(f.result.enriched,f.result.tokens,changed).limitation,'root-text-template-unqualified:source-tracking-differs');
  assert.equal(prepareReactRootTextTemplate(f.result.enriched,f.result.tokens,f.planes().slice(0,2)).limitation,'root-text-template-unqualified:source-variant-coverage-required');
  const unmapped=f.planes();delete unmapped[0].actualProps;
  assert.equal(prepareReactRootTextTemplate(f.result.enriched,f.result.tokens,unmapped).limitation,'root-text-template-unqualified:source-variant-required');
  for (const bad of ['0.03em','calc(0.03px)','',undefined]) {
    const planes=f.planes(), tree=planes[0].snapshot.tree;
    if(bad===undefined)delete tree.style['letter-spacing'];else tree.style['letter-spacing']=bad;
    planes[0].snapshot.fonts!.treeRevision=revisionOf(tree);
    planes[0].row.fontsSha256=evidenceSha(JSON.stringify(planes[0].snapshot.fonts));
    assert.equal(prepareReactRootTextTemplate(f.result.enriched,f.result.tokens,planes).limitation,'root-text-template-unqualified:source-tracking-differs');
  }
  const zero=trackingSweep(['0px','0px','0px']);
  assert.equal(prepareReactRootTextTemplate(zero.result.enriched,zero.result.tokens,f.planes()).limitation,'root-text-template-unqualified:source-tracking-differs');
});

test('uniform zero and uniform precise tracking keep global template typography and old mode keys',()=>{
  for(const value of ['normal','0px','0.03px']) {
    const f=trackingSweep([value,value,value]), {plan}=compiledTracking(f);
    assert.equal(plan.typography.letterSpacing,value==='0.03px'?0.03:0);
    assert(plan.modes.every(mode=>mode.key===revisionOf(mode.targets)));
    assert(plan.variants.every(variant=>!Object.hasOwn(variant,'letterSpacing')));
  }
  const legacy=trackingSweep(), planes=legacy.planes();
  for(const plane of planes){delete plane.snapshot.propertyCaptureVersion;delete plane.row.propertyCaptureVersion;}
  const result=prepareReactRootTextTemplate(legacy.result.enriched,legacy.result.tokens,planes);
  assert.deepEqual(result,{contract:legacy.result.enriched,admitted:false});
});


test('family draft version two pins content while legacy requests retain exact parser and reservation behavior',()=>{
  const current={...family,version:2 as const,draftRevision:revisionOf({contract:'same',tokens:'same',native:'same'})};
  assert(isReactObservedFamilyNativeRequest(current));
  assert.equal(reactObservedFamilyReservation({...current}),reactObservedFamilyReservation(current),'retry reuses the same compiled draft');
  const changed={...current,draftRevision:revisionOf({contract:'same',tokens:'same',native:'corrected'})};
  assert.notEqual(reactObservedFamilyReservation(changed),reactObservedFamilyReservation(current));
  assert.notEqual(reactObservedFamilyReservation(family),reactObservedFamilyReservation(current));
  for(const invalid of [{...family,draftRevision:current.draftRevision},{...current,draftRevision:undefined},
    {...current,draftRevision:'sha256:bad'},{...current,version:3},{...current,nonce:'new'}])
    assert.equal(isReactObservedFamilyNativeRequest(invalid),false);
  const digest=createHash('sha256').update(canonicalJson(['react-observed-family-v1',family])).digest('hex').slice(0,32);
  assert.equal(reactObservedFamilyReservation(family),`${digest.slice(0,8)}-${digest.slice(8,12)}-${digest.slice(12,16)}-${digest.slice(16,20)}-${digest.slice(20)}`);
});
