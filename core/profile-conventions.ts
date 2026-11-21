/**
 * Engine conventions a system profile may switch on (GOAL.md, 2026-11-09: "An engine rule that a profile switches on
 * needs no second kit"). A profile names them in its `conventions`; this list is the converter's own, so an unknown
 * name is refused here by name, and a new convention lands here first, then in a profile. Every convention is off
 * unless a profile turns it on.
 */
/** icon-box-keeps-glyph-size (React to Figma writer): an icon part whose width/height is larger than its glyph, none
 *  smaller (a wrapper element folded into its icon part), is a box holding the glyph at its own size, laid out as the
 *  part declares, instead of a glyph stretched to the box. */
/** svg-rotation-carried (React to Figma contract step): Chromium spells every computed rotation as a matrix, which the
 *  declared `transform` vocabulary does not read; an svg element whose computed transform is a pure rotation is spelled
 *  rotate(<n>deg), so its icon part carries the turn the writer draws (FC-SVG-ROTATION). */
/** closed-select-draws-selected-label (React to Figma contract step): a closed single native select draws one line, its
 *  selected option's label, and its options draw nothing until it opens; the select part takes that label as its text
 *  and its option parts are dropped, instead of every option drawn as a box with its own text. */
/** styles-when-display-last-wins (React to Figma writer): the stylesWhen display rules that match a variant apply in
 *  order, the later winning as in CSS, so a part hidden on one axis and shown again on another draws; off, any matching
 *  display:none hides the part. */
/** absolute-overhang-whole-pixel (React to Figma writer): an absolute offset past the containing box's edge (an
 *  overhang, a tooltip centered under a narrower anchor) snaps outward to the whole pixel, as the browser's paint extent
 *  spans it; an offset inside the box is kept. Off, every offset is kept as measured (Figma-proposed geometry is exact). */
/** observed-swap-default-drawn (Figma to React proposal): a swap property's declared default that the set draws at every
 *  use, with no linked contract in scope, renders when the caller omits the swap, built from each use's captured drawing
 *  (instanceSwapContent) with its own paint and size; caller content replaces it. Off, the drawing is recorded and unread. */
/** negative-sibling-margin-as-gap (React to Figma writer): in-flow siblings that every inter-sibling margin pulls
 *  together by the same negative amount (rows overlapping a neighbor's 1px border) are laid out with that amount as the
 *  parent's negative itemSpacing, not each in a fixed margin box with its child placed. Off, the margin boxes stay. */
/** root-text-by-axis (React to Figma contract step): a root whose own literal text differs between variants carries it
 *  per value of the one variant axis that decides it (the root's textByProp); a root text that some variant does not
 *  draw, or that no single axis decides, is refused by name. Off, the root keeps the first variant's text. */
/** font-weight-initial-normal (React to Figma writer): a text that no part's font-weight reaches (a field's value or
 *  placeholder, a closed select's label, where the browser's own 400 is not an authored fact) draws at CSS's initial
 *  weight, normal (400, Regular), as the browser renders it. Off, it draws at the writer's fallback face (Medium). */
/** lost-text-realigns-by-class (React to Figma contract step): elements align across variants by tag and position; where
 *  that leaves a variant's own text on a part whose base element draws none (two different elements in one slot), the
 *  set aligns again by the class stems of the prefix the profile's capture config names. Off, position alone. */
/** text-align-packs-text-box (React to Figma writer): a text part's box with no layout of its own packs its text as its
 *  text-align places the line in CSS (center → CENTER, right/end → MAX), and a <button> part that declares no text-align
 *  takes the user-agent stylesheet's center (the contract step drops it as the element's own default). Off, the box
 *  packs its text at the start. */
/** variant-grid-whole-pixel (React to Figma writer): each column and row of a component set's variant grid steps by its
 *  cell's size rounded up, so a variant whose own size is fractional (a measured text width) still starts on a whole
 *  pixel, as its export does. Off, the grid steps by the exact sizes. */
/** outline-takes-no-layout (React to Figma writer): a stroke drawn from a CSS outline takes no layout space (the frame's
 *  strokesIncludedInLayout is false), as an outline never does in CSS. Off, it may inset the frame's children by its
 *  weight. */
/** stage-from-story-container (React to Figma contract step): the block-root and stage-fill width doors measure a root
 *  against the story page's own container, the viewport inset by the preview body's padding where the story's cell
 *  starts, so a block root that fills it carries that width. Off, they measure against the bare viewport. */
