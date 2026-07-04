# 3 · Token Pipeline

Tokens are the aesthetic half of the contract. They live in `tokens/` as DTCG JSON and compile to CSS custom properties that the generated CSS Modules consume.

## File layout & layering

```
tokens/
├── primitives.tokens.json           # raw values: color ramps, spacing, radii, type scale
├── semantic.tokens.json             # mode-INDEPENDENT aliases (spacing insets, radii, type)
└── modes/
    ├── semantic.light.tokens.json   # mode-VARYING color semantics (aliases into primitives)
    └── semantic.dark.tokens.json
```

Components only ever bind to **semantic** tokens (`color.action.primary.background`), never to primitives (`color.blue.600`). Primitives are the palette; semantics are the decisions.

## The DTCG dialect decision (read this before "fixing" the format)

This repo intentionally uses the **legacy/draft DTCG dialect** — hex-string colors (`"$value": "#2563EB"`) and unit-string dimensions (`"$value": "16px"`) — *not* the DTCG 2025.10 stable object forms (`{colorSpace, components, hex}` / `{value, unit}`). Two reasons:

1. **The design-tool sync bridge speaks this dialect.** The bridge's token import/export pipeline converts colors via hex and would not convert object-colors (verified against its source, July 2026). Since that bridge is the phase-2 path to the design tool, matching its dialect keeps the round-trip lossless. (Bridge specifics live in the internal appendix, docs/internal/figma-sync.md.)
2. **The dialect is trivial to compile.** Values are already CSS-ready strings and single-level aliases, so the build needs no token framework at all (see below).

Migration to 2025.10 object forms is mechanical (a value-shape transform) and should happen when the bridge supports it. Track it; don't preempt it.

**Modes** are handled as separate files per mode, mirroring the mental model of the DTCG Resolver Module (still a draft; explicitly not implementable yet). When the resolver stabilizes, these files become resolver `contexts` without restructuring.

## The build (`npm run tokens`)

`scripts/build-tokens.mjs` is a **zero-dependency ~90-line emitter** (deliberately: the fewer moving parts between the source of truth and its outputs, the stronger the demo — and this repo's dialect doesn't need a framework). Style Dictionary was used initially and removed once it was clear the dialect never exercises anything a flatten-resolve-emit pass can't do. If the token set later needs composite types, transforms, or more platforms, Style Dictionary v4 (Node 20) or v5 (Node ≥ 22) drops back in without changing the token files.

| Pass | Sources | Output |
|---|---|---|
| light | primitives + semantic + `semantic.light` | `src/styles/tokens.css` → everything under `:root` |
| dark | `semantic.dark` only | `src/styles/tokens.dark.css` → **only mode-varying tokens** under `[data-theme="dark"]` |

The emitter enforces two integrity rules at build time: every alias must resolve to a real token, and the light/dark mode files must define **identical token sets** (a token present in one mode but not the other is drift inside the source of truth itself). Alias chains are preserved as `var()` references, so the generated CSS reads like the token architecture:

```css
:root {
  --color-blue-600: #2563eb;                                    /* primitive */
  --color-action-primary-background: var(--color-blue-600);     /* semantic decision */
}
[data-theme="dark"] {
  --color-action-primary-background: var(--color-blue-500);     /* dark overrides ONLY the decision */
}
```

Theme switching is one attribute: `document.documentElement.dataset.theme = 'dark'`. The Storybook toolbar toggle does exactly this, so every story exercises the full pipeline.

Note the dark block's `var()` references point at primitives that live only in `:root` — resolved correctly at runtime by the cascade. Don't "fix" this by duplicating primitives into the dark block.

### Naming convention

CSS custom property = token path joined with `-`: `color.action.primary.background` → `--color-action-primary-background`. The generator computes variable names with the same rule, which is what lets it validate contract bindings against the token inventory. In phase 2, the same names are written into each design-tool variable's web code-syntax metadata, so the tool's developer view shows the real CSS variable for every design-tool variable.

## Design-tool mapping (phase 2 preview)

| Token layer | Canvas structure |
|---|---|
| `primitives.tokens.json` | Collection **Primitives**, single mode |
| `semantic.tokens.json` + `modes/*` | Collection **Semantic**, modes **Light**/**Dark**, values as variable aliases into Primitives |

Note: the reference design tool gates per-collection mode counts by plan tier; light + dark in one collection requires a paid tier. Details in the internal sync appendix.
