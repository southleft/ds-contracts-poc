/** Allocation acknowledgements retain IDs only. The independent readback is
 * the sole source of graph evidence used by a later component write. */
import { canonicalJson } from '../core/contract-provenance.js';
import type { NativeRootTextTemplateGraphInput } from '../core/native-root-text-template-graph.js';
import { emitNativeTemplateGraphReadbackScript, verifyNativeTemplateGraphReceipt,
  type NativeTemplateGraphIdentity } from '../core/native-root-text-template-graph-native.js';

const object = (v: unknown): v is Record<string, any> => !!v && typeof v === 'object' && !Array.isArray(v);
const same = (a: unknown, b: unknown) => canonicalJson(a) === canonicalJson(b);
export function acceptTemplateGraphAllocation(input: NativeRootTextTemplateGraphInput, revision: string, value: unknown) {
  const invalid = { phase: 'creation-invalid' as const, problems: ['native-operation-template-graph-allocation-invalid'] };
  if (!object(value) || value.version !== 1 || value.graphRevision !== revision || value.receiptKind !== 'creation-objects-only' ||
      value.acceptedContract !== null || value.nativeQualification !== 'unqualified' || !object(value.allocation) ||
      !Array.isArray(value.allocation.selectors) || !Array.isArray(value.allocation.routes) ||
      !Array.isArray(value.problems) || value.problems.some((p: unknown) => typeof p !== 'string')) return invalid;
  const source = value.allocation.source;
  if (value.status === 'refused') {
    const emptySource = source === null || object(source) && source.status === 'refused' &&
      object(source.allocation) && source.allocation.collection === null &&
      Array.isArray(source.allocation.modes) && !source.allocation.modes.length &&
      Array.isArray(source.allocation.variables) && !source.allocation.variables.length && !source.creationIdentity;
    return value.allocationAttempted === false && emptySource && !value.identity &&
      !value.allocation.selectors.length && !value.allocation.routes.length && value.problems.length
      ? { phase: 'creation-refused' as const, problems: ['native-operation-template-graph-creation-refused'] } : invalid;
  }
  // Partial allocation stays in the immutable event. There is no adoption or
  // blind retry path, and a partial graph cannot expose a verified context.
  if (value.status === 'partial-allocation') return value.allocationAttempted === true && value.problems.length
    ? { phase: 'partial-allocation' as const, problems: ['native-operation-template-graph-partial-allocation-retained'] } : invalid;
  if (value.status !== 'created-candidate' || value.allocationAttempted !== true || value.problems.length ||
      !object(source) || source.status !== 'created-candidate' || !object(source.allocation) ||
      !object(value.identity) || !same(source.creationIdentity, value.identity.source) ||
      !same(source.allocation.collection, value.identity.source?.collection) ||
      !same(source.allocation.modes, value.identity.source?.modes) ||
      !same(source.allocation.variables, value.identity.source?.variables) ||
      !same(value.allocation.selectors, value.identity.selectors) || !same(value.allocation.routes, value.identity.routes)) return invalid;
  try {
    const identity = value.identity as NativeTemplateGraphIdentity;
    emitNativeTemplateGraphReadbackScript(input, identity);
    return { phase: 'tokens-created' as const, identity: structuredClone(identity.source), templateGraphIdentity: structuredClone(identity), problems: [] };
  } catch { return invalid; }
}

export function observeTemplateGraph(input: NativeRootTextTemplateGraphInput, identity: NativeTemplateGraphIdentity | undefined, value: unknown) {
  const refused = { phase: 'observation-refused' as const, problems: ['native-operation-template-graph-readback-refused'] };
  if (!identity || !object(value) || value.version !== 1 || value.status !== 'readback-collected' ||
      value.receiptKind !== 'independent-native-readback' ||
      value.graphRevision !== identity.graphRevision || !Array.isArray(value.problems) || value.problems.length) return refused;
  try { verifyNativeTemplateGraphReceipt(input, identity, value.receipt); return { phase: 'tokens-observed' as const, problems: [] }; }
  catch { return refused; }
}
