# Proposed contracts — design-side extraction report

1 component set(s) extracted from the canvas dump. Every proposal parses against the contract schema. A proposal is a STARTING POINT: unbound values are NAMED below (never silently tokenized), and each note is a review line item.

## Button-Brand Primary

- proposed: 5 props
- semantics: element "button" inferred from the set name "Button-Brand Primary" — inference is mechanical (name/axis table), review
- variant axis "state" (default|hover|focus|pressed|disabled) IS the platform's interaction states, not API — promoted: the axis is NOT a prop; anatomy and base facts come from the 3 default-state variant(s); hover→hover, focus→focus-visible, pressed→active propose root state overrides; disabled→ a `disabled` BOOLEAN prop + disabled state block
- Button-Brand Primary:root padding-inline: bindings are a function of variant axis "size" by VALUE (default large={spacing.200}; small={spacing.150}) — carried as tokensByProp overrides (v10; the token names do not spell the axis values, so the substituted-ref shape cannot carry them)
- Button-Brand Primary:root height: bindings are a function of variant axis "size" by VALUE (default large={component-size.xlarge}; medium={component-size.large}, small={component-size.medium}) — carried as tokensByProp overrides (v10; the token names do not spell the axis values, so the substituted-ref shape cannot carry them)
- Button-Brand Primary:root/Icon: nested instance of "Icon" has no known contract — component ref proposed as "ds.icon" with a STUB child contract auto-proposed alongside (childStubs; API from observed applied values only, anatomy not captured — import the real child set to replace it)
- Button-Brand Primary:root/Icon: fixed props of "Icon" canonicalized by spelling (dump v1.1) — verify against the child contract's bindings
- Button-Brand Primary:root/Icon: applied prop "size" of the nested "Icon" varies across variants (large, small) without tracking any enum axis — first value "large" carried, review
- Button-Brand Primary:root/Icon: visibility bound to BOOLEAN "↪️icon-left" — proposed as prop `iconLeft` (default false: the node is hidden in the default variant, dump v1.1)
- Button-Brand Primary:root/Button: typography varies across variants (fontSize 16/14, weight Semi Bold) — no single text-style identity adopted (the first variant's value would be wrong for the others); font-size not proposed without minting (review)
- Button-Brand Primary:root/Icon 2: nested instance of "Icon" has no known contract — component ref proposed as "ds.icon" with a STUB child contract auto-proposed alongside (childStubs; API from observed applied values only, anatomy not captured — import the real child set to replace it)
- Button-Brand Primary:root/Icon 2: fixed props of "Icon" canonicalized by spelling (dump v1.1) — verify against the child contract's bindings
- Button-Brand Primary:root/Icon 2: applied prop "size" of the nested "Icon" varies across variants (large, small) without tracking any enum axis — first value "large" carried, review
- Button-Brand Primary:root/Icon 2: visibility bound to BOOLEAN "↪️icon-right" — proposed as prop `iconRight` (default false: the node is hidden in the default variant, dump v1.1)
- Button-Brand Primary:root/Focus ring: drawn only in the focus state and carries a stroke — inverted to focus-visible outline overrides (outline-color/outline-width); its own corner radius is not carried (the outline follows the root's shape + offset), review
- Button-Brand Primary:root/Tooltip: drawn only in state "disabled" variants and hidden — design-time helper, not proposed (review)
- prop `disabled`: promoted from axis value "state=disabled" — a BOOLEAN prop (native disabled attribute on interactive elements), bound to design property "Disabled" (the forward generator's spelling; the imported set spelled it as an axis value — rename consequence documented here)
- prop `text`: the single text prop carries the component's main content — repo contracts bind main content to code prop "children" (ds.button convention); adopt by setting bindings.code.prop to "children" when this is the label (note-only, nothing renamed mechanically)
- contract name: drawn set name "Button-Brand Primary" is not a PascalCase component name — proposed as "ButtonBrandPrimary" (the canvas set keeps its own name; the componentSetKey/nodeId anchors carry identity)
- prop `text`: Figma property "✏️text" contains characters outside a legal identifier — name sanitized at proposal; the original spelling stays the design binding (bindings.figma.property)
- prop `iconLeft`: Figma property "↪️icon-left" contains characters outside a legal identifier — name sanitized at proposal; the original spelling stays the design binding (bindings.figma.property)
- prop `iconRight`: Figma property "↪️icon-right" contains characters outside a legal identifier — name sanitized at proposal; the original spelling stays the design binding (bindings.figma.property)
- Button-Brand Primary:root/Button: state "disabled" part-level override proposed — color: {text.disabled} (P18 v13; formerly the STYLE-FIDELITY B7 named gap)
- figmaStatePreviews: true — regenerating the canvas draws the promoted states as a "State" preview axis (values Default|Hover|Active|Focus Visible, the shared spelling rules) — a RENAME relative to the imported axis "state" (default|hover|focus|pressed|disabled); the contract vocabulary carries no custom state-axis spellings, so the original spelling lives in this note and in the anchors' set
- UNBOUND Button-Brand Primary:root minHeight = 44 — no token invented; nearest tokens by value: (none found)
- UNBOUND Button-Brand Primary:root/Button fontSize = 16 — no token invented; nearest tokens by value: {spacing.200}, {icon-size.small}
- UNBOUND Button-Brand Primary:root/Button fontWeight = 600 — no token invented; nearest tokens by value: (none found)
- UNBOUND Button-Brand Primary:root/Button lineHeight = 24 — no token invented; nearest tokens by value: {component-size.small}, {icon-size.large}
- UNBOUND Button-Brand Primary:root/Focus ring (state focus-visible) strokeWeight = 2 — no token invented; nearest tokens by value: (none found)

