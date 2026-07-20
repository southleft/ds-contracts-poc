/**
 * Canvas preview — the DESIGN side of the contract, rendered as HTML.
 *
 * The figma engine's PURE compile step (core/emit-figma-script.ts →
 * createFigmaEngine().compileComponentData — the exact data emitFigmaScript
 * serializes into the sync script) produces VARIANTS / STATE_VARIANTS node
 * specs; this module renders those specs as a Figma-canvas-styled document:
 * a light canvas surface (ALWAYS light, like Figma, regardless of app
 * theme), the purple component-set frame with the set name, variant cells in
 * the same row/column grid the sync script lays out, auto-layout as flexbox,
 * and every fill/stroke/radius/padding resolved from its bound variable name
 * through the ACTIVE token source's stylesheets (minted imported.* layer
 * included — slash names and CSS custom properties share the same segments).
 *
 * Deterministic by construction: no AI anywhere — the code preview and this
 * canvas preview are compiled from the same contract by the same core.
 * Everything HTML cannot mimic exactly is a NAMED fidelity note (footer).
 */
import type { Contract } from '../../../core/index.js';
// NodeSpec/VariantSpec are the compile step's internal spec shapes — imported
// from the engine module itself (the barrel exports the engine + ComponentData).
import {
  createFigmaEngine,
  type ComponentData,
  type NodeSpec,
  type VariantSpec,
} from '../../../core/emit-figma-script.js';

type FigmaEngine = ReturnType<typeof createFigmaEngine>;
import { polygonClipPath } from '../../../scripts/contract-schema.js';
import { icons } from './data.js';
import { applyLinkedScope, linkedImportScope } from './linked-scope.js';
import { sessionImportCss } from './preview.js';
import { sessionRegistry } from './session-registry.js';
import { activeTokens } from './token-source.js';

export type CanvasPreviewResult =
  | { ok: true; doc: string; notes: string[] }
  | { ok: false; error: string };

// ---------------------------------------------------------------------------
// Variable name → CSS custom property (same segments, '/' vs '-')
// ---------------------------------------------------------------------------

const cssVarOf = (figmaVarName: string) => `var(--${figmaVarName.split('/').join('-')})`;
const cssVarWithFallback = (figmaVarName: string, px: number) =>
  `var(--${figmaVarName.split('/').join('-')}, ${px}px)`;

const escapeHtml = (s: string) =>
  s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');

const FONT_WEIGHT_BY_STYLE: Record<string, number> = {
  Thin: 100,
  'Extra Light': 200,
  Light: 300,
  Regular: 400,
  Medium: 500,
  'Semi Bold': 600,
  Bold: 700,
  'Extra Bold': 800,
  Black: 900,
};

/** Figma binding field → CSS declaration. */
const BINDING_CSS: Record<string, string> = {
  paddingLeft: 'padding-left',
  paddingRight: 'padding-right',
  paddingTop: 'padding-top',
  paddingBottom: 'padding-bottom',
  itemSpacing: 'gap',
  topLeftRadius: 'border-top-left-radius',
  topRightRadius: 'border-top-right-radius',
  bottomLeftRadius: 'border-bottom-left-radius',
  bottomRightRadius: 'border-bottom-right-radius',
  strokeWeight: 'border-width',
  // Round 5 (canvas-gate finding): per-side stroke weights (v15 matrix a.5)
  // bind natively in the sync runtime (setBoundVariable) but this renderer
  // had no CSS mapping — a Button whose four side weights bind size-0 drew
  // the 1px default ring instead of no ring at all.
  strokeTopWeight: 'border-top-width',
  strokeRightWeight: 'border-right-width',
  strokeBottomWeight: 'border-bottom-width',
  strokeLeftWeight: 'border-left-width',
  minWidth: 'min-width',
  // Round 5: min-height binds (the floor Button's sub-768 sizing fact).
  minHeight: 'min-height',
  opacity: 'opacity',
};

/** True when the spec carries ANY stroke-width source of its own (a bound
 *  strokeWeight, a bound per-side weight, or a literal weight). Only a spec
 *  with NO width source gets the renderer's 1px default — mirroring the sync
 *  runtime, where a bound side weight always applies (Round 5 canvas-gate
 *  finding: the 1px default overrode bound size-0 side weights). */
