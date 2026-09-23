# DS Contracts Sync Runner (Figma dev plugin)

The designer's whole surface for contracts, in **four surfaces**: **Build**,
**Changes**, **Send**, and an **Advanced** drawer (the 2026-07-26 IA —
`docs/19-plugin-ia.md` is the decision record). The first three run on the
**plugin engine** — the repo's core barrel (schema referee, Figma script
emitter, proposal machinery) bundled into the packaged `ui.html` with the
repo's tokens, contracts and icons baked in (`window.DSC`, built by
`scripts/build-plugin-zip.mjs`, drift-guarded by `engine.receipt.json`).

- **Build** — "I have contracts (or want the sample); put them on this
  canvas." Paste a contract JSON or a `CONTRACTS-BUNDLE` into the box — JSON
  is the input for this contract workflow, never a script. The plugin validates it
  against the schema (plain-words refusals), emits the sync script
  **locally**, runs it in the current file, and selects + zooms the built
  set. Bundles sync in dependency order and upsert their token collections
  unconditionally (a fresh file just works; a re-run upserts — there is no
  checkbox to forget). A bundle carrying a **`tokenSet`** (a foreign
  library's flat DTCG base + optional light/dark modes + minted tree,
  written by `ds-contracts figma bundle`) syncs THAT set as its own named
  collection (Light/Dark modes, Figma-native aliases for `{alias}` minted
  leaves) — a foreign library is ONE JSON paste, never a compiled script.
  When the file already has contract-backed sets, the same button reads
  **Check against this file**: a per-set change report (create · amend in
  place · skip, every row a checkbox) renders BEFORE anything applies — the
  plugin never applies silently. Amends keep node ids and property ids, so
  instances keep their component-property overrides; edits on nodes INSIDE
  an amended variant are rebuilt from the contract. An empty file offers the
  baked sample library; a file with unmarked components counts them and
  leads with a read-only scan instead. *Receive by code* is folded into
  "Other ways to receive": a developer runs
  `ds-contracts figma push <file> --code <CODE>` and the bundle travels the
  pairing bridge — deliver-once, 15-minute TTL, both of you present.

- **Changes** — "what moved?" Two labelled sections. **From your team** is
  the standing channel, the plugin's primary delivery route: an engineer
  runs `ds-contracts figma claim-channel` once, keeps the write key in CI,
  and hands you the read key (`dscr_…` — the sha256 of the write key; it
  can read deliveries and can never publish). Paste it once; it is
  remembered. From then on CI publishes on merge (`ds-contracts figma
  publish`) and **Check for updates** pulls the latest delivery — GitHub
  Actions provenance ("repo — CI run #N, commit …") renders above the same
  change report Build uses, and a monotonic `seq` freshness guard names a
  delivery older than what this file already applied and starts every Apply
  box unchecked. On open the plugin makes one head-only check; an update
  waiting is a dot on the tab, never an auto-apply. **On this canvas** is
  drift: every generated set remembers which contract built it, **Check
  drift** compares that record with the canvas now, and the report names
  each edited variant (was → now) with a deep link into Send.

- **Send** — "get what is on this canvas to the code side." **Scan this
  file** is a read-only pass over every local component set — including the
  ones this tool did not make. Pick a set (or your selection). Send follows
  its actual local main-component references, including applied instance
  swaps, and reads the children before the parent. A multi-component family
  exports as one `.family.json`: load it in the app's **JSON** input to
  retain the captured dependencies and open the requested parent. Review
  refusals and provisional children there before preparing a React library.
  Remote, missing, circular or ambiguous dependencies refuse by name; the
  capture allows at most 64 pulled sets and 50,000 visited nodes. The app's
  separate 30-component workspace limit still applies. Single-proposal PR
  and pairing delivery are unavailable for these family artifacts.
  If Figma disables Save in its download dialog, use **Copy JSON** and paste
  into the app; native file saving remains unqualified in the live evaluation.
  For a single component, with a base
  contract you get an API-level diff (version, props, slots, variant axes;
  sets this tool generated pre-fill their own base); without one the plugin
  proposes a contract from what is drawn — the path for hand-built
  components, no base needed — and names what that proposal becomes in code
  before anything is sent. Ship it as JSON, as a GitHub PR (pasted
  fine-grained token, session-only, never stored — closing the plugin
  forgets it; **Dry run** is the default and prints the exact 4-step REST
  plan while sending nothing), or through *Send to repo*:
  `ds-contracts figma receive --out contracts` on the developer's machine
  prints a pairing code, the proposal travels the bridge, and the CLI
  writes nothing without `--apply`.

- **Advanced** — the drawer; no end user needs anything here. **Paste a
  script** runs one raw generated script (see the trust model — this is the
  one unguarded surface). **Local runner** fetches every script in
  `figma-sync/` from `npm run figma:serve` (port 8765) and runs them in
  dependency order, SHA-256-verified against the server manifest, stopping
  on first failure. **Diagnostics** shows the engine build stamp
  (`window.DSC_BUILD`, injected at package time — compare it against
  `engine.receipt.json` / the `build-plugin-zip` output to spot a stale dev
  import at a glance) and the file's contract-backed / not-under-contract
  set counts.

