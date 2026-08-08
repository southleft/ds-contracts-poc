# GridGallery — A3 composition corpus

- **Contract:** `contracts/grid-gallery.contract.json`
- **File:** `BMjUA2ue5CaZXU4kufxL0z` ("Latest DS Contracts Tests"), page + section **Composition Corpus** (`4:1416`)
- **Node:** `4:1390`
- **Fingerprint:** `v6:697927591` (35 lines)

## What it exercises

G5 bounded row auto-flow (ROW_AUTO_FLOW) — the placement fact is CHILD ORDER; six repeated slots over two emitter-derived rows

Slots (contract name → canvas cell): `Item 1` @0,0 span 1×1, `Item 2` @0,1 span 1×1, `Item 3` @0,2 span 1×1, `Item 4` @1,0 span 1×1, `Item 5` @1,1 span 1×1, `Item 6` @1,2 span 1×1.

## Scored twice, per the pinned convention

The convention is pinned in [docs/composition-corpus/README.md](../../../../docs/composition-corpus/README.md)
**before** the first contract was authored, because the earlier card stem was
sunk by pixel-scoring a dashed canvas placeholder against an empty code body.
Native slots make that comparison impossible by design: an empty slot is
Figma's own frame with zero chrome, and this stem's empty scale-1 export is a
blank PNG.

| half | how | result |
|---|---|---|
| **(a) EMPTY** | structural — presence + name + placement box | **FAIL** |
| **(b) FILLED** | same ds.badge in every slot on both surfaces, lane scorer, bar `pctAAMasked ≤ 5 && compositionOk` | **PASS** — 3.41% |

**Receipt claim: `fail-closed` (FC-GRID-ROOT-VSIZE).**
The filled pixel scorecard passes at 3.41%, but the structural half fails: the canvas box is 640×100 where code hugs to 640×62. The pixel scorer trims both images to their ink bounding box, so the dead space carries no ink and never reaches the number. Claiming a pass on that scorecard alone would be an instrument artifact, so this stem stays fail-closed with the cause named.

## Round trip

No mismatches. Named gaps: a layout contract declares no enum props (no Variant
axis on canvas), and Figma has no native grid AREA names — the contract owns the
names, both surfaces carry the rects (G4).
