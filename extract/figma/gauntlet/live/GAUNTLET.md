# THE LIVE GAUNTLET — CBDS UI Kit Demo, easy → extremely difficult, autonomous run

> **HEAL ROUND (2026-07-20) — the round below is the BEFORE record; the fix
> classes it names are now closed or renamed.** Full visual replay after the
> fixes (PNGs RE-BANKED at file version `2376868785213219294` — the live file
> moved since the banked `2374568486037958769`, so per-row deltas fold in any
> owner edits; 1,106/1,106 banked, 0 declined):
>
> **1,106/1,106 diffed / 0 refused / 0 skipped** (was 1,094 / 12 / 0) —
> masked median **11.55% → 7.03%**, p90 **61.72% → 27.04%**, max
> **98.58% → 97.39%** (the max is now _Tab-item-pill's pre-existing
> state-fill row, unchanged before→after). Per-class:
>
> - **① fill-matrix-depth-drop → FIXED** (bound-paint drift routes to the
>   mint pass; pair/triple substituted root refs): Badge **67.38 → 17.25**,
>   Chip **77.00 → 17.74**, Alert 9.44 → 8.93 medians. Remaining Badge/Chip
>   rows are the OUTLINE variants' partial stroke ('bound in 19/60 —
>   inconsistent') — a different, named, pre-existing limit.
> - **④ linked-child-html-escaped-as-text → FIXED** (corrected diagnosis:
>   raw-text/void/select root content models, not an escape path; the box
>   projects to a named `<div>`): Input Text **14.44 → 7.07**, Input Date
>   **14.49 → 7.79**, Input Number 15.68 → 11.37; Text Area's literal-markup
>   ink gone (5.25 → 5.17 median — text was masked). Dropdown family trades
>   rows (5.10 → 6.73, MutliSelect 8.71 → 16.26): the projected div renders
>   the DRAWN anatomy where the native select painted its own chrome — the
>   66% caret-only worst rows are gone; the residue is real structural drift,
>   not dropped children.
> - **③ session-id-collision-false-cycle → FIXED** (proposal-time
>   key-identity suffix): Radio button **12 refused → 12 diffed, 9.60%**
>   median — zero refused rows remain in the whole run.
> - **⑤ linked-icon-wrapper-collapses → FIXED** (slot-only fixed wrappers
>   floor at the drawn box): Icon Button primaries **55.25 → 9.79**,
>   secondaries **27.5 → 11.9**, tertiaries **6.96 → 2.60**;
>   Checkbox-icon 8.3 → **1.48**, Toggle-icon 5.6 → **1.74**.
> - **⑦ underscore pickSet → folded upstream**, clone deleted.
> - **② duplicate-name-key-contradiction — NOT fixed here** (capture-level:
>   dump format decision, out of this round's scope); its 4 stubs render
>   honest geometry, and the heal checker is now KEY-AWARE (a wrong-key
>   'heal' refuses honestly instead of linking the name-coincidence).
> - Unchanged and still named: _Button single-card 77.87 (instance-level
>   FILL on refs, 197dd02), Link-* 21.98 (instance-internal glyph ink),
>   Radio button-icon 27.04 (instance internals never recursed).
>
> Machine record: `live-baseline.json` (rewritten by this replay). Harness
> hardening that rode along: bounded fonts-settle + pointer hover in
> visual-parity/render.ts (a flaky unbounded CDP await hung 1,100-render
> runs), per-subject page recycling in visual-live.ts.

Every tier replayed OFFLINE from the banked v1.6 capture through the exact playground
receive semantics. Reproduce: `npm run extract:figma:gauntlet:live` (harness) and
`npm run extract:figma:gauntlet:live:visual` (pixel stage — replays from the banked
PNG cache in `.gauntlet-live-cache/`; re-bank with `tsx extract/figma/gauntlet/live/bank-pngs.ts`).
Machine records: `gauntlet.json`, `live-baseline.json` (SEPARATE from the standing
visual-parity `baseline.json`, which this run never touches), `mega-session.json`.

## Phase-1 capture integrity

- `extract/figma/fixtures/cbds-plugin-all-sets.v16.dump.json` — the VERBATIM
  dump.plugin.js v1.6 engine, streamed in 15 chunks from the plugin sandbox's own
  `fetch` to a localhost receiver (nothing large transits tool responses; method in
  `capture-receiver.mjs` / `build-engine.mjs`). File version `2374568486037958769`
  pinned in provenance; PNGs banked at the SAME version.
- **1,618 name-keyed sets — the v14 roster EXACTLY** (zero owner content edits; every
  record's delta vs v14 is the additive v1.5/v1.6 channels: `instanceKey` /
  `instanceSetKey` / `bbox`). 127 captured variables, 3,316 degradations.
- The live roster is actually **3,133 top-level components — 1,514 duplicate names**
  collapse to 1,618 under the canonical name-keyed dump convention (last-wins). That
  collapse is not free: see failure class ② below.
- Spot check: Button-Brand Primary scoped re-dump **deep-equal** to the assembled record.
- Variables sidecar `cbds-variables-snapshot.v16.json`: **8 collections, 715 variables,
  4 multi-mode collections** — 98 captured variables carry per-mode values
  (**Light / Dark / Brutalist** — a third mode is new since v14). No drawn theme AXIS
  exists in any set, so §3 promotion correctly has nothing to promote; the per-mode
  values ride the captured-token layer.
- PNGs: **1,106/1,106** variant renders banked (images API scale=2, 0 declined),
  disk-cached by node + file version.

## New failure classes — worst first

### ① `fill-matrix-depth-drop` — a two-axis color matrix drops the ROOT FILL entirely; the component renders as bare text

The proposer's per-prop token unification refuses when the bound token paths differ
in **segment depth** across the axis matrix, and the fill is then dropped with a note —
honest in prose, catastrophic in pixels (the badge/chip BOX disappears: no fill, no
per-variant padding identity, width hugs the label).

- **Chip** — masked **98.58%** (ours 71×22 vs Figma 122×72): note `Chip:root fill: token
  paths differ in depth: bg.brand.weak vs bg.neutral.weak vs bg.surface-primary vs
  bg.brand.weak-hov…` — 64 variants render as bare "Label" text.
- **Badge** — masked **96.85%** (ours 71×22 vs Figma 122×48): `Badge:root fill: token paths
  differ in depth: bg.brand.default vs bg.brand.weak vs bg.surface-primary vs bg.positive.def…`
  — all 72 variants, subject median 67.4%.
- **Alert** (root fill ×1), **Badge Notification** (label fill), **_Tab-item-pill**
  (state=active fill) carry the same note; 5 sets total.

Diagnosis: `core/propose-figma.ts` tokensByProp unification — the depth guard rejects
mixed-depth path families (`bg.brand.default` = 3 segments vs `bg.surface-primary` = 2)
instead of falling back to a per-(axis-value…axis-value) VALUE map or a per-combo mint.
One line: **the unifier's depth precondition turns a style-vocabulary miss into a total
paint loss on the kit's most-drawn primitives.**

### ② `duplicate-name-key-contradiction` — the name-keyed dump collapse makes 4 drawn parents unlinkable (capture-level)

The file draws **duplicate-named components** (two `Notches`, two `Square`, two
`Placeholder`, two `Circle` — part of the 1,514-duplicate roster). The name-keyed dump
keeps ONE copy (last-wins); the drawn instances point at the OTHER copy, so
`resolveChildContract` correctly REFUSES the name match on contradicting keys and stubs
— the owner sees a stub where a link is drawn, and no import order can ever heal it.

- **Text Area → Notches ×36**: instances carry key `079c5a9d…`, the dump kept `e39a70fa…`
  → children-first session still stubs 4 refs as `ds.notches-2`.
- **Checkbox-icon → Square ×14**: instance key `52027022…` vs dump `a903a892…`.
- **Radio button-icon → Circle ×14** and **Icon → Placeholder ×6**: same shape.

Diagnosis: capture convention — `dump.plugin.js` keys sets by NAME; the refusal is the
documented key-contradiction rule doing its job on a capture that cannot carry both
copies. One line: **the dump format needs duplicate-name disambiguation (key-suffixed
records or key-keyed sets), or these four children stay stubs forever.**

### ③ `session-id-collision-false-cycle` — RadioButton (plain COMPONENT) vs "Radio button" (set) → the referee reports a cycle that is not drawn

Both names sanitize to `ds.radio-button`. In a session, `Radio button-icon` imports
first and its nested `RadioButton` instance stubs/links as `ds.radio-button`; when the
parent set `Radio button` then claims the SAME id (its legitimate `selfContractId`),
the newest-wins registry rebinds the icon's ref onto the PARENT:

```
ds.radio-button: part "radioButtonIcon" component ref creates a cycle
(ds.radio-button → ds.radio-button-icon → ds.radio-button) — a contract cannot compose itself
```

- The batch pass NAMES the collision (its note held), but the SESSION path goes further:
  a **false cycle refusal** — all **12 Radio button variants refuse to render** on the
  visual stage (the only refused rows in 1,106).
- Fixture: `fixtures/session-id-collision-false-cycle-radio-button.dump.json` (the trio +
  Circle, self-contained).

Diagnosis: `core/propose-figma.ts` `stubIdFor`/`selfContractId` — the suffix guard
(`registeredConflict`) checks key contradictions for STUBS but a real proposal claiming
an id already bound to a DIFFERENT drawn component re-keys the registry silently. One
line: **cross-population id collision needs the same contradicting-key suffix discipline
at proposal-registration time, not just at stub time.**

### ④ `linked-child-html-escaped-as-text` — a linked child's markup renders as ESCAPED TEXT inside the parent

Text Area (children-first session, `_Input label` linked): our render shows the literal
string `<div class="input-label">` **as visible text inside the field** (triptych
receipt). The child's emitted markup went through a text-escape path instead of being
embedded as HTML.

- **Text Area** — masked **82.61%** worst row; every variant carries the escaped tag.
- Suspects with the same session shape and 48–66% collapse rows: **Dropdown** (renders
  only the caret at `state=disabled`, 66.17%), **Search** (65.23%), **Input Text /
  Input Number / Input Date** (48–52%).
- Contrast: **Dialog** (T5, 7 deps, linked) diffs at **5.9% median** — linked-children
  rendering per se is fine; the trigger is specific (likely the threaded-prop / content
  channel path on these input-family children).

Diagnosis: `core/emit-html.ts` component-ref rendering — one line: **somewhere on the
linked-child path, child HTML is inserted through the text-content escape**.

### ⑤ `linked-icon-wrapper-collapses` — linking the Icon set renders an EMPTY child; the parent's box collapses (worse than a stub)

The kit's `Icon` set is an INSTANCE_SWAP wrapper (slot, no drawn default content once
proposed). A LINKED `ds.icon` renders nothing — zero width — while a STUB would at least
carry the observed bbox. Icon-only composites collapse:

