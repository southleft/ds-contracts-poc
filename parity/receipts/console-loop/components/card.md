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

- FC-SLOT-PLACEHOLDER (registered in CODE-TO-CANVAS-HILLCLIMB.md §3.1 on 2026-08-09; HALF INSTRUMENT RESIDUAL): the scored cell renders the dashed body Slot placeholder (320x158) while the code-side default body is empty (320x58) — compositionOk false (scaleRatio 2.01). THE EMITTER THAT DREW THAT PLACEHOLDER NO LONGER EXISTS: this receipt is commit bf82db06 (2026-08-08 08:37) and ce43ab0e ("THE SLOT BECOMES A SLOT", 12:19 the same day) retired the dashed utility — core/emit-figma-script.ts:4862 says it "is never minted again", :6138 builds a native createSlot() that draws no chrome. Re-run the canvas before reading this number as fidelity; the canvas is the stale side. What survives is the real question: `body` is a REQUIRED slot with no `defaultContent`, so there is content on NEITHER side. Ink is already clean (1.598% AA, inside the 5% bar).
