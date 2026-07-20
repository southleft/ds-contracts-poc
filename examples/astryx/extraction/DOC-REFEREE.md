# The `.doc.mjs` referee — vendor docs vs our proposals (census set)

Meta ships a machine-readable props+anatomy table per component INSIDE
`@astryxdesign/core@0.1.6` — an independent witness. This report diffs it
against `static-contracts/` (our mechanical proposals). **Neither side wins
automatically**: every disagreement is a named finding either way.
Regenerate: `npx tsx examples/astryx/scripts/doc-referee.ts` (fails the run
on any silent loss — a doc prop extraction never saw).

## Verdict

- **246 vendor-documented props** compared across 24 census components
- **136 agree** (type/default/required, or carried as a contract event)
- **53 not carried BY RECEIPT** (platform props, slot candidates → anatomy step, non-on* functions) — the vendor doc confirms each receipt points at something real
- **93 named disagreements** (every one listed below)
- **0 silent losses** — every vendor-documented prop was either carried or receipted (the run refuses to write otherwise)

## Named disagreements

| component | prop | class | detail |
|---|---|---|---|
| Button | `size` | DISAGREE | default: doc says md, we carry (none) |
| Button | `value` | NOT-CARRIED | doc types it "string | number | readonly string[]" — we saw it but classified 'other' (receipted); the doc says it is real API |
| Button | `onClick` | NOT-CARRIED | doc types it "(e: MouseEvent) => void" — we saw it but classified 'other' (receipted); the doc says it is real API |
| Button | `href` | DOC-MISSING | in the shipped source (and our contract) but NOT in the vendor doc props table — the witness may be behind its own source |
| Button | `target` | DOC-MISSING | in the shipped source (and our contract) but NOT in the vendor doc props table — the witness may be behind its own source |
| Button | `rel` | DOC-MISSING | in the shipped source (and our contract) but NOT in the vendor doc props table — the witness may be behind its own source |
| CheckboxInput | `value` | NOT-CARRIED | doc types it "boolean | 'indeterminate'" — we saw it but classified 'other' (receipted); the doc says it is real API |
| CheckboxInput | `labelIcon` | NOT-CARRIED | doc types it "IconType" — we saw it but classified 'other' (receipted); the doc says it is real API |
| CheckboxInput | `status` | NOT-CARRIED | doc types it "{ type: 'error' | 'warning' | 'success', message: string }" — we saw it but classified 'other' (receipted); the doc says it is real API |
| Switch | `value` | DISAGREE | required: doc says true, we carry false (contract schema flags required only on text props — structural, review) |
| Switch | `status` | NOT-CARRIED | doc types it "InputStatus" — we saw it but classified 'other' (receipted); the doc says it is real API |
| Switch | `labelIcon` | NOT-CARRIED | doc types it "IconType" — we saw it but classified 'other' (receipted); the doc says it is real API |
| Switch | `labelSpacing` | DISAGREE | our enum values the doc DOESN'T list: [default] |
| Tooltip | `delay` | DOC-MISSING | in the shipped source (and our contract) but NOT in the vendor doc props table — the witness may be behind its own source |
| Tooltip | `hideDelay` | DOC-MISSING | in the shipped source (and our contract) but NOT in the vendor doc props table — the witness may be behind its own source |
| Tooltip | `isEnabled` | DOC-MISSING | in the shipped source (and our contract) but NOT in the vendor doc props table — the witness may be behind its own source |
| Tooltip | `isOpen` | DOC-MISSING | in the shipped source (and our contract) but NOT in the vendor doc props table — the witness may be behind its own source |
| Tooltip | `isDefaultOpen` | DOC-MISSING | in the shipped source (and our contract) but NOT in the vendor doc props table — the witness may be behind its own source |
| Tooltip | `onOpenChange` | DOC-MISSING | contract event not in the vendor doc props table |
| Dialog | `isOpen` | DISAGREE | required: doc says true, we carry false (contract schema flags required only on text props — structural, review) |
| Dialog | `width` | NOT-CARRIED | doc types it "number | string" — we saw it but classified 'other' (receipted); the doc says it is real API |
| Dialog | `maxHeight` | NOT-CARRIED | doc types it "number | string" — we saw it but classified 'other' (receipted); the doc says it is real API |
| Dialog | `position` | NOT-CARRIED | doc types it "DialogPosition" — we saw it but classified 'other' (receipted); the doc says it is real API |
| MoreMenu | `items` | NOT-CARRIED | doc types it "DropdownMenuOption[]" — we saw it but classified 'other' (receipted); the doc says it is real API |
| MoreMenu | `variant` | NOT-CARRIED | doc types it "ButtonVariant" — we saw it but classified 'other' (receipted); the doc says it is real API |
| MoreMenu | `size` | NOT-CARRIED | doc types it "ButtonSize" — we saw it but classified 'other' (receipted); the doc says it is real API |
| MoreMenu | `isMenuOpen` | DOC-MISSING | in the shipped source (and our contract) but NOT in the vendor doc props table — the witness may be behind its own source |
| MoreMenu | `onOpenChange` | DOC-MISSING | contract event not in the vendor doc props table |
| TabList | `size` | NOT-CARRIED | doc types it "'sm' | 'md' | 'lg'" — we saw it but classified 'other' (receipted); the doc says it is real API |
| TabList | `orientation` | NOT-CARRIED | doc types it "'horizontal' | 'vertical'" — we saw it but classified 'other' (receipted); the doc says it is real API |
| CollapsibleGroup | `defaultValue` | NOT-CARRIED | doc types it "string | string[]" — we saw it but classified 'other' (receipted); the doc says it is real API |
| CollapsibleGroup | `value` | NOT-CARRIED | doc types it "string | string[]" — we saw it but classified 'other' (receipted); the doc says it is real API |
| CollapsibleGroup | `density` | NOT-CARRIED | doc types it "'compact' | 'balanced' | 'spacious'" — we saw it but classified 'other' (receipted); the doc says it is real API |
| TextInput | `size` | DISAGREE | default: doc says md, we carry (none) |
| TextInput | `startIcon` | NOT-CARRIED | doc types it "IconType" — we saw it but classified 'other' (receipted); the doc says it is real API |
| TextInput | `status` | NOT-CARRIED | doc types it "{type: 'error' | 'warning' | 'success', message?: string}" — we saw it but classified 'other' (receipted); the doc says it is real API |
| TextInput | `onEnter` | DOC-MISSING | contract event not in the vendor doc props table |
| TextInput | `onKeyDown` | DOC-MISSING | contract event not in the vendor doc props table |
| Typeahead | `searchSource` | NOT-CARRIED | doc types it "SearchSource<T>" — we saw it but classified 'other' (receipted); the doc says it is real API |
| Typeahead | `value` | NOT-CARRIED | doc types it "T | null" — we saw it but classified 'other' (receipted); the doc says it is real API |
| Typeahead | `hasEntriesOnFocus` | DISAGREE | default: doc says false, we carry (none) |
| Typeahead | `maxMenuItems` | DISAGREE | default: doc says 10, we carry (none) |
| Typeahead | `status` | NOT-CARRIED | doc types it "InputStatus" — we saw it but classified 'other' (receipted); the doc says it is real API |
| Typeahead | `emptySearchResultsText` | DISAGREE | default: doc says No results found, we carry (none) |
| Typeahead | `hasAutoFocus` | DISAGREE | default: doc says false, we carry (none) |
| Typeahead | `size` | DISAGREE | default: doc says md, we carry (none) |
| Typeahead | `debounceMs` | DISAGREE | default: doc says 150, we carry (none) |
| Toast | `type` | NOT-CARRIED | doc types it "'info' | 'error'" — we saw it but classified 'other' (receipted); the doc says it is real API |
| Toast | `autoHideDuration` | DISAGREE | default: doc says 5000, we carry (none) |
| Toast | `uniqueID` | DOC-BEYOND-INTERFACE | the vendor doc documents it (type "string") but the shipped component file declares no such prop — the doc covers a different surface (imperative options?) or is ahead of the source |
| Toast | `collisionBehavior` | DOC-BEYOND-INTERFACE | the vendor doc documents it (type "'overwrite' | 'ignore'") but the shipped component file declares no such prop — the doc covers a different surface (imperative options?) or is ahead of the source |
| Toast | `onHide` | DOC-BEYOND-INTERFACE | the vendor doc documents it (type "(reason: "auto" | "manual") => void") but the shipped component file declares no such prop — the doc covers a different surface (imperative options?) or is ahead of the source |
| Toast | `isExiting` | DOC-MISSING | in the shipped source (and our contract) but NOT in the vendor doc props table — the witness may be behind its own source |
| Toast | `onDismiss` | DOC-MISSING | contract event not in the vendor doc props table |
| Pagination | `page` | DISAGREE | required: doc says true, we carry false (contract schema flags required only on text props — structural, review) |
| Pagination | `pageSize` | DISAGREE | default: doc says 10, we carry (none) |
| Pagination | `pageSizeOptions` | NOT-CARRIED | doc types it "number[]" — we saw it but classified 'other' (receipted); the doc says it is real API |
| Avatar | `size` | NOT-CARRIED | doc types it "'tiny' | 'xsmall' | 'small' | 'medium' | 'large' | number" — we saw it but classified 'other' (receipted); the doc says it is real API |
| Card | `width` | NOT-CARRIED | doc types it "SizeValue" — we saw it but classified 'other' (receipted); the doc says it is real API |
| Card | `height` | NOT-CARRIED | doc types it "SizeValue" — we saw it but classified 'other' (receipted); the doc says it is real API |
| Card | `maxWidth` | NOT-CARRIED | doc types it "SizeValue" — we saw it but classified 'other' (receipted); the doc says it is real API |
| Card | `minHeight` | NOT-CARRIED | doc types it "SizeValue" — we saw it but classified 'other' (receipted); the doc says it is real API |
| Card | `padding` | NOT-CARRIED | doc types it "0 | 0.5 | 1 | 1.5 | 2 | 3 | 4 | 5 | 6 | 8 | 10" — we saw it but classified 'other' (receipted); the doc says it is real API |
| Card | `variant` | DISAGREE | our enum values the doc DOESN'T list: [transparent] |
| Popover | `isOpen` | DOC-MISSING | in the shipped source (and our contract) but NOT in the vendor doc props table — the witness may be behind its own source |
| Popover | `isEnabled` | DOC-MISSING | in the shipped source (and our contract) but NOT in the vendor doc props table — the witness may be behind its own source |
| Popover | `label` | DOC-MISSING | in the shipped source (and our contract) but NOT in the vendor doc props table — the witness may be behind its own source |
| Popover | `hasCloseButton` | DOC-MISSING | in the shipped source (and our contract) but NOT in the vendor doc props table — the witness may be behind its own source |
| Popover | `closeButtonLabel` | DOC-MISSING | in the shipped source (and our contract) but NOT in the vendor doc props table — the witness may be behind its own source |
| Popover | `hasAutoFocus` | DOC-MISSING | in the shipped source (and our contract) but NOT in the vendor doc props table — the witness may be behind its own source |
| Popover | `hasLightDismiss` | DOC-MISSING | in the shipped source (and our contract) but NOT in the vendor doc props table — the witness may be behind its own source |
| Popover | `hasEscapeDismiss` | DOC-MISSING | in the shipped source (and our contract) but NOT in the vendor doc props table — the witness may be behind its own source |
| Popover | `onOpenChange` | DOC-MISSING | contract event not in the vendor doc props table |
| Slider | `value` | DISAGREE | required: doc says true, we carry false (contract schema flags required only on text props — structural, review) |
| Slider | `marks` | NOT-CARRIED | doc types it "Array<{ value: number; label?: string }>" — we saw it but classified 'other' (receipted); the doc says it is real API |
| Slider | `minStepsBetweenThumbs` | DISAGREE | default: doc says 0, we carry (none) |
| Slider | `status` | NOT-CARRIED | doc types it "InputStatus" — we saw it but classified 'other' (receipted); the doc says it is real API |
| Banner | `status` | DISAGREE | required: doc says true, we carry false (contract schema flags required only on text props — structural, review) |
| Skeleton | `width` | NOT-CARRIED | doc types it "number | string" — we saw it but classified 'other' (receipted); the doc says it is real API |
| Skeleton | `height` | NOT-CARRIED | doc types it "number | string" — we saw it but classified 'other' (receipted); the doc says it is real API |
| Skeleton | `radius` | DISAGREE | we carry an enum (7 values) — doc types it "'none' | 0 | 1 | 2 | 3 | 4 | 'rounded'" |
| Skeleton | `radius` | DISAGREE | default: doc says 3, we carry (none) |
| Link | `label` | DOC-MISSING | in the shipped source (and our contract) but NOT in the vendor doc props table — the witness may be behind its own source |
| Link | `href` | DOC-MISSING | in the shipped source (and our contract) but NOT in the vendor doc props table — the witness may be behind its own source |
| Link | `hasUnderline` | DOC-MISSING | in the shipped source (and our contract) but NOT in the vendor doc props table — the witness may be behind its own source |
| Link | `isDisabled` | DOC-MISSING | in the shipped source (and our contract) but NOT in the vendor doc props table — the witness may be behind its own source |
| Link | `isExternalLink` | DOC-MISSING | in the shipped source (and our contract) but NOT in the vendor doc props table — the witness may be behind its own source |
| Link | `newTabLabel` | DOC-MISSING | in the shipped source (and our contract) but NOT in the vendor doc props table — the witness may be behind its own source |
| Link | `target` | DOC-MISSING | in the shipped source (and our contract) but NOT in the vendor doc props table — the witness may be behind its own source |
| Link | `rel` | DOC-MISSING | in the shipped source (and our contract) but NOT in the vendor doc props table — the witness may be behind its own source |
| Link | `tooltip` | DOC-MISSING | in the shipped source (and our contract) but NOT in the vendor doc props table — the witness may be behind its own source |
| Link | `isStandalone` | DOC-MISSING | in the shipped source (and our contract) but NOT in the vendor doc props table — the witness may be behind its own source |
| Link | `maxLines` | DOC-MISSING | in the shipped source (and our contract) but NOT in the vendor doc props table — the witness may be behind its own source |

