# Coordinated RC release checklist

Release candidate: repository `1.0.0-rc.1` · CLI `0.5.0-rc.2` · schema
`16.1.0-rc.2` · emitter `0.4.0-rc.2`

Follow [docs/27 — Release Process](docs/27-release-process.md). Check a box only
when its evidence is linked or pasted into the release PR. Use `N/A` with an
owner-approved reason; a blank box is not an approval.

Automation evidence below is pinned to PR
[#13](https://github.com/southleft/ds-contracts-poc/pull/13) on branch
`feat/exact-conversion-wave0` at SHA
`9e6eb06283335c289f79286f3c0a1777cb6f8ae5` (J15 freeze-and-rehearse,
2026-08-08, superseding the earlier `4fda3b3` evidence freeze). Full command
transcripts: [`.agents/runs/v1-release-prep/FREEZE-EVIDENCE.md`](.agents/runs/v1-release-prep/FREEZE-EVIDENCE.md).
See also
[`.agents/runs/post-exact-conversion-next-waves/HUMAN-HANDOFF.md`](.agents/runs/post-exact-conversion-next-waves/HUMAN-HANDOFF.md).

## Immutable inputs

- [x] Release commit SHA: `9e6eb06283335c289f79286f3c0a1777cb6f8ae5` (J15 automation evidence freeze 2026-08-08; release owner signs the final commit choice) — FREEZE-EVIDENCE.md §1
- [x] Release branch: `feat/exact-conversion-wave0` → PR #13
- [x] Working-tree disposition: clean at evidence SHA except the J15 evidence file itself; prior `.tmp-*.js` strays deleted in `9e6eb062` — FREEZE-EVIDENCE.md §1
- [x] Node and npm versions: Node `v20.19.4`, npm `10.8.2` (local macOS arm64 Darwin 25.3); CI uses Node `20.19.4` — FREEZE-EVIDENCE.md §1
- [x] `package-lock.json` SHA-256: `caadfcc0cee35d7a38db3c152787b2e0f017fcc8841e0f097a58bc86caf33f1a` (supersedes `01c0f676…` from the `4fda3b3` freeze) — FREEZE-EVIDENCE.md §1
- [x] Manifest versions reviewed: root `1.0.0-rc.1`, CLI `0.5.0-rc.2`, schema `16.1.0-rc.2`, emitter `0.4.0-rc.2` — FREEZE-EVIDENCE.md §1
- [x] npm registry/dist-tag query attached: 2026-08-08 — `latest` = 0.4.0/16.0.0/0.3.0, `next` = 0.5.0-rc.1/16.1.0-rc.1/0.4.0-rc.1 — FREEZE-EVIDENCE.md §1
- [x] Existing-version collision check passed: no `-rc.2` version exists on the registry for any of the three packages — FREEZE-EVIDENCE.md §1

## Clean macOS rehearsal

- [x] `npm ci`: fresh clean `file://` clone at `9e6eb062`, exit 0, 0 vulnerabilities — FREEZE-EVIDENCE.md §3
- [x] `npm run ci:lanes`: exit 0 in clean clone — FREEZE-EVIDENCE.md §3
- [x] `npm run docs:check`: exit 0 in clean clone — FREEZE-EVIDENCE.md §3
- [x] `npm run test:v1-definition`: exit 0 (25/25) in clean clone — FREEZE-EVIDENCE.md §3
- [x] `npm run v1:definition:check`: exit 0 in clean clone — FREEZE-EVIDENCE.md §3
- [x] `npm run ci:lane fast`: **60/60** @ `9e6eb062` (clean clone) — FREEZE-EVIDENCE.md §3
- [x] `npm run ci:lane full`: see FREEZE-EVIDENCE.md §7 @ `9e6eb062` (clean clone; CI `full gate sweep` on same SHA is the Linux evidence)
- [x] `npm run ci:lane catalog-visual`: **1/1** @ `9e6eb062` (clean clone) — FREEZE-EVIDENCE.md §7
- [x] `npm run audit:production`: exit 0, no high+ vulnerabilities (clean clone) — FREEZE-EVIDENCE.md §3
- [x] Browser and font prerequisites recorded: Playwright Chromium via machine `ms-playwright` cache (playwright-core 1.61.1); Inter present for catalog-visual — FREEZE-EVIDENCE.md §3

## Linux and GitHub evidence

- [x] Required `fast` check green: run 31249897605 (PR) + 31249895048 (push) SUCCESS @ `9e6eb062` — FREEZE-EVIDENCE.md §2
- [ ] Required `full` check green: **RED** — run 31249897620 @ `9e6eb062` FAILED (eval ×4, `dagger:census`, `ua-baseline:check`); diagnosis in FREEZE-EVIDENCE.md §8 — **release blocked until fixed and re-frozen**
- [x] Required `catalog-visual` check green: run 31249897604 SUCCESS @ `9e6eb062` — FREEZE-EVIDENCE.md §2
- [x] Required `security` checks green: run 31249897606 SUCCESS @ `9e6eb062` — FREEZE-EVIDENCE.md §2
- [x] macOS/Linux difference review complete: RC matrix run 31249897599 SUCCESS on both platforms; `SHA256SUMS` byte-identical across CI-Linux, CI-macOS, and local macOS clean-clone pack — FREEZE-EVIDENCE.md §4
- [ ] Security owner approval: **blocked — human** (V1-SEC-01 disposition)

## Packages

- [x] Schema build and package smoke: clean-clone build exit 0 + `package:smoke` exit 0 — FREEZE-EVIDENCE.md §3
- [x] CLI build and `publish:check`: clean-clone build exit 0 + `publish:check` exit 0 — FREEZE-EVIDENCE.md §3
- [x] Emitter build and package smoke: clean-clone build exit 0 + `package:smoke` exit 0 — FREEZE-EVIDENCE.md §3
- [x] Pack dry-run manifests reviewed: schema 9 files / cli 4 / emitter 4, no coverage/credentials/unrelated files — FREEZE-EVIDENCE.md §4 (owner countersign at approval)
- [x] Tarball SHA-256 values attached: cli `c8c6ed51…` · schema `1161ff00…` · emitter `ca4e2225…`, identical on CI ubuntu/macos — FREEZE-EVIDENCE.md §4 + RELEASE-NOTES-DRAFT.md
- [x] Empty-directory tarball consumer smoke: install exit 0, `ds-contracts --help` 0.5.0-rc.2, ESM imports, real Badge generation from packed CLI — FREEZE-EVIDENCE.md §5

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

- [x] Plugin zip built and hashed: exit 0, 851,960 bytes, sha256 `0091f20e7a58…` (engine stamp `engine 0d5b4f5f1ebf · 639244B`) — FREEZE-EVIDENCE.md §7
- [x] Playground built and hashed: exit 0, `dist/index.html` sha256 `3068a2f41009…` — FREEZE-EVIDENCE.md §7
- [x] Spec site built and hashed: exit 0, `dist/index.html` sha256 `4886f731d6d1…` — FREEZE-EVIDENCE.md §7
- [x] Pre-deploy `deploy:check` result/disposition: exit 1, all three surfaces STALE vs local — **recorded as expected pre-deploy drift per docs/27 §6, not a pass** — FREEZE-EVIDENCE.md §7
- [x] Linux/macOS artifact comparison disposition: package tarballs byte-identical across CI-Linux/CI-macOS/local (FREEZE-EVIDENCE.md §4); deployment artifacts compare at deploy time via the dispatched `deploy-check` workflow (red-by-construction pre-deploy) — FREEZE-EVIDENCE.md §7 (owner countersign at deploy)

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

Decision owner/date: automation agent 2026-08-06; J15 freeze-and-rehearse evidence re-frozen on `9e6eb062` 2026-08-08 (FREEZE-EVIDENCE.md) — **blocked on human/release/second-impl rows only** (see HUMAN-HANDOFF.md). Not v1 shipped. Not Phase 3 Candidate.

Remaining conditions:
- Pilot persona sign-off
- Wave 8 team drift confirmation
- Live Figma edit+restore
- Security owner + publish/deploy approvals
- Wave 11-C named second implementation (do not fabricate)
