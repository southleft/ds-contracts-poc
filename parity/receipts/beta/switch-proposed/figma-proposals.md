# Proposed contracts — design-side extraction report

1 component set(s) extracted from the canvas dump. Every proposal parses against the contract schema. A proposal is a STARTING POINT: unbound values are NAMED below (never silently tokenized), and each note is a review line item.

## Switch

- proposed: 3 props
- semantics: element "input" matched the name/axis table for set "Switch", but the drawn anatomy mounts 2 child part(s) and <input> is a VOID element — children cannot mount inside it (React refuses the shape at runtime and renders NOTHING; the emitters refuse it by name). Proposed as container element "div" instead; the inferred role "switch" is NOT carried (it belongs on the native control, not the container) — REVIEW: re-root before adoption by mounting the native <input> control as a child part inside this container
- Switch:root/textCol/labelText: typography (14px Medium) matches 2 derived text styles — font tokens not proposed, review
- Switch:root/textCol/descriptionText: typography (14px Regular) matches 0 derived text styles — font tokens not proposed, review
- prop `value`: two-value axis [Off, On] kept as an ENUM (both states render truthfully on both surfaces); a code boolean is a compatible code-side binding — see extract/reconcile.ts bool⇄axis treatment
- Switch:root itemSpacing: observed 8 carried as a PROVISIONAL minted token (rename against your real system) — nearest real tokens by value: {space.100}, {space.inset-x.xs}, {space.inset-y.md}, {space.gap.control}, {space.gap.sm}; the proposal binds the provisional name, never a real token the canvas did not use
- Switch:root/track padding: observed 2 2 2 2 carried as a PROVISIONAL minted token (rename against your real system) — nearest real tokens by value: {space.25}, {space.inset-y.xs}, {border-width.200}, {border.width.focus}, {border.width.divider.strong}; the proposal binds the provisional name, never a real token the canvas did not use
- Switch:root/textCol itemSpacing: observed 2 carried as a PROVISIONAL minted token (rename against your real system) — nearest real tokens by value: {space.25}, {space.inset-y.xs}, {border-width.200}, {border.width.focus}, {border.width.divider.strong}; the proposal binds the provisional name, never a real token the canvas did not use
- Switch:root/textCol/labelText fontWeight: observed 500 carried as a PROVISIONAL minted token (rename against your real system) — nearest real tokens by value: {font.weight.medium}, {font.control.weight}, {font.tab.default.weight}, {brand.font.control-weight}; the proposal binds the provisional name, never a real token the canvas did not use
- Switch:root/textCol/descriptionText fontWeight: observed 400 carried as a PROVISIONAL minted token (rename against your real system) — nearest real tokens by value: {font.weight.regular}; the proposal binds the provisional name, never a real token the canvas did not use
- MINTED {imported.switch.root.gap} = 8px — machine-named from a resolved value — rename against your real tokens (provisional); bound at: Switch:root gap
- MINTED {imported.shared.size-2} = 2px — machine-named from a resolved value — rename against your real tokens (provisional); bound at: Switch:root/track padding-inline, Switch:root/track padding-block, Switch:root/textCol gap
- MINTED {imported.switch.text-col-label-text.font-size} = 14px — machine-named from a resolved value — rename against your real tokens (provisional); bound at: Switch:root/textCol/labelText font-size
- MINTED {imported.switch.text-col-label-text.font-weight} = 500 — machine-named from a resolved value — rename against your real tokens (provisional); bound at: Switch:root/textCol/labelText font-weight
- MINTED {imported.switch.text-col-description-text.font-size} = 14px — machine-named from a resolved value — rename against your real tokens (provisional); bound at: Switch:root/textCol/descriptionText font-size
- MINTED {imported.switch.text-col-description-text.font-weight} = 400 — machine-named from a resolved value — rename against your real tokens (provisional); bound at: Switch:root/textCol/descriptionText font-weight

## Export envelope (v2) — everything this run wrote

- contract: parity/receipts/beta/switch-proposed/switch.contract.proposed.json
- minted token tree: parity/receipts/beta/switch-proposed/minted.dtcg.json (6 token(s); machine-derived provisional names)
- token corpus: tokens/primitives.tokens.json, tokens/semantic.tokens.json, tokens/modes/semantic.light.tokens.json, tokens/modes/semantic.dark.tokens.json, tokens/modes/brand.default.tokens.json

Next — generate the code:

```
npx ds-contracts generate parity/receipts/beta/switch-proposed/switch.contract.proposed.json --out parity/receipts/beta/switch-proposed/generated --stories --tokens tokens/primitives.tokens.json,tokens/semantic.tokens.json,tokens/modes/semantic.light.tokens.json,tokens/modes/semantic.dark.tokens.json,tokens/modes/brand.default.tokens.json,parity/receipts/beta/switch-proposed/minted.dtcg.json
```
