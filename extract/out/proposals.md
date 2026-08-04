# Proposed contracts — extraction report

51 component(s) extracted, 51 with extracted anatomy. Every proposal parses against the contract schema, but a proposal is a STARTING POINT: confirm inferred design bindings via `ds-contracts extract --reconcile` (`npm run reconcile` in the reference repo), then review the notes below per component.

## AccordionItem

- source: `src/components/AccordionItem/AccordionItem.tsx` (react-tsx)
- proposed: 2 props, 1 events
- anatomy EXTRACTED from JSX + CSS Module — 5 part(s), 17 token binding(s), 0 raw value(s) reported. Anatomy is human-REVIEWED: check it against design intent before adoption.
- props type extends HTMLAttributes<HTMLDivElement> — parent members are outside single-file extraction and are NOT carried
- prop `state`: figma binding INFERRED as VARIANT "State" — confirm against the design library (reconcile step)
- prop `state`: default 'closed' read from the uncontrolled useState initializer
- prop `title`: required text prop declared no default — sample default "Title" seeded from the prop name; replace with your canonical sample text (it is the canvas default and the story sample)
- event `onToggle`: trigger 'trigger' read from the onClick wiring; toggles state between [closed, open]
- jsx: part "chevron" renders an inline SVG glyph — icon asset not extracted (review item)
- css: selector `.chevron svg` — icon glyph sizing, not extracted (icon parts are review items)
- css: .chevron { flex-shrink: 0 } — no inversion rule, not extracted

## Avatar

- source: `src/components/Avatar/Avatar.tsx` (react-tsx)
- proposed: 1 props, 0 events
- anatomy EXTRACTED from JSX + CSS Module — 1 part(s), 8 token binding(s), 0 raw value(s) reported. Anatomy is human-REVIEWED: check it against design intent before adoption.
- props type extends HTMLAttributes<HTMLSpanElement> — parent members are outside single-file extraction and are NOT carried
- prop `size`: figma binding INFERRED as VARIANT "Size" — confirm against the design library (reconcile step)
- jsx: root renders {children} directly — children channel (text prop vs default slot) is not decidable from code

## AvatarGroup

- source: `src/components/AvatarGroup/AvatarGroup.tsx` (react-tsx)
- proposed: 1 props, 0 events
- anatomy EXTRACTED from JSX + CSS Module — 3 part(s), 10 token binding(s), 0 raw value(s) reported. Anatomy is human-REVIEWED: check it against design intent before adoption.
- props type extends HTMLAttributes<HTMLDivElement> — parent members are outside single-file extraction and are NOT carried

## Badge

- source: `src/components/Badge/Badge.tsx` (react-tsx)
- proposed: 1 props, 0 events
- anatomy EXTRACTED from JSX + CSS Module — 1 part(s), 8 token binding(s), 0 raw value(s) reported. Anatomy is human-REVIEWED: check it against design intent before adoption.
- props type extends HTMLAttributes<HTMLSpanElement> — parent members are outside single-file extraction and are NOT carried
- prop `variant`: figma binding INFERRED as VARIANT "Variant" — confirm against the design library (reconcile step)
- jsx: root renders {children} directly — children channel (text prop vs default slot) is not decidable from code

## Banner

- source: `src/components/Banner/Banner.tsx` (react-tsx)
- proposed: 5 props, 0 events
- anatomy EXTRACTED from JSX + CSS Module — 9 part(s), 14 token binding(s), 0 raw value(s) reported. Anatomy is human-REVIEWED: check it against design intent before adoption.
- props type extends HTMLAttributes<HTMLDivElement> — parent members are outside single-file extraction and are NOT carried
- prop `status`: figma binding INFERRED as VARIANT "Status" — confirm against the design library (reconcile step)
- prop `container`: figma binding INFERRED as VARIANT "Container" — confirm against the design library (reconcile step)
- prop `title`: required text prop declared no default — sample default "Title" seeded from the prop name; replace with your canonical sample text (it is the canvas default and the story sample)
- prop `endContent`: ReactNode — extracted as anatomy slot "endContent"
- jsx: <div> attribute role={…} — expression not extractable, skipped
- jsx: part "statusIcon" renders an inline SVG glyph — icon asset not extracted (review item)
- jsx: part "closeGlyph" renders an inline SVG glyph — icon asset not extracted (review item)
- css: .statusIcon { flex-shrink: 0 } — no inversion rule, not extracted
- css: .close { flex-shrink: 0 } — no inversion rule, not extracted

## Blockquote

- source: `src/components/Blockquote/Blockquote.tsx` (react-tsx)
- proposed: 0 props, 0 events
- anatomy EXTRACTED from JSX + CSS Module — 3 part(s), 9 token binding(s), 0 raw value(s) reported. Anatomy is human-REVIEWED: check it against design intent before adoption.
- props type extends HTMLAttributes<HTMLQuoteElement> — parent members are outside single-file extraction and are NOT carried
- prop `cite`: ReactNode — extracted as anatomy slot "cite"

## BreadcrumbItem

- source: `src/components/BreadcrumbItem/BreadcrumbItem.tsx` (react-tsx)
- proposed: 3 props, 0 events
- anatomy EXTRACTED from JSX + CSS Module — 3 part(s), 5 token binding(s), 0 raw value(s) reported. Anatomy is human-REVIEWED: check it against design intent before adoption.
- props type extends HTMLAttributes<HTMLSpanElement> — parent members are outside single-file extraction and are NOT carried
- prop `label`: required text prop declared no default — sample default "Label" seeded from the prop name; replace with your canonical sample text (it is the canvas default and the story sample)
- prop `href`: declared as text but no part's content (or textByProp) binds it — the generated component renders children; wire content.prop to `href` in the anatomy or drop the prop
- jsx: part "separatorIcon" renders an inline SVG glyph — icon asset not extracted (review item)
- css: selector `.separatorIcon svg` — icon glyph sizing, not extracted (icon parts are review items)
- css: .separatorIcon { flex-shrink: 0 } — no inversion rule, not extracted

