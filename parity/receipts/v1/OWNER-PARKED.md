# Parked — things that need the owner, recorded so the queue keeps moving

Each entry is measured, not guessed. Work continued past every one of these
rather than stopping on it.

---

## P1 · A canvas→code exam on artwork nobody here drew

**Parked 2026-09-05, during queue item 1.**

The canvas→code held-out exam is green
(`npm run recipe:canvas-to-code:held-out:check`, 6/6). Its own evidence says
what it is, and the repo wrote this against itself before I got here —
`recipe/evidence/canvas-to-code-held-out-v1/named-blockers.json`, severity
`product-incomplete`:

> "The exam substrate (page 33:2, Card 33:5093) was minted by THIS
> repository's code→canvas engine on 2026-08-23 … So this is a round trip on
> our own output: held out from the RECIPE path, not from the project. **A
> canvas→code exam on a file drawn by a designer who never used this tool is
> still owed**, and nothing here should be read as having passed one."

That is still true today and I cannot close it myself. Every page in the only
Figma file I may write — Scratch `byMp6lt0Ij9b2QbkDGFwBh` — was minted by this
repository. A genuine canvas→code measurement needs **a component set drawn by
a person who never used this tool**, in a file I can read.

**What unblocks it:** point me at such a file (read access is enough — the
canvas→code direction only reads), or draw one set by hand on Scratch and say
so. Either turns this from an untested claim into a measured one.

**Why it matters for handing this to colleagues:** the direction they are most
likely to try first — "I have a Figma library, give me code" — has never been
measured on artwork this project did not itself draw.

---

## P2 — the Scratch file is not open in Figma Desktop, so F1 cannot be minted live

**Parked 2026-09-05. Blocks: the live half of the F1 code→canvas exam.**

F1 now **compiles**. `recipe/fixture-reader/propose-calendar-instance.ts`
assembles a real `calendar@1` instance out of the react-day-picker ledger and
`compileCalendarRecipe` accepts it — no hand-authored fixture, no Astryx
content, every token unbound because the subject has no verified DTCG
bindings. The compile → collapse → compile fixed point closes with a
byte-identical IR.

What is still owed is the **live mint and the scored render**: minting the
compiled envelope onto Scratch and comparing that canvas against
react-day-picker's own Chromium render.

**Why I stopped.** The Desktop Bridge is connected, but only to two files:

| file | key | may I write it? |
| --- | --- | --- |
| CBDS UI Kit Demo | `WofZT8xaxXuc2Q6Je9S4XE` | **no** — not Scratch |
| Altitude Design System | `y83n4o9LOGs74oAoguFcGS` | **no** — a source library |

The only file I am permitted to write is Scratch `byMp6lt0Ij9b2QbkDGFwBh`, and
it is not among them. Minting into either connected file would write a
component set into artwork that is not mine to modify, so I did not.

**Correction (2026-09-05, later the same day).** An earlier version of this
entry said opening Scratch was "the only thing still needed from you." **That
was wrong**, and I am recording it rather than quietly editing it away. Opening
Scratch is necessary but nowhere near sufficient. Three further things stand in
the way, and two of them are the project's own design working as intended:

1. **The bridge cannot be pointed at Scratch from here.** `figma_navigate`
   switches among files that ALREADY have the plugin open and, in its own
   words, "does NOT launch a browser or open files". Verified by calling it.

2. **A live calendar mint is external-operator-only, by design.**
   `recipe/evidence/calendar-live-pivot-v50/authorization-template.json` sets

       operatorBoundary.externalOperatorOnly        true
       humanSignoff.mandatory                       true
       securityPrerequisite.figmaPatRevokedOrReplacedRequired   true
       securityPrerequisite.mcpRestartAfterRotationRequired     true
       securityPrerequisite.ownerOnlyEnvironmentFileMode0600Required  true
       securityPrerequisite.repositorySecretScanZeroRequired    true
       securityPrerequisite.exactScratchReadOnlyProbeRequired   true

   `externalOperatorOnly: true` means the agent is structurally not the party
   permitted to run it. This is not an obstacle to route around; it is the
   boundary that keeps an agent from minting into a real file on its own say-so.

3. **The shipped paste-a-script surface has no calendar at all.** The
   plugin-target toolkit registry holds thirteen archetypes — checkbox, switch,
   avatar, tooltip, chip, link, tabs, radio, textarea, alert, badge, menu,
   dialog — and calendar is not among them. `npm run recipe:point -- --archetype
   calendar` says so in its own words: *"a card, an accordion, a data table, a
   date picker — has no recipe, so there is nothing to compile or paste."*
   `calendar@1` is an INTERNAL recipe driven by the bespoke versioned
   live-proof lineage (`build-calendar-live-proof-vN.ts`), not by the product
   verb a stranger uses. So F1 exercises an archetype deliberately outside the
   shipped surface, and minting it needs a new lineage version built and
   owner-authorized — not a paste.

