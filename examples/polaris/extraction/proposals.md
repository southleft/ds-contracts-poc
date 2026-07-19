<!-- Committed copy of examples/polaris/out/proposals.md — the MECHANICAL extraction
     report over ALL 182 Polaris components (Shopify/polaris @ 2b1ea88625e0613853ca8577c9acd1980a90f382,
     MIT (c) Shopify, extracted 2026-07-18). Regenerate:
     npm run extract:code -- examples/polaris/extract.config.json -->

# Proposed contracts — extraction report

182 component(s) extracted, 109 with extracted anatomy. Every proposal parses against the contract schema, but a proposal is a STARTING POINT: confirm inferred design bindings via `npm run reconcile`, then review the notes below per component.

## AccountConnection

- source: `examples/polaris/.polaris-clone/polaris-react/src/components/AccountConnection/AccountConnection.tsx` (react-tsx)
- proposed: 3 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- prop `title`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually
- prop `details`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually
- prop `termsOfService`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually
- prop `action`: unclassified type — not proposed, review manually

## Action

- source: `examples/polaris/.polaris-clone/polaris-react/src/components/Listbox/components/Action/Action.tsx` (react-tsx)
- proposed: 0 props, 0 events
- anatomy EXTRACTED from JSX + CSS Module — 1 part(s), 0 token binding(s), 0 raw value(s) reported. Anatomy is human-REVIEWED: check it against design intent before adoption.
- prop `icon`: unclassified type — not proposed, review manually
- jsx: root element <ActionContext.Provider> is a component — anatomy not extracted (wrapper components are review items)

## ActionList

- source: `examples/polaris/.polaris-clone/polaris-react/src/components/ActionList/ActionList.tsx` (react-tsx)
- proposed: 2 props, 0 events
- anatomy EXTRACTED from JSX + CSS Module — 1 part(s), 0 token binding(s), 0 raw value(s) reported. Anatomy is human-REVIEWED: check it against design intent before adoption.
- prop `items`: unclassified type — not proposed, review manually
- prop `sections`: unclassified type — not proposed, review manually
- prop `actionRole`: unclassified type — not proposed, review manually
- prop `onActionAnyItem`: unclassified type — not proposed, review manually
- jsx: component returns a Fragment — contract anatomy needs a single root element, anatomy not extracted

## ActionMenu

- source: `examples/polaris/.polaris-clone/polaris-react/src/components/ActionMenu/ActionMenu.tsx` (react-tsx)
- proposed: 2 props, 0 events
- anatomy EXTRACTED from JSX + CSS Module — 1 part(s), 0 token binding(s), 1 raw value(s) reported. Anatomy is human-REVIEWED: check it against design intent before adoption.
- prop `actions`: unclassified type — not proposed, review manually
- prop `groups`: unclassified type — not proposed, review manually
- RAW VALUE (not tokenized): `.ActionMenu { width: 100% }` — no token in the tree has this value. A raw value is reported, never turned into an invented token; bind it to a real token and re-extract.
- jsx: root className actionMenuClassNames is not a CSS-module reference — parts under it are still read where legible
- jsx: part "root" conditional expression — not a `cond ? <el/> : null` shape, not extracted
- css: at-rule `@media print` skipped — not extractable into anatomy
- css: class ".ActionMenu" has declarations but no matching extracted JSX part — styles not attached, review by name

## Actions

- source: `examples/polaris/.polaris-clone/polaris-react/src/components/ActionMenu/components/Actions/Actions.tsx` (react-tsx)
- proposed: 0 props, 0 events
- anatomy EXTRACTED from JSX + CSS Module — 2 part(s), 1 token binding(s), 4 raw value(s) reported. Anatomy is human-REVIEWED: check it against design intent before adoption.
- prop `actions`: unclassified type — not proposed, review manually
- prop `groups`: unclassified type — not proposed, review manually
- RAW VALUE (not tokenized): `.ActionsLayoutOuter { width: 100% }` — no token in the tree has this value. A raw value is reported, never turned into an invented token; bind it to a real token and re-extract.
- RAW VALUE (not tokenized): `.ActionsLayout--measuring { height: 0 }` — no token in the tree has this value. A raw value is reported, never turned into an invented token; bind it to a real token and re-extract.
- RAW VALUE (not tokenized): `.ActionsLayoutMeasurer { gap: 0 }` — no token in the tree has this value. A raw value is reported, never turned into an invented token; bind it to a real token and re-extract.
- RAW VALUE (not tokenized): `.ActionsLayoutMeasurer { height: 0 }` — no token in the tree has this value. A raw value is reported, never turned into an invented token; bind it to a real token and re-extract.
- jsx: root class ".ActionsLayoutOuter" extracted as the contract root part (contract roots are named "root")
- jsx: part "root" renders {actionsMeasurer} — not a known text/node prop, not extracted
- jsx: <div> className classNames(…) — read as class "ActionsLayout"; the other 1 argument(s) are modifiers, not extracted
- jsx: part "actionsLayout" renders {actionsMarkup} — not a known text/node prop, not extracted
- jsx: part "actionsLayout" renders {groupsMarkup} — not a known text/node prop, not extracted
- css: .ActionsLayout { flex-wrap: wrap } — no inversion rule, not extracted
- css: selector `.ActionsLayout > *` — not extractable into anatomy, skipped by name
- css: .ActionsLayout--measuring { visibility: hidden } — no inversion rule, not extracted
- css: .ActionsLayoutMeasurer { flex-wrap: wrap } — no inversion rule, not extracted
- css: .ActionsLayoutMeasurer { visibility: hidden } — no inversion rule, not extracted
- css: .ActionsLayoutMeasurer position:absolute with insets (top:;bottom:;left:;right:) — not a generator overlay placement, not extracted
- css: selector `.ActionsLayoutMeasurer > *` — not extractable into anatomy, skipped by name
- css: class ".ActionsLayout--measuring" has declarations but no matching extracted JSX part — styles not attached, review by name
- css: class ".ActionsLayoutMeasurer" has declarations but no matching extracted JSX part — styles not attached, review by name

## ActionsMeasurer

- source: `examples/polaris/.polaris-clone/polaris-react/src/components/ActionMenu/components/Actions/components/ActionsMeasurer/ActionsMeasurer.tsx` (react-tsx)
- proposed: 0 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- prop `actions`: unclassified type — not proposed, review manually
- prop `groups`: unclassified type — not proposed, review manually

## Activator

- source: `examples/polaris/.polaris-clone/polaris-react/src/components/Picker/components/Activator/Activator.tsx` (react-tsx)
- proposed: 4 props, 0 events
- anatomy EXTRACTED from JSX + CSS Module — 2 part(s), 5 token binding(s), 1 raw value(s) reported. Anatomy is human-REVIEWED: check it against design intent before adoption.
- anatomy: component ref `<BlockStack>` mapped to contract id `polaris.block-stack` — confirm that contract exists (or adjust the id) before adoption
- RAW VALUE (not tokenized): `.Activator { width: 100% }` — no token in the tree has this value. A raw value is reported, never turned into an invented token; bind it to a real token and re-extract.
- jsx: root className classNames(…) read — root class ".Activator"; boolean modifier class(es): .disabled (disabled)
- jsx: root class ".Activator" extracted as the contract root part (contract roots are named "root")
- jsx: <button> attribute disabled={…} — expression not extractable, skipped
- jsx: <BlockStack> has non-text children — component-ref content not extracted
- jsx: <span> without a CSS-module className — not extracted as a part
- css: .Activator { outline: none } — no inversion rule, not extracted
- css: selector `.Activator:focus:not(:active)` — pseudo ":focus:not(:active)" is not a contract state, not extracted
- css: .disabled — styles behind boolean prop "disabled" (3 declaration(s)); boolean-conditional styling is not extractable into anatomy, review by name

## AfterInitialMount

- source: `examples/polaris/.polaris-clone/polaris-react/src/components/AfterInitialMount/AfterInitialMount.tsx` (react-tsx)
- proposed: 0 props, 1 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- prop `children`: platform prop — not contract API, skipped
- prop `fallback`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually
- event `onMount`: declared with trigger 'root' — assign the real trigger part once anatomy is authored

## AnnotatedSection

- source: `examples/polaris/.polaris-clone/polaris-react/src/components/Layout/components/AnnotatedSection/AnnotatedSection.tsx` (react-tsx)
- proposed: 0 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- prop `children`: platform prop — not contract API, skipped
- prop `title`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually
- prop `description`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually
- prop `id`: platform prop — not contract API, skipped

## Autocomplete

- source: `examples/polaris/.polaris-clone/polaris-react/src/components/Autocomplete/Autocomplete.tsx` (react-tsx)
- proposed: 4 props, 0 events
- anatomy EXTRACTED from JSX + CSS Module — 1 part(s), 0 token binding(s), 0 raw value(s) reported. Anatomy is human-REVIEWED: check it against design intent before adoption.
- prop `id`: platform prop — not contract API, skipped
- prop `options`: unclassified type — not proposed, review manually
- prop `selected`: unclassified type — not proposed, review manually
- prop `textField`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually
- prop `preferredPosition`: unclassified type — not proposed, review manually
- prop `actionBefore`: unclassified type — not proposed, review manually
- prop `emptyState`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually
- jsx: root element <Combobox> is a component — anatomy not extracted (wrapper components are review items)

## Avatar

- source: `examples/polaris/.polaris-clone/polaris-react/src/components/Avatar/Avatar.tsx` (react-tsx)
- proposed: 6 props, 0 events
- anatomy EXTRACTED from JSX + CSS Module — 1 part(s), 0 token binding(s), 19 raw value(s) reported. Anatomy is human-REVIEWED: check it against design intent before adoption.
- prop `size`: type resolved heuristically — review
- prop `size`: figma binding INFERRED as VARIANT "Size" — confirm against the design library (reconcile step)
- RAW VALUE (not tokenized): `.Avatar { --pc-avatar-xs-size: 20px }` — no token in the tree has this value. A raw value is reported, never turned into an invented token; bind it to a real token and re-extract.
- RAW VALUE (not tokenized): `.Avatar { --pc-avatar-sm-size: 24px }` — no token in the tree has this value. A raw value is reported, never turned into an invented token; bind it to a real token and re-extract.
- RAW VALUE (not tokenized): `.Avatar { --pc-avatar-md-size: 28px }` — no token in the tree has this value. A raw value is reported, never turned into an invented token; bind it to a real token and re-extract.
- RAW VALUE (not tokenized): `.Avatar { --pc-avatar-lg-size: 32px }` — no token in the tree has this value. A raw value is reported, never turned into an invented token; bind it to a real token and re-extract.
- RAW VALUE (not tokenized): `.Avatar { --pc-avatar-xl-size: 40px }` — no token in the tree has this value. A raw value is reported, never turned into an invented token; bind it to a real token and re-extract.
- RAW VALUE (not tokenized): `.Avatar { max-width: 100% }` — no token in the tree has this value. A raw value is reported, never turned into an invented token; bind it to a real token and re-extract.
- RAW VALUE (not tokenized): `.sizeXs { border-radius: 4px }` — no token in the tree has this value. A raw value is reported, never turned into an invented token; bind it to a real token and re-extract.
- RAW VALUE (not tokenized): `.sizeSm { border-radius: 6px }` — no token in the tree has this value. A raw value is reported, never turned into an invented token; bind it to a real token and re-extract.
- RAW VALUE (not tokenized): `.sizeMd { border-radius: 6px }` — no token in the tree has this value. A raw value is reported, never turned into an invented token; bind it to a real token and re-extract.
- RAW VALUE (not tokenized): `.sizeLg { border-radius: 8px }` — no token in the tree has this value. A raw value is reported, never turned into an invented token; bind it to a real token and re-extract.
- RAW VALUE (not tokenized): `.sizeXl { border-radius: 8px }` — no token in the tree has this value. A raw value is reported, never turned into an invented token; bind it to a real token and re-extract.
- RAW VALUE (not tokenized): `.imageHasLoaded { background: transparent }` — no token in the tree has this value. A raw value is reported, never turned into an invented token; bind it to a real token and re-extract.
- RAW VALUE (not tokenized): `.Image { width: 100% }` — no token in the tree has this value. A raw value is reported, never turned into an invented token; bind it to a real token and re-extract.
- RAW VALUE (not tokenized): `.Image { height: 100% }` — no token in the tree has this value. A raw value is reported, never turned into an invented token; bind it to a real token and re-extract.
- RAW VALUE (not tokenized): `.Image { border-radius: inherit }` — no token in the tree has this value. A raw value is reported, never turned into an invented token; bind it to a real token and re-extract.
- RAW VALUE (not tokenized): `.Initials { width: 100% }` — no token in the tree has this value. A raw value is reported, never turned into an invented token; bind it to a real token and re-extract.
- RAW VALUE (not tokenized): `.Initials { height: 100% }` — no token in the tree has this value. A raw value is reported, never turned into an invented token; bind it to a real token and re-extract.
- RAW VALUE (not tokenized): `.Svg { width: 100% }` — no token in the tree has this value. A raw value is reported, never turned into an invented token; bind it to a real token and re-extract.
- RAW VALUE (not tokenized): `.Svg { height: 100% }` — no token in the tree has this value. A raw value is reported, never turned into an invented token; bind it to a real token and re-extract.
- jsx: root className className is not a CSS-module reference — parts under it are still read where legible
- jsx: <span> attribute role={…} — expression not extractable, skipped
- jsx: part "root" renders {svgMarkup} — not a known text/node prop, not extracted
- jsx: part "root" renders {imageMarkUp} — not a known text/node prop, not extracted
- css: at-rule `@media (forced-colors: active)` skipped — not extractable into anatomy
- css: .Avatar { display: block } — no inversion rule, not extracted
- css: .Avatar { overflow: hidden } — no inversion rule, not extracted
- css: .Avatar { min-width } uses var(--pc-avatar-xs-size) which resolves to NO token in the token tree — binding not proposed
- css: .Avatar { user-select: none } — no inversion rule, not extracted
- css: selector `.Avatar.imageHasLoaded` — not extractable into anatomy, skipped by name
- css: selector `.Avatar::after` — not extractable into anatomy, skipped by name
- css: selector `.Text.long` — not extractable into anatomy, skipped by name
- css: .hidden { visibility: hidden } — no inversion rule, not extracted
- css: .sizeXs { width } uses var(--pc-avatar-xs-size) which resolves to NO token in the token tree — binding not proposed
- css: .sizeSm { width } uses var(--pc-avatar-sm-size) which resolves to NO token in the token tree — binding not proposed
- css: .sizeMd { width } uses var(--pc-avatar-md-size) which resolves to NO token in the token tree — binding not proposed
- css: .sizeLg { width } uses var(--pc-avatar-lg-size) which resolves to NO token in the token tree — binding not proposed
- css: .sizeXl { width } uses var(--pc-avatar-xl-size) which resolves to NO token in the token tree — binding not proposed
- css: selector `.styleOne svg` — icon glyph sizing, not extracted (icon parts are review items)
- css: selector `.styleOne text` — not extractable into anatomy, skipped by name
- css: selector `.styleTwo svg` — icon glyph sizing, not extracted (icon parts are review items)
- css: selector `.styleTwo text` — not extractable into anatomy, skipped by name
- css: selector `.styleThree svg` — icon glyph sizing, not extracted (icon parts are review items)
- css: selector `.styleThree text` — not extractable into anatomy, skipped by name
- css: selector `.styleFour svg` — icon glyph sizing, not extracted (icon parts are review items)
- css: selector `.styleFour text` — not extractable into anatomy, skipped by name
- css: selector `.styleFive svg` — icon glyph sizing, not extracted (icon parts are review items)
- css: selector `.styleFive text` — not extractable into anatomy, skipped by name
- css: selector `.styleSix svg` — icon glyph sizing, not extracted (icon parts are review items)
- css: selector `.styleSix text` — not extractable into anatomy, skipped by name
- css: selector `.styleSeven svg` — icon glyph sizing, not extracted (icon parts are review items)
- css: selector `.styleSeven text` — not extractable into anatomy, skipped by name
- css: .Image { transform: translate(-50%, -50%) } — no inversion rule, not extracted
- css: .Image { object-fit: cover } — no inversion rule, not extracted
- css: .Image position:absolute with insets (top:50%;bottom:;left:50%;right:) — not a generator overlay placement, not extracted
- css: .Initials position:absolute with insets (top:0;bottom:;left:;right:0) — not a generator overlay placement, not extracted
- css: class ".Avatar" has declarations but no matching extracted JSX part — styles not attached, review by name
- css: class ".Text" has declarations but no matching extracted JSX part — styles not attached, review by name
- css: class ".hidden" has declarations but no matching extracted JSX part — styles not attached, review by name
- css: class ".sizeXs" has declarations but no matching extracted JSX part — styles not attached, review by name
- css: class ".sizeSm" has declarations but no matching extracted JSX part — styles not attached, review by name
- css: class ".sizeMd" has declarations but no matching extracted JSX part — styles not attached, review by name
- css: class ".sizeLg" has declarations but no matching extracted JSX part — styles not attached, review by name
- css: class ".sizeXl" has declarations but no matching extracted JSX part — styles not attached, review by name
- css: class ".styleOne" has declarations but no matching extracted JSX part — styles not attached, review by name
- css: class ".styleTwo" has declarations but no matching extracted JSX part — styles not attached, review by name
- css: class ".styleThree" has declarations but no matching extracted JSX part — styles not attached, review by name
- css: class ".styleFour" has declarations but no matching extracted JSX part — styles not attached, review by name
- css: class ".styleFive" has declarations but no matching extracted JSX part — styles not attached, review by name
- css: class ".styleSix" has declarations but no matching extracted JSX part — styles not attached, review by name
- css: class ".styleSeven" has declarations but no matching extracted JSX part — styles not attached, review by name
- css: class ".imageHasLoaded" has declarations but no matching extracted JSX part — styles not attached, review by name
- css: class ".Image" has declarations but no matching extracted JSX part — styles not attached, review by name
- css: class ".Initials" has declarations but no matching extracted JSX part — styles not attached, review by name
- css: class ".Svg" has declarations but no matching extracted JSX part — styles not attached, review by name

## Backdrop

- source: `examples/polaris/.polaris-clone/polaris-react/src/components/Backdrop/Backdrop.tsx` (react-tsx)
- proposed: 2 props, 0 events
- anatomy EXTRACTED from JSX + CSS Module — 1 part(s), 0 token binding(s), 0 raw value(s) reported. Anatomy is human-REVIEWED: check it against design intent before adoption.
- prop `setClosing`: unclassified type — not proposed, review manually
- jsx: component returns a Fragment — contract anatomy needs a single root element, anatomy not extracted

## Badge

- source: `examples/polaris/.polaris-clone/polaris-react/src/components/Badge/Badge.tsx` (react-tsx)
- proposed: 1 props, 0 events
- anatomy EXTRACTED from JSX + CSS Module — 4 part(s), 0 token binding(s), 1 raw value(s) reported. Anatomy is human-REVIEWED: check it against design intent before adoption.
- props type composes named reference(s) [| {progress?: Progress; icon?: undefined}
    | {icon?: IconSource; progress?: undefined}] whose members are outside module scope — those props are NOT carried (single-file extraction)
- prop `children`: platform prop — not contract API, skipped
- prop `tone`: unclassified type — not proposed, review manually
- prop `progress`: unclassified type — not proposed, review manually
- prop `icon`: unclassified type — not proposed, review manually
- prop `size`: unclassified type — not proposed, review manually
- anatomy: component ref `<Icon>` mapped to contract id `polaris.icon` — confirm that contract exists (or adjust the id) before adoption
- anatomy: component ref `<Text>` mapped to contract id `polaris.text` — confirm that contract exists (or adjust the id) before adoption
- RAW VALUE (not tokenized): `.toneRead-only { background-color: transparent }` — no token in the tree has this value. A raw value is reported, never turned into an invented token; bind it to a real token and re-extract.
- jsx: root className className is not a CSS-module reference — parts under it are still read where legible
- jsx: part "root" renders {accessibilityMarkup} — not a known text/node prop, not extracted
- jsx: <Text> prop fontWeight={…} — expression not extractable on a component ref, skipped
- jsx: <Text> has non-text children — component-ref content not extracted
- css: at-rule `@media print` skipped — not extractable into anatomy
- css: .Badge { padding-block } uses var(--pc-badge-vertical-padding) which resolves to NO token in the token tree — binding not proposed
- css: .Badge { padding-inline } uses var(--pc-badge-horizontal-padding) which resolves to NO token in the token tree — binding not proposed
- css: selector `.Badge svg` — icon glyph sizing, not extracted (icon parts are review items)
- css: selector `.toneSuccess svg` — icon glyph sizing, not extracted (icon parts are review items)
- css: selector `.toneSuccess-strong svg` — icon glyph sizing, not extracted (icon parts are review items)
- css: selector `.toneInfo svg` — icon glyph sizing, not extracted (icon parts are review items)
- css: selector `.toneInfo-strong svg` — icon glyph sizing, not extracted (icon parts are review items)
- css: selector `.toneAttention svg` — icon glyph sizing, not extracted (icon parts are review items)
- css: selector `.toneAttention-strong svg` — icon glyph sizing, not extracted (icon parts are review items)
- css: selector `.toneWarning svg` — icon glyph sizing, not extracted (icon parts are review items)
- css: selector `.toneWarning-strong svg` — icon glyph sizing, not extracted (icon parts are review items)
- css: selector `.toneCritical svg` — icon glyph sizing, not extracted (icon parts are review items)
- css: selector `.toneCritical-strong svg` — icon glyph sizing, not extracted (icon parts are review items)
- css: selector `.toneNew svg` — icon glyph sizing, not extracted (icon parts are review items)
- css: selector `.toneMagic svg` — icon glyph sizing, not extracted (icon parts are review items)
- css: selector `.toneRead-only svg` — icon glyph sizing, not extracted (icon parts are review items)
- css: selector `.toneEnabled svg` — icon glyph sizing, not extracted (icon parts are review items)
- css: .Icon { margin: calc(-1 * var(--p-space-050)) 0 calc(-1 * var(--p-space-050)) calc(-1 * var(--p-space-200)) } — var() inside a shorthand is not invertible to a single binding, not extracted
- css: selector `.Icon svg` — icon glyph sizing, not extracted (icon parts are review items)
- css: selector `.Icon .sizeLarge &` — not extractable into anatomy, skipped by name
- css: selector `.Icon + *` — not extractable into anatomy, skipped by name
- css: .PipContainer { display: grid } — no inversion rule, not extracted
- css: .PipContainer { margin-left: calc(-1 * var(--p-space-050)) } — var() inside a shorthand is not invertible to a single binding, not extracted
- css: class ".Badge" has declarations but no matching extracted JSX part — styles not attached, review by name
- css: class ".toneSuccess" has declarations but no matching extracted JSX part — styles not attached, review by name
- css: class ".toneSuccess-strong" has declarations but no matching extracted JSX part — styles not attached, review by name
- css: class ".toneInfo" has declarations but no matching extracted JSX part — styles not attached, review by name
- css: class ".toneInfo-strong" has declarations but no matching extracted JSX part — styles not attached, review by name
- css: class ".toneAttention" has declarations but no matching extracted JSX part — styles not attached, review by name
- css: class ".toneAttention-strong" has declarations but no matching extracted JSX part — styles not attached, review by name
- css: class ".toneWarning" has declarations but no matching extracted JSX part — styles not attached, review by name
- css: class ".toneWarning-strong" has declarations but no matching extracted JSX part — styles not attached, review by name
- css: class ".toneCritical" has declarations but no matching extracted JSX part — styles not attached, review by name
- css: class ".toneCritical-strong" has declarations but no matching extracted JSX part — styles not attached, review by name
- css: class ".toneNew" has declarations but no matching extracted JSX part — styles not attached, review by name
- css: class ".toneMagic" has declarations but no matching extracted JSX part — styles not attached, review by name
- css: class ".toneRead-only" has declarations but no matching extracted JSX part — styles not attached, review by name
- css: class ".toneEnabled" has declarations but no matching extracted JSX part — styles not attached, review by name
- css: class ".sizeLarge" has declarations but no matching extracted JSX part — styles not attached, review by name
- css: class ".withinFilter" has declarations but no matching extracted JSX part — styles not attached, review by name
- css: class ".PipContainer" has declarations but no matching extracted JSX part — styles not attached, review by name

## Banner

- source: `examples/polaris/.polaris-clone/polaris-react/src/components/Banner/Banner.tsx` (react-tsx)
- proposed: 4 props, 0 events
- anatomy EXTRACTED from JSX + CSS Module — 1 part(s), 0 token binding(s), 0 raw value(s) reported. Anatomy is human-REVIEWED: check it against design intent before adoption.
- prop `icon`: unclassified type — not proposed, review manually
- prop `tone`: type resolved heuristically — review
- prop `tone`: figma binding INFERRED as VARIANT "Tone" — confirm against the design library (reconcile step)
- prop `children`: platform prop — not contract API, skipped
- prop `action`: unclassified type — not proposed, review manually
- prop `secondaryAction`: unclassified type — not proposed, review manually
- jsx: root element <BannerContext.Provider> is a component — anatomy not extracted (wrapper components are review items)

## BannerLayout

- source: `examples/polaris/.polaris-clone/polaris-react/src/components/Banner/Banner.tsx` (react-tsx)
- proposed: 4 props, 0 events
- anatomy EXTRACTED from JSX + CSS Module — 1 part(s), 0 token binding(s), 0 raw value(s) reported. Anatomy is human-REVIEWED: check it against design intent before adoption.
- prop `icon`: unclassified type — not proposed, review manually
- prop `tone`: type resolved heuristically — review
- prop `tone`: figma binding INFERRED as VARIANT "Tone" — confirm against the design library (reconcile step)
- prop `children`: platform prop — not contract API, skipped
- prop `action`: unclassified type — not proposed, review manually
- prop `secondaryAction`: unclassified type — not proposed, review manually
- jsx: multiple JSX returns — anatomy read from the first
- jsx: root element <WithinContentContainerBanner> is a component — anatomy not extracted (wrapper components are review items)

## Bleed

- source: `examples/polaris/.polaris-clone/polaris-react/src/components/Bleed/Bleed.tsx` (react-tsx)
- proposed: 0 props, 0 events
- anatomy EXTRACTED from JSX + CSS Module — 1 part(s), 0 token binding(s), 0 raw value(s) reported. Anatomy is human-REVIEWED: check it against design intent before adoption.
- prop `children`: platform prop — not contract API, skipped
- prop `marginInline`: unclassified type — not proposed, review manually
- prop `marginBlock`: unclassified type — not proposed, review manually
- prop `marginBlockStart`: unclassified type — not proposed, review manually
- prop `marginBlockEnd`: unclassified type — not proposed, review manually
- prop `marginInlineStart`: unclassified type — not proposed, review manually
- prop `marginInlineEnd`: unclassified type — not proposed, review manually
- jsx: root class ".Bleed" extracted as the contract root part (contract roots are named "root")
- jsx: root renders {children} directly — children channel (text prop vs default slot) is not decidable from code
- css: at-rule `@media (--p-breakpoints-sm-up)` skipped — not extractable into anatomy
- css: at-rule `@media (--p-breakpoints-md-up)` skipped — not extractable into anatomy
- css: at-rule `@media (--p-breakpoints-lg-up)` skipped — not extractable into anatomy
- css: at-rule `@media (--p-breakpoints-xl-up)` skipped — not extractable into anatomy
- css: .Bleed { --pc-bleed-margin-block-start-xs: initial } — no inversion rule, not extracted
- css: .Bleed { --pc-bleed-margin-block-start-sm } uses var(--pc-bleed-margin-block-start-xs) which resolves to NO token in the token tree — binding not proposed
- css: .Bleed { --pc-bleed-margin-block-start-md } uses var(--pc-bleed-margin-block-start-sm) which resolves to NO token in the token tree — binding not proposed
- css: .Bleed { --pc-bleed-margin-block-start-lg } uses var(--pc-bleed-margin-block-start-md) which resolves to NO token in the token tree — binding not proposed
- css: .Bleed { --pc-bleed-margin-block-start-xl } uses var(--pc-bleed-margin-block-start-lg) which resolves to NO token in the token tree — binding not proposed
- css: .Bleed { --pc-bleed-margin-block-end-xs: initial } — no inversion rule, not extracted
- css: .Bleed { --pc-bleed-margin-block-end-sm } uses var(--pc-bleed-margin-block-end-xs) which resolves to NO token in the token tree — binding not proposed
- css: .Bleed { --pc-bleed-margin-block-end-md } uses var(--pc-bleed-margin-block-end-sm) which resolves to NO token in the token tree — binding not proposed
- css: .Bleed { --pc-bleed-margin-block-end-lg } uses var(--pc-bleed-margin-block-end-md) which resolves to NO token in the token tree — binding not proposed
- css: .Bleed { --pc-bleed-margin-block-end-xl } uses var(--pc-bleed-margin-block-end-lg) which resolves to NO token in the token tree — binding not proposed
- css: .Bleed { --pc-bleed-margin-inline-start-xs: initial } — no inversion rule, not extracted
- css: .Bleed { --pc-bleed-margin-inline-start-sm } uses var(--pc-bleed-margin-inline-start-xs) which resolves to NO token in the token tree — binding not proposed
- css: .Bleed { --pc-bleed-margin-inline-start-md } uses var(--pc-bleed-margin-inline-start-sm) which resolves to NO token in the token tree — binding not proposed
- css: .Bleed { --pc-bleed-margin-inline-start-lg } uses var(--pc-bleed-margin-inline-start-md) which resolves to NO token in the token tree — binding not proposed
- css: .Bleed { --pc-bleed-margin-inline-start-xl } uses var(--pc-bleed-margin-inline-start-lg) which resolves to NO token in the token tree — binding not proposed
- css: .Bleed { --pc-bleed-margin-inline-end-xs: initial } — no inversion rule, not extracted
- css: .Bleed { --pc-bleed-margin-inline-end-sm } uses var(--pc-bleed-margin-inline-end-xs) which resolves to NO token in the token tree — binding not proposed
- css: .Bleed { --pc-bleed-margin-inline-end-md } uses var(--pc-bleed-margin-inline-end-sm) which resolves to NO token in the token tree — binding not proposed
- css: .Bleed { --pc-bleed-margin-inline-end-lg } uses var(--pc-bleed-margin-inline-end-md) which resolves to NO token in the token tree — binding not proposed
- css: .Bleed { --pc-bleed-margin-inline-end-xl } uses var(--pc-bleed-margin-inline-end-lg) which resolves to NO token in the token tree — binding not proposed
- css: .Bleed { margin-block-start: calc(-1 * var(--pc-bleed-margin-block-start-xs)) } — var() inside a shorthand is not invertible to a single binding, not extracted
- css: .Bleed { margin-block-end: calc(-1 * var(--pc-bleed-margin-block-end-xs)) } — var() inside a shorthand is not invertible to a single binding, not extracted
- css: .Bleed { margin-inline-start: calc(-1 * var(--pc-bleed-margin-inline-start-xs)) } — var() inside a shorthand is not invertible to a single binding, not extracted
- css: .Bleed { margin-inline-end: calc(-1 * var(--pc-bleed-margin-inline-end-xs)) } — var() inside a shorthand is not invertible to a single binding, not extracted

## BlockStack

- source: `examples/polaris/.polaris-clone/polaris-react/src/components/BlockStack/BlockStack.tsx` (react-tsx)
- proposed: 4 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- prop `children`: platform prop — not contract API, skipped
- prop `as`: type resolved heuristically — review
- prop `as`: figma binding INFERRED as VARIANT "As" — confirm against the design library (reconcile step)
- prop `align`: type resolved heuristically — review
- prop `align`: figma binding INFERRED as VARIANT "Align" — confirm against the design library (reconcile step)
- prop `inlineAlign`: type resolved heuristically — review
- prop `inlineAlign`: figma binding INFERRED as VARIANT "Inline Align" — confirm against the design library (reconcile step)
- prop `gap`: unclassified type — not proposed, review manually
- prop `id`: platform prop — not contract API, skipped
- prop `role`: unclassified type — not proposed, review manually

## Box

