import assert from 'node:assert/strict';
import test from 'node:test';
import fs, {mkdtempSync,mkdirSync,readFileSync,writeFileSync,rmSync,renameSync,symlinkSync,unlinkSync} from 'node:fs';
import {syncBuiltinESMExports} from 'node:module';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {readReactSourceProgram} from './react-source-program.js';
import {builtinReactCohort,loadReactCohort} from './react-cohort.js';
import {planReactPropertyMatrix} from './react-property-matrix.js';
import {assembleReactRootMatrix} from './react-root-matrix.js';
import {readReactObservedFamilyMembers,readReactObservedFamilyPlane,selectReactNativeRequest,readReactNativeEvidence} from './react-native-evidence.js';
import {withEvidenceReadSnapshot} from './evidence-read-snapshot.js';
import {evidenceSha,inventoryEvidence} from './react-validation-evidence.js';
import {revisionOf} from '../core/contract-provenance.js';
import type {ReactReference} from './react-reference.js';
import type {ReactOwnershipReport} from './react-ownership-run.js';
import type {ReactOwnership} from './react-ownership.js';
import type {ReactPropertyMatrix} from './react-property-matrix.js';
import type {ReactPropertySnapshot} from './react-root-variants.js';
import type {CapturedNode} from '../extract/computed/lib.js';
import type {TextFontEvidence} from './text-fonts.js';

import {selectObservedFamily,readObservedFamilyEvidence,withObservedFamilyPreparation,observedFamilyFacts,
  observedFamilyMember,assembleObservedFamily} from './react-observed-family.js';
import {observedFamilyNativeEvidence,type ReactObservedFamilyNativeRequest} from './react-observed-family-native.js';
import {selectObservedFamilyComparisonCase} from './react-comparison-case.js';
import {createNativeOperationJobs,REACT_NATIVE_FILE_KEY} from './native-operation-jobs.js';
import {prepareReactComparisonPlan} from './react-comparison-plan.js';
import {reactComparisonReservation,type ReactComparisonRequest} from './react-comparison-request.js';
import type {ObservedContentDraft} from './observed-content.js';
import {nativeComparisonFixture} from '../core/native-contract-comparison-test-fixture.js';

