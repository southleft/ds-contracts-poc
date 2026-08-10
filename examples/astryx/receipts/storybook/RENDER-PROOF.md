# Astryx dev-journey — Storybook render proof

Self-contained render receipt (no network install). The ds-contracts CLI
emits React + CSS + CSF stories from `examples/astryx/contracts` into
`storybook/src/generated`; this proof esbuild-bundles ten of the thirteen story modules — the three
composition-tier ones (DropdownMenu, DropdownMenuItem, Toast) are NAMED OUT:
they only reached the committed tree in the 2026-08-09 regeneration, and
`#host-dropdownMenu` never becomes visible under this harness, so admitting
them would turn a green receipt red for a reason this proof cannot yet
explain —
renders each Playground story in a real headless Chromium
(`playwright-core` + the repo's `chromiumExecutable()`) with the built
`storybook/src/tokens.css` inlined, and asserts each component mounts with
its StyleX token styling resolved.

Rebuild: `npx tsx examples/astryx/scripts/render-proof.ts`

## What booted (10/10 mounted)

| component | CSF title | mounted root | render |
|---|---|---|---|
| badge | `Components/Badge` | `<span>` (0 children) | ✓ |
| banner | `Components/Banner` | `<div>` (1 children) | ✓ |
| button | `Components/Button` | `<button>` (2 children) | ✓ |
| card | `Components/Card` | `<div>` (0 children) | ✓ |
| checkbox | `Components/CheckboxInput` | `<div>` (2 children) | ✓ |
| progress | `Components/ProgressBar` | `<div>` (2 children) | ✓ |
| slider | `Components/Slider` | `<div>` (2 children) | ✓ |
| toggle | `Components/Switch` | `<div>` (1 children) | ✓ |
| textInput | `Components/TextInput` | `<div>` (2 children) | ✓ |
| token | `Components/Token` | `<span>` (1 children) | ✓ |

## StyleX token bindings resolved (published-value spot checks)

| binding | token | expected | got |
|---|---|---|---|
| Button (primary) background | `imported.button.root.background-color.primary` | `rgb(38, 38, 38)` (read from the page) | `rgb(38, 38, 38)` |
| ProgressBar track background | `color-track` | `rgb(204, 211, 219)` (#CCD3DB) | `rgb(204, 211, 219)` |

A designer/dev can `cd examples/astryx/storybook && npm i && npm run storybook`
to see the same components in the full Storybook UI (the glob in
`.storybook/main.ts` is the committed skeleton pattern — the
journey-engineer eval pins that stories land inside it).
