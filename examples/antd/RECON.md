# P2 EXAM RECON — Ant Design v5, code→canvas (brownfield B1)

```
date       2026-08-23
tree       origin/main fa88dbf1 (worktree scratchpad/recon-antd, removed after this recon)
subject    antd@5.29.3 · @ant-design/cssinjs@1.24.0 · @ant-design/icons@5.6.1 · react@18.3.1 · esbuild@0.28.x
sandbox    examples/antd/.antd-sandbox (gitignored; package.json archived at probe/sandbox-package.json)
held-out   ZERO mentions of antd anywhere in docs/ parity/ core/ extract/ evals/ scripts/ examples/ before this recon
writes     none — no PR, no commit, no Figma write; every artifact is under scratchpad/p2-exam-antd/
```

Deliverables in this directory: `RECON.md` (this), `antd.config.json` (draft capture config, `__draft`-marked so
`loadConfig` refuses it until the landing steps in §8 are done), `scripts/build-tokens.mjs` (runs; verified),
`tokens/` (the built wrap: 502 leaves + light/dark modes + the live cssVar dump it refuses against),
`contracts-seed/button.contract.json` (curated seed, passes `ContractSchema` + `validateContract`),
`probe/` (the measurement scripts; re-runnable), `probe-*.png` (one screenshot per theme mode),
`probe-modes.json` / `antd-vars.json` / `rules-cssvarfont.json` / `anatomy-cssvarfont.txt` (raw measurements).

## 0. Verdict in four lines

1. **The engine's existing doors fit antd without a new mechanism** — IF the mount pins four things: `cssVar:{key:'antd'}`, `hashed:false`, `wave={{disabled:true}}`, `token.fontFamily`. Each pin is measured (§2), each has a committed precedent (MUI `cssVariables:true`, Carbon `<Theme>`, MUI `disableRipple`, MUI/Altitude `fonts`).
2. **The token wrap is solved and verified**: `getDesignToken()` + cssinjs `token2CSSVar` reproduce all 350 live global custom properties and all 152 exam-component ones, value-identical, with a drift refusal (§2.5).
3. **The exam's predicted walls are all pseudo-element and geometry walls already named in docs/23 §B** (B.4 two-axis pseudo geometry, FC-PSEUDO-STROKE-GLYPH, FC-METER/FC-GEOMETRY-EXCLUDED, B.1/B.2 portal) plus two antd-specific ones: the `outline` focus ring (not a carried channel) and the `scale()`-revealed radio dot (§6). The exam's job is to prove these land NAMED, not SILENT.
4. **Two instrument defects found before capture**: seed-gen reads none of antd's enums (it does not parse `readonly [...]` tuples → Button proposes `size` only, 1 of 4 design axes), and the DTCG wrap needs per-component unitless tables that antd does not export (caught by the drift refusal on `--ant-tooltip-z-index-popup`). Both are §7 work items.

## 1. What was read (the grammar the exam must obey)

- `extract/computed/capture.ts:198-371` `CaptureConfig` / `:99-196` `ComponentConfig` — the only schema. `classAllow` filters the serialized `classes` only (capture.ts:1011-1012, applied at :1409); part identity = `signature = tag|stems` (lib.ts:659-663); the double-run byte-identity check fails the run on any signature drift (run.ts:249-251, :309).
- CSS-vars reader: on iff `library.varPrefix` (capture.ts:1246); reads CSSOM rules per root (`document.styleSheets`, recursing grouping rules), matches with `el.matches(sel)` (so `:where()` costs nothing), one indirection hop, Node side keeps a candidate only when its resolved value string-equals the captured computed value AND the kebab name is a DTCG leaf (run.ts:633-810; examples/mui/PROVENANCE.md:20-33). `calc(var())` lands in `vcalcs` (named ceiling), shorthands in `vshorthands`.
- States are driven, never parsed: `INTERACTIONS = default|hover|focus-visible|active` (capture.ts:1514), `disabled` is a `stateProps` axis; `settleStage` polls computed + pseudo planes to two identical samples (capture.ts:1641-1656); infinite animations pinned at `currentTime 0` (capture.ts:1517-1538).
- Pseudo planes: read `::before ::after ::marker ::placeholder` (lib.ts:317), promote `::before/::after` only through the pseudo-decor v1 grammar (anatomy.ts:2040-2700; absolute boxes, bg-alpha + border rings, translate + orthonormal rotate) with ~14 named refusal codes.
- Carried channels (lib.ts:585-640 `CHANNEL_TO_COMPUTED`): background-color, color, fill, border-radius/-color/-width (+longhands), padding-block/-inline, font-size/-weight/-family, line-height, letter-spacing, gap, min/max-width/height, box-shadow, background-image. **Not carried: outline, transform, clip-path, inset-*, opacity, width/height (FC-GEOMETRY-EXCLUDED, fuse.ts:545-575, the Option B obligation = ledger every drop).**
- Seeds: `examples/<lib>/contracts-seed/` (props/axes/defaults + Figma VARIANT names, empty anatomy) — NEVER the directory promote writes (docs/23 §D.2, the Astryx self-read + static-seed traps).
- Sandbox: `--harness <dir>` with the library + react/react-dom + esbuild; esbuild bundles `computed-capture-page/entry.jsx` with no `--define` → `process.env.NODE_ENV` = `development` → **the harness page runs antd in DEV mode** (hash class spelled `css-dev-only-do-not-override-<hash>`; style injection via text nodes, readable CSSOM).
- Accuracy grammar: canvas denominator CARRIED/LEDGERED/REFUSED (extract/figma/conformance/run.ts:22-33); SILENT is the never-waivable red (conformance/CANVAS-EXPECTATIONS.md:25-33); loss-ledger verdicts OK/MINTED/NAMED-GAP/SILENT-LOSS (docs/STYLE-FIDELITY.md:12-19); FC-* registry (parity/receipts/console-loop/CODE-TO-CANVAS-HILLCLIMB.md:54-86). Receipt sibling to mirror: `parity/receipts/phase-2/FIGMA-DS-EXAM.md` (pass condition `SILENT = 0`, per-set `carried · named · silent` table).

