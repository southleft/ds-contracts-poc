# Fractional bound receiver sizing, iteration 865

The emitted native writer now settles its own bound paint receivers after
component layout and before recording canvas fingerprints. Figma's absolute
STRETCH rectangles had rounded an 85.333328 px fill-sized host to 85 px.
An explicit resizeWithoutConstraints after layout retains the exact host size.
Only receivers created by this script beneath the stamped component are touched;
unrelated components and removed nodes are excluded.

Fresh compiler-generated Carbon set:
https://www.figma.com/design/NqssRZQpSjChxv5VyN1ZvJ?node-id=155-67017
All four receivers now pass the unchanged independent verifier, including both
85.33332824707031 px hosts. Their bindings, tiny native alpha, child order,
geometry, transforms, corners and separate blend ownership pass in a separate
read-only execution. Both complete variants still measure 0% image difference
on white and black against the retained fresh source exports. The first immediate
set screenshot was blank despite valid structure; a subsequent screenshot showed
both complete variants and fresh per-variant exports confirmed the pixel result.

An initial create-only call matched the earlier component by contract ID and
correctly refused amendment. The successful comparison uses a distinct internal
qualification ID. One old comparison receiver (155:66982) was explicitly resized
as the diagnostic; source Carbon was never changed. Both comparison sets remain.

Ten focused tests pass, including fractional resizing limited to the correct
subtree, the four actual live receipts, the full Carbon React comparison and
the existing readback corruption checks. Typecheck, targeted lint, plugin check
and lowering check pass. The engine receipt was refreshed. No push or release.

This removes the exact receiver geometry barrier; public binding acceptance is
still closed. Next connect uniform bound paint to the public contract validation
and scoped native inventory. In particular, native-source-observation currently
requires observed child count to equal spec.children; the generated receiver
needs explicit identity and paint verification there, not a general ignore rule.
Keep source alias/context validation and named refusals for unimplemented cases.

Historical forward remains 2112/6312 (33.46%); independent reverse remains 2203
unqualified. No new public benchmark credit. No owner action required.
Durable evidence: V1 private integration directory `bound-layer-fractional-865`.
