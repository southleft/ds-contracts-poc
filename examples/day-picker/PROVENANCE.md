# react-day-picker — provenance (held-out exam material, PREPARED BLIND)

**BLINDNESS RULE.** Every artifact in `examples/day-picker/` and
`extract/computed/configs/day-picker.json` was authored from
react-day-picker's own documentation and shipped source only. **No capture,
promote, emit or bundle stage of this repo has been run against
react-day-picker; no output of ours for it has been read; nothing here was tuned
in response to our pipeline's behaviour.**

**Status: PREPARED, NOT RUN.** There is no round to report.

## Subject and why it was chosen

`react-day-picker@10.0.1` (its `date-fns@4` / `@date-fns/tz@1` dependencies are
bundled, nothing extra to pin), with `react@19.2.8` / `react-dom@19.2.8` /
`esbuild@0.28.2`, pinned in the git-ignored `.day-picker-sandbox/`. The recreate
block in [README.md §3](README.md) is the source of truth.

This is **the complex-archetype probe**. The owner named the fear as "scaling to
a calendar or a date/time picker", and this directory is that fear made
measurable on a library the tool has never seen: one component, **93 DOM
descendants at its default combo**, against a proven archetype list
([docs/23 §C.1.1](../../docs/23-known-limitations.md#c11-which-component-archetypes-are-proven--the-actionable-cut))
that is entirely atoms and small molecules.

It was chosen over a design-system date picker because it is **self-contained**:
one package, one shipped stylesheet, no theme provider, no portal, no icon
dependency, no peer UI framework. The exam should measure the calendar, not the
host library that would otherwise come with it.

## Where each authored fact came from

| artifact | source |
|---|---|
| the four axes and their values | the `DayPicker` props documented at daypicker.dev and typed in `dist/esm` — `captionLayout`, `numberOfMonths`, `showOutsideDays`, `showWeekNumber` |
| `mode`, `timeZone`, `animate` pins | the same props documentation |
| the token vocabulary | `src/style.css`, `.rdp-root`, parsed by `scripts/build-tokens.mjs` |
| `classPrefix` / `classAllow` | the `rdp-*` class names the library emits |
| the "beyond the archetype" list | README §5, written against docs/23 §C.1.1 |

## Named findings — what this library costs the config grammar

Full detail in [README.md §4](README.md) and §5. In short:

1. **THE CONFIG GRAMMAR CANNOT SPELL A `Date`.** The capture config is JSON and
   its marker grammar is `$callback` / `$import` / `$render` / `$element` —
   none of which produces a `Date`. A calendar's entire rendering is a function
   of Dates: the visible month, the "today" ring, the selection. Unpinned,
   "today" is *actually today*, the DOM changes at midnight, no two captures can
   be byte-compared, and every committed receipt rots within a day. **A
   date-shaped component cannot be captured deterministically under today's
   grammar without help.** The help is `@day-picker-sandbox/fixtures` — three
   `new Date(...)` literals reached through `$import`, changing no library
   behaviour. A `{"$date": "2026-01-01"}` marker would close the gap properly;
   inventing it here would be tuning the instrument to the exam.
2. **`timeZone: "UTC"` is part of the determinism**, not a preference: without it
   the host's local zone decides which UTC instant lands in which day cell.
3. **No `blockStage`.** `.rdp-root` is a plain block div, so a block stage would
   make the calendar fill the stage and mint the harness window as the component
   width (the viewport-geometry hazard). A month grid is intrinsically sized —
   44 px day cells — so the flex stage lets it shrink-to-fit its own content.
4. **Seven ways a calendar is outside the proven archetype list** — repeated
   collections instead of an anatomy, state on children rather than the root, a
   grid whose row count is a function of the date, month duplication at
   `numberOfMonths: 2`, an axis that swaps a text caption for native `<select>`s,
   roving focus that a computed-style read cannot see, and a clock in the inputs.
   Written out in README §5 **before** any result exists, so a bad row can be
   checked against it rather than rationalised after the fact.

## What was verified before commit — and how

All of it in the sandbox, with react-day-picker rendering itself. **No stage of
our capture/promote/emit chain was involved.**

- **The calendar mounts and renders** at its default combo and at its largest
  enum combo. **0 zero-boxes, 0 console errors, 0 React warnings.**
  Default: `div.rdp-root[data-mode]`, 648 × 295 natural size, **93 DOM
  descendants**. Largest enum combo (`captionLayout: "dropdown-years"`,
  `numberOfMonths: 2`): 648 × 295, two months side by side with year dropdowns,
  inside the stage.
- **Screenshots** written to the git-ignored
  `.day-picker-sandbox/heldout-verify/shots/`. The default shot shows **January
  2026**, **15 in accent** (the pinned today) and **20 ringed** (the pinned
  selection) — the determinism fixture demonstrably works, on the render rather
  than on a claim.
- **Bind proof (docs/21 §4.2):**
  `getComputedStyle(document.querySelector('.rdp-root'))` returns
  `--rdp-accent-color: blue`, `--rdp-day-width: 44px`,
  `--rdp-today-color: blue`.
- **Token-file agreement, name by name, against the browser:** 38 names ·
  **35 byte-identical** · 2 differ by whitespace only · **0 differ in value** ·
  1 reports empty (`rdp-range_middle-color`, only declared under a range
  selection).
- **`loadConfig()` accepts the config.**
- **The seed contract parses under `ContractSchema`.**

## One prediction, recorded in advance

This library declares **38 custom properties in total** and hard-codes
everything else — grid tracks, caption flex layout, nav button geometry. A first
pass should therefore **mint far more than it binds**. If that is what the exam
shows, it is a real measurement about complex components (they are mostly
layout, and layout is not tokenised), not a defect in the reader. Recording it
here means the claim cannot be invented afterwards to explain a bad number.

## What has deliberately NOT been created

`extract/computed/out/day-picker/`, `examples/day-picker/contracts/`,
`examples/day-picker/figma/`, `examples/day-picker/storybook/`. The minted tree
is a committed **zero-leaf stub** under the documented `tokens.mintedBootstrap`
allowance.
