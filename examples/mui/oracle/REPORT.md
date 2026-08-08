# MUI oracle — offline report

Run: `exact-conversion-finish-wave2` · scored 2026-08-08T07:17:19.353Z

Summary: **32** MATCH · **0** PENDING · **0** FAIL / 32 facts

Verdict: **PASS** (no silent success against UNSUPPORTED/REFUSED; no missing required CARRIED evidence).

Accuracy denominators: untouched (`accuracy/baseline.json` / grammar counts not modified).

## Limits (honest v1)

- No MUI Figma dumps in-tree — exact projection remains unscored.
- Prototype CHANGE_TO uses committed figma-script emission evidence; Switch checked translation uses promoted contract bindings plus minted leaves.
- Compile/genesis not re-executed; COMPILE-RECEIPT.md row presence is the cheap compile signal.
- CARRIED claims are structural (contract/figma/extension) unless a named receipt proves LOWERED/REFUSED/LEDGERED.
- Seeded TextField is scored from promoted contract/emission identity only; negative-control SpeedDial fails closed on any promotion.

## Components

### button (`mui.button`, in-pilot)

Evidence: contract=true extension=true figma=true captureOut=true compileReceipt=true dump=false promoted=true

| channel | expect | result | observed | reason |
|---|---|---|---|---|
| variant-space | CARRIED | MATCH | CARRIED | structural: 3 VARIANT axis(es) + figma script + compile receipt |
| states.disabled | CARRIED | MATCH | CARRIED | disabled listed in contract.states |
| prototype.change-to | CARRIED | MATCH | CARRIED | figma-script:CHANGE_TO with ON_HOVER reaction wiring |

### chip (`mui.chip`, in-pilot)

Evidence: contract=true extension=true figma=true captureOut=true compileReceipt=true dump=false promoted=true

| channel | expect | result | observed | reason |
|---|---|---|---|---|
| variant-space | CARRIED | MATCH | CARRIED | structural: 3 VARIANT axis(es) + figma script + compile receipt |
| anatomy | CARRIED | MATCH | CARRIED | structural: drawable anatomy present on contract root |

### switch (`mui.switch`, in-pilot)

Evidence: contract=true extension=true figma=true captureOut=true compileReceipt=true dump=false promoted=true

| channel | expect | result | observed | reason |
|---|---|---|---|---|
| props.checked | CARRIED | MATCH | CARRIED | checked is a VARIANT axis (not -state-checked name invention) |
| layout.thumb-translate | CARRIED | MATCH | CARRIED | contract/mint binding path: anatomy.root.parts.buttonbase-root.tokensByProp[0].map.checked.translate-x (4 minted leaves) |

### checkbox (`mui.checkbox`, in-pilot)

Evidence: contract=true extension=true figma=true captureOut=true compileReceipt=true dump=false promoted=true

| channel | expect | result | observed | reason |
|---|---|---|---|---|
| variant-space | CARRIED | MATCH | CARRIED | structural: 1 VARIANT axis(es) + figma script + compile receipt |
| anatomy | CARRIED | MATCH | CARRIED | structural: drawable anatomy present on contract root |

### slider (`mui.slider`, in-pilot)

Evidence: contract=true extension=true figma=true captureOut=true compileReceipt=true dump=false promoted=true

| channel | expect | result | observed | reason |
|---|---|---|---|---|
| variant-space | CARRIED | MATCH | CARRIED | structural: 2 VARIANT axis(es) + figma script + compile receipt |
| anatomy | CARRIED | MATCH | CARRIED | structural: drawable anatomy present on contract root |

### card (`mui.card`, in-pilot)

Evidence: contract=true extension=true figma=true captureOut=true compileReceipt=true dump=false promoted=true

| channel | expect | result | observed | reason |
|---|---|---|---|---|
| variant-space | CARRIED | MATCH | CARRIED | structural: 1 VARIANT axis(es) + figma script + compile receipt |
| anatomy | CARRIED | MATCH | CARRIED | structural: drawable anatomy present on contract root |

### accordion (`mui.accordion`, in-pilot)

Evidence: contract=true extension=true figma=true captureOut=true compileReceipt=true dump=false promoted=true

