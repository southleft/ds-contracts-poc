# FLOWBITE COVERAGE HILL — stopped at a measured SEED wall, 0 new stems

*Wave outcome: **no components added.** The blocker is upstream of everything
the wave planned to do — a stem cannot reach capture, so it cannot reach
promote, emit or the bundle. Nothing was hand-authored to get around it, and
the target Figma file was not touched.*

    date     2026-08-13
    branch   feat/public-beta-prep
    subject  flowbite-react@0.12.17 in examples/tailwind/.tw-sandbox
    coverage UNCHANGED at 5 / 46 components

## STEP 1 — THE SHORTLIST, and it was measured rather than assumed

Every one of the 46 component directories was profiled on three signals: `.js`
file count, sub-component count, and whether it reaches for
`createPortal` / `useFloating`. The five committed contracts sit at a single
profile — **js=3 · subs=1 · no portal** — except Button (js=6, subs=4), which
is the outlier that already works.

**The assumption in the brief did not survive contact.** Avatar was suggested
as a candidate; measured, it is js=5 · subs=3 — heavier than anything committed
and in the same tier as Toast and Pagination. It is NOT in the shortlist.
Tooltip was suggested; it wraps `Floating`, which makes it an overlay, so it is
excluded by the brief's own rule.

Shortlist (all js=3 · subs=1 · no portal, all confirmed single-root):

