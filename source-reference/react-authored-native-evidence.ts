/** Reopen the original archive and rederive composition authority before each
 * plan or write. A serialized native-compiled flag is never write authority. */
import {readFileSync} from 'node:fs';
import path from 'node:path';
import {revisionOf} from '../core/contract-provenance.js';
import type {NativeContractDraftSource} from '../core/native-contract-draft.js';
import {evidenceReadOnce} from './evidence-read-snapshot.js';
import {evidenceSha,evidenceUnchanged} from './react-validation-evidence.js';
import {reactReferenceUnchanged,type ReactReference} from './react-reference.js';
import {reactSourceProgramUnchanged,type ReactSourceProgram} from './react-source-program.js';
import type {ReactOwnershipReport} from './react-ownership-run.js';
import {readReactAuthoredContent} from './react-authored-content.js';
import {projectReactAuthoredTree,type ReactAuthoredTreeDraft} from './react-authored-tree.js';
import {isReactAuthoredNativeRequest,type ReactAuthoredNativeRequest} from './react-authored-native-request.js';

const fail = (): never => {throw Error('react-authored-native-evidence-unavailable');};
export function selectReactAuthoredNativeRequest(repo: string, report: ReactOwnershipReport, caseId: string): ReactAuthoredNativeRequest {
  const rows = report.rows.filter(r => r.id === caseId), row = rows[0];
  const drafts = row?.authoredTrees?.filter(r => r.draft?.status === 'native-compiled') ?? [];
  if (rows.length !== 1 || report.state !== 'complete' || !report.sourceUnchanged || report.problem ||
      !row.matched || row.problems.length || drafts.length !== 1) return fail();
  const dir = path.join(repo,'private/react-source-ownership',report.referenceId,report.id);
  const bytes = readFileSync(path.join(dir,'report.json'));
  if (revisionOf(JSON.parse(bytes.toString())) !== revisionOf(report)) fail();
  const request: ReactAuthoredNativeRequest = {version:1,kind:'react-authored-draft',referenceId:report.referenceId,caseId,
    ownership:{id:report.id,sha256:evidenceSha(bytes)},inventorySha256:evidenceSha(readFileSync(path.join(dir,'integrity.json'))),
    helper:drafts[0].helper,draftRevision:revisionOf(drafts[0].draft)};
  if (!isReactAuthoredNativeRequest(request)) fail();
  return request;
}

export function readReactAuthoredNativeEvidence(repo: string, reference: ReactReference, request: ReactAuthoredNativeRequest):
  {draft: ReactAuthoredTreeDraft; source: NativeContractDraftSource} {
  return evidenceReadOnce('react-authored-native',{repo,referenceId:reference.id,files:reference.files,request},() => {
    if (!isReactAuthoredNativeRequest(request) || reference.id !== request.referenceId || !reactReferenceUnchanged(reference)) fail();
    const dir = path.join(repo,'private/react-source-ownership',request.referenceId,request.ownership.id);
    const bytes = readFileSync(path.join(dir,'integrity.json'));
    if (evidenceSha(bytes) !== request.inventorySha256) fail();
    const seal = JSON.parse(bytes.toString());
    if (seal.version !== 1 || !seal.files || typeof seal.files !== 'object' || Array.isArray(seal.files)) fail();
    const files = Object.fromEntries(Object.entries({...seal.files,'integrity.json':request.inventorySha256}).sort(([a],[b])=>a.localeCompare(b))) as Record<string,string>;
    if (!evidenceUnchanged(dir,files)) fail();
    const reportBytes = readFileSync(path.join(dir,'report.json'));
    if (evidenceSha(reportBytes) !== request.ownership.sha256) fail();
    const report = JSON.parse(reportBytes.toString()) as ReactOwnershipReport;
    if (report.id !== request.ownership.id || revisionOf(selectReactAuthoredNativeRequest(repo,report,request.caseId)) !== revisionOf(request)) fail();
    const row = report.rows.find(r=>r.id===request.caseId)!;
    const programBytes = readFileSync(path.join(dir,'program.json'));
    const program = JSON.parse(programBytes.toString()) as ReactSourceProgram;
    if (!reactSourceProgramUnchanged(program)) fail();
    const read = (name: string) => readFileSync(path.join(dir,request.caseId,name));
    const captured = JSON.parse(read('source-tree.json').toString());
    if (captured.status !== 'captured' || captured.problems.length || !captured.tree ||
        captured.treeSha256 !== evidenceSha(JSON.stringify(captured.tree)) || captured.treeSha256 !== row.treeSha256) fail();
    const baseline = row.propertyMatrix?.rows.filter(r=>r.baseline);
    if (baseline?.length !== 1 || !/^[a-zA-Z0-9-]+$/.test(baseline[0].id)) fail();
    const snapshot = JSON.parse(read('matrix/'+baseline![0].id+'.json').toString());
    const helper = row.jsxHelpers?.[request.helper];
    if (!row.ownership || !snapshot.fonts || snapshot.treeSha256 !== captured.treeSha256 ||
        revisionOf(snapshot.ownership) !== revisionOf(row.ownership) || helper?.path !== '') return fail();
    const content = readReactAuthoredContent({referenceId:reference.id,sourceRoot:reference.sourceRoot,program,ownership:row.ownership,
      tree:captured.tree,helper:helper.result,read:name=>read('jsx-helpers/'+request.helper+'/'+name)});
    const draft = projectReactAuthoredTree({content,program,ownership:row.ownership,tree:captured.tree,origin:snapshot.styleOrigin,fonts:snapshot.fonts});
    if (draft.status !== 'native-compiled' || draft.problems.length || revisionOf(draft) !== request.draftRevision ||
        !reactReferenceUnchanged(reference)) fail();
    return {draft,source:{revision:'sha256:'+reference.id,programSha256:evidenceSha(programBytes),evidenceRevision:revisionOf(request)}};
  });
}
