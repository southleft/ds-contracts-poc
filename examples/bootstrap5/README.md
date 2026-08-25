# Bootstrap 5 — held-out exam subject #2

> ## THE BLINDNESS RULE
>
> **This directory was authored blind, and it must stay blind until the exam
> runs.** Everything here comes from Bootstrap's own documentation
> (<https://getbootstrap.com/docs/5.3/>) and its shipped
> `dist/css/bootstrap.css`.
>
> **No capture, promote, emit or bundle stage of this repo has been run against
> Bootstrap. No output of ours for it has been read. Nothing here was tuned in
> response to our pipeline's behaviour.** If you find yourself wanting to change
> a value in this directory because "the capture would do X", stop — that is
> exactly the contamination this exam exists to detect.
>
> The exam's own rules and command list live in
> [`parity/receipts/v1/HELD-OUT-MANIFEST.md`](../../parity/receipts/v1/HELD-OUT-MANIFEST.md).

---

## 1 · Subject and pins

| pin | value |
|---|---|
| `bootstrap` | **5.3.8** |
| `@popperjs/core` | 2.11.8 (installed for completeness; **not loaded** — see §4.5) |
| react / react-dom | 19.2.8 (the harness's renderer, **not** a Bootstrap dependency) |
| esbuild | 0.28.2 |

## 2 · THE STRUCTURAL FACT: Bootstrap is not a component library

Every other subject in this corpus exports components. **Bootstrap exports
nothing.** A "Bootstrap Button" is the string `class="btn btn-primary"` written
onto a `<button>` element *you* author. There is no `Button` to import, no prop
to set, no runtime to configure. Its API surface is **CSS class names plus
documented markup**.

That is the reason this subject is in the exam. Our capture harness mounts React
elements; the question is whether a class-based, runtime-free library can be
expressed honestly in that grammar at all, or only by inventing a React wrapper
nobody ships.

**No React component was invented here.** The config rides the one non-React
door the grammar has — `library.customElements`, which makes `importName` a
**tag name** mounted as `React.createElement(tag, props)` — so the DOM the
harness produces is Bootstrap's documented markup verbatim, and the class token
rides `axisValueMap`'s `$props.className`. See §4 for what that costs.

**No webfont ships with Bootstrap**, so this config declares no `fonts` block:
`--bs-font-sans-serif` is a system stack. `bootstrap.css` contains `url()` only
as inline `data:` SVGs (the form-check indicators, `.btn-close`, the accordion
chevron), so the harness stays network-free with no loader configuration.

## 3 · Recreate the sandbox (git-ignored; this block is the source of truth)

```bash
mkdir -p examples/bootstrap5/.bootstrap5-sandbox
cd examples/bootstrap5/.bootstrap5-sandbox
printf '{"name":"bootstrap5-sandbox","private":true,"type":"module"}\n' > package.json
npm i -E bootstrap@5.3.8 @popperjs/core@2.11.8 react@19.2.8 react-dom@19.2.8 esbuild@0.28.2
```

No build step: Bootstrap ships `dist/css/bootstrap.css` precompiled, and the
capture mounts it with one `import`. Then, from the repo root:

```bash
node examples/bootstrap5/scripts/build-tokens.mjs
```

## 4 · The ten components — and what the grammar cannot say

Each mount below is the markup from that component's own Bootstrap docs page.

| component | root markup | axis (class token) | states | notes |
|---|---|---|---|---|
| Button | `<button class="btn btn-*">` | `variant` — 8 theme colours + `link` + 2 `outline-*` | disabled | **`size` is not expressible — see §4.1** |
| Alert | `<div class="alert alert-*" role="alert">` | `variant` — 8 theme colours | — | |
| Badge | `<span class="badge text-bg-*">` | `variant` — 8 theme colours | — | |
| FormControl | `<input class="form-control form-control-*">` | `size` — sm / (none) / lg | disabled | the one component whose single class axis IS size |
| FormCheck | `<div class="form-check[ form-switch\| form-check-inline]">` | `variant` — check / switch / inline | — | `childrenSpec`: `input.form-check-input` + `label.form-check-label`; **`checked` deferred — §4.2** |
| Card | `<div class="card">` | — | — | `childrenSpec` 2 deep: card-body → title / text / btn |
| Progress | `<div class="progress" role="progressbar" aria-valuenow=60 …>` | — | — | `childrenSpec`: `.progress-bar` with `style={{width:'60%'}}`; **bar variant deferred — §4.2** |
| Spinner | `<div class="spinner-border\|spinner-grow" role="status">` | `variant` — border / grow | — | **never reaches a steady state — §4.3** |
| NavTabs | `<ul class="nav nav-*">` | `variant` — tabs / pills / underline | — | `childrenSpec` 2 deep: 3 `li.nav-item` → `a.nav-link` (active / plain / disabled) |
| Modal | `<div class="modal" style="display:block">` | — | — | documented modal markup, forced open — §4.4 |

### 4.1 THE BIG ONE: two class axes on one component cannot both be expressed

`comboProps` (`extract/computed/capture.ts`) folds every axis into **one flat
prop bag**, and `axisValueMap`'s `$props` writes into it with **last writer
wins**:

```ts
for (const [lp, lv] of Object.entries(expand)) props[lp] = lv;
```

For a class-based library, *every* axis wants to write `className`. Declaring
Button as `variant × size` would therefore mount `className: "btn btn-lg"` and
**silently drop the variant** — the exact class of silent loss this project
exists to refuse. So Button ships with `variant` as its only axis and
**`size` (`btn-sm` / `btn-lg`) is deferred by name**, likewise the
`progress-bar-striped` / `bg-*` bar modifiers and `badge rounded-pill`.

The grammar gap is real and worth naming precisely: there is no *merge*
semantic for `$props`, and no per-axis library-prop namespace. A
`{"$props": {"className+": "btn-lg"}}` append form, or an ordered class-token
axis kind, would close it. Neither exists today, and inventing one here would be
tuning the instrument to the exam.

### 4.2 Child-part axes are deferred (docs/21 §7.3)

The axis grammar drives the **root** mount only. Bootstrap puts several of its
interesting states on a *child*: `checked` lives on `.form-check-input`, the
bar's colour and stripes live on `.progress-bar`, `active`/`disabled` live on
`.nav-link`. Those are pinned in `childrenSpec` at a documented value
(`defaultChecked` on the check input, one active / one plain / one disabled
nav-link) and deferred by name — the same deferral the shadcn round records.

### 4.3 The spinners have no steady state

`.spinner-border` and `.spinner-grow` are pure CSS keyframe animations that run
forever; `spinner-grow` in particular animates `transform: scale(0)` → `scale(1)`
with `opacity`. There is **no moment at which the component stops moving**, so a
"two stable samples" steady-state probe cannot converge and whatever geometry is
recorded is the geometry of one arbitrary instant. Measured in the sandbox:
`.spinner-border` reads 43×43 on one sample and `.spinner-grow` reads 10×10 on
another, then 4×4 on a third. Both mounts are correct; the *concept* of a
steady state does not apply. Expect this row to be strange, and read it as an
animation fact, not a conversion defect.

### 4.4 Modal is the documented markup, forced open — not a live modal

The subtree mounted for Modal is Bootstrap's documented modal markup verbatim:
`.modal` → `.modal-dialog` → `.modal-content` → `.modal-header` (`.modal-title`
+ `.btn-close`) → `.modal-body` → `.modal-footer` (two `.btn`s). Two things
differ from a copy-paste of the docs, and **both are ours, not Bootstrap's**:

- **`.fade` is omitted.** Bootstrap documents this exactly ("Remove the `.fade`
  class from the modal markup to disable the fade-in animation"), and an
  animation that never settles has no honest steady-state geometry — the same
  problem §4.3 describes for the spinners.
- **`style="display: block; position: static"`.** `.modal` ships
  `display: none; position: fixed`. Without `display: block` there is nothing to
  capture at all; without `position: static` the dialog is lifted out of the
  stage and pinned to the viewport. Normally `bootstrap.bundle.js` sets
  `display: block` and adds `.show` when the modal opens; this config loads no
  JS (§4.5), so the style attribute stands in for it.

There is also **no `.modal-backdrop` sibling**, because the backdrop is an
element the JS creates at runtime.

So what the exam measures is the modal's **surface** — dialog, content, header,
title, close button, body, footer, two buttons — and *not* the portal-to-body
overlay, the `.fade` transition, the `.show` class's own rules, or the backdrop.
That is stated here so a thin Modal result is interpretable rather than
surprising.

### 4.5 No JavaScript is loaded at all

`bootstrap.bundle.js` (and Popper) are deliberately absent from
`mount.imports`. The brief allows "jQuery-free JS where a component needs it";
with the static-example modal, **none of the ten components needs any**, and a
capture with no script running is strictly more deterministic. Everything the
JS provides — dropdown positioning via Popper, tooltip/popover portals, carousel
transitions, collapse animations, the modal backdrop — is therefore out of this
config's reach by construction.

### 4.6 `classAllow` drops the theme-colour modifiers

`classAllow` keeps Bootstrap's structural classes (`btn`, `alert`, `card-body`,
`nav-link`, `progress-bar`) and drops the theme-colour modifiers
(`btn-primary`, `alert-danger`, `text-bg-info`, `btn-outline-*`). The reason is
the part-signature rule, not cosmetics: **a part's identity must not change when
an axis moves**, and in Bootstrap the axis value *is* a class. The excluded list
is Bootstrap's own documented `$theme-colors` map plus `text-bg-*` and
`btn-outline-*` — a library fact, written before any capture ran.

### 4.7 `customElements: true` carries two documented side effects

The flag is named for custom elements and Bootstrap ships none; it is used here
as the grammar's only tag-name mount. Two behaviours ride along, and neither
harms this subject: `false`/function props are dropped before mount (Bootstrap
uses neither), and the shadow-DOM descent path switches on (documented to
degrade to the plain element walk when no shadow root exists — Bootstrap has
none).

## 5 · Verified before commit

Run in the sandbox, with Bootstrap styling itself and nothing of ours in the
loop:

- **10 / 10 components mount and render a root element**, at their default combo
  and again at their largest enum combo. **0 zero-boxes, 0 console errors, 0
  React warnings** — including React passing `class`, `role`, `aria-*`,
  `tabindex` and inline `style` through to plain host tags untouched.
- Screenshots of every mounted component are written to the git-ignored
  `.bootstrap5-sandbox/heldout-verify/shots/`.
- The committed DTCG file was checked name-by-name against `getComputedStyle`
  on `:root`: **127 names · 101 byte-identical · 23 differ by whitespace only
  (multi-line `linear-gradient` / font stacks) · 0 differ in value · 3 report
  empty** (`bs-btn-close-filter`, `bs-carousel-control-icon-filter`,
  `bs-heading-color` — all declared but empty by default in Bootstrap's light
  theme).
- `loadConfig()` — the engine's own config validator, which reads the config and
  runs no capture — accepts `extract/computed/configs/bootstrap5.json`.

## 6 · A note on the token file's denominator

`tokens/bootstrap5.dtcg.json` wraps the **127 global `--bs-*` declarations** on
`:root, [data-bs-theme=light]`. It deliberately does **not** wrap Bootstrap's
per-component local sets (`--bs-btn-bg` on `.btn`, `--bs-alert-color` on
`.alert`, and so on for most components). Those are declared on the component's
own root, they are what a CSS-vars reader actually observes at the element, and
their values come from the globals that *are* wrapped. Whether the reader can
bind through that extra hop is a question this exam asks; pre-answering it in
the token file would be tuning.

## 7 · What has NOT been done, on purpose

No capture has run. `extract/computed/out/bootstrap5/` does not exist, there are
no scorecards, no `contracts/`, no `figma/`, no emitted React. The minted tree
`tokens/bootstrap5-minted.dtcg.json` is a committed **zero-leaf stub** riding
the documented `tokens.mintedBootstrap` allowance — a genuine first-ever pass.
