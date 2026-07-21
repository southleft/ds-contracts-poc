# Astryx dev-journey — Figma sync-script compile receipt

Genesis prep. `ds-contracts figma examples/astryx/contracts --out
examples/astryx/figma --tokens examples/astryx/tokens/astryx.dtcg.json` emits
one Figma Plugin API sync script per flagship contract. A future bridge run
builds these into a **blank Figma file** = the FIRST Astryx Figma library
(Astryx ships no official kit as of 0.1.6 — see ../../PROVENANCE.md). No live
canvas is driven here (owner + bridge later).

Rebuild: `node examples/astryx/scripts/figma-compile-receipt.mjs`

Each script is proven two ways, the repo's own patterns:
1. **Referee / compile product** — the emitted `const COMPONENTS = […]`
   payload (createFigmaEngine's build product, the parseSyncComponent shape
   from evals/run.ts) parses and its set identity + variant grid match the
   contract's declared axes.
2. **Headless execute** — the whole script runs in a VM against the mocked
   `figma` global (scripts/plugin-engine-mock-figma.mjs, the
   plugin-engine-check pattern), no Figma / no network, to completion. The
   mock file is pre-seeded with the Astryx token variables (the token-synced
   starting state the bridge produces before component sync).

> **Named limitation (honest):** Astryx's StyleX tokens are **literal**
> values, not aliases into a primitive layer. The repo engine's
> `buildTokensScript` assumes the repo's alias architecture, so it does not
> emit a token-sync script for a literal token set. The genesis bundle
> therefore still needs a literal-variable token sync (the bridge / plugin
> creates these; this receipt seeds them directly). Wiring a literal-token
> `buildTokensScript` path is a follow-up, not this round.

## 10 scripts · 104 component-set variants compiled

| script | set | variants | axes | headless run |
|---|---|---|---|---|
| `badge.figma.js` | `Badge` | 14 | variant(14) | ✓ ran |
| `banner.figma.js` | `Banner` | 8 | status(4)×container(2) | ✓ ran |
| `button.figma.js` | `Button` | 12 | variant(4)×size(3) | ✓ ran |
| `card.figma.js` | `Card` | 13 | variant(13) | ✓ ran |
| `checkbox-input.figma.js` | `CheckboxInput` | 2 | size(2) | ✓ ran |
| `progress-bar.figma.js` | `ProgressBar` | 5 | variant(5) | ✓ ran |
| `slider.figma.js` | `Slider` | 6 | orientation(2)×valueDisplay(3) | ✓ ran |
| `switch.figma.js` | `Switch` | 2 | labelPosition(2) | ✓ ran |
| `text-input.figma.js` | `TextInput` | 9 | type(3)×size(3) | ✓ ran |
| `token.figma.js` | `Token` | 33 | size(3)×color(11) | ✓ ran |

Total: **104 variants across 10 component sets.**
