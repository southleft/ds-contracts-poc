---
title: "Testing and gates — how everything is verified"
doc_id: 09-testing-and-gates
audience: "Another AI platform with ZERO prior knowledge of this project"
status: authoritative
last_updated: 2026-07-21
reading_order: 9
prerequisites: [05-architecture, 07-status-what-works]
related: [08-status-what-doesnt-work, 12-reference]
---

# Testing and gates

## The philosophy

**No claim without an executable check.** Every capability in `07` maps to a
gate. The eval suite is the spine; additional standing gates guard determinism,
byte-stability, and the plugin engine.

## The eval suite — `npm run eval` (`evals/run.ts`), 146 checks

Each eval declares a `claim`. Families and counts below are by `claim:`
occurrence (they sum to ~147 claim-strings across the 146 gated cases — one is a
non-case reference; treat the counts as indicative):

| Claim | Count | Meaning |
|-------|-------|---------|
| `C1-determinism` | 27 | byte-reproducibility, golden, determinism, plugin engine |
| `C2-refusal` | 17 | invalid inputs refuse *by name* |
| `C3-detection` | 40 | drift detection (code/design ahead/behind/mismatch, tokens) |
| `C4-convergence` | 3 | iterative fix / convergence |
| `C5-extraction` | 50 | code→contract and figma→contract extraction |
| `C6-theming` | 1 | brand/token theming |
| `C7-cli` | 4 | CLI smoke + emitter-plugin-loads + wc round-trip |
| `C8-journey` | 5 | end-to-end journey pins (incl. the composite + reverse journey) |

The runner copies a scratch workspace, regenerates outputs, and byte-compares
against the golden manifest. It writes `evals/results.json`. Exit 0 = all pass.

**Note for a fresh AI:** the eval runner symlinks `ROOT/node_modules` into its
scratch dir, so it **cannot run inside a git worktree** (worktrees lack
`node_modules`). Run it on the main checkout.

## The standing gates you must keep green

| Gate | Command | Guards |
|------|---------|--------|
| eval suite | `npm run eval` | everything above (146/146) |
| golden byte-hash | inside eval (`golden-generated-output`) | `src/` + `figma-sync/` are byte-stable; `npm run golden:update` on reviewed changes only |
| plugin engine | `npm run plugin:check` | `window.DSC` builds correct anatomy from a bundle; specHash mirror; drift refusal |
| determinism | `node scripts/deterministic-roundtrip.mjs` | contract→canvas byte-identical across two runs; loop closes |
| census | `extract:figma:gauntlet` | 1,618 sets propose with zero skips |
| browser purity | `node scripts/core-browser-check.mjs` | core barrel bundles for browser; 4 emitters run in a no-node VM |
| emitters | `npm run emitters:check` | registry invariants |
| typecheck | `npx tsc --noEmit` + `tsc -p tsconfig.build.json` | types |
| plugin drift | `node scripts/build-plugin-zip.mjs` | engine bundle matches `engine.receipt.json` (refuses stale by name) |

## Key gates by name (for continuation)

- `deterministic-roundtrip` — the determinism proof (C1).
- `plugin-engine-bundle`, `plugin-update-report`, `plugin-propose-dry-run` — run
  `plugin-engine-check.mjs`, which internally covers `composite-plugin-path`
  (contract→canvas) and `composite-reverse-journey` (canvas→contract).
- `depth-composite-child-collection` — the composite emits on all 4 surfaces +
  anatomy parity (runs `examples/depth-composite/emit-composite-receipt.ts`).
- `single-root-golden-invariant` — multi-root generalization is additive; single-
  root output unchanged.
- `emitter-multi-root-modal` — the captured Modal emits on all surfaces.

## How a brand-new AI verifies the project from a clean clone

```bash
git clone github.com/southleft/ds-contracts-poc && cd ds-contracts-poc
npm install
npm run eval            # expect: 146/146 evals passed
npm run plugin:check    # expect: plugin-engine-check: all flows green
node scripts/deterministic-roundtrip.mjs   # expect: THE FULL LOOP RAN WITH ZERO AI
npx tsc --noEmit        # expect: clean
```

If all pass, the deterministic pipeline is intact. Then read `08` — the passing
gates do **not** cover the composite's live rendering failures. Green here means
"the checks pass," not "everything renders."

## The mock-fidelity discipline (repeat after me)

When you find a bug that only appears on a live canvas, the fix has **two parts**:
(1) fix the emitter, (2) teach the mock to catch the class headlessly. Example
committed 2026-07-21: the SVG duplicate-`fill` bug — the mock's `createNodeFromSvg`
now validates and rejects duplicate attributes, so the class fails in Node
forever. Do this every time. It is how the gates earn trust.

Continue to `10-history.md`.
