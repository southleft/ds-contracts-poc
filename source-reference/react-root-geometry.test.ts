/** Synthetic rows only: the pure root-geometry module, fact by fact. */
import assert from 'node:assert/strict';
import test from 'node:test';

import {
  FACT_KINDS,
  MISMATCH_CLASSES,
  assignmentOf,
  compareRootFacts,
  cssColorToRgba8,
  joinAxesOfPlan,
  joinSourceRowsToNativeMains,
  nativeBackgroundPlane,
  nativeRootFacts,
  numericEqual,
  sourceRootFacts,
  type FactKind,
  type NativeNode,
  type NativePlanSpec,
  type NativeVariable,
  type SourceSizeOrigin,
} from './react-root-geometry.js';

const style = (over: Record<string, string> = {}): Record<string, string> => ({
  'box-sizing': 'border-box', display: 'inline-flex', 'flex-direction': 'row', width: '120.5px', height: '36px',
  'padding-top': '0px', 'padding-right': '10px', 'padding-bottom': '0px', 'padding-left': '10px',
  'border-top-width': '1px', 'border-right-width': '1px', 'border-bottom-width': '1px', 'border-left-width': '1px',
  'border-top-style': 'solid', 'border-right-style': 'solid', 'border-bottom-style': 'solid', 'border-left-style': 'solid',
  'border-top-color': 'oklch(0.922 0 0)', 'border-right-color': 'oklch(0.922 0 0)', 'border-bottom-color': 'oklch(0.922 0 0)', 'border-left-color': 'oklch(0.922 0 0)',
  'border-top-left-radius': '8px', 'border-top-right-radius': '8px', 'border-bottom-right-radius': '8px', 'border-bottom-left-radius': '8px',
  'background-color': 'oklch(0.205 0 0)', 'background-image': 'none', 'background-clip': 'border-box', opacity: '1',
  'column-gap': '6px', 'row-gap': '6px', 'box-shadow': 'none', ...over,
});
const sizes = (width: 'auto' | 'fixed', height: 'auto' | 'fixed'): SourceSizeOrigin[] => [
  { channel: 'width', status: width, selectors: [], value: 'auto' },
  { channel: 'height', status: height, selectors: height === 'fixed' ? ['.h-9'] : [], ...(height === 'fixed' ? { authoredValue: 'calc(var(--spacing) * 9)' } : {}) },
];
const solid = (r: number, g: number, b: number, opacity = 1, variable?: string) => ({ type: 'SOLID', visible: true, opacity, blendMode: 'NORMAL', color: { r: r / 255, g: g / 255, b: b / 255 }, ...(variable ? { boundVariables: { color: { type: 'VARIABLE_ALIAS', id: variable } } } : {}) });
const root = (values: Record<string, unknown> = {}, childIds = ['slot']): NativeNode => ({
  id: 'root', type: 'COMPONENT', childIds,
  values: {
    width: 23, height: 36, layoutSizingHorizontal: 'HUG', layoutSizingVertical: 'FIXED', layoutMode: 'HORIZONTAL', strokeAlign: 'INSIDE', opacity: 1, itemSpacing: 6,
    paddingTop: 0, paddingRight: 10, paddingBottom: 0, paddingLeft: 10, strokeTopWeight: 1, strokeRightWeight: 1, strokeBottomWeight: 1, strokeLeftWeight: 1,
    topLeftRadius: 8, topRightRadius: 8, bottomRightRadius: 8, bottomLeftRadius: 8, cornerRadius: 8, effects: [],
    fills: [solid(23, 23, 23)], strokes: [solid(229, 229, 229)], resolvedVariableModes: { collection: 'light' }, ...values,
  },
});
const slot: NativeNode = { id: 'slot', type: 'SLOT', parentId: 'root', childIds: [], values: {} };
const nodesOf = (...nodes: NativeNode[]) => new Map(nodes.map((n) => [n.id, n]));
const fixedHeight: NativePlanSpec = { fixedHeight: { px: 36 } };
const verdicts = (source: ReturnType<typeof sourceRootFacts>, native: ReturnType<typeof nativeRootFacts>) => Object.fromEntries(compareRootFacts(source, native).map((f) => [f.kind, f.verdict])) as Record<FactKind, string>;
const baseline = (s: Record<string, string> = {}, n: Record<string, unknown> = {}) => verdicts(sourceRootFacts(style(s), sizes('auto', 'fixed')), nativeRootFacts(root(n), nodesOf(root(n), slot), new Map(), fixedHeight));

