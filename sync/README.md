# sync/ — the code↔canvas sync ledger (STEP 1) + drift spine (STEP 2)

`sync/ledger.json` is a **committed lockfile**: one record per synced
component, holding the contract hash and the canvas fingerprint that were
last known to **agree**. It is the durable connection between the repo's
contracts and the Figma canvas — the thing every later sync feature (the
scheduled drift spine, step 2) does its arithmetic against.

## The record

```jsonc
{
  "contractId": "ds.badge",                       // the contract's identity
  "contractPath": "contracts/badge.contract.json",// where observe finds the code half
  "contractHash": "sha256:…",                     // canonicalRevisionOf(contract) at last sync (provenance excluded)
  "fileKey": "GnQnjSNBXtgtd2Ht0Hs1C8",            // Figma file
  "setNodeId": "1:309",                           // the component set node
  "canvasFingerprint": "v6:4215075650",           // the v6 stamp at last sync (core/canvas-fingerprint.ts)
  "lastSyncedVersionId": null,                    // Figma REST file `version` at sync (null = sync path had no REST access)
  "lastSyncedAt": "2026-08-06T03:39:58.190Z",
  "direction": "code→canvas",                     // or "canvas→code"
  "observed": null,                               // observation baseline (see below), or null
  "provenance": "seeded-from-receipts",           // seeded-from-receipts | receive-apply | publish | sync-record | observe
  "note": "receipt parity/receipts/console-loop/components/badge.json"
}
```

Optional fields: `pendingApply: true` (a publish whose canvas half has not
been applied yet), `canvasSpecHash` (the set's `ds_contracts/specHash` marker
when a canvas→code envelope carried one), `note`.

Serialization is **deterministic** — records sorted by `(contractId, fileKey)`,
fixed key order, 2-space indent, trailing newline — and schema-validated with
refusals by name (`sync/ledger.ts`). Never hand-order the file; regenerate it
through the verbs below. `npm run sync:ledger:check` refuses bytes that are
not their own re-serialization.

## Two fingerprint domains, kept honest

- **`canvasFingerprint` (v6)** is computed *in the Figma runtime* and stamped
  on the set as `sharedPluginData ds_contracts/canvasFingerprint`. Writers
  record it; observe **reads the stamp back** over REST (`plugin_data=shared`).
  It is never recomputed headlessly — REST paint JSON cannot reproduce the
  plugin serialization byte-for-byte, and a second, differently-spelled
  resolver is exactly the drift this repo keeps finding.
- **`observed.dumpFingerprint` (`dumpv1:…`)** is the observation-domain
  baseline: djb2 over the canonical JSON of the set's dump-v1 projection
  (`extract/figma/rest/map.ts`, the mapper built to be byte-compatible with
  the plugin dump). A designer edit does **not** restamp v6 — this baseline is
  what catches it, once `sync observe --update` has recorded one.
- **`observed.dumpVersion`** tags the baseline with the dump grammar
  (`REST_DUMP_VERSION` in the mapper) that produced it. Baselines compare
  **only within a grammar**: when the mapper moves, every baseline's bytes move
  with it, and that is the instrument, not the canvas. A baseline under another
  grammar (or an untagged pre-2026-08-23 one) is named *incomparable* and never
  counts as canvas evidence; `sync:ledger:check` refuses a committed ledger
  whose baselines do not speak the mapper's current grammar, so a grammar bump
  must ship with its live re-baseline. Measured 2026-08-23: the 1.5 → 1.31 move
  shipped without one and six scheduled spine runs reported 87 untouched sets as
  designer edits.

## Writers — every sync verb records what it just did

