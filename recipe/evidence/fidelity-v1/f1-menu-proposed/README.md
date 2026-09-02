# F1 · menu@1 proposed from captures — MUI from its own, Chakra held out

**2026-09-02.** The twelfth archetype with a proposer
(`recipe/fixture-reader/schema-menu.ts`, `draft-roles.ts#draftMenuRoles`,
`propose-menu.ts`; `npm run recipe:point -- --archetype menu --library <lib>`).
Minted as menu v7 (page `228:93939`, five sources); scored against
references cropped to the paper's rendered rect, the box the portal capture
records beside its screenshot.

| library | reviewed | manifest row | score |
|---|---|---|---|
| mui (own capture, two items) | none (14 read, 0 invented) | `menu/mui-proposed` | **4.73%** |
| chakra (HELD OUT, captured today) | none (14 read, 0 invented) | `menu/chakra` | 5.64%, named real-defect (no `panel.minWidth` leaf; shadow refused) |
| the hand row `menu/mui` | — | `menu/mui` | 6.79%, named content mismatch (Item One / Item Two; panel.padding 0) |

## The person's step

menu@1 draws exactly two items. MUI's config entry mounted three, which is
what the first scored row (5.46%) was named against; the entry now mounts
two, the archetype's shape, so a proposal read from it is scored against a
reference of the same shape. Chakra's Menu was captured from a new entry:
`MenuRoot(open) ⊃ MenuTrigger + Portal ⊃ MenuPositioner ⊃ MenuContent ⊃ two
MenuItems`, the Portal keeping the positioner out of the stage as the
Tooltip entry does. The legacy contract path quarantines that capture (two
unregistered channels); the screenshot and the rect sidecar survive it.

## What the schema reads that the hand table reviewed

- **The panel's inset** is the paper's padding plus the list's: MUI keeps 0 on
  the paper and 8 on the list, and the hand table spelled 0, which is why
  its row is a third shorter than the render. The proposal reads 8.
- **The item's minimum height** is its `min-height` when it is a length and
  0 when `auto` (the item then hugs label + padding, 24 + 6 × 2 = 36, which is
  what MUI renders).
- **The content** is the first two text-carrying siblings' texts.
- **The panel's minimum width** (added the same evening, menu v8) is its
  `min-width` when it is a length and 0 when `auto`: Chakra reads 128 (8rem),
  MUI's paper 16 (Popover paper), and the hand tables cite their sources
  (AntD none; Astryx `anchor-size(width)` is receipted as not a length).

## What menu@1 does not carry

- **The panel's shadow.** Refused by name on both modules (`shadowRefusal`).

## menu v8 (229:94381) — the panel min-width leaf, and what the residual is

After the leaf, Chakra's canvas panel is 128×76 like the reference, and the
glyph ink sits at the same pixels ((15,16)-(91,61) real, (15,16)-(90,61)
canvas). The score did not move (5.64%) because the scorer trims to ink and
a white panel over white has none: the reference's ink box is the panel (its
refused `0 0 1px` shadow ring is ink), the canvas's is the text. With that
ring simulated as a 1px stroke the boxes align and the difference is
glyph-shaped everywhere at 6.67% — canvas ink 10.5% against 6.8% real:
Figma rasterises Inter 14px heavier than Chromium. The row is reclassified
**font-substrate**, the class tooltip/chakra and link/chakra already carry;
the geometry defect is closed and the shadow stays a named refusal.

    menu/mui-proposed 4.73% · menu/chakra 5.64% (font-substrate) · menu/mui 6.79% (content mismatch)

