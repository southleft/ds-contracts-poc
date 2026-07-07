# Reconciliation — where your two surfaces disagree

**28/58** code components matched a design component by name. Across matched pairs: **42** properties agree, **236** need a human decision. Each disagreement below is a reconciliation-workshop line item: decide code-is-right, design-is-right, or neither — the decisions become contract v1 (docs/11 Phase 2).

## SlAlert ⇄ Alert

- agrees on 2/8 properties
- ⚠️ **open** — code only: boolean — no matching design property
- ⚠️ **countdown** — code only: enum [rtl, ltr] — no matching design property
- ⚠️ **showTitle** — design only: no matching code prop
- ⚠️ **showIcon** — design only: no matching code prop
- ⚠️ **alert** — design only: no matching code prop — a design TEXT property with no code counterpart is often bound to React `children` (invisible in a props interface); confirm before treating as drift
- ⚠️ **alertTitle** — design only: no matching code prop — a design TEXT property with no code counterpart is often bound to React `children` (invisible in a props interface); confirm before treating as drift

## SlAvatar ⇄ Avatar

- agrees on 2/6 properties
- ⚠️ **image** — code only: string — no matching design property
- ⚠️ **label** — code only: string — no matching design property
- ⚠️ **loading** — code only: enum [eager, lazy] — no matching design property
- ⚠️ **type** — design only: variant [default, initials, image] — no matching code prop

## SlBadge ⇄ Badge

- agrees on 0/3 properties
- ⚠️ **variant** — code only: enum [primary, success, neutral, warning, danger] — no matching design property
- ⚠️ **pill** — code only: boolean — no matching design property
- ⚠️ **pulse** — code only: boolean — no matching design property

## SlBreadcrumb ⇄ Breadcrumb

- agrees on 0/1 properties
- ⚠️ **label** — code only: string — no matching design property

## SlBreadcrumbItem ⇄ _Breadcrumb item

- agrees on 0/7 properties
- ⚠️ **target** — code only: enum [_blank, _parent, _self, _top] — no matching design property
- ⚠️ **rel** — code only: string — no matching design property
- ⚠️ **isLink** — design only: variant [false, true] — no matching code prop
- ⚠️ **showPrexix** — design only: no matching code prop
- ⚠️ **showSeparator** — design only: no matching code prop
- ⚠️ **showSuffix** — design only: no matching code prop
- ⚠️ **label** — design only: no matching code prop — a design TEXT property with no code counterpart is often bound to React `children` (invisible in a props interface); confirm before treating as drift

## SlButton ⇄ Button

- agrees on 5/30 properties
- ⚠️ **title** — code only: string — no matching design property
- ⚠️ **caret** — code only: boolean — no matching design property
- ⚠️ **disabled** — code only: boolean — no matching design property
- ⚠️ **loading** — code only: boolean — no matching design property
- ⚠️ **type** — code only: enum [button, submit, reset] — no matching design property
- ⚠️ **name** — code only: string — no matching design property
- ⚠️ **value** — code only: string — no matching design property
- ⚠️ **href** — code only: string — no matching design property
- ⚠️ **target** — code only: enum [_blank, _parent, _self, _top] — no matching design property
- ⚠️ **rel** — code only: string — no matching design property
- ⚠️ **form** — code only: string — no matching design property
- ⚠️ **formaction** — code only: string — no matching design property
- ⚠️ **formenctype** — code only: enum [application/x-www-form-urlencoded, multipart/form-data, text/plain] — no matching design property
- ⚠️ **formmethod** — code only: enum [post, get] — no matching design property
- ⚠️ **formnovalidate** — code only: boolean — no matching design property
- ⚠️ **invalid** — code only: boolean — no matching design property
- ⚠️ **formAction** — code only: string — no matching design property
- ⚠️ **formEnctype** — code only: enum [application/x-www-form-urlencoded, multipart/form-data, text/plain] — no matching design property
- ⚠️ **formMethod** — code only: enum [post, get] — no matching design property
- ⚠️ **formNoValidate** — code only: boolean — no matching design property
- ⚠️ **state** — design only: variant [default, hover, active, disabled, focus, deafult] — no matching code prop
- ⚠️ **showLabel** — design only: no matching code prop
- ⚠️ **showSuffix** — design only: no matching code prop
- ⚠️ **showPrefix** — design only: no matching code prop
- ⚠️ **label** — design only: no matching code prop — a design TEXT property with no code counterpart is often bound to React `children` (invisible in a props interface); confirm before treating as drift

