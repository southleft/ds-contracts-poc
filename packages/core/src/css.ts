/**
 * Contract → scoped CSS text — the stylesheet every code target shares
 * (React CSS Modules, static HTML, the web-components constructable sheet).
 * Moved verbatim from the reference repo's core/emit-react.ts; output is
 * UNFORMATTED (the CLI's prettier pass is a projection concern) and
 * byte-guarded there by evals/golden.json. Pure; imports
 * @ds-contracts/schema only.
 */
import {
  PSEUDO_ELEMENT_CHANNELS,
  REF_OVERRIDE_CHANNELS,
  refOverrideVar,
  TOKEN_CHANNELS,
  borderStyleDecls,
  isNativeCheckablePart,
  shapeCssDecls,
  tokensByPropEntries,
  walkAnatomy,
  type Contract,
  type Part,
} from '@ds-contracts/schema';
import {
  ALIGN_CSS,
  boolProps,
  cssVar,
  enumCombos,
  enumProps,
  holderDeclaresPosition,
  isEnum,
  isMultiRoot,
  isStructural,
  JUSTIFY_CSS,
  layoutOverrideDecls,
  OVERLAY_CSS,
  placeholdersIn,
  rootElementsOf,
  STATE_SELECTORS,
  stripBraces,
  UA_MARGIN_ELEMENTS,
  UA_PAINT_CHANNELS,
  UA_PAINTED_ROOT_ELEMENTS,
} from './anatomy.js';
import { ELEMENT_META } from './elements.js';
import { gridCellPlan, gridChildCrossAxisDecls, gridParentDecls } from './grid.js';

// ---------------------------------------------------------------------------
// CSS generation
// ---------------------------------------------------------------------------

/** v7 stylesWhen rules for one part. Boolean conditions select on the
 *  root's existing per-boolean data attribute (native disabled uses
 *  :disabled); enum conditions select on the root's enum class. */
function stylesWhenRules(contract: Contract, partName: string, part: Part, isRootPart: boolean): string[] {
  const rules: string[] = [];
  for (const sw of part.stylesWhen ?? []) {
    const prop = contract.props.find((pr) => pr.name === sw.prop);
    if (!prop) continue; // refused by validateContract
    let base: string;
    if (isEnum(prop)) {
      base = `.${sw.prop}-${sw.equals}`;
    } else {
      const nativeDisabled =
        prop.name === 'disabled' && ELEMENT_META[contract.semantics.element]?.supportsDisabled;
      const dataName = prop.name.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
      base = nativeDisabled ? '.root:disabled' : `.root[data-${dataName}]`;
    }
    const selector = isRootPart ? base : `${base} .${partName}`;
    const decls = Object.entries(sw.styles)
      .map(([k, v]) => `  ${k}: ${v};`)
      .join('\n');
    rules.push(`\n${selector} {\n${decls}\n}`);
  }
  return rules;
}

/** `"border-top-style: solid"` → `["border-top-style", "solid"]`. The enum-class
 *  rules are keyed prop→value Maps, so `borderStyleDecls`' declaration strings
 *  are split back apart to land in them. */
function splitDecl(decl: string): [string, string] {
  const i = decl.indexOf(': ');
  return [decl.slice(0, i), decl.slice(i + 2)];
}

