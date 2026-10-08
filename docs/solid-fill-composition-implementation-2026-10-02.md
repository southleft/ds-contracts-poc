# Solid fill composition implementation

The actual Scratch controls at 404:2 distinguish per-paint MULTIPLY from
whole-node blending. The paint-only browser layer matches all 24 controls
exactly in RGBA. Whole-node blending changes the child ink in eight controls;
normal background paint changes the backdrop in four. Original native PNGs,
node identities and content hashes are committed as the independent oracle.

`packages/schema/src/solid-fill-composition.ts` defines strict resolved paint
facts, an independent browser paint-layer lowerer and a native SOLID fill
lowerer. Color and alpha must be finite native float32 values in [0,1]. Tiny
positive alpha is retained exactly. Unsupported blend modes, extra fields and
values that would require rounding are refused. The lowerers preserve paint
composition independently of child ink and node opacity.

The CI-invoked regression renders the shared lowerer's actual output, compares
all 24 native controls byte for byte after PNG decoding, and retains the eight
wrong whole-node controls as a negative oracle. The native fill lowerer is
checked against the native facts; a live writer/readback integration remains
required. A second native matrix at Scratch 407:2 adds 72 controls: mixed RGB, red and
gray paint across zero, tiny, half and full alpha, three backdrops and both
NORMAL/MULTIPLY. All 96 controls also match the real shared CSS generator
exactly in decoded RGBA, with source PNG hashes checked independently.

The draft TypeScript Part field reaches shared CSS as an independent ::before
paint layer. Competing paint channels, unsupported structural roles, unqualified
child stacking and the root minimum-hit-area pseudo-element collision have
named refusals. Strict contract parsing and the deep emitter validator both
refuse this draft field while the remaining pipeline is incomplete. Ordinary
contracts do not emit additional rules. These controls do not qualify clipping,
transforms, arbitrary stacking contexts or token/combination paint bindings.

This is a draft shared-CSS integration, not an accepted public Part field or a conversion
gain. No existing contract is allowed to declare an unimplemented field and
silently lose it. Promotion must connect the Part schema, shared CSS and every
consumer, token and combination color rules, Figma writer, both readers,
readback, and the observed-use census. Actual variable identity and resolution
must remain separate from this primitive's resolved literal color.

The twenty actual native Carbon drawings still refuse their wrapper paint.
After pipeline integration and additional native proof, recapture the complete
120 roots plus 21 dependencies in a stable source-version window and run the
unchanged scorer. Fixed40/full204 and never-seen qualification in both
directions remain required. No scoreboard credit is claimed for this module.


The actual inline React implementation now has an internal draft qualification
entry point, `emitReactInlineDraftPaintQualification`. It uses the same paint
lowerer and shared named structural/paint/stacking guards, emits an aria-hidden
span before the ink, and preserves existing placement. The ordinary
`emitReactInline` entry point still refuses draft paint through the deep
validator. The draft route removes only this field from the validation copy;
all other emitter validation remains active. It does not change the source
contract or accept public contract JSON. Native writing, reader/proposal
carriage and live readback remain pending.

The CI regression bundles and mounts actual generated React, verifies its
TypeScript, and compares the unchanged native PNGs for root, nested and
multiple-root placement. No imitation DOM stands in for generated output.
Unsupported state paint, void hosts, clipping, transforms and other competing
paint remain named refusals until separately qualified.


The real Figma compiler now carries draft paint into NodeSpec on root and
structural child parts. The shared applyFrameSpec runtime invokes the native
paint routine only when the compiled program carries this field; ordinary
programs retain their original output. Public component writing still refuses
through the deep validator.

Live Scratch replay at 412:2 and 412:79 used the actual compiled paint and the
same shared native runtime on separate copies of all 96 independent controls.
All 96 fills read back exactly, including tiny alpha; node opacity/blend and
child ink remained unchanged, and all 96 exported PNGs match the original
native pixels exactly. The committed WRITER-READBACK fixture pins the executed
runtime hash and both PNG hashes. This qualifies the shared paint routine,
not full component geometry, public writer entry points, variable binding,
reader/proposer/census carriage or a reverse scoreboard result.