const hasStrokeWidthSource = (spec: NodeSpec): boolean =>
  spec.bindings?.strokeWeight !== undefined ||
  spec.bindings?.strokeTopWeight !== undefined ||
  spec.bindings?.strokeRightWeight !== undefined ||
  spec.bindings?.strokeBottomWeight !== undefined ||
  spec.bindings?.strokeLeftWeight !== undefined ||
  spec.lits?.strokeWeight !== undefined ||
  spec.lits?.strokeSides !== undefined;

/** Round 5d: stroke CSS. Outline-lowered strokes (spec.strokeOutside — the
 *  focus-preview outline channels) render as a CSS OUTLINE: outlines sit
 *  OUTSIDE the border box and paint over children, and the sync runtime
 *  aligns those strokes OUTSIDE for the same geometry (the Banner focus
 *  ring's top arc was covered by the opaque tone ribbon under the old
 *  inside-border approximation). Plain strokes stay inside borders. */
function strokeCss(spec: NodeSpec): string[] {
  const d: string[] = [];
  if (!spec.stroke) return d;
  if (spec.strokeOutside) {
    d.push(`outline-color: ${cssVarOf(spec.stroke)}`, 'outline-style: solid');
    if (!hasStrokeWidthSource(spec)) d.push('outline-width: 1px');
  } else {
    d.push(`border-color: ${cssVarOf(spec.stroke)}`, 'border-style: solid');
    if (!hasStrokeWidthSource(spec)) d.push('border-width: 1px');
  }
  return d;
}

/** Bound-variable fields → CSS. Round 5d: a strokeWeight binding on an
 *  outline-lowered stroke renders as outline-width, not border-width. */
function bindingCss(spec: NodeSpec): string[] {
  const d: string[] = [];
  for (const [field, varName] of Object.entries(spec.bindings ?? {})) {
    if (field === 'strokeWeight' && spec.strokeOutside) {
      d.push(`outline-width: ${cssVarOf(varName)}`);
      continue;
    }
    const cssProp = BINDING_CSS[field];
    if (cssProp) d.push(`${cssProp}: ${cssVarOf(varName)}`);
  }
  return d;
}

/** Effect stack / single drop shadow → the equivalent CSS box-shadow list —
 *  the runtime applies these as NATIVE effects on frames AND shapes; the
 *  preview draws the same values (Round 5: shapes lost their inset rings —
 *  the Checkbox/RadioButton control edge — because only nodeStyle had this
 *  branch). */
function effectCss(spec: NodeSpec, ctx: RenderCtx): string[] {
  const d: string[] = [];
  if (spec.effectStack && spec.effectStack.length > 0) {
    ctx.used.add('shadow');
    const css = spec.effectStack
      .map((e) => {
        const c = e.color;
        const a = c.a === undefined ? 1 : c.a;
        const col = `rgba(${Math.round(c.r * 255)}, ${Math.round(c.g * 255)}, ${Math.round(c.b * 255)}, ${a})`;
        return `${e.inner ? 'inset ' : ''}${e.x}px ${e.y}px ${e.radius}px${e.spread ? ` ${e.spread}px` : ''} ${col}`;
      })
      .join(', ');
    d.push(`box-shadow: ${css}`);
  }
  if (spec.dropShadow) {
    const sh = spec.dropShadow;
    ctx.used.add('shadow');
    d.push(`box-shadow: ${sh.x}px ${sh.y}px ${sh.radius}px${sh.spread ? ` ${sh.spread}px` : ''} ${sh.color}`);
  }
  return d;
}

const PRIMARY_CSS: Record<string, string> = {
  MIN: 'flex-start',
  CENTER: 'center',
  MAX: 'flex-end',
  SPACE_BETWEEN: 'space-between',
};
const COUNTER_CSS: Record<string, string> = { MIN: 'flex-start', CENTER: 'center', MAX: 'flex-end' };

const OVERLAY_CSS: Record<string, string> = {
  top: 'bottom: 100%; left: 0;',
  bottom: 'top: 100%; left: 0;',
  start: 'right: 100%; top: 0;',
  end: 'left: 100%; top: 0;',
};

// ---------------------------------------------------------------------------
// NodeSpec → HTML
// ---------------------------------------------------------------------------

/** Per-instance overrides flowing down from depProps (mapDepProps output):
 *  boolean values drive visibleProp nodes, string values drive contentProp
 *  text nodes. Variant-axis values are consumed by variant SELECTION. */
