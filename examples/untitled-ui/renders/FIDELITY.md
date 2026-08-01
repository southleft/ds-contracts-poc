# Canvas→code fidelity — 2026-08-01 @ HEAD

Score = % of pixels REPRODUCED, measured at the reference's own true scale with the two ROOT BOXES anchored. v2.1 stops content-trimming and stops rescaling each image into a common 200px box — the two blindnesses that cost round 5 and round 6 a measurement each: a pure TRANSLATION scored 0.00 change (the trim discards absolute position) and DELETING a wrong full-bleed gray ground LOWERED six rows (#efefef vs #ffffff is 16 per channel, inside v2.0's 90-summed-channel tolerance, so the wrong paint counted as a match AND inflated the trim box, whose loss the 200px normalization then magnified ~4x). v2.1 instead: (1) TRUE SCALE — the canvas export scale is not recorded, so it is derived as s = min(2, 600 / drawn bbox width) and verified over all 595 references that have a dump variant: no reference comes out SMALLER than the box it draws (Figma never trims a node's own box, so a negative would falsify the rule) and every residual is explainable (0 plain, 4/8px focus rings, 24px tooltip shadow, 56–70px floating value tooltips). The reference is resampled to (w/s, h/s); the render is used at 1:1. Nothing is normalized to a common size, so wrong SIZE now scores wrong. (2) ROOT ANCHOR — render-one reports the rendered root's border box on stdout (PNG bytes untouched); inside the reference the root's origin is the export's overflow split in the direction the render's own ink overflows its root box (even split when it does not), so a symmetric ring centres and a one-sided floating tooltip does not. Absolute position is measured. (3) TOLERANCE — a reference pixel is reproduced when some pixel in its 3x3 neighbourhood of the render is within 10 PER CHANNEL (v2.0: 90 summed across three, i.e. up to 30/channel); the 3x3 escape is what makes the tight threshold usable — it forgives Figma-vs-Chrome rasterisation jitter up to one pixel and nothing larger. DELIBERATELY IGNORED: sub-pixel and 1px placement (the 3x3 escape); the component's position on the page (only its root box is anchored — a uniform translation of the whole drawing is not a property of a standalone render); and effect ink beyond the render clip's 8px margin (worst case measured: tooltip, canvas shadow reaches 12px/side, so 4px of it is missing from the render and scores as missing — named, not fixed, because changing the clip would change the committed render bytes and make this metric change unattributable). MEASURED FLOOR — read the numbers with it: at true scale Figma's and Chrome's glyph rasterisation differ by more than the one-pixel escape on nearly every stem, so a frame that is ONLY text tops out near 70 (dropdown-list-item icon_false_checkbox_false_shortcut_false_state_default scores 70.45 with the two drawings indistinguishable by eye — its whole frame is one "List item" run). A text-dominated row is that floor plus its defects, and a fix measured on such a row reads COMPRESSED. The v2.0 table over the SAME renders is FIDELITY-v20.md: both are produced by one run, so the shift between them is the metric and nothing else. v1.2: unknown axes consumed generically; axis-not-carried counts variants unrenderable because the inversion dropped their axis (genuine carriage losses only); state=disabled scores through the contract's disabled boolean; state=hover|focus variants are interaction-state (CSS-rendered, not statically scorable). Trend metric, not the final gate.

| component | variants scored | mean fidelity % | axis-not-carried | interaction-state | unscored |
|---|---|---|---|---|---|
| badge-base | 8 | 91.3 | 0 | 0 | 0 |
| button-base | 20 | 92.0 | 0 | 0 | 0 |
| toggle-base | 16 | 98.0 | 0 | 16 | 0 |
| dropdown-list-item | 12 | 87.3 | 0 | 12 | 0 |
| input-field-base | 10 | 91.6 | 0 | 0 | 0 |
| avatar-group | 12 | 84.3 | 0 | 0 | 0 |
| tooltip | 28 | 81.2 | 0 | 0 | 0 |
| slider | 40 | 87.5 | 0 | 0 | 0 |
| progress-bar | 55 | 91.1 | 0 | 0 | 0 |
| progress-circle | 16 | 85.8 | 4 | 0 | 0 |
| avatar | 162 | 94.8 | 0 | 0 | 0 |
| avatar-label-group | 12 | 91.5 | 0 | 24 | 0 |
| avatar-add-button | 6 | 96.7 | 0 | 6 | 0 |
| button-group-base | 32 | 92.2 | 0 | 0 | 0 |
| social-button | 108 | 88.5 | 0 | 0 | 0 |
| **ALL** | 537 | **90.9** | | | |
