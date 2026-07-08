# 15 · The engine is a library

Every transformation in this PoC — contract→React, contract→Figma sync
script, contract→static HTML, contract→inline-styles React,
design-dump→proposed contract, source-text→proposed contract — is a pure
function in `core/`: data in (token trees as JSON objects, icon SVG strings,
contracts), strings out. Zero `node:*` imports in the whole module graph,
receipted by `npm run core:browser-check`, which bundles the barrel for
`platform=browser` and then runs all four emitters inside a VM with no node
globals.

The CLI scripts you run every day (`npm run generate`, `npm run figma:plan`,
`npm run extract:figma`) are thin shells: read files → call core → write
files. The shells' output is byte-guarded by `evals/golden.json`, so anything
that imports `core/index.ts` — a public playground, a CI bot, a design-tool
plugin — runs the *real* pipeline, not a demo copy of it. Formatting
included: the core formats with `prettier/standalone`, the same pass the CLI
ships.

Pluggability is a type, not a promise. An emitter is
`{ name, label, emit(contract, ctx) => files[] }`, and four are registered:
`react` (the shipping generator), `html` (no build step), `react-inline`
(no token pipeline — every token resolved to a literal, resolution mode named
in the output header), and `figma-script` (the canvas is just another emit
target). A new surface for the same contract is a new pure function; nothing
upstream changes. The new emitters carry their own receipts
(`npm run emitters:check`): every enum value produces a branch, every token
ref resolves or rides `var(--…)`, the inline output contains no
custom-property references, the HTML output contains no React. Import-cost
tiering: emit-only ≈ 216 KB min; + prettier ≈ 1.6 MB; + the TypeScript
compiler for code→contract ≈ 5 MB.
