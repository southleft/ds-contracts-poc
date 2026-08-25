# 31 · First-pass — does it work on the first try, untouched?

> Owner, 2026-08-24: *"I don't think I've seen one successful pass on the first try."*

Every green number this repository has ever recorded was won by a **heal loop**.
Capture a library, look at the scorecard, fix the config, re-run. Propose from a
canvas, look at the contract, add an authored fact, re-propose. Mint a set, look
at it, adjust, mint again. The loop is legitimate engineering and the artefacts
it produces are real. But it means every published rate answers a question
nobody asked:

> *After a person or an agent worked on it, how good is the result?*

The question the owner asked is different:

> *If nobody touches it, does the documented chain work the first time?*

This document is about the second question, the gate that answers it, and why
the two must never be quoted as if they were one number.

---

## 1 · The metric

**First-pass rate** = the fraction of sets for which the documented chain, run
end to end with **zero human and zero agent intervention and no retry**,
completed every stage on a single attempt.

The rules that make it a measurement rather than a demo:

1. **No retry.** A stage runs exactly once. `runOnce()` in
   `extract/figma/census/first-pass-run.ts` has no retry parameter, deliberately.
2. **No repair.** Nothing is fixed between stages — not a config, not a token
   file, not a contract. If the census's own pipeline performs a repair the
   documented CLI does not (the design→code census prunes freshly minted token
   leaves the kit corpus already defines), the exam **does not** perform it, and
   the resulting refusal is the finding.
3. **No substituted input.** Every stage is the command `docs/21` and `docs/29`
   tell a user to type. Nothing runs through a private code path.
4. **A refusal is an honest outcome.** The engine declining by name is the
   behaviour this repo wants. A refusal is recorded as `REFUSED` with the
   engine's exact words; it does not count as a completed chain, and it is not
   counted as a failure of the *run*.
5. **No set can be quietly dropped.** Each exam commits a `MANIFEST.json`
   listing every set it selected. The gate refuses when a named set has no
   packet and when a packet exists that the manifest does not name.

### Why this is not the same claim as end-state quality

| | measures | where it lives |
|---|---|---|
| **End-state quality** | after the loop: is the artefact right? | `CANVAS-CENSUS.md`, `DESIGN-TO-CODE-CENSUS.md`, the library scorecards, `visual-truth` |
| **First-pass quality** | before any loop: did it work untouched? | `FIRST-PASS.md` (this metric) |

A high end-state number with a low first-pass number is not a contradiction —
it is a precise description of a tool that works *once you know how to hold it*.
Both numbers are true; quoting either as "how good the engine is" is not.

---

## 2 · The two directions

### Direction A — code → canvas

Input: a library the engine has never captured — a capture config plus the
sandbox recipe from its `PROVENANCE.md`.

| stage | what runs |
|---|---|
| `capture` | `npx tsx extract/computed/run.ts --harness <sandbox> --config <config> --component <C> --out <out> --keep-originals` |
| `promote` | `npx tsx packages/cli/src/cli.ts promote --config <ds-library.json>` |
| `validate` | `validateContract` — the referee (`core/emit-react.ts`). It has no CLI verb; see [07 — Validation](07-validation.md) |
| `generate` | `npx ds-contracts generate <contract> --out <dir> --tokens <dtcg>,<minted> --stories` |
| `bundle` | `npx ds-contracts figma <contracts> --out <dir>` then `npx ds-contracts figma bundle … --out <lib>.bundle.json` |
| `mint` | **MCP-driven, not harness-driven** (§6) — the harness re-emits with `--file-key byMp6lt0Ij9b2QbkDGFwBh` and stops at the guard-carrying script; an agent holding the figma-console MCP tools performs the write and records its own evidence |

Every stage but `mint` carries `driver: "harness"` in `attempt.json` — the exam
runner shells the documented command out itself. `mint` carries
`driver: "mcp"`, because the write is not a thing this process can do at all;
see §6.

The whole chain runs inside a **shadow root** — a directory of symlinks to the
checkout in which only the paths the pipeline writes are real, private copies,
and those copies are **emptied first**. An exam that inherits a committed
contract measures nothing.

### Direction B — canvas → code

Input: a Figma file key and a **page** selection the engine has never proposed
from. The exam selects pages, never individual sets, so it cannot cherry-pick
the ones that pass. Everything is **read-only REST**.

| stage | what runs |
|---|---|
| `dump` | `npm run extract:figma:rest -- <url>?node-id=<set> --out <dump>` |
| `propose` | `npm run extract:figma -- <dump> --out <proposed> --tokens <kit dtcg>` |
| `validate` | `validateContract` — the same referee |
| `generate-react` | `npx ds-contracts generate <proposed>/*.contract.proposed.json --out <react> --tokens <kit>,<minted>` |
| `generate-wc` | the same, `--target web-components --emitter @ds-contracts/emitter-web-components` |
| `render` | the generated React, esbuild-bundled, screenshot headless at deviceScaleFactor 2 |
| `ref` | `GET /v1/images/<key>?ids=<variant>&scale=2` — Figma's own renderer |

