# DS Contracts Sync Runner (Figma dev plugin)

Runs the generated figma-sync scripts in the **current Figma file** (two
ways), and sends the current file's component sets **to** the playground:

- **Send to Playground** — the recommended import route for the
  [playground](../../playground/PLAN.md). Runs the repo's read-only dump
  script (`extract/figma/dump.plugin.js`, embedded verbatim in `ui.html`;
  the plugin-zip build refuses a drifted copy) over the named component sets
  (empty = all), then POSTs the dump to the pairing bridge
  (`workers/assist/src/bridge.ts`) under the 6-character code the
  playground's Figma tab shows. Because the Plugin API resolves bound
  variable **names** on any Figma plan, the playground's proposal binds real
  tokens — no Enterprise REST gap, no copy/paste. Privacy: the dump is held
  by the bridge at most 15 minutes, deleted on pickup, contents never
  logged; nothing in the Figma file changes.

- **Paste a script** — paste one generated script and run it. This is the
  designer trust round-trip for the [playground](../../playground/PLAN.md):
  copy the **Figma script** output tab, paste it here, press Run, and read
  the report (created/amended/skipped, variant count, node ids). On success
  the plugin selects the built component and zooms to it; when the component
  already exists in the file it says so in plain words and offers **Select
  it**. Errors show verbatim; a thrown script is atomic by Figma's design,
  so a failed run never leaves a half-synced file.
- **Local runner** — fetch every script in `figma-sync/` from the local
  server (`npm run figma:serve`, port 8765) and run them in dependency
  order, SHA-256-verified against the server manifest, stopping on first
  failure. The from-disk transport for full-library rebuilds.

## Load it (one-time)

The playground serves this directory as a downloadable zip
(`/ds-contracts-sync-runner-plugin.zip`, built by
`scripts/build-plugin-zip.mjs` at playground build time) with the same steps
in its Figma tab. From the repo:

1. Open the target file in the Figma **desktop** app (dev plugins don't load
   on figma.com) with edit access.
2. **Plugins → Development → Import plugin from manifest…** and pick
   `figma-sync/plugin/manifest.json`.
3. Run **DS Contracts Sync Runner** (Plugins → Development). The window with
   both tabs opens; nothing executes until you press a Run button.

## Trust model

- Pasted scripts run with **full plugin permissions in the file you have
  open** — paste only scripts you generated yourself (the playground's
  output, or `figma-sync/*.js` from a repo state you trust). There is no
  manifest to verify a paste against; the integrity check applies to the
  local-runner transport only.
- Network access (see `manifest.json`): the pairing bridge origin
  (`ds-contracts-assist.southleft-llc.workers.dev`, used ONLY by Send to
  Playground) plus dev-only `http://localhost:8765` (local runner) and
  `:8787` (wrangler dev for the bridge). The plugin talks to nothing else.
  Optional server token: see the header comment in `code.js`.

## Files

| File | What |
|---|---|
| `manifest.json` | Plugin manifest — `main` + `ui`, localhost-only network access |
| `code.js` | Sandbox side: executes scripts (`new Function` async wrapper), local-runner fetch/integrity/report flow |
| `ui.html` | Window: the two tabs, report rendering. Dependency-free vanilla |

More context: [docs/internal/figma-sync.md](../../docs/internal/figma-sync.md).
