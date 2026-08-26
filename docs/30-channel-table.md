# 30 — The Channel Table: the conversion, specified top-down

> **Where this sits.** [29 — How It Flows](29-how-it-flows.md) explains how a
> fact travels between the canvas and code. This page states, once and for
> the whole CSS surface, **which facts can travel at all** — and what happens,
> by name, to every one that cannot. The table itself lives at
> [spec/CHANNEL-TABLE.md](../spec/CHANNEL-TABLE.md) (human) and
> [spec/channel-table.json](../spec/channel-table.json) (machine), held by
> `npm run channel-table:check` in the fast lane.

## Why top-down

The channel vocabulary grew bottom-up, one library at a time: MUI added the
absolute-position doors, Tailwind added the pill-radius sentinel, shadcn added
the custom-property door, antd added the border-style-by-axis rule. That habit
has a built-in failure mode — **every new design system finds a CSS property
nobody classified**, and the engine's answer to it is whatever the generic
fallback happens to say. The debt was never visible because nobody had ever
written down the denominator.

The denominator is finite and mechanical: the full `getComputedStyle`
enumeration of the capture browser — 475 longhands in Chromium 151.0.7922.34,
byte-identical to the `_provenance.channels` list every committed capture
artifact records — plus the two synthetic channels the capture mints
(`translate-x`/`translate-y`) and the contract-channel shorthand spellings the
schema carries (background, border-color/-width/-radius/-style,
padding-inline/-block, gap, transition, white-space).
The table classifies all 487 properties, each into exactly one class:

| class | meaning | the row must name |
|---|---|---|
| **CARRIED** | drawn on the canvas | the Figma projection + the engine symbol (`file` · symbol, existence-checked) |
| **LEDGERED** | carried as data, not drawn | the receipt channel the value rides |
| **REFUSED** | a named wall | the code: a conformance case name, an FC-* code, or the code-only fallback receipt |
| **INERT** | provably no independent visual effect at computed level | the justification |

## The result

487 properties: **82 CARRIED**, **80 LEDGERED**, **271 REFUSED**, **54 INERT**.

**The bottom-up debt, measured:** 272 of the 487 had no prior classification
anywhere — no schema channel, no layout vocabulary, no conformance case, no
named exclusion. Each of them was decided fresh by this table. Until now they
fell to the generic per-channel refusal in `extract/computed/fuse.ts` at
runtime ("no schema channel today") — *named when styled, but never decided*.
That number is the measure of what bottom-up growth had left open, and it is
now zero going forward: a property absent from the table is a red gate, not a
surprise in a customer's library.

## What the classification is made of

- **The doors, read** — `packages/schema/src/contract-schema.ts`
  (TOKEN_CHANNELS / DECLARED_CHANNELS / LITERAL_CHANNELS),
  `extract/computed/fuse.ts` (styled-channel admission, the mint doors, the
  layout enrichment), `extract/computed/lib.ts` (isFusable,
  GEOMETRY_CHANNELS, LOGICAL_ALIASES, SYNTHETIC_CHANNELS, kindOf),
  `core/emit-figma-script.ts` (applyTokens / applyLiterals / applyDeclared /
  layoutSpec). Every CARRIED row cites the symbol that draws it, and the gate
  refuses if a refactor turns a citation into a ghost.
- **The empirical shadow** — the conformance kits pin behaviour per value
  shape: 115 css-dom cases (`conformance/MANIFEST.json`) and 157 canvas cases
  (`extract/figma/conformance/MANIFEST.json`); rows cite their case ids, and
  every conformance channel must have a row.
- **Evidence, per CARRIED row** — `CARRIED` used to mean two different
  things wearing one word: *there is a code path that carries this* (an
  `engine` citation) and *we measured that it carries* (a conformance case).
  Only 27 of the first 82 rows had the second. Every CARRIED row now declares
  an `evidence` state:

  | state | means |
  | --- | --- |
  | `measured` | a named case observes the property end to end (capture → contract). Break the property and something goes red. `conformance` names the case(s). |
  | `code-cited` | an engine citation and nothing more. The channel is reachable — a case *could* be written — but none has been. A declared gap. |
  | `unobservable` | the property is in none of the schema's channel sets and no structured mirror spells it, so no contract can hold it and **no conformance case could ever observe it**. The claim is unfalsifiable as things stand. |

  The state is **re-derived**, never trusted: `channel-table-check.ts`
  recomputes it from both conformance manifests plus the reachability of the
  channel, and refuses a row that disagrees — so a row can neither over-claim
  (`measured` with no case) nor under-claim (`code-cited` while a case that
  measures it already exists). Cites are checked in **both** directions; until
  2026-08-26 only manifest→table was verified, so the table could cite a case
  that had been deleted, renamed, or that measures a different channel.
  `npm run channel-table:rederive` rewrites the derived fields and leaves
  every hand-written one alone.

  A row whose property is folded at the read boundary — `-webkit-text-fill-color`
  into `color` — declares `observedAs`, and may only do so when its own
  property is genuinely unreachable, so a fold can never launder a
  measurement nobody took.

- **Value-space notes** — one property can carry one value and refuse
  another. `border-style: solid|dashed|dotted|none` rides the declared
  grammar while the stroke draws; anything else is named residue.
  `grid-template-columns: 220px 1fr` carries; `minmax()`, percent tracks,
  `auto-fit` and subgrid refuse by their G7 names. `transform` carries
  identity-translates and `rotate(<n>deg)`; scale/skew refuse by name. The
  per-row notes hold these subtleties.

## Planes

Properties are one axis. The capture also models planes, and a property row
applies on every plane that is read:

- **Pseudo-elements read:** `::before`, `::after`, `::marker`,
  `::placeholder` (`READ_PSEUDOS`). `::selection` and `::backdrop` are named
  refusals (conformance). Every other pseudo plane was **silent** until this
  table: `FC-PSEUDO-PLANE-UNREAD` now names the class.
- **States driven:** default, hover, active, focus-visible, plus disabled and
  checked through the prop space. `:visited`, `:target`,
  `:placeholder-shown`, `:autofill`, the validity planes and friends were
  **silent**: `FC-STATE-PLANE-UNDRIVEN` names the class.

Both codes are minted *by the table* — the engine does not yet fire them.
That is deliberate: this change classifies, it does not alter conversion
behaviour. Wiring live receipts for the two plane classes is the named
follow-up.

## The gate

`npm run channel-table:check` (fast lane) refuses when:

1. a property observed by the capture layer (union of `_provenance.channels`
   across committed capture artifacts) has no row — a Chromium upgrade that
   enumerates a new longhand goes red until it is classified;
2. any schema, synthetic, or conformance channel lacks a row, or a
   LOGICAL_ALIASES member stops being INERT;
3. a CARRIED row cites an engine file or symbol that does not exist;
4. the JSON is not byte-stable canonical form, or the totals quoted here and
   in [spec/CHANNEL-TABLE.md](../spec/CHANNEL-TABLE.md) drift from the
   recomputed ones.

`--self-test` plants a dropped row, a ghost symbol and a non-canonical byte,
and requires all three reds — a gate that cannot go red is not a gate.