interface InstanceOverrides {
  bools: Record<string, boolean>;
  texts: Record<string, string>;
}

interface RenderCtx {
  /** compileComponentData per dependency, cached per build. */
  dataFor(name: string): ComponentData | null;
  /** Feature flags collected during the render — they drive which fidelity
   *  notes the footer shows (named, only when the feature is on screen). */
  used: Set<string>;
}

function nodeStyle(spec: NodeSpec, ctx: RenderCtx): string {
  const d: string[] = [];
  if (spec.layout) {
    d.push('display: flex');
    d.push(`flex-direction: ${spec.layout.mode === 'VERTICAL' ? 'column' : 'row'}`);
    d.push(`justify-content: ${PRIMARY_CSS[spec.layout.primary]}`);
    d.push(`align-items: ${spec.layout.stretchChildren ? 'stretch' : COUNTER_CSS[spec.layout.counter]}`);
  }
  if (spec.fill) d.push(`background-color: ${cssVarOf(spec.fill)}`);
  // Round 4 (canvas-gate finding): effect STACKS render — the runtime
  // applies them as native effects; this preview renders the equivalent
  // CSS box-shadow list (inset for INNER_SHADOW), like the code surfaces.
  d.push(...effectCss(spec, ctx));
  d.push(...strokeCss(spec));
  d.push(...bindingCss(spec));
  if (spec.fixedWidth) d.push(`width: ${cssVarWithFallback(spec.fixedWidth.varName, spec.fixedWidth.px)}`);
  if (spec.fixedHeight) d.push(`height: ${spec.fixedHeight.varName ? cssVarWithFallback(spec.fixedHeight.varName, spec.fixedHeight.px) : `${spec.fixedHeight.px}px`}`);
  if (spec.grow) d.push('flex: 1 1 auto', 'min-width: 0');
  if (spec.pct !== undefined) {
    ctx.used.add('meter');
    d.push(`width: ${Math.round(spec.pct * 1000) / 10}%`, 'align-self: stretch');
  }
  if (spec.overlay) {
    ctx.used.add('overlay');
    d.push('position: absolute', OVERLAY_CSS[spec.overlay.placement].replace(/;$/, ''));
  }
  if (spec.insetOverlay) {
    // B-3 finding 5 companion (Round 5 canvas-gate finding): the sync
    // runtime lowers inset overlay parts out of flow (applyInsetOverlay —
    // ABSOLUTE, stretched to the parent); this renderer flowed them as
    // auto-layout siblings, so the Checkbox glyph overlay drew BESIDE its
    // backdrop instead of over it. Plain CSS semantics: absolute + the
    // carried inset offsets (0 when none — the compiled default).
    ctx.used.add('overlay');
    const o = spec.insetOffsets ?? { top: 0, right: 0, bottom: 0, left: 0 };
    d.push('position: absolute', `top: ${o.top}px`, `right: ${o.right}px`, `bottom: ${o.bottom}px`, `left: ${o.left}px`);
  }
  // NODE opacity (dump v1.2 channel) — the runtime sets node.opacity after
  // construction; the canvas renders the same value or the row silently
  // loses its wash (field failure: Eventz disabled variants at opacity 0.4).
  if (typeof spec.opacity === 'number') d.push(`opacity: ${spec.opacity}`);
  if (spec.imgPlaceholder) ctx.used.add('img');
  d.push(...marginStyles(spec, ctx));
  // Round 5: a block-display root with no width channel fills its container
  // (CSS block truth — the ProgressBar track); auto-layout keeps hug sizing,
  // a named preview note.
  if (spec.blockRoot) d.push('width: 100%');
  d.push(...litStyles(spec));
  return d.join('; ');
}

/** Round 5: margin channels the floor-promoted contracts carry, compiled to
 *  literal px. CSS-true here; round 5d — the sync runtime now applies the
 *  same geometry (compile-time itemSpacing lowering for uniform sibling
 *  gaps, margin-box wrapper frames for the residual margins this renderer
 *  still receives). */
