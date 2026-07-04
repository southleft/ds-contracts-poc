# Astryx Coverage Map — What's Mirrored, What's Bounded, and Why

*July 3, 2026. Source: full sweep of the Astryx component index (astryx.atmeta.com/components, 93 components, `@astryxdesign/core` v0.1.2 — prop tables recovered from the docs site's own component registry). Astryx is mirrored at the **API level**: prop names, types, enum vocabularies, and slot shapes. Every component below is either generated from a contract, or its absence is attributed to a specific named gap — never silently skipped.*

**The scoreboard (updated after round two):** **40 components in the catalog**, 38 of them mirroring Astryx APIs directly — the original set plus Blockquote, Checkbox, Code, Divider, EmptyState, IconButton, StatusDot, TextArea, TextField, Toast, Token, and the second wave: **ChatMessage, ChatMessageMetadata, ChatSystemMessage, Citation, Field, Kbd, List, ListItem, MetadataList, MetadataListItem, Section, SideNavItem, Tab, TabList, Toolbar, TopNav, TopNavItem, TypeaheadItem**. Stack and Inline are system layout primitives. The remaining Astryx components fall into **two honest categories**: static components blocked by a *named schema gap*, and behavior-heavy components outside the contract's declared boundary (contracts own API/anatomy/tokens; interactive behavior is a hand-written layer beside the generated shells).

## Mirrored in round two (18 more contracts)

The chat family (per-sender bubble tokens; per-status delivery icons; divider lines via `visibleWhen.equals`), the navigation family (Tab/TabList, TopNav/TopNavItem, SideNavItem — selection flattened to a `state` enum so both surfaces render it truthfully), the list families (List/ListItem, MetadataList/MetadataListItem with multi-child default content), the form-infrastructure Field wrapper (htmlFor association via an `inputID` prop), plus Toolbar, Section, Citation (label/number variants via `visibleWhen.equals`), Kbd, and TypeaheadItem. Flavor deviations, disclosed: `isSelected` booleans became `state` enums (boolean-conditional tokens are still a gap); `status={type,message}` objects remain out (structured-object props); Section drops the `transparent` variant (transparent color tokens).

## Mirrored in round one (11 contracts)

| Contract | Astryx source | API mirrored | Notable schema feature exercised |
|---|---|---|---|
| ds.blockquote | Blockquote | children + cite slot | semantic footer/cite markup |
| ds.checkbox | CheckboxInput | value (unchecked/checked/indeterminate), size, label, description | `visibleWhen.equals` swaps check/dash glyphs per variant |
| ds.code | Code | children | mono font token family |
| ds.divider | Divider | variant (subtle/strong) | — (orientation blocked, see gaps) |
| ds.empty-state | EmptyState | title, description, icon slot, actions slot | decorative icon area (`aria-hidden` attrs) |
| ds.icon-button | IconButton | variant×4, size×3, label, isDisabled, icon slot | `attrs` aria-label; unbound TEXT property on canvas |
| ds.status-dot | StatusDot | variant×5, label | root `attrs` aria-label + role img |
| ds.text-area | TextArea | label, description, placeholder, size×3, isRequired | form-control canvas mapping (real textarea in code, placeholder text bound on canvas) |
| ds.text-field | TextInput | label, description, placeholder, size×3, isRequired, isDisabled | wrapping-label anatomy = implicit association; nested-part `{size}` substitutions |
| ds.toast | Toast | type (info/error), body, endContent | roleByProp (info=status, error=alert) |
| ds.token | Token | color×11, size×3, label, isDisabled, icon + endContent slots | 11-color token scale (6 new hue ramps) |

Props deliberately omitted from otherwise-mirrored APIs (all function-valued or behavior-owned): `onChange`/`onClick`/`changeAction` handlers, `xstyle` (StyleX escape hatch — our equivalent is *no* escape hatch, by governance), `isLoading` spinners (animation tokens are a gap), `tooltip` (behavior), `hasClear` (behavior), `status={type,message}` objects on form fields (needs structured-object props — queued as the next schema round with part-level states).

## Static, but blocked by a NAMED schema gap

| Component | Blocking gap |
|---|---|
| Text, Heading | **>2 variant axes** (type × color × weight × size) and **element-by-prop** (`as`, `level` change the rendered tag) |
| ProgressBar, AspectRatio, Skeleton, NumberInput | **Number-valued props** (value/max/ratio/width) — schema has text/boolean/enum only |
| Switch | **Boolean-conditional tokens** (on/off track color) — visibleWhen shows/hides but can't restyle |
| Breadcrumbs | **Positional part logic** ("separator on all but first") |
| Divider (orientation) | **Per-enum-value property overrides** (horizontal thickness=height, vertical thickness=width) |
| Spinner, Skeleton (shimmer), isLoading states | **Animation tokens/keyframes** not in the token pipeline |
| ButtonGroup, AvatarGroup | **Sibling-selector styling** (shared borders, overlap) not emitted by the CSS generator |
| FormLayout, Grid, Layout | **Layout-by-enum** (direction/column props change flex/grid structure, not just token values) |
| ChatMessage (alignment), Kbd (multi-key) | Shipped with the noted subset; the full behavior needs layout-by-enum / value parsing |
| Timestamp, Thumbnail, VisuallyHidden, Overlay | Runtime formatting, image sources, raw-CSS utilities, or positioned overlays — small dedicated features, deferred on priority |

## Behavior boundary (declared, per the date-picker doctrine)

DropdownMenu, MoreMenu, SegmentedControl, ToggleButton(+Group), Selector, MultiSelector, RadioList, Slider, Typeahead, Tokenizer, PowerSearch, Calendar and the Date/Time input family, FileInput (drag-drop), Dialog, AlertDialog, CommandPalette, Popover, Tooltip, HoverCard, Lightbox, TabList, Pagination, Collapsible(+Group), Carousel, OverflowList, TreeList, CodeBlock (copy/collapse), Outline (scroll-spy), AppShell (responsive drawer), ResizeHandle, ChatComposer/ChatLayout/ChatToolCalls, Markdown (streaming), Toast lifecycle (useToast/viewport/stacking).

For these, the contract's future role is unchanged: it owns the API surface, anatomy, and tokens; a `behavior` field naming the paired hook/events is the designed extension (docs/09). Several have static visual states already expressible (a closed Selector trigger, a Tab row, a Pagination bar) and are natural next-round candidates once the gaps above land.

## Reading this as evidence

The point of this document is that **coverage scales with the schema, not with hand effort**: this round added five schema capabilities (icons, attrs, visibleWhen, grow, roleByProp — plus nested-part substitutions and form-control canvas mapping) and eleven components followed mechanically. Each remaining blocker is one addition away from unlocking its cluster.
