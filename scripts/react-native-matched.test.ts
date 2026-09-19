import test from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { PNG } from 'pngjs';
import { MATCHED_EVIDENCE, checkMatchedEvidence, scoreMatchedEvidence, type MatchedManifest } from './react-native-matched-check.js';
import { authenticateMatchedOperation, normalizeMatchedReadback } from './react-native-matched-record.js';
import { REPO, sha256 } from './react-native-fidelity-check.js';
import type { MatchedSpec } from './react-native-matched-record.js';
import { hasRecordedNativeMeasurement, readRecordedNativeMeasurement, assertMatchedManifestBinding } from '../source-reference/matched-native-review.js';
import type { ReactInitialNativeRequest } from '../source-reference/react-initial-native-request.js';

const evidence = path.join(REPO, MATCHED_EVIDENCE);
const manifest = (): MatchedManifest => JSON.parse(readFileSync(path.join(evidence, 'manifest.json'), 'utf8'));
const temp = (fn: (dir: string) => void) => {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'matched-native-'));
  try { fn(dir); } finally { rmSync(dir, { recursive: true, force: true }); }
};
test('new matched frames recompute on both backgrounds while historical evidence stays separate', () => {
  const result = checkMatchedEvidence(evidence);
  assert.equal(result.rows.length, 9);
  assert(result.rows.every(r => r.pass && r.scores.length === 2));
});
test('application review refuses another operation, source case or observation before reading private evidence', () => {
  const m = manifest(), operationId = String(m.cohort.native.operationId);
  const request = { kind: 'react-initial-draft', version: 1, caseId: m.cohort.source.caseId,
    anchor: { referenceId: m.cohort.source.referenceId }, observation: { id: m.cohort.source.inspectionId,
      reportSha256: m.cohort.source.reportSha256, inventorySha256: m.cohort.source.inventorySha256 } } as ReactInitialNativeRequest;
  assert(hasRecordedNativeMeasurement(REPO, operationId, request.anchor.referenceId));
  assert(!hasRecordedNativeMeasurement(REPO, 'wrong-operation', request.anchor.referenceId));
  assert.throws(() => readRecordedNativeMeasurement(REPO, 'wrong-operation', request), /operation-mismatch/);
  for (const changed of [{ ...request, caseId: 'other-case' },
    { ...request, anchor: { ...request.anchor, referenceId: '0'.repeat(64) } },
    { ...request, observation: { ...request.observation, reportSha256: '0'.repeat(64) } },
    { ...request, observation: { ...request.observation, inventorySha256: '0'.repeat(64) } },
  ]) assert.throws(() => readRecordedNativeMeasurement(REPO, operationId, changed), /operation-mismatch/);
});
test('geometry guards reject low-contrast one-pixel movement even with unchanged passing pixels', () => {
  for (const change of [
    (m: MatchedManifest) => { m.rows[0]!.native.rootPosition.x += 1; },
    (m: MatchedManifest) => { m.rows[0]!.native.rootSize.height = Math.fround(18.3906); },
    (m: MatchedManifest) => { m.rows[0]!.native.cloneSnapshotSha256 = '0'.repeat(64); },
  ]) {
    const m = manifest(); change(m);
    assert.throws(() => scoreMatchedEvidence(evidence, m), /geometry-changed/);
  }
});
test('coverage, producer identity and capture spans cannot silently change', () => {
  const m = manifest(); m.rows.pop(); assert.throws(() => scoreMatchedEvidence(evidence, m), /denominator/);
  const instrument = manifest(); instrument.instruments['source-reference/transparent-source-frame.ts'] = '0'.repeat(64);
  assert.throws(() => scoreMatchedEvidence(evidence, instrument), /instrument-changed/);
  const span = manifest(); span.rows[0]!.native.frameBounds.width += 1;
  assert.throws(() => scoreMatchedEvidence(evidence, span), /native-frame-invalid/);
});
test('stale PNGs, sibling contribution and native paint touching a crop edge fail independently of the pixel score', () => temp(dir => {
  cpSync(evidence, dir, { recursive: true });
  const mutateImage = (side: 'context' | 'native', x: number, y: number) => {
    const m = manifest(), file = path.join(dir, '0.' + side + '.png'), png = PNG.sync.read(readFileSync(file));
    png.data.set([255, 0, 0, 255], (y * png.width + x) * 4);
    const data = PNG.sync.write(png); writeFileSync(file, data);
    return { m, hash: sha256(data) };
  };
  const context = mutateImage('context', 40, 40);
  assert.throws(() => scoreMatchedEvidence(dir, context.m), /image-changed/);
  context.m.rows[0]!.files.context = context.hash; context.m.rows[0]!.source.contextSha256 = context.hash;
  assert.throws(() => scoreMatchedEvidence(dir, context.m), /source-context-changed/);
  cpSync(path.join(evidence, '0.context.png'), path.join(dir, '0.context.png'));
  const native = mutateImage('native', 0, 0); native.m.rows[0]!.files.native = native.hash;
  assert.throws(() => scoreMatchedEvidence(dir, native.m), /paint-outside-frame:native/);
}));