Both readers now retain `sourceFillComposition` for a single visible MULTIPLY
SOLID fill: exact native float32 RGB, paint alpha and blend mode, with an
observed variable ID stored separately from resolved paint. Neither route
invents a variable name, binding or mode. Unsupported blend, stack, color-alpha
or non-native values carry a named issue. Normal fill behavior is unchanged
except that REST retains effective alpha exactly instead of rounding it to
four decimals; tiny positive alpha is no longer changed to zero.

The canonical plugin producer is 1.53; REST is 1.46. The native producer embeds
the same pure observer as REST, with a CI-invoked byte-drift check. Tests run
both actual readers on all 96 independent native paint facts, then verify
that proposals refuse captured composition by name until the proposal and
census pipeline can preserve it. This adds source carriage, not accepted
conversion or scoreboard credit. Historical captures keep their old versions.


The internal `proposeFromDumpDraftPaintQualification` entry point carries
constant composed paint through the actual merged source occurrence owner.
It records source nodes before structural normalization, requires every
composed-fill occurrence to reach its final Part, and refuses detached or
unconsumed ownership. It removes the duplicate legacy background-color from
that same owner after minting. Variable-bound, varying-per-variant and
unrepresented state-plane composition remain named refusals. The source dump
is unchanged. A small result receipt records consumed occurrences and owners;
it explicitly says the public Part is not accepted.

Only a private validation copy omits the draft field. The ordinary contract
still undergoes strict schema and exact variant projection checks; the
ordinary proposal entry point and public emitters remain closed to draft
paint. The actual REST reader, using native source paint facts, to draft proposal
to generated React is tested for
root and nested paint against the independent native matrix.

That test exposed an independent general defect: inferred property `Case`
became the illegal JavaScript binding `case`. Proposal and exact projection
now share one canonical name implementation. Strict binding keywords receive
a `Prop` suffix, original Figma spellings stay in the binding, and the existing
collision allocator protects natural names such as `Case Prop`. Authored
property mappings are not rewritten.

## Draft exact paint across prop combinations

The internal draft proposer now carries differing MULTIPLY paint as
`solidFillCompositionByCombination`: a table of exact source cells keyed by the
actual contract axes. It uses the existing Figma-to-contract value mapping,
keeps every participating axis, and does not factor, interpolate, or choose a
fallback for an undrawn cell. Duplicate cells/axes, invalid arity and unknown
axis values refuse. Base paint and a cell table cannot compete on one owner.
The ordinary strict Part schema and public emitter/native writer remain closed.

The shared stylesheet generator claims the required variant classes and emits
cell-specific paint pseudo-elements. Inline React selects an independent paint
span using canonical prop values; native compilation selects the same exact
cell through its existing substitution map, then lowers it with the shared
native paint routine. Shared structural, clipping, stacking and competing-paint
refusals still apply. State-plane paint, variable bindings and mixed NORMAL /
MULTIPLY source occurrences are not qualified by this change.

Qualification uses the independent live native paint readbacks as REST fixture
inputs: four colors by four alpha values, with root and nested owners. The
actual source reader, draft proposal, generated inline React and generated CSS
plus its real token stylesheet are compared against the original native PNGs
on transparent, black and red backdrops. This is a source-fact fixture proof;
it does not claim a new real-kit score or a full live component writer run.

The two-axis fixture adds 192 exact browser/native image comparisons and 32
exact native compiler cells. Boolean false/true, optional values and disabled
div/button hosts add 48 exact image comparisons and eight native compiler
cells. These checks exposed and fixed a draft inline holder defect: the UA
button-face background must be removed because the separate layer owns paint.
Ordinary contracts without draft paint retain their existing emitter output.

## Exact NORMAL peers in mixed source matrices

Native dump 1.54 and REST dump 1.47 add `sourceNormalFillComposition`, captured
by the same exact single-paint observer with NORMAL capture explicitly enabled.
The non-normal `sourceFillComposition` remains the public refusal trigger.
NORMAL-only owners keep their ordinary proposal and rendering path; the added
source fact does not promote every normal fill into the unfinished draft model.

