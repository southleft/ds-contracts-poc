# Native Material capture: token names and the next refusal

The unmodified canonical Desktop Bridge capture of Material 3 Assistive chip
contains 48 variants and four ordinary dependencies. Nine of its thirteen
captured variable names contain whitespace. The public importer previously
refused the label's `Static/Label Large/Size` token reference before generation.

The shared registration/proposal path rule now maps each whitespace character
to a hyphen, preserving case, slash grouping, and the original canvas name.
For example, `Static/Label Large/Size` registers and binds through
`Static.Label-Large.Size`. Proposal notes receipt this token-path rename.
Distinct source names that fold to the same path refuse regardless of input
order or equal values. No captured data or Figma document was edited.

The retry through the ordinary public `scripts/figma-to-react.ts --dump` command,
with the existing 27-face authenticated font manifest, gets past the token
reference refusal but still exits 1 before scoring:

`react-mask-composition-unqualified:mask:ALPHA:sibling-plane-unqualified:favicon`

The actual Favicon proposal has an 18×18 ellipse alpha mask, followed by a
20×20 free GROUP positioned at −1,−1. Its rectangle children have their local
absolute geometry, but the GROUP has no qualified absolute-geometry carrier.
The emitter correctly refuses to reparent this group into a mask scope.

Independent read-only Desktop Bridge inspection confirms the source GROUP has
no native constraints property. Its relative transform is a translation by
−1,−1; its rectangle children's native translations are −1,−1 and 3,2, while
the dump carries group-local offsets 0,0 and 4,3. A future group-plane carrier
must preserve this origin relationship without inventing resize constraints.
The bitmap rectangle also has a visible IMAGE fill with CROP mode and an image
transform, whereas the current dump only carries `imageFill: true`. The image
bytes and crop transform must be captured by a general reader path before this
component can be visually qualified. Do not patch this input or bypass the mask
refusal to move the score.

Evidence in `/private/tmp`:

- `ds-contracts-material-canonical-desktop-bridge-2026-10-03/dump.json`
- `ds-contracts-material-native-variable-fixed-2026-10-03.log`
- `ds-contracts-native-material-mask-diagnosis-2026-10-03.json`
- `ds-contracts-native-material-group-facts-2026-10-03.json`
- `ds-contracts-native-variable-proposal-gate-2026-10-03.log`

The proposal gate passed 435 tests. The focused four-test mapping suite exercises
actual registration and proposal, collisions in both orders, direct proposals
without a variable table, and unchanged legal/U+2024 paths. These checks do not
establish a new visual pass. Fixed40 remains 506/879 (57.6%); the last complete
full204 remains 1515/6312 (24.0%). Real-library reverse and never-seen qualification
remain outstanding.

The final plugin gate exposed and repaired two additional integration defects:
two stale reader-version assertions still expected 1.48 instead of canonical
1.55, and the production read-only facade blocked the reader's temporary
`skipInvisibleInstanceChildren` boolean. The facade now permits only that root
API runtime boolean; node properties, other global settings, define/delete,
and nonboolean values remain refused. The plugin gate tests restoration from
both initial boolean values after successful capture and a missing-scope error,
as well as the document-write refusals, and finishes with all flows green.

After the owner's Figma restart, a live connection probe succeeded. Executing
the actual canonical reader through the repaired production facade in Material
captured the same five source sets and thirteen variables and restored the
runtime flag from false to false. The live result is preserved in
`/private/tmp/ds-contracts-material-guarded-capture-2026-10-03.json`. This verifies
the reader/guard integration; it is not visual qualification or reverse credit.