| verb | direction | records |
|---|---|---|
| `ds-contracts figma receive --apply` | canvas→code | contractHash of the landed contract + the envelope's canvas provenance (`canvasSpecHash` when carried; the envelope has no fileKey/nodeId/v6 — recorded null, honestly) |
| `ds-contracts figma publish` | code→canvas | contractHash per bundled contract at publish time, `pendingApply: true` — the canvas half is pending until a designer applies; cleared by the apply-side record or a confirming `observe --update` |
| `npm run sync -- record --from-receipt <receipt.json>` | code→canvas | fileKey + setNodeId + v6 from a console-loop generation receipt — the verb the generate loops call after a receipt lands |
| `npm run sync -- seed` | code→canvas | all committed console-loop receipts (first-party + foreign corpora), provenance `seeded-from-receipts` |
| `npm run sync:observe -- --update` | (evidence only) | observation baselines for in-sync rows; adopts a post-publish restamp (clearing `pendingApply`, loudly); drops, by name, a baseline under a grammar the mapper no longer speaks on rows it cannot re-baseline |
| `npm run sync:observe -- --repin id[,id…]` | (code half only) | the contract bytes moved by **bookkeeping** (a schema codemod, an anchor re-point) and the canvas provably did not — the observed stamp equals the ledger's — so `contractHash` is re-pinned to the current bytes and a fresh baseline recorded. **Refuses** any row whose stamp differs, is absent or is incomparable: that row needs `--adopt` or a re-apply, never a quiet re-pin |
| `npm run sync:observe -- --adopt id[,id…] [--note …] [--evidence …]…` | canvas→code | the canvas is the truth for these rows: current contract hash + observed stamp + fresh baseline, `pendingApply` cleared, provenance `observe`, and a `decision` of kind **adopt** (note + evidence lines, bound to the facts adopted). The after-merge step of a spine PR, and the record for a write nobody ledgered (a plugin apply, a rebuild whose receipt never reached `sync record`). Explicit ids only — never "all" |
| `npm run sync:observe -- --decide <id> --kind pending-reapply\|pending-restamp\|pending-reconcile --note <why> --command <exact command> [--evidence …]…` | (decision only) | records a **human decision** on a drifted row that automation may not resolve (a Figma write to a non-scratch file; a choice between two truths). The record does not change; the row stops counting as *undecided* (WARN instead of red on the scheduled lane) and is listed in `sync/PENDING.md` with the command. Bound to the facts observed now — if the contract hash, stamp or dump fingerprint moves again the decision is **stale** and the row is undecided again. Refuses an in-sync row and kind `adopt` (that is `--adopt`) |
| `npm run sync -- pending` | (render only) | regenerates `sync/PENDING.md` from the ledger, offline and byte-stable (`sync:ledger:check` refuses a stale one; every `--adopt` / `--decide` and every spine run regenerates it too) |

The CLI writers are **opt-in**: they record only when `sync/ledger.json`
already exists in the cwd (this repo) or `DS_CONTRACTS_SYNC_LEDGER` names a
ledger path. A recording failure warns loudly but never undoes the completed
operation.

## The echo-loop invariant (unit-pinned: eval `sync-ledger-lockfile`)

A code→canvas amend **must record the resulting new canvas fingerprint at
write time** (`recordCodeToCanvasSync` refuses to record without one). The
next observation then sees a stamp that matches the ledger and classifies the
change as self-inflicted (**in-sync**) — not **canvas-ahead**, the false
alarm an unrecorded amend raises. The same function drops the stale
observation baseline, because it describes the canvas the amend just
replaced.

## `sync observe` — the drift arithmetic

```
npm run sync:observe                         # live: every fileKey in the ledger (FIGMA_TOKEN, e.g. source .env)
npm run sync:observe -- --file-key <KEY>     # live, one file
npm run sync:observe -- --fixture sync/fixtures/canvas.rest.fixture.json \
                        --ledger sync/fixtures/ledger.fixture.json       # offline, committed fixture
```

Reads the current canvas state headlessly — REST file `version`, the per-set
v6 stamp (`plugin_data=shared`), and the dump-v1 fingerprint per set — plus
the current contract hashes, and classifies every record:

`in-sync | code-ahead | canvas-ahead | conflict | untracked`