## Load it (one-time)

The playground serves this directory as a downloadable zip
(`/ds-contracts-sync-runner-plugin.zip`, built by
`scripts/build-plugin-zip.mjs` at playground build time). **Use the zip** —
it contains the packaged `ui.html` with the engine bundle injected; a direct
repo load shows a named "no engine bundle" message on the engine surfaces
(the Advanced drawer still works).

1. Download + unzip, or run `node scripts/build-plugin-zip.mjs` and unzip
   `playground/public/ds-contracts-sync-runner-plugin.zip`.
2. Open the target file in the Figma **desktop** app (dev plugins don't load
   on figma.com) with edit access.
3. **Plugins → Development → Import plugin from manifest…** and pick the
   unzipped `manifest.json`.
4. Run **DS Contracts Sync Runner** (Plugins → Development). Nothing
   executes until you press a button.

## Connect the local source workflow

Run `npm run playground` on port 5181. In **Sources**, derive a measured source
candidate and choose **Prepare connection**. Run this development plugin in the
authorized Scratch file, open **Build → Connect the local source workflow**,
paste the connection and choose **Connect / resume**. Back in the app, choose
**Create and inspect**. Keep both open while the app drives token creation,
independent token readback, component creation and independent structural readback.

The app hands out a command once. The plugin stores its result before returning
it; **Connect / resume** can resend a saved result after a restart. A creation
whose result was never saved remains unknown and is not executed again.
For an interrupted or refused observation, use **Retry readback** in the app.
The plugin can replace a held readback only after the app journal retires that
attempt; the replacement is read-only and cannot repeat creation. Keep the
connection open to receive that replacement.
**Disconnect** stops subsequent polling; an in-flight operation can still finish.
This development flow remains unqualified until its actual native output,
visual fidelity, editability and repeat behavior are verified.

The development manifest enables the private API so the plugin can check the
actual file identity, as required by [Figma's fileKey API](https://developers.figma.com/docs/plugins/api/figma/).
Missing or different file identity refuses the source operation.

## Trust model

- **Read-only guarantee.** Every read action in Build, Changes and Send
  (scan, drift, inventory, propose's set read) runs against a guarded
  `figma` façade in `code.js` that throws on any write — the `readOnly`
  flag is enforced, not decorative. Writes happen only when you press
  Generate/Apply on a report the plugin showed you first. A thrown sync
  script can leave changes made before the error, including incomplete
  components. Preserve its report and inspect the canvas before repairing
  the affected nodes or retrying.
- **The ONE unguarded surface is Advanced → Paste a script.** It runs
  whatever you paste with **full plugin permissions in the file you have
  open** and is NOT run against the guarded read-only API — a script pasted
  there can change this file. Paste only scripts you generated yourself.
  The engine surfaces only run scripts the embedded engine emitted from a
  schema-validated contract.
- Network access (see `manifest.json`): the bridge/channel worker origin
  (Receive by code and Send to repo ride the pairing bridge; Check for
  updates reads the standing channel — bundle and proposal deliveries
  answer the plugin's `Origin: null`, and the pairing code / read key is
  the auth), `api.github.com` (ONLY the optional Send PR flow; dry run
  sends nothing), plus dev-only `localhost:8765/8787`. The plugin talks to
  nothing else. GitHub tokens live in the window's memory for the session
  and are never persisted; the channel read key is remembered in
  `clientStorage` and can only ever read — a leaked read key can never
  publish into your repository.

## Files

| File | What |
|---|---|
| `manifest.json` | Plugin manifest — `main` + `ui`, bridge/channel + GitHub network access |
| `code.js` | Sandbox side: guarded read-only `figma` façade, script execution (`new Function` async wrapper), bridge-poll + channel + push-proposal transports, local-runner fetch/integrity/report flow |
| `ui.html` | Window: the four surfaces, the shared change report, the `#plugin-engine` slot the zip build fills. Dependency-free vanilla |
| `engine/entry.ts` | The plugin engine (pure compute over the core barrel) — bundled + injected at package time |
| `engine.receipt.json` | Drift guard: input hash + size of the engine bundle; the zip build refuses when stale |

Headless coverage: `npm run plugin:check` (`scripts/plugin-engine-check.mjs`)
runs the real bundle in a VM against a mocked `figma` global — generate,
bundle order, update report, amend-in-place apply, propose diff, PR dry-run.
`node scripts/plugin-ui-check.mjs` drives the packaged `ui.html` in a real
browser against a `code.js` simulator, and it also gates THIS file: the
README ships inside the plugin zip, so dead surface names fail the check.

More context: [docs/internal/figma-sync.md](../../docs/internal/figma-sync.md).
