/** Read-only planning of source-value succession for an allocated template
 * graph. This is not a native write protocol: consumer guards, component
 * observations and an interruption-safe writer must qualify separately. */
import { canonicalJson, revisionOf } from './contract-provenance.js';
import { flattenTokens, aliasTarget } from './tokens.js';
import { planNativeRootTextTemplateGraph, type NativeRootTextTemplateGraph,
  type NativeRootTextTemplateGraphInput } from './native-root-text-template-graph.js';
import { emitNativeTemplateGraphReadbackScript, verifyNativeTemplateGraphReceipt, type NativeTemplateGraphIdentity,
  type NativeTemplateGraphReceipt } from './native-root-text-template-graph-native.js';

export interface NativeTemplateValueUpdateInput {
  before: NativeRootTextTemplateGraphInput;
  desired: NativeRootTextTemplateGraphInput;
  identity: NativeTemplateGraphIdentity;
  baseline: NativeTemplateGraphReceipt;
}
export interface NativeTemplateValueUpdatePlan extends NativeTemplateValueUpdateInput {
  version: 1;
  kind: 'native-template-value-update-candidate';
  writeAuthority: 'none';
  beforeGraphRevision: string;
  desiredGraphRevision: string;
  changes: Array<{
    tokenPath: string; variableId: string; variableKey: string; modeId: string;
    type: 'FLOAT' | 'COLOR';
    /** Actual independently observed value, including native float32 colours. */
    before: unknown;
    /** Compiler value; exact-or-float32 colour comparison remains unchanged. */
    after: unknown;
  }>;
  revision: string;
}
const same = (a: unknown, b: unknown) => canonicalJson(a) === canonicalJson(b);
function fail(why: string): never { throw Error(`native-template-value-update-${why}`); }

/** Everything governing allocation and routing remains fixed. Values and their
 * source-content hashes are deliberately absent, never the alias edges, scopes,
 * mode identities or requested/dependency path distinction. */
function topology(graph: NativeRootTextTemplateGraph) {
  const copy = structuredClone(graph);
  copy.revision = '';
  copy.template.revision = '';
  copy.template.tokenRevision = '';
  copy.sourceTokens.revision = '';
  copy.sourceTokens.source = { revision: '', sourceProgramSha256: '', tokensSha256: '' };
  for (const mode of copy.sourceTokens.modes) {
    mode.tokenTreeRevision = '';
    mode.rows = []; // Values also occur in rows; variables retain all alias edges.
  }
  for (const variable of copy.sourceTokens.variables) for (const value of variable.values)
    if (!(value.value && typeof value.value === 'object' && 'type' in value.value)) value.value = null as never;
  return copy;
}

function componentShape(input: NativeRootTextTemplateGraphInput, graph: NativeRootTextTemplateGraph) {
  const copy = structuredClone(input.component);
  const variables = new Map(graph.sourceTokens.variables.map(v => [v.name, v]));
  const number = (name: string | undefined): number => {
    const value = name && variables.get(name)?.values[0].value;
    if (value && typeof value === 'object' && 'type' in value) return number(value.targetName);
    if (typeof value !== 'number' || !Number.isFinite(value)) fail('bound-value-unqualified');
    return value;
  };
  const styles: Record<number, string> = { 100: 'Thin', 200: 'ExtraLight', 300: 'Light', 400: 'Regular',
    500: 'Medium', 600: 'SemiBold', 700: 'Bold', 800: 'ExtraBold', 900: 'Black' };
  const expectedStyles = new Set(['Medium']);
  for (const variant of copy.variants) {
    const text = variant.spec.children![0].children![0];
    const size = number(text.fontSizeVar), line = number(text.lineHeightVar), weight = number(text.fontWeightVar);
    const style = styles[weight], face = graph.template.typography.italic ? (style === 'Regular' ? 'Italic' : style + 'Italic') : style;
    if (size <= 0 || line <= 0 || text.fontSize !== size ||
        !same(text.lineHeight, { unit: 'PIXELS', value: line }) || !style ||
        text.fontStyle?.replaceAll(' ', '') !== face)
      fail('compiled-binding-value-changed');
    expectedStyles.add(text.fontStyle!);
    text.fontSize = 0; text.lineHeight = { unit: 'PIXELS', value: 0 }; text.fontStyle = '';
  }
  if (!same([...copy.fontStyles].sort(), [...expectedStyles].sort())) fail('compiled-font-inventory-changed');
  copy.fontStyles = [];
  return copy;
}

