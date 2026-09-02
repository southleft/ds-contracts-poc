# F1 · alert@1 proposed from captures — MUI and AntD from their own, Chakra held out

**2026-09-02.** The tenth archetype with a proposer
(`recipe/fixture-reader/schema-alert.ts`, `draft-roles.ts#draftAlertRoles`,
`propose-alert.ts`; `npm run recipe:point -- --archetype alert --library <lib>
--set icon.viewBox=<size | x y w h> --why '…'`). Minted as alert v9 (page
`219:92824`, six sources) through the shared writer runtime; scored
width-normalised against the real render, exactly as the hand rows are.

| library | reviewed | manifest row | score |
|---|---|---|---|
| mui (own capture) | `icon.viewBox` = 24 (SvgIcon.js) | `alert/mui-proposed` | **3.99%** (the hand row: 3.95%) |
| antd (own capture) | `icon.viewBox` = 64 64 896 896 (@ant-design/icons-svg) | `alert/antd-proposed` | **3.35%** = the hand row |
| chakra (HELD OUT, captured today) | `icon.viewBox` = 24 (components/icons.js) | `alert/chakra` | **3.03%** |

Every proposal reads 39 leaves, reviews one, invents none.

## The glyphs are the capture's own

The four status icons are read from the ledger: each path's computed `d`
(Chromium's absolute normalisation of the package's path, in the package's
own units) and its `fill-rule`. The hand tables had cited the same paths
from the capture's asset files. What no computed channel carries is the
package's **viewBox** — the asset the capture writes carries the *rendered*
size there (`recipe/fixtures/capture-glyph.ts` says so) — so it is the one
reviewed leaf, given with a citation to the package file, the same
discipline as checkbox@1's glyph file. The compile then scales the viewBox
onto `icon.size` and refuses a glyph that is not centred in its viewport;
all twelve glyphs (three libraries × four statuses) compiled to a fixed
point.

## What the drafter decided

- **The icon-bearing cell.** AntD's declared base cell is `showIcon=false`
  (`info.noIcon.off.off`), which has no svg. Among the cells that share the
  base's other tokens, the drafter takes the nearest pattern (fewest tokens
  changed) whose svg paint *changes across the four statuses* — the status
  icon, not the close button: `info.icon.off.off`, the cell the hand table
  had reviewed.
- **The icon's wrapper.** MUI dims the icon on its wrapper div (opacity 0.9),
  not the svg; the schema reads svg × wrapper opacity.
- **The gap.** Box column-gap + icon-wrapper margin-right + title margin-left
  (MUI carries it on the wrapper's margin, Chakra on the box's gap).
- **The height.** The box's border-box height with the one-line title, as
  captured (MUI's 48.016 vs the hand table's reviewed 48).

## The person's step

Chakra's Alert was captured from a seed contract and a config entry a
person wrote: `AlertRoot ⊃ (AlertIndicator, AlertContent ⊃ AlertTitle)`,
`status` enumerating alert@1's four values (Chakra's `neutral` held out by
name). `AlertIndicator` renders the package's own status icons, which is
why the glyphs could be read rather than cited.