- **Icon Button ×9 sets** — masked **54.7–63.4% median** (ours 16×48 vs Figma 48×48:
  a narrow pill, no icon, no square). 180 rows.
- **Link-Blue / Link-Danger / Link-Neutral** — 30.7% on icon-bearing variants (masked
  metric already excludes text, so the missing icon dominates).
- **_Button single-card** — median **77.9%**.

This COMPOUNDS the known instance-internal glyph-ink limit (not re-reported): glyph ink
explains missing strokes; it does not explain the **box** vanishing. One line:
**an empty slot on a linked child should still occupy the observed geometry (the stub
discipline) — `emit-html` renders it zero-size.**

### ⑥ `optional-part-defaults-render-all` — Table-Data cell draws every optional text at once

Drawn default cell shows `Text/Data` only; ours stacks `Text/Data`, bold `Text/Data`,
`000000`, `Subtext` simultaneously (43.5% worst, though median 0.1% — most variants
fine). Boolean-visibility defaults for those optional parts default TRUE (or the
`visibleWhen` prop defaults are not recovered for parts whose axis evidence is
per-variant `hidden` flags). Diagnosis: `core/propose-figma.ts` boolean-default
inference (`hiddenCaptured` path) on multi-text cells. One line: **the drawn default
variant's hidden channel is not winning over the showcase default for these parts.**

