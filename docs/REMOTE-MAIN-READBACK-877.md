# Remote main capture capability, 2026-10-06

Before adding paint-order vocabulary for 185 Carbon variants, attempted unchanged
canonical dependency captures for Accordion item (120) and Tile (65). Both refuse
remote icon dependencies. Menu (28) already refused the same way. Fixing paint
order alone cannot produce qualified public packages for these families.

Fresh read-only plugin inspection of the exact instances named by those refusals
proved that getMainComponentAsync returns readable remote mains, not null stubs:

| Instance | Main | Component key |
| --- | --- | --- |
| 11520:384457 Chevron--down | 41080:384349 | 848106828bf439b0d335c8055b24882db1c671c6 |
| 21427:279704 Arrow--right | 41080:384325 | 24c602bcac523b437c8ba89548891bd9fcafdc62 |
| 36234:38349 Checkmark | 41080:384385 | e1885db60b7f415a03f9e935936bc6d8fb2183ba |

All three report remote:true, parent:null, no variant properties, empty component
property definitions, and one readable VECTOR child. The plugin exported a native
PNG for each; snapshot trees include exact vector geometry. The Checkmark PNG was
visually inspected. Nothing was created or modified in the Carbon source file.
REST GET /v1/components/:key returned 403 for each; original-library file/node
identity and editing access were not established. The installed Python TLS trust
store initially failed; Node fetch with normal certificate verification completed
those requests. No credentials or TLS bypass were used in evidence.

Implementation direction supported by this evidence: distinguish a readable remote
main snapshot from a locally editable main. Preserve stable component key, consuming
file identity, captured node identity, remote status, complete observed tree and
native image evidence. Capture only the actual readable definition; never invent
unseen remote variants, claim original-library ownership, or use geometry stubs.
The canonical reader currently refuses all remote mains, even these readable ones.
An explicit provenance model and regression tests must precede public support;
this diagnostic is not permission to delete the remote guard wholesale.

The existing paint-order vocabulary also remains insufficient: Accordion reverses
arrow/title while absolute decorations stay at the end. Tile has additional order
permutations among decorations. Current reversePaint alone cannot encode arbitrary
source order independently of flow. Do not discard hidden editable nodes or suppress
paint-order qualification.

No new package, visual pass, reverse qualification or model-speed claim. Historical
aggregate forward remains 2112/6312 (33.46%); reverse 2203 cases remain unqualified.
Durable raw results, compact trees, PNGs and hashes are in the V1 checkout under
private/beta-kits/slider-geometry-diagnosis-2026-10-01/paired-regression-integration/remote-main-readback-877/.
