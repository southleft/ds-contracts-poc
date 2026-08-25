# HELD-OUT EXAM MANIFEST — three subjects, prepared blind

**Prepared 2026-08-24. Not yet run.**

The headline metric this material exists to measure is **first-pass success**:
point the tool at a library it has never seen, run the documented chain **once**,
touch nothing, and count what comes out recognisable. That number is only worth
anything if the exam material was authored without knowing how the tool behaves
on it. This file is the contract that makes that claim checkable.

---

## THE BLINDNESS RULE

**Stated here, and restated verbatim in every README, PROVENANCE, capture
config, ds-library manifest, seed contract and token-build script this change
adds.**

> The libraries' own documentation and shipped source may be read to author
> their sandbox and capture config. Our capture / promote / emit chain may
> **NOT** be run against them. No output of ours for them may be looked at.
> Nothing may be tuned in response to our pipeline's behaviour. If you find
> yourself wanting to adjust a config because "the capture would do X", stop —
> that is the contamination this exam exists to detect. Author from the
> library's documented mounting recipe as a competent integrator would, then
> stop.

### What WAS run during preparation, and why it is not a violation

Three things, none of them ours:

1. **`npm install` in each sandbox** — the network step every committed round
   also takes.
2. **A mount preview written for this task** (scratchpad, not committed): it
   reads the capture config JSON, mirrors its documented semantics
   (`mount.imports`, `wrapperOpen`/`wrapperClose`, `customElements` tag mounts,
   `fixedProps`, `childrenSpec`, `$import` markers, `blockStage`), bundles with
   the sandbox's own esbuild, and screenshots each mounted component with
   Playwright. **It imports nothing from `extract/computed`.** Its purpose is
   narrow: so that an exam failure can never be blamed on a broken mount.
   Screenshots land in each sandbox's git-ignored `heldout-verify/shots/`.
3. **`loadConfig()`** — the engine's own config *validator*. It reads the
   config, checks the minted-tree and seed-path rules, and runs no capture.

Nothing else. No `extract:computed`, no `promote`, no `figma`, no `bundle`, no
scorecard, no regate, no drift check.

### What was deliberately NOT created

