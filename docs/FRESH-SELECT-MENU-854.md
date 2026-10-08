# Fresh Select menu item check, iteration 854

Untitled UI `_Select menu item`, 64 drawn states: **48 pass / 16 fail / 0
unverified**, no set-level problems. Historical result was 29/64. The fresh
public import and unchanged checker remove all former text-color and size
findings. This is a known-kit result; no converter code changed this turn.

All 64 fresh layout PNGs are byte-identical to the historical archive. Remaining
findings: eight white-background image differences, seven black-background image
differences, and one missing text. Preserve their failing grades.

The missing-text case supplies a concrete next conversion defect:
`type-avatarLeading_supportingText-false_check-true_state-hover`. Source node
1096:7592 visibly draws Supporting text `@olivia` even though the drawn variant
says Supporting text=False. The current contract promotes State to interaction
states and gates the part only by supportingText, hiding this source exception.
This is an observed presence exception across state and props, not permission
to edit the source or guess missing content. Investigate whether state promotion
must retain an enum when it cannot represent such structural exceptions, or
whether existing state/presence vocabulary can carry the exact observation.
Validate general behavior across the drawn state domain before changing it.

Representative remaining image mismatch was visually inspected: the default
unchecked two-text case reports 7.88% on white. Do not assume a font mismatch
from pixels alone: the content check reports matching family, weight and color.

The larger MUI Button group was screened first but has many source export-origin
refusals already under investigation. This font-available group was chosen to
find a conversion defect rather than repeat that capture investigation.

Evidence in the V1 checkout:
`private/beta-kits/slider-geometry-diagnosis-2026-10-01/paired-regression-integration/fresh-select-menu-854/`.
No source writes, scoring changes, or full-network reruns. Historical global
forward remains 2112/6312; independent reverse remains 2203 unqualified.

Next: preserve the observed state-dependent Supporting text presence exception,
with a regression for normal state promotion and the counterexample above.
