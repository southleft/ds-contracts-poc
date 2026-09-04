# The held-out exam — first-pass on libraries the system had never seen

**Run once, 2026-09-04**, on a clean tree at `e168df482`, following
[`HELD-OUT-MANIFEST.md`](HELD-OUT-MANIFEST.md) §THE
EXAM, Option A (the CLI chain). Both sandboxes were recreated verbatim from
their READMEs; the install is the only network step.

**The counting rule, from the manifest and honoured here:** first-pass is
counted **once, on the first run, with nothing touched between the two
`onboard` invocations**. No config was edited to get a component through. A
quarantine, a refusal and a stop are all results; silence is not.

## The result

| subject | configured | captured first-pass | quarantined | outcome |
| --- | ---: | ---: | ---: | --- |
| **Radix Themes** | 10 | **10 / 10** | **0** | stopped at *bundle* on one named refusal |
| **Bootstrap 5** | 10 | **0 / 10** | — | **stopped at *capture*** — engine fault, nine components never attempted |
| react-day-picker | 1 | (already captured before this exam) | — | not re-run; not a first-pass subject today |

**Radix Themes is the headline: 10 of 10 captured on a first pass, 0
quarantined, weighted computed-equality floor 84.8% over 58,624 style cells,
121 named refusals, 0 open review queue.** Every configured component produced
capture output and a contract the generator registry accepts.

| component | floor % | combos | px-perfect | src-facts | named refusals |
| --- | ---: | ---: | ---: | ---: | ---: |
| `avatar` | 86.7 | 18 | 24/72 | 27 | 7 |
| `badge` | 92.4 | 12 | 4/48 | 18 | 3 |
| `button` | 87.3 | 48 | 0/192 | 104 | 33 |
| `callout` | 85.2 | 9 | 0/36 | 0 | 9 |
| `card` | 90.7 | 15 | 0/60 | 0 | 7 |
| `checkbox` | 77.6 | 54 | 12/216 | 54 | 20 |
| `progress` | 90.9 | 9 | 0/36 | 9 | 5 |
| `switch` | 91.1 | 36 | 12/144 | 72 | 11 |
| `tabs` | 89.0 | 1 | 0/4 | 8 | 18 |
| `textfield` | 76.2 | 18 | 6/72 | 57 | 8 |

Totals: **10 measured · floor 84.8% · 58,624 cells · 121 named refusals · 0 open queue · 0 quarantined.**

## Where each subject stopped, and what that says

### Radix Themes — stopped the way the system is designed to stop

`onboard --continue` exited 2 at stage 4 of 5:

```
✘ drawable-empty: radix-themes.text-field — anatomy has nothing drawable
```

It **warned at emit and refused at bundle**: a component whose anatomy would
render as a correctly named component set containing empty frames is not
bundled. Nine other components emitted their Figma sync scripts. Two further
results are named rather than silent — `checkbox` and `tabs` had
`bindings.figma.statePreviews` **refused by the referee**, because their
`disabled` and `focus-visible` states declare no token overrides on any
part's states. Three components had statePreviews accepted.

That is one component named and nine intact.

### Bootstrap 5 — stopped in a way that took everything with it

```
locator.hover: Timeout 30000ms exceeded.
  waiting for locator('[data-combo="Spinner:grow"] > *').filter({ visible: true }).first()
✘ capture failed (exit 1) with no per-component quarantine — that is an engine fault, so the run stops here
```

Zero component directories were written. **Nine components were never
attempted**, so they cannot be reported as passes or failures — only as not
reached. The honest Bootstrap denominator today is therefore not 0/10 in the
sense of ten failures; it is **one component that halts the run and nine
unknowns.**

**The manifest predicted the component and under-predicted the severity.**
Banked finding #5, authored blind before any capture:

> "A component with no steady state has no honest geometry. Bootstrap's
> `.spinner-border` / `.spinner-grow` are infinite keyframe animations;
> measured across separate mounts the grow spinner reads 10 × 10 and then
> 4 × 4. A 'two stable samples' probe cannot converge."

The prediction was non-convergence for one component. What happens is worse:
`.spinner-grow` begins its keyframe at `opacity: 0`, so the sweep's "first
visible child" locator never resolves, the hover times out at 30s, and the
failure **has no per-component isolation**. That is the finding this exam bought:
not that a spinner is hard to measure, but that *the capture sweep has no
quarantine boundary around a component that never becomes visible.*

Per the exam's rules the config was **not** edited to route around it.

## What was NOT changed, and why

The exam's artifacts are not committed. Landing Radix Themes in the measured
corpus is a separate decision with a real cascade, measured here:

- `docs:check` refuses immediately — *"scorecards under `radix-themes/`
  belong to no library this script knows — add it to `LIB_DIRS` (and to
  docs/22 §8.3)"*.
- `extract:computed:drift` refuses — a new library has no pins, and those must
  be recorded on Linux (see [`MUI-CSSBASELINE-WAVE.md`](MUI-CSSBASELINE-WAVE.md)).
- The minted tree was a committed **zero-leaf stub** riding the documented
  `tokens.mintedBootstrap` allowance. The exam filled it with 4,608 lines, and
  the manifest is explicit: *"The moment a tree carries leaves, `loadConfig`
  refuses the stale allowance by name and the flag must be deleted."*

So the tree was returned to clean and every gate is green. The measurement is
this receipt plus
[`HELD-OUT-EXAM-radix-themes-scorecard.json`](HELD-OUT-EXAM-radix-themes-scorecard.json),
the machine-readable rollup.

## Why this receipt is not in `parity/receipts/phase-2/`

The manifest names `phase-2/ANTD-EXAM.md` as the nearest format precedent and
warns that `npm run exam:screenshots:check` applies to any `*-EXAM.md` placed
there. Placed there, this receipt goes red on that gate's grammar: no
`| set | … |` table, no `## Screenshots`, no `## Self-heal log`.

That is the gate being right. It grades **code→canvas** exams, which record
canvas sets and screenshot pairs. **This exam never reached a canvas.** It is a
capture→promote→emit→bundle first-pass measurement, and Radix stopped at bundle
while Bootstrap stopped at capture, so there are no sets to pair and no
self-heal loop to log. Adding three empty sections to satisfy a grammar that
does not describe this run would be ceremony, not evidence.

So it sits with the other v1 receipts. If a later round mints these subjects to
a canvas, that round's receipt belongs in `phase-2/` and under that gate.

## How to re-derive

```bash
# recreate both sandboxes from examples/<lib>/README.md §Recreate the sandbox
npm run prep:core && npm --prefix packages/cli run build
npx tsx packages/cli/src/cli.ts onboard examples/radix-themes
npx tsx packages/cli/src/cli.ts onboard --continue
npm run extract:computed:scorecard -- --dir extract/computed/out/radix-themes \
  --config extract/computed/configs/radix-themes.json --write
```

Re-running is **not** a first-pass measurement. That number was taken once.
