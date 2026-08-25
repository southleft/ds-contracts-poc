# Radix Themes — provenance (held-out exam material, PREPARED BLIND)

**BLINDNESS RULE.** Every artifact in `examples/radix-themes/` and
`extract/computed/configs/radix-themes.json` was authored from Radix Themes' own
documentation and shipped source only. **No capture, promote, emit or bundle
stage of this repo has been run against Radix Themes; no output of ours for it
has been read; nothing here was tuned in response to our pipeline's behaviour.**
This file records where every fact came from and what was verified, so the
first-pass exam measures the tool rather than the preparation.

**Status: PREPARED, NOT RUN.** There is no round to report. There are no
scorecards, no fidelity floors, no refusal ledger, no promoted contracts — those
are the exam's output, and this file will be superseded by a real round
PROVENANCE when it runs.

## Subject

`@radix-ui/themes@3.3.0`, mounted through the local barrel
`@radix-themes-sandbox/ui@0.0.1`, with `react@19.2.8` / `react-dom@19.2.8` /
`esbuild@0.28.2`, pinned in the git-ignored `.radix-themes-sandbox/`. The
recreate block in [README.md §2](README.md) is the source of truth; the real
pin is `@radix-ui/themes@3.3.0` in that sandbox's `package-lock.json`.

Styling method: one prebuilt stylesheet + **1,091 unprefixed CSS custom
properties** scoped to the `<Theme>` element, with `data-*` attributes and
`rt-*` classes carrying prop state. Nearest committed precedents: shadcn (CSS
variables + Radix primitives) and Carbon (one prebuilt stylesheet).

## Where each authored fact came from

| artifact | source |
|---|---|
| every enum axis and its values and default | the shipped `propDefs` — `dist/esm/components/{button,badge,checkbox,switch,text-field,callout,card,avatar,progress,tabs}.props.js` and `dist/esm/components/_internal/base-{button,checkbox,tab-list}.props.js`, copied verbatim |
| `<Theme>`'s own defaults | `dist/esm/components/theme.props.js` — accentColor `indigo`, grayColor `auto`, panelBackground `translucent`, radius `medium`, scaling `100%`, appearance `inherit` |
| the token vocabulary | `styles.css`, parsed by `scripts/build-tokens.mjs`; scope allowlist derived from the attributes a default `<Theme>` renders |
| `Checkbox` tri-state (`checked` unchecked/checked/indeterminate) | the Radix Primitives Checkbox API the Themes component wraps |
| the ghost-Card negative margin | `components.css` `.rt-variant-ghost` (`margin-inline: -48px` at size 5) |
| every mount decision | README §4, each with its reason |

## Named findings — what this library costs the config grammar

Full detail in [README.md §4](README.md). In short:

1. **`importName` cannot name a compound export.** Radix Themes ships
   `TextField.Root`, `Callout.Root`, `Tabs.Trigger` as namespace-object members;
   the harness emits `importName` into an `import { … }` specifier, where a
   dotted name is invalid. Three of ten components are unmountable without the
   sandbox barrel (shadcn precedent). Cost: `library.package`/`version` describe
   the barrel, not the subject.
2. **`<Theme>` is a real DOM box and the ONLY scope the 1,091 properties are
   declared on** — nothing at `:root`. The docs/21 §4.2 trap in its purest form.
3. **`varPrefix` must be `--`** (whole vocabulary); Radix Themes has no prefix.
4. **The ghost Card bleeds out of a padded stage** — hence Card's own stage with
   48 px padding.
5. **Child-axis deferrals (docs/21 §7.3):** `Tabs.List`'s `size`/`wrap`/`justify`
   and `TextField.Slot`'s `side` cannot be axes; pinned at source defaults and
   deferred by name.

## What was verified before commit — and how

All of it in the sandbox, with the library rendering itself. **No stage of our
capture/promote/emit chain was involved**; the mount preview is a scratchpad
script that reads the config JSON and mirrors its documented semantics.

- **10 / 10 components mount and render a root element** at their default combo
  and again at their largest enum combo. **0 zero-boxes, 0 console errors, 0
  React warnings.**
- Root tag / class / box measured per component, e.g. Button
  `button.rt-reset.rt-BaseButton.rt-r-size-2.rt-variant-solid.rt-Button`
  68 × 32 on `rgb(62, 99, 221)`; Checkbox `button[role=checkbox]` 16 × 16;
  Avatar `span.rt-AvatarRoot` 40 × 40 (160 × 160 at size 9); Tabs
  `div.rt-TabsRoot` with 10 descendants.
- **Screenshots** of every mounted component (default and largest combo) written
  to the git-ignored `.radix-themes-sandbox/heldout-verify/shots/`.
- **Bind proof (docs/21 §4.2), run against the library alone:**
  `getComputedStyle(document.querySelector('.radix-themes'))` returns
  `--accent-9: #3e63dd`, `--gray-1: #fcfcfd`, `--space-3: calc(12px * 1)`,
  `--radius-3: calc(6px * 1 * 1)`; the Theme element carries
  `data-accent-color="indigo" data-gray-color="slate" data-radius="medium"
  data-scaling="100%" data-panel-background="translucent"`.
- **Token-file agreement, name by name, against the browser:** 1,091 names ·
  **1,066 byte-identical** · 15 differ by whitespace inside multi-line
  box-shadow strings · 6 differ by CSS quote style inside font stacks · **0
  differ in value** · 4 report empty (`code-font-weight`, `em-font-weight`,
  `quote-font-weight`, `strong-font-style`).
- **`loadConfig()` accepts the config** — the engine's own validator, which reads
  the config and runs no capture.
- **21 seed contracts across the three held-out subjects parse under
  `ContractSchema`** (10 of them this library's).

## Two decisions that are judgement, and are therefore stated

- **`classAllow: "^rt-[A-Z][A-Za-z]*$"`** keeps the identity classes
  (`rt-Button`, `rt-BaseButton`, `rt-CheckboxRoot`) and drops the per-combo value
  classes (`rt-r-size-2`, `rt-variant-solid`, `rt-high-contrast`) and the
  `rt-reset` base. The rule behind it: a part's signature must not change when an
  axis moves. Authored from the class names the library emits, before any capture
  ran.
- **The token file wraps the light, default-Theme scopes only.** `.dark` /
  `.dark-theme` is a MODE, not a second capture (the shadcn posture); a
  non-default attribute value (`data-radius='full'`, another accent) is a
  different configuration of the library, not what it ships.

## What has deliberately NOT been created

`extract/computed/out/radix-themes/`, `examples/radix-themes/contracts/`,
`examples/radix-themes/figma/`, `examples/radix-themes/storybook/`. The minted
tree is a committed **zero-leaf stub** under the documented
`tokens.mintedBootstrap` allowance (a genuine first-ever pass); `loadConfig`
refuses the flag by name once the tree carries leaves.
