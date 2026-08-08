# Checkbox — carbon console-loop receipt

**Status:** completed  
**File:** `GnQnjSNBXtgtd2Ht0Hs1C8` (DS Contracts Testing)  
**contractId:** `carbon.checkbox`  
**reSyncedAt:** 2026-08-06T18:01:59.657Z  
**Wave:** B.2 (before/after paint-order)

## Generate

Uploaded `examples/carbon/figma/checkbox.figma.js` via clientStorage chunk append (`/parts/carbon-checkbox` on bridge :9228 → `ds_loop_script`, 83757 bytes), then force-amend eval (cleared specHash).

- **nodeId:** `1:5562` (COMPONENT_SET on page **Checkbox (carbon.checkbox)**, section `1:5563`)
- **mode:** amended (rebuiltVariants: 3)
- **specHash:** `1143286597` (prev cleared / previously `915897765`)

## Post-sync checks (Checked child order)

- **Checked `checkbox-label` children:** `label`@0, `checkbox-label-before`@1, `checkbox-label-after`@2
- **orderOk:** before index (1) < after index (2)
- **Indeterminate:** same order (before@1, after@2)
- **Checked after:** white SOLID strokes, bottom/left=1, 9×5 rot 45°
- **Indeterminate after:** white strokes, bottom=2 / left=1, 8×5 rot 0

## Visual match (developed)

- matchDeveloped: **false**
- Screenshot: white L-check **visible** on black box for Checked variant (paint-order fix). Remaining developed-parity gaps keep matchDeveloped false.

## Fingerprint

- v6 stamp: `v6:4163950863` (86 lines)
