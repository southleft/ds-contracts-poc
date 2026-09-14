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
999px. The labels still measure 36.265625×20 against the source's 57×20:
partial padding bindings and font substrate remain unresolved. This is **not**
a visual pass. The regenerated Badge receipt independently checks the accounting
improvement; run `npm run recipe:canvas-to-code:held-out:v2:check`.

Other affected receipts were regenerated from their unchanged observations.
Their measured accounting results did not change. Frozen signed lineages and
owner-only fields were not modified.

## Next bounded steps

1. Preserve and re-check the fresh held-out code→Figma screenshots as portable
   committed evidence (currently in the local private capture directory).
2. Recover partially bound padding without overwriting carried token identities.
3. Resolve font/mode fidelity separately from accounting; validate each affected
   component against its actual source screenshot before claiming visual parity.
4. Run readiness on a merged commit with successful lanes for that exact SHA.

Local capture directory:
`private/f1-live-2026-09-14/` (ignored; not portable release evidence yet).
