# Console-loop ledger — astryx

File: https://www.figma.com/design/GnQnjSNBXtgtd2Ht0Hs1C8/DS-Contracts-Testing  
Transport: Figma Console MCP `figma_execute` + `clientStorage` chunk upload (bridge :9228)  
Recorded: 2026-08-06

| Result | Count |
|---|---|
| Tokens | **completed** |
| Completed receipts | **13** / 13 |
| Failed | 0 |

Per-component evidence: `components/<stem>.json` + `.md` (kind `console-loop-astryx-component`).

## Summary

| Stem | Status | nodeId | v6 |
|---|---|---|---|
| token | completed | 1:3763 | v6:1746840295 |
| badge | completed | 1:3794 | v6:1192491616 |
| banner | completed | 1:3813 | v6:3231585800 |
| button | completed | 1:3864 | v6:1886612596 |
| checkbox-input | completed | 1:3873 | v6:2853217606 |
| dropdown-menu-item | completed | 1:3876 | v6:2766064663 |
| progress-bar | completed | 1:3900 | v6:3944709192 |
| slider | completed | 1:3955 | v6:1713883142 |
| switch | completed | 1:3964 | v6:754295416 |
| text-input | completed | 1:4003 | v6:1777886922 |
| toast | completed | 1:4006 | v6:72066831 |
| card | completed | 1:4047 | v6:3092228042 |
| dropdown-menu | completed | 1:4050 | v6:253339315 |

## 2026-08-08 — FC-CELL-FRAMING round: the defect was on the REFERENCE side

All seven astryx stems that failed `compositionOk` were re-measured against the
LIVE canvas via the Desktop Bridge (fileKey GnQnjSNBXtgtd2Ht0Hs1C8). Every
committed shot is exactly its 1x VARIANT cell + an 8px margin — the canvas
capture was never wrong. The references are what fail:

| stem | sr | named cause |
|---|---|---|
| banner | 1.08 | **FC-REF-CROSS-LIBRARY** — the "developed reference" is a POLARIS Banner (`extract/computed/out/banner/gate-shots/info.off.off__default.png`, the polaris config's output). astryx has no Banner in `extract/computed/configs/astryx.json`. |
| text-input | 45.67 | **FC-REF-WHOLE-PAGE** — reference is a 1440x2200 full-page doc-site screenshot. Its pixel bar is ALREADY met (1.72 AA <= 5); a correctly framed single-cell reference is the only thing between this stem and a genuine pass. |
| card | 1.43 | reference re-pointed to `out/astryx/card/gate-shots/default__default.png`; residual height delta is driven by the pre-Theme-mount **Times** substrate in that stale gate-shot |
| slider | 4.90 | reference re-pointed to `out/astryx/slider/gate-shots/horizontal.tooltip__default.png` (correct library, correct variant, Figtree). Framing excuse gone — **FC-ABS-SIZE** is real: canvas track 240px vs developed ~49px. |
| checkbox-input, progress-bar, token | 1.61 / 3.53 / 1.42 | FC-REF-FRAMING — emit-html first-item renders in the Times fallback (token's reference lost the chip box entirely). No astryx entries in the computed config to retarget to. |

Found by the new pin, not by the scorer: **astryx/toast** shipped a 336x132 shot
of the 320x116 `Type=Info` cell of the UNRELATED `Toast` set 1:802. The astryx
Toast node 1:4006 is 360x64 — the receipt's own `visual.observations.size` said
so. Re-exported at scale 1. The scorer never caught it because toast has no
reference and is therefore never scored.

Also measured and NOT shipped: pointing the scorer at astryx card's padded 320x96
gate-shot stage instead of the committed tight 118x60 crop of the SAME image
(identical 114x56 content box) collapsed `inkRealPct` 68.4 -> 9.3 and AA
33.27 -> 86.30. The lane scorer's ink metric is not stage-padding invariant for
pale fills; the retarget was reverted and only the provenance label corrected.

Pin: `parity/receipts/console-loop/astryx/framing.json` +
`scripts/console-loop-capture-framing-check.mjs`.
