/** Predict the complete local geometry delta for a fixed flex cross-axis size.
 * This is not write authority. Callers must independently prove variable
 * ownership, every document consumer, the desired component delta and the
 * complete surrounding inventory before applying these transitions.
 *
 * The extra native fields below must be explicitly observed. Historical
 * inventories that omit them do not establish a safe layout prediction. */
import { canonicalJson } from './contract-provenance.js';
import type { NativeSourceReadback } from './native-source-observation.js';

export interface NativeCrossSizeTransition {
  nodeId: string;
  before: Record<string, number | number[][]>;
  after: Record<string, number | number[][]>;
}
const same = (a: unknown, b: unknown) => canonicalJson(a) === canonicalJson(b);
const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && Math.abs(v) <= 1e6;
const positive = (v: unknown): v is number => finite(v) && v >= 0.01;
// This bounded dyadic domain keeps each inset sum, subtraction and half-space
// alignment exactly representable in float32. Arbitrary fractional insets
// disagreed with native baseline arithmetic in the live diagnostic matrix.
const layoutNumber = (v: number) => Math.abs(v) <= 16384 && Number.isInteger(v * 64);
function fail(reason: string): never { throw Error('native-cross-size-' + reason); }
const identityTransform = (v: Record<string, any>) => finite(v.x) && finite(v.y) &&
  same(v.relativeTransform, [[1, 0, v.x], [0, 1, v.y]]);

export function predictNativeFixedCrossSize(
  inventory: NonNullable<NativeSourceReadback['nodes']>,
  rootId: string,
  channel: 'width' | 'height',
  target: number,
): NativeCrossSizeTransition[] {
  const indexed = new Map(inventory.map(n => [n.id, n]));
  if (indexed.size !== inventory.length) fail('duplicate-node');
  const root = indexed.get(rootId), v = root?.values;
  if (!root || root.type !== 'COMPONENT' || !v || v.visible !== true || !identityTransform(v) ||
      v.layoutMode !== (channel === 'height' ? 'HORIZONTAL' : 'VERTICAL') ||
      v.layoutWrap !== 'NO_WRAP' || v.primaryAxisSizingMode !== 'FIXED' ||
      v.counterAxisSizingMode !== 'FIXED' || v.layoutSizingHorizontal !== 'FIXED' ||
      v.layoutSizingVertical !== 'FIXED' || v.targetAspectRatio !== null ||
      typeof v.strokesIncludedInLayout !== 'boolean' || v.strokeAlign !== 'INSIDE' ||
      !['MIN', 'CENTER', 'MAX'].includes(v.counterAxisAlignItems)) fail('root-unqualified');
  const parent = indexed.get(root.parentId);
  if (!parent || !['PAGE', 'COMPONENT_SET'].includes(parent.type) ||
      parent.values.layoutMode !== undefined && parent.values.layoutMode !== 'NONE') fail('parent-layout-unqualified');
  if (!positive(v.width) || !positive(v.height) || !positive(target)) fail('dimension-unqualified');
  target = Math.fround(target);
  if (!positive(target)) fail('dimension-unqualified');
  if (!layoutNumber(target) || !layoutNumber(v[channel])) fail('numeric-domain-unqualified');
  const min = v[channel === 'height' ? 'minHeight' : 'minWidth'];
  const max = v[channel === 'height' ? 'maxHeight' : 'maxWidth'];
  if (min !== null || max !== null) fail('size-limits-unqualified');
  const sides = channel === 'height' ? ['Top', 'Bottom'] : ['Left', 'Right'];
  const inset = sides.map(side => {
    const padding = v['padding' + side], stroke = v['stroke' + side + 'Weight'];
    if (!finite(padding) || padding < 0 || !finite(stroke) || stroke < 0) fail('insets-unqualified');
    if (!layoutNumber(padding) || v.strokesIncludedInLayout && !layoutNumber(stroke)) fail('numeric-domain-unqualified');
    return padding + (v.strokesIncludedInLayout ? stroke : 0);
  });
  const position = channel === 'height' ? 'y' : 'x';
  const axis = channel === 'height' ? 'Vertical' : 'Horizontal';
  const factor = v.counterAxisAlignItems === 'CENTER' ? 0.5 : v.counterAxisAlignItems === 'MAX' ? 1 : 0;
  const transitions: NativeCrossSizeTransition[] = [{ nodeId: root.id,
    before: { [channel]: v[channel] }, after: { [channel]: target } }];
  if (new Set(root.childIds).size !== root.childIds.length || !root.childIds.length) fail('children-unqualified');
  for (const id of root.childIds) {
    const child = indexed.get(id), c = child?.values;
    if (!child || child.parentId !== root.id || !c || c.visible !== true || child.childIds.length ||
        !['FRAME', 'RECTANGLE', 'ELLIPSE'].includes(child.type) || !identityTransform(c) ||
        !positive(c.width) || !positive(c.height) || c.targetAspectRatio !== null ||
        c.layoutSizingHorizontal !== 'FIXED' || c.layoutSizingVertical !== 'FIXED' ||
        child.type === 'FRAME' && c.layoutMode !== 'NONE' &&
          (!['HORIZONTAL', 'VERTICAL'].includes(c.layoutMode) || c.layoutWrap !== 'NO_WRAP' ||
            c.primaryAxisSizingMode !== 'FIXED' || c.counterAxisSizingMode !== 'FIXED') ||
        !['minWidth','maxWidth','minHeight','maxHeight'].every(k => c[k] === null)) fail('child-unqualified');
    if (c.layoutPositioning === 'ABSOLUTE') {
      if (!same(c.constraints, { horizontal: 'MIN', vertical: 'MIN' })) fail('absolute-constraints-unqualified');
      continue;
    }
    if (c.layoutPositioning !== 'AUTO' || c.layoutAlign !== 'INHERIT' ||
        c.layoutGrow !== 0 || c['layoutSizing' + axis] !== 'FIXED') fail('flow-child-unqualified');
    if (!layoutNumber(c[channel])) fail('numeric-domain-unqualified');
    const available = (size: number) => size - inset[0] - inset[1] - c[channel];
    if (available(v[channel]) < 0 || available(target) < 0) fail('content-overflow');
    const expected = (size: number) => Math.fround(inset[0] + available(size) * factor);
    if (c[position] !== expected(v[channel])) fail('baseline-alignment-mismatch');
    const next = expected(target), transform = structuredClone(c.relativeTransform);
    transform[channel === 'height' ? 1 : 0][2] = next;
    transitions.push({ nodeId: id,
      before: { [position]: c[position], relativeTransform: structuredClone(c.relativeTransform) },
      after: { [position]: next, relativeTransform: transform } });
  }
  return transitions;
}