function marginStyles(spec: NodeSpec, ctx: RenderCtx): string[] {
  const m = spec.margins;
  if (!m) return [];
  ctx.used.add('margin');
  const d: string[] = [];
  if (m.top !== undefined) d.push(`margin-top: ${m.top}px`);
  if (m.right !== undefined) d.push(`margin-right: ${m.right}px`);
  if (m.bottom !== undefined) d.push(`margin-bottom: ${m.bottom}px`);
  if (m.left !== undefined) d.push(`margin-left: ${m.left}px`);
  return d;
}

/** v14 literals (spec.lits): the same literal-fidelity channels the sync
 *  runtime applies — rendered as plain CSS here. */
function litStyles(spec: NodeSpec): string[] {
  const li = spec.lits;
  if (!li) return [];
  const d: string[] = [];
  if (li.fillClear) d.push('background-color: transparent');
  else if (li.fillColor) {
    const c = li.fillColor;
    d.push(
      `background-color: rgba(${Math.round(c.r * 255)}, ${Math.round(c.g * 255)}, ${Math.round(c.b * 255)}, ${c.a ?? 1})`,
    );
  }
  if (li.width !== undefined) d.push(`width: ${li.width}px`);
  if (li.height !== undefined) d.push(`height: ${li.height}px`);
  if (li.minWidth !== undefined) d.push(`min-width: ${li.minWidth}px`);
  if (li.minHeight !== undefined) d.push(`min-height: ${li.minHeight}px`);
  if (li.paddingTop !== undefined) d.push(`padding-top: ${li.paddingTop}px`);
  if (li.paddingBottom !== undefined) d.push(`padding-bottom: ${li.paddingBottom}px`);
  if (li.paddingLeft !== undefined) d.push(`padding-left: ${li.paddingLeft}px`);
  if (li.paddingRight !== undefined) d.push(`padding-right: ${li.paddingRight}px`);
  if (li.itemSpacing !== undefined) d.push(`gap: ${li.itemSpacing}px`);
  if (li.radius !== undefined) d.push(`border-radius: ${li.radius}px`);
  if (li.strokeWeight !== undefined) d.push(`border-width: ${li.strokeWeight}px`, 'border-style: solid');
  // v15 per-corner radii / per-side widths (Round 5: the runtime applies
  // these in litsRuntime; the renderer silently dropped them).
  if (li.radiusCorners) {
    const rc = li.radiusCorners;
    if (rc.tl !== undefined) d.push(`border-top-left-radius: ${rc.tl}px`);
    if (rc.tr !== undefined) d.push(`border-top-right-radius: ${rc.tr}px`);
    if (rc.bl !== undefined) d.push(`border-bottom-left-radius: ${rc.bl}px`);
    if (rc.br !== undefined) d.push(`border-bottom-right-radius: ${rc.br}px`);
  }
  if (li.strokeSides) {
    const sw = li.strokeSides;
    d.push('border-style: solid');
    if (sw.top !== undefined) d.push(`border-top-width: ${sw.top}px`);
    if (sw.right !== undefined) d.push(`border-right-width: ${sw.right}px`);
    if (sw.bottom !== undefined) d.push(`border-bottom-width: ${sw.bottom}px`);
    if (sw.left !== undefined) d.push(`border-left-width: ${sw.left}px`);
  }
  return d;
}

/** True when the node renders in this instance (visibleWhen booleans render
 *  their bound property's value — the contract default, or the parent's
 *  depProps override, exactly like the canvas). */
function isVisible(spec: NodeSpec, overrides: InstanceOverrides): boolean {
  if (!spec.visibleProp) return true;
  const bound = overrides.bools[spec.visibleProp];
  return bound !== undefined ? bound : spec.visibleDefault === true;
}

const parseVariantName = (name: string): Record<string, string> => {
  const out: Record<string, string> = {};
  for (const seg of name.split(',')) {
    const eq = seg.indexOf('=');
    if (eq > 0) out[seg.slice(0, eq).trim()] = seg.slice(eq + 1).trim();
  }
  return out;
};

/** The dep variant whose name matches every VARIANT-axis value in depProps
 *  (TEXT/BOOLEAN props never appear in variant names and pass through). The
 *  first variant is the all-defaults combo — the fallback, like the canvas. */
function pickVariant(data: ComponentData, depProps: Record<string, string | boolean>): VariantSpec {
  const wanted = Object.entries(depProps).filter((e): e is [string, string] => typeof e[1] === 'string');
  return (
    data.variants.find((v) => {
      const axes = parseVariantName(v.name);
      return wanted.every(([k, val]) => axes[k] === undefined || axes[k] === val);
    }) ?? data.variants[0]
  );
}

