# Reading a red CI

Until 2026-08-04 this repository had no `.github/` directory. In that historical
snapshot, thirty-three gate scripts existed and every one of them fired only
when a human typed it — which
is exactly how the live playground served a three-week-old plugin build behind
green build guards, and how the published CLI drifted from this tree under the
same version number. A pull request got zero automated verification.

It now runs in lanes. This page tells you which lane went red, what that
particular gate is asserting, and the one command that reproduces it on your
machine.

## The lanes

| Lane | Triggers | Purpose |
| --- | --- | --- |
| [`fast`](../.github/workflows/fast.yml) | every push, every PR | source, package, docs, v1-definition, provenance, and cheap deterministic gates |
| [`full`](../.github/workflows/full.yml) | every PR, every push to `main` | browser-backed evals, plugin/package builds, corpus and extraction gates |
| [`catalog-visual`](../.github/workflows/catalog-visual.yml) | every PR, every push to `main` | cross-surface pixel regression with pinned Chromium and Inter |
| [`security`](../.github/workflows/security.yml) | PRs, pushes to `main`, weekly, and on demand | dependency review, npm audits, and secret scanning |
| [`deploy-check`](../.github/workflows/deploy-check.yml) | daily and on demand | live Cloudflare bytes versus a fresh build |

`npm run maintain` — the team gate `docs/BETA.md` names — is a composite of
named checks, and `npm run ci:lanes` expands every composite script to its
members and prints a COMPOSITE COVERAGE table proving each member runs in a
lane (or is excluded by name), so "maintain is green locally" and "the lanes
are green" are the same set of commands. Its members split by what they need:
`maintain` itself is token-free and cache-free (its quick checks run in `fast`;
`functional:flowbite`, which needs Chromium, and `parity:flowbite` run in
`full`, and `plugin:check` was already there), while `maintain:visual`
(`extract:figma:visual:catalog`) needs **`FIGMA_TOKEN`** (env or `.env.local`)
plus the gitignored Figma PNG cache under `extract/figma/visual-parity/out/`,
so on a clean clone it refuses with `FIGMA_TOKEN not found`. This repository
has no `FIGMA_TOKEN` Actions secret, so `maintain:visual` stays a local command
and is excluded by name; `npm run maintain:all` runs both halves.

Do not copy a gate count from this page. Run `npm run ci:lanes`; it derives the
current coverage from package scripts and workflow files, names exclusions,
and refuses a gate that belongs to no lane. Historical timings in workflow
comments are measurements at the named commit and platform, not current step
counts or service-level promises.

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

It does **not** run a lane's preparation steps (`npm ci`, browser/font installs,
or artifact builds); it prints them instead, because on a developer
machine they may need sudo or would blow away a working `node_modules`. If a gate
fails on a missing artifact, run the preparation step it printed.

