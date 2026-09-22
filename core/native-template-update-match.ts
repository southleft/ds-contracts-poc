import { cleanNativeTemplateCallerReadback } from './native-template-caller-identity.js';
/** Exact native value propagation, separate from source-to-canvas fidelity.
 * A structurally valid graph is insufficient: every selected binding must
 * resolve to its intended scalar, and every other observed fact is preserved.
 * Computed geometry is never erased to make a typography update pass. */
import { canonicalJson } from './contract-provenance.js';
import type { NativeTemplateComponentUpdateInput, NativeTemplateComponentUpdatePlan } from './native-template-value-writer.js';
import { inspectNativeTemplateUpdateObservationContext, type NativeTemplateUpdateObservation } from './native-template-update-observation.js';
import type { NativeSourceReadback } from './native-source-observation.js';

const same = (a: unknown, b: unknown) => canonicalJson(a) === canonicalJson(b);
const stored = (a: unknown, b: unknown): boolean => typeof b === 'number' && Number.isFinite(b) && (a === b || a === Math.fround(b));
const fail = (why: string): never => { throw Error('native-template-update-' + why); };
const geometry = ['x', 'y', 'width', 'height', 'relativeTransform'];
const numericFields = new Set(['opacity', 'fontSize', 'fontWeight', 'lineHeight', 'width', 'height',
  'itemSpacing', 'counterAxisSpacing', 'paddingLeft', 'paddingRight', 'paddingTop', 'paddingBottom',
  'topLeftRadius', 'topRightRadius', 'bottomLeftRadius', 'bottomRightRadius', 'cornerRadius',
  'strokeWeight', 'strokeTopWeight', 'strokeBottomWeight', 'strokeLeftWeight', 'strokeRightWeight',
  'minWidth', 'maxWidth', 'minHeight', 'maxHeight']);

function resolver(plan: NativeTemplateComponentUpdatePlan) {
  const receipt = plan.baseline.templateGraph!.receipt;
  const variables = new Map<string, Record<string, any>>([...receipt.source.variables, ...receipt.routes].map(v => [v.id, v]));
  const changes = new Map(plan.valuePlan.changes.map(c => [c.variableId, c]));
  return (alias: unknown, modes: Record<string, string>) => {
    const walk = (ref: any, seen: Set<string>): { before: any; after: any; changed: boolean } | null => {
      if (!ref || ref.type !== 'VARIABLE_ALIAS' || typeof ref.id !== 'string') return null;
      const variable = variables.get(ref.id);
      if (!variable) return null; // Independent caller tokens must remain byte-exact.
      if (seen.has(ref.id)) return fail('binding-cycle');
      seen.add(ref.id);
      const mode = modes[variable.variableCollectionId];
      if (!mode || !Object.hasOwn(variable.valuesByMode, mode)) return fail('binding-mode');
      const before = variable.valuesByMode[mode];
      if (before && typeof before === 'object' && before.type === 'VARIABLE_ALIAS') {
        const value = walk(before, seen);
        if (!value) return fail('binding-target');
        return value;
      }
      const change = changes.get(ref.id);
      return { before, after: change?.modeId === mode ? change.after : before, changed: change?.modeId === mode };
    };
    return walk(alias, new Set());
  };
}

function weightName(old: Record<string, any>, next: Record<string, any>, before: number, after: number) {
  const styles: Record<number, string> = { 100: 'Thin', 200: 'ExtraLight', 300: 'Light', 400: 'Regular',
    500: 'Medium', 600: 'SemiBold', 700: 'Bold', 800: 'ExtraBold', 900: 'Black' };
  const italic = old.style?.replaceAll(' ', '').endsWith('Italic');
  const style = (weight: number) => italic ? (styles[weight] === 'Regular' ? 'Italic' : styles[weight] + 'Italic') : styles[weight];
  if (!styles[before] || !styles[after] || old.style?.replaceAll(' ', '') !== style(before) ||
      next.style?.replaceAll(' ', '') !== style(after)) fail('font-style-propagation');
  const normalized = structuredClone(next);
  normalized.style = old.style;
  if (old.variationSettings && Object.hasOwn(old.variationSettings, 'wght')) {
    if (!stored(old.variationSettings.wght, before) || !stored(next.variationSettings?.wght, after)) fail('font-axis-propagation');
    normalized.variationSettings.wght = old.variationSettings.wght;
  }
  if (!same(normalized, old)) fail('font-name-conflict');
}

/** Normalize only values proven to be the compiler's selected transition.
 * A matching alias with stale resolved paint is a failure, not success. */
