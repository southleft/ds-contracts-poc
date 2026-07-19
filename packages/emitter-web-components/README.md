# @ds-contracts/emitter-web-components

A ds-contracts **emitter plugin**: contract → vanilla Custom Elements. Zero
runtime dependencies, no framework — shadow DOM, constructable stylesheets,
real `<slot>`s, real events.

```sh
ds-contracts generate contracts/ --out wc/ \
  --target web-components \
  --emitter @ds-contracts/emitter-web-components \
  --tokens tokens.json --icons icons/
```

or directly:

```ts
import { registerEmitter } from 'ds-contracts core';
import webComponents from '@ds-contracts/emitter-web-components';
registerEmitter(webComponents);
```

## What one contract becomes

| File | What it is |
| --- | --- |
| `<tag>.ts` | `HTMLElement` subclass (`ds.badge` → `<ds-badge>`). `observedAttributes` from the contract's props; enum/boolean/number/text props reflect property ⇄ attribute with contract defaults; the `children` text prop is the default `<slot>`; `arrayOf` props are JS properties (attributes cannot carry lists — named limit). Events dispatch `CustomEvent`s; toggles flip uncontrolled and carry native `checked`/`indeterminate` or ARIA state. Form-associated when the contract's root is input-like. Registers on import (guarded); exports `define()`. |
| `<tag>.css.ts` | The anatomy compiled to a constructable stylesheet — the same css-generation semantics as the repo's static HTML emitter, translated to shadow-scoped `[part=…]` / `:where()` selectors at **identical specificity**, so both emitters resolve one computed truth (receipted in real Chromium by the `wc-emitter-css-parity` eval). |
| `<tag>.demo.html` | The story-equivalent showcase grid: default + every enum value + every boolean, spelled with the element. |
| `<tag>.custom-elements.json` | A Custom Elements Manifest generated **from the contract** — deterministic, no analyzer. The `wc-emitter-roundtrip` eval feeds it back through the repo's own CEM extraction adapter and proves props/enums/defaults/events survive the loop; every non-surviving fact is named with its mechanism. |

Token values arrive via CSS custom properties (they inherit through the
shadow boundary) — include your token stylesheet on the page.

Canvas-only contract concepts (`figmaStatePreviews`, `modes`,
`bindings.figma`, anchors) are **named no-ops**, listed in each emitted
file's header — never silently dropped.

Part of the [ds-contracts](https://ds-contracts-spec.pages.dev) open spec. MIT.
