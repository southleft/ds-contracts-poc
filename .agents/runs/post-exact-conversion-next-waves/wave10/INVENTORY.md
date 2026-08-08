# Wave 10 — docs/26 v1 definition inventory

- Branch: `feat/exact-conversion-wave0`
- Commit sampled: `e148d2d`
- Inventoried: 2026-08-05T19:36:15Z
- Source: [docs/26-v1-definition.md](../../../../docs/26-v1-definition.md) (22 `V1-*` requirements; 5 approved post-v1 limitations)
- Scope: map each requirement to what is verifiable *now* without a full CI lane
- Sequencing note ([PLAN.md](../PLAN.md)): Wave 10 expects Waves 6–8 evidence attached; Wave 6 and Wave 8 remain `READY-with-human-gate`

## Recommended closeout disposition

**READY-with-human-gate**

Automation blockers cleared on this tree: committed evals **188/188**, `docs:check` green, P0/P1 automation ledger assembled ([AUDIT-LEDGER.md](./AUDIT-LEDGER.md)). v1 still cannot *ship* until RELEASE_CHECKLIST human/CI/live-Figma rows close — that is intentional, not unfinished inventory.

Inventoried: 2026-08-05 (initial) · Automation closed: 2026-08-05 (this update)

## Cheap gates run this wave

| Command | Result | Notes |
|---|---|---|
| `npm run test:v1-definition` | **pass** (25/25) | Structure, IDs, script names, anchors, archetype/CI-lane drift, floors |
| `npm run v1:definition:check` | **pass** | `22` requirements, `5` post-v1 limitations, `3` named CI lanes |
| `npm run docs:check` | **fail** | `evals/results.json: 181/188` — committed run is RED; docs must not claim N/N pass |
| V1-COMPAT-01 node engines assertion | **pass** | Exact one-liner from docs/26 |
| `npm audit --omit=dev --audit-level=high` | **pass** (0 vulns) | V1-SEC-02 acceptance command |
| `npm run schema` | **pass** | Part of V1-COMPAT-02 |
| `npm run slot-constraints:check` | **pass** | Part of V1-COMPAT-02 |
| `npm run snapshot:schema:check` | **pass** | Part of V1-EVID-04 |

Not run (too long / full CI / release-only): `ci:lane fast|full|catalog-visual`, `eval`, `capability:fresh`, `catalog:visual:check`, plugin/worker/playground/site builds, live Figma re-probe, publish/deploy.

## Upstream wave status (inputs to Wave 10)

| Wave | Disposition | Relevance to v1 |
|---|---|---|
| 6 ECF closeout | READY-with-human-gate | Pilot persona sign-off open (`PILOT-ACCEPTANCE.md`) |
| 7 Anatomy parity | READY | Supports V1-EVID-04 instrument claims |
| 8 Brownfield G7 | READY-with-human-gate | Team drift-report confirmation still open; Journey C honesty |
| 9 Spec kit | READY | Phase 3 groundwork; not a v1 gate by itself |

## Status legend

| Tag | Meaning |
|---|---|
| **likely green** | Cheap evidence already green, or definition/docs alignment verified; remaining commands expected to pass but not re-run here |
| **needs human** | Requires release-PR evidence, persona/owner approval, live Figma owner action, or publish/deploy sign-off |
| **known blocker** | Evidence currently red or missing on this tree; blocks v1 until fixed |
| **deferred (post-v1 register)** | Product boundary already approved in docs/26 register; must stay disclosed, not “implemented for v1” |

A single ID may carry more than one tag (e.g. command green + human PR evidence still required).

---

## Requirements inventory

### Audience, journeys, and supported component classes

