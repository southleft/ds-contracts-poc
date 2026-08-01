/**
 * CANVAS→CODE→CANVAS ROUND TRIP — the Untitled UI set, measured as a
 * set-level diff.  `npx tsx extract/figma/roundtrip-uui/run.ts [component…]`
 *
 * The claim under test, per component: a contract PROPOSED from the
 * hand-built Untitled UI canvas (examples/untitled-ui/storybook/contracts/*,
 * inverted from dumps-v2) — when emitted BACK through the engine's Figma
 * path and executed headlessly — reproduces the original set's structure,
 * and every divergence is named.
 *
 * ORIGINAL truth   = the committed canvas dumps (examples/untitled-ui/
 *                    dumps-v2/*.dump.json, dump v1.9 — the sets as drawn).
 * ROUND-TRIP truth = the plugin engine's Generate path (figma-sync/plugin/
 *                    engine/entry.ts createPluginEngine → planGenerate with
 *                    the bundle-shaped Untitled UI tokenSet + icon assets —
 *                    the exact designer-journey paste), executed in the
 *                    headless mock (scripts/plugin-engine-mock-figma.mjs,
 *                    the plugin-engine-check VM pattern).
 *
 * Both sides normalize to the SAME fact list — (variant, node path, channel,
 * value) — and diff four ways:
 *   MATCHED    value equal on both sides
 *   DIVERGED   both sides carry the channel, values differ (named each)
 *   LOSS       in the original only (the loss ledger, known-limit tagged)
 *   INVENTED   in the round trip only — the worst class; the gate is that
 *              every INVENTED fact is zero or NAMED below.
 *
 * NAMED NORMALIZATION EXCLUSIONS (facts deliberately not compared, so the
 * mock's own scope can't masquerade as engine fidelity):
 *   - width/height compare ONLY when both sides are hard-sized (dump bbox/
 *     abs/shape/fixedSize/FIXED sizing vs a FIXED round-trip axis): the
 *     mock's hug measurement is a text-length estimate, not pixels.
 *   - TEXT node boxes never compare (same reason).
 *   - instance INTERNALS stop at the instance on both sides (dump v1 never
 *     recurses instances); instancePrimaryFill stays original-only because
 *     the mock's createNodeFromSvg drops vector internals (vector-glyph
 *     campaign limit) — ledgered as LOSS, tagged, never silently equal.
 *   - imageFill / url() background-image channels ledger as LOSS tagged
 *     url-image — the emitter names these gradientMiss by design (EXPECTED).
 *
 * HONESTY GATE: each dump normalized and diffed against ITSELF must produce
 * zero divergences before any round-trip diff is trusted (self-check).
 *
 * Output: REPORT.md + report.json in this directory. No engine changes —
 * every refusal and divergence is a finding, recorded verbatim.
 */
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { createPluginEngine } from '../../../figma-sync/plugin/engine/entry.js';
import { parseTokenSet, type TokenSetPayload } from '../../../core/index.js';
import { createFigmaMock } from '../../../scripts/plugin-engine-mock-figma.mjs';
import type { MockNode } from '../../../scripts/plugin-engine-mock-figma.d.mts';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..', '..', '..');
const UUI = path.join(ROOT, 'examples', 'untitled-ui');
const CONTRACTS_DIR = path.join(UUI, 'storybook', 'contracts');
const DUMPS_DIR = path.join(UUI, 'dumps-v2');

/** The 15 hand-built component sets (one committed dump each). */
const COMPONENTS = [
  'avatar',
  'avatar-add-button',
  'avatar-group',
  'avatar-label-group',
  'badge-base',
  'button-base',
  'button-group-base',
  'dropdown-list-item',
  'input-field-base',
  'progress-bar',
  'progress-circle',
  'slider',
  'social-button',
  'toggle-base',
  'tooltip',
] as const;

// ---------------------------------------------------------------------------
// Known-limit classes (campaign ledger mapping) — every non-matched fact that
// falls in a named class carries its tag; everything else is untagged (a raw
// round-trip defect until someone names it).
// ---------------------------------------------------------------------------
type LimitTag =
  | 'interaction-states' // State=… variants the contract carries only as previews (or not at all)
  | 'boolean-axis-drop' // a canvas variant axis whose contract prop is boolean — no figma-surface axis, so half the grid vanishes
  | 'restructured' // same content under different part nesting (a wrapper the proposal introduced/removed) — value preserved, path moved
  | 'vector-glyph' // svg/vector internals — mock renders empty frames; instancePrimaryFill unreadable
  | 'url-image' // url()/IMAGE channels — emitter ledgers gradientMiss by design (EXPECTED)
  | 'text-style-identity' // named text styles need the semantic slot; a foreign tokenSet has none
  | 'boolean-axis-placeholder' // {prop} minted paths over boolean props never substitute on the figma surface (CLOSED: VARIANT-bound bools are axes now)
  | 'single-variant-dep-collapse' // a 1-variant dependency emits standalone, dropping bound properties (CLOSED: parent drops/refuses at compile)
  | 'cartesian-fill' // the emit enumerates the FULL axis cartesian; rows the canvas never drew are round-trip-only by construction
  | 'dup-sibling-names' // the dump reuses ONE layer name for N siblings — their facts collapse to one key, so N-1 uniquely-named round-trip siblings have no dump-side counterpart
  | 'hug-vs-fixed' // the canvas hugged (no comparable box fact), the emit lowered the captured measure to a FIXED/FILL axis — the mode disagreement is the finding
  | 'declared-not-drawn' // a component property the contract declares that the drawn instance never carried
  | 'mixed-stroke-weight' // per-side stroke weights spell 'mixed' in figma, so the dump omits the channel; a uniform RT weight has no dump-side counterpart
  | 'zero-stroke' // a strokeless original round-trips as an EXPLICIT zero-width transparent stroke: a partially stroked node now carries its own absence (border-width 0 + border-color #00000000) so the color channel stops resolving to currentColor — nothing renders at weight 0 with an alpha-0 paint
  | 'headless-measure'; // mock hug sizes are estimates — excluded, never compared

interface Fact {
  variant: string;
  path: string; // '' = variant root; else 'Content/plus'
  channel: string;
  value: string;
  tag?: LimitTag;
}

interface ComponentResult {
  component: string;
  contractId: string;
  status: 'diffed' | 'emit-refused' | 'exec-failed' | 'no-set';
  reason?: string;
  reasonTag?: LimitTag;
  originalVariants: number;
  roundTripVariants?: number;
  matched?: number;
  diverged?: Fact[]; // value = "original → roundtrip"
  loss?: Fact[];
  invented?: Fact[];
}

// ---------------------------------------------------------------------------
// Inputs: contracts, tokenSet (bundle-shaped), icons
// ---------------------------------------------------------------------------

type Json = Record<string, unknown>;
const readJson = (p: string): Json => JSON.parse(readFileSync(p, 'utf8')) as Json;

/** Flat DTCG — the exact flatten `ds-contracts figma bundle` applies. */
const flattenDtcg = (node: Json, prefix: string[] = [], out: Json = {}): Json => {
  for (const [k, v] of Object.entries(node)) {
    if (k.startsWith('$')) continue;
    if (v && typeof v === 'object' && '$value' in (v as object)) out[[...prefix, k].join('.')] = v;
    else if (v && typeof v === 'object') flattenDtcg(v as Json, [...prefix, k], out);
  }
  return out;
};

const contractFiles = readdirSync(CONTRACTS_DIR)
  .filter((f) => f.endsWith('.contract.json'))
  .sort();
const allContracts = contractFiles.map((f) => readJson(path.join(CONTRACTS_DIR, f)));
const contractById = new Map(allContracts.map((c) => [String(c.id), c]));

