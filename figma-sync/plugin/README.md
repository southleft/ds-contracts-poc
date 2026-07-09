# DS Contracts Sync Runner (Figma dev plugin)

Runs the generated figma-sync scripts in the **current Figma file**, two ways:

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
- Network access is dev-only `http://localhost:8765` (see `manifest.json`);
  the plugin talks to nothing else. Optional server token: see the header
  comment in `code.js`.

## Files

| File | What |
|---|---|
| `manifest.json` | Plugin manifest — `main` + `ui`, localhost-only network access |
| `code.js` | Sandbox side: executes scripts (`new Function` async wrapper), local-runner fetch/integrity/report flow |
| `ui.html` | Window: the two tabs, report rendering. Dependency-free vanilla |

More context: [docs/internal/figma-sync.md](../../docs/internal/figma-sync.md).
