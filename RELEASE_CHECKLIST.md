# Coordinated RC release checklist

Release candidate (source tree, 2026-08-23): repository `1.0.0-rc.1` · CLI
`0.5.0-rc.2` · schema `17.0.0-rc.1` (BREAKING — the `bindings` hoist, with
the `ds-contracts migrate` codemod) · core `0.1.0-rc.1` (new package) ·
emitter `0.4.0-rc.2`

Follow [docs/27 — Release Process](docs/27-release-process.md). Check a box only
when its evidence is linked or pasted into the release PR. Use `N/A` with an
owner-approved reason; a blank box is not an approval.

Automation evidence below is pinned to PR
[#13](https://github.com/southleft/ds-contracts-poc/pull/13) on branch
`feat/exact-conversion-wave0` at SHA
`5adfc8bc` supersedes `9e6eb06283335c289f79286f3c0a1777cb6f8ae5` (J15 freeze-and-rehearse,
2026-08-08, superseding the earlier `4fda3b3` evidence freeze). Full command
transcripts: [`.agents/runs/v1-release-prep/FREEZE-EVIDENCE.md`](.agents/runs/v1-release-prep/FREEZE-EVIDENCE.md).
See also
[`.agents/runs/post-exact-conversion-next-waves/HUMAN-HANDOFF.md`](.agents/runs/post-exact-conversion-next-waves/HUMAN-HANDOFF.md).

> ## RE-FROZEN 2026-09-04 on `e428f0c1f`
>
> Every automatable row below was re-run on that commit, clean tree, and the
> results are recorded beside each box. The 2026-08-23 note that follows still
> describes the OLD ticks (`5adfc8bc` / `9e6eb062`); it is kept because the
> history is the point, but it is no longer the current state.
>
> **Measured on the freeze SHA — all green:**
>
> | box | result |
> | --- | --- |
> | manifest versions | root `1.0.0-rc.1` · cli `0.5.0-rc.2` · schema `17.0.0-rc.1` · core `0.1.0-rc.1` · emitter `0.4.0-rc.2` |
> | `publish:check` (collision check, four packages) | exit 0 |
> | `eval:record:check` | the committed record is clean-tree, on this history |
> | `schema:fresh` + `contracts:migrate:check` | both projections match the Zod document; 8,311 JSON files, no v16 spelling |
> | `maintain` (fifteen token-free steps) | exit 0 |
> | `maintain:visual` | all rows within ±0.1pp and ±4 device px of `baseline.darwin.json` |
> | `verify:published` | four tarballs into a temp project, exit 0 |
> | `human-gates:inventory` | 7 human/release rows still open, named |
> | core build + `package:smoke` | exit 0 |
> | `v1:readiness` (`--trust-lanes --pre-release`) | **24/24 rows green**, full-lane run 33874265960 |
>
> **Tarball SHA-256 on the freeze SHA:**
>
> | package | bytes | sha256 |
> | --- | ---: | --- |
> | `@ds-contracts/schema@17.0.0-rc.1` | 79,286 | `47f8c1f24b70c6aad93a0693…` |
> | `@ds-contracts/core@0.1.0-rc.1` | 101,703 | `360c9e96fa9f2b9a3590d5c8…` |
> | `@ds-contracts/cli@0.5.0-rc.2` | 4,712,817 | `da6581ad5586ccecf754e2ca…` |
> | `@ds-contracts/emitter-web-components@0.4.0-rc.2` | 96,977 | `e3635497cf94d69c4ee3911a…` |
>
> **THE ONE THING THAT IS NOT GREEN, AND WHY IT CANNOT BE YET.** `V1-REL-02`
> run for real (no `--pre-release`) is RED at 750s, and the failure is entirely
> `deploy:check`: the plugin zip, the playground and the spec site each serve an
> older build than this tree. Its publish-side half — the CLI build,
> `publish:check`, `verify:published` — all passed. `--pre-release` exists to
> defer exactly this chain, which is why the 24/24 above is honest rather than
> flattering.
>
> So the remaining distance to a green readiness is **one deployment**, and the
> row's own text says why it is not mine: *"Tagging, publication, GitHub release
> creation, dist-tag changes, and deployment each require a recorded human
> approval."* Nothing below the "Human approvals" heading has been ticked by an
> agent, and none of the boxes in "Post-publication verification" can be
> answered before that deployment happens.

> **STALE EVIDENCE (noted 2026-08-23, not re-frozen).** Every ticked
> automation row below still pins `5adfc8bc` / `9e6eb062` (2026-08-08). Since
> then `main` has taken schema 17 (a MAJOR; every committed contract was
> rewritten), a fourth package (`@ds-contracts/core`), the `maintain` /
> `maintain:visual` split, `eval:record:check`, `schema:fresh`,
> `contracts:migrate:check`, `verify:published`, dump v1.31, and regenerated
> bundles, golden manifest and engine receipt. The tarball hashes, plugin zip
> hash, package-lock hash, manifest versions and "all five workflows green"
> facts below describe a commit that no longer carries the packages being
> released. The ticks are left as the record of that freeze; none of them is
> evidence for the current tree until a release owner re-freezes on a new
> SHA per docs/27. Rows added 2026-08-23 are unticked.

## Immutable inputs (frozen at `5adfc8bc` — STALE, see above)

- [x] Release commit SHA candidate: `5adfc8bc` (all five workflows green: fast 31252088735/31252087135, full 31252088820, catalog-visual 31252088738, release-candidate 31252088752, security 31252088741; supersedes the `9e6eb062` freeze whose full lane was red; rehearsal evidence §§3-7 carries over — no package source moved between the SHAs, tarball hashes stand; release owner signs the final commit choice) — FREEZE-EVIDENCE.md §1 + §8-addendum
- [x] Release branch: `feat/exact-conversion-wave0` → PR #13
- [x] Working-tree disposition: clean at evidence SHA except the J15 evidence file itself; prior `.tmp-*.js` strays deleted in `9e6eb062` — FREEZE-EVIDENCE.md §1
- [x] Node and npm versions: Node `v20.19.4`, npm `10.8.2` (local macOS arm64 Darwin 25.3); CI uses Node `20.19.4` — FREEZE-EVIDENCE.md §1
- [x] `package-lock.json` SHA-256: `caadfcc0cee35d7a38db3c152787b2e0f017fcc8841e0f097a58bc86caf33f1a` (supersedes `01c0f676…` from the `4fda3b3` freeze) — FREEZE-EVIDENCE.md §1
- [x] Manifest versions reviewed: root `1.0.0-rc.1`, CLI `0.5.0-rc.2`, schema `16.1.0-rc.2`, emitter `0.4.0-rc.2` — FREEZE-EVIDENCE.md §1 (STALE: the tree now stages schema `17.0.0-rc.1` and core `0.1.0-rc.1`)
- [ ] Manifest versions re-reviewed on the new freeze SHA: root, CLI, schema `17.0.0-rc.1`, core `0.1.0-rc.1`, emitter
- [ ] Existing-version collision check re-run for all FOUR packages (core has never been published)
- [x] npm registry/dist-tag query attached: 2026-08-08 — `latest` = 0.4.0/16.0.0/0.3.0, `next` = 0.5.0-rc.1/16.1.0-rc.1/0.4.0-rc.1 — FREEZE-EVIDENCE.md §1
- [x] Existing-version collision check passed: no `-rc.2` version exists on the registry for any of the three packages — FREEZE-EVIDENCE.md §1

## Clean macOS rehearsal (frozen at `9e6eb062` — STALE, see above)

- [x] `npm ci`: fresh clean `file://` clone at `9e6eb062`, exit 0, 0 vulnerabilities — FREEZE-EVIDENCE.md §3
- [x] `npm run ci:lanes`: exit 0 in clean clone — FREEZE-EVIDENCE.md §3
- [x] `npm run docs:check`: exit 0 in clean clone — FREEZE-EVIDENCE.md §3
- [x] `npm run test:v1-definition`: exit 0 (25/25) in clean clone — FREEZE-EVIDENCE.md §3
- [x] `npm run v1:definition:check`: exit 0 in clean clone — FREEZE-EVIDENCE.md §3
- [x] `npm run ci:lane fast`: **60/60** @ `9e6eb062` (clean clone) — FREEZE-EVIDENCE.md §3
- [x] `npm run ci:lane full`: see FREEZE-EVIDENCE.md §7 @ `9e6eb062` (clean clone; CI `full gate sweep` on same SHA is the Linux evidence)
- [x] `npm run ci:lane catalog-visual`: **1/1** @ `9e6eb062` (clean clone) — FREEZE-EVIDENCE.md §7
- [x] `npm run audit:production`: exit 0, no high+ vulnerabilities (clean clone) — FREEZE-EVIDENCE.md §3
- [ ] `npm run eval:record:check` on the new freeze SHA (the committed `evals/results.json` must carry that commit, `dirty: false`, and the full lane must reproduce it row by row)
- [ ] `npm run schema:fresh && npm run contracts:migrate:check` on the new freeze SHA (no stale JSON Schema projection; no v16 spelling in any JSON git sees)
- [ ] `npm run maintain` (fifteen token-free steps) on the new freeze SHA
- [ ] `npm run maintain:visual` on the new freeze SHA (catalog pixels AND geometry, `FIGMA_TOKEN`)
- [ ] `npm run verify:published` on the new freeze SHA (four tarballs into a temp project; Vue emitter from the tarballs alone)
- [ ] `npm run human-gates:inventory` on the new freeze SHA
- [x] Browser and font prerequisites recorded: Playwright Chromium via machine `ms-playwright` cache (playwright-core 1.61.1); Inter present for catalog-visual — FREEZE-EVIDENCE.md §3

## Linux and GitHub evidence (frozen at `5adfc8bc` / `9e6eb062` — STALE, see above)

- [x] Required `fast` check green: run 31249897605 (PR) + 31249895048 (push) SUCCESS @ `9e6eb062` — FREEZE-EVIDENCE.md §2
- [x] Required `full` check green: run 31252088820 SUCCESS @ `5adfc8bc` (the §8 defects fixed at cause in `ac5e6181`: fixture re-rooted, promote inputs back-ported, bundles regenerated, census config + records re-recorded, astryx axis truth) — FREEZE-EVIDENCE.md §8-addendum
- [x] Required `catalog-visual` check green: run 31249897604 SUCCESS @ `9e6eb062` — FREEZE-EVIDENCE.md §2
- [x] Required `security` checks green: run 31249897606 SUCCESS @ `9e6eb062` — FREEZE-EVIDENCE.md §2
- [x] macOS/Linux difference review complete: RC matrix run 31249897599 SUCCESS on both platforms; `SHA256SUMS` byte-identical across CI-Linux, CI-macOS, and local macOS clean-clone pack — FREEZE-EVIDENCE.md §4
- [ ] Security owner approval: **blocked — human** (V1-SEC-01 disposition)

## Packages (frozen at `9e6eb062`, three packages — STALE, see above)

- [x] Schema build and package smoke: clean-clone build exit 0 + `package:smoke` exit 0 — FREEZE-EVIDENCE.md §3
- [x] CLI build and `publish:check`: clean-clone build exit 0 + `publish:check` exit 0 — FREEZE-EVIDENCE.md §3
- [x] Emitter build and package smoke: clean-clone build exit 0 + `package:smoke` exit 0 — FREEZE-EVIDENCE.md §3
- [x] Pack dry-run manifests reviewed: schema 9 files / cli 4 / emitter 4, no coverage/credentials/unrelated files — FREEZE-EVIDENCE.md §4 (owner countersign at approval)
- [x] Tarball SHA-256 values attached: cli `c8c6ed51…` · schema `1161ff00…` · emitter `ca4e2225…`, identical on CI ubuntu/macos — FREEZE-EVIDENCE.md §4 + RELEASE-NOTES-DRAFT.md
- [x] Empty-directory tarball consumer smoke: install exit 0, `ds-contracts --help` 0.5.0-rc.2, ESM imports, real Badge generation from packed CLI — FREEZE-EVIDENCE.md §5
- [ ] Core build and package smoke: `npm --prefix packages/core run build && npm --prefix packages/core run package:smoke` on the new freeze SHA
- [ ] Pack dry-run manifests re-reviewed for FOUR packages (schema incl. `dist/migrate.*`, core incl. the prop-collision table, cli, emitter) — `npm run release:package-allowlist:check`
- [ ] Tarball SHA-256 values re-attached for four packages on the new freeze SHA
- [ ] Migration notes for schema 17 (`ds-contracts migrate`, the `LEGACY_V16` tombstones, `@ds-contracts/core` requiring `^17.0.0-rc.1`) attached to the release PR

## v1 and live evidence (frozen 2026-08-06/08 — STALE, see above)

- [x] All definition-of-v1 requirement evidence attached: automation commands green via fast/full/catalog-visual; see docs/26 + wave10 `AUDIT-LEDGER.md` (STALE: docs/26's acceptance commands changed 2026-08-23 — `eval:record:check`, `contracts:migrate:check`, `conformance:roundtrip`, `verify:published`, `maintain`, `maintain:visual` — and two of them are known not to pass on the current commit: `npm run diagnose`, `npm run extract:computed:drift`; docs/23 §B.28)
- [x] P0/P1 audit ledger has no open or waived automation row: `.agents/runs/post-exact-conversion-next-waves/wave10/AUDIT-LEDGER.md` (STALE: the 2026-08-05 automation slice; the release audit V1-REL-01 names is the 2026-08-22 21-agent audit, whose generated ledger is `parity/receipts/v1/AUDIT-LEDGER.md` — 60 P0/P1 rows, verified by `npm run v1:readiness`; its open human rows are the signed-tag and deployment approvals below)
- [ ] `npm run v1:readiness` on the new freeze SHA (no `--trust-lanes`, no `--pre-release`): every docs/26 row GREEN in `parity/receipts/v1/READINESS.md`, zero open rows in `parity/receipts/v1/AUDIT-LEDGER.md`; attach both
- [x] Live Figma drift receipt linked: `parity/receipts/live-figma-variant-drift.md` + `.json` on file `GnQnjSNBXtgtd2Ht0Hs1C8` · `npm run live-figma:evidence:check`
- [x] Figma controlled edit and restoration: Console MCP `figma_execute` re-ack (baseline `v6:3552508208` → edit `v6:4062076634` → restore); prior cloud `use_figma` same stamps; scripts under `parity/receipts/console-mcp/`
- [x] Final live Figma stamp/file state is clean: restored fingerprint matches baseline; Console MCP Desktop Bridge re-ack recorded 2026-08-06
- [x] Console MCP contract→Figma loop: 49/49 first-party components on Testing file · `npm run console-loop:evidence:check` · eval `console-loop-evidence-receipt`
- [ ] Migration notes reviewed: **blocked — human/release**
- [ ] Worker Durable Object migration rehearsed with Node 22+: **blocked — human/release**
- [ ] First Worker rollout keeps assist disabled through the UTC boundary: **blocked — human/release**
- [x] Known limitations linked: docs/23 + docs:check green

## Deployment rehearsal (frozen at `9e6eb062` — STALE, see above)

- [x] Plugin zip built and hashed: exit 0, 851,960 bytes, sha256 `0091f20e7a58…` (engine stamp `engine 0d5b4f5f1ebf · 639244B`) — FREEZE-EVIDENCE.md §7 (STALE: the committed engine receipt is `2f6bd6aa8a9d · 808189B`; `plugin:zip` refuses to package a stale engine)
- [x] Playground built and hashed: exit 0, `dist/index.html` sha256 `3068a2f41009…` — FREEZE-EVIDENCE.md §7
- [x] Spec site built and hashed: exit 0, `dist/index.html` sha256 `4886f731d6d1…` — FREEZE-EVIDENCE.md §7
- [x] Pre-deploy `deploy:check` result/disposition: exit 1, all three surfaces STALE vs local — **recorded as expected pre-deploy drift per docs/27 §6, not a pass** — FREEZE-EVIDENCE.md §7
- [x] Linux/macOS artifact comparison disposition: package tarballs byte-identical across CI-Linux/CI-macOS/local (FREEZE-EVIDENCE.md §4); deployment artifacts compare at deploy time via the dispatched `deploy-check` workflow (red-by-construction pre-deploy) — FREEZE-EVIDENCE.md §7 (owner countersign at deploy)

## Human approvals

- [ ] Exact release commit approved — owner/date:
- [x] Signed RC tag approved — owner/date: **disposition, TJ Pitre, 2026-09-03** — the premature `v1.0.0-rc.1` tag (34d92c08, unsigned, 1,054 commits behind, before the recipe pivot) was DELETED on origin and locally under the owner's authorisation; no RC tag exists until there is a release commit to sign. Guard: `npm run release-tag:check`.
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

Decision owner/date: automation agent 2026-08-06; J15 freeze-and-rehearse evidence re-frozen on `9e6eb062` 2026-08-08 (FREEZE-EVIDENCE.md) — **blocked on human/release/second-impl rows only** (see HUMAN-HANDOFF.md), and since 2026-08-23 also on a **re-freeze**: the automation evidence predates schema 17 and `@ds-contracts/core`. Not v1 shipped. Not Phase 3 Candidate.

Remaining conditions:
- Re-freeze automation evidence on a SHA that carries schema 17, `@ds-contracts/core`, and the `maintain` split (every ticked automation row above)
- Pilot persona sign-off
- Wave 8 team drift confirmation
- Live Figma edit+restore
- Security owner + publish/deploy approvals
- Wave 11-C named second implementation (do not fabricate)