/** Composition closure over anatomy component refs. */
function closureOf(id: string): string[] {
  const out = new Set<string>();
  const walk = (cid: string): void => {
    if (out.has(cid)) return;
    out.add(cid);
    const c = contractById.get(cid);
    if (!c) return;
    const collect = (v: unknown): void => {
      if (v && typeof v === 'object') {
        const ref = (v as { component?: { id?: unknown } }).component;
        if (ref && typeof ref.id === 'string') walk(ref.id);
        for (const x of Object.values(v)) collect(x);
      }
    };
    collect(c.anatomy);
  };
  walk(id);
  return [...out];
}

// NAMED FINDING (empty-base refusal): the hand-built Untitled UI canvas used
// ZERO published variables — captured.dtcg.json is `{}` and every fact lives
// in the minted tree (752 literal leaves). `figma bundle` writes that shape,
// and the plugin's paste referee (parseTokenSet) REFUSES it: "base must be a
// non-empty flat DTCG object". So the real designer-journey paste is shut for
// this library today. The runner measures the emit engine anyway by passing
// the bundle-shaped payload with the shape referee bypassed (base stays the
// captured `{}`; the minted layer is what actually syncs) — the refusal is a
// finding in REPORT.md, not something this harness papers over.
const capturedBase = flattenDtcg(readJson(path.join(UUI, 'storybook', 'tokens', 'captured.dtcg.json')));
const mintedTree = readJson(path.join(UUI, 'storybook', 'tokens', 'minted.dtcg.json'));
const bundleShaped = { name: 'Untitled UI', base: capturedBase, minted: mintedTree };
const tokenSetParsed = parseTokenSet(bundleShaped);
const EMPTY_BASE_REFUSAL = tokenSetParsed.ok ? null : tokenSetParsed.error;
const tokenSet: TokenSetPayload = tokenSetParsed.ok
  ? tokenSetParsed.tokenSet
  : (bundleShaped as unknown as TokenSetPayload);

const icons: Record<string, string> = {};
const ICONS_DIR = path.join(UUI, 'assets', 'icons');
for (const f of readdirSync(ICONS_DIR).filter((f) => f.endsWith('.svg')).sort()) {
  icons[f.replace(/\.svg$/, '')] = readFileSync(path.join(ICONS_DIR, f), 'utf8').trim();
}

const engine = createPluginEngine({
  tokens: { primitives: {}, semantic: {}, light: {}, dark: {}, brands: { default: {} } },
  contracts: [],
  icons: {},
});

// ---------------------------------------------------------------------------
// Normalization — dump side
// ---------------------------------------------------------------------------

interface DumpNode {
  name: string;
  type: string;
  bbox?: { width: number; height: number };
  layout?: {
    mode: string;
    primary: string;
    counter: string;
    spacing: number;
    padding: [number, number, number, number];
    primarySizing: string;
    counterSizing: string;
  };
  cornerRadius?: number;
  fill?: { hex?: string; var?: string; alpha?: number };
  stroke?: { hex?: string; var?: string; alpha?: number };
  strokeWeight?: number;
  text?: { characters: string; fontSize: number | null; fontStyle: string | null; lineHeight?: number; style?: string };
  effects?: Array<Record<string, unknown>>;
  abs?: { x: number; y: number; width: number; height: number };
  shape?: { kind: string; width: number; height: number };
  fixedSize?: { width?: number; height?: number };
  instanceOf?: string;
  instancePrimaryFill?: Record<string, unknown>;
  componentProperties?: Record<string, unknown>;
  imageFill?: unknown;
  fillWidth?: boolean;
  hidden?: boolean;
  opacity?: number;
  minWidth?: number;
  maxWidth?: number;
  minHeight?: number;
  maxHeight?: number;
  children?: DumpNode[];
}

const r1 = (n: number): number => Math.round(n * 10) / 10;
const r2 = (n: number): number => Math.round(n * 100) / 100;
const normVariantName = (name: string): string => name.split(',').map((s) => s.trim()).sort().join(', ');
const normRefName = (name: string): string => name.toLowerCase().replace(/[^a-z0-9]/g, '');
/** Node-path segment: layer naming cosmetics ('_Dot' vs 'Dot' vs 'dot') are
 *  not structure — paths match on the normalized spelling. */
const normSegment = (name: string): string => normRefName(name) || name;

/** "Icon=False, Size=md" → { Icon: 'False', Size: 'md' }. */
const axesOf = (variantName: string): Record<string, string> => {
  const out: Record<string, string> = {};
  for (const seg of variantName.split(',')) {
    const eq = seg.indexOf('=');
    if (eq > 0) out[seg.slice(0, eq).trim()] = seg.slice(eq + 1).trim();
  }
  return out;
};

const effectStr = (e: {
  type: string;
  color?: { hex?: string; alpha?: number };
  offset?: { x: number; y: number };
  radius?: number;
  spread?: number;
}): string =>
  e.type.startsWith('DROP') || e.type.startsWith('INNER')
    ? `${e.type} #${e.color?.hex ?? '??'}@${r2(e.color?.alpha ?? 1)} off=${r1(e.offset?.x ?? 0)},${r1(e.offset?.y ?? 0)} r=${r1(e.radius ?? 0)} s=${r1(e.spread ?? 0)}`
    : `${e.type} r=${r1(e.radius ?? 0)}`;

/** Node "kind" both sides collapse to — layer-type spellings differ (a drawn
 *  ELLIPSE vs the emitter's ellipse decor both say 'ellipse'). */
const KIND: Record<string, string> = {
  TEXT: 'text',
  INSTANCE: 'instance',
  ELLIPSE: 'ellipse',
  REGULAR_POLYGON: 'polygon',
  RECTANGLE: 'rect',
  VECTOR: 'vector',
  BOOLEAN_OPERATION: 'vector',
  LINE: 'vector',
  STAR: 'vector',
};
const kindOf = (type: string): string => KIND[type] ?? 'box';

