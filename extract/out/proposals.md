# Proposed contracts — extraction report

50 component(s) extracted. Every proposal parses against the contract schema, but a proposal is a STARTING POINT: confirm inferred design bindings via `npm run reconcile`, then review the notes below per component.

## AccordionItem

- source: `src/components/AccordionItem/AccordionItem.tsx` (react-tsx)
- proposed: 2 props, 1 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- prop `state`: figma binding INFERRED as VARIANT "State" — confirm against the design library (reconcile step)
- event `onToggle`: declared with trigger 'root' — assign the real trigger part once anatomy is authored

## Avatar

- source: `src/components/Avatar/Avatar.tsx` (react-tsx)
- proposed: 1 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- prop `size`: figma binding INFERRED as VARIANT "Size" — confirm against the design library (reconcile step)

## AvatarGroup

- source: `src/components/AvatarGroup/AvatarGroup.tsx` (react-tsx)
- proposed: 1 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element

## Badge

- source: `src/components/Badge/Badge.tsx` (react-tsx)
- proposed: 1 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- prop `variant`: figma binding INFERRED as VARIANT "Variant" — confirm against the design library (reconcile step)

## Banner

- source: `src/components/Banner/Banner.tsx` (react-tsx)
- proposed: 5 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- prop `status`: figma binding INFERRED as VARIANT "Status" — confirm against the design library (reconcile step)
- prop `container`: figma binding INFERRED as VARIANT "Container" — confirm against the design library (reconcile step)
- prop `endContent`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually

## Blockquote

- source: `src/components/Blockquote/Blockquote.tsx` (react-tsx)
- proposed: 0 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- prop `cite`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually

## BreadcrumbItem

- source: `src/components/BreadcrumbItem/BreadcrumbItem.tsx` (react-tsx)
- proposed: 3 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element

## Breadcrumbs

- source: `src/components/Breadcrumbs/Breadcrumbs.tsx` (react-tsx)
- proposed: 1 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element

## Button

- source: `src/components/Button/Button.tsx` (react-tsx)
- proposed: 4 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- prop `variant`: figma binding INFERRED as VARIANT "Variant" — confirm against the design library (reconcile step)
- prop `size`: figma binding INFERRED as VARIANT "Size" — confirm against the design library (reconcile step)

## Card

- source: `src/components/Card/Card.tsx` (react-tsx)
- proposed: 1 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- prop `actions`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually

## ChatMessage

- source: `src/components/ChatMessage/ChatMessage.tsx` (react-tsx)
- proposed: 2 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- prop `sender`: figma binding INFERRED as VARIANT "Sender" — confirm against the design library (reconcile step)
- prop `avatar`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually
- prop `metadata`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually

## ChatMessageMetadata

- source: `src/components/ChatMessageMetadata/ChatMessageMetadata.tsx` (react-tsx)
- proposed: 2 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- prop `status`: figma binding INFERRED as VARIANT "Status" — confirm against the design library (reconcile step)
- prop `footer`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually

## ChatSystemMessage

- source: `src/components/ChatSystemMessage/ChatSystemMessage.tsx` (react-tsx)
- proposed: 2 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- prop `variant`: figma binding INFERRED as VARIANT "Variant" — confirm against the design library (reconcile step)
- prop `icon`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually

## Checkbox

- source: `src/components/Checkbox/Checkbox.tsx` (react-tsx)
- proposed: 4 props, 1 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- prop `value`: figma binding INFERRED as VARIANT "Value" — confirm against the design library (reconcile step)
- prop `size`: figma binding INFERRED as VARIANT "Size" — confirm against the design library (reconcile step)
- event `onToggle`: declared with trigger 'root' — assign the real trigger part once anatomy is authored

## Citation

- source: `src/components/Citation/Citation.tsx` (react-tsx)
- proposed: 4 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- prop `variant`: figma binding INFERRED as VARIANT "Variant" — confirm against the design library (reconcile step)

## Code

- source: `src/components/Code/Code.tsx` (react-tsx)
- proposed: 0 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element

## Divider

- source: `src/components/Divider/Divider.tsx` (react-tsx)
- proposed: 1 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- prop `variant`: figma binding INFERRED as VARIANT "Variant" — confirm against the design library (reconcile step)

## EmptyState

- source: `src/components/EmptyState/EmptyState.tsx` (react-tsx)
- proposed: 2 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- prop `icon`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually
- prop `actions`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually

## Field

- source: `src/components/Field/Field.tsx` (react-tsx)
- proposed: 4 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element

## IconButton

- source: `src/components/IconButton/IconButton.tsx` (react-tsx)
- proposed: 4 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- prop `variant`: figma binding INFERRED as VARIANT "Variant" — confirm against the design library (reconcile step)
- prop `size`: figma binding INFERRED as VARIANT "Size" — confirm against the design library (reconcile step)
- prop `icon`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually

## Inline

- source: `src/components/Inline/Inline.tsx` (react-tsx)
- proposed: 1 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- prop `gap`: figma binding INFERRED as VARIANT "Gap" — confirm against the design library (reconcile step)

## Kbd

- source: `src/components/Kbd/Kbd.tsx` (react-tsx)
- proposed: 1 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element

## List

- source: `src/components/List/List.tsx` (react-tsx)
- proposed: 1 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- prop `density`: figma binding INFERRED as VARIANT "Density" — confirm against the design library (reconcile step)

## ListItem

- source: `src/components/ListItem/ListItem.tsx` (react-tsx)
- proposed: 2 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- prop `startContent`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually
- prop `endContent`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually

## MetadataList

- source: `src/components/MetadataList/MetadataList.tsx` (react-tsx)
- proposed: 1 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element

