# CBDS Badge: an independent designer-authored family, first run

Read-only REST import of the `Badge` set (72 variants) from the CBDS UI Kit Demo
file, proposed, generated and checked with `npm run design:consumer:check` on
2026-09-18. No code was written for this set;
this note only explains what was seen in that first run. The current receipt
was remeasured on 2026-09-19 with whole-pixel consumer origins: 46 of 72 pass
on white, with the remaining small variants above the same 5% limit. It
predates the new contrasting-background check and is not a current qualification.
The first-run receipt and captures remain in Git history and the private
PR131 integration archive.

**Result: installs, mounts and behaves; 0 of 72 variants pass the unchanged 5 % image limit (10.2–52.1 %).**
Text replacement and all four variant axes (`type`, `style`, `size`, and the
boolean axis `rounded`) change the rendered component as expected.

Causes, each general rather than specific to this set:

1. **The check itself mounted boolean variant axes wrongly** (fixed in the same
   change). `rounded=false` was passed as the string `"false"`, which is truthy,
   so every variant rendered as a pill. The first run's 12–42 % included that
   instrument error; the receipt here is from the corrected check.
2. **No font family reaches a clean consumer when the design uses Inter.** The
   proposer omits Inter as "the pipeline's own default" (door
   `propose.font-family-inter-is-default`), but the React emitter declares no
   default family, so the consumer renders the browser's serif fallback.
   Diagnostic only, not evidence: with `font-family: Inter` added by hand to a
   scratch copy of the generated CSS, 18 of 72 pass (fill and tonal, 1.9–8.3 %
   at the large size).
3. **A Figma stroke takes no layout space; the emitted CSS border does.** The
   outline variants render 4 px wider, and the 16 px-high small outline variant
   renders 20 px high (8 + 8 px padding plus a 2 px border cannot fit a 16 px
   border box). Neither reader captures `strokesIncludedInLayout`, so the
   proposer cannot lower it. Outline variants score 9.2–51.5 % even with the font.
4. Undeclared React `children` are accepted and discarded (the type-level refusal
   is a separate pending change).
5. The Figma token lacks `file_variables:read`, so all 1,320 variable bindings
   arrive as resolved literals (named in the dump).

Also measured on the way (nothing committed for them): the real child sets that
would replace auto-proposed stubs refuse as sparse variant matrices
(`EXACT_MATRIX_RAGGED`): CBDS `Checkbox-icon` has 42 of 48 rows and Altitude
`Menu Item` 16 of 18, as CBDS `Alert` (30 of 40) did in the designer exam. A
composed designer family therefore cannot yet be imported with its real children.
