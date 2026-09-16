/** Immutable, host-derived update proposals. This store never dispatches a
 * program or authorizes applying a stale proposal; delivery reauthentication
 * must call current() before any future write. */
import { closeSync, existsSync, fsyncSync, lstatSync, mkdirSync, openSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { canonicalJson, revisionOf } from '../core/contract-provenance.js';
import { prepareNativeContractUpdate, type NativeContractUpdateInput } from '../core/native-contract-update.js';
const UUID = /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/;
const HASH = /^[a-f0-9]{64}$/;
export function createNativeUpdatePlans(repo: string, derive: (parentId: string) => { parentJournalRevision: string; input: NativeContractUpdateInput }) {
  const root = path.join(repo, 'private', 'source-native-update-plans');
  function directory(parentId: string, create = false) {
    if (!UUID.test(parentId)) throw Error('native-update-parent-invalid');
    const target = path.join(root, parentId);
    for (const dir of [path.dirname(root), root, target]) {
      if (!existsSync(dir)) { if (!create) return undefined; mkdirSync(dir,{mode:0o700}); }
      const s=lstatSync(dir); if (!s.isDirectory() || s.isSymbolicLink()) throw Error('native-update-directory-invalid');
    }
    return target;
  }
  const compile = (parentId: string) => {
    const source = derive(parentId);
    if (!HASH.test(source.parentJournalRevision)) throw Error('native-update-parent-journal-invalid');
    return { version: 1 as const, parentId, parentJournalRevision: source.parentJournalRevision,
      update: prepareNativeContractUpdate(source.input) };
  };
  type Record = ReturnType<typeof compile>;
  const read = (parentId: string, id: string): Record => {
    if (!HASH.test(id)) throw Error('native-update-plan-id-invalid');
    const dir=directory(parentId); if (!dir) throw Error('native-update-plan-unavailable');
    const file=path.join(dir,id+'.json'),stat=lstatSync(file);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size>4*1024*1024) throw Error('native-update-plan-file-invalid');
    const record=JSON.parse(readFileSync(file,'utf8')) as Record;
    if (record.version!==1 || record.parentId!==parentId || revisionOf(record).slice(7)!==id ||
        revisionOf(record.update.plan)!==record.update.revision) throw Error('native-update-plan-changed');
    return record;
  };
  const view = (record: Record) => ({ id: revisionOf(record).slice(7), parentId: record.parentId, status:'planned' as const,
    qualification:'unapplied-update-proposal' as const, desiredRevision:record.update.plan.desiredRevision,
    changes:structuredClone(record.update.plan.changes), limitations:['live-preflight-required','application-delivery-pending','visual-fidelity-unqualified'] });
  return {
    prepare(parentId: string) {
      const record=compile(parentId),id=revisionOf(record).slice(7),dir=directory(parentId,true)!;
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
      const dir=directory(parentId); if (!dir) return [];
      return readdirSync(dir).filter(f=>/^[a-f0-9]{64}\.json$/.test(f)).sort().map(f=>view(read(parentId,f.slice(0,-5))));
    },
    current(parentId: string,id: string) {
      const record=read(parentId,id);
      if(canonicalJson(compile(parentId))!==canonicalJson(record)) throw Error('native-update-input-changed');
      return structuredClone(record);
    },
    saved(parentId: string, id: string) { return structuredClone(read(parentId, id)); },
  };
}
