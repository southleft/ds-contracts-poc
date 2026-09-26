import assert from 'node:assert/strict';
import {revisionOf} from '../core/contract-provenance.js';
import {createFigmaEngine} from '../core/emit-figma-script.js';
import {stateApiEvidence,stateApiObservation} from './react-state-api-fixture.js';
import {planReactStateApi} from './react-state-api.js';
import type {ReactStateApiInspection} from './react-state-api-inspection.js';
import {projectReactAuthoredStateApiDraft} from './react-authored-state-api.js';
import {reactAuthoredInitialAnchor,type ReactAuthoredStateApiNativeRequest} from './react-authored-native-request.js';
import {projectReactStateApiContract} from './react-state-api-contract.js';

export function authoredStateApiEvidence(){
  const {initial,behavior}=stateApiEvidence();
  initial.id='10000000-0000-4000-8000-000000000001';initial.instanceId='instance-0';behavior.instanceId='instance-0';
  for(const row of behavior.observation!.rows)row.callback='onNotify';
  for(const row of behavior.observation!.relationships)row.callback='onNotify';
  for(const row of behavior.observation!.candidates)row.callback='onNotify';
  for(const row of behavior.observation!.refusals!)row.callback='onNotify';
  const root=structuredClone(initial.draft!.compiled!.contract!),child=structuredClone(root);
  child.id='fixture.context';child.name='Context';child.semantics={element:'span'};
  child.bindings.code.anchors.export=child.name;
  child.anatomy={root:{literals:{width:'20px',height:'10px'},tokens:{'background-color':'{ink}'},
    literalsByProp:[{prop:'seed',map:{false:{width:'20px'},true:{width:'30px'}}}]}};
  root.anatomy={root:{literals:{width:'100px',height:'30px'},parts:{child:{component:{id:child.id,props:{seed:'{seed}',gate:'{gate}'}}}}}};
  const tokens={ink:{$type:'color',$value:'#000000'}};
  const engine=createFigmaEngine({tokens:{primitives:tokens,semantic:{},light:{},dark:{},brands:{default:{}}},icons:new Map()});
  const component=engine.compileComponentData(root,new Map([[root.id,root],[child.id,child]]));
  initial.authoredDraft={version:1,qualification:'observed-authored-composition-sweep-draft',acceptedContract:null,
    status:'native-compiled',nativeQualification:'unqualified',inputRevision:revisionOf('fixture'),
    contract:root,contracts:[root,child],tokens,assets:[],problems:[],limitations:[],
    nativeVariants:component.variants.map((v,i)=>({observation:String(i),variant:v.name})),
    boundaries:[{path:'',contractId:root.id,planes:[]},{path:'0',contractId:child.id,planes:[]}]};
  initial.draft!.status='refused';
  const plan=planReactStateApi(initial,behavior);
  const report:ReactStateApiInspection={id:'20000000-0000-4000-8000-000000000001',caseId:plan.caseId,
    phase:'complete',qualification:plan.qualification,plan,sourceUnchanged:true,restorationChecks:plan.cases.length*3,
    problems:[],observation:stateApiObservation(plan)};
  const pin={key:'a'.repeat(64),id:report.id,inventorySha256:'b'.repeat(64),reportSha256:'c'.repeat(64)};
  const projected=projectReactStateApiContract(initial,report);assert.equal(projected.status,'generated-draft',JSON.stringify(projected.problems));
  const draft=projectReactAuthoredStateApiDraft(initial,report);
  const request:ReactAuthoredStateApiNativeRequest={version:3,kind:'react-authored-draft',referenceId:'d'.repeat(64),caseId:initial.caseId,
    ownership:{id:'30000000-0000-4000-8000-000000000001',sha256:'e'.repeat(64)},inventorySha256:'f'.repeat(64),helper:0,
    draftRevision:revisionOf(draft),initialDraftRevision:revisionOf(initial.authoredDraft),stateApi:pin,
    initial:{key:'1'.repeat(64),id:initial.id,inventorySha256:'2'.repeat(64),reportSha256:'3'.repeat(64),
      instanceId:'instance-0',anchorDraftRevision:revisionOf('original')}};
  const source={revision:'sha256:'+request.referenceId,programSha256:'4'.repeat(64),evidenceRevision:revisionOf(reactAuthoredInitialAnchor(request))};
  return {initial,behavior,report,pin,draft,request,appearance:{draft:initial.authoredDraft,source,frames:{}},state:{initial,report,pin}};
}

