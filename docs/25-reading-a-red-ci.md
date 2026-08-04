# Reading a red CI

Until 2026-08-04 this repository had no `.github/` directory. Thirty-three gate
scripts existed and every one of them fired only when a human typed it — which
is exactly how the live playground served a three-week-old plugin build behind
green build guards, and how the published CLI drifted from this tree under the
same version number. A pull request got zero automated verification.

It now runs in lanes. This page tells you which lane went red, what that
particular gate is asserting, and the one command that reproduces it on your
machine.

## The lanes

| Lane | Triggers | Gate steps | Measured gate time |
| --- | --- | --- | --- |
| [`fast`](../.github/workflows/fast.yml) | every push, every PR | 10 | 8.2s, 10/10 green — plus checkout and `npm ci` |
| [`full`](../.github/workflows/full.yml) | every PR, every push to `main` | 28 | 926.7s, 28/28 green — `npm run eval` is 883.1s of it; the other 27 total 43.6s |
| [`deploy-check`](../.github/workflows/deploy-check.yml) | daily at 13:00 UTC, and on demand | 1 | not measured here — it depends on three builds and on live network |

Of the 33 gate scripts, 5 run in `fast`, 27 run in `full`, and `deploy:check` is
the scheduled one. The remaining steps in the two lanes are the `packages/cli`
and `.github/scripts` typechecks, `ci:lanes`, `verify:catalog`,
`test:onboarding` and `verify:package` — not among the 33, but named in
[CONTRIBUTING.md](../CONTRIBUTING.md) and cheap. `npm run ci:lanes` re-derives
that split on every run and refuses if a gate ends up in neither lane.

Measurements: `npm run ci:lane <lane>` on Node v20.19.4, macOS arm64, at commit
8a5c455. A GitHub runner will be slower; the job timeouts (15 and 60 minutes)
are set with room for that.

Every gate is its own step, guarded so it runs even when an earlier gate failed.
One red gate never hides the ones behind it — you get the whole picture from a
single run, and the job fails at the end. `continue-on-error` is deliberately
not used anywhere: it would paint a failing gate green.

## Reproduce a lane locally

```bash
npm run ci:lane fast      # runs the gate steps fast.yml declares, in order
npm run ci:lane full      # same for the full lane
```

This reads the workflow file rather than keeping its own copy of the list, so
the local run and CI cannot drift apart. It prints a pass/fail line and a wall
time per gate, and — like CI — it runs every gate even after one fails.

It does **not** run the lane's preparation steps (`npm ci`, the browser install,
the three artifact builds); it prints them instead, because on a developer
machine they want sudo or would blow away a working `node_modules`. If a gate
fails on a missing artifact, run the preparation step it printed.

In CI those preparation steps carry the same guard the gates do, so a broken
`plugin:zip` costs you `plugin:ui-check` — which refuses naming the file it
could not find — and not the other 27 results. Only `npm ci` is a hard stop.

## What CI builds that your checkout does not have

Four artifacts are gitignored, so a fresh clone does not have them and the gate
that consumes each one will refuse **by name** rather than silently pass:

| Missing artifact | Refuses in | Build it with |
| --- | --- | --- |
| `packages/cli/dist/cli.js` | `publish:check`, `dagger:census`, `paste:check` | `npm --prefix packages/cli run build` |
| `dist/index.js` | `verify:package` | `npm run build:lib` |
| `figma-sync/plugin-dist/ui.html` | `plugin:ui-check` | `npm run plugin:zip` |
| `playground/dist/`, `site/dist/` | `deploy:check` | `npm run plugin:zip && npm run build:playground && npm run site:build` |

`REFUSED: packages/cli/dist/cli.js is not built` in a CI log means the workflow
lost its build step, not that the registry comparison found something.

## Gate by gate

### Fast lane