For all three subjects: no `extract/computed/out/<lib>/`, no
`examples/<lib>/contracts/`, no `examples/<lib>/figma/`, no
`examples/<lib>/storybook/`. Each minted tree is a committed **zero-leaf stub**
riding the documented `tokens.mintedBootstrap` allowance (`loadConfig`, task
#28) — these are genuine first-ever passes, and the exam is what fills them.
The moment a tree carries leaves, `loadConfig` refuses the stale allowance by
name and the flag must be deleted.

---

## THE THREE SUBJECTS

| # | subject | pinned | dir | config | components |
|---|---|---|---|---|---|
| 1 | **Radix Themes** | `@radix-ui/themes@3.3.0` | `examples/radix-themes/` | `extract/computed/configs/radix-themes.json` | **10** |
| 2 | **Bootstrap 5** | `bootstrap@5.3.8` | `examples/bootstrap5/` | `extract/computed/configs/bootstrap5.json` | **10** |
| 3 | **react-day-picker** (complex-archetype probe) | `react-day-picker@10.0.1` | `examples/day-picker/` | `extract/computed/configs/day-picker.json` | **1** |

Common to all three: `react@19.2.8`, `react-dom@19.2.8`, `esbuild@0.28.2`;
sandbox dirs `.{radix-themes,bootstrap5,day-picker}-sandbox/`, git-ignored, each
recreated by a copy-pasteable block in its README; **no `fonts` block anywhere**,
because not one of the three ships a webfont (all three use system font stacks,
and all three stylesheets contain zero `url()` references to the network).

### 1 · Radix Themes — 10 components

`Button` · `Badge` · `Checkbox` · `Switch` · `TextField` · `Callout` · `Card` ·
`Avatar` · `Progress` · `Tabs`

Atoms through molecules, every axis value copied verbatim from the shipped
`propDefs`. Mounted through `@radix-themes-sandbox/ui@0.0.1`, a local barrel that
flattens the library's namespaced exports (`TextField.Root` → `TextFieldRoot`)
and adds nothing else — see the finding below. `<Theme>` is mounted with no
props, i.e. the library's shipped defaults.

### 2 · Bootstrap 5 — 10 components

`Button` · `Alert` · `Badge` · `FormControl` · `FormCheck` · `Card` ·
`Progress` · `Spinner` · `NavTabs` · `Modal`

**Bootstrap exports no components at all** — its API is class names plus
documented markup. Every mount is that component's own documented HTML,
expressed through `library.customElements` (the grammar's one tag-name mount),
with the class token riding `axisValueMap`'s `$props.className`. **No React
component was invented.** No JavaScript is loaded: with the docs' JS-free
"static example" modal, none of the ten needs any.

### 3 · react-day-picker — 1 component, the complex archetype

`Calendar` (`DayPicker`) — 93 DOM descendants at its default combo, axes
`captionLayout` × `numberOfMonths` × `showOutsideDays` × `showWeekNumber`.

`examples/day-picker/README.md` §5 states, **before any result exists**, seven
ways a calendar sits outside the proven archetype list of
[docs/23 §C.1.1](../../../docs/23-known-limitations.md#c11-which-component-archetypes-are-proven--the-actionable-cut):
repeated collections instead of an anatomy · state on child cells rather than the
root · a grid whose row count is a function of the date · month duplication at
`numberOfMonths: 2` · an axis that swaps a text caption for native `<select>`s ·
roving focus that a computed-style read cannot see · a clock in the inputs. The
list is there so failures are interpretable rather than surprising.

---

## FINDINGS ALREADY BANKED — things the config grammar cannot express

These came out of authoring alone, with no capture run. They are findings, not
blockers; each subject's README carries the detail.

> **FINDINGS 1–3 ARE NOW CLOSED, BEFORE THE FIRST PASS RUNS.** They were the
> cheap ones, and closing them first is what keeps the exam a measurement of the
> ENGINE rather than of a known gap: a first-pass failure caused by a language
> hole teaches nothing. `importName` now accepts a compound (dotted) export
> name; `axisValueMap` gained `{"$classTokens": […]}`, an ordered append that
> composes where the flat `$props` bag silently dropped an axis; and the marker
> grammar gained `{"$date": "<ISO>"}`. Bootstrap's `btn-sm`/`btn-lg` is
> un-deferred and the day-picker fixtures module is retired. **Nothing about
> the subjects' component selections or axis VALUES was tuned** — the blindness
> rule holds; the language changed, not the answers. The Radix barrel is
> deliberately still in place, because retiring it would change a held-out
> subject's mount. Findings 4–6, and the rest of what the grammar still cannot
> say, are now a gated artifact: [`spec/GRAMMAR-COVERAGE.md`](../../../spec/GRAMMAR-COVERAGE.md)
> (`npm run grammar-coverage:check`).
>
> Finding 7 turned out to have a **third** instance, found by merging this
> branch forward: `scripts/door-census.ts` carried the same un-namespaced
> `?? 'extract/computed/out'` fallback behind a hand-maintained ten-entry map,
> and re-fused first-party `button/`, `badge/` and `spinner/` captures under
> `bootstrap5` and `radix-themes` names. Fixed the same way, and a config with
> no captures is now a named absent subject rather than a re-fuse failure.

1. **`importName` cannot name a compound export.** The harness emits
   `importName` verbatim into `import { … } from '<library.package>'`, so
   `TextField.Root` / `Callout.Root` / `Tabs.Trigger` are unmountable. Three of
   Radix Themes' ten components need the sandbox barrel (shadcn's
   `@shadcn-sandbox/ui` precedent). Cost: `library.package`/`version` then
   describe the barrel, not the subject.
2. **Two class-token axes on one component cannot both be expressed.**
   `comboProps` folds every axis into one flat prop bag and `axisValueMap`'s
   `$props` writes last-writer-wins, so for a class-based library `variant ×
   size` on a Bootstrap Button would mount `className: "btn btn-lg"` and
   **silently drop the variant**. Button therefore ships one axis and
   `btn-sm`/`btn-lg` is deferred by name. An append form (`"className+"`) or an
   ordered class-token axis kind would close it.
3. **The config grammar cannot spell a `Date`.** `$callback` / `$import` /
   `$render` / `$element` — none produces one, and a calendar's whole rendering
   is a function of Dates. Unpinned, the DOM changes at midnight and no two
   captures can be byte-compared. Worked around with a three-literal sandbox
   fixtures module reached through `$import`; a `{"$date": "…"}` marker would
   close it properly.
4. **Child-part axes remain undeclarable (docs/21 §7.3, already known).** New
   instances: Bootstrap's `checked` on `.form-check-input`, the `.progress-bar`
   modifiers, `.nav-link` active/disabled; Radix's `Tabs.List` `size` and
   `TextField.Slot` `side`.
5. **A component with no steady state has no honest geometry.** Bootstrap's
   `.spinner-border` / `.spinner-grow` are infinite keyframe animations; measured
   across separate mounts the grow spinner reads 10 × 10 and then 4 × 4. A "two
   stable samples" probe cannot converge.
6. **`<Theme>` is a real DOM box carrying the whole token scope.** Radix Themes
   declares all 1,091 custom properties on `.radix-themes` and nothing at
   `:root` — the docs/21 §4.2 trap in its purest form, and the reason
   `mount.wrapperOpen` is load-bearing rather than cosmetic here.

7. **A LATENT DEFECT IN TWO OF OUR OWN GATES, found by merely existing.**
   `extract/computed/drift-check.ts` and `extract/computed/ua-baseline-check.ts`
   both resolved a config's capture-output directory with an unconditional
   fallback to the **un-namespaced** `extract/computed/out/`. That directory
   also holds the FIRST-PARTY component dirs — `button/`, `badge/`, `avatar/`,
   `checkbox/`, `textfield/`, `spinner/` — so a brand-new config whose component
   names collide with any of those picked up **another library's captured truth
   and reported it as its own**. Adding three configs that have never been
   captured produced eight confident findings about them:
   `bootstrap5/Button: UNPINNED`, `radix-themes/Avatar: UNPINNED`,
   `radix-themes/Checkbox: base capture missing (surface.2.unchecked.enabled__default)`
   and five more. Nothing was wrong with the configs; the gates were reading
   first-party scorecards under a foreign name.

   Fixed in this change by naming the two configs that legitimately live in the
   root (`polaris`, `polaris-depth`) and giving every other config its
   namespaced dir. Every committed library's resolution is byte-identical — the
   other eight all have a namespaced dir — and a collision is now an ordinary
   named skip instead of a silent misattribution. **This is the exam paying for
   itself before it has run once.**

---

## WHAT WAS VERIFIED BEFORE COMMIT

| check | radix-themes | bootstrap5 | day-picker |
|---|---|---|---|
| components mounting and rendering a root element (default combo) | **10 / 10** | **10 / 10** | **1 / 1** |
| same, at the largest enum combo | **10 / 10** | **10 / 10** | **1 / 1** |
| zero-box roots | 0 | 0 | 0 |
| console errors / React warnings | 0 | 0 | 0 |
| screenshots written (git-ignored sandbox) | ✔ | ✔ | ✔ |
| docs/21 §4.2 bind proof against the library alone | ✔ | ✔ | ✔ |
| DTCG names vs. the browser's computed values | 1091 names · 1066 byte-identical · 15 whitespace · 6 quote-style · **0 value** · 4 empty | 127 names · 101 byte-identical · 23 whitespace · **0 value** · 3 empty | 38 names · 35 byte-identical · 2 whitespace · **0 value** · 1 empty |
| `loadConfig()` accepts the config | ✔ | ✔ | ✔ |
| seed contracts parse under `ContractSchema` | 10 / 10 | 10 / 10 | 1 / 1 |

**21 / 21 seed contracts valid. 21 / 21 mounts render. 0 console errors across
all three subjects.**

---

## THE EXAM — the exact commands to run, once

Run from the repo root, on a clean tree, after `npm run prep:core` and the
`packages/cli` build. **Recreate each sandbox first** from its README block —
the sandboxes are git-ignored and the install is the only network step.

### Option A — the CLI chain (docs/21 §1). This is the first-pass measurement.

```bash
# per subject; <lib> ∈ radix-themes | bootstrap5 | day-picker
npx tsx packages/cli/src/cli.ts onboard examples/<lib>
npx tsx packages/cli/src/cli.ts onboard --continue
```

`onboard <dir>` is the **adopt** path — it is triggered by pointing at a
directory containing `ds-library.json`. There is no `--adopt` flag; passing one
is an "Unknown flag" error. Phase one adopts and prints the review gate; phase
two runs `capture → promote → emit → bundle` (publish is skipped without a
channel key) and **exits 1 if any component was quarantined**, which is the
result, not a failure of the run.

The capture configs committed here carry **no `__unreviewed-draft` marker and no
open `__review:*` fields** — they were authored, not drafted — so the review gate
has nothing to stop on. Do not add markers to make it stop.

### Option B — the hand chain (docs/21 §2), if a stage needs to be run alone

```bash
node examples/<lib>/scripts/build-tokens.mjs

npm run extract:computed -- --harness examples/<lib>/.<lib>-sandbox \
  --config extract/computed/configs/<lib>.json \
  --out extract/computed/out/<lib>

npx tsx packages/cli/src/cli.ts promote --config examples/<lib>/ds-library.json

npx tsx packages/cli/src/cli.ts figma examples/<lib>/contracts \
  --out examples/<lib>/figma \
  --tokens examples/<lib>/tokens/<lib>.dtcg.json,examples/<lib>/tokens/<lib>-minted.dtcg.json

npx tsx packages/cli/src/cli.ts figma bundle examples/<lib>/contracts \
  --tokens examples/<lib>/tokens/<lib>.dtcg.json,examples/<lib>/tokens/<lib>-minted.dtcg.json \
  --name "<Bundle Name>" --out examples/<lib>/figma/<lib>.bundle.json

npm run extract:computed:scorecard -- --dir extract/computed/out/<lib> \
  --config extract/computed/configs/<lib>.json --write
```

`<Bundle Name>` is `Radix Themes`, `Bootstrap 5`, `Day Picker` — the values
already committed in each `ds-library.json`.

### Counting the result

**First-pass success is counted ONCE, on the FIRST run, with nothing touched
between the two `onboard` invocations.** If a config has to be edited to get a
component through, that component did not pass first-pass; record the edit and
the reason rather than re-running and reporting the second number. The
denominators are fixed here in advance:

- **21 components configured** (10 Radix Themes + 10 Bootstrap 5 + 1 calendar).
- Per component, report: **captured / quarantined / stopped**, then
  **recognisable / not** on the emitted surface.
- A quarantine, a refusal and a stop are all *results*. Silence is not.

The nearest precedent for the receipt format is
`parity/receipts/phase-2/ANTD-EXAM.md` (held-out, code→canvas, pass condition
"SILENT = 0"), gated by `npm run exam:screenshots:check`. If exam receipts are
written to `parity/receipts/phase-2/<LIB>-EXAM.md`, that gate applies to them.

---

## Effect on existing gates

`typecheck`, `lint`, `format:check`, `ci:lanes` and `maintain` are untouched by
this change — none of them enumerates `examples/*`, `extract/computed/configs/`
or `contracts-seed/`. All five are green, as are `contracts:migrate:check` and
`eval:registry:check`.

Four existing gates **do** move, and all four are handled in the same commit.
Two carry derived denominators over directories this change adds:

- **`docs:check`** — `scripts/docs-numbers-check.mjs` derives
  `CAPTURE_CONFIGS` from `readdirSync('extract/computed/configs')`, and
  `docs/21-bring-your-own-design-system.md` names that count in prose. 10 → 13.
- **`census:check`** — `extract/figma/census/corpus.ts` enumerates every
  directory under `examples/` and records those without a `contracts/` subdir as
  named exclusions; `parity/receipts/v1/census-manifest.json` and
  `parity/receipts/v1/CANVAS-CENSUS.md` are the committed renderings of that
  list. Three new exclusion rows. The **denominator does not move** — 170 sets,
  unchanged.

  Recording the receipt turned out to be impossible with the documented remedy:
  `--write-receipt` was wired for `--phase design-to-code` only, so on
  `--phase code` the flag did nothing and the gate's own failure message
  ("run `npm run census:check -- --phase code --write-receipt` and commit the
  diff") could not be followed. One line in `scripts/canvas-census-check.ts`
  wires it; check mode still never writes, and the gate's `--self-test` passes.

Two more were reading the wrong directory — see finding 7 above:

- **`extract/computed/drift-check.ts`** and
  **`extract/computed/ua-baseline-check.ts`** — the un-namespaced-root fallback,
  now restricted to the two configs that legitimately use it.

No committed measurement moves, because no capture ran: 116 components still
re-fuse in `ua-baseline`, and `drift` still verifies the same 116 rows.
