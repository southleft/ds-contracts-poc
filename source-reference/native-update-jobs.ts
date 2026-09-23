import {assertOutsideEvidenceSnapshot,evidenceReadOnce,withEvidenceReadSnapshot} from './evidence-read-snapshot.js';
/** Updates are children of immutable creation evidence. The existing companion
 * transport delivers these commands; no target allocation or baseline rewrite. */
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { closeSync, existsSync, fsyncSync, lstatSync, mkdirSync, openSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { storeNativeUpdatePrograms, loadNativeUpdatePrograms } from './native-update-programs.js';
import { canonicalJson, revisionOf } from '../core/contract-provenance.js';
import {emitNativeAppUpdateScript,emitNativeAppUpdateReadback,nativeAppUpdateMatches as nativeContractUpdateMatches,nativeAppUpdateUntouched as nativeContractUpdateUntouched,nativeAppUpdateAfter as nativeContractUpdateAfter,nativeAppUpdatePreflight,nativeAppUpdateMainReadback,nativeAppUpdateDesignChanges} from './native-app-update.js';
import { emitNativeContractReadbackScript, type NativeSourceReadback } from '../core/native-source-observation.js';
import { nativeDesignChanges, type NativeDesignChanges } from '../core/native-design-changes.js';
import { collectNativeImages,collectExpectedNativeImages } from './native-operation-images.js';
import type { createNativeUpdatePlans } from './native-update-plans.js';
import {isReactComparisonParentUpdate,type ReactComparisonBirth,type ReactComparisonParentUpdate} from './react-comparison-request.js';
import type { NativeOperationCommand, NativeOperationPhase, NativeOperationReceipt, NativeOperationResult } from './native-operation-jobs.js';

const UUID = /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/;
const HASH = /^[a-f0-9]{64}$/;
const PHASES = ['update-preflight-readback', 'update-apply', 'update-readback'] as const;
type Phase = typeof PHASES[number];
const sha = (s: string) => createHash('sha256').update(s).digest('hex');
const same = (a: unknown, b: unknown) => canonicalJson(a) === canonicalJson(b);
/** The first write claim keeps its historical name; later attempts are numbered. */
const clean = (readback: unknown) => { const r = structuredClone(readback) as any; delete r.images; return r; };
const claimFile = (n: number) => n === 0 ? 'apply-claim.json' : `apply-claim.${n}.json`;
type Plans = ReturnType<typeof createNativeUpdatePlans>;
type Header = { version: 1; id: string; parentId: string; proposalId: string; planRevision: string;
  scripts: Record<Phase, { script: string; sha256: string }> };
type Entry = { sequence: number; previous: string } & (
  // `outcomeOf` marks a read of the actual nodes that settles a write whose
  // result never arrived. It is the only dispatch allowed while a write is pending.
  // `design` marks a read that only reports what a designer changed since this
  // update was verified. It never moves the phase or the verified observation.
  { kind: 'dispatch'; command: NativeOperationCommand; reader?: { version: 1; inputRevision: string }; outcomeOf?: string; design?: true; parentJournalRevision?: string; templateContextRevision?:string } |
  { kind: 'result'; envelope: NativeOperationResult } |
  { kind: 'late-write-result'; envelope: NativeOperationResult } |
  // The companion asks before executing a write. Once a canvas read has been
  // dispatched to settle that write, asking is refused: a write that was handed
  // out but never begun is then provably dead, however slow its holder is.
  { kind: 'begin'; attemptId: string; at?: string } |
  // An operator's explicit decision to send a NEW write after one was settled as untouched.
  { kind: 'rearm' } |
  { kind: 'abandon-observation'; attemptId: string } |
  // An operator's statement that the companion granted `begin` for this write is
  // gone. It revokes the attempt: no later result of it is accepted, a begin for
  // it is refused, and the write is settled by a canvas read dispatched after
  // this event like any other unknown write.
  { kind: 'update-attempt-attested-dead'; attemptId: string; statement: string; at: string } |
  // A result for a revoked attempt. Kept as evidence, never counted as its outcome.
  { kind: 'late-result-after-revocation'; envelope: NativeOperationResult });
type Settlement = 'landed' | 'untouched' | 'unresolved';
type DesignEvidence = NativeDesignChanges & { attemptId: string; scriptSha256: string;
  baseline: NativeSourceReadback; observed: NativeSourceReadback };
type State = { phase: string; write?: NativeOperationCommand; answered?: boolean; writeStatus?:string; completedUnchanged?:'rolled-back'|'refused'; revoked: Set<string>; attested?: { attemptId: string; at: string };
  revokedUntouched?: string; alarms: string[]; designRead?: boolean; design?: DesignEvidence; pending?: NativeOperationCommand; unresolved?: NativeOperationCommand; begun?: string; begunAt?: string; claims: number; settled: Map<string, Settlement>;
  wrote: boolean; observation?: unknown; observationScriptSha256?: string; observationParentRevision?: string; observationTemplateContextRevision?:string; problems: string[] };
function fail(message: string): never { throw Error('native-update-' + message); }
/** The operator's statement, recorded verbatim with every attestation. The route takes no body. */
export const NATIVE_UPDATE_ATTEST_DEAD_STATEMENT = 'The operator attests that the companion granted permission to begin this write is gone and will not execute it. This attempt is revoked; the canvas decides what happened.';
/** Whether the latest write may be attested dead: begun, never answered, not settled.
 * 'attested' means it already was and is still unsettled (a second attestation records
 * nothing). Once a canvas read has settled it, attesting it again is refused by name. */
function attestable(state: State): 'ok' | 'attested' | 'no-write' | 'write-not-begun' | 'write-answered' | 'observation-in-flight' | 'write-settled' {
  const w = state.write?.attemptId;
  if (!w) return 'no-write';
  if (state.revoked.has(w)) return state.settled.has(w) ? 'write-settled' : 'attested';
  if (state.begun !== w) return 'write-not-begun';
  if (state.answered) return 'write-answered';
  if (state.pending?.attemptId === w || state.unresolved?.attemptId === w) return 'ok';
  if (state.pending) return 'observation-in-flight';
  // A begun write the canvas read could not settle (untouched but begun, or partial).
  return state.phase === 'update-recovery-required' && state.settled.get(w) === 'unresolved' ? 'ok' : 'write-settled';
}
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
  const displayScope = 'native-update-jobs:' + randomUUID();
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
      ['update-preflight-readback',emitNativeAppUpdateScript(plan,true)],
      ['update-apply',emitNativeAppUpdateScript(plan)],
      ['update-readback',emitNativeAppUpdateReadback(plan,readback)],
    ].map(([key,script])=>[key,{script,sha256:sha(script)}])) as Header['scripts'];
  };
  const load = (id: string) => evidenceReadOnce(displayScope, id, () => {
    const dir=directory(id), headerBytes=read(path.join(dir,'operation.json'));
    const header=loadNativeUpdatePrograms<Header>(JSON.parse(headerBytes), name => JSON.parse(read(path.join(dir,name))));
    if(header.version!==1 || header.id!==id || identity(header.parentId,header.proposalId)!==id) fail('header-invalid');
    const saved=plans.saved(header.parentId,header.proposalId),plan=saved.update.plan;
    if(header.planRevision!==saved.update.revision || PHASES.some(p => typeof header.scripts[p]?.script!=='string' || sha(header.scripts[p].script)!==header.scripts[p].sha256)) fail('plan-changed');
    const successStatuses=plan.kind==='native-contract-template-value-update'?['write-observed','no-op']:['updated','no-op'];
    const eventsDir=path.join(dir,'events'); ensure(eventsDir);
    let previous=sha(headerBytes);
    const state:State={phase:'update-prepared',wrote:false,claims:0,settled:new Map(),problems:[],revoked:new Set(),alarms:[]},events:Entry[]=[];
    const attempts=new Set<string>();
    for(const [sequence,file] of readdirSync(eventsDir).sort().entries()) {
      if(file!==`${String(sequence).padStart(8,'0')}.json`) fail('journal-sequence-invalid');
      const bytes=read(path.join(eventsDir,file)),event=JSON.parse(bytes) as Entry;
      if(event.sequence!==sequence || event.previous!==previous) fail('journal-chain-invalid');
      if(event.kind==='dispatch' && event.parentJournalRevision!==undefined &&
          (!HASH.test(event.parentJournalRevision) || event.command.phase!=='update-readback' ||
            event.command.readOnly!==true || event.design || event.outcomeOf!==undefined)) fail('parent-context-invalid');
      if(event.kind==='dispatch' && event.templateContextRevision!==undefined &&
          (plan.kind!=='native-contract-template-value-update'||!/^sha256:[a-f0-9]{64}$/.test(event.templateContextRevision)||
           event.command.phase!=='update-readback'||!event.command.readOnly||event.design||event.outcomeOf!==undefined))fail('template-context-invalid');
      if(event.kind==='dispatch' && event.design) {
        const c=event.command,reader=header.scripts['update-readback'];
        const readerValid=event.reader
          ? event.reader.version===1 && event.reader.inputRevision===revisionOf(plan.after) && typeof c.script==='string' && sha(c.script)===c.scriptSha256
          : c.script===reader.script && c.scriptSha256===reader.sha256;
        if(state.pending || state.phase!=='update-verified' || !state.observation || !readerValid || event.outcomeOf!==undefined ||
            c.phase!=='update-readback' || c.readOnly!==true || c.version!==1 || c.kind!=='SOURCE-NATIVE-OPERATION' || c.operationId!==id ||
            c.fileKey!==plan.before.operation.fileKey || c.planRevision!==header.planRevision || !UUID.test(c.attemptId) || !HASH.test(c.nonce) ||
            attempts.has(c.attemptId)) fail('design-dispatch-invalid');
        attempts.add(c.attemptId);state.pending=c;state.designRead=true;delete state.design;
      } else if(event.kind==='dispatch' && event.outcomeOf!==undefined) {
        const c=event.command,reader=header.scripts['update-readback'];
        if(state.unresolved || state.pending?.phase!=='update-apply' || event.outcomeOf!==state.pending.attemptId || event.reader ||
            c.phase!=='update-readback' || c.readOnly!==true || c.version!==1 || c.kind!=='SOURCE-NATIVE-OPERATION' || c.operationId!==id ||
            c.fileKey!==plan.before.operation.fileKey || c.planRevision!==header.planRevision || !UUID.test(c.attemptId) || !HASH.test(c.nonce) ||
            attempts.has(c.attemptId) || c.script!==reader.script || c.scriptSha256!==reader.sha256) fail('outcome-dispatch-invalid');
        attempts.add(c.attemptId);state.unresolved=state.pending;state.pending=c;
      } else if(event.kind==='dispatch') {
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
          if(state.wrote || state.phase!=='update-preflight-observed' || !same(JSON.parse(read(path.join(dir,claimFile(state.claims)))),c)) fail('write-precondition-invalid');
          state.wrote=true;state.claims++;delete state.begun;state.write=c;delete state.answered;delete state.writeStatus;delete state.completedUnchanged;delete state.revokedUntouched;delete state.begunAt;
        } else if(p==='update-preflight-readback' ? state.wrote : !state.wrote) fail('readback-precondition-invalid');
        attempts.add(c.attemptId);state.pending=c;state.phase='awaiting-native-result';delete state.observation;delete state.observationScriptSha256;delete state.observationParentRevision;delete state.observationTemplateContextRevision;delete state.design;
      } else if(event.kind==='begin') {
        if(state.unresolved || state.pending?.phase!=='update-apply' || event.attemptId!==state.pending.attemptId || state.begun ||
            (event.at!==undefined && (typeof event.at!=='string' || !Number.isFinite(Date.parse(event.at))))) fail('begin-invalid');
        state.begun=event.attemptId;if(event.at!==undefined) state.begunAt=event.at;
      } else if(event.kind==='rearm') {
        if(state.pending || state.phase!=='update-write-untouched') fail('rearm-invalid');
        state.phase='update-prepared';
      } else if(event.kind==='late-write-result') {
        // The write was already settled by reading the canvas. Its own late
        // result is kept as evidence; it can raise an alarm, never a value.
        const settlement=state.settled.get(event.envelope?.attemptId);
        if(!settlement || state.pending || state.revoked.has(event.envelope.attemptId)) fail('late-result-invalid');
        if(event.envelope.attemptId===state.write?.attemptId) state.answered=true;
        // Allow-list: only results consistent with the settlement are benign.
        const status=String((event.envelope.result as any)?.status),benign=settlement==='untouched'?['no-op','refused']:successStatuses;
        // Untouched means begin was refused from then on: any result at all proves a
        // program ran without permission (a companion older than the handshake).
        if(settlement==='untouched') state.problems=[...new Set([...state.problems,'native-update-write-ran-without-begin'])];
        if(!benign.includes(status)) {
          // The canvas may hold this update's values: it re-enters every chain guard as a written, unverified correction.
          state.phase='update-recovery-required';state.wrote=true;state.problems=[...new Set([...state.problems,'native-update-late-write-result-contradicts-canvas'])];
        }
      } else if(event.kind==='result' && state.designRead) {
        if(!state.pending) fail('unsolicited-result');
        correlate(event.envelope,state.pending);
        // Report only. The verified observation stays the chain's truth; the
        // next write still has to pass its own preflight against the canvas.
        try {
          const baseline=clean(nativeAppUpdateMainReadback(plan,state.observation)),observed=clean(nativeAppUpdateMainReadback(plan,event.envelope.result));
          state.design={...nativeAppUpdateDesignChanges(plan,state.observation,event.envelope.result),attemptId:state.pending.attemptId,
            scriptSha256:state.pending.scriptSha256,baseline,observed};
        }
        catch { delete state.design;state.problems=['native-update-design-observation-unreadable']; }
        delete state.designRead;delete state.pending;
      } else if(event.kind==='result' && state.unresolved) {
        if(!state.pending) fail('unsolicited-result');
        correlate(event.envelope,state.pending);
        const r=event.envelope.result,write=state.unresolved.attemptId;
        state.problems=[];
        if(nativeContractUpdateMatches(plan,r,true)) { state.phase='update-applied';state.settled.set(write,'landed'); }
        else if(nativeContractUpdateUntouched(plan,r) && state.begun===write && !state.revoked.has(write)) {
          // The companion had begun this write. "Not there yet" is not "never".
          state.phase='update-recovery-required';state.problems=['native-update-write-begun-outcome-unresolved'];state.settled.set(write,'unresolved');
        } else if(nativeContractUpdateUntouched(plan,r)) {
          // Never begun, and begin is refused from now on: this write is dead.
          // Nothing more is sent until an operator re-arms it; a later attempt
          // needs its own fresh preflight and its own numbered write claim.
          // An attested write reaches here too: its revocation was journaled before this read was dispatched.
          state.phase='update-write-untouched';state.wrote=false;state.settled.set(write,'untouched');
          if(state.revoked.has(write)) state.revokedUntouched=write;
        } else { state.phase='update-recovery-required';state.problems=['native-update-write-outcome-unresolved'];state.settled.set(write,'unresolved'); }
        delete state.unresolved;delete state.pending;
      } else if(event.kind==='result') {
        if(!state.pending) fail('unsolicited-result');
        correlate(event.envelope,state.pending);
        const r=event.envelope.result as any,p=state.pending.phase;
        state.problems=[];
        if(p==='update-preflight-readback') {
          state.phase=nativeAppUpdatePreflight(plan,r) ? 'update-preflight-observed' : 'update-refused';
          // A revoked write settled as untouched may still have executed later. The
          // first preflight after that settlement names any canvas that moved since.
          // Kept until a preflight actually reads the canvas: an observed one that is
          // not the saved baseline, or one the program refused after reading it.
          const refusedAfterReading=r?.status==='refused' && !(Array.isArray(r?.problems) && r.problems.includes('native-update-file-mismatch'));
          if(state.revokedUntouched && (r?.status==='preflight-observed' || refusedAfterReading)) {
            if(refusedAfterReading || !nativeAppUpdatePreflight(plan,r,true))
              state.alarms=[...new Set([...state.alarms,'native-update-canvas-moved-after-revoked-settlement'])];
            delete state.revokedUntouched;
          }
        } else if(p==='update-apply') {
          state.answered=true;state.writeStatus=String(r?.status);
          // Acknowledgement never qualifies success. A separate read observes
          // the actual nodes even after a refused or rolled-back write.
          state.phase='update-applied';
          if(!successStatuses.includes(r?.status)) state.problems=['native-update-write-'+String(r?.status ?? 'unknown')];
        } else {
          state.observation=r;state.observationScriptSha256=state.pending.scriptSha256;
          const dispatch=events.find(e=>e.kind==='dispatch' && e.command.attemptId===state.pending!.attemptId);
          state.observationParentRevision=dispatch?.kind==='dispatch' ? dispatch.parentJournalRevision : undefined;
          state.observationTemplateContextRevision=dispatch?.kind==='dispatch'?dispatch.templateContextRevision:undefined;
          if(nativeContractUpdateMatches(plan,r,true)) state.phase='update-verified';
          else if(state.answered && state.write && ['rolled-back','refused'].includes(state.writeStatus??'') && nativeContractUpdateUntouched(plan,r)) {
            // A terminal answer alone is not evidence. This later independent
            // read proves that every owned fact was restored. The answered
            // attempt cannot begin again; a replay must match its saved answer.
            state.phase='update-write-untouched';state.wrote=false;
            state.completedUnchanged=state.writeStatus as 'rolled-back'|'refused';
            state.settled.set(state.write.attemptId,'untouched');
          } else state.phase='update-recovery-required';
        }
        if(['update-refused','update-recovery-required'].includes(state.phase)) {
          // The native program names the check that refused: a conflicting node,
          // an unrelated canvas edit, a missing node. Keep those names beside the
          // summary; "refused" alone gives an operator nothing to resolve.
          const named=Array.isArray(r?.problems)?(r.problems as unknown[]).filter((p):p is string=>typeof p==='string'&&/^native-(?:update|template)-[A-Za-z0-9:;._-]{1,160}$/.test(p)).slice(0,20):[];
          state.problems=['native-update-observation-refused',...new Set(named)];
        }
        delete state.pending;
      } else if(event.kind==='update-attempt-attested-dead') {
        if(attestable(state)!=='ok' || state.unresolved || event.attemptId!==state.write!.attemptId ||
            event.statement!==NATIVE_UPDATE_ATTEST_DEAD_STATEMENT || typeof event.at!=='string' || !Number.isFinite(Date.parse(event.at))) fail('attestation-invalid');
        state.revoked.add(event.attemptId);state.attested={attemptId:event.attemptId,at:event.at};
        if(!state.pending) {
          // Settled as unresolved while it might still run. Revoked, it is an
          // unknown write again, and only a canvas read dispatched from here settles it.
          state.pending=state.write;state.phase='awaiting-native-result';state.settled.delete(event.attemptId);
          delete state.observation;delete state.observationScriptSha256;
        }
        state.problems=[];
      } else if(event.kind==='late-result-after-revocation') {
        const write=events.find(e=>e.kind==='dispatch'&&e.command.attemptId===event.envelope?.attemptId);
        if(!state.revoked.has(event.envelope?.attemptId) || write?.kind!=='dispatch' ||
            events.some(e=>e.kind==='late-result-after-revocation'&&e.envelope.attemptId===event.envelope.attemptId)) fail('late-result-invalid');
        correlate(event.envelope,write.command);
        // A result can be a saved response delivered after reconnecting. Its
        // arrival does not establish when the write ran or disprove the attestation.
        state.alarms=[...new Set([...state.alarms,'native-update-late-result-after-revocation'])];
        // Before settlement it is evidence only: the canvas read still decides.
        // After settlement it is judged like any late write result, by the same allow-list.
        const settlement=state.settled.get(event.envelope.attemptId);
        if(settlement) {
          if(state.pending) fail('late-result-invalid');
          const status=String((event.envelope.result as any)?.status),benign=settlement==='untouched'?['no-op','refused']:successStatuses;
          if(!benign.includes(status)) {
            state.phase='update-recovery-required';state.wrote=true;delete state.revokedUntouched;
            state.problems=[...new Set([...state.problems,'native-update-late-write-result-contradicts-canvas'])];
          }
        }
      } else if(event.kind==='abandon-observation') {
        if(!state.pending?.readOnly || event.attemptId!==state.pending.attemptId) fail('observation-abandon-refused');
        // Abandoning an outcome read leaves the write exactly as unknown as before.
        if(state.designRead) { delete state.designRead;delete state.pending; }
        else if(state.unresolved) { state.pending=state.unresolved;delete state.unresolved; }
        else { state.phase=state.wrote?'update-recovery-required':'update-refused';delete state.pending; }
      } else fail('event-invalid');
      previous=sha(bytes);events.push(event);
    }
    for(let n=0;n<=state.claims;n++) if(existsSync(path.join(dir,claimFile(n)))!==(n<state.claims)) fail('write-journal-incomplete');
    return {id,dir,header,plan,state,events,previous};
  });
  type Loaded=ReturnType<typeof load>;
  const authenticatePlan=(l:Loaded,birth?:ReactComparisonBirth) => {
    const record=plans.current(l.header.parentId,l.header.proposalId,birth);
    if(record.update.revision!==l.header.planRevision) fail('source-or-compiler-changed');
    if(load(l.id).previous!==l.previous) fail('journal-changed');
    return record;
  };
  const requireCurrentWriteScope=(l:Loaded) => {
    if(l.plan.kind==='native-contract-opacity-update' && l.plan.tokenChanges?.length && l.plan.tokenBindingScope!=='document-v1')
      fail('legacy-token-write-scope-refused');
  };
  const authenticate=(l:Loaded) => {
    requireCurrentWriteScope(l);
    if (!same(scripts(authenticatePlan(l)),l.header.scripts)) fail('source-or-compiler-changed');
  };
  const authenticateObservation=(l:Loaded,birth?:ReactComparisonBirth) => {
    authenticatePlan(l,birth);
    const context=plans.observationContext(l.header.parentId,l.header.proposalId,birth);
    if(context.currentRevision!==context.baselineRevision && l.state.observationParentRevision!==context.currentRevision)
      fail('parent-observation-refresh-required');
    if(context.templateCurrentRevision!==undefined &&
        l.state.observationTemplateContextRevision!==context.templateCurrentRevision)
      fail('template-context-observation-refresh-required');
    // Export geometry enriches images only. An otherwise current historical
    // reader still proves structure; missing framing is reported separately.
    if (![sha(emitNativeAppUpdateReadback(l.plan,readback)), sha(emitNativeAppUpdateReadback(l.plan,readback,true,false))].includes(l.state.observationScriptSha256 ?? ''))
      fail('current-reader-observation-required');
  };
  type Unsealed<E> = E extends Entry ? Omit<E,'sequence'|'previous'> : never;
  const append=(l:Loaded,event:Unsealed<Entry>) => {
    if(load(l.id).previous!==l.previous) fail('journal-changed');
    if(event.kind==='dispatch' && event.command.phase==='update-apply') write(path.join(l.dir,claimFile(l.state.claims)),event.command);
    write(path.join(l.dir,'events',`${String(l.events.length).padStart(8,'0')}.json`),{...event,sequence:l.events.length,previous:l.previous});
  };
  const superseded=(l:Loaded) => plans.list(l.header.parentId).some(proposal=>{
    if(plans.historyPins(l.header.parentId,proposal.id).predecessor?.proposalId!==l.header.proposalId)return false;
    const id=identity(l.header.parentId,proposal.id);
    return existsSync(path.join(root,id))&&load(id).state.wrote;
  });
  const verifiedTip=(parentId:string,birth?:ReactComparisonBirth) => {
    const written=plans.list(parentId).flatMap(proposal=>{
      const id=identity(parentId,proposal.id);
      if(!existsSync(path.join(root,id)))return [];
      const l=load(id);return l.state.wrote?[l]:[];
    });
    if(!written.length)return undefined;
    if(written.some(l=>l.state.phase!=='update-verified'||l.state.pending))fail('effective-observation-unavailable');
    const predecessors=new Set(written.map(l=>plans.historyPins(parentId,l.header.proposalId).predecessor?.proposalId));
    const tips=written.filter(l=>!predecessors.has(l.header.proposalId));
    if(tips.length!==1)fail('effective-observation-unavailable');
    const l=tips[0];
    if(birth&&(!UUID.test(birth.operationId)||birth.operationId===parentId||!isReactComparisonParentUpdate(birth.parentUpdate)||
      l.plan.kind==='native-contract-token-allocation-update'||birth.parentUpdate.proposalId!==l.header.proposalId))fail('caller-birth-parent-changed');
    authenticateObservation(l,birth);
    if(!nativeContractUpdateMatches(l.plan,l.state.observation,true))fail('effective-observation-invalid');
    if(birth&&parentObservation(l).parentUpdate.observationRevision!==birth.parentUpdate.observationRevision)fail('caller-birth-parent-changed');
    return l;
  };
  const parentObservation=(l:Loaded)=>{
    const receipt=nativeAppUpdateMainReadback(l.plan,l.state.observation);delete receipt.images;
    const input=nativeContractUpdateAfter(l.plan,l.state.observation);
    return {input,receipt,parentUpdate:{proposalId:l.header.proposalId,observationRevision:revisionOf({input,receipt})}};
  };
  const callerImages=(l:Loaded)=>l.plan.kind==='native-contract-template-value-update'&&l.state.observation
    ? l.plan.template.input.consumers.map((c,i)=>({operationId:c.input.operation.id,caseId:c.input.comparison.caseId,
      ...collectExpectedNativeImages({operation:c.input.operation,planRevision:c.input.planRevision},
        [{id:c.input.comparison.caseId,instanceId:c.input.creation.comparisons[0].instanceId}],
        (l.state.observation as any).consumerObservations?.[i])})) : [];
  // A standalone result/replay response needs the same bounded read scope as
  // the full listing. Reuse verified inputs only until this synchronous view
  // returns; command authorization and journal writes stay outside the scope.
  const snapshot=(l:Loaded) => withEvidenceReadSnapshot(() => {
    let sourceCurrent=false, canRefreshObservation=false;
    try { if(l.state.wrote && l.state.phase==='update-verified') authenticateObservation(l); else authenticate(l); sourceCurrent=true; }
    catch { /* Historical results remain visible. */ }
    if (l.state.wrote && l.state.pending?.phase !== 'update-apply') try { authenticatePlan(l);canRefreshObservation=true; } catch { /* Source drift is not reader drift. */ }
    return {id:l.id,parentId:l.header.parentId,proposalId:l.header.proposalId,phase:l.state.phase,sourceCurrent,canRefreshObservation,superseded:superseded(l),
      pendingPhase:l.state.pending?.phase,nativeOutcome:l.state.pending?'unknown' as const:undefined,
      // A write whose result never arrived can be settled only by reading the canvas.
      // What a designer changed on these nodes since verification, if it was read.
      designChanges:l.state.design?{attemptId:l.state.design.attemptId,added:l.state.design.added,removed:l.state.design.removed,
        total:l.state.design.changes.length,changes:l.state.design.changes.slice(0,200)}:undefined,designRead:l.state.designRead?true as const:undefined,
      unresolvedWrite:l.state.unresolved?'reading-canvas' as const:l.state.pending?.phase==='update-apply'?'awaiting-result' as const:undefined,
      acceptedContract:null,nativeQualification:'unqualified' as const,problems:[...new Set([...l.state.problems,...l.state.alarms])],
      // The operator's attestation that a begun write's companion is gone, and whether one is possible now.
      completedUnchanged:l.state.completedUnchanged,
      attestedDead:l.state.attested&&l.state.attested.attemptId===l.state.write?.attemptId?{...l.state.attested}:undefined,canAttestDead:attestable(l.state)==='ok',
      begunAt:l.state.begun&&l.state.begun===l.state.write?.attemptId?l.state.begunAt:undefined,
      imageObservation:l.state.observation ? collectNativeImages(l.plan.after,nativeAppUpdateMainReadback(l.plan,l.state.observation)).observation:undefined,
      ...(l.plan.kind==='native-contract-template-value-update'?{callerImageObservations:callerImages(l).map(({operationId,caseId,observation})=>({operationId,caseId,observation}))}:{})};
  });
  const get=(id:string)=>withEvidenceReadSnapshot(()=>evidenceReadOnce(displayScope + ':view', id, () => snapshot(load(id))));
  const dispatch=(id:string,phase:NativeOperationPhase):NativeOperationCommand=>{
    assertOutsideEvidenceSnapshot();
    const l=load(id),p=phase as Phase;
    if(superseded(l))fail('superseded-observation-is-historical');
    if(l.state.pending || !PHASES.includes(p)) fail('dispatch-refused');
    if(l.state.phase==='update-write-untouched') fail('write-rearm-required');
    if(p==='update-apply' ? l.state.wrote || l.state.phase!=='update-preflight-observed' : p==='update-preflight-readback' ? l.state.wrote : !l.state.wrote) fail('phase-refused');
    if(p==='update-apply') authenticate(l);
    if(p==='update-readback'&&l.plan.kind==='native-contract-template-value-update'&&l.state.phase==='update-verified') {
      // Do not erase the verified parent evidence while a new caller needs it
      // to finish. Unknown writes retain their historical recovery reader.
      try { plans.observationContext(l.header.parentId,l.header.proposalId); }
      catch(error) {
        if(!(error instanceof Error)||error.message!=='native-update-template-consumer-inventory-refresh-required')
          fail('caller-context-unavailable-before-refresh');
      }
    }
    let program=l.header.scripts[p],reader:Extract<Entry,{kind:'dispatch'}>['reader'],parentJournalRevision:string|undefined,templateContextRevision:string|undefined;
    if (p==='update-readback') {
      // A stale source still permits historical read-only recovery, but only a
      // freshly authenticated unchanged plan can select today's reader.
      try {
        authenticatePlan(l);
        const script=emitNativeAppUpdateReadback(l.plan,readback);
        if(script!==program.script) {program={script,sha256:sha(script)};reader={version:1,inputRevision:revisionOf(l.plan.after)};}
        const context=plans.observationContext(l.header.parentId,l.header.proposalId);
        if(context.currentRevision!==context.baselineRevision)parentJournalRevision=context.currentRevision;
        templateContextRevision=context.templateCurrentRevision;
      } catch { /* Deliver the historical reader; it cannot qualify current reuse. */ }
    }
    const command:NativeOperationCommand={version:1,kind:'SOURCE-NATIVE-OPERATION',operationId:id,phase:p,
      attemptId:randomUUID(),nonce:randomBytes(32).toString('hex'),fileKey:l.plan.before.operation.fileKey,
      planRevision:l.header.planRevision,script:program.script,scriptSha256:program.sha256,readOnly:p!=='update-apply'};
    append(l,{kind:'dispatch',command,...(reader?{reader}:{}),...(parentJournalRevision?{parentJournalRevision}:{}),...(templateContextRevision?{templateContextRevision}:{})});return structuredClone(command);
  };
  const image=(id:string,hash:string) => {
    if(!HASH.test(hash))fail('image-request-invalid');
    const l=load(id),data=collectNativeImages(l.plan.after,nativeAppUpdateMainReadback(l.plan,l.state.observation)).bytes.get(hash)
      ??callerImages(l).map(c=>c.bytes.get(hash)).find(Boolean);
    if(!data)fail('image-unavailable');
    return Buffer.from(data);
  };
  function acceptResult<T>(id:string,envelope:NativeOperationResult,finish:(loaded:Loaded,envelope:NativeOperationResult)=>T):T {
    assertOutsideEvidenceSnapshot();
    const serialized=JSON.stringify(envelope);if(Buffer.byteLength(serialized)>4*1024*1024) fail('result-too-large');
    envelope=JSON.parse(serialized);const l=load(id);
    const prior=l.events.find(e=>e.kind==='result'&&e.envelope.attemptId===envelope?.attemptId);
    if(prior?.kind==='result') {if(!same(prior.envelope,envelope)) fail('result-replay-conflict');return finish(l,envelope);}
    const late=l.events.find(e=>e.kind==='late-write-result'&&e.envelope.attemptId===envelope?.attemptId);
    if(late?.kind==='late-write-result') {if(!same(late.envelope,envelope)) fail('result-replay-conflict');return finish(l,envelope);}
    const revoked=l.events.find(e=>e.kind==='late-result-after-revocation'&&e.envelope.attemptId===envelope?.attemptId);
    if(revoked?.kind==='late-result-after-revocation') {if(!same(revoked.envelope,envelope)) fail('result-replay-conflict');return finish(l,envelope);}
    let current=l;
    if(current.state.revoked.has(envelope?.attemptId)) {
      // Checked before the "own result outranks a canvas read" rule: a revoked
      // attempt's result is evidence only, whatever it says and whenever it arrives.
      const write=current.events.find(e=>e.kind==='dispatch'&&e.command.attemptId===envelope.attemptId);
      if(write?.kind!=='dispatch') fail('unsolicited-result');correlate(envelope,write.command);
      // Once settled, as for an unrevoked late result: judged only while nothing else is pending.
      if(current.state.settled.has(envelope.attemptId)&&current.state.pending) fail('unsolicited-result');
      append(current,{kind:'late-result-after-revocation',envelope});return withEvidenceReadSnapshot(()=>finish(load(id),envelope));
    }
    if(current.state.unresolved&&envelope?.attemptId===current.state.unresolved.attemptId) {
      // The write's own result arrived after all: it outranks the pending canvas read.
      correlate(envelope,current.state.unresolved);
      append(current,{kind:'abandon-observation',attemptId:current.state.pending!.attemptId});current=load(id);
    } else if(!current.state.pending&&current.state.settled.has(envelope?.attemptId)) {
      const write=current.events.find(e=>e.kind==='dispatch'&&e.command.attemptId===envelope.attemptId);
      if(write?.kind!=='dispatch') fail('unsolicited-result');correlate(envelope,write.command);
      append(current,{kind:'late-write-result',envelope});return withEvidenceReadSnapshot(()=>finish(load(id),envelope));
    }
    if(!current.state.pending) fail('unsolicited-result');correlate(envelope,current.state.pending);
    append(current,{kind:'result',envelope});return withEvidenceReadSnapshot(()=>finish(load(id),envelope));
  }
  return {
    get,dispatch,
    updateHistory(parentId: string) {
      return evidenceReadOnce(displayScope + ':history', parentId, () => plans.list(parentId).flatMap(proposal => {
        const id=identity(parentId,proposal.id);
        if(!existsSync(path.join(root,id))) return [];
        const l=load(id);
        return l.state.wrote ? [{proposalId:proposal.id,journalRevision:l.previous,phase:l.state.phase,
          pending:!!l.state.pending,receipt:structuredClone(l.state.observation) as import('../core/native-source-observation.js').NativeSourceReadback | undefined}] : [];
      }));
    },
    verifiedForParent(parentId: string) {
      return evidenceReadOnce(displayScope + ':parent', parentId, () => {
        const l=verifiedTip(parentId);if(!l)return undefined;
        return parentObservation(l);
      });
    },
    verifiedForCaller(parentId: string) {
      const l=verifiedTip(parentId);if(!l)return undefined;
      // Allocating missing variables does not establish that the component
      // agrees with the current compiler. Its follow-up correction must settle.
      if(l.plan.kind==='native-contract-token-allocation-update')fail('compiler-review-required-after-token-allocation');
      return parentObservation(l);
    },
    verifiedForNewConsumer(parentId:string,operationId:string,parentUpdate:ReactComparisonParentUpdate) {
      const l=verifiedTip(parentId,{operationId,parentUpdate});
      if(!l)fail('caller-birth-parent-unavailable');
      return parentObservation(l);
    },
    /** Full host-only input for a repair planner, never the truncated UI rows.
     * It proves the journal/source/baseline relationship, not permission to
     * write source or that the canvas has stayed unchanged since this read. */
    designEvidence(id:string) {
      assertOutsideEvidenceSnapshot();
      const l=load(id);
      if(l.plan.kind==='native-contract-template-value-update')fail('template-source-repair-unqualified');
      const tip=verifiedTip(l.header.parentId),design=l.state.design;
      if(l.plan.kind==='native-contract-token-allocation-update')fail('compiler-review-required-after-token-allocation');
      if(tip?.id!==id)fail('superseded-observation-is-historical');
      if(!design || l.state.pending || l.state.unresolved || l.state.problems.length || l.state.alarms.length)
        fail('design-evidence-unavailable');
      if(!same(design.baseline,clean(l.state.observation)))fail('design-baseline-changed');
      if(![sha(readback(l.plan.after,true,true)),sha(readback(l.plan.after,true))].includes(design.scriptSha256))
        fail('current-design-reader-required');
      const receipt=clean(l.state.observation) as NativeSourceReadback;
      return structuredClone({operationId:id,parentId:l.header.parentId,proposalId:l.header.proposalId,
        journalRevision:l.previous,attemptId:design.attemptId,input:nativeContractUpdateAfter(l.plan,receipt),
        baseline:receipt,observed:design.observed,difference:nativeDesignChanges(receipt,design.observed)});
    },
    /** Read-only recovery observation. Original source can be partly changed
     * by a journaled source transaction, so this grants no source authority.
     * The caller must authenticate that transaction and compare the complete
     * observed content with its reviewed intent before any source write. */
    observeSourceRepair(id:string,baselineRevision:string,renew=false):NativeOperationCommand {
      assertOutsideEvidenceSnapshot();let l=load(id);
      if(l.plan.kind==='native-contract-template-value-update')fail('template-source-repair-unqualified');
      if(superseded(l)||l.state.phase!=='update-verified'||l.state.problems.length||l.state.alarms.length||
        revisionOf(clean(l.state.observation))!==baselineRevision)fail('source-repair-baseline-unavailable');
      const script=readback(l.plan.after,true,true),scriptSha256=sha(script);
      if(l.state.pending){
        if(!l.state.designRead||!l.state.pending.readOnly||l.state.pending.scriptSha256!==scriptSha256)fail('source-repair-read-in-flight');
        if(!renew)return structuredClone(l.state.pending);
        // A cached result from before a host restart cannot be a fresh
        // source-write preflight. Preserve and supersede that read only.
        append(l,{kind:'abandon-observation',attemptId:l.state.pending.attemptId});l=load(id);
      }
      const command:NativeOperationCommand={version:1,kind:'SOURCE-NATIVE-OPERATION',operationId:id,phase:'update-readback',
        attemptId:randomUUID(),nonce:randomBytes(32).toString('hex'),fileKey:l.plan.before.operation.fileKey,
        planRevision:l.header.planRevision,script,scriptSha256,readOnly:true};
      append(l,{kind:'dispatch',command,design:true,reader:{version:1,inputRevision:revisionOf(l.plan.after)}});
      return structuredClone(command);
    },
    sourceRepairReadEvidence(id:string,attemptId:string,baselineRevision:string){
      assertOutsideEvidenceSnapshot();const l=load(id);
      if(l.plan.kind==='native-contract-template-value-update')fail('template-source-repair-unqualified');
      if(superseded(l)||l.state.phase!=='update-verified'||l.state.problems.length||l.state.alarms.length||
        revisionOf(clean(l.state.observation))!==baselineRevision)fail('source-repair-baseline-unavailable');
      if(l.state.pending){
        if(l.state.designRead&&l.state.pending.attemptId===attemptId&&l.state.pending.readOnly)return null;
        fail('source-repair-read-replaced');
      }
      const design=l.state.design;
      if(!design||design.attemptId!==attemptId||design.scriptSha256!==sha(readback(l.plan.after,true,true))||
        revisionOf(design.baseline)!==baselineRevision)fail('source-repair-read-unavailable');
      return structuredClone({operationId:id,parentId:l.header.parentId,proposalId:l.header.proposalId,
        fileKey:l.plan.before.operation.fileKey,attemptId,journalRevision:l.previous,scriptSha256:design.scriptSha256,
        baselineRevision,observed:design.observed});
    },
    has(id:string) { if(!UUID.test(id)) return false;return existsSync(path.join(root,id)); },
    prepare(parentId:string,proposalId:string) {
      assertOutsideEvidenceSnapshot();
      const id=identity(parentId,proposalId);
      if(existsSync(path.join(root,id))) return get(id);
      const record=plans.current(parentId,proposalId);
      const header:Header={version:1,id,parentId,proposalId,planRevision:record.update.revision,scripts:scripts(record)};
      if(!same(record,plans.current(parentId,proposalId))) fail('source-changed-during-preparation');
      const dir=directory(id,true);sync(root);ensure(path.join(dir,'events'),true);
      const stored=storeNativeUpdatePrograms(header,(name,value)=>write(path.join(dir,name),value));
      write(path.join(dir,'operation.json'),stored);return get(id);
    },
    forProposal(parentId:string,proposalId:string) { const id=identity(parentId,proposalId);return existsSync(path.join(root,id))?get(id):null; },
    /** Resolve an action's target from its checked journal, not a display view.
     * Every transport action still enforces its own source and phase guards. */
    idForProposal(parentId:string,proposalId:string) {
      const id=identity(parentId,proposalId);return existsSync(path.join(root,id))?load(id).id:null;
    },
    /** Read the authenticated journal only. This never grants current-source authority. */
    deliveryStateForProposal(parentId:string,proposalId:string) {
      const l=load(identity(parentId,proposalId));
      return {phase:l.state.phase,pendingPhase:l.state.pending?.phase};
    },
    deliveryState(id:string) {const l=load(id);return {phase:l.state.phase,pendingPhase:l.state.pending?.phase,fileKey:l.plan.before.operation.fileKey};},
    pendingCommand(id:string) {assertOutsideEvidenceSnapshot();const l=load(id);if(l.state.pending&&!l.state.pending.readOnly) authenticate(l);return structuredClone(l.state.pending??null);},
    accept(id:string,envelope:NativeOperationResult) {
      return acceptResult(id,envelope,loaded=>snapshot(loaded));
    },
    acceptDelivery(id:string,envelope:NativeOperationResult):NativeOperationReceipt {
      // Correlation, durable append and full journal validation run before this
      // receipt. It grants no fresh source or native-success authority.
      return acceptResult(id,envelope,(loaded,result)=>({status:'result-recorded',id:loaded.id,
        attemptId:result.attemptId,nativeQualification:'unqualified'}));
    },
    /** Settle a write whose result never arrived by reading the actual nodes.
     * The write is never sent again. Uses the reader pinned with this update. */
    resolveWriteOutcome(id:string):NativeOperationCommand {
      assertOutsideEvidenceSnapshot();
      const l=load(id),write=l.state.pending;
      if(l.state.unresolved||write?.phase!=='update-apply') fail('write-outcome-not-pending');
      const reader=l.header.scripts['update-readback'];
      const command:NativeOperationCommand={version:1,kind:'SOURCE-NATIVE-OPERATION',operationId:id,phase:'update-readback',
        attemptId:randomUUID(),nonce:randomBytes(32).toString('hex'),fileKey:l.plan.before.operation.fileKey,
        planRevision:l.header.planRevision,script:reader.script,scriptSha256:reader.sha256,readOnly:true};
      append(l,{kind:'dispatch',command,outcomeOf:write.attemptId});return structuredClone(command);
    },
    /** Read, and only read, what a designer changed since this update was verified. */
    observeDesign(id:string):NativeOperationCommand {
      assertOutsideEvidenceSnapshot();
      const l=load(id);
      if(superseded(l))fail('superseded-observation-is-historical');
      if(l.state.pending||l.state.phase!=='update-verified') fail('design-observation-refused');
      let reader=l.header.scripts['update-readback'],currentReader:Extract<Entry,{kind:'dispatch'}>['reader'];
      try {
        authenticateObservation(l);
        const script=emitNativeAppUpdateReadback(l.plan,readback);
        if(script!==reader.script) {reader={script,sha256:sha(script)};currentReader={version:1,inputRevision:revisionOf(l.plan.after)};}
      } catch { /* Historical differences remain inspectable, never current repair evidence. */ }
      const command:NativeOperationCommand={version:1,kind:'SOURCE-NATIVE-OPERATION',operationId:id,phase:'update-readback',
        attemptId:randomUUID(),nonce:randomBytes(32).toString('hex'),fileKey:l.plan.before.operation.fileKey,
        planRevision:l.header.planRevision,script:reader.script,scriptSha256:reader.sha256,readOnly:true};
      append(l,{kind:'dispatch',command,design:true,...(currentReader?{reader:currentReader}:{})});return structuredClone(command);
    },
    /** Called for the companion immediately before it executes a write. */
    beginWrite(id:string,attemptId:string) {
      assertOutsideEvidenceSnapshot();
      const l=load(id);
      requireCurrentWriteScope(l);
      if(l.state.revoked.has(attemptId)) fail('write-begin-refused');
      if(l.state.begun===attemptId&&l.state.pending?.attemptId===attemptId&&!l.state.unresolved) return;
      if(l.state.unresolved||l.state.pending?.phase!=='update-apply'||l.state.pending.attemptId!==attemptId||l.state.begun) fail('write-begin-refused');
      append(l,{kind:'begin',attemptId,at:new Date().toISOString()});
    },
    /** Operator attestation: the companion that began the latest write is gone.
     * Revokes that attempt; the write is then settled by a canvas read dispatched
     * after this event (resolveWriteOutcome). Idempotent per attempt. */
    attestDead(id:string) {
      assertOutsideEvidenceSnapshot();
      let l=load(id);
      const verdict=attestable(l.state);
      if(verdict==='attested') return get(id);
      if(verdict!=='ok') fail('attest-dead-'+verdict);
      // A canvas read dispatched before the attestation cannot be the final judge:
      // the write could land after it. It is abandoned; a new read follows.
      if(l.state.unresolved) {append(l,{kind:'abandon-observation',attemptId:l.state.pending!.attemptId});l=load(id);}
      append(l,{kind:'update-attempt-attested-dead',attemptId:l.state.write!.attemptId,statement:NATIVE_UPDATE_ATTEST_DEAD_STATEMENT,at:new Date().toISOString()});
      return get(id);
    },
    /** Operator decision: send a new write after the previous one was settled as untouched. */
    rearmWrite(id:string) {
      assertOutsideEvidenceSnapshot();
      const l=load(id);
      if(l.state.pending||l.state.phase!=='update-write-untouched') fail('write-rearm-refused');
      authenticate(l);append(l,{kind:'rearm'});
    },
    /** The write attempt a pending canvas read would settle, for the transport. */
    writeOutcomeRead(id:string) { const l=load(id);return l.state.unresolved?{writeAttemptId:l.state.unresolved.attemptId,readAttemptId:l.state.pending!.attemptId}:null; },
    retryObservation(id:string) {
      assertOutsideEvidenceSnapshot();
      let l=load(id);
      if(l.state.unresolved) {append(l,{kind:'abandon-observation',attemptId:l.state.pending!.attemptId});return this.resolveWriteOutcome(id);}
      if(l.state.pending&&!l.state.pending.readOnly) fail('write-outcome-unknown');
      const phase=l.state.pending?.phase ?? (l.state.wrote?'update-readback':'update-preflight-readback');
      if(l.state.pending) {append(l,{kind:'abandon-observation',attemptId:l.state.pending.attemptId});l=load(id);}
      return dispatch(id,phase);
    },
    abandonedObservationPhase(id:string,attemptId:string):NativeOperationPhase|null {
      const l=load(id);if(!l.events.some(e=>e.kind==='abandon-observation'&&e.attemptId===attemptId)) return null;
      const e=l.events.find(e=>e.kind==='dispatch'&&e.command.attemptId===attemptId);
      return e?.kind==='dispatch'&&e.command.readOnly?e.command.phase:null;
    },
    image,
    // Historical exports are bound to their immutable proposal and checked
    // journal. Looking up an image does not authorize a new native operation.
    imageForProposal(parentId:string,proposalId:string,hash:string) {
      return image(identity(parentId,proposalId),hash);
    },
  };
}
