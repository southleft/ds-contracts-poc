# Ant Design v5 — the code→canvas exam library

**Subject:** `antd@5.29.3` · `@ant-design/cssinjs@1.24.0` · `@ant-design/icons@5.6.1` ·
`react@18.3.1` · `esbuild@0.28.x`. The eleventh library through the pipeline, the
**held-out P2 exam** for the code→canvas direction (mirror of the canvas→code exam in
`parity/receipts/phase-2/FIGMA-DS-EXAM.md`), and — by the owner's choice — the hardest one:
runtime CSS-in-JS with a hashed default theme, tokens that are literals by default, every
interesting glyph drawn by a pseudo-element, and a component-scoped token door no other
library uses. The recon that sized it is [`RECON.md`](RECON.md); the receipt is
[`parity/receipts/phase-2/ANTD-EXAM.md`](../../parity/receipts/phase-2/ANTD-EXAM.md).

## Sandbox (the only network step)

```bash
mkdir -p examples/antd/.antd-sandbox                                # git-ignored (.gitignore here)
cp examples/antd/probe/sandbox-package.json examples/antd/.antd-sandbox/package.json
(cd examples/antd/.antd-sandbox && npm install --no-audit --no-fund)
node -e "console.log(require('./examples/antd/.antd-sandbox/node_modules/antd/package.json').version)"   # 5.29.3 — the config pins it; run.ts refuses drift
```

The harness bundles `computed-capture-page/entry.jsx` with esbuild and no `--define`, so
`process.env.NODE_ENV` is `development` and **antd runs in dev mode** (readable CSSOM, text-node
style injection). Production mode is deliberately not used; any hash class string quoted in a
receipt is therefore the dev spelling `css-dev-only-do-not-override-<hash>` (W10).

## The four mount pins — each measured, each with a committed precedent

`extract/computed/configs/antd.json` mounts every combo inside

```jsx
<ConfigProvider theme={{ cssVar: { key: 'antd' }, hashed: false, token: { fontFamily: 'Roboto, Helvetica, Arial, sans-serif' } }}
                wave={{ disabled: true }}>
```

| pin | measured (RECON §2) | why the engine needs it | precedent |
|---|---|---|---|
| `cssVar: { key: 'antd' }` | `var()` uses at point of use 11 → **2,510**; literal colour declarations 654 → 12; all 350 global + 152 component custom properties declared on the `.antd` key class every root carries; they inherit to descendants | turns the existing CSS-vars reader on unchanged so captured pixels carry antd's own token NAMES. The **key is load-bearing**: without it the class is `css-var-r<N>` (an instance counter) and a different page order renames every root → signature drift, double-run refusal | MUI `cssVariables: true`, Fluent wrapper-div vars |
| `hashed: false` | removes the `:where(.css-dev-only-…)` wrapper from 1,660 of 1,673 selectors; pixels identical in every mode (primary `rgb(22,119,255)` → hover `rgb(64,150,255)` → active `rgb(9,88,217)`) | the hash is a token-set artefact, not a part identity; `classAllow` would drop it anyway, unhashed keeps `captured-truth.json` readable | — |
| `wave={{ disabled: true }}` | on `mouse.up` antd appends `<div class="ant-wave …">` INSIDE the clicked root (inline `--wave-color`), animated by a 0.4 s / 2 s transition and **still present 1.3 s later**; with the pin: 0 nodes after click | the active driver ends with `mouse.up()` — the node would sit in the subtree during the next combo's read and fail double-run byte-identity | MUI `disableRipple` |
| `token.fontFamily` Roboto stack | antd's own stack is `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, …` with **0 `@font-face`**; Roboto is its 4th entry and the first that exists as committed bytes (`extract/computed/fonts/roboto/*`, the MUI files) | FC-FONT-SUBSTRATE closure: three platform fonts that no network-free harness can make identical across a mac recording and linux CI precede Roboto. Pinning picks one of the library's OWN faces, not a foreign one. **Residue, ledgered:** `fontWeightStrong` is 600 (Card title, Alert message-with-description) and Roboto 600 is not committed (400/500/700 are) → Chromium synthesises | MUI / Altitude `fonts` |

