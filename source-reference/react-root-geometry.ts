/**
 * ROOT GEOMETRY — the non-content box facts of a React root, MEASURED in the
 * sealed source observation, against the values an independent native Figma
 * readback returned for the main that carries the same property assignment.
 *
 * Pure and general: nothing here names a component, a variant or a node id.
 * Identity comes from data — the plan's code-value axes, a source row's
 * property changes and a native main's `variantProperties`.
 *
 * It closes one gap only. The readback verifier proves canvas == PLAN and
 * lists `native-computed-geometry-unverified` and
 * `native-resolved-paint-values-unverified` among its limitations; this
 * compares SOURCE MEASUREMENT with CANVAS READBACK for the facts both sides
 * express. It proves no pixel, no width of a content-sized box, no text, no
 * font and no antialiasing.
 *
 * Every fact is `match`, `mismatch` or `not-comparable:<reason>`. Nothing is
 * dropped, guessed or softened:
 *   - numbers use the repo's existing policy — exact, or the float32 of the
 *     expected value (`numeric` in core/native-source-observation.ts). No
 *     tolerance, no rounding: the writer applies none to a px fact.
 *   - CSS values are lowered by the mint's OWN function (`kindOf` in
 *     extract/computed/lib.ts): px -> Number, a colour -> sRGB 8-bit hex
 *     through the one OKLab conversion, alpha -> Math.round(a * 255). A native
 *     colour float is put on the same 8-bit grid (Math.round(c * 255)).
 *   - a flex container's `normal` gap is its used value 0px — the root-matrix
 *     assembler's own named lowering `flex-normal-gap-used-value`.
 *   - a paint whose 8-bit alpha is 0 paints nothing: it equals `none` and any
 *     other alpha-0 paint (the rgb of an invisible paint is not observable).
 *   - a box-shadow is compared only when `parseCssBoxShadow` (the repo's
 *     exported parser) accepts the source value and every native effect is a
 *     plain visible NORMAL-blend drop/inner shadow; anything else is
 *     `not-comparable` by name.
 *   - a DIMENSION is comparable only when it is DECLARED. The source's
 *     authored evidence is the pipeline's own `styleOrigin.sizes` status
 *     (`fixed` vs `auto`); the native evidence is the plan's fixed size plus
 *     the readback's FIXED sizing mode, which must agree. `auto` against HUG is
 *     content-derived on both sides: `not-comparable`, both numbers printed.
 *     One side declaring what the other derives is a `mismatch`.
 */
import { kindOf, normalizeValue } from '../extract/computed/lib.js';
import { CssBoxShadowError, parseCssBoxShadow } from '../recipe/css-box-shadow.js';

export type Verdict = 'match' | 'mismatch' | `not-comparable:${string}`;
export type Rgba8 = [number, number, number, number];
export interface Unresolved { unresolved: string; raw?: string }
export type Num = number | Unresolved;
export type Paint =
  | { kind: 'none' }
  | { kind: 'solid'; rgba8: Rgba8; raw: string | number[]; bound?: string }
  | { kind: 'unresolved'; reason: string };
export interface ShadowLayer { inner: boolean; x: number; y: number; blur: number; spread: number; rgba8: Rgba8 }
export type ShadowStack = { layers: ShadowLayer[] } | Unresolved;

export const SIDES = ['top', 'right', 'bottom', 'left'] as const;
export const CORNERS = ['top-left', 'top-right', 'bottom-right', 'bottom-left'] as const;
type Side = (typeof SIDES)[number];
type Corner = (typeof CORNERS)[number];

export interface SourceDimension { px: Num; origin: 'fixed' | 'auto' | 'unresolved' | 'not-recorded'; authoredValue?: string; selectors?: string[]; reason?: string }
export interface NativeDimension { px: Num; sizing: string | null; planDeclared: { field: string; px: number } | null }

export interface SourceRootFacts {
  boxSizing: string | null; display: string | null; flexDirection: string | null; backgroundClip: string | null;
  width: SourceDimension; height: SourceDimension;
  padding: Record<Side, Num>; borderWidth: Record<Side, Num>; radius: Record<Corner, Num>;
  background: Paint; borderPaint: Paint; opacity: Num;
  gap: { px: Num; channel: string | null; lowering?: string };
  shadow: ShadowStack;
}
export interface NativeRootFacts {
  layoutMode: string | null; strokeAlign: string | null; content: 'empty-slot' | 'has-content' | 'no-slot';
  width: NativeDimension; height: NativeDimension;
  padding: Record<Side, Num>; borderWidth: Record<Side, Num>; radius: Record<Corner, Num>;
  background: Paint & { carrier?: 'root-fills' | 'padding-box-plane'; nodeId?: string }; borderPaint: Paint; opacity: Num;
  gap: { px: Num };
  shadow: ShadowStack;
}