### ⑦ `underscore-named-sets-unaddressable` (harness) — visual-parity compose cannot name 30 of the owner's sets

`extract/figma/visual-parity/compose.ts` `pickSet` treats every dump key starting with
`_` as a meta channel (`_provenance`/`_variables`/`_degradations`) — but the owner
legitimately names sets `_Input label`, `_Slot-Dialog`, `_Tab-item`, `_Error text`, …
(30 sets). 20 live composites' session scopes REFUSED before the fix. The playground's
own receive path accepts them (it checks the parsed shape, not the name).

Carried here as `visual-compose.ts` (underscore-safe clone, playground-matching
semantics) — fold the `pickSet` fix upstream and delete the clone. One line: **a
name-prefix convention is not a type test.**

## Tier scoreboard

| tier | sets | propose | referee-clean | 4-surfaces emit | facts-carried median | token refs | minted | named notes | capture degradations | parity rows | parity median (masked) | parity p90 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| T1 primitives | 2 | 2 | 2 | 2 | 100% | 10 | 15 | 25 | 0 | — | — | — |
| T2 multi-axis/boolean | 7 | 7 | 7 | 7 | 100% | 97 | 55 | 206 | 29 | 114 | 35.5% | 90.5% |
| T3 state-axis | 22 | 22 | 22 | 22 | 100% | 417 | 199 | 657 | 45 | 395 | 13.5% | 57.9% |
| T4 composites | 36 | 36 | 36 | 36 | 100% | 436 | 575 | 2,217 | 139 | 531 | 9.0% | 66.2% |
| T5 maximum | 9 | 9 | 9 | 9 | 100% | 139 | 198 | 631 | 58 | 54 | 16.8% | 39.3% |
| singles sample (50+RadioButton) | 51 | 51 | 51 | 51 | 100% | 54 | 3 | 54 | 105 | — | — | — |