/** stretched-line-paints-bar (Figma to React proposal): a capless LINE turned a quarter turn at its parent's top-left
 *  edge, stretched vertically, whose length is its parent's height in every variant, is carried as the strip it paints
 *  (native LINE paint is local y in [-weight, 0] for every alignment): an absolutely placed bar, top to bottom, as wide as
 *  its stroke weight and filled with its stroke paint. Off, its varying length refuses the native line. */
/** absolute-in-containing-block (React to Figma contract step): an absolutely placed element's insets are measured from
 *  its containing block, the nearest positioned or transformed ancestor; where that is not its parent, the element is
 *  drawn in that ancestor (moved there in the captured tree, just after the child it sat under), unless an ancestor
 *  between them hides, clips or fades it. Off, it is drawn in its parent at insets measured from another box. */
/** empty-hug-keeps-extent (Figma to React proposal): a root HUG axis whose variant draws no visible children keeps its
 *  observed extent as that plane's minimum, as a HUG plane with only absolutely placed children already does; Figma
 *  draws an empty hug frame at its stored size, where CSS content sizing gives 0. Off, the plane renders 0 wide or tall. */
/** sized-text-box-packs-by-text-align (React to Figma writer): a bare text part with a fixed width or height and no
 *  layout or paint of its own, which the writer wraps in a box at run time, packs its line along that box as its
 *  text-align places it in CSS (start → MIN, center → CENTER, right/end → MAX). Off, the box centers it, as it does a
 *  drawn chip's glyph. */
/** bound-visibility-override-is-property (Figma to React proposal): a host's raw `visible` override on a node whose
 *  visibility is bound to a component BOOLEAN property, where the same host sets that property to the same value, is
 *  carried by that property and is not an independent visibility demand. Off, it is a demand of its own. */
/** text-box-stacks-block-children (React to Figma writer): a text part with child parts and no layout of its own is a
 *  CSS block container whose text is an inline run ahead of those parts; where the writer's block-flow rule stacks such
 *  a box (block-level children, no two inline runs side by side), its line sits above them, as a list item's text sits
 *  above its nested list. Off, the text and its child parts share one row. */
/** mixed-scale-rect-keeps-placement (Figma to React proposal): an absolutely placed plain rect whose uses mix SCALE
 *  with other constraints keeps each use's captured placement, each with its own constraint, as an all-SCALE rect
 *  already does. Off, the mixed part is refused SCALE placement and renders in flow. */
/** rect-placement-by-variant (Figma to React proposal): a rectangle placed absolutely in some variants and in flow in
 *  others, where which one is a function of one declared axis, takes each variant's own placement: absolute values get
 *  position absolute with their captured geometry (SCALE stays proportional), in-flow values their flow size. Off, the
 *  first absolute variant's box stands in for every variant. */
/** svg-viewbox-carried (React to Figma contract step): each svg's icon asset is drawn in the viewBox its page authored
 *  (read from the DOM in the capture's tree order) when it is square on a square svg box, so a 32-unit glyph on a 16 px
 *  svg keeps its scale. Off, the viewBox is reconstructed from the svg's computed size, bumped to the path extent when
 *  the path reaches past it. */
/** generated-text-carried (React to Figma contract step): the text a ::marker, ::before or ::after draws (a list's
 *  numbers and bullets) is read from Chromium's layout, where counter() is resolved, and becomes an absolutely placed span
 *  in its element at the offset the page drew it. Off, generated text is refused by name and not drawn. */
/** capture-marked-subject (React to Figma contract step): every case is captured from the element the reader marked as
 *  the instance's top, the element its reference was drawn from. Off, a case with no selected instance is captured from
 *  the cell's first drawn child, another element when the story draws one before the instance. */
/** variant-text-owns-its-part (React to Figma contract step): a part whose own text differs by variant and that also
 *  holds child parts (a list item with its nested list) gives that text to a new first child part, an inline run that
 *  owns the per-variant literal and inherits the part's text style. Off, that part keeps the first variant's text. */
/** normal-line-height-as-drawn (React to Figma contract step): a one-line text element whose computed line-height is
 *  `normal` takes the line height Chromium drew (its content-box height) as a px value, so its text keeps it rather than
 *  an ancestor's px line height (a button resets line-height to normal). Off, it inherits the ancestor's. */
/** svg-viewbox-meets-oblong-box (React to Figma contract step): with svg-viewbox-carried, a square authored viewBox on an
 *  oblong svg box (a 16 px wide select chevron as tall as its field) is taken too; the glyph square is centered in the box
 *  at the box's short side, as `xMidYMid meet` draws it. Off, that svg's viewBox is rebuilt from its long side and its
 *  glyph sits in the top-left corner of a square centered on the box. */
