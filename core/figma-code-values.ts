import { PropSchema, type Contract } from '../scripts/contract-schema.js';
import type { DumpSet } from '../extract/figma/types.js';
import type { CodeScalar } from './code-values.js';
import {
  figmaStateApi,
  readFigmaStateApi,
  type FigmaStateApi,
} from './figma-state-api.js';
export interface CodeValueAxis {
  property: string;
  propName: string;
  codeProp: string;
  values: Array<{ value: string; label: string; code: CodeScalar }>;
  required: boolean;
  default?: string;
  unsetValue?: string;
}
export type CodeValueAxes =
  | { version: 1; axes: CodeValueAxis[] }
  | { version: 2; axes: CodeValueAxis[]; stateApi: FigmaStateApi };
export function codeValueAxes(contract: Contract): CodeValueAxes | undefined {
  for (const prop of contract.props)
    if (prop.bindings.code.values) PropSchema.parse(prop);
  const axes = contract.props.flatMap((p) =>
    p.bindings.code.values && typeof p.type === 'object' && 'enum' in p.type
      ? [
          {
            property: p.bindings.figma.property!,
            propName: p.name,
            codeProp: p.bindings.code.prop,
            required: p.required === true,
            ...(p.default === undefined ? {} : { default: String(p.default) }),
            ...(p.bindings.figma.unsetValue === undefined
              ? {}
              : { unsetValue: p.bindings.figma.unsetValue }),
            values: p.type.enum.map((value) => ({
              value,
              label: p.bindings.figma.values?.[value] ?? value,
              code: p.bindings.code.values![value],
            })),
          },
        ]
      : [],
  );
  const stateApi = figmaStateApi(contract);
  return axes.length
    ? stateApi
      ? { version: 2, axes, stateApi }
      : { version: 1, axes }
    : undefined;
}
const object = (v: unknown): v is Record<string, unknown> =>
  v !== null && typeof v === 'object' && !Array.isArray(v);
const exact = (v: Record<string, unknown>, keys: string[]) =>
  Object.keys(v).sort().join('|') === [...keys].sort().join('|');
