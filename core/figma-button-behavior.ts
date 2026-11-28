/** Retain declared inputs, never infer behavior from a native state name. */
import { ContractSchema, type Contract } from '../scripts/contract-schema.js';
import type { DumpSet } from '../extract/figma/types.js';
import { readCodeValueAxes, type CodeValueAxis } from './figma-code-values.js';
type Policy = NonNullable<Contract['semantics']['button']>;
export type ButtonStamp = { button: Policy; buttonAxis: { version: 1; prop: Contract['props'][number] } };
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const fail = (why: string): never => { throw Error('FIGMA_BUTTON_BEHAVIOR_METADATA_INVALID:' + why); };
function axisFor(p: Contract['props'][number]): CodeValueAxis {
  return { property: p.bindings.figma.property!, propName: p.name, codeProp: p.bindings.code.prop,
    required: p.required === true, default: String(p.default),
    values: (p.type as { enum: string[] }).enum.map(value => ({ value, label: p.bindings.figma.values?.[value] ?? value, code: value })) };
}
export function buttonStamp(contract: Contract): ButtonStamp | undefined {
  if (contract.semantics.button === undefined) return undefined;
  const parsed = ContractSchema.safeParse(contract);
  if (!parsed.success) return fail(parsed.error.message);
  if (contract.props.some(p => p.bindings.code.values || p.bindings.figma.unsetValue !== undefined)) fail('mixed retained axes unsupported');
  const prop = contract.props.find(p => p.name === contract.semantics.button!.prop)!;
  const axis = axisFor(prop), labels = axis.values.map(v => v.label);
  // Apply the native transport rules before writing, using an exact synthetic domain.
  corroborate({ propertyDefinitions: { [axis.property]: { type: 'VARIANT', defaultValue: prop.bindings.figma.values?.[String(prop.default)] ?? String(prop.default), variantOptions: labels } },
    propNames: { [axis.property]: prop.name }, variants: labels.map(label => ({ name: `${axis.property}=${label}`, variantProperties: { [axis.property]: label } })) } as DumpSet, axis);
  return { button: structuredClone(contract.semantics.button), buttonAxis: { version: 1, prop: structuredClone(prop) } };
}
function corroborate(set: DumpSet, axis: CodeValueAxis): CodeValueAxis {
  try { return readCodeValueAxes({ ...set, codeValueAxes: { version: 1, axes: [axis] } })[0]; }
  catch (e) { return fail(String(e)); }
}
export function readButtonStamp(set: DumpSet): { stamp: ButtonStamp; axis: CodeValueAxis } | undefined {
  const raw: unknown = set.semantics;
  if (raw === undefined) return undefined;
  if (!object(raw)) return fail('malformed semantics');
  if (raw.button === undefined && raw.buttonAxis === undefined) return undefined;
  if (Object.keys(raw).sort().join('|') !== 'button|buttonAxis|element' || raw.element !== 'button' ||
      !object(raw.buttonAxis) || Object.keys(raw.buttonAxis).sort().join('|') !== 'prop|version' || raw.buttonAxis.version !== 1) return fail('incomplete envelope');
  if (set.codeValueAxes !== undefined || set.unsetVariantAxes !== undefined) return fail('mixed retained axes unsupported');
  const parsed = ContractSchema.safeParse({ id: 'retained.button', name: 'RetainedButton', version: '1.0.0', status: 'draft', description: 'Explicit retained behavior inputs.',
    semantics: { element: raw.element, button: raw.button }, props: [raw.buttonAxis.prop], anatomy: { root: {} },
    bindings: { code: { anchors: { importPath: './RetainedButton', export: 'RetainedButton' } }, figma: { anchors: { fileKey: null, componentSetKey: null } } } });
  if (!parsed.success) return fail(parsed.error.message);
  const stamp = buttonStamp(parsed.data)!;
  return { stamp, axis: corroborate(set, axisFor(stamp.buttonAxis.prop)) };
}
export function restoreButtonStamp(contract: Record<string, unknown>, retained: ReturnType<typeof readButtonStamp>): void {
  if (!retained) return;
  const props = contract.props as Contract['props'], original = retained.stamp.buttonAxis.prop;
  const index = props.findIndex(p => p.name === original.name);
  if (index < 0 || props.filter(p => p.name === original.name).length !== 1 || props[index].bindings.figma.property !== original.bindings.figma.property) fail('projected axis missing');
  props[index] = structuredClone(original);
  contract.semantics = { ...(contract.semantics as object), button: retained.stamp.button };
  const parsed = ContractSchema.safeParse(contract);
  if (!parsed.success) return fail(parsed.error.message);
}
export const BUTTON_RETIREMENT_GUARD = `
  if (existing) {
    const raw = existing.getSharedPluginData('ds_contracts', 'semantics');
    if (raw) {
      let prior;
      try { prior = JSON.parse(raw); } catch (_) { throw Error('FIGMA_BUTTON_BEHAVIOR_RETIREMENT_REFUSED: malformed semantics'); }
      if (!prior || typeof prior !== 'object' || Array.isArray(prior)) throw Error('FIGMA_BUTTON_BEHAVIOR_RETIREMENT_REFUSED: malformed semantics');
      if ('button' in prior || 'buttonAxis' in prior) {
        const canonical = value => value && typeof value === 'object'
          ? Array.isArray(value) ? value.map(canonical) : Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value;
        if (!C.semantics || JSON.stringify(canonical(prior)) !== JSON.stringify(canonical(C.semantics)))
          throw Error('FIGMA_BUTTON_BEHAVIOR_RETIREMENT_REFUSED: changing or removing retained inputs requires a fresh lineage');
      }
    }
  }
`;
