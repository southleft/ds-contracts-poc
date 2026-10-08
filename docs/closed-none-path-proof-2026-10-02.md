# Closed NONE path evidence, October 2, 2026

Figma's native API can report a closed vector contour with `windingRule: NONE`
and no vector regions while exporting a filled shape. The importer previously
refused that geometry and retained only paint. The contract now carries NONE
without changing it to NONZERO or EVENODD.

The supported case is one strictly convex closed contour made from M/L/Z
commands, with 3–256 unique float32 endpoints. Exact integer determinants over
float32 coordinates prove that every other vertex lies on the same side of each
edge. Curves, multiple contours, overlaps, concave shapes, repeated points,
degenerate edges and coordinates needing rounding remain named refusals. The
React mask uses nonzero filling only inside this qualified domain, where the
interior is independent of winding convention. Native creation and exact
readback preserve NONE.

Scratch controls in file `byMp6lt0Ij9b2QbkDGFwBh`, frame `399:2`, vectors
`399:3`–`399:5`, used identical 161×10 geometry and gray paint with NONE,
NONZERO and EVENODD. The NONE vector retained NONE and an empty region list.
All three native PNGs were byte-identical (185 bytes). The captured NONE PNG
and its provenance are in `core/fixtures/closed-none-rectangle-native.*`.
The CI-invoked filled-path tests compare both generated React surfaces against
that actual native raster on white and black; winding edits still fail exact
native readback.

A read-only canonical dumpShape check also retained original NONE winding and
path bytes on six source vectors, including fractional float32 width. That is
capture evidence, not source-version qualification or an accepted component.
The native dump grammar is 1.51; the embedded reader is verbatim. The REST
filled-geometry enum is unchanged because no equivalent REST source was
qualified in this experiment.

No kit was modified. No fidelity threshold, scoring implementation or score was
changed. This does not qualify arbitrary NONE paths, the complete source kit,
independent React-to-Figma input or the unseen-kit finish line.
