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

Tokens (`00-tokens.figma.js`) are assumed present on MUI Test 1 (MUI +
Primitives/Brand/Semantic collections). Do not shrink the denominator.
