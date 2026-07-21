# Advanced composition — the multi-root Modal emits on all four surfaces

Rebuild: `npx tsx examples/depth-modal/emit-modal-receipt.ts`

The depth north star (both journeys) needed the emitters + validator to consume
**multi-root anatomy**. A single-root contract's anatomy is the N=1 special
case of `Record<string, Part>`; a captured composite carries several top-level
roots. This receipt drives the assembled composite `ds.modal-composite`
(`modal-composite.contract.json` — two roots `{dialog, backdrop}`, promoted
from the depth capture `extract/computed/depth/receipts/modal.anatomy.json`)
through **every** emitter and proves each — by EXECUTION, the repo's discipline
(green parse ≠ works).

## Per-surface multi-root rendering decision

| surface | N roots become | wrapper? |
|---|---|---|
| emit-html | sibling elements (`.modal-composite__dialog`, `.modal-composite__backdrop`) | none — position-driven siblings |
| emit-react | siblings inside a `<>…</>` Fragment | none |
| emit-react-inline | siblings inside a Fragment (resolved-literal styles) | none |
| emit-figma-script | children of ONE variant frame | synthetic container frame — a Figma variant IS one frame, so multi-root needs a parent; single-root NEVER gets one (byte-identical) |

A genuinely single-root contract takes the **untouched N=1 path** in every
emitter, so `npm run generate` + `npm run figma:plan` are byte-for-byte
unchanged (the golden invariant).

## Proof (5/5 surfaces)

| surface | pass | what executed |
|---|---|---|
| emit-react | ✓ | rendered a real modal — role="dialog" + header(title,close) + body + footer(Cancel,Save), sibling backdrop, both root classes present, no NaN |
| emit-react-inline | ✓ | resolved-literal variant renders the same modal (dialog + actions), no NaN |
| emit-html | ✓ | static markup carries dialog(role) + backdrop siblings + both actions, no React syntax |
| emit-figma-script (referee) | ✓ | COMPONENTS payload parses — one variant frame whose children are the 2 roots [dialog, backdrop] |
| emit-figma-script (headless) | ✓ | the whole script ran to completion in a VM against the mocked figma global (no Figma, no network) |

## Emitted artifacts (committed as receipts)

- `ModalComposite.tsx` + `ModalComposite.module.css` — CSS-module React component
- `ModalComposite.inline.tsx` — resolved-literal React component
- `ModalComposite.html` + `ModalComposite.html.css` — static HTML + CSS
- `ModalComposite.figma.js` — Figma Plugin API sync script (one frame, two roots)
