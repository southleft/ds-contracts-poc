# The MUI `CssBaseline` mount correction — every number that moved

**Measured 2026-09-04** on branch `wave/mui-cssbaseline`, from base `2bda29e7f`.
Every figure below is from a gate run, not an estimate.

## What was wrong

`extract/computed/configs/mui.json` wrapped every capture in `<ThemeProvider>`
and never mounted `<CssBaseline />`. `ThemeProvider` puts the theme on React's
context; **`CssBaseline` is what puts its typography on the document**. So any
MUI component that inherits its face from `body` — `Link` renders `Typography`
with `variant="inherit"` — captured in the browser's serif default.

## The premise, confirmed 13/13

| | before | after |
| --- | ---: | ---: |
| `font-family` reads across the mui captures | 1,164 | 1,149 |
| captures whose reads include a Roboto stack | 19 | **32** |
| captures with **no** Roboto in any read | **13** | **0** |

The thirteen: accordion, card, checkbox, circularprogress, divider, drawer,
iconbutton, linearprogress, link, paper, radio, slider, switch. Every one now
carries the library's own face. Before the wave, mui was the **only** library in
the corpus with any component whose `font-family` reads were entirely UA
defaults (altitude 0/8, antd 0/13, astryx 0/11, astryx-core 0/11, carbon 0/10,
chakra 0/12, fluent 0/12, shadcn 0/11, tailwind 0/11).

## The curated-fact guard — the reason this wave was worth running

Run over all 31 committed MUI contracts against their re-promotion:

> **no curated-fact losses**

63 divergences, every one an addition or a reshape, none deleting a curated
value. This is the guard written after a 2026-08-26 wave silently dropped an
avatar's initials and a progress bar's 40%, and it had a self-test but had
**never been run against a real wave** until this one.

## Every number that moved

**Fidelity — 22 mui rows: 8 better, 10 same, 4 worse. No row crossed the bar.**

| row | before | after | |
| --- | ---: | ---: | --- |
| `link/mui` | 49.08 | **39.63** | −9.45 |
| `badge/mui` | 2.52 | 1.68 | −0.84 |
| `dialog/mui` | 4.81 | 4.04 | −0.77 |
| `badge/mui-proposed` | 3.11 | 2.38 | −0.73 |
| `tabs/mui`, `tabs/mui-proposed` | 7.73 | 7.07 | −0.66 |
| `menu/mui`, `menu/mui-proposed` | 4.73 | 4.51 | −0.22 |
| `link/mui-proposed` | 20.22 | **33.98** | **+13.76** |
| `chip/mui`, `chip/mui-proposed` | 0.61 | 1.59 | +0.98 |
| `avatar/mui` | 4.00 | 4.06 | +0.06 |

**Why the four worse rows are worse.** The fidelity gate compares a *committed
canvas PNG from an earlier live mint* against the capture's reference. This wave
corrects the **reference** side only. Those canvases were minted from fixtures
built on the Times capture, so a corrected reference moves away from them.
Realising the gain needs a canvas re-mint — a separate live operation. One row
was attempted and failed on a page/component lookup; it was not improvised at
scale.

**Everything else:**

| artifact | before | after |
| --- | ---: | ---: |
| docs/24 corpus mean | 86.5% | 86.4% |
| compared style cells | 752,625 | 773,019 |
| components at ≥80% | 100/128 | 101/128 |
| MUI lane mean | 89.4 | 88.9 |
| MUI lane ≥80% | 27/32 | 28/32 |
| MUI lane cells | 121,317 | 141,711 |
| geometry census, stale extensions | 81 | 66 |
| door register, mui control-equal drops | 73,395 | 72,481 |
| promote ledger, mui divergences named | 9 | 63 |

All ten mui generated fixtures were re-proposed from the corrected captures:
`requestedFamily` `"Times"` → `"Roboto"`, `labelLineHeight` 0 → 24,
`lineHeightUnit` `"auto"` → `"px"`.

## Two pre-existing defects found on the way, neither caused by this wave

**The whole-library capture could not run at all.** `extract:computed` with no
`--component` died on four duplicate-symbol errors: the entry's main import line
and its `$import` line each deduplicate internally, never against each other,
and MUI's `TextField` carries a `$import` for `InputAdornment`, which is also a
captured component. Confirmed pre-existing by reverting the mount and
reproducing it. Fixed at both the census and portal pages, which their own
comments require to stay in lockstep.

**Tooltip fails the harness determinism self-check** — `transform`,
`translate-x` at the popper root, unstable across the double sweep. Confirmed
pre-existing the same way. It is the one component **not** re-captured; its
committed capture and promotion are untouched. The guard refused to write rather
than persist unstable data, which is correct.

## An authored compensation retired, and its stated cause was wrong

`examples/mui/authored-facts.json` carried a row unbinding Link's minted
`30.2188px` root width, authored 2026-08-17. Its cause reads:

> "The minted 30.2188px root width is the capture font's measure of the sample
> text 'Link' (**Roboto 16px**, admitted through the block-root-width door as a
> shrink-to-fit block) — a harness fact, not the library's."

It was Times — the defect this wave fixes. The diagnosis was right and the
attribution was not. With the mount corrected the capture no longer binds width
at all, so the compensation has nothing to do; the row and its minted leaf are
removed.

## Cascades carried after the first pass

Running the whole 191-gate lane locally surfaced six more, all carried:

