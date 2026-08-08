# Console loop — Card (ds.card)

2026-08-08 first-party visual loop on the blank playground file
`BMjUA2ue5CaZXU4kufxL0z` ("Latest DS Contracts Tests") via Desktop Bridge
figma_execute + stem-serve fetch/eval. Earlier provenance for this stem
(DS-Contracts-Testing) is superseded by this receipt; the receipt's
`fileKey` field records where THIS evidence came from.

- Component set `4:543` on page "Card" (section 4:554), 1 variant(s).
- Fingerprint: `v6:2202853943` (stamp == recompute, 83 snapshot lines).
- Round-trip: 0 mismatch(es), 1 matched axes, 3 named gap(s).
- Pixel evidence: FAIL — honest fail-closed against the contract-default `src/components` render (`refs/card.png`, scale-1 cell shot `shots/card-cell.png`, scorecard `scores/card.json`).

Named defect (FC-classified):

- FC-SLOT-PLACEHOLDER: the single default cell renders the dashed body Slot placeholder (320x158) while the code-side default body is empty (320x58) — compositionOk false (scaleRatio 2.01); placeholder stage furniture has no code equivalent, so the default cell can never pixel-match the contract-default code render
