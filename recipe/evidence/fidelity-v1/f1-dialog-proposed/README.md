# F1 · dialog@1 proposed from captures — MUI from its own, Chakra held out

**2026-09-02.** The thirteenth and last archetype with a proposer
(`recipe/fixture-reader/schema-dialog.ts`, `draft-roles.ts#draftDialogRoles`,
`propose-dialog.ts`; `npm run recipe:point -- --archetype dialog --library <lib>`).
Minted as dialog v7 (page `229:94292`, five sources); scored against
references cropped to the paper's rendered rect.

| library | reviewed | manifest row | score |
|---|---|---|---|
| mui (own capture, title + body) | none (17 read, 0 invented) | `dialog/mui-proposed` | **4.92%** |
| chakra (HELD OUT, captured today) | none (17 read, 0 invented) | `dialog/chakra` | **2.57%** |
| the hand row `dialog/mui` | — | `dialog/mui` | **4.81%** — its named content mismatch CLOSES against the title + body reference |

## The person's step

dialog@1 draws a title over a body. MUI's config entry mounted
`DialogContent` alone (one line of body copy), which is what the first
scored row was named against; the entry now composes `DialogTitle` +
`DialogContent ⊃ DialogContentText`, the archetype's shape, so both the
hand row and the proposal are scored against a reference of the same
shape — and the hand row passes. Chakra's Dialog was captured from a new
entry: `DialogRoot(open) ⊃ DialogTrigger + Portal ⊃ DialogPositioner ⊃
DialogContent ⊃ (DialogHeader ⊃ DialogTitle, DialogBody)`. The backdrop
is left out of the mount: with it, the Portal carries two portaled roots
and the harness's single-root fusion refuses by name (measured); the
backdrop is the overlay behind the paper the gate crops to, not a part of
the paper.

## What the schema reads that the hand table reviewed

The recipe carries one `paddingX`, one `paddingY` and one `itemSpacing`
for a paper whose real inset is asymmetric (MUI: the title block pads
16/24, the content block 20/24). The reads are sums along the edges the
recipe draws: paddingX = paper + title-block padding-left (24); paddingY
= paper + title-block padding-top (16); itemSpacing = the space between
the two texts = title-block padding-bottom + body-block padding-top +
margins + the paper's row-gap (16 on MUI, whose content block drops its
top padding after a title; 24 on Chakra). The hand table had reviewed 24 /
16 / 0 and cited the title's face and sizes from the package; the proposal
reads all of them, including the body's own colour (MUI's
`DialogContentText` is `text.secondary`, which the hand table had as
`text.primary`).

## An instrument defect fixed on the way

The first two mints refused `DIALOG-FONT-UNAVAILABLE:Inter:Semibold` while
the same lookup succeeded when run directly in the file. The shared
runtime's style matcher lives inside the emitted program's template
literal, and its `\s` reached the plugin as `s`: a regex that strips the
letter s, so Figma's "Semi Bold" never matched a CSS-weight "Semibold"
(Carbon's "SemiBold" had matched by luck — no space). The source now
escapes it, and every emitted program carries the real whitespace class.
