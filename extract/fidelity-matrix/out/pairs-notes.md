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
