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

**What unblocks it:** open Scratch `byMp6lt0Ij9b2QbkDGFwBh` in Figma Desktop
with the Desktop Bridge plugin running, and say so. That is the **only** thing
still needed from you. `figma_navigate` cannot do it from here — the bridge
switches among files that already have the plugin open and, in its own words,
"does NOT launch a browser or open files".

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
