# Computed-capture spike — Polaris Button, measured

One run of `run.ts` (143s): real `@shopify/polaris@13.9.5` Button mounted in headless Chromium 148.0.7778.96, **120 prop combos** (full variant×tone×size×disabled cartesian) × **4 interaction states** (default / hover / focus-visible / active, driven the visual-parity way) = **480 captures**; every capture reads **942 computed longhands** (the browser's own enumeration — no whitelist) on **2 elements** plus `::before`/`::after`.

## The numbers (verbatim from numbers.json)

| metric | value |
|---|---|
| determinism (double full sweep) | byte-identical across two full sweeps in one session |
| focus-visible driver matched `:focus-visible` | 60/120 captures |
| styled channels (vs in-page control probe) | root: 61 · label: 16 |
| **bound** — carried-binding cells confirmed | **740/816** (exact string equality, browser-probed token values, no tolerance) |
| **binding contradictions** | 76 — every one with a committed NAMED CAUSE (0 untriaged) — LEDGER.md |
| **minted** leaves / bindings | 863 leaves · 38 base + 92 state bindings (17 uniform · 25 per-axis · 47 per-pair · 41 refused) |
| **code-only** (extension block) | 25 base + 20 state channels; 50 overflow bindings |
| pseudo-element findings (focus ring class) | 0 |
| enriched contract schema-valid | YES (ContractSchema.parse) |
| replay computed equality | 901920/902400 cells (99.947%) |
| pixel, exact (threshold 0, AA counted) | mean 0.017% differing · max 1.129% · 369/480 pairs pixel-perfect |
| pixel, AA point (threshold 0.1, AA excluded) | mean 0.000% differing · max 0.000% · 480/480 pairs at zero |

### Worst pixel rows (named, no tolerance widening)

- `primary.none.micro.enabled__hover`: exact 1.129% · AA 0.000%
- `primary.none.micro.enabled__focus-visible`: exact 1.129% · AA 0.000%
- `primary.none.micro.enabled__active`: exact 0.967% · AA 0.000%
- `secondary.critical.large.enabled__active`: exact 0.397% · AA 0.000%
- `secondary.critical.micro.enabled__active`: exact 0.396% · AA 0.000%
- `secondary.critical.slim.enabled__active`: exact 0.396% · AA 0.000%
- `secondary.critical.medium.enabled__active`: exact 0.396% · AA 0.000%
- `secondary.success.micro.enabled__active`: exact 0.353% · AA 0.000%

### Top replay-mismatched channels (computed re-read)

- `inline-size`: 192 cells
- `width`: 192 cells
- `perspective-origin`: 96 cells

Named re-read exclusions (never silent): `app-region`, `text-decoration` — app-region is unsettable outside app contexts; text-decoration is a shorthand Chromium enumerates whose re-serialization reorders (its longhands are captured, applied, and compared individually).

## Findings the sweep surfaced (obstacles are findings)

- **@media caught as contradictions (S7 evidence)**: a first run at an 800px-wide viewport (past Polaris's 48rem md breakpoint) turned every size binding into a named binding-contradiction receipt — 120 rows: min-height/min-width on all sizes (e.g. micro expected 28px [p.height-700, the base value the contract carries], observed 24px [p.height-600, the md-up override]) plus slim/micro label typography. The committed run pins the sub-md viewport the contracts carry (the verify.ts convention); the receipts prove conditional styling cannot silently pass the floor.
- **tone × variant multi-axis conditions**: the static promotion REFUSED tone styling by name (`.toneCritical:is(.variantPrimary)` — one value conditioned on two axes). The floor observes the resolved per-combo truth: tone contradictions against the variant-only bindings are named, and the mint pass carries the same values as per-axis-pair leaves (47 pair bindings) — the 333-refusal ceiling turns into carried, receipted values.
- **composition-owned typography receipted precisely**: the showcase named "labels render through the Text primitive" as an honest gap; the floor now MEASURES it — the plain variant's label is bodyMd (13px/20px) not the carried bodySm (12px/16px), and the primary label is fontWeight 650 not the carried 550. Variant-conditioned child-component props, invisible to single-file static promotion, caught as 36 named contradiction rows.
- **fusion precedence held**: contradiction rows do NOT auto-override the reviewed static bindings — they are the review queue (the static layer owns names; the floor owns truth). The auto-resolution policy is build-plan work, not a spike decision.
- **no pseudo-elements on this Button** (0 findings): Polaris 13.9.5 draws the focus ring with `outline` on the root, not the `::after` pattern — the ::before/::after capture path ran on every element and found content everywhere 'none'. S5 (pseudo decor parts) stays designed-but-unproven on this component.
- **focus-visible driver**: matched `:focus-visible` on 60/120 captures — exactly the 60 enabled combos; disabled buttons are not focusable (Tab lands elsewhere; delta zero) — the inertness receipt.
- **mount-context strut**: the first run's replay drifted 14px vertically because the component's line-box position depended on the stage's inherited font metrics — fixed by a flex mount stage on BOTH sides; inherited context is part of the mount recipe, receipted in provenance (DESIGN.md §1.1/§4).

Artifacts: `captured-truth.button.json` (capture + provenance), `button.enriched.contract.json` (+ `.extension.json`), `LEDGER.md`, `numbers.json`, `pixel-rows.json`, sample pairs in `receipts/` (left = original Polaris render, right = replay from captured truth).

