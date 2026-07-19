# FIGMA CAPABILITY MATRIX — CSS ↔ Figma representability, per channel

The gate document for the "complete aesthetics" program. One row per renderable
CSS channel: what the **Figma Plugin API** can express natively on nodes today,
whether the expressing field is **variable-bindable** (token fidelity), what the
**contract carries today** (per `docs/STYLE-FIDELITY.md`), and the program
verdict. The owner's rule applies throughout: *"things Figma cannot handle …
would be uniquely their own within code"* — those channels are declared
CARRY-CODE-ONLY, never silently dropped.

**API documentation consulted 2026-07-19** — see [§ Sources](#d-sources--version-stamp)
for the exact pages and the typings version pinned. Every "native" claim below
is verified against those sources; anything not verifiable from two sources is
marked **VERIFY-BY-SPIKE** rather than asserted.

## Vocabulary

| column | values |
|---|---|
| Figma expression | **native** (a node field expresses it directly) · **approx** (expressible only through a named transform — documented, deterministic) · **no** (inexpressible on canvas nodes) |
| Bindable | the exact variable-bindable field(s), or — . Bindability is what lets the canvas carry the *token*, not just the resolved value. |
| Contract today | **carried** (OK/MINTED per STYLE-FIDELITY) · **whitelisted** (`STYLES_WHEN_ALLOWED` literal, code-side) · **named-gap** (receipted drop, A/B row cited) · **absent** (no vocabulary, never observed) |
| Verdict | **CARRY-BOTH** · **CARRY-CODE-ONLY** (declared; canvas gets an annotation) · **CARRY-WITH-NAMED-LIMIT** (carried on both; canvas rendering is a documented approximation) |

Repo references: [R1] `docs/STYLE-FIDELITY.md` · [R2] `scripts/contract-schema.ts`
· [R3] `core/emit-figma-script.ts` (canvas whitelist at `applyTokens`, ~line 577)
· [R4] `examples/polaris/figma/PHASE-B-RECEIPT.md`.

---

## The matrix

### 1 · Layout & sizing

| CSS channel | Figma expression | Bindable | Contract today | Verdict |
|---|---|---|---|---|
| `display: flex \| inline-flex` | **native** — auto-layout `layoutMode: HORIZONTAL\|VERTICAL` [S1] | — | carried (`layout.display`) [R2] | CARRY-BOTH |
| `display: block \| none` | **approx** — block ≈ vertical AL; none ≈ `visible=false` | `visible` (BOOLEAN) [S5] | whitelisted (`display` in stylesWhen) [R2] | CARRY-WITH-NAMED-LIMIT |
| `flex-direction: row \| column` | **native** — `layoutMode` [S1] | — | carried | CARRY-BOTH |
| `flex-direction: *-reverse` | **approx** — no native reverse; compiled child-order reversal per variant (shipped, A15) [R1][R3] | — | carried (VariantLayoutSchema) [R2] | CARRY-WITH-NAMED-LIMIT |
| `flex-wrap: wrap` | **native** — `layoutWrap: 'WRAP'` [S1] | — | absent | CARRY-BOTH (add — § a.8) |
| `justify-content: start\|center\|end\|space-between` | **native** — `primaryAxisAlignItems` [S1][S12] | — | carried | CARRY-BOTH |
| `justify-content: space-around\|space-evenly` | **approx** — no native value; padding+spacing arithmetic | — | absent | CARRY-WITH-NAMED-LIMIT (when observed) |
| `align-items: start\|center\|end\|stretch` | **native** — `counterAxisAlignItems` + `layoutAlign: STRETCH` [S1] | — | carried | CARRY-BOTH |
| `align-items: baseline` | **native** — `counterAxisAlignItems: 'BASELINE'` (horizontal AL only) [S12] | — | absent | CARRY-BOTH (when observed) |
| `align-content` (wrapped counter-axis distribution) | **VERIFY-BY-SPIKE** — `counterAxisAlignContent` exists in typings but values/behavior unverified this pass | — | absent | pending spike |
| `gap` | **native** — `itemSpacing` [S1] | `itemSpacing` (FLOAT) [S5] | carried | CARRY-BOTH |
| `row-gap` ≠ `column-gap` | **native** — `counterAxisSpacing` (wrap mode) [S1] | `counterAxisSpacing` (FLOAT) [S5] | absent | CARRY-BOTH (with wrap) |
| `flex-grow` / `flex: 1` | **native** — `layoutGrow` / `layoutSizingHorizontal\|Vertical: 'FILL'` [S8] | — | carried (`layout.grow`) | CARRY-BOTH |
| `flex-shrink`, `flex-basis` | **no** — only FIXED/HUG/FILL sizing model | — | absent | CARRY-CODE-ONLY |
| `order` | **approx** — child index, compiled per variant | — | absent | CARRY-WITH-NAMED-LIMIT (when observed) |
| `width`, `height` | **native** — `resize()`; also bindable | `width`, `height` (FLOAT) [S5] | carried | CARRY-BOTH |
| `min-width`, `min-height`, `max-width`, `max-height` | **native** — first-class AL properties [S1] | `minWidth`, `minHeight`, `maxWidth`, `maxHeight` (FLOAT) [S5] | carried CSS-side; canvas deliberately elides (drawn at real size — named choice) [R1 A19–A20][R3] | CARRY-BOTH (canvas binding available if the elision choice is reversed) |
| `aspect-ratio` | **approx** — resize to ratio then `lockAspectRatio()`; `targetAspectRatio` is read-only [S1] | — | absent | CARRY-WITH-NAMED-LIMIT |
| `padding` (4 physical sides) | **native** — `paddingTop/Right/Bottom/Left` [S1] | each side (FLOAT) [S5] | carried (`padding-inline/-block` → L/R, T/B; LTR-only mapping is a named limit) [R3] | CARRY-BOTH |
| `padding-inline`/`-block` (logical) | **approx** — physical mapping, LTR assumed (Figma has no writing-direction switch) | as above | carried | CARRY-WITH-NAMED-LIMIT |
| `margin` | **no** — no margin concept; parent gap/padding restructuring; negative overlap → negative `itemSpacing` (shipped: `layout.overlap`) [R2] | — | carried (overlap) / absent (general) | CARRY-WITH-NAMED-LIMIT |
| `position: absolute` + insets | **native** — `layoutPositioning: 'ABSOLUTE'` + constraints [S1] | — | carried (`overlay` vocabulary; insets whitelisted) [R2] | CARRY-BOTH |
| `position: fixed \| sticky` | **no** — viewport/scroll concepts don't exist on canvas | — | whitelisted (code) | CARRY-CODE-ONLY |
| `z-index` | **approx** — child order + `itemReverseZIndex` [S1] | — | whitelisted (code) | CARRY-WITH-NAMED-LIMIT |
| `display: grid` + fixed templates | **native** — `layoutMode: 'GRID'` + `gridRowCount/gridColumnCount/gridRowSizes/gridColumnSizes/gridAutoTracks` [S1][S8] | `gridRowGap`, `gridColumnGap` (FLOAT) [S5] | absent | CARRY-BOTH (bounded template subset) |
| grid areas, `minmax()`, `auto-fit/fill`, subgrid | **no** — no responsive track functions | — | named-gap-adjacent (B10 class) | CARRY-CODE-ONLY |
| `overflow: hidden \| visible` | **native** — `clipsContent` [S1] | — | A25 named (frames default clip) [R1] | CARRY-BOTH (trivial add) |
| `overflow: scroll/auto` | **no** static equivalent (prototype scrolling is a presentation setting, not a rendered fact) | — | whitelisted (code) | CARRY-CODE-ONLY |
| `box-sizing` | **approx** — Figma sizes as border-box only when `strokeAlign: INSIDE` (the emitter's standing choice [R3]) or `strokesIncludedInLayout: true` [S1] | — | implicit (emitter forces INSIDE) | CARRY-WITH-NAMED-LIMIT (document the mapping) |

### 2 · Border & corners

| CSS channel | Figma expression | Bindable | Contract today | Verdict |
|---|---|---|---|---|
| `border-color` (uniform) | **native** — stroke `SolidPaint` [S4] | paint `color` (COLOR), paint `opacity` (FLOAT) [S8] | carried | CARRY-BOTH |
| `border-width` (uniform) | **native** — `strokeWeight` [S1] | `strokeWeight` (FLOAT) [S5] | carried | CARRY-BOTH |
| per-side border **widths** | **native** — `strokeTopWeight/strokeRightWeight/strokeBottomWeight/strokeLeftWeight` (fractional ok) [S1] | each side individually (FLOAT) [S5] | named-gap A12 [R1] | CARRY-BOTH (add — § a.5) |
| per-side border **colors** | **no** — one `strokes` paint list serves all four sides; would require inner line nodes | — | absent | CARRY-CODE-ONLY (§ b) |
| `border-style: solid` | **native** (default) | — | carried (implicit) | CARRY-BOTH |
| `border-style: dashed \| dotted` | **native** — `dashPattern: number[]` (+ `strokeCap: ROUND` for dotted) [S1] | — (dashPattern not bindable) | named-gap A13 [R1] | CARRY-WITH-NAMED-LIMIT (value literal, not token-bound) |
| `border-style: double \| groove \| ridge \| inset \| outset` | **no** | — | absent | CARRY-CODE-ONLY |
| `border-radius` (uniform) | **native** — `cornerRadius` [S1] | `cornerRadius` (FLOAT) [S5] | carried (emitter binds all four corner fields from one token) [R3] | CARRY-BOTH |
| per-corner radii | **native** — `topLeftRadius/topRightRadius/bottomLeftRadius/bottomRightRadius` [S1] | each corner individually (FLOAT) [S5] | named-gap A11 [R1] | CARRY-BOTH (add — § a.4; the emitter already writes these fields) |
| `outline` + `outline-offset` | **no** — no outline concept (a stroke has no offset from the box); approximations: OUTSIDE-aligned stroke (no offset) or a dedicated ring frame. State previews already approximate as bound stroke (C5) [R1][R3 `translateStateOverrides`] | stroke fields as above | carried (outline-width/-color, B4) | CARRY-WITH-NAMED-LIMIT (existing approximation stands) |
| `border-image` | **no** — no nine-slice | — | absent | CARRY-CODE-ONLY |

### 3 · Background & fills

| CSS channel | Figma expression | Bindable | Contract today | Verdict |
|---|---|---|---|---|
| `background-color` + alpha | **native** — `SolidPaint` (`color` RGB + paint `opacity`) [S4] | `color` (COLOR), `opacity` (FLOAT) [S8] | carried (A1) | CARRY-BOTH |
| `linear-gradient()` | **native** — `GRADIENT_LINEAR` (`gradientTransform` = angle, `gradientStops`) [S4] | **stop colors** via `VariableBindableColorStopField` [S4]; gradientTransform not | named-gap A4 [R1] | CARRY-BOTH (add — § a.3) |
| `radial-gradient()` | **native** — `GRADIENT_RADIAL`; ellipse size/position via gradientTransform; focal-point (`at` ≠ center-of-shape) offsets partially | stop colors [S4] | named-gap A4 | CARRY-WITH-NAMED-LIMIT |
| `conic-gradient()` | **native** — `GRADIENT_ANGULAR` [S4]; CSS interpolation hints / `in oklch` color-space interpolation not expressible | stop colors [S4] | named-gap A4 | CARRY-WITH-NAMED-LIMIT |
| `background-image: url()` | **native** — `ImagePaint` (`imageHash` from `figma.createImage`) [S4] | — (image content not bindable) | named-gap A5 [R1] | CARRY-BOTH (add — § a.7) |
| multiple background layers | **native** — paint arrays are stacks; **order inverts** (CSS first layer = topmost; Figma last paint = topmost) [S4] | per-paint as above | named-gap A6 (`paint-stack-truncated`) [R1] | CARRY-BOTH (add — § a.3) |
| `background-size: cover \| contain` | **native** — `scaleMode: 'FILL' \| 'FIT'` [S4] | — | absent | CARRY-BOTH |
| `background-size: <length>/<%>`, `background-position` | **approx** — `scaleMode: 'CROP'` + `imageTransform` matrix [S4] | — | absent | CARRY-WITH-NAMED-LIMIT |
| `background-repeat` | **approx** — `TILE` + `scalingFactor` (uniform tiling only; no repeat-x/y/space/round) [S4] | — | absent | CARRY-WITH-NAMED-LIMIT |
| `background-attachment/origin/clip` | **no** (exception: `background-clip: text` ≈ gradient/image paint applied directly as the TextNode fill — native) | — | absent | CARRY-CODE-ONLY |
| `background-blend-mode` | **native** — per-paint `blendMode` [S4] | — | named-gap A9 class | CARRY-BOTH (with gradient work) |
| `accent-color`, `caret-color`, `::selection` colors | **no** — interaction chrome doesn't exist on canvas | — | absent | CARRY-CODE-ONLY |

### 4 · Effects, shadows, filters

| CSS channel | Figma expression | Bindable | Contract today | Verdict |
|---|---|---|---|---|
| `box-shadow` (single outer) | **native** — `DROP_SHADOW` effect: `color/offset/radius/spread/blendMode/showShadowBehindNode` [S3] | color, blur radius, spread, offsetX, offsetY — per-channel binding confirmed by shadow variable scopes (`SHADOW_COLOR/_BLUR/_SPREAD/_OFFSET_X/_OFFSET_Y`) [S8]; exact `VariableBindableEffectField` spellings differ between the docs summary and typings autodoc — **VERIFY-BY-SPIKE the spelling** (capability itself is confirmed twice) | carried (A7: minted `box-shadow` token; canvas parses the literal into `dropShadow`) [R1][R3] | CARRY-BOTH (upgrade literal → bound effect fields) |
| `box-shadow` (multiple) | **native** — `effects` is an array [S3] | as above, per effect | named-gap A8 [R1] | CARRY-BOTH (add — § a.1) |
| `box-shadow: inset` | **native** — `INNER_SHADOW` (same fields as drop) [S3] | as above | named-gap A8 | CARRY-BOTH (add — § a.1) |
| `text-shadow` | **native** — `DROP_SHADOW` on the TextNode (effects apply to text) [S3] | as above | absent | CARRY-BOTH (when observed) |
| `filter: blur()` | **native** — `LAYER_BLUR` (`blurType NORMAL`; `PROGRESSIVE` also exists) [S3] | blur `radius` only [S3] | named-gap A8 | CARRY-BOTH |
| `filter: drop-shadow()` | **native** — `DROP_SHADOW` (no spread — matches the CSS function exactly) [S3] | as shadows | absent | CARRY-BOTH (when observed) |
| `filter: grayscale/brightness/contrast/saturate/hue-rotate/invert/sepia` | **no** at node level. `ImageFilters` (exposure/contrast/saturation/temperature/tint/highlights/shadows) exist **on image paints only** and use a different model [S4] | — | absent | CARRY-CODE-ONLY (image-paint approx nameable case-by-case) |
| `backdrop-filter: blur()` | **native** — `BACKGROUND_BLUR` [S3] | blur `radius` [S3] | named-gap A8 | CARRY-BOTH |
| `backdrop-filter` (non-blur) | **no** — Figma's `GLASS` effect (refraction/dispersion model) is adjacent but not a CSS mapping [S3] | — | absent | CARRY-CODE-ONLY |

### 5 · Typography

| CSS channel | Figma expression | Bindable | Contract today | Verdict |
|---|---|---|---|---|
| `color` (text fill) | **native** — text fill paint | paint `color` [S8] | carried (A21) | CARRY-BOTH |
| `font-family` | **native** — `fontName` | `fontFamily` (STRING) [S6] | named-gap A23 (declared Inter-only scope) [R1] | CARRY-BOTH (add — § a.6; retires the Inter fiat) |
| `font-size` | **native** — `fontSize` | `fontSize` (FLOAT) [S6] | carried — but canvas resolves a **literal**, no binding [R3] | CARRY-BOTH (upgrade literal → binding) |
| `font-weight` | **native** — `fontName.style` / `fontWeight` | `fontWeight` (FLOAT), `fontStyle` (STRING) [S6] | carried (weight→style-name map) [R3] | CARRY-BOTH |
| `font-style: italic` | **native** — `fontName.style` | `fontStyle` (STRING) [S6] | absent | CARRY-BOTH (when observed) |
| `line-height` (px) | **native** — `LineHeight` unit `PIXELS` | `lineHeight` (FLOAT) [S6][S7] | carried (canvas literal) [R3] | CARRY-BOTH (upgrade to binding) |
| `line-height` (% / unitless) | **native** — unit `PERCENT` (unitless × 100); `AUTO` exists | `lineHeight` [S6] | absent | CARRY-BOTH |
| `letter-spacing` (px or %) | **native** — `LetterSpacing` PIXELS/PERCENT | `letterSpacing` (FLOAT) [S6][S7] | named-gap A22 [R1] | CARRY-BOTH (add — § a.2) |
| `text-transform` | **native** — `textCase: UPPER\|LOWER\|TITLE` [S8] | — (not bindable) | named-gap A22 | CARRY-BOTH (add — § a.2; literal, not token-bound) |
| `font-variant: small-caps` | **native** — `textCase: SMALL_CAPS \| SMALL_CAPS_FORCED` [S8] | — | absent | CARRY-BOTH (when observed) |
| `font-feature-settings` / OpenType features | **no** — `getRangeOpenTypeFeatures()` is **read-only; no setter** [S2] | — | absent | CARRY-CODE-ONLY (§ b) |
| `text-decoration-line: underline \| line-through` | **native** — `textDecoration: UNDERLINE \| STRIKETHROUGH` [S8] | — | named-gap A22 / whitelisted literal | CARRY-BOTH (add — § a.2) |
| `text-decoration-line: overline` | **no** — not in the enum [S8] | — | absent | CARRY-CODE-ONLY |
| `text-decoration-style/-thickness/-offset/-color`, `skip-ink` | **native** — granular fields `textDecorationStyle (SOLID\|WAVY\|DOTTED) / textDecorationThickness / textDecorationOffset / textDecorationColor / textDecorationSkipInk` [S2]; CSS `double` style missing | — | absent | CARRY-BOTH (add with a.2; `double` named limit) |
| `text-align` | **native** — `textAlignHorizontal: LEFT\|CENTER\|RIGHT\|JUSTIFIED` | — | named-gap A22 | CARRY-BOTH (add — § a.2) |
| vertical centering of text in its box | **native** — `textAlignVertical` (TOP/CENTER/BOTTOM per typings; page 404'd on docs site — spelling **VERIFY-BY-SPIKE**, capability certain) | — | implicit (AL centering carries it today) | CARRY-BOTH |
| `text-overflow: ellipsis` + `-webkit-line-clamp` | **native** — `textTruncation: 'ENDING'` + `maxLines` [S2] | — | whitelisted (`text-overflow` literal, code-only today) [R2] | CARRY-BOTH (add — § a.9) |
| `white-space: nowrap` | **approx** — `textAutoResize: WIDTH_AND_HEIGHT` (box never wraps) [S2] | — | whitelisted (code) | CARRY-WITH-NAMED-LIMIT |
| `word-break`, `overflow-wrap`, `hyphens` | **no** — no line-breaking controls | — | absent | CARRY-CODE-ONLY |
| `text-indent` | **native** — `paragraphIndent` [S2] | `paragraphIndent` (FLOAT) [S6] | absent | CARRY-BOTH (when observed) |
| paragraph gap (`p + p` margin) | **native** — `paragraphSpacing` [S2] | `paragraphSpacing` (FLOAT) [S6] | absent | CARRY-BOTH (when observed) |
| `text-box-trim` (leading trim) | **native** — `leadingTrim` [S2] | — | absent | forward-mapping note; CARRY-BOTH when CSS side stabilizes |
| `writing-mode`, `direction: rtl` | **no** — no vertical text, no RTL layout switch | — | absent | CARRY-CODE-ONLY |

### 6 · Transforms & motion

| CSS channel | Figma expression | Bindable | Contract today | Verdict |
|---|---|---|---|---|
| `transform: translate()` | **approx** — `x`/`y` or absolute positioning; compiled per variant | — | whitelisted (`transform` literal, code) [R2] | CARRY-WITH-NAMED-LIMIT |
| `transform: rotate()` | **native** — `rotation` (degrees). Caveat: Figma rotates about the **top-left**, CSS about the center — compensate translation via `relativeTransform` [S8] | — (`rotation` is NOT in `VariableBindableNodeField` [S5], despite a `ROTATION` variable scope existing [S8] — flag) | carried for shape parts (`ShapeSchema.rotation`) [R2]; A24 named elsewhere | CARRY-BOTH (shape parts) / CARRY-WITH-NAMED-LIMIT (general) |
| `transform: scale()` | **approx** — bake into width/height (static render equivalence) | — | absent | CARRY-WITH-NAMED-LIMIT |
| `transform: skew()` / `matrix()` | **no** — `relativeTransform` is settable but constrained to **unit axes** (`sqrt(m00²+m10²) == 1` — no shear survives) [S8]; only escape is baking the skewed geometry into a vector via `createNodeFromSvg` | — | named-gap (B11) | CARRY-CODE-ONLY (vector-bake VERIFY-BY-SPIKE if ever needed) |
| `transform-origin` | **approx** — no property; compensating translation | — | absent | CARRY-WITH-NAMED-LIMIT |
| 3D transforms, `perspective` | **no** | — | absent | CARRY-CODE-ONLY |
| `transition`, `animation`, `@keyframes` | **no** — canvas nodes are static (prototype reactions are a different, non-rendered domain) | — | carried code-side (`animation: spin\|pulse`; `transition` whitelisted) — already declared [R2] | CARRY-CODE-ONLY (standing) |

### 7 · Compositing & visibility

| CSS channel | Figma expression | Bindable | Contract today | Verdict |
|---|---|---|---|---|
| `opacity` | **native** — node `opacity` [S8] | `opacity` (FLOAT) [S5] — **BUT** repo receipt: a bound 0–1 token renders on Figma's percent scale (0.5 → 0.5%, near-invisible) [R3 comment, visual-parity receipt]. Canvas writes the literal today — the honest call. Re-test binding: **VERIFY-BY-SPIKE** | carried (A3) [R1] | CARRY-BOTH (literal canvas value; binding pending spike) |
| `mix-blend-mode` | **native** — node `blendMode`; Figma's 19 values ⊇ CSS's except `plus-lighter` [S8] | — | named-gap A9 [R1] | CARRY-BOTH (enum map — § a.10); `plus-lighter` CODE-ONLY |
| `isolation: isolate` | **approx** — `NORMAL` (isolating) vs `PASS_THROUGH` group blend semantics [S8] | — | absent | CARRY-WITH-NAMED-LIMIT |
| `visibility: hidden` | **native** — `visible = false` | `visible` (BOOLEAN) [S5] | carried (`visibleWhen` → visibility binding) [R2] | CARRY-BOTH |

### 8 · Masks & clipping

| CSS channel | Figma expression | Bindable | Contract today | Verdict |
|---|---|---|---|---|
| `clip-path` basic shapes (polygon/ellipse/inset) | **native** on canvas — the repo inverts this: `ShapeSchema` renders REAL `RegularPolygon/Ellipse/Rectangle` nodes where CSS renders clip-path [R2] | fills on the shape node bindable | carried (v9 shape) | CARRY-BOTH (standing) |
| `clip-path: path(…)` (arbitrary) | **approx** — `createNodeFromSvg` vector as a mask (`isMask` + `maskType: 'VECTOR'`) [S8][S9] | — | absent | CARRY-WITH-NAMED-LIMIT (when observed) |
| `mask-image` (alpha/luminance) | **native** — `isMask`, `maskType: 'ALPHA' \| 'VECTOR' \| 'LUMINANCE'` [S9] | — | absent | CARRY-CODE-ONLY until observed (native path exists) |
| rounded overflow clipping | **native** — `clipsContent` + corner radii [S1] | corner radii [S5] | carried implicitly | CARRY-BOTH |

### 9 · Interaction-only & scroll visuals

| CSS channel | Figma expression | Bindable | Contract today | Verdict |
|---|---|---|---|---|
| `cursor` | **no** — no node property | — | whitelisted (code) [R2] | CARRY-CODE-ONLY (§ b) |
| `pointer-events`, `user-select`, `resize`, `touch-action` | **no** | — | whitelisted / absent | CARRY-CODE-ONLY |
| `scrollbar-*`, `scroll-snap-*`, `overscroll-behavior`, `scroll-behavior` | **no** static equivalent | — | absent | CARRY-CODE-ONLY |
| live `:hover/:active/:focus-visible` behavior | **no** — states render only as opt-in preview variants (`figmaStatePreviews`, shipped) [R2] | state-preview fields bind normally | carried (C4) | CARRY-WITH-NAMED-LIMIT (standing) |

### 10 · Conditionals & carriers

| CSS channel | Figma expression | Bindable | Contract today | Verdict |
|---|---|---|---|---|
| `@media`, `@container`, `@supports` | **no** — variable *modes* express theme axes, not viewport conditions | — | named-gap B10 [R1] | CARRY-CODE-ONLY (declared) |
| custom properties as carriers (`var()`) | **native** — Variables: FLOAT/COLOR/STRING/BOOLEAN, aliasing = token references, modes = theming, scopes = pickup control [S7][S8] | the entire § bindable-field surface | carried (the core mechanism) | CARRY-BOTH |
| `columns` (multi-column text flow) | **no** — GRID lays out boxes, not flowing text | — | absent | CARRY-CODE-ONLY |
| `object-fit` / `object-position` | **approx** — image paint `scaleMode: FILL(cover)/FIT(contain)/CROP+imageTransform(position)` [S4] | — | absent | CARRY-WITH-NAMED-LIMIT |
| `content` / text content | **native** — `characters`; bindable to STRING variables [S5] | `characters` (STRING) [S5] | carried (`content`/`text`) [R2] | CARRY-BOTH |

---

## (a) Ranked additions to the contract vocabulary

Biggest visual impact first; field evidence cited.

1. **Shadow stack: multiple `box-shadow` layers + `inset`** (A7 upgrade + A8).
   Field evidence: Polaris Phase B — `p.shadow-button` was a named token
   exclusion, so secondary/tertiary Buttons rendered white-on-white [R4,
   screenshot-review table]; Polaris buttons *are* their shadow. Figma is fully
   native (`DROP_SHADOW`/`INNER_SHADOW`, effect arrays) with per-channel
   variable scopes for color/blur/spread/offsets [S3][S8]. Single-drop is
   already carried; this generalizes the mint to a shadow *list*.
2. **Text channels: `letter-spacing`, `text-transform`, `text-decoration`
   (granular), `text-align`; upgrade `line-height`/`font-size` from canvas
   literals to bindings** (A22, C1). Field evidence: A22 was a 5-channel
   silent-loss class until receipted [R1]; Polaris/CBDS labels are
   typography-led and the canvas currently shows Inter defaults for all five.
   Everything here is native; lineHeight/letterSpacing/fontSize bind as FLOAT
   variables [S6].
3. **Gradient fills + multi-paint stacks** (A4/A6). Field evidence:
   `paint-stack-truncated` and `paint-unsupported` degradations exist in both
   captures [R1] — the dumps are already *naming* what this would carry. Native
   with **per-stop color binding** [S4], so gradient tokens keep identity.
4. **Per-corner radius** (A11). Cheapest add on the board: the canvas emitter
   *already writes* the four corner fields from one token [R3 `border-radius`
   case]; the vocabulary needs only the four longhand keys, each independently
   bindable [S5].
5. **Per-side border widths** (A12). Field evidence: bound per-side weights are
   already mapped at capture but proposal requires uniformity [R1]. Native,
   each side bindable [S1][S5]. (Per-side border *colors* stay CODE-ONLY —
   declare it in the same change.)
6. **`font-family`** (A23). Retires the everything-renders-Inter fiat;
   `fontFamily` binds as a STRING variable [S6], so brand type rides a token.
   Requires `loadFontAsync` inventory management — bounded, not hard.
7. **Image fills** (A5). Field evidence: Phase B Thumbnail read as an invisible
   white box because the image slot placeholder was never a carried channel
   [R4]. `ImagePaint` + `figma.createImage` is native [S4].
8. **`flex-wrap` + `counterAxisSpacing`** (no A-row — never captured because
   the vocabulary refused it). Tag groups and chip rows wrap in every target
   system; native + gap bindable on both axes [S1][S5].
9. **Text truncation** (`textTruncation`/`maxLines`) — code side already
   whitelists `text-overflow`; the canvas can now say the same thing natively
   [S2].
10. **Blend modes** (A9) — mechanical enum map, `plus-lighter` excepted [S8].
11. **Dash patterns** (A13) — dividers/skeletons; literal (not bindable) [S1].
12. **Layer/background blur** (A8 tail) — overlay scrims; radius bindable [S3].

## (b) The inexpressible set — on-canvas annotation copy

Channels Figma cannot express, with plain-language notes suitable for the
canvas refusal-note pattern established in Phase B [R4]. These are
CARRY-CODE-ONLY: fully rendered in code, declared here, annotated on canvas.

| channel | annotation copy |
|---|---|
| `cursor` | "Cursor changes (pointer on hover) exist only in the coded component." |
| `transition` / `animation` | "Motion (spin, pulse, easing) runs only in the coded component; the canvas shows one still frame." |
| live states | "Hover/press/focus render live in code; the State variants here are static previews." |
| `@media` / `@container` | "Responsive behavior lives in code. This canvas shows the base layout only." |
| per-side border colors | "This part's borders use different colors per side in code; Figma strokes share one color, so the canvas shows the dominant side." |
| `border-style: double/groove/…` | "This border style has no Figma equivalent; the canvas shows a solid stroke of the same width." |
| OpenType features (`font-feature-settings`) | "Tabular figures / ligature settings apply only in code — Figma's plugin API cannot set OpenType features." |
| `overline`, `text-decoration: double` | "This decoration variant exists only in code." |
| skew / 3D transforms | "This element is skewed/3D-transformed in code; the canvas shows it unskewed." |
| CSS filters on non-image content | "Color filters (grayscale, brightness…) apply only in code." |
| `writing-mode` / RTL | "Vertical or right-to-left text layout exists only in code." |
| scroll visuals (`scroll-snap`, scrollbar styling) | "Scrolling behavior and scrollbar styling exist only in code." |
| `word-break` / `hyphens` | "Line-breaking rules differ: Figma wraps by box width only." |
| `flex-shrink` / `flex-basis` | "Fine-grained shrink behavior exists only in code; the canvas uses fixed/fill sizing." |
| `accent-color` / `caret-color` / `::selection` | "Form-control and selection colors exist only in code." |

## (c) Figma API capabilities not currently used

Fidelity raisers available today, unused by `core/emit-figma-script.ts`:

1. **`INNER_SHADOW` + effect arrays** — the emitter renders exactly one parsed
   drop shadow (`spec.dropShadow`) [R3]; the API takes a full effects list [S3].
2. **Bound effect fields** — the shadow renders as a resolved literal; color/
   blur/spread/offset each accept variables [S3][S8]. A `box-shadow` token
   could stay a *token* on canvas.
3. **Gradient paints with per-stop bindings** [S4] — no gradient path exists in
   the emitter at all.
4. **Paint-level `opacity` binding** [S8] — today alpha is baked into minted
   8-digit-hex RGBA variables (A1); binding color and opacity as *separate*
   variables would let a `{color.x}` + `{opacity.y}` pair survive as two tokens.
5. **Typography bindings** — `fontSize`/`lineHeight` are resolved to literals in
   `applyTokens` [R3]; both (plus fontFamily/fontStyle/fontWeight/letterSpacing/
   paragraphSpacing/paragraphIndent) are bindable [S6].
6. **`characters` STRING binding** [S5] — sample text content could ride
   content tokens/variables instead of literals.
7. **Per-side stroke-weight bindings** [S5] — the emitter binds only uniform
   `strokeWeight`.
8. **`layoutWrap` + `counterAxisSpacing` + GRID mode** [S1] — the layout
   vocabulary stops at single-axis no-wrap flex.
9. **`createNodeFromSvg` for icon glyph truth** [S8] — field evidence: Phase B
   divergence (B), Spinner glyphs baked `#000` because SVG paint isn't
   re-bound; importing via `createNodeFromSvg` and binding fills on the
   resulting vector children would make glyph color token-driven [R4].
10. **`textTruncation`/`maxLines`, granular `textDecoration*`, `textCase`** [S2].
11. **`clipsContent` as an explicit channel** — currently an unexamined frame
    default (A25).
12. **Variable scopes** (`FILL_COLOR`, `STROKE_COLOR`, `FONT_SIZE`, …) [S8] —
    minted variables ship unscoped; scoping them makes the Figma pickers show
    the right tokens in the right fields (kit hygiene, zero render change).
13. **`setVariableCodeSyntax('WEB', …)`** — minted variables could carry their
    CSS custom-property name, so Figma inspect shows `var(--color-action-bg)`
    verbatim. (Present in typings; **VERIFY-BY-SPIKE** the exact signature.)
14. **`cornerSmoothing`** [S1] — no CSS equivalent; relevant only for
    squircle-styled targets; note, don't build.
15. **Instance variant-property STRING bindings** [S7] — variables can drive
    variant selection on instances; possible future lever for mode-driven
    composition.

## Known traps (verified, cost a build cycle each if forgotten)

- **Opacity binding percent-scale**: binding a 0–1 FLOAT to `opacity` renders
  at 0–100 interpretation (0.5 → 0.5%) — repo visual-parity receipt [R3].
  Literal until a spike proves otherwise.
- **Paint-stack order inversion**: CSS backgrounds list top-first; Figma paints
  list bottom-first [S4].
- **Rotation origin**: Figma rotates about top-left, CSS about center [S8].
- **`relativeTransform` unit-axes constraint**: no scale or shear through the
  matrix; `resize()` for scale, nothing for shear [S8].
- **Shape-branch emitter bug (open engine finding)**: emitted `buildNode` shape
  branch drops `spec.stroke`/`spec.bindings` and leaves the default gray fill —
  Phase B deviations 2–3 [R4]. Any shape-channel work lands on top of this fix.
- **`hexToRgb` emitter bug (open engine finding)**: `buildTokensScript` parses
  hex only; DTCG sets carry `rgba()` strings [R4].

## (d) Sources & version stamp

**Consulted 2026-07-19.** Figma Plugin API docs (developers.figma.com) carry no
page-level version numbers; the API surface is pinned instead by the official
typings release: **`@figma/plugin-typings` 1.131.0** (npm registry; published
≈ 2026-07-16) [S10].

| ref | source |
|---|---|
| S1 | developers.figma.com/docs/plugins/api/FrameNode/ (fetched 2026-07-19) |
| S2 | developers.figma.com/docs/plugins/api/TextNode/ |
| S3 | developers.figma.com/docs/plugins/api/Effect/ |
| S4 | developers.figma.com/docs/plugins/api/Paint/ |
| S5 | developers.figma.com/docs/plugins/api/VariableBindableNodeField/ — full union: `height, width, characters, itemSpacing, paddingLeft/Right/Top/Bottom, visible, cornerRadius, topLeftRadius, topRightRadius, bottomLeftRadius, bottomRightRadius, minWidth, maxWidth, minHeight, maxHeight, counterAxisSpacing, strokeWeight, strokeTopWeight, strokeRightWeight, strokeBottomWeight, strokeLeftWeight, opacity, gridRowGap, gridColumnGap` |
| S6 | developers.figma.com/docs/plugins/api/VariableBindableTextField/ — full union: `fontFamily, fontSize, fontStyle, fontWeight, letterSpacing, lineHeight, paragraphSpacing, paragraphIndent` |
| S7 | developers.figma.com/docs/plugins/working-with-variables/ |
| S8 | `figma/plugin-typings` master (`plugin-api.d.ts` + autodocs) via Context7 mirror — Transform/relativeTransform remarks, BlendMode/TextCase/TextDecoration unions, VariableScope list, `VariableBindablePaintField ('color'\|'opacity')`, effect/layout-grid bind helpers, `createNodeFromSvg` |
| S9 | developers.figma.com/docs/plugins/api/MaskType/ — `ALPHA \| VECTOR \| LUMINANCE` |
| S10 | registry.npmjs.org/@figma/plugin-typings/latest — 1.131.0 |
| S12 | developers.figma.com/docs/plugins/api/properties/nodes-counteraxisalignitems/ — `MIN \| MAX \| CENTER \| BASELINE` |
| R1–R4 | repo: `docs/STYLE-FIDELITY.md`, `scripts/contract-schema.ts`, `core/emit-figma-script.ts`, `examples/polaris/figma/PHASE-B-RECEIPT.md` |

Open VERIFY-BY-SPIKE items (each ≤ one plugin-console session): exact
`VariableBindableEffectField` spellings · `counterAxisAlignContent` values ·
`textAlignVertical` spelling · opacity-binding percent-scale retest ·
`setVariableCodeSyntax` signature · vector-bake path for skew.

---

*Addendum (2026-07-19, post-coverage-round): the two "open emitter bugs" cited in Known Traps — the shape-branch stroke drop and the hex-only color parser — were fixed at source in the coverage round merged the same day (see `core/emit-figma-script.ts`; the rgba parser is now executed by eval `rgba-stroke-emitter-fixes`). The traps remain documented as historical evidence of the build-cycle cost class.*
