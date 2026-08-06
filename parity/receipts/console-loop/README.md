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
npm run console-loop:emit              # regenerate emitted/*.js for Testing file
npm run console-loop:evidence:check    # fail-closed on required receipts
```

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
