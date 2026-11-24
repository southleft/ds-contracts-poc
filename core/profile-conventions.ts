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
/** closed-select-draws-selected-label (React to Figma contract step and writer): a closed single native select draws one
 *  line, its selected option's label, and its options draw nothing until it opens; the select part takes that label as its
 *  text and its option parts are dropped, instead of every option drawn as a box with its own text. The writer draws that
 *  line centered on the select box's vertical axis, as Chromium lays out a menulist. */
/** styles-when-display-last-wins (React to Figma writer): the stylesWhen display rules that match a variant apply in
 *  order, the later winning as in CSS, so a part hidden on one axis and shown again on another draws; off, any matching
 *  display:none hides the part. */
/** absolute-overhang-whole-pixel (React to Figma writer): an absolute offset past the containing box's edge (an
 *  overhang, a tooltip centered under a narrower anchor) snaps outward to the whole pixel, as the browser's paint extent
 *  spans it; an offset inside the box is kept, and one that rounds to 0 at the browser's 1/64 px layout unit (a float
 *  residue) is placed at 0. Off, every offset is kept as measured (Figma-proposed geometry is exact). */
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
/** text-decoration-line-by-axis-drawn (React to Figma contract step and writer): a text decoration that varies but
 *  factors on one enum axis (Carbon's inline Link underlined, its sized links not) is carried as a per-value stylesWhen
 *  text-decoration rule for each value that paints a line, and the writer draws it in that value. Off, such a decoration is code-only. */
/** text-baseline-as-drawn (React to Figma contract step and writer): a part owning one line of literal text carries where
 *  the browser drew its baseline (Part.textBaseline, measured in the page), and the native Figma writer sets that text's
 *  glyph line so Figma draws the baseline there, in a box kept at the carried line height. Off, nothing is measured. */
/** overlay-size-not-control-default (React to Figma contract step): the control-equal door drops a channel equal to the
 *  bare control's as a browser default, but a control's width and height measure its own probe text; a textless part
 *  the overlay-cluster door admits keeps a px width or height that equals the control's (RadioButton's 18 px circle). */
/** drawn-border-color-not-folded (React to Figma contract step): a border side color equal to the part's own color folds
 *  into it, as CSS's currentcolor; a side that draws (solid, wider than 0 on some plane) keeps its color instead, because
 *  a Figma stroke has no currentColor and the writer strokes only a carried color. Other styles (an hr's inset) still fold. */
/** shrunk-text-wraps-at-drawn-width (React to Figma contract step and writer): a part's own text that a flex row shrank
 *  until it wrapped (not growing, white-space normal, two or more lines) carries, per variant where it wraps, the width its
 *  lines broke at and the lines drawn (Part.textWrap); the writer gives the TEXT that width once laid out, lets it grow to
 *  its lines, and names a different line count. Figma auto layout has no flex-shrink, so off the text draws on one line. */
/** inset-ring-absent-border-zero (React to Figma writer): a zero-blur inset box-shadow ring is drawn as an inside stroke
 *  when every border side is zero; a part that carries no border fact at all (its 0 px widths dropped as the browser's
 *  default) counts as zero too, instead of keeping an inner shadow that Figma may not draw. Off, only explicit zeros count. */
/** text-box-snapped-as-painted (React to Figma writer, at run time, with text-baseline-as-drawn): Figma draws a text whose
 *  box sits off the whole pixel half a row off its carried baseline. Once laid out, a baseline box centered in a horizontal
 *  row moves onto the whole pixel (round half up), its height and glyph line both changed by -2d so its top moves by d and
 *  its baseline stays put; under 0.05 px is left alone, and the move is undone if the row's size changes. Off, nothing moves. */
/** relative-offset-drawn (React to Figma writer): a part positioned relative keeps its flow box and draws shifted by
 *  left/top (-right/-bottom where left/top are not carried), placed in its margin box with overflow visible, so siblings do
 *  not move. A part with a measured line box keeps today's lowering. Off, the offset is not drawn. */
