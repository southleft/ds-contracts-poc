# 36 · Point it at your library

> **Status: ACTIVE — 2026-09-01.** This is the product spine the
> [2026-09-01 audit](../parity/receipts/v1/HONEST-SCORECARD.md) called for:
> one command from a capture of a real package to a program the shipped
> plugin can run in any file. It works today for **eight archetypes**
> (checkbox@1, switch@1, avatar@1, tooltip@1, chip@1, link@1, tabs@1, radio@1) and has been proven on **libraries
> the recipe path was never taught** — Chakra UI, shadcn, Altitude, Fluent and
> Carbon — including six Chakra controls captured for the first time the same
> day (a person wrote the config entry, the command did the rest; the Switch's
> four states are pixel-identical).
> Everything it cannot do refuses by name.

## The sentence this serves

> A design-system engineer runs one command against their React library,
> reviews one file, runs one more command, imports the plugin, pastes one
> JSON, and gets a Figma component set that scores within 5% of their own
> library's Chromium render for every supported archetype, plus a named
> report of what could not be expressed.

This page is the part between "capture" and "paste". The capture is
[extract/computed](../extract/computed/README.md); the paste is the
plugin's **Paste a script** verb ([19 — plugin IA](19-plugin-ia.md)).

## The command

```bash
npm run recipe:point -- --archetype switch --library shadcn
npm run recipe:point -- --archetype checkbox --library chakra \
  --glyph-file glyph.json \
  --set dash.width=9.9167 --why 'dash.width=…the arithmetic…' \
  --set dash.height=1.75  --why 'dash.height=…' \
  --set dash.radius=0.875 --why 'dash.radius=…'
```

It runs five steps and stops at the first it cannot do honestly:

1. **capture** — `extract/computed/out/<library>/<archetype>/captured-truth.json`
   must exist. If not, it prints the capture command (with
   `--keep-originals`, so the real-package screenshots the fidelity gate
   scores against are kept).
2. **roles** — which captured part plays which role in the archetype (the
   box, the glyph, the label, the row, the hit area, the indeterminate
   mark, where opacity lives). Drafted from what the parts *do* across the
   captured states — never from class names — and written with evidence
   and a confidence per role to `roles.draft.json` for review. Pass
   `--roles-file` to supply a reviewed map instead. An unresolved role
   stops here.
3. **propose** — the fixture module,
   `recipe/fixtures/generated/<archetype>.<library>.ts`. Every leaf is one
   of: *read* from the ledger (its ledger key is recorded on the line),
   *set* by you with `--set path=value --why 'path=evidence'` (recorded as
   a reviewed receipt), or an *archetype spelling* (a convention of the
   recipe, named once in the schema — e.g. an absent indeterminate mark is
   transparent). A leaf that is none of these refuses the whole proposal
   and names itself. **Nothing is invented.**
4. **compile** — the module is adapted and compiled, and
   collapse → compile must be a fixed point.
5. **emit** — two programs through the shared writer runtime
   ([recipe/figma-writer-runtime.ts](../recipe/figma-writer-runtime.ts)):
   `writer.plugin.js` (no file pin, no page list — it creates its own page
   in whatever file the plugin runs in) and `writer.scratch.js` (the
   developer protocol, pinned to the Scratch file).

Output lands in `recipe/evidence/pointed/<archetype>-<library>/` with a
README that repeats what was read, what you reviewed, and what to do next.

## What a person still does

- **Review the role map.** The drafter is a heuristic with evidence, not an
  oracle. On Chakra it drafted the same map a person had written; on MUI and
  shadcn it reports, as evidence, that the mount has no label (the bare cell);
  on AntD it reports that the glyph is drawn by a pseudo-element it does not
  read.
- **Cite the glyph.** An SVG polyline's points are not a computed style
  channel, so the check glyph's geometry comes from the package source, in a
  small JSON with the file it was read from (`glyph.json`). A `<path d>` the
  capture recorded is used as-is.
- **Give what the ledger cannot carry, with the arithmetic.** A stroked
  line lowered to a rounded rectangle is three numbers and a sentence each.

## What it proved

