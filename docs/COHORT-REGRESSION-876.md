# Broader admission audit and hidden-slot correction, 2026-10-06

Replayed the original 204 cached source dumps against f0711ed17, with fresh
session state for each. This is admission evidence, not rendering qualification.
174 sets imported, 30 refused. Against checkpoint 859 (173/31): Atlassian Avatar
group (10 variants) and Primer SingleSelect-SelectPanel (36) newly imported;
Primer Loading (12) regressed due to the hidden-node change from checkpoint 873.

The regression assigned display:none to an always-hidden slot. Slots cannot
restyle consumer-owned content. The fix expresses absence through a complete
presence table, retaining the slot without styling it. A targeted ordinary
import rerun restores Loading admission. This yields 175 admitted cases if the
single corrected row is combined with the pre-fix census; a fresh full scan
has not been claimed. The original cached Carbon dumps still lack consuming
variable evidence and do not supersede the fresh 8/8 structured-list result.

Public checks with benchmark fonts:
- SingleSelect-SelectPanel refuses package generation: RadioInput applies a size
  override to an unresolved DotFill stub which has no size input. No pass credit.
- Loading packages, but fails all 12 visual checks: unavailable SF Pro Text,
  incorrect text color/layout, and discarded slot/variant controls. No pass credit.
- A fresh canonical Menu capture refuses its remote Checkmark dependency. The
  local-main-only reader fence remains intact; no source was edited or stubbed.

Largest next shared admission target: Accordion item (120) and Tile (65) reject
non-reversal child paint permutations. Cached evidence shows that Accordion
reorders arrow/title while keeping an absolute decoration at the end; Tile
also interleaves hidden decorations. A whole-list reverse flag cannot express
those orders. Do not merely suppress the refusal or erase editable hidden nodes.

Validation: 41 focused presence/slot tests pass, including the real Primer
fixture, plus typecheck, targeted lint (existing warnings), plugin and lowering
checks. No new visual pass, reverse qualification, full CI or push claimed.
Evidence in the V1 checkout:
private/beta-kits/slider-geometry-diagnosis-2026-10-01/paired-regression-integration/cohort-regression-876/.