Exit codes are gate-style on **undecided** rows (policy 2026-08-23): **0**
when every drifted row carries a fresh recorded decision (or nothing
drifted — decided-pending rows print as WARN and a `decisions:` line counts
adopted / pending-by-kind / stale / undecided), **1** when a row needs a
human decision that is not yet recorded (or an untracked set exists), **2**
usage/config error. This is the arithmetic step 2's scheduled spine runs.

## `sync pull` — the canvas→code half of the spine (STEP 2)

```
npm run sync:pull                                # live: pull every canvas-ahead record
npm run sync:pull -- --only polaris.avatar       # one component
npm run sync:pull -- --fixture sync/fixtures/canvas.rest.fixture.json \
                     --ledger sync/fixtures/ledger.fixture.json        # offline twin
```

For each **canvas-ahead** (and conflict) record: the set's headless REST dump
(the same `extract/figma/rest/map.ts` mapper observe rides), the
design→contract proposer in **reviewable-inversion** mode (`mintUnbound` —
unresolved canvas values become provisional `imported.*` tokens, never
guesses), and the disagreement report against the current contract as base:
`compareContracts` per-property classification (`matched | canvas-absent |
mismatch`) + a unified diff + the observation an adoption would record
(previewed in `drift.json.proposedLedgerRecord`, **never applied**). Output is
files under `sync/out/<runId>/<slug>/`; contracts/ and the ledger are never
touched. The proposal's identity (id/name/$schema) is pinned to the ledger
record — the record IS the set↔contract link.

## `sync:spine` — the one-shot drift spine (STEP 2)

```
npm run sync:spine                               # live plan (report-only)
npm run sync:spine -- --only polaris.avatar --open-pr   # ONE real PR (gh CLI auth)
npm run sync:spine -- --fixture sync/fixtures/canvas.rest.fixture.json \
                      --ledger sync/fixtures/ledger.fixture.json        # offline twin
```

observe → pull → a **PR-shaped bundle** per canvas-ahead record: branch
suggestion `sync-spine/<slug>`, the commit-ready file set (proposed contract
at its real path + envelope-v2 sidecars: minted DTCG tree, auto-proposed
child stubs), and a PR body draft (drift table + per-property classification
+ the inversion-vs-roundtrip honesty copy). For **code-ahead** records the
canvas is *behind*: the spine regenerates the JSON bundle (+ the .figma.js
via the first-party engine where it can; example libraries are pointed at
their own generate pipeline by name) and prints the
`canvas is behind: publish+apply needed` row — the existing publish/apply
transport does the rest.

- **Plan mode is the default.** `--open-pr` (capped by `--max-prs`, default
  1) creates branch + commits + PR via the authenticated `gh` CLI against the
  current branch (fallback: the repo default branch; override `--base`) — the
  local checkout is never touched.
- **Echo safety — no duplicate PR per drift.** Every spine PR body carries an
  HTML-comment marker recording the ledger + observed fingerprints it was
  based on; the spine keeps a cursor (`sync/out/state.json`) and skips, by
  name, any record whose current observed fingerprints it already PR'd. In CI
  (fresh checkout, no cursor) the branch-exists check is the durable half: an
  unresolved `sync-spine/<slug>` branch refuses a second PR by name.
- Exit codes mirror observe: 0 clean **or decided drift**, 1 an undecided
  row, 2 usage. `SPINE.md` carries a `Verdict:` line (`clean` |
  `drift-decided` | `undecided`) and a `Decisions:` count line; decided-pending
  rows print under WARN with their command; `PENDING.md` is written into the
  run dir and, when the ledger is the repo's, regenerated at `sync/PENDING.md`.

### The scheduled lane (.github/workflows/sync-spine.yml)

