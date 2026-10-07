# Failure priority diagnostic, iteration 860

This is a bounded prioritization experiment, not a new global scoreboard.
The active writer is `codex/root-paint-carriage` at `2d252eca6` with the existing
parked REST-reader and package changes preserved. The previous advisory turn
produced no implementation or newly measured passes.

The historical full204 results rank two Radix Button sets first: 582 and 576
failures, with 576 missing-SF-Pro findings in each. macOS SFNS is explicitly
rejected as that family by the existing font-authentication test. No font
alias, fallback substitution, or source mutation was made. Apple font source:
https://developer.apple.com/fonts/index.html . No font downloaded or installed.

The largest current admission refusal is child-paint-order-permutation:
185 variants in Carbon Tile and Accordion. Direct source inspection confirms
Accordion reverses chevron/title flow while retaining background/focus layers
at the end. A normal/reverse whole-child sequence cannot carry that ordering.
This is a semantic implementation candidate, not 185 promised passes.

MUI Button is the next selected measured candidate with the requested font
available: historical 252 pass, 84 fail, 24 unverified, 360 total. Of the 108
non-passes, 96 have source image-framing failures (72 also content-size), and
12 have only image-difference findings. Refreshing the dump adds only
sourceEmptyFill and emptyStrokeTarget metadata; all other requested-set JSON
matches the retained dump exactly. The replay uses current public generation,
authenticated fonts, retained source PNGs/bounds, and unchanged checker code.
It is not a fresh image capture or never-seen-kit qualification.

TRIAGE.json pins the input summaries by SHA256 and ranks all measured failures
and current admission refusals. DUMP-DIFFERENCES.json records the reader delta.
Do not repeat a full importer census for a diagnostic with no converter change.

The first cached replay refused all 360 cases because the old archive lacks
required full-bounds render exports. This is a cache failure, not a converter
regression. A live rerun was started using the same generation and fonts.
A read-only replay-source.mjs now preflights bounds and all required images
before browser startup. It rejects the incomplete MUI archive and accepts the
complete 64-node Menu archive. It also prefers figma-layout-* over figma-*,
because the latter may have been replaced by a qualified render export.
No checker/scorer or production conversion code changed in this diagnostic.

Live result: **252 pass / 84 fail / 24 unverified**, unchanged from the historical
MUI Button check; no variant changed verdict. Of 108 non-passes, 96 still carry
render-export-overlap-mismatch, with 72 also reporting content size. The remaining
12 fail image thresholds alone. Set problems remain text-prop-never-rendered and
children-slot-discarded. No new passes are credited.

This bounded experiment rules out a fresh-reader recovery for MUI Button.
Do not repeat it without a relevant change. Next prioritize the shared source
render-framing bottleneck (MUI 96 and fresh Switch 312) through independently
observed export origins, retaining every existing threshold. Carbon's 185-cell
paint permutation remains the largest current admission feature candidate.
Reverse remains 2203 independent cases unqualified; forward historical global
remains 2112/6312. Neither benchmark goal is complete.

Preflight checks passed: incomplete MUI cache refused, complete Menu cache
accepted, explicit layout/render routes return the intended bytes, and requests
to unrecorded hosts refuse. The fresh live MUI cache is retained for reuse.

Durable summaries and scripts: V1 private integration directory `priority-860`.
Complete live captures: `/private/tmp/forward860/live/check`.