export const FACT_KINDS = [
  'width', 'height',
  ...SIDES.map((s) => `padding-${s}` as const),
  ...SIDES.map((s) => `border-width-${s}` as const),
  ...CORNERS.map((c) => `radius-${c}` as const),
  'background', 'border-paint', 'opacity', 'gap', 'shadow',
] as const;
export type FactKind = (typeof FACT_KINDS)[number];
export interface FactVerdict { kind: FactKind; verdict: Verdict; source: string; native: string; evidence?: string }

/** The ratchet's closed class set, and the fact kinds each class may name. */
export const MISMATCH_CLASSES: Record<string, (kind: FactKind) => boolean> = {
  'declared-dimension-differs': (k) => k === 'width' || k === 'height',
  'padding-differs': (k) => k.startsWith('padding-'),
  'border-width-differs': (k) => k.startsWith('border-width-'),
  'radius-differs': (k) => k.startsWith('radius-'),
  'paint-differs': (k) => k === 'background' || k === 'border-paint',
  'opacity-differs': (k) => k === 'opacity',
  'gap-differs': (k) => k === 'gap',
  'shadow-differs': (k) => k === 'shadow',
};

/** core/native-source-observation.ts `numeric`, verbatim: exact, or the float32 of the expected value. */
export const numericEqual = (native: number, expected: number): boolean => native === expected || native === Math.fround(expected);

const isUnresolved = (v: unknown): v is Unresolved => !!v && typeof v === 'object' && 'unresolved' in (v as object);
const object = (v: unknown): v is Record<string, any> => !!v && typeof v === 'object' && !Array.isArray(v);

// ---------------------------------------------------------------------------
// (a) sealed source root `tree.style` -> normalized box facts
// ---------------------------------------------------------------------------
type Style = Record<string, string | undefined>;

const sourcePx = (style: Style, channel: string): Num => {
  const raw = style[channel];
  if (typeof raw !== 'string') return { unresolved: 'channel-not-recorded' };
  const kind = kindOf(channel, raw);
  return kind?.kind === 'px' && typeof kind.value === 'number' ? kind.value : { unresolved: 'not-a-single-px-length', raw };
};

/** A CSS colour -> sRGB 8-bit, through the mint's own lowering; null when the mint cannot lower it either. */
export function cssColorToRgba8(raw: string): Rgba8 | null {
  const kind = kindOf('color', normalizeValue(raw));
  if (kind?.kind !== 'color' || typeof kind.value !== 'string' || !/^[0-9a-f]{6}([0-9a-f]{2})?$/.test(kind.value)) return null;
  const byte = (i: number) => parseInt(kind.value.toString().slice(i, i + 2), 16);
  return [byte(0), byte(2), byte(4), kind.value.length === 8 ? byte(6) : 255];
}
const sourcePaint = (raw: string | undefined): Paint => {
  if (typeof raw !== 'string') return { kind: 'unresolved', reason: 'channel-not-recorded' };
  const rgba8 = cssColorToRgba8(raw);
  return rgba8 ? { kind: 'solid', rgba8, raw } : { kind: 'unresolved', reason: `source-colour-not-lowered(${raw})` };
};

const hex8ToRgba8 = (hex: string): Rgba8 => [1, 3, 5, 7].map((i) => parseInt(hex.slice(i, i + 2), 16)) as Rgba8;
export function sourceShadow(raw: string | undefined): ShadowStack {
  if (typeof raw !== 'string') return { unresolved: 'channel-not-recorded' };
  try {
    return { layers: parseCssBoxShadow(raw).map((l) => ({ inner: l.kind === 'inner-shadow', x: l.offsetX, y: l.offsetY, blur: l.blur, spread: l.spread, rgba8: hex8ToRgba8(l.color) })) };
  } catch (error) {
    if (!(error instanceof CssBoxShadowError)) throw error;
    return { unresolved: 'source-shadow-outside-the-parsed-grammar', raw };
  }
}

export interface SourceSizeOrigin { channel: string; status: string; value?: string; authoredValue?: string; selectors?: string[]; reason?: string }

