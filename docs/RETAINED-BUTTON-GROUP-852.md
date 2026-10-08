# Retained-source triage, iteration 852

At head e4aefdbe4, replayed current public request 151 from census 847 against
the retained shadcn Button Group Icon Button - Nova source with the unchanged
current checker. Result: **155 pass, 37 fail, 0 unverified / 192 variants**.
The historical archive recorded 0 pass / 192 fail. All 192 source layout PNGs
are byte-identical. This is evidence of accumulated implementation progress,
not a new conversion fix in this iteration or an unseen-kit result.

The component set remains failed: 37 image failures plus
`variant-prop-discarded:position`. No missing parts or size/capture failures
remain. 24 image failures are Focus, five Default, four Disabled, four Hover.
The position probe has 32 unchanged transitions without qualified source
equivalence. The source dump explicitly omitted nonuniform corner radii, and
its focus shadow lacks spread. Inspect fresh representative source facts before
changing the generator or undertaking another full run.

Switch triage: all 136 unchanged colorPalette transitions have byte-identical
source layout AND render PNGs against their gray target. All are unchecked.
Thus the finding does not establish a palette conversion defect. Source frame
qualification still prevents the existing equivalence check from excusing them;
no checker relaxation was made.

This iteration used retained files, generated and installed a fresh consumer,
and completed one offline component check. No Figma requests or source writes.
Historical mixed global forward remains 2112/6312; independent reverse remains
2203 unqualified. Do not mix this narrower replay into a current global score.

Evidence in the V1 checkout:
`private/beta-kits/slider-geometry-diagnosis-2026-10-01/paired-regression-integration/retained-button-group-852/`.
Review: http://127.0.0.1:18771/retained852.html.

Next bounded action: refresh the source facts for one failing focus variant and
one position pair, specifically corner radii and shadow spread. Preserve the
remaining 37 failures until a measured implementation repair earns passes.
