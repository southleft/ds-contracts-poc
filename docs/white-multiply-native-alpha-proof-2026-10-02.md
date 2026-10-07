# White MULTIPLY is not transparent identity

Native Scratch file byMp6lt0Ij9b2QbkDGFwBh, page 0:1, frame 402:2 contains four 20 by 20 wrappers with the same centered 8 by 8 gray child. Empty fill (402:3) and white MULTIPLY at zero opacity (402:5) export byte-identical PNGs. At opacity 0.5 (402:7) and 1 (402:9), 336 of 400 RGBA pixels differ. Corner alpha is respectively 128 and 255; the baseline is transparent. Compositing on white hides the difference, but black reveals all 336 changed pixels.

The previous RGB identity equation omitted alpha composition. Both REST and canonical native observers now refuse positive-alpha white MULTIPLY wrapper paints rather than discarding them. Exact zero opacity or color alpha remains admissible; no epsilon is used. Tiny positive opacity remains refused even if PNG quantization happens to hide it. Source facts are unchanged. An opaque-parent proof or carrying the wrapper paint would require a separate implementation.

The raw native readback, PNG bytes, hashes, and comparisons are in extract/figma/rest/white-multiply-native. This is diagnostic evidence only: no kit qualification, scoreboard gain, or reverse admission. The earlier 201-check green receipt belongs to the previous head and does not validate this change. Frozen scorers and shipping workspaces are untouched.