export function generateCss(contract: Contract, tokenInventory: Set<string>, errors: string[]): string {
  const enums = new Map(enumProps(contract).map((p) => [p.name, p.type.enum]));
  const lines: string[] = [
    `/* GENERATED FILE — DO NOT EDIT.`,
    ` * Source of truth: contracts/${contract.id.replace(/^[^.]+\./, '')}.contract.json (${contract.id} v${contract.version})`,
    ` * Regenerate with: npm run generate`,
    ` */`,
  ];

  // ONE BOX MODEL ACROSS SURFACES (FC-BOX-MODEL, 2026-08-08 first-party
  // visual loop). The Figma emitter binds width/max-width tokens straight to
  // frame widths, and Figma frames are border-box by construction — padding
  // and (inside-aligned) strokes live INSIDE the bound width; its declared
  // `box-sizing: content-box` branch is the exception, not the rule. The
  // generated CSS previously inherited the UA default (content-box), so a
  // padded root with a width token rendered its padding OUTSIDE the token
  // width — measured: banner 672px outer in code vs the bound 640px
  // ({size.banner.width}) cell on canvas; card 322px vs 320px. Scoped reset
  // (CSS-modules-safe: anchored on the root classes), the same shape the
  // exact-conversion sample kits ship.
  const rootClasses = Object.keys(contract.anatomy);
  lines.push(
    '',
    rootClasses
      .flatMap((c) => [`.${c}`, `.${c} *`, `.${c} *::before`, `.${c} *::after`])
      .join(',\n') + ' {',
    '  box-sizing: border-box;',
    '}',
  );

  const checkToken = (tokenPath: string, context: string): boolean => {
    if (!tokenInventory.has(tokenPath)) {
      errors.push(
        `${contract.id}: ${context} references token "{${tokenPath}}" which does not exist in tokens/`,
      );
      return false;
    }
    return true;
  };

  // A2 grid: the ONE compiled cell plan every branch below consults — parent
  // track/gap/area decls come from gridParentDecls, child placements from
  // plan.cells, empty-area placeholders + instance wrappers from the plan.
  const gridPlan = gridCellPlan(contract);
  const gridPartDecls = (partName: string, part: Part): string[] =>
    gridParentDecls(part.layout!, cssVar, `${contract.id}.anatomy.${partName}.layout.gap`);
  const gridPlaceholderRules = (partName: string): string[] =>
    (gridPlan.placeholders.get(partName) ?? []).flatMap((area) => [
      '',
      `.${area} {`,
      `  grid-area: ${area};`,
      '}',
    ]);

  // MULTI-ROOT composite: there is no single ".root" — each top-level root
  // and every descendant part compiles to its OWN class (.dialog, .backdrop,
  // .header …), rendered as siblings by the JSX. Layout is contract-governed
  // (`layout`); token refs become var(--…); literals/declared facts verbatim.
  // (Single-root falls through to the untouched N=1 path below.)
  if (isMultiRoot(contract)) {
    for (const { name, part } of walkAnatomy(contract)) {
      if (part.component) {
        // A2 grid (G3/P12): an instance child of a grid parent rides a
        // wrapper element that IS the grid item — the wrapper's class takes
        // the cell; display: grid makes the lone instance stretch into it
        // (the CSS spelling of the canvas FILL default).
        const cell = gridPlan.cells.get(name);
        if (cell) lines.push('', `.${name} {`, ...[...cell, 'display: grid'].map((d) => `  ${d};`), '}');
        continue; // instances style themselves via their own contract
      }
      const decls: string[] = [];
      if (isStructural(part)) {
        if (part.layout?.display === 'grid') {
          decls.push(...gridPartDecls(name, part));
        } else {
          decls.push(`display: ${part.layout?.display ?? 'flex'}`);
          if (part.layout?.direction) decls.push(`flex-direction: ${part.layout.direction}`);
          if (part.layout?.wrap) decls.push('flex-wrap: wrap');
          if (part.layout?.align) decls.push(`align-items: ${ALIGN_CSS[part.layout.align]}`);
          else if (gridPlan.gridChildren.has(name)) decls.push(...gridChildCrossAxisDecls(part));
          if (part.layout?.justify) decls.push(`justify-content: ${JUSTIFY_CSS[part.layout.justify]}`);
        }
      }
      decls.push(...(gridPlan.cells.get(name) ?? []));
      if (part.layout?.grow) decls.push('flex: 1 1 auto', 'min-width: 0');
      if (part.element && UA_MARGIN_ELEMENTS.has(part.element)) decls.push('margin: 0');
      if (part.overlay) decls.push('position: absolute', ...OVERLAY_CSS[part.overlay.placement]);
      if (part.shape) decls.push(...shapeCssDecls(part.shape));
      if (part.element === 'button') {
        decls.push('appearance: none', 'background: none', 'border: none', 'font: inherit',
          'color: inherit', 'cursor: pointer');
      }
      if (part.icon) {
        decls.push('display: inline-flex', 'flex-shrink: 0');
        if (part.icon.size) {
          lines.push('', `.${name} svg {`, `  width: ${part.icon.size}px;`, `  height: ${part.icon.size}px;`, '}');
        }
      }
      // Non-substituted token refs → var(--…); single-placeholder refs are a
      // per-enum descendant idiom that only exists under a single root and do
      // not occur in captured composites (documented scope).
      for (const [cssProp, ref] of Object.entries(part.tokens ?? {})) {
        const refPath = stripBraces(ref);
        if (placeholdersIn(refPath).length > 0) continue;
        if (checkToken(refPath, `anatomy.${name}.tokens.${cssProp}`)) {
          decls.push(`${cssProp}: ${cssVar(refPath)}`);
        }
      }
      for (const [cssProp, lit] of Object.entries(part.literals ?? {})) decls.push(`${cssProp}: ${lit}`);
      for (const [cssProp, value] of Object.entries(part.declared ?? {})) decls.push(`${cssProp}: ${value}`);
      if (decls.length > 0) {
        lines.push('', `.${name} {`, ...decls.map((d) => `  ${d};`), '}');
      }
      // A2 grid (G4): empty areas own placeholder rules right after their
      // parent's rule — the placement is visible with nothing in it.
      lines.push(...gridPlaceholderRules(name));
    }
    return lines.join('\n') + '\n';
  }

  // Root: static/layout base + non-substituted tokens, then enum classes,
  // then state rules — same model as v1, layout now contract-governed.
  const root = contract.anatomy.root;
  const rootDecls: string[] = [];
  if (root.layout) {
    if (root.layout.display === 'grid') {
      // A2 grid (G1): the root is a grid parent — tracks/gaps/areas/flow.
      rootDecls.push(...gridPartDecls('root', root));
    } else {
      rootDecls.push(`display: ${root.layout.display ?? 'flex'}`);
      if (root.layout.direction) rootDecls.push(`flex-direction: ${root.layout.direction}`);
      if (root.layout.wrap) rootDecls.push('flex-wrap: wrap');
      if (root.layout.align) rootDecls.push(`align-items: ${ALIGN_CSS[root.layout.align]}`);
      if (root.layout.justify) rootDecls.push(`justify-content: ${JUSTIFY_CSS[root.layout.justify]}`);
    }
  } else {
    rootDecls.push('display: inline-flex', 'align-items: center', 'justify-content: center');
  }
  const rootTokens = root.tokens ?? {};
  // Round 2 iteration 9 — per-instance override CONSUMPTION (root
  // `overridable`): every declaration of a listed channel becomes
  // `var(<override var>, <own binding>)` so a host's wrapper can override
  // this one usage; with no override set, the fallback IS the own binding —
  // value-identical to the plain spelling. A nested part binding the SAME
  // ref as the root (a stub's glyph part) consumes the same var, so the
  // glyph scales with its overridden box.
  const overrideVarByCssProp = new Map<string, string>();
  for (const channel of root.overridable ?? []) {
    for (const cssProp of REF_OVERRIDE_CHANNELS[channel]?.css ?? []) {
      overrideVarByCssProp.set(cssProp, refOverrideVar(contract.id, channel));
    }
  }
  const ovVal = (cssProp: string, value: string): string => {
    const ovVar = overrideVarByCssProp.get(cssProp);
    return ovVar ? `var(${ovVar}, ${value})` : value;
  };
  // UA-margin neutralization: see UA_MARGIN_ELEMENTS.
  if (rootElementsOf(contract).some((el) => UA_MARGIN_ELEMENTS.has(el))) {
    rootDecls.push('margin: 0');
  }
  // GAP-CLOSING ROUND 9 — A STYLE KEYWORD IS NOT A BORDER; A WIDTH IS.
  //
  // This test used to read `border-width OR border-color`, so a contract
  // carrying only a COLOUR emitted `border-style: solid` with no width — and
  // CSS finished the claim with the UA default, `medium`, which Chrome
  // resolves to 3px. UUI's ButtonGroupBase is exactly that shape: the canvas
  // draws per-side weights [0,1,0,0], the capture REFUSES them BY NAME
  // (`stroke-weights-nonuniform`, dump v1 carries a uniform weight only), so
  // no width reaches the contract — and every one of its 32 variants then
  // rendered 5–6px too wide and too tall, scoring 80.15 against a 98.91
  // ceiling.
  //
  // That is round 5's bug with the halves swapped. There, border-WIDTH
  // carried while border-COLOUR was refused, and CSS completed the pair with
  // `currentColor` — painting black focus rings across three libraries. Same
  // asymmetry, same mechanism, same lesson, stated once as a rule:
  //
  //   A REFUSED CHANNEL WHOSE CSS SIBLING IS STILL EMITTED MUST EITHER
  //   WITHHOLD BOTH OR CARRY BOTH. A half-declaration is not a partial
  //   truth — the user agent completes it into a whole falsehood.
  //
  // So the style keyword now rides the WIDTH alone. With the width refused,
  // the root falls to `border: 0` and the carried colour paints nothing:
  // measured at 92.26 on button-group-base (from 80.15). Two spellings score
  // higher and neither is ours to write: a uniform `1px` (95.35) INVENTS
  // three edges the canvas does not draw, and the exact per-side `0 1px 0 0`
  // (94.42) is the very spelling the capture receipt refuses — the
  // conformance case `stroke-weights-nonuniform` pins "the proposal must not
  // invent per-side widths". Carrying per-side weights is a CAPTURE change,
  // not an emitter licence; until the dump carries them, withholding is the
  // honest half of the rule and 3.09 points stay named rather than guessed.
  //
  // FC-BORDER-STYLE-NOT-SYNTHESISED: the test above reads the SHORTHAND only,
  // so a part whose width arrives as per-variant LONGHAND literals got no
  // keyword and CSS painted no border at all. The rule now lives in ONE place
  // for all three CSS surfaces — `borderStyleDecls` in the schema package,
  // which also states why a per-side LITERAL earns the keyword and a per-side
  // TOKEN ref does not.
  const hasBorderWidth =
    'border-width' in rootTokens || 'border-width' in (root.literals ?? {});
  if (hasBorderWidth) rootDecls.push('border-style: solid');
  else rootDecls.push('border: 0');
  // Pushed AFTER the `border: 0` reset above so the reset cannot erase it.
  rootDecls.push(...borderStyleDecls(root.literals, 'literals', root.declared));
  // The OTHER stroke vocabulary gets NO such synthesis, and the reason is
  // this round's own lesson pointed at itself. dump v1.11 lowers an
  // OUTSIDE-aligned Figma stroke to `outline-*`, and a CSS outline paints
  // nothing without `outline-style` — so the temptation is to make the
  // keyword ride `outline-width` exactly as `border-style` rides
  // `border-width` above. That is WRONG, and it was measured wrong: a
  // resting `outline: Npx solid transparent` is a standard CSS idiom for
  // reserving focus-ring space, and CSS-extracted contracts are full of it.
  // Carbon's Tag carries a resting outline-width with OPAQUE per-tone
  // colours (#a2191f red, #0043ce blue, …); synthesising the keyword drew a
  // 2px ring around every Tag in the library at rest.
  //
  // A border-width means "draw a border" because Figma has no other reason
  // to carry one. An outline-width does NOT mean "draw an outline" — the
  // fact that decides it is `outline-style`, which is already a DECLARED
  // channel and is emitted verbatim below. So the inversion DECLARES it
  // (core/propose-figma.ts, strokeVocabulary) and the emitter never guesses
  // it. Infer a keyword from its sibling in one direction and you get round
  // 5's black focus rings; infer it in the other and you get rings on
  // everything. Carry it.
  // GAP-CLOSING ROUND 6 — THE OTHER HALF OF THAT RESET.
  //
  // The line above already knows the principle: a contract that declares no
  // border must not be finished by a UA one. The SAME contract declaring no
  // BACKGROUND was left to the user agent, and on a `<button>` root that
  // means Chrome's `buttonface` — an opaque #efefef ground (and
  // rgba(239,239,239,0.3) when disabled) painted over the entire component
  // box. A Figma frame with no fill is TRANSPARENT; the absence IS the drawn
  // fact (the round-5 border-colour precedent, one asymmetry down).
  //
  // Measured: UUI DropdownListItem draws no root fill in any of its 24
  // variants, and every emitted variant rendered on a full-bleed grey
  // rectangle the canvas never had — 12 scored variants, 100% of the box.
  //
  // The reset is the SAME spelling this file already emits for a nested
  // `element: 'button'` PART (appearance/background/border/font/color) — the
  // paint half of it. It is gated on the root carrying NO background channel
  // of any kind, so a button root that DOES paint (Social Button, Toggle
  // base, Avatar add button) keeps exactly the bytes it had: this closes a
  // hole, it does not restyle anything that was already stated.
  const rootPaints = (holder: { tokens?: Record<string, string>; literals?: Record<string, string> } | undefined): boolean =>
    UA_PAINT_CHANNELS.some((c) => c in (holder?.tokens ?? {}) || c in (holder?.literals ?? {}));
  const hasBackground =
    UA_PAINT_CHANNELS.some((c) => c in rootTokens) ||
    rootPaints(root as never) ||
    (Array.isArray(root.tokensByProp) ? root.tokensByProp : root.tokensByProp ? [root.tokensByProp] : []).some((e) =>
      Object.values(e.map).some((o) => UA_PAINT_CHANNELS.some((c) => c in o)),
    ) ||
    (Array.isArray(root.literalsByProp) ? root.literalsByProp : root.literalsByProp ? [root.literalsByProp] : []).some((e) =>
      Object.values(e.map).some((o) => UA_PAINT_CHANNELS.some((c) => c in o)),
    );
  if (UA_PAINTED_ROOT_ELEMENTS.has(contract.semantics.element) && !hasBackground) {
    rootDecls.push('appearance: none', 'background: none');
  }
  // Fluid components: a max-width binding means "fill available space up to
  // the token" — components are never rigid (fixed `width` is reserved for
  // genuinely fixed shapes like Avatar). min-width: fit-content keeps the
  // component from collapsing below its content's floor (e.g. table cells'
  // min-widths); containers narrower than that should scroll.
  // Live-gauntlet class ⑤ (linked-icon-wrapper-collapses): a SLOT-ONLY root
  // carrying BOTH height and max-width is a drawn FIXED wrapper (CBDS Icon).
  // Its content floor is the DRAWN box — every max-width declaration mirrors
  // onto min-width (the stub discipline's observed-geometry floor) instead of
  // fit-content, which is 0 for an empty slot. Fluid slot containers (no
  // height binding) keep the fit-content floor. Mirrors core/emit-html.ts.
  const slotWrapperFloor =
    'max-width' in rootTokens &&
    'height' in rootTokens &&
    Object.keys(root.parts ?? {}).length > 0 &&
    Object.values(root.parts ?? {}).every((p) => p.slot !== undefined);
  // FC-HUG-CEILING-HTML: hug-below-max is a ceiling, not a fluid stretch.
  // Mirrors core/emit-html.ts (Carbon Tag gate was 208px vs Figma ~46px).
  if ('max-width' in rootTokens) {
    if (root.hugsBelowMaxWidth !== true) {
      rootDecls.push('width: 100%');
    }
    if (!slotWrapperFloor) rootDecls.push('min-width: fit-content');
  }
  // v15: a declared cursor fact is authoritative — the emitter's own button
  // chrome (cursor: pointer, and the :disabled not-allowed rule below) yields
  // to it. The declared fact is captured truth; the chrome was a convention.
  const rootDeclaresCursor =
    Boolean(root.declared?.['cursor']) || Boolean(root.declaredStates?.['disabled']?.['cursor']);
  if (contract.semantics.element === 'button' && !rootDeclaresCursor) rootDecls.push('cursor: pointer');
  // v7 overlay / v9 shape placement: any out-of-flow part (an overlay, or a
  // part whose stylesWhen carries position: absolute — the shape-placement
  // spelling) positions against the root.
  // ... UNLESS its DIRECT holder declares a position of its own (the proposer
  // marks the track of a stylesWhen-placed thumb `position: relative`): the
  // holder is the positioning context, and pushing the root too used to
  // anchor the ToggleSwitch thumb's `right: 2px` to the 100px root instead of
  // the 44px track whenever the holder was NOT declared
  // (FC-DUMP-PROPOSE-THUMB-HOLDER-RELATIVE). Root-level parts keep the root
  // anchor. Mirrors core/emit-react-inline.ts.
  if (
    walkAnatomy(contract).some(
      (w) =>
        (w.part.overlay || (w.part.stylesWhen ?? []).some((sw) => sw.styles['position'] === 'absolute')) &&
        !holderDeclaresPosition(contract, w.path),
    )
  ) {
    rootDecls.push('position: relative');
  }

  const enumRules = new Map<string, Map<string, string>>(); // class → decls
  const stateRules: string[] = [];
  const rootSubRules: string[] = [];

  // Bool-conditioned ROOT tokens (mint bool-axis carriage — the axis-inert
  // fix extended to the bool plane): a root-token placeholder may name a
  // BOOLEAN prop; each side renders as a data-attribute selector on the
  // root element the TSX already emits for every boolean
  // (`[data-x]` / `:not([data-x])`; native disabled uses `:disabled`).
  // Nested parts and `states` refs take the same expansion (expandRef below).
  const boolNames = new Set(boolProps(contract).map((p) => p.name));
  const substValues = (p: string): string[] | undefined =>
    enums.get(p) ?? (boolNames.has(p) ? ['true', 'false'] : undefined);
  const boolFrag = (p: string, v: string): string => {
    const nativeDisabled = p === 'disabled' && ELEMENT_META[contract.semantics.element]?.supportsDisabled;
    const sel = nativeDisabled ? ':disabled' : `[data-${p.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase()}]`;
    return v === 'true' ? sel : `:not(${sel})`;
  };
  /** Selector key for a value combination: enum values as compound classes
   *  (the existing `pa-a.pb-b` spelling, byte-identical for all-enum
   *  combos), bool values as data-attribute fragments appended to the enum
   *  compound (or to `root` when every participant is a bool). */
  const comboCls = (pairs: Array<[prop: string, value: string]>): string => {
    const enumPart = pairs.filter(([p]) => !boolNames.has(p)).map(([p, v]) => `${p}-${v}`).join('.');
    const boolPart = pairs.filter(([p]) => boolNames.has(p)).map(([p, v]) => boolFrag(p, v)).join('');
    return (enumPart.length > 0 ? enumPart : 'root') + boolPart;
  };
  /** N-placeholder expansion over enum AND boolean props: the cartesian in
   *  DECLARED placeholder order, then declared value order — the web-
   *  components emitter's `expandRef` is this exact loop, so both resolve
   *  the same leaves in the same order (core/emitters-check.ts byte-compares
   *  the var() names). A placeholder naming neither kind of prop has no
   *  class or attribute to select on and is REFUSED BY NAME — `where` is
   *  the fact that would otherwise have vanished. */
  const expandRef = (
    where: string,
    refPath: string,
  ): Array<{ combo: Array<[string, string]>; resolved: string }> => {
    const phs = placeholdersIn(refPath);
    const unknown = phs.filter((ph) => substValues(ph) === undefined);
    if (unknown.length > 0) {
      errors.push(
        `${contract.id}: ${where} ref "{${refPath}}" substitutes ${unknown.map((ph) => `{${ph}}`).join(', ')} — not an enum or boolean prop of this contract, so there is no class or attribute to select on`,
      );
      return [];
    }
    let out: Array<{ combo: Array<[string, string]>; resolved: string }> = [{ combo: [], resolved: refPath }];
    for (const ph of phs) {
      const next: typeof out = [];
      for (const prefix of out) {
        for (const value of substValues(ph)!) {
          next.push({ combo: [...prefix.combo, [ph, value]], resolved: prefix.resolved.replaceAll(`{${ph}}`, value) });
        }
      }
      out = next;
    }
    return out;
  };

  for (const [cssProp, ref] of Object.entries(rootTokens)) {
    const refPath = stripBraces(ref);
    // slot-wrapper floor (class ⑤): root max-width mirrors onto min-width.
    const floorMirror = slotWrapperFloor && cssProp === 'max-width';
    // overlap on the ROOT (P21, proposed avatar-group shape): the gap token
    // becomes a negative child margin (CSS gap cannot be negative); the
    // canvas side uses negative itemSpacing — same projection as nested
    // parts below, single-placeholder refs expand per enum class.
    if (cssProp === 'gap' && root.layout?.overlap) {
      const phs = placeholdersIn(refPath);
      if (phs.length === 1) {
        for (const value of enums.get(phs[0]) ?? []) {
          const resolved = refPath.replaceAll(`{${phs[0]}}`, value);
          if (!checkToken(resolved, 'anatomy.root.tokens.gap')) continue;
          rootSubRules.push(`\n.${phs[0]}-${value} > * + * {\n  margin-left: ${cssVar(resolved)};\n}`);
        }
      } else if (checkToken(refPath, 'anatomy.root.tokens.gap')) {
        rootSubRules.push(`\n.root > * + * {\n  margin-left: ${cssVar(refPath)};\n}`);
      }
      continue;
    }
    const phs = placeholdersIn(refPath);
    if (phs.length === 0) {
      if (checkToken(refPath, `anatomy.root.tokens.${cssProp}`)) {
        rootDecls.push(`${cssProp}: ${ovVal(cssProp, cssVar(refPath))}`);
        if (floorMirror) rootDecls.push(`min-width: ${cssVar(refPath)}`);
      }
    } else if (phs.length === 1) {
      const values = substValues(phs[0]);
      if (!values) {
        errors.push(`${contract.id}: root token "${cssProp}" substitutes unknown enum prop "${phs[0]}"`);
        continue;
      }
      for (const value of values) {
        const resolved = refPath.replaceAll(`{${phs[0]}}`, value);
        if (!checkToken(resolved, `anatomy.root.tokens.${cssProp}`)) continue;
        const cls = comboCls([[phs[0], value]]);
        if (!enumRules.has(cls)) enumRules.set(cls, new Map());
        enumRules.get(cls)!.set(cssProp, ovVal(cssProp, cssVar(resolved)));
        if (floorMirror) enumRules.get(cls)!.set('min-width', cssVar(resolved));
      }
    } else if (phs.length === 2) {
      // Two-axis root token (e.g. a minted background = f(variant, state)):
      // one compound-class rule per value combination. The compound selector
      // (.variant-primary.state-hover) outranks the single enum classes, so
      // a pair binding wins over any single-axis binding of the same
      // property — deterministic, and both classes always ride the root.
      const [pa, pb] = phs;
      const va = substValues(pa);
      const vb = substValues(pb);
      if (!va || !vb) {
        errors.push(
          `${contract.id}: root token "${cssProp}" substitutes unknown enum prop "${!va ? pa : pb}"`,
        );
        continue;
      }
      for (const a of va) {
        for (const b of vb) {
          const resolved = refPath.replaceAll(`{${pa}}`, a).replaceAll(`{${pb}}`, b);
          if (!checkToken(resolved, `anatomy.root.tokens.${cssProp}`)) continue;
          // Both single classes must EXIST in the module (the TSX composes
          // styles[`prop-value`]; an unemitted class is undefined and the
          // compound selector would never match) — claim them, empty is
          // fine. Bool participants ride data attributes, not classes.
          for (const [sp, sv] of [[pa, a], [pb, b]] as Array<[string, string]>) {
            if (boolNames.has(sp)) continue;
            const single = `${sp}-${sv}`;
            if (!enumRules.has(single)) enumRules.set(single, new Map());
          }
          const cls = comboCls([[pa, a], [pb, b]]);
          if (!enumRules.has(cls)) enumRules.set(cls, new Map());
          enumRules.get(cls)!.set(cssProp, ovVal(cssProp, cssVar(resolved)));
        }
      }
    } else if (phs.length === 3) {
      // Three-axis root token (live-gauntlet class ①: a minted background =
      // f(type, style, state) — CBDS Chip's root fill): one compound-class
      // rule per value combination, the two-axis projection extended one
      // axis. The triple compound (.type-brand.style-fill.state-hover)
      // outranks pair and single classes — deterministic; all three classes
      // always ride the root.
      const [pa, pb, pc] = phs;
      const vsets = phs.map((p) => substValues(p));
      if (vsets.some((v) => !v)) {
        const missing = phs[vsets.findIndex((v) => !v)];
        errors.push(`${contract.id}: root token "${cssProp}" substitutes unknown enum prop "${missing}"`);
        continue;
      }
      for (const a of vsets[0]!) {
        for (const b of vsets[1]!) {
          for (const c of vsets[2]!) {
            const resolved = refPath
              .replaceAll(`{${pa}}`, a)
              .replaceAll(`{${pb}}`, b)
              .replaceAll(`{${pc}}`, c);
            if (!checkToken(resolved, `anatomy.root.tokens.${cssProp}`)) continue;
            for (const [sp, sv] of [[pa, a], [pb, b], [pc, c]] as Array<[string, string]>) {
              if (boolNames.has(sp)) continue;
              const single = `${sp}-${sv}`;
              if (!enumRules.has(single)) enumRules.set(single, new Map());
            }
            const cls = comboCls([[pa, a], [pb, b], [pc, c]]);
            if (!enumRules.has(cls)) enumRules.set(cls, new Map());
            enumRules.get(cls)!.set(cssProp, ovVal(cssProp, cssVar(resolved)));
          }
        }
      }
    } else {
      errors.push(`${contract.id}: root token "${cssProp}" uses ${phs.length} substitutions (max 3)`);
    }
  }

  // v10 tokensByProp on the root: per-enum-value overrides land in the SAME
  // enum-class rules substituted refs use — emitted after .root, so the
  // override wins at equal specificity (the layoutByProp discipline).
  // v14: MULTIPLE entries emit in declaration order — a later entry's class
  // rule lands later in the sheet, so at equal specificity the later entry
  // wins per channel (the CSS source-order cascade the values came from).
  for (const { prop: tbpProp, map } of tokensByPropEntries(root)) {
    for (const [value, overrides] of Object.entries(map)) {
      for (const [cssProp, ref] of Object.entries(overrides)) {
        const refPath = stripBraces(ref);
        const floorMirror = slotWrapperFloor && cssProp === 'max-width';
        // S2 capability lift: a map ref carrying ONE placeholder (validated
        // as a different declared enum prop) expands as compound enum-class
        // rules — the two-placeholder root-token projection with one axis
        // pinned by the map. Both single classes are claimed so the compound
        // selector can match (the pair-binding discipline above).
        const phs = placeholdersIn(refPath);
        if (phs.length === 1) {
          for (const phValue of enums.get(phs[0]) ?? []) {
            const resolved = refPath.replaceAll(`{${phs[0]}}`, phValue);
            if (!checkToken(resolved, `anatomy.root.tokensByProp.${value}.${cssProp}`)) continue;
            for (const single of [`${tbpProp}-${value}`, `${phs[0]}-${phValue}`]) {
              if (!enumRules.has(single)) enumRules.set(single, new Map());
            }
            const cls = `${tbpProp}-${value}.${phs[0]}-${phValue}`;
            if (!enumRules.has(cls)) enumRules.set(cls, new Map());
            enumRules.get(cls)!.set(cssProp, cssVar(resolved));
            if (floorMirror) enumRules.get(cls)!.set('min-width', cssVar(resolved));
          }
          continue;
        }
        if (!checkToken(refPath, `anatomy.root.tokensByProp.${value}.${cssProp}`)) continue;
        const cls = `${tbpProp}-${value}`;
        if (!enumRules.has(cls)) enumRules.set(cls, new Map());
        enumRules.get(cls)!.set(cssProp, cssVar(refPath));
        if (floorMirror) enumRules.get(cls)!.set('min-width', cssVar(refPath));
      }
      // FC-BORDER-STYLE-NOT-SYNTHESISED: a per-variant width needs the keyword
      // in ITS OWN rule — the base `.root` rule may carry no width at all.
      for (const decl of borderStyleDecls(overrides, 'tokens', root.declared)) {
        const [p, v] = splitDecl(decl);
        const cls = `${tbpProp}-${value}`;
        if (!enumRules.has(cls)) enumRules.set(cls, new Map());
        enumRules.get(cls)!.set(p, v);
      }
    }
  }

  // v14 literals: bounded literal channels ride the same rule shapes as
  // token bindings — base decls on .root, per-value overrides as enum-class
  // rules (validated in validateContract; refused channels never reach here).
  for (const [cssProp, lit] of Object.entries(root.literals ?? {})) {
    rootDecls.push(`${cssProp}: ${lit}`);
  }
  for (const { prop: lbpProp, map } of root.literalsByProp ?? []) {
    for (const [value, overrides] of Object.entries(map)) {
      const cls = `${lbpProp}-${value}`;
      for (const [cssProp, lit] of Object.entries(overrides)) {
        if (!enumRules.has(cls)) enumRules.set(cls, new Map());
        enumRules.get(cls)!.set(cssProp, lit);
      }
      // FC-BORDER-STYLE-NOT-SYNTHESISED — the per-variant literal width case.
      for (const decl of borderStyleDecls(overrides, 'literals', root.declared)) {
        const [p, v] = splitDecl(decl);
        if (!enumRules.has(cls)) enumRules.set(cls, new Map());
        enumRules.get(cls)!.set(p, v);
      }
    }
  }

  // v15 declared facts on the root: verbatim base decls (registry-validated
  // in validateContract; refused channels never reach here). A declared
  // `position` supersedes the emitter's own overlay-driven push.
  for (const [cssProp, value] of Object.entries(root.declared ?? {})) {
    if (cssProp === 'position' && rootDecls.includes('position: relative')) {
      if (value === 'relative') continue; // already emitted by overlay chrome
      rootDecls.splice(rootDecls.indexOf('position: relative'), 1);
    }
    rootDecls.push(`${cssProp}: ${value}`);
  }

  // a11y.minHitArea: the declared floor is ENFORCED, not aspirational — the
  // standard non-visual hit-target extension (an absolutely centered ::before
  // at max(100%, floor) per axis; it paints nothing and never affects layout,
  // but pointer events on it hit the component). Field failure: Button
  // declared 44 while the small size rendered a 36px-tall target and nothing
  // enforced the difference.
  const minHitArea = contract.a11y?.minHitArea;
  if (typeof minHitArea === 'number' && !rootDecls.includes('position: relative')) {
    rootDecls.push('position: relative');
  }

  lines.push('', '.root {');
  for (const d of rootDecls) lines.push(`  ${d};`);
  lines.push('}');
  // A2 grid (G4): a root grid's EMPTY areas own placeholder rules right
  // after the root rule — the placement is visible with nothing in it.
  lines.push(...gridPlaceholderRules('root'));
  lines.push(...rootSubRules);

  if (typeof minHitArea === 'number') {
    lines.push(
      '',
      '/* a11y.minHitArea: non-visual hit-target floor — see contract */',
      '.root::before {',
      "  content: '';",
      '  position: absolute;',
      '  left: 50%;',
      '  top: 50%;',
      `  width: max(100%, ${minHitArea}px);`,
      `  height: max(100%, ${minHitArea}px);`,
      '  transform: translate(-50%, -50%);',
      '}',
    );
  }

  if (contract.states.includes('focus-visible')) {
    lines.push('', '.root:focus-visible {', '  outline-style: solid;', '  outline-offset: 2px;', '}');
  }
  if (contract.states.includes('disabled') && contract.semantics.element === 'button' && !rootDeclaresCursor) {
    lines.push('', '.root:disabled {', '  cursor: not-allowed;', '}');
  }

  for (const [cls, decls] of enumRules) {
    lines.push('', `.${cls} {`);
    for (const [prop, value] of decls) lines.push(`  ${prop}: ${value};`);
    lines.push('}');
  }

  // v7 layoutByProp on the root: the enum class sits on the root element
  // itself, so the override rule targets it directly (emitted after .root
  // so the override wins at equal specificity).
  if (root.layoutByProp) {
    for (const [value, override] of Object.entries(root.layoutByProp.map)) {
      const decls = layoutOverrideDecls(override);
      if (decls.length === 0) continue;
      lines.push('', `.${root.layoutByProp.prop}-${value} {`);
      for (const d of decls) lines.push(`  ${d};`);
      lines.push('}');
    }
  }

  for (const [state, decls] of Object.entries(root.states ?? {})) {
    const sel = STATE_SELECTORS[state];
    if (!sel) {
      errors.push(`${contract.id}: unknown state "${state}"`);
      continue;
    }
    for (const [cssProp, ref] of Object.entries(decls)) {
      const refPath = stripBraces(ref);
      const phs = placeholdersIn(refPath);
      if (phs.length === 0) {
        if (checkToken(refPath, `anatomy.root.states.${state}.${cssProp}`)) {
          stateRules.push(`\n.root${sel} {\n  ${cssProp}: ${cssVar(refPath)};\n}`);
        }
        continue;
      }
      // N placeholders (enum and boolean alike) — one rule per value tuple on
      // the same compound selector the root's tokens take (.variant-primary
      // .size-sm:hover, .root[data-loading]:hover). One enum placeholder is
      // byte-identical to the former single-axis branch.
      for (const { combo, resolved } of expandRef(`anatomy.root.states.${state}.${cssProp}`, refPath)) {
        if (!checkToken(resolved, `anatomy.root.states.${state}.${cssProp}`)) continue;
        stateRules.push(`\n.${comboCls(combo)}${sel} {\n  ${cssProp}: ${cssVar(resolved)};\n}`);
      }
    }
  }
  // v17 statesByProp on the ROOT — the per-enum-value state rules. Emitted
  // into stateRules AFTER the plain `states` rules above, so where both bind a
  // channel for the same state the per-value rule wins at equal specificity
  // (identical to how tokensByProp's enum-class rules follow .root). Refs are
  // plain by schema, so there is no placeholder branch to mirror here.
  for (const entry of root.statesByProp ?? []) {
    const sel = STATE_SELECTORS[entry.state];
    if (!sel) continue; // unknown state already refused in validateContract
    for (const [value, overrides] of Object.entries(entry.map)) {
      for (const [cssProp, ref] of Object.entries(overrides)) {
        const refPath = stripBraces(ref);
        if (!checkToken(refPath, `anatomy.root.statesByProp.${entry.prop}.${value}.${entry.state}.${cssProp}`)) continue;
        stateRules.push(`\n.${entry.prop}-${value}${sel} {\n  ${cssProp}: ${cssVar(refPath)};\n}`);
      }
    }
  }
  lines.push(...stateRules);
  // v15 declaredStates on the root: verbatim state-selector rules, emitted
  // after the token state rules (a declared fact never shadows a binding —
  // they carry disjoint channels by the validateContract ambiguity rule).
  for (const [state, overrides] of Object.entries(root.declaredStates ?? {})) {
    const sel = STATE_SELECTORS[state];
    if (!sel) continue; // refused by validateContract
    const decls = Object.entries(overrides).map(([cssProp, value]) => `  ${cssProp}: ${value};`);
    if (decls.length > 0) lines.push('', `.root${sel} {`, ...decls, '}');
  }
  // v7 stylesWhen on the root part (emitted last so the condition wins).
  lines.push(...stylesWhenRules(contract, 'root', root, true));

  const usedAnimations = new Set<string>();
  // Nested parts (no substitutions; validated above).
  for (const { name, part, path: p } of walkAnatomy(contract)) {
    if (p[0] === 'root' && p.length === 1) continue;
    if (part.component) {
      // Round 2 iteration 9 — per-instance overrides: the ref part becomes a
      // structural WRAPPER class (the TSX wraps the instance in a span; the
      // child contract still owns ALL of its own styling) whose only job is
      // setting the child's override custom properties, which inherit into
      // the instance and land in the child's var() fallback chains.
      // inline-flex hugs the child, so layout (overlap margins included)
      // sees the same box as the bare instance.
      const ov = Object.entries(part.component.overrides ?? {});
      // A2 grid (G3/P12): an instance child of a grid parent rides a wrapper
      // element that IS the grid item — the wrapper class takes the cell and
      // display: grid stretches the lone instance into it (the CSS spelling
      // of the canvas FILL default). With overrides, the cell decls join the
      // override wrapper's rule (one wrapper, both jobs).
      const cell = gridPlan.cells.get(name);
      if (ov.length === 0 && cell) {
        lines.push('', `.${name} {`, ...[...cell, 'display: grid'].map((d) => `  ${d};`), '}');
      }
      if (ov.length > 0) {
        const wrapDecls: string[] = cell ? [...cell, 'display: grid'] : ['display: inline-flex'];
        const wrapSubRules: string[] = [];
        for (const [channel, ref] of ov) {
          const ovVar = refOverrideVar(part.component.id, channel);
          const refPath = stripBraces(ref);
          const phs = placeholdersIn(refPath);
          if (phs.length >= 1) {
            // Per-enum-value descendant rule under the root's variant class —
            // the nested-token-substitution rule shape.
            //
            // GAP-CLOSING ROUND 10 — THE ARITY LIFTED, AND THE REASON IS THE
            // SAME ONE AS THE NESTED TOKEN ABOVE. Round 8 refused a
            // two-axis per-usage ink here ("override refs carry at most 1")
            // and the consequence was a glyph drawn in the wrong ink rather
            // than a named approximation: Untitled UI's Social icon is white
            // on the brand themes, #a3a3a3 on Color and its own brand hex on
            // Color-with-brand — ink = f(social × theme) — so nothing carried
            // and 48 variants drew a WHITE glyph on a WHITE ground. An
            // override var is set on a wrapper that is a descendant of the
            // root, and every enum class rides the root, so N placeholders
            // are the compound ancestor selector, exactly as above.
            for (const combo of enumCombos(phs, enums)) {
              let resolved = refPath;
              for (const [ph, value] of combo) resolved = resolved.replaceAll(`{${ph}}`, value);
              if (!checkToken(resolved, `anatomy.${name}.component.overrides.${channel}`)) continue;
              const sel = combo.map(([ph, value]) => `.${ph}-${value}`).join('');
              wrapSubRules.push(`\n${sel} .${name} {\n  ${ovVar}: ${cssVar(resolved)};\n}`);
            }
            continue;
          }
          if (checkToken(refPath, `anatomy.${name}.component.overrides.${channel}`)) {
            wrapDecls.push(`${ovVar}: ${cssVar(refPath)}`);
          }
        }
        lines.push('', `.${name} {`, ...wrapDecls.map((d) => `  ${d};`), '}');
        lines.push(...wrapSubRules);
      }
      continue; // instances style themselves via their own contract
    }
    const decls: string[] = [];
    if (isStructural(part)) {
      if (part.layout?.display === 'grid') {
        // A2 grid (G1): a nested grid parent — tracks/gaps/areas/flow.
        decls.push(...gridPartDecls(name, part));
      } else {
        decls.push(`display: ${part.layout?.display ?? 'flex'}`);
        if (part.layout?.direction) decls.push(`flex-direction: ${part.layout.direction}`);
        if (part.layout?.wrap) decls.push('flex-wrap: wrap');
        if (part.layout?.align) decls.push(`align-items: ${ALIGN_CSS[part.layout.align]}`);
        else if (gridPlan.gridChildren.has(name)) decls.push(...gridChildCrossAxisDecls(part));
        if (part.layout?.justify) decls.push(`justify-content: ${JUSTIFY_CSS[part.layout.justify]}`);
      }
    }
    // A2 grid (G2/G4): this part's cell under its grid parent — grid-area
    // for area-anchored names, grid-row/grid-column (+ self aligns) for
    // explicit placement. Sizing stays UNSPELLED: stretch is the CSS grid
    // default and the pinned spelling of the canvas FILL (G3).
    decls.push(...(gridPlan.cells.get(name) ?? []));
    if (part.layout?.grow) decls.push('flex: 1 1 auto', 'min-width: 0');
    // UA-margin neutralization on NESTED parts (round 4): a promoted h2/p/ul
    // part would leak UA margins the real component resets — same discipline
    // as the root rule; captured nonzero margins arrive as minted overrides.
    if (part.element && UA_MARGIN_ELEMENTS.has(part.element)) decls.push('margin: 0');
    // v7 overlay: out of flow, attached to the root's edge.
    if (part.overlay) decls.push('position: absolute', ...OVERLAY_CSS[part.overlay.placement]);
    // v9 shape: parametric leaf decor — the ONE shared projection
    // (scripts/contract-schema.ts shapeCssDecls); placement/rotation-per-
    // variant ride stylesWhen rules below.
    if (part.shape) decls.push(...shapeCssDecls(part.shape));
    // Event-trigger buttons: neutralize UA button styles BEFORE token decls
    // so the contract's tokens (padding, background, font) win.
    if (part.element === 'button' && (contract.events ?? []).some((e) => e.trigger === name)) {
      decls.push(
        'appearance: none',
        'background: none',
        'border: none',
        'margin: 0',
        'padding: 0',
        'font: inherit',
        'color: inherit',
        'text-align: inherit',
        'cursor: pointer',
      );
    }
    // Round 4: a promoted TEXT-entry control (input/textarea/select part
    // that is not the checkable pattern) neutralizes UA chrome — mirrors
    // core/emit-html.ts.
    if (!isNativeCheckablePart(part) && (part.element === 'input' || part.element === 'textarea' || part.element === 'select')) {
      decls.push('appearance: none', 'border: none', 'background: transparent',
        'font: inherit', 'color: inherit', 'letter-spacing: inherit', 'margin: 0', 'padding: 0', 'outline: none');
    }
    // Native checkable inputs (input[type=checkbox|radio]): the REAL control
    // covers its presentational box invisibly — it stays the focusable,
    // checkable element while the box and glyphs draw the visual.
    if (isNativeCheckablePart(part)) {
      decls.push(
        'position: absolute',
        'inset: 0',
        'width: 100%',
        'height: 100%',
        'margin: 0',
        'padding: 0',
        'opacity: 0',
        'cursor: pointer',
      );
    }
    if (part.icon) {
      decls.push('display: inline-flex', 'flex-shrink: 0');
      if (part.icon.size) {
        lines.push('', `.${name} svg {`, `  width: ${part.icon.size}px;`, `  height: ${part.icon.size}px;`, '}');
      }
      if (part.element === 'button') {
        decls.push(
          'align-items: center',
          'justify-content: center',
          'background: none',
          'border: none',
          'padding: 0',
          'color: inherit',
          'cursor: pointer',
        );
      }
    }
    const nestedSubRules: string[] = [];
    if (part.animation) {
      decls.push(
        part.animation === 'spin'
          ? 'animation: ds-spin 0.8s linear infinite'
          : 'animation: ds-pulse 1.6s ease-in-out infinite',
      );
      usedAnimations.add(part.animation);
    }
    for (const [cssProp, ref] of Object.entries(part.tokens ?? {})) {
      const refPath = stripBraces(ref);
      // overlap: the gap token becomes a negative child margin (CSS gap
      // cannot be negative); the canvas side uses negative itemSpacing.
      // Single-placeholder refs expand per enum class (P21 minted per-axis
      // magnitudes), the nested-token-substitution rule shape.
      if (cssProp === 'gap' && part.layout?.overlap) {
        const overlapPhs = placeholdersIn(refPath);
        if (overlapPhs.length === 1) {
          for (const value of enums.get(overlapPhs[0]) ?? []) {
            const resolved = refPath.replaceAll(`{${overlapPhs[0]}}`, value);
            if (!checkToken(resolved, `anatomy.${name}.tokens.gap`)) continue;
            nestedSubRules.push(`\n.${overlapPhs[0]}-${value} .${name} > * + * {\n  margin-left: ${cssVar(resolved)};\n}`);
          }
        } else if (checkToken(refPath, `anatomy.${name}.tokens.gap`)) {
          nestedSubRules.push(`\n.${name} > * + * {\n  margin-left: ${cssVar(refPath)};\n}`);
        }
        continue;
      }
      const phs = placeholdersIn(refPath);
      if (phs.length >= 1) {
        // Per-enum-value descendant rule under the root's variant class.
        // ROUND 10: N placeholders → the cartesian of their values as a
        // COMPOUND ancestor selector (every enum class rides the root), the
        // same expansion the root's own multi-placeholder tokens take. A
        // combination whose leaf is missing is REFUSED BY NAME — `checkToken`
        // pushes a hard error and returns false, so the `continue` below only
        // stops this one rule from being written; the contract still fails.
        // (This comment used to say the combination was merely "skipped", which
        // read as though a sparse cartesian were tolerated. It is not, and that
        // is the whole reason `mintTokens` must supply a leaf for EVERY
        // declared combination — see the ragged-matrix pass there.)
        // A boolean placeholder rides the root's data attribute (or native
        // :disabled) exactly as on the root's own tokens — `.root[data-loading]
        // .label`; all-enum combos are byte-identical to the former enumCombos
        // expansion.
        for (const { combo, resolved } of expandRef(`anatomy.${name}.tokens.${cssProp}`, refPath)) {
          if (!checkToken(resolved, `anatomy.${name}.tokens.${cssProp}`)) continue;
          nestedSubRules.push(`\n.${comboCls(combo)} .${name} {\n  ${cssProp}: ${cssVar(resolved)};\n}`);
        }
        continue;
      }
      if (checkToken(refPath, `anatomy.${name}.tokens.${cssProp}`)) {
        // Round 2 iteration 9 — a nested part binding the SAME ref as the
        // root's overridable channel (a stub's glyph part) consumes the same
        // override var, so the part scales with the overridden root box.
        const sameAsRoot = rootTokens[cssProp] === ref;
        decls.push(`${cssProp}: ${sameAsRoot ? ovVal(cssProp, cssVar(refPath)) : cssVar(refPath)}`);
      }
    }
    // ROUND 9: the same carry-both-or-withhold-both rule as the root above —
    // a nested part with a border COLOUR and no width used to emit the style
    // keyword and let the UA's `medium` (3px) finish it. A part has no
    // `border: 0` reset to fall back to, so withholding here is simply not
    // writing the keyword: with no style, a border paints nothing whatever
    // the UA's width is.
    if (
      (part.tokens && 'border-width' in part.tokens) ||
      (part.literals && 'border-width' in part.literals)
    ) {
      decls.push('border-style: solid');
    }
    // FC-BORDER-STYLE-NOT-SYNTHESISED — the per-side LITERAL width on a nested
    // part (carbon Checkbox's ✓ glyph is a 0/0/1px/1px white corner and drew
    // nothing at all without this).
    decls.push(...borderStyleDecls(part.literals, 'literals', part.declared));
    // v10 tokensByProp on a nested part: descendant rule under the root's
    // enum class — exactly the nested-token-substitution rule shape.
    // v14: multiple entries emit in order (later entries win per channel).
    for (const entry of tokensByPropEntries(part)) {
      for (const [value, overrides] of Object.entries(entry.map)) {
        for (const [cssProp, ref] of Object.entries(overrides)) {
          const refPath = stripBraces(ref);
          // S2 capability lift: one-placeholder map refs expand as compound
          // enum-class descendant rules (both classes ride the root).
          const phs = placeholdersIn(refPath);
          if (phs.length === 1) {
            for (const phValue of enums.get(phs[0]) ?? []) {
              const resolved = refPath.replaceAll(`{${phs[0]}}`, phValue);
              if (!checkToken(resolved, `anatomy.${name}.tokensByProp.${value}.${cssProp}`)) continue;
              for (const single of [`${entry.prop}-${value}`, `${phs[0]}-${phValue}`]) {
                if (!enumRules.has(single)) enumRules.set(single, new Map());
              }
              nestedSubRules.push(
                `\n.${entry.prop}-${value}.${phs[0]}-${phValue} .${name} {\n  ${cssProp}: ${cssVar(resolved)};\n}`,
              );
            }
            continue;
          }
          if (!checkToken(refPath, `anatomy.${name}.tokensByProp.${value}.${cssProp}`)) continue;
          nestedSubRules.push(
            `\n.${entry.prop}-${value} .${name} {\n  ${cssProp}: ${cssVar(refPath)};\n}`,
          );
        }
        // FC-BORDER-STYLE-NOT-SYNTHESISED — a per-variant SHORTHAND width earns
        // the keyword in its own rule (round 9's rule, at a scope it never
        // reached).
        for (const d of borderStyleDecls(overrides, 'tokens', part.declared)) {
          nestedSubRules.push(`\n.${entry.prop}-${value} .${name} {\n  ${d};\n}`);
        }
      }
    }
    // v14 literals on a nested part: base decls + per-value descendant rules.
    for (const [cssProp, lit] of Object.entries(part.literals ?? {})) {
      decls.push(`${cssProp}: ${lit}`);
    }
    for (const entry of part.literalsByProp ?? []) {
      for (const [value, overrides] of Object.entries(entry.map)) {
        const lDecls = Object.entries(overrides).map(([cssProp, lit]) => `  ${cssProp}: ${lit};`);
        // FC-BORDER-STYLE-NOT-SYNTHESISED — polaris TextField's backdrop carries
        // its whole border as per-variant literals here, so the keyword has to
        // land in the per-variant rule or the border never paints.
        for (const d of borderStyleDecls(overrides, 'literals', part.declared)) lDecls.push(`  ${d};`);
        if (lDecls.length === 0) continue;
        nestedSubRules.push(`\n.${entry.prop}-${value} .${name} {\n${lDecls.join('\n')}\n}`);
      }
    }
    // v15 declared facts on a nested part: verbatim base decls + per-state
    // descendant rules under the root's state selector.
    for (const [cssProp, value] of Object.entries(part.declared ?? {})) {
      decls.push(`${cssProp}: ${value}`);
    }
    // Round 4: an absolutely-positioned REPLACED part (promoted Thumbnail
    // img) fills its inset box — for replaced elements, auto width under
    // inset-0 resolves to the intrinsic size, so the fill is emitter chrome.
    if (part.element === 'img' && part.declared?.['position'] === 'absolute') {
      decls.push('width: 100%', 'height: 100%');
    }
    for (const [state, overrides] of Object.entries(part.declaredStates ?? {})) {
      const sel = STATE_SELECTORS[state];
      if (!sel) continue; // refused by validateContract
      const dDecls = Object.entries(overrides).map(([cssProp, value]) => `  ${cssProp}: ${value};`);
      if (dDecls.length > 0) nestedSubRules.push(`\n.root${sel} .${name} {\n${dDecls.join('\n')}\n}`);
    }
    // v17 statesByProp on a NESTED part — the map form of the placeholder
    // branch just below: a descendant rule under the root's enum class AND
    // state selector (.variant-primary:hover .label). Emitted BEFORE the
    // plain `states` loop would be wrong (the per-value binding must win), so
    // it is pushed after it — see the block following this one.
    const partStatesByProp = part.statesByProp ?? [];
    // v13 part-level states (P18 second half): descendant rules under the
    // root's STATE selector — .root:disabled .label { color: … } — the same
    // STATE_SELECTORS the root states ride (native :disabled; hover/active
    // gated :not(:disabled)). Single-placeholder refs expand per enum value
    // on the root's enum class, exactly like the root's own state rules.
    for (const [state, overrides] of Object.entries(part.states ?? {})) {
      const sel = STATE_SELECTORS[state];
      if (!sel) continue; // refused by validateContract
      for (const [cssProp, ref] of Object.entries(overrides)) {
        const refPath = stripBraces(ref);
        const phs = placeholdersIn(refPath);
        if (phs.length === 0) {
          if (checkToken(refPath, `anatomy.${name}.states.${state}.${cssProp}`)) {
            nestedSubRules.push(`\n.root${sel} .${name} {\n  ${cssProp}: ${cssVar(refPath)};\n}`);
          }
          continue;
        }
        // N placeholders, enum and boolean — the root's state expansion one
        // level down (.variant-danger[data-loading]:hover .label).
        for (const { combo, resolved } of expandRef(`anatomy.${name}.states.${state}.${cssProp}`, refPath)) {
          if (!checkToken(resolved, `anatomy.${name}.states.${state}.${cssProp}`)) continue;
          nestedSubRules.push(`\n.${comboCls(combo)}${sel} .${name} {\n  ${cssProp}: ${cssVar(resolved)};\n}`);
        }
      }
    }
    // v17: the per-value state rules land AFTER the plain ones, so where both
    // bind a channel for the same state the map wins at equal specificity.
    for (const entry of partStatesByProp) {
      const sel = STATE_SELECTORS[entry.state];
      if (!sel) continue; // refused by validateContract
      for (const [value, overrides] of Object.entries(entry.map)) {
        for (const [cssProp, ref] of Object.entries(overrides)) {
          const refPath = stripBraces(ref);
          if (!checkToken(refPath, `anatomy.${name}.statesByProp.${entry.prop}.${value}.${entry.state}.${cssProp}`)) continue;
          nestedSubRules.push(`\n.${entry.prop}-${value}${sel} .${name} {\n  ${cssProp}: ${cssVar(refPath)};\n}`);
        }
      }
    }
    // v7 layoutByProp on a nested part: descendant rule under the root's
    // enum class — exactly the nested-token-substitution rule shape.
    if (part.layoutByProp) {
      for (const [value, override] of Object.entries(part.layoutByProp.map)) {
        const lDecls = layoutOverrideDecls(override);
        if (lDecls.length === 0) continue;
        nestedSubRules.push(
          `\n.${part.layoutByProp.prop}-${value} .${name} {\n${lDecls.map((d) => `  ${d};`).join('\n')}\n}`,
        );
      }
    }
    // A box holding a visually-managed native input anchors it and carries
    // the focus ring (the input is opacity:0, so its own outline is
    // invisible; :has lifts :focus-visible onto the visible box — the same
    // outline idiom as .root:focus-visible).
    for (const [childName, child] of Object.entries(part.parts ?? {})) {
      if (!isNativeCheckablePart(child)) continue;
      decls.push('position: relative');
      nestedSubRules.push(
        `\n.${name}:has(> .${childName}:focus-visible) {\n  outline-style: solid;\n  outline-offset: 2px;\n}`,
      );
    }
    // v7 stylesWhen on a nested part.
    nestedSubRules.push(...stylesWhenRules(contract, name, part, false));
    if (decls.length === 0 && nestedSubRules.length === 0) continue;
    if (decls.length > 0) {
      lines.push('', `.${name} {`);
      for (const d of decls) lines.push(`  ${d};`);
      lines.push('}');
    }
    // A2 grid (G4): a nested grid parent's EMPTY areas own placeholder rules
    // right after the parent's rule.
    lines.push(...gridPlaceholderRules(name));
    lines.push(...nestedSubRules);
    if (part.icon && part.element) {
      lines.push('', `.${name}Glyph {`, '  display: inline-flex;', '}');
    }
  }

  if (usedAnimations.has('spin')) {
    lines.push('', '@keyframes ds-spin {', '  to { transform: rotate(360deg); }', '}');
  }
  if (usedAnimations.has('pulse')) {
    lines.push('', '@keyframes ds-pulse {', '  0%, 100% { opacity: 1; }', '  50% { opacity: 0.45; }', '}');
  }

  return finishStylesheet(lines.join('\n') + '\n');
}

