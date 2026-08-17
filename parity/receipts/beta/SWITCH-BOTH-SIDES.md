# Switch — both sides, named misses

Recorded 2026-08-16, restamped the same day. Authored
`contracts/switch.contract.json` vs live canvas set on `BMjUA2ue5CaZXU4kufxL0z`
(node `4:618`) vs the inverter output
`switch-proposed/switch.contract.proposed.json`.

This is the North Star hop: a system that has **both**, aligned, gaps named.

Re-apply of `figma-sync/41-switch.js` restamped the live set. Dump is dump
v1.25 from `extract/figma/dump.plugin.js` (Switch-only). Propose used the
first-party token corpus including `brand.default`.

## Aligned (do not relitigate)

| Fact | Authored | Canvas | Proposed |
|---|---|---|---|
| Props | `value` Off/On, `label`, `description` | Value / Label / Description | same three |
| Host | `<label>` | stamp `semantics.element=label` | `<label>` — stamp outranks the name table |
| Track fill | `{color.switch.{value}.track}` | `color/switch/{off\|on}/track` | `{color.switch.{value}.track}` |
| Thumb fill | `{color.switch.thumb}` | `color/switch/thumb` | `{color.switch.thumb}` |
| Spacing / type | `{space.gap.sm}`, `{space.inset-y.xs}`, `{font.control.size.sm}` | bound, not literals | same refs — **nothing minted** |
| Parts | track, thumb, spacers, textCol, labelText, descriptionText | same (spacers swap by value) | same |
| `input` | declared, **not drawn** | absent | absent — correct |

## Closed this restamp

1. **Host.** Stamps were empty; the reader guessed `input`, refused a void
   host, and proposed `<div>`. After re-apply, `propNames` and `semantics`
   are on the set, the dump carries them, and the proposal is `<label>`.
2. **Token identity on spacing/type.** The earlier compact dump dropped
   `bound` names, so propose minted `imported.*`. The real dump + full
   corpus keeps `{space.gap.sm}` / `{space.inset-y.xs}` / `{font.control.*}`.
3. **Report honesty.** The stamp already outranked inference in the
   contract JSON, but the report still narrated the void-`input` → `div`
   guess. `core/propose-figma.ts` now records the stamp note and suppresses
   the guesser note when a stamp is present.

## Named misses (still)

1. **Events.** Authored declares `onToggle` on `input`. Canvas cannot carry
   it. Proposed has **no `events[]`**. Dump → React will not click. Authored
   → React will. Do not invent the handler from the canvas.
2. **Native control.** Authored mounts `input[type=checkbox][role=switch]`
   inside the track. Canvas never draws it. Proposed cannot invent it.
3. **Catalog / script lag.** Authored anchors now point at the live set
   (`4:618` / `1a174ed…`). `catalog/`, `figma-sync/41-switch.js`, and
   visual-parity `subjects.ts` still pin the dead `11:1286` / `7936496…`.
   That is snapshot lag, not a second live set. Do not retarget those
   without a catalog regen.
4. **Root extras the canvas does not carry as root tokens.** Authored root
   has `align: start`, `font-family`, and `color`. Propose omits MIN align
   (inversion rule) and puts color on `labelText`. Not a silent substitution.

## What this means

The **API** and the **host** now match on a stem that exists on both sides.
The **behavior** still does not come back from the canvas. That is the
product rule, measured — not a Flowbite-only story.
