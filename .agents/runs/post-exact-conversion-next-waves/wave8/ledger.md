# Post-ECF Wave 8 — G7 suggested diffs

- Status: **READY-with-human-gate**
- Closed: 2026-08-05

## Landed

- `core/suggested-diff.ts` — propose-only stubs from `ChannelChange` + provenance anchors
- Shape matches docs/18: `Badge.module.css:14: var(--radius-md) → var(--radius-lg)`
- `autoApplied` always false; `assertProposeOnly` fail-closed
- Gate: `npm run suggested-diff:check` (in `workflow-spine:check`)
- Docs honesty: docs/18 G7 PARTIAL; docs/23 B.13 table updated for G3/G4/G7/G10/G11

## Human residual

- Design-system team confirms a real drift report (Phase 2 exit)
- PR comment emitter + static `file:line` readers

## Next

Wave 9 — `spec/` draft + conformance kit packaging
