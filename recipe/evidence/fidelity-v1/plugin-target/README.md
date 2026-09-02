# The paste verb, proven per row — 2026-09-02

The stranger sentence ends with a paste: the person imports the plugin,
pastes one JSON, and gets the set. Until today the fidelity gate scored the
DEVELOPER-protocol programs (the scratch target, pinned to this file and its
pages) and the plugin target was proven once, on three checkboxes, in June's
shape of the runtime. This directory proves it per row, every time.

`npm run recipe:fidelity:plugin:proof` (`recipe/plugin-target-proof.ts`)
takes every proposed row of the fidelity manifest — 39 rows across the
thirteen archetypes, 18 of them libraries the recipe path was never taught —
and for each:

1. emits the **plugin-target** program from the CURRENT generated module
   (no file pin, no page list — what the shipped plugin's Paste-a-script verb
   executes), through the same toolkit `recipe:point` uses
   (`recipe/fixture-reader/toolkit.ts`);
2. runs it in Scratch through the same execution shape the plugin uses
   (`scripts/run-figma-writer.mjs --plugin-target`), after a Scratch-only
   sweep of any page/collection a prior attempt left (the program refuses by
   name when its section already exists);
3. exports the same cell the manifest row exports, from the plugin's own
   page (`recipe:fidelity:capture --page <id> --shot-suffix plugin`);
4. scores both shots — the plugin's and the manifest's — against the SAME
   real-package reference with the same options (crop, width normalisation,
   control-only), and records both numbers in `<label>.json`.

`npm run recipe:fidelity:plugin:check` re-scores the committed `-plugin.png`
shots offline (no Figma) and refuses any row whose plugin score differs from
its manifest score by more than 0.5 points or crosses the 5% bar the other
way. It is a fast-lane step beside `recipe:fidelity:check`.

## Result

    39 rows · 39 same · 0 drift

Every row scored to the hundredth of a percent what its gate row scores —
the passes (0.00% on six of them) and the named failures alike
(link/mui-proposed 20.22%, tooltip/chakra 8.83%, menu/chakra 5.64%). The
program a stranger pastes is the program the gate measured, not a cousin of
it. Pages are `230:94572` … `230:95757` in Scratch; `RUN.json` carries the
tally; each card names its page.

## What this does not prove

- The plugin's UI: a person choosing Paste-a-script in Figma desktop and
  pasting. The owner did that once (Chakra switch, 2026-09-02,
  `recipe/evidence/pointed/switch-chakra/paste-verb-exercised.json`); this
  proof runs the same program through the bridge, not through a hand.
- Any file but Scratch. The plugin target has no pin; this proof only ever
  ran it in the Scratch file (the runner refuses any other, and the sweep
  refuses any file whose name and key are not Scratch's).
- The hand rows (`*/mui`, `*/antd`, `*/astryx`): they are transcriptions,
  not proposals, and the sentence is about the proposed path.
