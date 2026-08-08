# GitHub prerelease body — DRAFT for v1.0.0-rc.1

> **Status: DRAFT — prepared by automation 2026-08-08 for the release owner.**
> Everything below the `--- 8< ---` line is the proposed prerelease body.
> Fill every `<...>` placeholder at freeze time; strike one option in the
> v0.7.0 disposition section; delete this preamble before publishing.

## Owner notes (delete before publishing)

1. **A draft GitHub release and a pushed tag already exist.** Tag
   `v1.0.0-rc.1` is on origin pointing at `e148d2d` (main, 2026-08-05), with a
   1,200-char draft body that is now stale: it cites CLI `0.5.0-rc.1` (source
   is now `0.5.0-rc.2`) and 188/188 evals (now 199). The evidence in
   `RELEASE_CHECKLIST.md` is frozen on branch commit `4fda3b3`, which the tag
   does not point at. Before publishing, either (a) delete the draft release
   and the tag and re-tag the approved release commit after merge to main, or
   (b) re-freeze evidence on `e148d2d` — but do not publish a prerelease whose
   tag and evidence SHA disagree.
2. **CI at branch tip `1d243fa` is not green** as of 2026-08-08: `fast` failed
   (trap-corpus gate-shot references missing, `stretch:check`,
   `variant-drift:check` pin), `full` in progress, `catalog-visual` and
   `security` green. The CI links below are placeholders until the owner
   freezes a commit whose four required checks are all green.
3. Tarball hashes: run docs/27 §3 (`npm pack` × 3 + `shasum -a 256`) at the
   frozen commit and replace each `<SHA256-AT-FREEZE>`.

--- 8< ---

# Design System Contracts `1.0.0-rc.1` (prerelease)

Repository release candidate `1.0.0-rc.1` — the reference implementation of
contract-as-source-of-truth: deterministic code→Figma and Figma→code
conversion with named refusals instead of silent invention.

**This is a prerelease.** npm `latest` tags remain on the stable line
(CLI `0.4.0`, schema `16.0.0`, emitter `0.3.0`); RC packages ride the `next`
dist-tag only.

## Packages

| Package | RC version | Registry state at freeze | Tarball SHA-256 |
|---|---|---|---|
| `@ds-contracts/cli` | `0.5.0-rc.2` | **to be published** to `next` via `publish-rc.yml` (`next` currently `0.5.0-rc.1`) | `<SHA256-AT-FREEZE>` |
| `@ds-contracts/schema` | `16.1.0-rc.1` | **already published** on `next`; publish job byte-compares registry vs sealed local tarball | `<SHA256-AT-FREEZE>` |
| `@ds-contracts/emitter-web-components` | `0.4.0-rc.1` | **already published** on `next`; publish job byte-compares registry vs sealed local tarball | `<SHA256-AT-FREEZE>` |

Registry links:

- https://www.npmjs.com/package/@ds-contracts/cli/v/0.5.0-rc.2
- https://www.npmjs.com/package/@ds-contracts/schema/v/16.1.0-rc.1
- https://www.npmjs.com/package/@ds-contracts/emitter-web-components/v/0.4.0-rc.1

Install the exact RC while evaluating (do not rely on ranges):

```bash
npm i -E @ds-contracts/cli@0.5.0-rc.2 @ds-contracts/schema@16.1.0-rc.1 @ds-contracts/emitter-web-components@0.4.0-rc.1
```

## Attestation

Publication runs through `.github/workflows/publish-rc.yml`:
`workflow_dispatch`-only from `main`, typed `PUBLISH_RC` confirmation, sealed
tarballs with a `SHA256SUMS` receipt, and a publish job gated by the protected
`npm-rc` environment holding `id-token: write`. Each package is published with
`npm publish --access public --tag next --provenance` via **npm trusted
publishing (OIDC — no long-lived token)**, producing registry-verifiable
GitHub Actions build provenance tied to the release commit. After publication,
every package — freshly published or pre-existing — is re-downloaded from the
registry and byte-compared against the sealed local tarball; a mismatch fails
the run. A local OTP `npm publish` was **not** used; if that path is ever
taken it is not attested and the exception must be recorded here.

Verify independently:

```bash
npm view @ds-contracts/cli@0.5.0-rc.2 dist.integrity dist.tarball --json
npm view @ds-contracts/schema@16.1.0-rc.1 dist.integrity dist.tarball --json
npm view @ds-contracts/emitter-web-components@0.4.0-rc.1 dist.integrity dist.tarball --json
```

## What changed since the last release (v0.6.0 tag / 0.7.0 entry)

