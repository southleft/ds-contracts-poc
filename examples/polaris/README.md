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
```

Steps 4 and the eval run from the COMMITTED artifacts alone — that is the point of a contract.

## License hygiene

Polaris is MIT © Shopify Inc. This directory commits **derived artifacts and receipts only**:
contracts (metadata about Polaris's public API), the mechanically wrapped token values, two
spinner glyphs carried verbatim as showcase icon assets (from `Spinner.tsx`), and screenshots
of renderings. No Polaris source is vendored; the clone lives in the git-ignored
`.polaris-clone/`. This showcase is not affiliated with or endorsed by Shopify.