## Agreements and receipts

| component | prop | class | detail |
|---|---|---|---|
| Button | `label` | AGREE | type/default/required agree |
| Button | `variant` | AGREE | type/default/required agree |
| Button | `type` | AGREE | type/default/required agree |
| Button | `name` | AGREE | type/default/required agree |
| Button | `form` | AGREE | type/default/required agree |
| Button | `isLoading` | AGREE | type/default/required agree |
| Button | `isInterruptible` | AGREE | type/default/required agree |
| Button | `isDisabled` | AGREE | type/default/required agree |
| Button | `icon` | RECEIPTED | ReactNode — receipted as a slot candidate (anatomy step) |
| Button | `isIconOnly` | AGREE | type/default/required agree |
| Button | `children` | RECEIPTED | platform prop — excluded by the shared exclusion list |
| Button | `endContent` | RECEIPTED | ReactNode — receipted as a slot candidate (anatomy step) |
| Button | `tooltip` | AGREE | type/default/required agree |
| Button | `clickAction` | RECEIPTED | function-typed but not on* — receipted for manual review |
| CheckboxInput | `ref` | RECEIPTED | platform prop — excluded by the shared exclusion list |
| CheckboxInput | `label` | AGREE | type/default/required agree |
| CheckboxInput | `isLabelHidden` | AGREE | type/default/required agree |
| CheckboxInput | `description` | AGREE | type/default/required agree |
| CheckboxInput | `onChange` | AGREE-EVENT | carried as a contract event |
| CheckboxInput | `changeAction` | RECEIPTED | function-typed but not on* — receipted for manual review |
| CheckboxInput | `isLoading` | AGREE | type/default/required agree |
| CheckboxInput | `isDisabled` | AGREE | type/default/required agree |
| CheckboxInput | `htmlName` | AGREE | type/default/required agree |
| CheckboxInput | `disabledMessage` | AGREE | type/default/required agree |
| CheckboxInput | `isReadOnly` | AGREE | type/default/required agree |
| CheckboxInput | `isOptional` | AGREE | type/default/required agree |
| CheckboxInput | `isRequired` | AGREE | type/default/required agree |
| CheckboxInput | `size` | AGREE | type/default/required agree |
| CheckboxInput | `onFocus` | AGREE-EVENT | carried as a contract event |
| CheckboxInput | `onBlur` | AGREE-EVENT | carried as a contract event |
| Switch | `ref` | RECEIPTED | platform prop — excluded by the shared exclusion list |
| Switch | `label` | AGREE | type/default/required agree |
| Switch | `onChange` | AGREE-EVENT | carried as a contract event |
| Switch | `changeAction` | RECEIPTED | function-typed but not on* — receipted for manual review |
| Switch | `isLoading` | AGREE | type/default/required agree |
| Switch | `isLabelHidden` | AGREE | type/default/required agree |
| Switch | `description` | AGREE | type/default/required agree |
| Switch | `isDisabled` | AGREE | type/default/required agree |
| Switch | `htmlName` | AGREE | type/default/required agree |
| Switch | `disabledMessage` | AGREE | type/default/required agree |
| Switch | `isOptional` | AGREE | type/default/required agree |
| Switch | `isRequired` | AGREE | type/default/required agree |
| Switch | `onFocus` | AGREE-EVENT | carried as a contract event |
| Switch | `onBlur` | AGREE-EVENT | carried as a contract event |
| Switch | `labelTooltip` | AGREE | type/default/required agree |
| Switch | `labelPosition` | AGREE | type/default/required agree |
| Badge | `variant` | AGREE | type/default/required agree |
| Badge | `label` | RECEIPTED | ReactNode — receipted as a slot candidate (anatomy step) |
| Badge | `icon` | RECEIPTED | ReactNode — receipted as a slot candidate (anatomy step) |
| Dialog | `onOpenChange` | AGREE-EVENT | carried as a contract event |
| Dialog | `children` | RECEIPTED | platform prop — excluded by the shared exclusion list |
| Dialog | `variant` | AGREE | type/default/required agree |
| Dialog | `purpose` | AGREE | type/default/required agree |
| Dialog | `isInline` | AGREE | type/default/required agree |
| MoreMenu | `label` | AGREE | type/default/required agree |
| MoreMenu | `icon` | RECEIPTED | ReactNode — receipted as a slot candidate (anatomy step) |
| MoreMenu | `isDisabled` | AGREE | type/default/required agree |
| MoreMenu | `xstyle` | RECEIPTED | outside the declared single-file surface — the component carries the heritage/composed-refs receipt naming where it lives |
| TabList | `value` | AGREE | type/default/required agree |
| TabList | `onChange` | AGREE-EVENT | carried as a contract event |
| TabList | `layout` | AGREE | type/default/required agree |
| TabList | `hasDivider` | AGREE | type/default/required agree |
| TabList | `children` | RECEIPTED | platform prop — excluded by the shared exclusion list |
| TabList | `xstyle` | RECEIPTED | outside the declared single-file surface — the component carries the heritage/composed-refs receipt naming where it lives |
| CollapsibleGroup | `type` | AGREE | type/default/required agree |
| CollapsibleGroup | `onChange` | AGREE-EVENT | carried as a contract event |
| CollapsibleGroup | `hasDividers` | AGREE | type/default/required agree |
| CollapsibleGroup | `children` | RECEIPTED | platform prop — excluded by the shared exclusion list |
| Table | `data` | RECEIPTED | outside the declared single-file surface — the component carries the heritage/composed-refs receipt naming where it lives |
| Table | `columns` | RECEIPTED | outside the declared single-file surface — the component carries the heritage/composed-refs receipt naming where it lives |
| Table | `idKey` | RECEIPTED | outside the declared single-file surface — the component carries the heritage/composed-refs receipt naming where it lives |
| Table | `density` | RECEIPTED | outside the declared single-file surface — the component carries the heritage/composed-refs receipt naming where it lives |
| Table | `dividers` | RECEIPTED | outside the declared single-file surface — the component carries the heritage/composed-refs receipt naming where it lives |
| Table | `isStriped` | RECEIPTED | outside the declared single-file surface — the component carries the heritage/composed-refs receipt naming where it lives |
| Table | `hasHover` | RECEIPTED | outside the declared single-file surface — the component carries the heritage/composed-refs receipt naming where it lives |
| Table | `verticalAlign` | RECEIPTED | outside the declared single-file surface — the component carries the heritage/composed-refs receipt naming where it lives |
| Table | `textOverflow` | RECEIPTED | outside the declared single-file surface — the component carries the heritage/composed-refs receipt naming where it lives |
| Table | `plugins` | RECEIPTED | outside the declared single-file surface — the component carries the heritage/composed-refs receipt naming where it lives |
| Table | `children` | RECEIPTED | platform prop — excluded by the shared exclusion list |
| Table | `xstyle` | RECEIPTED | outside the declared single-file surface — the component carries the heritage/composed-refs receipt naming where it lives |
| TextInput | `type` | AGREE | type/default/required agree |
| TextInput | `label` | AGREE | type/default/required agree |
| TextInput | `value` | AGREE | type/default/required agree |
| TextInput | `onChange` | AGREE-EVENT | carried as a contract event |
| TextInput | `changeAction` | RECEIPTED | function-typed but not on* — receipted for manual review |
| TextInput | `isLabelHidden` | AGREE | type/default/required agree |
| TextInput | `description` | AGREE | type/default/required agree |
| TextInput | `isOptional` | AGREE | type/default/required agree |
| TextInput | `isRequired` | AGREE | type/default/required agree |
| TextInput | `isDisabled` | AGREE | type/default/required agree |
| TextInput | `disabledMessage` | AGREE | type/default/required agree |
| TextInput | `isLoading` | AGREE | type/default/required agree |
| TextInput | `placeholder` | AGREE | type/default/required agree |
| TextInput | `labelTooltip` | AGREE | type/default/required agree |
| TextInput | `hasClear` | AGREE | type/default/required agree |
| TextInput | `hasAutoFocus` | AGREE | type/default/required agree |
| TextInput | `htmlName` | AGREE | type/default/required agree |
| Typeahead | `label` | AGREE | type/default/required agree |
| Typeahead | `onChange` | AGREE-EVENT | carried as a contract event |
| Typeahead | `placeholder` | AGREE | type/default/required agree |
| Typeahead | `hasClear` | AGREE | type/default/required agree |
| Typeahead | `isDisabled` | AGREE | type/default/required agree |
| Typeahead | `disabledMessage` | AGREE | type/default/required agree |
| Typeahead | `renderItem` | RECEIPTED | function-typed but not on* — receipted for manual review |
| Typeahead | `isLabelHidden` | AGREE | type/default/required agree |
| Typeahead | `description` | AGREE | type/default/required agree |
| Typeahead | `isRequired` | AGREE | type/default/required agree |
| Typeahead | `isOptional` | AGREE | type/default/required agree |
| Typeahead | `labelTooltip` | AGREE | type/default/required agree |
| Typeahead | `onChangeQuery` | AGREE-EVENT | carried as a contract event |
| Typeahead | `onOpenChange` | AGREE-EVENT | carried as a contract event |
| Typeahead | `xstyle` | RECEIPTED | outside the declared single-file surface — the component carries the heritage/composed-refs receipt naming where it lives |
| Toast | `body` | RECEIPTED | ReactNode — receipted as a slot candidate (anatomy step) |
| Toast | `isAutoHide` | AGREE | type/default/required agree |
| Toast | `endContent` | RECEIPTED | ReactNode — receipted as a slot candidate (anatomy step) |
| Pagination | `onChange` | AGREE-EVENT | carried as a contract event |
| Pagination | `changeAction` | RECEIPTED | function-typed but not on* — receipted for manual review |
| Pagination | `totalItems` | AGREE | type/default/required agree |
| Pagination | `totalPages` | AGREE | type/default/required agree |
| Pagination | `hasMore` | AGREE | type/default/required agree |
| Pagination | `onPageSizeChange` | AGREE-EVENT | carried as a contract event |
| Pagination | `variant` | AGREE | type/default/required agree |
| Pagination | `siblingCount` | AGREE | type/default/required agree |
| Pagination | `size` | AGREE | type/default/required agree |
| Pagination | `isDisabled` | AGREE | type/default/required agree |
| Pagination | `label` | AGREE | type/default/required agree |
| Pagination | `xstyle` | RECEIPTED | outside the declared single-file surface — the component carries the heritage/composed-refs receipt naming where it lives |
| Breadcrumbs | `children` | RECEIPTED | platform prop — excluded by the shared exclusion list |
| Breadcrumbs | `separator` | RECEIPTED | ReactNode — receipted as a slot candidate (anatomy step) |
| Breadcrumbs | `variant` | AGREE | type/default/required agree |
| Breadcrumbs | `label` | AGREE | type/default/required agree |
| Breadcrumbs | `xstyle` | RECEIPTED | outside the declared single-file surface — the component carries the heritage/composed-refs receipt naming where it lives |
| Avatar | `src` | AGREE | type/default/required agree |
| Avatar | `fallbackSrc` | AGREE | type/default/required agree |
| Avatar | `name` | AGREE | type/default/required agree |
| Avatar | `alt` | AGREE | type/default/required agree |
| Avatar | `status` | RECEIPTED | ReactNode — receipted as a slot candidate (anatomy step) |
| Card | `children` | RECEIPTED | platform prop — excluded by the shared exclusion list |
| ProgressBar | `label` | AGREE | type/default/required agree |
| ProgressBar | `value` | AGREE | type/default/required agree |
| ProgressBar | `max` | AGREE | type/default/required agree |
| ProgressBar | `isLabelHidden` | AGREE | type/default/required agree |
| ProgressBar | `hasValueLabel` | AGREE | type/default/required agree |
| ProgressBar | `formatValueLabel` | RECEIPTED | function-typed but not on* — receipted for manual review |
| ProgressBar | `variant` | AGREE | type/default/required agree |
| ProgressBar | `isIndeterminate` | AGREE | type/default/required agree |
| ProgressBar | `isDisabled` | AGREE | type/default/required agree |
| ProgressBar | `xstyle` | RECEIPTED | outside the declared single-file surface — the component carries the heritage/composed-refs receipt naming where it lives |
| Slider | `label` | AGREE | type/default/required agree |
| Slider | `onChange` | AGREE-EVENT | carried as a contract event |
| Slider | `onChangeEnd` | AGREE-EVENT | carried as a contract event |
| Slider | `min` | AGREE | type/default/required agree |
| Slider | `max` | AGREE | type/default/required agree |
| Slider | `step` | AGREE | type/default/required agree |
| Slider | `orientation` | AGREE | type/default/required agree |
| Slider | `formatValue` | RECEIPTED | function-typed but not on* — receipted for manual review |
| Slider | `valueDisplay` | AGREE | type/default/required agree |
| Slider | `isDisabled` | AGREE | type/default/required agree |
| Slider | `htmlName` | AGREE | type/default/required agree |
| Slider | `disabledMessage` | AGREE | type/default/required agree |
| Slider | `isOptional` | AGREE | type/default/required agree |
| Slider | `isRequired` | AGREE | type/default/required agree |
| Slider | `isLabelHidden` | AGREE | type/default/required agree |
| Slider | `description` | AGREE | type/default/required agree |
| Slider | `labelTooltip` | AGREE | type/default/required agree |
| Slider | `xstyle` | RECEIPTED | outside the declared single-file surface — the component carries the heritage/composed-refs receipt naming where it lives |
| Token | `label` | AGREE | type/default/required agree |
| Token | `size` | AGREE | type/default/required agree |
| Token | `color` | AGREE | type/default/required agree |
| Token | `icon` | RECEIPTED | ReactNode — receipted as a slot candidate (anatomy step) |
| Token | `isDisabled` | AGREE | type/default/required agree |
| Token | `onRemove` | AGREE-EVENT | carried as a contract event |
| Token | `onClick` | AGREE-EVENT | carried as a contract event |
| Token | `href` | AGREE | type/default/required agree |
| Token | `description` | AGREE | type/default/required agree |
| Token | `endContent` | RECEIPTED | ReactNode — receipted as a slot candidate (anatomy step) |
| Token | `isLabelHidden` | AGREE | type/default/required agree |
| Token | `xstyle` | RECEIPTED | outside the declared single-file surface — the component carries the heritage/composed-refs receipt naming where it lives |
| Banner | `title` | RECEIPTED | ReactNode — receipted as a slot candidate (anatomy step) |
| Banner | `description` | RECEIPTED | ReactNode — receipted as a slot candidate (anatomy step) |
| Banner | `icon` | RECEIPTED | ReactNode — receipted as a slot candidate (anatomy step) |
| Banner | `isDismissable` | AGREE | type/default/required agree |
| Banner | `onDismiss` | AGREE-EVENT | carried as a contract event |
| Banner | `endContent` | RECEIPTED | ReactNode — receipted as a slot candidate (anatomy step) |
| Banner | `container` | AGREE | type/default/required agree |
| Banner | `children` | RECEIPTED | platform prop — excluded by the shared exclusion list |
| Banner | `defaultIsExpanded` | AGREE | type/default/required agree |
| Banner | `xstyle` | RECEIPTED | outside the declared single-file surface — the component carries the heritage/composed-refs receipt naming where it lives |
| Skeleton | `index` | AGREE | type/default/required agree |

