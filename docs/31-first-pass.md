# 31 · First-pass — does it work on the first try, untouched?

> Owner, 2026-08-24: _"I don't think I've seen one successful pass on the first try."_

Every green number this repository has ever recorded was won by a **heal loop**.
Capture a library, look at the scorecard, fix the config, re-run. Propose from a
canvas, look at the contract, add an authored fact, re-propose. Mint a set, look
at it, adjust, mint again. The loop is legitimate engineering and the artefacts
it produces are real. But it means every published rate answers a question
nobody asked:

> _After a person or an agent worked on it, how good is the result?_

The question the owner asked is different:

> _If nobody touches it, does the documented chain work the first time?_

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
   counted as a failure of the _run_.
5. **No set can be quietly dropped.** Each exam commits a `MANIFEST.json`
   listing every set it selected. The gate refuses when a named set has no
   packet and when a packet exists that the manifest does not name.

### Why this is not the same claim as end-state quality

|                        | measures                                | where it lives                                                                         |
| ---------------------- | --------------------------------------- | -------------------------------------------------------------------------------------- |
| **End-state quality**  | after the loop: is the artefact right?  | `CANVAS-CENSUS.md`, `DESIGN-TO-CODE-CENSUS.md`, the library scorecards, `visual-truth` |
| **First-pass quality** | before any loop: did it work untouched? | `FIRST-PASS.md` (this metric)                                                          |

A high end-state number with a low first-pass number is not a contradiction —
it is a precise description of a tool that works _once you know how to hold it_.
Both numbers are true; quoting either as "how good the engine is" is not.

---

## 2 · The two directions

### Direction A — code → canvas

Input: a library the engine has never captured — a capture config plus the
sandbox recipe from its `PROVENANCE.md`.

