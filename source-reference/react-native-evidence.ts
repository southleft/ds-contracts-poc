import {evidenceReadOnce} from './evidence-read-snapshot.js';
/** Host-owned selection and re-opening of sealed React source evidence.
 * No path, Contract, native ID or script is accepted from a browser request.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { revisionOf } from '../core/contract-provenance.js';
import { evidenceSha, evidenceUnchanged, inventoryEvidence } from './react-validation-evidence.js';
import { reactReferenceUnchanged, type ReactReference } from './react-reference.js';
import { reactSourceProgramUnchanged, type ReactSourceProgram } from './react-source-program.js';
import type { ReactOwnershipReport } from './react-ownership-run.js';
import { isReactNativeRequest, type ReactNativeRequest } from './react-native-request.js';
import { linkReactSourceAnatomy } from './react-source-anatomy.js';
import { deriveReactChildRoot } from './react-child-root.js';
import { readReactContentInspectionEvidence } from './react-content-inspection.js';
import { assembleReactRootMatrix, type ReactRootMatrix } from './react-root-matrix.js';
import {readReactContextualContent,type ReactContextualContent} from './react-contextual-content.js';
import type { ReactPropertySnapshot } from './react-root-variants.js';
import type { ReactChildRoot } from './react-child-root.js';
import type { NativeContractDraftSource } from '../core/native-contract-draft.js';

const fail = (): never => { throw Error('react-native-evidence-unavailable'); };
/** Compare source-derived facts, not the native compiler's cached output.
 * The archived native draft remains authenticated by the report and inventory
 * seals and is returned unchanged. Native planning separately requires explicit
 * fresh/correction authority when the current compiler differs from it. */
export function reactRootSourceMatrixMatches(saved: ReactRootMatrix, current: ReactRootMatrix): boolean {
  if (saved.draft?.status !== 'native-compiled' || current.draft?.status !== 'native-compiled')
    return revisionOf(saved) === revisionOf(current);
  const source = (matrix: ReactRootMatrix) => {
    const copy = structuredClone(matrix);
    delete copy.draft!.native;
    return copy;
  };
  return revisionOf(source(saved)) === revisionOf(source(current));
}
/** Only call with the current runner's already authenticated report. */
export function selectReactNativeRequest(repoRoot: string, report: ReactOwnershipReport, caseId: string): ReactNativeRequest {
  const row = report.rows.find(r => r.id === caseId);
  if (!row) return fail();
  if (report.state !== 'complete' || !report.sourceUnchanged || report.problem ||
      !row?.matched || row.problems.length || row.rootMatrix?.draft?.status !== 'native-compiled') fail();
  const dir = path.join(repoRoot, 'private/react-source-ownership', report.referenceId, report.id);
  const bytes = readFileSync(path.join(dir, 'report.json'));
  if (revisionOf(JSON.parse(bytes.toString())) !== revisionOf(report)) fail();
  const request: ReactNativeRequest = { version: 1, kind: 'react-root-draft', referenceId: report.referenceId,
    ownership: { id: report.id, sha256: evidenceSha(bytes) }, caseId,
    inventorySha256: evidenceSha(readFileSync(path.join(dir, 'integrity.json'))), matrixRevision: revisionOf(row.rootMatrix) };
  if (!isReactNativeRequest(request)) fail();
  return request;
}

function selectFromOwnershipReport(report: ReactOwnershipReport, caseId: string, reportSha256: string,
  inventorySha256: string): ReactNativeRequest {
  const row = report.rows.find(r => r.id === caseId);
  if (!row || report.state !== 'complete' || !report.sourceUnchanged || report.problem ||
      !row.matched || row.problems.length || row.rootMatrix?.draft?.status !== 'native-compiled') return fail();
  const request: ReactNativeRequest = { version: 1, kind: 'react-root-draft', referenceId: report.referenceId,
    ownership: { id: report.id, sha256: reportSha256 }, caseId, inventorySha256, matrixRevision: revisionOf(row.rootMatrix) };
  if (!isReactNativeRequest(request)) fail();
  return request;
}

export function selectReactChildRequest(repoRoot: string, reference: ReactReference, parent: ReactNativeRequest,
  instanceId: string, constraints?: ReactNativeRequest['constraints']): ReactNativeRequest {
  if (parent.version !== 1) throw Error('react-child-parent-root-required');
  const request: ReactNativeRequest = { ...structuredClone(parent), version: constraints ? 3 : 2, selection: { instanceId },
    ...(constraints ? {constraints:structuredClone(constraints)} : {}) };
  readReactNativeEvidence(repoRoot, reference, request);
  return request;
}

/** Existing journal requests retain these exact hashes across restarts. A new
 * request must first come from selectReactNativeRequest on a current runner. */
