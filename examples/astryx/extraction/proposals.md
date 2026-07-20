# Proposed contracts — extraction report

222 component(s) extracted. Every proposal parses against the contract schema, but a proposal is a STARTING POINT: confirm inferred design bindings via `npm run reconcile`, then review the notes below per component.

## AlertDialog

- source: `examples/astryx/.astryx-sandbox/node_modules/@astryxdesign/core/src/AlertDialog/AlertDialog.tsx` (react-tsx)
- proposed: 7 props, 2 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- props type extends BaseProps<HTMLDialogElement> — parent members are outside single-file extraction and are NOT carried
- prop `ref`: platform prop — not contract API, skipped
- event `onOpenChange`: declared with trigger 'root' — assign the real trigger part once anatomy is authored
- prop `actionVariant`: unclassified type — not proposed, review manually
- event `onAction`: declared with trigger 'root' — assign the real trigger part once anatomy is authored
- prop `width`: unclassified type — not proposed, review manually

## AppShell

- source: `examples/astryx/.astryx-sandbox/node_modules/@astryxdesign/core/src/AppShell/AppShell.tsx` (react-tsx)
- proposed: 2 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- props type extends BaseProps<HTMLDivElement> — parent members are outside single-file extraction and are NOT carried
- prop `variant`: enum values resolved as member names of the in-file interface AppShellVariantMap (module augmentation may extend it) — review
- prop `ref`: platform prop — not contract API, skipped
- prop `variant`: type resolved heuristically — review
- prop `variant`: figma binding INFERRED as VARIANT "Variant" — confirm against the design library (reconcile step)
- prop `banner`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually
- prop `children`: platform prop — not contract API, skipped
- prop `contentPadding`: unclassified type — not proposed, review manually
- prop `height`: figma binding INFERRED as VARIANT "Height" — confirm against the design library (reconcile step)
- prop `mobileNav`: unclassified type — not proposed, review manually
- prop `sideNav`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually
- prop `topNav`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually

## AreaProvider

- source: `examples/astryx/.astryx-sandbox/node_modules/@astryxdesign/core/src/Layout/Layout.tsx` (react-tsx)
- proposed: 0 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- prop `area`: unclassified type — not proposed, review manually
- prop `children`: platform prop — not contract API, skipped

## AspectRatio

- source: `examples/astryx/.astryx-sandbox/node_modules/@astryxdesign/core/src/AspectRatio/AspectRatio.tsx` (react-tsx)
- proposed: 3 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- props type extends BaseProps<HTMLDivElement> — parent members are outside single-file extraction and are NOT carried
- prop `ref`: platform prop — not contract API, skipped
- prop `shape`: type resolved heuristically — review
- prop `shape`: figma binding INFERRED as VARIANT "Shape" — confirm against the design library (reconcile step)
- prop `fit`: type resolved heuristically — review
- prop `fit`: figma binding INFERRED as VARIANT "Fit" — confirm against the design library (reconcile step)
- prop `children`: platform prop — not contract API, skipped

## Avatar

- source: `examples/astryx/.astryx-sandbox/node_modules/@astryxdesign/core/src/Avatar/Avatar.tsx` (react-tsx)
- proposed: 4 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- props type extends BaseProps<HTMLDivElement> — parent members are outside single-file extraction and are NOT carried
- prop `ref`: platform prop — not contract API, skipped
- prop `size`: unclassified type — not proposed, review manually
- prop `status`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually

## AvatarGroup

- source: `examples/astryx/.astryx-sandbox/node_modules/@astryxdesign/core/src/AvatarGroup/AvatarGroup.tsx` (react-tsx)
- proposed: 0 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- props type extends BaseProps<HTMLDivElement> — parent members are outside single-file extraction and are NOT carried
- prop `ref`: platform prop — not contract API, skipped
- prop `children`: platform prop — not contract API, skipped
- prop `size`: unclassified type — not proposed, review manually

## AvatarGroupOverflow

- source: `examples/astryx/.astryx-sandbox/node_modules/@astryxdesign/core/src/AvatarGroup/AvatarGroupOverflow.tsx` (react-tsx)
- proposed: 1 props, 1 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- props type extends Omit<
  BaseProps<HTMLElement>,
  'onClick'
> — parent members are outside single-file extraction and are NOT carried
- prop `ref`: platform prop — not contract API, skipped
- event `onClick`: declared with trigger 'root' — assign the real trigger part once anatomy is authored
- prop `children`: platform prop — not contract API, skipped

## AvatarStatusDot

- source: `examples/astryx/.astryx-sandbox/node_modules/@astryxdesign/core/src/Avatar/AvatarStatusDot.tsx` (react-tsx)
- proposed: 2 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- props type extends BaseProps<HTMLDivElement> — parent members are outside single-file extraction and are NOT carried
- prop `variant`: enum values resolved as member names of the in-file interface AvatarStatusDotVariantMap (module augmentation may extend it) — review
- prop `ref`: platform prop — not contract API, skipped
- prop `variant`: type resolved heuristically — review
- prop `variant`: figma binding INFERRED as VARIANT "Variant" — confirm against the design library (reconcile step)
- prop `icon`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually

## Badge

- source: `examples/astryx/.astryx-sandbox/node_modules/@astryxdesign/core/src/Badge/Badge.tsx` (react-tsx)
- proposed: 1 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- props type extends BaseProps<HTMLSpanElement> — parent members are outside single-file extraction and are NOT carried
- prop `variant`: enum values resolved as member names of the in-file interface BadgeVariantMap (module augmentation may extend it) — review
- prop `ref`: platform prop — not contract API, skipped
- prop `variant`: type resolved heuristically — review
- prop `variant`: figma binding INFERRED as VARIANT "Variant" — confirm against the design library (reconcile step)
- prop `label`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually
- prop `icon`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually

## Banner

- source: `examples/astryx/.astryx-sandbox/node_modules/@astryxdesign/core/src/Banner/Banner.tsx` (react-tsx)
- proposed: 4 props, 1 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- props type extends BaseProps<HTMLDivElement> — parent members are outside single-file extraction and are NOT carried
- prop `status`: enum values resolved as member names of the in-file interface BannerStatusMap (module augmentation may extend it) — review
- prop `container`: enum values resolved as member names of the in-file interface BannerContainerMap (module augmentation may extend it) — review
- prop `ref`: platform prop — not contract API, skipped
- prop `status`: type resolved heuristically — review
- prop `status`: figma binding INFERRED as VARIANT "Status" — confirm against the design library (reconcile step)
- prop `title`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually
- prop `description`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually
- prop `icon`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually
- event `onDismiss`: declared with trigger 'root' — assign the real trigger part once anatomy is authored
- prop `endContent`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually
- prop `container`: type resolved heuristically — review
- prop `container`: figma binding INFERRED as VARIANT "Container" — confirm against the design library (reconcile step)
- prop `children`: platform prop — not contract API, skipped

## BaseTable

- source: `examples/astryx/.astryx-sandbox/node_modules/@astryxdesign/core/src/Table/BaseTable.tsx` (react-tsx)
- proposed: 0 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- props type composes named reference(s) [BaseTableProps<T>] whose members are outside module scope — those props are NOT carried (single-file extraction)
- prop `ref`: platform prop — not contract API, skipped

## BaseTableInner

- source: `examples/astryx/.astryx-sandbox/node_modules/@astryxdesign/core/src/Table/BaseTable.tsx` (react-tsx)
- proposed: 0 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- props type composes named reference(s) [BaseTableProps<T>] whose members are outside module scope — those props are NOT carried (single-file extraction)
- prop `ref`: platform prop — not contract API, skipped

## BaseTypeahead

- source: `examples/astryx/.astryx-sandbox/node_modules/@astryxdesign/core/src/Typeahead/BaseTypeahead.tsx` (react-tsx)
- proposed: 12 props, 4 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- props type extends Omit<
  BaseProps<HTMLElement>,
  'onChange'
> — parent members are outside single-file extraction and are NOT carried
- prop `ref`: platform prop — not contract API, skipped
- prop `searchSource`: unclassified type — not proposed, review manually
- prop `value`: unclassified type — not proposed, review manually
- event `onChange`: declared with trigger 'root' — assign the real trigger part once anatomy is authored
- prop `renderItem`: function-typed but not on* — skipped, review manually
- event `onChangeQuery`: declared with trigger 'root' — assign the real trigger part once anatomy is authored
- event `onOpenChange`: declared with trigger 'root' — assign the real trigger part once anatomy is authored
- prop `inputXStyle`: unclassified type — not proposed, review manually
- prop `anchorRef`: unclassified type — not proposed, review manually
- event `onKeyDown`: declared with trigger 'root' — assign the real trigger part once anatomy is authored
- prop `size`: figma binding INFERRED as VARIANT "Size" — confirm against the design library (reconcile step)

## Blockquote

- source: `examples/astryx/.astryx-sandbox/node_modules/@astryxdesign/core/src/Blockquote/Blockquote.tsx` (react-tsx)
- proposed: 0 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- props type extends BaseProps<HTMLQuoteElement> — parent members are outside single-file extraction and are NOT carried
- prop `ref`: platform prop — not contract API, skipped
- prop `children`: platform prop — not contract API, skipped
- prop `cite`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually

## BreadcrumbItem

- source: `examples/astryx/.astryx-sandbox/node_modules/@astryxdesign/core/src/Breadcrumbs/BreadcrumbItem.tsx` (react-tsx)
- proposed: 2 props, 1 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- props type extends Omit<
  BaseProps<HTMLLIElement>,
  'onClick'
> — parent members are outside single-file extraction and are NOT carried
- prop `ref`: platform prop — not contract API, skipped
- prop `as`: unclassified type — not proposed, review manually
- prop `children`: platform prop — not contract API, skipped
- event `onClick`: declared with trigger 'root' — assign the real trigger part once anatomy is authored
- prop `startIcon`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually

## Breadcrumbs

- source: `examples/astryx/.astryx-sandbox/node_modules/@astryxdesign/core/src/Breadcrumbs/Breadcrumbs.tsx` (react-tsx)
- proposed: 2 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- props type extends BaseProps<HTMLElement> — parent members are outside single-file extraction and are NOT carried
- prop `variant`: enum values resolved as member names of the in-file interface BreadcrumbsVariantMap (module augmentation may extend it) — review
- prop `ref`: platform prop — not contract API, skipped
- prop `children`: platform prop — not contract API, skipped
- prop `separator`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually
- prop `variant`: type resolved heuristically — review
- prop `variant`: figma binding INFERRED as VARIANT "Variant" — confirm against the design library (reconcile step)

## Button

- source: `examples/astryx/.astryx-sandbox/node_modules/@astryxdesign/core/src/Button/Button.tsx` (react-tsx)
- proposed: 14 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- props type extends BaseProps<HTMLButtonElement> — parent members are outside single-file extraction and are NOT carried
- prop `variant`: enum values resolved as member names of the in-file interface ButtonVariantMap (module augmentation may extend it) — review
- prop `size`: enum values resolved as keys of the object literal passed to stylex.create(…) — key-preserving factory ASSUMED — review
- prop `ref`: platform prop — not contract API, skipped
- prop `type`: figma binding INFERRED as VARIANT "Type" — confirm against the design library (reconcile step)
- prop `value`: unclassified type — not proposed, review manually
- prop `variant`: type resolved heuristically — review
- prop `variant`: figma binding INFERRED as VARIANT "Variant" — confirm against the design library (reconcile step)
- prop `size`: type resolved heuristically — review
- prop `size`: figma binding INFERRED as VARIANT "Size" — confirm against the design library (reconcile step)
- prop `onClick`: unclassified type — not proposed, review manually
- prop `clickAction`: function-typed but not on* — skipped, review manually
- prop `icon`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually
- prop `children`: platform prop — not contract API, skipped
- prop `endContent`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually
- prop `as`: unclassified type — not proposed, review manually

## ButtonGroup

- source: `examples/astryx/.astryx-sandbox/node_modules/@astryxdesign/core/src/ButtonGroup/ButtonGroup.tsx` (react-tsx)
- proposed: 2 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- props type extends BaseProps<HTMLDivElement> — parent members are outside single-file extraction and are NOT carried
- prop `ref`: platform prop — not contract API, skipped
- prop `children`: platform prop — not contract API, skipped
- prop `orientation`: unclassified type — not proposed, review manually
- prop `size`: unclassified type — not proposed, review manually

## Calendar

- source: `examples/astryx/.astryx-sandbox/node_modules/@astryxdesign/core/src/Calendar/Calendar.tsx` (react-tsx)
- proposed: 3 props, 2 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- props type composes named reference(s) [Omit<
  BaseProps<HTMLDivElement>,
  'onChange' | 'defaultValue'
>] whose members are outside module scope — those props are NOT carried (single-file extraction)
- props type is a UNION of alternatives [CalendarSingleProps | CalendarRangeProps] — members merged across readable branches; branch-specific members are forced optional (the mutually-exclusive alternative structure is NOT encoded in the contract; review)
- prop `mode`: unclassified type — not proposed, review manually
- prop `value`: unclassified type — not proposed, review manually
- prop `defaultValue`: unclassified type — not proposed, review manually
- event `onChange`: declared with trigger 'root' — assign the real trigger part once anatomy is authored
- prop `ref`: platform prop — not contract API, skipped
- prop `handleRef`: unclassified type — not proposed, review manually
- prop `numberOfMonths`: unclassified type — not proposed, review manually
- prop `min`: unclassified type — not proposed, review manually
- prop `max`: unclassified type — not proposed, review manually
- prop `dateConstraints`: unclassified type — not proposed, review manually
- prop `focusDate`: unclassified type — not proposed, review manually
- event `onFocusDateChange`: declared with trigger 'root' — assign the real trigger part once anatomy is authored
- prop `weekStartsOn`: unclassified type — not proposed, review manually

## CallRow

- source: `examples/astryx/.astryx-sandbox/node_modules/@astryxdesign/core/src/Chat/ChatToolCalls.tsx` (react-tsx)
- proposed: 0 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- prop `call`: unclassified type — not proposed, review manually

## Card

- source: `examples/astryx/.astryx-sandbox/node_modules/@astryxdesign/core/src/Card/Card.tsx` (react-tsx)
- proposed: 1 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- props type extends BaseProps<HTMLDivElement> — parent members are outside single-file extraction and are NOT carried
- prop `ref`: platform prop — not contract API, skipped
- prop `className`: platform prop — not contract API, skipped
- prop `style`: platform prop — not contract API, skipped
- prop `width`: unclassified type — not proposed, review manually
- prop `height`: unclassified type — not proposed, review manually
- prop `maxWidth`: unclassified type — not proposed, review manually
- prop `minHeight`: unclassified type — not proposed, review manually
- prop `children`: platform prop — not contract API, skipped
- prop `padding`: unclassified type — not proposed, review manually
- prop `variant`: type resolved heuristically — review
- prop `variant`: figma binding INFERRED as VARIANT "Variant" — confirm against the design library (reconcile step)

## Carousel

- source: `examples/astryx/.astryx-sandbox/node_modules/@astryxdesign/core/src/Carousel/Carousel.tsx` (react-tsx)
- proposed: 3 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- props type extends BaseProps<HTMLDivElement> — parent members are outside single-file extraction and are NOT carried
- prop `ref`: platform prop — not contract API, skipped
- prop `children`: platform prop — not contract API, skipped
- prop `gap`: unclassified type — not proposed, review manually
- prop `padding`: unclassified type — not proposed, review manually

## Center

- source: `examples/astryx/.astryx-sandbox/node_modules/@astryxdesign/core/src/Center/Center.tsx` (react-tsx)
- proposed: 2 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- props type extends BaseProps<HTMLDivElement> — parent members are outside single-file extraction and are NOT carried
- prop `ref`: platform prop — not contract API, skipped
- prop `axis`: type resolved heuristically — review
- prop `axis`: figma binding INFERRED as VARIANT "Axis" — confirm against the design library (reconcile step)
- prop `width`: unclassified type — not proposed, review manually
- prop `height`: unclassified type — not proposed, review manually
- prop `maxWidth`: unclassified type — not proposed, review manually
- prop `minHeight`: unclassified type — not proposed, review manually
- prop `children`: platform prop — not contract API, skipped

## ChatComposer

- source: `examples/astryx/.astryx-sandbox/node_modules/@astryxdesign/core/src/Chat/ChatComposer.tsx` (react-tsx)
- proposed: 6 props, 3 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- props type extends Omit<
  BaseProps<HTMLDivElement>,
  'onChange' | 'onSubmit'
> — parent members are outside single-file extraction and are NOT carried
- prop `ref`: platform prop — not contract API, skipped
- event `onSubmit`: declared with trigger 'root' — assign the real trigger part once anatomy is authored
- event `onStop`: declared with trigger 'root' — assign the real trigger part once anatomy is authored
- event `onChange`: declared with trigger 'root' — assign the real trigger part once anatomy is authored
- prop `density`: type resolved heuristically — review
- prop `density`: figma binding INFERRED as VARIANT "Density" — confirm against the design library (reconcile step)
- prop `drawer`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually
- prop `headerActions`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually
- prop `headerContext`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually
- prop `input`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually
- prop `footerActions`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually
- prop `sendActions`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually
- prop `sendButton`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually
- prop `status`: unclassified type — not proposed, review manually
- prop `statusPosition`: figma binding INFERRED as VARIANT "Status Position" — confirm against the design library (reconcile step)

## ChatComposerDrawer

- source: `examples/astryx/.astryx-sandbox/node_modules/@astryxdesign/core/src/Chat/ChatComposerDrawer.tsx` (react-tsx)
- proposed: 4 props, 1 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- props type extends BaseProps<HTMLDivElement> — parent members are outside single-file extraction and are NOT carried
- prop `ref`: platform prop — not contract API, skipped
- prop `children`: platform prop — not contract API, skipped
- event `onCollapsedChange`: declared with trigger 'root' — assign the real trigger part once anatomy is authored
- prop `xstyle`: unclassified type — not proposed, review manually
- prop `className`: platform prop — not contract API, skipped
- prop `style`: platform prop — not contract API, skipped