/** text-box-snapped-in-placed-box (React to Figma writer, at run time, with text-box-snapped-as-painted): a baseline box off
 *  the whole pixel that its row does not center (Button's label at xs sits at y 2.5, its row aligned to the top by a 1.5 px
 *  padding and a 1 px border) is held in a box of its own size at its place in the flow and drawn inside it on the whole
 *  pixel, its glyph line moved so its baseline stays put; a growing, filling, stretched or visibility-bound text is left
 *  alone, and the box is undone if the row's size changes. Off, such a text is not moved. */
/** wrapped-text-truncates-at-its-box (React to Figma writer, at run time): a truncating text (text-overflow: ellipsis) the
 *  writer holds in a styled box (it carries a fill, a size or bindings) keeps its own width inside it, so its ellipsis never
 *  draws and it spills past the box (Tag's long label: 224 px of text in a 192 px box). Once laid out, such a text two pixels
 *  or more wider than its box takes the box's width, its height fixed; a hugging box or a text that fits is left alone. Off,
 *  the text keeps its own width. */
/** normal-letter-spacing-is-zero (React to Figma contract step): a part spaced in some variants and computing `normal` in
 *  others (Carbon's Link: 0.32px small, 0.16px medium, normal large) mints `normal` as the 0px it computes to, so the
 *  channel mints per variant instead of going code-only and drawing no spacing anywhere. Off, such a channel is code-only. */
/** table-short-row-leaves-columns-empty (React to Figma contract step): a table row with fewer cells than the widest
 *  takes the columns from the left, as CSS leaves its trailing cells empty, so the column widths are still admitted; the
 *  short row keeps the table's width when it measures a full row's width in every combo. Off, such a table admits no
 *  column widths and its cells hug. */
/** sized-text-baseline-as-drawn (React to Figma writer, with text-baseline-as-drawn): a text with a fixed width or height
 *  gets the drawn baseline too. The run time wraps a sized text in a box of that size, and the text inside keeps its own
 *  box at the carried line height, so the glyph line moves and nothing around it does. Off, a sized text is skipped. */
/** align-self-center-in-stretched-box (React to Figma contract step and writer): a flex child the browser centers on its
 *  parent's cross axis (align-self: center) carries alignSelf: center, and the writer draws it in a box that draws nothing,
 *  stretches across the parent and centers it, its margins as the box's padding (Figma has no per-child cross-axis
 *  alignment). Off, nothing is carried and the child takes its parent's alignment. */
/** text-baseline-as-painted (React to Figma contract step, with text-baseline-as-drawn): the carried baseline is where
 *  Chromium painted it, not where it laid it out: the laid-out baseline rounded half up to the whole pixel, with the subject
 *  on a whole pixel as the reader draws it. Off, the laid-out baseline is carried. */
/** svg-box-snapped-as-painted (React to Figma writer, at run time): Chromium paints an svg at its box snapped to the
 *  whole pixel, rounded half up; once a component is laid out, each svg's drawing moves onto that pixel, relative to its
 *  variant, from where Figma's own layout put it. Moves under 0.05 px, and rotated svgs, are left alone. Off, nothing moves. */
/** set-cell-pads-variant-overhang (React to Figma writer, at run time): a component set clips its variants, so each edge
 *  and gap of the variant grid holds what the variants draw outside themselves (at least the 40 px padding), measured once
 *  they are laid out. With no overhang the grid is unchanged. Off, the padding is 40 px whatever a variant draws past it. */
/** root-text-baseline-as-drawn (React to Figma contract step and writer, with text-baseline-as-drawn): the root's own
 *  one-line text carries its baseline too, read in a flex or grid root by wrapping the text in a span for the probes (only
 *  where the wrap leaves its box in place), and the writer draws it on the root's label. Off, the root's text is not read. */
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
/** linked-child-keeps-its-stacking (Figma to React proposal): an instance whose key-linked child agrees with it on layout
 *  direction but not on canvas stacking draws with the child's own stacking, and the instance's override is named as not
 *  carried. Off, the owner refuses (child-paint-order-owner-unqualified). */