test('every fact kind yields exactly one verdict, in order, and the baseline agrees except the content-derived width', () => {
  const out = compareRootFacts(sourceRootFacts(style(), sizes('auto', 'fixed')), nativeRootFacts(root(), nodesOf(root(), slot), new Map(), fixedHeight));
  assert.deepEqual(out.map((f) => f.kind), [...FACT_KINDS]);
  for (const fact of out) assert.equal(fact.verdict, fact.kind === 'width' ? 'not-comparable:content-derived-width-empty-slot' : 'match', fact.kind);
  const width = out.find((f) => f.kind === 'width')!;
  assert.equal(width.source, '120.5');
  assert.equal(width.native, '23');
  assert.match(width.evidence!, /source width origin auto; native sizing HUG, plan declares no fixed size; native content empty-slot/);
  for (const kind of FACT_KINDS) assert.equal(Object.values(MISMATCH_CLASSES).filter((fits) => fits(kind)).length, 1, `${kind} belongs to exactly one ratchet class`);
});

test('a declared dimension is compared; a content-derived one is not-comparable with both numbers; a one-sided declaration is a mismatch', () => {
  const pair = (origin: 'auto' | 'fixed', px: string, native: Record<string, unknown>, spec: NativePlanSpec, extra: NativeNode[] = []) => {
    const node = root(native, ['slot', ...extra.map((n) => n.id)]);
    return compareRootFacts(sourceRootFacts(style({ height: px }), sizes('auto', origin)), nativeRootFacts(node, nodesOf(node, slot, ...extra), new Map(), spec)).find((f) => f.kind === 'height')!;
  };
  assert.equal(pair('fixed', '36px', {}, fixedHeight).verdict, 'match');
  assert.equal(pair('fixed', '36px', { height: 35 }, { fixedHeight: { px: 35 } }).verdict, 'mismatch');
  const derived = pair('auto', '22px', { height: 3, layoutSizingVertical: 'HUG' }, {});
  assert.equal(derived.verdict, 'not-comparable:content-derived-height-empty-slot');
  assert.deepEqual([derived.source, derived.native], ['22', '3']);
  // the same numbers are a MISMATCH the moment either side declares the size
  assert.equal(pair('auto', '22px', { height: 3 }, { fixedHeight: { px: 3 } }).verdict, 'mismatch');
  assert.equal(pair('auto', '22px', { height: 22 }, { lits: { height: 22 } }).verdict, 'mismatch');
  assert.equal(pair('fixed', '36px', { height: 3, layoutSizingVertical: 'HUG' }, {}).verdict, 'mismatch');
  // the plan and the canvas must agree on whether the size is declared
  assert.equal(pair('fixed', '36px', {}, {}).verdict, 'not-comparable:native-sizing-evidence-disagrees');
  assert.equal(pair('fixed', '36px', { layoutSizingVertical: 'HUG' }, fixedHeight).verdict, 'not-comparable:native-sizing-evidence-disagrees');
  assert.equal(pair('auto', '22px', { layoutSizingVertical: 'FILL' }, {}).verdict, 'not-comparable:native-height-fills-its-container');
  // content in the slot: still content-derived, but no longer the empty-slot case
  const label: NativeNode = { id: 'label', type: 'TEXT', parentId: 'slot', values: {} };
  const filled = { ...slot, childIds: ['label'] };
  const node = root({ height: 22, layoutSizingVertical: 'HUG' });
  const withContent = compareRootFacts(sourceRootFacts(style({ height: '22px' }), sizes('auto', 'auto')), nativeRootFacts(node, nodesOf(node, filled, label), new Map(), {})).find((f) => f.kind === 'height')!;
  assert.equal(withContent.verdict, 'not-comparable:content-derived-height');
  // no authored evidence, or a content-box source, is named rather than guessed
  const unrecorded = compareRootFacts(sourceRootFacts(style(), undefined), nativeRootFacts(root(), nodesOf(root(), slot), new Map(), fixedHeight)).find((f) => f.kind === 'height')!;
  assert.equal(unrecorded.verdict, 'not-comparable:source-height-origin-not-recorded');
  assert.equal(baseline({ 'box-sizing': 'content-box' }).height, 'not-comparable:source-box-sizing-not-border-box');
});