- **Refusal-free ≠ pixel-right, again and louder**: 127/127 "clean" through
  propose→referee→4 emitters, yet the T2 parity median is **35.5%** — driven almost
  entirely by class ① (Badge alone is 72 of T2's 114 rows).
- T2 controls: **512/512** enum×boolean combos compile (emit-html markup+CSS per combo);
  canvas `compileComponentData` 7/7 sets (the spec grid is the combo space).
- T3 promotion: **47/47 axes behave per the shipped rules** — 30 promoted (state props
  gone, states carried, drawn `disabled` → boolean), 17 kept as enums via the DOCUMENTED
  near-miss path, each named `outside the interaction-state vocabulary`. The out-of-vocab
  inventory is a DESIGN read: `selected` (5 sets), `error` (7), `filled` (6), `active`*,
  `open`, `current-page`, `truncation`, `coloured`, `active-checkbox` — and the owner's
  literal typo **`diabled`** in Text Area's state axis (the pipeline names it; only a
  human sees it is a misspelled `disabled`).
- T5 specials: repeat collections (Navigation-Header, _Nav-item-menu: repeat part +
  arrayOf) **ok**; slot sets (Dialog, Card-Image, Card-Basic, List item, _Text-block-Panel,
  Icon) **ok** (slot parts present; the kit draws ZERO native SLOT nodes — named);
  id-collision batch note **ok**; MEGA-SESSION (10 sets, mixed order + relink pass)
  **0 stub-despite-in-scope** across the relink.

## Linked-vs-stubbed matrix (T4/T5 sessions, 45 composites)

Children-first: **0 stub-despite-import over all 45** (every stub that remains is class
② — its true parent is not in the dump). Adversarial parent-first → import child →
re-import parent: **every heal attempt healed** (`—` = parent-first produced no
matching stub to heal, e.g. all children already repo/linked).

