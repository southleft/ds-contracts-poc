/**
 * CANVAS SIDE — the playground canvas-preview renderer, vendored headless.
 *
 * The render logic (NodeSpec → HTML/CSS) is copied VERBATIM from
 * playground/src/engine/canvas-preview.ts (nodeStyle / litStyles /
 * shapeStyle / renderNode / pickVariant / withStateAxis semantics) minus the
 * playground session machinery (linked-scope, session import layers, token
 * source switching) — the Polaris gate resolves every var(--…) through ONE
 * committed stylesheet (World.tokenCss: engine px primitives + minted
 * layer), which is exactly what the playground does for the Polaris corpus.
 *
 * KNOWN RENDERER LIMITS mirrored on purpose (this harness measures the
 * canvas render AS THE PLAYGROUND DRAWS IT, defects included):
 *   · spec.gradient is NOT rendered (canvas-preview.ts has no branch; the
 *     sync runtime applies it natively — named where it changes a number).
 * Round 5: effectStack/dropShadow now render on frames AND shapes,
 * insetOverlay parts lower to absolute inset-0, and per-side stroke-weight
 * bindings map to CSS — kept in lockstep with canvas-preview.ts.
 */
import type { Contract } from '../../../core/index.js';
import type { ComponentData, NodeSpec } from '../../../core/emit-figma-script.js';
import { polygonClipPath } from '../../../scripts/contract-schema.js';
import type { Cell } from './compile.js';

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

interface InstanceOverrides {
  bools: Record<string, boolean>;
  texts: Record<string, string>;
}

interface RenderCtx {
  dataFor(name: string): ComponentData | null;
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
  if (spec.stroke) {
    d.push(`border-color: ${cssVarOf(spec.stroke)}`, 'border-style: solid');
    if (!hasStrokeWidthSource(spec)) d.push('border-width: 1px');
  }
  for (const [field, varName] of Object.entries(spec.bindings ?? {})) {
    const cssProp = BINDING_CSS[field];
    if (cssProp) d.push(`${cssProp}: ${cssVarOf(varName)}`);
  }
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
 *  literal px. CSS-true here; auto-layout has NO per-child margin field, so
 *  the sync runtime does not apply them — a named fidelity note. */
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

function pickVariant(data: ComponentData, depProps: Record<string, string | boolean>) {
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
  return renderNode(variant.spec, ctx, overrides, extraStyle);
}

function shapeStyle(spec: NodeSpec, ctx: RenderCtx): string {
  const sh = spec.shape!;
  ctx.used.add('shape');
  const d = [`width: ${sh.width}px`, `height: ${sh.height}px`, 'flex-shrink: 0'];
  if (sh.kind === 'polygon') d.push(`clip-path: ${polygonClipPath(sh.sides ?? 3)}`);
  if (sh.kind === 'ellipse') d.push('border-radius: 50%');
  if (spec.fill) d.push(`background-color: ${cssVarOf(spec.fill)}`);
  if (spec.stroke) {
    d.push(`border-color: ${cssVarOf(spec.stroke)}`, 'border-style: solid');
    if (!hasStrokeWidthSource(spec)) d.push('border-width: 1px');
  }
  // B-3 finding 3 companion (Round 5 canvas-gate finding): the sync runtime
  // applies dropShadow/effectStack on SHAPES too (shapeRuntime receives the
  // same effects tail as frames) — this renderer only had the frame branch,
  // so the Checkbox/RadioButton backdrop's inset control edge never drew.
  d.push(...effectCss(spec, ctx));
  for (const [field, varName] of Object.entries(spec.bindings ?? {})) {
    const cssProp = BINDING_CSS[field];
    if (cssProp) d.push(`${cssProp}: ${cssVarOf(varName)}`);
  }
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
      'font-family: Inter, system-ui, sans-serif',
      `line-height: ${typeof spec.lineHeight === 'number' ? `${spec.lineHeight}px` : '1.2'}`,
      'white-space: pre-wrap',
    ];
    ctx.used.add('font');
    if (spec.textFill) d.push(`color: ${cssVarOf(spec.textFill)}`);
    const text =
      spec.contentProp && overrides.texts[spec.contentProp] !== undefined
        ? overrides.texts[spec.contentProp]
        : (spec.characters ?? '');
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