test('numbers are exact or float32 — never rounded', () => {
  assert.ok(numericEqual(Math.fround(10.4), 10.4));
  assert.ok(!numericEqual(10.400001, 10.4));
  assert.equal(baseline({ 'padding-left': '10.4px' }, { paddingLeft: Math.fround(10.4) })['padding-left'], 'match');
  assert.equal(baseline({ 'padding-left': '10.4px' }, { paddingLeft: 10.4 })['padding-left'], 'match');
  assert.equal(baseline({ 'padding-left': '10.4px' }, { paddingLeft: 10 })['padding-left'], 'mismatch');
  assert.equal(baseline({ 'padding-left': '10.4px' }, { paddingLeft: 10.400001 })['padding-left'], 'mismatch');
  assert.equal(baseline({ opacity: '0.5' }, { opacity: 0.5 }).opacity, 'match');
  assert.equal(baseline({ opacity: '0.5' }, { opacity: 0.51 }).opacity, 'mismatch');
  assert.equal(baseline({ 'padding-top': '5%' })['padding-top'], 'not-comparable:source-not-a-single-px-length');
  assert.equal(baseline({}, { paddingTop: undefined })['padding-top'], 'not-comparable:value-not-read-back');
});

test('per-side border widths and per-corner radii are separate facts', () => {
  const sides = baseline({ 'border-left-width': '2px' }, { strokeTopWeight: 1, strokeLeftWeight: 3 });
  assert.deepEqual([sides['border-width-top'], sides['border-width-right'], sides['border-width-bottom'], sides['border-width-left']], ['match', 'match', 'match', 'mismatch']);
  const corners = baseline({ 'border-top-left-radius': '8px', 'border-top-right-radius': '4px', 'border-bottom-right-radius': '2px', 'border-bottom-left-radius': '0px' }, { topLeftRadius: 8, topRightRadius: 4, bottomRightRadius: 3, bottomLeftRadius: 0 });
  assert.deepEqual([corners['radius-top-left'], corners['radius-top-right'], corners['radius-bottom-right'], corners['radius-bottom-left']], ['match', 'match', 'mismatch', 'match']);
  assert.equal(baseline({ 'border-top-left-radius': '8px 4px' })['radius-top-left'], 'not-comparable:source-not-a-single-px-length');
  assert.equal(baseline({}, { strokeAlign: 'CENTER' })['border-width-top'], 'not-comparable:native-stroke-align-not-inside');
});

