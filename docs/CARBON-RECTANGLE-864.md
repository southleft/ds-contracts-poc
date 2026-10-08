# Carbon rectangle contour qualification, iteration 864

The importer now recognizes an exact four-corner rectangle contour and lowers
it through the existing editable rectangle owner. This is contour equivalence,
not a bounding-box substitute for arbitrary vectors. Curves, diagonal edges,
extra contours, unsupported shape metadata, strokes and effects retain their
existing route. Source occurrences and their paint/binding evidence are not
rewritten. Captured fill dimensions stay flexible instead of gaining a fixed
width from the vector's measured bounds.

Carbon `_Accordion content skeleton` (5734:286365) previously refused at its
vector Spacer. Both variants now compile and render through the internal draft
route, using the actual plugin capture and captured tokens. Fresh source PNGs
were compared with both React emitters and compiler-created Figma variants:
all six comparisons have **0% unmasked image difference on white and black**
with the unchanged scorer, recorded origins and 320-by-96 outer dimensions.
This is internal qualification, not a public benchmark pass or unseen-kit test.

Live component set: https://www.figma.com/design/NqssRZQpSjChxv5VyN1ZvJ?node-id=155-66994
Independent source/native tree comparison matched all 16 nodes, excluding the
explicit generated paint receivers, with maximum position/size difference
0.000091553 px. The source has no text or fonts. React regression coverage
checks both alignments, both emitters, the transparent third cell, immutable
source evidence, and resizing the root from 320 to 440 px.

Four native receivers retain the exact tiny alpha and variable binding. A
separate readback found that two nested paint rectangles are 85 px wide while
their fill-sized hosts are 85.333328 px. This is within the component size gate
and invisible in this tiny-alpha case, but does not satisfy the existing exact
receiver verifier. Public binding acceptance therefore remains closed. Resolve
post-layout receiver geometry before claiming complete native paint carriage.

The first draft write lacked the captured ordinary token layer and failed
before component creation. Its sole empty page 155:66968 was inspected and
removed, then the script was rebuilt with the standard captured-token layer.
Source files were read-only throughout. The successful run is retained.

Checks: nine rectangle/growth regressions, nine path/group regressions, final
two rectangle tests, typecheck, targeted lint, plugin check and lowering check
passed. Engine receipt and line citations refreshed; no scorer changes.

Historical forward stays 2112/6312 (33.46%); reverse stays 2203 unqualified.
Next complete receiver sizing and public binding integration, using this same
component instead of another isolated fixture. No owner action required.
Evidence and reproduction scripts: V1 private integration `carbon-rectangle-864`.
