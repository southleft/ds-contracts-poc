# React ↔ contracts ↔ Figma

**Public project status · updated 2026-09-25 · V1 is not complete.**

**Public project status · updated 2026-09-25 · V1 is not complete.**

V1 targets React. Design System Contracts observes a team's original code or native Figma components, derives supported contracts and generates editable output through deterministic shared rules. Composed components, two-way updates and repeatable recovery are required outcomes. Lit/Web Components are parked for V1.1.

This page is the current acceptance ledger and work order, also rendered at `/system`. Start with the [user journey guide](USER-JOURNEYS.md) for installation and application steps, and the [React V1 scope](REACT-V1-SCOPE.md) for the required cohort. Earlier measurements remain evidence; they do not override current failures.

The historical Card source round trip also loses responsive sizing: its CSS
`max-width` was emitted as a fixed native width. The REST receipt now reports
native agreement separately from the two explicit source-contract mismatches;
it does not qualify lossless source recovery. See
[D.86](23-known-limitations.md#d86-a-fixed-native-width-cannot-recover-a-lost-css-maximum).

The current layout candidate carries complete per-variant primary-axis fill onto
frames and repeated generated child roots, with an explicit zero basis for equal
Figma allocation. The app-delivered Tabs archive now responds to Stretch in a
clean consumer. With explicitly supplied static fonts matching the source's
recorded names and weights, both variants pass the unchanged image limit on
white and black, and both root dimensions match exactly at 439 × 176 px. The
worst difference is 3.7404%; the earlier font-input failures remain preserved.
Font-byte identity, interactive Tabs behavior and live native validation of the
placement rule remain open ([D.111](23-known-limitations.md#d111-primary-axis-fill-can-vary-with-a-prop),
[D.112](23-known-limitations.md#d112-font-names-do-not-identify-font-bytes)).

## The whole loop

![V1 workflows: React to contract to editable Figma; Figma to contract to reusable React; and changes through comparison, authorized repair and independent verification.](assets/product-loop.svg)

1. **Observe the original.** Pin the source or Figma identity, dependencies, fonts, states and actual rendered output.
2. **Derive a contract.** Carry supported properties, anatomy, tokens, layout and composition; name missing facts.
3. **Generate the target.** Use the shared emitters to produce native editable Figma or reusable React.
4. **Verify independently.** Compare structure, dimensions, pixels, editable content and declared behavior.
5. **Maintain the agreement.** Observe both sides against a shared baseline, apply supported changes, verify again and prove an unchanged repeat writes nothing.

The complete loop remains unqualified. Recorded matched-frame captures made with the original instrument did not inspect closed shadow content; the application names that limitation. The state-API Switch now also has a separate nine-pair recapture with shadow-boundary checks, shown alongside its unchanged original record. New recordings require the strengthened capture instrument ([D.79](23-known-limitations.md#d79-transparent-captures-must-inspect-closed-shadow-boundaries)).

## Where we are

| Area | Measured application outcome | Remaining gap |
| --- | --- | --- |
| React originals | The fixed shadcn cohort opens ten styled cases. A workspace declaration admits the independent Badge/Alert/Switch family; its seven cases validate. Radix Themes validates four cases against archived replay, both through its compiled package and a separately declared shipped-JSX workspace. A separate unmodified Separator cohort validates and traces both textless cases. | Arbitrary repository discovery is not supported. The compiled Radix workspace refuses native content ownership; the shipped-JSX workspace now validates and traces all four cases with its surrounding Theme retained as source context. Button now maps its shared root through BaseButton while retaining both source identities. The two recorded Button inputs now compile root drafts using guarded content evidence; the app prepares one candidate without a canvas write. Both observed Switch compositions now have app-created native output and bounded white-background measurements ([D.147](23-known-limitations.md#d147-authored-native-graphs-need-visible-placement-and-offset-checks)); alternate branches, other input combinations, behavior and two-way updates remain unqualified ([D.146](23-known-limitations.md#d146-recorded-content-evidence-does-not-prove-every-input)). |
| React → native Figma | The application creates simple, stateful and composed native output. Retained Button, Checkbox and Card objects have independent readbacks and bounded correction/repeat proofs. The declared Switch's nine states and composed Alert now have guarded source/native frame measurements visible in the app. | Badge has an exact-width mismatch; some historical Button scores remain above 5%; retained empty Button mains lack comparable pixels. Broader behavior, themes, responsive states and dependency internals remain unqualified. |
| Figma → installed React | Through app import and archive preparation, clean consumers measure Altitude Badge **10/10**, CBDS Badge **72/72**, Checkbox Group **12/12** and standalone Checkbox **26/26**, using the unchanged 5% limit on white and black. CBDS and Checkbox use explicitly supplied, hashed Inter and Public Sans assets respectively. | Tabs now retains observed body content, active styling and Stretch allocation; its unchanged app archive passes 2/2 image pairs with source-named static font inputs and exact root dimensions (D.112). Keyboard interaction and accessibility remain unqualified. The latest app-delivered standalone Tab retains pressed paint, its full focus border, per-variant tracking and all ten exact native root dimensions: **8/10** image pairs pass both backgrounds; unselected rest and pressed text remain at **11.67%** black difference after the alignment correction ([D.137](23-known-limitations.md#d137-observed-left-alignment-and-inside-strokes-must-survive-import)). Invalid tracking refuses; restoring the contract produces an identical archive. Normal reload and workspace selection restore the exact contract and delivery action. Earlier failed consumers remain preserved. Consumer fonts do not authenticate Figma font bytes. Broader semantics, accessibility and instance swaps remain unqualified. |
| Updates and recovery | Live code changes update existing nodes; exact repeats write nothing. Conflicting design edits refuse. The app detects design-only changes and verifies agreement after a developer changes the source. Begun-write recovery has a live canvas settlement and independent verification. The app now previews a real opacity edit, selects one source candidate and checks all ten configured examples: 60 initial states and ten interaction trials per source version across five caller contexts, including the nested Card. The reviewed change now applies to the original module and regenerated CSS through the app; all ten source examples and fresh pre/post canvas reads pass. Restart before the write resumes safely, and a repeated completed Apply request changes no retained files. Explicit restoration returns source/CSS byte-for-byte, validates all ten examples and preserves the full native snapshot. Later source and canvas edits each refuse before a source write and remain intact. | Bounded Apply, source restoration, live source/canvas conflict refusals, subsequent native succession and partial-file IO-failure recovery are measured ([D.108](23-known-limitations.md#d108-source-application-requires-fresh-canvas-reads-and-verified-recovery)). Completion requires fresh canvas reads, all-case source validation and demonstrated recovery; preview coverage is limited to configured callers and the recorded finite/action domain ([D.105](23-known-limitations.md#d105-source-repair-must-check-the-other-configured-callers)). Bound-size updates require narrow fixed-layout conditions; broader changes and full two-way acceptance remain unqualified. |
| Delivery | The local app produces React archives, records native operations and shows original/native comparisons. Installation and workflow guides name fonts, CSS Modules and current limitations. | Release qualification remains open: the complete cohort, clean consumer journeys, update and recovery proofs, and current installation evidence are not all demonstrated. Tagging, publishing and deployment have not happened. |

The app now retains an explicit composition structure observation across a full
server restart without requiring a native operation. Reloading the originals
restores the same four-case observation and three initial-state images; repeating
the inspection reuses the saved result without adding or changing evidence.
Older observations retain their original nested-state refusals; the separately
authenticated state workflow below adds assembly and native delivery
([D.150](23-known-limitations.md#d150-explicit-structure-observations-survive-server-restarts)).

The shared contract model now represents a nested component's position across
a complete finite input domain. Both React emitters preserve omission, exact
geometry and the mounted child in browser checks. A new composition assembler
retains parent and child variants from separately authenticated state inputs.
The app now verifies separate original render origins for all three shipped-JSX
Switch initial inputs: false, true and omitted. Each matches its ordinary initial
capture in the full tree and full-page image; all originals are restored.
The style reader now follows selected nested variable fallbacks and preserves
physical `initial`/`unset` sizes as automatic. The state assembler keeps uniformly
automatic dimensions as content layout instead of freezing sampled rectangles.
The shared pseudo-element rule also carries constant geometry with paint that
factors over one finite input, including omission. Both React emitters pass
independent browser comparisons for these rules. Registered size-variable
provenance, broader caller allocation and mixed fixed/automatic dimensions still
refuse. The fresh app run assembles two component definitions and three root
variants. In a stable opaque white context, all three originals match both
React emitters at 0% image difference and exact 35 × 20 px root dimensions.
The app now creates the complete three-state native graph through Sync Runner.
Independent readback preserves two component sets, nested thumb instances and
36 variables. Every root is exactly 35 × 20 px; the thumb sits at (1, 1) for
false/omitted and (16, 1) for true. Each native export is paired with its own
original state in the app. Under the unchanged white-background scorer, false
and omitted measure 0%, and true measures 1.4286%; the corresponding comparisons
aligned by recorded layout origins measure 0%, 0% and 0.2723%. These are
tolerance-based measurements, not pixel identity. Reopening the same request
reuses the operation without changing its journal. The transparent source
capture refuses the painted Theme ancestor, so original-source black fidelity
remains unqualified. The three-state native family now returns through app
import and archive download into a clean installed React consumer. All six
native/consumer image pairs pass on white and black, with a maximum difference
of 0.8421%, exact root dimensions and retained child identity across input
changes. A shared import fix now preserves the nested optional boolean mapping,
so the checked thumb selects its five shadow layers and omission restores its
original appearance. The earlier failed archive remains preserved. That
appearance-only archive does not toggle on click; its passing appearance scores
do not establish behavior or accessibility.
A separate source-backed React preview now preserves the authored composition
and its observed checked-state API. Keyboard and label activation match the
source across all nine controlled/initial input combinations, including omission;
the nested thumb remains mounted and moves with live state. Controlled values
take precedence and changing only the initial value does not reset the component.
This preview does not upgrade the earlier downloaded archive or establish native
delivery and clean-package return. Those steps are measured separately below;
excluded inputs, including disabled and inert, remain unqualified.
Preview evidence: `private/authored-state-api-v227/`.
The native graph path now accepts separately pinned state evidence. Its integration
checks preserve the root initializer and callback through native creation, readback
and import, with complete typed input forwarding to nested components. Altered
evidence and missing native child mappings refuse. The live app now creates a
separate stateful native graph and returns it through Sync Runner Send, JSON
import and React library download. Its clean installed package matches all 18
source keyboard/label sequences, 36 activation transitions, callback values and
same-mount input updates. The child remains mounted with exact root and thumb
geometry. All 15 installed files match the downloaded archive. Six native/React
image pairs pass the unchanged 5% limit, with a maximum difference of 0.8421%;
the three original/native white comparisons also pass, at 0%, 1.4286% and 0%.
These are tolerance scores, not pixel identity. Evidence and an interactive
installed-consumer review are in `private/authored-state-native-v229/`.
Excluded inputs, broader fidelity and accessibility, state-graph updates and
interruption/recovery remain open
([D.151](23-known-limitations.md#d151-stateful-composition-needs-placement-and-per-state-origin-evidence)).

Update planning now retains the complete compiled component graph. Engine checks
exercise root opacity and shadow-stack corrections while preserving children,
including conflict refusal, repeat, partial-write recovery and rollback. The
saved stateful native graph also produces an unchanged zero-write proposal offline.
These engine checks alone do not qualify the live update journey. Dependency
changes remain refused; the application evidence below covers an unchanged source.
Historical identity checks now recover the saved state experiment's original
contract names and authenticate each authored source boundary by its recorded
absolute file, export and parent relationship. They tolerate changed source bytes
and instance numbering, while refusing substituted components and damaged archives.
The succession journal can retain complete composed state pins across restart.
A fresh nine-case app state experiment resolves to the saved native operation's
same authored hierarchy and contract names, with all 27 source restorations checked.
Fresh observations now compile into those original names before styles and tokens
are derived. The app follows a new observation on the existing stateful Switch
operation, reviews a zero-property-change proposal, and completes Sync Runner
preflight, no-op application and independent readback. The original two component
sets, three root variants, nested instances and 36 variables are retained. The
readback matches all 15 original node records, token data and three PNG exports
exactly. Reviewing again reuses the verified correction without another proposal
or write. This establishes the unchanged-source update baseline.
That earlier callback sweep retained its `inert=true` focus refusal; the separate
nine-case state check passed with all 27 restorations. Application review remains
slow: the follow-source response exceeded 60 seconds. Evidence and reversal
preimages are in `private/authored-source-namespace-v232/`.

A subsequent literal opacity edit in the original shipped React module now follows
that same native operation. Fresh observations validate all four source cases,
three initial states and nine controlled/initial combinations. The app reviews
three root changes from 1 to 0.75 and one existing opacity-variable change. A
temporary conflicting canvas value of 0.5 refuses by node ID and remains intact;
after its explicit restoration, a fresh preflight, application and independent
readback pass. All 15 native node IDs and every other recorded node and token
value remain unchanged. The three edited-source/native comparisons pass the
unchanged 5% white-background limit, at 0%, 0.2721% and 0%, with exact 35 × 20 px
root dimensions. These are tolerance scores, not pixel identity. The source's
painted Theme still prevents a qualified black-background comparison. The app
shows the verified correction, and the unobstructed native canvas was inspected.
The changed native family now returns through Sync Runner Send, application JSON
import and React library download into a new clean installed consumer. All 15
installed files match the downloaded archive. The package matches the edited
source's 18 keyboard/label sequences and 36 activation transitions, including
callbacks and live input changes, while retaining the child and root opacity
0.75. Six native/consumer image pairs pass the unchanged white/black limit; the
maximum difference is 0.3289%, with exact root and child dimensions. These
tolerance scores do not establish pixel identity or qualify original-source
black fidelity. Guarded source restoration and a separately reviewed reverse
update now restore all 15 native node records, all recorded token data and all
three native image records exactly to the original baseline. Both source files
also match their original bytes. An unchanged review reuses the verified
correction without adding a proposal or journal event. Dependency edits and the
full range of interrupted-write outcomes remain unqualified. Update and reversal bytes are
in `private/authored-source-update-v233/`; the changed return and interactive
installed-consumer review are in `private/authored-update-return-v234/`.

A bounded interruption now tests a write that reached Figma but lost its result.
The server was stopped after the real begin event, the companion was closed,
and one replacement server opened the unchanged journal. The app required an
explicit companion-closed attestation before settling from the canvas. A cached
late result remained evidence only; two subsequent independent canvas reads
matched all 15 node records, token data and three native images of the changed
baseline exactly. There was one write dispatch and one begin event. An unchanged
review added no proposal or write. This covers the landed-write/result-loss case,
not untouched, partial or late-executing writes. Reopening the companion required
a manual Connect / resume to complete the read. HTTP 408 responses and a visible
JSON parse error also occurred, so unattended recovery and interactive reliability
remain unqualified. Guarded source restoration and a separately reviewed reverse
update then returned all recorded native nodes, tokens and images exactly to the
original baseline. Evidence is in `private/authored-write-recovery-v235/`.
Selected ownership evidence now authenticates once per synchronous display
response, while selection records remain checked on each access and subsequent
requests authenticate again. A profiled native review decreased from 65.2 to
36.1 seconds with the complete response unchanged; a post-reload sample took
104.5 seconds. Interactive latency remains unqualified. Empty HTTP errors now
report an unconfirmed request outcome instead of a JSON parser error in the
source, initial-state and native-review screens. Measurements and reversal
preimages are in `private/native-review-latency-v236/`.
The two held-out conversion gates now compare current-engine output against a
separate reviewed baseline while authenticating all 276 frozen historical files.
All 25 subjects remain covered: eight reach computed-style accounting with 136
mounted variants, and 17 retain their exact refusal reasons. Both focused gates
pass. These are accounting results, not additional qualified product journeys:
nested child stubs and visual differences remain. A separate browser probe shows
that Radio's 20 recorded label-alignment deltas compare centered wrappers with
left-aligned text leaves. The subsequent app-delivered Checkbox archive preserves
all 20 nested boolean values and the four error rows' full parent width in a
clean consumer, both at content width and at 420 px. Reimporting the known child
retains the same mapping. Placeholder icons, native return, visual fidelity,
interaction and accessibility remain unqualified for this archive
([D.153](23-known-limitations.md#d153-conditional-fill-and-typed-child-lookups-need-consumer-checks)).
The same archive's native application run created and read back its 24 variables,
then stopped during component creation because a lookup supplied a string to a
Figma BOOLEAN property. The native emitter now shares the declared-type lookup
conversion with React, and focused compiler/runtime checks pass. The failed
operation originally retained 15 allocated nodes, including its page; its partial
canvas was inspected without a plugin overlay. Reopening preserved its reservation
instead of creating duplicate output despite the changed compiler.
The app now independently inspects that partial allocation using its original
plan, even after a compiler change. Two live reads returned identical inventories
and token data: all 15 recorded nodes, with no missing, additional, type or
ownership differences. A queued read survived closing and reconnecting the
companion. Inspection preserves the failed operation and does not enable
recreation or qualify its incomplete graph.
The app now offers separate review and replacement actions for acknowledged
partial libraries. A live attempt could not remove the current page and remained
unknown. A fresh review confirmed the entire original allocation and its recorded
claim; a separately claimed continuation switched pages before its final check
and replaced the 15-node partial output. It created 20 root variants across three
components, with 105 explicit allocations and 109 independently observed nodes.
All 24 variables retain identical readback. The four native error rows now use
FILL at their parents' widths, but the complete graph remains **unqualified**:
independent readback refuses a text-paint mismatch on an unresolved swap identifier
rendered as text. The unobstructed canvas also shows provisional child icons.
This demonstrates bounded replacement and native fill, not full recovery or
fidelity acceptance. The app preserves the original failed journal and refuses
repeated Apply. Unknown writes are not replayed; replacement deletes the whole
reviewed owned page, including edits within it.
Evidence is in `private/conditional-native-v241/` and
`private/prepared-partial-inspection-v242/`; replacement runtime probes are in
`private/prepared-library-replacement-v243/`. The live replacement, refusal,
screenshots and continuation claims are in `private/prepared-library-recovery-v244/`.
A fresh REST import of the same source retains native property types and seven
dependency components. The dependency reader now also follows applied instance
swaps; it had omitted the selected warning glyph while reporting no unresolved
references. The importer now passes a uniformly selected, key-resolved standalone
component into a child's unique default slot using the existing caller-parts
representation. A fresh app download renders the warning glyph in all four error
rows without changing the six sibling contracts or their sample defaults. Its
24 px content overflows the 12 px icon host, so size and placement remain wrong.
The checkbox child still refuses hover/disabled internal paint overrides and
remains a provisional stub. Typed booleans and error-row widths survive in the
clean installed archive. Its initial native preparation refused the newly included
path shape before delivery (`NATIVE_CONTRACT_DRAFT_SHAPE_GEOMETRY_UNQUALIFIED`).
This is a separate fresh-source candidate, not a repair or qualification of the retained native graph
([D.154](23-known-limitations.md#d154-following-a-swapped-component-does-not-carry-its-nested-content)).
The caller-content application and consumer evidence is retained in
`private/fixed-swap-caller-v246/`.
The same saved archive now creates five native components, including editable
filled paths, all 20 root variants and 47 variables through the application.
Paths retain their declared drawing viewport separately from Figma's intrinsic
curve bounds; their segment geometry is checked independently. Explicit
zero-basis text growth also retains its requested allocation instead of being
replaced by Hug. After correcting an incorrectly assumed vector blend default,
a fresh read of the retained output passes the supported-structure check:
132 explicit allocations and 156 observed nodes. The original refused readback
remains preserved. Tokens and all 20 exported images match between reads; four
caller instances acquire Figma's virtual IDs while retaining their allocation
identities. This is not a claim of byte-identical node inventories.
The unobstructed canvas and application exports still show oversized warning
glyphs and an empty provisional checkbox child. Fidelity, behavior and the full
return/update/recovery journey remain unqualified
([D.155](23-known-limitations.md#d155-filled-paths-need-a-drawing-viewport-and-independent-geometry-checks)).
Evidence: `private/native-filled-path-v247/`.
The source reader now retains the actual geometry of selected instance-swap
content, matched by its complete property identity. A fresh CBDS read confirms
four 12 × 12 warning instances of a 24 × 24 main component. Their dimensions,
local transforms and scaling constraints survive import without rounding.
The captured SCALE relationship now reaches the contract and both React
emitters. A fresh application download installs byte-identically in a clean
consumer: all four warning hosts measure 12 × 12 instead of 24 × 24. The drawing
measures 9.75 × 9.75; browser subpixel placement differs from the source, so this
is a size correction, not complete fidelity. Separate browser probes verify
12 → 18 → 12 caller changes while the standalone main remains 24 × 24.
Native creation retains all 20 Light-mode variants and 48 variables, but exact
readback refuses four inherited path origins. A proposed position correction
failed in the separate Dark-mode run because Figma forbids those instance-child
transform writes; that correction was removed and its partial output retained.
The next app-delivered archive carries the warning's red fill through an
identity-qualified caller color override. In a clean installed consumer, all
four warning glyphs retain their 12 × 12 host size and observed red paint; all
30 installed package files match the download. Both React emitters preserve
the standalone main's default color during caller color changes. The checkbox
child remains empty. Complete native geometry, repair of the retained runs, visual fidelity
and V1 acceptance remain open. Capture evidence is in
`private/swap-instance-geometry-v249/`; implementation, installed-consumer
measurements and both failed native runs are in
`private/scalable-filled-path-v251/`.
The first native color run stopped when a paint override applied before caller
slot attachment invalidated native sublayer references. Applying paint after
attachment now completes a live application replacement: 20 variants, 132
allocations and 156 independently observed nodes, reusing all 49 variables.
The reviewed recovery accounts for one remapped caller allocation and 15
inherited layers before retiring the partial page's exact 62-node inventory.
The original acknowledgements and failed reads remain preserved. Four warning
glyphs visibly retain the red paint and intended size while their reusable main
keeps its default color. Independent inspection still refuses four exact inherited
path origins, and the checkbox child remains empty. Color delivery and partial
page recovery are demonstrated; complete fidelity and V1 remain unqualified.
Evidence: `private/host-paint-target-v252/` and
`private/partial-slot-recovery-v253/`.
See the [current replay limits](../recipe/evidence/canvas-to-code-held-out-current/README.md).
Evidence is in `private/held-out-integration-v238/` and
`private/conditional-cross-fill-v240/`. The earlier full fast lane passed all
201 gates before these latest repairs; that result does not qualify the changed
tree or V1.

Fresh callback inspection now records browser inertness separately from disabled
state. The Radix Switch completes all 48 compatible input/action trials and 72
restoration checks. With `inert=true`, keyboard focus and activation are suppressed,
while its outside associated label still toggles the state and reports callbacks.
The app shows both outcomes. One same-mount pixel difference remains recorded;
every independent replay matches the original image exactly. The unchanged
installed package from the earlier stateful native return matches all four inert
input/action sequences, eight transitions and live input updates, with exact
35 × 20 px roots and all 15 installed files unchanged. This does not qualify the
other excluded inputs, every inert context or full visual fidelity. Historical
failed observations remain intact. See [D.152](23-known-limitations.md#d152-inert-keyboard-and-label-outcomes-are-distinct)
and `private/callback-inert-v237/`.

**No complete journey cohort has met every V1 criterion.** Passing individual images or engine checks does not establish the full product outcome. The ledger below records the denominators, failures and evidence.

The corrected ordinary-root caller workflow now completes through the app and
Sync Runner: the retained Button main produces a new current-source comparison,
and independent readback preserves its 191 parent nodes and 122 variables.
The remaining exact-size failure is visible in the application: React measures
115.8125 × 36 px; native Figma measures 116 × 36 px. This closes the blocked
caller-creation step, not the Button fidelity requirement. Earlier comparison
records remain intact. See [caller comparisons after a root correction](../source-reference/README.md#caller-comparisons-after-a-root-correction)
for steps, authority checks and the measured limit.

A fresh standalone Tab reimport exposed two dropped source facts: explicit left
text alignment and the inside-stroke alignment required for its focus border.
The corrected app import and browser download now install in a clean consumer
with both focus borders and all ten exact root dimensions retained. Eight of
ten image pairs pass; two text cases still fail at 11.67% on black. Historical
receipt integration and release qualification remain open
([D.137](23-known-limitations.md#d137-observed-left-alignment-and-inside-strokes-must-survive-import)).

The retained Checkbox's fresh source observation exposed four newly requested
number tokens. The live app added them to the retained collection: independent
readback confirms all 46 original variables and all 44 nodes are unchanged,
with 50 variables afterward. The canvas was inspected with the companion closed.
A separate compiler review then corrected the twelve transparent hit-area shapes;
independent readback preserved every node ID, all variables and all twelve images
([D.103](23-known-limitations.md#d103-additive-token-allocation-is-a-separate-correction)).

### What the React application can do now

The `/sources` page loads the configured original workspace. **Validate React sources** checks source identity, authored styles, actual fonts and states against archived replay; representative negative controls reject missing or hidden content. **Inspect React APIs**, **Trace React structure** and state/callback inspection derive supported facts without substituting generated code for the original.

The shipped-JSX Radix cohort validates and traces **4/4** source cases. The
trace retains Theme as surrounding context and follows Button into its actual
BaseButton dependency without changing the original images, measured trees or
component ownership. The two recorded Button inputs compile editable root drafts.
Earlier Button preparations remain saved and are currently reported as stale. The Sources app now prepares both Switch compositions for
DS Contracts Evaluations through the shared native graph writer. Each preserves
two component mains, the nested thumb identity and its observed position. All
four original image/tree pairs remain byte-identical. Repeating preparation
reuses the same operation without changing any journal file. Both Switch cases
now create native components through the app and Sync Runner. Independent
readback preserves each nested thumb's main identity and 31 variables. The
unchanged white-background image test measures 0% for unchecked and 1.4286% for
checked, with exact 35 × 20 px roots. These are two captured inputs, not a
qualified state API or complete journey.

The first live canvases exposed overlapping dependency mains. The shared graph
writer now separates fresh mains; a new checked candidate passes readback and
retains the exact earlier root export. A native thumb-position edit exposed a
missing verifier check: declared left/top offsets are now checked exactly or as
float32 values. The recorded edit refuses in the app; a fresh read after restoring
the position matches the complete pre-edit observation, including nodes,
variables and pixels. Repeat preparation preserves all 1,937 inspected journal
files. Black-background fidelity, broader editability, behavior and two-way
updates for this authored family remain unqualified
([D.147](23-known-limitations.md#d147-authored-native-graphs-need-visible-placement-and-offset-checks)).
The checked native graph now returns through Send → JSON import → React
download into an isolated, production-built consumer. Both linked components
install unchanged; the root remains 35 × 20 px and the thumb 18 × 18 px at
(16, 1). The shared proposer now carries the track's captured inner shadow;
the new archive changes only parent CSS and token CSS, with component JavaScript
and the linked thumb unchanged. The historical white comparison measures
1.4286%, down from 1.8182% before that detail was recovered.
A separate guarded transparent-frame capture now passes for this installed
appearance on both white (1.0121%) and black (0%) under the unchanged 5% rule.
The full painted area is included, including the thumb's shadows. Exact pixel
differences remain; this is not pixel identity. The temporary native frame was
removed and the original nodes, positions and instance link remained unchanged.
This fixed appearance has no qualified toggle API; broader return fidelity and
behavior remain incomplete
([D.148](23-known-limitations.md#d148-native-return-delivery-does-not-preserve-every-captured-effect)).
Evidence: `private/authored-app-v207/`, `private/authored-native-live-v212/`,
`private/authored-native-return-v213/`, `private/inner-shadow-return-v214/`,
`private/matched-return-v215/`.

The observed composition can now enter the application's initial-state and
callback inspectors from authenticated source evidence. The Radix Switch
completes all three caller-supplied initial inputs (`defaultChecked` false,
true and omitted), with exact restoration and visible saved previews. An
unchanged repeat reuses the same observation without rewriting its evidence.
Its state contract still refuses `react-initial-contract-nested-identity-unqualified`:
the assembler must preserve the public component, its implementation boundary
and its nested thumb across states before native state generation is qualified.
These observations do not create another Figma graph or establish a state API
([D.149](23-known-limitations.md#d149-observed-composition-states-need-reusable-nested-identities)).
The earlier callback experiment recorded 46 activation trials and 71 restoration checks,
identifying controlled `checked` and initial-only `defaultChecked`. That broad
result failed: `inert=true` refused the focus trial. One same-mount pixel
difference is retained; every replay restores the exact original image.
Evidence: `private/composition-state-v217/`. The corrected inspection and bounded
inert return evidence are recorded above and in D.152.

A source alias, matching type or unchanged children pointer is insufficient:
the installed Button helper can change caller content through another prop
([D.143](23-known-limitations.md#d143-local-aliases-do-not-prove-helper-effects)).
**Caller-content helper checks** now verifies the original input, helper effects,
containing function and returned React element in one guarded browser invocation.
Native draft preparation consumes that sealed evidence only for the recorded
instance and input. Changed source, props, runtime artifacts or ownership refuse;
serialized forwarding flags cannot grant authority. The underlying source children
fact stays unresolved. The app names this input boundary alongside each draft.

Loading content, alternate component targets, unobserved input combinations and
Switch behavior remain unqualified. The new baseline evidence does
not expand property-matrix coverage or establish native fidelity
([D.146](23-known-limitations.md#d146-recorded-content-evidence-does-not-prove-every-input)).

Root, initial-state and composed operations pin their plans before the companion executes. Independent readback checks the supported native structure, variables, main links and caller content. Repeat preparation reopens the same operation. Unsupported ownership, layouts or mappings remain named refusals.

**Prepare caller-content comparison** creates a separate native instance of an existing main with observed content. Reusable mains remain reusable. **Review recorded matched frames** shows authenticated Switch and Alert measurements on white and black at original pixel size, with exact source/native geometry checked separately from the image threshold. Preparing those capture records still requires operator scripts; displaying them in the app does not make capture automatic.

The declared Switch passes all nine matched-frame pairs (maximum **4.167% white / 2.399% black**); Alert passes at exactly 360 × 68 (**3.064% white / 3.100% black**). A separate native editing probe changes Switch variant properties and Alert caller text, then restores the exact original PNG and native properties. The source mains and verified comparison remain unchanged. This proves those edits remain available in Figma; it does not prove that these edits synchronize back to React. The retained Switch thumb still has an exact descendant-geometry mismatch. Fresh application observations now recover the transparent hit area, and a guarded correction updates all nine existing native rectangles in each of the initial-state and state-API sets to exactly −11, −7 and 54 × 32.390625 px. Independent readback and its unchanged repeat pass; all nine PNGs and export bounds remain byte-identical. The first resize attempt rolled back, and its separate baseline read now closes that failed write without losing its history. A source height change also changes the pseudo box, which a native height-variable edit alone does not reproduce ([D.85](23-known-limitations.md#d85-transparent-pseudo-geometry-needs-independent-box-evidence)).

**Inspect sizing details** records the native facts required for a bounded size correction. Through the app, the existing nine-state set now follows a source height change from 18.390625px to 20px: one shared variable changes nine roots, nine thumb positions and nine transparent hit areas. A separate readback verifies the result; unchanged review writes nothing. Restoring the source produces a verified reverse update with the complete original 29-node/30-variable observation and all nine PNGs restored exactly. Closing the companion before delivery and reconnecting resumes the same reverse request with one write. The first read-only preflight refusal is retained. This does not qualify lost-write recovery, broader layouts or the original thumb's exact geometry ([D.87](23-known-limitations.md#d87-pixel-dimension-value-history-does-not-authorize-a-bound-size-write)).

**Review compiler update** supports bounded corrections with a fresh preflight, guarded write and independent readback. **Read design changes from the canvas** reports supported differences on the tip of a correction chain. Source succession can retain an operation across a later sealed observation of the same case. Conflicts and uncertain write outcomes stop further writes until explicitly resolved.

### Build rules that compose

The contract records supported properties, anatomy, layout, tokens, content and component references. Readers and emitters use reusable rules; examples exercise those rules or expose a missing one. Runtime conversion requires no AI.

An explicit finite `selection` relationship now generates tab-pattern behavior
on both React surfaces, including keyed items, controlled inputs, keyboard
navigation and persistent inactive panels. The Playground's **Selection** view
provides an explicit setup and review form; it edits the current contract only
after full validation. A bounded engine return now corroborates retained
identities and API against the captured items, states and panels. Its live
application journey and an app-delivered interactive Tabs consumer remain unfinished. The retained Tabs archive is unchanged; missing identities
and panel content are not inferred ([D.131](23-known-limitations.md#d131-selection-behavior-requires-an-explicit-item-to-panel-relationship)).

A separate authored selection example now completes setup, review and archive
preparation through the app. Its clean installed consumer retains panel input
and stable item identity, handles keyboard selection and item removal, and
honors held or accepted callbacks. Reset and an explicit same-tab share-link
reload preserve the expected contract. The browser download event timed out;
the exact displayed archive endpoint supplied the installed bytes. This is a
bounded application rehearsal, not original Tabs, independent-family or native
return qualification ([D.131](23-known-limitations.md#d131-selection-behavior-requires-an-explicit-item-to-panel-relationship)).

The returned native family now also installs from an app-generated archive
and passes the same eight interaction trials in a clean consumer. Its native
structure and unobstructed canvas were inspected. Creation still required manual
script transfers. Send now captures this parent's actual local dependencies in
one family file; its live app import retains all three proposals and opens the
parent without individual child transfers. A fresh Chrome session then completed
**Copy JSON → paste → Load → Prepare React library → Download**. Its saved archive
is byte-identical to the installed return archive. Figma's own Save dialog remains
unqualified; the earlier exact-link transfer is preserved. Visual fidelity and complete V1
acceptance remain unqualified ([D.132](23-known-limitations.md#d132-native-nested-exposure-requires-an-actual-control-text-identities-survive-return),
[D.133](23-known-limitations.md#d133-send-captures-local-dependencies-as-one-family)).

A reversible native paint edit now returns through that route to an installed
consumer with only the expected token change. Restoring and recapturing yields
the original archive bytes. A state-dependent label edit refuses explicitly.
The restore exposed a stale prepared-download link after child-only imports;
workspace changes now refresh dependency validation, previews and archive state.
Application replays verify child paint and content updates with unchanged parent
JSON and three retained workspace entries. These bounded checks do not close
the full two-way update or fidelity requirements
([D.134](23-known-limitations.md#d134-child-only-imports-refresh-the-current-family)).

The composed Card delivery contains seven dependency components and six parent variants. Parent readback validates supported nested identities, state and slot content; dependency mains are verified by identity only. The bounded nested-host path now has the separate application evidence below; broader content projection remains refused. Source-preserved React composition has separate browser behavior checks; these results do not qualify every composed journey.

Native component properties and editable slot text are different capabilities. Figma does not retain parent text-property bindings into instance slots. The writer refuses such mappings before allocation and represents supported caller text as native editable content. It does not expose an ineffective property control. See the [limitation ledger](23-known-limitations.md) for decisions and reversal instructions.

The application now derives the explicit root text-template marker from complete
direct-text observations. A fresh two-case capture authenticates painted fonts
and image bounds on all 200 property planes, preserving all 418 sealed files.
Through Sync Runner, its saved operation creates 100 reusable native mains,
153 source variables and 54 routing variables; independent readback verifies
all 302 nodes and the full variable graph. The unobstructed canvas was inspected.
Reusable mains keep empty editable content; this structure result does not
qualify their caller rendering.

The application caller still fails the 5% bar at **8.43%**: native width is
51.01599884 px against 49.921875 px in the original React source. Recorded-origin
diagnostics retain differing pixels outside text. The earlier engineering
comparison remains a separate 6.85% failure.

Canonical capture imported through the app preserves all 400 typography
references across 100 variants. Its downloaded archive installs unchanged in a
clean React consumer. With the original font supplied by that consumer, all
100 combinations match the original React dimensions, typography, paint,
spacing and corners; changing caller text updates every combination. Lossless
PNG comparisons now pass **100/100** on white at the unchanged 5% limit:
maximum antialiasing-aware difference is **0%**, while exact-pixel difference
reaches **29.39%**. All origins and dimensions match, and all isolated replays
are byte-identical. Both source-readiness cohorts now pass **50/50** with an
explicit web-font witness; each representative rejects all five corruption
controls, including same-family system fallback. All 200 source/replay PNGs
are byte-identical to those already scored. The earlier family-only refusals
remain archived ([D.101](23-known-limitations.md#d101-web-font-witnesses-reject-same-family-system-fallback)). A same-tab
reload requires manually selecting the saved Workspace import and produces
identical contract and archive bytes. One earlier return tab stalled; recovery
used a fresh tab with React output selected. Native fidelity, template updates,
interrupted native recovery and the complete independent-family journey remain
unqualified ([D.99](23-known-limitations.md#d99-native-root-text-templates-still-need-an-application-journey)).

Arbitrary React programs and CSS are not automatically convertible. A design drawing cannot supply business logic such as data fetching, sorting or validation. Existing behavior needs a verified preservation boundary; design-only behavior needs a declared, tested implementation.

### Lit and Web Components: paused for planned V1.1

The configured Altitude flow and its existing records remain in the collapsed Lit evaluation archive on `/sources`. Preserve its adapters, fixtures, captures and regression checks. React V1 does not require a Web Components journey; V1.1 is planned scope, not a release date or support claim.

## Plan and measures of success

| Order | Milestone | Required exit evidence | Current status |
| --- | --- | --- | --- |
| 1 | Verify React intake | Original styles, fonts, dependencies and selected states; broken inputs rejected. | Configured cohorts verified; arbitrary intake unproven. |
| 2 | Complete React → editable Figma | Simple, stateful and composed output; visual, structural and editability evidence; unchanged repeat creates nothing. | Partial live delivery; named visual and ownership gaps remain. |
| 3 | Complete Figma → reusable React | App-delivered archive installed in a clean consumer; fidelity and declared semantics measured. | Multiple measured sets; full journey qualification remains open. |
| 4 | Maintain an existing pair | Supported edits both ways; conflicts, interruption, recovery and repeat behavior demonstrated. | Bounded reviewed design-to-source Apply and native succession pass; broader updates and recovery remain open. |
| 5 | Prove generality and release readiness | Independent family completes both journeys without named-component fixes; accurate installation and limitations. | Independent-family gaps and sequential PR integration remain. |

<a id="v1-acceptance-evidence"></a>
### V1 acceptance evidence, 2026-09-21

The owner's six React-only V1 requirements are grouped into five evidence rows below. Live two-way updates and repeat/recovery share row 3; both remain required. Each row names what the application shows today, where the evidence is, and the concrete gap. None of these rows is a release grade.

The 2026-09-24 authored Switch initial-state run adds bounded evidence to rows 1
and 4: three app-created native variants, independent structure readback and
three white-background comparisons below 5%, with exact root sizes. An unchanged
preparation repeat adds bounded evidence to row 3. The original source has four
unchanged image/tree pairs; all three state origins are independently verified.
The native canvas and original/native app comparisons were inspected. Evidence:
`private/authored-state-native-v224/`, operation `3b03963e-4f0b-40ba-ac60-3a0c35487337`.
This does not complete any row: both-background fidelity, the clean consumer
return, behavior, state-graph updates and interruption/recovery remain unqualified.

The 2026-09-25 CBDS Checkbox family run adds bounded evidence to row 2. Through
the app, a fresh REST capture was imported, packaged and installed in a clean
consumer. Checkbox-icon passes 30/42 variants at 0.000% on white and black,
including rest, error, disabled and pointer-hover cells with exact 16/24 px
glyph boxes. All 12 focus-visible cells are unreachable (non-focusable root).
The composed Checkbox passes 5/20: its label rasterises differently inside
correctly placed text boxes, focus rings are absent and parent hover renders
rest ink. Its native operation `46e5f671…` is prepared but not yet written or
inspected. Rules, gaps and evidence:
[D.156](23-known-limitations.md#d156-direct-drawing-instances-carry-their-box-a-projected-child-state-forwards-only-disabled),
`private/direct-state-ink-v255/`. This completes no row.

Prepared React downloads now have a native-library page that retains the selected
archive, theme, brand and operation across reloads. Its isolated application
proof covers restart, repeated preparation and refused pairing on an unsupported
port. The primary application now creates the original seven-component Tabs
library through Sync Runner: all 267 birth nodes, 507 independently observed
native rows and 74 variables pass the supported-structure check. A fresh
inspection after restarting the app returns identical node, token and image
data without recreating the allocation. The unobstructed canvas shows the seven
dependency targets separated. The retained archive bytes remain unchanged.
Native allocation selects the graph's
actual token bindings and exact alias dependencies; unused library vocabulary
does not become variables, and a used token without a type still refuses.
Literal-only libraries retain an empty owned scope. Fresh dependency targets
are placed separately in a deterministic column. Independent verification
requires exact variable identity across uniform stroke edge bindings and scopes
inherited slots to their owning instances. The two populated appearances pass
the unchanged 5% image limit against the retained same-archive React consumer
(maximum 3.365% on black). Temporary native instances complete 25 property edits
and both caller-slot edits with exact restoration; a full read after probe
cleanup leaves all library nodes, variables and six images unchanged. Those initial
comparisons covered two of six appearances. Four of six root dimensions matched;
the earlier archive wrapped two empty Stretch selections to 60 px in React
against 40 px in Figma. The newer text correction and six-state results are
recorded below. An intrinsic-minimum candidate fixes those baseline roots but was
rejected at 180 px: filled native items remain 60 / 60 / 60 px while the candidate
uses 101 / 92 / 92 px. Narrow text reflow also remains unqualified. That intrinsic-minimum candidate
was not installed; all 507 native rows, tokens and six images still match after
removing the temporary probes. Full visual, interaction and two-way acceptance
remain unqualified.
Evidence: `private/primary-library-integration-v114/`, including the visible
review, original operation journal, paired images and restored edit probes.

Prepared-library inspection now also refuses loss of explicitly compiled
horizontal Fill on frames, slots, instances and supported text. The existing
untruncated-text Hug exception remains. Six altered copies of the actual Tabs
receipt now refuse. With that verifier installed, a fresh app/Sync Runner
inspection returns the complete original 507-node, token and six-image result
exactly; all 19 earlier operation files remain unchanged. The result survives
page reload. This strengthens structural inspection without resolving the empty
Stretch or narrow-text mismatch. Evidence: `private/intrinsic-fill-v122/`.

The CBDS Badge return now also completes fresh app import, native creation and
independent inspection from the retained source capture. The prepared archive
is byte-identical to the previously measured clean-consumer package. Three
component graphs create 311 nodes; all 749 observed rows, 84 variables and 72
root exports pass structural inspection. Each baseline appearance retains exact
root dimensions and passes the unchanged 5% image limit against the retained
consumer on white and black (maxima 2.214% and 4.557%). The retained original
Figma references score 0% with the existing antialiasing-aware scorer; raw pixel
identity and source font byte identity are not claimed. All 72 variant switches
and label/visibility edits restore exactly. After removing the temporary probes,
a fresh independent read preserves every row, token and image. The shared schema's
absent-family default is pinned only for fresh library anatomy with no family
mention; explicit, malformed and unresolved mixed families retain strict checks.
Optional icon glyphs, child appearances, arbitrary overrides, interaction and
two-way updates remain unqualified. This is a measured baseline return, not a
complete independent-family acceptance. Evidence:
`private/cbds-library-return-v116/`, including the visible 72-case review,
unchanged archive identity, both comparison backgrounds and cleanup readback.

The same Badge operation now completes an interrupted read-only inspection after
local server restart and desktop reconnection. The application returns to
**Native structure checked**, including after page reload. The new native receipt
is exactly equal to the previous one: all 749 node records, the complete token
receipt and 72 images match. All 90 earlier operation and archive files remain
byte-identical, with no repeated creation. The plugin was closed and the native
canvas inspected. This qualifies this inspection-recovery sequence; interruption
during a native write and broader two-way recovery remain separate requirements.
Evidence: `private/continuation-v121/` and the unchanged original operation journal.

A separate fresh CBDS capture now carries the optional heart vector through
React archive preparation, but native preparation correctly refuses path geometry.
A live isolated probe recreates the REST path at 21 × 17.995800018310547 rather
than its captured 21 × 17.995756149291992 bounds; the difference fails exact
float32 comparison. No tolerance, dimensions or admission guard was changed.
The probe was removed after ownership-checked cleanup. This preserves the
72-case baseline result above while leaving icon geometry unqualified.
Evidence: `private/cbds-vector-return-v117/`.

A later PDF export preserves enough precision to reproduce that heart's exact
native width and height. Its raster passes the unchanged comparison on both
backgrounds, but the rounded REST control produces the same raster. A separate
editable-vector control demonstrates that PDF still rounds an interior coordinate:
0.12345679104328156 becomes float32 0.12345699965953827, despite unchanged 20 × 10
bounds. PDF therefore does not establish general exact source geometry, and no
PDF recovery or filled-path admission was added to the converter. Both temporary
probes were removed by their recorded IDs; independent readback confirmed the
retained Tabs library's 507 node records, token data and six images unchanged.
Evidence: `private/vector-pdf-precision-v125/`.


A generic compiler diagnostic exposed a vertical growth defect: three growing
children stayed 10px tall inside a fixed 300px column. The corrected compiler
makes each child 100px tall in desktop Figma, and a contract update to 240px
makes each 80px tall while retaining the original component ID and key.
Horizontal controls retain their existing behavior, and unchanged repeats
create no nodes. These are direct engine diagnostics; they do not qualify an
application journey or resolve the empty intrinsic Stretch case. The sizing correction is now installed locally. Temporary probes were removed, and the
retained Tabs library's native records, tokens and images match their prior
canonical digests. Evidence: `private/flex-basis-v126/` and the integration
checkout's `private/vertical-growth-v126/`.

A follow-up diagnostic also corrects fixed geometry being stretched across a
column: declared 10px markers now remain 10px in native Figma. Rectangles and
ellipses retain their explicit cross-axis dimensions while requested growth
follows the main axis, including property-driven changes. Four native variants
match the generated React output exactly in width, height and position; repeat
runs preserve component identities without duplicates. Prepared-library readback
checks the compiled Fill relationship and exact fixed cross dimension; visual
fidelity remains a separate comparison. The changes are installed locally. Evidence: `private/shape-width-v127/`.

A focused application check now carries a supplied four-variant sizing contract
through saved React packaging, native creation and fresh independent readback.
Its clean installed React consumer and four native variants agree exactly in
root and child geometry; measured image differences are 0%, 0.3%, 0% and 0%
at the unchanged threshold. The initial literal-shape-fill input refuses before
allocation; the measured version binds the same colors to tokens. A separate
verifier correction now compares declared solid root/frame fills by exact color,
opacity and bindings instead of reporting them as unexpected paint. Changed or
extra paint still refuses. Fresh inspection preserves all fourteen node records,
two variables and four images; repeat preparation preserves all nineteen journal
files and reuses the operation. This is a synthetic application integration
check, not original-source or independent-family V1 qualification. Literal slot
surface paint remains unqualified. Evidence: `private/shape-app-v128/`.

Captured auto-width text now retains its intrinsic width instead of acquiring
an implicit parent-width ceiling. Live desktop probes confirm the rule under
constrained rows and columns; explicit bounds or Fill supply wrapping
authority. The correction is installed locally. A new application archive,
generated from unchanged contracts and tokens and installed in a clean
consumer, restores two empty Stretch states from 285x60 to 285x40. All six
root sizes match fresh native measurements. Ten of twelve image pairs meet
the unchanged 5% limit; two empty Stretch states still fail on black at
6.026% and 7.974%. All 507 native node records, tokens and six exports remain
identical after the new read. Repeating package generation returns the same
archive and artifact ID. The retained native operation's preparation is
stale: the read verifies its saved graph, not current-source qualification.
No replacement native graph was created. Ordinary runtime wrapping and
explicitly bounded text remain intact; conflicting authored flex-shrink is
refused rather than overwritten. Native fractional text ceilings remain
unqualified. A separate interactive consumer of the new archive passes click,
arrow/Home/End navigation, accepted and held controlled selection, and live
label changes. This is installed-package behavior evidence, not source-matched
or native interaction qualification. The remaining empty-state visual failure
reflects unequal native Hug widths versus equal React allocation. Native
compilation now refuses explicit zero-basis growth when its primary-axis Fill
cannot be preserved, including this intrinsic-parent case. The existing output
and its failed comparisons remain; this is a supported-model boundary, not a
fidelity correction ([D.138](23-known-limitations.md#d138-zero-basis-growth-cannot-silently-become-native-hug)).
The application now shows that refusal before reserving an operation. Repeated
preparation preserves the saved React archive and native journals. All six
historical native images still open with their source-staleness warning;
no new native observation or visual pass is claimed.
A current app archive of the independent Badge family also
retains exact dimensions and byte-identical prior consumer screenshots for all
72 baseline appearances. All 72 pass on both backgrounds against retained native
references (maximum 2.214% white / 4.557% black); source recapture, optional icons
and broader behavior remain unqualified. Evidence and visible comparisons:
`private/text-sizing-v129/` and `private/intrinsic-growth-v130/`.

A reviewed provisional-child candidate now retains corroborated static content from unresolved REST instances ([D.109](23-known-limitations.md#d109-observed-child-content-remains-provisional)). The running app imports the captured Tabs family, shows its previously missing body text, and prepares a seven-component package. A byte-identical archive installs in a clean consumer. The initial result still lost active styling, alongside the stretch, width and black-background fidelity failures.

A subsequent application import carries typed per-item enum choices from known child contracts ([D.110](23-known-limitations.md#d110-repeated-items-retain-known-child-enum-choices)). Its downloaded archive installs byte-identically in a clean consumer and restores the first tab's active appearance, but still fails at 5.24% and 5.78% on black, with discarded stretch behavior and a content-width mismatch. No additional acceptance row is complete.

| Criterion | Demonstrated through the application | Evidence | Concrete gap |
| --- | --- | --- | --- |
| 1 · React → contract → editable native Figma for simple, stateful and composed components | A separate three-state Checkbox journey now completes 96 source trials, 144 restorations, 96 preview trials and 96 returned-package trials. Its twelve native appearances pass both backgrounds with exact root geometry; all twelve native variant selections restore exactly. The first return lost stroked checkmarks (6/12 appearances); a fresh canonical capture with the generic stroked-path rule now yields an unmodified app package passing 96 behavior trials and 12/12 visual pairs with exact root bounds ([D.84](23-known-limitations.md#d84-open-stroked-paths-retain-their-centerline-and-parent-viewport)). Native polyline and curve creation, resize, edit restoration and unchanged repeat are measured separately. The failed first source experiment and manual polling intervention remain recorded ([D.82](23-known-limitations.md#d82-three-state-native-delivery-passes-appearance-but-the-return-loses-stroked-vectors)). A later experiment completes 96 trials and 144 restorations with normal Sources polling active and unchanged-repeat reuse; startup and terminal authentication remain slow ([D.83](23-known-limitations.md#d83-running-state-api-progress-cannot-certify-a-result)). Button (simple), Checkbox (stateful, 12 initial-state variants) and the composed Card graph (seven dependencies, six parent variants, 169 scoped variables) are created through the companion plugin from the verified shadcn cohort; the parent structure passes independent readback, including after Figma re-identified slot content and in a fresh live readback on 2026-09-18 after the verifier fix; same-day read-only readbacks of the retained Button family (191 nodes, 63 images) and the corrected Checkbox (44 nodes, 12 images) matched their last applied corrections without another write; a live title edit stayed local to one instance; repeat preparation created no duplicates; the app shows the unchanged original beside the native default variant. | `/sources` → composed Card → **Check native composition** → **Create and inspect native graph**; private operation journal `4e6e22c3…` and update journals `c620c0e9…` (Button) and `0b978ebf…` (Checkbox) in the Evaluations file. | Visual fidelity is measured, not graded: `npm run react:native:fidelity:check` recomputes three numbers per variant from the committed bytes in `recipe/evidence/react-native-fidelity-v1/` (44 pairs). Button initial states: 24 measured, 17 pass, 6 named font residuals, 1 named other (a white-trim threshold artefact), 0 fail. Checkbox initial states: 12 of 12 pass. Composed Card parent variants: 6 of 6 pass. Retained Card frames: 2 of 2 pass. The 63 retained Button mains are not measured as images: their content slots are empty while every original renders the label, and neither side records a layout origin. Their non-content box facts are compared without images instead: for each main the same check recomputes 19 facts (declared width and height, padding and border width per side, radius per corner, background and border paint, opacity, gap and shadow stack) from the sealed React property-matrix observation and the native readback values in `root-geometry/facts.json`, joined through the plan's property axes. Of 1,197 facts, 1,155 match exactly (numbers exact or float32, colours on the sRGB 8-bit grid), none mismatches, and 42 are not comparable because the dimension is content-derived on both sides: the width of 35 mains, and the height of the seven mains with `size` unset, which are 22 px tall in React and 3 px in Figma, where the slot is empty. The other 17 of the 80 source observations omit a property, render the same tree as the explicit default and have no variant of their own. The native plan was compiled from these same observations, so the table shows that measured values were carried to the canvas; it is not an independent second measurement, and it says nothing about width, text, fonts, antialiasing or any pixel. Across the 44 pairs the historical ink-trim score spans 0.000–9.195%, the layout-origin-aligned score 0.000–2.255%, and the glyph-masked score is 0.000% on every row it can measure (nine text-only Button rows leave nothing to mask). The seven historical Button failures (six at 9.04–9.20%, one at 6.17%) stay in the record. Recorded typography is identical on both sides for all 32 text-bearing pairs (weight, size, line height, letter spacing; the font Chromium actually used is recorded as Inter on 30 of them and was not recorded for the two retained frames), no above-tolerance pixel differs outside a native text box, and Chromium lays down 1.12–1.36× the ink Figma does for the same glyphs, so the residual is text antialiasing. These are antialias-tolerant scores, not pixel identity: exact-pixel difference runs from 5.7% to 99.3%, mostly one-step colour rounding. Still not measured: the pixels of the 63 Button mains (only their non-content box facts are compared), interaction, hover, focus, responsive and dark-scheme states; the owner has not graded any of it; dependency mains are verified by identity only; two-level caller content and deeper slot locations refuse by name; first-run latency remains too slow. |
| 2 · Designer-authored Figma → contract → working React in a clean consumer | **Measured through the local app in macOS Chromium on 2026-09-19 and 2026-09-20.** REST captures were loaded with the JSON file picker, restored and repeated without duplicate family IDs, then exported with **Prepare React library**. App archive bytes match the packages independently installed in isolated React consumers. At the unchanged 5% limit on both white and black: **Altitude Badge 10/10**, **CBDS Badge 72/72**, **Altitude Checkbox Group 12/12**, **Altitude Checkbox 26/26**. CBDS uses explicitly supplied, hashed Inter and D.90’s owned-leaf default: maximum differences 2.214% white / 4.557% black. Checkbox uses pinned Public Sans and D.88’s guarded root default: maximum black difference 3.279%. Both runs preserve native PNGs and exact root dimensions. Text and variant probes pass, and installed consumers plus source/before/after comparisons were inspected visibly. | Original captures, archives and receipts remain in `design-led-app-2026-09-19-D75s7P2Q/`. Fresh app deliveries: `native-text-app-20260920/` (Checkbox archive SHA-256 `938d86eb…a6e1d8`) and `cbds-owned-text-app-20260920/` (CBDS archive `96b35933…9dcd2a`), including font inputs, stable bracketing REST snapshots, repeat-import and visible-review evidence. Shared checker: `npm run design:consumer:check`; decisions and reversals: D.48–D.60, D.88 and D.90. | **Broader design-led acceptance remains incomplete.** The same Checkbox and CBDS app archives measured in Linux Chromium pass only **13/26** and **36/72** respectively; native PNGs, hashed consumer fonts and exact root dimensions match the macOS evidence. Linux fidelity remains open (`native-text-linux-20260920/`; D.88/D.90). Rendering-policy switches can change Linux glyph metrics; exact authored-policy tests do not qualify pixels. Altitude Tabs now retains observed child content, active styling and equal Stretch allocation. The same app archive with the source-named static font inputs passes 2/2 image pairs on both backgrounds and exact 439 × 176 px root dimensions (D.112); source-matched keyboard behavior, accessibility and source-font byte identity remain unqualified. The six historical CBDS outline failures (66/72) and Checkbox 13/26 result remain preserved; fresh packages pass without changing source designs, scorer or limit. CBDS repeat import retains identical contract bytes and all five current workspace entries; its app-copied inline export now parses and typechecks with its dependencies. Checkbox’s earlier repeat retained its then-current two entries. These results do not qualify keyboard behavior, accessibility or instance swaps. The checker uses full-bounds native exports, recorded browser origins and one common crop; earlier independent-crop evidence remains preserved. Font inputs authenticate consumer assets, not Figma’s font bytes; missing-glyph fallback remains possible. Packaging requires the local development server, CSS Modules and design fonts. Exact app-displayed download URLs yielded bytes equal to the server and installed archives; no browser save path is claimed, and the earlier Checkbox download event timeout remains recorded. No owner grade was written. |
| 3 · Updates both ways, conflicts, interruption recovery, duplicate-free repeats | **Original-source Apply, 2026-09-21:** the reviewed Checkbox disabled-opacity change now writes the original module and generated CSS through the app. All ten configured examples validate against the updated source; independent pre/post reads preserve the existing 44-node native set at float32 0.6. Restart before the write resumes with a new read; repeating the completed Apply endpoint leaves 69 source and retained operation files identical. Explicit restoration returns both source files exactly, validates all ten examples again and verifies the unchanged complete native snapshot. The unobstructed canvas was inspected after Apply and restoration. A later sealed application refuses an intervening source comment at the file-write boundary and a 70% canvas edit to four nodes at fresh preflight; both conflicts remain intact, with no source-written event (`live-conflict-v1/`). Evidence: `private/react-design-source-repair-20260921/live-apply-v1.json`, `live-apply-repeat-v1.json` and `live-apply-restore-v1.json`; [D.108](23-known-limitations.md#d108-source-application-requires-fresh-canvas-reads-and-verified-recovery). **Bound-height update, 2026-09-20:** retained state-API set `62e0264f…` changes 18.390625px → 20px and reverses through the app, including derived thumb movement and hit-area correction. Both independent readbacks pass; repeats write nothing. A before-delivery interruption resumes with one write. The original 29 nodes, 30 variables and nine PNGs restore exactly. Evidence: `private/bound-cross-size-20260920-1656/application-update-v1/`; [D.87](23-known-limitations.md#d87-pixel-dimension-value-history-does-not-authorize-a-bound-size-write). **Live on 2026-09-18, through the app and the companion in the Evaluations file, on the existing twelve-variant Checkbox set.** *Code-only change:* editing the original source (`disabled:opacity-50` → `-40`, stylesheet rebuilt) no longer orphans the native component. A recorded **source succession** lets the existing operation follow a later sealed observation of the same case; **Review compiler update** then proposed 0.5 → 0.4 on the same four existing nodes, the canvas showed 40 %, and two independent readbacks agreed. Restoring the source byte-for-byte produced the reverse change on the same nodes. An intermediate revision whose stylesheet had not been rebuilt was observed truthfully (0.5 → 1) and not applied. *Same-channel conflict:* a designer's 80 % on one of those nodes refused the write at preflight by name (`native-update-opacity-conflict:<node>`); no write claim was created. *Interrupted write:* the app was killed at the instant of write dispatch. After restart the write was not re-sent; **Resolve by reading the canvas** found the nodes untouched, and a second write under its own numbered claim was independently verified. In that run the second write followed automatically; an adversarial review of the change showed that a second or stalled companion could then execute both writes, so the rule was tightened before merge: the companion must now ask the app before executing any write and is refused once a canvas read is judging it, an untouched write stops and waits for an explicit operator decision before a new one is sent, and a write that had begun is never treated as dead. *Repeat:* reviewing, preparing and inspecting again planned nothing, reopened the same operation and wrote nothing (one write in the journal). *Design-only change:* a designer set the four disabled variants to 60 % in Figma. **Read design changes from the canvas** named exactly those four values (0.5 → 0.6) while the update stayed verified and nothing was written. After the developer changed the source to render 60 %, the same update path found both surfaces in agreement: the write program reported `no-op` with nothing changed, the independent readback verified 0.6, and the shared baseline advanced with zero canvas writes. Source and canvas were then restored. The separate state-API Switch also now demonstrates source opacity 0.5 → 0.4 → 0.5, unchanged-repeat review, a one-node conflict refusal and retry of the same correction; all native metadata and source bytes restore exactly ([D.73](23-known-limitations.md#d73-state-api-operations-follow-fresh-source-evidence-without-replacing-their-native-set)). | Private journals `27f378de…` and `ea0e4d6d…` under `private/source-native-updates/`, succession journal under `private/source-native-successions/`, index `private/two-way-live-2026-09-18/README.md`; rules and regressions in `source-reference/native-source-succession*.ts`, `native-update-write-outcome.test.ts`, `core/native-contract-update.test.ts` (float32). | **Original-source Apply is measured only for the reviewed root-opacity channel.** Subsequent native succession now retains the existing set: one owned variable changes to 0.6, all 44 node snapshots and twelve PNGs remain exact, and unchanged review writes nothing (`native-succession-v1/`). A real partial-file IO failure now resumes through the app: the installed module is retained, CSS completes, a recorded capture-control failure refuses completion, and a fresh retry writes nothing before passing all ten source examples and final native verification. Explicit source restoration and reversal of the four temporary canvas edits return both source files and the full native snapshot exactly (`partial-write-v1/`). Process termination during file replacement remains unmeasured. A separate manual native-height edit → canonical capture → app import → React archive replacement is now measured on the existing state-API Switch: nine updated 32 × 20 px roots pass both backgrounds (maximum 2.662% white / 2.083% black), and the original consumer passes 54/54 state/callback trials after upgrade and again after rollback without source edits. Only the archive’s height token changes. Native snapshots, bindings and ten PNGs restore exactly; npm normalizes one equivalent local archive path in the consumer manifests. This does not qualify automatic repair or source-to-native bound-height updates ([D.72](23-known-limitations.md#d72-a-native-height-edit-returns-as-a-package-update-without-changing-the-state-api)). Outside the bounded reviewed root-opacity channel, the developer edits the hand-written React; the tool reports the designer change and checks agreement. That read exists only on the tip of a correction chain, not yet on an operation that has never been corrected. Updates cover only the bounded correction channels (opacity, literal dimensions on empty flex roots, root shadow stacks, simple SVG strokes, background layers); any other source difference refuses by name. Root families seal a content-derived component name at observation time, so an edit to a root's own matrix refuses (`bound-token-change-unsupported`); initial-state sets compile under the existing identity. Re-reading a *parent* operation after a written correction used to break that operation's correction chain; the app now refuses that read by name (`react-parent-observation-superseded-by-correction`) and points to the latest correction instead. The Button root family was re-read before that guard existed, which stranded its correction chain. The app now recovers the exact pinned parent prefix while validating the entire current journal, and requires a fresh correction read tied to the current parent before reuse. Live **Inspect update again** restored verification: 191 node snapshots, token data and 63 PNGs match the prior result, with one historical write and no repeated write. The parent journal is unchanged; later reads remain evidence. See [D.64](23-known-limitations.md#d64-a-later-parent-read-must-not-strand-a-verified-correction) and private `native-parent-baseline-recovery-tsv6lvyo/`. This restores the supported correction path; broader repair channels remain unqualified. This run also exposed and fixed a write defect: a value float32 cannot hold exactly (0.4) was written correctly, then misread as a conflict. *Landed-write recovery shown live on 2026-09-19:* Switch update `b5b224ff…` was interrupted after its real `begin`, the companion closed, and the operator attested through the application. Reopening replayed a saved result after revocation; the app kept it as evidence only. **Resolve by reading the canvas** found the same three disabled nodes and owned variable at float32 0.4, and a separate read verified the correction. Late delivery does not prove the old companion was alive at attestation time; the review copy now says so (AGENT decision and reversal in §B.40). Evidence: `private/begun-write-recovery-2026-09-19-kg6h29ab/`. The untouched and late-execution interleavings remain synthetic. If the companion was granted permission to begin a write and then died, an operator can now say so. **Attest the companion is gone** (`…/update/<proposal>/attest-dead`, POST with no body) records `update-attempt-attested-dead` (attempt id, the fixed operator statement, time). It is accepted only when the latest write was begun and is unresolved and no companion for the update has polled in the last 15 seconds; the page also waits a minute after `begin`. Otherwise it refuses by name (`native-update-attest-dead-no-write`, `-write-not-begun`, `-write-answered`, `-observation-in-flight`, `-write-settled`, `-companion-connected`). Attesting the same unsettled write again records nothing. The attestation revokes that attempt, so a later `begin` is refused. A later result is kept as `late-result-after-revocation` and never counts as the outcome. Before the settling read it is evidence only. After the read it is judged by the same allow-list as any late write result: a result that contradicts the read stops the update (`native-update-late-write-result-contradicts-canvas`). A canvas read dispatched after the attestation settles the write exactly as for a write that never began: untouched waits for **Preflight again and send a new write**, completed continues to verification, anything else stays `update-recovery-required` by name. The correction chain unfreezes. **Residual risk, stated plainly:** revocation is app-side. The app cannot stop a companion that is in fact alive and already past `begin`: its pinned program can still execute after the settling read. That program is guarded and idempotent. It writes only over the exact saved or proposed values, so over a verified canvas it is a `no-op` and over a designer's edit it refuses. If it writes without reporting after an untouched settlement, it is detected only if the operator re-arms: the first later preflight that actually reads the canvas names `native-update-canvas-moved-after-revoked-settlement`, including a preflight that refused. Without a re-arm nothing in this operation detects it. If it lands between the re-armed write's preflight and its execution, both programs write the same values, the re-armed write is a `no-op`, and the update verifies; that interleave is benign. A canvas-side revocation token was considered and rejected (reasons in [docs/23 §B.40](23-known-limitations.md#b40-a-revoked-update-write-can-still-execute-late)). Tests: `source-reference/native-update-write-outcome.test.ts` and the actual companion in `native-update-jobs.test.ts`. The synchronous native listing still blocks other app requests while it is read. Response-scoped reuse reduced a read-only probe of the retained shadcn history from 32.7 to 17.4 seconds with byte-identical output; the independent-family listing changed from 7.8 to 7.0 seconds. A later 112,792-byte independent-family history measured 11.59/11.55 seconds before and 9.71/9.84 after reusing plain failed reads within the same response, with identical output. These are individual local measurements, not a latency guarantee or a new companion timing result ([D.65](23-known-limitations.md#d65-native-review-reuses-evidence-only-within-one-response)). A value change to an owned, allocated number variable is carried only after the current document-wide binding and alias guard passes ([D.74](23-known-limitations.md#d74-variable-updates-inspect-document-bindings-before-writing)): the same guarded update writes the variable's value by its pinned id together with the literal changes, and any other token change still refuses by name (`native-update-bound-token-change-unsupported` only when something is bound). **Shown live on 2026-09-19 on the independent family** (Switch initial-state operation `a9e6d704…`, nine variants, Evaluations file): the developer changed `data-disabled:opacity-50` to `opacity-40`; before this rule the review refused `native-update-bound-token-change-unsupported:changed;…root.opacity.true` although nothing was bound. With it, one proposal carried three variant literals and variable `VariableID:81:795` 0.5 → 0.4; the companion ran preflight → `begin` → write (`updated`, 3 nodes + 1 variable) → independent readback 0.4000000059604645 on all four → `update-verified`. A second review planned and wrote nothing (no new plan or journal file). The source was then restored byte-exactly and the reverse proposal carried all four back to 0.5, returning the variable to its allocated value → `update-verified`. Evidence: `private/independent-family-update-2026-09-19/README.md`. That historical write used a page-only check and cannot authorize another variable write. **Current guard shown live on 2026-09-20:** a consumer on another page made preflight refuse before any apply claim (64 pages / 1,468 nodes), with both owned pages, 30 variables and 19 PNGs unchanged. After removing the three probe nodes, the same proposal scanned 63 pages / 1,465 nodes, changed only three disabled literals and their owned variable 0.5 → float32 0.4, and independently verified the result. Restoring the source produced a verified reverse update to 0.5; all source bytes, native snapshots, bindings and 19 PNGs restored exactly. The refusal remains immutable history. Hidden-instance, text-range, style, vector, alias, unavailable-scope and oversized-document cases remain synthetic adversarial coverage. Historical programs retain their exact bytes; old pending or begun variable proposals cannot obtain new write authority. Evidence: `private/document-binding-live-lwtcu999/`; scope and reversal: D.74. This run also fixed cohort-anchor selection for stateful source succession, recovered the original callback evidence without dropping its refusals, and verified refreshed evidence through a zero-property `no-op` with identical 29-node readback, token data and nine main PNGs. A subsequent unchanged review reused it with all 269 plan/update/succession files byte-identical ([D.75](23-known-limitations.md#d75-stateful-source-identity-does-not-depend-on-the-archive-anchor)). |
| 4 · An independent component family without component-specific fixes | A declared shadcn Badge/Alert/Switch workspace completes source validation and structure observation (7/7), with native creation through the app using shared rules. The app also demonstrates a bounded generated Switch consumer: 54 source-matched input/action trials, live initializer changes and caller-held versus accepted callbacks. | `recipe/evidence/react-native-declared-family/`, `react-native-matched-capture/` and `react-native-matched-content/` retain authenticated native evidence; `npm run react:native:declared:check` recomputes it. Private app journals: `independent-family-2026-09-18/`, `independent-native-return-qz7pgw9f/`, `native-editability-o9ymb37r/` and `callback-candidate-isolation-nmtqn4yw/` and `stateful-native-return-1e6l8my3/`. | **The complete independent family remains unqualified.** Switch: nine app-created editable mains have exact 32 × 18.390625 roots. Guarded matched frames pass 9/9 on both backgrounds (maximum 4.167% white / 2.399% black); the app review is visible and native variant edits restore byte-identical snapshots and images ([D.62](23-known-limitations.md#d62-guarded-matched-frames-preserve-source-phase-and-original-evidence)). Native capture → app import → prepared React archive → isolated consumer preserves those nine root sizes and independent state maps after shared fixes ([D.66](23-known-limitations.md#d66-returning-native-fixed-controls-preserves-dimensions-and-independent-axes)); a separate matched-frame check passes 9/9 (4.167% white / 2.273% black). Standard layout-only capture still refuses shadows. The retained thumb remains unqualified. Both the initial-state and separate state-API operations now have all nine hit areas corrected exactly, independently verified twice, with unchanged PNGs ([D.85](23-known-limitations.md#d85-transparent-pseudo-geometry-needs-independent-box-evidence)). A fresh state-API cohort created through the app also has nine exact hit areas, confirmed by two application reads and a separate Console read; repeat preparation allocated nothing, and both earlier sets stayed unchanged. This does not qualify its thumb geometry or full visual/behavioral journey. The source-state experiment passes 54 activation trials with 81 exact restorations and repeat reuse; nine excluded inputs and three broad refusals remain explicit ([D.67](23-known-limitations.md#d67-callback-inspection-retains-restored-candidate-refusals), [D.68](23-known-limitations.md#d68-a-separate-check-observes-simultaneous-state-inputs)). The generated app preview passes all 54 trials ([D.69](23-known-limitations.md#d69-observed-boolean-state-inputs-project-into-the-existing-toggle-model)). A separate app state-API operation now completes native creation, independent readback, canonical capture, app import, archive preparation and clean installation ([D.71](23-known-limitations.md#d71-a-separate-app-operation-preserves-the-observed-state-api-through-native-return)). Its installed React consumer matches all 54 source trials, including live inputs, disabled behavior and callback values. Native instance edits restore identical properties and image bytes. Fresh matched frames pass 9/9 in each direction at the same maxima quoted above; exact descendant geometry and hover/focus/dark/responsive states remain unqualified. This same state-API operation now completes a guarded source-opacity update, named same-channel conflict, retry and exact rollback without replacing its native set ([D.73](23-known-limitations.md#d73-state-api-operations-follow-fresh-source-evidence-without-replacing-their-native-set)): three root values plus one owned unbound variable, fresh 54-trial experiments, unchanged-repeat review, and exact restoration of two pages, 30 variables and 19 PNGs. Broader live updates remain unqualified. A subsequent manual native height edit returns through the app as a same-API package update; nine updated images and 54 source-matched trials pass, including same-consumer replacement and rollback ([D.72](23-known-limitations.md#d72-a-native-height-edit-returns-as-a-package-update-without-changing-the-state-api)). A separate retained state-API set now also completes the guarded bound-height update and reverse in D.87; historical operations require fresh sizing facts before this path is eligible. Alert: guarded 360 × 68 frames pass 3.064% white / 3.100% black; caller text is editable and restores exactly, but caller sizing and deeper composition remain bounded. Badge: exact-size refusal remains, 43.875 px source versus 44 px native; fixing native text width clips content and was rejected ([D.63](23-known-limitations.md#d63-native-auto-width-text-and-fractional-source-width)). The declared family shares shadcn styles with the built-in cohort. A second code-led library, Radix Themes, validates 4/4 sources but all native drafts refuse content ownership. The explicit shipped-JSX intake validates and traces **4/4** cases, retaining Theme context, all original images, measured trees and component ownership. Its two Button baseline inputs now compile root drafts from sealed, instance-specific content evidence. The app prepares one solid Button candidate; repeat preparation reopens the same operation and preserves all 1,820 earlier native journal and transport files. No native creation or fidelity is established by this preparation. Both Switch baseline inputs now create editable native compositions through the application with preserved dependency identities. White-background comparisons measure 0% unchecked and 1.4286% checked. The checked appearance returns through native Send, app import and download into a clean React consumer; a separate guarded full-frame return comparison passes at 1.0121% white and 0% black. These two captured inputs do not establish a state API. A separate authenticated composition inspection now records all three initial inputs with restoration and 46 callback trials, identifying controlled `checked` and initial-only `defaultChecked`. That broad result failed for `inert=true`; the corrected fresh inspector now completes 48 trials and 72 restorations. The unchanged installed return matches four inert input/action sequences, eight transitions and live input updates ([D.152](23-known-limitations.md#d152-inert-keyboard-and-label-outcomes-are-distinct)). A later separately pinned combined-state check completes nine input combinations and 27 restorations. The app delivers that authored state graph to editable Figma and returns it through native Send, import and archive download into a clean installed React consumer: all 18 keyboard/label sequences and 36 activation transitions match the source, with callback values, live input updates and mounted child geometry retained. All six native/consumer image pairs pass at a maximum 0.8421%; original/native white comparisons pass at a maximum 1.4286%. Excluded inputs and state-graph updates/recovery remain unqualified (D.151; `private/authored-state-native-v229/`). Repeat preparation allocates nothing extra; loading, alternate targets and other input combinations remain unqualified ([D.146](23-known-limitations.md#d146-recorded-content-evidence-does-not-prove-every-input)). A separate Radix Separator cohort now validates and traces **2/2** cases through an explicit text-absence witness; all five applicable corruption controls reject. Native generation still refuses unresolved child ownership, with all 1,244 prior native journal files unchanged ([D.77](23-known-limitations.md#d77-textless-originals-require-an-explicit-absence-witness)). The CBDS design-led app journey now passes 72/72 on both backgrounds (row 2); this does not qualify its reverse journey or the independent code-led family. No component-specific converter or threshold change was introduced. |
| 5 · Installation, current documentation, supported limitations, acceptance evidence | [User journeys](../docs/USER-JOURNEYS.md) documents installation, import, local React archive preparation, fonts and CSS Modules requirements. [React V1 scope](../docs/REACT-V1-SCOPE.md) and the limitation ledger define supported paths and refusals. This table records measured app outcomes and remaining gaps. A clean macOS installation of the local candidate now starts with schema/core preparation and the pinned Chromium install. Its Badge fixture import produces a browser-downloaded archive that installs byte-identically in a separate React consumer; text edits, all five variant selections and restoration were verified in the production build. This covers fixture onboarding; live-Figma fidelity and full release qualification remain open. | `npm run docs:check`; the cold-install application and consumer evidence in `private/cold-install-v209/`; the private live evidence named in rows 1–4; source-workspace instructions in `source-reference/README.md`. | Automatic discovery of arbitrary React repositories remains unproven. Radix Themes 3.3.0 Button and Switch matched their original renders, **4/4**, with five negative controls rejected per representative, but every native root refused `react-root-visual-source-content-unqualified` (private `radix-app-2026-09-19-qzxluzxc/`). The earlier engineering PR train and source-readiness #160 are merged. Native text-template integration is merged in #161; reviewed root-opacity source repair is merged in #162 after local validation, adversarial review and green hosted CI. Authenticated template color updates are merged in #163 with measured forward, repeat, conflict, reverse and delivery-interruption retry evidence; broader template repair and caller creation remain open. The existing engineering PR train is now merged through #180, including prepared-library native readback and explicit Fill verification. Guarded contextual Radix content projection is installed in the local app; integration into main remains open. V1 is not release-qualified until the independent-family and other named acceptance gaps close. |

The latest independent code-led extension is the React DaisyUI root-text-template
journey summarized above and in [D.99](23-known-limitations.md#d99-native-root-text-templates-still-need-an-application-journey).
The application creates 100 editable native mains with independently verified
variables and structure. Its returned package now preserves text styling and
passes all 100 original-versus-returned React image pairs on white. This closes
the earlier missing-text-binding return defect described in D.98.

The native caller's baseline still fails at 8.43%. A live source-color update now
passes independent verification on the retained mains and caller. A delivery
interruption before the write began now settles through a fresh canvas read,
and an explicit new write verifies independently; broader interruption cases
and full visual qualification remain unfinished. The full inherited source API is incomplete;
Broader Radix content ownership remains unqualified beyond the two recorded
Button inputs described in D.146. This does not close the
independent-family requirement. Earlier missing paint, typography and sizing
results remain preserved in their private journals and limitation entries;
they are not the current returned-package result.

The app now also creates a new caller after that verified source update and
independently verifies its link to the retained main, native slot and text.
Native text editing and visible restoration were demonstrated. A combined
no-op now independently verifies both callers, including the restored text,
with all main and caller records and images unchanged. An unchanged app review
reuses that correction without adding or changing any of the 1,535 retained
journal files. The next real source change now also passes: 11 color assignments
restore all 302 main records and 100 main images to the preserved purple baseline;
both callers match the original purple pixels, with only intended paint changes
and all 1,535 earlier files preserved. The application reports current verification,
and both instances were inspected with the companion closed. This run took 11.4
minutes from preflight dispatch to final receipt, excluding preparation and UI
refresh. Broader recovery and usable performance remain unfinished. The comparison
still measures 49.92 px source versus 51.02 px native width ([D.115](23-known-limitations.md#d115-caller-source-succession-preserves-the-mains-original-provenance)).

A separate synchronous-failure proof now interrupts a template color update
after two actual assignments. The guarded writer restores both values; a
separate read confirms the original 302 main records, 100 images and both callers.
The app closes the failed attempt and requires an explicit fresh preflight. The
production companion then succeeds under a new write claim, and a reviewed
reverse update restores the complete original native observations and images
and all four source files. All 2,185 earlier evidence files remain unchanged.
This uses a separately pinned test companion to inject the error; it does not
qualify spontaneous API failures, OS crashes, arbitrary partial writes or the
full recovery requirement. Terminal app states and the unobstructed canvas were
inspected; long host/display delays remain unresolved
([D.135](23-known-limitations.md#d135-a-synchronous-template-assignment-failure-can-restore-its-attempted-values)).

Long correction histories now reuse only the authenticated predecessor/caller
pins and written-history projection needed within each synchronous display. An
isolated comparison reduced the mean of two warm reads from 64.0 to 52.3 seconds
with identical complete responses and all 2,204 native files preserved. Callers
keep independent copies, and subsequent requests and write authorization recheck
fresh evidence. The adopted app reopens the same verified correction; an actual
HTTP read takes 56.9 seconds with identical response and native evidence bytes.
The remaining delay is still unqualified
([D.136](23-known-limitations.md#d136-history-traversal-copies-only-the-evidence-each-display-check-needs)).

Intermediate delivery polling now reads a narrow journal progress response;
completion still requires the full verified listing. Repeated progress requests
for the retained update took 0.61–0.65 seconds, while a full listing took 96.01
seconds. Startup and whole-operation performance remain unqualified; these are
different read operations, not a complete update speedup ([D.117](23-known-limitations.md#d117-delivery-progress-is-separate-from-result-verification)).

The companion's upload now acknowledges durable result storage separately from
the app's full verification. A saved-result replay preserves the exact verified
view and all retained journals; the receipt does not grant source freshness or
native qualification. The first full listing still took 223.6 seconds in that
measurement, so complete operation latency remains unfinished
([D.119](23-known-limitations.md#d119-a-stored-native-result-is-not-a-verified-conversion)).

A separate foundation plans template token changes and verifies current
component values while retaining the original allocated identities. An
engineering writer now rechecks the complete component and document-wide
consumers synchronously before assigning existing variable values. Its tests
cover interruption, stale retries, intervening edits, unchanged repetition
and reversal. Existing caller observations now admit only their verified
instance subtrees; missing records or intervening caller edits refuse. A live
read-only preflight passed for five main variants and their recorded caller,
with independently verified unchanged observations and no assignments.
An independent read command now observes the component and all recorded
callers together, including partial value states; it also passed against the
retained native set without writes. Its diagnosis distinguishes unchanged
evidence from supported structure and grants no recovery or settlement
authority. A compact proposal restores the same guarded program while avoiding
repeated parent evidence in each caller record.
An exact value-propagation check now verifies selected native scalar, paint
and font changes while preserving every other recorded field. Changed computed
geometry remains a named refusal. In a live engineering run, one existing
color variable updated five main variants and their retained caller; the
separate read passed, and a guarded reverse update restored all 302 main node
records, five caller records and the caller image exactly. This used a synthetic
source successor, so it is not an application update or a fidelity result.
The application journal reader now inventories retained template callers from
fully validated operation histories, including their current journal revisions.
It refuses pending or unverified callers, changed parent identities and corrupt
history. Written updates can retain an original observation only while the
complete later journal remains valid and read-only. A read-only check loaded
the retained application's 302-node main and five-node caller; this inventory
does not authorize delivery or qualify an update.
An application adapter now connects fresh desired graphs and authenticated
caller history to compact update proposals, existing transport and independent
combined readbacks. It admits color changes while refusing geometry-affecting
changes before delivery. Journal/companion tests cover forward update, unchanged
repeat, exact reverse, caller-context refresh, conflict and lost-write settlement
across restarts. Updated main and caller exports are available in the review;
an intervening edit during export refuses the observation. Template-to-original-source
repair remains unavailable; the existing opacity repair path is kept separate.
The tests cover more interruption interleavings than the bounded live case below.
A real source-color change now passes validation and structure tracing, follows
the existing component, and updates 11 existing color variables through the
application. The independent read verifies all 302 main records and five caller
records with no other differences, retaining the same nodes and variables.
The unobstructed Evaluations canvas shows the blue caller, and the application
shows the completed update. Its source-to-native fidelity has not been remeasured.
The earlier identity refusal remains preserved: the SDK resolves the saved and
current caller text IDs to the same object. New proposals admit that transition
only with a complete slot-allocation proof and fresh SDK lookup equality; other
content, geometry, binding and ownership changes still refuse. Historical
proposal programs retain their exact bytes.
After a fresh application session, an unchanged review planned and wrote nothing;
all 1,470 retained main, update, proposal and succession files stayed byte-identical.
A deliberate intervening native color edit then refused at preflight with zero
attempted assignments. Restoring that value and retrying allowed the application
to deliver the reverse source change. Independent verification restored all 302
main records, five caller records, variables and 101 exported images to the original
purple baseline. The unobstructed canvas and completed application status were
both inspected. These results cover source-color forward, repeat, conflict,
retry and reverse.

**Live interruption and explicit retry, 2026-09-22:** after the transport claimed
a new purple-to-blue write, the app process was stopped before any `begin` or
write result. The companion was closed before restart. **Resolve by reading the
canvas** dispatched a separate read; it matched all 302 main records, five caller
records, variables, graph receipt and 101 image hashes to the untouched purple
baseline. No second write was sent. The application showed **update write
untouched** and required **Preflight again and send a new write**. Selecting that
control created a fresh preflight, a distinct numbered write claim and a new
`begin`; 11 intended colors changed. Independent readback matched the earlier
verified blue result exactly. All evidence and the original apply claim from
before the retry stayed byte-identical. The unobstructed native canvas was
inspected after both settlement and retry. Source and native output remain blue
in this isolated test workspace. This demonstrates a delivery interruption
before `begin`; it does not establish every begun-write or late-execution case.
Private receipts: `interruption-untouched-exact-v2.json` and
`interruption-rearm-exact-v1.json` under the integration directory below. The
first diagnostic helper incorrectly compared desired-plan graph revisions;
its failure is preserved, and the corrected helper compares native graph receipts
while retaining the unchanged product matcher.

Subsequent source updates across both callers, comparison refresh/repair
transitions and visual/layout qualification remain unfinished. A read-only JavaScript profile
of an earlier saved-inspection listing took 75.7 seconds. A later five-proposal
history measured 68.2 seconds cold and 30.1 seconds repeated after exact-byte
prepared-plan reuse, with identical responses and unchanged journals. These are
different history states, not an A/B speedup claim; reopening remains too slow.
Private evidence:
`native-template-app-integration-20260921/` and
`native-template-caller-identity-20260921/`.

Conversion stays deterministic and needs no AI at runtime: readers, compilers, writers and verifiers are pure functions of authenticated inputs, and every result above is reproducible from its recorded evidence.

**AGENT decision — variable-update preconditions, 2026-09-20.** New variable
proposals load every page and, after the last asynchronous read, check live node
bindings, text ranges, local styles and all local variable aliases without
pausing before assignment. Unavailable scope or more than 10,000 nodes refuses.
A live cross-page consumer refused before any apply claim; removing it allowed
the same proposal to update and reverse with exact restoration. Historical
page-only programs stay byte-identical evidence and cannot receive new variable
write authority. See [D.74](23-known-limitations.md#d74-variable-updates-inspect-document-bindings-before-writing)
for measured scope, residual risk, adversarial coverage and safe reversal.


### Evidence recorded on main, 2026-09-22 to 2026-09-23

These paragraphs were recorded on `main` by the engineering PR train (#170–#180) while
the V1 checkout recorded the entries above. They are retained verbatim here after the
branch integration; none of them completes a V1 row.

Newly prepared React library downloads retain their validated input and archive
on local disk. A saved download URL survives a local server restart, and exact
repeat preparation reuses its retained artifact. Changed, incomplete or unsafe
artifact files refuse instead of being silently replaced. This improves download
recovery; it does not restore the displayed link or imported workspace context
after a browser reload, recover older in-memory links, or qualify native return.
The prepared-library native route now uses the same durable operation journal.
Its request selects a saved archive, theme and brand; the host fixes the evaluation
file and native identity. HTTP/transport checks cover server restart during
creation, identical acknowledgement redelivery, complete state inventories,
changed dependency refusal and read-only recovery without duplicate allocation.
It records archive/input provenance and does not claim an observed React source.
The Playground links its saved download to a separate native inspection page.
An isolated browser review prepares and reopens the same operation after page
reload and server restart, with all retained files unchanged. The primary
app/plugin journey and visual fidelity are not yet qualified. The native route
currently requires a named brand in the retained input. The original retained
Tabs input still refuses on unsupported
per-prop grow semantics in this checkout; no property is stripped to admit it.

The native graph verifier now checks caller slots below inherited wrappers
against their source main's hierarchy and allocation stamps. This corrects a
regression-tested refusal; historical Card readbacks remain unchanged. The
bounded nested-host application evidence below exercises the corrected path
([D.125](23-known-limitations.md#d125-deeper-caller-slots-require-the-inherited-main-hierarchy)).
Source inspection now distinguishes children passed inside static JSX wrappers
and checks the host path against React ownership. Bounded caller generation
retains the owned hosts and places caller content in the identified nested
slot. Browser and native fixture checks cover repeated wrappers and editable
caller text. The separate application probe below demonstrates bounded delivery
and recovery; wider content projection and full fidelity remain unqualified
([D.126](23-known-limitations.md#d126-nested-source-children-need-an-explicit-host-path),
[D.127](23-known-limitations.md#d127-nested-caller-slots-preserve-their-owned-hosts)).

A shared renderer correction preserves text and slot-content property bindings
when the same node also has a visibility control. Isolated native fixtures verify
correction with retained main IDs and property keys, working instance label and
visibility edits, and an unchanged repeat. The retained imported Button still
has the earlier missing text bindings; its complete application return remains
unqualified ([D.157](23-known-limitations.md#d157-visibility-must-preserve-other-property-bindings)).

used a fresh tab with React output selected. Bounded template color updates and
interruption recovery now have measured [application evidence below](#v1-acceptance-evidence).
Native fidelity, broader update and recovery behavior, and the complete
independent-family journey remain unqualified
([D.99](23-known-limitations.md#d99-native-root-text-templates-still-need-an-application-journey)).

passes independent verification on the retained mains and caller. Bounded
interruption recovery is measured below; broader recovery and full visual
qualification remain unfinished. The full inherited source API is incomplete;
Radix content ownership remains a separate refusal. This does not close the

The app now also creates a new caller after a verified source update and

A separate controlled companion closure now demonstrates recovery after the
write finishes but before its result is saved. The app settles the outcome by
reading the canvas, then independently verifies it: one write and one begin,
no write result, and two equal reads of all 302 main records, 100 main images
and both callers. All 2,064 earlier evidence files remain unchanged. The app
reports current verification, and both unobstructed instances and the app
gallery were inspected. Reopening the companion and resuming after its held
recovery work finished were required. Host delays and an obscured interruption
message remain usability gaps; this does not qualify arbitrary partial writes,
OS crashes, native fidelity or V1 ([D.121](23-known-limitations.md#d121-a-completed-write-can-be-recovered-without-its-result)).
The unchanged production companion then applied the reviewed reverse correction
once. A separate read restores the complete original purple main and both
callers, including every retained image; all four source files and 2,085 earlier
evidence files match their original bytes. The app reports current verification,
and both unobstructed native callers and the app gallery show the restoration.
The long host and display delays remain a release gap.

The host's pure template-match cache now retains a larger bounded correction
history. A read-only prototype preserved the complete response and all 2,104
native evidence files while reducing one repeated listing from 100 to 55
seconds. After adoption, the app reopens the same current verified correction;
its real HTTP response matches the saved bytes and creates no native event or
write. Source and write authorization are unchanged. Usable latency remains
unqualified ([D.123](23-known-limitations.md#d123-replaying-a-correction-history-must-not-evict-every-useful-match)).
Within a single history response, ordinary JSON evidence now uses a guarded
copy path. A full-history prototype preserves the complete response and all
2,104 native evidence files while reducing one repeated read from 55 to 49
seconds. Richer values retain the original copy behavior; freshness and write
checks are unchanged. After adoption, the app reopens the same verified
correction and a real HTTP read takes 51 seconds with identical response and
evidence bytes. The remaining delay still prevents latency qualification
([D.124](23-known-limitations.md#d124-display-copying-must-preserve-the-values-it-is-copying)).

Those interruption and recovery cases remain synthetic native-host coverage.

Single-caller forward and reverse color changes, unchanged reviews, refusal of
an intervening native color edit, and recovery from an interruption before the
write began are measured separately. Additional caller creation and a combined
unchanged review are now measured above. Subsequent source updates across both
callers, broader recovery, comparison refresh/repair transitions and visual/layout
qualification remain unfinished. Private evidence:

### React V1 acceptance surface

These are requirements to verify, not a list of features already qualified:

| Capability | Required evidence |
| --- | --- |
| Layout and styling | Supported sizing, alignment, spacing, typography and paint preserve their meaning; original and target renders are independently compared. Unsupported CSS is named. |
| Tokens and themes | Token identities, values, aliases and supported modes survive conversion and edits. |
| Properties and state | Text, enums, booleans and omitted values retain their semantics; declared interactions are tested separately from appearance. |
| Content and composition | Nested identities, parent-to-child property mappings, editable text, named slots and supported instance choices survive. Include a table, form or dialog-scale composition. |
| Delivery and maintenance | A clean consumer installs generated React; Figma output remains editable; authorized updates work both ways; conflicts, interruption, rollback and unchanged repeats are verified. |

Do not expand every property combination blindly. Cover each supported rule, its known interactions and representative compositions, then exercise an independently selected cohort. If a combination is unverified or unsupported, report it. A component-specific exception does not establish a general rule.

For every milestone, report:

- **Outcome:** what a user can now complete, through which interface.
- **Coverage:** selected components, states, themes and composition features, including failures and refusals.
- **Fidelity and usability:** original and target renders plus independent semantic, structural and editability checks.
- **Manual intervention:** setup, mappings, scripts or repairs still required.
- **Reliability:** changed inputs, missing prerequisites, conflicts, interruption and repeat behavior.

Do not tune source styling or comparison thresholds to make a candidate pass. Native Figma evidence must come from actual native nodes, not an HTML imitation. Preserve existing signed evidence and leave release approval to the owners.

## Architecture and boundaries

The contract records supported semantics: identity, properties, anatomy, token references and modes, layout, content/slots, component references and declared behavior. Rendering representations are projections of that contract. They do not become competing sources of truth.

Code-led contracts may retain an immutable reference to a host-verified original runtime. Only qualified editable channels may alter that runtime; preservation does not make every design edit effective. Design-only observations cannot supply undeclared business logic or authorize executable dependencies.

| Connection | Responsibility |
| --- | --- |
| Figma REST | Read file/node observations for imports and drift checks. |
| Companion Figma plugin | Execute the shared engine's native operations and return observations. The development plugin connects to the local app on port 5181 using an operation-specific capability; native qualification is still pending. |
| Figma MCP / Desktop Bridge | Engineering access for native execution and screenshots. A successful engineering probe does not prove the application journey. |
| CLI and local application service | Invoke the same deterministic readers, compilers and verification logic; retain operation state. |

The paused Lit source workflow uses a configured sibling library. Each run must check the actual source and dependency identities; old captures do not establish current-source parity. Engineering writes are limited to Scratch and the user-provided DS Contracts Evaluations file. Existing operations remain bound to their original file; a new target requires a new operation identity. Altitude and CBDS remain read-only references.

### Implementation map

| Responsibility | Existing implementation to reuse |
| --- | --- |
| Browser engine imports and emitters | `playground/vite.config.ts`, `playground/src/engine/emitters.ts`, `core/index.ts` |
| React and Figma contract proposals | `playground/src/engine/code-import.ts`, `playground/src/engine/figma-import.ts`, `extract/figma/rest/fetch.ts` |
| Contract-to-Figma programs | `core/emit-figma-script.ts` |
| Canonical recipe canvas IR and writer | `recipe/figma-ir.ts`, `recipe/figma-writer-runtime.ts` |
| React source intake, paused Lit workflow and reusable observation infrastructure | `source-reference/`, especially `source-reference/compile.ts` |
| Application-owned source candidate jobs | `source-reference/service.ts`, `source-reference/candidate-jobs.ts`, `source-reference/candidate-run.ts` |
| Verified evidence selection and candidate inventory | `source-reference/binding-jobs.ts`, `source-reference/candidate-report.ts`, `source-reference/button-candidate-semantics.ts` |
| Unaccepted source-owned visual candidate | `source-reference/source-bound-anatomy.ts`, `source-reference/source-visual-seed.ts`, `source-reference/source-visual-contract.ts` |
| Verified original runtime preparation and React lowering | `source-reference/runtime-artifact.ts`, `core/runtime-emission.ts`, `core/emit-react.ts` |
| Runtime identity preservation and adoption refusal | `core/runtime-reference.ts`, `packages/core/src/contract-provenance.ts` |
| Actual plugin host | `figma-sync/plugin/engine/entry.ts`, `figma-sync/plugin/code.js` |
| Drift classification and merge computation | `core/channel-diff.ts`, `core/three-way-merge.ts` |
| Observation, baseline ledger and plan-only coordinator | `sync/observe.ts`, `sync/ledger.ts`, `sync/spine.ts` |

## How drift must be detected and repaired

Compare fresh code and canvas observations with the last mutually verified baseline.

- **Neither changed:** report a verified no-op.
- **One changed:** propose its supported changes and apply only under recorded authority.
- **Both changed:** combine compatible edits; report unresolved same-channel conflicts.
- **Inputs became stale:** reobserve and replan before writing.
- **Execution failed or was interrupted:** preserve operation and target identities; recover or roll back owned changes under checked preconditions. Do not advance the baseline on partial success.
- **Evidence is unavailable:** report the missing source, font, asset or connection. Unknown state is not synchronized state.

These are required product behaviors. The full loop remains unqualified.

## Keeping the public status current

Every pull request should state the user-visible outcome, validation, remaining limits and next milestone step. Update this page when usability, coverage or milestone status changes; say explicitly when a change improves internal machinery only. A merge does not imply deployment or a published package.

Keep the README focused on the product and present usability. Keep detailed experiment logs, handoffs and superseded working narratives in the gitignored `private/` archive. Reproducible fixtures, CI inputs, public technical references and signed evidence remain with their checks; housekeeping must not break reproducibility or rewrite grades.

When resuming work, read this page, [AGENTS.md](../AGENTS.md) and [CONTRIBUTING.md](../CONTRIBUTING.md), then verify the current worktree, source and PR state. After two attempts without new evidence, diagnose and replan.

### Checking these pages

`npm run docs:check` validates public claims and links. `npm run test:playground` includes canonical-document integration checks. `npm run site:build` builds the documentation site. The desktop/mobile documentation smoke test is `npm run test:product-overview:browser` with local servers on ports 5181 and 5182. These checks validate documentation surfaces, not conversion readiness.


### Nested source host integration, 2026-09-22

The Sources application now delivers an authored composition containing two native
panel instances, each with a retained heading, nested body host and separate
editable caller text (D.125–D.130). Source validation and all five corruption
controls passed. Independent native readback found the expected 18 nodes, and a
bounded edit of the first caller text left the other caller and headings intact.
After restoration, the native PNG was byte-identical to its initial export; a
fresh readback retained the graph while accepting Figma's remapped slot IDs.

Nine fixed host boxes match the source exactly. The matched 800 × 228 source and
native images differ by 0.276864% using the existing anti-alias-aware comparison,
below the unchanged 5% limit. Exact text advances still differ, and native font
byte identity is unqualified. This is one authored application probe, not
independent-library coverage or complete native fidelity qualification. Full V1
acceptance remains open.

The graph review exposes repeat inspection and interrupted-readback retry after
successful delivery, plus reconnection after reloading the app. A queued readback
was retried through these controls after browser reload; the same 18-node graph
and exact native PNG were retained with no new creation command. Broader native
write interruption, update conflict and two-way recovery qualification is still
pending.
