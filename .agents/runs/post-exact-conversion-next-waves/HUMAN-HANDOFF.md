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
| `npm run eval` | see tip / `evals/results.json` (incl. live-figma + all console-loop corpora + human-gate inventory) | local + full lane |
| `npm run console-loop:all:evidence:check` | pass — **128** stems (49 first-party + 31 MUI + 48 foreign) | `parity/receipts/console-loop/` |
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

Console MCP library loops (see `parity/receipts/console-loop/CORPORA.md`):
**128** stems across first-party, MUI denominator, Tailwind, Altitude, Astryx,
Carbon, Polaris — generate→screenshot→audit→fingerprint→round-trip, eval-gated.
Not looped without further emit/kit access: eventz-vars, untitled-ui storybook
anchors, contract files lacking committed `.figma.js`.

Wave ledgers: `PLAN.md`, `wave6/`…`wave11/`.

---

## Remaining human rows only

Read-and-sign prep artifacts for each row live in
[`../v1-release-prep/`](../v1-release-prep/) (drafted 2026-08-08; no row is
closed by them).

| # | Row | Where | Why agent stopped | Prep artifact (read-and-sign) |
|---|---|---|---|---|
| 1 | Pilot persona sign-off (designer + engineer unaided) | `.agents/runs/exact-conversion-finish-wave4/PILOT-ACCEPTANCE.md` | Requires humans who did not build the feature | [`../v1-release-prep/PILOT-RUNBOOK.md`](../v1-release-prep/PILOT-RUNBOOK.md) — command-by-command D1–D4 / E1–E4 script + budget tally sheet |
| 2 | Wave 8 team drift-report confirmation (Journey C honesty) | `wave8/ledger.md` · Known Limitations B.11–B.13 | Team confirmation, not a CI gate | [`../v1-release-prep/WAVE8-CONFIRMATION-PACKET.md`](../v1-release-prep/WAVE8-CONFIRMATION-PACKET.md) — what to send, 3 questions, signature block |
| 3 | Security owner secret-scan disposition on release PR | `RELEASE_CHECKLIST.md` · V1-SEC-01 | Owner approval | [`../v1-release-prep/SECURITY-DISPOSITION-PREFILL.md`](../v1-release-prep/SECURITY-DISPOSITION-PREFILL.md) — three green run URLs + attestation text pre-filled |
| 4 | Exact release commit / signed RC tag / GitHub prerelease approvals | `RELEASE_CHECKLIST.md` Human approvals | Release owner | [`../v1-release-prep/RELEASE-NOTES-DRAFT.md`](../v1-release-prep/RELEASE-NOTES-DRAFT.md) — full prerelease body incl. v0.7.0 disposition (owner strikes one option); flags the stale draft release + tag at `e148d2d` |
| 5 | npm publish (schema / emitter / CLI) + provenance path | `RELEASE_CHECKLIST.md` · docs/27 | Credentials / OIDC / owner | [`../v1-release-prep/RELEASE-NOTES-DRAFT.md`](../v1-release-prep/RELEASE-NOTES-DRAFT.md) — package/version table, `<SHA256-AT-FREEZE>` slots, attestation statement (publish-rc.yml OIDC) |
| 6 | Cloudflare deploy + post-deploy `deploy:check` | `RELEASE_CHECKLIST.md` | Deploy secrets / owner | [`../v1-release-prep/RELEASE-NOTES-DRAFT.md`](../v1-release-prep/RELEASE-NOTES-DRAFT.md) — deployment-status + deploy-check link placeholders in the Evidence section |
| 7 | Wave 11-C — named second implementation + harness dry-run | `wave11/ledger.md` · `spec/conformance/` | Packaging alone ≠ Candidate; **do not invent a foreign impl** | [`../v1-release-prep/W11C-IMPLEMENTER-BRIEF.md`](../v1-release-prep/W11C-IMPLEMENTER-BRIEF.md) — send-as-is outreach brief for recruiting the implementer |
| 8 | Phase 4 governance / community after real second impl | `ROADMAP.md` · `docs/12-roadmap.md` | Blocked on W11-C | — (no prep possible until W11-C lands) |

---

## Release owner quick start

1. Open PR #13; confirm required checks still green on the release SHA you freeze.
2. Walk `RELEASE_CHECKLIST.md` — automation rows have evidence; complete human/publish/deploy boxes only with linked evidence.
3. Run pilot acceptance and Wave 8 confirmation.
4. Only after a real second implementation exists: mark W11-C and reconsider Phase 3 Candidate — never from packaging alone.

Agent stop condition met for Figma-automatable work with committed scripts:
128 stems receipted and eval-gated. Remaining rows are human/release/second-impl
only (plus corpora that lack figma emit scripts or require foreign kit access).