- source: `examples/polaris/.polaris-clone/polaris-react/src/components/Box/Box.tsx` (react-tsx)
- proposed: 14 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- prop `children`: platform prop — not contract API, skipped
- prop `as`: type resolved heuristically — review
- prop `as`: figma binding INFERRED as VARIANT "As" — confirm against the design library (reconcile step)
- prop `background`: unclassified type — not proposed, review manually
- prop `borderColor`: unclassified type — not proposed, review manually
- prop `borderStyle`: type resolved heuristically — review
- prop `borderStyle`: figma binding INFERRED as VARIANT "Border Style" — confirm against the design library (reconcile step)
- prop `borderRadius`: unclassified type — not proposed, review manually
- prop `borderEndStartRadius`: unclassified type — not proposed, review manually
- prop `borderEndEndRadius`: unclassified type — not proposed, review manually
- prop `borderStartStartRadius`: unclassified type — not proposed, review manually
- prop `borderStartEndRadius`: unclassified type — not proposed, review manually
- prop `borderWidth`: unclassified type — not proposed, review manually
- prop `borderBlockStartWidth`: unclassified type — not proposed, review manually
- prop `borderBlockEndWidth`: unclassified type — not proposed, review manually
- prop `borderInlineStartWidth`: unclassified type — not proposed, review manually
- prop `borderInlineEndWidth`: unclassified type — not proposed, review manually
- prop `color`: unclassified type — not proposed, review manually
- prop `id`: platform prop — not contract API, skipped
- prop `overflowX`: type resolved heuristically — review
- prop `overflowX`: figma binding INFERRED as VARIANT "Overflow X" — confirm against the design library (reconcile step)
- prop `overflowY`: type resolved heuristically — review
- prop `overflowY`: figma binding INFERRED as VARIANT "Overflow Y" — confirm against the design library (reconcile step)
- prop `padding`: unclassified type — not proposed, review manually
- prop `paddingBlock`: unclassified type — not proposed, review manually
- prop `paddingBlockStart`: unclassified type — not proposed, review manually
- prop `paddingBlockEnd`: unclassified type — not proposed, review manually
- prop `paddingInline`: unclassified type — not proposed, review manually
- prop `paddingInlineStart`: unclassified type — not proposed, review manually
- prop `paddingInlineEnd`: unclassified type — not proposed, review manually
- prop `role`: unclassified type — not proposed, review manually
- prop `shadow`: unclassified type — not proposed, review manually
- prop `tabIndex`: unclassified type — not proposed, review manually
- prop `position`: type resolved heuristically — review
- prop `position`: figma binding INFERRED as VARIANT "Position" — confirm against the design library (reconcile step)
- prop `insetBlockStart`: unclassified type — not proposed, review manually
- prop `insetBlockEnd`: unclassified type — not proposed, review manually
- prop `insetInlineStart`: unclassified type — not proposed, review manually
- prop `insetInlineEnd`: unclassified type — not proposed, review manually
- prop `outlineColor`: unclassified type — not proposed, review manually
- prop `outlineStyle`: type resolved heuristically — review
- prop `outlineStyle`: figma binding INFERRED as VARIANT "Outline Style" — confirm against the design library (reconcile step)
- prop `outlineWidth`: unclassified type — not proposed, review manually

## Breadcrumbs

- source: `examples/polaris/.polaris-clone/polaris-react/src/components/Breadcrumbs/Breadcrumbs.tsx` (react-tsx)
- proposed: 0 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- prop `backAction`: unclassified type — not proposed, review manually

## BulkActionButton

- source: `examples/polaris/.polaris-clone/polaris-react/src/components/BulkActions/components/BulkActionButton/BulkActionButton.tsx` (react-tsx)
- proposed: 3 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- props type composes named reference(s) [DisableableAction, DestructableAction] whose members are outside module scope — those props are NOT carried (single-file extraction)
- prop `size`: unclassified type — not proposed, review manually

## BulkActionMenu

- source: `examples/polaris/.polaris-clone/polaris-react/src/components/BulkActions/components/BulkActionMenu/BulkActionMenu.tsx` (react-tsx)
- proposed: 1 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- prop `size`: unclassified type — not proposed, review manually

## BulkActions

- source: `examples/polaris/.polaris-clone/polaris-react/src/components/BulkActions/BulkActions.tsx` (react-tsx)
- proposed: 7 props, 0 events
- anatomy EXTRACTED from JSX + CSS Module — 2 part(s), 0 token binding(s), 6 raw value(s) reported. Anatomy is human-REVIEWED: check it against design intent before adoption.
- prop `selected`: unclassified type — not proposed, review manually
- prop `paginatedSelectAllAction`: unclassified type — not proposed, review manually
- prop `promotedActions`: unclassified type — not proposed, review manually
- prop `actions`: unclassified type — not proposed, review manually
- prop `buttonSize`: unclassified type — not proposed, review manually
- prop `innerRef`: unclassified type — not proposed, review manually
- anatomy: component ref `<InlineStack>` mapped to contract id `polaris.inline-stack` — confirm that contract exists (or adjust the id) before adoption
- RAW VALUE (not tokenized): `.BulkActionsOuterLayout { width: 100% }` — no token in the tree has this value. A raw value is reported, never turned into an invented token; bind it to a real token and re-extract.
- RAW VALUE (not tokenized): `.BulkActionsSelectAllWrapper { min-height: 24px }` — no token in the tree has this value. A raw value is reported, never turned into an invented token; bind it to a real token and re-extract.
- RAW VALUE (not tokenized): `.BulkActionsLayout--measuring { height: 0 }` — no token in the tree has this value. A raw value is reported, never turned into an invented token; bind it to a real token and re-extract.
- RAW VALUE (not tokenized): `.BulkActionsMeasurerLayout { gap: 0 }` — no token in the tree has this value. A raw value is reported, never turned into an invented token; bind it to a real token and re-extract.
- RAW VALUE (not tokenized): `.BulkActionsMeasurerLayout { height: 0 }` — no token in the tree has this value. A raw value is reported, never turned into an invented token; bind it to a real token and re-extract.
- RAW VALUE (not tokenized): `.BulkActionsMeasurerLayout { width: 100% }` — no token in the tree has this value. A raw value is reported, never turned into an invented token; bind it to a real token and re-extract.
- jsx: root class ".BulkActions" extracted as the contract root part (contract roots are named "root")
- jsx: <InlineStack> has non-text children — component-ref content not extracted
- css: .BulkActionsOuterLayout { flex: 1 } — no inversion rule, not extracted
- css: .BulkActionsPromotedActionsWrapper { flex: 1 } — no inversion rule, not extracted
- css: .BulkActionsLayout { flex-wrap: wrap } — no inversion rule, not extracted
- css: selector `.BulkActionsLayout > *` — not extractable into anatomy, skipped by name
- css: .BulkActionsLayout--measuring { visibility: hidden } — no inversion rule, not extracted
- css: .BulkActionsMeasurerLayout { flex-wrap: wrap } — no inversion rule, not extracted
- css: .BulkActionsMeasurerLayout { visibility: hidden } — no inversion rule, not extracted
- css: .BulkActionsMeasurerLayout position:absolute with insets (top:;bottom:;left:;right:) — not a generator overlay placement, not extracted
- css: selector `.BulkActionsMeasurerLayout > *` — not extractable into anatomy, skipped by name
- css: .BulkActionButton { white-space: nowrap } — no inversion rule, not extracted
- css: selector `.BulkActionButton button` — not extractable into anatomy, skipped by name
- css: .disabled { cursor: default } — no inversion rule, not extracted
- css: .disabled { pointer-events: none } — no inversion rule, not extracted
- css: .AllAction { outline: none } — no inversion rule, not extracted
- css: selector `.AllAction:hover` — part-scoped state pseudo; the contract vocabulary carries part-level states (Part.states, v13 — as `.root:hover .part` descendant rules) but CSS inversion of this shape is not implemented; declare it on the contract directly, review
- css: selector `.AllAction:focus` — pseudo ":focus" is not a contract state, not extracted
- css: selector `.AllAction:active` — part-scoped state pseudo; the contract vocabulary carries part-level states (Part.states, v13 — as `.root:active .part` descendant rules) but CSS inversion of this shape is not implemented; declare it on the contract directly, review
- css: selector `.AllAction:focus-visible:not(:active)` — part-scoped state pseudo; the contract vocabulary carries part-level states (Part.states, v13 — as `.root:focus-visible:not(:active) .part` descendant rules) but CSS inversion of this shape is not implemented; declare it on the contract directly, review
- css: class ".BulkActionsOuterLayout" has declarations but no matching extracted JSX part — styles not attached, review by name
- css: class ".BulkActionsSelectAllWrapper" has declarations but no matching extracted JSX part — styles not attached, review by name
- css: class ".BulkActionsPromotedActionsWrapper" has declarations but no matching extracted JSX part — styles not attached, review by name
- css: class ".BulkActionsLayout" has declarations but no matching extracted JSX part — styles not attached, review by name
- css: class ".BulkActionsLayout--measuring" has declarations but no matching extracted JSX part — styles not attached, review by name
- css: class ".BulkActionsMeasurerLayout" has declarations but no matching extracted JSX part — styles not attached, review by name
- css: class ".BulkActionButton" has declarations but no matching extracted JSX part — styles not attached, review by name
- css: class ".disabled" has declarations but no matching extracted JSX part — styles not attached, review by name
- css: class ".AllAction" has declarations but no matching extracted JSX part — styles not attached, review by name

## BulkActionsMeasurer

- source: `examples/polaris/.polaris-clone/polaris-react/src/components/BulkActions/components/BulkActionsMeasurer/BulkActionsMeasurer.tsx` (react-tsx)
- proposed: 0 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- prop `promotedActions`: unclassified type — not proposed, review manually
- prop `disabled`: unclassified type — not proposed, review manually
- prop `buttonSize`: unclassified type — not proposed, review manually

## Button

- source: `examples/polaris/.polaris-clone/polaris-react/src/components/Button/Button.tsx` (react-tsx)
- proposed: 7 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- prop `children`: platform prop — not contract API, skipped
- prop `size`: figma binding INFERRED as VARIANT "Size" — confirm against the design library (reconcile step)
- prop `textAlign`: figma binding INFERRED as VARIANT "Text Align" — confirm against the design library (reconcile step)
- prop `disclosure`: unclassified type — not proposed, review manually
- prop `icon`: unclassified type — not proposed, review manually
- prop `tone`: figma binding INFERRED as VARIANT "Tone" — confirm against the design library (reconcile step)
- prop `variant`: figma binding INFERRED as VARIANT "Variant" — confirm against the design library (reconcile step)

## ButtonGroup

- source: `examples/polaris/.polaris-clone/polaris-react/src/components/ButtonGroup/ButtonGroup.tsx` (react-tsx)
- proposed: 4 props, 0 events
- anatomy EXTRACTED from JSX + CSS Module — 1 part(s), 0 token binding(s), 0 raw value(s) reported. Anatomy is human-REVIEWED: check it against design intent before adoption.
- prop `gap`: type resolved heuristically — review
- prop `gap`: figma binding INFERRED as VARIANT "Gap" — confirm against the design library (reconcile step)
- prop `variant`: unclassified type — not proposed, review manually
- prop `children`: platform prop — not contract API, skipped
- jsx: root className className is not a CSS-module reference — parts under it are still read where legible
- jsx: part "root" renders {contents} — not a known text/node prop, not extracted
- css: .ButtonGroup { --pc-button-group-item: 10 } — no inversion rule, not extracted
- css: .ButtonGroup { --pc-button-group-focused: 20 } — no inversion rule, not extracted
- css: .ButtonGroup { flex-wrap: wrap } — no inversion rule, not extracted
- css: .ButtonGroup { margin-top: calc(-1 * var(--p-space-200)) } — var() inside a shorthand is not invertible to a single binding, not extracted
- css: .ButtonGroup { margin-left: calc(-1 * var(--p-space-200)) } — var() inside a shorthand is not invertible to a single binding, not extracted
- css: selector `.Item-plain:not(:first-child)` — pseudo ":not(:first-child)" is not a contract state, not extracted
- css: selector `.Item-plain:not(:last-child)` — pseudo ":not(:last-child)" is not a contract state, not extracted
- css: .variantSegmented { flex-wrap: nowrap } — no inversion rule, not extracted
- css: .variantSegmented { margin-top: 0 } — no inversion rule, not extracted
- css: .variantSegmented { margin-left: 0 } — no inversion rule, not extracted
- css: selector `.variantSegmented .Item` — descendant rule not under an enum class, not extracted
- css: selector `.variantSegmented .Item:not(:first-child)` — not extractable into anatomy, skipped by name
- css: selector `.variantSegmented [aria-pressed='true']` — not extractable into anatomy, skipped by name
- css: selector `.variantSegmented .Item-focused` — descendant rule not under an enum class, not extracted
- css: selector `.fullWidth .Item` — descendant rule not under an enum class, not extracted
- css: .extraTight { margin-top: calc(-1 * var(--p-space-100)) } — var() inside a shorthand is not invertible to a single binding, not extracted
- css: .extraTight { margin-left: calc(-1 * var(--p-space-100)) } — var() inside a shorthand is not invertible to a single binding, not extracted
- css: selector `.extraTight .Item` — descendant rule not under an enum class, not extracted
- css: .tight { margin-top: calc(-1 * var(--p-space-200)) } — var() inside a shorthand is not invertible to a single binding, not extracted
- css: .tight { margin-left: calc(-1 * var(--p-space-200)) } — var() inside a shorthand is not invertible to a single binding, not extracted
- css: selector `.tight .Item` — descendant rule not under an enum class, not extracted
- css: .loose { margin-top: calc(-1 * var(--p-space-500)) } — var() inside a shorthand is not invertible to a single binding, not extracted
- css: .loose { margin-left: calc(-1 * var(--p-space-500)) } — var() inside a shorthand is not invertible to a single binding, not extracted
- css: selector `.loose .Item` — descendant rule not under an enum class, not extracted
- css: .noWrap { flex-wrap: nowrap } — no inversion rule, not extracted
- css: class ".ButtonGroup" has declarations but no matching extracted JSX part — styles not attached, review by name
- css: class ".Item" has declarations but no matching extracted JSX part — styles not attached, review by name
- css: class ".Item-plain" has declarations but no matching extracted JSX part — styles not attached, review by name
- css: class ".variantSegmented" has declarations but no matching extracted JSX part — styles not attached, review by name
- css: class ".fullWidth" has declarations but no matching extracted JSX part — styles not attached, review by name
- css: class ".extraTight" has declarations but no matching extracted JSX part — styles not attached, review by name
- css: class ".tight" has declarations but no matching extracted JSX part — styles not attached, review by name
- css: class ".loose" has declarations but no matching extracted JSX part — styles not attached, review by name
- css: class ".noWrap" has declarations but no matching extracted JSX part — styles not attached, review by name

## CalloutCard

- source: `examples/polaris/.polaris-clone/polaris-react/src/components/CalloutCard/CalloutCard.tsx` (react-tsx)
- proposed: 1 props, 0 events
- anatomy EXTRACTED from JSX + CSS Module — 1 part(s), 0 token binding(s), 0 raw value(s) reported. Anatomy is human-REVIEWED: check it against design intent before adoption.
- prop `children`: platform prop — not contract API, skipped
- prop `title`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually
- prop `primaryAction`: unclassified type — not proposed, review manually
- prop `secondaryAction`: unclassified type — not proposed, review manually
- jsx: root element <LegacyCard> is a component — anatomy not extracted (wrapper components are review items)

## Card

- source: `examples/polaris/.polaris-clone/polaris-react/src/components/Card/Card.tsx` (react-tsx)
- proposed: 0 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- prop `children`: platform prop — not contract API, skipped
- prop `background`: unclassified type — not proposed, review manually
- prop `padding`: unclassified type — not proposed, review manually
- prop `roundedAbove`: unclassified type — not proposed, review manually

## Cell

- source: `examples/polaris/.polaris-clone/polaris-react/src/components/DataTable/components/Cell/Cell.tsx` (react-tsx)
- proposed: 18 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- prop `content`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually
- prop `sortDirection`: unclassified type — not proposed, review manually
- prop `defaultSortDirection`: unclassified type — not proposed, review manually
- prop `verticalAlign`: unclassified type — not proposed, review manually
- prop `setRef`: function-typed but not on* — skipped, review manually
- prop `handleFocus`: unclassified type — not proposed, review manually
- prop `style`: platform prop — not contract API, skipped

## CheckableButton

- source: `examples/polaris/.polaris-clone/polaris-react/src/components/CheckableButton/CheckableButton.tsx` (react-tsx)
- proposed: 4 props, 0 events
- anatomy EXTRACTED from JSX + CSS Module — 5 part(s), 3 token binding(s), 7 raw value(s) reported. Anatomy is human-REVIEWED: check it against design intent before adoption.
- prop `selected`: unclassified type — not proposed, review manually
- prop `ariaLive`: figma binding INFERRED as VARIANT "Aria Live" — confirm against the design library (reconcile step)
- anatomy: component ref `<Checkbox>` mapped to contract id `polaris.checkbox` — confirm that contract exists (or adjust the id) before adoption
- anatomy: component ref `<Text>` mapped to contract id `polaris.text` — confirm that contract exists (or adjust the id) before adoption
- RAW VALUE (not tokenized): `.CheckableButton { width: auto }` — nearest tokens by value: `{p.z-index-0}`. A raw value is reported, never turned into an invented token; bind it to a real token and re-extract.
- RAW VALUE (not tokenized): `.CheckableButton { min-height: auto }` — nearest tokens by value: `{p.z-index-0}`. A raw value is reported, never turned into an invented token; bind it to a real token and re-extract.
- RAW VALUE (not tokenized): `.CheckableButton { height: 100% }` — no token in the tree has this value. A raw value is reported, never turned into an invented token; bind it to a real token and re-extract.
- RAW VALUE (not tokenized): `.CheckableButton:hover { background: transparent }` — no token in the tree has this value. A raw value is reported, never turned into an invented token; bind it to a real token and re-extract.
- RAW VALUE (not tokenized): `.CheckableButton:active { background: transparent }` — no token in the tree has this value. A raw value is reported, never turned into an invented token; bind it to a real token and re-extract.
- RAW VALUE (not tokenized): `.Label { max-width: 100% }` — no token in the tree has this value. A raw value is reported, never turned into an invented token; bind it to a real token and re-extract.
- RAW VALUE (not tokenized): `.Label { padding-inline: 0 }` — no token in the tree has this value. A raw value is reported, never turned into an invented token; bind it to a real token and re-extract.
- jsx: root class ".CheckableButton" extracted as the contract root part (contract roots are named "root")
- jsx: <Checkbox> prop onChange={…} — expression not extractable on a component ref, skipped
- jsx: <Checkbox> prop ref={…} — expression not extractable on a component ref, skipped
- jsx: <Text> has non-text children — component-ref content not extracted
- css: .CheckableButton { gap: calc(var(--p-space-300) + var(--p-space-025)) } — var() inside a shorthand is not invertible to a single binding, not extracted
- css: .CheckableButton { user-select: none } — no inversion rule, not extracted
- css: .CheckableButton { text-decoration: none } — no inversion rule, not extracted
- css: .CheckableButton { text-align: left } — no inversion rule, not extracted
- css: .CheckableButton { min-width: auto } — no inversion rule, not extracted
- css: selector `.CheckableButton svg` — icon glyph sizing, not extracted (icon parts are review items)
- css: selector `.CheckableButton:focus` — pseudo ":focus" is not a contract state, not extracted
- css: .Checkbox { pointer-events: none } — no inversion rule, not extracted
- css: .Label { flex: 1 } — no inversion rule, not extracted
- css: .Label { white-space: nowrap } — no inversion rule, not extracted
- css: .Label { overflow: hidden } — no inversion rule, not extracted
- css: .Label { text-overflow: ellipsis } — no inversion rule, not extracted

## Checkbox

- source: `examples/polaris/.polaris-clone/polaris-react/src/components/Checkbox/Checkbox.tsx` (react-tsx)
- proposed: 7 props, 0 events
- anatomy EXTRACTED from JSX + CSS Module — 1 part(s), 0 token binding(s), 0 raw value(s) reported. Anatomy is human-REVIEWED: check it against design intent before adoption.
- prop `label`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually
- prop `checked`: unclassified type — not proposed, review manually
- prop `id`: platform prop — not contract API, skipped
- prop `fill`: unclassified type — not proposed, review manually
- prop `helpText`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually
- prop `error`: unclassified type — not proposed, review manually
- prop `tone`: unclassified type — not proposed, review manually
- jsx: root element <Choice> is a component — anatomy not extracted (wrapper components are review items)

## CheckboxWrapper

- source: `examples/polaris/.polaris-clone/polaris-react/src/components/IndexTable/components/Checkbox/Checkbox.tsx` (react-tsx)
- proposed: 0 props, 0 events
- anatomy EXTRACTED from JSX + CSS Module — 1 part(s), 0 token binding(s), 0 raw value(s) reported. Anatomy is human-REVIEWED: check it against design intent before adoption.
- prop `children`: platform prop — not contract API, skipped
- semantics.element: extracted root element "td" is outside the contract element vocabulary — defaulted to "div", review
- jsx: root className checkboxClassName is not a CSS-module reference — parts under it are still read where legible
- jsx: root renders {children} directly — children channel (text prop vs default slot) is not decidable from code
- css: class ".Wrapper" has declarations but no matching extracted JSX part — styles not attached, review by name

## Choice

- source: `examples/polaris/.polaris-clone/polaris-react/src/components/Choice/Choice.tsx` (react-tsx)
- proposed: 3 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- prop `id`: platform prop — not contract API, skipped
- prop `label`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually
- prop `children`: platform prop — not contract API, skipped
- prop `fill`: unclassified type — not proposed, review manually
- prop `error`: unclassified type — not proposed, review manually
- prop `helpText`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually
- prop `tone`: unclassified type — not proposed, review manually

## ChoiceList

- source: `examples/polaris/.polaris-clone/polaris-react/src/components/ChoiceList/ChoiceList.tsx` (react-tsx)
- proposed: 4 props, 0 events
- anatomy EXTRACTED from JSX + CSS Module — 1 part(s), 0 token binding(s), 0 raw value(s) reported. Anatomy is human-REVIEWED: check it against design intent before adoption.
- prop `title`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually
- prop `choices`: unclassified type — not proposed, review manually
- prop `selected`: unclassified type — not proposed, review manually
- prop `error`: unclassified type — not proposed, review manually
- prop `tone`: unclassified type — not proposed, review manually
- jsx: root element <BlockStack> is a component — anatomy not extracted (wrapper components are review items)

## CloseButton

- source: `examples/polaris/.polaris-clone/polaris-react/src/components/Modal/components/CloseButton/CloseButton.tsx` (react-tsx)
- proposed: 1 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element

## Collapsible

- source: `examples/polaris/.polaris-clone/polaris-react/src/components/Collapsible/Collapsible.tsx` (react-tsx)
- proposed: 3 props, 0 events
- anatomy EXTRACTED from JSX + CSS Module — 1 part(s), 0 token binding(s), 0 raw value(s) reported. Anatomy is human-REVIEWED: check it against design intent before adoption.
- prop `id`: platform prop — not contract API, skipped
- prop `variant`: figma binding INFERRED as VARIANT "Variant" — confirm against the design library (reconcile step)
- prop `transition`: unclassified type — not proposed, review manually
- prop `children`: platform prop — not contract API, skipped
- jsx: root className wrapperClassName is not a CSS-module reference — parts under it are still read where legible
- jsx: <div> attribute id={…} — expression not extractable, skipped
- jsx: <div> handler "onTransitionEnd" — only onClick/onChange trigger wiring is extracted
- jsx: part "root" renders {content} — not a known text/node prop, not extracted
- css: at-rule `@media print` skipped — not extractable into anatomy
- css: .Collapsible { padding-top: 0 } — no inversion rule, not extracted
- css: .Collapsible { padding-bottom: 0 } — no inversion rule, not extracted
- css: .Collapsible { max-height: 0 } — no inversion rule, not extracted
- css: .Collapsible { overflow: hidden } — no inversion rule, not extracted
- css: .Collapsible { transition-property: max-height } — no inversion rule, not extracted
- css: .isFullyClosed { display: none } — no inversion rule, not extracted
- css: .inline { max-height: none } — no inversion rule, not extracted
- css: .inline { transition-property: max-width } — no inversion rule, not extracted
- css: selector `.inline.animateIn` — not extractable into anatomy, skipped by name
- css: class ".Collapsible" has declarations but no matching extracted JSX part — styles not attached, review by name
- css: class ".isFullyClosed" has declarations but no matching extracted JSX part — styles not attached, review by name
- css: class ".expandOnPrint" has declarations but no matching extracted JSX part — styles not attached, review by name
- css: class ".inline" has declarations but no matching extracted JSX part — styles not attached, review by name

## Combobox

- source: `examples/polaris/.polaris-clone/polaris-react/src/components/Combobox/Combobox.tsx` (react-tsx)
- proposed: 5 props, 0 events
- anatomy EXTRACTED from JSX + CSS Module — 1 part(s), 0 token binding(s), 0 raw value(s) reported. Anatomy is human-REVIEWED: check it against design intent before adoption.
- prop `activator`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually
- prop `children`: platform prop — not contract API, skipped
- prop `preferredPosition`: unclassified type — not proposed, review manually
- jsx: root element <Popover> is a component — anatomy not extracted (wrapper components are review items)

## Connected

- source: `examples/polaris/.polaris-clone/polaris-react/src/components/Connected/Connected.tsx` (react-tsx)
- proposed: 0 props, 0 events
- anatomy EXTRACTED from JSX + CSS Module — 2 part(s), 0 token binding(s), 0 raw value(s) reported. Anatomy is human-REVIEWED: check it against design intent before adoption.
- prop `left`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually
- prop `right`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually
- prop `children`: platform prop — not contract API, skipped
- anatomy: component ref `<Item>` mapped to contract id `polaris.item` — confirm that contract exists (or adjust the id) before adoption
- jsx: root class ".Connected" extracted as the contract root part (contract roots are named "root")
- jsx: part "root" renders {leftConnectionMarkup} — not a known text/node prop, not extracted
- jsx: <Item> has non-text children — component-ref content not extracted
- jsx: part "root" renders {rightConnectionMarkup} — not a known text/node prop, not extracted
- css: .Connected { --pc-connected-item: 10 } — no inversion rule, not extracted
- css: .Connected { --pc-connected-primary: 20 } — no inversion rule, not extracted
- css: .Connected { --pc-connected-focused: 30 } — no inversion rule, not extracted
- css: .Item { z-index } uses var(--pc-connected-item) which resolves to NO token in the token tree — binding not proposed
- css: .Item { flex: 0 0 auto } — no inversion rule, not extracted
- css: selector `.Item:not(:first-child)` — pseudo ":not(:first-child)" is not a contract state, not extracted
- css: .Item-primary { z-index } uses var(--pc-connected-primary) which resolves to NO token in the token tree — binding not proposed
- css: .Item-focused { z-index } uses var(--pc-connected-focused) which resolves to NO token in the token tree — binding not proposed
- css: class ".Item" has declarations but no matching extracted JSX part — styles not attached, review by name
- css: class ".Item-primary" has declarations but no matching extracted JSX part — styles not attached, review by name
- css: class ".Item-focused" has declarations but no matching extracted JSX part — styles not attached, review by name

## Container

- source: `examples/polaris/.polaris-clone/polaris-react/src/components/IndexFilters/components/Container/Container.tsx` (react-tsx)
- proposed: 0 props, 0 events
- anatomy EXTRACTED from JSX + CSS Module — 1 part(s), 3 token binding(s), 0 raw value(s) reported. Anatomy is human-REVIEWED: check it against design intent before adoption.
- prop `children`: platform prop — not contract API, skipped
- jsx: root class ".Container" extracted as the contract root part (contract roots are named "root")
- jsx: root renders {children} directly — children channel (text prop vs default slot) is not decidable from code
- css: at-rule `@media (--p-breakpoints-sm-down)` skipped — not extractable into anatomy
- css: .Container { border-bottom: var(--p-border-width-025) solid var(--p-color-border) } — var() inside a shorthand is not invertible to a single binding, not extracted

## ContextualSaveBar

- source: `examples/polaris/.polaris-clone/polaris-react/src/components/ContextualSaveBar/ContextualSaveBar.tsx` (react-tsx)
- proposed: 0 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- props type has NO OWN members (extends ContextualSaveBarProps1 — parent members are outside single-file extraction): zero own props is what this module declares — review

## CreateViewModal

- source: `examples/polaris/.polaris-clone/polaris-react/src/components/Tabs/components/CreateViewModal/CreateViewModal.tsx` (react-tsx)
- proposed: 1 props, 3 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- event `onClose`: declared with trigger 'root' — assign the real trigger part once anatomy is authored
- event `onClickPrimaryAction`: declared with trigger 'root' — assign the real trigger part once anatomy is authored
- event `onClickSecondaryAction`: declared with trigger 'root' — assign the real trigger part once anatomy is authored
- prop `activator`: unclassified type — not proposed, review manually
- prop `viewNames`: unclassified type — not proposed, review manually

## CSSAnimation

- source: `examples/polaris/.polaris-clone/polaris-react/src/components/Frame/components/CSSAnimation/CSSAnimation.tsx` (react-tsx)
- proposed: 1 props, 0 events
- anatomy EXTRACTED from JSX + CSS Module — 1 part(s), 0 token binding(s), 0 raw value(s) reported. Anatomy is human-REVIEWED: check it against design intent before adoption.
- prop `className`: platform prop — not contract API, skipped
- prop `type`: unclassified type — not proposed, review manually
- prop `children`: platform prop — not contract API, skipped
- jsx: root className wrapperClassName is not a CSS-module reference — parts under it are still read where legible
- jsx: <div> handler "onTransitionEnd" — only onClick/onChange trigger wiring is extracted
- jsx: part "root" renders {content} — not a known text/node prop, not extracted
- css: .startFade { opacity: 0 } — no inversion rule, not extracted
- css: .startFade { will-change: opacity } — no inversion rule, not extracted
- css: .startFade { transition: opacity var(--p-motion-duration-300) var(--p-motion-ease-out) } — var() inside a shorthand is not invertible to a single binding, not extracted
- css: .startFade { pointer-events: none } — no inversion rule, not extracted
- css: .endFade { opacity: 1 } — no inversion rule, not extracted
- css: .endFade { pointer-events: auto } — no inversion rule, not extracted
- css: class ".startFade" has declarations but no matching extracted JSX part — styles not attached, review by name
- css: class ".endFade" has declarations but no matching extracted JSX part — styles not attached, review by name

## DataTable

- source: `examples/polaris/.polaris-clone/polaris-react/src/components/DataTable/DataTable.tsx` (react-tsx)
- proposed: 11 props, 0 events
- anatomy EXTRACTED from JSX + CSS Module — 1 part(s), 0 token binding(s), 0 raw value(s) reported. Anatomy is human-REVIEWED: check it against design intent before adoption.
- prop `columnContentTypes`: unclassified type — not proposed, review manually
- prop `headings`: unclassified type — not proposed, review manually
- prop `totals`: unclassified type — not proposed, review manually
- prop `totalsName`: unclassified type — not proposed, review manually
- prop `rows`: unclassified type — not proposed, review manually
- prop `verticalAlign`: unclassified type — not proposed, review manually
- prop `footerContent`: unclassified type — not proposed, review manually
- prop `sortable`: unclassified type — not proposed, review manually
- prop `defaultSortDirection`: unclassified type — not proposed, review manually
- prop `pagination`: unclassified type — not proposed, review manually
- jsx: root element <DataTableInner> is a component — anatomy not extracted (wrapper components are review items)

## DatePicker

