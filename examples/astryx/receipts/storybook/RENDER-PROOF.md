# Astryx dev-journey — Storybook render proof

Self-contained render receipt (no network install). The ds-contracts CLI
emits React + CSS + CSF stories from `examples/astryx/contracts` into
`storybook/src/generated`; this proof esbuild-bundles all ten story modules,
renders each Playground story in a real headless Chromium
(`playwright-core` + the repo's `chromiumExecutable()`) with the built
`storybook/src/tokens.css` inlined, and asserts each component mounts with
its StyleX token styling resolved.

Rebuild: `npx tsx examples/astryx/scripts/render-proof.ts`

## What booted (10/10 mounted)

| component | CSF title | mounted root | render |
|---|---|---|---|
| badge | `Components/Badge` | `<span>` (1 children) | ✓ |
| banner | `Components/Banner` | `<div>` (1 children) | ✓ |
| button | `Components/Button` | `<button>` (1 children) | ✓ |
| card | `Components/Card` | `<div>` (1 children) | ✓ |
| checkbox | `Components/CheckboxInput` | `<div>` (2 children) | ✓ |
| progress | `Components/ProgressBar` | `<div>` (2 children) | ✓ |
| slider | `Components/Slider` | `<div>` (2 children) | ✓ |
| toggle | `Components/Switch` | `<div>` (2 children) | ✓ |
| textInput | `Components/TextInput` | `<div>` (2 children) | ✓ |
| token | `Components/Token` | `<span>` (1 children) | ✓ |

## StyleX token bindings resolved (published-value spot checks)

| binding | token | expected | got |
|---|---|---|---|
| Button (primary) background | `color-accent` | `rgb(0, 100, 224)` (#0064E0) | `rgb(0, 100, 224)` |
| ProgressBar track background | `color-track` | `rgb(204, 211, 219)` (#CCD3DB) | `rgb(204, 211, 219)` |

A designer/dev can `cd examples/astryx/storybook && npm i && npm run storybook`
to see the same components in the full Storybook UI (the glob in
`.storybook/main.ts` is the committed skeleton pattern — the
journey-engineer eval pins that stories land inside it).
