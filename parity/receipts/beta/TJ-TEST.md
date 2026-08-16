# TJ-TEST — both journeys, RUN

**This is a receipt, not a chore list.** Every command below was executed by the
agent on `feat/font-slant-carry` @ `14cb856b` on 2026-08-15. Exit codes, file
keys, node ids and output paths are what the run actually returned. Nothing
here is a plan and nothing here is waiting on the owner.

Engine stamp for the whole run: `eb0fafe60c07 · 705433B` (the receipt
re-recorded in `14cb856b`).

---

## PATH B — code → canvas (Flowbite, 8 shipped stems)

### B1 · build the plugin — exit 0

```
$ npm run plugin:zip
plugin-zip: wrote playground/public/ds-contracts-sync-runner-plugin.zip
            (4 files, 928274 bytes; engine bundle 0.67 MB minified)
            — dump script verified, engine receipt verified
plugin-zip: refreshed figma-sync/plugin-dist — stamp "engine eb0fafe60c07 · 705433B"
EXIT=0
```

### B2 · build the bundle — exit 0

The exact command from `docs/BETA.md`, flags unchanged:

```
$ npx tsx packages/cli/src/cli.ts figma bundle examples/tailwind/contracts \
    --out flowbite.bundle.json \
    --tokens examples/tailwind/tokens/tailwind.dtcg.json,examples/tailwind/tokens/tailwind-minted.dtcg.json \
    --icons examples/tailwind/assets/icons
✔ Bundle written: flowbite.bundle.json — 8 contract(s) + tokenSet "Tokens"
  (68 base tokens, minted tree, 5 icon asset(s); 108497 bytes)
EXIT=0
```

| | |
|---|---|
| **bundle sha256** | `af0a5dee245f036cacbb559a7273ace989634047190bf4c1b162fe6081f09c09` |
| **bundle bytes** | 108,557 on disk |
| **contracts** | 8 |

### B3 · apply to canvas — 8 sets, 91 variants, 331 variables

**Target file: `59mLQlOMiD5w5za6SUcoO5` ("MUI Test 1"), NOT the requested
`Y8Jhw6R49wTLuXZ0is2GmV`.** This is a deliberate, named deviation — see
*Wall 1* below. Nothing pre-existing was rebuilt: the file went from 31 pages
to 39, all eight are new.

Transport: the repo's own console-loop stem server, because the Desktop Bridge
occupies the single plugin slot and the Sync Runner's Build tab is therefore
unreachable. The conversion is unchanged — the scripts are the engine's own
emitted output, and the tokens script comes from the engine's own
`emitTokenSetScript()`, the same function the plugin calls on a pasted bundle.

```
$ npx tsx packages/cli/src/cli.ts figma examples/tailwind/contracts \
    --out /tmp/fbscripts --tokens <same two> --icons examples/tailwind/assets/icons \
    --file-key 59mLQlOMiD5w5za6SUcoO5
✔ Emitted 8 Figma sync script(s)                                    EXIT=0
$ node scripts/console-loop-stem-serve.mjs 9231 /tmp/fbscripts
```

Then, per the pattern documented in `scripts/console-loop-stem-serve.mjs`,
each script was fetched and evaluated through `figma_execute`.

Tokens first: `{ created: 331, updated: 0, aliased: 25, total: 331 }` into one
`Tokens` collection with `Light` / `Dark` modes.

| page (new) | set | type | variants | props | node id |
|---|---|---|---|---|---|
| `Alert (flowbite.alert)` | Alert | COMPONENT_SET | 4 | 4 | `120:1979` |
| `Badge (flowbite.badge)` | Badge | COMPONENT_SET | 24 | 4 | `120:2098` |
| `Button (flowbite.button)` | Button | COMPONENT_SET | 45 | 4 | `120:2203` |
| `Card (flowbite.card)` | Card | COMPONENT | 1 | 1 | `120:1999` |
| `HelperText` | HelperText | COMPONENT_SET | 5 | 2 | `120:2014` |
| `Kbd` | Kbd | COMPONENT | 1 | 1 | `120:1982` |
| `Label` | Label | COMPONENT_SET | 5 | 2 | `120:1996` |
| `ToggleSwitch` | ToggleSwitch | COMPONENT_SET | 6 | 3 | `120:2047` |
| **total** | **8 sets** | | **91** | | |

