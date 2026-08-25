# Bootstrap 5 — provenance (held-out exam material, PREPARED BLIND)

**BLINDNESS RULE.** Every artifact in `examples/bootstrap5/` and
`extract/computed/configs/bootstrap5.json` was authored from Bootstrap's own
documentation and shipped stylesheet only. **No capture, promote, emit or bundle
stage of this repo has been run against Bootstrap; no output of ours for it has
been read; nothing here was tuned in response to our pipeline's behaviour.**

**Status: PREPARED, NOT RUN.** There is no round to report — no scorecards, no
fidelity floors, no refusal ledger, no promoted contracts.

## Subject

`bootstrap@5.3.8` (plus `@popperjs/core@2.11.8`, installed but **not loaded**),
with `react@19.2.8` / `react-dom@19.2.8` / `esbuild@0.28.2`, pinned in the
git-ignored `.bootstrap5-sandbox/`. The recreate block in
[README.md §3](README.md) is the source of truth.

**This is the corpus's first subject that exports no components at all.** A
"Bootstrap Button" is `class="btn btn-primary"` on markup the consumer writes.
Its API is class names plus documented HTML, and that is the whole reason it is
in the exam: can a class-based, runtime-free library be expressed in a
React-mounting capture grammar honestly, or only by inventing a wrapper nobody
ships?

**No React component was invented.** The config uses `library.customElements`,
the grammar's one tag-name mount, so the harness produces Bootstrap's documented
markup verbatim.

## Where each authored fact came from

| artifact | source |
|---|---|
| every mount's markup | that component's page on getbootstrap.com/docs/5.3 — button, alert, badge, forms/form-control, forms/checks-radios, card, progress, spinners, navs-tabs, modal ("static example") |
| the theme-colour list | Bootstrap's documented `$theme-colors` map (primary secondary success danger warning info light dark) |
| the global token vocabulary | `dist/css/bootstrap.css`, `:root, [data-bs-theme=light]`, parsed by `scripts/build-tokens.mjs` |
| `varPrefix: "--bs-"` | Bootstrap's own documented CSS-variable prefix |
| every mount decision | README §4, each with its reason |

## Named findings — what this library costs the config grammar

Full detail in [README.md §4](README.md). In short:

1. **TWO CLASS AXES ON ONE COMPONENT CANNOT BOTH BE EXPRESSED.** `comboProps`
   folds every axis into one flat prop bag and `axisValueMap`'s `$props` writes
   with last-writer-wins (`props[lp] = lv`). For a class-based library every axis
   wants `className`, so `variant × size` on Button would mount
   `className: "btn btn-lg"` and **silently drop the variant**. Button therefore
   ships `variant` only and **`btn-sm` / `btn-lg` is deferred by name**, as are
   the `progress-bar-striped` / `bg-*` bar modifiers and `badge rounded-pill`.
   The closing move would be an append form (`"className+"`) or an ordered
   class-token axis kind; neither exists, and inventing one here would be tuning
   the instrument to the exam.
2. **Child-part axes are deferred (docs/21 §7.3):** `checked` on
   `.form-check-input`, colour/stripes on `.progress-bar`,
   `active`/`disabled` on `.nav-link`. Pinned in `childrenSpec` at documented
   values.
3. **The spinners have no steady state.** Both are infinite CSS keyframe
   animations; `spinner-grow` scales 0→1 forever. Measured across separate
   mounts: `.spinner-border` 43 × 43, `.spinner-grow` 10 × 10 and then 4 × 4.
   A "two stable samples" probe cannot converge on this component. Read the row
   as an animation fact, not a conversion defect.
4. **Modal is the documented markup, FORCED OPEN.** The subtree is Bootstrap's
   documented modal markup verbatim; two things are ours and are named as ours:
   `.fade` omitted (Bootstrap documents that removal, and an animation that never
   settles has no honest steady-state geometry — see finding 3) and
   `style="display: block; position: static"` standing in for what
   `bootstrap.bundle.js` normally does on open (`.modal` ships
   `display: none; position: fixed`, and `position: fixed` would lift the dialog
   out of the stage). There is no `.modal-backdrop` sibling because the JS
   creates it. So the exam sees the dialog surface and not the portal overlay,
   the `.fade` transition, the `.show` rules, or the backdrop.
5. **No JavaScript is loaded at all** — with the static-example modal, none of
   the ten components needs it, and a script-free capture is strictly more
   deterministic. Dropdown positioning, tooltips/popovers, carousel, collapse and
   the modal backdrop are out of reach by construction.
6. **`customElements: true` carries two documented side effects** — `false`/
   function props dropped before mount, and the shadow-descent capture path
   switched on (documented to degrade to the plain element walk with no shadow
   root). Neither harms this subject.

## What was verified before commit — and how

All of it in the sandbox, with Bootstrap styling itself. **No stage of our
capture/promote/emit chain was involved.**

- **10 / 10 components mount and render a root element** at their default combo
  and again at their largest enum combo. **0 zero-boxes, 0 console errors, 0
  React warnings** — including React passing `class`, `role`, `aria-*`,
  `tabindex` and inline `style` through to plain host tags untouched, which is
  the specific thing that had to be true for a tag-name mount to be honest.
- Measured roots, e.g. `button.btn.btn-primary` 74 × 38 on `rgb(13, 110, 253)`;
  `div.alert.alert-primary[role]` 236 × 58; `input.form-control` 348 × 38;
  `div.card` 348 × 168 with 4 descendants; `ul.nav.nav-tabs` with 6 descendants;
  `div.modal` with 10 descendants.
- **Screenshots** of every mounted component (default and largest combo) written
  to the git-ignored `.bootstrap5-sandbox/heldout-verify/shots/`. The Modal shot
  shows the full dialog — header, title, close button, body, footer, two buttons.
- **Bind proof (docs/21 §4.2):** `getComputedStyle(document.documentElement)`
  returns `--bs-primary: #0d6efd`, `--bs-body-color: #212529`,
  `--bs-border-radius: 0.375rem`.
- **Token-file agreement, name by name, against the browser:** 127 names ·
  **101 byte-identical** · 23 differ by whitespace only (multi-line
  `linear-gradient` and font stacks) · **0 differ in value** · 3 report empty
  (`bs-btn-close-filter`, `bs-carousel-control-icon-filter`, `bs-heading-color`
  — declared but empty in Bootstrap's light theme).
- **`loadConfig()` accepts the config.**
- **The 10 seed contracts parse under `ContractSchema`.**

## Two decisions that are judgement, and are therefore stated

- **`classAllow` drops the theme-colour modifiers** (`btn-primary`,
  `alert-danger`, `text-bg-info`, `btn-outline-*`) and keeps the structural
  classes. The rule behind it: a part's signature must not change when an axis
  moves, and here the axis value *is* a class. The excluded list is Bootstrap's
  own `$theme-colors` map — a library fact, written before any capture ran.
- **The token file wraps the 127 GLOBAL `--bs-*` declarations only**, not
  Bootstrap's per-component local sets (`--bs-btn-bg` on `.btn`,
  `--bs-alert-color` on `.alert`, …). Those are declared on the component's own
  root, they are what a CSS-vars reader observes at the element, and their values
  come from the globals that *are* wrapped. Whether the reader binds through that
  extra hop is a question the exam asks; pre-answering it in the token file would
  be tuning.

## What has deliberately NOT been created

`extract/computed/out/bootstrap5/`, `examples/bootstrap5/contracts/`,
`examples/bootstrap5/figma/`, `examples/bootstrap5/storybook/`. The minted tree
is a committed **zero-leaf stub** under the documented `tokens.mintedBootstrap`
allowance.
