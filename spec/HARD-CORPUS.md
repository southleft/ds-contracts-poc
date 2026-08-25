# THE HARD CORPUS

*Cases this repo AUTHORS in order to be converted — each aimed at one mechanism a
closed table already names, each declaring its expected outcome before it runs.*

Generated tables below come from [`hard-corpus.json`](hard-corpus.json) and
[`hard-corpus-results.json`](hard-corpus-results.json) via
`npm run hard-corpus:check -- --write`. Do not edit between the generated markers.

---

## Why author a corpus instead of pulling another library

Nine libraries × Button/Badge/Card/Checkbox is mostly redundant. Every root cause
this repo is chasing was found on a handful of sets, and the library route pays a
tax that has nothing to do with the product: sandbox installs, version pins, mixed
browsers, hand-edited capture artifacts, and captures that are not re-derivable
from their own inputs. A corpus we author is reproducible by construction — which
kills the not-re-derivable class outright, and lets one case aim at exactly one
mechanism instead of ten mechanisms tangled inside somebody's Button.

The corpus is therefore **derived, not invented**. Every case names a mechanism
that one of the closed tables already carries:

| table | what a row contributes |
|---|---|
| [`channel-table.json`](channel-table.json) | 487 CSS properties classed CARRIED / LEDGERED / REFUSED / INERT. Every non-INERT row is a candidate case; the class IS the declared expectation. |
| [`grammar-coverage.json`](grammar-coverage.json) | 44 supported capture-config constructs and 10 unsupported ones. Every unsupported construct is a candidate case. |
| [`../packages/core/src/required-facts.ts`](../packages/core/src/required-facts.ts) | 61 required facts across 20 archetypes — the refuse-to-mint referee. A fact with no case is a refusal nobody has exercised. |
| [`../docs/23-known-limitations.md`](../docs/23-known-limitations.md) | the named `FC-*` walls. A wall with no case is a claim, not a measurement. |
| `rootCauses` in [`hard-corpus.json`](hard-corpus.json) | RC1–RC8, the burn-down triage classes. **The one hand-entered denominator** — they live in no repo file, so the manifest transcribes them and the gate checks cases against that list rather than re-deriving it. |

`npm run hard-corpus:check` re-derives every other denominator from its own file
and fails when the committed manifest disagrees, so a mechanism cannot leave the
matrix silently.

## Where the cases live

The code→canvas half is **not a new directory**. `conformance/cases/` is already
a first-party authored corpus — React + CSS per case, no library dependency, a
declared expectation per case, mounted through the unmodified
`extract/computed` pipeline with a normal capture config, network-free by
construction (`conformance/build.ts` builds its harness from symlinks; no npm
install step exists). The hard cases are conformance cases with a `hard-` prefix,
and `spec/hard-corpus.json` is the layer that binds them to the mechanisms the
closed tables name.

Two files therefore declare each case, independently, and the gate refuses when
they disagree:

- `conformance/cases/<id>/case.json` — the fixture's own expectation
  (`CARRIED | LOWERED | REFUSED | UNSUPPORTED`), the observable channel, and the
  value the **browser** must compute.
- `spec/hard-corpus.json` — the mechanism, the direction, and the expectation in
  the channel table's vocabulary (`CARRIED | LEDGERED | REFUSED`).

## Declare first, or the number is worthless

A case whose result is written after the fact is not a measurement; that is
precisely how a self-graded 168/170 happens. The gate enforces three rules, and
the third is measured against git rather than asserted:

1. every case declares `expect`, and anything but `CARRIED` must also name the
   string the engine has to produce;
2. a result may not exist for a case the manifest does not declare;
3. the commit that first declared a case must be a **strict ancestor** of the
   commit that first recorded its result. Same commit is refused.

`npm run hard-corpus:check -- --self-test` drives all three refusals plus the
shape rules against fabricated red inputs.

## The canvas half — designed, not built

The `canvasToCode` direction has no case in this manifest yet. The design, so
that building it is bookkeeping rather than invention: one page named
`hard corpus 2026-08-25` on the scratch file `byMp6lt0Ij9b2QbkDGFwBh` (the only
writable file; assert `currentFileKey` before every write), one set per
construct — nested auto-layout with mixed hug/fill, absolute-positioned children,
component properties (boolean, text, instance-swap), many-axis variant sets,
variable modes, text styles, detached instances, and overlay/portal-shaped sets.
Each set gets a `dump.snippet.json` beside its case, the shape
`extract/figma/conformance/cases/` already uses for the grid corpus, so the
existing `propose-figma` reader grades it with no new instrument.

<!-- BEGIN GENERATED: hard-corpus -->

