# Proposed contracts — extraction report

53 component(s) extracted. Every proposal parses against the contract schema, but a proposal is a STARTING POINT: confirm inferred design bindings via `npm run reconcile`, then review the notes below per component.

## Accordion

- source: `extract/pilots/eventz/.src/eventz-design-system/packages/core/src/components/client/Accordion/Accordion.tsx` (react-tsx)
- proposed: 5 props, 1 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- prop `image`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually
- prop `emphasis`: figma binding INFERRED as VARIANT "Emphasis" — confirm against the design library (reconcile step)
- event `onValueChange`: declared with trigger 'root' — assign the real trigger part once anatomy is authored

## ActionCard

- source: `extract/pilots/eventz/.src/eventz-design-system/packages/core/src/components/server/ActionCard/ActionCard.tsx` (react-tsx)
- proposed: 0 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element

## Alert

- source: `extract/pilots/eventz/.src/eventz-design-system/packages/core/src/components/client/Alert/Alert.tsx` (react-tsx)
- proposed: 4 props, 1 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- prop `variant`: type resolved heuristically — review
- prop `variant`: figma binding INFERRED as VARIANT "Variant" — confirm against the design library (reconcile step)
- prop `textLink`: unclassified type — not proposed, review manually
- prop `closeIcon`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually
- event `onCloseClick`: declared with trigger 'root' — assign the real trigger part once anatomy is authored

## AvatarGroup

- source: `extract/pilots/eventz/.src/eventz-design-system/packages/core/src/components/client/AvatarGroup/AvatarGroup.tsx` (react-tsx)
- proposed: 5 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- prop `users`: unclassified type — not proposed, review manually

## Badge

- source: `extract/pilots/eventz/.src/eventz-design-system/packages/core/src/components/server/Badge/Badge.tsx` (react-tsx)
- proposed: 2 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- prop `variant`: figma binding INFERRED as VARIANT "Variant" — confirm against the design library (reconcile step)
- prop `icon`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually

## Breadcrumbs

- source: `extract/pilots/eventz/.src/eventz-design-system/packages/core/src/components/server/Breadcrumbs/Breadcrumbs.tsx` (react-tsx)
- proposed: 2 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- prop `items`: unclassified type — not proposed, review manually

## Button

- source: `extract/pilots/eventz/.src/eventz-design-system/packages/core/src/components/client/Button/Button.tsx` (react-tsx)
- proposed: 0 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element

## Carousel

- source: `extract/pilots/eventz/.src/eventz-design-system/packages/core/src/components/client/Carousel/Carousel.tsx` (react-tsx)
- proposed: 15 props, 3 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- event `onChange`: declared with trigger 'root' — assign the real trigger part once anatomy is authored
- prop `align`: type resolved heuristically — review
- prop `align`: figma binding INFERRED as VARIANT "Align" — confirm against the design library (reconcile step)
- event `onInViewChange`: declared with trigger 'root' — assign the real trigger part once anatomy is authored
- event `onAutoPlayChange`: declared with trigger 'root' — assign the real trigger part once anatomy is authored
- prop `children`: platform prop — not contract API, skipped

## Checkbox

- source: `extract/pilots/eventz/.src/eventz-design-system/packages/core/src/components/client/Checkbox/Checkbox.tsx` (react-tsx)
- proposed: 7 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- prop `className`: platform prop — not contract API, skipped

## CheckboxGroup

- source: `extract/pilots/eventz/.src/eventz-design-system/packages/core/src/components/client/CheckboxGroup/CheckboxGroup.tsx` (react-tsx)
- proposed: 6 props, 1 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- prop `choices`: unclassified type — not proposed, review manually
- event `onCheckedChange`: declared with trigger 'root' — assign the real trigger part once anatomy is authored

## Chip

- source: `extract/pilots/eventz/.src/eventz-design-system/packages/core/src/components/server/Chip/Chip.tsx` (react-tsx)
- proposed: 2 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- prop `icon`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually
- prop `className`: platform prop — not contract API, skipped

## Combobox

