# F1 · badge@1 proposed from captures — MUI and AntD from their own

**2026-09-02.** The eleventh archetype with a proposer
(`recipe/fixture-reader/schema-badge.ts`, `draft-roles.ts#draftBadgeRoles`,
`propose-badge.ts`; `npm run recipe:point -- --archetype badge --library <lib>`).
No held-out exists for this archetype: the only anchored-overlay badges in
the capture corpus are MUI's and AntD's, both hand-tabled already, so these
two rows prove the reader against the hand tables rather than against a
library the path was never taught. Minted as badge v11 (page `219:93811`,
four sources) through the shared writer runtime; scored against the real
render as the hand rows are.

| library | cell | reviewed | manifest row | score |
|---|---|---|---|---|
| mui (own capture) | `default.standard` — the library's default | none (19 read, 0 invented) | `badge/mui-proposed` | **3.11%** |
| antd (own capture) | `count.unset` | none (19 read, 0 invented) | `badge/antd-proposed` | **1.98%** = the hand row |

## What the schema reads that the hand tables reviewed

- **The offset.** MUI's circular overlap anchors the pip 14% inside the
  host and then translates it 50%/−50%; the recipe's offset is the
  translation minus the inset: transform tx − `right`, ty + `top` (4.406).
  The hand table had reviewed that number after the gate found the
  rectangular ±10 was wrong; the schema derives it, and on AntD (inset 0)
  the same read is the transform alone (10).
- **The ring.** AntD draws its white ring as a zero-offset, zero-blur
  OUTSET box-shadow, not a border. The schema reads that as a 1px border of
  the shadow's colour with the stroke outside, and names the lowering.
- **The host's radius.** Read as it renders (AntD's Avatar 6, MUI's 50% of
  40 = 20); the hand table had spelled AntD's host as a circle.
- **The cell.** MUI declares no base cell; the drafter takes the one whose
  tokens say default/standard — a transparent pip with a black count, which
  is what MUI's `<Badge>` renders with no colour prop. The hand row reviews
  `color=error` for a visible pip; both are honest, and both score.
- **The count.** AntD nests it three parts deep inside the pip; the drafter
  finds the innermost text part.

## Not proven here

A library the path was never taught. Chakra's, Altitude's, Astryx's,
tailwind's and shadcn's badges are inline status labels (chip-shaped), not
anchored overlays; badge@1 refuses them by name (`library-badges.ts`
`astryxBadgeOverlayRefusal`). The held-out test for this archetype waits on
a foreign library with an anchored badge.
