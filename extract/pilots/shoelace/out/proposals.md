# Proposed contracts — extraction report

58 component(s) extracted. Every proposal parses against the contract schema, but a proposal is a STARTING POINT: confirm inferred design bindings via `npm run reconcile`, then review the notes below per component.

## SlAlert

- source: `extract/pilots/shoelace/custom-elements.json (components/alert/alert.js)` (cem)
- proposed: 4 props, 4 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- prop `variant`: figma binding INFERRED as VARIANT "Variant" — confirm against the design library (reconcile step)
- prop `duration`: unclassified type — not proposed, review manually
- prop `countdown`: figma binding INFERRED as VARIANT "Countdown" — confirm against the design library (reconcile step)
- prop `dependencies`: unclassified type — not proposed, review manually
- prop `base`: unclassified type — not proposed, review manually
- prop `countdownElement`: unclassified type — not proposed, review manually
- prop `onShow`: type resolved heuristically — review
- event `onShow`: declared with trigger 'root' — assign the real trigger part once anatomy is authored
- prop `onAfterShow`: type resolved heuristically — review
- event `onAfterShow`: declared with trigger 'root' — assign the real trigger part once anatomy is authored
- prop `onHide`: type resolved heuristically — review
- event `onHide`: declared with trigger 'root' — assign the real trigger part once anatomy is authored
- prop `onAfterHide`: type resolved heuristically — review
- event `onAfterHide`: declared with trigger 'root' — assign the real trigger part once anatomy is authored

## SlAnimatedImage

- source: `extract/pilots/shoelace/custom-elements.json (components/animated-image/animated-image.js)` (cem)
- proposed: 5 props, 2 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- prop `dependencies`: unclassified type — not proposed, review manually
- prop `animatedImage`: unclassified type — not proposed, review manually
- prop `onLoad`: type resolved heuristically — review
- event `onLoad`: declared with trigger 'root' — assign the real trigger part once anatomy is authored
- prop `onError`: type resolved heuristically — review
- event `onError`: declared with trigger 'root' — assign the real trigger part once anatomy is authored

## SlAnimation

- source: `extract/pilots/shoelace/custom-elements.json (components/animation/animation.js)` (cem)
- proposed: 11 props, 3 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- prop `direction`: unclassified type — not proposed, review manually
- prop `fill`: unclassified type — not proposed, review manually
- prop `iterations`: unclassified type — not proposed, review manually
- prop `defaultSlot`: unclassified type — not proposed, review manually
- prop `keyframes`: unclassified type — not proposed, review manually
- prop `currentTime`: unclassified type — not proposed, review manually
- prop `onCancel`: type resolved heuristically — review
- event `onCancel`: declared with trigger 'root' — assign the real trigger part once anatomy is authored
- prop `onFinish`: type resolved heuristically — review
- event `onFinish`: declared with trigger 'root' — assign the real trigger part once anatomy is authored
- prop `onStart`: type resolved heuristically — review
- event `onStart`: declared with trigger 'root' — assign the real trigger part once anatomy is authored

## SlAvatar

- source: `extract/pilots/shoelace/custom-elements.json (components/avatar/avatar.js)` (cem)
- proposed: 5 props, 1 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- prop `loading`: figma binding INFERRED as VARIANT "Loading" — confirm against the design library (reconcile step)
- prop `shape`: figma binding INFERRED as VARIANT "Shape" — confirm against the design library (reconcile step)
- prop `dependencies`: unclassified type — not proposed, review manually
- prop `onError`: type resolved heuristically — review
- event `onError`: declared with trigger 'root' — assign the real trigger part once anatomy is authored

## SlBadge

- source: `extract/pilots/shoelace/custom-elements.json (components/badge/badge.js)` (cem)
- proposed: 3 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- prop `variant`: figma binding INFERRED as VARIANT "Variant" — confirm against the design library (reconcile step)

## SlBreadcrumb

- source: `extract/pilots/shoelace/custom-elements.json (components/breadcrumb/breadcrumb.js)` (cem)
- proposed: 1 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- prop `dependencies`: unclassified type — not proposed, review manually
- prop `defaultSlot`: unclassified type — not proposed, review manually
- prop `separatorSlot`: unclassified type — not proposed, review manually

## SlBreadcrumbItem

- source: `extract/pilots/shoelace/custom-elements.json (components/breadcrumb-item/breadcrumb-item.js)` (cem)
- proposed: 2 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- prop `href`: unclassified type — not proposed, review manually
- prop `target`: figma binding INFERRED as VARIANT "Target" — confirm against the design library (reconcile step)
- prop `defaultSlot`: unclassified type — not proposed, review manually

## SlButton

- source: `extract/pilots/shoelace/custom-elements.json (components/button/button.js)` (cem)
- proposed: 25 props, 3 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- prop `variant`: figma binding INFERRED as VARIANT "Variant" — confirm against the design library (reconcile step)
- prop `size`: figma binding INFERRED as VARIANT "Size" — confirm against the design library (reconcile step)
- prop `type`: figma binding INFERRED as VARIANT "Type" — confirm against the design library (reconcile step)
- prop `target`: figma binding INFERRED as VARIANT "Target" — confirm against the design library (reconcile step)
- prop `download`: unclassified type — not proposed, review manually
- prop `formenctype`: figma binding INFERRED as VARIANT "Formenctype" — confirm against the design library (reconcile step)
- prop `formmethod`: figma binding INFERRED as VARIANT "Formmethod" — confirm against the design library (reconcile step)
- prop `formtarget`: unclassified type — not proposed, review manually
- prop `dependencies`: unclassified type — not proposed, review manually
- prop `button`: unclassified type — not proposed, review manually
- prop `formEnctype`: figma binding INFERRED as VARIANT "Form Enctype" — confirm against the design library (reconcile step)
- prop `formMethod`: figma binding INFERRED as VARIANT "Form Method" — confirm against the design library (reconcile step)
- prop `formTarget`: unclassified type — not proposed, review manually
- prop `validity`: unclassified type — not proposed, review manually
- prop `validationMessage`: unclassified type — not proposed, review manually
- prop `onBlur`: type resolved heuristically — review
- event `onBlur`: declared with trigger 'root' — assign the real trigger part once anatomy is authored
- prop `onFocus`: type resolved heuristically — review
- event `onFocus`: declared with trigger 'root' — assign the real trigger part once anatomy is authored
- prop `onInvalid`: type resolved heuristically — review
- event `onInvalid`: declared with trigger 'root' — assign the real trigger part once anatomy is authored