Four page names collided with existing MUI pages and the engine disambiguated
them to `(flowbite.*)` rather than touching the MUI ones — the "foreign
same-named node is never adopted" rule, working.

Screenshots taken and read: Button `120:2203` (45 variants, five colour rows,
size and state columns) and Badge `120:2098` (six colours × four). Both render
as recognisable Flowbite.

**Determinism, cross-file:** the variant counts here (4/24/45/1/5/1/5/6 = 91)
are identical to the same eight stems already standing on
`Y8Jhw6R49wTLuXZ0is2GmV`. Same contracts, different file, same canvas.

---

## PATH A — canvas → code

Read from `Y8Jhw6R49wTLuXZ0is2GmV` as asked. Read-only; nothing on that file
was written at any point.

### A5 · dump — the real verb

`extract/figma/dump.plugin.js` (dump v1.20) served unmodified through the same
stem server and evaluated in the file; the result POSTed back to the server's
`/json/` receiver, which exists for exactly this.

```
sets captured : Badge, Card          → /tmp/fbscripts/y8jhw-dump.json (37,211 bytes)
```

`TARGET_SETS` at `dump.plugin.js:153` already lists `Badge`, so **Badge — one
of the two sets you named — was the first target.**

### A5b · propose — REFUSED on Badge, twice

```
$ npm run extract:figma -- /tmp/fbscripts/y8jhw-dump.json --out /tmp/pathA --tokens <two>
REFUSED: 1 component set(s) could not be proposed; no proposal artifacts were written.
  - Badge: Set "Badge" could not be proposed:
    Source matrix has 24 rows; Cartesian definitions require 36.
EXIT=2
```

Re-run with `--reviewable-inversion` — the flag that advertises a relaxed
projection mode — gives the **same refusal, same exit 2**. See *Wall 2*.

### A5c · propose — green on the Cartesian-complete stems

```
$ npm run extract:figma -- /tmp/fbscripts/y8jhw-dump-b.json --out /tmp/pathA --tokens <two>
✔ Alert        → alert.contract.proposed.json         (31 notes, 0 unbound)
✔ ToggleSwitch → toggle-switch.contract.proposed.json (20 notes, 0 unbound)
✔ Label        → label.contract.proposed.json         ( 5 notes, 0 unbound)
✔ minted token tree (16 tokens, provisional names) → minted.dtcg.json
✔ report → /tmp/pathA/figma-proposals.md
EXIT=0
```

### A6 · generate — exit 0, 13 files exist

```
$ npx tsx packages/cli/src/cli.ts generate \
    /tmp/pathA/{alert,toggle-switch,label}.contract.proposed.json \
    --target react --out /tmp/pathA/generated --stories \
    --tokens <two>,/tmp/pathA/minted.dtcg.json
✔ Generated 3 component(s): Alert, Label, ToggleSwitch                EXIT=0
```

```
/tmp/pathA/generated/index.ts
/tmp/pathA/generated/Alert/{Alert.tsx, Alert.module.css, Alert.stories.tsx, index.ts}
/tmp/pathA/generated/Label/{Label.tsx, Label.module.css, Label.stories.tsx, index.ts}
/tmp/pathA/generated/ToggleSwitch/{ToggleSwitch.tsx, ToggleSwitch.module.css, ToggleSwitch.stories.tsx, index.ts}
```

Typed React, CSS Modules, `@storybook/react-vite` stories, `forwardRef`, no
model anywhere in the path.

---

## A7 · every loss, named

Measured by diffing each proposal against the committed contract the canvas was
generated from, comparing by **effective value across all parts** with
shorthands expanded — not by spelling. (Spelling normalisation is NOT loss:
Alert's four radius longhands legitimately return as one `border-radius`,
`row-gap`+`column-gap` as `gap`, four paddings as `padding-inline`/`-block`.
Enum order also changed on Label and is not semantic.)

### Silent — no note in the proposal report

| contract | channel | what happened |
|---|---|---|
| toggleswitch | `margin-left`, `margin-top` | gone; the drawn box came back as absolute placement instead |
| toggleswitch | `bottom` | gone (only `left`/`right`/`top` were re-derived) |
| toggleswitch | `font-weight` | gone |
| label | `font-weight` | gone |
| label | `width` | gone — the HUG note covers `height`, not this |