An owner containing composed paint consumes exact NORMAL peer observations
alongside its non-normal ones. The receipt counts all source occurrences
consumed on those actual owners. It does not count unrelated normal ink as an
unconsumed composition error. A malformed non-normal observation cannot fall
back to a normal peer. Missing or unsupported peer paint, including unsupported
paint stacks, refuses. Source variable IDs remain separate, and either NORMAL
or MULTIPLY bindings still refuse qualification rather than being guessed.

The mixed matrix adds a composition axis to the four-color / four-alpha
fixture: 32 actual source cells, root and nested owners, and three independent
native backdrops. It proves 384 exact generated inline React / shared CSS
comparisons and 64 exact native compiler cells. The existing two-axis matrix
runs through the same qualification helper, and NORMAL-only ordinary schema
acceptance remains tested. This is native-fact fixture qualification, with no
new real-kit score or live full-component writer claim.

## Selected binding evidence and a failed native write qualification

The live read-only Carbon root `2154:8479` and its Chevron instance both expose
`VariableID:103532:4034` (original name `Transparent`, White Theme mode). Their
resolved COLOR alpha and stored MULTIPLY paint opacity are the same exact tiny
native float32 value. This source identity is available through the native
consumer API; the REST variables permission limit remains unchanged.

Independent Scratch controls (`420:15`) add four variable alpha values, two
consuming color modes, two supplied paint opacities, and two selected alias
edges. There are 32 controls, 69 created nodes and 12 specifically scoped
variables. This tool's bound-paint assignment normalized opacity to the selected
variable alpha in all cells; 24 differed from the supplied opacity. Generated
literal draft React matches all 32 native PNGs. Multiplying stored paint opacity
by variable alpha again fails eight observable comparisons, and would also
lose the tiny value even where 8-bit screenshots cannot distinguish it.

**The attempted MULTIPLY writes failed qualification.** All 16 requested
MULTIPLY cells read back as NORMAL, including a second assignment restoring
`blendMode` on the already-bound paint. The initial and corrective readbacks
are retained. The existing Carbon source proves a bound MULTIPLY paint can
exist, but this evidence does not establish why the tool write path normalizes
it or prove that the standalone desktop Plugin API behaves identically.
Do not call these controls a bound MULTIPLY writer proof.

`qualifySolidFillColorBinding` validates selected native evidence: exact source
ID, original name, collection/mode identities, exact native COLOR values,
paint/consumer agreement, and every selected alias edge and terminal value.
It refuses missing consumers, malformed chains, cycles, conflicting consuming
modes and contradictory colors/alpha. It returns untouched source provenance
and normalized paint, without inventing a token name or mode projection. The
selected-source checkpoint invoked this verifier, then refused by name with
`selected-native-evidence-verified-rendering-pending`. The forward rendering
checkpoint below replaces that draft refusal; public binding representation
and native recreation remain incomplete. No kit score credit.

## Standalone desktop assignment boundary

The existing DS Contracts Sync Runner in Figma desktop ran a guarded plain
plugin body against Scratch `420:15`. All 16 already-bound cells again read
NORMAL after assigning MULTIPLY; exact alpha and bound-variable IDs stayed
unchanged. This independently reproduces the MCP result through the desktop
plugin route, without writing any source kit.

Assignment-order inspection of mixed-color, half-alpha cell `420:61` locates
the change: an unbound MULTIPLY assignment reads MULTIPLY, and
`setBoundVariableForPaint` returns MULTIPLY, but assigning that bound paint to
`node.fills` reads NORMAL. Directly assigning the original alias onto the
MULTIPLY literal also reads NORMAL. The original control fills were restored
in `finally` and read back exactly. This rules out the MCP transport as the
sole cause for these controls; it does not establish a universal Figma rule
or explain how the existing Carbon source acquired its bound MULTIPLY paint.

The bounded receipt is `desktop-plugin-readback.json` in the independent
bound-paint proof directory. No fixtures, scorer, thresholds or kit totals
changed. Forward rendering of verified source binding facts remains the next
qualification step; native binding recreation stays a named limitation.

## Forward rendering of verified bound source occurrences