function renderInstance(
  depName: string,
  depProps: Record<string, string | boolean>,
  ctx: RenderCtx,
  extraStyle = '',
): string {
  const data = ctx.dataFor(depName);
  if (!data || data.variants.length === 0) {
    return `<div class="cv-missing">instance of ${escapeHtml(depName)} — contract not found</div>`;
  }
  ctx.used.add('instance');
  const variant = pickVariant(data, depProps);
  const overrides: InstanceOverrides = { bools: {}, texts: {} };
  for (const [k, v] of Object.entries(depProps)) {
    if (typeof v === 'boolean') overrides.bools[k] = v;
    else overrides.texts[k] = v;
  }
  // TEXT-typed dep props land via contentProp; string VARIANT values were
  // already consumed by pickVariant and match no contentProp.
  return renderNode(variant.spec, ctx, overrides, extraStyle);
}

/** v9 shape decor: the SAME projection the code surfaces emit
 *  (scripts/contract-schema.ts shapeCssDecls), plus the compiled absolute
 *  placement (spec.absolute) — translate joins rotate in one transform. */
function shapeStyle(spec: NodeSpec, ctx: RenderCtx): string {
  const sh = spec.shape!;
  ctx.used.add('shape');
  const d = [`width: ${sh.width}px`, `height: ${sh.height}px`, 'flex-shrink: 0'];
  if (sh.kind === 'polygon') d.push(`clip-path: ${polygonClipPath(sh.sides ?? 3)}`);
  if (sh.kind === 'ellipse') d.push('border-radius: 50%');
  if (spec.fill) d.push(`background-color: ${cssVarOf(spec.fill)}`);
  // Shape specs carry stroke + bindings exactly like frames (the emitted
  // sync runtime's shape branch applies them too — the Phase B deviation-2
  // gap, fixed at the source on BOTH surfaces).
  d.push(...strokeCss(spec));
  // B-3 finding 3 companion (Round 5 canvas-gate finding): the sync runtime
  // applies dropShadow/effectStack on SHAPES too (shapeRuntime receives the
  // same effects tail as frames) — this renderer only had the frame branch,
  // so the Checkbox/RadioButton backdrop's inset control edge never drew.
  d.push(...effectCss(spec, ctx));
  d.push(...bindingCss(spec));
  d.push(...marginStyles(spec, ctx));
  d.push(...litStyles(spec));
  const transform: string[] = [];
  const a = spec.absolute;
  if (a) {
    d.push('position: absolute');
    if (a.h === 'CENTER') {
      d.push('left: 50%');
      transform.push('translateX(-50%)');
    } else if (a.h === 'MAX' && a.right !== undefined) d.push(`right: ${a.right}px`);
    else if (a.left !== undefined) d.push(`left: ${a.left}px`);
    if (a.v === 'CENTER') {
      d.push('top: 50%');
      transform.push('translateY(-50%)');
    } else if (a.v === 'MAX' && a.bottom !== undefined) d.push(`bottom: ${a.bottom}px`);
    else if (a.top !== undefined) d.push(`top: ${a.top}px`);
  }
  if (sh.rotation) transform.push(`rotate(${sh.rotation}deg)`);
  if (transform.length > 0) d.push(`transform: ${transform.join(' ')}`);
  return d.join('; ');
}

