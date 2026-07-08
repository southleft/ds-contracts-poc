# Reconciliation — where your two surfaces disagree

**31/53** code components matched a design component by name. Across matched pairs: **27** properties agree, **220** need a human decision. Each disagreement below is a reconciliation-workshop line item: decide code-is-right, design-is-right, or neither — the decisions become contract v1 (docs/11 Phase 2).

## Accordion ⇄ Accordion

- agrees on 2/11 properties
- ⚠️ **intro** — code only: string — no matching design property
- ⚠️ **value** — code only: string — no matching design property
- ⚠️ **defaultValue** — code only: string — no matching design property
- ⚠️ **breakpoint** — design only: variant [sm, lg] — no matching code prop
- ⚠️ **state** — design only: variant [default, hover, focused] — no matching code prop
- ⚠️ **isExpanded** — design only: variant [false, true] — no matching code prop
- ⚠️ **hasImage** — design only: no matching code prop
- ⚠️ **hasIntro** — design only: no matching code prop
- ⚠️ **hasSlot** — design only: no matching code prop

## Alert ⇄ Alert

- agrees on 3/9 properties
- ⚠️ **withIcon** — code only: boolean — no matching design property
- ⚠️ **hasIcon** — design only: no matching code prop
- ⚠️ **hasLink** — design only: no matching code prop
- ⚠️ **hasTitle** — design only: no matching code prop
- ⚠️ **hasClose** — design only: no matching code prop
- ⚠️ **descriptionText** — design only: no matching code prop — a design TEXT property with no code counterpart is often bound to React `children` (invisible in a props interface); confirm before treating as drift

## AvatarGroup ⇄ Avatar group

- agrees on 1/6 properties
- ⚠️ **indicator** — code only: string — no matching design property
- ⚠️ **message** — code only: string — no matching design property
- ⚠️ **showMessage** — code only: boolean — no matching design property
- ⚠️ **avatarsToDisplay** — code only: number — no matching design property
- ⚠️ **breakpoint** — design only: variant [sm, lg] — no matching code prop

## Badge ⇄ Badge

- agrees on 2/4 properties
- ⚠️ **hasIcon** — design only: variant [true, false] — no matching code prop
- ⚠️ **hasLabel** — design only: variant [false, true] — no matching code prop

## Breadcrumbs ⇄ Breadcrumbs

- agrees on 0/3 properties
- ⚠️ **current** — code only: string — no matching design property
- ⚠️ **ariaLabel** — code only: string — no matching design property
- ⚠️ **itemCount** — design only: variant [2, 3, 4, 5+] — no matching code prop

## Button ⇄ Button

- agrees on 0/6 properties
- ⚠️ **variant** — design only: variant [primary, secondary, bare, knockout] — no matching code prop
- ⚠️ **state** — design only: variant [default, hover, active, focus] — no matching code prop
- ⚠️ **isDisabled** — design only: variant [false, true] — no matching code prop
- ⚠️ **hasStartIcon** — design only: no matching code prop
- ⚠️ **hasEndIcon** — design only: no matching code prop
- ⚠️ **text** — design only: no matching code prop — a design TEXT property with no code counterpart is often bound to React `children` (invisible in a props interface); confirm before treating as drift

## Carousel ⇄ Carousel

- agrees on 0/17 properties
- ⚠️ **ariaLabel** — code only: string — no matching design property
- ⚠️ **ariaLabelledBy** — code only: string — no matching design property
- ⚠️ **defaultIndex** — code only: number — no matching design property
- ⚠️ **currentIndex** — code only: number — no matching design property
- ⚠️ **loop** — code only: boolean — no matching design property
- ⚠️ **align** — code only: enum [start, center, end] — no matching design property
- ⚠️ **peek** — code only: boolean — no matching design property
- ⚠️ **showIndicators** — code only: boolean — no matching design property
- ⚠️ **autoPlay** — code only: boolean — no matching design property
- ⚠️ **autoPlayDelay** — code only: number — no matching design property
- ⚠️ **autoPlayPauseOnInteraction** — code only: boolean — no matching design property
- ⚠️ **autoPlayPauseOnHover** — code only: boolean — no matching design property
- ⚠️ **autoPlayPauseOnFocus** — code only: boolean — no matching design property
- ⚠️ **autoPlayStopOnLast** — code only: boolean — no matching design property
- ⚠️ **respectReducedMotion** — code only: boolean — no matching design property
- ⚠️ **breakpoint** — design only: variant [lg, sm] — no matching code prop
- ⚠️ **variant** — design only: variant [event, hero, ad, clickable listing, artist, followable, vertical] — no matching code prop