export function readReactNativeEvidence(repoRoot: string, reference: ReactReference, request: ReactNativeRequest, identity?: string) {
  return evidenceReadOnce('react-native', {repoRoot,referenceId:reference.id,files:reference.files,request,identity},
    ()=>{ const {matrix,source}=readReactNativeEvidenceFresh(repoRoot,reference,request,identity); return {matrix,source}; });
}
type OwnershipReadSnapshot = ReturnType<typeof readOwnershipSnapshot>;
/** Private data shared only by one synchronous family derivation. It is never
 * returned as authority, persisted, or reused by another preparation call. */
function readOwnershipSnapshot(repoRoot: string, reference: ReactReference, request: ReactNativeRequest,
  freshInventory = false) {
  if (!isReactNativeRequest(request) || reference.id !== request.referenceId || !reactReferenceUnchanged(reference)) fail();
  const dir = path.join(repoRoot, 'private/react-source-ownership', request.referenceId, request.ownership.id);
  const sealBytes = readFileSync(path.join(dir, 'integrity.json'));
  if (evidenceSha(sealBytes) !== request.inventorySha256) fail();
  const seal = JSON.parse(sealBytes.toString());
  if (seal.version !== 1 || !seal.files || typeof seal.files !== 'object' || Array.isArray(seal.files)) fail();
  const files = Object.fromEntries(Object.entries({ ...seal.files, 'integrity.json': request.inventorySha256 })
    .sort(([a], [b]) => a.localeCompare(b))) as Record<string, string>;
  if (freshInventory ? JSON.stringify(inventoryEvidence(dir)) !== JSON.stringify(files) : !evidenceUnchanged(dir, files)) fail();
  const reportBytes = readFileSync(path.join(dir, 'report.json'));
  if (evidenceSha(reportBytes) !== request.ownership.sha256) fail();
  const report = JSON.parse(reportBytes.toString()) as ReactOwnershipReport;
  const programBytes = readFileSync(path.join(dir, 'program.json'));
  const program = JSON.parse(programBytes.toString()) as ReactSourceProgram;
  if (!reactSourceProgramUnchanged(program) || !reactReferenceUnchanged(reference)) fail();
  return {dir, seal, files, report, program, programBytes, referenceId:request.referenceId,
    ownership:{...request.ownership}, inventorySha256:request.inventorySha256};
}