| set | tier | deps | children-first: linked-session / linked-repo / stubbed / unresolved | stub-despite-import | adversarial: stubs → geometry mints → healed | parity med (masked %) |
|---|---|---:|---|---|---|---:|
| _Breadcrumb item | T4 | 14 | 3 / 0 / 0 / 0 | 0 | 2 → 5 → healed | 0.7 |
| _Button single-card | T4 | 5 | 3 / 0 / 0 / 0 | 0 | 3 → 6 → healed | 77.9 |
| _Controls | T4 | 2 | 2 / 0 / 0 / 0 | 0 | 2 → 0 → healed | 6.8 |
| _Nav-item-base-close | T4 | 3 | 2 / 0 / 0 / 0 | 0 | 2 → 5 → healed | 1.0 |
| _Nav-item-base-open | T4 | 3 | 3 / 0 / 0 / 0 | 0 | 2 → 5 → healed | 0.2 |
| _Nav-item-menu | T5 | 4 | 1 / 0 / 0 / 0 | 0 | 1 → 2 → healed | 0.3 |
| _Panel-Accordion | T4 | 3 | 8 / 0 / 0 / 0 | 0 | 1 → 3 → healed | 1.4 |
| _Tab-item | T4 | 3 | 3 / 0 / 0 / 0 | 0 | 2 → 5 → healed | 8.3 |
| _Tab-item-pill | T4 | 3 | 3 / 0 / 0 / 0 | 0 | 2 → 5 → healed | 2.7 |
| _Tab-item-vertical-left | T4 | 3 | 3 / 0 / 0 / 0 | 0 | 2 → 5 → healed | 4.5 |
| _Tab-item-vertical-right | T4 | 3 | 3 / 0 / 0 / 0 | 0 | 2 → 5 → healed | 4.0 |
| _Text-block-Panel | T5 | 2 | 0 / 0 / 0 / 0 | 0 | 1 → 2 → healed | 3.6 |
| Accordion | T4 | 4 | 6 / 0 / 0 / 0 | 0 | 2 → 4 → healed | 2.8 |
| Alert | T4 | 3 | 5 / 0 / 0 / 0 | 0 | 2 → 4 → healed | 9.4 |
| Avatar | T4 | 4 | 3 / 0 / 0 / 0 | 0 | 3 → 26 → healed | 1.2 |
| Avatar group | T4 | 5 | 6 / 0 / 0 / 0 | 0 | 1 → 12 → — | 12.9 |
| Breadcrumb | T4 | 15 | 1 / 0 / 0 / 0 | 0 | 1 → 1 → — | 2.6 |
| Card-Basic | T5 | 7 | 4 / 0 / 0 / 0 | 0 | 4 → 10 → healed | 3.0 |
| Card-Image | T5 | 7 | 12 / 0 / 0 / 0 | 0 | 4 → 9 → healed | 26.8 |
| Checkbox | T4 | 6 | 3 / 0 / 0 / 0 | 0 | 2 → 6 → healed | 4.5 |
| Checkbox-icon | T4 | 3 | 2 / 0 / 1 / 0 | 0 | 3 → 0 → healed | 8.3 |
| Chip | T4 | 5 | 3 / 0 / 0 / 0 | 0 | 2 → 6 → healed | 77.0 |
| Dialog | T5 | 7 | 6 / 0 / 0 / 0 | 0 | 6 → 14 → healed | 5.9 |
| Dropdown | T4 | 14 | 7 / 0 / 0 / 0 | 0 | 5 → 14 → healed | 5.1 |
| Dropdown-MutliSelect | T4 | 15 | 8 / 0 / 0 / 0 | 0 | 6 → 16 → healed | 8.7 |
| Icon | T5 | 1 | 0 / 0 / 0 / 0 | 0 | 1 → 0 → healed | 0.5 |
| Input Date | T4 | 5 | 6 / 0 / 0 / 0 | 0 | 4 → 10 → healed | 14.5 |
| Input Number | T4 | 9 | 7 / 0 / 0 / 0 | 0 | 6 → 17 → healed | 15.7 |
| Input Text | T4 | 5 | 5 / 0 / 0 / 0 | 0 | 4 → 10 → healed | 14.4 |
| List item | T5 | 12 | 5 / 0 / 0 / 0 | 0 | 6 → 15 → healed | 20.2 |
| Menu | T4 | 13 | 1 / 0 / 0 / 0 | 0 | 1 → 4 → — | 21.2 |
| Navigation-Header | T5 | 9 | 7 / 0 / 0 / 0 | 0 | 5 → 13 → healed | 4.3 |
| Navigation-Side | T4 | 20 | 25 / 0 / 0 / 0 | 0 | 7 → 15 → healed | 0.7 |
| Pagination-2 | T4 | 4 | 12 / 0 / 0 / 0 | 0 | 2 → 5 → healed | 3.3 |
| Pagination-3 | T4 | 4 | 12 / 0 / 0 / 0 | 0 | 2 → 6 → healed | 1.3 |
| Radio button | T5 | 5 | 3 / 0 / 0 / 0 | 0 | 2 → 6 → healed | — |
| Radio button-icon | T4 | 2 | 1 / 0 / 1 / 0 | 0 | 2 → 0 → healed | 27.0 |
| Search | T4 | 14 | 5 / 0 / 0 / 0 | 0 | 4 → 12 → healed | 11.6 |
| Search-MultiSelect | T4 | 15 | 6 / 0 / 0 / 0 | 0 | 5 → 14 → healed | 20.0 |
| Tab-Line | T4 | 6 | 18 / 0 / 0 / 0 | 0 | 3 → 10 → healed | 0.5 |
| Tab-Pill | T4 | 4 | 6 / 0 / 0 / 0 | 0 | 1 → 4 → healed | 1.8 |
| Table-Data cell | T4 | 20 | 10 / 0 / 0 / 0 | 0 | 9 → 34 → healed | 0.1 |
| Text Area | T4 | 6 | 4 / 0 / 4 / 0 | 0 | 5 → 12 → healed | 5.2 |
| Toggle | T4 | 3 | 1 / 0 / 0 / 0 | 0 | 1 → 4 → healed | 6.6 |
| Toggle-icon | T4 | 2 | 2 / 0 / 0 / 0 | 0 | 2 → 0 → healed | 5.6 |