## Checkbox ⇄ Checkbox

- agrees on 3/10 properties
- ⚠️ **hint** — code only: string — no matching design property
- ⚠️ **required** — code only: boolean — no matching design property
- ⚠️ **name** — code only: string — no matching design property
- ⚠️ **value** — code only: string — no matching design property
- ⚠️ **className** — code only: string — no matching design property
- ⚠️ **state** — design only: variant [default, focus, hover] — no matching code prop
- ⚠️ **hasHint** — design only: no matching code prop

## CheckboxGroup ⇄ Checkbox group

- agrees on 0/9 properties
- ⚠️ **label** — code only: string — no matching design property
- ⚠️ **ariaLabel** — code only: string — no matching design property
- ⚠️ **hint** — code only: string — no matching design property
- ⚠️ **info** — code only: string — no matching design property
- ⚠️ **error** — code only: string — no matching design property
- ⚠️ **name** — code only: string — no matching design property
- ⚠️ **hasError** — design only: no matching code prop
- ⚠️ **hasDescription** — design only: no matching code prop
- ⚠️ **hasLabel** — design only: no matching code prop

## Combobox ⇄ Combobox

- agrees on 2/13 properties
- ⚠️ **menuItemType** — code only: enum [simple, complex] — no matching design property
- ⚠️ **placeholder** — code only: string — no matching design property
- ⚠️ **menuItemBorderBottom** — code only: boolean — no matching design property
- ⚠️ **open** — code only: boolean — no matching design property
- ⚠️ **defaultOpen** — code only: boolean — no matching design property
- ⚠️ **state** — design only: variant [default, hover, focus, open] — no matching code prop
- ⚠️ **filled** — design only: variant [false, true] — no matching code prop
- ⚠️ **hasStartIcon** — design only: no matching code prop
- ⚠️ **hasHint** — design only: no matching code prop
- ⚠️ **hasLabel** — design only: no matching code prop
- ⚠️ **content** — design only: no matching code prop — a design TEXT property with no code counterpart is often bound to React `children` (invisible in a props interface); confirm before treating as drift

## Countdown ⇄ Countdown

- agrees on 0/2 properties
- ⚠️ **variant** — design only: variant [default, expiring] — no matching code prop
- ⚠️ **timeRemaining** — design only: no matching code prop — a design TEXT property with no code counterpart is often bound to React `children` (invisible in a props interface); confirm before treating as drift

## Dialog ⇄ Dialog

- agrees on 2/2 properties

## Dropdown ⇄ Dropdown

- agrees on 1/14 properties
- ⚠️ **label** — code only: string — no matching design property
- ⚠️ **open** — code only: boolean — no matching design property
- ⚠️ **defaultOpen** — code only: boolean — no matching design property
- ⚠️ **align** — code only: enum [start, center, end] — no matching design property
- ⚠️ **side** — code only: enum [top, right, bottom, left] — no matching design property
- ⚠️ **sideOffset** — code only: number — no matching design property
- ⚠️ **collisionPadding** — code only: number — no matching design property
- ⚠️ **trapFocus** — code only: boolean — no matching design property
- ⚠️ **ariaHaspopup** — code only: enum [menu, listbox, dialog] — no matching design property
- ⚠️ **state** — design only: variant [default, hover, focus, open] — no matching code prop
- ⚠️ **isFilled** — design only: variant [false, true] — no matching code prop
- ⚠️ **hasStartIcon** — design only: no matching code prop
- ⚠️ **content** — design only: no matching code prop — a design TEXT property with no code counterpart is often bound to React `children` (invisible in a props interface); confirm before treating as drift

## ExpandableContent ⇄ Expandable content

- agrees on 1/3 properties
- ⚠️ **defaultExpanded** — code only: boolean — no matching design property
- ⚠️ **text** — design only: no matching code prop — a design TEXT property with no code counterpart is often bound to React `children` (invisible in a props interface); confirm before treating as drift

## FileUpload ⇄ File upload

