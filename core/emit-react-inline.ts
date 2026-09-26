import {hasComponentGrow, hasComponentHostPlacement} from '../scripts/contract-schema.js';
import { lowerFilledPathVariants, lowerStrokedPathPaint, strokedPathSvg } from '../scripts/contract-schema.js';
import { reactInitialInput, reactInitialValue, validateReactInitialBindings } from './react-initial-value.js';
import { reactSelectionPlan } from './react-selection.js';
import { reactInitialAttributes } from './react-composition-initial.js';
import { svgIconViewport } from './svg-icon-viewport.js';
import { reactToggleAria } from './react-toggle-aria.js';
import { reactEventCallbackCall, reactEventCallbackType } from './react-event-callback.js';
import { hasCodeValues, codeValueUnion, codeValueLiteral, codeValueExpression, componentLookupExpression, mappedPropBinding, mappedPropPrelude, validateCodeValueConsumers } from './code-values.js';
/**
 * Contract → React with INLINE STYLES, token refs RESOLVED to literals — the
 * zero-infrastructure emitter for orgs without a token pipeline: no CSS
 * Modules, no custom properties, no stylesheet to include. Every color and
 * dimension is a literal resolved from the token source of truth at emit
 * time, so the output is copy-paste-runnable anywhere React runs.
 *
 * NOT wired into `npm run generate` — golden output is untouched. Receipts:
 * core/emitters-check.ts (npm run emitters:check) + core/samples/.
 *
 * Fidelity notes (deliberate, stated in every emitted file's header):
 *   · Resolution mode is named in the output (light default, dark selectable;
 *     brand: default) — an inline build is ONE theme by construction.
 *   · :hover / :focus-visible state tokens are not expressible as inline
 *     styles — omitted. ROOT disabled-state tokens DO apply, via the
 *     disabled prop. v13 PART-level state overrides (Part.states on non-ref
 *     parts — .root:disabled .label on the css/html surfaces) are pseudo-
 *     class-selected descendant styling: the same declared limit as the
 *     root hover states above — omitted, stated in the emitted header.
 *   · Animations (spinner/skeleton) ship as an embedded <style> keyframes
 *     block — the one thing inline style objects cannot carry.
 *   · a11y.minHitArea's non-visual ::before hit-target extension is a
 *     pseudo-element — not expressible inline; same declared limit as the
 *     hover/focus pseudo-classes above (the css/html emitters enforce it).
 *   · Composition imports sibling inline-emitted components ('./Dep').
 */
import { rootContentJsx, literalTextJsx } from './root-content.js';
import {
  TOKEN_CHANNELS,
  DEFAULT_FONT_STACK,
  borderStyleDecls,
  isNativeCheckablePart,
  pascal,
  resolveLayout,
  shapeCssDecls,
  slotsOf,
  tokensByPropEntries,
  walkAnatomy,
  type Contract,
  type Part,
} from '../scripts/contract-schema.js';
import { flattenTokens, makeResolveLiteral, type TokenTreeInput } from './tokens.js';
import {
  arrayProps,
  boolProps,
  enumProps,
  gridCellPlan,
  gridChildCrossAxisDecls,
  gridParentDecls,
  isArrayType,
  isEnum,
  isMultiRoot,
  namedSlots,
  namedTextProps,
  numberProps,
  rootElementsOf,
  textProps,
  topRoots,
  UA_MARGIN_ELEMENTS,
  validateContract,
  defaultFontFamilyParts,
  drawsStrokeRing,
  ELEMENT_META,
  holderDeclaresPosition,
  textBoxTokenRefusals,
  wholePixelTextBoxPlan,
  wholePixelTextTrackingDecls,
  needsWholePixelTextRun,
  WHOLE_PIXEL_TEXT_RUN_STYLE,
  nativeTextRenderingRoots,
  nativeTextRenderingLeafParts,
  NATIVE_TEXT_RENDERING_DECL,
} from './emit-react.js';
import { reactOmittedNote, reactPropsBase } from '../packages/core/src/prop-collision.js';
import { reactPartAttrList } from './react-attributes.js';
import { refuseRetainedRuntime } from '../packages/core/src/runtime-emission.js';

export interface EmitReactInlineCtx {
  /** Parsed DTCG trees — literals resolve through primitives + default brand
   *  + semantic + the selected mode. */
  tokens: TokenTreeInput;
  icons: Map<string, string>;
  contracts: Map<string, Contract>;
  /** Resolution mode for mode-scoped semantic tokens. Default: 'light'. */
  mode?: 'light' | 'dark';
}

export interface EmitReactInlineResult {
  tsx: string;
}

const ALIGN_CSS: Record<string, string> = {
  start: 'flex-start', center: 'center', end: 'flex-end', stretch: 'stretch', baseline: 'baseline',
};
const JUSTIFY_CSS: Record<string, string> = {
  start: 'flex-start', center: 'center', end: 'flex-end', 'space-between': 'space-between',
};
const OVERLAY_CSS: Record<string, Record<string, string | number>> = {
  top: { bottom: '100%', left: 0 },
  bottom: { top: '100%', left: 0 },
  start: { right: '100%', top: 0 },
  end: { left: '100%', top: 0 },
};

const stripBraces = (ref: string) => ref.slice(1, -1);
const placeholdersIn = (refPath: string): string[] =>
  [...refPath.matchAll(/\{([a-z][\w-]*)\}/g)].map((m) => m[1]);
const camel = (cssProp: string) => cssProp.startsWith('--') ? cssProp : cssProp.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
/** FC-BORDER-STYLE-NOT-SYNTHESISED — the shared border-style rule, lowered to
 *  this surface's camelCase StyleRecord. `borderStyleDecls` states the rule
 *  once (schema package) so the three CSS surfaces cannot fork on it again. */
const applyBorderStyle = (
  target: Record<string, unknown>,
  map: Record<string, string> | undefined,
  kind: 'literals' | 'tokens',
  declared?: Record<string, string>,
) => {
  for (const decl of borderStyleDecls(map, kind, declared)) {
    const i = decl.indexOf(': ');
    target[camel(decl.slice(0, i))] = decl.slice(i + 2);
  }
};

const isStructural = (part: Part) =>
  Boolean(part.parts || part.slot || part.layout || part.layoutByProp) &&
  !part.content &&
  !part.component;

type StyleRecord = Record<string, string | number>;

/** `strokesIncludedInLayout: false` ON THE INLINE SURFACE — the stroke is an
 *  inset box-shadow ring that takes no layout space (packages/core anatomy.ts
 *  lowerStrokeRings says why a ring and why not an outline). The stylesheet
 *  surfaces compose the ring from custom properties; this one cannot — a
 *  `--x` key is not a CSSProperties key, and its whole claim is resolved
 *  literals — so the SAME composition happens at render time, over the style
 *  object the base, per-variant and disabled records have already merged into:
 *  width, colour and a real shadow each arrive from their own record, and only
 *  the merge knows all three.
 *
 *  THE CONSUMER'S `style` IS PART OF THAT MERGE, NOT AFTER IT. Spread after the
 *  ring (the first cut) a consumer `boxShadow` silently DELETED the stroke and
 *  a consumer `borderColor` silently did nothing — on an unflagged part the
 *  same props replace the component's shadow and recolour its border. They are
 *  the same contract channels, so they are read as such: `borderColor` /
 *  `borderWidth` / a per-side width recolour and resize the RING, and
 *  `boxShadow` replaces the component's real shadow AFTER the ring, which
 *  stays. A consumer `border` SHORTHAND is passed through untouched: the merged
 *  record's own `border` is only ever the `0` / `none` reset, so a value there
 *  is the consumer asking for a real, space-taking border — their call.
 *
 *  `none` (a literal, or a shadow token RESOLVED to it — this surface sees
 *  values) is dropped rather than listed: `<ring>, none` is invalid CSS. A
 *  unitless `0` width becomes `0px`: `calc(-1 * 0)` is a number, not a length.
 *
 *  NAMED LIMIT — forced colors. The mode forces `box-shadow: none`, and an
 *  inline style cannot carry the `@media (forced-colors: active)` fallback the
 *  stylesheet surfaces emit (css.ts lowerStrokeRingForcedColors); the only
 *  media-dependent output this emitter has is the `<style>` it injects for
 *  keyframes, which is a child element a void root (`<input>`) cannot hold. A
 *  flagged part has NO boundary in Windows High Contrast on this surface.
 *
 *  Emitted only when a part is flagged. */
const STROKE_RING_RUNTIME = `/** strokesIncludedInLayout: false — this part's stroke takes no layout space, so it
 *  is painted as an inset ring (over the padding, following the radius) instead
 *  of a border; a real box-shadow is kept after it. A caller's borderColor /
 *  borderWidth restyle the ring and a caller's boxShadow follows it. */
const strokeRing = ({
  border, borderStyle: _style, borderTopStyle: _top, borderRightStyle: _right, borderBottomStyle: _bottom, borderLeftStyle: _left,
  borderWidth: w = 0, borderColor: c = 'currentColor',
  borderTopWidth: t = w, borderRightWidth: r = w, borderBottomWidth: b = w, borderLeftWidth: l = w,
  boxShadow, ...rest
}: CSSProperties): CSSProperties => {
  const px = (v: string | number) => (typeof v === 'number' || /^[-+]?0*\\.?0+$/.test(v) ? \`\${Number(v)}px\` : v);
  const ring = t === r && r === b && b === l
    ? [\`inset 0 0 0 \${px(t)} \${c}\`]
    : [\`inset 0 \${px(t)} 0 0 \${c}\`, \`inset 0 calc(-1 * \${px(b)}) 0 0 \${c}\`, \`inset \${px(l)} 0 0 0 \${c}\`, \`inset calc(-1 * \${px(r)}) 0 0 0 \${c}\`];
  return { ...rest, border: border ?? 0, boxShadow: [...ring, ...(boxShadow && boxShadow !== 'none' ? [boxShadow] : [])].join(', ') };
};

`;

