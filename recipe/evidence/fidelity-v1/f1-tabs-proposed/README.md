# F1 · tabs@1 — the seventh archetype the one command covers

`schema-tabs.ts`, `draftTabsRoles`, `propose-tabs.ts`;
`npm run recipe:point -- --archetype tabs --library <lib>`. Roles: the list,
a selected tab, a rest tab, their label parts, and the indicator — which is
either a part of its own (MUI's absolute bar) or **the selected tab's bottom
border** (Carbon), read as height = border width and fill = border colour.
A library with neither refuses by name: shadcn's selected tab is a filled
pill, and tabs@1 draws an indicator, not a selected-tab fill.

Two rules the reader learned:

- **A fixed CSS height is a minimum height.** Carbon sets `height: 40px` and
  no `min-height`; tabs@1 carries `tab.minHeight`, so the larger of the two
  is read (MUI: both 48).
- **A visually-hidden control is not an indicator.** Carbon's 1×1 absolute
  hidden buttons are painted; the indicator rule now needs a bar at least
  half a tab wide and never a button. The first draft picked the hidden
  button — the roles file shows it, the fix is in the drafter.

| row | kind | score |
|---|---|---|
| tabs/mui-proposed | MUI's own capture (25 read, 0 invented) | 7.73% — **named**, identical to the hand row's font-substrate residual to the hundredth |
| tabs/carbon | **held out** (21 read, 4 spellings, 0 invented) | 9.57% — **named** content-mismatch: the capture mounts three tabs and the selected panel; tabs@1 draws two tabs and no panel. What the two share — 40px tabs, 16px padding, IBM Plex Sans 14/18 SemiBold and Regular, the blue 2px indicator — is in both images; the rest tabs' grey border is refused by name |
| shadcn | — | refuses in the drafter: no indicator part and no distinct bottom border; a selected-tab fill tabs@1 cannot express |

tabs v13 is page `218:91353`. The drift reader verifies both proposals
(923 match · 1 pre-existing drift).