- source: `examples/polaris/.polaris-clone/polaris-react/src/components/DatePicker/DatePicker.tsx` (react-tsx)
- proposed: 6 props, 0 events
- anatomy EXTRACTED from JSX + CSS Module — 6 part(s), 0 token binding(s), 13 raw value(s) reported. Anatomy is human-REVIEWED: check it against design intent before adoption.
- prop `id`: platform prop — not contract API, skipped
- prop `selected`: unclassified type — not proposed, review manually
- prop `disableDatesBefore`: unclassified type — not proposed, review manually
- prop `disableDatesAfter`: unclassified type — not proposed, review manually
- prop `disableSpecificDates`: unclassified type — not proposed, review manually
- anatomy: component ref `<Button>` mapped to contract id `polaris.button` — confirm that contract exists (or adjust the id) before adoption
- anatomy: component ref `<Button>` mapped to contract id `polaris.button` — confirm that contract exists (or adjust the id) before adoption
- anatomy: component ref `<Month>` mapped to contract id `polaris.month` — confirm that contract exists (or adjust the id) before adoption
- RAW VALUE (not tokenized): `.MonthContainer { min-width: 230px }` — no token in the tree has this value. A raw value is reported, never turned into an invented token; bind it to a real token and re-extract.
- RAW VALUE (not tokenized): `.Month { width: 100% }` — no token in the tree has this value. A raw value is reported, never turned into an invented token; bind it to a real token and re-extract.
- RAW VALUE (not tokenized): `.DayCell { width: calc(100% / 7) }` — no token in the tree has this value. A raw value is reported, never turned into an invented token; bind it to a real token and re-extract.
- RAW VALUE (not tokenized): `.DayCell { background: transparent }` — no token in the tree has this value. A raw value is reported, never turned into an invented token; bind it to a real token and re-extract.
- RAW VALUE (not tokenized): `.DayCell-inRange { border-radius: 0 }` — no token in the tree has this value. A raw value is reported, never turned into an invented token; bind it to a real token and re-extract.
- RAW VALUE (not tokenized): `.Day { height: 100% }` — no token in the tree has this value. A raw value is reported, never turned into an invented token; bind it to a real token and re-extract.
- RAW VALUE (not tokenized): `.Day { width: 100% }` — no token in the tree has this value. A raw value is reported, never turned into an invented token; bind it to a real token and re-extract.
- RAW VALUE (not tokenized): `.Day { background: transparent }` — no token in the tree has this value. A raw value is reported, never turned into an invented token; bind it to a real token and re-extract.
- RAW VALUE (not tokenized): `.Day-inRange { border-radius: 0 }` — no token in the tree has this value. A raw value is reported, never turned into an invented token; bind it to a real token and re-extract.
- RAW VALUE (not tokenized): `.Day-disabled { background-color: transparent }` — no token in the tree has this value. A raw value is reported, never turned into an invented token; bind it to a real token and re-extract.
- RAW VALUE (not tokenized): `.EmptyDayCell { width: calc(100% / 7) }` — no token in the tree has this value. A raw value is reported, never turned into an invented token; bind it to a real token and re-extract.
- RAW VALUE (not tokenized): `.Weekday { background: transparent }` — no token in the tree has this value. A raw value is reported, never turned into an invented token; bind it to a real token and re-extract.
- RAW VALUE (not tokenized): `.Header { width: 100% }` — no token in the tree has this value. A raw value is reported, never turned into an invented token; bind it to a real token and re-extract.
- jsx: root className datePickerClassName is not a CSS-module reference — parts under it are still read where legible
- jsx: <div> attribute id={…} — expression not extractable, skipped
- jsx: <div> handler "onKeyDown" — only onClick/onChange trigger wiring is extracted
- jsx: <div> handler "onKeyUp" — only onClick/onChange trigger wiring is extracted
- jsx: <Button> prop icon={…} — expression not extractable on a component ref, skipped
- jsx: <Button> prop accessibilityLabel={…} — expression not extractable on a component ref, skipped
- jsx: <Button> prop onClick={…} — expression not extractable on a component ref, skipped
- jsx: <Button> prop icon={…} — expression not extractable on a component ref, skipped
- jsx: <Button> prop accessibilityLabel={…} — expression not extractable on a component ref, skipped
- jsx: <Button> prop onClick={…} — expression not extractable on a component ref, skipped
- jsx: duplicate part class "button" — second occurrence extracted as "button2" (review: part names must be unique)
- jsx: <Month> prop onFocus={…} — expression not extractable on a component ref, skipped
- jsx: <Month> prop focusedDate={…} — expression not extractable on a component ref, skipped
- jsx: <Month> prop selected={…} — expression not extractable on a component ref, skipped
- jsx: <Month> prop hoverDate={…} — expression not extractable on a component ref, skipped
- jsx: <Month> prop onChange={…} — expression not extractable on a component ref, skipped
- jsx: <Month> prop onHover={…} — expression not extractable on a component ref, skipped
- jsx: <Month> prop accessibilityLabelPrefixes={…} — expression not extractable on a component ref, skipped
- jsx: part "monthLayout" renders {secondDatePicker} — not a known text/node prop, not extracted
- css: at-rule `@media (-ms-high-contrast: active)` skipped — not extractable into anatomy
- css: at-rule `@media (-ms-high-contrast: active)` skipped — not extractable into anatomy
- css: at-rule `@media (-ms-high-contrast)` skipped — not extractable into anatomy
- css: .MonthLayout { flex-wrap: wrap } — no inversion rule, not extracted
- css: .MonthLayout { margin-top: calc(-1 * var(--p-space-400)) } — var() inside a shorthand is not invertible to a single binding, not extracted
- css: .MonthLayout { margin-left: calc(-1 * var(--p-space-400)) } — var() inside a shorthand is not invertible to a single binding, not extracted
- css: .MonthContainer { flex: 1 1 230px } — no inversion rule, not extracted
- css: .MonthContainer { max-width: calc(100% - var(--p-space-400)) } — var() inside a shorthand is not invertible to a single binding, not extracted
- css: .Month { table-layout: fixed } — no inversion rule, not extracted
- css: .Month { border-collapse: collapse } — no inversion rule, not extracted
- css: .Month { border-spacing: 0 } — no inversion rule, not extracted
- css: .Day { display: block } — no inversion rule, not extracted
- css: .Day { outline: none } — no inversion rule, not extracted
- css: selector `.Day:hover` — part-scoped state pseudo; the contract vocabulary carries part-level states (Part.states, v13 — as `.root:hover .part` descendant rules) but CSS inversion of this shape is not implemented; declare it on the contract directly, review
- css: selector `.Day:focus-visible:not(:active)` — part-scoped state pseudo; the contract vocabulary carries part-level states (Part.states, v13 — as `.root:focus-visible:not(:active) .part` descendant rules) but CSS inversion of this shape is not implemented; declare it on the contract directly, review
- css: selector `.Day-disabled:hover` — part-scoped state pseudo; the contract vocabulary carries part-level states (Part.states, v13 — as `.root:hover .part` descendant rules) but CSS inversion of this shape is not implemented; declare it on the contract directly, review
- css: selector `.Day-disabled:focus` — pseudo ":focus" is not a contract state, not extracted
- css: .Header position:absolute with insets (top:var(--p-space-400);bottom:;left:;right:) — not a generator overlay placement, not extracted
- css: selector `.Day-firstInRange.Day-hasRange` — not extractable into anatomy, skipped by name
- css: selector `.Day-firstInRange.Day-hoverRight` — not extractable into anatomy, skipped by name
- css: selector `.Day-firstInRange.Day-hasRange::after` — not extractable into anatomy, skipped by name
- css: selector `.Day-firstInRange.Day-hoverRight::after` — not extractable into anatomy, skipped by name
- css: .Day-lastInRange { border-radius: 0 var(--pc-date-picker-range-end-border-radius) var(--pc-date-picker-range-end-border-radius) 0 } — var() inside a shorthand is not invertible to a single binding, not extracted
- css: selector `.Day-lastInRange::after` — not extractable into anatomy, skipped by name
- css: selector `.Week > .Day-inRange:first-child:not(.Day-firstInRange):not(.Day-lastInRange)` — not extractable into anatomy, skipped by name
- css: selector `.Week > .Day-inRange:last-child:not(.Day-firstInRange):not(.Day-lastInRange)` — not extractable into anatomy, skipped by name
- css: selector `.Day-inRange:not(:hover) + .Day` — not extractable into anatomy, skipped by name
- css: selector `.Day-inRange::after` — not extractable into anatomy, skipped by name
- css: selector `.Day-inRange:not(:hover) + .Day::after` — not extractable into anatomy, skipped by name
- css: class ".DatePicker" has declarations but no matching extracted JSX part — styles not attached, review by name
- css: class ".MonthContainer" has declarations but no matching extracted JSX part — styles not attached, review by name
- css: class ".Month" has declarations but no matching extracted JSX part — styles not attached, review by name
- css: class ".DayCell" has declarations but no matching extracted JSX part — styles not attached, review by name
- css: class ".DayCell-inRange" has declarations but no matching extracted JSX part — styles not attached, review by name
- css: class ".Day" has declarations but no matching extracted JSX part — styles not attached, review by name
- css: class ".Day-inRange" has declarations but no matching extracted JSX part — styles not attached, review by name
- css: class ".Day-selected" has declarations but no matching extracted JSX part — styles not attached, review by name
- css: class ".Day-disabled" has declarations but no matching extracted JSX part — styles not attached, review by name
- css: class ".EmptyDayCell" has declarations but no matching extracted JSX part — styles not attached, review by name
- css: class ".Weekday" has declarations but no matching extracted JSX part — styles not attached, review by name
- css: class ".Title" has declarations but no matching extracted JSX part — styles not attached, review by name
- css: class ".Day-firstInRange" has declarations but no matching extracted JSX part — styles not attached, review by name
- css: class ".Day-lastInRange" has declarations but no matching extracted JSX part — styles not attached, review by name
- css: class ".Week" has declarations but no matching extracted JSX part — styles not attached, review by name

## Day

- source: `examples/polaris/.polaris-clone/polaris-react/src/components/DatePicker/components/Day/Day.tsx` (react-tsx)
- proposed: 11 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- prop `day`: unclassified type — not proposed, review manually
- prop `lastDayOfMonth`: unclassified type — not proposed, review manually

## DescriptionList

- source: `examples/polaris/.polaris-clone/polaris-react/src/components/DescriptionList/DescriptionList.tsx` (react-tsx)
- proposed: 1 props, 0 events
- anatomy EXTRACTED from JSX + CSS Module — 1 part(s), 0 token binding(s), 0 raw value(s) reported. Anatomy is human-REVIEWED: check it against design intent before adoption.
- prop `items`: unclassified type — not proposed, review manually
- prop `gap`: figma binding INFERRED as VARIANT "Gap" — confirm against the design library (reconcile step)
- semantics.element: extracted root element "dl" is outside the contract element vocabulary — defaulted to "div", review
- jsx: root className className is not a CSS-module reference — parts under it are still read where legible
- jsx: part "root" renders {terms} — not a known text/node prop, not extracted
- css: at-rule `@media (--p-breakpoints-sm-up)` skipped — not extractable into anatomy
- css: at-rule `@media (--p-breakpoints-sm-up)` skipped — not extractable into anatomy
- css: at-rule `@media (--p-breakpoints-sm-up)` skipped — not extractable into anatomy
- css: .DescriptionList { word-break: break-word } — no inversion rule, not extracted
- css: .Term { padding: var(--p-space-400) 0 var(--p-space-200) } — var() inside a shorthand is not invertible to a single binding, not extracted
- css: selector `.Term .spacingTight &` — not extractable into anatomy, skipped by name
- css: .Description { margin-left: 0 } — no inversion rule, not extracted
- css: .Description { padding: 0 0 var(--p-space-400) } — var() inside a shorthand is not invertible to a single binding, not extracted
- css: selector `.Description .spacingTight &` — not extractable into anatomy, skipped by name
- css: selector `.Description + .Term` — not extractable into anatomy, skipped by name
- css: class ".DescriptionList" has declarations but no matching extracted JSX part — styles not attached, review by name
- css: class ".Term" has declarations but no matching extracted JSX part — styles not attached, review by name
- css: class ".Description" has declarations but no matching extracted JSX part — styles not attached, review by name

## Dialog

- source: `examples/polaris/.polaris-clone/polaris-react/src/components/Modal/components/Dialog/Dialog.tsx` (react-tsx)
- proposed: 5 props, 0 events
- anatomy EXTRACTED from JSX + CSS Module — 1 part(s), 0 token binding(s), 0 raw value(s) reported. Anatomy is human-REVIEWED: check it against design intent before adoption.
- prop `children`: platform prop — not contract API, skipped
- prop `size`: unclassified type — not proposed, review manually
- prop `setClosing`: unclassified type — not proposed, review manually
- jsx: root element <TransitionChild> is a component — anatomy not extracted (wrapper components are review items)

## DirectionButton

- source: `examples/polaris/.polaris-clone/polaris-react/src/components/IndexFilters/components/SortButton/components/DirectionButton/DirectionButton.tsx` (react-tsx)
- proposed: 3 props, 1 events
- anatomy EXTRACTED from JSX + CSS Module — 1 part(s), 0 token binding(s), 0 raw value(s) reported. Anatomy is human-REVIEWED: check it against design intent before adoption.
- event `onClick`: declared with trigger 'root' — assign the real trigger part once anatomy is authored
- prop `children`: platform prop — not contract API, skipped
- prop `direction`: type resolved heuristically — review
- prop `direction`: figma binding INFERRED as VARIANT "Direction" — confirm against the design library (reconcile step)
- jsx: root element <UnstyledButton> is a component — anatomy not extracted (wrapper components are review items)

## DiscardConfirmationModal

- source: `examples/polaris/.polaris-clone/polaris-react/src/components/Frame/components/ContextualSaveBar/components/DiscardConfirmationModal/DiscardConfirmationModal.tsx` (react-tsx)
- proposed: 1 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element

## Divider

- source: `examples/polaris/.polaris-clone/polaris-react/src/components/Divider/Divider.tsx` (react-tsx)
- proposed: 0 props, 0 events
- anatomy EXTRACTED from JSX + CSS Module — 1 part(s), 0 token binding(s), 0 raw value(s) reported. Anatomy is human-REVIEWED: check it against design intent before adoption.
- prop `borderColor`: unclassified type — not proposed, review manually
- prop `borderWidth`: unclassified type — not proposed, review manually
- jsx: root class ".Divider" extracted as the contract root part (contract roots are named "root")

## DropZone

- source: `examples/polaris/.polaris-clone/polaris-react/src/components/DropZone/DropZone.tsx` (react-tsx)
- proposed: 14 props, 0 events
- anatomy EXTRACTED from JSX + CSS Module — 1 part(s), 0 token binding(s), 0 raw value(s) reported. Anatomy is human-REVIEWED: check it against design intent before adoption.
- prop `label`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually
- prop `labelAction`: unclassified type — not proposed, review manually
- prop `id`: platform prop — not contract API, skipped
- prop `type`: type resolved heuristically — review
- prop `type`: figma binding INFERRED as VARIANT "Type" — confirm against the design library (reconcile step)
- prop `children`: platform prop — not contract API, skipped
- jsx: root element <DropZoneContext.Provider> is a component — anatomy not extracted (wrapper components are review items)

## DuplicateModal

- source: `examples/polaris/.polaris-clone/polaris-react/src/components/Tabs/components/Tab/components/DuplicateModal/DuplicateModal.tsx` (react-tsx)
- proposed: 4 props, 3 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- prop `viewNames`: unclassified type — not proposed, review manually
- event `onClose`: declared with trigger 'root' — assign the real trigger part once anatomy is authored
- event `onClickPrimaryAction`: declared with trigger 'root' — assign the real trigger part once anatomy is authored
- event `onClickSecondaryAction`: declared with trigger 'root' — assign the real trigger part once anatomy is authored

## EditColumnsButton

- source: `examples/polaris/.polaris-clone/polaris-react/src/components/IndexFilters/components/EditColumnsButton/EditColumnsButton.tsx` (react-tsx)
- proposed: 1 props, 1 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- event `onClick`: declared with trigger 'root' — assign the real trigger part once anatomy is authored

## EmptySearchResult

- source: `examples/polaris/.polaris-clone/polaris-react/src/components/EmptySearchResult/EmptySearchResult.tsx` (react-tsx)
- proposed: 3 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element

## EmptyState

- source: `examples/polaris/.polaris-clone/polaris-react/src/components/EmptyState/EmptyState.tsx` (react-tsx)
- proposed: 5 props, 0 events
- anatomy EXTRACTED from JSX + CSS Module — 1 part(s), 0 token binding(s), 0 raw value(s) reported. Anatomy is human-REVIEWED: check it against design intent before adoption.
- prop `children`: platform prop — not contract API, skipped
- prop `action`: unclassified type — not proposed, review manually
- prop `secondaryAction`: unclassified type — not proposed, review manually
- prop `footerContent`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually
- jsx: root element <Box> is a component — anatomy not extracted (wrapper components are review items)

## EphemeralPresenceManager

- source: `examples/polaris/.polaris-clone/polaris-react/src/components/EphemeralPresenceManager/EphemeralPresenceManager.tsx` (react-tsx)
- proposed: 0 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- prop `children`: platform prop — not contract API, skipped

## ExceptionList

- source: `examples/polaris/.polaris-clone/polaris-react/src/components/ExceptionList/ExceptionList.tsx` (react-tsx)
- proposed: 0 props, 0 events
- anatomy EXTRACTED from JSX + CSS Module — 1 part(s), 0 token binding(s), 2 raw value(s) reported. Anatomy is human-REVIEWED: check it against design intent before adoption.
- prop `items`: unclassified type — not proposed, review manually
- RAW VALUE (not tokenized): `.Bullet { width: 6px }` — no token in the tree has this value. A raw value is reported, never turned into an invented token; bind it to a real token and re-extract.
- RAW VALUE (not tokenized): `.Bullet { height: 6px }` — no token in the tree has this value. A raw value is reported, never turned into an invented token; bind it to a real token and re-extract.
- jsx: root class ".ExceptionList" extracted as the contract root part (contract roots are named "root")
- jsx: part "root" renders {items} — not a known text/node prop, not extracted
- css: .ExceptionList { list-style: none } — no inversion rule, not extracted
- css: selector `.Item + .Item` — not extractable into anatomy, skipped by name
- css: .Icon position:absolute with insets (top:0;bottom:;left:0;right:) — not a generator overlay placement, not extracted
- css: selector `.Icon svg` — icon glyph sizing, not extracted (icon parts are review items)
- css: selector `.Icon .statusWarning & svg` — not extractable into anatomy, skipped by name
- css: selector `.Icon .statusCritical & svg` — not extractable into anatomy, skipped by name
- css: selector `.Bullet .statusWarning &` — not extractable into anatomy, skipped by name
- css: selector `.Bullet .statusCritical &` — not extractable into anatomy, skipped by name
- css: selector `.Title + .Description::before` — not extractable into anatomy, skipped by name
- css: selector `.Title .statusWarning &` — not extractable into anatomy, skipped by name
- css: selector `.Title .statusCritical &` — not extractable into anatomy, skipped by name
- css: selector `.Title .statusWarning &` — not extractable into anatomy, skipped by name
- css: selector `.Title .statusCritical &` — not extractable into anatomy, skipped by name
- css: class ".Item" has declarations but no matching extracted JSX part — styles not attached, review by name
- css: class ".Icon" has declarations but no matching extracted JSX part — styles not attached, review by name
- css: class ".Bullet" has declarations but no matching extracted JSX part — styles not attached, review by name
- css: class ".Title" has declarations but no matching extracted JSX part — styles not attached, review by name

## FileUpload

- source: `examples/polaris/.polaris-clone/polaris-react/src/components/DropZone/components/FileUpload/FileUpload.tsx` (react-tsx)
- proposed: 2 props, 0 events
- anatomy EXTRACTED from JSX + CSS Module — 1 part(s), 0 token binding(s), 1 raw value(s) reported. Anatomy is human-REVIEWED: check it against design intent before adoption.
- RAW VALUE (not tokenized): `.FileUpload { height: 100% }` — no token in the tree has this value. A raw value is reported, never turned into an invented token; bind it to a real token and re-extract.
- jsx: root className fileUploadClassName is not a CSS-module reference — parts under it are still read where legible
- jsx: part "root" renders {viewMarkup} — not a known text/node prop, not extracted
- css: .FileUpload { text-align: center } — no inversion rule, not extracted
- css: selector `.FileUpload img` — not extractable into anatomy, skipped by name
- css: .ActionTitle { text-decoration: none } — no inversion rule, not extracted
- css: selector `.ActionTitle:not(.ActionTitle-disabled)` — pseudo ":not(.ActionTitle-disabled)" is not a contract state, not extracted
- css: selector `.ActionTitle:not(.ActionTitle-disabled):hover` — pseudo ":not(.ActionTitle-disabled):hover" is not a contract state, not extracted
- css: selector `.ActionTitle:not(.ActionTitle-disabled):active` — pseudo ":not(.ActionTitle-disabled):active" is not a contract state, not extracted
- css: .ActionTitle-focused { text-decoration: underline } — no inversion rule, not extracted
- css: selector `.UploadIcon.disabled` — not extractable into anatomy, skipped by name
- css: class ".FileUpload" has declarations but no matching extracted JSX part — styles not attached, review by name
- css: class ".large" has declarations but no matching extracted JSX part — styles not attached, review by name
- css: class ".small" has declarations but no matching extracted JSX part — styles not attached, review by name
- css: class ".ActionTitle" has declarations but no matching extracted JSX part — styles not attached, review by name
- css: class ".ActionTitle-focused" has declarations but no matching extracted JSX part — styles not attached, review by name
- css: class ".ActionTitle-disabled" has declarations but no matching extracted JSX part — styles not attached, review by name
- css: class ".UploadIcon" has declarations but no matching extracted JSX part — styles not attached, review by name

## FilterPill

- source: `examples/polaris/.polaris-clone/polaris-react/src/components/Filters/components/FilterPill/FilterPill.tsx` (react-tsx)
- proposed: 7 props, 0 events
- anatomy EXTRACTED from JSX + CSS Module — 2 part(s), 0 token binding(s), 3 raw value(s) reported. Anatomy is human-REVIEWED: check it against design intent before adoption.
- anatomy: component ref `<Popover>` mapped to contract id `polaris.popover` — confirm that contract exists (or adjust the id) before adoption
- RAW VALUE (not tokenized): `.ToggleButton { height: 26px }` — no token in the tree has this value. A raw value is reported, never turned into an invented token; bind it to a real token and re-extract.
- RAW VALUE (not tokenized): `.PopoverWrapper { min-width: 185px }` — no token in the tree has this value. A raw value is reported, never turned into an invented token; bind it to a real token and re-extract.
- RAW VALUE (not tokenized): `.PopoverWrapper { max-width: 300px }` — no token in the tree has this value. A raw value is reported, never turned into an invented token; bind it to a real token and re-extract.
- jsx: <Popover> prop active={…} — expression not extractable on a component ref, skipped
- jsx: <Popover> prop activator={…} — expression not extractable on a component ref, skipped
- jsx: <Popover> prop onClose={…} — expression not extractable on a component ref, skipped
- jsx: <Popover> prop preventCloseOnChildOverlayClick={…} — expression not extractable on a component ref, skipped
- jsx: <Popover> has non-text children — component-ref content not extracted
- css: at-rule `@media (--p-breakpoints-md-up)` skipped — not extractable into anatomy
- css: at-rule `@media (--p-breakpoints-md-up)` skipped — not extractable into anatomy
- css: at-rule `@media (--p-breakpoints-md-up)` skipped — not extractable into anatomy
- css: at-rule `@media (--p-breakpoints-md-up)` skipped — not extractable into anatomy
- css: .FilterButton { border: var(--p-color-border) dashed var(--p-border-width-025) } — var() inside a shorthand is not invertible to a single binding, not extracted
- css: selector `.FilterButton.focusedFilterButton:focus-within:not(:active)` — not extractable into anatomy, skipped by name
- css: selector `.FilterButton:hover` — part-scoped state pseudo; the contract vocabulary carries part-level states (Part.states, v13 — as `.root:hover .part` descendant rules) but CSS inversion of this shape is not implemented; declare it on the contract directly, review
- css: selector `.FilterButton:focus` — pseudo ":focus" is not a contract state, not extracted
- css: selector `.FilterButton:active` — part-scoped state pseudo; the contract vocabulary carries part-level states (Part.states, v13 — as `.root:active .part` descendant rules) but CSS inversion of this shape is not implemented; declare it on the contract directly, review
- css: selector `.FilterButton:hover path` — not extractable into anatomy, skipped by name
- css: selector `.FilterButton:focus path` — not extractable into anatomy, skipped by name
- css: selector `.FilterButton:active path` — not extractable into anatomy, skipped by name
- css: selector `.FilterButton:hover` — part-scoped state pseudo; the contract vocabulary carries part-level states (Part.states, v13 — as `.root:hover .part` descendant rules) but CSS inversion of this shape is not implemented; declare it on the contract directly, review
- css: selector `.FilterButton:active` — part-scoped state pseudo; the contract vocabulary carries part-level states (Part.states, v13 — as `.root:active .part` descendant rules) but CSS inversion of this shape is not implemented; declare it on the contract directly, review
- css: selector `.FilterButton:hover` — part-scoped state pseudo; the contract vocabulary carries part-level states (Part.states, v13 — as `.root:hover .part` descendant rules) but CSS inversion of this shape is not implemented; declare it on the contract directly, review
- css: selector `.FilterButton:focus` — pseudo ":focus" is not a contract state, not extracted
- css: selector `.FilterButton:active` — part-scoped state pseudo; the contract vocabulary carries part-level states (Part.states, v13 — as `.root:active .part` descendant rules) but CSS inversion of this shape is not implemented; declare it on the contract directly, review
- css: selector `.FilterButton.ActiveFilterButton` — not extractable into anatomy, skipped by name
- css: selector `.FilterButton.ActiveFilterButton:active` — not extractable into anatomy, skipped by name
- css: selector `.FilterButton::after` — not extractable into anatomy, skipped by name
- css: .PlainButton { cursor: inherit } — no inversion rule, not extracted
- css: .PlainButton { outline: inherit } — no inversion rule, not extracted
- css: selector `.PlainButton path` — not extractable into anatomy, skipped by name
- css: selector `.PlainButton[aria-disabled='true']` — not extractable into anatomy, skipped by name
- css: selector `.PlainButton[aria-disabled='true'] path` — not extractable into anatomy, skipped by name
- css: .ToggleButton { padding: 0 var(--p-space-200) 0 var(--p-space-300) } — var() inside a shorthand is not invertible to a single binding, not extracted
- css: selector `.ActiveFilterButton .ToggleButton` — descendant rule not under an enum class, not extracted
- css: selector `.clearButton:focus-visible:not(:active)` — part-scoped state pseudo; the contract vocabulary carries part-level states (Part.states, v13 — as `.root:focus-visible:not(:active) .part` descendant rules) but CSS inversion of this shape is not implemented; declare it on the contract directly, review
- css: .PopoverWrapper { word-break: break-word } — no inversion rule, not extracted
- css: selector `.ClearButtonWrapper button` — not extractable into anatomy, skipped by name
- css: class ".FilterButton" has declarations but no matching extracted JSX part — styles not attached, review by name
- css: class ".PlainButton" has declarations but no matching extracted JSX part — styles not attached, review by name
- css: class ".ToggleButton" has declarations but no matching extracted JSX part — styles not attached, review by name
- css: class ".clearButton" has declarations but no matching extracted JSX part — styles not attached, review by name
- css: class ".IconWrapper" has declarations but no matching extracted JSX part — styles not attached, review by name
- css: class ".PopoverWrapper" has declarations but no matching extracted JSX part — styles not attached, review by name
- css: class ".ClearButtonWrapper" has declarations but no matching extracted JSX part — styles not attached, review by name

## Filters

- source: `examples/polaris/.polaris-clone/polaris-react/src/components/Filters/Filters.tsx` (react-tsx)
- proposed: 12 props, 6 events
- anatomy EXTRACTED from JSX + CSS Module — 1 part(s), 0 token binding(s), 2 raw value(s) reported. Anatomy is human-REVIEWED: check it against design intent before adoption.
- prop `filters`: unclassified type — not proposed, review manually
- prop `appliedFilters`: unclassified type — not proposed, review manually
- event `onQueryChange`: declared with trigger 'root' — assign the real trigger part once anatomy is authored
- event `onQueryClear`: declared with trigger 'root' — assign the real trigger part once anatomy is authored
- event `onClearAll`: declared with trigger 'root' — assign the real trigger part once anatomy is authored
- event `onQueryBlur`: declared with trigger 'root' — assign the real trigger part once anatomy is authored
- event `onQueryFocus`: declared with trigger 'root' — assign the real trigger part once anatomy is authored
- prop `children`: platform prop — not contract API, skipped
- prop `mountedState`: unclassified type — not proposed, review manually
- event `onAddFilterClick`: declared with trigger 'root' — assign the real trigger part once anatomy is authored
- RAW VALUE (not tokenized): `.FiltersWrapper { height: 53px }` — no token in the tree has this value. A raw value is reported, never turned into an invented token; bind it to a real token and re-extract.
- RAW VALUE (not tokenized): `.AddFilter { height: 28px }` — no token in the tree has this value. A raw value is reported, never turned into an invented token; bind it to a real token and re-extract.
- jsx: root className classNames(…) read — root class ".Filters"; boolean modifier class(es): .hideQueryField (hideQueryField)
- jsx: root class ".Filters" extracted as the contract root part (contract roots are named "root")
- jsx: part "root" renders {queryFieldMarkup} — not a known text/node prop, not extracted
- jsx: part "root" renders {filtersMarkup} — not a known text/node prop, not extracted
- css: at-rule `@media (--p-breakpoints-sm-down)` skipped — not extractable into anatomy
- css: at-rule `@media (--p-breakpoints-sm-down)` skipped — not extractable into anatomy
- css: at-rule `@media (--p-breakpoints-md-up)` skipped — not extractable into anatomy
- css: at-rule `@media (--p-breakpoints-md-up)` skipped — not extractable into anatomy
- css: at-rule `@media (--p-breakpoints-md-up)` skipped — not extractable into anatomy
- css: at-rule `@media (--p-breakpoints-md-up)` skipped — not extractable into anatomy
- css: at-rule `@media (--p-breakpoints-md-up)` skipped — not extractable into anatomy
- css: at-rule `@media (--p-breakpoints-md-down)` skipped — not extractable into anatomy
- css: at-rule `@media (--p-breakpoints-md-up)` skipped — not extractable into anatomy
- css: at-rule `@media (--p-breakpoints-md-down)` skipped — not extractable into anatomy
- css: .Container { z-index: 30 } — no inversion rule, not extracted
- css: .Container { border-bottom: var(--p-border-width-025) solid var(--p-color-border-secondary) } — var() inside a shorthand is not invertible to a single binding, not extracted
- css: .SearchField { flex: 1 } — no inversion rule, not extracted
- css: .FiltersWrapper { border-bottom: var(--p-border-width-025) solid var(--p-color-border-secondary) } — var() inside a shorthand is not invertible to a single binding, not extracted
- css: .FiltersWrapper { overflow: hidden } — no inversion rule, not extracted
- css: selector `.hideQueryField .FiltersWrapper` — descendant rule not under an enum class, not extracted
- css: .FiltersInner { overflow: auto } — no inversion rule, not extracted
- css: .FiltersInner { white-space: nowrap } — no inversion rule, not extracted
- css: .FiltersInner { padding: var(--p-space-300) var(--p-space-200) var(--p-space-500) } — var() inside a shorthand is not invertible to a single binding, not extracted
- css: selector `.hideQueryField .FiltersInner` — descendant rule not under an enum class, not extracted
- css: .AddFilter { border: var(--p-color-border) dashed var(--p-border-width-025) } — var() inside a shorthand is not invertible to a single binding, not extracted
- css: .AddFilter { padding: 0 var(--p-space-200) 0 var(--p-space-300) } — var() inside a shorthand is not invertible to a single binding, not extracted
- css: .AddFilter { outline: inherit } — no inversion rule, not extracted
- css: selector `.AddFilter path` — not extractable into anatomy, skipped by name
- css: selector `.AddFilter:hover` — part-scoped state pseudo; the contract vocabulary carries part-level states (Part.states, v13 — as `.root:hover .part` descendant rules) but CSS inversion of this shape is not implemented; declare it on the contract directly, review
- css: selector `.AddFilter:focus` — pseudo ":focus" is not a contract state, not extracted
- css: selector `.AddFilter:hover path` — not extractable into anatomy, skipped by name
- css: selector `.AddFilter:focus path` — not extractable into anatomy, skipped by name
- css: selector `.AddFilter:hover` — part-scoped state pseudo; the contract vocabulary carries part-level states (Part.states, v13 — as `.root:hover .part` descendant rules) but CSS inversion of this shape is not implemented; declare it on the contract directly, review
- css: selector `.AddFilter:focus` — pseudo ":focus" is not a contract state, not extracted
- css: selector `.AddFilter:active` — part-scoped state pseudo; the contract vocabulary carries part-level states (Part.states, v13 — as `.root:active .part` descendant rules) but CSS inversion of this shape is not implemented; declare it on the contract directly, review
- css: selector `.AddFilter[aria-disabled='true']` — not extractable into anatomy, skipped by name
- css: selector `.AddFilter[aria-disabled='true'] path` — not extractable into anatomy, skipped by name
- css: selector `.AddFilter:focus-visible:not(:active)` — part-scoped state pseudo; the contract vocabulary carries part-level states (Part.states, v13 — as `.root:focus-visible:not(:active) .part` descendant rules) but CSS inversion of this shape is not implemented; declare it on the contract directly, review
- css: selector `.AddFilter::after` — not extractable into anatomy, skipped by name
- css: selector `.AddFilter span` — not extractable into anatomy, skipped by name
- css: selector `.AddFilter svg` — icon glyph sizing, not extracted (icon parts are review items)
- css: .FiltersStickyArea { flex-wrap: nowrap } — no inversion rule, not extracted
- css: class ".Container" has declarations but no matching extracted JSX part — styles not attached, review by name
- css: class ".SearchField" has declarations but no matching extracted JSX part — styles not attached, review by name
- css: class ".FiltersWrapper" has declarations but no matching extracted JSX part — styles not attached, review by name
- css: class ".FiltersInner" has declarations but no matching extracted JSX part — styles not attached, review by name
- css: class ".AddFilter" has declarations but no matching extracted JSX part — styles not attached, review by name
- css: class ".FiltersStickyArea" has declarations but no matching extracted JSX part — styles not attached, review by name
- css: class ".ClearAll" has declarations but no matching extracted JSX part — styles not attached, review by name