## SlButtonGroup ⇄ Button group

- agrees on 0/7 properties
- ⚠️ **label** — code only: string — no matching design property
- ⚠️ **disableRole** — code only: boolean — no matching design property
- ⚠️ **position** — design only: variant [left, center, right, position4] — no matching code prop
- ⚠️ **size** — design only: variant [large, small, medium] — no matching code prop
- ⚠️ **type** — design only: variant [default, primary] — no matching code prop
- ⚠️ **isPill** — design only: variant [false, true] — no matching code prop
- ⚠️ **isPill** — design only: no matching code prop

## SlCheckbox ⇄ Checkbox

- agrees on 4/14 properties
- ⚠️ **title** — code only: string — no matching design property
- ⚠️ **name** — code only: string — no matching design property
- ⚠️ **disabled** — code only: boolean — no matching design property
- ⚠️ **form** — code only: string — no matching design property
- ⚠️ **required** — code only: boolean — no matching design property
- ⚠️ **help-text** — code only: string — no matching design property
- ⚠️ **defaultChecked** — code only: boolean — no matching design property
- ⚠️ **helpText** — code only: string — no matching design property
- ⚠️ **state** — design only: variant [default, disabled, hover] — no matching code prop
- ⚠️ **showValue** — design only: no matching code prop

## SlDetails ⇄ Details

- agrees on 3/3 properties

## SlDialog ⇄ Dialog

- agrees on 0/5 properties
- ⚠️ **open** — code only: boolean — no matching design property
- ⚠️ **label** — code only: string — no matching design property
- ⚠️ **no-header** — code only: boolean — no matching design property
- ⚠️ **noHeader** — code only: boolean — no matching design property
- ⚠️ **title** — design only: no matching code prop — a design TEXT property with no code counterpart is often bound to React `children` (invisible in a props interface); confirm before treating as drift

## SlDivider ⇄ Divider

- agrees on 1/1 properties

## SlDrawer ⇄ Drawer

- agrees on 1/8 properties
- ⚠️ **open** — code only: boolean — no matching design property
- ⚠️ **label** — code only: string — no matching design property
- ⚠️ **contained** — code only: boolean — no matching design property
- ⚠️ **no-header** — code only: boolean — no matching design property
- ⚠️ **noHeader** — code only: boolean — no matching design property
- ⚠️ **showDrawer** — design only: no matching code prop
- ⚠️ **title** — design only: no matching code prop — a design TEXT property with no code counterpart is often bound to React `children` (invisible in a props interface); confirm before treating as drift

## SlDropdown ⇄ Dropdown

- agrees on 0/8 properties
- ⚠️ **open** — code only: boolean — no matching design property
- ⚠️ **disabled** — code only: boolean — no matching design property
- ⚠️ **stay-open-on-select** — code only: boolean — no matching design property
- ⚠️ **distance** — code only: number — no matching design property
- ⚠️ **skidding** — code only: number — no matching design property
- ⚠️ **hoist** — code only: boolean — no matching design property
- ⚠️ **sync** — code only: enum [width, height, both] — no matching design property
- ⚠️ **stayOpenOnSelect** — code only: boolean — no matching design property

## SlIcon ⇄ Icon