## ChatComposerInput

- source: `examples/astryx/.astryx-sandbox/node_modules/@astryxdesign/core/src/Chat/ChatComposerInput.tsx` (react-tsx)
- proposed: 7 props, 4 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- props type extends Omit<
  BaseProps<HTMLDivElement>,
  'onChange' | 'onPaste' | 'onSubmit'
> — parent members are outside single-file extraction and are NOT carried
- prop `ref`: platform prop — not contract API, skipped
- prop `handleRef`: unclassified type — not proposed, review manually
- event `onChange`: declared with trigger 'root' — assign the real trigger part once anatomy is authored
- prop `triggers`: unclassified type — not proposed, review manually
- event `onPaste`: declared with trigger 'root' — assign the real trigger part once anatomy is authored
- prop `pasteAsToken`: unclassified type — not proposed, review manually
- event `onFiles`: declared with trigger 'root' — assign the real trigger part once anatomy is authored
- event `onSubmit`: declared with trigger 'root' — assign the real trigger part once anatomy is authored

## ChatComposerTokenElement

- source: `examples/astryx/.astryx-sandbox/node_modules/@astryxdesign/core/src/Chat/ChatComposerInput.tsx` (react-tsx)
- proposed: 0 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- prop `token`: unclassified type — not proposed, review manually

## ChatDictationButton

- source: `examples/astryx/.astryx-sandbox/node_modules/@astryxdesign/core/src/Chat/ChatDictationButton.tsx` (react-tsx)
- proposed: 3 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- props type extends BaseProps<HTMLSpanElement> — parent members are outside single-file extraction and are NOT carried
- prop `ref`: platform prop — not contract API, skipped
- prop `dictation`: unclassified type — not proposed, review manually
- prop `size`: figma binding INFERRED as VARIANT "Size" — confirm against the design library (reconcile step)

## ChatLayout

- source: `examples/astryx/.astryx-sandbox/node_modules/@astryxdesign/core/src/Chat/ChatLayout.tsx` (react-tsx)
- proposed: 1 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- props type extends BaseProps<HTMLDivElement> — parent members are outside single-file extraction and are NOT carried
- prop `ref`: platform prop — not contract API, skipped
- prop `children`: platform prop — not contract API, skipped
- prop `composer`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually
- prop `emptyState`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually
- prop `scrollButton`: unclassified type — not proposed, review manually
- prop `scrollRef`: unclassified type — not proposed, review manually
- prop `density`: type resolved heuristically — review
- prop `density`: figma binding INFERRED as VARIANT "Density" — confirm against the design library (reconcile step)

## ChatLayoutScrollButton

- source: `examples/astryx/.astryx-sandbox/node_modules/@astryxdesign/core/src/Chat/ChatLayoutScrollButton.tsx` (react-tsx)
- proposed: 2 props, 1 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- props type extends Omit<
  BaseProps<HTMLDivElement>,
  'onClick'
> — parent members are outside single-file extraction and are NOT carried
- prop `ref`: platform prop — not contract API, skipped
- event `onClick`: declared with trigger 'root' — assign the real trigger part once anatomy is authored

## ChatMessage

- source: `examples/astryx/.astryx-sandbox/node_modules/@astryxdesign/core/src/Chat/ChatMessage.tsx` (react-tsx)
- proposed: 0 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- props type extends BaseProps<HTMLElement> — parent members are outside single-file extraction and are NOT carried
- prop `ref`: platform prop — not contract API, skipped
- prop `sender`: unclassified type — not proposed, review manually
- prop `children`: platform prop — not contract API, skipped
- prop `avatar`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually
- prop `name`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually
- prop `metadata`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually
- prop `density`: unclassified type — not proposed, review manually

## ChatMessageBubble

- source: `examples/astryx/.astryx-sandbox/node_modules/@astryxdesign/core/src/Chat/ChatMessageBubble.tsx` (react-tsx)
- proposed: 2 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- props type extends BaseProps<HTMLDivElement> — parent members are outside single-file extraction and are NOT carried
- prop `ref`: platform prop — not contract API, skipped
- prop `children`: platform prop — not contract API, skipped
- prop `variant`: type resolved heuristically — review
- prop `variant`: figma binding INFERRED as VARIANT "Variant" — confirm against the design library (reconcile step)
- prop `name`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually
- prop `metadata`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually
- prop `group`: figma binding INFERRED as VARIANT "Group" — confirm against the design library (reconcile step)

## ChatMessageList

- source: `examples/astryx/.astryx-sandbox/node_modules/@astryxdesign/core/src/Chat/ChatMessageList.tsx` (react-tsx)
- proposed: 1 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- props type extends BaseProps<HTMLDivElement> — parent members are outside single-file extraction and are NOT carried
- prop `ref`: platform prop — not contract API, skipped
- prop `children`: platform prop — not contract API, skipped
- prop `emptyState`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually
- prop `scrollToTopAction`: function-typed but not on* — skipped, review manually
- prop `density`: unclassified type — not proposed, review manually
- prop `gap`: unclassified type — not proposed, review manually

## ChatMessageMetadata

- source: `examples/astryx/.astryx-sandbox/node_modules/@astryxdesign/core/src/Chat/ChatMessageMetadata.tsx` (react-tsx)
- proposed: 1 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- props type extends BaseProps<HTMLDivElement> — parent members are outside single-file extraction and are NOT carried
- prop `ref`: platform prop — not contract API, skipped
- prop `timestamp`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually
- prop `footer`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually
- prop `status`: type resolved heuristically — review
- prop `status`: figma binding INFERRED as VARIANT "Status" — confirm against the design library (reconcile step)

## ChatPastedTextToken

- source: `examples/astryx/.astryx-sandbox/node_modules/@astryxdesign/core/src/Chat/ChatPastedTextToken.tsx` (react-tsx)
- proposed: 1 props, 1 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- event `onExpand`: declared with trigger 'root' — assign the real trigger part once anatomy is authored

## ChatSendButton

- source: `examples/astryx/.astryx-sandbox/node_modules/@astryxdesign/core/src/Chat/ChatSendButton.tsx` (react-tsx)
- proposed: 3 props, 2 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- props type extends BaseProps<HTMLButtonElement> — parent members are outside single-file extraction and are NOT carried
- prop `ref`: platform prop — not contract API, skipped
- event `onSend`: declared with trigger 'root' — assign the real trigger part once anatomy is authored
- event `onStop`: declared with trigger 'root' — assign the real trigger part once anatomy is authored
- prop `sendIcon`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually
- prop `stopIcon`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually
- prop `size`: figma binding INFERRED as VARIANT "Size" — confirm against the design library (reconcile step)

## ChatSystemMessage

- source: `examples/astryx/.astryx-sandbox/node_modules/@astryxdesign/core/src/Chat/ChatSystemMessage.tsx` (react-tsx)
- proposed: 1 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- props type extends BaseProps<HTMLDivElement> — parent members are outside single-file extraction and are NOT carried
- prop `ref`: platform prop — not contract API, skipped
- prop `children`: platform prop — not contract API, skipped
- prop `variant`: type resolved heuristically — review
- prop `variant`: figma binding INFERRED as VARIANT "Variant" — confirm against the design library (reconcile step)
- prop `icon`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually

## ChatTokenizedText

- source: `examples/astryx/.astryx-sandbox/node_modules/@astryxdesign/core/src/Chat/ChatTokenizedText.tsx` (react-tsx)
- proposed: 0 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- props type extends BaseProps<HTMLSpanElement> — parent members are outside single-file extraction and are NOT carried
- prop `ref`: platform prop — not contract API, skipped
- prop `children`: platform prop — not contract API, skipped
- prop `tokens`: unclassified type — not proposed, review manually

## ChatToolCalls

- source: `examples/astryx/.astryx-sandbox/node_modules/@astryxdesign/core/src/Chat/ChatToolCalls.tsx` (react-tsx)
- proposed: 3 props, 1 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- props type extends BaseProps<HTMLDivElement> — parent members are outside single-file extraction and are NOT carried
- prop `ref`: platform prop — not contract API, skipped
- prop `calls`: unclassified type — not proposed, review manually
- event `onExpandedChange`: declared with trigger 'root' — assign the real trigger part once anatomy is authored

## CheckboxInput

- source: `examples/astryx/.astryx-sandbox/node_modules/@astryxdesign/core/src/CheckboxInput/CheckboxInput.tsx` (react-tsx)
- proposed: 11 props, 3 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- props type extends Omit<BaseProps, 'onChange'> — parent members are outside single-file extraction and are NOT carried
- prop `size`: enum values resolved as keys of the object literal passed to stylex.create(…) — key-preserving factory ASSUMED — review
- prop `ref`: platform prop — not contract API, skipped
- event `onChange`: declared with trigger 'root' — assign the real trigger part once anatomy is authored
- prop `changeAction`: function-typed but not on* — skipped, review manually
- prop `value`: unclassified type — not proposed, review manually
- prop `width`: unclassified type — not proposed, review manually
- prop `size`: type resolved heuristically — review
- prop `size`: figma binding INFERRED as VARIANT "Size" — confirm against the design library (reconcile step)
- event `onFocus`: declared with trigger 'root' — assign the real trigger part once anatomy is authored
- event `onBlur`: declared with trigger 'root' — assign the real trigger part once anatomy is authored
- prop `labelIcon`: unclassified type — not proposed, review manually
- prop `status`: unclassified type — not proposed, review manually

## CheckboxList

- source: `examples/astryx/.astryx-sandbox/node_modules/@astryxdesign/core/src/CheckboxList/CheckboxList.tsx` (react-tsx)
- proposed: 7 props, 1 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- props type extends Omit<
  BaseProps<HTMLDivElement>,
  'onChange'
> — parent members are outside single-file extraction and are NOT carried
- prop `ref`: platform prop — not contract API, skipped
- prop `status`: unclassified type — not proposed, review manually
- prop `value`: unclassified type — not proposed, review manually
- event `onChange`: declared with trigger 'root' — assign the real trigger part once anatomy is authored
- prop `changeAction`: function-typed but not on* — skipped, review manually
- prop `density`: unclassified type — not proposed, review manually
- prop `width`: unclassified type — not proposed, review manually
- prop `children`: platform prop — not contract API, skipped

## CheckboxListItem

- source: `examples/astryx/.astryx-sandbox/node_modules/@astryxdesign/core/src/CheckboxList/CheckboxListItem.tsx` (react-tsx)
- proposed: 4 props, 1 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- props type extends BaseProps<HTMLLIElement> — parent members are outside single-file extraction and are NOT carried
- prop `label`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually
- prop `endContent`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually
- prop `isChecked`: unclassified type — not proposed, review manually
- event `onCheck`: declared with trigger 'root' — assign the real trigger part once anatomy is authored
- prop `ref`: platform prop — not contract API, skipped

## Citation

- source: `examples/astryx/.astryx-sandbox/node_modules/@astryxdesign/core/src/Citation/Citation.tsx` (react-tsx)
- proposed: 2 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- props type extends BaseProps<HTMLElement> — parent members are outside single-file extraction and are NOT carried
- prop `ref`: platform prop — not contract API, skipped
- prop `source`: unclassified type — not proposed, review manually
- prop `variant`: figma binding INFERRED as VARIANT "Variant" — confirm against the design library (reconcile step)

## ClickableCard

- source: `examples/astryx/.astryx-sandbox/node_modules/@astryxdesign/core/src/ClickableCard/ClickableCard.tsx` (react-tsx)
- proposed: 4 props, 1 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- props type extends BaseProps — parent members are outside single-file extraction and are NOT carried
- prop `ref`: platform prop — not contract API, skipped
- event `onClick`: declared with trigger 'root' — assign the real trigger part once anatomy is authored
- prop `children`: platform prop — not contract API, skipped
- prop `padding`: unclassified type — not proposed, review manually
- prop `variant`: unclassified type — not proposed, review manually
- prop `width`: unclassified type — not proposed, review manually
- prop `height`: unclassified type — not proposed, review manually
- prop `maxWidth`: unclassified type — not proposed, review manually

## Code

- source: `examples/astryx/.astryx-sandbox/node_modules/@astryxdesign/core/src/Code/Code.tsx` (react-tsx)
- proposed: 1 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- props type extends BaseProps<HTMLElement> — parent members are outside single-file extraction and are NOT carried
- prop `ref`: platform prop — not contract API, skipped
- prop `color`: type resolved heuristically — review
- prop `color`: figma binding INFERRED as VARIANT "Color" — confirm against the design library (reconcile step)
- prop `size`: unclassified type — not proposed, review manually
- prop `children`: platform prop — not contract API, skipped

## CodeBlock

- source: `examples/astryx/.astryx-sandbox/node_modules/@astryxdesign/core/src/CodeBlock/CodeBlock.tsx` (react-tsx)
- proposed: 13 props, 1 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- props type extends BaseProps<HTMLPreElement> — parent members are outside single-file extraction and are NOT carried
- prop `ref`: platform prop — not contract API, skipped
- prop `highlightLines`: unclassified type — not proposed, review manually
- event `onCopy`: declared with trigger 'root' — assign the real trigger part once anatomy is authored
- prop `maxHeight`: unclassified type — not proposed, review manually
- prop `size`: figma binding INFERRED as VARIANT "Size" — confirm against the design library (reconcile step)
- prop `container`: figma binding INFERRED as VARIANT "Container" — confirm against the design library (reconcile step)
- prop `tokenizer`: function-typed but not on* — skipped, review manually
- prop `highlightMode`: figma binding INFERRED as VARIANT "Highlight Mode" — confirm against the design library (reconcile step)
- prop `syntaxTheme`: unclassified type — not proposed, review manually

## CodeChunk

- source: `examples/astryx/.astryx-sandbox/node_modules/@astryxdesign/core/src/CodeBlock/CodeBlock.tsx` (react-tsx)
- proposed: 1 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- prop `lines`: unclassified type — not proposed, review manually
- prop `highlightSet`: unclassified type — not proposed, review manually
- prop `renderLineContent`: function-typed but not on* — skipped, review manually

## Collapsible

- source: `examples/astryx/.astryx-sandbox/node_modules/@astryxdesign/core/src/Collapsible/Collapsible.tsx` (react-tsx)
- proposed: 3 props, 1 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- props type extends BaseProps — parent members are outside single-file extraction and are NOT carried
- prop `ref`: platform prop — not contract API, skipped
- prop `trigger`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually
- prop `children`: platform prop — not contract API, skipped
- event `onOpenChange`: declared with trigger 'root' — assign the real trigger part once anatomy is authored

## CollapsibleGroup

- source: `examples/astryx/.astryx-sandbox/node_modules/@astryxdesign/core/src/Collapsible/CollapsibleGroup.tsx` (react-tsx)
- proposed: 2 props, 1 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- props type extends Omit<
  BaseProps<HTMLElement>,
  'onChange'
> — parent members are outside single-file extraction and are NOT carried
- prop `ref`: platform prop — not contract API, skipped
- prop `type`: figma binding INFERRED as VARIANT "Type" — confirm against the design library (reconcile step)
- prop `defaultValue`: unclassified type — not proposed, review manually
- prop `value`: unclassified type — not proposed, review manually
- event `onChange`: declared with trigger 'root' — assign the real trigger part once anatomy is authored
- prop `density`: unclassified type — not proposed, review manually
- prop `children`: platform prop — not contract API, skipped

## CommandPalette

- source: `examples/astryx/.astryx-sandbox/node_modules/@astryxdesign/core/src/CommandPalette/CommandPalette.tsx` (react-tsx)
- proposed: 4 props, 2 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- props type extends Omit<BaseProps<HTMLDialogElement>, 'onChange'> — parent members are outside single-file extraction and are NOT carried
- prop `ref`: platform prop — not contract API, skipped
- event `onOpenChange`: declared with trigger 'root' — assign the real trigger part once anatomy is authored
- prop `searchSource`: unclassified type — not proposed, review manually
- prop `input`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually
- prop `footer`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually
- prop `renderItem`: function-typed but not on* — skipped, review manually
- prop `emptySearchText`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually
- prop `emptyBootstrapText`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually
- event `onValueChange`: declared with trigger 'root' — assign the real trigger part once anatomy is authored
- prop `width`: unclassified type — not proposed, review manually
- prop `maxHeight`: unclassified type — not proposed, review manually

## CommandPaletteEmpty

- source: `examples/astryx/.astryx-sandbox/node_modules/@astryxdesign/core/src/CommandPalette/CommandPaletteEmpty.tsx` (react-tsx)
- proposed: 0 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- props type extends BaseProps<HTMLDivElement> — parent members are outside single-file extraction and are NOT carried
- prop `ref`: platform prop — not contract API, skipped
- prop `children`: platform prop — not contract API, skipped

## CommandPaletteFooter

- source: `examples/astryx/.astryx-sandbox/node_modules/@astryxdesign/core/src/CommandPalette/CommandPaletteFooter.tsx` (react-tsx)
- proposed: 0 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- props type extends BaseProps<HTMLDivElement> — parent members are outside single-file extraction and are NOT carried
- prop `ref`: platform prop — not contract API, skipped
- prop `children`: platform prop — not contract API, skipped

## CommandPaletteGroup

- source: `examples/astryx/.astryx-sandbox/node_modules/@astryxdesign/core/src/CommandPalette/CommandPaletteGroup.tsx` (react-tsx)
- proposed: 1 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- props type extends BaseProps<HTMLDivElement> — parent members are outside single-file extraction and are NOT carried
- prop `ref`: platform prop — not contract API, skipped
- prop `children`: platform prop — not contract API, skipped

## CommandPaletteInput

- source: `examples/astryx/.astryx-sandbox/node_modules/@astryxdesign/core/src/CommandPalette/CommandPaletteInput.tsx` (react-tsx)
- proposed: 3 props, 1 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- props type extends Omit<
  BaseProps<HTMLInputElement>,
  'onChange'