/** fixed-swap-drawing-carried (Figma to React proposal): an instance that fixes a nested child's swap to a component the
 *  converter cannot carry passes the swapped icon's captured drawing (fixedSwapDrawings) as caller content, when every
 *  child variant the instance selects has exactly one placement of that slot, so the child places it. Off, the slot is
 *  cleared (observed-swap-default-drawn) or keeps its default. */
/** unregistered-channel-not-minted (React to Figma contract step): a captured fact on a channel no registry carries
 *  (token, literal or declared: a flex item's `order`, a custom property) is left out of the mint and named, rather than
 *  minted as a token that makes validation refuse the whole set. Off, it is minted and the set is refused. */
/** synthetic-wrapper-shown-by-members (Figma to React proposal): a wrapper the wrapper-union fold synthesizes on a plane
 *  that draws its members flat is hidden only when every folded member is hidden, not because the first plane that drew
 *  the real wrapper hid it. Off, the copy keeps that plane's hidden flag and the fold names any drawn member it hides. */
/** vertical-fill-line-in-row (Figma to React proposal): a quarter-turn LINE stretched across its horizontal auto-layout
 *  parent is carried as a zero-width in-flow line over the row's height, so the row's gap still follows it and its stroke
 *  paints the bar Figma draws. Off, it is named and keeps the varying-line refusal (an unsized border box). */
/** inside-outside-stroke-as-outline (Figma to React proposal): a uniform stroke that takes no layout space and is drawn
 *  INSIDE in some variants and OUTSIDE in others is carried as one outline with a per-variant outline-offset (-weight
 *  INSIDE, 0 OUTSIDE), the spelling the CENTER mix already uses. Off, the mix is refused by name and drawn inside. */
/** swap-drawing-path-box-whole-pixel (Figma to React proposal): a path in a captured fixed-swap drawing whose box sits at a
 *  fractional offset starts its box on the whole pixel and draws the remainder inside its path data, so Chromium does not
 *  snap a half-pixel bar to one row. Off, the fractional offset is named. */
/** text-baseline-as-drawn (React to Figma contract step and writer): a part owning one line of literal text carries where
 *  the browser drew its baseline (Part.textBaseline, measured in the page), and the native Figma writer sets that text's
 *  glyph line so Figma draws the baseline there, in a box kept at the carried line height. Off, nothing is measured. */
/** table-short-row-leaves-columns-empty (React to Figma contract step): a table row with fewer cells than the widest
 *  takes the columns from the left, as CSS leaves its trailing cells empty, so the column widths are still admitted; the
 *  short row keeps the table's width when it measures a full row's width in every combo. Off, such a table admits no
 *  column widths and its cells hug. */
/** sized-text-baseline-as-drawn (React to Figma writer, with text-baseline-as-drawn): a text with a fixed width or height
 *  gets the drawn baseline too. The run time wraps a sized text in a box of that size, and the text inside keeps its own
 *  box at the carried line height, so the glyph line moves and nothing around it does. Off, a sized text is skipped. */
/** centered-text-keeps-drawn-width (React to Figma contract step): a part holding its own text that a flex row centers
 *  on its main axis keeps the width the browser drew. Figma sizes a text box to its advance rounded up to a whole pixel,
 *  so a box hugging it would be up to a pixel wider and sit half that far off center. Off, the width is not carried. */
/** text-baseline-rounds-like-figma (Figma to React proposal): with the profile's fontMetrics, a single-style TEXT part whose
 *  baseline Figma rounds to the nearest pixel and Chromium rounds down (ascent and descent rounded, odd leading pixel below;
 *  under geometricPrecision a rounded-down descent takes a pixel from the ascent) is shifted down by the difference
 *  (position: relative; top), which moves its glyphs and not its layout. Off, named. */
/** hugging-space-between-packs (React to Figma writer): a frame hugging its content on its main axis has no free space,
 *  so CSS space-between packs its items from the start with their gaps; Figma's SPACE_BETWEEN ignores item spacing, so such
 *  a frame with two or more items and a spacing packs at MIN. Off, SPACE_BETWEEN stays and the spacing does not draw. */
/** absolute-box-from-size-and-margins (React to Figma writer): an absolutely placed part sits a margin in from the inset that
 *  places it (an inset places the margin edge), and one with its own width or height between two insets keeps that size at
 *  the start inset (over-constrained in CSS; an auto inset reads back as its used value, so both are carried). Off, two
 *  insets stretch the part and its margins are not drawn. */
