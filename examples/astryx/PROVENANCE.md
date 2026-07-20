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

## License attribution

Astryx is Copyright (c) Meta Platforms, Inc. and affiliates, MIT-licensed.
This directory quotes prop names, enum values, token names/values, and `.doc.mjs`
table contents as extraction evidence, and commits mechanical transformations of
the published token values (verbatim values, DTCG-wrapped). No Astryx source
files are vendored into this repository; the sandbox install is gitignored and
reproduced by the pinned command above.
