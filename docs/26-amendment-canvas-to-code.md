# Proposed docs/26 amendment — canvas→code held-out exam (3f)

> **Status: PROPOSED — awaiting owner sign-off.**
> This sibling of [docs/26](26-v1-definition.md) does **not** flip any existing
> F-checklist row, does **not** flip `overallSuccess`, and does **not** claim
> product v1. It records the amendment that [docs/35](35-two-journey-v1-plan.md)
> §5 3f / §6 requires before the canvas→code held-out exam can enter the
> release contract.
>
> Adopted direction (docs/35 owner decisions): canvas→code is a co-equal
> pillar with code→canvas; both held-out exams gate v1. Stamping this
> amendment into docs/26 itself is an **explicit owner action**, not an
> agent side-effect.

## Proposed F-checklist addition

Add one row beside the existing F1–F6 walk in
[docs/32 § merge execution](32-recipe-ir-pivot.md#merge-execution-2026-08-30)
(and, on sign-off, a matching requirement row in docs/26):

| row | proposed verdict language |
| --- | --- |
| **F-C2C** canvas→code held-out exam (docs/35 §5 3f) | **PROPOSED gate.** A component set the recipe path never minted as a first-class stay goes committed-observe → canvas facts → bridge → emit → Chromium computed-style diff with **zero silent losses**. Evidence: `recipe/evidence/canvas-to-code-held-out-v1/`; gate: `npm run recipe:canvas-to-code:held-out:check`. Passing the gate proves accounting honesty on a held-out substrate — it does **not** alone flip product v1 or any archetype `overallSuccess`. |

## Exact acceptance command (proposed)

```bash
npm run recipe:canvas-to-code:held-out:check
```

## Substrate measured on this proposal (2026-08-31)

- **Option 1 chosen:** Scratch file `byMp6lt0Ij9b2QbkDGFwBh`, page
  `antd exam 2026-08-23` (`33:2`), COMPONENT_SET `Card` (`33:5093`).
- Card is **not** in the signed/boilerplate stay list (no `recipe:card:*`
  gate; page is exam/census chrome).
- Observe: read-only MCP extract →
  `recipe/evidence/canvas-to-code-held-out-v1/observe-antd-exam-card.json.gz`.
- Zero Figma writes. No Polar facts invented. No live Scratch exam page created.

## What this amendment deliberately does not do

- Does not rewrite any existing docs/26 requirement row.
- Does not flip F1 (whole-corpus / unseen-library on the recipe path).
- Does not set `overallSuccess: true` for any archetype.
- Does not mint a human grade (`humanGrade: pending`, `gradeInvented: false`).
- Does not publish npm.

## Owner sign-off checklist

When adopting, the owner should:

1. Paste the F-C2C row into the docs/32 merge-execution F-checklist (or the
   docs/26 requirements table) with an attributable date and name.
2. Confirm the held-out substrate (or name a replacement) remains acceptable.
3. Leave product v1 **incomplete** until **both** F1 (code→canvas held-out)
   and F-C2C pass under the same release commit.
4. Delete or archive this sibling file only after the text lives in docs/26 /
   docs/32 under sign-off — do not silently absorb it.