function fixture(dir: string) {
  const put = (name: string, value: unknown) => {
    const file = path.join(dir, name); mkdirSync(path.dirname(file), { recursive: true });
    const bytes = Buffer.isBuffer(value) ? value : Buffer.from(JSON.stringify(value) + '\n');
    writeFileSync(file, bytes); return bytes;
  };
  const op = 'source-native-app/operations/probe', inspection = 'react-initial-inspections/probe/inspection';
  const png = PNG.sync.write(new PNG({ width: 30, height: 30 }));
  const request = { version: 1, anchor: { referenceId: 'reference' }, caseId: 'case' };
  const report = { phase: 'complete', sourceUnchanged: true, problems: [], observation: { rows: [
    { id: '0', status: 'observed', image: sha256(png), changes: { enabled: { kind: 'set', value: false } } },
  ] } };
  const state = { image: sha256(png), bounds: { x: 10, y: 10, width: 5, height: 5 } };
  const inputs = { 'request.json': request, 'report.json': report, 'states/0.json': state, 'states/0.png': png };
  const files = Object.fromEntries(Object.entries(inputs).map(([name, value]) => [name, sha256(put(inspection + '/' + name, value))]));
  const pin = { id: 'inspection', inventorySha256: sha256(put(inspection + '/integrity.json', { version: 1, files })), reportSha256: files['report.json'] };
  const plan = put(op + '/plan.json', {}), script = put(op + '/token-create.js', Buffer.from('creation'));
  const header = put(op + '/operation.json', { id: 'probe', policy: { fileKey: 'file' }, planRevision: 'revision', planSha256: sha256(plan),
    tokenScriptSha256: sha256(script), request: { ...request, kind: 'react-initial-draft', observation: pin } });
  const command = { operationId: 'probe', fileKey: 'file', planRevision: 'revision', attemptId: 'attempt', nonce: 'nonce', phase: 'component-readback', readOnly: true, script: 'read', scriptSha256: sha256('read') };
  const dispatch = put(op + '/events/00000000.json', { sequence: 0, previousSha256: sha256(header), kind: 'dispatch', command });
  put(op + '/events/00000001.json', { sequence: 1, previousSha256: sha256(dispatch), kind: 'result', envelope: { ...command,
    result: { status: 'native-readback-collected', receiptKind: 'independent-native-component-readback', operationId: 'probe', fileKey: 'file',
      planRevision: 'revision', nativeQualification: 'unqualified', acceptedContract: null, problems: [], images: [{ caseId: 'variant:enabled=false', nodeId: 'main' }] } } });
  const spec: MatchedSpec = { id: 'cohort', component: 'Component', description: 'probe', operation: 'probe', journal: op,
    event: '00000001.json', source: { kind: 'initial', inspection } };
  return { spec, put, op, inspection };
}
test('source/native pairing authenticates journals without inventing origins for old unframed exports', () => temp(dir => {
  const f = fixture(dir), result = authenticateMatchedOperation(dir, f.spec);
  assert.equal(result.pairs.length, 1); assert.equal(result.pairs[0].native.nodeId, 'main');
  f.put(f.inspection + '/states/0.png', Buffer.from('substituted'));
  assert.throws(() => authenticateMatchedOperation(dir, f.spec), /source-changed/);
}));
test('changed plan, script hash, result identity and source pairing are refused', () => {
  for (const [kind, reason] of [ ['plan', /plan-changed/], ['script', /command-changed/], ['result', /result-uncorrelated/], ['pair', /variant-pairing/] ] as const) temp(dir => {
    const f = fixture(dir);
    if (kind === 'plan') f.put(f.op + '/plan.json', { changed: true });
    else {
      const name = kind === 'script' ? '00000000.json' : '00000001.json', file = path.join(dir, f.op, 'events', name);
      const e = JSON.parse(readFileSync(file, 'utf8'));
      if (kind === 'script') e.command.script = 'changed';
      if (kind === 'result') e.envelope.nonce = 'wrong';
      if (kind === 'pair') e.envelope.result.images[0].caseId = 'variant:enabled=true';
      f.put(f.op + '/events/' + name, e);
    }
    assert.throws(() => authenticateMatchedOperation(dir, f.spec), reason);
  });
});