## 2. Measured findings (probe page: 60 cells × 5 theme modes, headless Chromium, file://)

### 2.1 Styling runtime
| fact | measured |
|---|---|
| injection | 43 `<style data-rc-order="prependQueue" data-css-hash data-token-hash="1g3r1lh" data-cache-path="1g3r1lh\|Button-Button\|ant-btn\|anticon">` tags on the single-mode page (59 in cssVar mode — one extra per component for its var block) |
| CSSOM | **every sheet readable** — 1,673 style rules via `sheet.cssRules` (Button alone 433 / 85 KB); `textContent` also populated (dev-mode `updateCSS`), so neither insertRule nor file:// opacity is a ceiling |
| `@layer` | **0** (antd 5 has an opt-in `layer` config; default off). `@media`: **1** — `(hover: none) { .ant-select .ant-select-clear {…} }`. No `any-hover` gate anywhere: hover/active/focus rules are top-level selectors (187 `:hover`, 109 `:active`, 7 `:focus-visible`, 396 `:disabled`/`-disabled`) |
| `!important` | 12 rules; `rem` 0; `calc(` 153 rules (all `calc(var(--ant-…))` in cssVar mode → `vcalcs`) |
| nesting | 0 CSSOM-nested rules (cssinjs flattens) |

### 2.2 The five theme modes, one number each
| mode | `:where(hash)` selectors | hash class on roots | `var()` uses | literal colour decls | var definitions | render |
|---|---|---|---|---|---|---|
| default | 1,660 / 1,673 | `css-dev-only-do-not-override-mncuj7` (stable across two reloads) | 11 | 654 | — | styled |
| `hashed:false` | 0 | none | 11 | 654 | — | styled, pixel-identical |
| `cssVar:true, hashed:false` | 0 | `css-var-r0` (**instance counter**) | 2,510 | 12 | `.css-var-r0` 350 decls + `.css-var-r0.ant-btn` 56 … | styled, pixel-identical |
| `cssVar:{key:'antd'}` | 0 | `antd` (stable) | 2,510 | 12 | `.antd` 350 + per-component | styled, pixel-identical |
| + `token.fontFamily`, `motion:false`, `wave.disabled` | 0 | `antd` | 2,510 | 12 | same; `--ant-font-family` / `--ant-motion-duration-*` rewritten | styled; transitions 0s; **0 `.ant-wave` nodes** |

Pixel identity across modes (Button primary): rest `rgb(22,119,255)` → hover `rgb(64,150,255)` → active `rgb(9,88,217)`; border `1px solid transparent`; radius 6px; h 32px; pad `0 15px`; shadow `0 2px 0 rgba(5,145,255,.1)`; font 14px/normal 400 — identical in all five modes.

**Mixed-mode artefact (probe-1, `probe.png`)**: three ConfigProviders (default + unhashed + cssVar) in ONE document rendered the two non-cssVar sets UNSTYLED (Times 16px, no bg) while the cssVar set rendered. antd cannot mix cssVar and non-cssVar providers in one page. The harness mounts one wrapper, so this is a note, not a wall — but a landing agent must never A/B the modes inside one harness page.

### 2.3 Class shape (the `classAllow` grammar)
antd is **not BEM**: `ant-btn-icon` (element) and `ant-btn-primary` (modifier) share one spelling, and since 5.21 the Button also carries a derived pair `ant-btn-color-{default|primary|link|dangerous}` × `ant-btn-variant-{outlined|solid|dashed|link|text}` next to the legacy `ant-btn-{type}`. Measured root class lists (cssVar key mode):
```
button.ant-btn.antd.ant-btn-primary.ant-btn-dangerous.ant-btn-color-dangerous.ant-btn-variant-solid
button.ant-btn.antd.ant-btn-round.ant-btn-default.ant-btn-color-default.ant-btn-variant-outlined.ant-btn-sm
span.ant-tag.ant-tag-blue.antd · span.ant-tag.ant-tag-borderless.antd
button.ant-switch.ant-switch-small.antd.ant-switch-checked · button.ant-switch.ant-switch-loading.antd.ant-switch-checked.ant-switch-disabled
input.ant-input.ant-input-sm.ant-input-outlined.ant-input-status-error.antd.ant-input-css-var
span.ant-avatar.ant-avatar-lg.ant-avatar-square.antd.ant-avatar-css-var
div.ant-progress.ant-progress-status-exception.ant-progress-line.ant-progress-line-align-end.ant-progress-line-position-outer.ant-progress-show-info.ant-progress-default.antd
```
The draft `classAllow` (antd.config.json) is MUI-shaped (lookaheads), validated against the 132 distinct classes on the probe page: 61 kept / 71 dropped, with the four deliberate positive exceptions (`anticon`, `ant-switch-inner-checked|unchecked`, `ant-progress-text`, `ant-badge-status-dot|text` — elements whose last word is also a modifier word). Dropped without a rule by the `ant-` prefix test: `antd`, `css-dev-only-do-not-override-*`, `current` (rc-scroll-number transient), `anticon-<glyph>`. **Must be re-measured with `classAllow` absent on one Button capture before the `__draft` marker is deleted** (docs/21 method) — the probe page is 60 cells, not the cartesian.

