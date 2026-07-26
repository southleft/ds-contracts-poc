# 19 — Plugin Information Architecture (SHIPPED)

*Status: **built**, 2026-07-26. This document is the record, not a proposal.
It carries the finding that started it, the owner's delegation, the panel's
decisions, what was killed and why, and what actually shipped.*

## Where this came from

The live finding (owner, 2026-07-26): *"quite complex and very confusing… a
lot of superfluous utility in there that I'm not sure why it's there or what
it does"* — and, sharper: *"I thought we were entering contracts as JSON but
you keep giving me JavaScript."* Both were right. Seven tabs mirrored how the
tool was BUILT, not how it is USED, and two of them existed only because of a
gap that has since closed (foreign-token-aware bundles made compiled-script
pasting unnecessary for users).

The first version of this document was an IA proposal held for owner markup.
**The owner delegated the decision** to a UX/UI specialist panel — a research
pass (structure, flows, copy) and a design pass (chrome, type, colour) — with
implementation to follow both passes as written. Naming and visual direction,
previously reserved, came back inside that delegation. What follows is what
the panel decided and what was built from it.

## The audit that survived into the build

| tab before | who needed it | fate |
|---|---|---|
| **Generate** | everyone | **KEPT** → the **Build** panel |
| **Update library** | everyone | **FOLDED into Build** — "update" is just generate-when-sets-exist; one surface, the report decides create vs amend |
| **Propose** | designers | **KEPT** → the **Send** panel (reached mainly FROM Changes) |
| **Drift** | everyone | **KEPT** → the "On this canvas" half of **Changes** |
| **Paste a script** | developers of this tool | **DEMOTED** into the Advanced drawer |
| **Local runner** | developers of this tool | **DEMOTED** into the Advanced drawer |
| **Send to Playground** | tool developers / support | **KILLED** — see below |

## What shipped

```
┌──────────────────────────────────────────────┐
│  Build    Changes ▪    Send        ⚙ Advanced│  ▪ = an update is waiting
├──────────────────────────────────────────────┤    ⚙ = a plain stacked list:
│                                              │      Paste a script,
│  (intent-specific surface)                   │      Local runner,
│                                              │      engine stamp + diagnostics
└──────────────────────────────────────────────┘
```

**Build** — "I have contracts (or want the sample); put them on this canvas."

- The paste box is the surface, with a one-sentence placeholder. No `//`
  comment cosplay: what you paste is JSON, and the box says so in words.
- **Empty state** (no contract-backed sets AND an empty box): a sample-library
  card leads — "Nothing here is contract-backed yet." → **Build the sample
  library** → "Card, Badge, Avatar, Button — token-bound, built in this file
  in ~30 seconds. Safe to re-run." → "Or paste your contracts file below."
  The sample button exists NOWHERE else in the plugin, and it is the panel's
  only filled button while the card is up (Generate steps back to secondary).
- **Receive by code** (the ad-hoc pairing route) lives here and ONLY here,
  collapsed inside *Other ways to receive*.
- **One button.** With contract-backed sets in the file it reads *Check
  against this file* and renders the shared check report; on a fresh file it
  reads *Generate in this file* and builds. Create and amend are rows in one
  report, not two tabs.
- The **tokens-first checkbox is gone**. The behaviour is unconditional — a
  fresh file needs it and a re-run upserts, so the control was only ever a way
  to break your own build.

**Changes** — "what moved?" Two sources, two labelled sections.

- **From your team** (the standing CI channel). Two states, and an empty key
  is SETUP, never an error. State 1 explains the one-time
  `ds-contracts figma claim-channel` handshake, takes the read key, and says
  plainly that the key can only read. State 2 is "From your team —
  Connected · Change key", the status lines, and **Check for updates**.
- A channel delivery renders the **shared check report inline here**, bound to
  its own target box — the delivery-seq binding from the G1 round survives, so
  a pull into Changes can never lend its delivery number to bytes sitting in
  Build (and the smoke gate pins exactly that).
- **On this canvas** (drift). The Check drift button, a remembered *Drift last
  checked: <relative>* line, and the drift rows with their deep-link into
  Send. **Drift never auto-runs** — it reads every marked set in the file.
- With no contract-backed sets the drift button is hidden and the section says
  "No contract-backed components in this file yet." with Build as a link.

**Send** — "get my canvas change to the code side." Today's Propose, verbatim:
read the set, diff it, then the GitHub PR door and the send-to-repo pairing
door. A cold-open hint says where people usually arrive from.