## The coverage matrix

Every mechanism the closed tables name, and whether an authored hard case aims at it.
Re-derived by `npm run hard-corpus:check`; a source table that moves fails this gate.

| source | mechanisms | covered | code to canvas | canvas to code | both | NOT covered |
|---|---:|---:|---:|---:|---:|---:|
| channel-table CARRIED | 82 | 33 | 25 | 0 | 12 | 49 |
| channel-table LEDGERED | 80 | 4 | 3 | 0 | 1 | 76 |
| channel-table REFUSED | 271 | 14 | 14 | 0 | 0 | 257 |
| grammar-coverage unsupported | 10 | 0 | 0 | 0 | 0 | 10 |
| required-facts required | 61 | 0 | 0 | 0 | 0 | 61 |
| root causes | 8 | 6 | 6 | 0 | 0 | 2 |
| named walls (FC-*) | 8 | 0 | 0 | 0 | 0 | 8 |
| **all** | **520** | **57** | | | | **463** |

INERT is deliberately outside the denominator: 54 channel-table rows are classed INERT — provably no independent visual effect at computed level — so there is no outcome for a case to expect.

## The authored cases

| case | mechanism | direction | declared | name the engine must produce |
|---|---|---|---|---|
| `hard-align-items-baseline` | root-cause:`RC1` | codeToCanvas | **CARRIED** | the carriage IS the receipt |
| `hard-border-dashed` | root-cause:`RC3` | codeToCanvas | **LEDGERED** | `border-top-style` |
| `hard-box-shadow-layered` | root-cause:`RC3` | codeToCanvas | **CARRIED** | the carriage IS the receipt |
| `hard-empty-region-min-size` | root-cause:`RC5` | codeToCanvas | **CARRIED** | the carriage IS the receipt |
| `hard-flex-direction-column-reverse` | root-cause:`RC1` | codeToCanvas | **CARRIED** | the carriage IS the receipt |
| `hard-flex-wrap-wrap` | root-cause:`RC1` | codeToCanvas | **REFUSED** | `flex-wrap` |
| `hard-gradient-element-fill` | root-cause:`RC3` | codeToCanvas | **CARRIED** | the carriage IS the receipt |
| `hard-outline-ring-rest-plane` | root-cause:`RC3` | codeToCanvas | **CARRIED** | the carriage IS the receipt |
| `hard-placeholder-ink-vs-value` | root-cause:`RC7` | codeToCanvas | **CARRIED** | the carriage IS the receipt |
| `hard-pseudo-tick-rotated` | root-cause:`RC4` | codeToCanvas | **CARRIED** | the carriage IS the receipt |
| `hard-rem-scale-padding` | channel-table:`padding-left` | codeToCanvas | **CARRIED** | the carriage IS the receipt |
| `hard-svg-glyph-stroke` | root-cause:`RC4` | codeToCanvas | **CARRIED** | the carriage IS the receipt |
| `hard-text-indent-eviction` | root-cause:`RC8` | codeToCanvas | **LEDGERED** | `text-indent` |
| `hard-text-part-pinned-size` | root-cause:`RC8` | codeToCanvas | **CARRIED** | the carriage IS the receipt |

## Expectation vs outcome

No results recorded yet. `npm run hard-corpus:record` reads the measured baselines; it may not run in the commit that declares a case.

## What this corpus does NOT cover

- **channel-table CARRIED** — 49 with no case: `-webkit-text-fill-color`, `align-self`, `background`, `border-bottom-color`, `border-bottom-left-radius`, `border-bottom-right-radius`, `border-bottom-width`, `border-color`, `border-left-color`, `border-left-width`, `border-radius`, `border-right-color`, and 37 more.
- **channel-table LEDGERED** — 76 with no case: `-webkit-border-horizontal-spacing`, `-webkit-border-image`, `-webkit-border-vertical-spacing`, `-webkit-box-align`, `-webkit-box-decoration-break`, `-webkit-box-direction`, `-webkit-box-flex`, `-webkit-box-ordinal-group`, `-webkit-box-orient`, `-webkit-box-pack`, `-webkit-box-reflect`, `-webkit-font-smoothing`, and 64 more.
- **channel-table REFUSED** — 257 with no case: `align-content`, `alignment-baseline`, `anchor-name`, `anchor-scope`, `animation-composition`, `animation-delay`, `animation-direction`, `animation-duration`, `animation-fill-mode`, `animation-iteration-count`, `animation-name`, `animation-play-state`, and 245 more.
- **grammar-coverage unsupported** — 10 with no case: `axis-arity-depends-on-another-axis`, `boolean-variant-axis`, `child-part-axes`, `class-token-prop-is-fixed`, `container-self-reference`, `drafter-cannot-draft-compound`, `multi-package-mount`, `no-steady-state`, `richer-function-props`, `theme-provider-is-a-box`.
- **required-facts required** — 61 with no case: `accordion/divider`, `accordion/header-layout`, `accordion/open-axis`, `alert/interior-layout`, `alert/padding`, `alert/surface-ink`, `avatar/fill-or-content`, `avatar/geometry`, `avatar/shape`, `badge/padding`, `badge/surface-ink`, `badge/text-fact`, and 49 more.
- **root causes** — 2 with no case: `RC2`, `RC6`.
- **named walls (FC-*)** — 8 with no case: `FC-APPLY-TOKENS-NOT-PRUNED`, `FC-DUMP-PROPOSE-PART-STATE-CHANNELS`, `FC-DUMP-PROPOSE-UNBOUND-BOOLEAN`, `FC-EMIT-MARGIN-BOX-SKIPPED`, `FC-FONT-SUBSTRATE`, `FC-GEOMETRY-EXCLUDED`, `FC-STATE-PLANE-UNDRAWN`, `FC-UNSET-PLANE-UNDRAWN`.

