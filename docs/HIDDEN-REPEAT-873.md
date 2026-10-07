# Hidden repeat correction, 2026-10-06

The ordinary public importer previously refused Carbon Structured list row item
at hidden `col6`. Repeat inference combined hidden Col 6–8 into a visible
three-item collection, discarding their captured visibility. Repeat inference
now retains individual instances when any occurrence is hidden or has a
visibility property binding. Always-hidden unbound parts retain `display:none`;
visibility bindings and explicit visibility overrides remain editable.

The paint stacking guard now exempts only permanently non-rendering children,
with conditional display and layout overrides excluded from that proof.
The original source fixture is retained unchanged in
`core/fixtures/hidden-repeat/structured-list.json`.

Fourteen focused tests passed, including existing native and React visibility
control tests. Typecheck, targeted lint (existing warnings), plugin check and
lowering check passed. No source or scoring thresholds changed.

The five-family, 52-variant public admission probe still imports zero families.
Structured list's eight variants now reach the later validation stage and refuse
on visible Col 1–5's unresolved child contracts. This is not a visual pass.
Menu's 28 checkmarks have a Selected visibility binding and must remain editable;
permanently hiding them is not a valid fix. The next action is a canonical capture
of Structured list with its local cell-base and resizer dependencies, followed by
the ordinary public command. Whole-cohort dependency capture previously refused
a different family's remote Catalog dependency; do not bypass that refusal.

Evidence: private/beta-kits/slider-geometry-diagnosis-2026-10-01/paired-regression-integration/hidden-repeat-873
in the V1 checkout. Historical forward 2112/6312 (33.46%); reverse 2203 cases
remain unqualified. No new scoreboard pass credit and no shipping-date claim.