### Declared, but still a loss

- **Token identity is destroyed even when the value survives.** Real system
  refs come back as machine-minted provisional names: `{imported.shared.size-0}`
  → `{imported.toggle-switch.label-margin-box-label.left}`,
  `{imported.label.root.line-height}` → `{imported.label.label.line-height}`,
  `{imported.alert.label.font-weight}` → `{imported.alert.part-0-label.font-weight}`.
  16 provisional tokens were minted this run. The value renders; the binding no
  longer points at the design system.
- **`semantics.element` collapses to `div`.** Label is `label` in the contract
  and `div` in the proposal — "element/role/ARIA are not drawn on the canvas".
  The generated `ToggleSwitch` is therefore a `<div>`, not an input.
- **Main-content prop renamed.** Alert's `children` returns as `content`; the
  report suggests re-binding by hand.
- **`checked` stays a two-value ENUM**, not a boolean — generated as
  `checked?: 'unchecked' | 'checked'`.
- **Part names are positional.** `part-0`, `part-0-after`, `label (margin box)`
  — the contract's names did not survive the canvas.
- **Shape size collapsed across variants.** ToggleSwitch's thumb is 20×20,
  16×16 and 24×24 across sizes; the first variant's 20×20 carried for all.

---

## Walls hit

### Wall 1 — a fresh apply cannot land on `Y8Jhw6R49wTLuXZ0is2GmV`

All eight Flowbite stems already stand there, each carrying its
`ds_contracts.contractId` marker. `syncOne` in `core/emit-figma-script.ts:6908`
resolves that marker and amends **in place** (`:6918`, `:6926`); a page is only
created when nothing matches (`:6944`). There is no target-page option. So on
that file "apply the bundle" necessarily means *rewrite those eight pages* —
and because this branch adds `font-style` and `clipsContent`, the amend would
have mutated them. That collides with "New pages only. Do not rebuild existing
pages", so the apply went to the one listed file with zero flowbite marks.
`GnQnjSNBXtgtd2Ht0Hs1C8` was rejected for the same reason: 5 of the 8 already
live there.

**Not fixed.** Giving the engine a target-page override contradicts its own
documented one-page-per-component layout and is a design change, not a receipt.

### Wall 2 — Path A cannot invert either set you named

`EXACT_MATRIX_RAGGED`, `core/exact-projection.ts:411`. Exact projection requires
a complete Cartesian matrix, and the forward generator emits interaction states
**sparsely** — only at the base size:

| set | axes | Cartesian | actually drawn |
|---|---|---|---|
| Badge | Color 6 × Size 2 × State 3 | 36 | **24** |
| Button | Color 5 × Size 5 × State 5 | 125 | **45** |

Badge is 12 default rows + 6 active + 6 hover, all states at `Size=Xs` only.
So a set this repo's own emitter produced cannot be re-proposed by its own
inverter — and **Badge and Button are the only two ragged Flowbite stems,
precisely because they are the only two with a State axis.** The other six
invert cleanly.

**Not fixed, deliberately.** The two available moves are to make the generator
emit a full Cartesian (changes what lands on every canvas) or to teach the
inverter the generator's sparse-state rule. The third — relaxing
`EXACT_MATRIX_RAGGED` — would make "exact" projection tolerate a matrix that
is not exact, which is weakening the gate to manufacture a pass. The refusal is
correct and was left standing.

---

## Residual

1. **`59mLQlOMiD5w5za6SUcoO5` now carries 8 Flowbite pages and a 331-variable
   `Tokens` collection** that were not there before. Additive only; no MUI page
   or variable was touched. Delete the eight `flowbite.*`-marked pages to revert.
2. Path B was proven on a file other than the one requested (Wall 1).
3. Path A was proven end-to-end on ToggleSwitch / Alert / Label, **not** on
   Badge or Button (Wall 2). Badge's refusal is itself recorded above.
4. The `version` marker is unset on all eight applied sets — the emitted
   per-component scripts do not stamp `ds_contracts.version`; the bundle/plugin
   path does it in a follow-up step that the console transport skipped.