/** inline-block-line-box-as-drawn (React to Figma contract step and writer): an atomic inline (inline-block and its kin)
 *  alone on its line in a block container carries how far that line box reaches above and below its margin box (Part.lineBox,
 *  measured in the page: the parent line's strut and baseline alignment), and the native Figma writer adds that space to the
 *  part's margin box. Off, nothing is measured, and the part is stacked at its margin box as before. */
/** absolute-only-hug-keeps-extent (Figma to React proposal): a frame below the root that hugs an axis while every visible
 *  child is absolutely placed keeps, as that axis' minimum, the extent its children witness, where CSS would collapse it to
 *  its padding. Off, named. */
/** uncaptured-fill-variable-carried-as-paint (Figma to React proposal): a source fill that names a variable the dump
 *  carries no consumer for keeps its observed paint, and no binding is recreated. Off, the owner refuses (consumer-missing). */
// One name per line, sorted: two PRs that each add a convention insert at different lines and merge without conflict
// (2026-11-20). Order carries no meaning: the list is read only as a set (the Convention type and an includes check).
/** filled-child-keeps-margin-box (React to Figma writer): an in-flow child that grows or fills, with no negative margin,
 *  keeps its CSS margin box; the box takes the child's FILL and the child fills it, so the margin is drawn. Off, the
 *  margin box is skipped and the margin is named (FC-EMIT-MARGIN-BOX-SKIPPED). */
/** single-row-grid-as-row (React to Figma contract step): a part that is a grid in some values of one variant axis and not
 *  in the others, whose grid in every such variant has one non-empty row holding each in-flow child in its own column
 *  (each column as wide as its child, every other track 0), is drawn as a row in those values: a layoutByProp override
 *  with the grid's item alignment, its column gap, and its empty trailing tracks as end padding (gridAsRow). Any other
 *  such grid is named (grid-row-unlowered). Off, those values carry no layout. */
/** show-declared-component (React to Figma contract step): each case is rendered as the reader rendered it, naming the
 *  component the profile declares for that story (a story file's subcomponent, a skeleton), so the instance the reader
 *  framed is found and captured. Off, a case names no component, and a story whose instance is not the file's own
 *  component is refused as not one element. */
/** field-value-without-axes (React to Figma contract step): a text field that draws the same value in every variant, or
 *  in a set with no variant axes, carries that value as a per-variant text table with no props, so the writer draws it.
 *  Off, a set with no axes draws the field empty and a set with axes refuses the table by name. */
/** svg-own-fill-on-host (React to Figma contract step): an element holding nothing but one svg whose own CSS fill differs
 *  from the element's takes that fill, so when the svg folds into it as its icon the glyph keeps the fill the browser drew
 *  (CSS fill inherits, so the svg draws the same). Off, the folded glyph takes the element's text color. */
export const CONVENTIONS = [
  'absolute-box-from-size-and-margins',
  'absolute-in-containing-block',
  'absolute-only-hug-keeps-extent',
  'absolute-overhang-whole-pixel',
  'bound-visibility-override-is-property',
  'capture-marked-subject',
  'centered-text-keeps-drawn-width',
  'closed-select-draws-selected-label',
  'empty-hug-keeps-extent',
  'field-value-without-axes',
  'filled-child-keeps-margin-box',
  'fixed-swap-drawing-carried',
  'font-weight-initial-normal',
  'generated-text-carried',
  'hugging-space-between-packs',
  'icon-box-keeps-glyph-size',
  'imperceptible-solid-paint-blend-not-carried',
  'inline-block-line-box-as-drawn',
  'inside-outside-stroke-as-outline',
  'lost-text-realigns-by-class',
  'mixed-scale-rect-keeps-placement',
  'negative-sibling-margin-as-gap',
  'normal-line-height-as-drawn',
  'observed-swap-default-drawn',
  'outline-takes-no-layout',
  'rect-placement-by-variant',
  'root-text-by-axis',
  'show-declared-component',
  'single-row-grid-as-row',
  'sized-text-baseline-as-drawn',
  'sized-text-box-packs-by-text-align',
  'stage-from-story-container',
  'stretched-line-paints-bar',
  'styles-when-display-last-wins',
  'svg-own-fill-on-host',
  'svg-rotation-carried',
  'svg-viewbox-carried',
  'svg-viewbox-meets-oblong-box',
  'swap-drawing-path-box-whole-pixel',
  'synthetic-wrapper-shown-by-members',
  'table-short-row-leaves-columns-empty',
  'text-align-packs-text-box',
  'text-baseline-as-drawn',
  'text-baseline-rounds-like-figma',
  'text-box-stacks-block-children',
  'uncaptured-fill-variable-carried-as-paint',
  'unregistered-channel-not-minted',
  'variant-grid-whole-pixel',
  'variant-text-owns-its-part',
  'vertical-fill-line-in-row',
] as const;
export type Convention = (typeof CONVENTIONS)[number];

