# MUI genesis — build the first MUI Figma library in one paste

Everything in this directory is **generated** (see `../PROVENANCE.md` for the
chain). Nothing here was hand-drawn; the plugin executes these scripts
verbatim — deterministic, no AI in the conversion.

## One-paste path (recommended): the JSON bundle

1. Open a **blank Figma file**.
2. Run the DS Contracts plugin → **Generate** tab.
3. Paste the entire contents of `mui.bundle.json` → Generate.

The bundle carries the 11 contracts **and** the MUI token set (base + light/
dark modes + minted tree) **and** the 4 floor-reconstructed icon SVGs
(Autocomplete's chip-delete/clear/popup indicators) in one JSON document —
built by `ds-contracts figma bundle --icons` (see `../PROVENANCE.md`). The
plugin syncs the "MUI" collection first, then every component. The headless
equivalence gate (`scripts/plugin-engine-check.mjs`, flow
`foreign-token-bundle`) pins this paste against the compiled-script path
below: same sets + standalone components, same variants, same 1270
variables, same bound values.

## Script path (debug / CI surface)

1. Open a **blank Figma file**.
2. Run the DS Contracts plugin → **Paste a script** tab.
3. Paste the entire contents of `GENESIS-BATCH.figma.js` → Run.

Result (either path): a "MUI" variable collection (1270 variables, Light/Dark modes — 70 of
them **real Figma aliases** into the palette, exactly the references MUI's own
CSS declares) and 9 component sets + 2 standalone components on their own
pages:

| set | variants | axes |
|---|---|---|
| Button | 63 | Variant(3) × Color(7) × Size(3), Disabled bool |
| Chip | 28 | Variant(2) × Color(7) × Size(2) |
| Card | 4 | Elevation(4) |
| Switch | 14 | Color(7) × Size(2), Checked/Disabled bools |
| Slider | 12 | Color(6) × Size(2) |
| Tabs | 6 | Text color(3) × Indicator color(2) |
| Accordion | 4 | Variant(2) × Expanded(2), Disabled bool |
| Autocomplete | 2 | Size(2) |
| Dialog | 5 | Max width(5) |
| Menu | standalone | — (MenuItems Profile / My account / Log out) |
| Tooltip | standalone | — (Show Arrow bool) |

The exact byte stream you paste was executed against the headless Figma mock
before it was written (`scripts/build-genesis-batch.mjs` refuses otherwise),
and each component script is separately referee'd + mock-executed
(`../receipts/figma/COMPILE-RECEIPT.md`).

## Step-by-step path

Run `00-tokens.figma.js` first (variables must exist before components bind
them), then any of the component scripts in any order.

## What to look for on the canvas

- Contained Buttons' fills bind the `imported/button/root/background-color/…`
  variables, which **alias** `palette-primary-main` etc. — inspect a fill and
  follow the alias chain; flipping the collection mode to Dark re-resolves
  the aliased values.
- Every set sits in a labeled SECTION on its own page; re-running any script
  amends in place (same node ids) instead of duplicating.