5. No full suite was run this wave. `evals/results.json` still records the main
   run (223/225) and is untouched.
6. Not merged, not pushed. `.agents/mailbox/` remains untracked.

---

## ADDENDUM 2026-08-16 — both walls above are now CLOSED

The two walls this receipt named were product holes, not notes. They were
closed after it was written; the run above is left exactly as it happened.

**Wall 2 (Path A could not invert Badge or Button) — closed in `8f879e14`.**
`State` is a Figma-surface projection of the contract's `states`, not a prop,
and the emitter draws it SPARSELY: the base grid at `State=Default` plus one
row per state per primary-axis value, every other axis pinned. Demanding a
Cartesian was the reader asserting a shape the writer never claimed. The
emitter now stamps `ds_contracts/statePreviewAxis` (the matrix it actually
drew), dump v1.21 carries it, and exact-projection derives its expectation from
that declaration — still requiring exact equality. `EXACT_MATRIX_RAGGED` was
not weakened: a dropped row, an extra row, a wrong primary, a wrong pin, a
malformed marker and an absent marker all still refuse.

A second wall sat directly behind it and was closed in the same commit:
`EXACT_SEMANTIC_PROJECTION_AMBIGUOUS` refused to promote the State axis at all.
That refusal is right when the reader is guessing; it is not right when the set
declares the axis itself. It now stands unless the descriptor names that exact
axis.

Re-run on sets applied for this purpose: Badge and Button both
`propose` **exit 0** and `generate --target react --stories` **exit 0** (9
files). Badge's proposed props are the source contract's props exactly.

**Wall 1 (no non-destructive apply) — closed in `6bb874cb`.**
`globalThis.DS_CREATE_ONLY = true` makes an already-identified set refuse by
name instead of amending, while fresh stems still create. No second identity
scheme — the same `resolveComponentIdentity` decides. Proven on
`GnQnjSNBXtgtd2Ht0Hs1C8`: Badge refused with node `1:2149` byte-identical
afterwards, Label created on a new page, 99 → 100 pages.

`Y8Jhw6R49wTLuXZ0is2GmV` was still never written to.

**What did NOT change.** The losses in A7 are unchanged and still real —
`font-weight`, `width`, `margin-*` and `bottom` still do not survive the round
trip, token identity is still destroyed where a value is re-minted, and
`semantics.element` still collapses to `div`. Closing the two walls made the
journey RUN on the stems it used to refuse; it did not make the inversion
lossless.

---

## ADDENDUM 2026-08-16 (2) — the §A7 SILENT table is closed

Each silent row above, re-measured on stems re-applied and re-dumped for the
purpose. Full working in [PATH-A-SILENT.md](PATH-A-SILENT.md).

| §A7 silent row | verdict | commit |
|---|---|---|
| `font-weight` — label, toggleswitch | **RECOVERED** with the original token, not a mint | `089ec010` |
| `width` — label | **NOT A LOSS** — carried as `max-width` with the same token; the §A7 row was a measurement error, now receipted in the run | the S2/S3/S4 commit |
| `margin-left`, `margin-top` — toggleswitch | **NAMED** — lowered into a `(margin box)` and read back as geometry; Option B, `FC-GEOMETRY-EXCLUDED` | the S2/S3/S4 commit |
| `bottom` — toggleswitch | **NAMED**, and inert: all four insets are 0px under `position: relative`, so nothing renders differently either way | the S2/S3/S4 commit |

Two corrections to what §A7 claimed:

- **`width` was never lost.** The diff that produced §A7 compared channel
  NAMES, so a deliberate `width` → `max-width` translation carrying the same
  token read as one loss plus one invention.
- **`bottom` is one of four, and inert.** §A7 said "only left/right/top
  re-derived". In fact `part-0`'s whole inset quartet is absent, and correctly
  so — 0px relative offsets draw nothing.

What did NOT change: every DECLARED loss in §A7 stands untouched — token
identity is still re-minted where a value is re-minted, `semantics.element`
still collapses to `div`, `children` still returns as `content`, `checked` is
still an ENUM, part names are still positional, and the thumb's per-size
20/16/24 still collapses. Those were named then and are named now; they are the
next round, not this one.
