# PATH A — the declared losses in TJ-TEST.md §A7

Branch `feat/font-slant-carry`. Every row measured on the five stems
(Alert, Label, ToggleSwitch, Badge, Button), re-applied to
`59mLQlOMiD5w5za6SUcoO5`, re-dumped, re-proposed, re-generated.

The silent table closed in [PATH-A-SILENT.md](PATH-A-SILENT.md). These were the
rows the report already named — honest, but the generated code was still wrong.

---

## The table

| row | verdict | commit |
|---|---|---|
| D1 token identity remint | **RECOVERED** — `line-height` binds its source token | `fe9249fd` |
| D2 positional part names | **RECOVERED** — names were never lost; the reader renamed them | `6af78646` |
| D3 `semantics.element` → `div` | **RECOVERED** — and Badge was *wrong*, not merely defaulted | `91137a7a` |
| D4 `children` → `content` | **RECOVERED** — Alert only | `bbeeb85a` |
| D5 `checked` stays an ENUM | **NOT A LOSS** — the contract declares the enum | `bbeeb85a` |
| D6 thumb size collapsed | **NAMED** — per-variant geometry, Option B | `bbeeb85a` |

One pattern closed four of them: **where Figma cannot carry a fact natively,
the writer declares it and the reader reads it.** No stamp → the old behaviour,
unchanged, so nothing is ever invented for a set this pipeline did not draw.

---

## D1 · token identity — RECOVERED

Measuring shrank this from a class to two rows. Compared per part and per
channel, only `label root/line-height` was an invention:
`{imported.label.root.line-height}` came back as
`{imported.label.label.line-height}`, a **second name for a token the corpus
already had**. Everything else §A7 counted was already settled — the
`{imported.shared.size-*}` rows are real corpus tokens re-declared in the
minted tree, and the rest were the shorthand and geometry classes.

The cause is S1's defect one channel over: Figma's `lineHeight` takes a value,
not a variable, so the token resolved to a number and the identity was gone.
Stamped (`ds_contracts/lineHeightVar`, dump v1.23) and bound back. Minted
tokens for the five stems drop 35 → 33; Label's CSS now emits
`var(--imported-label-root-line-height)`.

Badge keeps one difference that is **not** an invention:
`{imported.badge.root.font-weight}` → `{imported.badge.label.font-weight}`,
both committed corpus tokens resolving to 600. Badge declares the weight at the
root *and* at its label part; the proposal binds the more specific one. A
cascade declaration site differs; no identity was fabricated.

## D2 · part names — RECOVERED, and §A7 was wrong about where they died

The dump settles it:

```
'part-0' [FRAME] > 'alert-icon' [FRAME] > 'alert-icon-info' [FRAME]
'label' [TEXT] · 'dismiss' [FRAME] > 'dismiss-icon' [FRAME]
```

Those are the contract's own names — including `part-0`, which §A7 read as a
positional placeholder the reader had invented. Nothing was lost on the canvas.
One line in `partKey` renamed them: it kept a name only if it matched
`/^[A-Za-z][A-Za-z0-9]*$/`, so every hyphen failed and cameled to `alertIcon` /
`part0`. Its own comment promised "a name that is already a legal identifier
keeps its spelling" — it measured legality with the wrong ruler. Contract part
names are `z.record(z.string(), …)`, and this repo writes them in kebab.

Hyphens now keep their spelling. Safe everywhere a part key lands: CSS takes a
hyphen natively and `emit-react` already spells a non-identifier class as
`styles["alert-icon"]`. Unsafe punctuation still falls through unchanged.

Still different, and **not** renames: the proposal carries extra parts the
contract abstracts away (the icons' inner `Vector` nodes, `dismiss-icon`) plus
the synthetic `labelmarginBox` already named in S3.

## D3 · semantics.element — RECOVERED, and it was inventing

Worse than "collapses to div":

```
label         label  -> div      lost
toggleswitch  button -> div      lost
badge         span   -> button   WRONG
```

Badge is a `span` whose only crime is carrying hover and active variants, and
the structural rule reads an interaction-state axis as "interactive". A missing
element is a gap; a wrong element changes what the component *is*.

Figma draws no element, role or ARIA, so the inference was the only thing
available — until the contract's own `semantics` is stamped
(`ds_contracts/semantics`, dump v1.24). All five now match, and it reaches the
code: **Label is a `<label>`, ToggleSwitch a `<button>`, Badge a `<span>`.**
TJ-TEST.md's "the generated ToggleSwitch is a `<div>`" no longer holds.

## D4 · children → content — RECOVERED (Alert only)

Label, Badge and Button already returned `children`; Alert's text node is a
named part inside `part-0` and fell through to canonicalising the design
property. The reader was right to refuse to rename on a convention — renaming
mechanically would break design-property fidelity. It now reads the contract's
own map instead (`ds_contracts/propNames`, dump v1.25):

```
"Content": "children"
```

**A regression this caused, caught by the emitter.** Renaming the prop left the
anatomy binding `content`, and generate refused: *part "label" binds content to
unknown text prop "content"*. The rule had two implementations — the binding
re-derived the name under a comment promising it used the same one. Both now
call one `textPropName()`. An unemittable contract was refused, not shipped.

## D5 · checked stays an ENUM — NOT A LOSS

The premise was wrong. The **source contract** declares
`{"enum": ["unchecked", "checked"]}`, so the proposal is faithful and the
generated `checked?: 'unchecked' | 'checked'` is that contract rendered
correctly. Promoting it to boolean would contradict the contract and the gated
decision `checked-axis-projection` pins ("`checked` is a VARIANT AXIS on both
libraries"). Changing it would be the regression.

## D6 · thumb size — NAMED

Real. The contract carries a per-variant map (`literalsByProp` on `sizing`:
sm 16×16, md 20×20, lg 24×24); the proposal's `shape` carrier holds one size
and takes the first, so two of three variants come back wrong. The report names
it with the numbers: *"shape size differs across variants (20×20, 16×16, 24×24)
— the first variant's 20×20 carried; review"*.

Closing it means reading per-variant geometry back, which Option B /
`FC-GEOMETRY-EXCLUDED` forbids. Named, not climbed.

---

## Not in scope, deliberately

Kit coverage, token-plane climbs, a seventh library. The two Figma-side rows
that remain open are D6 and the S3/S4 geometry rows — all the same wall, and
all named.

## Named, pre-existing, NOT caused here

- **`dagger:census` drift, 100 → 73 across 35 rows.** Baseline recorded at
  `7510916c`, before the 8-stem kit landed in `8afae937`. Unchanged at 73
  through every commit here and deliberately **not** re-recorded — that would
  launder pre-existing drift under this wave.
- **`mui-figma-genesis`** — red, `switch-track(medium) pin: expected 34x14,
  found 1x1`; one of the two named reds from the 223/225 baseline.
- **`npm run typecheck`** — `console-loop-alpha-composite-probe.mts:34`.
- **`docs:check`** — one failure, the "N/N pass" guard on a 223/225 record.
