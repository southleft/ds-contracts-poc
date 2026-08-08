# PageShell — A3 composition corpus

- **Contract:** `contracts/page-shell.contract.json`
- **File:** `BMjUA2ue5CaZXU4kufxL0z` ("Latest DS Contracts Tests"), page + section **Composition Corpus** (`4:1416`)
- **Node:** `4:1409`
- **Fingerprint:** `v6:1748692049` (25 lines)

## What it exercises

G4 named areas whose slots carry `accepts` for the other layout contracts — composition of compositions (Main carries 4 preferredValues)

Slots (contract name → canvas cell): `Header` @0,0 span 1×2, `Aside` @1,0 span 1×1, `Main` @1,1 span 1×1, `Footer` @2,0 span 1×2.

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
| **(b) FILLED** | same ds.badge in every slot on both surfaces, lane scorer, bar `pctAAMasked ≤ 5 && compositionOk` | **PASS** — 0.08% |

**Receipt claim: `scored-pass`.**
Both halves pass, so the receipt claims a visual pass.

## Round trip

No mismatches. Named gaps: a layout contract declares no enum props (no Variant
axis on canvas), and Figma has no native grid AREA names — the contract owns the
names, both surfaces carry the rects (G4).