- agrees on 1/19 properties
- ⚠️ **accept** — code only: string — no matching design property
- ⚠️ **showThumbnail** — code only: boolean — no matching design property
- ⚠️ **label** — code only: string — no matching design property
- ⚠️ **ariaLabel** — code only: string — no matching design property
- ⚠️ **hint** — code only: string — no matching design property
- ⚠️ **info** — code only: string — no matching design property
- ⚠️ **error** — code only: string — no matching design property
- ⚠️ **initialValue** — code only: string — no matching design property
- ⚠️ **resetOnFail** — code only: boolean — no matching design property
- ⚠️ **fileNoun** — code only: string — no matching design property
- ⚠️ **name** — code only: string — no matching design property
- ⚠️ **required** — code only: boolean — no matching design property
- ⚠️ **form** — code only: string — no matching design property
- ⚠️ **state** — design only: variant [default, focus, hover] — no matching code prop
- ⚠️ **imageState** — design only: variant [empty, loading, filled] — no matching code prop
- ⚠️ **hasError** — design only: variant [false, true] — no matching code prop
- ⚠️ **hasLabel** — design only: no matching code prop
- ⚠️ **hasHint** — design only: no matching code prop

## FloatingBar ⇄ Floating bar

- agrees on 0/3 properties
- ⚠️ **ariaLabel** — code only: string — no matching design property
- ⚠️ **labelledBy** — code only: string — no matching design property
- ⚠️ **isScrollable** — code only: boolean — no matching design property

## Footer ⇄ Footer

- agrees on 0/2 properties
- ⚠️ **className** — code only: string — no matching design property
- ⚠️ **breakpoint** — design only: variant [sm, lg] — no matching code prop

## IconButton ⇄ Icon button

- agrees on 0/3 properties
- ⚠️ **variant** — design only: variant [primary, secondary, bare, knockout, bare knockout] — no matching code prop
- ⚠️ **state** — design only: variant [default, hover, active, focus] — no matching code prop
- ⚠️ **isDisabled** — design only: variant [false, true] — no matching code prop

## Input ⇄ Input

- agrees on 0/10 properties
- ⚠️ **className** — code only: string — no matching design property
- ⚠️ **state** — design only: variant [default, hover, focus] — no matching code prop
- ⚠️ **isFilled** — design only: variant [false, true] — no matching code prop
- ⚠️ **hasError** — design only: variant [false, true] — no matching code prop
- ⚠️ **isDisabled** — design only: variant [false, true] — no matching code prop
- ⚠️ **hasStartIcon** — design only: no matching code prop
- ⚠️ **hasEndIcon** — design only: no matching code prop
- ⚠️ **hasHint** — design only: no matching code prop
- ⚠️ **hasLabel** — design only: no matching code prop
- ⚠️ **content** — design only: no matching code prop — a design TEXT property with no code counterpart is often bound to React `children` (invisible in a props interface); confirm before treating as drift

## Map ⇄ Map

- agrees on 1/5 properties
- ⚠️ **ariaLabel** — code only: string — no matching design property
- ⚠️ **showControls** — code only: boolean — no matching design property
- ⚠️ **showOverlay** — code only: boolean — no matching design property
- ⚠️ **breakpoint** — design only: variant [sm, lg] — no matching code prop

## MediaPlayer ⇄ Media player

- agrees on 0/16 properties
- ⚠️ **audioSrc** — code only: string — no matching design property
- ⚠️ **title** — code only: string — no matching design property
- ⚠️ **subtitle** — code only: string — no matching design property
- ⚠️ **imgSrc** — code only: string — no matching design property
- ⚠️ **imgAlt** — code only: string — no matching design property
- ⚠️ **variant** — code only: enum [default, compact, mini] — no matching design property
- ⚠️ **autoPlay** — code only: boolean — no matching design property
- ⚠️ **preload** — code only: enum [metadata, auto, none] — no matching design property
- ⚠️ **loop** — code only: boolean — no matching design property
- ⚠️ **startTime** — code only: number — no matching design property
- ⚠️ **showVolume** — code only: boolean — no matching design property
- ⚠️ **playing** — design only: variant [true, false] — no matching code prop
- ⚠️ **size** — design only: variant [sm, lg] — no matching code prop
- ⚠️ **hasVolumeControl** — design only: no matching code prop
- ⚠️ **secondaryText** — design only: no matching code prop — a design TEXT property with no code counterpart is often bound to React `children` (invisible in a props interface); confirm before treating as drift
- ⚠️ **text** — design only: no matching code prop — a design TEXT property with no code counterpart is often bound to React `children` (invisible in a props interface); confirm before treating as drift

