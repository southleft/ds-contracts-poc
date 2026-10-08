# Bound paint receiver readback, iteration 862

The existing native bound-fill writer now has an independent read-only
observation and verifier (`core/solid-fill-layer-observation.ts`). It observes
the actual host, layer and selected variable in a separate Figma execution.

A live run of BOUND_SOLID_FILL_LAYER_NATIVE_RUNTIME in Live Testing created four
receivers: NONE, HORIZONTAL, VERTICAL and reversed HORIZONTAL. Separate readback
passed all four, including alpha 0.000009999999747378752. The screenshot shows
three blue translucent layers and one nearly transparent layer, each with a
separate unblended red foreground. The layer has the exact variable binding,
NORMAL fill blending, node MULTIPLY, opacity 1, stretch constraints, matching
corners, and no extra strokes/effects/mask or transform. Host fills are empty;
the layer stays behind the expected foreground children in either paint order.

Live section: https://www.figma.com/design/NqssRZQpSjChxv5VyN1ZvJ?node-id=155-66930
The first construction attempt rejected an invalid reverse-stack assignment on
a NONE-layout host. Its identified partial section and collection were removed
before corrected creation; the four retained receivers are the only new artifacts.

Tests replay the actual live observations and refuse 26 independent corruptions,
including lost/redirected binding, changed selected alpha, doubled node alpha,
wrong blend mode, extra ink, misplaced/resized layer, lost foreground, wrong
stacking and masks/transforms. A separate emitted-reader test resolves the
requested nodes and variable and refuses a different file.

Scope: this verifies a native paint receiver, not a whole component, alias graph,
public import or unseen-kit success. No production acceptance guard was removed.
Next wire this receiver and its readback into the existing token-context compiler
and public bound-fill path, retaining token alias and selected-mode evidence.
The public schema and compiler still intentionally refuse unfinished bindings.

Forward historical scoreboard remains 2112/6312; independent reverse remains
2203 unqualified. No new component passes. Durable evidence is under the V1
private integration directory bound-layer-readback-862; the regression fixture
is core/fixtures/bound-fill-layer-readback/SOURCE.json.