export function sourceRootFacts(style: Style, sizes: SourceSizeOrigin[] | undefined): SourceRootFacts {
  const dimension = (channel: 'width' | 'height'): SourceDimension => {
    const px = sourcePx(style, channel), origin = sizes?.find((s) => s.channel === channel);
    if (!origin) return { px, origin: 'not-recorded' };
    const status = origin.status === 'fixed' || origin.status === 'auto' ? origin.status : 'unresolved';
    return { px, origin: status, ...(origin.authoredValue !== undefined ? { authoredValue: origin.authoredValue } : {}), selectors: origin.selectors ?? [], ...(origin.reason ? { reason: origin.reason } : {}) };
  };
  const sides = (name: (side: Side) => string) => Object.fromEntries(SIDES.map((s) => [s, sourcePx(style, name(s))])) as Record<Side, Num>;
  const display = style.display ?? null, flexDirection = style['flex-direction'] ?? null;
  const flex = display === 'flex' || display === 'inline-flex';
  const gapChannel = !flex ? null : flexDirection === 'row' || flexDirection === 'row-reverse' ? 'column-gap' : flexDirection === 'column' || flexDirection === 'column-reverse' ? 'row-gap' : null;
  let gap: SourceRootFacts['gap'];
  if (!gapChannel) gap = { px: { unresolved: flex ? 'flex-direction-not-recorded' : 'source-not-a-flex-container' }, channel: null };
  else if (style[gapChannel] === 'normal') gap = { px: 0, channel: gapChannel, lowering: 'flex-normal-gap-used-value' };
  else gap = { px: sourcePx(style, gapChannel), channel: gapChannel };

  let borderPaint: Paint;
  const widths = sides((s) => `border-${s}-width`);
  const painted = SIDES.filter((s) => !(widths[s] === 0));
  const colours = new Set(painted.map((s) => style[`border-${s}-color`])), styles = new Set(painted.map((s) => style[`border-${s}-style`]));
  if (painted.length === 0) borderPaint = { kind: 'none' };
  else if (colours.size !== 1) borderPaint = { kind: 'unresolved', reason: 'source-border-colours-differ-per-side' };
  else if (styles.size !== 1 || !styles.has('solid')) borderPaint = { kind: 'unresolved', reason: `source-border-style-not-solid(${[...styles].join(',')})` };
  else borderPaint = sourcePaint([...colours][0]);

  const image = style['background-image'];
  const background: Paint = image === undefined ? { kind: 'unresolved', reason: 'channel-not-recorded' } : image !== 'none' ? { kind: 'unresolved', reason: 'source-background-image-present' } : sourcePaint(style['background-color']);
  const opacityKind = typeof style.opacity === 'string' ? kindOf('opacity', style.opacity) : null;
  return {
    boxSizing: style['box-sizing'] ?? null, display, flexDirection, backgroundClip: style['background-clip'] ?? null,
    width: dimension('width'), height: dimension('height'),
    padding: sides((s) => `padding-${s}`), borderWidth: widths,
    radius: Object.fromEntries(CORNERS.map((c) => [c, sourcePx(style, `border-${c}-radius`)])) as Record<Corner, Num>,
    background, borderPaint,
    opacity: opacityKind?.kind === 'number' && typeof opacityKind.value === 'number' ? opacityKind.value : { unresolved: 'not-a-number', ...(style.opacity !== undefined ? { raw: style.opacity } : {}) },
    gap, shadow: sourceShadow(style['box-shadow']),
  };
}

// ---------------------------------------------------------------------------
// (b) native readback node `values` -> normalized box facts
// ---------------------------------------------------------------------------
export interface NativeNode { id: string; type: string; parentId?: string; childIds?: string[]; values: Record<string, any>; variantProperties?: Record<string, string> }
export interface NativeVariable { id: string; name: string; variableCollectionId?: string; valuesByMode: Record<string, unknown> }

const nativeNum = (v: unknown): Num => (typeof v === 'number' && Number.isFinite(v) ? v : { unresolved: 'value-not-read-back' });
const toByte = (c: number): number => Math.round(c * 255);

