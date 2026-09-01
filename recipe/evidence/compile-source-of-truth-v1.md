# Compile source of truth v1

> Read-only audit on `main` at `c71254923`. No Figma writes. No Polar
> invented. `overallSuccess` stays false. Product **v1 remains INCOMPLETE**.
> Does not remint Checkbox or Textarea. Does not rewrite those recipes.

**Asked:** if we convert code → canvas, should the source of truth be the
public npm packages (`@mui/material`, `antd`, `@astryxdesign/core`)? Where
are we actually getting what we mint?

**Answer:** the numbers that land on canvas come from **human-reviewed
token tables in `recipe/fixtures/library-*.ts`**, not from a live read of
`node_modules` and not from computed CSS at compile time. Those tables
*cite* real public npm installs. Compile copies the transcribed fallbacks
into IR. The packages are on disk and they are complete installs — but
they are review sources, not a compile-time style engine.

---

## Compile path (what actually runs)

```
recipe/fixtures/library-<archetype>.ts
  → Reviewed*Source  (packageName / version / exportName / sourceRoot)
  → cloneTokens()    (hand-typed fallbacks; cites JS/TSX/CSS/StyleX)
  → adaptReviewed*() (copies config.tokens; never fs.read of the package)
  → compile*Recipe() (IR from instance.tokens only)
  → *figma-writer    (canvas)
```

Adapters import the canonical skeleton and the library fixture. They do
not `readFile` Checkbox.js, Switch.tsx, or `antd/es/checkbox/style`. Proof
tests that `readFileSync` are reading **our** `recipe/recipes/*.ts` and
`recipe/adapters/*.ts` to forbid `if (library)` / Polar / Inter — not the
npm trees.

`cloneTokens` starts from `recipe/fixtures/<archetype>.ts` (the skeleton
says it is “not a fourth library”) and mutates listed paths. Any path not
overridden keeps the canonical fallback under a library-scoped variable
name. That is the Combobox overlay-chrome class
(`recipe/evidence/signed-archetype-source-audit.json`).

---

## The three public packages (on disk, this machine)

All three are **real npm installs**, not a hand-vendored subset. Earlier
“MUI Switch.js is missing” was a **false negative**: workspace search
skips gitignored `node_modules`. The file is present.

| package | declared | lock | local tree | git |
|---|---|---|---|---|
| `@mui/material` | `9.2.0` exact in `recipe/sandboxes/input-field-mui/package.json` | committed lock → `9.2.0` | `recipe/sandboxes/input-field-mui/node_modules/@mui/material` — 162 top-level entries, 13M package / 55M sandbox; Checkbox, Radio, Switch, TextField, TextareaAutosize, Badge, Alert, Chip, Avatar, Link, Tooltip, Tabs, Menu, Dialog, Autocomplete, Button, Input all present; `Switch/Switch.js` exists (14110 bytes) | manifest + lock committed; `node_modules/` gitignored |
| `@astryxdesign/core` | fixtures say `0.1.6`; sandbox `package.json` is `^0.1.6` | local lock → `0.1.6` | `examples/astryx/.astryx-sandbox/node_modules/@astryxdesign/core` — 20M; ships TSX (`src/*`) + `dist/astryx.css` (124144 bytes, dated 2026-07-22); CheckboxInput, RadioList (+ `RadioListItem.tsx` in that folder), Switch, TextArea, Banner, Token, Badge, Avatar, Link, Tooltip, TabList, DropdownMenu, Dialog, Typeahead, Calendar present | **entire `.astryx-sandbox` gitignored**; reproduce via `examples/astryx/PROVENANCE.md` (`npm install @astryxdesign/core@0.1.6`) |
| `antd` | fixtures say `5.29.3`; sandbox / probe `package.json` is `"antd": "^5"` | local lock → `5.29.3` | `examples/antd/.antd-sandbox/node_modules/antd` — 58M package / 136M sandbox; `es/{checkbox,radio,switch,input,badge,alert,tag,avatar,tooltip,tabs,dropdown,modal,select,button}` present; `rc-checkbox`, `rc-switch`, `rc-select`, `rc-textarea` installed | **entire `.antd-sandbox` gitignored**; README / `examples/antd/probe/sandbox-package.json` recreate it |

Astryx on npm is `@astryxdesign/core` (Meta, MIT, StyleX). Docs site
`astryx.atmeta.com` is **not** what compile reads; Calendar already
taught that lesson (V30 docs chrome vs vendored 0.1.6).