The actual fenced draft proposer now accepts verified selected binding evidence
and carries its exact stored paint into the existing occurrence-owned composition
model. It retains a `sourceBindings` receipt per consuming occurrence with the
owner path, original node name, original variant spelling, source variable ID,
original collection/mode/name, resolved COLOR and selected alias chain. The dump
node model has no general node ID field; this receipt does not invent one.
Source evidence is cloned by the verifier, and source captures are unchanged.

This is a resolved paint snapshot plus provenance, not a public editable token
binding or a complete bidirectional binding representation. Selected alpha is
applied once. Public schema and normal proposal entry points remain closed;
native recreation of the variable binding is still unqualified.

An actual REST-mapped family combines all 32 independently captured bound NORMAL
controls with the read-only Carbon MULTIPLY observation. The actual proposer,
inline React emitter and shared CSS generator make 132 exact native-image
comparisons (33 cells × root/nested owners × two code surfaces). The 32 NORMAL
oracles are the bound control PNGs; the Carbon cell uses an independently
captured literal control with exactly identical paint and child geometry. This
is paint rendering evidence, not an image qualification of the Carbon component.
Missing NORMAL peer consumers and contradictory selected modes still refuse;
source variable provenance is compared for every occurrence. The earlier
32-control double-alpha counterfactual remains in the same CI-invoked test.
No real-kit score or never-seen credit is claimed.

## Module React and static HTML paint qualification

`emitReactDraftPaintQualification` and `emitHtmlDraftPaintQualification` run
ordinary validation on a cloned contract with only the fenced draft paint fields
removed; the original contract drives actual generation. Public emitters still
refuse those fields. Shared paint lowering now accepts the HTML root/part/modifier
selector grammar and disabled selector instead of copying paint math into HTML.
Contracts without paint emit no additional rules through that shared helper.

The 33-cell occurrence-bound source family now makes 264 exact comparisons across
inline React, shared CSS, real CSS Modules React and generated HTML, at root and
nested owners. Module output is bundled with the actual CSS Modules loader;
HTML comparisons select the actual emitted showcase components. The same native
images and source hashes are used throughout, including the explicitly limited
Carbon paint oracle described above.

Boolean/disabled paint checks cover div and button hosts with defaulted and
optional booleans, on three native backdrops and all four code surfaces (96 exact
comparisons). HTML explicitly emits an observed optional false example with a
false-value attribute; an unset optional boolean selects no paint cell. A first
run caught the HTML button's native background leaking through transparent paint.
The shared painted-holder rule now resets button appearance/background, and the
repaired native-image comparisons pass. The failed run is retained.

Public schema promotion, an editable binding representation, complete native
component recreation and real-kit/never-seen scoring remain separate unfinished
requirements. This checkpoint earns no scoreboard credit.

## Full canonical native component writer

`buildComponentScriptDraftPaintQualification` fences paint validation while using
the ordinary full `buildComponentScript` / `buildSyncScript` path, including page
loading, component creation, variant properties, identity stamps and normal
geometry. The public writer still refuses draft paint. This is a qualification
entry point, not public schema promotion.

The standalone desktop Sync Runner executed the full generated script in Scratch
through its existing localhost runner with SHA-256 manifest verification. Two
new component sets (`427:2608`, `427:2746`) contain 32 variants each, on new pages
`427:2543` and `427:2649`; the complete 164 generated component/section/child node
IDs and both new page IDs are retained. Each family contains four colors, four
exact alpha values, NORMAL and MULTIPLY paints. Root and nested owners cover
both geometry paths. The corrected source emits the identical script hash
`c5bd30ba20be485fcdb41c9697f7181fc525d4669f57d6f78b38d348fde8cc08` already executed.

All 64 full component PNGs match their independent frozen native controls exactly.
Paint/color/alpha/blend, 20×20 component bounds, enclosing opacity 1 and
PASS_THROUGH blend, and the normal 8×8 ink child at (6,6) read back exactly.
The normal ink uses the canonical writer's minted token binding; the composed
paint itself remains a literal resolved snapshot. Ordinary ink RGB follows the
existing hex-token representation; the proof asserts its exact native pixels
and geometry, not raw float identity for that ordinary ink. The live full-component proof
and native image hashes are retained in `FULL-WRITER-READBACK.json` and 64 PNGs,
with a CI-invoked conformance test. Source controls and read-only kits were not
modified. The helper-only native qualification limitation is now closed for
these complete literal-paint components.