- agrees on 0/6 properties
- ⚠️ **label** — code only: string — no matching design property
- ⚠️ **library** — code only: string — no matching design property
- ⚠️ **variant** — design only: variant [material] — no matching code prop
- ⚠️ **size** — design only: variant [medium, small, large, x-large] — no matching code prop
- ⚠️ **state** — design only: variant [default, hover, active, disabled] — no matching code prop
- ⚠️ **icon** — design only: no matching code prop — a design TEXT property with no code counterpart is often bound to React `children` (invisible in a props interface); confirm before treating as drift

## SlImageComparer ⇄ Image Comparer

- agrees on 0/2 properties
- ⚠️ **position** — code only: number — no matching design property
- ⚠️ **position** — design only: variant [middle, left, right] — no matching code prop

## SlInput ⇄ input

- agrees on 6/41 properties
- ⚠️ **title** — code only: string — no matching design property
- ⚠️ **name** — code only: string — no matching design property
- ⚠️ **filled** — code only: boolean — no matching design property
- ⚠️ **clearable** — code only: boolean — no matching design property
- ⚠️ **disabled** — code only: boolean — no matching design property
- ⚠️ **placeholder** — code only: string — no matching design property
- ⚠️ **readonly** — code only: boolean — no matching design property
- ⚠️ **password-toggle** — code only: boolean — no matching design property
- ⚠️ **password-visible** — code only: boolean — no matching design property
- ⚠️ **no-spin-buttons** — code only: boolean — no matching design property
- ⚠️ **form** — code only: string — no matching design property
- ⚠️ **required** — code only: boolean — no matching design property
- ⚠️ **pattern** — code only: string — no matching design property
- ⚠️ **minlength** — code only: number — no matching design property
- ⚠️ **maxlength** — code only: number — no matching design property
- ⚠️ **autocapitalize** — code only: enum [off, none, on, sentences, words, characters] — no matching design property
- ⚠️ **autocorrect** — code only: enum [off, on] — no matching design property
- ⚠️ **autocomplete** — code only: string — no matching design property
- ⚠️ **autofocus** — code only: boolean — no matching design property
- ⚠️ **enterkeyhint** — code only: enum [enter, done, go, next, previous, search, send] — no matching design property
- ⚠️ **spellcheck** — code only: boolean — no matching design property
- ⚠️ **inputmode** — code only: enum [none, text, decimal, numeric, tel, search, email, url] — no matching design property
- ⚠️ **defaultValue** — code only: string — no matching design property
- ⚠️ **passwordToggle** — code only: boolean — no matching design property
- ⚠️ **passwordVisible** — code only: boolean — no matching design property
- ⚠️ **noSpinButtons** — code only: boolean — no matching design property
- ⚠️ **state** — design only: variant [default, disabled, hover, focus] — no matching code prop
- ⚠️ **alignement** — design only: variant [vertical, horizontal] — no matching code prop
- ⚠️ **display** — design only: variant [placeholder, content] — no matching code prop
- ⚠️ **variant** — design only: variant [default] — no matching code prop
- ⚠️ **showHelp** — design only: no matching code prop
- ⚠️ **showLabel** — design only: no matching code prop
- ⚠️ **showValue** — design only: no matching code prop
- ⚠️ **showSuffix** — design only: no matching code prop
- ⚠️ **showPrefix** — design only: no matching code prop

## SlMenu ⇄ Menu

- agrees on 0/1 properties
- ⚠️ **variant** — design only: variant [prefilled, empty] — no matching code prop

## SlMenuItem ⇄ Menu Item

- agrees on 0/10 properties
- ⚠️ **type** — code only: enum [normal, checkbox] — no matching design property
- ⚠️ **checked** — code only: boolean — no matching design property
- ⚠️ **value** — code only: string — no matching design property
- ⚠️ **loading** — code only: boolean — no matching design property
- ⚠️ **disabled** — code only: boolean — no matching design property
- ⚠️ **isSelected** — design only: variant [false, true] — no matching code prop
- ⚠️ **state** — design only: variant [default, hover, active, disabled] — no matching code prop
- ⚠️ **showSuffix** — design only: no matching code prop
- ⚠️ **showPrefix** — design only: no matching code prop
- ⚠️ **label** — design only: no matching code prop — a design TEXT property with no code counterpart is often bound to React `children` (invisible in a props interface); confirm before treating as drift