## SlButtonGroup

- source: `extract/pilots/shoelace/custom-elements.json (components/button-group/button-group.js)` (cem)
- proposed: 2 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- prop `defaultSlot`: unclassified type — not proposed, review manually

## SlCard

- source: `extract/pilots/shoelace/custom-elements.json (components/card/card.js)` (cem)
- proposed: 0 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element

## SlCarousel

- source: `extract/pilots/shoelace/custom-elements.json (components/carousel/carousel.js)` (cem)
- proposed: 16 props, 1 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- prop `orientation`: figma binding INFERRED as VARIANT "Orientation" — confirm against the design library (reconcile step)
- prop `dependencies`: unclassified type — not proposed, review manually
- prop `scrollContainer`: unclassified type — not proposed, review manually
- prop `paginationContainer`: unclassified type — not proposed, review manually
- prop `onSlideChange`: type resolved heuristically — review
- event `onSlideChange`: declared with trigger 'root' — assign the real trigger part once anatomy is authored

## SlCarouselItem

- source: `extract/pilots/shoelace/custom-elements.json (components/carousel-item/carousel-item.js)` (cem)
- proposed: 0 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element

## SlCheckbox

- source: `extract/pilots/shoelace/custom-elements.json (components/checkbox/checkbox.js)` (cem)
- proposed: 12 props, 5 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- prop `size`: figma binding INFERRED as VARIANT "Size" — confirm against the design library (reconcile step)
- prop `dependencies`: unclassified type — not proposed, review manually
- prop `input`: unclassified type — not proposed, review manually
- prop `validity`: unclassified type — not proposed, review manually
- prop `validationMessage`: unclassified type — not proposed, review manually
- prop `onBlur`: type resolved heuristically — review
- event `onBlur`: declared with trigger 'root' — assign the real trigger part once anatomy is authored
- prop `onChange`: type resolved heuristically — review
- event `onChange`: declared with trigger 'root' — assign the real trigger part once anatomy is authored
- prop `onFocus`: type resolved heuristically — review
- event `onFocus`: declared with trigger 'root' — assign the real trigger part once anatomy is authored
- prop `onInput`: type resolved heuristically — review
- event `onInput`: declared with trigger 'root' — assign the real trigger part once anatomy is authored
- prop `onInvalid`: type resolved heuristically — review
- event `onInvalid`: declared with trigger 'root' — assign the real trigger part once anatomy is authored

## SlColorPicker

- source: `extract/pilots/shoelace/custom-elements.json (components/color-picker/color-picker.js)` (cem)
- proposed: 15 props, 5 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- prop `format`: figma binding INFERRED as VARIANT "Format" — confirm against the design library (reconcile step)
- prop `size`: figma binding INFERRED as VARIANT "Size" — confirm against the design library (reconcile step)
- prop `swatches`: unclassified type — not proposed, review manually
- prop `dependencies`: unclassified type — not proposed, review manually
- prop `base`: unclassified type — not proposed, review manually
- prop `input`: unclassified type — not proposed, review manually
- prop `dropdown`: unclassified type — not proposed, review manually
- prop `previewButton`: unclassified type — not proposed, review manually
- prop `trigger`: unclassified type — not proposed, review manually
- prop `validity`: unclassified type — not proposed, review manually
- prop `validationMessage`: unclassified type — not proposed, review manually
- prop `onBlur`: type resolved heuristically — review
- event `onBlur`: declared with trigger 'root' — assign the real trigger part once anatomy is authored
- prop `onChange`: type resolved heuristically — review
- event `onChange`: declared with trigger 'root' — assign the real trigger part once anatomy is authored
- prop `onFocus`: type resolved heuristically — review
- event `onFocus`: declared with trigger 'root' — assign the real trigger part once anatomy is authored
- prop `onInput`: type resolved heuristically — review
- event `onInput`: declared with trigger 'root' — assign the real trigger part once anatomy is authored
- prop `onInvalid`: type resolved heuristically — review
- event `onInvalid`: declared with trigger 'root' — assign the real trigger part once anatomy is authored

## SlCopyButton

- source: `extract/pilots/shoelace/custom-elements.json (components/copy-button/copy-button.js)` (cem)
- proposed: 16 props, 2 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- prop `tooltip-placement`: figma binding INFERRED as VARIANT "Tooltip Placement" — confirm against the design library (reconcile step)
- prop `dependencies`: unclassified type — not proposed, review manually
- prop `copyIcon`: unclassified type — not proposed, review manually
- prop `successIcon`: unclassified type — not proposed, review manually
- prop `errorIcon`: unclassified type — not proposed, review manually
- prop `tooltip`: unclassified type — not proposed, review manually
- prop `status`: figma binding INFERRED as VARIANT "Status" — confirm against the design library (reconcile step)
- prop `tooltipPlacement`: figma binding INFERRED as VARIANT "Tooltip Placement" — confirm against the design library (reconcile step)
- prop `onCopy`: type resolved heuristically — review
- event `onCopy`: declared with trigger 'root' — assign the real trigger part once anatomy is authored
- prop `onError`: type resolved heuristically — review
- event `onError`: declared with trigger 'root' — assign the real trigger part once anatomy is authored

