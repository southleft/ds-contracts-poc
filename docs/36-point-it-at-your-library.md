# 36 · Point it at your library

> **Status: ACTIVE — 2026-09-01.** This is the product spine the
> [2026-09-01 audit](../parity/receipts/v1/HONEST-SCORECARD.md) called for:
> one command from a capture of a real package to a program the shipped
> plugin can run in any file. It works today for **three archetypes**
> (checkbox@1, switch@1, avatar@1) and has been proven on **three libraries
> the recipe path was never taught** — Chakra UI and shadcn — including one control
> captured for the first time the same day (Chakra's Switch: a person wrote
> the config entry, the command did the rest, four states pixel-identical).
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

- **Other archetypes.** checkbox@1, switch@1 and avatar@1 have proposers
  today (`propose-fixture.ts`, `propose-switch.ts`, `propose-avatar.ts`);
  the other ten boilerplate archetypes still have hand tables only.
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

## The parts

| file | what |
|---|---|
| `recipe/fixture-reader/schema-checkbox.ts` | checkbox@1 leaves as ledger reads over roles; archetype spellings |
| `recipe/fixture-reader/schema-switch.ts` | switch@1 the same; the opacity rule is structural (thumb inside the track → carry; sibling → bake) |
| `recipe/fixture-reader/draft-roles.ts` | role and combo drafting from the ledger, with evidence |
| `recipe/fixture-reader/propose-fixture.ts` | evaluates a schema against a ledger and writes the checkbox fixture module |
| `recipe/fixture-reader/propose-switch.ts` | the switch fixture module, same contract |
| `recipe/fixture-reader/schema-avatar.ts`, `propose-avatar.ts` | avatar@1: box and label roles; the same contract |
| `recipe/fixture-reader/point.ts` | the command |
| `recipe/fixture-reader/rederive.ts` | runs a schema over a hand-written fixture's own ledger and reports agreement |
| `recipe/figma-writer-runtime.ts` | the one IR → canvas program, scratch and plugin targets |
| `scripts/run-figma-writer.mjs --plugin-target` | rehearses a plugin-target program in the Scratch file |
