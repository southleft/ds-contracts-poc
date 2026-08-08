# Console-loop ledger — Polaris (on DS-Contracts-Testing)

File: https://www.figma.com/design/GnQnjSNBXtgtd2Ht0Hs1C8/DS-Contracts-Testing  
Transport: Figma Console MCP `figma_execute` + clientStorage chunk upload  
Recorded: 2026-08-06

| Result | Count |
|---|---|
| Completed | **12/12** |
| Failed | 0 |
| Canvas-projection (named curation) | text, text-field (per COMPILE-RECEIPT.md) |

Gate stems: all 12 under `components/`.

## 2026-08-08 — FC-CELL-FRAMING round: the defect was on the REFERENCE side

The three polaris stems that failed `compositionOk` ("use 1x VARIANT cell vs
gate-shot") were re-measured against the LIVE canvas via the Desktop Bridge.
Every committed shot is exactly its 1x VARIANT cell — the canvas capture was
never wrong. What was wrong was the reference each was scored against:

| stem | before | after | what actually moved |
|---|---|---|---|
| text-field | 9.56 AA, comp=false, sr=3.06 | **4.11 AA, comp=true — SCORED PASS** | reference re-pointed from a Times-substrate emit-html first-item render (69x47) to `extract/computed/out/textfield/gate-shots/inherit.medium.off.off.off.enabled__default.png` |
| text | 10.77 AA, comp=false, sr=6.59 | 26.07 AA, comp=true, sr=1.01 | old reference was a 949x23 strip carrying the sample string TWICE; re-pointed to `text/gate-shots/headingSm.base.regular__default.png` |
| thumbnail | 77.25 AA, comp=false, sr=1.18 | 85.72 AA, comp=false, sr=1.07 | framing fixed; residual is FC-REF-BROKEN-ASSET — the gate-shot renders a BROKEN `<img>` (broken-image glyph + alt text "Black choker necklace"), so its 29% ink can never agree with a solid Thumbnail |

Found by the new pin, not by the scorer: **polaris/checkbox** shipped a 16x20
hand crop of the checkbox BOX; the VARIANT cell 1:10019 is 160x28 and includes
its label. Re-exported at scale 1 from the live canvas; reference re-pointed to
`checkbox/gate-shots/unchecked.enabled__default.png`. 16.05 -> 18.39 AA, comp
true — an honest number for the first time.

Pin: `parity/receipts/console-loop/polaris/framing.json` +
`scripts/console-loop-capture-framing-check.mjs`.
