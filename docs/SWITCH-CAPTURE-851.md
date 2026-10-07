# Switch capture diagnosis, iteration 851

The prior turn was planning only. This iteration used retained inputs; no REST
requests, Figma writes, or full scoreboard reruns were needed.

## Browser capture correction

The eight Switch scroll refusals reproduce on the retained built consumer with
the previous capture implementation. Twelve SVG path client rectangles change
by less than 0.001 px after scrolling. Computed styles, local SVG bounding boxes,
and document-space SVG transforms remain exactly equal. This is consistent with
precision loss in distant viewport-relative SVG client rectangles.

The capture stability witness now uses exact local bounds, document transform,
and path data for SVG paths. Other element geometry and all computed styles and
pseudo styles remain checked. There is no epsilon, pixel alignment search, or
image scoring change. A path-data change is refused even if its bounds stay equal.

Same eight inputs and diagnostic capture regions: 8 refusals before, 8 captures
after. Regions include five pixels around each root; this is a capture stability
experiment, not proof of complete paint or a fidelity grade. The retained app
predates the fresh export's additional icon visibility metadata.

Validation: typecheck and targeted oxlint pass; 11 scroll/export tests pass.
The first test attempt had a Chromium screenshot protocol error in an existing
baseline screenshot; the complete second run passed.

## Separate source export issue remains

All 320 retained layout/render source pairs were compared only at their recorded
origin offsets. Largest white/black composited channel delta is 4.0157/255.
Only 50 pairs have identical alpha throughout the overlap. The first case has
35 RGB differences, four alpha differences, and maximum composited delta 2/255.
These observations suggest small rendering differences; they do not establish a
qualified origin. Exact export-overlap refusal remains unchanged.

No new scoreboard passes are claimed. Historical mixed forward remains
2112/6312 (33.46%); independent reverse has 2203 unqualified states. Fresh Switch
last full result remains 0 pass / 156 fail / 164 unverified.

Evidence: `private/beta-kits/slider-geometry-diagnosis-2026-10-01/paired-regression-integration/switch-capture-851/`
in the V1 checkout. Includes before/after capture results, source overlap analysis,
and exact SVG geometry diagnostics.

Next: seek an independent source-origin witness for one Switch state. Do not
repeat the 320-case network run until one case qualifies under the existing rules.