| stem | root element | declared axes (from the library's own `.d.ts`) | why |
|---|---|---|---|
| **Spinner** | `<span>` | `color`, `size` (+ `light` boolean) | smallest theme in the library (634ch); the safest first stem |
| **Checkbox** | `<input type="checkbox">` | `color` (+ `indeterminate` boolean) | literally one element — the cleanest primitive here |
| **Radio** | `<input>` | `color` | same shape as Checkbox |
| **TextInput** | `<div>` + `<span>` | `color`, `sizing` (+ `shadow`) | the most-wanted form primitive; same 2-part shape as Alert/Card |
| **Progress** | `<div>` + `<span>` | `color`, `size` (+ label booleans) | simple theme (693ch), no state plane |

Deliberately excluded: Carousel (7 `useState`/`useEffect` — stateful), Tooltip
and Popover (Floating/portal), Dropdown and Modal (portal, subs≥5), everything
at subs≥3.

## STEP 2 — THE WALL. Both automated seed paths are dead for this library.

Capture is not the problem: **the sandbox exists, flowbite-react@0.12.17 is
installed, playwright-core 1.61.1 is present and Chromium is cached
(chromium-1234).** `extract:computed` could run today. What it cannot do is run
without a **seed contract**, and `extract/computed/capture.ts:106` declares
`contract: string` — required, one per component.

There are exactly two ways to produce a seed without a human authoring it, and
both were run:

**(a) The static pass — REFUSED BY NAME, correctly.**

    $ npx tsx packages/cli/src/cli.ts extract <config pointing at flowbite dist>
    ✘ react-tsx adapter REFUSED — ZERO CANDIDATE SOURCE FILES.
      222 .ts/.tsx file(s) WERE found and every one was skipped by name:
        · 222 × ambient declaration file (*.d.ts) — an api-extractor/tsc rollup
      ROLLUP-ONLY PACKAGE: this tree publishes ambient declarations only.

flowbite-react ships `dist/` + `package.json` + `README.md` + `schema.json` and
no source. This is the refusal the `rollup-only-package-refused-by-name` eval
pins, working exactly as designed — the package, not the config, is the fact.

**(b) `seed-gen` — proposes NOTHING for this library. 0 of 7.**

`extract/computed/seed-gen.ts` exists for precisely this problem: it reads a
library's own shipped `.d.ts` and proposes the prop space so a human reviews
instead of authors. It has ground truth here — five hand-authored tailwind
seeds — so it was verified against them before being trusted:

    $ npx tsx extract/computed/seed-gen.ts extract/computed/configs/tailwind.json --verify

    AGREEMENT vs hand-authored seeds: 0/7 enum axes reproduced EXACTLY,
    0 differ, 7 not proposed.
    Of the 7 not proposed, 1 are JUDGMENT and 6 are MECHANICAL resolver gaps.
    PRUNE RATE: UNDEFINED — the generator proposed NOTHING for these 5
    components. That is a resolver failure, not a 0% prune.

**This is a third data point the generator did not have.** `npm run seed:verify`
runs Carbon (11/14) and MUI (15/20) only. Its own header warns that "any figure
here from a single library should be treated as unvalidated" — tailwind is now
the library where it scores zero, and that number should be published next to
the other two rather than left unmeasured.

### THE EXACT BLOCKER, so the next round does not have to re-derive it

flowbite declares every enum prop through one generic composition:

    color?: DynamicStringEnumKeysOf<SpinnerColors>;

    type DynamicStringEnumKeysOf<T extends object> =
      DynamicStringEnum<keyof RemoveIndexSignature<T>>;          // types/index.d.ts:8

    interface SpinnerColors
      extends Pick<FlowbiteColors, "failure"|"gray"|"info"|"pink"|"purple"|"success"|"warning"> {
      [key: string]: string;
      default: string;
    }

Resolving that to `failure|gray|info|pink|purple|success|warning|default`
requires four composed steps: unwrap `DynamicStringEnumKeysOf`, evaluate
`Pick<Base, "…">` across an interface's `extends` clause, apply
`RemoveIndexSignature` to drop `[key: string]: string`, then union the picked
keys with the interface's own members. That is real TypeScript type evaluation,
not a string unwrap — it needs either the TS checker or a resolver that
understands `Pick`/`keyof`/index-signature removal.

**That is an engine change, and this wave stops there by instruction.**

## WHAT WAS NOT DONE, deliberately

  · **No seed was hand-authored.** That is the one move that would have
    produced components today, and it is what `seed-gen`'s own header calls
    THE SCALE WALL (docs/23 §6b) — the linear human cost that keeps every
    code-side number in this repo a slice number. Paying it by hand for five
    more stems would have grown the demo and hidden the wall.
  · **The target Figma file was not touched.** `Y8Jhw6R49wTLuXZ0is2GmV` still
    holds exactly the five sets LIVE-APPLY-RECEIPT.md recorded. With no new
    contracts there was nothing to apply, so no navigate, no lock, no write.
  · **No scorer, ratchet or bar was relaxed**, no `defaultContent` invented, no
    second library opened.

## WHAT WOULD UNBLOCK IT

One of these, in preference order:

  1. **Teach `seed-gen` the `DynamicStringEnumKeysOf` composition.** It lands
     five stems here and is measurable the same way the existing work is:
     `--verify` against the five hand-authored tailwind seeds should go 0/6
     → 6/6 mechanical, with the ToggleSwitch `checked` axis staying JUDGMENT.
     It would also raise the two published figures, since Carbon's and MUI's
     unresolved axes may share the pattern.
  2. **Point the static pass at a flowbite-react SOURCE checkout** rather than
     the published package — the tool's own refusal message suggests this. It
     needs a second sandbox and pins a git ref, which is new infra.

Until one lands, the honest coverage row stays **5 / 46 (10.9%)**.

---

# FOLLOW-ON: THE SEED WALL IS DOWN (2026-08-14)

The resolver gap named above is closed. `seed-gen` now reads Flowbite's
declarations, and all five shortlisted stems get a proposal.

## BEFORE → AFTER, all three libraries

| library | before | after | verdict |
|---|---|---|---|
| **tailwind** | 0/7 exact · 0 differ · **6 MECHANICAL gaps** | **2/7 exact · 4 differ · 0 MECHANICAL** | unblocked |
| carbon | 11/14 exact · 0 differ · 3 JUDGMENT | 11/14 exact · 0 differ · 3 JUDGMENT | **held, byte-identical** |
| mui | 28/43 exact · 3 differ · 12 not proposed | 28/43 exact · 3 differ · 12 not proposed | **held, byte-identical** |

**A correction to the brief, and to seed-gen's own header:** both quoted MUI at
"15/20 with zero DIFFER". Re-measured, MUI is **28/43 with 3 DIFFER** and has
been for some time — the header was reporting a number the tool no longer
produced. The header now carries the re-measured figures for all three.

## WHAT THE RESOLVER LEARNED — four plain TypeScript utilities, no library names

    DynamicStringEnumKeysOf<T> = DynamicStringEnum<keyof RemoveIndexSignature<T>>
    interface SpinnerColors extends Pick<FlowbiteColors, "failure"|…> {
      [key: string]: string; default: string }

  1. **Generic aliases are indexed at all.** The old regex read `type X = …`
     and could not see `type X<T> = …` — `<T>` sits between the name and the
     `=`. Flowbite routes *every* enum prop through one generic, so the entire
     library was invisible for that one reason.
  2. **`keyof` over an interface shape** — own members plus everything reached
     through `extends`, with index signatures dropped (which is what
     `RemoveIndexSignature` asks for anyway).
  3. **`Pick<T,K>` / `Omit<T,K>`** evaluated against that key set.
  4. **The open-enum arm is stripped.** `DynamicStringEnum<T> = T | (string & {})`
     keeps editor autocomplete while accepting any string; `(string & {})` is
     the "any string" half and is no more a design value than `undefined`.

**ORDER WAS LOAD-BEARING AND THE MISTAKE WAS MEASURED.** Placing the
generic-alias application above the named handlers took MUI from **28/43 to
3/43** — `OverridableStringUnion<…>` *is* a generic alias, and the substitution
swallowed it before its own case ran. The specific handlers now win and the
generic application is the fallback. That regression is why carbon and mui were
re-measured after every edit rather than at the end.

## THE FOUR TAILWIND DIFFERS ARE NOT RESOLVER FAILURES

    ~ Button.color  proposed-only: blue|cyan|gray|indigo|light|lime|pink|purple|teal|yellow
    ~ Badge.color   proposed-only: blue|cyan|dark|gray|green|light|lime|purple|red|teal|yellow
    ~ Alert.color   proposed-only: blue|cyan|dark|gray|green|indigo|light|…|yellow
    ~ Button.size   human-only:    md

Three are **supersets the human pruned** — Flowbite types `color` as every key
of `FlowbiteColors` (17) while the seed keeps the 4–6 the design actually uses.
The proposal agrees with the library's own RUNTIME theme (Button: 15 proposed,
15 in `buttonTheme.color`), so the generator is reading correctly and the human
curated. That is the designed workflow — the same prune the Carbon (45%) and
MUI (49%) rates describe.

