# The Astryx genesis — the first Astryx Figma library, one paste

Astryx (Meta's design system, `@astryxdesign/core@0.1.6`) ships **no official
Figma kit**. This directory builds one — deterministically, from contracts
extracted out of Meta's own shipped TSX source, with **no AI in the
conversion**. Everything below is proven headless first
(`node examples/astryx/scripts/figma-compile-receipt.mjs` — 13/13 scripts,
composition assertions, and the exact batch below executed start-to-finish in
the mock); the live run is confirmation, not debugging.

## The one-paste run (recommended)

1. Open a **blank** Figma design file.
2. Run **DS Contracts Sync Runner** (check the engine stamp in the header).
3. Go to the **"Paste a script"** tab.
4. Paste the full contents of **`GENESIS-BATCH.figma.js`** → Run.

That's it. The script upserts the **Astryx token collection** (186 variables,
Light/Dark modes, literal values — Astryx has no primitive/alias layer), then
builds all **13 component sets in dependency order**, each hosted on a named
background Section:

| Component | Grid | Notes |
|---|---|---|
| Badge | 14 variants | |
| Banner | 8 | |
| Button | 12 | |
| Card | 13 | |
| CheckboxInput / Switch | 2 each | |
| ProgressBar | 5 | |
| Slider | 6 | |
| TextInput | 9 | |
| Token | 33 | |
| **DropdownMenuItem** | standalone | the repeated row |
| **Toast** | standalone | body + endContent slot + Dismiss `astryx.button` — matches Meta's own doc-declared anatomy |
| **DropdownMenu** | standalone, **multi-root** | trigger `astryx.button` ("Options") + `role=menu` overlay repeating three labeled items (**Edit / Duplicate / Delete**) |

Re-running the paste is safe: tokens upsert, components amend in place.

## Why "Paste a script" and not the Generate tab

The Generate tab's engine carries the **repo's** baked tokens/contracts; a
foreign system's token refs would be refused by name (correctly). For a
foreign system, the deterministic vehicle is CLI-emitted scripts — pure
functions of the contracts + the system's own DTCG wrap — executed verbatim
by the plugin. Same guarantee, different entry point. (Baking third-party
token sets into the Generate flow is a roadmap item.)

## Rebuild the artifacts (all deterministic)

```bash
npx tsx examples/astryx/scripts/build-tokens.ts          # DTCG wrap (alias pass)
npx tsx examples/astryx/scripts/build-figma-tokens.ts    # 00-tokens.figma.js
npx tsx packages/cli/src/cli.ts figma examples/astryx/contracts \
  --out examples/astryx/figma --tokens examples/astryx/tokens/astryx.dtcg.json
node examples/astryx/scripts/build-genesis-batch.mjs     # GENESIS-BATCH.figma.js
node examples/astryx/scripts/figma-compile-receipt.mjs   # the gate (13/13)
```

`astryx-genesis.bundle.json` (the 13 contracts as a CONTRACTS-BUNDLE) is the
same set in contract form — the artifact a future foreign-token-aware
Generate/Receive flow will consume directly.