function dumpFacts(setEntry: { variants: DumpNode[] }): Fact[] {
  const facts: Fact[] = [];
  const put = (variant: string, p: string, channel: string, value: string, tag?: LimitTag): void => {
    facts.push({ variant, path: p, channel, value, ...(tag ? { tag } : {}) });
  };

  const walkNode = (variant: string, node: DumpNode, p: string, isRoot: boolean): void => {
    put(variant, p, 'kind', kindOf(node.type));
    const l = node.layout;
    put(variant, p, 'layout.mode', l ? l.mode : 'NONE');
    if (l) {
      put(variant, p, 'layout.align', `${l.primary}/${l.counter}`);
      put(variant, p, 'layout.gap', String(l.spacing));
      put(variant, p, 'layout.padding', l.padding.join(','));
      put(variant, p, 'layout.sizing', `${l.primarySizing}/${l.counterSizing}`);
    }
    if (node.cornerRadius !== undefined) put(variant, p, 'radius', String(node.cornerRadius));
    if (node.fill) {
      put(
        variant,
        p,
        'fill',
        node.fill.var ? `var:${node.fill.var}` : `#${node.fill.hex}${node.fill.alpha !== undefined ? `@${r2(node.fill.alpha)}` : ''}`,
      );
    }
    if (node.stroke) {
      put(
        variant,
        p,
        'stroke',
        node.stroke.var ? `var:${node.stroke.var}` : `#${node.stroke.hex}${node.stroke.alpha !== undefined ? `@${r2(node.stroke.alpha)}` : ''}`,
      );
      if (node.strokeWeight !== undefined) put(variant, p, 'strokeWeight', String(node.strokeWeight));
    }
    if (node.effects) {
      put(variant, p, 'effects', node.effects.map((e) => effectStr(e as Parameters<typeof effectStr>[0])).join(' | '));
    }
    if (node.text) {
      put(variant, p, 'text.characters', node.text.characters);
      if (node.text.fontSize !== null) put(variant, p, 'text.fontSize', String(node.text.fontSize));
      if (node.text.fontStyle !== null) put(variant, p, 'text.fontStyle', node.text.fontStyle);
      if (node.text.lineHeight !== undefined) put(variant, p, 'text.lineHeight', String(node.text.lineHeight));
      if (node.text.style !== undefined) put(variant, p, 'text.style', node.text.style, 'text-style-identity');
    }
    if (node.abs) put(variant, p, 'abs', `${r1(node.abs.x)},${r1(node.abs.y)}`);
    const shp = node.shape as (DumpNode['shape'] & { x?: number; y?: number; arc?: { start: number; end: number; innerRadius: number } }) | undefined;
    if (shp?.x !== undefined && shp.y !== undefined) put(variant, p, 'abs', `${r1(shp.x)},${r1(shp.y)}`);
    if (shp?.arc) put(variant, p, 'shape.arc', `${shp.arc.start}→${shp.arc.end} inner=${shp.arc.innerRadius}`);
    if (node.fillWidth) put(variant, p, 'fillWidth', 'true');
    if (node.hidden) put(variant, p, 'hidden', 'true');
    if (node.opacity !== undefined) put(variant, p, 'opacity', String(node.opacity));
    for (const ch of ['minWidth', 'maxWidth', 'minHeight', 'maxHeight'] as const) {
      if (node[ch] !== undefined) put(variant, p, ch, String(node[ch]));
    }
    // Hard box only: an auto-layout node's bbox axis carries iff that axis is
    // FIXED-sized (a hug axis is a computed value — headless-measure named
    // exclusion); non-auto-layout boxes (bbox/abs/shape/fixedSize) carry
    // whole. TEXT boxes never compare (mock text measure is an estimate).
    if (node.type !== 'TEXT') {
      let w: number | undefined;
      let h: number | undefined;
      if (node.bbox && l) {
        const wFixed = (l.mode === 'HORIZONTAL' ? l.primarySizing : l.counterSizing) === 'FIXED';
        const hFixed = (l.mode === 'HORIZONTAL' ? l.counterSizing : l.primarySizing) === 'FIXED';
        if (wFixed) w = node.bbox.width;
        if (hFixed) h = node.bbox.height;
      } else {
        w = node.bbox?.width ?? node.abs?.width ?? node.shape?.width ?? node.fixedSize?.width;
        h = node.bbox?.height ?? node.abs?.height ?? node.shape?.height ?? node.fixedSize?.height;
      }
      if (w !== undefined) put(variant, p, 'width', String(r1(w)));
      if (h !== undefined) put(variant, p, 'height', String(r1(h)));
    }
    if (node.instanceOf !== undefined) {
      put(variant, p, 'instanceOf', normRefName(node.instanceOf));
      if (node.componentProperties) {
        for (const [k, v] of Object.entries(node.componentProperties)) {
          put(variant, p, `prop:${k.split('#')[0]}`, String(v).toLowerCase());
        }
      }
      if (node.instancePrimaryFill) {
        const ipf = node.instancePrimaryFill as { hex?: string; var?: string; alpha?: number; stroke?: boolean };
        if (ipf.stroke) {
          // Line-icon ink rides strokes inside vector internals the mock
          // cannot model — stays an original-only fact, vector-glyph class.
          put(variant, p, 'instancePrimaryFill', JSON.stringify(node.instancePrimaryFill), 'vector-glyph');
        } else {
          // Fill-type primary ink IS comparable: the round-trip instance
          // clone carries real fills (see mockFacts instanceInk).
          put(
            variant,
            p,
            'instanceInk',
            ipf.var ? `var:${ipf.var}` : `#${ipf.hex}${ipf.alpha !== undefined ? `@${r2(ipf.alpha)}` : ''}`,
          );
        }
      }
      return; // dump v1 never recurses instances — neither side does
    }
    if (node.imageFill !== undefined) {
      put(variant, p, 'imageFill', typeof node.imageFill === 'string' ? node.imageFill : 'true', 'url-image');
    }
    for (const child of node.children ?? []) {
      walkNode(variant, child, p === '' ? normSegment(child.name) : `${p}/${normSegment(child.name)}`, false);
    }
  };

  for (const v of setEntry.variants) {
    const variant = normVariantName(v.name);
    put(variant, '', 'variant', 'present');
    walkNode(variant, v, '', true);
  }
  return facts;
}

// ---------------------------------------------------------------------------
// Normalization — round-trip (mock) side
// ---------------------------------------------------------------------------

interface SolidPaint {
  type: string;
  visible?: boolean;
  color: { r: number; g: number; b: number };
  opacity?: number;
}

const hexOf = (c: { r: number; g: number; b: number }): string =>
  [c.r, c.g, c.b].map((x) => Math.round(x * 255).toString(16).padStart(2, '0')).join('');

const firstSolid = (paints: unknown): SolidPaint | undefined =>
  Array.isArray(paints)
    ? (paints as SolidPaint[]).find((p) => p.visible !== false && p.type === 'SOLID')
    : undefined;

const paintStr = (p: SolidPaint): string => {
  const a = typeof p.opacity === 'number' && p.opacity < 1 ? `@${r2(p.opacity)}` : '';
  return `#${hexOf(p.color)}${a}`;
};

const mockEffectStr = (e: {
  type: string;
  color?: { r: number; g: number; b: number; a?: number };
  offset?: { x: number; y: number };
  radius?: number;
  spread?: number;
}): string =>
  e.type.startsWith('DROP') || e.type.startsWith('INNER')
    ? `${e.type} #${e.color ? hexOf(e.color) : '??'}@${e.color?.a !== undefined && e.color.a < 1 ? r2(e.color.a) : 1} off=${r1(e.offset?.x ?? 0)},${r1(e.offset?.y ?? 0)} r=${r1(e.radius ?? 0)} s=${r1(e.spread ?? 0)}`
    : `${e.type} r=${r1(e.radius ?? 0)}`;

const num = (v: unknown): number | undefined => (typeof v === 'number' ? v : undefined);

