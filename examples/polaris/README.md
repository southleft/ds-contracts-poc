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
| `scripts/` | build-tokens, promote (+ curation + lib-css), verify |
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

## PERMANENT HOLE — Polaris cannot be recaptured (task #38)

**Every other library in `examples/` commits a git-ignored but REPRODUCIBLE sandbox recipe with
a pinned `package.json` + `package-lock.json`** (`examples/mui/.mui-sandbox`,
`.carbon-sandbox`, `.tw-sandbox`, `.altitude-sandbox`, `.astryx-sandbox`). Polaris has none.
Step 6 above says `--harness <harness-dir>` — a directory whose path, contents and lockfile are
**recorded nowhere in this repo**. `.polaris-clone/` is the SOURCE clone for the static
extraction (step 2); it is not the harness, and it cannot serve as one.

**What that means, stated plainly:**

- Polaris's committed artifacts under `extract/computed/out/<comp>/` — `captured-truth.json`,
  `enriched.contract.json`, the scorecards — are **FROZEN at whatever engine produced them**.
  They are the only artifacts in the corpus that no command in this repo can regenerate.
- Every engine fix that lands after that freeze reaches Polaris only through
  `npm run extract:computed:regate` (the OFFLINE re-fuse of the committed `captured-truth.json`),
  which is why the drift baseline still covers it. Anything that lives in the CAPTURE half —
  a new channel read, a new pseudo-element, a refusal that depends on re-measuring the DOM —
  cannot reach Polaris at all.
- Polaris is therefore also the one library `scripts/figma-scripts-fresh.mjs` does not gate:
  its `figma/*.figma.js` are emitted by `generate.ts` (the provisional-minting path), not by the
  CLI `figma` command, and the exact invocation is not recorded either.

The recorded gap cause lives with the numbers, in
`extract/computed/regate-baseline.json` (`gapCause` on each `polaris/*` row) — so a reader of the
drift table sees it without reading this file.

**Closing it** means committing a `examples/polaris/.polaris-sandbox/` package.json +
package-lock.json pinning `@shopify/polaris@13.9.5 react@18 react-dom@18 esbuild`, adding
`examples/polaris/PROVENANCE.md` with the same shape the other five have, and re-running the
capture. That is a round of its own; it is named here rather than silently carried.

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
