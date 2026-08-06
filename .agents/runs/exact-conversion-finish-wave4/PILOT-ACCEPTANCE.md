# Wave 4 — Pilot acceptance checklist

Automation for Wave 4 UX slices is landed. **Unaided persona acceptance**
(plan exit) requires one designer and one engineer who did not build the
feature. Use this checklist; do not mark Wave 4 `READY` until both columns
are signed.

## Budgets (plan)

- First supported component &lt; 30 minutes
- ≤ 1 documentation lookup
- No unexplained refusal
- No mutation before confirmation
- Resumable recovery without repeating expensive successful stages

## Designer journeys

| # | Journey | Pass? | Notes / time |
|---|---|---|---|
| D1 | Code→Figma first component (sample library or MUI bundle paste) | | |
| D2 | Figma→code proposal (Send / propose → review before write) | | |
| D3 | Concurrent edit: drift warning + three-way / hold Apply | | |
| D4 | Recovery: missing Chromium / unreviewed config / stale delivery | | |

## Engineer journeys

| # | Journey | Pass? | Notes / time |
|---|---|---|---|
| E1 | `onboard` / extract → review gate → `--continue` | | |
| E2 | `diff` / `diff --summarize` on a known change | | |
| E3 | Concurrent resolution / awaiting-code-adoption refusal | | |
| E4 | Playground Emotion paste → cost panel (not raw refusal wall) | | |

## Automation evidence (already green)

- `npm run test:playground` (includes styling-detect)
- `npm run workflow-spine:check`
- `npm run test:onboarding` (if present)
- `npx tsx packages/cli/src/cli.ts onboard --help` (command-specific help)

## Sign-off

| Role | Name | Date | Verdict |
|---|---|---|---|
| Designer | | | |
| Engineer | | | |