- **the canvas half (canvas to code)** — DESIGNED, NOT BUILT this round. Hand-built Figma sets on the scratch file page `hard corpus 2026-08-25` targeting nested auto-layout with mixed hug/fill, absolute-positioned children, component properties (boolean/text/instance-swap), many-axis variant sets, variable modes, text styles, detached instances and overlay-shaped sets. The design is in spec/HARD-CORPUS.md; no set exists yet, and no case in this manifest declares direction canvasToCode.
- **the complex archetypes — calendar, data table, combobox** — DESIGNED, NOT BUILT this round. These are the archetypes the owner explicitly fears and they are exactly where the required-facts table has the least evidence; each needs a multi-part authored component and a prop space, which the conformance fixture cannot express (see the next row).
- **multi-axis variant products** — NOT REACHABLE from the conformance fixture as it stands: conformance/build.ts writes an EMPTY prop space per case ("the fixture varies CSS, not props"), so no case can carry two enum axes. RC2 and half of RC3/RC4 are products over axes and cannot be measured until the fixture grammar grows an axis. Named here rather than half-built.
- **RC2 (declared-uniform-only) and RC6 (stale-token-alias)** — NO CASE. RC2 needs a variant axis (see above). RC6 lives in the computed-capture DECISION LEDGER, which only exists for a library that has one — an authored case has no decisions.json to drift.
- **the emitter halves of RC5 and RC7** — NOT REACHABLE from a CSS/DOM fixture. The slot birth box and the placeholder-ink fallback both live in core/emit-figma-script.ts and are driven by CONTRACT constructs (slots, placeholder-color) that no capture produces. They need an authored CONTRACT case on the emit lane (bundle to mock canvas to dump to propose), which conformance/canvas.ts already provides the chain for. Designed, not built.
- **the INERT class** — DELIBERATELY OUT OF SCOPE, not an omission: an INERT row has provably no independent visual effect at computed level, so there is no outcome for a case to expect.

<!-- END GENERATED: hard-corpus -->

---

## Adding a case

1. `conformance/cases/hard-<id>/` — `Case.tsx`, `case.css`, `case.json`. No class
   may contain a CSS channel name (the first conformance run had 8 false passes
   because a class named `cf-filter-blur` satisfied a search for `filter`); the
   root is `cf-root` + `data-cf="<id>"`, children are `cf-a` / `cf-b`.
2. Establish `observable.capturedValue` from a **browser**, not from memory — a
   wrong one grades UNMEASURED for a reason that is about the fixture rather
   than the engine. It is the value the capture READER recorded, which is not
   always the raw `getComputedStyle` string: colours inside a composite value
   are normalised to `rgba()`. `hard-gradient-element-fill` was authored with
   Chromium's `rgb()` spelling and graded UNMEASURED until the fixture (never
   the expectation) was repaired. When a case grades UNMEASURED, read
   `extract/computed/out/conformance/<export>/captured-truth.json` before
   concluding anything about the engine.
3. Declare `expect` from the closed table the mechanism comes from, before you
   know what the engine does. Add the row to `spec/hard-corpus.json`.
4. `npx tsx conformance/build.ts && npm run hard-corpus:check -- --write` and
   **commit**. This commit contains no result.
5. `npm run conformance:capture -- --case <ExportName>`, then
   `npm run conformance -- --write`, then
   `npm run hard-corpus:check -- --record`, and commit **separately**.