## Breadcrumbs

- source: `src/components/Breadcrumbs/Breadcrumbs.tsx` (react-tsx)
- proposed: 1 props, 0 events
- anatomy EXTRACTED from JSX + CSS Module — 2 part(s), 2 token binding(s), 0 raw value(s) reported. Anatomy is human-REVIEWED: check it against design intent before adoption.
- props type extends HTMLAttributes<HTMLElement> — parent members are outside single-file extraction and are NOT carried
- prop `label`: required text prop declared no default — sample default "Label" seeded from the prop name; replace with your canonical sample text (it is the canvas default and the story sample)
- prop `label`: declared as text but no part's content (or textByProp) binds it — the generated component renders children; wire content.prop to `label` in the anatomy or drop the prop

## Button

- source: `src/components/Button/Button.tsx` (react-tsx)
- proposed: 4 props, 0 events
- anatomy EXTRACTED from JSX + CSS Module — 3 part(s), 9 token binding(s), 0 raw value(s) reported. Anatomy is human-REVIEWED: check it against design intent before adoption.
- props type extends ButtonHTMLAttributes<HTMLButtonElement> — parent members are outside single-file extraction and are NOT carried
- prop `variant`: figma binding INFERRED as VARIANT "Variant" — confirm against the design library (reconcile step)
- prop `size`: figma binding INFERRED as VARIANT "Size" — confirm against the design library (reconcile step)
- jsx: <button> attribute disabled={…} — expression not extractable, skipped
- jsx: part "loadingSpinner" renders an inline SVG glyph — icon asset not extracted (review item)
- css: selector `.root::before` — not extractable into anatomy, skipped by name
- css: selector `.loadingSpinner svg` — icon glyph sizing, not extracted (icon parts are review items)
- css: .loadingSpinner { flex-shrink: 0 } — no inversion rule, not extracted

## Card

- source: `src/components/Card/Card.tsx` (react-tsx)
- proposed: 1 props, 0 events
- anatomy EXTRACTED from JSX + CSS Module — 6 part(s), 21 token binding(s), 0 raw value(s) reported. Anatomy is human-REVIEWED: check it against design intent before adoption.
- props type extends HTMLAttributes<HTMLElement> — parent members are outside single-file extraction and are NOT carried
- prop `title`: required text prop declared no default — sample default "Title" seeded from the prop name; replace with your canonical sample text (it is the canvas default and the story sample)
- prop `actions`: ReactNode — extracted as anatomy slot "actions"
- anatomy: component ref `<Avatar>` mapped to contract id `ds.avatar` — confirm that contract exists (or adjust the id) before adoption

## ChatMessage

- source: `src/components/ChatMessage/ChatMessage.tsx` (react-tsx)
- proposed: 2 props, 0 events
- anatomy EXTRACTED from JSX + CSS Module — 6 part(s), 14 token binding(s), 0 raw value(s) reported. Anatomy is human-REVIEWED: check it against design intent before adoption.
- props type extends HTMLAttributes<HTMLDivElement> — parent members are outside single-file extraction and are NOT carried
- prop `sender`: figma binding INFERRED as VARIANT "Sender" — confirm against the design library (reconcile step)
- prop `avatar`: ReactNode — extracted as anatomy slot "avatar"
- prop `metadata`: ReactNode — extracted as anatomy slot "metadata"
- css: .sender-user { flex-direction: row-reverse } — a per-variant layout override (contract layoutByProp); not extracted, author it against design intent
- css: .sender-user .body { align-items: flex-end } — a per-variant layout override (contract layoutByProp); not extracted, author it against design intent

## ChatMessageMetadata

- source: `src/components/ChatMessageMetadata/ChatMessageMetadata.tsx` (react-tsx)
- proposed: 2 props, 0 events
- anatomy EXTRACTED from JSX + CSS Module — 4 part(s), 5 token binding(s), 0 raw value(s) reported. Anatomy is human-REVIEWED: check it against design intent before adoption.
- props type extends HTMLAttributes<HTMLDivElement> — parent members are outside single-file extraction and are NOT carried
- prop `status`: figma binding INFERRED as VARIANT "Status" — confirm against the design library (reconcile step)
- prop `footer`: ReactNode — extracted as anatomy slot "footer"
- jsx: part "statusIcon" renders an inline SVG glyph — icon asset not extracted (review item)
- css: selector `.statusIcon svg` — icon glyph sizing, not extracted (icon parts are review items)
- css: .statusIcon { flex-shrink: 0 } — no inversion rule, not extracted

## ChatSystemMessage

- source: `src/components/ChatSystemMessage/ChatSystemMessage.tsx` (react-tsx)
- proposed: 2 props, 0 events
- anatomy EXTRACTED from JSX + CSS Module — 5 part(s), 9 token binding(s), 0 raw value(s) reported. Anatomy is human-REVIEWED: check it against design intent before adoption.
- props type extends HTMLAttributes<HTMLDivElement> — parent members are outside single-file extraction and are NOT carried
- prop `variant`: figma binding INFERRED as VARIANT "Variant" — confirm against the design library (reconcile step)
- prop `message`: required text prop declared no default — sample default "Message" seeded from the prop name; replace with your canonical sample text (it is the canvas default and the story sample)
- prop `icon`: ReactNode — extracted as anatomy slot "icon"

## Checkbox

