# Designer Badge visual measurement — 2026-09-14

This compares generated React with the original read-only Altitude Figma export.
It is a separate canvas→code measurement, not an F1 library score or owner grade.

The original component-set PNG is preserved intact. Each comparison crops it
using the variant bounds in the unchanged observed canvas facts. Generated PNGs
were captured twice by Playwright CLI, with byte-identical results. The manifest
pins source observations, emitted code, actual font witness, and both image roles.

`npm run recipe:canvas-to-code:check` re-derives the scores and checks complete
variant coverage, crop bounds, image hashes, repeated capture identity, and
current emitted code. Planted metric/crop/image/missing-state changes must fail.

All states pass the existing five-percent antialias-aware threshold. Raw pixel
differences are retained and are substantial; this is NOT exact pixel identity.
The result covers this one designer-drawn set, not all designer exam subjects.
No custom masks, adjusted threshold, or hand-tuned width compensation were used.
