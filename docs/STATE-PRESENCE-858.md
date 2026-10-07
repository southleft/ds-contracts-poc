# Production state-presence integration, iteration 858

The public importer now retains the menu Supporting text presence exception.
`presenceByState` is a validated contract field with complete finite prop/state
rows. It cannot conflict with ordinary visibility, component references, slots,
repeats, or caller visibility. Inference uses exact base-node ownership and
unambiguous source paths; missing or conflicting evidence is not defaulted.

CSS-module React retains the node and hides inactive combinations. Actual hover
and forced previews work without extra layout wrappers or cascade layers.
Native default variants and state previews evaluate the same rows. States whose
only change is presence remain declared. Inline React, HTML and Web Components
explicitly refuse this field pending integration; they must not silently ignore
it. Native compilation was tested; live write/readback qualification remains.

The same-source 64-state public package replay remains **48 pass / 16 fail**,
with no pass losses and no set-level problems. The former missing-text variant
now renders both texts and meets image limits (1.6548% on white and black), but
fails text color: source `#737373`, generated `#525252`. Do not count it as a pass.
This exposes paint on a newly present state layer that the existing state-diff
pass did not pair with an absent resting layer. That paint carriage is next.

Validation: 30 focused tests including generated React in Chromium, native
preview structure, exact source inference, and existing finite presence tests;
typecheck; targeted lint (warnings, no errors); schema freshness and reference
coverage; plugin flows; lowering register. Schema regeneration also surfaced
previously undocumented arcByCombination branches; documented those existing
branches while adding the new presence field. Citation lines were refreshed
from unchanged source text, and the engine receipt regenerated. No push.

Evidence in the V1 checkout:
`private/beta-kits/slider-geometry-diagnosis-2026-10-01/paired-regression-integration/state-presence-858/`.
Historical global forward remains 2112/6312; independent reverse remains 2203
unqualified. No live source mutation or new Figma fetch was needed.