## SlRadio ⇄ Radio

- agrees on 2/7 properties
- ⚠️ **disabled** — code only: boolean — no matching design property
- ⚠️ **checked** — code only: boolean — no matching design property
- ⚠️ **isCheched** — design only: variant [false, true] — no matching code prop
- ⚠️ **state** — design only: variant [default, hover, disabled] — no matching code prop
- ⚠️ **showValue** — design only: no matching code prop

## SlRadioGroup ⇄ radio group

- agrees on 4/13 properties
- ⚠️ **name** — code only: string — no matching design property
- ⚠️ **value** — code only: string — no matching design property
- ⚠️ **form** — code only: string — no matching design property
- ⚠️ **required** — code only: boolean — no matching design property
- ⚠️ **defaultValue** — code only: string — no matching design property
- ⚠️ **variant** — design only: variant [default] — no matching code prop
- ⚠️ **direction** — design only: variant [vertical, horizontal] — no matching code prop
- ⚠️ **showLabel** — design only: no matching code prop
- ⚠️ **showHelp** — design only: no matching code prop

## SlRange ⇄ Range

- agrees on 3/17 properties
- ⚠️ **title** — code only: string — no matching design property
- ⚠️ **name** — code only: string — no matching design property
- ⚠️ **value** — code only: number — no matching design property
- ⚠️ **disabled** — code only: boolean — no matching design property
- ⚠️ **min** — code only: number — no matching design property
- ⚠️ **max** — code only: number — no matching design property
- ⚠️ **step** — code only: number — no matching design property
- ⚠️ **tooltip** — code only: enum [top, bottom, none] — no matching design property
- ⚠️ **form** — code only: string — no matching design property
- ⚠️ **defaultValue** — code only: number — no matching design property
- ⚠️ **state** — design only: variant [default, disabled, hover] — no matching code prop
- ⚠️ **showTooltip** — design only: no matching code prop
- ⚠️ **showHelp** — design only: no matching code prop
- ⚠️ **showLabel** — design only: no matching code prop

## SlSelect ⇄ select

- agrees on 0/20 properties
- ⚠️ **name** — code only: string — no matching design property
- ⚠️ **size** — code only: enum [small, medium, large] — no matching design property
- ⚠️ **placeholder** — code only: string — no matching design property
- ⚠️ **multiple** — code only: boolean — no matching design property
- ⚠️ **max-options-visible** — code only: number — no matching design property
- ⚠️ **disabled** — code only: boolean — no matching design property
- ⚠️ **clearable** — code only: boolean — no matching design property
- ⚠️ **open** — code only: boolean — no matching design property
- ⚠️ **hoist** — code only: boolean — no matching design property
- ⚠️ **filled** — code only: boolean — no matching design property
- ⚠️ **pill** — code only: boolean — no matching design property
- ⚠️ **label** — code only: string — no matching design property
- ⚠️ **placement** — code only: enum [top, bottom] — no matching design property
- ⚠️ **help-text** — code only: string — no matching design property
- ⚠️ **form** — code only: string — no matching design property
- ⚠️ **required** — code only: boolean — no matching design property
- ⚠️ **displayLabel** — code only: string — no matching design property
- ⚠️ **maxOptionsVisible** — code only: number — no matching design property
- ⚠️ **helpText** — code only: string — no matching design property
- ⚠️ **Property 1** — design only: variant [Default] — no matching code prop

## SlSkeleton ⇄ Skeleton

- agrees on 0/2 properties
- ⚠️ **effect** — code only: enum [pulse, sheen, none] — no matching design property
- ⚠️ **type** — design only: variant [text, avatar-square, avatar-rounded, avatar-pill] — no matching code prop

## SlTab ⇄ Tab

