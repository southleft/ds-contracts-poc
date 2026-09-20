import {randomUUID} from 'node:crypto';
import {assertOutsideEvidenceSnapshot,evidenceReadOnce} from './evidence-read-snapshot.js';
/** Immutable, host-derived update proposals. This store never dispatches a
 * program or authorizes applying a stale proposal; delivery reauthentication
 * must call current() before any future write. */
import { closeSync, existsSync, fsyncSync, lstatSync, mkdirSync, openSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { canonicalJson, revisionOf } from '../core/contract-provenance.js';
import { prepareNativeContractUpdate, nativeContractUpdateMatches, nativeContractUpdateAfter, type NativeContractUpdateInput } from '../core/native-contract-update.js';
const UUID = /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/;
/** Named on every proposal that writes a variable value. */
export const NATIVE_TOKEN_VALUE_SCOPE_LIMITATION = 'variable-bindings-on-other-pages-unchecked';
const HASH = /^[a-f0-9]{64}$/;
export interface NativeUpdateHistoryEntry {
  proposalId: string; journalRevision: string; phase: string; pending: boolean;
  receipt?: NativeContractUpdateInput['baseline'];
}
export function createNativeUpdatePlans(repo: string,
  derive: (parentId: string, parentJournalRevision?: string) => { parentJournalRevision: string; input: NativeContractUpdateInput },
  history?: (parentId: string) => NativeUpdateHistoryEntry[],
  currentParentRevision?: (parentId: string) => string) {
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
  type Record = { version: 1; parentId: string; parentJournalRevision: string;
    predecessor?: Predecessor; update: ReturnType<typeof prepareNativeContractUpdate> };
  const same = (a: unknown, b: unknown) => canonicalJson(a) === canonicalJson(b);
  const clean = (receipt: NativeContractUpdateInput['baseline']) => { const r=structuredClone(receipt);delete r.images;return r; };
  // Each written correction must be a single successor of the last verified
  // observation. Historical compiler output is evidence, not current authority.
  const chain = (parentId: string, source: ReturnType<typeof derive>, written: NativeUpdateHistoryEntry[], self?: string) => {
    const remaining = [...written];
    let predecessor: Predecessor | undefined, before=source.input.before, baseline=clean(source.input.baseline);
    while (remaining.length) {
      const candidates=remaining.filter(e => same(read(parentId,e.proposalId).predecessor,predecessor));
      if(candidates.length!==1) throw Error('native-update-history-branch-or-gap');
      const entry=candidates[0],record=read(parentId,entry.proposalId),plan=record.update.plan;
      if(record.parentJournalRevision!==source.parentJournalRevision || !same(plan.before,before) || !same(plan.baseline,baseline))
        throw Error('native-update-history-baseline-changed');
      remaining.splice(remaining.indexOf(entry),1);
      if(entry.proposalId===self) {
        if(remaining.length) throw Error('native-update-superseded');
        return {predecessor,before,baseline};
      }
      if(entry.phase!=='update-verified' || entry.pending || !entry.receipt || !HASH.test(entry.journalRevision) ||
          !nativeContractUpdateMatches(plan,entry.receipt,true)) throw Error('native-update-effective-observation-unavailable');
      predecessor={proposalId:entry.proposalId,journalRevision:entry.journalRevision};
      before=nativeContractUpdateAfter(plan,entry.receipt);baseline=clean(entry.receipt);
    }
    return {predecessor,before,baseline};
  };
  const compile = (parentId: string, self?: string): Record => {
    const written = history?.(parentId) ?? [];
    const roots = written.map(entry => read(parentId,entry.proposalId)).filter(record => !record.predecessor);
    if (written.length && roots.length !== 1) throw Error('native-update-history-branch-or-gap');
    // Only a written correction can select a saved parent prefix. Unapplied
    // proposals still require the latest observation and cannot pin stale data.
    const source = derive(parentId, roots[0]?.parentJournalRevision);
    if (!HASH.test(source.parentJournalRevision)) throw Error('native-update-parent-journal-invalid');
    const tip=chain(parentId,source,written,self);
    return { version: 1, parentId, parentJournalRevision: source.parentJournalRevision,
      ...(tip.predecessor ? {predecessor:tip.predecessor} : {}),
      update: prepareNativeContractUpdate({...source.input,before:tip.before,baseline:tip.baseline}) };
  };
  const read = (parentId: string, id: string): Record => evidenceReadOnce(displayScope, {parentId,id}, () => {
    if (!HASH.test(id)) throw Error('native-update-plan-id-invalid');
    const dir=directory(parentId); if (!dir) throw Error('native-update-plan-unavailable');
    const file=path.join(dir,id+'.json'),stat=lstatSync(file);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size>4*1024*1024) throw Error('native-update-plan-file-invalid');
    const record=JSON.parse(readFileSync(file,'utf8')) as Record;
    if (record.version!==1 || record.parentId!==parentId || revisionOf(record).slice(7)!==id ||
        revisionOf(record.update.plan)!==record.update.revision) throw Error('native-update-plan-changed');
    return record;
  });
  const view = (record: Record) => ({ id: revisionOf(record).slice(7), parentId: record.parentId, status:'planned' as const,
    qualification:'unapplied-update-proposal' as const, desiredRevision:record.update.plan.desiredRevision,
    changes:structuredClone(record.update.plan.changes),
    // Variable values this update writes. Absent for every plan without them.
    ...('tokenChanges' in record.update.plan && record.update.plan.tokenChanges ? {tokenChanges:structuredClone(record.update.plan.tokenChanges)} : {}),
    limitations:['live-preflight-required','application-delivery-pending','visual-fidelity-unqualified',
      // Measured before a variable write: this operation's page and every local
      // variable. A node on another page bound to it is not read (a full-file
      // walk is not affordable on large files), so it would follow the new value.
      ...('tokenChanges' in record.update.plan && record.update.plan.tokenChanges?.length ? [NATIVE_TOKEN_VALUE_SCOPE_LIMITATION] : [])] });
  return {
    prepare(parentId: string) {
      assertOutsideEvidenceSnapshot();
      const record=compile(parentId);
      // A plan that writes only a variable value is not "no further changes".
      const writesVariables='tokenChanges' in record.update.plan && !!record.update.plan.tokenChanges?.length;
      if(!record.update.plan.changes.length && !writesVariables && record.predecessor) {
        const previous=read(parentId,record.predecessor.proposalId);
        if(same(compile(parentId,record.predecessor.proposalId),previous))return view(previous);
      }
      const id=revisionOf(record).slice(7),dir=directory(parentId,true)!;
      const file=path.join(dir,id+'.json');
      if (!existsSync(file)) {
        let fd: number | undefined;
        try { fd=openSync(file,'wx',0o600); writeFileSync(fd,JSON.stringify(record)); fsyncSync(fd); }
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
    current(parentId: string,id: string) {
      return evidenceReadOnce(displayScope + ':current', {parentId,id}, () => {
        const record=read(parentId,id);
        if(canonicalJson(compile(parentId,id))!==canonicalJson(record)) throw Error('native-update-input-changed');
        return structuredClone(record);
      });
    },
    saved(parentId: string, id: string) { return structuredClone(read(parentId, id)); },
    observationContext(parentId: string, id: string) {
      const baselineRevision=read(parentId,id).parentJournalRevision;
      const currentRevision=currentParentRevision?.(parentId) ?? baselineRevision;
      if (!HASH.test(currentRevision)) throw Error('native-update-parent-journal-invalid');
      return {baselineRevision,currentRevision};
    },
  };
}