// Synthetic sealed source, not copied runtime authority or native fidelity.
function fixture(t:test.TestContext) {
  const repo=mkdtempSync(path.join(tmpdir(),'family-read-phase-'));
  t.after(()=>rmSync(repo,{recursive:true,force:true}));
  const source=path.join(repo,'surface.tsx');
  const sourceText=`declare global{namespace JSX{interface Element{} interface IntrinsicElements{section:any}}}
export function Surface(props:{tone?:string;children?:string}){return <section {...props}/>}`;
  writeFileSync(source,sourceText);
  writeFileSync(path.join(repo,'tsconfig.json'),JSON.stringify({compilerOptions:{strict:true,jsx:'preserve',target:'ES2022'}}));
  const program=readReactSourceProgram(repo,['surface.tsx']),component=program.components[0];
  assert.deepEqual(program.problems,[]);
  const reference:ReactReference={id:'a'.repeat(64),files:program.files,javascript:'',css:'',cohort:builtinReactCohort,sourceRoot:repo};
  const report:ReactOwnershipReport={id:'10000000-0000-4000-8000-000000000001',referenceId:reference.id,
    state:'complete',acceptedContract:null,denominator:2,matched:2,sourceUnchanged:true,rows:[]};
  const dir=path.join(repo,'private/react-source-ownership',reference.id,report.id);
  mkdirSync(dir,{recursive:true});
  writeFileSync(path.join(dir,'program.json'),JSON.stringify(program));
  for(const [id,tone] of [['first','quiet'],['second','loud']]) {
    const ownership:ReactOwnership={version:1,rendererVersions:['19.2.7'],components:[{id:'one',
      source:{module:component.module,exportName:component.exportName,sourceSha256:component.sourceSha256,span:component.span},
      props:{tone,children:'Original'},roots:['']}],nodes:[{path:'',tag:'section',nearestComponent:'one',createdBy:'one'}],problems:[]};
    const tree:CapturedNode={tag:'section',classes:[],nodes:[{t:'text',v:'Original'}],pseudo:{},style:{
      display:'inline-flex','flex-direction':'row','align-items':'center','justify-content':'center','flex-wrap':'nowrap',
      'font-family':'Inter','font-size':'12px','font-style':'normal','font-weight':'500','line-height':'16px','letter-spacing':'0px',
      color:'rgb(17, 51, 85)','background-color':'rgb(240, 240, 240)',width:'48px',height:'20px',
      'padding-left':'4px','padding-right':'4px','padding-top':'2px','padding-bottom':'2px',
      'row-gap':'0px','column-gap':'0px','border-top-width':'0px','border-top-style':'none'}};
    const fonts:TextFontEvidence={version:1,treeRevision:revisionOf(tree),status:'observed',problems:[],rows:[{
      path:[],text:'Original',cssFamily:'Inter',cssWeight:'500',cssStyle:'normal',
      fonts:[{familyName:'Inter',postScriptName:'Inter-Medium',isCustomFont:true,glyphCount:8}]}]};
    const bounds={x:0,y:0,width:48,height:20},treeSha256=evidenceSha(JSON.stringify(tree)),image='b'.repeat(64);
    const expected=planReactPropertyMatrix(program,ownership,tree,'one');
    assert.deepEqual(expected.axes,[]);
    const row={id:'0',changes:{},baseline:true as const,status:'observed' as const,restored:true,treeSha256,image,
      visibleChange:false,treeChange:false,propertyCaptureVersion:2 as const,fontsSha256:evidenceSha(JSON.stringify(fonts)),boundsSha256:evidenceSha(JSON.stringify(bounds))};
    const matrix={version:1,qualification:'full-finite-style-matrix',instanceId:'one',source:expected.source,
      heldProps:expected.heldProps,axes:expected.axes,planned:1,skipped:expected.skipped,rows:[row],problems:[]} as ReactPropertyMatrix;
    const snapshot={tree,treeSha256,image,ownership,fonts,bounds,boundsSha256:row.boundsSha256,propertyCaptureVersion:2} as ReactPropertySnapshot;
    const rootMatrix=assembleReactRootMatrix(program,ownership,tree,matrix,{'0':snapshot});
    assert.equal(rootMatrix.draft?.status,'native-compiled',JSON.stringify(rootMatrix));
    report.rows.push({id,matched:true,problems:[],treeSha256,ownership,propertyMatrix:matrix,rootMatrix});
    mkdirSync(path.join(dir,id,'matrix'),{recursive:true});
    writeFileSync(path.join(dir,id,'source-tree.json'),JSON.stringify({status:'captured',problems:[],tree,treeSha256}));
    writeFileSync(path.join(dir,id,'matrix/0.json'),JSON.stringify(snapshot));
  }
  const seal=()=>{
    writeFileSync(path.join(dir,'report.json'),JSON.stringify(report));
    rmSync(path.join(dir,'integrity.json'),{force:true});
    writeFileSync(path.join(dir,'integrity.json'),JSON.stringify({version:1,files:inventoryEvidence(dir)}));
  };
  seal();
  return {repo,reference,report,dir,source,sourceText,seal,read:()=>readReactObservedFamilyMembers(repo,reference,report,['first','second'])};
}