Full detail: [CHANGELOG.md](https://github.com/southleft/ds-contracts-poc/blob/v1.0.0-rc.1/CHANGELOG.md). Headlines, defect-first per this project's own reporting rule:

**Corrections of previously published claims** (read these before the features):

- Round-trip and fidelity claims were re-measured and corrected — the pixel-gate
  premise had been inverted, one number was fabricated (pixelmatch never ran),
  and all 54 scorecards were rewritten into the honest shape.
- A live phantom part shipped in the MUI Autocomplete contract (a
  `visibility:hidden` clear button promoted as fully visible) — removed via a
  general non-painting invariant.
- The flagship brownfield pilot was 58/58 false-red (zero design properties had
  ever been compared); post-fix it reports 259 real findings.
- The published CLI could not run the documented first command (`onboard`
  absent from the tarball) — fixed by the 0.3.0 line; RC carries the full verb
  set.

**Added:**

- **Generality to eight libraries, one deterministic pipeline** — MUI (Emotion
  runtime), Flowbite/Tailwind v4, Carbon (config-only control case), Altitude
  (first shadow-DOM subject) joined Polaris, Astryx, Eventz-class CEM and the
  first-party corpus; the falsifiable engine-files-changed-per-library metric
  is published in docs/22.
- **The conformance fixture** — a synthetic CSS/DOM design system whose
  expected dispositions are authored independently of the engine; a construct
  neither carried nor named-refused is a hard failure.
- **`ds-contracts onboard`** — code → canvas in two commands with a
  non-skippable human review gate; `promote` as a real verb; single-JSON
  CONTRACTS-BUNDLE paste (`figma bundle`); the standing CI↔Figma channel with
  write/read key split; drift-aware plugin Apply with per-variant fingerprints.
- **Release engineering** — `ci:lane fast|full|catalog-visual`, security
  workflow (dependency review / npm audit / secret scan), `docs:check`
  re-deriving every number the docs quote, RC build matrix on Ubuntu+macOS,
  and the OIDC publication workflow above.
- **Exact-conversion waves 0–11** — accuracy grammar ratchets, live Figma
  drift evidence gates, Console MCP loops over 128 component stems, human-gate
  inventory, and the frozen conformance subset v0.1 for a second
  implementation (`spec/conformance/`).
- Eval suite **129 → 199** deterministic checks.

## Migration notes (rc.2)

- **CLI `0.5.0-rc.2`** is newer than stable `0.4.0` **and** than the published
  `next` RC (`0.5.0-rc.1`); install it by exact version while it is an RC.
  Re-run dry-run/review stages before allowing `promote`,
  `figma receive --apply`, or PR-writing commands to change files.
- **Promotion now carries and checks contract provenance.** A stale capture may
  be refused instead of overwriting a newer approved contract. Preserve the
  provenance fields and anchor sidecars; do not strip them to bypass a refusal.
- **Static extraction may refuse or leave geometry-only content empty** instead
  of inventing visible text. Review proposals that previously depended on a
  placeholder.
- **Schema `16.1.0-rc.1` remains spec v16.** Consumers must test validation and
  generated types against the RC before changing their range.
- **Emitter `0.4.0-rc.1`** is newer than stable `0.3.0`. Install the exact RC,
  regenerate in a disposable output directory, and compare emitted Custom
  Elements, CSS, demos, and Custom Elements Manifest output before adopting.
- **npm `latest` remains the stable line** during RC evaluation. Examples and
  automation must pin the exact RC or use the `next` tag intentionally.
- **Worker (assist) rollout:** the assist Worker now reserves the global model
  budget through the `BudgetCoordinator` Durable Object and stores bridge
  kind+payload atomically. Its first rollout requires Node 22+ for Wrangler
  and **must keep `ASSIST_ENABLED=false` through the next UTC-day boundary**
  before enabling the new coordinator, so the legacy KV day's spend cannot be
  reset mid-day.

## Evidence

- **Live Figma receipt:** [parity/receipts/live-figma-variant-drift.md](https://github.com/southleft/ds-contracts-poc/blob/v1.0.0-rc.1/parity/receipts/live-figma-variant-drift.md)
  — controlled edit inside one variant on `DS-Contracts-Testing`
  (`GnQnjSNBXtgtd2Ht0Hs1C8`): baseline `v6:3552508208` → edit `v6:4062076634`
  → restored clean; re-acknowledged over Console MCP Desktop Bridge
  2026-08-06. Machine twin and replay scripts committed alongside.
- **CI on the release commit `<RELEASE-SHA>`:**
  - `fast gates`: `<CI-RUN-URL-FAST>`
  - `full gate sweep`: `<CI-RUN-URL-FULL>`
  - `cross-surface catalog gate`: `<CI-RUN-URL-CATALOG-VISUAL>`
  - `security` (dependency review / npm audit / secret scan): `<CI-RUN-URL-SECURITY>`
  - `build RC` matrix (ubuntu + macos): `<CI-RUN-URL-RELEASE-CANDIDATE>`
- **Deployment status:** `<DEPLOYED | NOT-DEPLOYED-AT-RELEASE>` — post-deploy
  `deploy:check`: `<CI-RUN-URL-DEPLOY-CHECK>`

## Known limitations

Read before adopting: [docs/23 — Known Limitations](https://github.com/southleft/ds-contracts-poc/blob/v1.0.0-rc.1/docs/23-known-limitations.md)
(scope boundaries, the partial rows, and the honest gaps by name), with the
v1 boundary itself in [docs/26 — v1 definition](https://github.com/southleft/ds-contracts-poc/blob/v1.0.0-rc.1/docs/26-v1-definition.md).

## Historical `v0.7.0` tag disposition

The repository has no `v0.7.0` tag. Version `0.7.0` was introduced at commit
`cd886e97a2f45464d1b0883a2adce3efab6acdaa` on 2026-07-20. History is not
fabricated or moved. **Owner: strike one of the two options below and keep the
other in the published notes.**

- **Option A — sign the historical tag:** a signed annotated `v0.7.0` tag has
  been created pointing at exactly `cd886e97a2f45464d1b0883a2adce3efab6acdaa`
  and pushed without changing the commit. *(Owner/date: ____________)*
- **Option B — state the absence:** the `v0.7.0` tag is intentionally absent.
  The `0.7.0` changelog entry and its commit remain the authoritative record;
  no tag will be backfilled. *(Owner/date: ____________)*
