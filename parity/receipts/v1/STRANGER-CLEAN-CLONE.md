# What a stranger gets from a clean clone — measured, not asserted

**Measured 2026-09-04** against `origin/main` at `be4a8c51`, in a fresh
`git clone --depth 1` outside this working tree, with no environment this repo
set up. Every command below is one a published page tells a reader to run, run
in the order the page gives it, and every result is what the terminal printed.

## The reference-implementation path (docs/00-getting-started)

| step the page gives | exit | what actually happened |
| --- | --- | --- |
| `npm install` | 0 | 255 packages, 11s |
| `npm run build` | 0 | tokens, schema and components generated; 13 required-fact warnings named per contract |
| `npm run parity` | 1 | **one** drift finding, and it is `snapshot-stale` — exactly the state the page predicts for a fresh clone |

The page's prediction for step 1 is accurate to the finding class: the committed
Figma snapshots are 57.6 days old against a 14-day maximum, the differ says so,
and it is the only thing it says. Five `figma PENDING` entries name contracts
that have never been synced, which the differ separates from drift by design.

## The two-minute loop the same page gives (steps 2–4)

The page said: *open a contract, **add an enum value**, then
`npm run build && npm run parity`, and the differ reports the canvas behind.*

Adding an enum value to `badge.variant` does not do that. It is a
**variant-keyed** prop, so a new value `neutral` demands
`{color.feedback.neutral.background}` and `…foreground`, which do not exist in
`tokens/`. The build **refuses the contract by name**, names the seven contracts that depend on it — five directly, two through those — and refuses them too, and exits 1. That refusal is the
product behaving correctly — but `build && parity` short-circuits on it, so the
reader never reaches the differ, and the page's promised result never appears.

A change that does reach it, verified end to end here: change the `children`
default from `Badge` to `Status`. Build exits 0, and parity names it exactly —

```
[figma MISMATCH] Badge.Label (default)
  Default differs — contract: "Status", figma: "Badge"
  → Adopt into contract (promotion) or reset the property default
```

Reverting the contract and rebuilding returns parity to `snapshot-stale` alone.
The loop closes. The page now gives that change, and names the enum case as the
refusal it is.

## The recipe path (docs/36 — "one command", the product spine)

The page's own headline example, run verbatim on the clean clone:

```
npm run recipe:point -- --archetype switch --library shadcn
→ TypeError: reviewed switch adapter: unsupported source cells must be named
```

An uncaught stack trace, on a page whose stated promise is *"everything it
cannot do refuses by name"*. And the crash comes at step 4, **after** step 3 has
already overwritten the committed
`recipe/fixtures/generated/switch.shadcn.ts` with a copy whose refusal list is
empty — so the reader is left with a stack trace **and** a working tree holding
a fixture that no longer compiles. The flag table on the same page does say
`--unsupported` is required; the example omits it.

Six further pairs were tried on the unpatched clone and every one behaved
identically: avatar/shadcn, tabs/mui, link/mui, badge/mui, radio/antd,
tooltip/antd. The defect is the command's, not one archetype's.

Fixed here. The flag is now validated before the run writes a single byte:

```
✖ --unsupported is required: every adapter refuses a fixture that names no unsupported cell.
  Name the cells this capture cannot express, comma-separated, e.g. --unsupported hover,focus-visible,active.
  recipe/fixtures/generated/switch.shadcn.ts already names ["hover","focus-visible","active"] — pass those to keep it, or different ones to change it.
  Nothing was written.
```

Exit 2, and the hint is read out of the fixture the repo already ships rather
than guessed. All seven pairs now refuse this way and write nothing.
`recipe/fixture-reader/point.test.ts` asserts the exit code, the message, the
absence of a TypeError, and that the generated fixture is byte-identical after
the refused run; the test fails when the guard is reverted.

With the flag supplied, the same command runs all five steps on the clean
clone — capture, drafted roles, 25 leaves read and 0 invented, compile to the
fixed point at recipe `a68d9a8f`, and the emitted plugin program — matching the
recipe hash in the committed pointed receipt. The regenerated fixture's values
are identical to the committed one; only the citation lists are longer, because
the ledger now carries more corroborating cells.

### Two siblings measured and deliberately left alone

`recipe:draft-roles` and `recipe:propose-fixture` with no arguments also exit
through a thrown `Error` with a stack trace. They are **not** the same defect and
are not changed here: each throws a correct usage message ("usage: --ledger
extract/computed/out/<lib>/checkbox/captured-truth.json"), neither writes
anything first, and neither is quoted as a runnable command on any page a
stranger is sent to. What made the `recipe:point` case worth fixing was the
combination the others do not have — a page's own headline example, a message
that named no fix, and a committed file overwritten before the throw.

### The emitted program is not the committed one, and that is correct

Re-running the command in the clone rewrites
`recipe/evidence/pointed/switch-shadcn/writer.plugin.js`, and the new file is
not byte-identical to the committed receipt. The difference is entirely the
**shared writer runtime**, which has gained two things since that receipt was
emitted: the case- and spacing-blind font-style match (so a foundry's
"Semi Bold" matches a CSS-weight "Semibold") and per-side stroke weights. The
run identity moves with it, `a68d9a8f-switch-v9` to `-v13`.

The **recipe hash is unchanged at `a68d9a8f`**, which is the part that matters:
the IR the fixture compiles to is identical, and only the boilerplate that
writes it into Figma has improved. A reader comparing their output to the
committed receipt should expect the version token and the runtime block to
differ and the recipe hash not to.

### The plugin a stranger builds

`npm run plugin:zip` on the clean clone exits 0 and writes
`figma-sync/plugin-dist/` — `manifest.json` (969 B), `code.js` (47,718 B) and a
`ui.html` of **1,058,659 B**, which is an engine actually injected rather than
the stub the prerequisites warn about. (The string "engine: NOT INJECTED"
appears once in that file and is the else-branch of the header stamp, not the
state of this build.) The path docs/00-choose-your-path gives for people who do
not want the hosted zip works as written.

## The CLI a stranger installs

`npm i -g @ds-contracts/cli` is real: `@ds-contracts/cli@0.4.0` resolves and
runs. It is the **pre-pivot** path — the universal-contract envelope the
2026-09-01 audit dropped from v1 — and README already says so where it names
the version. The recipe path this page measures still has no published vehicle;
that gap is the audit's, and it is not closed here.

## How to re-derive this page

```
git clone --depth 1 https://github.com/southleft/ds-contracts-poc.git
cd ds-contracts-poc && npm install && npm run build && npm run parity
npm run recipe:point -- --archetype switch --library shadcn
```
