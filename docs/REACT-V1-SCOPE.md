# React V1 qualification scope

The goal remains React ↔ contracts ↔ editable Figma, including composed components. Lit/Web Components are parked for V1.1. Passing an individual example does not qualify a journey.

## First code-led cohort

Use the existing shadcn source sandbox, not emitted contracts or regenerated components. Pin the exact source files, package lock, loaded dependency bytes, theme stylesheet and fonts for each observation. The selected theme is the sandbox's light theme. A later theme or state is additional coverage, never a replacement for a failed row.

| Subject | Preselected cases | Rules exercised |
| --- | --- | --- |
| Button | Default, secondary, disabled, icon with text | Variant selection, omitted defaults, boolean state, icon composition and editable content |
| Checkbox | Unchecked, checked, indeterminate, disabled | Native state, accessible label relationship, nested indicator and icon |
| Card | Header/body/footer; same composition containing Checkbox and Button | Nested components, content regions and multiple dependencies |

These ten cases are selected before qualification. Count all ten, including refused or failed captures. Source readiness, native visual fidelity, structure/editability, behavior and workflow completion are separate results. Radix Themes and the other held-out subjects remain reserved for their independent evaluations.

## Rules and boundaries

| Capability | V1 requirement / boundary |
| --- | --- |
| React source | Preserve source and dependency identity; run the actual implementation. A static proposal or generated preview is not original-source evidence. |
| Styling | Capture the original theme, reset, fonts, assets, layout and supported CSS. Missing or delayed prerequisites must not pass readiness. Unsupported CSS remains visible in the result. |
| Properties | Preserve supported scalar types, defaults, omission, variants and live updates. Accepting a prop but discarding its effect fails. |
| Composition | Preserve component identity, nested controls, reusable content and declared slots. Advanced composition is in scope through general rules, not component-name converters. |
| Figma projection | Use native editable components, variants and variables. Exposing a child's existing controls does not establish parent-property forwarding. Unimplemented mappings remain refusals. |
| Design-only input | Produce a reusable React library that runs in a clean consumer. Do not invent business logic absent from the design. |
| Repair | Fresh observations, shared baseline and field ownership; safe updates both ways, conflicts, interruption, rollback and duplicate-free repeats. |
| Generalization | Repeat the same workflow on an independent cohort without hand-tuning its components. Arbitrary JavaScript behavior or arbitrary CSS equivalence is not promised. |

## Exit criteria

The first deliverable is a visible application journey from a valid styled original to independently inspected editable Figma output across the cohort. Manual setup, expert edits, refusals and missing mappings count against that outcome. Then prove the reverse consumer and repair loop before release qualification. Current progress and remaining gaps are maintained in [CURRENT.md](CURRENT.md).
