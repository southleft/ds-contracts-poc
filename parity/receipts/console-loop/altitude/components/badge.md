# Badge — altitude console-loop receipt

**Status:** completed  
**File:** `GnQnjSNBXtgtd2Ht0Hs1C8` (DS Contracts Testing)  
**contractId:** `altitude.badge`  
**Recorded:** 2026-08-06T05:43:10.768Z  
**Re-synced:** 2026-08-06T15:23:00.000Z

## Generate

Fetched `examples/altitude/figma/badge.figma.js` via `http://localhost:9228/stem/altitude-badge` into `ds_loop_script` (67617 bytes), then eval’d.

- **nodeId:** `1:2963` (COMPONENT_SET on page **Badge (altitude.badge)**, section `1:2964`)
- **mode:** amended (rebuiltVariants: 8)
- **properties:** Content, Variant, Dot

## Screenshot

COMPONENT_SET `1:2963` — 8 variants in 2 columns (Default | Dot) × 4 rows (Info/Success/Warning/Danger).

- **Dot=Default:** pill with visible label text `Badge`
- **Dot=Dot:** 8×8 circle only; no label text

## Fingerprint (v6)

- **hash:** `v6:3192606537`

## Acceptance

generatedOrFound ✓ · screenshotReviewed ✓ · zeroMismatch ✓

## Visual match (developed)

- reviewedAt: `2026-08-06T15:23:00.000Z`
- matchDeveloped: **false**
- defect: re-synced from contract; developed score pending

## 2026-08-08 — Track-2 hill-climb round 1

- regenerated (nodeId=60:10083). FC-THEME-ISO closed: previous rebind had bound the info fill to a Polaris 'Imported (provisional)' variable (light blue); collection-preference runtime now picks the Altitude collection (#4375FF). font-family carried into the contract. Remaining 6.44 AA is FC-FONT-SUBSTRATE (ref renders fallback glyphs; no @font-face in harness) — fail-closed.

## 2026-08-08 — FC-FONT-SUBSTRATE reference-side closure; residual is canvas-side

- reference re-pinned with IBM Plex Sans loaded (cfg.fonts); trap-corpus ref copy updated in lockstep. Score moved 6.44 → 15.44 on BOTH instruments: the ref now renders real Plex SemiBold, but the canvas cell renders **Inter Semi Bold** (Figma runtime fell back at generation time). Still fail-closed — residual named on the receipt: the badge set needs canvas-side regeneration with "IBM Plex Sans"/"SemiBold" actually loaded. A truer reference scoring worse than a fallback reference is the honest direction of this re-pin.