function comparisonFixture(dir: string) {
  const put = (name: string, value: unknown) => {
    const file = path.join(dir, name); mkdirSync(path.dirname(file), {recursive:true});
    const data = Buffer.isBuffer(value) ? value : Buffer.from(JSON.stringify(value)+'\n');
    writeFileSync(file,data); return data;
  };
  const op='source-native-app/operations/composed', archive='react-source-ownership/reference/owner';
  const png=PNG.sync.write(new PNG({width:30,height:30})), imageHash=sha256(png);
  const report={id:'owner',referenceId:'reference',state:'complete',rows:[{id:'content',matched:true,problems:[],sourceImage:imageHash,observedImage:imageHash}]};
  const inputs={'report.json':report,'content/source.png':png,'content/source-tree.json':{status:'captured',sourcePngSha256:imageHash}};
  const files=Object.fromEntries(Object.entries(inputs).map(([k,v])=>[k,sha256(put(archive+'/'+k,v))]));
  const inventorySha256=sha256(put(archive+'/integrity.json',{version:1,files}));
  const root={kind:'react-root-draft',referenceId:'reference',caseId:'content',ownership:{id:'owner',sha256:files['report.json']},inventorySha256};
  const plan=put(op+'/plan.json',{}),script=put(op+'/token-create.js',Buffer.from('creation'));
  const header={id:'composed',policy:{fileKey:'file'},planRevision:'revision',planSha256:sha256(plan),tokenScriptSha256:sha256(script),request:{kind:'react-content-comparison',root}};
  const creation={status:'created-candidate',operationId:'composed',fileKey:'file',problems:[],comparisonBoardId:'board'};
  const board={id:'board',type:'FRAME',childIds:['child'],values:{x:0,y:0,width:5,height:5,relativeTransform:[[1,0,0],[0,1,0]],fills:[],strokes:[],effects:[],opacity:1,visible:true,layoutMode:'VERTICAL',clipsContent:false,paddingTop:0,paddingBottom:0,paddingLeft:0,paddingRight:0,itemSpacing:0,cornerRadius:0}};
  const child={id:'child',type:'INSTANCE',parentId:'board',values:{x:0,y:0,width:5,height:5,relativeTransform:[[1,0,0],[0,1,0]]}};
  const common={operationId:'composed',fileKey:'file',planRevision:'revision',nativeQualification:'unqualified',acceptedContract:null,problems:[]};
  const readback={...common,status:'native-comparison-readback-collected',content:{...common,status:'native-readback-collected',receiptKind:'independent-native-component-readback',nodes:[board,child],images:[{nodeId:'child'}]}};
  const save=()=>{
    let previous=sha256(put(op+'/operation.json',header));let sequence=0;
    for(const [phase,result] of [['component-create',creation],['component-readback',readback]] as const){
      const command={...common,attemptId:phase,nonce:phase,phase,readOnly:phase==='component-readback',script:phase,scriptSha256:sha256(phase)};
      for(const value of [{kind:'dispatch',command},{kind:'result',envelope:{...command,result}}]){
        previous=sha256(put(op+'/events/'+String(sequence).padStart(8,'0')+'.json',{sequence,previousSha256:previous,...value}));sequence++;
      }
    }
  };save();
  const spec={id:'sample',component:'Composed',description:'fixture',operation:'composed',journal:op,event:'00000003.json',source:{kind:'comparison' as const,bounds:{x:10,y:10,width:5,height:5}}};
  return {put,save,archive,spec,board,child,readback,header};
}
test('caller content pairs its sealed original only with the authenticated neutral presentation frame',()=>temp(dir=>{
  const f=comparisonFixture(dir),r=authenticateMatchedOperation(dir,f.spec);
  assert.equal(r.pairs.length,1);assert.equal(r.pairs[0]!.native.nodeId,'board');
  assert.equal(r.source.caseId,'content');
  f.put(f.archive+'/content/source.png',Buffer.from('changed'));
  assert.throws(()=>authenticateMatchedOperation(dir,f.spec),/source-changed/);
}));
test('caller-content measurement refuses shifted roots, painted or clipped wrappers, changed ownership and unrelated images',()=>{
  for(const mutate of [
    (f:ReturnType<typeof comparisonFixture>)=>{f.child.values.x=1;},
    (f:ReturnType<typeof comparisonFixture>)=>{f.child.values.relativeTransform[0]![0]=-1;},
    (f:ReturnType<typeof comparisonFixture>)=>{f.board.values.opacity=.5;},
    (f:ReturnType<typeof comparisonFixture>)=>{f.board.values.clipsContent=true;},
    (f:ReturnType<typeof comparisonFixture>)=>{f.board.values.paddingLeft=1;},
    (f:ReturnType<typeof comparisonFixture>)=>{f.board.childIds.push('unrelated');},
    (f:ReturnType<typeof comparisonFixture>)=>{f.readback.content.images[0]!.nodeId='unrelated';},
    (f:ReturnType<typeof comparisonFixture>)=>{f.header.request.root.ownership.sha256='0'.repeat(64);},
  ])temp(dir=>{const f=comparisonFixture(dir);mutate(f);f.save();assert.throws(()=>authenticateMatchedOperation(dir,f.spec),/matched-record-/);});
});


