# DS Contracts Sync Runner (Figma dev plugin)

The designer's whole surface for contracts, in six tabs. The first three run
on the **plugin engine** — the repo's core barrel (schema referee, Figma
script emitter, proposal machinery) bundled into the packaged `ui.html` with
the repo's tokens, contracts and icons baked in (`window.DSC`, built by
`scripts/build-plugin-zip.mjs`, drift-guarded by `engine.receipt.json`):

- **Generate** — paste a contract JSON (or a `CONTRACTS-BUNDLE`), or receive
  one by pairing code (`ds-contracts figma push <file> --code <CODE>`). The
  plugin validates it against the schema (plain-words refusals), emits the
  sync script **locally**, runs it in the current file, and selects + zooms
  the built set. Bundles sync in dependency order; referenced components the
  bundle doesn't carry are pulled from the baked repo scope and synced first.
  A "sync token variables first" checkbox (default on) upserts the token
  collections so fresh files just work.
- **Update library** — receive a bundle (a CI artifact), then **Check
  against this file**: each contract is looked up by its identity marker
  (`ds_contracts/contractId`, the amend machinery's identity) and the plugin
  prints a plain-words change report BEFORE anything applies — e.g.
  `• Badge 1.4.0 → 1.5.0: +prop Loading.`, `• Switch 2.0.0: new — will be
  created (2 variants).`, `• Tag 1.0.0: unchanged — will be skipped.` Tick
  the rows you want and press **Apply**: changed sets amend IN PLACE (same
  node ids, same property ids — instances keep their overrides), new ones
  are created, unchanged ones skip. The report+confirm step is mandatory;
  the plugin never applies silently.
- **Propose** — select a generated set (or name it); the plugin dumps it
  with the embedded read-only dump script, proposes a contract from what is
  drawn, and diffs it against the base contract (pre-filled from the baked
  repo scope when the set's marker matches; paste it otherwise). The diff is
  API-level (version, props, slots, variant axes) with a named scope note.
  Export it as JSON, or open a GitHub PR directly with a pasted fine-grained
  token (session-only, never stored — closing the plugin forgets it).
  **Dry run** (default) prints the exact 4-step REST plan and sends nothing.

The original three transports are unchanged:

- **Paste a script** — paste one generated script and run it (the designer
  trust round-trip). On success the plugin selects the built component and
  zooms to it; errors show verbatim; a thrown script is atomic by Figma's
  design, so a failed run never leaves a half-synced file.
- **Send to Playground** — runs the repo's read-only dump script
  (`extract/figma/dump.plugin.js`, embedded verbatim in `ui.html`; the
  plugin-zip build refuses a drifted copy) over the named component sets
  (empty = your selection; nothing selected = all), then POSTs the dump to
  the pairing bridge under the code the playground's Figma tab shows.
  Privacy: held at most 15 minutes, deleted on pickup, never logged.
- **Local runner** — fetch every script in `figma-sync/` from
  `npm run figma:serve` (port 8765) and run them in dependency order,
  SHA-256-verified against the server manifest, stopping on first failure.

## Load it (one-time)

The playground serves this directory as a downloadable zip
(`/ds-contracts-sync-runner-plugin.zip`, built by
`scripts/build-plugin-zip.mjs` at playground build time). **Use the zip** —
it contains the packaged `ui.html` with the engine bundle injected; a direct
repo load shows a named "no engine bundle" message on the engine tabs (the
other three tabs still work).

1. Download + unzip, or run `node scripts/build-plugin-zip.mjs` and unzip
   `playground/public/ds-contracts-sync-runner-plugin.zip`.
2. Open the target file in the Figma **desktop** app (dev plugins don't load
   on figma.com) with edit access.
3. **Plugins → Development → Import plugin from manifest…** and pick the
   unzipped `manifest.json`.
4. Run **DS Contracts Sync Runner** (Plugins → Development). Nothing
   executes until you press a button.

## Trust model

- Pasted scripts (and generated ones) run with **full plugin permissions in
  the file you have open**. The engine tabs only run scripts the embedded
  engine emitted from a schema-validated contract; the paste tab runs
  whatever you paste — paste only scripts you generated yourself.
- Network access (see `manifest.json`): the pairing bridge origin (Send to
  Playground POSTs dumps; Generate/Update poll pushed bundles by code),
  `api.github.com` (ONLY the optional Propose PR flow; dry-run sends
  nothing), plus dev-only `localhost:8765/8787`. The plugin talks to nothing
  else. GitHub tokens live in the window's memory for the session and are
  never persisted.
- Known gap (2026-07-19): the deployed bridge worker still refuses
  plugin-origin GETs (its read route is playground-origin-gated), so
  **Receive by code** surfaces the worker's named refusal until the worker
  allows bundle reads with the code as auth. Paste always works.

## Files

| File | What |
|---|---|
| `manifest.json` | Plugin manifest — `main` + `ui`, bridge + GitHub network access |
| `code.js` | Sandbox side: executes scripts (`new Function` async wrapper), engine-run + bridge-poll transports, local-runner fetch/integrity/report flow |
| `ui.html` | Window: six tabs, report rendering, the `#plugin-engine` slot the zip build fills. Dependency-free vanilla |
| `engine/entry.ts` | The plugin engine (pure compute over the core barrel) — bundled + injected at package time |
| `engine.receipt.json` | Drift guard: input hash + size of the engine bundle; the zip build refuses when stale |

Headless coverage: `npm run plugin:check` (`scripts/plugin-engine-check.mjs`)
runs the real bundle in a VM against a mocked `figma` global — generate,
bundle order, update report, amend-in-place apply, propose diff, PR dry-run.

More context: [docs/internal/figma-sync.md](../../docs/internal/figma-sync.md).