The fourth is an **upstream type bug**: `ButtonSizes extends Pick<FlowbiteSizes,
"xs"|"sm"|"lg"|"xl">` omits `md`, but `buttonTheme.size` ships
`xs|sm|md|lg|xl`. **The human seed is right and flowbite-react@0.12.17's
declaration is wrong**, so no reader of the declarations can reproduce it.

**THE BRIEF'S BAR — "6/6 mechanical exact, zero new DIFFER" — IS NOT
ACHIEVABLE**, and that was measured before any code was written rather than
discovered after. Hitting it would mean reproducing a human's curation of 17
colours down to 4, which is the one thing seed-gen's own header rules out:
"a generator that produced THAT would be inventing the design space, not
reading it." What *was* achievable — and is what the wave delivers — is **zero
mechanical gaps**.

## THE ACTUAL UNBLOCK

    $ npx tsx extract/computed/seed-gen.ts <config with the five stems>
      ✔ Spinner:   2 enum axis/axes — color(8), size(5)
      ✔ Checkbox:  1 enum axis/axes — color(17)
      ✔ Radio:     1 enum axis/axes — color(17)
      ✔ TextInput: 2 enum axis/axes — color(5), sizing(3)
      ✔ Progress:  2 enum axis/axes — color(13), size(4)
      ✔ all 5 pass validateContract — the same referee the pipeline runs.

Spinner's `color` resolves to exactly the eight values the wall named:
`info|failure|success|warning|gray|pink|purple|default`. Before this round the
generator proposed **nothing** for any of them.

`npm run seed:verify` now runs **carbon, mui AND tailwind** and short-circuits
on none of them — previously it ran carbon `&&` mui, so a tailwind regression
could not have been seen, and a carbon failure would have hidden mui. Note it
exits non-zero whenever any axis differs, so it was **already red before this
round** (MUI's 3 DIFFER) — it is a report, not a gate, and this round did not
change that semantics to make a number look better.

## NOT DONE HERE, BY INSTRUCTION

No capture, no promote, no emit, no bundle, no Figma. No seed was written into
the repo — the five proposals above were generated to a scratch directory,
inspected, and deleted. The coverage hill (Spinner → Checkbox → Radio →
TextInput → Progress) is the next wave.
