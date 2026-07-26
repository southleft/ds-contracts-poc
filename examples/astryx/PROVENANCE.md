# examples/astryx — provenance

The extraction subject for the second-system exhibit (Phase A). Everything in this
directory derives from the **exact npm-shipped artifact** — no clone, no fork, no
patched source.

## Subject

| | |
|---|---|
| System | **Astryx** — Meta's design system (facebook/astryx), open-sourced 2026-06-18 |
| Package | `@astryxdesign/core` — **0.1.6, PINNED** (beta 0.1.x; expect API churn — never float) |
| Theme | `@astryxdesign/theme-neutral` — **0.1.6, PINNED** |
| License | **MIT** (`package.json` `"license": "MIT"`, author "Meta Open Source"; the repo `facebook/astryx` is MIT. The 0.1.6 tarball ships no standalone LICENSE file — the license grant is the package manifest + repo.) |
| Source of truth | `node_modules/@astryxdesign/core/src` — the package **ships its TSX source** (375 `.tsx` files). Extraction provenance = the exact shipped artifact. |
| Vendor ground truth | 196 per-component `.doc.mjs` modules (props table + anatomy table + usage guidance), shipped in the same package — the independent referee for our proposals |
| Docs site | https://astryx.atmeta.com/components |
| Repo | https://github.com/facebook/astryx |
| Styling | React + StyleX (compile-time atomic classes); tokens in `src/theme/tokens.stylex.ts` (186 vars, `light-dark()` value-encoded modes); `theme-neutral/dist/theme.css` ships 178 literal custom properties |
| Assessed | `extract/pilots/SECOND-SYSTEM-ASSESSMENT.md` (2026-07-20) — the hands-on four-way assessment that selected Astryx |

## Design-side leg (future)

The assessment (§6d) records that Astryx's Figma kit is an **unofficial community
kit, v0.14** — there is no official Meta-published Figma library as of 0.1.6. No
community-file URL was pinned in the assessment; the design-side leg of this
exhibit must locate and PIN the exact community file (key + version) before any
reconcile run, and must treat it as third-party, not vendor ground truth.

## Reproduce the sandbox

```bash
cd examples/astryx/.astryx-sandbox   # gitignored, like polaris/.polaris-clone
printf '{\n  "name": "astryx-sandbox",\n  "private": true,\n  "version": "0.0.0"\n}\n' > package.json
npm install --no-audit --no-fund @astryxdesign/core@0.1.6 @astryxdesign/theme-neutral@0.1.6

# then, from the repo root — the SAME pipeline any adopter runs:
npm run extract:code -- examples/astryx/extract.config.json
```

## Minted-literal provenance (the re-anchoring round)

`tokens/astryx-minted.dtcg.json` holds the computed-floor leaves the DTCG wrap
cannot name (`imported.*`). Its values come from browser-computed truth, so
their PROVENANCE IS THE VALUE — StyleX compiles the source token name away
into a literal hex in the atomic class, which is why this example ships **no
`source-bindings.json`** and cannot run MUI's evidence-driven alias pass
(`examples/mui/scripts/promote-floor.mjs`).

Nine of those leaves are no longer literals. Their provenance is a **human
ledger**, not an extraction fact:

| | |
|---|---|
| Pass | `scripts/reanchor-minted.ts` (`--propose` / `--apply`) |
| Anchor plane | `tokens/astryx.dtcg.json` — THEME-NEUTRAL, value-fingerprinted; a re-themed anchor is refused by name |
| Review queue | `tokens/reanchor-proposals.{json,md}` — 21 rows; the 54 ambiguous refs are a human's to decide and no ranking may decide them |
| Ledger | `tokens/reanchor-decisions.json` — 9 acked rows, each with rationale, `darkDelta` ack and named cause |
| Receipt | `tokens/MINTED.md` — N aliased / N literal / N named refusals |
| Convergence | `scripts/promote-floor.ts` re-applies the ledger after regenerating the tree, so a re-run cannot silently revert a decision |

The nine are **not vendor facts**. They are a value join (1 leaf : 1
equal-valued semantic token) corroborated by a committed sibling binding in
the same contract cell, then explicitly acked. Reverting one is deleting its
row and re-running `promote-floor.ts`.

## License attribution

Astryx is Copyright (c) Meta Platforms, Inc. and affiliates, MIT-licensed.
This directory quotes prop names, enum values, token names/values, and `.doc.mjs`
table contents as extraction evidence, and commits mechanical transformations of
the published token values (verbatim values, DTCG-wrapped). No Astryx source
files are vendored into this repository; the sandbox install is gitignored and
reproduced by the pinned command above.
