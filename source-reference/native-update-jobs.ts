/** Updates are children of immutable creation evidence. The existing companion
 * transport delivers these commands; no target allocation or baseline rewrite. */
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { closeSync, existsSync, fsyncSync, lstatSync, mkdirSync, openSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { canonicalJson, revisionOf } from '../core/contract-provenance.js';
import { emitNativeContractUpdateScript, nativeContractUpdateMatches } from '../core/native-contract-update.js';
import { emitNativeContractReadbackScript } from '../core/native-source-observation.js';
import { collectNativeImages } from './native-operation-images.js';
import type { createNativeUpdatePlans } from './native-update-plans.js';
import type { NativeOperationCommand, NativeOperationPhase, NativeOperationResult } from './native-operation-jobs.js';

const UUID = /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/;
const HASH = /^[a-f0-9]{64}$/;
const PHASES = ['update-preflight-readback', 'update-apply', 'update-readback'] as const;
type Phase = typeof PHASES[number];
const sha = (s: string) => createHash('sha256').update(s).digest('hex');
const same = (a: unknown, b: unknown) => canonicalJson(a) === canonicalJson(b);
type Plans = ReturnType<typeof createNativeUpdatePlans>;
type Header = { version: 1; id: string; parentId: string; proposalId: string; planRevision: string;
  scripts: Record<Phase, { script: string; sha256: string }> };
type Entry = { sequence: number; previous: string } & (
  { kind: 'dispatch'; command: NativeOperationCommand; reader?: { version: 1; inputRevision: string } } |
  { kind: 'result'; envelope: NativeOperationResult } |
  { kind: 'abandon-observation'; attemptId: string });
type State = { phase: string; pending?: NativeOperationCommand; wrote: boolean; observation?: unknown; observationScriptSha256?: string; problems: string[] };
function fail(message: string): never { throw Error('native-update-' + message); }
function identity(parentId: string, proposalId: string) {
  if (!UUID.test(parentId) || !HASH.test(proposalId)) fail('identity-invalid');
  const h = sha('native-update:' + parentId + ':' + proposalId);
  return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20,32)}`;
}
function correlate(result: NativeOperationResult, command: NativeOperationCommand) {
  if (!result || !['version','operationId','phase','attemptId','nonce','fileKey','planRevision','scriptSha256']
    .every(k => same((result as any)[k], (command as any)[k]))) fail('result-correlation-invalid');
}
export function createNativeUpdateJobs(repo: string, plans: Plans,
  readers: { readback?: typeof emitNativeContractReadbackScript } = {}) {
  // Host-owned compiler dependency. No request may supply executable code.
  const readback = readers.readback ?? emitNativeContractReadbackScript;
  const root = path.join(repo, 'private', 'source-native-updates');
  const ensure = (dir: string, create = false) => {
    if (!existsSync(dir) && create) mkdirSync(dir, { mode: 0o700 });
    const stat = lstatSync(dir);
    if (!stat.isDirectory() || stat.isSymbolicLink()) fail('directory-invalid');
  };
  const directory = (id: string, create = false) => {
    if (!UUID.test(id)) fail('identity-invalid');
    for (const dir of [path.dirname(root), root, path.join(root,id)]) ensure(dir,create);
    return path.join(root,id);
  };
  const read = (file: string) => {
    const stat = lstatSync(file);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 4*1024*1024) fail('record-invalid');
    return readFileSync(file,'utf8');
  };
  const sync = (dir: string) => { const fd=openSync(dir,'r'); try { fsyncSync(fd); } finally { closeSync(fd); } };
  const write = (file: string, value: unknown) => {
    const data=JSON.stringify(value);
    if (Buffer.byteLength(data)>4*1024*1024) fail('record-too-large');
    const fd=openSync(file,'wx',0o600);
    try { writeFileSync(fd,data); fsyncSync(fd); } finally { closeSync(fd); }
    sync(path.dirname(file));
  };
  const scripts = (record: ReturnType<Plans['saved']>) => {
    const plan=record.update.plan;
    return Object.fromEntries([
      ['update-preflight-readback',emitNativeContractUpdateScript(plan,'apply',true)],
      ['update-apply',emitNativeContractUpdateScript(plan)],
      ['update-readback',readback(plan.after,true)],
    ].map(([key,script])=>[key,{script,sha256:sha(script)}])) as Header['scripts'];
  };
  const load = (id: string) => {
    const dir=directory(id), headerBytes=read(path.join(dir,'operation.json'));
    const header=JSON.parse(headerBytes) as Header;
    if(header.version!==1 || header.id!==id || identity(header.parentId,header.proposalId)!==id) fail('header-invalid');
    const saved=plans.saved(header.parentId,header.proposalId),plan=saved.update.plan;
    if(header.planRevision!==saved.update.revision || PHASES.some(p => typeof header.scripts[p]?.script!=='string' || sha(header.scripts[p].script)!==header.scripts[p].sha256)) fail('plan-changed');
    const eventsDir=path.join(dir,'events'); ensure(eventsDir);
    let previous=sha(headerBytes);
    const state:State={phase:'update-prepared',wrote:false,problems:[]},events:Entry[]=[];
    const attempts=new Set<string>();
    for(const [sequence,file] of readdirSync(eventsDir).sort().entries()) {
      if(file!==`${String(sequence).padStart(8,'0')}.json`) fail('journal-sequence-invalid');
      const bytes=read(path.join(eventsDir,file)),event=JSON.parse(bytes) as Entry;
      if(event.sequence!==sequence || event.previous!==previous) fail('journal-chain-invalid');
      if(event.kind==='dispatch') {
        const c=event.command,p=c.phase as Phase;
        if(state.pending || !PHASES.includes(p) || c.version!==1 || c.kind!=='SOURCE-NATIVE-OPERATION' || c.operationId!==id || c.fileKey!==plan.before.operation.fileKey || c.planRevision!==header.planRevision || !UUID.test(c.attemptId) || !HASH.test(c.nonce) || attempts.has(c.attemptId) || c.readOnly!==(p!=='update-apply')) fail('dispatch-invalid');
        if (event.reader) {
          // New readers append a read-only command to the original chain. They
          // cannot replace preflight/write programs or change the pinned input.
          if (p !== 'update-readback' || !state.wrote || event.reader.version !== 1 ||
              event.reader.inputRevision !== revisionOf(plan.after) || typeof c.script !== 'string' ||
              sha(c.script) !== c.scriptSha256) fail('reader-dispatch-invalid');
        } else if (c.script !== header.scripts[p].script || c.scriptSha256 !== header.scripts[p].sha256) fail('dispatch-invalid');
        if(p==='update-apply') {
          if(state.wrote || state.phase!=='update-preflight-observed' || !same(JSON.parse(read(path.join(dir,'apply-claim.json'))),c)) fail('write-precondition-invalid');
          state.wrote=true;
        } else if(p==='update-preflight-readback' ? state.wrote : !state.wrote) fail('readback-precondition-invalid');
        attempts.add(c.attemptId);state.pending=c;state.phase='awaiting-native-result';delete state.observation;delete state.observationScriptSha256;
      } else if(event.kind==='result') {
        if(!state.pending) fail('unsolicited-result');
        correlate(event.envelope,state.pending);
        const r=event.envelope.result as any,p=state.pending.phase;
        state.problems=[];
        if(p==='update-preflight-readback') {
          state.phase=r?.status==='preflight-observed' && nativeContractUpdateMatches(plan,r.observation) ? 'update-preflight-observed' : 'update-refused';
        } else if(p==='update-apply') {
          // Acknowledgement never qualifies success. A separate read observes
          // the actual nodes even after a refused or rolled-back write.
          state.phase='update-applied';
          if(!['updated','no-op'].includes(r?.status)) state.problems=['native-update-write-'+String(r?.status ?? 'unknown')];
        } else {
          state.observation=r;state.observationScriptSha256=state.pending.scriptSha256;
          state.phase=nativeContractUpdateMatches(plan,r,true) ? 'update-verified' : 'update-recovery-required';
        }
        if(['update-refused','update-recovery-required'].includes(state.phase)) state.problems=['native-update-observation-refused'];
        delete state.pending;
      } else if(event.kind==='abandon-observation') {
        if(!state.pending?.readOnly || event.attemptId!==state.pending.attemptId) fail('observation-abandon-refused');
        state.phase=state.wrote?'update-recovery-required':'update-refused';delete state.pending;
      } else fail('event-invalid');
      previous=sha(bytes);events.push(event);
    }
    if(existsSync(path.join(dir,'apply-claim.json'))!==state.wrote) fail('write-journal-incomplete');
    return {id,dir,header,plan,state,events,previous};
  };
  type Loaded=ReturnType<typeof load>;
  const authenticatePlan=(l:Loaded) => {
    const record=plans.current(l.header.parentId,l.header.proposalId);
    if(record.update.revision!==l.header.planRevision) fail('source-or-compiler-changed');
    if(load(l.id).previous!==l.previous) fail('journal-changed');
    return record;
  };
  const authenticate=(l:Loaded) => {
    if (!same(scripts(authenticatePlan(l)),l.header.scripts)) fail('source-or-compiler-changed');
  };
  const authenticateObservation=(l:Loaded) => {
    authenticatePlan(l);
    if (l.state.observationScriptSha256 !== sha(readback(l.plan.after,true))) fail('current-reader-observation-required');
  };
  const append=(l:Loaded,event:Omit<Extract<Entry,{kind:'dispatch'}>,'sequence'|'previous'>|Omit<Extract<Entry,{kind:'result'}>,'sequence'|'previous'>|Omit<Extract<Entry,{kind:'abandon-observation'}>,'sequence'|'previous'>) => {
    if(load(l.id).previous!==l.previous) fail('journal-changed');
    if(event.kind==='dispatch' && event.command.phase==='update-apply') write(path.join(l.dir,'apply-claim.json'),event.command);
    write(path.join(l.dir,'events',`${String(l.events.length).padStart(8,'0')}.json`),{...event,sequence:l.events.length,previous:l.previous});
  };
  const snapshot=(l:Loaded) => {
    let sourceCurrent=false, canRefreshObservation=false;
    try { if(l.state.wrote && l.state.phase==='update-verified') authenticateObservation(l); else authenticate(l); sourceCurrent=true; }
    catch { /* Historical results remain visible. */ }
    if (l.state.wrote && l.state.pending?.phase !== 'update-apply') try { authenticatePlan(l);canRefreshObservation=true; } catch { /* Source drift is not reader drift. */ }
    return {id:l.id,parentId:l.header.parentId,proposalId:l.header.proposalId,phase:l.state.phase,sourceCurrent,canRefreshObservation,
      pendingPhase:l.state.pending?.phase,nativeOutcome:l.state.pending?'unknown' as const:undefined,
      acceptedContract:null,nativeQualification:'unqualified' as const,problems:l.state.problems,
      imageObservation:l.state.observation ? collectNativeImages(l.plan.after,l.state.observation).observation:undefined};
  };
  const get=(id:string)=>snapshot(load(id));
  const dispatch=(id:string,phase:NativeOperationPhase):NativeOperationCommand=>{
    const l=load(id),p=phase as Phase;
    if(l.state.pending || !PHASES.includes(p)) fail('dispatch-refused');
    if(p==='update-apply' ? l.state.wrote || l.state.phase!=='update-preflight-observed' : p==='update-preflight-readback' ? l.state.wrote : !l.state.wrote) fail('phase-refused');
    if(p==='update-apply') authenticate(l);
    let program=l.header.scripts[p],reader:Extract<Entry,{kind:'dispatch'}>['reader'];
    if (p==='update-readback') {
      // A stale source still permits historical read-only recovery, but only a
      // freshly authenticated unchanged plan can select today's reader.
      try {
        authenticatePlan(l);
        const script=readback(l.plan.after,true);
        if(script!==program.script) {program={script,sha256:sha(script)};reader={version:1,inputRevision:revisionOf(l.plan.after)};}
      } catch { /* Deliver the historical reader; it cannot qualify current reuse. */ }
    }
    const command:NativeOperationCommand={version:1,kind:'SOURCE-NATIVE-OPERATION',operationId:id,phase:p,
      attemptId:randomUUID(),nonce:randomBytes(32).toString('hex'),fileKey:l.plan.before.operation.fileKey,
      planRevision:l.header.planRevision,script:program.script,scriptSha256:program.sha256,readOnly:p!=='update-apply'};
    append(l,{kind:'dispatch',command,...(reader?{reader}:{})});return structuredClone(command);
  };
  return {
    get,dispatch,
    verifiedForParent(parentId: string) {
      const written = plans.list(parentId).flatMap(proposal => {
        const id = identity(parentId, proposal.id);
        if (!existsSync(path.join(root, id))) return [];
        const loaded = load(id);
        return loaded.state.wrote ? [loaded] : [];
      });
      if (!written.length) return undefined;
      // A pending, failed or ambiguous correction cannot fall back to the
      // historical creation receipt. It may already have changed the canvas.
      if (written.length !== 1 || written[0].state.phase !== 'update-verified' || written[0].state.pending)
        fail('effective-observation-unavailable');
      const l = written[0]; authenticateObservation(l);
      if (!nativeContractUpdateMatches(l.plan, l.state.observation, true)) fail('effective-observation-invalid');
      const receipt = structuredClone(l.state.observation) as import('../core/native-source-observation.js').NativeSourceReadback;
      delete receipt.images;
      return { input: structuredClone(l.plan.after), receipt };
    },
    has(id:string) { if(!UUID.test(id)) return false;return existsSync(path.join(root,id)); },
    prepare(parentId:string,proposalId:string) {
      const id=identity(parentId,proposalId);
      if(existsSync(path.join(root,id))) return get(id);
      const record=plans.current(parentId,proposalId);
      const header:Header={version:1,id,parentId,proposalId,planRevision:record.update.revision,scripts:scripts(record)};
      if(!same(record,plans.current(parentId,proposalId))) fail('source-changed-during-preparation');
      const dir=directory(id,true);sync(root);ensure(path.join(dir,'events'),true);
      write(path.join(dir,'operation.json'),header);return get(id);
    },
    forProposal(parentId:string,proposalId:string) { const id=identity(parentId,proposalId);return existsSync(path.join(root,id))?get(id):null; },
    deliveryState(id:string) {const l=load(id);return {phase:l.state.phase,pendingPhase:l.state.pending?.phase,fileKey:l.plan.before.operation.fileKey};},
    pendingCommand(id:string) {const l=load(id);if(l.state.pending&&!l.state.pending.readOnly) authenticate(l);return structuredClone(l.state.pending??null);},
    accept(id:string,envelope:NativeOperationResult) {
      const serialized=JSON.stringify(envelope);if(Buffer.byteLength(serialized)>4*1024*1024) fail('result-too-large');
      envelope=JSON.parse(serialized);const l=load(id);
      const prior=l.events.find(e=>e.kind==='result'&&e.envelope.attemptId===envelope?.attemptId);
      if(prior?.kind==='result') {if(!same(prior.envelope,envelope)) fail('result-replay-conflict');return snapshot(l);}
      if(!l.state.pending) fail('unsolicited-result');correlate(envelope,l.state.pending);
      append(l,{kind:'result',envelope});return get(id);
    },
    retryObservation(id:string) {
      let l=load(id);if(l.state.pending&&!l.state.pending.readOnly) fail('write-outcome-unknown');
      const phase=l.state.pending?.phase ?? (l.state.wrote?'update-readback':'update-preflight-readback');
      if(l.state.pending) {append(l,{kind:'abandon-observation',attemptId:l.state.pending.attemptId});l=load(id);}
      return dispatch(id,phase);
    },
    abandonedObservationPhase(id:string,attemptId:string):NativeOperationPhase|null {
      const l=load(id);if(!l.events.some(e=>e.kind==='abandon-observation'&&e.attemptId===attemptId)) return null;
      const e=l.events.find(e=>e.kind==='dispatch'&&e.command.attemptId===attemptId);
      return e?.kind==='dispatch'&&e.command.readOnly?e.command.phase:null;
    },
    image(id:string,hash:string) {if(!HASH.test(hash)) fail('image-request-invalid');const l=load(id),data=collectNativeImages(l.plan.after,l.state.observation).bytes.get(hash);if(!data) fail('image-unavailable');return Buffer.from(data);},
  };
}
