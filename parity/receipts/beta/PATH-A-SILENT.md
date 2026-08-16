# PATH A — the silent losses in TJ-TEST.md §A7

Branch `feat/font-slant-carry`. Every row below was measured, not assumed:
each stem was re-applied to `59mLQlOMiD5w5za6SUcoO5`, re-dumped through the
committed dump script, and re-proposed.

The bar for this round was the one the closure gate already sets: **nothing is
lost SILENTLY** — never "nothing is lost".

---

## The table

| row | verdict | commit |
|---|---|---|
| S1 `font-weight` — Label, ToggleSwitch | **RECOVERED**, with the original token | `089ec010` |
| S2 `width` — Label | **NOT A LOSS** — recovered as `max-width`; now named | this commit |
| S3 `margin-left`, `margin-top` — ToggleSwitch | **NAMED** — lowered to geometry, Option B | this commit |
| S4 `bottom` (inset quartet) — ToggleSwitch | **NAMED**, and inert | this commit |

---

## S1 · font-weight — RECOVERED

Not a reader bug. It died at **emit**: `emit-figma-script.ts` resolved a
contract's weight token to a face name and threw the identity away, because
Figma has no bindable font-weight field the way it has one for font size. The
node kept only `"Medium"`, and the reader then dropped `Medium` as "the runtime
default".

That premise was half true. The canvas genuinely cannot tell a declared 500
from a default — but `Medium` is **not** "no weight": Label and ToggleSwitch
both bind `{font-weight-medium}` = 500 as a real token. Alert, declaring 400,
got a note and a mint; these two got nothing. The rule was reading a writer's
omission out of a fact the writer never wrote down.

The emitter now stamps the token (`ds_contracts/fontWeightVar`), dump v1.22
carries it, and the reader binds it back — read centrally in `mintTextChannels`
so the answer no longer depends on which identity carrier the node happened to
use. Verified on four stems, source token vs proposed token:

```
label         {imported.label.root.font-weight}           → same
toggleswitch  {imported.toggle-switch.label.font-weight}  → same
badge         {imported.badge.label.font-weight}          → same
button        {imported.button.root.font-weight}          → same
```

Not "a 500 that renders the same" — the contract's own token, reaching the
generated CSS as `var(--imported-label-root-font-weight)`. No stamp still
proposes nothing, so nothing is invented for a set this pipeline did not draw.

## S2 · width — NOT A LOSS, and my §A7 row was wrong

The proposal carries `max-width: {imported.label.root.width}` — the **same
token**, deliberately translated, because a component's outer size is
fluid-up-to in code while the canvas can only draw the max
(`propose-figma.ts`, `carry(isRoot ? 'max-width' : 'width', …)`).

Nothing was ever dropped. §A7 counted it as a loss because the diff compared
channel *names* and saw `width` missing and `max-width` invented — the same
mistake that first miscounted the shorthand cases. The translation is now
receipted in the run, so the next reader cannot repeat it.

## S3 · margin-left, margin-top — NAMED

Real, and not recoverable. Auto-layout has no per-child margin, so the emitter
lowers a child's margins into a `(margin box)` wrapper and places the child at
`(left, top)`. What arrives on the canvas is a rectangle; the CSS that produced
it is gone. A bound inset quartet draws the *same* rectangle, so the two are
indistinguishable by construction.

Option B is locked and geometry is not read back
(`FC-GEOMETRY-EXCLUDED`), so this is named rather than closed. The proposal's
absolute-placement note previously described only what **was** carried; it now
also states what cannot be, by name:

> the CSS that PRODUCED this box is not recoverable from it — a child's
> `margin-*` … and a bound inset quartet … both draw as the same absolute
> rectangle. Those channels are NAMED here and NOT carried.

Fires on `ToggleSwitch:root/label (margin box)/label`, the exact folded part.

## S4 · bottom — NAMED, and inert

`part-0` binds all four insets to `{imported.shared.size-0}` = **0px** under
`position: relative`. Relative offsets of zero shift nothing, so this pair of
facts renders identically with or without them: **there is no visual loss
here.** (The `position: relative` itself does matter — it is the containing
block for the absolutely-placed thumb — and it is already carried as an
`annotate` channel.)

The defect was still real on the write side. `top/right/bottom/left` are marked
`canvas: 'draw'` and lowered only by the absolute / inset-overlay /
full-bleed-scrim paths. Bind one on an in-flow box and **no path claims it**,
so it fell through the emitter's default branch and vanished with no receipt —
the exact class that branch's SILENT-LOSS round was built to end, with one half
left open. It now names the drop instead of skipping it.

**Be precise about what that buys.** `channelMiss` is stripped before the spec
is emitted (component descriptions are one caption line by owner directive), so
the only durable signal is the `†` dagger, which these stems already carried.
The emitter no longer skips silently, but no new machine-readable receipt
appears. Saying otherwise would be the overclaim this file exists to avoid.

---

## Still open — declared losses, deliberately out of scope

Named in the report already, so honest, and untouched here: token-identity
remint where a value is re-minted under a new provisional name,
`semantics.element` collapsing to `div`, `children` → `content`, `checked`
staying an ENUM, positional `part-0` names, and the thumb's per-size 20/16/24
collapsing to the first variant. Those are the next round.

## Named, pre-existing, NOT caused here

- **`dagger:census` drift — 35 changes, 100 → 73.** The committed baseline was
  last recorded at `7510916c` (the shadcn round), *before* the 8-stem kit
  landed in `8afae937`. The tailwind `helpertext`/`kbd`/`label` 0 → 1 rows are
  those three new stems; the MUI 1 → 0 rows predate this session. Verified the
  `†` marker is unchanged in MUI's emitted scripts at `c3e22f14`, `8ee66ac8`
  and HEAD, so no commit here moved it. It is **not** re-recorded: re-recording
  would launder 35 pre-existing changes under this wave's name, which is
  exactly what that gate exists to prevent. `npm run dagger:census -- --update`
  is a deliberate owner action.
- **`mui-figma-genesis`** — red, `switch-track(medium) pin: expected 34x14,
  found 1x1`. Byte-identical failure at committed HEAD with this wave's changes
  stashed. One of the two named reds from the 223/225 baseline.
- **`npm run typecheck`** — fails on
  `scripts/console-loop-alpha-composite-probe.mts:34`. Verified red on a clean
  stash before any change this session.
- **`docs:check`** — one failure, the "N/N pass" guard firing on a 223/225
  record. Correct, and not softened.