| stage      | what runs                                                                                                                                                                                                                                                                                                                                         |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `capture`  | `npx tsx extract/computed/run.ts --harness <sandbox> --config <config> --component <C> --out <out> --keep-originals`                                                                                                                                                                                                                              |
| `promote`  | `npx tsx packages/cli/src/cli.ts promote --config <ds-library.json>`                                                                                                                                                                                                                                                                              |
| `validate` | `validateContract` — the referee (`core/emit-react.ts`). It has no CLI verb; see [07 — Validation](07-validation.md)                                                                                                                                                                                                                              |
| `generate` | `npx ds-contracts generate <contract> --out <dir> --tokens <dtcg>,<minted> --stories`                                                                                                                                                                                                                                                             |
| `bundle`   | `npx ds-contracts figma <contracts> --out <dir>` then `npx ds-contracts figma bundle … --out <lib>.bundle.json`                                                                                                                                                                                                                                   |
| `mint`     | **MCP-driven, not harness-driven** (§6) — the harness re-emits with `--file-key byMp6lt0Ij9b2QbkDGFwBh` and stops at the guard-carrying script; an agent holding the figma-console MCP tools performs the write and records its own evidence. The step-by-step is [§6.1](#61--the-operator-procedure); `--record-mint` folds the evidence back in |

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

| stage            | what runs                                                                                             |
| ---------------- | ----------------------------------------------------------------------------------------------------- |
| `dump`           | `npm run extract:figma:rest -- <url>?node-id=<set> --out <dump>`                                      |
| `propose`        | `npm run extract:figma -- <dump> --out <proposed> --tokens <kit dtcg>`                                |
| `validate`       | `validateContract` — the same referee                                                                 |
| `generate-react` | `npx ds-contracts generate <proposed>/*.contract.proposed.json --out <react> --tokens <kit>,<minted>` |
| `generate-wc`    | the same, `--target web-components --emitter @ds-contracts/emitter-web-components`                    |
| `render`         | the generated React, esbuild-bundled, screenshot headless at deviceScaleFactor 2                      |
| `ref`            | `GET /v1/images/<key>?ids=<variant>&scale=2` — Figma's own renderer                                   |

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
  set. Direction B: absent by construction — the canvas _is_ the source there,
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

against the owner's bar: _"I can tell what this is."_ `recognisable: false` must
name at least one wall; an unexplained difference is red.

---

## 4 · The receipt and the ratchet

`parity/receipts/v1/FIRST-PASS.md` is **byte-stable**. The date and engine SHA
it quotes are recorded into each exam's `MANIFEST.json` _at exam time_ and
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
npm run exam:first-pass -- --exam selftest-tailwind --record-mint  # fold in §6.1's evidence
npm run first-pass:check -- --write-receipt                   # record it
npm run first-pass:check                                      # the gate
npm run first-pass:check -- --self-test                       # falsify the gate
```

### Preflight, and what the exit code means

**The committed packet is evidence, and a run that cannot produce a
replacement never clears it.** Before an exam touches a single committed byte,
`preflight()` checks every precondition it needs and refuses BY NAME, with the
exact command that fixes it:

- the declared capture harness — the **git-ignored** sandbox from the library's
  `PROVENANCE.md` — exists, carries the library at the version the capture
  config pins, and has `react`, `react-dom` and `esbuild`;
- the capture config and `ds-library.json` exist and parse;
- direction B: a Figma token is in the environment, the file key is not one of
  the forbidden keys, every declared corpus file is on disk (an absent one used
  to be dropped silently, which changes the exam's input), and the exam selects
  at least one page;
- the work directory and the packet directory are writable.

| exit | meaning                                                                                                                                                                                                                        |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `0`  | the run **measured something** — a completed chain, or an honest `REFUSED`, which is the finding the exam exists to collect                                                                                                    |
| `1`  | the run **measured nothing** — every set stopped at `ERROR`, a stage that died without a named refusal. There is no rate: the receipt renders `UNMEASURED`, the ratchet records nothing, and the gate refuses the exam by name |
| `2`  | **preflight refused** — the run never started and nothing was touched                                                                                                                                                          |

`0/8` and `UNMEASURED` are different claims. `0/8` says the engine failed eight
times; `UNMEASURED` says the harness never got to ask. Collapsing them is the
same class as a killed suite reading as a pass.

Images are cleared **per set, at the instant that set's replacement is
written** — never up front. A set whose chain aborts first keeps every byte it
had and records them in `attempt.json` as `images.retained`, with the reason in
`images.absent`; the receipt names the sets whose pictures are older than their
attempt. The gate refuses an orphan image, and refuses a packet whose `ref` or
`code` surface vanished with no recorded reason.

Exams are registered in `extract/figma/census/first-pass.ts`:

- `EXAMS` — exams with a runner. The gate refuses a registered exam that has
  never been run.
- `EXAM_QUEUE` — registered, never attempted. They are printed in the receipt so
  that _"never measured"_ is an admission on the record rather than a silence.

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
  throw new Error(
    "WRONG FILE: expected " + EXPECTED_FILE_KEY + ", got " + figma.fileKey,
  );
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

Until 2026-08-24 this was modelled as a _probe_: the runner scanned
`127.0.0.1:9223-9232` for a "COMMAND endpoint" and printed what answered
(`9228:200`, and so on). The refusal was honest; the premise was not. Printing
a port that responded invited the reader to believe the write was one
configuration away. It is not one configuration away — **it is a different
actor**.

So `mint` is modelled for what it is:

|         | who                                              | what they do                                                                                  | what is recorded                                          |
| ------- | ------------------------------------------------ | --------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| harness | the exam runner (Node)                           | runs the documented `--file-key` re-emit, asserts the WRONG-FILE guard is in the bytes, stops | the stage record, `driver: "mcp"`, the script's sha256    |
| driver  | an **agent holding the figma-console MCP tools** | pastes/executes the guard-carrying script against the scratch file                            | `parity/receipts/v1/first-pass/<exam>/mint-evidence.json` |

With no `mint-evidence.json` the stage is **PENDING** with the architecture
named, never "unavailable" and never a number. With one, the stage takes the
status the evidence records. The manifest carries `mint.driver: "mcp"` and
`mint.evidence` (the path or `null`) so the receipt can never imply a
capability this harness does not have.

**This does not weaken the no-retry rule.** The MCP-driven mint gets exactly
one attempt too, and its evidence records that attempt — never a best-of. An
agent that runs the script twice has run a heal loop, and the exam is void.

### 6.1 · The operator procedure

This is what an **agent** does. A shell cannot do any of it; there is no
`npm run` that drives a canvas. Everything below was executed for
`selftest-altitude` on 2026-08-25 and the description is of that run.

**Step 0 — run the exam and keep the scripts.** `--work` must be a path you
keep, because the emitted scripts live in `<work>/mint/` and are the artifact
you are about to execute.

```bash
npm run exam:first-pass -- --exam <exam> --work <keep-me> --mint
```

Preflight must pass and every set must reach `mint` PENDING. A set that
stopped earlier has no mint to drive, and the recorder will refuse any
evidence claiming otherwise.

**Step 1 — confirm the bridge, and confirm the file.** `figma_get_status`
must report a live transport, and the scratch file must be in
`connectedFiles`. The bridge keeps several files connected and has been
observed routing to the wrong one, so **pass `fileKey` explicitly on every
single call**. Never rely on the active file.

**Step 2 — get the bytes into the sandbox without trusting them.** The
scripts are ~100 KB each. Serve `<work>/mint/` over HTTP on a port inside the
Desktop Bridge plugin's `networkAccess` allowlist — `http://localhost:9223-9232`,
and note it is `localhost`, not `127.0.0.1`: the plugin answers
`Error: Failed to fetch` for anything else. Then, **inside** a single
`figma_execute`:

```js
if (figma.fileKey !== "byMp6lt0Ij9b2QbkDGFwBh")
  throw new Error("WRONG FILE: " + figma.fileKey);
const src = await (await fetch("http://localhost:9232/" + NAME)).text();
if (sha256(src) !== EXPECT)
  throw new Error(
    "BYTES DIFFER: served " + sha256(src) + ", harness recorded " + EXPECT,
  );
const out = await (0, eval)("(async () => {\n" + src + "\n})()");
```

`EXPECT` is the sha256 the **harness** recorded for that set's script — read it
out of `attempt.json`'s `mint` stage, never recompute it from the file you are
about to serve. The plugin sandbox has `eval` and `fetch` but **no `crypto`**,
so carry a portable SHA-256 in the wrapper. The point of the hash is that the
bytes executed are provably the bytes the chain emitted; the recorder checks
the same equality again and refuses without it.

**Mandatory asserts, all of them, every set:**

| assert                                                                                                              | why                                                  |
| ------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| `figma.fileKey === "byMp6lt0Ij9b2QbkDGFwBh"` in the wrapper _and_ the baked `EXPECTED_FILE_KEY` guard in the script | two independent checks; the bridge misroutes         |
| the served sha256 equals the sha256 in `attempt.json`                                                               | a hand-edited script can never be recorded as a mint |
| the script is evaluated **once**                                                                                    | a second run is a heal loop and voids the exam       |
| record `newPages` before/after                                                                                      | proves whether the mint created anything (see 6.2)   |
| capture the engine's **exact** return value and console tail                                                        | the message in the packet is never paraphrased       |

A transport failure before `eval` — the `Failed to fetch` above — is **not** a
mint attempt. Nothing reached the canvas, so the counter is not consumed. Fix
the transport and run the script for the first time. A failure _inside_ `eval`
is an attempt, and it is recorded as `failed`.

**Step 3 — export the pictures.** For every cell that has `ref-<cell>.png` in
the packet, export the matching Figma variant at **scale 2** and save it as
`canvas-<cell>.png` **in the same directory** — the cell name is what makes the
pair line up with the committed ref/code images. `figma_take_screenshot` shows
you one; to get the bytes onto disk, `node.exportAsync({ format: "PNG",
constraint: { type: "SCALE", value: 2 } })` inside `figma_execute` and POST
them to the same local server. Strip the state axis when matching
(`Variant=Secondary, State=Default` → cell `secondary`).

Every cell that gets no picture needs a **reason**, in `absentCanvas`. A blank
cell is never allowed, and "the set has no such variant" is a finding worth
writing down — most of altitude's absences are the engine's own
`FC-UNSET-PLANE-UNDRAWN`, which it names in its own code-only facts.

**Never export a node this attempt did not write.** Divider REFUSED, so its
node on the canvas is an _earlier_ mint's output; exporting it would pass
another run's pixels off as this attempt's. Its two cells carry that sentence
as their reason instead.

**Step 4 — write the evidence and let the harness record it.**

```bash
npm run exam:first-pass -- --exam <exam> --record-mint
npm run first-pass:check -- --write-receipt
npm run first-pass:check
```

`mint-evidence.json` lives at `parity/receipts/v1/first-pass/<exam>/` and its
shape is the `MintEvidence` type in
[`extract/figma/census/first-pass-mint.ts`](../extract/figma/census/first-pass-mint.ts):
the file key, the operator, `noRetry: true`, `attemptsPerSet: 1`, and per set a
`status`, `bytesWritten`, the script and its sha256, the wall-clock, the node
id, **the engine's exact message**, the console tail, the canvas cells and the
named absences.

`--record-mint` runs no stage and clears no image. It rewrites each set's
`mint` record, attaches the canvas images, re-derives `chainComplete`, and
rewrites the manifest's `mint` block — all through the exam's own writers, so
the receipt stays byte-stable. **It refuses whole**, writing nothing at all, on
any of: a non-scratch or forbidden file key; a MANIFEST set the evidence does
not name, or a name the MANIFEST does not have; a script sha that is not the
one the chain emitted; a `minted` set with no picture of it; `bytesWritten`
contradicting the status; a cell with neither an image nor a named reason; a
mint recorded onto a chain that never reached the stage; or a stage that is not
`PENDING` — which is what stops `--record-mint` from ever becoming a retry.

Do **not** `git checkout` `MANIFEST.json` between the exam and the recording.
The manifest carries the date and engine SHA the chain ran at, and reverting it
silently substitutes an older run's provenance under this run's packets.

### 6.2 · The five statuses, and why `minted` is narrower than `chain complete`

| evidence `status`   | stage     | meaning                                                                                                                                                 |
| ------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `minted`            | `ok`      | this attempt WROTE to the canvas — created or amended                                                                                                   |
| `skipped-unchanged` | `ok`      | the engine's own specHash already equalled the one stamped on the canvas node, so it wrote **nothing**: an earlier mint had put those exact bytes there |
| `refused`           | `REFUSED` | the engine declined **by name** — the honest outcome                                                                                                    |
| `failed`            | `ERROR`   | the script threw without a named refusal                                                                                                                |
| `not-reached`       | `SKIPPED` | an earlier stage stopped this chain                                                                                                                     |

`skipped-unchanged` is a stage that did its job, so it is `ok` and it completes
the chain. It is **not** a set whose bytes reached the canvas on this attempt,
so `minted` does not count it — `StageRecord.bytesWritten` carries the
difference and the receipt's `Mint:` line gives the split. A number labelled
"minted" may not quietly include "we wrote nothing".

### 6.3 · A first-pass mint cannot be isolated — the finding from the first driven run

The operator created an empty page `first-pass altitude 2026-08-25`, cleared
it, and made it the current page before every one of the 8 runs. **All 8
scripts ignored it.** `newPages` was `[]` every time and the exam page was
still empty at the end.

The emitted script owns file layout. `resolveComponentIdentity` scans
`allSyncTargets()` — every page in the file — for a node stamped with the same
`ds_contracts/contractId`, and amends that node in place, preserving its id and
key. Only when nothing matches does it create, and then it creates **its own
page named after the component**, not the page you were sitting on. There is no
`--page` flag, no file-scoping, and no documented way to confine a mint to one
page.

The consequence for this metric: the Scratch Project is the only writable file,
it already carried all 8 altitude stems from the canvas census, so **every set
took the AMEND path and not one took the CREATE path.** `7/8` for
`selftest-altitude` is a true statement about the documented chain and a weaker
one than it looks — read it beside this paragraph, not instead of it. Chip
shows the cost directly: the amend left 5 `Type=Default` variants the contract
does not carry standing on the canvas (it reported them as `extraVariants`), so
the set now mixes two vocabularies.

The emitted script does carry one door for this — set `globalThis.DS_CREATE_ONLY
= true` and an already-identified set is refused by name instead of amended —
but it is a _pre-run switch of the artifact_, which is exactly the substituted
input the metric forbids. **An exam does not set it.** Measuring the create
path honestly needs a writable file that does not already know the library, and
until there is one, `mint` in this direction measures amend.

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
`ac5e6181`'s own commit message says so: _"the hill-climb hand-edited committed
contracts … without back-porting promote inputs"_. The corpus was not
re-derivable from its own inputs, and no gate could see it, because every gate
started from the record rather than from the seed.

Three gates now hold the line, and each answers a different derivation:

| gate                                             | question                                                                                                                                                     | lane                                                                               |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------- |
| `npm run corpus:reproducible:check`              | do the committed capture record + authored facts re-promote to the committed contracts, byte for byte?                                                       | fast                                                                               |
| `npm run corpus:reproducible:check -- --capture` | does the committed seed + config + sandbox re-derive the committed capture record's STRUCTURE?                                                               | out of band; the run RECORDS its measurement, and the fast lane judges that record |
| `npm run bundles:fresh`                          | does every committed `examples/*/figma/*.bundle.json` — the JSON a designer pastes — rebuild byte-identically from its committed contracts and token layers? | full                                                                               |

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
