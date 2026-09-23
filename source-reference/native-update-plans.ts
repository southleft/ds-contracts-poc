import {randomUUID} from 'node:crypto';
import {assertOutsideEvidenceSnapshot,evidenceReadOnce} from './evidence-read-snapshot.js';
/** Immutable, host-derived update proposals. This store never dispatches a
 * program or authorizes applying a stale proposal; delivery reauthentication
 * must call current() before any future write. */
import { closeSync, existsSync, fsyncSync, lstatSync, mkdirSync, openSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { canonicalJson, revisionOf } from '../core/contract-provenance.js';
import {prepareNativeAppUpdate as prepareNativeContractUpdate, nativeAppUpdateMatches as nativeContractUpdateMatches, nativeAppUpdateAfter as nativeContractUpdateAfter, nativeAppUpdateMainReadback, nativeAppUpdateConsumersAfter, templateUpdateInput, prepareNativeTemplateAppUpdate, type NativeAppUpdateInput as NativeContractUpdateInput} from './native-app-update.js';
import type {createNativeOperationJobs} from './native-operation-jobs.js';
import type {NativeTemplateConsumerInput} from '../core/native-template-value-consumers.js';
import type {ReactComparisonBirth} from './react-comparison-request.js';
type ConsumerPin={operationId:string;journalRevision:string};
type TemplateInventory=ReturnType<ReturnType<typeof createNativeOperationJobs>['reactTemplateConsumerBaselines']>;
type Derived={parentJournalRevision:string;input:NativeContractUpdateInput;templateInventory?:TemplateInventory};
const UUID = /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/;
/** Named on every proposal that writes a variable value. */
export const NATIVE_TOKEN_VALUE_SCOPE_LIMITATION = 'variable-bindings-on-other-pages-unchecked';
const HASH = /^[a-f0-9]{64}$/;
export interface NativeUpdateHistoryEntry {
  proposalId: string; journalRevision: string; phase: string; pending: boolean;
  receipt?: unknown;
}
export function createNativeUpdatePlans(repo: string,
  derive: (parentId: string, parentJournalRevision?: string, consumerPins?:ConsumerPin[], birth?:ReactComparisonBirth) => Derived,
  history?: (parentId: string) => NativeUpdateHistoryEntry[],
  currentParentRevision?: (parentId: string) => string,
  currentTemplateInventory?: (parentId:string,pins:ConsumerPin[],birth?:ReactComparisonBirth)=>Pick<TemplateInventory,'currentRevision'|'consumers'>) {
  const root = path.join(repo, 'private', 'source-native-update-plans');
  const displayScope = 'native-update-plans:' + randomUUID();
  function directory(parentId: string, create = false) {
    if (!UUID.test(parentId)) throw Error('native-update-parent-invalid');
    const target = path.join(root, parentId);
    for (const dir of [path.dirname(root), root, target]) {
      if (!existsSync(dir)) { if (!create) return undefined; mkdirSync(dir,{mode:0o700}); }
      const s=lstatSync(dir); if (!s.isDirectory() || s.isSymbolicLink()) throw Error('native-update-directory-invalid');
    }
    return target;
  }
  type Predecessor = { proposalId: string; journalRevision: string };
  type Record = { version: 1|2; parentId: string; parentJournalRevision: string;
    consumerPins?:ConsumerPin[]; templateContextRevision?:string;
    predecessor?: Predecessor; update: ReturnType<typeof prepareNativeContractUpdate> };
  const packed=(record:Record)=>record.update.plan.kind==='native-contract-template-value-update'
    ? {...record,update:{template:record.update.plan.template,desiredRevision:record.update.plan.desiredRevision,revision:record.update.revision}}:record;
  const recordId=(record:Record)=>revisionOf(packed(record)).slice(7);
  const same = (a: unknown, b: unknown) => canonicalJson(a) === canonicalJson(b);
  const clean = (receipt: NativeContractUpdateInput['baseline']) => { const r=structuredClone(receipt);delete r.images;return r; };
  // Each written correction must be a single successor of the last verified
  // observation. Historical compiler output is evidence, not current authority.
  const chain = (parentId: string, source: ReturnType<typeof derive>, written: NativeUpdateHistoryEntry[], self?: string) => {
    const remaining = [...written];
    let predecessor: Predecessor | undefined, before=source.input.before, baseline=clean(source.input.baseline);
    const sources=new Map(source.templateInventory?.consumers.map(c=>[c.operationId,c])??[]);
    const retained=new Map<string,NativeTemplateConsumerInput>();
    const callers=(ids=[...sources.keys()])=>ids.map(id=>{
      const original=sources.get(id);if(!original)throw Error('native-update-template-consumer-missing');
      return retained.get(id)??{input:original.input,baseline:original.baseline};
    });
    const pins=(ids=[...sources.keys()])=>ids.map(operationId=>({operationId,journalRevision:sources.get(operationId)!.journalRevision}));
    while (remaining.length) {
      const candidates=remaining.filter(e => same(historyPins(parentId,e.proposalId).predecessor,predecessor));
      if(candidates.length!==1) throw Error('native-update-history-branch-or-gap');
      const entry=candidates[0],record=read(parentId,entry.proposalId),plan=record.update.plan;
      if(record.parentJournalRevision!==source.parentJournalRevision || !same(plan.before,before) || !same(plan.baseline,baseline))
        throw Error('native-update-history-baseline-changed');
      remaining.splice(remaining.indexOf(entry),1);
      let selected=callers();
      if(plan.kind==='native-contract-template-value-update') {
        const input=templateUpdateInput(plan),ids=input.consumers!.map(c=>c.input.operation.id);
        selected=callers(ids);
        if(!same(record.consumerPins,pins(ids))||!same(input.consumers,selected)||
            [...retained.keys()].some(id=>!ids.includes(id)))throw Error('native-update-template-consumer-history-changed');
      } else if(record.consumerPins||retained.size)throw Error('native-update-template-consumer-history-changed');
      if(entry.proposalId===self) {
        if(remaining.length) throw Error('native-update-superseded');
        return {predecessor,before,baseline,templateConsumers:selected,consumerPins:record.consumerPins};
      }
      if(entry.phase!=='update-verified' || entry.pending || !entry.receipt || !HASH.test(entry.journalRevision) ||
          !nativeContractUpdateMatches(plan,entry.receipt,true)) throw Error('native-update-effective-observation-unavailable');
      predecessor={proposalId:entry.proposalId,journalRevision:entry.journalRevision};
      if(plan.kind==='native-contract-template-value-update')
        for(const state of nativeAppUpdateConsumersAfter(plan,entry.receipt))retained.set(state.input.operation.id,state);
      before=nativeContractUpdateAfter(plan,entry.receipt);baseline=clean(nativeAppUpdateMainReadback(plan,entry.receipt));
    }
    return {predecessor,before,baseline,templateConsumers:callers(),consumerPins:source.templateInventory?pins():undefined};
  };
  const compile = (parentId: string, self?: string, birth?:ReactComparisonBirth): Record => {
    const written = history?.(parentId) ?? [];
    const roots = written.map(entry => historyPins(parentId,entry.proposalId)).filter(record => !record.predecessor);
    if (written.length && roots.length !== 1) throw Error('native-update-history-branch-or-gap');
    // Only a written correction can select a saved parent prefix. Unapplied
    // proposals still require the latest observation and cannot pin stale data.
    const selectedPins=new Map<string,ConsumerPin>();
    for(const entry of written)for(const pin of historyPins(parentId,entry.proposalId).consumerPins??[]) {
      if(selectedPins.has(pin.operationId)&&!same(selectedPins.get(pin.operationId),pin))throw Error('native-update-template-consumer-history-changed');
      selectedPins.set(pin.operationId,pin);
    }
    const source = derive(parentId, roots[0]?.parentJournalRevision,[...selectedPins.values()].sort((a,b)=>a.operationId.localeCompare(b.operationId)),birth);
    if (!HASH.test(source.parentJournalRevision)) throw Error('native-update-parent-journal-invalid');
    const tip=chain(parentId,source,written,self);
    const savedSelf=self&&written.some(e=>e.proposalId===self)?read(parentId,self):undefined;
    const savedTemplate=savedSelf?.update.plan.kind==='native-contract-template-value-update'?savedSelf.update.plan.template:undefined;
    const update=prepareNativeContractUpdate({...source.input,before:tip.before,baseline:tip.baseline,
      ...(source.templateInventory?{templateCallerIdentity:savedSelf?savedTemplate?.input.callerIdentity:'sdk-slot-alias-v1' as const}:{}),
      ...(source.templateInventory?{templateConsumers:tip.templateConsumers}:{})});
    // Reconstruct only authenticated WRITTEN legacy history, never an unapplied
    // proposal. The complete record still has to match below; compiler/source
    // drift cannot be hidden by removing this version field.
    if(self && written.some(entry=>entry.proposalId===self)) {
      const saved=read(parentId,self).update.plan;
      if(saved.kind==='native-contract-opacity-update' && saved.tokenChanges?.length && saved.tokenBindingScope===undefined &&
          update.plan.kind==='native-contract-opacity-update' && update.plan.tokenBindingScope==='document-v1') {
        delete update.plan.tokenBindingScope;update.revision=revisionOf(update.plan);
      }
    }
    const template=update.plan.kind==='native-contract-template-value-update';
    if(template&&!source.templateInventory)throw Error('native-update-template-inventory-required');
    return { version: template?2:1, parentId, parentJournalRevision: source.parentJournalRevision,
      ...(template?{consumerPins:tip.consumerPins,templateContextRevision:savedSelf?.templateContextRevision??source.templateInventory!.currentRevision}:{}),
      ...(tip.predecessor ? {predecessor:tip.predecessor} : {}), update };
  };
  const read = (parentId: string, id: string): Record => evidenceReadOnce(displayScope, {parentId,id}, () => {
    if (!HASH.test(id)) throw Error('native-update-plan-id-invalid');
    const dir=directory(parentId); if (!dir) throw Error('native-update-plan-unavailable');
    const file=path.join(dir,id+'.json'),stat=lstatSync(file);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size>4*1024*1024) throw Error('native-update-plan-file-invalid');
    const raw=JSON.parse(readFileSync(file,'utf8'));
    if(![1,2].includes(raw.version)||raw.parentId!==parentId||revisionOf(raw).slice(7)!==id)throw Error('native-update-plan-changed');
    const record:Record=raw.version===2?{...raw,update:prepareNativeTemplateAppUpdate(raw.update.template,raw.update.desiredRevision)}:raw;
    if(revisionOf(record.update.plan)!==raw.update.revision || !same(packed(record),raw) ||
      (record.version===2)!==(record.update.plan.kind==='native-contract-template-value-update'))throw Error('native-update-plan-changed');
    if(record.version===2 && (!HASH.test(record.parentJournalRevision)||!/^sha256:[a-f0-9]{64}$/.test(record.templateContextRevision??'')||
      !Array.isArray(record.consumerPins)||record.consumerPins.some(p=>!p||!UUID.test(p.operationId)||!HASH.test(p.journalRevision))||
      new Set(record.consumerPins.map(p=>p.operationId)).size!==record.consumerPins.length||
      record.update.plan.kind==='native-contract-template-value-update' &&
        !same(record.consumerPins.map(p=>p.operationId),record.update.plan.template.input.consumers.map(c=>c.input.operation.id))))
      throw Error('native-update-template-record-invalid');
    return record;
  });
  // History traversal needs these pins repeatedly, not an independent copy of
  // every full plan at every comparison. Reuse only this projection within the
  // current synchronous display; authorizing reads outside it remain fresh.
  const historyPins = (parentId:string,id:string) => evidenceReadOnce(displayScope + ':history-pins', {parentId,id}, () => {
    const record=read(parentId,id);
    return {predecessor:record.predecessor,parentJournalRevision:record.parentJournalRevision,consumerPins:record.consumerPins};
  });
  const view = (record: Record) => ({ id: recordId(record), parentId: record.parentId, status:'planned' as const,
    qualification:'unapplied-update-proposal' as const, desiredRevision:record.update.plan.desiredRevision,
    changes:structuredClone(record.update.plan.changes),
    ...(record.update.plan.kind==='native-contract-token-allocation-update'?{
      tokenAllocations:structuredClone(record.update.plan.extension.additions),compilerReviewRequired:true as const}:{}),
    ...(record.update.plan.kind==='native-contract-template-value-update'?{templateValueChanges:structuredClone(record.update.plan.templateValueChanges),
      templateCallerCount:record.consumerPins!.length}:{}),
    ...(record.update.plan.kind === 'native-contract-bound-cross-size-update' ? {
      boundCrossSize: true,
      layoutChanges: record.update.plan.derived.flatMap(change => (['x','y'] as const).flatMap(channel =>
        typeof change.before[channel] === 'number' && typeof change.after[channel] === 'number'
          ? [{nodeId:change.nodeId,channel,before:change.before[channel],after:change.after[channel]}] : [])),
    } : {}),
    // Variable values this update writes. Absent for every plan without them.
    ...('tokenChanges' in record.update.plan && record.update.plan.tokenChanges ? {tokenChanges:structuredClone(record.update.plan.tokenChanges),
      ...(record.update.plan.tokenBindingScope ? {tokenBindingScope:record.update.plan.tokenBindingScope} : {})} : {}),
    limitations:['live-preflight-required','application-delivery-pending','visual-fidelity-unqualified',
      // Historical plans keep their measured scope; they cannot authorize a new write.
      ...('tokenChanges' in record.update.plan && record.update.plan.tokenChanges?.length ?
        [record.update.plan.tokenBindingScope==='document-v1' ? 'document-binding-scan-required' : NATIVE_TOKEN_VALUE_SCOPE_LIMITATION] : [])] });
  return {
    historyPins,
    prepare(parentId: string) {
      assertOutsideEvidenceSnapshot();
      const record=compile(parentId);
      // A plan that writes only a variable value is not "no further changes".
      const writesVariables=record.update.plan.kind==='native-contract-token-allocation-update'||(record.update.plan.kind==='native-contract-template-value-update'?!!record.update.plan.templateValueChanges.length:'tokenChanges' in record.update.plan && !!record.update.plan.tokenChanges?.length);
      if(!record.update.plan.changes.length && !writesVariables && record.predecessor) {
        const previous=read(parentId,record.predecessor.proposalId);
        // Allocation establishes IDs, not component agreement. Even when the
        // following review finds no property changes, settle its own no-op
        // correction before offering design repair.
        // A caller added after the previous write was never covered by that
        // reader. Even with no value changes, settle a new combined proposal
        // containing the complete current inventory before reusing authority.
        if(previous.update.plan.kind!=='native-contract-token-allocation-update' &&
          same(record.consumerPins?.map(p=>p.operationId),previous.consumerPins?.map(p=>p.operationId)) &&
          same(compile(parentId,record.predecessor.proposalId),previous))return view(previous);
      }
      const id=recordId(record),dir=directory(parentId,true)!;
      const serialized=JSON.stringify(packed(record));if(Buffer.byteLength(serialized)>4*1024*1024)throw Error('native-update-plan-too-large');
      const file=path.join(dir,id+'.json');
      if (!existsSync(file)) {
        let fd: number | undefined;
        try { fd=openSync(file,'wx',0o600); writeFileSync(fd,serialized); fsyncSync(fd); }
        catch(error) { if((error as NodeJS.ErrnoException).code!=='EEXIST') throw error; }
        finally { if(fd!==undefined) closeSync(fd); }
        const parent=openSync(dir,'r'); try { fsyncSync(parent); } finally { closeSync(parent); }
      }
      if(canonicalJson(read(parentId,id))!==canonicalJson(record)) throw Error('native-update-plan-changed');
      return view(record);
    },
    list(parentId: string) {
      return evidenceReadOnce(displayScope + ':list', parentId, () => {
      const dir=directory(parentId); if (!dir) return [];
      return readdirSync(dir).filter(f=>/^[a-f0-9]{64}\.json$/.test(f)).sort().map(f=>view(read(parentId,f.slice(0,-5))));
      });
    },
    current(parentId: string,id: string,birth?:ReactComparisonBirth) {
      return evidenceReadOnce(displayScope + ':current', {parentId,id,birth}, () => {
        const record=read(parentId,id);
        if(canonicalJson(compile(parentId,id,birth))!==canonicalJson(record)) throw Error('native-update-input-changed');
        return structuredClone(record);
      });
    },
    saved(parentId: string, id: string) { return structuredClone(read(parentId, id)); },
    observationContext(parentId: string, id: string,birth?:ReactComparisonBirth) {
      const record=read(parentId,id),baselineRevision=record.parentJournalRevision;
      const currentRevision=currentParentRevision?.(parentId) ?? baselineRevision;
      if (!HASH.test(currentRevision)) throw Error('native-update-parent-journal-invalid');
      if(record.version===2&&!currentTemplateInventory)throw Error('native-update-template-context-unavailable');
      const inventory=record.version===2?currentTemplateInventory!(parentId,record.consumerPins!,birth):undefined;
      if(inventory&&!same(inventory.consumers.map(c=>c.operationId),record.consumerPins!.map(p=>p.operationId)))
        throw Error('native-update-template-consumer-inventory-refresh-required');
      const templateCurrentRevision=inventory?.currentRevision;
      if(templateCurrentRevision!==undefined&&!/^sha256:[a-f0-9]{64}$/.test(templateCurrentRevision))throw Error('native-update-template-context-invalid');
      return {baselineRevision,currentRevision,...(record.version===2?{
        templateBaselineRevision:record.templateContextRevision,
        templateCurrentRevision}:{})};
    },
  };
}
