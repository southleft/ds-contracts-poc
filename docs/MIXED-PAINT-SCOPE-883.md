# Mixed paint scope and implementation boundary, 2026-10-06

At 70bac603a, inspected the canonical Tile closure captured at grammar 1.73.
This is a shared representation gap, not a missing source observation:

| Family | Captured variants | Root observations |
| --- | ---: | --- |
| Tooltip | 44 | 32 bound Transparent paints; 12 explicitly empty fills |
| Button | 420 | 420 bound paints spanning 18 variable IDs |
| AI label | 28 | 28 bound paints spanning two variable IDs |
| Tile | 65 | 65 bound paints spanning two variable IDs |

Total affected root observations: 557. This is neither a pass forecast nor an
independent held-out sample. Nested dependencies have additional failures.

All twelve empty Tooltip roots explicitly carry sourceEmptyFill:true. Treating
these as unobserved capture gaps is incorrect, but treating an unobserved fill
as empty would also be incorrect. AI label's active state uses Border/border-inverse
where focus uses Transparent; replacing both with the base token loses identity.

The existing binding planner can construct multiple requested variable paths and
preserves their selected alias graphs. The public part schema, source proof,
CSS token validation and native binding writer currently require one uniform
paint/path per owner. Literal paint tables already exist, but they cannot carry
these varying bindings. Therefore removing the importer refusal alone would
make the public contract promise more than its lowerers implement.

Next implementation must carry a selected token and source proof per finite paint
cell, including an explicit empty cell. Missing data remains distinct from empty.
Validate exact tuple coverage and variable/alias identity; refuse inconsistent
selected contexts. Both React emitters must choose the same paint token and alpha
without rounding or applying alpha twice. Native generation must bind the selected
variable per cell and emit an empty fills array for an empty cell, then prove it
through live readback. Update schema projections/reference docs alongside this
change. Pin unknown-versus-empty and wrong-token negative cases before accepting
any importer relaxation. Start with the real two-variable AI label observations,
then the Tooltip empty cells, and finally rerun the public dependency chain.

No code guard, scorer, source Figma node, or threshold was changed in this audit.
No new visual passes. Tooltip body remains 22/22 and Menu 28/28 on their last
verified public runs; historical forward 2112/6312 (33.46%) is not refreshed and
2203 reverse cases remain unqualified. This audit changes priority from individual
nested refusals to the shared bound-paint table representation.

The per-cell evidence inventory is retained in the V1 checkout at
`private/beta-kits/slider-geometry-diagnosis-2026-10-01/paired-regression-integration/mixed-paint-scope-883/mixed-root-paints.json`.
The original canonical closure remains in paint-order-scope-879/tile-capture.json.

## Experiment 884: capture blocker isolated, 2026-10-06

The unfinished per-cell binding implementation packaged AI Label, but its first
public run measured only 3/28 variants; 25 were refused because compositor
promotion changed the viewport raster. This was reproduced with the actual
emitted React/CSS, first alone and then in the benchmark's multi-case layout.
All four 24px states preserved their pixels when mounted alone. On the multi-case
page, promoting the first Focus case changed 166 pixels in unrelated later
components, while leaving the subject unchanged. Neighboring glyph pixels were
rerasterized with one-channel-value differences.

The capture proof now compares exact RGBA bytes across the complete observed
subject paint extent, including overflow. It still refuses changes within that
extent, effects outside the observed viewport, and changed isolation rasters.
Neither the image scorer nor its thresholds changed. Regression tests reproduce
the sibling effect and reject changed blend pixels outside the layout box.

With the same generated package before and after (SHA256
`88aaf46f4bdc7abed0b1f677bd23a30d788feb24933af4900a70a7af1f2ceffc`),
the public AI Label run is now **19 pass, 9 fail, 0 unverified / 28**. All nine
failures are image differences at 16–24px sizes, 5.73–9.75%; content and font/color
checks match. The family still FAILS. This is measurement recovery, not a claim
that the capture change improved the generated component. The package depends
on uncommitted bound-paint table work, which still needs complete cross-emitter
and native validation before it can land.

Validation: 23 capture tests passed serially, typecheck and lint passed. An
initial concurrent run had one Chromium screenshot protocol failure; its serial
rerun passed. The before/after public receipts, diagnostic scripts and test logs
are preserved under the V1 private evidence directory in `paint-capture-884`.
Historical forward 2112/6312 and reverse 2203 unqualified cases are unchanged.
The affected public regression, Carbon Menu, remains **28/28 passing** after
this capture change; its new receipt is retained alongside the AI Label runs.

## Experiment 885: bound tables and native empty cells, 2026-10-06

Finite paint rows now carry their own token and source binding. The planner
preserves both alias graphs and rejects conflicting identities/contexts. The
public importer retains explicit empty observations as empty rows and still
refuses missing source observations. React CSS Modules and inline React select
the same token and hide the layer for an empty row, including transitions back
to a painted row. Uniform paint CSS retains its prior output.

The compiler test exposed a native empty-cell bug: absence of a selected paint
did not explicitly clear default or stale fills. Empty cells now carry the
existing native `fillClear` instruction. A three-variant contract was sent
through the actual generated public prepared-library token writer, component
writer, and independent readback in Live Testing, operation
`70000000-0000-4000-8000-000000000885`. The set is node `155:67065`.
Readback reports `supported-structure-observed`, no problems: two distinct bound
paint layers and one component with an empty fill array and no paint child.
The live screenshot shows two separated colored cells and the empty third cell.
This proves the bounded structural behavior, not independent reverse-scoreboard
qualification or visual fidelity across arbitrary libraries. The verifier's
remaining limitations and `acceptedContract: null` are retained.

`core/fixtures/bound-fill-scoped/TABLE.json` pins the live inventory and compiler
input. Its replay checks the current compiled graph and refuses an invented
white fill in the empty component. Eight binding tests pass, covering both React
surfaces, native token selection, live readback, graph/proof mismatches, and
explicit-empty versus missing observation. The broader paint suite passed 42/44
initially; the two failing draft-provenance cases exposed a lost inspection-only
marker. Restoring that marker made both targeted reruns pass, retaining the
public/native refusal for draft-only evidence. The full native mock remains
unqualified because it omits Figma paint defaults; its refusal is retained and
was not used as substitute evidence for the live run.

Both schema projections and all 557 reference branches validate; lowering
citations and the plugin engine receipt were refreshed. Plugin checks pass.
The final public AI Label run remains **19/28 pass, 9 fail, 0 unverified**;
no score gain beyond experiment 884. The next shared obstacle is applying a
child's finite paint table to linked instance selections with exact source
proof. Keep that path refused until its selected-cell correspondence is proven.

## Experiment 886: text foreground and the next source gap, 2026-10-06

The current Tile dependency run showed that `_Tooltip definition item` was
blocked by its ordinary normal-flow text child, before linked paint selection.
The shared foreground placement rule now includes text and text-prop boxes,
retaining its refusals for authored offsets, transforms and positioning. Both
React emitters match the ordinary-background control byte-for-byte, including
text wrapping and bounds, for literal and prop-driven text. Three focused paint
regressions and six inherited-paint tests pass, as do typecheck, lint and plugin
checks. No source canvas or score threshold changed.

A fresh canonical capture and public run exposed the next failures immediately:
**0/3 Tooltip-definition variants pass**. Every case lacks the Underline part;
the state axis is discarded, Focus fails image comparison, and Enabled/Hover
have fractional-origin export framing refusals. This is admission progress,
not a visual pass. The source Underline is a 95px by 0px VECTOR with square caps,
1px center stroke and a `[1,1]` dash pattern in Enabled. Its painted outline has
many separate rectangles. The existing simple degenerate-stroke experiment is
not sufficient: it intentionally excludes dashed and square-cap paint. Preserve
that distinction rather than substituting a solid CSS border.

The new text fix also changes Tooltip's next refusal to its Trigger default
instance, so finite child-paint inheritance has not yet been proven to be the
next useful change. Next investigate the canonical stroke capture and preserve
the source underline state differences before expanding downstream admission.
Evidence is retained in the V1 private directory as `text-foreground-886`.
Historical forward 2112/6312 and reverse 2203 unqualified cases are unchanged.

## Experiment 887: dashed-stroke source ambiguity, 2026-10-06

Before implementing a dashed-line translator, created 19 native controls in
Live Testing: lengths 95/96/101, patterns `[1,1]` and `[3,2]`, NONE/ROUND/SQUARE
caps, plus a square-endpoint-only control. The final controls live on page
`157:67105`, section `157:67066`. No community source was modified.

The critical result is a counterexample: setting node-level square caps versus
setting square caps on the network endpoints produces **identical exposed
width, height, weight, alignment, cap, dash pattern and vector network**, but
*different strokeGeometry and pixels*. Node-level caps extend every dash;
network endpoint caps only extend the path endpoints. Carbon's Underline matches
the latter construction. Translating the getter values to ordinary SVG dash
and cap properties would therefore invent paint for one of these cases.

A browser experiment using fitted dash lengths and separate endpoint caps was
compared with all 19 native exports. None was byte-identical (largest channel
difference 22; the endpoint-only 95px control differs by at most 9). These are
rendering diagnostics, not public scorer passes or a basis to change thresholds.
The common integer cycle fit explains the measured geometry, but is not yet a
qualified general lowering. Painted geometry must disambiguate cap behavior
before it is regenerated in either direction. Keep zero-height dashed vectors
unsupported pending that proof; do not replace the underline with a solid border.

The actual equal-metadata/different-paint pair, image hashes and native outlines
are pinned in `extract/figma/fixtures/native-line/dash-cap-ambiguity.json`.
All four native-line reader tests pass, including its new counterexample test.
Full probe data, native exports and browser comparison script are retained under
V1 private evidence `dashed-source-ambiguity-887`. No production importer rule or
score changed. Historical forward 2112/6312; reverse 2203 unqualified remain.

## Experiment 888: prioritize sparse Button presence, 2026-10-06

Parked the three-variant dashed underline investigation. Rendering its captured
native outlines gave 1/19 byte-identical probe images, with no public pass proof;
fixed outlines also do not establish native dash behavior after resizing.
The next larger target is Carbon Button's 420 captured variants.

The Button refusal exposed an importer inconsistency: source projection already
validates its 168 absent combinations, but minority-part presence previously
required the entire 588-cell product unless a positive drawn-domain declaration
existed. Presence now derives its domain from the axes minus the validated
absence declaration, independently of its observations. It still requires every
reachable observation, keeps sparse-inference ambiguity checks, and does not
infer source declarations when stamp observability is missing. Schema presence
validation reuses the existing reachable-tuple helper. An absolute-geometry test
also caught and fixed a validator crash when looking up presence for a declared
absent cell that correctly has no table row.

All 23 presence tests pass, including a three-axis minority part, rejected
missing/invalid declarations, both actual React emitters, native variant
structure, and geometry completeness. The exact-proposal checker, typecheck and
lint pass; schema freshness and plugin checks pass. The engine receipt was refreshed. This is a local engine fix,
not a shipped release or a demonstrated visual pass.

Replaying the unchanged 26-set Tile capture through the public batch proposer
still admits 20 dependencies and skips six; no additional component is admitted.
Button now reaches `root/Button content/Icon/Add:default-instance` and refuses
`public-binding-recreation-unqualified:instance-owner`. The source instance has
an explicit fill override and a bound Transparent variable; the linked Add main
has the same literal paint but no matching source binding. Treating that as
inheritance would discard an authored binding, so its refusal remains. Related
instance-owner refusals affect Tooltip, Revert AI button, Slot and Tile. Next
investigate shared bound instance-root paint carriage, using this real source
case before expanding implementation. Do not assume finite child paint tables
are the blocker.

New public passes: **0**. Historical forward **2112/6312** remains stale; reverse
**2203 cases remain unqualified**. Evidence: V1 private `sparse-presence-888`.

## Experiment 889: native instance paint feasibility, 2026-10-06

The existing bound-paint writer creates a child rectangle and cannot run on an
instance. Before expanding the importer, tested native alternatives in Live
Testing page `157:67106`. Literal main `157:67109` and layered main `157:67112`
remain linked to their instances. A COLOR variable `VariableID:157:67108`
resolves to RGBA (0.25, 0.5, 0.75, 0.5).

Both direct binding and restoring MULTIPLY on the bound paint object read back
as NORMAL after assigning instance fills. Thus changing assignment order does
not solve the composition loss. Overriding the already-existing paint child of
an instance works: the child retains the variable binding, NORMAL fill blending,
MULTIPLY node blending and opacity 1. No instance is detached or given new
children. Added opaque red foreground to both mains and independently exported
paired instances over white, black and colored backgrounds. All three pairs are
byte-identical PNGs, and their main links and foreground fills are retained.
The page screenshot was inspected. This establishes native feasibility only;
it is not public conversion, live generated-writer readback, or reverse-scoreboard
qualification. Seven inherited-paint tests pass, including the pinned native
pair evidence in `core/fixtures/inherited-bound-fill/instance-layer-probe.json`.

A draft-only look-ahead on the unchanged Carbon Button capture stops at
`solid-fill-composition-child-stacking-unqualified:root:skeletonStateAnimation`.
That child has a background-color root input, while the current foreground rule
admits only width/height inputs. It also carries a bound NORMAL fill, distinct
from Add's MULTIPLY override. The standalone draft look-ahead used the public
batch's dependency contracts; it is not a substitute for the full public batch.
Temporary diagnostic instrumentation was restored; no production refusal was
removed. No further outline or cap investigation was performed.

Next implementation: preserve caller source-binding proof on instance usage;
reuse existing root background inputs for NORMAL paint where valid, and supply
an existing paint receiver in linked mains for MULTIPLY overrides. Both React
emitters must select caller token values without altering the child's default;
native compilation must retain main identity and independent receiver inventory.
Run Button through the public path before expanding this further. The successful
native experiment avoids an otherwise impossible insert-child-on-instance route.

New public passes: **0**. Historical forward **2112/6312** remains stale; reverse
**2203 remain unqualified**. No release or push. Durable evidence is V1 private
`instance-paint-889`.

## Experiment 890: public React bound instance paint, 2026-10-06

The importer now retains caller-owned bound paint on linked component usages,
including per-variant token selection, instead of incorrectly treating every
binding as inheritance or refusing every instance owner. Source alias graphs,
selected values and paint proof remain required. Equal-looking but differently
bound paint stays a caller override; an unresolved child still refuses.

Both React emitters route caller ink and blend mode to the child's independent
paint layer. A linked main exposes an SVG receiver when a bound caller needs
one, retaining positive sub-byte alpha without blending its foreground. Root
resets prevent overrides leaking into nested roots or sibling defaults. Caller
paint also overrides a selected empty child paint cell. A NORMAL fill can use
an explicitly declared root background input; MULTIPLY cannot use that path.
Normal background inputs do not prevent foreground placement. The existing
inside-stroke validator now checks reachable tuples, including validated absent
variants, fixing Button's next sparse-domain refusal without inventing rows.

Native bound-instance compilation explicitly refuses
`bound-instance-paint-native-unqualified`: the existing-layer feasibility proof
from 889 is not yet integrated with generated native writing and independent
readback. This does not qualify the reverse direction. Neither scorer nor
fidelity threshold changed.

Fresh read-only canonical capture of Carbon Button followed Add, Resizer and
Skeleton state animation. The public CLI generated and installed its package in
a clean consumer and measured all 420 variants against authenticated Figma
exports with IBM Plex Sans provisioned. First run: **408 pass, 12 fail, 0
unverified**, plus the set-level **children-slot-discarded** failure. The CLI
correctly exits FAIL; this is not a passing component. Eleven failures are
Ghost/Danger ghost disabled text+icon cases at 6.78% difference on black; one is
Ghost icon-only Expressive Enabled at 6.00% on white. The same Figma Swap icon
property currently becomes `children` in one physical placement and `swapIcon`
in other placements. A tentative sparse-domain-only slot change did not unify
those placements and was removed. Source gates and scorer behavior are intact.

Saved Tile-closure batch proposals increased from 20/26 to 24/26: Button,
Tooltip, Revert AI button and Slot now propose. Tile still refuses through its
shadow dependency; AI layer Shadow still refuses competing box-shadow paint.
Proposal counts are not visual passes. Menu's public regression remains **28/28**.

Validation includes both generated React surfaces with type checking, token
transitions and empty cells, unchanged sibling defaults, black-backdrop blending,
foreground isolation, direct NORMAL background input and its MULTIPLY refusal,
invalid binding/token proof refusal, missing sparse-stroke rows and explicit
native refusal. Forty-three presence/paint/slot tests and 34 broader composition
tests passed; affected empty-receiver and NORMAL tests were rerun after the
final CSS changes. Typecheck, lint, schema freshness and lowering checks pass.
The engine receipt and lowering citations were refreshed. Final public package
verification and plugin checks are recorded with the evidence below.

Historical forward **2112/6312** remains stale; reverse **2203 unqualified**.
Do not add targeted Button checks to that mixed historical aggregate. The next
work is shared caller slot identity, the 12 named Button visual failures, and
native instance receiver integration. V1 private evidence: `instance-paint-890`.

Final 890 verification: the regenerated Button package (`8e853dc5ad5e` SHA-256 prefix) retains exactly the same 408/12/0 variant verdicts and `children-slot-discarded` set failure. Plugin checks pass. No accepted-set gain is claimed.

## Experiment 891: preserve the named conditional swap API, 2026-10-06

Source inspection changes the slot diagnosis: Button has 349 variants with one
Swap icon consumer, one variant with two consumers, and 70 skeleton variants
with none. The duplicate is Danger primary / Text + Icon / Medium / Hover.
Both consumers there are visible source instances of the same Figma property;
this is not a set of mutually exclusive physical placements. Do not duplicate
or introduce content in skeleton states merely to make the children check pass.

Found a real API-inference inconsistency. A bare swap with a Boolean visibility
binding is excluded from default-children selection, while a frame-wrapped swap
with the same binding was not. The wrapper path now follows the same rule. The
packaged Button declares `swapIcon?: ReactNode`, `icon?: boolean`, and omits
`children` from its inherited HTML props. All three physical slot placements
therefore consume the same named input without changing their source presence.

A separate runtime probe bundled the actual packed distribution, passed named
caller content in every captured variant, and compared its occurrence count to
a traversal of the source capture. Results match every source variant: 349 once,
one twice, 70 absent; setting icon=false hides it in all 420. Five slot tests
pass, including actual module/inline React for bare and wrapped Boolean-controlled
swaps, and all 122 exact-proposal checks pass. Typecheck and lint pass; the
plugin receipt was refreshed. This is an API correction with live source-shaped
runtime evidence, not a new visual pass.

The unchanged public checker returns **408 pass / 12 fail / 0 unverified** and
still reports the set-level `children-slot-discarded`. Its current condition
uses any slot, including named slots, to require universal React children. The
new package explicitly rejects children by type and its declared named input
obeys the source. No scorer change was made and the set is still reported FAIL.
The package SHA-256 prefix is `d0d93df2ae6d`. The eleven disabled visual misses
have matching font/color metadata and aligned integer bounds; do not assume
those failures are a color-token or framing bug without further evidence.

Next: investigate the remaining raster differences against original font/source
evidence and integrate native instance receivers. The named-slot behavioral
check needs a separately reviewed correction; do not use this diagnostic probe
to overwrite public verdicts. Historical forward 2112/6312 remains stale;
reverse 2203 remain unqualified. Evidence is V1 private `named-slot-891`.

## Experiment 893: recover rest-plane presence, 2026-10-06

A current replay of the original 204 frozen REST dumps admits 171 sets and
refuses 33 before this change. This is an admission diagnostic, not the visual
scoreboard: nine refusals name missing variable-consumer evidence in the old
captures. Compared with iteration 859, Social icon regressed from admission to
`presence-declared-domain-observations-incomplete` across its 105 variants.

The sparse ambiguity fence includes combinations absent in any interaction
state. Presence inference incorrectly used that union as the rest-state domain,
removing combinations that are actually drawn at rest but absent on hover.
Keep the existing ambiguity fence; derive rest presence from the independently
validated rest-plane absence declaration. A complete rest plane therefore stays
complete, while a genuinely missing rest tuple remains absent and unqueryable.

The added regression fails with the original presence-domain error before the
fix and passes afterward, including the negative missing-rest-cell case. All
24 presence tests and 122 exact-proposal checks pass. Full frozen-sample replay
then admits 172 sets and refuses 32, with Social icon the only status change.
Twilio Visual Picker moves beyond the same presence error but still refuses
unrecoverable interaction states; no admission or fidelity gain is claimed there.

The public Social icon command packages and measures all 105 variants with the
unchanged checker: **91 pass / 14 fail / 0 unverified**, set **FAIL** with
`variant-prop-discarded:style`. Failures cluster in Telegram, Signal, and Reddit
geometry/content/paint. This restores a measurable path after regression; it
is not 91 new global passes or an accepted-set gain. Historical aggregate
2112/6312 remains stale; reverse 2203 remain unqualified. The frozen source is
not a fresh canonical capture or a never-seen kit.

Evidence and replay scripts are in V1 private `rest-presence-893`. The unfinished
NORMAL native receiver and the older REST stroke experiment remain separate
working changes. No scorer, tolerance, Figma source, or goal was changed.

## Experiment 894: align child order with hidden-instance omission, 2026-10-06

The current 204-set replay exposes the same child-identity refusal in Carbon
Dropdown, Carbon Tile, and Fluent Toolbar. Instrumentation confirms these are
not collapsed repeat collections: the missing children are INSTANCE nodes
hidden in every captured occurrence with no visibility/swap/variable binding.
The rendering projection already omits them, but explicit order validation was
counting them as rendered immediate children. Reuse the exact omission predicate
in the order projection. Caller-controlled hidden instances remain in scope;
visible or otherwise unrepresented children retain the existing refusal.

The new source-shaped regression fails on the original identity error before
the change, passes after it, and preserves source JSON. All 37 child-order and
presence tests pass; 122 exact-proposal checks, typecheck and lint pass. The
focused replay removes the identity error from all three families. Carbon Tile
still refuses missing variable-consumer data; Dropdown still refuses a linked
instance's unqualified internal order. These are not visual gains.

Fluent Toolbar imports, but the public CLI stops at
`react-library-duplicate-component`: distinct IDs ds.button/ds.button-2 and
ds.input/ds.input-2 share generated Button/Input names. Checking all 172 imported
requests from iteration 893 finds no other duplicate-name request. This newly
exposed packaging failure is retained, not worked around by hand-editing names.
No Toolbar package, pixel pass, or accepted-set gain is claimed.

An initial full replay overlapped the deliberate before-fix regression probe;
it loaded the old source and is diagnostic only. The final replay runs against
the restored change without source mutation. Its separate census-final receipt
is authoritative. Native NORMAL-paint and REST stroke experiments remain parked;
no checker, threshold, source Figma file, or goal was changed. Evidence is V1
private `hidden-order-894`.

Final 894 replay: 172 → 173 imported sets, 32 → 31 refusals, Toolbar the only
status change; all 204 input hashes match the before-run. Historical visual
forward remains 2112/6312 stale and reverse 2203 unqualified. No push.

## Experiment 895: measure dependency completeness, 2026-10-06

The previous turn fixed child-order admission but produced no accepted set.
Tested the other newly admitted family, Atlassian Avatar group, through the
public command using the frozen 10-variant dump, authenticated font manifest,
and live source image checker. Result: **0 pass / 3 fail / 7 unverified**, no
set-level behavior problem. Seven cases lack qualified image framing; the three
measured failures exceed image and size tolerances. The package is generated
but the CLI correctly exits 1. No new passes or accepted sets.

The request contains explicit provisional Avatar and Icon stubs. Its real
Avatar definition refuses `child-paint-order-owner-unqualified`. A systematic
scan of all 173 currently admitted frozen-source requests finds **51 sets**
whose dependency descriptions start with the generator's exact `STUB contract
auto-proposed` marker, spanning **1,103 source variants**. These are NOT 1,103
newly diagnosed failures or recoverable passes: the count measures exposure to
incomplete dependency graphs. It explains why admission is a poor proxy for
shipping progress. The initial broad description substring scan was replaced
with the exact generator marker in DEPENDENCY-TRIAGE.json.

The largest within-kit label groups are Atlassian Icon (six sets), Primer Search
(five), and Primer Avatar/Gear/TriangleDown (three each). Labels are prioritization
hints, not shared-identity proof; validate source keys before choosing a shared
fix. Next inspect dependency identity and canonical capture availability for
these groups before another broad visual run. Do not spend further iterations
polishing Avatar-group pixels while its dependency graph is incomplete.

No converter or scorer code changed. Evidence, source dump, generated package,
receipt and dependency inventory are in V1 private `dependency-triage-895`.
Historical forward remains 2112/6312 stale; reverse 2203 remain unqualified.

## Experiment 896: shared remote variant-set evidence, 2026-10-06

Verified the six Atlassian Icon dependencies against exact source identities:
all reference set key 4c90e9edb5aba345e52a77e207c361c4ba6a7b47. Applied component
keys include 69df337a50601659cfdc58c9c2629eb994999b15 and
d7bd7f69e402c1c5ec4c62b205932ff4e91d0fda. REST metadata for the set and both
components returns 403; the accessible consuming file's /nodes endpoint returns
the cached set/component identities but zero children. No API retry or token
change can be counted as a recovery from that evidence.

Opened the owner's ADS Components consumer file and activated the already
installed Desktop Bridge. Read-only Plugin API inspection of instances
81007:1080 and 81007:1082 returns their remote mains and a readable parent set
139061:3660. Unlike REST, the parent exposes four variant children with nested
instance/vector geometry. It is remote with parent:null. The two declared axes
are size (12px/16px) and deprecated spacing (none/spacious); all four Cartesian
tuples appear exactly once. All four native variants exported as PNG. The
saved verifier checks exact tuple equality and hashes the exports.

This is a different boundary from the implemented standalone remote snapshots:
`captureRemoteMainSnapshot` and the proposer currently reject any remote variant
set. Next implement an explicit observed-domain remote-set snapshot, verify
identity/domain mismatches and incomplete domains refuse, then run the canonical
dependency capture. Preserve nested INSTANCE_SWAP behavior; do not import the
large preferred-values list as if every option had been observed. Snapshot
readability establishes no original-library edit authority or unseen API.

The first Plugin API probe incorrectly requested componentPropertyDefinitions
from a variant; it failed read-only and was corrected to read the parent set.
No source nodes changed. Evidence is V1 private `remote-set-domain-896`, including
API responses, live trees, verified domain and four native PNGs. No code or
score change: historical forward 2112/6312 stale, reverse 2203 unqualified.

## Experiment 897: capture complete observed remote sets, 2026-10-06

Extended the existing remote-snapshot provenance to complete remote variant
sets. The canonical Plugin reader verifies a detached remote set, unique child
IDs/keys, matching parent links, finite positive component dimensions, and exact
coverage of the independently declared Cartesian domain (maximum 4096 tuples).
It records every variant key and tuple. The proposer corroborates the metadata
against the captured set and rows; missing rows, duplicate tuples/keys, wrong
capture file/set identity, mismatched row identity, malformed records and domain
extensions refuse. Standalone remote snapshots keep their prior restrictions.
No original-library editing authority or unobserved variant behavior is claimed.

Captured ModalFooter through the canonical reader in the read-only Atlassian
consumer file. The closure now contains eight real captured definitions,
including all four Icon variants and the actual Image/Chevron defaults. The
preferred-value catalog is not expanded as observed dependencies. The first
capture exceeded the bridge's 32-second response window but logs confirmed
successful completion at about 82 seconds. Only after that terminal evidence,
a second capture saved its result in an ephemeral runtime variable for recovery;
it completed in about 1.5 seconds with the loaded file. No document edits.

The public command packages ModalFooter but returns **0 pass / 3 fail /
0 unverified**, with `variant-axis-inert-ledgered:appearance`. The captured
Button dependency now refuses malformed font-size/line-height token references;
Chevron refuses an affine basis and Spinner animation refuses varying arc caps.
The Button fallback explains the missing font/color behavior. This is a capture
capability gain, not a consumer pass or accepted-set gain.

Tests include the real four-row Atlassian domain projection (identity/domain
only, not a geometry fixture), synthetic completeness/identity mutations, and
unchanged standalone behavior. Twenty-six snapshot/REST-closure tests and 122
exact-proposal checks pass; final snapshot tests, typecheck and lint pass. No
push or full fast lane. Native NORMAL-paint and REST stroke working changes
remain separate. Evidence and the 2 MB canonical dump are V1 private
`remote-set-capture-897`. Historical forward 2112/6312 stays stale; reverse 2203
remain unqualified. Next shared defect: malformed bound font references in the
newly readable Button dependency, measured before further capture expansion.

## Experiment 898: encode non-ASCII variable names consistently, 2026-10-06

The real Button font references contain the source emoji prefix in
`🌮 Font Size/Body M` and `🌮 Line Height/Body M`. Numeric values are correct,
but the shared variable-name fold previously handled only spaces, parentheses
and ONE DOT LEADER, leaving emoji outside the token-reference grammar. Extend
that shared fold with codepoint escapes for remaining unsupported characters;
registration and proposal now agree on `-u1f32e--Font-Size.Body-M`. Preserve
original names and explicit rename notes. Distinct Unicode/literal encoded
spellings that would collide refuse regardless of input order; existing legal
paths, whitespace, parentheses and ONE DOT LEADER spellings stay stable.

Eight name tests cover actual registration/reference agreement, emoji/CJK/accent
and underscore spellings, collision refusal and existing behavior. Twenty-three
name/template/paint-binding tests, 122 exact-proposal checks, typecheck and lint
pass. The unchanged captured eight-definition batch now proposes Button:
six proposals, two refusals (Chevron geometry and Spinner varying arc caps).

The public ModalFooter rerun stops before packaging at
`react-library-generation-refused`: the real Image/Icon/Button graph references
`{color.icon}`, which the existing captured-token layer deliberately skips
because `color/icon/subtle` and `color/icon/inverse` make it a group prefix.
The source captures color/icon=#292a2e and its mode values correctly. This is a
separate leaf/group path representation defect, not missing source color data.
Do not delete descendants, replace the base with a sibling value, or loosen the
missing-token gate. No public visual pass or accepted-set gain this turn.

Evidence is V1 private `unicode-variables-898`. Next provide a collision-safe
shared mapping for captured variables that are also group prefixes, preserving
both base and descendant identities across registration and references. The
historical forward aggregate remains 2112/6312 stale; reverse 2203 unqualified.


## Experiment 900: retain group-prefix token leaves, 2026-10-06

The same captured Atlassian ModalFooter now passes the public clean-consumer
command: **3 pass / 0 fail / 0 unverified**, no set problems, versus 0/3 in
897 and generation refusal in 898. White and black image differences are
1.64% default, 1.61% warning, 1.64% danger; all text and text styles pass.
The command installs the generated package, builds Vite, renders Chromium,
and compares authenticated Figma images with the existing thresholds.
The danger triptych was also inspected. This is one targeted accepted set,
not a refreshed aggregate or unseen-kit qualification.

Captured variables that also name a group now receive a collision-free child
leaf (color/icon becomes color.icon.-value); descendants retain their paths.
Allocation reserves the complete capture inventory, is order-independent,
and retains original names, values, modes and explicit rename notes. Source
alias references use the same allocation. The synchronous proposal scope
saves/restores that mapping across nested proposals and later calls; root
text-template value validation receives the same resolver. Registration and
proposal no longer disagree or drop the base color. No source document edits.

Ten variable-name tests include prefix collisions, nested prefixes, distinct
base/descendant colors and modes, source immutability and subsequent-batch
isolation. Thirty-five name/template/paint tests, 122 exact-proposal checks,
typecheck and lint pass. No push or full fast lane. Unrelated native paint
and REST stroke edits remain parked. Replay input is the canonical 897 dump;
command: npm run figma:to-react -- --dump <modal-capture.json> --fonts
<authenticated-fonts.json> --out <output>. Evidence including package, receipt,
images, inputs and logs is V1 private group-prefix-900.

Historical forward 2112/6312 remains stale; reverse 2203 remain unqualified.
Next measure this shared fix on other affected composed sets and the fixed
cohort; do not add three to an aggregate with a different or stale population.
Remaining captured dependencies Chevron affine basis and Spinner varying arc
caps still refuse and are named in the public result.


## Experiment 901: shared-fix reach and regression replay, 2026-10-06

Replayed all 204 frozen REST captures through the headless public import engine
at f15122593. Compared with 894 census-final: source hashes identical, all
statuses identical (173 imported / 31 refused), all generated request hashes
identical. This is import/request regression evidence, not fresh visual
qualification. The richer Plugin capture, rather than the existing REST
snapshots, is required to exercise the new remote closure and variable paths.

Read-only live capture of ADS Figma parts / Button (Help), verified source ID
82097:79273, contains six variants and the same eight-definition dependency
closure as ModalFooter. The canonical reader completed in about two seconds.
The public command packages it, but its unchanged consumer check returns
**0 pass / 6 fail / 0 unverified**. React reports nested button elements on
every variant. The proposal names the outer wrapper button because its Figma
name contains Button; settleInteractiveContent only withholds structural
button guesses and deliberately leaves name-inferred ones. The inner linked
Button remains a button. Size also fails (42x11 versus 68x32); inspect the
rendering and layout independently rather than assuming semantic repair alone
will recover all six. The default triptych was inspected.

Next shared defect is invalid nested interactive elements from name inference:
retain explicitly authored semantics, but evaluate the evidence for withholding
name guesses when the real linked child owns the control. This is a diagnosed
product defect, not authorization to relax runtime or visual checks.
No implementation changes this turn. Durable V1 private composition-replay-901
contains capture, package, public receipt/images and the 204 request comparison.
Historical forward 2112/6312 remains stale; reverse 2203 remain unqualified.
ModalFooter 3/3 remains the only newly verified passing composition in 900–901.


## Experiment 902: inferred wrapper semantics and source disagreement, 2026-10-06

Name-inferred button roots now obey the same interactive-content guard as
structural guesses. A component containing an interactive descendant is
proposed as a div with an explicit inference-withheld note; the child control
is retained. Explicit design-side semantics stamps remain unchanged and
invalid nesting stays named. Snapshot evaluation preserves batch-order
independence, including cycles. Tests previously expecting invalid inferred
nesting were updated to this behavior, with explicit authored-semantics and
Help Button/linked Button regressions. This changes inference, not the checker.

The same Help Button public run eliminates both nested-button runtime errors,
but remains **0 pass / 6 fail** on image/size fidelity. ModalFooter remains
**3 pass / 0 fail**, unchanged 1.61–1.64% image differences. Twenty-one
interactive-content/padding tests, 122 exact-proposal checks, typecheck and
lint pass. All 204 frozen sources were replayed: 173 imported / 31 refused;
only Help Button's request hash changed. No new visual pass is claimed.

**Correction in experiment 903: the following source-disagreement inference
was wrong; the triptych consumer/reference order was misread.**
A read-only Desktop probe of source 82097:79274 observes a 68x32 root and
Button instance, with Container x=12,y=6 and 44x20 text. Its direct Plugin
PNG export visibly places the text like the generated React image. The REST
reference in the unchanged public receipt places text nearer the top-left;
it also differs in the border. REST bounds before/after agree at version
2407264290705923271, so that stability check alone does not establish agreement
with the Desktop Plugin capture. The cause (cloud rendering state, library
resolution or another export difference) is not yet proven. Native export
and provenance are diagnostic only; no PNG replacement or scorer change.

Next resolve Desktop-capture versus REST-reference agreement before treating
remaining Help Button pixels as converter defects. Preserve failed receipts.
Durable V1 private inferred-button-902 contains runs, 204 comparison, tests,
and native export. Historical forward 2112/6312 stays stale; reverse 2203
remain unqualified. No push or full fast lane.


## Experiment 903: preserve implicit root alignment, 2026-10-06

Correction to 902: the triptych order is consumer, Figma, difference. I read
it backward and incorrectly attributed React's shifted text to REST. The
standalone REST image and Desktop export both show the centered text; the
consumer was shifted. Their PNG bytes/pixels are not identical (405 RGBA
pixels differ at matching 68x32 dimensions), so this is not a claim of exact
source equality, but the asserted positional disagreement was false. No
reference replacement, rescore or threshold change was made.

Root center/center row layout is intentionally omitted by invertLayout when
it equals the generator default. carryChildPaintOrder subsequently created a
layout block containing only reversePaint, then generated multi-axis layout
rows with start/start fallbacks. That changed the drawn alignment. When this
pass materializes an omitted ROOT layout, it now restores the documented
row/center/center default before adding paint metadata. Explicit root layouts
and non-root part defaults retain their existing values.

The same public Help Button run improves **0/6 to 3 pass / 3 fail** with no set
problems: default 1.47%/1.47%, hover 1.88%/1.56%, press 1.79%/1.56% on white/black.
Focus remains 14.57%/14.47% with 72x36 versus 76x40 content extents; selected
8.09%/7.86%; disabled 7.54%/0% with 42x11 versus 68x32 extents. All text and text
styles pass. The default triptych was inspected in its correct order.
ModalFooter regression remains 3/3 passing. Neither result refreshes the full
scoreboard or establishes unseen-kit qualification.

Fourteen paint-order tests (including explicit centered-root tuple assertions),
122 exact-proposal checks, typecheck and lint pass. V1 private root-alignment-903
contains runs, source diagnostic correction, images and logs. No push/full fast
lane. Historical forward 2112/6312 stays stale; reverse 2203 unqualified. Next
inspect the remaining focus extents and selected/disabled instance paint
carriage rather than treating these three misses as alignment failures.


## Experiment 904: partially bound uniform stroke widths, 2026-10-06

The captured Button has width bindings on 35 of 144 variants. The other
109 have no stroke. The symbolic unifier cannot carry that partial domain,
while the literal path skipped the channel because a binding existed anywhere;
generated CSS kept the default zero stroke width. The shared fallback now
carries the complete observed uniform-width table only if no bound width was
successfully carried, no per-side weights exist, every stroked variant has a
finite nonnegative measurement, and every unstroked variant has neither a
width binding nor a contradictory nonzero measurement. Boolean axes remain
explicit. The proposal names that this provisional table retains values,
not original width-variable identity. No measured width is invented.

Help Button improves **3/6 to 5 pass / 1 fail**. Selected is 0.83% white /
0.87% black; disabled is 0% on both. Default, hover and press remain passing.
Focus still fails at 14.51%/14.47%, 72x36 versus 76x40 content extents.
ModalFooter remains **3/3**, now at 0.16–0.29% versus approximately 1.6% before.
The selected triptych was visually inspected. These are targeted runs, not a
refreshed aggregate; the Help Button set as a whole still fails.

Five stroke tests pass, including actual pixel assertions for all four tuples
on both CSS-module and inline React surfaces and a missing-measurement refusal.
The first new test used the wrong fixture token field (.tokens instead of
.tree), was corrected, and rerun. 122 exact checks, typecheck and lint pass.
No push/full fast lane. V1 private partial-bound-stroke-904 contains both
public runs, packages, receipts, images and logs. Historical forward
2112/6312 stays stale; reverse 2203 remain unqualified.

Next inspect the empty FocusRing dependency: the captured instance is 72x36
at (-2,-2), with an outside 2px stroke. The generated parent sizes a wrapper,
while its empty FocusRing child retains fit-content dimensions and lacks root
size inputs. Verify that path before changing geometry or accepting the set.


## Experiment 905: empty-container resize capability, 2026-10-06

Fresh generated empty container roots now receive the same validated root
inputs as containers with parts. The old parts-required guard excluded the
empty FocusRing main even though it owns and forwards its root styles.
Supplied/stamped APIs, non-container roots and unobservable imports retain
existing exclusions. The new test verifies explicit keyed resize carriage,
source immutability, stamped/unobservable exclusions and continued refusal
of a stretch constraint as a fixed local width.

Help Button remains **5 pass / 1 fail**; no accepted-set or variant gain.
The parent captures a 72x36 FocusRing at (-2,-2), outside stroke 2px, with
horizontal STRETCH. The wrapper carries placement and size, while the empty
child retains fit-content. Declaring width/height inputs alone does not solve
it: carryInstanceRootInputs correctly refuses fixed widths for moving
constraints. Next implement/qualify child fill inside positioned wrappers,
with React and native resize behavior; do not force the observed width into
a dynamic stretch relation or remove the refusal.

The full instance-forwarding suite reports 81 pass / 1 fail. The failure is
fresh generated resize API preserves filled-path coordinate-basis validation
(expected opacity-only inputs, received width/height too). A baseline rerun
with only this turn's production change removed reproduces it, so it is a
pre-existing regression, not waived or rewritten. Exact checks (122),
typecheck and lint pass. No push/full fast lane; the suite is not green.
V1 private empty-root-resize-905 contains public receipt/package, full tests
and baseline failure. Historical forward 2112/6312 stays stale; reverse 2203
remain unqualified. Parked native-paint and REST-stroke changes are preserved.


## Experiment 906: verify the resize guard instead of reverting it, 2026-10-06

The 905 forwarding-suite failure was an obsolete expectation, not a newly
proven unsafe resize. Commit 81d8141f6 deliberately permits width and height
on a root whose paths retain an independently captured proportional parent
viewport. The test still expected the prior opacity-only input list.

Updated the test with stronger behavior evidence: mount the generated glyph
on both CSS-module and inline React surfaces at 24x24, 48x72 and 36x12. Assert
the root box and the path's relative x/y, width and height against the original
24x24 source basis (path x=3,y=4,width=12,height=8), tolerance 0.02px. A padding
input still must fail coordinate-basis/auto-layout validation. All six resized
renderings agree; the full forwarding suite is now **82/82**. Typecheck and
lint pass. Production validation and scoreboard checks were not changed.

No new visual pass: Help Button remains 5/6; ModalFooter last verified 3/3.
Historical forward 2112/6312 is stale; reverse 2203 unqualified. V1 private
resize-guard-906 contains focused/full test and check logs. No push/full fast
lane. Next qualification remains FocusRing child fill inside an absolute
wrapper; preserve the source stretch relationship and native behavior.

## Experiment 907: direct generated-instance geometry, 2026-10-06

Help Button's focus failure came from a positioned wrapper sizing an empty
fit-content FocusRing child. Qualified generated children now own the existing
absoluteGeometry carrier directly when their declared root inputs include
width and height, their source key matches, and their captured local size and
identity transform agree with the absolute box. Unknown identity, rotated or
inconsistent local geometry, and competing fixed root extents retain refusal
or the existing wrapper fallback. The 0.001px identity comparison accommodates
observed float32 representation; visual checker thresholds are unchanged.

The shared validator permits this carrier only for generated single-root
children without runtime bindings or style/className API collisions. Both
React surfaces forward host geometry. A new browser resize test caught that
inline React skipped the base geometry of component references; that branch
now uses the same geometry normalizer. Browser CSS-module and inline outputs
and the native compiler fixture agree at 68x32 and 108x52 parent sizes. The
native fixture is compiler regression evidence, not live Figma qualification.
Source mutation, missing API, inconsistent identity/size and rotated-basis
checks accompany the positive proposal test.

Public Help Button improves **5/6 to 6/6**, no set problems. Focus is
4.61% white / 4.57% black. ModalFooter remains **3/3**, 0.16–0.29%.
The focus triptych was inspected (consumer left, reference middle): corner
rounding still differs and the pass is near the existing threshold. This is
not a perfect match or an unseen-kit qualification. No scorer changes.

V1 private direct-instance-geometry-907 retains public runs, packages, images
and check logs. Historical forward 2112/6312 remains stale; reverse 2203 remain
unqualified. No push/full fast lane. Next measure transfer of these shared
composition fixes beyond these two sets before claiming broader velocity.

907 validation: 90/90 combined absolute-geometry and instance-forwarding tests,
122 exact proposal checks, typecheck and lint pass. Parked native-paint and
REST-stroke changes remain unstaged.

## Experiment 908: test transfer to the full captured Button, 2026-10-06

Selected the already captured ADS Button dependency as the public command's
root, preserving node data, variables and source IDs. The derived dump records
its original capture hash and root selection; this is a replay of observed
source, not a fresh or never-seen kit. Public outcome: **0/144 pass**, all
verified failures, with children-accepted-but-discarded as a set problem.
907's Help Button 6/6 cannot be generalized to the whole Button family.

Failure classes overlap: 118 size mismatches, 128 white-background layout
image misses, 112 black-background layout image misses, 72 missing-content
cases and 10 no-subject-paint framing refusals. Every loading variant lacks
Spinner animation content. Its changing arc sweep with explicit NONE caps is
refused by ellipse-arc-cap-varying-sweep-unqualified. Do not remove that guard
without proving both React and native behavior.

The repeated 12px width deficit has a concrete shared cause: bound horizontal
padding varies with Boolean isLoading, so unifyRefs names but drops it.
Generated CSS has no horizontal padding and browser button defaults contribute
6px per side where the source draws 12px. This explains why child instances
with captured root overrides can pass while the main family fails. Prioritize
carrying these observed Boolean-dependent bindings without inventing values
or replacing the Boolean API. The generated props bug is separate:
refuseUnrenderedChildren matches the word children in styles.children although
the JSX renders label, so it accepts caller children and discards them.

V1 private button-transfer-908 contains derivation, public package, receipt,
images and aggregate failure classes. No production change or new accepted
variant this turn; the experiment changes the next action to shared bound
padding before further individual-component tuning. Global scores unchanged:
2112/6312 historical forward is stale; reverse 2203 unqualified. No push.

## Experiment 909: retain Boolean-dependent token bindings, 2026-10-06

unifyField now carries fully observed Boolean VARIANT binding correlations
through existing tokensByProp, preserving both token identities and the
Boolean API. Opacity retains its established named literal path. Validation
admits Boolean VARIANT props; CSS root and nested token rules use the same
Boolean selectors as substituted tokens. Optional Boolean omission remains
distinct from false. No new contract channel or scorer change.

Public replay of the same 144 captured ADS Button variants improves from
**0 pass / 144 fail to 70 pass / 74 fail**. Size mismatches fall **118 to 2**;
white layout-image misses 128 to 7, black 112 to 4. All 72 loading variants
still miss Spinner animation content. The two non-loading failures are subtle
appearance/default state at default and compact spacing, 7.34% white image
difference. The set still fails children-accepted-but-discarded. This is a
variant gain, not an accepted component set or unseen-kit score. The primary
button triptych was inspected. Help Button remains **6/6** and ModalFooter
**3/3** under the same public command and fonts.

Tests retain source token identity, compare root and nested padding through
false/true/false transitions in CSS-module and inline React, verify native
compiler variable bindings, and reject partially observed bindings. The old
exact-check assertion that Boolean padding must be refused was replaced with
explicit false/true token resolution. 11 padding/multi-axis tests, 28 optional
Boolean/unset tests, 122 exact proposal checks, typecheck and lint pass.
The final padding fixture rerun passes after correcting its typed sizing data.

V1 private boolean-bound-padding-909 holds public receipts, packages, images,
comparison and check logs. Historical forward 2112/6312 remains stale; reverse
2203 unqualified. No push/full fast lane. Next fix the independent children
API defect, then the Spinner dependency that blocks 72 variants. Parked
native-paint and REST-stroke work stays unstaged.

## Experiment 910: track caller children use during emission, 2026-10-06

The generated Button rendered label in styles.children. The emitter's word
search counted that CSS member as caller-children consumption, leaving the
inherited React children API open although caller content was discarded.
Consumption is now tracked while emitting property references, slots, text
content, component argument mappings and the explicit empty-root fallback.
CSS names and literal text no longer imply caller binding use.

An initial attempt to refine the word search rejected Icon's real conditional
slot. Its package compilation failure was retained, and the heuristic was
replaced rather than waived. Tests cover misleading class/text names, actual
children-bound text, slots and conditional default content; real consumer
TypeScript accepts supported children and rejects unsupported children.
83 instance-forwarding tests and six final children tests pass; typecheck and
lint pass. The public package builds and installs successfully.

Public Button remains **70 pass / 74 fail**, now with **no set problems**.
The children behavior receipt reports contractDeclaresSlot=false,
renderedAtRuntime=false, refusedByType=true. No image threshold or checker
change. This fixes the generated API but adds no visual pass. Help Button 6/6
and ModalFooter 3/3 remain last verified in 909, not rerun here.

V1 private children-binding-910 preserves failed and final runs, generated
packages and checks. Historical forward 2112/6312 remains stale; reverse 2203
unqualified. No push/full fast lane. Next address Spinner animation's varying
stroked arc, which blocks content in all 72 loading Button variants.

## Experiment 911: variant stroked arcs restore Spinner content, 2026-10-06

Extended the existing arcByCombination carrier to complete tables of explicit
NONE/ROUND/SQUARE capped partial strokes (innerRadius 1), retaining the filled
donut form. Mixed forms, incomplete/conflicting tuples and unsupported arc
compositions refuse. The importer carries captured sweeps/caps instead of
refusing all changing capped arcs. React selects the exact row and refuses a
missing row; native compilation already resolves the same geometry table into
editable ellipse arcData. No first-frame fallback or scorer change.

Button improves **70/144 to 126 pass / 18 fail**, no set problems. All missing
Spinner-content failures disappear. This 87.5% is a replay of a captured family,
not an unseen-kit qualification. The remaining cases are 16 loading variants
and the same two non-loading subtle defaults. Failure classes overlap: 17
white-image misses, 14 black-image misses and six size mismatches.

A standalone replay of all 40 captured Spinner animation keyframes passes
**0/40** (40 white/black image misses, 11 size mismatches). This is important:
restoring content inside a larger Button is not standalone fidelity. The
source explicitly captures CENTER stroke alignment, which the current
proposer names but lowers to an inward border. For the 96px keyframe the
centerline is 87.04px with 8.96px stroke; inward output shrinks the painted
extent. The inspected triptych confirms the radius mismatch. Next carry this
alignment faithfully across React and native emission; do not claim Spinner
is qualified or weaken the small-shape image check.

Seven arc tests pass: dynamic sweep/cap changes on both React surfaces,
complete source-table preservation, missing-row/refusal cases, native compiler
geometry and actual ellipse creation in the native mock. The existing
independent native arc/cap readback test passes. These are regression checks,
not live reverse-scoreboard evidence. 122 exact proposal checks, typecheck,
lint and schema freshness/site introspection pass. Both schema projections
and the existing spec page document the expanded row form.

V1 private stroked-arc-911 holds initial build failures and final receipts,
packages, source derivation and logs. Historical forward 2112/6312 remains
stale; reverse 2203 unqualified. Help 6/6 and ModalFooter 3/3 last verified in
909. No push/full fast lane. Parked native-paint and REST-stroke work preserved.

## Experiment 912: explicit capped-ellipse stroke alignment, 2026-10-06

Constant arcs and arcByCombination rows now carry captured INSIDE/CENTER/
OUTSIDE alignment. Absence keeps legacy inward behavior. The React SVG uses
the measured ellipse edge as the CENTER centerline, retaining the original
layout box; OUTSIDE and INSIDE offset that centerline by half the width.
Native generation sets strokeAlign from the same resolved arc, and independent
readback now rejects alignment corruption as well as cap/angle changes.
The proposer retains source alignment without modifying the dump and no
longer emits a false approximation note for this qualified capped-arc path.

Standalone captured Spinner improves **0/40 to 6 pass / 34 fail**. Its size
mismatches fall 11 to six. Button remains **126 pass / 18 fail**, no set
problems. This is genuine geometry carriage but does not qualify Spinner.
The 96px eighth-keyframe triptych now has the correct painted extent, yet
its orientation differs: the source rotates -90 degrees and the consumer
keeps the first orientation. The proposer explicitly drops combined placement/
rotation because position varies by Size and rotation by Keyframe, rather
than one enum axis explaining both. Next carry those independent relations
without losing the source constraints; do not tune individual keyframes.

Eight arc tests pass, including preserved source alignment, both React
surfaces at all three alignments with unchanged layout extent, and native
creation. The prepared-native independent readback test now exercises inside,
center and outside cases and catches mutated alignment. 122 exact checks,
typecheck, lint and schema freshness/site introspection pass. The existing
spec page and both JSON-schema projections describe alignment. An initial
package TypeScript widening failure was fixed and retained in evidence.

V1 private arc-stroke-alignment-912 holds packages, receipts, source comparison
and test logs. Only this turn's native-emitter hunk is staged; the parked root
paint work remains unstaged. No push/full fast lane. Historical forward
2112/6312 remains stale; reverse 2203 unqualified. Help 6/6 and ModalFooter 3/3
last verified in 909.


## Experiment 913: independent ellipse placement and rotation, 2026-10-06

The importer required one enum axis to explain placement and rotation together.
Spinner's placement changes with Size while rotation changes with Keyframe, so
it dropped both. Complete captured geometry now carries ellipse placement and
size while a separately proven enum correlation carries pure rotation through
existing stylesWhen. Explicit zero-degree rows reset runtime state. No new
contract field, capture mutation, threshold or scorer change.

The existing geometry validator permits only pure rotation in ellipse
stylesWhen, continuing to reject competing transforms and transformed parents.
Native placement converts the center-preserving box to Figma's rotated local
origin. Native draft qualification admits this captured ellipse case, and
independent readback checks both the resulting coordinates and rotation.

Public Spinner improves **6/40 to 20 pass / 20 fail**, with all six size
mismatches eliminated. Button changes **126/144 to 125 pass / 19 fail**:
subtle/focus/default/loading crosses the white-image limit at **5.09%**.
Both have zero set problems. Net gain is 13 passes across these captured
replays, not unseen-kit qualification. The remaining Spinner failures are
20 white-image and 14 black-image misses; the smallest first-keyframe crop
compares only four painted pixels and differs on two. No metric waiver.
The 16px eighth-keyframe comparison still shows a stroke/raster discrepancy.

38 focused arc, absolute geometry and prepared-native tests pass. The new
asymmetric ellipse fixture checks both generated React surfaces through
size/keyframe changes and native creation; independent readback rejects
corrupted rotation and center placement. 122 exact proposal checks, typecheck
and lint pass. Initial fixture setup failures were corrected; actual native
draft refusal required explicit captured-ellipse qualification.

V1 private independent-rotation-913 preserves public packages, receipts,
comparisons and logs. Historical forward 2112/6312 is still stale; reverse
2203 remains unqualified. Help 6/6 and ModalFooter 3/3 last verified in 909.
No push/full fast lane; parked native-paint and REST-stroke work preserved.
Next inspect small-arc paint differences and the newly failing loading Button,
then test transfer beyond this source family before claiming broad progress.


## Experiment 914: authored fractional SVG stroke widths, 2026-10-06

Chromium resolves a 1.493333339691162px CSS border to 1px, including through
computedStyleMap. The arc runtime used that snapped value as SVG stroke width,
losing the captured fractional paint. React CSS now mirrors authored width
declarations into an internal custom property when arcs are present, retaining
the same cascade across axes/states/token changes. The runtime resolves the
width on SVG, which retains fractions. Inline generated styles already carry
authored widths. Browser border measurements still position the SVG in its
layout box; only SVG paint uses the unsnapped width.

Public Spinner improves **20/40 to 21 pass / 19 fail**; Button recovers
**125/144 to 126 pass / 18 fail**. The prior subtle/focus/default/loading
regression now measures 4.91% white and 4.78% black. Both have no set problems.
No thresholds, scorer, source capture or native output changed. These remain
captured-family replays, not unseen-kit qualification.

Ten arc tests pass, including fractional token widths, Boolean token overrides,
false/true/false transitions, live module token changes and inline width
updates on both generated surfaces. Typecheck, lint and 122 exact proposal
checks pass. The initial test used an unsupported stylesWhen width channel;
it was corrected to the existing Boolean tokensByProp channel, without
changing the validator.

V1 private fractional-arc-stroke-914 preserves packages, comparisons and logs.
Historical forward 2112/6312 remains stale; reverse 2203 remains unqualified.
No push/full fast lane. The plugin reader still rounds arc angles/radius to
two decimal places (dump.plugin.js), unlike the REST ellipse reader. Check
that loss against fresh source data before attempting more raster changes;
then measure transfer outside this family. Parked work is untouched.


## Experiment 915: source precision is real loss, not the next pass gain, 2026-10-06

A read-only live Plugin API inspection confirmed the first Spinner arc starts
at 4.71238899230957 and ends at 4.974188327789307, while the canonical reader
emits 4.71 and 4.97. Its dimensions, rotation and placement also round to two
decimals. Tested a reader candidate that retains those values, adding a full
plugin-mock precision/source-immutability test alongside the existing REST arc
precision tests. Eight combined capture tests and typecheck pass.

The candidate reader captured all 40 variants fresh from the ADS source file.
Comparison with the prior captured set finds 330 changed values, all inside
shape geometry; no other set fields changed. Public replay yields **18 pass /
22 fail**, down from 21/40. Three marginal passes become failures: keyframe 1
at 48px (7.50% white), keyframe 1 at 96px (5.19% black), and keyframe 3 at 24px
(5.68% white). No threshold, scorer or source document was changed.

This rejects precision removal as a sufficient fix for current arc fidelity.
The candidate is preserved as private candidate.patch with the fresh source,
field delta, public package, receipt and logs in source-precision-915; its two
source-file edits were reversed, leaving the accepted engine unchanged. The
reader precision defect remains known, not declared solved. Do not invest
another local rendering cycle without stronger evidence of a shared gain.

Accepted captured replays remain Spinner 21/40 and Button 126/144 from 914;
the separate precise-source experiment is 18/40, not folded into that baseline.
Historical global forward 2112/6312 remains stale; reverse 2203 unqualified.
No push/full fast lane, no Figma writes, and parked changes preserved. Next
return to the existing dependency triage: missing shared definitions expose
51 sets/1103 variants; Primer Search spans five sets and is the next identity
check beyond the Atlassian family. Exposure is not recoverable-pass credit.


## Experiment 916: Primer dependency identity and fresh capture, 2026-10-06

Verified all five dependency-triage rows (28/29/30/31/33) against live Primer:
Danger Buttons, Primary Buttons, OverlayFooter, ActionMenu and TabNav all
resolve Search to the same remote COMPONENT, node 31742:155958, component key
44322ccf86837f04017bcf58f845a0959d262e3c. These five sets contain 52 variants;
that is exposure, not recoverable-pass credit. The component REST endpoint
returns 403 and the component-set endpoint 404. It is a standalone component,
not an inaccessible variant set to guess from its label.

The Primer Desktop Bridge was not connected. Opened the existing accessible
Community copy and launched the already-installed bridge through Figma UI.
Read-only canonical capture with dependencies recovered the complete remote
Search vector and CounterLabel for both five-state button families. The public
command proposes all three definitions with no skipped dependencies or set
problems, confirming existing remote-main snapshot handling transfers beyond
Atlassian. No engine patch or source-document edit was needed.

Public results: Danger **0 pass / 5 fail**, Primary **0 pass / 5 fail**.
Every case names unavailable SF Pro Text and a width mismatch (126 vs 131px),
plus image misses. Both consumers report no missing text or icons. Checks of
installed system/user font directories, Downloads and the existing private
font inputs found SFNS system fonts but no exact SF Pro Text files. Do not
alias another family or waive the font check. The pre-existing font prerequisite
also affected Primer Loading; this is not a newly solved conversion failure.

Evidence in V1 private primer-dependency-916 contains live five-set identity,
REST statuses, canonical dumps, packages and public receipts. Historical global
forward 2112/6312 remains stale; reverse 2203 remains unqualified. Spinner
21/40 and Button 126/144 remain last checked in 914. No code tests needed for
this read-only experiment, no full fast lane or push. Next use the existing
MUI dependency triage (IconButton across three sets) with available Roboto,
while exact SF Pro Text remains a prerequisite for Primer visual qualification.


## Experiment 917: MUI dependency preflight and rejected default-only fix, 2026-10-06

Canonical live MUI capture separates two blockers. CardHeader fails on remote
Badge, node 6785:118095: its declared Cartesian domain contains 14 combinations
but the captured set has 13. The reader now names the dependency, node, reason
and expected/observed counts. Qualification is unchanged; no missing combination
is invented. Five remote snapshot tests pass, including this diagnostic case.

ImageListItemBar captures with Aspect ratio, StarSharp, Icon and IconButton.
Baseline public result is 0/2, with zero-size render, missing InfoFilled, and
children-slot-discarded. A candidate qualifies runtime variant defaults using
matching instance/main/set/file witnesses and uniform applied properties,
bridging Figma's component default ID to the contract's component-set anchor.
Slot tests, 93 related tests, 122 exact checks, typecheck and lint pass.

The public candidate remains **0/2**: zero-size render and the set problem
remain. Its content check changes to no missing parts, but generated IconButton
renders StarSharp rather than the source InfoFilled. This is not a content
success. Preserve this counterexample for checker accuracy; do not loosen any
check. Source Aspect ratio 6:7 also contains nested empty auto-layout frames,
including a rotated ratio keeper, without captured geometry sufficient to
reproduce its 280px height. Do not replace that missing evidence with guessed
fixed dimensions or ratios inferred from display names.

The default-only candidate is saved in private mui-dependency-917 as
variant-default-candidate.patch and reversed from the engine. Its capture,
both public packages/receipts, generated output and check logs are preserved.
Only actionable remote-refusal diagnostics are accepted. Next resolve nested
instance selection and ratio-frame capture before retrying the candidate;
this experiment earned no new conversion passes. Historical forward stays
2112/6312 (stale/mixed); reverse 2203 remains unqualified. No full fast lane,
no push, no Figma source writes; parked changes are preserved.


## Experiment 918: retain actual nested dependency definitions, 2026-10-06

Live read-only MUI inspection proves ImageListItemBar's IconButton contains an
Icon instance whose own Icon Instance property selects InfoFilled, component
6786:36496 / key 10cf7c0ebfe58aec73673fa0df2742547f94c496. The outer
IconButton exposes only Size/Color/State, so following only its main and its
own swap properties misses the replacement. Dependency traversal now visits
nested instance children too, under the existing node/set budgets and identity,
name and cycle checks. This inventories dependencies; it does not authorize
applying arbitrary internal overrides.

Fresh canonical capture adds exactly InfoFilled plus closure provenance. All
previous component sections, variables and degradations are unchanged. The
batch proposer accepts all six definitions with no skipped dependencies when
provided the captured file identity. A first standalone diagnostic omitted
fileKey and correctly refused remote witnesses; correcting that invocation
resolved the diagnostic, without changing qualification code.

Seventeen selection/capture tests pass, including a replacement that exists
only inside the outer usage, source immutability, and an unreadable nested
main. The old remote-refusal test expected a retired error name; it now asserts
the current remote-set snapshot refusal. Typecheck and lint pass. A second live
family, Custom Table Toolbar, refuses Select node 6785:22719: 120 declared
combinations versus 72 observed. CardHeader's Badge refusal remains the third
family's known blocker. No domain guard is weakened.

Evidence is in V1 private mui-nested-dependency-918. This fixes missing source
inventory, not generated caller selection or ratio geometry; no new visual
passes are claimed or expensive unchanged rendering replay performed. Public
ImageListItemBar remains last measured 0/2 in 917; global forward 2112/6312
remains stale/mixed, reverse 2203 unqualified. Next carry identity-qualified
nested selected content into the caller and capture rotated empty-frame
geometry. Candidate 917 stays archived, not accepted. No push/full fast lane;
parked changes and community source files remain untouched.


## Experiment 919: capture nested property selection authority, 2026-10-06

Inspection of generated IconButton confirms it has no caller-facing icon slot:
it passes StarSharp into its internal Icon. Dump hostOverrides previously only
said that Icon's componentProperties changed, discarding the property values.
Dependency recovery alone therefore cannot reproduce the selected InfoFilled.
Do not reinterpret the outer default or replace the shared main's StarSharp.

The Plugin reader now adds instanceProperties to the affected host override:
outer occurrence/main identities, nested occurrence/main/set identities, numeric
child path, and exact typed property names/values. INSTANCE_SWAP values include
the independently resolved selected component ID/key. Missing owner/main/swap
identity, unsupported property types, malformed values or unrelated/deep paths
refuse the property witness; the override remains named. These observations do
not themselves authorize promoting a child API or applying an override.

Fresh canonical MUI capture yields two witnesses, both at child path [0], with
Icon Instance#10003:412 selecting 6786:36496 / key
10cf7c0ebfe58aec73673fa0df2742547f94c496, Size Medium and Type SVG Icon.
Removing only the new instanceProperties fields makes the capture byte-value
identical to 918. Fifteen focused tests, typecheck and lint pass. Tests cover
all four property types, duplicate names, source immutability and missing or
malformed identity/value cases; live capture verifies the integration branch.
The REST reader has not gained this optional observation field yet.

V1 private mui-nested-properties-919 retains fresh capture, exact delta and
validation logs. No visual replay: generation does not yet consume these facts.
Next qualify the nested source path against the linked child's anatomy and
route selected caller content through an explicit generated input; then address
ratio geometry. Forward historical 2112/6312 remains stale, reverse 2203
unqualified, ImageListItemBar last measured 0/2. No new passes claimed, no push,
no full fast lane, no source Figma edits; unrelated parked changes preserved.


## Experiment 920: browser proof for nested slot routing, 2026-10-06

The source census confirms all 135 IconButton variants have the same first
Icon instance set, Size Medium, Type SVG Icon and StarSharp fixed swap. The
generated contract has one corresponding Icon component and one selectedContent
part. This establishes a candidate path for promotion; it does not yet prove a
general inference rule or authorize matching arbitrary parts by display name.

Ran an explicitly authored feasibility prototype on contracts proposed from
919's capture. Temporarily restored the archived 917 variant-default candidate,
then replaced the generated button's internal StarSharp component part with a
runtime-default named slot. The parent supplies InfoFilled through this slot
inside its omitted-action fallback. The existing schema and contract validator
accept the result; no schema expansion is required.

Compiled the generated React modules and mounted them in headless Chromium.
Checked actual SVG path data: parent omission renders InfoFilled and no StarSharp;
explicit null/false/empty action renders no glyph; omission restores InfoFilled.
Mounting the shared IconButton separately still renders StarSharp and no Info.
The first probe invocation omitted the CSS generator's required error-array
argument; corrected the invocation and reran successfully. CSS token resolution,
paint fidelity, dimensions and native round-trip were NOT qualified by this
content-routing probe. In particular the Info usage's white paint and the ratio
layout remain outstanding. Do not count this as a production or visual pass.

The probe, candidate contracts, validation result and browser outcome are saved
in V1 private mui-nested-slot-probe-920. Its temporary repo script is removed
and 917's engine candidate reversed; production behavior remains unchanged.
Next implement identity-qualified promotion and caller routing using this existing
slot representation, with negative tests for ambiguous paths, varying selections,
and supplied/stamped child APIs. Then verify paint and layout in the public
command. Historical forward 2112/6312 stale/mixed; reverse 2203 unqualified;
MUI last measured 0/2. No push/full fast lane or Figma edits.


## Experiment 921: automatic nested selection routing, 2026-10-06

Implemented the 920 representation in the batch proposer. Identity-qualified
variant defaults now resolve the component ID against matching usage/main/set/
file witnesses rather than incorrectly comparing it only to a set anchor.
Nested selection routing verifies the owning main and numeric path, the nested
main/set identities, uniform applied values, and the same unique nested API and
fixed default across every captured owner variant. It only promotes fresh
unstamped generated APIs; supplied APIs, ambiguous/occupied routes, incomplete
usage evidence, differing selections and conflicting family members refuse.

The new generated slot retains the original default component, including its
size override, in fallback anatomy. The parent supplies the selected standalone
component only inside its omitted-action fallback. Multiple callers can reuse
the same promoted slot. No display-name guess or shared-main default replacement
is used. Native callerSlotSpec now replaces explicit runtime fallback children
with caller content while preserving the slot's own box and visibility; it still
refuses other existing anatomy. The prior guard incorrectly rejected runtime
fallback parts that React already replaces on explicit input.

Automatic Chromium replay on the actual captured MUI contracts proves InfoFilled
path data (not StarSharp) appears for the parent, explicit null/false/empty clears,
and the shared button still defaults to StarSharp. Native mock readback on a
focused fixture independently proves selected content in the parent and default
content in the shared main. This is not a live reverse qualification. 125 focused
tests pass, including refusal cases and reusable caller routing; 122 exact checks,
typecheck and lint pass. Initial probe/test invocation issues and invalid mock
fixture names/root-slot shape were corrected before the successful runs.

The first public replay exposed an overly broad supplied-ID guard: an unrelated
repo component with the same normalized ID prevented promotion. Protection now
uses the same ID/key semantics as existing fresh-module API declarations; same-key
or unanchored supplied APIs remain protected. The corrected public replay emits
the automatic Info route but remains **0/2**, with zero-size-render and
children-slot-discarded. Icon paint is still independently unqualified. No score,
threshold or source design changed; this fixes content routing, not whole-component
fidelity. V1 private mui-nested-routing-921 stores both public attempts, browser
probe/contracts, logs and receipts. Historical forward 2112/6312 remains stale,
reverse 2203 remains unqualified. Next capture and reproduce the ratio keeper's
layout, then verify icon paint. No push/full fast lane; parked patches preserved.


## Experiment 922: recover rotated auto-layout source geometry, 2026-10-06

Live MUI inspection explains the zero-height render. Aspect ratio 6:7 has three
nested rotated auto-layout frames. The innermost has local width
0.00019999999494757503 and fixed local height 239.9999542236328; its rotation
contributes 143.36301757405408px to its parent's HUG height. The next rotations
contribute 230.69348850384358px then 280.0001786440612px. Each differs from its
observed parent height by less than 0.00001px. Names or screenshot dimensions
are not needed to explain the source allocation.

The reader previously omitted these rotations and their local size channels.
It now retains nativeFlowGeometry for rotated, in-flow auto-layout FRAME nodes:
node/parent identities, exact local and parent sizes, relative matrix, both
sizing modes, primary/counter sizing and grow/alignment. Invalid geometry,
missing sizing facts, absolute placement, ordinary unrotated frames and instances
do not receive this field. This is observation only: a captured HUG/FILL extent
must not become a fixed-size instruction. Existing fixedSize behavior and named
rotation-unsupported degradations remain unchanged until a lowering is proven.

Fresh canonical capture adds 53 geometry records. Removing only these fields
makes the dump identical to 919. Eight focused capture tests pass, including
local precision, the rotated-bound height calculation, source immutability and
negative cases. Typecheck and lint pass. V1 private mui-flow-geometry-922 holds
live inspection, capture, geometry audit and logs. REST does not yet capture
this optional field; neither emitter consumes it yet.

Next implement/verify affine flow allocation while retaining HUG/FILL semantics;
the existing fixed owned-affine carrier explicitly refuses this dynamic layout.
Do not substitute fixed snapshot dimensions or infer aspect ratios from labels.
No visual rerun while generation is unchanged. MUI stays last measured 0/2;
historical forward 2112/6312 remains stale/mixed, reverse 2203 unqualified.
No full fast lane/push, no community edits, parked patches preserved.


## Experiment 923: prove responsive ratio lowering in live Figma, 2026-10-06

Used the approved DS Contracts Live Testing file, existing page 157:67106,
with a separate section 158:67142 named Rotated flow experiment 923 below
existing content. Community sources remain read-only. Reconstructed the four
empty source frames from 922's exact local sizes, rotations, auto-layout modes,
grow and alignment; no component or source document was edited. The test roots
158:67143 / 158:67147 / 158:67151 at widths 120 / 240 / 480 have heights
140.0001983642578 / 280.00018310546875 / 560.0003051757812.

The innermost frame's local height follows the parent width even though its
reported layoutSizingVertical is FIXED: STRETCH and its own horizontal
counter-axis determine the actual layout. Do not infer a fixed 240px constant
from that enum alone. This live result rejects the earlier affine-plus-fixed-
intercept interpretation as a general resize model. All three empty rotated
frames compose a responsive ratio spacer at the tested widths.

The installed Figma Plugin API documents lockAspectRatio/targetAspectRatio and
supports it live. Created an independent parent 159:67155 and spacer 159:67156
in the same section, sized 240x280 then locked before FILL. Resizing its parent
to 120 / 240 / 480 produces exact 140 / 280 / 560 heights, retains the target
ratio {x:240,y:280}, and differs from reconstructed source by under 0.001px at
all three widths. Before/after screenshots were inspected; source geometry and
native lock measurements are preserved in V1 private mui-ratio-resize-923.

This changes the implementation choice: qualify a neutral rotated-frame ratio
from captured matrices/layout authority, lower it to responsive CSS aspect-ratio,
and update the native aspect path to use a real lock. The current emitter's
ASPECT_MISS claim that canvas has no aspect-ratio field is obsolete; it currently
freezes height and names loss of resize behavior. Do not extend the much larger
general affine-flow schema just to preserve invisible ratio-helper frames.
No production renderer changed in this experiment, so there is no new visual
pass. MUI remains last measured 0/2; forward 2112/6312 stale/mixed; reverse 2203
unqualified. No push/full fast lane, no source-kit edits; evaluation node IDs
are retained above for independent readback and eventual cleanup.


## Experiment 924: native ratio locks and independent readback, 2026-10-06

Known-width root/frame aspect ratios now seed their height and call Figma's
lockAspectRatio API. Explicit heights retain precedence. Unsupported geometry
still produces a named limitation; dynamic FILL without an independently known
width is not newly supported. No ratio is inferred from labels or snapshot boxes.
The runtime rejects missing APIs and malformed/mismatched targetAspectRatio.
Independent inventory captures targetAspectRatio, and prepared-library and
comparison verification require the intended positive finite ratio. A removed
lock with unchanged initial dimensions therefore cannot pass structural readback.

The emitted helper was exercised on Live Testing parent 159:67155 / child
159:67156. Parent widths 120, 240, 480 produced child heights 140, 280, 560 with
the ratio retained. This is a live helper experiment, not a complete generated
component qualification; the mock deliberately models only API state, not native
responsive layout physics. Evidence and generated helper are in V1 private
mui-native-ratio-924. 58 focused native tests, typecheck and lint pass, including
lost/changed/invalid-lock refusals and explicit-height precedence.

This closes the native half of the proposed ratio lowering. The Figma importer
still does not derive ratios from the rotated helper geometry, so MUI remains
last measured 0/2; historical forward 2112/6312 is stale/mixed and reverse 2203
remains unqualified. Next implement the source-qualified forward lowering and
measure its effect before expanding it. No push or release; parked changes
remain separate. No new full scoreboard or conversion gain is claimed.

The expanded npm exact-proposal check exposed two paint-related failures:
conditional-outline.test.ts expects ExactProjectionError for illegal-ref, and
draft-paint-child.test.ts expects public-binding-recreation-unqualified but gets
solid-fill-composition-child-stacking-unqualified. Their baseline status has not
yet been established; the whole tree is not claimed green. The focused native
checks above are separate from this broader result.


## Experiment 925: responsive forward ratios remove MUI zero-height failure, 2026-10-06

A neutral rotated-flow recognizer derives the owner height/width coefficient
from local transforms, primary-axis HUG, counter-axis STRETCH, node identities,
and corroborating local/parent sizes. It rejects painted/content-bearing helpers,
controls, padding, non-orthonormal transforms and inconsistent geometry. It does
not read labels or bbox proportions. Single-child spacing has no effect; the
first candidate incorrectly required zero spacing and therefore retained the
old anatomy. The corrected candidate accepts all 25 captured MUI ratio variants.
Empty HUG residue is bounded at 0.0021px and disclosed, not promoted into a fixed
height. The owner paint remains; only fully neutral helper children are removed.

Uniform ratios use declared aspect-ratio; a fully covered enum axis uses the
conditional literal-style vocabulary, now including aspect-ratio. Native known-
width compilation resolves the same enum branch. Dynamic no-known-width native
geometry remains a named limitation. This implementation handles eligible roots;
other unsupported anatomy is preserved. Existing native ratio locks and explicit
fixed heights prevent this inference.

Public corrected replay on the unchanged 922 capture now has TWO PASSING VISUAL
ROWS: Right 1.03% white / 0.77% black; Left 1.04% / 0.77%. Both text, text-style,
icon and size checks pass. Before this lowering, both rows were zero-size-render.
The set still FAILS children-slot-discarded, so qualified set acceptance and the
overall first-pass scoreboard have NOT increased. Inspection finds the checker
currently treats any named slot as React children and injects children even when
the generated API explicitly refuses it. The actual API has action2:ReactNode.
No checker or acceptance threshold was changed in this experiment. Next establish
named-slot replacement behavior independently before changing any checker logic.

Actual generated AspectRatio React/CSS was rendered for all 25 variants at widths
120, 240 and 480: all 75 heights agree with their derived ratio within 0.02px.
This responsive browser probe is separate from whole-kit visual qualification.
29 focused tests, schema freshness, typecheck and lint pass. The expanded 924
regression run has finished: 890/898 pass, with EIGHT failures (conditional paint,
Carbon refusal ordering, REST side strokes/stroke layout/line-height/text resize,
and two visibility cases). Baseline status is unestablished; no full-green claim.
Historical forward 2112/6312 remains stale/mixed; reverse 2203 is unqualified.
Artifacts are in V1 private mui-responsive-ratio-925, including both public
attempts and the unchanged scorer receipts. Parked changes are preserved; no push.


## Experiment 926: verify the actual named-slot API, 2026-10-06

Installed the unchanged 925 tarball into an independent Vite consumer. Both
Action Position variants render action2 replacement content, remove the default
icon on replacement, clear it for null/false/empty, and restore it on omission.
Unrelated children are ignored at runtime and excluded from the public type.
The original checker incorrectly treated any slot as a children slot.

The checker now distinguishes declared children from named slots, probes each
named public prop, and records per-cell replacement and marker-clearing evidence.
Canonical ancestor visibility determines applicable cases; missing exercised
cases and unsupported state/repeat visibility remain named failures. A hidden
case is recorded rather than required to draw. Instrument tests prove a discarded
named prop and stale replacement content fail. This is a checker correction,
not a threshold change; historical failing receipts are preserved.

The new public clean-consumer replay passes 2/2 with zero set problems. Tarball
hash prefix 77f12a44eef1 is identical to 925. Image differences remain Right
1.0335% / 0.7740%, Left 1.0394% / 0.7740%; text, text-style, icon and size checks
pass. The layout fix produced the visual gain; fixing which API is exercised
removes the false set failure. This is captured-kit acceptance, not a new
never-seen-kit result or a retroactive correction of the historical scoreboard.
40 checker tests, typecheck and lint pass. Evidence lives in V1 private
mui-named-slot-926. The eight wider regression failures remain unresolved.
Historical forward 2112/6312 stays stale/mixed; reverse 2203 stays unqualified.
Next measure the unchanged fixed40 with the current committed code and explicit
font inputs. No release, threshold relaxation or source-kit edit occurred.


## Experiment 927: separate stale regression assertions from a real ordering defect, 2026-10-06

All eight 924 failures reproduce on the clean committed b2a068257 checkout,
without parked changes. Four expect REST dump 1.62 although the committed reader
is 1.63. One expects the former hidden-helper note rather than the current
non-rendering declaration. One expects the later Carbon binding refusal even
though the public stacking fence now refuses first. One treats @ in a Figma
variable name as an illegal token path, although captured-variable folding
escapes it. Updated these expectations without changing production acceptance:
the hidden helper must explicitly remain display:none, the Carbon public path
must still refuse, incomplete paint still cannot produce a partial map, and a
new positive test requires the escaped variable path to survive schema parsing.

The eighth failure is a product defect. CSS child paint/flow ranks used nth-child
against static anatomy indices. Conditional siblings disappear from the DOM,
so subsequent siblings receive the wrong rank. Stable direct-child part classes
now own the ranks. Generated component references receive their own part class;
the inline emitter also forwards their rank styles. The existing reversed-source
fixture now verifies correct label order on both React surfaces for all 32
source-order/prop combinations. Existing paint-order tests cover referenced
components, slots, overlap and variant permutations.

85 focused tests pass; typecheck and lint pass. The full exact-proposal suite is
running in /private/tmp/forward927/exact-full.log and is not yet claimed green.
No new conversion score is attributed to this repair until a measured replay.
The fixed40 run remains pinned independently to b2a068257 in
/private/tmp/ds-contracts-fixed40-926, with explicit font manifest, one request
lane and 15-second spacing; receipts are V1 private/beta-kits/fixed40-926.
It is a fresh fixed-sample run, not held-out qualification. Historical forward
2112/6312 remains stale/mixed; reverse 2203 remains unqualified. No push; parked
changes are preserved. Regression evidence is in V1 private flow-order-927.


## Experiment 928: preserve custom select-trigger content, 2026-10-06

The 927 expanded regression run completed: 899/899 tests pass. Its final log is
preserved beside the focused and clean-baseline evidence. This is regression
validation, not a conversion score.

The fixed40 Base UI Select/Trigger capture explains five missing-content cases:
the name table inferred native select, while the anatomy owns a custom Value
text node and caret component. Chromium suppressed that custom content. The
select/dropdown + trigger name rule now infers button before the ordinary select
rule. This remains an explicit reviewable inference; authored semantics override
it, ordinary Select remains select, and groups retain their container treatment.
Popup behavior and accessibility wiring are not invented or claimed complete.

Generated a new package from the benchmark's captured dump without another
Figma request. Both generated React surfaces retain label/graphic in focused
browser tests. The actual captured package sources render all five states with
Select apple, a caret SVG, and a 160x32 box; changing the text prop updates the
label. Diagnostic image comparisons to the saved Figma PNGs are 0.72–1.25% on
white and black, versus the baseline consumer's 11–19% and missing content.
These are offline unmasked diagnostics, not a replacement for the complete
consumer checker or a new accepted scoreboard result. A full replay is queued
after the fixed40 Figma request lane is free.

Two focused browser/inference tests, 122 exact proposal checks, typecheck and lint
pass. Authored-element precedence is covered. V1 private select-trigger-928
preserves generated package, before-source pointers, browser measurements,
screenshots and probes. The fixed40 run still measures b2a068257; it is not altered
by this change. Its large Chakra Progress set is actively rasterizing 270 cases,
not stalled. No threshold change, push, source-file edit or reverse qualification.


## Experiment 929: retain numeric weight when variable identity is unavailable, 2026-10-06

The fixed40 ADS Blog failure reports observed weight 653 versus rendered 700.
Its capture names an unavailable native weight variable but omits the numeric
value, allowing a rounded face label to win. Both REST and plugin readers now
retain a uniform finite weight in [1,1000] independently of variable-name access.
Unavailable identity still produces the named degradation; legacy stamps do not
replace a native binding. Mixed ranges, malformed bindings and mixed aliases
remain refused. Resolved REST bindings also respect character-range uniformity.

26 focused tests pass, including capture through proposal retaining 653, plugin
and REST missing-variable cases, and mixed-range negatives. Typecheck and lint
pass. This is a capture repair, not a new ADS conversion pass: a fresh source
read and public consumer replay remain queued behind the fixed40 request lane.
ADS nested font-family and icon overrides remain separate failures. Evidence is
in V1 private paired-regression-integration/numeric-weight-929. The benchmark
remains pinned to 926; no thresholds or source designs changed, and no push.


## Experiment 930: rank the fresh failures and isolate favicon loss, 2026-10-06

Partial fixed40 snapshot: 29/40 sets complete, 10 passing sets, 484 passing
variants, 85 failing, 93 unverified. Counts include unverified cases and are not
held-out qualification. The live session remains running. Saved a reusable
read-only failure grouping script and timestamped ranking in V1 private
paired-regression-integration/failure-ranking-930; reason categories overlap.

Inspected M3 outlined/favicon/enabled triptych: consumer omits the graphic while
source contains it. Source dump has original PNG bytes and the ellipse mask.
The actual first dependency refusal is native-image-paint-unqualified on
Netflix_Symbol_RGB:image-scale-mode: REST reports STRETCH with a diagonal affine
transform. projectNativeImagePaints currently permits FILL/FIT/CROP only. The
result names this refusal; the emitted dependency becomes a geometry/text stub,
and the caller exposes an empty favicon slot. Thus this is not missing source
bytes or a font problem. Next investigation must establish STRETCH transform
semantics and verify projection against saved source pixels, then prove mask
and selected-content routing; accepting the scale mode alone cannot claim a pass.

Separate high-coverage issues: 34 Primer variants report unavailable SF Pro Text
(the explicit manifest lacks that family; local system SFNS is not assumed
equivalent); ToggleSwitch also reports discarded labelPosition. Spinner's 50
unverified cases are fetch failure and need a separate retry after the baseline.
No scoring code, thresholds, source designs or benchmark provenance changed.


## Experiment 931: accept the REST affine image mode, 2026-10-06

Figma's official REST Paint reference names the affine image mode STRETCH;
the plugin reference names it CROP. Sources:
https://developers.figma.com/docs/rest-api/file-property-types/
https://developers.figma.com/docs/plugins/api/Paint/
The original-asset projection now accepts either spelling, preserving raw mode
and transform in capture. Positive diagonal affine basis restrictions remain;
nonzero independent rotation now refuses explicitly for both affine modes.
Original image bytes remain embedded, without a rendered-node substitution.

Four focused tests pass, including actual module and inline React renderers for
both spellings, original-byte loading and crop pixel checks, unequal-scale
projection equivalence, source immutability, and malformed paint negatives.
Typecheck and lint pass. Evidence: V1 private paired-regression-integration/
rest-image-mode-931. No full conversion pass is claimed.

Offline regeneration of the captured M3 set clears image-scale-mode and exposes
the next dependency refusal: anatomy.root.parts.mask,
shape-fill-override-requires-owned-normal-shape. The favicon dependency therefore
still falls back and the parent slot remains empty. Next repair must reconcile
mask ownership with observed instance fill overrides before content routing and
full visual replay. The unchanged fixed40 baseline continues independently.


## Experiment 932: retain unchanged mask paint without normal-shape controls, 2026-10-06

M3's mask fill host observation is identical to the captured main's float paint.
The shape-demand collector was nevertheless manufacturing a normal-shape input
on the mask, which the schema correctly refuses. Identity validation still runs
first. A mask demand equal to the independently validated source rgba now needs
no input; changed or unobserved mask paint refuses with
shape-fill-demand-mask-paint-change-unqualified. No schema capability was widened.

Offline M3 regeneration from the same dump now has zero skipped dependencies.
Mounted actual generated React/CSS with captured font inputs and original image
bytes. All six outlined favicon states retain an 85x32 box; diagnostic unmasked
white differences range 0.074–1.029%, black 0.037–1.839%, versus baseline
6.25–8.01%. Viewed enabled screenshot: the circular Netflix graphic is present.
This corroborates the 931 affine projection against source pixels, but does not
replace full consumer acceptance or qualify elevated shadow/framing cases.

Seven shape-control tests pass, including both existing React/native control
paths and equal-mask/no-source/changed-mask guards; typecheck and lint pass.
Evidence: V1 private paired-regression-integration/mask-noop-932. Full public
replay remains queued behind the unchanged fixed40 baseline. No push.


## Experiment 933: separate font prerequisites from visibility ownership, 2026-10-06

Fresh baseline at 35/40 sets: 493 pass, 183 fail, 97 unverified. All 72
Radix Blockquote and 12 Data List cases report unavailable SF Pro; do not infer
layout fixes from fallback-font measurements. Earlier exact-family search and a
fresh Spotlight search found no authenticated SF Pro/SF Pro Text font files.
The existing system SFNS files are not assumed interchangeable.

Twilio Progress Steps loses its captured step dependency at
visibility-demand-source-target-unqualified. Four independent host overrides
target the separator INSTANCE itself at childPath [0,1], with matching source
node identity and visible=false. This is not an incorrect child index or lost
source. The current visibility channel intentionally excludes component refs in
collector, proposer and schema. A proper repair must carry visibility on the
owned instance root (including native readback), not bypass identity or remove
source nodes. Evidence: V1 private paired-regression-integration/
visibility-triage-933/twilio-visibility-targets.json. No conversion pass claimed.

Started the broad exact-proposal regression after 929/931/932; session 77904,
log /private/tmp/forward932/exact-full.log. It is still running and is not yet
claimed green. Fixed40 session 54606 is live and remains the sole request lane.


## Experiment 934: final fixed40 baseline and instance-root visibility, 2026-10-06

The pinned 926 fixed40 run finished: 502/879 pass (57.11%), 185 fail,
192 unverified; 13/40 sets pass. Authoritative summary is V1 private/beta-kits/
fixed40-926/summary.json. This exceeds fixed-sample M3 (50%), not the final
never-seen-kit goal. Reverse remains unqualified. No denominator or threshold
changed. Broad regression through 932 completed 904/904, plus 122 exact checks;
its final log is preserved in mask-noop-932/exact-full.log.

Visibility controls can now target an owned component-reference instance root.
Source identity and no-crossing-instance-owner guards remain; schema still
rejects slots/repeats. Existing runtime places the identity marker on the root
instance and searches that root before refusing traversal inside its dependency.
Both React emitters preserve omission/true/false across source defaults without
adding layout wrappers. Executed native scripts in the mock preserve INSTANCE
type, linked main identity, and caller-selected visibility. Live readback is
still required for product qualification; this is not a reverse scoreboard pass.

22 focused tests, 122 exact checks, typecheck and lint pass. Offline Twilio
regeneration moves from source-target refusal to owned-part completeness: its
separator path occurs in only 21/58 source variants. The completeness guard is
retained pending explicit handling of source-absent combinations, rather than
creating visibility targets in nonexistent variants. No Twilio pass claimed.
Evidence: V1 private paired-regression-integration/instance-visibility-934.
Next: full SelectTrigger/M3 replays now that the baseline request lane is free;
then variant-specific instance visibility and the full 204-set measurement.


## Experiment 935: full public consumer replays, 2026-10-06

Replayed the unchanged captured dumps with the same explicit font manifest on
170c41898. Base UI SelectTrigger improves from 0/5 to 5/5 PASS, zero set
problems, matching package hash 24fec7cfe97d from the earlier offline fix.
M3 Assistive chip improves from 20 pass/14 fail/14 unverified to
27 pass/7 fail/14 unverified, zero set problems. This verifies 12 variant
improvements through the public clean-install consumer, not only diagnostics.

Retried Chakra Spinner separately after its baseline fetch failure: 42 pass,
8 fail, zero unverified. This resolves missing measurement; it is not credited
as a code fix or substituted into the first-pass baseline. With these three
replays substituted only in a clearly labeled current-results view, totals are
556/879 pass, 181 fail, 142 unverified (63.25%). The immutable baseline remains
502/879 (57.11%); neither view is held-out qualification, reverse still unqualified.
Evidence: V1 private paired-regression-integration/public-replays-935, including
comparison.json, actual packages and receipts. All replay processes terminated.

Next high-coverage cause: Featured icon's 95 refused variants have positioned
parents and width/height-qualified linked children, but generated references
also carry a legacy size override alongside exact absolute geometry. Validator
correctly rejects competing size authority. Offline proposal evidence is in
/private/tmp/forward936; establish equality and eliminate redundant inferred
size without discarding author-provided size before replaying this family.


## Experiment 936: eliminate deferred duplicate size authority, 2026-10-06

Featured icon's absolute geometry was assigned before the mint pass attached
a queued legacy size override. Direct-geometry qualification therefore saw no
size conflict, while the final validator did. The importer now inspects pending
size observations at direct-geometry qualification. Only complete observations
matching every captured width and height within 0.001 are eligible for removal;
removal occurs only after geometry carriage succeeds. Authored overrides still
block this route, differing or incomplete observations retain the wrapper route,
and unrelated color/stroke override observations are untouched.

The same 95-variant capture now produces a package with zero skipped dependencies.
This is generation evidence only, pending the full public visual replay. Nine
focused absolute-geometry tests pass, including existing React/native resize
coverage and a new two-size proposal regression. A negative case retains the
legacy size when the source cannot authorize generated root extents. Typecheck,
lint and 122 exact proposal checks pass. Evidence: V1 private
paired-regression-integration/absolute-size-936. No score change claimed yet.


## Experiment 937: qualify Featured icon and bound transport retries, 2026-10-06

The first Featured icon public check rendered 95 consumer cases but failed
during image retrieval (only bounds-before persisted), leaving all unverified.
A separate replay completed with the identical package sha256
96eefedd3c2875bebc43e84b3e718c80103bd45567271b3fe7ab538801dc14fe:
52 pass, 40 fail, 3 unverified, zero set problems. This qualifies 52 cases after
936; it does not make the whole component pass. Including prior recorded
replays, current-results view is 608/879 (69.17%), 221 fail, 50 unverified.
Original pinned first-pass baseline remains 502/879 (57.11%). Reverse remains
unqualified. All replay handles have terminated.

Added a bounded retry helper for interrupted transport reads: two retries with
1s/2s delays, stage-labeled errors and notices. Wired API request stages and
complete CDN download/body reads. HTTP refusals and parsing errors are not
retried by this helper; existing Figma 429 policy remains unchanged. This does
not change content/framing/visual verdicts, reuse stale snapshots, or claim a
pass on missing bytes. The successful replay predates this helper, so no gain
is attributed to retry code. 41 checker/network tests, typecheck and lint pass.

Offline cross-kit checks: Ant Design Tag icon absolute-geometry refusals clear
with 936, but Avatar wrapperUser affine layout still blocks the parent. HeroUI
Slider Tooltip absolute-geometry refusal persists. Evidence in V1 private
paired-regression-integration/transport-and-featured-937. Next diagnose Featured
icon's 40 measured failures and complete the full 204-set measurement.


## Experiment 938: put direct geometry on the painted instance root, 2026-10-06

Featured icon's remaining failures cluster at sm/xs. Viewed the xs success
triptych: the consumer circle is stretched vertically. Generated module React
added a legacy color/stroke override span, while geometry selectors sized only
the direct child. At xs the span was 12x12 and the referenced icon retained
24px height, shrinking horizontally in flex layout. This is real lost geometry,
not a checker tolerance issue.

For qualified direct absolute geometry, module React now puts the part class
and override custom properties on the already-authorized component root without
the override span. Other override wrappers and grid hosts remain as before.
Inline React already carried geometry and paint on the same root. Nine focused
absolute-box tests pass, including both renderers at 12x12 with exact placement,
paint and DIV child identity, plus existing native/resize cases. Typecheck, lint
and 122 exact checks pass. Full 95-variant replay follows; no score gain yet.
Evidence: V1 private paired-regression-integration/painted-instance-root-938.


## Experiment 939: qualify geometry repair and begin the full sample, 2026-10-06

The public Featured icon replay on c68073e32 completed: 90/95 pass, zero fail,
five unverified, zero set problems. Remaining unverified cases are exactly the
five Modern theme sizes, each render-export-overlap-mismatch. Package hash
prefix a2431ef11cca. All 40 previously measured failures are gone: 38 became
passes and two became unverified framing cases. No threshold or framing guard
changed. Current-results view (explicit replays, not first-pass baseline) is
646/879 pass (73.49%), 181 fail, 52 unverified. Original fixed40 baseline stays
502/879. Reverse remains unqualified across its original 2,203-state scope.

Started the unchanged 204-set benchmark using the existing run-full204.mjs
harness, original frozen sample, explicit authenticated 28-face font manifest,
one request lane and 15-second spacing. Reused the now-idle measurement checkout
/private/tmp/ds-contracts-fixed40-926 after confirming its clean tracked tree
and unchanged dependency lock, detached it at c68073e32 and rebuilt core/schema.
Do not alter this measurement checkout while the run is active. The production
writer remains root-paint-integration. No dependency reinstall was needed.

Live exec session 63865; log /private/tmp/full204-938/run.log. Authoritative
receipts: V1 private/beta-kits/full204-938. Provenance pins sample SHA256
59456871c3db8a1bff90a8ed861260299075f7388936c60f48ac9ce6993d7357 and
font-manifest SHA256 31063958db6ef98340060bb9b84eec0a9f1b56787d839e09b7766f40aaff530a.
This is broader seen-sample measurement, not never-seen qualification. Keep
refusals/timeouts in the denominator. Preserve per-attempt results; no concurrent
Figma-network consumer replay until this lane is free. Reverse preparation and
offline fixes can proceed independently.

## Experiment 940: distinguish capture denial and restore reverse inputs, 2026-10-06

The live full204 REST run is confirmed running as exec 63865. At this checkpoint
16 sets are terminal: 12 pass, 4 fail, 407 unverified variants. This is an ordered
partial sample, not the final population rate. Ten terminal sets include missing
variable-consumer evidence. Tile's fresh dump explicitly records the missing
file_variables:read token scope. The REST mapper also does not emit the Plugin
reader's per-consumer resolved-mode/alias evidence; adding token permission alone
is therefore not proven sufficient. Do not spend another replay retrying unchanged
capture or remove the binding guard to convert these refusals into apparent passes.

Replayed the archived canonical Plugin Tile capture through the current headless
public engine, offline and unmodified. It passes the missing-consumer stop but
now refuses solid-fill-composition-instance-root-unqualified at
root/aiShadowWrapper/aiLayerShadow. Its captured instance and main both contain
the bound MULTIPLY paint. The current composedFillReferenceChild fence excludes
absolute geometry and several root override forms; determine the actual rejected
contract shape before changing that fence. Archived accordion-capture is not a
component-set dump and was not silently substituted into this comparison.

Recovered the original Badge36 and Grid64 reverse workspaces from their canonical
archive. Each restored workspace verifies 3,243 files, two symlinks and its sealed
selected declaration. Existing files were hash-checked and preserved; only missing
files were copied. Current buildReactReference reproduces both original reference
IDs exactly and reactReferenceUnchanged is true. The current public-export reader
resolves both initializers and the existing body model now reports modeled for
both. This supersedes the old unmodeled-body diagnosis, but uses an explicitly
assumed diagnostic invocation and grants no paired-runtime or native-fidelity
credit. Next run the actual paired observer/native-plan path on these original
inputs rather than implementing another source-body model.

Evidence: V1 private paired-regression-integration/capture-and-reverse-recovery-940,
including restoration manifests, the executed probe and full current model output.
No product behavior, threshold, token or Figma document changed. Forward fixed40
baseline remains 502/879, replay-adjusted results 646/879; reverse qualification
remains incomplete across its original 2,203-state scope. Full204 continues pinned
to c68073e32. No full gate or push is claimed for this evidence-only checkpoint.

## Experiments 941–942: paired reverse baseline and imported callback ownership, 2026-10-06

Restored 289 Badge and 507 Grid archived evidence files with all original hashes
verified, preserving existing matching files. Actual paired observer is running
as exec 37879 against the original 100 states and unchanged eligibility rules:
Badge36 is complete, 36/36 paired matches, 36 native plans prepared. Every plan
still says nativeQualification:unqualified; these are not reverse conversions.
Grid64 continues (63 originally eligible states); do not reset its denominator.
Log /private/tmp/reverse941/run.log and full outputs /private/tmp/reverse941/paired.
The old writer is pinned to 8b72f9ba1 plus its unchanged parked tracked diff until
that run terminates. Full204 exec 63865 still uses its separate c68073e32 checkout.

Tile's native-capture refusal is now isolated: AI layer - Shadow refuses the
combination of box-shadow and solidFillComposition, leaving Tile with a stub.
Both instance-reference predicates actually pass. Do not relax that guard.
A handwritten outer shadow plus independent MULTIPLY fill matches a fresh live
isolated screenshot of original node 51447:122527 at 0% difference on both white
and black under the existing image comparator. Raw RGBA differs. This is an
unlanded rendering candidate, not a generated-component or conversion pass.
Token-backed shadows still need outer/inset discrimination and both-emitter proof.
Evidence is private paired-regression-integration/paired-and-shadow-941.

Badge's actual original-wrapper observation exposes a separate concrete reader
bug: callback closures imported from a dependency are searched by offset in the
root component's lexical inventory. The repaired reader authenticates the actual
callback module, builds an independent lexical AST per module, and maps reads and
capture declarations back to that same module. Equal offsets in two modules no
longer alias. Existing effect and runtime-verification obligations remain intact.
The actual captured Badge invocation changes from target-effects-callback-unavailable
to modeled. A real browser observation with the repair reaches the next unchanged
refusal, context-import-read-outside-consumer. No callback runtime proof is claimed.

Implemented on isolated branch codex/callback-lexical-owner at
/private/tmp/ds-contracts-callback-lexical-owner-2026-10-06 so the pinned reverse
run does not hold up implementation. Integrate this commit into root-paint-carriage
only after exec 37879 terminates. Twenty focused target/context tests pass across
the final runs, including changed-source and effectful imported callback refusals,
distinct same-offset modules and native browser context-call behavior. The latter
initially failed because its dependency paths were symlinks; local byte-identical
React runtime copies restore the test's required real-path identity. Full typecheck
and lint pass. No full fast lane or push. Evidence: private
paired-regression-integration/callback-lexical-owner-942. Baseline forward 502/879,
replay-adjusted 646/879 and original reverse 2,203-state qualification are unchanged.

## Experiment 943: transitive import ownership and initialization accounting, 2026-10-06

On the isolated callback repair branch, the actual Badge wrapper now gets past
two incorrect assumptions. First, an imported function read belongs to its own
import-declaring module, which can be an executable dependency. The import planner
now requires read and binding module/hash equality, while retaining the original
root consumer for runtime read linkage. It does not grant source identity from a
name or remove the runtime binding guard. A two-hop ESM regression exercises
separate declaration/executable files, exact read ownership and stale-source refusal.

Second, the initialization verifier compared its two observed module assignments
against all forty model writes, including 28 render-local sets and ten render-local
deletes. It now compares initialization assignments only, and explicitly refuses
nonlocal or unknown-phase render writes. Exact guarded model equality, render call
trace, output identity, initialization order, exported identity and loader ownership
checks remain required. Tests reject missing/extra assignments, incorrect counts,
foreign render writes, unknown phases, unverified traces and wrong exported values.

The actual Badge baseline wrapper was replayed through the current observer in a
real browser, with the original reference and source-tree/PNG hashes unchanged.
It reaches context-consumer-binding-read-coverage after capturing and matching the
original tree and image. This is not an observed/verified wrapper or a reverse
conversion pass. Preserve that new evidence gap; do not count a downstream refusal
as success. The first browser attempt lacked --enable-automation, required by the
existing capture diagnostics; the subsequent attempts set it explicitly and retain
all original guards. Eleven focused tests, full typecheck and lint pass.

Evidence: V1 private paired-regression-integration/import-and-initialization-943.
The isolated repair branch still awaits integration after reverse exec 37879 ends;
its pinned Grid baseline is live with 24/64 rows at this checkpoint. Forward exec
63865 is live at 39/204 terminal sets (102 pass, 304 fail, 652 unverified variants),
an incomplete ordered sample. Fixed40 baseline 502/879, replay-adjusted 646/879,
and reverse 2,203-state qualification remain unchanged. No full fast lane or push.

## Experiment 944: explicit binding-graph coverage and repeated reads, 2026-10-06

The actual Badge runtime registered all 31 modeled bindings, but the context
verifier demanded explicit consumer-read events for module data already checked
by the guarded render. Added bindingKeys to the body-trace receipt, returned only
after the runtime binding guard checks every registered value against its modeled
graph. Initialization verification requires exact ordered coverage against the
freshly rebuilt model; absent or extra keys refuse. Only that explicit coverage
can account for a missing consumer-read event. Existing explicit read events still
must match their values and function identities; extra events are not discarded.

The next failure exposed repeated reads: four helper locations run more than once,
while the source model retained only a unique-site inventory. Context source models
now retain readOccurrences with render/initialization phase separately from the
existing unique reads. Verification checks the exact render occurrence count and
each observed value. It does not change the one-read requirement into an unbounded
some-read rule. Tests exercise a two-hop executable import inside a two-iteration
loop, preserve its one unique site and two occurrences, and reject missing/extra
binding graph evidence. Non-context model serialization is unchanged.

Actual Badge baseline capture still matches the original source tree and PNG.
It now passes binding coverage and reaches context-consumer-function-values. The
remaining gap is concrete: extract-props receives three record arguments and
returns a record, while the consumer-call receipt exposes opaque object kinds plus
identity witnesses, not a verified record-value correspondence. Runtime call order
alone is not used to waive that argument/result proof. Preserve this refusal.

Eleven final target/phase tests and the final browser context-verifier baseline
pass; the earlier full context/binding suite passed 14 tests before occurrence
metadata was added. Typecheck and lint pass. No new conversion pass, full fast lane,
or push. Evidence: V1 private paired-regression-integration/binding-coverage-944.
Repair branch remains separate from pinned reverse exec 37879; Grid's original
64-state run and forward full204 exec 63865 continue. Forward baseline 502/879,
replay-adjusted 646/879, and reverse 2,203-state qualification are unchanged.

## Experiment 945: use recorded call witnesses; reprioritize by measured reach, 2026-10-06

Consumer function verification used scalar summaries, which intentionally omit
object identity, instead of the already captured argument/return witnesses.
Use those witnesses through the existing provenance-aware matcher and require
agreement with scalar summaries. No arbitrary record acceptance is added.
A browser regression passes a hostile opaque Proxy through a pure identity
function without inspecting it. Forged argument identity, return identity,
missing witnesses and scalar-kind disagreement refuse. The regression fails at
function-values with the original verifier and passes after the change. All 11
context browser tests, typecheck and lint pass. The actual original Badge capture
still refuses context-consumer-function-values: its structured records need
additional provenance. No reverse qualification or conversion pass is claimed.
Evidence: V1 private paired-regression-integration/identity-witnesses-945.

To stop spending successive turns on low-yield proof repairs, ranked completed
forward rows by affected variants. Snapshot: 46/204 terminal sets, 435 passes,
314 failures, 692 unverified; incomplete ordered sample, not a population score.
Chakra Switch contributes 320 cases with render-export-overlap-mismatch; 160
also report content-size-mismatch. It is the next bounded offline investigation.
Do not assume the reported content size is the root layout: the first raised
case has 24x6 in both dump and captured DOM, while image content reports 24x13.
Trace export framing and thumb paint/geometry before changing emitter or checker;
retain the unchanged acceptance thresholds and preserve original receipts.
Carbon's missing consumer bindings affect at least Accordion 120, input 92,
Tile 65 and menu 28 cases in this partial sample; these counts are opportunity,
not promised passes. Reverse structured-record work remains required but is
parked pending a batched diagnosis of the complete remaining proof chain.

Forward exec 63865 and reverse exec 37879 were polled live. Grid has reached
54/64 rows; its pinned checkout remains untouched. Fixed40 baseline 502/879 and
replay-adjusted 646/879 are unchanged; reverse remains unqualified. No full fast
lane or push. The isolated repair commits await the pinned reverse run ending.

## Experiment 946: batch Switch export diagnosis, 2026-10-06

Analyzed both saved Figma PNG exports for all 320 Chakra Switch variants at
source-recorded layout-to-render offsets. All fail the existing exact overlap
proof. On white and black, the largest per-channel composited difference across
all overlaps is 4.015686274509804/255; 50/320 have identical overlap alpha.
This is native-export disagreement, before React comparison, not evidence that
320 React conversions are close to passing. The source bounds and PNG dimensions
agree for the inspected xs solid and raised cases. Keep the refusal: no threshold,
scorer, frame authority or verdict has been changed. Avoid another bulk replay of
this same capture route. Next capture experiment should authenticate a native
export origin independently on representative solid/raised cases first.

Also traced the reported 24x13 vs 24x6 mismatch: it compares independently
trimmed image content; the raised case's actual DOM layout and Figma layout are
both 24x6. The generated thumb correctly carries per-combination absolute
position and size. Thus do not implement the initially suspected root-height or
thumb-position fix from the failure string alone. A real rendering difference
can still remain, including effects; current evidence does not qualify it.

Evidence: V1 private paired-regression-integration/switch-export-diagnosis-946
(all 320 per-case histograms and diagnostic scripts). No new conversion pass.
Both baseline processes were polled live; their pinned checkouts remain untouched.
The previous turn was progress (commit b4cce9605), and this batch eliminates an
unsupported geometry change and a redundant 320-case replay from the next action.

## Experiment 947: native export route does not remove Switch refusal, 2026-10-06

Read the original Chakra file XLW7b0pF4aa9CJellbyK96 through use_figma and exported
395:996 (xs solid) and 396:2306 (xs raised), with no source node mutations.
Recorded layout/render bounds before and after each export; they are unchanged
and match the saved REST bounds. Native render PNG sizes are 28x20 and 26x16.
Their pixels are not identical to the prior REST render PNGs. A second same-call
native layout/render pair also fails the unchanged exact-overlap check for both
nodes. Thus replacing REST with Plugin API exportAsync alone is not a fix.

The local diagnostic adapter uses a synthetic version label solely to exercise
the existing overlap function: it does not authenticate a Figma document version
or create accepted framing evidence. No origin proof, conversion pass or scoreboard
change is claimed. All returned native PNGs and before/after bounds are archived
under V1 private paired-regression-integration/switch-native-export-947.

Stop this route experiment without a bulk replay. Independent origin evidence
still needs a concrete producer and verification design; do not silently admit
exports by dimensions or loosen pixel agreement. Meanwhile the existing Carbon
shadow fixture offers a measurable emitter defect: mixed fill plus root shadow
is explicitly refused even though the prior diagnostic CSS rendered within the
unchanged comparison threshold. Next inspect that emitter path and determine
whether actual shared/inline output can carry outer shadows safely. Reverse
exec 37879 remains live at Grid 63/64; forward has reached 49/204, including
Chakra Input 315/315. These partial rows do not replace the completed scoreboard.

## Experiment 948: consolidate repairs after paired baseline completes, 2026-10-06

Reverse exec 37879 exited zero. Original Badge: 36/36 paired matches and 36
native plans prepared. Original Grid: 63/64 paired matches (63 originally eligible),
all 63 native plans refused. Combined 99/100 paired matches; no native readback or
fidelity measurement and no reverse conversion credit. Archived the full 1.9 GB
paired output and runner/log in V1 private paired-regression-integration/paired-complete-948.
Verified 11236 archived files by size and 9940 JSON files by SHA256.

With the baseline terminal, fast-forwarded codex/root-paint-carriage from
8b72f9ba1 to 7a4df91d4. Parked tracked edits have the identical binary-diff SHA256
before and after; untracked evidence remains in place. The sole next code writer
is /private/tmp/ds-contracts-root-paint-integration-2026-10-04. The isolated
callback-lexical-owner checkout is now parked, not another writer. No push.

Traced the Carbon shadow refusal to solidFillCompositionRules in the shared CSS
module, also called by inline React. It rejects box-shadow in every style holder,
including token-backed values. A repair must distinguish outer from inset effects
across resolved token modes; merely deleting box-shadow from the guard would admit
unproven inset paint. Existing native shadow PNG and CSS diagnostic are evidence
for the next real-emitter test, not a passing conversion. No emitter change yet.

## Experiment 949: outer shadows coexist with independent fill paint, 2026-10-06

Shared CSS and both React emitters now distinguish supported outer box shadows
from inset/unknown effects when checking composed fill. Keep shadow on the host,
with fill on the existing independent layer. Added explicit token-value input to
composition checks and React validation; inventory names alone cannot qualify a
shadow. Emitters inspect resolved values across light/dark and all supplied brands;
proposal checks inspect their captured/minted context, with full emission checked
again. Missing/cyclic aliases, inset shadows, malformed values and foreground-ring
combinations remain refused. No existing comparator threshold changed.

The actual CSS-module React emitter and inline emitter render the Carbon native
AI layer - Shadow fixture at 0% on both white and black with the unchanged image
comparator. Because low-opacity shadows can fall below its perceptual threshold,
the test also requires a computed shadow and actual painted pixels outside the
host. Inset/theme/malformed/alias negative controls pass. The 36-test mixed-fill
suite passes, plus the final focused two tests; typecheck and lint pass.

The saved original Carbon Plugin capture now proposes AI layer - Shadow and Tile
without child stubs (prior diagnostic showed Tile's shadow dependency stubbed).
This is actual proposal/emitter progress, not an accepted full Tile conversion:
no public live consumer replay or native round-trip qualification is credited.
Full204 remains pinned to c68073e32 and running; no competing REST request was
introduced. Evidence: V1 private paired-regression-integration/outer-shadow-949.
No full fast lane, push or release. Parked unrelated edits remain untouched.

## Experiment 950: full Tile packaging gate, 2026-10-06

Ran the actual figmaToReact/viteEngine packaging path on the saved complete
Carbon Plugin capture, with no Figma REST calls. Shadow support advances proposal
but packaging refuses six component instances with declared display:none:
revertAiButton, aiLabel, aiIconsRevertAiButton, aiIconsAiSlugWrapperAiLabel,
instance under aiLayerBorder, and aiLayerBackground. The validator correctly
prohibits parent declarations from restyling opaque child components.

An experimental change used all-false presence tables at the early buildPart
stage. Four errors disappeared, but linked-paint processing later creates two
more component owners carrying the old display declaration. The experiment also
exposed absoluteGeometryByCombination completeness errors when a complete absence
table makes every geometry row undrawable. Removing unreachable geometry at the
late stage resolves that error, but is insufficient to normalize the two later
component declarations. No change is admitted from this candidate: its patch and
all attempts are archived, and the two edited files were restored to their exact
HEAD bytes. The previously committed outer-shadow repair remains in place.

Regression attempt limitations: a synthetic hidden instance is omitted earlier
by design, so it never exercises the linked-paint path; it is not a valid test for
this failure. An existing hidden-paint-stacking expectation also fails because
current flow-child qualification accepts ordinary text independently of the
hidden-child exemption. Do not call that suite green or alter it to hide failure.

Next repair belongs after final linked-component construction: express permanent
absence using the already-supported complete presence domain, retaining controls
for visibility-bound children and removing only unreachable derived geometry.
Use the six actual proposal owners as the regression inputs, not a synthetic
instance discarded before this phase. Full consumer output remains unavailable;
no image or conversion pass is credited. Evidence: V1 private
paired-regression-integration/tile-consumer-950. No network replay or push.

## Experiment 951: Tile packages and all 65 variants mount, 2026-10-06

Normalized permanently hidden component usages after linked-paint construction.
The six original Tile owners now carry complete all-false presence tables instead
of parent display declarations; child identity/props remain unchanged. Unreachable
derived geometry tables are removed only for those permanently absent usages.
Visibility overrides and conditional display remain untouched. Actual six-owner
fixtures verify this transition and idempotence; the failed early approach from
950 was not reused.

Full packaging then exposed and resolved three independent integration failures:
(1) package validation now receives the already-loaded token trees for the outer
shadow proof; (2) literal zero padding on a scaled filled-path parent preserves
its coordinate plane, while nonzero padding still refuses; (3) generated runtime
guards use globalThis.Error so Carbon's Error component cannot shadow the native
constructor. A final collision involved Carbon Button's design axis Style versus
React's host style property. Proposed contracts retain the design/contract axis,
but choose an unused styleProp code binding (styleProp2 etc. if occupied).

The real figmaToReact pipeline produced ds-contracts-generated-tile-0.0.0-generated.tgz
with Tile and 25 dependencies; package TypeScript compilation passed. A clean
consumer run with authenticated fonts mounted and captured all 65 variants. No
Figma REST calls were made alongside full204. Verdict remains FAIL at set level:
named-slot-not-exercised and variant-prop-discarded findings remain. All 65 variant
visual/content results are UNVERIFIED because reference images/content were not
requested. No conversion passes or updated scoreboard are claimed. Inspected the
base consumer PNG: title and description render in a 360px light-gray tile.

48 focused/regression tests pass; final three hidden/code-binding tests also pass.
Typecheck and lint pass. Evidence including tarball, request, source inputs, all
consumer PNGs and receipt: V1 private paired-regression-integration/tile-package-951.
Next inspect control/source equivalence and run paired visual/content measurement
when the Figma network lane is available; do not treat package success as fidelity.
No full fast lane or push. Parked edits remain separate.

## Experiment 953: shared absolute root dimension collision, 2026-10-06

The previous status turn produced a partial failure inventory; this turn verified
full204 session 63865 live and followed the repeated placement refusal rather than
continuing Tile-specific investigation. Six completed sets across MUI, Primer,
Atlassian and HeroUI expose absolute-geometry-host-unproven (126 declared variants).
This is a candidate family, not a claim all six have the same underlying cause.

Saved MUI AvatarGroup and Primer ActionList.Item/Loading inputs both reproduce on
HEAD a625e0c69. Root width/height observations queued before captured absolute
geometry survive until minting, adding competing component.rootOverrides later.
The repair removes those pending dimension observations only when every variant
agrees with its independently qualified absolute box. Opacity and other root
inputs survive. Existing identity, local transform, child API and placement guards
remain unchanged; conflicting or incomplete observations do not take this path.

Both real packages now build and mount: MUI 36 variants with no offline control
findings; Primer 12 variants with SF Pro Text unavailable and children/trailing
visual findings still present. MUI screenshot inspected: overlapping avatars and
+3 render. Both visual/content comparisons remain unverified without source
reference fetching. No new qualified conversion passes credited. An incidental
Primer ToggleSwitch replay is archived separately and is not evidence for this fix.

The new regression fails against original HEAD and passes with the repair; it
checks nonsquare per-variant dimensions plus preservation of opacity. All 42 tests
in absolute-inferred-size, absolute-geometry and absolute-box pass, including
browser/native placement checks. Typecheck and lint pass. No full fast lane or
push. Evidence: V1 private paired-regression-integration/absolute-root-dimensions-953.
Next compare these generated consumers with authenticated source references once
the REST measurement lane is free; keep the frozen full204 run undisturbed.

## Experiment 954: six-set placement repair breadth, 2026-10-06

Previous turn was progress: a572f577e changes the conversion and verifies two
real kits. This turn confirmed full204 session 63865 remains live (97 completed
at entry, 99 at a later snapshot); no competing REST fetch or benchmark mutation.
Replayed the four remaining absolute-geometry-host-unproven sets from saved dumps:
Primer SingleSelect-SelectPanel (36), Primer ActionMenu (30), Atlassian Avatar group
(10), HeroUI Slider (2). All four now package, bringing this refusal family to six
packaged sets / 126 declared variants including experiment 953. This does not
credit conversion passes or prove every original refusal had only this cause.

Skipped dependencies remain explicit: Primer image_user, image_org and Avatar;
Atlassian Avatar. HeroUI reports no skipped dependencies. All 36 Primer Select
consumer cases render, but exact SF Pro Text is missing, named visual slots/state
are flagged, and reference imagery/content were not fetched. Consumer session
71011 remains live on ActionMenu, with Atlassian and HeroUI queued in that same
sequential script. Output /private/tmp/geometry954; do not restart on continuation.
Intermediate package results and scripts archived under V1 private
paired-regression-integration/absolute-root-dimensions-954. Archive the completed
consumer outputs when terminal. No code/scorer changes, new score, or push.

## Experiment 955: six-set consumer completion, 2026-10-06

Previous turn was progress (four additional packaging replays). Verified both
live handles, then consumer session 71011 terminated successfully with all four
receipts. Combined with 953: 126/126 variants mounted; no qualified new passes.
MUI AvatarGroup 36 and HeroUI Slider 2 have screenshots for every case and no
offline control findings. Primer Loading 12, Select 36 and ActionMenu 30 all lack
exact SF Pro Text. Menu adds 14 capture-translation-changed-subject refusals;
Atlassian AvatarGroup adds seven capture-translation-changed-layout-pixels refusals
and produces three of ten screenshots. Retain all guards and thresholds.

Archived complete 954 packages, screenshots and receipts under private
paired-regression-integration/absolute-root-dimensions-954/completed; joined six-set
results in COMPLETED-SUMMARY.json. A one-second read-only CPU sample was captured
while ActionMenu ran; it is inconclusive about the bottleneck and justifies no
performance claim. Full204 session 63865 remained live (104/204 at last snapshot).
Next source-comparison priority is MUI AvatarGroup then HeroUI Slider once REST
lane is free; font/control/framing findings remain named on the other sets.
No code change, scorer change, full fast lane or push this turn.

## Experiment 956: AvatarGroup native image comparison, 2026-10-06

Previous turn was progress: complete six-set consumers preserved. Verified
full204 session 63865 still live. Used read-only Figma Plugin exports on MUI file
1mf5Xan0SOLwu9GQLGdqT7, set 6785:41415; no REST requests and no source mutations.
A first numeric-array batch exceeded the tool's 20 KB response limit and was not
used. Recovered all 36 complete exports in compact base64 batches of three.

Compared generated 953 consumer images to native images with existing recorded
origin alignment and diffPair, no masks or threshold changes. 36/36 are within
5% on white and black; worst white 0.170068%, worst black 1.136364%. All 36 root
sizes match exactly and source bounds stayed stable during export. Inspected base
native screenshot alongside consumer: avatar stack, outlines, icons and +3 visible.

One initial framing refusal (6785:41470) came from a render box two pixels left
of layout. Fresh paired native layout/render exports pass the existing exact
qualifyRenderBoundsExport overlap proof (3168 overlap pixels, 2642 painted).
The diagnostic comparison uses the existing paired-frame API tag for this proof;
its version string explicitly says native-paired-call-956-diagnostic and is NOT an
authenticated REST revision. No official score or full content qualification is
claimed. This confirms image fidelity on current source, not first-pass held-out
success. Evidence including all PNGs, bounds, comparison script and results:
private paired-regression-integration/avatar-native-comparison-956.
Next qualify content and authenticated reference provenance when the REST lane
is free. No code change or push.

## Experiment 957: AvatarGroup text and icon qualification, 2026-10-06

Previous turn was progress (36 native image comparisons); full204 session 63865
verified live at entry, with 110 sets complete in the log. Captured the complete
visible source hierarchy for each of the same 36 MUI AvatarGroup variants through
read-only Plugin API calls. Captured id/type/name, visibility/opacity, layout and
render bounds, fill/stroke arrays, and text characters with per-character style
runs from getStyledTextSegments(fontName,fontWeight,fills). Hidden subtree contents
are omitted only where the unchanged checker stops traversal at visible:false.

Fed these facts through existing figmaContent; mounted the same generated 953
React modules with their tokens/CSS and hash-authenticated Roboto in a diagnostic
esbuild browser consumer; used unchanged domContentOf and caseContent. All 36
variants pass: 37 text occurrences with matching declared font family/weight and
color, and all 89 source graphics matched. No checker changes or tolerance edits.
Combined with 956's image/size evidence this supports a successful current-source
replay, but not a new authenticated REST first-pass/held-out scoreboard result.
The source adapter and custom consumer are explicitly diagnostic; final CLI
qualification is still required. Evidence including source facts, DOM facts,
checker rows and runnable script: private paired-regression-integration/
avatar-native-content-957. No engine change or push this turn.

## Experiment 958: preserve structural presence on direct positioned components

Previous turn was progress (AvatarGroup native content qualification); verified
full204 session 63865 still live. HeroUI Slider source inspection and native PNGs
show no tooltip in either range-slider state. The saved _SliderStructure dump
contains Tooltip only in thumbs=single. Generated range usages incorrectly kept
it because a live showTooltip binding replaced the structural enum condition
when wrapPositionedRefPart returned the same directly positioned component.

Direct absolute component geometry now keeps source enum presence in a complete
presenceByCombination table and retains the independent live Boolean visibleWhen.
No wrapper/restyling or changed source data. The regression exercises every
condition and repeated switches on CSS-module and inline React surfaces, plus
native compilation for the structural planes. All 86 instance forwarding and
absolute inferred-size tests pass; typecheck and lint pass.

Actual Slider package rebuilt and both consumer cases mounted without tooltip.
Current native paired exports qualify the default source frame: unchanged scoring
moves black mismatch from 18.109254% to 0.082423%; white from 3.151243% to 2.441789%.
The default now meets both 5% image thresholds. Existing content checker passes
both cases before and after. Disabled remains unqualified: consumer root height
48 versus source layout 44, and native render bounds changed 44→52 during paired
export, which the unchanged framing guard refuses. Earlier raw exports also had
layout/render-span ambiguity; do not call either state an official scoreboard pass.

Evidence: private paired-regression-integration/slider-presence-958 (source facts,
PNG exports, before/after package checks and comparison scripts). Native diagnostic
version labels are not authenticated REST revisions. Initial oversized tool
responses were discarded and retried in separate compact source/image calls.
Next address disabled state-dependent instance dimensions, then run official CLI
qualification when the REST lane is free. No full fast lane or push.

## Experiment 959: installable preview candidate from committed source, 2026-10-06

Prior user check-in was a verified benchmark wait plus readiness advice; this
turn executed the clean installation checkpoint. Archived committed 049644326 to
/private/tmp/ds-contracts-beta-candidate-959, excluding parked edits. Fresh npm ci
and schema/core preparation pass. Installed CLI smoke builds and packs rc.3, then
installs it into an empty directory: Badge 10/10 mounts, font provenance and
invalid-family rejection pass, missing-browser control says NOT CHECKED, missing
reference token says UNVERIFIED. Smoke is RED only for request hash and Badge.tsx
reference drift. All packed generated Badge library entries match the old pin.
Removing ONLY instanceRootInputs metadata reproduces the old request hash exactly.
No reference, scorer, or receipt was modified to make the gate green.

Ran the installed CLI on saved MUI AvatarGroup with authenticated fonts, without
Figma token or repository runtime imports. 36/36 variants mount; no failed cases,
all unverified due to absent reference access. Every generated file hash matches
experiment 953 output already measured against native images/content in 956/957.
The installed path now has real-kit evidence, not only the old Badge fixture.

Candidate artifact and SHA, logs, generated outputs, READINESS.json and a short
installation/hold note are preserved at private/tester-candidates/049644326.
No publish or tester messages. It is NOT release-qualified: reviewed pin
revalidation, full gates, authenticated CLI checks and reverse qualification
remain. Full204 session 63865 was verified live; no competing REST fetch occurred.
Next revalidate the reference using current qualified evidence when the REST lane
is available, and complete candidate gates; retain the original bidirectional
80% held-out goal unchanged.

## Experiment 960: clean candidate build and targeted qualification

Fresh detached qualification checkout /private/tmp/ds-contracts-beta-gates-960
at 049644326 passes npm ci, four workspace builds, npm run build, docs:check,
and root typecheck. Both react-overlap browser regression tests pass. The build
regenerates 19 tracked component files: AvatarGroup receives the existing overlap
runtime and CSS property, and optional slots gain transparent React fragments
from the existing emitter. Inspected representative diffs and preserved the full
patch; generated changes remain isolated in the qualification checkout pending
final candidate reconciliation. No parked source changes were included.

This is candidate readiness progress, not new fidelity credit. Installed smoke
reference drift from 959 remains unresolved; full gates and authenticated CLI
qualification remain outstanding. Avoid running timed recipe gates against the
active full204 browser workload. Full204 session 63865 remains live, with the log
at 133/204 completed sets; that partial ordered sample is not a final score.
Evidence: private paired-regression-integration/candidate-gates-960 contains
installation, preparation, build, docs, typecheck and overlap logs plus generated
patch. No publish, tester invitation, scoring change or reference repin.

## Experiment 961: reproducible generated outputs and exact smoke drift diagnosis

Previous turn was progress: fresh candidate build/gate evidence. Repeated the
candidate build at 049644326; the resulting generated patch is byte-identical to
the first build. Reconciled its 19 generated component files into the sole writer.
AvatarGroup now carries the already implemented negative-spacing runtime; optional
slot outputs reflect the emitter's transparent fragments. These exact generated
files passed root typecheck; both overlap browser tests passed in experiment 960.
No engine behavior or parked edits changed.

The remaining Badge.tsx smoke drift is precisely one TypeScript-only cast:
current text === ('' as string) versus pinned text === ''. Removing only that
cast reproduces pinned SHA256 55e370d7ba2beb0a0cd586b29688f8d3cf5ebcdaded05e61c262ff87c96b3d3d
exactly. Together with 959's exact instanceRootInputs request reconstruction and
identical packed entries, both smoke differences are explained. This does not
replace authenticated revalidation of the old fidelity receipt. The reference
and smoke gate remain unchanged. Evidence saved under candidate-gates-960:
repeat build log/patch, reconstructed pinned source, and badge-source-drift.json.
Full204 session 63865 was polled live. Full goal and scores remain unchanged.

## Experiment 962: isolate disabled Slider dimension loss

Previous turn was progress (reproducible generated synchronization). Full204
session 63865 remains live; latest completed set 134/204 (Radix Button has
138 pass / 582 fail). No new aggregate/held-out claim.

Read the saved original Slider dump: default instance 2306:2326 explicitly
captures local height 48; disabled instance 2306:2328 explicitly captures 44.
Both agree with independent instanceGeometry and have linked override authority.
The proposed root input nevertheless mints uniform 48. Cause localized to state
promotion: baseVariants excludes disabledGroup before buildPart and
carryInstanceRootInputs; the later state pass does not rebuild those inputs.
This is not missing capture data or rounding.

Controlled local counterfactual renames only Slider's state axis to Presentation
in a COPY of the dump, preventing interaction-state promotion. It mints both
height.default=48 and height.disabled=44. A real clean consumer confirms root
200x48 and 200x44 respectively. Both remain UNVERIFIED without reference access.
Counterfactual also changes semantics (button becomes div), so it is diagnostic,
not a proposed fix, new source evidence, or a scoreboard pass. PNG hashes are
identical to original consumer cases despite differing disabled root geometry:
layout-size qualification remains independently necessary.

Evidence: private paired-regression-integration/slider-state-diagnosis-962
contains copied counterfactual, runnable proposal/consumer scripts, generated
package, receipt and logs. Original source, scorer and engine remain unchanged.
Next add identity-qualified state-aware root-input carriage, preserving platform
state semantics and default child dimensions; cover repeated state changes and
native emission rather than adopting the diagnostic axis rename.

## Experiment 963: carry disabled instance dimensions through the live input

Previous turn isolated the state-promotion loss. Proposal now independently
pairs base/disabled instance occurrences through unambiguous source paths and
reuses the existing same-file keyed root-input qualification. Complete dimensions
mint against the live disabled Boolean in an isolated mint pass; unrelated paint
observations keep their original domains. Missing peers, identities or authority
cannot supply a disabled dimension. Original state semantics and child defaults
are preserved. This covers promoted disabled input; other interaction states
and dimension-only state declaration remain subject to existing refusal gates.

Native root-input substitution now uses authored Boolean defaults when omitted,
and disabled preview compilation explicitly selects the live disabled input.
The regression checks repeated state changes on both React surfaces, native
base/disabled compiled heights, reverse source ordering and negative identity /
missing-authority / missing-peer cases. It fails on unmodified 049644326.
87 focused forwarding/geometry regressions pass. A separate qualification checkout
excluding parked source edits passes 115 forwarding/native-state/disabled-selector/
code-preview tests plus typecheck. Lint passes. Parked emitter edits preserved.

Real original Slider dump produces an installed clean consumer with 200x48 default
and 200x44 disabled, both retaining button semantics and the disabled Boolean.
No source rename, scorer change or reference update. Both cases remain UNVERIFIED
without authenticated source access; the earlier disabled export-bounds refusal
still requires revalidation. No official fidelity credit. Evidence at private
paired-regression-integration/slider-disabled-dimensions-963 includes package,
consumer receipt, baseline failure, passing tests, typecheck and source patch.
Full204 remains live; latest log at 140/204. No full lane or publish.

## Experiment 964: stable native exports expose disabled overflow alignment

Previous turn fixed disabled input dimensions. Re-polled full204 session 63865
live. Read-only paired exports of original HeroUI Slider source: first disabled
export again changed render bounds 44→52. Retained that failed observation and
retried after an initial render. Both variants then have stable before/after
bounds and pass the unchanged paired-export qualifier. No source mutation.

Current 963 consumer compared with those native exports: default white 2.441789%,
black 0.082423%, exact 200x48 size. Disabled exact 200x44 size but white 6.832543%,
black 8.274092% — FAIL at unchanged 5%. Before 963 disabled image passed but its
root height was wrong; neither implementation qualifies the complete case.
Native current-version diagnostic is not an authenticated REST first-pass score.

Read-only native child geometry localizes the remaining fault: disabled source
header y=0, control y=28 inside the 44-high center-aligned instance (children
occupy 48). Browser's CSS justify-content:center instead shifts header to y=-2
and control to y=26. Default matches y=0/28. Source disabled Label also captures
20-high versus browser 24; do not assume centering is the sole discrepancy.
Both content checks still pass against 958's captured native content (reused,
not freshly qualified here). Fresh browser geometry recorded alongside results.

Evidence: private paired-regression-integration/slider-native-verification-964
contains initial/stable bounds, native paired PNGs, unchanged scorer script,
comparison, fresh source geometry and consumer geometry/content diagnostic.
Next qualify overflow alignment from source evidence before changing general
centering behavior. No threshold waiver, source edits or new score credit.

## Experiment 965: falsify global safe-centering fix; triage large Radix cohort

Previous turn localized Slider overflow. Created eight isolated rectangle-only
Scratch fixtures on Page 1 (board 459:18, created IDs 459:18 through 459:42),
covering vertical/horizontal, CENTER/MAX, overflow 44 and fit 60 with 48 of
children plus gap. Native CENTER overflow is -2, MAX is -4, in both directions;
all eight match browser flex positions exactly. Board PNG inspected. Thus a
blanket safe-center lowering would be WRONG. Slider source's reported 44-high
HUG instance with children at 0/28 is not explained by ordinary Figma alignment.
Preserve the named source/consumer mismatch; no global CSS change is justified.
Fixtures remain isolated in writable Scratch; community source was not edited.

Shifted diagnosis to the large completed Radix Button cohort 1230:17452, pinned
c68073e32: 720 cases, 138 pass / 582 fail. Of failures, 576 report missing exact
SF Pro. The 144 without that finding contain 138 passes and six image-only
failures, all size-1 ghost loading=true disabled at 9.62%, across color/contrast.
This is a prerequisite correlation, not proof that a font installation will
make the 576 pass. Do not alias SFNS or exempt font failures. Next investigate
exact usable font availability and the six shared spinner cases before spending
more cycles on the anomalous Slider source. Full204 session 63865 verified live.
Evidence: private paired-regression-integration/overflow-and-radix-triage-965
contains native IDs/positions, PNG, runnable browser comparison (8 exact), and
Radix reason grouping with examples. No score changes or release qualification.

## Experiment 966: font acquisition boundary and rotated Spinner source loss

Previous turn qualified alignment and grouped Radix failures. Rechecked local
user/system font folders, Downloads, and Figma font-cache paths: no exact SF Pro
asset found. Apple's official developer.apple.com/fonts page offers SF Pro but
its published license restricts embedding and website use (sections 2A/2B).
No font downloaded, repackaged, renamed or aliased; installation alone is not a
qualified input to our font-embedding consumer pipeline. Missing-font cases stay
in the denominator. Font availability remains unresolved, not an engine fix.

Inspected saved Button 1230:17452 case 1340:53423 (size1 ghost loading disabled)
and its Spinner dependency 1345:79663. Fresh read-only native geometry proves
loss before emission: rotated FRAME 1345:79667 has LOCAL 1.5x12, rotation -45,
relative transform [[.707106769,-.707106769,9.71231079],
[.707106769,.707106769,1.22702932]]. Its dump substitutes post-rotation 9.55x9.55
absolute box. Inner RECTANGLE 1345:79668 is LOCAL 1.5x4 at 0,0, but dump shape
is 3.89x3.89 at 5.66,0: parent rotation polluted child geometry. Generated React
uses ordinary divs for these leaves; source rotation does not survive. This is
an actionable coordinate-plane capture/lowering defect, not a font issue or
reason to relax the image limit. Six font-independent Button failures share it;
other cases passing the threshold do not prove their geometry was preserved.

Evidence: private paired-regression-integration/spinner-source-geometry-966
contains exact native leaf geometry; original dump and checked PNGs remain in
full204-938/radix-themes/1230-17452/attempt-1. Next preserve local frame/child
transforms with regression coverage, then replay all loading cases. Full204
session 63865 verified live, latest completed log 146/204. No score credit.

## Experiment 967: qualify existing owned-affine carrier for positioned frames

Previous turn identified rotated local-plane loss; full204 session 63865 polled
live. Tested two implementation paths before changing the importer. Mapping the
rotated FRAME to shape.rect discards its children, so that path is invalid.
Declared transform:rotate keeps React children but ordinary native frame
compilation omits the rotation; it is not a bidirectional solution either.

The existing owned instanceAffine carrier inside an independently positioned
allocation frame preserves local dimensions and children. Added
core/rotated-frame-plane.test.ts with committed read-only native observations in
core/fixtures/rotated-spinner-local-plane-966.json. Both React emitters match
native ink x/y/width/height within Chromium's 1/64px layout unit; native compiled
allocation retains the 1.5x12 local frame and its ink child. Test and typecheck
pass. The check is a carrier qualification, not an importer regression or a new
image pass. Production capture/lowering remains unchanged and still loses this
geometry. No schema expansion needed for the tested constant rigid frame.

Standalone failed-path probes, successful carrier outputs and tests preserved
at private paired-regression-integration/spinner-carrier-967. Initial browser
check used document rather than root-relative coordinates; corrected the probe
to compare in the source root plane. Next capture explicit local frame bases,
connect them to this qualified carrier, and cover malformed/missing authority
before replaying the real loading cases. Scoreboard remains unchanged.

## Experiment 968: preserve raw node-local geometry in both source readers

Previous turn qualified the positioned owned-affine target carrier. REST and
plugin dump now capture localGeometry: node/parent IDs, copied relative matrix,
local dimensions and independently observed parent dimensions. World bounds
never supply missing local dimensions; malformed/nonfinite observations remain
absent. Valid skew/reflection facts are preserved as observations, not granted
rendering authority. Existing rotation-unsupported findings remain until lowering
is implemented. No legacy dump is retroactively enriched from guessed bounds.

Native Spinner observation drives a real REST mapping test: frame 1.5x12 and
child 1.5x4 survive even though their world bounds are rotated squares. Full
plugin execution verifies the same parent chain. Invalid/missing authority and
no-input-mutation checks pass alongside existing instance and route parity tests.
22 targeted tests pass, including the owned-frame carrier; typecheck passes.
Added local capture and carrier tests to exact-proposal:check. Full gate not run.

Only new reader changes are staged; parked degenerate-stroke map/script edits
remain outside the commit. Evidence logs: private paired-regression-integration/
local-geometry-capture-968. Full204 session 63865 was polled live and remains on
its pinned reader. Production conversion still needs the explicit local-plane
lowering; no new visual pass claimed. Next connect qualified rigid observations
to the positioned owned-affine frame, including varying source-size domains.

## Experiment 969: remove a verified release packaging blocker

The preceding owner check-in was status, not implementation progress. Re-read
the handoff and full bridge goal; polled full204 session 63865 live. Its latest
observed completion was 165/204 sets, still an incomplete ordered sample.

Audited the release builder against actual npm package file lists. The schema
and core allowlists rejected 24 runtime/declaration entries from prior engine
changes. Rebuilt schema/core; this exposed two more composed-shadow entries.
Reviewed their source imports and consumers: rigid allocation, state presence,
solid-fill schemas/bindings, child paint order, text-state targeting, instance
sizing/strokes, affine token validation and composed shadows. Added the 26
explicit filenames to the reviewed allowlists; no wildcard or guard change.

The release builder's own packPackage function now passes two deterministic
packs plus extracted-file verification for all four workspaces: schema 31
files, core 62, CLI 4, paused emitter 4. CLI/emitter used their existing built
outputs; this is packaging verification, not a fresh full candidate build.
The existing self-test still rejects credential, coverage and source-map extras.
Evidence: private paired-regression-integration/release-allowlist-969, including
the original mismatch list, fresh schema/core build log and tarball hashes.

No release published or old candidate relabeled. Authenticated smoke pin
revalidation and full release gates remain open. Local-plane source lowering
remains unfinished. Forward fixed40 first-pass 502/879; replay view 646/879;
reverse unqualified. No fidelity score credit from this packaging repair.

## Experiment 970: lower positioned local frame planes and replay Spinner

Previous turn removed a verified release allowlist blocker. Full204 session
63865 polled live; latest observed completion 188/204. Full gates still deferred
while this pinned benchmark runs. Parked writer/map/package changes untouched.

Connected explicit node-local geometry to the existing owned-affine frame
carrier. A positioned free FRAME retains a separately positioned transformed
allocation and a fixed-size local frame containing its local children. Distinct
local sizes/matrices/owner appearances use mutually exclusive presence branches;
child mint coverage includes the parent's proven absent tuples. No first-plane
substitution. Source/parent identity, independent dimensions and rigid matrices
are checked; absent ancestry, skew, unsupported descendants/layouts and live
owner visibility are named refusals. In-flow rotations keep their prior path.
The current supported subtree is free frames with ordinary rectangle/ellipse
leaves; this does not qualify arbitrary rotated text, instances or vector paths.

The real REST reader → proposer → both React emitters test preserves the
independently captured native leaf bounds within 1/64px across two sizes and
repeated prop changes. Native compilation retains the local ink child and
selects one affine branch per size. Source evidence remains unmodified. The
focused suite plus existing instance-forwarding regressions passed 91 tests;
final targeted suite adds the in-flow guard (7/7). Typecheck and repo lint pass.

Read all 432 Spinner nodes' local geometry from live native Figma (read-only)
and enriched the saved 24-variant dump for a diagnostic replay. All 24 generate
and compile. Fresh paired layout/render PNGs pass the existing export qualifier.
Unchanged image/size checks: before 16/24; after 17/24 on BOTH React surfaces.
19 worse-background scores improve, four hold, one increases from 0 to .390625%
(size 2/state 6, still passing); one new image pass, zero lost image passes.
This is a current-native-geometry diagnostic with saved paints, not a fresh REST
first-pass result or full content qualification. No scoreboard credit.

Seven remaining image failures are all size 1 (12px). Current native paint and
DOM inspection on state 1 match leaf dimensions/positions within 1/64px and
resolved paint values apart from existing alpha serialization. Pixel inspection
shows fractional native bars and CSS boxes have different paint coverage: e.g.
1.5px bar at x=5.25 yields native middle alpha 119/119 versus browser 159/159.
The source-local frame defect is repaired for this class; fractional box paint
needs a separate generic diagnosis. Do not relax thresholds or claim 24 passes.

Evidence: private paired-regression-integration/local-frame-lowering-970 stores
source geometry, paired PNGs, generated modules/native plans, before/after
comparisons, scripts and test logs. Fixed40 remains 502/879 first-pass, 646/879
replay-adjusted; reverse unqualified. Full release/engine-receipt qualification
and authenticated smoke pin revalidation remain pending; nothing published.

## Experiment 971: identify fractional paint-space loss; repair plugin packaging

Previous turn committed local-frame lowering with measured image improvement.
Full204 session 63865 polled live; latest observed completion 202/204, so its
score is not final and heavy timed release gates remain deferred.

Bounded browser diagnostic using 970's current-native paired PNGs and unchanged
framing/scorer: replacing each individual CSS bar paint with an equivalent SVG
rectangle improves the module replay from 17/24 to 19/24. Placing the same eight
rectangles in ONE root-relative SVG paint plane passes 24/24 in both module and
inline React, with 0% thresholded image difference on both backgrounds and
unchanged root sizes. All eight source ink leaves are asserted per case. This
is an experimental DOM repaint of generated code, NOT production conversion,
not byte-identical pixels, and not scoreboard/held-out/reverse qualification.

Probe corrections preserved: initial per-leaf trial retained injected DOM
across React renders; initial shared SVG lacked a positioned containing block;
initial inline cleanup removed authored inline paint rather than restoring it.
Final probe restores the exact original inline styles after each case and
checks eight painted leaves, preventing a faint omitted bar from hiding behind
an image threshold. Shared-plane results now agree across both React surfaces.

Next renderer work should derive the shared paint coordinates from proven
contract geometry, retaining native editable structure and source constraints.
Do not ship the diagnostic DOM-measurement code or relabel CENTER/STRETCH
relationships as SCALE just to reuse the existing path parentViewport carrier.
The finding isolates a coordinate-space/rasterization issue, not missing fonts
or a need to lower the comparison threshold.

Created a clean qualification worktree at /private/tmp/ds-contracts-beta-gates-971
from 66a5bfc99. Fresh npm ci and all four workspace builds pass. Plugin packaging
first refused because ui.html's embedded dump reader was stale. Re-embedded the
canonical reader and deliberately rebuilt the engine receipt in this clean
checkout (excluding parked writer changes); ordinary zip verification now passes.
The refreshed engine fingerprint is eb07ab7bdc7e, 2,122,304 minified bytes.
Copied only the generated UI and engine receipt back to the code writer.

Root audit found GHSA-68fv-2mgg-jv7q in source-map-js 1.2.1. Updated only that
locked package to registry-verified 1.2.2; discarded npm's unrelated libc metadata
rewrites. Fresh npm ci with this lock passes; root full and production audits
report zero advisories. Rebuilt CLI; 111 CLI tests and the complete headless
plugin-engine flow check pass. The plugin zip still verifies with the patch.

The all-lockfile audit remains RED: benchmark/react-family and
benchmark/shadcn-cohort each report 11 high/critical affected packages;
workers/assist reports miniflare/sharp/wrangler. Preserve these findings for
targeted upgrades and verification; root audit green is not full release green.
Authenticated smoke pin revalidation and the full fast/release lanes remain open.

Evidence: private paired-regression-integration/paint-and-release-971 (diagnostic
code, PNGs/comparisons, initial probe errors, builds, audit JSON/logs and plugin
checks). Fixed40 unchanged at 502/879 first-pass, 646/879 replay; reverse
unqualified. No release, tag, publish or tester distribution.

### Full204 completion after experiment 971

Exec session 63865 returned terminal exit 0. Authoritative summary/coverage in
private/beta-kits/full204-938 completed 2026-10-06T21:38:47.064Z at pinned
c68073e32feb319118e268b9c3afc0c2b2b095fa: 204/204 sets, 39 fully passing;
2,522 pass, 2,224 fail, 1,566 unverified out of 6,312 declared variants
(39.95564005% first-pass). All 204 rows and denominator sum verified. There
are 997 unmeasured variants; these remain in the denominator. No per-result
variant-count mismatch. This broader sample is not the fixed40 score and does
not measure changes made after its pinned revision. Reverse remains unqualified.

Clean qualification checkout advanced to d08135699 after verifying its three
generated/lock changes exactly matched that commit; no reset, stash or discarded
work. The fast lane has now started there (log /private/tmp/paint971/fast-lane.log).
Full audit findings and authenticated smoke revalidation remain open.


## Experiment 972 — targeted dependency repair

Updated six transitive packages in both identical benchmark lockfiles: MCP SDK
1.32.1, ip-address 10.7.3, postcss-selector-parser 7.1.6, proxy-addr 2.0.8,
qs 6.16.0 and source-map-js 1.2.2. Direct component/tool versions unchanged.
Fresh npm ci and Vite production builds pass in both benchmark projects;
shadcn 4.16.2 and Tailwind 4.3.3 command smoke checks pass.

Worker sharp override 0.35.5 patches the librsvg advisory without changing
Wrangler/Miniflare. Fresh npm ci, typecheck, all 91 worker tests, and actual
native sharp PNG creation/resize/readback pass. Worker audit is now clear.
Documented the existing Node 22 requirement for Wrangler/Miniflare; Node 20
handler tests passing does not qualify Wrangler development or deployment.

All-lockfile audit remains RED: each benchmark reports eight high affected
packages stemming from braces <=3.0.3; registry latest is still 3.0.3. No
forced downgrade, advisory suppression or gate relaxation. Root, worker and
other audited locks report zero advisories. These repairs do not change any
fidelity score. Fast lane is still running in the separate clean d08135699
checkout; it does not include these dependency changes.

Evidence: private paired-regression-integration/dependency-repair-972 contains
before/after audits, lock snapshots, install/build logs and native sharp smoke.
Full204 stays 2522/6312 (39.96%) at its pinned older revision; fixed40 first-pass
502/879; reverse unqualified. Authenticated smoke revalidation and release
qualification remain open. Nothing published, tagged or sent to testers.


## Experiment 973 — authenticated Badge pin revalidation

Previous turn made progress: dependency repairs committed as 9820c0582.
Qualification session 6919 remains live at d08135699; no restart or checkout
mutation. Its full result is pending, but it has reported legacy native-update
byte drift and two joint-token-bindings failures in figma:unset:check. Those
are real open gate failures; no frozen byte expectations were changed.

Ran the frozen Altitude Badge dump through d08135699's engine, packaged it,
and checked a fresh consumer against authenticated current Figma images with
SHA-pinned Public Sans. All 10 variants pass unchanged image/content/style/size
checks; worst image difference 2.982% on each background. This is a known-input
qualification replay, not a new first-pass or reverse scoreboard result.

Re-recorded only the Altitude Badge pin in an isolated temporary pin root using
the official recorder, then attached the fresh exact-generated-files receipt.
Official verdict green. Generated difference is Badge.tsx only; all 10 packaged
entry hashes are unchanged. This corroborates the previously inspected request
shape/type-assertion drift, not a runtime rendering change. Copied just that pin
and receipt to the code writer. Installed-CLI smoke must still be rerun against
the refreshed pin; do not claim the complete release lane passes.

Evidence: private paired-regression-integration/badge-qualification-973, including
command logs, generated request/package, live-image receipt/PNGs, font manifest,
isolated official recorder and its verdict. No source kit writes or publishing.
Full204 remains 2522/6312 (39.96%); fixed40 502/879; reverse unqualified.


## Experiment 974 — generated native RGB parser repair

Previous turn progressed with authenticated Badge pin commit 2dee895ae.
Fast-lane session 6919 is still running at d08135699; unchanged checkout.
Its two joint-token-binding failures reproduce locally. Native write/readback
instrumentation shows rgb(...) source variables captured as #NaN... values.
The token writer's template literal consumes regex escapes: emitted parentheses
and whitespace patterns are wrong, falling through to hex parsing. This is a
production writer defect, not a reason to relax importer omission/alpha guards.

Doubled escapes only inside the generated token-writer template. Compile-time
parseLitColor remains unchanged. Existing joint native round-trip tests now
pass, including transparent captured colors and mode-conflict refusal. Added
an explicit generated-script write/readback regression for space-separated RGB
and comma-separated RGBA, asserting captured hex values and no malformed colors.
All 10 joint-token-binding tests pass (2.4 seconds). Only the two parser lines
were staged from emit-figma-script.ts; unrelated parked root-paint edits remain.

Evidence: private paired-regression-integration/native-rgb-parser-974 contains
initial diagnostic, failing captured values, exact patch and passing tests.
Plugin engine receipt refresh from clean committed sources, broader native
regression checks, installed-CLI smoke and complete fast lane remain pending.
Do not ship the current stale plugin receipt. Legacy native-update frozen byte
failures are a separate open investigation; no pins for those were changed.
Both scoreboards unchanged: full204 2522/6312; reverse unqualified.


## Experiment 975 — preserve legacy native readback programs

Previous turn progressed with the native RGB parser repair f888e6bba.
Qualification session 6919 remains live on d08135699. Traced all three frozen
native-update byte failures to b2dc56377 adding targetAspectRatio unconditionally
to the inventory program. Saved scalar/root-size/token plans did not request
that field, so their authenticated script hashes changed without plan changes.

Contract readback now requests targetAspectRatio only when an observed spec
(including descendants and prepared-library graph components) carries a native
aspect-ratio lock. Generic inventory callers retain full field collection by
default. Existing absolute-shape and fixed-cross-size readers retain their own
required capture. No frozen expectations or historical plans were changed.

All 10 focused legacy-byte/aspect-ratio/fixed-cross-size readback tests pass;
all 30 prepared-library, absolute-shape-update and bound-cross-size-update tests
pass. Root TypeScript check passes. Evidence is private
paired-regression-integration/native-readback-compatibility-975.

The still-running full lane also reports ci:lanes, format, recipe perturbation,
canvas-to-code, held-out-v2, sync ledger and generated Flowbite freshness errors.
Distinguish intentional child-exit test output from real gate failures. Final
lane summary is pending. Clean plugin receipt regeneration and installed-CLI
smoke remain pending; neither this fix nor the prior RGB fix is release-qualified.
Full204 2522/6312 (39.96%); fixed40 502/879; reverse unqualified. No publishing.


## Experiment 976 — close missing test registration

Previous turn progressed with native readback compatibility commit 3f4b5519d.
Session 6919 is still live on its original d08135699 checkout. Its coverage gate
identified 25 committed test files absent from CI-invoked scripts. Registered
core/extraction cases in exact-proposal:check, two consumer cases in
 design:consumer:test, and source initialization in source:reference:check.
No exclusions added. ci:lanes now passes, including its three runner tests.
Only these registrations were staged from package.json; the parked untracked
degenerate-stroke test registration remains unstaged with its separate work.

Executed all 25 newly registered files: 84 tests, 81 pass, 3 fail. Remaining
failures: hidden-paint-stacking conditional-display refusal, and two
solid-fill-layer-compiler cases (binding plan/source-binding fixture shape).
These ran in the writer with its preserved parked root-paint changes, so repeat
against clean committed sources before attributing compiler failures. They
remain required tests; no expected result was weakened or test excluded.

Applied Prettier only to the two files named by format:check
(core/exact-proposal-check.ts and extract/figma/rest/closure.ts). Full configured
format:check passes. Evidence: private paired-regression-integration/
ci-registration-976 contains registration patch, file list and complete results.
Clean receipt rebuild, installed CLI smoke and other lane failures remain open.
Full204 unchanged at 2522/6312; reverse unqualified. Nothing published.


## Experiment 977 — clean plugin and installed CLI qualification

Previous turn progressed with 25 CI test registrations de8074d29. Fast-lane
session 6919 finished terminal exit 1: 15/201 gates failed at d08135699, 11
skipped by workflow conditions. Its final log remains /private/tmp/paint971/
fast-lane.log. No run was restarted on observation timeout. Verified clean
qualification checkout, then advanced it to de8074d29 after terminal completion.

Reproduced the two bound-fill compiler failures with a temporary HEAD copy of
the emitter (excluding parked writer edits); temporary source files removed.
Fixtures lack current required binding provenance (owner/nodeName/variantName,
plus authenticated source graph). Those failures remain open. Hidden stacking
failure was a stale refusal expectation superseded by f7f75a58a's supported
normal-flow text. Updated test requires explicit relative foreground positioning
for conditional display and still rejects explicit static placement. All four
hidden-paint tests pass. Combined composed-paint suite session 6773 remains
running; its partial passes are not a completed suite claim.

From the clean qualification checkout regenerated engine receipt 97c29218aabb,
2,122,432 minified bytes; ordinary plugin zip verification passes (2,480,870-byte
zip). Copied only receipt to writer. Installed-CLI smoke session 77434 finished
exit 0: empty-folder package reproduces refreshed Badge pin; tokenless variants
stay UNVERIFIED, browserless control NOT CHECKED, wrong font refuses. Kept
consumer /private/var/folders/dx/kt5qryjx605f2md58m5cg3n80000gn/T/
cli-figma-to-react-smoke-V5CaCU. No publication or distribution.

Evidence: private paired-regression-integration/package-qualification-977.
Remaining lane failures include recipes, sync ledger, Flowbite freshness,
code-only facts, design-to-code census, door-register/lowering citations, plus
new compiler-fixture failures and dependency advisories. Some earlier failures
have targeted fixes but no complete new lane pass. Full204 remains 2522/6312;
reverse unqualified. Broader bridge acceptance is not achieved.


## Experiment 978 — qualify bound-paint compiler fixtures

Previous turn progressed with clean plugin/CLI qualification 02f0b41d7.
The newly registered bound-paint compiler fixtures predated mandatory source
provenance. Replaced the invented paint.alpha token with an explicit observed
variable/consumer mode and the existing token planner's output, including
owner, nodeName and variantName. Nested and root receiver tests still assert
layer order, resolved variable alpha, blend mode and exact dimensions. Missing
provenance is explicitly removed and must refuse both compile and write doors.
Alias substitution and value disagreement still refuse; no production guard,
scorer or acceptance threshold changed. Fixture source identities are test data,
not a claimed live capture or owner signoff.

All five compiler tests pass. Repeated with a HEAD-only emitter copy excluding
parked writer changes, plus independent layer observation, bound inventory and
scoped binding tests: all 12 pass. Temporary source copies removed. The separate
composed-paint session 6773 now finished exit 0, 38/38 tests, including native
image comparisons. Its final log is /private/tmp/paint977/stacking.log.

Evidence: private paired-regression-integration/bound-paint-fixtures-978,
including clean-emitter tests and the completed composed-paint log. The original
full lane remains terminal red (15/201 at d08135699); targeted fixes do not
relabel it green. Remaining work includes recipe/census evidence, generated
freshness and citation/ledger failures, then fresh qualification. Full204 stays
2522/6312; reverse unqualified. No release or publication.


## Experiment 979 — rederive source citation registers

Previous turn progressed with binding-fixture repair 5f07a059a. Advanced the
clean qualification checkout to that commit after verifying its sole modified
engine receipt already matched the committed receipt; no work discarded.
Official lowering-lines repair refused an ambiguous/changed emitted line.
The documented shift helper also correctly refused a changed hunk. Inspected
emit.margin-box-absent-on-amend in amendComponent: aspect-ratio application was
added to the cited line, while absence of marginBoxCall remains unchanged.
Updated that ruleText to the exact current line. Mapped other positions from
908f40e14 with exact source-text equality required; no fuzzy text matching.

Official lowering-lines --write, lowering:check and lowering self-test pass.
Official door-register:rederive, door-register:check and door-register:self-test
pass. Structural comparison proves only line/ruleLine fields changed in the
455-door register, and only those fields plus the reviewed margin ruleText in
the 64-rule lowering register. Rule prose/statuses, thresholds and census counts
unchanged. Copied four generated register/doc files to writer. Their positions
refer to clean committed code, not unrelated parked writer edits.

Evidence: private paired-regression-integration/citation-registers-979 includes
initial refusals, explicit mapping script, official check/self-test logs.
Sync ledger fixture classification, recipes/census, generated freshness and
dependency advisories remain open; no complete new fast lane claimed. Full204
2522/6312; reverse unqualified. No release or publication.


## Experiment 980 — sync fixture and fresh live drift census

Previous turn progressed with citation repairs de95c8685. The sync fixture still
used dump grammar 1.62 while the committed mapper speaks 1.63. Re-observed its
frozen raw REST fixture with the clean committed mapper. Alpha/Beta fingerprints
remain byte-identical; Gamma/Delta retain their intentionally unequal synthetic
baseline fingerprints. Serialized fixture via official ledger serializer with
current grammar. Verified all five statuses: Alpha in-sync, Beta code-ahead,
Gamma canvas-ahead, Delta conflict, Epsilon untracked; four undecided. Expected
observe exit 1 proves these negative controls remain active, not a gate failure.

Full sync:ledger:check still reports 31 real live-baseline/pending-decision grammar
errors; no committed live ledger or decisions were relabeled. Ran authenticated
read-only sync observe from clean qualification checkout: session 90963 completed
exit 1 with 128 records, 25 in-sync, 101 code-ahead, 2 conflicts, 103 undecided,
55 stale decisions, no untracked sets. Token loaded only inside subshell. No
Figma writes, baseline updates, adoptions, repins or decisions issued.

Evidence: private paired-regression-integration/sync-observation-980 contains
raw CLI reports, parsed JSON, fixture regeneration code and gate log. The CLI
prints a decision summary after JSON, so parsing uses raw_decode and preserves
the complete output separately. Review the two conflicts and stale decisions
before choosing any ledger mutations; exit 1 is not a network failure.
Full204 remains 2522/6312; reverse unqualified. No release/publication.


## Experiment 981 — evidenced sync grammar migration

Previous turn progressed with fresh live census and fixture repair 7d20cdb26.
Reviewed conflicts: Flowbite Alert and MUI Slider retain existing pending-reapply
intent; no reconciliation or canvas write performed. Captured the 31 records
with stale baseline or pending-decision grammar through authenticated REST GET.
Verified each source file version before/after capture. Replayed exact saved raw
responses with the 1.62 mapper from 162f53d6a's parent, alongside current 1.63.
All 25 old baseline fingerprints match. All six pending decisions match old
fingerprint, code hash and canvas stamp. Other historical adopted decisions
were not changed. Node 20 lacks Map.groupBy; corrected evidence script before
any network work, then session 1058 finished exit 0.

Refreshed 25 observation baselines and six pending decisions using ledger
serializer/makeDecision/decisionBasedOn; regenerated PENDING.md. Every pending
kind, command, code hash and canvas stamp remains unchanged, with a specific
migration evidence note. Assertions verify all other record fields unchanged.
The two conflicts remain unresolved, and the pending actions still require their
existing review. This is observation migration, not adoption or approval.

sync:ledger:check now passes: 128 records, 70 receipt citations verified,
25 baselines at 1.63, deterministic ledger and exact pending render, all five
fixture drift statuses preserved. Temporary old mapper removed from clean
checkout after archiving. Evidence: private paired-regression-integration/
sync-grammar-migration-981 (raw REST responses, old mapper, per-record comparisons,
migration script and gate output). Full204 2522/6312; reverse unqualified.
No publication, Figma mutation, or full release qualification claimed.


## Experiment 982 — align aspect-ratio fact gate with native support

Previous turn progressed with verified live ledger migration bd9d8d999.
Inspected remaining lane errors: recipe generated TSX/receipts and Flowbite
scripts need separate reviewed regeneration. code-only-facts:check still asserted
that every aspect ratio is unavailable, predating b2dc56377 native frame locks.
Updated its known-width frame case to require nativeAspectRatio=2, width=80,
height=40 and no false lost-channel fact. Unsupported widthless geometry and
explicit-height precedence still require their specific named loss reasons;
removed only the obsolete claim that Figma has no aspect-ratio field. Existing
parent/absolute-child loss checks and unknown-channel checks remain intact.

code-only-facts:check passes. All four native aspect-ratio tests pass, including
actual emitted-script mock write/readback, explicit-height precedence, missing
native API refusal and malformed native readback refusal. No compiler changes,
scorer/threshold changes, or first-pass improvement claimed. Evidence: private
paired-regression-integration/aspect-ratio-fact-gate-982. Full204 remains
2522/6312; reverse unqualified. Remaining recipe/census/generated-freshness
failures and dependency advisories still prevent full release qualification.


## Experiment 983 — refresh Flowbite paste artifacts

Previous turn progressed with native ratio gate alignment 07ec37595. Advanced
clean qualification checkout to that revision after verifying four local citation
files matched their committed successors. Generated all eight Flowbite scripts
through the public CLI into a temporary output directory. Reviewed every changed
line: eight runtime revision updates rt21 -> rt22 and Button outline alignment
carriage (outlineStrokeAlign override and literal outside stroke handling).
No contract, token, bundle, source receipt or scoreboard changes.

Copied generated scripts into clean checkout and ran the existing combined
GENESIS-BATCH builder. Its mock execution created 8 sets, 91 variants and 331
variables (Alert4, Badge24, Button45, Card1, HelperText5, Kbd1, Label5,
ToggleSwitch6). flowbite-bundle-fresh:check passes, including deterministic bundle
rebuild, all eight script byte comparisons, events, semantics and geometry facts.
Copied only nine generated paste artifacts to writer. This is mock/runtime
packaging evidence, not live native fidelity or tester acceptance.

Evidence: private paired-regression-integration/flowbite-artifacts-983 includes
fresh generator output, per-script reviewed diffs, batch mock and gate logs.
Remaining recipe/census failures and dependency advisories stay open. Full204
2522/6312; reverse unqualified. No Figma writes or publication.


## Experiment 984 — reviewed current recipe recordings

Previous turn progressed with Flowbite artifact refresh 326ed7f3e. Advanced clean
qualification checkout to that commit, preserving its already-committed generated
files. Ran official current perturbation and canvas recorders into new temporary
directories. Authenticated historical inputs unchanged. Complete file comparison:
only generated ButtonSetButtonButton1Proof.tsx changes Error to globalThis.Error;
canvas receipt changes its emitted-file hash accordingly. Perturbation result,
render ledger and other files are byte-identical; canvas accounting unchanged.
Both mount all 144 cases; zero silent/unexplained deltas. Copied recordings into
new current-global-error-2026-10-06 directories and updated current pointers.
No historical or frozen versioned evidence overwritten.

Perturbation apply gate passes 6/6 tests. Canvas facts and current replay pass;
its test suite finishes 14/15. Remaining failure is real: hidden instance test
cannot mount Badge because React receives a string style prop, at
recipe/canvas-to-code-mixed-size.test.ts:138. Existing designer Badge screenshot
checks still pass, worst 4.9123%; these do not excuse the mount failure. Session
95157 terminal exit 1. Inspect prop-name/native-style collision next, retaining
the failing test and full denominator. Do not call the recipe gate green.

Evidence: private paired-regression-integration/current-recipe-recordings-984
contains official recordings, reviewed TSX/hash differences and complete logs.
Full204 remains 2522/6312; reverse unqualified. No publication or native writes.


## Experiment 985 — recipe render boundary honors code bindings

Previous turn progressed with reviewed current recipe recordings 5317673ce and
exposed a CBDS Badge mount failure. Traced to renderCells: mountCells intentionally
keeps canonical contract props for accounting, but the renderer passed those raw
names to React. The generated Badge correctly renames its design Style axis;
the harness bypassed bindings.code.prop and fed a string to native style.

Render boundary now maps canonical names and values through bindings.code.prop
and explicit bindings.code.values, using own-property checks to preserve mapped
null/false/zero values. Canonical MountCell props and variant tuples remain
unchanged for fact accounting. Added fixture assertions that the failing journey
really has a canonical style axis and a distinct React code prop. Existing
absence/count/error controls still execute after the successful mount.

All four mixed-size/hidden-instance tests pass. Complete canvas-to-code gate
passes 15/15, including current replay and frozen screenshot comparisons. Root
TypeScript check passes. No emitter or historical evidence changes; no live
fidelity gain claimed. Evidence: private paired-regression-integration/
recipe-code-bindings-985. Full204 2522/6312; reverse unqualified. Remaining
held-out/census qualification and dependency advisories are still open.


## Experiment 986 — held-out regression identified; baseline retained

Previous turn progressed with recipe code-binding repair 81bb1f340. Advanced clean
qualification checkout to that revision. Session 48332 completed terminal exit 1:
held-out designer gate reports current artifact drift; design-to-code census still
refuses figma-ds on WEB_COMPONENT_PRESENCE_COMBINATION_UNSUPPORTED. The census
explicitly runs both React and WC, not just the selected React V1 path. Left
its gate and paused WC implementation unchanged; do not claim it green.

Recorded fresh designer cohort to private temporary evidence (session 32218,
exit 0) and compared all 24 result identities. Baseline has seven accounting
successes/132 mounted; current has six/112. CBDS Radio regressed from 20 mounted
variants to emit refusal: part contentTop layoutByCombination requires an owned
flex container without shape, grid, instance, or layoutByProp. Menu, Checkbox,
and Badge retain their outcome/count with changed details. All other outcomes
unchanged. No current baseline pointer or expected artifact was updated to accept
the regression. Accounting success is not pixel/first-pass qualification.

Next priority: inspect the CBDS Radio proposal and preserve its conditional
layout on a valid owned container, then rerun the exact saved source through
emission/rendering before accepting any fresh cohort recording. Other known
refusals include state-preview axes not mapped by recipe mountCells and textarea
child handling; these remain named. Evidence: private paired-regression-
integration/held-out-regression-986 contains full replay and both failed gate logs.
Full204 remains 2522/6312; reverse unqualified. No publication or Figma writes.

## Experiment 988 — restore conditional growth with joint internal layout

The preceding daily check-in was a status-only turn. Revalidated Radio's actual
proposal: its contentTop has joint internal flow/paint layout plus a per-state
parent growth rule. Missing explicit display was not the failure (flex defaults
are valid); removed the ineffective uncommitted proposer edit from experiment
987. The validator unconditionally rejected coexistence of both tables.

3b00caa97 permits only a disjoint pair: a non-growth joint layout table and a
layoutByProp containing exclusively grow/growBasis. Conflicting internal layout,
foreign ownership and all existing growth allocation restrictions remain refused.
New existing-gate test verifies four combinations in both React renderers,
including actual widths/alignment, native compiled FILL/alignment, and rejection
of a competing alignment rule. Related layout/paint/growth tests pass 27/27;
root TypeScript check passes. No score threshold or source fixture changed.

Fresh replay from clean committed checkout restores Radio 20 mounted variants,
zero silent and unexplained deltas. All 24 designer outcomes compared against
986: Radio is the only outcome/count change, restoring seven accounting successes
and 132 mounted variants from six/112. Seventeen named refusals remain. These
are accounting outcomes, not pixel qualification; current baseline pointers and
frozen histories remain unchanged. Held-out artifact freshness still needs review.

Clean plugin build and ordinary verification pass with receipt c24af69df9b4,
2122567 engine bytes. Evidence archived in paired-regression-integration/
radio-growth-layout-988. Full204 remains 2522/6312 at its pinned older revision;
reverse remains unqualified. No publication, push or Figma writes. Next: clear
remaining React journey refusals and qualify the complete candidate; no full
fast-lane success claimed. Historical handoff expected two stashes, but today's
read-only stash listing returned zero; this turn performed no stash operation.

## Experiment 989 — mount source interaction states faithfully

Previous turn progressed with Radio repair 3b00caa97 and plugin receipt
4ed1701b8. Revalidated held-out refusals: Chip, Link and Toggle all stopped
because mountCells assumed every source VARIANT axis must be a contract prop.
The proposer intentionally projects interaction states into browser behavior.

Recipe mount now uses the existing closed interaction-state vocabulary for one
otherwise unmapped source axis. Explicit generated previews carry states when
available; Chromium forces the real pseudo-class when there is no preview
rule. Disabled is passed through the actual boolean code input. Canonical
props remain strings for accounting, while rendering converts boolean values
and honors explicit code value mappings. Unknown/ambiguous axes still refuse.
No converter, threshold, baseline pointer or frozen evidence changed.

Existing-gate regression test mounts source Link states, verifies independent
hover behavior using a planted CSS rule, and confirms the actual missing source
padding is still rejected. The complete canvas-to-code gate passes 16/16 tests,
including the unchanged current replay and frozen visual comparisons. Root
TypeScript check passes. Initial
attempt to use proposal.stateAxisProjection was insufficient because reviewable
inversion does not populate that descriptor; final implementation uses shared
readStateAxis and the observed axis values instead.

Fresh full designer replay: nine accounting successes/188 mounted, up from
seven/132. Chip contributes 40 and Toggle 16 restored mounted variants. Link
now reaches measurement and fails on focus padding: expected 0/4/0/4px, actual
0/0/0/0px. Other 21 outcome/count identities unchanged; all 24 retained. Fifteen
refusals remain, including textarea's invalid child structure. These are
computed-style accounting gains, not visual scoreboard passes. Full204 stays
2522/6312 at its pinned revision; reverse remains unqualified.

Evidence: paired-regression-integration/state-mounting-989. Next: repair Link's
state padding through the shared converter, then textarea composition; review
fresh held-out recordings only after real regressions are resolved. No publishing,
push, native writes or full-fast-lane success claim.

## Experiment 990 — carry interaction-state root padding

Previous turn progressed with state mounting 28915b69d. Revalidated the source
Link focus drawing: left/right padding are 4px, bound to theme.space.xxs;
the default/hover/disabled drawings have zero padding. proposeStateDiffs never
read root padding, so it disappeared without an explanatory note.

d59ea2a35 adds independent per-side root state padding carriage. Captured bound
refs use existing reference unification and statesByProp; raw values use the
existing state minting path. Complete finite flex observations are required;
incomplete, mixed-binding and unrepresentable references remain named. Zero
padding resets survive, and active restores its captured padding when concurrent
hover differs even if active equals rest. No component-name special cases.

Actual Link now retains the 4px focus padding. Its regression test plants a
missing side and still observes a failure. Synthetic asymmetric padding tests
verify default/hover/pressed/focus, including active with concurrent hover and
explicit zero sides, in CSS Modules; native compilation retains all four state
planes and side bindings. The inline renderer's documented omission of
interaction-state styling remains a limitation, not a passing claim. Related
state suite passes 14/14; full canvas gate passes 16/16; root TypeScript passes.

Full 24-entry designer replay changes only Link's outcome/count: four variants
restored, ten accounting successes/192 mounted (previous nine/188). Fourteen
named refusals remain. Zero-silent accounting is not image fidelity. No baseline
pointer or frozen evidence changes. Full204 stays 2522/6312 on its pinned older
revision; reverse remains unqualified. Next: repair invalid textarea composition
and complete candidate qualification; citations affected by proposer line shifts
must be refreshed before a full lane. No push, publication or native writes.

Clean committed checkout built the plugin and passed ordinary receipt verification.
Evidence: paired-regression-integration/state-padding-990, including all attempted
checks, final green checks and complete cohort replay.

## Experiment 991 — preserve composed field structure without invalid textarea roots

Previous turn progressed with state padding d59ea2a35/59b9f7d20. Revalidated
Textarea's emitted JSX and captured source: a component contains label, input
frame and footer/helper instance. The name-only semantics table assigned native
textarea to the whole group, producing multiple element children and a React
runtime crash. The source has no authored native-control declaration to justify
inventing a functional control inside the empty input frame.

c6de91713 applies the existing inferred void-control container rule to textarea
with child parts. All drawn structure remains; proposal explicitly requires
review/native-control authoring before adoption. This is a visual field-group
proposal, NOT a demonstrated editable textarea. Authored/stamped semantics are
not overridden. Shared validation now refuses textarea element children at the
root and nested explicit parts before emission, while allowing plain text.

Source-backed regression test mounts all six variants and checks labels remain;
negative tests exercise root/nested authored invalid textarea structures and a
legal text-only control. Complete canvas gate passes 17/17, root TypeScript
passes. Fresh full designer cohort changes only textarea's outcome/count:
eleven accounting successes/198 mounted, previous ten/192. The restored field
has 25 named deltas, zero silent and unexplained deltas; this is not a visual or
functional pass. Thirteen named refusals remain, and semantic review obligations
are not erased by successful mounting.

Clean committed checkout built and verified the plugin receipt. Evidence under
paired-regression-integration/textarea-container-991 includes source replay,
full cohort comparison, checks and plugin logs. Full204 remains 2522/6312 at its
older pin; reverse unqualified. No publication, push or native writes. Next:
review updated held-out evidence and citation freshness, resolve remaining census
qualification, then run the full candidate lane; retain field-control behavior
as an explicit product limitation rather than calling this a completed input.

## Experiment 992 — reviewed current held-out recordings and citations

Previous turn progressed with composed-field repair c6de91713/44b56769a.
Advanced clean qualification checkout after proving its local receipt exactly
matched the committed successor. Official recorder replayed both cohorts into
a new directory at 44b56769a. Scratch is byte-identical. All 24 designer IDs
remain; no files removed, eight added, 38 changed. Both historical SHA inventories
are byte-identical to the prior recording.

Reviewed contract changes: state padding, root field-group semantics, growth and
paint-order tables, canonical/code prop mapping, and recovered bound token
channels. Every previously mounting case retains its outcome/count and has no
increase in named deltas. Radio named deltas decrease 156 to 136; Badge 168 to
72. Chip40, Link4, Textarea6 and Toggle16 restore 66 mounted variants, designer
132 to 198. Menu/Checkbox counts unchanged; Scratch unchanged. Semantics and
other named deficiencies remain explicitly unqualified.

Saved official output in a NEW current-state-mounts-2026-10-06 directory and
updated the current pointer. Old current and frozen versioned evidence untouched.
Both official gates pass: scratch replay plus 13 tests, designer replay plus
seven tests. This proves current deterministic accounting, not visual grades or
never-seen first-pass success.

Official door rederive moved only two proposer marker/rule citations by 32
lines and their two documentation rows. No prose, classifications, counts or
acceptance fields changed. Complete door check passes, including pinned census.
Evidence: paired-regression-integration/held-out-current-992. Full204 remains
2522/6312 at its older pin; reverse unqualified. Next is a fresh full fast lane
in the clean candidate checkout; design-to-code census/WC refusal remains a
known unresolved candidate issue, not a waived gate. No publishing/native writes.

## Experiment 993 — exact decimal dimensions unblock a 75-variant set

Previous turn progressed with reviewed recordings 0a6ed0404 and launched full
fast lane session 17641 in clean beta-gates-971. Re-polled that same live session;
no restart or checkout mutation. Census inspection isolates its known WC refusal
to Button(contract) slotBefore/slotAfter presence on iconOnly. Presence is real,
not a redundant table. Paused WC adapter remains unchanged; gate not waived.

Prioritized the completed full204 misses while qualification runs. Reproduced
Ant Design Treenode/1st-Level refusal from its exact saved dump: 75 variants
blocked by parent/line width 1.7484558156866115e-7px outside scalar literal grammar.
The observed width is finite; clamping it to zero would change source evidence.

0babeaea2 extracts the existing exact decimal expansion from shadow handling
into css-decimal.ts and reuses it for minted numeric dimensions, scalar values,
and geometry fallback literals. No value rounding, grammar loosening, scorer
changes or component special cases. First fallback-only diagnostic packaged but
retained a refused per-variant token table; final mint formatter also preserves
that table instead of falling back to its first occurrence.

Related shadow/literal tests pass 20/20, including exact numeric round trips for
small, negative, large and ordinary values and a tiny source frame's minted token.
Root TypeScript passes. The public headless conversion API now packages the
exact saved TreeNode input with 20 proposed dependencies and zero skipped sets.
This is packaging evidence; no 75-variant fidelity gain claimed yet. Authenticated
unchanged consumer checker started as session 69359, output
/private/tmp/census993/tree-check.log and eventual tree-verdict.json. Keep polling
that handle; no rerun while live.

Built and ordinarily verified plugin receipt in a separate clean detached
checkout /private/tmp/ds-contracts-decimal-993 at 0babeaea2, reusing qualification
node_modules; this preserves the running full-lane checkout at 0a6ed0404. Source
changes require citation freshness follow-up. Evidence: paired-regression-
integration/decimal-dimensions-993. Full204 stays 2522/6312 at its old pin; reverse
unqualified. No publishing, push or native writes. Next: finish existing full
lane and TreeNode visual check, classify their actual failures, then continue.

## Experiment 995 — fresh import reproduces fixed nested text loss

Previous status turn was a verified wait: full candidate lane session 17641
remained live. Re-polled the same handle this turn and observed advancement
through the full census and usable self-test into design-to-code census; no
restart or mutation of its checkout at 0a6ed0404.

Completed decimal TreeNode replay: 10 pass, 65 fail, zero unverified out of 75.
The unchanged checker reports 288 missing-content reasons, with three failures
on each image background. These are bounded replay results, not an update of
the 204-set score. One inspected failure draws repeated parent labels in place
of source 1-1 through 1-8 even though its image difference is below 5 percent.
Content checking correctly prevents that from becoming a pass.

Read-only authenticated REST capture at source version 2405846048518776045
finds the precise text target under outer instance 50193:1254. Its subtree has
only ten nodes, disproving the suspected 200-node traversal-budget cause.
Current mapping records instancePath [0,2], childPath [0], main 4377:140 and
full nested node identity. The historical dump has the label but lacks this
target metadata; it remains untouched.

Ran the normal URL importer into a NEW directory, following all dependencies:
20 captured/proposed sets, zero skipped. The resulting public conversion
request still contains none of labels 1-1, 1-2 or 1-8. Thus stale metadata is
not sufficient to explain the defect. Current nestedCharacterRoutes requires
propRefs.mainComponent, and carryNestedCharacterCaller requires an existing
swap slot. This source's fixed Text/Text child has neither. The next repair
must forward identity-qualified text through fixed component references,
preserving defaults and rejecting mismatched identities; name guessing or
inventing a swap slot is not supported by this evidence.

Official door rederive/check completed in decimal-993. Compared JSON after
removing only line/ruleLine: exact equality. Copied the 141 citation-only door
updates and generated documentation into the writer; no classifications,
premises, receipts or acceptance counts changed.

Evidence: paired-regression-integration/nested-text-diagnosis-995, including
fresh captured closure, generated request, conversion notes, completed saved
source verdict and citation-check output. Variables scope remains unavailable
and the fresh capture declares resolved-value degradation; four stroke SVG
fetch refusals are also retained. No publication or Figma write. Full204 stays
2522/6312 at c68073e32; reverse remains unqualified. The original 80 percent
never-seen bidirectional finish line remains unchanged.

## Experiment 996 — fixed nested text forwarding and completed qualification

Previous turn progressed with acc68e853 and a fresh-source reproduction.
Candidate full fast lane 17641 completed exit 1 at 0a6ed0404: one failure
out of 201 reported gates, eleven skipped by workflow conditions. The sole
failure is design-to-code census, WEB_COMPONENT_PRESENCE_COMBINATION_UNSUPPORTED
for the previously diagnosed real Button slot presence. Earlier qualification
had fifteen failures; no gate was waived. The clean qualification checkout was
advanced only after the handle was terminal and git status was clean.

e43ab6356 extends numeric-path/source-key character routing through a fixed
nested instance. The freshly proposed intermediate gets an editable text input
forwarding to its independently qualified child control. Its own explicit
applied text remains the default, falling back to the child's default only when
no value was applied. Caller values use the existing parent text reference
representation; swap slots retain their existing content route. Stamped or
supplied API controls are not fabricated. Unqualified conditional ownership is
named without discarding the component. Live native TEXT forwarding remains an
explicit unsupported-link refusal, verified by a regression test.

34 related character/visibility tests pass, including browser caller changes,
separate wrapper/leaf defaults, wrong keys, wrong numeric paths, stale main/node
identities, and the native refusal. Root TypeScript and diff checks pass.
Fresh TreeNode URL closure still packages all twenty sets with zero skipped.
Labels previously absent from the request now occur in generated inputs.

The unchanged authenticated visual checker completed: 17 pass, 58 fail, zero
unverified out of 75. Earlier saved-source replay was 10/65/0; the same variant
keys are present and all ten prior passes remain passes. Capture vintages differ,
so this is not yet an isolated same-input before/after. Missing-text reasons
fall from 288 to 216; three image failures on each background remain. The
remaining first-level child labels report no complete text mapping, despite
qualified nested controls: inspect occurrence alignment and sparse axis domains
next. Do not add seven to the old full204 total.

Clean checkout built and ordinarily verified plugin receipt 38cb9b503058,
2127243 bytes. Official citation rederive/check passes; stripping only line and
ruleLine proves register meaning unchanged. Evidence saved under
paired-regression-integration/fixed-nested-text-996, including completed prior
full-lane output, new verdict, receipt, request and tests. No push, publication,
Figma writes or acceptance-threshold changes. Full204 stays 2522/6312 at its
older pin; reverse remains unqualified. Next: paired fresh-input baseline and
complete observed-domain text mapping, then remeasure actual gains.

## Experiment 997 — present-domain text mapping reaches 73/75, icon gap exposed

Previous turn progressed with e43ab6356/ed85fdf5d. Reused the preserved pre-fix
package from experiment 995 and checked it against the SAME fresh dump/fonts
as the candidate: baseline 10 pass, 65 fail, zero unverified. This eliminates
the prior different-capture ambiguity without editing historical recordings.

5d16cafb1 fixes identity-qualified character lookup over the instance's observed
occurrences. The old lookup demanded every value of a parent axis even where
the instance was absent. Each present reading still must agree for its axis
value; conflicting observations remain refused. Undefined inputs are omitted,
never replaced with guessed text. Existing sparse-inference checks stay active.
A failing-before regression now renders One/Table, Two/Board, Three/absent and
One/Table again in both React emitters. All 35 character/visibility tests and
root TypeScript pass. No schema or scoring threshold changed.

Fresh full TreeNode closure packages twenty sets, zero skipped. The unchanged
checker on the same capture measures 73 pass, two fail, zero unverified, versus
the paired baseline's ten pass. All original passes remain passes. All 288
missing-text reasons disappear. Two selected/checkable image mismatches remain
at 6.66 and 14.43 percent on both backgrounds. Inspected the collapsed case:
the source label's selected background is absent in the generated result.

IMPORTANT VISUAL LIMITATION: inspection of a scored-pass eight-item expanded
triptych shows generated gear icons where the source shows file icons. Thus
73/75 is the current checker result, NOT proof of every icon being correct or
full goal acceptance. Preserve this defect and investigate nested icon identity
next; no threshold or scorer was changed to conceal it. The triptych was queued
in the app review panel and saved with the evidence.

Screened all forty frozen fixed40 dumps for this code path: 31 direct text
targets across two inputs (ADS 76953:136795 and Twilio 29411:192627), no nested
targets in any input. Both affected public-engine requests, including outcome
and notes, are byte-identical before/after. This is focused offline regression
evidence, not a new forty-set visual score. Other thirty-eight inputs never
enter identity character mapping. Broad full204 stays at its older pin.

Clean candidate at 5d16cafb1 built and ordinarily verified plugin receipt
9d6e160168cc, 2127218 bytes. Official door rederive/check passes; only citation
line fields differ. A checkout advance initially refused already-integrated
local generated receipts; preserved those in detached commit a56267223 before
switching, then rebuilt and checked the intended current revision. No stash,
reset or unrelated file deletion. Evidence: paired-regression-integration/
observed-text-domain-997. Full204 stays 2522/6312; reverse unqualified. No push,
publication or Figma writes. Next: missing nested icon identity and selected
label paint, retaining the native forwarding and remaining census limitations.

## Experiment 998 — correct selected icons and paint, TreeNode 75/75

Previous turn progressed with 5d16cafb1/4b3a7130e and explicitly recorded the
incorrect gear icons in scored passes. Fresh source already captured the fixed
File swap key. Demand-prioritized dependency ordering traversed ordinary
instances but omitted selected swap dependencies. File was proposed too late,
so the caller kept the wrapper's Setting default with an unresolved-content
note. 2407efe4e traverses fixed swap keys before proposing the demand owner;
names still do not authorize identity and cycle handling is unchanged.

The remaining selected-label background was present as a NORMAL source paint,
with an inheritFillStyleId root override rather than a fills flag. The same
commit admits that signal into existing root-paint observation. All same-file,
key, declared input, independent NORMAL/empty paint, alpha and resolved-color
checks remain required. It creates no inferred variable alias. Wrong identity,
missing observation, contradictory color and no override signal still refuse.

Failing-before regressions verify dependency order, keyed caller selection,
unchanged standalone wrapper default, rendered caller changes, and inherited
paint rejection cases. All 110 related tests pass; TypeScript passes. Targeted
lint exits zero with existing warnings away from the change. Public conversion
packages all twenty TreeNode closure sets, zero skipped.

Unchanged authenticated checker on the same fresh capture: 75 pass, zero fail,
zero unverified, versus the paired pre-repair baseline's 10/65/0. Worst image
difference is 0.659722 percent on both backgrounds. Manually inspected expanded
eight-item and collapsed selected/checkable triptychs: file icons now replace
the incorrect gears, and the selected-label background is restored. Queued the
corrected expanded comparison in the app; images saved with evidence. This is
a captured-set visual replay, not first-pass never-seen or interactive/native
qualification, and does not silently increase the old full204 total.

Offline public-engine comparison across ALL forty frozen benchmark inputs:
39 byte-identical requests. Only ADS Code parts / ModalFooter changes, adding
an explicit transparent background input to its nested spinner. Both old and
new public packages pass all three source comparisons, with identical maximum
0.291667 percent image difference. An initial diagnostic enumerator encountered
a null resultFile on a historical refused row; the completed forty-input pass
uses all forty preserved dump paths, keeping those cases in the denominator.

Clean candidate at 2407efe4e built and ordinarily verified plugin receipt
f5ea4582885b, 2127368 bytes. Official door rederive/check passes with only line
citation changes. Preserved already-integrated receipts in c08ed69ec before
advancing the clean checkout; no stash/reset. Evidence: paired-regression-
integration/selected-icon-root-paint-998 includes before/after requests for all
forty inputs, paired modal checks, TreeNode receipt/verdict and reviewed images.
Full204 stays 2522/6312; reverse remains unqualified. The prior full fast lane
has one census/WC presence failure, and live native text forwarding is still
unsupported. No push, publication or Figma writes. Next: prioritize remaining
full-sample failures and reverse qualification using these preserved gains.

## Experiment 1000 — native Carbon capture clears the Tile packaging refusal

The owner check-in was status only (no new qualification evidence). Resumed
the experiment 999 Carbon variable investigation on unchanged 0e7079614.
Native API reads resolve Transparent at Revert AI button 58483:6364 to the
White Theme mode and exact alpha 0.000009999999747378752. The previous REST
capture lacked the consumer evidence required by mixed-paint qualification.
No consumer check or color threshold was relaxed.

Enabled the existing Desktop Bridge in Carbon A451UfD58U7XU21FzaqfHL for
read-only capture. The diagnostic bounded-page adapter failed because its
local-set inventory excluded readable dependencies; direct native lookup
proved Revert AI button main 52962:446744 under set 55778:919 is readable.
Restored the repository serializer's normal inventory. Only TARGET_SETS=Tile
and INCLUDE_DEPENDENCIES=true changed. The initial full-file read exceeded
the transport timeout; health probes were initially unresponsive, then console
logs proved successful completion at 27 sets after approximately 74 seconds.
No duplicate capture was started while completion remained unknown.

A second read after confirmed completion took six seconds with pages loaded.
Retained the complete 6,330,941-character JSON in plugin memory and retrieved
it in chunks to avoid a lost large response. Local dump SHA256 is
8aedab325abcc1c99b452292b4e1da664c07a6c091685c36f0650bbdf3f467f0.
The public figmaToReact path packages Tile and all 26 dependencies, zero
skipped sets and no consumer-missing notes. This proves the native capture
can clear this specific packaging refusal; it does not prove visual fidelity
or establish a current broad-score gain.

Evidence: paired-regression-integration/carbon-native-capture-1000 preserves
variable metadata, failures, full dump, converter output and reproducible
check script. Unchanged 65-variant visual check with authenticated font
manifest (including IBM Plex Sans) is running as shell session 63836; output
is /private/tmp/carbon1000/verdict.json when complete. Re-poll this session
before restarting anything. Full204 remains 2522/6312 at its older pin;
reverse remains unqualified. No product source change, publication or canvas
mutation. Next: inspect the completed visual check, then address measured
remaining defects rather than declaring native packaging a pass.

## Experiment 1001 — Carbon Tile 53/65 qualified; detached main blocks Accordion

Experiment 1000 was progress (new native capture and complete public package).
Re-polled shell session 63836: terminal exit zero. The checker verdict is fail
overall with 53 passing variants, zero scored failures, and 12 unverified.
All twelve unverified reasons are paint-extent-blend-promotion-changed-raster:
the checker cannot prove its compositor promotion preserves the exact raster.
No threshold, framing guard or scorer changed. Inspected the Base and selected
multi-select Hover triptychs: expected text and checkbox appearance are carried.
This is fresh captured-set evidence, not never-seen first-pass qualification;
the old full204 numerator is unchanged. Archived the complete check directory,
verdict and log beside experiment 1000, including source/consumer images.

Tested generality by requesting a normal native closure capture of Carbon
Accordion item 2154:8478 (120 variants), retaining the same serializer and
dependency checks. It refuses at hidden instance 11520:386506 referencing
_Accordion content skeleton base. Native getMainComponentAsync and independent
getNodeByIdAsync both return main 2464:17121, key
dfa671797be29953acf7e71ee8900e8a1a749af2: COMPONENT, remote=false, removed=false,
parent=null, no variant properties, four children, 161 by 64. Consequently it
is absent from the document-page inventory. This is distinct from the earlier
bounded-wrapper inventory mistake: the unmodified whole-file census also
cannot enumerate this detached main. Do not relabel it remote or assert local
document ownership. Existing remote-main snapshot rules intentionally reject
remote=false; any support needs an explicit independently checked provenance
case and regression coverage before capture is retried.

Saved exact Accordion refusal and native main reads with the same evidence.
No running measurement process remains; no source mutation, publication or
product-code change this turn. Full204 stays 2522/6312 at c68073e32; reverse
unqualified. Next: qualify readable detached-main capture without inventing
library ownership, and preserve the twelve Tile framing refusals separately.

## Experiment 1002 — capture independently verified detached definitions

Prior turn was progress: completed Tile measurement and live detached-main
diagnosis. 749ef5e78 adds a distinct detached-main-snapshot to the native
dependency capture. A non-remote standalone COMPONENT must be readable,
not removed, parentless, keyed, finite-sized and free of variant properties;
an independent getNodeByIdAsync lookup must corroborate that identity.
The proposal verifies capture file, set/variant identity and lookup witness,
rejects conflicting remote provenance, and explicitly disclaims original
library ownership, edit authority and unseen variants. Existing remote-main
and remote-set rules remain intact. Canonical dump is v1.74 and embedded copy
is synchronized. 74ba90b8d registers the new tests while preserving the unrelated
parked package edit in the working tree.

Live Carbon Accordion capture now completes: nine sets, including the observed
detached skeleton, instead of DEPENDENCY_CAPTURE_MAIN_UNREADABLE. Preserved
the full native dump and real detached-definition fixture. Public conversion
advances to a different refusal: accordionHeader layoutByCombination lacks
complete finite coverage. No package or visual pass is claimed for Accordion.
The live capture was taken before the additive version-label bump; its recorded
v1.73 label is preserved, not rewritten after capture.

Eight focused detached/remote provenance tests pass, including the real native
fixture and wrong-key, removed, parented, variant-fragment and conflicting
identity refusals. TypeScript and targeted lint pass. ALL forty frozen public
engine inputs produce identical requests/refusals to experiment 998. Clean
candidate plugin builds and verifies engine 603dcc89a847, 2128009 bytes; official
door rederive/check passes with citation-only changes. Previously integrated
clean-checkout receipts preserved in detached commit 32c87166b before advancing.

Evidence: paired-regression-integration/detached-main-capture-1002. No canvas
mutations, push or publication. Full204 remains 2522/6312 at its old pin;
reverse unqualified. Tile remains 53 pass/12 unverified from experiment 1001.
Next: diagnose Accordion header layout coverage from the preserved complete
capture without expanding or fabricating its observed variant domain.
The registered React conformance suite is additionally running as shell session
72318, log /private/tmp/detached1002-conformance.log; re-poll before restarting.

## Experiment 1003 — Accordion packages; visual fidelity remains failing

Prior turn landed detached capture support. Re-polled React conformance session
72318: terminal exit zero, all 266 tests pass. Preserved that full log.
The captured Accordion header exists visibly in 96/120 states; two additional
hidden skeleton instances supplied paint-order layout rows. The layout table
had 98 rows, while the validator required all 120 Cartesian states because its
presence-domain path only handled explicitly drawn variant declarations.

a2403d71a excludes source layout rows for owners whose captured combination
presence is false. Layout validation now enumerates complete reachable variant
tuples, evaluates presence before projection, then requires exact coverage.
Explicit absent variants, external presence axes and missing presence rows
retain their safeguards. It neither fabricates layout for hidden owners nor
omits a visible owner's obligation. Added missing-visible/extra-hidden rejection
tests, external-axis/absent-variant projection tests, and repeated visible/hidden
transitions in both React emitters. All 22 layout/paint-order tests and TypeScript
pass; lint exits zero with existing warnings. All forty frozen public-engine
requests/refusals remain byte-identical to experiment 1002.

Public conversion now packages Accordion item and eight dependencies, zero
skipped. The unchanged authenticated visual check on the complete native capture
finishes with ZERO pass, 106 fail, 14 unverified. Reasons include 94 size mismatch,
48 missing-content, 71 white image and 65 black image differences; 26 rows have
a framing refusal (some also have independently established failures). Do not
describe this as a fidelity gain. Inspected the large disabled, end-aligned,
expanded comparison: generated header/content positioning and arrow placement
disagree. Correction after experiment 1004 verified triptych panel order: the
generated result is the left panel and is missing the Slot content visible in
the source on the right; the original interpretation had these reversed.

Clean plugin at a2403d71a builds and verifies engine e5724e7feae3, 2128998 bytes.
Official door rederive/check passes; generated differences are citation-only.
Preserved prior clean-checkout receipts in 8455847b4 before advancing. Complete
visual/check evidence, proposal diagnosis, logs and all forty regression requests
are archived in paired-regression-integration/accordion-layout-domain-1003.
No processes remain running, no push/publication/canvas mutation. Full204 stays
2522/6312 at its older pin; reverse remains unqualified. Next: trace the dominant
Accordion size/visibility and slot-content failures against source observations.

## Experiment 1004 — independent hidden visibility gains 29 Accordion passes

Prior turn was progress (layout-domain fix and completed visual diagnosis).
Native read/export of collapsed source 2154:8479 confirms 400x48, header visible,
content hidden. The old generated DOM was 400x196. Corrected experiment 1003's
triptych interpretation: generated is left, source right. The expanded example
is missing Slot content, while the collapsed generated example adds a paragraph.
Also, the initial diagnostic proposal had 96 visible header states, but the final
linked contract has 98, including two skeleton tuples its presence table marks
true. The layout validator fix accepts exact final presence coverage; the final
contract did not discard those two layout rows as the initial diagnosis implied.

105178911 fixes owned frame hidden-state processing and its early return when
structural presence has already assigned a VARIANT visibleWhen gate. A complete
captured hidden/presence table now composes with that gate. Live Boolean property
bindings remain independent, and unsupported capture provenance grants no new
inference. The actual Accordion content now has State x Flush x Expanded gates.
A focused regression requires the conjunction instead of losing Expanded when
Flush already explains structural presence. All 28 hidden/presence tests and
TypeScript pass; lint exits zero. ALL forty frozen public requests/refusals remain
identical to experiment 1003.

Same full native input, same fonts and unchanged visual checker: 29 pass,
77 fail, 14 unverified, compared with 0/106/14. Size mismatch count falls from
94 to 42; missing content remains 48, white image failures 36, black image
failures 65. Inspected the corrected collapsed consumer: 400x48 and no unwanted
paragraph, matching the independent native export. This is a paired replay gain,
not a first-pass never-seen score, and does not update the old full204 numerator.

Clean plugin verifies engine 69225240fe97, 2129203 bytes. Door rederive/check passes;
old receipts preserved in 282c48c4f before advancing the qualification checkout.
All processes terminal. Evidence: paired-regression-integration/
accordion-hidden-visibility-1004 includes full visual results, native export,
regression requests and validation logs. No canvas mutation, push or publication.
Full204 stays 2522/6312 at its older pin; reverse remains unqualified. Next: trace
expanded Slot/content omissions and skeleton paint while retaining these 29 passes.

## Experiment 1005 — keyed Slot default restored, missing text cleared

Previous turn was progress: 29 paired visual passes from hidden visibility.
Traced the expanded missing text to applySlotDefaultContent's unconditional
instanceOf === Slot shortcut. a459937f1 permits the ordinary default-content
identity checks when the named Slot resolves by component key. Unkeyed name
matches retain the previous elision; declared swap default, linked child,
captured variant-main membership and caller omission remain independently
required. Carbon's default 4534:160890 now resolves to its actual ds.slot in
both Flush placements, with no fabricated replacement content.

All 23 focused slot tests pass, including keyed Slot regression, unqualified
identity refusal, and existing React/native default replacement/clearing checks.
TypeScript and targeted lint pass. All forty frozen public requests/refusals
remain identical. Same native Accordion input and unchanged visual checker:
29 pass, 52 fail, 39 unverified, versus 29/77/14. Every prior pass remains a pass.
All 48 missing-content reasons clear; size mismatch count drops 42 to 9.
This does NOT raise the pass rate: 25 former failing cases are now unverified
after independently established content/size defects clear. Current refusals
are 24 blend paint extents outside the observed viewport and 15 changed rasters
under compositor promotion. No framing safeguard or scoring threshold changed.

Inspected the expanded start-aligned Flush=true comparison: Slot text now
appears, but generated slot width hugs its label instead of filling the source's
available width. Skeleton comparison separately shows a shortened placeholder
bar. These are remaining geometry defects, not missing content or pass claims.
One attempted triptych open was unavailable because its case is unverified;
used the available Flush=true failed comparison instead.

Clean plugin verifies engine 8b4e396c99f2, 2129236 bytes. Door rederive/check
passes; prior clean receipts preserved in 8345b0bcd before advance. All processes
terminal. Full evidence: paired-regression-integration/accordion-slot-default-1005.
No canvas mutation, push or publication. Full204 stays 2522/6312 at its older
pin; reverse unqualified. Next: carry the observed default-slot fill width and
isolate skeleton width, retaining all 29 existing passes and framing refusals.


## Experiment 1006 — omitted-slot dimensions add 16 Accordion passes

Previous goal turn was a status check, not new progress. Resumed the existing
conversion session 33204 to terminal success and repaired the browser regression
harness: its minted dimension tokens needed the generated token stylesheet.
90bdee62e carries independently witnessed width/height through the linked child's
existing declared root inputs for omitted slot defaults. Caller replacements
bypass the fallback. Existing square drawing-size overrides take precedence.
Slot wrappers retain ownership of paint, opacity and padding.

Same Accordion native capture and unchanged authenticated checker now report
45 pass / 36 fail / 39 unverified, up from 29 / 52 / 39. All prior 29 passes
remain; 16 expanded variants across sizes, alignments and states newly pass.
Inspected generated-left/source-middle triptych confirms the formerly narrow
Slot now fills its observed width. Remaining failures include all 24 skeleton
variants; their nested header still carries a 320px main width inside a 400px
instance. This is a next geometry lead, not a claimed repair. All 39 existing
framing refusals remain, and nine content-size mismatch reasons remain.

The broader check caught two candidate defects before commit. First, Adobe's
square default mixed subtree size with root dimensions and packaging refused.
Moving root observation after square-size carriage restored its request bytes.
Second, carrying every root input doubled Material slot opacity: pass counts
stayed unchanged but four disabled images worsened. Final carriage is explicitly
dimensions-only; Material's request is restored byte-for-byte. A no-op root
observation no longer adds unnecessary fallback anatomy to Fluent Popover.

All forty public requests/refusals replayed: 39 identical to slot1005; only Radix
DataList changes through its linked defaults. Paired checks of the four initial
changed sets used the same saved inputs and authenticated fonts. Final Radix
request equals the paired-tested after2 request, and all 12 variant verdict
objects are identical before/after (still failing). Final Accordion request
also equals the measured 45-pass candidate request exactly. No synthetic gain
is added to the frozen full204 scoreboard. Earlier candidate failures and
worsened comparisons are preserved, not overwritten or counted as successes.

44 focused slot/drawing tests, TypeScript and targeted lint pass. Tests cover
rectangular 40/60px defaults on both React surfaces, caller replacement, no
second opacity input, and square-size precedence. Clean plugin verifies engine
a8bedb24918a, 2129677 bytes; door rederive/check passes. Previous clean receipts
were preserved in f8204ec19 before moving to 90bdee62e. Full fast lane was not
rerun; its previously identified census gate remains open. No push, publication
or Figma mutation. Full204 remains 2522/6312 at its older pin; reverse remains
unqualified. Evidence: paired-regression-integration/accordion-slot-width-1006.
All turn processes are terminal. Next: trace nested skeleton fill-width ownership
without disturbing these passes, then resolve remaining framing/hover failures.


## Experiment 1007 — nested cross-axis FILL clears all 24 skeleton cases

Previous goal turn was progress: 90bdee62e added 16 Accordion passes. Verified
writer HEAD d67d0e52d and preserved parked changes. Native skeleton main children
are explicitly FILL-width, but root dimension overrides froze their measured
320px width inside a 400px outer instance. A fixed numeric replacement would
not preserve the source's resizing relationship.

fd3406064 adds a typed component rootFill dimension through the existing declared
child root dimension API. Source inference requires same-file key identity,
matching independent local geometry/root witnesses, identity transform, explicit
FILL on every occurrence, a uniform parent direction, and a fixed cross-axis
allocation whose own size is not FILL. Conflicting numeric/subtree sizing,
unsupported parents/children and unsupported emitters refuse. React surfaces
carry the cross-axis percentage on the actual child root; native plans and the
mock-executed writer retain the instance FILL flag. No component names or source
kit special cases are used.

Same native Accordion capture, authenticated fonts and unchanged checker:
69 pass / 12 fail / 39 unverified, from 45 / 36 / 39. All 45 prior passes remain
and all 24 skeleton variants newly pass. Inspected the black-background skeleton
triptych: generated-left and source-middle placeholder widths now agree. The
remaining failures are nine hover and three focus variants; nine size mismatch
reasons and nine black-background image-difference reasons remain. All 39 framing
refusals remain unverified; none were relabeled or waived.

Initial broad proposal introduced refusals for HeroUI Slider (its parent width
is itself FILL) and Twilio CodeBlock (parent direction changes across variants).
Explicit source qualification now retains their former numeric carriage; both
requests are restored byte-for-byte. Final forty-request replay: 39 unchanged;
only Atlassian's column component changes through its nested defaults. Paired
checks of its two variants have identical complete verdict objects and image
metrics, still failing existing content requirements. Final Accordion request
is identical to the measured 69-pass request. Full204 score is not recomputed
or augmented with targeted gains.

109 focused root-input, slot and affine tests pass, plus TypeScript and targeted
lint. New source tests reject missing FILL, HUG allocation, contradictory local
identity and undeclared child APIs. Browser tests exercise 200/400/160px parent
resizing on both React emitters, preserve independent child height, and reject
competing numeric width, HUG/auto parent, wrong axis and missing API. Native
plan and mock write/readback retain FILL. These are not live reverse-direction
qualification. Clean-checkout targeted tests also pass without parked edits.

Clean qualification moved to fd3406064 after preserving prior receipts in
492ad3631. Plugin verifies engine 9f4e6be80c83, 2133133 bytes; door register passes.
Lowering refresh first refused ambiguous existing citation text. The generic
shift helper then exposed an already-stale proposal citation. Mapped only the
22 native citations across the exact two-line native diff, checking old/new
rule text, then the official rederiver refreshed the other two locations and
document rows. No lowering rule prose or acceptance changed.

Evidence: paired-regression-integration/accordion-root-fill-1007, including
initial candidate failures and all final artifacts. All processes terminal.
Full204 remains 2522/6312 at its older pin; reverse remains unqualified. Full
fast lane was not rerun and its known census issue remains open. No Figma
mutation, push, tag or publication. Next: isolate the remaining hover/focus
geometry and paint-extent failures while retaining the 69 verified passes.


## Experiment 1008 — paint-order composition preserves independent item stretch

Previous turn was progress: all 24 skeleton variants newly passed. Verified
7109d7ac0 and preserved parked edits. Examined remaining hover/focus triptychs
and native header geometry. carryObservedItemStretch already inferred header
stretch, but carryChildPaintOrder resolved that layout into a table and then
filtered out its alignSelf before deleting layoutByProp. This silently dropped
parent-owned allocation when internal child paint order varied.

f0696cfcd retains the independent grow/growBasis/alignSelf map when composing
an internal paint-order combination table. A single-axis table merges the
same facts into its existing layoutByProp map. The validator permits the
independent stretch map alongside container layout, retaining existing item
ownership and conflicting-style checks. No schema carrier or scoring change.
An initial attempt to put all layout channels directly into the combination
table failed existing schema/paint tests and was replaced by the independent
map representation; the failing diagnostic is preserved.

Regression reproduces the old loss (undefined instead of stretch), then checks
both paint-order values across repeated stretch/auto transitions in both React
emitters: 60px stretched height and 20px intrinsic height. Native compilation
retains FILL-height in exactly two variants. All 21 focused stretch/paint tests,
TypeScript and targeted lint pass. All forty public requests/refusals remain
byte-identical to rootfillfinal1007.

Same Accordion input and unchanged authenticated checker: 72 pass / 9 fail /
39 unverified, from 69 / 12 / 39. All prior passes remain; three expanded focus
variants newly pass after their width mismatch clears. Nine hover cases still
fail black-background comparison, six also with size mismatches. All 39 paint
framing refusals remain unverified. No aggregate first-pass gain claimed.

Next cause is now explicit: Background contains 26 captured occurrences, two
hidden skeleton rows with raw #cabfff and 24 hover rows bound to layer-hover
(contextual). The mixed raw/bound branch in unifyPaint refuses the whole paint
channel even though hover has consuming-node COLOR/alias evidence resolving to
#e8e8e8. Generated Background therefore lacks background-color. Follow-up must
qualify each consumer's actual mode/paint and preserve refusal on missing or
contradictory evidence, rather than substitute a global variable value.

Clean qualification receipts preserved in c843ab8b9 before moving to f0696cfcd.
Plugin verifies engine ed66e135e3b0, 2133462 bytes; door register passes; lowering
rederivation moves zero locations. Full fast lane not rerun; known census gate
remains open. No push, publication or Figma mutation. Full204 remains 2522/6312
at its older pin; reverse remains unqualified. All processes terminal. Evidence:
paired-regression-integration/accordion-paint-order-stretch-1008.


## Experiment 1009 — independently witnessed mixed raw and bound fills

Previous goal turn was a status check, with no engineering progress. Resumed
the pending mixed-fill candidate against the current checkout. The initial
regression assertion used the wrong case for the Surface part and was not a
valid red test. Corrected fixture inspection also exposed invalid #rgba(...)
output: the color mint formatter assumes hex. Reused the existing color-alias
value path, which preserves exact functional colors and already serves normal
instance root paint. The initial package and failed visual evidence are retained.

83230a151 qualifies each bound occurrence using its own captured NORMAL paint,
COLOR variable, selected mode, alias chain, variable name and alpha. A matching
global token is insufficient. Mixed ordinary fills retain literal appearance;
the proposal explicitly says variable bindings are not recreated. Existing
absence witnesses and sparse values retain their existing meaning.

Corrected regression fails on the old clean revision because background-color
is missing. Both React emitters render distinct captured mode colors, including
transparency, through repeated prop transitions. Seven missing/contradictory
evidence cases refuse. All 25 focused paint, native-color, slot and stretch
tests pass; TypeScript passes; targeted lint has warnings but no errors.
All forty requests/refusals remain identical to paintstretch1008.

Same native Accordion capture, fonts and unchanged checker: 81 pass / 0 fail /
39 unverified, from 72 / 9 / 39. All nine hover cases newly pass and all prior
passes remain. Their size and black-background discrepancies clear. Inspected
the large expanded End hover triptych: generated-left and source-middle now
both have the captured gray header. The 39 framing refusals remain unverified,
not passes. This is a targeted replay, not a first-pass or full204 score.

Clean qualification receipts preserved in d7f164978 before moving to 83230a151.
Nine tests pass again in that clean checkout. Plugin verifies engine
c6cc3bf3ffba, 2134591 bytes; door register passes. Official lowering refresh
moves one citation by 24 lines without changing rule text. No full fast rerun;
its known census gate remains open. No push, publication or Figma mutation.
Full204 remains 2522/6312 at its older pin; reverse remains unqualified.
Evidence: paired-regression-integration/accordion-mixed-paint-1009, including
initial invalid CSS candidate, final package, checks and forty replay requests.
All processes terminal. Next: investigate the 39 unverified paint-extent cases
without changing fidelity thresholds, and validate a reproducible tester
journey rather than treating targeted visual gains as release readiness.


## Experiment 1010 — installed CLI rehearsal exposes set-level qualification

Previous turn made progress: nine hover cases newly passed. Current writer
ad7892117 has only parked edits; qualification source remains 83230a151.
Traced all 39 Accordion unverified cases: 24 blend paint extents leave the
observed viewport and 15 change pixels under compositor promotion. The source
contains independently captured MULTIPLY paints, including very small nonzero
alpha. Neither deleting those paints nor bypassing raster evidence is justified.
No checker, source capture or fidelity threshold changed.

Ran cli:figma-to-react:smoke:check --keep from the clean qualification checkout.
Packed rc.3 installs into an empty directory outside the repository and
reproduces the frozen Altitude Badge pin. It reports all ten cases UNVERIFIED
without a token, NOT CHECKED without Chromium, and refuses a mismatched font
family before output. The installed output retains no repository path leaks.
The packed CLI is 5727868 bytes; its hash is recorded in rehearsal.json.

Then ran that installed CLI against the existing native TreeNode capture with
copied authenticated fonts and privately supplied source-image credentials.
It packages, installs into its clean Vite consumer, builds and renders all 75
variants: 75 pass / 0 fail / 0 unverified, but the command correctly exits 1
for variant-axis-unexercised:expanded. The earlier tree998 result has the SAME
set problem. Therefore 75 passing variants never qualified the whole component.
This is not a new conversion regression and must not be reported as a green
private-preview journey. Source-domain inspection explains the finding:
Expanded=false only occurs with Subitems=-; Expanded=true only with Subitems
1 through 8. There is no drawn pair that changes Expanded alone. Do not invent
a missing source tuple or waive the behavior qualification.

Manual preparation: build/pack, copy the prior native capture, copy font assets
and rewrite their relative manifest paths, and supply credentials privately.
No package repair was performed. This is an agent-run local rehearsal, not a
fresh-agent quickstart, fresh URL acquisition or outside-tester success.
No publication or invitation occurred. Historical BETA and beta-runbook entry
pages now point to the current preview and CLI route, retaining old workflows.

Evidence: paired-regression-integration/installed-cli-rehearsal-1010 contains
CLI tarball, logs, input hashes, full installed TreeNode output and smoke/control
outputs. Original fonts remain in the authenticated local evidence locations.
All processes terminal. Full204 remains 2522/6312 at its older pin; reverse
remains unqualified. Next: qualify source-declared joint state transitions and
a complete tester journey; report set-level problems alongside variant scores.


## Experiment 1011 — TreeNode joint transitions and complete domain refusal

Previous turn completed the installed-CLI rehearsal and exposed the existing
set-level behavior problem. Verified writer 90d166443 and preserved all parked
edits. Inspected domainTransitionGroups: it only proves single-axis directed
edges; TreeNode has no expanded-only edge because subitems is coupled.

Installed the identical generated tarball into a separate React 18/Vite app.
Package SHA-256 58536cf24ec762f29c2c954a30826885171091d8b984313e3df7e6a457e8a372
matches experiment 1010 exactly. Loaded its authenticated fonts. Baselines
cover all 75 drawn tuples. Enumerated every pair changing expanded/subitems
while retaining the other five axes: 128 directed transitions. On the retained
React mount, each destination matches its baseline computed subtree paint,
text, relative geometry and dimensions, then restores the origin exactly.

Enumerated the complete 576-combination declared prop product. All 501 tuples
outside the 75 captured states throw DRAWN_VARIANT_UNDECLARED. Each refusal
is followed by a successful baseline remount and exact observed restoration.
Totals: 75 baselines, 128 joint transitions, 501 named refusals, 629 restorations.
The initial probe started before its rebuilt error-boundary harness finished
and could not parse the old error representation. It terminated; after the
build completed, the final probe passed. Both logs are retained. No generated
package edits, checker changes, threshold changes or unsupported source tuples.

This establishes joint prop-update behavior on the already visually measured
package. It does not create a source witness for independent expanded updates,
prove keyboard behavior, or turn the existing set-level failure into a pass.
variant-axis-unexercised:expanded remains in the original CLI result. The
full204 score remains 2522/6312 at its old pin; reverse remains unqualified.
No publication, Figma mutation or tester contact. All processes terminal.

Evidence: paired-regression-integration/tree-joint-transitions-1011 contains
the runnable probe, complete per-tuple results, exact package, consumer source,
lockfile, built app and logs (node_modules excluded). Next high-impact engine
triage: Chakra Switch's 320-case cohort, whose older full204 result has 160
fails, 160 unverified and colorPalette discarded. Keep TreeNode's score
unchanged rather than spend further time trying to prove an undrawn edge.


## Experiment 1012 — Switch palette finding and duplicate remote capture IDs

Previous turn completed TreeNode joint-state evidence. Verified ab7a7b8e9 with
parked edits unchanged. Reviewed experiments 946/947 before repeating any image
work: Chakra Switch's export-overlap mismatch already survives native exports.
Current conversion of the same 320-case dump produces the identical request
ae916bfdc72bd52e8bc4e72f319c956f0a0e56c4f76a3fbcc71c0e62a4c55ce7.
No bulk checker replay is justified.

The reported colorPalette discard is not a blanket palette loss. Of 288
transitions to gray, 152 change browser paint, including all 144 checked cases.
The 136 unchanged cases are all unchecked. Their exact source equivalence is
not admitted because the export framing proof fails. Keep the existing set
problem; do not remove palette logic, invent a source-equivalence witness or
relax the overlap proof. This diagnosis prevents an unsupported emitter fix.

Moved to Carbon Text input - Default (92 variants), whose older REST result
refused missing variable-consumer evidence. Confirmed live source set
15784:271032 on Text input page 395:4, in connected Carbon file
A451UfD58U7XU21FzaqfHL. Current native dump with dependencies refuses
DEPENDENCY_CAPTURE_AMBIGUOUS_NAME for Warning--filled. Read-only diagnosis
finds remote parentless components 41080:384365 and 129138:344076 share key
a1c3777f5c7110cc9f74014ce292aa9993be4fcd, name and 16x16 dimensions. Both have
a 14x14 Vector child, with distinct node IDs. This is evidence of same-key
remote representations, not proof that their complete captured definitions
are interchangeable. No node renamed, deleted, created or reparented.

Next implement/qualify identity-aware capture only after comparing complete
source observations. Different-key same-name definitions must remain refused;
matching names/keys/dimensions alone cannot erase contradictions or dependencies.
Source edits are not a workaround. The fresh 92-case dump has not completed
and no additional conversion or score is claimed.

Evidence: paired-regression-integration/switch-and-input-triage-1012 contains
current offline package/request, palette summary and returned native identities.
All processes terminal. No scorer changes, full204 rerun, reverse qualification,
publication or tester contact. Full204 remains 2522/6312 at its older pin.


## Experiment 1013 — same-key remote definitions are not interchangeable

Previous turn identified Carbon's live dependency name collision. Verified
9b9e571a4 and preserved parked edits. Used the canonical dumpNode reader on
both remote Warning--filled definitions, retaining complete returned facts.
41080:384365 uses an unbound white MULTIPLY root paint at approximately 0.00001
alpha. 129138:344076 uses a Transparent-variable-bound NORMAL paint and a 16:16
targetAspectRatio. Their vector paths, dimensions and component key match, but
the definitions do not. A key-based deduplication would erase observed source
facts. Do not merge them or silently select the latest encountered object.

36a12c6bc changes the name-collision diagnostic for same-key remote definitions
to identify both node IDs and the key, and explain why renaming a consuming
instance cannot fix this. Other name collisions retain distinct-name guidance.
9300b7fb3 embeds the canonical reader into the plugin. No capture acceptance
rule or output data changes. The live read returns the corrected refusal. All
17 existing selection/dependency and remote-snapshot tests pass.

Preserved qualification receipts in a239b162a, then advanced clean qualification
to the candidate. Initial plugin build correctly refused the not-yet-updated
embedded dump; after embedding, build verifies canonical dump and unchanged
engine c6cc3bf3ffba (2134591 bytes). Lowering moves zero citations; door register
passes without tracked changes. No full fast run or push. All processes terminal.

Architecture needed for actual support: preserve distinct captured definitions
and their node identities; resolve each instance against its observed main
identity before library-key fallback; retain variant-dependent definition
choices; require all existing paint/binding/root-override proofs for each
choice. The current dump is name-keyed and session linking is key-first, so
changing only the capture collector would be insufficient and potentially
select the wrong definition. This work has not been implemented.

Evidence: paired-regression-integration/remote-definition-collision-1013 has
complete native dumps, live refusal, tests and build logs. No design mutation,
new conversion, reverse qualification or score gain. Carbon Input's 92 variants
remain unverified; full204 stays 2522/6312 at its older pin.


## Experiment 1014 — resolve standalone definitions by observed main identity

Previous turn proved same-key remote definitions differ. Verified 125c67662 and
preserved parked edits. Implemented the child-resolution prerequisite rather
than letting a capture change feed conflicting definitions into last-key-wins
linking. e42e0ccf2 resolves multiple same-key standalone contracts only when
every occurrence's own geometry/root-override witness names one main, and that
main identifies exactly one definition in the consuming capture file. Missing,
foreign, contradictory or duplicate identities refuse. A merged part cannot
select the first of varying main identities. Repeated items retain all main
observations. Ambiguous keys are removed from key-only session indexes so
other paths cannot select the last registered definition accidentally.

Regression fails against the old revision: old-main incorrectly links test.new.
The corrected proposal links old-main and new-main independently despite the
same library key and misleading name/key lookup order. Both React emitters
render distinct red/blue children, in both registration orders. Negative cases
cover missing/unknown/wrong-node witnesses, contradictory main records, foreign
capture, duplicate anchors and variant-varying main identity. All 36 focused
tests, TypeScript and targeted lint pass (lint retains existing warnings).
All forty replay requests/refusals remain byte-identical to mixedpaint1009.

Clean qualification advanced from 9300b7fb3 to e42e0ccf2; twenty targeted tests
pass there. Plugin verifies engine 24a05769e055, 2135796 bytes; door register
passes; lowering rederives zero locations. No full fast run or push.

Read-only Carbon inventory finds 16 instances of the Warning key inside the
92 Text input variants; all reference old main 41080:384365. The other main
therefore enters through dependency closure rather than these direct observed
uses. Capture still refuses duplicate names: preserving separately named
artifacts and their original source identities is the next integration step.
Variant-dependent definition selection remains explicitly unqualified. This
commit is not a completed Carbon conversion or reverse-direction proof.

Evidence: paired-regression-integration/captured-child-identity-1014 includes
the old failing reproduction, focused/clean checks, native usage inventory,
forty final requests and build logs. All processes terminal. No source design
mutation, scorer changes, publication or tester contact. Full204 remains
2522/6312 at its old pin; reverse remains unqualified.


## Experiment 1015 — preserve distinct captured remote mains

Resumed the unfinished capture candidate after the owner's beta-readiness check-in.
3d9d5c64c preserves same-name, same-key remote standalone snapshots under
capture-local aliases containing their node IDs. Original names, node IDs,
keys and snapshot provenance remain intact; public source nodes are unchanged.
Different-key name collisions remain refused. Proposal validates alias identity
and keeps a captured-main inventory even when a definition fails proposal, so
an instance cannot fall back to a surviving but different same-key definition.
Dependency ordering uses the witnessed main identity for ambiguous keys.

Banked the live Carbon Text input capture: 27 sets including dependencies,
92 root variants, 8,058,439 characters. Both Warning--filled definitions are
retained separately. localhost receiver routing could not reach the dedicated
sink; transfer used bounded read-only plugin chunks instead, then stopped the
receiver. Conversion now reaches a different explicit refusal:
solid-fill-composition-source-occurrence-unconsumed at Enabled/Text filled=False
child 3, a hidden Resizer instance with a captured tiny-alpha MULTIPLY fill.
No package or additional visual pass is claimed. Do not discard that paint or
remove the coverage guard to accept the set; investigate hidden occurrence
ownership and source visibility next.

39 focused tests passed before adding the live-reader regression; all 13
selection/capture tests then passed, including same-key separation and
continued different-key collision refusal. TypeScript and targeted lint pass.
All forty saved requests/refusals match identityfinal1014 exactly. Clean build
verifies canonical reader and engine 56364799feb6 (2137082 bytes), zip 2498494
bytes. Lowering moves one proposal citation by one line with unchanged rule
text; door register passes. Prior clean receipts preserved in 5c13cc247.
No full fast lane, push, publication, tester contact or source-design mutation.
Full204 remains 2522/6312 at its old pin; reverse remains unqualified.

Evidence: paired-regression-integration/captured-aliases-1015, including full
native dump, failed conversion, tests, build receipts and forty requests.


## Experiment 1016 — keep a non-rendering owner for hidden composed paint

Verified 4e991a852 and preserved parked edits. Carbon Resizer is hidden in all
92 captured occurrences, with no visibility binding. The existing early
instance omission discarded its composed-paint owner before final source
accounting. 6cb8e7174 retains hidden instances with captured composed paint
through normal ownership qualification and non-rendering presence projection.
It does not skip paint validation, change blend modes or drop the source fact.
Unpainted permanently hidden instances retain the existing omission behavior.

The regression reproduces source-occurrence-unconsumed before the fix.
Afterward it retains the tiny-alpha MULTIPLY paint and linked child identity,
with all-false presence across two modes. Both React emitters render only the
visible blue sibling in both modes, and the input dump is unchanged. All 26
focused drawing/hidden-paint tests, TypeScript and targeted lint pass. All
forty saved requests/refusals remain identical to capture1015.

Reconversion of the same banked native capture passes the Resizer omission
but refuses solid-fill-composition-instance-root-unqualified at
root/textInput/aiStatusIcons/statusNotification. Inventory records 32 visible
Status notification instances, including differing NORMAL/MULTIPLY usage
paints. This is a distinct linked-main paint capability problem, not another
hidden-layer exception. No package or visual score gain is claimed. Next
qualify the child's paint owner and usage overrides together; do not bypass
the instance-root guard or erase tiny-alpha source paint.

Clean qualification advanced after preserving prior receipts in bbed62eb2.
Plugin verifies engine 424b3df585d0 (2137213 bytes), zip 2498625 bytes; lowering
moves zero citations and door register passes. No full fast lane, push,
publication, tester contact or source-design mutation. All processes terminal.
Evidence: paired-regression-integration/hidden-paint-ownership-1016 contains
the failing reproduction, final checks, conversion refusal, visible usage
inventory and forty requests. Full204 stays 2522/6312 at its old pin; reverse
remains unqualified.


## Experiment 1017 — split variant-dependent remote identities and preserve IDs

Verified c466e8fed. Dependency-level inspection changes the prior diagnosis:
Status notification was not proposed at all; its identity refusal was masked
by the parent's later instance-root paint refusal. Its Failed and Warning
variants use different Warning--filled mains with the same library key.
The existing replacement splitter grouped only by key. Additionally, batch
session identity retention reused the first remote main's contract ID for the
second, despite distinct capture aliases and different anchored node IDs.

f971ae53a groups ambiguous key occurrences by their fully resolved definition
identity, retaining existing source-presence branch proofs. Remote standalone
session identity now requires the same capture file and main node, rather
than library key alone; collisions with other mains cannot reuse the same ID.
Missing/contradictory/unqualified identity still refuses. Ordinary unique-key
behavior is unchanged.

Both new regression cases fail against the prior clean revision: varying mains
refuse, and distinct batch snapshots collapse to one contract ID. All 29 tests
pass in writer and clean checkout, including both React emitters showing exactly
the expected red or blue child under each variant. TypeScript and targeted
lint pass. All forty final request/refusal records are identical to hidden1016;
the intermediate run during iteration is kept separately and is not the proof.

The same 27-set native capture now proposes Status notification successfully.
Its two Warning contracts have distinct IDs and correct anchored main nodes.
Text input still refuses at the same caller paint path: the child root has
ordinary NORMAL background tokens plus background-color input, while visible
caller usages include MULTIPLY. The guard correctly requires a qualified fill
layer for that blend override. Next carry the observed main default and caller
paint through one qualified root paint owner; do not substitute whole-node
blend or ignore tiny alpha. Arrow--right and Button also remain named skipped
dependencies. No packaged Input, visual gain, or reverse proof is claimed.

Clean receipts preserved in c13baf065 before advance. Plugin verifies engine
0c40ab28b467 (2138010 bytes), zip 2499422 bytes. Lowering moves zero citations;
door register passes. All processes terminal. No full fast lane, push,
publication, tester contact or source mutation. Evidence:
paired-regression-integration/variant-remote-identity-1017. Full204 remains
2522/6312 at its older pin; reverse remains unqualified.


## Experiment 1018 — live native paint contradicts its variable alpha

Verified 1e463d73f and preserved parked work. Tested a candidate that requests
root paint retention for fresh captured mains with composed-paint callers,
through the existing strict composition/binding machinery. It exposes a real
source inconsistency: five Status notification roots record NORMAL white at
opacity 1, but their Transparent color variable resolves to alpha
0.000009999999747378752. Status=Failed records that same tiny alpha directly.
The binding validator correctly refuses paint-consumer-disagreement. The
candidate also exposes missing default-paint observations on Tooltip and is
not retained or qualified; its exact patch and batch result are archived.

Read-only live Figma inspection of all six source roots confirms the capture
was accurate: both raw paints and resolveForConsumer values reproduce the
same disagreement. Exported native PNGs for Status=Failed (3390:31714) and
Status=Info (129078:468148), without source mutation. Both are 16x16. Failed's
corner is RGBA [0,0,0,0], with 84 fully transparent pixels; Info's corner is
[255,255,255,255], with all 256 pixels fully opaque. Thus replacing raw paint
alpha with the variable's alpha would falsify observed rendering. This is
not a font problem, stale local capture, missing plugin, or harmless numeric
rounding. The generated child's current Transparent token also cannot stand
as proof of its raw default fill fidelity.

Next implement a separately evidenced observed-literal paint representation
that retains the original conflicting binding facts without claiming binding
recreation; preserve exact NORMAL/MULTIPLY paint ownership and unchanged
visual scoring. Existing strict graph qualification must continue refusing
contradictions. No caller-blend fix or accepted conversion is claimed yet.
The previous import remains the current implementation; only diagnosis and
evidence land this turn. No tests were claimed for the discarded candidate.
No source write, push, publication or new visual pass. Full204 remains
2522/6312 at the old pin; reverse remains unqualified. Evidence:
paired-regression-integration/native-bound-paint-disagreement-1018 includes
all six raw native observations, two original PNGs, decoded alpha counts,
experimental patch and dependency-level refusal results.


## Experiment 1019 — validate observed paint and variable graph separately

Verified 68bbd2bcd. e14a5ea21 adds inspectSolidFillColorBinding as a prerequisite
for explicit observed-literal carriage. It validates exact native paint,
independently validates the selected variable graph through the unchanged
strict qualifier, then distinguishes matched binding from observed-paint-
disagreement. The latter retains both observedPaint and resolvedBinding with
bindingRecreated:false. The graph's color is never substituted for native
paint. The original qualifier still refuses every conflicting source paint.
No runtime importer fallback or new accepted conversion is introduced yet.

Banked all six captured Status notification paint/consumer records as a
regression fixture. One matches; five retain opaque observed paint alongside
the near-transparent variable resolution. Eleven binding/token tests pass in
writer and clean checkout. Negative cases reject missing consumers, changed
terminal values, missing alias targets, invalid modes/types and non-native
numbers. Returned evidence does not mutate the source. TypeScript and lint
pass after correcting a test assertion overload; all forty request/refusal
records match variantidentityfinal1017 exactly.

Clean receipts preserved in ec26b7007 before advance. Initial plugin check
correctly required a new receipt despite unchanged bundle length; regenerated
and verified engine c6956ed62cbc, 2138010 bytes, zip 2499422 bytes. Lowering
moves zero citations; door register passes without changes. No full fast lane,
push, publication, source mutation or visual score gain. All processes terminal.
Next integrate this evidence into an explicit literal paint carrier, retaining
the conflict on the generated artifact while declining binding recreation;
then qualify main/caller paint ownership and replay Carbon Input. Full204
remains 2522/6312 at its old pin; reverse remains unqualified. Evidence:
paired-regression-integration/observed-binding-evidence-1019.


## Experiment 1020 — explicit observed literal paint with unrecreated binding

Verified 11bc00ce9. 0f7e50b11 adds strictly validated conflict witnesses to
uniform and per-combination paint carriers. Each retains observedPaint,
resolvedBinding, source owner/name/variant and bindingRecreated:false. Uniform
witnesses must match their actual literal paint and cannot coexist with a
paint token or recreated binding; table witnesses must match their exact cell
and cannot coexist with a token, binding or empty marker. Contradictory graph
facts still fail. Ordinary binding qualification is unchanged.

React-runtime import uses that separate representation only for a proven
paint-consumer disagreement after strict binding qualification fails. Other
errors retain their prior refusal text. Fresh batch-owned mains referenced
by a composed-paint caller now retain their observed default fill layer,
including explicitly empty roots. Supplied/stamped APIs are not extended.
The full goal and reverse qualification remain open: unrecreated binding
metadata is not a claim that native variable relationships survived.

The same Carbon capture now proposes Status notification with six root paint
cells: Failed retains its near-transparent bound fill; the other five retain
opaque literal paints plus conflict witnesses. Both React emitters render the
opaque source corner in a 16x16 control rather than substituting the resolved
variable alpha. Tests reject forged evidence, conflicting paint tokens,
altered owner/cell paint and broken variable terminals. Twenty-six focused
checks pass in writer; twenty-two binding/import checks pass in the clean
checkout. TypeScript and lint pass. All forty final requests/refusals match
paintwitness1019 exactly. Earlier diagnostic-only wording changes were removed.

A broader paint suite exposed an existing version discrepancy: canonical
reader emits 1.75 but PLUGIN_DUMP_VERSION still said 1.73. Corrected the exported
constant; three targeted reader checks pass. The initially failing broader
runner was stopped after its known version assertion failure, with logs kept;
no fully passing broad run is claimed. Schema JSON regenerated from source.

Full Input conversion now refuses composed fill plus borders at
root/textInput/Background (border-bottom-width, border-color and other sides).
Arrow--right and Button remain skipped for earlier named reasons. No packaged
Input or new visual scoreboard gain is claimed. Next qualify fill and border
ownership together, without deleting either or applying blend to child ink.

Clean prior receipt preserved in c8e6e58a5. Engine 3bad1c6ffc55, 2141766 bytes,
zip 2503178 bytes verified. Lowering moves two proposal citations by one line
with rule text unchanged; door register passes. All processes terminal. No
full fast lane, push, publication, source-design mutation or tester contact.
Evidence: paired-regression-integration/observed-literal-paint-1020. Full204
remains 2522/6312 at its old pin; reverse remains unqualified.


## Experiment 1021 — leaf rectangle fill and stroke occupy independent layers

Verified 6aee63d6f. Background capture has leaf RECTANGLE occurrences with
INSIDE strokes and no auto-layout. These strokes overlay fixed rectangle
geometry; they do not reserve layout space. Eight backgrounds use a nearly
transparent stroke, so simply permitting CSS borders while clipping the fill
to the padding box would lose the fill underneath the stroke.

8ebec1d48 normalizes composed-paint leaf rectangles with entirely INSIDE
strokes to the existing non-layout stroke carrier. A note distinguishes this
derived rectangle geometry from observing a native auto-layout flag. Nodes
with children/layout, FRAME nodes, CENTER/OUTSIDE strokes and explicit layout
inclusion do not gain the normalization. The existing foreground stroke layer
now also handles composed-fill leaves, preserving the independent fill below.
No competing-paint validator or image threshold is relaxed.

Two new regression cases fail on the previous clean revision. Twenty focused
paint/ordering checks pass in writer and clean checkout; TypeScript and lint
pass. Both React emitters produce the expected separate red 50% fill and blue
50% bottom stroke: center RGBA [255,0,0,128], edge within one channel step of
[85,0,170,192], unchanged 20x20 dimensions. Input source remains unchanged;
negative geometry cases still refuse. All forty requests/refusals remain
identical to observedliteralfinal1020.

The same native Input capture now completes proposal and writes a library
request. Package generation refuses two ds.toggletip usages of
ds.tooltip-caret-item with instance-affine-host-unproven; Input depends on the
refused module. The exact parent usage/child records are banked in
affine-dependencies.json. This is not a package or visual pass. Next qualify
those transformed caret hosts and their invariant local dimensions; do not
remove the affine guard or silently replace the child. Earlier Arrow--right
and Button skip reasons remain named in the batch.

Prior clean receipts preserved in abc25547e. Engine 7ef2ac21dba2, 2142322 bytes,
zip 2503734 bytes verified; lowering updates one citation with unchanged rule
text; door register passes. All processes terminal. No full fast lane, push,
publication, source-design mutation or tester contact. Evidence:
paired-regression-integration/leaf-fill-stroke-1021. Full204 remains 2522/6312
at its old pin; reverse remains unqualified.


## Experiment 1022 — first Carbon Input package and 47 measured passes

Verified 5e53bc9ce. Caret local size is independently derivable from its
selected fixed path and HUG padding. Generated root-input capability metadata
and explicit caller width/height inputs previously prevented that proof.
3e8468b7a admits only declared dimension inputs that equal the independently
derived intrinsic extent in every resolved mode; it never uses the override
to calculate intrinsic size. Unrelated root overrides remain refused. Paint
conflict metadata and root-input declarations are non-geometric facts. All
other affine placement and host restrictions remain intact.

The new regression fails on the old clean revision and passes on the fix.
Seventeen affine/intrinsic tests pass in writer and clean checkout. Both React
emitters preserve local 40x4 and rotated 4x40 extents; native compilation agrees.
A dark-mode override that changes width to 41px refuses in both React emitters
and native generation. Missing declared capability and unrelated opacity
inputs refuse. Child defaults remain fit-content. TypeScript and lint pass.
All forty saved request/refusal records remain identical to leafstroke1021.

The same native 27-set capture now packages TextInputDefault (61,993-byte tgz).
Ran the unchanged authenticated checker with the existing 28-face font manifest
on all 92 source variants: 47 PASS, 43 FAIL, 2 UNVERIFIED; no set-level problems.
All 47 passes are Style=Default; its remaining one case is unverified. Every
one of the 43 measured Style=Inline cases fails, with one more unverified.
All 43 failures include content-size-mismatch; 32 have white-image differences,
31 black-image differences, and 16 content-missing reasons. Two source exports
remain paint-extent-blend-promotion-changed-raster, never counted as passes.

Inspected the Inline Large Enabled triptych: generated consumer LEFT has a
wrapped helper label, native source MIDDLE has it on one line. The measured
widths differ by 23px (374 vs 397). Next trace shared Inline width/text allocation
and the read-only missing text before any bulk replay. Do not change fonts,
thresholds, the scorer, or compensate with arbitrary width padding. The package
still fails overall. These 47 targeted passes are not added to the old full204
scoreboard and are not a private-beta qualification.

Prior clean receipts preserved in 5f362d3a8. Engine 5642179695c7, 2142689 bytes,
zip 2504101 bytes verified. Lowering changes zero citations; door register
passes without changes. All processes terminal. No full fast lane, push,
publication, source-design mutation or tester contact. Evidence:
paired-regression-integration/input-first-package-1022 contains package, actual
consumer/native screenshots, triptychs, complete receipt and regression checks.
Full204 remains 2522/6312 at its old pin; reverse remains unqualified.


## Experiment 1023 — Inline text-sizing distinction is lost during proposal

Verified d3f6f787c and inspected the same native Input capture and 1022
request. No code or scorer changes. The prior status-only turn was no progress;
this investigation identifies a specific missing representation.

All 88 helper/error/warning text occurrences split consistently by Style:
Default has HEIGHT plus fillWidth=true (28 helper, 8 error, 8 warning); Inline
has WIDTH_AND_HEIGHT and no fillWidth (28 helper, 8 error, 8 warning). The
generated request carries no textAutoResize for any of these three parts.
carryTextAutoResize explicitly drops mixed resize modes under
propose.text-box-mixed-refused because the current field is unconditional.
This is loss of intrinsic sizing and shrink prevention, not merely the
subpixel rounding difference described by the old diagnostic.

The consumer capture frame remains 399x48 for Inline Large Enabled; the
previous 374-vs-397 discrepancy concerns measured content, not outer frame
width. Do not compensate by increasing the root width. This evidence directs
the next implementation toward preserving variant-dependent text sizing and
fill together, with Default wrapping retained. A global no-wrap or global
WIDTH_AND_HEIGHT flag would contradict 44 Default occurrences. No claim that
this explains every Inline failure until the unchanged checker proves it.

Reproducible extraction script and all 88 occurrence records are archived in
paired-regression-integration/input-text-sizing-1023. No new visual passes,
package, build, publication, or source mutation. Input remains 47/43/2;
full204 remains 2522/6312 at its old pin; reverse remains unqualified.


## Experiment 1024 — variant text sizing carried; remaining Inline offset exposed

Verified 84780310e. mergeOcc partitions captured TEXT resize modes into
mutually exclusive sibling parts only when every occurrence captures a mode,
WIDTH_AND_HEIGHT is one of the differing modes, and a declared axis explains
the distinction with complete axis-value coverage. Existing part presence and
text-box lowering preserve each mode; no new CSS override or fixed width.
Missing evidence retains the previous named refusal. Source objects unchanged.

Three new tests pass, including Chromium rendering through both React emitters:
under an explicit 50px consumer constraint, Default wraps, Inline remains
intrinsic at one 16px line, and switching back restores the initial geometry.
Exactly one text part is visible throughout. The captured-mode regression fails
on the old clean revision. Forty-two existing text-box/cross-fill checks pass;
TypeScript, lint and diff whitespace checks pass.

The 92-variant Input checker now reports 47 PASS / 44 FAIL / 1 UNVERIFIED, no
set-level problems. No net pass gain. Inline Large Enabled helper no longer
wraps, but measured content is 405x48 vs source397x48 (previously374x48).
Its white difference improves 3.017 to2.896 percent; black worsens5.096 to6.626.
The remaining shared +8px offset must be resolved; inspect the empty Toggletip
presence wrapper and its parent gap next, not root width compensation.

46 old passes remain measured passes. Default Large Error False switches from
PASS to UNVERIFIED due source paint-extent-blend-promotion-changed-raster;
Default Medium Error False switches from UNVERIFIED to PASS. Inline Large
Warning False switches from UNVERIFIED to FAIL. These are distinct evidence
changes, not a claim of all47 previous passes preserved.

The forty saved request/refusal probes finish with unchanged statuses and skip
reasons.39 requests are byte-identical; index3 Components Heading Left changes
its ds.badge-count dependency. Its visual replay remains required before this
change is qualified broadly. Clean-checkout engine/receipt rebuild also remains
pending; do not publish this candidate as qualified. Full204 remains2522/6312
at the old pin; reverse remains unqualified. All launched processes terminal.
Evidence: paired-regression-integration/variant-text-sizing-1024 contains the
package, screenshots, verdicts, test logs and forty request records. No push,
source-design mutation, publication or tester contact.


## Experiment 1025 — hidden flow host removed; Carbon Input 68 passes

Verified144f8dfb5. The extra8px Inline offset was the flex gap consumed by an
empty Toggletip visibility host.27dca7627 applies the independent live Boolean
to the host itself and retains structural enum presence through the existing
presenceByCombination matrix. The child keeps its identity, paint and own gate.
Positioned hosts remain unchanged. Regression now checks that hidden content
removes the in-flow host, not just its text. Four selected checks pass locally;
all91 forwarding/text-sizing tests pass in the clean checkout. TypeScript and
lint pass there too.

Same92-variant Input capture, unchanged checker/font manifest:68 PASS,23 FAIL,
1 UNVERIFIED; no set-level problems. All measured content-size mismatches are
gone. Inline Large Enabled now passes at1.322 percent white and1.170 percent
black. Triptych inspected: helper remains one line and the input starts at the
native position. Remaining reasons:16 content-missing,15 white-image overages,
6 black-image overages and1 source-framing refusal. These overlap. No threshold
changes or source edits. Broad full204 score is not recomputed from these gains.

Forty request probes finish without new preparation refusals or skip changes.
Compared with1024, indices6 and28 change (visibility hosts). Combined with1024,
index3 also changes (badge text sizing). Replayed all three: index3 still refuses
ds.avatar wrapperUser instance-affine-layout-host-unproven, also present in its
stored fixed40 baseline log; indices6 and28 both report0 PASS/2 FAIL, as in
their stored baseline receipts. This proves no coarse status regression, not
byte-identical visual metrics or that these fixtures are qualified.

Prior clean receipt preserved in6c5d674bc before switching to27dca7627. Engine
37d9181fb34a,2143487bytes; zip2504899bytes verified. One lowering line citation
updated without changing rule text; door register rederived and passes. Copied
only reviewed generated receipts. No full fast lane, push, publication, tester
contact or source-design mutation. All launched processes terminal. Evidence:
paired-regression-integration/presence-host-1025, including affected replays.

Next trace missing Inline input characters: source Inline Large Read-only False
has unbound Optional placeholder text='No input text', unlike the property-bound
placeholder in other variants. Preserve literal/default differences together
with editable controls; do not globally replace the user-facing text. Full204
remains2522/6312 at its old pin; reverse remains unqualified.


## Experiment 1026 — separate text controls; Carbon Input84 passes

Verified3b2609adc. The same Optional placeholder text layer has9 captured
Placeholder text bindings,12 Input text bindings and4 unbound No input text
literals. unifiedPropRef previously selected the first surviving control.
4e0dae58a partitions TEXT occurrences by character-control identity, including
a separate literal branch, before property unification. Existing exact source
presence gates retain the observed variant domains. No source mutation, global
text substitution, schema extension or checker change.

Four text-sizing/control checks pass, including both React emitters through
placeholder/input edits, read-only literal preservation and restoration. All92
forwarding/text-sizing checks pass in the clean checkout. TypeScript and lint
pass. All40 saved request/refusal records remain identical to1025.

Same92-variant Input checker:84 PASS,7 FAIL,1 UNVERIFIED, no set-level problems.
All68 prior passes remain passes;16 former failures now pass. No content-missing
or content-size-mismatch reasons remain. Seven failures are Inline warning/error
Small/Extra small image overages. Default Large Error False remains unverified
for paint-extent-blend-promotion-changed-raster.84/92 is91.3 percent for this
targeted family, not unseen-kit qualification and not an aggregate update.

Inspected read-only triptych: No input text now appears correctly. Inspected
Extra small Warning False: status icon lies too far left in the consumer.
Native Text input is288px; Text overflow has fillWidth=true and shares its row
with AI + Status icons. Next trace that allocation through proposal and CSS.
Do not offset the icon arbitrarily or relax the unchanged5 percent limit.

Prior receipts preserved in4d02c446d before advancing clean checkout. Engine
204fbc7863e3,2144022bytes,zip2505434bytes verified; lowering citations and door
register regenerated and checked. Copied only generated receipts. All launched
processes terminal. Evidence:paired-regression-integration/text-controls-1026.
No full fast lane, push, publication, source-design mutation or tester contact.
Full204 remains2522/6312 at its old pin; reverse remains unqualified.


## Experiment 1027 — sparse growth restores icon allocation;88 Input passes

Verifiedfac67cc46. Text overflow has87 Fill-width occurrences and one explicit
non-Fill exception (Inline Large Error False). Cartesian growth coverage dropped
all mixed allocation when eight absent combinations were included in the
expected domain. e40c650d1 preserves exact verified drawn/absent domains in
proposer and validator.067421c6c retains legacy full-matrix Boolean visibility
coverage;7678099cd adds its regression. No inferred missing rows, source edits,
icon offsets or threshold changes. Final request has88 allocation rows and
retains the one captured grow=false exception.

Initial drawn-only candidate had no effect (84/7/1), preserved separately.
Final package checker:88 PASS,3 FAIL,1 UNVERIFIED of92; all84 old passes remain.
Remaining failures are Inline Extra small Warning False5.48 percent white,
Warning True5.69 percent, Error True5.11 percent. Default Large Error False
remains paint-extent-blend-promotion-changed-raster unverified. No missing
content or content-size reasons. Inspected warning triptych: status icon now
occupies the native trailing position. Further pixel differences remain real
failures; no claim of whole-family or general beta qualification.

All19 growth tests pass locally. Clean checkout passes23 growth/text tests,
TypeScript and lint. Tests cover explicit drawn and absent domains, missing
row rejection, non-fill exception, and unchanged full-matrix Boolean gating.
An intermediate validator expansion caused fixed40 index23 to refuse; the
final boundary fix restores it. Final40 statuses/skips unchanged;39 requests
byte-identical to1026, index33 Twilio changes. Repackaging that input refuses
ds.button content layoutByCombination exact reachable-domain coverage, exactly
the pre-existing refusal in its stored baseline run.log. It is not a pass.

Prior clean receipts preserved in27df93300; intermediate build receipts in
d073a1196. Final engine dfeafa8df7e9,2144832bytes,zip2506244bytes verified.
Lowering citations and door register rederived/checked; only generated receipts
copied. All launched processes terminal. No full fast lane, publication, push,
tester contact or source-design mutation. Evidence:sparse-growth-1027 includes
initial and final checker artifacts and affected-case replay. Full204 remains
2522/6312 at the old pin; reverse remains unqualified. Next inspect the three
remaining raster differences without relaxing5 percent or altering fonts
without source evidence.


## Experiment 1028 — text residual isolated; Material197 hidden-source diagnosis

Verified7744c278b. No engine edits. Carbon Input remains88/3/1. Its three
remaining failures have equal content sizes and matching text color/family/weight.
Text-masked diagnostic differences are0.1573,0.1283 and0 percent respectively;
full unmasked scores remain5.4793,5.6911 and5.1072 percent on white and remain
FAIL. Pixel inspection finds different glyph-edge alpha coverage; this is not
proof of a font substitution, permission to alter fonts, or a tolerance waiver.
Saved carbon-residuals.json preserves the unchanged scorer evidence.

Prioritized the large unmeasured197-state Material List Item family rather
than tune three near-threshold Carbon samples. Current package/checker replay
of full204 saved set51964:68562 completes0 PASS/0 FAIL/197 UNVERIFIED, plus
named-slot-not-exercised:swapDividerType. Old bounds contain valid360x56 layout
boxes but null render bounds for all197 sampled variants and sampled children.
Fresh read-only Figma REST file inventory at depth3 proves the component set
itself visible=false, under visible Lists page55141:14249 and visible Baseline
section55412:16936. Its -2 Density sibling is also hidden;0 Density is visible.
This is a concrete source visibility prerequisite, not a missing numeric
layout box or justification to treat layout bounds as rendered bounds.

Community source unchanged. No native clone, source unhide, successful visual
measurement or score credit claimed. The197 misses stay in the denominator.
Python ancestor read failed local TLS certificate verification; retried with
Node's verified fetch successfully, without disabling verification. No token
printed. Material file has no active Desktop Bridge connection; current six
connected files were inventoried read-only. All launched processes terminal.

Evidence:paired-regression-integration/material-source-visibility-1028 contains
full replay/package/receipt, read-only ancestor inventory and Carbon residuals.
Full204 remains2522/6312 at its old pin; reverse remains unqualified. No build
needed (no engine edits), push, publication or tester contact. Next prioritize
an actionable family such as Twilio Visual Picker112, or establish a separately
qualified visible source instance in writable evaluation space; do not bulk
rerun hidden-source Material or font-blocked Radix as if compute fixes inputs.


## Experiment 1029 — Visual Picker packages through explicit drawn states

Verified7ccea9c0b. Saved Twilio112-state capture still refuses attempted
interaction-state promotion: Focus/Hover drawings cannot be carried through
that semantic projection.6f6dda203 extends the existing qualified React runtime
route only for ExactProjectionError/EXACT_SEMANTIC_PROJECTION_AMBIGUOUS with
state-axis-state-not-carried. It retries through the existing independently
checked source-domain declaration, preserving State as an explicit finite prop.
Ordinary import still refuses; missing stamp observability still refuses;
interaction behavior is explicitly not inferred. No source tuples added.

Two new tests verify ordinary refusal, unchanged source, explicit State values,
no invented interaction states, actual distinct text on both React emitters
through switches/restoration, and DRAWN_VARIANT_UNDECLARED for an invalid value.
All25 focused state/growth/text tests pass cleanly; TypeScript/lint pass. All40
saved request/refusal records remain byte-identical to final1027.

Visual Picker now packages, but unchanged112-variant checker reports0 PASS,
112 FAIL,0 UNVERIFIED. All112 name font-unavailable-in-consumer:Twilio Sans Text;
52 content-missing,28 size mismatches,24 white-image overages,28 black-image
overages overlap. Set findings: State discarded three times, Selected twice.
First default Example case is within both image limits yet lacks the RadioDot
part and the exact font prerequisite. This is measurement access, not a pass.

Local font search found TwilioSansText WOFF2 files in font-inputs-2026-09-29.
Metadata inspection of Regular/Semibold reports internal family Copyright
Sharp Type Co., style This font is for web use only., weights400/600. The prior
family-validation.json explicitly marks them unauthenticated, explaining their
absence from the active manifest. sources.json records official Twilio asset
URLs and Paste fonts.ts references. No file renamed, aliased, modified or added
to the authenticated manifest. Next verify the exact byte-to-family mapping
against first-party font declarations before designing any provenance route;
keep the existing missing-font failures until qualification is established.

Clean receipts preserved in c70568680 before advancement. Engine800d088ba8db,
2144959bytes,zip2506371bytes verified; no lowering citation changes; door
register rederived/checked. Only generated receipts copied. All processes
terminal. Evidence:paired-regression-integration/explicit-picker-states-1029.
No full fast lane, push, publication, tester contact or source-design mutation.
Carbon remains88/3/1; full204 remains2522/6312 at its old pin; reverse unqualified.

## Experiment 1031 — candidate smoke and CI registration repair

The preceding owner check-in restated status without advancing the engine.
Revalidated writer de8a6719a and qualification checkout 6f6dda203; the latter's
three pending generated receipt files match the writer byte-for-byte. The
source commits differ only by receipts and this ledger. Parked source edits
remain untouched. No other qualification runner was active before launch.

Ran the installed CLI smoke with Node20.19.4 from qualification checkout,
keeping its empty-directory installation. PASS: packed rc.3 installs outside
the repository, reproduces the Badge benchmark pin, builds/renders its consumer,
and correctly reports all10 variants UNVERIFIED without Figma access, NOT
CHECKED without Chromium, and refuses a wrong-family font. This does not prove
live fidelity, outside-user completion, Linux behavior or release readiness.
The archive and hash are retained in beta-candidate-1031/candidate.json.

Started the full fast lane against the same qualification source. Its initial
ci:lanes gate found two omitted registrations: explicit-state-domain.test.ts
and variant-text-sizing.test.ts. Commit4f092543f adds both to the existing
CI-invoked exact-proposal script. npm run ci:lanes now passes, including all3
runner tests. Only the registration delta was committed; the unrelated parked
package.json delta remains unstaged. The running lane is intentionally left
on its original candidate, so its initial failure is not erased by this fix.

At this checkpoint the full lane is still running under exec session63609,
log /private/tmp/beta1031/fast.log, checkout ds-contracts-beta-gates-971. Resume
that handle before any repeat; collect terminal summary and investigate its
actual failures, then qualify the registration fix on the clean checkout.
No push, publication, source mutation or tester contact. Full204 remains
2522/6312 at the old pin; reverse remains unqualified. Carbon remains88/3/1.

## Experiment 1032 — ellipse resize candidate removes52 missing-content failures

Revalidated336339c44 and resumed fast-lane session63609; it remains live on
its original candidate, with the already-fixed CI registration failure. No
restart. source:reference:check passed in252.2s and runtime:check in11.8s.

Pinned first-party Twilio Paste fonts.ts atfbd39963687623baf9352e034b83dbe8bb70eeff.
All12 Twilio Sans Text local WOFF2 files match newly fetched official assets
byte-for-byte. Official CSS family is TwilioSansText, while Figma records
Twilio Sans Text and the files' internal family is Copyright Sharp Type Co.
This is web-asset provenance, not proof of Figma desktop font identity. No
font bytes, manifest, authentication rule or scorer changed. Exact URLs,
hashes, declarations and fetch script retained in ellipse-resize-1032.

Independent source-content evidence identifies RadioDot's actual defect:
20px main with10px ellipse and5px STRETCH insets becomes16px instance with6px
ellipse. The proposal retained10px size and5px offsets but lost constraints.
Candidate core/propose-figma.ts now routes uniform unrotated full ellipses
with resize constraints through the existing validated absolute coordinate
owner. Parent inconsistency still rejects that route. Existing CI-registered
compound-ellipse-placement test now exercises20→16→32→20 parent dimensions
in both React renderers. All3 tests pass in the writer (which retains parked
unrelated edits; clean qualification still required).

Actual112-state replay with unchanged font manifest/scorer:0PASS/112FAIL/0
UNVERIFIED. Missing-content failures52→0; remaining112 missing-font failures,
28 size mismatches,24 white overages,28 black overages and5 discarded-prop set
findings unchanged. No pass credit claimed. Full204 remains2522/6312 at oldpin;
reverse unqualified. Candidate patch and complete checker receipts archived.

Candidate engine/test edits remain uncommitted pending qualification. Fixed40
request regression probe running as session50469, log /private/tmp/font1032/
fixed40.log, output /private/tmp/tree998/fixed40-complete-ellipseresize1032.
Compare against explicitstate1029 after it terminates. Then preserve matching
pending clean receipts before advancing qualification checkout, validate and
rebuild engine receipts. Do not mutate the checkout while fast lane63609 runs.
No push, release, tester contact or source-design mutation.

## Experiment 1033 — affected families verified; schema gate repaired

Prior turn was progress: candidate geometry and112-case evidence. Revalidated
8984c2076, resumed existing50469 and63609 handles without restarting either.
Fixed40 probe finished40rows, no status/refusal changes,38 byte-identical
requests. Only Material tabs(index18) and HeroUI Slider(index21) changed.
Material tabs replay retains8PASS/0FAIL/0UNVERIFIED. HeroUI Slider packages and
reports0/2/0; independently replaying the pre-fix6f6dda203 candidate yields
exactly the same image percentages and failure reasons (211px width versus
200px, plus disabled image/height failures). The older926 packaging refusal
was stale and was not used as the regression baseline. No score credit added.

Expanded the existing ellipse browser regression to cover both STRETCH and
SCALE under20→16→32→20 parent resizing in both React emitters; all3 tests pass.
Candidate core/test edits remain uncommitted, awaiting clean integration and
engine receipt generation after the active qualification run ends. Its current
patch and all affected-case receipts are in ellipse-regressions-1033.

Fast lane63609 remains active on6f6dda203 with matchingde8a6719a receipts.
It exposed a stale contracts/contract.schema.json and101 missing reference
branches:100 observed-binding evidence fields and componentRef.rootFill.
3e12835f4 regenerates the editor schema from the unchanged Zod authority,
registers explicit branch keys, documents observed-vs-resolved paint evidence
and parent-owned cross-axis fill restrictions. schema:fresh passes both200902
byte projections and all661branches (0missing/0stale), including2introspection
tests; site TypeScript and docs gates pass. No validation guard weakened.

The continuing baseline lane also reports three failures in
core/solid-fill-composition.test.ts: line259 expects nested NORMAL owner counts
0but receives1; line561 expects33occurrences but receives66; line700 expects an
exception no longer thrown. These need semantic review, not blind expectation
updates. Log:/private/tmp/beta1031/fast.log. Resume session63609; do not mutate
ds-contracts-beta-gates-971 while it runs. Registration and schema fixes are
not in that already-running candidate. Full lane is not green. Pending clean
receipt files still need preservation before advancing its checkout.

Full204 remains2522/6312 at its old pin; reverse remains unqualified. Twilio
112 remains0/112/0 despite52content misses removed. No push, publication,
tester contact, source-design mutation, font alias or threshold change.

## Experiment 1034 — ellipse fix qualified; baseline fast lane terminal

Previous turn made progress through schema repair and affected-family evidence.
Revalidateddd64fd122. Baseline fast session63609 terminated exit1:4/201 gates
failed,11skipped. Failures:ci:lanes registration, schema:fresh, exact-proposal
(four assertions), and design-to-code census (WEB_COMPONENT_PRESENCE_COMBINATION_UNSUPPORTED).
Full log/summary archived in beta-candidate-1031; its status record now terminal.

Reviewed the assertions against the current behavior rather than changing
pixels or refusal thresholds. Draft paint inspection now counts the captured
empty root alongside its nested source owner: tests assert empty rows have
zero opacity and no recreated binding. Bound-source tests retain all33binding
proofs and independently account for the additional33empty-root occurrences.
Leaf composed fills now support foreground strokes; tests assert separate
fill/stroke planes and retain refusal checks for conflicting effects, while
existing browser tests check leaf pixel alpha/color. Complete text resize
observations now partition into exclusive tone-a intrinsic and tone-b fixed
parts; contradictory FILL and missing evidence remain refused by name. All
independent native PNG comparisons remain byte-exact.49focused tests pass.

Preserved prior matching clean receipts in2bdd00815, then advanced the idle
qualification checkout to writerdd64fd122 and applied only the four candidate
source/test deltas. Fixed a TypeScript annotation error in the new assertion;
no runtime behavior changed by that repair. Clean TypeScript, lint,56focused
tests,ci:lanes andschema:fresh pass. Rebuilt and independently verified engine
9e68bf0b0503 (2145664bytes),zip2507076bytes. One lowering citation shifted16lines;
rule text unchanged. Door register rederived and checked. Only the five
reviewed generated receipt/citation/register files copied back to the writer.

8ee022fc9 commits the ellipse fix, tests and generated receipts. Parked source
and package edits remain untouched. The1032real replay removed52content-missing
findings;1033retainedMaterial8/8 and matchedHeroUIbaseline0/2 exactly. No new
variant passes claimed:Twilio remains0/112/0; broad2522/6312oldpin; reverse
unqualified. Evidence:ellipse-qualification-1034 plus1032/1033archives.

Exact-proposal gate rerun is active as exec session58062, log
/private/tmp/qual1034/exact-proposal.log, in ds-contracts-beta-gates-971.
The clean checkout has the reviewed candidate and receipts as pending changes
matching8ee022fc9; do not mutate it until that run terminates. Then preserve or
verify those bytes before advancing. The remaining known census failure still
refuses Web Components presence combinations; no gate waived. No complete
fresh fast-lane green, push, release, tester contact or source-design mutation.

## Experiment 1035 — maintained census repaired; fresh full lane running

Prior turn was progress: ellipse fix and reviewed regression updates. Rechecked
670ff54fb; exact-proposal session58062 ended successfully:1027tests,0failures.
The four baseline fast-lane failures now each have a passing targeted rerun.
This does not replace a fresh full-lane result.

Census diagnosis with actual committed REST fixture identifies only Button
slotBefore/slotAfter: independent Boolean visibleWhen plus a complete two-row
iconOnly presence table.1b42284c4 lowers that existing Boolean guard case in
the Web Components renderer and conjoins both controls. Joint, enum, incomplete,
duplicate and constant tables remain refused. React proposal/scorer unchanged.
The existing CI-registered presence test suite now runs the actual bundled
custom element through all four Boolean combinations and restoration;25tests
pass, including existing joint-table refusal and new malformed-table negatives.
This repairs maintained regression coverage, not an expansion of the V1 goal.

Clean checkout receipts/source from1034 preserved inf45d74eae before advancing.
Clean TypeScript, lint,25tests,site TypeScript and docs gates pass. Census
regenerated from its unchanged fixtures then replayed:23sets,3131carried,
3943named,0SILENT, deterministic proposal/generation, green. Reviewed four
receipt deltas: only contract/generated-file hashes and Chip notes324→328;
all carriage facts and named misses byte-equivalent. No facts reclassified or
scorer guard weakened. Existing plugin engine9e68bf0b0503 andzip2507076bytes
verify unchanged (this emitter is not in that bundle). Only the four reviewed
census receipts copied to writer with the emitter/test/reference edits.

1b42284c4 commits the compatibility fix and receipts. Git refused switching
the qualification checkout with matching pending files; preserved all seven
byte-verified changes in1125a6b5a, then switched normally. No stash/reset/clean.
The qualification checkout is clean at1b42284c4; rebuilt CLI and started fresh
full fast lane as exec session34326, log /private/tmp/census1035/fast.log.
Do not mutate that checkout while it runs; poll the existing handle. Evidence
archived in census-compatibility-1035. All other launched processes terminal.

No push, release, tester contact or source-design mutation. Broad forward
2522/6312(oldpin), reverse unqualified, Twilio0/112/0 remain unchanged. Next
collect the full lane, then resume user-journey and broad conversion evidence;
a maintenance census pass is not a new first-pass fidelity score.

## Experiment 1038 — preserve nested shape paint and exact child state selection

Previous check-in was a verified wait: full-fast session34326 remained live.
Revalidated writer f87a9f79f and protected parked edits. The original 80% in
both directions finish line remains unchanged; a supervised pilot is not its
replacement. Full-fast remains pinned to1b42284c4, not this new candidate.

Twilio Picker's child state depends on Error × Selected × State. Eight Hover
source cells deliberately select Default. Its BaseCheckboxRadio also changes
nested RadioDot shape paint across State, which pseudo-state promotion froze
at rest. Exact projection now names that uncarried child argument; the existing
qualified React drawn-domain route preserves State as an explicit enum. No new
interaction inference or schema is introduced. Shape argument combination tables
now include null rows where the owning instance is absent, as text paint already
does; duplicate occurrences and foreign variant names remain refused.

Fresh real packaging proposes all11 source sets (no skipped child/stub). An
independent comparison matches all112 generated child-state selections to the
source. BaseCheckboxRadio preserves its32-row radio-dot paint table. A new
CI-registered regression exercises two-axis paints, absent-instance cells and
restoration in both actual React renderers, including generated TypeScript.
10focused tests, root TypeScript and lint pass. All40 complete fixed-set requests
are byte-identical to ellipseresize1032; no preparation status changes.

Unchanged-font/scorer real112 replay remains0PASS/112FAIL/0UNVERIFIED, but removes
all3 discarded-State set problems. Both discarded-Selected problems remain.
Missing content stays0; font failures112, size failures28, white overages24 and
black overages28 unchanged. On each background58 image differences improve,
34 worsen (maximum0.10493 percentage points),20 are identical; no threshold
failure-count increase. This is state-carriage progress, not a new variant pass.
Broad forward remains2522/6312 at the older pin; reverse remains unqualified.

Evidence: durable nested-state-1038 archive, including package2/check, source
mapping verification, comparison JSON, tests and logs. Source candidate requires
clean plugin/lowering/door receipt regeneration after session34326 terminates;
do not change its qualification checkout while it runs. All1038 spawned jobs
are terminal. No push, publication, source-Figma edit or tester contact. Next:
collect the existing full lane, qualify this candidate's build receipts, then
inspect the16 disabled-radio selected transitions still unchanged by the checker.

1038 qualification completion: existing full-fast session34326 ended exit0:
190/201 passed,11 workflow-condition skips,0 failures, pinned1b42284c4.
Terminal log/summary archived in census-compatibility-1035. This proves the
prior four gate repairs, not a full lane for1038. With the clean checkout still
clean, switched normally to189aefe42. Rebuilt schema/core, regenerated and
independently verified plugin engine dbc024516c9d (2146946bytes), zip2508358bytes;
10focused tests pass there too. Lowering unchanged. Door-register deltas are
seven source-line shifts only; checked successfully. Only three reviewed
receipt/register files copied to writer. Source fix e897debe0, documentation
count correction189aefe42. The qualification checkout retains those matching
three generated files as pending changes; preserve before advancing. All
processes launched or followed this turn are now terminal. No fresh fullfast
for1038, push or release claimed.

## Experiment 1039 — empty child paint and ancestor absence survive conversion

Previous turn was progress: e897debe0 fixed state mapping and the prior baseline
full-fast completed green. Revalidated writer ddd378e09 and unchanged parked
edits. Live readonly REST proves the disabled unselected radio's ellipse has
fills:[] while selected has gray ink. The same omission affects the checkbox's
vector. The old host reader recorded only fields:[fills], losing explicit empty
paint and inheriting the child's gray default. Both canonical readers now retain
an exact nearest-main target plus sourceEmptyFill; missing lists, invisible-only
paints, foreign/missing owners and unsupported text shapes do not become empty
paint. Canonical plugin dump advances1.75→1.76. Shape arguments use transparent
paint; existing direct vector color overrides retain empty paint with owner
identity checks. No source design or font manifest changes.

The second cause was mint coverage: a checkmark present only under its checkbox
container did not receive the ancestor's observed absence proofs. buildPart now
combines actual own/ancestor absence cells for observations created inside that
part. The existing mint classifier still requires complete noncontradictory
coverage. No fabricated measurements or loosened matrix guard. BaseCheckboxRadio
now emits checkmark color over Selected × State. Test coverage includes clearing,
restoration, ancestor absence, foreign identity and both real React renderers.

Source fix0bc6bd218;48 initial tests and71 final focused tests pass, plus root
TypeScript/lint. Fresh11-set capture has no changed prior source values: relative
to the older capture it adds533 localGeometry observations and explicit empty
paint identity. Running the previous engine on the first fresh capture yielded
a byte-equivalent request to1038, isolating those geometry additions. All11 sets
package with the final fix. Unchanged font/scorer112 replay has no discarded
State or Selected set problems. Correction to the prior next-step description:
1038's remaining8 unchanged selection transitions were CHECKBOX, not radio.
Final1039:0PASS/112FAIL/0UNVERIFIED,112font failures,28size,24white/28black image
overages,0missing content.60 images improve on EACH background,52 unchanged,
0worse. No new variant passes claimed. Broad2522/6312 remains oldpin; reverse
unqualified.

Fixed40:39 requests byte-identical; only33/TwilioCodeBlock changes (Button text
color token routing with ancestor presence). Saved pre-change request and new
request both hit the identical existing layoutByCombination coverage refusal
for ds.button, cascading to CodeBlock. No new packaging refusal; no image pass
claimed for this refused set. Requests, exact refusal comparison and all three
intermediate Picker replays retained in durable empty-paint-1039 archive.

Clean qualification: preserved byte-verified1038 receipts in11f3739c3 before
switching normally to0bc6bd218. Initial plugin build correctly refused stale
embedded dump; ran plugin:embed-dump, then rebuilt and independently verified
engine a4664af6d112 (2147228bytes),zip2509110bytes. Clean71tests,TypeScript and
playground:flow-check pass. Lowering unchanged; door register rederived/checked,
only source-line shifts. Four reviewed generated files copied back: embedded
canonical dump, engine receipt and both door-register files. Parked map changes
were excluded from the source commit by staging only the reviewed empty-paint
hunks. All parked work remains intact. Maintained census is the final active
check, session recorded in the follow-up below. No push, release, tester contact
or new broad first-pass score. Next target: authenticate the missing font input
and remaining layout failures without aliases or weakened checks.

1039 final check: census session83835 ended exit0,23sets/3131carried/3943named/
0SILENT, unchanged receipts. All jobs followed or launched this turn terminal.
Clean qualification checkout remains at0bc6bd218 with the four reviewed generated
files pending, matching the writer's committed receipt update; preserve those
bytes before advancing. No fresh full-fast for1038/1039 is claimed; last fullfast
remains1b42284c4 (190pass,11workflow skips,0fail).

## Experiment 1040 — font reader ruled out; CodeBlock packaging reaches measurement

Previous turn was progress: empty paint and ancestor absence fixes committed;
Picker state/selection set problems cleared. Revalidated bf30780e7 and preserved
parked edits. Independent fontTools name-table parsing of all12 pinned local
TwilioSansText faces agrees with the consumer reader: IDs1/16/21 name only
"Copyright Sharp Type Co.". No matching local TwilioSansText face found in
~/Library/Fonts or /Library/Fonts. Existing1032 official-asset byte provenance
stands, but does not supply the font-declared family required by the unchanged
font guard. No file renaming, alias, scorer edit, metadata rewrite, OS font
installation or new font registration. Stop treating this as a parser bug or
repeating the same provenance check; work on other independently solvable misses.

The fixed40 CodeBlock dependency Button had430 layout rows, exactly matching
its visible domain, with28 hidden loading rows correctly absent. Validator used
presenceByCombination to scope internal layout but ignored an equivalent
visibleWhen enum gate. e5c0c31ce uses the existing reachablePresenceTupleKeys for
both. Exact coverage remains required; missing visible, duplicate, foreign and
extra hidden rows still refuse. Existing test scenarios now exercise both gate
forms on full/declared domains and both actual React renderers.10focused tests,
TypeScript and lint pass; all40 prepared requests byte-equivalent to1039.

Real four-case CodeBlock now packages and is checked instead of generation
refusal:0PASS/4FAIL/0UNVERIFIED. Multiline image differences2.29272%/2.33508% on
both backgrounds; missing icons, text colors and unavailable Twilio font still
fail. Single-line images53.7723%/53.8961%,760x136 instead of760x60; text colors
and icons also fail. Set problems text-prop-never-rendered and ledgered inert
linkButton remain explicit. No acceptance score increase claimed; broad forward
2522/6312 remains oldpin, reverse remains unqualified, Picker0/112/0.

Clean qualification preserved1039's four byte-verified files in d438e0e49 before
switching normally to e5c0c31ce. Schema/core built; engine f484fd0e6421,
2147232bytes,zip2509114bytes regenerated and independently verified. Only engine
receipt changed; lowering/door files unchanged. Clean10tests and maintained
census23sets/3131carried/3943named/0SILENT pass. Evidence archived as
visible-layout-1040, including independent font metadata and four-case replay.
No source-Figma edit, push, release or tester contact. Next: fresh full-fast for
the accumulated1038–1040 fixes, and prioritize the next conversion defect from
broad failure counts rather than repeatedly rechecking an unavailable font.

1040 continuation handle: preserved the clean engine receipt in1e6be267e,
then switched normally to750f90b49; qualification checkout clean. CLI rebuilt.
Fresh full-fast session76521 confirmed live,201steps, log
/private/tmp/font1040/fast.log. Do not mutate that checkout or restart the run
while its handle remains live. All other1040 jobs are terminal. Last completed
full lane remains1b42284c4; this new run has no terminal verdict yet.

## Experiment 1041 — hidden instance visibility ownership; menu dependency refusal exposed

Revalidated361516840 and protected parked edits. Ranked the old204-set sample by
font-independent failures (ranking.json). RadixSlider72 failing cells are not a
proven root-height defect: examined size3 range75 root300x12 matches source300x12;
source render bounds300x26 overflow, and checker refuses render-export-overlap
proof. Do not change CSS height or scorer to resolve this evidence failure.
Current432-case Slider package prepared; no new image score claimed.

Radix _context-menu-group856:35911 reproduced0PASS/24FAIL/0UNVERIFIED on the
current engine. All24 lose three Text labels because dependency _context-menu-item
refuses visibility-demand-source-part-not-emitted and becomes a stub. Source
parent instances explicitly reveal Radio/Checkbox roots that are hidden in every
main occurrence; the early hidden-instance omission discarded their already
identity-qualified visibility demands before controls could be authored.

1ceaee959 retains such demanded instance owners, preserves hidden defaults, and
removes an empty declared object after consuming display:none. Existing identity,
complete presence and owned-part checks remain. New test exercises hidden,
revealed, false and restored-default states in both React renderers, plus omission
without a demand.13focused tests pass; TypeScript/lint pass. All40 prepared
requests/refusals identical to1040 (not a visual scoreboard).

Real final menu package now resolves the actual child but refuses on Checkbox's
abstractCheck/typographyDash component-grow-host-unproven: parent-owned grow plus
size/color overrides is not yet qualified. The initial intermediate also showed
empty declared-object failures; final attempt removes those and retains only the
icon-grow dependency refusal. No acceptance increase claimed; packaging refusal
is explicit and cannot be substituted for a passing rendering. Next defect is
that observed grow/override composition, not a menu-specific text patch.

Evidence archived in visibility-owner-1041 (source paths, unchanged baseline
receipt, all attempted requests/refusals, focused test logs and fixed40comparison).
Broad forward remains oldpin2522/6312=39.96%; reverse unqualified. No owner wait,
no beta ETA established. No push/release/source-Figma edit/tester contact.
Fullfast76521 remains live at clean750f90b49, log/private/tmp/font1040/fast.log;
do not mutate/restart its checkout. Latest1041 source is NOT included in that
run. Clean engine/lowering/door qualification for1ceaee959 remains next after
that lane terminates; do not treat old engine receipts as covering this change.
All1041 jobs terminal; only inherited76521 active. Parked files untouched.

## Experiment 1042 — scalable icon growth recovers the real menu dependency

Previous turn was progress: visibility owner fix and measured downstream refusal.
Revalidatedfe893b5e2; inherited fullfast76521 was confirmed live, then completed
exit0 at750f90b49:190/201passed,11workflow-condition skips,0fail. Terminal log
archived. This prior-pin lane does not include1041/1042.

89f45bfda qualifies scalable vector size/color/stroke overrides with parent-owned
growth for a generated single root. CSS-module React now carries override custom
properties and growth on the actual child root instead of adding a conflicting
wrapper; it does not set a replacement display mode on that root. Inline React
already carries these bounded vector overrides on the root. Validation still
refuses arbitrary nonvector overrides, multi-root parents/children, caller style
APIs, grid placement and state-override combinations. No scorer/threshold edit.

20focused tests pass including both actual React targets measuring120px growth,
24px override height and blue override paint; negative custom-style, nonvector
and state-override cases remain refused. TypeScript/lint pass. All40prepared
requests/refusals identical to1041; renderer behavior is tested separately.
Real Radix context-menu-group24 replay now resolves all8dependencies, none
skipped, and packages. Three missing labels recovered in every cell. Image
within-limit cases12→24; both-background differences now2.06019–4.13333%.
Acceptance remains0PASS/24FAIL/0UNVERIFIED: all24font-unavailable-in-consumer
(SF Pro). Set problems text-prop-never-rendered and variant-prop-discarded:type
remain explicit; no pass-rate increase claimed.

Follow-on defect observed in actual generated request: every item has only1true
row per showCheckboxOverride/showRadioOverride instead of8 source true rows.
propose-figma.ts12527 loops identity bindings individually, each writes the same
prop's whole table, and later main identities overwrite previous ones. Next:
aggregate same-prop identity bindings before collecting per-occurrence values;
retain conflict refusal and null for genuinely absent overrides. Do not remove
set findings merely because image differences are below5%.

Clean checkout advanced normally from clean750f90b49 to89f45bfda after76521
terminated.33focused tests pass; lowering unchanged. Engine077eb4f46ef4,
2148312bytes,zip2510194bytes regenerated and independently verified. Door register
rederived/checked; only seven citation pairs moved. Three reviewed files copied
back (engine receipt and both door-register files). An accidentally broad default
census invocation returned its53existing NOT-recognisable blind verdicts; this is
not a fresh visual replay or a newly green acceptance claim. The intended live
design-to-code census then passed23sets/3131carried/3943named/0SILENT,exit0.
Evidence retained in scalable-growth-1042 including the default-red log.
Alljobs terminal. Clean checkout has those three reviewed generated files pending;
preserve them before advancing. Parked writer changes untouched. No push, release,
source-Figma edit or tester contact. Broad forward still2522/6312oldpin; reverse
unqualified. No owner wait. Full goal remains active.

## Experiment 1043 — visibility tables preserve all source-main identities

Previous turn was progress; verified0306e7efa and protected parked changes.
668dccb58 groups visibility bindings by generated control before collecting
identity-matching overrides per occurrence. Former per-binding writes replaced
the whole table, retaining only the last main identity. Each observation still
requires file/set/main/path/revision identity. Multiple matching source overrides
refuse visibility-control-source-conflict; genuinely absent values stay null.
14focused tests pass including two source mains with true/false/absent arguments,
reversed parent order, conflicting observations, and existing browser/native
visibility tests. TypeScript/lint pass. Fixed40all requests/refusals unchanged.

Real24-case menu replay: all8dependencies proposed,0skipped. Allfiveitem uses now
have8true rows per Radio/Checkbox visibility control (formerly1); all24row domains
retained. Fourteen white+black images improve,10unchanged,0worse. All24remain
within5%; discarded-type set problem disappears without changing the checker.
Acceptance stays0PASS/24FAIL/0UNVERIFIED because SF Pro unavailable in all24.
Remaining set problem text-prop-never-rendered concerns the optional label, whose
default visibility is false. No font alias or scorer change. This family is not
counted as qualified merely because its image threshold now passes.

Clean qualification preserved1042's byte-verified receipts in239231e35 before
switching normally to668dccb58.14tests pass; lowering unchanged. Engine
f12c6f5eeb16,2148467bytes,zip2510349bytes regenerated and independently verified.
Door register line-only updates rederived/checked; maintained design-to-code
census23sets/3131carried/3943named/0SILENT passes. Three reviewed generated files
copied back. Clean checkout retains those three pending files; preserve them
before advancing. Alljobs terminal; last fullfast750f90b49 remains190pass,
11workflowcondition skips,0fail and does not cover1041–1043.

Next font-independent candidate revalidated now: SDSButton4185:3778,
fileWUXHMvoWpLdsd82WGSXWSi,18variants,3dependencies,0skipped,4PASS/14FAIL/0UNVERIFIED.
Fourteen white and11black image overages; no font/content/size mismatch reasons.
PrimaryMedium default5.30%white/4.96667%black; Hover5.76667%/5.26667%; Disabled
4.93333%/4.3%passes. Named-slot-not-exercised:iconStart/iconEnd remain. Inspect
actual rendered/source pixels and geometry next; do not loosen5% for near misses.
Evidence archived as visibility-combination-1043, including new SDS baseline.
Broad forward remains oldpin2522/6312; reverse unqualified. No owner wait, push,
release, source-Figma edit or tester contact. Goal active; parked files intact.

## Experiment 1044 — authenticated Inter version explains SDS image failures

Previous turn was progress. Revalidatedfb048325f and protected parked edits.
Inspected real SDS triptych: consumer73x40 vs source75x40; source padding12 and
inside stroke are carried correctly. Fresh read-only REST of text4185:3781
reports Inter Regular400,16px,letterSpacing0,auto width51px. Font probe with
existing official Inter4.001 gives48.90625px at default optical sizing,49.296875
with optical sizing disabled; neither rounds to51. No layout/padding/font-size
patch or optical-sizing override is justified by this evidence.

Downloaded unmodified upstream release https://github.com/rsms/inter/releases/tag/v3.19
(asset Inter-3.19.zip); preserved release metadata, archive hash, license and
individual face hashes. Independent fontTools confirms old inputVersion4.001,
newVersion3.019; both declare familyInter. Official3.019Regular renders50.171875px,
rounding to source51 through the existing auto-text rule. Source REST does not
expose exact font binary/version; matching version is an evidence-backed candidate,
not a claimed source-file hash. No OS font install, alias, metadata rewrite,
source-Figma edit, checker change or generated-code edit.

Same engine/source/generated bytes, only font input changed:
- SDSButton18variants:4PASS/14FAIL→18PASS/0FAIL. PrimaryMedium white5.30%→0.20%,
  black4.96667%→0.10%. Two named-slot-not-exercised findings remain; variant passes
  do not imply exercised optional-slot coverage.
- UntitledUI_SelectMenuItem64variants:49PASS/15FAIL→55PASS/9FAIL with static3.019.
  No former pass fails; all generated hashes identical; no set problems.
  Nine remaining misses:2white/7black image overages.
- Official3.019roman variable font also gives SDS18/18passes, same generated hashes.

Initial cross-kit all-static+all-other-font manifest exceeded existing32-face
limit and correctly refused; original baseline had completed. Retried in a new
output directory with Inter-only9faces, keeping that failed attempt. The official
roman variable file declares familyInter (not Inter var) and weight100–900, so a
full candidate replaces exactly one baseline face and keeps all other font inputs.
Original authenticated manifest unchanged. Candidate stored durably at
private/beta-kits/font-inputs-2026-09-29/inter-3.19/full-candidate.manifest.json;
static-only candidate, metadata/license/provenance alongside. Evidence archived
as inter-version-1044. This is targeted evidence, not an increment to old broad
2522/6312 nor a first-pass never-seen result. Reverse remains unqualified.

Fresh full204 sample started to measure combined current engine and candidate
font inputs. Preserved byte-verified1043clean receipts in13a85e8f3, switched
normally to cleanfb048325f. Same unchanged runner/run-full204.mjs, same204sample
SHA59456871c3db8a1bff90a8ed861260299075f7388936c60f48ac9ce6993d7357,
1consumer at a time,15second pacing. Output private/beta-kits/full204-1044,
font manifestSHA71dda427260f58b318191af9eb459ea68eff8077d3d87131857c6fe222bca148.
Active session34144 confirmed live; log/private/tmp/sds1044/full204.log. Do not
mutate clean checkout or candidate fonts, restart, or run another REST image
checker concurrently. All targeted jobs terminal. Writer remains available for
independent investigation; at most two lanes. No new broad score yet. No owner
wait/push/release/tester contact. Goal remains active.

## Experiment 1045 — retained hidden owners and native variable evidence

Previous turn was progress. Revalidated6c584aa9f and confirmed34144live; full204
cleanfb048325f remains frozen. Inspected remaining Untitled UI black-background
text differences from1044, but found no justified weight/color substitution:
source explicitly500/400Inter and declared fills match; do not tune typography
or thresholds to residual raster differences. Prioritized fresh broad refusals.

Fresh Carbon Tile20125:279432 refused child-paint-order-child-identity-unqualified.
Diagnostic showed9counted source children versus10emitted owners: hidden AI layer
Border retained for captured composed paint was still filtered out of stacking.
567899117 keeps a hidden instance in the paint-order domain when its observed
node IDs already have emitted source owners. Hidden defaults/paint guards remain;
no invisible layer is made visible. Regression includes a caller-revealable hidden
instance amid an arbitrary child permutation.29focused visibility/paint-order
tests,TypeScript/lint pass. Fixed40allrequests/refusals unchanged. Temporary
console diagnostics removed before commit. Actual freshTile now reaches the
separate solid-fill-composition-source-variable-binding-unqualified:consumer-missing
refusal. No generated package or image pass claimed for Tile.

The same variable-consumer refusal affects fresh Carbon TextInput92variants and
other sets. Existing solid-fill tests intentionally require this evidence; no
guard relaxed. Confirmed connected Desktop Bridge target Carbon file
A451UfD58U7XU21FzaqfHL (Tile page), then read original nodes20125:279433 and
58483:701 with fileKey explicitly pinned in each execute call. Native API resolves
layer(contextual),collection Layer level,mode28192:0 and Transparent,collection
Theme,mode25984:0. Both variable keys/names,collections,modes and consumer-resolved
RGBA are available despite REST variable-scope403. Read-only proof archived in
native-variable-proof.json. No source writes, token request, aliases or screenshot
checks were needed for these read-only facts.

Next priority: use canonical extract/figma/dump.plugin.js via the connected
Desktop Bridge on Carbon Tile to capture missing variable-consumer proof, then
replay locally. This route can resolve the observed prerequisite without an
owner token change; do not splice invented variable facts into REST evidence.
Figma inspection skill loaded; Console execute schema supports explicitfileKey,
timeout<=30000. Source is Community/read-only. Do not run another REST image
checker while full204's single consumer lane is active.

Full204 partial at14/204complete:9PASS/14FAIL/356UNVERIFIED,11refused sets,
2failed sets,1passing set. Incomplete/order-biased; not the new broad final score.
Handle34144stilllive,log/private/tmp/sds1044/full204.log. Last completed broad
remains2522/6312oldpin; reverse unqualified. Source567899117 is NOT in the frozen
measurement pin. Cleanengine/lowering/door qualification for this source change
remains pending because qualification checkout is occupied by the full run;
existing receipts do not qualify567899117. All1045localjobs terminal. Evidence
archived as hidden-paint-order-1045. No push/release/tester contact/owner wait.
Parked changes intact; goal remains active.

## Experiment 1046 — canonical native capture and assembled stroke ink

Previous check-in was a verified wait: full204 PID15238 confirmed live. Goal
remains the full bidirectional 80% finish line; a supervised preview suggestion
is not a replacement acceptance criterion. Current full204 reached27/204;
measurement checkout fb048325f and candidate fonts remain frozen.

Read-only canonical desktop dump of Carbon Tile20125:279432 captured65 Tile
variants and26 dependency sets with native variable-consumer evidence. File
A451UfD58U7XU21FzaqfHL, dumpSHA256
 de68cb393958f60e6f053970ad2d254d05074b87db4514b0eea06e2c5ce81be9.
Original reader configured TARGET_SETS=['Tile'], INCLUDE_DEPENDENCIES=true;
6,333,143 UTF8 bytes transported via ephemeral plugin cache/chunks, no design
writes. Consumer-missing refusal clears. Initial batch diagnosis isolates Button
inside-stroke-color-carriage-unqualified; Tile's instance-root-unqualified was
a downstream dependency symptom.

3d518011e fixes the false stroke refusal: separate glyph overrides and root
sizing queues point at the same component. Color already exists on glyph ink,
but the later empty rootOverrides target was incorrectly required to contain
color too. Attach queued overrides first, then validate the actual assembled
component's color. Missing color still refuses; no paint guard relaxed.
Regression with native inside stroke plus root dimension observation failed
before the fix. All12 focused drawing/inside-stroke tests pass after; TypeScript,
lint and diff check pass. Fixed40 prepared requests/refusals are byte-identical
to paint1045. These are preparation checks, not new image acceptance.

Native batch now proposes all27 sets with no skipped sets. End-to-end packaging
still refuses ds.tile aiLayerShadow instance-root-fill-host-unproven. Observed
part carries rootFill width plus layout.grow true; validator rejects that
combination. This is the next concrete source/layout investigation, not authority
to delete the guard. No package/image pass claimed. No concurrent REST image
checker started. Source1045/1046 cleanengine/lowering/door qualification remains
pending; existing receipts predate both fixes and qualification checkout is
occupied by full204. Last completed broad score remains2522/6312 oldpin;
reverse unqualified. No owner wait, push, publication or tester contact.

Evidence archived under private/beta-kits/slider-geometry-diagnosis-2026-10-01/
paired-regression-integration/native-stroke-1046: canonical reader, dump/hash,
batch diagnostics, replay refusals, regression before/after, checks and fixed40
comparison. Ephemeral Figma JSON cache __dscTile1046 may still exist (no design
mutation). Parked changes preserved. Goal remains active.

## Experiment 1047 — independent cross-axis fill and primary growth

Previous turn was progress (3d518011e). Revalidated writer c69fec90c and live
full204 PID15238; benchmark pin/inputs unchanged,31/204 complete at observation.
Native Tile package refusal contains two independent blockers: aiLayerShadow
uses rootFill width and layout.grow true; parent aiShadowWrapper has no explicit
width because its absolute left/right insets supply that allocation.

02241a8c1 removes only the incompatible-growth assumption from rootFill
validation. Cross-axis width fill and primary-axis height growth act on different
dimensions of the same generated root. The independent component-grow validator
still checks root ownership, runtime/custom API conflicts and placement. Existing
rootFill checks still reject competing dimensions, unsupported roots and
unproven parent dimensions. Regression failed before and passes after: both
React surfaces resize the real child to200x120,400x180,160x80 without modifying
the child contract. Native compiled plans carry both fillW and grow. This is
browser/native-plan evidence, not a fresh live Figma qualification.

All89 instance-forwarding tests pass, including existing root-fill negative
cases; TypeScript, lint and diff check pass. Fixed40 preparation request hashes
and refusals unchanged versus1046. Native Tile replay still refuses the parent
width-proof condition (same instance-root-fill-host-unproven name): wrapper is
absolute with left/right/top/bottom token insets; owner root has a width token
and position relative. Next qualify definite allocation through opposing insets
with responsive and negative tests before changing that guard. No generated
package or image pass claimed; no parallel REST image checker started.

Evidence archived as cross-fill-grow-1047 under the paired-regression-integration
private evidence directory: before/after tests, full89, checks, fixed40, replay
and remaining-condition.json. Cleanengine/lowering/door receipts remain pending
for1045-1047 while full204 occupies the qualification checkout. Existing receipt
is not current-source qualification. Parked edits untouched; no owner wait,
push, release or tester contact. Broad remains2522/6312oldpin; reverse remains
unqualified; full bidirectional goal active.

## Experiment 1048 — definite allocation through opposing absolute insets

Previous turn was progress (02241a8c1). Writer af876a315 revalidated, parked
changes untouched, full204 PID15238 confirmed live (31/204 completed). Do not
restart the running benchmark or alter its pinned checkout/fonts.

0a946e5b8 qualifies cross-axis root fill through a direct absolute wrapper
whose opposing insets and positioned, definite containing block establish the
allocation. It requires invariant geometry, no competing dimension/margins or
transforms on the wrapper, and no conditional geometry on either node. Existing
root and component-grow checks remain. The regression fails before; both React
surfaces resize the actual child to175x110,375x170,135x70 as the owner changes.
Missing/auto insets, HUG owner width, missing positioned owner and conditional
wrapper positioning still refuse. All90 instance-forwarding tests pass;
TypeScript/lint/diff check pass. Fixed40 preparation results unchanged.

Native compile was also exercised, and still explicitly refuses this absolute
wrapper's zero-basis growth with FIGMA_ZERO_BASIS_GROWTH_UNSUPPORTED. The test
records this limitation; React qualification is NOT native acceptance. Initial
full test exposed it; final full90 tests include that named refusal expectation.
An accidental test insertion during editing was corrected before final checks;
earlier failed logs are preserved alongside final verified logs.

Actual native Tile replay now clears its own contract validation and reaches
library generation. Next refusal is ds.button part skeletonStateAnimation
instance-root-fill-host-unproven; ds.tile depends on that refused child. Its
width is provided by a420-row style/type/size/state table, and the child only
renders in state=skeleton. All skeleton widths are positive px; non-skeleton
rows may HUG. Next evaluate parent definiteness across the child's reachable
visible domain rather than accept the table without proof. Native zero-basis
allocation remains a separate reverse-direction defect to address.

No package or image pass claimed, no additional REST image checker. Evidence
archived as inset-allocation-1048 under paired-regression-integration: tests,
replay, fixed40 comparison and next-skeleton-condition.json. Broad remains
2522/6312oldpin; reverse unqualified. Cleanengine/lowering/door qualification
for1045-1048 remains pending while full204 occupies its checkout. No owner wait,
push/publication/tester contact. Full bidirectional goal remains active.

## Experiment 1049 — visible size domain clears native Tile packaging

Previous turn was progress (0a946e5b8). Revalidated35f329275 and live full204
PID15238; pinned measurement checkout/fonts unchanged. At final observation,
35/204 sets complete. No extra REST image checker or source-Figma writes.

ba904f0a0 qualifies parent literal size tables only across every reachable tuple
where the child can appear, using reachablePresenceTupleKeys. Requires exactly
one size table, unique rows, finite positive px in every visible tuple and no
competing conditional/style/token size channel. Invisible HUG rows do not imply
visible definiteness. Missing rows, visible HUG, removing the visibility gate or
conflicting state dimensions still refuse. Regression failed before; both React
surfaces render widths180,260,180 and remove the child in ready state. All91
instance-forwarding tests, TypeScript/lint/diff check pass. Fixed40 preparation
requests/refusals identical to1048. No image score inferred from these checks.

Canonical native Tile replay now completes actual React library generation:
27 proposed sets,0skipped, esbuild and strict TypeScript declaration build pass.
Tarball ds-contracts-generated-tile-0.0.0-generated.tgz SHA256
933faef6cffecd6d559c5ebee6d7636a3a8e952fb1de749ca34050412938e791;
requestSHA2567b4ff12609f667c334ff031c2dcece0273fed769339a4a7f9c56d5ab2ff07158.
Output/private/tmp/native1046/package; successful work/library-VfE94i.
Full package, request, conversion, receipt and compact package-summary archived
with logs as visible-fill-1049 in paired-regression-integration. Canonical dump
remains the1046native capture; do not merge its evidence into frozen REST run.

Next: qualify recent committed source on an independent clean build location
without touching full204's checkout, and prepare Tile visual review/check for
when the single REST image lane is free. Native absolute-wrapper zero-basis
growth from1048 still refuses and needs actual reverse proof. Public CLI native
capture routing is not implied by this desktop-assisted capture replay. No
image acceptance claimed: broad remains2522/6312oldpin; reverse unqualified.
Existing cleanengine/lowering/door receipts predate1045-1049. Parked edits remain
untouched; no owner wait, push/release/tester contact. Full goal stays active.

## Experiment 1050 — clean source qualification and identical Tile package

Previous turn was progress (ba904f0a0). Revalidated b9870c995 writer and live
full204 PID15238,36/204complete. Existing960qualification checkout has dirty
historical work; preserved it. Created detached qualification checkout
/private/tmp/ds-contracts-beta-gates-1050 at b9870c995. Copied dependencies with
copy-on-write, then corrected its four workspace links to this checkout's own
packages (never build against writer packages). Schema/core,CLI,WebComponents
builds pass; clean118focused tests pass; TypeScript/lint pass. No parked edits
were copied. Benchmark971 remains frozen/occupied.

Lowering rederives0citations; clean plugin build records engine3005613b1594,
2,151,043minified bytes; zip2,512,925bytes, dump1.76. Second build verifies the
receipt. Door check passes; JSON comparison excluding line/ruleLine proves
only source locations changed. Maintained design-to-code census remains23sets,
3131carried/3943named/0SILENT. Copied only three verified receipt/register files
to writer and committed cbcea3b9c; clean preserved them in70f98d455. The complete
tracked trees of these two commits are identical.

Clean native Tile replay succeeds with27proposed/0skipped. Request and tarball
SHA256 both exactly match1049 (7b4ff12609f6...,933faef6ffce...). Actual tarball
SHA is933faef6cffecd6d559c5ebee6d7636a3a8e952fb1de749ca34050412938e791;
comparison.json contains full values. This confirms parked changes did not
supply the successful package. No image acceptance or reverse pass inferred.

Started full fast CI on clean70f98d455, session38641, log
/private/tmp/qualification1050/fast.log. Confirmed still running; do not restart
or mutate this checkout while live. Full204 session34144/PID15238 remains the
other active lane. At most two lanes; no additional REST consumer checker.
Cleanqualification logs, zip, receipts and package comparison archived as
clean-qualification-1050 under paired-regression-integration. Live fast log is
not yet a completed receipt; pending-fast.json records handle/pin/log. Previous
full-fast result predates these source changes and cannot qualify them.

Next poll38641 to terminal and retain its full result; keep full204 frozen.
Tile image check waits for the single REST image lane. Native absolute-wrapper
zero-basis growth remains unqualified. Broad2522/6312oldpin, reverse unqualified;
no owner wait, push/release/tester contact. Parked edits intact, full goal active.

## Experiment 1051 — verified waits and native allocation diagnosis

Previous turn was progress (clean qualification). Re-polled fast session38641:
still live, PID71767 verified; full204 PID15238 live,40/204complete. Preserve
both pinned checkouts; neither observation timeout nor quiet log is terminal.
No source changes, restarts, extra consumer check or receipt claims this turn.

Read-only native sizing diagnosis identifies a representational mismatch:
insetOverlayOffsets selects an overlay for all four numeric inset channels;
ordinary frame lowering chooses this ahead of absolutePartPlacement and forces
content primary/counter CENTER. annotateFillW propagates definite parent size
through absolute STRETCH but not insetOverlay. applyInsetOverlay runtime already
sizes from parent minus offsets with STRETCH constraints. Candidate next step:
preserve explicit absolute authored flex layout through absolute placement when
no explicit dimensions conflict, then test native compiled fill, actual native
write/readback, alignment/resizing and legacy overlay cases. Do not simply waive
the zero-basis refusal. Parked native bound-paint edits are unrelated and remain
untouched. Diagnosis saved as native-layout-1051/diagnosis.json under existing
private paired-regression-integration evidence.

Next poll38641/34144 rather than restart. Fast still pending; broad prior score
2522/6312 and reverse unqualified unchanged. No owner wait or release actions.
Goal remains active; this is a verified wait plus a concrete next-experiment
finding, not new image acceptance.

## Experiment 1052 — preserve authored absolute flex containers natively

Previous turn was a verified wait with actionable native diagnosis. Revalidated
writer3644b2bd3 and both jobs: full204 PID15238 live,43/204complete; fast38641 on
clean70f98d455 remains live. Neither pinned checkout was changed/restarted.
Writer implementation continues the second work lane while its preceding
source revision is under CI; that run cannot qualify this later source change.

135609b5c routes an explicitly absolute authored flex container with four
numeric insets, children, and no competing width/height through ordinary
absolute placement. This preserves authored alignment and exposes inherited
STRETCH allocation to native FILL qualification. Implicit glyph overlays and
explicitly sized overlays retain their prior route. No zero-basis guard waived.
Regression failed before; after, compiled wrapper retains MIN alignment and
STRETCH offsets10/15/5/5; child has fillW/fillH. Native mock writer creates the
175x110wrapper with both child layoutSizing axes FILL. Both React surfaces still
resize correctly; legacy implicit/explicit-size overlay cases tested. All145
focused instance/growth/absolute/runtime tests pass, TypeScript/lint/diff checks
pass. Fixed40 preparation hashes/refusals identical to1049.

Only the new native layout hunk was staged, plus its regression. Compared
unstaged native +/-lines against saved pre-edit patch: parked bound-paint hunks
unchanged and not committed. Other parked files untouched. Evidence archived
as native-absolute-1052 in paired-regression-integration (before/after, full145,
checks,40comparison, staged native-only patch and parked before/after patches).

This is compiler/browser/mock evidence, NOT live native acceptance. Next run
this exact emitted layout in an allowed Figma file and verify actual node
bounds, instance FILL, alignment and responsive changes. Cleanengine/lowering/
door receipt for135609b5c remains pending;1050qualified only preceding source.
Poll fast38641/full20434144 to terminal; do not restart on observation timeout.
Tile image check still waits for the single image lane. Broad remains oldpin
2522/6312; reverse unqualified; no new image score/owner wait/push/release/tester
contact. Full bidirectional goal stays active.

## Experiment 1053 — live failure exposes missing instance token closure

Previous goal turn was a status restatement, not implementation progress.
Revalidated writer1135a799a and live PIDs15238/71767; neither pinned job was
restarted or changed. Full204 is44/204 complete; latest Chakra Progress270/0/0
is partial evidence, not a replacement broad score. Fast1050 still pending.

Canonical retained-library preparation for operation70000000-0000-4000-8000-
000000001053 produced tokenPaths[] despite native instance rootOverrides
requiring usage.height and usage.padding-left. Live writer returned
partial-or-unknown-allocation with Missing variable: usage/height. Screenshot
and readback inspected the partial page; no layout success claimed. Owned
partial page160:67158 and empty collectionVariableCollectionId:160:67157 remain
in LiveTestingNqssRZQpSjChxv5VyN1ZvJ pending exact-identity cleanup before retry.
Failure artifacts archived as native-token-closure-1053 under the existing
private paired-regression-integration evidence directory.

Added the retained-package regression first: it failed because tokenPaths was
empty. Native projection dependency collection now includes instance root
numeric override variables and outside stroke color/width variables, matching
the writer's existing need() calls. Both original dimensions/padding and
outside-stroke cases run retained package -> plan -> scoped token creation ->
token readback -> native writer in the mock host, without preallocating the
whole token tree. All26 native prepared-library/server tests pass; TypeScript,
lint and diff whitespace checks pass. Parked emitter/rest/package edits remain
untouched. This is a token planning fix, not live acceptance or a new image pass.

Next: exact-owned partial cleanup, fresh-operation canonical live retry, actual
instance bounds/FILL/resizing readback and screenshot. New source still needs
clean engine/door qualification after that. Poll the same frozen CI/full204 jobs.
Broad remains2522/6312 at old pin; reverse unqualified; no owner wait, publication
or tester contact. Full bidirectional goal remains active.

## Experiment 1054 — live token and responsive layout verification

Previous turn made progress:3ffbdac4b fixed missing instance token dependencies.
Revalidated that commit and both running PIDs before action. Failed1053 page
160:67158 and empty token collection160:67157 still matched exact ownership.
Initial page removal refused because it was current; readback proved unchanged,
then switched to existing page157:67106 and removed only those owned artifacts.

Fresh canonical retained-library operation70000000-0000-4000-8000-000000001054
used the identical package artifact8d8ca9bb14d5e9a5d28276f4481e4762a35ac12f5ddec3e245edf05ad8d2c9c3.
New plan tokenPaths are usage.height and usage.padding-left. Token creation and
readback succeeded; native write returned created-candidate, problems[], on
page161:67168 with host161:67171, wrapper161:67172 and usage161:67173.
Canonical prepared readback verifies supported-structure-observed, with all
usual unqualified visual/computed limitations retained. Screenshot and actual
node readback show wrapper175x110 at10,5 and usage175x110, both axesFILL.

Created three host instances in review section161:67175, away from generated
components; no child layout repairs. Instances161:67176/161:67180/161:67184 at
200x120/400x180/160x80 retain wrapper175x110/375x170/135x70, offsets10,5,
and child matches both dimensions with both axesFILL. Screenshot inspected:
three correctly inset blue areas and top-left marks, no overlap. This closes
the named live absolute-wrapper/token regression; not a broad reverse score.
Evidence archived native-live-1054, including actual creation, canonical
observation, verification and responsive readback. No image score invented.

Fast1050 completed:190/201 gates passed,11 conditionally skipped, final log
archived clean-qualification-1050/fast-final.log. It qualifies pin70f98d455,
not the later135609b5c/3ffbdac4b source. Full204 PID15238 remains live and46/204
complete; frozen source/font/input untouched. Next clean qualification of
latest source and eventual full scoreboard result, then queued Tile image check
when the single REST lane is free. Broad2522/6312oldpin, reverse unqualified;
no owner wait/release/tester contact, parked edits preserved, full goal active.

## Experiment 1055 — clean combined qualification and CI dispatch

Previous turn made progress: live native creation and three responsive sizes
passed with canonical readback. Revalidated writer8e350f320 and full204PID15238.
Fast1050 was terminal exit0 before reusing its clean checkout. Cherry-picked
135609b5c and3ffbdac4b there; resolved only the historical ledger conflict using
writer's committed ledger. Entire tracked tree matched8e350f320 before builds.
Parked writer edits remain excluded.

Built schema/core/CLI/Web Components, passed125 targeted native/layout/server
tests, TypeScript/lint, door register and design-to-code census. Plugin engine
receipt now86546059551bffa2dca5bd836d93fe46694bae6cc3ae1144e925f5f5ffd8639d,
2151593minified bytes; zip2513475bytes. Second plugin build verified receipt.
Lowering refresh initially refused duplicate text `if (isNewSection) {` after
source moved11lines. Inspected both sites and verified old/new exact text for
each shifted citation against70f98d455 before updating offsets, then reran
normal refresh and lowering gate. Compared registers with line/ruleLine stripped:
identical semantics. Door rederive produced no diff. No guard weakened.

Writer6b18c6663 records only engine receipt and lowering citation refresh;
clean33aa30367 has identical complete tracked tree, verified git diff exit0.
Started required fast lane on that clean pin, session20469, log
/private/tmp/qualification1055/fast.log. Do not mutate clean checkout while live.
Evidence logs archived clean-qualification-1055 under existing paired evidence.
Full204 remains frozen on its original pin, latest47/204complete; no second REST
image lane launched. Next poll both exact jobs, retain terminal CI evidence,
then resume queued native Tile consumer check when REST lane is free. Broad
2522/6312oldpin, reverse unqualified. No owner wait or release action; goal active.

## Experiment 1056 — prioritize observed nested content loss

Previous turn made progress: clean combined qualification and pinned CI dispatch.
Re-polled session20469 live and full204PID15238 live; no checkout/input mutation
or restarts. Full204 now49/204; Input315 individual passes still has set failure
text-prop-discarded. Do not erase the set failure or call partial counts broad.

Read-only triage of48 completed sets found659 content-missing reason occurrences
(overlapping reasons, not variants):301ActionMenu,268ADS Date time picker dominate.
Switch's export disagreement and palette finding already covered946/947/1012;
do not rerun or change geometry from that failure string. Columns has actual
source160px parent with195px/187px overflowing children and fractional offsets;
its195vs160content mismatch alone does not justify forcing child widths.
ActionBar loses two zero-width stroked separator vectors; saved dump has no
network/perimeter evidence required by the parked degenerate-stroke experiment.
Chakra is not among six currently connected native files. Parked work untouched.

Replayed saved Primer ActionMenu dump offline through current writer into
/private/tmp/triage1056/actionmenu (session36910 terminal0). Result21proposed,
3named dependency refusals. Request byte hashd3dd1c2bab22dba52f6adf106833a0b12b2eda5b8d695c4afeb803c74814aa2e
matches frozen benchmark exactly: recent fixes do not address this loss.
Concrete source path: ActionMenu/Content variants children textOverrides includes
`label, description and trailingVisual/label and description/label` = Table and
`label, description and trailingVisual/trailingVisual/text/Trailing text` = ⌘ 1.
Generated caller-owned selectedContent references ds.description-none without
sourceTextLabel (thus defaults Action list item); selected trailing text references
ds.trailing-visual-text with literal ⌘ + E. Overrides are captured but lost across
nested slot-content projection. This is the next shared conversion investigation,
with the existing whole30-case dump as regression evidence, not guessed text.

Triage/source-label paths and replay receipts archived content-triage-1056 under
paired evidence; package remains in private/tmp path above. Next trace nested
textOverrides through caller-owned slot content, add representative regression,
and fix only with unambiguous selected-component correspondence. CI/full204
continue on unchanged pins. No new image pass; broad2522/6312oldpin, reverse
unqualified, no owner wait, no release/tester contact, goal active.

## Experiment 1057 — nested labels into existing caller content

Previous turn produced actionable source/contract loss evidence. Revalidated
writerbb4ad9dd8 and full204PID15238; CI20469 still runs on unchanged33aa30367.
The fixed-swap regression failed first: carryNestedCharacterCaller skipped a
slot whenever carryFixedSwapCaller had already supplied it. 014e8247d forwards
only into a single unconditionally owned component whose id matches the proven
text target. Existing multi-part/conditional content, conflicting ids, stale
keys/paths, unusable defaults and property collisions stay excluded. Existing
component settings and standalone slot defaults remain unchanged.

Regression exercises both CSS and inline React with Table -> Board -> Table,
plus standalone Default, with/without fixed swaps; stale identity controls also
run both cases. All26 text-control tests pass. The combined run's91 instance
forwarding tests passed; its2 text-test harness failures (missing local token
merge helper) were repaired and the complete26 rerun is green. TypeScript/lint
and diff whitespace pass. Parked emitter/rest/package edits untouched.

Whole saved ActionMenu replay still proposes21 with3named dependency refusals,
but now changes ds.action-menu-content:13 caller-label inputs include Copy link,
Quote reply, Table/Board, Email/Text message, Sort by/Group by, and other labels.
Real generated browser mounts at four root trigger configurations on BOTH React
surfaces show the exact expected Table or Email once (8checks), without changing
source captures or comparison thresholds. Shortcut text remains unresolved:
its selected leaf has no promoted character control yet. No30-case image pass
or scoreboard gain claimed. Replay/evidence archived nested-text-1057; package
in /private/tmp/nested1057/actionmenu. New source needs later clean qualification;
the running CI predates it and must not be repinned.

Next trace selected trailing-text source identity/demand, then run the saved
whole-case content comparison before new REST image work. Full204 latest58/204,
all pins untouched; broad2522/6312oldpin, reverse unqualified. No owner wait,
publication or tester contact; full bidirectional goal remains active.

## Experiment 1058 — observed selected text overrides a different slot default

Previous turn made progress: caller label forwarding. Revalidated5332e3aa7 and
full204PID15238; CI20469 remains live on33aa30367. Source shortcut target is
15096:46633(trailingVisual/text), while its owning main's slot defaults to
15096:46632(trailingVisual/icon). Existing route validation only admitted the
main's default. Captured fixedSwaps and observedInstances supply the actual
selected key, component id, instance id and numeric path; these all match.

Nested character routing now admits this selected target only with that complete
identity correspondence. Existing caller content may use its proven selected
component instead of the slot's default; unowned fallback still requires the
default match. Regression failed first, then passes Table/Board transitions in
both React surfaces for a different selected main. Wrapper contract compared
against the same fixture with no text overrides is unchanged. This synthetic
alternate-default fixture has an unresolved standalone default; do not claim its
empty wrapper is a new rendering pass. Existing same-default fixtures still
verify Default in the browser. Seven negative swap identity/path/ambiguity
controls refuse; all28 text tests, TypeScript/lint and whitespace checks pass.

Whole ActionMenu offline replay still21proposed/3named dependency refusals.
Seven shortcut caller inputs now carry source values; action items render
⌘ C/⌘ Q/⌘ E/⌘ D exactly once with shortcuts=true, disappear when false and return
when true, on CSS and inline React (24 browser assertions). Four conditional
shortcut branches still lack input forwarding; no whole-set/image acceptance
claimed. Evidence archived selected-text-1058; package retained at
/private/tmp/shortcut1058/actionmenu. Next extend source-qualified routing across
existing mutually exclusive caller branches, then verify all saved cases.

Full204 latest66/204; CI unchanged and pending, newer text commits not covered.
Parked edits preserved. Broad2522/6312oldpin, reverse unqualified; no owner wait,
release or tester contact; full goal stays active.

## Experiment 1059 — conditional text branches and whole-case text comparison

Previous turn progressed selected shortcut identity routing. Revalidatedf48eb9a13
and live benchmarkPID15238. 250db5c6e scopes caller text forwarding to existing
conditional component parts only when each observed tuple matches exactly one
presence row. The original gate stays on the original part; recursive forwarding
operates on its proven present occurrences and still requires source identity.
Conditional fixture failed first; different selected targets now switch Table ->
Default -> Table in both React surfaces without changing wrapper defaults.
The synthetic alternate leaf was moved before its caller in fixture input order:
otherwise its preexisting unresolved-selection refusal prevents any caller parts
and does not exercise this branch. No production dependency-order guard relaxed.
All29 text tests and91 instance-forwarding tests pass, TypeScript/lint/whitespace
pass. Parked edits unchanged; running benchmark source remains frozen.

Saved full ActionMenu replay now forwards all11 selected shortcut inputs,
including all4 previously missing conditional ones. Used deriveCases and the
existing domContentOf/missingTexts functions against saved figma-content.json
on all30 variants, both React emitters (60mounts). Compared with the pre1057
request through the same harness: missing text occurrences119 ->14 per surface,
no new missing-text findings. Cases with any text missing remain14 ->14:
Roadmap remains absent in11, Post in3 per surface. Thus major content recovery,
NOT a new passing-variant or image score. Full font/style/icon/layout and image
checks are not implied by this text-only replay. Evidence/comparison archived
conditional-text-1059; package /private/tmp/conditional1059/actionmenu.

CI20469 completed exit0 on33aa30367:190gates passed,11conditionally skipped.
Archived clean-qualification-1055/fast-final.log and final JSON. This predates
all1057-1059 text changes. Full204 latest74/204, no restarts or second REST lane.
Next trace the remaining Roadmap/Post inputs, then qualify text changes together
in the now-free clean checkout. Broad2522/6312oldpin, reverse unqualified; no
owner wait, release or tester contact; full bidirectional goal stays active.

## Experiment 1060 — joint-axis text closes saved ActionMenu text misses

Previous turn progressed conditional shortcuts. Revalidatedbac318580 and live
full204PID15238. Source routes for Roadmap/Post are valid; the refusal is
no complete text mapping. The source third item is Roadmap for icons=false,
items=multi-selection, but Post for icons=true and that same items value.
A one-axis lookup cannot express it. No default text was substituted.

Added complete mutually exclusive caller-content branches for this joint text
mapping using the existing presence representation. Every branch still passes
identity-qualified text forwarding; duplicate observations, missing values or
incomplete presence inference decline. Existing parent conditional branches
propagate split parts and preserve routing for their unchanged siblings.
Tests cover joint values and joint values inside conditional swaps in both
React emitters; a new nested test caught an unrouted unchanged sibling, fixed
by preserving all prior route keys during replacement. Its initial stale
observed-instance fixture IDs were corrected to the actual cloned identities.
All31 text tests pass;91 instance tests passed in the combined121-case run
before the last added regression; TypeScript/lint/whitespace pass after final fix.
Parked files remain untouched.

Saved full ActionMenu30-case replay via existing deriveCases, domContentOf and
missingTexts now has0missing texts across BOTH React surfaces (60mounts).
Same-harness pre1057 request:119 missing text occurrences per surface; now0.
This completes this saved source TEXT check, not icons, text styles/fonts,
geometry, image comparison, first-pass qualification, or broad acceptance.
Package /private/tmp/labels1060/actionmenu and evidence archived joint-text-1060.
The final generic nested-route correction is covered by the new regression;
real ActionMenu text recovery uses the already-verified unconditional caller
split path. No source file or checker threshold changed.

Next qualify the text-fix series together in the now-free clean checkout,
then run full consumer checks when the single REST lane frees. Full204 latest
79/204 and pin unchanged; previous CI33aa30367 already passed but predates this
series. Broad2522/6312oldpin, reverse unqualified; no owner wait/publication/tester
contact; full bidirectional goal remains active.

## Experiment 1061 — clean text qualification and dependency repair

Clean checkout beta-gates-1050 at33c376dee matched writer d6e539002
tracked tree exactly before generated receipt refresh. All122 focused tests,
TypeScript, lint and design-to-code census passed. Fixed40 preparation rows
match absolute1052 exactly; this is not an image-score update. Engine rebuilt
and independently verified e6747cc29c7892af47d87b6f1fa25f021d50d0a5503f97d9e979c9063e79d621;
door-register changes are citations only. Three generated receipt changes
remain in clean checkout, not transferred or committed yet.

Clean ActionMenu replay completed, but request differs from1060 in conditional
caller branches after the final nested-routing correction. Therefore previous
60-mount text proof does not qualify this exact package yet. Browser replay
is pending: shared temporary node_modules target lost tsx files after earlier
checks. Preserved existing dependency links under qualification1061 and started
an independent npm ci (session43277); do not repeat failed loader attempts.
No new CI launched. Qualification logs and replay summary archived under
clean-qualification-1061. Broad run remains on its frozen pin, latest85/204;
no updated full score. Next finish install, run clean browser text comparison,
then qualify receipts and launch clean CI only after resolving any differences.
Parked writer edits preserved. No owner wait, publication or tester contact.

## Experiment 1062 — isolate conditional forwarding to its actual slot

Previous turn was progress: exposed package drift and repaired clean dependencies.
Independent npm ci completed. Clean browser replay had zero missing text, but
comparison of full DOM text exposed28 changed cases with duplicated labels:
recursive forwarding considered all host routes while projecting its output
into one conditional slot. Missing-text success alone missed this regression.

Restricted recursive source routes to the slot's actual Figma property and
propagated diagnostic updates back to the parent context. Added a two-slot
conditional fixture checking exactly one Secondary label and correct primary
text in both renderers. All123 focused tests, TypeScript and lint pass.
Saved ActionMenu60mount replay now exactly matches pre-correction1060 DOM text
and retains zero missing texts. This removes newly introduced duplicates; it
does not establish absence of all preexisting duplication or full visual fidelity.

Committed source e6da673c3 and receipts c68194656. Engine independently rebuilt
and verified4535e080573d9b353b33949a91e0c86bc63a500d20a1a04e342694b9c47983ab.
Door differences are citations only. Clean pin8502947ab matched writer tracked
tree exactly (parked edits excluded). Session6889 runs fixed40 text1062 followed
by fast CI; freeze clean checkout until terminal. Qualification artifacts archived
slot-text-1062; ongoing logs remain qualification1061. Full204 latest93/204,
still frozen old pin. Broad2522/6312; reverse unqualified. No owner wait or
release. Next inspect fixed40/CI then continue highest-impact source misses;
the full80% bidirectional finish line remains active.

## Experiment 1063 — Select empty-source refusal and unresolved consumer loss

Previous turn was progress. Fixed40 text1062 completed, exactly equal to1061;
CI session6889 is now running on frozen clean8502947ab. Broad run latest96/204.
Writer temporary shared dependencies also lacked files; preserved prior links
in triage1063 and completed independent npm ci. Parked edits remain untouched.

Saved ADS Date time picker13289:46824 has24 failed variants. Its Select
dependency was refused at Text field because the shape-fill demand guard
requires normal paint on every variant, including captured sourceEmptyFill
variants. 120Text field observations include explicit empty subtle/none planes.
A regression failed before the candidate guard change, which now admits only
explicit empty with no conflicting fill/composition. Unknown and contradictory
empty observations still refuse. Ten shape-fill tests pass, including both
React renderers switching to an empty main and applying/removing qualified
paint. The runtime test initially supplied rounded paint outside its exact
enum and was corrected to the captured float value. TypeScript/lint pass.

Candidate remains UNCOMMITTED in core/propose-figma.ts and
core/source-shape-fill-control.test.ts: full saved replay now proposes Select
but worsens actual text outcome. Same-harness48mount comparison:464 ->480
missing-text findings, losing16 date/time strings across8rest-case mounts.
After rendered text is blank; no pageerror events emitted. Parent contracts
carry valuePlaceholder/date/time and valueHydrate but child output is not
retaining them. Four other dependency refusals remain unchanged. Do not count
Select packaging as a pass or promote candidate until this regression is fixed.
Evidence/scripts archived empty-source-fill-1063; package triage1063/datepicker.
Next inspect generated Select visibility/content and parent slot rendering,
keeping clean CI and benchmark pins unchanged. Broad2522/6312 and reverse
unqualified; no owner wait, publication or scope reduction.

## Experiment 1064 — custom Select host restores rendered content

Previous turn was progress: exposed exact full-consumer regression and left
candidate uncommitted. Generated Select used HTML select with div/span/menu
children because name inference outranked anatomy. Browser did not display
these children; this was not a lost valuePlaceholder prop or runtime exception.
Extended existing void/textarea anatomy guard to inferred select with custom
parts. Explicit option/optgroup/hr parts preserve native select inference;
authored semantics still outrank inference. Container proposal names required
behavior/accessibility review; no invented combobox behavior.

New Select browser regression failed before fix and now passes both surfaces,
including text updates and visible graphic. Together with strict empty-source
fill fix from1063:13focused tests, TypeScript/lint/whitespace pass. Committed
27a67b9ee; parked unrelated edits preserved. Saved Date Time Picker replay now
has232 ->96 missing-text findings PER surface,20 ->4 of24cases with missing
text, no new missing entries. Forty-eight actual renders checked. Remaining
misses are calendar day values: Calendar's six Week days instances carry no
caller text inputs despite distinct drawn days. Next inspect their nested
source identity routes. No image/font/icon/size pass claim from text evidence.

Fixed40 select1064 running session43757, logs triage1063/fixed40-select.log;
inspect completed summary before qualification. Prior clean CI6889 remains
live on8502947ab, excluding this change. Full204 latest97/204 frozen input.
New receipts/clean CI for27a67b9ee still pending until current cleanCI terminal.
Artifacts archived custom-select-1064. Broad2522/6312; reverse unqualified;
no owner wait or release. Full80% bidirectional goal remains active.

## Experiment 1065 — live calendar proves nested property capture gap

Previous turn was progress. Fixed40 select1064 completed:one changed request
(USWDS index36), only contracts3/4 semantics.element select ->div; all40
preparation/refusal outcomes unchanged. Exact diff archived. CI6889 remains
live on old clean8502947ab; no restart or checkout mutation.

Remaining Calendar misses are not raw character overrides in the saved dump:
its six WeekDays instances have seven hostOverrides each naming
componentProperties, but no values or numeric targets. REST map2400-2433
only carries visibility/paint/stroke fields. Thus this cannot be repaired by
inventing labels in the proposer or reusing repeated name paths.

Read-only Figma Console inspection of ADS MfQWBskM44sS8VvL41eqPH,
Calendar13266:43128 verified42 day instances across six weeks. All have
explicit TEXT value properties and actual text bindings. Some selected mains
differ from WeekDays default mains but belong to the same component set;
VARIANT properties also carry disabled/selected/focused/today state. Archived
full ids, numeric child indices, selected/default mains and set keys plus
properties and text refs in calendar-source-1065. Source file unchanged;
no REST request or evidence spliced into frozen benchmark.

Next implement an identity-qualified nested component-property capture and
forwarding channel, carrying state as well as text. Capture must preserve
exact suffixed names, scalar types, owner/target identity and numeric path;
consumer must prove same-set selected variants and preserve wrapper defaults,
reject ambiguous targets or unsupported values. Existing raw-character route
alone requires identical mains and cannot safely substitute for this channel.
No product code edited this turn. Broad2522/6312; reverse unqualified; no
owner wait, publication or narrower completion claim.

## Experiment 1066 — REST parity for nested property witnesses

Previous turn was progress:live42-day evidence established capture loss.
Inspection found native dumpNestedInstanceProperties and existing
DumpHostOverride.instanceProperties already provide the required grammar;
REST had never populated it. Added bounded numeric-path capture with complete
owner/main keys, component-set key, exact property spellings/types/values and
resolved swap selections. Missing/ambiguous identities, unsupported values,
unresolved swaps and duplicate override rows retain a named degradation.

REST adapter integration and native-reader parity tests pass:18focused tests,
TypeScript and lint. Typecheck first caught the missing degradation-code union
member, now added. Staged only new mapper import/capture/code declaration;
parked degenerate-stroke mapper edits remain unstaged byte-for-byte. Native
reader and dump grammar unchanged. Evidence nested-property-capture-1066.

This is capture progress, not recovered calendar rendering yet. Existing
settleNestedSlotSelections only handles one constant swap witness per owner
usage; seven day-property witnesses need a separate qualified forwarding
pass. Next implement that against verified numeric paths and same-set selected
variants, preserving defaults and supporting per-usage values/state. Do not
splice native observations into the frozen benchmark or claim saved dumps now
contain values they never captured. Broad latest101/204; CI6889 live on old
clean8502947ab. Capture/source changes await next combined clean qualification.
Broad2522/6312; reverse unqualified; no owner wait, release or scope reduction.

## Experiment 1067 — forwarding prototype exposes scalar contract boundary

Previous turn was progress:capture parity landed. Added UNCOMMITTED prototype
core/nested-property-inputs.ts and tests, with proposer-emitted source instance
part metadata (numeric source id -> generated unique part key and child id).
This avoids reconstructing repeated Day/Week names. Prototype checks source
file, exact owner and selected-main identities, same-set variant properties,
finite domains, protected APIs, defaults and contract validity; edits are
transactional. It currently accepts only single-main wrappers and unique
caller source occurrences, naming other domains rather than guessing.

TypeScript now passes. Negative fixture passes; positive full label+state
fixture FAILS at existing validator: NONE boolean/enum inputs are not supported
except explicit node controls. Do NOT weaken this guard, disguise state as
text or claim forwarding complete. Candidate remains uncommitted and out of
clean qualification. Need an explicit supported forwarding representation and
native handling, or reuse a proven existing route, before state can carry.
Default/source identity plumbing is prototyped; no real calendar rerender yet.
Snapshots, failure logs and experimental patch archived nested-forwarding-1067.

CI6889 terminal exit1:189passed,11conditional skips,1release-tag failure.
Cause:origin referenced deleted temporary drawn-domain checkout. Verified
authoritative v1 origin https://github.com/southleft/ds-contracts-poc.git and
updated temporary clone's shared origin to it; targeted release-tag retry
passes, no tag/release/push performed. Thus all required190gates have passed
for clean8502947ab across original run plus repaired targeted retry, not a
new whole-run green claim. This qualifies text fixes only, predating Select
and nested capture. Clean checkout now free for next committed qualification.
Full204 continues frozen; broad2522/6312, reverse unqualified; no owner wait.

## Experiment 1068 — nested content slots carry real calendar properties

Previous turn was progress but its scalar prototype failed the contract guard.
Replaced unsupported NONE scalar inputs with existing caller-owned component
slots. Owner's exact source-part provenance disambiguates duplicate names;
slot fallback preserves the original child props and usage overrides. Caller
content supplies the complete observed child text/boolean/variant properties.
Same-set selected mains, property domains, file/key/path identity and generated
contract validity are checked; protected/default-family/ambiguous routes refuse.
No validator/schema guard changed. Current supported wrapper domain is one
captured main and a unique caller occurrence; other domains are named misses.

Real WeekDays additionally inferred a repeated collection, losing individual
identity before routing. Captured nested demands now retain distinct source
parts instead. Preserve their primary-axis grow on the new slot host.
38focused tests passed; final expanded three-day-per-week regression also
passes both React surfaces and native mock labels/property assignments.
The mock does not swap its getMainComponentAsync result when setProperties
changes VARIANT; assertion reads assigned componentProperties accordingly.
TypeScript/lint passed before the final fixture-only expansion. Live native
rendering/layout still unqualified. Source commit784192c41.

DIAGNOSTIC ONLY: enriched a separate copy of saved Date Time Picker dump with
the42live native witnesses from1065 (explicit _diagnostic provenance). Original
dump and frozen benchmark untouched. Full48Reactmount replay now0missing
texts, including all42calendar days; previous96missing findings per surface
become0. Extra tooltip sample strings remain visible in DOM; no full content,
image/style/font/size pass claimed. Saved package slots1068/datepicker and
full diagnostic evidence archived nested-content-1068. Fresh canonical capture
and unchanged full consumer checker remain needed before acceptance credit.

Fixed40 nested1068 runs session71000. Clean checkout now0118bd9a5 contains
Select27a67b9ee,REST3703d3eea,nested784192c41 via cherry-pick; prep:core running
session93321, logs qualification1068/build.log. Next finish build, focused
clean checks and receipts, sync committed ledger, compare trees, then fastCI.
Do not include parked writer changes. Native live qualification follows.
Broad2522/6312; reverse unqualified; no owner wait/release/scope reduction.

## Experiment 1069 — clean combined qualification and canonical Calendar capture

Combined clean checkout e34eacdf4 qualified Select, REST nested properties and
nested slots:55focused tests, TypeScript, lint and design-to-code census pass;
fixed40nested1068 is identical to select1064 in all40 rows. Rebuilt plugin engine
receipt 5ca3bd3c517b300c6a0ac5dc685e7a497b58408cf667c4d4215bab1f6c097464;
receipt refresh e57f6baed changes no lowering/door semantics beyond line numbers.
Clean diagnostic package request/tarball match writer exactly. Tracked trees
matched before fastCI15039, which remains live; checkout is frozen during CI.
Qualification logs archived clean-qualification-1069, ongoing fast.log stays
/private/tmp/qualification1068/fast.log. No whole-CI green claim yet.

Read-only canonical native Calendar capture with dependencies in ADS succeeded:
15sets,42nested property witnesses, no diagnostic additions. Package generated
but ALL six week usages refused property forwarding. Archive canonical-calendar-1069.
The diagnostic1068 success therefore does not establish normal capture success.
User check-in was a status-only turn (no progress); revalidated live CI15039 and
benchmark34144 and resumed the concrete fresh-capture failure rather than reruns.

## Experiment 1070 — preserve selected main identity in both readers

Root cause: canonical native reader emitted componentKey only for remote
variants. Local Day variants lacked their keys, while nested witnesses carried
actual selected main keys. Diagnostic1068 had substituted set keys in witnesses
and passed a fallback comparison; that evidence was insufficient. Preserve
componentKey on every captured COMPONENT in both native reader copies, and
from REST component metadata. Never substitute a set key for a missing variant
main key in nested property settlement. Standalone COMPONENT fallback remains
valid because that set record represents the main itself. Commit f8d2776bc.

Full-reader native/REST regression captures distinct local variant main keys;
negative case retains missing metadata as missing. Nested routing rejects a
set-key substitution when the selected main key is absent.14focused tests,
TypeScript and lint pass. Parked edits preserved; mapper staging excluded them.
Clean checkout/CI remains untouched; this commit awaits combined qualification.

Fresh canonical ADS capture with corrected reader now includes actual Day keys.
All six week usages forward all42nested property occurrences in proposal replay.
Normal full packaging now fails validation on nestedUsage size/color token refs:
instance-root-input-value-unsupported and instance-root-input-color-unsupported.
Forwarded child usage overrides need their originating token scope carried into
the new parent scope. Do not loosen validation or count a render pass. Fresh dump,
source54visible text nodes, probe, failing package log and tests archived
component-main-keys-1070. No source canvas mutations and no REST image calls.

Next fix token ownership/closure for forwarded references, verify a normal fresh
package and both browser surfaces, then native live readback. Full204 latest
133/204; benchmark34144 and CI15039 confirmed live. Last completed broad remains
2522/6312 (39.96%); reverse unqualified. No owner wait, publication or scope change.

## Experiment 1071 — validate with the same linked token scope as generation

Previous turn was progress: local main key capture committed and fresh source
identified the next failure. Revalidated writer state and confirmed CI15039 and
full204 benchmark34144 still live. No clean-checkout mutation or restart.

The token failure was validation scope, not absent captured values: validate.ts
called generateCss with only activeTokens; headless packaging subsequently
applied linkedImportScope, too late for rootOverrides on forwarded child usages.
Use the existing reachable dependency scope for BOTH token inventory and values
before CSS validation, matching emitters. No token injection, validator relaxation,
new aliases or owner-default rewrites. Active tokens retain collision precedence.
Commit7fc38e8ec. New SSR regression is wired into test:playground: reachable tokens
pass; missing/invalid tokens, unrelated imports and invalid active overrides fail.
11related tests, TypeScript, lint and diff check pass. Parked package edit excluded
from staging; parked mapper/native edits preserved. Clean CI is on earlier pin;
1070+1071 still need combined clean qualification when that run terminates.

Normal fresh canonical1070 Calendar capture now packages without enrichment.
Both React emitters render the source's54text strings in exact whitespace-normalized
sequence, including42dayvalues. With generated token CSS, both outer boxes equal
source321x292. Screenshots inspected: placeholder navigation icons and fallback
font remain; NOT an image/style/icon pass. The source itself contains four
Short and brief Tooltip strings; their presence is not newly invented text.
Retained dependency refusals: Shortcut style identity, Chevron left/right affine
basis. No fresh REST image check while full204 lane runs.

Evidence linked-token-validation-1071 includes request/tarball, replay, browser
content/boxes/screenshots and test logs. Fixed40 scope1071 preparation runs under
session39293; log/private/tmp/calendar1071/fixed40.log. Next compare terminal40
rows with nested1068, qualify actual native Calendar in LiveTesting using canonical
plan/readback, and inspect remaining visual failures without treating text/size
checks as full acceptance. Full204 latest133/204; completed broad2522/6312(39.96%),
reverse unqualified. No owner wait, publication, goal narrowing or completion.

## Experiment 1072 — native prepared-library positive domain enforcement

Previous turn was progress: token-scope correction and fresh React evidence.
Fixed40scope1071 terminal exit0: all40rows byte-equivalent to nested1068. CI15039
and full20434144 verified live; clean1050 frozen. No native writes performed.

Prepared actual Calendar request through canonical retained-library route using
clean1050 source. It refused ds.icon-button:drawn-variants-surfaces-unqualified.
compileNativePreparedLibrary called validateContract without its Figma-domain
surface, unlike buildComponentScript. Existing compileComponentData already
emits only drawnVariants, requires a drawn default and rejects invalid options;
writer enforces the resulting exact domain. Align the outer referee call with
that existing enforcement. Commit019230a2b; parked bound-paint code excluded.

Regression goes through prepared native writer and readback: a two-axis domain
with three drawn tuples produces exactly those three variants, no fourth tuple,
and supported-structure-observed. Corrupted tuple still refuses. All23native
prepared-library tests, TypeScript and lint pass. No acceptance threshold changed.

Writer candidate replay now passes domain validation, then refuses
NATIVE_CONTRACT_DRAFT_NODE_OWNERSHIP_UNQUALIFIED. Targeted compiler inspection
identifies90IconButton variant focus-overlay frames carrying insetOverlay:true.
The ownership annotator deliberately rejects these; needs explicit overlay
allocation/ownership/readback support, not dropping the guard. Candidate replay
uses writer with parked code, so is diagnostic only; production live write waits
for committed clean qualification. No prepared plan or variables/nodes created.
Evidence prepared-drawn-domain-1072 includes initial and candidate failures,
ownership inventory, preparation scripts, tests and fixed40comparison.

Next qualify insetOverlay ownership in prepared libraries, preserving normal
component behavior and strict readback. When clean CI terminates, integrate
1070/f8d2776bc,1071/7fc38e8ec,1072/019230a2b and refresh engine receipts before
live qualification. Broad latest133/204, completed2522/6312(39.96%); reverse
unqualified. No owner wait, publication, scope reduction or completion.

## Experiment 1073 — repair terminal clean gates before native overlay work

Previous turn was progress: prepared drawn-domain validation and a named overlay
blocker. CI15039 is now terminal exit1:188pass,2fail,11conditional skips/201.
Failures are ci:lanes (unwired nested-property tests) and designer held-out current
receipts. Full20434144 remains live, latest134/204; no restart. No native writes.

Wired core/nested-property-inputs.test.ts, REST nested-instance-properties and
new component-main-key.test.ts into existing exact-proposal CI command; staged
only that hunk, preserving parked package edit. Commit5d89e93d0. Inspected a new
recording of the clean designer cohort: ONLY notes changed in altitude-textarea,
cbds-checkbox,cbds-toggle and the corresponding results notes. Contracts, render
counts, refusals and all other receipt files unchanged. Restore preexisting note
wording for textarea/void hosts, keeping new Select explanation; commite1ea2d9c1.
No historical/current baseline rewrite, comparator change or tolerance change.

Clean1050 integrated1070/f8d2776bc,1071/7fc38e8ec,1072/019230a2b and both repairs
through8b000f2d7. Targeted ci:lanes and held-out:v2 now pass (7held-out tests).
32focused tests pass, TypeScript and lint pass. Plugin rebuild and independent
receipt verification pass:96fc4f4d5c57ca4cff01d3a12dda2417cc984471d5e4289697bd95c783253abd,
2163796bytes. Door/lowering refresh/check pass, no register changes. Writer
receipt commit5a5767285; clean receipt committed independently. Clean fullCI is
NOT rerun/green yet; prior run + target retries must not be called whole-run green.
Logs and previous whole-CI output archived clean-gate-repair-1073.

Overlay diagnostic confirms90IconButton frames: insetOverlay true, insetOffsets
all-2; first default variant frame is empty, focus variants require own inspection.
Existing applyInsetOverlay allocates absolute placement, constraints and stretch,
while draft annotator refuses ownership and verifier lacks explicit inset rule.
Next add qualified allocation/readback for this actual runtime behavior, covering
negative offsets, fixed/intrinsic dimensions and tamper rejection; keep unsupported
shapes named. Do not bypass the ownership guard or hand-assemble the Calendar.
Broad completed2522/6312(39.96%); reverse unqualified. No owner wait or release.

## Experiment 1074 — native inset frame ownership and independent geometry

Previous turn was progress: clean gates repaired. Revalidated writer parking and
live benchmark34144. Added explicit prepared-library ownership for inset FRAMEs
under horizontal/vertical parents, with finite offsets and unambiguous sizing;
conflicting placement/Fill/percentage geometry and unsafe backdrop reordering
still refuse. Direct contract-draft overlay domain stays closed. Reader captures
constraints only when required, checks offset/size/ABSOLUTE/FIXED sizing and
MIN-versus-STRETCH constraints, and indexes inherited overlay specs so instance
copies receive the same checks relative to their own actual parent.

Tests exposed actual writer gaps: HUG frame collapsed to content after resize;
literal fixed dimensions were ignored by inset allocation. Runtime now fixes
auto-layout overlay axes and honors literal width/height as well as bound fixed
sizes in initial placement and final resize pass. Uses existing max1px floor.
No Figma canvas was mutated. Tests exercise-2offset stretched44x34 and fixed12x14
frames, main and instance copy, with independent x/width/height/positioning/HUG/
constraint/ownership corruption rejected.26native+nesting tests, TypeScript and
lint pass. Commit5a6e738e9, clean cherry-pick39326387b; clean26tests/typecheck pass.
Parked native bound-paint edit excluded from staging; all parked edits preserved.

Real Calendar candidate preparation advances beyond overlay ownership, then
refuses NATIVE_CONTRACT_DRAFT_SHAPE_GEOMETRY_UNQUALIFIED. Compiler inspection
identifies7Day todayIndicator line specs:33px line with zero local height, valid
line affine basis, outside stroke and bound weight. Prepared shape annotation
supports rect/ellipse/path/stroked-path but not native line ownership yet. This
is a separate named gap, not a reason to erase the indicator or invent height.
Candidate diagnostic uses writer; next rerun canonical clean preparation after
line support and refreshed plugin receipts. No live native qualification claim.
Evidence native-inset-overlay-1074 contains tests, prior failure, shape inventory.
Engine receipt now needs refresh after this source change; no full CI rerun yet.
Broad latest140/204, completed2522/6312(39.96%); reverse unqualified. No owner wait,
release, benchmark score credit, narrowed goal or completion.

## Experiment 1075 — zero-height native line ownership and font separation

Previous check-in was a status restatement, no engineering advance. Revalidated
writer cedccd454, clean d1d0245f2, and live broad benchmark session34144.
Native line source cedccd454 qualifies actual zero-height LINE geometry, affine
basis, cap/alignment, paint and weight, with independent main and inherited
instance checks. Auto-layout parent lines receive ABSOLUTE positioning so layout
does not overwrite captured transforms. Nine cap/alignment combinations and
corruption cases pass;31focused tests pass on writer and clean, writer TypeScript
and lint pass. Complete fresh Calendar native preparation now succeeds with
candidate/clean identical JSON, artifact44325094de3b7942b62de255cbc814b08d5f3319bd4bb39b64ebab5687fb4f6e.
No native Calendar write or qualification is claimed.

Clean engine rebuild/verification and lowering/door checks pass. Six lowering
rule locations mapped against the verified baseline; stripped location metadata
comparison confirms no semantic changes. Receipts committed writer39f26a2ca,
clean b6a26f15a. Parked source changes untouched. Fresh full fast CI launched on
clean b6a26f15a; /private/tmp/line1075/ci-fast.log remains live, not claimed green.

Official Atlassian Sans v4 Latin WOFF2 carries SIL OFL1.1. Original font installed
as decompressed SFNT preserving names/outlines; CoreText confirms family present.
Restarted only FigmaAgent (first launch raced process exit; retry succeeded,
PID66870). Figma plugin still cannot list/load Regular/Medium/Semi Bold/Bold.
No family substitution or canvas writes. Original font SHA/provenance and helper
registration logs archived. Independent browser run embeds the original WOFF2:
both React emitters load it, preserve all captured text, and measure321x292.
Screenshot inspected: icon placeholders persist; this is NOT an image pass or
proof all source typography matches. Browser font evidence and screenshots saved.

Broad benchmark last observed157/204, session34144 confirmed running by polling;
last completed2522/6312(39.96%). Reverse remains unqualified. Next resolve Figma
font discovery, execute/read back canonical prepared Calendar and repair named
icon refusals; collect full CI outcome. No owner wait, push, release or goal change.

## Experiment 1076 — native chevron path refusal isolated

Previous turn made progress:1075receipt commits and exact-font React evidence.
Revalidated parked writer state, clean CI48864 and broad34144 both running.
Broad latest162/204; neither job restarted.

Calendar package skips Chevron left/right with native-group-plane-unqualified.
Traced to canonical dumpShape VECTOR identity-only matrix guard, followed by
projectNativeGroupPlanes identity-only geometry proof. Fresh read-only source
inspection on ADS MfQWBskM44sS8VvL41eqPH, components120546:8446 and120546:12590,
captured original vector paths, exact2x3transforms, dimensions, paints and4xPNG.
Both glyphs use13.060546875x7.28039026260376local dimensions; left matrix includes
rotation plus reflection, right rotation. Native source paths exist but the
canonical dump omits shape and reports rotation/vector-geometry-unsupported.
Do not merely relax the group validator: first carry the original path and
matrix, establish the containing-frame coordinate proof, then qualify both
React emitters and editable native output against original pixels. Archive
native-chevron-affine-1076 includes native.json, facts.json and hashedPNG;
left screenshot inspected. No source-file writes or conversion-pass claim.

UI inspection selected DS Contracts Live Testing and displayed the explicit
warning: unsaved changes are saved locally and will sync when Figma reconnects.
Did NOT reload/quit Figma, avoiding disruption to unsynced state. UI currently
shows Stroke capture887 while MCP reports prepared-library1054; verify connection
identity/synchronization before any restart or next canvas write. Font helper
restart alone was insufficient last turn. Native Calendar remains uncreated.
CI48864 is still running, log /private/tmp/line1075/ci-fast.log. Last completed
broad2522/6312(39.96%); reverse unqualified. No owner wait, release or goal change.

## Experiment 1077 — affine path geometry qualified against native pixels

Previous1076was progress: isolated capture gap and obtained original references.
Added projectAffineFilledPath, a pure bounded projection of original absolute
M/L/C/Q/Z control points through an observed nonsingular2x3matrix. Curves remain
curves; winding preserved; source arguments unchanged; normalized viewport is
computed from transformed local viewport corners, never raster ink. Malformed,
singular, unsupported grammar and invalid projected geometry refuse explicitly.

Native chevron fixtures committed with original matrices, path bytes, paints,
IDs, hashes and unmodified4xexports. Browser geometry projection has0percent
pixel difference for BOTHchevrons on BOTHwhite/black using unchanged pixelmatch
threshold0.1and5percentbar, fixed shared origin, no ink alignment. Three tests
pass; TypeScript and targeted lint pass. Test wired into exact-proposal:check;
only new package hunk staged, older parked change preserved. Sourcece371f892.

This is a qualified geometry primitive, NOT production importer integration,
full React emitter qualification, native reconstruction, or scoreboard credit.
Next carry original affine path facts in both canonical native readers, consume
with complete containing-frame identity proof in GROUP projection, retain raw
facts, then qualify both emitters and native output. REST must have equivalent
observed local matrix/size facts rather than infer them from absolute bounds.
Clean CI48864 still runs onb6a26f15a; no edits/cherry-picks into its checkout.
Broad34144confirmed live, latest169/204. Last completed2522/6312(39.96%);
reverse unqualified. No owner wait, canvas mutation, push, release or goal change.

## Experiment 1078 — native affine capture and React proposal integration

Previous turn was progress: pixel-qualified affine geometry primitivece371f892.
Both canonical native readers now carry original filled-path bytes and exact
nonidentity matrix for unmasked GROUP descendants. Other path paint/mask guards
remain. DumpShape adds raw affineTransform; group projection requires complete
container identity, original local dimensions, matching independently captured
relative/absolute linear bases and translation proof, then projects the original
control points into the existing editable path channel. Raw dump stays unchanged.
Missing owner/shape, conflicting matrices and competing stroke/paint refuse.

New integration tests call both shipped dumpShape copies on original native
facts, check equal raw records, propose contracts and render both React emitters.
Both chevrons on both surfaces have0percent pixel difference on white and black,
16x16logical/64x64native4xreference.29relatedtests pass, TypeScript and targeted
lint pass. Source3c3a1da2c. No updates to cleanCIcheckout while48864runs.
REST remains explicitly unsupported for these transforms; native fix not credited
to saved REST cohort. Fixed40replay and native editable verification still due.

Fresh read-only canonical Calendar family capture inADS: first capture omitted
optional dependency expansion, then reran WITH INCLUDE_DEPENDENCIES=true,15sets.
/private/tmp/calendar1078/family.json is authoritative complete capture; dump.json
is root-only and not used for the package. Normal figmaToReact now proposes14sets
and skips1(Shortcut text style identity), previously12proposed/3skipped. Both
single-chevron refusals gone. Both composed React surfaces retain all54captured
text strings and321x292geometry with exact Atlassian font loaded.

Visual inspection still shows four Image placeholders. Independent request/code
inspection finds core/nested-property-inputs.ts deliberately skips any witness
with INSTANCE_SWAP, and Icon slot still defaults tods.image. This is a separate
composition gap, not proof the new affine geometry failed. Next carry qualified
swap target identity through nested caller slots, preserving originals and
refusing unresolved mains; do not hand-substitute Calendar-specific children.
Fresh source, package, logs and screenshots archivednative-affine-import-1078.
Broad latest174/204, fullCI48864confirmed live. Last completed2522/6312(39.96%);
reverse unqualified. No owner wait, source canvas mutation, release or goal change.

## Experiment 1079 — caller-owned nested instance swaps

Previous1078made progress: affine paths now import; composed Calendar retained
Image placeholders because nested-property forwarding skipped INSTANCE_SWAP.
Changed forwarding to resolve selected targets only with matching value/nodeID,
actual main key, unique captured target, same-file contract and exact slot binding.
Selected variant props mapped through declared domains. Wrapper selection now
uses exact main identity within a captured variant family, not a single-main-only
restriction. Promotion keyed by generated part identity; cloned fallback retains
original component subtree. Caller slots receive selected targets; shared child
mains stay unchanged. Owner-dependent expressions/conditional component mappings
are refused rather than moved into a caller's prop scope. Existing contract
validation must introduce no new errors before committing each proposal pair.

Four tests pass: both React emitters render six captured selections across a
multi-variant wrapper; standalone wrapper default matches the scalar-forwarding
baseline; wrong key/node/value, missing selected identity and duplicate target
refuse; prior label/boolean/variant/native-mock cases remain green. TypeScript,
targeted lint and diff check pass. Source56e6f844a. Test fixture initially assumed
a default slot rendered by default; source API did not enable renderDefault.
Changed comparison to independently proposed scalar-forwarding baseline, retaining
source behavior rather than changing product semantics to make fixture green.

Fresh complete Calendar family1078replayed normally: all4MonthHeader witness
selections forwarded. Both React surfaces retain54capturedtextstrings,0missing,
321x292andthe exact loaded font. CSS screenshot inspected: all4chevrons nowvisible
instead of Image placeholders. Opened screenshot inCodex(queued). This is a
visible composition improvement, NOT full image-threshold pass, interaction
qualification or native readback proof. Shortcut still skipped for styleidentity.
Archive nested-instance-swaps-1079 holds package request/result, before/after
screenshots, probe notes, browser receipts and tests. Original1078archive retains
pre-swap package/screenshot. No source Figma mutations.

CleanCI48864terminalexit1onb6a26f15a:189pass,1fail,11conditional skips/201.
Onlyfailureflowbite-bundle-fresh: committed genesis scripts differ from fresh emit
(8stems). Next inspect/regenerate these clean derived artifacts, integrate1077–79
source, refresh engine receipts and rerun relevant gates. Current source changes
are NOT covered by that wholeCIrun. Fixed40replay remains due; broad34144latest186/204,
lastcompleted2522/6312(39.96%); reverseunqualified. Native preparation/readback and
Figma font/sync issue remain. No owner wait, push, release or goal change.

## Experiment 1080 — clean integration, repaired freshness and real Slot API failure

Previous1079made visible progress: Calendar caller swaps show all4chevrons.
Clean1050was pristineb6a26f15a; integratedce371f892,3c3a1da2c,56e6f844a as
 ec5f0f643,5f7a27b06,6c887a444.37focusedtests and cleanTypeScriptpass.
PriorflowbitefreshfailureisolatedtoToggleSwitch's two inset literal-size lines
from1074. Regenerated that script and GENESIS-BATCH with existing mock-verified
builder; freshnessgate passes. Plugin rebuild and independentverificationpass,
engine7ad157b193fe prefix,2173947B. Receipts committedwriterc4c5f80cb,clean88615d2b5.
NewfullfastCI24228running on88615d2b5,logqualification1080/ci-fast.log. No whole-run
green claim, and this run predates the Slot guard below.

Clean latest Calendar prepares successfully. /private/tmp/live1080/prepared.json,
artifact4fbbe19c224dae2319ceb54616c4022be4d47e824e9fdd3c7bf95bc79acbedc7,
revision sha256:feb67c7ae32756bf065d344d62fdf223d5ca09dc9b1bcb501d2ea2b6856e0ad7,
operation70000000-0000-4000-8000-000000001080. Canonical scripts/template drivers
inlive1080 import clean1050. Native font query now lists AtlassianSans9styles.
Bridgeactiveprobe succeeds; setting its currentpage aligns visible UI161:67168,
which now includes1054page and no unsaved-warning text. No fullapprestart.

Inspected existingpage+screenshot. Token script firstcall got syntax error due
to an unnecessary return-await prefix; parser failed before mutation. Retried
unchanged canonical body: collectionVariableCollectionId:163:67188created,
independent readbackcollected, writebuilderaccepted. Tokens retainedverified.
Executed canonical1.3MBnativewrite: partial-or-unknown-allocation onpage163:67278,
error 'in set_isExposedInstance: Cannot expose instances within slots.' Created
Image/Icon/FocusRing/Shortcut/Tooltip and first IconButton variant; Calendar not
created. Captured creationJSON, screenshot and exact children; verified matching
operationname+children then removed ONLYthat newpage. Returned to161:67168.
No retry with hand-edited canvas. Scope token collection remains for next
canonical attempt; no native qualification or score credit.

Root cause nestedCanExpose stopped at INSTANCE but not SLOT ancestors. Added
SLOT rejection; mock now enforces Figma's observed restriction. Existing native
exposure regression extended with slottedcontrols through create/repeat/amend,
while regular/transitivecontrolsremainexposed.22tests pass, writerTypeScriptpass,
targetedlint exits0with existingwarnings. Source7947a11c9, parkedboundpaintdiff
excluded. Engine receipt/derived scripts now need refresh for this latestguard.
Do not mutate cleancheckout while24228running. Next integrate guard afterCI,
refreshreceipts, rerun canonical1080write/readback usingretainedtokenproof or
freshoperation as revision demands. Fixed40replaystilldue; broad34144latest192/204,
lastcompleted2522/6312(39.96%); reverseunqualified. No owner wait,push,release.
Evidenceclean-native-attempt-1080archivescleanchecks,preparedplan,tokenreadback,
partialcreationandregressionlogs. Goal unchanged.

## Experiment 1081 — fixed cohort preparation comparison

Revalidated CI handle24228 and broad benchmark34144: both live, so clean1050
remains unchanged at88615d2b5. Previous status-only turn added no implementation;
this turn completed the outstanding fixed40 preparation replay for1077–80.
Using existing tree998/fixed40-probe.mts against writer8f8c01a24 working tree,
all40 status, canonical request SHA-256 and skipped records match scope1071:
38prepared,2refused,0changed. Preserved parked changes were present; archived
working-tree.patch records their exact bytes. This is preparation regression
evidence, not fresh visual scoring or proof of native write/readback.

Archive fixed-cohort-1081 retains both40request cohorts, summaries, comparison,
runner, input list, log, sourcehead and workingtreepatch. Offline replay did not
start a second REST checker. Broad latest198/204; last completed2522/6312
(39.96%), reverse still unqualified. FullCI24228 remains running and predates
Slot guard7947a11c9. Next after terminalCI: integrate guard, refresh engine and
derived artifacts, rerun canonical native write with retained token proof and
independent readback. No owner wait, release, push, threshold or goal change.

## Experiment 1082 — completed broad benchmark and paired verdict audit

Broad session34144 terminated exit0 after204/204sets. full204-1044 summary
and coverage pinfb048325f70dc9d28c51eb559f4644e01eb60a7b:2679PASS,2422FAIL,
1211UNVERIFIED/6312declared=42.44296578%,43fullypassing sets.620unmeasured
variants remain in denominator; no reportedvariantcount mismatches. Compared
with full204-938: +157passes,+4sets,+2.4873percentagepoints. All2522previous
passes remain passes.46previousFAIL→PASS;111previousunreported→PASS;246
previousunreported→FAIL;2FAIL→UNVERIFIED. Identical frozen sample SHA; font
manifest and engine changed, so this comparison cannot isolate contributions.
Repeatedsample results do not establish never-seen performance. Current Calendar
and Slot source is newer than this benchmark and receives no score credit.

Archive completed-full204-1082 holds executable comparison, detailed paired
JSON and filterable204-row benchmark.html. Local report server56161 at
127.0.0.1:60515/benchmark.html; Codex browser open queued. Initial18771 bind
was occupied; no existing process stopped, retried with OS-selected free port.

Material3StandardSlider120/120visualpasses still has set failure
named-slot-not-exercised:icon: source showIcon defaultsfalse and all current
visualcases hide slot. Saved slot/visibility/receipt evidence in
fixed-cohort-1081/slider-slot-triage.json. No runtime slot-discard proof and
no scorer changes; separate enabled-slot probe remains needed.

CleanCI24228 re-polled live; clean1050pristine88615d2b5. Next integrate
7947a11c9 only after terminalCI, refresh derivedscripts/enginereceipt and retry
native write plus independent readback. Reverse unqualified. No owner wait,
push, release or goal change.

## Experiment 1083 — native Calendar created; independent inventory blocker isolated

CI24228 terminalexit0on88615d2b5:190/201gatespassed,11conditional skips.
Cleanpristine, integrated7947a11c9 as56258ca4e; engine receipt560913517
(af8013142717prefix,2173973B). Rebuilt core; fresh eight Flowbite scripts
unchanged; freshness and independent plugin verification pass.22focused
composition/nested-property tests pass. WholeCI predates guard, not claimed
for latesthead. Writer receives receipt by cherry-pick; parked diffs preserved.

Repreparedlive1083 from same request. Revision unchangedfeb67c7...e0ad7,
operation remains70000000-0000-4000-8000-000000001080. Verified no matching
page; retainedtoken collection163:67188 exists, canonical fresh tokenreadback
collected and accepted by writer. Canonical regenerated1.3MBwrite contains
Slotguard. Live write succeeded: created-candidate page164:67337, target
Calendar164:69724,733allocationnodes. Screenshot inspected:321x292,month
label/dategrid andfourchevrons visible. No posthoc canvasfix or source mutation.

Ordinary independentreadback refusednative-source-readback-result-byte-limit.
Used existing emitNativePreparedLibraryPackedReadbackScript (lossless bounded
transport, unchanged3MiBlimit); unpackNativeReadback collected1475nodes.
Unchanged verifier refusesnative-source-observation-node-inventory. All733
allocationIDs present;742extra inherited instance descendants (219FRAME,155TEXT,
148SLOT,118INSTANCE,102VECTOR). Current verifier has graph slot identity
resolution and borrowed-descendant checks; pinpoint that mismatch next rather
than discard observation or loosen inventory. Successfulcandidatepreserved.
Archive native-calendar-created-1083 contains plan, creation, fresh tokenproof,
ordinary refusal, packed+decodedreadback, verifier refusal and checks.
Broadscore42.44%(2679/6312),reverseunqualified. No owner wait,push,release.

## Experiment 1084 — exact inherited caller identity repair

Replayed saved immutable1083creation and packed independent readback. Inventory
resolver rejected8 inherited callerINSTANCEs inside MonthHeader nestedslots;
not all742extra descendants. Their source allocations remain live and their
metadata has specPath rather than defaultSlotIndex. They are exact copies of
caller content inherited when Calendar instantiates the MonthHeader main.

Sourcef1bc66f12 adds a graphVerification2-only identity proof: follow observed
child-index topology from an enclosing born INSTANCE to its observed COMPONENT
main and require the corresponding source ID, type, mainId and contract-part
metadata to match the retained original. Shared stamp alone is insufficient;
no name matching, inventory omission or fidelity threshold change. Existing
verifier still checks downstream structure/values. New regression rejects wrong
main, wrong content main, metadata mismatch, missing child links, duplicates and
legacy graph mode.26prepared-library tests pass; TypeScriptpass. Initial test
fixture used non-JSON partmetadata; corrected fixture to production-shapedJSON.

Cleanintegrated7c630d657 and refreshed/independentlyverifiedengine0d1131fe0;
writercherry-pickedreceipt. No fullCI claim for these latestchanges. Existing
1083receipt now passes identity resolution, then refuses90extra-stroke and90
inherited-width findings. No native pass claimed. Archived probe,8collision
records,unchanged-receipt verification andchecks in inherited-caller-identity-1084.
Original1083verificationfile restored after diagnostic driver reused its output
path; new diagnostic verification is isolated in1084archive.

Next inspect native extra strokes and inherited Tooltip text width against
prepared expectations; preserve candidatepage164:67337. Broad42.44%(2679/6312),
reverseunqualified. No owner wait,push,release or goal change.

## Experiment 1085 — verify declared literal strokes without changing paint

Inspected savednative values and preparedIconButton specs:90extra-stroke
findings are declaredliteralstrokeColor+strokeWeight1, not unexpectedpaint.
Existing verifier only admitted boundstrokes or insetrings. Sourcec4e107904
adds exact preparedlibraryroot/frame literalstroke verification:one visible
NORMALsolidpaint,expectedcolor+alpha,no paint/nodealiases,uniformexactweights,
expectedINSIDE/OUTSIDEalignment andexactdashpattern. Per-side literalstrokes
remain outside this new case. Reader now captures stroke-layout fields for
literalframe strokes too. No canvas,converterpaint,scoreboardor thresholdchange.

27prepared-librarytests andTypeScriptpass. Mutationtests refuse missing/extra
paints,color,alpha,hidden/blend,weights,alignment,dashes andaliases. Fixture
needed Figma's observeduniformedge mirrors (smallmockdoesnotprovidethem);
supplemented mocknodefields beforecanonicalreadback. Initialreaderomitteddash
fornon-inset literalframes; fixedreaderpredicate ratherthan acceptmissingdata.
Cleanintegrated13d8d5661; refreshed/independentlyverifiedengine57154c002;writer
receivesreceipt. WholeCIhasnotrerunforlatestchanges.

Unchanged1083readback now reports only90inherited-width findings. Tooltipmain
text798px differs from declaredcaller text 'Short and brief'85px, bothHUG.
Next verify declaredTEXTproperty-specificgeometry without allowing unrelated
resize or losingfont/text/paint checks. Evidence literal-stroke-observation-1085.
Original1083verification restored; candidatepagepreserved. Broad42.44%
(2679/6312),reverseunqualified. No owner wait,push,release or goal change.

## Experiment 1086 — fresh Calendar supported structure observed

Live queried Tooltipmain164:67370 and inheritedI164:67392;164:67370:both
WIDTH_AND_HEIGHT,HUG/HUG; main798x16 and caller85x16 because declaredTEXT
property changes long guidance into 'Short and brief'. Readback omitted
textAutoResize excepttemplates; staticinheritedwidthcomparison was invalid
for this source-declared content change.

Source3959cd279 now always captures native textAutoResize. Width-only
exception requires declaredcontentProp,exactpropertyreference+TEXTvalue,
changedstring,singleline,positivefinitebounds,bothWIDTH_AND_HEIGHT+HUG/HUG,
no fixedwidthorwidthbinding. Other geometry,fonts,paints,text andproperty
checksremain; no general computedgeometry qualification is claimed.28tests
andTypeScriptpass; negatives include missingmode,fixedsize,binding,wrongprop,
wrongreference,wrongtype,unrequestedtext,invalidwidthandunchangedtext.

Cleanintegrated56f0ccc9e; canonical packedreader executedfreshagainst preserved
Calendarpage164:67337.1475nodescollected,losslesslyunpacked; unchangedremaining
checks return supported-structure-observed,problems[]. acceptedContractnull
andnativeQualificationunqualified remain. Visualfidelity,SVGgeometry,computed
geometry,resolvedpaint,wrapperreevaluationandinheritedsampletokenbindings
limitationsremain. This is a structural milestone,NOT reverse scoreboardpass.

Engine5570c2964 refreshed+independentlyverified;writerreceivesreceipt. New
fullfastCI launchedonclean5570c2964 (text1086/ci-fast.log); do not mutate
cleancheckout while it runs. Next capture/compare sourceandnativeCalendar
using unchanged visualcriteria,then exercise declaredbehavior. Archive
native-text-readback-1086 contains freshpacked+decodedreceipt,verification,
driversandchecks. Broad42.44%(2679/6312),reverseunqualified. No ownerwait,
push,releaseorchange togoal.

## Experiment 1087 — Calendar visual comparison exposes real font-weight loss

CI37700repolledlive;clean5570c2964unchanged. Read-only fresh native PNGexports
sourceADS13266:43128 andcandidate164:69724,scale1,absolute layout/renderbounds
and54textfacts each. Both321x292. Existing recorded-frame aligner anddiffPair
(unmaskedwhite/black,thresholdunchanged) yield0.7084526784%white and
0.2224389055%black.54texts retained,no missing/extra strings. Triptychinspected.
This is diagnostic nativepair evidence,not reverse realReactlibraryscoreboard.

FidelityFAILdespiteimageunder5%:monthheading+7weekdays sourceAtlassianSans
Boldvariationwght653 becomeMediumwght500. Sourcefamilydump alreadycaptures
fontWeight653 andrequesttokensemantic heading$value653. Lossoccursnativewriter:
ordinarytextstampfontWeightVar butonlyslotTextTemplatebindsactualfontWeight.
StalecommentclaimsAPIcannotbindweight,contradictedbyexistingtemplatepathand
sourcebindings. Next implementgeneraldeclarednativeweightbindingwithfresh
write/readback,notmanualcanvasrepairorfontscorewaiver.

RawstylecomparisonalsoincludesvariableIDs andoptionalvariationmetadata,which
are not bythemselvesvisualmismatches;diagnosisisolates8actualfamily/style
mismatches. Disabledtextalpha0.28999999vs0.29019609 retainedinrawfacts for
separateprecisionreview. Iconinventoryandbehaviorremainunqualified.
Archivecalendar-visual-font-diagnosis-1087containssource/nativeJSON+PNG,
unchangedscorerdriver,triptychs,comparisonanddiagnosis. Broad42.44%(2679/6312),
reverseunqualified. No ownerwait,push,release,sourcewriteorthresholdchange.

## Experiment 1088 — ordinary native text binds declared weight

Source5b796e192 writes fontWeight variable bindings on native contractdraft
ordinarytext (nativeContractPart),preservinghistoricalstampsandtemplatepath.
Non-nativehistoricalgenerationunchanged. ReadbackcapturesnumericfontWeight;
verifierrequires exactbindingidentity,normalizessingle-entrynativearray,
resolvesdeclaredvariablealiases andchecksactualnumericweight. Inheritedtext
weightremainscheckedagainstobservedmain. Sourceweight653 nowtestedthrough
ordinarypreparedlibrarycreate/readback; wrong500,missingweight,detachedand
foreignbindingsrefused. No liveweightpassclaimyet.

Initial29tests passed beforeaddinginheritedweightcomparison; finalrerun
exposed10failures becausemockclones droppedfontWeight outsideoptional
consumerVariableModes. Fixedmockclone toretainpresentnumericweight; all29
passagain. TypeScriptpass. Onlynewemitterhunksstaged; parkedboundpaintwork
preserved. Sourceandmockcommitsarewriter-onlywhileCI37700verifiedliveon
clean5570c2964. No cleanmutationorrestart.

NextafterCIterminal:integratewriterweight+mockcommits,refreshloweringcitations
andenginereceipt,preparefreshnativeoperationwithcanonicalwriter,independent
readbackandrepeatvisual/fontcomparison. BindingmaychangeFigmafontstylename;
inspectrealAPIresultbeforedecidinghowtoreconcileauthoredweightandfacename.
Evidence native-font-weight-1088 storesfinaltests/typecheck. Broad42.44%
(2679/6312),reverseunqualified. No ownerwait,push,releaseorscorechange.

### 1088 related regression completion

Native-source-observation,source-text-color-control,text-style-keyed-weight,
native-root-text-template-graph andnative-root-text-template-value-update:
116/116pass,terminalexit0,13seconds. Savedrelated-tests.log in1088archive.
CI37700repolledliveonclean5570c2964;checkoutpristine. Latestwriterchanges
5b796e192+755eeb1c1 stillpendingcleanintegrationandlivefontverification.
Do not infernativefidelityfromthesechecksorcountanotherreversepass.

## Experiment 1089 — isolated native weight lane; live weight653 confirmed

CI37700verifiedliveonclean5570c2964. Broadlanecomplete, so reusedsecondlane
for isolated /private/tmp/ds-contracts-native-weight-1089 atwriter398a49118.
ManagedworktreeAPIfailedinvalidreferencebecausecallingcheckoutcannotresolve
writerclonecommit; gitworktreeaddfromwriterrepositorysucceeded.95GiBfree;
independent269MBAPFScopyofdependencies,prep:corepass. Engineand3lowering
citationsrefreshedc300d2e93 (ruletextunchanged),writercherry-pickedreceipt.
No mutationofrunningCIcheckout.

Freshoperation70000000-0000-4000-8000-000000001089,canonicalprepare,token
create+independentreadbacksuccess. Priorpageabsent; canonicalwrite1.3MB
executedbuttoolresponse timedout30s. Didnotrerun. Posttimeoutinspection
finds15top-levelcomponentsincludingCalendar164:72578onpage164:70191.
No completecreationreceipt,so no independentqualificationclaim. Priorcandidate
164:67337preserved.

LiveheadingandSun nowfontWeight653,matchingdeclaredtoken;bindingpoints
VariableID:164:70108. FigmafontName remainsMedium withvariationwght653
(sourceBoldwithwght653); face-label comparison alone is notweightproof.
Freshscreenshotappearsmissingseveraldateglyphs despite54TEXTnodesandcorrect
queriedpaint. Need diagnosepostbindinglayout/font-renderingandtimedoutreceipt
transportbeforecountingpass. Preserveunknowncandidateandrevalidatebefore
cleanup/retry; no manualrepair. Archive native-weight-live-1089 includes
plan,tokens,timeoutresponse,rawtext/font/paintfacts,PNGandbuildreceipts.
Next isolatepaint/layout discrepancy and use boundedasyncwrapperaround
unchangedcanonicalwriter if needed to retain its eventualactualresult.
Broad42.44%(2679/6312),reverseunqualified. No ownerwait,push,release.

## Experiment 1090 — complete weight-bound Calendar result and visual improvement

Investigated1089apparentmissingglyphs:sampledtextbounds/renderbounds/visibility
andancestorclippingmatchpreviouscandidate; rawPNGfirstrowalpha-countsidentical.
Fresh2x screenshotshowscompletegrid. Priorvisualinferencewaswrong; noactual
missingglyphregressiondemonstrated. Archivedfacts+pixelprobe.

Freshoperation1090 executedexactcanonicalwriter insideasyncresult-retaining
wrapperglobalThis.__dsNative1090. Dispatchedwithout30sresponsewait;polled
running,thenfinishedactualcreated-candidate result733nodes,problems[]. No
reconstructionfromstamps. page164:73045,targetCalendar164:75432. Fresh
packedindependentreadback1475nodes,verifier supported-structure-observed,
problems[],nativeQualificationunqualified. Wrapperonlychangestooltransport,
notwriterbody. PreviousCI37700remainsliveonunchanged5570c2964.

FreshsourceandnativePNG+54textfacts capturedusingnativeexports. Existing
recorded-framecomparison0.3031872753%white,0.1919678225%black (previous
0.70845/0.22244).321x292both;all54stringsandsourcedresolvednumericweights
matchinorder. Headingweights653. FontfacelabelMediumvsBoldwithsamewght653
remainsrawfact,notautomaticallytreatedasvisualdifference. Rawcomparison
includesaliasIDs/axis-metadata/alpha differences;behaviorandfullfont/color/icon
qualificationnotcomplete. ThisFigma-derivedCalendarisnotarealReactlibrary
reverse-scoreboardcohort;nocreditassigned.

Preserved1090candidateandoriginal1083. Removedsuperseded1089page164:70191
onlyafterexactoperationname+15childIDcheck;removeditscollection164:70101
afterexactname+keycheck. Currentpage1090. Archive native-weight-verified-1090
containsactualcreation,tokenproof,packed+decodedreadback,source/nativePNGand
facts,triptychs,comparisonandglyphdiagnosis. NextbehaviorandrealReactlibrary
qualificationwithboundedtransport. Broad42.44%(2679/6312),reverseunqualified.
No ownerwait,push,releaseorscorerchange.

## Experiment 1091 — preserve legacy programs; integrate weight fix after CI

Calendarrootcontract hasprops[],states[],noevents/transitions/interactions,
semanticsdiv. No workingdate-pickerbehaviorcanbeinferredfromitsstaticcanvas.
RealReactlibraryreversecohortremainsrequired; earlierinventoryREADMEisstale
history,notcurrentqualificationevidence.

CI37700terminalexit1:onlysource:reference:checkfailed,threelegacyprogramhash
tests in native-contract-update-bytes. Cause1086unconditionaltextAutoResize
readbackfield (latestweightreaderalsounconditionalfontWeight). Source93746d373
adds preparedLibraryTextopt-in to sharedinventorycollector; preparedlibrary
pathcapturesboth,legacydefaultretainsoriginalfieldlist. Pinnedhashesunchanged.
32targetedtests (3legacypins+29preparedlibrary),116relatedtests,TypeScriptpass.
No weakenedgateornewbaseline.

Clean1050pristineafterCI; integratedweight5b796e192→8a1999b1f,mock755eeb1c1
→42131f531,receiptc300d2e93→05829c2b9,and93746d373→1b51a4bb1. Refreshed/
independentlyverifiedenginefb05bb5c6;writercherry-pickedreceipt. Newtargeted
source:reference:checkstartedafterprep:core,loglegacy1091/source-reference.log;
keepcleancheckoutunchangedwhileit runs. No full-lanegreenclaimforlatesthead.
Evidence legacy-readback-repair-1091 retainsoriginalCIandtargetedchecks.
Next verifyfailedgateterminalthenresume realReactlibrary nativequalification.
Broad42.44%(2679/6312),reverseunqualified. No ownerwait,push,release.


## Experiment 1092 — React composition collects required numeric font weight

Previous turn yielded new evidence: targeted gate 4576 terminated exit 1,
1672/1673 tests passing. The remaining nested-caller composition failure was
native-source-observation-text-weight, not a missing Figma prerequisite.
The verifier required numeric weight on contract text, but the reader collected
it only for prepared-library graphs. React caller graphs could therefore refuse
correct output. Reader now captures textAutoResize/fontWeight for weighted text
specs as well as prepared libraries. Unweighted historical plans retain exact
program bytes; no pinned hashes or scorer thresholds changed.

Initial overly broad contract-draft collection broke three legacy byte pins;
replaced it with spec-driven collection before committing. All 22 composition
and legacy-byte tests pass. Added a changed-weight refusal and restoration
assertion to the existing nested-caller integration case. Prepared-library
29/29 and source-reference TypeScript pass. Source commit 81566aa87, clean
integration b68f0c5a5; engine receipt clean 17207f945, writer 9521b8777.
Parked unrelated edits remain untouched.

Clean checkout now running prep:core then source:reference:check, session 7799,
log /private/tmp/source-reference1092.log. Do not mutate it while live.
Archive composition-weight-readback-1092 retains previous failure and targeted
verification logs. Full gate success remains unproven until terminal result.
Broad scoreboard remains 2679/6312 (42.44%); reverse remains unqualified.
Next: inspect this gate result and resume the original real React-library
cohort, preserving all refusals and its full denominator. No owner wait.


## Experiment 1093 — real Primer compilation blocker removed

1092 gate session 7799 terminal exit 0: source:reference:check 1673/1673,
on clean 17207f945. Archived complete log with 1092. This is the previously
failed gate, not a new full-lane result.

Reverse Grid archive reassembly attempted with current source. Required
historical toolchain dependency at ds-contracts-group-coordinate-integration-
2026-10-02/node_modules/typescript/package.json is gone. No fresh reverse
qualification claimed; restore independent inputs before reusing that archive.
Writer prep:core repaired stale local schema build; no tracked source changed.

Broad full204-1044 identifies GitHub Primer ActionList.Item/SingleSelect-
SelectPanel (23595:93346), 36 variants, refused on RadioInput TS2367.
Saved contract 2.contract.json contains a checked-only parent and a false-only
child geometry. Such hidden source geometry remains in the contract; nested
strict comparison in generated JSX is rejected by TypeScript's outer narrowing.
Boolean visibleWhen predicates now use globalThis.Object.is on both React
surfaces: identical boolean equality at runtime without impossible-comparison
compile errors. No geometry, visibility facts, scorer or source data changed.

Regression reproduced TS2367 before fix; all 22 filled-path tests pass after.
New browser test cycles false/true/false and observes zero/one/zero path resources
in both module and inline output. Saved real RadioInput re-emitted with current
writer, generatedTypeErrors returns []; source-reference TypeScript passes.
This is compile repair, not 36 visual passes. Archive primer-boolean-visibility-
1093 holds reproduction, generated real output, typecheck and browser logs.
Source ad0929a2b, clean 75358f991; engine receipt clean 9555af745.

Next remeasure the complete Primer set and fixed40 regression on clean current
source, then resume full real-library reverse evidence with restored independent
inputs. Broad 2679/6312 (42.44%), reverse unqualified. No owner wait or release.


## Experiment 1094 — Primer measured; fixed40 generation; Grid evidence restored

Clean 9555af745, no source edits. Primer saved dump 23595:93346 reprocessed
with the same full font manifest and production consumer checker. Session55831
terminal exit1, package built and all36 variants measured: 0pass36fail0unverified.
Previously compile-refused, now measured failures; no positive score credit.
Reasons: SF Pro Text unavailable36; white/black image differences18 each;
size mismatch18; text-color mismatch12. Set-level named slots leadingVisual/
trailingVisual not exercised and state variant discarded. Full result/images
remain /private/tmp/primer1094/result. Historical broadscore unchanged42.44%.

Fixed40 preparation session7133 terminal0: all40 canonical request statuses,
hashes, skipped/reasons identical to1081. Full package generation session29130
terminal0:37generated3refused. Refusals Heading-Left(instance-affine host),
Carbon Header menu and Accordion skeleton(binding evidence). Compared to older
800, Heading-Left now refuses and Code Block generates; intervening changes
prevent attributing this to1093. This is generation, not40-setvisualvalidation.
Archive primer-cohort-measured-1094 stores summaries and comparison.

Recovered66 missing historical reverse-helper toolchain files from clean1050;
all bytes matched original SHA256, copied only absent files using exclusive
creation. Current-source Grid archive reassembly now links source anatomy and
refuses react-root-grid-constraints-unqualified; no native credit. Original
five-case Grid partition (rows-five through rows-nine) running fresh observation
session12171, /private/tmp/primer1094/grid-observe.log; job2a30954f-f640-403b-ac0a-
e108a400845b under writer/private/react-source-ownership/cfbce1a5b084ba333bebac4366254de66bc8211ffc5cf036f75ff829183167ed/.
Preserve entire reverse denominator; this is one existing partition, not new
unseen qualification or a reduced target. Do not modify writer source while
observer runs. Next inspect its terminal report, then target real grid constraints
or Primer state carry with before/after evidence. No owner wait or release.


## Experiment 1095 — measured slot fallback text-color and state repair

1094 Grid observation12171 terminal0: five source cases observed, unchanged,
all five style-prepared but react-root-grid-constraints-unqualified; zero native
requests. Added complete report/requests to1094archive. No reverse pass credit.

Primer root already had state tokens. Lost state effect came from Description/
none's omitted slot content: its child contract had identity-qualified text ink
controls, but fallback refs dropped caller colors. Extracted existing instance
text-ink routing as shared helper; slot fallback now calls it using full parent
combination rows. Static default props retain declared item/anatomy agreement.
Existing drawing ink runs first and is retained. Exact source identity checks
unchanged. Initial draft using mapped props violated default-anatomy invariant;
corrected to existing paintPropsByCombination without weakening validation.

33 source text-color tests, 7 slot-default paint tests, source-reference TypeScript
pass. Browser regression proves parent variant changes affect omitted content,
and explicit caller content bypasses fallback. Source e33210317; clean573180e7a;
engine clean ef76d57fc, writer1777fca44. Clean checkout remains pristine.

Production remeasurement session88869 terminal1: Primer0/36pass, all36 measured.
All12 text-color mismatches removed; variant-prop-discarded:state removed.
Remaining: SF Pro Text unavailable36; size mismatch18; white/black image failures18
each; named leadingVisual/trailingVisual slots unexercised. Same dump, font
manifest and scorer thresholds as1094. No variant verdict changes, no pass credit.
Comparison and logs archived slot-default-text-ink-1095; full images/result remain
/private/tmp/primer1095/result. Broadscore42.44%(2679/6312),reverseunqualified.

Fixed40 request preparation session44149 still running against clean ef76d57fc,
/private/tmp/tree998/fixed40-complete-ink1095 and /private/tmp/primer1095/fixed40.log.
Next verify terminal comparison, then solve remaining source-backed size/font
or slot issues and Grid constraints. No owner wait, push or release.

1095 fixed40 completion: session44149 terminal0. All40 preparation statuses,
canonical hashes, skipped/reasons identical to1094. No new preparation refusal;
this check does not measure images. Comparison archived with1095.


## Experiment 1096 — prioritize qualified source evidence before further fixes

No production edits. Current clean ef76d57fc checked pristine. Primer exact
SF Pro Text unavailable in local font directories and Spotlight; older archive
also records absent download. Apple's official font page was inspected; no
substitute alias, font download/embedding or new score claimed.

Ranked full204-1044 failures excluding font-unavailable sets. Largest Switch
160fail160unverified has render-export-overlap-mismatch throughout; next MUI
Button84, Radix Slider72, Spectrum Card38. Archived full priority rows.
Read prior SWITCH-CAPTURE-851 before any network rerun: no fullSwitchrerun.
Browser probe mounted retained generated Switch with actual tokens/dependencies.
Raised xs: root24x6, thumb12x12 at y=-3, white fill, overflowvisible. This matches
captured contract geometry. Crucial size-message ordering: consumer24x13 versus
Figma24x6, NOT the reverse. Thus shrinking browser thumb to match source PNG
would corrupt authored geometry. Existing source-origin refusal remains needed;
next source investigation must produce a qualified export rather than modify
scoring or rendered size to fit a cropped reference.

Independent Spectrum Card Desktop Dark172:25197 replay on current clean engine,
same saved dump and fontmanifest, session61274 terminal1. Counts7pass38fail3
unverified. Replays retain old 48-case denominator; no fresh unseen score credit.
Evidence source-priority-1096 stores comparison, log, Switch browser facts and
failure ranking. Full results /private/tmp/spectrum1096/result. No processes
started this turn remain running. Broad2679/6312(42.44%),reverseunqualified.
Next resolve source-origin proof for Switch or inspect a qualified Spectrum
image pair; avoid replaying source-export failures as speculative engine fixes.
No owner wait, push or release.


## Experiment 1097 — mixed frame layout modes retain captured fixed heights

Inspected qualified Spectrum pair type-standard_state-hover_hoverAction-
unselectedCheckbox:60.10%white60.11%black, consumer280x193 vs source280x247.
Image2 source has explicit fixed heights125(Standard),120(Learn),104(Horizontal).
First two are auto-layout, last plain FRAME. nameFixedChildGeometry delegates
when ANY plain-frame fixedSize exists, while mintFixedSize skipped when ANY
auto-layout fixedSize exists: entire mixed family lost heights and collapsed.

mintFixedSize now delegates only uniformly auto-layout fixed-size families;
mixed families retain explicit recorded sizes through existing token/literal
carriers. No measured pixels or per-component conditions added. Existing bound,
absolute and mixed FIXED/FILL guards retained. Generated real Spectrum request
now carries image.height.{type}.24 mask/geometry tests and source-reference
TypeScript pass. New browser test cycles auto/plain/auto with125/104/125px on
both React surfaces; native compilation succeeds (not live-native qualification).

Source0b7bbef9e, clean ca74008f1; engine clean8678f0f97, writer3c9a4135f.
Clean checkout two read-only runs active: Spectrum production remeasurement
session27861, /private/tmp/spectrum1097/run.log and result/; fixed40 preparation
session63013, /private/tmp/spectrum1097/fixed40.log and /private/tmp/tree998/
fixed40-complete-mixed1097. Keep source unchanged until both terminal.
Missing original bitmap (native-image-byte-budget-unqualified) remains separate;
size repair cannot be claimed as an image pass before measurement completes.
Archive mixed-frame-sizes-1097 retains tests/build receipt. Broad42.44%
(2679/6312),reverseunqualified. Next collect both terminal results and compare
against1096Spectrum and1095fixed40. No ownerwait,push,release or scorer changes.


1097 terminal results: Spectrum27861 exit1 (remaining fidelity failures),
fixed4063013 exit0. Spectrum7pass38fail3unverified ->10pass37fail1unverified.
Three horizontal cases fail->pass: default/none, hover/none, hover/unselected
checkbox+3actions. No prior pass lost. Two standard hover cases now measured
fail instead of scroll-unverified; do not attribute that transport change to
size fix. Size mismatches24->19; imagewhite/blackfailures33->32 each; textcolor8
unchanged. Fixed40 all40 canonical hashes/statuses/skipped/reasons identical.
Comparisons+terminal logs archived. No runs from1097 remain live. Broad score
remains historical2679/6312 until a fresh pinned full-sample run; do not combine
local replay gains into a first-pass unseen-kit claim. Next investigate image
asset budgets or remaining Spectrum color/geometry misses, then required gates.


## Experiment 1098 — bounded original images above 1 MiB

Clean8678f0f97 pristine. Started prep:core + source:reference:check session76444,
logs /private/tmp/prep1098.log and /private/tmp/source-reference1098.log. This
checks1095/1097 integration, not the new image change; do not mutate while live.

Fetched only Spectrum original-image map then two previously refused assets.
Original SHA1 imageRefs match exact downloaded bytes:1a5a0446...=4,981,596 bytes,
354ce342...=1,645,921 bytes, bothJPEG. Original cap1MiB excluded them before
conversion. No screenshot substitution, recompression or aliasing. Archive
original-image-budget-1098 retains exact bytes, SHA256 metadata and verification.

Source2fb67b006 increases original-asset resource budget consistently across
REST collection, native dump, CSS projection and native fill to8MiB per asset,
32MiB per import.64-download cap retained. Streaming oversize cancellation,
hash authentication, MIME/paint-mode checks stay intact. Replaced grouped-repeat
base64 validation with linear character/padding check plus exact multiple-of-four
length and byte count; avoids regex stack growth for original multi-MiB data.
This is an input resource budget, not an image-difference scoring threshold.

21 image tests and source-reference TypeScript pass. Added a generated valid
multi-MiB PNG test retaining exact bytes REST->CSS->native fill, plus malformed
base64 rejection; existing native/REST oversize tests now check8MiB boundary.
Actual two Spectrum JPEGs also project byte-identically through CSS/native fill.
No rendered or native Figma pass inferred from byte carriage. Writer parked
unrelated changes preserved; image source NOT yet integrated into running clean
checkout and its engine receipt not yet refreshed.

Next: poll76444 to terminal, integrate2fb67b006 and refresh receipt, then fetch a
fresh Spectrum dump using production importer and measure all48 cases. Preserve
prior dumps/results and full6312/reverse denominators. Broad42.44%(2679/6312),
reverseunqualified; latest Spectrum10/48local replay. No ownerwait or release.


## Experiment 1099 — original image accepted directly but lost through CSS variable

1098 integration completed: source-reference gate1673/1673 passed (before image
budget change). Embedded dump synchronized02bc227bb, clean07b4b8fd5; engine
receipt cleanc5756c9ff/writer1de033d5c. Fresh Spectrum production import87622
terminal1:9pass38fail1unverified, down from10/37/1. One prior horizontal
hover/unselectedCheckbox3Actions pass lost. All10 original assets captured;
source comparison finds58 componentKey additions only, no geometry/paint changes.
No positive fidelity claim. Fixed40 session13102 terminal0: summary byte-content
values identical to1097 (all40 statuses/hashes/skipped); preparation only.

Browser diagnostic mounted generated React with real tokens. Standard hover
unselectedCheckbox Image2 is72x125 inside280px card, background-image:none.
Independent CSS-boundary probe reads the exact generated token:6,642,158 chars.
Computed custom property length0, computed background-image length4 (none).
Assigning the SAME value directly to element.style.backgroundImage produces
computed length6,642,158; Image.decode succeeds4096x2896. Thus captured JPEG is
valid and browser supports it directly; custom-property carriage loses this
large value. Width/stretch loss is a separate defect. No source patch yet.
Evidence archived image-css-boundary-1099; full import /private/tmp/spectrum1099.
Next implement faithful asset delivery outside oversized custom properties,
cover real browser rendering then remeasure same48; separately repair source-
backed cross-axis fill. Do not resample originals or loosen scorer thresholds.
Broad2679/6312(42.44%), reverseunqualified. No ownerwait, push or release.


## Experiment 1100 — ship exact large image assets in generated packages

Source70c28b23a, clean4e5054245. externalizeTokenImages rewrites embedded PNG/
JPEG/WebP URLs >=128KiB to deterministic deduplicated local assets. Applied
AFTER mode/alias/reachability token emission, preserving the cascade. Both
React generator and registry CLI write original decoded bytes; package builder
copies assets into dist. Small token outputs remain unchanged. No resampling,
scorer changes or component-specific rules. Browser regression uses random
multi-MiB PNG, exact byte assertion, actual HTTP asset fetch/decode, alias and
light/dark/light switch.7 tests pass, source-reference TypeScript and core/CLI
builds pass. Engine receipt clean73791aa8a, writerac3d5f7ce.

Production same-dump Spectrum run79989 terminal1 (remaining failures):
9pass38fail1unverified ->10pass37fail1unverified. Newly passing standard/hover/
unselectedCheckbox3Actions. No prior pass lost versus1099. This differs from
1097's10 passes; do not imply recovery of its lost horizontal pass.
Packaged original JPEG4,981,596 bytes SHA256932d2747da10e0abb40b892ffc179c2e0bdac8b5c559bdefd8ba52576153e927,
verified in tarball dist/assets. Consumer screenshot now visibly paints original
illustration; narrow72px image remains in280px card. Standard checkbox white
error39.08618 ->35.55668%, stillFAIL. Full48 scope retained.

Archive local-image-assets-1100; full result /private/tmp/spectrum1100/result.
No live jobs remain from this experiment. Parked writer changes untouched.
Next repair captured cross-axis FILL through mixed layout combinations, then
compare same48 and relevant regression cohort. Broad2679/6312(42.44%), reverse
unqualified; no unseen-score claim, ownerwait, push or release.

## Experiment 1101 — mixed rectangle admission; sparse child domain still blocks fill

Sourceea7347bc0/clean80f57398c allows a non-filling RECTANGLE alternative to retain
auto alignment beside an observed FRAME stretch. Only FRAME may claim stretch;
fixed/abs/grid/wrap/allocation guards retained.33 item-stretch/mask tests and
source-reference TypeScript pass. Browser fixture covers module+inline switching
frame100px/rectangle20px/frame100px inside supplied100px parent allocation;
it does not qualify root-size extraction. Negative rectangle-fill test retained.
Receipt clean83d231bda/writer1eaaee225.

Production same-dump Spectrum61181 terminal1:10pass37fail1unverified unchanged,
no transitions; package hash50237c280658 unchanged from1100. Fixed40 preparation
27100 terminal0: all40 complete summary values identical to1099. No pass gain.
Read-only diagnostic proposal52586 terminal0: all24 Image rows now supported,
standard/learn stretch, horizontal auto, no competing layoutByCombination or
layoutByProp. fitLiteralAxis still rejects because type axis also contains
social/product/asset, where this image child is absent. Temporary logging removed.
Next make axis fitting presence-aware using verified child occurrence domains,
without inventing geometry for absent variants or weakening sparse inference.
Evidence mixed-frame-stretch-1101; complete results /private/tmp/spectrum1101.
No live jobs from this experiment, ownerwait, push or release. Parked changes
preserved. Broad2679/6312(42.44%),reverseunqualified; goal remains full scope.


## Experiment 1102 — fit cross-axis sizing inside proven enum presence

Source3d4283b86/clean97a1e9087: carryObservedItemStretch receives the already-
proven visibleWhen enum gate. Only that gate narrows axis values before fitting;
missing observations alone cannot authorize narrowing. Only present values get
layoutByProp entries. Rectangle and sparse conflicting-axis refusal guards stay.
10 item-stretch tests and source-reference TypeScript pass. Browser test covers
module/inline visible-frame100px -> fixed-rectangle20px -> absent -> frame100px,
with captured100px parent allocation supplied. Actual Spectrum proposal now
carries standard/learn alignSelf:stretch, horizontal:auto, no invented absent
social/product/asset entries. Engine receipt clean9f51d4e28/writer96ecf0ae2.

Spectrum73341 terminal1 (remaining failures):10pass37fail1unverified ->
14pass33fail1unverified. Four standard cases fail->pass: hover/unselectedCheckbox,
selected/none, hover/none, default/none. No prior pass lost. Consumer screenshot
shows illustration filling280px card instead of72px strip. Same48 variants,
saved1099 dump, fonts and unchanged production scorer. Fixed40 preparation45353
terminal0: all40 summary values identical to1101; no image claim from that gate.

Evidence presence-stretch-1102; full results /private/tmp/spectrum1102/result.
Broader integration prep:core + source:reference:check ACTIVE session86498,
logs /private/tmp/prep1102.log and /private/tmp/source-reference1102.log. Preserve
clean source until terminal. Next collect this gate, then rank remaining real
misses and resume reverse qualification. Broad2679/6312(42.44%) remains pinned
historical full sample, reverseunqualified; no unseen-score claim. No ownerwait,
push or release. Parked writer changes preserved.


## Experiment 1103 — preserve direction inside verified child presence

Integration1102 session86498 polled live; still running source:reference:check.
Do not mutate clean9f51d4e28 until terminal. Last observed subtest873 passing;
partial output is not full-gate success. Writer parked changes preserved.

Inspected Learn triptych: browser places overline/title side-by-side, Figma
stacks them. Consumer280x268 vs source280x288. Raw Header is VERTICAL for Learn;
generated Header defaults row and loses per-type layout because Product lacks
that child. Same domain loss also drops Social header align:center.
Source5a47e7253 extracts layoutPresenceContext used by item stretch and regular
frame invertLayoutByProp. Only previously proved enum visibleWhen narrows axes;
other scopes and guards unchanged.11 focused tests and source-reference
TypeScript pass; new module+inline browser sequence column/row/absent/column
retains direction and child presence. Actual proposal5805 terminal0 confirms
Header layoutByProp social.align=center, learn.direction=column.

No production remeasurement yet: source NOT integrated into running clean
checkout, engine receipt not yet updated. Next poll86498 to terminal, integrate
5a47e7253, update receipt, run same Spectrum48 and fixed40 preparation comparison.
Archive presence-layout-1103; proposal /private/tmp/spectrum1103/request.json.
Latest measured Spectrum14pass33fail1unverified; broad2679/6312(42.44%), reverse
unqualified. No new pass credit, ownerwait, push or release.


1103 integration and measurement completion: prior gate86498 terminal0,
1673/1673 pass,241366ms, covers through1102. Clean1130ff9e6 integrates5a47e7253;
receipt clean3179d05b7/writer9ff4a8729. Spectrum1337 terminal1 (fidelity failures):
14pass33fail1unverified unchanged, no verdict transitions. Fixed40 prep65336
terminal0, all40 summary values identical to1102. No remaining live jobs.

Visual inspection: Learn direction now column, but text vertically compressed.
Generated Header has no fixed height; generated postDetails wrapper carries
flex:1 1 0px, min-width:0, min-height:0, justify:center. Raw Learn Header directly
contains Overline then Title, whereas normalized contract nests titleControl3
inside shared postDetails. Thus changing direction exposed another inherited
wrapper sizing problem. Do not claim rendering success from direction alone.
Next trace normalized text wrapper relocation/primary-axis grow preservation
across parent mode changes; preserve source title geometry and conditional
presence, not a component-name fix. Archives updated with terminal logs and
comparison. Broad42.44%,reverseunqualified remain unchanged.


## Experiment 1104 — do not synthesize foreign fill sizing around flat text

Diagnostic4349 terminal0 found primaryGrowRows marks Post Details fill in all
three types: wrapper-union cloned Social's fillWidth AND fillHeight into Learn.
Raw Social contains Post Details, raw Standard/Learn titles are flat. Source
1a2a77c9b preserves separate flat/nested hierarchies at a fold site if the real
wrapper claims a fill dimension not shared by every matched flat member.
Existing compatible wrapper folding remains covered. No screenshot-derived size,
component name special case or scorer edits.43 geometry/layout tests and source-
reference TypeScript pass; module/inline browser regression confirms flat text
remains flat, stacked and unique across flat/nested/flat transitions.
Clean ce75d7f2c; receipt541abb861/writera2d483e19.

Spectrum57004 terminal1 (remaining fidelity failures):14pass33fail1unverified ->
21pass26fail1unverified. Seven Learn cases fail->pass (all except dragged).
No prior pass lost. Actual generated Header preserves Post Details only for
Social; Standard/Learn title controls remain direct children. Screenshot restores
Learn spacing and full original illustration. Same48/dump/fonts/scorer.
Fixed40 prep86540 terminal0: all40 complete summary values identical to1103.
Evidence wrapper-fill-preservation-1104; full results /private/tmp/spectrum1104.
No live jobs remain. Broad2679/6312(42.44%) historical full sample; reverse
unqualified. Next prioritize remaining common source-backed misses, then broader
integration/held-out verification; local replay gains are not unseen-kit score.
No ownerwait, push or release; parked changes preserved.


## Experiment 1105 — refresh broad sample and diagnose nested image override loss

Clean541abb86185eb22f686afeee2f0542115f591c69 verified pristine. Started unchanged
run-full204.mjs with frozen204 sample SHA59456871c3db8a1bff90a8ed861260299075f7388936c60f48ac9ce6993d7357,
same font manifestSHA71dda427260f58b318191af9eb459ea68eff8077d3d87131857c6fe222bca148.
ACTIVE session20661, log/private/tmp/full1105/run.log, output private/beta-kits/
full204-1105. First set terminal refusal, runner continues; no aggregate score.
Keep clean checkout/font inputs fixed, no concurrent REST image checker. Existing
runner uses one consumer and15second pacing; full6312 denominator preserved.

Read-only Spectrum Social pair inspection: default silhouette avatar differs
from source portrait. Main172:25154 imageSHA1a14d06291e681221b485c8fee7558e58fc1efddb
PNG10005B; instanceI172:25232;172:25154 usesdb16be120157a4a65ca145a91243952ca56e2f01
JPEG29369B. Both originals captured, SHA1 verified. Host172:25232 main172:25152,
setkeye4ccb12d8346b5ca53038ac4f2a807434f375111. hostOverrides records
Header/Avatar fills; instanceContent retains exact image paint. Generated child
keeps main/default. Current per-instance background-image route covers component
root only; nested text has source-bound demand routing but nested image lacks
that equivalent. New image-input routing must authenticate numeric child path,
main identity and revision, preserve caller override isolation and native
carriage; do not mutate shared default or match merely by layer name.
Evidence nested-image-override-1105/avatar-lineage.json. No code edits this turn.
Latest localSpectrum21/48; broad historical2679/6312(42.44%),reverseunqualified.
Next poll20661 and implement nested image carriage or independent reverse work
on writer; preserve full goal. No ownerwait, push or release.


## Experiment 1106 — qualify original-image descendant ownership

Broad20661 confirmed live on pinnedclean541abb861. Latest observed7/204done;
no aggregate score. Keep clean checkout fixed and no concurrent REST checker.
Writer source345ba8e56 adds source-image-control qualifier and three negative/
positive tests. Validates file/set/main/instance IDs, exact numeric child path
at every ancestor, matching source/instance node identity and type, no nested
instance boundary, supported frame/rectangle/ellipse target, and original image
projection through existing native-image-paint integrity/paint guards. Preserves
input objects and returns original data URL plus declared paint geometry.
No layer-name identity or shared-default mutation. Tests and focused strict
TypeScript covering BOTH new files pass (source-reference config alone would
not reach an unimported helper). Real saved Spectrum8Social targets all qualify.

This is prerequisite only: helper is NOT connected to proposal/emission yet.
No image override or new pass claimed. Next add finite image-input carrier with
source-bound target/revision and per-instance argument routing, including React
and native agreement and untouched default. Existing enum NONE validator only
admits dedicated text/shape paint controls, so do not bypass it with an ordinary
unqualified enum. Paint/enum combination tables already exist for caller routing.
Evidence image-target-qualification-1106; latest local21/48,broad42.44%,reverse
unqualified. No ownerwait, push or release; parked changes preserved.


## Experiment 1107 — finite source-image choice semantics

Broad20661 confirmed live, latest13/204done; clean541abb861 stays fixed. Writer
2b0f9184c adds source-image-input plan: same file/set/main/source-node/numeric
path owner required; stable finite choice IDs; identical choices deduplicate;
crop geometry participates in identity even with same original bytes; conflicting
caller observation refuses. Undefined selection returns no override, arbitrary
URLs/unknown values refuse. Every choice holds CSS original URL/declarations and
nativeImageFill projection. Selection returns a clone, protecting shared default.
Five control/input tests plus focused strict TypeScript pass. Saved realSpectrum
8Social targets produce oneFILLchoice and8exactcallerbindings. This is a plan,
NOT emitted React/native qualification; no new passes.

Next integrate dedicated finite image input into Part schema, optional enum NONE
validation and non-variant axes, then React module/inline wrapping and native
instance application. Existing textColorOverrideProp path is precedent, but
finite image choices need opaque selection->original image/crop map, not color
validation or arbitrary URL arguments. Native emit-figma-script has parked
unrelated changes: isolate exact edits/staging and retain them. Proposal must bind
numeric target + contract revision before supplying instance args; use existing
enumPropsByCombination where needed. Archive finite-image-input-1107.
Latest local21/48,broadhistorical42.44%,reverseunqualified. No ownerwait,push or
release; broad process remains active. Do not mutate its checkout or run another
REST image checker concurrently.

## 1108 — finite image contract and React rendering

Added optional, defaultless finite enum NONE image inputs on a unique owned
nested frame. Choices retain embedded original image data and crop CSS;
schema rejects open URLs, malformed geometry, mismatched quotes and undeclared
choices. Both React emitters apply the choice directly and preserve original
paint when omitted again. Browser pixels verify red -> blue -> red in both
emitters. Native, HTML and Web Components explicitly refuse pending support.

Validation: schema:fresh, source-reference TypeScript and 41 focused image/input/
text-color regressions pass. Importer is not wired; native instance application
and independent readback remain required. This adds no measured real-kit passes.
Archive: finite-image-react-1108. Broad run20661 remains active, latest23/204;
its clean541abb861 checkout is untouched. Latest completed broad remains
2679/6312 (42.44%), localSpectrum21/48, reverse unqualified. No owner wait.

Next: implement native image target application plus independent readback, then
bind qualified source demands to contract revision and numeric target paths.
Re-run the real Spectrum sample only after broad REST run finishes; never
splice focused gains into the broad score. Preserve parked instance-root paint,
degenerate stroke and package wiring changes.

## 1109 — native image writer and independent paint comparison primitives

Previous1108 was progress: committed finite React image control. Broad session20661
polled live this turn; latest28/204, immutable clean checkout remains untouched.
Added mapNativeImageArguments: finite literal, parent reference and lookup mapping,
omission preserves main, original bytes and inverse crop transform retained.
Native writer runtime validates every target before paint writes, refuses duplicate,
missing, wrong-type and nested-instance targets, requires exactly one opaque NORMAL
original image paint, preserves underlying solid paint, restores skipInvisible flag
on refusal and asset errors. Tests prove original bytes and main paint preservation.
Independent comparison requires separately observed original bytes plus scale/crop,
opacity, visibility, filters, blend and bindings. Wrong asset or placement refuses.
11 targeted tests and focused strict TypeScript pass. Archive native-image-control-1109.

These primitives are not yet connected to native emission/readback; keep the1108
NATIVE_IMAGE_OVERRIDE_NOT_YET_QUALIFIED guard until full observation is wired.
Next: NodeSpec imageTarget/instanceImages, map args in both instance paths, marker
capture and original image bytes collected from observed imageHash through Figma
getImageByHash(...).getBytesAsync(); independent graph verifier must authenticate
owner/path and exactly one target before using nativeImageOverrideMatches. Avoid
trusting writer hashes or expected bytes echoed into a readback. Then integrate
source demand inference and real Spectrum replay, after broad REST run terminates.
No new real-kit passes: latest local21/48, completed broad2679/6312=42.44%, reverse
unqualified. No owner wait or release. Parked unrelated files remain unchanged.

## 1110 — production native image instance lowering

Previous1109 was progress (tested writer/comparison primitives). Broad20661 is
confirmed live, latest31/204; clean benchmark checkout stays immutable.
Connected imageTarget/instanceImages in NodeSpec, both instance compilation paths,
NONE input consumption and generated writer. Native compilation now requires an
original projected image on every marked frame. Production-script mock test syncs
the main then parent and verifies untouched default instance versus selected crop,
original bytes, and linked instance ownership. Prepared-library/draft annotation
explicitly refuses NATIVE_IMAGE_READBACK_NOT_YET_QUALIFIED until independent image
observation is connected. This replaces the earlier blanket compile refusal but
is not live Figma qualification. 77 focused production/native-library/React/text
regressions and source-reference TypeScript pass. Archive native-image-lowering-1110.

Next connect independent observation: capture imageOverride markers and bytes from
observed paint imageHash via getImageByHash().getBytesAsync(), authenticate target
path and unique ownership, check selected image with nativeImageOverrideMatches,
and verify unchanged background paints/bindings. Only then remove draft guard.
Importer still needs source-demand wiring. No new real-kit passes, broad42.44%,
local21/48, reverse unqualified. No owner wait. All parked changes preserved.

## 1111 — independent native image readback connected

Previous1110 was progress: production instance writer connected. Broad20661
confirmed live this turn; latest32/204. Clean benchmark checkout untouched.
Native inventory now captures imageOverride metadata and original bytes from
observed imageHash via getImageByHash().getBytesAsync(), twice independently.
No expected image bytes enter the script. Missing/changing assets refuse;
8MiB per-asset,32MiB read budget and existing3MiB result cap remain enforced.
Async required for image reads. Duplicate hashes deduplicate fetches per sweep.
Verifier authenticates target metadata through existing contract-part graph,
counts exactly one owned instance target, verifies original bytes/crop plus
unchanged background paint and bindings. Default image paint stacks also checked.
Prepared-library blanket image refusal replaced by target/type checks. This is
structural verification, NOT live visual fidelity or release qualification.
47 image/native-library/React tests plus52 independent readback/graph/paint
regressions pass; source-reference TypeScript passes. Adversarial integration
changes bytes,marker,crop,underlay,binding on every observed image row and refuses.
Archive independent-image-readback-1111. Source inference is still unwired.

Next implement sourceImageInput into inferred dependency Part/imageOverride and
optional NONE enum, authenticated by contract revision and numeric child path;
route caller choices through finite enumPropsByCombination as appropriate.
Then replay realSpectrum from pinned captured assets after broad REST run ends.
Also obtain live writable Figma image-control readback/visual evidence before
claiming reverse qualification. No new real-kit passes: local21/48, completed
broad42.44%,reverseunqualified. No owner wait. Parked changes preserved.

## 1112 — captured image demand becomes an owned contract input

Previous1111 was progress: independent native image readback connected. Broad
20661 confirmed live this turn, latest36/204. No concurrent REST image checker.
proposeFromDump now accepts qualified imageDemands, revalidates file/set/main,
numeric path and source/instance IDs, assigns a finite optional NONE image input
on the actual owned part, and returns original choice/caller provenance sealed
with final contract revision. Stamped/supplied owners clear demands. Remaining
unconsumed targets refuse. This uses1110writer/1111readback-compatible vocabulary.
39 source image/input/text-color regressions and source-reference TypeScript pass.
Manual capturedSpectrum demand injection proves _Card Text Content authors
imageAvatarOverride, onechoice/eightcallers, source172:25154,path[0,0]. No live
writes. The diagnostic batch used generic defaults and refused parent48/120
sparse matrix; this is NOT the configured scoreboard replay or a score change.
Archive source-image-proposal-1112 includes script and provenance summary.

Next add automatic source-image demand census from direct instanceContent trees,
matching main set/key/component and original paint differences. Unsupported
nested owners must remain named limits without poisoning unrelated mains.
Then retain bindingsByContract through batch and route caller choices from exact
instance IDs/source paths to fixed props or enumPropsByCombination. The current
code does NOT yet discover or route those callers automatically. sourceImageInput
requires one owner; merged parts spanning distinct main IDs will need explicit
per-owner validation before choice unification, never name-based identity.
After routing, replay realSpectrum with existing configured replay options and
unchanged scorer once broad REST run ends. Latestlocal21/48,broad42.44%,reverse
unqualified. No new visual passes or owner wait. Parked changes preserved.

## 1113 — automatic image demand discovery and caller routing

Previous1112 was progress: demand-to-contract authoring. Broad20661 confirmed live,
latest42/204. Added census over direct captured instanceContent versus matching
main/key/component paint evidence. Qualified differences become image demands;
unavailable/unsupported originals emit batch notes, nested instance ownership
is not crossed. Batch prioritizes owners, retains final-revision image bindings,
and routes exact caller node/path choices as fixed props or enum combination
rows. Omitted caller values preserve the main image. Source dumps unchanged.
42 focused source-image/input/text-color tests and TypeScript pass. Fixed40 full
preparation:38prepared2refused, all40statuses/requesthashes/skipped lists exactly
match wrapper1104. No changed preparation evidence, no new visual qualification.

Captured realSpectrum diagnostic now discovers three child controls without
manual demand injection: imageAvatarOverride,imageProductBannerOverride,
imageProductImageOverride. Each has1choice/8callers; parent table routes8tuples
and omits40tuples. Explicit declared-drawn inspection of all captured48tuples
has no skips; this remains candidate evidence, not public admission or score.
Archive automatic-image-routing-1113 includes diagnostic and fixed40summary.

Next run configured realSpectrum consumer replay with unchanged scorer/fonts and
captured assets, preferably offline using existing source images if supported;
do not start another REST image checker while broad20661 runs. Check whether
Social/Product pixel failures improve; investigate remaining failures from
rendered evidence. New native path still needs live writable Figma visual/readback
qualification. Multi-main merged image demand owners remain an explicit current
sourceImageInput limitation. Broadlatestcompleted42.44%,local21/48,reverse
unqualified. No new score claim, owner wait, release or parked-file mutation.

## 1114 — unchanged-scorer offline Spectrum replay, image gain below pass bar

Previous1113 was progress: automatic image routing. Broad20661 polled live;
latest43/204. No concurrent Figma API traffic. New replay harness calls production
figmaToReact/checkGenerated while intercepting all fetches with captured1104
source bounds/PNGs; every unknown network endpoint refuses. Bounds before/after
and original content response SHA256 are identical. Source PNGs/content byte
parity checked after replay. Existing scorer and fonts unchanged. Receipt is
cached-source evidence, NOT a fresh live Figma measurement.
Result remains21PASS26FAIL1UNVERIFIED/48; no lost passes. Social default white
mismatch improves7.7146%->5.8200%; Product default25.0820%->11.0793%. Image paths
are visually corrected, but residual styling still exceeds5% and Product retains
text-color/size failures. Native reverse remains unqualified, completed broad42.44%.
Archive offline-spectrum-image-1114 contains replay harness/provenance/comparison.

Inspected actual Social consumer/source images: outer stroke and divider missing,
footer icons black instead of gray, header weight differs. Root contract carries
correct border tokens and generated --_stroke vars; inset box-shadow stroke may
be covered by full-bleed child backgrounds (needs DOM/paint verification).
Divider Container contract has direction column/align start but no display:flex;
its Divider child uses grow:true,basiszero,width100% with no height. This is a
concrete next geometry hypothesis to verify against source layout and CSS, then
fix generally and re-run cached scorer. Do not lower thresholds. Offline harness
is reusable for rapid local loops while full benchmark runs. No owner wait.

## 1115 — disjoint fixed/fill tuples retained; divider restored but offset persists

Previous1114 was progress: measured cached replay and inspected residuals.
Broad20661 confirmed live this turn, latest46/204. Corrected earlier hypothesis:
dividerContainer DOES emit display:flex. Its15FILLwidth rows were suppressed by
one separate FIXEDwidth row. Allow fixed-size evidence on non-FILL tuples;
placeLiteralTable now merges only disjoint same-axis tuples, still refusing
any overlap or different axis keys. Both React browser tests demonstrate100px
FILL versus50px FIXED and switching back; native compilation keeps the modes.
17 geometry/browser tests plus6 literal-table regressions pass, source-reference
and focused strict TypeScript pass. Fixed40:38prepared2refused, all40statuses,
requesthashes and skipped lists identical1113.

Cached source replay1115:21PASS26FAIL1UNVERIFIED, no lost passes. Divider is
restored, but Social default white mismatch WORSENS5.8200%->6.1772%, not a fidelity
gain. Source PNGs/content are byte-identical1114; scorer/fonts unchanged. Source
line y174 versus consumerline y173. Source TextContent instance172:25232 is280x174,
DividerContainer172:25233 y174 height1, Footer172:25235 y175 height58. Need measure
actual consumer child boxes/font metrics and account for1px difference generally;
do not add specimen-specific offsets. Root stroke still hidden/missing, icons
black vs gray, typography heavier. This is a partial structural fix with explicit
negative pixel evidence, NOT a new pass. Archive partial-cross-fill-1115 holds
replay/tests/comparison. Broadcompleted42.44%,reverseunqualified. No ownerwait.

Next inspect consumer TextContent bounds against captured174px, including style
and line-height rounding, then resolve root stroke painting over child backgrounds.
Reuse offline-source harness for immediate pixel feedback without REST contention.

## 1116 — foreground stroke survives ranked children: five new local passes

Previous1115 was progress with negative pixel evidence. Broad20661 confirmed live,
latest54/204; pinned541abb861 checkout remains untouched. Production DOM probe
shows TextContent172.78125px versus source174px, PostContent3x19.6px browser lines
58.78125px versus native60px. Do NOT add a1px specimen offset; line-height native
rounding needs wider evidence. Root stroke exists on::after and has1px/#3f3f3f,
but z-index:auto sits below generated positive child ranks. Earlier assumption
that the ring was missing or merely covered by ordinary children was incomplete.

Both React renderers now isolate foreground-stroke host stacks and place the
stroke at child-count+1, above generated1..N ranks, preserving dimensions and
external shadows.26 stroke pixel/regression tests include normal/reversed paint
order; source-reference TypeScript passes. Cached-source Spectrum replay1116:
26PASS21FAIL1UNVERIFIED/48, up from21/26/1. Five Horizontal variants now pass:
hover checkbox, selected, hover3actions, hover4actions, hoverMove. No lost passes.
Socialdefaultwhite6.1772%->5.0843%,black6.1803%->5.4905%, still FAIL. Identical
source PNG/content bytes and unchanged scorer/font manifest. This is local
cached-source progress, NOT fresh broad/unseen qualification. Broadcompleted
42.44%,reverseunqualified. Archive foreground-stroke-rank-1116.

Next inspect remaining Social text metrics and source-owned gray icon paints;
Product still has description color and sizing differences. Compare source versus
consumer layout rather than special-casing labels or scores. Keep reverse live
Figma image-control qualification and fullscope2203+28 intake coverage unfinished.
Offline replay harness enables local measurement without REST contention. No
owner wait, push, release or parked-file mutation.


## 1117 — component identity no longer disables the captured SCALE viewport

Previous check-in was no progress; resumed implementation and confirmed broad
20661 live through its session handle, latest68/204. Captured ThumbUp/Comment
have exact SCALE/SCALE geometry, but componentKey on their main parent was
missing from the inert-metadata allowlist. This discarded parentViewport and
therefore prevented existing single-ink currentColor promotion and keyed usage
ink carriage. Preserve the componentKey metadata without changing geometry
qualification or widening the override mechanism. Regression fails before fix;
34 scalable-path/direct-instance tests and source-reference TypeScript pass.

Cached-source Spectrum1117 remains26PASS21FAIL1UNVERIFIED/48, no verdict changes.
Both footer icons now receive source gray d1d1d1 through existing overrides.
Social default white5.084304%->4.724096%, black5.490497%->5.130288%: still FAIL
under unchanged5% bar. Inspected triptych confirms gray icons; residual text
and vertical geometry remain visible. All source PNG/content/bounds files are
byte-identical1116, fonts/scorer unchanged. Fixed40:38prepared2refused, all40
status/hash/skipped records identicalwrapper1104; preparation is not fidelity.
Archive component-key-viewport-1117 retains replay, comparison and checks.

Completed broad remains2679/6312(42.44%), reverse unqualified. No release or
owner wait. Next measure remaining typography/line-box differences using actual
source and consumer metrics; do not add specimen offsets or relax thresholds.
Preserve reverse live qualification and fullscope2203+28 intakes as unfinished.


## 1118 — measured native percentage line height adds eight local passes

Previous1117 was progress. Broad20661 live via handle, latest84/204. Desktop
Bridge roundtrip verified9ms in allowed Live Testing file. Native controlled
probe section164:75949 on page164:73045: two fonts (Source Sans Pro, Inter),
six fractional heights19.1/19.4/19.5/19.6/19.9/20.2, PIXELS versus PERCENT,
one/two/three lines.72 measured boxes show PERCENT rounds resolved pixels per
line:19.6 gives20/40/60. PIXELS preserves fractional advances and rounds total
bounds upward:19.6 gives20/40/59. Screenshot inspected; nodes remain in named
section away from existing content, at1200,4600. No source-kit writes.

Proposal minting now rounds PERCENT only; raw dump, PIXELS and AUTO behavior
remain unchanged. Tests cover both fonts, all six values and all three units.
Cached-source Spectrum1118:34PASS13FAIL1UNVERIFIED/48, eight new passes and no
lost passes versus1117. Seven Social states and Standard hover4Actions now pass.
Socialdefaultwhite4.724096%->1.638565%,black5.130288%->1.614040%. Source image/
content/bounds bytes and fonts/scorer unchanged. Fixed40 remains38prepared2
refused; only rows13/14 request hashes change, exactly four percentage token
values25.2->25,16.800001->17,28.800002->29,24.000002->24px. Not visual qualification.

Broader exact-proposal gate exposed7 failures among1076 tests: one stale source
regex expected selected===false though emitted Object.is is equivalent; replace
with rendered fallback/omission/caller-replacement assertions. Other six were
real native-pixel regressions from1116: unconditional foreground-stroke isolation
blocked composed-fill backdrop blending. Both React emitters now retain the
backdrop for composition hosts while preserving foreground child-count+1 rank.
Final focused suite88/88 passes including all seven failures, fill/native pixel
fixtures, stroke geometry and proposal regressions; source-reference tsc passes.
The entire1076 suite was not repeated: retain its failed run and the targeted
corrections as separate evidence. Final cached replay1118b is byte-identical in
all verdict/image records to1118,34/13/1; no new score inflation. Archive
percent-line-height-1118 contains native measurements/screenshot, both replays,
fixed40, failed broad tests and successful corrections.

Completed broad stays2679/6312(42.44%); reverse broadly unqualified. Next target
Product sizing/text color (eight failures), dragged geometry/framing, then
remaining Standard Move. Keep reverse live image-control qualification and
fullscope2203+28 intake coverage unfinished. No owner wait or release.


## 1119 — mixed absolute/flow source order restores Product icon

Previous1118 was progress. Broad20661 confirmed live by session handle; latest
96/204. Inspecting Product source PNG separately establishes triptych LEFT is
consumer, RIGHT is source. Earlier casual direction labels must not override
recorded source files. Product source description is AUTO,90px; consumer keeps
main PERCENT20px,100px. Source has explicit newline and blue range148..158
(54a3f6); consumer collapses whitespace and uses uniformb2b2b2. Checker already
reports text-color and320vs310px size mismatches. Captured instanceContent has
uniform AUTO but not range colors; raw cached bounds retain the full ranges.
Do not tune the main or scorer to make this instance pass.

Separate shared defect: normal DOM order does not reproduce Figma paint order
when an absolute first child overlaps a later in-flow child. Product Banner
painted over Product Image, hiding the Ai glyph. Qualified non-grid auto-layout
owners mixing captured absolute and flow siblings now retain explicit normal
child ranks, even without reversal. Instance ownership and existing refusal
checks stay intact. Both React rank plans retain composed-fill backdrops instead
of forcing isolation; native-pixel test with explicit normal rank passes48
comparisons.41 paint-order/stroke tests pass, including before-failing proposal
regression, and source-reference tsc passes.

Cached-source Spectrum1119 stays34PASS13FAIL1UNVERIFIED/48: zero verdict changes.
Productdefaultwhite11.566964%->10.058036%,black11.869420%->10.360491%; icon now
visible, text mismatches remain. Source bytes/fonts/scorer unchanged. No
composition hosts in these replay contracts, so final backdrop guard is inactive
for this replay and separately native-pixel tested. Fixed40 stays38prepared2
refused. Six requests17/18/28/29/33/36 differ only by explicit reversePaint:false
and materialization of existing default layout; no new refusal. Archive
mixed-position-paint-1119 holds reproduction, DOM/source evidence, comparisons,
checks and next implementation constraints in NEXT.md.

Next preserve exact per-range text appearance in capture, qualify finite
child-owned overrides including AUTO/newline behavior, and lower/read them on
both surfaces. This is required for Product; no inferred global styles or offsets.
Completed broad remains2679/6312(42.44%); reverse broadly unqualified, fullscope
2203+28 unfinished. No owner wait, push or release; parked changes untouched.


## 1120 — shared native/REST text appearance capture restores missing evidence

Previous1119 was progress. Broad20661 live by session handle, latest101/204.
Added complete source text appearance observation to DumpText, with exact
UTF16 character partition, font name/size/weight, original line-height and
letter-spacing units, case/decoration and qualified NORMAL solid paint. Shared
observer is embedded into the native dump reader; REST expands sparse indexed
style deltas over the node style. Missing/discontinuous/overlapping ranges,
split surrogate pairs, changed characters, unsupported paints/fonts/spacing
and budgets produce named source issues. No child override authority inferred.
Raw source fields remain untouched. Both readers attach sourceAppearance.

Forty capture/host-paint/uniform-font regressions pass and source-reference
TypeScript passes; embedded bundle freshness checked in parity test. On actual
cached Product source, all eight instance descriptions retain ranges0..148
grayb2b2b2 and148..158 blue54a3f6 with AUTO spacing, previously absent from dump.
Live native probe164:75974 under existing allowed section164:75949 captures
the same kinds of runs/newline and AUTO with actual Plugin API fontWeight and
range fills; screenshot inspected. Native letter spacing preserves PERCENT0,
REST preserves PIXELS0; equivalent units must be normalized only at lowering,
not relabeled as byte-identical transport evidence. No source-kit edits.

Capture is now wired, but proposal qualification, finite child-owned input,
React rendering and native write/readback remain to implement. Do NOT claim
Product passes or that raw styles may be applied by label/string match. Next
qualify file/main/instance/path plus exact characters, carry newline/AUTO and
range appearance through one finite child input, preserving the main. Archive
text-appearance-capture-1120 contains real-source observations, live probe,
regressions and the staged map patch. Parked degenerate-stroke changes in
map.ts remain unstaged; native emitter/package edits also untouched.

Latest measured local34/48; completed broad2679/6312(42.44%); reverse broadly
unqualified, fullscope2203+28 unfinished. No new rendering score, owner wait,
push or release. No fixed40 replay needed for this capture-only change: current
contract generation does not consume the additive observation yet.


## 1121 — exact source text appearance ownership and finite choices

Previous user check-in was status only, no implementation progress. Resumed
pending work and confirmed broad session20661 live; log reached111/204.
New source-text-appearance-control qualifies file/set/main key and node,
instance geometry/content root, inherited descendant IDs and numeric path.
Nested instance boundaries, authored contracts, stale characters and malformed
serialized appearances are rejected. Finite choices include exact characters
and complete validated runs; omission preserves the child main. Duplicate
callers are deterministic and conflicting choices are rejected. Six tests pass;
focused strict TypeScript passes with explicit Node types. Added this regression
to exact-proposal gate without staging the parked degenerate-stroke test.

Cached-source capture enrichment from original raw bounds recovers8 observed
appearances and qualifies8 Product demands, one choice and8 callers at exact
source path[2,1], node172:25172. Original dump and raw source hashes are in the
archived evidence; original files unchanged. This is cached evidence, not a new
live capture or a visual pass. Archive text-appearance-ownership-1121 contains
the probe, enriched dump, evidence, tests and isolated package patch.

Production proposal, revision-bound contract binding, both React renderers and
native write/readback remain unwired. Next connect this finite input to the
exact child text part and caller props, preserving main defaults and rejecting
stale revision/text combinations; then replay unchanged Spectrum sources.
Latest local34/48; completed broad2679/6312(42.44%); reverse broadly unqualified.
No owner wait, push or release. Original80% never-seen both-direction goal active.


## 1122 — browser-verified text appearance compiler/runtime

Previous1121 made implementation progress. Traced image input pipeline through
proposal, revision binding, schema and both React wrappers. Added shared text
appearance compiler and generated React runtime as the rendering foundation.
Compiler validates complete observations, retains exact characters, source font
family/weight, original fractional PIXELS spacing and rounded PERCENT line
height, paint alpha, case and decoration. AUTO maps to normal. Runtime rejects
unknown choices or mismatched resolved characters; omission returns original
child. Selected appearance replaces inner runs, explicitly sets the outer font
and line height to avoid the inherited line-box strut, and preserves newlines
with pre-wrap. No source kit edits or scorer adjustments.

Chromium probe of generated runtime demonstrates two colors on distinct lines,
AUTO replacing inherited40px line height, and omission restoring default text
and original height. Stale characters report a browser error and render no
stale content. Generated strict TS validation and focused strict source TS pass;
eight ownership/compiler/browser tests pass. Initial stale-text test expected a
rejected evaluation but React reports pageerror: test now observes that actual
error and empty rendered root. Archive text-appearance-react-runtime-1122.

Not yet wired into production emitters or contract schema. Next add the finite
contract field, exact proposal/caller revision binding, both React wrappers and
native write/readback (unsupported surfaces must refuse); then cached-source
Product replay. This is rendering mechanism evidence, not a Product score.
Completed broad2679/6312(42.44%), latest focused34/48, reverse unqualified.
No owner wait, push or release; parked files remain untouched.


## 1123 — finite contract appearance field and production React integration

Previous1122 made progress. Broad session20661 polled and remains live.
Added strict textAppearanceOverride contract field: finite optional NONE-bound
enum, unique owned text target, complete UTF16 run partition, source spacing
units/fonts/normal solid paint, no competing text-color control. This input is
excluded from variant axes. Both React emitters now compile and wrap the owned
text with the shared appearance runtime; literal, textByProp and bound content
expressions supply resolved characters independently. HTML, Web Components and
native Figma explicitly refuse the new field until implemented. No false native
fidelity claim. Core validation recognizes this declared child-owned input.

Actual emitted CSS-module and inline React compile and render in Chromium:
selected ranges preserve exact text and blue final range; omission restores
original red appearance. Schema rejects defaulted controls, invalid ranges and
competing text-color authority. Eighteen related image/text-color/appearance
regressions pass; source-reference TypeScript passes. Schema build and both
JSON projections regenerated; schema:fresh including site introspection passes.
Reference page documents behavior and unsupported surfaces. Archive
text-appearance-contract-1123 contains browser/regression/schema logs.

Next wire exact source demands into proposal and revision-bound caller inputs,
then replay Product against unchanged source bytes and thresholds. Native
write/readback remains required for bidirectional completion. No new scoreboard
measurement: broad2679/6312(42.44%), local34/48, reverse unqualified. No owner
wait, push or release. Parked native-paint hunks were excluded from this commit.


## 1124 — automatic text appearance proposal raises focused score34 to41

Previous1123 was progress. Source appearance census now feeds demanded main
selection, exact child-node qualification, finite property authoring and bindings
tied to the final contract revision. Caller routing checks owner file/set/main,
inherited numeric path, exact observed characters/ranges and the actual contract
choice. Uniform selections use ordinary props; differing or omitted callers use
complete enum combination tables. Omission preserves the main. Foreign demands,
stale revisions and changed caller characters are tested refusals. Eighteen
source-image, appearance ownership and production React tests pass; source-
reference TypeScript passes. No native support claim: explicit refusal remains.

Cached-source Spectrum1124 uses1121 capture-enriched dump from original raw
bounds. Production generation/checker yields41PASS6FAIL1UNVERIFIED/48, up7 from
34/13/1 with no lost passes. Seven Product states now pass. Productdefaultwhite
10.0580357143%->1.5841013825%,black10.3604910714%->1.5702764977%; text style
mismatch1->0. Triptych inspected: explicit newline/blue link and310px card now
match source; remaining text raster differences are not tuned. All60 source
PNGs byte-identical to1119, original bounds/content/fonts/scorer unchanged.
This is repeated cached-source progress, NOT new live or never-seen qualification.

Fixed40 all40 completed:38prepared2refused, every request hash/status identical
to1119. Archive text-appearance-proposal-1124 holds complete check artifacts,
replay/provenance, tests and fixed40 summary. Broad still2679/6312(42.44%) on
last completed run; in-progress1105 log122/204. Reverse broadly unqualified.
Next native text appearance write/readback and dragged geometry/framing failures;
Standard hover Move also remains5.41%. No owner wait, push or release.


## 1125 — native range writer and live readback preserve child ownership

Previous1124 made measured progress. Added finite native appearance argument
resolution and production NodeSpec target/caller routing. Writer resolves every
target without crossing instance owners, checks exact characters, preloads all
fonts, writes range font/spacing/case/decoration/normal paint, and reads every
range back including weight and complete UTF16 coverage. Silent native refusal
throws a named mismatch; skipInvisibleInstanceChildren restores on success or
failure. Omission does not write. This removes generic native refusal but does
not qualify the whole native library/inventory or update/recovery workflow.

Live bridge probe confirmed responsive in authorized Live Testing file. Created
section164:75975 at2300,4600 after reading page geometry and inspecting existing
section screenshot. Main164:75976 and omitted instance164:75978 keep original
red20px line height/100px box; selected164:75980 uses exact cached Product
appearance, gray0..148 and blue148..158, AUTO/90px box. Same production runtime
applied to an actual native instance; range readback succeeded. Screenshot
inspected, no overlap. Main and omission readbacks remain equal. This live probe
uses source-observed Product characters; source kits untouched.

Twenty native-image/text-appearance/React/ownership regressions pass, including
production compilation to selected instance only; source-reference TypeScript
passes. Negative controls reject absent, duplicate, nested and stale-text
targets, unavailable font and incomplete readback. Archive
text-appearance-native-1125 holds live code/result and tests. Native script
parked bound-paint hunks excluded from staging.

Next full production native build plus independent inventory range verification
and repeat/recovery; then remaining dragged geometry. Latest focused41/48,
broad2679/6312(42.44%), reverse broadly unqualified. No owner wait or release.


## 1126 — full generated native text property path and independent ranges

Previous1125 was progress. Broad20661 polled live. Full production child and
parent build scripts executed in authorized Live Testing. Child164:75983 has
TEXT Description defaultDefault; parent164:75987 contains omitted and selected
instances. Generated native TEXT property is applied before appearance. Selected
instanceI164:75990;164:75984 has exact158characters, SourceSansProRegular400,
AUTO spacing, gray0..148 and blue148..158; omittedI164:75988;164:75984 remains
Default with main appearance. Screenshot inspected. Repeated create-only script
skips existing parent without duplicates; this does NOT prove amend/recovery.

New independent collector captures complete styled ranges only for appearance-
marked text, with normal double-read drift protection. Verifier pairs inherited
source metadata/target, requires exactly one target, validates exact characters
and each range's font/weight/spacing/decoration/normal paint, and only then
permits those explicit appearance channels to differ from the main. Native
draft target kinds guarded. Eight focused tests pass, including incomplete/
tampered/changed ranges and between-read drift;35 existing prepared-library/
graph tests pass and source-reference TypeScript passes.

Shared page inventory hit existing byte limit; did not weaken it. Moved ONLY
new1126 probe host sections164:75985/164:75992 to new dedicated page164:75993
Text appearance qualification1126. Same collector returns10nodes with no
problems. Independent matcher accepts live selected ranges, rejects color
tamper, and confirms omitted ranges identical to main. Screenshot inspected
on dedicated page. Archive text-appearance-inventory-1126 includes scripts,
live independent receipt, explicit verified.json and tests. Token readback in
this focused inventory uses a stub (no token qualification claimed).

Separate discovered limit: production text width literal232 remains content-
sized (selected838x36), unlike manually constrained1125 (232x90). Therefore
layoutQualified:false; no reverse fidelity or broad score claimed. Next resolve
qualified native text sizing and exercise true amend/recovery plus library
verifier mutation controls. Focused41/48, broad2679/6312(42.44%), reverse broadly
unqualified. No owner wait, push or release; parked changes preserved.


## 1127 — native literal text width and live appearance update/restore

Previous1126 made progress. Bare text NodeSpec.lits.width was never applied in
createText path. Added explicit literalTextBox plan for bare owned text only,
with positive finite width and optional height; existing styled/token-sized
wrapper path unchanged. Fixed width with auto height writes HEIGHT, fixed both
axes writes NONE. Text node/metadata/TEXT property identity retained. Explicit
plan enters compiled data hash so existing nodes actually amend: runtime-only
first attempt was skipped unchanged and is not counted as success. Plans cover
normal and state variants. Independent verifier requires width/height/mode.

Production regression reproduces literal232px on native text without wrapper.
Forty-three sizing/range/library/graph tests pass; source-reference TS passes.
Live generated child amend keeps component164:75983/key, replacing its text
leaf with164:75994 at232x20 HEIGHT. Selected parent instance inherits232px width
and preserves source158characters/two ranges, now232x90. Parent default remains
Default232x20. Actual production parent updates blue->green->blue amend same
component164:75987/key, followed by unchanged repeat. Screenshots inspected at
each color. Final independent collector reads ten nodes, main and omitted at
232x20, selectedI164:76003;164:75994 at232x90 HEIGHT with two ranges.

Archive native-literal-text-box-1127 contains build/update scripts, amend/
repeat results, final independent inventory and tests. Probe only; no whole
Product reverse score or delivery-interruption recovery claim. Global
DS_CREATE_ONLY restored true after authorized probe amends. No source-kit edits.
Next integrate whole-library mutation controls/qualification and remaining
dragged geometry. Focused41/48, broad2679/6312(42.44%), reverse broadly
unqualified. No owner wait, push or release; parked native-paint hunks excluded.


## 1128 — full prepared-library appearance mutation controls

Previous1127 was progress. Broad session20661 confirmed live; log139/204.
Added complete prepared-library conformance fixture for literal-width text
appearance main, omitted instance and selected instance. It exercises real
prepared-library compilation, native inventory emission and the full independent
verifier rather than only the standalone range matcher. Initial compilation
refused all text literals under old ownership guard. Native draft now permits
ONLY width/height keys whose explicit literalTextBox exactly equals the
validated bare text sizing plan. Other styled/wrapped text limits remain.

Synthetic host lacked range APIs and textAutoResize inheritance; fixture mirrors
those only, based on1125-1127 live native measurements. This remains synthetic
structural evidence. Full verifier accepts valid library and rejects absent
ranges, altered color/weight/line height/partition, foreign marker/binding,
stale characters, changes to unchosen main/sibling paint, and width/mode
changes on every TEXT owner. Existing verifier already rejected those dimension
mutations, so no extra bypass or relaxed comparison was added.

Forty-four native library/graph/sizing/appearance regressions pass and source-
reference TypeScript passes. Archive text-appearance-library-1128 holds focused
and complete logs. No visual-score change: focused41/48, broad2679/6312(42.44%),
reverse broadly unqualified. Next remaining dragged geometry and independent
real-library reverse qualification; interruption recovery still unproven.
No owner wait, push or release; parked work unchanged.


## 1130 — repair pending mixed-plane alignment regression

Previous status turn yielded evidence that changes the next action: pending1129b
replay fell from41 to29 passes. Traced to carryObservedItemStretch rejecting
any layoutByCombination: restoring internal alignment suppressed independent
parent-owned FILL width, collapsing image planes. Removed that veto while
retaining captured allocation guards. Added complete/sparse tuple regressions
for frame/childless-rectangle mixtures with simultaneous item stretch.

Recorded-source replay1130 now42PASS5FAIL1UNVERIFIED/48, no lost baseline
passes; Standard Hover Checkbox+Move white5.40775->1.18276%, black5.40052->
1.17553%. All60 source PNGs identical. Inspected resulting triptych. Forty-nine
focused tests and source-reference TypeScript pass. No scorer change.

Fixed40 remains38prepared2refused, but request33 (Twilio Paste) changes16
Button content directions to row-reverse. This independent affected family
needs visual qualification before landing; source/test edits remain pending.
Archive layout-stretch-1130 preserves replay/checks/changed request. Broad
session20661 confirmed live; log158/204, last completed2679/6312(42.44%).
Reverse broadly unqualified. Next verify changed Button ordering, then land
the general fix and continue source-framing/reverse qualification. No owner
wait, push, release or parked-file changes.


## 1131 — affected Button order verified; existing empty icon named

Previous1130 was progress: repaired pending regression and exposed a changed
independent family. Inspected all16 changed Twilio Button tuples against raw
captured child order: label precedes suffix Icon in every source. Production
React emitter with full dependencies and generated token sheet confirms the
new ordering matches16/16. Baseline rendered icon before label. Browser also
shows Icon width0 in BOTH versions; this is an existing fidelity blocker,
not16 new passes. Font not installed in targeted harness, so no pixel claim.

An added reverse-order extension to the mixed rectangle test refused under
existing child-paint-order-owner-unqualified guard. Removed that extension,
retained guard unchanged; original complete/sparse stretch tests pass with
49 focused tests total. TypeScript passed1130; runtime code unchanged since.
Archive button-order-1131 preserves before/after screenshots, geometry, source
order assertions and failed/final test logs. Land general mixed-plane layout
and stretch fix locally; no push/release. Focused42/48, broad last completed
2679/6312(42.44%); reverse broadly unqualified. Broad20661 confirmed live,
log170/204. Next trace existing empty Icon and continue reverse/source-framing
qualification. No owner wait; parked changes preserved.


## 1132 — mixed slot selection loss reproduced independently

Previous1131 made progress: landed alignment fix with source-order proof.
Traced empty Button Icon through source and generated contract: merged Icon
contains169 Export,130 Search (bound to Icon),115 ArrowForward,15 Download
occurrences. Property default124:925 differs from first-selected sample Export.
applySlotDefaultContent chooses first instance and stores only Export as
sample; heterogeneous selections disable renderDefault. This is not a CSS
width failure: runtime content is absent. Do not fix by making Export universal.

Added pending generic two-child regression mixed-slot-selection.test.ts:
one swap-bound declared default and one fixed selection on another variant,
linked by keys with observed geometry. It fails with runtime IDs[] rather
than both children. No production behavior changed this turn; failing test
remains uncommitted to drive the repair. Archive mixed-slot-1132 records429
source observations and minimal reproduction. Next preserve keyed per-tuple
selected content under omitted-slot fallback while preserving replacement/
clearing semantics, then verify ink/size and both emitters. Focused42/48, broad
last completed42.44%, reverse unqualified. No owner wait/push/release.


## 1133 — mixed slot fallback implemented, pending full qualification

Previous1132 was progress: independent failing regression established selection
loss. Bare mixed INSTANCE_SWAP planes now reuse keyedInstanceReplacement on
copied observations with only mainComponent binding removed, retaining key
resolution and exact presence gates. Selected branches populate omitted-slot
fallback anatomy, explicit input replaces all branches and null clears them.
Single-identity behavior unchanged. Existing per-instance lowering handles
child size/paint. No global Export default invented.

Browser regression exercises A->B->A, replacement and null in both React
emitters. Canonical serialization initially reordered part keys against the
declared sample list and failed anatomy validation; sorted sample identities
to match canonical keys, without relaxing validator. Final57 tests and source-
reference TypeScript pass. Fixed40 stays38prepared2refused; only request33
changes. Generated Twilio browser inspection now16/16 icons width20, versus
0/16 before, with suffix order retained. Harness fonts/pixels unqualified;
this is content/geometry evidence, not16 additional scoreboard passes.

Archive mixed-slot-1133 includes generated request/browser evidence/checks.
Source/test changes remain pending. Next qualify captured per-variant paint
and whole pixel output, native fallback, and Storybook sample behavior:
story generation currently supplies the declared sample list explicitly,
which may show all alternatives rather than exercise omission. Broad20661
confirmed live this turn; last completed42.44%, focused42/48, reverse broadly
unqualified. No owner wait, push, release or parked-file mutation.


## 1134 — native fallback and omission stories, replay running

Previous1133 was progress. Native compile regression now proves exactly one
selected dependency per variant and no duplicated slotDefault sample. Both
React emitters retain omission/replacement/null behavior. Generated default
stories previously injected all sample alternatives (or placeholder text),
bypassing runtime selection; generateStories now leaves runtime default slots
omitted. Explicit replacement stories remain separate.

Production whole-library generation exposed in-memory part insertion order
versus canonical JSON order mismatch. Sort BOTH branch object and declared
sample list; no validator relaxation. Regression now exercises raw and
canonical proposals with component keys ordered differently from names.
124 broader regressions passed, source-reference TypeScript passed; final
raw/canonical/native/browser/story regression passes after ordering fix.

Recorded Twilio CodeBlock replay started from full1105 captured source and
dump, unknown network endpoints refused. First attempt failed the now-fixed
anatomy-order check. Current retry session3111 confirmed running; output
/private/tmp/twilio1134, not yet a verdict. Broad20661 also confirmed live.
Archive mixed-slot-1134 holds tests/replay script. Pending changes uncommitted
until replay verdict reviewed; preserve parked emitter changes. Focused42/48,
last completed broad42.44%, reverse broadly unqualified. Next collect replay
and inspect remaining per-variant ink; native test is compilation evidence,
not live Figma qualification. No owner wait, push or release.


## 1135 — mixed slot repair qualification checkpoint

Previous1134 made progress. Replay3111 completed: Twilio CodeBlock remains
0PASS4FAIL, all four white/black image metrics identical to pinned1105. All
four captured source PNGs unchanged. Missing parts remain1/2 per variant.
Refused Button Group prevents the repaired Button from appearing through
that composition; do not count direct16-icon improvement as composition passes.
Inspected single-line triptych: multiline code copied into single-line state,
missing Copy control and uncarried syntax ranges remain. Twilio font missing
in consumer is also named. No scorer/tolerance changes.

General mixed-slot repair is supported by direct before/after16 icons (0->20px),
raw/canonical regression, both React emitters replacement/null behavior, native
compile one-choice proof,124 broader regressions and additional slot/keyed
regressions. TypeScript passes. New regression added to exact-proposal gate;
parked degenerate-stroke package change excluded from index. Local commit
only; no push/release. Native live update and full unseen-kit qualification
remain unproven, as does per-variant icon ink (gray main versus white usage).

Archive mixed-slot-1135 holds completed replay and checks. Next address source-
bound icon ink or the CodeBlock text selection/omitted group boundary by
measured impact. Broad20661 confirmed live at start, last completed42.44%;
focusedSpectrum42/48, reverse broadly unqualified. No owner wait.


## 1136 — fixed text-box source capture; diagnosis corrected

Previous1135 was progress. Raw CodeBlock source disproves earlier text-selection
diagnosis: all four variants carry identical multiline characters bound to
Text. Single-line source has NONE resize, explicit FIXED vertical sizing,20px
height, horizontal FILL. Text height was excluded by both reader fixedSize
paths. Clipped one-line source is not evidence to replace its characters.

REST and native readers now capture explicitly FIXED text dimensions when
resize semantics agree (NONE width/height, HEIGHT width); FILL/HUG, rotated
boxes, absolute nodes and TRUNCATE remain excluded from this new path. REST
requires actual text/style evidence; default REST resize NONE remains valid.
Native uses local node dimensions, REST unrotated measured dimensions.
Twenty-six fixed-size tests pass including reader parity; source-reference
TypeScript passes. Mock text geometry needed explicit getter values because
mock getters synthesize glyph dimensions; this is capture parity, not live
text clipping qualification. Archive fixed-text-box-1136 holds checks.

Next carry fixed text dimensions and source newline/clipping behavior into
React/native safely, then replay the same CodeBlock source. No visual-score
change claimed. Focused42/48, broad last completed42.44%, reverse unqualified.
Broad20661 confirmed live, log198/204. Parked degenerate stroke map hunk and
other parked work preserved. No owner wait/push/release.


## 1137 — fixed text geometry improves pixels; broad run regressed

Previous1136 made progress. TEXT parts now use existing mintFixedSize carriers.
Captured NONE resize with a fixed height retains pre-wrap and hidden vertical
overflow, carrying newline and viewport rather than changing characters.
Both React emitters preserve20/60px sizes through Short->Tall->Short; native
compiled specs carry20/60px fixedHeight, clipping and original characters.
Legacy width test updated: explicit32px FIXED now adds width/shrink tokens;
all other contract fields match legacy. Forty-one relevant tests and source-
reference TypeScript pass. No native-live claim.

Recorded-source replay enriched ONLY two fixed text heights through current
REST mapper from saved raw response. Four source PNGs byte-identical.
Single-line white diffs53.77225->2.45614%,53.89609->2.73684%; size mismatches
removed, multiline metrics unchanged. Inspected triptych. Still0/4 overall
because missing controls/fonts and syntax colors remain. Archive
fixed-text-render-1137 holds exact input enrichment and check artifacts.

Broad20661 terminal success:204sets complete on pinned541abb86185e.
2363PASS2821FAIL1128UNVERIFIED/6312=37.4366%,39passing sets. This supersedes
42.44% as latest completed score; pinned run predates local repairs and is
not a current-head claim. Compared1044:27gains,343losses, net-316. Largest
losses:shadcn Button Group Icon Button Nova191->0;Ant Treenode75->0;M3
vertical navigation48->18. First two dominated by missing icons. Reverse
still broadly unqualified; never-seen80% goal not met. Next prioritize those
missing-icon regressions with fixed-source before/after comparison. No
owner wait, push or release. Parked modifications unchanged.


## 1138 — all266 missing-icon regressions recovered on current code

Previous1137 was progress and a completed broad measurement changed priorities.
Compared1044 versus1105 raw dumps: Nova differs only by193 componentKey
additions; Treenode only377 componentKey additions. All192+75 source exports
byte-identical between those runs. Pinned1105 lost scalable drawing viewport
and color/size authority. Existing local1117 fd6e1ac43 already fixes the
componentKey metadata guard; current generated requests restore viewport and
size/color channels. No new speculative importer patch needed.

Fresh current-code offline replays against1105 inputs/source images completed:
Nova191PASS1FAIL/192 (from0PASS); Treenode75PASS/75 (from0PASS). All267 source
PNGs unchanged in replays. Inspected icon and full tree triptychs. Nova's one
residual miss remains black-background5.16529%; no thresholds altered. This
recovers266 previously lost passes, matching1044 for these two families.
Do not relabel the old full-run score as a newly measured current-head score.
Latest FULL remains2363/6312(37.44%) on541abb; targeted current266/267.

Archive icon-recovery-1138 stores comparisons and complete checks. Started
third-largest regression M3 vertical nav48->18 as recorded-source replay
/private/tmp/rail1138, session16140 running. Next inspect that result and
remaining baseline losses. Reverse and never-seen80% qualification remain
unproven. No owner wait, push/release, scorer change or parked-file mutation.


## 1139 — all343 baseline losses recovered; complete recorded-source replays

Previous status turn completed remaining two replay lanes (both exit0), changing
the next action from regression recovery to remaining independent defects. M3
vertical nav48/48, BaseUI Button15/15, Attachment Card9/12. Ten smaller families
add81/121, recovering the final28losses. Together with1138 this is419PASS/463
selected variants, recovering343/343 previously lost passes. It does not prove
a new broad score or unseen-kit generalization. Latest full remains2363/6312
(37.44%) on541abb; reverse broadly unqualified. No threshold changes.

Archive regression-recovery-1139 retains13 complete check directories, requests,
replay scripts, provenance, summaries and both terminal lane results. Verified
all served source hashes against retained original files; these are cached-source
replays, not fresh live captures. Prior Nova/Treenode evidence stays in1138.

## 1140 — installed CLI smoke passes; remaining Input focus boundary diagnosed

At ab46eb1d7 plus preserved parked changes, the installed CLI smoke passes
from an empty directory: packed install, clean consumer/build, frozen Badge pin,
explicit Public Sans loading, all10UNVERIFIED without source token, NOT CHECKED
without Chromium, wrong-font refusal. No live design qualification inferred.
Command: npm run cli:figma-to-react:smoke:check -- --keep (Node20.19.4), exit0.
Log archived alongside1139. Kept install:
/private/var/folders/dx/kt5qryjx605f2md58m5cg3n80000gn/T/cli-figma-to-react-smoke-RpVT3g

BaseUI Input remaining6/12 misses all cite state-unreachable:focus-visible.
Source inspection locates intentional void-element reroot: inferred input with
child anatomy becomes div with a review note. A tabindex patch would only make
a wrapper focusable, not establish an actual editable input. No such workaround
applied. Next investigate a source-supported native-control mapping or authored
semantic input through existing contract/manifest channels, and independently
qualify live packaged journeys. The full bidirectional80% goal remains intact;
assisted-preview recommendation is not a replacement finish line. No owner wait,
push, publication, scorer change or parked-file edits.


## 1141 — mixed instance placement recovers8 navigation states

Previous1140 made progress (installed CLI smoke and completed regression archive).
Input control inference lacks an authored native-control mapping; no tabindex
workaround applied. Remaining M3 horizontal navigation instead has fully
captured geometry: small Badges instances absolute LEFT/TOP, large in flow.
Existing placement wrapper rejected all mixed component usages, leaving small
badges in flow after the label and expanding the root.

Component wrappers now use existing conditional placement for a complete axis
domain (or its explicit visibility gate). Absolute planes carry measured offsets;
in-flow planes keep child sizing. Require LEFT/TOP constraints, captured flow
parent, and no parent-filling in-flow dimension; missing evidence retains named
refusal. No child internals, schema or scoring changes.

Recorded-source M3 horizontal nav replay improves16PASS8FAIL to24PASS/24.
Original source PNGs byte-identical; inspected small-selected triptych, badge
now correctly overlays icon and root width matches. Archive mixed-placement-1141
holds source comparison, requests, check and replay. Twenty-five placement/slot
tests pass, including both React emitters overlay->flow->absent->overlay, native
compiled placement, and fill/SCALE/unknown-parent negative controls. TypeScript
passes. Cached replay is not unseen/live qualification. Fixed40 impact audit
remains next before broader promotion; full score still37.44% on older541abb,
reverse broadly unqualified. No owner wait, push/publication or parked edits.


## 1142 — fixed40 unchanged; full204 impact isolated to3 requests

Previous1141 made progress: navigation24/24 with unchanged source/scorer.
Compared pinned35f2d8ef3 importer through an asserted Vite pre-transform against
82d632f6b, all other modules identical. Fixed40 recorded sources:38prepared,
2refused on both; all request hashes and refusals identical. Navigation positive
control changes as expected; final current request equals1141 scored request,
including final fill guard. No fresh full visual score inferred.

Extended comparison to204 recorded dumps:168prepare,36refuse identically; only
3requests change: BaseUI Tooltip, M3 horizontalnav, Obra HorizontalFieldNova.
Other201 request/status outputs identical. This is request preparation, not
package success or a score. All original source hashes unchanged.

Paired Tooltip package/browser replays finish0PASS2FAIL both, identical metrics
and reasons: missing Arrow, bottom height32vs37. Changed wrapper is gated by
ShowArrow, so this default capture does not qualify visible-arrow placement.
HorizontalField has no retained bounds/images and cannot be visually replayed.
Both before/after package generation refuse with the EXACT same missing shared
font-size/line-height token references across AvatarPlaceholder, SelectCombobox,
InputNova and dependent parent. New high-impact next investigation: shared text
token allocation colliding across composed dependencies. No synthetic capture or
font substitution attempted. Archive placement-impact-1142 contains scripts,
loader assertions, all request snapshots, summaries, Tooltip checks and matched
package refusals. Broad remains2363/6312(37.44%) on541abb; reverse unqualified.
No owner wait, push/publication, scorer change or parked-file modification.


## 1143 — component-scoped typography tables unblock composed package

Previous1142 made progress: completed impact audit exposed a package refusal.
HorizontalField dependencies minted variant-dependent typography under shared
imported.text style prefixes. Another component's uniform style leaf replaced
the table during library assembly, leaving unresolved size placeholders.

Minted variant-dependent style tables now include their component namespace.
Uniform named styles keep the shared path; per-leaf published style identity and
values remain intact. Regression merges two incompatible variant tables and a
uniform style in both orders and resolves every reference/value/identity. Seven
keyed-style tests and the complete mint:check invariants pass; source-reference
TypeScript passes. Fixed40 plus navigation control: every request and refusal
identical to1142 (38prepare2refuse); no score claim from preparation.

HorizontalField now packages successfully (previously missing font-size and
line-height tokens). Clean installed consumer builds and renders12 variants;
checker still FAIL with children-slot-discarded. All12 visual verdicts UNVERIFIED
(no source captures/token), no manufactured PASS. The missing-token blocker is
removed, not the whole composition qualification. Archive typography-scope-1143
holds package, consumer receipt/captures, source request, tests and fixed40 audit.
Next resolve the measured discarded caller slot and obtain source comparison
for the newly runnable composition. Full remains2363/6312(37.44%) on older541abb;
reverse broadly unqualified. No owner wait, push/publication or parked edits.


## 1144 — live composition4/12; distinguish caller content from omitted defaults

Previous1143 made progress: typography repair unblocked package generation.
Rechecked children-slot-discarded: legacy children probe requires its marker in
EVERY variant, but this contract's children slot is visible only for Checkbox.
Independent actual-generated-React probe exercises checkbox/textValue/radio/
checkbox, both states, replacement/null/false/empty:32transitions pass exactly
according to that visibility. Existing scorer and failure are unchanged; this
is behavioral diagnosis, not a revised acceptance grade. Named radioOptions
probe in the existing receipt independently passes both radio cells.

Ran existing checker with authenticated live source and provisioned fonts against
the newly packaged HorizontalField.4PASS8FAIL/12, no unverified variants; set
still FAIL with children-slot-discarded. Passing textValue(default/error),
select(error),slider(error). Remaining: select/slider default image miss,
textarea resize-handle content/framing, radio/checkbox missing default options
and resulting height loss. Inspected checkbox triptych: React only shows Label
where source shows three options. Captures retained in field-live-1144.

Root cause located in native SLOT importer: multi-instance drawn children are
explicitly omitted, single instance only becomes sample defaultContent, and
frame/text content is named but not carried. Source Checkbox options SLOT holds
three identity-keyed CheckboxGroup instances with Option1/2/3 text targets and
fixed24px heights; Radio options is analogous. Caller replacement behavior is
working; omitted caller content needs source-backed fallback anatomy using
existing renderDefault semantics, preserving replacement/clearing. That is next,
with native and React checks before claims. New4/12 live sample does not replace
older full37.44%; reverse unqualified. No scorer change, owner wait, push or
release. Parked changes preserved.


## 1145 — native slot fallback recovers4 composed states

Previous1144 made progress: live source isolated missing omitted defaults.
Native SLOT inversion now carries observed keyed instance children through
ordinary buildPart, preserving child inputs and text overrides. Explicit
renderDefault uses matching defaultContent plus fallback anatomy; callers still
replace or clear. Require stable source order, linked keys, no absolute child
and representable default props. Frames/non-keyed or unsupported defaults keep
existing named limits. Padded source-order keys preserve order through canonical
serialization; arbitrary label sorting cannot reorder instances.

Initial ordering attempt used slot childOrder, which schema refuses; discarded
that attempt and reran verification with source-order keys, no schema changes.
Twenty-seven slot regressions pass, including both React emitters, two keyed
children, conditional second child, nonalphabetical source order, replacement,
null/false/empty clearing and restoration. Native compile preserves1/2 actual
instances without duplicate samples. Source-reference TypeScript passes.

Final replay against1144 source captures:8PASS4FAIL/12, from4PASS8FAIL. All four
radio/checkbox states now pass and option labels remain present. Source PNGs
byte-identical; inspected checkbox triptych. Set still fails legacy children
probe; scorer unchanged. Remaining visual misses: select/slider default and
textarea resize-handle/framing. Fixed40 remains38prepared2refused, every request
and navigation control unchanged. Archive native-slot-defaults-1145 holds final
checks, scripts, source comparison and tests. No live native claim or full-score
replacement; broad37.44% on older541abb, reverse unqualified. No owner wait,
push/publication or parked-file edits. Next address the remaining composed
visual misses and extend native slot qualification.


## 1146 — independent text visibility recovers Select default

Previous1145 made progress: native slot defaults yielded8/12 composed states.
Select prefix exists only on Lines=1Line and binds ShowPrepend on18occurrences.
Six extra-small occurrences are unbound and captured hidden. Old TEXT handling
kept structural presence but refused the independent Boolean on partial rows;
parent ShowPrepend=false disappeared because the child exposed no such prop.

Separate captured unbound hidden planes from the remaining bound TEXT before
inversion. For a uniform visibility binding, exact presence may use a single-
axis complete truth table, leaving visibleWhen for the Boolean. Missing/mixed
bindings and unproven presence retain refusal. First attempted matrix minimum2
did not resolve the real sample; final minimum1 and static-hidden separation
verified. No name-specific converter or scorer change.

Final same-source replay9PASS3FAIL/12 (from8/12); Select default passes, all other
verdicts retained. Source PNGs identical; inspected triptych.31text/presence
regressions pass, covering Boolean omission/true/false, absent and static-hidden
planes, both React emitters, restoration and native compiled presence. TypeScript
passes. Existing set-level children warning unchanged.

Fixed40 remains38prepared2refused; requests28(Fluent),32(Attachment),33(Twilio),
36(USWDS) change; remaining36 and navigation control identical. These four need
targeted paired visual replay before broader promotion. Archive text-visibility-
1146 holds final source check and fixed40 hashes/requests/tests. Full remains
37.44% on older541abb, reverse broadly unqualified. No owner wait, push/release
or parked-file modification. Next qualify the four changed fixed40 requests,
then remaining textarea/slider composition misses.


## 1147 — paired visibility regression qualification

Previous turn was an owner status check, not implementation progress. Re-polled
both1147 process handles: terminal exit0. Completed before14467ccda importer
overlay versus current84cf3eccf with the other modules held constant.

The four changed fixed40 requests retain every variant verdict: Fluent0/2,
Attachment9/12, Twilio0/4, USWDS4/4, totaling13PASS9FAIL with no unverified.
All126 comparison PNGs are byte-identical and all receipt cases are identical.
Twilio uses its full204-1105 retained capture because the fixed40 capture was
incomplete; this is explicitly recorded in jobs.json, not a fresh fixed40 run.
The replay rejects unknown network requests and retains source provenance.
Archive visibility-regression-1147 contains paired scripts, receipts, logs,
source hashes and comparison.json. No scorer or product code changed.

This closes the targeted visual regression obligation from1146; it does not
replace the broad37.44% score or qualify the reverse direction. The full80%
unseen-kit goal in both directions remains active. No owner wait, push or
release. Next investigate the remaining Slider geometry and textarea misses,
then use the existing clean-install smoke path to qualify a tester journey.


## 1148 — mixed outline diagnosis; regressing prototype withdrawn

Previous1147 completed paired visibility qualification. Inspected the current
Slider source: Value is RECTANGLE in two Default states and VECTOR/path in
four range states. invertNodeShape explicitly drops mixed rect/path kinds;
this explains missing geometry, rather than the initially suspected radii.

Tried complete single-axis shape-kind partitions using existing mergeOcc
branches. Same-source composed replay regressed9/12 to8/12: Slider default
white/black differences9.87/9.50%, error5.53/5.27%. Generated rectangles gained
dimensions but remained in flow. A synthetic both-emitter transition test also
found two visible children instead of one; missing-capture negative passed.
The candidate therefore does not qualify. Copied candidate, fixture, logs and
replay receipts to mixed-outline-diagnosis-1148 and restored the exact prior
importer; removed only the newly created test from the checkout. No failing
prototype is promoted and no scorer changed.

Next fix requires independent source-presence and free-parent coordinate
ownership before heterogeneous outline carriage, including rectangle/path
transitions and caller overrides. Current qualified composed result remains
9/12; broad37.44% on older revision and reverse unqualified remain unchanged.
No owner wait or release; parked changes preserved.


## 1149 — preserve mixed outlines and proportional rectangle geometry

Previous1148 exposed mixed rect/path loss and withdrew a regressing prototype.
Corrected its visibility diagnosis: the synthetic test counted the zero-size
SVG clip-definition element as another visible part. Actual branch presence
was correct. Test now counts painted extents, preserving transition assertions.

Partition fully captured leaf RECTANGLE/rect and VECTOR/path occurrences when
a complete enum axis proves mutually exclusive source kinds. In the plain
rectangle branch, try the captured SCALE geometry carrier before minting fixed
dimensions; retain previous fallback when its source/ownership proof refuses.
This fixes the competing in-flow size that prevented proportional placement.
No component names, inferred paths, source edits or scorer changes.

Same-source composition improves9PASS3FAIL to10PASS2FAIL/12: both Slider states
pass. All14 original Figma PNGs identical; inspected default Slider triptych.
Remaining textarea misses and set-level children warning stay named.57focused
geometry tests pass; source-reference TypeScript passes. Test includes both
React emitters, rectangle/path/restored transitions, native presence and missing
capture negative.

Fixed40 remains38prepared2refused; requests21 and33 change, other38 and the
navigation control unchanged. Those two need paired visual qualification next.
Archive mixed-outline-1149 contains replay, source hashes, tests and audit.
Broad37.44% on older revision and reverse unqualified are unchanged. No owner
wait, push or release; parked files preserved.


## 1150 — paired outline qualification in progress

Previous1149 landed measured composition improvement10/12. Started paired
HeroUI21 and Twilio33 replay against d09719c15 importer versus8662eecf4, with
other modules held constant. Both fixed40 sources lack complete retained
captures, so both pairs explicitly use full204-1105 recorded inputs instead.
HeroUI finished0PASS2FAIL on each side, identical verdicts and all comparison
PNGs. Existing width211 versus200 mismatch remains.

Twilio jobs remain live: tool sessions67504(before) and14265(after), each
confirmed running a CPU-active Vite clean-consumer build. Do not restart them.
Working evidence /private/tmp/geometry1150 includes scripts, pinned importer,
job manifest and HeroUI comparison. Complete and archive this pair next.

Independent read-only textarea diagnosis: Resizable VECTOR has source stroke
paint and RIGHT/BOTTOM7x7 placement but no captured shape; dump explicitly
reports stroke-svg-native-context-unqualified. mapStrokeSvgShape requires
SCALE/SCALE and a free un-stroked parent. This needs proper source geometry
and coordinate ownership, not a guessed resize glyph or relaxed content check.
No converter changes this turn; full37.44%, composition10/12 and reverse
unqualified unchanged. No owner wait or release.


## 1151 — outline regression closed; live textarea geometry evidence

Previous1150 was a verified wait with source diagnosis. Re-polled both existing
handles: terminal exit0. HeroUI0/2 and Twilio0/4 retain identical verdicts and
cases before/after8662eecf4. All40 paired PNGs identical. Both use explicitly
recorded full204-1105 sources because fixed40 retained captures were incomplete.
Archive outline-regression-1151 closes the1149 targeted replay obligation; it
does not replace full benchmark measurement.

Read-only Figma REST capture of1953:11725 with geometry=paths confirms its
Resizable child1953:11726 is7x7, CENTER stroke1, RIGHT/BOTTOM anchored, with
no fill paths and one painted stroke outline. Source lacks cap/join metadata.
Separate SVG export is8x8 with stroke-width1.038 and rescaled centerline. It is
not interchangeable with the local native shape; no invented cap/join or
inverse-scaling approximation was introduced. Archive textarea-source-1151
contains both live sources and SHA256 provenance. Next establish native local
centerline evidence and carry RIGHT/BOTTOM anchoring through both emitters.

No product edits this turn. Composition remains10/12; broad37.44% on older
revision, reverse unqualified. No owner wait, publication or parked edits.


## 1152 — exact native textarea centerline established

Previous1151 closed outline regression and captured REST/SVG disagreement.
Read all seven source Resizable VECTOR nodes through Figma Plugin API, without
mutating the file. Native data agrees across every variant:7x7, centerline
M0,7 L7,0 M4,7 L7,4; NONE cap, MITER join, miterLimit4, CENTER stroke1.
Native MAX/MAX constraints correspond to captured RIGHT/BOTTOM; location308,64
in320x76 parent leaves5px right/bottom. Show resizable visibility reference
and stroke variable identity are present. Archive textarea-native-1152 holds
full native paths/network/metadata, source hash and implementation requirements.

This resolves missing source knowledge, not rendering. Existing StrokedPath
schema only supports SCALE/STRETCH constraints (explicit constraints restricted
to zero-height strokes), and native placement requires a free parent viewport.
Need independent fixed local stroke geometry and source anchoring, with parent
auto-layout/border ownership proven; simply relaxing mapStrokeSvgShape would
misrepresent the shape in downstream emitters. No source-specific glyph or
rescaled SVG substitute. Next implement and test that common carrier.

No product edits or score changes: composition10/12, broad37.44% on older
revision, reverse unqualified. No owner wait, release or parked-file edits.


## 1153 — fixed-anchor stroke rendering carrier

Previous1152 established exact native geometry. Extend StrokedPath constraints
for positive-height fixed outlines with native MIN/MAX/CENTER anchoring on
both axes. Preserve existing implicit SCALE and zero-height SCALE/STRETCH
behavior; mixed fixed/stretch allocation remains refused. SVG paints the
original local centerline at fixed size inside a CSS-positioned local viewport,
so parent resize moves its anchor without scaling its geometry or stroke.
Both emitters use the same existing strokedPathSvg lowering. Native compiled
shape retains the exact native constraint names for the existing application
path. JSON schemas regenerated from Zod, no scoring change.

Actual generated React tests cover both emitters at320x76,480x120,then restore,
for MIN/MAX/CENTER anchors, unchanged7x7 extents and1px stroke. Native compile
retains each constraint pair.20stroke regressions pass, schema freshness and
source-reference TypeScript pass after rebuilding schema dist (initial type
failures were stale generated schema types). Archive anchored-stroke-carrier-
1153 preserves tests/logs.

This is the rendering prerequisite, not recovered textarea qualification:
source mapper/native capture, importer inversion and padded/auto-layout parent
coordinate ownership still need integration and live readback. No invented
centerline, score increase, release or parked-file edit. Broad37.44%, selected
composition10/12, reverse unqualified unchanged. No owner wait.


## 1154 — native anchored stroke capture and importer integration

Previous1153 added the fixed-anchor renderer. Native dump now recognizes
positive-height MIN/MAX/CENTER strokes in free FRAME/COMPONENT parents while
retaining the original strict paint/path/affine checks. Anchored placement
can coexist with parent borders/clipping; proportional capture retains its
previous restrictions. Mixed fixed/proportional constraints remain refused.

Importer cross-checks captured stroke viewport, dimensions, offsets and native
constraints against the independently captured absolute box. It gives placement
to an outer absolute wrapper and the original centerline to a fixed local
stroke viewport. Token holders and visibility stay on the original ink part;
no outline, stroke width or coordinate is approximated. Source-basis conflicts
refuse by name.21stroke regressions pass, including both React emitters resizing
a bordered320x76 parent to400x100 and back,5px right/bottom offsets,7x7 geometry,
native compile, capture refusals and conflicting evidence. TypeScript passes.

Diagnostic native-enriched replay11PASS0FAIL1UNVERIFIED/12, reproduced after
source-consistency guard. Both textarea handles are present; error state passes.
Default remains unverified due existing render-export-overlap-mismatch. All14
source PNGs unchanged; inspected error triptych. Legacy set children warning
remains. Archive native-anchor-integration-1154 includes original source pointer,
seven-node native enrichment provenance, both replays and tests. This is NOT a
REST-only first-pass result: automated native supplement acquisition and live
native round-trip remain to qualify. Existing REST composition stays10/12 and
broad37.44%; reverse unqualified. No owner wait, release or parked changes.


## 1155 — bounded canonical capture executes live

Previous1154 integrated native anchored geometry with proposal. Attempted the
normal full plugin capture on one source page: unminified request rejected
HTTP413, minified85k characters rejected by use_figma50k limit. Neither ran
or changed canvas nodes. Added buildNativeStrokeCapture: bounded read-only
script generated from the canonical dumpStrokedPath and parser declarations,
with file identity, unique source IDs and128node/50k budgets checked. No copy
of the shape algorithm, synthesized data or source-specific geometry.

The generated6807character script executed live in the source Figma file and
returned all seven canonical stroke shapes without hand assembly. All seven
are identical to1154 diagnostic shapes. Receipt includes native parent IDs,
affine/local dimensions, stroke metadata and explicit named failures. Two
request/failure-isolation tests and source-reference TypeScript pass. Archive
bounded-native-capture-1155 contains live receipt, generated code, comparison
and checks.

This qualifies bounded acquisition, not the full automated import journey:
receipt validation/application and CLI exposure remain, followed by live
editable native verification. REST-only composition10/12; native-assisted
diagnostic11PASS1UNVERIFIED; broad37.44%, reverse unqualified unchanged. No
owner wait, publication or parked-file edit.


## 1156 — source-matched native receipt application in CLI

Previous1155 qualified bounded acquisition. Added atomic application of native
stroke receipts to a copy of the original dump. File/node identity, uniqueness,
parent/local geometry, shape bounds, stroke weight/alignment and resolved paint
must match. Conflicting existing shapes and malformed captures refuse; original
input remains unchanged. Applied observations retain receipt hash and node IDs.

Shared command now accepts --native-strokes in repository and installed CLI
entrypoints, saves native-stroke-dump.json and native-stroke-receipt.json, and
uses the resulting input for generation and unchanged checking. Capture still
requires a Figma bridge; documented explicitly in PREVIEW. No unattended-native
acquisition or REST-only claim. Nine validator/CLI tests pass, including stale
geometry/paint, duplicate IDs, wrong file, missing filename and input immutability.
TypeScript and CLI build pass; repository missing-flag invocation exits2.

Full shared command replay applied all seven live1155 records automatically,
packed/installed/built the generated consumer and reproduced11PASS0FAIL1UNVERIFIED
with the same recorded source images. Exit1 correctly retains set-level
children-slot-discarded; default textarea remains framing-unverified. No manual
geometry assembly. Archive native-stroke-cli-1156 contains output, receipts,
checks and command result. Next qualify editable native output/live readback
and remaining framing issue. Broad37.44%, REST composition10/12 and reverse
unqualified unchanged. No owner wait, publication or parked-file modification.

## 1157 — generated textarea verified in live Figma

Executed the actual native emitter from the1156 CLI request in LiveTesting.
Seven variants created in set164:77073, section164:77074, page164:77038.
Two initial invocations omitted or supplied the wrong minted token subtree;
inspected and removed their exact empty pages and orphan components. Correct
invocation supplies request.tokens.semantic as buildComponentScript argument4.
The desktop bridge executes the full generated script without the other tool's
50k request limit. No hand-built substitute nodes.

Live readback confirms all seven native VECTOR paths match the source centerline,
7x7 dimensions, stroke1 and bound stroke variables; Boolean visibility references
remain editable. Seven temporary instances each resize320x76 to400x100 and back:
ink stays7x7 and5px from right/bottom, hiding/restoring through Show resizable works.
All temporary instances removed. Final section screenshot inspected: seven ordered
states, handles visible, no overlap. Archive native-live-1157 contains generated
script, compiled data, creation/readback/resize receipts and final screenshot.

This qualifies the anchored-stroke native behavior, not a broad reverse score or
an exact full-component image comparison. Broad37.44%, reverse unqualified,
REST composition10/12 and native-assisted11PASS1UNVERIFIED remain unchanged.
Next resolve source-export framing evidence, then measure accumulated fixes more
broadly. No owner wait, publication, scorer change or parked-file modification.

## 1158 — fresh exports reproduce source framing refusal

Read source1953:20802 bounds before and after fresh REST layout/render exports.
Source version2404402201308833648 unchanged. Both PNGs are byte-identical to
the1144 source capture used by1156. Unchanged qualifyRenderBoundsExport again
refuses render-export-overlap-mismatch. Layout320x76 at590,1875; render322x80
at590,1874. At the recorded0,1 offset85overlap pixels differ, including alpha
and low-alpha RGB differences around the textarea. No stale source evidence
or transient download explains this; repeated identical captures cannot qualify it.

Archive source-framing-1158 contains before/after REST evidence, both fresh PNGs,
capture/verification scripts and hash/qualification result. No thresholds or
scorer edits. Keep this case unverified rather than spend further identical
replays. Next broader accumulated-change measurement/root-cause work; native
assisted11PASS1UNVERIFIED and broad37.44%, reverse unqualified unchanged.
No owner wait, publication or parked-file change.

## 1159 — current committed full204 measurement launched

Previous1158 proved repeatable source framing refusal; stopped identical retries.
Created clean detached measurement worktree /private/tmp/ds-contracts-broad-1159
at0d6b463d5, excluding all parked edits. npm ci and schema/core/CLI/emitter builds
completed; tracked tree clean. Existing run-full204.mjs launched against unchanged
204-set sample and identical full-candidate font manifest, serial15second pacing.
Durable output private/beta-kits/full204-1159 has source commit/sample/font hashes.
Process session15732; log /private/tmp/broad1159-run.log. Poll actual handle before
any restart. This familiar sample is cumulative regression evidence, not unseen
kit qualification. No current totals claimed until terminal summary exists.

Old1105 refusal ranking identifies layered-fill source-variable consumer evidence
as largest refused cohort:10sets/346variants. Diagnose that shared acquisition gap
while the isolated scoreboard runs; do not relax consumer proof requirements.
Broad37.44% remains last completed score, reverse unqualified. No owner wait,
publication or changes to parked files.

## 1160 — native consumer evidence acquisition verified

Polled live1159 session15732; still running, four sets terminal at inspection.
Traced consumer-missing to strict selected-mode/alias evidence, which REST cannot
supply with current permissions. Canonical plugin already has readConsumerVariable
and readConsumerAliasChain. Generated a bounded read-only4321character script
from those exact helpers and executed against connected Carbon source file.
Three actual source nodes11003:404856/404857/404858 returned Transparent COLOR,
White Theme25984:0, exact native alpha0.000009999999747378752 and MULTIPLY.
All three independently passed existing qualifySolidFillColorBinding after exact
source node/variable/color/opacity/blend matching. No source mutation or guard edit.

The dropdown dump includes1570bound composition observations across dependencies;
three captures prove acquisition feasibility only, not package recovery. Next
batch canonical consumer reads and atomically apply source-matched evidence,
including NORMAL peers and repeated node occurrences, before measuring recovery.
Archive native-consumers-1160 stores targets, generated script, live receipt and
independent qualification. Broad37.44% last completed, reverse unqualified;
no owner wait, publication or parked-file change.

## 1161 — complete live consumer diagnostic clears capture refusal

Captured dropdown dependency-family consumers with canonical plugin helper code.
Initial128batch timed out: direct getNodeByIdAsync on an instance descendant
fails after10seconds although its parent and exact child are locally readable.
loadAllPagesAsync also failed. Exact child-ID traversal through the owning
instance avoids that lookup failure. Preserved/restored skipInvisibleInstanceChildren
for full batches. All2711unique ordinary records captured in128record batches
in about3seconds;85explicit shapeFillTarget override records captured separately.
No source node or variable was modified. Each receipt retains selected mode,
alias chain, resolved native value and independent live fills.

Applied2796live records to3286bound composition occurrences in a copy of the REST
dump after exact node/variable/color/opacity/blend matching: zero missing or
conflicting paints. Original dump unchanged. This is private diagnostic enrichment,
not an installed CLI feature or an unattended first-pass result. Public generation
clears consumer-missing and now refuses solid-fill-composition-instance-root-unqualified
at root/dropdownInput/dropdownInputTrigger/tagReadOnly. No package or pass claimed.
Next inspect linked-child paint capability in packages/core/src/css.ts, retaining
source binding proof; further identical consumer capture is unnecessary.

Archive native-consumer-family-1161 contains2796live receipts, target inventory,
canonical helpers, application script/report, enriched dump and generation error.
1159scoreboard remained live;14sets terminal at latest inspection. Broad37.44%
last completed, reverse unqualified. No scorer edits, owner wait or publication.
