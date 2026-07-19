# computed-spike — the code-side capture floor, designed and proven

Design + working spike for computed-style truth read from real rendered
components in a real browser — the code-side mirror of the design-side plugin's
resolved-value floor. **No engine edits**: everything lives in this directory;
`core/` and the schema are only imported read-only.

- [DESIGN.md](./DESIGN.md) — the full design (mounting recipe, enumeration
  policy with the per-axis/pairwise sufficiency analysis, state sweep, the
  read + determinism pinning, DOM→anatomy mapping, fusion, the
  definition-of-done gate).
- [REPORT.md](./REPORT.md) — the spike's numbers, verbatim, plus findings.
- [LEDGER.md](./LEDGER.md) — bound / minted / code-only, every refusal and
  every binding contradiction named.
- `captured-truth.button.json` — capture (a): provenance + per-combo/state
  per-element computed deltas.
- `button.enriched.contract.json` / `button.enriched.extension.json` —
  capture (b): the prototype enriched contract (ContractSchema-valid) and the
  clearly-marked non-schema overflow block.
- `numbers.json` / `pixel-rows.json` — capture (c): the like-for-like numbers.
- `receipts/` — sample pairs (left = original `@shopify/polaris` render,
  right = replay from captured truth, same browser).

## Reproduce

```bash
# one-time: harness sandbox OUTSIDE the repo (network needed here only)
mkdir -p /tmp/polaris-harness && cd /tmp/polaris-harness
npm init -y && npm i @shopify/polaris@13.9.5 react@18 react-dom@18 esbuild

# the run (network-free; needs a local Chromium — playwright cache or system Chrome)
npx tsx extract/computed-spike/run.ts --harness /tmp/polaris-harness
```

Regenerates every committed artifact in place (~2.5 min). The capture is
double-run and byte-identity-asserted within the session; cross-browser-build
drift is expected and visible (browser version is provenance).
