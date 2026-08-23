<!-- Landed 2026-08-23 on branch sync/spine-grammar-aware. This is the investigation report for the
six red scheduled sync-spine runs, committed so the per-row evidence is in the repo and not only in a
session scratchpad. Two notes on what this branch did and did NOT do with it:

1. The ledger reconciliation landed here covers ONLY classes A / A' / B1 (69 rows: 64 re-pinned, 5
   adopted with a note). Classes B2 (50), B3 (5), C (1), D1 (1), D2 (2) are left exactly as the spine
   reports them — 55 conflict + 4 code-ahead — because each is a decision for the owner, not the
   instrument. Their pre-2026-08-23 baselines (recorded under dump grammar 1.5, untagged) were DROPPED
   by name by the re-baseline because `sync:ledger:check` rule 5 refuses a ledger whose baselines do
   not speak the mapper's grammar (1.31); the only record that the two D2 canvases (mui.fab, mui.link)
   actually moved is the evidence in the D2 row below.
2. The "Exit semantics verdict" section proposes mapping spine exit 1 (drift) to a green run with a
   warning. That change was NOT landed: it reverses the 2026-08-08 decision that a red scheduled run IS
   the drift signal, which is the owner's to make. The workflow keeps its exit behaviour; the only
   yml change on this branch copies SPINE.md into the job summary before re-raising the spine's own
   exit code. Re-verified live on this branch (read-only, plan mode): 69 in-sync / 55 conflict / 4
   code-ahead.
-->

# sync-spine: why six scheduled runs were red, classified — 2026-08-23

Worktree: origin/main fa88dbf1. Figma: REST GET only (nodes + versions); no write, no branch, no PR.
Run examined: 32634036683 (fa88dbf1, 10:32Z) + first red 32602697045 (4cfbb699, 08-22 22:31Z) + latest 32639783128. All three files' REST `version` were IDENTICAL in both red runs (GnQnj 2390537264651373038 · BMjUA 2388438498796415748 · 59mLQ 2389961688576685812) — the canvas did not move between them, yet 15 rows went in-sync → "designer edit" and every baseline fingerprint changed. That is the instrument.

## What the ledger compares (answer to 1a)
- Code half: `contractHashOf(contracts/*.json on disk)` vs `ledger.contractHash`. Committed `.figma.js` re-emits, specHash and receipt stamps play NO part.
- Canvas half: the v6 stamp read over REST (`plugin_data=shared`) vs `ledger.canvasFingerprint`; then `dumpv1` of the REST dump-v1 projection vs `ledger.observed.dumpFingerprint`. Never canvas-vs-committed-script.