test('batch equals independent single-member readers and isolates all returned mutable member data',t=>{
  const f=fixture(t),before=JSON.stringify(f.report),single=f.report.rows.map(row=>{
    const request=selectReactNativeRequest(f.repo,f.report,row.id);
    return {request,plane:readReactObservedFamilyPlane(f.repo,f.reference,request)};
  });
  const batch=f.read();
  assert.deepEqual(batch.requests,single.map(x=>x.request));assert.deepEqual(batch.planes,single.map(x=>x.plane));
  const second=structuredClone(batch.planes[1]);
  batch.planes[0].program.files[f.source]='changed caller copy';
  batch.planes[0].row.problems.push('changed caller copy');
  batch.planes[0].captured.tree.style.color='red';
  assert.deepEqual(batch.planes[1],second);assert.equal(JSON.stringify(f.report),before);
  assert.deepEqual(f.read().planes,single.map(x=>x.plane));
});

test('batch sharing reduces report reads without suppressing member proofs',t=>{
  const f=fixture(t),reportFile=path.join(f.dir,'report.json'),original=fs.readFileSync;
  let reads=0;
  const spy=t.mock.method(fs,'readFileSync',((...args:unknown[])=>{
    if(String(args[0])===reportFile)reads++;
    return (original as Function)(...args);
  }) as typeof fs.readFileSync);
  syncBuiltinESMExports();
  try {
    for(const row of f.report.rows)readReactObservedFamilyPlane(f.repo,f.reference,selectReactNativeRequest(f.repo,f.report,row.id));
    const individual=reads;reads=0;f.read();
    assert(reads<individual,`batch ${reads}, separate ${individual}`);
  } finally {spy.mock.restore();syncBuiltinESMExports();}
});

test('bad second member and missing contextual proof remain refused',t=>{
  const f=fixture(t),saved=structuredClone(f.report.rows[1]);
  f.report.rows[1].matched=false;f.seal();assert.throws(f.read,/react-native-evidence-unavailable/);
  f.report.rows[1]=structuredClone(saved);
  f.report.rows[1].rootMatrix!.contentContextRevision=revisionOf('unproved context');f.seal();
  assert.throws(f.read,/react-native-evidence-unavailable/);
  f.report.rows[1]=structuredClone(saved);f.report.rows[1].propertyMatrix!.rows[0].restored=false;f.seal();
  assert.throws(f.read,/react-family-member-reassembly-changed/);
});

test('source and archive mutations are observed on fresh subsequent calls',t=>{
  const f=fixture(t);f.read();writeFileSync(f.source,f.sourceText+'\n');
  assert.throws(f.read,/react-native-evidence-unavailable/);writeFileSync(f.source,f.sourceText);f.read();
  writeFileSync(path.join(f.dir,'unexpected.json'),'{}');assert.throws(f.read,/react-native-evidence-unavailable/);
  rmSync(path.join(f.dir,'unexpected.json'));f.read();
  const forged=structuredClone(f.report);forged.rows[1].matched=false;
  assert.throws(()=>readReactObservedFamilyMembers(f.repo,f.reference,forged,['first','second']),/react-native-evidence-unavailable/);
});

for(const outer of [false,true])test(`mid-batch archive drift refuses inside=${outer} display snapshot`,t=>{
  const f=fixture(t),target=path.join(f.dir,'first/matrix/0.json'),original=fs.readFileSync;
  let reads=0,changed=false;
  const spy=t.mock.method(fs,'readFileSync',((...args:unknown[])=>{
    const value=(original as Function)(...args);
    // First read belongs to initial inventory; second is the real member read.
    if(String(args[0])===target&&++reads===2){writeFileSync(path.join(f.dir,'mid-phase.json'),'{}');changed=true;}
    return value;
  }) as typeof fs.readFileSync);syncBuiltinESMExports();
  try {
    const run=()=>assert.throws(f.read,/react-native-evidence-unavailable/);
    if(outer)withEvidenceReadSnapshot(run);else run();assert(changed);
  }finally{spy.mock.restore();syncBuiltinESMExports();}
});

