# Bound paint compiler integration, iteration 863

The complete draft component writer now carries a qualified uniform token-backed
paint receiver on owned root and nested frames. The compiler checks the observed
source token graph, including alias identity, and exact resolved native paint.
The native writer refuses a selected value mismatch before creating a layer or
clearing host fills. Ordinary public compilation and scoped native-source writing
remain closed for these internal fields; this is not public component acceptance.

The compiler-generated Live Testing component 155:66954 contains foreground
155:66955 and paint receiver 155:66956, bound to VariableID:155:66952.
Independent readback verifies the full 40-by-40 receiver, reversed stacking,
MULTIPLY node blend, NORMAL fill, variable alpha 0.5 and node opacity 1.
The retained screenshot was visually inspected. This proves the emitted writer
can recreate this receiver, not a whole imported component or an alias graph.

Validation: 41 focused composition, token, compiler and readback tests passed;
typecheck, targeted lint, plugin check and lowering check passed. A subsequent
targeted runtime test also verifies that wrong selected alpha leaves host fills
and children unchanged. The plugin engine receipt was refreshed; lowering
citations moved without changing rule text. No push or release performed.

## Real component checkpoint

The canonical plugin reader captured Carbon `_Accordion content skeleton`
(5734:286365, two variants) read-only with complete variable consumers and zero
reported degradations. The internal proposal refuses before compiler execution:
`solid-fill-composition-structural-part-required:root/contentLine4/Spacer`.
The spacer is a rectangular vector with tiny-alpha variable-bound MULTIPLY paint,
so frame-only composition support cannot unblock this actual source component.
The source remains unchanged; no guard was bypassed and no pass is credited.

Next implement geometry-preserving bound composition for this vector owner,
then run this same captured component through both complete conversion paths.
Do not repeat the broad census or create more isolated frame examples first.
Public schema, alias/native inventory and variable-dependent combinations still
need completion before the broader bound-paint route can be accepted.

Historical forward remains 2112/6312 (33.46%); independent reverse remains 2203
unqualified. The 80% never-seen-kit goal in both directions remains active.
No owner action is required. Durable evidence is in the V1 private integration
directory `bound-layer-compiler-863`, including source capture and refusal.