- source: `extract/pilots/eventz/.src/eventz-design-system/packages/core/src/components/client/Combobox/Combobox.tsx` (react-tsx)
- proposed: 7 props, 2 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- prop `menuItemType`: type resolved heuristically — review
- prop `menuItemType`: figma binding INFERRED as VARIANT "Menu Item Type" — confirm against the design library (reconcile step)
- prop `startIcon`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually
- prop `endIcon`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually
- prop `items`: unclassified type — not proposed, review manually
- prop `selectedIds`: unclassified type — not proposed, review manually
- prop `defaultSelectedIds`: unclassified type — not proposed, review manually
- event `onSelectionChange`: declared with trigger 'root' — assign the real trigger part once anatomy is authored
- event `onOpenChange`: declared with trigger 'root' — assign the real trigger part once anatomy is authored
- prop `FormElementProps`: unclassified type — not proposed, review manually

## ComboboxField

- source: `extract/pilots/eventz/.src/eventz-design-system/packages/core/src/components/client/Combobox/Combobox.tsx` (react-tsx)
- proposed: 5 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- prop `startIcon`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually
- prop `endIcon`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually
- prop `chips`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually
- prop `clearAll`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually
- prop `inputProps`: unclassified type — not proposed, review manually
- prop `inputRef`: function-typed but not on* — skipped, review manually

## ContentCard

- source: `extract/pilots/eventz/.src/eventz-design-system/packages/core/src/components/server/ContentCard/ContentCard.tsx` (react-tsx)
- proposed: 0 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element

## Control

- source: `extract/pilots/eventz/.src/eventz-design-system/packages/core/src/components/client/Control/Control.tsx` (react-tsx)
- proposed: 0 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element

## Countdown

- source: `extract/pilots/eventz/.src/eventz-design-system/packages/core/src/components/client/Countdown/Countdown.tsx` (react-tsx)
- proposed: 0 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element

## DatePicker

- source: `extract/pilots/eventz/.src/eventz-design-system/packages/core/src/components/client/DatePicker/DatePicker.tsx` (react-tsx)
- proposed: 0 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element

## Dialog

- source: `extract/pilots/eventz/.src/eventz-design-system/packages/core/src/components/client/Dialog/Dialog.tsx` (react-tsx)
- proposed: 2 props, 2 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- prop `trigger`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually
- prop `size`: figma binding INFERRED as VARIANT "Size" — confirm against the design library (reconcile step)
- prop `closeIcon`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually
- prop `controlLeftIcon`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually
- prop `controlRightIcon`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually
- event `onControlLeftClick`: declared with trigger 'root' — assign the real trigger part once anatomy is authored
- event `onControlRightClick`: declared with trigger 'root' — assign the real trigger part once anatomy is authored
- prop `children`: platform prop — not contract API, skipped

## Dropdown

- source: `extract/pilots/eventz/.src/eventz-design-system/packages/core/src/components/client/Dropdown/Dropdown.tsx` (react-tsx)
- proposed: 10 props, 1 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- prop `startIcon`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually
- prop `endIcon`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually
- event `onOpenChange`: declared with trigger 'root' — assign the real trigger part once anatomy is authored
- prop `align`: type resolved heuristically — review
- prop `align`: figma binding INFERRED as VARIANT "Align" — confirm against the design library (reconcile step)
- prop `side`: type resolved heuristically — review
- prop `side`: figma binding INFERRED as VARIANT "Side" — confirm against the design library (reconcile step)
- prop `ariaHaspopup`: type resolved heuristically — review
- prop `ariaHaspopup`: figma binding INFERRED as VARIANT "Aria Haspopup" — confirm against the design library (reconcile step)
- prop `children`: platform prop — not contract API, skipped

## EventPanel

- source: `extract/pilots/eventz/.src/eventz-design-system/packages/core/src/components/server/EventPanel/EventPanel.tsx` (react-tsx)
- proposed: 6 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- prop `loading`: figma binding INFERRED as VARIANT "Loading" — confirm against the design library (reconcile step)
- prop `leftAction`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually
- prop `rightAction`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually
- prop `chips`: unclassified type — not proposed, review manually
- prop `avatars`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually
- prop `buttons`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually

## ExpandableContent

- source: `extract/pilots/eventz/.src/eventz-design-system/packages/core/src/components/client/ExpandableContent/ExpandableContent.tsx` (react-tsx)
- proposed: 2 props, 1 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- event `onExpandedChange`: declared with trigger 'root' — assign the real trigger part once anatomy is authored

## FileUpload

