# The alias chain that was not there — 329 skips, three causes, none of them a chain

**2026-09-05.** This round set out to teach the CSS-vars source reader to follow
an alias chain instead of exactly one hop, on the strength of **329
"one-hop-indirection" skips across eight libraries**. The chain walk was built.
Then it was measured, and the premise did not survive.

## What the 329 actually are

Every one of those skips came from a branch that printed, whenever a value
verified and its name was not a DTCG leaf:

> *"The VALUE is right and only the NAME is unrecoverable: this is the shape of
> a semantic-over-primitive INDIRECTION (the referenced custom property is
> itself defined as `var(<primitive>)`), and the reader follows exactly ONE
> hop — the primitive behind the alias is never reached."*

That sentence asserts a cause. It never measured it. Decomposed against each
library's own DTCG file:

| cause | count | libraries |
| --- | ---: | --- |
| **The leaf EXISTS** — the DTCG declares it *with* the varPrefix the join rule strips | **283** | day-picker |
| **The token is ABSENT from the DTCG file** | **45** | chakra 30 · mui 9 · carbon 2 · fluent 2 · altitude 1 · shadcn 1 |
| other | 1 | conformance |
| **a genuine chain a deeper walk could recover** | **0** | — |

day-picker declares `rdp-nav_button-height`; the join rule strips `--rdp-` and
looks up `nav_button-height`. The two spellings disagree and the leaf was there
all along. Chakra's DTCG file carries 200 leaves and not one `font-weight`
among them — nothing to bind to, at any hop count.

## The defect that was actually there

The comment directly above that branch reads:

> *"THE MESSAGE USED TO COLLAPSE EVERY CAUSE INTO ONE … three different defects
> with three different remedies, reported identically. That is exactly the
> condition that hid Carbon's hollow checkbox. **The cause is now named.**"*

It was named one level up — "no candidate at all" vs "candidates, none a DTCG
leaf" — and **guessed one level down**. A reader sent to look for an indirection
that does not exist will not find the leaf sitting in their own token file under
a different spelling.

The two branches now measure. Re-captured day-picker end to end, all 294 skips
now read:

> `NAME CONVENTION — --rdp-nav_button-height → the DTCG file declares
> "rdp-nav_button-height", but the join rule strips the varPrefix and looked up
> "nav_button-height". The VALUE verifies and the leaf EXISTS; only the two
> spellings disagree. Remedy: rename the leaf to the stripped form, or unset
> library.varPrefix so the reader stops stripping.`

and the absent case names the file and its leaf count instead.

## The chain walk: kept, and it recovers nothing today

The walk is implemented as asked — breadth-first over the alias graph, depth
capped at 8, a `seen` set so `--a: var(--b)` paired with `--b: var(--a)`
terminates. The direct name is still pushed under its old condition and still
ranks first, so it is a strict superset: **no existing binding changed**,
measured on day-picker (facts 0 → 0, every skip identical before the message
fix).

It is kept rather than reverted because it is correct and free: MUI's
`--variant-containedBg: var(--mui-palette-primary-main)` and Fluent's local
variables are exactly the shape it walks, and the one-hop reader already reaches
those. It recovered **zero** on this corpus, and that is reported rather than
dressed up.

An **ambiguity rule** rides with it: a name recovered by *walking* (distance ≥ 1)
that ties with another distinct DTCG leaf at the same distance is **refused**,
not picked alphabetically. Hop-0 ties keep their existing tiebreak, because
those bindings are committed and value-identical by construction; changing them
would be a regression wearing a fix's clothes.

## Bootstrap 5, re-run: it still does not promote — and now says why

Identical capture result to the previous round, so nothing regressed: **7 of 10
shipped a contract, 3 quarantined by name (Button, Modal, Spinner), weighted
floor 92.8% over 7,536 cells**, 61 named refusals, 0 open queue.

`promote` **REFUSED** again — `varPrefix` is `--bs-` and the reader verified
**0 source facts across 7 components**. That is the same verdict as before. What
changed is that the 70 skips behind it are now separated by measured cause
instead of all claiming an indirection:

| named cause | count | what it means for Bootstrap |
| --- | ---: | --- |
| **ABSENT FROM THE DTCG FILE** | **45** | e.g. `--bs-card-title-spacer-y` verifies at `0.5rem`, and the 127-leaf DTCG file declares no such leaf under any spelling. There is nothing to bind to. |
| **NAME CONVENTION** | **16** | e.g. `--bs-body-color` — the DTCG file declares `bs-body-color`, the join rule strips `--bs-` and looks up `body-color`. **The leaf exists.** |
| other | 9 | |

So the honest answer to "does it promote": **no**, and the blocker is not a hop
count. Sixteen of its bindings are a spelling disagreement between the reader's
join rule and a blind-authored token file, and forty-five are tokens that file
never declared.

Both remedies are edits to Bootstrap's own committed artifacts — rename the
leaves, or unset `varPrefix` — and the exam's rule is that a config is not
reshaped until it fits. `--accept-zero-bindings` was offered again and again
**not taken**. Neither the config nor the DTCG file was touched.

## What moved, and what did not

| | before | after |
| --- | ---: | ---: |
| skips claiming "semantic-over-primitive INDIRECTION" | **329** | **0** |
| skips naming NAME CONVENTION (leaf exists, spelling differs) | 0 | **283** (day-picker) |
| skips naming ABSENT FROM THE DTCG FILE | 0 | **45** |
| existing source-binding facts changed | — | **0** |
| names recovered by the alias chain walk | — | **0** |
| Bootstrap first-pass capture | 7/10 contracts, 92.8% | **unchanged** |

No committed capture was re-recorded: day-picker and Bootstrap were both
captured into scratch trees, and the corpus artifacts were reverted. The change
is to the engine and to what it *says*, not to any recorded number — which is
why the curated-fact guard has nothing to compare here and the promote ledger,
drift pins and doc numbers do not move.

## The honest summary

The goal asked for an alias-chain reader on the strength of 329 chain-shaped
skips. **There were none.** The walk was built anyway, is correct, cycle-guarded
and additive, and recovers nothing on this corpus; it is kept because MUI's and
Fluent's variables are exactly its shape and it costs nothing, and its zero is
reported rather than hidden.

What the round actually bought is that a message which had asserted one cause
for 329 different situations now measures which of three it is — and two of
those three have remedies the reader can state, in the file the reader should
open.