function mockFacts(set: MockNode): Fact[] {
  const facts: Fact[] = [];
  const put = (variant: string, p: string, channel: string, value: string, tag?: LimitTag): void => {
    facts.push({ variant, path: p, channel, value, ...(tag ? { tag } : {}) });
  };

  const radiusOf = (n: MockNode): number | undefined => {
    if (typeof n.cornerRadius === 'number' && n.cornerRadius !== 0) return n.cornerRadius;
    const tl = num(n.topLeftRadius);
    if (tl === undefined) return undefined;
    const corners = [num(n.topRightRadius), num(n.bottomLeftRadius), num(n.bottomRightRadius)];
    return corners.every((c) => c === tl) ? tl : undefined;
  };

  const walkNode = (variant: string, n: MockNode, p: string, isRoot: boolean): void => {
    put(variant, p, 'kind', kindOf(n.type));
    const auto = n.layoutMode && n.layoutMode !== 'NONE';
    put(variant, p, 'layout.mode', auto ? n.layoutMode : 'NONE');
    if (auto) {
      put(variant, p, 'layout.align', `${n.primaryAxisAlignItems}/${n.counterAxisAlignItems}`);
      put(variant, p, 'layout.gap', String(n.itemSpacing));
      put(variant, p, 'layout.padding', [n.paddingTop, n.paddingRight, n.paddingBottom, n.paddingLeft].join(','));
      put(variant, p, 'layout.sizing', `${n.primaryAxisSizingMode}/${n.counterAxisSizingMode}`);
    }
    const isInstance = n.type === 'INSTANCE';
    // Instance surface channels mirror the dump's shallow instance capture:
    // paint facts ride instanceInk (below), not fill/stroke — the dump never
    // records an instance's own paint stack under those channels.
    if (!isInstance) {
      const radius = radiusOf(n);
      if (radius !== undefined) put(variant, p, 'radius', String(radius));
      const fill = firstSolid(n.fills);
      if (fill) put(variant, p, 'fill', paintStr(fill));
      const stroke = firstSolid(n.strokes);
      if (stroke) {
        put(variant, p, 'stroke', paintStr(stroke));
        if (typeof n.strokeWeight === 'number') put(variant, p, 'strokeWeight', String(n.strokeWeight));
      }
      if (Array.isArray(n.effects) && n.effects.length > 0) {
        put(
          variant,
          p,
          'effects',
          (n.effects as Array<Parameters<typeof mockEffectStr>[0]>)
            .filter((e) => (e as { visible?: boolean }).visible !== false)
            .map(mockEffectStr)
            .join(' | '),
        );
      }
    }
    if (n.type === 'TEXT') {
      put(variant, p, 'text.characters', n.characters ?? '');
      if (typeof n.fontSize === 'number') put(variant, p, 'text.fontSize', String(n.fontSize));
      if (n.fontName) put(variant, p, 'text.fontStyle', n.fontName.style);
      if (n.lineHeight && n.lineHeight.unit === 'PIXELS' && typeof n.lineHeight.value === 'number') {
        put(variant, p, 'text.lineHeight', String(n.lineHeight.value));
      }
      // textStyleId → text.style intentionally absent: a foreign tokenSet
      // carries no semantic slot, so the engine derives no named styles
      // (text-style-identity limit — the dump side fact ledgers as LOSS).
    }
    if (n.layoutPositioning === 'ABSOLUTE') put(variant, p, 'abs', `${r1(n.x)},${r1(n.y)}`);
    const arc = n.arcData as { startingAngle?: number; endingAngle?: number; innerRadius?: number } | undefined;
    if (arc && typeof arc.startingAngle === 'number' && typeof arc.endingAngle === 'number') {
      put(variant, p, 'shape.arc', `${r2(arc.startingAngle)}→${r2(arc.endingAngle)} inner=${r2(arc.innerRadius ?? 0)}`);
    }
    if (n.layoutSizingHorizontal === 'FILL') put(variant, p, 'fillWidth', 'true');
    if (n.visible === false) put(variant, p, 'hidden', 'true');
    if (typeof n.opacity === 'number' && n.opacity < 1) put(variant, p, 'opacity', String(Math.round(n.opacity * 10000) / 10000));
    for (const ch of ['minWidth', 'maxWidth', 'minHeight', 'maxHeight'] as const) {
      const v = n[ch];
      if (typeof v === 'number') put(variant, p, ch, String(v));
    }
    // Hard box only (see the named exclusions in the header): an axis is
    // comparable when it is FIXED-sized (or the node is a non-auto-layout
    // resized box / decor shape / instance) — mock hug widths are estimates.
    if (n.type !== 'TEXT') {
      const horizontalIsPrimary = n.layoutMode === 'HORIZONTAL';
      const wFixed = auto
        ? (horizontalIsPrimary ? n.primaryAxisSizingMode : n.counterAxisSizingMode) === 'FIXED'
        : n._resized === true;
      const hFixed = auto
        ? (horizontalIsPrimary ? n.counterAxisSizingMode : n.primaryAxisSizingMode) === 'FIXED'
        : n._resized === true;
      if (wFixed && n.layoutSizingHorizontal !== 'FILL') put(variant, p, 'width', String(r1(n.width)));
      if (hFixed && n.layoutSizingVertical !== 'FILL') put(variant, p, 'height', String(r1(n.height)));
    }
    if (n.type === 'INSTANCE') {
      const main = n._mainComponent as MockNode | undefined;
      const owner = main && main.parent && main.parent.type === 'COMPONENT_SET' ? main.parent : main;
      if (owner) put(variant, p, 'instanceOf', normRefName(owner.name));
      for (const [k, def] of Object.entries(n.componentProperties ?? {})) {
        put(variant, p, `prop:${k.split('#')[0]}`, String(def.value).toLowerCase());
      }
      // instanceInk — the dump's fill-type instancePrimaryFill counterpart:
      // first visible SOLID fill in the instance subtree (clones carry real
      // fills; svg internals are empty frames — the STROKE-type probe stays
      // an original-only vector-glyph fact).
      for (const sub of [n, ...n.findAll()]) {
        const ink = firstSolid(sub.fills);
        if (ink) {
          put(variant, p, 'instanceInk', paintStr(ink));
          break;
        }
      }
      return; // both sides stop at instances
    }
    // Hidden children still walk — the dump captures hidden nodes too.
    for (const child of n.children ?? []) {
      walkNode(variant, child, p === '' ? normSegment(child.name) : `${p}/${normSegment(child.name)}`, false);
    }
  };

  const variants: MockNode[] = set.type === 'COMPONENT_SET' ? set.children ?? [] : [set];
  for (const v of variants) {
    const variant = set.type === 'COMPONENT_SET' ? normVariantName(v.name) : normVariantName(set.name);
    facts.push({ variant, path: '', channel: 'variant', value: 'present' });
    walkNode(variant, v, '', true);
  }
  return facts;
}

// ---------------------------------------------------------------------------
// The diff — fact maps keyed (variant ▸ path ▸ channel)
// ---------------------------------------------------------------------------

interface DiffResult {
  matched: number;
  diverged: Fact[];
  loss: Fact[];
  invented: Fact[];
}