## RadioButtonGroup ⇄ Radio button group

- agrees on 0/8 properties
- ⚠️ **label** — code only: string — no matching design property
- ⚠️ **ariaLabel** — code only: string — no matching design property
- ⚠️ **hint** — code only: string — no matching design property
- ⚠️ **info** — code only: string — no matching design property
- ⚠️ **error** — code only: string — no matching design property
- ⚠️ **hasLabel** — design only: no matching code prop
- ⚠️ **hasError** — design only: no matching code prop
- ⚠️ **hasDescription** — design only: no matching code prop

## Search ⇄ Search

- agrees on 1/9 properties
- ⚠️ **value** — code only: string — no matching design property
- ⚠️ **defaultValue** — code only: string — no matching design property
- ⚠️ **loading** — code only: boolean — no matching design property
- ⚠️ **noResultsMessage** — code only: string — no matching design property
- ⚠️ **viewAllLabel** — code only: string — no matching design property
- ⚠️ **state** — design only: variant [default, hover, focus, open] — no matching code prop
- ⚠️ **isFilled** — design only: variant [false, true] — no matching code prop
- ⚠️ **searchTerm** — design only: no matching code prop — a design TEXT property with no code counterpart is often bound to React `children` (invisible in a props interface); confirm before treating as drift

## Select ⇄ Select

- agrees on 1/8 properties
- ⚠️ **state** — design only: variant [default, hover, focus, open] — no matching code prop
- ⚠️ **isFilled** — design only: variant [false, true] — no matching code prop
- ⚠️ **hasError** — design only: variant [true, false] — no matching code prop
- ⚠️ **hasStartIcon** — design only: no matching code prop
- ⚠️ **hasLabel** — design only: no matching code prop
- ⚠️ **hasHint** — design only: no matching code prop
- ⚠️ **content** — design only: no matching code prop — a design TEXT property with no code counterpart is often bound to React `children` (invisible in a props interface); confirm before treating as drift

## SelectionCard ⇄ Selection card

- agrees on 2/4 properties
- ⚠️ **ariaLabel** — code only: string — no matching design property
- ⚠️ **state** — design only: variant [default, hover, focus] — no matching code prop

## Stepper ⇄ Stepper

- agrees on 0/6 properties
- ⚠️ **steps** — code only: number — no matching design property
- ⚠️ **activeStep** — code only: number — no matching design property
- ⚠️ **activeLabel** — code only: string — no matching design property
- ⚠️ **variant** — design only: variant [numeric, text] — no matching code prop
- ⚠️ **show step 3** — design only: no matching code prop
- ⚠️ **show step 4** — design only: no matching code prop

## SubscriptionCard ⇄ Subscription card

- agrees on 2/9 properties
- ⚠️ **terms** — code only: string — no matching design property
- ⚠️ **cancelText** — code only: string — no matching design property
- ⚠️ **cancelHref** — code only: string — no matching design property
- ⚠️ **nextBillingDate** — code only: string — no matching design property
- ⚠️ **inactiveSubtitle** — code only: string — no matching design property
- ⚠️ **text** — design only: no matching code prop — a design TEXT property with no code counterpart is often bound to React `children` (invisible in a props interface); confirm before treating as drift
- ⚠️ **billingDate** — design only: no matching code prop — a design TEXT property with no code counterpart is often bound to React `children` (invisible in a props interface); confirm before treating as drift

## Tabs ⇄ Tabs

- agrees on 1/11 properties
- ⚠️ **value** — code only: string — no matching design property
- ⚠️ **defaultValue** — code only: string — no matching design property
- ⚠️ **activationMode** — code only: enum [automatic, manual] — no matching design property
- ⚠️ **loop** — code only: boolean — no matching design property
- ⚠️ **ariaLabel** — code only: string — no matching design property
- ⚠️ **disabled** — code only: boolean — no matching design property
- ⚠️ **className** — code only: string — no matching design property
- ⚠️ **show tab 3** — design only: no matching code prop
- ⚠️ **show tab 4** — design only: no matching code prop
- ⚠️ **show tab 5** — design only: no matching code prop

## Textarea ⇄ Textarea