test('an earlier display inventory cannot hide a later batch archive mutation',t=>{
  const f=fixture(t);
  withEvidenceReadSnapshot(()=>{
    readReactNativeEvidence(f.repo,f.reference,selectReactNativeRequest(f.repo,f.report,'first'));
    writeFileSync(path.join(f.dir,'after-display.json'),'{}');
    assert.throws(f.read,/react-native-evidence-unavailable/);
  });
});

// Synthetic declaration + existing sealed member fixture. These tests exercise
// real proof readers and journal boundaries, never source/native qualification.
function declaredFamilyFixture(t:test.TestContext) {
  const f=fixture(t),declarationFile=path.join(f.repo,'ds-contracts.react.json');
  const declaration={version:1,source:'Synthetic phase fixture',theme:'Light',fontFamily:'Inter',
    requiredTokens:{'--fixture':'red'},witnessFiles:{'surface.tsx':evidenceSha(f.sourceText)},
    cases:[['first','quiet'],['second','loud']].map(([id,tone],i)=>({id,subject:'Surface',label:id,
      negativeControl:i===0,mount:{module:'./surface.tsx',export:'Surface',props:{tone},children:['Original']},
      witness:{path:['section'],requiredStyles:{display:'inline-flex'}}}))};
  writeFileSync(declarationFile,JSON.stringify(declaration));
  f.reference.cohort=loadReactCohort(f.repo);
  f.reference.files={...f.reference.files,[declarationFile]:evidenceSha(readFileSync(declarationFile))};
  f.reference.runtimeEntryImports=[{specifier:'./surface.tsx',file:f.source}];
  f.reference.runtimeImports=[];f.reference.mountedSourceFiles=[f.source];
  const pin=selectObservedFamily(f.repo,f.reference,f.report,{version:1,kind:'react-observed-one-axis-family',
    axis:'tone',baseCaseId:'first',caseIds:['first','second']});
  const familyRoot:ReactObservedFamilyNativeRequest={version:1,kind:'react-observed-family-draft',
    referenceId:f.reference.id,family:pin,compilation:'current'};
  return {...f,pin,familyRoot,declarationFile,familyDir:path.join(f.repo,'private/react-observed-families',pin.id),
    readFamily:()=>readObservedFamilyEvidence(f.repo,f.reference,pin),
    select:(id='second')=>selectObservedFamilyComparisonCase(f.repo,f.reference,familyRoot,id)};
}

test('one preparation preserves complete family/native evidence and actual member selection',t=>{
  const f=declaredFamilyFixture(t),expected=f.readFamily();
  const native=observedFamilyNativeEvidence(expected,f.familyRoot),selected=f.select();
  withObservedFamilyPreparation(()=>{
    const first=f.readFamily(),second=f.readFamily();
    assert.deepEqual(first,expected);assert.deepEqual(second,expected);
    assert.deepEqual(observedFamilyNativeEvidence(second,f.familyRoot),native);
    assert.deepEqual(f.select(),selected);
    assert.throws(()=>f.select('absent'),/react-family-member-unavailable/);
    assert.throws(()=>observedFamilyNativeEvidence(second,{...f.familyRoot,referenceId:'f'.repeat(64)}),/react-family-request-changed/);
    assert.throws(()=>observedFamilyMember(second,{...selected.rootRequest,matrixRevision:revisionOf('different')}),/react-family-member/);
  });
});