## SlDetails

- source: `extract/pilots/shoelace/custom-elements.json (components/details/details.js)` (cem)
- proposed: 3 props, 4 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- prop `dependencies`: unclassified type — not proposed, review manually
- prop `details`: unclassified type — not proposed, review manually
- prop `header`: unclassified type — not proposed, review manually
- prop `body`: unclassified type — not proposed, review manually
- prop `expandIconSlot`: unclassified type — not proposed, review manually
- prop `detailsObserver`: unclassified type — not proposed, review manually
- prop `onShow`: type resolved heuristically — review
- event `onShow`: declared with trigger 'root' — assign the real trigger part once anatomy is authored
- prop `onAfterShow`: type resolved heuristically — review
- event `onAfterShow`: declared with trigger 'root' — assign the real trigger part once anatomy is authored
- prop `onHide`: type resolved heuristically — review
- event `onHide`: declared with trigger 'root' — assign the real trigger part once anatomy is authored
- prop `onAfterHide`: type resolved heuristically — review
- event `onAfterHide`: declared with trigger 'root' — assign the real trigger part once anatomy is authored

## SlDialog

- source: `extract/pilots/shoelace/custom-elements.json (components/dialog/dialog.js)` (cem)
- proposed: 4 props, 6 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- prop `dependencies`: unclassified type — not proposed, review manually
- prop `modal`: unclassified type — not proposed, review manually
- prop `dialog`: unclassified type — not proposed, review manually
- prop `panel`: unclassified type — not proposed, review manually
- prop `overlay`: unclassified type — not proposed, review manually
- prop `onShow`: type resolved heuristically — review
- event `onShow`: declared with trigger 'root' — assign the real trigger part once anatomy is authored
- prop `onAfterShow`: type resolved heuristically — review
- event `onAfterShow`: declared with trigger 'root' — assign the real trigger part once anatomy is authored
- prop `onHide`: type resolved heuristically — review
- event `onHide`: declared with trigger 'root' — assign the real trigger part once anatomy is authored
- prop `onAfterHide`: type resolved heuristically — review
- event `onAfterHide`: declared with trigger 'root' — assign the real trigger part once anatomy is authored
- prop `onInitialFocus`: type resolved heuristically — review
- event `onInitialFocus`: declared with trigger 'root' — assign the real trigger part once anatomy is authored
- prop `onRequestClose`: type resolved heuristically — review
- event `onRequestClose`: declared with trigger 'root' — assign the real trigger part once anatomy is authored

## SlDivider

- source: `extract/pilots/shoelace/custom-elements.json (components/divider/divider.js)` (cem)
- proposed: 1 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element

## SlDrawer

- source: `extract/pilots/shoelace/custom-elements.json (components/drawer/drawer.js)` (cem)
- proposed: 6 props, 6 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- prop `placement`: figma binding INFERRED as VARIANT "Placement" — confirm against the design library (reconcile step)
- prop `dependencies`: unclassified type — not proposed, review manually
- prop `modal`: unclassified type — not proposed, review manually
- prop `drawer`: unclassified type — not proposed, review manually
- prop `panel`: unclassified type — not proposed, review manually
- prop `overlay`: unclassified type — not proposed, review manually
- prop `onShow`: type resolved heuristically — review
- event `onShow`: declared with trigger 'root' — assign the real trigger part once anatomy is authored
- prop `onAfterShow`: type resolved heuristically — review
- event `onAfterShow`: declared with trigger 'root' — assign the real trigger part once anatomy is authored
- prop `onHide`: type resolved heuristically — review
- event `onHide`: declared with trigger 'root' — assign the real trigger part once anatomy is authored
- prop `onAfterHide`: type resolved heuristically — review
- event `onAfterHide`: declared with trigger 'root' — assign the real trigger part once anatomy is authored
- prop `onInitialFocus`: type resolved heuristically — review
- event `onInitialFocus`: declared with trigger 'root' — assign the real trigger part once anatomy is authored
- prop `onRequestClose`: type resolved heuristically — review
- event `onRequestClose`: declared with trigger 'root' — assign the real trigger part once anatomy is authored

## SlDropdown

- source: `extract/pilots/shoelace/custom-elements.json (components/dropdown/dropdown.js)` (cem)
- proposed: 8 props, 4 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- prop `placement`: unclassified type — not proposed, review manually
- prop `sync`: figma binding INFERRED as VARIANT "Sync" — confirm against the design library (reconcile step)
- prop `dependencies`: unclassified type — not proposed, review manually
- prop `popup`: unclassified type — not proposed, review manually
- prop `trigger`: unclassified type — not proposed, review manually
- prop `panel`: unclassified type — not proposed, review manually
- prop `containingElement`: unclassified type — not proposed, review manually
- prop `onShow`: type resolved heuristically — review
- event `onShow`: declared with trigger 'root' — assign the real trigger part once anatomy is authored
- prop `onAfterShow`: type resolved heuristically — review
- event `onAfterShow`: declared with trigger 'root' — assign the real trigger part once anatomy is authored
- prop `onHide`: type resolved heuristically — review
- event `onHide`: declared with trigger 'root' — assign the real trigger part once anatomy is authored
- prop `onAfterHide`: type resolved heuristically — review
- event `onAfterHide`: declared with trigger 'root' — assign the real trigger part once anatomy is authored