## Focus

- source: `examples/polaris/.polaris-clone/polaris-react/src/components/Focus/Focus.tsx` (react-tsx)
- proposed: 1 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- prop `children`: platform prop — not contract API, skipped
- prop `root`: unclassified type — not proposed, review manually

## FocusManager

- source: `examples/polaris/.polaris-clone/polaris-react/src/components/FocusManager/FocusManager.tsx` (react-tsx)
- proposed: 0 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- prop `children`: platform prop — not contract API, skipped

## Footer

- source: `examples/polaris/.polaris-clone/polaris-react/src/components/Modal/components/Footer/Footer.tsx` (react-tsx)
- proposed: 0 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- prop `primaryAction`: unclassified type — not proposed, review manually
- prop `secondaryActions`: unclassified type — not proposed, review manually
- prop `children`: platform prop — not contract API, skipped

## FooterHelp

- source: `examples/polaris/.polaris-clone/polaris-react/src/components/FooterHelp/FooterHelp.tsx` (react-tsx)
- proposed: 1 props, 0 events
- anatomy EXTRACTED from JSX + CSS Module — 2 part(s), 1 token binding(s), 1 raw value(s) reported. Anatomy is human-REVIEWED: check it against design intent before adoption.
- prop `children`: platform prop — not contract API, skipped
- prop `align`: figma binding INFERRED as VARIANT "Align" — confirm against the design library (reconcile step)
- anatomy: component ref `<Text>` mapped to contract id `polaris.text` — confirm that contract exists (or adjust the id) before adoption
- RAW VALUE (not tokenized): `.FooterHelp { width: auto }` — nearest tokens by value: `{p.z-index-0}`. A raw value is reported, never turned into an invented token; bind it to a real token and re-extract.
- jsx: root class ".FooterHelp" extracted as the contract root part (contract roots are named "root")
- jsx: <Text> has non-text children — component-ref content not extracted
- css: .FooterHelp { justify-content } uses var(--pc-footer-help-align) which resolves to NO token in the token tree — binding not proposed

## Form

- source: `examples/polaris/.polaris-clone/polaris-react/src/components/Form/Form.tsx` (react-tsx)
- proposed: 9 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- prop `children`: platform prop — not contract API, skipped
- prop `encType`: type resolved heuristically — review
- prop `encType`: figma binding INFERRED as VARIANT "Enc Type" — confirm against the design library (reconcile step)
- prop `method`: type resolved heuristically — review
- prop `method`: figma binding INFERRED as VARIANT "Method" — confirm against the design library (reconcile step)
- prop `target`: unclassified type — not proposed, review manually

## FormLayout

- source: `examples/polaris/.polaris-clone/polaris-react/src/components/FormLayout/FormLayout.tsx` (react-tsx)
- proposed: 0 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- prop `children`: platform prop — not contract API, skipped

## Frame

- source: `examples/polaris/.polaris-clone/polaris-react/src/components/Frame/Frame.tsx` (react-tsx)
- proposed: 3 props, 0 events
- anatomy EXTRACTED from JSX + CSS Module — 1 part(s), 0 token binding(s), 0 raw value(s) reported. Anatomy is human-REVIEWED: check it against design intent before adoption.
- prop `logo`: unclassified type — not proposed, review manually
- prop `children`: platform prop — not contract API, skipped
- prop `topBar`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually
- prop `navigation`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually
- prop `globalRibbon`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually
- prop `skipToContentTarget`: unclassified type — not proposed, review manually
- jsx: root element <FrameInner> is a component — anatomy not extracted (wrapper components are review items)

## FullscreenBar

- source: `examples/polaris/.polaris-clone/polaris-react/src/components/FullscreenBar/FullscreenBar.tsx` (react-tsx)
- proposed: 0 props, 1 events
- anatomy EXTRACTED from JSX + CSS Module — 4 part(s), 6 token binding(s), 1 raw value(s) reported. Anatomy is human-REVIEWED: check it against design intent before adoption.
- event `onAction`: declared with trigger 'root' — assign the real trigger part once anatomy is authored
- prop `children`: platform prop — not contract API, skipped
- anatomy: component ref `<Icon>` mapped to contract id `polaris.icon` — confirm that contract exists (or adjust the id) before adoption
- RAW VALUE (not tokenized): `.BackAction { border-width: 0 }` — no token in the tree has this value. A raw value is reported, never turned into an invented token; bind it to a real token and re-extract.
- jsx: root class ".FullscreenBar" extracted as the contract root part (contract roots are named "root")
- jsx: <Icon> prop source={…} — expression not extractable on a component ref, skipped
- jsx: part "backAction" renders {backButtonMarkup} — not a known text/node prop, not extracted
- jsx: part "root" renders {children} between elements — extracted as an ordered slot part "children"
- css: .FullscreenBar { height } uses var(--pg-top-bar-height) which resolves to NO token in the token tree — binding not proposed
- css: .BackAction { flex: 0 1 auto } — no inversion rule, not extracted
- css: .BackAction { border-right: var(--p-border-width-025) solid var(--p-color-border-secondary) } — var() inside a shorthand is not invertible to a single binding, not extracted
- css: selector `.BackAction :first-child` — not extractable into anatomy, skipped by name

## Grid

- source: `examples/polaris/.polaris-clone/polaris-react/src/components/Grid/Grid.tsx` (react-tsx)
- proposed: 0 props, 0 events
- anatomy EXTRACTED from JSX + CSS Module — 1 part(s), 0 token binding(s), 0 raw value(s) reported. Anatomy is human-REVIEWED: check it against design intent before adoption.
- prop `areas`: unclassified type — not proposed, review manually
- prop `columns`: unclassified type — not proposed, review manually
- prop `gap`: unclassified type — not proposed, review manually
- prop `children`: platform prop — not contract API, skipped
- jsx: root class ".Grid" extracted as the contract root part (contract roots are named "root")
- jsx: root renders {children} directly — children channel (text prop vs default slot) is not decidable from code
- css: at-rule `@media (--p-breakpoints-sm-up)` skipped — not extractable into anatomy
- css: at-rule `@media (--p-breakpoints-md-up)` skipped — not extractable into anatomy
- css: at-rule `@media (--p-breakpoints-lg-up)` skipped — not extractable into anatomy
- css: at-rule `@media (--p-breakpoints-xl-up)` skipped — not extractable into anatomy
- css: .Grid { --pc-grid-areas-xs: initial } — no inversion rule, not extracted
- css: .Grid { --pc-grid-areas-sm } uses var(--pc-grid-areas-xs) which resolves to NO token in the token tree — binding not proposed
- css: .Grid { --pc-grid-areas-md } uses var(--pc-grid-areas-sm) which resolves to NO token in the token tree — binding not proposed
- css: .Grid { --pc-grid-areas-lg } uses var(--pc-grid-areas-md) which resolves to NO token in the token tree — binding not proposed
- css: .Grid { --pc-grid-areas-xl } uses var(--pc-grid-areas-lg) which resolves to NO token in the token tree — binding not proposed
- css: .Grid { --pc-grid-columns-xs: 6 } — no inversion rule, not extracted
- css: .Grid { --pc-grid-columns-sm } uses var(--pc-grid-columns-xs) which resolves to NO token in the token tree — binding not proposed
- css: .Grid { --pc-grid-columns-md } uses var(--pc-grid-columns-sm) which resolves to NO token in the token tree — binding not proposed
- css: .Grid { --pc-grid-columns-lg: 12 } — no inversion rule, not extracted
- css: .Grid { --pc-grid-columns-xl } uses var(--pc-grid-columns-lg) which resolves to NO token in the token tree — binding not proposed
- css: .Grid { display: grid } — no inversion rule, not extracted
- css: .Grid { gap: var(--pc-grid-gap-xs, var(--p-space-400)) } — var() inside a shorthand is not invertible to a single binding, not extracted
- css: .Grid { grid-template-areas } uses var(--pc-grid-areas-xs) which resolves to NO token in the token tree — binding not proposed
- css: .Grid { grid-template-columns: repeat(var(--pc-grid-columns-xs), minmax(0, 1fr)) } — var() inside a shorthand is not invertible to a single binding, not extracted

## Group

- source: `examples/polaris/.polaris-clone/polaris-react/src/components/FormLayout/components/Group/Group.tsx` (react-tsx)
- proposed: 2 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- prop `children`: platform prop — not contract API, skipped
- prop `helpText`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually

## Header

- source: `examples/polaris/.polaris-clone/polaris-react/src/components/LegacyCard/components/Header/Header.tsx` (react-tsx)
- proposed: 0 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- prop `title`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually
- prop `actions`: unclassified type — not proposed, review manually
- prop `children`: platform prop — not contract API, skipped

## Icon

- source: `examples/polaris/.polaris-clone/polaris-react/src/components/Icon/Icon.tsx` (react-tsx)
- proposed: 2 props, 0 events
- anatomy EXTRACTED from JSX + CSS Module — 2 part(s), 0 token binding(s), 12 raw value(s) reported. Anatomy is human-REVIEWED: check it against design intent before adoption.
- prop `source`: unclassified type — not proposed, review manually
- prop `tone`: type resolved heuristically — review
- prop `tone`: figma binding INFERRED as VARIANT "Tone" — confirm against the design library (reconcile step)
- anatomy: component ref `<Text>` mapped to contract id `polaris.text` — confirm that contract exists (or adjust the id) before adoption
- RAW VALUE (not tokenized): `.Icon { height: 20px }` — no token in the tree has this value. A raw value is reported, never turned into an invented token; bind it to a real token and re-extract.
- RAW VALUE (not tokenized): `.Icon { width: 20px }` — no token in the tree has this value. A raw value is reported, never turned into an invented token; bind it to a real token and re-extract.
- RAW VALUE (not tokenized): `.Icon { max-height: 100% }` — no token in the tree has this value. A raw value is reported, never turned into an invented token; bind it to a real token and re-extract.
- RAW VALUE (not tokenized): `.Icon { max-width: 100% }` — no token in the tree has this value. A raw value is reported, never turned into an invented token; bind it to a real token and re-extract.
- RAW VALUE (not tokenized): `.Icon { margin: auto }` — nearest tokens by value: `{p.z-index-0}`. A raw value is reported, never turned into an invented token; bind it to a real token and re-extract.
- RAW VALUE (not tokenized): `.Svg { width: 100% }` — no token in the tree has this value. A raw value is reported, never turned into an invented token; bind it to a real token and re-extract.
- RAW VALUE (not tokenized): `.Svg { max-width: 100% }` — no token in the tree has this value. A raw value is reported, never turned into an invented token; bind it to a real token and re-extract.
- RAW VALUE (not tokenized): `.Svg { max-height: 100% }` — no token in the tree has this value. A raw value is reported, never turned into an invented token; bind it to a real token and re-extract.
- RAW VALUE (not tokenized): `.Img { width: 100% }` — no token in the tree has this value. A raw value is reported, never turned into an invented token; bind it to a real token and re-extract.
- RAW VALUE (not tokenized): `.Img { max-width: 100% }` — no token in the tree has this value. A raw value is reported, never turned into an invented token; bind it to a real token and re-extract.
- RAW VALUE (not tokenized): `.Img { max-height: 100% }` — no token in the tree has this value. A raw value is reported, never turned into an invented token; bind it to a real token and re-extract.
- RAW VALUE (not tokenized): `.Placeholder { padding-bottom: 100% }` — no token in the tree has this value. A raw value is reported, never turned into an invented token; bind it to a real token and re-extract.
- jsx: root className className is not a CSS-module reference — parts under it are still read where legible
- jsx: <Text> has non-text children — component-ref content not extracted
- jsx: part "root" expression `contentMarkup[sourceType]` — not extractable, skipped by name
- css: .Icon { display: block } — no inversion rule, not extracted
- css: selector `.Icon svg` — icon glyph sizing, not extracted (icon parts are review items)
- css: selector `.toneInherit svg` — icon glyph sizing, not extracted (icon parts are review items)
- css: selector `.toneBase svg` — icon glyph sizing, not extracted (icon parts are review items)
- css: selector `.toneSubdued svg` — icon glyph sizing, not extracted (icon parts are review items)
- css: selector `.toneCaution svg` — icon glyph sizing, not extracted (icon parts are review items)
- css: selector `.toneWarning svg` — icon glyph sizing, not extracted (icon parts are review items)
- css: selector `.toneCritical svg` — icon glyph sizing, not extracted (icon parts are review items)
- css: selector `.toneInteractive svg` — icon glyph sizing, not extracted (icon parts are review items)
- css: selector `.toneInfo svg` — icon glyph sizing, not extracted (icon parts are review items)
- css: selector `.toneSuccess svg` — icon glyph sizing, not extracted (icon parts are review items)
- css: selector `.tonePrimary svg` — icon glyph sizing, not extracted (icon parts are review items)
- css: selector `.toneEmphasis svg` — icon glyph sizing, not extracted (icon parts are review items)
- css: selector `.toneMagic svg` — icon glyph sizing, not extracted (icon parts are review items)
- css: selector `.toneTextCaution svg` — icon glyph sizing, not extracted (icon parts are review items)
- css: selector `.toneTextWarning svg` — icon glyph sizing, not extracted (icon parts are review items)
- css: selector `.toneTextCritical svg` — icon glyph sizing, not extracted (icon parts are review items)
- css: selector `.toneTextInfo svg` — icon glyph sizing, not extracted (icon parts are review items)
- css: selector `.toneTextPrimary svg` — icon glyph sizing, not extracted (icon parts are review items)
- css: selector `.toneTextSuccess svg` — icon glyph sizing, not extracted (icon parts are review items)
- css: selector `.toneTextMagic svg` — icon glyph sizing, not extracted (icon parts are review items)
- css: .Svg { display: block } — no inversion rule, not extracted
- css: .Img { display: block } — no inversion rule, not extracted
- css: class ".Icon" has declarations but no matching extracted JSX part — styles not attached, review by name
- css: class ".Svg" has declarations but no matching extracted JSX part — styles not attached, review by name
- css: class ".Img" has declarations but no matching extracted JSX part — styles not attached, review by name
- css: class ".Placeholder" has declarations but no matching extracted JSX part — styles not attached, review by name

## Image

- source: `examples/polaris/.polaris-clone/polaris-react/src/components/Image/Image.tsx` (react-tsx)
- proposed: 3 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- prop `crossOrigin`: type resolved heuristically — review
- prop `crossOrigin`: figma binding INFERRED as VARIANT "Cross Origin" — confirm against the design library (reconcile step)
- prop `sourceSet`: unclassified type — not proposed, review manually
- prop `ref`: platform prop — not contract API, skipped

## IndexFilters

- source: `examples/polaris/.polaris-clone/polaris-react/src/components/IndexFilters/IndexFilters.tsx` (react-tsx)
- proposed: 12 props, 6 events
- anatomy EXTRACTED from JSX + CSS Module — 4 part(s), 0 token binding(s), 5 raw value(s) reported. Anatomy is human-REVIEWED: check it against design intent before adoption.
- prop `sortOptions`: unclassified type — not proposed, review manually
- prop `sortSelected`: unclassified type — not proposed, review manually
- event `onSort`: declared with trigger 'root' — assign the real trigger part once anatomy is authored
- event `onSortKeyChange`: declared with trigger 'root' — assign the real trigger part once anatomy is authored
- event `onSortDirectionChange`: declared with trigger 'root' — assign the real trigger part once anatomy is authored
- event `onAddFilterClick`: declared with trigger 'root' — assign the real trigger part once anatomy is authored
- prop `primaryAction`: unclassified type — not proposed, review manually
- prop `cancelAction`: unclassified type — not proposed, review manually
- event `onEditStart`: declared with trigger 'root' — assign the real trigger part once anatomy is authored
- prop `mode`: unclassified type — not proposed, review manually
- prop `setMode`: function-typed but not on* — skipped, review manually
- event `onCreateNewView`: declared with trigger 'root' — assign the real trigger part once anatomy is authored
- anatomy: component ref `<Transition>` mapped to contract id `polaris.transition` — confirm that contract exists (or adjust the id) before adoption
- anatomy: component ref `<Transition>` mapped to contract id `polaris.transition` — confirm that contract exists (or adjust the id) before adoption
- RAW VALUE (not tokenized): `.IndexFiltersWrapper { width: 100% }` — no token in the tree has this value. A raw value is reported, never turned into an invented token; bind it to a real token and re-extract.
- RAW VALUE (not tokenized): `.TabsWrapper { height: 44px }` — no token in the tree has this value. A raw value is reported, never turned into an invented token; bind it to a real token and re-extract.
- RAW VALUE (not tokenized): `.DesktopLoading { height: 20px }` — no token in the tree has this value. A raw value is reported, never turned into an invented token; bind it to a real token and re-extract.
- RAW VALUE (not tokenized): `.DesktopLoading { width: 20px }` — no token in the tree has this value. A raw value is reported, never turned into an invented token; bind it to a real token and re-extract.
- RAW VALUE (not tokenized): `.Spinner { width: 20px }` — no token in the tree has this value. A raw value is reported, never turned into an invented token; bind it to a real token and re-extract.
- jsx: root class ".IndexFiltersWrapper" extracted as the contract root part (contract roots are named "root")
- jsx: <div> without a CSS-module className — not extracted as a part
- jsx: <div> className classNames(…) — read as class "IndexFilters"; the other 2 argument(s) are modifiers, not extracted
- jsx: <Transition> prop nodeRef={…} — expression not extractable on a component ref, skipped
- jsx: <Transition> prop in={…} — expression not extractable on a component ref, skipped
- jsx: <Transition> prop timeout={…} — expression not extractable on a component ref, skipped
- jsx: <Transition> has non-text children — component-ref content not extracted
- jsx: <Transition> prop nodeRef={…} — expression not extractable on a component ref, skipped
- jsx: <Transition> prop in={…} — expression not extractable on a component ref, skipped
- jsx: <Transition> prop timeout={…} — expression not extractable on a component ref, skipped
- jsx: <Transition> has non-text children — component-ref content not extracted
- jsx: duplicate part class "transition" — second occurrence extracted as "transition2" (review: part names must be unique)
- css: at-rule `@media (--p-breakpoints-sm-up)` skipped — not extractable into anatomy
- css: at-rule `@media (--p-breakpoints-sm-down)` skipped — not extractable into anatomy
- css: at-rule `@media (--p-breakpoints-md-down)` skipped — not extractable into anatomy
- css: at-rule `@media (--p-breakpoints-md-down)` skipped — not extractable into anatomy
- css: .TabsWrapper { flex: 1 } — no inversion rule, not extracted
- css: .SmallScreenTabsWrapper { overflow: hidden } — no inversion rule, not extracted
- css: .SmallScreenTabsWrapper { padding: var(--p-space-100) var(--p-space-0) var(--p-space-200) var(--p-space-300) } — var() inside a shorthand is not invertible to a single binding, not extracted
- css: selector `.SmallScreenTabsWrapper.TabsWrapperLoading` — not extractable into anatomy, skipped by name
- css: .DesktopLoading { transform: translateY(-50%) } — no inversion rule, not extracted
- css: .DesktopLoading position:absolute with insets (top:50%;bottom:;left:;right:100%) — not a generator overlay placement, not extracted
- css: selector `.TabsLoading svg` — icon glyph sizing, not extracted (icon parts are review items)
- css: selector `.TabsWrapperLoading .TabsLoading` — descendant rule not under an enum class, not extracted
- css: selector `.TabsWrapperLoading .TabsLoading::before` — not extractable into anatomy, skipped by name
- css: selector `.ActionWrap svg` — icon glyph sizing, not extracted (icon parts are review items)
- css: .Spinner { transform: translateX(var(--p-space-100)) } — var() inside a shorthand is not invertible to a single binding, not extracted
- css: selector `.Spinner svg` — icon glyph sizing, not extracted (icon parts are review items)
- css: selector `.ButtonWrap button` — not extractable into anatomy, skipped by name
- css: selector `.ActionWrap button` — not extractable into anatomy, skipped by name
- css: class ".TabsWrapper" has declarations but no matching extracted JSX part — styles not attached, review by name
- css: class ".SmallScreenTabsWrapper" has declarations but no matching extracted JSX part — styles not attached, review by name
- css: class ".DesktopLoading" has declarations but no matching extracted JSX part — styles not attached, review by name
- css: class ".ActionWrap" has declarations but no matching extracted JSX part — styles not attached, review by name
- css: class ".Spinner" has declarations but no matching extracted JSX part — styles not attached, review by name
- css: class ".ButtonWrap" has declarations but no matching extracted JSX part — styles not attached, review by name

## IndexTable

- source: `examples/polaris/.polaris-clone/polaris-react/src/components/IndexTable/IndexTable.tsx` (react-tsx)
- proposed: 0 props, 0 events
- anatomy EXTRACTED from JSX + CSS Module — 1 part(s), 0 token binding(s), 0 raw value(s) reported. Anatomy is human-REVIEWED: check it against design intent before adoption.
- props type has NO OWN members (extends IndexTableBaseProps, IndexProviderProps — parent members are outside single-file extraction): zero own props is what this module declares — review
- jsx: component returns a Fragment — contract anatomy needs a single root element, anatomy not extracted

## IndexTableBase

- source: `examples/polaris/.polaris-clone/polaris-react/src/components/IndexTable/IndexTable.tsx` (react-tsx)
- proposed: 8 props, 0 events
- anatomy EXTRACTED from JSX + CSS Module — 1 part(s), 0 token binding(s), 0 raw value(s) reported. Anatomy is human-REVIEWED: check it against design intent before adoption.
- prop `headings`: unclassified type — not proposed, review manually
- prop `promotedBulkActions`: unclassified type — not proposed, review manually
- prop `bulkActions`: unclassified type — not proposed, review manually
- prop `children`: platform prop — not contract API, skipped
- prop `emptyState`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually
- prop `sort`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually
- prop `sortable`: unclassified type — not proposed, review manually
- prop `defaultSortDirection`: type resolved heuristically — review
- prop `defaultSortDirection`: figma binding INFERRED as VARIANT "Default Sort Direction" — confirm against the design library (reconcile step)
- prop `sortDirection`: type resolved heuristically — review
- prop `sortDirection`: figma binding INFERRED as VARIANT "Sort Direction" — confirm against the design library (reconcile step)
- prop `sortToggleLabels`: unclassified type — not proposed, review manually
- prop `pagination`: unclassified type — not proposed, review manually
- jsx: component returns a Fragment — contract anatomy needs a single root element, anatomy not extracted

## Indicator

- source: `examples/polaris/.polaris-clone/polaris-react/src/components/Indicator/Indicator.tsx` (react-tsx)
- proposed: 1 props, 0 events
- anatomy EXTRACTED from JSX + CSS Module — 1 part(s), 0 token binding(s), 1 raw value(s) reported. Anatomy is human-REVIEWED: check it against design intent before adoption.
- RAW VALUE (not tokenized): `.Indicator { --pc-indicator-size: 10px }` — no token in the tree has this value. A raw value is reported, never turned into an invented token; bind it to a real token and re-extract.
- jsx: root className className is not a CSS-module reference — parts under it are still read where legible
- css: .Indicator { --pc-indicator-base-position: calc(-1 * var(--p-space-100)) } — var() inside a shorthand is not invertible to a single binding, not extracted
- css: selector `.Indicator::before` — not extractable into anatomy, skipped by name
- css: selector `.Indicator::after` — not extractable into anatomy, skipped by name
- css: selector `.pulseIndicator::before` — not extractable into anatomy, skipped by name
- css: selector `.pulseIndicator::after` — not extractable into anatomy, skipped by name
- css: class ".Indicator" has declarations but no matching extracted JSX part — styles not attached, review by name

## InlineCode

- source: `examples/polaris/.polaris-clone/polaris-react/src/components/InlineCode/InlineCode.tsx` (react-tsx)
- proposed: 0 props, 0 events
- anatomy EXTRACTED from JSX + CSS Module — 1 part(s), 6 token binding(s), 1 raw value(s) reported. Anatomy is human-REVIEWED: check it against design intent before adoption.
- prop `children`: platform prop — not contract API, skipped
- RAW VALUE (not tokenized): `.Code { font-size: 0.85em }` — no token in the tree has this value. A raw value is reported, never turned into an invented token; bind it to a real token and re-extract.
- jsx: root class ".Code" extracted as the contract root part (contract roots are named "root")
- jsx: root renders {children} directly — children channel (text prop vs default slot) is not decidable from code

## InlineError

- source: `examples/polaris/.polaris-clone/polaris-react/src/components/InlineError/InlineError.tsx` (react-tsx)
- proposed: 1 props, 0 events
- anatomy EXTRACTED from JSX + CSS Module — 4 part(s), 6 token binding(s), 0 raw value(s) reported. Anatomy is human-REVIEWED: check it against design intent before adoption.
- prop `message`: unclassified type — not proposed, review manually
- anatomy: component ref `<Icon>` mapped to contract id `polaris.icon` — confirm that contract exists (or adjust the id) before adoption
- anatomy: component ref `<Text>` mapped to contract id `polaris.text` — confirm that contract exists (or adjust the id) before adoption
- jsx: root class ".InlineError" extracted as the contract root part (contract roots are named "root")
- jsx: <div> attribute id={…} — expression not extractable, skipped
- jsx: <Icon> prop source={…} — expression not extractable on a component ref, skipped
- jsx: <Text> has non-text children — component-ref content not extracted
- css: .Icon { margin-left: calc(-1 * var(--p-space-100)) } — var() inside a shorthand is not invertible to a single binding, not extracted
- css: selector `.Icon svg` — icon glyph sizing, not extracted (icon parts are review items)

## InlineGrid

- source: `examples/polaris/.polaris-clone/polaris-react/src/components/InlineGrid/InlineGrid.tsx` (react-tsx)
- proposed: 1 props, 0 events
- anatomy EXTRACTED from JSX + CSS Module — 1 part(s), 0 token binding(s), 0 raw value(s) reported. Anatomy is human-REVIEWED: check it against design intent before adoption.
- prop `children`: platform prop — not contract API, skipped
- prop `columns`: unclassified type — not proposed, review manually
- prop `gap`: unclassified type — not proposed, review manually
- prop `alignItems`: type resolved heuristically — review
- prop `alignItems`: figma binding INFERRED as VARIANT "Align Items" — confirm against the design library (reconcile step)
- jsx: root class ".InlineGrid" extracted as the contract root part (contract roots are named "root")
- jsx: root renders {children} directly — children channel (text prop vs default slot) is not decidable from code
- css: .InlineGrid { --pc-inline-grid-align-items: initial } — no inversion rule, not extracted
- css: .InlineGrid { display: grid } — no inversion rule, not extracted
- css: .InlineGrid { align-items } uses var(--pc-inline-grid-align-items) which resolves to NO token in the token tree — binding not proposed

## InlineStack

- source: `examples/polaris/.polaris-clone/polaris-react/src/components/InlineStack/InlineStack.tsx` (react-tsx)
- proposed: 4 props, 0 events
- anatomy EXTRACTED from JSX + CSS Module — 1 part(s), 0 token binding(s), 0 raw value(s) reported. Anatomy is human-REVIEWED: check it against design intent before adoption.
- prop `children`: platform prop — not contract API, skipped
- prop `as`: type resolved heuristically — review
- prop `as`: figma binding INFERRED as VARIANT "As" — confirm against the design library (reconcile step)
- prop `align`: type resolved heuristically — review
- prop `align`: figma binding INFERRED as VARIANT "Align" — confirm against the design library (reconcile step)
- prop `direction`: unclassified type — not proposed, review manually
- prop `blockAlign`: type resolved heuristically — review
- prop `blockAlign`: figma binding INFERRED as VARIANT "Block Align" — confirm against the design library (reconcile step)
- prop `gap`: unclassified type — not proposed, review manually
- jsx: root element <Element> is a component — anatomy not extracted (wrapper components are review items)

## Item

- source: `examples/polaris/.polaris-clone/polaris-react/src/components/ButtonGroup/components/Item/Item.tsx` (react-tsx)
- proposed: 0 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- prop `button`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually

## ItemSecondaryAction

- source: `examples/polaris/.polaris-clone/polaris-react/src/components/Navigation/components/Item/Item.tsx` (react-tsx)
- proposed: 2 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element

## KeyboardKey

- source: `examples/polaris/.polaris-clone/polaris-react/src/components/KeyboardKey/KeyboardKey.tsx` (react-tsx)
- proposed: 0 props, 0 events
- anatomy EXTRACTED from JSX + CSS Module — 1 part(s), 0 token binding(s), 3 raw value(s) reported. Anatomy is human-REVIEWED: check it against design intent before adoption.
- prop `children`: platform prop — not contract API, skipped
- prop `size`: unclassified type — not proposed, review manually
- RAW VALUE (not tokenized): `.KeyboardKey { --pc-keyboard-key-base-dimension: 28px }` — no token in the tree has this value. A raw value is reported, never turned into an invented token; bind it to a real token and re-extract.
- RAW VALUE (not tokenized): `.KeyboardKey { padding-block: 0 }` — no token in the tree has this value. A raw value is reported, never turned into an invented token; bind it to a real token and re-extract.
- RAW VALUE (not tokenized): `.small { box-shadow: none }` — nearest tokens by value: `{p.shadow-0}`. A raw value is reported, never turned into an invented token; bind it to a real token and re-extract.
- jsx: root className className is not a CSS-module reference — parts under it are still read where legible
- jsx: part "root" renders {key} — not a known text/node prop, not extracted
- css: .KeyboardKey { height } uses var(--pc-keyboard-key-base-dimension) which resolves to NO token in the token tree — binding not proposed
- css: .KeyboardKey { margin: 0 var(--p-space-050) var(--p-space-050) } — var() inside a shorthand is not invertible to a single binding, not extracted
- css: .KeyboardKey { margin-bottom: 0 } — no inversion rule, not extracted
- css: .KeyboardKey { line-height } uses var(--pc-keyboard-key-base-dimension) which resolves to NO token in the token tree — binding not proposed
- css: .KeyboardKey { text-align: center } — no inversion rule, not extracted
- css: .KeyboardKey { min-width } uses var(--pc-keyboard-key-base-dimension) which resolves to NO token in the token tree — binding not proposed
- css: .KeyboardKey { user-select: none } — no inversion rule, not extracted
- css: class ".KeyboardKey" has declarations but no matching extracted JSX part — styles not attached, review by name
- css: class ".small" has declarations but no matching extracted JSX part — styles not attached, review by name

