# Proposed contracts — design-side extraction report

1 component set(s) extracted from the canvas dump. Every proposal parses against the contract schema. A proposal is a STARTING POINT: unbound values are NAMED below (never silently tokenized), and each note is a review line item.

## Switch

- proposed: 3 props
- semantics: read from the set's own `ds_contracts/semantics` stamp (element "label") — the contract's declared host element, not the name/axis inference
- Switch:root: root width HUGS in every variant — carried as the literal `width: fit-content` (v16 grammar), the CSS twin of Figma HUG. The drawn 209px is a measurement of the DEFAULT content, not a design value, so it is NOT minted; the emitted box is content-sized and no longer cross-stretches when this component is nested inside another
- Switch:root: root height HUGS in every variant — carried as the literal `height: fit-content` (v16 grammar), the CSS twin of Figma HUG. The drawn 36px is a measurement of the DEFAULT content, not a design value, so it is NOT minted; the emitted box is content-sized and no longer cross-stretches when this component is nested inside another
- prop `value`: two-value axis [Off, On] kept as an ENUM (both states render truthfully on both surfaces); a code boolean is a compatible code-side binding — see extract/reconcile.ts bool⇄axis treatment

## Export envelope (v2) — everything this run wrote

- contract: parity/receipts/beta/switch-proposed/switch.contract.proposed.json
- no minted token tree (nothing needed minting)
- token corpus: tokens/primitives.tokens.json, tokens/semantic.tokens.json, tokens/modes/semantic.light.tokens.json, tokens/modes/semantic.dark.tokens.json, tokens/modes/brand.default.tokens.json

Next — generate the code:

```
npx ds-contracts generate parity/receipts/beta/switch-proposed/switch.contract.proposed.json --out parity/receipts/beta/switch-proposed/generated --stories --tokens tokens/primitives.tokens.json,tokens/semantic.tokens.json,tokens/modes/semantic.light.tokens.json,tokens/modes/semantic.dark.tokens.json,tokens/modes/brand.default.tokens.json
```