Reading the matrix: the 3 children-first stub columns that are non-zero (Checkbox-icon,
Radio button-icon, Text Area) are ALL class ② — key contradictions, unhealable by
import order, honest per rule. `Radio button` parity `—` = all 12 rows refused
(class ③). The three `0` geometry-mint cells with stubs (Checkbox-icon, Radio
button-icon, Toggle-icon, _Controls, Icon) are the KNOWN 197dd02 parent-axis limit,
quantified below.

## Parity distribution (live rows)

1,094 diffed / 12 refused (all class ③) / 0 skipped, over 71 subjects at file version
`2374568486037958769`:

| bucket (masked) | rows |
|---|---:|
| ≤ 2% | 239 |
| 2–5% | 113 |
| 5–10% | 171 |
| > 10% | 571 |

Median **11.55%**, p90 **61.72%**, max **98.58%**. The >10% bucket decomposes almost
entirely into the named classes: ① fill-matrix (Badge 72 + Chip 64 + Alert rows),
⑤ icon-wrapper collapse (icon-buttons 180 + link icon rows), ④ escaped-child
(input family ~100), known parent-axis stub geometry (radio/checkbox/toggle-icon ~70),
known instance-internals (radio circles as rects), ⑥ Table-Data optional parts.
The T5 story is genuinely good where none of those trigger: **Dialog 5.9%,
Navigation-Header 4.3%, Card-Basic 3.0%, Navigation-Side 0.7%, Table-Data cell 0.1%
medians** — deep composition with linked children WORKS when the child renders.

## Known named limits — tested, recorded, NOT re-reported as new