## KeypressListener

- source: `examples/polaris/.polaris-clone/polaris-react/src/components/KeypressListener/KeypressListener.tsx` (react-tsx)
- proposed: 1 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- props type composes named reference(s) [| {useCapture?: boolean; options?: undefined}
    | {useCapture?: undefined; options?: AddEventListenerOptions}] whose members are outside module scope — those props are NOT carried (single-file extraction)
- prop `keyCode`: unclassified type — not proposed, review manually
- prop `keyEvent`: type resolved heuristically — review
- prop `keyEvent`: figma binding INFERRED as VARIANT "Key Event" — confirm against the design library (reconcile step)
- prop `document`: unclassified type — not proposed, review manually

## Label

- source: `examples/polaris/.polaris-clone/polaris-react/src/components/Label/Label.tsx` (react-tsx)
- proposed: 2 props, 0 events
- anatomy EXTRACTED from JSX + CSS Module — 3 part(s), 0 token binding(s), 1 raw value(s) reported. Anatomy is human-REVIEWED: check it against design intent before adoption.
- prop `children`: platform prop — not contract API, skipped
- prop `id`: platform prop — not contract API, skipped
- anatomy: component ref `<Text>` mapped to contract id `polaris.text` — confirm that contract exists (or adjust the id) before adoption
- RAW VALUE (not tokenized): `.Text { color: currentColor }` — no token in the tree has this value. A raw value is reported, never turned into an invented token; bind it to a real token and re-extract.
- jsx: root className className is not a CSS-module reference — parts under it are still read where legible
- jsx: <label> className classNames(…) — read as class "Text"; the other 1 argument(s) are modifiers, not extracted
- jsx: <label> attribute id={…} — expression not extractable, skipped
- jsx: <label> attribute htmlFor={…} — expression not extractable, skipped
- jsx: <Text> has non-text children — component-ref content not extracted
- css: .Label { -webkit-tap-highlight-color: transparent } — no inversion rule, not extracted
- css: .Text { display: block } — no inversion rule, not extracted
- css: .Text { -webkit-tap-highlight-color: transparent } — no inversion rule, not extracted
- css: selector `.RequiredIndicator::after` — not extractable into anatomy, skipped by name
- css: class ".Label" has declarations but no matching extracted JSX part — styles not attached, review by name
- css: class ".hidden" has declarations but no matching extracted JSX part — styles not attached, review by name

## Labelled

- source: `examples/polaris/.polaris-clone/polaris-react/src/components/Labelled/Labelled.tsx` (react-tsx)
- proposed: 4 props, 0 events
- anatomy EXTRACTED from JSX + CSS Module — 1 part(s), 0 token binding(s), 0 raw value(s) reported. Anatomy is human-REVIEWED: check it against design intent before adoption.
- prop `id`: platform prop — not contract API, skipped
- prop `label`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually
- prop `error`: unclassified type — not proposed, review manually
- prop `action`: unclassified type — not proposed, review manually
- prop `helpText`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually
- prop `children`: platform prop — not contract API, skipped
- jsx: root className className is not a CSS-module reference — parts under it are still read where legible
- jsx: part "root" renders {labelMarkup} — not a known text/node prop, not extracted
- jsx: part "root" renders {errorMarkup} — not a known text/node prop, not extracted
- jsx: part "root" renders {helpTextMarkup} — not a known text/node prop, not extracted
- jsx: root renders {children} directly — children channel (text prop vs default slot) is not decidable from code
- css: selector `.hidden > .LabelWrapper` — not extractable into anatomy, skipped by name
- css: selector `.disabled > .LabelWrapper` — not extractable into anatomy, skipped by name
- css: selector `.disabled > .HelpText > span` — not extractable into anatomy, skipped by name
- css: selector `.readOnly > .LabelWrapper` — not extractable into anatomy, skipped by name
- css: .LabelWrapper { flex-wrap: wrap } — no inversion rule, not extracted
- css: .LabelWrapper { align-items: baseline } — no inversion rule, not extracted
- css: .Action { flex: 0 0 auto } — no inversion rule, not extracted
- css: class ".LabelWrapper" has declarations but no matching extracted JSX part — styles not attached, review by name
- css: class ".HelpText" has declarations but no matching extracted JSX part — styles not attached, review by name
- css: class ".Error" has declarations but no matching extracted JSX part — styles not attached, review by name
- css: class ".Action" has declarations but no matching extracted JSX part — styles not attached, review by name

## Layout

- source: `examples/polaris/.polaris-clone/polaris-react/src/components/Layout/Layout.tsx` (react-tsx)
- proposed: 1 props, 0 events
- anatomy EXTRACTED from JSX + CSS Module — 1 part(s), 0 token binding(s), 1 raw value(s) reported. Anatomy is human-REVIEWED: check it against design intent before adoption.
- prop `children`: platform prop — not contract API, skipped
- RAW VALUE (not tokenized): `.Section { min-width: 51% }` — no token in the tree has this value. A raw value is reported, never turned into an invented token; bind it to a real token and re-extract.
- jsx: root class ".Layout" extracted as the contract root part (contract roots are named "root")
- jsx: part "root" renders {content} — not a known text/node prop, not extracted
- css: at-rule `@media print` skipped — not extractable into anatomy
- css: at-rule `@media print` skipped — not extractable into anatomy
- css: at-rule `@media (--p-breakpoints-md-up)` skipped — not extractable into anatomy
- css: .Layout { flex-wrap: wrap } — no inversion rule, not extracted
- css: .Layout { margin-top: calc(-1 * var(--p-space-400)) } — var() inside a shorthand is not invertible to a single binding, not extracted
- css: .Layout { margin-left: calc(-1 * var(--p-space-400)) } — var() inside a shorthand is not invertible to a single binding, not extracted
- css: .Section { flex: var(--pg-layout-relative-size) var(--pg-layout-relative-size) var(--pg-layout-width-primary-min) } — var() inside a shorthand is not invertible to a single binding, not extracted
- css: .Section-fullWidth { flex: 1 1 100% } — no inversion rule, not extracted
- css: .Section-oneHalf { flex: 1 1 var(--pg-layout-width-one-half-width-base) } — var() inside a shorthand is not invertible to a single binding, not extracted
- css: .Section-oneThird { flex: 1 1 var(--pg-layout-width-one-third-width-base) } — var() inside a shorthand is not invertible to a single binding, not extracted
- css: .AnnotatedSection { flex: 1 1 100% } — no inversion rule, not extracted
- css: .Section { max-width: calc(100% - var(--p-space-400)) } — var() inside a shorthand is not invertible to a single binding, not extracted
- css: .AnnotatedSection { max-width: calc(100% - var(--p-space-400)) } — var() inside a shorthand is not invertible to a single binding, not extracted
- css: selector `.Section + .AnnotatedSection` — not extractable into anatomy, skipped by name
- css: selector `.AnnotatedSection + .AnnotatedSection` — not extractable into anatomy, skipped by name
- css: .AnnotationWrapper { flex-wrap: wrap } — no inversion rule, not extracted
- css: .AnnotationWrapper { margin-top: calc(-1 * var(--p-space-400)) } — var() inside a shorthand is not invertible to a single binding, not extracted
- css: .AnnotationWrapper { margin-left: calc(-1 * var(--p-space-400)) } — var() inside a shorthand is not invertible to a single binding, not extracted
- css: .AnnotationContent { flex: var(--pg-layout-relative-size) var(--pg-layout-relative-size) var(--pg-layout-width-primary-min) } — var() inside a shorthand is not invertible to a single binding, not extracted
- css: .Annotation { flex: 1 1 var(--pg-layout-width-secondary-min) } — var() inside a shorthand is not invertible to a single binding, not extracted
- css: .Annotation { padding: var(--p-space-400) var(--p-space-400) 0 0 } — var() inside a shorthand is not invertible to a single binding, not extracted
- css: .Annotation { max-width: calc(100% - var(--p-space-400)) } — var() inside a shorthand is not invertible to a single binding, not extracted
- css: .AnnotationContent { max-width: calc(100% - var(--p-space-400)) } — var() inside a shorthand is not invertible to a single binding, not extracted
- css: class ".Section" has declarations but no matching extracted JSX part — styles not attached, review by name
- css: class ".Section-fullWidth" has declarations but no matching extracted JSX part — styles not attached, review by name
- css: class ".Section-oneHalf" has declarations but no matching extracted JSX part — styles not attached, review by name
- css: class ".Section-oneThird" has declarations but no matching extracted JSX part — styles not attached, review by name
- css: class ".AnnotatedSection" has declarations but no matching extracted JSX part — styles not attached, review by name
- css: class ".AnnotationWrapper" has declarations but no matching extracted JSX part — styles not attached, review by name
- css: class ".AnnotationContent" has declarations but no matching extracted JSX part — styles not attached, review by name
- css: class ".Annotation" has declarations but no matching extracted JSX part — styles not attached, review by name

## LegacyCard

- source: `examples/polaris/.polaris-clone/polaris-react/src/components/LegacyCard/LegacyCard.tsx` (react-tsx)
- proposed: 5 props, 0 events
- anatomy EXTRACTED from JSX + CSS Module — 1 part(s), 0 token binding(s), 0 raw value(s) reported. Anatomy is human-REVIEWED: check it against design intent before adoption.
- prop `title`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually
- prop `children`: platform prop — not contract API, skipped
- prop `actions`: unclassified type — not proposed, review manually
- prop `primaryFooterAction`: unclassified type — not proposed, review manually
- prop `secondaryFooterActions`: unclassified type — not proposed, review manually
- prop `footerActionAlignment`: figma binding INFERRED as VARIANT "Footer Action Alignment" — confirm against the design library (reconcile step)
- jsx: root element <WithinContentContext.Provider> is a component — anatomy not extracted (wrapper components are review items)

## LegacyFilters

- source: `examples/polaris/.polaris-clone/polaris-react/src/components/LegacyFilters/LegacyFilters.tsx` (react-tsx)
- proposed: 7 props, 0 events
- anatomy EXTRACTED from JSX + CSS Module — 1 part(s), 0 token binding(s), 0 raw value(s) reported. Anatomy is human-REVIEWED: check it against design intent before adoption.
- prop `filters`: unclassified type — not proposed, review manually
- prop `appliedFilters`: unclassified type — not proposed, review manually
- prop `children`: platform prop — not contract API, skipped
- prop `helpText`: unclassified type — not proposed, review manually
- jsx: root element <LegacyFiltersInner> is a component — anatomy not extracted (wrapper components are review items)

## LegacyStack

- source: `examples/polaris/.polaris-clone/polaris-react/src/components/LegacyStack/LegacyStack.tsx` (react-tsx)
- proposed: 5 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- prop `children`: platform prop — not contract API, skipped
- prop `spacing`: type resolved heuristically — review
- prop `spacing`: figma binding INFERRED as VARIANT "Spacing" — confirm against the design library (reconcile step)
- prop `alignment`: type resolved heuristically — review
- prop `alignment`: figma binding INFERRED as VARIANT "Alignment" — confirm against the design library (reconcile step)
- prop `distribution`: type resolved heuristically — review
- prop `distribution`: figma binding INFERRED as VARIANT "Distribution" — confirm against the design library (reconcile step)

## LegacyTabs

- source: `examples/polaris/.polaris-clone/polaris-react/src/components/LegacyTabs/LegacyTabs.tsx` (react-tsx)
- proposed: 3 props, 0 events
- anatomy EXTRACTED from JSX + CSS Module — 1 part(s), 0 token binding(s), 0 raw value(s) reported. Anatomy is human-REVIEWED: check it against design intent before adoption.
- prop `children`: platform prop — not contract API, skipped
- prop `tabs`: unclassified type — not proposed, review manually
- jsx: root element <TabsInner> is a component — anatomy not extracted (wrapper components are review items)

## Link

- source: `examples/polaris/.polaris-clone/polaris-react/src/components/Link/Link.tsx` (react-tsx)
- proposed: 6 props, 0 events
- anatomy EXTRACTED from JSX + CSS Module — 1 part(s), 0 token binding(s), 0 raw value(s) reported. Anatomy is human-REVIEWED: check it against design intent before adoption.
- prop `id`: platform prop — not contract API, skipped
- prop `children`: platform prop — not contract API, skipped
- prop `target`: unclassified type — not proposed, review manually
- jsx: root element <BannerContext.Consumer> is a component — anatomy not extracted (wrapper components are review items)

## List

- source: `examples/polaris/.polaris-clone/polaris-react/src/components/LegacyTabs/components/List/List.tsx` (react-tsx)
- proposed: 1 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- prop `disclosureTabs`: unclassified type — not proposed, review manually

## Listbox

- source: `examples/polaris/.polaris-clone/polaris-react/src/components/Listbox/Listbox.tsx` (react-tsx)
- proposed: 3 props, 0 events
- anatomy EXTRACTED from JSX + CSS Module — 1 part(s), 0 token binding(s), 0 raw value(s) reported. Anatomy is human-REVIEWED: check it against design intent before adoption.
- prop `children`: platform prop — not contract API, skipped
- prop `autoSelection`: unclassified type — not proposed, review manually
- jsx: component returns a Fragment — contract anatomy needs a single root element, anatomy not extracted

## Loading

- source: `examples/polaris/.polaris-clone/polaris-react/src/components/Listbox/components/Loading/Loading.tsx` (react-tsx)
- proposed: 1 props, 0 events
- anatomy EXTRACTED from JSX + CSS Module — 1 part(s), 0 token binding(s), 0 raw value(s) reported. Anatomy is human-REVIEWED: check it against design intent before adoption.
- prop `children`: platform prop — not contract API, skipped
- jsx: root class ".ListItem" extracted as the contract root part (contract roots are named "root")
- jsx: part "root" conditional expression — not a `cond ? <el/> : null` shape, not extracted
- css: .Loading { display: grid } — no inversion rule, not extracted
- css: .Loading { place-items: center } — no inversion rule, not extracted
- css: class ".Loading" has declarations but no matching extracted JSX part — styles not attached, review by name

## MappedAction

- source: `examples/polaris/.polaris-clone/polaris-react/src/components/Autocomplete/components/MappedAction/MappedAction.tsx` (react-tsx)
- proposed: 1 props, 0 events
- anatomy EXTRACTED from JSX + CSS Module — 1 part(s), 0 token binding(s), 0 raw value(s) reported. Anatomy is human-REVIEWED: check it against design intent before adoption.
- jsx: root element <MappedActionContext.Provider> is a component — anatomy not extracted (wrapper components are review items)

## MappedOption

- source: `examples/polaris/.polaris-clone/polaris-react/src/components/Autocomplete/components/MappedOption/MappedOption.tsx` (react-tsx)
- proposed: 2 props, 0 events
- anatomy EXTRACTED from JSX + CSS Module — 1 part(s), 0 token binding(s), 0 raw value(s) reported. Anatomy is human-REVIEWED: check it against design intent before adoption.
- props type composes named reference(s) [ArrayElement<OptionDescriptor[]>] whose members are outside module scope — those props are NOT carried (single-file extraction)
- jsx: root element <Listbox.Option> is a component — anatomy not extracted (wrapper components are review items)

## MediaCard

- source: `examples/polaris/.polaris-clone/polaris-react/src/components/MediaCard/MediaCard.tsx` (react-tsx)
- proposed: 3 props, 1 events
- anatomy EXTRACTED from JSX + CSS Module — 1 part(s), 0 token binding(s), 0 raw value(s) reported. Anatomy is human-REVIEWED: check it against design intent before adoption.
- prop `children`: platform prop — not contract API, skipped
- prop `title`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually
- prop `primaryAction`: unclassified type — not proposed, review manually
- prop `secondaryAction`: unclassified type — not proposed, review manually
- prop `popoverActions`: unclassified type — not proposed, review manually
- prop `size`: type resolved heuristically — review
- prop `size`: figma binding INFERRED as VARIANT "Size" — confirm against the design library (reconcile step)
- event `onDismiss`: declared with trigger 'root' — assign the real trigger part once anatomy is authored
- jsx: root element <LegacyCard> is a component — anatomy not extracted (wrapper components are review items)

## MediaQueryProvider

- source: `examples/polaris/.polaris-clone/polaris-react/src/components/MediaQueryProvider/MediaQueryProvider.tsx` (react-tsx)
- proposed: 0 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- prop `children`: platform prop — not contract API, skipped

## Menu

- source: `examples/polaris/.polaris-clone/polaris-react/src/components/TopBar/components/Menu/Menu.tsx` (react-tsx)
- proposed: 4 props, 0 events
- anatomy EXTRACTED from JSX + CSS Module — 1 part(s), 0 token binding(s), 0 raw value(s) reported. Anatomy is human-REVIEWED: check it against design intent before adoption.
- prop `activatorContent`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually
- prop `actions`: unclassified type — not proposed, review manually
- prop `message`: unclassified type — not proposed, review manually
- jsx: root element <Popover> is a component — anatomy not extracted (wrapper components are review items)

## MenuGroup

- source: `examples/polaris/.polaris-clone/polaris-react/src/components/ActionMenu/components/MenuGroup/MenuGroup.tsx` (react-tsx)
- proposed: 2 props, 0 events
- anatomy EXTRACTED from JSX + CSS Module — 1 part(s), 0 token binding(s), 0 raw value(s) reported. Anatomy is human-REVIEWED: check it against design intent before adoption.
- prop `sections`: unclassified type — not proposed, review manually
- jsx: root element <Popover> is a component — anatomy not extracted (wrapper components are review items)

## Message

- source: `examples/polaris/.polaris-clone/polaris-react/src/components/TopBar/components/Menu/components/Message/Message.tsx` (react-tsx)
- proposed: 2 props, 0 events
- anatomy EXTRACTED from JSX + CSS Module — 2 part(s), 2 token binding(s), 1 raw value(s) reported. Anatomy is human-REVIEWED: check it against design intent before adoption.
- prop `action`: unclassified type — not proposed, review manually
- prop `link`: unclassified type — not proposed, review manually
- prop `badge`: unclassified type — not proposed, review manually
- anatomy: component ref `<Popover.Section>` mapped to contract id `polaris.popover.section` — confirm that contract exists (or adjust the id) before adoption
- RAW VALUE (not tokenized): `.Section { max-width: 325px }` — no token in the tree has this value. A raw value is reported, never turned into an invented token; bind it to a real token and re-extract.
- jsx: root class ".Section" extracted as the contract root part (contract roots are named "root")
- jsx: <Popover.Section> has non-text children — component-ref content not extracted
- css: .Section { border-top: var(--p-border-width-025) solid var(--p-color-border-secondary) } — var() inside a shorthand is not invertible to a single binding, not extracted

## MessageIndicator

- source: `examples/polaris/.polaris-clone/polaris-react/src/components/MessageIndicator/MessageIndicator.tsx` (react-tsx)
- proposed: 1 props, 0 events
- anatomy EXTRACTED from JSX + CSS Module — 1 part(s), 0 token binding(s), 2 raw value(s) reported. Anatomy is human-REVIEWED: check it against design intent before adoption.
- prop `children`: platform prop — not contract API, skipped
- RAW VALUE (not tokenized): `.MessageIndicator { --pc-message-indicator-size: 12px }` — no token in the tree has this value. A raw value is reported, never turned into an invented token; bind it to a real token and re-extract.
- RAW VALUE (not tokenized): `.MessageIndicator { --pc-message-indicator-position: -3px }` — no token in the tree has this value. A raw value is reported, never turned into an invented token; bind it to a real token and re-extract.
- jsx: root class ".MessageIndicatorWrapper" extracted as the contract root part (contract roots are named "root")
- jsx: part "root" renders {indicatorMarkup} — not a known text/node prop, not extracted
- jsx: root renders {children} directly — children channel (text prop vs default slot) is not decidable from code
- css: .MessageIndicator { z-index: 1 } — no inversion rule, not extracted
- css: .MessageIndicator { width } uses var(--pc-message-indicator-size) which resolves to NO token in the token tree — binding not proposed
- css: .MessageIndicator { height } uses var(--pc-message-indicator-size) which resolves to NO token in the token tree — binding not proposed
- css: .MessageIndicator { border: solid var(--p-border-width-050) var(--p-color-bg) } — var() inside a shorthand is not invertible to a single binding, not extracted
- css: .MessageIndicator position:absolute with insets (top:var(--pc-message-indicator-position);bottom:;left:;right:var(--pc-message-indicator-position)) — not a generator overlay placement, not extracted
- css: class ".MessageIndicator" has declarations but no matching extracted JSX part — styles not attached, review by name

## Modal

- source: `examples/polaris/.polaris-clone/polaris-react/src/components/Modal/Modal.tsx` (react-tsx)
- proposed: 10 props, 0 events
- anatomy EXTRACTED from JSX + CSS Module — 1 part(s), 0 token binding(s), 0 raw value(s) reported. Anatomy is human-REVIEWED: check it against design intent before adoption.
- prop `title`: unclassified type — not proposed, review manually
- prop `children`: platform prop — not contract API, skipped
- prop `footer`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually
- prop `size`: type resolved heuristically — review
- prop `size`: figma binding INFERRED as VARIANT "Size" — confirm against the design library (reconcile step)
- prop `activator`: unclassified type — not proposed, review manually
- prop `activatorWrapper`: unclassified type — not proposed, review manually
- jsx: root element <WithinContentContext.Provider> is a component — anatomy not extracted (wrapper components are review items)

## Month

- source: `examples/polaris/.polaris-clone/polaris-react/src/components/DatePicker/components/Month/Month.tsx` (react-tsx)
- proposed: 4 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- prop `focusedDate`: unclassified type — not proposed, review manually
- prop `selected`: unclassified type — not proposed, review manually
- prop `hoverDate`: unclassified type — not proposed, review manually
- prop `disableDatesBefore`: unclassified type — not proposed, review manually
- prop `disableDatesAfter`: unclassified type — not proposed, review manually
- prop `disableSpecificDates`: unclassified type — not proposed, review manually
- prop `accessibilityLabelPrefixes`: unclassified type — not proposed, review manually

## Navigation

- source: `examples/polaris/.polaris-clone/polaris-react/src/components/DataTable/components/Navigation/Navigation.tsx` (react-tsx)
- proposed: 3 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- prop `columnVisibilityData`: unclassified type — not proposed, review manually
- prop `setRef`: function-typed but not on* — skipped, review manually

## Option

- source: `examples/polaris/.polaris-clone/polaris-react/src/components/Listbox/components/Option/Option.tsx` (react-tsx)
- proposed: 5 props, 0 events
- anatomy EXTRACTED from JSX + CSS Module — 1 part(s), 0 token binding(s), 0 raw value(s) reported. Anatomy is human-REVIEWED: check it against design intent before adoption.
- prop `children`: platform prop — not contract API, skipped
- jsx: root className classNames(…) read — root class ".Option"; boolean modifier class(es): .divider (divider)
- jsx: root class ".Option" extracted as the contract root part (contract roots are named "root")
- jsx: <li> attribute id={…} — expression not extractable, skipped
- jsx: <li> attribute tabIndex={…} — expression not extractable, skipped
- jsx: <li> attribute role={…} — expression not extractable, skipped
- jsx: <li> handler "onKeyDown" — only onClick/onChange trigger wiring is extracted
- jsx: <li> handler "onMouseDown" — only onClick/onChange trigger wiring is extracted
- jsx: part "root" renders {contentMarkup} — not a known text/node prop, not extracted
- css: selector `.Option:focus` — pseudo ":focus" is not a contract state, not extracted
- css: .divider — styles behind boolean prop "divider" (1 declaration(s)); boolean-conditional styling is not extractable into anatomy, review by name

## OptionList

- source: `examples/polaris/.polaris-clone/polaris-react/src/components/OptionList/OptionList.tsx` (react-tsx)
- proposed: 3 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- prop `id`: platform prop — not contract API, skipped
- prop `options`: unclassified type — not proposed, review manually
- prop `role`: unclassified type — not proposed, review manually
- prop `sections`: unclassified type — not proposed, review manually
- prop `selected`: unclassified type — not proposed, review manually
- prop `verticalAlign`: type resolved heuristically — review
- prop `verticalAlign`: figma binding INFERRED as VARIANT "Vertical Align" — confirm against the design library (reconcile step)

## Page

- source: `examples/polaris/.polaris-clone/polaris-react/src/components/Page/Page.tsx` (react-tsx)
- proposed: 2 props, 0 events
- anatomy EXTRACTED from JSX + CSS Module — 1 part(s), 0 token binding(s), 2 raw value(s) reported. Anatomy is human-REVIEWED: check it against design intent before adoption.
- prop `children`: platform prop — not contract API, skipped
- RAW VALUE (not tokenized): `.fullWidth { max-width: none }` — nearest tokens by value: `{p.shadow-0}`. A raw value is reported, never turned into an invented token; bind it to a real token and re-extract.
- RAW VALUE (not tokenized): `.Content { padding-inline: 0 }` — no token in the tree has this value. A raw value is reported, never turned into an invented token; bind it to a real token and re-extract.
- jsx: root className pageClassName is not a CSS-module reference — parts under it are still read where legible
- jsx: part "root" renders {headerMarkup} — not a known text/node prop, not extracted
- jsx: <div> className contentClassName is not a CSS-module reference — element not extracted as a part (tailwind/plain classes are review items)
- css: at-rule `@media (--p-breakpoints-md-up)` skipped — not extractable into anatomy
- css: selector `html` — not extractable into anatomy, skipped by name
- css: selector `body` — not extractable into anatomy, skipped by name
- css: selector `.Page::after` — not extractable into anatomy, skipped by name
- css: .narrowWidth { max-width } uses var(--pg-layout-width-primary-max) which resolves to NO token in the token tree — binding not proposed
- css: class ".Page" has declarations but no matching extracted JSX part — styles not attached, review by name
- css: class ".fullWidth" has declarations but no matching extracted JSX part — styles not attached, review by name
- css: class ".narrowWidth" has declarations but no matching extracted JSX part — styles not attached, review by name
- css: class ".Content" has declarations but no matching extracted JSX part — styles not attached, review by name

## PageActions

- source: `examples/polaris/.polaris-clone/polaris-react/src/components/PageActions/PageActions.tsx` (react-tsx)
- proposed: 0 props, 0 events
- anatomy EXTRACTED from JSX + CSS Module — 2 part(s), 2 token binding(s), 1 raw value(s) reported. Anatomy is human-REVIEWED: check it against design intent before adoption.
- prop `primaryAction`: unclassified type — not proposed, review manually
- prop `secondaryActions`: unclassified type — not proposed, review manually
- anatomy: component ref `<LegacyStack>` mapped to contract id `polaris.legacy-stack` — confirm that contract exists (or adjust the id) before adoption
- RAW VALUE (not tokenized): `.PageActions { margin: 0 auto }` — no token in the tree has this value. A raw value is reported, never turned into an invented token; bind it to a real token and re-extract.
- jsx: root class ".PageActions" extracted as the contract root part (contract roots are named "root")
- jsx: <LegacyStack> has non-text children — component-ref content not extracted
- css: at-rule `@media (--p-breakpoints-sm-up)` skipped — not extractable into anatomy
- css: .PageActions { border-top: 0 } — no inversion rule, not extracted

## Pagination

- source: `examples/polaris/.polaris-clone/polaris-react/src/components/Pagination/Pagination.tsx` (react-tsx)
- proposed: 8 props, 0 events
- anatomy EXTRACTED from JSX + CSS Module — 2 part(s), 0 token binding(s), 0 raw value(s) reported. Anatomy is human-REVIEWED: check it against design intent before adoption.
- prop `nextKeys`: unclassified type — not proposed, review manually
- prop `previousKeys`: unclassified type — not proposed, review manually
- prop `accessibilityLabels`: unclassified type — not proposed, review manually
- prop `label`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually
- prop `type`: figma binding INFERRED as VARIANT "Type" — confirm against the design library (reconcile step)
- anatomy: component ref `<Box>` mapped to contract id `polaris.box` — confirm that contract exists (or adjust the id) before adoption
- jsx: multiple JSX returns — anatomy read from the first
- jsx: root className classNames(…) read — root class ".Pagination"
- jsx: root className argument `styles ref "table" beyond the first — role unclear` — not readable as a class binding, skipped by name
- jsx: root class ".Pagination" extracted as the contract root part (contract roots are named "root")
- jsx: part "root" renders {previousButtonEvents} — not a known text/node prop, not extracted
- jsx: part "root" renders {nextButtonEvents} — not a known text/node prop, not extracted
- jsx: <Box> has non-text children — component-ref content not extracted
- css: selector `.Pagination button` — not extractable into anatomy, skipped by name
- css: selector `.Pagination button:hover` — not extractable into anatomy, skipped by name
- css: selector `.Pagination button:active` — not extractable into anatomy, skipped by name
- css: selector `.Pagination button:active` — not extractable into anatomy, skipped by name
- css: selector `.Pagination button:focus` — not extractable into anatomy, skipped by name
- css: selector `.Pagination.table` — not extractable into anatomy, skipped by name
- css: selector `.Pagination.table button` — not extractable into anatomy, skipped by name
- css: selector `.Pagination.table button:hover` — not extractable into anatomy, skipped by name
- css: selector `.Pagination.table button:hover svg` — not extractable into anatomy, skipped by name
- css: selector `.Pagination.table button:active` — not extractable into anatomy, skipped by name
- css: selector `.Pagination.table button:focus` — not extractable into anatomy, skipped by name
- css: selector `.Pagination.table button:active svg` — not extractable into anatomy, skipped by name
- css: selector `.Pagination.table button:focus svg` — not extractable into anatomy, skipped by name
- css: selector `.Pagination.table button:disabled` — not extractable into anatomy, skipped by name
- css: selector `.Pagination.table button:disabled svg` — not extractable into anatomy, skipped by name
- css: class ".TablePaginationActions" has declarations but no matching extracted JSX part — styles not attached, review by name

## Pane

- source: `examples/polaris/.polaris-clone/polaris-react/src/components/Popover/components/Pane/Pane.tsx` (react-tsx)
- proposed: 7 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- prop `children`: platform prop — not contract API, skipped

## Panel

- source: `examples/polaris/.polaris-clone/polaris-react/src/components/LegacyTabs/components/Panel/Panel.tsx` (react-tsx)
- proposed: 2 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- prop `id`: platform prop — not contract API, skipped
- prop `children`: platform prop — not contract API, skipped

## Picker

- source: `examples/polaris/.polaris-clone/polaris-react/src/components/Picker/Picker.tsx` (react-tsx)
- proposed: 3 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- prop `activator`: unclassified type — not proposed, review manually
- prop `options`: unclassified type — not proposed, review manually
- prop `addAction`: unclassified type — not proposed, review manually
- prop `searchField`: unclassified type — not proposed, review manually

## Pip