| gate | what it needed |
| --- | --- |
| `extract:computed:drift` | 32 mui pins re-recorded **on Linux** (the rsync removed them; the re-measure renders in Chromium, so pins are OS-specific). Exactly 31 rows moved, none outside mui, Tooltip's untouched. |
| `recipe:boilerplate:generated:check` | all 13 live-proof receipts re-prepared — their recipe hashes moved with the fixtures |
| `recipe:fixture-drift:check` | reader artifacts rebuilt (1,404 match · 1 drift) |
| `test:recipe` | one expectation updated — see below |
| `console-loop:mui:evidence:check` | `input-adornment` re-scored and its pass-claim withdrawn — see below |
| `console-loop:all:evidence:check` | green once the above landed; all 8 lanes |

**A test that pinned the defect.** `point.test.ts` asserted MUI's link
`lineHeightUnit` is `"auto"`. That value *was* the mount defect: with no
`CssBaseline` the root computed `line-height: normal`. Read through the ledger's
own reader, the corrected capture gives `line-height: 24px` and
`Roboto, Helvetica, Arial, sans-serif` — body's 1.5 × 16px, which is what a real
MUI application renders. The expectation now pins the library's value instead of
the unstyled stage's, with that reason written above the test. 380 pass.

**A recorded pass withdrawn, and it was never a real one.**
`console-loop/mui/input-adornment` claimed `visual.ok: true`. Re-scored against
the corrected reference it is **pctAAMasked 20.83** against a 5 bar, with
`compositionOk` still true — purely the pixel/font difference. Its canvas on
`59mLQlOMiD5w5za6SUcoO5` was built from a Times-derived contract, so canvas and
reference agreed **because they shared the error**. The receipt is now
`fail-closed` with a named defect, `MUI-CANVAS-PREDATES-CSSBASELINE`, carrying
the measurement, the closing condition, and why closing it is an owner act.

## Final state on this branch

```
npm run ci:lane fast   →   190 / 191 gates green
```

The one failure is `visual-truth:check`, below.

## The one gate this wave cannot leave green, and why it is not mine

`visual-truth`'s mui lane drops **7 headless passes → 5**:

| stem | before | after | composition |
| --- | --- | --- | --- |
| `input-adornment` | pass | fail, pctAAMasked **20.83** | ok both |
| `slider` | pass | fail, pctAAMasked **7.96** | ok both |

Composition is fine on both sides, so it is purely the pixel bar. Those two
Figma canvases were rendered from Times-derived contracts and passed **only
because the reference shared their error**. The corrected reference exposes
them: the number got worse and more truthful in the same move.

Both remedies are the owner's:

1. **Lower the mui floor 7 → 5** — `parity/receipts/console-loop/RATCHET.json`
   says in its own note, *"never lower one without owner sign-off."*
2. **Re-mint those two canvases** — they live in Figma file
   `59mLQlOMiD5w5za6SUcoO5`, a **connected** file. The only file this agent may
   write is Scratch `byMp6lt0Ij9b2QbkDGFwBh`.

So the wave sits on a branch. `main` is untouched and green rather than red or
quietly re-floored to fit a change of mine.

## The decision, prepared both ways

Neither is applied here. Both are one action.

### Option A — sign off the floor at 5

The count is lower **and more truthful**: those two stems passed only because
canvas and reference shared the same defect. Applying this records that.

```bash
python3 - <<'EOF'
import json
p='parity/receipts/console-loop/RATCHET.json'
d=json.load(open(p))
d['lanes']['mui'] = 5
d.setdefault('decisions', []).append({
  "lane": "mui", "from": 7, "to": 5, "date": "2026-09-04",
  "by": "<your name>",
  "cause": "The CssBaseline mount correction. input-adornment (pctAAMasked 20.83) "
           "and slider (7.96) lose their passes with compositionOk still true, so it is "
           "purely the pixel/font difference. Their canvases on 59mLQlOMiD5w5za6SUcoO5 "
           "were built from Times-derived contracts and passed only because the reference "
           "carried the same defect. The corrected reference exposes them: the count fell "
           "and the honesty rose. Floor lowered deliberately, not to make a wave pass.",
  "reopensWhen": "either canvas is re-minted from a CssBaseline-derived contract and "
                 "console-loop:developed-score puts it back under the bar — then raise it again."
})
json.dump(d, open(p,'w'), indent=2); open(p,'a').write('\n')
EOF
npm run visual-truth:check      # expect green
git commit -am "OWNER: mui visual-truth floor 7 -> 5, cause recorded"
```

*(Check `d['lanes']` against the file's actual key name before running — the
shape is pinned there, not here.)*

### Option B — keep the floor at 7 and re-mint the two canvases

Re-mint `input-adornment` and `slider` on `59mLQlOMiD5w5za6SUcoO5` from
contracts derived from the CssBaseline captures, then:

```bash
npm run console-loop:developed-score -- --lib mui --stem input-adornment
npm run console-loop:developed-score -- --lib mui --stem slider
npm run visual-truth:run -- --lib mui && npm run visual-truth:report
npm run visual-truth:check      # expect green, floor untouched at 7
```

Option B is the better end state — it fixes the canvases rather than accepting
them — and it is the slower one. Option A is honest and reversible: the
`reopensWhen` says exactly what raises the floor back.

Either way the branch merges with no further work from me.

## How to re-derive this page

```
git checkout wave/mui-cssbaseline
npm run recipe:fidelity:check          # 53 pass / 13 named
npm run corpus:reproducible:check      # mui: 63 named divergences
npm run door-register:check            # 432 doors, mui drops 72,481
npm run visual-truth:check             # ✖ mui: 5 < floor 7  ← the owner's call
```
