# Reconciliation — where your two surfaces disagree

**49/51** code components matched a design component by name. Across matched pairs: **103** properties agree, **9** need a human decision. Each disagreement below is a reconciliation-workshop line item: decide code-is-right, design-is-right, or neither — the decisions become contract v1 (docs/11 Phase 2).

## AccordionItem ⇄ AccordionItem

- agrees on 2/2 properties

## Avatar ⇄ Avatar

- agrees on 1/2 properties
- ⚠️ **Initials** — design only: no matching code prop — a design TEXT property with no code counterpart is often bound to React `children` (invisible in a props interface); confirm before treating as drift

## AvatarGroup ⇄ AvatarGroup

- agrees on 1/1 properties

## Badge ⇄ Badge

- agrees on 1/2 properties
- ⚠️ **Label** — design only: no matching code prop — a design TEXT property with no code counterpart is often bound to React `children` (invisible in a props interface); confirm before treating as drift

## Banner ⇄ Banner

- agrees on 5/5 properties

## Blockquote ⇄ Blockquote

- agrees on 0/0 properties

## BreadcrumbItem ⇄ BreadcrumbItem

- agrees on 3/3 properties

## Breadcrumbs ⇄ Breadcrumbs

- agrees on 1/1 properties

## Button ⇄ Button

- agrees on 4/6 properties
- ⚠️ **State** — design only: variant [Default, Hover, Focus Visible, Disabled] — no matching code prop
- ⚠️ **Label** — design only: no matching code prop — a design TEXT property with no code counterpart is often bound to React `children` (invisible in a props interface); confirm before treating as drift

## Card ⇄ Card

- agrees on 1/1 properties

## ChatMessage ⇄ ChatMessage

- agrees on 2/2 properties

## ChatMessageMetadata ⇄ ChatMessageMetadata

- agrees on 2/2 properties

## ChatSystemMessage ⇄ ChatSystemMessage

- agrees on 2/2 properties

## Checkbox ⇄ Checkbox

- agrees on 4/4 properties

## Citation ⇄ Citation

- agrees on 4/4 properties

## Code ⇄ Code

- agrees on 0/1 properties
- ⚠️ **Content** — design only: no matching code prop — a design TEXT property with no code counterpart is often bound to React `children` (invisible in a props interface); confirm before treating as drift

## Divider ⇄ Divider

- agrees on 1/1 properties

## EmptyState ⇄ EmptyState

- agrees on 2/2 properties

## Field ⇄ Field

- agrees on 4/4 properties

## Heading ⇄ Heading

- agrees on 1/3 properties
- ⚠️ **level / Level** — option sets differ: code [1, 2, 3, 4, 5, 6] vs design [H2, H1, H3, H4, H5, H6]
- ⚠️ **Text** — design only: no matching code prop — a design TEXT property with no code counterpart is often bound to React `children` (invisible in a props interface); confirm before treating as drift

## IconButton ⇄ IconButton

- agrees on 4/4 properties

## Kbd ⇄ Kbd

- agrees on 1/1 properties

## List ⇄ List

- agrees on 1/1 properties

## ListItem ⇄ ListItem

- agrees on 2/2 properties

## MetadataList ⇄ MetadataList

- agrees on 1/1 properties

## MetadataListItem ⇄ MetadataListItem

- agrees on 2/2 properties

## Pagination ⇄ Pagination

- agrees on 3/3 properties

## ProgressBar ⇄ ProgressBar

- agrees on 4/4 properties

## Section ⇄ Section

- agrees on 1/1 properties

## SideNavItem ⇄ SideNavItem

- agrees on 3/3 properties

## Skeleton ⇄ Skeleton

- agrees on 1/1 properties

## Slider ⇄ Slider

- agrees on 3/3 properties

## Spinner ⇄ Spinner

- agrees on 1/1 properties

## StatusDot ⇄ StatusDot

- agrees on 2/2 properties

## Switch ⇄ Switch

- agrees on 3/3 properties

## Tab ⇄ Tab

- agrees on 2/2 properties

## Table ⇄ Table

- agrees on 1/1 properties

## TableCell ⇄ TableCell

- agrees on 1/2 properties
- ⚠️ **Content** — design only: no matching code prop — a design TEXT property with no code counterpart is often bound to React `children` (invisible in a props interface); confirm before treating as drift

## TableHeaderCell ⇄ TableHeaderCell

- agrees on 1/2 properties
- ⚠️ **Label** — design only: no matching code prop — a design TEXT property with no code counterpart is often bound to React `children` (invisible in a props interface); confirm before treating as drift

## TableRow ⇄ TableRow

- agrees on 1/1 properties

## TabList ⇄ TabList

- agrees on 0/0 properties

## TextArea ⇄ TextArea

- agrees on 5/5 properties

## TextField ⇄ TextField

- agrees on 6/6 properties

## Toast ⇄ Toast

- agrees on 1/1 properties

## Token ⇄ Token

- agrees on 4/4 properties

## Toolbar ⇄ Toolbar

- agrees on 2/2 properties

## TopNav ⇄ TopNav

- agrees on 1/1 properties

## TopNavItem ⇄ TopNavItem

- agrees on 3/3 properties

## TypeaheadItem ⇄ TypeaheadItem

- agrees on 2/2 properties

## Components in code with no design counterpart

- Inline (`src/components/Inline/Inline.tsx`)
- Stack (`src/components/Stack/Stack.tsx`)

