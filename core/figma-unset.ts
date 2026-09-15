/** Opt-in, versioned evidence of an omitted code prop on a Figma VARIANT axis.
 * The label has no public API meaning without this validated declaration. */
import { PropSchema, isSupportedOmittedCodeBinding, omittedCodeBindingConflicts } from '../scripts/contract-schema.js';
import type { DumpSet } from '../extract/figma/types.js';

export interface UnsetVariantAxis {
  property: string;
  propName: string;
  codeProp: string;
  unsetValue: string;
  values: Array<{ value: string; label: string }>;
}

export class UnsetVariantError extends Error {
  readonly code: 'FIGMA_UNSET_METADATA_INVALID' | 'FIGMA_UNSET_PROJECTION_UNSUPPORTED';
  constructor(message: string, code: UnsetVariantError['code'] = 'FIGMA_UNSET_METADATA_INVALID') {
    super(`${code}: ${message}`);
    this.name = 'UnsetVariantError';
    this.code = code;
  }
}

const object = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v);
const keysExactly = (v: Record<string, unknown>, keys: string[]) => Object.keys(v).sort().join('|') === [...keys].sort().join('|');

export function readUnsetVariantAxes(set: DumpSet): UnsetVariantAxis[] {
  const raw = set.unsetVariantAxes;
  if (raw === undefined) return [];
  const fail = (reason: string): never => { throw new UnsetVariantError(reason); };
  if (!object(raw) || !keysExactly(raw, ['version', 'axes']) || raw.version !== 1 || !Array.isArray(raw.axes) || raw.axes.length === 0)
    return fail('expected a non-empty version 1 axes declaration');
  const properties = new Set<string>();
  const props = new Set<string>();
  const codeProps = new Set<string>();
  return raw.axes.map((a): UnsetVariantAxis => {
    if (!object(a) || !keysExactly(a, ['property', 'propName', 'codeProp', 'unsetValue', 'values']) ||
        typeof a.property !== 'string' || !a.property || typeof a.propName !== 'string' || !a.propName ||
        typeof a.codeProp !== 'string' || !isSupportedOmittedCodeBinding(a.codeProp) ||
        typeof a.unsetValue !== 'string' || !Array.isArray(a.values) || !a.values.length)
      return fail('malformed axis identity or values');
    if (properties.has(a.property) || props.has(a.propName) || codeProps.has(a.codeProp)) return fail(`duplicate axis ${a.property}/${a.propName}/${a.codeProp}`);
    properties.add(a.property); props.add(a.propName); codeProps.add(a.codeProp);
    const values = a.values.map((v) => {
      if (!object(v) || !keysExactly(v, ['value', 'label']) || typeof v.value !== 'string' || typeof v.label !== 'string')
        return fail(`malformed public value on ${a.property}`);
      return { value: v.value, label: v.label };
    });
    const labels = [a.unsetValue, ...values.map(v => v.label)];
    if (new Set(labels).size !== labels.length || new Set(values.map(v => v.value)).size !== values.length)
      return fail(`duplicate public value or canvas option on ${a.property}`);
    const checked = PropSchema.safeParse({
      name: a.propName, type: { enum: values.map(v => v.value) },
      bindings: { code: { prop: a.codeProp }, figma: {
        kind: 'VARIANT', property: a.property, unsetValue: a.unsetValue,
        values: Object.fromEntries(values.map(v => [v.value, v.label])),
      } },
    });
    if (!checked.success) return fail(`invalid omission binding on ${a.property}: ${checked.error.message}`);
    if (set.propNames?.[a.property] !== a.propName) return fail(`propNames does not corroborate ${a.property}/${a.propName}`);
    const def = set.propertyDefinitions?.[a.property];
    if (!def || def.type !== 'VARIANT' || def.defaultValue !== a.unsetValue || !Array.isArray(def.variantOptions) ||
        def.variantOptions.length !== labels.length || new Set(def.variantOptions).size !== labels.length ||
        !labels.every(label => def.variantOptions!.includes(label)))
      return fail(`declared options/default do not corroborate the omitted plane on ${a.property}`);
    for (const variant of set.variants) {
      const value = variant.variantProperties?.[a.property];
      if (typeof value !== 'string' || !labels.includes(value)) return fail(`variant ${variant.name} does not corroborate ${a.property}`);
      const pairs = variant.name.split(',').map(pair => pair.split('=').map(s => s.trim()));
      if (pairs.filter(pair => pair[0] === a.property).length !== 1 || !pairs.some(pair => pair[0] === a.property && pair[1] === value && pair.length === 2))
        return fail(`variant name and structured properties disagree on ${a.property}`);
    }
    const property = a.property;
    if (!labels.every(label => set.variants.some(v => v.variantProperties?.[property] === label)))
      return fail(`missing drawn option on ${a.property}`);
    return { property: a.property, propName: a.propName, codeProp: a.codeProp, unsetValue: a.unsetValue, values };
  });
}