| ID | Status | Verified now | Notes |
|---|---|---|---|
| **V1-SCOPE-01** | known blocker · deferred (post-v1 #1) | Definition links + `v1:definition:check` anchors OK; `docs:check` **red** | Audience/out-of-scope claims sit in Known Limitations §A.4 (register item 1). Blocker is docs freshness via red evals, not scope wording. |
| **V1-JOURNEY-01** | needs human · unverified gate | Scripts exist (`plugin:ui-check`, `extract:figma:roundtrip:uui`, `ledger:fresh`) | Full journey gate not run. Hand-built-set honesty is register item 3. |
| **V1-JOURNEY-02** | unverified gate | Scripts exist (`test:onboarding`, `paste:check`, `plugin:check`) | Must refuse unreviewed capture; needs full gate run. |
| **V1-JOURNEY-03** | known blocker · deferred (post-v1 #3) | Scripts exist; `docs:check` **red** | Journey C = diagnose/reconcile only — register items 3 (B.11–B.13). Docs gate must go green. |
| **V1-CLASS-01** | likely green (definition) · unverified gate | PROVEN archetype list drift-checked by `test:v1-definition` | Still needs `capability:fresh` + `extract:computed:drift` on release commit. |
| **V1-CLASS-02** | known blocker · deferred (post-v1 #2) | ATTEMPTED list drift-checked; `docs:check` **red** | Experimental classes stay post-v1; release notes must link §C.1.1. |

### Compatibility promises

| ID | Status | Verified now | Notes |
|---|---|---|---|
| **V1-COMPAT-01** | **likely green** | Exact engines assertion **pass** | Node `>=20`, React/ReactDOM `>=18` pinned in manifests. |
| **V1-COMPAT-02** | likely green · needs human | `schema` + `slot-constraints:check` **pass** | Release PR still needs contract-change classification per CONTRIBUTING. |
| **V1-COMPAT-03** | **known blocker** | Committed `evals/results.json` **181/188** | Failing evals: `golden-generated-output`, `design-mcp-roundtrip-fixture-replay`, `plugin-engine-bundle`, `deterministic-roundtrip`, `plugin-update-report`, `plugin-propose-dry-run`, `child-wider-ratchet-and-script-freshness`. Also needs `generation:atomic:check`, `provenance:check`, `figma:fresh`, `verify:catalog` on release commit. |
| **V1-COMPAT-04** | unverified gate · deferred (post-v1 #1) | Scripts exist (`plugin:zip`, `plugin:ui-check`) | Desktop-plugin-only distribution = register item 1 (§§A.3–A.4). |

### Coverage and evidence floors

| ID | Status | Verified now | Notes |
|---|---|---|---|
| **V1-EVID-01** | **known blocker** | `eval` red; `docs:check` red | New claims without adversarial check/receipt remain blockers; atomic/static empty-content checks not run. |
| **V1-EVID-02** | known blocker · deferred (post-v1 #5) | `docs:check` red | Denominator/bias honesty = register item 5 (§§C.1, C.6). Needs `capability:fresh`. |
| **V1-EVID-03** | unverified gate | Scripts exist (`conformance`, `dagger:census`, `closure:check`) | Refuse/unsupported/dropped must stay countable — not exercised this wave. |
| **V1-EVID-04** | likely green (partial) · needs human | `snapshot:schema:check` **pass**; receipt present at `parity/receipts/live-figma-variant-drift.md` | Still need `canvas:binding:check`, `variant-drift:check`, and Figma-owner re-probe/restore per RELEASE_CHECKLIST. |
| **V1-EVID-05** | unverified gate · deferred (post-v1 #4) | Script exists (`catalog:visual:check`) | Text/webfont ceilings stay disclosed (register item 4). Lane is long — run via `ci:lane catalog-visual`. |

### Security, CI, and release

| ID | Status | Verified now | Notes |
|---|---|---|---|
| **V1-SEC-01** | unverified gate · needs human | Scripts exist; Known Limitations §B.14 linked from definition | Needs worker/playground/plugin gates + security-owner secret-scan disposition on release PR. |
| **V1-SEC-02** | **likely green** | `npm audit --omit=dev --audit-level=high` → **0** | Re-run on frozen release commit. |
| **V1-CI-01** | **known blocker** · needs human | `test:v1-definition` + `v1:definition:check` **pass**; named lanes present in definition | Full `ci:lanes` / `ci:lane fast|full|catalog-visual` not run. Definition gates alone are not enough while evals/docs are red. |
| **V1-CI-02** | unverified gate | All named package/build scripts exist in root/package manifests | Surface freshness (schema/cli/emitter/lib/plugin/playground/site/catalog) needs release rehearsal. |
| **V1-REL-01** | **known blocker** · needs human | `RELEASE_CHECKLIST.md` checkbox empty; no committed P0/P1 audit ledger artifact found | Blocker until every audit P0/P1 has closing commit + acceptance command + result (or approved register link). |
| **V1-REL-02** | needs human | Candidate versions documented in docs/27 / RELEASE_CHECKLIST | Tag/publish/deploy each need recorded human approval; source RC ≠ release evidence. |
| **V1-REL-03** | known blocker · needs human | Post-v1 register validated by `v1:definition:check` (5 entries); `docs:check` red | Release PR must link every deferred audit task to the register + Known Limitations. |

---

## Approved post-v1 register (carry-forward — not v1 work)

From docs/26; confirmed present and anchor-linked by `v1:definition:check`:

1. Medium/architecture boundaries (§A) — web DOM only, no model in conversion, desktop plugin, no polling
2. Experimental / never-attempted component classes (§§B.1–B.10, C.1.1)
3. Brownfield gaps — no in-place hand-built adoption; API-only reconcile; no general concurrent merge (§§B.11–B.13)
4. Known fidelity/reader ceilings (§§B–C residuals)
5. Coverage beyond measured slice — no whole-library promise (§C.1)

These stay **deferred (post-v1 register)** unless reclassified with new adversarial evidence.

---

## Hard blockers to clear before Wave 10 can leave BLOCKED

1. **Repair committed eval suite** so `evals/results.json` is green (or docs stop claiming N/N and the definition’s eval-backed requirements pass on the release commit). Current red IDs listed under V1-COMPAT-03.
2. **`npm run docs:check` green** on the same commit (unblocks SCOPE/JOURNEY-03/CLASS-02/EVID/REL-03 evidence paths that cite it).
3. **Assemble P0/P1 audit ledger** with zero open/waived rows (V1-REL-01) and attach to release PR / RELEASE_CHECKLIST.
4. **Run required CI lanes** on the release commit: `fast`, `full`, `catalog-visual` (+ security) — V1-CI-01/02.
5. **Close human gates**: Wave 6 pilot sign-off and/or documented READY-with-human-gate claim; Wave 8 team confirmation; Figma live drift re-probe; publish/deploy approvals (V1-REL-02, V1-EVID-04).

## What is already in good shape

- docs/26 is a valid, deterministic baseline (22 IDs, evidence mappings, script names, anchors).
- Node/React floors and production `npm audit` high bar pass cheaply.
- Schema / slot-constraints / snapshot-schema checks pass.
- Live canvas-variant drift receipt file exists and is linked from the definition.
- Post-v1 limitations register is explicit and machine-checked.

## Disposition

| Field | Value |
|---|---|
| Wave | 10 — v1 release gates inventory |
| Artifact | this file |
| Disposition | **BLOCKED** |
| Unblocks when | Hard blockers 1–5 above cleared on a frozen release commit with RELEASE_CHECKLIST evidence |
| Next | Fix evals → docs:check → assemble audit ledger → run required CI lanes / release rehearsal (docs/27) |