- agrees on 1/8 properties
- ⚠️ **panel** — code only: string — no matching design property
- ⚠️ **active** — code only: boolean — no matching design property
- ⚠️ **disabled** — code only: boolean — no matching design property
- ⚠️ **state** — design only: variant [active, default, disabled] — no matching code prop
- ⚠️ **showBorder** — design only: variant [true, false] — no matching code prop
- ⚠️ **placement** — design only: variant [top, none, bottom, start, end] — no matching code prop
- ⚠️ **tab** — design only: no matching code prop — a design TEXT property with no code counterpart is often bound to React `children` (invisible in a props interface); confirm before treating as drift

## SlTabGroup ⇄ Tab Group

- agrees on 1/6 properties
- ⚠️ **activation** — code only: enum [auto, manual] — no matching design property
- ⚠️ **no-scroll-controls** — code only: boolean — no matching design property
- ⚠️ **fixed-scroll-controls** — code only: boolean — no matching design property
- ⚠️ **noScrollControls** — code only: boolean — no matching design property
- ⚠️ **fixedScrollControls** — code only: boolean — no matching design property

## SlTag ⇄ Tag

- agrees on 3/5 properties
- ⚠️ **variant / variant** — option sets differ: code [primary, success, neutral, warning, danger, text] vs design [primary, success, neutral, warning, danger]
- ⚠️ **label** — design only: no matching code prop — a design TEXT property with no code counterpart is often bound to React `children` (invisible in a props interface); confirm before treating as drift

## SlTextarea ⇄ Textarea

- agrees on 4/29 properties
- ⚠️ **title** — code only: string — no matching design property
- ⚠️ **name** — code only: string — no matching design property
- ⚠️ **size / size** — option sets differ: code [small, medium, large] vs design [medium]
- ⚠️ **filled** — code only: boolean — no matching design property
- ⚠️ **placeholder** — code only: string — no matching design property
- ⚠️ **rows** — code only: number — no matching design property
- ⚠️ **resize** — code only: enum [none, vertical, auto] — no matching design property
- ⚠️ **disabled** — code only: boolean — no matching design property
- ⚠️ **readonly** — code only: boolean — no matching design property
- ⚠️ **form** — code only: string — no matching design property
- ⚠️ **required** — code only: boolean — no matching design property
- ⚠️ **minlength** — code only: number — no matching design property
- ⚠️ **maxlength** — code only: number — no matching design property
- ⚠️ **autocapitalize** — code only: enum [off, none, on, sentences, words, characters] — no matching design property
- ⚠️ **autocorrect** — code only: string — no matching design property
- ⚠️ **autocomplete** — code only: string — no matching design property
- ⚠️ **autofocus** — code only: boolean — no matching design property
- ⚠️ **enterkeyhint** — code only: enum [enter, done, go, next, previous, search, send] — no matching design property
- ⚠️ **spellcheck** — code only: boolean — no matching design property
- ⚠️ **inputmode** — code only: enum [none, text, decimal, numeric, tel, search, email, url] — no matching design property
- ⚠️ **defaultValue** — code only: string — no matching design property
- ⚠️ **state** — design only: variant [default, filled, disabled] — no matching code prop
- ⚠️ **showLabel** — design only: no matching code prop
- ⚠️ **showHelp** — design only: no matching code prop
- ⚠️ **isResizable** — design only: no matching code prop

## SlTooltip ⇄ Tooltip

- agrees on 0/10 properties
- ⚠️ **content** — code only: string — no matching design property
- ⚠️ **disabled** — code only: boolean — no matching design property
- ⚠️ **distance** — code only: number — no matching design property
- ⚠️ **open** — code only: boolean — no matching design property
- ⚠️ **skidding** — code only: number — no matching design property
- ⚠️ **trigger** — code only: string — no matching design property
- ⚠️ **hoist** — code only: boolean — no matching design property
- ⚠️ **placement** — design only: variant [bottom, bottomLeft, bottomRight, left, right, topLeft, topRight, top] — no matching code prop
- ⚠️ **text** — design only: no matching code prop — a design TEXT property with no code counterpart is often bound to React `children` (invisible in a props interface); confirm before treating as drift
- ⚠️ **Text** — design only: no matching code prop — a design TEXT property with no code counterpart is often bound to React `children` (invisible in a props interface); confirm before treating as drift