export function emitReactInline(contract: Contract, ctx: EmitReactInlineCtx): EmitReactInlineResult {
  validateReactInitialBindings(contract);
  refuseRetainedRuntime(contract, 'react-inline', ctx.contracts);
  validateCodeValueConsumers(contract);
  const errors: string[] = [];
  validateContract(contract, ctx.contracts, errors, ctx.icons);
  // dump v1.36: a flagged part's letter-spacing TOKEN must resolve to a
  // length the whole-pixel box can subtract (anatomy.ts textBoxTokenRefusals).
  if (walkAnatomy(contract).some((w) => w.part.textAutoResize !== undefined)) errors.push(...textBoxTokenRefusals(contract, ctx.tokens));
  if (errors.length > 0) {
    throw new Error(`Refused — ${errors.length} contract violation(s):\n${errors.map((e) => `  - ${e}`).join('\n')}`);
  }

  contract = lowerStrokedPathPaint(lowerFilledPathVariants(contract));
  const mode = ctx.mode ?? 'light';
  const primitives = flattenTokens(ctx.tokens.primitives);
  const semantic = flattenTokens(ctx.tokens.semantic);
  const modeTree = flattenTokens(mode === 'dark' ? ctx.tokens.dark : ctx.tokens.light);
  const brandDefault = ctx.tokens.brands.default ? flattenTokens(ctx.tokens.brands.default) : new Map();
  const resolveLiteral = makeResolveLiteral(
    new Map([...primitives, ...brandDefault, ...semantic, ...modeTree]),
  );
  const resolveValue = (tokenPath: string): string | number => {
    const v = resolveLiteral(tokenPath);
    return typeof v === 'number' ? v : String(v);
  };
  const scalableOverrideRefs = (part: Part): Record<string,string> => {
    const root = part.component && ctx.contracts.get(part.component.id)?.anatomy.root;
    const paths = Object.values(root?.parts ?? {});
    if (!root || !paths.length || !paths.every(child=>child.shape?.kind==='path' && child.shape.parentViewport)) return {};
    return Object.fromEntries(Object.entries(part.component?.overrides ?? {}).filter(([channel]) =>
      root.overridable?.includes(channel) && (channel==='size' || channel==='color' && paths.length===1 && paths[0].literals?.['background-color']==='currentColor')));
  };
  const hasScalableOverrides = (part: Part) => Object.keys(scalableOverrideRefs(part)).length > 0;

  // A2 grid: the ONE compiled cell plan (core/emit-react.ts gridCellPlan).
  // This surface resolves token gaps to LITERALS (its whole claim) and
  // camelCases the shared canonical decl strings into style objects.
  const gridPlan = gridCellPlan(contract);
  const gridTokenRefCss = (refPath: string): string => {
    const v = resolveValue(refPath);
    return typeof v === 'number' ? `${v}px` : v;
  };
  const applyDeclStrings = (s: StyleRecord, decls: string[]): void => {
    for (const decl of decls) {
      const i = decl.indexOf(': ');
      s[camel(decl.slice(0, i))] = decl.slice(i + 2);
    }
  };
  const textBoxes = wholePixelTextBoxPlan(contract, (ref) => String(resolveValue(ref)));

  const name = contract.name;
  const selection = reactSelectionPlan(contract, ctx.contracts);
  const enums = enumProps(contract);
  const bools = boolProps(contract);
  const events = contract.events ?? [];
  const codePropOf = (propName: string) =>
    contract.props.find((p) => p.name === propName)?.bindings.code.prop ?? propName;
  const whenProvided = (propName: string, expression: string, absent = 'undefined') =>
    contract.props.find((p) => p.name === propName)?.default === undefined
      ? `${codePropOf(propName)} === undefined ? ${absent} : ${expression}`
      : expression;

  // -------------------------------------------------------------------------
  // Style compilation: base per part + per-enum-value overrides per part.
  // -------------------------------------------------------------------------
  const baseStyles: Record<string, StyleRecord> = {};
  const defaultFamily = defaultFontFamilyParts(contract);
  const nativeTextLeaves = nativeTextRenderingLeafParts(contract);
  const nativeTextLeafNames = new Set(walkAnatomy(contract).filter(entry => nativeTextLeaves.has(entry.part)).map(entry => entry.name));
  const nativeTextRendering = new Set([...nativeTextRenderingRoots(contract), ...nativeTextLeaves]);
  /** `${prop}-${value}` → partName → overrides. */
  const variantStyles: Record<string, Record<string, StyleRecord>> = {};
  const jointTables=contract.anatomy.root?.tokensByCombination??[];
  const jointStyles=jointTables.map(table=>Object.fromEntries(table.rows.map(row=>[
    JSON.stringify(row.values),Object.fromEntries(Object.entries(row.tokens).map(([channel,ref])=>
      [camel(channel),resolveValue(stripBraces(ref))]))
  ])));
  const jointConst=jointTables.length?`\nconst J: Array<Record<string, CSSProperties>> = ${JSON.stringify(jointStyles,null,2)};\n`:'';
  const placementTables = walkAnatomy(contract).filter(row => row.part.absolutePlacementByCombination)
    .map(row => ({name: row.name, table: row.part.absolutePlacementByCombination!}));
  const placementStyles = Object.fromEntries(placementTables.map(({name, table}) => [name,
    Object.fromEntries(table.rows.map(row => [JSON.stringify(row.values),
      {position: 'absolute', left: row.left, top: row.top, right: 'auto', bottom: 'auto'}]))]));
  const placementConst = placementTables.length ? `\nconst PL: Record<string, Record<string, CSSProperties>> = ${JSON.stringify(placementStyles,null,2)};\n` : '';
  const partVariantProps = new Map<string, Set<string>>();
  const addVariant = (prop: string, value: string, partName: string, decls: StyleRecord) => {
    const key = `${prop}-${value}`;
    variantStyles[key] ??= {};
    variantStyles[key][partName] = { ...(variantStyles[key][partName] ?? {}), ...decls };
    if (!partVariantProps.has(partName)) partVariantProps.set(partName, new Set());
    partVariantProps.get(partName)!.add(prop);
  };
  /** Multi-axis root tokens (two OR three placeholders — the three-axis
   *  form is live-gauntlet class ①'s minted f(type, style, state) root
   *  fill): overrides keyed by EVERY participating enum value (the runtime
   *  lookup consults `pa-va+pb-vb[+pc-vc]:part` after the single-axis keys,
   *  so the compound binding wins). */
  const variantPairStyles: Record<string, Record<string, StyleRecord>> = {};
  const partVariantPairProps = new Map<string, Set<string>>();
  const addVariantCompound = (
    pairs: Array<[prop: string, value: string]>, partName: string, decls: StyleRecord,
  ) => {
    const key = pairs.map(([p, v]) => `${p}-${v}`).join('+');
    variantPairStyles[key] ??= {};
    variantPairStyles[key][partName] = { ...(variantPairStyles[key][partName] ?? {}), ...decls };
    if (!partVariantPairProps.has(partName)) partVariantPairProps.set(partName, new Set());
    partVariantPairProps.get(partName)!.add(pairs.map(([p]) => p).join('+'));
  };
  const enumsByName = new Map(enums.map((p) => [p.name, p.type.enum]));
  // Bool-conditioned ROOT tokens (mint bool-axis carriage): a placeholder
  // may name a BOOLEAN prop — its runtime key stringifies naturally
  // (`V[`pressed-${pressed}:root`]` → 'pressed-true'/'pressed-false'), so
  // substitution expands over the two spelled sides.
  const substByName = new Map<string, readonly string[]>([
    ...enumsByName,
    ...bools.map((p) => [p.name, ['true', 'false']] as [string, readonly string[]]),
  ]);
  const usedAnimations = new Set<string>();
  /** Part names whose border is redrawn as a ring (STROKE_RING_RUNTIME). */
  const strokeRingParts = new Set<string>();

  /** Slot-wrapper floor predicate (live-gauntlet class ⑤) — see the root
   *  max-width handling below; shared with the tokensByProp per-value pass. */
  const slotWrapperFloorOf = (part: Part): boolean =>
    'max-width' in (part.tokens ?? {}) &&
    'height' in (part.tokens ?? {}) &&
    Object.keys(part.parts ?? {}).length > 0 &&
    Object.values(part.parts ?? {}).every((pp) => pp.slot !== undefined);

  const compilePart = (partName: string, part: Part, isRoot: boolean) => {
    // Contract dimensions are outer box dimensions, as on the CSS-module
    // and native surfaces. Do not depend on the consumer's global reset.
    const s: StyleRecord = { boxSizing: 'border-box' };
    if (drawsStrokeRing(part)) strokeRingParts.add(partName);
    // A2 grid (G2/G4): this part's cell under its grid parent — resolved
    // from the shared plan; sizing stays unspelled (stretch is the CSS grid
    // default, the pinned spelling of canvas FILL, G3).
    applyDeclStrings(s, gridPlan.cells.get(partName) ?? []);
    // G11/FC-SLOT-CROSS-AXIS-STRETCH — the grid-cell cross-axis default, spelled
    // on the INLINE surface too (it shipped on the CSS-Module path only, so a
    // preview rendered through this emitter still stretched a child down its
    // whole cell while the canvas left it at the top). One spelling, all three.
    if (gridPlan.gridChildren.has(partName)) {
      applyDeclStrings(s, gridChildCrossAxisDecls(part));
    }
    if (isRoot) {
      if (part.layout) {
        if (part.layout.display === 'grid') {
          // A2 grid (G1): tracks/gaps/areas/flow, token gaps as literals.
          applyDeclStrings(
            s,
            gridParentDecls(part.layout, gridTokenRefCss, `${contract.id}.anatomy.${partName}.layout.gap`),
          );
        } else {
          s.display = part.layout.display ?? 'flex';
          if (part.layout.direction) s.flexDirection = part.layout.direction;
          if (part.layout.wrap) s.flexWrap = 'wrap';
          if (part.layout.align) s.alignItems = ALIGN_CSS[part.layout.align];
          if (part.layout.justify) s.justifyContent = JUSTIFY_CSS[part.layout.justify];
        }
      } else {
        s.display = 'inline-flex';
        s.alignItems = 'center';
        s.justifyContent = 'center';
      }
      const rootTokens = part.tokens ?? {};
      // UA-margin neutralization (emit-react UA_MARGIN_ELEMENTS): the
      // component's box is contract-governed — h1-h6/p/hr/ul/… UA margins
      // never leak into the composing layout.
      if (rootElementsOf(contract).some((el) => UA_MARGIN_ELEMENTS.has(el))) s.margin = 0;
      // ROUND 9 — carry both or withhold both (emit-react's root rule, same
      // words): a border COLOUR with no width used to emit the style keyword
      // and let the UA's `medium` (3px) complete it. The keyword rides the
      // WIDTH. `outline-style` is deliberately NOT synthesised the same way —
      // see the long note in core/emit-react.ts; it is a DECLARED fact the
      // inversion carries, never one the emitter infers.
      // FC-BORDER-STYLE-NOT-SYNTHESISED: a LITERAL shorthand width earns the
      // keyword too, and a per-side literal width earns the per-side keyword —
      // assigned after the `border: 0` reset so the reset cannot erase it.
      if ('border-width' in rootTokens || 'border-width' in (part.literals ?? {})) {
        s.borderStyle = 'solid';
      } else s.border = 0;
      applyBorderStyle(s, part.literals, 'literals', part.declared);
      // Slot-wrapper floor (live-gauntlet class ⑤): a SLOT-ONLY root with
      // BOTH height and max-width is a drawn FIXED wrapper — an empty slot's
      // fit-content floor is 0, so the drawn box (the max-width value) is
      // the floor instead. Mirrors emit-html/emit-react generateCss; the
      // per-value maxWidth overrides mirror below in the tokensByProp pass.
      const slotWrapperFloor = slotWrapperFloorOf(part);
      if ('max-width' in rootTokens) {
        s.width = '100%';
        if (slotWrapperFloor) {
          const base = stripBraces(rootTokens['max-width']);
          if (placeholdersIn(base).length === 0) s.minWidth = resolveValue(base);
        } else {
          s.minWidth = 'fit-content';
        }
      }
      if (contract.semantics.element === 'button') s.cursor = 'pointer';
      // A declared holder is the positioning context — mirrors emit-react
      // (FC-DUMP-PROPOSE-THUMB-HOLDER-RELATIVE).
      if (
        walkAnatomy(contract).some(
          (w) =>
            (w.part.overlay || (w.part.stylesWhen ?? []).some((sw) => sw.styles['position'] === 'absolute')) &&
            !holderDeclaresPosition(contract, w.path),
        )
      ) {
        s.position = 'relative';
      }
    } else {
      // Match the CSS-module surface: intrinsic heading/list/paragraph
      // margins cannot move contract-owned parts. Authored margins below
      // override this baseline.
      if (part.element && UA_MARGIN_ELEMENTS.has(part.element)) s.margin = 0;
      if (isStructural(part)) {
        if (part.layout?.display === 'grid') {
          // A2 grid (G1): a nested grid parent — tracks/gaps/areas/flow.
          applyDeclStrings(
            s,
            gridParentDecls(part.layout, gridTokenRefCss, `${contract.id}.anatomy.${partName}.layout.gap`),
          );
        } else {
          s.display = part.layout?.display ?? 'flex';
          if (part.layout?.direction) s.flexDirection = part.layout.direction;
          if (part.layout?.wrap) s.flexWrap = 'wrap';
          if (part.layout?.align) s.alignItems = ALIGN_CSS[part.layout.align];
          if (part.layout?.justify) s.justifyContent = JUSTIFY_CSS[part.layout.justify];
        }
      }
      if (part.layout?.grow) { s.flex = part.layout.growBasis === 'zero' ? '1 1 0px' : '1 1 auto'; s.minWidth = 0; if (part.layout.growBasis === 'zero') s.minHeight = 0; }
      if (part.overlay) Object.assign(s, { position: 'absolute' }, OVERLAY_CSS[part.overlay.placement]);
      // v9 shape: the shared projection, camelCased for style objects.
      if (part.shape) {
        for (const decl of shapeCssDecls(part.shape)) {
          const i = decl.indexOf(': ');
          s[camel(decl.slice(0, i))] = decl.slice(i + 2);
        }
      }
      if (part.element === 'button' && events.some((e) => e.trigger === partName)) {
        Object.assign(s, {
          appearance: 'none', background: 'none', border: 'none', margin: 0, padding: 0,
          font: 'inherit', color: 'inherit', textAlign: 'inherit', cursor: 'pointer',
        });
      }
      // Native checkable inputs cover their presentational box invisibly —
      // mirrors emit-react generateCss. (The :has focus ring is a pseudo-
      // class, outside inline styles — the same declared limit as
      // hover/active here.)
      if (isNativeCheckablePart(part)) {
        Object.assign(s, {
          position: 'absolute', inset: 0, width: '100%', height: '100%',
          margin: 0, padding: 0, opacity: 0, cursor: 'pointer',
        });
      }
      if (Object.values(part.parts ?? {}).some((child) => isNativeCheckablePart(child))) {
        s.position = 'relative';
      }
      if (part.icon) {
        s.display = 'inline-flex';
        s.flexShrink = 0;
        if (part.element === 'button') {
          Object.assign(s, {
            alignItems: 'center', justifyContent: 'center', background: 'none',
            border: 'none', padding: 0, color: 'inherit', cursor: 'pointer',
          });
        }
      }
      if (part.animation) {
        s.animation = part.animation === 'spin'
          ? `ds-inline-spin 0.8s linear infinite`
          : `ds-inline-pulse 1.6s ease-in-out infinite`;
        usedAnimations.add(part.animation);
      }
      if (
        (part.tokens && 'border-width' in part.tokens) ||
        (part.literals && 'border-width' in part.literals)
      ) {
        s.borderStyle = 'solid';
      }
      applyBorderStyle(s, part.literals, 'literals', part.declared);
    }
    for (const [cssProp, ref] of Object.entries(part.tokens ?? {})) {
      const refPath = stripBraces(ref);
      if (cssProp === 'gap' && part.layout?.overlap) continue; // negative child margins — see note below
      const phs = placeholdersIn(refPath);
      const selectedStyle = (resolved: string): StyleRecord => {
        const value = resolveValue(resolved);
        const style: StyleRecord = { [camel(cssProp)]: value };
        applyDeclStrings(style, wholePixelTextTrackingDecls(part, cssProp, String(value)));
        return style;
      };
      if (phs.length === 0) {
        s[camel(cssProp)] = resolveValue(refPath);
      } else if (phs.length === 1) {
        for (const value of substByName.get(phs[0]) ?? []) {
          const resolved = refPath.replaceAll(`{${phs[0]}}`, value);
          addVariant(phs[0], value, partName, selectedStyle(resolved));
        }
      } else if (phs.length === 2) {
        const [pa, pb] = phs;
        for (const a of substByName.get(pa) ?? []) {
          for (const b of substByName.get(pb) ?? []) {
            const resolved = refPath.replaceAll(`{${pa}}`, a).replaceAll(`{${pb}}`, b);
            addVariantCompound([[pa, a], [pb, b]], partName, selectedStyle(resolved));
          }
        }
      } else if (phs.length === 3) {
        // Three-axis root token — mirrors the emit-react/emit-html triple
        // compound (live-gauntlet class ①).
        const [pa, pb, pc] = phs;
        for (const a of substByName.get(pa) ?? []) {
          for (const b of substByName.get(pb) ?? []) {
            for (const c of substByName.get(pc) ?? []) {
              const resolved = refPath
                .replaceAll(`{${pa}}`, a)
                .replaceAll(`{${pb}}`, b)
                .replaceAll(`{${pc}}`, c);
              addVariantCompound([[pa, a], [pb, b], [pc, c]], partName, selectedStyle(resolved));
            }
          }
        }
      }
    }
    // v10 tokensByProp: per-enum-value token overrides merged over the base
    // (resolved to literals like every other token here).
    // v14: multiple entries in order — later entries' variant styles are
    // added later and win per channel (Object.assign merge order downstream).
    for (const entry of tokensByPropEntries(part)) {
      for (const [value, overrides] of Object.entries(entry.map)) {
        const decls: StyleRecord = {};
        for (const [cssProp, ref] of Object.entries(overrides)) {
          const refPath = stripBraces(ref), placeholders = placeholdersIn(refPath);
          // A per-value map may retain one OTHER enum placeholder. This is
          // how the shared compiler carries a coupled axis with omission.
          if (placeholders.length === 1) {
            const other = placeholders[0];
            for (const otherValue of substByName.get(other) ?? []) {
              const resolved = resolveValue(refPath.replaceAll(`{${other}}`, otherValue));
              const compound: StyleRecord = { [camel(cssProp)]: resolved };
              if (isRoot && cssProp === 'max-width' && slotWrapperFloorOf(part)) compound.minWidth = resolved;
              applyBorderStyle(compound, { [cssProp]: ref }, 'tokens', part.declared);
              addVariantCompound([[entry.prop, value], [other, otherValue]], partName, compound);
            }
          } else {
            decls[camel(cssProp)] = resolveValue(refPath);
            if (isRoot && cssProp === 'max-width' && slotWrapperFloorOf(part)) {
              decls.minWidth = resolveValue(refPath);
            }
          }
        }
        applyBorderStyle(decls, overrides, 'tokens', part.declared);
        addVariant(entry.prop, value, partName, decls);
      }
    }
    // v14 literals: base literal channels + per-value overrides — already
    // literal values, no token resolution.
    for (const [cssProp, lit] of Object.entries(part.literals ?? {})) {
      s[camel(cssProp)] = lit;
    }
    for (const entry of part.literalsByProp ?? []) {
      for (const [value, overrides] of Object.entries(entry.map)) {
        const decls: StyleRecord = {};
        for (const [cssProp, lit] of Object.entries(overrides)) {
          decls[camel(cssProp)] = lit;
        }
        applyBorderStyle(decls, overrides, 'literals', part.declared);
        addVariant(entry.prop, value, partName, decls);
      }
    }
    // v15 declared facts: verbatim keyword/literal channels (registry-
    // validated in validateContract). Assigned AFTER the emitter chrome so a
    // declared cursor/position fact wins over the built-in conventions —
    // mirrors the generateCss interplay rule. Per-state declared facts:
    // only the disabled plane renders on this surface (see disabledStyle
    // below) — hover/active/focus stay the surface's declared limit.
    for (const [cssProp, value] of Object.entries(part.declared ?? {})) {
      s[camel(cssProp)] = value;
    }
    // No declared family = the pipeline default (defaultFontFamilyParts) —
    // an inline style inherits the host page's font exactly as a class does.
    if (defaultFamily.has(part)) s.fontFamily = DEFAULT_FONT_STACK;
    if (nativeTextRendering.has(part)) applyDeclStrings(s, [NATIVE_TEXT_RENDERING_DECL]);
    // dump v1.36: the whole-pixel text box — the same declarations the
    // stylesheet surfaces write (anatomy.ts wholePixelTextBoxDecls), a token
    // resolved to its literal. An inline style is set through the CSSOM,
    // where an unsupported value is ignored, and a server-rendered `style`
    // attribute is parsed like a sheet, where it is dropped: either way a
    // browser without calc-size() keeps today's box, so no @supports guard
    // is needed and none could be spelled here.
    applyDeclStrings(s, textBoxes.get(part) ?? []);
    // layoutByProp: per-enum-value layout overrides merged over the base.
    if (part.layoutByProp) {
      for (const [value, _override] of Object.entries(part.layoutByProp.map)) {
        const merged = resolveLayout(part, { [part.layoutByProp.prop]: value });
        const decls: StyleRecord = {};
        if (merged?.display) decls.display = merged.display;
        if (merged?.direction) decls.flexDirection = merged.direction;
        if (merged?.align) decls.alignItems = ALIGN_CSS[merged.align];
        if (merged?.justify) decls.justifyContent = JUSTIFY_CSS[merged.justify];
        if (merged?.grow !== undefined) { decls.flex = merged.grow ? (merged.growBasis === 'zero' ? '1 1 0px' : '1 1 auto') : '0 1 auto'; decls.minWidth = merged.grow ? 0 : 'auto'; if (merged.growBasis === 'zero') decls.minHeight = merged.grow ? 0 : 'auto'; }
        addVariant(part.layoutByProp.prop, value, partName, decls);
      }
    }
    baseStyles[partName] = s;
  };

  for (const { name: partName, part, path: p } of walkAnatomy(contract)) {
    if (part.component) {
      if (part.absolutePlacement) baseStyles[partName] = {position: 'absolute', left: part.absolutePlacement.left,
        top: part.absolutePlacement.top, right: 'auto', bottom: 'auto'};
      if (hasComponentGrow(part)) {
        baseStyles[partName] = part.layout?.grow === undefined ? {} : {flex: part.layout.grow ? (part.layout.growBasis === 'zero' ? '1 1 0px' : '1 1 auto') : '0 1 auto', minWidth: part.layout.grow ? 0 : 'auto', ...(part.layout.growBasis === 'zero' ? {minHeight: part.layout.grow ? 0 : 'auto'} : {})};
        for (const [value, override] of Object.entries(part.layoutByProp?.map ?? {})) if (override.grow !== undefined)
          addVariant(part.layoutByProp!.prop, value, partName, {flex: override.grow ? ((override.growBasis ?? part.layout?.growBasis) === 'zero' ? '1 1 0px' : '1 1 auto') : '0 1 auto', minWidth: override.grow ? 0 : 'auto', ...((override.growBasis ?? part.layout?.growBasis) === 'zero' ? {minHeight: override.grow ? 0 : 'auto'} : {})});
      }
      for (const [channel,ref] of Object.entries(scalableOverrideRefs(part))) {
        const path = stripBraces(ref), axes = placeholdersIn(path);
        const values = (resolved: string): StyleRecord => channel==='size'
          ? {width:resolveValue(resolved),height:resolveValue(resolved)} : {color:resolveValue(resolved)};
        if (!axes.length) baseStyles[partName] = {...baseStyles[partName],...values(path)};
        else {
          const expand = (i: number, resolved: string, selection: [string,string][]) => {
            if (i === axes.length) { addVariantCompound(selection,partName,values(resolved)); return; }
            for (const value of substByName.get(axes[i]) ?? []) expand(i+1,resolved.replaceAll(`{${axes[i]}}`,value),[...selection,[axes[i],value]]);
          };
          expand(0,path,[]);
        }
      }
      continue;
    }
    // A top-level root (path.length === 1) is compiled as a root — single-root:
    // the sole "root"; multi-root: each of dialog/backdrop/… (each gets the
    // root layout treatment). Byte-identical for single-root.
    compilePart(partName, part, p.length === 1);
  }
  // A2 grid: style entries the anatomy walk cannot produce — EMPTY areas'
  // placeholder elements (G4's dual-slot convention: the placement is
  // visible with nothing in it) and the wrapper an instance cell rides
  // (display: grid stretches the lone instance into the cell — the CSS
  // spelling of canvas FILL, G3/P12).
  for (const areas of gridPlan.placeholders.values()) {
    for (const area of areas) baseStyles[area] = { gridArea: area };
  }
  for (const wrapped of gridPlan.wrappedInstances) {
    const s: StyleRecord = {};
    applyDeclStrings(s, gridPlan.cells.get(wrapped) ?? []);
    s.display = 'grid';
    baseStyles[wrapped] = s;
  }

  // Disabled-state tokens apply via the disabled prop (the one interaction
  // state a static style CAN honestly render). Non-substituted decls only.
  const disabledStyle: StyleRecord = {};
  // A SUBSTITUTED root disabled-state ref (f(variant) / f(bool)) is not a
  // static object — DISABLED_STYLE is one record — so it is NAMED in the
  // emitted header rather than dropped (the css/html/web-components surfaces
  // expand it per value tuple).
  const disabledSubstOmitted: string[] = [];
  if (bools.some((p) => p.name === 'disabled')) {
    for (const [cssProp, ref] of Object.entries(contract.anatomy.root?.states?.disabled ?? {})) {
      const refPath = stripBraces(ref);
      if (cssProp.startsWith('outline')) continue;
      if (placeholdersIn(refPath).length > 0) {
        disabledSubstOmitted.push(`${cssProp} ${ref}`);
        continue;
      }
      disabledStyle[camel(cssProp)] = resolveValue(refPath);
    }
    // v15: root disabled-plane declared facts render the same way (already
    // literal values — no resolution).
    for (const [cssProp, value] of Object.entries(
      contract.anatomy.root?.declaredStates?.disabled ?? {},
    )) {
      if (!cssProp.startsWith('outline')) disabledStyle[camel(cssProp)] = value;
    }
  }

  // -------------------------------------------------------------------------
  // Props interface + destructuring (same API surface as the CSS-Module emitter)
  // -------------------------------------------------------------------------
  const elementByProp = contract.semantics.elementByProp;
  const meta = elementByProp
    ? { attrs: 'HTMLAttributes', el: 'HTMLElement', supportsDisabled: false }
    : ELEMENT_META[contract.semantics.element];
  const slots = namedSlots(contract);
  const texts = namedTextProps(contract);
  // PROP-NAME COLLISIONS — the same rule as the CSS-Module emitter
  // (packages/core/src/prop-collision.ts): colliding DOM attrs are OMITTED from the base
  // attrs type and named in the header. Byte-identical when nothing collides.
  const { base: propsBase, omitted: omittedAttrs } = reactPropsBase(contract, meta);
  const omittedNote = reactOmittedNote(omittedAttrs, meta);
  const callerStyleAvailable = !omittedAttrs.includes('style');
  const toggledCodeProps = new Set(events.filter((e) => e.toggles).map((e) => codePropOf(e.toggles!.prop)));
  if (selection) toggledCodeProps.add(selection.code);

  const propLines: string[] = [];
  for (const p of contract.props) {
    const doc = p.description ? `  /** ${p.description} */\n` : '';
    if (isEnum(p)) {
      propLines.push(`${doc}  ${p.bindings.code.prop}${hasCodeValues(p) && p.required ? '' : '?'}: ${hasCodeValues(p) || p.name === contract.selection?.valueProp ? codeValueUnion(p) : p.type.enum.map((v) => `'${v}'`).join(' | ')};`);
    } else if (isArrayType(p)) {
      const fields = Object.entries(p.type.arrayOf)
        .map(([f, t]) => `${selection?.item.repeat?.itemsProp === p.name ? JSON.stringify(f) : f}: ${typeof t === 'object' ? t.enum.map(value => JSON.stringify(value)).join(' | ') : t === 'text' ? 'string' : t}`)
        .join('; ');
      propLines.push(`${doc}  ${p.bindings.code.prop}?: Array<{ ${fields} }>;`);
    } else if (p.type === 'boolean') {
      propLines.push(`${doc}  ${p.bindings.code.prop}?: boolean;`);
    } else if (p.type === 'number') {
      propLines.push(`${doc}  ${p.bindings.code.prop}?: number;`);
    } else if (p.bindings.code.prop !== 'children') {
      propLines.push(`${doc}  ${p.bindings.code.prop}${p.required ? '' : '?'}: string;`);
    }
  }
  for (const p of contract.props.filter(p => p.bindings.code.initial)) {
    propLines.push(`  /** Initial value, read only on mount when uncontrolled. */\n  ${p.bindings.code.initial!.prop}?: ${codeValueUnion(p)};`);
  }
  for (const { slot, part } of slots) {
    const doc = part.description ? `  /** ${part.description} */\n` : '';
    propLines.push(`${doc}  ${slot.name}?: ReactNode;`);
  }
  for (const ev of events) {
    const doc = ev.description ?? `Fires when the ${ev.trigger} is activated.`;
    propLines.push(`  /** ${doc} */\n  ${ev.bindings.code.prop}?: ${reactEventCallbackType(contract, ev)};`);
  }

  const destructured: string[] = [];
  if (selection) { propLines.push(selection.propLine); destructured.push(selection.callback); }
  for (const p of enums) {
    destructured.push(
      hasCodeValues(p) ? mappedPropBinding(p, contract.props.indexOf(p), toggledCodeProps.has(p.bindings.code.prop)) : toggledCodeProps.has(p.bindings.code.prop)
        ? `${p.bindings.code.prop}: ${p.bindings.code.prop}Prop`
        : p.default === undefined ? p.bindings.code.prop : `${p.bindings.code.prop} = '${p.default}'`,
    );
  }
  for (const p of bools) destructured.push(p.default === undefined ? p.bindings.code.prop : `${p.bindings.code.prop} = ${p.default === true}`);
  for (const p of numberProps(contract)) {
    destructured.push(p.default === undefined ? p.bindings.code.prop : `${p.bindings.code.prop} = ${p.default}`);
  }
  for (const p of texts) {
    destructured.push(
      p.required || p.default === undefined
        ? p.bindings.code.prop
        : `${p.bindings.code.prop} = '${p.default}'`,
    );
  }
  for (const p of arrayProps(contract)) destructured.push(p.bindings.code.prop);
  for (const p of contract.props.filter(p => p.bindings.code.initial))
    destructured.push(`${p.bindings.code.initial!.prop}: ${reactInitialInput(contract,p)}`);
  for (const { slot } of slots) destructured.push(slot.name);
  for (const ev of events) destructured.push(ev.bindings.code.prop);
  if (callerStyleAvailable) destructured.push('style');
  destructured.push('children', '...rest');

  // Uncontrolled toggles + handlers — identical pattern to the CSS-Module emitter.
  const prelude: string[] = mappedPropPrelude(contract);
  if (selection) prelude.push(...selection.prelude);
  for (const ev of events) {
    if (!ev.toggles) continue;
    const prop = contract.props.find((p) => p.name === ev.toggles!.prop)!;
    const code = prop.bindings.code.prop;
    const union = (prop.type as { enum: string[] }).enum.map((v) => `'${v}'`).join(' | ');
    prelude.push(
      `  const [${code}Uncontrolled, set${pascal(code)}Uncontrolled] = useState<${union}${prop.default === undefined && prop.bindings.code.initial?.default === undefined ? ' | undefined' : ''}>(${reactInitialValue(contract,prop)});`,
      `  const ${code} = ${code}Prop ?? ${code}Uncontrolled;`,
    );
  }
  for (const ev of events) {
    const body: string[] = [];
    if (ev.toggles) {
      const prop = contract.props.find((p) => p.name === ev.toggles!.prop)!;
      const code = prop.bindings.code.prop;
      const [off, on] = ev.toggles.between;
      body.push(`${prop.bindings.code.initial ? `if (${code}Prop === undefined) ` : ''}set${pascal(code)}Uncontrolled(${code} === '${on}' ? '${off}' : '${on}');`);
    }
    body.push(reactEventCallbackCall(contract, ev));
    prelude.push(`  const handle${pascal(ev.name)} = () => { ${body.join(' ')} };`);
  }

  const eventAttrsFor = (partName: string, part: Part | undefined, partEl: string): string => {
    const ev = events.find((e) => e.trigger === partName);
    if (!ev) return '';
    // Native checkable trigger: checked + onChange, out-of-pair values set
    // the DOM property via a callback ref — mirrors emit-react generateTsx.
    if (part && isNativeCheckablePart(part)) {
      let s = '';
      if (ev.toggles) {
        const prop = contract.props.find((p) => p.name === ev.toggles!.prop)!;
        const code = prop.bindings.code.prop;
        const [off, on] = ev.toggles.between;
        const others = (prop.type as { enum: string[] }).enum.filter((v) => v !== off && v !== on);
        s += ` checked={${code} === '${on}'}`;
        if (others.length > 0) {
          const cond = others.map((v) => `${code} === '${v}'`).join(' || ');
          s += ` ref={(el) => { if (el) el.indeterminate = ${cond}; }}`;
        }
      }
      s += ` onChange={handle${pascal(ev.name)}}`;
      return s;
    }
    let s = partEl === 'button' ? ' type="button"' : '';
    s += ` onClick={handle${pascal(ev.name)}}`;
    s += reactToggleAria(contract, ev);
    return s;
  };

  // -------------------------------------------------------------------------
  // JSX — style={} expressions instead of className
  // -------------------------------------------------------------------------
  /** Which enum props override styles for a part (so lookups are only
   *  emitted where a variant actually changes something). */
  const variantPropsFor = (partName: string): string[] => [...(partVariantProps.get(partName) ?? [])];

  const styleExpr = (partName: string, isRoot: boolean, extra: string[] = []): string => {
    // Promoted anatomies carry hyphenated part names ("label-2") — dot access
    // parses as subtraction (the emit-react hyphenated-part-name defect,
    // examples/ci/VALIDATION.md). Non-identifier names use bracket access;
    // the S object's keys are JSON.stringify-quoted either way.
    const sRef = /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(partName)
      ? `S.${partName}`
      : `S[${JSON.stringify(partName)}]`;
    const pieces = [`...${sRef}`];
    for (const propName of variantPropsFor(partName)) {
      pieces.push(`...(${whenProvided(propName, `V[\`${propName}-\${${codePropOf(propName)}}:${partName}\`] ?? {}`, '{}')})`);
    }
    for (const pair of partVariantPairProps.get(partName) ?? []) {
      const props = pair.split('+');
      const key = props.map((p) => `${p}-\${${codePropOf(p)}}`).join('+');
      const expression = props.reduceRight((expr, prop) => whenProvided(prop, expr, '{}'), `V[\`${key}:${partName}\`] ?? {}`);
      pieces.push(`...(${expression})`);
    }
    if(isRoot)for(const [index,table] of jointTables.entries()){
      const values=table.props.map(prop=>`${codePropOf(prop)} === undefined ? null : ${codePropOf(prop)}`).join(', ');
      pieces.push(`...(J[${index}][JSON.stringify([${values}])] ?? {})`);
    }
    const placement = placementTables.find(row => row.name === partName);
    if (placement) {
      const values = placement.table.props.map(prop => `${codePropOf(prop)} === undefined ? null : String(${codePropOf(prop)})`).join(', ');
      pieces.push(`...PL[${JSON.stringify(partName)}][JSON.stringify([${values}])]`);
    }
    pieces.push(...extra);
    const selectionPart = selection && walkAnatomy(contract).find(row => row.name === partName)?.part;
    if (selectionPart && selection?.style(selectionPart)) pieces.push(selection.style(selectionPart)!);
    if (isRoot && Object.keys(disabledStyle).length > 0) {
      pieces.push(`...(${codePropOf('disabled')} ? DISABLED_STYLE : {})`);
    }
    if (isRoot && callerStyleAvailable) pieces.push('...style');
    if (!isRoot && callerStyleAvailable && nativeTextLeafNames.has(partName))
      pieces.push("...(style?.textRendering ? { textRendering: style.textRendering } : {})");
    // A flagged part's merged record — the consumer's `style` included, so
    // their border/shadow props land on the ring — is redrawn as a ring
    // (STROKE_RING_RUNTIME).
    if (strokeRingParts.has(partName)) return `{strokeRing({ ${pieces.join(', ')} })}`;
    return `{{ ${pieces.join(', ')} }}`;
  };

  const stylesWhenExprs = (part: Part): string[] => {
    const out: string[] = [];
    for (const sw of part.stylesWhen ?? []) {
      const prop = contract.props.find((pr) => pr.name === sw.prop);
      if (!prop) continue;
      const styles = Object.fromEntries(Object.entries(sw.styles).map(([kk, v]) => [camel(kk), v]));
      const cond = isEnum(prop)
        ? `${codePropOf(sw.prop)} === '${sw.equals}'`
        : codePropOf(sw.prop);
      out.push(`...(${cond} ? ${JSON.stringify(styles)} : {})`);
    }
    return out;
  };

  const wrapVisibleWhen = (part: Part, jsx: string): string => {
    const panel = selection?.wrap(part, jsx);
    if (panel !== undefined) return panel;
    if (!part.visibleWhen) return jsx;
    const codeName = codePropOf(part.visibleWhen.prop);
    const eq = part.visibleWhen.equals;
    const cond =
      eq === undefined
        ? codeName
        : Array.isArray(eq)
          ? eq.map((v) => `${codeName} === '${v}'`).join(' || ')
          : `${codeName} === '${eq}'`;
    return `{${cond} ? (${jsx}) : null}`;
  };

  // Root and nested attrs share typed native/ARIA projection with the CSS-module emitter.
  const partAttrList = (part: Part): string[] =>
    reactPartAttrList(contract, part, codePropOf);
  const partAttrString = (part: Part): string => partAttrList(part).map((a) => ` ${a}`).join('') + (selection?.attrs(part, true) ?? '');

  // Icon assets (fixed names + enum expansions), same table as the CSS-Module emitter.
  const neededIcons = new Map<string, string>();
  const sizedIcons = new Map<number, Map<string, string>>();
  for (const { part } of walkAnatomy(contract)) {
    if (!part.icon) continue;
    const m = part.icon.asset.match(/^\{([a-z][\w-]*)\}$/);
    if (m && !part.icon.size) {
      const enumProp = contract.props.find((p) => p.name === m[1]);
      if (enumProp && isEnum(enumProp)) {
        for (const v of enumProp.type.enum) neededIcons.set(v, ctx.icons.get(v) ?? '');
      }
    } else if (!part.icon.size) {
      neededIcons.set(part.icon.asset, ctx.icons.get(part.icon.asset) ?? '');
    }
    if (part.icon.size) {
      const assets = m ? contract.props.find(p => p.name === m[1]) : undefined;
      const keys = m ? (assets && isEnum(assets) ? assets.type.enum : []) : [part.icon.asset];
      const table = sizedIcons.get(part.icon.size) ?? new Map<string, string>();
      for (const key of keys) table.set(key, svgIconViewport(ctx.icons.get(key) ?? '', part.icon.size));
      sizedIcons.set(part.icon.size, table);
    }
  }

  const deps = [
    ...new Set(
      walkAnatomy(contract)
        .filter((w) => w.part.component)
        .map((w) => ctx.contracts.get(w.part.component!.id)!.name),
    ),
  ];

  const depAttrString = (dep: Contract, fixedProps: Record<string, string | boolean | { prop: string; map: Record<string, string> }>): string => {
    const parts: string[] = [];
    for (const [propName, value] of Object.entries(fixedProps)) {
      const depProp = dep.props.find((p) => p.name === propName);
      const codeName = depProp?.bindings.code.prop ?? propName;
      if (typeof value === 'object') {
        // PropByProp lookup (see emit-react depAttrString).
        const parentProp = contract.props.find((p) => p.name === value.prop);
        const expr = parentProp?.bindings.code.prop ?? value.prop;
        parts.push(` ${codeName}={${componentLookupExpression(depProp, expr, value.map)}}`);
        continue;
      }
      if (typeof value === 'boolean') {
        // Applied false must override a true-defaulting dependency prop —
        // omission only when omission already means false (see emit-react
        // depAttrString).
        parts.push(value ? ` ${codeName}` : depProp?.default === false ? '' : ` ${codeName}={false}`);
        continue;
      }
      const parentRef = value.match(/^\{([a-z][\w-]*)\}$/);
      if (depProp?.type === 'boolean' && !parentRef) {
        const spelled = value.trim().toLowerCase();
        if (spelled === 'true' || spelled === 'false') {
          const coerced = spelled === 'true';
          parts.push(coerced ? ` ${codeName}` : depProp.default === false ? '' : ` ${codeName}={false}`);
          continue;
        }
        throw new Error(
          `${dep.id}: applied value ${JSON.stringify(value)} for prop "${propName}" is a string but the dependency types it boolean — coerce at composition ('False' → false), never pass the spelling through`,
        );
      }
      if (parentRef) {
        const parentProp = contract.props.find((p) => p.name === parentRef[1]);
        parts.push(` ${codeName}={${codeValueExpression(depProp, parentProp?.bindings.code.prop ?? parentRef[1])}}`);
      } else {
        parts.push(depProp && hasCodeValues(depProp) ? ` ${codeName}={${codeValueLiteral(depProp,value)}}` : ` ${codeName}="${value}"`);
      }
    }
    return parts.join('');
  };

  const emptyRun = (part: Part, text: string) => needsWholePixelTextRun(part)
    ? [`...((${text}) == null || (${text}) === '' ? { inlineSize: 0 } : {})`] : [];
  const textRun = (part: Part, content: string) => needsWholePixelTextRun(part)
    ? `<span style={${JSON.stringify(WHOLE_PIXEL_TEXT_RUN_STYLE)}}>${content}</span>` : content;
  const renderPart = (partName: string, part: Part): string => {
    if (part.shape?.kind === 'stroked-path') return wrapVisibleWhen(part,
      `<span style=${styleExpr(partName, false, stylesWhenExprs(part))} aria-hidden="true" dangerouslySetInnerHTML={{ __html: ${JSON.stringify(strokedPathSvg(part.shape))} }} />`);
    if (part.icon) {
      const ref = part.icon.asset.match(/^\{([a-z][\w-]*)\}$/);
      const keyExpr = ref ? codePropOf(ref[1]) : JSON.stringify(part.icon.asset);
      const table = part.icon.size ? `SIZED_ICONS[${part.icon.size}]` : 'ICONS';
      const glyph = `dangerouslySetInnerHTML={{ __html: ${ref ? whenProvided(ref[1], `${table}[${keyExpr}]`, "''") : `${table}[${keyExpr}]`} }}`;
      const node = part.element
        ? `<${part.element} style=${styleExpr(partName, false, stylesWhenExprs(part))}${partAttrString(part)}${eventAttrsFor(partName, part, part.element)}><span aria-hidden="true" style={{ display: 'inline-flex' }} ${glyph} /></${part.element}>`
        : `<span style=${styleExpr(partName, false, stylesWhenExprs(part))} aria-hidden="true" ${glyph} />`;
      return wrapVisibleWhen(part, node);
    }
    if (part.repeat && part.component) {
      if (selection?.item === part) {
        const dep = ctx.contracts.get(part.component.id)!;
        const rp = contract.props.find(p => p.name === part.repeat!.itemsProp)!;
        let childrenField: string | undefined;
        const fieldAttrs = Object.keys((rp.type as { arrayOf: Record<string, unknown> }).arrayOf)
          .filter(field => field !== part.repeat!.keyField)
          .map(field => {
            const prop = dep.props.find(p => p.name === field)!;
            if (prop.bindings.code.prop === 'children') { childrenField = field; return ''; }
            return ` ${prop.bindings.code.prop}={${codeValueExpression(prop, `__dscItem[${JSON.stringify(field)}]`)}}`;
          }).join('');
        const attrs = depAttrString(dep, part.component.props ?? {}) + fieldAttrs + selection.itemAttrs + (hasComponentHostPlacement(part) || hasScalableOverrides(part) ? ` style=${styleExpr(partName, false, [])}` : '');
        const key = `__dscItem[${JSON.stringify(part.repeat.keyField)}]`;
        const node = childrenField ? `<${dep.name} key={${key}}${attrs}>{__dscItem[${JSON.stringify(childrenField)}]}</${dep.name}>`
          : `<${dep.name} key={${key}}${attrs} />`;
        return `{__dscItems.map(__dscItem => (${node}))}`;
      }
      // v12 repeat (P9): the inline surface renders the contract's OBSERVED
      // sample as fixed instances (the meter discipline; the full React
      // surface maps the live array) — a declared fidelity limit, named in
      // the emitted header comment (repeatNote).
      const dep = ctx.contracts.get(part.component.id)!;
      return wrapVisibleWhen(
        part,
        part.repeat.sample
          .map((rec) => {
            let itemText: string | undefined;
            let fieldAttrs = '';
            for (const [field, v] of Object.entries(rec)) {
              if (field === part.repeat!.keyField) continue;
              const depProp = dep.props.find((p) => p.name === field);
              const codeName = depProp?.bindings.code.prop ?? field;
              if (typeof v === 'string' && codeName === 'children') {
                itemText = v;
              } else if (depProp && hasCodeValues(depProp) && typeof v === 'string') {
                fieldAttrs += ` ${codeName}={${codeValueLiteral(depProp,v)}}`;
              } else if (typeof v === 'boolean') {
                fieldAttrs += v ? ` ${codeName}` : '';
              } else if (typeof v === 'number') {
                fieldAttrs += ` ${codeName}={${v}}`;
              } else {
                fieldAttrs += ` ${codeName}="${v}"`;
              }
            }
            const attrs = depAttrString(dep, part.component!.props ?? {}) + fieldAttrs + (hasComponentHostPlacement(part) || hasScalableOverrides(part) ? ` style=${styleExpr(partName, false, [])}` : '');
            return itemText !== undefined
              ? `<${dep.name}${attrs}>${itemText}</${dep.name}>`
              : `<${dep.name}${attrs} />`;
          })
          .join('\n'),
      );
    }
    if (part.component) {
      const dep = ctx.contracts.get(part.component.id)!;
      const attrs = depAttrString(dep, part.component.props ?? {}) + reactInitialAttributes(contract, dep, part.component) + (selection?.attrs(part, true) ?? '') + (hasComponentHostPlacement(part) || hasScalableOverrides(part) ? ` style=${styleExpr(partName, false, [])}` : '');
      const depChildren = textProps(dep).find((p) => p.bindings.code.prop === 'children');
      // ROUND 3 — see emit-react: an APPLIED children prop must not be
      // clobbered by the child's default re-emitted as JSX children.
      const childrenApplied = depChildren !== undefined && part.component.props?.[depChildren.name] !== undefined;
      const depSelfDefaults = depChildren?.bindings.figma.kind === 'NONE';
      const text =
        part.component.text ??
        (!childrenApplied && !depSelfDefaults && typeof depChildren?.default === 'string'
          ? depChildren.default
          : undefined);
      const instance = part.parts !== undefined
        ? `<${dep.name}${attrs}><>\n${Object.entries(part.parts).map(([childName, child]) => renderPart(childName, child)).join('\n')}\n</></${dep.name}>`
        : text !== undefined
        ? `<${dep.name}${attrs}>${literalTextJsx(text)}</${dep.name}>`
        : `<${dep.name}${attrs} />`;
      // A2 grid (G3/P12): an instance cell rides a wrapper span whose style
      // carries the placement (see the baseStyles entries above).
      return wrapVisibleWhen(part, gridPlan.wrappedInstances.has(partName)
        ? `<span style=${styleExpr(partName, false, [])}>${instance}</span>`
        : instance);
    }
    if (part.slot) {
      const el = part.element ?? 'div';
      const expr = part.slot.name === 'children' ? 'children' : part.slot.name;
      const node = `<${el} style=${styleExpr(partName, false, stylesWhenExprs(part))}${partAttrString(part)}${eventAttrsFor(partName, part, el)}>{${expr}}</${el}>`;
      return part.optional ? `{${expr} != null ? ${node} : null}` : wrapVisibleWhen(part, node);
    }
    if (part.content) {
      const el = part.element ?? 'span';
      const prop = contract.props.find(
        (p) => p.type === 'text' && p.bindings.code.prop === part.content!.prop,
      )!;
      return wrapVisibleWhen(
        part,
        `<${el} style=${styleExpr(partName, false, [...stylesWhenExprs(part), ...emptyRun(part, prop.bindings.code.prop)])}${partAttrString(part)}${eventAttrsFor(partName, part, el)}>${textRun(part, `{${prop.bindings.code.prop}}`)}</${el}>`,
      );
    }
    if (part.text !== undefined) {
      const el = part.element ?? 'span';
      // textByProp: per-enum-value characters (see emit-react).
      const tb = part.textByProp;
      const inner = tb
        ? `{${Object.entries(tb.map)
            .map(([v, t]) => `${codePropOf(tb.prop)} === '${v}' ? ${JSON.stringify(t)} : `)
            .join('')}${JSON.stringify(part.text)}}`
        : literalTextJsx(part.text);
      return wrapVisibleWhen(
        part,
        `<${el} style=${styleExpr(partName, false, [...stylesWhenExprs(part), ...emptyRun(part, tb ? inner.slice(1, -1) : JSON.stringify(part.text))])}${partAttrString(part)}${eventAttrsFor(partName, part, el)}>${textRun(part, inner)}</${el}>`,
      );
    }
    if (part.meter) {
      const v = codePropOf(part.meter.valueProp);
      const m = codePropOf(part.meter.maxProp);
      return wrapVisibleWhen(
        part,
        `<div style=${styleExpr(partName, false, [`width: \`\${Math.min(100, Math.max(0, (${v} / ${m}) * 100))}%\``])} />`,
      );
    }
    const el = part.element ?? 'div';
    // A2 grid (G4): a grid parent's EMPTY areas render placeholder elements
    // after the declared children (their styles carry the placement).
    const inner = [
      ...Object.entries(part.parts ?? {}).map(([childName, child]) => renderPart(childName, child)),
      ...(gridPlan.placeholders.get(partName) ?? []).map(
        (area) => `<div style=${styleExpr(area, false, [])} />`,
      ),
    ].join('\n');
    return wrapVisibleWhen(
      part,
      `<${el} style=${styleExpr(partName, false, stylesWhenExprs(part))}${partAttrString(part)}${eventAttrsFor(partName, part, el)}>\n${inner}\n</${el}>`,
    );
  };

  // `root` is undefined for a multi-root composite; the single-root tail below
  // is unused in that case (the isMultiRoot branch returns before the template
  // is assembled), so these reads are guarded rather than duplicated.
  const root = contract.anatomy.root;
  const explicitRootContent = rootContentJsx(root, codePropOf);
  const rootInner = root?.parts || gridPlan.placeholders.has('root')
    ? [
        ...(explicitRootContent !== undefined ? [explicitRootContent] : []),
        ...Object.entries(root?.parts ?? {}).map(([childName, child]) => renderPart(childName, child)),
        // A2 grid (G4): empty root-grid areas render placeholders too.
        ...(gridPlan.placeholders.get('root') ?? []).map(
          (area) => `<div style=${styleExpr(area, false, [])} />`,
        ),
      ].join('\n')
    : explicitRootContent ?? '{children}';

  const el = elementByProp ? 'Tag' : contract.semantics.element;
  if (elementByProp) {
    prelude.push(
      `  const Tag = ${whenProvided(elementByProp.prop, `ELEMENT_MAP[${codePropOf(elementByProp.prop)}] ?? '${contract.semantics.element}'`, `'${contract.semantics.element}'`)};`,
    );
  }

  const rootAttrs = root?.attrs ?? {};
  const nativeDisabled = meta.supportsDisabled && bools.some((p) => p.name === 'disabled');
  const elementAttrs: string[] = ['ref={ref}', `style=${styleExpr('root', true, root ? stylesWhenExprs(root) : [])}`];
  if (nativeDisabled && !Object.keys(rootAttrs).some((attr) => attr.toLowerCase() === 'disabled')) {
    elementAttrs.push(`disabled={${codePropOf('disabled')}}`);
  }
  for (const p of bools) {
    if (p.name === 'disabled' && nativeDisabled) continue;
    const dataName = p.name.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
    elementAttrs.push(`data-${dataName}={${p.bindings.code.prop} || undefined}`);
  }
  // anatomy.root.attrs ride the root element like every part's attrs;
  // attrs.role wins over the semantics default (a differing pair is refused
  // by name in validateContract).
  if (root) elementAttrs.push(...partAttrList(root));
  const roleByProp = contract.semantics.roleByProp;
  let roleMapConst = '';
  if (roleByProp) {
    roleMapConst = `const ROLE_MAP: Record<string, string> = ${JSON.stringify(roleByProp.map)};\n\n`;
    elementAttrs.push(`role={${whenProvided(roleByProp.prop, `ROLE_MAP[${codePropOf(roleByProp.prop)}]`, JSON.stringify(contract.semantics.role) ?? 'undefined')}}`);
  } else if (
    rootAttrs.role === undefined &&
    contract.semantics.role &&
    contract.semantics.role !== contract.semantics.element
  ) {
    elementAttrs.push(`role="${contract.semantics.role}"`);
  }
  let elementMapConst = '';
  if (elementByProp) {
    elementMapConst = `const ELEMENT_MAP: Record<string, ElementType> = ${JSON.stringify(elementByProp.map)};\n\n`;
  }
  const rootEvent = events.find((e) => e.trigger === 'root');
  if (rootEvent) {
    if (contract.semantics.element === 'button' && rootAttrs.type === undefined) elementAttrs.push('type="button"');
    elementAttrs.push(`onClick={handle${pascal(rootEvent.name)}}`);
    const aria = reactToggleAria(contract, rootEvent);
    if (aria) elementAttrs.push(aria.trim());
  }
  elementAttrs.push('{...rest}');

  // Flatten variant styles into a single lookup: `${prop}-${value}:${part}`.
  const styleType = walkAnatomy(contract).some(({ part }) => needsWholePixelTextRun(part))
    ? `CSSProperties & { '--_dsc-text-box-tracking'?: string }` : 'CSSProperties';
  const variantFlat: Record<string, StyleRecord> = {};
  for (const [key, parts] of Object.entries({ ...variantStyles, ...variantPairStyles })) {
    for (const [partName, decls] of Object.entries(parts)) {
      variantFlat[`${key}:${partName}`] = decls;
    }
  }

  const iconsConst =
    neededIcons.size > 0
      ? `const ICONS: Record<string, string> = {\n${[...neededIcons.entries()]
          .map(([kk, v]) => `  ${JSON.stringify(kk)}: ${JSON.stringify(v)},`)
          .join('\n')}\n};\n\n`
      : '';
  const sizedIconsConst = sizedIcons.size
    ? `const SIZED_ICONS: Record<number, Record<string, string>> = ${JSON.stringify(Object.fromEntries([...sizedIcons].map(([size, icons]) => [size, Object.fromEntries(icons)])), null, 2)};\n\n`
    : '';
  const keyframes: string[] = [];
  if (usedAnimations.has('spin')) keyframes.push('@keyframes ds-inline-spin { to { transform: rotate(360deg); } }');
  if (usedAnimations.has('pulse')) keyframes.push('@keyframes ds-inline-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.45; } }');
  const keyframesConst = keyframes.length > 0 ? `const KEYFRAMES = ${JSON.stringify(keyframes.join('\n'))};\n\n` : '';
  const keyframesNode = keyframes.length > 0 ? `<style>{KEYFRAMES}</style>\n      ` : '';

  const typeImports = [
    'CSSProperties',
    meta.attrs,
    ...(slots.length > 0 ? ['ReactNode'] : []),
    ...(elementByProp ? ['ElementType'] : []),
  ].join(', ');
  const depImports = deps.map((depName) => `import { ${depName} } from './${depName}';`).join('\n');

  const overlapNote = walkAnatomy(contract).some((w) => w.part.layout?.overlap && w.part.tokens?.gap)
    ? `\n * Fidelity: the overlap gap (negative child margins) needs a child selector — not\n * expressible inline; children render without the overlap offset.`
    : '';
  const repeatNote = walkAnatomy(contract).some((w) => w.part.repeat && w.part !== selection?.item)
    ? `\n * Fidelity: repeat collections render the contract's OBSERVED sample as fixed\n * instances (the array prop is declared but not mapped on this surface) — the\n * full React surface maps the live array.`
    : '';

  // SILENT-LOSS ROUND (task #33, fix 4) — CANVAS-ONLY SYNTHETIC CHANNELS.
  // `translate-x`/`translate-y` are minted by decomposeTranslate so the canvas
  // can fold a transform into absolute placement; they are not CSS properties
  // and `style={{ translateX: … }}` is not a React style key. They were
  // reaching this surface verbatim. Removed HERE (one choke point over the
  // finished style maps, so no emission site can route around it) and NAMED in
  // the emitted header — never a silent drop.
  const canvasOnlyKeys = new Set(
    Object.keys(TOKEN_CHANNELS).filter((c) => TOKEN_CHANNELS[c].css === 'canvas-only').map(camel),
  );
  const canvasOnlyRefused = new Set<string>();
  for (const rec of [...Object.values(baseStyles), ...Object.values(variantFlat)]) {
    for (const k of Object.keys(rec)) {
      if (canvasOnlyKeys.has(k)) { delete rec[k]; canvasOnlyRefused.add(k); }
    }
  }
  const canvasOnlyNote = canvasOnlyRefused.size > 0
    ? `\n * Fidelity: ${[...canvasOnlyRefused].sort().join(', ')} REFUSED BY NAME — synthetic\n * canvas-only channel(s) (decomposeTranslate) with no CSS spelling; the canvas\n * lowers them to absolute placement.`
    : '';

  // RC7 — PSEUDO-ELEMENT CHANNELS CANNOT EXIST ON THIS SURFACE, BY NAME.
  // `placeholder-color` IS real CSS, but it is a RULE on a pseudo-element
  // (`::placeholder { color: … }`) and an inline style object has no
  // selector to hang one off. Writing `color` here instead would repaint the
  // VALUE ink — a different, real fact about the same element — so this
  // surface refuses and says which fact it could not carry. The stylesheet
  // surfaces (css / html / web-components) lower it to the real rule.
  const pseudoKeys = new Map(
    Object.keys(TOKEN_CHANNELS)
      .filter((c) => TOKEN_CHANNELS[c].css === 'pseudo-element')
      .map((c) => [camel(c), c]),
  );
  const pseudoRefused = new Set<string>();
  for (const rec of [...Object.values(baseStyles), ...Object.values(variantFlat)]) {
    for (const k of Object.keys(rec)) {
      if (pseudoKeys.has(k)) { delete rec[k]; pseudoRefused.add(k); }
    }
  }
  const pseudoNote = pseudoRefused.size > 0
    ? `\n * Fidelity: ${[...pseudoRefused].sort().join(', ')} REFUSED BY NAME — ${[...pseudoRefused]
        .sort()
        .map((k) => `\`${TOKEN_CHANNELS[pseudoKeys.get(k)!].pseudo!.selector} { ${TOKEN_CHANNELS[pseudoKeys.get(k)!].pseudo!.property} }\``)
        .join(', ')} is a\n * RULE on a pseudo-element and an inline style object has no selector; writing\n * \`color\` here instead would repaint the VALUE ink, a different real fact.`
    : '';
  const disabledSubstNote = disabledSubstOmitted.length > 0
    ? `\n * Fidelity: ROOT disabled-state ref(s) ${disabledSubstOmitted.join(', ')} substitute a prop —\n * omitted on this surface (DISABLED_STYLE is one static object; the css/html/\n * web-components surfaces expand them per value).`
    : '';

  // MULTI-ROOT composite: the roots render as SIBLINGS in a Fragment (no
  // wrapper element — a Modal's backdrop + dialog are position-driven
  // siblings). Each root/descendant carries its resolved inline style via the
  // same S/V lookup; single-root falls through to the untouched one-root path.
  if (isMultiRoot(contract)) {
    const rootsJsx = topRoots(contract)
      .map(([n, p]) => renderPart(n, p))
      .join('\n      ');
    const mrTsx = `/**
 * GENERATED FILE (inline-styles emitter) — DO NOT EDIT.
 * Source of truth: contracts/${contract.id.replace(/^[^.]+\./, '')}.contract.json (${contract.id} v${contract.version})
 * Emitted by core/emit-react-inline.ts — token references RESOLVED to literals.
 * Resolution mode: ${mode} (brand: default).
 * MULTI-ROOT composite — ${topRoots(contract).length} top-level roots (${topRoots(contract).map(([n]) => n).join(', ')})
 * render as SIBLINGS in a Fragment; there is no single wrapping element.${canvasOnlyNote}${pseudoNote}${disabledSubstNote}${omittedNote}
 */
import type { ${typeImports} } from 'react';
${depImports}${depImports ? '\n' : ''}
${iconsConst}${sizedIconsConst}${keyframesConst}${strokeRingParts.size > 0 ? STROKE_RING_RUNTIME : ''}const S: Record<string, ${styleType}> = ${JSON.stringify(baseStyles, null, 2)};

/** Per-variant overrides, resolved per enum value: "prop-value:part" → styles. */
const V: Record<string, ${styleType}> = ${JSON.stringify(variantFlat, null, 2)};${jointConst}${placementConst}

export interface ${name}Props extends ${propsBase} {
${propLines.join('\n')}
}

/** ${contract.description}${(contract.documentationLinks ?? []).map((l) => `\n * @see ${l.uri}`).join('')} */
export function ${name}({ ${destructured.join(', ')} }: ${name}Props) {
${prelude.length > 0 ? prelude.join('\n') + '\n' : ''}  return (
    <>
      ${keyframesNode}${rootsJsx}
    </>
  );
}
`;
    return { tsx: mrTsx };
  }

  const tsx = `/**
 * GENERATED FILE (inline-styles emitter) — DO NOT EDIT.
 * Source of truth: contracts/${contract.id.replace(/^[^.]+\./, '')}.contract.json (${contract.id} v${contract.version})
 * Emitted by core/emit-react-inline.ts — the zero-infrastructure output:
 * every token reference was RESOLVED to its literal value from the design
 * tokens at emit time. Resolution mode: ${mode} (brand: default). To retheme,
 * re-emit against different tokens — do not edit literals by hand.
 * Fidelity: :hover/:focus-visible state tokens are not expressible as inline
 * styles and are omitted; ROOT disabled-state tokens apply via the disabled
 * prop; PART-level state overrides (Part.states, v13) are omitted — the same
 * declared limit as the hover states (state-selected descendant styling).${overlapNote}${repeatNote}${canvasOnlyNote}${pseudoNote}${disabledSubstNote}${omittedNote}
 */
import { forwardRef${events.some((e) => e.toggles) ? ', useState' : ''} } from 'react';
import type { ${typeImports} } from 'react';
${depImports}${depImports ? '\n' : ''}
${selection?.runtime ?? ''}${iconsConst}${sizedIconsConst}${roleMapConst}${elementMapConst}${keyframesConst}${strokeRingParts.size > 0 ? STROKE_RING_RUNTIME : ''}const S: Record<string, ${styleType}> = ${JSON.stringify(baseStyles, null, 2)};

/** Per-variant overrides, resolved per enum value: "prop-value:part" → styles. */
const V: Record<string, ${styleType}> = ${JSON.stringify(variantFlat, null, 2)};${jointConst}${placementConst}
${Object.keys(disabledStyle).length > 0 ? `\nconst DISABLED_STYLE: CSSProperties = ${JSON.stringify(disabledStyle)};\n` : ''}
export interface ${name}Props extends ${propsBase} {
${propLines.join('\n')}
}

/** ${contract.description}${(contract.documentationLinks ?? []).map((l) => `\n * @see ${l.uri}`).join('')} */
export const ${name} = forwardRef<${meta.el}, ${name}Props>(function ${name}(
  { ${destructured.join(', ')} },
  ref,
) {
${prelude.length > 0 ? prelude.join('\n') + '\n' : ''}  return (
    <${el} ${elementAttrs.join(' ')}>
      ${keyframesNode}${rootInner}
    </${el}>
  );
});
`;
  return { tsx };
}