/** Re-derive both graphs and verify the complete old native inventory first.
 * A self-reported plan hash or name match supplies no allocation authority. */
export function planNativeTemplateValueUpdate(input: NativeTemplateValueUpdateInput): NativeTemplateValueUpdatePlan {
  if ('allocationBase' in input.before.tokens || 'allocationBase' in input.desired.tokens || 'extensions' in input.identity.source)
    fail('allocation-history-unqualified');
  const before = planNativeRootTextTemplateGraph(input.before);
  const desired = planNativeRootTextTemplateGraph(input.desired);
  verifyNativeTemplateGraphReceipt(input.before, input.identity, input.baseline);
  if (!same(topology(before), topology(desired))) fail('topology-changed');
  if (!same(componentShape(input.before, before), componentShape(input.desired, desired))) fail('component-changed');

  // Limit the source change itself, not merely the variables selected for this
  // graph. An unallocated leaf or metadata edit cannot disappear from a plan.
  const oldTree = input.before.tokens.modes[0].tokens;
  const newTree = input.desired.tokens.modes[0].tokens;
  const oldLeaves = flattenTokens(oldTree), newLeaves = flattenTokens(newTree);
  if (!same([...oldLeaves.keys()].sort(), [...newLeaves.keys()].sort())) fail('token-inventory-changed');
  const changed: string[] = [];
  for (const [path, oldLeaf] of oldLeaves) {
    const newLeaf = newLeaves.get(path)!;
    if (oldLeaf.type !== newLeaf.type) fail('token-type-changed');
    if (same(oldLeaf.value, newLeaf.value)) continue;
    if (aliasTarget(oldLeaf.value) !== null || aliasTarget(newLeaf.value) !== null) fail('source-alias-changed');
    if (!['number', 'dimension', 'fontWeight', 'color'].includes(oldLeaf.type ?? '')) fail('value-type-unqualified');
    if (!input.identity.source.variables.some(v => v.tokenPath === path)) fail('unallocated-value-changed');
    changed.push(path);
  }
  // Restore raw leaf values in place, preserving groups, metadata and spelling.
  // This rejects metadata or grouping edits that flattenTokens intentionally omits.
  const restored = structuredClone(newTree);
  const restore = (tree: Record<string, unknown>, prefix: string[]) => {
    for (const [key, child] of Object.entries(tree)) {
      if (key.startsWith('$') || !child || typeof child !== 'object' || Array.isArray(child)) continue;
      const node = child as Record<string, unknown>, path = [...prefix, key];
      if (Object.hasOwn(node, '$value')) {
        const original = oldLeaves.get(path.join('.'));
        if (!original) fail('token-inventory-changed');
        node.$value = structuredClone(original.value);
      } else restore(node, path);
    }
  };
  restore(restored, []);
  if (!same(restored, oldTree)) fail('token-metadata-changed');

  const changes: NativeTemplateValueUpdatePlan['changes'] = [];
  const modeId = input.identity.source.modes[0].modeId;
  for (const path of changed.sort()) {
    const oldValue = before.sourceTokens.variables.find(v => v.tokenPath === path)!;
    const newValue = desired.sourceTokens.variables.find(v => v.tokenPath === path)!;
    if (!['FLOAT', 'COLOR'].includes(newValue.resolvedType)) fail('value-type-unqualified');
    const identity = input.identity.source.variables.find(v => v.tokenPath === path)!;
    const observed = input.baseline.source.variables.find(v => v.id === identity.id)!;
    // A source spelling change with identical compiled values is a no-write
    // source succession. Its desired source hash is still pinned in the plan.
    if (same(oldValue.values[0].value, newValue.values[0].value)) continue;
    changes.push({ tokenPath: path, variableId: identity.id, variableKey: identity.key, modeId,
      type: newValue.resolvedType as 'FLOAT' | 'COLOR', before: structuredClone(observed.valuesByMode[modeId]),
      after: structuredClone(newValue.values[0].value) });
  }
  const body = { ...structuredClone(input), version: 1 as const, kind: 'native-template-value-update-candidate' as const,
    writeAuthority: 'none' as const, beforeGraphRevision: before.revision, desiredGraphRevision: desired.revision, changes };
  return { ...body, revision: revisionOf(body) };
}