> — parent members are outside single-file extraction and are NOT carried
- prop `ref`: platform prop — not contract API, skipped
- event `onValueChange`: declared with trigger 'root' — assign the real trigger part once anatomy is authored
- prop `endContent`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually
- prop `onChange`: unclassified type — not proposed, review manually

## CommandPaletteItem

- source: `examples/astryx/.astryx-sandbox/node_modules/@astryxdesign/core/src/CommandPalette/CommandPaletteItem.tsx` (react-tsx)
- proposed: 4 props, 1 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- props type extends Omit<
  BaseProps<HTMLDivElement>,
  'onChange' | 'onSelect'
> — parent members are outside single-file extraction and are NOT carried
- prop `ref`: platform prop — not contract API, skipped
- event `onSelect`: declared with trigger 'root' — assign the real trigger part once anatomy is authored
- prop `children`: platform prop — not contract API, skipped

## CommandPaletteList

- source: `examples/astryx/.astryx-sandbox/node_modules/@astryxdesign/core/src/CommandPalette/CommandPaletteList.tsx` (react-tsx)
- proposed: 1 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- props type extends BaseProps<HTMLDivElement> — parent members are outside single-file extraction and are NOT carried
- prop `ref`: platform prop — not contract API, skipped
- prop `children`: platform prop — not contract API, skipped

## ContextMenu

- source: `examples/astryx/.astryx-sandbox/node_modules/@astryxdesign/core/src/ContextMenu/ContextMenu.tsx` (react-tsx)
- proposed: 3 props, 1 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- props type composes named reference(s) [BaseProps] whose members are outside module scope — those props are NOT carried (single-file extraction)
- props type is a UNION of alternatives [ContextMenuDataProps | ContextMenuCompoundProps] — members merged across readable branches; branch-specific members are forced optional (the mutually-exclusive alternative structure is NOT encoded in the contract; review)
- prop `items`: unclassified type — not proposed, review manually
- prop `menuContent`: unclassified type — not proposed, review manually
- prop `ref`: platform prop — not contract API, skipped
- prop `triggerXstyle`: unclassified type — not proposed, review manually
- prop `children`: platform prop — not contract API, skipped
- prop `menuWidth`: unclassified type — not proposed, review manually
- prop `size`: figma binding INFERRED as VARIANT "Size" — confirm against the design library (reconcile step)
- event `onOpenChange`: declared with trigger 'root' — assign the real trigger part once anatomy is authored

## CustomEditor

- source: `examples/astryx/.astryx-sandbox/node_modules/@astryxdesign/core/src/PowerSearch/PowerSearchValueEditor.tsx` (react-tsx)
- proposed: 1 props, 1 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- prop `operatorValue`: unclassified type — not proposed, review manually
- prop `filterValue`: unclassified type — not proposed, review manually
- event `onChange`: declared with trigger 'root' — assign the real trigger part once anatomy is authored

## DateAbsoluteEditor

- source: `examples/astryx/.astryx-sandbox/node_modules/@astryxdesign/core/src/PowerSearch/PowerSearchValueEditor.tsx` (react-tsx)
- proposed: 0 props, 1 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- prop `operatorValue`: unclassified type — not proposed, review manually
- prop `filterValue`: unclassified type — not proposed, review manually
- event `onChange`: declared with trigger 'root' — assign the real trigger part once anatomy is authored

## DateFilterControl

- source: `examples/astryx/.astryx-sandbox/node_modules/@astryxdesign/core/src/Table/plugins/filtering/useTableFiltering.tsx` (react-tsx)
- proposed: 4 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- prop `size`: figma binding INFERRED as VARIANT "Size" — confirm against the design library (reconcile step)

## DateInput

- source: `examples/astryx/.astryx-sandbox/node_modules/@astryxdesign/core/src/DateInput/DateInput.tsx` (react-tsx)
- proposed: 12 props, 1 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- props type extends Omit<
  BaseProps,
  'onChange' | 'defaultValue'
> — parent members are outside single-file extraction and are NOT carried
- prop `size`: enum values resolved as keys of the object literal passed to stylex.create(…) — key-preserving factory ASSUMED — review
- prop `ref`: platform prop — not contract API, skipped
- prop `value`: unclassified type — not proposed, review manually
- event `onChange`: declared with trigger 'root' — assign the real trigger part once anatomy is authored
- prop `changeAction`: function-typed but not on* — skipped, review manually
- prop `min`: unclassified type — not proposed, review manually
- prop `max`: unclassified type — not proposed, review manually
- prop `dateConstraints`: unclassified type — not proposed, review manually
- prop `size`: type resolved heuristically — review
- prop `size`: figma binding INFERRED as VARIANT "Size" — confirm against the design library (reconcile step)
- prop `status`: unclassified type — not proposed, review manually
- prop `width`: unclassified type — not proposed, review manually
- prop `numberOfMonths`: unclassified type — not proposed, review manually

## DateRangeEditor

- source: `examples/astryx/.astryx-sandbox/node_modules/@astryxdesign/core/src/PowerSearch/PowerSearchValueEditor.tsx` (react-tsx)
- proposed: 0 props, 1 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- prop `operatorValue`: unclassified type — not proposed, review manually
- prop `filterValue`: unclassified type — not proposed, review manually
- event `onChange`: declared with trigger 'root' — assign the real trigger part once anatomy is authored

## DateRangeInput

- source: `examples/astryx/.astryx-sandbox/node_modules/@astryxdesign/core/src/DateRangeInput/DateRangeInput.tsx` (react-tsx)
- proposed: 12 props, 1 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- props type extends Omit<
  BaseProps,
  'onChange' | 'defaultValue'
> — parent members are outside single-file extraction and are NOT carried
- prop `ref`: platform prop — not contract API, skipped
- prop `value`: unclassified type — not proposed, review manually
- event `onChange`: declared with trigger 'root' — assign the real trigger part once anatomy is authored
- prop `changeAction`: function-typed but not on* — skipped, review manually
- prop `min`: unclassified type — not proposed, review manually
- prop `max`: unclassified type — not proposed, review manually
- prop `dateConstraints`: unclassified type — not proposed, review manually
- prop `presets`: unclassified type — not proposed, review manually
- prop `size`: type resolved heuristically — review
- prop `size`: figma binding INFERRED as VARIANT "Size" — confirm against the design library (reconcile step)
- prop `status`: unclassified type — not proposed, review manually
- prop `width`: unclassified type — not proposed, review manually
- prop `numberOfMonths`: unclassified type — not proposed, review manually

## DateRelativeEditor

- source: `examples/astryx/.astryx-sandbox/node_modules/@astryxdesign/core/src/PowerSearch/PowerSearchValueEditor.tsx` (react-tsx)
- proposed: 0 props, 1 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- prop `operatorValue`: unclassified type — not proposed, review manually
- prop `filterValue`: unclassified type — not proposed, review manually
- event `onChange`: declared with trigger 'root' — assign the real trigger part once anatomy is authored

## DateTimeInput

- source: `examples/astryx/.astryx-sandbox/node_modules/@astryxdesign/core/src/DateTimeInput/DateTimeInput.tsx` (react-tsx)
- proposed: 16 props, 1 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- props type extends Omit<
  BaseProps,
  'onChange' | 'defaultValue'
> — parent members are outside single-file extraction and are NOT carried
- prop `ref`: platform prop — not contract API, skipped
- prop `value`: unclassified type — not proposed, review manually
- event `onChange`: declared with trigger 'root' — assign the real trigger part once anatomy is authored
- prop `changeAction`: function-typed but not on* — skipped, review manually
- prop `min`: unclassified type — not proposed, review manually
- prop `max`: unclassified type — not proposed, review manually
- prop `dateConstraints`: unclassified type — not proposed, review manually
- prop `hourFormat`: type resolved heuristically — review
- prop `hourFormat`: figma binding INFERRED as VARIANT "Hour Format" — confirm against the design library (reconcile step)
- prop `timeIncrement`: unclassified type — not proposed, review manually
- prop `size`: type resolved heuristically — review
- prop `size`: figma binding INFERRED as VARIANT "Size" — confirm against the design library (reconcile step)
- prop `status`: unclassified type — not proposed, review manually
- prop `width`: unclassified type — not proposed, review manually
- prop `numberOfMonths`: unclassified type — not proposed, review manually

## DayCell

- source: `examples/astryx/.astryx-sandbox/node_modules/@astryxdesign/core/src/Calendar/Calendar.tsx` (react-tsx)
- proposed: 5 props, 2 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- prop `day`: unclassified type — not proposed, review manually
- prop `mode`: figma binding INFERRED as VARIANT "Mode" — confirm against the design library (reconcile step)
- prop `selectedDate`: unclassified type — not proposed, review manually
- prop `rangeStart`: unclassified type — not proposed, review manually
- prop `rangeEnd`: unclassified type — not proposed, review manually
- prop `previewStart`: unclassified type — not proposed, review manually
- prop `previewEnd`: unclassified type — not proposed, review manually
- prop `today`: unclassified type — not proposed, review manually
- prop `neighbors`: unclassified type — not proposed, review manually
- event `onDayClick`: declared with trigger 'root' — assign the real trigger part once anatomy is authored
- event `onDayHover`: declared with trigger 'root' — assign the real trigger part once anatomy is authored

## DefaultIcon

- source: `examples/astryx/.astryx-sandbox/node_modules/@astryxdesign/core/src/Avatar/Avatar.tsx` (react-tsx)
- proposed: 1 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element

## DefaultMegaMenu

- source: `examples/astryx/.astryx-sandbox/node_modules/@astryxdesign/core/src/TopNav/TopNavMegaMenu.tsx` (react-tsx)
- proposed: 3 props, 1 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- props type extends BaseProps<HTMLButtonElement> — parent members are outside single-file extraction and are NOT carried
- prop `ref`: platform prop — not contract API, skipped
- prop `items`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually
- prop `featured`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually
- event `onOpenChange`: declared with trigger 'root' — assign the real trigger part once anatomy is authored

## DefaultOption

- source: `examples/astryx/.astryx-sandbox/node_modules/@astryxdesign/core/src/Selector/Selector.tsx` (react-tsx)
- proposed: 0 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- prop `option`: unclassified type — not proposed, review manually

## Dialog

- source: `examples/astryx/.astryx-sandbox/node_modules/@astryxdesign/core/src/Dialog/Dialog.tsx` (react-tsx)
- proposed: 4 props, 1 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- props type extends BaseProps<HTMLDialogElement> — parent members are outside single-file extraction and are NOT carried
- prop `variant`: enum values resolved as member names of the in-file interface DialogVariantMap (module augmentation may extend it) — review
- prop `ref`: platform prop — not contract API, skipped
- event `onOpenChange`: declared with trigger 'root' — assign the real trigger part once anatomy is authored
- prop `width`: unclassified type — not proposed, review manually
- prop `maxHeight`: unclassified type — not proposed, review manually
- prop `position`: unclassified type — not proposed, review manually
- prop `variant`: type resolved heuristically — review
- prop `variant`: figma binding INFERRED as VARIANT "Variant" — confirm against the design library (reconcile step)
- prop `purpose`: type resolved heuristically — review
- prop `purpose`: figma binding INFERRED as VARIANT "Purpose" — confirm against the design library (reconcile step)
- prop `padding`: unclassified type — not proposed, review manually
- prop `children`: platform prop — not contract API, skipped

## DialogHeader

- source: `examples/astryx/.astryx-sandbox/node_modules/@astryxdesign/core/src/Dialog/DialogHeader.tsx` (react-tsx)
- proposed: 3 props, 1 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- props type extends BaseProps<HTMLDivElement> — parent members are outside single-file extraction and are NOT carried
- prop `ref`: platform prop — not contract API, skipped
- event `onOpenChange`: declared with trigger 'root' — assign the real trigger part once anatomy is authored
- prop `startContent`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually
- prop `endContent`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually

## Divider

- source: `examples/astryx/.astryx-sandbox/node_modules/@astryxdesign/core/src/Divider/Divider.tsx` (react-tsx)
- proposed: 3 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- props type extends BaseProps<HTMLDivElement> — parent members are outside single-file extraction and are NOT carried
- prop `variant`: enum values resolved as member names of the in-file interface DividerVariantMap (module augmentation may extend it) — review
- prop `ref`: platform prop — not contract API, skipped
- prop `orientation`: figma binding INFERRED as VARIANT "Orientation" — confirm against the design library (reconcile step)
- prop `label`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually
- prop `variant`: type resolved heuristically — review
- prop `variant`: figma binding INFERRED as VARIANT "Variant" — confirm against the design library (reconcile step)

## DropdownMenu

- source: `examples/astryx/.astryx-sandbox/node_modules/@astryxdesign/core/src/DropdownMenu/DropdownMenu.tsx` (react-tsx)
- proposed: 2 props, 2 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- props type composes named reference(s) [BaseProps] whose members are outside module scope — those props are NOT carried (single-file extraction)
- props type is a UNION of alternatives [DropdownMenuDataProps | DropdownMenuCompoundProps] — members merged across readable branches; branch-specific members are forced optional (the mutually-exclusive alternative structure is NOT encoded in the contract; review)
- prop `items`: unclassified type — not proposed, review manually
- prop `children`: platform prop — not contract API, skipped
- prop `button`: unclassified type — not proposed, review manually
- event `onOpenChange`: declared with trigger 'root' — assign the real trigger part once anatomy is authored
- prop `menuWidth`: unclassified type — not proposed, review manually
- event `onClick`: declared with trigger 'root' — assign the real trigger part once anatomy is authored
- prop `placement`: unclassified type — not proposed, review manually

## DropdownMenuItem

- source: `examples/astryx/.astryx-sandbox/node_modules/@astryxdesign/core/src/DropdownMenu/DropdownMenuItem.tsx` (react-tsx)
- proposed: 1 props, 1 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- props type extends Pick<
  BaseProps,
  'xstyle' | 'className' | 'style'
> — parent members are outside single-file extraction and are NOT carried
- prop `icon`: unclassified type — not proposed, review manually
- prop `label`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually
- prop `description`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually
- event `onClick`: declared with trigger 'root' — assign the real trigger part once anatomy is authored
- prop `endContent`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually

## EmptyState

- source: `examples/astryx/.astryx-sandbox/node_modules/@astryxdesign/core/src/EmptyState/EmptyState.tsx` (react-tsx)
- proposed: 3 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- props type extends BaseProps<HTMLDivElement> — parent members are outside single-file extraction and are NOT carried
- prop `ref`: platform prop — not contract API, skipped
- prop `icon`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually
- prop `actions`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually
- prop `headingLevel`: unclassified type — not proposed, review manually

## EntityListEditor

- source: `examples/astryx/.astryx-sandbox/node_modules/@astryxdesign/core/src/PowerSearch/PowerSearchValueEditor.tsx` (react-tsx)
- proposed: 0 props, 1 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- prop `operatorValue`: unclassified type — not proposed, review manually
- prop `filterValue`: unclassified type — not proposed, review manually
- event `onChange`: declared with trigger 'root' — assign the real trigger part once anatomy is authored

## EnumEditor

- source: `examples/astryx/.astryx-sandbox/node_modules/@astryxdesign/core/src/PowerSearch/PowerSearchValueEditor.tsx` (react-tsx)
- proposed: 0 props, 1 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- prop `operatorValue`: unclassified type — not proposed, review manually
- prop `filterValue`: unclassified type — not proposed, review manually
- event `onChange`: declared with trigger 'root' — assign the real trigger part once anatomy is authored

## EnumListEditor

- source: `examples/astryx/.astryx-sandbox/node_modules/@astryxdesign/core/src/PowerSearch/PowerSearchValueEditor.tsx` (react-tsx)
- proposed: 0 props, 1 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- prop `operatorValue`: unclassified type — not proposed, review manually
- prop `filterValue`: unclassified type — not proposed, review manually
- event `onChange`: declared with trigger 'root' — assign the real trigger part once anatomy is authored

## ExpansionChevron

- source: `examples/astryx/.astryx-sandbox/node_modules/@astryxdesign/core/src/Table/plugins/rowExpansion/useTableRowExpansion.tsx` (react-tsx)
- proposed: 2 props, 1 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- event `onToggle`: declared with trigger 'root' — assign the real trigger part once anatomy is authored

## Field

- source: `examples/astryx/.astryx-sandbox/node_modules/@astryxdesign/core/src/Field/Field.tsx` (react-tsx)
- proposed: 12 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- props type extends Omit<
  BaseProps<HTMLDivElement>,
  'children'
> — parent members are outside single-file extraction and are NOT carried
- prop `ref`: platform prop — not contract API, skipped
- prop `labelIcon`: unclassified type — not proposed, review manually
- prop `status`: unclassified type — not proposed, review manually
- prop `statusVariant`: figma binding INFERRED as VARIANT "Status Variant" — confirm against the design library (reconcile step)
- prop `width`: unclassified type — not proposed, review manually
- prop `children`: platform prop — not contract API, skipped

## FieldLabel

- source: `examples/astryx/.astryx-sandbox/node_modules/@astryxdesign/core/src/Field/FieldLabel.tsx` (react-tsx)
- proposed: 10 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- props type extends BaseProps<HTMLLabelElement> — parent members are outside single-file extraction and are NOT carried
- prop `ref`: platform prop — not contract API, skipped
- prop `labelIcon`: unclassified type — not proposed, review manually
- prop `description`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually

## FieldStatus

- source: `examples/astryx/.astryx-sandbox/node_modules/@astryxdesign/core/src/FieldStatus/FieldStatus.tsx` (react-tsx)
- proposed: 2 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- props type extends BaseProps<HTMLDivElement> — parent members are outside single-file extraction and are NOT carried
- prop `variant`: enum values resolved as member names of the in-file interface FieldStatusVariantMap (module augmentation may extend it) — review
- prop `ref`: platform prop — not contract API, skipped
- prop `type`: unclassified type — not proposed, review manually
- prop `variant`: type resolved heuristically — review
- prop `variant`: figma binding INFERRED as VARIANT "Variant" — confirm against the design library (reconcile step)

## FileInput

