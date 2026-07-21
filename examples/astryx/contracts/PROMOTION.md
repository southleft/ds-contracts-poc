# Astryx flagship contracts — promotion record

**Promotion is the human-owned step** the census (`../extraction/CENSUS.md`)
deferred: the `../extraction/static-contracts/` are the pipeline's mechanical
**proposals**; the ten files here are the curated, committed **contracts** —
`v0.1.0`, `status: draft`, generatable end-to-end (see `../DEV-JOURNEY.md`).

Subject: `@astryxdesign/core@0.1.6` (PINNED, MIT — see `../PROVENANCE.md`).
Extraction date 2026-07-20, `react-tsx` adapter.

## The set (10)

| contract | census facts-carried | why promoted |
|---|---|---|
| `button` | 14/20 (70%) | the canonical control |
| `badge` | 1/3 (33%) | the 14-value `keyof` variant recovery |
| `banner` | 5/9 (56%) | status surface, dismissable/expand flags |
| `checkbox-input` | 14/19 (74%) | form control, size + state flags |
| `switch` | 16/20 (80%) | toggle, label placement axes |
| `card` | 1/6 (17%) | the 13-value `keyof` surface-tone recovery |
| `token` (Tag/Chip) | 9/11 (82%) | size × color, richly bound |
| `progress-bar` | 8/9 (89%) | **richest census extraction** |
| `text-input` | 19/23 (83%) | richest text-field extraction |
| `slider` | 18/22 (82%) | union-of-refs recovery (was a named skip) |

## What each contract carries vs. what was dropped

Every promoted contract keeps the **structural + visual** axes verbatim from
the proposal and adds (a) string defaults for required text props and (b)
authored anatomy with StyleX token bindings. The **named drops** per contract
(the honest losses — most are the residual classes CENSUS.md §"Residual
facts-carried losses" already diagnoses):

- **button** — dropped: `type`, `name`, `form`, `target`, `rel` (HTML
  passthrough), `href` (link-mode), `isInterruptible`, `tooltip`.
- **badge** — `children` is a **materialized text slot**; Astryx types the
  label as a ReactNode child (a `node` prop, dropped in extraction).
- **banner** — `defaultIsExpanded` dropped; message is a materialized slot.
- **checkbox-input** — dropped: `description`, `disabledMessage`, `htmlName`,
  `isLoading`, `isLabelHidden`, `isOptional`. Control renders as a styled
  box, **not** a native `<input>` (a11y semantics = Phase A-2).
- **switch** — dropped: `value`, `description`, `htmlName`, `labelTooltip`,
  `disabledMessage`, `isLoading`, `labelSpacing`, `isOptional`. Track is a
  styled box, not a `role="switch"` input.
- **card** — body is a materialized text slot (Astryx body is ReactNode).
- **token** — dropped: `href` (link-mode), `description`, `isLabelHidden`.
- **progress-bar** — `value`/`max` are carried as props but **do not yet
  drive the fill width** (the fill is a static token-styled box); `hasValueLabel`
  and `isIndeterminate` render as data-attributes only. Live geometry = A-2.
- **text-input** — dropped: `description`, `disabledMessage`, `labelTooltip`,
  `htmlName`, `isLoading`. `value` is shown via the materialized placeholder;
  the field is a styled box, not a native `<input>`.
- **slider** — dropped: `value`, `description`, `disabledMessage`,
  `labelTooltip`, `htmlName`, `min`/`max`/`step`, `minStepsBetweenThumbs`.
  Track/thumb are styled boxes at rest position, not a native range input.

## Fidelity scope (state it plainly)

This is **CODE-SIDE extraction**: the public API + StyleX/code token bindings.
It is **structural truth + token bindings, not pixel-perfect styling**. The
computed-floor pass (real-browser computed styles → exact paddings, sizes,
live geometry) is **Astryx Phase A-2**, gated on the depth build freeing
`extract/computed`. Names, enums, token bindings: real. Pixel fidelity: later.