- source: `extract/pilots/eventz/.src/eventz-design-system/packages/core/src/components/client/FileUpload/FileUpload.tsx` (react-tsx)
- proposed: 14 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- prop `imageFormat`: type resolved heuristically — review
- prop `imageFormat`: figma binding INFERRED as VARIANT "Image Format" — confirm against the design library (reconcile step)
- prop `imageProperties`: unclassified type — not proposed, review manually
- prop `onFileSelected`: unclassified type — not proposed, review manually
- prop `onFileCanceled`: unclassified type — not proposed, review manually
- prop `onFileAccepted`: unclassified type — not proposed, review manually
- prop `onFileChanging`: unclassified type — not proposed, review manually
- prop `onFileError`: unclassified type — not proposed, review manually
- prop `onFileRemoved`: unclassified type — not proposed, review manually

## FloatingBar

- source: `extract/pilots/eventz/.src/eventz-design-system/packages/core/src/components/client/FloatingBar/FloatingBar.tsx` (react-tsx)
- proposed: 3 props, 2 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- event `onLeftScroll`: declared with trigger 'root' — assign the real trigger part once anatomy is authored
- event `onRightScroll`: declared with trigger 'root' — assign the real trigger part once anatomy is authored
- prop `content`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually
- prop `actions`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually

## Footer

- source: `extract/pilots/eventz/.src/eventz-design-system/packages/core/src/components/server/Footer/Footer.tsx` (react-tsx)
- proposed: 0 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- prop `className`: platform prop — not contract API, skipped

## FormElement

- source: `extract/pilots/eventz/.src/eventz-design-system/packages/core/src/components/client/FormElement/FormElement.tsx` (react-tsx)
- proposed: 7 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- prop `className`: platform prop — not contract API, skipped
- prop `children`: platform prop — not contract API, skipped

## Heading

- source: `extract/pilots/eventz/.src/eventz-design-system/packages/core/src/components/server/Heading/Heading.tsx` (react-tsx)
- proposed: 9 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- prop `as`: type resolved heuristically — review
- prop `as`: figma binding INFERRED as VARIANT "As" — confirm against the design library (reconcile step)
- prop `size`: type resolved heuristically — review
- prop `size`: figma binding INFERRED as VARIANT "Size" — confirm against the design library (reconcile step)
- prop `weight`: type resolved heuristically — review
- prop `weight`: figma binding INFERRED as VARIANT "Weight" — confirm against the design library (reconcile step)
- prop `align`: type resolved heuristically — review
- prop `align`: figma binding INFERRED as VARIANT "Align" — confirm against the design library (reconcile step)
- prop `color`: type resolved heuristically — review
- prop `color`: figma binding INFERRED as VARIANT "Color" — confirm against the design library (reconcile step)
- prop `transform`: type resolved heuristically — review
- prop `transform`: figma binding INFERRED as VARIANT "Transform" — confirm against the design library (reconcile step)

## IconButton

- source: `extract/pilots/eventz/.src/eventz-design-system/packages/core/src/components/client/IconButton/IconButton.tsx` (react-tsx)
- proposed: 0 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element

## ImagePanel

- source: `extract/pilots/eventz/.src/eventz-design-system/packages/core/src/components/server/ImagePanel/ImagePanel.tsx` (react-tsx)
- proposed: 6 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- prop `loading`: figma binding INFERRED as VARIANT "Loading" — confirm against the design library (reconcile step)
- prop `fetchPriority`: figma binding INFERRED as VARIANT "Fetch Priority" — confirm against the design library (reconcile step)
- prop `labels`: unclassified type — not proposed, review manually
- prop `actions`: unclassified type — not proposed, review manually

## InfoPopover

- source: `extract/pilots/eventz/.src/eventz-design-system/packages/core/src/components/client/InfoPopover/InfoPopover.tsx` (react-tsx)
- proposed: 4 props, 1 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- prop `side`: type resolved heuristically — review
- prop `side`: figma binding INFERRED as VARIANT "Side" — confirm against the design library (reconcile step)
- event `onOpenChange`: declared with trigger 'root' — assign the real trigger part once anatomy is authored
- prop `children`: platform prop — not contract API, skipped

## Input

- source: `extract/pilots/eventz/.src/eventz-design-system/packages/core/src/components/client/Input/Input.tsx` (react-tsx)
- proposed: 0 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- prop `startIcon`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually
- prop `endIcon`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually
- prop `className`: platform prop — not contract API, skipped

## InputField

- source: `extract/pilots/eventz/.src/eventz-design-system/packages/core/src/components/client/Input/Input.tsx` (react-tsx)
- proposed: 4 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- prop `startIcon`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually
- prop `endIcon`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually
- prop `inputProps`: unclassified type — not proposed, review manually

## Map