  // An overlay child needs a positioned parent — but a parent that is ITSELF
  // an overlay is already positioned; appending 'relative' would OVERRIDE
  // its 'absolute' (CSS last-wins — Round 5 finding: the Checkbox glyph
  // host fell back into flow).
  const hasOverlayChild = (spec.children ?? []).some((c) => c.overlay || c.absolute || c.insetOverlay);
  const selfPositioned = spec.insetOverlay === true || spec.overlay !== undefined || spec.absolute !== undefined;
  const style = [nodeStyle(spec, ctx), hasOverlayChild && !selfPositioned ? 'position: relative' : '', extraStyle]
    .filter(Boolean)
    .join('; ');
  const inner = (spec.children ?? []).map((c) => renderNode(c, ctx, overrides)).join('');
  return `<div style="${style}">${inner}</div>`;
}

// ---------------------------------------------------------------------------
// The per-component gate document: every cell in a hugging, transparent stage
// ---------------------------------------------------------------------------

/** Mirrors the playground's canvas frame invariants (box-sizing border-box,
 *  always-light, Inter, WHITE canvas surface — translucent fills composite
 *  over white exactly as on the playground canvas and in a Figma file),
 *  plus frozen animations (visual-parity discipline). Both sides screenshot
 *  over the same white; the scorer trims near-white margins. */
const GATE_CSS = `
  *, *::before, *::after { box-sizing: border-box; }
  html { color-scheme: light; }
  body { margin: 0; padding: 24px; background: #ffffff; color: #1e1e1e;
         font-family: Inter, system-ui, sans-serif; }
  /* Cell separation MUST exceed the shot's clip margin (24px) or the
     previous cell's bottom edge bleeds into the next crop and survives the
     near-white trim (Round 5 finding: every non-first Banner cell carried a
     fragment of its neighbor, +24 CSS px of phantom height). */
  .gate-cell { display: flex; align-items: flex-start; width: max-content;
               margin: 0 0 64px 0; }
  .cv-slot { min-width: 24px; min-height: 24px; }
  .cv-slot__ph { border: 1px dashed #b3b3b3; color: #7b7b7b; font-size: 11px;
                 padding: 6px 10px; white-space: nowrap; }
  .cv-missing { border: 1px dashed #d33; color: #d33; font-size: 11px; padding: 6px 10px; }
  *, *::before, *::after { animation-play-state: paused !important; transition: none !important; }
`;

export function buildCanvasGateDoc(
  contract: Contract,
  cells: Cell[],
  tokenCss: string,
  dataFor: (name: string) => ComponentData | null,
  /** Global index of cells[0] — pages are CHUNKED below Chromium's 16384px
   *  capture ceiling; data-cell keys stay global. */
  startIndex = 0,
  /** Round 5 stage parity: the SAME definite container width the real side
   *  mounts (MOUNT_PLAN.stageWidth — ProgressBar's 288px floor stage). A
   *  block root (width:100%) resolves against it; hug components ignore it. */
  stageWidth?: number,
): { doc: string; used: Set<string> } {
  const ctx: RenderCtx = { dataFor, used: new Set<string>() };
  const noOverrides: InstanceOverrides = { bools: {}, texts: {} };
  const cellStyle = stageWidth ? ` style="width: ${stageWidth}px"` : '';
  const cellHtml = cells
    .map((cell, i) => `<div class="gate-cell" data-cell="${startIndex + i}"${cellStyle}>${renderNode(cell.spec, ctx, noOverrides)}</div>`)
    .join('\n');
  const doc = [
    '<!doctype html>',
    '<html>',
    '<head><meta charset="utf-8">',
    `<style>${tokenCss}</style>`,
    `<style>${GATE_CSS}</style>`,
    '</head><body>',
    cellHtml,
    '</body></html>',
  ].join('\n');
  return { doc, used: ctx.used };
}
