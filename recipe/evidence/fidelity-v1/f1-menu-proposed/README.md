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

## What menu@1 does not carry

- **A panel minimum width.** Chakra's content panel is `min-width: 8rem`;
  the canvas hugs its two labels at 76px against 128 rendered. A
  `panel.minWidth` leaf would close it; named, not spelled.
- **The panel's shadow.** Refused by name on both modules (`shadowRefusal`).
