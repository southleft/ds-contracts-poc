# Explicit bound receiver inventory, iteration 866

The scoped native readback now collects the extra geometry and paint fields
required by a compiled bound receiver. Ordinary readback programs retain their
existing field lists. The component verifier recognizes exactly one receiver
at the expected paint-order edge, resolves its variable through the independently
verified token inventory and consuming mode, and applies the existing exact
receiver verifier before visiting the original content children.

This is explicit accounting, not an ignored helper-node rule. The layer must
have the reserved identity, expected parent, no descendants, exact geometry,
paint, binding and corners, inherited selected mode, no component property
references and no unrelated variable bindings. Existing operation ownership
and allocated-node inventory checks still run before it. Foreground children
retain their normal pairing, topology and semantic checks.

Validation: 60 inventory, prepared-library and source-observation tests pass;
typecheck and targeted lint pass. The full prepared-library verifier accepts a
synthetic explicitly allocated receiver and rejects changed width, redirected
binding or removed content. A separate adapter test replays all four actual
Carbon receiver observations and rejects ten corruptions. Generated reader
field coverage is checked independently. These are verifier tests, not a fresh
live scoped writer run or public component acceptance.

The public and scoped compiler guards remain closed. Next connect the emitted
layer to nativeOwn allocation in the scoped writer, include its token path in
native-contract-draft boundNames, and run the Carbon contract through scoped
creation and this inventory verifier. Only after that should the public contract
schema/proposer route be enabled with source alias/context checks intact.

Historical forward remains 2112/6312 (33.46%); reverse remains 2203 unqualified.
No new benchmark passes, no owner action. Durable evidence: V1 private
integration directory `bound-layer-inventory-866`.
