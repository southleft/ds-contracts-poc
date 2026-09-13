# Branch prune — 2026-09-13

Measured with `git branch --merged main` / `git rev-list --count main..<branch>` at main `ed5acd832`,
PR numbers from `gh pr list --state all`. Kept: `main`, `codex/v1-layout-lowering` (Codex's
interrupted PR #61 re-application, committed 14627c325), `codex/v1-portable-proof-artifacts` (PR #78,
until it merges), `feat/layout-lowering` (PR #61, closed, kept as reference until its successor lands),
`chore/pin-on-linux` (new). Dependabot and cursor PR heads are untouched.

Nothing here is recoverable after `git push origin --delete`; every unmerged row names why its
content has a home or is deliberately dropped.

## Local branches deleted (90)

| branch | state | last commit | PR | disposition |
| --- | --- | --- | --- | --- |
| `adv-rc1-verify` | merged | 2026-08-24 | - | merged into main |
| `adv-rc4-verify` | merged | 2026-08-24 | - | merged into main |
| `adv-rc7` | merged | 2026-08-24 | - | merged into main |
| `adv-rc8-verify` | merged | 2026-08-24 | - | merged into main |
| `adv/rc7-base` | merged | 2026-08-24 | - | merged into main |
| `adv/rc7-vis` | merged | 2026-08-24 | - | merged into main |
| `burn/RC1-layout-axis-door` | merged | 2026-08-24 | - | merged into main |
| `burn/RC2-declared-uniform-only` | merged | 2026-08-24 | - | merged into main |
| `burn/RC3-nonstroke-ink-no-lowering` | merged | 2026-08-24 | - | merged into main |
| `burn/RC4-glyph-reconstruction` | merged | 2026-08-24 | - | merged into main |
| `burn/RC5-empty-slot-hugs-to-1px` | merged | 2026-08-24 | - | merged into main |
| `burn/RC6-stale-token-alias` | merged | 2026-08-24 | - | merged into main |
| `burn/RC7-placeholder-empty-and-value-ink` | merged | 2026-08-24 | - | merged into main |
| `burn/RC8-geometry-excluded-for-text-parts` | merged | 2026-08-24 | - | merged into main |
| `burn2/RC1-layout-axis-door` | merged | 2026-08-25 | - | burn-down round 2 experiment; the round closed via burn2/landed (#55 CLOSED, its 3 landed root causes merged in #62) |
| `burn2/RC2-declared-uniform-only` | unmerged +12 | 2026-08-25 | - | burn-down round 2 experiment; the round closed via burn2/landed (#55 CLOSED, its 3 landed root causes merged in #62) |
| `burn2/RC3-nonstroke-ink-no-lowering` | unmerged +9 | 2026-08-25 | - | burn-down round 2 experiment; the round closed via burn2/landed (#55 CLOSED, its 3 landed root causes merged in #62) |
| `burn2/RC4-glyph-reconstruction` | unmerged +6 | 2026-08-25 | - | burn-down round 2 experiment; the round closed via burn2/landed (#55 CLOSED, its 3 landed root causes merged in #62) |
| `burn2/RC5-empty-slot-hugs-to-1px` | unmerged +7 | 2026-08-25 | - | burn-down round 2 experiment; the round closed via burn2/landed (#55 CLOSED, its 3 landed root causes merged in #62) |
| `burn2/RC6-stale-token-alias` | unmerged +6 | 2026-08-25 | - | burn-down round 2 experiment; the round closed via burn2/landed (#55 CLOSED, its 3 landed root causes merged in #62) |
| `burn2/RC7-placeholder-empty-and-value-ink` | merged | 2026-08-25 | - | burn-down round 2 experiment; the round closed via burn2/landed (#55 CLOSED, its 3 landed root causes merged in #62) |
| `burn2/RC8-geometry-excluded-for-text-parts` | merged | 2026-08-25 | - | burn-down round 2 experiment; the round closed via burn2/landed (#55 CLOSED, its 3 landed root causes merged in #62) |
| `burn2/landed` | merged | 2026-08-25 | #55 CLOSED | burn-down round 2 experiment; the round closed via burn2/landed (#55 CLOSED, its 3 landed root causes merged in #62) |
| `census/canvas-full` | merged | 2026-08-24 | #38 CLOSED | merged into main — #38 CLOSED |
| `census/design-to-code` | merged | 2026-08-23 | - | merged into main |
| `census/stack-to-main` | merged | 2026-08-26 | #73 MERGED, #62 MERGED | merged into main — #73 MERGED, #62 MERGED |
| `census/usable-sweep` | merged | 2026-08-26 | #64 MERGED | merged into main — #64 MERGED |
| `chore/fluent-linux-pin` | unmerged +1 | 2026-09-04 | - | its only file, pin-fluent.yml, is generalised as pin-on-linux.yml on chore/pin-on-linux; the fluent pin it recorded is on main (aa0d6b6ca) |
| `codex/sol-testing` | merged | 2026-07-21 | - | merged into main |
| `corpus/archetype-cases` | merged | 2026-08-26 | #63 MERGED | merged into main — #63 MERGED |
| `corpus/hard-cases` | unmerged +16 | 2026-08-26 | #54 CLOSED | PR #54 CLOSED (not merged); superseded by corpus/archetype-cases (#63, merged) |
| `exam/antd-code-to-canvas` | merged | 2026-08-23 | #34 CLOSED | merged into main — #34 CLOSED |
| `exam/first-pass-mint` | merged | 2026-08-25 | #50 CLOSED | merged into main — #50 CLOSED |
| `exam/held-out-prep` | merged | 2026-08-25 | #43 CLOSED | merged into main — #43 CLOSED |
| `feat/beta-rounds` | merged | 2026-08-10 | - | merged into main |
| `feat/exact-conversion-wave0` | merged | 2026-08-08 | #13 MERGED | merged into main — #13 MERGED |
| `feat/freeze-board-wave2` | merged | 2026-08-13 | - | merged into main |
| `feat/grammar-coverage` | merged | 2026-08-25 | #46 CLOSED | merged into main — #46 CLOSED |
| `feat/north-star-climb` | merged | 2026-08-16 | - | merged into main |
| `feat/public-beta-prep` | merged | 2026-08-15 | - | merged into main |
| `feat/required-facts` | merged | 2026-08-25 | #44 CLOSED | merged into main — #44 CLOSED |
| `fix/baseline-isolation` | merged | 2026-08-25 | #45 CLOSED | merged into main — #45 CLOSED |
| `fix/census-corpus-stray-entry` | merged | 2026-08-26 | #65 MERGED | merged into main — #65 MERGED |
| `fix/census-receipt-usable-column` | merged | 2026-08-26 | #70 MERGED | merged into main — #70 MERGED |
| `fix/documented-path-reproducible` | merged | 2026-08-25 | #47 CLOSED | merged into main — #47 CLOSED |
| `fix/door-rederive-marker-line` | merged | 2026-08-26 | #67 MERGED | merged into main — #67 MERGED |
| `fix/door-register-metadata` | merged | 2026-08-26 | #60 MERGED | merged into main — #60 MERGED |
| `fix/exam-packet-guard` | merged | 2026-08-25 | #48 CLOSED | merged into main — #48 CLOSED |
| `fix/mint-doubled-text-and-ink` | merged | 2026-08-25 | #51 CLOSED | merged into main — #51 CLOSED |
| `fix/mint-placement` | unmerged +2 | 2026-08-26 | #57 MERGED | PR #57 MERGED; the 2 remaining commits are a merge-forward + eval re-record, nothing unique |
| `fix/pin-render-browser` | merged | 2026-08-25 | #52 CLOSED | merged into main — #52 CLOSED |
| `fix/rejected-sets` | unmerged +1 | 2026-08-24 | #39 CLOSED | PR #39 CLOSED; census/canvas-full landed on main via #62 |
| `fix/self-test-not-hermetic` | merged | 2026-08-26 | #72 MERGED | merged into main — #72 MERGED |
| `gate/canvas-usable` | merged | 2026-08-26 | #59 MERGED | merged into main — #59 MERGED |
| `gate/eval-red-ledger` | merged | 2026-08-26 | #68 MERGED | merged into main — #68 MERGED |
| `gate/eval-red-ledger-record` | merged | 2026-08-26 | #69 MERGED | merged into main — #69 MERGED |
| `gate/v1-readiness` | merged | 2026-08-23 | #36 CLOSED | merged into main — #36 CLOSED |
| `guard/curated-facts` | merged | 2026-08-26 | #71 MERGED | merged into main — #71 MERGED |
| `phase-0/one-truth` | merged | 2026-08-22 | #18 MERGED | merged into main — #18 MERGED |
| `phase-1/named-or-carried` | merged | 2026-08-22 | #19 MERGED | merged into main — #19 MERGED |
| `phase-1/residuals` | merged | 2026-08-22 | #21 MERGED | merged into main — #21 MERGED |
| `phase-2/exam-close` | merged | 2026-08-23 | #26 MERGED | merged into main — #26 MERGED |
| `phase-2/exam-figma-ds` | merged | 2026-08-22 | #22 MERGED | merged into main — #22 MERGED |
| `phase-2/fix-round-1` | merged | 2026-08-22 | #23 MERGED | merged into main — #23 MERGED |
| `phase-2/slot-interior-layout` | merged | 2026-08-23 | #27 MERGED | merged into main — #27 MERGED |
| `phase-3/core-package` | merged | 2026-08-22 | #20 MERGED | merged into main — #20 MERGED |
| `phase-3/schema-v17` | merged | 2026-08-23 | #24 MERGED | merged into main — #24 MERGED |
| `phase-3/slice3-codeconnect` | merged | 2026-08-23 | #25 MERGED | merged into main — #25 MERGED |
| `pivot/recipe-ir-v1` | merged | 2026-08-30 | - | merged into main |
| `proof/altitude-badge` | unmerged +11 | 2026-08-26 | #56 CLOSED | PR #56 CLOSED; the altitude badge defect landed via fix/mint-doubled-text-and-ink (#51/#53) |
| `refs/wip-census-refs` | merged | 2026-08-24 | - | merged into main |
| `spec/carried-evidence` | merged | 2026-08-26 | #66 MERGED | merged into main — #66 MERGED |
| `spec/door-register` | merged | 2026-08-24 | #41 MERGED | merged into main — #41 MERGED |
| `spec/lowering-layout` | merged | 2026-08-26 | #58 MERGED | merged into main — #58 MERGED |
| `v1-integration` | merged | 2026-08-24 | #37 MERGED | merged into main — #37 MERGED |
| `v1-integration-2` | merged | 2026-08-25 | #49 MERGED | merged into main — #49 MERGED |
| `v1-integration-3` | merged | 2026-08-25 | #53 MERGED | merged into main — #53 MERGED |
| `v1/acceptance-drift-diagnose` | merged | 2026-08-23 | #28 MERGED | merged into main — #28 MERGED |
| `verify/RC5` | merged | 2026-08-24 | - | merged into main |
| `verify/rc3-nonstroke` | merged | 2026-08-24 | - | merged into main |
| `verify/rc4-glyph` | merged | 2026-08-24 | - | merged into main |
| `verify/rc4-patched` | merged | 2026-08-24 | - | merged into main |
| `verify/rc5-visual` | merged | 2026-08-24 | - | merged into main |
| `verify/rc6-adv` | merged | 2026-08-24 | - | merged into main |
| `verify/rc6-vis` | merged | 2026-08-24 | - | merged into main |
| `wave/mui-cssbaseline` | merged | 2026-09-04 | - | merged into main |
| `worktree-agent-a1a26493b269c988f` | merged | 2026-07-20 | - | merged into main |
| `worktree-agent-a1d22862f3c0ac456` | merged | 2026-07-08 | - | merged into main |
| `worktree-agent-a1f53faa5ec1b5275` | merged | 2026-07-09 | - | merged into main |
| `worktree-agent-a9a63a15ed0444399` | merged | 2026-08-26 | - | merged into main |

## Remote branches deleted (79)

| branch | state | last commit | PR | disposition |
| --- | --- | --- | --- | --- |
| `origin/burn/RC1-layout-axis-door` | merged | 2026-08-24 | - | merged into main |
| `origin/burn/RC2-declared-uniform-only` | merged | 2026-08-24 | - | merged into main |
| `origin/burn/RC3-nonstroke-ink-no-lowering` | merged | 2026-08-24 | - | merged into main |
| `origin/burn/RC4-glyph-reconstruction` | merged | 2026-08-24 | - | merged into main |
| `origin/burn/RC5-empty-slot-hugs-to-1px` | merged | 2026-08-24 | - | merged into main |
| `origin/burn/RC6-stale-token-alias` | merged | 2026-08-24 | - | merged into main |
| `origin/burn/RC7-placeholder-empty-and-value-ink` | merged | 2026-08-24 | - | merged into main |
| `origin/burn/RC8-geometry-excluded-for-text-parts` | merged | 2026-08-24 | - | merged into main |
| `origin/burn2-r1/RC1-layout-axis-door` | merged | 2026-08-25 | - | burn-down round 2 experiment; the round closed via burn2/landed (#55 CLOSED, its 3 landed root causes merged in #62) |
| `origin/burn2-r1/RC2-declared-uniform-only` | unmerged +2 | 2026-08-25 | - | burn-down round 2 experiment; the round closed via burn2/landed (#55 CLOSED, its 3 landed root causes merged in #62) |
| `origin/burn2-r1/RC3-nonstroke-ink-no-lowering` | unmerged +5 | 2026-08-25 | - | burn-down round 2 experiment; the round closed via burn2/landed (#55 CLOSED, its 3 landed root causes merged in #62) |
| `origin/burn2-r1/RC4-glyph-reconstruction` | unmerged +3 | 2026-08-25 | - | burn-down round 2 experiment; the round closed via burn2/landed (#55 CLOSED, its 3 landed root causes merged in #62) |
| `origin/burn2-r1/RC5-empty-slot-hugs-to-1px` | unmerged +1 | 2026-08-25 | - | burn-down round 2 experiment; the round closed via burn2/landed (#55 CLOSED, its 3 landed root causes merged in #62) |
| `origin/burn2-r1/RC6-stale-token-alias` | unmerged +4 | 2026-08-25 | - | burn-down round 2 experiment; the round closed via burn2/landed (#55 CLOSED, its 3 landed root causes merged in #62) |
| `origin/burn2-r1/RC7-placeholder-empty-and-value-ink` | merged | 2026-08-25 | - | burn-down round 2 experiment; the round closed via burn2/landed (#55 CLOSED, its 3 landed root causes merged in #62) |
| `origin/burn2-r1/RC8-geometry-excluded-for-text-parts` | merged | 2026-08-25 | - | burn-down round 2 experiment; the round closed via burn2/landed (#55 CLOSED, its 3 landed root causes merged in #62) |
| `origin/burn2/RC1-layout-axis-door` | merged | 2026-08-25 | - | burn-down round 2 experiment; the round closed via burn2/landed (#55 CLOSED, its 3 landed root causes merged in #62) |
| `origin/burn2/RC2-declared-uniform-only` | unmerged +12 | 2026-08-25 | - | burn-down round 2 experiment; the round closed via burn2/landed (#55 CLOSED, its 3 landed root causes merged in #62) |
| `origin/burn2/RC3-nonstroke-ink-no-lowering` | unmerged +9 | 2026-08-25 | - | burn-down round 2 experiment; the round closed via burn2/landed (#55 CLOSED, its 3 landed root causes merged in #62) |
| `origin/burn2/RC4-glyph-reconstruction` | unmerged +6 | 2026-08-25 | - | burn-down round 2 experiment; the round closed via burn2/landed (#55 CLOSED, its 3 landed root causes merged in #62) |
| `origin/burn2/RC5-empty-slot-hugs-to-1px` | unmerged +7 | 2026-08-25 | - | burn-down round 2 experiment; the round closed via burn2/landed (#55 CLOSED, its 3 landed root causes merged in #62) |
| `origin/burn2/RC6-stale-token-alias` | unmerged +6 | 2026-08-25 | - | burn-down round 2 experiment; the round closed via burn2/landed (#55 CLOSED, its 3 landed root causes merged in #62) |
| `origin/burn2/RC7-placeholder-empty-and-value-ink` | merged | 2026-08-25 | - | burn-down round 2 experiment; the round closed via burn2/landed (#55 CLOSED, its 3 landed root causes merged in #62) |
| `origin/burn2/RC8-geometry-excluded-for-text-parts` | merged | 2026-08-25 | - | burn-down round 2 experiment; the round closed via burn2/landed (#55 CLOSED, its 3 landed root causes merged in #62) |
| `origin/burn2/landed` | merged | 2026-08-25 | #55 CLOSED | burn-down round 2 experiment; the round closed via burn2/landed (#55 CLOSED, its 3 landed root causes merged in #62) |
| `origin/census/canvas-full` | merged | 2026-08-24 | #38 CLOSED | merged into main — #38 CLOSED |
| `origin/census/design-to-code` | merged | 2026-08-23 | - | merged into main |
| `origin/census/stack-to-main` | merged | 2026-08-26 | #73 MERGED, #62 MERGED | merged into main — #73 MERGED, #62 MERGED |
| `origin/census/usable-sweep` | merged | 2026-08-26 | #64 MERGED | merged into main — #64 MERGED |
| `origin/corpus/archetype-cases` | merged | 2026-08-26 | #63 MERGED | merged into main — #63 MERGED |
| `origin/corpus/hard-cases` | unmerged +15 | 2026-08-26 | #54 CLOSED | PR #54 CLOSED (not merged); superseded by corpus/archetype-cases (#63, merged) |
| `origin/exam/antd-code-to-canvas` | merged | 2026-08-23 | #34 CLOSED | merged into main — #34 CLOSED |
| `origin/exam/first-pass-mint` | merged | 2026-08-25 | #50 CLOSED | merged into main — #50 CLOSED |
| `origin/exam/held-out-prep` | merged | 2026-08-25 | #43 CLOSED | merged into main — #43 CLOSED |
| `origin/feat/beta-rounds` | merged | 2026-08-09 | - | merged into main |
| `origin/feat/exact-conversion-wave0` | merged | 2026-08-08 | #13 MERGED | merged into main — #13 MERGED |
| `origin/feat/grammar-coverage` | merged | 2026-08-25 | #46 CLOSED | merged into main — #46 CLOSED |
| `origin/feat/required-facts` | merged | 2026-08-25 | #44 CLOSED | merged into main — #44 CLOSED |
| `origin/fix/baseline-isolation` | merged | 2026-08-25 | #45 CLOSED | merged into main — #45 CLOSED |
| `origin/fix/census-corpus-stray-entry` | merged | 2026-08-26 | #65 MERGED | merged into main — #65 MERGED |
| `origin/fix/census-receipt-usable-column` | merged | 2026-08-26 | #70 MERGED | merged into main — #70 MERGED |
| `origin/fix/documented-path-reproducible` | merged | 2026-08-25 | #47 CLOSED | merged into main — #47 CLOSED |
| `origin/fix/door-rederive-marker-line` | merged | 2026-08-26 | #67 MERGED | merged into main — #67 MERGED |
| `origin/fix/door-register-metadata` | merged | 2026-08-26 | #60 MERGED | merged into main — #60 MERGED |
| `origin/fix/exam-packet-guard` | merged | 2026-08-25 | #48 CLOSED | merged into main — #48 CLOSED |
| `origin/fix/mint-doubled-text-and-ink` | merged | 2026-08-25 | #51 CLOSED | merged into main — #51 CLOSED |
| `origin/fix/mint-placement` | unmerged +2 | 2026-08-26 | #57 MERGED | PR #57 MERGED; the 2 remaining commits are a merge-forward + eval re-record, nothing unique |
| `origin/fix/pin-render-browser` | merged | 2026-08-25 | #52 CLOSED | merged into main — #52 CLOSED |
| `origin/fix/rejected-sets` | merged | 2026-08-24 | #39 CLOSED | PR #39 CLOSED; census/canvas-full landed on main via #62 |
| `origin/fix/self-test-not-hermetic` | merged | 2026-08-26 | #72 MERGED | merged into main — #72 MERGED |
| `origin/gate/canvas-usable` | merged | 2026-08-26 | #59 MERGED | merged into main — #59 MERGED |
| `origin/gate/eval-red-ledger` | merged | 2026-08-26 | #68 MERGED | merged into main — #68 MERGED |
| `origin/gate/eval-red-ledger-record` | merged | 2026-08-26 | #69 MERGED | merged into main — #69 MERGED |
| `origin/gate/v1-readiness` | merged | 2026-08-23 | #36 CLOSED | merged into main — #36 CLOSED |
| `origin/guard/curated-facts` | merged | 2026-08-26 | #71 MERGED | merged into main — #71 MERGED |
| `origin/phase-0/one-truth` | merged | 2026-08-22 | #18 MERGED | merged into main — #18 MERGED |
| `origin/phase-1/named-or-carried` | merged | 2026-08-22 | #19 MERGED | merged into main — #19 MERGED |
| `origin/phase-1/residuals` | merged | 2026-08-22 | #21 MERGED | merged into main — #21 MERGED |
| `origin/phase-2/exam-close` | merged | 2026-08-23 | #26 MERGED | merged into main — #26 MERGED |
| `origin/phase-2/exam-figma-ds` | merged | 2026-08-22 | #22 MERGED | merged into main — #22 MERGED |
| `origin/phase-2/fix-round-1` | merged | 2026-08-22 | #23 MERGED | merged into main — #23 MERGED |
| `origin/phase-2/slot-interior-layout` | merged | 2026-08-23 | #27 MERGED | merged into main — #27 MERGED |
| `origin/phase-3/core-package` | merged | 2026-08-22 | #20 MERGED | merged into main — #20 MERGED |
| `origin/phase-3/schema-v17` | merged | 2026-08-23 | #24 MERGED | merged into main — #24 MERGED |
| `origin/phase-3/slice3-codeconnect` | merged | 2026-08-23 | #25 MERGED | merged into main — #25 MERGED |
| `origin/pivot/recipe-ir-v1` | merged | 2026-08-30 | - | merged into main |
| `origin/proof/altitude-badge` | unmerged +11 | 2026-08-26 | #56 CLOSED | PR #56 CLOSED; the altitude badge defect landed via fix/mint-doubled-text-and-ink (#51/#53) |
| `origin/spec/carried-evidence` | merged | 2026-08-26 | #66 MERGED | merged into main — #66 MERGED |
| `origin/spec/door-register` | merged | 2026-08-24 | #41 MERGED | merged into main — #41 MERGED |
| `origin/spec/lowering-layout` | merged | 2026-08-26 | #58 MERGED | merged into main — #58 MERGED |
| `origin/sync-spine/polaris-avatar` | unmerged +2 | 2026-08-08 | #15 CLOSED | PR #15 CLOSED; an automated legacy canvas→code proposal that rewrites examples/polaris/contracts/avatar.contract.json −266 lines — would delete curated facts |
| `origin/v1-integration` | merged | 2026-08-24 | #37 MERGED | merged into main — #37 MERGED |
| `origin/v1-integration-2` | merged | 2026-08-25 | #49 MERGED | merged into main — #49 MERGED |
| `origin/v1-integration-3` | merged | 2026-08-25 | #53 MERGED | merged into main — #53 MERGED |
| `origin/v1/acceptance-drift-diagnose` | merged | 2026-08-23 | #28 MERGED | merged into main — #28 MERGED |
| `origin/w4/playground` | merged | 2026-08-23 | - | merged into main |
| `origin/w4/readme` | merged | 2026-08-23 | - | merged into main |
| `origin/w4/site` | merged | 2026-08-23 | - | merged into main |
| `origin/wave/mui-cssbaseline` | merged | 2026-09-04 | - | merged into main |

## Also removed

- dangling remote-tracking refs `refs/remotes/pr/35` and `refs/remotes/pr35` from a remote that no longer exists
- worktrees `ds-contracts-poc-pr14`, `-pr76`, `-pr77` (clean review checkouts of open PR heads)
- the empty stray file `=20` at the repo root (a `>=20` shell-redirect accident)
