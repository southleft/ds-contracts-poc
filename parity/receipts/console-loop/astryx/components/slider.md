# Slider — astryx console-loop receipt

**Status:** completed  
**File:** `GnQnjSNBXtgtd2Ht0Hs1C8`  
**contractId:** `astryx.slider`  
**reSyncedAt:** 2026-08-07T16:39:00.021Z

## Generate

Uploaded `examples/astryx/figma/slider.figma.js` via clientStorage chunk append (`/parts/slider` → `ds_loop_script`, 109109 bytes), then per-variant amend rebuild (full eval hits 30s Desktop Bridge cap). Forced amend after unchanged skip.

- **nodeId:** `9:831` (COMPONENT_SET on page **Slider (astryx.slider)**, section `9:832`)
- **mode:** amended (rebuiltVariants: 6)
- **specHash:** `1214932373`
- **fingerprint:** `v6:3600925889`

## clipsContent (from script)

- Emit: `propagateOverflowVisible` + ancestor unclip in `applyInsetOverlay` / `applyShapeAbsolute`
- All 6 variants: `slider.clipsContent===false` and `part-1-0.clipsContent===false` **without hand patch**
- Thumbs **20×20** full circles (absolute `left:-10` variants unclipped)

## Visual notes (not a pass)

- `matchDeveloped: false` — display:contents hoist; developed score pending
- Root/track width ~49px from contract — not hand-patched

## Re-sync

- note: Re-synced via clientStorage chunks (n=13, total=100445); amended nodeId=9:831; rebuiltVariants=6; V-Text rootW=56 label-3.x=28; H-Text part-1-0.w=240; thumb after fill (track→part-1-0-1→thumb). matchDeveloped left false.
