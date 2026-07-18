/**
 * Zod introspection — the spec reference is RENDERED FROM the schema
 * (scripts/contract-schema.ts), never transcribed, so the docs cannot drift
 * from the spec. Read-only import; nothing here mutates the schema.
 *
 * Two consumers:
 *   - shape rendering (typeText / fieldsOf) → the GENERATED blocks on every
 *     reference page
 *   - branch enumeration (enumerateBranches) → the coverage drift guard in
 *     coverage.ts (build fails if a schema branch lacks a documented entry)
 */
import * as z from 'zod';
import {
  ContractSchema,
  PropSchema,
  PartSchema,
  SlotSchema,
  SlotContentItemSchema,
  ComponentRefSchema,
  RepeatSchema,
  LayoutSchema,
  VariantLayoutSchema,
  LayoutByPropSchema,
  TokensByPropSchema,
  StylesWhenSchema,
  OverlaySchema,
  ShapeSchema,
  VisibleWhenSchema,
  EventSchema,
  TokenRefSchema,
} from '../../scripts/contract-schema.js';

type AnySchema = z.ZodType;

const def = (s: unknown): Record<string, unknown> =>
  ((s as { def?: unknown })?.def ?? (s as { _def?: unknown })?._def ?? {}) as Record<string, unknown>;

const defType = (s: unknown): string => String(def(s).type ?? '');

/** Named schemas render as references (e.g. `Part`, `TokenRef`) when they
 *  appear inside another shape; each has its own reference section. */
const NAMED: Array<[AnySchema, string]> = [
  [TokenRefSchema as AnySchema, 'TokenRef'],
  [PartSchema as AnySchema, 'Part'],
  [PropSchema as AnySchema, 'Prop'],
  [SlotSchema as AnySchema, 'Slot'],
  [SlotContentItemSchema as AnySchema, 'SlotContentItem'],
  [ComponentRefSchema as AnySchema, 'ComponentRef'],
  [RepeatSchema as AnySchema, 'Repeat'],
  [LayoutSchema as AnySchema, 'Layout'],
  [VariantLayoutSchema as AnySchema, 'VariantLayout'],
  [LayoutByPropSchema as AnySchema, 'LayoutByProp'],
  [TokensByPropSchema as AnySchema, 'TokensByProp'],
  [StylesWhenSchema as AnySchema, 'StylesWhen'],
  [OverlaySchema as AnySchema, 'Overlay'],
  [ShapeSchema as AnySchema, 'Shape'],
  [VisibleWhenSchema as AnySchema, 'VisibleWhen'],
  [EventSchema as AnySchema, 'Event'],
];

export const nameOf = (s: unknown): string | undefined =>
  NAMED.find(([schema]) => schema === s)?.[1];

/** Unwrap optional/default/nullable wrappers; report what was found. */
export function unwrap(s: AnySchema): { schema: AnySchema; optional: boolean; defaultValue?: unknown } {
  let cur: AnySchema = s;
  let optional = false;
  let defaultValue: unknown;
  for (;;) {
    const t = defType(cur);
    if (t === 'optional' || t === 'nullable') {
      optional = optional || t === 'optional';
      cur = def(cur).innerType as AnySchema;
    } else if (t === 'default') {
      defaultValue = def(cur).defaultValue;
      if (typeof defaultValue === 'function') defaultValue = (defaultValue as () => unknown)();
      cur = def(cur).innerType as AnySchema;
    } else if (t === 'lazy' && nameOf(cur) === undefined) {
      cur = (def(cur).getter as () => AnySchema)();
    } else {
      return { schema: cur, optional, defaultValue };
    }
  }
}

/** Resolve a lazy schema (PartSchema) to its inner object for shape access. */
export function resolveLazy(s: AnySchema): AnySchema {
  return defType(s) === 'lazy' ? (def(s).getter as () => AnySchema)() : s;
}

const shapeOf = (s: AnySchema): Record<string, AnySchema> | undefined =>
  (resolveLazy(s) as { shape?: Record<string, AnySchema> }).shape;

const q = (v: unknown): string => JSON.stringify(v);

