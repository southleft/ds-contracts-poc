# Exact conversion finish — Wave 5

- Run ID: `exact-conversion-finish-wave5`
- Task type: coverage expansion (predeclared 50% MUI denominator)
- Status: **READY** — 31/31 carried
- Current step: A-batch (alert/badge/divider/link/paper) + sibling batches; denominator full
- Branch: `feat/exact-conversion-wave0`
- Depends on: Waves 0–3 READY; Wave 4 UX slices in flight

## Freeze

- Manifest: `examples/mui/oracle/DENOMINATOR-50.json` — **31** families
- Gate: `npm run mui:denominator:check` (also in fast.yml)
- Rule: membership cannot shrink; accuracy/baseline.json untouched
- Negative control SpeedDial stays **outside** the denominator

## Progress

- Carried: **31/31** (`npm run mui:denominator:check`)
- Pending: 0

## Slice — avatar / fab / icon-button / circular-progress / linear-progress

Pipeline (same as TextField): seed → `mui.json` → `extract:computed` → promote → figma → ds-library / genesis / bundle.

| stem | status | axes (bounded) | notes |
|---|---|---|---|
| avatar | **carried** | `variant` (3) | initials sampleText `A` |
| fab | **carried** | `size`×`color` (3×3; +disabled plane) | NOT SpeedDial; variant pinned circular; disableRipple |
| icon-button | **carried** | `size`×`color` (3×3; +disabled plane) | disableRipple; sample `★` |
| circular-progress | **carried** | `variant` (2) | color/size/value fixedProps |
| linear-progress | **carried** | `variant` (2) | buffer/query excluded; blockStage |

### Failures / repairs this slice

1. **CircularProgress quarantine** — SVG `<circle>` minted unregistered `cx/cy/r/stroke/stroke-width/stroke-dashoffset` channels. Fixed in `extract/computed/anatomy.ts`: `reconstructSvg` now carries `path/g/circle`, bakes absolute progress-ring dashes, and reconstructs MUI's offset viewBox (`SIZE/2 SIZE/2 SIZE SIZE`).
2. **IconButton first capture** — transient ENOENT writing `.orig-shots` (dir race); retry succeeded.
3. **LinearProgress first capture** — one-off Playwright combo timeout; retry succeeded.
4. **Promote dangling ref** — `textfield` enriched extension missing `imported.text-field.label.font-size` while contract still referenced it; restored leaf from prior minted tree before wave-5 promote.
5. **SpeedDial** — not seeded, not promoted (negative control intact).

### Artifacts

- Seeds: `examples/mui/contracts-seed/{avatar,fab,icon-button,circular-progress,linear-progress}.contract.json`
- Promoted: `examples/mui/contracts/{avatar,fab,icon-button,circular-progress,linear-progress}.{contract,extension}.json`
- Figma: `examples/mui/figma/{avatar,fab,icon-button,circular-progress,linear-progress}.figma.js`
- Icons: `circular-progress-root-{determinate,indeterminate}.svg`
- Genesis mock-proven with 18 sets including the five new members; `mui.bundle.json` refreshed

## Slice — alert / badge / divider / link / paper (A-batch)

Pipeline (same as TextField): seed → `mui.json` capture entry → `extract:computed` → promote → figma scripts → ds-library / genesis / bundle / DENOMINATOR carried.

| stem | status | axes (bounded) | notes |
|---|---|---|---|
| alert | **carried** | `severity`×`variant` (4×3=12) | cheap severity axis kept; severity icons reconstructed |
| badge | **carried** | `color`×`variant` (7×2=14) | Avatar child + circular overlap; badgeContent=4 fixed |
| divider | **carried** | `variant` (3) | horizontal + blockStage only (vertical needs flex height) |
| link | **carried** | `color`×`underline` (7×3=21) | href pinned; figmaStatePreviews accepted |
| paper | **carried** | `elevation`×`variant` (4×2=8) | elevation bounded 0/1/3/8 like Card |

### Failures / repairs this slice

1. **Badge first capture** — ENOENT on `.orig-shots` (concurrent wave-5 captures racing the shared scratch dir). Retried after quiet; succeeded with Avatar `childrenSpec`.
2. **Genesis ORDER gap** — A-batch scripts existed but were missing from `build-genesis-batch.mjs` ORDER; added Alert/Badge/Divider/Link/Paper and re-ran mock-proven genesis (27 sets / 4 standalone).
3. **SpeedDial** — still unpromoted / outside denominator.

### Artifacts

- Seeds: `examples/mui/contracts-seed/{alert,badge,divider,link,paper}.contract.json`
- Promoted: `examples/mui/contracts/{alert,badge,divider,link,paper}.{contract,extension}.json`
- Figma: `examples/mui/figma/{alert,badge,divider,link,paper}.figma.js`
- Icons: `alert-alert-icon-{error,info,success,warning}.svg`
- Gates: `mui:denominator:check` → **31/31**; `accuracy:check` → hold (baselines untouched)

## Slice — breadcrumbs / drawer / radio / select / snackbar (C-batch)

| stem | status | axes (bounded) | notes |
|---|---|---|---|
| breadcrumbs | **carried** | standalone | Link+Typography `childrenSpec`; blockStage |
| drawer | **carried** | `variant` temporary\|permanent (2) | `open:true` fixed; `portalCapture`; `transitionDuration:0`; blockStage |
| radio | **carried** | `color`×`checked` (7×2; +disabled plane) | Switch/Checkbox STATE-PLANE pattern; ripple via `slotProps.root` |
| select | **carried** | `size` (2) | value+MenuItem children pinned; `open:false` |
| snackbar | **carried** | promoted `position` (3) | `openDriver` open+message; `portalCapture`; simple message (no Alert child) |

### Failures / repairs this slice

1. **Phantom C-batch config** — concurrent write used invalid `children` (not `childrenSpec`), mismatched axes vs seeds, missing `portalCapture`. Rewrote entries to match seeds + capture schema before first successful capture.
2. **Radio ripple determinism** — MUI Radio@9.2.0 destructures `disableRipple` for hover CSS but does **not** forward it to SwitchBase (Checkbox does). Top-level `disableRipple` left TouchRipple mounted; focus-visible pulsate failed double-run. Fixed via `slotProps.root.{disableRipple,disableFocusRipple}`.
3. **Radio / Drawer first attempts** — `.orig-shots` ENOENT race; Drawer seed/axis thrash mid-edit. Retries succeeded after mkdir + seed settle.
4. **Genesis STANDALONE** — Snackbar enriched with a `position` VARIANT axis (3) during promote, so it is a COMPONENT_SET, not standalone. Breadcrumbs remains standalone.
5. **SpeedDial** — still outside denominator (negative control).

### Artifacts

- Seeds: `examples/mui/contracts-seed/{breadcrumbs,drawer,radio,select,snackbar}.contract.json`
- Promoted: `examples/mui/contracts/{breadcrumbs,drawer,radio,select,snackbar}.{contract,extension}.json`
- Figma: `examples/mui/figma/{breadcrumbs,drawer,radio,select,snackbar}.figma.js`
- Icons: `radio-icon.svg`, `radio-icon-2.svg`, `select-icon.svg`
- Genesis mock-proven: 22 sets + 4 standalone (Menu, Tooltip, TablePagination, Breadcrumbs)

## Acceptance

`carriedCountMustReach: 31` — **met**. Gates: `mui:denominator:check` ✔ · `accuracy:check` ✔. SpeedDial stays outside.
