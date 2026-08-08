# Console loop — TextField (ds.text-field)

2026-08-08 first-party visual loop on the blank playground file
`BMjUA2ue5CaZXU4kufxL0z` ("Latest DS Contracts Tests") via Desktop Bridge
figma_execute + stem-serve fetch/eval. Earlier provenance for this stem
(DS-Contracts-Testing) is superseded by this receipt; the receipt's
`fileKey` field records where THIS evidence came from.

- Component set `4:651` on page "TextField" (section 4:652), 3 variant(s).
- Fingerprint: `v6:1181024118` (stamp == recompute, 178 snapshot lines).
- Round-trip: 0 mismatch(es), 6 matched axes, 2 named gap(s).
- Pixel evidence: FAIL — honest fail-closed against the contract-default `src/components` render (`refs/text-field.png`, scale-1 cell shot `shots/text-field-cell.png`, scorecard `scores/text-field.json`).

Named defect (FC-classified):

- FC-TEXT-RASTER near-pass: pctAAMasked 5.84 vs the 5 bar; three 14px text lines (label, helper, placeholder) dominate the ink and carry cumulative mid-line glyph-position drift between rasterizers; was 10.42 headless against the stale pre-loop reference