AntD Combobox still *declares* `sourceRoot: "antd@5.29.3 package tarball,
inspected under temporary npm prefix"`. Boilerplate AntD legs now point
at the sandbox `es/` tree. The tarball line is stale citation, not a
second copy of antd.

---

## What compile reads vs what the package ships

| layer | used at compile? | what it is |
|---|---|---|
| Fixture token table (`library-*.ts`) | **yes — this is the mint** | Hand-copied geometry, hex, SVG `d`, align, travel |
| Package JS/TSX (Emotion / cssinjs / StyleX) | **no** | Humans read it while authoring the table; compile never opens it |
| `dist/astryx.css`, `tokens.stylex.ts` | **no** | Cited in `styleSources`; light half transcribed |
| `examples/antd/tokens/antd.vars.css`, `examples/mui/tokens/mui.vars.css` | **no** | Committed CSS-variable dumps; often the font/color citation, especially AntD `--font-family` |
| `extract/computed/out/**` (Chromium computed style of the real package) | **no for boilerplate** | Used for signed **Input** (`examples/mui/contracts/text-field.contract.json`) and the AntD exam contracts. Recipe compile does not import those ledgers |
| Canonical fixture content | **yes** | Labels and sample copy (below) |

So: we are **already on public npm as the review authority**. We are
**not** on public npm as the sole style authority. A reinstall is not
required to “get” MUI/AntD/Astryx — they are installed. A **reader**
would be required if TJ wants compile to fail when the package moves and
the table does not.

---

## Per-archetype table

**Paths** are `sourceRoot` as declared. **npm facts** = what the table
claims it transcribed. **Fixture leakage** = content (and any
`cloneTokens` leftover) that is not a library default string.