| Red gate | What it means | Reproduce |
| --- | --- | --- |
| `ci:lanes` | A gate script exists that no lane runs and no exclusion names; or a lane points at a script that does not exist; or a gate step lost its independent-reporting guard. | `npm run ci:lanes` |
| `typecheck` | TypeScript errors under `src`, `scripts`, `core`, `extract`, `parity`, `evals`, `conformance`. | `npm run typecheck` |
| `typecheck packages/cli` | TypeScript errors in the published CLI's sources. | `npm --prefix packages/cli run typecheck` |
| `typecheck .github/scripts` | The CI helper scripts do not compile. The root `tsconfig.json` does not include `.github`, so this is their only check. | `npx tsc --noEmit -p .github/scripts/tsconfig.json` |
| `docs:check` | A number or a relative link in a gated document disagrees with the repo. It names the file, the line, what the doc says and what was derived. It never runs the eval suite — if you changed the eval count, run `npm run eval` first so `evals/results.json` is current. | `npm run docs:check` |
| `capability:fresh` | `docs/24-what-works.md` is no longer byte-identical to a rebuild from its sources. Regenerate with `npm run capability:report`. | `npm run capability:fresh` |
| `ledger:fresh` | `LEDGER.md` or `RESIDUALS.md` under `extract/figma/ledger/` drifted from a rebuild. | `npm run ledger:fresh` |
| `publish:check` | The version in `packages/cli/package.json` **is** on the npm registry and the bytes differ from this tree's build — so `npm i -g @ds-contracts/cli`, the first command in every doc, hands adopters something this repo does not test. Fix by bumping the version, or by reverting the tree. A version that is *not* published yet is a **pass**, and says so. | `npm run publish:check` |
| `verify:catalog` | The sharded catalog no longer matches `catalog.json`. | `npm run verify:catalog` |
| `test:onboarding` | The CLI's `node:test` suite (draft-capture-config, accept-candidates, init-detect, library-scorecard, onboard). | `npm run test:onboarding` |

### Full lane

| Red gate | What it means | Reproduce |
| --- | --- | --- |
| `eval` | The deterministic suite: determinism, refusal, detection, convergence. It names the case. This is the gate [CONTRIBUTING.md](../CONTRIBUTING.md) points at when it says a capability claim needs an eval behind it; see also [docs/07](07-validation.md). | `npm run eval` |
| `plugin:check` | The Figma plugin engine against the mocked canvas — bundle drift, generate, ordering, update report, propose, PR dry run, the standing channel, read-only enforcement. Its first flow compares a fresh engine bundle to the committed `figma-sync/plugin/engine.receipt.json`; if that is what failed, the engine changed and the receipt was not re-recorded. | `npm run plugin:check` |
| `plugin:ui-check` | The packaged `ui.html` driven in real Chrome, plus a static sweep that fails when the plugin README or any `docs/*.md` describes a surface that was deleted. Needs `npm run plugin:zip` first. | `npm run plugin:ui-check` |
| `paste:check` | The developer path — contract to CLI bundle to paste — stopped running end to end for one of the two kits. It executes the built `packages/cli/dist/cli.js`, so build the CLI first. | `npm --prefix packages/cli run build && npm run paste:check` |
| `mint:check` | A token-minting invariant broke: dedupe, per-variant, refusal on a ragged matrix, or determinism. | `npm run mint:check` |
| `emitters:check` | An emitter invariant broke across the four contracts and the registry. | `npm run emitters:check` |
| `core:browser-check` | The core barrel stopped bundling for `platform=browser` (usually a new `node:*` import somewhere in the core graph), or the emitters stopped running in a VM with no node globals. | `npm run core:browser-check` |
| `verify:package` | The built package no longer imports cleanly or no longer server-renders. Needs `npm run build:lib` first. | `npm run verify:package` |
| `dagger:census` | A corpus now drops a different set of facts than it did when the census was last reviewed. Either the engine improved (re-review and re-record) or something started being lost silently. Refuses by name if the CLI is not built. | `npm --prefix packages/cli run build && npm run dagger:census` |
| `closure:check` | A channel the canvas can draw is neither read back nor named as lost. Note its own honest header: it covers a fraction of the channels a contract can carry, and says so on every run. | `npm run closure:check` |
| `figma:fresh` | A library's committed `figma/*.figma.js` is no longer byte-identical to a fresh emission — the engine moved and the artifacts did not. | `npm run figma:fresh` |
| `site:build` | The spec site stopped building, or schema coverage or the journey commands stopped agreeing with their manifests. | `npm run site:build` |
| `extract:computed:ceiling:check` | The computed reader stopped naming a stylesheet it could not read — the silent-`skips` defect. | `npm run extract:computed:ceiling:check` |
| `extract:figma:*:check` (fifteen) | One canvas-to-contract behaviour regressed: `base`, `cbds`, `cbds:batch`, `cbds:bridge`, `canvas`, `dialog`, `composite`, `cross`, `partstate`, `tooltip`, `overlap`, `wrap`, `constraints`, `repeat`, `theme`. They are separate steps precisely so a chain does not stop at the first one. | `npm run extract:figma:<name>:check` |