## SlFormatBytes

- source: `extract/pilots/shoelace/custom-elements.json (components/format-bytes/format-bytes.js)` (cem)
- proposed: 3 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- prop `unit`: figma binding INFERRED as VARIANT "Unit" — confirm against the design library (reconcile step)
- prop `display`: figma binding INFERRED as VARIANT "Display" — confirm against the design library (reconcile step)

## SlFormatDate

- source: `extract/pilots/shoelace/custom-elements.json (components/format-date/format-date.js)` (cem)
- proposed: 14 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- prop `date`: unclassified type — not proposed, review manually
- prop `weekday`: figma binding INFERRED as VARIANT "Weekday" — confirm against the design library (reconcile step)
- prop `era`: figma binding INFERRED as VARIANT "Era" — confirm against the design library (reconcile step)
- prop `year`: figma binding INFERRED as VARIANT "Year" — confirm against the design library (reconcile step)
- prop `month`: figma binding INFERRED as VARIANT "Month" — confirm against the design library (reconcile step)
- prop `day`: figma binding INFERRED as VARIANT "Day" — confirm against the design library (reconcile step)
- prop `hour`: figma binding INFERRED as VARIANT "Hour" — confirm against the design library (reconcile step)
- prop `minute`: figma binding INFERRED as VARIANT "Minute" — confirm against the design library (reconcile step)
- prop `second`: figma binding INFERRED as VARIANT "Second" — confirm against the design library (reconcile step)
- prop `time-zone-name`: figma binding INFERRED as VARIANT "Time Zone Name" — confirm against the design library (reconcile step)
- prop `hour-format`: figma binding INFERRED as VARIANT "Hour Format" — confirm against the design library (reconcile step)
- prop `timeZoneName`: figma binding INFERRED as VARIANT "Time Zone Name" — confirm against the design library (reconcile step)
- prop `hourFormat`: figma binding INFERRED as VARIANT "Hour Format" — confirm against the design library (reconcile step)

## SlFormatNumber

- source: `extract/pilots/shoelace/custom-elements.json (components/format-number/format-number.js)` (cem)
- proposed: 17 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- prop `type`: figma binding INFERRED as VARIANT "Type" — confirm against the design library (reconcile step)
- prop `currency-display`: figma binding INFERRED as VARIANT "Currency Display" — confirm against the design library (reconcile step)
- prop `currencyDisplay`: figma binding INFERRED as VARIANT "Currency Display" — confirm against the design library (reconcile step)

## SlIcon

- source: `extract/pilots/shoelace/custom-elements.json (components/icon/icon.js)` (cem)
- proposed: 2 props, 2 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- prop `name`: unclassified type — not proposed, review manually
- prop `src`: unclassified type — not proposed, review manually
- prop `onLoad`: type resolved heuristically — review
- event `onLoad`: declared with trigger 'root' — assign the real trigger part once anatomy is authored
- prop `onError`: type resolved heuristically — review
- event `onError`: declared with trigger 'root' — assign the real trigger part once anatomy is authored

## SlIconButton

- source: `extract/pilots/shoelace/custom-elements.json (components/icon-button/icon-button.js)` (cem)
- proposed: 3 props, 2 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- prop `name`: unclassified type — not proposed, review manually
- prop `library`: unclassified type — not proposed, review manually
- prop `src`: unclassified type — not proposed, review manually
- prop `href`: unclassified type — not proposed, review manually
- prop `target`: figma binding INFERRED as VARIANT "Target" — confirm against the design library (reconcile step)
- prop `download`: unclassified type — not proposed, review manually
- prop `dependencies`: unclassified type — not proposed, review manually
- prop `button`: unclassified type — not proposed, review manually
- prop `onBlur`: type resolved heuristically — review
- event `onBlur`: declared with trigger 'root' — assign the real trigger part once anatomy is authored
- prop `onFocus`: type resolved heuristically — review
- event `onFocus`: declared with trigger 'root' — assign the real trigger part once anatomy is authored

## SlImageComparer

- source: `extract/pilots/shoelace/custom-elements.json (components/image-comparer/image-comparer.js)` (cem)
- proposed: 1 props, 1 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- prop `scopedElement`: unclassified type — not proposed, review manually
- prop `base`: unclassified type — not proposed, review manually
- prop `handle`: unclassified type — not proposed, review manually
- prop `onChange`: type resolved heuristically — review
- event `onChange`: declared with trigger 'root' — assign the real trigger part once anatomy is authored

## SlInclude

- source: `extract/pilots/shoelace/custom-elements.json (components/include/include.js)` (cem)
- proposed: 4 props, 2 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- prop `mode`: figma binding INFERRED as VARIANT "Mode" — confirm against the design library (reconcile step)
- prop `onLoad`: type resolved heuristically — review
- event `onLoad`: declared with trigger 'root' — assign the real trigger part once anatomy is authored
- prop `onError`: type resolved heuristically — review
- event `onError`: declared with trigger 'root' — assign the real trigger part once anatomy is authored

## SlInput