- source: `examples/polaris/.polaris-clone/polaris-react/src/components/Badge/components/Pip/Pip.tsx` (react-tsx)
- proposed: 1 props, 0 events
- anatomy EXTRACTED from JSX + CSS Module — 2 part(s), 0 token binding(s), 5 raw value(s) reported. Anatomy is human-REVIEWED: check it against design intent before adoption.
- prop `tone`: unclassified type — not proposed, review manually
- prop `progress`: unclassified type — not proposed, review manually
- anatomy: component ref `<Text>` mapped to contract id `polaris.text` — confirm that contract exists (or adjust the id) before adoption
- RAW VALUE (not tokenized): `.Pip { --pc-border-width: 1.25px }` — no token in the tree has this value. A raw value is reported, never turned into an invented token; bind it to a real token and re-extract.
- RAW VALUE (not tokenized): `.Pip { border-radius: 3px }` — no token in the tree has this value. A raw value is reported, never turned into an invented token; bind it to a real token and re-extract.
- RAW VALUE (not tokenized): `.progressIncomplete { background: transparent }` — no token in the tree has this value. A raw value is reported, never turned into an invented token; bind it to a real token and re-extract.
- RAW VALUE (not tokenized): `.progressPartiallyComplete { background: linear-gradient( to top, currentColor, currentColor 50%, transparent 50%, transparent ) }` — no token in the tree has this value. A raw value is reported, never turned into an invented token; bind it to a real token and re-extract.
- RAW VALUE (not tokenized): `.progressComplete { background: currentColor }` — no token in the tree has this value. A raw value is reported, never turned into an invented token; bind it to a real token and re-extract.
- jsx: root className className is not a CSS-module reference — parts under it are still read where legible
- jsx: <Text> has non-text children — component-ref content not extracted
- css: at-rule `@media print` skipped — not extractable into anatomy
- css: at-rule `@media print` skipped — not extractable into anatomy
- css: .Pip { display: inline-block } — no inversion rule, not extracted
- css: .Pip { color } uses var(--pc-pip-color) which resolves to NO token in the token tree — binding not proposed
- css: .Pip { height } uses var(--pc-pip-size) which resolves to NO token in the token tree — binding not proposed
- css: .Pip { width } uses var(--pc-pip-size) which resolves to NO token in the token tree — binding not proposed
- css: .Pip { border-color } uses var(--pc-pip-color) which resolves to NO token in the token tree — binding not proposed
- css: .Pip { flex-shrink: 0 } — no inversion rule, not extracted
- css: .Pip { border-width } uses var(--pc-border-width) which resolves to NO token in the token tree — binding not proposed
- css: selector `.progressPartiallyComplete.Pip` — not extractable into anatomy, skipped by name
- css: selector `.progressPartiallyComplete.Pip::after` — not extractable into anatomy, skipped by name
- css: class ".Pip" has declarations but no matching extracted JSX part — styles not attached, review by name
- css: class ".toneInfo" has declarations but no matching extracted JSX part — styles not attached, review by name
- css: class ".toneSuccess" has declarations but no matching extracted JSX part — styles not attached, review by name
- css: class ".toneNew" has declarations but no matching extracted JSX part — styles not attached, review by name
- css: class ".toneAttention" has declarations but no matching extracted JSX part — styles not attached, review by name
- css: class ".toneWarning" has declarations but no matching extracted JSX part — styles not attached, review by name
- css: class ".toneCritical" has declarations but no matching extracted JSX part — styles not attached, review by name
- css: class ".progressIncomplete" has declarations but no matching extracted JSX part — styles not attached, review by name
- css: class ".progressPartiallyComplete" has declarations but no matching extracted JSX part — styles not attached, review by name
- css: class ".progressComplete" has declarations but no matching extracted JSX part — styles not attached, review by name

## PolarisTestProvider

- source: `examples/polaris/.polaris-clone/polaris-react/src/components/PolarisTestProvider/PolarisTestProvider.tsx` (react-tsx)
- proposed: 1 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- prop `children`: platform prop — not contract API, skipped

## PopoverComponent

- source: `examples/polaris/.polaris-clone/polaris-react/src/components/Popover/Popover.tsx` (react-tsx)
- proposed: 12 props, 0 events
- anatomy EXTRACTED from JSX + CSS Module — 1 part(s), 0 token binding(s), 0 raw value(s) reported. Anatomy is human-REVIEWED: check it against design intent before adoption.
- prop `children`: platform prop — not contract API, skipped
- prop `preferredPosition`: unclassified type — not proposed, review manually
- prop `preferredAlignment`: unclassified type — not proposed, review manually
- prop `activator`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually
- prop `preferInputActivator`: unclassified type — not proposed, review manually
- prop `ariaHaspopup`: unclassified type — not proposed, review manually
- prop `autofocusTarget`: unclassified type — not proposed, review manually
- jsx: root element <WrapperComponent> is a component — anatomy not extracted (wrapper components are review items)

## Portal

- source: `examples/polaris/.polaris-clone/polaris-react/src/components/Portal/Portal.tsx` (react-tsx)
- proposed: 1 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- prop `children`: platform prop — not contract API, skipped

## PortalsContainerComponent

- source: `examples/polaris/.polaris-clone/polaris-react/src/components/PortalsManager/components/PortalsContainer/PortalsContainer.tsx` (react-tsx)
- proposed: 0 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- props type resolved with NO members — a zero-prop API is what this module declares; review

## PortalsManager

- source: `examples/polaris/.polaris-clone/polaris-react/src/components/PortalsManager/PortalsManager.tsx` (react-tsx)
- proposed: 0 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- prop `children`: platform prop — not contract API, skipped
- prop `container`: unclassified type — not proposed, review manually

## PrimaryActionMarkup

- source: `examples/polaris/.polaris-clone/polaris-react/src/components/Page/components/Header/Header.tsx` (react-tsx)
- proposed: 0 props, 0 events
- anatomy EXTRACTED from JSX + CSS Module — 2 part(s), 1 token binding(s), 3 raw value(s) reported. Anatomy is human-REVIEWED: check it against design intent before adoption.
- prop `primaryAction`: unclassified type — not proposed, review manually
- anatomy: component ref `<Box>` mapped to contract id `polaris.box` — confirm that contract exists (or adjust the id) before adoption
- RAW VALUE (not tokenized): `.PaginationWrapper { line-height: 1 }` — no token in the tree has this value. A raw value is reported, never turned into an invented token; bind it to a real token and re-extract.
- RAW VALUE (not tokenized): `.Row { line-height: normal }` — no token in the tree has this value. A raw value is reported, never turned into an invented token; bind it to a real token and re-extract.
- RAW VALUE (not tokenized): `.Actions { width: 100% }` — no token in the tree has this value. A raw value is reported, never turned into an invented token; bind it to a real token and re-extract.
- jsx: root class ".PrimaryActionWrapper" extracted as the contract root part (contract roots are named "root")
- jsx: <Box> has non-text children — component-ref content not extracted
- css: at-rule `@media (--p-breakpoints-sm-up)` skipped — not extractable into anatomy
- css: at-rule `@media (--p-breakpoints-md-up)` skipped — not extractable into anatomy
- css: at-rule `@media (--p-breakpoints-sm-down)` skipped — not extractable into anatomy
- css: at-rule `@media (--p-breakpoints-sm-up)` skipped — not extractable into anatomy
- css: at-rule `@define-mixin condensed-layout` skipped — not extractable into anatomy
- css: at-rule `@media (--p-breakpoints-lg-down)` skipped — not extractable into anatomy
- css: at-rule `@media (--p-breakpoints-md-down)` skipped — not extractable into anatomy
- css: at-rule `@media (--p-breakpoints-md-up)` skipped — not extractable into anatomy
- css: at-rule `@media (--p-breakpoints-md-up)` skipped — not extractable into anatomy
- css: .TitleWrapper { grid-area: title } — no inversion rule, not extracted
- css: .TitleWrapper { align-self: center } — no inversion rule, not extracted
- css: selector `.TitleWrapper.TitleWrapperExpand` — not extractable into anatomy, skipped by name
- css: .BreadcrumbWrapper { grid-area: breadcrumbs } — no inversion rule, not extracted
- css: selector `.BreadcrumbWrapper a` — not extractable into anatomy, skipped by name
- css: selector `.BreadcrumbWrapper button` — not extractable into anatomy, skipped by name
- css: selector `.BreadcrumbWrapper a:is(:hover, :focus, :focus-visible)` — not extractable into anatomy, skipped by name
- css: selector `.BreadcrumbWrapper button:is(:hover, :focus, :focus-visible)` — not extractable into anatomy, skipped by name
- css: selector `.BreadcrumbWrapper a:is(:hover, :focus-visible)` — not extractable into anatomy, skipped by name
- css: selector `.BreadcrumbWrapper button:is(:hover, :focus-visible)` — not extractable into anatomy, skipped by name
- css: selector `.BreadcrumbWrapper a:focus` — not extractable into anatomy, skipped by name
- css: selector `.BreadcrumbWrapper button:focus` — not extractable into anatomy, skipped by name
- css: .PrimaryActionWrapper { margin-top: 0 } — no inversion rule, not extracted
- css: selector `.Row:first-child` — pseudo ":first-child" is not a contract state, not extracted
- css: selector `.Row + .Row` — not extractable into anatomy, skipped by name
- css: selector `.Row + .Row .mobileView &` — not extractable into anatomy, skipped by name
- css: selector `.Row + .Row .RightAlign` — not extractable into anatomy, skipped by name
- css: .RightAlign { grid-area: actions } — no inversion rule, not extracted
- css: .RightAlign { align-content: flex-end } — no inversion rule, not extracted
- css: .RightAlign { align-self: flex-start } — no inversion rule, not extracted
- css: .RightAlign { white-space: nowrap } — no inversion rule, not extracted
- css: selector `.RightAlign .noBreadcrumbs &` — not extractable into anatomy, skipped by name
- css: selector `.AdditionalMetaData .noBreadcrumbs &` — not extractable into anatomy, skipped by name
- css: .Actions { text-align: right } — no inversion rule, not extracted
- css: selector `.mediumTitle:not(.noBreadcrumbs)` — pseudo ":not(.noBreadcrumbs)" is not a contract state, not extracted
- css: selector `.mediumTitle.noBreadcrumbs` — not extractable into anatomy, skipped by name
- css: selector `.mediumTitle.noBreadcrumbs .TitleWrapper` — not extractable into anatomy, skipped by name
- css: selector `.mediumTitle.noBreadcrumbs .RightAlign` — not extractable into anatomy, skipped by name
- css: selector `.mediumTitle.noBreadcrumbs .Row` — not extractable into anatomy, skipped by name
- css: selector `.isSingleRow .Row` — descendant rule not under an enum class, not extracted
- css: class ".TitleWrapper" has declarations but no matching extracted JSX part — styles not attached, review by name
- css: class ".BreadcrumbWrapper" has declarations but no matching extracted JSX part — styles not attached, review by name
- css: class ".PaginationWrapper" has declarations but no matching extracted JSX part — styles not attached, review by name
- css: class ".Row" has declarations but no matching extracted JSX part — styles not attached, review by name
- css: class ".RightAlign" has declarations but no matching extracted JSX part — styles not attached, review by name
- css: class ".AdditionalMetaData" has declarations but no matching extracted JSX part — styles not attached, review by name
- css: class ".Actions" has declarations but no matching extracted JSX part — styles not attached, review by name
- css: class ".longTitle" has declarations but no matching extracted JSX part — styles not attached, review by name

## ProgressBar

- source: `examples/polaris/.polaris-clone/polaris-react/src/components/ProgressBar/ProgressBar.tsx` (react-tsx)
- proposed: 5 props, 0 events
- anatomy EXTRACTED from JSX + CSS Module — 3 part(s), 0 token binding(s), 3 raw value(s) reported. Anatomy is human-REVIEWED: check it against design intent before adoption.
- prop `size`: type resolved heuristically — review
- prop `size`: figma binding INFERRED as VARIANT "Size" — confirm against the design library (reconcile step)
- prop `tone`: type resolved heuristically — review
- prop `tone`: figma binding INFERRED as VARIANT "Tone" — confirm against the design library (reconcile step)
- anatomy: component ref `<CSSTransition>` mapped to contract id `polaris.csstransition` — confirm that contract exists (or adjust the id) before adoption
- RAW VALUE (not tokenized): `.ProgressBar { --pc-progress-bar-height-base: 16px }` — no token in the tree has this value. A raw value is reported, never turned into an invented token; bind it to a real token and re-extract.
- RAW VALUE (not tokenized): `.ProgressBar { width: 100% }` — no token in the tree has this value. A raw value is reported, never turned into an invented token; bind it to a real token and re-extract.
- RAW VALUE (not tokenized): `.Indicator { height: inherit }` — no token in the tree has this value. A raw value is reported, never turned into an invented token; bind it to a real token and re-extract.
- jsx: root className className is not a CSS-module reference — parts under it are still read where legible
- jsx: <progress> attribute value={…} — expression not extractable, skipped
- jsx: <CSSTransition> prop timeout={…} — expression not extractable on a component ref, skipped
- jsx: <CSSTransition> prop nodeRef={…} — expression not extractable on a component ref, skipped
- jsx: <CSSTransition> prop classNames={…} — expression not extractable on a component ref, skipped
- jsx: <CSSTransition> has non-text children — component-ref content not extracted
- css: at-rule `@media (forced-colors: active)` skipped — not extractable into anatomy
- css: at-rule `@media screen and (-ms-high-contrast: active)` skipped — not extractable into anatomy
- css: .ProgressBar { --pc-progress-bar-height-small: calc( var(--pc-progress-bar-height-base) * 0.5 ) } — var() inside a shorthand is not invertible to a single binding, not extracted
- css: .ProgressBar { --pc-progress-bar-height-large: calc(var(--pc-progress-bar-height-base) * 2) } — var() inside a shorthand is not invertible to a single binding, not extracted
- css: .ProgressBar { overflow: hidden } — no inversion rule, not extracted
- css: .ProgressBar { background-color } uses var(--pc-progress-bar-background) which resolves to NO token in the token tree — binding not proposed
- css: .sizeSmall { height } uses var(--pc-progress-bar-height-small) which resolves to NO token in the token tree — binding not proposed
- css: .sizeMedium { height } uses var(--pc-progress-bar-height-base) which resolves to NO token in the token tree — binding not proposed
- css: .sizeLarge { height } uses var(--pc-progress-bar-height-large) which resolves to NO token in the token tree — binding not proposed
- css: .Indicator { background-color } uses var(--pc-progress-bar-indicator) which resolves to NO token in the token tree — binding not proposed
- css: .Indicator { transition: transform var(--pc-progress-bar-duration) var(--p-motion-ease) } — var() inside a shorthand is not invertible to a single binding, not extracted
- css: .Indicator { transform: scaleX(0) } — no inversion rule, not extracted
- css: .Indicator { transform-origin: 0 50% } — no inversion rule, not extracted
- css: .IndicatorAppearActive { transform: scaleX(var(--pc-progress-bar-percent)) } — var() inside a shorthand is not invertible to a single binding, not extracted
- css: .IndicatorAppearDone { transform: scaleX(var(--pc-progress-bar-percent)) } — var() inside a shorthand is not invertible to a single binding, not extracted
- css: class ".ProgressBar" has declarations but no matching extracted JSX part — styles not attached, review by name
- css: class ".sizeSmall" has declarations but no matching extracted JSX part — styles not attached, review by name
- css: class ".sizeMedium" has declarations but no matching extracted JSX part — styles not attached, review by name
- css: class ".sizeLarge" has declarations but no matching extracted JSX part — styles not attached, review by name
- css: class ".toneHighlight" has declarations but no matching extracted JSX part — styles not attached, review by name
- css: class ".tonePrimary" has declarations but no matching extracted JSX part — styles not attached, review by name
- css: class ".toneSuccess" has declarations but no matching extracted JSX part — styles not attached, review by name
- css: class ".toneCritical" has declarations but no matching extracted JSX part — styles not attached, review by name
- css: class ".Indicator" has declarations but no matching extracted JSX part — styles not attached, review by name
- css: class ".IndicatorAppearActive" has declarations but no matching extracted JSX part — styles not attached, review by name
- css: class ".IndicatorAppearDone" has declarations but no matching extracted JSX part — styles not attached, review by name
- css: class ".Label" has declarations but no matching extracted JSX part — styles not attached, review by name

## RadioButton

- source: `examples/polaris/.polaris-clone/polaris-react/src/components/RadioButton/RadioButton.tsx` (react-tsx)
- proposed: 6 props, 0 events
- anatomy EXTRACTED from JSX + CSS Module — 1 part(s), 0 token binding(s), 0 raw value(s) reported. Anatomy is human-REVIEWED: check it against design intent before adoption.
- prop `label`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually
- prop `id`: platform prop — not contract API, skipped
- prop `fill`: unclassified type — not proposed, review manually
- prop `helpText`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually
- prop `tone`: unclassified type — not proposed, review manually
- jsx: root element <Choice> is a component — anatomy not extracted (wrapper components are review items)

## RangeSlider

- source: `examples/polaris/.polaris-clone/polaris-react/src/components/RangeSlider/RangeSlider.tsx` (react-tsx)
- proposed: 0 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- props type has NO OWN members (extends RangeSliderProps — parent members are outside single-file extraction): zero own props is what this module declares — review

## RenameModal

- source: `examples/polaris/.polaris-clone/polaris-react/src/components/Tabs/components/Tab/components/RenameModal/RenameModal.tsx` (react-tsx)
- proposed: 4 props, 3 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- prop `viewNames`: unclassified type — not proposed, review manually
- event `onClose`: declared with trigger 'root' — assign the real trigger part once anatomy is authored
- event `onClickPrimaryAction`: declared with trigger 'root' — assign the real trigger part once anatomy is authored
- event `onClickSecondaryAction`: declared with trigger 'root' — assign the real trigger part once anatomy is authored

## Resizer

- source: `examples/polaris/.polaris-clone/polaris-react/src/components/TextField/components/Resizer/Resizer.tsx` (react-tsx)
- proposed: 2 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- prop `currentHeight`: unclassified type — not proposed, review manually

## ResourceList

- source: `examples/polaris/.polaris-clone/polaris-react/src/components/ResourceList/ResourceList.tsx` (react-tsx)
- proposed: 9 props, 0 events
- anatomy EXTRACTED from JSX + CSS Module — 1 part(s), 0 token binding(s), 0 raw value(s) reported. Anatomy is human-REVIEWED: check it against design intent before adoption.
- prop `items`: unclassified type — not proposed, review manually
- prop `filterControl`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually
- prop `emptyState`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually
- prop `emptySearchState`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually
- prop `resourceName`: unclassified type — not proposed, review manually
- prop `promotedBulkActions`: unclassified type — not proposed, review manually
- prop `bulkActions`: unclassified type — not proposed, review manually
- prop `selectedItems`: unclassified type — not proposed, review manually
- prop `sortOptions`: unclassified type — not proposed, review manually
- prop `alternateTool`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually
- prop `pagination`: unclassified type — not proposed, review manually
- jsx: root element <ResourceListContext.Provider> is a component — anatomy not extracted (wrapper components are review items)

## RollupActions

- source: `examples/polaris/.polaris-clone/polaris-react/src/components/ActionMenu/components/RollupActions/RollupActions.tsx` (react-tsx)
- proposed: 1 props, 0 events
- anatomy EXTRACTED from JSX + CSS Module — 1 part(s), 0 token binding(s), 0 raw value(s) reported. Anatomy is human-REVIEWED: check it against design intent before adoption.
- prop `items`: unclassified type — not proposed, review manually
- prop `sections`: unclassified type — not proposed, review manually
- jsx: root element <Popover> is a component — anatomy not extracted (wrapper components are review items)

## Row

- source: `examples/polaris/.polaris-clone/polaris-react/src/components/IndexTable/components/Row/Row.tsx` (react-tsx)
- proposed: 6 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- prop `children`: platform prop — not contract API, skipped
- prop `id`: platform prop — not contract API, skipped
- prop `selected`: unclassified type — not proposed, review manually
- prop `tone`: type resolved heuristically — review
- prop `tone`: figma binding INFERRED as VARIANT "Tone" — confirm against the design library (reconcile step)
- prop `selectionRange`: unclassified type — not proposed, review manually
- prop `rowType`: type resolved heuristically — review
- prop `rowType`: figma binding INFERRED as VARIANT "Row Type" — confirm against the design library (reconcile step)

## ScrollableComponent

- source: `examples/polaris/.polaris-clone/polaris-react/src/components/Scrollable/Scrollable.tsx` (react-tsx)
- proposed: 7 props, 0 events
- anatomy EXTRACTED from JSX + CSS Module — 1 part(s), 0 token binding(s), 0 raw value(s) reported. Anatomy is human-REVIEWED: check it against design intent before adoption.
- prop `children`: platform prop — not contract API, skipped
- prop `scrollbarWidth`: figma binding INFERRED as VARIANT "Scrollbar Width" — confirm against the design library (reconcile step)
- prop `scrollbarGutter`: figma binding INFERRED as VARIANT "Scrollbar Gutter" — confirm against the design library (reconcile step)
- jsx: root element <ScrollableContext.Provider> is a component — anatomy not extracted (wrapper components are review items)

## ScrollContainer

- source: `examples/polaris/.polaris-clone/polaris-react/src/components/IndexTable/components/ScrollContainer/ScrollContainer.tsx` (react-tsx)
- proposed: 0 props, 0 events
- anatomy EXTRACTED from JSX + CSS Module — 1 part(s), 0 token binding(s), 0 raw value(s) reported. Anatomy is human-REVIEWED: check it against design intent before adoption.
- prop `children`: platform prop — not contract API, skipped
- prop `scrollableContainerRef`: unclassified type — not proposed, review manually
- jsx: root element <ScrollContext.Provider> is a component — anatomy not extracted (wrapper components are review items)

## ScrollLock

- source: `examples/polaris/.polaris-clone/polaris-react/src/components/ScrollLock/ScrollLock.ts` (react-tsx)
- proposed: 0 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- props type resolved with NO members — a zero-prop API is what this module declares; review

## Search

- source: `examples/polaris/.polaris-clone/polaris-react/src/components/TopBar/components/Search/Search.tsx` (react-tsx)
- proposed: 2 props, 0 events
- anatomy EXTRACTED from JSX + CSS Module — 1 part(s), 0 token binding(s), 0 raw value(s) reported. Anatomy is human-REVIEWED: check it against design intent before adoption.
- prop `children`: platform prop — not contract API, skipped
- jsx: component returns a Fragment — contract anatomy needs a single root element, anatomy not extracted

## SearchDismissOverlay

- source: `examples/polaris/.polaris-clone/polaris-react/src/components/TopBar/components/SearchDismissOverlay/SearchDismissOverlay.tsx` (react-tsx)
- proposed: 1 props, 0 events
- anatomy EXTRACTED from JSX + CSS Module — 1 part(s), 0 token binding(s), 0 raw value(s) reported. Anatomy is human-REVIEWED: check it against design intent before adoption.
- jsx: component returns a Fragment — contract anatomy needs a single root element, anatomy not extracted

## SearchField

- source: `examples/polaris/.polaris-clone/polaris-react/src/components/Filters/components/SearchField/SearchField.tsx` (react-tsx)
- proposed: 7 props, 4 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- event `onChange`: declared with trigger 'root' — assign the real trigger part once anatomy is authored
- event `onFocus`: declared with trigger 'root' — assign the real trigger part once anatomy is authored
- event `onBlur`: declared with trigger 'root' — assign the real trigger part once anatomy is authored
- event `onClear`: declared with trigger 'root' — assign the real trigger part once anatomy is authored

## SearchFilterButton

- source: `examples/polaris/.polaris-clone/polaris-react/src/components/IndexFilters/components/SearchFilterButton/SearchFilterButton.tsx` (react-tsx)
- proposed: 6 props, 1 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- event `onClick`: declared with trigger 'root' — assign the real trigger part once anatomy is authored
- prop `style`: platform prop — not contract API, skipped

## SecondaryAction

- source: `examples/polaris/.polaris-clone/polaris-react/src/components/ActionMenu/components/SecondaryAction/SecondaryAction.tsx` (react-tsx)
- proposed: 1 props, 0 events
- anatomy EXTRACTED from JSX + CSS Module — 1 part(s), 1 token binding(s), 0 raw value(s) reported. Anatomy is human-REVIEWED: check it against design intent before adoption.
- prop `helpText`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually
- jsx: root className classNames(…) read — root class ".SecondaryAction"
- jsx: root className argument `tone === 'critical' && styles.critical` — not readable as a class binding, skipped by name
- jsx: root class ".SecondaryAction" extracted as the contract root part (contract roots are named "root")
- jsx: part "root" renders {actionMarkup} — not a known text/node prop, not extracted
- css: at-rule `@media (--p-breakpoints-md-up)` skipped — not extractable into anatomy
- css: selector `.SecondaryAction a` — not extractable into anatomy, skipped by name
- css: selector `.SecondaryAction button` — not extractable into anatomy, skipped by name
- css: selector `.SecondaryAction a:is(:hover, :focus)` — not extractable into anatomy, skipped by name
- css: selector `.SecondaryAction button:is(:hover, :focus)` — not extractable into anatomy, skipped by name
- css: selector `.SecondaryAction a:active` — not extractable into anatomy, skipped by name
- css: selector `.SecondaryAction a[aria-expanded='true']` — not extractable into anatomy, skipped by name
- css: selector `.SecondaryAction button:active` — not extractable into anatomy, skipped by name
- css: selector `.SecondaryAction button[aria-expanded='true']` — not extractable into anatomy, skipped by name
- css: selector `.SecondaryAction a:focus-visible` — not extractable into anatomy, skipped by name
- css: selector `.SecondaryAction button:focus-visible` — not extractable into anatomy, skipped by name
- css: selector `.SecondaryAction a[aria-disabled='true']` — not extractable into anatomy, skipped by name
- css: selector `.SecondaryAction button[aria-disabled='true']` — not extractable into anatomy, skipped by name
- css: selector `.SecondaryAction.critical` — not extractable into anatomy, skipped by name
- css: selector `.SecondaryAction.critical a` — not extractable into anatomy, skipped by name
- css: selector `.SecondaryAction.critical button` — not extractable into anatomy, skipped by name
- css: selector `.SecondaryAction.critical a svg` — not extractable into anatomy, skipped by name
- css: selector `.SecondaryAction.critical button svg` — not extractable into anatomy, skipped by name
- css: selector `.SecondaryAction.critical a:is(:hover, :focus)` — not extractable into anatomy, skipped by name
- css: selector `.SecondaryAction.critical button:is(:hover, :focus)` — not extractable into anatomy, skipped by name
- css: selector `.SecondaryAction.critical a:active` — not extractable into anatomy, skipped by name
- css: selector `.SecondaryAction.critical button:active` — not extractable into anatomy, skipped by name

## SecondaryNavigation

- source: `examples/polaris/.polaris-clone/polaris-react/src/components/Navigation/components/Item/components/SecondaryNavigation/SecondaryNavigation.tsx` (react-tsx)
- proposed: 3 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- prop `ItemComponent`: unclassified type — not proposed, review manually
- prop `icon`: unclassified type — not proposed, review manually
- prop `longestMatch`: unclassified type — not proposed, review manually
- prop `subNavigationItems`: unclassified type — not proposed, review manually

## Section

- source: `examples/polaris/.polaris-clone/polaris-react/src/components/ActionList/components/Section/Section.tsx` (react-tsx)
- proposed: 2 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- prop `section`: unclassified type — not proposed, review manually
- prop `actionRole`: unclassified type — not proposed, review manually
- prop `onActionAnyItem`: unclassified type — not proposed, review manually

## Select

- source: `examples/polaris/.polaris-clone/polaris-react/src/components/Select/Select.tsx` (react-tsx)
- proposed: 7 props, 0 events
- anatomy EXTRACTED from JSX + CSS Module — 1 part(s), 0 token binding(s), 0 raw value(s) reported. Anatomy is human-REVIEWED: check it against design intent before adoption.
- prop `options`: unclassified type — not proposed, review manually
- prop `label`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually
- prop `labelAction`: unclassified type — not proposed, review manually
- prop `helpText`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually
- prop `id`: platform prop — not contract API, skipped
- prop `error`: unclassified type — not proposed, review manually
- prop `tone`: unclassified type — not proposed, review manually
- jsx: root element <Labelled> is a component — anatomy not extracted (wrapper components are review items)

## SelectAllActions

- source: `examples/polaris/.polaris-clone/polaris-react/src/components/SelectAllActions/SelectAllActions.tsx` (react-tsx)
- proposed: 7 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- prop `paginatedSelectAllAction`: unclassified type — not proposed, review manually
- prop `selected`: unclassified type — not proposed, review manually

## SettingAction

- source: `examples/polaris/.polaris-clone/polaris-react/src/components/SettingAction/SettingAction.tsx` (react-tsx)
- proposed: 0 props, 0 events
- anatomy EXTRACTED from JSX + CSS Module — 3 part(s), 4 token binding(s), 0 raw value(s) reported. Anatomy is human-REVIEWED: check it against design intent before adoption.
- prop `action`: ReactNode — extracted as anatomy slot "action"
- prop `children`: platform prop — not contract API, skipped
- jsx: root class ".SettingAction" extracted as the contract root part (contract roots are named "root")
- css: at-rule `@media (--p-breakpoints-md-up)` skipped — not extractable into anatomy
- css: .SettingAction { flex-wrap: wrap } — no inversion rule, not extracted
- css: .SettingAction { margin-top: calc(-1 * var(--p-space-400)) } — var() inside a shorthand is not invertible to a single binding, not extracted
- css: .SettingAction { margin-left: calc(-1 * var(--p-space-400)) } — var() inside a shorthand is not invertible to a single binding, not extracted
- css: .Setting { flex: 0 0 auto } — no inversion rule, not extracted
- css: .Setting { max-width: calc(100% - var(--p-space-400)) } — var() inside a shorthand is not invertible to a single binding, not extracted
- css: .Action { flex: 0 0 auto } — no inversion rule, not extracted
- css: .Action { max-width: calc(100% - var(--p-space-400)) } — var() inside a shorthand is not invertible to a single binding, not extracted
- css: .Setting { flex: 1 0 350px } — no inversion rule, not extracted

## SettingToggle

- source: `examples/polaris/.polaris-clone/polaris-react/src/components/SettingToggle/SettingToggle.tsx` (react-tsx)
- proposed: 1 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- prop `children`: platform prop — not contract API, skipped
- prop `action`: unclassified type — not proposed, review manually

## ShadowBevel

- source: `examples/polaris/.polaris-clone/polaris-react/src/components/ShadowBevel/ShadowBevel.tsx` (react-tsx)
- proposed: 1 props, 0 events
- anatomy EXTRACTED from JSX + CSS Module — 1 part(s), 0 token binding(s), 0 raw value(s) reported. Anatomy is human-REVIEWED: check it against design intent before adoption.
- prop `as`: unclassified type — not proposed, review manually
- prop `children`: platform prop — not contract API, skipped
- prop `boxShadow`: unclassified type — not proposed, review manually
- prop `borderRadius`: unclassified type — not proposed, review manually
- prop `bevel`: unclassified type — not proposed, review manually
- jsx: root element <Component> is a component — anatomy not extracted (wrapper components are review items)

## Sheet

- source: `examples/polaris/.polaris-clone/polaris-react/src/components/Sheet/Sheet.tsx` (react-tsx)
- proposed: 2 props, 0 events
- anatomy EXTRACTED from JSX + CSS Module — 1 part(s), 0 token binding(s), 0 raw value(s) reported. Anatomy is human-REVIEWED: check it against design intent before adoption.
- prop `children`: platform prop — not contract API, skipped
- prop `activator`: unclassified type — not proposed, review manually
- jsx: component returns a Fragment — contract anatomy needs a single root element, anatomy not extracted

## SingleThumb

- source: `examples/polaris/.polaris-clone/polaris-react/src/components/RangeSlider/components/SingleThumb/SingleThumb.tsx` (react-tsx)
- proposed: 4 props, 0 events
- anatomy EXTRACTED from JSX + CSS Module — 1 part(s), 0 token binding(s), 0 raw value(s) reported. Anatomy is human-REVIEWED: check it against design intent before adoption.
- prop `id`: platform prop — not contract API, skipped
- jsx: root element <Labelled> is a component — anatomy not extracted (wrapper components are review items)

## SkeletonBodyText

- source: `examples/polaris/.polaris-clone/polaris-react/src/components/SkeletonBodyText/SkeletonBodyText.tsx` (react-tsx)
- proposed: 1 props, 0 events
- anatomy EXTRACTED from JSX + CSS Module — 1 part(s), 0 token binding(s), 1 raw value(s) reported. Anatomy is human-REVIEWED: check it against design intent before adoption.
- RAW VALUE (not tokenized): `.SkeletonBodyTextContainer { width: 100% }` — no token in the tree has this value. A raw value is reported, never turned into an invented token; bind it to a real token and re-extract.
- jsx: root class ".SkeletonBodyTextContainer" extracted as the contract root part (contract roots are named "root")
- jsx: part "root" renders {bodyTextLines} — not a known text/node prop, not extracted
- css: at-rule `@media screen and (-ms-high-contrast: active)` skipped — not extractable into anatomy
- css: selector `.SkeletonBodyText:last-child:not(:first-child)` — pseudo ":last-child:not(:first-child)" is not a contract state, not extracted
- css: selector `.SkeletonBodyText + .SkeletonBodyText` — not extractable into anatomy, skipped by name
- css: class ".SkeletonBodyText" has declarations but no matching extracted JSX part — styles not attached, review by name

