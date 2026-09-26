/** Non-executable retained contract semantics for a bounded checked-state API.
 * Native variants corroborate the API domain; they do not prove behavior. */
import { ContractSchema, type Contract } from '../scripts/contract-schema.js';
import type { DumpSet } from '../extract/figma/types.js';
import { revisionOf } from './contract-provenance.js';
import type { CodeValueAxis } from './figma-code-values.js';

export interface FigmaStateApi {
  version: 1;
  semantics: { element: 'button'; role: 'checkbox' | 'switch' };
  props: Contract['props'];
  events: NonNullable<Contract['events']>;
}
const fail = (reason: string): never => {
  throw Error('FIGMA_STATE_API_METADATA_INVALID:' + reason);
};
const record = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);
const exact = (value: Record<string, unknown>, keys: string[]) =>
  Object.keys(value).sort().join('|') === [...keys].sort().join('|');

function parse(raw: unknown): FigmaStateApi {
  if (
    !record(raw) ||
    !exact(raw, ['version', 'semantics', 'props', 'events']) ||
    raw.version !== 1 ||
    !record(raw.semantics) ||
    !exact(raw.semantics, ['element', 'role']) ||
    raw.semantics.element !== 'button' ||
    !['checkbox', 'switch'].includes(String(raw.semantics.role))
  )
    return fail('unsupported envelope or role');
  const role = raw.semantics.role;
  const parsed = ContractSchema.safeParse({
    id: 'retained.state-api',
    name: 'RetainedStateApi',
    version: '1.0.0',
    status: 'draft',
    description:
      'Retained source input semantics; not an observation of native behavior.',
    semantics: raw.semantics,
    props: raw.props,
    events: raw.events,
    states: [],
    anatomy: { root: {} },
    bindings: {
      code: {
        anchors: {
          importPath: 'retained/state-api',
          export: 'RetainedStateApi',
        },
      },
      figma: { anchors: { fileKey: null, componentSetKey: null } },
    },
  });
  if (!parsed.success)
    return fail('invalid contract fragment: ' + parsed.error.message);
  const { props, events } = parsed.data,
    initial = props.filter((p) => p.bindings.code.initial),
    event = events?.[0];
  if (
    initial.length !== 1 ||
    events?.length !== 1 ||
    !event ||
    event.trigger !== 'root' ||
    event.bindings.code.argument !== 'next-value' ||
    event.toggles?.prop !== initial[0].name ||
    event.toggles.aria !== 'checked' ||
    props.length < 1 ||
    props.length > 2
  )
    return fail(
      'expected one root checked-state toggle and optional disabled input',
    );
  const state = initial[0];
  if (
    typeof state.type !== 'object' ||
    !('enum' in state.type) ||
    !state.bindings.code.values ||
    state.bindings.figma.kind !== 'VARIANT'
  )
    return fail('typed state axis missing');
  const domain = state.type.enum.map(
    (value) => state.bindings.code.values![value],
  );
  if (
    domain.filter((v) => v === false).length !== 1 ||
    domain.filter((v) => v === true).length !== 1 ||
    domain.some(
      (v) =>
        v !== false &&
        v !== true &&
        (role !== 'checkbox' || v !== 'indeterminate'),
    ) ||
    state.bindings.code.values[event.toggles.between[0]] !== false ||
    state.bindings.code.values[event.toggles.between[1]] !== true
  )
    return fail('checked-state values disagree with toggle');
  const disabled = props.filter((p) => p !== state);
  if (
    disabled.some(
      (p) =>
        p.name !== 'disabled' ||
        p.type !== 'boolean' ||
        p.bindings.figma.kind !== 'VARIANT' ||
        p.bindings.code.initial,
    )
  )
    return fail('unrepresented additional input');
  for (const p of props)
    if (!p.bindings.figma.property) return fail('missing native property');
  return {
    version: 1,
    semantics: raw.semantics as FigmaStateApi['semantics'],
    props,
    events: events!,
  };
}