test('one preparation reduces repeated sealed-report reads while returning equal results',t=>{
  const f=declaredFamilyFixture(t),reportFile=path.join(f.dir,'report.json'),original=fs.readFileSync;
  let reads=0;
  const spy=t.mock.method(fs,'readFileSync',((...args:unknown[])=>{
    if(String(args[0])===reportFile)reads++;
    return (original as Function)(...args);
  }) as typeof fs.readFileSync);syncBuiltinESMExports();
  try {
    const separate={family:f.readFamily(),member:f.select()};const ordinary=reads;reads=0;
    const scoped=withObservedFamilyPreparation(()=>({family:f.readFamily(),member:f.select()}));
    assert.deepEqual(scoped,separate);
    assert(reads<ordinary,`scoped ${reads}, independent ${ordinary}`);
    reads=0;withObservedFamilyPreparation(()=>f.readFamily());const onePhase=reads;
    reads=0;withObservedFamilyPreparation(()=>f.readFamily());assert.equal(reads,onePhase,'a later phase must derive again');
    reads=0;withObservedFamilyPreparation(()=>{f.readFamily();withObservedFamilyPreparation(()=>f.readFamily());});
    assert.equal(reads,2*onePhase,'nested phases retain independent derivations');
  }finally{spy.mock.restore();syncBuiltinESMExports();}
});

test('cached copies isolate mutable members while retaining private family authority',t=>{
  const f=declaredFamilyFixture(t);
  withObservedFamilyPreparation(()=>{
    const first=f.readFamily(),expected=structuredClone(first),second=f.readFamily();
    assert.notEqual(first,second);assert.notEqual(first.record,second.record);assert.notEqual(first.planes[0],second.planes[0]);
    second.record.axis.values.push('invented');second.pin.recordSha256='f'.repeat(64);
    second.planes[0].program.files[f.source]='changed';second.planes[0].row.problems.push('changed');
    second.planes[0].captured.tree.style.color='red';
    assert.deepEqual(f.readFamily(),expected);
    assert.deepEqual(observedFamilyFacts(second),expected.record);
    assert.deepEqual(assembleObservedFamily(second),assembleObservedFamily(first));
    assert.throws(()=>observedFamilyFacts(structuredClone(first)),/verified-evidence-required/);
  });
});

test('cached family never accepts changed cohort or runtime-route metadata',t=>{
  const f=declaredFamilyFixture(t),changes:Array<[string,(r:ReactReference)=>void]>=[
    ['id',r=>{r.id='f'.repeat(64);}],['sourceRoot',r=>{r.sourceRoot=path.join(r.sourceRoot,'elsewhere');}],
    ['files',r=>{r.files={...r.files,[f.source]:'f'.repeat(64)};}],
    ['declared',r=>{r.cohort={...r.cohort,declared:false};}],
    ['source',r=>{r.cohort={...r.cohort,source:'different'};}],
    ['theme',r=>{r.cohort={...r.cohort,theme:'different'};}],
    ['cases',r=>{r.cohort={...r.cohort,cases:[]};}],
    ['entry',r=>{r.cohort={...r.cohort,entry:r.cohort.entry+'\n'};}],
    ['declaration',r=>{r.cohort={...r.cohort,declaration:{file:f.declarationFile,sha256:'f'.repeat(64)}};}],
    ['witnessFiles',r=>{r.cohort={...r.cohort,witnessFiles:{}};}],
    ['negativeCaseIds',r=>{r.cohort={...r.cohort,negativeCaseIds:[]};}],
    ['mountedModules',r=>{r.cohort={...r.cohort,mountedModules:[]};}],
    ['mountedExports',r=>{r.cohort={...r.cohort,mountedExports:[]};}],
    ['profile',r=>{const original=r.cohort.profile;r.cohort={...r.cohort,profile:id=>original(id)};}],
    ['witnessSuccession',r=>{r.cohort={...r.cohort,witnessSuccession:{revision:revisionOf('changed'),
      cohortRevision:revisionOf('changed'),referenceFiles:{},evidenceFiles:{}}};}],
    ['runtimeEntryImports',r=>{r.runtimeEntryImports=[{specifier:'./surface.tsx',file:path.join(f.repo,'other.tsx')}];}],
    ['runtimeImports',r=>{r.runtimeImports=[{importer:f.source,specifier:'./other',file:path.join(f.repo,'other.tsx')}];}],
    ['mountedSourceFiles',r=>{r.mountedSourceFiles=[];}],
  ];
  for(const [name,change] of changes){
    const before={...f.reference};
    try {assert.throws(()=>withObservedFamilyPreparation(()=>{f.readFamily();change(f.reference);f.readFamily();}),
      /react-family-preparation-evidence-changed/,name);}
    finally{Object.assign(f.reference,before);}
  }
  assert.deepEqual(f.select().caseId,'second');
});