/** One SOLID paint -> RGBA8. A bound colour resolves through the readback's own variables and must agree with the inline paint. */
export function nativePaint(paints: unknown, node: NativeNode, variables: Map<string, NativeVariable>): Paint {
  if (!Array.isArray(paints)) return { kind: 'unresolved', reason: 'paints-not-read-back' };
  const visible = paints.filter((p) => object(p) && p.visible !== false);
  if (visible.length === 0) return { kind: 'none' };
  if (visible.length > 1) return { kind: 'unresolved', reason: 'native-paint-stack-has-several-layers' };
  const paint = visible[0];
  if (paint.type !== 'SOLID' || !object(paint.color) || (paint.blendMode !== undefined && paint.blendMode !== 'NORMAL')) return { kind: 'unresolved', reason: `native-paint-not-a-plain-solid(${String(paint.type)})` };
  const inline = [paint.color.r, paint.color.g, paint.color.b, paint.opacity ?? 1];
  if (!inline.every((c) => typeof c === 'number' && c >= 0 && c <= 1)) return { kind: 'unresolved', reason: 'native-paint-colour-malformed' };
  const alias = paint.boundVariables?.color;
  let bound: string | undefined;
  if (alias !== undefined) {
    let value: unknown = alias, name: string | undefined;
    for (let hops = 0; object(value) && value.type === 'VARIABLE_ALIAS'; hops++) {
      const variable = variables.get(value.id);
      if (!variable || hops > 8) return { kind: 'unresolved', reason: 'native-bound-variable-not-in-the-readback' };
      const modes = Object.keys(variable.valuesByMode), resolved = node.values.resolvedVariableModes?.[variable.variableCollectionId ?? ''];
      const mode = typeof resolved === 'string' ? resolved : modes.length === 1 ? modes[0] : undefined;
      if (mode === undefined || !Object.hasOwn(variable.valuesByMode, mode)) return { kind: 'unresolved', reason: 'native-bound-variable-mode-not-resolved' };
      name ??= variable.name;
      value = variable.valuesByMode[mode];
    }
    if (!object(value) || ![value.r, value.g, value.b].every((c) => typeof c === 'number')) return { kind: 'unresolved', reason: 'native-bound-variable-not-a-colour' };
    const resolved = [value.r, value.g, value.b, value.a ?? 1];
    if (resolved.some((c, i) => c !== inline[i])) return { kind: 'unresolved', reason: 'native-bound-variable-disagrees-with-the-inline-paint' };
    bound = name;
  }
  return { kind: 'solid', rgba8: inline.map(toByte) as Rgba8, raw: inline, ...(bound !== undefined ? { bound } : {}) };
}

export function nativeShadow(effects: unknown): ShadowStack {
  if (!Array.isArray(effects)) return { unresolved: 'effects-not-read-back' };
  const layers: ShadowLayer[] = [];
  for (const e of effects) {
    if (!object(e) || (e.type !== 'DROP_SHADOW' && e.type !== 'INNER_SHADOW') || e.visible !== true || e.blendMode !== 'NORMAL' || !object(e.offset) || !object(e.color) ||
        (object(e.boundVariables) && Object.keys(e.boundVariables).length > 0) || ![e.offset.x, e.offset.y, e.radius, e.spread ?? 0, e.color.r, e.color.g, e.color.b, e.color.a].every((n) => typeof n === 'number'))
      return { unresolved: 'native-effect-outside-the-compared-form' };
    layers.push({ inner: e.type === 'INNER_SHADOW', x: e.offset.x, y: e.offset.y, blur: e.radius, spread: e.spread ?? 0, rgba8: [e.color.r, e.color.g, e.color.b, e.color.a].map(toByte) as Rgba8 });
  }
  return { layers };
}

/**
 * The padding-box background plane, recognised by GEOMETRY ONLY — the same
 * conditions core/native-source-observation.ts holds a `backgroundPaint` shape
 * to (first child, absolute, stretch constraints, inset by the uniform stroke
 * weight, inner radius = radius - inset).
 */
export function nativeBackgroundPlane(root: NativeNode, nodes: Map<string, NativeNode>): NativeNode | null {
  const plane = nodes.get(root.childIds?.[0] ?? ''), v = root.values;
  if (!plane || plane.type !== 'RECTANGLE' || plane.values.layoutPositioning !== 'ABSOLUTE') return null;
  const c = plane.values.constraints;
  if (!object(c) || c.horizontal !== 'STRETCH' || c.vertical !== 'STRETCH') return null;
  const weights = [v.strokeTopWeight, v.strokeRightWeight, v.strokeBottomWeight, v.strokeLeftWeight], inset = weights[0];
  if (typeof inset !== 'number' || !weights.every((w) => w === inset) || typeof v.cornerRadius !== 'number') return null;
  const p = plane.values;
  return numericEqual(p.x, inset) && numericEqual(p.y, inset) && numericEqual(p.width, Math.max(0.01, v.width - 2 * inset)) && numericEqual(p.height, Math.max(0.01, v.height - 2 * inset)) &&
    numericEqual(p.cornerRadius, Math.max(0, v.cornerRadius - inset)) ? plane : null;
}