/** enum-presence-keeps-the-gate (Figma to React proposal): a part absent from some planes of an enum axis, whose visibility
 *  is also bound to a BOOLEAN and whose layout table covers only its drawn planes, keeps the enum presence as its gate, and
 *  the BOOLEAN hides it with display: none. Off, the absent planes are display: none styles and the BOOLEAN is the gate, so
 *  that table fails the contract's coverage rule. */
/** gated-layout-drops-undrawn-rows (Figma to React proposal): a part whose gate (visibleWhen or presenceByCombination)
 *  never draws it on some planes, but whose layout table also holds rows for those planes, keeps only the rows its gate
 *  draws. Off, the table keeps every row and fails the contract's coverage rule for a gated part. */
/** drawing-path-box-whole-pixel-by-value (Figma to React proposal): a path in a captured drawing whose box sits at a
 *  fractional offset starts its box on the whole pixel and draws the remainder inside its path data, so Chromium does not
 *  draw a half-pixel glyph crisp. It covers path data that varies by one prop (per value, under a fixed-swap drawing or an
 *  observed swap default) and one path for every variant under an observed swap default; a fixed-swap drawing's single
 *  path is swap-drawing-path-box-whole-pixel's. Off, the fractional offset stays, and Chromium paints the box on whole pixels. */
/** text-align-by-combination (Figma to React proposal): a text whose alignment differs across variants and that no
 *  single enum axis decides is carried per drawn combination of the fewest axes that do decide it (a literalsByCombination
 *  text-align table), so each variant's line sits where Figma places it. Off, the mixed alignment is named, not proposed. */
/** text-box-whole-pixel-beside-fixed-width (Figma to React proposal): a text box that sizes itself to its text in some
 *  variants and has a fixed width in the rest keeps the whole-pixel box when a literal combination row carries each
 *  fixed variant's drawn width and no auto-width variant; those rows clamp the box (min-width = max-width), so the
 *  rounded-up width holds only where Figma sized the box to its text. Off, the mixed case is refused by name. */
/** gated-part-hidden-by-boolean (Figma to React proposal): a part that already carries a presence gate (visibleWhen or
 *  presenceByCombination, from the planes where it is absent) and whose captured hidden channel, over the occurrences
 *  that draw it, is exactly one boolean axis's false (or true) keeps its gate, and that boolean hides it with a stylesWhen
 *  display: none. Off, the hidden channel is named as uncorrelated and the part draws in those variants. */
/** instance-root-alignment-carried (Figma to React proposal): a key-linked instance that overrides its main's primary- or
 *  counter-axis alignment (primaryAxisAlignItems / counterAxisAlignItems), with the same value at every use, carries it
 *  as the component's rootAlignment, which the React surfaces apply to the child's flex root as justify-content /
 *  align-items. Off, the override is named as not modeled by root inputs and the child keeps its own alignment. */
/** container-part-availability-by-path (Figma to React proposal): a FRAME or GROUP part that owns parts, is drawn in
 *  only some variants and is hidden by a host's instance override gets an availability table from the same exact
 *  original-path membership a leaf uses (its own node, by path and bytes, in each source main), so the host's visibility
 *  control cannot target a plane where the part is absent. Off, the demand is refused and the child set is not proposed. */
/** repeated-wrapper-name-not-folded (Figma to React proposal): a wrapper name that one variant draws on two or more
 *  sibling containers names several nodes, so the wrapper-union fold does not give the flat variants one synthetic copy
 *  of it; nested and flat hierarchies are kept, and the presence rule gates each. Off, the name folds as one wrapper
 *  and its first node's layout holds every flat member (two stacked texts drawn side by side in one row). */