export function figmaStateApi(contract: Contract): FigmaStateApi | undefined {
  if (!contract.props.some((p) => p.bindings.code.initial)) return;
  // The initial binding grammar is broader than checked controls. Preserve
  // existing compilation for those classes, which retain code-only receipts.
  if (
    contract.semantics.element !== 'button' ||
    !['checkbox', 'switch'].includes(contract.semantics.role ?? '')
  )
    return;
  // Retaining an entire API is narrower than compiling its native appearance.
  // Older composed controls can have text/identity inputs or callbacks without
  // a next-value declaration. Keep their existing typed-axis projection; do
  // not claim that this bounded envelope carries those additional semantics.
  // The writer still refuses replacing an existing v2 stamp with that v1 data.
  const initial = contract.props.filter((p) => p.bindings.code.initial);
  if (
    initial.length !== 1 ||
    contract.events?.length !== 1 ||
    contract.events[0].bindings.code.argument !== 'next-value' ||
    contract.props.some(
      (p) =>
        p !== initial[0] &&
        (p.name !== 'disabled' ||
          p.type !== 'boolean' ||
          p.bindings.figma.kind !== 'VARIANT'),
    )
  )
    return;
  if (
    contract.semantics.roleByProp ||
    contract.semantics.elementByProp ||
    contract.bindings.figma.statePreviews ||
    contract.bindings.figma.absentVariants?.length ||
    Object.keys(contract.anatomy).length !== 1 ||
    ['role', 'aria-checked', 'disabled'].some((key) =>
      Object.hasOwn(contract.anatomy.root.attrs ?? {}, key),
    )
  )
    return fail('conflicting native semantic projection');
  const visit = (part: Contract['anatomy'][string]) => {
    // Native graph compilation and exact import retain component identity and
    // its independently verified variant mapping. The root envelope owns only
    // behavior. Admit complete identity forwarding; other composition models
    // still need a separate representation before they can retain this API.
    if (part.component && (Object.keys(part.component.props ?? {}).length !== contract.props.length ||
      contract.props.some(p => part.component!.props?.[p.name] !== `{${p.name}}`) ||
      Object.keys(part.component.initialProps ?? {}).length))
      return fail('component context requires complete identity forwarding');
    if (
      part.slot ||
      part.repeat ||
      part.meter ||
      part.content ||
      part.optional
    )
      return fail('composition requires its own retained identity');
    for (const child of Object.values(part.parts ?? {})) visit(child);
  };
  visit(contract.anatomy.root);
  return parse({
    version: 1,
    semantics: { element: 'button', role: contract.semantics.role },
    props: structuredClone(contract.props),
    events: structuredClone(contract.events),
  });
}

/** A parsed metadata envelope is not enough: every claimed native property,
 * default, option and complete combination must still exist on the canvas. */
