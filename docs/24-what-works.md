# 24 — What Works

*The success-side counterpart to [23 — Known Limitations](23-known-limitations.md). Written for a design engineer deciding whether to adopt this: what is **proven**, and **how it was measured**.*

> **This file is generated. Do not edit it.** `npm run capability:report` rebuilds it; `npm run capability:fresh` refuses if the committed bytes differ from a rebuild, and one of the 225 evals runs that refusal.

This is the most dangerous document in the repository, because its output is
flattering numbers, and it is built to be read with that in mind. Every number
below is **read from a committed artifact** and carries the path it came from.
Nothing is typed in. Where a source cannot answer, §7 says so instead of
estimating. And the denominator comes **first** — §2, before any mean — because
a fidelity average over a hand-picked slice, printed without the slice, is the
single most misleading thing this repo could publish. The companion document
is not optional reading: [23 — Known Limitations](23-known-limitations.md) is
the complete inventory of what this does not do, and it is longer than this one.

---

## 1. The one-paragraph version

Six third-party component libraries — Altitude, Astryx, Carbon, Flowbite / Tailwind, Fluent 2, MUI, Polaris, shadcn/ui — across five styling
architectures were run through one pipeline. 104 components came out with a measured floor:
**86.6% mean computed-style equality** against the original npm package rendering in the same pinned
Chromium, exact string comparison with no tolerance, over 583,950 compared style cells
(52 of 104 components at ≥90%, 81 of 104 at ≥80%).
In the other direction, a 599-variant Figma kit converted to code scores
**92.70% visual fidelity** over the 537 statically scorable variants, and the
canvas→code→canvas executes through the fact diff on **15 of 15** components with every
one of 36,287 facts classified as matched, diverged, lost or invented rather than dropped in silence.
Exact structured projection is separately evidenced: **0 verified exact, 15 legacy unverified, 0 refused**.
The whole thing is pinned by 225 executable claim gates and a 292-file byte-identical
generation manifest. **What that does not say:** those 104 components are
10.7% of the 8 libraries they came from, and they were picked because they were the tractable ones.

---

## 2. The denominator, first

Every mean in this document is an average over captured components. This is
which components, and what fraction of each library they are. It is printed
before the results, not after them, and repeated under each table that
averages.

| library | contracts committed | measured AND committed | library size | **coverage** | source of the size |
|---|---|---|---|---|---|
| Altitude (`altitude-web-components@1.0.2`) | 8 | 8 | 67 | **11.9%** | `docs/22-generality.md` §8.3 |
| Astryx (`@astryxdesign/core@0.1.6`) | 13 | 10 | 222 | **4.5%** | `docs/22-generality.md` §8.3 |
| Carbon (`@carbon/react@1.112.0`) | 10 | 10 | 243 | **4.1%** | `docs/22-generality.md` §8.3 |
| MUI (`@mui/material@9.2.0`) | 31 | 31 | 135 | **23.0%** | `docs/22-generality.md` §8.3 |
| Polaris (`@shopify/polaris@13.9.5`) | 12 | 12 | 180 | **6.7%** | `docs/22-generality.md` §8.3 |
| shadcn/ui (`@shadcn-sandbox/ui@0.0.1`) | 11 | 11 | 50 | **22.0%** | `docs/22-generality.md` §8.3 |
| Flowbite / Tailwind (`flowbite-react@0.12.17`) | 8 | 8 | 46 | **17.4%** | `docs/22-generality.md` §8.3 |
| Fluent 2 (`@fluentui/react-components@9.74.5`) | 11 | 11 | **source cannot answer** | — | no row in §8.3 matched this package id |
| **total** | **104** | **101** | **943** | **10.7%** |  |

**Read every percentage on this page as "on the easy 10.7%."** The 104 components measured here were chosen because they were **tractable**, not at random — they are Button, Badge, Chip, Card, Checkbox, Tag, Avatar, Divider and their siblings. Across the 8 libraries they are 101 of 943 components (10.7%). Data grid, tree, virtualized list, date picker, rich text and charts appear in **zero** committed contracts. A mean over this slice is a statement about this slice.

**This table's coverage column is stricter than the one in docs/22 and docs/23, on purpose.**
Those two print 104/943 = **11.0%** — *contracts committed* over library size.
This page prints 101/943 = **10.7%** — components that are *both* measured
*and* backed by a committed contract, over library size, because this is the
document quoting the fidelity numbers and a component only counts as covered
when it was measured AND kept. A contract existing is not the same as a contract
being measured, and a scorecard existing is not the same as a stem shipping;
where these differ this page uses the smallest number.

**3 measured component(s) are deliberately excluded here**
because they carry a scorecard but no committed contract — captured with full
receipts and then HELD: `tailwind/Blockquote`, `tailwind/Spinner`, `tailwind/TextInput`.
Counting them would report refused stems as shipped ones
(`FC-COVERAGE-COUNTS-CAPTURES`); their fidelity numbers still appear in §3,
which averages over everything measured.

