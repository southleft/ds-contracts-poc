# Visual hill climb — 2026-09-14

This is a work log, not a grade or release approval. No Figma nodes were changed.

## Letter-spacing continuation

The additive dump typography field now carries observed tracking in pixels;
percentage values resolve against the observed font size, never a guessed size.
Uniform signed values use the existing literal vocabulary. Mixed or partial
observations remain explicitly named. Both ordinary text parts and hoisted root
text use the same conversion. Existing dumps without the field remain unchanged.

The browser regression first failed with `normal` instead of the source `1px`,
then passed after the fix. A planted missing tracking value now changes the
computed-style comparison as well. Tests cover signed values, percentages,
missing font size, mixed/partial observations, and the root-text path.

Playwright CLI measured the updated Label at 57.265625×20 against Figma's 57×20.
Chromium's platform-font inspection confirms `PublicSans-SemiBold` rendered all
five glyphs (not a fallback). No width compensation was added. The remaining
fractional width and raster differences are still measurements, not an exact
pixel-parity claim. Existing source observations and owner-only fields are unchanged.

The remaining pixels are now scored too: all Badge variants pass the existing
antialias-aware threshold. Raw mismatch percentages remain in the record.
Portable evidence lives under `recipe/evidence/canvas-to-code-visual-v1/altitude-badge/`;
`recipe:canvas-to-code:check` re-derives it and refuses changed crops, missing
states, altered metrics, image tampering, or changed emitted code. This is one
set's visual result, not a claim that every designer-exam subject visually passes.

## Badge regression

Read-only export of Altitude Badge (`3538:35772`, page `6587:47476`) was compared
with the emitted React component in pinned Chromium via Playwright CLI.
The source has five label variants and five dot variants. Before this fix,
all dots rendered at 0×0 rather than the observed 8×8, and corner radii were lost.

The generic fixes preserve multiple independent token axes, carry a complete
root bounding-box census, and allow the existing mixed HUG/FIXED size path when
bindings are only partial. HUG labels remain fluid; child-frame geometry policy
is unchanged. Regression tests were observed failing before the fixes.

After rebuilding, Playwright measured all five dots at 8×8 and label radius at
999px. A second red-before-green fix recovers observed padding on partially bound
sides, without replacing successfully carried binding identities. This fallback
names the identity loss and uses provisional measured tokens, not guessed values.
Labels now have 8px side padding and measure 52.265625×20 (previously 36.265625×20)
against the source's 57×20. The source's 1px letter spacing is explicitly
receipted but not carried by the dump vocabulary; font substrate also needs
checking independently. This is **not**
a visual pass. The generated browser regression checks dots, padding, and radius.
The regenerated Badge receipt independently checks the accounting improvement;
run `npm run recipe:canvas-to-code:held-out:v2:check`.

Other affected receipts were regenerated from their unchanged observations.
The partial-padding fix also removes one named Menu padding delta; other measured
accounting results do not change. Frozen signed lineages and owner-only fields
were not modified. Source-line audit registers were re-derived after the edits;
the broad local fast run exposed these stale references rather than hiding them.

## Next bounded steps

### Final honesty audit: coverage populations (2026-09-14)

Reading the full README exposed stale counts the old wording-specific checker
missed (116 components/nine libraries; six in the generated report; 291 golden
files). The current corpus has 133 scorecards across 11 libraries and 292 golden
files. Its mean uses 132 nonempty comparisons; the zero-cell scorecard remains
explicitly excluded, never treated as a perfect match.

More importantly, the published 113/1015 coverage fraction mixed populations:
Fluent's 11 covered components enlarged the numerator without a measured Fluent
library size in the denominator. A new regression failed on **113 != 102** before
the fix. Known-size coverage is now **102/1015 (10.0%) over eight libraries**;
11 covered components with unknown library size remain separately counted.
Overall coverage is unknown. The recorded size units are heterogeneous, so even
the matched-cohort fraction is explicitly a proxy, not harmonized family coverage.
No scorecard, capture, source component, owner field, or Figma node changed.

Generator and checker derive the cohort independently. Four regression tests
cover unknown-size exclusion, invalid inputs, stale worded/numeric claims, and
tampered total/subtotal tables; all pass. `docs:check` now runs those tests.
The existing capability eval was first observed red on its old caveat wording,
then updated to require the new cohort/exclusion caveat twice, without weakening
the denominator, missing-source, cross-check or freshness guards. The targeted
eval passes (subset only, no full-suite record written). Docs, capability
freshness, 25 definition tests, definition check, package formatting, and scoped
lint pass. Exact-commit full CI and final readiness remain required.

### Integration guard caught a stale plugin receipt (2026-09-14)

Candidate `4ba75cece` failed the full lane's plugin packaging guard: the core
fixes changed the bundled engine from 864984 to 866257 bytes, while the recorded
input hash still described the previous core. `npm run plugin:zip` reproduced
the named STALE refusal locally. The existing receipt generator re-derived
`figma-sync/plugin/engine.receipt.json`; no source, signed lineage, or screenshot
baseline was changed. Fresh `plugin:zip`, `plugin:check`, and `plugin:ui-check`
all passed locally (including all browser UI assertions, no console/page errors).
The full eval suite is remeasured separately, not presumed green
from the receipt update. Pending job status alone is not evidence that completed
steps passed; monitoring must include failed step conclusions.

1. Fresh held-out code→Figma screenshots are now portable committed evidence in
   `recipe/evidence/live-fidelity-2026-09-14/`; `npm run recipe:fidelity:check`
   re-derives every score and checks hashes, repeated renders, and coverage.
2. Partial padding and tracking are now measured; preserve the padding identity-loss note.
3. Score the remaining raster differences separately from accounting; validate each affected
   component against its actual source screenshot before claiming visual parity.
4. Run readiness on a merged commit with successful lanes for that exact SHA.

Local capture directory:
`private/f1-live-2026-09-14/` (ignored working files; the held-out screenshots and
measurement manifest are also preserved in the portable evidence above).