## MetadataListItem

- source: `src/components/MetadataListItem/MetadataListItem.tsx` (react-tsx)
- proposed: 2 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- prop `icon`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually

## Pagination

- source: `src/components/Pagination/Pagination.tsx` (react-tsx)
- proposed: 3 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- prop `variant`: figma binding INFERRED as VARIANT "Variant" — confirm against the design library (reconcile step)

## ProgressBar

- source: `src/components/ProgressBar/ProgressBar.tsx` (react-tsx)
- proposed: 4 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- prop `variant`: figma binding INFERRED as VARIANT "Variant" — confirm against the design library (reconcile step)

## Section

- source: `src/components/Section/Section.tsx` (react-tsx)
- proposed: 1 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- prop `variant`: figma binding INFERRED as VARIANT "Variant" — confirm against the design library (reconcile step)

## SideNavItem

- source: `src/components/SideNavItem/SideNavItem.tsx` (react-tsx)
- proposed: 3 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- prop `state`: figma binding INFERRED as VARIANT "State" — confirm against the design library (reconcile step)
- prop `icon`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually
- prop `endContent`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually

## Skeleton

- source: `src/components/Skeleton/Skeleton.tsx` (react-tsx)
- proposed: 1 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- prop `variant`: figma binding INFERRED as VARIANT "Variant" — confirm against the design library (reconcile step)

## Slider

- source: `src/components/Slider/Slider.tsx` (react-tsx)
- proposed: 3 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element

## Spinner

- source: `src/components/Spinner/Spinner.tsx` (react-tsx)
- proposed: 1 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element

## Stack

- source: `src/components/Stack/Stack.tsx` (react-tsx)
- proposed: 1 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- prop `gap`: figma binding INFERRED as VARIANT "Gap" — confirm against the design library (reconcile step)

## StatusDot

- source: `src/components/StatusDot/StatusDot.tsx` (react-tsx)
- proposed: 2 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- prop `variant`: figma binding INFERRED as VARIANT "Variant" — confirm against the design library (reconcile step)

## Switch

- source: `src/components/Switch/Switch.tsx` (react-tsx)
- proposed: 3 props, 1 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- prop `value`: figma binding INFERRED as VARIANT "Value" — confirm against the design library (reconcile step)
- event `onToggle`: declared with trigger 'root' — assign the real trigger part once anatomy is authored

## Tab

- source: `src/components/Tab/Tab.tsx` (react-tsx)
- proposed: 2 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- prop `state`: figma binding INFERRED as VARIANT "State" — confirm against the design library (reconcile step)
- prop `icon`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually
- prop `endContent`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually

## Table

- source: `src/components/Table/Table.tsx` (react-tsx)
- proposed: 1 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- prop `density`: figma binding INFERRED as VARIANT "Density" — confirm against the design library (reconcile step)

## TableCell

- source: `src/components/TableCell/TableCell.tsx` (react-tsx)
- proposed: 1 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- prop `density`: figma binding INFERRED as VARIANT "Density" — confirm against the design library (reconcile step)

## TableHeaderCell

- source: `src/components/TableHeaderCell/TableHeaderCell.tsx` (react-tsx)
- proposed: 1 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- prop `density`: figma binding INFERRED as VARIANT "Density" — confirm against the design library (reconcile step)

## TableRow

- source: `src/components/TableRow/TableRow.tsx` (react-tsx)
- proposed: 1 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- prop `state`: figma binding INFERRED as VARIANT "State" — confirm against the design library (reconcile step)

## TabList

- source: `src/components/TabList/TabList.tsx` (react-tsx)
- proposed: 0 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element

## TextArea

- source: `src/components/TextArea/TextArea.tsx` (react-tsx)
- proposed: 5 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- prop `size`: figma binding INFERRED as VARIANT "Size" — confirm against the design library (reconcile step)

## TextField

- source: `src/components/TextField/TextField.tsx` (react-tsx)
- proposed: 6 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- prop `size`: figma binding INFERRED as VARIANT "Size" — confirm against the design library (reconcile step)

## Toast

- source: `src/components/Toast/Toast.tsx` (react-tsx)
- proposed: 1 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- prop `type`: figma binding INFERRED as VARIANT "Type" — confirm against the design library (reconcile step)
- prop `endContent`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually

## Token

- source: `src/components/Token/Token.tsx` (react-tsx)
- proposed: 4 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- prop `color`: figma binding INFERRED as VARIANT "Color" — confirm against the design library (reconcile step)
- prop `size`: figma binding INFERRED as VARIANT "Size" — confirm against the design library (reconcile step)
- prop `icon`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually
- prop `endContent`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually

## Toolbar

- source: `src/components/Toolbar/Toolbar.tsx` (react-tsx)
- proposed: 2 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- prop `size`: figma binding INFERRED as VARIANT "Size" — confirm against the design library (reconcile step)
- prop `startContent`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually
- prop `centerContent`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually
- prop `endContent`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually

## TopNav

- source: `src/components/TopNav/TopNav.tsx` (react-tsx)
- proposed: 1 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- prop `heading`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually
- prop `startContent`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually
- prop `endContent`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually

## TopNavItem

- source: `src/components/TopNavItem/TopNavItem.tsx` (react-tsx)
- proposed: 3 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- prop `state`: figma binding INFERRED as VARIANT "State" — confirm against the design library (reconcile step)
- prop `icon`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually

## TypeaheadItem

- source: `src/components/TypeaheadItem/TypeaheadItem.tsx` (react-tsx)
- proposed: 2 props, 0 events
- anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)
- semantics.element defaulted to "div" — set the real host element
- prop `icon`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually

