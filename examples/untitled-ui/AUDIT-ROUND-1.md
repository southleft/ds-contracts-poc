# Untitled UI round — first-pass fidelity audit (2026-07-30)

**Verdict, in the owner's words: "I can't tell what any of these things are." Correct.**
The first canvas→code pass (15 Untitled UI sets → generated React in Storybook)
fails the recognizability bar on most components. This document is the complete
defect ledger: 97 findings from a 7-agent audit (6 visual auditors comparing
every story's pixels against the dump's per-variant ground truth + 1 code
root-causer), deduplicated into 13 classes, each localized to ONE pipeline
stage with evidence. This ledger is the work order for the fix rounds; nothing
in it is explained away.

Method: audit workflow `wf_60c986ab-d01`; screenshots + per-agent findings in
the session scratchpad; dumps (ground truth) in `examples/untitled-ui/dumps/`.
The three inter-agent contradictions were resolved (recorded at the end), and
the owner's "sizes render identically" report was REFUTED numerically but
explained: md/lg/xl differ by 2px steps of padding only, because the size
axis's other channels fell to other classes below — visually identical is the
honest description even though the boxes differ.

## The 13 classes, by stage

### unconditional-parts (everything-at-once)

- **Stage:** propose-invert · **Severity:** BLOCKER — the single largest class; makes 5 of 9 components unrecognizable (ProgressBar tooltips, Slider tooltips, InputFieldBase all-three-type-structures cohabiting, DropdownListItem stub soup, ProgressCircle label no-op; ButtonBase Text/circle ungated)
- **Components:** ProgressBar, Slider, Tooltip, InputFieldBase, DropdownListItem, ProgressCircle, ButtonBase
- **Evidence:** Contracts carry visibleWhen only sporadically: input-field-base.contract.json gates only 'http://' and '$/1,000.00'; dropdown-list-item.contract.json gates only Shortcut; ProgressBar/Slider Tooltip parts and Tooltip's lone Text have no visibleWhen at all. The anatomy union records every part ever seen but does not derive presence rules from which variants contain it. emit-react.ts:709-714 validates visibleWhen when present — invert simply rarely produces it.
- **Fix direction:** During anatomy union, record per-variant part presence and auto-derive visibleWhen from the axis value that exactly predicts presence (part in a strict subset of variants with no predicting axis = named degradation, never an unconditional part).

### emitter-drops-visibleWhen-on-component-parts

- **Stage:** emit-react · **Severity:** MAJOR — 2 components; distinct from unconditional-parts because the CONTRACT is correct (ButtonGroupBase carries visibleWhen for all three icon parts) and the emitter discards it
- **Components:** ButtonBase, ButtonGroupBase
- **Evidence:** core/emit-react.ts:2156-2163 — the `if (part.component)` branch returns `<${dep.name}${attrs} />` directly, never calling wrapVisibleWhen; the icon branch (line 2127) and repeat branch (line 2154) both wrap. So presence rules are honored on icon/text/repeat parts but silently dropped on nested-component parts.
- **Fix direction:** One-line fix: wrap the part.component branch's return in wrapVisibleWhen(part, ...) like the icon and repeat branches; add an emitter conformance check that every contract visibleWhen produces a conditional in the TSX.

### plain-rect-geometry-dropped