On Chakra's Avatar, Tag and Link — all three captured the same morning from
config entries a person wrote — the avatar scores 0.38% held out, the tag's
inset ring is lowered to a border and its glyphs are named, and the link —
which the legacy contract path quarantines on `text-underline-offset` — is
scored against the real render anyway (the quarantine path now keeps the
`--keep-originals` screenshots: the pixels are a measurement, not the
contract's to refuse) and is a named one-row rasterisation difference.

On radio@1, the dot is read wherever the library draws it — AntD's ring
`::after` scaled by a transform, Chakra's `.dot` span scaled by the CSS
`scale` property — and its radius is clamped to half the painted size as
CSS clamps it. AntD's proposal scores its hand row's 0.00%; Chakra's
RadioGroup, captured the same day from a config entry a person wrote, is
pixel-identical held out. The first config entry composed the bare
`ItemControl`, which has no dot; the real render agreed, and the package's
`ItemIndicator` is the corrected composition
(`recipe/evidence/fidelity-v1/f1-radio-proposed/`).

On tabs@1, the indicator is read as a part (MUI) or as the selected tab's
bottom border (Carbon): MUI from its own capture scores the hand row's
number; Carbon, held out, is a named content mismatch (three tabs and a
panel in the capture); shadcn refuses by name
(`recipe/evidence/fidelity-v1/f1-tabs-proposed/`).

On chip@1 and link@1, six captures: Altitude's chip, never hand-tabled,
scores 0.07%; the MUI and AntD proposals score exactly their hand rows;
three rows fail on text rasterisation alone and are named
(`recipe/evidence/fidelity-v1/f1-chip-link-proposed/`). A library that
captures the archetype under another name is read with `--capture <dir>`
(AntD's and Carbon's Tag as chip@1).

On tooltip@1, a floating component: the proposal names the placement
wrapper, the arrow and the shadow as refusals read from the capture; AntD
from its own capture scores the hand row's 3.01%, shadcn 4.73%, and Chakra —
held out, captured through the portal path the same day — is a named
font-substrate row: Inter resolved exactly and still hugs two columns
narrower in Figma than in Chromium
(`recipe/evidence/fidelity-v1/f1-tooltip-proposed/`).

On avatar@1, five captures at once: MUI and AntD from their own captures
score 0.00% beside the hand-written rows (which pin initials the capture does
not render), Altitude — never hand-tabled — scores 0.38%, and shadcn and
Fluent propose with a reviewed font fallback each
(`recipe/evidence/fidelity-v1/f1-avatar-proposed/`).

On Chakra's Switch — never captured before — the person's step was the seed
contract and the config entry; the capture ran, the command proposed the
fixture with no `--set` (33 read, 0 invented; a labelled control), and after
the reader learned to lower a CSS-scaled thumb, all four states are
pixel-identical to the package's render
(`recipe/evidence/fidelity-v1/f1-chakra-switch/`). That is the sentence
above, run end to end on one archetype.

On shadcn's Switch — `--archetype switch --library shadcn` with no `--set`
at all — the proposal read 25 leaves and invented none, and all four states
score under the bar against the real render, two pixel-identical
(`recipe/evidence/fidelity-v1/f1-shadcn-switch/`). Pointed at MUI's own
capture, the same command proposed the bare-mount fixture that scores
exactly what the hand-written one does.

On shadcn's Checkbox — a bare `<button role=checkbox>` with no label part and
every colour in `oklch()` — the drafter reported the missing label as evidence,
the proposer wrote the label-less cell (28 leaves read, 6 reviewed, 0
invented), and four of six states scored at or under the bar against the real
render, two of them pixel-identical; the two indeterminate cells are a named
gap, and the checked state misses by 0.15 on a shadow the archetype does not
carry. See `recipe/evidence/fidelity-v1/f1-shadcn-checkbox/`.

On `@chakra-ui/react`'s Checkbox — a library no fixture had ever been
written for — the proposer read the whole state matrix from the capture,
the compile round-tripped, the emitted program minted its own page, and the
fidelity gate scored every state against the real package render at or
under the bar; four of five states were pixel-identical. The evidence, with
per-state screenshots and scorecards, is under
`recipe/evidence/fidelity-v1/f1-chakra-checkbox/` and
`recipe/evidence/pointed/checkbox-chakra/`.

The same role schema, run backwards over the three hand-written switch
fixtures, agreed with the humans on every leaf it could read but one — and
the one was a real drop shadow on AntD's knob that the hand table had
recorded as none, which the gate had been excusing as anti-aliasing. See
`recipe/fixture-reader/rederive.ts`.

## What it does not do yet

- **Other archetypes.** Eight of the thirteen boilerplate archetypes have
  proposers today (checkbox, switch, avatar, tooltip, chip, link, tabs,
  radio); the other five — badge, alert, textarea, dialog, menu — still have
  hand tables only.
- **A bare radio.** radio@1 has no label-less cell (checkbox@1 and switch@1
  do), so MUI's bare `<Radio/>` is refused by name at the role draft.
- **A ring that is a shadow.** A zero-offset, zero-blur inset box-shadow
  paints exactly like an inside border and takes no layout space; chip@1
  reads it as a border whose spread comes out of the padding (Chakra's Tag).
  The other box archetypes do not read it yet.
- **A selected-tab fill.** tabs@1 draws an indicator under the selected tab;
  shadcn paints the selected tab as a pill and has no indicator, so the
  drafter refuses it by name rather than inventing one.
- **Text rasterisation.** A label the reader read exactly can still score
  over the bar when Figma and Chromium rasterise the face differently
  (Carbon's "Tag", Altitude's underlined "Link"). Those rows are named in
  the ratchet, not excused.
- **A font this machine lacks.** The proposer cannot know Figma's font list.
  When the requested face is missing, the writer refuses by name and the
  person gives `--set typography.label.resolved="Family/Style" --why …`; the
  fixture then carries a named degradation (Fluent's Segoe UI → Arial Bold).
- **Strokes thinner than 2px.** shadcn's check is a 1.17px stroke; Chromium
  rasterises it softer than Figma does, and the checked state scores 5.15%
  against a 5% bar with the diff hugging the whole stroke. Not a missing
  fact — the same path at 1.75px (Chakra) is pixel-identical.
- **A glyph as the indeterminate mark.** checkbox@1's indeterminate cell is a
  dash. shadcn draws the check glyph there; those two cells are a named gap
  (`recipe/evidence/fidelity-v1/f1-shadcn-checkbox/`).
- **Pseudo-element glyphs.** AntD draws its check with `::after` borders;
  the drafter does not read pseudo-elements for the glyph role (the hand
  mapping does).
- **The plugin's paste verb itself.** The program is proven through the
  same execution shape the plugin uses; a person pasting it in Figma
  desktop has not been exercised in this repository.
- **A capture is still a capture.** `extract/computed` needs a sandbox with
  the real package installed and a capture config; that is the
  [21 — bring your own design system](21-bring-your-own-design-system.md)
  path, and its onboarding has its own known limits.

## Where this goes next

The product repository this page describes is manifested in
[37 — product repo manifest](37-product-repo-manifest.md): what moves (≈480
files), what stays as archive, and the three decisions that are the owner's.

## The parts

| file | what |
|---|---|
| `recipe/fixture-reader/schema-checkbox.ts` | checkbox@1 leaves as ledger reads over roles; archetype spellings |
| `recipe/fixture-reader/schema-switch.ts` | switch@1 the same; the opacity rule is structural (thumb inside the track → carry; sibling → bake) |
| `recipe/fixture-reader/draft-roles.ts` | role and combo drafting from the ledger, with evidence |
| `recipe/fixture-reader/propose-fixture.ts` | evaluates a schema against a ledger and writes the checkbox fixture module |
| `recipe/fixture-reader/propose-switch.ts` | the switch fixture module, same contract |
| `recipe/fixture-reader/schema-avatar.ts`, `propose-avatar.ts` | avatar@1: box and label roles; the same contract |
| `recipe/fixture-reader/schema-tooltip.ts`, `propose-tooltip.ts` | tooltip@1: the tip role; placement, arrow and shadow refused from the capture |
| `recipe/fixture-reader/schema-chip.ts`, `propose-chip.ts` | chip@1: box + label; a label part's padding is part of the inset |
| `recipe/fixture-reader/schema-link.ts`, `propose-link.ts` | link@1: the anchor; underline and line-height unit read |
| `recipe/fixture-reader/schema-tabs.ts`, `propose-tabs.ts` | tabs@1: list, selected/rest tabs, an indicator part or the selected tab's bottom border |
| `recipe/fixture-reader/schema-radio.ts`, `propose-radio.ts` | radio@1: hit, ring, dot (part or pseudo-element, transform × `scale`), label, row; list leaves are spellings |
| `recipe/fixture-reader/point.ts` | the command |
| `recipe/fixture-reader/rederive.ts` | runs a schema over a hand-written fixture's own ledger and reports agreement |
| `recipe/figma-writer-runtime.ts` | the one IR → canvas program, scratch and plugin targets |
| `scripts/run-figma-writer.mjs --plugin-target` | rehearses a plugin-target program in the Scratch file |