for(const name of ['record.json','integrity.json'])test(`same-byte ${name} symlink is refused on cached read and scope exit`,t=>{
  const f=declaredFamilyFixture(t),file=path.join(f.familyDir,name),backup=path.join(f.repo,'saved-'+name);
  for(const hit of [true,false]){
    try {assert.throws(()=>withObservedFamilyPreparation(()=>{
      f.readFamily();renameSync(file,backup);symlinkSync(backup,file);if(hit)f.readFamily();
    }),/react-family-record-invalid/);}
    finally{unlinkSync(file);renameSync(backup,file);}
  }
  f.readFamily();
});

test('same-byte family directory symlink is refused on cached read and scope exit',t=>{
  const f=declaredFamilyFixture(t),backup=path.join(f.repo,'saved-family');
  for(const hit of [true,false]){
    try {assert.throws(()=>withObservedFamilyPreparation(()=>{
      f.readFamily();renameSync(f.familyDir,backup);symlinkSync(backup,f.familyDir);if(hit)f.readFamily();
    }),/react-family-directory-invalid/);}
    finally{unlinkSync(f.familyDir);renameSync(backup,f.familyDir);}
  }
  f.readFamily();
});

test('cached family retains maximum size and regular-file guards',t=>{
  const f=declaredFamilyFixture(t);
  for(const name of ['record.json','integrity.json'])for(const kind of ['oversized','directory']){
    const file=path.join(f.familyDir,name),bytes=readFileSync(file);
    try {assert.throws(()=>withObservedFamilyPreparation(()=>{
      f.readFamily();
      if(kind==='oversized')writeFileSync(file,Buffer.alloc(1_000_001));
      else{unlinkSync(file);mkdirSync(file);}
      f.readFamily();
    }),/react-family-record-invalid/,`${name} ${kind}`);}
    finally{rmSync(file,{recursive:true,force:true});writeFileSync(file,bytes);}
  }
  f.readFamily();
});

for(const display of [false,true])test(`source/archive drift refuses on hit and scope exit inside display=${display}`,t=>{
  const f=declaredFamilyFixture(t),extra=path.join(f.dir,'unexpected.json'),report=path.join(f.dir,'report.json'),reportBytes=readFileSync(report);
  for(const what of ['source','archive','archive-bytes'])for(const hit of [true,false]){
    const run=()=>assert.throws(()=>withObservedFamilyPreparation(()=>{
      f.readFamily();if(what==='source')writeFileSync(f.source,f.sourceText+'\n');
      else if(what==='archive-bytes')writeFileSync(report,Buffer.concat([reportBytes,Buffer.from('\n')]));else writeFileSync(extra,'{}');
      if(hit)f.readFamily();
    }),/react-family-preparation-evidence-changed/,`${what}, hit=${hit}`);
    try{if(display)withEvidenceReadSnapshot(run);else run();}
    finally{writeFileSync(f.source,f.sourceText);writeFileSync(report,reportBytes);rmSync(extra,{force:true});}
  }
  f.readFamily();
});