function renderNode(
  spec: NodeSpec,
  ctx: RenderCtx,
  overrides: InstanceOverrides,
  extraStyle = '',
): string {
  if (!isVisible(spec, overrides)) return '';

  if (spec.type === 'shape') {
    const style = [shapeStyle(spec, ctx), extraStyle].filter(Boolean).join('; ');
    return `<div style="${style}"></div>`;
  }

  if (spec.type === 'svg') {
    ctx.used.add('svg');
    const size = (spec as { iconSize?: number }).iconSize;
    const style = [
      'display: inline-flex',
      'flex-shrink: 0',
      ...(size ? [`width: ${size}px`, `height: ${size}px`] : []),
      extraStyle,
    ].filter(Boolean).join('; ');
    // size the inline svg itself: a viewBox-only svg otherwise renders at
    // the UA default (or 0 in shrink-to-fit contexts) — canvas-gate finding.
    const svgMarkup = size
      ? String(spec.svg ?? '').replace(/^<svg /, `<svg width="${size}" height="${size}" `)
      : (spec.svg ?? '');
    return `<span style="${style}">${svgMarkup}</span>`;
  }

  if (spec.type === 'text') {
    const d = [
      `font-size: ${spec.fontSize ?? 14}px`,
      `font-weight: ${FONT_WEIGHT_BY_STYLE[spec.fontStyle ?? 'Medium'] ?? 500}`,
      "font-family: Inter, system-ui, sans-serif",
      `line-height: ${typeof spec.lineHeight === 'number' ? `${spec.lineHeight}px` : '1.2'}`,
      'white-space: pre-wrap',
    ];
    ctx.used.add('font');
    if (spec.textFill) d.push(`color: ${cssVarOf(spec.textFill)}`);
    const text =
      spec.contentProp && overrides.texts[spec.contentProp] !== undefined
        ? overrides.texts[spec.contentProp]
        : (spec.characters ?? '');
    // Styled static text (page chips, dots, the Switch thumb): the sync
    // script wraps the text node in a frame carrying the fill / dimensions /
    // radius bindings (emit-figma-script buildNode) — and drops the text
    // node entirely when characters are empty. Mirror that wrap here or the
    // box styling silently vanishes (field failure: the Switch thumb — a
    // text:"" part with width/height/fill tokens — rendered as a height-0
    // transparent span; no thumb on the canvas).
    if (spec.fill || spec.fixedWidth || spec.fixedHeight || spec.bindings) {
      const box = [
        'display: inline-flex',
        'align-items: center',
        'justify-content: center',
        'flex-shrink: 0',
        nodeStyle(spec, ctx),
        extraStyle,
      ]
        .filter(Boolean)
        .join('; ');
      const inner = text === '' ? '' : `<span style="${d.join('; ')}">${escapeHtml(text)}</span>`;
      return `<div style="${box}">${inner}</div>`;
    }
    const style = [d.join('; '), extraStyle].filter(Boolean).join('; ');
    return `<span style="${style}">${escapeHtml(text)}</span>`;
  }

  if (spec.type === 'instance') {
    return renderInstance(spec.dep ?? '', spec.depProps ?? {}, ctx, extraStyle);
  }

  if (spec.type === 'slot') {
    ctx.used.add('slot');
    const style = [nodeStyle(spec, ctx), extraStyle].filter(Boolean).join('; ');
    const items = spec.slotDefault ?? [];
    const inner =
      items.length > 0
        ? items.map((item) => renderInstance(item.dep, item.props ?? {}, ctx)).join('')
        : `<span class="cv-slot__ph">◇ ${escapeHtml(spec.slotProperty ?? spec.name)} slot</span>`;
    return `<div class="cv-slot" style="${style}">${inner}</div>`;
  }

  // root / frame. An overlay child needs a positioned parent — but a parent
  // that is ITSELF an overlay is already positioned; appending 'relative'
  // would OVERRIDE its 'absolute' (CSS last-wins — Round 5 finding: the
  // Checkbox glyph host fell back into flow).
  const hasOverlayChild = (spec.children ?? []).some((c) => c.overlay || c.absolute || c.insetOverlay);
  const selfPositioned = spec.insetOverlay === true || spec.overlay !== undefined || spec.absolute !== undefined;
  const style = [
    nodeStyle(spec, ctx),
    hasOverlayChild && !selfPositioned ? 'position: relative' : '',
    extraStyle,
  ]
    .filter(Boolean)
    .join('; ');
  const inner = (spec.children ?? []).map((c) => renderNode(c, ctx, overrides)).join('');
  return `<div style="${style}">${inner}</div>`;
}

// ---------------------------------------------------------------------------
// State-axis merge — the sync script's withStateAxis, mirrored
// ---------------------------------------------------------------------------

const STATE_DEFAULT = 'Default';

function withStateAxis(data: ComponentData): VariantSpec[] {
  const stateVariants = data.stateVariants ?? [];
  if (stateVariants.length === 0) return data.variants;
  const base = data.variants.map((v) => {
    const name = v.name.includes('=') ? `${v.name}, State=${STATE_DEFAULT}` : `State=${STATE_DEFAULT}`;
    return { ...v, name, spec: { ...v.spec, name } };
  });
  return [...base, ...stateVariants];
}