export function readCodeValueAxes(set: DumpSet): CodeValueAxis[] {
  const raw = set.codeValueAxes;
  if (raw === undefined) return [];
  const fail = (why: string): never => {
    throw Error(`FIGMA_CODE_VALUES_METADATA_INVALID:${why}`);
  };
  if (
    !object(raw) ||
    !exact(raw, [
      'version',
      'axes',
      ...(raw.version === 2 ? ['stateApi'] : []),
    ]) ||
    (raw.version !== 1 && raw.version !== 2) ||
    !Array.isArray(raw.axes) ||
    !raw.axes.length
  )
    return fail('expected supported versioned axes');
  const properties = new Set(),
    names = new Set(),
    aliases = new Set();
  const axes = raw.axes.map((a) => {
    if (
      !object(a) ||
      !exact(a, [
        'property',
        'propName',
        'codeProp',
        'values',
        'required',
        ...(Object.hasOwn(a, 'default') ? ['default'] : []),
        ...(Object.hasOwn(a, 'unsetValue') ? ['unsetValue'] : []),
      ]) ||
      typeof a.property !== 'string' ||
      typeof a.propName !== 'string' ||
      typeof a.codeProp !== 'string' ||
      typeof a.required !== 'boolean' ||
      !Array.isArray(a.values) ||
      !a.values.length
    )
      return fail('invalid axis');
    if (
      properties.has(a.property) ||
      names.has(a.propName) ||
      aliases.has(a.codeProp)
    )
      return fail('duplicate axis identity');
    properties.add(a.property);
    names.add(a.propName);
    aliases.add(a.codeProp);
    const entries = a.values.map((v) => {
      if (
        !object(v) ||
        !exact(v, ['value', 'label', 'code']) ||
        typeof v.value !== 'string' ||
        typeof v.label !== 'string' ||
        ![null, 'string', 'number', 'boolean'].includes(
          v.code === null ? null : typeof v.code,
        )
      )
        return fail('invalid typed value');
      return { value: v.value, label: v.label, code: v.code as CodeScalar };
    });
    const parsed = PropSchema.safeParse({
      name: a.propName,
      type: { enum: entries.map((v) => v.value) },
      required: a.required,
      ...(Object.hasOwn(a, 'default') ? { default: a.default } : {}),
      bindings: {
        code: {
          prop: a.codeProp,
          values: Object.fromEntries(entries.map((v) => [v.value, v.code])),
        },
        figma: {
          kind: 'VARIANT',
          property: a.property,
          values: Object.fromEntries(entries.map((v) => [v.value, v.label])),
          ...(Object.hasOwn(a, 'unsetValue')
            ? { unsetValue: a.unsetValue }
            : {}),
        },
      },
    });
    if (!parsed.success) return fail(parsed.error.message);
    if (new Set(entries.map((v) => v.value)).size !== entries.length)
      return fail('duplicate canonical option');
    const p = parsed.data,
      labels = [
        ...(p.bindings.figma.unsetValue === undefined
          ? []
          : [p.bindings.figma.unsetValue]),
        ...entries.map((v) => v.label),
      ];
    if (
      new Set(labels).size !== labels.length ||
      labels.some((v) => !v.trim() || v !== v.trim() || /[,=\r\n]/.test(v))
    )
      return fail('ambiguous native option');
    const expectedDefault =
      p.default !== undefined
        ? entries.find((v) => v.value === p.default)!.label
        : (p.bindings.figma.unsetValue ?? entries[0].label);
    const def = set.propertyDefinitions?.[a.property];
    if (
      set.propNames?.[a.property] !== a.propName ||
      !def ||
      def.type !== 'VARIANT' ||
      def.defaultValue !== expectedDefault ||
      !Array.isArray(def.variantOptions) ||
      def.variantOptions.length !== labels.length ||
      new Set(def.variantOptions).size !== labels.length ||
      !labels.every((v) => def.variantOptions!.includes(v))
    )
      return fail('native definition does not corroborate mapped API');
    for (const variant of set.variants) {
      const v = variant.variantProperties?.[a.property];
      const pairs = variant.name
        .split(',')
        .map((p) => p.split('=').map((x) => x.trim()));
      if (
        typeof v !== 'string' ||
        !labels.includes(v) ||
        pairs.filter((p) => p[0] === a.property).length !== 1 ||
        !pairs.some((p) => p.length === 2 && p[0] === a.property && p[1] === v)
      )
        return fail('native variant does not corroborate mapped API');
    }
    if (
      !labels.every((label) =>
        set.variants.some(
          (v) => v.variantProperties?.[a.property as string] === label,
        ),
      )
    )
      return fail('missing drawn option');
    return {
      property: a.property,
      propName: a.propName,
      codeProp: a.codeProp,
      required: a.required,
      values: entries,
      ...(p.default === undefined ? {} : { default: String(p.default) }),
      ...(p.bindings.figma.unsetValue === undefined
        ? {}
        : { unsetValue: p.bindings.figma.unsetValue }),
    };
  });
  if (raw.version === 2) readFigmaStateApi(raw.stateApi, set, axes);
  return axes;
}
export function restoreCodeValueAxes(
  contract: Record<string, unknown>,
  axes: CodeValueAxis[],
): void {
  for (const axis of axes) {
    const prop = (contract.props as Contract['props']).find(
      (p) => p.name === axis.propName,
    );
    if (
      !prop ||
      typeof prop.type !== 'object' ||
      !('enum' in prop.type) ||
      prop.type.enum.length !== axis.values.length ||
      !axis.values.every((v) =>
        (prop.type as { enum: string[] }).enum.includes(v.value),
      )
    )
      throw Error(`FIGMA_CODE_VALUES_PROJECTION_UNSUPPORTED:${axis.propName}`);
    prop.bindings.code = {
      prop: axis.codeProp,
      values: Object.fromEntries(axis.values.map((v) => [v.value, v.code])),
    };
    prop.required = axis.required;
    if (axis.default === undefined) delete prop.default;
    else prop.default = axis.default;
  }
}
