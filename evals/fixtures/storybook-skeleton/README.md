# storybook-skeleton — the minimal committed Storybook fixture

The smallest viable Storybook package layout that ds-contracts-emitted
stories render in:

```
package.json                    storybook + @storybook/react-vite + react (repo-pinned versions)
.storybook/main.ts              stories glob over src/generated/**/*.stories.@(ts|tsx)
.storybook/preview.ts           imports src/tokens.css (the design system's CSS custom properties)
src/tokens.css                  placeholder — a consumer's token build replaces it
src/generated/                  `ds-contracts generate <contracts..> --out src/generated --stories` lands here
```

Two consumers:

- **`journey-engineer` eval** (evals/run.ts): the CBDS dump fixture is replayed
  through the real propose path, the locally built CLI generates
  React + stories into `src/generated`, and the emitted story module is
  rendered in the real-browser harness with computed-style spot checks
  against the committed Figma ground-truth values (the
  cbds-bridge-check receipt numbers).

  **The full Storybook dev-server / `storybook build` is deliberately NOT run
  by the eval** — it would need a package install (network) and tens of
  seconds per case. Instead the eval (a) asserts the emitted story files land
  inside the committed `main.ts` glob (so a real `npm run storybook` over this
  exact layout picks them up), and (b) bundles the story module with esbuild
  and renders it via the repo's real-browser harness pattern
  (`playwright-core` + `chromiumExecutable()`), asserting the story module
  loads (CSF default meta + stories) and the component's computed styles
  match design truth.

- **`examples/ci/validate.mjs`**: copies this skeleton as the design-led
  consumer repo and DOES run the real `storybook build` there (network
  allowed in that one-shot local validation) — the receipt that the same
  layout also works under full Storybook.