## SkeletonDisplayText

- source: `examples/polaris/.polaris-clone/polaris-react/src/components/SkeletonDisplayText/SkeletonDisplayText.tsx` (react-tsx)
- proposed: 1 props, 0 events
- anatomy EXTRACTED from JSX + CSS Module — 1 part(s), 0 token binding(s), 2 raw value(s) reported. Anatomy is human-REVIEWED: check it against design intent before adoption.
- prop `size`: type resolved heuristically — review
- prop `size`: figma binding INFERRED as VARIANT "Size" — confirm against the design library (reconcile step)
- prop `maxWidth`: unclassified type — not proposed, review manually
- RAW VALUE (not tokenized): `.sizeExtraLarge { --pc-skeleton-display-text-height: 36px }` — no token in the tree has this value. A raw value is reported, never turned into an invented token; bind it to a real token and re-extract.
- RAW VALUE (not tokenized): `.sizeExtraLarge { --pc-skeleton-display-text-height-not-condensed: 44px }` — no token in the tree has this value. A raw value is reported, never turned into an invented token; bind it to a real token and re-extract.
- jsx: root className className is not a CSS-module reference — parts under it are still read where legible
- css: at-rule `@media screen and (-ms-high-contrast: active)` skipped — not extractable into anatomy
- css: at-rule `@media (--p-breakpoints-md-up)` skipped — not extractable into anatomy
- css: .DisplayText { --pc-skeleton-display-text-height-not-condensed: var( --p-font-line-height-500 ) } — var() inside a shorthand is not invertible to a single binding, not extracted
- css: .DisplayText { max-width: var(--pc-skeleton-display-text-max-width, 120px) } — var() inside a shorthand is not invertible to a single binding, not extracted
- css: .DisplayText { height } uses var(--pc-skeleton-display-text-height) which resolves to NO token in the token tree — binding not proposed
- css: .sizeSmall { --pc-skeleton-display-text-height-not-condensed: var( --p-font-line-height-700 ) } — var() inside a shorthand is not invertible to a single binding, not extracted
- css: .sizeMedium { --pc-skeleton-display-text-height-not-condensed: var( --p-font-line-height-800 ) } — var() inside a shorthand is not invertible to a single binding, not extracted
- css: .sizeLarge { --pc-skeleton-display-text-height-not-condensed: var( --p-font-line-height-800 ) } — var() inside a shorthand is not invertible to a single binding, not extracted
- css: class ".DisplayText" has declarations but no matching extracted JSX part — styles not attached, review by name
- css: class ".sizeSmall" has declarations but no matching extracted JSX part — styles not attached, review by name
- css: class ".sizeMedium" has declarations but no matching extracted JSX part — styles not attached, review by name
- css: class ".sizeLarge" has declarations but no matching extracted JSX part — styles not attached, review by name
- css: class ".sizeExtraLarge" has declarations but no matching extracted JSX part — styles not attached, review by name

## SkeletonPage

- source: `examples/polaris/.polaris-clone/polaris-react/src/components/SkeletonPage/SkeletonPage.tsx` (react-tsx)
- proposed: 5 props, 0 events
- anatomy EXTRACTED from JSX + CSS Module — 1 part(s), 0 token binding(s), 0 raw value(s) reported. Anatomy is human-REVIEWED: check it against design intent before adoption.
- prop `children`: platform prop — not contract API, skipped
- jsx: root element <BlockStack> is a component — anatomy not extracted (wrapper components are review items)

## SkeletonTabs

- source: `examples/polaris/.polaris-clone/polaris-react/src/components/SkeletonTabs/SkeletonTabs.tsx` (react-tsx)
- proposed: 2 props, 0 events
- anatomy EXTRACTED from JSX + CSS Module — 1 part(s), 0 token binding(s), 1 raw value(s) reported. Anatomy is human-REVIEWED: check it against design intent before adoption.
- RAW VALUE (not tokenized): `.Tabs { width: 100% }` — no token in the tree has this value. A raw value is reported, never turned into an invented token; bind it to a real token and re-extract.
- jsx: root className classNames(…) read — root class ".Tabs"; boolean modifier class(es): .fitted (fitted)
- jsx: root class ".Tabs" extracted as the contract root part (contract roots are named "root")
- jsx: part "root" expression `[...Array(count).keys()].map((key) => {
        return (
   ` — not extractable, skipped by name
- css: at-rule `@media (--p-breakpoints-md-up)` skipped — not extractable into anatomy
- css: at-rule `@media (--p-breakpoints-md-up)` skipped — not extractable into anatomy
- css: at-rule `@media screen and (-ms-high-contrast: active)` skipped — not extractable into anatomy
- css: at-rule `@media (--p-breakpoints-md-up)` skipped — not extractable into anatomy
- css: at-rule `@media (--p-breakpoints-md-up)` skipped — not extractable into anatomy
- css: .Tabs { overflow: auto } — no inversion rule, not extracted
- css: .Tab { height: calc(var(--p-height-800) + var(--p-height-400)) } — var() inside a shorthand is not invertible to a single binding, not extracted
- css: selector `.Tab:last-child` — pseudo ":last-child" is not a contract state, not extracted
- css: .fitted — styles behind boolean prop "fitted" (1 declaration(s)); boolean-conditional styling is not extractable into anatomy, review by name
- css: selector `.fitted .Tab` — descendant rule not under an enum class, not extracted
- css: selector `.fitted .TabText` — descendant rule not under an enum class, not extracted
- css: class ".Tab" has declarations but no matching extracted JSX part — styles not attached, review by name
- css: class ".TabText" has declarations but no matching extracted JSX part — styles not attached, review by name

## SkeletonThumbnail

- source: `examples/polaris/.polaris-clone/polaris-react/src/components/SkeletonThumbnail/SkeletonThumbnail.tsx` (react-tsx)
- proposed: 1 props, 0 events
- anatomy EXTRACTED from JSX + CSS Module — 1 part(s), 0 token binding(s), 4 raw value(s) reported. Anatomy is human-REVIEWED: check it against design intent before adoption.
- prop `size`: type resolved heuristically — review
- prop `size`: figma binding INFERRED as VARIANT "Size" — confirm against the design library (reconcile step)
- RAW VALUE (not tokenized): `.SkeletonThumbnail { --pc-skeleton-thumbnail-extra-small-size: 24px }` — no token in the tree has this value. A raw value is reported, never turned into an invented token; bind it to a real token and re-extract.
- RAW VALUE (not tokenized): `.SkeletonThumbnail { --pc-skeleton-thumbnail-small-size: 40px }` — no token in the tree has this value. A raw value is reported, never turned into an invented token; bind it to a real token and re-extract.
- RAW VALUE (not tokenized): `.SkeletonThumbnail { --pc-skeleton-thumbnail-medium-size: 60px }` — no token in the tree has this value. A raw value is reported, never turned into an invented token; bind it to a real token and re-extract.
- RAW VALUE (not tokenized): `.SkeletonThumbnail { --pc-skeleton-thumbnail-large-size: 80px }` — no token in the tree has this value. A raw value is reported, never turned into an invented token; bind it to a real token and re-extract.
- jsx: root className className is not a CSS-module reference — parts under it are still read where legible
- css: at-rule `@media screen and (-ms-high-contrast: active)` skipped — not extractable into anatomy
- css: .sizeExtraSmall { height } uses var(--pc-skeleton-thumbnail-extra-small-size) which resolves to NO token in the token tree — binding not proposed
- css: .sizeExtraSmall { width } uses var(--pc-skeleton-thumbnail-extra-small-size) which resolves to NO token in the token tree — binding not proposed
- css: .sizeSmall { height } uses var(--pc-skeleton-thumbnail-small-size) which resolves to NO token in the token tree — binding not proposed
- css: .sizeSmall { width } uses var(--pc-skeleton-thumbnail-small-size) which resolves to NO token in the token tree — binding not proposed
- css: .sizeMedium { height } uses var(--pc-skeleton-thumbnail-medium-size) which resolves to NO token in the token tree — binding not proposed
- css: .sizeMedium { width } uses var(--pc-skeleton-thumbnail-medium-size) which resolves to NO token in the token tree — binding not proposed
- css: .sizeLarge { height } uses var(--pc-skeleton-thumbnail-large-size) which resolves to NO token in the token tree — binding not proposed
- css: .sizeLarge { width } uses var(--pc-skeleton-thumbnail-large-size) which resolves to NO token in the token tree — binding not proposed
- css: class ".SkeletonThumbnail" has declarations but no matching extracted JSX part — styles not attached, review by name
- css: class ".sizeExtraSmall" has declarations but no matching extracted JSX part — styles not attached, review by name
- css: class ".sizeSmall" has declarations but no matching extracted JSX part — styles not attached, review by name
- css: class ".sizeMedium" has declarations but no matching extracted JSX part — styles not attached, review by name
- css: class ".sizeLarge" has declarations but no matching extracted JSX part — styles not attached, review by name

## SortButton

- source: `examples/polaris/.polaris-clone/polaris-react/src/components/IndexFilters/components/SortButton/SortButton.tsx` (react-tsx)
- proposed: 2 props, 3 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- prop `choices`: unclassified type — not proposed, review manually
- prop `selected`: unclassified type — not proposed, review manually
- event `onChange`: declared with trigger 'root' — assign the real trigger part once anatomy is authored
- event `onChangeKey`: declared with trigger 'root' — assign the real trigger part once anatomy is authored
- event `onChangeDirection`: declared with trigger 'root' — assign the real trigger part once anatomy is authored

## Spinner

- source: `examples/polaris/.polaris-clone/polaris-react/src/components/Spinner/Spinner.tsx` (react-tsx)
- proposed: 3 props, 0 events
- anatomy EXTRACTED from JSX + CSS Module — 1 part(s), 0 token binding(s), 0 raw value(s) reported. Anatomy is human-REVIEWED: check it against design intent before adoption.
- prop `size`: type resolved heuristically — review
- prop `size`: figma binding INFERRED as VARIANT "Size" — confirm against the design library (reconcile step)
- jsx: component returns a Fragment — contract anatomy needs a single root element, anatomy not extracted

## Sticky

- source: `examples/polaris/.polaris-clone/polaris-react/src/components/Sticky/Sticky.tsx` (react-tsx)
- proposed: 2 props, 1 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- props type composes named reference(s) [| {children: React.ReactNode}
  | {children(isSticky: boolean): React.ReactNode}] whose members are outside module scope — those props are NOT carried (single-file extraction)
- prop `boundingElement`: unclassified type — not proposed, review manually
- event `onStickyChange`: declared with trigger 'root' — assign the real trigger part once anatomy is authored

## Subsection

- source: `examples/polaris/.polaris-clone/polaris-react/src/components/LegacyCard/components/Subsection/Subsection.tsx` (react-tsx)
- proposed: 0 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- prop `children`: platform prop — not contract API, skipped

## Tab

- source: `examples/polaris/.polaris-clone/polaris-react/src/components/LegacyTabs/components/Tab/Tab.tsx` (react-tsx)
- proposed: 7 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- prop `id`: platform prop — not contract API, skipped
- prop `children`: platform prop — not contract API, skipped

## TabMeasurer

- source: `examples/polaris/.polaris-clone/polaris-react/src/components/LegacyTabs/components/TabMeasurer/TabMeasurer.tsx` (react-tsx)
- proposed: 3 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- prop `activator`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually
- prop `tabs`: unclassified type — not proposed, review manually

## Tabs

- source: `examples/polaris/.polaris-clone/polaris-react/src/components/Tabs/Tabs.tsx` (react-tsx)
- proposed: 7 props, 2 events
- anatomy EXTRACTED from JSX + CSS Module — 2 part(s), 0 token binding(s), 9 raw value(s) reported. Anatomy is human-REVIEWED: check it against design intent before adoption.
- prop `tabs`: unclassified type — not proposed, review manually
- prop `children`: platform prop — not contract API, skipped
- event `onSelect`: declared with trigger 'root' — assign the real trigger part once anatomy is authored
- event `onCreateNewView`: declared with trigger 'root' — assign the real trigger part once anatomy is authored
- anatomy: component ref `<Box>` mapped to contract id `polaris.box` — confirm that contract exists (or adjust the id) before adoption
- RAW VALUE (not tokenized): `.Tab { -webkit-tap-highlight-color: rgba(0, 0, 0, 0) }` — nearest tokens by value: `{p.color-bg-surface-transparent}`. A raw value is reported, never turned into an invented token; bind it to a real token and re-extract.
- RAW VALUE (not tokenized): `.Tab { background-color: transparent }` — no token in the tree has this value. A raw value is reported, never turned into an invented token; bind it to a real token and re-extract.
- RAW VALUE (not tokenized): `.Tab { width: 100% }` — no token in the tree has this value. A raw value is reported, never turned into an invented token; bind it to a real token and re-extract.
- RAW VALUE (not tokenized): `.Tab { min-width: 100% }` — no token in the tree has this value. A raw value is reported, never turned into an invented token; bind it to a real token and re-extract.
- RAW VALUE (not tokenized): `.Item { width: 100% }` — no token in the tree has this value. A raw value is reported, never turned into an invented token; bind it to a real token and re-extract.
- RAW VALUE (not tokenized): `.DisclosureActivator { height: 100% }` — no token in the tree has this value. A raw value is reported, never turned into an invented token; bind it to a real token and re-extract.
- RAW VALUE (not tokenized): `.DisclosureActivator { background-color: transparent }` — no token in the tree has this value. A raw value is reported, never turned into an invented token; bind it to a real token and re-extract.
- RAW VALUE (not tokenized): `.TabsMeasurer { gap: 0 }` — no token in the tree has this value. A raw value is reported, never turned into an invented token; bind it to a real token and re-extract.
- RAW VALUE (not tokenized): `.TabsMeasurer { height: 0 }` — no token in the tree has this value. A raw value is reported, never turned into an invented token; bind it to a real token and re-extract.
- jsx: root class ".Outer" extracted as the contract root part (contract roots are named "root")
- jsx: <Box> prop padding={…} — expression not extractable on a component ref, skipped
- jsx: <Box> has non-text children — component-ref content not extracted
- jsx: part "root" renders {panelMarkup} — not a known text/node prop, not extracted
- css: at-rule `@media (--p-breakpoints-md-down)` skipped — not extractable into anatomy
- css: at-rule `@media (--p-breakpoints-md-down)` skipped — not extractable into anatomy
- css: at-rule `@media (--p-breakpoints-md-up)` skipped — not extractable into anatomy
- css: at-rule `@media (--p-breakpoints-md-down)` skipped — not extractable into anatomy
- css: at-rule `@media (--p-breakpoints-md-up)` skipped — not extractable into anatomy
- css: at-rule `@media (--p-breakpoints-md-up)` skipped — not extractable into anatomy
- css: selector `:root` — not extractable into anatomy, skipped by name
- css: .Tabs { list-style: none } — no inversion rule, not extracted
- css: .Tab { text-decoration: none } — no inversion rule, not extracted
- css: .Tab { margin-bottom: calc(-1 * var(--p-space-025)) } — var() inside a shorthand is not invertible to a single binding, not extracted
- css: .Tab { outline: none } — no inversion rule, not extracted
- css: .Tab { text-align: center } — no inversion rule, not extracted
- css: .Tab { white-space: nowrap } — no inversion rule, not extracted
- css: selector `.Tab[aria-disabled='true']` — not extractable into anatomy, skipped by name
- css: selector `.Tab[aria-disabled='true'] path` — not extractable into anatomy, skipped by name
- css: selector `.Tab:not([aria-disabled='true']):hover` — pseudo ":not([aria-disabled='true']):hover" is not a contract state, not extracted
- css: selector `.Tab:not([aria-disabled='true']):focus` — pseudo ":not([aria-disabled='true']):focus" is not a contract state, not extracted
- css: selector `.Tab:not([aria-disabled='true']):focus-visible` — pseudo ":not([aria-disabled='true']):focus-visible" is not a contract state, not extracted
- css: selector `.Tab:not([aria-disabled='true']):focus-visible:not(:active)` — pseudo ":not([aria-disabled='true']):focus-visible:not(:active)" is not a contract state, not extracted
- css: selector `.Tab:not([aria-disabled='true']):active` — pseudo ":not([aria-disabled='true']):active" is not a contract state, not extracted
- css: selector `.Tab path` — not extractable into anatomy, skipped by name
- css: selector `.Tab-active[aria-disabled='true']` — not extractable into anatomy, skipped by name
- css: selector `.Tab-active:not([aria-disabled='true']):hover` — pseudo ":not([aria-disabled='true']):hover" is not a contract state, not extracted
- css: selector `.Tab-active:not([aria-disabled='true']):focus` — pseudo ":not([aria-disabled='true']):focus" is not a contract state, not extracted
- css: selector `.Tab-active:not([aria-disabled='true']):active` — pseudo ":not([aria-disabled='true']):active" is not a contract state, not extracted
- css: selector `.fillSpace .TabContainer` — descendant rule not under an enum class, not extracted
- css: .fitted { flex-wrap: nowrap } — no inversion rule, not extracted
- css: selector `.fitted .TabContainer` — descendant rule not under an enum class, not extracted
- css: .List { list-style: none } — no inversion rule, not extracted
- css: .Item { display: block } — no inversion rule, not extracted
- css: .Item { min-height } uses var(--item-min-height) which resolves to NO token in the token tree — binding not proposed
- css: .Item { padding-block } uses var(--item-vertical-padding) which resolves to NO token in the token tree — binding not proposed
- css: .Item { text-align: left } — no inversion rule, not extracted
- css: .Item { text-decoration: none } — no inversion rule, not extracted
- css: selector `.Item::-moz-focus-inner` — not extractable into anatomy, skipped by name
- css: selector `.Item:hover` — part-scoped state pseudo; the contract vocabulary carries part-level states (Part.states, v13 — as `.root:hover .part` descendant rules) but CSS inversion of this shape is not implemented; declare it on the contract directly, review
- css: selector `.Item:active` — part-scoped state pseudo; the contract vocabulary carries part-level states (Part.states, v13 — as `.root:active .part` descendant rules) but CSS inversion of this shape is not implemented; declare it on the contract directly, review
- css: selector `.Item:focus-visible:not(:active)` — part-scoped state pseudo; the contract vocabulary carries part-level states (Part.states, v13 — as `.root:focus-visible:not(:active) .part` descendant rules) but CSS inversion of this shape is not implemented; declare it on the contract directly, review
- css: selector `.Item:visited` — pseudo ":visited" is not a contract state, not extracted
- css: .DisclosureTab { display: none } — no inversion rule, not extracted
- css: .DisclosureActivator { padding: 0 var(--p-space-200) 0 var(--p-space-300) } — var() inside a shorthand is not invertible to a single binding, not extracted
- css: .DisclosureActivator { outline: none } — no inversion rule, not extracted
- css: selector `.DisclosureActivator svg` — icon glyph sizing, not extracted (icon parts are review items)
- css: selector `.DisclosureActivator:hover svg` — not extractable into anatomy, skipped by name
- css: selector `.DisclosureActivator:focus svg` — not extractable into anatomy, skipped by name
- css: selector `.DisclosureActivator:not([aria-disabled='true']):hover` — pseudo ":not([aria-disabled='true']):hover" is not a contract state, not extracted
- css: selector `.DisclosureActivator:not([aria-disabled='true']):focus` — pseudo ":not([aria-disabled='true']):focus" is not a contract state, not extracted
- css: selector `.DisclosureActivator:not([aria-disabled='true']):focus-visible` — pseudo ":not([aria-disabled='true']):focus-visible" is not a contract state, not extracted
- css: selector `.DisclosureActivator:not([aria-disabled='true']):active` — pseudo ":not([aria-disabled='true']):active" is not a contract state, not extracted
- css: selector `.DisclosureActivator[aria-disabled='true']` — not extractable into anatomy, skipped by name
- css: selector `.DisclosureActivator[aria-disabled='true'] path` — not extractable into anatomy, skipped by name
- css: .TabsMeasurer { visibility: hidden } — no inversion rule, not extracted
- css: .NewTab { padding: 0 var(--p-space-200) 0 var(--p-space-100) } — var() inside a shorthand is not invertible to a single binding, not extracted
- css: .ActionListWrap { display: block } — no inversion rule, not extracted
- css: .Panel { display: block } — no inversion rule, not extracted
- css: selector `.Panel:focus` — pseudo ":focus" is not a contract state, not extracted
- css: .Panel-hidden { display: none } — no inversion rule, not extracted
- css: class ".Wrapper" has declarations but no matching extracted JSX part — styles not attached, review by name
- css: class ".WrapperWithNewButton" has declarations but no matching extracted JSX part — styles not attached, review by name
- css: class ".ButtonWrapper" has declarations but no matching extracted JSX part — styles not attached, review by name
- css: class ".Tabs" has declarations but no matching extracted JSX part — styles not attached, review by name
- css: class ".Tab" has declarations but no matching extracted JSX part — styles not attached, review by name
- css: class ".Tab-active" has declarations but no matching extracted JSX part — styles not attached, review by name
- css: class ".Tab-hasActions" has declarations but no matching extracted JSX part — styles not attached, review by name
- css: class ".Tab-iconOnly" has declarations but no matching extracted JSX part — styles not attached, review by name
- css: class ".fillSpace" has declarations but no matching extracted JSX part — styles not attached, review by name
- css: class ".fitted" has declarations but no matching extracted JSX part — styles not attached, review by name
- css: class ".TabContainer" has declarations but no matching extracted JSX part — styles not attached, review by name
- css: class ".titleWithIcon" has declarations but no matching extracted JSX part — styles not attached, review by name
- css: class ".List" has declarations but no matching extracted JSX part — styles not attached, review by name
- css: class ".Item" has declarations but no matching extracted JSX part — styles not attached, review by name
- css: class ".DisclosureTab" has declarations but no matching extracted JSX part — styles not attached, review by name
- css: class ".DisclosureTab-visible" has declarations but no matching extracted JSX part — styles not attached, review by name
- css: class ".DisclosureActivator" has declarations but no matching extracted JSX part — styles not attached, review by name
- css: class ".TabsMeasurer" has declarations but no matching extracted JSX part — styles not attached, review by name
- css: class ".NewTab" has declarations but no matching extracted JSX part — styles not attached, review by name
- css: class ".ActionListWrap" has declarations but no matching extracted JSX part — styles not attached, review by name
- css: class ".Panel" has declarations but no matching extracted JSX part — styles not attached, review by name
- css: class ".Panel-hidden" has declarations but no matching extracted JSX part — styles not attached, review by name

## Tag

- source: `examples/polaris/.polaris-clone/polaris-react/src/components/Tag/Tag.tsx` (react-tsx)
- proposed: 3 props, 0 events
- anatomy EXTRACTED from JSX + CSS Module — 1 part(s), 0 token binding(s), 6 raw value(s) reported. Anatomy is human-REVIEWED: check it against design intent before adoption.
- props type composes named reference(s) [| {onClick?(): void; onRemove?: undefined; url?: undefined}
    | {onClick?: undefined; onRemove?(): void; url?: string}] whose members are outside module scope — those props are NOT carried (single-file extraction)
- prop `children`: platform prop — not contract API, skipped
- prop `size`: unclassified type — not proposed, review manually
- RAW VALUE (not tokenized): `.Tag { max-width: 100% }` — no token in the tree has this value. A raw value is reported, never turned into an invented token; bind it to a real token and re-extract.
- RAW VALUE (not tokenized): `.Button { height: 18px }` — no token in the tree has this value. A raw value is reported, never turned into an invented token; bind it to a real token and re-extract.
- RAW VALUE (not tokenized): `.Button { width: 18px }` — no token in the tree has this value. A raw value is reported, never turned into an invented token; bind it to a real token and re-extract.
- RAW VALUE (not tokenized): `.Button { border-radius: 7px }` — no token in the tree has this value. A raw value is reported, never turned into an invented token; bind it to a real token and re-extract.
- RAW VALUE (not tokenized): `.sizeLarge { min-height: 24px }` — no token in the tree has this value. A raw value is reported, never turned into an invented token; bind it to a real token and re-extract.
- RAW VALUE (not tokenized): `.sizeLarge { padding-block: 0 }` — no token in the tree has this value. A raw value is reported, never turned into an invented token; bind it to a real token and re-extract.
- jsx: multiple JSX returns — anatomy read from the first
- jsx: root className className is not a CSS-module reference — parts under it are still read where legible
- jsx: <button> attribute disabled={…} — expression not extractable, skipped
- jsx: part "root" renders {tagText} — not a known text/node prop, not extracted
- css: at-rule `@media (hover: none)` skipped — not extractable into anatomy
- css: at-rule `@media (hover: none)` skipped — not extractable into anatomy
- css: at-rule `@media (hover: none)` skipped — not extractable into anatomy
- css: .Tag { padding-inline: calc(var(--p-space-100) + var(--p-space-050)) } — var() inside a shorthand is not invertible to a single binding, not extracted
- css: selector `.Tag.disabled` — not extractable into anatomy, skipped by name
- css: selector `.Tag.disabled svg` — not extractable into anatomy, skipped by name
- css: selector `.Tag.clickable` — not extractable into anatomy, skipped by name
- css: selector `.Tag.clickable:hover` — not extractable into anatomy, skipped by name
- css: selector `.Tag.clickable:focus-visible:not(:active)` — not extractable into anatomy, skipped by name
- css: selector `.Tag.clickable:active` — not extractable into anatomy, skipped by name
- css: selector `.Tag.clickable:disabled` — not extractable into anatomy, skipped by name
- css: selector `.Tag.linkable` — not extractable into anatomy, skipped by name
- css: selector `.Tag.linkable:hover` — not extractable into anatomy, skipped by name
- css: selector `.Tag.linkable:active` — not extractable into anatomy, skipped by name
- css: selector `.Tag.removable` — not extractable into anatomy, skipped by name
- css: .Button { display: block } — no inversion rule, not extracted
- css: .Button { flex-shrink: 0 } — no inversion rule, not extracted
- css: selector `.Button svg` — icon glyph sizing, not extracted (icon parts are review items)
- css: selector `.Button:hover` — part-scoped state pseudo; the contract vocabulary carries part-level states (Part.states, v13 — as `.root:hover .part` descendant rules) but CSS inversion of this shape is not implemented; declare it on the contract directly, review
- css: selector `.Button:focus-visible` — part-scoped state pseudo; the contract vocabulary carries part-level states (Part.states, v13 — as `.root:focus-visible .part` descendant rules) but CSS inversion of this shape is not implemented; declare it on the contract directly, review
- css: selector `.Button:focus-visible:not(:active)` — part-scoped state pseudo; the contract vocabulary carries part-level states (Part.states, v13 — as `.root:focus-visible:not(:active) .part` descendant rules) but CSS inversion of this shape is not implemented; declare it on the contract directly, review
- css: selector `.Button:active` — part-scoped state pseudo; the contract vocabulary carries part-level states (Part.states, v13 — as `.root:active .part` descendant rules) but CSS inversion of this shape is not implemented; declare it on the contract directly, review
- css: selector `.Button:disabled` — part-scoped state pseudo; the contract vocabulary carries part-level states (Part.states, v13 — as `.root:disabled .part` descendant rules) but CSS inversion of this shape is not implemented; declare it on the contract directly, review
- css: selector `.Button:disabled svg` — not extractable into anatomy, skipped by name
- css: .Link { display: inline-grid } — no inversion rule, not extracted
- css: .Link { outline: none } — no inversion rule, not extracted
- css: .Link { text-decoration: none } — no inversion rule, not extracted
- css: selector `.Link:focus-visible:not(:active)` — part-scoped state pseudo; the contract vocabulary carries part-level states (Part.states, v13 — as `.root:focus-visible:not(:active) .part` descendant rules) but CSS inversion of this shape is not implemented; declare it on the contract directly, review
- css: selector `.Link:hover` — part-scoped state pseudo; the contract vocabulary carries part-level states (Part.states, v13 — as `.root:hover .part` descendant rules) but CSS inversion of this shape is not implemented; declare it on the contract directly, review
- css: selector `.Link.segmented` — not extractable into anatomy, skipped by name
- css: selector `.Link.segmented:hover` — not extractable into anatomy, skipped by name
- css: selector `.Link.segmented::after` — not extractable into anatomy, skipped by name
- css: selector `.Link:active` — part-scoped state pseudo; the contract vocabulary carries part-level states (Part.states, v13 — as `.root:active .part` descendant rules) but CSS inversion of this shape is not implemented; declare it on the contract directly, review
- css: selector `.linkable.removable:hover` — not extractable into anatomy, skipped by name
- css: selector `.linkable.removable:hover .Button` — not extractable into anatomy, skipped by name
- css: selector `.sizeLarge:is(.removable, .linkable)` — pseudo ":is(.removable, .linkable)" is not a contract state, not extracted
- css: selector `.sizeLarge .Link.segmented::after` — not extractable into anatomy, skipped by name
- css: selector `.sizeLarge .Button` — descendant rule not under an enum class, not extracted
- css: selector `.sizeLarge .Button:hover` — not extractable into anatomy, skipped by name
- css: selector `.sizeLarge .Button:active` — not extractable into anatomy, skipped by name
- css: selector `.sizeLarge .Button:focus` — not extractable into anatomy, skipped by name
- css: selector `.sizeLarge:hover .Button` — part-level state rule; the contract vocabulary carries it (Part.states, v13 — color-kind channels) but CSS inversion of part-state rules is not implemented; declare it on the contract directly, review
- css: selector `.sizeLarge .Button:focus-visible` — not extractable into anatomy, skipped by name
- css: selector `.sizeLarge:hover .overlay` — part-level state rule; the contract vocabulary carries it (Part.states, v13 — color-kind channels) but CSS inversion of part-state rules is not implemented; declare it on the contract directly, review
- css: selector `.sizeLarge.removable.linkable` — not extractable into anatomy, skipped by name
- css: selector `.sizeLarge.removable.linkable .Button` — not extractable into anatomy, skipped by name
- css: selector `.sizeLarge.removable.linkable:hover .overlay` — not extractable into anatomy, skipped by name
- css: class ".Tag" has declarations but no matching extracted JSX part — styles not attached, review by name
- css: class ".Button" has declarations but no matching extracted JSX part — styles not attached, review by name
- css: class ".Link" has declarations but no matching extracted JSX part — styles not attached, review by name
- css: class ".Text" has declarations but no matching extracted JSX part — styles not attached, review by name
- css: class ".sizeLarge" has declarations but no matching extracted JSX part — styles not attached, review by name

## TagsWrapper

- source: `examples/polaris/.polaris-clone/polaris-react/src/components/LegacyFilters/components/TagsWrapper/TagsWrapper.tsx` (react-tsx)
- proposed: 1 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- prop `children`: platform prop — not contract API, skipped

## Text

- source: `examples/polaris/.polaris-clone/polaris-react/src/components/Text/Text.tsx` (react-tsx)
- proposed: 9 props, 0 events
- anatomy EXTRACTED from JSX + CSS Module — 1 part(s), 0 token binding(s), 0 raw value(s) reported. Anatomy is human-REVIEWED: check it against design intent before adoption.
- prop `alignment`: type resolved heuristically — review
- prop `alignment`: figma binding INFERRED as VARIANT "Alignment" — confirm against the design library (reconcile step)
- prop `as`: type resolved heuristically — review
- prop `as`: figma binding INFERRED as VARIANT "As" — confirm against the design library (reconcile step)
- prop `children`: platform prop — not contract API, skipped
- prop `tone`: type resolved heuristically — review
- prop `tone`: figma binding INFERRED as VARIANT "Tone" — confirm against the design library (reconcile step)
- prop `fontWeight`: type resolved heuristically — review
- prop `fontWeight`: figma binding INFERRED as VARIANT "Font Weight" — confirm against the design library (reconcile step)
- prop `id`: platform prop — not contract API, skipped
- prop `variant`: type resolved heuristically — review
- prop `variant`: figma binding INFERRED as VARIANT "Variant" — confirm against the design library (reconcile step)
- prop `textDecorationLine`: unclassified type — not proposed, review manually
- jsx: root element <Component> is a component — anatomy not extracted (wrapper components are review items)