This does not recreate the original source COLOR-variable binding, qualify all
component geometry, measure a real kit, or satisfy the reverse scoreboard.
Editable binding representation, bound MULTIPLY recreation, public promotion and
unchanged-scoring qualification remain unfinished.

## Public literal-paint integration

Strict `PartSchema` now accepts exact `solidFillComposition` and observed
`solidFillCompositionByCombination` tables. Both committed JSON Schema
projections are regenerated. The public proposer uses the existing actual-owner
census and late paint attachment, removes the lossy legacy background-color
projection, and preserves the exact single literal paint. Ordinary NORMAL-only
imports retain their existing path. Public inline React, CSS Modules React,
static HTML and the canonical native component writer share the qualified paint
lowering and named host/stacking/domain refusals.

Source variable bindings are still explicitly unfinished. The public proposer
requires selected consumer corroboration and then refuses native binding
recreation by name; it never silently exports a literal in place of that binding.
The internal forward qualification route retains original selected provenance
in an internal `solidFillCompositionSourceBinding` field. That field is absent
from strict PartSchema, refused by public deep validation, and refused by native
compilation so the batch writer cannot discard it. Internal code-renderer
qualification can still verify its appearance. This preserves the remaining
binding work instead of falsely declaring it complete.

Web-component paint emission remains a named unsupported target, including
composed dependencies. It is outside the active React focus and cannot silently
omit a newly accepted paint field. Existing native and browser oracles now test
the public literal entry points; default module React/HTML output is compared
with its qualified renderer output. Unset optional booleans remain distinct
from explicit false cells. No scorer, threshold, frozen kit fixture or kit score
was changed. The full fast lane and unchanged scoreboard are the next gates.

The initial full fast run was terminated after detecting stale packaged core/CLI
build prerequisites; it is not qualification evidence. Schema, core, CLI and
web-component packages were rebuilt in dependency order before the replacement
run. Source-level paint tests passed 16/16, and the final targeted source-binding
fence/public-renderer checks passed. No push or full-green claim precedes the
replacement lane's terminal result.

## Gate repairs after the first warm public integration run

The complete warm lane ended with 193/201 gates passing. Its five runtime failures were real reserved typography-carrier regressions: the new NORMAL-peer observation had been added to TEXT nodes even though that field exists to select structural background-owner cells. Both readers now keep NORMAL text in their existing typography channel; non-NORMAL text paint still carries its composed-paint observation or named unsupported-blend issue. A paired native/REST regression test proves that distinction. The strict typography validator was not weakened. All 34 typography tests and the complete runtime gate pass (393 passed, 3 existing skips).

All three historical input-field comparison gates pass after installing the exact locked MUI and Polaris sandbox dependencies. No capture or human grade was rewritten. Public reference documentation now maps and renders all 18 new schema branches; schema freshness and the 365-branch site coverage check pass. Sparse composition tables apply no paint to undrawn combinations, rather than guessing a fallback.

Fresh read-only source captures for all 128 ledger records verified stable before/after file versions in three files. The 1.45 reader reproduced the exact prior source fingerprints and stamps for all six pending actions, and their contract hashes matched. The supported observation CLI refreshed grammar records to 1.47 while retaining action kinds and commands. An independent audit confirms all contract hashes, canvas stamps, history, authority, and 53 historical adoption decisions are unchanged. Twenty-five in-sync observation baselines remain; incompatible baselines on unresolved rows were dropped by name by the existing CLI, not fabricated. The four synthetic fixture baselines now use the current grammar while retaining their intended four undecided drift classifications. The unchanged ledger gate passes.

Door-register references were rederived by the repository command; both the check and its self-test pass. The canonical reader was re-embedded verbatim in the plugin UI; packaging independently verifies the unchanged engine receipt fd47aa637063 / 1805704B. A test fixture alpha type error and initial embedded-reader packaging refusal were repaired and retained in local diagnostics. Full fresh CI remains required before push, and no real-kit score gain is claimed from these repairs. The independent 48/48 bound-underlay native experiment is archived in continuation checkpoint 94; it has not yet been integrated into the canonical writer or public binding pipeline.