export interface NativePlanSpec { fixedWidth?: { px: number }; fixedHeight?: { px: number }; lits?: { width?: number; height?: number } }

export function nativeRootFacts(root: NativeNode, nodes: Map<string, NativeNode>, variables: Map<string, NativeVariable>, spec: NativePlanSpec): NativeRootFacts {
  const v = root.values;
  const dimension = (channel: 'width' | 'height'): NativeDimension => {
    const fixed = channel === 'width' ? spec.fixedWidth : spec.fixedHeight, lit = spec.lits?.[channel];
    return {
      px: nativeNum(v[channel]),
      sizing: typeof v[channel === 'width' ? 'layoutSizingHorizontal' : 'layoutSizingVertical'] === 'string' ? v[channel === 'width' ? 'layoutSizingHorizontal' : 'layoutSizingVertical'] : null,
      planDeclared: fixed && typeof fixed.px === 'number' ? { field: channel === 'width' ? 'fixedWidth' : 'fixedHeight', px: fixed.px } : typeof lit === 'number' ? { field: `lits.${channel}`, px: lit } : null,
    };
  };
  const cap = (s: string) => s[0]!.toUpperCase() + s.slice(1);
  const inside = v.strokeAlign === 'INSIDE';
  const descendants = (id: string, seen = new Set<string>()): NativeNode[] => {
    if (seen.has(id)) return [];
    seen.add(id);
    return (nodes.get(id)?.childIds ?? []).flatMap((child) => (nodes.has(child) ? [nodes.get(child)!, ...descendants(child, seen)] : []));
  };
  const plane = nativeBackgroundPlane(root, nodes), below = descendants(root.id).filter((n) => n !== plane);
  const slots = below.filter((n) => n.type === 'SLOT');
  const content: NativeRootFacts['content'] = below.some((n) => n.type !== 'SLOT') ? 'has-content' : slots.length > 0 ? 'empty-slot' : 'no-slot';

  const own = nativePaint(v.fills, root, variables);
  let background: NativeRootFacts['background'];
  if (!plane) background = { ...own, ...(own.kind !== 'unresolved' ? { carrier: 'root-fills' as const } : {}) };
  else if (own.kind !== 'none') background = { kind: 'unresolved', reason: 'native-background-has-several-carriers' };
  else if (plane.values.visible === false) background = { kind: 'none', carrier: 'padding-box-plane', nodeId: plane.id };
  else if (plane.values.opacity !== 1) background = { kind: 'unresolved', reason: 'native-background-plane-layer-opacity-not-1' };
  else {
    const paint = nativePaint(plane.values.fills, plane, variables);
    background = { ...paint, ...(paint.kind !== 'unresolved' ? { carrier: 'padding-box-plane' as const, nodeId: plane.id } : {}) };
  }
  return {
    layoutMode: typeof v.layoutMode === 'string' ? v.layoutMode : null, strokeAlign: typeof v.strokeAlign === 'string' ? v.strokeAlign : null, content,
    width: dimension('width'), height: dimension('height'),
    padding: Object.fromEntries(SIDES.map((s) => [s, nativeNum(v[`padding${cap(s)}`])])) as Record<Side, Num>,
    borderWidth: Object.fromEntries(SIDES.map((s) => [s, inside ? nativeNum(v[`stroke${cap(s)}Weight`]) : { unresolved: 'native-stroke-align-not-inside' }])) as Record<Side, Num>,
    radius: Object.fromEntries(CORNERS.map((c) => { const [a, b] = c.split('-'); return [c, nativeNum(v[`${a}${cap(b!)}Radius`])]; })) as Record<Corner, Num>,
    background, borderPaint: nativePaint(v.strokes, root, variables), opacity: nativeNum(v.opacity),
    gap: { px: v.layoutMode === 'HORIZONTAL' || v.layoutMode === 'VERTICAL' ? nativeNum(v.itemSpacing) : { unresolved: 'native-not-an-auto-layout-stack' } },
    shadow: nativeShadow(v.effects),
  };
}