Cron every 2 h + `workflow_dispatch`: report-only spine run, drift table +
decisions in the job summary, bundles uploaded as an artifact. **Red means an
undecided row** (policy, 2026-08-23): the lane goes red only when a drifted
row has **no recorded human decision** (or its decision is stale — the
contract hash, stamp or dump fingerprint moved since it was taken), or an
untracked set exists. Drift whose every row carries a fresh decision in
`sync/ledger.json` (`decision`: adopt / pending-reapply / pending-restamp /
pending-reconcile) is **green with a `::warning`**, the pending Figma writes
listed in `sync/PENDING.md`; a spine crash (exit 2) is a **distinct red**
with its own summary. The 2026-08-08 rule ("a red run IS the drift signal")
is retired: six consecutive reds with one repo-side cause showed it could not
tell "the canvas moved" from "nobody has looked". Needs the `FIGMA_TOKEN`
repository secret — the owner
configures it; when absent the lane **skips by name** and stays green (a
missing credential must never impersonate drift). Set the repository variable
`SYNC_SPINE_OPEN_PR=true` to let the scheduled run open PRs (1 per run,
cursor/branch-deduplicated). `sync:spine` itself is EXCLUDED by name in
`.github/scripts/lane-coverage.ts`; the committed twin is the fixture-mode
eval below.

## Gates

- `npm run sync:ledger:check` (fast lane) — offline: schema + deterministic
  bytes + every seeded record verified against the receipt it cites
  (`parity/receipts/console-loop/**` is read-only evidence here) + every
  baseline tagged with the mapper's current dump grammar (a grammar bump
  without a live re-baseline refuses here, not on the cron) + every pending
  decision taken under that grammar + `sync/PENDING.md` the byte-exact render
  of the ledger + the committed-fixture drift table classifying all five
  statuses (and counting its 4 undecided rows).
- eval `sync-ledger-lockfile` (`npm run eval -- --only sync-ledger`) — the
  red tests: hand-edited fingerprint → canvas-ahead naming the component,
  contract-hash bump → code-ahead, both → conflict, recorded-amend echo →
  in-sync, unrecorded amend → the named false alarm, serialization
  determinism, schema refusals by name.
- eval `sync-spine-drift` (`npm run eval -- --only sync-spine`) — the spine's
  red tests over the same committed fixture canvas: canvas-ahead fixture →
  the plan contains the proposed contract + diff + classification + the
  fingerprint-marker PR body; in-sync scope → the spine plans nothing;
  already-PR'd cursor → skipped by name (the conflict sibling still pulls);
  code-ahead → the "canvas is behind" row + regenerated bundle.
- Live observation/pull/spine (`npm run sync:observe|sync:pull|sync:spine`)
  need `FIGMA_TOKEN` and are run by hand or on the scheduled lane — the
  fixture gates above are their committed twins.

## Files

- `ledger.json` — the lockfile (seeded 2026-08-08 from the 128 completed
  console-loop receipts: 49 first-party + 31 MUI + 5 Tailwind + 8 Altitude +
  13 Astryx + 10 Carbon + 12 Polaris).
- `ledger.ts` — pure core: schema referee, deterministic serialization,
  writers, `classifyRecord`/`driftReport` (browser-safe; the CLI bundles it).
- `ledger-io.ts` — the node-bound load/save half.
- `observe.ts` — observations from a REST nodes response (fixture or live).
- `pull.ts` — the canvas→code pull: REST dump → reviewable-inversion
  proposal → per-property drift report, as files only.
- `spine.ts` — the one-shot drift spine (observe → pull → PR-shaped bundles
  + the code-behind rows + the echo-safety cursor).
- `cli.ts` — `record | seed | observe | pending | pull`.
- `PENDING.md` — GENERATED from `ledger.json` (`npm run sync -- pending`;
  every `--adopt`/`--decide` and every spine run rewrites it): the one place
  a human reads the pending decisions — row, kind, why, the exact command,
  the file key it would write to, the evidence. Byte-checked by
  `ledger-check.ts`; never hand-edited.
- `ledger-check.ts` — the offline gate.
- `out/` — gitignored working dir: per-run bundles + `state.json` (the PR
  cursor).
- `fixtures/` — the committed observation fixture: a five-set REST canvas +
  fixture ledger + fixture contracts crafted so the drift table exercises
  every status (Alpha in-sync, Beta code-ahead, Gamma canvas-ahead, Delta
  conflict, Epsilon untracked).
