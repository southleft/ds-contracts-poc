# Console MCP contract → Figma loop

Live feedback loop on
[DS-Contracts-Testing](https://www.figma.com/design/GnQnjSNBXtgtd2Ht0Hs1C8/DS-Contracts-Testing)
(`GnQnjSNBXtgtd2Ht0Hs1C8`): emit from contract → `figma_execute` (chunked via
`clientStorage`) → screenshot → visual audit → v6 fingerprint → light
round-trip → receipt.

Does **not** overwrite golden `figma-sync/` (evals pin those bytes). Emits into
`emitted/` retargeted at the Testing file.

## Commands

```bash
npm run console-loop:emit                # regenerate emitted/*.js for Testing file
npm run console-loop:evidence:check      # first-party gate (attested-only lane)
npm run console-loop:all:evidence:check  # ALL 7 lanes, aggregated (no short-circuit)
npm run console-loop:developed-score     # pixel-score a stem vs its developed reference
```

## Evidence semantics (2026-08-07 redesign)

- **Scorecards, never booleans.** A receipt may claim a visual pass
  (`visual.ok` / `visual.matchDeveloped`) only when `<lib>/scores/<stem>.json`
  passes the one bar: `pctAAMasked ≤ 5` AND `compositionOk`. Foreign lanes
  (tailwind/altitude/astryx/carbon/polaris) enforce this strictly; a
  pass-claim without a passing scorecard fails CI naming the stem.
- **Honest fail-closed is legal.** No pass-claims + non-empty named
  `visual.defects` (`visual.status: "fail-closed"`) is counted and printed,
  not failed — the branch stays green while the visual hill-climb proceeds.
  Current genuine scorecard passes: tailwind 3/5, altitude 4/8, carbon 2/10,
  astryx 0/13, polaris 0/12 (9/48 foreign; see `CORPORA.md`).
- **Attested-only (first-party + MUI).** Those corpora have no pixel
  scorecards yet; their visual claims are legal but printed loudly as
  ATTESTED-ONLY until the pixel-score job lands. Once a scorecard exists the
  claim is enforced strictly.
- **Ratchet.** `RATCHET.json` pins per-lane minimum scorecard-passed counts;
  a lane fails if its count drops below its floor.
- **Hash pinning.** Scorecards record `sha256` of the reference and canvas
  PNGs they scored; gates verify the pins against the files on disk.

Chunk a script for Desktop Bridge upload:

```bash
node parity/receipts/console-loop/chunk-script.mjs \
  parity/receipts/console-loop/emitted/04-badge.js /tmp/badge-parts
```

Upload parts with `figma_execute` into `clientStorage['ds_loop_script']`, then
`eval` the concatenated source (see component receipts for transport note).

## Per-component receipts

`components/<stem>.json` + `.md` — one completed receipt per synced contract
(49 first-party stems; `inline` / `stack` are native and skipped).
Gate requires all 49 (override with `CONSOLE_LOOP_REQUIRED=a,b,c`).

Regenerate scripts anytime with `npm run console-loop:emit` — `emitted/*.js` is
gitignored (replay from emit + receipts).

## Limits

- Desktop Bridge cannot `fetch` localhost; use clientStorage chunking for >~50KB scripts.
- Sync dependencies before composites (Avatar/Button before Card).
- Canvas-absent contract facts are gaps, not mismatches.