test('paint: a literal and a bound native paint both resolve to sRGB 8-bit; an unresolvable paint is not-comparable, never guessed', () => {
  assert.deepEqual(cssColorToRgba8('oklch(0.205 0 0)'), [23, 23, 23, 255]);
  assert.deepEqual(cssColorToRgba8('oklab(0.577 0.217662 0.112464 / 0.1)'), [231, 0, 11, 26]);
  assert.deepEqual(cssColorToRgba8('rgb(229, 229, 229)'), [229, 229, 229, 255]);
  assert.equal(cssColorToRgba8('color-mix(in srgb, red, blue)'), null);
  assert.equal(baseline().background, 'match'); // literal
  assert.equal(baseline({ 'background-color': 'oklch(0.97 0 0)' }).background, 'mismatch');

  const variable = (value: unknown): Map<string, NativeVariable> => new Map([['v1', { id: 'v1', name: 'tokens/primary', variableCollectionId: 'collection', valuesByMode: { light: value, dark: { r: 1, g: 1, b: 1, a: 1 } } }]]);
  const bound = root({ fills: [solid(23, 23, 23, 1, 'v1')] });
  const facts = (variables: Map<string, NativeVariable>) => nativeRootFacts(bound, nodesOf(bound, slot), variables, fixedHeight);
  const resolved = facts(variable({ r: 23 / 255, g: 23 / 255, b: 23 / 255, a: 1 }));
  assert.deepEqual(resolved.background, { kind: 'solid', rgba8: [23, 23, 23, 255], raw: [23 / 255, 23 / 255, 23 / 255, 1], bound: 'tokens/primary', carrier: 'root-fills' });
  assert.equal(verdicts(sourceRootFacts(style(), sizes('auto', 'fixed')), resolved).background, 'match');
  assert.equal(verdicts(sourceRootFacts(style(), sizes('auto', 'fixed')), facts(new Map())).background, 'not-comparable:native-bound-variable-not-in-the-readback');
  assert.equal(verdicts(sourceRootFacts(style(), sizes('auto', 'fixed')), facts(variable({ r: 0, g: 0, b: 0, a: 1 }))).background, 'not-comparable:native-bound-variable-disagrees-with-the-inline-paint');
  assert.equal(verdicts(sourceRootFacts(style(), sizes('auto', 'fixed')), facts(variable(12))).background, 'not-comparable:native-bound-variable-not-a-colour');
  // an alias resolves through the readback's own variables
  const aliased = variable({ type: 'VARIABLE_ALIAS', id: 'v2' });
  aliased.set('v2', { id: 'v2', name: 'primitives/neutral-900', variableCollectionId: 'collection', valuesByMode: { light: { r: 23 / 255, g: 23 / 255, b: 23 / 255, a: 1 } } });
  assert.equal(verdicts(sourceRootFacts(style(), sizes('auto', 'fixed')), facts(aliased)).background, 'match');

  assert.equal(baseline({ 'background-color': 'color-mix(in srgb, red, blue)' }).background, 'not-comparable:source-colour-not-lowered(color-mix(in srgb, red, blue))');
  assert.equal(baseline({ 'background-image': 'linear-gradient(red, blue)' }).background, 'not-comparable:source-background-image-present');
  assert.equal(baseline({}, { fills: [{ type: 'GRADIENT_LINEAR', visible: true }] }).background, 'not-comparable:native-paint-not-a-plain-solid(GRADIENT_LINEAR)');
  assert.equal(baseline({}, { fills: [solid(23, 23, 23), solid(0, 0, 0)] }).background, 'not-comparable:native-paint-stack-has-several-layers');
  // nothing painted on either side is the same paint, whatever rgb an invisible paint carries
  assert.equal(baseline({ 'background-color': 'rgba(0, 0, 0, 0)' }, { fills: [] }).background, 'match');
  assert.equal(baseline({ 'background-color': 'rgba(0, 0, 0, 0)' }, { fills: [solid(255, 255, 255, 0)] }).background, 'match');
  assert.equal(baseline({ 'background-color': 'rgba(0, 0, 0, 0)' }, { fills: [{ ...solid(23, 23, 23), visible: false }] }).background, 'match');
  assert.equal(baseline({}, { fills: [] }).background, 'mismatch');
  // border paint: one colour or it is named
  assert.equal(baseline()['border-paint'], 'match');
  assert.equal(baseline({ 'border-left-color': 'rgb(0, 0, 0)' })['border-paint'], 'not-comparable:source-border-colours-differ-per-side');
  assert.equal(baseline({ 'border-top-style': 'dashed', 'border-right-style': 'dashed', 'border-bottom-style': 'dashed', 'border-left-style': 'dashed' })['border-paint'], 'not-comparable:source-border-style-not-solid(dashed)');
  const none = { 'border-top-width': '0px', 'border-right-width': '0px', 'border-bottom-width': '0px', 'border-left-width': '0px' };
  assert.equal(baseline(none, { strokeTopWeight: 0, strokeRightWeight: 0, strokeBottomWeight: 0, strokeLeftWeight: 0 })['border-paint'], 'not-comparable:no-border-on-either-side');
});

