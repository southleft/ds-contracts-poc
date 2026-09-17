import {mkdtempSync,rmSync,readFileSync,readdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import {buildSync} from 'esbuild';
import {createNativeOperationJobs,REACT_NATIVE_FILE_KEY,type NativeOperationJobsOptions} from '../source-reference/native-operation-jobs.js';
import {prepareReactComparisonPlan,buildReactComparisonWrite} from '../source-reference/react-comparison-plan.js';
import type {ReactComparisonRequest} from '../source-reference/react-comparison-request.js';
import type {ObservedContentDraft} from '../source-reference/observed-content.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {nativeOwnedComparisonFixture} from './native-owned-comparison-test-fixture.js';
import {emitNativeContractComparisonReadbackScript,verifyNativeContractComparisonReadback} from './native-contract-comparison-observation.js';
import {prepareNativeComparisonFrameRepair,prepareNativeComparisonRepair,emitNativeComparisonRepairScript,nativeComparisonRepairMatches} from './native-comparison-repair.js';
import {revisionOf,canonicalJson} from './contract-provenance.js';
import {resolveNativeSlotIdentities} from './native-slot-identity.js';

async function fixture(){
 const f=await nativeOwnedComparisonFixture(true,true),creation=await f.run(f.emit());
 assert.equal(creation.status,'created-candidate',JSON.stringify(creation));
 const input={operation:f.supplemental.operation,planRevision:revisionOf('repair comparison'),comparison:f.comparison,
  tokenInput:f.supplemental.tokens.input,tokenIdentity:f.supplemental.tokens.identity,creation};
 const read=()=>f.run(emitNativeContractComparisonReadbackScript(input));
 assert.equal(verifyNativeContractComparisonReadback(input,await read()).status,'supported-comparison-structure-observed');
 const record=creation.comparisons[0].nested[0],root=await f.figma.getNodeByIdAsync(record.instanceId),vector=root.findOne((n:any)=>n.type==='VECTOR');
 root.setBoundVariable('height',null);root.layoutSizingVertical='FILL';
 vector.setExplicitVariableModeForCollection(await f.figma.variables.getVariableCollectionByIdAsync(f.parent.tokenIdentity.collection.id),f.parent.tokenIdentity.modes[0].modeId);
 const before=await read(),plan=prepareNativeComparisonRepair(input,before);
 return {...f,input,read,root,vector,before,plan};
}
test('linked-instance correction restores height binding and descendant modes without allocations, then is a verified no-op',async()=>{
 const f=await fixture(),count=f.figma.root.findAll(()=>true).length;
 assert.deepEqual(f.plan.changes.map(c=>c.kind),['height','mode']);
 const preflight=await f.run(emitNativeComparisonRepairScript(f.plan,true));assert.equal(preflight.status,'preflight-observed');
 assert(nativeComparisonRepairMatches(f.plan,preflight.observation));
 const script=emitNativeComparisonRepairScript(f.plan),result=await f.run(script);
 assert.equal(result.status,'updated',JSON.stringify(result));
 assert(nativeComparisonRepairMatches(f.plan,await f.read(),true));
 assert.equal((await f.run(script)).status,'no-op');
 assert.equal(f.figma.root.findAll(()=>true).length,count);
});
test('repair resolves settled slot IDs through unchanged allocation, topology and properties',async()=>{
 const f=await fixture(),oldRootId=f.root.id;
 for(const row of f.input.creation.nodes.filter((n:any)=>n.slotIdentity)){
   const node=await f.figma.getNodeByIdAsync(row.id);
   node.id=`${row.slotIdentity.slotId};settled-${row.id}`;
 }
 assert.equal(await f.figma.getNodeByIdAsync(oldRootId),null);
 const settled=await f.read();assert(nativeComparisonRepairMatches(f.plan,settled));
 const script=emitNativeComparisonRepairScript(f.plan),result=await f.run(script);
 assert.equal(result.status,'updated',JSON.stringify(result.problems));
 assert(result.changes.includes(f.root.id));assert(!result.changes.includes(oldRootId));
 assert(nativeComparisonRepairMatches(f.plan,await f.read(),true));
 assert.equal((await f.run(script)).status,'no-op');
 const forged=structuredClone(settled);
 forged.content.nodes.find((n:any)=>n.id===f.root.id).metadata.nativeSourceAllocation='forged';
 assert.equal(nativeComparisonRepairMatches(f.plan,forged),false);
 f.root.setSharedPluginData('ds_contracts','nativeSourceAllocation','forged');
 const refused=await f.run(script);assert.equal(refused.status,'refused');assert.deepEqual(refused.changes,[]);
});
test('slot identity runtime remains self-contained after bundling and minification',async()=>{
 const f=await fixture(),module={exports:{} as any};
 const built=buildSync({entryPoints:['core/native-slot-identity.ts'],bundle:true,write:false,format:'cjs',platform:'node',minify:true});
 vm.runInNewContext(built.outputFiles[0].text,{module,exports:module.exports,require:createRequire(import.meta.url)});
 const resolve=new Function('canonicalJson',module.exports.nativeSlotIdentityRuntime()+';return resolveNativeSlotIdentities;')(canonicalJson);
 assert.deepEqual(resolve(f.input.creation,f.before.content.nodes),resolveNativeSlotIdentities(f.input.creation,f.before.content.nodes));
});
test('unrelated style, source, geometry and identity changes cannot become correction authority',async()=>{
 const f=await fixture();
 for(const change of [
  (r:any)=>{r.content.nodes.find((n:any)=>n.id===f.root.id).values.opacity=.5;},
  (r:any)=>{r.content.nodes.find((n:any)=>n.type==='VECTOR').values.x+=1;},
  (r:any)=>{r.parent.nodes[0].name='changed';},
  (r:any)=>{r.content.nodes.find((n:any)=>n.id===f.root.id).mainId='replacement';},
 ]){const r=structuredClone(f.before);change(r);assert.throws(()=>prepareNativeComparisonRepair(f.input,r));}
 const script=emitNativeComparisonRepairScript(f.plan);f.root.opacity=.5;
 const result=await f.run(script);assert.equal(result.status,'refused');assert.deepEqual(result.changes,[]);
});
test('assignment failure rolls back corrected channels and verifies the original baseline',async()=>{
 const f=await fixture(),clear=f.vector.clearExplicitVariableModeForCollection.bind(f.vector);
 f.vector.clearExplicitVariableModeForCollection=()=>{throw Error('simulated setter failure')};
 const result=await f.run(emitNativeComparisonRepairScript(f.plan));
 assert.equal(result.status,'rolled-back',JSON.stringify(result));
 assert.deepEqual(await f.read(),f.before);
 f.vector.clearExplicitVariableModeForCollection=clear;
});

test('zero-weight parent paint reaches style verification, while nonzero or unknown widths refuse layout repair',async()=>{
 const f=await fixture(),receipt=structuredClone(f.before);
 const root=receipt.content.nodes.find((n:any)=>n.id===f.root.id);
 const host=receipt.content.nodes.find((n:any)=>n.id===root.parentId);
 host.values.strokes=[{type:'SOLID',color:{r:0,g:0,b:0}}];
 host.values.strokeTopWeight=0;host.values.strokeBottomWeight=0;
 // Paint alone does not affect this layout, but it remains an unrelated style
 // edit: the final verifier must still reject it against the saved source.
 assert.throws(()=>prepareNativeComparisonRepair(f.input,receipt),/unrelated-differences/);
 for(const weight of [1,null,undefined]){
   host.values.strokeTopWeight=weight;
   assert.throws(()=>prepareNativeComparisonRepair(f.input,receipt),/height-context-unqualified/);
 }
});

test('app journal repairs once and independently verifies while retaining creation and failed readback',async t=>{
 const f=await nativeOwnedComparisonFixture(true,true,REACT_NATIVE_FILE_KEY),repo=mkdtempSync(path.join(tmpdir(),'comparison-repair-'));
 t.after(()=>rmSync(repo,{recursive:true,force:true}));
 const legacy=(built:{script:string;planRevision:string})=>({...built,script:built.script
   .replaceAll('board.clipsContent = false;','board.topLeftRadius=board.topRightRadius=board.bottomLeftRadius=board.bottomRightRadius=0;')
   .replaceAll('child.nativeContractSample?.instance === undefined &&','')
   .replace("if (c.contentMode !== 'source-owned' || Object.hasOwn(source.explicitVariableModes || {}, parentCollection.id)) ",'')
   .replaceAll("childNode.layoutSizingVertical = 'FILL';", "if(childNode.type==='INSTANCE')childNode.setBoundVariable('height',null);childNode.layoutSizingVertical = 'FILL';")});
  const content: ObservedContentDraft = { version: 1, status: 'compiled-comparison-draft', qualification: 'observed-comparison-content-only',
    acceptedContract: null, nativeQualification: 'unqualified', inputRevision: revisionOf('observations'), treeRevision: revisionOf('tree'), fontsRevision: revisionOf('fonts'),
    contract: f.content, tokens: f.tokens, assets: f.assets, component: f.engine.compileComponentData(f.content, new Map([[f.content.id, f.content]])),
    receipts: [], residuals: [], problems: [], limitations: ['synthetic-test-only'] };
  const request: ReactComparisonRequest = { version: 1, kind: 'react-content-comparison', parentOperationId: f.selected.parent.operation.id,
    root: { version: 1, kind: 'react-root-draft', referenceId: 'a'.repeat(64), ownership: { id: '10000000-0000-4000-8000-000000000010', sha256: 'b'.repeat(64) },
      inventorySha256: 'c'.repeat(64), caseId: 'sample', matrixRevision: revisionOf('matrix') },
    content: { id: '10000000-0000-4000-8000-000000000011', reportSha256: 'd'.repeat(64), inventorySha256: 'e'.repeat(64) } };
  let current = true;
  const options: NativeOperationJobsOptions = { prepare: () => { throw Error('unexpected source adapter'); }, reactComparison: {
    prepare: (selected, operation) => {
      assert.deepEqual(selected, request); if (!current) throw Error('source changed');
      return { visual: { id: request.root.ownership.id, reportSha256: request.root.ownership.sha256 },
        preparation: { id: request.content.id, reportSha256: request.content.reportSha256 },
        plan: prepareReactComparisonPlan({ operation, content, source: f.source, comparison: f.selected }) };
    },
    buildComponent: (_, context) => legacy(buildReactComparisonWrite({ operation: context.operation, content, source: f.source,
      comparison: f.selected, expectedPlanRevision: context.planRevision, tokens: context.tokens })),
  } };

 let jobs=createNativeOperationJobs(repo,options);const saved=jobs.prepare(request);
 const run=async(phase:Parameters<typeof jobs.dispatch>[1])=>{
   const command=jobs.dispatch(saved.id,phase),{script,kind:_kind,readOnly:_readOnly,...identity}=command,result=await f.run(script);
   jobs.accept(saved.id,{...identity,result});jobs=createNativeOperationJobs(repo,options);return command;
 };
 for(const phase of ['token-create','token-readback','component-create','component-readback'] as const)await run(phase);
 assert.equal(jobs.get(saved.id).phase,'component-observation-refused');assert.equal(jobs.get(saved.id).comparisonRepair?.changes.length,2);
 const events=path.join(repo,'private/source-native-app/operations',saved.id,'events');
 const originals=readdirSync(events).map(name=>[name,readFileSync(path.join(events,name),'utf8')] as const);
 await run('comparison-repair-preflight-readback');assert.equal(jobs.get(saved.id).phase,'comparison-repair-observed');
 current=false;assert.throws(()=>jobs.dispatch(saved.id,'comparison-repair-apply'));current=true;
 const write=jobs.dispatch(saved.id,'comparison-repair-apply'),{script,kind:_kind,readOnly:_readOnly,...identity}=write,result=await f.run(script);
 assert.equal(result.status,'updated',JSON.stringify(result));
 jobs=createNativeOperationJobs(repo,options);assert.throws(()=>jobs.dispatch(saved.id,'comparison-repair-apply'));assert.throws(()=>jobs.retryObservation(saved.id));
 jobs.accept(saved.id,{...identity,result});await run('component-readback');
 assert.equal(jobs.get(saved.id).phase,'component-structure-observed');assert.equal(jobs.get(saved.id).comparisonRepair?.changes[0].kind,'comparison-clipping');
 for(const [name,bytes] of originals)assert.equal(readFileSync(path.join(events,name),'utf8'),bytes);
 assert.equal(readdirSync(events).map(n=>JSON.parse(readFileSync(path.join(events,n),'utf8'))).filter(e=>e.kind==='dispatch'&&e.command.phase==='comparison-repair-apply').length,1);
 const oldClaim=readFileSync(path.join(events,'../comparison-repair.json'),'utf8');
 const nodeCount=f.figma.root.findAll(()=>true).length;
 await run('comparison-repair-preflight-readback');
 const frameWrite=jobs.dispatch(saved.id,'comparison-repair-apply'),{script:frameScript,kind:_k,readOnly:_ro,...frameIdentity}=frameWrite;
 jobs=createNativeOperationJobs(repo,options);
 assert.throws(()=>jobs.dispatch(saved.id,'comparison-repair-apply'));
 const frameResult=await f.run(frameScript);assert.equal(frameResult.status,'updated');
 jobs.accept(saved.id,{...frameIdentity,result:frameResult});await run('component-readback');
 assert.equal(jobs.get(saved.id).phase,'component-structure-observed');
 assert.equal(jobs.get(saved.id).comparisonRepair,undefined);
 assert.equal(f.figma.root.findAll(()=>true).length,nodeCount);
 assert.equal(readFileSync(path.join(events,'../comparison-repair.json'),'utf8'),oldClaim);
 assert.equal(readdirSync(path.join(events,'..')).filter(n=>/^comparison-repair-[a-f0-9]{64}\.json$/.test(n)).length,1);
 assert.throws(()=>jobs.dispatch(saved.id,'comparison-repair-apply'));
 await run('component-readback');assert.equal(jobs.get(saved.id).comparisonRepair,undefined);

});

test('rollback preserves an independent edit made after assignment',async()=>{
 const f=await fixture(),clear=f.vector.clearExplicitVariableModeForCollection.bind(f.vector);
 f.vector.clearExplicitVariableModeForCollection=(collection:any)=>{clear(collection);f.root.setBoundVariable('height',null);f.root.resize(f.root.width,99);};
 const result=await f.run(emitNativeComparisonRepairScript(f.plan));
 assert.equal(result.status,'recovery-required',JSON.stringify(result));
 assert(result.unrestored.includes(f.root.id));assert.equal(f.root.height,99);
});

async function frameFixture(){
 const f=await fixture();await f.run(emitNativeComparisonRepairScript(f.plan));
 const board=await f.figma.getNodeByIdAsync(f.input.creation.comparisonBoardId);board.clipsContent=true;
 // Model the native per-corner defaults absent from the minimal API mock.
 board.topLeftRadius=board.topRightRadius=board.bottomLeftRadius=board.bottomRightRadius=0;
 const before=await f.read(),plan=prepareNativeComparisonFrameRepair(f.input,before);
 return {...f,board,before,plan};
}
test('neutral comparison frame correction preserves component clipping, all allocations and repeats without writes',async()=>{
 const f=await frameFixture(),count=f.figma.root.findAll(()=>true).length;
 const instance=await f.figma.getNodeByIdAsync(f.input.creation.comparisons[0].instanceId),clip=instance.clipsContent;
 assert.equal(f.plan.version,2);assert.deepEqual(f.plan.changes,[{nodeId:f.board.id,kind:'comparison-clipping',before:true,after:false}]);
 assert.equal((await f.run(emitNativeComparisonRepairScript(f.plan,true))).status,'preflight-observed');
 const script=emitNativeComparisonRepairScript(f.plan);
 assert.equal((await f.run(script)).status,'updated');assert.equal(f.board.clipsContent,false);assert.equal(instance.clipsContent,clip);
 assert(nativeComparisonRepairMatches(f.plan,await f.read(),true));assert.equal((await f.run(script)).status,'no-op');
 assert.equal(f.figma.root.findAll(()=>true).length,count);
});
test('frame correction rejects styled or edited wrappers and rolls back only its clipping channel',async()=>{
 const f=await frameFixture();
 for(const change of [
  (r:any)=>r.content.nodes.find((n:any)=>n.id===f.board.id).values.paddingLeft=4,
  (r:any)=>r.content.nodes.find((n:any)=>n.id===f.board.id).values.fills=[{type:'SOLID',color:{r:1,g:0,b:0}}],
  (r:any)=>r.content.nodes.find((n:any)=>n.id===f.root.id).values.opacity=.4,
  (r:any)=>r.content.nodes.find((n:any)=>n.id===f.board.id).metadata.nativeSourceAllocation='foreign',
 ]){const r=structuredClone(f.before);change(r);assert.throws(()=>prepareNativeComparisonFrameRepair(f.input,r));}
 let clip=true;
 Object.defineProperty(f.board,'clipsContent',{configurable:true,get:()=>clip,set:value=>{clip=value;if(value===false)throw Error('simulated setter failure')}});
 assert.equal((await f.run(emitNativeComparisonRepairScript(f.plan))).status,'rolled-back');assert.equal(f.board.clipsContent,true);
 Object.defineProperty(f.board,'clipsContent',{configurable:true,get:()=>clip,set:value=>{clip=value;if(value===false)f.board.name='Independent edit'}});
 assert.equal((await f.run(emitNativeComparisonRepairScript(f.plan))).status,'recovery-required');
 assert.equal(f.board.clipsContent,true);assert.equal(f.board.name,'Independent edit');
});