| archetype | npm package@version#export | path | npm facts (claimed) | fixture leakage |
|---|---|---|---|---|
| Checkbox | `@astryxdesign/core@0.1.6#CheckboxInput` | `examples/astryx/.astryx-sandbox/node_modules/@astryxdesign/core/src/CheckboxInput` | box 22/wrapper 24, radius 4, accent `#0064e0`, SVG check scaled from viewBox 10 | **yes** — shared label `Accept terms` (Astryx example; named recipe content) |
| Checkbox | `@mui/material@9.2.0#Checkbox` | `recipe/sandboxes/input-field-mui/node_modules/@mui/material/Checkbox` | SvgIcon 24, SwitchBase pad 9, hit 42, primary `#1976d2`, CheckBox.js path | **yes** — same `Accept terms`; FormControlLabel is a reviewed pairing |
| Checkbox | `antd@5.29.3#Checkbox` | `examples/antd/.antd-sandbox/node_modules/antd/es/checkbox` | `controlInteractiveSize` 16, `::after` L-stroke formula, rotate 45°, baseline | **yes** — same `Accept terms` |
| Radio | `@astryxdesign/core@0.1.6#RadioList` | `…/src/RadioList` | list-shaped; md 22 circle; innerDot 10 | **yes** — items `Email` / `Phone` |
| Radio | `@mui/material@9.2.0#Radio` | `…/@mui/material/Radio` | 24 + pad 9; RadioGroup column | **yes** — same items |
| Radio | `antd@5.29.3#Radio` | `…/antd/es/radio` | `fontSizeLG` 16; Group `inline-block` | **yes** — same items |
| Switch | `@astryxdesign/core@0.1.6#Switch` | `…/src/Switch` | 40×24 track, thumb 16/20, travel 14 | **yes** — `Enable notifications` |
| Switch | `@mui/material@9.2.0#Switch` | `…/@mui/material/Switch` | root 58×38, track 34×14, thumb 20, translateX 20 | **yes** — same label; FormControlLabel pairing |
| Switch | `antd@5.29.3#Switch` | `…/antd/es/switch` | height 22, handle 18, track min 44, travel 22 | **yes** — same label (AntD children optional / receipted) |
| Textarea | `@astryxdesign/core@0.1.6#TextArea` | `…/src/TextArea` | rows 3, stacked Field, radius 8 | **yes** — label `Notes`, placeholder `Add a note`, value `Meeting notes for Tuesday.` |
| Textarea | `@mui/material@9.2.0#TextField` (multiline; no Textarea export) | `…/@mui/material/TextField` | outlined 56, floating InputLabel, notched outline, minRows 1 | **yes** — same copy |
| Textarea | `antd@5.29.3#Input.TextArea` | `…/antd/es/input` | HTML rows 2, height 54, radius 6 | **yes** — same copy |
| Badge | `@mui/material@9.2.0#Badge` | `…/@mui/material/Badge` | RADIUS_STANDARD 10, docs `color=error` `#d32f2f` | **yes** — count `"5"` (AntD seed) |
| Badge | `antd@5.29.3#Badge` | `…/antd/es/badge` | indicatorHeight 20, `#ff4d4f` | **yes** — count `"5"` |
| Badge | `@astryxdesign/core@0.1.6#Badge` | `…/src/Badge/Badge.tsx` | **named refusal** — Astryx Badge is an inline status label, not an overlay pip | n/a — not compiled |
| Alert | `@astryxdesign/core@0.1.6#Banner` | `…/src/Banner` | header pad 12/16, radius 12, icon 20 | **yes** — title `New update available` |
| Alert | `@mui/material@9.2.0#Alert` | `…/@mui/material/Alert` | standard success, pad 6/16, radius 4 | **yes** — same title |
| Alert | `antd@5.29.3#Alert` | `…/antd/es/alert` | default info, pad 8/12, radius 8 | **yes** — same title |
| Chip | `@astryxdesign/core@0.1.6#Token` | `…/src/Token` | height 24, radius 4, supporting 12 | **yes** — label `Tag` |
| Chip | `@mui/material@9.2.0#Chip` | `…/@mui/material/Chip` | height 32, radius 16, filled | **yes** — `Tag` |
| Chip | `antd@5.29.3#Tag` | `…/antd/es/tag` | pad 7, radius 4, `#fafafa` | **yes** — `Tag` |
| Avatar | `@astryxdesign/core@0.1.6#Avatar` | `…/src/Avatar` | default small 36, initials 0.4× | **yes** — `JD` (`getInitials('John Doe')` is the Astryx example; letters are shared) |
| Avatar | `@mui/material@9.2.0#Avatar` | `…/@mui/material/Avatar` | 40 circular, grey[400] | **yes** — `JD` |
| Avatar | `antd@5.29.3#Avatar` | `…/antd/es/avatar` | controlHeight 32 | **yes** — `JD` |
| Link | `@astryxdesign/core@0.1.6#Link` | `…/src/Link` | body 14/20, accent `#0064E0`, underline default false | **yes** — children `Link` |
| Link | `@mui/material@9.2.0#Link` | `…/@mui/material/Link` | underline always, primary `#1976d2`, theme fontSize 14 | **yes** — `Link` |
| Link | `antd@5.29.3#Typography.Link` | `…/antd/es/typography` | no top-level `Link`; `linkDecoration` none, `#1677ff` | **yes** — `Link` |
| Tooltip | `@astryxdesign/core@0.1.6#Tooltip` | `…/src/Tooltip` | pad 4/8, radius 12, inverted bubble | **yes** — `Tooltip`; Polar/arrow receipted |
| Tooltip | `@mui/material@9.2.0#Tooltip` | `…/@mui/material/Tooltip` | pad 4/8, radius 4, grey[700] 0.92, 11 Medium | **yes** — `Tooltip` |
| Tooltip | `antd@5.29.3#Tooltip` | `…/antd/es/tooltip` | pad 6/8, `#000000d9` | **yes** — `Tooltip` |
| Tabs | `@astryxdesign/core@0.1.6#TabList` | `…/src/TabList` | no `Tabs` export; indicator 2 + accent | **yes** — `Item One` / `Item Two` |
| Tabs | `@mui/material@9.2.0#Tabs` | `…/@mui/material/Tabs` | Tab min 90×48, indicator 2, button 14 Medium caps | **yes** — same items |
| Tabs | `antd@5.29.3#Tabs` | `…/antd/es/tabs` | line default, gutter 32, ink 2 | **yes** — same items |
| Menu | `@astryxdesign/core@0.1.6#DropdownMenu` | `…/src/DropdownMenu` | no `Menu` export; pad 4, radius 12 | **yes** — `Item One` / `Item Two` |
| Menu | `@mui/material@9.2.0#Menu` | `…/@mui/material/Menu` | MenuItem minHeight 48, pad 6/16 | **yes** — same items |
| Menu | `antd@5.29.3#Dropdown` | `…/antd/es/dropdown` | compile Dropdown not Menu; radiusLG 8 | **yes** — same items |
| Dialog | `@astryxdesign/core@0.1.6#Dialog` | `…/src/Dialog` | width 400, radius 12, pad 16 | **yes** — `Dialog title` / `Dialog body` |
| Dialog | `@mui/material@9.2.0#Dialog` | `…/@mui/material/Dialog` | maxWidth sm 600, title pad 16/24 | **yes** — same copy |
| Dialog | `antd@5.29.3#Modal` | `…/antd/es/modal` | width 520, radiusLG 8 | **yes** — same copy |