## TextContainer

- source: `examples/polaris/.polaris-clone/polaris-react/src/components/TextContainer/TextContainer.tsx` (react-tsx)
- proposed: 1 props, 0 events
- anatomy EXTRACTED from JSX + CSS Module — 1 part(s), 0 token binding(s), 0 raw value(s) reported. Anatomy is human-REVIEWED: check it against design intent before adoption.
- prop `spacing`: type resolved heuristically — review
- prop `spacing`: figma binding INFERRED as VARIANT "Spacing" — confirm against the design library (reconcile step)
- prop `children`: platform prop — not contract API, skipped
- jsx: root className className is not a CSS-module reference — parts under it are still read where legible
- jsx: root renders {children} directly — children channel (text prop vs default slot) is not decidable from code
- css: selector `.TextContainer > *:not(:first-child)` — not extractable into anatomy, skipped by name
- css: class ".TextContainer" has declarations but no matching extracted JSX part — styles not attached, review by name
- css: class ".spacingTight" has declarations but no matching extracted JSX part — styles not attached, review by name
- css: class ".spacingLoose" has declarations but no matching extracted JSX part — styles not attached, review by name

## TextField

- source: `examples/polaris/.polaris-clone/polaris-react/src/components/TextField/TextField.tsx` (react-tsx)
- proposed: 34 props, 1 events
- anatomy EXTRACTED from JSX + CSS Module — 1 part(s), 0 token binding(s), 0 raw value(s) reported. Anatomy is human-REVIEWED: check it against design intent before adoption.
- props type composes named reference(s) [| Interactive
  | Readonly
  | Disabled, | SelectSuggestion
  | SelectTextOnFocus] whose members are outside module scope — those props are NOT carried (single-file extraction)
- prop `prefix`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually
- prop `suffix`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually
- prop `verticalContent`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually
- prop `helpText`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually
- prop `label`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually
- prop `labelAction`: unclassified type — not proposed, review manually
- prop `multiline`: unclassified type — not proposed, review manually
- prop `error`: unclassified type — not proposed, review manually
- prop `connectedRight`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually
- prop `connectedLeft`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually
- prop `type`: type resolved heuristically — review
- prop `type`: figma binding INFERRED as VARIANT "Type" — confirm against the design library (reconcile step)
- prop `id`: platform prop — not contract API, skipped
- prop `max`: unclassified type — not proposed, review manually
- prop `maxHeight`: unclassified type — not proposed, review manually
- prop `min`: unclassified type — not proposed, review manually
- prop `inputMode`: type resolved heuristically — review
- prop `inputMode`: figma binding INFERRED as VARIANT "Input Mode" — confirm against the design library (reconcile step)
- prop `align`: type resolved heuristically — review
- prop `align`: figma binding INFERRED as VARIANT "Align" — confirm against the design library (reconcile step)
- prop `variant`: figma binding INFERRED as VARIANT "Variant" — confirm against the design library (reconcile step)
- prop `size`: figma binding INFERRED as VARIANT "Size" — confirm against the design library (reconcile step)
- event `onFocus`: declared with trigger 'root' — assign the real trigger part once anatomy is authored
- prop `tone`: unclassified type — not proposed, review manually
- jsx: root element <Labelled> is a component — anatomy not extracted (wrapper components are review items)

## TextOption

- source: `examples/polaris/.polaris-clone/polaris-react/src/components/Listbox/components/TextOption/TextOption.tsx` (react-tsx)
- proposed: 2 props, 0 events
- anatomy EXTRACTED from JSX + CSS Module — 2 part(s), 0 token binding(s), 0 raw value(s) reported. Anatomy is human-REVIEWED: check it against design intent before adoption.
- prop `children`: platform prop — not contract API, skipped
- jsx: root className textOptionClassName is not a CSS-module reference — parts under it are still read where legible
- jsx: part "content" conditional expression — not a `cond ? <el/> : null` shape, not extracted
- css: .TextOption { margin: var(--p-space-100) var(--p-space-200) 0 } — var() inside a shorthand is not invertible to a single binding, not extracted
- css: .TextOption { flex: 1 } — no inversion rule, not extracted
- css: selector `.TextOption.allowMultiple` — not extractable into anatomy, skipped by name
- css: selector `.TextOption.isAction` — not extractable into anatomy, skipped by name
- css: selector `.TextOption:hover` — part-scoped state pseudo; the contract vocabulary carries part-level states (Part.states, v13 — as `.root:hover .part` descendant rules) but CSS inversion of this shape is not implemented; declare it on the contract directly, review
- css: selector `.TextOption:hover:not(.disabled)` — pseudo ":hover:not(.disabled)" is not a contract state, not extracted
- css: selector `.TextOption:focus` — pseudo ":focus" is not a contract state, not extracted
- css: selector `.TextOption:active` — part-scoped state pseudo; the contract vocabulary carries part-level states (Part.states, v13 — as `.root:active .part` descendant rules) but CSS inversion of this shape is not implemented; declare it on the contract directly, review
- css: selector `.TextOption:active:not(.disabled)` — pseudo ":active:not(.disabled)" is not a contract state, not extracted
- css: selector `.TextOption.selected` — not extractable into anatomy, skipped by name
- css: selector `.TextOption.selected svg` — not extractable into anatomy, skipped by name
- css: selector `.TextOption.selected::before` — not extractable into anatomy, skipped by name
- css: selector `.TextOption.disabled` — not extractable into anatomy, skipped by name
- css: selector `li:first-of-type > .TextOption` — not extractable into anatomy, skipped by name
- css: selector `[data-focused] .TextOption:not(.disabled)` — not extractable into anatomy, skipped by name
- css: .Checkbox { pointer-events: none } — no inversion rule, not extracted
- css: class ".TextOption" has declarations but no matching extracted JSX part — styles not attached, review by name
- css: class ".Checkbox" has declarations but no matching extracted JSX part — styles not attached, review by name

## ThemeProvider

- source: `examples/polaris/.polaris-clone/polaris-react/src/components/ThemeProvider/ThemeProvider.tsx` (react-tsx)
- proposed: 0 props, 0 events
- anatomy EXTRACTED from JSX + CSS Module — 1 part(s), 0 token binding(s), 0 raw value(s) reported. Anatomy is human-REVIEWED: check it against design intent before adoption.
- prop `as`: unclassified type — not proposed, review manually
- prop `children`: platform prop — not contract API, skipped
- prop `className`: platform prop — not contract API, skipped
- prop `theme`: unclassified type — not proposed, review manually
- jsx: root element <ThemeNameContext.Provider> is a component — anatomy not extracted (wrapper components are review items)

## Thumbnail

- source: `examples/polaris/.polaris-clone/polaris-react/src/components/Thumbnail/Thumbnail.tsx` (react-tsx)
- proposed: 3 props, 0 events
- anatomy EXTRACTED from JSX + CSS Module — 1 part(s), 0 token binding(s), 6 raw value(s) reported. Anatomy is human-REVIEWED: check it against design intent before adoption.
- prop `size`: type resolved heuristically — review
- prop `size`: figma binding INFERRED as VARIANT "Size" — confirm against the design library (reconcile step)
- prop `source`: unclassified type — not proposed, review manually
- RAW VALUE (not tokenized): `.Thumbnail { --pc-thumbnail-extra-small-size: 24px }` — no token in the tree has this value. A raw value is reported, never turned into an invented token; bind it to a real token and re-extract.
- RAW VALUE (not tokenized): `.Thumbnail { --pc-thumbnail-small-size: 40px }` — no token in the tree has this value. A raw value is reported, never turned into an invented token; bind it to a real token and re-extract.
- RAW VALUE (not tokenized): `.Thumbnail { --pc-thumbnail-medium-size: 60px }` — no token in the tree has this value. A raw value is reported, never turned into an invented token; bind it to a real token and re-extract.
- RAW VALUE (not tokenized): `.Thumbnail { --pc-thumbnail-large-size: 80px }` — no token in the tree has this value. A raw value is reported, never turned into an invented token; bind it to a real token and re-extract.
- RAW VALUE (not tokenized): `.Thumbnail { max-width: 100% }` — no token in the tree has this value. A raw value is reported, never turned into an invented token; bind it to a real token and re-extract.
- RAW VALUE (not tokenized): `.transparent { background: transparent }` — no token in the tree has this value. A raw value is reported, never turned into an invented token; bind it to a real token and re-extract.
- jsx: root className className is not a CSS-module reference — parts under it are still read where legible
- jsx: part "root" renders {content} — not a known text/node prop, not extracted
- css: .Thumbnail { display: block } — no inversion rule, not extracted
- css: .Thumbnail { overflow: hidden } — no inversion rule, not extracted
- css: .Thumbnail { min-width } uses var(--pc-thumbnail-extra-small-size) which resolves to NO token in the token tree — binding not proposed
- css: selector `.Thumbnail::after` — not extractable into anatomy, skipped by name
- css: selector `.Thumbnail.sizeExtraSmall` — not extractable into anatomy, skipped by name
- css: selector `.Thumbnail.sizeExtraSmall::after` — not extractable into anatomy, skipped by name
- css: selector `.Thumbnail::before` — not extractable into anatomy, skipped by name
- css: .sizeExtraSmall { width } uses var(--pc-thumbnail-extra-small-size) which resolves to NO token in the token tree — binding not proposed
- css: .sizeSmall { width } uses var(--pc-thumbnail-small-size) which resolves to NO token in the token tree — binding not proposed
- css: .sizeMedium { width } uses var(--pc-thumbnail-medium-size) which resolves to NO token in the token tree — binding not proposed
- css: .sizeLarge { width } uses var(--pc-thumbnail-large-size) which resolves to NO token in the token tree — binding not proposed
- css: selector `.Thumbnail > *` — not extractable into anatomy, skipped by name
- css: selector `.Thumbnail > * svg` — not extractable into anatomy, skipped by name
- css: class ".Thumbnail" has declarations but no matching extracted JSX part — styles not attached, review by name
- css: class ".sizeExtraSmall" has declarations but no matching extracted JSX part — styles not attached, review by name
- css: class ".sizeSmall" has declarations but no matching extracted JSX part — styles not attached, review by name
- css: class ".sizeMedium" has declarations but no matching extracted JSX part — styles not attached, review by name
- css: class ".sizeLarge" has declarations but no matching extracted JSX part — styles not attached, review by name
- css: class ".transparent" has declarations but no matching extracted JSX part — styles not attached, review by name

## Title

- source: `examples/polaris/.polaris-clone/polaris-react/src/components/Page/components/Header/components/Title/Title.tsx` (react-tsx)
- proposed: 4 props, 0 events
- anatomy EXTRACTED from JSX + CSS Module — 1 part(s), 0 token binding(s), 0 raw value(s) reported. Anatomy is human-REVIEWED: check it against design intent before adoption.
- prop `titleMetadata`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually
- jsx: component returns a Fragment — contract anatomy needs a single root element, anatomy not extracted

## Toast

- source: `examples/polaris/.polaris-clone/polaris-react/src/components/Toast/Toast.tsx` (react-tsx)
- proposed: 0 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- props type has NO OWN members (extends ToastProps1 — parent members are outside single-file extraction): zero own props is what this module declares — review

## ToastManager

- source: `examples/polaris/.polaris-clone/polaris-react/src/components/Frame/components/ToastManager/ToastManager.tsx` (react-tsx)
- proposed: 0 props, 0 events
- anatomy EXTRACTED from JSX + CSS Module — 1 part(s), 0 token binding(s), 0 raw value(s) reported. Anatomy is human-REVIEWED: check it against design intent before adoption.
- prop `toastMessages`: unclassified type — not proposed, review manually
- jsx: root element <Portal> is a component — anatomy not extracted (wrapper components are review items)

## Tooltip

- source: `examples/polaris/.polaris-clone/polaris-react/src/components/Tooltip/Tooltip.tsx` (react-tsx)
- proposed: 8 props, 0 events
- anatomy EXTRACTED from JSX + CSS Module — 1 part(s), 0 token binding(s), 0 raw value(s) reported. Anatomy is human-REVIEWED: check it against design intent before adoption.
- prop `children`: platform prop — not contract API, skipped
- prop `content`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually
- prop `dismissOnMouseOut`: unclassified type — not proposed, review manually
- prop `preferredPosition`: unclassified type — not proposed, review manually
- prop `width`: type resolved heuristically — review
- prop `width`: figma binding INFERRED as VARIANT "Width" — confirm against the design library (reconcile step)
- prop `padding`: unclassified type — not proposed, review manually
- prop `borderRadius`: unclassified type — not proposed, review manually
- jsx: root element <WrapperComponent> is a component — anatomy not extracted (wrapper components are review items)

## TooltipOverlay

- source: `examples/polaris/.polaris-clone/polaris-react/src/components/Tooltip/components/TooltipOverlay/TooltipOverlay.tsx` (react-tsx)
- proposed: 4 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- prop `id`: platform prop — not contract API, skipped
- prop `preventInteraction`: unclassified type — not proposed, review manually
- prop `preferredPosition`: unclassified type — not proposed, review manually
- prop `children`: platform prop — not contract API, skipped
- prop `activator`: unclassified type — not proposed, review manually
- prop `width`: unclassified type — not proposed, review manually
- prop `padding`: unclassified type — not proposed, review manually
- prop `borderRadius`: unclassified type — not proposed, review manually

## TopBar

- source: `examples/polaris/.polaris-clone/polaris-react/src/components/TopBar/TopBar.tsx` (react-tsx)
- proposed: 3 props, 0 events
- anatomy EXTRACTED from JSX + CSS Module — 7 part(s), 5 token binding(s), 2 raw value(s) reported. Anatomy is human-REVIEWED: check it against design intent before adoption.
- prop `userMenu`: ReactNode — extracted as anatomy slot "userMenu"
- prop `secondaryMenu`: ReactNode — extracted as anatomy slot "secondaryMenu"
- prop `contextControl`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually
- prop `searchField`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually
- prop `searchResults`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually
- prop `onSearchResultsDismiss`: unclassified type — not proposed, review manually
- prop `logoSuffix`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually
- RAW VALUE (not tokenized): `.LogoContainer { height: 100% }` — no token in the tree has this value. A raw value is reported, never turned into an invented token; bind it to a real token and re-extract.
- RAW VALUE (not tokenized): `.Search { height: 100% }` — no token in the tree has this value. A raw value is reported, never turned into an invented token; bind it to a real token and re-extract.
- jsx: root class ".TopBar" extracted as the contract root part (contract roots are named "root")
- jsx: part "leftContent" renders {navigationButtonMarkup} — not a known text/node prop, not extracted
- jsx: part "leftContent" renders {contextMarkup} — not a known text/node prop, not extracted
- jsx: part "search" renders {searchMarkup} — not a known text/node prop, not extracted
- jsx: part "rightContent" renders {userMenu} between elements — extracted as an ordered slot part "userMenu"
- css: at-rule `@media (--p-breakpoints-md-up)` skipped — not extractable into anatomy
- css: at-rule `@media (--p-breakpoints-md-up)` skipped — not extractable into anatomy
- css: at-rule `@media (--p-breakpoints-md-up)` skipped — not extractable into anatomy
- css: at-rule `@media (--p-breakpoints-xl-up)` skipped — not extractable into anatomy
- css: at-rule `@media (--p-breakpoints-md-up)` skipped — not extractable into anatomy
- css: at-rule `@media (--p-breakpoints-md-up)` skipped — not extractable into anatomy
- css: .TopBar { height } uses var(--pg-top-bar-height) which resolves to NO token in the token tree — binding not proposed
- css: selector `.TopBar::after` — not extractable into anatomy, skipped by name
- css: .Container { display: grid } — no inversion rule, not extracted
- css: .Container { grid-template-columns: 1fr minmax(auto, 480px) 1fr } — no inversion rule, not extracted
- css: .Container { width: calc(100vw - var(--pc-app-provider-scrollbar-width)) } — var() inside a shorthand is not invertible to a single binding, not extracted
- css: .LogoDisplayControl { display: none } — no inversion rule, not extracted
- css: .LogoContainer { flex: 0 0 var(--pg-layout-width-nav-base) } — var() inside a shorthand is not invertible to a single binding, not extracted
- css: .LogoContainer { padding: 0 var(--p-space-200) 0 var(--p-space-400) } — var() inside a shorthand is not invertible to a single binding, not extracted
- css: selector `.LogoContainer.hasLogoSuffix` — not extractable into anatomy, skipped by name
- css: .Logo { display: block } — no inversion rule, not extracted
- css: .LogoLink { display: block } — no inversion rule, not extracted
- css: selector `.Logo:focus-visible` — part-scoped state pseudo; the contract vocabulary carries part-level states (Part.states, v13 — as `.root:focus-visible .part` descendant rules) but CSS inversion of this shape is not implemented; declare it on the contract directly, review
- css: selector `.LogoLink:focus-visible` — part-scoped state pseudo; the contract vocabulary carries part-level states (Part.states, v13 — as `.root:focus-visible .part` descendant rules) but CSS inversion of this shape is not implemented; declare it on the contract directly, review
- css: .ContextControl { display: none } — no inversion rule, not extracted
- css: .NavigationIcon { align-self: center } — no inversion rule, not extracted
- css: .NavigationIcon { margin-left: calc(var(--p-space-200) + var(--p-space-050)) } — var() inside a shorthand is not invertible to a single binding, not extracted
- css: .NavigationIcon { transition: var(--p-motion-duration-150) color var(--p-motion-ease) var(--p-motion-duration-50) } — var() inside a shorthand is not invertible to a single binding, not extracted
- css: selector `.NavigationIcon.focused:active` — not extractable into anatomy, skipped by name
- css: selector `.NavigationIcon:hover` — part-scoped state pseudo; the contract vocabulary carries part-level states (Part.states, v13 — as `.root:hover .part` descendant rules) but CSS inversion of this shape is not implemented; declare it on the contract directly, review
- css: selector `.NavigationIcon::after` — not extractable into anatomy, skipped by name
- css: selector `.NavigationIcon .IconWrapper` — descendant rule not under an enum class, not extracted
- css: selector `.NavigationIcon:focus-visible:not(:active)` — part-scoped state pseudo; the contract vocabulary carries part-level states (Part.states, v13 — as `.root:focus-visible:not(:active) .part` descendant rules) but CSS inversion of this shape is not implemented; declare it on the contract directly, review
- css: selector `.NavigationIcon:focus-visible:not(:active) .IconWrapper` — part-level state rule; the contract vocabulary carries it (Part.states, v13 — color-kind channels) but CSS inversion of part-state rules is not implemented; declare it on the contract directly, review
- css: selector `.SecondaryMenu svg` — icon glyph sizing, not extracted (icon parts are review items)
- css: class ".LogoDisplayControl" has declarations but no matching extracted JSX part — styles not attached, review by name
- css: class ".LogoDisplayContainer" has declarations but no matching extracted JSX part — styles not attached, review by name
- css: class ".LogoContainer" has declarations but no matching extracted JSX part — styles not attached, review by name
- css: class ".Logo" has declarations but no matching extracted JSX part — styles not attached, review by name
- css: class ".LogoLink" has declarations but no matching extracted JSX part — styles not attached, review by name
- css: class ".ContextControl" has declarations but no matching extracted JSX part — styles not attached, review by name
- css: class ".NavigationIcon" has declarations but no matching extracted JSX part — styles not attached, review by name

## TrapFocus

- source: `examples/polaris/.polaris-clone/polaris-react/src/components/TrapFocus/TrapFocus.tsx` (react-tsx)
- proposed: 1 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- prop `children`: platform prop — not contract API, skipped

## Truncate

- source: `examples/polaris/.polaris-clone/polaris-react/src/components/Truncate/Truncate.tsx` (react-tsx)
- proposed: 0 props, 0 events
- anatomy EXTRACTED from JSX + CSS Module — 1 part(s), 0 token binding(s), 0 raw value(s) reported. Anatomy is human-REVIEWED: check it against design intent before adoption.
- prop `children`: platform prop — not contract API, skipped
- jsx: root class ".Truncate" extracted as the contract root part (contract roots are named "root")
- jsx: root renders {children} directly — children channel (text prop vs default slot) is not decidable from code
- css: .Truncate { display: block } — no inversion rule, not extracted
- css: .Truncate { overflow: hidden } — no inversion rule, not extracted
- css: .Truncate { white-space: nowrap } — no inversion rule, not extracted
- css: .Truncate { text-overflow: ellipsis } — no inversion rule, not extracted

## TruncatedText

- source: `examples/polaris/.polaris-clone/polaris-react/src/components/DataTable/components/Cell/Cell.tsx` (react-tsx)
- proposed: 0 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- prop `children`: platform prop — not contract API, skipped
- prop `className`: platform prop — not contract API, skipped

## TruncateText

- source: `examples/polaris/.polaris-clone/polaris-react/src/components/ActionList/components/Item/Item.tsx` (react-tsx)
- proposed: 0 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- prop `children`: platform prop — not contract API, skipped

## UnstyledButton

- source: `examples/polaris/.polaris-clone/polaris-react/src/components/UnstyledButton/UnstyledButton.tsx` (react-tsx)
- proposed: 0 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- prop `children`: platform prop — not contract API, skipped
- prop `className`: platform prop — not contract API, skipped

## UpdateButtons

- source: `examples/polaris/.polaris-clone/polaris-react/src/components/IndexFilters/components/UpdateButtons/UpdateButtons.tsx` (react-tsx)
- proposed: 1 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- prop `primaryAction`: unclassified type — not proposed, review manually
- prop `cancelAction`: unclassified type — not proposed, review manually
- prop `viewNames`: unclassified type — not proposed, review manually

## UseId

- source: `examples/polaris/.polaris-clone/polaris-react/src/components/ResourceItem/ResourceItem.tsx` (react-tsx)
- proposed: 0 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- props type resolved with NO members — a zero-prop API is what this module declares; review

## UserMenu

- source: `examples/polaris/.polaris-clone/polaris-react/src/components/TopBar/components/UserMenu/UserMenu.tsx` (react-tsx)
- proposed: 5 props, 0 events
- anatomy EXTRACTED from JSX + CSS Module — 1 part(s), 0 token binding(s), 0 raw value(s) reported. Anatomy is human-REVIEWED: check it against design intent before adoption.
- prop `actions`: unclassified type — not proposed, review manually
- prop `message`: unclassified type — not proposed, review manually
- prop `initials`: unclassified type — not proposed, review manually
- prop `avatar`: unclassified type — not proposed, review manually
- prop `customActivator`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually
- jsx: root element <Menu> is a component — anatomy not extracted (wrapper components are review items)

## VideoThumbnail

- source: `examples/polaris/.polaris-clone/polaris-react/src/components/VideoThumbnail/VideoThumbnail.tsx` (react-tsx)
- proposed: 5 props, 0 events
- anatomy EXTRACTED from JSX + CSS Module — 3 part(s), 0 token binding(s), 11 raw value(s) reported. Anatomy is human-REVIEWED: check it against design intent before adoption.
- RAW VALUE (not tokenized): `.Thumbnail { width: 100% }` — no token in the tree has this value. A raw value is reported, never turned into an invented token; bind it to a real token and re-extract.
- RAW VALUE (not tokenized): `.Thumbnail { height: 100% }` — no token in the tree has this value. A raw value is reported, never turned into an invented token; bind it to a real token and re-extract.
- RAW VALUE (not tokenized): `.ThumbnailContainer { height: 100% }` — no token in the tree has this value. A raw value is reported, never turned into an invented token; bind it to a real token and re-extract.
- RAW VALUE (not tokenized): `.PlayButton { --pc-play-button-focused-state-overlay: rgba(223, 227, 232, 0.3) }` — no token in the tree has this value. A raw value is reported, never turned into an invented token; bind it to a real token and re-extract.
- RAW VALUE (not tokenized): `.PlayButton { width: 100% }` — no token in the tree has this value. A raw value is reported, never turned into an invented token; bind it to a real token and re-extract.
- RAW VALUE (not tokenized): `.PlayButton { height: 100% }` — no token in the tree has this value. A raw value is reported, never turned into an invented token; bind it to a real token and re-extract.
- RAW VALUE (not tokenized): `.PlayButton { background: transparent }` — no token in the tree has this value. A raw value is reported, never turned into an invented token; bind it to a real token and re-extract.
- RAW VALUE (not tokenized): `.Progress { width: 100% }` — no token in the tree has this value. A raw value is reported, never turned into an invented token; bind it to a real token and re-extract.
- RAW VALUE (not tokenized): `.Progress { height: 6px }` — no token in the tree has this value. A raw value is reported, never turned into an invented token; bind it to a real token and re-extract.
- RAW VALUE (not tokenized): `.Indicator { height: inherit }` — no token in the tree has this value. A raw value is reported, never turned into an invented token; bind it to a real token and re-extract.
- RAW VALUE (not tokenized): `.Indicator { width: 100% }` — no token in the tree has this value. A raw value is reported, never turned into an invented token; bind it to a real token and re-extract.
- jsx: root class ".ThumbnailContainer" extracted as the contract root part (contract roots are named "root")
- jsx: <button> handler "onMouseEnter" — only onClick/onChange trigger wiring is extracted
- jsx: <button> handler "onFocus" — only onClick/onChange trigger wiring is extracted
- jsx: <button> handler "onTouchStart" — only onClick/onChange trigger wiring is extracted
- jsx: part "playButton" renders {timeStampMarkup} — not a known text/node prop, not extracted
- jsx: part "root" renders {progressMarkup} — not a known text/node prop, not extracted
- css: .Thumbnail { padding-bottom: calc(9 / 16 * 100%) } — no inversion rule, not extracted
- css: .Thumbnail { background-size: cover } — no inversion rule, not extracted
- css: .Thumbnail { background-position: center center } — no inversion rule, not extracted
- css: .Thumbnail { background-repeat: no-repeat } — no inversion rule, not extracted
- css: .PlayButton { transition: opacity var(--p-motion-duration-200) var(--p-motion-ease-in) } — var() inside a shorthand is not invertible to a single binding, not extracted
- css: .PlayButton position:absolute with insets (top:0;bottom:;left:0;right:) — not a generator overlay placement, not extracted
- css: selector `.PlayButton:focus` — pseudo ":focus" is not a contract state, not extracted
- css: selector `.PlayButton:focus .Timestamp` — part-level state rule; the contract vocabulary carries it (Part.states, v13 — color-kind channels) but CSS inversion of part-state rules is not implemented; declare it on the contract directly, review
- css: selector `.PlayButton:hover .Timestamp` — part-level state rule; the contract vocabulary carries it (Part.states, v13 — color-kind channels) but CSS inversion of part-state rules is not implemented; declare it on the contract directly, review
- css: .Timestamp { padding: var(--p-space-100) var(--p-space-200) var(--p-space-100) var(--p-space-100) } — var() inside a shorthand is not invertible to a single binding, not extracted
- css: .Timestamp { text-align: center } — no inversion rule, not extracted
- css: .Timestamp { transition: background-color var(--p-motion-duration-200) var(--p-motion-ease-in) } — var() inside a shorthand is not invertible to a single binding, not extracted
- css: .Timestamp position:absolute with insets (top:;bottom:0;left:;right:) — not a generator overlay placement, not extracted
- css: .Progress { overflow: hidden } — no inversion rule, not extracted
- css: .Progress position:absolute with insets (top:;bottom:0;left:;right:) — not a generator overlay placement, not extracted
- css: .Indicator { transform-origin: left } — no inversion rule, not extracted
- css: .Indicator { transform: scaleX(0) } — no inversion rule, not extracted
- css: .Indicator { transition: transform var(--p-motion-duration-500) var(--p-motion-ease) } — var() inside a shorthand is not invertible to a single binding, not extracted
- css: class ".PlayIcon" has declarations but no matching extracted JSX part — styles not attached, review by name
- css: class ".Timestamp" has declarations but no matching extracted JSX part — styles not attached, review by name
- css: class ".Progress" has declarations but no matching extracted JSX part — styles not attached, review by name
- css: class ".Indicator" has declarations but no matching extracted JSX part — styles not attached, review by name
- css: class ".ProgressBar" has declarations but no matching extracted JSX part — styles not attached, review by name
- css: class ".Label" has declarations but no matching extracted JSX part — styles not attached, review by name

## Weekday

- source: `examples/polaris/.polaris-clone/polaris-react/src/components/DatePicker/components/Weekday/Weekday.tsx` (react-tsx)
- proposed: 3 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element

## Components seen but NOT extractable (review required)

These components were found but their props could not be read — reported, never silently dropped:

- **Item** (`examples/polaris/.polaris-clone/polaris-react/src/components/ActionList/components/Item/Item.tsx`) — props type "ItemProps" resolves only to named reference(s) [ActionListItemDescriptor] whose members are outside module scope — 0 readable props; skipped instead of proposing a hollow contract
- **DefaultBanner** (`examples/polaris/.polaris-clone/polaris-react/src/components/Banner/Banner.tsx`) — props type "PropsWithChildren" not found in this file (imported/composed types are outside single-file extraction)
- **InlineIconBanner** (`examples/polaris/.polaris-clone/polaris-react/src/components/Banner/Banner.tsx`) — props type "PropsWithChildren" not found in this file (imported/composed types are outside single-file extraction)
- **WithinContentContainerBanner** (`examples/polaris/.polaris-clone/polaris-react/src/components/Banner/Banner.tsx`) — props type "PropsWithChildren" not found in this file (imported/composed types are outside single-file extraction)
- **TextField** (`examples/polaris/.polaris-clone/polaris-react/src/components/Combobox/components/TextField/TextField.tsx`) — props type "TextFieldProps" not found in this file (imported/composed types are outside single-file extraction)
- **FilterActionsProvider** (`examples/polaris/.polaris-clone/polaris-react/src/components/FilterActionsProvider/FilterActionsProvider.tsx`) — props type "FilterActionsProviderProps" resolves only to named reference(s) [PropsWithChildren<{
  filterActions: boolean;
}>] whose members are outside module scope — 0 readable props; skipped instead of proposing a hollow contract
- **FiltersBar** (`examples/polaris/.polaris-clone/polaris-react/src/components/Filters/components/FiltersBar/FiltersBar.tsx`) — props type "PropsWithChildren" not found in this file (imported/composed types are outside single-file extraction)
- **Loading** (`examples/polaris/.polaris-clone/polaris-react/src/components/Frame/components/Loading/Loading.tsx`) — props type "LoadingProps" not found in this file (imported/composed types are outside single-file extraction)
- **Toast** (`examples/polaris/.polaris-clone/polaris-react/src/components/Frame/components/Toast/Toast.tsx`) — props type "ToastProps" not found in this file (imported/composed types are outside single-file extraction)
- **IndexProvider** (`examples/polaris/.polaris-clone/polaris-react/src/components/IndexProvider/IndexProvider.tsx`) — props type "IndexProviderProps" not found in this file (imported/composed types are outside single-file extraction)
- **FadeUp** (`examples/polaris/.polaris-clone/polaris-react/src/components/Modal/components/Dialog/Dialog.tsx`) — props type "CSSTransitionProps" resolves only to named reference(s) [React.ComponentProps<typeof CSSTransition>] whose members are outside module scope — 0 readable props; skipped instead of proposing a hollow contract
- **FILTER_REGEX** (`examples/polaris/.polaris-clone/polaris-react/src/components/Picker/Picker.tsx`) — props type "FILTER_REGEXProps" not found in this file (imported/composed types are outside single-file extraction)
- **QUERY_REGEX** (`examples/polaris/.polaris-clone/polaris-react/src/components/Picker/Picker.tsx`) — props type "QUERY_REGEXProps" not found in this file (imported/composed types are outside single-file extraction)
- **ResourceItem** (`examples/polaris/.polaris-clone/polaris-react/src/components/ResourceItem/ResourceItem.tsx`) — props type "ResourceItemProps" resolves only to named reference(s) [PropsWithUrl | PropsWithClick] whose members are outside module scope — 0 readable props; skipped instead of proposing a hollow contract
- **ScrollTo** (`examples/polaris/.polaris-clone/polaris-react/src/components/Scrollable/components/ScrollTo/ScrollTo.tsx`) — props type "ScrollToProps" not found in this file (imported/composed types are outside single-file extraction)

