# Carbon structured list: 8/8 public visual passes, 2026-10-06

The unchanged public converter now passes all eight variants in the canonical
Carbon Structured list row item closure. At checkpoint 874 the same closure and
font assets passed 4/8; disabled rows failed text color. The four disabled rows
now report 0.00% white and black image difference, correct text color and font,
and all five texts present. Enabled rows retain their previous passes (white
0.64–1.10%, black 0.03–0.05%). This is a known-kit improvement, not a new held-out
score or a bidirectional qualification.

The existing owned-text override path accepted literal hex only. It silently
ignored a variable-backed host override even though the canonical reader
captured its numeric child target and consuming color context. The new shared
resolver accepts one unambiguous matching consumer, validates its selected
value/alias chain and alpha, then uses the existing finite hex color input.
Demand discovery and parent argument generation use the same resolver.
Conflicting hex, absent/ambiguous consumers, stale alpha and broken aliases
refuse. Unoverridden enabled rows continue using the child's original color.

Fidelity limit: this carries selected-context appearance as a finite color
input, with the limitation named in proposal notes. It does not recreate an
editable variable binding for the text override. The original captured graph
remains in the source fixture/evidence. No reverse binding pass is claimed;
that remains required work beyond the visual result.

Command: npm run figma:to-react -- --dump /private/tmp/forward874/structured-closure.json --fonts /private/tmp/forward874/fonts.json --out /private/tmp/forward875/public
Package SHA256: c6884adf1c5684426dd2bad72e699472bbdc227053939c0d147fd88a70dc0a19.
The command built and installed the generated package in a clean consumer and
checked fresh read-only Figma images. The disabled-row triptych was inspected.
Thirty focused tests pass, covering existing native/React override behavior,
real Carbon parent mappings, binding inheritance and negative consumer cases.
Typecheck, targeted lint (existing warnings), plugin check and lowering check pass.
No full CI, push, release or fresh packed-CLI installation is claimed.

Durable evidence in the V1 checkout:
private/beta-kits/slider-geometry-diagnosis-2026-10-01/paired-regression-integration/structured-list-pass-875/.

Historical aggregate forward remains 2112/6312 (33.46%); reverse's 2203 independent
cases remain unqualified. Next: apply the inherited-paint/consumer lessons to the
larger remaining families, preserving actual child closures and visibility props.