export function readFigmaStateApi(
  raw: unknown,
  set: DumpSet,
  axes: CodeValueAxis[],
): FigmaStateApi {
  const api = parse(raw);
  if (revisionOf(set.semantics) !== revisionOf(api.semantics))
    return fail('native role does not corroborate retained semantics');
  const state = api.props.find((p) => p.bindings.code.initial)!;
  const mapped = axes.find((a) => a.propName === state.name);
  if (
    axes.length !== 1 ||
    !mapped ||
    mapped.codeProp !== state.bindings.code.prop ||
    mapped.property !== state.bindings.figma.property ||
    mapped.required !== (state.required === true) ||
    mapped.default !== state.default ||
    mapped.unsetValue !== state.bindings.figma.unsetValue ||
    revisionOf(
      Object.fromEntries(mapped.values.map((v) => [v.value, v.code])),
    ) !== revisionOf(state.bindings.code.values)
  )
    return fail('typed axis does not corroborate retained inputs');
  const properties = new Map<string, string[]>();
  for (const prop of api.props) {
    const property = prop.bindings.figma.property!,
      domain =
        prop.type === 'boolean'
          ? ['false', 'true']
          : (prop.type as { enum: string[] }).enum;
    const labels = [
      ...(prop.bindings.figma.unsetValue === undefined
        ? []
        : [prop.bindings.figma.unsetValue]),
      ...domain.map((v) => prop.bindings.figma.values?.[v] ?? v),
    ];
    const def = set.propertyDefinitions?.[property];
    const expectedDefault =
      prop.default === undefined
        ? (prop.bindings.figma.unsetValue ?? labels[0])
        : (prop.bindings.figma.values?.[String(prop.default)] ??
          String(prop.default));
    if (
      properties.has(property) ||
      set.propNames?.[property] !== prop.name ||
      !def ||
      def.type !== 'VARIANT' ||
      def.defaultValue !== expectedDefault ||
      !Array.isArray(def.variantOptions) ||
      def.variantOptions.length !== labels.length ||
      new Set(labels).size !== labels.length ||
      labels.some((v) => !v.trim() || v !== v.trim() || /[,=\r\n]/.test(v)) ||
      new Set(def.variantOptions).size !== labels.length ||
      !labels.every((v) => def.variantOptions!.includes(v))
    )
      return fail('native property does not corroborate retained inputs');
    properties.set(property, labels);
  }
  if (
    Object.entries(set.propertyDefinitions ?? {}).filter(
      ([, def]) => def.type === 'VARIANT',
    ).length !== properties.size
  )
    return fail('native property domain expanded');
  const tuples = new Set<string>();
  for (const variant of set.variants) {
    const values = variant.variantProperties,
      pairs = variant.name
        .split(',')
        .map((p) => p.split('=').map((s) => s.trim()));
    if (
      !values ||
      Object.keys(values).length !== properties.size ||
      pairs.length !== properties.size ||
      [...properties].some(
        ([property, labels]) =>
          !labels.includes(values[property]) ||
          pairs.filter(
            (p) =>
              p.length === 2 && p[0] === property && p[1] === values[property],
          ).length !== 1,
      )
    )
      return fail('native variant domain changed');
    const tuple = revisionOf(values);
    if (tuples.has(tuple)) return fail('duplicate native state');
    tuples.add(tuple);
  }
  if (
    tuples.size !==
    [...properties.values()].reduce((count, labels) => count * labels.length, 1)
  )
    return fail('incomplete native state matrix');
  return api;
}

export function restoreFigmaStateApi(
  contract: Record<string, unknown>,
  api: FigmaStateApi,
): void {
  const next = structuredClone(contract) as unknown as Contract;
  if (
    next.props.length !== api.props.length ||
    next.events?.length ||
    next.semantics.element !== api.semantics.element ||
    next.semantics.role !== api.semantics.role
  )
    return fail('proposal semantic domain changed');
  for (const retained of api.props) {
    const projected = next.props.find((p) => p.name === retained.name);
    if (
      !projected ||
      revisionOf(projected.type) !== revisionOf(retained.type) ||
      projected.bindings.figma.kind !== 'VARIANT' ||
      projected.bindings.figma.property !== retained.bindings.figma.property ||
      projected.bindings.figma.unsetValue !== retained.bindings.figma.unsetValue
    )
      return fail('proposal property domain changed');
    projected.bindings.code = structuredClone(retained.bindings.code);
    if (retained.default === undefined) delete projected.default;
    else projected.default = retained.default;
    if (retained.required === undefined) delete projected.required;
    else projected.required = retained.required;
  }
  next.events = structuredClone(api.events);
  const parsed = ContractSchema.safeParse(next);
  if (!parsed.success)
    return fail('restored contract invalid: ' + parsed.error.message);
  figmaStateApi(parsed.data);
  Object.assign(contract, parsed.data);
}
