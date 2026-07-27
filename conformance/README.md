# CSS/DOM conformance fixture

*A synthetic design system whose only purpose is to be captured, so that the
pipeline's frontier can be **measured in advance** instead of discovered one
library at a time.*

---

## Why it exists

The owner's question, verbatim:

> *"every time I feed you a new design system, we're discovering a lot of flaws.
> Is there any way that we can get around this and start predicting what these
> things would be? Should I feed you a hundred design systems?"*

A hundred design systems would find a hundred more flaws, one at a time, in the
same way. The structural reason prediction was impossible is this:

**Every instrument in this repo derives its denominator from the same filter
that decides carriage.**

- The fidelity gate scores channels that passed `isFusable`. A channel the
  filter never opened is not in the denominator and scores **100%**.
- Parts that promotion refused are removed from scoring, so refusing a part
  cannot lower a score.
- The canvas checker verifies a **hardcoded** 15-channel table.
- The only canvas-truth gates are five hand-written per-library scripts that
  encode defects a human already found by looking at a canvas — a regression
  net, not a frontier detector.

An instrument built that way cannot be surprised. That is the whole problem.

## What the fixture does instead

`conformance/MANIFEST.json` is **the denominator**, hand-authored one case at a
time, and deliberately **not** derived from `isFusable`, `styled`,
`DECLARED_CHANNELS`, `CHANNEL_TO_COMPUTED`, `TOKEN_CHANNELS` or `carriedParts`.
(The `css-dom-conformance-frontier` eval refuses an import of any of them.)

Because the manifest is independent, a construct that is **neither carried nor
named-refused is a hard failure** rather than an absence.

The fixture is a **real library as far as the engine is concerned**: it is
mounted through the unmodified `extract/computed` pipeline with a normal capture
config, from a harness whose `node_modules` are symlinks into this repo's own.
No engine code path special-cases it.

## Layout

```
conformance/
  cases/<case-id>/
    case.json                 the manifest entry — HAND-AUTHORED
    Case.tsx                  the mounted React component
    case.css                  the CSS exercising the construct
  MANIFEST.json               generated index of every case + expectation
  conformance.config.json     a REAL extract/computed CaptureConfig
  seeds/<case-id>.contract.json   generated minimal seed contracts
  lib/                        the fixture library's entry + stylesheet (generated, + base.css)
  tokens/                     the fixture's DTCG + vars twin
  build.ts   capture.ts   run.ts   report.ts
  BASELINE.json               THE MEASURED FRONTIER (the ratchet)
  EXPECTATIONS.md             GENERATED — the living capability matrix
```

## Commands

```bash
npm run conformance:build      # cases → MANIFEST, lib, seeds, config, harness
npm run conformance:capture    # the real pipeline, one case per invocation (needs Chromium)
npm run conformance            # THE GATE — measure + compare against BASELINE.json
npm run conformance -- --write # re-record the frontier (an explicit act)
npm run conformance:report     # write EXPECTATIONS.md
```

The gate never launches a browser; it reads the committed artifacts under
`extract/computed/out/conformance/`. Only `:capture` needs Chromium.

## The four red conditions

Each has a **different remedy** — that is why they are four verdicts and not one.

| verdict | means | remedy |
|---|---|---|
| **SILENT-LOSS** | observable in `captured-truth.json`, absent from the contract, named by **nothing** in the union of `LEDGER.md`, the receipt/refusal arrays of `enriched.extension.json`, `review-queue.json`, `source-bindings.json.skips`, `scorecard.json` `namedLosses`, and the run's stdout | **never waivable** — the engine must name it |
| **UNDECLARED-CARRY** | declared REFUSED/UNSUPPORTED, actually carried | update the manifest — this is how the capability matrix stays true. *Unless* the manifest says the construct has no canvas spelling, in which case the carriage is the defect and it is reported as HARMFUL |
| **WRONG-NAME** | named, but not by `expectName` | fix the receipt, or pin the new one. Catches receipt drift and two constructs collapsing into one indistinguishable message |
| **UNMEASURED** | never reached `captured-truth.json` — the reader never looked | red for CARRIED/LOWERED; a **counted yellow** for UNSUPPORTED, because "we never read `::marker`" and "we read it and refused it" are different facts |

Plus one measured disposition the four do not cover: **RUN-ABORTED** — the
production runner threw and wrote no artifacts. Loud and named, but a
whole-round stop rather than a per-construct receipt.

> **RUN-ABORTED is no longer reachable for a contract the generator refuses**
> (conformance-frontier round, R3). Three cases used to land here —
> `accent-color`, `grid-implicit-tracks`, `svg-outside-grammar` — because one
> unregistered channel threw at `validateContract` and killed the round before
> any artifact was written, which meant a real library shipping `accent-color`
> on ONE component could not be onboarded at all. That refusal is now **scoped
> to the component**: `extract/computed/run.ts` quarantines it, writes
> `captured-truth.json` + `REFUSAL.md` + `refusal.json` and **no contract**,
> completes the rest of the library, counts the quarantine in the library
> scorecard, and exits **non-zero**. The verdict is still reachable — an engine
> fault that is not a quarantine is still a hard stop, and the fixture would
> still record it as RUN-ABORTED.

## Two rules the fixture must obey about itself

1. **`expect` is a closed vocabulary of four** — CARRIED, LOWERED, REFUSED,
   UNSUPPORTED. There is no fifth value. UNSUPPORTED is **not** a free pass: it
   must still be named in an artifact; the only difference from REFUSED is
   intent (a bounded grammar rejecting a member vs a feature never modelled).

2. **No case class may contain a CSS channel name.** Every root is
   `class="cf-root" data-cf="<case-id>"`, children are `cf-a` / `cf-b`, and CSS
   is scoped by the attribute. This is not style: with a case class spelled
   `cf-filter-blur`, the anatomy signature `root(div|filter-blur)` in the LEDGER
   would satisfy a search for "filter" and turn a silent loss into a PASS. The
   first run of this fixture had **8 such false passes**; the eval now refuses
   any non-neutral class. The gate additionally strips the case's compound
   identity tokens (`CaseFilterBlur`, `conformance.filter-blur`, the seed path)
   from the naming union before searching it.

## Adding a case

1. `mkdir conformance/cases/<id>` and write the three files. Declare
   `expect` / `expectName` / `observable` **before** you know the answer — a
   case written after reading the output is a tautology, not a measurement.
2. `npm run conformance:build && npm run conformance:capture -- --case <id>`
3. `npm run conformance` — read the verdict.
4. If it is a genuine new finding, `npm run conformance -- --write` and
   `npm run conformance:report`, and review both diffs.