- source: `examples/astryx/.astryx-sandbox/node_modules/@astryxdesign/core/src/FileInput/FileInput.tsx` (react-tsx)
- proposed: 15 props, 1 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- props type extends Omit<
  BaseProps,
  'onChange' | 'defaultValue' | 'value'
> — parent members are outside single-file extraction and are NOT carried
- prop `ref`: platform prop — not contract API, skipped
- prop `value`: unclassified type — not proposed, review manually
- event `onChange`: declared with trigger 'root' — assign the real trigger part once anatomy is authored
- prop `changeAction`: function-typed but not on* — skipped, review manually
- prop `status`: unclassified type — not proposed, review manually
- prop `mode`: figma binding INFERRED as VARIANT "Mode" — confirm against the design library (reconcile step)
- prop `width`: unclassified type — not proposed, review manually

## FilterControl

- source: `examples/astryx/.astryx-sandbox/node_modules/@astryxdesign/core/src/Table/plugins/filtering/useTableFiltering.tsx` (react-tsx)
- proposed: 4 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- prop `operatorValue`: unclassified type — not proposed, review manually
- prop `size`: figma binding INFERRED as VARIANT "Size" — confirm against the design library (reconcile step)

## FilterSlot

- source: `examples/astryx/.astryx-sandbox/node_modules/@astryxdesign/core/src/Table/plugins/filtering/useTableFiltering.tsx` (react-tsx)
- proposed: 2 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- prop `operatorValue`: unclassified type — not proposed, review manually

## FloatEditor

- source: `examples/astryx/.astryx-sandbox/node_modules/@astryxdesign/core/src/PowerSearch/PowerSearchValueEditor.tsx` (react-tsx)
- proposed: 0 props, 1 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- prop `operatorValue`: unclassified type — not proposed, review manually
- prop `filterValue`: unclassified type — not proposed, review manually
- event `onChange`: declared with trigger 'root' — assign the real trigger part once anatomy is authored

## FormLayout

- source: `examples/astryx/.astryx-sandbox/node_modules/@astryxdesign/core/src/FormLayout/FormLayout.tsx` (react-tsx)
- proposed: 0 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- props type extends BaseProps<HTMLDivElement> — parent members are outside single-file extraction and are NOT carried
- prop `ref`: platform prop — not contract API, skipped
- prop `children`: platform prop — not contract API, skipped
- prop `direction`: unclassified type — not proposed, review manually

## Grid

- source: `examples/astryx/.astryx-sandbox/node_modules/@astryxdesign/core/src/Grid/Grid.tsx` (react-tsx)
- proposed: 4 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- props type extends BaseProps<HTMLDivElement> — parent members are outside single-file extraction and are NOT carried
- prop `ref`: platform prop — not contract API, skipped
- prop `columns`: unclassified type — not proposed, review manually
- prop `width`: unclassified type — not proposed, review manually
- prop `height`: unclassified type — not proposed, review manually
- prop `maxWidth`: unclassified type — not proposed, review manually
- prop `minHeight`: unclassified type — not proposed, review manually
- prop `gap`: unclassified type — not proposed, review manually
- prop `rowGap`: unclassified type — not proposed, review manually
- prop `columnGap`: unclassified type — not proposed, review manually
- prop `align`: type resolved heuristically — review
- prop `align`: figma binding INFERRED as VARIANT "Align" — confirm against the design library (reconcile step)
- prop `justify`: type resolved heuristically — review
- prop `justify`: figma binding INFERRED as VARIANT "Justify" — confirm against the design library (reconcile step)
- prop `children`: platform prop — not contract API, skipped

## GridSpan

- source: `examples/astryx/.astryx-sandbox/node_modules/@astryxdesign/core/src/Grid/GridSpan.tsx` (react-tsx)
- proposed: 1 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- props type extends BaseProps<HTMLDivElement> — parent members are outside single-file extraction and are NOT carried
- prop `ref`: platform prop — not contract API, skipped
- prop `columns`: unclassified type — not proposed, review manually
- prop `children`: platform prop — not contract API, skipped

## Heading

- source: `examples/astryx/.astryx-sandbox/node_modules/@astryxdesign/core/src/Heading/Heading.tsx` (react-tsx)
- proposed: 4 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- props type extends Omit<
  BaseProps<HTMLHeadingElement>,
  'children'
> — parent members are outside single-file extraction and are NOT carried
- prop `ref`: platform prop — not contract API, skipped
- prop `level`: unclassified type — not proposed, review manually
- prop `type`: type resolved heuristically — review
- prop `type`: figma binding INFERRED as VARIANT "Type" — confirm against the design library (reconcile step)
- prop `accessibilityLevel`: unclassified type — not proposed, review manually
- prop `color`: unclassified type — not proposed, review manually
- prop `display`: unclassified type — not proposed, review manually
- prop `hasTruncateTooltip`: unclassified type — not proposed, review manually
- prop `wordBreak`: unclassified type — not proposed, review manually
- prop `textWrap`: unclassified type — not proposed, review manually
- prop `justify`: unclassified type — not proposed, review manually
- prop `children`: platform prop — not contract API, skipped

## HoverCard

- source: `examples/astryx/.astryx-sandbox/node_modules/@astryxdesign/core/src/HoverCard/HoverCard.tsx` (react-tsx)
- proposed: 5 props, 1 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- props type extends Pick<
  BaseProps,
  'xstyle' | 'className' | 'style'
> — parent members are outside single-file extraction and are NOT carried
- prop `children`: platform prop — not contract API, skipped
- prop `content`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually
- prop `placement`: unclassified type — not proposed, review manually
- prop `alignment`: unclassified type — not proposed, review manually
- prop `focusTrigger`: unclassified type — not proposed, review manually
- event `onOpenChange`: declared with trigger 'root' — assign the real trigger part once anatomy is authored
- prop `hasHoverIndication`: unclassified type — not proposed, review manually

## HStack

- source: `examples/astryx/.astryx-sandbox/node_modules/@astryxdesign/core/src/HStack/HStack.tsx` (react-tsx)
- proposed: 0 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- props type extends Omit<
  StackProps,
  'direction' | 'hAlign' | 'vAlign'
> — parent members are outside single-file extraction and are NOT carried
- prop `ref`: platform prop — not contract API, skipped
- prop `hAlign`: unclassified type — not proposed, review manually
- prop `vAlign`: unclassified type — not proposed, review manually
- prop `justify`: unclassified type — not proposed, review manually
- prop `align`: unclassified type — not proposed, review manually

## Icon

- source: `examples/astryx/.astryx-sandbox/node_modules/@astryxdesign/core/src/Icon/Icon.tsx` (react-tsx)
- proposed: 2 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- props type extends Omit<
  SVGProps<SVGSVGElement>,
  'ref' | 'color'
> — parent members are outside single-file extraction and are NOT carried
- prop `color`: enum values resolved as keys of the object literal passed to stylex.create(…) — key-preserving factory ASSUMED — review
- prop `size`: enum values resolved as keys of the object literal passed to stylex.create(…) — key-preserving factory ASSUMED — review
- prop `ref`: platform prop — not contract API, skipped
- prop `icon`: unclassified type — not proposed, review manually
- prop `color`: type resolved heuristically — review
- prop `color`: figma binding INFERRED as VARIANT "Color" — confirm against the design library (reconcile step)
- prop `size`: type resolved heuristically — review
- prop `size`: figma binding INFERRED as VARIANT "Size" — confirm against the design library (reconcile step)

## IconButton

- source: `examples/astryx/.astryx-sandbox/node_modules/@astryxdesign/core/src/IconButton/IconButton.tsx` (react-tsx)
- proposed: 0 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- props type extends Omit<
  ButtonProps,
  'isIconOnly' | 'children' | 'endContent'
> — parent members are outside single-file extraction and are NOT carried
- prop `icon`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually

## IconFromRegistry

- source: `examples/astryx/.astryx-sandbox/node_modules/@astryxdesign/core/src/Icon/Icon.tsx` (react-tsx)
- proposed: 2 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- prop `color`: enum values resolved as keys of the object literal passed to stylex.create(…) — key-preserving factory ASSUMED — review
- prop `size`: enum values resolved as keys of the object literal passed to stylex.create(…) — key-preserving factory ASSUMED — review
- prop `name`: unclassified type — not proposed, review manually
- prop `color`: type resolved heuristically — review
- prop `color`: figma binding INFERRED as VARIANT "Color" — confirm against the design library (reconcile step)
- prop `size`: type resolved heuristically — review
- prop `size`: figma binding INFERRED as VARIANT "Size" — confirm against the design library (reconcile step)
- prop `spanProps`: unclassified type — not proposed, review manually

## InlineFilterSlot

- source: `examples/astryx/.astryx-sandbox/node_modules/@astryxdesign/core/src/Table/plugins/filtering/useTableFiltering.tsx` (react-tsx)
- proposed: 2 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- prop `operatorValue`: unclassified type — not proposed, review manually

## InputClearButton

- source: `examples/astryx/.astryx-sandbox/node_modules/@astryxdesign/core/src/Field/InputClearButton.tsx` (react-tsx)
- proposed: 1 props, 1 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- event `onClick`: declared with trigger 'root' — assign the real trigger part once anatomy is authored
- prop `xstyle`: unclassified type — not proposed, review manually

## InputGroup

- source: `examples/astryx/.astryx-sandbox/node_modules/@astryxdesign/core/src/InputGroup/InputGroup.tsx` (react-tsx)
- proposed: 8 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- props type extends Omit<
  BaseProps<HTMLDivElement>,
  'children'
> — parent members are outside single-file extraction and are NOT carried
- prop `ref`: platform prop — not contract API, skipped
- prop `children`: platform prop — not contract API, skipped
- prop `size`: type resolved heuristically — review
- prop `size`: figma binding INFERRED as VARIANT "Size" — confirm against the design library (reconcile step)
- prop `status`: unclassified type — not proposed, review manually

## InputGroupText

- source: `examples/astryx/.astryx-sandbox/node_modules/@astryxdesign/core/src/InputGroup/InputGroupText.tsx` (react-tsx)
- proposed: 0 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- props type extends BaseProps<HTMLDivElement> — parent members are outside single-file extraction and are NOT carried
- prop `ref`: platform prop — not contract API, skipped
- prop `children`: platform prop — not contract API, skipped

## IntegerEditor

- source: `examples/astryx/.astryx-sandbox/node_modules/@astryxdesign/core/src/PowerSearch/PowerSearchValueEditor.tsx` (react-tsx)
- proposed: 0 props, 1 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- prop `operatorValue`: unclassified type — not proposed, review manually
- prop `filterValue`: unclassified type — not proposed, review manually
- event `onChange`: declared with trigger 'root' — assign the real trigger part once anatomy is authored

## Item

- source: `examples/astryx/.astryx-sandbox/node_modules/@astryxdesign/core/src/Item/Item.tsx` (react-tsx)
- proposed: 11 props, 1 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- props type extends BaseProps<HTMLElement> — parent members are outside single-file extraction and are NOT carried
- prop `ref`: platform prop — not contract API, skipped
- prop `as`: figma binding INFERRED as VARIANT "As" — confirm against the design library (reconcile step)
- prop `marker`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually
- prop `startContent`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually
- prop `label`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually
- prop `description`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually
- prop `endContent`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually
- prop `align`: type resolved heuristically — review
- prop `align`: figma binding INFERRED as VARIANT "Align" — confirm against the design library (reconcile step)
- prop `density`: type resolved heuristically — review
- prop `density`: figma binding INFERRED as VARIANT "Density" — confirm against the design library (reconcile step)
- event `onClick`: declared with trigger 'root' — assign the real trigger part once anatomy is authored
- prop `target`: figma binding INFERRED as VARIANT "Target" — confirm against the design library (reconcile step)

## ItemRenderer

- source: `examples/astryx/.astryx-sandbox/node_modules/@astryxdesign/core/src/CommandPalette/CommandPalette.tsx` (react-tsx)
- proposed: 1 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- prop `items`: unclassified type — not proposed, review manually
- prop `renderItem`: function-typed but not on* — skipped, review manually

## Kbd

- source: `examples/astryx/.astryx-sandbox/node_modules/@astryxdesign/core/src/Kbd/Kbd.tsx` (react-tsx)
- proposed: 1 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- props type extends BaseProps<HTMLSpanElement> — parent members are outside single-file extraction and are NOT carried
- prop `ref`: platform prop — not contract API, skipped

## LayerProvider

- source: `examples/astryx/.astryx-sandbox/node_modules/@astryxdesign/core/src/Layer/LayerProvider.tsx` (react-tsx)
- proposed: 0 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- prop `children`: platform prop — not contract API, skipped
- prop `toast`: unclassified type — not proposed, review manually

## Layout

- source: `examples/astryx/.astryx-sandbox/node_modules/@astryxdesign/core/src/Layout/Layout.tsx` (react-tsx)
- proposed: 2 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- props type extends Omit<BaseProps, 'content'> — parent members are outside single-file extraction and are NOT carried
- prop `ref`: platform prop — not contract API, skipped
- prop `content`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually
- prop `contentWidth`: unclassified type — not proposed, review manually
- prop `end`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually
- prop `footer`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually
- prop `header`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually
- prop `height`: type resolved heuristically — review
- prop `height`: figma binding INFERRED as VARIANT "Height" — confirm against the design library (reconcile step)
- prop `padding`: unclassified type — not proposed, review manually
- prop `start`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually
- prop `children`: platform prop — not contract API, skipped

## LayoutContent

- source: `examples/astryx/.astryx-sandbox/node_modules/@astryxdesign/core/src/Layout/LayoutContent.tsx` (react-tsx)
- proposed: 2 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- props type extends BaseProps<HTMLDivElement> — parent members are outside single-file extraction and are NOT carried
- prop `ref`: platform prop — not contract API, skipped
- prop `children`: platform prop — not contract API, skipped
- prop `padding`: unclassified type — not proposed, review manually
- prop `role`: unclassified type — not proposed, review manually

## LayoutFooter

- source: `examples/astryx/.astryx-sandbox/node_modules/@astryxdesign/core/src/Layout/LayoutFooter.tsx` (react-tsx)
- proposed: 2 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- props type extends BaseProps<HTMLDivElement> — parent members are outside single-file extraction and are NOT carried
- prop `ref`: platform prop — not contract API, skipped
- prop `children`: platform prop — not contract API, skipped
- prop `height`: unclassified type — not proposed, review manually
- prop `padding`: unclassified type — not proposed, review manually
- prop `role`: unclassified type — not proposed, review manually

## LayoutHeader

- source: `examples/astryx/.astryx-sandbox/node_modules/@astryxdesign/core/src/Layout/LayoutHeader.tsx` (react-tsx)
- proposed: 2 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- props type extends BaseProps<HTMLDivElement> — parent members are outside single-file extraction and are NOT carried
- prop `ref`: platform prop — not contract API, skipped
- prop `children`: platform prop — not contract API, skipped
- prop `height`: unclassified type — not proposed, review manually
- prop `padding`: unclassified type — not proposed, review manually
- prop `role`: unclassified type — not proposed, review manually

## LayoutPanel

- source: `examples/astryx/.astryx-sandbox/node_modules/@astryxdesign/core/src/Layout/LayoutPanel.tsx` (react-tsx)
- proposed: 3 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- props type extends BaseProps<HTMLDivElement> — parent members are outside single-file extraction and are NOT carried
- prop `ref`: platform prop — not contract API, skipped
- prop `children`: platform prop — not contract API, skipped
- prop `padding`: unclassified type — not proposed, review manually
- prop `role`: unclassified type — not proposed, review manually
- prop `width`: unclassified type — not proposed, review manually
- prop `resizable`: unclassified type — not proposed, review manually

## LazyTableContextMenu

- source: `examples/astryx/.astryx-sandbox/node_modules/@astryxdesign/core/src/Table/tableContextMenu.tsx` (react-tsx)
- proposed: 0 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- prop `element`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually
- prop `getActions`: function-typed but not on* — skipped, review manually
- prop `triggerXstyle`: unclassified type — not proposed, review manually

## Lightbox

- source: `examples/astryx/.astryx-sandbox/node_modules/@astryxdesign/core/src/Lightbox/Lightbox.tsx` (react-tsx)
- proposed: 5 props, 2 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- props type extends BaseProps<HTMLDialogElement> — parent members are outside single-file extraction and are NOT carried
- prop `ref`: platform prop — not contract API, skipped
- event `onOpenChange`: declared with trigger 'root' — assign the real trigger part once anatomy is authored
- prop `media`: unclassified type — not proposed, review manually
- event `onIndexChange`: declared with trigger 'root' — assign the real trigger part once anatomy is authored

## Link

- source: `examples/astryx/.astryx-sandbox/node_modules/@astryxdesign/core/src/Link/Link.tsx` (react-tsx)
- proposed: 11 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- props type extends BaseProps<
  HTMLAnchorElement | HTMLButtonElement
> — parent members are outside single-file extraction and are NOT carried
- prop `ref`: platform prop — not contract API, skipped
- prop `as`: unclassified type — not proposed, review manually
- prop `download`: unclassified type — not proposed, review manually
- prop `referrerPolicy`: unclassified type — not proposed, review manually
- prop `onClick`: unclassified type — not proposed, review manually
- prop `type`: unclassified type — not proposed, review manually
- prop `size`: unclassified type — not proposed, review manually
- prop `weight`: unclassified type — not proposed, review manually
- prop `color`: unclassified type — not proposed, review manually
- prop `display`: unclassified type — not proposed, review manually
- prop `children`: platform prop — not contract API, skipped

## LinkProvider

- source: `examples/astryx/.astryx-sandbox/node_modules/@astryxdesign/core/src/Link/LinkProvider.tsx` (react-tsx)
- proposed: 0 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- prop `component`: unclassified type — not proposed, review manually
- prop `children`: platform prop — not contract API, skipped

## LinkWithTo

- source: `examples/astryx/.astryx-sandbox/node_modules/@astryxdesign/core/src/Link/useLinkComponent.ts` (react-tsx)
- proposed: 2 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- prop `ref`: platform prop — not contract API, skipped

## List