- source: `extract/pilots/shoelace/custom-elements.json (components/input/input.js)` (cem)
- proposed: 32 props, 6 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- prop `type`: unclassified type — not proposed, review manually
- prop `size`: figma binding INFERRED as VARIANT "Size" — confirm against the design library (reconcile step)
- prop `min`: unclassified type — not proposed, review manually
- prop `max`: unclassified type — not proposed, review manually
- prop `step`: unclassified type — not proposed, review manually
- prop `autocapitalize`: figma binding INFERRED as VARIANT "Autocapitalize" — confirm against the design library (reconcile step)
- prop `autocorrect`: figma binding INFERRED as VARIANT "Autocorrect" — confirm against the design library (reconcile step)
- prop `enterkeyhint`: figma binding INFERRED as VARIANT "Enterkeyhint" — confirm against the design library (reconcile step)
- prop `inputmode`: figma binding INFERRED as VARIANT "Inputmode" — confirm against the design library (reconcile step)
- prop `dependencies`: unclassified type — not proposed, review manually
- prop `input`: unclassified type — not proposed, review manually
- prop `valueAsDate`: unclassified type — not proposed, review manually
- prop `valueAsNumber`: unclassified type — not proposed, review manually
- prop `validity`: unclassified type — not proposed, review manually
- prop `validationMessage`: unclassified type — not proposed, review manually
- prop `onBlur`: type resolved heuristically — review
- event `onBlur`: declared with trigger 'root' — assign the real trigger part once anatomy is authored
- prop `onChange`: type resolved heuristically — review
- event `onChange`: declared with trigger 'root' — assign the real trigger part once anatomy is authored
- prop `onClear`: type resolved heuristically — review
- event `onClear`: declared with trigger 'root' — assign the real trigger part once anatomy is authored
- prop `onFocus`: type resolved heuristically — review
- event `onFocus`: declared with trigger 'root' — assign the real trigger part once anatomy is authored
- prop `onInput`: type resolved heuristically — review
- event `onInput`: declared with trigger 'root' — assign the real trigger part once anatomy is authored
- prop `onInvalid`: type resolved heuristically — review
- event `onInvalid`: declared with trigger 'root' — assign the real trigger part once anatomy is authored

## SlMenu

- source: `extract/pilots/shoelace/custom-elements.json (components/menu/menu.js)` (cem)
- proposed: 0 props, 1 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- prop `defaultSlot`: unclassified type — not proposed, review manually
- prop `onSelect`: type resolved heuristically — review
- event `onSelect`: declared with trigger 'root' — assign the real trigger part once anatomy is authored

## SlMenuItem

- source: `extract/pilots/shoelace/custom-elements.json (components/menu-item/menu-item.js)` (cem)
- proposed: 5 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- prop `type`: figma binding INFERRED as VARIANT "Type" — confirm against the design library (reconcile step)
- prop `dependencies`: unclassified type — not proposed, review manually
- prop `defaultSlot`: unclassified type — not proposed, review manually
- prop `menuItem`: unclassified type — not proposed, review manually

## SlMenuLabel

- source: `extract/pilots/shoelace/custom-elements.json (components/menu-label/menu-label.js)` (cem)
- proposed: 0 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element

## SlMutationObserver

- source: `extract/pilots/shoelace/custom-elements.json (components/mutation-observer/mutation-observer.js)` (cem)
- proposed: 10 props, 1 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- prop `onMutation`: type resolved heuristically — review
- event `onMutation`: declared with trigger 'root' — assign the real trigger part once anatomy is authored

## SlOption

- source: `extract/pilots/shoelace/custom-elements.json (components/option/option.js)` (cem)
- proposed: 5 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- prop `dependencies`: unclassified type — not proposed, review manually
- prop `defaultSlot`: unclassified type — not proposed, review manually

## SlPopup

- source: `extract/pilots/shoelace/custom-elements.json (components/popup/popup.js)` (cem)
- proposed: 26 props, 1 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- prop `anchor`: unclassified type — not proposed, review manually
- prop `placement`: unclassified type — not proposed, review manually
- prop `strategy`: figma binding INFERRED as VARIANT "Strategy" — confirm against the design library (reconcile step)
- prop `arrow-placement`: figma binding INFERRED as VARIANT "Arrow Placement" — confirm against the design library (reconcile step)
- prop `flip-fallback-strategy`: figma binding INFERRED as VARIANT "Flip Fallback Strategy" — confirm against the design library (reconcile step)
- prop `flipBoundary`: unclassified type — not proposed, review manually
- prop `shiftBoundary`: unclassified type — not proposed, review manually
- prop `auto-size`: figma binding INFERRED as VARIANT "Auto Size" — confirm against the design library (reconcile step)
- prop `sync`: figma binding INFERRED as VARIANT "Sync" — confirm against the design library (reconcile step)
- prop `autoSizeBoundary`: unclassified type — not proposed, review manually
- prop `popup`: unclassified type — not proposed, review manually
- prop `arrowPlacement`: figma binding INFERRED as VARIANT "Arrow Placement" — confirm against the design library (reconcile step)
- prop `flipFallbackStrategy`: figma binding INFERRED as VARIANT "Flip Fallback Strategy" — confirm against the design library (reconcile step)
- prop `autoSize`: figma binding INFERRED as VARIANT "Auto Size" — confirm against the design library (reconcile step)
- prop `onReposition`: type resolved heuristically — review
- event `onReposition`: declared with trigger 'root' — assign the real trigger part once anatomy is authored

## SlProgressBar

- source: `extract/pilots/shoelace/custom-elements.json (components/progress-bar/progress-bar.js)` (cem)
- proposed: 3 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element

## SlProgressRing

- source: `extract/pilots/shoelace/custom-elements.json (components/progress-ring/progress-ring.js)` (cem)
- proposed: 3 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- prop `indicator`: unclassified type — not proposed, review manually

## SlQrCode

- source: `extract/pilots/shoelace/custom-elements.json (components/qr-code/qr-code.js)` (cem)
- proposed: 8 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- prop `error-correction`: figma binding INFERRED as VARIANT "Error Correction" — confirm against the design library (reconcile step)
- prop `canvas`: unclassified type — not proposed, review manually
- prop `errorCorrection`: figma binding INFERRED as VARIANT "Error Correction" — confirm against the design library (reconcile step)

