# Inherited bound paint: public Carbon structured list, 2026-10-06

The canonical read-only plugin capture now includes the requested Structured
list row item (8 variants), its cell base (4), and Resizer (1). The ordinary
public command previously refused this closure. It now produces a three-component
package and records **4 PASS / 4 FAIL** with IBM Plex Sans provisioned through the
existing `--fonts` option. These are known-kit results, not fresh held-out credit.

Changes:
- A bound instance paint inherits from its resolved main only when captured
  component/file identity, uniform paint, and the complete selected variable graph
  match exactly. Explicit fill overrides, unknown mains, and equal-looking colors
  bound to another variable remain refused. The child retains the variable binding;
  no duplicate literal paint layer replaces it.
- Width/height-only instance root inputs can receive foreground positioning over
  their parent's independent paint. Paint and authored-position restrictions remain.
- Editor/public-import CSS validation now receives the resolved contract scope,
  just as contract validation and the actual React emitter already do.

The four enabled rows pass: white image differences 0.64–1.10%, black 0.03–0.05%,
all five texts present with correct styles, no missing graphics or size failures.
All four disabled rows fail the unchanged text-color comparison: source #16161640,
rendered #525252. The read-only dump contains the exact textFillTarget and consumer
value under each disabled instance's hostOverrides; the next task is to carry that
through the child text-color override path. Do not treat sub-5% image differences
as permission to ignore text color. Passing and failing triptychs were inspected.

Package SHA256: 908c73cf0050ac2aab1af4994263a8c569b8cb1a53fe0921d64d1fdc6bcda1cd.
The same package hash was produced with and without explicit font provisioning.
Seventeen focused tests passed; schema/core build, typecheck, targeted lint
(existing warnings), plugin check, and lowering check passed. No full CI/push,
packed-CLI cold install, or new reverse qualification is claimed.

Evidence is in the V1 checkout under
private/beta-kits/slider-geometry-diagnosis-2026-10-01/paired-regression-integration/inherited-bound-fill-874/.
Historical full forward remains 2112/6312 (33.46%); reverse 2203 independent cases
remain unqualified. This targeted result does not update either aggregate.
