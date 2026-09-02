# F1 · radio@1 proposed from captures — AntD from its own, Chakra held out

**2026-09-02.** The eighth archetype with a proposer
(`recipe/fixture-reader/schema-radio.ts`, `draft-roles.ts#draftRadioRoles`,
`propose-radio.ts`; `npm run recipe:point -- --archetype radio --library <lib>`).
Minted as radio v9 (page `219:92148`, five sources: the three hand rows plus
these two) through the shared writer runtime; scored control-only against the
real package render, exactly as the hand rows are.

| library | reviewed | manifest row | score |
|---|---|---|---|
| antd (own capture) | none (32 read, 4 spellings, 0 invented) | `radio/antd-proposed` | **0.00%** = the hand row |
| chakra (HELD OUT, captured today) | none (32 read, 4 spellings, 0 invented) | `radio/chakra` | **0.00%** |

## What the schema reads that the hand tables reviewed

- **The dot.** AntD draws it as the ring's `::after`, 16×16 scaled by
  `matrix(0.375,…)`; Chakra as a `.dot` span at full size with the CSS
  `scale: 0.4` property. The schema reads width × transform-scale ×
  scale-property (6 and 7.2) and clamps the radius to half the painted size
  as CSS does (AntD's 16px radius on a 6px disc paints 3; Chakra's 9999px
  ring radius on a 20px ring paints 10). The hand table had reviewed those
  numbers; the schema derives them, with the formula on the line.
- **The gap.** The space between the control and the label is read as row
  column-gap + label padding-left + label margin-left + hit margin-right
  (AntD carries it on the label's padding, Chakra on the row's gap).
- **Alignment.** AntD's wrapper aligns `baseline`; the schema lowers it to
  `center` by name (Figma's BASELINE aligns to the circle frame's bottom
  edge) — the same lowering the v2 stay had reviewed, now a formula.
- **The list.** A capture mounts one radio, so `list.gap` (0) and
  `listMode` (vertical) are archetype spellings the control-only score never
  sees; `--set … --why` overrides them with evidence.

## The person's step, and a wrong first composition

Chakra's RadioGroup was captured from a seed contract and a config entry a
person wrote. The first entry composed `ItemHiddenInput + ItemControl +
ItemText`; the capture had no dot and the real render agreed — a solid disc.
The package's control-with-dot is `RadioGroupItemIndicator` (it renders
`ItemControl` asChild around `Radiomark`, whose `.dot` span is the disc).
The corrected entry is the person's review of the composition, recorded in
the config's `__note`; the reader did not guess a dot in either case.

## Refused by name

MUI's bare `<Radio/>` has no label part; radio@1 has no bare cell yet, so
the drafter reports `label:` unresolved instead of inventing one
(`point.test.ts`). The hand row for MUI stays.