## Root causes (three, all repo-side or session-side; zero third-party designer edits)
1. **Dump grammar moved, baselines did not** — `extract/figma/rest/map.ts` went dumpVersion 1.5 → 1.31 (9d65808e, 0dc0811c, cda65c2b on 08-22; plus an unbumped 21-line change on 08-15). All 87 baselines were recorded 08-08 under 1.5. Proof: re-dumping today's canvas (raw in scratchpad/raw/) with the 08-08 mapper (`git show 8ac96363:extract/figma/rest/map.ts`) reproduces the 08-08 baseline byte-for-byte for **66** of 87 baseline rows → those canvases are unchanged; the "designer edit" note was false. Includes the named rows ds.code, ds.table-cell, ds.toast (their PR bundles' "mismatches" are token-name inversions only: `{color.surface.sunken}` vs `{imported.code.root.background-color}`).
2. **Contract bytes moved by bookkeeping** — schema 17 codemod dbeb3575 (104 records: v16 `anchors`/figma-only fields → `bindings.*`), anchor re-points cc6a2976/2d0ffef1 (16 records, `bindings.*.anchors` only). Verified by applying `migrateDocumentToV17` to the 8ac96363 bytes: 120 records differ from HEAD by nothing else. This is why 32602697045 had "12 conflict, 85 canvas-ahead, 21 in-sync" and the next run "119 conflict, 9 code-ahead". 8 records changed semantically (astryx.banner, flowbite.alert, flowbite.toggleswitch, mui.accordion, mui.avatar, mui.fab, mui.link, mui.slider).
3. **Unrecorded canvas writes** — 58 sets carry a v6 stamp that appears nowhere in the repo (no receipt, no ledger). Figma version history: every version since 08-09 is by "TJ Pitre" (plugin/console-loop sessions 08-09, 10, 11, 12, 16, 17, 20, 21) + one "Figma" autosave 08-22; no other user. Receipts under parity/receipts/console-loop still carry the 08-06/08-08 v6 for all 128 rows; nothing in the repo calls `sync record --from-receipt` (README's "the verb the generate loops call" is not wired).

## Classified table (every non-in-sync row of run 32634036683)
| class | n | rows | evidence | reconciliation | Figma write? |
|---|---|---|---|---|---|
| **A** instrument-only (cause 1+2) | 64 | all `ds.*` except banner/card/token; altitude.badge/chip/divider/iconclose/link; carbon.button; flowbite.badge; polaris.text; mui.autocomplete/breadcrumbs/card/chip/circular-progress/dialog/icon-button/input-adornment/snackbar/tooltip | stamp == ledger; 08-08 mapper reproduces baseline (or no baseline); contract delta = codemod/anchors only | `sync observe --repin <ids>` (new verb; refuses unless stamp matches) — **done in patch** | no |
| **A'** two instruments (v5 stamp) | 2 | mui.button, mui.menu | set carries v5 stamp, receipt recorded v6; 08-08 mapper == baseline | `--adopt` with note (v5 cannot be recorded; baseline is the evidence) — **done** | no |
| **B1** restamp-only write, content identical | 3 | flowbite.card, mui.linear-progress, mui.table-pagination | stamp Δ; 08-08 mapper == baseline | `--adopt` with note — **done** | no |
| **B2** unrecorded session write, code delta bookkeeping-only | 50 | altitude.button,altitude.heading,astryx.badge,astryx.button,astryx.card,astryx.checkbox-input,astryx.dropdown-menu-item,astryx.dropdown-menu,astryx.progress-bar,astryx.slider,astryx.switch,astryx.text-input,astryx.toast,astryx.token,carbon.accordion,carbon.checkbox,carbon.iconbutton,carbon.inlinenotification,carbon.modal,carbon.tabs,carbon.tag,carbon.textinput,carbon.toggle,flowbite.button,polaris.avatar,polaris.badge,polaris.banner,polaris.button,polaris.checkbox,polaris.progress-bar,polaris.radio-button,polaris.spinner,polaris.tag,polaris.text-field,polaris.thumbnail,ds.banner,ds.card,ds.token,mui.alert,mui.badge,mui.checkbox,mui.divider,mui.drawer,mui.paper,mui.radio,mui.select,mui.switch,mui.table,mui.tabs,mui.text-field | stamp Δ, value in no receipt; commits 08-09..17 say "rebuilt/flips to pass ON THE CANVAS" | TJ: `npm run sync:observe -- --adopt <ids> --note "…"` if the canvas is the truth (repo-side, no write) — or re-apply from code via plugin (**Figma write**) | his call |
| **B3** unrecorded write AND semantic code change | 5 | astryx.banner,flowbite.alert,mui.accordion,mui.avatar,mui.slider | as B2 + anatomy/props/events changed in contract after the write | true conflict: review the bundle in the artifact; then `--adopt` or publish+apply (**write**) | his call |
| **C** genuine code-ahead | 1 | flowbite.toggleswitch | stamp == ledger, 08-08 mapper == baseline, contract semantics/anatomy/events changed (968958cd) | canvas is behind: publish+apply (**Figma write**) | yes |
| **D1** stamp stripped | 1 | altitude.avatar | set carries NO `ds_contracts/canvasFingerprint`; 08-08 mapper == baseline (content unchanged) | restamp via plugin (**write**) then `--adopt`; now reports "no canvas evidence" honestly | yes |
| **D2** canvas moved w/o restamp AND semantic code change (session hand-edit) | 2 | mui.fab, mui.link | stamp == ledger; 08-08 mapper ≠ baseline (real canvas change, e.g. mui.link root layout HORIZONTAL/CENTER → VERTICAL/MIN); contract anatomy changed 16889547 | true conflict — TJ. NOTE: their 1.5 baselines were dropped by the re-baseline (incomparable under 1.31); this report is now the only record that those two canvases moved | his call |

(Per-row evidence: scratchpad/classes.txt, redump-verdicts.txt, code-half-classes.txt.)

## After the patch (live, read-only, verified)
`sync observe`: **69 in-sync, 55 conflict (50 B2 + 5 B3), 4 code-ahead (C, D1, D2×2)** — every remaining row is a real decision for TJ; none is the instrument.
Ledger delta: 69 hashes re-pinned, 3 stamps adopted, 69 baselines re-recorded under grammar 1.31, 23 incomparable (1.5, untagged) baselines dropped by name.

## Spine logic fixes in spine.patch (the misclassification was real)
- `ledger.ts`: `observed.dumpVersion`; `SetObservation.dumpVersion`; `baselineComparableWith` — baselines compare only within a grammar; foreign/untagged → "incomparable (the instrument moved, not the canvas)", never canvas evidence. `map.ts` exports `REST_DUMP_VERSION`.
- `cli.ts observe`: `--repin id[,…]` (refuses unless stamp == ledger), `--adopt id[,…] [--note]` (explicit ids, never all), `--update` drops incomparable baselines loudly on rows it cannot re-baseline.
- `ledger-check.ts` rule 5: a committed baseline not speaking the mapper's grammar refuses in the FAST lane with the re-baseline command — a grammar bump must ship with its live re-baseline, not surface as designer edits on the cron 2 h later.
- `spine.ts` PR body "After merging": `--update` could never re-baseline a merged proposal (row is not in-sync) → now `--adopt <id>`.
- evals `sync-ledger-lockfile`: 4 new red assertions (foreign grammar → in-sync by stamp with the instrument named; untagged → named; moved stamp under foreign grammar → still canvas-ahead). Fixture ledger baselines tagged.
- docs/23 §B.14 correction: "the REST route cannot read shared plugin data" is false (this run read 128 stamps over REST).

## Exit semantics verdict (3) — NOT LANDED; owner decision (see header note 2)
Header said "a red run IS the drift signal". Six reds, one cause, zero actionable-by-merge, and spine exit 1 (drift, bundles produced) was indistinguishable from exit 2 (spine crashed). **Revised in the patch:** spine exit 1 → green + `::warning` + drift table in `$GITHUB_STEP_SUMMARY` + artifact + output `drift=true`; exit 2 → the lane's only red; exit 0 → notice. Script exit codes unchanged (eval-pinned). README, workflow header, lane-coverage text updated. This reverses the 08-08 decision — say so if you disagree; it is one `case` block.

## Verification on the patched tree
- `npm run sync:ledger:check` → 128 ok, 123 receipt-citing verified (5 adopted rows re-noted), 69 baselines speak 1.31.
- `npx tsx evals/run.ts --only sync-spine,channel-round-trip,sync` → 4/4: channel-round-trip, sync-ledger-lockfile, sync-spine-drift, pending-first-sync-not-drift.
- `npx tsc --noEmit` 0 · `npm run lint` 0 · `npm run format:check` clean.
- Live `sync:spine --run-id local-verify` (read-only): Totals 55 conflict, 4 code-ahead, 69 in-sync; exit 1.

## Commands for TJ (repo-side unless marked WRITE)
```
# B2 — accept the canvas as truth for the 08-09..21 session writes (no Figma write):
npm run sync:observe -- --adopt altitude.button,altitude.heading,astryx.badge,astryx.button,astryx.card,astryx.checkbox-input,astryx.dropdown-menu-item,astryx.dropdown-menu,astryx.progress-bar,astryx.slider,astryx.switch,astryx.text-input,astryx.toast,astryx.token,carbon.accordion,carbon.checkbox,carbon.iconbutton,carbon.inlinenotification,carbon.modal,carbon.tabs,carbon.tag,carbon.textinput,carbon.toggle,flowbite.button,polaris.avatar,polaris.badge,polaris.banner,polaris.button,polaris.checkbox,polaris.progress-bar,polaris.radio-button,polaris.spinner,polaris.tag,polaris.text-field,polaris.thumbnail,ds.banner,ds.card,ds.token,mui.alert,mui.badge,mui.checkbox,mui.divider,mui.drawer,mui.paper,mui.radio,mui.select,mui.switch,mui.table,mui.tabs,mui.text-field --note "session applies 2026-08-09..21, receipts never re-recorded"
# B3 / D2 — review sync/out bundles first (artifact sync-spine-32634036683), then --adopt or publish+apply (WRITE)
# C  — flowbite.toggleswitch: publish+apply through the plugin (WRITE), then npm run sync:observe -- --adopt flowbite.toggleswitch
# D1 — altitude.avatar: restamp via plugin (WRITE), then --adopt
```
Process hole to close separately: nothing records a plugin apply / console-loop rebuild into the ledger (README's "generate loops call sync record" is unwired) — every B row is that hole.