function readReactNativeEvidenceFresh(repoRoot: string, reference: ReactReference, request: ReactNativeRequest, identity?: string, shared?: OwnershipReadSnapshot): {
  matrix: ReactRootMatrix | ReactChildRoot; source: NativeContractDraftSource;
  program: ReactSourceProgram; contentContext?: ReactContextualContent;
} {
  if (!isReactNativeRequest(request) || reference.id !== request.referenceId) fail();
  const archive = shared ?? readOwnershipSnapshot(repoRoot, reference, request);
  if (archive.referenceId !== request.referenceId || archive.ownership.id !== request.ownership.id ||
      archive.ownership.sha256 !== request.ownership.sha256 || archive.inventorySha256 !== request.inventorySha256) fail();
  const {dir, seal, report, programBytes} = archive;
  // A member's proof readers cannot mutate data used by a later member.
  const savedRow = report.rows.find(r => r.id === request.caseId);
  const row = shared ? structuredClone(savedRow) : savedRow;
  if (!row) return fail();
  if (report.id !== request.ownership.id || report.referenceId !== request.referenceId ||
      report.state !== 'complete' || !report.sourceUnchanged || report.problem ||
      !row.matched || row.problems.length || row.rootMatrix?.draft?.status !== 'native-compiled' ||
      revisionOf(row.rootMatrix) !== request.matrixRevision) fail();
  const program = shared ? structuredClone(archive.program) : archive.program;
  if (shared && (!reactSourceProgramUnchanged(program) || !reactReferenceUnchanged(reference))) fail();
  const retainIdentity = identity !== undefined && identity !== row.rootMatrix!.draft!.contract?.id;
  if(retainIdentity&&(request.version!==1||!/^observed\.react-matrix-[a-f0-9]{16}$/.test(identity!)))
    throw Error('react-native-matrix-identity-invalid');
  const captured = request.version !== 1 || retainIdentity || row.rootMatrix!.contentContextRevision ? JSON.parse(readFileSync(path.join(dir, request.caseId, 'source-tree.json'), 'utf8')) : undefined;
  if (captured && (captured.status !== 'captured' || captured.problems.length || !captured.tree ||
      captured.treeSha256 !== evidenceSha(JSON.stringify(captured.tree)) || captured.treeSha256 !== row.treeSha256)) fail();
  let contentContext:ReactContextualContent|undefined;
  if(row.rootMatrix!.contentContextRevision){
    if(!row.ownership||!row.propertyMatrix||!row.helperObservations)return fail();
    contentContext=readReactContextualContent({referenceId:reference.id,sourceRoot:reference.sourceRoot,program,ownership:row.ownership,tree:captured.tree,helpers:row.helperObservations,wrappers:row.originalWrappers,
      read:(id,name)=>{const file=id.startsWith('wrapper-')?path.join(request.caseId,'original-wrappers',id.slice(8),name):path.join(request.caseId,'helpers',id,name);if(!Object.hasOwn(seal.files,file))return fail();return readFileSync(path.join(dir,file));}});
    if(contentContext.revision!==row.rootMatrix!.contentContextRevision)fail();
    const snapshots:Record<string,ReactPropertySnapshot>=Object.fromEntries(row.propertyMatrix.rows.map(effect=>{
      if(!/^\d+$/.test(effect.id))return fail();const file=path.join(request.caseId,'matrix',effect.id+'.json');
      if(!Object.hasOwn(seal.files,file))return fail();return [effect.id,JSON.parse(readFileSync(path.join(dir,file),'utf8'))];
    }));
    if(!reactRootSourceMatrixMatches(row.rootMatrix!,assembleReactRootMatrix(program,row.ownership,captured.tree,row.propertyMatrix,snapshots,undefined,contentContext)))
      throw Error('react-native-contextual-matrix-reassembly-changed');
  }
  let context,ownedEvidence;
  if(request.version===3) {
    const parent={...request,version:1 as const};delete parent.selection;delete parent.constraints;
    const pin=request.constraints!;
    const inspection=readReactContentInspectionEvidence(repoRoot,reference,parent,pin.operationId,{id:pin.id,inventorySha256:pin.inventorySha256});
    if(!inspection || inspection.report.phase!=='complete' || !inspection.report.sourceUnchanged ||
        inspection.report.gridConstraints?.status!=='observed') return fail();
    context={gridConstraints:inspection.report.gridConstraints};
    if(['authored-or-runtime','nested-caller-slot'].includes(linkReactSourceAnatomy(program,row.ownership!,captured.tree).instances.find(i=>i.instanceId===request.selection!.instanceId)?.content??'')) {
      const contentDir=path.join(repoRoot,'private/react-content-inspections',pin.operationId,pin.id);
      ownedEvidence={fonts:JSON.parse(readFileSync(path.join(contentDir,'text-fonts.json'),'utf8')),
        svg:JSON.parse(readFileSync(path.join(contentDir,'svg-viewports.json'),'utf8'))};
    }
  }
  let matrix = request.version === 1 ? structuredClone(row.rootMatrix!) : deriveReactChildRoot(program, row.ownership!, captured.tree,
    JSON.parse(readFileSync(path.join(dir, request.caseId, 'style-origin.json'), 'utf8')), request.selection!.instanceId,context,ownedEvidence);
  if(retainIdentity) {
    if(!row.propertyMatrix||!row.ownership)fail();
    const snapshots:Record<string,ReactPropertySnapshot>=Object.fromEntries(row.propertyMatrix!.rows.map(effect=>{
      if(!/^\d+$/.test(effect.id))return fail();
      const file=path.join(request.caseId,'matrix',effect.id+'.json');
      if(!Object.hasOwn(seal.files,file))return fail();
      return [effect.id,JSON.parse(readFileSync(path.join(dir,file),'utf8'))];
    }));
    const reassembled=assembleReactRootMatrix(program,row.ownership!,captured.tree,row.propertyMatrix!,snapshots,undefined,contentContext);
    if(!reactRootSourceMatrixMatches(row.rootMatrix!,reassembled))throw Error('react-native-matrix-reassembly-changed');
    matrix=assembleReactRootMatrix(program,row.ownership!,captured.tree,row.propertyMatrix!,snapshots,identity,contentContext);
    if(matrix.problems.length||matrix.draft?.status!=='native-compiled'||matrix.draft.problems.length)fail();
  }
  return { matrix, program, ...(contentContext?{contentContext}:{}), source: {
    revision: `sha256:${reference.id}`, programSha256: evidenceSha(programBytes), evidenceRevision: revisionOf(request),
  } };
}

