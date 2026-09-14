# Fresh held-out screenshot measurement

Read-only live Scratch exports were compared with fresh Playwright CLI captures
of the pinned original React packages. The original captures were independently
repeated and byte-compared. The manifest records library versions, browser
configuration, source revision, node IDs, timestamps, image hashes, and scores.

Run `node --import tsx --test recipe/live-fidelity-check.test.ts` to re-derive
all measurements offline, including coverage against the existing held-out
subjects. It also proves planted metric, hash, and missing-state edits fail.
This check is included in `npm run recipe:fidelity:check`.

All measured states pass the existing five-percent threshold. This does not
mean pixel identity: see exact/unmasked metrics, ink bounds, and the named
limitations in the manifest. Calendar retains its size/chevron residual;
switches retain some antialias fringes. One unchecked-disabled Checkbox source
capture differs from its older committed reference at eight corner pixels;
the two fresh captures agree. The older reference has not been overwritten.

These are dated snapshot measurements, not a claim about future live-file
freshness. They do not grade the product, assign owner signoff, or establish
canvas→code fidelity. The reverse-direction Badge defects are tracked separately
in `parity/receipts/v1/VISUAL-HILLCLIMB.md`.