export function verifyNativeTemplateValueUpdate(input: NativeTemplateValueUpdateInput, plan: NativeTemplateValueUpdatePlan): void {
  if (!same(planNativeTemplateValueUpdate(input), plan)) fail('plan-changed');
}

export interface NativeTemplateValueObservation {
  status: 'untouched' | 'updated' | 'partial' | 'no-op' | 'conflict';
  values: Array<{ tokenPath: string; state: 'before' | 'after' | 'both' }>;
  problems: string[];
}

/** Same stored-value representations accepted by the source-context verifier.
 * No tolerance, approximate colour matching or equal-valued alias substitution. */
function storedValue(actual: unknown, expected: unknown): boolean {
  if (same(actual, expected)) return true;
  if (typeof expected === 'number') return actual === Math.fround(expected);
  if (expected && typeof expected === 'object' && !Array.isArray(expected) &&
      Object.keys(expected).sort().join('|') === 'a|b|g|r')
    return same(actual, Object.fromEntries(Object.entries(expected).map(([key, value]) => [key, Math.fround(value)])));
  return false;
}

/** Classify a separately collected receipt without rewriting allocation
 * ownership or hiding drift elsewhere. A partial state is evidence for a
 * future recovery operation, never permission to resume or roll back. */
export function observeNativeTemplateValueUpdate(input: NativeTemplateValueUpdateInput, receipt: NativeTemplateGraphReceipt): NativeTemplateValueObservation {
  const out: NativeTemplateValueObservation = { status: 'conflict', values: [], problems: [] };
  try {
    const plan = planNativeTemplateValueUpdate(input), normalized = structuredClone(receipt);
    for (const change of plan.changes) {
      const variable = normalized.source.variables.find(v => v.id === change.variableId);
      if (!variable || variable.key !== change.variableKey || !Object.hasOwn(variable.valuesByMode, change.modeId)) fail('observation-identity');
      const actual = variable.valuesByMode[change.modeId];
      const before = storedValue(actual, change.before), after = storedValue(actual, change.after);
      if (!before && !after) fail('observation-value-conflict');
      out.values.push({ tokenPath: change.tokenPath, state: before && after ? 'both' : before ? 'before' : 'after' });
      variable.valuesByMode[change.modeId] = structuredClone(change.before) as typeof actual;
    }
    // Also catches extra variables/modes, altered scopes, unselected route
    // edges and source alias changes. Only the selected scalar leaves normalize.
    verifyNativeTemplateGraphReceipt(input.before, input.identity, normalized);
    if (!same(normalized, input.baseline)) fail('observation-baseline-conflict');
    const before = out.values.some(v => v.state === 'before'), after = out.values.some(v => v.state === 'after');
    out.status = before && after ? 'partial' : before ? 'untouched' : after ? 'updated' : 'no-op';
  } catch (error) {
    out.values = [];
    out.problems.push(error instanceof Error && /^(native-template-(value-update|graph)-|NATIVE_ROOT_TEXT_TEMPLATE_)/.test(error.message)
      ? error.message : 'native-template-value-update-observation-invalid');
  }
  return out;
}

/** Read only by saved IDs. The returned receipt retains original allocation
 * ownership; observeNativeTemplateValueUpdate supplies current-value checks. */
export function emitNativeTemplateValueReadbackScript(input: NativeTemplateValueUpdateInput): string {
  planNativeTemplateValueUpdate(input);
  return emitNativeTemplateGraphReadbackScript(input.before, input.identity);
}