test('recorded image identities must match authenticated source-to-native pairs', () => {
  const m=manifest(), pairs=m.rows.map(r=>({observation:r.id,variant:r.variant,native:{nodeId:r.native.originalId},source:{originalSha256:r.source.originalSha256,bounds:r.source.bounds,crop:r.source.crop}}));
  assert.doesNotThrow(()=>assertMatchedManifestBinding(m,pairs));
  for(const mutate of [
    (p:typeof pairs)=>{p.pop();},
    (p:typeof pairs)=>{p[0]!.native.nodeId='another-node';},
    (p:typeof pairs)=>{p[0]!.variant='another-state';},
    (p:typeof pairs)=>{p[0]!.source.originalSha256='0'.repeat(64);},
    (p:typeof pairs)=>{p[0]!.source.bounds.x+=1;},
  ]){const changed=structuredClone(pairs);mutate(changed);assert.throws(()=>assertMatchedManifestBinding(m,changed),/pairing-mismatch/);}
});
test('settled slot IDs resolve by durable ownership and topology while property changes stay visible',()=>{
  const creation={nodes:[{id:'slot',type:'SLOT'},{id:'text',type:'TEXT',slotIdentity:{slotId:'slot',path:[0]}}],comparisons:[{status:'created-comparison',slots:[{nodeId:'slot'}]}]};
  const anchor={content:{nodes:[{id:'slot',type:'SLOT',parentId:'root',childIds:['text'],metadata:{}},{id:'text',type:'TEXT',parentId:'slot',childIds:[],metadata:{nativeSourceAllocation:'text'},values:{characters:'Original'}}]}};
  const live=structuredClone(anchor);live.content.nodes[0]!.childIds=['slot;settled'];live.content.nodes[1]!.id='slot;settled';
  assert.deepEqual(normalizeMatchedReadback(creation,anchor,live,'comparison'),anchor);
  const forged=structuredClone(live);forged.content.nodes[1]!.metadata.nativeSourceAllocation='foreign';
  assert.throws(()=>normalizeMatchedReadback(creation,anchor,forged,'comparison'),/slot-identity-invalid/);
  const changed=structuredClone(live);changed.content.nodes[1]!.values!.characters='Changed';
  assert.notDeepEqual(normalizeMatchedReadback(creation,anchor,changed,'comparison'),anchor);
});

test('caller-content evidence stays a separate one-pair denominator and ambiguous app catalog entries refuse',()=>{
  const dir=path.join(REPO,'recipe/evidence/react-native-matched-content');
  const r=checkMatchedEvidence(dir);assert.equal(r.rows.length,1);assert(r.rows.every(row=>row.pass));
  const m=JSON.parse(readFileSync(path.join(dir,'manifest.json'),'utf8')) as MatchedManifest;
  const request={kind:'react-root-draft',version:1,referenceId:m.cohort.source.referenceId,caseId:'another-case',ownership:{id:m.cohort.source.ownershipId,sha256:m.cohort.source.reportSha256},inventorySha256:m.cohort.source.inventorySha256} as import('../source-reference/react-native-request.js').ReactNativeRequest;
  assert.throws(()=>readRecordedNativeMeasurement(REPO,String(m.cohort.native.operationId),request),/operation-mismatch/);
  temp(repo=>{
    for(const relative of [MATCHED_EVIDENCE,'recipe/evidence/react-native-matched-content']){
      mkdirSync(path.join(repo,relative),{recursive:true});writeFileSync(path.join(repo,relative,'manifest.json'),JSON.stringify(m));
    }
    assert(!hasRecordedNativeMeasurement(repo,String(m.cohort.native.operationId),String(m.cohort.source.referenceId)));
    assert.throws(()=>readRecordedNativeMeasurement(repo,String(m.cohort.native.operationId),{...request,caseId:String(m.cohort.source.caseId)}),/operation-mismatch/);
  });
});
