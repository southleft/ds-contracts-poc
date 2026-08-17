# Switch — both sides, named misses

Recorded 2026-08-16. Authored `contracts/switch.contract.json` vs live canvas
set on `BMjUA2ue5CaZXU4kufxL0z` (node `4:618`) vs the inverter output
`switch-proposed/switch.contract.proposed.json`.

This is the North Star hop: a system that has **both**, aligned, gaps named.

## Aligned (do not relitigate)

| Fact | Authored | Canvas | Proposed |
|---|---|---|---|
| Props | `value` Off/On, `label`, `description` | Value / Label / Description | same three |
| Track fill | `{color.switch.{value}.track}` | `color/switch/{off\|on}/track` | `{color.switch.{value}.track}` |
| Thumb fill | `{color.switch.thumb}` | `color/switch/thumb` | `{color.switch.thumb}` |
| Parts | track, thumb, spacerStart/End, textCol, labelText, descriptionText | same (spacers swap by value) | same |
| `input` | declared, **not drawn** | absent | absent — correct |

## Named misses

1. **Events.** Authored declares `onToggle` on `input`. Canvas cannot carry it. Proposed has **no `events[]`**. Dump → React will not click. Authored → React will.
2. **Host element.** Authored is `<label>`. Plugin stamps (`semantics`, `propNames`) were **empty** on this set, so the reader guessed `input` from the name table, refused a void host with children, and proposed **`<div>`**. The canvas does not remember it is a label.
3. **Native control.** Authored mounts `input[type=checkbox][role=switch]` inside the track. Canvas never draws it. Proposed cannot invent it.
4. **Token identity on spacing/type.** Gap `8`, padding `2`, font 14/500/400 came back as **minted** `imported.*` leaves even though the canvas binds `space/gap/sm` and `space/inset-y/xs`. The inverter saw the resolved px and minted instead of keeping the bound name. Authored still says `{space.gap.sm}` / `{font.control.size.sm}`.
5. **Identity drift.** Authored anchors `nodeId: 11:1286` / key `7936496…`. Live set is `4:618` / `1a174ed…`. This file was redrawn; the contract still points at a dead node.
6. **Stamps missing.** `propNames`, `semantics`, `statePreviewAxis` are null on the live set. Path A recovery is flying blind on host and prop names. Re-apply from the authored contract would restamp them.

## What this means

The **API** (props + Figma property kinds) already matches. The **behavior** and the **host** do not come back from the canvas. That is the product rule, measured on a stem that exists on both sides — not a Flowbite-only story.

Next on this file: re-apply Switch from the authored contract so the stamps return, then dump again. The event gap will remain. The host-guess and minted-spacing gaps should close.
