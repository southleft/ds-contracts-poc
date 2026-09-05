# Bootstrap 5, measured — the sweep's quarantine boundary, and what nine untried components turned out to be

**2026-09-04.** The [held-out exam](HELD-OUT-EXAM.md) could not measure Bootstrap
at all: one component that never becomes visible threw out of the capture sweep,
the run died with nothing written, and the other nine were never attempted. This
round fixes that and reports the number the exam could not produce.

## The defect

`extract/computed/capture.ts` swept components in a bare nested loop. A driver
error anywhere left the whole sweep. Bootstrap's `.spinner-grow` starts its
infinite keyframe at `transform: scale(0)`, so `${stage} > *` filtered to
visible resolves EMPTY, `hover()` times out at 30s, and the throw ended the run.

**Measured, not assumed:** the boundary's own probe reads the stage's children
and reports `div 0x0` — a zero-area box, exactly the predicted shape.

## The fix, and the rule it had to not break

`run.ts` states the doctrine: *"quarantine is for a contract the generator
registry refuses, **never a way to swallow a bug**."* A plain `try/catch` per
component would satisfy the brief and quietly violate that — every engine fault
would become a per-component shrug.

So the boundary **quarantines only what it can prove**. `quarantineVerdict()`
is a pure predicate requiring **all three**:

1. the driver **timed out** (a hang, not a thrown assertion),
2. the stage element was **found and has children** (the selector is right and
   the mount happened — neither is an engine fault),
3. **every** child has a zero-area box.

Together those say the component mounted and nothing it rendered can ever be
pointed at: the library's DOM, not our code. Anything else re-throws unchanged.
Partial captures roll back, because a half-swept component reads downstream as a
complete one.

`npm run extract:computed:quarantine:check` guards it with **7 planted shapes**
— the spinner's zero-area children, and five ways a timeout is *not* the
library's fault. It fails loudly if the boundary ever accepts an engine fault.
Wired into the fast lane.

**It took two passes to be right.** The first fix quarantined at the sweep but
nothing carried the refusal forward: `alignSweep` then hit Spinner, found no
base capture, threw a raw error, and the run still died with NavTabs and Modal
never reached. `promote` named it exactly — *"component(s) with no capture
artifacts **and no quarantine**"*. A quarantine the later stages cannot see is
indistinguishable from an absence. The sweep's refusal is now re-raised as the
`QuarantineError` the per-component loop already understands, so it writes the
same `refusal.json` every other refusal writes.

## The result — Bootstrap 5, first pass for nine components

| | before this round | after |
| --- | --- | --- |
| captured | **0 / 10** | **9 / 10** |
| shipped a contract | 0 | **7 / 10** |
| quarantined **by name** | 0 (the run died) | **3** |
| never attempted | **9** | **0** |
| weighted floor | — | **92.8%** over 7,536 cells |

Spinner keeps the result it earned on the true first pass. The other nine were
never attempted before, so this **is** their genuine first pass.

| component | floor % | combos | px-perfect | named refusals |
| --- | ---: | ---: | ---: | ---: |
| `alert` | 97.5 | 8 | 32/32 | 1 |
| `badge` | 96.4 | 8 | 32/32 | 1 |
| `progress` | 96.2 | 1 | 0/4 | 2 |
| `navtabs` | 91.7 | 3 | 0/12 | 27 |
| `card` | 91.2 | 1 | 3/4 | 15 |
| `formcontrol` | 91.1 | 6 | 0/24 | 3 |
| `formcheck` | 88.3 | 3 | 0/12 | 12 |

**7 measured · floor 92.8% · 7,536 cells · 61 named refusals · 0 open queue · 3 quarantined.**

`alert` and `badge` are **pixel-perfect on every combo** — 32/32 each — on a
library that exports no components at all.

### The three quarantines, each with its cause

| component | cause |
| --- | --- |
| `Spinner` | *no visible steady state: the driver timed out reaching the interaction root and every child of the stage has a zero-area box (div 0x0)* — the boundary |
| `Button` | *duplicate code binding `className` — two props/slots/events share one code name* |
| `Modal` | *part `btn-close` sets `background-size`, which is not a token channel (no emitter renders it)* |

**Button confirms a banked prediction.** The manifest's finding #2, authored
blind: *"Two class-token axes on one component cannot both be expressed."*
Bootstrap's Button carries variant and size, both riding `className`, and the
grammar can express one.

## Where it stops, and why I did not push past it

`promote` **REFUSED**, and this is the answer to the question the exam was set:

> `library.varPrefix` is `--bs-` but the CSS-vars reader verified **0 source
> facts** across 7 components.

The engine diagnosed itself better than I could. From `alert`'s own
`source-bindings.json`:

> *"no candidate names a leaf of this library's DTCG token file, so there is no
> NAME to bind. The VALUE is right and only the NAME is unrecoverable: this is
> the shape of a semantic-over-primitive INDIRECTION (the referenced custom
> property is itself defined as `var(<primitive>)`), and the reader follows
> exactly **ONE hop** — the primitive behind the alias is never reached."*

Bootstrap's token architecture is two hops (`--bs-alert-bg` →
`var(--bs-primary-bg-subtle)`). The reader follows one. Every candidate's value
matches; none of their names is a leaf of the blind-authored DTCG file.

`--accept-zero-bindings` was offered and **not taken**. Taking it would promote
anonymous `imported.*` literals knowingly and turn a real finding into a green
run. The config was not edited either.

**So: can the grammar express a runtime-free CSS library?** Through capture,
demonstrably yes — 9 of 10 captured, 7 contracts, 92.8%, two components
pixel-perfect. Through **promotion**, not yet: the vars reader's single hop
cannot name Bootstrap's semantic tokens. That is a bounded, named limitation of
the reader, not a verdict on the grammar, and it is the next thing to fix if
Bootstrap matters.

## What is committed, and what is not

Committed: the engine fix, its guard, the lane wiring, this receipt, and
[`HELD-OUT-EXAM-bootstrap5-scorecard.json`](HELD-OUT-EXAM-bootstrap5-scorecard.json).

Not committed: the exam's capture artifacts. Landing Bootstrap in the measured
corpus is a separate decision with the same cascade the Radix run measured —
`docs:check` refuses until `LIB_DIRS` and docs/22 §8.3 name it, and
`extract:computed:drift` refuses because a new library has no pins, which must
be recorded on Linux. Both gates were verified red with the artifacts present
and green with them removed.

## How to re-derive

```bash
# recreate the sandbox from examples/bootstrap5/README.md §3
npx tsx packages/cli/src/cli.ts onboard examples/bootstrap5
npx tsx packages/cli/src/cli.ts onboard --continue
npm run extract:computed:scorecard -- --dir extract/computed/out/bootstrap5 \
  --config extract/computed/configs/bootstrap5.json --write
```