## SlRadio

- source: `extract/pilots/shoelace/custom-elements.json (components/radio/radio.js)` (cem)
- proposed: 4 props, 2 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- prop `size`: figma binding INFERRED as VARIANT "Size" — confirm against the design library (reconcile step)
- prop `dependencies`: unclassified type — not proposed, review manually
- prop `onBlur`: type resolved heuristically — review
- event `onBlur`: declared with trigger 'root' — assign the real trigger part once anatomy is authored
- prop `onFocus`: type resolved heuristically — review
- event `onFocus`: declared with trigger 'root' — assign the real trigger part once anatomy is authored

## SlRadioButton

- source: `extract/pilots/shoelace/custom-elements.json (components/radio-button/radio-button.js)` (cem)
- proposed: 4 props, 2 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- prop `size`: figma binding INFERRED as VARIANT "Size" — confirm against the design library (reconcile step)
- prop `input`: unclassified type — not proposed, review manually
- prop `hiddenInput`: unclassified type — not proposed, review manually
- prop `onBlur`: type resolved heuristically — review
- event `onBlur`: declared with trigger 'root' — assign the real trigger part once anatomy is authored
- prop `onFocus`: type resolved heuristically — review
- event `onFocus`: declared with trigger 'root' — assign the real trigger part once anatomy is authored

## SlRadioGroup

- source: `extract/pilots/shoelace/custom-elements.json (components/radio-group/radio-group.js)` (cem)
- proposed: 9 props, 3 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- prop `size`: figma binding INFERRED as VARIANT "Size" — confirm against the design library (reconcile step)
- prop `dependencies`: unclassified type — not proposed, review manually
- prop `defaultSlot`: unclassified type — not proposed, review manually
- prop `validationInput`: unclassified type — not proposed, review manually
- prop `validity`: unclassified type — not proposed, review manually
- prop `validationMessage`: unclassified type — not proposed, review manually
- prop `onChange`: type resolved heuristically — review
- event `onChange`: declared with trigger 'root' — assign the real trigger part once anatomy is authored
- prop `onInput`: type resolved heuristically — review
- event `onInput`: declared with trigger 'root' — assign the real trigger part once anatomy is authored
- prop `onInvalid`: type resolved heuristically — review
- event `onInvalid`: declared with trigger 'root' — assign the real trigger part once anatomy is authored

## SlRange

- source: `extract/pilots/shoelace/custom-elements.json (components/range/range.js)` (cem)
- proposed: 13 props, 5 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- prop `tooltip`: figma binding INFERRED as VARIANT "Tooltip" — confirm against the design library (reconcile step)
- prop `input`: unclassified type — not proposed, review manually
- prop `output`: unclassified type — not proposed, review manually
- prop `tooltipFormatter`: unclassified type — not proposed, review manually
- prop `validity`: unclassified type — not proposed, review manually
- prop `validationMessage`: unclassified type — not proposed, review manually
- prop `onBlur`: type resolved heuristically — review
- event `onBlur`: declared with trigger 'root' — assign the real trigger part once anatomy is authored
- prop `onChange`: type resolved heuristically — review
- event `onChange`: declared with trigger 'root' — assign the real trigger part once anatomy is authored
- prop `onFocus`: type resolved heuristically — review
- event `onFocus`: declared with trigger 'root' — assign the real trigger part once anatomy is authored
- prop `onInput`: type resolved heuristically — review
- event `onInput`: declared with trigger 'root' — assign the real trigger part once anatomy is authored
- prop `onInvalid`: type resolved heuristically — review
- event `onInvalid`: declared with trigger 'root' — assign the real trigger part once anatomy is authored

## SlRating

- source: `extract/pilots/shoelace/custom-elements.json (components/rating/rating.js)` (cem)
- proposed: 6 props, 2 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- prop `getSymbol`: unclassified type — not proposed, review manually
- prop `dependencies`: unclassified type — not proposed, review manually
- prop `rating`: unclassified type — not proposed, review manually
- prop `onChange`: type resolved heuristically — review
- event `onChange`: declared with trigger 'root' — assign the real trigger part once anatomy is authored
- prop `onHover`: type resolved heuristically — review
- event `onHover`: declared with trigger 'root' — assign the real trigger part once anatomy is authored

## SlRelativeTime

- source: `extract/pilots/shoelace/custom-elements.json (components/relative-time/relative-time.js)` (cem)
- proposed: 3 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- prop `date`: unclassified type — not proposed, review manually
- prop `format`: figma binding INFERRED as VARIANT "Format" — confirm against the design library (reconcile step)
- prop `numeric`: figma binding INFERRED as VARIANT "Numeric" — confirm against the design library (reconcile step)

## SlResizeObserver

- source: `extract/pilots/shoelace/custom-elements.json (components/resize-observer/resize-observer.js)` (cem)
- proposed: 1 props, 1 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- prop `onResize`: type resolved heuristically — review
- event `onResize`: declared with trigger 'root' — assign the real trigger part once anatomy is authored

## SlSelect

