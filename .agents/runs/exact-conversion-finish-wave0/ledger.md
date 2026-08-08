# Exact conversion finish — Wave 0

- Run ID: `exact-conversion-finish-wave0`
- Task type: product accuracy contract and conversion-core discovery
- Status: in progress
- Current step: discovery and baseline measurement
- Branch: `feat/exact-conversion-wave0`
- Canonical baseline: `main` at `e148d2d0d46353a89d4693d9714dec26177ab9ba`

## Intake

Target surfaces:

- `conformance/`
- `extract/figma/conformance/`
- `extract/figma/roundtrip-uui/`
- `evals/`
- conversion readers and emitters implicated by the feasibility spikes

Acceptance:

1. One declared product grammar accounts for the existing CSS/DOM and canvas
   conformance denominators without deriving expectations from engine output.
2. R1–R6 are machine-readable, reproducible metrics with committed ratchets.
3. Every original fact is classified; unclassified loss and divergence are zero
   before Wave 0 closes.
4. Hand-built variant-axis recovery receives an evidence-backed go/no-go verdict.
5. Nested-instance and text-style losses are localized to exact pipeline stages.

Reviewer expectations:

- independent root-cause and code-archaeology discovery;
- failing-before/passing-after tests for every new gate;
- full affected CI lanes;
- cold review before Wave 0 closes.

## Triage

The measurement layer itself touches no authorization, tenant-isolation,
credential, secret, external-write, or deployment seam. Later waves will be
triaged independently when their write and delivery surfaces begin.

## Checkpoints

- `intake-ready`: complete
- `plan-ready`: complete
- `contract-read`: complete — Figma's current Plugin API defines
  `componentPropertyDefinitions` as the set-level authority, including
  `VARIANT.variantOptions`, and exposes each component row's realized values
  through component properties. Non-variant property keys retain their `#…`
  identity suffix. Legacy name parsing is not authoritative.
- `implementation-ready`: complete — both feasibility spikes and the additive
  structured-axis contract are recorded
- `verified`: complete — focused gates, fast lane, full lane except corrected
  site parser, then corrected site build; repeated cold reviews
- `closed`: complete — final cold review reports zero critical/major findings

## Baseline evidence

- 15/15 Untitled UI round trips execute to completion.
- Six component sets violate exact variant-count preservation.
- Unclassified current facts: 885 diverged and 665 lost.
- Invented facts are tagged, but their declared normalization rules are not yet
  machine-checked.

## Variant-axis feasibility spike

Verdict: conditionally feasible with high confidence.

- Exact recovery requires structured set definitions plus a complete structured
  tuple on every row.
- The current dump discards those definitions and reconstructs axes from names.
- Independent contract axes regenerate a Cartesian product. Ragged sets cannot
  round-trip exactly without a valid-combination vocabulary.
- Untitled UI Slider is 40 observed rows over a 64-row Cartesian product; the
  missing 24 encode `left < right`.
- Untitled UI Toggle's 32 → 10 change is an intentional but currently
  under-specified state-axis projection.
- Strict mode will refuse ragged or semantically ambiguous sets until the
  contract explicitly authorizes their projection.

Planned refusal families include missing/contradictory definitions, incomplete
or duplicate tuples, canonical collisions, ragged matrices, missing/extra rows,
ambiguous state/theme semantics, and projection-count mismatch.

## Identity-loss archaeology

- Nested component identity survives capture and proposal as contract IDs and
  Figma anchor keys.
- The first semantic downgrade is the Figma emitter: child IDs are converted to
  dependency names and runtime lookup is name-only.
- Current round-trip comparison conflates path restructuring with target
  identity and never compares component keys.
- Text styles first lose stable key identity during capture, then foreign style
  names are sanitized into imported token paths that the emitter excludes from
  style derivation.
- The current MUI pilot contains no nested component refs and no emitted named
  text styles, so Untitled UI remains the required identity oracle until the
  MUI corpus gains those cases.

No contract-schema change is required for nested instances. Text-style identity
should first ride explicit token metadata; a part-level schema field is deferred
unless regeneration must work without the captured token bundle.

## Implementation evidence

- The bounded grammar and R1–R6 ratchets are implemented and CI-wired.
- The prior 1,550 unclassified source facts are now assigned to explicit
  normalization, instrument-limit, or unresolved-defect classes; R5 is zero
  and ratcheted at zero.
- Exact structured projection validation is implemented with legacy,
  verified-exact, and typed-refusal outcomes.
- 27 exact-projection falsification checks pass.
- REST capture preserves full property definitions, row tuples, and identity
  suffixes in a focused executable check.

## Independent review and recovery

The first cold review returned NOT MERGE-READY with two critical and five major
false-green paths. All are treated as blockers:

- source-only matrix validation is now a distinct status and can never count as
  returned-projection exactness;
- Plugin capture now passes the component-set parent and is executable-tested
  to emit complete structured tuples;
- fact comparison is a multimap, not last-write-wins; missing-variant and
  derivative facts remain in the ledger;
- source and return conservation equations are asserted per component, totals
  reconcile, and the original-fact denominator is decrease-protected;
- R2 counts target substitutions and R3 counts style substitutions;
- exact receipts, component identities, statuses, and totals are structurally
  validated;
- every fact class has an executable bounded predicate;
- the UUI report regenerates in a temporary directory and byte-compares in CI;
- R4 commands are unique and pinned by identity, not count alone.

The next review found three narrower evidence-forgery paths. Recovery:

- restructured bases now require exactly one loss and one invention;
- wrapper evidence is limited to an explicit structural channel inventory and
  must cite a real restructured descendant;
- repeated same-named children use a separate numbered-sibling disposition;
- npm aliases are canonicalized across supported `--silent`/`-s` placements
  before terminal-check uniqueness is evaluated.

All three review mutations now have dedicated falsification tests.

## Close-out

Final independent review verdict: merge-ready, zero critical/major findings.
Wave 0 closes with:

- one bounded grammar and executable fact-class predicates;
- structured Plugin/REST axis evidence and strict projection refusals;
- byte-fresh round-trip evidence;
- 20,928 source facts and 28,185 return facts conserved exactly;
- 0 unexplained source facts and 0 unexplained inventions;
- current defect baselines exposed rather than hidden: 6 variant-count
  mismatches, 750 nested-identity violations, and 409 text-style identity
  violations;
- CLI source advanced to unpublished `0.5.0-rc.2` because its bytes changed.

Verification after recovery:

- focused accuracy tests: 27 passing;
- exact-projection checks: 28 passing plus REST legacy/structured capture;
- fast lane: green;
- full lane: 32/33 green, with only `site:build` failing because its parser
  still requested the retired “components closed” row;
- corrected `site:build`: green;
- plugin engine/UI, generated evidence freshness, docs, typecheck, and CI gate
  coverage: green.

