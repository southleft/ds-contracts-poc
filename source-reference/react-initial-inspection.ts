import {evidenceReadOnce} from './evidence-read-snapshot.js';
/** Targeted initial-state observation against an existing sealed ownership
 * archive. No native writes, arbitrary source paths, or matrix recapture. */
import { mkdirSync, readFileSync, writeFileSync, existsSync, renameSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { chromium } from 'playwright-core';
import { canonicalJson, revisionOf } from '../core/contract-provenance.js';
import { reactReferenceHtml, reactReferenceUnchanged, type ReactReference } from './react-reference.js';
import { readReactNativeEvidence } from './react-native-evidence.js';
import type { ReactNativeRequest } from './react-native-request.js';
import { isReactAuthoredNativeRequest, isReactAuthoredOperationRequest, reactAuthoredOwnershipAnchor,
  type ReactAuthoredNativeRequest, type ReactAuthoredInitialNativeRequest } from './react-authored-native-request.js';
import { readReactAuthoredNativeEvidence } from './react-authored-native-evidence.js';
import type { ReactOwnershipReport } from './react-ownership-run.js';
import { reactSourceProgramUnchanged, type ReactSourceProgram } from './react-source-program.js';
import { buildReactOwnershipReference, outermostRootOwners, reactOwnershipHook, reactOwnershipRead, reactOwnershipStructure, type ReactOwnership } from './react-ownership.js';
import { captureValidatedTree } from './capture.js';
import { watchSourceFailures } from './observe.js';
import { observeReactInitialStates } from './react-initial-state.js';
import { evidenceSha, inventoryEvidence, evidenceUnchanged } from './react-validation-evidence.js';
import { cropSourceFrame, type SourceFrame } from './source-framing.js';
import { compileReactInitialContract, reactInitialObservedRoot, reactInitialEvidenceUnobserved } from './react-initial-contract.js';
import { isReactInitialNativeRequest, type ReactInitialNativeRequest } from './react-initial-native-request.js';
import {observeReactAuthoredInitials,type ReactAuthoredInitialOrigins} from './react-authored-initial.js';
import {reactOwnershipEngine} from './react-ownership-run.js';
import {projectReactAuthoredInitial} from './react-authored-initial-contract.js';
import type {ReactAuthoredNamespace} from './react-authored-namespace.js';

export type ReactInspectionAnchor = ReactNativeRequest | ReactAuthoredNativeRequest;
export type ReactInspectionSource = { reference: ReactReference; anchor: ReactInspectionAnchor; anchors?: ReactNativeRequest[]; instanceId?: string };
export type ReactInspectionRequest = ({ anchor: ReactNativeRequest; caseId: string } & ({ version: 1 } | { version: 2; instanceId: string })) |
  { version: 3; anchor: ReactAuthoredNativeRequest; caseId: string; instanceId: string };
export function reactInspectionRequest(anchor: ReactInspectionAnchor, caseId: string, instanceId?: string): ReactInspectionRequest {
  if (instanceId !== undefined && !/^instance-\d+$/.test(instanceId)) throw Error('react-inspection-instance-invalid');
  if (anchor.kind === 'react-authored-draft') {
    if (!isReactAuthoredNativeRequest(anchor) || anchor.caseId !== caseId || instanceId === undefined)
      throw Error('react-inspection-authored-target-required');
    return { version: 3, anchor, caseId, instanceId };
  }
  return instanceId === undefined ? { version: 1, anchor, caseId } : { version: 2, anchor, caseId, instanceId };
}
type Request = ReactInspectionRequest;
/** The modules whose change alters what an initial-mount observation SAYS: the
 * run and its page, the planned domain, the fresh-mount probe, and every reader
 * whose output is sealed into `states/` (tree, ownership, anatomy link, style
 * origin and descendant sizes with their layout-unit rule, grids, fonts, SVG
 * viewports, bounds). ASSEMBLY is deliberately absent: react-initial-contract,
 * react-descendant-geometry, observed-content and the compiler re-run on every
 * read of the sealed observation, so their change never needs a new mount. The
 * root-visual `projection` saved beside a state is a by-product no initial-state
 * consumer reads, so its compiler is not the observer either. */
export const reactInitialObserverModules = ['react-initial-inspection.ts', 'react-initial-state.ts', 'react-program-proposal.ts',
  'react-property-effects.ts', 'react-property-probe.ts', 'react-ownership.ts', 'react-source-anatomy.ts', 'react-style-origin.ts', 'layout-unit.ts',
  'grid-constraints.ts', 'text-fonts.ts', 'svg-viewports.ts', 'pseudo-boxes.ts', '../extract/computed/unpainted-pseudo.ts',
  'source-framing.ts', 'capture.ts', 'observe.ts', 'react-reference.ts',
  '../extract/computed/capture.ts', '../extract/computed/lib.ts',
  // What is SEALED is spelled by these two: every image/tree hash and inventory (evidenceSha) and every treeRevision (revisionOf).
  'react-validation-evidence.ts', '../core/contract-provenance.ts'] as const;
export const observerIdentityUnavailable = 'observer-identity-unavailable';
/** Module hashes plus the browser that renders the mounts (a Chromium upgrade changes what an observation says).
 * Where the sources or the browser manifest cannot be read (a bundled deployment), the identity is the one named
 * marker: such a store never calls a saved run stale. */
export function reactInitialObserverIdentity(): Record<string, string> {
  try {
    const root = path.dirname(fileURLToPath(import.meta.url)), manifest = createRequire(import.meta.url).resolve('playwright-core/package.json');
    const chromiumBuild = (JSON.parse(readFileSync(path.join(path.dirname(manifest), 'browsers.json'), 'utf8')).browsers as Array<{ name: string; revision: string; browserVersion: string }>).find(b => b.name === 'chromium')!;
    return { ...reactOwnershipEngine(), ...Object.fromEntries([...reactInitialObserverModules,'react-authored-initial.ts','react-initial-capture.ts'].map(f => [f, evidenceSha(readFileSync(path.join(root, f)))])),
      'playwright-core': `${JSON.parse(readFileSync(manifest, 'utf8')).version} chromium ${chromiumBuild.browserVersion} r${chromiumBuild.revision}` };
  } catch { return { [observerIdentityUnavailable]: 'sources-or-browser-manifest-unreadable' }; }
}
/** May a COMPLETE run be observed again? Only when its recorded observer is not the current one, or when
 * today's assembler names evidence it never observed (whether or not an observer was recorded). An unrecorded run that assembles, or that
 * refuses for any reason a new mount cannot answer, stays final. `report.draft` must be today's derivation. */
export function reactInitialReobservable(report: ReactInitialInspection, observer: Record<string, string>): ReactInitialInspection['reobservable'] {
  if (report.phase !== 'complete' || Object.hasOwn(observer, observerIdentityUnavailable)) return undefined;
  if (report.observer && canonicalJson(report.observer) !== canonicalJson(observer)) return 'observer-changed';
  // Evidence can come to be read from a reader OUTSIDE the module list: an equal recorded observer must not strand the run.
  return !report.draft?.problems.some(reactInitialEvidenceUnobserved) ? undefined
    : report.observer ? 'evidence-unobserved-by-recorded-observer' : 'observer-unrecorded-and-evidence-unobserved';
}
export interface ReactInitialInspection {
  id: string; caseId: string; phase: 'running' | 'complete' | 'failed'; sourceUnchanged: boolean;
  instanceId?: string;
  /** Sealed with the run: the observer it was made with. Runs saved before this field carry none. */
  observer?: Record<string, string>;
  observation?: Awaited<ReturnType<typeof observeReactInitialStates>>; problems: string[];
  draft?: ReturnType<typeof compileReactInitialContract>;
  authoredOrigins?:ReactAuthoredInitialOrigins;
  authoredDraft?:ReturnType<typeof projectReactAuthoredInitial>;
  authoredProblem?:string;
  /** Derived on read, never saved. Why this COMPLETE run may be observed again; absent means it is final.
   * A run with no recorded observer that still assembles is not stale: nothing says a new mount would differ. */
  reobservable?: 'observer-changed' | 'evidence-unobserved-by-recorded-observer' | 'observer-unrecorded-and-evidence-unobserved';
  /** Derived on read: a later observation of this key that failed. It replaced nothing. */
  lastAttempt?: { id: string; problems: string[] };
}
export function readReactInspectionOriginal(repo: string, reference: ReactReference, request: Request) {
  reference.cohort.profile(request.caseId);
  if (request.version === 3) {
    const { draft } = readReactAuthoredNativeEvidence(repo, reference, request.anchor);
    if (request.caseId !== request.anchor.caseId || request.instanceId !== draft.fact?.instanceId ||
        !draft.boundaries.some(b => b.path === '' && b.instances.some(i => i.id === request.instanceId && i.roots.length === 1 && i.roots[0] === '')))
      throw Error('react-inspection-authored-target-mismatch');
  } else readReactNativeEvidence(repo, reference, request.anchor);
  const dir = path.join(repo, 'private/react-source-ownership', reference.id, request.anchor.ownership.id);
  const report = JSON.parse(readFileSync(path.join(dir, 'report.json'), 'utf8')) as ReactOwnershipReport;
  const row = report.rows.find(r => r.id === request.caseId);
  const captured = JSON.parse(readFileSync(path.join(dir, request.caseId, 'source-tree.json'), 'utf8'));
  if (!row?.matched || row.problems.length || !row.ownership || captured.status !== 'captured' ||
      captured.treeSha256 !== row.treeSha256 || captured.sourcePngSha256 !== row.sourceImage ||
      evidenceSha(JSON.stringify(captured.tree)) !== captured.treeSha256) throw Error('react-initial-original-unavailable');
  const programBytes = readFileSync(path.join(dir, 'program.json'));
  if (request.version === 2 && !row.ownership.components.some(c => c.id === request.instanceId && c.parent && c.roots.length === 1 && c.roots[0] !== ''))
    throw Error('react-inspection-nested-instance-unavailable');
  // The sealed ownership run records creation provenance with its observer
  // hook (authenticated there and by the archive); the ordinary behavior probe
  // reads the same ownership structure without that instrumentation. Every
  // request version compares that explicit projection, not runtime invocation
  // counters; no archived facts or source identities are rewritten. Seals made
  // before the observer existed carry no creation fields, so this is a no-op.
  return { captured, ownership: reactOwnershipStructure(row.ownership), program: JSON.parse(programBytes.toString()) as ReactSourceProgram,
    programSha256: evidenceSha(programBytes) };
}
export function createReactInitialInspectionStore(repo: string, sourceRoot: string,
  select: (referenceId: string, caseId: string) => ReactInspectionSource,
  /** Read once: the identity of the observer this process loaded. */
  observer: Record<string, string> = reactInitialObserverIdentity()) {
  const active = new Map<string, { state: ReactInitialInspection; promise: Promise<void>; request: Request }>();
  const attempts = new Map<string, NonNullable<ReactInitialInspection['lastAttempt']>>();
  const reobservable = (report: ReactInitialInspection) => reactInitialReobservable(report, observer);
  const from = (reference: ReactReference, request: Request) => {
    const source = readReactInspectionOriginal(repo, reference, request), key = revisionOf(request).slice(7);
    return { reference, request, source, key, root: path.join(repo, 'private/react-initial-inspections', key) };
  };
  const input = (referenceId: string, caseId: string, instanceId?: string) => {
    const selected = select(referenceId, caseId), { reference } = selected;
    const target = instanceId ?? selected.instanceId;
    // A different root in the same sealed cohort may become the selected
    // anchor after a compiler change. Reopen its existing initial observation
    // without recapturing or rewriting it. Only host-verified root requests
    // with the exact same source archive are eligible; from/saved still verify
    // the full request, current files and immutable evidence inventory.
    const candidates = [selected.anchor, ...(selected.anchors ?? []).filter(anchor =>
      anchor.referenceId === selected.anchor.referenceId &&
      anchor.inventorySha256 === selected.anchor.inventorySha256 &&
      revisionOf(anchor.ownership) === revisionOf(selected.anchor.ownership))];
    const anchor = candidates.find(anchor => existsSync(path.join(repo, 'private/react-initial-inspections',
      revisionOf(reactInspectionRequest(anchor, caseId, target)).slice(7), 'latest.json'))) ?? selected.anchor;
    return from(reference, reactInspectionRequest(anchor, caseId, target));
  };
  const saved = (value: ReturnType<typeof input>, pinned?: ReactInitialNativeRequest['observation']) => {
    const pointer = path.join(value.root, 'latest.json');
    if (!pinned && !existsSync(pointer)) return undefined;
    const latest = pinned ?? JSON.parse(readFileSync(pointer, 'utf8'));
    if (!/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/.test(latest.id)) throw Error('react-initial-record-invalid');
    const dir = path.join(value.root, latest.id), sealBytes = readFileSync(path.join(dir, 'integrity.json'));
    if (evidenceSha(sealBytes) !== latest.inventorySha256) throw Error('react-initial-inventory-changed');
    const seal = JSON.parse(sealBytes.toString());
    const inventory = Object.fromEntries(Object.entries({ ...seal.files, 'integrity.json': latest.inventorySha256 }).sort(([a], [b]) => a.localeCompare(b))) as Record<string,string>;
    if (seal.version !== 1 || !evidenceUnchanged(dir, inventory) ||
        revisionOf(JSON.parse(readFileSync(path.join(dir, 'request.json'), 'utf8'))) !== revisionOf(value.request)) throw Error('react-initial-evidence-changed');
    const reportBytes = readFileSync(path.join(dir, 'report.json'));
    if (pinned && evidenceSha(reportBytes) !== pinned.reportSha256) throw Error('react-initial-report-changed');
    const report = JSON.parse(reportBytes.toString()) as ReactInitialInspection;
    if (report.id !== latest.id || report.caseId !== value.request.caseId || report.phase === 'running' ||
        report.instanceId !== (value.request.version !== 1 ? value.request.instanceId : undefined)) throw Error('react-initial-report-invalid');
    return { dir, report, pin: { id: latest.id as string, inventorySha256: latest.inventorySha256 as string, reportSha256: evidenceSha(reportBytes) } };
  };
  const derive = (value: ReturnType<typeof input>, record: NonNullable<ReturnType<typeof saved>>, identity?: string, namespace?:ReactAuthoredNamespace) => {
    const report = structuredClone(record.report);
    // Only this invocation may mint an authored draft. A serialized claim in
    // an archive without its original render capabilities grants no authority.
    delete report.authoredDraft;
    delete report.authoredProblem;
    if (report.phase === 'complete' && report.observation) {
      const observedId = report.observation.instanceId;
      if (value.request.version !== 1 ? observedId !== value.request.instanceId :
          typeof observedId === 'string' && !value.source.ownership.components.some(c => c.id === observedId && c.roots.includes('')))
        throw Error('react-initial-observation-target-mismatch');
      const snapshots = Object.fromEntries(report.observation.rows.map(row => {
        if (!/^\d+$/.test(row.id)) throw Error('react-initial-row-invalid');
        return [row.id, JSON.parse(readFileSync(path.join(record.dir, 'states', row.id + '.json'), 'utf8'))];
      }));
      // Derived from authenticated immutable observations under today's compiler;
      // never overwrite the historical observation or accept a contract here.
      report.draft = compileReactInitialContract(value.source.program, value.source.ownership, value.source.captured.tree,
        report.observation, snapshots, identity);
      if(value.request.version===3&&report.authoredOrigins){
        try{report.authoredDraft=projectReactAuthoredInitial({reference:value.reference,program:value.source.program,ownership:value.source.ownership,
          tree:value.source.captured.tree,observation:report.observation,snapshots,caseId:value.request.caseId,origins:report.authoredOrigins,namespace,
          read:(id,name)=>readFileSync(path.join(record.dir,'authored-origins',id,name))});}
        catch(error){report.authoredProblem=error instanceof Error?error.message:String(error);}
      }
    }
    return report;
  };
  const read = (referenceId: string, caseId: string, instanceId?: string) => {
    const value = input(referenceId, caseId, instanceId), running = active.get(value.key);
    if (running) return structuredClone(running.state);
    const record = saved(value);
    if (!record) return undefined;
    const report = derive(value, record), again = reobservable(report), attempt = attempts.get(value.key);
    return { ...report, ...(again ? { reobservable: again } : {}), ...(attempt && attempt.id !== report.id ? { lastAttempt: attempt } : {}) };
  };
  const framedImage = (record: ReturnType<typeof saved>, jobId: string, rowId: string) => {
      const row = record?.report.observation?.rows.find(r => r.id === rowId && r.status === 'observed');
      if (!record || record.report.id !== jobId || !row?.image) throw Error('react-initial-image-unavailable');
      const png = readFileSync(path.join(record.dir, 'states', rowId + '.png'));
      const snapshot = JSON.parse(readFileSync(path.join(record.dir, 'states', rowId + '.json'), 'utf8'));
      if (evidenceSha(png) !== row.image || snapshot.image !== row.image || snapshot.treeSha256 !== row.treeSha256) throw Error('react-initial-image-changed');
      let bounds = snapshot.bounds;
      if (record.report.instanceId) {
        const instance = snapshot.ownership.components.find((c: ReactOwnership['components'][number]) => c.id === record.report.instanceId);
        if (instance?.roots.length !== 1) throw Error('react-initial-selection-evidence-unavailable');
        if (instance.roots[0] && (snapshot.initialSelection?.instanceId !== record.report.instanceId ||
            snapshot.initialSelection.path !== instance.roots[0] || !snapshot.initialSelection.bounds))
          throw Error('react-initial-selection-evidence-unavailable');
        if (instance.roots[0]) bounds = snapshot.initialSelection.bounds;
      }
      const cropped = cropSourceFrame(png, bounds);
      const frame: SourceFrame = { version: 1, sourceSha256: row.image, inputSha256: revisionOf({ pin: record.pin, rowId }).slice(7),
        imageSha256: evidenceSha(cropped.bytes), bounds, crop: cropped.crop, sourceSize: cropped.sourceSize, qualification: 'unqualified' };
      return { bytes: cropped.bytes, frame };
  };
  const nativeEvidenceFresh=(reference: ReactReference, request: ReactInitialNativeRequest, identity?: string) => {
      if (!isReactInitialNativeRequest(request) || reference.id !== request.anchor.referenceId)
        throw Error('react-initial-native-request-invalid');
      // Resolve the pinned archive directly, never via the latest pointer or
      // the journal's list/get path (which calls this evidence reader itself).
      const value = from(reference, reactInspectionRequest(request.anchor, request.caseId, request.version === 2 ? request.instanceId : undefined));
      const record = saved(value, request.observation)!;
      const report = derive(value, record, identity);
      if (report.phase !== 'complete' || !report.sourceUnchanged || report.problems.length || report.draft?.status !== 'compiled-draft')
        throw Error('react-initial-native-observation-unavailable');
      const trees = Object.fromEntries(report.draft.nativeVariants.map(variant => {
        const snapshot = JSON.parse(readFileSync(path.join(record.dir, 'states', variant.observation + '.json'), 'utf8'));
        return [variant.variant, reactInitialObservedRoot(snapshot, report.observation!.instanceId).root];
      }));
      const frames = Object.fromEntries(report.draft.nativeVariants.map(variant =>
        [variant.observation, framedImage(record, record.report.id, variant.observation).frame]));
      return { draft: report.draft, frames, composition: { source: report.observation!.source,
        heldProps: report.observation!.heldProps, trees }, source: { revision: 'sha256:' + reference.id,
        programSha256: value.source.programSha256, evidenceRevision: revisionOf(request) } };
  };
  const authoredValue = (reference:ReactReference, request:ReactAuthoredInitialNativeRequest) => {
    if(!isReactAuthoredOperationRequest(request)||request.version!==2||reference.id!==request.referenceId)
      throw Error('react-authored-initial-native-request-invalid');
    const value=from(reference,reactInspectionRequest(reactAuthoredOwnershipAnchor(request),request.caseId,request.initial.instanceId));
    if(value.key!==request.initial.key)throw Error('react-authored-initial-native-key-mismatch');
    return value;
  };
  const authoredReady = (value:ReturnType<typeof input>, record:NonNullable<ReturnType<typeof saved>>, namespace?:ReactAuthoredNamespace) => {
    const report=derive(value,record,undefined,namespace);
    if(value.request.version!==3||report.phase!=='complete'||!report.sourceUnchanged||report.problems.length||
       report.authoredProblem||report.authoredDraft?.status!=='native-compiled'||!report.observer||
       Object.hasOwn(observer,observerIdentityUnavailable)||canonicalJson(report.observer)!==canonicalJson(observer))
      throw Error('react-authored-initial-native-observation-unavailable');
    return report.authoredDraft;
  };
  const authoredNativeEvidenceFresh = (reference:ReactReference,request:ReactAuthoredInitialNativeRequest,namespace?:ReactAuthoredNamespace) => {
    const value=authoredValue(reference,request),record=saved(value,request.initial)!;
    const natural=authoredReady(value,record);
    if(revisionOf(natural)!==request.draftRevision)throw Error('react-authored-initial-native-draft-changed');
    const draft=namespace?authoredReady(value,record,namespace):natural;
    const frames=Object.fromEntries(draft.nativeVariants.map(v=>[v.observation,framedImage(record,record.report.id,v.observation).frame]));
    return {draft,frames,source:{revision:'sha256:'+reference.id,programSha256:value.source.programSha256,evidenceRevision:revisionOf(request)}};
  };
  return {
    read,
    running(request: ReactInspectionRequest) {
      const job = [...active.values()].find(({ request: r }) => r.caseId === request.caseId && r.version === request.version &&
        (r.version === 1 || request.version !== 1 && r.instanceId === request.instanceId) &&
        r.anchor.referenceId === request.anchor.referenceId && r.anchor.inventorySha256 === request.anchor.inventorySha256 &&
        revisionOf(r.anchor.ownership) === revisionOf(request.anchor.ownership));
      return job ? structuredClone(job.state) : undefined;
    },
    nativeRequest(referenceId: string, caseId: string, instanceId?: string): ReactInitialNativeRequest {
      const value = input(referenceId, caseId, instanceId), record = saved(value);
      if (value.request.version === 3) throw Error('react-initial-authored-native-unqualified');
      if (!record || active.has(value.key) || derive(value, record).draft?.status !== 'compiled-draft')
        throw Error('react-initial-native-observation-unavailable');
      return { ...value.request, kind: 'react-initial-draft', observation: record.pin };
    },
    operationRequest(referenceId:string,caseId:string,instanceId?:string):ReactInitialNativeRequest|ReactAuthoredInitialNativeRequest {
      const value=input(referenceId,caseId,instanceId),record=saved(value);
      if(!record||active.has(value.key))throw Error('react-initial-native-observation-unavailable');
      if(value.request.version!==3){
        if(derive(value,record).draft?.status!=='compiled-draft')throw Error('react-initial-native-observation-unavailable');
        return {...value.request,kind:'react-initial-draft',observation:record.pin};
      }
      const draft=authoredReady(value,record);
      return {...value.request.anchor,version:2,draftRevision:revisionOf(draft),initial:{...record.pin,key:value.key,
        instanceId:value.request.instanceId,anchorDraftRevision:value.request.anchor.draftRevision}};
    },
    authoredNativeEvidence(reference:ReactReference,request:ReactAuthoredInitialNativeRequest,namespace?:ReactAuthoredNamespace){
      return evidenceReadOnce('react-authored-initial',{repo,referenceId:reference.id,files:reference.files,request,...(namespace?{namespace:[...namespace]}:{})},
        ()=>authoredNativeEvidenceFresh(reference,request,namespace));
    },
    authoredNativeImage(reference:ReactReference,request:ReactAuthoredInitialNativeRequest,rowId:string){
      if(!/^\d+$/.test(rowId))throw Error('react-initial-row-invalid');
      const value=authoredValue(reference,request),record=saved(value,request.initial)!;
      const draft=authoredReady(value,record);
      if(revisionOf(draft)!==request.draftRevision||!draft.nativeVariants.some(v=>v.observation===rowId))
        throw Error('react-authored-initial-native-image-unavailable');
      return framedImage(record,request.initial.id,rowId).bytes;
    },
    /** `identity` compiles for an existing native component; see compileReactInitialContract. */
    nativeEvidence(reference:ReactReference,request:ReactInitialNativeRequest,identity?:string) {
      return evidenceReadOnce('react-initial',{repo,referenceId:reference.id,files:reference.files,request,identity},
        ()=>nativeEvidenceFresh(reference,request,identity));
    },
    /** Host-only repair input from the exact saved source/native pair. Never
     * choose the latest observation, accept a browser path, or drop a row. */
    repairEvidence(reference:ReactReference,request:ReactInitialNativeRequest,identity:string) {
      const evidence=nativeEvidenceFresh(reference,request,identity);
      const value=from(reference,reactInspectionRequest(request.anchor,request.caseId,request.version===2?request.instanceId:undefined));
      const record=saved(value,request.observation)!;
      const observation=record.report.observation!;
      const snapshots=Object.fromEntries(observation.rows.map(row=>{
        if(!/^\d+$/.test(row.id))throw Error('react-initial-row-invalid');
        return [row.id,JSON.parse(readFileSync(path.join(record.dir,'states',row.id+'.json'),'utf8'))];
      }));
      return {original:value.source,observation:structuredClone(observation),snapshots,
        nativeVariants:evidence.draft.nativeVariants};
    },
    nativeImage(reference: ReactReference, request: ReactInitialNativeRequest, rowId: string) {
      if (!isReactInitialNativeRequest(request) || reference.id !== request.anchor.referenceId || !/^\d+$/.test(rowId))
        throw Error('react-initial-native-image-invalid');
      const value = from(reference, reactInspectionRequest(request.anchor, request.caseId, request.version === 2 ? request.instanceId : undefined));
      return framedImage(saved(value, request.observation), request.observation.id, rowId).bytes;
    },
    image(referenceId: string, caseId: string, jobId: string, rowId: string, instanceId?: string) {
      if (!/^\d+$/.test(rowId)) throw Error('react-initial-row-invalid');
      return framedImage(saved(input(referenceId, caseId, instanceId)), jobId, rowId).bytes;
    },
    start(referenceId: string, caseId: string, instanceId?: string) {
      const value = input(referenceId, caseId, instanceId), existing = active.get(value.key);
      instanceId = value.request.version === 1 ? undefined : value.request.instanceId;
      if (existing) return existing;
      const prior = saved(value);
      // A complete run is final UNLESS its observer is not this one (or is unrecorded and the assembler names
      // evidence it never observed). Then a NEW run is made beside it; the old run is never rewritten or removed.
      if (prior?.report.phase === 'complete' && !reobservable(derive(value, prior))) return { state: prior.report, promise: Promise.resolve() };
      const state: ReactInitialInspection = { id: randomUUID(), caseId, ...(instanceId ? { instanceId } : {}), phase: 'running', sourceUnchanged: false, observer, problems: [] };
      const dir = path.join(value.root, state.id); mkdirSync(dir, { recursive: true });
      const save = (file: string, data: unknown) => writeFileSync(path.join(dir, file), JSON.stringify(data, null, 2) + '\n', { flag: 'wx' });
      save('request.json', value.request);
      const promise = (async () => {
        let browser;
        try {
          const observed = await buildReactOwnershipReference(sourceRoot, value.reference, value.source.program);
          // The guarded origin reader records the actual browser executable.
          browser = await chromium.launch(value.request.version===3?{args:['--enable-automation']}:{});
          const context = await browser.newContext({ viewport: { width: 900, height: 600 }, deviceScaleFactor: 1, colorScheme: 'light' });
          await context.addInitScript(reactOwnershipHook);
          const url = 'http://127.0.0.1/react-ownership?case=' + caseId;
          await context.route('**/*', r => r.request().url() === url ? r.fulfill({ status: 200, contentType: 'text/html',
            headers: { 'Content-Security-Policy': "sandbox allow-scripts; default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; font-src data:; img-src data:; connect-src 'none'" }, body: reactReferenceHtml(observed),
          }) : r.abort());
          const page = await context.newPage(), failures = watchSourceFailures(page), profile = value.reference.cohort.profile(caseId);
          try {
            await page.goto(url); await page.locator(profile.path[0]).waitFor({ state: 'attached', timeout: 15000 });
            const captured = await captureValidatedTree(page, profile, failures, '#root', '--');
            if (captured.status !== 'captured' || captured.treeSha256 !== value.source.captured.treeSha256 || captured.sourcePngSha256 !== value.source.captured.sourcePngSha256)
              throw Error('react-initial-original-render-changed');
            const ownership = await page.evaluate(reactOwnershipRead(profile.path[0])) as ReactOwnership;
            if (revisionOf(ownership) !== revisionOf(value.source.ownership)) throw Error('react-initial-original-ownership-changed');
            const targets = instanceId ? ownership.components.filter(c => c.id === instanceId) : outermostRootOwners(ownership.components);
            if (targets.length !== 1) throw Error('react-initial-root-ambiguous');
            state.observation = await observeReactInitialStates({ page, program: value.source.program, ownership, tree: captured.tree, image: captured.sourcePngSha256,
              instanceId: targets[0].id, selector: profile.path[0], dir: path.join(dir, 'states'), failures,
              assertCurrent: () => {
                if (!reactReferenceUnchanged(value.reference) || !reactSourceProgramUnchanged(value.source.program)) throw Error('react-initial-source-changed');
              } });
            if (!state.observation.planned || state.observation.problems.length || state.observation.rows.some(r => r.status !== 'observed' || !r.restored))
              throw Error('react-initial-observation-incomplete');
            if(value.request.version===3){
              const snapshots=Object.fromEntries(state.observation.rows.map(row=>[row.id,JSON.parse(readFileSync(path.join(dir,'states',row.id+'.json'),'utf8'))]));
              state.authoredOrigins=await observeReactAuthoredInitials({browser,reference:value.reference,program:value.source.program,ownership,
                tree:captured.tree,observation:state.observation,snapshots,caseId,dir:path.join(dir,'authored-origins'),
                assertCurrent:()=>{if(!reactReferenceUnchanged(value.reference)||!reactSourceProgramUnchanged(value.source.program))throw Error('react-initial-source-changed');}});
            }
            readReactInspectionOriginal(repo, value.reference, value.request);
            state.sourceUnchanged = true; state.phase = 'complete';
          } finally { failures.dispose(); }
        } catch (e) { state.phase = 'failed'; state.problems = [e instanceof Error ? e.message : String(e)]; }
        finally {
          try {
            await browser?.close(); save('report.json', state);
            save('integrity.json', { version: 1, files: inventoryEvidence(dir) });
            // A failed observation AGAIN replaces nothing: the complete run stays latest and the attempt is reported beside it.
            if (state.phase === 'complete' || prior?.report.phase !== 'complete') {
              writeFileSync(path.join(value.root, 'latest.tmp'), JSON.stringify({ id: state.id, inventorySha256: evidenceSha(readFileSync(path.join(dir, 'integrity.json'))) }));
              renameSync(path.join(value.root, 'latest.tmp'), path.join(value.root, 'latest.json'));
              attempts.delete(value.key);
            } else attempts.set(value.key, { id: state.id, problems: [...state.problems] });
          } finally { active.delete(value.key); }
        }
      })();
      const job = { state, promise, request: value.request }; active.set(value.key, job); return job;
    },
  };
}