// ---------------------------------------------------------------------------
// comparison
// ---------------------------------------------------------------------------
const showNum = (n: Num): string => (isUnresolved(n) ? `unresolved(${n.unresolved}${n.raw !== undefined ? `: ${n.raw}` : ''})` : String(n));
const showPaint = (p: Paint): string => (p.kind === 'none' ? 'none' : p.kind === 'unresolved' ? `unresolved(${p.reason})` : `#${p.rgba8.map((b) => b.toString(16).padStart(2, '0')).join('')}`);
const showShadow = (s: ShadowStack): string => (isUnresolved(s) ? `unresolved(${s.unresolved})` : s.layers.length === 0 ? 'none' : s.layers.map((l) => `${l.inner ? 'inset ' : ''}${l.x} ${l.y} ${l.blur} ${l.spread} #${l.rgba8.map((b) => b.toString(16).padStart(2, '0')).join('')}`).join(', '));

const sourceReason = (u: Unresolved): string => (u.unresolved.startsWith('source-') ? u.unresolved : `source-${u.unresolved}`);
function compareNum(kind: FactKind, source: Num, native: Num): FactVerdict {
  const row = { kind, source: showNum(source), native: showNum(native) };
  if (isUnresolved(source)) return { ...row, verdict: `not-comparable:${sourceReason(source)}` };
  if (isUnresolved(native)) return { ...row, verdict: `not-comparable:${native.unresolved}` };
  return { ...row, verdict: numericEqual(native, source) ? 'match' : 'mismatch' };
}

export function paintsEqual(a: Paint, b: Paint): boolean | null {
  if (a.kind === 'unresolved' || b.kind === 'unresolved') return null;
  const alpha = (p: Paint) => (p.kind === 'solid' ? p.rgba8[3] : 0);
  if (alpha(a) === 0 && alpha(b) === 0) return true; // nothing is painted on either side
  return a.kind === 'solid' && b.kind === 'solid' && a.rgba8.every((c, i) => c === b.rgba8[i]);
}
function comparePaint(kind: FactKind, source: Paint, native: Paint, evidence?: string): FactVerdict {
  const row = { kind, source: showPaint(source), native: showPaint(native), ...(evidence ? { evidence } : {}) };
  if (source.kind === 'unresolved') return { ...row, verdict: `not-comparable:${source.reason}` };
  if (native.kind === 'unresolved') return { ...row, verdict: `not-comparable:${native.reason}` };
  return { ...row, verdict: paintsEqual(source, native) ? 'match' : 'mismatch' };
}

function compareDimension(kind: 'width' | 'height', s: SourceRootFacts, n: NativeRootFacts): FactVerdict {
  const source = s[kind], native = n[kind];
  const planFixed = native.planDeclared !== null, canvasFixed = native.sizing === 'FIXED';
  const evidence = `source ${kind} origin ${source.origin}${source.authoredValue !== undefined ? ` (${source.authoredValue}${source.selectors?.length ? ` from ${source.selectors.join(' ')}` : ''})` : ''}${source.reason ? ` [${source.reason}]` : ''}; native sizing ${native.sizing ?? 'not read back'}, plan ${native.planDeclared ? `${native.planDeclared.field} ${native.planDeclared.px}` : 'declares no fixed size'}; native content ${n.content}`;
  const row = { kind, source: showNum(source.px), native: showNum(native.px), evidence } as const;
  if (planFixed !== canvasFixed) return { ...row, verdict: 'not-comparable:native-sizing-evidence-disagrees' };
  if (isUnresolved(source.px)) return { ...row, verdict: `not-comparable:${sourceReason(source.px)}` };
  if (isUnresolved(native.px)) return { ...row, verdict: `not-comparable:${native.px.unresolved}` };
  if (s.boxSizing !== 'border-box') return { ...row, verdict: 'not-comparable:source-box-sizing-not-border-box' };
  if (source.origin === 'unresolved' || source.origin === 'not-recorded') return { ...row, verdict: `not-comparable:source-${kind}-origin-${source.origin}` };
  if (native.sizing === 'FILL') return { ...row, verdict: `not-comparable:native-${kind}-fills-its-container` };
  if (source.origin === 'auto' && !canvasFixed) return { ...row, verdict: `not-comparable:content-derived-${kind}${n.content === 'empty-slot' ? '-empty-slot' : ''}` };
  // declared on at least one side: both must declare it, and declare the same number
  if (source.origin === 'fixed' && canvasFixed) return { ...row, verdict: numericEqual(native.px, source.px) ? 'match' : 'mismatch' };
  return { ...row, verdict: 'mismatch' };
}

