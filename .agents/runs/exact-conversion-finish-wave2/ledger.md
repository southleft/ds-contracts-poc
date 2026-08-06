# Exact conversion finish — Wave 2

- Run ID: `exact-conversion-finish-wave2`
- Task type: MUI oracle and golden corpus
- Status: closed
- Current step: verified — Wave 2 READY
- Branch: `feat/exact-conversion-wave0`
- Depends on: Wave 1 closed (conversion-core)
- Disposition: `disposition.json` → READY
## Intake

Targets:

- Freeze a seeded, stratified MUI sample from its export list (not
  tractability-picked): supported primitives, bounded complex components,
  state axes, and at least one intentionally unsupported organism.
- Author expected dispositions independently of engine behavior.
- Extend conformance from one-combo fixtures to multi-axis/state cases.
- Script a human-started real-Figma session: emit, apply, read back, edit,
  detect, restore, compare. Live-only bugs must gain failing headless
  reproductions before fixes.
- Visual, structural, accessibility, fact-conservation, and refusal receipts.
  Quoted scores must include compared facts/cells and refusal counts.

Acceptance:

1. Stratified golden corpus selected from MUI export list with independent
   expected dispositions.
2. Offline oracle passes the declared grammar with zero silent
   loss/invention/fallback on the sample.
3. Live Figma receipt agrees with the offline oracle for the scripted session.
4. Accuracy denominators and refusal ratchets do not shrink or weaken.

## Triage

Oracle measurement is read-mostly. Live Figma and any apply/publish paths
touch `writes-mutations` and will be dispositioned before close.

TRIAGE-SEAMS: none (discovery)

## Checkpoints

- `intake-ready`: complete
- `plan-ready`: complete — discovery `0469662c-1b0c-4f0b-9927-f2ac0c0d23fc`
- `contract-read`: complete — export list + PROVENANCE portal/sticky policies
- `implementation-ready`: complete
- `verified`: complete — offline 32/0/0; live 3/3; accuracy:check holds
- `closed`: complete

## Discovery summary

- Authoritative export: `@mui/material` ~62–63 families; pilot 14 in
  `examples/mui/ds-library.json`.
- Reuse: accuracy R1–R6, CSS/canvas conformance manifests, UUI RT fact
  multimap, exact projection, MUI compile/genesis receipts, live dump/MCP.
- Stratified corpus: 13 members (11 pilot + TextField pending-seed +
  SpeedDial negative-control).

## Corpus freeze (landed)

- `examples/mui/oracle/corpus.json`
- `examples/mui/oracle/EXPECTED.md`
- `examples/mui/oracle/dispositions/*.json` (13)
- Gate: `node scripts/mui-oracle-corpus-check.mjs` → green

## Offline oracle (landed)

- Runner: `scripts/mui-oracle-offline.mjs`
- npm: `mui:oracle:offline` (corpus check prerequisite) +
  `test:mui-oracle-offline`
- Reports: `examples/mui/oracle/REPORT.md`, `report.json`
- Command: `npm run mui:oracle:offline` → **30 MATCH · 2 PENDING · 0 FAIL /
  32 facts** (exit 0)
- Tests: `npm run test:mui-oracle-offline` → 6/6 pass
- Accuracy: `accuracy/baseline.json` / grammar counts **not modified**
- TextField / SpeedDial: **not seeded/captured** this slice

### What it can prove (MATCH)

- Negative-control SpeedDial: unpromoted → UNSUPPORTED holds (fail-closed
  if contract/figma appear).
- Pending-seed TextField component blocker: unpromoted → UNSUPPORTED
  `mui-text-field-pending-seed` holds.
- Pilot structural CARRIED: VARIANT axes + figma (+ compile receipt row),
  drawable anatomy, disabled in `states`, Switch `checked` VARIANT axis,
  Dialog portal root anatomy, Table inlined checkbox without component ref.
- Named REFUSED/LOWERED/LEDGERED from extension/structure receipts +
  capture config / contract prose: portal-inert sentinels, stickyHeader
  exclusion, closed row-menu / listbox policy, table-geometry lowering,
  portal `states: []`, full-bleed scrim stage width omitted in emission.

### Local emission / contract proof closure

- `button/prototype.change-to` now MATCHes from committed figma-script
  `ON_HOVER` + `CHANGE_TO` reaction wiring (`figma-script:CHANGE_TO`).
- `switch/layout.thumb-translate` now MATCHes from the checked
  `buttonbase-root` `translate-x` binding plus all four minted leaves.
- No canvas dump was created or required for either fact.

### What remains PENDING

- `text-field/anatomy.adornment` + `text.style` — `awaiting-seed` (must not
  green-pass until seeded)

Exact projection not scored: no MUI Figma dumps in-tree.

## Live Figma session (completed on MUI Test 1)

- File: `MUI Test 1` (`fileKey: 59mLQlOMiD5w5za6SUcoO5`) via Desktop Bridge
- Stems: button (`21:287`, 75 variants), switch (`21:624`, 28), table
  (`21:744`, 2) — already on canvas from prior emit/apply
- Dump: `live-fingerprint-1` → `live/<stem>/dump.readback.json`
- Controlled edit: detach `paddingTop` binding, +2px literal, detect named
  drift, restore value + rebound variable — `edit-restore.json` per stem
  (`drifted=true`, `restored=true` for all three)
- Receipts: `status: "completed"`, `offlineVsLive.agreement: true`,
  `liveOnlyDefects: []`
- Gate: `npm run mui:oracle:live:check` → **3 live receipt(s) validated**
- Playbook still at `examples/mui/oracle/LIVE.md`; SpeedDial not seeded;
  accuracy baselines untouched

## Next actions

1. ~~Seed TextField~~ — done (32 MATCH · 0 PENDING).
2. ~~Close Wave 2~~ — `disposition.json` READY.
3. Start Wave 3 workflow-spine (typed per-channel diff, three-way merge,
   adoption guards, Apply preview/receipts).

## TextField nested-instance seed (completed)

- Added deterministic `$element` capture grammar for element-valued React
  props and captured MUI `InputAdornment` plus a canonical error `TextField`
  with real start/end adornment nodes. TextField capture is intentionally a
  one-combo base capture (variant/size held fixed); the emitted contract still
  exposes its reviewed variant and size axes.
- Promoted `mui.input-adornment` and `mui.text-field`; TextField replaces the
  two captured adornment DOM subtrees with nested `mui.input-adornment`
  component refs. Emission carries `depContractId` and `depAnchorKey` for both.
- Added two minted MUI text-style identities (Body 1 Regular and
  Helper/Error Regular). Emitted helper/error text carries `textStyle`; runtime
  refuses by `text-style-identity-refused` if the marked local style is absent.
- Regenerated all 16 component scripts, the MUI bundle, token sync, compile
  receipt, and dependency-ordered genesis batch (InputAdornment before
  TextField). SpeedDial remains unpromoted.
- Offline oracle before: **30 MATCH · 2 PENDING · 0 FAIL / 32**.
  After: **32 MATCH · 0 PENDING · 0 FAIL / 32**.
- Verification: corpus check PASS; offline oracle PASS; offline tests 6/6
  PASS; TypeScript typecheck PASS; compile receipt 16 scripts / 168 variants
  PASS; genesis mock proof PASS.
- Accuracy baseline and grammar denominators were not modified.

## Closed

Wave 2 READY — stratified corpus, offline **32/0/0**, live receipts 3/3
agree, TextField nested seed landed, SpeedDial negative-control intact,
accuracy ratchets untouched. See `disposition.json`.