| limit | live test result | status |
|---|---|---|
| cross-import minted-token scope | Exposure measured per composite: **1 var on 1 set** (Toggle — `--imported-toggle-icon-…` used by the parent doc, defined only by the sibling's tree). Everything else resolves because sessions here thread all trees (the session-registry seam). | **fix in flight** (parallel worktree) — retest after merge |
| disabled part-label (STYLE-FIDELITY B7) | **18 sets / 41 notes** still name un-proposable part-level state overrides (Buttons' label fill on disabled, Tab items ×3, Toggle label…) | **fix in flight** — Part.states (P18, v13) landed on the parallel worktree (552364e); on this base the notes hold |
| parent-axis-correlated stub geometry (197dd02) | **5 composites** mint ZERO stub geometry with stubs present (Checkbox-icon, Radio button-icon, Toggle-icon, _Controls, Icon). Evidence sharpened: Checkbox-icon's three square children draw **24px iff size=large, 16px iff size=small across all 44 variants** — a PERFECT single-axis correlation the mint pass misses because it consults only the STUB's own axes, and the skip note ("without correlating to any variant axis") is factually wrong about the parent axis. Visual: 8.3–27% medians. | known, now quantified — promote in the fix queue |
| instance-level FILL on refs (197dd02) | List item `type=button`: drawn full-width Button renders at intrinsic width (51.6% worst) | known, reconfirmed |
| instance internals never recursed (dump v1 declared) | Radio button-icon's `Circle` renders as a rounded RECT (27% median) — the ellipse lives inside the instance | declared limit, visual cost now measured |
| instance-internal glyph ink | masked columns already exclude text; icon GLYPHS inside linked/stubbed children remain the ink component of ⑤'s rows | known — ⑤ reports only the BOX collapse as new |
| bare-alpha ALPHA_TRIM, small-vertical FILL, min-height-on-canvas, spacing/100-negative, indeterminate-AT | not re-reported; no new evidence contradicts the standing triage | known |

## Ranked fix queue

1. **① fill-matrix-depth-drop** (`core/propose-figma.ts` tokensByProp unifier) — 5 sets,
   ~150 catastrophic rows, and they are the owner's most-reached-for primitives (Badge,
   Chip, Alert). A depth-heterogeneous fallback (value-map or per-combo mint) turns
   96–98% rows into single-digits. Biggest pixel win per line of code.
2. **④ linked-child-html-escaped-as-text** (`core/emit-html.ts` ref path) — visible
   MARKUP in the render is the single worst kind of output (worse than absence); hits
   the entire input family (~100 rows at 48–83%).
3. **③ session-id-collision-false-cycle** (`stubIdFor`/registration in
   `core/propose-figma.ts`) — a FALSE refusal (blocks all rendering of a whole set);
   the fix is the existing contradicting-key suffix discipline applied when a
   proposal claims an id at registration. Trio fixture committed.
4. **⑤ linked-icon-wrapper-collapses** (`core/emit-html.ts` empty-slot geometry) —
   200+ rows; adopt the stub discipline (observed bbox floor) for linked children whose
   slot renders empty. Unblocks the icon-button family (54–63% → glyph-ink-only).
5. **② duplicate-name-key-contradiction** (capture: `dump.plugin.js` record keying) —
   needs a dump-format decision (key-suffixed duplicate records), then the existing
   resolver logic just works. Until then 4 children are permanently stubs; pairs with
   the roster receipt (1,514 duplicate names).
6. **parent-axis stub geometry** (known, 197dd02 — promote): the mint pass should test
   correlation against the PARENT set's axes; the live evidence is a perfect
   single-axis fit on 3 stubs × 44 variants.
7. **⑥ optional-part-defaults-render-all** (`hiddenCaptured` boolean-default path) —
   one set, bounded, evidence committed.
8. **⑦ underscore pickSet** (visual-parity harness) — one-line type-test fix; delete
   `visual-compose.ts` clone after.
9. **Design-side (owner)**: the `diabled` typo in Text Area's state axis; the
   out-of-vocabulary state values inventory (`selected`/`error`/`filled`…) — either the
   promotion vocabulary grows deliberate mappings (selected→boolean, error→boolean per
   the Checkbox/Radio drawn idiom) or the kit renames; and the duplicated icon pages
   behind ② (deleting the shadow copies also fixes ② without a format change).

## Gates

- root `tsc --noEmit` green.
- evals **99/99** UNTOUCHED (no evals added; the first 3/99 read was the worktree's
  missing `node_modules` symlink — fixed per the run brief, and the 1GB PNG cache was
  moved OUT of `extract/` because `evals/.scratch` copies it per reset).
- census (`gauntlet/CENSUS.md`, `census.json`, class fixtures) byte-untouched; golden
  untouched; standing visual-parity `baseline.json` untouched (live rows live in
  `live-baseline.json`).
- Offline reproducibility: `npm run extract:figma:gauntlet:live` needs only the
  committed dump; the visual stage replays from `.gauntlet-live-cache/` (re-bankable
  with the token, never printed).