test('a padding-box background is read from the plane the geometry identifies, and the clip must be carried', () => {
  const plane = (values: Record<string, unknown> = {}): NativeNode => ({ id: 'plane', type: 'RECTANGLE', parentId: 'root', values: { x: 1, y: 1, width: 21, height: 34, cornerRadius: 7, layoutPositioning: 'ABSOLUTE', constraints: { horizontal: 'STRETCH', vertical: 'STRETCH' }, visible: true, opacity: 1, fills: [solid(23, 23, 23)], ...values } });
  const host = root({ fills: [] }, ['plane', 'slot']);
  assert.equal(nativeBackgroundPlane(host, nodesOf(host, plane(), slot))?.id, 'plane');
  for (const broken of [{ x: 0 }, { width: 23 }, { cornerRadius: 8 }, { layoutPositioning: 'AUTO' }, { constraints: { horizontal: 'MIN', vertical: 'STRETCH' } }]) assert.equal(nativeBackgroundPlane(host, nodesOf(host, plane(broken), slot)), null, JSON.stringify(broken));
  const compare = (clip: string, native: NativeNode, ...rest: NativeNode[]) => verdicts(sourceRootFacts(style({ 'background-clip': clip }), sizes('auto', 'fixed')), nativeRootFacts(native, nodesOf(native, slot, ...rest), new Map(), fixedHeight));
  const viaPlane = nativeRootFacts(host, nodesOf(host, plane(), slot), new Map(), fixedHeight);
  assert.equal(viaPlane.background.kind === 'solid' && viaPlane.background.carrier, 'padding-box-plane');
  assert.equal(viaPlane.content, 'empty-slot', 'the paint plane is not content');
  assert.equal(compare('padding-box', host, plane()).background, 'match');
  assert.equal(compare('border-box', host, plane()).background, 'not-comparable:background-clip-carrier-differs');
  assert.equal(compare('padding-box', root()).background, 'not-comparable:background-clip-carrier-differs');
  assert.equal(compare('text', root()).background, 'not-comparable:source-background-clip-outside-the-compared-form');
  assert.equal(compare('padding-box', host, plane({ fills: [solid(24, 23, 23)] })).background, 'mismatch');
  assert.equal(compare('padding-box', host, plane({ opacity: 0.5 })).background, 'not-comparable:native-background-plane-layer-opacity-not-1');
  const both = root({}, ['plane', 'slot']);
  assert.equal(compare('padding-box', both, plane()).background, 'not-comparable:native-background-has-several-carriers');
});

test('gap follows the main axis and lowers a flex `normal`; a shadow is compared only in the parsed form', () => {
  assert.equal(baseline({ 'column-gap': 'normal' }, { itemSpacing: 0 }).gap, 'match');
  assert.equal(baseline({ 'column-gap': 'normal' }).gap, 'mismatch');
  assert.equal(baseline({ 'column-gap': '4px' }).gap, 'mismatch');
  assert.equal(baseline({ 'flex-direction': 'column' }).gap, 'not-comparable:layout-axis-differs');
  assert.equal(baseline({ 'flex-direction': 'column', 'row-gap': '6px' }, { layoutMode: 'VERTICAL' }).gap, 'match');
  assert.equal(baseline({ display: 'block' }).gap, 'not-comparable:source-not-a-flex-container');
  assert.equal(baseline({}, { layoutMode: 'NONE' }).gap, 'not-comparable:native-not-an-auto-layout-stack');

  const css = 'rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 1px 2px 0px';
  const effect = (over: Record<string, unknown> = {}) => ({ type: 'DROP_SHADOW', visible: true, blendMode: 'NORMAL', radius: 2, spread: 0, offset: { x: 0, y: 1 }, color: { r: 0, g: 0, b: 0, a: Math.fround(0.05) }, boundVariables: {}, showShadowBehindNode: true, ...over });
  const clear = effect({ radius: 0, offset: { x: 0, y: 0 }, color: { r: 0, g: 0, b: 0, a: 0 } });
  assert.equal(baseline({ 'box-shadow': css }, { effects: [clear, effect()] }).shadow, 'match');
  assert.equal(baseline({ 'box-shadow': css }, { effects: [effect()] }).shadow, 'mismatch', 'a missing layer');
  assert.equal(baseline({ 'box-shadow': css }, { effects: [clear, effect({ radius: 3 })] }).shadow, 'mismatch');
  assert.equal(baseline({ 'box-shadow': css }, { effects: [clear, effect({ type: 'INNER_SHADOW' })] }).shadow, 'mismatch');
  assert.equal(baseline({ 'box-shadow': css }, { effects: [clear, effect({ color: { r: 0, g: 0, b: 0, a: 0.1 } })] }).shadow, 'mismatch');
  assert.equal(baseline({ 'box-shadow': 'none' }, { effects: [] }).shadow, 'match');
  assert.equal(baseline({ 'box-shadow': 'oklab(0.5 0 0 / 0.5) 0px 1px 2px 0px' }, { effects: [effect()] }).shadow, 'not-comparable:source-shadow-outside-the-parsed-grammar');
  assert.equal(baseline({ 'box-shadow': css }, { effects: [clear, effect({ type: 'LAYER_BLUR' })] }).shadow, 'not-comparable:native-effect-outside-the-compared-form');
  assert.equal(baseline({ 'box-shadow': css }, { effects: [clear, effect({ boundVariables: { color: { type: 'VARIABLE_ALIAS', id: 'v' } } })] }).shadow, 'not-comparable:native-effect-outside-the-compared-form');
});