// ---------------------------------------------------------------------------
// Fidelity notes — NAMED, shown only when the condition is on screen.
// Rendered OUTSIDE the document (the ⓘ popover on the Canvas cap), so the
// canvas itself stays what Figma shows: the set, nothing else.
// ---------------------------------------------------------------------------

function fidelityNotes(contract: Contract, data: ComponentData, used: Set<string>): string[] {
  const notes: string[] = [];
  if (used.has('font')) {
    notes.push(
      'font-family — text renders in Inter/system: font stacks are not canvas-representable (fontFamily is not variable-bindable); size and weight are the compiled values.',
    );
  }
  if (used.has('svg')) {
    notes.push(
      'icon color — SVG paint is not variable-bindable on import, so glyph color is baked to the variant’s resolved foreground literal; single-paint glyphs are re-bound to their contract variable by the sync runtime (round 5d).',
    );
  }
  if ((data.stateVariants ?? []).length > 0) {
    notes.push(
      'State axis — canvas-only interaction previews; the focus outline renders as an OUTSIDE-aligned bound stroke (round 5d — a CSS outline paints outside the border box, over children; outline-offset is not carried).',
    );
  }
  if ((contract.events ?? []).length > 0) {
    notes.push('events — code-only by declared fidelity limit; the canvas cannot run behavior.');
  }
  if (used.has('slot')) {
    notes.push(
      'slots — design-time default content (or the ◇ placeholder); instance-swap and multi-child slot behavior are canvas interactions HTML does not run.',
    );
  }
  if (used.has('meter')) {
    notes.push('meter fill — rendered at the contract defaults’ fraction, as the sync script lays it out.');
  }
  if (used.has('shape')) {
    notes.push(
      'shape decor — parametric vectors (polygon/ellipse) render as CSS clip-path boxes with the compiled rotation and exact captured placement; the sync script constructs REAL polygon/ellipse nodes.',
    );
  }
  if (used.has('overlay')) {
    notes.push('overlay parts — absolute placement mirrors the runtime’s constraints, not canvas pixel positions.');
  }
  if (used.has('margin')) {
    notes.push(
      'margin channels — drawn as CSS margins here; the sync runtime applies the same geometry natively (round 5d: uniform sibling gaps lower to itemSpacing at compile, residual margins become the child’s margin-box wrapper frame).',
    );
  }
  if (used.has('img')) {
    notes.push(
      'image parts — raster content is runtime data; the canvas draws the standard image-placeholder wash (#D9D9D9).',
    );
  }
  notes.push(
    'grid — variant cells sit in the same row/column grid the sync script lays out; auto-layout renders as CSS flexbox, not canvas geometry.',
  );
  return notes;
}

// ---------------------------------------------------------------------------
// The document
// ---------------------------------------------------------------------------

const CANVAS_CSS = `
  /* Figma boxes are border-box: a FIXED height/width includes padding and
     stroke. Without this, a bound height (48px) plus padding-block (8px)
     drew a 64px content-box cell — visibly taller than the captured Figma
     variant box (extract/figma/canvas-box-check.ts pins the parity). */
  *, *::before, *::after { box-sizing: border-box; }
  html { color-scheme: light; }
  body {
    margin: 0;
    padding: 20px;
    background: #ffffff;
    color: #1e1e1e;
    font-family: Inter, system-ui, sans-serif;
  }
  .cv-set {
    display: inline-block;
    min-width: min-content;
    border: 1px dashed #9747ff;
    border-radius: 5px;
    padding: 28px 20px 20px;
    position: relative;
    margin-top: 18px;
  }
  .cv-set__label {
    position: absolute;
    top: -18px;
    left: 0;
    color: #9747ff;
    font-size: 12px;
    display: inline-flex;
    align-items: center;
    gap: 5px;
  }
  .cv-set__label svg { flex-shrink: 0; }
  .cv-grid {
    display: grid;
    gap: 28px 40px;
    justify-items: start;
    align-items: start;
  }
  .cv-cell { display: flex; flex-direction: column; gap: 6px; align-items: flex-start; }
  .cv-name {
    font-size: 10.5px;
    color: #7b7b7b;
    font-family: ui-monospace, Menlo, monospace;
    max-width: 320px;
  }
  .cv-slot { min-width: 24px; min-height: 24px; }
  .cv-slot__ph {
    border: 1px dashed #b3b3b3;
    color: #7b7b7b;
    font-size: 11px;
    padding: 6px 10px;
    white-space: nowrap;
  }
  .cv-missing {
    border: 1px dashed #d33;
    color: #d33;
    font-size: 11px;
    padding: 6px 10px;
  }
`;