- source: `src/components/Checkbox/Checkbox.tsx` (react-tsx)
- proposed: 4 props, 1 events
- anatomy EXTRACTED from JSX + CSS Module — 8 part(s), 15 token binding(s), 2 raw value(s) reported. Anatomy is human-REVIEWED: check it against design intent before adoption.
- props type extends LabelHTMLAttributes<HTMLLabelElement> — parent members are outside single-file extraction and are NOT carried
- prop `value`: figma binding INFERRED as VARIANT "Value" — confirm against the design library (reconcile step)
- prop `value`: default 'unchecked' read from the uncontrolled useState initializer
- prop `size`: figma binding INFERRED as VARIANT "Size" — confirm against the design library (reconcile step)
- prop `label`: required text prop declared no default — sample default "Label" seeded from the prop name; replace with your canonical sample text (it is the canvas default and the story sample)
- event `onToggle`: trigger 'input' read from the onClick wiring; toggles value between [unchecked, checked]
- RAW VALUE (not tokenized): `.input { width: 100% }` — no token in the tree has this value. A raw value is reported, never turned into an invented token; bind it to a real token and re-extract.
- RAW VALUE (not tokenized): `.input { height: 100% }` — no token in the tree has this value. A raw value is reported, never turned into an invented token; bind it to a real token and re-extract.
- jsx: part "checkGlyph" renders an inline SVG glyph — icon asset not extracted (review item)
- jsx: part "dashGlyph" renders an inline SVG glyph — icon asset not extracted (review item)
- css: selector `.box:has(> .input:focus-visible)` — pseudo ":has(> .input:focus-visible)" is not a contract state, not extracted
- css: .input { inset: 0 } — no inversion rule, not extracted
- css: .input { opacity: 0 } — no inversion rule, not extracted
- css: .input position:absolute with insets (top:;bottom:;left:;right:) — not a generator overlay placement, not extracted
- css: selector `.checkGlyph svg` — icon glyph sizing, not extracted (icon parts are review items)
- css: .checkGlyph { flex-shrink: 0 } — no inversion rule, not extracted
- css: selector `.dashGlyph svg` — icon glyph sizing, not extracted (icon parts are review items)
- css: .dashGlyph { flex-shrink: 0 } — no inversion rule, not extracted

## Citation

- source: `src/components/Citation/Citation.tsx` (react-tsx)
- proposed: 4 props, 0 events
- anatomy EXTRACTED from JSX + CSS Module — 3 part(s), 8 token binding(s), 0 raw value(s) reported. Anatomy is human-REVIEWED: check it against design intent before adoption.
- props type extends AnchorHTMLAttributes<HTMLAnchorElement> — parent members are outside single-file extraction and are NOT carried
- prop `variant`: figma binding INFERRED as VARIANT "Variant" — confirm against the design library (reconcile step)
- prop `sourceTitle`: required text prop declared no default — sample default "Source Title" seeded from the prop name; replace with your canonical sample text (it is the canvas default and the story sample)
- prop `href`: declared as text but no part's content (or textByProp) binds it — the generated component renders children; wire content.prop to `href` in the anatomy or drop the prop

## Code

- source: `src/components/Code/Code.tsx` (react-tsx)
- proposed: 0 props, 0 events
- anatomy EXTRACTED from JSX + CSS Module — 1 part(s), 7 token binding(s), 0 raw value(s) reported. Anatomy is human-REVIEWED: check it against design intent before adoption.
- props type has NO OWN members (extends HTMLAttributes<HTMLElement> — parent members are outside single-file extraction): zero own props is what this module declares — review
- jsx: root renders {children} directly — children channel (text prop vs default slot) is not decidable from code

## Divider

- source: `src/components/Divider/Divider.tsx` (react-tsx)
- proposed: 1 props, 0 events
- anatomy EXTRACTED from JSX + CSS Module — 1 part(s), 3 token binding(s), 0 raw value(s) reported. Anatomy is human-REVIEWED: check it against design intent before adoption.
- props type extends HTMLAttributes<HTMLHRElement> — parent members are outside single-file extraction and are NOT carried
- prop `variant`: figma binding INFERRED as VARIANT "Variant" — confirm against the design library (reconcile step)
- jsx: root renders {children} directly — children channel (text prop vs default slot) is not decidable from code

## EmptyState

- source: `src/components/EmptyState/EmptyState.tsx` (react-tsx)
- proposed: 2 props, 0 events
- anatomy EXTRACTED from JSX + CSS Module — 5 part(s), 12 token binding(s), 0 raw value(s) reported. Anatomy is human-REVIEWED: check it against design intent before adoption.
- props type extends HTMLAttributes<HTMLDivElement> — parent members are outside single-file extraction and are NOT carried
- prop `title`: required text prop declared no default — sample default "Title" seeded from the prop name; replace with your canonical sample text (it is the canvas default and the story sample)
- prop `icon`: ReactNode — extracted as anatomy slot "icon"
- prop `actions`: ReactNode — extracted as anatomy slot "actions"

## Field

- source: `src/components/Field/Field.tsx` (react-tsx)
- proposed: 4 props, 0 events
- anatomy EXTRACTED from JSX + CSS Module — 6 part(s), 10 token binding(s), 0 raw value(s) reported. Anatomy is human-REVIEWED: check it against design intent before adoption.
- props type extends HTMLAttributes<HTMLDivElement> — parent members are outside single-file extraction and are NOT carried
- prop `label`: required text prop declared no default — sample default "Label" seeded from the prop name; replace with your canonical sample text (it is the canvas default and the story sample)
- prop `inputID`: required text prop declared no default — sample default "Input ID" seeded from the prop name; replace with your canonical sample text (it is the canvas default and the story sample)
- prop `inputID`: declared as text but no part's content (or textByProp) binds it — the generated component renders children; wire content.prop to `inputID` in the anatomy or drop the prop
- jsx: part "requiredMark" renders an inline SVG glyph — icon asset not extracted (review item)
- css: selector `.requiredMark svg` — icon glyph sizing, not extracted (icon parts are review items)
- css: .requiredMark { flex-shrink: 0 } — no inversion rule, not extracted

