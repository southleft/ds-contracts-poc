# Fresh-clone certification — the "it is solid" receipt

> **Point-in-time note (2026-07-20):** this certification binds to commit `85b50d4` and describes THAT tree — every number below (99/99 evals, pre-packages, pre-computed-floor) is the certified commit's, not HEAD's. The suite has since grown to 127 evals and the repo now publishes `@ds-contracts/schema` / `@ds-contracts/cli`; a fresh-clone re-certification at the v0.7.0 boundary has not been run.

**Date:** 2026-07-12
**Certified commit:** `85b50d4` (the #53b cleanup batch HEAD; three fixes this certification itself demanded landed immediately after as `331275e` — see "What the certification caught," below)
**Procedure:** `git clone` of the committed state into an empty scratch directory → `npm ci` → every standing instrument run in sequence, exit codes and wall times recorded, `git status --porcelain` checked after each regenerating instrument (tracked-file diffs = the instrument does not reproduce its committed receipt). No symlinked `node_modules`, no `.env.local`, no credentials in the clone.

## Environment

| | |
|---|---|
| OS | macOS (Darwin 25.3.0, arm64) |
| Node | v20.19.4 (`engines` requires ≥ 20) |
| npm | 10.8.2 |
| Install | `npm ci` against the committed `package-lock.json` — clean, **0 vulnerabilities**, 2.5 s on a warm npm cache (a cold-cache stranger pays a network download; not measured here) |
| Chromium | resolved from the machine's playwright cache (two checks drive a real browser — see gaps) |

## Results — every standing instrument, pass/fail, elapsed

| # | Instrument | Result | Elapsed |
|---|---|---|---|
| 1 | `npm ci` | ✅ pass, 0 vulns | 2.5 s |
| 2 | `npm run build` (tokens → schema → generate, all 51 components) | ✅ pass | 2 s |
| 3 | **golden byte-check** — tracked tree after `build` | ✅ byte-identical | — |
| 4 | `npm run figma:plan` (canvas sync scripts regenerated) | ✅ pass | <1 s |
| 5 | **golden byte-check** — tracked tree after `figma:plan` | ✅ byte-identical | — |
| 6 | `npm run typecheck` (root tsc) | ✅ pass | 3 s |
| 7 | `npm run eval` — **99/99 evals** (includes the real-Chromium focus probe) | ✅ pass | 78 s |
| 8 | byte-check after `eval` (`evals/results.json` regenerated) | ✅ byte-identical | — |
| 9 | `npm run extract:code` (51 proposals from own library) | ✅ pass | <1 s |
| 10 | `npm run roundtrip:code` (29 matched · 22 code-absent · 0 mismatched) | ✅ pass | 1 s |
| 11 | byte-check after code extraction receipts | ✅ byte-identical | — |
| 12 | `npm run extract:figma:roundtrip` | ✅ pass | <1 s |
| 13 | `npm run extract:figma:rest:roundtrip` | ✅ pass | 1 s |
| 14 | `npm run extract:figma:mcp:receipt` | ✅ pass | <1 s |
| 15 | byte-check after figma round-trip receipts | ✅ byte-identical | — |
| 16 | `extract:figma:base:check` | ✅ pass | 1 s |
| 17 | `extract:figma:cbds:check` | ✅ pass | <1 s |
| 18 | `extract:figma:cbds:batch:check` | ✅ pass | 1 s |
| 19 | `extract:figma:cbds:bridge:check` (60 checks, zero refusals) | ✅ pass | <1 s |
| 20 | `extract:figma:canvas:check` | ✅ pass | <1 s |
| 21 | `extract:figma:dialog:check` | ✅ pass | 1 s |
| 22 | `extract:figma:composite:check` | ✅ pass | <1 s |
| 23 | `extract:figma:tooltip:check` | ✅ pass | <1 s |
| 24 | `extract:figma:overlap:check` | ✅ pass | 1 s |
| 25 | `extract:figma:repeat:check` | ✅ pass | <1 s |
| 26 | `extract:figma:theme:check` | ✅ pass | 1 s |
| 27 | `extract:figma:gauntlet` — the census, 1,618/1,618 | ✅ pass | 1 s |
| 28 | byte-check after census (`census.json`, `CENSUS.md`, fixtures) | ✅ byte-identical | — |
| 29 | `extract:figma:gauntlet:classfix` | ✅ pass | 1 s |
| 30 | `emitters:check` | ✅ pass | <1 s |
| 31 | `mint:check` | ✅ pass | 1 s |
| 32 | `mint:code:check` | ✅ pass | <1 s |
| 33 | `core:browser-check` (browser-platform bundle + bare-VM run) | ✅ pass | 1 s |
| 34 | `npm run parity` (three-way differ, offline against committed snapshots) | ✅ pass | 1 s |
| 35 | byte-check after parity (`parity/report.json`) | ✅ byte-identical | — |
| 36 | `npm run reconcile` (built-in config, parity-snapshot design side) | ✅ pass | <1 s |
| 37 | `npm run adherence:aggregate` (deterministic judge re-scores both arms) | ✅ pass, byte-identical | 1 s |
| 38 | `npm run catalog` + `npm run verify:catalog` | ✅ pass | 1 s |
| 39 | **byte-check after catalog** | ❌ **TRACKED DIFFS** — root-caused, fixed; see below | — |
| 40 | `npm run build:lib` + `npm run verify:package` (SSR from `dist/`) | ✅ pass | 2 s |
| 41 | `npx tsc -p playground --noEmit` | ✅ pass | 3 s |
| 42 | `npm run build:playground` (vite + **plugin-zip drift guard**) | ✅ pass, guard green | 1 s |
| 43 | `workers/assist`: `npm ci` → `typecheck` → `npm test` (handler + bridge suites) | ✅ pass | 4 s |
| 44 | `extract:figma:visual` **without** `FIGMA_TOKEN` (stranger probe) | ✅ fails BY NAME, exit 1 — see gaps | — |

`npm run judge` is parameterized (`judge -- <screen.tsx>`), exercised here through #37 and by two evals (`judge-passes-canonical-screen`, `judge-catches-all-violation-classes`) — not separately runnable without an argument, by design. Dev servers (`storybook`, `dashboard`, `playground`, `figma:serve`) and mutating tools (`golden:update`, `anchors:writeback`) are not certification instruments and were not run.

## What the certification caught (fixed at `331275e`)

1. **Stale committed catalog** (#39): `ds.token` went 1.1.0 (the live size scale) without the catalog being re-emitted — `catalog.json`, `index.json`, and `components/token.json` were behind their own source. Regenerated and committed. **Named residue:** catalog staleness has no standing guard (nothing fails when a contract changes and the catalog doesn't) — and the catalog embeds provenance (`catalogVersion`, `gitCommit`), so it can only ever byte-reproduce at the commit it was generated from. A catalog-freshness eval that compares everything *except* the provenance block is the identified fix.
2. **Hardcoded owner path in `env.ts`**: `extract/fidelity-matrix/scripts/env.ts` fell back to `/Users/tjpitre/Sites/ds-contracts-poc/.env.local` by absolute path — the certification's first "no token" probe *silently succeeded by reading the owner's token*. Now resolved portably (cwd `.env.local`, else the git main checkout's via `--git-common-dir`); a tokenless fresh clone fails by name (`FIGMA_TOKEN not found (env or .env.local)`), verified in both directions.
3. **macOS-only Chromium resolver**: `chromiumExecutable()` knew only the macOS playwright cache and `/Applications` Chrome — on Linux, even `npx playwright install chromium` would not have been found. Linux cache paths and `/usr/bin` fallbacks added; README's quick start now names the two Chromium-driven checks and both escape hatches.

## Stranger-readiness verdict

**Solid, with named edges.** A stranger on a Mac or Linux box with Node ≥ 20 and network for `npm ci` can clone this repository and reproduce **every committed receipt byte-for-byte** — build, golden, 99/99 evals, all 11 figma checks, the census, code/figma/REST/MCP round-trips, parity, the package build, the playground build with its drift guard, and the worker tests — in about three minutes of wall time, with **zero credentials and zero undocumented steps**. The gaps that remain are credentialed or environmental by nature, and every one fails by name rather than silently:

| Rank | Gap | Behavior a stranger sees | Status |
|---|---|---|---|
| 1 | `extract:figma:visual` needs `FIGMA_TOKEN` (ground-truth PNGs come from Figma's images API; the disk cache is gitignored, so a fresh clone has no offline path) | exit 1, `FIGMA_TOKEN not found (env or .env.local)` | named; an offline/fixture mode is separately in design |
| 2 | Two checks drive a real Chromium (the `focus-not-pressed-browser-probe` eval, and the visual-parity instrument). No browser → `npm run eval` fails on that one case | error names the fix: `npx playwright install chromium` or `PLAYWRIGHT_CHROMIUM_PATH` | resolver now covers macOS + Linux; Windows = env var only, untested |
| 3 | Visual-parity **scores** assume the subjects' fonts locally (Inter, SF Pro, Geist, Material Symbols) — a machine without them shifts text metrics; the masked score absorbs most but not all of it | REPORT.md's own header prints per-font availability, honestly | residue, self-documenting |
| 4 | Catalog staleness has no standing guard (the class behind finding #1) | nothing fails until someone regenerates | named; freshness eval is the fix |
| 5 | Visual-parity triptych PNGs for focus-visible rows are not byte-stable across runs (live browser focus rendering varies at the pixel level even when scores don't) — re-running with a token dirties 4 committed `report-assets/` PNGs | benign churn in `git status` | named residue |
| 6 | `npm ci` here rode a warm npm cache (2.5 s); a cold cache needs the registry. Node 20.19.4 is the only version exercised by this certification | — | untested, `engines` declares ≥ 20 |

Everything in the table above degrades **loudly**. Nothing in the standing suite depends on uncommitted state, the owner's machine, or a credential — that claim was false in one place when this certification started (`env.ts`), and the certification is why it is true now.

## Reproduce this certification

```bash
git clone <repo> fresh && cd fresh
npm ci
npm run build && git status --porcelain          # empty = golden holds
npm run eval                                     # 99/99
npm run extract:figma:gauntlet                   # census 1,618/1,618
npm run roundtrip:code && npm run extract:figma:roundtrip && npm run extract:figma:rest:roundtrip
for c in base cbds cbds:batch cbds:bridge canvas dialog composite tooltip overlap repeat theme; do npm run extract:figma:$c:check; done
npm run emitters:check && npm run mint:check && npm run mint:code:check && npm run core:browser-check
npm run parity && npm run catalog && npm run verify:catalog
npm run build:lib && npm run verify:package
npx tsc -p playground --noEmit && npm run build:playground
(cd workers/assist && npm ci && npm test)
git status --porcelain | grep -v '^??'           # empty = every receipt reproduced
```
