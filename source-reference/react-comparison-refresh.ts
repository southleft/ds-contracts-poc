/** Read-only reinspection after verified main corrections. Creation authority
 * and native content metadata always remain pinned to the original plan. */
import { canonicalJson, revisionOf } from '../core/contract-provenance.js';
import { verifyNativeContractReadback } from '../core/native-source-observation.js';
import type { prepareReactComparisonPlan } from './react-comparison-plan.js';
import type { ReactComparisonRequest } from './react-comparison-request.js';
type Plan = ReturnType<typeof prepareReactComparisonPlan>;
export interface ReactComparisonRefresh { request: ReactComparisonRequest; plan: Plan }
const same = (a: unknown,b: unknown) => canonicalJson(a) === canonicalJson(b);

export function refreshedComparisonPlan(original: Plan, request: ReactComparisonRequest, refresh: ReactComparisonRefresh): Plan {
  const fail = (): never => { throw Error('react-comparison-refresh-changed-content-or-identity'); };
  const normalizedRequest = structuredClone(refresh.request);
  // A composed mapping revision includes compiler diagnostics. All original
  // source/archive pins remain identical; actual mappings are compared below.
  if (request.version === 2 && normalizedRequest.version === 2) normalizedRequest.composition = request.composition;
  if (!same(normalizedRequest,request) || refresh.plan.revision !== revisionOf(refresh.plan.plan)) fail();
  const normalized = structuredClone(refresh.plan.plan), old = original.plan;
  const pairs = [[old.comparison,normalized.comparison],
    ...(old.comparison.instances ?? []).map((ref,i)=>[ref,normalized.comparison.instances?.[i]])];
  for (const [before,after] of pairs) {
    if (!before || !after || verifyNativeContractReadback(after.parent,after.receipt).status !== 'supported-structure-observed') fail();
    const stableParent = structuredClone(after!.parent);
    stableParent.component = before!.parent.component;
    if (!same(stableParent,before!.parent)) fail();
    after!.parent = structuredClone(before!.parent); after!.receipt = structuredClone(before!.receipt);
  }
  normalized.comparison.projection.source.evidenceRevision = old.comparison.projection.source.evidenceRevision;
  normalized.comparison.revision = old.comparison.revision;
  // The content revision also covers compiler facts on the enclosing snapshot
  // root, which is replaced by a linked main. Every executable content spec,
  // font, token, mapping and projection identity must still match exactly.
  normalized.contentRevision = old.contentRevision;
  if (!same(normalized,old)) fail();
  const result = structuredClone(original);
  result.plan.comparison.parent = structuredClone(refresh.plan.plan.comparison.parent);
  result.plan.comparison.receipt = structuredClone(refresh.plan.plan.comparison.receipt);
  result.plan.comparison.instances?.forEach((ref,i)=>{
    ref.parent = structuredClone(refresh.plan.plan.comparison.instances![i].parent);
    ref.receipt = structuredClone(refresh.plan.plan.comparison.instances![i].receipt);
  });
  return result;
}
