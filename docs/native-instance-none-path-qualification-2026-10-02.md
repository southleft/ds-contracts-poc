# Native instance path qualification

A keyed single-vector usage previously refused every native `NONE` winding rule,
even when its contour met the same closed-convex qualification already enforced
by the schema and direct-vector reader. The canonical native observer now uses
that existing `filledPathsIssue` guard. It retains original path bytes and `NONE`
for exact native creation and readback. The grammar is 1.52, and the plugin's
embedded reader matches the canonical source.

Curves, crossings, concave contours, non-float32 coordinates, multiple NONE
contours, extra children, unknown source identity and unsupported wrapper paint
remain refusals. No winding rule is inferred or substituted. REST does not gain
an invented NONE rule: its source geometry still accepts only the actual REST
NONZERO and EVENODD rules.

Wrapper paint refusals now name `native-instance-wrapper-paint-unqualified`;
path refusals name the existing path qualification reason. These are diagnostic
facts, not permission to erase paint. Exact-zero white MULTIPLY wrappers remain
the only admitted case of that wrapper paint. Positive alpha, including a tiny
positive value, remains visible paint on transparent backing.

The CI-invoked observed-vector tests run the canonical observer and complete
native dump through a keyed instance. They reuse the live Scratch rectangle
control at 399:3, retain its NONE path and source identity, and reject unsupported
geometry and positive wrapper paint. The complete proposal regression gate
passes 359/359 tests after synchronizing the shared grammar constant.

An offline diagnostic on the unchanged twenty actual native instance drawings
in `extract/figma/rest/native-instance-source.fixture.json` identifies wrapper
paint as the refusal in all twenty. None is qualified by this correction. A new
full Carbon capture solely for NONE support would not recover those drawings.
The next representation work must carry per-paint composition through the
schema, consumers, Figma writer and readback before another expensive capture.
No kit, never-seen, reverse or global scoreboard gain is claimed here.
