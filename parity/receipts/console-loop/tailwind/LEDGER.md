# Console-loop ledger — tailwind

File: https://www.figma.com/design/GnQnjSNBXtgtd2Ht0Hs1C8/DS-Contracts-Testing  
Transport: Figma Console MCP `figma_execute` + `clientStorage` chunk upload (bridge :9228)  
Recorded: 2026-08-06

| Result | Count |
|---|---|
| Tokens | **completed** |
| Completed receipts | **5** / 5 |
| Failed | 0 |

Per-component evidence: `components/<stem>.json` + `.md` (kind `console-loop-tailwind-component`).

## Summary

| Stem | Status | nodeId | v6 |
|---|---|---|---|
| alert | completed | 1:2098 | v6:438794735 |
| badge | completed | 1:2149 | v6:2933199349 |
| button | completed | 1:2254 | v6:2297298321 |
| card | completed | 1:2267 | v6:3067143140 |
| toggle-switch | completed | 1:2296 | v6:15608991 |

## 2026-08-08 — REFERENCE-TRUTH round: re-measured against the real npm package

**Reference basis for this lane: LIBRARY RENDER.** All five stems are now scored
against `extract/computed/out/tailwind/<comp>/orig-shots/<combo>__default.png` —
the `flowbite-react@0.12.17` screenshot committed by
`extract/computed/run.ts --keep-originals`. Before this round three stems pointed
at `gate-shots/` (the **CONTRACT RENDER**: enriched contract → emit-html, the
right half of `receipts/pair--*.png`) and two at hand crops of the collage's
`#package-left` half.

**The lane held — and here is the reason, which is a result in its own right.**
For `alert/failure__default` and `badge/failure.sm__default` the contract render
is **byte-identical** to the library render (same sha256). The two emitters do
not merely agree; they emit the same pixels. So for those stems "emitter
agreement" and "fidelity" were the same number by accident, not by luck of the
threshold.

| stem | before | prior basis | after | basis now | verdict |
|---|---|---|---|---|---|
| alert | 3.83 | contract render (byte-identical to library) | **3.83** | library | **survives** |
| badge | 2.43 | contract render (byte-identical to library) | **2.43** | library | **survives** |
| button | 1.94 | library pixels, cropped from `pair--…#package-left` | **1.94** | library, un-collaged | **survives** |
| card | 8.01 | contract render (crop of `gate-shots/__default.png`) | **6.05** | library | fail on both bases |
| toggle-switch | 6.15 | library pixels, cropped from `#package-left` | **6.15** | library | fail on both bases |

Scorecard passes: **3 → 3**. RATCHET floor 3 still holds honestly.

**Rebuildability finding (not a scoring change).** Re-running the capture at HEAD
reproduced every committed `gate-shots/` PNG byte-for-byte for alert, badge,
button and card. `toggleswitch` did **not**: 12 of its 48 gate-shots differ — every
`*.unchecked__*` key, by ~100–140 pixels of 30 720 (0.3 %). Recorded here rather
than chased; no committed gate-shot was overwritten by this round.

## 2026-08-09 — CANVAS-DRIFT sweep: 5 of 5 in sync — the cleanest lane on the board

Snapshot: `canvas-drift/LIVE-SNAPSHOT.json` (Desktop Bridge, `fileKey` pinned).
Probe: `npm run console-loop:canvas-drift tailwind`.

**Every stem is exactly what `examples/tailwind/figma/<stem>.figma.js` would
build today**, and every binding on every stem resolved in the `Tailwind`
collection — the only collection this lane's scripts create. No BINDING-DRIFT, no
COLLECTION-DRIFT, no VALUE-DRIFT anywhere: `alert`, `badge`, `button`, `card`,
`toggle-switch`.

All three of this lane's scored passes (`alert` 3.83, `badge` 2.43, `button`
1.94) are therefore measuring a current canvas. Nothing here is a pass earned by
a build nobody would ship.

The five stems carry the non-drift note `FC-FONT-SUBSTRATE`: their text nodes
draw Inter because **no tailwind contract carries a font-family channel at all**,
so the emitter was faithful and the channel never reached the contract. That is
the same lane-wide term carbon named, with the same owner (`extract/computed/fuse.ts`,
outside this lane) and the same deliberate non-fix.

**Floor: tailwind holds at 3.** `RATCHET.json` untouched.