- source: `extract/pilots/shoelace/custom-elements.json (components/select/select.js)` (cem)
- proposed: 19 props, 10 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- prop `value`: unclassified type — not proposed, review manually
- prop `size`: figma binding INFERRED as VARIANT "Size" — confirm against the design library (reconcile step)
- prop `placement`: figma binding INFERRED as VARIANT "Placement" — confirm against the design library (reconcile step)
- prop `getTag`: unclassified type — not proposed, review manually
- prop `dependencies`: unclassified type — not proposed, review manually
- prop `popup`: unclassified type — not proposed, review manually
- prop `combobox`: unclassified type — not proposed, review manually
- prop `displayInput`: unclassified type — not proposed, review manually
- prop `valueInput`: unclassified type — not proposed, review manually
- prop `listbox`: unclassified type — not proposed, review manually
- prop `currentOption`: unclassified type — not proposed, review manually
- prop `selectedOptions`: unclassified type — not proposed, review manually
- prop `defaultValue`: unclassified type — not proposed, review manually
- prop `validity`: unclassified type — not proposed, review manually
- prop `validationMessage`: unclassified type — not proposed, review manually
- prop `onChange`: type resolved heuristically — review
- event `onChange`: declared with trigger 'root' — assign the real trigger part once anatomy is authored
- prop `onClear`: type resolved heuristically — review
- event `onClear`: declared with trigger 'root' — assign the real trigger part once anatomy is authored
- prop `onInput`: type resolved heuristically — review
- event `onInput`: declared with trigger 'root' — assign the real trigger part once anatomy is authored
- prop `onFocus`: type resolved heuristically — review
- event `onFocus`: declared with trigger 'root' — assign the real trigger part once anatomy is authored
- prop `onBlur`: type resolved heuristically — review
- event `onBlur`: declared with trigger 'root' — assign the real trigger part once anatomy is authored
- prop `onShow`: type resolved heuristically — review
- event `onShow`: declared with trigger 'root' — assign the real trigger part once anatomy is authored
- prop `onAfterShow`: type resolved heuristically — review
- event `onAfterShow`: declared with trigger 'root' — assign the real trigger part once anatomy is authored
- prop `onHide`: type resolved heuristically — review
- event `onHide`: declared with trigger 'root' — assign the real trigger part once anatomy is authored
- prop `onAfterHide`: type resolved heuristically — review
- event `onAfterHide`: declared with trigger 'root' — assign the real trigger part once anatomy is authored
- prop `onInvalid`: type resolved heuristically — review
- event `onInvalid`: declared with trigger 'root' — assign the real trigger part once anatomy is authored

## SlSkeleton

- source: `extract/pilots/shoelace/custom-elements.json (components/skeleton/skeleton.js)` (cem)
- proposed: 1 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- prop `effect`: figma binding INFERRED as VARIANT "Effect" — confirm against the design library (reconcile step)

## SlSpinner

- source: `extract/pilots/shoelace/custom-elements.json (components/spinner/spinner.js)` (cem)
- proposed: 0 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element

## SlSplitPanel

- source: `extract/pilots/shoelace/custom-elements.json (components/split-panel/split-panel.js)` (cem)
- proposed: 8 props, 1 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- prop `primary`: figma binding INFERRED as VARIANT "Primary" — confirm against the design library (reconcile step)
- prop `snap`: unclassified type — not proposed, review manually
- prop `divider`: unclassified type — not proposed, review manually
- prop `onReposition`: type resolved heuristically — review
- event `onReposition`: declared with trigger 'root' — assign the real trigger part once anatomy is authored

## SlSwitch

- source: `extract/pilots/shoelace/custom-elements.json (components/switch/switch.js)` (cem)
- proposed: 11 props, 5 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- prop `size`: figma binding INFERRED as VARIANT "Size" — confirm against the design library (reconcile step)
- prop `input`: unclassified type — not proposed, review manually
- prop `validity`: unclassified type — not proposed, review manually
- prop `validationMessage`: unclassified type — not proposed, review manually
- prop `onBlur`: type resolved heuristically — review
- event `onBlur`: declared with trigger 'root' — assign the real trigger part once anatomy is authored
- prop `onChange`: type resolved heuristically — review
- event `onChange`: declared with trigger 'root' — assign the real trigger part once anatomy is authored
- prop `onInput`: type resolved heuristically — review
- event `onInput`: declared with trigger 'root' — assign the real trigger part once anatomy is authored
- prop `onFocus`: type resolved heuristically — review
- event `onFocus`: declared with trigger 'root' — assign the real trigger part once anatomy is authored
- prop `onInvalid`: type resolved heuristically — review
- event `onInvalid`: declared with trigger 'root' — assign the real trigger part once anatomy is authored

## SlTab

- source: `extract/pilots/shoelace/custom-elements.json (components/tab/tab.js)` (cem)
- proposed: 4 props, 1 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- prop `dependencies`: unclassified type — not proposed, review manually
- prop `tab`: unclassified type — not proposed, review manually
- prop `onClose`: type resolved heuristically — review
- event `onClose`: declared with trigger 'root' — assign the real trigger part once anatomy is authored

## SlTabGroup

- source: `extract/pilots/shoelace/custom-elements.json (components/tab-group/tab-group.js)` (cem)
- proposed: 6 props, 2 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- prop `placement`: figma binding INFERRED as VARIANT "Placement" — confirm against the design library (reconcile step)
- prop `activation`: figma binding INFERRED as VARIANT "Activation" — confirm against the design library (reconcile step)
- prop `dependencies`: unclassified type — not proposed, review manually
- prop `tabGroup`: unclassified type — not proposed, review manually
- prop `body`: unclassified type — not proposed, review manually
- prop `nav`: unclassified type — not proposed, review manually
- prop `indicator`: unclassified type — not proposed, review manually
- prop `onTabShow`: type resolved heuristically — review
- event `onTabShow`: declared with trigger 'root' — assign the real trigger part once anatomy is authored
- prop `onTabHide`: type resolved heuristically — review
- event `onTabHide`: declared with trigger 'root' — assign the real trigger part once anatomy is authored

## SlTabPanel

- source: `extract/pilots/shoelace/custom-elements.json (components/tab-panel/tab-panel.js)` (cem)
- proposed: 2 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element

## SlTag