export function conventionSet(names: readonly string[] | undefined): ReadonlySet<Convention> {
  for (const name of names ?? []) if (!(CONVENTIONS as readonly string[]).includes(name)) throw Error(`profile-convention-unknown:${name}`);
  return new Set((names ?? []) as Convention[]);
}

/** Half an 8-bit alpha step: a solid paint below it moves each 8-bit channel of the composite by under half a step, under
 *  NORMAL or MULTIPLY alike (|blend − backdrop| ≤ 1), so an 8-bit render rounds to the backdrop's value. A render kept at
 *  higher precision can still differ. */
export const IMPERCEPTIBLE_ALPHA = 0.5 / 255;

type Composed = { paint?: { blendMode: string; opacity: number }; variableId?: string };

/**
 * imperceptible-solid-paint-blend-not-carried: a solid paint with a non-NORMAL blend mode and alpha under half an 8-bit
 * step (opacity × 255 < 0.5) moves each 8-bit channel by under half a step, so its blend mode is not carried: the node
 * reads as the mapper's NORMAL peer of the same paint (a `sourceNormalFillComposition`, none on TEXT, and a one-paint raw
 * stack reading NORMAL). NORMAL paints, strokes and multi-paint raw stacks are untouched.
 * Reach: every `sourceFillComposition` in a variant's tree, at any depth (children, instance roots, instance content).
 * A set whose every composed fill is so read no longer enters the composed-fill pipeline, so it raises none of the
 * pipeline's 11 `solid-fill-composition-*` throws (packages/core/src/css.ts). A set with any other composed fill still
 * enters it, with these nodes read as NORMAL.
 * This is the one node-level view of the composed-fill fact: applied once, to a copy of the dump, at the public batch
 * door, so every read downstream sees it. The dump itself is not changed. Returns the copy and, per dump key, each layer
 * path whose blend mode was dropped, with that mode.
 */
export function imperceptibleBlendView(dump: Record<string, unknown>): { dump: Record<string, unknown>; dropped: Map<string, Map<string, string>> } {
  const copy = structuredClone(dump), dropped = new Map<string, Map<string, string>>();
  for (const [key, value] of Object.entries(copy)) {
    const set = value as { variants?: unknown[] };
    if (!Array.isArray(set?.variants)) continue;
    const paths = new Map<string, string>();
    const walk = (node: unknown, path: string): void => {
      if (Array.isArray(node)) { for (const item of node) walk(item, path); return; }
      if (!node || typeof node !== 'object') return;
      const n = node as Record<string, unknown>, composed = n.sourceFillComposition as Composed | undefined;
      if (composed?.paint && composed.paint.blendMode !== 'NORMAL' && composed.paint.opacity < IMPERCEPTIBLE_ALPHA) {
        // The mapper's NORMAL peer: none on TEXT (a NORMAL text paint is typography), the NORMAL composition elsewhere,
        // and a one-paint raw stack reading NORMAL too (extract/figma/rest/map.ts, sourceFillComposition and its peer).
        delete n.sourceFillComposition;
        if (n.type !== 'TEXT') n.sourceNormalFillComposition = { paint: { ...composed.paint, blendMode: 'NORMAL' }, ...(composed.variableId !== undefined ? { variableId: composed.variableId } : {}) };
        const stack = n.sourceFillStack as { paints?: Array<{ paint?: { blendMode?: string } }> } | undefined;
        if (stack?.paints?.length === 1 && stack.paints[0]!.paint) stack.paints[0]!.paint.blendMode = 'NORMAL';
        paths.set(path, composed.paint.blendMode);
      }
      for (const [k, v] of Object.entries(n)) {
        if (k === 'children' && Array.isArray(v)) for (const child of v) walk(child, `${path}/${String((child as { name?: unknown })?.name ?? '')}`);
        else if (v && typeof v === 'object') walk(v, path);
      }
    };
    for (const variant of set.variants) walk(variant, '(root)');
    if (paths.size) dropped.set(key, paths);
  }
  return { dump: copy, dropped };
}

/** A profile's font vertical metrics (font units), keyed by the family name the dump carries. */
export type FontVerticalMetrics = Readonly<Record<string, {unitsPerEm: number; ascender: number; descender: number}>>;
