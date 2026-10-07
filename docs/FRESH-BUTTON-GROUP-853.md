# Fresh Button Group source, iteration 853

**191 pass / 1 fail / 0 unverified, no set-level problems**, using the public
Figma-to-React path and unchanged current consumer checker. This is 99.48% on
one previously seen 192-variant set, not an unseen-kit or bidirectional result.

Previous current-generation replay on the old dump: 155/192. Fresh capture
recovers nonuniform corner radii on 128 variants and layered stroke colors on
24 Outline focus variants. The importer already implemented both. A targeted
REST read verified the Left/Top radii and two focus stroke paints; it disproved
the suspected missing shadow spread (Figma supplies none).

All 192 freshly fetched source PNGs are byte-identical to the historical
archive. The gain is better source fact capture, not changed source pixels.
The fresh dump also adds empty fill/stroke and main-size evidence; no attribution
of all gains to one field is claimed. No conversion code changed in this turn.
All former position semantic findings, missing content, size, and framing
findings are absent from the fresh receipt.

Remaining failure: `variant-outline_size-extraSmall_position-single`:
white 0.2066%, black 5.1653%. Preserve the 5% limit and failing verdict.
The set remains failed overall because that variant is red.

Efficiency lesson: old captured dumps can omit facts the current reader now
supports. Before fixing a ranked historical defect, inspect a representative
source and refresh its input. Here that recovered 36 passes without another
converter patch. It does not remove the need for unseen-kit testing.

One read-only targeted REST request, one fresh public import, and one component
check completed. No source edits. No full-network benchmark rerun.

Evidence in the V1 checkout:
`private/beta-kits/slider-geometry-diagnosis-2026-10-01/paired-regression-integration/fresh-button-group-853/`.
Review: http://127.0.0.1:18771/fresh853.html.

Global mixed historical forward stays 2112/6312 (33.46%). Independent reverse
remains 2203 unqualified states. Do not sum overlapping component replays into
a fabricated current global scoreboard.

Next: prioritize representative fresh-input checks for other large historical
failure groups with available fonts; use them to select shared conversion
fixes. Keep the one remaining Button Group variant as a pinned regression.
