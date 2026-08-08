# Console MCP — MUI denominator loop

Live feedback loop on
[MUI Test 1](https://www.figma.com/design/59mLQlOMiD5w5za6SUcoO5/MUI-Test-1)
(`59mLQlOMiD5w5za6SUcoO5`) for every stem in
`examples/mui/oracle/DENOMINATOR-50.json` (31 members).

Per stem: ensure component set on canvas (generate from
`examples/mui/figma/<stem>.figma.js` via chunked `figma_execute` if missing) →
screenshot → visual audit → v6 fingerprint → light round-trip → receipt under
`components/`.

```bash
npm run console-loop:mui:evidence:check
```

**STRICT since 2026-08-08** (J8 — measured visual evidence). Every denominator
stem carries a pixel scorecard at `scores/<stem>.json`: the canvas VARIANT
cell rendered headlessly via the Figma REST images API at scale 1 (the file
was not open on the Desktop Bridge — REST-only run), scored by
`console-loop-developed-score` against the committed developed reference
under `refs/<stem>.png` (copied from the stem's computed-capture gate-shot;
fab/icon-button/radio/select regated offline 2026-08-08 to produce theirs).
The gate reads scorecards, never receipt booleans — a visual pass-claim
without a passing, hash-pinned scorecard fails CI by name. A pass is claimed
only when it holds on BOTH instruments (lane scorer + headless visual-truth
card): 4 scored-pass (checkbox, divider, snackbar, table), 27 honest
fail-closed with named defects. RATCHET floor: 4. MUI's Roboto stays
UNCONFIGURED in `cfg.fonts` this round (FC-FONT-SUBSTRATE; tailwind/astryx
precedent) — the refs render the CSS fallback stack, which is a named defect
class on the text-heavy fail-closed stems, not a silent excuse.

Tokens (`00-tokens.figma.js`) are assumed present on MUI Test 1 (MUI +
Primitives/Brand/Semantic collections). Do not shrink the denominator.
