# Canvas conformance fixture

*The canvas-side twin of `conformance/` (the CSS/DOM fixture): a synthetic
library of labeled document-model constructs whose expected dispositions are
authored **independently of the engine**, so the design→contract frontier can
be measured in advance instead of discovered one Figma kit at a time.*

## What it is

- **Cases** are hand-authored dump v1 JSON (`cases/<id>.dump.json`) — the
  documented format of `extract/figma/types.ts`, the same bytes
  `dump.plugin.js` produces. One SMALL, single-purpose case per construct:
  auto-layout forms, paints, strokes, effects, text, radii, parametric decor
  shapes, absolute placement, variant axes (enum/bool/state/theme), nested
  instances, slots, spacers, wrapper artifacts, sparse presence,
  opacity/blend, image fills.
- **`MANIFEST.json` is the denominator**, hand-authored one case at a time,
  written from the *Figma documentation model's semantics* (what SHOULD
  carry), never from what the engine currently does. Each entry declares
  `expect` (CARRIED | REFUSED | LEDGERED), a one-line `why`, and the probes
  that verify the disposition.
- **The runner** (`run.ts`) feeds every case through the REAL shipping path —
  `proposeBatchFromDump` with `mintUnbound: true`, the standard token corpus
  (`tokens/*.tokens.json`), the repo's `contracts/` in scope — classifies the
  outcome, prints a table, and exits nonzero on any mismatch. No engine code
  path special-cases the fixture.

## The rules (inherited from the code fixture)

1. **Denominator independence** — a case file without a manifest entry is a
   hard failure (UNLISTED), as is a manifest entry without a case file
   (MISSING). The engine never defines its own denominator.
2. **Two-sided ratchet** — a green case that stops matching FAILS; a
   FAIL-EXPECTED-RED case whose doc-model check unexpectedly passes ALSO
   fails (UNEXPECTED-GREEN) until re-recorded green. Red cases pin the status
   quo in `observedCheck` (including pinning a silence via `noteAbsent`) — if
   today's behavior drifts, that fails too.
3. **Neither carried nor named-refused is a hard failure** — REFUSED/LEDGERED
   checks pair a `note` probe (the naming union: proposal notes, unbound
   entries, batch skips, dump `_degradations` receipts) with `absent` probes
   over the contract text (nothing invented, nothing silently carried).
4. **Neutral naming** — every set is `Case`, children are `a`/`b`/`t`/`s`:
   a node named after a CSS channel would satisfy a note search and turn a
   silent loss into a false pass (the code fixture's 8-false-pass lesson).
5. **Capture-boundary constructs** (blend modes, gradients, per-corner radii,
   dashed strokes, non-px line height, multi-paint stacks, non-decor
   rotation) have no dump v1 field at all; their cases carry the
   `_degradations` receipt in `dump.plugin.js`'s own vocabulary. For these
   the measured half is the `absent` probe — the proposer must carry the dump
   without inventing the channel — while the receipt pins the format's
   ledger spelling.

## Usage

```bash
tsx extract/figma/conformance/run.ts              # the gate (headless, CI-safe)
tsx extract/figma/conformance/run.ts --case <id>  # one case
tsx extract/figma/conformance/run.ts --probe <id> # naming union + contract (authoring aid)
```

## Adding a case

1. Write `cases/<id>.dump.json` and its manifest entry. Declare `expect` and
   the checks **before** reading the engine's output — a case written after
   the answer is a tautology, not a measurement.
2. Run the gate. If the doc-model check fails, do NOT weaken it: record the
   case `status: "red"` with a one-line `observed` cause and an
   `observedCheck` pinning today's behavior. Reds are findings — the next
   work order — not fix-targets for the fixture itself.

## Future work (named, not silently absent)

- **The live-file twin.** These cases enter at the dump boundary, so the
  CAPTURE stage (`dump.plugin.js` walking a real Figma document) is exercised
  only by its committed receipts, not measured. The live version — a Figma
  file drawing every construct in this manifest, captured by the real plugin
  in CI-adjacent runs, its dumps diffed against these committed cases — would
  close that gap and turn the capture-boundary cases' hand-authored
  `_degradations` into measured facts. Until it exists, that gap is this
  fixture's own declared fidelity limit.
- **REST-mapper parity.** The same cases could feed
  `extract/figma/rest/map.ts` to measure the REST capture surface against the
  plugin surface.
- **Per-instance override machinery.** `instanceOverrides` /
  `sessionClaimedIds` opt-in paths are exercised only in their classic
  (absent) form here; a session-shaped fixture (multiple dumps, accumulated
  minted ledger) is future work.
