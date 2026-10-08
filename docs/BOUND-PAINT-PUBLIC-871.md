# Public Carbon conversion passes, iteration 871

The same two Carbon `_Accordion content skeleton` variants that failed the
ordinary public command in iteration 870 now both pass its clean-consumer check:
**2/2 PASS, 0% image difference on white and black, all six graphics present,
320 × 96 dimensions**. Source PNGs are byte-identical to the failing run. These
are known cases; they are not new held-out-kit evidence or a replacement global
scoreboard.

Three shared fixes close the observed failures:

- React emits bound paint as a real, independently positioned SVG rectangle.
  Its token fill and blend stay separate from foreground content; both React
  surfaces preserve the existing native-image comparisons and resizing behavior.
- CSS token emission preserves positive alpha below one 8-bit channel step
  using equivalent `color(srgb …)` syntax. Chromium's legacy `rgba()` parsing
  rounded the captured native alpha to zero, including on an SVG fill. Zero
  still remains zero; aliases and native token values remain unchanged.
- Blend paint bounds require exact equality of the original and promoted
  viewport rasters, plus a second exact comparison before and after neighboring
  paint is isolated. Paint outside the observed viewport, a changed backdrop,
  filters and other unsupported conditions remain named refusals. No image
  threshold, content matcher, source image or verdict rule was changed.

A negative capture test also exposed lazy CSSOM style synchronization leaving
an empty style attribute on an isolated neighbor. Cleanup now flushes that
synchronization and restores absence exactly; the rejection and restoration
checks pass together.

The ordinary command ran against the unmodified retained plugin dump, then
installed and built the generated package in a clean consumer and fetched fresh
read-only Figma observations. The final output is:

```sh
npm run figma:to-react -- --dump /private/tmp/forward864/carbon-skeleton-dump.json --out /private/tmp/forward871/public-final
```

Both final runs produced package hash prefix `1bacf7f8ca80`. The full hash,
request, generated code, installable archive, source captures, comparisons and
consumer receipt are retained in V1 private integration
`bound-paint-public-pass-871/public-final`. This is the contributor command's
public conversion path, not a fresh packed-CLI installation or a newly qualified
reverse journey.

Validation: 6 focused conversion/token tests, 23 capture tests and 7 bound-paint
renderer tests pass, alongside minting invariants, package build, typecheck,
targeted lint (existing warnings), plugin checks and lowering checks. The
native writer is unchanged. The plugin receipt and lowering citations are
refreshed. No push, source-kit write or release.

Next apply the same path to the remaining captured bound-paint cohort, measuring
complete public outcomes before another broad run. Varying bound paints,
referenced-instance ownership and the independently unqualified reverse cohort
remain open. Historical forward remains 2112/6312 (33.46%); reverse remains 2203
unqualified. No owner action is required.