function compareGap(s: SourceRootFacts, n: NativeRootFacts): FactVerdict {
  const base = compareNum('gap', s.gap.px, n.gap.px);
  const evidence = `source ${s.gap.channel ?? 'no gap channel'}${s.gap.lowering ? ` lowered by ${s.gap.lowering}` : ''}; native layoutMode ${n.layoutMode ?? 'none'}`;
  if (base.verdict.startsWith('not-comparable')) return { ...base, evidence };
  const sourceAxis = s.gap.channel === 'column-gap' ? 'HORIZONTAL' : 'VERTICAL';
  return sourceAxis === n.layoutMode ? { ...base, evidence } : { ...base, verdict: 'not-comparable:layout-axis-differs', evidence };
}

function compareShadow(source: ShadowStack, native: ShadowStack): FactVerdict {
  const row = { kind: 'shadow' as const, source: showShadow(source), native: showShadow(native) };
  if (isUnresolved(source)) return { ...row, verdict: `not-comparable:${source.unresolved}` };
  if (isUnresolved(native)) return { ...row, verdict: `not-comparable:${native.unresolved}` };
  const same = source.layers.length === native.layers.length && source.layers.every((l, i) => {
    const m = native.layers[i]!;
    return l.inner === m.inner && numericEqual(m.x, l.x) && numericEqual(m.y, l.y) && numericEqual(m.blur, l.blur) && numericEqual(m.spread, l.spread) && l.rgba8.every((c, j) => c === m.rgba8[j]);
  });
  return { ...row, verdict: same ? 'match' : 'mismatch' };
}

/** Every fact kind, in FACT_KINDS order: nothing is skipped. */
export function compareRootFacts(source: SourceRootFacts, native: NativeRootFacts): FactVerdict[] {
  const borderless = SIDES.every((s) => source.borderWidth[s] === 0 && native.borderWidth[s] === 0);
  const out: FactVerdict[] = [
    compareDimension('width', source, native), compareDimension('height', source, native),
    ...SIDES.map((s) => compareNum(`padding-${s}`, source.padding[s], native.padding[s])),
    ...SIDES.map((s) => compareNum(`border-width-${s}`, source.borderWidth[s], native.borderWidth[s])),
    ...CORNERS.map((c) => compareNum(`radius-${c}`, source.radius[c], native.radius[c])),
    comparePaint('background', source.background, native.background, `source background-clip ${source.backgroundClip ?? 'not recorded'}; native carrier ${native.background.kind === 'unresolved' ? 'unresolved' : (native.background.carrier ?? 'none')}`),
    borderless ? { kind: 'border-paint', verdict: 'not-comparable:no-border-on-either-side', source: showPaint(source.borderPaint), native: showPaint(native.borderPaint) } : comparePaint('border-paint', source.borderPaint, native.borderPaint),
    compareNum('opacity', source.opacity, native.opacity),
    compareGap(source, native), compareShadow(source.shadow, native.shadow),
  ];
  // equal colours over a different painted region are not called a match: the clip must be carried too
  const bg = out.find((f) => f.kind === 'background')!;
  if (bg.verdict === 'match' && source.background.kind === 'solid' && source.background.rgba8[3] !== 0 && native.background.kind === 'solid') {
    const wanted = source.backgroundClip === 'padding-box' ? 'padding-box-plane' : source.backgroundClip === 'border-box' ? 'root-fills' : null;
    if (wanted === null) bg.verdict = 'not-comparable:source-background-clip-outside-the-compared-form';
    else if (native.background.carrier !== wanted && !borderless) bg.verdict = 'not-comparable:background-clip-carrier-differs';
  }
  return out;
}

// ---------------------------------------------------------------------------
// (c) the join — data only
// ---------------------------------------------------------------------------
export interface JoinAxis { property: string; figmaProperty: string; default: string | null; values: Array<{ value: string; label: string; code: unknown }> }
export type Change = { kind: 'set'; value: unknown } | { kind: 'omit' };

/** The plan's code-value axes: which variant value carries which source property value. */
export function joinAxesOfPlan(component: { codeValueAxes?: { axes?: Array<Record<string, any>> }; propNames?: Record<string, string> }): JoinAxis[] {
  const axes = component.codeValueAxes?.axes;
  if (!Array.isArray(axes) || axes.length === 0) throw Error('root-geometry-join-axes-missing');
  return axes.map((a) => ({
    property: String(a.codeProp ?? a.property), figmaProperty: String(component.propNames?.[a.property] ?? a.propName ?? a.property), default: typeof a.default === 'string' ? a.default : null,
    values: (a.values as Array<Record<string, unknown>>).map((v) => ({ value: String(v.value), label: String(v.label ?? v.value), code: v.code })),
  }));
}

