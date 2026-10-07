# State-dependent presence: scope and implementation boundary

Iteration 855 investigated the fresh menu counterexample from iteration 854.
No converter fix or additional scoreboard pass is claimed.

At identical Type=Avatar leading, Supporting text=False, Check=True props,
Default, Focus, and Disabled omit Supporting text; Hover node 1096:7588 includes
visible text node 1096:7592. The current proposer partitions state variants
before building base anatomy (`core/propose-figma.ts`, state promotion around
line 15300), so base `visibleWhen: supportingText` controls React mounting.
Per-state color styling cannot restore a node the React emitter did not mount.

The existing finite presence table accepts props, not interaction states.
Simply retaining a State enum would preserve snapshots but remove the existing
real hover behavior; making Supporting text always visible would change other
states. Neither is the intended repair.

A read-only census grouped equal non-state props and compared visible named
child paths against the rest state. 28 captured sets have differences. This is
a screening count, not 28 proven defects: names, instance structure, and states
outside the promotion vocabulary also cause differences. The fresh menu has
exactly one observed transition adding Supporting text. The scanner retains
underscore-prefixed component names; only matching node identity selects sets.

Implementation boundary for the next step:
- Represent presence over explicit interaction state plus declared prop tuples,
  with a complete observed rest/state domain and no inferred unseen tuples.
- Preserve all existing normal prop visibility behavior when no exception exists.
- React must retain real pseudo-state behavior and forced state previews. Nodes
  needed in another state must remain mountable; hidden states must remove their
  layout contribution and accessible content.
- Figma generation must evaluate the same observed state/prop truth for every
  generated state preview; readback must reject presence corruption.
- Refuse unsupported emitters explicitly, and test ordinary hover styling,
  absent-rest/present-hover, present-rest/absent-hover, disabled state, independent
  Boolean bindings, and incomplete/conflicting observations.
- Replay all 64 fresh menu variants against retained same-source evidence; a
  single recovered text must not cost any of the existing 48 passes.

Evidence in the V1 checkout:
`private/beta-kits/slider-geometry-diagnosis-2026-10-01/paired-regression-integration/state-presence-855/`.
Global historical forward remains 2112/6312 and independent reverse remains
2203 unqualified. The menu remains 48/64. No live source mutation or network run
was needed for this investigation.

## Iteration 856: isolated planning primitive

`core/state-presence.ts` now supplies exact finite-domain validation, row
selection for a prop tuple, and prototype CSS for interaction-state presence.
The browser tests exercise actual hover as well as forced previews, disabled
precedence, absent-at-rest/present-on-hover, and the inverse transition with
zero layout contribution when hidden. Missing and conflicting observations
refuse. Four focused tests, typecheck, and targeted lint pass.

This primitive is deliberately not exposed through the contract schema yet.
No production import or emitter consumes it, and no new menu pass is claimed.
Its CSS prototype requires the base and presence rules in ordered cascade
layers for `revert-layer` to restore the original display mode. Production
integration must resolve that requirement without changing unrelated generated
CSS precedence; the current emitters use unlayered styles. Do not simply append
these rules to the existing output and assume they work.

Next required work remains schema validation plus source-observation inference,
production React CSS/mounting integration, native state-preview evaluation,
independent readback checks, and the retained 64-state menu replay. Scores stay
48/64 locally, 2112/6312 historically forward, and 2203 reverse unqualified.

## Iteration 857: source inference and unlayered CSS

Replaced the prototype's revert-layer/ordered-layer requirement with mutually
exclusive hide-only rules. Visible branches emit no display override, preserving
the existing unlayered component CSS. Disabled outranks forced previews; forced
previews exclude actual pseudo-state branches. Browser tests cover both presence
directions and an existing important display declaration.

Added complete-domain observation inference and a strict Zod plan boundary in
`core/state-presence-schema.ts`. The boundary consumes independently supplied
prop domains; it refuses incomplete/duplicate rows, unknown states and fields,
and string/boolean coercion. It is not yet a field of the public ContractSchema.

The fresh 64-state menu dump was processed directly: all 64 rows retained,
33 visible and 31 absent, with exactly one visible Supporting text=False row
(Avatar leading, Check=True, Hover). Evidence: V1 private integration directory
`state-presence-857/`. Six focused tests, targeted lint, and typecheck pass.

No production emitter or public importer yet consumes the plan. The menu remains
48/64. The next change must add the public contract field together with consumer
handling (or explicit refusal for unsupported emitters), remove the obsolete
base-only visibleWhen for affected parts, and wire native state resolution.
Do not claim the missing-text regression fixed until its generated artifact is
checked against the retained source. No live network or source writes this turn.
