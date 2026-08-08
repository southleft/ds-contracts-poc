# Switch — astryx console-loop receipt

**Status:** completed  
**File:** `GnQnjSNBXtgtd2Ht0Hs1C8` (DS Contracts Testing)  
**contractId:** `astryx.switch`  
**reSyncedAt:** 2026-08-06T17:55:31.372Z  
**Wave:** B.3 (value axis)

## Generate

Uploaded `examples/astryx/figma/switch.figma.js` via clientStorage chunk append (`/parts/astryx-switch` on bridge :9228 → `ds_loop_script`, 79342 bytes), then force-amend eval (cleared specHash). Removed orphan `Label Position=End/Start` variants that conflicted with the new Value axis.

- **nodeId:** `1:3964` (COMPONENT_SET on page **Switch (astryx.switch)**, section `1:3965`)
- **mode:** amended (added Value=Off/On × Label Position=End/Start)
- **specHash:** `2478669811`

## Post-sync checks (structural — not a visual pass)

- Variants include **Value=Off** and **Value=On** (× Label Position End/Start) — 4 variants
- `switch-thumb` present (16×16) on Value variants
- On/Off thumbs **identical** XY (4,4) — On thumb offset pending harness re-capture (**expected**)
- Screenshot of COMPONENT_SET captured — all four look Off visually; **not** claiming visual pass

## Visual match (developed)

- matchDeveloped: **false**
- Wave B.3 structural sync only

## Fingerprint

- v6 stamp: `v6:204491426` (46 lines)
