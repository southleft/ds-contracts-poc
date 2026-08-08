# Post-ECF Wave 7 — Anatomy-level parity

- Run ID: `post-ecf-wave7`
- Status: READY (instrument + docs honesty)
- Branch: `feat/exact-conversion-wave0`
- Closed: 2026-08-05

## Landed

1. Confirmed Phase 1 exit criterion already held by `npm run variant-drift:check`
   (drives real `parity/diff.ts` over pristine/edited fixtures).
2. `core/anatomy-diff.ts` — contract anatomy → `part|channel|value` lines;
   `diffContractAnatomy`; `expectedCssVarsFromAnatomy` / `tokenRefToCssVar`.
3. `parity/diff.ts` — code surface now fails when a fully-resolved anatomy
   token ref is missing from the component CSS Module (`cssVars` was extracted
   but unused).
4. Gate: `npm run anatomy-diff:check` (wired into `workflow-spine:check`).
5. Docs honesty: ROADMAP, docs/07, docs/12 — anatomy fingerprint is no longer
   described as unwired.

## Acceptance

```bash
npm run variant-drift:check
npm run anatomy-diff:check
npm run workflow-spine:check
```

## Residual (named, not blockers)

- Stale `parity/snapshots/` without `variants` → NOT EXTRACTED until re-extract
- Nested-part states / overflowBindings (task #22) — still narrowed, not closed
- Axis-templated token products are not cssVars-checked (by design)