/** A source row's property changes -> the variant value per axis. An OMITTED prop takes the axis default, exactly as the root-matrix assembler maps it. */
export function assignmentOf(axes: JoinAxis[], changes: Record<string, Change>): { assignment: Record<string, string>; omitted: string[] } {
  const assignment: Record<string, string> = {}, omitted: string[] = [];
  if (Object.keys(changes).sort().join() !== axes.map((a) => a.property).sort().join()) throw Error('root-geometry-join-properties-differ');
  for (const axis of axes) {
    const change = changes[axis.property]!;
    if (change.kind === 'omit') {
      if (axis.default === null) throw Error(`root-geometry-join-omitted-without-default:${axis.property}`);
      omitted.push(axis.property);
      assignment[axis.property] = axis.default;
      continue;
    }
    const hits = axis.values.filter((v) => Object.is(v.code, change.value));
    if (hits.length !== 1) throw Error(`root-geometry-join-value-unmapped:${axis.property}=${String(change.value)}`);
    assignment[axis.property] = hits[0]!.value;
  }
  return { assignment, omitted };
}

export const variantPropertiesOf = (axes: JoinAxis[], assignment: Record<string, string>): Record<string, string> =>
  Object.fromEntries(axes.map((a) => [a.figmaProperty, a.values.find((v) => v.value === assignment[a.property])?.label ?? '']));
const keyOf = (record: Record<string, string>): string => JSON.stringify(Object.entries(record).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));

export interface JoinedRow { sourceRow: string; changes: Record<string, Change>; assignment: Record<string, string>; nativeNodeId: string; nativeVariantProperties: Record<string, string> }
export interface CollapsedRow { sourceRow: string; changes: Record<string, Change>; omitted: string[]; assignment: Record<string, string>; canonicalRow: string; treeSha256: string; canonicalTreeSha256: string }

/**
 * A row that SETS every axis is the canonical observation of one variant. A row
 * that OMITS a prop has no variant of its own: the contract maps the omission
 * to the prop's default, so it collapses onto the explicit-default row — and
 * must carry that row's tree hash to prove the two renders are the same tree.
 */
export function joinSourceRowsToNativeMains(axes: JoinAxis[], rows: Array<{ id: string; changes: Record<string, Change>; treeSha256: string }>, mains: Array<{ id: string; variantProperties?: Record<string, string> }>): { joined: JoinedRow[]; collapsed: CollapsedRow[] } {
  const canonical = new Map<string, (typeof rows)[number] & { assignment: Record<string, string> }>(), pending: Array<(typeof rows)[number] & ReturnType<typeof assignmentOf>> = [];
  for (const row of rows) {
    const mapped = assignmentOf(axes, row.changes);
    if (mapped.omitted.length > 0) { pending.push({ ...row, ...mapped }); continue; }
    const key = keyOf(mapped.assignment);
    if (canonical.has(key)) throw Error(`root-geometry-join-ambiguous:rows ${canonical.get(key)!.id} and ${row.id}`);
    canonical.set(key, { ...row, assignment: mapped.assignment });
  }
  const claimed = new Set<string>(), joined: JoinedRow[] = [];
  for (const main of mains) {
    const hits = [...canonical.values()].filter((row) => keyOf(variantPropertiesOf(axes, row.assignment)) === keyOf(main.variantProperties ?? {}));
    if (hits.length !== 1) throw Error(`root-geometry-native-variant-without-source-row:${main.id}`);
    if (claimed.has(hits[0]!.id)) throw Error(`root-geometry-join-ambiguous:row ${hits[0]!.id} matches two native mains`);
    claimed.add(hits[0]!.id);
    joined.push({ sourceRow: hits[0]!.id, changes: hits[0]!.changes, assignment: hits[0]!.assignment, nativeNodeId: main.id, nativeVariantProperties: { ...main.variantProperties } });
  }
  for (const row of canonical.values()) if (!claimed.has(row.id)) throw Error(`root-geometry-source-row-without-native-variant:${row.id}`);
  const collapsed = pending.map((row) => {
    const target = canonical.get(keyOf(row.assignment));
    if (!target) throw Error(`root-geometry-collapse-target-missing:${row.id}`);
    if (target.treeSha256 !== row.treeSha256) throw Error(`root-geometry-collapse-unproven:row ${row.id} does not render the tree of row ${target.id}`);
    return { sourceRow: row.id, changes: row.changes, omitted: row.omitted, assignment: row.assignment, canonicalRow: target.id, treeSha256: row.treeSha256, canonicalTreeSha256: target.treeSha256 };
  });
  return { joined, collapsed };
}
