# Eventz canvas→code fidelity — 2026-08-08 @ HEAD

Score = % of pixels REPRODUCED, measured at the reference's own true scale with the two ROOT BOXES anchored — the untitled-ui v2.1 kernel verbatim (see examples/untitled-ui/fidelity-score.mts for its full derivation and the two measured blindnesses it replaced), with three named deltas for this kit. (1) TRUE SCALE IS 1 BY CONSTRUCTION — references come from the REST images API at scale=1 (fetch-references.mts), not a hand shooter's min(2, 600/w) rule; verified over all 108 references against the dump's variant bboxes: 0 negative overflows, residuals all explainable positives (74 exact, 8px focus rings, 1px rounding, 120px Molecules/Alert shadow). (2) state=active is interaction-state alongside hover|focus — Eventz crosses state=default|hover|active|focus with its variant axes; the hover/active carriage is CSS pseudo-class rules via statesByProp (v17), real but not reachable by a static screenshot. (3) The drawn boxes come from dumps/MERGED.json (the kit's committed plugin dump), with dumps/REST-RECOVERY.json grafting the two dump-v1.16 channels the v1.11 capture predates (GRADIENT_LINEAR fills, textCase — see NOTES.md's REST recovery section). TOLERANCE unchanged: a reference pixel is reproduced when some pixel in its 3x3 neighbourhood of the render is within 10 PER CHANNEL; the denominator is the union of the two ink rectangles, never the frame. DELIBERATELY IGNORED, same as uui: sub-pixel and 1px placement; the component's position on the page; effect ink beyond the render clip's 8px margin — which BITES here: Molecules/Alert's canvas shadow reaches ~60px/side, so most of its shadow is absent from the render and scores as missing by design. MEASURED FLOOR: Figma-vs-Chrome glyph rasterisation differs beyond the one-pixel escape on nearly every stem, and this harness loads NO webfonts (FC-FONT-SUBSTRATE), so text-dominated rows read compressed. Trend metric, not the final gate.

| component | variants scored | mean fidelity % | axis-not-carried | interaction-state | unscored |
|---|---|---|---|---|---|
| atoms-badge | 15 | 61.2 | 0 | 0 | 0 |
| atoms-button | 8 | 63.7 | 0 | 16 | 0 |
| atoms-icon-button | 10 | 67.7 | 0 | 20 | 0 |
| atoms-checkbox | 4 | 89.9 | 0 | 5 | 0 |
| atoms-input | 6 | 91.5 | 0 | 7 | 0 |
| atoms-tag | 5 | 29.8 | 0 | 8 | 0 |
| molecules-alert | 4 | 30.1 | 0 | 0 | 0 |
| **ALL** | 52 | **63.1** | | | |

## Honest residual notes — where the score goes, named

Lead finding first, then the classes already on the record (NOTES.md, dumps/MERGED.json _degradations, or the harness header). None is silently healed; each costs this table points wherever it applies.

- **VOID-ELEMENT MOUNT — ENGINE DEFECT, CLOSED (was this kit's headline).** The name/axis inference proposed `semantics.element: "input"` for Atoms/Checkbox and Atoms/Input (uui's input-field-base drew no such name and got `div`), and core/emit-react.ts mounted the anatomy's drawn children INSIDE that element — `<input>` is a void element, React refuses it at mount, and every Checkbox and Input row rendered NOTHING (their 10 default-plane rows were the `unscored` column). Both halves now exist: validateContract refuses children-inside-a-void-element BY NAME on every emit surface (eval `refuse-void-element-children-mount`), and proposeFromDump demotes a void inference over drawn children to a `div` container root with a REVIEW re-root note (eval `design-void-element-re-root`) — the committed contracts carry that demoted shape, both components render, and their rows score in the table above. The re-root remains a REVIEW item: the container div draws the layout, but no native `<input>` control is mounted until a reviewer re-roots the anatomy, so the semantic control itself is still absent from the render.
- **GRADIENT_LINEAR fills — CARRIED for axis-aligned ramps; oblique refused BY NAME (was the post-void-close headline).** Dump v1.16 captures linear-gradient fills (handles + stops — extract/figma/dump.plugin.js and rest/map.ts both produce them); the committed dump is a v1.11 capture, so dumps/REST-RECOVERY.json grafts exactly the 16 gradients its own `paint-unsupported` receipts name (fetch-rest-recovery.mts, same file, provenance in NOTES.md). The 12 Badge grounds are HORIZONTAL two-stop ramps and carry exactly: background-image per-variant minted `gradient` leaves, normalized to the box's VISIBLE SEGMENT (the raw handles run x≈2.15 → x≈-0.006, so the box shows the 53%–100% slice of the ramp; a naive full-ramp spelling would repaint most of the ground) — the badge 23.5 → 61.2 movement; the residual is FC-FONT-SUBSTRATE plus stub icon boxes. The 4 Molecules/Alert grounds are OBLIQUE ramps, REFUSED BY NAME (a CSS gradient angle lives in pixel space while the handles are normalized object space, so the exact angle/stop scale is a function of the drawn box's aspect ratio — no size-independent carriage; NOTES.md holds the refusal with the raw handles), so Alert still draws no gradient ground here, honestly.
- **textCase UPPER — CARRIED** as the declared `text-transform` channel (dump v1.16 `text.textCase`, the same REST recovery grafting the 10 receipted facts) — Badge labels now render "LABEL"; SMALL_CAPS remains a named receipt.
- **atoms-tag 34.3 → 29.8 — a TRUE fact interacting with a pre-existing refusal, named.** The U+2024 fold lets Tag's `padding-block: {spacing.1-5}` (6px) carry, so the rendered box now has the canvas's padding — but Tag's GROUND is still absent (`Atoms/Tag:root fill: token paths differ in depth`, the pre-existing mixed-depth refusal, untouched this round), and the correctly-taller box exposes more unpainted pixels to the scorer. The padding is a drawn fact; the missing ground is the named debt.
- **U+2024 variable names — FOLDED, a named RENAME.** Variables like "spacing/1․5" (ONE DOT LEADER) used to refuse 16 bindings by name; the dump v1.16 fold carries them as {spacing.1-5} with a rename receipt per variable per set (button/icon-button/input padding now binds — part of their gains).
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
| atoms-badge | 15 | 58.6 | 0 | 0 | 0 |
| atoms-button | 8 | 61.2 | 0 | 16 | 0 |
| atoms-icon-button | 10 | 73.5 | 0 | 20 | 0 |
| atoms-checkbox | 4 | 69.5 | 0 | 5 | 0 |
| atoms-input | 6 | 85.5 | 0 | 7 | 0 |
| atoms-tag | 5 | 48.6 | 0 | 8 | 0 |
| molecules-alert | 4 | 87.8 | 0 | 0 | 0 |
| **ALL** | 52 | **67.1** | | | |