---

## 3 · The graded-pair packet

The harness **does not grade**. Per set it writes:

```
parity/receipts/v1/first-pass/<exam>/MANIFEST.json     every selected set
parity/receipts/v1/first-pass/<exam>/<set>/attempt.json
parity/receipts/v1/first-pass/<exam>/<set>/ref-<cell>.png
parity/receipts/v1/first-pass/<exam>/<set>/code-<cell>.png
parity/receipts/v1/first-pass/<exam>/<set>/canvas-<cell>.png
parity/receipts/v1/first-pass/<exam>/<set>/verdict.json   ← a grader writes this
```

The three images mean the same thing in both directions:

- **`ref-*`** — the SOURCE truth, rendered by whoever owns it. Direction A: the
  real npm package in the sandbox (`--keep-originals`). Direction B: Figma's own
  renderer at scale 2.
- **`code-*`** — the engine's CODE surface. Direction A: the promoted contract
  through `core/emit-html`. Direction B: the GENERATED React.
- **`canvas-*`** — the engine's CANVAS surface. Direction A: the minted Figma
  set. Direction B: absent by construction — the canvas *is* the source there,
  so `ref-*` already is it.

Every image that does **not** exist is named with its reason in `attempt.json`.
A blank cell is never allowed; the gate refuses a packet with no images and no
named absence.

`attempt.json` carries, per stage: the status (`ok` / `REFUSED` / `ERROR` /
`PENDING` / `SKIPPED`), the wall-clock, the documented command verbatim, the
engine's exact message on a refusal, and a sha256 for every artifact.

### Grading is a separate blind pass

A grader — agents elsewhere, who never see the stage record — writes
`verdict.json`:

```json
{ "recognisable": true, "walls": [], "notes": "", "reviewedAt": "<sha>" }
```

against the owner's bar: *"I can tell what this is."* `recognisable: false` must
name at least one wall; an unexplained difference is red.

---

## 4 · The receipt and the ratchet

`parity/receipts/v1/FIRST-PASS.md` is **byte-stable**. The date and engine SHA
it quotes are recorded into each exam's `MANIFEST.json` *at exam time* and
rendered from it — the renderer never reads the clock, the environment or git —
so re-rendering a committed exam is byte-identical forever. That is what lets
`npm run first-pass:check` be a string comparison rather than a number diff.

`parity/receipts/v1/first-pass-ratchet.json` records the **best rate each exam
has ever reached**. The gate refuses when the current rate is:

- **lower**, unless a `reasons` row names the exact `from`/`to` and why; or
- **higher** and the recorded best was not raised — a stale ratchet is as dead
  as a falling one.

---

## 5 · Running an exam

```bash
npm run exam:first-pass -- --list
npm run exam:first-pass -- --exam selftest-flowbite-live      # canvas → code
npm run exam:first-pass -- --exam selftest-tailwind --mint    # code → canvas
npm run first-pass:check -- --write-receipt                   # record it
npm run first-pass:check                                      # the gate
npm run first-pass:check -- --self-test                       # falsify the gate
```

Exams are registered in `extract/figma/census/first-pass.ts`:

- `EXAMS` — exams with a runner. The gate refuses a registered exam that has
  never been run.
- `EXAM_QUEUE` — registered, never attempted. They are printed in the receipt so
  that *"never measured"* is an admission on the record rather than a silence.

### Adding an exam

Direction A needs a capture config, a `ds-library.json`, and the sandbox its
`PROVENANCE.md` recreate block describes. Direction B needs a file key and the
page node-ids. Add the definition to `EXAMS`, run it, then
`npm run first-pass:check -- --write-receipt`.

### The self-test fixtures

Two exams point at libraries the engine already knows —
`selftest-tailwind` (flowbite-react, code→canvas) and `selftest-flowbite-live`
(the eight Flowbite pages over live REST, canvas→code). They are marked
`heldOut: false` and their numbers **measure the harness, not the engine's
reach**. They exist so the machinery is exercised before an exam is pointed at a
library nobody has captured.

---

## 6 · Mint is an MCP-driven stage, and the file-key assertion

Only one Figma file is writable: the Scratch Project
`byMp6lt0Ij9b2QbkDGFwBh`. The mint stage re-emits every component script with
`--file-key byMp6lt0Ij9b2QbkDGFwBh`, which bakes the engine's own guard into
the bytes:

```js
const EXPECTED_FILE_KEY = "byMp6lt0Ij9b2QbkDGFwBh";
if (EXPECTED_FILE_KEY && figma.fileKey && figma.fileKey !== EXPECTED_FILE_KEY) {
  throw new Error('WRONG FILE: expected ' + EXPECTED_FILE_KEY + ', got ' + figma.fileKey);
}
```

