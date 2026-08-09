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
  Current genuine scorecard passes, **re-measured 2026-08-08 against the real
  npm package** (`extract/computed/out/<lib>/<comp>/orig-shots/`, written by
  `extract/computed/run.ts --keep-originals`): tailwind 3/5, altitude 3/8,
  carbon 3/10, astryx 0/11, polaris 4/12, mui 2/31 (15/77 foreign; see
  `CORPORA.md` and each lane's `LEDGER.md`). Everything before that date was
  scored against the **CONTRACT RENDER** (`gate-shots/` = enriched contract →
  emit-html) and measured emitter agreement, not fidelity.
- **Attested-only (first-party remainder).** MUI went strict 2026-08-08;
  the first-party lane BEGAN its strict transition the same day on the blank
  playground file `BMjUA2ue5CaZXU4kufxL0z` — 10 stems carry pixel scorecards
  under `scores/` (5 scored-pass: avatar, badge, banner, divider, switch;
  5 honest fail-closed: button, card, checkbox, text-field, token), scored
  at scale 1 against contract-default `src/components` renders committed
  under `refs/` (`scripts/console-loop-render-ref.mts`, Inter face pinned).
  The remaining 39 first-party stems stay attested-only (printed loudly)
  until their refs + scorecards land; once a scorecard exists the claim is
  enforced strictly. `fileKey` is per-receipt — the gate accepts the known
  evidence-file allowlist, not a lane constant.
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
(49 lower-order first-party stems; `inline` / `stack` are native and skipped,
plus the 5 A3 composition stems below = **54**).
Gate requires all 54 (override with `CONSOLE_LOOP_REQUIRED=a,b,c`).

### A3 composition corpus (2026-08-08)

`two-column`, `sidebar-layout`, `grid-gallery`, `bento-grid`, `page-shell` —
the first stems in this lane whose subject is **layout with slots** rather than
a lower-order component. They are scored **twice**, and the convention is
pinned in [docs/composition-corpus/README.md](../../../docs/composition-corpus/README.md):

- **EMPTY → structural, never pixels.** A native empty slot is Figma's own
  frame with zero chrome, so an empty composition exports as a blank PNG
  (measured: 404 bytes). Presence + name + placement box only, recorded in
  `scores/<stem>.structural.json`.
- **FILLED → pixels under the standard bar**, with the SAME child pinned on
  both surfaces (one `ds.badge` per slot), recorded in `scores/<stem>.json`.

A receipt may claim a pass only when BOTH halves pass. `bento-grid` (0.10%) and
`page-shell` (0.08%) are `scored-pass`; the other three are honest fail-closed
on **FC-GRID-ROOT-VSIZE** even though their pixel scorecards pass — the lane
scorer trims to the ink bounding box, so it cannot see the canvas root's dead
space. The RATCHET floor was **not** raised: these stems have no headless
visual-truth card, so only one instrument backs them.

Code-side references come from
`scripts/console-loop-render-composition-ref.mts` (the compositions' sibling of
`console-loop-render-ref.mts` — it takes a slot FILL SPEC instead of a JSON prop
bag, and clips to the composition ROOT's box).

> **Transport:** the `localhost:9223` pattern below no longer reaches the
> plugin — the figma-console MCP server itself binds `[::1]:9223` and the
> plugin's `localhost` resolves to IPv6, so every fetch gets that server's 404.
> The Desktop Bridge allowlist covers **9223–9232**; run stem-serve on **9224**.
> A port outside that range is blocked by the plugin CSP.

Regenerate scripts anytime with `npm run console-loop:emit` — `emitted/*.js` is
gitignored (replay from emit + receipts).

## Limits

- Desktop Bridge cannot `fetch` localhost; use clientStorage chunking for >~50KB scripts.
- Sync dependencies before composites (Avatar/Button before Card).
- Canvas-absent contract facts are gaps, not mismatches.