## Components in code with no design counterpart

- SlAnimatedImage (`extract/pilots/shoelace/custom-elements.json (components/animated-image/animated-image.js)`)
- SlAnimation (`extract/pilots/shoelace/custom-elements.json (components/animation/animation.js)`)
- SlCard (`extract/pilots/shoelace/custom-elements.json (components/card/card.js)`)
- SlCarousel (`extract/pilots/shoelace/custom-elements.json (components/carousel/carousel.js)`)
- SlCarouselItem (`extract/pilots/shoelace/custom-elements.json (components/carousel-item/carousel-item.js)`)
- SlColorPicker (`extract/pilots/shoelace/custom-elements.json (components/color-picker/color-picker.js)`)
- SlCopyButton (`extract/pilots/shoelace/custom-elements.json (components/copy-button/copy-button.js)`)
- SlFormatBytes (`extract/pilots/shoelace/custom-elements.json (components/format-bytes/format-bytes.js)`)
- SlFormatDate (`extract/pilots/shoelace/custom-elements.json (components/format-date/format-date.js)`)
- SlFormatNumber (`extract/pilots/shoelace/custom-elements.json (components/format-number/format-number.js)`)
- SlIconButton (`extract/pilots/shoelace/custom-elements.json (components/icon-button/icon-button.js)`)
- SlInclude (`extract/pilots/shoelace/custom-elements.json (components/include/include.js)`)
- SlMenuLabel (`extract/pilots/shoelace/custom-elements.json (components/menu-label/menu-label.js)`)
- SlMutationObserver (`extract/pilots/shoelace/custom-elements.json (components/mutation-observer/mutation-observer.js)`)
- SlOption (`extract/pilots/shoelace/custom-elements.json (components/option/option.js)`)
- SlPopup (`extract/pilots/shoelace/custom-elements.json (components/popup/popup.js)`)
- SlProgressBar (`extract/pilots/shoelace/custom-elements.json (components/progress-bar/progress-bar.js)`)
- SlProgressRing (`extract/pilots/shoelace/custom-elements.json (components/progress-ring/progress-ring.js)`)
- SlQrCode (`extract/pilots/shoelace/custom-elements.json (components/qr-code/qr-code.js)`)
- SlRadioButton (`extract/pilots/shoelace/custom-elements.json (components/radio-button/radio-button.js)`)
- SlRating (`extract/pilots/shoelace/custom-elements.json (components/rating/rating.js)`)
- SlRelativeTime (`extract/pilots/shoelace/custom-elements.json (components/relative-time/relative-time.js)`)
- SlResizeObserver (`extract/pilots/shoelace/custom-elements.json (components/resize-observer/resize-observer.js)`)
- SlSpinner (`extract/pilots/shoelace/custom-elements.json (components/spinner/spinner.js)`)
- SlSplitPanel (`extract/pilots/shoelace/custom-elements.json (components/split-panel/split-panel.js)`)
- SlSwitch (`extract/pilots/shoelace/custom-elements.json (components/switch/switch.js)`)
- SlTabPanel (`extract/pilots/shoelace/custom-elements.json (components/tab-panel/tab-panel.js)`)
- SlTree (`extract/pilots/shoelace/custom-elements.json (components/tree/tree.js)`)
- SlTreeItem (`extract/pilots/shoelace/custom-elements.json (components/tree-item/tree-item.js)`)
- SlVisuallyHidden (`extract/pilots/shoelace/custom-elements.json (components/visually-hidden/visually-hidden.js)`)

## Components in design with no code counterpart

- Slot
- _Image Comparer Handler
- Menu submenu
- Menu title
- radio group button
- _ellipse
- _demo / header
- Color Swatch