| channel | expect | result | observed | reason |
|---|---|---|---|---|
| variant-space | CARRIED | MATCH | CARRIED | structural: 2 VARIANT axis(es) + figma script + compile receipt |
| anatomy | CARRIED | MATCH | CARRIED | structural: drawable anatomy present on contract root |

### tabs (`mui.tabs`, in-pilot)

Evidence: contract=true extension=true figma=true captureOut=true compileReceipt=true dump=false promoted=true

| channel | expect | result | observed | reason |
|---|---|---|---|---|
| variant-space | CARRIED | MATCH | CARRIED | structural: 2 VARIANT axis(es) + figma script + compile receipt |
| anatomy | CARRIED | MATCH | CARRIED | structural: drawable anatomy present on contract root |

### autocomplete (`mui.autocomplete`, in-pilot)

Evidence: contract=true extension=true figma=true captureOut=true compileReceipt=true dump=false promoted=true

| channel | expect | result | observed | reason |
|---|---|---|---|---|
| variant-space | CARRIED | MATCH | CARRIED | structural: 1 VARIANT axis(es) + figma script + compile receipt |
| anatomy | CARRIED | MATCH | CARRIED | structural: drawable anatomy present on contract root |
| anatomy.listbox | LEDGERED (autocomplete-listbox-closed-capture) | MATCH | LEDGERED | named receipt/prose hit: listbox |

### dialog (`mui.dialog`, in-pilot)

Evidence: contract=true extension=true figma=true captureOut=true compileReceipt=true dump=false promoted=true

| channel | expect | result | observed | reason |
|---|---|---|---|---|
| anatomy.root | CARRIED | MATCH | CARRIED | structural: drawable anatomy present on contract root |
| anatomy.focus-trap-sentinel | REFUSED (portal-inert-child) | MATCH | REFUSED | named receipt/prose hit: portal-inert-children-dropped |
| states.interaction | LEDGERED (portal-states-empty) | MATCH | LEDGERED | contract declares states: [] (portal capture boundary) |
| layout.full-bleed-scrim-width | REFUSED (full-bleed-scrim-stage-width) | MATCH | REFUSED | figma emission omits capture-stage 900px root width (boundFullBleedScrimRoot / blockRoot) |

### table (`mui.table`, in-pilot)

Evidence: contract=true extension=true figma=true captureOut=true compileReceipt=true dump=false promoted=true

| channel | expect | result | observed | reason |
|---|---|---|---|---|
| semantics.table | LOWERED (table-box-to-accessible-structure) | MATCH | LOWERED | named lowering receipt: table-geometry-excluded |
| layout.stickyHeader | REFUSED (sticky-header-excluded) | MATCH | REFUSED | named receipt/prose hit: stickyHeader |
| anatomy.row-menu-open | REFUSED (portal-single-root-drops-in-stage) | MATCH | REFUSED | named receipt/prose hit: single-portaled-root |
| anatomy.inlined-checkbox | CARRIED | MATCH | CARRIED | inlined checkbox anatomy without nested component identity |

### text-field (`mui.text-field`, in-pilot)

Evidence: contract=true extension=true figma=true captureOut=false compileReceipt=true dump=false promoted=true

| channel | expect | result | observed | reason |
|---|---|---|---|---|
| component | CARRIED | MATCH | CARRIED | structural: promoted contract + extension + figma + compile receipt |
| anatomy.adornment | CARRIED | MATCH | CARRIED | nested identity: two mui.input-adornment refs + emitted depContractId/depAnchorKey pairs |
| text.style | CARRIED | MATCH | CARRIED | named text identity: label + helper/error anatomy, 12 emitted textStyle specs, fail-closed runtime |

### speed-dial (`mui.speed-dial`, negative-control)

Evidence: contract=false extension=false figma=false captureOut=false compileReceipt=false dump=false promoted=false

| channel | expect | result | observed | reason |
|---|---|---|---|---|
| component | UNSUPPORTED (mui-speed-dial-outside-grammar) | MATCH | UNSUPPORTED | negative-control remains unpromoted (fail-closed) |