/** Readers that use first occurrence as base must see the declared defaults,
 * not arbitrary canvas child order. Never reorders the actual Figma nodes. */
export function orderUnsetObservations(set: DumpSet): DumpSet {
  const axes = Object.entries(set.propertyDefinitions ?? {}).flatMap(([property, d]) => d.type !== 'VARIANT' ? [] : [{
    property, values: [String(d.defaultValue), ...(d.variantOptions ?? []).filter(v => v !== d.defaultValue)],
  }]);
  return { ...set, variants: [...set.variants].sort((a, b) => {
    for (const axis of axes) {
      const delta = axis.values.indexOf(a.variantProperties?.[axis.property] ?? '') - axis.values.indexOf(b.variantProperties?.[axis.property] ?? '');
      if (delta) return delta;
    }
    return 0;
  }) };
}

/** Existing proposal helpers correlate all drawn rows, including the omitted
 * plane. Lower its observed carriers to the BASE, not a synthetic selector.
 * Independent one-axis carriers are expressible; omitted-value conditions,
 * dependent instance lookups and interacting omitted placeholders are not. */
export function lowerUnsetProposal(
  contract: Record<string, unknown>,
  axes: Array<UnsetVariantAxis & { internalValue: string }>,
): void {
  if (!axes.length) return;
  const fail = (path: string): never => {
    throw new UnsetVariantError(`omission-dependent carrier at ${path} has no proved base/public-value lowering`, 'FIGMA_UNSET_PROJECTION_UNSUPPORTED');
  };
  const axisByProp = new Map(axes.map(a => [a.propName, a]));
  for (const axis of axes) if (!isSupportedOmittedCodeBinding(axis.codeProp)) fail(`props.${axis.codeProp}: unsupported public code binding`);
  for (const alias of omittedCodeBindingConflicts(contract, axes.map(a => a.codeProp))) fail(`props.${alias}: consumer/generated namespace collision`);
  const lowerPart = (part: Record<string, unknown>, path: string): void => {
    // Per-axis maps already prove each value is independent of other axes.
    // Their omitted row is therefore exactly the base carrier.
    for (const [mapField, baseField] of [['tokensByProp', 'tokens'], ['literalsByProp', 'literals'], ['layoutByProp', 'layout'], ['textByProp', 'text'], ['statesByProp', 'states']]) {
      const field = part[mapField];
      const entries = Array.isArray(field) ? field : object(field) ? [field] : [];
      for (const entry of entries) {
        if (!object(entry) || typeof entry.prop !== 'string' || !object(entry.map)) continue;
        const axis = axisByProp.get(entry.prop);
        if (!axis || !Object.hasOwn(entry.map, axis.internalValue)) continue;
        const base = entry.map[axis.internalValue];
        const preserveFallback = (before: unknown, after: unknown): void => {
          for (const v of axis.values) {
            if (baseField === 'text') {
              if (!Object.hasOwn(entry.map as object, v.value) && before !== after) {
                if (typeof before !== 'string') fail(`${path}.${mapField}.${v.value}: missing prior text base`);
                (entry.map as Record<string, unknown>)[v.value] = before;
              }
              continue;
            }
            if (!object(after)) fail(`${path}.${mapField}`);
            const map = entry.map as Record<string, unknown>;
            const existing = map[v.value];
            const row = object(existing) ? existing : {};
            for (const [channel, value] of Object.entries(after as Record<string, unknown>)) {
              const old = object(before) ? before[channel] : undefined;
              if (Object.hasOwn(row, channel) || old === value) continue;
              if (old === undefined) fail(`${path}.${mapField}.${v.value}.${channel}: missing prior base`);
              row[channel] = old;
            }
            if (Object.keys(row).length) map[v.value] = row;
          }
        };
        if (baseField === 'text') {
          if (typeof base !== 'string') fail(`${path}.${mapField}`);
          preserveFallback(part.text, base);
          part.text = base;
        } else if (baseField === 'states') {
          if (typeof entry.state !== 'string' || !object(base)) fail(`${path}.${mapField}`);
          const states = object(part.states) ? part.states : {};
          const existing = states[entry.state as string];
          preserveFallback(existing, base);
          states[entry.state as string] = { ...(object(existing) ? existing : {}), ...base as Record<string, unknown> };
          part.states = states;
        } else {
          if (!object(base)) fail(`${path}.${mapField}`);
          preserveFallback(part[baseField], base);
          part[baseField] = { ...(object(part[baseField]) ? part[baseField] : {}), ...base as Record<string, unknown> };
        }
        delete entry.map[axis.internalValue];
      }
    }
    // Literal minting can return a one-axis token placeholder. Expand it to
    // the same base + per-public-value carrier as a bound token observation.
    const expand = (tokens: Record<string, unknown>, mapField: string, state?: string): void => {
      for (const [channel, value] of Object.entries(tokens)) {
        if (typeof value !== 'string') continue;
        const used = axes.filter(a => value.includes(`{${a.propName}}`));
        if (!used.length) continue;
        if (used.length !== 1) fail(`${path}.${channel}`);
        const a = used[0];
        const entries = Array.isArray(part[mapField]) ? part[mapField] as Record<string, unknown>[] : [];
        let entry = entries.find(e => e.prop === a.propName && e.state === state);
        if (!entry) { entry = { prop: a.propName, ...(state === undefined ? {} : { state }), map: {} }; entries.push(entry); }
        if (!object(entry.map)) fail(`${path}.${mapField}`);
        for (const v of a.values) {
          const map = entry.map as Record<string, unknown>;
          const existing = map[v.value];
          const row = object(existing) ? existing : {};
          if (Object.hasOwn(row, channel)) fail(`${path}.${mapField}.${v.value}.${channel}`);
          row[channel] = value.replaceAll(`{${a.propName}}`, v.value);
          map[v.value] = row;
        }
        tokens[channel] = value.replaceAll(`{${a.propName}}`, a.internalValue);
        part[mapField] = entries;
      }
    };
    if (object(part.tokens)) expand(part.tokens, 'tokensByProp');
    if (object(part.states)) for (const [state, tokens] of Object.entries(part.states)) if (object(tokens)) expand(tokens, 'statesByProp', state);
    if (object(part.parts)) for (const [name, child] of Object.entries(part.parts)) if (object(child)) lowerPart(child, `${path}.${name}`);
  };
  if (object(contract.anatomy)) for (const [name, part] of Object.entries(contract.anatomy)) if (object(part)) lowerPart(part, `anatomy.${name}`);
  // No synthetic selector may escape into public API or token substitutions.
  const fence = (value: unknown, path: string): void => {
    if (typeof value === 'string' && axes.some(a => value.includes(`{${a.propName}}`))) fail(path);
    if (Array.isArray(value)) { value.forEach((v, i) => fence(v, `${path}[${i}]`)); return; }
    if (!object(value)) return;
    const axis = typeof value.prop === 'string' ? axisByProp.get(value.prop) : undefined;
    const publicValues = axis?.values.map(v => v.value);
    if (axis && ((object(value.map) && Object.keys(value.map).some(key => !publicValues!.includes(key))) ||
        (typeof value.equals === 'string' && !publicValues!.includes(value.equals)) ||
        (Array.isArray(value.equals) && value.equals.some(v => !publicValues!.includes(v))))) fail(path);
    for (const [k, v] of Object.entries(value)) fence(v, `${path}.${k}`);
  };
  fence(contract.anatomy, 'anatomy');
  fence(contract.semantics, 'semantics');
}