/** THE ONE EXIT EVERY STYLESHEET SURFACE TAKES.
 *
 *  Two registry dispositions cannot be written as a plain declaration, and
 *  both of them used to be able to reach a sheet verbatim from SOME surface:
 *
 *   · `canvas-only`     — refused by name (stripCanvasOnlyChannels).
 *   · `pseudo-element`  — LOWERED to its real rule
 *                         (lowerPseudoElementChannels).
 *
 *  Applied to the FINISHED css text, for the reason stripCanvasOnlyChannels
 *  already gives: there are eleven `decls.push` sites across the emitters and
 *  a filter no site can route around is worth more than eleven guarded
 *  pushes. The web-components emitter builds its OWN shadow stylesheet (it
 *  uses generateCss only as a validity referee and throws its CSS away), so
 *  it calls this too — otherwise a channel generateCss lowers would reach the
 *  shadow sheet as the invalid declaration, unnamed, and the referee could no
 *  longer catch it. `translate-x`/`translate-y` had exactly that latent hole. */
export function finishStylesheet(css: string): string {
  return lowerPseudoElementChannels(stripCanvasOnlyChannels(css));
}

/** RC7 — A PSEUDO-ELEMENT CHANNEL BECOMES ITS RULE, NOT A DECLARATION.
 *
 *  `placeholder-color: var(--field-hint)` is not a CSS declaration: no UA has
 *  ever had a `placeholder-color` property, so it is dropped in silence
 *  exactly the way `translate-y` was. The authored fact is a RULE on a
 *  pseudo-element — `.input::placeholder { color: var(--field-hint) }` — and
 *  that is what this writes.
 *
 *  Two properties this lowering must have, and does:
 *   · the lowered rule keeps its SOURCE POSITION (it is emitted immediately
 *     after the rule it came out of), so a later, more specific rule that
 *     also carries the channel still wins the cascade;
 *   · a multi-selector rule lowers EVERY selector in the list
 *     (`.a, .b {` → `.a::placeholder, .b::placeholder {`), so a grouped rule
 *     does not silently lose all but its first selector.
 *
 *  Idempotent (a sheet with no such channel is returned unchanged, and the
 *  emitted `::placeholder` rules carry `color`, never the channel name). */