- source: `examples/astryx/.astryx-sandbox/node_modules/@astryxdesign/core/src/List/List.tsx` (react-tsx)
- proposed: 2 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- props type extends BaseProps<
  HTMLUListElement | HTMLOListElement
> — parent members are outside single-file extraction and are NOT carried
- prop `ref`: platform prop — not contract API, skipped
- prop `children`: platform prop — not contract API, skipped
- prop `density`: unclassified type — not proposed, review manually
- prop `header`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually
- prop `listStyle`: unclassified type — not proposed, review manually

## ListItem

- source: `examples/astryx/.astryx-sandbox/node_modules/@astryxdesign/core/src/List/ListItem.tsx` (react-tsx)
- proposed: 5 props, 1 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- props type extends BaseProps<HTMLLIElement> — parent members are outside single-file extraction and are NOT carried
- prop `ref`: platform prop — not contract API, skipped
- prop `label`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually
- prop `description`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually
- prop `startContent`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually
- prop `endContent`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually
- event `onClick`: declared with trigger 'root' — assign the real trigger part once anatomy is authored

## Markdown

- source: `examples/astryx/.astryx-sandbox/node_modules/@astryxdesign/core/src/Markdown/Markdown.tsx` (react-tsx)
- proposed: 4 props, 1 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- props type extends BaseProps<HTMLElement> — parent members are outside single-file extraction and are NOT carried
- prop `ref`: platform prop — not contract API, skipped
- prop `children`: platform prop — not contract API, skipped
- prop `display`: unclassified type — not proposed, review manually
- prop `density`: figma binding INFERRED as VARIANT "Density" — confirm against the design library (reconcile step)
- prop `headingLevelStart`: unclassified type — not proposed, review manually
- event `onLinkClick`: declared with trigger 'root' — assign the real trigger part once anatomy is authored
- prop `sources`: unclassified type — not proposed, review manually
- prop `citationStyle`: figma binding INFERRED as VARIANT "Citation Style" — confirm against the design library (reconcile step)
- prop `contentWidth`: unclassified type — not proposed, review manually
- prop `contentAlign`: figma binding INFERRED as VARIANT "Content Align" — confirm against the design library (reconcile step)
- prop `components`: unclassified type — not proposed, review manually
- prop `inlinePlugins`: unclassified type — not proposed, review manually
- prop `autolink`: unclassified type — not proposed, review manually

## MediaTheme

- source: `examples/astryx/.astryx-sandbox/node_modules/@astryxdesign/core/src/theme/MediaTheme.tsx` (react-tsx)
- proposed: 1 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- prop `mode`: figma binding INFERRED as VARIANT "Mode" — confirm against the design library (reconcile step)
- prop `children`: platform prop — not contract API, skipped

## MetadataList

- source: `examples/astryx/.astryx-sandbox/node_modules/@astryxdesign/core/src/MetadataList/MetadataList.tsx` (react-tsx)
- proposed: 2 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- props type extends Omit<
  BaseProps<HTMLDivElement>,
  'title'
> — parent members are outside single-file extraction and are NOT carried
- prop `ref`: platform prop — not contract API, skipped
- prop `children`: platform prop — not contract API, skipped
- prop `columns`: unclassified type — not proposed, review manually
- prop `label`: unclassified type — not proposed, review manually
- prop `orientation`: figma binding INFERRED as VARIANT "Orientation" — confirm against the design library (reconcile step)
- prop `title`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually

## MetadataListItem

- source: `examples/astryx/.astryx-sandbox/node_modules/@astryxdesign/core/src/MetadataList/MetadataListItem.tsx` (react-tsx)
- proposed: 1 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- props type extends BaseProps<HTMLDivElement> — parent members are outside single-file extraction and are NOT carried
- prop `ref`: platform prop — not contract API, skipped
- prop `children`: platform prop — not contract API, skipped
- prop `icon`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually

## MobileNav

- source: `examples/astryx/.astryx-sandbox/node_modules/@astryxdesign/core/src/MobileNav/MobileNav.tsx` (react-tsx)
- proposed: 4 props, 1 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- props type extends Omit<BaseProps, 'title'> — parent members are outside single-file extraction and are NOT carried
- prop `ref`: platform prop — not contract API, skipped
- event `onOpenChange`: declared with trigger 'root' — assign the real trigger part once anatomy is authored
- prop `children`: platform prop — not contract API, skipped
- prop `header`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually
- prop `side`: figma binding INFERRED as VARIANT "Side" — confirm against the design library (reconcile step)

## MobileNavToggle

- source: `examples/astryx/.astryx-sandbox/node_modules/@astryxdesign/core/src/MobileNav/MobileNavToggle.tsx` (react-tsx)
- proposed: 1 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- props type extends Pick<
  BaseProps,
  'xstyle' | 'className' | 'style'
> — parent members are outside single-file extraction and are NOT carried
- prop `ref`: platform prop — not contract API, skipped
- prop `children`: platform prop — not contract API, skipped

## MonthGrid

- source: `examples/astryx/.astryx-sandbox/node_modules/@astryxdesign/core/src/Calendar/Calendar.tsx` (react-tsx)
- proposed: 4 props, 5 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- prop `month`: unclassified type — not proposed, review manually
- prop `value`: unclassified type — not proposed, review manually
- prop `mode`: figma binding INFERRED as VARIANT "Mode" — confirm against the design library (reconcile step)
- prop `rangeSelectionStart`: unclassified type — not proposed, review manually
- prop `hoveredDate`: unclassified type — not proposed, review manually
- prop `min`: unclassified type — not proposed, review manually
- prop `max`: unclassified type — not proposed, review manually
- prop `dateConstraints`: unclassified type — not proposed, review manually
- prop `weekStartsOn`: unclassified type — not proposed, review manually
- event `onDayClick`: declared with trigger 'root' — assign the real trigger part once anatomy is authored
- event `onDayHover`: declared with trigger 'root' — assign the real trigger part once anatomy is authored
- prop `today`: unclassified type — not proposed, review manually
- event `onNavigatePrevious`: declared with trigger 'root' — assign the real trigger part once anatomy is authored
- event `onNavigateNext`: declared with trigger 'root' — assign the real trigger part once anatomy is authored
- prop `pendingFocus`: unclassified type — not proposed, review manually
- event `onPendingFocusHandled`: declared with trigger 'root' — assign the real trigger part once anatomy is authored

## MoreMenu

- source: `examples/astryx/.astryx-sandbox/node_modules/@astryxdesign/core/src/MoreMenu/MoreMenu.tsx` (react-tsx)
- proposed: 3 props, 1 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- props type extends Pick<
  BaseProps,
  'xstyle' | 'className' | 'style'
> — parent members are outside single-file extraction and are NOT carried
- prop `ref`: platform prop — not contract API, skipped
- prop `items`: unclassified type — not proposed, review manually
- prop `variant`: unclassified type — not proposed, review manually
- prop `size`: unclassified type — not proposed, review manually
- prop `icon`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually
- event `onOpenChange`: declared with trigger 'root' — assign the real trigger part once anatomy is authored

## MultiSelector

- source: `examples/astryx/.astryx-sandbox/node_modules/@astryxdesign/core/src/MultiSelector/MultiSelector.tsx` (react-tsx)
- proposed: 20 props, 1 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- props type extends Omit<BaseProps, 'onChange' | 'defaultValue'> — parent members are outside single-file extraction and are NOT carried
- prop `options`: unclassified type — not proposed, review manually
- prop `value`: unclassified type — not proposed, review manually
- event `onChange`: declared with trigger 'root' — assign the real trigger part once anatomy is authored
- prop `changeAction`: function-typed but not on* — skipped, review manually
- prop `size`: type resolved heuristically — review
- prop `size`: figma binding INFERRED as VARIANT "Size" — confirm against the design library (reconcile step)
- prop `status`: unclassified type — not proposed, review manually
- prop `width`: unclassified type — not proposed, review manually
- prop `startIcon`: unclassified type — not proposed, review manually
- prop `triggerDisplay`: figma binding INFERRED as VARIANT "Trigger Display" — confirm against the design library (reconcile step)
- prop `renderOption`: function-typed but not on* — skipped, review manually

## MultiSelectorFilterControl

- source: `examples/astryx/.astryx-sandbox/node_modules/@astryxdesign/core/src/Table/plugins/filtering/useTableFiltering.tsx` (react-tsx)
- proposed: 4 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- prop `operatorValue`: unclassified type — not proposed, review manually
- prop `size`: figma binding INFERRED as VARIANT "Size" — confirm against the design library (reconcile step)

## NavHeadingMenu

- source: `examples/astryx/.astryx-sandbox/node_modules/@astryxdesign/core/src/NavMenu/NavHeadingMenu.tsx` (react-tsx)
- proposed: 0 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- props type extends BaseProps<HTMLDivElement> — parent members are outside single-file extraction and are NOT carried
- prop `ref`: platform prop — not contract API, skipped
- prop `children`: platform prop — not contract API, skipped
- prop `size`: unclassified type — not proposed, review manually
- prop `minWidth`: unclassified type — not proposed, review manually

## NavHeadingMenuItem

- source: `examples/astryx/.astryx-sandbox/node_modules/@astryxdesign/core/src/NavMenu/NavHeadingMenuItem.tsx` (react-tsx)
- proposed: 2 props, 1 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- props type extends Omit<
  BaseProps<HTMLElement>,
  'onClick'
> — parent members are outside single-file extraction and are NOT carried
- prop `ref`: platform prop — not contract API, skipped
- prop `icon`: unclassified type — not proposed, review manually
- prop `label`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually
- prop `description`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually
- event `onClick`: declared with trigger 'root' — assign the real trigger part once anatomy is authored

## NavIcon

- source: `examples/astryx/.astryx-sandbox/node_modules/@astryxdesign/core/src/NavIcon/NavIcon.tsx` (react-tsx)
- proposed: 0 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- props type extends BaseProps<HTMLSpanElement> — parent members are outside single-file extraction and are NOT carried
- prop `ref`: platform prop — not contract API, skipped
- prop `icon`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually

## NavItemElement

- source: `examples/astryx/.astryx-sandbox/node_modules/@astryxdesign/core/src/SideNav/SideNavItem.tsx` (react-tsx)
- proposed: 2 props, 1 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- prop `as`: unclassified type — not proposed, review manually
- event `onClick`: declared with trigger 'root' — assign the real trigger part once anatomy is authored
- prop `ref`: platform prop — not contract API, skipped
- prop `children`: platform prop — not contract API, skipped

## NestedEditor

- source: `examples/astryx/.astryx-sandbox/node_modules/@astryxdesign/core/src/PowerSearch/PowerSearchEditPopover.tsx` (react-tsx)
- proposed: 1 props, 2 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- prop `config`: unclassified type — not proposed, review manually
- prop `partialFilter`: unclassified type — not proposed, review manually
- prop `operatorOptions`: unclassified type — not proposed, review manually
- event `onOperatorChange`: declared with trigger 'root' — assign the real trigger part once anatomy is authored
- event `onPartialFilterChange`: declared with trigger 'root' — assign the real trigger part once anatomy is authored

## NestedSubFilterRow

- source: `examples/astryx/.astryx-sandbox/node_modules/@astryxdesign/core/src/PowerSearch/PowerSearchEditPopover.tsx` (react-tsx)
- proposed: 1 props, 1 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- prop `config`: unclassified type — not proposed, review manually
- prop `subFilter`: unclassified type — not proposed, review manually
- event `onChange`: declared with trigger 'root' — assign the real trigger part once anatomy is authored

## NumberFilterControl

- source: `examples/astryx/.astryx-sandbox/node_modules/@astryxdesign/core/src/Table/plugins/filtering/useTableFiltering.tsx` (react-tsx)
- proposed: 4 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- prop `operatorValue`: unclassified type — not proposed, review manually
- prop `size`: figma binding INFERRED as VARIANT "Size" — confirm against the design library (reconcile step)

## NumberInput

- source: `examples/astryx/.astryx-sandbox/node_modules/@astryxdesign/core/src/NumberInput/NumberInput.tsx` (react-tsx)
- proposed: 0 props, 1 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- props type composes named reference(s) [NumberInputPropsBase] whose members are outside module scope — those props are NOT carried (single-file extraction)
- props type is a UNION of alternatives [NumberInputPropsNonClearable | NumberInputPropsClearable] — members merged across readable branches; branch-specific members are forced optional (the mutually-exclusive alternative structure is NOT encoded in the contract; review)
- prop `hasClear`: unclassified type — not proposed, review manually
- event `onChange`: declared with trigger 'root' — assign the real trigger part once anatomy is authored

## Outline

- source: `examples/astryx/.astryx-sandbox/node_modules/@astryxdesign/core/src/Outline/Outline.tsx` (react-tsx)
- proposed: 3 props, 1 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- props type extends BaseProps<HTMLElement> — parent members are outside single-file extraction and are NOT carried
- prop `ref`: platform prop — not contract API, skipped
- prop `items`: unclassified type — not proposed, review manually
- event `onActiveIdChange`: declared with trigger 'root' — assign the real trigger part once anatomy is authored
- prop `density`: figma binding INFERRED as VARIANT "Density" — confirm against the design library (reconcile step)

## OverflowList

- source: `examples/astryx/.astryx-sandbox/node_modules/@astryxdesign/core/src/OverflowList/OverflowList.tsx` (react-tsx)
- proposed: 3 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- props type extends BaseProps<HTMLDivElement> — parent members are outside single-file extraction and are NOT carried
- prop `ref`: platform prop — not contract API, skipped
- prop `children`: platform prop — not contract API, skipped
- prop `gap`: unclassified type — not proposed, review manually
- prop `collapseFrom`: figma binding INFERRED as VARIANT "Collapse From" — confirm against the design library (reconcile step)
- prop `behavior`: figma binding INFERRED as VARIANT "Behavior" — confirm against the design library (reconcile step)
- prop `overflowRenderer`: function-typed but not on* — skipped, review manually

## Overlay

- source: `examples/astryx/.astryx-sandbox/node_modules/@astryxdesign/core/src/Overlay/Overlay.tsx` (react-tsx)
- proposed: 1 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- props type extends Pick<
  BaseProps<HTMLDivElement>,
  'xstyle' | 'className' | 'style'
> — parent members are outside single-file extraction and are NOT carried
- prop `ref`: platform prop — not contract API, skipped
- prop `children`: platform prop — not contract API, skipped
- prop `content`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually
- prop `showOn`: unclassified type — not proposed, review manually
- prop `scrim`: unclassified type — not proposed, review manually
- prop `position`: unclassified type — not proposed, review manually
- prop `align`: unclassified type — not proposed, review manually

## OverlayScrim

- source: `examples/astryx/.astryx-sandbox/node_modules/@astryxdesign/core/src/Overlay/OverlayScrim.tsx` (react-tsx)
- proposed: 3 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- prop `scrim`: unclassified type — not proposed, review manually
- prop `position`: type resolved heuristically — review
- prop `position`: figma binding INFERRED as VARIANT "Position" — confirm against the design library (reconcile step)
- prop `align`: type resolved heuristically — review
- prop `align`: figma binding INFERRED as VARIANT "Align" — confirm against the design library (reconcile step)
- prop `showOn`: type resolved heuristically — review
- prop `showOn`: figma binding INFERRED as VARIANT "Show On" — confirm against the design library (reconcile step)
- prop `isOpen`: unclassified type — not proposed, review manually
- prop `children`: platform prop — not contract API, skipped

## Pagination

- source: `examples/astryx/.astryx-sandbox/node_modules/@astryxdesign/core/src/Pagination/Pagination.tsx` (react-tsx)
- proposed: 10 props, 2 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- props type extends Omit<
  BaseProps<HTMLElement>,
  'onChange'
> — parent members are outside single-file extraction and are NOT carried
- prop `variant`: enum values resolved as member names of the in-file interface PaginationVariantMap (module augmentation may extend it) — review
- prop `ref`: platform prop — not contract API, skipped
- event `onChange`: declared with trigger 'root' — assign the real trigger part once anatomy is authored
- prop `changeAction`: function-typed but not on* — skipped, review manually
- prop `pageSizeOptions`: unclassified type — not proposed, review manually
- event `onPageSizeChange`: declared with trigger 'root' — assign the real trigger part once anatomy is authored
- prop `variant`: type resolved heuristically — review
- prop `variant`: figma binding INFERRED as VARIANT "Variant" — confirm against the design library (reconcile step)
- prop `size`: type resolved heuristically — review
- prop `size`: figma binding INFERRED as VARIANT "Size" — confirm against the design library (reconcile step)

## Popover

- source: `examples/astryx/.astryx-sandbox/node_modules/@astryxdesign/core/src/Popover/Popover.tsx` (react-tsx)
- proposed: 8 props, 1 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- props type extends Pick<
  BaseProps,
  'xstyle' | 'className' | 'style'
> — parent members are outside single-file extraction and are NOT carried
- prop `children`: platform prop — not contract API, skipped
- prop `anchorRef`: unclassified type — not proposed, review manually
- prop `content`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually
- prop `placement`: unclassified type — not proposed, review manually
- prop `alignment`: unclassified type — not proposed, review manually
- event `onOpenChange`: declared with trigger 'root' — assign the real trigger part once anatomy is authored
- prop `width`: unclassified type — not proposed, review manually

## PopoverFilterTrigger

- source: `examples/astryx/.astryx-sandbox/node_modules/@astryxdesign/core/src/Table/plugins/filtering/useTableFiltering.tsx` (react-tsx)
- proposed: 2 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- prop `operatorValue`: unclassified type — not proposed, review manually

## PowerSearch

- source: `examples/astryx/.astryx-sandbox/node_modules/@astryxdesign/core/src/PowerSearch/PowerSearch.tsx` (react-tsx)
- proposed: 14 props, 3 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- props type extends Omit<
  BaseProps<HTMLElement>,
  'onChange'
