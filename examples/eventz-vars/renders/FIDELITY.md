# Eventz canvas→code fidelity — 2026-08-08 @ HEAD

Score = % of pixels REPRODUCED, measured at the reference's own true scale with the two ROOT BOXES anchored — the untitled-ui v2.1 kernel verbatim (see examples/untitled-ui/fidelity-score.mts for its full derivation and the two measured blindnesses it replaced), with three named deltas for this kit. (1) TRUE SCALE IS 1 BY CONSTRUCTION — references come from the REST images API at scale=1 (fetch-references.mts), not a hand shooter's min(2, 600/w) rule; verified over all 108 references against the dump's variant bboxes: 0 negative overflows, residuals all explainable positives (74 exact, 8px focus rings, 1px rounding, 120px Molecules/Alert shadow). (2) state=active is interaction-state alongside hover|focus — Eventz crosses state=default|hover|active|focus with its variant axes; the hover/active carriage is CSS pseudo-class rules via statesByProp (v17), real but not reachable by a static screenshot. (3) The drawn boxes come from dumps/MERGED.json, the kit's only committed dump. TOLERANCE unchanged: a reference pixel is reproduced when some pixel in its 3x3 neighbourhood of the render is within 10 PER CHANNEL; the denominator is the union of the two ink rectangles, never the frame. DELIBERATELY IGNORED, same as uui: sub-pixel and 1px placement; the component's position on the page; effect ink beyond the render clip's 8px margin — which BITES here: Molecules/Alert's canvas shadow reaches ~60px/side, so most of its shadow is absent from the render and scores as missing by design. MEASURED FLOOR: Figma-vs-Chrome glyph rasterisation differs beyond the one-pixel escape on nearly every stem, and this harness loads NO webfonts (FC-FONT-SUBSTRATE), so text-dominated rows read compressed. Trend metric, not the final gate.

| component | variants scored | mean fidelity % | axis-not-carried | interaction-state | unscored |
|---|---|---|---|---|---|
| atoms-badge | 15 | 23.5 | 0 | 0 | 0 |
| atoms-button | 8 | 59.8 | 0 | 16 | 0 |
| atoms-icon-button | 10 | 65.3 | 0 | 20 | 0 |
| atoms-checkbox | 4 | 89.9 | 0 | 5 | 0 |
| atoms-input | 6 | 84.1 | 0 | 7 | 0 |
| atoms-tag | 5 | 34.3 | 0 | 8 | 0 |
| molecules-alert | 4 | 30.1 | 0 | 0 | 0 |
| **ALL** | 52 | **50.7** | | | |

## Honest residual notes — where the score goes, named

Lead finding first, then the classes already on the record (NOTES.md, dumps/MERGED.json _degradations, or the harness header). None is silently healed; each costs this table points wherever it applies.

- **VOID-ELEMENT MOUNT — ENGINE DEFECT, CLOSED (was this kit's headline).** The name/axis inference proposed `semantics.element: "input"` for Atoms/Checkbox and Atoms/Input (uui's input-field-base drew no such name and got `div`), and core/emit-react.ts mounted the anatomy's drawn children INSIDE that element — `<input>` is a void element, React refuses it at mount, and every Checkbox and Input row rendered NOTHING (their 10 default-plane rows were the `unscored` column). Both halves now exist: validateContract refuses children-inside-a-void-element BY NAME on every emit surface (eval `refuse-void-element-children-mount`), and proposeFromDump demotes a void inference over drawn children to a `div` container root with a REVIEW re-root note (eval `design-void-element-re-root`) — the committed contracts carry that demoted shape, both components render, and their rows score in the table above. The re-root remains a REVIEW item: the container div draws the layout, but no native `<input>` control is mounted until a reviewer re-roots the anatomy, so the semantic control itself is still absent from the render.
- **GRADIENT_LINEAR fills omitted** — dump v1 carries solid paints only, so the accent and featured Badge grounds (and any other gradient paint) were refused by name at capture; the render draws NO ground there and every such pixel scores as missing.
- **textCase UPPER dropped** — the dump's typography projection carries (fontSize, fontStyle, style identity) only, so the canvas's "LABEL" renders as "Label". Named in _degradations per variant.
- **icons-\* are STUBS** — the icon child sets were never imported; their contracts carry the observed bounding box and primary paint only (the stub-geometry rule), so every glyph drawing scores as a colored box at best.
- **FC-FONT-SUBSTRATE** — render-one loads no webfonts; the kit's text renders in whatever the OS resolves for Inter/system-ui. Glyph substrate differs wholesale from the canvas's, on top of the Figma-vs-Chrome rasterisation floor.
- **Molecules/Alert shadow clipped** — the canvas export carries ~60px of shadow per side; the render clip's 8px margin keeps at most 8px of it, so the rest is missing by design (the uui tooltip limitation, larger here).
- **Dark plane unexercised** — tokens.css flattens the BASE (Light) captured tree; the 43 variables that differ in Dark are carried in the committed light/dark trees but no dark render is scored.
- **hover/active/focus planes unscored** — carried as CSS pseudo-class rules (statesByProp), counted in the interaction-state column, not rendered statically.

## Lane wiring

`npm run eventz:fidelity` re-renders and re-scores (Chromium, ~1–2s/variant); it is not a CI lane. The fidelity:uui:fresh precedent applies unchanged: the scoring kernel runs canvas drawImage resampling inside Chromium, so byte-identity of fidelity.json across OSes is UNVERIFIED — a fresh-gate would join a lane only after one Linux run reproduces the committed table byte-for-byte, and unlike uui this kit has no accuracy:check floor holding its per-set means yet. Until then the committed fidelity.json + geometry sidecar keep the table re-derivable locally via FIDELITY_RESCORE=committed.

## v2.0 metric, same renders (attribution only)

Score = % pixels within tolerance under the superseded v2.0 rule (content-trim + 200px normalize, 90-summed-channel tolerance), computed from the SAME renders in the SAME run as the v2.1 table so the shift between the two tables is the metric and nothing else.

| component | variants scored | mean fidelity % | axis-not-carried | interaction-state | unscored |
|---|---|---|---|---|---|
| atoms-badge | 15 | 13.0 | 0 | 0 | 0 |
| atoms-button | 8 | 59.7 | 0 | 16 | 0 |
| atoms-icon-button | 10 | 67.3 | 0 | 20 | 0 |
| atoms-checkbox | 4 | 69.5 | 0 | 5 | 0 |
| atoms-input | 6 | 82.7 | 0 | 7 | 0 |
| atoms-tag | 5 | 48.6 | 0 | 8 | 0 |
| molecules-alert | 4 | 87.9 | 0 | 0 | 0 |
| **ALL** | 52 | **52.2** | | | |