/** Figma's component-set diamond cluster, inline. */
const SET_GLYPH =
  '<svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">' +
  '<path d="M3 1 1 3l2 2 2-2-2-2Zm6 0L7 3l2 2 2-2-2-2ZM3 7 1 9l2 2 2-2-2-2Zm6 0L7 9l2 2 2-2-2-2Z" fill="#9747ff"/></svg>';

export function buildCanvasPreview(
  contract: Contract,
  contracts: Map<string, Contract>,
): CanvasPreviewResult {
  const source = activeTokens();
  try {
    const byId = new Map(contracts);
    byId.set(contract.id, contract);

    // LINKED-CHILD TOKEN SCOPE (linked-scope.ts): a linked contract imported
    // earlier resolves its own minted+captured layers through the ENGINE's
    // token tree — compileComponentData resolves typography/geometry
    // LITERALS there, where the CSS channel (sessionImportCss below) cannot
    // reach (field refusal: 'Cannot resolve token "imported.button-brand-
    // primary.button.font-size.large"' on the Dialog's linked action
    // button). The receipt lines join the fidelity notes.
    const scope = linkedImportScope(contract, byId, sessionRegistry().layersByContractId, source.inventory);
    const tree = applyLinkedScope(source.tree, scope);

    // createFigmaEngine requires a "default" brand mode; a pasted user tree
    // (or a minted-only layer) has none — an empty default brand keeps the
    // engine's resolution semantics without inventing values.
    const brands = Object.keys(tree.brands).length > 0 ? tree.brands : { default: {} };
    const engine: FigmaEngine = createFigmaEngine({ tokens: { ...tree, brands }, icons });
    const byName = new Map<string, Contract>([...byId.values()].map((c) => [c.name, c]));

    const cache = new Map<string, ComponentData | null>();
    const ctx: RenderCtx = {
      dataFor(name: string) {
        if (!cache.has(name)) {
          const dep = byName.get(name);
          cache.set(name, dep ? engine.compileComponentData(dep, byId) : null);
        }
        return cache.get(name)!;
      },
      used: new Set<string>(),
    };

    const data = engine.compileComponentData(contract, byId);
    const allVariants = withStateAxis(data);
    const noOverrides: InstanceOverrides = { bools: {}, texts: {} };

    const cells = allVariants
      .map((v) => {
        const html = renderNode(v.spec, ctx, noOverrides);
        return [
          `<div class="cv-cell" style="grid-row: ${v.row + 1}; grid-column: ${v.col + 1};">`,
          html,
          `<div class="cv-name">${escapeHtml(v.name)}</div>`,
          '</div>',
        ].join('');
      })
      .join('\n');

    // Cross-layer receipt lines FIRST — which linked contracts' import
    // layers this render resolves through — then the fidelity notes.
    const notes = [...scope.receipts, ...fidelityNotes(contract, data, ctx.used)];
    const stylesheets = source.stylesheets;
    return {
      ok: true,
      notes,
      doc: [
        '<!doctype html>',
        '<html>', // no data-theme, ever: the canvas is ALWAYS light, like Figma
        '<head><meta charset="utf-8">',
        // Session import layers (dump v1.5 linking): a LINKED child imported
        // earlier binds its own imported.* leaves and captured variables —
        // the active layer pair only carries the on-screen contract's (see
        // preview.ts sessionImportCss; the engine tree side is linked-scope).
        `<style>${sessionImportCss()}</style>`,
        `<style>${stylesheets.base}\n${stylesheets.brands}</style>`,
        `<style>${CANVAS_CSS}</style>`,
        '</head><body>',
        `<div class="cv-set" role="figure" aria-label="${escapeHtml(data.setName)} component set">`,
        `<div class="cv-set__label">${SET_GLYPH}${escapeHtml(data.setName)}</div>`,
        `<div class="cv-grid">${cells}</div>`,
        '</div>',
        '</body></html>',
      ].join('\n'),
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