In CI those preparation steps carry the same guard the gates do, so a broken
`plugin:zip` costs you `plugin:ui-check` — which refuses naming the file it
could not find — without hiding unrelated results. Only `npm ci` is a hard
stop.

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
| `test:v1-definition` / `v1:definition:check` | The pinned v1 requirement IDs, evidence commands, exclusions, compatibility floors, and links drifted. | `npm run test:v1-definition && npm run v1:definition:check` |
| `generation:atomic:check` | A late generation refusal left partial output behind. | `npm run generation:atomic:check` |
| `provenance:check` | A stale source could overwrite a newer approved contract change, or provenance was not preserved. | `npm run provenance:check` |
| `static:empty-content:check` | Static extraction invented visible content for a geometry-only root. | `npm run static:empty-content:check` |
| `variant-drift:check` / `canvas:binding:check` | The offline fixture no longer detects a one-variant part/layout/binding edit, or the fingerprint stopped carrying binding names. | `npm run canvas:binding:check && npm run variant-drift:check` |
| `tokens:snapshot:check` | The extracted Figma variable table no longer agrees with the committed token corpus. Snapshot age is printed separately from token parity. | `npm run tokens:snapshot:check` |
| `visual-truth:check` | A committed headless scorecard no longer matches its pinned PNG, a card was scored against a reference its lane receipt has since replaced, or a lane's headless pass-count fell below its `parity/receipts/console-loop/RATCHET.json` floor. A lane listed under that file's `advisory` block (today: `astryx`, floor held at 1 by owner decision while the headless count is 0) prints as a **warning** with its recorded reason and does not fail the lane — it fails again only if the lane drops below the count measured when the entry was written, or if the lane meets its floor and the stale entry was not removed. | `npm run visual-truth:check` |

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
| `extract:computed:portal:check` / `extract:computed:viewport:check` | Portal root selection regressed, or capture-window geometry leaked into a contract. | `npm run extract:computed:portal:check && npm run extract:computed:viewport:check` |
| `ua-baseline:check` / `scrim-demotion:check` | A refusal overclaims what its control proves, or an overlay layer is again treated as the component box. | `npm run ua-baseline:check && npm run scrim-demotion:check` |
| `extract:computed:font-slant:check` | An authored `font-style` stopped reaching `Part.declared`, or it reaches the contract and the canvas draws upright anyway (the FC-FONT-SLANT-NOT-CARRIED shape — the fact carried and the face lost). | `npm run extract:computed:font-slant:check` |
| `extract:figma:*:check` | A canvas-to-contract behaviour or note taxonomy regressed. Each current member is a separate workflow step so one failure does not hide another. Run `npm run ci:lane full` to execute the exact current set. | `npm run ci:lane full` |

### Catalog-visual lane

`catalog:visual:check` compares the HTML and canvas renderers across the
committed catalog. It requires the Playwright Chromium revision from the
lockfile and the Inter font. A missing font is an environment refusal; a
masked painted-box delta is a rendering change. Reproduce with
`npm run ci:lane catalog-visual` after satisfying the printed prerequisites.
If only the UNMASKED score moves on a text-bearing cell while its masked score and painted box stay put, the delta is glyph-only: read the run header's `Inter` line, then check whether a contract pinned a font-weight on purpose (bf82db06 did this to text-field) before calling it a regression — the fix is a reviewed `--write-baseline` on that platform, never a wider ε.

### Security workflow

- `dependency review` examines dependency changes on pull requests and blocks
  high-severity additions.
- `npm audit` runs both the repository-wide and production-only audit commands.
- `secret scan` examines changed commit history. Treat a verified or unknown
  credential finding as a release blocker; do not paste the secret into an
  issue while triaging it.

### The scheduled lane

`deploy-check` compares locally built artifacts against the bytes Cloudflare
Pages is serving. **It is expected to be red between a merge and a deploy** —
both Pages projects are direct-upload, so nothing ships until a human runs
`npm run deploy`. A red here means the world is looking at an older tree than
`main`; the fix is to deploy, not to change code.

The cross-platform assumption still needs release evidence: artifacts built on
the Linux runner must agree with the macOS release rehearsal. The plugin zip is
deterministic by construction; Vite hashes and site HTML must be verified, not
assumed. Treat an unexplained platform-only red as a claim to triage and record
the disposition in the release checklist.

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
  output committed to the tree is what the generators produce today) — an
  earlier version of this page called it "measured byte-inert"; it was not (on
  2026-08-22 both committed `contract.schema.json` copies were eleven days
  behind the Zod document). The schema half of that claim now has its own gate,
  `schema:fresh`, in the fast lane; determinism itself is covered by the
  `C1-determinism` eval family, which regenerates in a scratch copy and
  byte-compares.
- **`extract:figma:visual:catalog` / `npm run maintain:visual`** — needs
  `FIGMA_TOKEN` and the gitignored PNG cache; see the `maintain` paragraph under
  "The lanes" and its `EXCLUDED` entry in `lane-coverage.ts`.
- **`conformance`, `extract:figma:gauntlet:live*`, `extract:figma:visual`,
  `extract:figma:rest`, `extract:figma:mcp`, `roundtrip:code`,
  `adherence:aggregate`** — capture and replay instruments, not invariants. Each
  needs a live Figma file, a Figma token, or a banked artifact directory that is
  gitignored.
- **`seed:verify`, `mint:code:check`** — carried with
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