> — parent members are outside single-file extraction and are NOT carried
- prop `config`: unclassified type — not proposed, review manually
- prop `filters`: unclassified type — not proposed, review manually
- event `onChange`: declared with trigger 'root' — assign the real trigger part once anatomy is authored
- prop `startIcon`: unclassified type — not proposed, review manually
- event `onFocus`: declared with trigger 'root' — assign the real trigger part once anatomy is authored
- event `onBlur`: declared with trigger 'root' — assign the real trigger part once anatomy is authored
- prop `status`: unclassified type — not proposed, review manually
- prop `tokenOverflowBehavior`: unclassified type — not proposed, review manually
- prop `endContent`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually
- prop `resultCount`: unclassified type — not proposed, review manually
- prop `ref`: platform prop — not contract API, skipped
- prop `handleRef`: unclassified type — not proposed, review manually
- prop `size`: type resolved heuristically — review
- prop `size`: figma binding INFERRED as VARIANT "Size" — confirm against the design library (reconcile step)
- prop `components`: unclassified type — not proposed, review manually

## PowerSearchEditPopover

- source: `examples/astryx/.astryx-sandbox/node_modules/@astryxdesign/core/src/PowerSearch/PowerSearchEditPopover.tsx` (react-tsx)
- proposed: 3 props, 2 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- prop `config`: unclassified type — not proposed, review manually
- prop `filter`: unclassified type — not proposed, review manually
- prop `mode`: figma binding INFERRED as VARIANT "Mode" — confirm against the design library (reconcile step)
- event `onSave`: declared with trigger 'root' — assign the real trigger part once anatomy is authored
- event `onCancel`: declared with trigger 'root' — assign the real trigger part once anatomy is authored

## PowerSearchTokenValue

- source: `examples/astryx/.astryx-sandbox/node_modules/@astryxdesign/core/src/PowerSearch/PowerSearch.tsx` (react-tsx)
- proposed: 1 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- prop `operatorValue`: unclassified type — not proposed, review manually
- prop `filterValue`: unclassified type — not proposed, review manually

## PowerSearchValueEditor

- source: `examples/astryx/.astryx-sandbox/node_modules/@astryxdesign/core/src/PowerSearch/PowerSearchValueEditor.tsx` (react-tsx)
- proposed: 2 props, 2 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- prop `operatorValue`: unclassified type — not proposed, review manually
- prop `filterValue`: unclassified type — not proposed, review manually
- event `onChange`: declared with trigger 'root' — assign the real trigger part once anatomy is authored
- event `onEnter`: declared with trigger 'root' — assign the real trigger part once anatomy is authored
- prop `config`: unclassified type — not proposed, review manually

## ProgressBar

- source: `examples/astryx/.astryx-sandbox/node_modules/@astryxdesign/core/src/ProgressBar/ProgressBar.tsx` (react-tsx)
- proposed: 8 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- props type extends BaseProps<HTMLDivElement> — parent members are outside single-file extraction and are NOT carried
- prop `variant`: enum values resolved as member names of the in-file interface ProgressBarVariantMap (module augmentation may extend it) — review
- prop `ref`: platform prop — not contract API, skipped
- prop `formatValueLabel`: function-typed but not on* — skipped, review manually
- prop `variant`: type resolved heuristically — review
- prop `variant`: figma binding INFERRED as VARIANT "Variant" — confirm against the design library (reconcile step)

## RadioList

- source: `examples/astryx/.astryx-sandbox/node_modules/@astryxdesign/core/src/RadioList/RadioList.tsx` (react-tsx)
- proposed: 12 props, 1 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- props type extends Omit<
  BaseProps<HTMLElement>,
  'onChange'
> — parent members are outside single-file extraction and are NOT carried
- prop `ref`: platform prop — not contract API, skipped
- event `onChange`: declared with trigger 'root' — assign the real trigger part once anatomy is authored
- prop `orientation`: figma binding INFERRED as VARIANT "Orientation" — confirm against the design library (reconcile step)
- prop `status`: unclassified type — not proposed, review manually
- prop `size`: type resolved heuristically — review
- prop `size`: figma binding INFERRED as VARIANT "Size" — confirm against the design library (reconcile step)
- prop `width`: unclassified type — not proposed, review manually
- prop `children`: platform prop — not contract API, skipped

## RadioListItem

- source: `examples/astryx/.astryx-sandbox/node_modules/@astryxdesign/core/src/RadioList/RadioListItem.tsx` (react-tsx)
- proposed: 4 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- props type extends BaseProps<HTMLDivElement> — parent members are outside single-file extraction and are NOT carried
- prop `ref`: platform prop — not contract API, skipped
- prop `startContent`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually
- prop `endContent`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually

## RangeCodeContent

- source: `examples/astryx/.astryx-sandbox/node_modules/@astryxdesign/core/src/CodeBlock/CodeBlock.tsx` (react-tsx)
- proposed: 1 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- prop `lines`: unclassified type — not proposed, review manually
- prop `tokenLines`: unclassified type — not proposed, review manually
- prop `highlightSet`: unclassified type — not proposed, review manually
- prop `sizeStyle`: unclassified type — not proposed, review manually

## ResizeHandle

- source: `examples/astryx/.astryx-sandbox/node_modules/@astryxdesign/core/src/Resizable/ResizeHandle.tsx` (react-tsx)
- proposed: 8 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- props type extends Omit<
  BaseProps<HTMLDivElement>,
  'style'
> — parent members are outside single-file extraction and are NOT carried
- prop `ref`: platform prop — not contract API, skipped
- prop `direction`: figma binding INFERRED as VARIANT "Direction" — confirm against the design library (reconcile step)
- prop `position`: figma binding INFERRED as VARIANT "Position" — confirm against the design library (reconcile step)
- prop `pillPlacement`: type resolved heuristically — review
- prop `pillPlacement`: figma binding INFERRED as VARIANT "Pill Placement" — confirm against the design library (reconcile step)
- prop `resizable`: unclassified type — not proposed, review manually
- prop `children`: platform prop — not contract API, skipped

## Section

- source: `examples/astryx/.astryx-sandbox/node_modules/@astryxdesign/core/src/Section/Section.tsx` (react-tsx)
- proposed: 1 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- props type extends BaseProps<HTMLElement> — parent members are outside single-file extraction and are NOT carried
- prop `variant`: enum values resolved as member names of the in-file interface SectionVariantMap (module augmentation may extend it) — review
- prop `ref`: platform prop — not contract API, skipped
- prop `variant`: type resolved heuristically — review
- prop `variant`: figma binding INFERRED as VARIANT "Variant" — confirm against the design library (reconcile step)
- prop `width`: unclassified type — not proposed, review manually
- prop `height`: unclassified type — not proposed, review manually
- prop `maxWidth`: unclassified type — not proposed, review manually
- prop `minHeight`: unclassified type — not proposed, review manually
- prop `children`: platform prop — not contract API, skipped
- prop `dividers`: unclassified type — not proposed, review manually
- prop `padding`: unclassified type — not proposed, review manually
- prop `paddingBlock`: unclassified type — not proposed, review manually

## SegmentedControl

- source: `examples/astryx/.astryx-sandbox/node_modules/@astryxdesign/core/src/SegmentedControl/SegmentedControl.tsx` (react-tsx)
- proposed: 4 props, 1 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- props type extends Omit<
  BaseProps<HTMLDivElement>,
  'onChange'
> — parent members are outside single-file extraction and are NOT carried
- prop `ref`: platform prop — not contract API, skipped
- event `onChange`: declared with trigger 'root' — assign the real trigger part once anatomy is authored
- prop `size`: unclassified type — not proposed, review manually
- prop `layout`: unclassified type — not proposed, review manually
- prop `children`: platform prop — not contract API, skipped

## SegmentedControlItem

- source: `examples/astryx/.astryx-sandbox/node_modules/@astryxdesign/core/src/SegmentedControl/SegmentedControlItem.tsx` (react-tsx)
- proposed: 4 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- props type extends BaseProps<HTMLButtonElement> — parent members are outside single-file extraction and are NOT carried
- prop `ref`: platform prop — not contract API, skipped
- prop `icon`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually

## SelectableCard

- source: `examples/astryx/.astryx-sandbox/node_modules/@astryxdesign/core/src/SelectableCard/SelectableCard.tsx` (react-tsx)
- proposed: 3 props, 1 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- props type extends Omit<BaseProps, 'onChange'> — parent members are outside single-file extraction and are NOT carried
- prop `ref`: platform prop — not contract API, skipped
- event `onChange`: declared with trigger 'root' — assign the real trigger part once anatomy is authored
- prop `children`: platform prop — not contract API, skipped
- prop `padding`: unclassified type — not proposed, review manually
- prop `variant`: unclassified type — not proposed, review manually
- prop `width`: unclassified type — not proposed, review manually
- prop `height`: unclassified type — not proposed, review manually
- prop `maxWidth`: unclassified type — not proposed, review manually

## SelectAllCheckboxInner

- source: `examples/astryx/.astryx-sandbox/node_modules/@astryxdesign/core/src/Table/plugins/selection/useTableSelection.tsx` (react-tsx)
- proposed: 0 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- prop `store`: unclassified type — not proposed, review manually

## SelectionCellContent

- source: `examples/astryx/.astryx-sandbox/node_modules/@astryxdesign/core/src/Table/plugins/selection/useTableSelection.tsx` (react-tsx)
- proposed: 0 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- prop `item`: unclassified type — not proposed, review manually

## SelectionCellContentInner

- source: `examples/astryx/.astryx-sandbox/node_modules/@astryxdesign/core/src/Table/plugins/selection/useTableSelection.tsx` (react-tsx)
- proposed: 0 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- prop `store`: unclassified type — not proposed, review manually
- prop `item`: unclassified type — not proposed, review manually

## SelectorFilterControl

- source: `examples/astryx/.astryx-sandbox/node_modules/@astryxdesign/core/src/Table/plugins/filtering/useTableFiltering.tsx` (react-tsx)
- proposed: 4 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- prop `operatorValue`: unclassified type — not proposed, review manually
- prop `size`: figma binding INFERRED as VARIANT "Size" — confirm against the design library (reconcile step)

## SelectorOption

- source: `examples/astryx/.astryx-sandbox/node_modules/@astryxdesign/core/src/Selector/SelectorOption.tsx` (react-tsx)
- proposed: 0 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- prop `icon`: unclassified type — not proposed, review manually
- prop `label`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually
- prop `description`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually
- prop `endContent`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually
- prop `xstyle`: unclassified type — not proposed, review manually
- prop `className`: platform prop — not contract API, skipped
- prop `style`: platform prop — not contract API, skipped

## SideNav

- source: `examples/astryx/.astryx-sandbox/node_modules/@astryxdesign/core/src/SideNav/SideNav.tsx` (react-tsx)
- proposed: 0 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- props type extends BaseProps<HTMLElement> — parent members are outside single-file extraction and are NOT carried
- prop `ref`: platform prop — not contract API, skipped
- prop `handleRef`: unclassified type — not proposed, review manually
- prop `header`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually
- prop `topContent`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually
- prop `children`: platform prop — not contract API, skipped
- prop `footer`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually
- prop `footerIcons`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually
- prop `xstyle`: unclassified type — not proposed, review manually
- prop `className`: platform prop — not contract API, skipped
- prop `style`: platform prop — not contract API, skipped
- prop `resizable`: unclassified type — not proposed, review manually
- prop `collapsible`: unclassified type — not proposed, review manually

## SideNavCollapseButton

- source: `examples/astryx/.astryx-sandbox/node_modules/@astryxdesign/core/src/SideNav/SideNavCollapseButton.tsx` (react-tsx)
- proposed: 1 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- props type extends BaseProps<HTMLButtonElement> — parent members are outside single-file extraction and are NOT carried
- prop `ref`: platform prop — not contract API, skipped
- prop `handleRef`: unclassified type — not proposed, review manually
- prop `children`: platform prop — not contract API, skipped

## SideNavHeading

- source: `examples/astryx/.astryx-sandbox/node_modules/@astryxdesign/core/src/SideNav/SideNavHeading.tsx` (react-tsx)
- proposed: 6 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- props type extends BaseProps<HTMLDivElement> — parent members are outside single-file extraction and are NOT carried
- prop `ref`: platform prop — not contract API, skipped
- prop `icon`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually
- prop `as`: unclassified type — not proposed, review manually
- prop `headerEndContent`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually
- prop `menu`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually

## SideNavItem

- source: `examples/astryx/.astryx-sandbox/node_modules/@astryxdesign/core/src/SideNav/SideNavItem.tsx` (react-tsx)
- proposed: 4 props, 1 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- props type extends BaseProps<HTMLElement> — parent members are outside single-file extraction and are NOT carried
- prop `ref`: platform prop — not contract API, skipped
- prop `as`: unclassified type — not proposed, review manually
- prop `icon`: unclassified type — not proposed, review manually
- prop `selectedIcon`: unclassified type — not proposed, review manually
- event `onClick`: declared with trigger 'root' — assign the real trigger part once anatomy is authored
- prop `endContent`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually
- prop `children`: platform prop — not contract API, skipped
- prop `collapsible`: unclassified type — not proposed, review manually
- prop `size`: unclassified type — not proposed, review manually

## SideNavSection

- source: `examples/astryx/.astryx-sandbox/node_modules/@astryxdesign/core/src/SideNav/SideNavSection.tsx` (react-tsx)
- proposed: 3 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- props type extends BaseProps<HTMLDivElement> — parent members are outside single-file extraction and are NOT carried
- prop `ref`: platform prop — not contract API, skipped
- prop `children`: platform prop — not contract API, skipped
- prop `endContent`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually

## Skeleton

- source: `examples/astryx/.astryx-sandbox/node_modules/@astryxdesign/core/src/Skeleton/Skeleton.tsx` (react-tsx)
- proposed: 2 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- props type extends BaseProps<HTMLDivElement> — parent members are outside single-file extraction and are NOT carried
- prop `radius`: enum values resolved as keys of the object literal passed to stylex.create(…) — key-preserving factory ASSUMED — review
- prop `ref`: platform prop — not contract API, skipped
- prop `width`: unclassified type — not proposed, review manually
- prop `height`: unclassified type — not proposed, review manually
- prop `radius`: type resolved heuristically — review
- prop `radius`: figma binding INFERRED as VARIANT "Radius" — confirm against the design library (reconcile step)

## Slider

- source: `examples/astryx/.astryx-sandbox/node_modules/@astryxdesign/core/src/Slider/Slider.tsx` (react-tsx)
- proposed: 16 props, 2 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- props type composes named reference(s) [Omit<
  BaseProps<HTMLDivElement>,
  'onChange'
>] whose members are outside module scope — those props are NOT carried (single-file extraction)
- props type is a UNION of alternatives [SliderSingleProps | SliderRangeProps] — members merged across readable branches; branch-specific members are forced optional (the mutually-exclusive alternative structure is NOT encoded in the contract; review)
- event `onChange`: declared with trigger 'root' — assign the real trigger part once anatomy is authored
- event `onChangeEnd`: declared with trigger 'root' — assign the real trigger part once anatomy is authored
- prop `ref`: platform prop — not contract API, skipped
- prop `status`: unclassified type — not proposed, review manually
- prop `width`: unclassified type — not proposed, review manually
- prop `orientation`: figma binding INFERRED as VARIANT "Orientation" — confirm against the design library (reconcile step)
- prop `formatValue`: function-typed but not on* — skipped, review manually
- prop `valueDisplay`: figma binding INFERRED as VARIANT "Value Display" — confirm against the design library (reconcile step)
- prop `marks`: unclassified type — not proposed, review manually

## SortHeaderButton

- source: `examples/astryx/.astryx-sandbox/node_modules/@astryxdesign/core/src/Table/plugins/sortable/useTableSortable.tsx` (react-tsx)
- proposed: 0 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- prop `column`: unclassified type — not proposed, review manually
- prop `children`: platform prop — not contract API, skipped
- prop `configRef`: unclassified type — not proposed, review manually

## SpanCodeContent

- source: `examples/astryx/.astryx-sandbox/node_modules/@astryxdesign/core/src/CodeBlock/CodeBlock.tsx` (react-tsx)
- proposed: 1 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- prop `lines`: unclassified type — not proposed, review manually
- prop `tokenLines`: unclassified type — not proposed, review manually
- prop `highlightSet`: unclassified type — not proposed, review manually
- prop `sizeStyle`: unclassified type — not proposed, review manually

## Spinner

- source: `examples/astryx/.astryx-sandbox/node_modules/@astryxdesign/core/src/Spinner/Spinner.tsx` (react-tsx)
- proposed: 2 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- props type extends BaseProps<HTMLSpanElement> — parent members are outside single-file extraction and are NOT carried
- prop `size`: enum values resolved as keys of the in-file const object SIZES — review
- prop `ref`: platform prop — not contract API, skipped
- prop `size`: type resolved heuristically — review
- prop `size`: figma binding INFERRED as VARIANT "Size" — confirm against the design library (reconcile step)
- prop `shade`: type resolved heuristically — review
- prop `shade`: figma binding INFERRED as VARIANT "Shade" — confirm against the design library (reconcile step)
- prop `label`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually

## Stack

- source: `examples/astryx/.astryx-sandbox/node_modules/@astryxdesign/core/src/Stack/Stack.tsx` (react-tsx)
- proposed: 1 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- props type extends BaseProps<HTMLElement> — parent members are outside single-file extraction and are NOT carried
- prop `ref`: platform prop — not contract API, skipped
- prop `direction`: unclassified type — not proposed, review manually
- prop `hAlign`: unclassified type — not proposed, review manually
- prop `vAlign`: unclassified type — not proposed, review manually
- prop `justify`: unclassified type — not proposed, review manually
- prop `align`: unclassified type — not proposed, review manually
- prop `width`: unclassified type — not proposed, review manually
- prop `height`: unclassified type — not proposed, review manually
- prop `maxWidth`: unclassified type — not proposed, review manually
- prop `minHeight`: unclassified type — not proposed, review manually
- prop `gap`: unclassified type — not proposed, review manually
- prop `padding`: unclassified type — not proposed, review manually
- prop `paddingInline`: unclassified type — not proposed, review manually
- prop `paddingBlock`: unclassified type — not proposed, review manually
- prop `wrap`: unclassified type — not proposed, review manually
- prop `as`: unclassified type — not proposed, review manually
- prop `children`: platform prop — not contract API, skipped

