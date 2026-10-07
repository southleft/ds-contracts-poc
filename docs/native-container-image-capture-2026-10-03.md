# Native GROUP origins and IMAGE crop facts

Canonical plugin dump 1.56 adds raw `nativeContainerPlane` records for GROUPs
and their immediate children, and `imagePaints` records for visible IMAGE fills.
The production Send-tab reader is re-embedded byte-for-byte and the engine
receipt is refreshed. No kit-specific name or node ID appears in these rules.

The source of the geometry rule is Figma's published API: a GROUP fits its
children and has no independent constraints property; setting group constraints
means setting its children. Relative transforms skip GROUP and boolean-operation
parents and use the containing frame's origin. See [GroupNode](https://developers.figma.com/docs/plugins/api/GroupNode/)
and [relativeTransform](https://developers.figma.com/docs/plugins/api/properties/nodes-relativetransform/).

A record preserves the node, direct-parent and containing-frame identities,
native dimensions, relative/absolute transforms, containing-frame absolute
transform and actual constraints when present. It does not turn the group into
a frame, infer constraints, normalize a skew, or change the existing drawn box.
A missing container or excessive group nesting remains a named unqualified fact.

IMAGE records preserve the original visible paint-stack index, image hash,
scale mode, image transform, rotation, scaling factor, opacity, blend mode and
filters when supplied by the native API. Unknown values remain unknown. The old
CROP boolean marker stays a boolean; it does not become a cover image. These
records do not contain bitmap bytes and are not a qualified CSS projection.

The new canonical reader ran through the production read-only facade in the
owner's connected Material file after the Figma restart. Its ordinary scope was
Assistive chip plus dependency closure. It captured 48 Assistive variants and
four dependencies, adding 25 container-plane records and one IMAGE paint. The
runtime traversal boolean was restored from false to false. Removing only the
two new fields produces byte-equivalent JSON values for all five original
source sets; all thirteen original variable records are also unchanged.

For the Favicon, the native GROUP is 20×20 at −1,−1 in an 18×18 component.
Its bitmap rectangle is 12×14 with a containing-frame translation of 3,2,
while the older group-local shape has offsets 4,3. The captured CROP transform
is [[0.9086781740188599,0,0.05408589914441109],
[0,0.5833333730697632,0.20477767288684845]], with the native image hash and filters.
These facts match the earlier independent read; the canonical dump now retains
them instead of requiring a separate diagnostic witness.

Evidence:

- `/private/tmp/ds-contracts-material-native-facts-capture-2026-10-03.json`
- `/private/tmp/ds-contracts-material-native-facts-dump-2026-10-03.json`
- `/private/tmp/ds-contracts-material-native-facts-reader-2026-10-03.js`
- `/private/tmp/ds-contracts-material-native-facts-method-2026-10-03.json`

Three regression tests exercise raw containing-frame origins, nested groups,
missing/skewed evidence, detached transform arrays, paint-stack indices,
CROP/TILE/unknown scale modes and actual canonical-reader emission. Native live
capture independently verifies the real API behavior beyond the mocked fixture.

Next, qualify the projection of these observed group children into the actual
containing-frame plane, with independent native resize evidence, and carry the
image bytes and crop into generated React. A full-parent synthetic grouping
wrapper must be identified as a target coordinate owner rather than described
as the GROUP's native constraints. Do not modify the source dump to bypass the
mask guard. There is no visual score credit for this raw-fact capture change.
