# sync/ — the code↔canvas sync ledger (SYNC LAYER STEP 1)

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

## Writers — every sync verb records what it just did

| verb | direction | records |
|---|---|---|
| `ds-contracts figma receive --apply` | canvas→code | contractHash of the landed contract + the envelope's canvas provenance (`canvasSpecHash` when carried; the envelope has no fileKey/nodeId/v6 — recorded null, honestly) |
| `ds-contracts figma publish` | code→canvas | contractHash per bundled contract at publish time, `pendingApply: true` — the canvas half is pending until a designer applies; cleared by the apply-side record or a confirming `observe --update` |
| `npm run sync -- record --from-receipt <receipt.json>` | code→canvas | fileKey + setNodeId + v6 from a console-loop generation receipt — the verb the generate loops call after a receipt lands |
| `npm run sync -- seed` | code→canvas | all committed console-loop receipts (first-party + foreign corpora), provenance `seeded-from-receipts` |
| `npm run sync:observe -- --update` | (evidence only) | observation baselines for in-sync rows; adopts a post-publish restamp (clearing `pendingApply`, loudly) |

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

Exit codes are gate-style: **0 clean, 1 drift, 2 usage/config error**. This is
the arithmetic step 2's scheduled spine runs.

## Gates

- `npm run sync:ledger:check` (fast lane) — offline: schema + deterministic
  bytes + every seeded record verified against the receipt it cites
  (`parity/receipts/console-loop/**` is read-only evidence here) + the
  committed-fixture drift table classifying all five statuses.
- eval `sync-ledger-lockfile` (`npm run eval -- --only sync-ledger`) — the
  red tests: hand-edited fingerprint → canvas-ahead naming the component,
  contract-hash bump → code-ahead, both → conflict, recorded-amend echo →
  in-sync, unrecorded amend → the named false alarm, serialization
  determinism, schema refusals by name.
- Live observation (`npm run sync:observe`) needs `FIGMA_TOKEN` and is run by
  hand — the fixture gate above is its committed twin.

## Files

- `ledger.json` — the lockfile (seeded 2026-08-08 from the 128 completed
  console-loop receipts: 49 first-party + 31 MUI + 5 Tailwind + 8 Altitude +
  13 Astryx + 10 Carbon + 12 Polaris).
- `ledger.ts` — pure core: schema referee, deterministic serialization,
  writers, `classifyRecord`/`driftReport` (browser-safe; the CLI bundles it).
- `ledger-io.ts` — the node-bound load/save half.
- `observe.ts` — observations from a REST nodes response (fixture or live).
- `cli.ts` — `record | seed | observe`.
- `ledger-check.ts` — the offline gate.
- `fixtures/` — the committed observation fixture: a five-set REST canvas +
  fixture ledger + fixture contracts crafted so the drift table exercises
  every status (Alpha in-sync, Beta code-ahead, Gamma canvas-ahead, Delta
  conflict, Epsilon untracked).
