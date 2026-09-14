# Visual hill climb — 2026-09-14

This is a work log, not a grade or release approval. No Figma nodes were changed.

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

1. Fresh held-out code→Figma screenshots are now portable committed evidence in
   `recipe/evidence/live-fidelity-2026-09-14/`; `npm run recipe:fidelity:check`
   re-derives every score and checks hashes, repeated renders, and coverage.
2. Partial padding is now measured; preserve the remaining identity-loss note.
3. Carry the named letter-spacing gap and verify font fidelity separately from accounting; validate each affected
   component against its actual source screenshot before claiming visual parity.
4. Run readiness on a merged commit with successful lanes for that exact SHA.

Local capture directory:
`private/f1-live-2026-09-14/` (ignored working files; the held-out screenshots and
measurement manifest are also preserved in the portable evidence above).