Pattern legs (not the Phase 1 climb, but they show the two older
acquisition styles):

| archetype | npm / source | path | npm facts | fixture leakage |
|---|---|---|---|---|
| Input / Field | `@mui/material@9.2.0#TextField` | `examples/mui/contracts/text-field.contract.json` ← Chromium computed capture of the sandbox package | **computed CSS of the real package** (the one signed exception) | **yes** — Amount / 125.00 / $ / USD (declared sample) |
| Input / Field | `@shopify/polaris@13.9.5#TextField` | Polar contract, same capture pipeline | computed CSS | Store name / Jaded Pixel |
| Combobox | `@mui/material@9.2.0#Autocomplete` | sandbox `@mui/material` | anatomy/API from Autocomplete.js; **overlay chrome from canonical `cloneTokens`** | **yes** — Assignee, Ada Lovelace / Grace Hopper / Linus / Margaret, No options, Loading…, occupancy squares |
| Combobox | `antd@5.29.3#Select` | **declared** temporary tarball; sandbox `es/select` now exists | same cloneTokens overlay class | **yes** — same people / occupancy |
| Button | Altitude `1.0.2` + Fluent `9.74.5` | `examples/*/contracts/button.contract.json` | contracts / `@default` tags — **not** the MUI/AntD/Astryx triple | sample labels in that recipe |
| Calendar | `@astryxdesign/core` vendored 0.1.6 | `…/src/Calendar` + `dist/astryx.css` | hand-read TSX + CSS (doctrine after V30) | August fixture dates are recipe content |

---

## Already on public npm?

**Installs:** yes. This machine has complete public-registry trees for
all three. MUI is the only one with a **committed** pin + lock. Astryx
and AntD sandboxes are local-only; AntD’s recreate manifest is `"antd":
"^5"` (float). A clean clone must `npm install` those sandboxes before a
human can re-review source. Compile itself does not need them — the
tables are committed TypeScript.

**Sole style authority:** no. Compile will happily mint stale hex if the
package moves and the table does not. That is the drift.

---

## If we strictly compiled styles only from `node_modules`

Would change:

- Adapters would have to **parse or execute** Emotion / `@ant-design/cssinjs`
  / StyleX, **or** (the Input precedent) render the export in Chromium and
  ingest `extract/computed` contracts. There is no third path that reads
  “the real styles” without one of those.
- `cloneTokens` leftover chrome (Combobox list padding, occupancy
  squares-as-style) would disappear; library-named overlay tokens would
  have to be taught.
- Compile would **fail closed** if the sandbox were missing or the
  version drifted — today it cannot notice.
- AntD Combobox’s tarball `sourceRoot` would have to be rewritten to the
  sandbox (citation only; no remint in this note).
- Astryx sandbox `^0.1.6` and AntD `^5` would need exact pins in
  committed manifests, not only fixture strings.

Would **not** change (and should not be treated as package truth):

- Shared recipe content: Accept terms, Email/Phone, Enable notifications,
  Notes / Add a note, New update available, Tag, JD, Item One/Two,
  Dialog title/body, Assignee / Ada Lovelace.
- Named refusals: hover, ripple, Polar placement, Astryx Badge-as-pip,
  AntD top-level Link, MUI standalone Textarea.
- Product v1 / `overallSuccess` / F1.

Computed-capture contracts already exist under
`extract/computed/out/antd/{checkbox,radio,switch,badge,alert,tag,avatar,tooltip,…}`
and MUI Input. Boilerplate recipes do not consume them. Wiring that in
would be a new teaching, not a silent swap.

---

## Essential files

- `recipe/fixtures/library-{checkboxes,radios,switches,textareas,badges,alerts,chips,avatars,links,tooltips,tabs,menus,dialogs,comboboxes,input-fields}.ts`
- `recipe/adapters/*.ts` — copy, do not read packages
- `recipe/recipes/*.ts` — `compile*Ir` / `compile*Recipe`
- `recipe/sandboxes/input-field-mui/package.json` + lock
- `examples/astryx/PROVENANCE.md`
- `examples/antd/README.md`, `examples/antd/probe/sandbox-package.json`
- `recipe/evidence/signed-archetype-source-audit.json`
- `docs/32-recipe-ir-pivot.md` (doctrine: compile from vendored source,
  never a reduced overlay)
- `docs/34-boilerplate-v1-plan.md` §3 (what ships — not what compile
  executes)

Pointer from the plan: [docs/34-boilerplate-v1-plan.md](../../docs/34-boilerplate-v1-plan.md)
(section “Source of truth for minting”).
