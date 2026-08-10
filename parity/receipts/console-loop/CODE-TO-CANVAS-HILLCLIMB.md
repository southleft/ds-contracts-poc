# Code → Canvas Hill-Climb Plan

**Status:** active strategy (2026-08-06)  
**Finish line for this track:** every looped stem has `visual.matchDeveloped: true` against a developed render (site receipt or `extract/computed` pair), with an automated pixel/channel score — not a human “looks fine.”  
**Do not start canvas→code as a primary track until this bar is green on a frozen corpus.**

---

## 1. Diagnosis (why we were spinning)

We optimized the wrong layer for too long:

| Layer | What it proves | What it does **not** prove |
|---|---|---|
| Contract emit + v6 fingerprint + round-trip | Structure / bindings survive | That the canvas looks like the coded component |
| Cream-surface screenshot review | Reviewability | Pixel/aesthetic match |
| Ad-hoc Figma Console patches | Temporary demo | Engine can regenerate the same result |

The developed product is **code → computed truth → contract → emit → Figma**.  
Patches on canvas that are not re-emitted from contracts are **not** progress.

Three separate instruments already exist and must be **chained**, not treated as alternatives:

1. **Computed floor** — emit-html vs real npm package (`extract/computed`)  
2. **Canvas-gate / visual-parity** — canvas compile vs real/package pixels (`extract/figma/canvas-gate`, `visual-parity`)  
3. **Console-loop developed** — live Figma COMPONENT_SET vs developed refs (`visual.matchDeveloped`)

Today: structural console-loop ≈ 128/128; foreign developed-visual ≈ **3/48**. That gap is the work.

---

## 2. North star

> For every component in the frozen fidelity corpus, regenerating from the committed contract + tokens produces a Figma COMPONENT_SET that matches the developed render within the canvas-gate bar (≤5% masked mean AA; every cell >10% has a named cause; no blank/degenerate chrome), and `console-loop-*:evidence:check` passes with `visual.matchDeveloped: true`.

“100% of the time” means:

- **Regeneration-stable** (wipe canvas node → re-emit → same visual bar)
- **Failure-class complete** (every named refusal either closed or explicitly ledgered as out-of-scope with a grammar lift ticket)
- **Cross-library** (same engine rules; no per-lib hand patches as the pass path)

Canvas→code starts only after a **frozen** code→canvas corpus is green, so reverse projection has a trustworthy target.

---

## 3. Operating system: failure-class traps

Do not hill-climb by “fix the next ugly screenshot.” Hill-climb by **closing named failure classes** that recur across design systems.

### 3.1 Canonical failure taxonomy (extend, never silently drop)