### 2.4 States, motion, the wave
- **Wave** (`.ant-wave`): on mouse.up antd appends `<div class="ant-wave wave-motion-appear wave-motion-appear-active wave-motion" style="left:-1px;top:-1px;width:82px;height:32px;border-radius:6px;--wave-color:rgb(11,90,218)">` INSIDE the clicked root; it animates by transition (`box-shadow 0.4s, opacity 2s`, not keyframes) and is **still present 1.3 s later** (measured 1 node). The active driver ends with `mouse.up()` (capture.ts:1821) → the node would sit in the subtree during the next combo's read → `(signature)` witness in the double-run. `ConfigProvider wave={{disabled:true}}` → **0 nodes after click** (measured). This is exactly `disableRipple`.
- **Hover/active**: real deltas, no media gate (§2.1). `:active` on Switch elongates the knob pseudo (`inset-inline: 0 -30%`, checked `-30% 0`) — a state × checked geometry product on a pseudo.
- **focus-visible**: `outline: 3px solid rgb(145,202,255); outline-offset: 1px` on Button/Switch/Checkbox-inner/Radio-inner (`var(--ant-line-width-focus) solid var(--ant-color-primary-border)`); Input focus is `box-shadow: 0 0 0 2px var(--ant-control-outline)` + border-color. `outline` is NOT in `CHANNEL_TO_COMPUTED` → the Button/Switch/Checkbox/Radio focus plane carries nothing on the canvas and must land in the code-only extension block. **Prediction: NAMED; verify it is not SILENT** (§6).
- **Keyframes**: 22 (`loadingCircle`, `antStatusProcessing`, `antProgressLTRActive`, `antSpinMove`, `antRotate`, zoom/slide/move families). Infinite ones in the exam: Button/Switch `loading` icon (`loadingCircle 1s`), Badge status-processing ring, Progress `active` — all pinned by the runner. Finite appear motions (Tag/Badge zoom, Radio ring, Tooltip zoom-big-fast) settle.
- **Transitions**: 0.2s cubic-bezier default; `token.motion:false` measured to zero every duration (fallback knob if settle fails; NOT pinned in the draft — library-true motion is kept).

### 2.5 Tokens — the cssVar door and the wrap, verified
- Definitions live on the **cssVar key class placed on every component root** (`.antd` 350 decls; `.antd.ant-btn` 56; `.antd.ant-switch` 13; `.antd.ant-input` 17; `.antd.ant-card` 13; `.antd.ant-radio-css-var` 16; `.antd.ant-avatar-css-var` 12; badge 8, progress 6, tooltip 6, alert 3, tag 2; checkbox **0**), never on `:root`. Custom properties inherit: `getComputedStyle(div.ant-switch-handle)['--ant-switch-handle-bg']` = `#fff`, `['--ant-color-primary']` = `#1677ff`. The Fluent precedent (vars on a wrapper div, `varPrefix` reader verified) applies unchanged.
- Point-of-use example (cssVar mode): `.ant-btn-color-primary.ant-btn-variant-outlined { border-color: var(--ant-color-primary); background: var(--ant-color-bg-container); }` — default mode spells the same rule `border-color: rgb(22,119,255); background: rgb(255,255,255);`.
- **Wrap** (`scripts/build-tokens.mjs`, run against the sandbox): `theme.getDesignToken()` → 501 keys; minus antd's own `ignore` (motionBase, motionUnit), booleans (motion, wireframe), `screen*` (18), and 130 legacy alias collisions (`blue1` and `blue-1` both → `--ant-blue-1`) = **350 global leaves = exactly the 350 live declarations, 0 missing, 0 extra**. Component tokens via each module's `prepareComponentToken` (Input: `initComponentToken`; Checkbox: none) = **152**, matching the live per-component rules. Values: numbers get `px` unless in antd's `unitless` (13 keys) or a per-component unitless the library does NOT export (measured: button fontWeight + contentLineHeight*, radio radioSize/dotSize, tooltip zIndexPopup) — the wrap **refuses on drift** against `tokens/live-cssvar-dump.json` and printed `drift check: 0`. Dark: 290 of 502 leaves differ under `darkAlgorithm` → `modes/antd.{light,dark}.dtcg.json`. DTCG leaf kinds: 291 color, 132 dimension, 68 string, 13 number.
- Reader ceilings to expect by name: `vcalcs` on the 153 calc rules (checkbox tick size `calc(var(--ant-control-interactive-size) / 14 * 5)`, radio dot `calc(1px * var(--ant-radio-radio-size))`, progress fill `calc(1 / var(--progress-percent) * 100%)` — the last on a NON-prefixed var); `box-shadow` source refs (the MUI serialisation refusal: `0 2px 0 rgba(5,145,255,0.1)` vs computed `rgba(5,145,255,0.1) 0px 2px 0px 0px`).

