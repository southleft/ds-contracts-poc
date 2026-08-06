# Post–Exact Conversion Finish — next waves to project completion

Branch: `feat/exact-conversion-wave0`  
Updated: 2026-08-05

This plan does **not** shrink `accuracy/baseline.json` or grammar ratchets.
SpeedDial remains a fail-closed negative control outside the MUI denominator.

| Wave | Status | Evidence |
|---|---|---|
| 6 ECF closeout | READY-with-human-gate | `wave6/` |
| 7 Anatomy parity | READY | `wave7/` + `anatomy-diff:check` + `variant-drift:check` |
| 8 G7 stubs | READY-with-human-gate | `wave8/` + `suggested-diff:check` |
| 9 Spec draft | READY | `spec/` + `wave9/` |
| 10 v1 gates | READY-with-human-gate | `wave10/` — evals **188/188**, fast **53/53**, full **33/33**; human release rows open |
| 11 Governance | BLOCKED (second impl) · A/B/D packaged | `wave11/` — subset + fixture-index + harness |

Sources: [ROADMAP.md](../../../ROADMAP.md), [docs/26](../../../docs/26-v1-definition.md), [docs/12](../../../docs/12-roadmap.md).

---

## Wave 6 — Exact Conversion Finish closeout + pilot sign-off

**Goal:** Seal ECF. Automation complete; persona sign-off tracked separately.

## Wave 7 — Anatomy-level parity depth

**Goal:** Differ below API surface. **DONE** — canvas fingerprint gate + contract anatomy/cssVars floor.

## Wave 8 — G7 + brownfield confirmation

**Goal:** Propose-only write-back stubs. **DONE** for stubs; team confirmation remains human.

## Wave 9 — Spec candidacy groundwork

**Goal:** `spec/` draft + conformance packaging. **DONE** as draft; second impl open.

## Wave 10 — v1 release gates (docs/26)

**Goal:** Binary readiness inventory and close automation-capable gates. **DONE** for automation (`188/188`, `docs:check`); human/release surfaces remain READY-with-human-gate. See `wave10/CLOSEOUT.md` + `AUDIT-LEDGER.md`.

## Wave 11 — Governance after second impl

**Goal:** Normative subset + conformance kit that a second implementation can fail. Packaging **READY** (W11-A/B/D); overall **BLOCKED** until W11-C (foreign dry-run). See `wave11/ledger.md`.

## Non-goals

- Shrinking accuracy or MUI DENOMINATOR-50 membership
- Promoting SpeedDial / data-grid / tree / date-picker as v1-supported
- Claiming lossless pixel identity or general concurrent auto-merge
