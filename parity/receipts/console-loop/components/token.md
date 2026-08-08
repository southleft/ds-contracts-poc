# Console loop — Token (ds.token)

2026-08-08 first-party visual loop on the blank playground file
`BMjUA2ue5CaZXU4kufxL0z` ("Latest DS Contracts Tests") via Desktop Bridge
figma_execute + stem-serve fetch/eval. Earlier provenance for this stem
(DS-Contracts-Testing) is superseded by this receipt; the receipt's
`fileKey` field records where THIS evidence came from.

- Component set `4:918` on page "Token" (section 4:919), 33 variant(s).
- Fingerprint: `v6:2438401982` (stamp == recompute, 1497 snapshot lines).
- Round-trip: 0 mismatch(es), 4 matched axes, 3 named gap(s).
- Pixel evidence: FAIL — honest fail-closed against the contract-default `src/components` render (`refs/token.png`, scale-1 cell shot `shots/token-cell.png`, scorecard `scores/token.json`).

Named defect (FC-classified):

- FC-TEXT-RASTER-TINY: the white-trim content box reduces BOTH images to the bare 26x10 glyph run ('Token') because pill background and border are lighter than the 250 trim threshold; pctAAMasked 11.15 over that tiny ink area is rasterizer AA, not geometry — pill size, radius, padding and token fills match
