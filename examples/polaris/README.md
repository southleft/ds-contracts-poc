# examples/polaris — the Polaris showcase (Phase A)

A real, famous design system in → contracts out → working generated code verified against the
system's own rendering. Start with **[SHOWCASE.md](./SHOWCASE.md)** (verdict first, written for a
skeptical outside reader). This README is the map and the reproduction guide.

**Why in-repo, not a separate repo:** one clone must prove everything. The claim under test is
that THIS pipeline turns a foreign system into contracts and verified surfaces — splitting the
evidence from the pipeline would make the numbers uncheckable against the code that produced
them. Everything here regenerates from the committed inputs with the commands below, and the
`polaris-showcase-reproducible` eval re-runs the generation on every `npm run eval`.

## Layout

| path | what it is |
|---|---|
| `SHOWCASE.md` | the verdict, the numbers, the named gaps, how to reproduce |
| `contracts/*.contract.json` | 12 committed contracts (v0.2.0 — computed-floor promoted, `scripts/promote-floor.ts`) + `*.extension.json` overflow blocks |
| `tokens/polaris-light.dtcg.json` | Polaris's default-theme tokens, mechanically wrapped to DTCG (453, values verbatim) |
| `extraction/PROMOTION.md` | the complete promotion ledger — every carried binding cites its CSS rule, every refusal is named |
| `extraction/VERSION-PARITY.md` | proof that `@shopify/polaris@13.9.5` renders the pinned SHA's styling |
| `generated/react/`, `generated/html/` | emitReact + emitHtml output from the contracts (byte-stable) |
| `figma/` | Figma sync scripts (tokens + components) + the headless compile receipt |
| `receipts/` | paired screenshots (ours \| theirs), `truth-table.json`, `RECEIPTS.md` |
| `scripts/` | build-tokens, promote (+ curation; the CSS-module inverter is `extract/computed/lib-css.ts`), verify |
| `extract.config.json` | the pipeline config for the mechanical extraction |

## Reproduce

```bash
# 0) clone Polaris at the pinned SHA (the gauntlet's SHA; MIT © Shopify)
git clone https://github.com/Shopify/polaris examples/polaris/.polaris-clone
git -C examples/polaris/.polaris-clone checkout 2b1ea88625e0613853ca8577c9acd1980a90f382

# 1) wrap the published token set (453 tokens, verbatim) → tokens/
npx tsx examples/polaris/scripts/build-tokens.ts

# 2) mechanical extraction (the SAME pipeline any adopter runs) → out/
npm run extract:code -- examples/polaris/extract.config.json

# 3) promotion (extracted API verbatim + reviewed styling inversion) → contracts/ + PROMOTION.md
npx tsx examples/polaris/scripts/promote.ts

# 4) generation (contracts → react/html/figma; no clone needed) → generated/ + figma/
npx tsx examples/polaris/generate.ts
npx tsx examples/polaris/generate.ts --check   # byte-stability + SHOWCASE-number consistency

# 5) verification vs Polaris's own rendering → receipts/
#    (harness dir: npm i @shopify/polaris@13.9.5 react@18 react-dom@18 esbuild)
npx tsx examples/polaris/scripts/verify.ts --harness <harness-dir>

# 6) THE FLOOR ROUND (v0.2.0 — the committed contracts' actual provenance):
#    computed-capture floor over the same harness (prop-space source = the
#    committed v0.1.0 static contracts in extraction/static-contracts/),
#    contradiction resolutions via the explicit-ack CLI, then re-promotion.
npm run extract:computed -- --harness <harness-dir>
npm run extract:computed:resolve -- --dir extract/computed/out/<comp> --apply "<ids>" [--to "{ref}"]
npx tsx examples/polaris/scripts/promote-floor.ts
```

Steps 4 and the eval run from the COMMITTED artifacts alone — that is the point of a contract.

## The sandbox hole — CLOSED 2026-07-29 (task #26/#43)

Polaris used to be the one library with no capture harness recorded anywhere, which made its
committed artifacts unregenerable by any command in this repo. `examples/polaris/.polaris-sandbox/`
now exists and its **recipe is committed** — `package.json` + `package-lock.json`, pinning
`@shopify/polaris@13.9.5`, `react@18.3.1`, `react-dom@18.3.1`, `esbuild`. The install itself is
git-ignored; the lockfile is what makes it reproducible.

```bash
cd examples/polaris/.polaris-sandbox && npm ci
```

**A correction to what this file used to say.** It claimed every *other* library "commits a
git-ignored but REPRODUCIBLE sandbox recipe with a pinned `package.json` + `package-lock.json`."
That was not true of any of them: `git ls-files examples/carbon/.carbon-sandbox` returns nothing,
and the same holds for mui, tailwind, altitude and astryx — each `.gitignore` ignores the sandbox
directory whole. Their recipes survive only as prose in their `PROVENANCE.md`. Polaris is now the
first library whose harness is reproducible from committed bytes; bringing the other five up to
the same bar is named as follow-up work, not claimed here.

### What is still open

- **The recapture itself has not been run.** The sandbox exists and the reader question is
  answered (below), but Polaris's 12 committed contracts are still the frozen ones. Until that
  round runs, every engine fix in the CAPTURE half still reaches Polaris only through
  `npm run extract:computed:regate` (the offline re-fuse of the committed `captured-truth.json`).
- **`varPrefix` is measured but not yet applied.** Polaris's compiled CSS
  (`build/esm/styles.css`, 499,065 bytes in the published 13.9.5 tarball) references
  `var(--p-*)` **2,727 times at point of use** across **328 distinct** custom properties, with 452
  defined. So Polaris binds through custom properties — it is nothing like StyleX, and the
  CSS-vars source reader WOULD bind here. All 980 of its minted leaves are anonymous literals for
  one reason only: the reader arrived at library #4 (MUI) and library #2 was never re-run with it.
- **Polaris is still the one library `scripts/figma-scripts-fresh.mjs` does not gate** — its
  `figma/*.figma.js` come from `generate.ts` (the provisional-minting path), not the CLI `figma`
  command, and that invocation is still unrecorded. A recapture round has to settle this too.

The recorded gap cause lives with the numbers, in `extract/computed/regate-baseline.json`
(`gapCause` on each `polaris/*` row), so a reader of the drift table sees it without reading this
file.

## License hygiene

Polaris is MIT © Shopify Inc. This directory commits **derived artifacts and receipts only**:
contracts (metadata about Polaris's public API), the mechanically wrapped token values, two
spinner glyphs carried verbatim as showcase icon assets (from `Spinner.tsx`), and screenshots
of renderings. No Polaris source is vendored; the clone lives in the git-ignored
`.polaris-clone/`. This showcase is not affiliated with or endorsed by Shopify.

## Coverage of this library — the denominator

| committed contracts | pinned by the drift instrument | library size | **coverage** |
|---|---|---|---|
| 12 | 12 | 180 | **6.7%** |

Library size: **this repo's own extractor over the whole library** —
`extract/pilots/ENTERPRISE-GAUNTLET.md` (180 extracted, 15 named-skipped). The
depth config captures a 13th component (`Modal`) which is not a drift row.

Every per-component number in this showcase — floors, `pctEqual`, receipts —
is measured over that slice, and the slice was hand-picked for tractability.
The engine generalizing across libraries ([docs/22](../../docs/22-generality.md))
and a library being *captured* are different claims; this row is the second one,
and it is small. Full table and how to re-derive it:
[docs/22 §8.3](../../docs/22-generality.md).
