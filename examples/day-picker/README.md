# react-day-picker — held-out exam subject #3, the COMPLEX-ARCHETYPE probe

> **Current state (2026-08-30).** This directory is the **held-out capture
> exam** for F1 (unseen library). Keep the blindness rule below. Calendar
> is separately **live-proven on the recipe-IR path** (page `181:64873`,
> owner-signed). Do not read §5 as “calendar has no proof” — it names
> why the *capture* path cannot treat a month grid as a proven archetype.

> ## THE BLINDNESS RULE
>
> **This directory was authored blind, and it must stay blind until the exam
> runs.** Everything here comes from react-day-picker's own documentation
> (<https://daypicker.dev>) and its shipped `src/style.css` and `dist/esm`
> typings.
>
> **No capture, promote, emit or bundle stage of this repo has been run against
> react-day-picker. No output of ours for it has been read. Nothing here was
> tuned in response to our pipeline's behaviour.** If you find yourself wanting
> to change a value in this directory because "the capture would do X", stop —
> that is exactly the contamination this exam exists to detect.
>
> The exam's own rules and command list live in
> [`parity/receipts/v1/HELD-OUT-MANIFEST.md`](../../parity/receipts/v1/HELD-OUT-MANIFEST.md).

---

## 1 · Why this subject exists

The owner named the fear precisely: *"scaling to a calendar or a date/time
picker."* This directory is that fear, made measurable, on a library the tool
has never seen.

**One component. Ninety-three DOM descendants at its default combo.** Where the
whole proven archetype list is atoms and small molecules — button, badge,
checkbox, switch, alert, input, card, avatar, tabs, accordion, progress, slider
([docs/23 §C.1.1](../../docs/23-known-limitations.md#c11-which-component-archetypes-are-proven--the-actionable-cut))
— a calendar is a different shape of thing, and §5 lists exactly which of its
properties fall outside that list. **The point of the probe is that its failures
should be interpretable**, not surprising.

## 2 · Subject and pins

| pin | value |
|---|---|
| `react-day-picker` | **10.0.1** |
| `date-fns` / `@date-fns/tz` | bundled dependencies of the above (4.x / 1.x) — nothing to pin separately |
| react / react-dom | 19.2.8 |
| esbuild | 0.28.2 |
| sandbox fixtures module | `@day-picker-sandbox/fixtures@0.0.1` (local, `file:./fixtures-pkg` — see §4.1) |

react-day-picker is **self-contained**: one npm package, one shipped stylesheet
(`react-day-picker/style.css`), no peer UI framework, no theme provider, no
portal, no icon dependency (the chevrons are inline SVG). That self-containment
is why it was chosen over a date picker that drags a whole design system in
behind it — the exam should measure the calendar, not the host library.

**No webfont ships**, so this config declares no `fonts` block; the calendar
inherits whatever the page's font stack is (in a bare harness that is the UA
default). `style.css` contains **zero `url()` references**, so the harness stays
network-free.

## 3 · Recreate the sandbox (git-ignored; this block is the source of truth)

```bash
mkdir -p examples/day-picker/.day-picker-sandbox
cd examples/day-picker/.day-picker-sandbox
printf '{"name":"day-picker-sandbox","private":true,"type":"module"}\n' > package.json
npm i -E react-day-picker@10.0.1 react@19.2.8 react-dom@19.2.8 esbuild@0.28.2

# THE PINNED DATES — see the finding in §4.1.
mkdir -p fixtures-pkg
cat > fixtures-pkg/package.json <<'JSON'
{
  "name": "@day-picker-sandbox/fixtures",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "main": "./index.js",
  "exports": { ".": "./index.js" }
}
JSON
cat > fixtures-pkg/index.js <<'JS'
export const FIXED_MONTH = new Date(Date.UTC(2026, 0, 1));
export const FIXED_TODAY = new Date(Date.UTC(2026, 0, 15));
export const FIXED_SELECTED = new Date(Date.UTC(2026, 0, 20));
JS
npm i -E ./fixtures-pkg
```

Then, from the repo root:

```bash
node examples/day-picker/scripts/build-tokens.mjs
```

## 4 · The one component — and what the grammar cannot say

| | |
|---|---|
| mounted export | `DayPicker` |
| axes | `captionLayout` label / dropdown / dropdown-months / dropdown-years · `numberOfMonths` 1 / 2 · `showOutsideDays` bool · `showWeekNumber` bool |
| pinned | `mode: "single"`, `timeZone: "UTC"`, `animate: false`, plus the three Dates below |
| stage | 704 × 400, padding 16, **no `blockStage`** — a month grid is intrinsically sized (44 px day cells), so the flex stage lets it shrink-to-fit its own content width instead of minting the harness window as the component's width |

### 4.1 THE BIG ONE: the config grammar cannot spell a `Date`

The capture config is JSON. Its marker grammar is `$callback` / `$import` /
`$render` / `$element` — and **not one of them can produce a `Date`**. A
calendar's entire rendering is a function of Dates: which month is on screen,
which day gets the "today" ring, which day is selected.

Left unpinned, "today" is *actually today*: the same config renders a different
DOM every time the clock crosses midnight, no two captures can ever be
byte-compared, and any committed receipt rots silently within a day. This is not
a nice-to-have — **a date-shaped component cannot be captured deterministically
under today's grammar without help.**

The help is the sandbox fixtures module in §3: three `new Date(...)` literals
and nothing else, reached through the `$import` marker. It changes no library
behaviour; it supplies the arguments a deterministic render needs. Precedent for
a sandbox-local module in the mount path is the shadcn round's
`@shadcn-sandbox/ui` barrel.

The grammar gap worth closing is small and obvious: a `{"$date": "2026-01-01"}`
marker (UTC, ISO-8601) would remove the need for a per-library module entirely.
It does not exist today, and inventing it here would be tuning the instrument to
the exam.

### 4.2 `timeZone: "UTC"` is part of the determinism, not a preference

Without it, the harness host's local zone decides which UTC instant lands on
which calendar day, so the same pinned Dates can render in different cells on
two machines. Pinning UTC on both sides — the fixture Dates and the component —
removes the host from the answer.

### 4.3 Two of the four axes are boolean

`showOutsideDays` and `showWeekNumber` are declared as boolean contract props
and enumerated as two-value axes. They are **not** state planes: nothing about
them is a pseudo-class, they are prop-selected renderings, which is the
axis-vs-state rule in docs/21 §4.3.

### 4.4 `classAllow` keeps the whole `rdp-*` vocabulary

In this library the class **is** the part name — `rdp-month_grid`,
`rdp-day_button`, `rdp-weekday`, `rdp-caption_label`, `rdp-chevron` — and there
are no per-combo value classes on the ROOT. (The per-day state classes
`rdp-selected`, `rdp-today`, `rdp-outside`, `rdp-disabled` live on individual day
cells, which is itself one of the questions §5 asks.) So `classPrefix: "rdp-"`,
`classAllow: "^rdp-[a-z_]+$"`, and nothing is dropped.

## 5 · WHAT IS BEYOND THE PROVEN ARCHETYPE LIST — read this before reading results

Every proven archetype in
[docs/23 §C.1.1](../../docs/23-known-limitations.md#c11-which-component-archetypes-are-proven--the-actionable-cut)
is a small, fixed anatomy whose parts are enumerable and whose states are
pseudo-classes. A calendar breaks that on at least seven axes. **When a row in
the exam result looks bad, check it against this list first.**

1. **A month grid is a REPEATED COLLECTION, not an anatomy.** 42 day cells are
   not 42 named parts; they are one part instantiated 42 times, each with
   different text and a different combination of state classes. Nothing in the
   proven list has repetition at all. The nearest committed thing is
   `extract:figma:repeat:check` (repeat collections) and the table/data-grid row,
   which is ATTEMPTED — BOUNDED with a single library behind it.

2. **The interesting state lives on the CHILDREN, not the root.** `rdp-selected`,
   `rdp-today`, `rdp-outside`, `rdp-disabled`, `rdp-range_start/middle/end` are
   per-day-cell classes. The axis grammar drives the root mount only (docs/21
   §7.3), so none of them can be enumerated as an axis. Whatever the capture
   sees of them, it sees incidentally, through whichever cells the pinned dates
   happen to light up.

3. **The layout is CSS grid with computed track counts.** `rdp-month_grid` is a
   `<table>` with a weeks body whose row count varies by month (4, 5 or 6 weeks).
   The declared-track grid grammar in the contract schema handles *fixed* track
   lists; a month grid's row count is a function of the date.

4. **Two months side by side is a flex row of two independent sub-anatomies.**
   `numberOfMonths: 2` does not scale a part — it duplicates a subtree, with its
   own caption, its own weekday header and its own grid, and moves the nav
   buttons' relationship to both.

5. **`captionLayout: "dropdown"` swaps the caption for native `<select>`
   elements.** The month and year dropdowns are real form controls with option
   lists; changing one axis value replaces a text node with a control. Nothing
   in the proven list changes its element type on an axis.

6. **Roving focus and keyboard navigation are invisible to a computed-style
   capture.** The calendar implements a roving `tabindex` grid with arrow-key
   navigation, `aria-activedescendant`-style semantics, and focus that follows
   the focused day across month boundaries. A capture reads computed styles at
   rest; none of that behaviour has a style to read, so it will be absent from
   the result and its absence is not a regression.

7. **"Today" is a live value.** Even with the month pinned, the concept of a
   today-ring only exists because a Date was supplied. §4.1 covers the mechanics;
   the archetype point is that this component has a *clock* in its inputs, and no
   proven archetype does.

**Not in scope for this probe at all**: range selection across months, disabled
date matchers, `numberOfMonths > 2`, RTL (`dir="rtl"` has its own chevron
mirroring rules), broadcast calendars, week-number click handling, and the
animation layer (`animate` is pinned false).

## 6 · Verified before commit

Run in the sandbox, with react-day-picker rendering itself and nothing of ours
in the loop:

- **The calendar mounts and renders**, at its default combo and at its largest
  enum combo. **0 zero-boxes, 0 console errors, 0 React warnings.** Default
  combo: `div.rdp-root`, 648 × 295 natural size, **93 DOM descendants**. Largest
  enum combo (`captionLayout: "dropdown-years"`, `numberOfMonths: 2`): 648 × 295,
  two months side by side with year dropdowns, still inside the stage.
- Screenshots are written to the git-ignored
  `.day-picker-sandbox/heldout-verify/shots/`. The default shot shows **January
  2026** with **15 in accent** (the pinned today) and **20 ringed** (the pinned
  selection) — i.e. the determinism fixture demonstrably works.
- The committed DTCG file was checked name-by-name against `getComputedStyle`
  on the live `.rdp-root`: **38 names · 35 byte-identical · 2 differ by
  whitespace only · 0 differ in value · 1 reports empty**
  (`rdp-range_middle-color`, which is only declared under a range selection).
- `loadConfig()` — the engine's own config validator, which reads the config and
  runs no capture — accepts `extract/computed/configs/day-picker.json`.

## 7 · What has NOT been done, on purpose

No capture has run. `extract/computed/out/day-picker/` does not exist, there are
no scorecards, no `contracts/`, no `figma/`, no emitted React. The minted tree
`tokens/day-picker-minted.dtcg.json` is a committed **zero-leaf stub** riding
the documented `tokens.mintedBootstrap` allowance — a genuine first-ever pass.

One expectation worth writing down in advance, so it cannot be rationalised
afterwards: this library declares **38 custom properties total** and hard-codes
everything else (grid tracks, caption flex layout, nav geometry). A first pass
should therefore **mint far more than it binds**, and that ratio is a real
measurement about complex components — they are mostly layout, and layout is not
tokenised — not a defect in the reader.