function diffFacts(original: Fact[], roundTrip: Fact[], missingVariantTag?: (variant: string) => LimitTag | undefined): DiffResult {
  const key = (f: Fact): string => `${f.variant} ▸ ${f.path || '(root)'} ▸ ${f.channel}`;
  const a = new Map(original.map((f) => [key(f), f]));
  const b = new Map(roundTrip.map((f) => [key(f), f]));

  // Variants present on one side only: ledger the variant fact itself, then
  // suppress that variant's node facts on the same side (one named line per
  // missing variant, not hundreds of derivative ones).
  const variantsA = new Set(original.filter((f) => f.channel === 'variant').map((f) => f.variant));
  const variantsB = new Set(roundTrip.filter((f) => f.channel === 'variant').map((f) => f.variant));
  const onlyA = new Set([...variantsA].filter((v) => !variantsB.has(v)));
  const onlyB = new Set([...variantsB].filter((v) => !variantsA.has(v)));

  const out: DiffResult = { matched: 0, diverged: [], loss: [], invented: [] };
  for (const [k, fa] of a) {
    if (onlyA.has(fa.variant)) {
      if (fa.channel === 'variant') {
        out.loss.push({
          ...fa,
          channel: 'variant',
          value: 'missing in round trip',
          tag: missingVariantTag?.(fa.variant) ?? (fa.variant.includes('State=') ? 'interaction-states' : fa.tag),
        });
      }
      continue;
    }
    const fb = b.get(k);
    if (!fb) out.loss.push(fa);
    else if (fa.value === fb.value) out.matched++;
    else out.diverged.push({ ...fa, value: `${fa.value} → ${fb.value}`, tag: fa.tag ?? fb.tag });
  }
  for (const [k, fb] of b) {
    if (onlyB.has(fb.variant)) {
      // The emit enumerates the FULL axis cartesian (bool axes included);
      // a curated canvas grid draws a subset — the extra rows are round-
      // trip-only BY CONSTRUCTION, named, never silently matched.
      if (fb.channel === 'variant') out.invented.push({ ...fb, value: 'extra variant in round trip', tag: 'cartesian-fill' });
      continue;
    }
    if (!a.has(k)) out.invented.push(fb);
  }

  // A layout.mode DIVERGENCE (NONE ↔ auto-layout) already names the finding
  // once — the auto side's align/gap/padding/sizing sub-facts are derivative
  // of that one divergence, not independent inventions/losses.
  const modeDiverged = new Set(
    out.diverged.filter((f) => f.channel === 'layout.mode').map((f) => `${f.variant} ▸ ${f.path}`),
  );
  const derivative = (f: Fact): boolean =>
    f.channel.startsWith('layout.') && f.channel !== 'layout.mode' && modeDiverged.has(`${f.variant} ▸ ${f.path}`);
  out.loss = out.loss.filter((f) => !derivative(f));
  out.invented = out.invented.filter((f) => !derivative(f));

  // RESTRUCTURED pairing — tree alignment between the two nestings. A loss
  // fact and an invented fact with the SAME (variant, channel, value) whose
  // paths are RELATED are one node the proposal moved/renamed, not content
  // invented from nothing — tag both, keep both visible. Related, in pass
  // order (each pair RECORDS its path mapping for the mapped-prefix pass):
  //   0. SAME LEAF at any nesting (the original rule — wrapper introduced or
  //      removed around an unrenamed node);
  //   1. SAME PARENT, related leaf — the proposer's rename spellings: digit
  //      dedupe of a child sharing its parent's name (dump 'Left control/
  //      Left control' → contract leftControl2) and parent-prefixed child
  //      names (dump 'Tooltip' → contract rightControlTooltip, dump 'Text'
  //      → contract textInputText);
  //   2. ANCESTOR/DESCENDANT paths (a wrapper introduced around a node the
  //      proposal ALSO renamed — AvatarCompanyIcon box ▸
  //      AvatarCompanyIconInstance vs the dump's flat instance);
  //   3. MAPPED PREFIX, to fixpoint: rewrite the invented path through the
  //      longest already-paired ancestor and retry rule 2 relative to the
  //      mapped location (children of a renamed wrapper).
  const leaf = (p: string): string => p.split('/').pop() ?? p;
  const stripD = (s: string): string => s.replace(/\d+$/, '');
  const leafRelated = (x: string, y: string): boolean =>
    x === y || stripD(x) === stripD(y) || x.endsWith(y) || y.endsWith(x) || x.startsWith(y) || y.startsWith(x);
  const parentOf = (p: string): string => (p.includes('/') ? p.slice(0, p.lastIndexOf('/')) : '');
  const isAncestor = (shorter: string, longer: string): boolean =>
    shorter !== longer && longer.startsWith(shorter === '' ? '' : shorter + '/');
  const pathMap = new Map<string, string>(); // `${variant} ▸ ${invPath}` → lossPath
  const pair = (inv: Fact, twin: Fact): void => {
    inv.tag = 'restructured';
    twin.tag = 'restructured';
    if (!pathMap.has(`${inv.variant} ▸ ${inv.path}`)) pathMap.set(`${inv.variant} ▸ ${inv.path}`, twin.path);
  };
  const lossByKey = new Map<string, Fact[]>();
  for (const f of out.loss) {
    const k = `${f.variant} ▸ ${leaf(f.path)} ▸ ${f.channel} ▸ ${f.value}`;
    (lossByKey.get(k) ?? lossByKey.set(k, []).get(k)!).push(f);
  }
  const lossByCV = new Map<string, Fact[]>();
  for (const f of out.loss) {
    const k = `${f.variant} ▸ ${f.channel} ▸ ${f.value}`;
    (lossByCV.get(k) ?? lossByCV.set(k, []).get(k)!).push(f);
  }
  // Pass 0 — same leaf (the original rule, kept first so prior pairings hold).
  for (const f of out.invented) {
    if (f.tag !== undefined) continue;
    const twin = lossByKey.get(`${f.variant} ▸ ${leaf(f.path)} ▸ ${f.channel} ▸ ${f.value}`)?.find((t) => t.tag === undefined);
    if (twin) pair(f, twin);
  }
  // Pass 1 — same parent, related leaf (rename spellings).
  for (const f of out.invented) {
    if (f.tag !== undefined) continue;
    const twin = lossByCV
      .get(`${f.variant} ▸ ${f.channel} ▸ ${f.value}`)
      ?.find((t) => t.tag === undefined && parentOf(t.path) === parentOf(f.path) && leafRelated(leaf(t.path), leaf(f.path)));
    if (twin) pair(f, twin);
  }
  // Pass 2 — ancestor/descendant containment.
  for (const f of out.invented) {
    if (f.tag !== undefined) continue;
    const twin = lossByCV
      .get(`${f.variant} ▸ ${f.channel} ▸ ${f.value}`)
      ?.find((t) => t.tag === undefined && (isAncestor(t.path, f.path) || isAncestor(f.path, t.path)));
    if (twin) pair(f, twin);
  }
  // Pass 3 — mapped-prefix containment, to fixpoint.
  let paired = true;
  while (paired) {
    paired = false;
    for (const f of out.invented) {
      if (f.tag !== undefined) continue;
      const segs = f.path.split('/');
      for (let i = segs.length; i >= 1; i--) {
        const mapped = pathMap.get(`${f.variant} ▸ ${segs.slice(0, i).join('/')}`);
        if (mapped === undefined) continue;
        const rewritten = i === segs.length ? mapped : `${mapped}/${segs.slice(i).join('/')}`;
        // Retry rules 1 and 2 RELATIVE to the mapped location: containment,
        // or a rename (related leaf) among the mapped node's siblings.
        const twin = lossByCV
          .get(`${f.variant} ▸ ${f.channel} ▸ ${f.value}`)
          ?.find(
            (t) =>
              t.tag === undefined &&
              (t.path === rewritten ||
                isAncestor(t.path, rewritten) ||
                isAncestor(rewritten, t.path) ||
                (parentOf(t.path) === parentOf(rewritten) && leafRelated(leaf(t.path), leaf(rewritten)))),
          );
        if (twin) {
          pair(f, twin);
          paired = true;
        }
        break; // longest mapped prefix only
      }
    }
  }

  // The MOVED NODE'S OTHER CHANNELS ride the same move: once a (variant,
  // path) is restructure-paired, that node's remaining untagged facts at the
  // SAME path are the same finding — the node moved, its channel inventory
  // came with it (values still ledgered verbatim on both sides).
  const movedInvPaths = new Set(out.invented.filter((f) => f.tag === 'restructured').map((f) => `${f.variant} ▸ ${f.path}`));
  const movedLossPaths = new Set(out.loss.filter((f) => f.tag === 'restructured').map((f) => `${f.variant} ▸ ${f.path}`));
  for (const f of out.invented) {
    if (f.tag === undefined && movedInvPaths.has(`${f.variant} ▸ ${f.path}`)) f.tag = 'restructured';
  }
  for (const f of out.loss) {
    if (f.tag === undefined && movedLossPaths.has(`${f.variant} ▸ ${f.path}`)) f.tag = 'restructured';
  }

  // DUP-SIBLING NAMES: the dump reuses one layer name for N siblings (avatar
  // group draws eight 'Avatar' instances), so their facts collapse onto ONE
  // key on the original side; the round trip names them uniquely ('avatar',
  // 'avatar 2', …) and siblings 2..N have no dump-side key BY CONSTRUCTION.
  // Condition: the invented leaf carries a digit suffix AND the original set
  // has facts at the digit-stripped path in the SAME variant.
  const origPaths = new Set(original.map((f) => `${f.variant} ▸ ${f.path}`));
  const stripDigitsPath = (p: string): string => {
    const segs = p.split('/');
    segs[segs.length - 1] = stripD(segs[segs.length - 1]);
    return segs.join('/');
  };
  for (const f of out.invented) {
    if (f.tag !== undefined) continue;
    const base = stripDigitsPath(f.path);
    if (base !== f.path && origPaths.has(`${f.variant} ▸ ${base}`)) f.tag = 'dup-sibling-names';
  }

  // ONE-SIDED PROBE/SIZING channels at a node BOTH sides carry (the original
  // has facts at the same variant+path). Named per channel family:
  //   · hug-vs-fixed — width/height/fillWidth on the round trip only: the
  //     canvas hugged (hug boxes carry no comparable box fact — the
  //     headless-measure exclusion), the emit lowered the captured measure
  //     to a FIXED/FILL axis. The mode disagreement is the finding; the
  //     pixel compare is already excluded.
  //   · vector-glyph — instanceInk on the round trip only: the dump's
  //     primary-ink probe rode STROKE-type vector internals (already
  //     ledgered vector-glyph as loss), so the RT clone's first-solid probe
  //     finds different evidence, not new ink.
  //   · declared-not-drawn — a prop:* the round trip exposes that the drawn
  //     instance never carried: contract-declared API the canvas lacks.
  //   · mixed-stroke-weight — strokeWeight on the round trip only while the
  //     original DOES carry the stroke paint: figma spells per-side weights
  //     as 'mixed' and the dump omits the channel, so a uniform RT weight
  //     has no dump-side counterpart by construction.
  //   · zero-stroke — the stroke/strokeWeight PAIR on the round trip only, at
  //     a node the original drew with NO stroke at all, and whose round-trip
  //     value is a zero weight / a fully transparent paint. A partially
  //     stroked node (Avatar: State=Focused only; Social button: every theme
  //     but Brand) now carries its own ABSENCE explicitly — border-width 0
  //     paired with border-color #00000000 — because the two halves of one
  //     stroke fact must agree: carrying only the width let CSS resolve the
  //     unset border-color to `currentColor` and the ring drew in text ink
  //     (round 5). Nothing renders at weight 0 with an alpha-0 paint, so the
  //     round trip is pixel-identical to the original here; the fact is new,
  //     the drawing is not.
  const origChannels = new Map<string, Set<string>>();
  for (const f of original) {
    const k = `${f.variant} ▸ ${f.path}`;
    (origChannels.get(k) ?? origChannels.set(k, new Set()).get(k)!).add(f.channel);
  }
  for (const f of out.invented) {
    if (f.tag !== undefined) continue;
    const chans = origChannels.get(`${f.variant} ▸ ${f.path}`);
    if (!chans) continue; // node absent on the original side — a real structural invention, stays unclassified
    if ((f.channel === 'width' || f.channel === 'height' || f.channel === 'fillWidth') && !chans.has(f.channel)) {
      f.tag = 'hug-vs-fixed';
    } else if (f.channel === 'instanceInk' && !chans.has('instanceInk')) {
      f.tag = 'vector-glyph';
    } else if (f.channel.startsWith('prop:') && !chans.has(f.channel)) {
      f.tag = 'declared-not-drawn';
    } else if (f.channel === 'strokeWeight' && !chans.has('strokeWeight') && chans.has('stroke')) {
      f.tag = 'mixed-stroke-weight';
    } else if (
      (f.channel === 'stroke' || f.channel === 'strokeWeight') &&
      !chans.has('stroke') &&
      !chans.has('strokeWeight') &&
      // Rendering-neutral ONLY: weight exactly 0, or a paint at alpha 0.
      (f.channel === 'strokeWeight' ? f.value === '0' : /@0$/.test(f.value))
    ) {
      f.tag = 'zero-stroke';
    }
  }

  // The wrapper that did the moving: an untagged invented fact at a path that
  // is an ANCESTOR of restructure-paired paths is the introduced wrapper
  // itself — same class, not an independent invention.
  const restructuredPrefixes = new Set<string>();
  for (const f of out.invented) {
    if (f.tag !== 'restructured') continue;
    const segs = f.path.split('/');
    for (let i = 1; i < segs.length; i++) restructuredPrefixes.add(`${f.variant} ▸ ${segs.slice(0, i).join('/')}`);
  }
  for (const f of out.invented) {
    if (f.tag === undefined && restructuredPrefixes.has(`${f.variant} ▸ ${f.path}`)) f.tag = 'restructured';
  }

  // A kind divergence whose original side is vector geometry is the campaign's
  // vector-glyph limit (arbitrary paths have no emit projection).
  for (const f of out.diverged) {
    if (f.channel === 'kind' && f.tag === undefined && f.value.startsWith('vector')) f.tag = 'vector-glyph';
  }
  return out;
}

