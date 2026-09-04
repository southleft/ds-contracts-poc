# Recipe-IR — the v1 proof surface

This directory is the **recipe-IR** path: archetype recipes compile to a
canonical Figma-capability IR, and every fact is named or carried.

It is **not** exported from `@ds-contracts/cli`, `@ds-contracts/core`, or
`@ds-contracts/schema`. npm publish of a recipe surface is deferred.

## Current state (2026-08-30, merge `4caebfc5b` and later)

Five archetypes have stayed live Scratch mints and owner-signed human
grades:

| Archetype | Live page | Offline gate | Human grade | `overallSuccess` |
| --- | --- | --- | --- | --- |
| Button | `183:69150` | `npm run recipe:button:check` | passed | **false** (F1 unmet) |
| Input / Field | `115:295378` | `npm run recipe:input-field:check` | passed | **false** (F1 unmet) |
| Combobox | `163:35981` | `npm run recipe:combobox:check` | passed | **false** (F1 unmet) |
| Table | `173:48924` | `npm run recipe:table:check` | passed | true (v32 record; do not restamp) |
| Table (v38, the per-side cell rule) | `251:99309` | `npm run recipe:table:live:v38:check` | **grade held by the owner** | round trip clean: 615/615 and 619/619 facts matched, 0 silent, 0 refused (`recipe/evidence/table-live-v38-mint-record.json`) |
| Calendar | `181:64873` | `npm run recipe:calendar:check` | passed | **false** (F1 unmet) |

Product **v1 is incomplete**. F1 (whole-corpus / unseen-library on the
recipe path) is the named blocker. Do not flip `overallSuccess`. Do not
restamp hashed RECORDs.

Named leftover work: Combobox chrome remint after hardening; signed
cleanup of older Calendar Scratch pages; npm publish deferred.

Status pin: `npm run recipe:pivot-status:check`.

The playground and Journeys A–C still drive the pre-pivot universal
contract (`contracts/*.contract.json`). They are not this path.

Full chronology and the F-checklist walk:
[docs/32-recipe-ir-pivot.md](../docs/32-recipe-ir-pivot.md).
Release bar: [docs/26-v1-definition.md](../docs/26-v1-definition.md).