**The writer now refuses this by name instead of crashing (2026-09-05).**
`recipe/calendar-figma-writer.ts` used to read `found[0].kind` and emit a bare
`required calendar/set set`, which told a reader nothing about why a perfectly
valid compiled envelope was rejected. It now names the cause and the close:

> `calendar/set is a lone component, not a set — this calendar does not vary on
> its axis, which compiles (figma-ir.ts refuses a one-valued axis) but this
> writer cannot yet mint: the emitted program combines variants and has no
> single-component path. Close: add that path and exercise it on a live Scratch
> run.`

**Why the path was not simply written.** The emitted program's `mintSet` builds
variant children and calls `figma.combineAsVariants`; a lone-component path is a
change to the program that MINTS INTO A REAL FILE, and this repo has no Figma
emulator to exercise it — only `compileExpectedScenePlan`, an offline model.
Writing it now would ship a mint path that has never run and cannot run until
Scratch is open. That is the "revert over ship-unexercised" rule, and a named
red is carried where an unnamed one is a silent failure. A test pins the
refusal so it cannot regress back into a crash.

**One concrete finding, so the decision is cheaper to make.** If you do want F1
minted through a new lineage, the v50 machinery is built around component
SETS — `build-calendar-live-proof-v50.ts` calls
`requireSet(envelope.ir, "calendar/set")` and the same for `calendar/week-set`.
A day-picker calendar declares one WeekNumbers value, so those two emit as lone
COMPONENTS (a set needs an axis of at least two values; `figma-ir.ts` refuses a
one-valued axis). `requireSet` would refuse it. Astryx varies on WeekNumbers,
so v50 itself is unaffected and its `generated:check` still exits 0 — this is a
note about the NEW lineage, not a break in the old one. The `groupByRole` /
`variantFor` pair already added to `recipe/recipes/calendar.ts` is the shape
that handles both.

**The alternative, costed — and it is much cheaper than a v51 lineage.**
`radix-themes` and `bootstrap5` are already captured AND are genuinely held out
from the recipe path: neither appears in `recipe/fidelity-manifest.json` (which
carries altitude, antd, astryx, carbon, chakra, fluent, mui, shadcn) and neither
has a single generated fixture. Their scorecards already measure shipped
archetypes:

| held-out library | rows | rows that are SHIPPED archetypes |
| --- | --- | --- |
| radix-themes | 10 | **5** — avatar, badge, checkbox, switch, tabs |
| bootstrap5 | 7 | 2 — alert, badge |

Re-pointing F1 at `radix-themes` would be a true held-out code→canvas exam on
five archetypes the product actually ships, and it needs **no new lineage and
no owner-signed protocol at all**. `scripts/run-figma-writer.mjs` says so in its
own header: *"The signed archetypes (input-field, combobox, table, calendar)
each carry a per-version signed operator… The boilerplate archetypes have no
signed protocol — their `build-*-live-proof-vN.ts` just emits `writer.js`."*
The thirteen mint through the generic plugin-target path the fast lane already
proves offline at 40 rows.

So the two options are not comparable in cost:

- **v51 calendar lineage** — ~2,400 lines of new bespoke machinery, an
  unexercised lone-component mint path, AND an external-operator signed
  authorization round. Measures an archetype `recipe:point` refuses to model.
- **F1 on radix-themes** — no new lineage, no signed protocol, five shipped
  archetypes, the same verb a stranger uses. Needs only Scratch open.

I have not started either: which exam F1 should be is a scope decision, and the
second one changes what docs/26 F1 means.

**What this means for F1.** The offline half is complete and measured. The live
half is owner-operated by design and cannot be delivered by me at any level of
effort. Deciding whether F1 should be scored through a new
`build-calendar-live-proof-v51` lineage — or whether a held-out exam on an
archetype outside the shipped thirteen is the right exam at all — is a call for
you, not a task I should start unasked.

**Second blocker, now removed (2026-09-05).** F1 also had no reference to score
against: the manifest's `_referenceRule` demands an `orig-shots/` render of the
real package and refuses a gate-shot outright, and day-picker had no
`orig-shots/` at all — so scoring would have failed even with Scratch open. A
fresh capture in a sandbox outside the repo produced it, and
`extract/computed/out/day-picker/calendar/orig-shots/label.1__default.png` is
now committed. The same run reproduced the committed ledger byte-for-byte,
which also turns the capture's determinism claim from transcribed into
measured.

**What this does NOT block:** everything measurable offline is done and
recorded — the schema closures, the compile, the fixed point, and the gates.
The exam is not passed, and `overallSuccess` stays `false` until the live half
lands.
