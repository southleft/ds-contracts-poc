# BentoGrid — A3 composition corpus

- **Contract:** `contracts/bento-grid.contract.json`
- **File:** `BMjUA2ue5CaZXU4kufxL0z` ("Latest DS Contracts Tests"), page + section **Composition Corpus** (`4:1416`)
- **Node:** `4:1382`
- **Fingerprint:** `v6:1998161685` (30 lines)

## What it exercises

G2 span matrix addressed through G4 named areas — the P8 canonical 3x4 bento; mixed px/fr on both axes; independent row/column gaps

Slots (contract name → canvas cell): `Header` @0,0 span 1×4, `Sidebar` @1,0 span 2×1, `Main` @1,1 span 1×2, `Rail` @1,3 span 2×1, `Footer` @2,1 span 1×2.

## Scored twice, per the pinned convention

The convention is pinned in [docs/composition-corpus/README.md](../../../../docs/composition-corpus/README.md)
**before** the first contract was authored, because the earlier card stem was
sunk by pixel-scoring a dashed canvas placeholder against an empty code body.
Native slots make that comparison impossible by design: an empty slot is
Figma's own frame with zero chrome, and this stem's empty scale-1 export is a
blank PNG.

| half | how | result |
|---|---|---|
| **(a) EMPTY** | structural — presence + name + placement box | **PASS** |
| **(b) FILLED** | same ds.badge in every slot on both surfaces, lane scorer, bar `pctAAMasked ≤ 5 && compositionOk` | **PASS** — 0.10% |

**Receipt claim: `scored-pass`.**
Both halves pass, so the receipt claims a visual pass.

## Round trip

No mismatches. Named gaps: a layout contract declares no enum props (no Variant
axis on canvas), and Figma has no native grid AREA names — the contract owns the
names, both surfaces carry the rects (G4).
