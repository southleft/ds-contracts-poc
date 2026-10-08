# Tooltip dependency progress, 2026-10-06

Tracing Tile's Revert AI button refusal showed a dependency chain through Tooltip,
Tooltip body item, and its caret. The existing inherited-paint rule rejected a
caret solely because the caller supplied width/height inputs. Those geometry
inputs do not replace paint: the main identity, complete selected variable graph,
paint value, and absence of a fills override are still required to match exactly.
The rule now permits width/height root inputs only; opacity, color, padding and
other root inputs are not newly authorized by this change.

A fresh canonical 1.73 capture of Tooltip body item and its caret then exposed a
second gate: layoutByCombination demanded 36 Cartesian tuples even though the
source contract declares 14 explicitly absent. Shared reachableVariantTupleKeys
now serves both child arguments and owned container layout tables. Exactly the
22 reachable tuples are required; omitted reachable rows, extra absent rows,
duplicate rows and malformed domains still fail. No visual scorer was changed.

The public command now writes a TooltipBodyItem package and reaches rendering:
20 visual comparisons pass, zero fail, and two remain unverified with
`paint-extent-blend-promotion-changed-raster`. The set still fails overall with
`variant-prop-discarded:alignment`. Neither the 20 comparisons nor the absence
of image failures proves a qualified family. The alignment and framing failures
remain in the original receipts and must not be suppressed.

Structured List public regression remains 8/8. The related importer, child-order,
layout and absent-variant tests pass 73/73; typecheck, lint, plugin flows and
lowering checks pass. A real captured fixture pins exact inherited paint through
dimension inputs and exact reachable layout coverage, including negative cases.
The standard top-center white/black triptych was visually inspected.

Tile itself remains unqualified. Tooltip root mixes bound composition with
variants lacking that observation; other dependency failures include an omitted
Button icon owner, nonuniform AI label binding, and composed paint plus shadow.
Next work should address these shared paint representations using captured facts,
while retaining independent native readback as a separate gate.

Durable raw capture, batch diagnosis, public packages, receipts, PNGs and logs:
V1 checkout `private/beta-kits/slider-geometry-diagnosis-2026-10-01/paired-regression-integration/tooltip-dependency-881/`.
No aggregate rerun, new qualified family, or reverse qualification. Historical
forward remains 2112/6312 (33.46%); 2203 reverse cases remain unqualified. No push.
