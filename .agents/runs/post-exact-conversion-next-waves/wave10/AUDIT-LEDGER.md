# Wave 10 — P0/P1 audit ledger (automation slice)

- Assembled: 2026-08-05
- Branch: `feat/exact-conversion-wave0`
- Scope: close every **automation-verifiable** P0/P1 cited by docs/26 V1-REL-01 on this tree. Human/release rows stay open on `RELEASE_CHECKLIST.md`.

## Status

| Severity | Open | Closed (this wave) | Deferred to post-v1 register |
|---|---|---|---|
| P0 | 0 automation | see below | 0 new |
| P1 | 0 automation | see below | register items 1–5 (docs/26) |

**Automation disposition:** READY — committed eval suite **188/188**, `docs:check` green, `v1:definition:check` green.

**Release disposition:** READY-with-human-gate — CI lanes, live Figma re-probe, publish/deploy, and persona sign-offs remain on `RELEASE_CHECKLIST.md`.

---

## Closed this wave (acceptance + result)

| ID | Closing work | Acceptance | Result |
|---|---|---|---|
| EVAL-SUITE-RED | Unblocked Wave 5 pin drift + Wave 7 camelCase cssVars extract + promote/figma freshness | `npm run eval` | **188/188** (`evals/results.json`) |
| DOCS-CHECK-RED | Rebuilt capability/ledger/residuals; updated docs/22 §8.3 MUI 14→31 | `npm run docs:check` | **pass** |
| LANE-COVERAGE | Nested `npm run` expansion so `workflow-spine:check` covers anatomy/G7/spec subset | `npm run ci:lanes` | **pass** |
| CI-LANE-FAST | Restored Helper text-style + reviewable ragged refuse; format | `npm run ci:lane -- fast` | **53/53 green** |
| V1-DEF-STRUCTURE | Unchanged; re-verified | `npm run test:v1-definition` / `v1:definition:check` | **pass** (prior) |
| ANATOMY-CSSVARS | `parity/extract-code.ts` + `core/extract-react-tsx.ts` accept camelCase custom props | `anatomy-diff:check` / baseline-parity-clean | **pass** |
| MUI-DENOM-PINS | plugin-engine / genesis / paste-door / child-wider / orphan-mint baselines | `plugin-engine-check`, `mui-figma-genesis`, `figma:fresh` | **pass** |
| RECEIVE-PATH-PIN | `figma-receive` wiring pin resolves via `import.meta.url` (repo-root cwd) | `npx tsx --test packages/cli/test/figma-receive.test.ts` | **38/38** |
| FULL-LANE-3-RED | MCP fixture defs-without-tuples; plugin UI marked+legacy exact refuse; MUI dagger 14→31 | exact-projection legacy rule + plugin projectionMode; `dagger:census --update` | **eval 188/188**, `plugin:ui-check` green, dagger **87** pinned |

---

## Still open (human / release — not automation blockers for Wave 10)

| Checklist row | Owner surface |
|---|---|
| Wave 6 pilot persona sign-off | `.agents/runs/exact-conversion-finish-wave4/PILOT-ACCEPTANCE.md` |
| Wave 8 team drift-report confirmation | Journey C honesty |
| `ci:lane fast\|full\|catalog-visual` on frozen release commit | `RELEASE_CHECKLIST.md` |
| Live Figma drift re-probe + restore | V1-EVID-04 |
| Tag / publish / deploy approvals | V1-REL-02 |
| Security owner secret-scan disposition | V1-SEC-01 |

---

## Deferred (approved post-v1 register — docs/26)

Carry-forward only; do not “implement for v1” without new adversarial evidence:

1. Medium/architecture boundaries (§A)
2. Experimental / never-attempted component classes
3. Brownfield gaps (hand-built adoption, API-only reconcile, no general merge)
4. Fidelity/reader ceilings
5. Coverage beyond measured slice
