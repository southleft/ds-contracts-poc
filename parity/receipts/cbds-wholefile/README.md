# CBDS whole-file Path A

The file-scale Figma → contract → React test on
[CBDS UI Kit Demo](https://www.figma.com/design/WofZT8xaxXuc2Q6Je9S4XE/CBDS-UI-Kit-Demo)
(`WofZT8xaxXuc2Q6Je9S4XE`). Linked node: Card-Image `419:763`.

This is **not** a first inversion of the kit. The gauntlet already replayed
the committed plugin dump (`extract/figma/gauntlet/CENSUS.md`). This receipt
is the Eventz-shaped scorecard — `generateCss` + `generateTsx` on every
COMPONENT_SET, with Card-Image called out — so the two Path A runs can be
read next to each other.

```sh
npx tsx parity/receipts/cbds-wholefile/run.mts
```

Uses the committed plugin dump (has `_variables`). No REST refetch of the
kit. Optional live check of Card-Image if `FIGMA_TOKEN` is present.
The scorecard is [SCORECARD.md](./SCORECARD.md). `out/` is gitignored.