## Heading

- source: `src/components/Heading/Heading.tsx` (react-tsx)
- proposed: 2 props, 0 events
- anatomy EXTRACTED from JSX + CSS Module — 1 part(s), 4 token binding(s), 0 raw value(s) reported. Anatomy is human-REVIEWED: check it against design intent before adoption.
- props type extends HTMLAttributes<HTMLElement> — parent members are outside single-file extraction and are NOT carried
- prop `level`: figma binding INFERRED as VARIANT "Level" — confirm against the design library (reconcile step)
- prop `size`: figma binding INFERRED as VARIANT "Size" — confirm against the design library (reconcile step)
- anatomy: component ref `<Tag>` mapped to contract id `ds.tag` — confirm that contract exists (or adjust the id) before adoption
- jsx: <Tag> prop ref={…} — expression not extractable on a component ref, skipped
- jsx: <Tag> prop className={…} — expression not extractable on a component ref, skipped
- jsx: <Tag> has element children — extracted as parts INSIDE the component-ref boundary (the ref's slot content); review whether <Tag> is a pass-through wrapper before adoption
- jsx: root element <Tag> is a component — extracted as a component-ref ROOT with its slot content as parts (wrapper mapping is a review item)
- jsx: root renders {children} directly — children channel (text prop vs default slot) is not decidable from code

## IconButton

- source: `src/components/IconButton/IconButton.tsx` (react-tsx)
- proposed: 4 props, 0 events
- anatomy EXTRACTED from JSX + CSS Module — 2 part(s), 5 token binding(s), 0 raw value(s) reported. Anatomy is human-REVIEWED: check it against design intent before adoption.
- props type extends ButtonHTMLAttributes<HTMLButtonElement> — parent members are outside single-file extraction and are NOT carried
- prop `variant`: figma binding INFERRED as VARIANT "Variant" — confirm against the design library (reconcile step)
- prop `size`: figma binding INFERRED as VARIANT "Size" — confirm against the design library (reconcile step)
- prop `label`: required text prop declared no default — sample default "Label" seeded from the prop name; replace with your canonical sample text (it is the canvas default and the story sample)
- prop `icon`: ReactNode — extracted as anatomy slot "icon"
- prop `label`: declared as text but no part's content (or textByProp) binds it — the generated component renders children; wire content.prop to `label` in the anatomy or drop the prop

## Inline

- source: `src/components/Inline/Inline.tsx` (react-tsx)
- proposed: 1 props, 0 events
- anatomy EXTRACTED from JSX + CSS Module — 1 part(s), 1 token binding(s), 0 raw value(s) reported. Anatomy is human-REVIEWED: check it against design intent before adoption.
- props type extends HTMLAttributes<HTMLDivElement> — parent members are outside single-file extraction and are NOT carried
- prop `gap`: figma binding INFERRED as VARIANT "Gap" — confirm against the design library (reconcile step)
- jsx: root renders {children} directly — children channel (text prop vs default slot) is not decidable from code

## Kbd

- source: `src/components/Kbd/Kbd.tsx` (react-tsx)
- proposed: 1 props, 0 events
- anatomy EXTRACTED from JSX + CSS Module — 2 part(s), 9 token binding(s), 0 raw value(s) reported. Anatomy is human-REVIEWED: check it against design intent before adoption.
- props type extends HTMLAttributes<HTMLElement> — parent members are outside single-file extraction and are NOT carried
- prop `keys`: required text prop declared no default — sample default "Keys" seeded from the prop name; replace with your canonical sample text (it is the canvas default and the story sample)

## List

- source: `src/components/List/List.tsx` (react-tsx)
- proposed: 1 props, 0 events
- anatomy EXTRACTED from JSX + CSS Module — 2 part(s), 9 token binding(s), 0 raw value(s) reported. Anatomy is human-REVIEWED: check it against design intent before adoption.
- props type extends HTMLAttributes<HTMLUListElement> — parent members are outside single-file extraction and are NOT carried
- prop `density`: figma binding INFERRED as VARIANT "Density" — confirm against the design library (reconcile step)

## ListItem

- source: `src/components/ListItem/ListItem.tsx` (react-tsx)
- proposed: 2 props, 0 events
- anatomy EXTRACTED from JSX + CSS Module — 6 part(s), 10 token binding(s), 0 raw value(s) reported. Anatomy is human-REVIEWED: check it against design intent before adoption.
- props type extends LiHTMLAttributes<HTMLLIElement> — parent members are outside single-file extraction and are NOT carried
- prop `label`: required text prop declared no default — sample default "Label" seeded from the prop name; replace with your canonical sample text (it is the canvas default and the story sample)
- prop `startContent`: ReactNode — extracted as anatomy slot "startContent"
- prop `endContent`: ReactNode — extracted as anatomy slot "endContent"

## MetadataList

- source: `src/components/MetadataList/MetadataList.tsx` (react-tsx)
- proposed: 1 props, 0 events
- anatomy EXTRACTED from JSX + CSS Module — 3 part(s), 7 token binding(s), 0 raw value(s) reported. Anatomy is human-REVIEWED: check it against design intent before adoption.
- props type extends HTMLAttributes<HTMLDivElement> — parent members are outside single-file extraction and are NOT carried

## MetadataListItem

- source: `src/components/MetadataListItem/MetadataListItem.tsx` (react-tsx)
- proposed: 2 props, 0 events
- anatomy EXTRACTED from JSX + CSS Module — 4 part(s), 7 token binding(s), 0 raw value(s) reported. Anatomy is human-REVIEWED: check it against design intent before adoption.
- props type extends HTMLAttributes<HTMLDivElement> — parent members are outside single-file extraction and are NOT carried
- prop `label`: required text prop declared no default — sample default "Label" seeded from the prop name; replace with your canonical sample text (it is the canvas default and the story sample)
- prop `icon`: ReactNode — extracted as anatomy slot "icon"

## Pagination

- source: `src/components/Pagination/Pagination.tsx` (react-tsx)
- proposed: 3 props, 0 events
- anatomy EXTRACTED from JSX + CSS Module — 16 part(s), 40 token binding(s), 0 raw value(s) reported. Anatomy is human-REVIEWED: check it against design intent before adoption.
- props type extends HTMLAttributes<HTMLElement> — parent members are outside single-file extraction and are NOT carried
- prop `variant`: figma binding INFERRED as VARIANT "Variant" — confirm against the design library (reconcile step)
- prop `label`: required text prop declared no default — sample default "Label" seeded from the prop name; replace with your canonical sample text (it is the canvas default and the story sample)
- prop `label`: declared as text but no part's content (or textByProp) binds it — the generated component renders children; wire content.prop to `label` in the anatomy or drop the prop
- jsx: part "prevButtonGlyph" renders an inline SVG glyph — icon asset not extracted (review item)
- jsx: part "nextButtonGlyph" renders an inline SVG glyph — icon asset not extracted (review item)
- css: selector `.prevButton svg` — icon glyph sizing, not extracted (icon parts are review items)
- css: .prevButton { flex-shrink: 0 } — no inversion rule, not extracted
- css: selector `.nextButton svg` — icon glyph sizing, not extracted (icon parts are review items)
- css: .nextButton { flex-shrink: 0 } — no inversion rule, not extracted

## ProgressBar

- source: `src/components/ProgressBar/ProgressBar.tsx` (react-tsx)
- proposed: 4 props, 0 events
- anatomy EXTRACTED from JSX + CSS Module — 3 part(s), 8 token binding(s), 0 raw value(s) reported. Anatomy is human-REVIEWED: check it against design intent before adoption.
- props type extends HTMLAttributes<HTMLDivElement> — parent members are outside single-file extraction and are NOT carried
- prop `variant`: figma binding INFERRED as VARIANT "Variant" — confirm against the design library (reconcile step)
- prop `label`: required text prop declared no default — sample default "Label" seeded from the prop name; replace with your canonical sample text (it is the canvas default and the story sample)
- prop `label`: declared as text but no part's content (or textByProp) binds it — the generated component renders children; wire content.prop to `label` in the anatomy or drop the prop

## Section

- source: `src/components/Section/Section.tsx` (react-tsx)
- proposed: 1 props, 0 events
- anatomy EXTRACTED from JSX + CSS Module — 2 part(s), 9 token binding(s), 0 raw value(s) reported. Anatomy is human-REVIEWED: check it against design intent before adoption.
- props type extends HTMLAttributes<HTMLElement> — parent members are outside single-file extraction and are NOT carried
- prop `variant`: figma binding INFERRED as VARIANT "Variant" — confirm against the design library (reconcile step)

## SideNavItem

- source: `src/components/SideNavItem/SideNavItem.tsx` (react-tsx)
- proposed: 3 props, 0 events
- anatomy EXTRACTED from JSX + CSS Module — 4 part(s), 10 token binding(s), 0 raw value(s) reported. Anatomy is human-REVIEWED: check it against design intent before adoption.
- props type extends AnchorHTMLAttributes<HTMLAnchorElement> — parent members are outside single-file extraction and are NOT carried
- prop `state`: figma binding INFERRED as VARIANT "State" — confirm against the design library (reconcile step)
- prop `label`: required text prop declared no default — sample default "Label" seeded from the prop name; replace with your canonical sample text (it is the canvas default and the story sample)
- prop `icon`: ReactNode — extracted as anatomy slot "icon"
- prop `endContent`: ReactNode — extracted as anatomy slot "endContent"
- prop `href`: declared as text but no part's content (or textByProp) binds it — the generated component renders children; wire content.prop to `href` in the anatomy or drop the prop

## Skeleton

- source: `src/components/Skeleton/Skeleton.tsx` (react-tsx)
- proposed: 1 props, 0 events
- anatomy EXTRACTED from JSX + CSS Module — 2 part(s), 4 token binding(s), 0 raw value(s) reported. Anatomy is human-REVIEWED: check it against design intent before adoption.
- props type extends HTMLAttributes<HTMLSpanElement> — parent members are outside single-file extraction and are NOT carried
- prop `variant`: figma binding INFERRED as VARIANT "Variant" — confirm against the design library (reconcile step)

## Slider

- source: `src/components/Slider/Slider.tsx` (react-tsx)
- proposed: 3 props, 0 events
- anatomy EXTRACTED from JSX + CSS Module — 6 part(s), 19 token binding(s), 0 raw value(s) reported. Anatomy is human-REVIEWED: check it against design intent before adoption.
- props type extends HTMLAttributes<HTMLDivElement> — parent members are outside single-file extraction and are NOT carried
- prop `label`: required text prop declared no default — sample default "Label" seeded from the prop name; replace with your canonical sample text (it is the canvas default and the story sample)

## Spinner

- source: `src/components/Spinner/Spinner.tsx` (react-tsx)
- proposed: 1 props, 0 events
- anatomy EXTRACTED from JSX + CSS Module — 2 part(s), 1 token binding(s), 0 raw value(s) reported. Anatomy is human-REVIEWED: check it against design intent before adoption.
- props type extends HTMLAttributes<HTMLSpanElement> — parent members are outside single-file extraction and are NOT carried
- prop `label`: required text prop declared no default — sample default "Label" seeded from the prop name; replace with your canonical sample text (it is the canvas default and the story sample)
- prop `label`: declared as text but no part's content (or textByProp) binds it — the generated component renders children; wire content.prop to `label` in the anatomy or drop the prop
- jsx: part "arc" renders an inline SVG glyph — icon asset not extracted (review item)
- css: .arc { flex-shrink: 0 } — no inversion rule, not extracted

## Stack

- source: `src/components/Stack/Stack.tsx` (react-tsx)
- proposed: 1 props, 0 events
- anatomy EXTRACTED from JSX + CSS Module — 1 part(s), 1 token binding(s), 0 raw value(s) reported. Anatomy is human-REVIEWED: check it against design intent before adoption.
- props type extends HTMLAttributes<HTMLDivElement> — parent members are outside single-file extraction and are NOT carried
- prop `gap`: figma binding INFERRED as VARIANT "Gap" — confirm against the design library (reconcile step)
- jsx: root renders {children} directly — children channel (text prop vs default slot) is not decidable from code

## StatusDot

- source: `src/components/StatusDot/StatusDot.tsx` (react-tsx)
- proposed: 2 props, 0 events
- anatomy EXTRACTED from JSX + CSS Module — 1 part(s), 4 token binding(s), 0 raw value(s) reported. Anatomy is human-REVIEWED: check it against design intent before adoption.
- props type extends HTMLAttributes<HTMLSpanElement> — parent members are outside single-file extraction and are NOT carried
- prop `variant`: figma binding INFERRED as VARIANT "Variant" — confirm against the design library (reconcile step)
- prop `label`: required text prop declared no default — sample default "Label" seeded from the prop name; replace with your canonical sample text (it is the canvas default and the story sample)
- prop `label`: declared as text but no part's content (or textByProp) binds it — the generated component renders children; wire content.prop to `label` in the anatomy or drop the prop
- jsx: root renders {children} directly — children channel (text prop vs default slot) is not decidable from code

## Switch

- source: `src/components/Switch/Switch.tsx` (react-tsx)
- proposed: 3 props, 1 events
- anatomy EXTRACTED from JSX + CSS Module — 9 part(s), 18 token binding(s), 2 raw value(s) reported. Anatomy is human-REVIEWED: check it against design intent before adoption.
- props type extends LabelHTMLAttributes<HTMLLabelElement> — parent members are outside single-file extraction and are NOT carried
- prop `value`: figma binding INFERRED as VARIANT "Value" — confirm against the design library (reconcile step)
- prop `value`: default 'off' read from the uncontrolled useState initializer
- prop `label`: required text prop declared no default — sample default "Label" seeded from the prop name; replace with your canonical sample text (it is the canvas default and the story sample)
- event `onToggle`: trigger 'input' read from the onClick wiring; toggles value between [off, on]
- RAW VALUE (not tokenized): `.input { width: 100% }` — no token in the tree has this value. A raw value is reported, never turned into an invented token; bind it to a real token and re-extract.
- RAW VALUE (not tokenized): `.input { height: 100% }` — no token in the tree has this value. A raw value is reported, never turned into an invented token; bind it to a real token and re-extract.
- css: selector `.track:has(> .input:focus-visible)` — pseudo ":has(> .input:focus-visible)" is not a contract state, not extracted
- css: .input { inset: 0 } — no inversion rule, not extracted
- css: .input { opacity: 0 } — no inversion rule, not extracted
- css: .input position:absolute with insets (top:;bottom:;left:;right:) — not a generator overlay placement, not extracted

## Tab

- source: `src/components/Tab/Tab.tsx` (react-tsx)
- proposed: 2 props, 0 events
- anatomy EXTRACTED from JSX + CSS Module — 4 part(s), 9 token binding(s), 0 raw value(s) reported. Anatomy is human-REVIEWED: check it against design intent before adoption.
- props type extends ButtonHTMLAttributes<HTMLButtonElement> — parent members are outside single-file extraction and are NOT carried
- prop `state`: figma binding INFERRED as VARIANT "State" — confirm against the design library (reconcile step)
- prop `label`: required text prop declared no default — sample default "Label" seeded from the prop name; replace with your canonical sample text (it is the canvas default and the story sample)
- prop `icon`: ReactNode — extracted as anatomy slot "icon"
- prop `endContent`: ReactNode — extracted as anatomy slot "endContent"

## Table

- source: `src/components/Table/Table.tsx` (react-tsx)
- proposed: 1 props, 0 events
- anatomy EXTRACTED from JSX + CSS Module — 6 part(s), 6 token binding(s), 0 raw value(s) reported. Anatomy is human-REVIEWED: check it against design intent before adoption.
- props type extends HTMLAttributes<HTMLDivElement> — parent members are outside single-file extraction and are NOT carried
- prop `density`: figma binding INFERRED as VARIANT "Density" — confirm against the design library (reconcile step)
- anatomy: component ref `<TableHeaderCell>` mapped to contract id `ds.table-header-cell` — confirm that contract exists (or adjust the id) before adoption
- anatomy: component ref `<TableHeaderCell>` mapped to contract id `ds.table-header-cell` — confirm that contract exists (or adjust the id) before adoption
- anatomy: component ref `<TableHeaderCell>` mapped to contract id `ds.table-header-cell` — confirm that contract exists (or adjust the id) before adoption
- jsx: duplicate part class "tableHeaderCell" — second occurrence extracted as "tableHeaderCell2" (review: part names must be unique)
- jsx: duplicate part class "tableHeaderCell" — second occurrence extracted as "tableHeaderCell3" (review: part names must be unique)

## TableCell

- source: `src/components/TableCell/TableCell.tsx` (react-tsx)
- proposed: 1 props, 0 events
- anatomy EXTRACTED from JSX + CSS Module — 1 part(s), 6 token binding(s), 0 raw value(s) reported. Anatomy is human-REVIEWED: check it against design intent before adoption.
- props type extends HTMLAttributes<HTMLDivElement> — parent members are outside single-file extraction and are NOT carried
- prop `density`: figma binding INFERRED as VARIANT "Density" — confirm against the design library (reconcile step)
- jsx: root renders {children} directly — children channel (text prop vs default slot) is not decidable from code

## TableHeaderCell

- source: `src/components/TableHeaderCell/TableHeaderCell.tsx` (react-tsx)
- proposed: 1 props, 0 events
- anatomy EXTRACTED from JSX + CSS Module — 1 part(s), 7 token binding(s), 0 raw value(s) reported. Anatomy is human-REVIEWED: check it against design intent before adoption.
- props type extends HTMLAttributes<HTMLDivElement> — parent members are outside single-file extraction and are NOT carried
- prop `density`: figma binding INFERRED as VARIANT "Density" — confirm against the design library (reconcile step)
- jsx: root renders {children} directly — children channel (text prop vs default slot) is not decidable from code

## TableRow

- source: `src/components/TableRow/TableRow.tsx` (react-tsx)
- proposed: 1 props, 0 events
- anatomy EXTRACTED from JSX + CSS Module — 2 part(s), 1 token binding(s), 0 raw value(s) reported. Anatomy is human-REVIEWED: check it against design intent before adoption.
- props type extends HTMLAttributes<HTMLDivElement> — parent members are outside single-file extraction and are NOT carried
- prop `state`: figma binding INFERRED as VARIANT "State" — confirm against the design library (reconcile step)

## TabList

- source: `src/components/TabList/TabList.tsx` (react-tsx)
- proposed: 0 props, 0 events
- anatomy EXTRACTED from JSX + CSS Module — 2 part(s), 5 token binding(s), 0 raw value(s) reported. Anatomy is human-REVIEWED: check it against design intent before adoption.
- props type has NO OWN members (extends HTMLAttributes<HTMLDivElement> — parent members are outside single-file extraction): zero own props is what this module declares — review

## TextArea

- source: `src/components/TextArea/TextArea.tsx` (react-tsx)
- proposed: 5 props, 0 events
- anatomy EXTRACTED from JSX + CSS Module — 6 part(s), 19 token binding(s), 1 raw value(s) reported. Anatomy is human-REVIEWED: check it against design intent before adoption.
- props type extends LabelHTMLAttributes<HTMLLabelElement> — parent members are outside single-file extraction and are NOT carried
- prop `size`: figma binding INFERRED as VARIANT "Size" — confirm against the design library (reconcile step)
- prop `label`: required text prop declared no default — sample default "Label" seeded from the prop name; replace with your canonical sample text (it is the canvas default and the story sample)
- prop `placeholder`: declared as text but no part's content (or textByProp) binds it — the generated component renders children; wire content.prop to `placeholder` in the anatomy or drop the prop
- RAW VALUE (not tokenized): `.input { background: transparent }` — no token in the tree has this value. A raw value is reported, never turned into an invented token; bind it to a real token and re-extract.
- jsx: part "requiredMark" renders an inline SVG glyph — icon asset not extracted (review item)
- css: selector `.requiredMark svg` — icon glyph sizing, not extracted (icon parts are review items)
- css: .requiredMark { flex-shrink: 0 } — no inversion rule, not extracted
- css: .input { letter-spacing: inherit } — no inversion rule, not extracted
- css: .input { outline: none } — no inversion rule, not extracted

## TextField

- source: `src/components/TextField/TextField.tsx` (react-tsx)
- proposed: 6 props, 0 events
- anatomy EXTRACTED from JSX + CSS Module — 6 part(s), 19 token binding(s), 1 raw value(s) reported. Anatomy is human-REVIEWED: check it against design intent before adoption.
- props type extends LabelHTMLAttributes<HTMLLabelElement> — parent members are outside single-file extraction and are NOT carried
- prop `size`: figma binding INFERRED as VARIANT "Size" — confirm against the design library (reconcile step)
- prop `label`: required text prop declared no default — sample default "Label" seeded from the prop name; replace with your canonical sample text (it is the canvas default and the story sample)
- prop `placeholder`: declared as text but no part's content (or textByProp) binds it — the generated component renders children; wire content.prop to `placeholder` in the anatomy or drop the prop
- RAW VALUE (not tokenized): `.input { background: transparent }` — no token in the tree has this value. A raw value is reported, never turned into an invented token; bind it to a real token and re-extract.
- jsx: part "requiredMark" renders an inline SVG glyph — icon asset not extracted (review item)
- css: selector `.root[data-is-disabled]` — not extractable into anatomy, skipped by name
- css: selector `.requiredMark svg` — icon glyph sizing, not extracted (icon parts are review items)
- css: .requiredMark { flex-shrink: 0 } — no inversion rule, not extracted
- css: .input { letter-spacing: inherit } — no inversion rule, not extracted
- css: .input { outline: none } — no inversion rule, not extracted

## Toast

- source: `src/components/Toast/Toast.tsx` (react-tsx)
- proposed: 1 props, 0 events
- anatomy EXTRACTED from JSX + CSS Module — 3 part(s), 9 token binding(s), 0 raw value(s) reported. Anatomy is human-REVIEWED: check it against design intent before adoption.
- props type extends HTMLAttributes<HTMLDivElement> — parent members are outside single-file extraction and are NOT carried
- prop `type`: figma binding INFERRED as VARIANT "Type" — confirm against the design library (reconcile step)
- prop `endContent`: ReactNode — extracted as anatomy slot "endContent"
- jsx: <div> attribute role={…} — expression not extractable, skipped

## Token

- source: `src/components/Token/Token.tsx` (react-tsx)
- proposed: 4 props, 0 events
- anatomy EXTRACTED from JSX + CSS Module — 4 part(s), 9 token binding(s), 0 raw value(s) reported. Anatomy is human-REVIEWED: check it against design intent before adoption.
- props type extends HTMLAttributes<HTMLSpanElement> — parent members are outside single-file extraction and are NOT carried
- prop `color`: figma binding INFERRED as VARIANT "Color" — confirm against the design library (reconcile step)
- prop `size`: figma binding INFERRED as VARIANT "Size" — confirm against the design library (reconcile step)
- prop `label`: required text prop declared no default — sample default "Label" seeded from the prop name; replace with your canonical sample text (it is the canvas default and the story sample)
- prop `icon`: ReactNode — extracted as anatomy slot "icon"
- prop `endContent`: ReactNode — extracted as anatomy slot "endContent"
- css: .size-sm — "size" classes cover 2/3 values for "padding-inline"; md filled from the base rule (the cascade's default)
- css: "padding-inline" across .size-* classes has no consistent substitution template (space.inset-y.sm, space.inset-x.xs, space.inset-x.sm) — not proposed
- css: .size-lg — "size" classes cover 1/3 values for "font-size"; sm, md filled from the base rule (the cascade's default)
- css: "font-size" across .size-* classes has no consistent substitution template (font.badge.size, font.badge.size, font.control.size.sm) — not proposed
- css: .size-lg — "size" classes cover 1/3 values for "padding-block"; sm, md filled from the base rule (the cascade's default)
- css: "padding-block" across .size-* classes has no consistent substitution template (space.inset-y.xs, space.inset-y.xs, space.inset-y.sm) — not proposed

## Toolbar

- source: `src/components/Toolbar/Toolbar.tsx` (react-tsx)
- proposed: 2 props, 0 events
- anatomy EXTRACTED from JSX + CSS Module — 4 part(s), 12 token binding(s), 0 raw value(s) reported. Anatomy is human-REVIEWED: check it against design intent before adoption.
- props type extends HTMLAttributes<HTMLDivElement> — parent members are outside single-file extraction and are NOT carried
- prop `size`: figma binding INFERRED as VARIANT "Size" — confirm against the design library (reconcile step)
- prop `label`: required text prop declared no default — sample default "Label" seeded from the prop name; replace with your canonical sample text (it is the canvas default and the story sample)
- prop `startContent`: ReactNode — extracted as anatomy slot "startContent"
- prop `centerContent`: ReactNode — extracted as anatomy slot "centerContent"
- prop `endContent`: ReactNode — extracted as anatomy slot "endContent"
- prop `label`: declared as text but no part's content (or textByProp) binds it — the generated component renders children; wire content.prop to `label` in the anatomy or drop the prop

## TopNav

- source: `src/components/TopNav/TopNav.tsx` (react-tsx)
- proposed: 1 props, 0 events
- anatomy EXTRACTED from JSX + CSS Module — 4 part(s), 10 token binding(s), 0 raw value(s) reported. Anatomy is human-REVIEWED: check it against design intent before adoption.
- props type extends HTMLAttributes<HTMLElement> — parent members are outside single-file extraction and are NOT carried
- prop `label`: required text prop declared no default — sample default "Label" seeded from the prop name; replace with your canonical sample text (it is the canvas default and the story sample)
- prop `heading`: ReactNode — extracted as anatomy slot "heading"
- prop `startContent`: ReactNode — extracted as anatomy slot "startContent"
- prop `endContent`: ReactNode — extracted as anatomy slot "endContent"
- prop `label`: declared as text but no part's content (or textByProp) binds it — the generated component renders children; wire content.prop to `label` in the anatomy or drop the prop

## TopNavItem

- source: `src/components/TopNavItem/TopNavItem.tsx` (react-tsx)
- proposed: 3 props, 0 events
- anatomy EXTRACTED from JSX + CSS Module — 3 part(s), 9 token binding(s), 0 raw value(s) reported. Anatomy is human-REVIEWED: check it against design intent before adoption.
- props type extends AnchorHTMLAttributes<HTMLAnchorElement> — parent members are outside single-file extraction and are NOT carried
- prop `state`: figma binding INFERRED as VARIANT "State" — confirm against the design library (reconcile step)
- prop `label`: required text prop declared no default — sample default "Label" seeded from the prop name; replace with your canonical sample text (it is the canvas default and the story sample)
- prop `icon`: ReactNode — extracted as anatomy slot "icon"
- prop `href`: declared as text but no part's content (or textByProp) binds it — the generated component renders children; wire content.prop to `href` in the anatomy or drop the prop

## TypeaheadItem

- source: `src/components/TypeaheadItem/TypeaheadItem.tsx` (react-tsx)
- proposed: 2 props, 0 events
- anatomy EXTRACTED from JSX + CSS Module — 5 part(s), 13 token binding(s), 0 raw value(s) reported. Anatomy is human-REVIEWED: check it against design intent before adoption.
- props type extends HTMLAttributes<HTMLDivElement> — parent members are outside single-file extraction and are NOT carried
- prop `label`: required text prop declared no default — sample default "Label" seeded from the prop name; replace with your canonical sample text (it is the canvas default and the story sample)
- prop `icon`: ReactNode — extracted as anatomy slot "icon"

