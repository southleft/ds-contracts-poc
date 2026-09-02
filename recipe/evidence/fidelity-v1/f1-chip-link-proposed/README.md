# F1 · chip@1 and link@1 — the fifth and sixth archetypes the one command covers

Both are shape-twins of avatar@1 and tooltip@1 (one painted or hugging box,
one label), so `schema-chip.ts` / `schema-link.ts`, `draftChipRoles` /
`draftLinkRoles` and `propose-chip.ts` / `propose-link.ts` follow the same
pattern. Two things the reader learned:

- **A label part's own padding is part of the inset.** MUI's Chip pads the
  label span, not the root; chip@1's `box.paddingX` is now box padding +
  label padding when the label is a child (MUI 0 + 12 = 12; Carbon 8 + 0).
- **A library may capture the archetype under another name.** AntD and
  Carbon capture a *Tag*; `recipe:point … --capture tag` reads it as chip@1.

| row | kind | score |
|---|---|---|
| chip/altitude | **held out** | **0.07%** |
| chip/mui-proposed | MUI's own capture, beside the hand row | 0.61% = hand |
| chip/antd-proposed | AntD's own Tag capture, beside the hand row | 1.89% = hand |
| chip/carbon | **held out** (Carbon Tag) | 8.56% — **named**: the diff hugs the three glyphs of "Tag" in IBM Plex Sans 12px and nothing else; geometry, fill and radius agree |
| link/altitude | **held out** | 5.56% — **named**: glyph edges of "Link" (IBM Plex Sans 16px) and the underline drawn one row from Chromium's |
| link/mui-proposed | MUI's own capture at `primary.always` | 20.22% — **named**: the capture's face is *Times* (Link mounted without a Typography provider); carried as a reviewed fallback to Figma's Times New Roman, which is why it scores 20% where the hand row's Roboto pin scores 49% |

Every proposal: 13 (chip) or 14 (link) leaves read, 0 invented. The three
named rows are the font-substrate class the ratchet already carries for
chip/astryx and link/mui: text rasterised by Figma versus Chromium, not a
missing fact. chip v8 is page `218:90995`, link v7 is page `218:91169`.