### The scheduled lane

`deploy-check` compares locally built artifacts against the bytes Cloudflare
Pages is serving. **It is expected to be red between a merge and a deploy** —
both Pages projects are direct-upload, so nothing ships until a human runs
`npm run deploy`. A red here means the world is looking at an older tree than
`main`; the fix is to deploy, not to change code.

This job has **never been executed** — GitHub Actions cannot be triggered from
the machine that wrote it. Its one unproven assumption is that the artifacts a
Linux runner builds are byte-identical to the ones a macOS `npm run deploy`
uploaded. The plugin zip is deterministic by construction; the vite content
hashes and the site HTML are not proven platform-independent. Treat its first
red as a claim to triage — reproduce with a local `npm run deploy:check` before
believing the live surfaces are stale.

## What is not in CI, and why

Naming these is the point. A gate that quietly does not run is worse than a gate
that does not exist.

- **`npm run parity`** — red today for a wall-clock reason, not a code one: the
  committed Figma snapshots under `parity/` are older than the differ's 14-day
  freshness ceiling, and refreshing them needs a human running the extraction
  plugin inside the live Figma file. It also rewrites `parity/report.json` on
  every run, so it would dirty the checkout. The differ's detection logic is
  covered by the `C3-detection` eval family, which does run.
- **`npm run build` followed by `git diff --exit-code`** (proving the generated
  output committed to the tree is what the generators produce today) — measured
  byte-inert on macOS/arm64 under Node 20.19.4, but not yet confirmed on Linux,
  and a false red here would be a platform difference wearing a contributor's
  name. Determinism itself is not unguarded: the `C1-determinism` eval family
  regenerates in a scratch copy and byte-compares. Wire this in once someone
  confirms it on `ubuntu-latest`.
- **`conformance`, `extract:figma:gauntlet:live*`, `extract:figma:visual`,
  `extract:figma:rest`, `extract:figma:mcp`, `roundtrip:code`,
  `adherence:aggregate`** — capture and replay instruments, not invariants. Each
  needs a live Figma file, a Figma token, or a banked artifact directory that is
  gitignored.
- **`seed:verify`, `extract:computed:drift`, `mint:code:check`** — carried with
  their reasons in the `EXCLUDED` table at the top of
  [`.github/scripts/lane-coverage.ts`](../.github/scripts/lane-coverage.ts).
  `npm run ci:lanes` fails if one of those reasons goes stale, or if a lane
  starts running something the table claims it does not.

## Node and browsers

CI pins Node to **20.19.4** — the exact version the gates were verified on, not
a floating `20.x`. `package.json` and `packages/cli/package.json` both declare
`engines.node >= 20`.

This repo depends on `playwright-core`, which ships no browser. Three gates need
one, and they need two different ones:

- `eval` and `extract:computed:ceiling:check` resolve through
  `chromiumExecutable()` in `extract/figma/visual-parity/render.ts` —
  `PLAYWRIGHT_CHROMIUM_PATH`, then the `ms-playwright` cache, then a system
  Chrome. Locally: `npx playwright install chromium`, or point the environment
  variable at a browser you already have.
- `plugin:ui-check` launches `channel: 'chrome'` — a **real Google Chrome**,
  which a playwright Chromium download does not satisfy. GitHub's ubuntu runner
  images preinstall it.

`.github/scripts/resolve-browsers.ts` launches both before any gate runs, so a
missing browser fails in a step that names which gates it takes down, rather
than fifteen minutes later inside an eval case where it reads like an engine
defect.