**The size denominators lean against us on purpose** and are the one set of
numbers here that is not machine-derived: they were produced by one-off
extractor runs and recorded in prose in
[docs/22 §8.3](22-generality.md#83-the-coverage-fraction--how-much-of-each-library-is-actually-captured),
which this build parses rather than retypes. MUI's counts every capitalised
directory including utilities; Carbon's, Polaris's and Astryx's are whatever
this repo's own extractor could see, helpers included. The true denominators
are smaller and the true percentages a little higher. The order of magnitude
is the finding.

Beyond the 8 foreign libraries, the corpus also holds contracts that are **not** captured from a third party and are not counted above:

| corpus | contracts | what it is | source |
|---|---|---|---|
| this repo's own library | 56 | hand-authored here; the code→design direction's fixture | `contracts/*.contract.json` |
| Untitled UI (Figma kit) | 30 | proposed FROM a canvas, not extracted from code — see §4 | `examples/untitled-ui/storybook/contracts/` |
| Eventz (Figma kit) | 17 | a designer's own file with real variable names | `examples/eventz-vars/contracts/` |

---

## 3. Fidelity — code → contract → rendering

The measurement: an enriched contract is emitted to HTML by `core/emit-html`
and compared against **the original npm package rendering** in the same pinned
Chromium, per combination × interaction state. Computed-style equality is an
**exact string match over the styled channel set, with no tolerance and no
whitelist** — the browser's full longhand set is enumerated. A channel the
pipeline never opened still counts against it.

| library | components | mean %equal | median | ≥90% | ≥80% | cells compared | cell-weighted | source |
|---|---|---|---|---|---|---|---|---|
| Altitude | 8 | **91.7** | 94.0 | 5/8 | 8/8 | 6,224 | 90.2 | `extract/computed/out/altitude/<comp>/scorecard.json` |
| Astryx | 10 | **86.0** | 93.6 | 7/10 | 7/10 | 34,096 | 91.1 | `extract/computed/out/astryx/<comp>/scorecard.json` |
| Carbon | 10 | **87.5** | 86.7 | 4/10 | 8/10 | 54,297 | 82.8 | `extract/computed/out/carbon/<comp>/scorecard.json` |
| MUI | 31 | **89.8** | 90.7 | 18/31 | 27/31 | 120,182 | 85.8 | `extract/computed/out/mui/<comp>/scorecard.json` |
| Polaris | 12 | **89.4** | 91.5 | 7/12 | 11/12 | 200,405 | 90.5 | `extract/computed/out/<comp>/scorecard.json` |
| shadcn/ui | 11 | **70.7** | 70.4 | 1/11 | 3/11 | 22,516 | 73.6 | `extract/computed/out/shadcn/<comp>/scorecard.json` |
| Flowbite / Tailwind | 11 | **90.4** | 90.7 | 6/11 | 10/11 | 13,804 | 93.5 | `extract/computed/out/tailwind/<comp>/scorecard.json` |
| Fluent 2 | 11 | **82.5** | 82.4 | 4/11 | 7/11 | 132,426 | 80.8 | `extract/computed/out/fluent/<comp>/scorecard.json` |
| **all libraries** | **104** | **86.6** | 89.7 | **52/104** | **81/104** | **583,950** | **86.1** |  |

**Read every percentage on this page as "on the easy 10.7%."** The 104 components measured here were chosen because they were **tractable**, not at random — they are Button, Badge, Chip, Card, Checkbox, Tag, Avatar, Divider and their siblings. Across the 8 libraries they are 101 of 943 components (10.7%). Data grid, tree, virtualized list, date picker, rich text and charts appear in **zero** committed contracts. A mean over this slice is a statement about this slice.

**Two means, both printed, because they answer different questions.** The
unweighted mean (86.6%) treats a 16-cell Spinner and an 83,520-cell Button as equals;
the cell-weighted figure (86.1%) is what fraction of every style cell in the corpus
actually matched. Neither is quoted alone. Whole-row exactness is the harshest
cut of the same data: **2,960 of 9,900** rendered rows
(29.9%) match the original on *every* channel at once.

### 3.1 Every measured component, worst first

No component is omitted. The worst row in the corpus is at the top.

| component | library | %equal | combos × states | cells | source |
|---|---|---|---|---|---|
| `Avatar` | shadcn/ui | 50.0 | 3 × 4 | 360 | `extract/computed/out/shadcn/avatar/scorecard.json` |
| `ProgressBar` | Astryx | 51.9 | 5 × 4 | 1,080 | `extract/computed/out/astryx/progressbar/scorecard.json` |
| `Tooltip` | shadcn/ui | 57.1 | 1 × 4 | 84 | `extract/computed/out/shadcn/tooltip/scorecard.json` |
| `Alert` | shadcn/ui | 61.4 | 2 × 4 | 456 | `extract/computed/out/shadcn/alert/scorecard.json` |
| `Banner` | Astryx | 62.3 | 8 × 4 | 3,648 | `extract/computed/out/astryx/banner/scorecard.json` |
| `TabList` | Fluent 2 | 65.0 | 48 × 4 | 27,840 | `extract/computed/out/fluent/tablist/scorecard.json` |
| `Switch` | shadcn/ui | 65.6 | 8 × 4 | 1,440 | `extract/computed/out/shadcn/switch/scorecard.json` |
| `Checkbox` | Fluent 2 | 67.2 | 24 × 4 | 12,864 | `extract/computed/out/fluent/checkbox/scorecard.json` |
| `Checkbox` | shadcn/ui | 67.5 | 6 × 4 | 912 | `extract/computed/out/shadcn/checkbox/scorecard.json` |
| `Avatar` | Polaris | 69.8 | 10 × 4 | 1,920 | `extract/computed/out/avatar/scorecard.json` |
| `Card` | shadcn/ui | 70.4 | 2 × 4 | 432 | `extract/computed/out/shadcn/card/scorecard.json` |
| `Card` | Flowbite / Tailwind | 72.4 | 1 × 4 | 116 | `extract/computed/out/tailwind/card/scorecard.json` |
| `Checkbox` | MUI | 72.5 | 6 × 4 | 1,656 | `extract/computed/out/mui/checkbox/scorecard.json` |
| `Radio` | MUI | 73.5 | 28 × 4 | 7,392 | `extract/computed/out/mui/radio/scorecard.json` |
| `Select` | shadcn/ui | 73.9 | 2 × 4 | 448 | `extract/computed/out/shadcn/select/scorecard.json` |
| `Button` | shadcn/ui | 74.5 | 96 × 4 | 16,512 | `extract/computed/out/shadcn/button/scorecard.json` |
| `Card` | Fluent 2 | 74.8 | 48 × 4 | 18,240 | `extract/computed/out/fluent/card/scorecard.json` |
| `Input` | Fluent 2 | 75.3 | 36 × 4 | 7,056 | `extract/computed/out/fluent/input/scorecard.json` |
| `Switch` | Astryx | 75.5 | 4 × 4 | 1,552 | `extract/computed/out/astryx/switch/scorecard.json` |
| `CircularProgress` | MUI | 76.3 | 2 × 4 | 152 | `extract/computed/out/mui/circularprogress/scorecard.json` |
| `Accordion` | Carbon | 77.6 | 16 × 4 | 5,472 | `extract/computed/out/carbon/accordion/scorecard.json` |
| `Switch` | MUI | 77.7 | 56 × 4 | 25,088 | `extract/computed/out/mui/switch/scorecard.json` |
| `Button` | Carbon | 79.0 | 112 × 4 | 20,608 | `extract/computed/out/carbon/button/scorecard.json` |
| `Drawer` | MUI | 80.4 | 2 × 4 | 92 | `extract/computed/out/mui/drawer/scorecard.json` |
| `Tag` | Carbon | 80.5 | 52 × 4 | 12,896 | `extract/computed/out/carbon/tag/scorecard.json` |
| `Checkbox` | Polaris | 81.0 | 6 × 4 | 2,464 | `extract/computed/out/checkbox/scorecard.json` |
| `Tag` | Polaris | 81.0 | 32 × 4 | 7,401 | `extract/computed/out/tag/scorecard.json` |
| `RadioButton` | Polaris | 81.3 | 4 × 4 | 1,392 | `extract/computed/out/radiobutton/scorecard.json` |
| `Button` | Altitude | 81.5 | 5 × 4 | 1,280 | `extract/computed/out/altitude/button/scorecard.json` |
| `Switch` | Fluent 2 | 81.5 | 12 × 4 | 2,064 | `extract/computed/out/fluent/switch/scorecard.json` |
| `Avatar` | Altitude | 81.7 | 4 × 4 | 568 | `extract/computed/out/altitude/avatar/scorecard.json` |
| `TextField` | Polaris | 82.0 | 64 × 4 | 41,440 | `extract/computed/out/textfield/scorecard.json` |
| `Tabs` | shadcn/ui | 82.1 | 1 × 4 | 632 | `extract/computed/out/shadcn/tabs/scorecard.json` |
| `Badge` | shadcn/ui | 82.3 | 6 × 4 | 1,008 | `extract/computed/out/shadcn/badge/scorecard.json` |
| `Dialog` | Fluent 2 | 82.4 | 3 × 4 | 442 | `extract/computed/out/fluent/dialog/scorecard.json` |
| `Link` | Altitude | 82.4 | 4 × 4 | 432 | `extract/computed/out/altitude/link/scorecard.json` |
| `LinearProgress` | MUI | 82.9 | 2 × 4 | 280 | `extract/computed/out/mui/linearprogress/scorecard.json` |
| `Spinner` | Fluent 2 | 83.3 | 64 × 4 | 19,200 | `extract/computed/out/fluent/spinner/scorecard.json` |
| `Checkbox` | Carbon | 84.3 | 6 × 4 | 1,776 | `extract/computed/out/carbon/checkbox/scorecard.json` |
| `Toggle` | Carbon | 84.3 | 4 × 4 | 1,376 | `extract/computed/out/carbon/toggle/scorecard.json` |
| `Alert` | Flowbite / Tailwind | 84.5 | 4 × 4 | 880 | `extract/computed/out/tailwind/alert/scorecard.json` |
| `Table` | MUI | 85.2 | 2 × 4 | 6,176 | `extract/computed/out/mui/table/scorecard.json` |
| `Label` | Flowbite / Tailwind | 86.3 | 5 × 4 | 320 | `extract/computed/out/tailwind/label/scorecard.json` |
| `Button` | MUI | 86.4 | 126 × 4 | 27,216 | `extract/computed/out/mui/button/scorecard.json` |
| `HelperText` | Flowbite / Tailwind | 87.1 | 5 × 4 | 340 | `extract/computed/out/tailwind/helpertext/scorecard.json` |
| `Paper` | MUI | 87.9 | 8 × 4 | 1,056 | `extract/computed/out/mui/paper/scorecard.json` |
| `ToggleSwitch` | Flowbite / Tailwind | 88.9 | 6 × 4 | 864 | `extract/computed/out/tailwind/toggleswitch/scorecard.json` |
| `TextInput` | Carbon | 89.0 | 10 × 4 | 3,560 | `extract/computed/out/carbon/textinput/scorecard.json` |
| `Fab` | MUI | 89.1 | 18 × 4 | 4,032 | `extract/computed/out/mui/fab/scorecard.json` |
| `Link` | MUI | 89.1 | 21 × 4 | 1,344 | `extract/computed/out/mui/link/scorecard.json` |
| `IconButton` | MUI | 89.3 | 18 × 4 | 3,456 | `extract/computed/out/mui/iconbutton/scorecard.json` |
| `Slider` | MUI | 89.4 | 12 × 4 | 7,392 | `extract/computed/out/mui/slider/scorecard.json` |
| `Modal` | Carbon | 90.0 | 5 × 4 | 1,305 | `extract/computed/out/carbon/modal/scorecard.json` |
| `Slider` | Astryx | 90.1 | 6 × 4 | 2,856 | `extract/computed/out/astryx/slider/scorecard.json` |
| `Chip` | MUI | 90.2 | 28 × 4 | 6,832 | `extract/computed/out/mui/chip/scorecard.json` |
| `Badge` | Flowbite / Tailwind | 90.7 | 12 × 4 | 1,968 | `extract/computed/out/tailwind/badge/scorecard.json` |
| `Tooltip` | MUI | 90.7 | 2 × 4 | 129 | `extract/computed/out/mui/tooltip/scorecard.json` |
| `Select` | MUI | 90.7 | 2 × 4 | 1,464 | `extract/computed/out/mui/select/scorecard.json` |
| `Button` | Polaris | 90.8 | 240 × 4 | 83,520 | `extract/computed/out/button/scorecard.json` |
| `Badge` | MUI | 91.1 | 14 × 4 | 4,424 | `extract/computed/out/mui/badge/scorecard.json` |
| `Accordion` | MUI | 91.8 | 8 × 4 | 6,400 | `extract/computed/out/mui/accordion/scorecard.json` |
| `Tooltip` | Fluent 2 | 92.0 | 4 × 4 | 224 | `extract/computed/out/fluent/tooltip/scorecard.json` |
| `ProgressBar` | Polaris | 92.1 | 12 × 4 | 1,824 | `extract/computed/out/progressbar/scorecard.json` |
| `TextInput` | Flowbite / Tailwind | 92.4 | 15 × 4 | 2,520 | `extract/computed/out/tailwind/textinput/scorecard.json` |
| `Avatar` | Fluent 2 | 92.4 | 24 × 4 | 5,568 | `extract/computed/out/fluent/avatar/scorecard.json` |
| `Input` | shadcn/ui | 93.1 | 2 × 4 | 232 | `extract/computed/out/shadcn/input/scorecard.json` |
| `Tabs` | Carbon | 93.2 | 1 × 4 | 1,240 | `extract/computed/out/carbon/tabs/scorecard.json` |
| `TextInput` | Astryx | 93.4 | 9 × 4 | 2,736 | `extract/computed/out/astryx/textinput/scorecard.json` |
| `Badge` | Altitude | 93.8 | 10 × 4 | 1,280 | `extract/computed/out/altitude/badge/scorecard.json` |
| `Tabs` | MUI | 93.8 | 6 × 4 | 4,320 | `extract/computed/out/mui/tabs/scorecard.json` |
| `CheckboxInput` | Astryx | 93.9 | 2 × 4 | 976 | `extract/computed/out/astryx/checkboxinput/scorecard.json` |
| `Pagination` | MUI | 94.0 | 1 × 4 | 796 | `extract/computed/out/mui/pagination/scorecard.json` |
| `Blockquote` | Flowbite / Tailwind | 94.1 | 1 × 4 | 68 | `extract/computed/out/tailwind/blockquote/scorecard.json` |
| `Menu` | MUI | 94.2 | 1 × 4 | 171 | `extract/computed/out/mui/menu/scorecard.json` |
| `Chip` | Altitude | 94.3 | 12 × 4 | 1,968 | `extract/computed/out/altitude/chip/scorecard.json` |
| `Breadcrumbs` | MUI | 94.8 | 1 × 4 | 788 | `extract/computed/out/mui/breadcrumbs/scorecard.json` |
| `Snackbar` | MUI | 94.9 | 1 × 4 | 59 | `extract/computed/out/mui/snackbar/scorecard.json` |
| `Autocomplete` | MUI | 95.1 | 2 × 4 | 2,536 | `extract/computed/out/mui/autocomplete/scorecard.json` |
| `Dialog` | MUI | 95.4 | 5 × 4 | 435 | `extract/computed/out/mui/dialog/scorecard.json` |
| `Badge` | Astryx | 95.8 | 14 × 4 | 1,512 | `extract/computed/out/astryx/badge/scorecard.json` |
| `TextField` | MUI | 95.8 | 1 × 4 | 952 | `extract/computed/out/mui/textfield/scorecard.json` |
| `Avatar` | MUI | 95.8 | 3 × 4 | 384 | `extract/computed/out/mui/avatar/scorecard.json` |
| `Button` | Fluent 2 | 96.3 | 90 × 4 | 15,120 | `extract/computed/out/fluent/button/scorecard.json` |
| `Alert` | MUI | 96.7 | 12 × 4 | 3,888 | `extract/computed/out/mui/alert/scorecard.json` |
| `Banner` | Polaris | 97.0 | 16 × 4 | 12,192 | `extract/computed/out/banner/scorecard.json` |
| `InlineNotification` | Carbon | 97.1 | 12 × 4 | 4,944 | `extract/computed/out/carbon/inlinenotification/scorecard.json` |
| `Badge` | Polaris | 97.5 | 60 × 4 | 23,396 | `extract/computed/out/badge/scorecard.json` |
| `Button` | Flowbite / Tailwind | 97.6 | 50 × 4 | 6,600 | `extract/computed/out/tailwind/button/scorecard.json` |
| `Badge` | Fluent 2 | 97.8 | 192 × 4 | 23,808 | `extract/computed/out/fluent/badge/scorecard.json` |
| `Button` | Astryx | 98.8 | 24 × 4 | 11,520 | `extract/computed/out/astryx/button/scorecard.json` |
| `Card` | Astryx | 98.8 | 13 × 4 | 1,352 | `extract/computed/out/astryx/card/scorecard.json` |
| `Divider` | Altitude | 100.0 | 2 × 4 | 144 | `extract/computed/out/altitude/divider/scorecard.json` |
| `Heading` | Altitude | 100.0 | 14 × 4 | 392 | `extract/computed/out/altitude/heading/scorecard.json` |
| `IconClose` | Altitude | 100.0 | 8 × 4 | 160 | `extract/computed/out/altitude/iconclose/scorecard.json` |
| `Token` | Astryx | 100.0 | 33 × 4 | 6,864 | `extract/computed/out/astryx/token/scorecard.json` |
| `IconButton` | Carbon | 100.0 | 40 × 4 | 1,120 | `extract/computed/out/carbon/iconbutton/scorecard.json` |
| `Card` | MUI | 100.0 | 4 × 4 | 704 | `extract/computed/out/mui/card/scorecard.json` |
| `Divider` | MUI | 100.0 | 3 × 4 | 288 | `extract/computed/out/mui/divider/scorecard.json` |
| `InputAdornment` | MUI | 100.0 | 2 × 4 | 280 | `extract/computed/out/mui/inputadornment/scorecard.json` |
| `Spinner` | Polaris | 100.0 | 2 × 4 | 8 | `extract/computed/out/spinner/scorecard.json` |
| `Kbd` | Flowbite / Tailwind | 100.0 | 1 × 4 | 128 | `extract/computed/out/tailwind/kbd/scorecard.json` |
| `Spinner` | Flowbite / Tailwind | 100.0 | 40 × 4 | 0 | `extract/computed/out/tailwind/spinner/scorecard.json` |
| `Text` | Polaris | 100.0 | 379 × 4 | 24,256 | `extract/computed/out/text/scorecard.json` |
| `Thumbnail` | Polaris | 100.0 | 4 × 4 | 592 | `extract/computed/out/thumbnail/scorecard.json` |

### 3.2 The frontier fixture — held out of every average above

`extract/computed/out/conformance/` holds **80** more scorecards with a mean of
**94.8%** over 5,688 cells. They are **excluded from §3 entirely** and
must never be folded into a library mean: they are *synthetic single-construct
cases* built by this repo to probe one CSS or DOM feature each, not components
from anyone's design system. Including them would raise the headline number by
averaging in a fixture we wrote ourselves to be measurable. That is the shape
of every overclaim this repo has caught, so the split is structural here — the
corpus is partitioned by directory before any mean is taken, and §8 checks that
no scorecard escaped classification.

| fixture | cases | mean %equal | counted in §3? | source |
|---|---|---|---|---|
| synthetic CSS/DOM constructs | 80 | 94.8 | **no** | `extract/computed/out/conformance/*/scorecard.json` |
| real third-party components | 104 | 86.6 | yes | `extract/computed/out/**/scorecard.json` |

---

## 4. Fidelity — canvas → code

The reverse journey, measured on a real Figma community kit (Untitled UI).
Variants are proposed from the canvas into contracts, emitted as static HTML,
rendered, and scored against the exported reference image of the same variant.

| measure | value | source |
|---|---|---|
| rows in the scored table | 599 | `examples/untitled-ui/renders/fidelity.json` |
| statically scorable | 537 | same file, rows with a numeric `score` |
| **mean fidelity over those** | **92.70%** | same file |
| component sets | 15 | same file, distinct `set` |
| unscored | 62 | same file, rows with `score: null` — itemised below |

**The 62 unscored rows are named, not dropped**, and they are not all one thing:

| why a row is unscored | rows | source |
|---|---|---|
| interaction-state (CSS-rendered, not statically scorable) | 58 | `fidelity.json`, `note` field |
| axis not carried: size=xxs | 4 | `fidelity.json`, `note` field |

Only 58 of them are the interaction-state exclusion
(a hover or focus rendering is produced by CSS at runtime and a static export
cannot be scored against it). The rest are a **carriage gap, not an instrument
limit** — an axis the pipeline did not carry — and they are counted here as
such rather than folded into the same excuse.

### 4.1 Per component set

| set | variants scored | mean fidelity | source |
|---|---|---|---|
| `toggle-base` | 16 | 98.00 | `examples/untitled-ui/renders/fidelity.json` |
| `avatar-add-button` | 6 | 96.69 | `examples/untitled-ui/renders/fidelity.json` |
| `avatar` | 162 | 96.17 | `examples/untitled-ui/renders/fidelity.json` |
| `progress-bar` | 55 | 94.02 | `examples/untitled-ui/renders/fidelity.json` |
| `button-group-base` | 32 | 92.24 | `examples/untitled-ui/renders/fidelity.json` |
| `social-button` | 108 | 92.06 | `examples/untitled-ui/renders/fidelity.json` |
| `button-base` | 20 | 91.97 | `examples/untitled-ui/renders/fidelity.json` |
| `input-field-base` | 10 | 91.63 | `examples/untitled-ui/renders/fidelity.json` |
| `avatar-label-group` | 12 | 91.48 | `examples/untitled-ui/renders/fidelity.json` |
| `badge-base` | 8 | 91.33 | `examples/untitled-ui/renders/fidelity.json` |
| `slider` | 40 | 91.18 | `examples/untitled-ui/renders/fidelity.json` |
| `dropdown-list-item` | 12 | 90.91 | `examples/untitled-ui/renders/fidelity.json` |
| `progress-circle` | 16 | 85.85 | `examples/untitled-ui/renders/fidelity.json` |
| `avatar-group` | 12 | 84.90 | `examples/untitled-ui/renders/fidelity.json` |
| `tooltip` | 28 | 81.21 | `examples/untitled-ui/renders/fidelity.json` |

**Denominator for this table:** these are the sets in one community kit that
were imported at all. The kit's un-imported sets do not appear as low scores;
they do not appear. See [23 §1](23-known-limitations.md#1-coverage--how-much-of-a-library-is-actually-captured).

---

## 5. Reproducibility — the part that is not a percentage

A fidelity number you cannot reproduce is an anecdote. These are the pins that
make the numbers above re-derivable, and each is enforced by a gate rather than
asserted in prose.

| pin | value | what it forbids | source |
|---|---|---|---|
| generated source, byte-identical | 292 files hashed | a contract change altering generated code without review | `evals/golden.json` |
| capture double-sweep identity | 184/184 runs | a capture whose second sweep disagrees with its first | `extract/computed/out/**/numbers.json`, `determinism` |
| browser captures behind the corpus | 10,148 | a floor quoted from a sample smaller than it claims | same files, `captures` |
| executable claims | 225 gates | a documented behaviour with no test | `evals/results.json` |
| dropped-fact receipt count | 104 pinned exactly | honesty being switched off unnoticed — see §6 | `extract/figma/dagger-census.json` |
| doc numbers vs the repo | gated | a doc quoting a number the repo no longer produces | `scripts/docs-numbers-check.mjs` |
| this document vs its sources | `--check` | this page going stale while still reading as current | `scripts/build-capability-report.mjs` |

### 5.1 The claim suite by class

The 225 evals are not all "does it work". They are classified by what they
claim, and the largest classes after extraction are **detection** and
**refusal** — gates that fail if the engine *stops* saying no. That balance is
the point: an engine that carries everything is not a better engine, it is one
that has stopped telling you what it could not do.

| claim class | gates | what the class asserts | source |
|---|---|---|---|
| `C1-determinism` | 35 | same input, same bytes out | `evals/results.json` |
| `C2-refusal` | 36 | the engine refuses BY NAME rather than guessing | `evals/results.json` |
| `C3-detection` | 67 | a defect or drift is caught, not silently absorbed | `evals/results.json` |
| `C4-convergence` | 4 | a round trip settles instead of oscillating | `evals/results.json` |
| `C5-extraction` | 64 | a fact is carried out of a real library correctly | `evals/results.json` |
| `C6-theming` | 1 | a mode/brand switch resolves to the right values | `evals/results.json` |
| `C7-cli` | 5 | the command-line surface behaves as documented | `evals/results.json` |
| `C8-journey` | 13 | an end-to-end adopter path completes | `evals/results.json` |

---

## 6. The honesty instruments, counted as features

These are the numbers this repo is least tempted to publish and most needs to.
Each one counts something the engine **could not do and said so**. They belong
in a capability report because a conversion tool without them is not more
capable — it is just quieter.

### 6.1 Dropped-fact receipts (`†`)

When the plugin engine compiles a contract and cannot carry a fact onto the
canvas, it names the fact: the compiled component data carries a `codeOnlyFacts`
list (part, kind, channel, value, reason, variant coverage), `figma bundle` writes that list
beside `contracts` and prints a per-contract summary, the built set is stamped
`ds_contracts/codeOnlyFacts`, the plugin's run report lists the facts under the set,
and the set description keeps one trailing `†` with the count. Across 9 committed
corpora there are **104** daggered contracts naming **2,321** facts, and both
counts are pinned **exactly** — in both directions.
Fewer receipts is not automatically progress: it is either a real fix or a
refusal path that quietly stopped firing, and both require a human to look.

| corpus | dropped-fact receipts | contracts carrying one | facts named | source |
|---|---|---|---|---|
| `mui` | 31 | 31 | 893 | `extract/figma/dagger-census.json` |
| `untitled-ui` | 16 | 16 | 72 | `extract/figma/dagger-census.json` |
| `polaris` | 12 | 12 | 414 | `extract/figma/dagger-census.json` |
| `shadcn` | 11 | 11 | 200 | `extract/figma/dagger-census.json` |
| `carbon` | 10 | 10 | 508 | `extract/figma/dagger-census.json` |
| `altitude` | 8 | 8 | 50 | `extract/figma/dagger-census.json` |
| `astryx` | 8 | 8 | 130 | `extract/figma/dagger-census.json` |
| `tailwind` | 8 | 8 | 54 | `extract/figma/dagger-census.json` |
| `eventz-vars` | 0 | 0 | 0 | `extract/figma/dagger-census.json` |
| **total** | **104** |  | **2,321** |  |

### 6.2 Named refusals — the construct vocabularies

Two hand-authored manifests are the independent denominators for "what can the
engine be asked to do". Both are deliberately **not** derived from the code that
decides carriage — every instrument that derives its denominator from the same
filter that decides carriage scores 100% on a channel it never opened.

| manifest | cases | breakdown | source |
|---|---|---|---|
| canvas constructs | 135 | CARRIED 100 · LEDGERED 26 · REFUSED 9 | `extract/figma/conformance/MANIFEST.json` |
| CSS / DOM frontier | 82 | CARRIED 42 · REFUSED 18 · UNSUPPORTED 18 · LOWERED 4 | `conformance/MANIFEST.json` |

Of the 135 canvas constructs, **116** are `green`, **19** are `red`.
A construct that is neither carried nor named-refused is a hard failure of that
suite — "it silently did nothing" is not an allowed outcome.

### 6.3 Every execution reaches the fact diff; exactness is separate

Canvas → code → canvas, on the Untitled UI kit. The claim is **not** that the
round trip is lossless or exact. It runs to completion on
every component and every fact lands in exactly one of four buckets, so a loss
is a row in a table rather than an absence.

| bucket | facts | share of all facts | source |
|---|---|---|---|
| matched | 11,400 | 31.4% | `extract/figma/roundtrip-uui/report.json` |
| diverged | 1,857 | 5.1% | same file |
| loss | 7,671 | 21.1% | same file |
| invented | 15,359 | 42.3% | same file |
| **components executed to fact diff** | **15 / 15** |  | same file, `totals` |
| **verified exact projections** | **0 / 15** |  | same file, `totals.exactVerified` |
| legacy-unverified projections | 15 |  | same file, `totals.exactLegacyUnverified` |

**31.4% matched is the honest headline, and it is not high.** The value of this
instrument is the classification, not the ratio — and the largest single
category is an artifact of the comparison rather than a loss:

- **`auto-layout-inert` — 934 of the 954 `layout.mode` divergences**
  (50.3% of all divergence). A frame with one child, or with children the
  designer positioned absolutely, has no observable auto-layout direction to
  read back; the engine writes a direction that the original canvas did not
  record. It is tagged as its own class precisely so it cannot be counted as a
  fidelity loss. The remaining 20 `layout.mode` divergences are real.

Every bucket is tagged, and the untagged remainder is reported as untagged:

| bucket | tag | facts | source |
|---|---|---|---|
| diverged | `auto-layout-inert` | 934 | `extract/figma/roundtrip-uui/report.json` |
| diverged | `layout-projection-loss` | 242 | `extract/figma/roundtrip-uui/report.json` |
| diverged | `geometry-projection-loss` | 185 | `extract/figma/roundtrip-uui/report.json` |
| diverged | `instance-target-loss` | 182 | `extract/figma/roundtrip-uui/report.json` |
| diverged | `shape-kind-loss` | 170 | `extract/figma/roundtrip-uui/report.json` |
| diverged | `variant-projection-loss` | 90 | `extract/figma/roundtrip-uui/report.json` |
| diverged | `vector-glyph` | 32 | `extract/figma/roundtrip-uui/report.json` |
| diverged | `instance-ink-loss` | 16 | `extract/figma/roundtrip-uui/report.json` |
| diverged | `text-content-projection-loss` | 6 | `extract/figma/roundtrip-uui/report.json` |
| loss | `restructured` | 3,419 | `extract/figma/roundtrip-uui/report.json` |
| loss | `interaction-states` | 1,920 | `extract/figma/roundtrip-uui/report.json` |
| loss | `geometry-projection-loss` | 851 | `extract/figma/roundtrip-uui/report.json` |
| loss | `paint-effect-projection-loss` | 708 | `extract/figma/roundtrip-uui/report.json` |
| loss | `vector-glyph` | 297 | `extract/figma/roundtrip-uui/report.json` |
| loss | `instance-ink-loss` | 173 | `extract/figma/roundtrip-uui/report.json` |
| loss | `layout-projection-loss` | 84 | `extract/figma/roundtrip-uui/report.json` |
| loss | `variant-projection-loss` | 58 | `extract/figma/roundtrip-uui/report.json` |
| loss | `text-style-identity` | 55 | `extract/figma/roundtrip-uui/report.json` |
| loss | `url-image` | 54 | `extract/figma/roundtrip-uui/report.json` |
| loss | `instance-target-loss` | 32 | `extract/figma/roundtrip-uui/report.json` |
| loss | `shape-kind-loss` | 20 | `extract/figma/roundtrip-uui/report.json` |
| invented | `cartesian-fill` | 5,282 | `extract/figma/roundtrip-uui/report.json` |
| invented | `layout-mode-derivative` | 3,736 | `extract/figma/roundtrip-uui/report.json` |
| invented | `restructured` | 3,419 | `extract/figma/roundtrip-uui/report.json` |
| invented | `structure-wrapper-invention` | 2,156 | `extract/figma/roundtrip-uui/report.json` |
| invented | `duplicate-sibling-expansion` | 492 | `extract/figma/roundtrip-uui/report.json` |
| invented | `hug-vs-fixed` | 62 | `extract/figma/roundtrip-uui/report.json` |
| invented | `zero-stroke` | 60 | `extract/figma/roundtrip-uui/report.json` |
| invented | `zero-fill` | 54 | `extract/figma/roundtrip-uui/report.json` |
| invented | `text-style-identity` | 45 | `extract/figma/roundtrip-uui/report.json` |
| invented | `mixed-stroke-weight` | 32 | `extract/figma/roundtrip-uui/report.json` |
| invented | `vector-glyph` | 15 | `extract/figma/roundtrip-uui/report.json` |
| invented | `declared-not-drawn` | 6 | `extract/figma/roundtrip-uui/report.json` |

The `(untagged)` rows are the honest hole in this instrument: those facts are
classified into a bucket but carry no *reason*, so nothing here can say whether
they are engine defects or comparison artifacts. They are printed rather than
excluded from the denominator.

---

## 7. What the sources cannot answer

Questions a reader of this page will reasonably ask, for which no committed
artifact holds an answer. They are listed instead of estimated, and instead of
quietly omitted — an omission reads as "nothing to report here", which is a
stronger claim than the evidence supports.

| question | why this document does not answer it |
|---|---|
| a pass/fail count for `npm run paste:check` | `extract/figma/paste-door-check.ts` asserts against strings it prints and writes no machine-readable receipt. Its result is a green or red exit code inside `npm run eval`, counted there and nowhere else. This document does not transcribe a console. |
| a pass/fail count for `npm run plugin:check` | `scripts/plugin-engine-check.mjs` asserts against strings it prints and writes no machine-readable receipt. Its result is a green or red exit code inside `npm run eval`, counted there and nowhere else. This document does not transcribe a console. |

**Also not measured anywhere, and therefore not claimed:** how long a library
takes to onboard, how much of the work is expert-configured rather than
automatic, and whether any of this holds past the coverage fraction in §2.
Those are the questions [23 — Known Limitations](23-known-limitations.md)
exists to answer, and it answers them against this tool.

---

## 8. Cross-checks — two artifacts that must agree

Every row is a number this build derived twice, from independent files. A
disagreement is printed here and is never resolved toward the more flattering
value. This section is the reason to trust §3 more than a hand-written table:
the corpus is counted by the filesystem and again by a document written months
earlier for a different purpose.

| what must agree | derived here | and here | result |
|---|---|---|---|
| components measured AND backed by a committed contract = components pinned by the drift instrument | 101 — `extract/computed/out/**/scorecard.json ∩ examples/*/contracts/*.contract.json` | 101 — `docs/22-generality.md §8.3, "pinned" total` | ✔ |
| contracts committed under `examples/<lib>/contracts` = the coverage table's committed column | 104 — `examples/*/contracts/*.contract.json` | 104 — `docs/22-generality.md §8.3, "contracts committed" total` | ✔ |
| the eval suite has as many result rows as it claims | 225 — `evals/results.json → results.length` | 225 — `same file → total` | ✔ |
| every capture run carries the two-sweep determinism receipt | 184 — `extract/computed/out/**/numbers.json` | 184 — `count of numbers.json files` | ✔ |
| every scorecard falls in a known corpus | 0 — `extract/computed/out/**/scorecard.json` | 0 — `the library registry in this script` | ✔ |
| every round-trip execution reached the fact diff | 15 — `extract/figma/roundtrip-uui/report.json → totals.roundTripClosed` | 15 — `same file → totals.components` | ✔ |
| Altitude — contracts on disk = the coverage table's committed column | 8 — `examples/altitude/contracts/*.contract.json` | 8 — `docs/22-generality.md §8.3` | ✔ |
| Altitude — components measured AND committed = the coverage table's pinned column | 8 — `extract/computed/out/altitude/<comp>/scorecard.json` | 8 — `docs/22-generality.md §8.3` | ✔ |
| Astryx — contracts on disk = the coverage table's committed column | 13 — `examples/astryx/contracts/*.contract.json` | 13 — `docs/22-generality.md §8.3` | ✔ |
| Astryx — components measured AND committed = the coverage table's pinned column | 10 — `extract/computed/out/astryx/<comp>/scorecard.json` | 10 — `docs/22-generality.md §8.3` | ✔ |
| Carbon — contracts on disk = the coverage table's committed column | 10 — `examples/carbon/contracts/*.contract.json` | 10 — `docs/22-generality.md §8.3` | ✔ |
| Carbon — components measured AND committed = the coverage table's pinned column | 10 — `extract/computed/out/carbon/<comp>/scorecard.json` | 10 — `docs/22-generality.md §8.3` | ✔ |
| MUI — contracts on disk = the coverage table's committed column | 31 — `examples/mui/contracts/*.contract.json` | 31 — `docs/22-generality.md §8.3` | ✔ |
| MUI — components measured AND committed = the coverage table's pinned column | 31 — `extract/computed/out/mui/<comp>/scorecard.json` | 31 — `docs/22-generality.md §8.3` | ✔ |
| Polaris — contracts on disk = the coverage table's committed column | 12 — `examples/polaris/contracts/*.contract.json` | 12 — `docs/22-generality.md §8.3` | ✔ |
| Polaris — components measured AND committed = the coverage table's pinned column | 12 — `extract/computed/out/<comp>/scorecard.json` | 12 — `docs/22-generality.md §8.3` | ✔ |
| shadcn/ui — contracts on disk = the coverage table's committed column | 11 — `examples/shadcn/contracts/*.contract.json` | 11 — `docs/22-generality.md §8.3` | ✔ |
| shadcn/ui — components measured AND committed = the coverage table's pinned column | 11 — `extract/computed/out/shadcn/<comp>/scorecard.json` | 11 — `docs/22-generality.md §8.3` | ✔ |
| Flowbite / Tailwind — contracts on disk = the coverage table's committed column | 8 — `examples/tailwind/contracts/*.contract.json` | 8 — `docs/22-generality.md §8.3` | ✔ |
| Flowbite / Tailwind — components measured AND committed = the coverage table's pinned column | 8 — `extract/computed/out/tailwind/<comp>/scorecard.json` | 8 — `docs/22-generality.md §8.3` | ✔ |

All 20 agree.

---

## 9. How to reproduce every number on this page

```bash
# rebuild this document from the committed artifacts (no browser, no network,
# no capture run — it only reads files that are already in the repo)
npm run capability:report

# refuse if the committed copy differs from a rebuild (this is also an eval)
npm run capability:fresh
```

### Sources this build read

| artifact | sha256 (12) | bytes | what it supplied |
|---|---|---|---|
| `conformance/MANIFEST.json` | `8231a2e8b195` | 76,456 | CSS/DOM frontier vocabulary |
| `docs/22-generality.md` | `0ae9595b1aad` | 72,312 | coverage denominators (docs/22 §8.3 table) |
| `evals/golden.json` | `29091114a7c0` | 32,256 | generated-source golden manifest |
| `evals/results.json` | `5081770dbb7e` | 6,982 | executable claim suite (registry ids + size; the pass column is the suite's own output) |
| `examples/untitled-ui/renders/fidelity.json` | `0a468d6682bf` | 84,415 | Untitled UI scored fidelity table |
| `extract/computed/out/**/numbers.json` | `d5bcd57769dc` | 1,056,246 | capture counts + determinism receipts — 184 files |
| `extract/computed/out/**/scorecard.json` | `3f0067a3f412` | 16,283,364 | computed-equality per component — 184 files |
| `extract/figma/conformance/MANIFEST.json` | `9c2374097aba` | 86,207 | canvas construct vocabulary |
| `extract/figma/dagger-census.json` | `a8445c32d0b1` | 6,112 | dropped-fact receipt census |
| `extract/figma/roundtrip-uui/report.json` | `3f4d66b6b63c` | 7,704,705 | canvas→code→canvas round trip |

Same bytes in, same file out: this build reads no clock, no git state and no
environment, and sorts every collection before rendering.

---

## 10. What it costs

Not restated here, deliberately — a summary of the limitations written by the
success document is a summary written by the interested party. The complete
inventory is **[23 — Known Limitations](23-known-limitations.md)**, and it is
the longer document. Start with its §1, which holds the same coverage
denominator this page opens with.

Further reading: [22 — Generality](22-generality.md) (the evidence behind the
engine claim and where it leaks) ·
[conformance/EXPECTATIONS.md](../conformance/EXPECTATIONS.md) (the measured CSS/DOM frontier) ·
[18 — User Flows](18-user-flows.md) (the ranked gap list).