The harness **refuses to call a script mintable** unless that guard is in its
bytes, and refuses any script naming a forbidden key. The bridge keeps several
files connected at once and has been observed routing to the wrong one, so
"we did not touch it" is a checked fact here, not an intention.

### Who runs it — and who cannot

**The harness cannot perform the canvas write, and no configuration changes
that.** The figma-console bridge speaks **MCP over stdio to its own client**
and **WebSocket to plugin clients**. A Node process shelling commands is
neither. There is no command endpoint to find.

Until 2026-08-24 this was modelled as a *probe*: the runner scanned
`127.0.0.1:9223-9232` for a "COMMAND endpoint" and printed what answered
(`9228:200`, and so on). The refusal was honest; the premise was not. Printing
a port that responded invited the reader to believe the write was one
configuration away. It is not one configuration away — **it is a different
actor**.

So `mint` is modelled for what it is:

| | who | what they do | what is recorded |
|---|---|---|---|
| harness | the exam runner (Node) | runs the documented `--file-key` re-emit, asserts the WRONG-FILE guard is in the bytes, stops | the stage record, `driver: "mcp"`, the script's sha256 |
| driver | an **agent holding the figma-console MCP tools** | pastes/executes the guard-carrying script against the scratch file | `parity/receipts/v1/first-pass/<exam>/mint-evidence.json` |

With no `mint-evidence.json` the stage is **PENDING** with the architecture
named, never "unavailable" and never a number. With one, the stage is `ok` and
`minted` counts it. The manifest carries `mint.driver: "mcp"` and
`mint.evidence` (the path or `null`) so the receipt can never imply a
capability this harness does not have.

**This does not weaken the no-retry rule.** The MCP-driven mint gets exactly
one attempt too, and its evidence records that attempt — never a best-of. An
agent that runs the script twice has run a heal loop, and the exam is void.

## 7 · What the first exam found, and the gates that keep it found

The first run of `selftest-tailwind` scored **0/8**, and all eight sets died at
the same stage with the same sentence:

```
✘ authored alert prop dismissable: prop "dismissable" is not exactly one entry of props[]
```

The cause was not a bug in `promote`. A fresh capture of Alert produces the
props `[color, children]`; the committed capture record
(`extract/computed/out/tailwind/alert/enriched.contract.json`) carried
`[color, icon, dismissable, children]` **and six anatomy parts**, none of which
any committed input produces. They were written into the record by hand —
`ac5e6181`'s own commit message says so: *"the hill-climb hand-edited committed
contracts … without back-porting promote inputs"*. The corpus was not
re-derivable from its own inputs, and no gate could see it, because every gate
started from the record rather than from the seed.

Three gates now hold the line, and each answers a different derivation:

| gate | question | lane |
|---|---|---|
| `npm run corpus:reproducible:check` | do the committed capture record + authored facts re-promote to the committed contracts, byte for byte? | fast |
| `npm run corpus:reproducible:check -- --capture` | does the committed seed + config + sandbox re-derive the committed capture record's STRUCTURE? | out of band; the run RECORDS its measurement, and the fast lane judges that record |
| `npm run bundles:fresh` | does every committed `examples/*/figma/*.bundle.json` — the JSON a designer pastes — rebuild byte-identically from its committed contracts and token layers? | full |

Every divergence any of them finds must be NAMED in
`parity/receipts/v1/corpus-reproducible.json` with its reviewed cause; an
unnamed one refuses, and so does a named one that has since been fixed. The
receipt is [CORPUS-REPRODUCIBLE.md](../parity/receipts/v1/CORPUS-REPRODUCIBLE.md).

What the first full sweep found, and the reason the two halves are separate
gates: **the two derivations fail in different places.** Seven of eight
libraries re-promote byte-identically and the eighth (polaris) re-derives its
capture records **12/12** — its break is entirely between the record and the
contract, in eight hand-edited contracts with no authored ledger. Meanwhile
carbon and mui re-promote perfectly and diverge on the CAPTURE side, where
their committed records sit behind engine fixes that landed after they were
last recorded. A single "is the corpus reproducible?" number would have hidden
both.

The cure for a fact the capture genuinely cannot carry is the **authored-facts
door** (`examples/<lib>/authored-facts.json`, applied by
`packages/cli/src/promote.ts`), not an edit to the record. Alert's four
canvas-developed facts ride it now, through the door's `add` operation — a
named, refusable INPUT that dies by name the day the capture learns to produce
it.

## 8 · Where this sits

- [21 — Bring your own design system](21-bring-your-own-design-system.md) — the
  code→canvas chain this exam runs, with the real commands.
- [29 — How it flows](29-how-it-flows.md) — the five hops and the glossary.
- [07 — Validation](07-validation.md) — the referee the `validate` stage calls.
- [23 — Known limitations](23-known-limitations.md) — the named walls a grader
  may cite.
- [CORPUS-REPRODUCIBLE.md](../parity/receipts/v1/CORPUS-REPRODUCIBLE.md) — the
  receipt for §7's gates: which libraries re-derive, and every named divergence.