/** imperceptible-outside-stroke-spread-shadow-as-outline (Figma to React proposal): a spread-only drop shadow around an
 *  imperceptible OUTSIDE stroke is drawn as an outline offset by the stroke's weight (spreadShadowOutlineView). Off, the
 *  shadow is a box-shadow from the border box: its ring sits one stroke weight too far in. */
/** partly-bound-text-visibility-carried (Figma to React proposal): a TEXT node whose visibility some variants bind to a
 *  BOOLEAN, exactly one boolean axis's true (or false), while the rest draw it unbound, keeps it as drawn where unbound
 *  and gates it on the BOOLEAN where bound (stylesWhen: hidden on that axis value, shown again where the BOOLEAN is true).
 *  Off, the binding is not carried and the text draws in every variant. */
// One name per line, sorted: two PRs that each add a convention insert at different lines and merge without conflict
// (2026-11-20). Order carries no meaning: the list is read only as a set (the Convention type and an includes check).
/** filled-child-keeps-margin-box (React to Figma writer): an in-flow child that grows or fills, with no negative margin,
 *  keeps its CSS margin box; the box takes the child's FILL and the child fills it, so the margin is drawn. Off, the
 *  margin box is skipped and the margin is named (FC-EMIT-MARGIN-BOX-SKIPPED). */
/** single-block-child-fills-its-box (React to Figma writer): a block-flow part with no layout of its own (not the root)
 *  whose only in-flow child is block-level stacks it as CSS does, the vertical stretching stack two or more such children
 *  already get, so the child fills its box's width (Carbon's nested Layer). Off, the box keeps the row default and the
 *  child hugs its content. */
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
/** line-break-alone-draws-empty-line (React to Figma writer): in a vertical auto-layout stack, where the writer's block
 *  flow puts each in-flow child on its own line, a <br> that follows a line holding content ends that line and draws
 *  nothing; a <br> that starts the stack or follows another <br> is alone on its line and draws one empty line, a frame
 *  of its line height. Out of flow, or under any other layout, a <br> is drawn as before. Off, every <br> is an empty
 *  frame that fills the stack's height. */
/** bare-icon-keeps-its-margins (React to Figma writer): an icon part drawn as a bare glyph (no box of its own) keeps the
 *  margins it declares when it stays in flow and none is negative: a uniform gap between siblings becomes the stack's
 *  spacing, and the rest is the padding of a hugging auto-layout margin box around the glyph, as for any other child.
 *  Off, a bare glyph's margins are dropped. */
/** wrapped-text-baseline-as-drawn (React to Figma contract step and writer): a part's literal text the browser drew on
 *  several lines is read too, at its first line, and marked wrapped (text-baseline-as-drawn reads only one line). The
 *  writer keeps its line height and moves the text whole, by the difference between that first baseline and the one Figma
 *  draws, in an auto-layout box of the text's own size (padding only), so every line moves together. Off, such a part
 *  carries no baseline and is drawn on Figma's own. */
/** block-root-fills-its-parent (React to Figma contract step): a display:block root in normal flow (not floated, not
 *  absolute or fixed) whose used width equals its parent element's content box in every case fills that box, as CSS
 *  does, so the block-root width door measures it against that box instead of the stage (a story's grid column). A root
 *  of another width keeps the stage and its named refusal; the stage-fill door (non-block roots) is not touched. */
/** float-ratio-strut-sets-min-height (React to Figma contract step): a block part (border-box) whose ::before is an empty,
 *  unpainted float of no width with a percentage top padding (its stylesheet declares nothing else there), and whose
 *  ::after is an empty clearfix (clear: both), is at least that padding tall plus its own vertical padding and borders,
 *  the same in every variant that draws it: the part carries that min-height and the two pseudos are not refused. Any
 *  other shape keeps its flow-pseudo refusals. */
