# Ground-truth image pairs — eyeball notes

Pairs: `out/<id>/figma.png` (Figma images API render of the COMPONENT_SET at
1x) vs `out/<id>/render.png` (Playwright full-page screenshot of the emitted
`preview.html`). Read side by side; divergences recorded honestly, causes
named where the fixtures prove them.

## A. Shoelace Tooltip — figma.png ↔ render.png

**Agrees**: dark pill (#27272a) ✓, white 14px label ✓, radius ✓, 8px padding ✓.
The pill itself is a faithful reproduction across all 8 placements.

**Diverges**:
- **No arrow.** Figma shows a directional triangle per placement; our render
  shows none. The arrow is a VECTOR node — dump v1 carries only its fill, no
  geometry (known #42, vectors). The `Arrow` part exists in the anatomy with a
  minted background-color but renders as a zero-size box.
- **Placement is inert.** All 8 placements render identically: the per-variant
  auto-layout differences (which side the arrow rides) collapsed to the default
  variant's layout — the propose note says so itself ("auto-layout differs
  across variants — using the default variant's").
- Arrow Wrapper's 16px inline padding on top/bottom placements: MISSING for
  the same reason (per-variant layout not modeled).

## B. Shoelace Button Group — figma.png only

emitHtml REFUSED (9 contract violations: the wrapped `Button` instances set
props unknown to the repo's ds.button — showLabel/label/isPill/…, plus a
non-PascalCase name). No render to pair. The Figma PNG stands as the target
the composite subject never got to draw. The refusal is the honest result:
a composite whose child contract lives in a DIFFERENT design system cannot be
emitted against the repo's ds.button.

## C. Eventz Button — figma.png ↔ render.png

**Agrees**: primary teal (#3d7a95) ✓ incl. hover/active darker teal ✓, white
label ✓, radius/padding ✓, knockout near-white ✓, disabled-without-restyle
consistent with the dump (see below).

**Diverges**:
- **secondary/bare render OPAQUE BLACK; Figma shows white-ish/transparent.**
  Root cause proven from `rest-nodes.json`: those fills are black at **5%
  opacity** (stroke black at 10%) — dump v1 drops paint opacity, so the minted
  token is opaque `#000002`. The styles score reports 0 value mismatches
  *against the dump*, and the image pair exposes that the dump itself lost the
  alpha. Capture gap, not minting gap.
- **Icons are placeholders.** `[startIcon slot]`/`[endIcon slot]` instead of
  play/pause: INSTANCE_SWAP design-time content is not carried by dump v1
  (noted in the proposal); slots render their placeholder.
- **Focus ring is a dot.** The `Focus ring` RECTANGLE has minted border
  facts but no geometry/offset — renders as a collapsed element instead of a
  surrounding ring.
- **Disabled variants don't wash out.** In the dump their root fills are
  IDENTICAL to enabled (verified against fixtures): the washed look in Figma
  rides paint opacity — same alpha capture gap as above.
- The subtle 1px outline (stroke black @10%) is absent: `border-color` was
  never minted (12 variants MISSING) and the alpha would have been wrong
  anyway.

## D. CBDS Button — cbds-button-design/figma.png ↔ cbds-button-code/render.png

The convergence pair: design truth vs the CODE-side proposal's render.

**Agrees** (the thesis receipt): primary background `#0e61ba` — byte-identical
hex on both sides' minted tokens; radius 8px both; padding-inline 16px
(medium/large) / 12px small both; label `#fcfeff` both.

**Diverges**:
- Design side has `state` variants (hover/focus/pressed/disabled) drawn as
  frames; code side models hover/disabled as CSS states (`states.hover`,
  `states.disabled` minted) — same facts, different axis (see D-convergence).
- Code side has variants design never drew (surface/danger/ghost) — kit is
  a single "Button-Brand Primary" set.
- Design-side emitHtml REFUSED (ds.icon has no contract in scope +
  non-PascalCase name + emoji prop binding), so the design-side pair is
  figma.png vs the code-side render.
- Slot placeholders `[iconLeft slot]`/`[children slot]` in the render (slots
  have no default content in the contract).

## Cross-cutting

- `variables.json` is `403` for every subject (Variables REST API is
  Enterprise-only) — the REST fills DO carry `boundVariables` ids, so the
  kit's own token names were one API tier away from being bindable instead
  of minted.

---

## Punch-list re-run (2026-07-09) — notes above kept verbatim

- **C. Eventz Button — Punch-1 verified.** `render.png` recaptured after the
  dump v1.1 remap: **secondary renders near-white with its light 10%-black
  border, bare renders fully transparent** — the Figma truth, where the
  original pass showed opaque black. The minted values are 8-digit hex
  (`#0000020d` at 5%, `#00000233` at 20% hover, `#00000200` bare). Still
  diverging, now precisely named: icons are slot placeholders (swap content
  not captured), focus ring collapses (RECTANGLE geometry, #42 class), and
  the **disabled wash-out is NODE opacity 0.4 on the variant root** — proven
  NOT to be paint alpha (disabled paints are byte-identical to enabled even
  with alpha captured); a separate capture channel, still open.
- **D. CBDS Button (design) — a design-side render.png now EXISTS.** After
  punches 2+3+5 (named refusal → ds.icon stub, icon toggles wired, emoji
  names sanitized) `preview.html` emits and screenshots: brand `#0e61ba`
  surface, per-size padding, state colors incl. pressed `#002854`, the
  disabled tooltip helper, and `iconLeft`/`iconRight` showcase rows with the
  stub's "Icon" placeholder. The design pair no longer has to borrow the
  code-side render.
- **B. Shoelace Button Group** — still figma.png only, refusal now 8
  violations (the non-PascalCase name violation is gone; the 8 foreign
  `ds.button` props remain the honest blocker).

### Style-fidelity addendum (dump v1.2 audit)

- **A. Shoelace Tooltip — placements finally differ.** `render.png`
  recaptured after layoutByProp landed end-to-end (propose → emit-react →
  emit-html): top/topLeft/topRight stack column with per-value alignment,
  bottom* stack column-reverse, right runs row-reverse — visible as
  per-placement offsets/alignment in the showcase. The arrow itself is
  still #42 (geometry not captured), now receipted per node
  (`vector-geometry-unsupported` ×8, `rotation-unsupported` ×6).
- **C. Eventz Button — the disabled wash-out is fixed.** The
  `isDisabled=true` showcase row renders at opacity 0.4 (dump v1.2 node
  opacity → `stylesWhen`), matching the Figma truth that dump v1.1 rendered
  at full ink. Remaining divergences unchanged and named: slot placeholder
  icons, #42 focus-ring rectangle.
- **D. CBDS Button (code)** — no visual change in the static render
  (states render on interaction), but the emitted CSS now carries
  `.root:active:not(:disabled)` per-variant pressed fills and the
  `:focus-visible` outline pair — inspectable in `Button.module.css` /
  `component.css`.

### Part-level state overrides addendum (P18 v13 — B7 retired, 2026-07-13)

- **D. CBDS Button (design) — the disabled label carries.** The kit draws
  the disabled label at #556275 on the #dfe3eb fill; under B7 that diff was
  a named note and the render drew the default #fcfeff — near-invisible on
  the disabled background (the owner's exact complaint, hit twice). The
  proposal now carries `Button.states.disabled.color =
  {imported.button-brand-primary.button-state-disabled.color}` (= #556275;
  the plugin-transport path binds his real `{text.disabled}`), the CSS
  surfaces render `.root:disabled .Button { color: … }`, and the canvas
  State=Disabled preview cells draw the gray label. styles-score: 84 cells,
  78→81 MINTED, 6→3 MISSING (the 3 left are the focus-ring radius — named
  by design), 0 mismatched.
- **D-convergence — the sides finally disagree honestly.** `label color
  (disabled)` moved CODE-ONLY → **DIVERGE**: design #556275 (the kit) vs
  code #738094 (the shipped CSS). That is a REAL kit↔code drift the matrix
  could not see while the design side was silent under B7 — surfaced, not
  smoothed. `font-weight` moved CODE-ONLY → AGREE (600 — the design side
  mints weights since the font-weight minting landed after the original
  run). Facts now **16 AGREE / 1 DIVERGE (real, named) / 2 CODE-ONLY /
  0 DESIGN-ONLY** (was 15/0/4/0 after the style-fidelity re-run).
- **Re-run scope note.** `propose-emit` replays at today's HEAD, so this
  re-run also picks up everything shipped since the last one: the Eventz
  slot design-time content now proposes Play/Pause geometry stubs
  (defaultContent), the Shoelace Tooltip mints its Regular font-weight, and
  the Shoelace Button group carries session-linking/threading notes.
  render.png recaptured for all four preview subjects; figma.png (ground
  truth) untouched — the fixtures did not change.
