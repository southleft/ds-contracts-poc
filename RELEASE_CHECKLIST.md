# Coordinated RC release checklist

Release candidate: repository `1.0.0-rc.1` · CLI `0.5.0-rc.2` · schema
`16.1.0-rc.2` · emitter `0.4.0-rc.2`

Follow [docs/27 — Release Process](docs/27-release-process.md). Check a box only
when its evidence is linked or pasted into the release PR. Use `N/A` with an
owner-approved reason; a blank box is not an approval.

Automation evidence below is pinned to PR
[#13](https://github.com/southleft/ds-contracts-poc/pull/13) on branch
`feat/exact-conversion-wave0` at SHA
`4fda3b3d6e0f2109cc160941e265b57b3a158b2b` unless a later release freeze is
explicitly chosen. See
[`.agents/runs/post-exact-conversion-next-waves/HUMAN-HANDOFF.md`](.agents/runs/post-exact-conversion-next-waves/HUMAN-HANDOFF.md).

## Immutable inputs

- [x] Release commit SHA: `4fda3b3d6e0f2109cc160941e265b57b3a158b2b` (automation evidence freeze; release owner may re-freeze after handoff-only commits)
- [x] Release branch: `feat/exact-conversion-wave0` → PR #13
- [x] Working-tree disposition: clean at evidence SHA; handoff/checklist follow-on commits are docs-only
- [x] Node and npm versions: Node `v20.19.4`, npm `10.8.2` (local macOS arm64 Darwin 26.3); CI uses Node `20.19.4`
- [x] `package-lock.json` SHA-256: `01c0f67634f98bb41eb97bdb17e68e841b54496d5604b4df80673582eefbb7ec`
- [x] Manifest versions reviewed: root `1.0.0-rc.1`, CLI `0.5.0-rc.2`, schema `16.1.0-rc.2`, emitter `0.4.0-rc.2`
- [ ] npm registry/dist-tag query attached: **blocked — human/release** (publish path)
- [ ] Existing-version collision check passed: **blocked — human/release** (publish path)

## Clean macOS rehearsal

- [ ] `npm ci`: **not re-run this session** (existing `node_modules` used; CI `npm ci` green on PR #13)
- [x] `npm run ci:lanes`: pass (inside fast lane)
- [x] `npm run docs:check`: pass
- [x] `npm run test:v1-definition`: pass
- [x] `npm run v1:definition:check`: pass
- [x] `npm run ci:lane fast`: **53/53** @ `4fda3b3`
- [x] `npm run ci:lane full`: **33/33** @ `4fda3b3`
- [x] `npm run ci:lane catalog-visual`: **1/1** @ `4fda3b3` (Inter true; 195 cells vs baseline)
- [x] `npm run audit:production`: 0 vulnerabilities (high+)
- [x] Browser and font prerequisites recorded: Playwright Chromium via `playwright-core`; catalog-visual reported `Inter true` on local macOS arm64

## Linux and GitHub evidence

- [x] Required `fast` check green: PR #13 `fast gates` SUCCESS
- [x] Required `full` check green: PR #13 `full gate sweep` SUCCESS
- [x] Required `catalog-visual` check green: PR #13 `cross-surface catalog gate` SUCCESS
- [x] Required `security` checks green: PR #13 `dependency review`, `npm audit`, `secret scan` SUCCESS
- [x] macOS/Linux difference review complete: local macOS lanes match required Ubuntu checks on same SHA; RC matrix `build RC (ubuntu-latest)` + `build RC (macos-latest)` SUCCESS
- [ ] Security owner approval: **blocked — human** (V1-SEC-01 disposition)

## Packages

- [x] Schema build and package smoke: fast lane `packages/schema` typecheck + package:smoke
- [x] CLI build and `publish:check`: fast lane CLI test/coverage + `publish:check`
- [x] Emitter build and package smoke: fast lane emitter typecheck + package:smoke
- [ ] Pack dry-run manifests reviewed: **blocked — human/release** (owner review of tarball contents)
- [ ] Tarball SHA-256 values attached: **blocked — human/release**
- [ ] Empty-directory tarball consumer smoke: **blocked — human/release**

## v1 and live evidence

- [x] All definition-of-v1 requirement evidence attached: automation commands green via fast/full/catalog-visual; see docs/26 + wave10 `AUDIT-LEDGER.md`
- [x] P0/P1 audit ledger has no open or waived automation row: `.agents/runs/post-exact-conversion-next-waves/wave10/AUDIT-LEDGER.md`
- [x] Live Figma drift receipt linked: `parity/receipts/live-figma-variant-drift.md` + `.json` on file `GnQnjSNBXtgtd2Ht0Hs1C8` · `npm run live-figma:evidence:check`
- [x] Figma controlled edit and restoration: Console MCP `figma_execute` re-ack (baseline `v6:3552508208` → edit `v6:4062076634` → restore); prior cloud `use_figma` same stamps; scripts under `parity/receipts/console-mcp/`
- [x] Final live Figma stamp/file state is clean: restored fingerprint matches baseline; Console MCP Desktop Bridge re-ack recorded 2026-08-06
- [x] Console MCP contract→Figma loop: 49/49 first-party components on Testing file · `npm run console-loop:evidence:check` · eval `console-loop-evidence-receipt`
- [ ] Migration notes reviewed: **blocked — human/release**
- [ ] Worker Durable Object migration rehearsed with Node 22+: **blocked — human/release**
- [ ] First Worker rollout keeps assist disabled through the UTC boundary: **blocked — human/release**
- [x] Known limitations linked: docs/23 + docs:check green

## Deployment rehearsal

- [ ] Plugin zip built and hashed: **blocked — human/release** (owner hash attach)
- [ ] Playground built and hashed: **blocked — human/release**
- [ ] Spec site built and hashed: **blocked — human/release** (`site:build` green in full lane; hash attach is owner)
- [ ] Pre-deploy `deploy:check` result/disposition: **blocked — human/release**
- [ ] Linux/macOS artifact comparison disposition: **blocked — human/release**

## Human approvals

- [ ] Exact release commit approved — owner/date:
- [ ] Signed RC tag approved — owner/date:
- [ ] GitHub prerelease approved — owner/date:
- [ ] npm schema publication approved — owner/date:
- [ ] npm emitter publication approved — owner/date:
- [ ] npm CLI publication approved — owner/date:
- [ ] npm provenance path approved — owner/date:
- [ ] If no registry attestation, exception approved and disclosed:
- [ ] Cloudflare deployment approved — owner/date:
- [ ] `v0.7.0` disposition approved:
  - [ ] signed historical tag at `cd886e97a2f45464d1b0883a2adce3efab6acdaa`; or
  - [ ] tag remains absent and GitHub release notes say so.

## Post-publication verification

- [ ] Schema exact RC exists and `next` resolves to it:
- [ ] Emitter exact RC exists and `next` resolves to it:
- [ ] CLI exact RC exists and `next` resolves to it:
- [ ] Schema `latest` still resolves to stable:
- [ ] Emitter `latest` still resolves to stable:
- [ ] CLI `latest` still resolves to stable:
- [ ] Registry integrity and attestation status recorded:
- [ ] Second clean registry install smoke:
- [ ] Signed tag verified:
- [ ] GitHub release is marked prerelease and links evidence:
- [ ] Deployment completed:
- [ ] Post-deploy `npm run deploy:check` green:
- [ ] Manually dispatched deploy check green on release commit:

## Rollback readiness

- [ ] Last approved npm dist-tags recorded:
- [ ] Last approved deploy commit recorded:
- [ ] Prior approved Figma bundle identified:
- [ ] Deprecation/withdrawal wording prepared:
- [ ] Release owner closed or invoked rollback:

Final decision: [ ] release approved · [x] release blocked · [ ] release rolled
back

Decision owner/date: automation agent 2026-08-06 — **blocked on human/release/second-impl rows only** (see HUMAN-HANDOFF.md). Not v1 shipped. Not Phase 3 Candidate.

Remaining conditions:
- Pilot persona sign-off
- Wave 8 team drift confirmation
- Live Figma edit+restore
- Security owner + publish/deploy approvals
- Wave 11-C named second implementation (do not fabricate)