function normalizeNodes(plan: NativeTemplateComponentUpdatePlan, baseline: NativeSourceReadback, observed: NativeSourceReadback) {
  const resolve = resolver(plan);
  if (!Array.isArray(observed.nodes) || !Array.isArray(baseline.nodes) || observed.nodes.length !== baseline.nodes.length)
    fail('node-inventory');
  for (const [index, old] of baseline.nodes!.entries()) {
    const row = observed.nodes![index];
    if (!row || row.id !== old.id) fail('node-inventory');
    const before = old.values, after = row.values, modes = before.resolvedVariableModes ?? {};
    if (!same(after.boundVariables, before.boundVariables) || !same(after.resolvedVariableModes, before.resolvedVariableModes)) fail('binding-conflict:' + old.id);
    const bindings = before.boundVariables ?? {};
    for (const [field, binding] of Object.entries(bindings)) {
      if (field === 'fills' || field === 'strokes') continue; // Verified per paint below.
      const aliases = Array.isArray(binding) ? binding : [binding];
      const values = aliases.map(a => resolve(a, modes));
      if (!values.some(v => v?.changed)) continue;
      if (aliases.length !== 1 || !numericFields.has(field)) fail('binding-field-unqualified:' + field);
      const value = values[0]!;
      if (field === 'lineHeight') {
        if (!same(Object.keys(before[field] ?? {}).sort(), ['unit', 'value']) || !same(Object.keys(after[field] ?? {}).sort(), ['unit', 'value']) ||
            before[field].unit !== 'PIXELS' || after[field].unit !== 'PIXELS' ||
            !stored(before[field].value, value.before) || !stored(after[field].value, value.after)) fail('scalar-propagation:' + old.id + ':' + field);
      } else if (!stored(before[field], value.before) || !stored(after[field], value.after)) fail('scalar-propagation:' + old.id + ':' + field);
      if (field === 'fontWeight') {
        weightName(before.fontName, after.fontName, value.before, value.after);
        after.fontName = structuredClone(before.fontName);
      }
      after[field] = structuredClone(before[field]);
    }
    for (const field of ['fills', 'strokes']) {
      const paints = before[field];
      if (!Array.isArray(paints) || !Array.isArray(after[field]) || paints.length !== after[field].length) {
        if (!same(paints, after[field])) fail('paint-inventory:' + old.id);
        continue;
      }
      for (const [i, paint] of paints.entries()) {
        const value = resolve(paint.boundVariables?.color, modes);
        if (!value?.changed) continue;
        const next = after[field][i];
        if (paint.type !== 'SOLID' || next?.type !== 'SOLID' || !same(Object.keys(paint.color ?? {}).sort(), ['b', 'g', 'r']) ||
            !same(Object.keys(next.color ?? {}).sort(), ['b', 'g', 'r']) || !same(Object.keys(value.before).sort(), ['a', 'b', 'g', 'r']) ||
            !same(Object.keys(value.after).sort(), ['a', 'b', 'g', 'r']) ||
            !['r', 'g', 'b'].every(c => stored(paint.color?.[c], value.before[c]) && stored(next.color?.[c], value.after[c])) ||
            !stored(paint.opacity, value.before.a) || !stored(next.opacity, value.after.a)) fail('paint-propagation:' + old.id + ':' + field);
        next.color = structuredClone(paint.color); next.opacity = paint.opacity;
      }
    }
    // Native aggregate getters derive from individual bound edges/corners.
    for (const [aggregate, fields] of [
      ['cornerRadius', ['topLeftRadius', 'topRightRadius', 'bottomLeftRadius', 'bottomRightRadius']],
      ['strokeWeight', ['strokeTopWeight', 'strokeBottomWeight', 'strokeLeftWeight', 'strokeRightWeight']],
    ] as const) {
      const values = fields.map(f => resolve(bindings[f], modes));
      if (bindings[aggregate] || !values.some(v => v?.changed)) continue;
      const expected = (side: 'before' | 'after') => fields.map((f, i) => values[i]?.[side] ?? before[f]);
      const left = expected('before'), right = expected('after');
      const matches = (actual: any, all: any[]) => all.every(v => v === all[0]) ? stored(actual, all[0]) : same(actual, { mixed: true });
      if (!matches(before[aggregate], left) || !matches(after[aggregate], right)) fail('aggregate-propagation:' + old.id + ':' + aggregate);
      after[aggregate] = structuredClone(before[aggregate]);
    }
    if (geometry.some(field => !same(before[field], after[field]))) fail('computed-geometry-changed:' + old.id);
    if (!same(row, old)) fail('node-conflict:' + old.id);
  }
}

export function matchNativeTemplateUpdateObservation(input: NativeTemplateComponentUpdateInput, raw: unknown) {
  const { diagnostic, plan } = inspectNativeTemplateUpdateObservationContext(input, raw);
  const problems = [...diagnostic.problems];
  const result = (completed: boolean) => ({ version: 1 as const, completed, untouched: diagnostic.untouched, valueState: diagnostic.valueState,
    consumerStates: completed ? diagnostic.consumerStates : [], problems: [...new Set(problems)],
    acceptedContract: null, nativeQualification: 'unqualified' as const,
    limitations: ['changed-computed-geometry-unqualified', 'native-visual-fidelity-unverified'] });
  if (diagnostic.untouched && diagnostic.valueState === 'untouched') return result(false);
  // Preparation failures already retain the same named diagnostic. A second
  // derivation cannot repair invalid evidence or grant completion.
  if (!plan) return result(false);
  let completed = false;
  try {
    if (!['updated', 'no-op'].includes(diagnostic.valueState) || !diagnostic.supportedAfterStructure || problems.length)
      fail('after-state-unverified');
    const r = structuredClone(raw) as NativeTemplateUpdateObservation, main = r.observation!;
    delete main.images;
    normalizeNodes(plan, plan.baseline, main);
    for (const c of plan.valuePlan.changes) {
      for (const receipt of [main.tokens!.receipt, main.templateGraph!.receipt.source]) {
        const row = receipt.variables.find((v: any) => v.id === c.variableId);
        if (!row) fail('variable-inventory');
        row.valuesByMode[c.modeId] = structuredClone(c.before);
      }
    }
    main.templateGraph!.graphRevision = plan.baseline.templateGraph!.graphRevision;
    if (!same(main, plan.baseline)) fail('main-conflict');
    for (const [index, consumer] of plan.consumers.entries()) {
      const content = cleanNativeTemplateCallerReadback(r.consumerObservations![index], plan.callerIdentity, true);
      normalizeNodes(plan, consumer.baseline.content, content);
      if (!same(content, consumer.baseline.content)) fail('caller-conflict:' + consumer.instanceId);
    }
    completed = true;
  } catch (error) { problems.push(error instanceof Error ? error.message : 'native-template-update-observation-invalid'); }
  return result(completed);
}