NOT pinned: `token.motion` (library-true 0.2 s transitions; `settleStage` polls to two identical
samples — `motion: false` is the measured fallback if a double-run ever fails on a transition) and
`theme.algorithm` (default light; dark rides the token set only). Never A/B the theme modes inside
one harness page: three providers in one document rendered the two non-cssVar sets UNSTYLED
(RECON §2.2).

## Token wrap — `node examples/antd/scripts/build-tokens.mjs`

`theme.getDesignToken()` (light) + `getDesignToken({ algorithm: darkAlgorithm })` (dark), named by
`@ant-design/cssinjs`'s own `token2CSSVar(key, 'ant')` → leaf `color-primary` for
`--ant-color-primary`; component tokens from each exam component's `prepareComponentToken`
(`initComponentToken` for Input; Checkbox declares none) → `button-padding-inline` etc. **502
leaves = 350 global + 152 component, 290 differ in dark.** The wrap REFUSES on drift against
`tokens/live-cssvar-dump.json` (the probe's live `.antd*` declarations): every live name must be
in the wrap with the same value. It prints `drift check … 0`. Outputs: `tokens/antd.dtcg.json`,
`tokens/antd.vars.css` (`:root`-scoped twin for the regate page), `tokens/modes/antd.{light,dark}.dtcg.json`.

## Pipeline (repo root)

```bash
npm run seed:gen -- extract/computed/configs/antd.json            # dry run — the curated seeds in contracts-seed/ prune its supersets (README of each seed says what and why)
for C in Button Tag Badge Switch Checkbox Radio Input Alert Avatar Progress Card Tooltip; do
  npm run extract:computed -- --harness examples/antd/.antd-sandbox --config extract/computed/configs/antd.json --component $C --out extract/computed/out/antd --keep-originals || break
done
npm run extract:computed:scorecard -- --dir extract/computed/out/antd --config extract/computed/configs/antd.json --write
npx tsx examples/antd/scripts/promote-floor.mjs                    # fills tokens/antd-minted.dtcg.json + contracts/ (then delete mintedBootstrap and RE-CAPTURE — the Fluent ordering)
npm run extract:computed:regate -- --config extract/computed/configs/antd.json
npx tsx packages/cli/src/cli.ts figma examples/antd/contracts --out examples/antd/figma --icons examples/antd/assets/icons --tokens examples/antd/tokens/antd.dtcg.json,examples/antd/tokens/antd-minted.dtcg.json
node examples/antd/scripts/build-figma-tokens.mjs && node examples/antd/scripts/figma-compile-receipt.mjs && node examples/antd/scripts/build-genesis-batch.mjs
npx tsx packages/cli/src/cli.ts figma bundle examples/antd/contracts/*.contract.json --out examples/antd/figma/antd.bundle.json \
  --tokens examples/antd/tokens/antd.dtcg.json,examples/antd/tokens/antd-minted.dtcg.json \
  --modes examples/antd/tokens/modes/antd.light.dtcg.json,examples/antd/tokens/modes/antd.dark.dtcg.json --name "Ant Design" --icons examples/antd/assets/icons
```

Seeds live in `contracts-seed/` and promote writes `contracts/` — never the same directory
(docs/23 §D.2, the Astryx self-read trap).

## Layout

```
examples/antd/
  README.md               this file — the recipe and the four pins
  RECON.md                the pre-capture recon (measured; every number has a probe)
  probe/                  the recon's probe scripts + the sandbox package.json (re-runnable)
  ds-library.json         the library manifest promote/onboard read
  contracts-seed/         12 curated seeds (props/axes only)
  contracts/              PROMOTED contracts (written by promote-floor.mjs)
  tokens/                 antd.dtcg.json · antd.vars.css · modes/ · live-cssvar-dump.json · antd-minted.dtcg.json · MINTED.md
  assets/icons/           floor-reconstructed svg glyph assets (written at promotion)
  figma/                  emitted sync scripts · 00-tokens · GENESIS-BATCH · antd.bundle.json
  receipts/figma/         COMPILE-RECEIPT.md
  scripts/                build-tokens · promote-floor · build-figma-tokens · build-genesis-batch · figma-compile-receipt
  .antd-sandbox/          git-ignored npm sandbox (recreate with the block above)
```