- **Stage:** dump · **Severity:** BLOCKER — 2 components have no visible core geometry (no bar, no track): the component's identity is invisible
- **Components:** ProgressBar, Slider
- **Evidence:** extract/figma/dump.plugin.js:97 — `if (kind === 'rect' && rotation === 0) return null; // ordinary box — existing channels`. Unrotated RECTANGLEs are excluded from dumpShape on the assumption auto-layout sizing channels carry them; in non-auto-layout parents (Slider root, ProgressBar's 'Progress bar' frame) nothing carries width/height, so only fill+cornerRadius survive and both rects collapse to 0x0.
- **Fix direction:** In dumpShape, carry width/height (and ABSOLUTE placement, same spelling as ellipses) for plain rects whose parent is not auto-layout or whose own sizing is not derivable from layout — never assume 'existing channels' without checking the parent's layoutMode.

### arc-and-vector-geometry-lost

- **Stage:** dump · **Severity:** BLOCKER — ProgressCircle has no progress semantics at all (full donut, no sweep); Tooltip arrow is 0x0 making all 7 arrow options identical
- **Components:** ProgressCircle, Tooltip
- **Evidence:** extract/figma/dump.plugin.js:83 — SHAPE_KIND_BY_TYPE captures ELLIPSE width/height but there is no arcData channel (startAngle/endAngle/innerRadius never read, not even into _degradations); line 236 'vector-geometry-unsupported' ledgers VECTOR nodes but carries paints only with no bbox, so the Tooltip arrow and Half-circle VECTOR arcs have no size.
- **Fix direction:** Capture ELLIPSE arcData and at minimum bbox for VECTOR decor nodes; emit arcs as conic-gradient masks or inline SVG, and thread arcData through a contract shape channel keyed on the progress axis.

### axis-inert (variant axis minted but zero style consequence)

- **Stage:** propose-invert · **Severity:** BLOCKER — ProgressBar's 11 Progress stories are byte-identical and Slider's 16 control combos are pixel-identical; the components' primary axis is dead in 5 of 9 components (progress, left/rightControl, shape, size-diameter, destructive, icon/checkbox)
- **Components:** ProgressBar, ProgressCircle, Slider, InputFieldBase, DropdownListItem
- **Evidence:** The inverter mints the enum prop but attributes no per-variant style/geometry deltas to it: module CSS contains no .progress-*, .shape-*, .rightControl-*/.leftControl-* rules at all, styles['progress-0%'] resolves undefined and is filtered out; destructive/icon/checkbox emit data-attributes no CSS references; ProgressCircle diameter frozen at the 216 literal while only border-width got a per-size token map — the axis→style diffing step is missing, and the emitter emits class references for rules that don't exist without erroring.
- **Fix direction:** Add per-axis style diffing at inversion (diff each variant's resolved styles against the axis baseline and emit conditional rule sets/token maps keyed on the axis value); make the emitter fail loudly when it references a class with no CSS rule.

### first-variant-freeze (variant-correlated values pinned to variant #1)

- **Stage:** propose-invert · **Severity:** MAJOR — Google buttons say 'Sign in with Facebook', every progress value reads '0%', payment inputs say 'Email'; 5 components lie about their own variant
- **Components:** ProgressBar, Slider, SocialButton, InputFieldBase, ProgressCircle
- **Evidence:** Contracts pin the first variant's literals: ProgressBar anatomy.Percentage.text='0%'; Slider leftNumber '0%' / rightNumber '25%' and arrow:'topCenter' unconditional; SocialButton parts.socialIcon.props={platform:'facebook',style:'white'} + parts.Text.text='Sign in with Facebook'; InputFieldBase label 'Email', dropdown 'US', one hint string. In every case the dump shows the value varying deterministically with the axis.
- **Fix direction:** During inversion, detect text/instance-prop values that vary across variants and bind them to the minted axis prop via a lookup table (or formula when values are the axis value itself, as in '10%'…'100%'), instead of pinning the first observation.

### duplicate-parts-from-wrapper-union (doubled text)

- **Stage:** propose-invert · **Severity:** BLOCKER — 'Active users 40% Active users 40%' and double 'List item' plus duplicated stubs make 2 components unreadable; InputFieldBase icons tripled; also causes DropdownListItem's half-disabled state (disabled CSS targets only the .Text2 duplicate)
- **Components:** ProgressCircle, DropdownListItem, InputFieldBase
- **Evidence:** The anatomy union treats the same canvas nodes reached through different wrapper frames as distinct parts: ProgressCircle {Group 3 → Label, Number} + flat {Label, Number} became four parts; DropdownListItem's shortcut variants wrap icon+text in 'Content' while others are flat, yielding Content>Text AND Text2, Checkbox x2, circle x2; InputFieldBase trailing icons appear at three nesting depths and were emitted three times.
- **Fix direction:** Unify node identity across variants before union — match children through pass-through wrapper GROUPs/FRAMEs by name+type+geometry so the same node under different nesting folds into one part (with the wrapper as conditional structure, not new parts).

### overlay-flattened (absolute placement lost, everything in-flow)

- **Stage:** dump · **Severity:** MAJOR — ProgressCircle md renders 611x264 instead of 240x240 with labels beside the ring; floating tooltips render in-flow inflating an 8px bar to 202px; slider handles pinned to viewport edges
- **Components:** ProgressCircle, ProgressBar, Slider
- **Evidence:** extract/figma/dump.plugin.js:90,101-109 — absolute placement ('Placement (ABSOLUTE nodes only)') is captured only inside dumpShape, i.e. only for REGULAR_POLYGON/ELLIPSE/rotated-RECT decor. TEXT, FRAME, and INSTANCE nodes with layoutPositioning ABSOLUTE (ProgressCircle's centered Label/Number, the floating Tooltip instances, slider handle positions) lose their overlay relationship entirely, so downstream emit can only produce in-flow flex.
- **Fix direction:** Capture layoutPositioning + center-preserving offsets + constraints for ALL node types (reuse the existing dumpShape spelling), and emit position:absolute overlays inside a position:relative root.

### style-channel-dropped (shadow / border-color / padding-inline / gap / text-color / font-weight / space-between)

- **Stage:** propose-invert · **Severity:** BLOCKER — SocialButton Apple/Figma/X are solid black rectangles with invisible black-on-black text; InputFieldBase borders compute to rgb(0,0,0); Light tooltip is invisible on white; 5 components affected
- **Components:** SocialButton, InputFieldBase, Tooltip, Slider, DropdownListItem
- **Evidence:** The dump carries these values (Text fill #ffffff, stroke #d4d4d4, padding [10,16,10,16], itemSpacing 10, two DROP_SHADOW effects, primaryAxisAlign SPACE_BETWEEN, fontStyle Medium) but the contracts bind no token for them: SocialButton.module.css .Text has no color property; no box-shadow anywhere; border-style+width emitted without border-color; padding-block emitted without padding-inline; no gap/justify-content tokens exist in tokens.css. Channel coverage at inversion is a partial hand-picked list.
- **Fix direction:** Make the inversion's channel coverage exhaustive against the dump schema with a carried-or-ledgered gate: every dump channel present on a node must either produce a bound token/CSS declaration or a named degradation — a channel silently absent from the contract must fail the gate.

### root-sizing-lost (fixed width / hug not carried)

- **Stage:** propose-invert · **Severity:** MAJOR — Slider and Tooltip stretch to 868px (full container) vs canvas 320/112; InputFieldBase inflates 320x96 → 320x166 with content overflowing the border
- **Components:** Slider, Tooltip, InputFieldBase
- **Evidence:** Dump roots carry bbox width 320 / counterSizing FIXED (Tooltip 320-328 FIXED, every Slider variant width 320), but neither the width nor the sizing mode appears in any contract root token or module.css — emitted roots are width-less inline-flex whose content dictates size.
- **Fix direction:** Carry root sizing mode + fixed dimensions from the dump bbox into contract root tokens (width for FIXED, max-content behavior for HUG), so roots stop inheriting container width.

### string-boolean-coercion (cross-contract prop type mismatch)

- **Stage:** mint · **Severity:** MAJOR — every composed Tooltip renders its full supporting paragraph because supportingText="false" (string) is truthy against the boolean prop, in both host components
- **Components:** ProgressBar, Slider, Tooltip
- **Evidence:** Dump instances carry componentProperties {'Supporting text': 'False'}; the contract serialized the value as the lowercased STRING "false" while Tooltip's own mint typed supportingText?: boolean — the value was case-normalized but never coerced to the dependency contract's minted type at the composition boundary, and the emitter passes it through without validating against the dependency's prop types.
- **Fix direction:** At contract composition, coerce instance prop values to the dependency's minted types ('False'→false for boolean props, enum-membership check otherwise) and make the emitter hard-error on type mismatches with dependency contracts.

### ua-default-leakage (no baseline reset on native elements)

- **Stage:** emit-react · **Severity:** MAJOR — DropdownListItem's rest state paints UA buttonface (~#efefef), reading permanently hovered; ButtonBase runs +2px on both axes (content-box, 1px border unabsorbed); SocialButton shows UA 6px button padding
- **Components:** DropdownListItem, ButtonBase, SocialButton
- **Evidence:** Emitted <button> roots set border:0 and padding but never background (dump Default variants have NO fill — transparent), and no box-sizing:border-box exists anywhere in the generated CSS, so canvas bboxes (borders inside in Figma) systematically exceed by 2x border-width.
- **Fix direction:** Emit a normalize block on every generated root (box-sizing:border-box inherited to parts; background:none/appearance:none on button/input elements) so 'no fill on canvas' means transparent, not UA default.

### variant-name-transliteration-api

- **Stage:** mint · **Severity:** MINOR — no visual defect, but the APIs are designer-unrecognizable/adoption-hostile: progress as string enum '0%'…'100%', label='false' meaning none, and SocialIcon's 'style' prop shadowing React's style attribute
- **Components:** ProgressBar, SocialButton
- **Evidence:** Figma axis names/values were transliterated verbatim into the code API: '0%'…'100%' should be number, 'False' should be absence/boolean, and the instance property 'Style' minted as lowercase 'style' collides with the DOM attribute namespace on HTMLAttributes<HTMLSpanElement>.
- **Fix direction:** Add semantic normalization at mint: detect numeric-valued axes (mint number + mapping), 'False' axis values (mint optional/boolean), and a reserved-prop-name blocklist (style, className, key, ref) with automatic renaming.

### story-space-mismatch (illegal combos generated, legal variants unreachable)

- **Stage:** story-gen · **Severity:** MINOR — misrepresents the variant space rather than breaking pixels: Slider matrix shows 64 cells where only 40 combos exist on canvas (left>=right invented); DropdownListItem leaves 22 of 24 variants unreachable and drops the Focus axis; SocialButton's 54 icon-only variants never exercised
- **Components:** Slider, DropdownListItem, SocialButton
- **Evidence:** Matrix stories cross the full enum product instead of the observed variant tuples; conversely coverage generation omits whole axes (supportingText, Focus state) that the dump proves exist.
- **Fix direction:** Generate matrix stories from the dump's observed variant tuples (the legal set), not the enum cross-product, and require every dump axis to appear in at least one story.

### ledgered-degradations-visible

- **Stage:** dump · **Severity:** MINOR — honest but visible drift: ring geometry shifted 12px by INSIDE-vs-CENTER strokes, letterSpacing -2% dropped, per-corner radii on the leading-text add-on omitted
- **Components:** ProgressCircle, InputFieldBase
- **Evidence:** extract/figma/dump.plugin.js:284-285 ledgers 'strokeAlign CENTER — dump consumers render INSIDE strokes'; lines 334-335 ledger letterSpacing PERCENT; radii-nonuniform is ledgered as omitted (dump v1 uniform radius only). All properly in _degradations — the class is 'known-lossy channels whose loss is now visibly costly'.
- **Fix direction:** Promote the three highest-cost ledgered channels to carried: strokeAlign via box-shadow/outline spelling, letterSpacing percent → em conversion, per-corner radii array (already captured by figma-sync scripts' 4-value radius spelling — port that into the dump schema).

## Singletons (real, not class-shaped)

- Slider floating tooltips can never show slider values: the Tooltip instances' TEXT OVERRIDE characters ('0%'/'25%') are not captured in the dump (only the hug-width bboxes 43x40/50x40 betray them) — instance text overrides are a missing dump channel (dump stage, MAJOR).
- ProgressCircle sibling-inconsistent shape carriage: the contract kept shape {kind: ellipse, 216x216} for Line but dropped it entirely for Background — same node type, same geometry, divergent inversion (propose-invert, MAJOR; the gray-slab rendering).
- InputFieldBase has no actual <input> element — a div of hardcoded spans; the children prop is accepted in the signature but never rendered (emit-react, MINOR, acknowledged PoC scope).
- InputFieldBase trailingDropdown uses flex row-reverse — an invention with no canvas counterpart (canvas is normal row order [Content, Dropdown] with 'USD') — causing '$ 1,000.00' to overlap 'olivia@untitledui.com' (propose-invert, MAJOR; compounded by the everything-at-once blocker).

## Contradictions found between auditors (all resolved)

- ButtonBase sizes — the size-story agent directly refutes the owner report another agent relied on: "Owner's 'sizes render identically' claim is REFUTED numerically but explained: measured boxes are md 154.6x42, lg 169x46, xl 173x50, sm 150.6x38 with correct per-size padding (10/16, 10/18, 12/20, 8/14) and font (14/16/16/14) resolving from tokens.css — the sizes only LOOK alike because every story shows the identical dot+circle+text clutter and lg vs xl differ by just 4px." The size axis is NOT in the axis-inert class for ButtonBase; the residual defect is only the +2px content-box issue.
- ProgressCircle overlay stage attribution — the ProgressCircle agent tagged the giant 611x264 md root as emit-react ("The overlay/absolute relationship was flattened into in-flow flex children (root is display:inline-flex row)"), but the dump-stage agents' own evidence pattern (and dump.plugin.js:90,103 — 'Placement (ABSOLUTE nodes only)' captured solely inside dumpShape for decor shapes) shows absolutely-positioned TEXT placement never reaches the contract, so the emitter had nothing to flatten. Localized to dump in the taxonomy.
- Apparent (resolved) disagreement on missing geometry: ProgressBar/Slider agents tagged invisible tracks as dump ("Dump v1.6 records only fill+cornerRadius for these rectangles — no bbox/size") while the ProgressCircle agent tagged the invisible Background ring as propose-invert ("The contract kept shape {kind: ellipse, 216x216} for Line but dropped it entirely for Background — the two sibling ellipses were inverted inconsistently"). Both are right: dump.plugin.js:83/97 carries ELLIPSE shapes but returns null for unrotated RECTANGLEs — rect losses are dump-stage, the Background-ellipse drop is a genuine invert-stage inconsistency (kept as a singleton).

## Reading this honestly

Stage tally: propose-invert owns 5 classes (the union/inversion step is the
main offender — it flattens per-variant conditionality, freezes first-variant
values, duplicates parts through wrapper nesting, leaves axes style-inert and
drops style channels), dump owns 4 (plain-rect geometry, arc/vector geometry,
absolute placement for non-decor nodes, ledgered-but-costly channels), emitter
owns 2 (visibleWhen dropped on component parts — a one-line fix — and UA
default leakage), mint owns 2 (cross-contract prop-type coercion, API naming).
Every class has a mechanical fix direction; none requires AI in the loop.