| ID | Class | Typical symptom | Primary fix layer |
|---|---|---|---|
| FC-ABS-SIZE | Absolute/inset sized part collapsed | 1px thumb, semi-circle, detached glyph | Emit: `fixedW/H` inset; `display:contents` hoist; host `clipsContent=false` |
| FC-LH-RATIO | Unitless line-height as px | Clipped glyphs | Emit (`PERCENT`) |
| FC-PLACEHOLDER | Unresolved `{prop}` text | `{placeholder}` on canvas | Emit + contract default |
| FC-BLOCK-ROW | Block root laid out as row | Label beside field | Emit `layoutSpec` |
| FC-SLOT-DEFAULT | Empty optional slot shown | Dashed “Slot” | Emit Show=false + `defaultContent` |
| FC-PSEUDO-THUMB | `::before/::after` not carried | Toggle/checkbox without knob/✓ | Promote / anatomy grammar |
| FC-PSEUDO-SIZE | Pseudo size varies by axis | Refused `pseudo-decor-size-varies` | Promote: `tokensByProp` size |
| FC-PSEUDO-STROKE-GLYPH | CSS border-L check as thin Figma V | ✓ looks wrong / too thin | Emit: L→ROUND polyline SVG |
| FC-MISSING-AXIS | Controlled state not an axis | Switch Off-only | Contract API + anatomy |
| FC-WIDTH-TOKEN | Showcase width wrong token | Mid-word wrap | Contract literals / tokens |
| FC-METER | Progress fill not meter | Full bar / empty fill | Contract `meter` |
| FC-CSS-ONLY-HIDE | `text-indent` / clip hide | Dot badge text overflow | `visibleWhen` / omit content |
| FC-THEME-ISO | Wrong theme collection | Blue accent vs charcoal docs | Token bundle isolation |
| FC-ENUM-HOLE | Contract enum ⊂ real API | No default Polaris Tone | Contract / COMPILE honesty |
| FC-REVIEW-SURFACE | Translucent on black | False aesthetic FAIL | Review surface (cream) — **not** a pass by itself |
| FC-FIGMA-CLIP-DEFAULT | Frame clips HUG text | Trailing glyph cut (“Setting…”) | Emit: `clipsContent=false` unless opted in |
| FC-BASE-HIDDEN-RESTORE | `display:none` base never restored | Tooltip/None look identical | Contract `stylesWhen` display restore for showcase axis |
| FC-COND-ABS-TEXT | stylesWhen absolute ignored on text | Vertical value floats mid-rail | Emit: absolute when stylesWhen matches combo |
| FC-SVG-VIEWBOX | Arc radii inflate viewBox | Icon invisible at 20px | Extract: path extent ignores A rx/ry |
| FC-FLEX-BASIS | `%` flex-basis refused | Modal footer hugs, not 50/50 | Contract `layout.grow` (until % mint) |
| FC-SVG-ROTATION | Capture path orientation ≠ developed | Spinner gap at 12 o'clock vs 3 | Declared `rotate(Ndeg)` + emit `spec.rotation` (CSS CW → plugin CCW); expand `DECLARED_CHANNELS.transform` |
| FC-WIDTH-TOKEN | Root/connected hug content | Text field ~89px around “Example” | Bind showcase width token (`connected.width.off.off` ≈211) |
| FC-CONTRAST-ICON | Flat icon color ignores contrast | High-contrast close X invisible on dark | Mint `color.{contrast}` + template `{…color.{contrast}}` |
| FC-ENUM-HOLE (chip) | Type enum Squared-only | Canvas never draws developed pill | Add `default` (not capture `unset`) + keep squared override |
| FC-PSEUDO-OVERFLOW | Fixed-size `::before` wider than hugged root | Red spur lines on low-contrast notifications | Drop overflow decor; bind real box borders on root |
| FC-STATE-PREVIEW-NOISE | `figmaStatePreviews` doubles grid with focus rings | Chip showcase dominated by brand-blue outlines | `figmaStatePreviews: false` when Default showcase is the review target |
| FC-FONT-SUBSTRATE | Developed ref renders the wrong font substrate (no @font-face in the computed-extract harness — the ref gets whatever the fallback stack OR a stray locally-installed face resolves to) | Glyph-body diff 5–15% with exact colors/sizes (altitude badge/chip/link, tailwind toggle-switch); astryx button ref was literally Times; mui refs rendered the machine-local Roboto-THIN face | **HARNESS LANDED 2026-08-08**: per-library `cfg.fonts` @font-face (committed files, data: URIs, network-free) in capture/portal/gate renders. Altitude configured (IBM Plex Sans 400/600): chip 5.12→0.67 PASS, link 14.96→2.01 PASS. Badge 6.44→15.44 fail-closed (canvas is generation-time Inter). **MUI configured 2026-08-08 (font-substrate round)** — Roboto 400/500/700 from @fontsource/roboto@5.3.0, refs re-pinned via offline regate: chip 6.47→**1.18 PASS both instruments** (floor 4→5); avatar 12.14→5.71, input-adornment 24.22→20.83, autocomplete 8.48→8.14, select 11.24→11.05 improved-but-fail; text-field 6.33→7.29, tabs 10.19→11.74/9.99, table-pagination 17.68→17.83, breadcrumbs 20.49→22.17 — substrate no longer the named cause there; alert instrument pair 4.50/6.49→4.72/7.24 (disagreement NOT font-caused, stays fail-closed); tooltip re-pin REFUSED this round (regate emits drifted composition, cells 129→121, while core/emit-* is mid-flight — ref keeps its committed pin). **Astryx configured 2026-08-08** — the Times defect was a CAPTURE-CONTEXT token that never resolved (theme-neutral @scope'd tokens with no data-astryx-theme element; fix = mount the documented <Theme theme={neutralTheme}> provider) + Figtree 400/500/600/700 from @fontsource/figtree@5.3.0; button/switch recaptured (0 Times nodes), refs re-pinned: button 7.94→89.31, switch 8.78→14.21, BOTH instruments agreeing — the canvas (generated from the pre-theme contract) is now the stale side; FC-THEME-ISO (stale-contract canvas) is the residual, canvas re-sync required. Tailwind stays unconfigured by name (its stack IS the system stack; no library-true face exists) |

| FC-SCOPED-VAR-OVERRIDE | A descendant binds the custom property the BASE rule spells, while a scoped rule on an ancestor redeclares that same property per variant — so the contract carries one flat token where the library paints N | astryx Banner: all four statuses paint IDENTICAL title/description ink, and the `info` background is grey `#f1f1f1` where the library paints pale blue `#c4ddfb` | **SPLITS ON WHAT THE SCOPED RULE SAYS.** (a) It NAMES A TOKEN (`.astryx-banner.info { --color-text-primary: var(--color-text-blue) }`, theme.css:428) → bind THAT token via `tokensByProp` on the status axis. Theme-portable, no schema change, no mint. **CLOSED AT THE CONTRACT+EMIT LAYER for banner** (7 bindings; `figma:fresh` 8/8, only `banner.figma.js` moved). **NOT yet closed on the SCORE**: the committed scorecard (`visual-truth/astryx/banner.json`, 61.91% AA, `compositionOk:false`) was measured against `shots/banner.png` — a canvas built from the OLD contract — so rescoring with the stale shot would report a number that is not about this fix. The canvas must be re-run from the new script first. Same shape as the FC-THEME-ISO residual on astryx button: the canvas is now the stale side. (b) It hardcodes a RAW LITERAL (`.astryx-progressbar.accent { --color-accent: #0074e2 }`, theme.css:462) → **REFUSED BY NAME**: no token carries that value, and baking the hex would freeze a *theme-neutral-specific* value into a contract that must resolve per theme. **OPEN for progress-bar** — needs a theme-axis representation, not a literal |

| FC-SLOT-PLACEHOLDER | A required slot with no `defaultContent` has content on NEITHER side — and the canvas number that named it was measured against a RETIRED emitter | first-party `ds.card`: ink is clean (1.598% AA, well inside the 5% bar) but `compositionOk:false` on canvas 320×158 vs code 320×58 — the +100px is the dashed "Slot" utility's chrome | **OPEN, and half of it is an instrument residual.** The dashed placeholder was retired by `ce43ab0e` ("THE SLOT BECOMES A SLOT"): `core/emit-figma-script.ts:4862` states the utility "is never minted again", and `:6138` builds a native `createSlot()` whose empty state draws no chrome. The card's scored canvas predates that commit by under four hours, so the measured 158px is a picture the emitter can no longer produce — the canvas is the stale side, as with FC-THEME-ISO on astryx button. CLOSE BY: re-run the canvas, THEN decide the real question — `body` is a `required` slot with no `defaultContent`, so an honest pass needs content on BOTH sides (the `contracts/list.contract.json` `slot.defaultContent` recipe, plus a code-side ref that renders it; `console-loop-render-ref.mts:44-50` has zero `defaultContent` awareness today). NO TRAP STEM YET — the class is registered OPEN, not closed |

Every new bug must map to an **FC-*** (or add one). Receipts cite the ID. Evals pin the class.

### 3.2 Trap loop (mandatory per class)

```
observe developed fail
  → classify FC-*
  → minimal engine/contract/promote fix
  → unit/eval pin for that class
  → re-emit affected *.figma.js
  → re-sync Figma (no hand patch as evidence)
  → automated score vs developed pair
  → flip matchDeveloped when scorecard.recommendMatchDeveloped (agent-owned)
  → add regression case to "trap corpus"
```

Hand patches are allowed for **exploration**, never for `matchDeveloped: true`.

### 3.3 Agent visual loop (replaces human “looks fine”)

Humans should not be the pixel oracle. After each contract/emit fix:

1. **Serve scripts** — `npm run console-loop:stem-serve` (dual-stack `:9223`; plugin `fetch('http://localhost:9223/…')`). Register `00-tokens.figma.js` + component script when minted vars changed.
2. **Sync** — `figma_execute`: fetch → `ds_loop_script` → `eval`. No competing MCP on the bridge port; no `127.0.0.1` (plugin resolves `localhost` → IPv6).
3. **Cell capture** — export a **representative VARIANT at scale 1** to `parity/receipts/console-loop/<lib>/shots/<stem>-cell.png` (COMPONENT_SET shots fail composition).
4. **Score** — `npm run console-loop:developed-score -- --lib <lib> --stem <stem>` against a **gate-shot** (not `pair--*` side-by-side receipts).
5. **Decide** — `recommendMatchDeveloped: true` → flip receipt; `near-pass` / fail → classify FC-* and continue. Agent may read the diff PNG + developed ref for judgment when AA is in the font-noise band (~5–6.5%).

Finish line stays automated: corpus green means scorecards green, not a screenshot thread.

---

## 4. Measurement stack (make “looks wrong” machine-checkable)

### Phase M0 — Unify the bar (this week)

1. **One acceptance definition** for developed match, reused everywhere:
   - masked mean AA ≤ 5% vs developed representative PNG  
   - no blank/degenerate cells  
   - every cell >10% named with FC-* or LEDGER refusal  
   - Figma-capable props present (axes that exist in developed API and are in-contract)
2. Wire **foreign console-loop** to that score (stop human-only `matchDeveloped`).
3. Align first-party + MUI gates to the same `matchDeveloped` requirement (or explicitly carve “structure-only” with a different kind — no mixed meaning of `visual.ok`).

### Phase M1 — Generalize canvas-gate beyond Polaris (next)

| Lib | Developed truth source | Gate |
|---|---|---|
| Polaris | already `canvas-gate` + receipts | keep as reference implementation |
| Carbon / Tailwind / Altitude | `extract/computed/out/<lib>/**/pair--*.png` | `canvas-gate` runner parameterized by lib |
| Astryx | `examples/astryx/receipts/site/*.png` + computed pairs | same |
| MUI | MUI Test 1 + computed | same |
| First-party | `figma-sync` + site/story renders where they exist | same |

Command shape (target):

```bash
npm run canvas-gate -- --lib astryx --stem slider
npm run canvas-gate:corpus -- --libs astryx,carbon,polaris,tailwind,altitude
```

### Phase M2 — Trap corpus (continuous)

A small, frozen set of **adversarial stems** that encode each FC-*:

| Stem | Library | Traps |
|---|---|---|
| slider | astryx | FC-ABS-SIZE |
| toast | astryx | FC-LH-RATIO, FC-SLOT-DEFAULT |
| progress-bar | astryx | FC-WIDTH-TOKEN, FC-METER |
| text-field | polaris | FC-PLACEHOLDER, FC-BLOCK-ROW |
| badge | altitude | FC-CSS-ONLY-HIDE |
| toggle-switch | tailwind | FC-PSEUDO-THUMB, FC-PSEUDO-SIZE |
| switch | astryx | FC-MISSING-AXIS |
| checkbox | carbon | FC-PSEUDO-THUMB |
| button | polaris | FC-ENUM-HOLE (tone) |
| button | astryx | FC-THEME-ISO |
| banner | astryx | FC-SCOPED-VAR-OVERRIDE |

CI: trap corpus must stay green. New FC-* requires a new trap stem before the class is “closed.”

---

## 5. Execution waves (ordered)

### Wave A — Stabilize the engine (in progress / continue)

**Goal:** every FC that is purely emit-time is pinned and green.

- Land + eval-pin: inset fixed size, line-height PERCENT, placeholder, block-row, optional slot default  
- Re-emit **all** foreign `examples/*/figma/*.figma.js` from workspace core (not stale CLI package)  
- Freshness gate: `figma:fresh` / lib freshness must fail if committed scripts ≠ engine  
- Re-sync Testing + MUI files via Console MCP **from scripts only**  
- Score trap stems; flip `matchDeveloped` only on score pass

**Exit:** trap stems for emit-only FCs are green under automated gate.

### Wave B — Anatomy / promote grammar (highest leverage remaining)

**Goal:** stop missing thumbs, checks, and state axes.

Priority lifts (from LEDGERs + live fails):

1. `pseudo-decor-size-varies` → allow size `tokensByProp` / per-axis shape  
2. Hidden-scale / `pseudo-decor-outside-grammar` for check glyphs (`::after` ✓)  
3. Controlled value axes dropped in Phase-A (Switch On/Off, Checkbox checked) — contract repair cookbook  
4. `display:contents` / hug-zero parents — hoist absolute children to sized containing block at compile time  
5. Slot `defaultContent` for composition showcase (Toast end, ChatMessage)

**Exit:** Tailwind toggle, Carbon checkbox, Astryx switch have thumbs/glyphs/axes from regenerate, not paint.

### Wave C — Corpus green (foreign → first-party)

Order (hardest fidelity classes first, so learning compounds):

1. **Astryx trap set** (slider, toast, progress-bar, switch, text-input)  
2. **Carbon** (checkbox, tabs, text-input, tag)  
3. **Polaris** (button tone honesty, text-field, checkbox/radio geometry)  
4. **Tailwind / Altitude** remaining stems  
5. **MUI + first-party** under the same developed bar  

Do **not** add new libraries to “complete” until Wave C exit on the frozen set.

**Exit:** `CORPORA.md` foreign visual column = N/N; `console-loop:all:evidence:check` green for real reasons.

### Wave D — New design systems as generalization proof

Only after Wave C:

1. Pick **one** new lib outside the current six (or deepen untitled-ui / eventz-vars if emit-ready)  
2. Onboard via `docs/21-bring-your-own-design-system.md`  
3. Require trap corpus + canvas-gate on day one  
4. Any novel FC-* extends the taxonomy before the lib can be marked complete  

This is how we prove the system generalizes — not by collecting more half-green corpora.

### Wave E — Canvas → code (deferred)

Precondition: Wave C green on frozen corpus + Wave A/B traps CI-green for 2 consecutive full eval runs.

Then:

1. Treat green Figma COMPONENT_SETs as the **source of proposed diffs**  
2. Invert only channels that canvas-gate already proved  
3. Refuse proposals that would break code→canvas traps (round-trip must keep FC corpus green)

---

## 6. Continuous improvement rituals

### Daily / per PR

- Any emit change → trap corpus canvas-gate  
- Any promote/anatomy change → affected lib computed pairs + trap stems  
- No `matchDeveloped: true` without automated score artifact path in the receipt  

### Weekly

- Triage open FC-* by frequency across libs  
- Close one grammar lift or explicitly won’t-fix with limitation doc update (`docs/23-known-limitations.md`)  
- Refresh `VISUAL-AUDIT.md` from machine scores (human review only for >10% named cells)

### Definition of “done” for a stem

```
[ ] Computed pair exists (or site receipt) as developed truth
[ ] Contract + tokens regenerate *.figma.js (freshness green)
[ ] Live sync from that script (node id recorded)
[ ] canvas-gate / pixel score ≤ bar
[ ] FC-* defects empty (or named out-of-scope with ticket)
[ ] receipt.visual.matchDeveloped === true
[ ] eval pin if the stem is in the trap corpus
```

---

## 7. What not to do

- Do not mark corpora complete on structural console-loop alone  
- Do not expand to more libraries to “show progress” while foreign visual is 3/48  
- Do not use cream backgrounds or token hand-edits as pass evidence  
- Do not start canvas→code productization while code→canvas regenerates wrong  
- Do not fix one screenshot without an FC-* and an eval pin  

---

## 8. Immediate next actions (recommended order)

**Done (2026-08-06 drive):**
1. ~~Pin Wave A evals~~ — `code-to-canvas-wave-a-emit-pins` (+ contents hoist, ellipse stroke, parent unclip)  
2. ~~Trap corpus CI~~ — `trap-corpus:check` / eval `trap-corpus-check` (structural; 10/10)  
3. ~~Developed-score hook~~ — stub scores under `*/scores/` (pixelmatch still TODO)  
4. ~~Wave B.1~~ — `pseudo-decor-size-varies` lift; Tailwind ToggleSwitch thumbs 16/20/24 on canvas  
5. ~~Trap re-sync~~ — progress-bar (240+meter), toast, slider (contents hoist), altitude badge, toggle-switch, polaris text-field (surgical; full cartesian emit blocked)  
6. ~~FC-ABS-SIZE residual~~ — `display:contents` hoist + `parent.clipsContent=false` for absolute/inset hosts  

**Done (continued 2026-08-06):**
7. ~~Wave B.2~~ — `scale(0)` = hidden; orthonormal rotate carried; Carbon `checkbox-label-after` ✓/minus on canvas (`extract:computed:pseudo-decor-rotate:check`)  
8. ~~Wave B.3 (partial)~~ — Astryx Switch `value` VARIANT axis restored + thumb from enriched anatomy; **On thumb offset awaits harness re-capture**  
9. ~~Wave B.4~~ — Polaris Button `tone` enum gains `default` → Figma `Tone=Default` (340 variants; `…/{variant}.none` paint paths)  
10. ~~Indeterminate bar~~ — single-side stroke→filled-bar collapse in emit (`collapseSingleSideStrokeBar`); Carbon indeterminate is a white dash, not an L-nub  
11. ~~Developed-score v2~~ — canvas-gate `alignPair`/`scoreCell` + composition guard (rejects set-vs-cell / inkΔ); trap refs use `gate-shots` not pair PNGs; stem server `scripts/console-loop-stem-server.mjs` (`localhost:9230`)  
12. ~~Trap cell shots~~ — all 8 scoreable trap stems have `*/shots/<stem>.png` via plugin `exportAsync` → `/shot/:lib/:stem`  

**Done (human-review feedback 2026-08-06):**
13. ~~Carbon Checkbox wrap~~ — dropped content-measured `checkbox-label`/`root` width tokens (FC-WIDTH-TOKEN; Inter vs capture font)  
14. ~~Indeterminate center~~ — filled 8×2 bar at left:4 top:9 (centered in 16×16 host)  
15. ~~Polaris Button left gap~~ — `applyMarginBox` retargets Show bindings onto the margin-box wrapper (`amend-margin-box` eval)  
16. ~~FC-PSEUDO-STROKE-GLYPH~~ — adjacent two-side border L → ROUND polyline SVG + host-center for ±45° glyphs (`collapseTwoSideStrokeGlyph` / `centerStrokeGlyphsInHosts`; wave-a eval pin)

**Human review gate (do not auto-flip `matchDeveloped`):**
- Re-spot-check Carbon Checkbox (single-line label, centered indeterminate dash) + Polaris Button (no blank icon slot when Show WithIcon=false)
- Scorecards under `parity/receipts/console-loop/*/scores/` — flip only after like-for-like AA ≤5% **and** your spot-check

**Next (agent, after human spot-check):**
1. Harness re-capture Astryx Switch with `value` in axes (On thumb translate)  
2. Tighten trap refs to matching gate-shot cells (several stems fail composition guard despite low AA)  
3. Flip `matchDeveloped` only on automated score + spot-check  
4. Freeze corpus; refuse new “complete” libs until Wave C exit  

---

## 9. Success metrics

| Metric | Now (approx) | Wave A exit | Wave C exit |
|---|---|---|---|
| Foreign `matchDeveloped` | 3/48 | ≥ trap set green | 48/48 |
| Emit FC classes pinned in eval | partial | 5/5 emit FCs | all closed FCs |
| Canvas-gate libs | Polaris-centric | Polaris + Astryx traps | all looped libs |
| Hand-patch passes | too many | zero | zero |
| New lib onboarded under bar | n/a | n/a | ≥1 proof lib |

---

## 10. Relationship to v1 / human gates

This plan does **not** claim v1 shipped or Phase 3 Candidate.  
Human-only rows (pilot, security, RC, W11-C, publish) stay in `HUMAN-HANDOFF.md`.  
This plan is the **agent-doable fidelity spine** that makes those later gates meaningful.


## Session board (auto)

Updated **2026-08-08 (REFERENCE-TRUTH round)**: **15/77** foreign GENUINE scorecard
passes, and for the first time every one of them is scored against the **real npm
package** — `extract/computed/out/<lib>/<comp>/orig-shots/<key>.png`, committed by
`extract/computed/run.ts --keep-originals`.

Every number on this board before today was measured against `gate-shots/`, which is
the **CONTRACT RENDER** (enriched contract → emit-html), so it measured whether two
emitters agree and could not fall when the contract was wrong the same way on both
sides. The re-measure moved 8 passes off the board and put 3 new ones on.

| Lib | Before (contract render) | After (library render) |
|---|---|---|
| MUI | 6/31 (alert, checkbox, chip, divider, snackbar, table) | **2/31** (divider, table) |
| Altitude | 6/8 (button, chip, divider, heading, icon-close, link) | **3/8** (button, chip, divider) |
| Carbon | 2/10 (icon-button, text-input) | **3/10** (icon-button, tag, text-input) |
| Polaris | 4/12 (progress-bar, spinner, tag, text-field) | **4/12** (banner, tag¹, text-field, thumbnail) |
| Tailwind | 3/5 (alert, badge, button) | **3/5** (alert, badge, button) |
| Astryx | 0/10 | **0/11** (toast gained a scorecard; see its LEDGER) |
| **Total** | **21/76** | **15/77** |

¹ `polaris/tag` is the one pass on this board that could **not** be verified against a
library render: `run.ts` quarantines polaris `Tag` (`part "link" carries channel
"width" as BOTH a token binding and a literal`), so no package screenshot exists. It
keeps a contract-render basis, named on the receipt. Excluded from the floor
recommendation. `mui/tooltip` is the other unobtainable stem (double-run determinism
refusal, MuiPopper transform unstable) — it is fail-closed either way.

`RATCHET.json` floors were all seeded against contract-render references and are now
unsound: altitude 6 (actual 3) and mui 5 (actual 2) FAIL their lanes and
`visual-truth:check` on both instruments. The floors were deliberately NOT edited by
this round. Recommended re-derivation: altitude 6→3, mui 5→2, carbon 2→3 (or hold at
2 — the instruments disagree on text-input), polaris 0→3, tailwind 3 hold, astryx 0
hold, first-party 5 hold.

This session: altitude reconverged to its RATCHET floor 4 headlessly and
`visual-truth:check` joined the fast lane; tailwind alert converted
(FC-SLOT-DEFAULT: icon/dismissable booleans default-hidden, 5.74→3.83);
FC-THEME-ISO closed in the emit runtime (collection-preference varByName —
multi-library files no longer rebind fills across collections);
headless REST fetch moved to scale=1 (like-for-like with bridge exports;
scale-2 + downscale was instrument noise); FC-FONT-SUBSTRATE named — no
harness loads webfonts, so refs render fallback glyphs and font-dominated
near-misses (altitude badge/chip/link, tailwind card/toggle-switch, astryx
button/switch) are honestly fail-closed pending a font-loading harness +
reference re-pin. Carbon inline-notification's old 6.67 near-miss was a STALE
canvas with a pre-wave baked width; honest regeneration hugs under the
hug-ceiling doctrine and fails the 428px harness framing (25.31, fail-closed).