/** A TypeScript-flavored type string for a schema node. */
export function typeText(s: AnySchema, depth = 0): string {
  const named = nameOf(s);
  if (named) return named;
  const { schema, optional } = unwrap(s);
  const namedInner = nameOf(schema);
  if (namedInner) return namedInner;
  const t = defType(schema);
  const d = def(schema);
  switch (t) {
    case 'string': {
      return 'string';
    }
    case 'number':
      return 'number';
    case 'boolean':
      return 'boolean';
    case 'literal': {
      const values = (d.values as unknown[]) ?? [];
      return values.map(q).join(' | ');
    }
    case 'enum': {
      const opts = (schema as unknown as { options?: unknown[] }).options ?? Object.values((d.entries as object) ?? {});
      return opts.map(q).join(' | ');
    }
    case 'union': {
      const opts = (d.options as AnySchema[]) ?? [];
      return opts.map((o) => typeText(o, depth + 1)).join(' | ');
    }
    case 'record': {
      const key = typeText(d.keyType as AnySchema, depth + 1);
      const val = typeText(d.valueType as AnySchema, depth + 1);
      return `Record<${key}, ${val}>`;
    }
    case 'array': {
      const el = typeText(d.element as AnySchema, depth + 1);
      return el.includes('|') || el.includes('{') ? `Array<${el}>` : `${el}[]`;
    }
    case 'tuple': {
      const items = (d.items as AnySchema[]) ?? [];
      return `[${items.map((i) => typeText(i, depth + 1)).join(', ')}]`;
    }
    case 'object': {
      const shape = shapeOf(schema) ?? {};
      const fields = Object.entries(shape).map(([k, v]) => {
        const { optional: opt } = unwrap(v);
        return `${k}${opt ? '?' : ''}: ${typeText(v, depth + 1)}`;
      });
      return `{ ${fields.join('; ')} }`;
    }
    case 'lazy':
      return nameOf(schema) ?? 'unknown';
    default:
      return t || 'unknown';
  }
  void optional;
}

export interface FieldInfo {
  name: string;
  type: string;
  optional: boolean;
  defaultValue?: unknown;
}

/** The fields of an object schema, with rendered type strings. */
export function fieldsOf(s: AnySchema): FieldInfo[] {
  const shape = shapeOf(s);
  if (!shape) throw new Error(`fieldsOf: schema has no shape (type ${defType(s)})`);
  return Object.entries(shape).map(([name, v]) => {
    const { optional, defaultValue } = unwrap(v);
    return { name, type: typeText(v), optional, defaultValue };
  });
}

// ---------------------------------------------------------------------------
// Branch enumeration — the input to the coverage drift guard.
// ---------------------------------------------------------------------------

/** Every named schema root is enumerated under its canonical prefix; a
 *  field that IS a named schema contributes only its field key here (its
 *  interior is covered under its own prefix). */
const ROOTS: Array<[string, AnySchema]> = [
  ['contract', ContractSchema as AnySchema],
  ['prop', PropSchema as AnySchema],
  ['part', PartSchema as AnySchema],
  ['slot', SlotSchema as AnySchema],
  ['slotContent', SlotContentItemSchema as AnySchema],
  ['componentRef', ComponentRefSchema as AnySchema],
  ['repeat', RepeatSchema as AnySchema],
  ['layout', LayoutSchema as AnySchema],
  ['variantLayout', VariantLayoutSchema as AnySchema],
  ['layoutByProp', LayoutByPropSchema as AnySchema],
  ['tokensByProp', TokensByPropSchema as AnySchema],
  ['stylesWhen', StylesWhenSchema as AnySchema],
  ['overlay', OverlaySchema as AnySchema],
  ['shape', ShapeSchema as AnySchema],
  ['visibleWhen', VisibleWhenSchema as AnySchema],
  ['event', EventSchema as AnySchema],
];

/** Union branch label: literals by value, objects by their first field. */
function unionBranchLabel(s: AnySchema): string {
  const { schema } = unwrap(s);
  const t = defType(schema);
  if (t === 'literal') return String(((def(schema).values as unknown[]) ?? ['?'])[0]);
  if (t === 'object') return Object.keys(shapeOf(schema) ?? {})[0] ?? 'object';
  return t;
}

function walkBranches(prefix: string, s: AnySchema, out: Set<string>, depth: number): void {
  let { schema } = unwrap(s);
  if (depth > 0 && nameOf(schema) !== undefined) return; // covered under its own root
  schema = resolveLazy(schema);
  const t = defType(schema);
  const d = def(schema);
  if (t === 'object') {
    const shape = shapeOf(schema) ?? {};
    for (const [k, v] of Object.entries(shape)) {
      out.add(`${prefix}.${k}`);
      walkBranches(`${prefix}.${k}`, v, out, depth + 1);
    }
  } else if (t === 'union') {
    // Enumerate branches only for STRUCTURAL unions (at least one object
    // member) — those are spec vocabulary (prop.type.enum, prop.type.arrayOf).
    // Scalar-only unions (prop.default: string | boolean | number) are one
    // branch: the field key itself.
    const options = (d.options as AnySchema[]) ?? [];
    const structural = options.some((o) => defType(unwrap(o).schema) === 'object');
    if (structural) {
      for (const o of options) out.add(`${prefix}.${unionBranchLabel(o)}`);
      // Do not recurse into union members: each branch key is the unit the
      // registry documents.
    }
  } else if (t === 'array') {
    walkBranches(prefix, d.element as AnySchema, out, depth + 1);
  }
  // records, scalars, enums, tuples: the field key itself is the branch.
}

/** All schema branch keys, e.g. "part.layoutByProp", "prop.type.arrayOf". */
export function enumerateBranches(): string[] {
  const out = new Set<string>();
  for (const [prefix, schema] of ROOTS) walkBranches(prefix, schema, out, 0);
  return [...out].sort();
}