- source: `extract/pilots/eventz/.src/eventz-design-system/packages/core/src/components/server/Map/Map.tsx` (react-tsx)
- proposed: 4 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element

## MediaCard

- source: `extract/pilots/eventz/.src/eventz-design-system/packages/core/src/components/server/MediaCard/MediaCard.tsx` (react-tsx)
- proposed: 4 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- prop `labels`: unclassified type — not proposed, review manually
- prop `control`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually

## MediaControl

- source: `extract/pilots/eventz/.src/eventz-design-system/packages/core/src/components/client/MediaControl/MediaControl.tsx` (react-tsx)
- proposed: 4 props, 3 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- prop `state`: type resolved heuristically — review
- prop `state`: figma binding INFERRED as VARIANT "State" — confirm against the design library (reconcile step)
- prop `defaultState`: type resolved heuristically — review
- prop `defaultState`: figma binding INFERRED as VARIANT "Default State" — confirm against the design library (reconcile step)
- event `onStateChange`: declared with trigger 'root' — assign the real trigger part once anatomy is authored
- event `onPlay`: declared with trigger 'root' — assign the real trigger part once anatomy is authored
- event `onPause`: declared with trigger 'root' — assign the real trigger part once anatomy is authored
- prop `variant`: unclassified type — not proposed, review manually
- prop `size`: unclassified type — not proposed, review manually

## MediaPlayer

- source: `extract/pilots/eventz/.src/eventz-design-system/packages/core/src/components/client/MediaPlayer/MediaPlayer.tsx` (react-tsx)
- proposed: 11 props, 1 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- prop `variant`: type resolved heuristically — review
- prop `variant`: figma binding INFERRED as VARIANT "Variant" — confirm against the design library (reconcile step)
- prop `preload`: figma binding INFERRED as VARIANT "Preload" — confirm against the design library (reconcile step)
- event `onCloseClick`: declared with trigger 'root' — assign the real trigger part once anatomy is authored

## NavigationBar

- source: `extract/pilots/eventz/.src/eventz-design-system/packages/core/src/components/server/NavigationBar/NavigationBar.tsx` (react-tsx)
- proposed: 3 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- prop `items`: unclassified type — not proposed, review manually
- prop `logo`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually
- prop `tagline`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually
- prop `mobileNavigation`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually
- prop `secondaryNavigation`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually

## NavigationContainer

- source: `extract/pilots/eventz/.src/eventz-design-system/packages/core/src/components/server/NavigationContainer/NavigationContainer.tsx` (react-tsx)
- proposed: 0 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- prop `className`: platform prop — not contract API, skipped

## NavigationDropdown

- source: `extract/pilots/eventz/.src/eventz-design-system/packages/core/src/components/client/NavigationDropdown/NavigationDropdown.tsx` (react-tsx)
- proposed: 2 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- prop `openIcon`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually
- prop `closeIcon`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually
- prop `items`: unclassified type — not proposed, review manually

## RadioButtonGroup

- source: `extract/pilots/eventz/.src/eventz-design-system/packages/core/src/components/client/RadioButtonGroup/RadioButtonGroup.tsx` (react-tsx)
- proposed: 5 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- prop `choices`: unclassified type — not proposed, review manually

## Scroller

- source: `extract/pilots/eventz/.src/eventz-design-system/packages/core/src/components/client/Scroller/Scroller.tsx` (react-tsx)
- proposed: 4 props, 1 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- prop `pageBy`: type resolved heuristically — review
- prop `pageBy`: figma binding INFERRED as VARIANT "Page By" — confirm against the design library (reconcile step)
- event `onScrollChange`: declared with trigger 'root' — assign the real trigger part once anatomy is authored
- prop `children`: platform prop — not contract API, skipped

## ScrollerRow

- source: `extract/pilots/eventz/.src/eventz-design-system/packages/core/src/components/server/ScrollerRow/ScrollerRow.tsx` (react-tsx)
- proposed: 0 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- prop `className`: platform prop — not contract API, skipped

## Search

- source: `extract/pilots/eventz/.src/eventz-design-system/packages/core/src/components/client/Search/Search.tsx` (react-tsx)
- proposed: 6 props, 3 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- event `onSearchTermChange`: declared with trigger 'root' — assign the real trigger part once anatomy is authored
- prop `results`: unclassified type — not proposed, review manually
- event `onResultSelect`: declared with trigger 'root' — assign the real trigger part once anatomy is authored
- event `onViewAllClick`: declared with trigger 'root' — assign the real trigger part once anatomy is authored
- prop `InputProps`: unclassified type — not proposed, review manually
- prop `closeIcon`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually

