import assert from 'node:assert/strict';
import test from 'node:test';
import fs, {mkdtempSync,mkdirSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {syncBuiltinESMExports} from 'node:module';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {readReactSourceProgram} from './react-source-program.js';
import {builtinReactCohort} from './react-cohort.js';
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