- agrees on 1/16 properties
- ⚠️ **label** — code only: string — no matching design property
- ⚠️ **ariaLabel** — code only: string — no matching design property
- ⚠️ **hint** — code only: string — no matching design property
- ⚠️ **error** — code only: string — no matching design property
- ⚠️ **info** — code only: string — no matching design property
- ⚠️ **value** — code only: string — no matching design property
- ⚠️ **defaultValue** — code only: string — no matching design property
- ⚠️ **state** — design only: variant [default, hover, focus] — no matching code prop
- ⚠️ **isFilled** — design only: variant [false, true] — no matching code prop
- ⚠️ **hasError** — design only: variant [true, false] — no matching code prop
- ⚠️ **hasStartIcon** — design only: no matching code prop
- ⚠️ **hasEndIcon** — design only: no matching code prop
- ⚠️ **hasLabel** — design only: no matching code prop
- ⚠️ **hasHint** — design only: no matching code prop
- ⚠️ **content** — design only: no matching code prop — a design TEXT property with no code counterpart is often bound to React `children` (invisible in a props interface); confirm before treating as drift

## TextLink ⇄ Text link

- agrees on 0/5 properties
- ⚠️ **emphasis** — design only: variant [strong, subtle, inverted, brand] — no matching code prop
- ⚠️ **state** — design only: variant [default, hover, active, focus, disabled] — no matching code prop
- ⚠️ **hasStartIcon** — design only: no matching code prop
- ⚠️ **hasEndIcon** — design only: no matching code prop
- ⚠️ **text** — design only: no matching code prop — a design TEXT property with no code counterpart is often bound to React `children` (invisible in a props interface); confirm before treating as drift

## ToggleGroup ⇄ Toggle group

- agrees on 0/4 properties
- ⚠️ **ariaLabel** — code only: string — no matching design property
- ⚠️ **showItem3** — design only: no matching code prop
- ⚠️ **showItem4** — design only: no matching code prop
- ⚠️ **showItem5** — design only: no matching code prop

## Components in code with no design counterpart