// ---------------------------------------------------------------------------
// Variant-name canonicalization — both sides speak the same full axis grid
// ---------------------------------------------------------------------------

/** Figma axis property → figma-side value name of the contract default
 *  (e.g. Label → 'True'), for every VARIANT-bound prop of the contract. */
function axisDefaultsOf(contract: Json): Record<string, string> {
  const out: Record<string, string> = {};
  for (const prop of (contract.props as Array<Json> | undefined) ?? []) {
    const fig = (prop.bindings as { figma?: { kind?: string; property?: string; values?: Record<string, string> } } | undefined)?.figma;
    if (!fig || fig.kind !== 'VARIANT' || !fig.property) continue;
    const def = String(prop.default);
    out[fig.property] = fig.values?.[def] ?? def;
  }
  return out;
}

/** Rewrite every fact's variant name onto the UNION axis grid: an axis a side
 *  does not spell fills from the contract default (the value the emitted
 *  variant actually renders). Makes a dropped boolean axis line up against
 *  the default half of the original grid instead of matching nothing. */
function canonicalizeVariants(sides: Fact[][], axisDefaults: Record<string, string>): void {
  const union = new Set<string>();
  for (const side of sides) {
    for (const f of side) {
      if (f.channel === 'variant') for (const axis of Object.keys(axesOf(f.variant))) union.add(axis);
    }
  }
  for (const side of sides) {
    const rewritten = new Map<string, string>();
    for (const f of side) {
      let canon = rewritten.get(f.variant);
      if (canon === undefined) {
        const axes = axesOf(f.variant);
        for (const axis of union) {
          if (!(axis in axes)) axes[axis] = axisDefaults[axis] ?? '?';
        }
        canon = Object.keys(axes).sort().map((k) => `${k}=${axes[k]}`).join(', ');
        rewritten.set(f.variant, canon);
      }
      f.variant = canon;
    }
  }
}

// ---------------------------------------------------------------------------
// The pipeline, per component
// ---------------------------------------------------------------------------

const dumpSetOf = (dump: Json): { setName: string; variants: DumpNode[] } => {
  const key = Object.keys(dump).find((k) => !['_provenance', '_degradations', '_variables'].includes(k));
  if (!key) throw new Error('dump has no set entry');
  const entry = dump[key] as { setName?: string; variants: DumpNode[] };
  return { setName: entry.setName ?? key.replace(/^_/, ''), variants: entry.variants };
};

