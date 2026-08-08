# Console loop — Button (ds.button)

2026-08-08 first-party visual loop on the blank playground file
`BMjUA2ue5CaZXU4kufxL0z` ("Latest DS Contracts Tests") via Desktop Bridge
figma_execute + stem-serve fetch/eval. Earlier provenance for this stem
(DS-Contracts-Testing) is superseded by this receipt; the receipt's
`fileKey` field records where THIS evidence came from.

- Component set `4:412` on page "Button" (section 4:417), 24 variant(s).
- Fingerprint: `v6:3495939700` (stamp == recompute, 638 snapshot lines).
- Round-trip: 0 mismatch(es), 6 matched axes, 1 named gap(s).
- Pixel evidence: FAIL — honest fail-closed against the contract-default `src/components` render (`refs/button.png`, scale-1 cell shot `shots/button-cell.png`, scorecard `scores/button.json`).

Named defect (FC-classified):

- FC-TEXT-RASTER: pctAAMasked 7.30 > 5 — label glyph placement differs between Figma's and Chromium's rasterizers at scale 1 (total advances agree within 1px; mid-line glyph-position drift doubles the label outlines in scores/button.diff.png); geometry, radius, token fills and padding all bind and match