## Select

- source: `extract/pilots/eventz/.src/eventz-design-system/packages/core/src/components/client/Select/Select.tsx` (react-tsx)
- proposed: 1 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- prop `InputProps`: unclassified type — not proposed, review manually
- prop `options`: unclassified type — not proposed, review manually

## SelectionCard

- source: `extract/pilots/eventz/.src/eventz-design-system/packages/core/src/components/server/SelectionCard/SelectionCard.tsx` (react-tsx)
- proposed: 3 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- prop `icon`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually

## Slider

- source: `extract/pilots/eventz/.src/eventz-design-system/packages/core/src/components/client/Slider/Slider.tsx` (react-tsx)
- proposed: 6 props, 2 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- event `onChange`: declared with trigger 'root' — assign the real trigger part once anatomy is authored
- event `onCommit`: declared with trigger 'root' — assign the real trigger part once anatomy is authored

## Stepper

- source: `extract/pilots/eventz/.src/eventz-design-system/packages/core/src/components/client/Stepper/Stepper.tsx` (react-tsx)
- proposed: 3 props, 1 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- event `onStepChange`: declared with trigger 'root' — assign the real trigger part once anatomy is authored

## SubscriptionCard

- source: `extract/pilots/eventz/.src/eventz-design-system/packages/core/src/components/server/SubscriptionCard/SubscriptionCard.tsx` (react-tsx)
- proposed: 7 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- prop `cancel`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually

## Tabs

- source: `extract/pilots/eventz/.src/eventz-design-system/packages/core/src/components/client/Tabs/Tabs.tsx` (react-tsx)
- proposed: 7 props, 1 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- prop `type`: figma binding INFERRED as VARIANT "Type" — confirm against the design library (reconcile step)
- prop `tabsList`: unclassified type — not proposed, review manually
- event `onValueChange`: declared with trigger 'root' — assign the real trigger part once anatomy is authored
- prop `activationMode`: figma binding INFERRED as VARIANT "Activation Mode" — confirm against the design library (reconcile step)
- prop `className`: platform prop — not contract API, skipped

## Textarea

- source: `extract/pilots/eventz/.src/eventz-design-system/packages/core/src/components/client/Textarea/Textarea.tsx` (react-tsx)
- proposed: 8 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- prop `startIcon`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually
- prop `endIcon`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually

## TextLink

- source: `extract/pilots/eventz/.src/eventz-design-system/packages/core/src/components/client/TextLink/TextLink.tsx` (react-tsx)
- proposed: 0 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element

## TextWithRef

- source: `extract/pilots/eventz/.src/eventz-design-system/packages/core/src/components/server/Text/Text.tsx` (react-tsx)
- proposed: 0 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element

## ToggleGroup

- source: `extract/pilots/eventz/.src/eventz-design-system/packages/core/src/components/client/ToggleGroup/ToggleGroup.tsx` (react-tsx)
- proposed: 1 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- prop `items`: unclassified type — not proposed, review manually

## Visibility

- source: `extract/pilots/eventz/.src/eventz-design-system/packages/core/src/components/server/Visibility/Visibility.tsx` (react-tsx)
- proposed: 2 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- prop `from`: type resolved heuristically — review
- prop `from`: figma binding INFERRED as VARIANT "From" — confirm against the design library (reconcile step)
- prop `to`: type resolved heuristically — review
- prop `to`: figma binding INFERRED as VARIANT "To" — confirm against the design library (reconcile step)

## Components seen but NOT extractable (review required)

These components were found but their props could not be read — reported, never silently dropped:

- **MenuItem** (`extract/pilots/eventz/.src/eventz-design-system/packages/core/src/components/client/MenuItem/MenuItem.tsx`) — props type "MenuItemComponentProps" not found in this file (imported/composed types are outside single-file extraction)
- **InteractiveListItem** (`extract/pilots/eventz/.src/eventz-design-system/packages/core/src/components/server/InteractiveListItem/InteractiveListItem.tsx`) — props type "InteractiveListItemComponentProps" not found in this file (imported/composed types are outside single-file extraction)
- **Tag** (`extract/pilots/eventz/.src/eventz-design-system/packages/core/src/components/server/Tag/Tag.tsx`) — props type "TagProps" not found in this file (imported/composed types are outside single-file extraction)