test('separate and nested scopes rederive and failed or asynchronous scopes leave no authority',t=>{
  const f=declaredFamilyFixture(t);
  const expected=withObservedFamilyPreparation(()=>f.readFamily());
  assert.throws(()=>withObservedFamilyPreparation(()=>{f.readFamily();throw Error('deliberate');}),/deliberate/);
  assert.throws(()=>withObservedFamilyPreparation(()=>Promise.resolve(f.readFamily())),/react-family-async-preparation/);
  assert.throws(()=>withObservedFamilyPreparation(()=>{f.readFamily();return {then(){}};}),/react-family-async-preparation/);
  withObservedFamilyPreparation(()=>{
    f.readFamily();const inner=withObservedFamilyPreparation(()=>f.readFamily());assert.deepEqual(inner,expected);
    assert.throws(()=>readObservedFamilyEvidence(f.repo,f.reference,{...f.pin,recordSha256:'f'.repeat(64)}),/react-family-record-changed/);
    assert.deepEqual(f.readFamily(),expected);
  });
  writeFileSync(f.source,f.sourceText+'\n');
  assert.throws(()=>withObservedFamilyPreparation(()=>f.readFamily()),/react-family-selection-invalid|react-native-evidence-unavailable/);
  writeFileSync(f.source,f.sourceText);assert.deepEqual(withObservedFamilyPreparation(()=>f.readFamily()),expected);
});

test('comparison journal preparation stays fresh after scoped parent/member reads',async t=>{
  const f=declaredFamilyFixture(t),native=await nativeComparisonFixture(REACT_NATIVE_FILE_KEY);
  const content:ObservedContentDraft={version:1,status:'compiled-comparison-draft',qualification:'observed-comparison-content-only',
    acceptedContract:null,nativeQualification:'unqualified',inputRevision:revisionOf('synthetic observations'),
    treeRevision:revisionOf('synthetic tree'),fontsRevision:revisionOf('synthetic fonts'),contract:native.content,
    tokens:native.tokens,assets:native.assets,component:native.engine.compileComponentData(native.content,new Map([[native.content.id,native.content]])),
    receipts:[],residuals:[],problems:[],limitations:['synthetic-journal-boundary-only']};
  const request:ReactComparisonRequest={version:5,kind:'react-content-comparison',familyRoot:f.familyRoot,
    parentOperationId:native.comparison.parent.operation.id,root:f.select().rootRequest,
    content:{id:'10000000-0000-4000-8000-000000000011',reportSha256:'d'.repeat(64),inventorySha256:'e'.repeat(64)}};
  let changeBeforeReturn=false;
  const jobs=createNativeOperationJobs(f.repo,{prepare:()=>{throw Error('unexpected source adapter');},reactComparison:{
    prepare:(selected,operation)=>{
      assert.deepEqual(selected,request);f.readFamily();assert.deepEqual(f.select().rootRequest,request.root);
      const plan=prepareReactComparisonPlan({operation,content,source:native.source,comparison:native.comparison});
      if(changeBeforeReturn)writeFileSync(f.source,f.sourceText+'\n');
      return {visual:{id:request.root.ownership.id,reportSha256:request.root.ownership.sha256},
        preparation:{id:request.content.id,reportSha256:request.content.reportSha256},plan};
    },buildComponent:()=>{throw Error('unexpected native writer');},
  }});
  changeBeforeReturn=true;
  assert.throws(()=>jobs.prepare(request),/react-family-preparation-evidence-changed/);
  assert.equal(jobs.forBaseline(reactComparisonReservation(request)),null,'source drift cannot publish a reservation');
  writeFileSync(f.source,f.sourceText);changeBeforeReturn=false;
  const saved=jobs.prepare(request);assert.equal(saved.sourceCurrent,true);
  const operationDir=path.join(f.repo,'private/source-native-app/operations',saved.id),before=inventoryEvidence(operationDir);
  writeFileSync(f.source,f.sourceText+'\n');
  assert.equal(jobs.get(saved.id).sourceCurrent,false);
  assert.throws(()=>jobs.dispatch(saved.id,'token-create'),/react-family-selection-invalid|react-native-evidence-unavailable/);
  assert.deepEqual(inventoryEvidence(operationDir),before,'refused fresh authorization changes no operation evidence');
  writeFileSync(f.source,f.sourceText);assert.equal(jobs.get(saved.id).sourceCurrent,true);
});