async function runComponent(name: string): Promise<ComponentResult> {
  const contractId = `ds.${name}`;
  const dump = readJson(path.join(DUMPS_DIR, `${name}.dump.json`));
  const setEntry = dumpSetOf(dump);
  const originalFacts = dumpFacts(setEntry);
  const originalVariants = setEntry.variants.length;

  // HONESTY GATE — the dump diffed against itself must be zero.
  const self = diffFacts(originalFacts, originalFacts);
  if (self.diverged.length + self.loss.length + self.invented.length !== 0) {
    throw new Error(`${name}: self-diff is not zero — the normalizer is dishonest`);
  }

  const ids = closureOf(contractId);
  const plan = engine.planGenerate(
    ids.map((i) => {
      const c = contractById.get(i);
      if (!c) throw new Error(`${name}: composition ref ${i} has no contract file in ${CONTRACTS_DIR}`);
      return c as unknown;
    }),
    { withTokens: true, fileKey: '', tokenSet, icons },
  );
  if (!plan.ok) {
    const reason = plan.issues.map((i) => i.headline + (i.detail ? ` — ${i.detail}` : '')).join(' | ');
    return {
      component: name,
      contractId,
      status: 'emit-refused',
      reason,
      reasonTag: /\{[a-zA-Z][\w-]*\}/.test(reason) ? 'boolean-axis-placeholder' : undefined,
      originalVariants,
    };
  }

  const { figma, root } = createFigmaMock();
  const ctx = vm.createContext({ figma, console: { log() {}, warn() {}, error() {} } });
  try {
    for (const step of plan.steps) {
      await vm.runInContext(`(async () => {\n${step.code}\n})()`, ctx, { timeout: 120_000 });
    }
  } catch (e) {
    const reason = e instanceof Error ? e.message : String(e);
    return {
      component: name,
      contractId,
      status: 'exec-failed',
      reason,
      reasonTag: /\{[a-zA-Z][\w-]*\}/.test(reason)
        ? 'boolean-axis-placeholder'
        : /component propert/.test(reason)
          ? 'single-variant-dep-collapse'
          : undefined,
      originalVariants,
    };
  }

  const set = root.findOne(
    (n) =>
      (n.type === 'COMPONENT_SET' || n.type === 'COMPONENT') &&
      n.getSharedPluginData('ds_contracts', 'contractId') === contractId,
  );
  if (!set) return { component: name, contractId, status: 'no-set', reason: 'executed clean but no marked set in the mock file', originalVariants };

  const rtFacts = mockFacts(set);

  // Canonical variant grid: an axis one side does not spell fills from the
  // contract default. Two default sources, in order:
  //   · the CONTRACT's VARIANT-bound props (enum AND boolean — bool axes
  //     emit since the boolean-axis fix, so a contract-backed axis is only
  //     dropped when the emit surface loses it);
  //   · an axis the dump draws that the contract does not carry AT ALL
  //     (avatar-label-group's State rows — proposed away): the dump's own
  //     default variant (Figma's default is positional-first), so the
  //     default rows still compare and the non-default rows ledger by name.
  const contract = contractById.get(contractId)!;
  const contractAxisDefaults = axisDefaultsOf(contract);
  const axisDefaults = { ...contractAxisDefaults };
  for (const [axis, value] of Object.entries(axesOf(setEntry.variants[0].name))) {
    if (!(axis in axisDefaults)) axisDefaults[axis] = value;
  }
  const origAxes = new Set(setEntry.variants.flatMap((v) => Object.keys(axesOf(v.name))));
  const rtVariantNames = set.type === 'COMPONENT_SET' ? (set.children ?? []).map((c) => c.name) : [set.name];
  const rtAxes = new Set(rtVariantNames.flatMap((n) => Object.keys(axesOf(n))));
  const droppedAxes = [...origAxes].filter((a) => !rtAxes.has(a));
  canonicalizeVariants([originalFacts, rtFacts], axisDefaults);

  const missingVariantTag = (variant: string): LimitTag | undefined => {
    const axes = axesOf(variant);
    if (
      droppedAxes.some(
        (a) => a in contractAxisDefaults && axes[a] !== undefined && axes[a] !== contractAxisDefaults[a],
      )
    ) {
      return 'boolean-axis-drop';
    }
    return variant.includes('State=') ? 'interaction-states' : undefined;
  };

  const diff = diffFacts(originalFacts, rtFacts, missingVariantTag);

  // State-only furniture: a loss that exists ONLY in non-default State rows
  // (hover tooltips, cursors) — the fact never appears as a loss in the same
  // variant's default-state sibling because the canvas draws it only there.
  const stateDefault = axisDefaults['State'] ?? 'Default';
  const lossKeys = new Set(diff.loss.map((f) => `${f.variant} ▸ ${f.path} ▸ ${f.channel}`));
  for (const f of diff.loss) {
    if (f.tag !== undefined) continue;
    const axes = axesOf(f.variant);
    if (!axes['State'] || axes['State'] === stateDefault) continue;
    const sibling = Object.keys(axes)
      .sort()
      .map((k) => `${k}=${k === 'State' ? stateDefault : axes[k]}`)
      .join(', ');
    if (!lossKeys.has(`${sibling} ▸ ${f.path} ▸ ${f.channel}`)) f.tag = 'interaction-states';
  }
  return {
    component: name,
    contractId,
    status: 'diffed',
    originalVariants,
    roundTripVariants: set.type === 'COMPONENT_SET' ? (set.children ?? []).length : 1,
    matched: diff.matched,
    diverged: diff.diverged,
    loss: diff.loss,
    invented: diff.invented,
  };
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

const factLine = (f: Fact): string =>
  `${f.variant} ▸ ${f.path || '(root)'} ▸ ${f.channel}: ${f.value}${f.tag ? `  [${f.tag}]` : ''}`;

function groupByTag(facts: Fact[]): Map<string, Fact[]> {
  const m = new Map<string, Fact[]>();
  for (const f of facts) {
    const t = f.tag ?? '(unclassified)';
    if (!m.has(t)) m.set(t, []);
    m.get(t)!.push(f);
  }
  return m;
}

/** Collapse per-variant repetition: same path+channel+value across variants. */
function collapse(facts: Fact[]): Array<{ line: string; count: number; tag?: LimitTag }> {
  const m = new Map<string, { line: string; count: number; tag?: LimitTag; variants: string[] }>();
  for (const f of facts) {
    const k = `${f.path || '(root)'} ▸ ${f.channel}: ${f.value}`;
    const e = m.get(k) ?? { line: k, count: 0, tag: f.tag, variants: [] };
    e.count++;
    e.variants.push(f.variant);
    m.set(k, e);
  }
  return [...m.values()].sort((x, y) => y.count - x.count);
}

async function main(): Promise<void> {
  const only = process.argv.slice(2);
  const targets = only.length > 0 ? COMPONENTS.filter((c) => only.includes(c)) : [...COMPONENTS];
  if (only.length > 0 && targets.length !== only.length) {
    const known = new Set<string>(COMPONENTS);
    throw new Error(`unknown component(s): ${only.filter((o) => !known.has(o)).join(', ')} — known: ${COMPONENTS.join(', ')}`);
  }

  const results: ComponentResult[] = [];
  for (const name of targets) {
    results.push(await runComponent(name));
  }

  const diffed = results.filter((r) => r.status === 'diffed');
  const totals = {
    components: results.length,
    roundTripClosed: diffed.length,
    matched: diffed.reduce((n, r) => n + (r.matched ?? 0), 0),
    diverged: diffed.reduce((n, r) => n + (r.diverged?.length ?? 0), 0),
    loss: diffed.reduce((n, r) => n + (r.loss?.length ?? 0), 0),
    invented: diffed.reduce((n, r) => n + (r.invented?.length ?? 0), 0),
  };

  const lines: string[] = [];
  lines.push('# Canvas→code→canvas round trip — Untitled UI, set-level diff');
  lines.push('');
  lines.push(`Generated by \`npx tsx extract/figma/roundtrip-uui/run.ts\` — original truth: examples/untitled-ui/dumps-v2 (dump v1.9); round-trip truth: the plugin engine's Generate path executed in the headless mock. Fact = (variant ▸ node path ▸ channel). Self-diff honesty gate: every dump diffs to zero against itself before any round-trip diff is trusted.`);
  lines.push('');
  if (EMPTY_BASE_REFUSAL) {
    lines.push('## Named pipeline finding: the real paste door is shut (empty-base refusal)');
    lines.push('');
    lines.push(
      `The hand-built canvas used zero published variables, so captured.dtcg.json is \`{}\` and every fact is minted. The bundle the CLI would build for this library is REFUSED by the plugin paste referee: “${EMPTY_BASE_REFUSAL}” This runner bypasses the shape referee (the minted layer is what actually syncs) to measure the emit engine anyway. Related: \`figma bundle\` also refuses this contract set outright — social-button's per-variant icon ref \`{platform}\` is read as a literal asset name by the bundle's icon collector (“icon asset(s) referenced but not in …: {platform}”).`,
    );
    lines.push('');
  }
  lines.push('## Totals');
  lines.push('');
  lines.push('| component | status | variants (orig → rt) | matched | diverged | loss (orig-only) | invented (rt-only) |');
  lines.push('|---|---|---|---|---|---|---|');
  for (const r of results) {
    if (r.status === 'diffed') {
      lines.push(
        `| ${r.component} | round trip closed | ${r.originalVariants} → ${r.roundTripVariants} | ${r.matched} | ${r.diverged!.length} | ${r.loss!.length} | ${r.invented!.length} |`,
      );
    } else {
      lines.push(`| ${r.component} | **${r.status}** | ${r.originalVariants} → — | — | — | — | — |`);
    }
  }
  lines.push('');
  lines.push(
    `**${totals.roundTripClosed}/${totals.components} round trips closed.** Across the closed ones: ${totals.matched} matched, ${totals.diverged} diverged, ${totals.loss} one-way loss, ${totals.invented} invented.`,
  );
  lines.push('');

  const blocked = results.filter((r) => r.status !== 'diffed');
  if (blocked.length > 0) {
    lines.push('## Round trips that did not close (named refusals)');
    lines.push('');
    for (const r of blocked) {
      lines.push(`- **${r.component}** (${r.status}${r.reasonTag ? `, class \`${r.reasonTag}\`` : ''}): ${r.reason}`);
    }
    lines.push('');
  }

  for (const r of diffed) {
    lines.push(`## ${r.component} — ${r.originalVariants} → ${r.roundTripVariants} variants`);
    lines.push('');
    lines.push(`matched ${r.matched} · diverged ${r.diverged!.length} · loss ${r.loss!.length} · invented ${r.invented!.length}`);
    lines.push('');
    for (const [title, facts] of [
      ['DIVERGED (value differs; original → round trip)', r.diverged!],
      ['LOSS (in the original, not the round trip)', r.loss!],
      ['INVENTED (in the round trip, not the original — must be zero or named)', r.invented!],
    ] as const) {
      if (facts.length === 0) continue;
      lines.push(`### ${title}`);
      lines.push('');
      for (const [tag, tagged] of groupByTag(facts)) {
        lines.push(`- class \`${tag}\` — ${tagged.length} fact(s):`);
        for (const c of collapse(tagged)) {
          lines.push(`  - ${c.line}${c.count > 1 ? `  (×${c.count} variants)` : `  (${tagged.find((f) => `${f.path || '(root)'} ▸ ${f.channel}: ${f.value}` === c.line)?.variant ?? ''})`}`);
        }
      }
      lines.push('');
    }
  }

  lines.push('## Known-limit classes referenced above');
  lines.push('');
  lines.push('- `boolean-axis-placeholder` — CLOSED by the return-leg fix: VARIANT-bound boolean props are variant axes now, and their `{prop}` minted-path placeholders substitute as the canonical value strings the mint spells (`true`/`false`). The tag remains for any residual surface.');
  lines.push('- `boolean-axis-drop` — CLOSED at the grid level by the same fix (a VARIANT-bound boolean prop emits a real figma axis). The tag remains for a contract-backed axis the emit surface still drops.');
  lines.push('- `single-variant-dep-collapse` — CLOSED on the parent side: a dependency whose every variant axis is single-valued emits standalone (no variant properties), and the parent now DROPS a binding the single form already guarantees — or refuses BY NAME at compile time when the bound value is not the sole value.');
  lines.push('- `cartesian-fill` — the emit enumerates the FULL axis cartesian (bool axes included); a curated canvas grid draws a subset, so the extra rows are round-trip-only BY CONSTRUCTION (e.g. the canvas treats Placeholder/Text as a 3-way exclusive content choice where the contract spells two independent booleans).');
  lines.push('- `dup-sibling-names` — the dump reuses ONE layer name for N siblings (eight "Avatar" instances), so their facts collapse onto one (variant ▸ path ▸ channel) key on the original side; the round trip names them uniquely and siblings 2..N have no dump-side key by construction.');
  lines.push('- `hug-vs-fixed` — a width/height/fillWidth fact the round trip carries at a node the canvas HUGGED: hug boxes carry no comparable box fact (the headless-measure exclusion), and the emit lowers the captured measure to a FIXED/FILL axis — the sizing-MODE disagreement is the named finding.');
  lines.push('- `declared-not-drawn` — a component property the round-trip instance exposes that the drawn instance never carried: contract-declared API the canvas lacks.');
  lines.push('- `mixed-stroke-weight` — figma spells per-side stroke weights as "mixed" and the dump omits the channel, so the round trip\'s uniform weight has no dump-side counterpart by construction (the stroke PAINT still compares).');
  lines.push('- `interaction-states` — State=… variant rows drawn on the canvas that the round trip renders differently (previews) or not at all (campaign ledger: interaction states).');
  lines.push('- `vector-glyph` — vector/svg internals (instancePrimaryFill probes, glyph geometry): the headless mock renders svg as empty frames; campaign ledger: vector glyphs / baked ink.');
  lines.push('- `url-image` — url()/IMAGE fills; the emitter ledgers them as gradientMiss BY DESIGN (expected).');
  lines.push('- `text-style-identity` — named text styles need the semantic token slot; a foreign tokenSet has none, so style identities (e.g. "Text sm/Semibold") ledger as loss while the raw typography (size/weight/line-height) still compares.');
  lines.push('- `restructured` — the same content (variant, channel, value) at a different part nesting: a wrapper the proposal introduced or removed. Ledgered on BOTH sides (loss + invented), never silently matched.');
  lines.push('- `headless-measure` — hug-sized boxes are excluded from width/height compare (the mock measures text by estimate); named exclusion, not a loss.');
  lines.push('');

  mkdirSync(HERE, { recursive: true });
  writeFileSync(path.join(HERE, 'REPORT.md'), lines.join('\n') + '\n');
  writeFileSync(
    path.join(HERE, 'report.json'),
    JSON.stringify({ generatedBy: 'extract/figma/roundtrip-uui/run.ts', totals, results }, null, 2) + '\n',
  );

  console.log(`round-trip diff: ${totals.roundTripClosed}/${totals.components} closed — matched ${totals.matched}, diverged ${totals.diverged}, loss ${totals.loss}, invented ${totals.invented}`);
  for (const r of blocked) console.log(`  ✘ ${r.component}: ${r.status} — ${(r.reason ?? '').slice(0, 120)}`);
  console.log(`wrote ${path.join('extract/figma/roundtrip-uui', 'REPORT.md')} + report.json`);
}

await main();