## Vendor anatomy tables (the human-owned anatomy seed)

Our StyleX-side proposals carry no anatomy (no CSS-module channel); the
vendor doc ships one per component. Recorded verbatim as the seed for the
anatomy step and the computed-floor round (Phase A-2):

- **Button**: Icon · Label (required) · End content · Spinner
- **CheckboxInput**: Checkbox (required) · Label (required) · Description · Status message
- **Badge**: Icon · Label (required)
- **Dialog**: Header (required) · Body (required) · Footer · Backdrop (required)
- **TabList**: Left Content · Center-Fill Content · Right Content
- **Table**: Column Header (required) · Body Rows (required) · Footer · Top Bar · Bottom Bar · Support Panels
- **TextInput**: Label (required) · Description · Start icon · Placeholder · Clear button · Spinner · Status icon
- **Toast**: Body (required) · End content · Dismiss button (required)
- **Breadcrumbs**: Trail (required) · Item (required) · Separator (required) · Icon
- **Avatar**: Photo · Initials · Default icon · Status dot
- **Card**: Container (required) · Content (required)
- **Popover**: Header (required) · Body (required) · Trigger Element (required)
- **Token**: Icon · Label (required) · End content · Remove button
- **Banner**: Icon (required) · Title · Description · Action button · Dismiss button · Collapsible content
- **Link**: Label (required) · Right icon · Left icon
