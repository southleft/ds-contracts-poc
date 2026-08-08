# Exact conversion finish — Wave 4

- Run ID: `exact-conversion-finish-wave4`
- Task type: closed-pilot UX
- Status: **READY-with-human-gate** (automation complete; persona sign-off open)
- Current step: closed — see `disposition.json` + `PILOT-ACCEPTANCE.md`
- Branch: `feat/exact-conversion-wave0`
- Depends on: Wave 3 READY

## Intake

Unaided designer + engineer journeys under 30 minutes, ≤1 docs lookup,
no unexplained refusal, no mutation before confirmation.

## Landed this slice

- Playground G6 cost routing: `playground/src/engine/styling-detect.ts` —
  Emotion / styled-components / StyleX / Tailwind pastes lead with a
  computed-capture cost panel instead of a raw refusal wall; optional
  "Propose API surface anyway (stub anatomy)".
- Tests: `styling-detect.test.ts` in `npm run test:playground`
- G11 precursor: `ds-contracts diff --summarize --base <a> <b>` via
  `core/contract-summarize.ts` + CLI `diff.ts`
- Check: `npm run contract-summarize:check`
- Command-specific `--help`: `packages/cli/src/cli.ts` prints per-command
  sections for onboard / promote / init / extract / generate / figma / diff /
  propose-pr; site honesty line updated in `site/src/pages/cli.ts`
- Pilot acceptance checklist:
  `.agents/runs/exact-conversion-finish-wave4/PILOT-ACCEPTANCE.md`
  (human designer + engineer sign-off still required)

## Still open (Wave 4 human gate only)

- Task-based acceptance with one designer + one engineer (sign PILOT-ACCEPTANCE)
- G7 suggested-diff stubs deferred to post-ECF Wave 8
- Mount/config dry preview beyond review-gate advisories (nice-to-have)

## Disposition

`disposition.json` → **READY-with-human-gate**