- source: `extract/pilots/shoelace/custom-elements.json (components/tag/tag.js)` (cem)
- proposed: 4 props, 1 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- prop `variant`: figma binding INFERRED as VARIANT "Variant" — confirm against the design library (reconcile step)
- prop `size`: figma binding INFERRED as VARIANT "Size" — confirm against the design library (reconcile step)
- prop `dependencies`: unclassified type — not proposed, review manually
- prop `onRemove`: type resolved heuristically — review
- event `onRemove`: declared with trigger 'root' — assign the real trigger part once anatomy is authored

## SlTextarea

- source: `extract/pilots/shoelace/custom-elements.json (components/textarea/textarea.js)` (cem)
- proposed: 25 props, 5 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- prop `size`: figma binding INFERRED as VARIANT "Size" — confirm against the design library (reconcile step)
- prop `resize`: figma binding INFERRED as VARIANT "Resize" — confirm against the design library (reconcile step)
- prop `autocapitalize`: figma binding INFERRED as VARIANT "Autocapitalize" — confirm against the design library (reconcile step)
- prop `enterkeyhint`: figma binding INFERRED as VARIANT "Enterkeyhint" — confirm against the design library (reconcile step)
- prop `inputmode`: figma binding INFERRED as VARIANT "Inputmode" — confirm against the design library (reconcile step)
- prop `input`: unclassified type — not proposed, review manually
- prop `sizeAdjuster`: unclassified type — not proposed, review manually
- prop `validity`: unclassified type — not proposed, review manually
- prop `validationMessage`: unclassified type — not proposed, review manually
- prop `onBlur`: type resolved heuristically — review
- event `onBlur`: declared with trigger 'root' — assign the real trigger part once anatomy is authored
- prop `onChange`: type resolved heuristically — review
- event `onChange`: declared with trigger 'root' — assign the real trigger part once anatomy is authored
- prop `onFocus`: type resolved heuristically — review
- event `onFocus`: declared with trigger 'root' — assign the real trigger part once anatomy is authored
- prop `onInput`: type resolved heuristically — review
- event `onInput`: declared with trigger 'root' — assign the real trigger part once anatomy is authored
- prop `onInvalid`: type resolved heuristically — review
- event `onInvalid`: declared with trigger 'root' — assign the real trigger part once anatomy is authored

## SlTooltip

- source: `extract/pilots/shoelace/custom-elements.json (components/tooltip/tooltip.js)` (cem)
- proposed: 7 props, 4 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- prop `placement`: unclassified type — not proposed, review manually
- prop `dependencies`: unclassified type — not proposed, review manually
- prop `defaultSlot`: unclassified type — not proposed, review manually
- prop `body`: unclassified type — not proposed, review manually
- prop `popup`: unclassified type — not proposed, review manually
- prop `onShow`: type resolved heuristically — review
- event `onShow`: declared with trigger 'root' — assign the real trigger part once anatomy is authored
- prop `onAfterShow`: type resolved heuristically — review
- event `onAfterShow`: declared with trigger 'root' — assign the real trigger part once anatomy is authored
- prop `onHide`: type resolved heuristically — review
- event `onHide`: declared with trigger 'root' — assign the real trigger part once anatomy is authored
- prop `onAfterHide`: type resolved heuristically — review
- event `onAfterHide`: declared with trigger 'root' — assign the real trigger part once anatomy is authored

## SlTree

- source: `extract/pilots/shoelace/custom-elements.json (components/tree/tree.js)` (cem)
- proposed: 1 props, 1 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- prop `selection`: figma binding INFERRED as VARIANT "Selection" — confirm against the design library (reconcile step)
- prop `defaultSlot`: unclassified type — not proposed, review manually
- prop `expandedIconSlot`: unclassified type — not proposed, review manually
- prop `collapsedIconSlot`: unclassified type — not proposed, review manually
- prop `onSelectionChange`: type resolved heuristically — review
- event `onSelectionChange`: declared with trigger 'root' — assign the real trigger part once anatomy is authored

## SlTreeItem

- source: `extract/pilots/shoelace/custom-elements.json (components/tree-item/tree-item.js)` (cem)
- proposed: 8 props, 6 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- prop `dependencies`: unclassified type — not proposed, review manually
- prop `defaultSlot`: unclassified type — not proposed, review manually
- prop `childrenSlot`: unclassified type — not proposed, review manually
- prop `itemElement`: unclassified type — not proposed, review manually
- prop `childrenContainer`: unclassified type — not proposed, review manually
- prop `expandButtonSlot`: unclassified type — not proposed, review manually
- prop `onExpand`: type resolved heuristically — review
- event `onExpand`: declared with trigger 'root' — assign the real trigger part once anatomy is authored
- prop `onAfterExpand`: type resolved heuristically — review
- event `onAfterExpand`: declared with trigger 'root' — assign the real trigger part once anatomy is authored
- prop `onCollapse`: type resolved heuristically — review
- event `onCollapse`: declared with trigger 'root' — assign the real trigger part once anatomy is authored
- prop `onAfterCollapse`: type resolved heuristically — review
- event `onAfterCollapse`: declared with trigger 'root' — assign the real trigger part once anatomy is authored
- prop `onLazyChange`: type resolved heuristically — review
- event `onLazyChange`: declared with trigger 'root' — assign the real trigger part once anatomy is authored
- prop `onLazyLoad`: type resolved heuristically — review
- event `onLazyLoad`: declared with trigger 'root' — assign the real trigger part once anatomy is authored

## SlVisuallyHidden

- source: `extract/pilots/shoelace/custom-elements.json (components/visually-hidden/visually-hidden.js)` (cem)
- proposed: 0 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element

