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
  minWidth: 'min-width',
  opacity: 'opacity',
};

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
  if (spec.dropShadow) {
    // dump v1.2 single DROP_SHADOW — the same value the CSS surfaces render.
    const sh = spec.dropShadow;
    ctx.used.add('shadow');
    d.push(
      `box-shadow: ${sh.x}px ${sh.y}px ${sh.radius}px${sh.spread ? ` ${sh.spread}px` : ''} ${sh.color}`,
    );
  }
  if (spec.stroke) {
    d.push(`border-color: ${cssVarOf(spec.stroke)}`, 'border-style: solid');
    if (!spec.bindings?.strokeWeight) d.push('border-width: 1px');
  }
  for (const [field, varName] of Object.entries(spec.bindings ?? {})) {
    const cssProp = BINDING_CSS[field];
    if (cssProp) d.push(`${cssProp}: ${cssVarOf(varName)}`);
  }
  if (spec.fixedWidth) d.push(`width: ${cssVarWithFallback(spec.fixedWidth.varName, spec.fixedWidth.px)}`);
  if (spec.fixedHeight) d.push(`height: ${cssVarWithFallback(spec.fixedHeight.varName, spec.fixedHeight.px)}`);
  if (spec.grow) d.push('flex: 1 1 auto', 'min-width: 0');
  if (spec.pct !== undefined) {
    ctx.used.add('meter');
    d.push(`width: ${Math.round(spec.pct * 1000) / 10}%`, 'align-self: stretch');
  }
  if (spec.overlay) {
    ctx.used.add('overlay');
    d.push('position: absolute', OVERLAY_CSS[spec.overlay.placement].replace(/;$/, ''));
  }
  return d.join('; ');
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
    const style = ['display: inline-flex', 'flex-shrink: 0', extraStyle].filter(Boolean).join('; ');
    return `<span style="${style}">${spec.svg ?? ''}</span>`;
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

  // root / frame
  const hasOverlayChild = (spec.children ?? []).some((c) => c.overlay || c.absolute);
  const style = [
    nodeStyle(spec, ctx),
    hasOverlayChild ? 'position: relative' : '',
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
      'icon color — SVG paint is not variable-bindable on import, so glyph color is baked to the variant’s resolved foreground literal.',
    );
  }
  if ((data.stateVariants ?? []).length > 0) {
    notes.push(
      'State axis — canvas-only interaction previews; the focus outline renders as a bound stroke (outline sits outside the border box on the web — approximation, documented).',
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
    // createFigmaEngine requires a "default" brand mode; a pasted user tree
    // (or a minted-only layer) has none — an empty default brand keeps the
    // engine's resolution semantics without inventing values.
    const brands = Object.keys(source.tree.brands).length > 0 ? source.tree.brands : { default: {} };
    const engine: FigmaEngine = createFigmaEngine({ tokens: { ...source.tree, brands }, icons });

    const byId = new Map(contracts);
    byId.set(contract.id, contract);
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

    const notes = fidelityNotes(contract, data, ctx.used);
    const stylesheets = source.stylesheets;
    return {
      ok: true,
      notes,
      doc: [
        '<!doctype html>',
        '<html>', // no data-theme, ever: the canvas is ALWAYS light, like Figma
        '<head><meta charset="utf-8">',
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