## StackItem

- source: `examples/astryx/.astryx-sandbox/node_modules/@astryxdesign/core/src/Stack/StackItem.tsx` (react-tsx)
- proposed: 1 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- props type extends BaseProps<HTMLElement> — parent members are outside single-file extraction and are NOT carried
- prop `ref`: platform prop — not contract API, skipped
- prop `crossAlignSelf`: unclassified type — not proposed, review manually
- prop `size`: unclassified type — not proposed, review manually
- prop `as`: unclassified type — not proposed, review manually
- prop `children`: platform prop — not contract API, skipped

## StatusDot

- source: `examples/astryx/.astryx-sandbox/node_modules/@astryxdesign/core/src/StatusDot/StatusDot.tsx` (react-tsx)
- proposed: 4 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- props type extends BaseProps<HTMLSpanElement> — parent members are outside single-file extraction and are NOT carried
- prop `variant`: enum values resolved as member names of the in-file interface StatusDotVariantMap (module augmentation may extend it) — review
- prop `ref`: platform prop — not contract API, skipped
- prop `variant`: type resolved heuristically — review
- prop `variant`: figma binding INFERRED as VARIANT "Variant" — confirm against the design library (reconcile step)

## StringEditor

- source: `examples/astryx/.astryx-sandbox/node_modules/@astryxdesign/core/src/PowerSearch/PowerSearchValueEditor.tsx` (react-tsx)
- proposed: 0 props, 2 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- prop `operatorValue`: unclassified type — not proposed, review manually
- prop `filterValue`: unclassified type — not proposed, review manually
- event `onChange`: declared with trigger 'root' — assign the real trigger part once anatomy is authored
- event `onEnter`: declared with trigger 'root' — assign the real trigger part once anatomy is authored

## StringListEditor

- source: `examples/astryx/.astryx-sandbox/node_modules/@astryxdesign/core/src/PowerSearch/PowerSearchValueEditor.tsx` (react-tsx)
- proposed: 0 props, 1 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- prop `operatorValue`: unclassified type — not proposed, review manually
- prop `filterValue`: unclassified type — not proposed, review manually
- event `onChange`: declared with trigger 'root' — assign the real trigger part once anatomy is authored

## StringListFilterControl

- source: `examples/astryx/.astryx-sandbox/node_modules/@astryxdesign/core/src/Table/plugins/filtering/useTableFiltering.tsx` (react-tsx)
- proposed: 4 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- prop `operatorValue`: unclassified type — not proposed, review manually
- prop `size`: figma binding INFERRED as VARIANT "Size" — confirm against the design library (reconcile step)

## Switch

- source: `examples/astryx/.astryx-sandbox/node_modules/@astryxdesign/core/src/Switch/Switch.tsx` (react-tsx)
- proposed: 13 props, 3 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- props type extends Omit<BaseProps, 'onChange'> — parent members are outside single-file extraction and are NOT carried
- prop `ref`: platform prop — not contract API, skipped
- event `onChange`: declared with trigger 'root' — assign the real trigger part once anatomy is authored
- prop `changeAction`: function-typed but not on* — skipped, review manually
- event `onFocus`: declared with trigger 'root' — assign the real trigger part once anatomy is authored
- event `onBlur`: declared with trigger 'root' — assign the real trigger part once anatomy is authored
- prop `labelIcon`: unclassified type — not proposed, review manually
- prop `width`: unclassified type — not proposed, review manually
- prop `labelPosition`: type resolved heuristically — review
- prop `labelPosition`: figma binding INFERRED as VARIANT "Label Position" — confirm against the design library (reconcile step)
- prop `labelSpacing`: type resolved heuristically — review
- prop `labelSpacing`: figma binding INFERRED as VARIANT "Label Spacing" — confirm against the design library (reconcile step)
- prop `status`: unclassified type — not proposed, review manually

## SyntaxTheme

- source: `examples/astryx/.astryx-sandbox/node_modules/@astryxdesign/core/src/theme/syntax/SyntaxTheme.tsx` (react-tsx)
- proposed: 0 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- prop `theme`: unclassified type — not proposed, review manually
- prop `children`: platform prop — not contract API, skipped

## Tab

- source: `examples/astryx/.astryx-sandbox/node_modules/@astryxdesign/core/src/TabList/Tab.tsx` (react-tsx)
- proposed: 4 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- props type extends BaseProps<HTMLButtonElement> — parent members are outside single-file extraction and are NOT carried
- prop `as`: unclassified type — not proposed, review manually
- prop `ref`: platform prop — not contract API, skipped
- prop `icon`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually
- prop `selectedIcon`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually
- prop `endContent`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually

## Table

- source: `examples/astryx/.astryx-sandbox/node_modules/@astryxdesign/core/src/Table/Table.tsx` (react-tsx)
- proposed: 0 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- props type composes named reference(s) [TableProps<T>] whose members are outside module scope — those props are NOT carried (single-file extraction)
- prop `ref`: platform prop — not contract API, skipped

## TableBody

- source: `examples/astryx/.astryx-sandbox/node_modules/@astryxdesign/core/src/Table/TableBody.tsx` (react-tsx)
- proposed: 0 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- props type extends BaseProps<HTMLTableSectionElement> — parent members are outside single-file extraction and are NOT carried
- prop `ref`: platform prop — not contract API, skipped
- prop `children`: platform prop — not contract API, skipped

## TableCell

- source: `examples/astryx/.astryx-sandbox/node_modules/@astryxdesign/core/src/Table/TableCell.tsx` (react-tsx)
- proposed: 4 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- props type extends BaseProps<HTMLTableCellElement> — parent members are outside single-file extraction and are NOT carried
- prop `ref`: platform prop — not contract API, skipped
- prop `scope`: figma binding INFERRED as VARIANT "Scope" — confirm against the design library (reconcile step)
- prop `children`: platform prop — not contract API, skipped
- prop `xstyle`: unclassified type — not proposed, review manually
- prop `contextMenuActions`: unclassified type — not proposed, review manually

## TableFooter

- source: `examples/astryx/.astryx-sandbox/node_modules/@astryxdesign/core/src/Table/TableFooter.tsx` (react-tsx)
- proposed: 0 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- props type extends BaseProps<HTMLTableSectionElement> — parent members are outside single-file extraction and are NOT carried
- prop `ref`: platform prop — not contract API, skipped
- prop `children`: platform prop — not contract API, skipped

## TableHeader

- source: `examples/astryx/.astryx-sandbox/node_modules/@astryxdesign/core/src/Table/TableHeader.tsx` (react-tsx)
- proposed: 0 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- props type extends BaseProps<HTMLTableSectionElement> — parent members are outside single-file extraction and are NOT carried
- prop `ref`: platform prop — not contract API, skipped
- prop `children`: platform prop — not contract API, skipped

## TableHeaderCell

- source: `examples/astryx/.astryx-sandbox/node_modules/@astryxdesign/core/src/Table/TableHeaderCell.tsx` (react-tsx)
- proposed: 1 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- props type extends BaseProps<HTMLTableCellElement> — parent members are outside single-file extraction and are NOT carried
- prop `ref`: platform prop — not contract API, skipped
- prop `scope`: figma binding INFERRED as VARIANT "Scope" — confirm against the design library (reconcile step)
- prop `children`: platform prop — not contract API, skipped
- prop `xstyle`: unclassified type — not proposed, review manually
- prop `contextMenuActions`: unclassified type — not proposed, review manually

## TableInner

- source: `examples/astryx/.astryx-sandbox/node_modules/@astryxdesign/core/src/Table/Table.tsx` (react-tsx)
- proposed: 0 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- props type composes named reference(s) [TableProps<T>] whose members are outside module scope — those props are NOT carried (single-file extraction)
- prop `ref`: platform prop — not contract API, skipped

## TableRow

- source: `examples/astryx/.astryx-sandbox/node_modules/@astryxdesign/core/src/Table/TableRow.tsx` (react-tsx)
- proposed: 1 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- props type extends BaseProps<HTMLTableRowElement> — parent members are outside single-file extraction and are NOT carried
- prop `ref`: platform prop — not contract API, skipped
- prop `children`: platform prop — not contract API, skipped
- prop `xstyle`: unclassified type — not proposed, review manually

## TableRowInner

- source: `examples/astryx/.astryx-sandbox/node_modules/@astryxdesign/core/src/Table/BaseTable.tsx` (react-tsx)
- proposed: 2 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- prop `item`: unclassified type — not proposed, review manually
- prop `rowKey`: unclassified type — not proposed, review manually
- prop `columns`: unclassified type — not proposed, review manually
- prop `plugins`: unclassified type — not proposed, review manually
- prop `textOverflow`: figma binding INFERRED as VARIANT "Text Overflow" — confirm against the design library (reconcile step)
- prop `RowComponent`: unclassified type — not proposed, review manually
- prop `CellComponent`: unclassified type — not proposed, review manually

## TableScrollWrapper

- source: `examples/astryx/.astryx-sandbox/node_modules/@astryxdesign/core/src/Table/Table.tsx` (react-tsx)
- proposed: 0 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- prop `children`: platform prop — not contract API, skipped
- prop `htmlProps`: unclassified type — not proposed, review manually
- prop `styles`: unclassified type — not proposed, review manually
- prop `beforeTable`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually
- prop `afterTable`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually

## TabList

- source: `examples/astryx/.astryx-sandbox/node_modules/@astryxdesign/core/src/TabList/TabList.tsx` (react-tsx)
- proposed: 3 props, 1 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- props type extends Omit<BaseProps<HTMLElement>, 'onChange'> — parent members are outside single-file extraction and are NOT carried
- prop `ref`: platform prop — not contract API, skipped
- event `onChange`: declared with trigger 'root' — assign the real trigger part once anatomy is authored
- prop `size`: unclassified type — not proposed, review manually
- prop `layout`: figma binding INFERRED as VARIANT "Layout" — confirm against the design library (reconcile step)
- prop `orientation`: unclassified type — not proposed, review manually
- prop `children`: platform prop — not contract API, skipped

## TabMenu

- source: `examples/astryx/.astryx-sandbox/node_modules/@astryxdesign/core/src/TabList/TabMenu.tsx` (react-tsx)
- proposed: 1 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- props type extends Pick<
  BaseProps<HTMLButtonElement>,
  'xstyle' | 'className' | 'style'
> — parent members are outside single-file extraction and are NOT carried
- prop `ref`: platform prop — not contract API, skipped
- prop `options`: unclassified type — not proposed, review manually

## Text

- source: `examples/astryx/.astryx-sandbox/node_modules/@astryxdesign/core/src/Text/Text.tsx` (react-tsx)
- proposed: 5 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- props type extends Omit<BaseProps, 'children'> — parent members are outside single-file extraction and are NOT carried
- prop `ref`: platform prop — not contract API, skipped
- prop `type`: unclassified type — not proposed, review manually
- prop `size`: unclassified type — not proposed, review manually
- prop `color`: unclassified type — not proposed, review manually
- prop `weight`: unclassified type — not proposed, review manually
- prop `display`: unclassified type — not proposed, review manually
- prop `hasTruncateTooltip`: unclassified type — not proposed, review manually
- prop `wordBreak`: unclassified type — not proposed, review manually
- prop `textWrap`: unclassified type — not proposed, review manually
- prop `justify`: unclassified type — not proposed, review manually
- prop `children`: platform prop — not contract API, skipped
- prop `as`: figma binding INFERRED as VARIANT "As" — confirm against the design library (reconcile step)

## TextArea

- source: `examples/astryx/.astryx-sandbox/node_modules/@astryxdesign/core/src/TextArea/TextArea.tsx` (react-tsx)
- proposed: 17 props, 4 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- props type extends Omit<
  BaseProps,
  'onChange' | 'defaultValue'
> — parent members are outside single-file extraction and are NOT carried
- prop `ref`: platform prop — not contract API, skipped
- event `onChange`: declared with trigger 'root' — assign the real trigger part once anatomy is authored
- prop `changeAction`: function-typed but not on* — skipped, review manually
- prop `status`: unclassified type — not proposed, review manually
- prop `width`: unclassified type — not proposed, review manually
- prop `startIcon`: unclassified type — not proposed, review manually
- event `onPaste`: declared with trigger 'root' — assign the real trigger part once anatomy is authored
- prop `size`: type resolved heuristically — review
- prop `size`: figma binding INFERRED as VARIANT "Size" — confirm against the design library (reconcile step)
- event `onFocus`: declared with trigger 'root' — assign the real trigger part once anatomy is authored
- event `onBlur`: declared with trigger 'root' — assign the real trigger part once anatomy is authored

## TextFilterControl

- source: `examples/astryx/.astryx-sandbox/node_modules/@astryxdesign/core/src/Table/plugins/filtering/useTableFiltering.tsx` (react-tsx)
- proposed: 4 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- prop `size`: figma binding INFERRED as VARIANT "Size" — confirm against the design library (reconcile step)

## TextInput

- source: `examples/astryx/.astryx-sandbox/node_modules/@astryxdesign/core/src/TextInput/TextInput.tsx` (react-tsx)
- proposed: 16 props, 3 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- props type extends Omit<
  BaseProps,
  'onChange' | 'defaultValue'
> — parent members are outside single-file extraction and are NOT carried
- prop `size`: enum values resolved as keys of the object literal passed to stylex.create(…) — key-preserving factory ASSUMED — review
- prop `ref`: platform prop — not contract API, skipped
- prop `type`: type resolved heuristically — review
- prop `type`: figma binding INFERRED as VARIANT "Type" — confirm against the design library (reconcile step)
- prop `startIcon`: unclassified type — not proposed, review manually
- prop `status`: unclassified type — not proposed, review manually
- prop `size`: type resolved heuristically — review
- prop `size`: figma binding INFERRED as VARIANT "Size" — confirm against the design library (reconcile step)
- event `onChange`: declared with trigger 'root' — assign the real trigger part once anatomy is authored
- prop `changeAction`: function-typed but not on* — skipped, review manually
- prop `width`: unclassified type — not proposed, review manually
- event `onEnter`: declared with trigger 'root' — assign the real trigger part once anatomy is authored
- event `onKeyDown`: declared with trigger 'root' — assign the real trigger part once anatomy is authored

## Theme

- source: `examples/astryx/.astryx-sandbox/node_modules/@astryxdesign/core/src/theme/Theme.tsx` (react-tsx)
- proposed: 0 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- prop `theme`: unclassified type — not proposed, review manually
- prop `mode`: unclassified type — not proposed, review manually
- prop `children`: platform prop — not contract API, skipped

## Thumbnail

- source: `examples/astryx/.astryx-sandbox/node_modules/@astryxdesign/core/src/Thumbnail/Thumbnail.tsx` (react-tsx)
- proposed: 5 props, 2 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- props type extends BaseProps<HTMLDivElement> — parent members are outside single-file extraction and are NOT carried
- prop `ref`: platform prop — not contract API, skipped
- event `onRemove`: declared with trigger 'root' — assign the real trigger part once anatomy is authored
- event `onClick`: declared with trigger 'root' — assign the real trigger part once anatomy is authored

## TimeEditor

- source: `examples/astryx/.astryx-sandbox/node_modules/@astryxdesign/core/src/PowerSearch/PowerSearchValueEditor.tsx` (react-tsx)
- proposed: 0 props, 1 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- prop `operatorValue`: unclassified type — not proposed, review manually
- prop `filterValue`: unclassified type — not proposed, review manually
- event `onChange`: declared with trigger 'root' — assign the real trigger part once anatomy is authored

## TimeFilterControl

- source: `examples/astryx/.astryx-sandbox/node_modules/@astryxdesign/core/src/Table/plugins/filtering/useTableFiltering.tsx` (react-tsx)
- proposed: 4 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- prop `size`: figma binding INFERRED as VARIANT "Size" — confirm against the design library (reconcile step)

## TimeInput

- source: `examples/astryx/.astryx-sandbox/node_modules/@astryxdesign/core/src/TimeInput/TimeInput.tsx` (react-tsx)
- proposed: 16 props, 1 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- props type extends Omit<
  BaseProps,
  'onChange' | 'defaultValue'
> — parent members are outside single-file extraction and are NOT carried
- prop `size`: enum values resolved as keys of the object literal passed to stylex.create(…) — key-preserving factory ASSUMED — review
- prop `ref`: platform prop — not contract API, skipped
- prop `value`: unclassified type — not proposed, review manually
- event `onChange`: declared with trigger 'root' — assign the real trigger part once anatomy is authored
- prop `changeAction`: function-typed but not on* — skipped, review manually
- prop `min`: unclassified type — not proposed, review manually
- prop `max`: unclassified type — not proposed, review manually
- prop `hourFormat`: type resolved heuristically — review
- prop `hourFormat`: figma binding INFERRED as VARIANT "Hour Format" — confirm against the design library (reconcile step)
- prop `size`: type resolved heuristically — review
- prop `size`: figma binding INFERRED as VARIANT "Size" — confirm against the design library (reconcile step)
- prop `status`: unclassified type — not proposed, review manually
- prop `width`: unclassified type — not proposed, review manually

## Timestamp

- source: `examples/astryx/.astryx-sandbox/node_modules/@astryxdesign/core/src/Timestamp/Timestamp.tsx` (react-tsx)
- proposed: 5 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- props type extends BaseProps<HTMLTimeElement> — parent members are outside single-file extraction and are NOT carried
- prop `ref`: platform prop — not contract API, skipped
- prop `value`: unclassified type — not proposed, review manually
- prop `format`: type resolved heuristically — review
- prop `format`: figma binding INFERRED as VARIANT "Format" — confirm against the design library (reconcile step)
- prop `type`: unclassified type — not proposed, review manually
- prop `size`: unclassified type — not proposed, review manually
- prop `color`: unclassified type — not proposed, review manually
- prop `weight`: unclassified type — not proposed, review manually

## Toast