**Advanced** — the drawer, right-aligned in the tab bar with a gear AND the
word. A plain stacked list: *Paste a script* ("Debug surface — runs raw
generated scripts with full plugin permissions. For developers of this tool."),
*Local runner*, and Diagnostics (the engine stamp, the file key, the
contract-backed set count).

**Default tab**: contract-backed sets in the file → **Changes** (the common
return visit is a check, not a build); otherwise **Build**.

**Check-on-open** stays exactly as the G1 round built it: one head-only
request, no bundle bytes, nothing staged in a box. Its only marks are a 6px
square dot after the *Changes* tab label (presence only, never a count) and
one sentence in the panel — "Update waiting — delivery #N, published <when>.
Check for updates to review."

## What was killed, and why

- **Send to Playground** — the tab and its UI are gone. It POSTed a canvas
  dump to the playground under a pairing code: a tool-developer and support
  path, never a user one, and the Propose flow already carries the only dump a
  designer needs. The `#dump-source` block STAYS in `ui.html`: the Send panel
  runs it to read a set back, and `plugin-engine-check` executes those exact
  bytes. Only the UI died.
  - *Named consequence, not a silent one:* `code.js` still carries the
    `run-send` handler and its `send-status` / `send-result` replies. Nothing
    in the UI posts `run-send` any more, so those three are unreachable. They
    were left in place deliberately — this pass was a re-housing, and removing
    live network code is a separate, reviewable decision. The message-pair
    audit lists them as the only asymmetry.
- **The tokens-first checkbox** — a footgun dressed as a choice (above).
- **The duplicated channel row** — the standing channel had a key field and a
  Check button in BOTH Generate and Update library, deliberately duplicated
  while the IA was undecided. It is now one row, in Changes.

## Chrome (the design pass, as built)

- **Type**: 11px/16 body in 400/600 only; 10px meta in
  `--figma-color-text-secondary`; mono 10 for values, keys and hex. No
  uppercase anywhere except literal pairing codes; nothing larger than 11px;
  sentence case throughout.
- **Grid**: 4px. 12px panel gutter, everything left-aligned to it; 16px
  section gaps carrying EITHER a label or a 1px rule, never both; one indent
  step = 16px.
- **Theme vars only — and this was a BUG FIX.** Every literal hex in the
  JS-generated report markup (`#888`/`#666`/`#eee`/`#c60`/`#09f` in the drift
  and update renderers, `#999` swatch borders) was invisible or wrong in dark
  mode. The JS now emits CLASSES — `.report-row`, `.report-meta`,
  `.diff-line`, `.swatch`, `.variant-link`, `.row-action` — and the stylesheet
  owns the palette. The single remaining inline value is a swatch's own fill,
  which IS the datum being reported.
- **Status words, not emoji**: "✅ in sync" → **In sync** in `.text-success`;
  "⚠️ canvas edited" → **Canvas edited** in `.text-warning`; every "⚠ " prefix
  → the coloured word **Warning:**.
- **Diffs**: no strikethrough. Old value in the secondary colour, an arrow,
  new value at weight 600, with 8px square swatches whose border is a theme
  var.
- **Report rows**: name at 600 with a right-aligned coloured status word; a
  meta line (page · contract id, or the engine's own plain-words line); mono
  diff lines at one indent step; "Propose this change" as a LINK. An in-sync
  row is two lines and stops. The bold counts blob became a summary meta line
  — "2 sets · 1 in sync · 1 canvas edited".
- **Freshness warning** uses the existing `.note` pattern (1px border, 3px
  `--figma-color-icon-warning` left rule) and reads "This delivery (#N) is
  older than what this file already applied (#M). All boxes start unchecked."
  No red anywhere. (The engine's own longer line is pinned by
  `plugin-engine-check` and still rides on each affected ROW; the UI drops
  only its duplicate banner copy.)
- **Buttons**: one filled primary per panel, radius 0; secondary = 1px border
  on transparent; busy = disabled + label swap, no spinners; in-report actions
  are links.
- **Collapsed help**: `<details class="help">` with a dotted-underline,
  sentence-case summary and no marker triangle. One always-visible sentence of
  guidance per panel, maximum.
- Non-goals held: no icon system beyond the gear glyph and the square dot, no
  custom form controls, no diff background fills, no animation, no custom dark
  palette — the Figma vars ARE the palette.

## Non-negotiables the re-housing kept

1. **JSON only, everywhere a user touches.** Compiled scripts are internal and
   now live behind the Advanced drawer, labelled as a debug surface.
2. Every existing behaviour keeps its receipt-gated semantics.
   `plugin-engine-check` is green, untouched; the engine bundle is
   byte-identical (the zip re-packaged without `--update-engine-receipt`,
   stamp `engine 0306efe36745 · 486094B`).
3. The **"What's protected" card**, the drift warnings and the apply-success
   narration survive verbatim. The card now sits inside the shared report, in
   a `<details>` whose summary states the promise, so a collapsed card still
   makes it: *"What's protected: an update never overwrites your canvas edits
   silently."*
4. The byte-identical re-run property is untouched — nothing in this pass
   reaches the emitters.

## Verification (no visual gate exists, so one was built)

`plugin-engine-check` green (all 17 flows), full eval suite green, `tsc`
clean, `node --check` clean on `code.js`. On top of that, the packaged
`plugin-dist/ui.html` was driven in a real browser against a `code.js`
simulator: 54 assertions covering tab routing, the empty states, the shared
report in both homes, the protected card, the stale-delivery guard, the
delivery-seq binding, and a static sweep proving **no literal hex and no
inline style survive in the generated report markup**. That pass caught a real
bug the eye would have missed in light mode: the `hidden` attribute was being
outranked by `.section { display: flex }`, so "hidden" sections rendered
anyway. Fixed with an explicit `[hidden] { display: none !important; }`.

## Still open (named, not hidden)

- The engine's own row warning still says "Review them in the **Drift tab**"
  — that string is engine-side and pinned; the tab is now called Changes. A
  one-word copy change belongs with the next engine-touching round.
- `scripts/build-plugin-zip.mjs` still calls `#dump-source` "the Send to
  Playground tab" in a refusal message. Cosmetic, outside this pass's file
  scope.
- The three orphaned `run-send` / `send-status` / `send-result` message types
  in `code.js` (above).
