# Exact conversion finish — Wave 3

- Run ID: `exact-conversion-finish-wave3`
- Task type: workflow spine (channel diff + three-way merge + adoption)
- Status: closed
- Current step: verified — Wave 3 READY
- Branch: `feat/exact-conversion-wave0`
- Depends on: Wave 2 closed (`disposition.json` READY)
- Disposition: `disposition.json` → READY

## Intake

Targets (plan + docs/18 G3/G4/G7/G10):

1. One typed per-channel diff model shared by parity, update reports,
   reconciliation, CLI summaries, and merge UI.
2. Three-way `genesis × incoming × canvas` merge with auto-compose on
   non-overlapping channels, named mine/theirs on collisions, refuse stale
   bases.
3. Design-led adoption safety: awaiting-code-adoption refusal (partially
   present), anchor-derived suggested patches, PR-first CI defaults,
   `code.root` vs `generate.out` split.
4. Interior canvas edit protection: preserve where grammar permits; else
   enumerate Apply rebuilds + before/after preview + recovery receipt.

Acceptance:

- Concurrent MUI scenario completes with no silent winner.
- Design-approved change cannot be reverted by later extraction.
- Every destructive operation has a preview and audit record.
- Accuracy denominators / Wave 2 oracle gates do not regress.

## Discovery summary

| Surface | Status |
|---|---|
| G8 `StyleChange` in `figma-sync/plugin/engine/entry.ts` | SHIPPED — plugin-local |
| `diffSnapshots` / `SnapshotChange` in `parity/variant-drift.ts` | SHIPPED — Node copy of plugin pairing |
| G2 drift-aware Apply | SHIPPED |
| G1 freshness / seq | PARTIAL (deliver half) |
| G3 three-way merge UI/engine | **OPEN** |
| G4 awaiting-code-adoption | **PARTIAL** — `extract/static-promotion.ts` + schema + diagnose; not end-to-end on all extract paths |
| G7 brownfield suggested diffs | OPEN |
| G10 PR-first + code.root split | OPEN |
| G11 `diff --summarize` | OPEN |

TRIAGE-SEAMS: `writes-mutations` (Apply / merge / receive) — inherit Wave 1
path guards; new merge write paths need the same review class.

## Ordered slices

1. **Typed channel-diff core** — `core/channel-diff.ts` + tests; parity
   consumes it; plugin keeps ES5 twin (gate-pinned) until a shared emit
   lands. Check: unit tests + `variant-drift:check` / plugin G8 still green.
2. **Three-way merge engine** — pure `genesis × incoming × canvas` resolver
   with stale-base refusal; CLI/eval fixtures for MUI concurrent scenario.
   Check: auto-merge non-overlap; collision requires mine/theirs; stale
   base throws named error.
3. **Adoption + CI defaults** — harden awaiting-code-adoption on remaining
   extract paths; PR-first code-led; `code.root` / `generate.out` split;
   anchor suggested patches (G7 lite). Check: silent-revert fixture fails
   closed; CI recipe validation.
4. **Apply preview + recovery receipts** — enumerate rebuild scope; before/
   after; audit stamp. Check: plugin-engine / receive tests.

## Checkpoints

- `intake-ready`: complete
- `plan-ready`: complete
- `implementation-ready`: complete
- `verified`: complete — `npm run workflow-spine:check` green; MUI oracle 32/0/0
- `closed`: complete

## Landed

- `core/channel-diff.ts` (+ check); parity `diffSnapshots` consumes it
- `core/three-way-merge.ts` (+ check) — auto-compose, mine/theirs, stale-base
- `core/apply-preview.ts` (+ check) — overwrite risk + recovery receipt
- `core/awaiting-adoption-check.ts` — G4 silent-revert pin
- `examples/ci/code-led.yml` — PR-first (G10); `validate.mjs` updated
- `npm run workflow-spine:check` + fast.yml gate
- Exports on `core/index.ts`

## Next

Wave 4 — closed-pilot UX (onboard state machine, designer/engineer unaided journeys).