export function lowerPseudoElementChannels(css: string): string {
  if (PSEUDO_ELEMENT_CHANNELS.length === 0) return css;
  if (!PSEUDO_ELEMENT_CHANNELS.some(([c]) => css.includes(`${c}:`))) return css;
  const byChannel = new Map(PSEUDO_ELEMENT_CHANNELS.map(([c, sel, prop]) => [c, { sel, prop }]));
  const declRe = new RegExp(`^(\\s*)(${PSEUDO_ELEMENT_CHANNELS.map(([c]) => c).join('|')})\\s*:\\s*([^\\n]*?);?\\s*$`);
  const lines = css.split('\n');
  const out: string[] = [];
  // The rule we are currently inside, as its raw selector lines. A rule opens
  // on a line ending in `{` and closes on a line whose only content is `}`.
  let openSelector: string[] | null = null;
  let pending: Array<{ sel: string; prop: string; value: string }> = [];
  for (const line of lines) {
    if (openSelector === null) {
      if (/\{\s*$/.test(line)) {
        // Collect the selector list: this line's prefix plus any preceding
        // lines that ended in `,` (a grouped selector spans lines).
        const selLines: string[] = [line.replace(/\s*\{\s*$/, '')];
        for (let j = out.length - 1; j >= 0 && /,\s*$/.test(out[j]); j--) selLines.unshift(out[j].replace(/,\s*$/, ''));
        openSelector = selLines;
      }
      out.push(line);
      continue;
    }
    const m = declRe.exec(line);
    if (m) {
      const spec = byChannel.get(m[2])!;
      const selectors = openSelector.map((s) => s.trim()).filter((s) => s.length > 0);
      pending.push({ sel: selectors.map((s) => `${s}${spec.sel}`).join(',\n'), prop: spec.prop, value: m[3] });
      continue;
    }
    if (/^\s*\}\s*$/.test(line)) {
      out.push(line);
      for (const p of pending) out.push('', `${p.sel} {`, `  ${p.prop}: ${p.value};`, '}');
      pending = [];
      openSelector = null;
      continue;
    }
    out.push(line);
  }
  // An emptied rule (its only declaration was the lowered channel) is noise.
  const kept: string[] = [];
  for (let i = 0; i < out.length; i++) {
    if (/\{\s*$/.test(out[i]) && out[i + 1] !== undefined && /^\s*\}\s*$/.test(out[i + 1])) { i++; continue; }
    kept.push(out[i]);
  }
  return kept.join('\n');
}

/** SILENT-LOSS ROUND (task #33, fix 4) — CANVAS-ONLY CHANNELS NEVER REACH A
 *  STYLESHEET AS AN INVALID DECLARATION, AND THE DROP IS NAMED.
 *
 *  `translate-x` / `translate-y` are SYNTHETIC channels minted by
 *  `decomposeTranslate` (extract/computed/lib.ts) so the canvas can fold a
 *  CSS transform into absolute x/y placement. They are NOT CSS properties —
 *  CSS `translate` is ONE property taking 1-3 values, with no per-component
 *  longhand. Until this round the emitters wrote `translate-y: var(…)` into
 *  the stylesheet verbatim; every UA dropped the declaration in silence and
 *  the artifact claimed the fact was carried.
 *
 *  Recomposing them into a single `translate:` declaration is NOT available:
 *  the repo's own contracts condition the two components on DIFFERENT axes
 *  (MUI Switch carries translate-y on the base rule and translate-x per
 *  {size}×checked), and `translate` being one property means the more
 *  specific rule would clobber the other component entirely. So the code
 *  surface REFUSES the declaration and says so, in the stylesheet, by name.
 *
 *  Applied to the FINISHED css text rather than at each `decls.push` site:
 *  there are eleven such sites across three emitters, and a filter no site
 *  can route around is worth more than eleven guarded pushes.
 */
export function stripCanvasOnlyChannels(css: string): string {
  const canvasOnly = Object.keys(TOKEN_CHANNELS).filter((c) => TOKEN_CHANNELS[c].css === 'canvas-only');
  if (!canvasOnly.some((c) => css.includes(`${c}:`))) return css;
  const dropRe = new RegExp(`^\\s*(${canvasOnly.join('|')})\\s*:[^\\n]*$`);
  const refused = new Set<string>();
  const kept: string[] = [];
  for (const line of css.split('\n')) {
    const m = dropRe.exec(line);
    if (m) { refused.add(m[1]); continue; }
    kept.push(line);
  }
  // A rule whose only declarations were canvas-only is now empty — drop it
  // (an empty rule is noise, and a selector with no body is not a fact).
  const out: string[] = [];
  for (let i = 0; i < kept.length; i++) {
    if (/\{\s*$/.test(kept[i]) && kept[i + 1] !== undefined && /^\s*\}\s*$/.test(kept[i + 1])) { i++; continue; }
    out.push(kept[i]);
  }
  const note = [
    '/* code-only facts — REFUSED BY NAME, not silently dropped:',
    ...[...refused].sort().map((c) => `     ${c}: ${TOKEN_CHANNELS[c].note}`),
    '   CSS has no per-component translate longhand and this contract conditions',
    '   the components on different axes, so no single `translate:` declaration',
    '   can carry them. The canvas lowers them to absolute placement. */',
  ].join('\n');
  return `${note}\n${out.join('\n').replace(/\n{3,}/g, '\n\n')}`;
}