- ActionCard (`../../../../private/tmp/claude-501/-Users-tjpitre-Sites-ds-contracts-poc/601388a4-bfff-4bbd-aaf1-50a4605c39ae/scratchpad/eventz/packages/core/src/components/server/ActionCard/ActionCard.tsx`)
- Chip (`../../../../private/tmp/claude-501/-Users-tjpitre-Sites-ds-contracts-poc/601388a4-bfff-4bbd-aaf1-50a4605c39ae/scratchpad/eventz/packages/core/src/components/server/Chip/Chip.tsx`)
- ComboboxField (`../../../../private/tmp/claude-501/-Users-tjpitre-Sites-ds-contracts-poc/601388a4-bfff-4bbd-aaf1-50a4605c39ae/scratchpad/eventz/packages/core/src/components/client/Combobox/Combobox.tsx`)
- ContentCard (`../../../../private/tmp/claude-501/-Users-tjpitre-Sites-ds-contracts-poc/601388a4-bfff-4bbd-aaf1-50a4605c39ae/scratchpad/eventz/packages/core/src/components/server/ContentCard/ContentCard.tsx`)
- Control (`../../../../private/tmp/claude-501/-Users-tjpitre-Sites-ds-contracts-poc/601388a4-bfff-4bbd-aaf1-50a4605c39ae/scratchpad/eventz/packages/core/src/components/client/Control/Control.tsx`)
- DatePicker (`../../../../private/tmp/claude-501/-Users-tjpitre-Sites-ds-contracts-poc/601388a4-bfff-4bbd-aaf1-50a4605c39ae/scratchpad/eventz/packages/core/src/components/client/DatePicker/DatePicker.tsx`)
- EventPanel (`../../../../private/tmp/claude-501/-Users-tjpitre-Sites-ds-contracts-poc/601388a4-bfff-4bbd-aaf1-50a4605c39ae/scratchpad/eventz/packages/core/src/components/server/EventPanel/EventPanel.tsx`)
- FormElement (`../../../../private/tmp/claude-501/-Users-tjpitre-Sites-ds-contracts-poc/601388a4-bfff-4bbd-aaf1-50a4605c39ae/scratchpad/eventz/packages/core/src/components/client/FormElement/FormElement.tsx`)
- Heading (`../../../../private/tmp/claude-501/-Users-tjpitre-Sites-ds-contracts-poc/601388a4-bfff-4bbd-aaf1-50a4605c39ae/scratchpad/eventz/packages/core/src/components/server/Heading/Heading.tsx`)
- ImagePanel (`../../../../private/tmp/claude-501/-Users-tjpitre-Sites-ds-contracts-poc/601388a4-bfff-4bbd-aaf1-50a4605c39ae/scratchpad/eventz/packages/core/src/components/server/ImagePanel/ImagePanel.tsx`)
- InfoPopover (`../../../../private/tmp/claude-501/-Users-tjpitre-Sites-ds-contracts-poc/601388a4-bfff-4bbd-aaf1-50a4605c39ae/scratchpad/eventz/packages/core/src/components/client/InfoPopover/InfoPopover.tsx`)
- InputField (`../../../../private/tmp/claude-501/-Users-tjpitre-Sites-ds-contracts-poc/601388a4-bfff-4bbd-aaf1-50a4605c39ae/scratchpad/eventz/packages/core/src/components/client/Input/Input.tsx`)
- MediaCard (`../../../../private/tmp/claude-501/-Users-tjpitre-Sites-ds-contracts-poc/601388a4-bfff-4bbd-aaf1-50a4605c39ae/scratchpad/eventz/packages/core/src/components/server/MediaCard/MediaCard.tsx`)
- MediaControl (`../../../../private/tmp/claude-501/-Users-tjpitre-Sites-ds-contracts-poc/601388a4-bfff-4bbd-aaf1-50a4605c39ae/scratchpad/eventz/packages/core/src/components/client/MediaControl/MediaControl.tsx`)
- NavigationBar (`../../../../private/tmp/claude-501/-Users-tjpitre-Sites-ds-contracts-poc/601388a4-bfff-4bbd-aaf1-50a4605c39ae/scratchpad/eventz/packages/core/src/components/server/NavigationBar/NavigationBar.tsx`)
- NavigationContainer (`../../../../private/tmp/claude-501/-Users-tjpitre-Sites-ds-contracts-poc/601388a4-bfff-4bbd-aaf1-50a4605c39ae/scratchpad/eventz/packages/core/src/components/server/NavigationContainer/NavigationContainer.tsx`)
- NavigationDropdown (`../../../../private/tmp/claude-501/-Users-tjpitre-Sites-ds-contracts-poc/601388a4-bfff-4bbd-aaf1-50a4605c39ae/scratchpad/eventz/packages/core/src/components/client/NavigationDropdown/NavigationDropdown.tsx`)
- Scroller (`../../../../private/tmp/claude-501/-Users-tjpitre-Sites-ds-contracts-poc/601388a4-bfff-4bbd-aaf1-50a4605c39ae/scratchpad/eventz/packages/core/src/components/client/Scroller/Scroller.tsx`)
- ScrollerRow (`../../../../private/tmp/claude-501/-Users-tjpitre-Sites-ds-contracts-poc/601388a4-bfff-4bbd-aaf1-50a4605c39ae/scratchpad/eventz/packages/core/src/components/server/ScrollerRow/ScrollerRow.tsx`)
- Slider (`../../../../private/tmp/claude-501/-Users-tjpitre-Sites-ds-contracts-poc/601388a4-bfff-4bbd-aaf1-50a4605c39ae/scratchpad/eventz/packages/core/src/components/client/Slider/Slider.tsx`)
- TextWithRef (`../../../../private/tmp/claude-501/-Users-tjpitre-Sites-ds-contracts-poc/601388a4-bfff-4bbd-aaf1-50a4605c39ae/scratchpad/eventz/packages/core/src/components/server/Text/Text.tsx`)
- Visibility (`../../../../private/tmp/claude-501/-Users-tjpitre-Sites-ds-contracts-poc/601388a4-bfff-4bbd-aaf1-50a4605c39ae/scratchpad/eventz/packages/core/src/components/server/Visibility/Visibility.tsx`)

## Components in design with no code counterpart

- Controls
- .Day
- .Month
- .Calendar
- Radio button
- Tag
- .avatar
- .comboboxDropdown
- .comboChip
- .Dropdown-insert
- .fileThumbnail
- Interactive list item
- .Menu item
- .Search terms
- .Search dropdown
- .tabTrigger
- .toggleGroupItem
- ad
- Card
- .dotIndicator
- .hero-carousel
- .carousel-rail
- .Map controls
- .Segmented map controls
- .Map marker
- .Progress bar
- Navigation
- .Stepper text item
- .Stepper number rail
- .Stepper number item
- Sticky nav
- .Popover
- .scrollableControls
- Slot
- .Inline danger
- .Inline hint
- .Field label