export function readReactNativeContentEvidence(repoRoot: string, reference: ReactReference, request: ReactNativeRequest) {
  return evidenceReadOnce('react-native-content', {repoRoot,referenceId:reference.id,files:reference.files,request},
    () => readReactNativeContentEvidenceFresh(repoRoot, reference, request));
}
function readReactNativeContentEvidenceFresh(repoRoot: string, reference: ReactReference, request: ReactNativeRequest) {
  if (request.version !== 1) throw Error('react-child-content-requires-parent-comparison');
  const original = readReactNativeEvidence(repoRoot, reference, request);
  const dir = path.join(repoRoot, 'private/react-source-ownership', request.referenceId, request.ownership.id);
  const report = JSON.parse(readFileSync(path.join(dir, 'report.json'), 'utf8')) as ReactOwnershipReport;
  const captured = JSON.parse(readFileSync(path.join(dir, request.caseId, 'source-tree.json'), 'utf8')) as
    Awaited<ReturnType<typeof import('./capture.js').captureValidatedTree>>;
  if (captured.status !== 'captured' || captured.problems.length || !captured.tree ||
      captured.treeSha256 !== evidenceSha(Buffer.from(JSON.stringify(captured.tree))) ||
      captured.treeSha256 !== report.rows.find(row => row.id === request.caseId)?.treeSha256) return fail();
  return { ...original, captured, observedProps: structuredClone(report.rows.find(row => row.id === request.caseId)?.propertyMatrix?.heldProps) };
}

/** Read-only family plane access. Historical public evidence retains its exact
 * shape; this accessor additionally authenticates and returns the actual saved
 * singleton plane, never manufactures property-probe rows. */
export function readReactObservedFamilyPlane(repoRoot:string,reference:ReactReference,request:ReactNativeRequest) {
  return readObservedFamilyPlane(repoRoot,reference,request);
}
function readObservedFamilyPlane(repoRoot:string,reference:ReactReference,request:ReactNativeRequest,shared?:OwnershipReadSnapshot) {
  if(request.version!==1)throw Error('react-family-member-root-required');
  const original=readReactNativeEvidenceFresh(repoRoot,reference,request,undefined,shared);
  const dir=path.join(repoRoot,'private/react-source-ownership',request.referenceId,request.ownership.id);
  const report=shared?.report??JSON.parse(readFileSync(path.join(dir,'report.json'),'utf8')) as ReactOwnershipReport;
  const savedRow=report.rows.find(r=>r.id===request.caseId)!;
  const row=shared?structuredClone(savedRow):savedRow;
  const matrix=row.propertyMatrix;
  if(!row.ownership||!matrix||matrix.axes.length||matrix.planned!==1||matrix.rows.length!==1||
      matrix.problems.length||!matrix.rows[0].baseline||Object.keys(matrix.rows[0].changes).length)
    throw Error('react-family-singleton-plane-required');
  const plane=matrix.rows[0];
  if(!/^\d+$/.test(plane.id))throw Error('react-family-plane-id-invalid');
  const inventory=shared?.seal??JSON.parse(readFileSync(path.join(dir,'integrity.json'),'utf8'));
  for(const relative of [path.join(request.caseId,'source-tree.json'),path.join(request.caseId,'matrix',plane.id+'.json')])
    if(!Object.hasOwn(inventory.files,relative))throw Error('react-family-plane-not-in-inventory');
  const captured=JSON.parse(readFileSync(path.join(dir,request.caseId,'source-tree.json'),'utf8'));
  const snapshot=JSON.parse(readFileSync(path.join(dir,request.caseId,'matrix',plane.id+'.json'),'utf8')) as ReactPropertySnapshot;
  if(captured.status!=='captured'||captured.problems.length||captured.treeSha256!==row.treeSha256||
      captured.treeSha256!==evidenceSha(JSON.stringify(captured.tree)))throw Error('react-family-source-tree-changed');
  const reassembled=assembleReactRootMatrix(original.program,row.ownership,captured.tree,matrix,{[plane.id]:snapshot},undefined,original.contentContext);
  if(!reactRootSourceMatrixMatches(row.rootMatrix!,reassembled)||reassembled.draft?.status!=='native-compiled')
    throw Error('react-family-member-reassembly-changed');
  return {...original,row,matrix,plane,snapshot,captured};
}

/** Authenticate a whole selected family once per derivation, while retaining
 * every member's existing contextual and singleton-plane proof. The second
 * journal preparation calls this again; no read state survives this call. */
export function readReactObservedFamilyMembers(repoRoot:string,reference:ReactReference,
  report:ReactOwnershipReport,caseIds:readonly string[]) {
  if(caseIds.length<2||caseIds.length>32||new Set(caseIds).size!==caseIds.length)throw Error('react-family-members-invalid');
  const first=selectReactNativeRequest(repoRoot,report,caseIds[0]);
  const archive=readOwnershipSnapshot(repoRoot,reference,first,true);
  const requests=caseIds.map(id=>selectFromOwnershipReport(report,id,first.ownership.sha256,first.inventorySha256));
  const planes=requests.map(request=>readObservedFamilyPlane(repoRoot,reference,request,archive));
  // Re-read physical bytes, even inside an enclosing display read snapshot.
  // Sharing is not permission to accept a source/archive mutation mid-phase.
  if(!reactReferenceUnchanged(reference)||!reactSourceProgramUnchanged(archive.program)||
      JSON.stringify(inventoryEvidence(archive.dir))!==JSON.stringify(archive.files))fail();
  return {requests,planes};
}