### 2.6 Anatomy, pseudo-elements, inline geometry (exam components, full trees in `anatomy-cssvarfont.txt`)
| component | root → parts | pseudo / inline facts that will hit a wall |
|---|---|---|
| Button | `button.ant-btn > span` (+ `span.ant-btn-icon > span.anticon > svg[viewBox 64 64 896 896, 1 path, fill=currentColor]`; loading: `.ant-btn-loading-icon > .anticon-spin > svg[0 0 1024 1024]`) | `::before/::after` box-sizing only; focus `outline` |
| Tag | `span.ant-tag` (+ `span.anticon.ant-tag-close-icon > svg`) | none (inline-block, 22px) |
| Badge | `span.ant-badge > [span.ant-avatar …] + sup.ant-scroll-number.ant-badge-count > bdi > span.ant-scroll-number-only > span.ant-scroll-number-only-unit` (dot: `sup.ant-badge-dot`, 6×6) | sup `transform: translate(50%,-50%)` absolute overlay — GEOM_ADMIT cluster; digit 3 levels deep; inline `transition:none` on the unit |
| Switch | `button.ant-switch > div.ant-switch-handle + span.ant-switch-inner > .ant-switch-inner-checked + .ant-switch-inner-unchecked` | **knob = `.ant-switch-handle::before`** (absolute, inset 0, 18×18 / 12×12 small, bg `var(--ant-switch-handle-bg)`, radius calc, shadow var); handle `inset-inline-start 2px → 24px` when checked = size × checked product; `:active` `inset-inline: 0 -30%` |
| Checkbox | `label.ant-checkbox-wrapper > span.ant-checkbox > [input.ant-checkbox-input + span.ant-checkbox-inner] + span` | **tick = `.ant-checkbox-inner::after`**: display:table, w/h `calc(size/14*5)`/`(…*8)`, border-right+bottom 2px #fff, `transform: rotate(45deg) scale(1) translate(-50%,-50%)` (scale(0) unchecked); indeterminate: filled square `calc(var(--ant-font-size-lg)/2)` bg primary. NOTE: root props (data-*, className) are forwarded to the INPUT, not the label |
| Radio | `label.ant-radio-wrapper > span.ant-radio > [input + span.ant-radio-inner] + span` | **dot = `.ant-radio-inner::after`**: absolute centred, size `calc(1px*var(--ant-radio-radio-size))`, `transform: scale(calc(dot/size))` checked, scale(0) unchecked; `.ant-radio-checked::after` 1px ring |
| Input | `input.ant-input` (single element) | `::placeholder` plane; `prefix` REPLACES the root with `span.ant-input-affix-wrapper > [span.ant-input-prefix + input]` (measured: the probe's data attr landed on a 22px inner input) |
| Alert | `div.ant-alert > [span.anticon.ant-alert-icon > svg] + div.ant-alert-content > div.ant-alert-message [+ div.ant-alert-description] [+ button.ant-alert-close-icon > span.anticon > svg]` | icon glyph = f(type) AND presence = f(showIcon) |
| Avatar | `span.ant-avatar > span.ant-avatar-string` (inline `transform: scale(1)` — ResizeObserver text-fit) | icon mode swaps the string child for `span.anticon > svg` |
| Progress | `div.ant-progress > div.ant-progress-outer(inline width:100%) > div.ant-progress-inner > div.ant-progress-bg(inline `width:40%; height:8px; --progress-percent:.4`) + span.ant-progress-text` (success/exception: text → `span.anticon > svg`) | `.ant-progress-bg::after` width `calc(1/var(--progress-percent)*100%)` static; circle type = SVG `stroke-dasharray` inline |
| Card | `div.ant-card > div.ant-card-head > div.ant-card-head-wrapper > div.ant-card-head-title + div.ant-card-body` | head `::before/::after` display:table clearfix, 0 height (static) |
| Tooltip (portal) | `div.ant-tooltip > div.ant-tooltip-arrow + div.ant-tooltip-content > div.ant-tooltip-inner` in `document.body` | arrow `::before` `clip-path: var(--ant-tooltip-arrow-path)`, `::after` `rotate(-135deg)` shadow square |

### 2.7 Icons
`@ant-design/icons` renders `span.anticon.anticon-<name>[role=img][aria-label] > svg[viewBox="64 64 896 896" fill="currentColor" width="1em" height="1em" focusable="false"] > path` — ONE path per glyph for every exam icon (search, user, check-circle, close-circle, close, down); the loading glyph is `viewBox 0 0 1024 1024`. Icons inject their own 9-rule sheet (`rc-util-key="@ant-design-icons"`). Fill rides `currentColor` → the fill channel folds into `color` (the derived-channel fold). The svg-content promotion + `FC-SVG-VIEWBOX` check apply; one-path glyphs are the easy case.

### 2.8 Fonts (FC-FONT-SUBSTRATE)
antd's declared stack (verbatim, `getDesignToken().fontFamily`): `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Noto Sans', sans-serif, 'Apple Color Emoji', …` — **0 `@font-face`** across all 59 style tags. Three platform fonts precede Roboto; Roboto is the first entry that exists as committed bytes (`extract/computed/fonts/roboto/*`, the MUI files). `token.fontFamily: 'Roboto, Helvetica, Arial, sans-serif'` measured: every root's computed font-family becomes that string; `--ant-font-family` rewritten. Residue to ledger: `fontWeightStrong` = **600** (Card title, Alert message with description, Table header) — Roboto 600 is not committed (400/500/700 are) → Chromium synthesises. Decision in the config: pin, declare, ledger the 600 residue. Alternative (tailwind/fluent "unobtainable substrate, unconfigured") rejected because Roboto is one of antd's OWN faces.

## 3. The exam set (12 subjects, T0→T2)

| # | subject | axes (× disabled) | combos | what it stresses | tier |
|---|---|---|---|---|---|
| 1 | Button | type(5) × size(3) × danger(2) · presence icon, loading | 30 ×2 ×4 = 240 | densest state matrix; derived color/variant classes; svg + infinite spinner; `outline` focus; wave pin | T0 |
| 2 | Tag | color(unset+7) × bordered(2) · presence closable | 16 ×2 | defaultless enum (`unset`); child-part hover (close icon); Polaris Tag twin | T0 |
| 3 | Badge | mode(count\|dot) × color(unset+3) · Avatar child | 8 | absolute-overlay cluster (GEOM_ADMIT), depth-3 text, per-value parts over one axis; MUI Badge twin | T1 |
| 4 | Switch | size(2) × checked(2) ×disabled | 8 | **FC-PSEUDO-THUMB / B.4**: knob is `::before`; size×checked inset product; `:active` pseudo geometry | T1 |
| 5 | Checkbox | checked(3 via $props) ×disabled | 6 | **FC-PSEUDO-STROKE-GLYPH**: rotated L-stroke `::after`; indeterminate square; input-forwarded props | T1 |
| 6 | Radio | checked(2) ×disabled | 4 | `scale()`-revealed pseudo dot (grammar carries translate/orthonormal-rotate only); ring `::after` | T1 |
| 7 | Input | size(3) × status(unset+2) × variant(4) ×disabled | 72 | `::placeholder` plane; box-shadow focus; **root-swap trap** named out (prefix/suffix) | T0 |
| 8 | Alert | type(4) × showIcon(2) · presence description, closable | 8 ×4 | glyph = f(type) AND presence = f(showIcon); two presence props must factor; descendant hover | T1 |
| 9 | Avatar | size(3) × shape(2) | 6 | ResizeObserver inline scale (T3 hazard held at scale(1)); MUI Avatar twin + size | T0 |
| 10 | Progress | status(unset+3) | 4 | **FC-METER / FC-GEOMETRY-EXCLUDED**: inline `width:40%`; non-prefixed `--progress-percent` calc; infinite `active` ::before; text→svg part swap | T3 |
| 11 | Card | size(2) × variant(2) | 4 | container with head/body; clearfix pseudos; fontWeightStrong 600 substrate | T1 |
| 12 | Tooltip | — (portal, open pinned) · childWrap Button | 1 | **B.1 zero source facts / B.2 no states**; clip-path arrow pseudo; `getPopupContainer` unreachable from config | T2 |

Budget: ~400 combos ≤ `cartesianLimit 512` per component; the Button's 240 is the long pole (≈8–10 min at MUI rates). Named OUT of the exam (each a one-line reason in the config `__note`s): Button `shape=circle`/`ghost`/`href`/`htmlType`/`iconPosition`; Tag `icon`/custom close; Badge `status` mode/`overflowCount`; Switch `loading` (forces disabled — the TablePagination arrow precedent)/`checkedChildren`; Radio.Button + Radio.Group (dotted `importName` not in the harness grammar); Input affix/addon/allowClear (root swap); Avatar `icon`/`src`/numeric size; Progress `circle`/`dashboard`/`steps`; Card `cover`/`actions`/`extra`; Select, Table, Modal, Dropdown (organism/portal lanes — the MUI precedents cover the mechanism; antd Table's `ant-table-css-var` 37 tokens and Select's 26 are already in the live dump if a later round wants them).

## 4. The seed trap, measured on antd

- **Static-seed trap (Astryx's 36 variants)**: `ButtonProps` = `BaseButtonProps & MergedHTMLAttributes` (button.d.ts:34) — `htmlType(3)`, `href`, `target`, `block`, `ghost`, `autoInsertSpace`, `iconPosition(2)`, plus the 5.21 `color(14) × variant(6)` decomposition. A seed lifted from the types makes Button `type(5)×color(14)×variant(6)×size(3)×shape(3)×htmlType(3)` = 11,340 renderings; the curated seed is `type×size×danger` = 30. `href` swaps the root tag to `<a>` — a non-axis that would fork the anatomy union (the Altitude `href` precedent).
- **seed-gen blind spot (new)**: antd spells every enum as `declare const _ButtonTypes: readonly ["default","primary",…]; export type ButtonType = (typeof _ButtonTypes)[number]` (buttonHelpers.d.ts:8-15; same for ProgressStatuses, Variants). The generator's type index reads `type X = 'a'|'b'` aliases and `declare const X: {…}` maps, not tuple consts → dry run proposed **Button size(3) only; Badge status(5)/size(2); Radio size(3)/optionType(2)/buttonStyle(2) (Group props leaking); Input size(3)/status(2)/variant(4); Alert type(4); Avatar shape(2)/size(3); Card size(2)/variant(2); Tag/Checkbox/Switch-checked/Progress/Tooltip nothing**. It did catch two real API facts the human would have missed: Card `bordered` is `@deprecated` for `variant: borderless|outlined` (Card.d.ts:17-42) and Input `Variants` has FOUR values (`underlined` since 5.24) — both adopted in the config.
- **Self-read trap**: config points at `examples/antd/contracts-seed/`; promote writes `examples/antd/contracts/`. Never the same directory.

## 5. Config decisions (antd.config.json) — each one a measured choice

| knob | value | why (measurement) | precedent |
|---|---|---|---|
| `cssVar` | `{key:'antd'}` | var() uses 11 → 2,510; definitions on a STABLE class (`css-var-r<N>` counts providers); reader binds with no engine change | MUI `cssVariables:true`, Fluent wrapper-div vars |
| `hashed` | `false` | removes `:where(.css-dev-only-…)` from 1,660 selectors; pixels identical; the hash is a token/version artefact, not an identity | — (classAllow would drop it anyway; unhashed keeps `captured-truth.json` readable) |
| `wave` | `disabled` | `.ant-wave` injected in-root on mouse.up, alive >1.3 s → signature drift | MUI `disableRipple` |
| `token.fontFamily` | Roboto stack | 0 @font-face; Roboto is antd's own 4th entry; committed bytes | MUI/Altitude `fonts` |
| `token.motion` | **not pinned** | library-true; settle handles 0.2s; `motion:false` measured as the fallback | MUI `transitionDuration:0` only on overlays |
| `classPrefix` | `ant-` | stems `ant-btn-icon` → `btn-icon`; no `--` inside the prefix (the Carbon order bug does not apply) | Carbon |
| `varPrefix` | `--ant-` | every library var is `--ant-*`; the one-hop branch is live (Fluent's bare `--` trap avoided) | MUI |
| `unsetLabel` | `unset` | five defaultless enums in the set | Carbon `__unset` trap |
| `mintedBootstrap` | `true`, first pass only | capture.ts:404-413 refuses both directions | Fluent ordering |
| `checked` | variant axis, controlled + no-op `onChange` | state-plane projection | MUI Switch/Checkbox/Radio |
| Tooltip | `portalCapture` + `openDriver` | `getPopupContainer` needs a function the marker grammar cannot express | MUI Tooltip |

Default-literal mode was rejected, not for the reader (it would simply mint everything, the Astryx shape: correct pixels, no names) but because the exam's bar is "named or carried" on TOKEN identity too: 350 named tokens reachable for free vs 0.

## 6. Predictions per the accuracy grammar (the exam falsifies these)

**CARRIED** (expect in the contract + minted tree, source-aliased where the reader verifies): all root/part colour channels (bg, color, border-color, fill via currentColor fold), border-width/radius (6px/4px/2px; `calc(var(--ant-switch-handle-size)/2)` on the knob lands as `vcalcs`→ minted literal), padding-block/inline, font-size/weight/line-height (line-height unitless 1.5714 → `FC-LH-RATIO` is already closed), gap (icon gap 8px), min-width (Switch track 44/28), box-shadow (Button `0 2px 0 rgba(5,145,255,.1)`, Switch knob shadow, Input focus ring), Badge overlay translate (GEOM_ADMIT cluster), hover/active paint deltas on Button/Tag-close/Switch/Checkbox/Radio/Input/Alert-close, disabled paint, `::placeholder` colour, svg glyph assets (icon, loading, alert/progress status glyphs as per-value parts), presence parts (Button icon/loading, Tag close, Alert description/close) where they factor.

**LEDGERED / REFUSED BY NAME** (expect a named row; a missing row is the exam's finding):
1. Switch knob `::before` geometry — size × checked inset product → `pseudo-decor-geometry-multiaxis` (B.4); `:active` elongation → `pseudo-decor-state-geometry-uncarried`.
2. Checkbox tick `::after` — rotate(45deg) + scale + translate(-50%,-50%) → `pseudo-decor-outside-grammar` (non-orthonormal rotate) → FC-PSEUDO-STROKE-GLYPH hillclimb.
3. Radio dot `::after` — `scale()` reveal → `pseudo-decor-outside-grammar` (UNLESS the reader's computed box already reflects the transform — verify; if carried, it is carried as an unchecked 0-size box → check `pseudo-decor-hidden-in-combo` on unchecked).
4. Progress fill `width:40%` inline → `FC-GEOMETRY-EXCLUDED` ledger row (the Option B obligation); `::after` calc on `--progress-percent` → `vcalcs` ceiling; `active` ::before → `pseudo-decor-hidden-in-combo`.
5. Tooltip → B.1 (0 source facts in the portal sweep) + B.2 (`states: []`); arrow clip-path pseudo → `pseudo-decor-outside-grammar`.
6. Card head clearfix pseudos (static, 0-height) → `pseudo-decor-outside-grammar` on every combo.
7. Avatar `transform: scale(1)` inline → not a channel; dropped — MUST appear as a named code-only fact or it is silent (T3 hazard).
8. `fontWeightStrong` 600 on Card title → `FC-FONT-SUBSTRATE` residue row (synthesised weight).
9. `calc(var())` binds (153 rules) → `vcalcs` named skips; box-shadow source refs → value-verification refusal (MUI precedent).

**SILENT-RISK (the exam's targets — each needs a conformance case authored BEFORE capture)**:
- **S1 `outline` focus ring** (Button/Switch/Checkbox/Radio): not a carried channel, not a pseudo, not geometry. If the focus-visible plane lands with no delta AND no extension row, it is silent. Author: case `antd-focus-outline` expect NAMED.
- **S2 Checkbox/Radio root-prop forwarding**: antd forwards `className`/`data-*` to the hidden `<input>`; anything downstream that identifies the root by class/attr would measure a 0×0 sr-only input and report a clean empty part. Author: case `antd-forwarded-root-attrs` expect CARRIED root = label.
- **S3 Presence × axis (Alert showIcon × type glyph)**: if the presence set does not factor, the refusal must name it; a base-hidden icon that never restores is `FC-BASE-HIDDEN-RESTORE`. Author: case expect REFUSED-or-CARRIED, never a phantom.
- **S4 Component tokens declared on `.antd.ant-<comp>`** (not inherited from `:root`): a descendant rule `var(--ant-button-icon-gap)` resolves only under a root carrying that class; in the portal sweep (B.1) and in any gate page rendering the contract against `antd.vars.css` (`:root`-scoped), the names resolve differently — drift between capture and regate would surface as a contradiction-count drift (regate prints it) — verify it is printed, not swallowed.
- **S5 `transition` / `animation` channels** (wave pinned, motion library-true): nothing in the canvas vocabulary; confirm the extension block names `transition` per part rather than nothing.
- **S6 Switch `inner-checked/unchecked` empty labels**: two empty inline spans with margins that move on `checked` (`--ant-switch-inner-min/max-margin`) — geometry-excluded; confirm a ledger row rather than a vanished part.
- **S7 Badge digit depth**: `sup > bdi > span > span.current` — `current` dropped by classAllow; if union alignment collapses the unit span into `part-<path>` naming, the label must still carry text. Author: case expect CARRIED `5`.

## 7. Work items (engine + instruments), sized

| # | item | where | size | blocks |
|---|---|---|---|---|
| W1 | seed-gen: read `declare const X: readonly [...]` tuple enums (`(typeof X)[number]`) | `extract/computed/seed-gen.ts` type index | S (½ day) | honest seeds for Button type/shape, Progress status, Input variant — else hand-authored (allowed) |
| W2 | build-tokens wrap committed under `examples/antd/scripts/` + live dump + drift refusal (draft done, runs, 0 drift) | `examples/antd/{scripts,tokens}` | S (done in draft; commit + PROVENANCE prose) | capture |
| W3 | `classAllow` re-measure with the grammar absent on one Button capture; adjust lookaheads | config only | S | `__draft` removal |
| W4 | `outline` as a named code-only channel (S1) — confirm the extension block carries `outline*` for the focus plane; if not, add it to the enumerated read set + extension (no canvas spelling; NAMED) | `extract/computed/fuse.ts` extension block; `lib.ts` | M | SILENT=0 |
| W5 | Radio `scale()` pseudo + Checkbox rotate(45°) — decide: extend pseudo-decor v1 to carry `scale` as a size fold and non-orthonormal rotate as an asset emit (FC-PSEUDO-STROKE-GLYPH), or keep the named refusal | `anatomy.ts:2040-2700` | L (engine; schema?) | recognisability of Checkbox/Radio checked (the ship bar: "I can tell what this is") |
| W6 | Switch knob size×checked geometry (B.4) — no spelling today; ledger only | — | — (named wall) | — |
| W7 | Progress meter (FC-METER) — ledger; a `meter` fact is a schema addition, out of scope | — | — (named wall) | — |
| W8 | Dotted `importName` (`Radio.Button`) in the harness import grammar | `capture.ts:700-760` | S | Radio.Button as a subject (optional) |
| W9 | `getPopupContainer`-style function props: a `{"$self":true}`/`{"$parent":true}` marker so in-stage popups skip B.1 | `capture.ts` resolveMarkers | S–M | dodging B.1 rather than measuring it (do NOT do before the exam measures B.1) |
| W10 | Harness NODE_ENV: antd dev mode is fine (readable CSSOM) but spells `css-dev-only-do-not-override`; document that production mode (`--define:process.env.NODE_ENV=\"production\"`) is NOT used, so the hash class string in any receipt is the dev one | docs/21 | XS | receipt accuracy |
| W11 | `ds-library.json` for antd + `promote-floor.mjs` shim + PROVENANCE.md skeleton | `examples/antd/` | S | promote |
| W12 | `conformance/` cases S1–S7 authored BEFORE capture (`case · boundary · expect · observed (pinned)` table in the receipt) | `conformance/`, `extract/figma/conformance/MANIFEST.json` | M | the exam's pass condition |

Engine files likely to change: `fuse.ts` (W4), `anatomy.ts` (W5, optional), `seed-gen.ts` (W1), `capture.ts` (W8/W9, optional). Predicted engine-file count for a config-only first pass: **1** (W4) — the Carbon control-case number.

## 8. Landing sequence (commands; all from the repo root of a branch `phase-2/antd-exam`)

```bash
# 0. sandbox (the ONLY network step) — esbuild + react 18, as run.ts:120 demands
mkdir -p examples/antd/.antd-sandbox && printf '.antd-sandbox\n' > examples/antd/.gitignore
cp <this dir>/probe/sandbox-package.json examples/antd/.antd-sandbox/package.json   # antd ^5 (→5.29.3), @ant-design/icons ^5.6.1, react 18.3.1, esbuild ^0.28.1
(cd examples/antd/.antd-sandbox && npm install --no-audit --no-fund)
node -e "console.log(require('./examples/antd/.antd-sandbox/node_modules/antd/package.json').version)"   # must print 5.29.3 (config pins it; run.ts refuses drift)

# 1. tokens (network-free) — copy scripts/build-tokens.mjs + tokens/live-cssvar-dump.json from this dir
node examples/antd/scripts/build-tokens.mjs            # expects: "drift check … 0" · "350 global + 152 component leaves = 502"
printf '{}\n' > examples/antd/tokens/antd-minted.dtcg.json   # zero-leaf stub; config carries mintedBootstrap:true

# 2. seeds — curated (W1 pending); Button seed is in this dir; the other 11 by hand from §3 + the config __notes
npm run seed:gen -- extract/computed/configs/antd.json      # dry run: review the supersets, never --write into contracts/
cp <this dir>/antd.config.json extract/computed/configs/antd.json   # then delete "__draft" once 0–2 are done

# 3. classAllow re-measure (W3): one Button capture with classAllow removed, diff class lists across `type`
npm run extract:computed -- --harness examples/antd/.antd-sandbox --config extract/computed/configs/antd.json --component Button --out extract/computed/out/antd

# 4. capture all 12 (double-run byte-identity is REQUIRED; a (signature) witness here = the wave/wrapper pins failed)
for C in Button Tag Badge Switch Checkbox Radio Input Alert Avatar Progress Card Tooltip; do
  npm run extract:computed -- --harness examples/antd/.antd-sandbox --config extract/computed/configs/antd.json --component $C --out extract/computed/out/antd || break
done
npm run extract:computed:scorecard -- --dir extract/computed/out/antd --config extract/computed/configs/antd.json --write

# 5. promote (fills the minted tree) → remove mintedBootstrap → re-capture → commit the re-measured scorecards (Fluent ordering)
npx tsx examples/antd/scripts/promote-floor.mjs          # W11 shim over packages/cli/src/promote.ts, driven by examples/antd/ds-library.json
npm run extract:computed:regate -- --config extract/computed/configs/antd.json   # contradiction-count drift vs the scorecard is PRINTED (S4)

# 6. figma
npx tsx packages/cli/src/cli.ts figma examples/antd/contracts --out examples/antd/figma
node examples/antd/scripts/build-figma-tokens.mjs && node examples/antd/scripts/figma-compile-receipt.mjs && node examples/antd/scripts/build-genesis-batch.mjs
npx tsx packages/cli/src/cli.ts figma bundle examples/antd/contracts/*.contract.json --out examples/antd/figma/antd.bundle.json \
  --tokens examples/antd/tokens/antd.dtcg.json,examples/antd/tokens/antd-minted.dtcg.json --modes examples/antd/tokens/modes/antd.light.dtcg.json,examples/antd/tokens/modes/antd.dark.dtcg.json \
  --name "Ant Design" --icons examples/antd/assets/icons
sha256sum examples/antd/figma/antd.bundle.json                # build twice; byte-identical or stop

# 7. paste — Figma DESKTOP, dev plugin from figma-sync/plugin-dist, file byMp6lt0Ij9b2QbkDGFwBh "Scratch Project" (the ONLY writable file), Build tab, paste antd.bundle.json,
#    read the per-set change report BEFORE apply; record node ids + codeOnlyFacts per set (the "named" half of the accounting)
# 8. canvas conformance + visual parity
npm run conformance:canvas                                     # with the S1–S7 cases added to the manifest first (W12)
npx tsx extract/figma/visual-parity/run.ts --file byMp6lt0Ij9b2QbkDGFwBh --subject antd/<stem> …   # triptychs; rows over 3% masked must match a NAMED triage cause or print UNTRIAGED
# 9. receipt
#    parity/receipts/phase-2/ANTD-EXAM.md — FIGMA-DS-EXAM.md shape (§9)
```

## 9. Receipt shape — `parity/receipts/phase-2/ANTD-EXAM.md`

Mirror `parity/receipts/phase-2/FIGMA-DS-EXAM.md` (the canvas→code exam) for the other direction:
1. dateline: date · tree sha · branch · sandbox versions · "held out — zero antd mentions before the round" · file key `byMp6lt0Ij9b2QbkDGFwBh` · **Pass condition: SILENT = 0**.
2. per-subject stage stanza (KIT-CLIMB shape): `seed ✔/✘ · capture (double-run, replay computed equality %, gate computed %, pixel AA n/m, stylesheetSkips, pinnedAnimations, vcalcs/vshorthands counts) · promote (named refusals in the minted tree, source-aliased n / literal n) · emit · paste (node id, variants, tokens created/updated/aliased, codeOnlyFacts) · canvas conformance · visual parity (masked %, triage cause) · screenshot ship-bar clause ("I can tell what this is")`.
3. accounting table: `subject | facts | carried | named | silent | of which render-inert | wrong-name | named-but-should-carry`, totals row, then the verbatim SILENT list (`subject · channel · rows · first path`).
4. the S1–S7 cases table `case | boundary | expect | observed (pinned)` authored BEFORE capture, with the gate line quoted verbatim.
5. defects in the order a designer hits them; walls by FC-code with "Cause, located:"; what was NOT done; engine files changed (the generality number — predicted 1).

## 10. Residual uncertainty (honest)

- The `classAllow` grammar is validated on 132 probe classes, not the cartesian; re-measure (W3).
- `presenceProps.value` with `{"$element":…}` (Button icon) — CLOSED: capture.ts:720-732 collects `$import`/`$render`/`$element` from presence values into real imports and every spec prop goes through `resolveMarkers({...s.props})` at mount (capture.ts:844). The PresenceProp doc comment at :62 is merely stale (lists two of four markers).
- Radio `scale()` reveal (§6 #3) — could already be carried via the computed box; the exam decides.
- Checkbox/Radio label root + forwarded props (S2) — measured in the probe by accident (the data attribute landed on the input); the harness stamps the STAGE child, so the root should be the label. Verify in captured-truth.json before trusting any Checkbox number.
- Time: Button's 240 combos × 4 interactions; if the double-run budget bites, drop `loading` presence (→120) and name it.