- source: `examples/astryx/.astryx-sandbox/node_modules/@astryxdesign/core/src/Toast/Toast.tsx` (react-tsx)
- proposed: 3 props, 1 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- prop `type`: unclassified type — not proposed, review manually
- prop `body`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually
- prop `endContent`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually
- event `onDismiss`: declared with trigger 'root' — assign the real trigger part once anatomy is authored

## ToastViewport

- source: `examples/astryx/.astryx-sandbox/node_modules/@astryxdesign/core/src/Toast/ToastViewport.tsx` (react-tsx)
- proposed: 2 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- prop `position`: unclassified type — not proposed, review manually
- prop `inset`: unclassified type — not proposed, review manually
- prop `children`: platform prop — not contract API, skipped

## ToggleButton

- source: `examples/astryx/.astryx-sandbox/node_modules/@astryxdesign/core/src/ToggleButton/ToggleButton.tsx` (react-tsx)
- proposed: 7 props, 1 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- props type extends BaseProps<HTMLButtonElement> — parent members are outside single-file extraction and are NOT carried
- prop `ref`: platform prop — not contract API, skipped
- event `onPressedChange`: declared with trigger 'root' — assign the real trigger part once anatomy is authored
- prop `pressedChangeAction`: function-typed but not on* — skipped, review manually
- prop `size`: unclassified type — not proposed, review manually
- prop `icon`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually
- prop `pressedIcon`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually
- prop `children`: platform prop — not contract API, skipped

## ToggleButtonGroup

- source: `examples/astryx/.astryx-sandbox/node_modules/@astryxdesign/core/src/ToggleButton/ToggleButtonGroup.tsx` (react-tsx)
- proposed: 3 props, 1 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- props type is a UNION of alternatives [ToggleButtonGroupSingleProps | ToggleButtonGroupMultipleProps] — members merged across readable branches; branch-specific members are forced optional (the mutually-exclusive alternative structure is NOT encoded in the contract; review)
- prop `type`: unclassified type — not proposed, review manually
- prop `value`: unclassified type — not proposed, review manually
- event `onChange`: declared with trigger 'root' — assign the real trigger part once anatomy is authored
- prop `children`: platform prop — not contract API, skipped
- prop `orientation`: figma binding INFERRED as VARIANT "Orientation" — confirm against the design library (reconcile step)
- prop `size`: unclassified type — not proposed, review manually
- prop `xstyle`: unclassified type — not proposed, review manually

## Token

- source: `examples/astryx/.astryx-sandbox/node_modules/@astryxdesign/core/src/Token/Token.tsx` (react-tsx)
- proposed: 7 props, 2 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- props type extends BaseProps<HTMLElement> — parent members are outside single-file extraction and are NOT carried
- prop `ref`: platform prop — not contract API, skipped
- prop `size`: type resolved heuristically — review
- prop `size`: figma binding INFERRED as VARIANT "Size" — confirm against the design library (reconcile step)
- prop `color`: type resolved heuristically — review
- prop `color`: figma binding INFERRED as VARIANT "Color" — confirm against the design library (reconcile step)
- prop `icon`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually
- event `onRemove`: declared with trigger 'root' — assign the real trigger part once anatomy is authored
- event `onClick`: declared with trigger 'root' — assign the real trigger part once anatomy is authored
- prop `endContent`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually

## Tokenizer

- source: `examples/astryx/.astryx-sandbox/node_modules/@astryxdesign/core/src/Tokenizer/Tokenizer.tsx` (react-tsx)
- proposed: 20 props, 4 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- props type extends Omit<
  BaseProps<HTMLDivElement>,
  'onChange'
> — parent members are outside single-file extraction and are NOT carried
- prop `status`: unclassified type — not proposed, review manually
- prop `startIcon`: unclassified type — not proposed, review manually
- prop `width`: unclassified type — not proposed, review manually
- prop `searchSource`: unclassified type — not proposed, review manually
- prop `value`: unclassified type — not proposed, review manually
- event `onChange`: declared with trigger 'root' — assign the real trigger part once anatomy is authored
- prop `renderItem`: function-typed but not on* — skipped, review manually
- prop `renderToken`: function-typed but not on* — skipped, review manually
- prop `endContent`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually
- prop `size`: type resolved heuristically — review
- prop `size`: figma binding INFERRED as VARIANT "Size" — confirm against the design library (reconcile step)
- prop `tokenOverflowBehavior`: type resolved heuristically — review
- prop `tokenOverflowBehavior`: figma binding INFERRED as VARIANT "Token Overflow Behavior" — confirm against the design library (reconcile step)
- event `onChangeQuery`: declared with trigger 'root' — assign the real trigger part once anatomy is authored
- event `onFocus`: declared with trigger 'root' — assign the real trigger part once anatomy is authored
- event `onBlur`: declared with trigger 'root' — assign the real trigger part once anatomy is authored
- prop `ref`: platform prop — not contract API, skipped
- prop `handleRef`: unclassified type — not proposed, review manually

## Toolbar

- source: `examples/astryx/.astryx-sandbox/node_modules/@astryxdesign/core/src/Toolbar/Toolbar.tsx` (react-tsx)
- proposed: 2 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- props type extends BaseProps<HTMLDivElement> — parent members are outside single-file extraction and are NOT carried
- prop `ref`: platform prop — not contract API, skipped
- prop `startContent`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually
- prop `centerContent`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually
- prop `endContent`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually
- prop `size`: unclassified type — not proposed, review manually
- prop `gap`: unclassified type — not proposed, review manually
- prop `orientation`: figma binding INFERRED as VARIANT "Orientation" — confirm against the design library (reconcile step)
- prop `variant`: unclassified type — not proposed, review manually
- prop `dividers`: unclassified type — not proposed, review manually

## Tooltip

- source: `examples/astryx/.astryx-sandbox/node_modules/@astryxdesign/core/src/Tooltip/Tooltip.tsx` (react-tsx)
- proposed: 5 props, 1 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- prop `children`: platform prop — not contract API, skipped
- prop `anchorRef`: unclassified type — not proposed, review manually
- prop `content`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually
- prop `placement`: unclassified type — not proposed, review manually
- prop `alignment`: unclassified type — not proposed, review manually
- prop `focusTrigger`: unclassified type — not proposed, review manually
- event `onOpenChange`: declared with trigger 'root' — assign the real trigger part once anatomy is authored
- prop `hasHoverIndication`: unclassified type — not proposed, review manually

## TopNav

- source: `examples/astryx/.astryx-sandbox/node_modules/@astryxdesign/core/src/TopNav/TopNav.tsx` (react-tsx)
- proposed: 1 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- props type extends BaseProps<HTMLElement> — parent members are outside single-file extraction and are NOT carried
- prop `ref`: platform prop — not contract API, skipped
- prop `heading`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually
- prop `startContent`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually
- prop `children`: platform prop — not contract API, skipped
- prop `centerContent`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually
- prop `endContent`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually

## TopNavHeading

- source: `examples/astryx/.astryx-sandbox/node_modules/@astryxdesign/core/src/TopNav/TopNavHeading.tsx` (react-tsx)
- proposed: 8 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- props type extends BaseProps<HTMLElement> — parent members are outside single-file extraction and are NOT carried
- prop `ref`: platform prop — not contract API, skipped
- prop `logo`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually
- prop `headerEndContent`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually
- prop `menu`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually
- prop `as`: unclassified type — not proposed, review manually

## TopNavItem

- source: `examples/astryx/.astryx-sandbox/node_modules/@astryxdesign/core/src/TopNav/TopNavItem.tsx` (react-tsx)
- proposed: 7 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- props type extends BaseProps<HTMLAnchorElement> — parent members are outside single-file extraction and are NOT carried
- prop `ref`: platform prop — not contract API, skipped
- prop `download`: unclassified type — not proposed, review manually
- prop `referrerPolicy`: unclassified type — not proposed, review manually
- prop `as`: unclassified type — not proposed, review manually
- prop `icon`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually
- prop `children`: platform prop — not contract API, skipped
- prop `size`: unclassified type — not proposed, review manually

## TopNavMegaMenu

- source: `examples/astryx/.astryx-sandbox/node_modules/@astryxdesign/core/src/TopNav/TopNavMegaMenu.tsx` (react-tsx)
- proposed: 3 props, 1 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- props type extends BaseProps<HTMLButtonElement> — parent members are outside single-file extraction and are NOT carried
- prop `ref`: platform prop — not contract API, skipped
- prop `items`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually
- prop `featured`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually
- event `onOpenChange`: declared with trigger 'root' — assign the real trigger part once anatomy is authored

## TopNavMegaMenuFeaturedCard

- source: `examples/astryx/.astryx-sandbox/node_modules/@astryxdesign/core/src/TopNav/TopNavMegaMenuFeaturedCard.tsx` (react-tsx)
- proposed: 6 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- props type extends BaseProps<HTMLDivElement> — parent members are outside single-file extraction and are NOT carried
- prop `ref`: platform prop — not contract API, skipped
- prop `children`: platform prop — not contract API, skipped

## TopNavMegaMenuItem

- source: `examples/astryx/.astryx-sandbox/node_modules/@astryxdesign/core/src/TopNav/TopNavMegaMenuItem.tsx` (react-tsx)
- proposed: 3 props, 1 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- props type extends Omit<
  BaseProps<HTMLElement>,
  'onClick'
> — parent members are outside single-file extraction and are NOT carried
- prop `ref`: platform prop — not contract API, skipped
- prop `icon`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually
- event `onClick`: declared with trigger 'root' — assign the real trigger part once anatomy is authored
- prop `as`: unclassified type — not proposed, review manually

## TopNavMenu

- source: `examples/astryx/.astryx-sandbox/node_modules/@astryxdesign/core/src/TopNav/TopNavMenu.tsx` (react-tsx)
- proposed: 3 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- props type extends BaseProps<HTMLButtonElement> — parent members are outside single-file extraction and are NOT carried
- prop `ref`: platform prop — not contract API, skipped
- prop `items`: unclassified type — not proposed, review manually

## TreeList

- source: `examples/astryx/.astryx-sandbox/node_modules/@astryxdesign/core/src/TreeList/TreeList.tsx` (react-tsx)
- proposed: 0 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- props type extends BaseProps<HTMLDivElement> — parent members are outside single-file extraction and are NOT carried
- prop `ref`: platform prop — not contract API, skipped
- prop `items`: unclassified type — not proposed, review manually
- prop `density`: unclassified type — not proposed, review manually
- prop `header`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually

## TreeListBranches

- source: `examples/astryx/.astryx-sandbox/node_modules/@astryxdesign/core/src/TreeList/TreeListBranches.tsx` (react-tsx)
- proposed: 2 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- prop `ancestorsIsLast`: unclassified type — not proposed, review manually

## TreeListItem

- source: `examples/astryx/.astryx-sandbox/node_modules/@astryxdesign/core/src/TreeList/TreeListItem.tsx` (react-tsx)
- proposed: 12 props, 2 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- prop `id`: platform prop — not contract API, skipped
- prop `label`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually
- prop `startContent`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually
- prop `endContent`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually
- event `onClick`: declared with trigger 'root' — assign the real trigger part once anatomy is authored
- prop `ancestorsIsLast`: unclassified type — not proposed, review manually
- event `onToggle`: declared with trigger 'root' — assign the real trigger part once anatomy is authored
- prop `density`: unclassified type — not proposed, review manually
- prop `renderedChildren`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually

## Typeahead

- source: `examples/astryx/.astryx-sandbox/node_modules/@astryxdesign/core/src/Typeahead/Typeahead.tsx` (react-tsx)
- proposed: 16 props, 3 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- props type extends Omit<
  BaseProps<HTMLDivElement>,
  'onChange'
> — parent members are outside single-file extraction and are NOT carried
- prop `ref`: platform prop — not contract API, skipped
- prop `status`: unclassified type — not proposed, review manually
- prop `startIcon`: unclassified type — not proposed, review manually
- prop `width`: unclassified type — not proposed, review manually
- prop `searchSource`: unclassified type — not proposed, review manually
- prop `value`: unclassified type — not proposed, review manually
- event `onChange`: declared with trigger 'root' — assign the real trigger part once anatomy is authored
- prop `renderItem`: function-typed but not on* — skipped, review manually
- prop `size`: type resolved heuristically — review
- prop `size`: figma binding INFERRED as VARIANT "Size" — confirm against the design library (reconcile step)
- event `onChangeQuery`: declared with trigger 'root' — assign the real trigger part once anatomy is authored
- event `onOpenChange`: declared with trigger 'root' — assign the real trigger part once anatomy is authored

## TypeaheadItem

- source: `examples/astryx/.astryx-sandbox/node_modules/@astryxdesign/core/src/Typeahead/TypeaheadItem.tsx` (react-tsx)
- proposed: 3 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- props type extends BaseProps<HTMLDivElement> — parent members are outside single-file extraction and are NOT carried
- prop `ref`: platform prop — not contract API, skipped
- prop `item`: unclassified type — not proposed, review manually
- prop `icon`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually

## VisuallyHidden

- source: `examples/astryx/.astryx-sandbox/node_modules/@astryxdesign/core/src/VisuallyHidden/VisuallyHidden.tsx` (react-tsx)
- proposed: 0 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- props type extends Omit<
  BaseProps<HTMLElement>,
  'className' | 'style'
> — parent members are outside single-file extraction and are NOT carried
- prop `ref`: platform prop — not contract API, skipped
- prop `children`: platform prop — not contract API, skipped
- prop `as`: unclassified type — not proposed, review manually

## VStack

- source: `examples/astryx/.astryx-sandbox/node_modules/@astryxdesign/core/src/VStack/VStack.tsx` (react-tsx)
- proposed: 0 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- props type extends Omit<
  StackProps,
  'direction' | 'hAlign' | 'vAlign'
> — parent members are outside single-file extraction and are NOT carried
- prop `ref`: platform prop — not contract API, skipped
- prop `hAlign`: unclassified type — not proposed, review manually
- prop `vAlign`: unclassified type — not proposed, review manually
- prop `justify`: unclassified type — not proposed, review manually
- prop `align`: unclassified type — not proposed, review manually

## Components seen but NOT extractable (review required)

These components were found but their props could not be read — reported, never silently dropped:

- **LazyXDSTooltip** (`examples/astryx/.astryx-sandbox/node_modules/@astryxdesign/core/src/Heading/Heading.tsx`) — props type "LazyXDSTooltipProps" not found in this file (imported/composed types are outside single-file extraction)
- **EditorOverride** (`examples/astryx/.astryx-sandbox/node_modules/@astryxdesign/core/src/PowerSearch/PowerSearch.tsx`) — props type "EditorOverrideProps" not found in this file (imported/composed types are outside single-file extraction)
- **PowerSearchFilterEditor** (`examples/astryx/.astryx-sandbox/node_modules/@astryxdesign/core/src/PowerSearch/PowerSearchFilterEditor.tsx`) — props type "PowerSearchEditorProps" not found in this file (imported/composed types are outside single-file extraction)
- **PowerSearchToken** (`examples/astryx/.astryx-sandbox/node_modules/@astryxdesign/core/src/PowerSearch/PowerSearchToken.tsx`) — props type "PowerSearchTokenProps" not found in this file (imported/composed types are outside single-file extraction)
- **Selector** (`examples/astryx/.astryx-sandbox/node_modules/@astryxdesign/core/src/Selector/Selector.tsx`) — props type "SelectorProps" resolves only to named reference(s) [SelectorPropsNonClearable<T>, SelectorPropsClearable<T>] whose members are outside module scope — 0 readable props; skipped instead of proposing a hollow contract
- **RowComponent** (`examples/astryx/.astryx-sandbox/node_modules/@astryxdesign/core/src/Table/BaseTable.tsx`) — props type "RowComponentProps" not found in this file (imported/composed types are outside single-file extraction)
- **CellComponent** (`examples/astryx/.astryx-sandbox/node_modules/@astryxdesign/core/src/Table/BaseTable.tsx`) — props type "CellComponentProps" not found in this file (imported/composed types are outside single-file extraction)
- **HeaderCellComponent** (`examples/astryx/.astryx-sandbox/node_modules/@astryxdesign/core/src/Table/BaseTable.tsx`) — props type "HeaderCellComponentProps" not found in this file (imported/composed types are outside single-file extraction)
- **SelectAllCheckbox** (`examples/astryx/.astryx-sandbox/node_modules/@astryxdesign/core/src/Table/plugins/selection/useTableSelection.tsx`) — props type "SelectAllCheckboxProps" not found in this file (imported/composed types are outside single-file extraction)
- **LazyXDSTooltip** (`examples/astryx/.astryx-sandbox/node_modules/@astryxdesign/core/src/Text/Text.tsx`) — props type "LazyXDSTooltipProps" not found in this file (imported/composed types are outside single-file extraction)
- **ImagePlaceholder** (`examples/astryx/.astryx-sandbox/node_modules/@astryxdesign/core/src/Thumbnail/Thumbnail.tsx`) — props type "ImagePlaceholderProps" not found in this file (imported/composed types are outside single-file extraction)
- **LazyXDSTooltip** (`examples/astryx/.astryx-sandbox/node_modules/@astryxdesign/core/src/Timestamp/Timestamp.tsx`) — props type "LazyXDSTooltipProps" not found in this file (imported/composed types are outside single-file extraction)
- **FallbackCapture** (`examples/astryx/.astryx-sandbox/node_modules/@astryxdesign/core/src/Toast/useToast.tsx`) — props type "FallbackCaptureProps" not found in this file (imported/composed types are outside single-file extraction)
- **DrawerMegaMenu** (`examples/astryx/.astryx-sandbox/node_modules/@astryxdesign/core/src/TopNav/TopNavMegaMenu.tsx`) — props type "Pick" not found in this file (imported/composed types are outside single-file extraction)
- **ALL_SYNTAX_KEYS** (`examples/astryx/.astryx-sandbox/node_modules/@astryxdesign/core/src/theme/syntax/defineSyntaxTheme.ts`) — props type "ALL_SYNTAX_KEYSProps" not found in this file (imported/composed types are outside single-file extraction)