test('the join is data only: set values map through the plan axes, an omission collapses onto the default and must share its tree', () => {
  const axes = joinAxesOfPlan({ propNames: { tone: 'Tone' }, codeValueAxes: { axes: [
    { property: 'scale', propName: 'scale', codeProp: 'scale', default: 'md', values: [{ value: 'null', label: 'null', code: null }, { value: 'md', label: 'md', code: 'md' }] },
    { property: 'tone', propName: 'tone', codeProp: 'tone', default: 'plain', values: [{ value: 'plain', label: 'Plain', code: 'plain' }, { value: 'loud', label: 'Loud', code: 'loud' }] },
  ] } });
  assert.deepEqual(assignmentOf(axes, { scale: { kind: 'set', value: null }, tone: { kind: 'omit' } }), { assignment: { scale: 'null', tone: 'plain' }, omitted: ['tone'] });
  assert.throws(() => assignmentOf(axes, { scale: { kind: 'set', value: 'xl' }, tone: { kind: 'omit' } }), /root-geometry-join-value-unmapped:scale=xl/);
  assert.throws(() => assignmentOf(axes, { scale: { kind: 'set', value: 'md' } }), /root-geometry-join-properties-differ/);
  const set = (scale: unknown, tone: unknown) => ({ scale: { kind: 'set' as const, value: scale }, tone: { kind: 'set' as const, value: tone } });
  const rows = [
    { id: '0', changes: set(null, 'plain'), treeSha256: 'a' }, { id: '1', changes: set(null, 'loud'), treeSha256: 'b' },
    { id: '2', changes: set('md', 'plain'), treeSha256: 'c' }, { id: '3', changes: set('md', 'loud'), treeSha256: 'd' },
    { id: '4', changes: { scale: { kind: 'omit' as const }, tone: { kind: 'set' as const, value: 'loud' } }, treeSha256: 'd' },
  ];
  const mains = [{ id: '9:3', variantProperties: { scale: 'md', Tone: 'Loud' } }, { id: '9:0', variantProperties: { scale: 'null', Tone: 'Plain' } }, { id: '9:1', variantProperties: { scale: 'null', Tone: 'Loud' } }, { id: '9:2', variantProperties: { Tone: 'Plain', scale: 'md' } }];
  const { joined, collapsed } = joinSourceRowsToNativeMains(axes, rows, mains);
  assert.deepEqual(joined.map((j) => [j.nativeNodeId, j.sourceRow]), [['9:3', '3'], ['9:0', '0'], ['9:1', '1'], ['9:2', '2']]);
  assert.deepEqual(collapsed, [{ sourceRow: '4', changes: rows[4]!.changes, omitted: ['scale'], assignment: { scale: 'md', tone: 'loud' }, canonicalRow: '3', treeSha256: 'd', canonicalTreeSha256: 'd' }]);
  assert.throws(() => joinSourceRowsToNativeMains(axes, [...rows.slice(0, 4), { ...rows[4]!, treeSha256: 'x' }], mains), /root-geometry-collapse-unproven:row 4 does not render the tree of row 3/);
  assert.throws(() => joinSourceRowsToNativeMains(axes, [...rows, { ...rows[0]!, id: '5' }], mains), /root-geometry-join-ambiguous:rows 0 and 5/);
  assert.throws(() => joinSourceRowsToNativeMains(axes, rows, mains.slice(1)), /root-geometry-source-row-without-native-variant:3/);
  assert.throws(() => joinSourceRowsToNativeMains(axes, rows.slice(1), mains), /root-geometry-native-variant-without-source-row:9:0/);
  assert.throws(() => joinSourceRowsToNativeMains(axes, rows, [...mains.slice(0, 3), { id: '9:2', variantProperties: { scale: 'md', Tone: 'plain' } }]), /root-geometry-native-variant-without-source-row:9:2/);
  assert.throws(() => joinAxesOfPlan({}), /root-geometry-join-axes-missing/);
  const noDefault = joinAxesOfPlan({ codeValueAxes: { axes: [{ property: 'scale', codeProp: 'scale', values: [{ value: 'md', label: 'md', code: 'md' }] }] } });
  assert.throws(() => assignmentOf(noDefault, { scale: { kind: 'omit' } }), /root-geometry-join-omitted-without-default:scale/);
});