export const CONVENTIONS = [
  'absolute-box-from-size-and-margins',
  'absolute-in-containing-block',
  'absolute-only-hug-keeps-extent',
  'absolute-overhang-whole-pixel',
  'align-self-center-in-stretched-box',
  'bare-icon-keeps-its-margins',
  'block-root-fills-its-parent',
  'bound-visibility-override-is-property',
  'capture-marked-subject',
  'centered-text-keeps-drawn-width',
  'closed-select-draws-selected-label',
  'container-part-availability-by-path',
  'drawing-path-box-whole-pixel-by-value',
  'drawn-border-color-not-folded',
  'empty-hug-keeps-extent',
  'enum-presence-keeps-the-gate',
  'field-value-without-axes',
  'filled-child-keeps-margin-box',
  'fixed-swap-drawing-carried',
  'float-ratio-strut-sets-min-height',
  'font-weight-initial-normal',
  'gated-layout-drops-undrawn-rows',
  'gated-part-hidden-by-boolean',
  'generated-text-carried',
  'hugging-space-between-packs',
  'icon-box-keeps-glyph-size',
  'imperceptible-outside-stroke-spread-shadow-as-outline',
  'imperceptible-solid-paint-blend-not-carried',
  'inline-block-line-box-as-drawn',
  'inset-ring-absent-border-zero',
  'inside-outside-stroke-as-outline',
  'instance-root-alignment-carried',
  'line-break-alone-draws-empty-line',
  'linked-child-keeps-its-stacking',
  'lost-text-realigns-by-class',
  'mixed-scale-rect-keeps-placement',
  'negative-sibling-margin-as-gap',
  'normal-letter-spacing-is-zero',
  'normal-line-height-as-drawn',
  'observed-swap-default-drawn',
  'outline-takes-no-layout',
  'overlay-size-not-control-default',
  'partly-bound-text-visibility-carried',
  'rect-placement-by-variant',
  'relative-offset-drawn',
  'repeated-wrapper-name-not-folded',
  'root-text-baseline-as-drawn',
  'root-text-by-axis',
  'set-cell-pads-variant-overhang',
  'show-declared-component',
  'shrunk-text-wraps-at-drawn-width',
  'single-block-child-fills-its-box',
  'single-row-grid-as-row',
  'sized-text-baseline-as-drawn',
  'sized-text-box-packs-by-text-align',
  'stage-from-story-container',
  'stretched-line-paints-bar',
  'styles-when-display-last-wins',
  'svg-box-snapped-as-painted',
  'svg-own-fill-on-host',
  'svg-rotation-carried',
  'svg-viewbox-carried',
  'svg-viewbox-meets-oblong-box',
  'swap-drawing-path-box-whole-pixel',
  'synthetic-wrapper-shown-by-members',
  'table-short-row-leaves-columns-empty',
  'text-align-by-combination',
  'text-align-packs-text-box',
  'text-baseline-as-drawn',
  'text-baseline-as-painted',
  'text-baseline-rounds-like-figma',
  'text-box-snapped-as-painted',
  'text-box-snapped-in-placed-box',
  'text-box-stacks-block-children',
  'text-box-whole-pixel-beside-fixed-width',
  'text-decoration-line-by-axis-drawn',
  'uncaptured-fill-variable-carried-as-paint',
  'unregistered-channel-not-minted',
  'variant-grid-whole-pixel',
  'variant-text-owns-its-part',
  'vertical-fill-line-in-row',
  'wrapped-text-baseline-as-drawn',
  'wrapped-text-truncates-at-its-box',
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

type Ring = { weight: number; spread: number; color: { hex: string; alpha?: number } };
/** A node whose one stroke is OUTSIDE, uniform, unbound and imperceptible (alpha × 255 < 0.5), and whose one effect is an
 *  unbound DROP_SHADOW with no offset, no blur and a positive spread, outside any effect style. */
function spreadShadowRing(n: Record<string, unknown>): Ring | undefined {
  const stroke = n.stroke as { alpha?: number } | undefined, effects = n.effects as Array<Record<string, any>> | undefined;
  if (!stroke || !((stroke.alpha ?? 1) < IMPERCEPTIBLE_ALPHA) || n.strokeAlign !== 'OUTSIDE' || n.strokeWeights !== undefined) return undefined;
  const weight = n.strokeWeight;
  if (typeof weight !== 'number' || !Number.isFinite(weight) || !(weight > 0)) return undefined;
  if (Object.keys((n.bound ?? {}) as object).some(k => /stroke|effect/i.test(k)) || n.effectStyle !== undefined) return undefined;
  if (!Array.isArray(effects) || effects.length !== 1) return undefined;
  const [e] = effects;
  if (e!.type !== 'DROP_SHADOW' || e!.bound !== undefined || (e!.offset?.x ?? 0) !== 0 || (e!.offset?.y ?? 0) !== 0 || (e!.radius ?? 0) !== 0) return undefined;
  if (typeof e!.spread !== 'number' || !Number.isFinite(e!.spread) || !(e!.spread > 0) || !/^[0-9a-fA-F]{6}$/.test(e!.color?.hex ?? '')) return undefined;
  return { weight, spread: e!.spread, color: e!.color };
}

/**
 * imperceptible-outside-stroke-spread-shadow-as-outline: Figma casts a drop shadow from the node's outer edge, its OUTSIDE
 * stroke included, and knocks the shadow out under the node and that stroke (Figma's default; showShadowBehindNode is
 * not captured). So a spread-only shadow around an imperceptible OUTSIDE stroke of weight w is a ring `spread` wide that
 * starts w outside the box, with nothing painted between. A CSS box-shadow starts at the border box, and widening its
 * spread by w would paint that band. The view reads such a node as an OUTSIDE stroke of the shadow's color and spread
 * with no effect, and returns w per node id: the outline-offset its outline takes.
 * Reach: every node in a variant's tree, at any depth (children, instance roots, instance content), with a node id.
 * Applied once, to a copy of the dump, at the public batch door. The dump itself is not changed. Returns the copy, the
 * offsets, and per dump key the layer paths read so.
 */
export function spreadShadowOutlineView(dump: Record<string, unknown>): { dump: Record<string, unknown>; offsets: Map<string, number>; ringed: Map<string, Set<string>> } {
  const copy = structuredClone(dump), offsets = new Map<string, number>(), ringed = new Map<string, Set<string>>();
  for (const [key, value] of Object.entries(copy)) {
    const set = value as { variants?: unknown[] };
    if (!Array.isArray(set?.variants)) continue;
    const paths = new Set<string>();
    const walk = (node: unknown, path: string): void => {
      if (Array.isArray(node)) { for (const item of node) walk(item, path); return; }
      if (!node || typeof node !== 'object') return;
      const n = node as Record<string, unknown>, ring = typeof n.nodeId === 'string' ? spreadShadowRing(n) : undefined;
      if (ring) {
        n.stroke = { ...ring.color };
        n.strokeWeight = ring.spread;
        delete n.effects;
        offsets.set(n.nodeId as string, ring.weight);
        paths.add(path);
      }
      for (const [k, v] of Object.entries(n)) {
        if (k === 'children' && Array.isArray(v)) for (const child of v) walk(child, `${path}/${String((child as { name?: unknown })?.name ?? '')}`);
        else if (v && typeof v === 'object') walk(v, path);
      }
    };
    for (const variant of set.variants) walk(variant, '(root)');
    if (paths.size) ringed.set(key, paths);
  }
  return { dump: copy, offsets, ringed };
}

/** A profile's font vertical metrics (font units), keyed by the family name the dump carries. */
export type FontVerticalMetrics = Readonly<Record<string, {unitsPerEm: number; ascender: number; descender: number}>>;
