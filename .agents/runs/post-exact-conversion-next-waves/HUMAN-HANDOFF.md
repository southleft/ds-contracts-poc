# Human handoff — automation complete

Branch: `feat/exact-conversion-wave0`  
PR: https://github.com/southleft/ds-contracts-poc/pull/13  
Frozen evidence SHA: see latest green CI on PR tip  
Updated: 2026-08-06

**Do not claim v1 shipped. Do not claim Phase 3 Candidate.**  
Wave 11 packaging (A/B/D) is READY; Candidate waits on a named second implementation (W11-C). This handoff lists **only** remaining human / release / second-impl rows.

---

## Automation already green (do not re-litigate)

| Gate | Result | Evidence |
|---|---|---|
| `npm run eval` | **190/190** (incl. live-figma + human-gate inventory) | local + full lane |
| `npm run docs:check` | pass | local + fast lane |
| `npm run accuracy:check` | pass (ratchets not shrunk) | local + fast lane |
| `npm run v1:definition:check` | pass | local + fast lane |
| `npm run spec:conformance:subset:check` | pass | W11-A/B packaging |
| `npm run ci:lane -- fast` | green (incl. live-figma:evidence + human-gates:inventory) | GH `fast gates` |
| `npm run ci:lane -- full` | green | GH `full gate sweep` |
| `npm run ci:lane -- catalog-visual` | green | GH `cross-surface catalog gate` |
| `npm run live-figma:evidence:check` | pass | `parity/receipts/live-figma-variant-drift.json` on `GnQnjSNBXtgtd2Ht0Hs1C8` |
| `npm run variant-drift:check` | pass | offline half of V1-EVID-04 |
| `npm run human-gates:inventory` | pass | this file — human rows still open |
| `npm run audit:production` | 0 high+ vulns | local |

Accuracy / grammar / MUI DENOMINATOR membership were **not** shrunk. SpeedDial remains fail-closed outside the denominator.

Live Figma V1-EVID-04: edit→detect→restore proven on
[DS-Contracts-Testing](https://www.figma.com/design/GnQnjSNBXtgtd2Ht0Hs1C8/DS-Contracts-Testing)
(`v6:3552508208` → `v6:4062076634` → restore). **Console MCP re-ack complete**
(local Desktop Bridge `figma_execute`, port 9224) — same stamps as the earlier
cloud `use_figma` session. Replay scripts: `parity/receipts/console-mcp/`.

Wave ledgers: `PLAN.md`, `wave6/`…`wave11/`.

---

## Remaining human rows only

| # | Row | Where | Why agent stopped |
|---|---|---|---|
| 1 | Pilot persona sign-off (designer + engineer unaided) | `.agents/runs/exact-conversion-finish-wave4/PILOT-ACCEPTANCE.md` | Requires humans who did not build the feature |
| 2 | Wave 8 team drift-report confirmation (Journey C honesty) | `wave8/ledger.md` · Known Limitations B.11–B.13 | Team confirmation, not a CI gate |
| 3 | Security owner secret-scan disposition on release PR | `RELEASE_CHECKLIST.md` · V1-SEC-01 | Owner approval |
| 4 | Exact release commit / signed RC tag / GitHub prerelease approvals | `RELEASE_CHECKLIST.md` Human approvals | Release owner |
| 5 | npm publish (schema / emitter / CLI) + provenance path | `RELEASE_CHECKLIST.md` · docs/27 | Credentials / OIDC / owner |
| 6 | Cloudflare deploy + post-deploy `deploy:check` | `RELEASE_CHECKLIST.md` | Deploy secrets / owner |
| 7 | Wave 11-C — named second implementation + harness dry-run | `wave11/ledger.md` · `spec/conformance/` | Packaging alone ≠ Candidate; **do not invent a foreign impl** |
| 8 | Phase 4 governance / community after real second impl | `ROADMAP.md` · `docs/12-roadmap.md` | Blocked on W11-C |

---

## Release owner quick start

1. Open PR #13; confirm required checks still green on the release SHA you freeze.
2. Walk `RELEASE_CHECKLIST.md` — automation rows have evidence; complete human/publish/deploy boxes only with linked evidence.
3. Run pilot acceptance and Wave 8 confirmation.
4. Only after a real second implementation exists: mark W11-C and reconsider Phase 3 Candidate — never from packaging alone.

Agent stop condition met for Figma-automatable work: live evidence is receipted and eval-gated. Remaining rows are human/release/second-impl only.
