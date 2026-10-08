# Tooltip body passes 22/22, 2026-10-06

The public TooltipBodyItem command now passes all 22 variants with no set problems
or unverified cases, using the same canonical source capture, IBM Plex Sans
manifest, checker, and thresholds as 881. Package SHA256:
6c5726b7fb8f82153d95a244a8768047b3c584b224a957d38783950222eb9305.

The discarded alignment was a real importer loss: source root counter alignment
is CENTER/MIN/MAX for Center/Start/End, with distinct caret positions. The complete
multi-axis layout path still demanded all 36 Cartesian tuples, despite 14 complete
source absences. It fell back to carrying direction alone. It now excludes only
validated complete absent tuples from the required domain, retains all observed
layout channels, and refuses observations in those absent tuples. Incomplete
part observations still do not establish a complete domain.

The new actual-capture regression verifies start/center/end alignment and reversed
bottom flow. Related import, layout, order and absent-variant checks pass 73/73;
typecheck, lint, plugin and lowering checks pass. The aligned top/end comparison
image was visually inspected. The two former blend-framing refusals do not recur
in this public run after alignment is retained; no capture/scoring guard changed.

Broader scope check: seven prior cached families with lost-layout notes were
re-imported. Six still import with their previous lost-layout notes; no additional
visual qualification is claimed. Rich text section (113) refuses a Content layout
table's incomplete domain. A controlled run using HEAD's proposer (81d8141f6),
with the same remaining tree and source, produces the identical refusal. The
proposer bytes were restored in a finally block. This is a pre-existing current-
head failure, not a regression caused by this patch; its old 876 admission does
not establish current qualification. Retain it as a separate backlog issue.

Durable receipts, packages, images, cohort and controlled baseline results:
V1 checkout `private/beta-kits/slider-geometry-diagnosis-2026-10-01/paired-regression-integration/tooltip-alignment-882/`.

No full 40/204 visual rerun or independent native qualification this turn.
Historical forward remains 2112/6312 (33.46%); 2203 reverse cases are unqualified.
The targeted 22 passes are not added to the historical denominator. Tile still
requires mixed/absent paint support in Tooltip and other dependencies. No push.
