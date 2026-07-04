# 4 · Code Generation

`npm run generate` (part of `npm run build`) runs `scripts/generate-components.ts`, which reads every `contracts/*.contract.json` and emits, per component:

| File | Derived from |
|---|---|
| `src/components/<Name>/<Name>.tsx` | `semantics.element`, `props` (+ bindings), `description` |
| `src/components/<Name>/<Name>.module.css` | `anatomy` token bindings + `states` |
| `src/components/<Name>/<Name>.stories.tsx` | `props` → argTypes/args, enum values → per-variant stories + a Matrix story, `description` → autodocs |
| `src/components/<Name>/index.ts` | re-export |
| `src/components/index.ts` | barrel of all generated components |

## The two rules

1. **Generated files are never edited by hand.** Every generated file carries a `GENERATED FILE — DO NOT EDIT` header naming its contract. To change a component, change its contract and regenerate. (In phase 3, a hand edit becomes a legitimate *proposal* — the parity tooling detects it and offers a contract patch. Until then, it's just drift that the next `npm run generate` overwrites.)
2. **Generation fails loudly on integrity violations.** Contract fails Zod validation → build fails with the field path. A token binding (after `{prop}` substitution) doesn't resolve to a real token → build fails naming the contract, the binding, and the missing token. Nothing is papered over.

## What the generator does with each contract section

- **`semantics.element`** picks the JSX element and the React attribute type (`ButtonHTMLAttributes<HTMLButtonElement>`, …). `role` is emitted only when it differs from the element's implicit role.
- **Enum props** become union-typed optional props with contract defaults, and a CSS class per value (`.variant-primary`). The component composes `styles.root` + one class per enum prop.
- **Boolean props** map to the native attribute when the element supports it (`disabled` on `button`/`input`), else `data-<name>`.
- **Text props** map to `children`.
- **Anatomy token bindings** become CSS declarations `property: var(--token-path)`. References without placeholders land on `.root`; references with one `{prop}` placeholder expand across that enum's values. State bindings get pseudo-class selectors (`:hover:not(:disabled)`, `:focus-visible`, `:disabled`).
- **A small static base** (flex centering, `border: 0`, cursor rules, focus outline style/offset) is currently templated rather than contract-governed — a known gap, candidate for a contract `layout` block in a future schema version.
- **Stories**: a `Playground` story with contract defaults, one story per value of the first enum prop, `Disabled` when a disabled prop exists, and a `Matrix` story rendering every legal combination of the first two enum props — the visual you'll compare against the canvas component set in phase 3.

## Adding a component (the whole workflow)

1. Copy an existing contract in `contracts/`, rename to `<component>.contract.json`.
2. Set `id` (`ds.<name>` — permanent), `name`, `semantics`, `props` with bindings, `anatomy` bindings into **semantic** tokens, `states`, `a11y`.
3. If the component needs semantic tokens that don't exist yet, add them to `tokens/semantic.tokens.json` (mode-independent) or both `tokens/modes/semantic.*.tokens.json` files (mode-varying) — aliasing primitives, never inventing raw values in the semantic layer.
4. `npm run build` — fix whatever the integrity gate reports.
5. `npm run storybook` — the component appears under **Components/** with autodocs, controls, and the Matrix.
6. Open a PR containing the contract (+ token additions) **and** the generated output. The reviewable diff is the contract; the generated diff is evidence of its effect.

## Current limitations (phase 1, deliberate)

- Only the `root` anatomy part is styled; `slot` parts render `children` without structure. Composition/nesting (e.g. Card containing Avatar) is a phase-2+ schema extension — it's where the contract model gets stress-tested, intentionally deferred.
- One `{prop}` placeholder per token reference.
- Supported elements: `button`, `span`, `div`, `a`, `input`. Extend `ELEMENT_META` in the generator as contracts need more.
- No stale-output cleanup: deleting a contract leaves its generated folder behind (delete it manually).
- No interaction tests yet — `@storybook/addon-vitest` play-function tests generated from `states`/`a11y` are the natural next step.
