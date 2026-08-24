# BETA — the one journey that is supported end-to-end

*Read this first if you just cloned the repo and want to see it work.*

## What this product guarantees (and what it does not)

Hold us to these five. Everything below is how to run them, not a second product.
The live climb list is [NORTH-STAR.md](../parity/receipts/beta/NORTH-STAR.md).

1. **The contract is the source of truth.** Eight Flowbite contracts in this repo are the design-system fact. Figma and React are projections of those files.
2. **Code → Figma is the supported hop.** The same contracts produce one JSON bundle; paste it in Figma desktop; you get eight token-bound component sets (not hex-painted copies). Re-applying amends in place. Two builds from the same inputs are byte-identical.
3. **Code → React is the supported development output.** `generate` from those **authored** contracts emits typed React + CSS Modules. Where the contract declares events (ToggleSwitch, Alert dismiss), that React is interactive. A dump-generated preview is not.
4. **Figma → contract is recovery, not an app generator.** A set *this pipeline drew* can be dumped and proposed back. Recovered props, stamped tokens, and host element are the bar. Generated Storybook from a dump is a preview of that recovery. It will not click, toggle, or replace the library.
5. **Coverage is 8 of 46 Flowbite components (17.4%), chosen because they were tractable.** We do not guarantee a fifty-component kit or lossless geometry. Events exist only when the authored contract declares them. Those are named limits, not unfinished work.

This project has three adoption paths ([00 — Choose Your Path](00-choose-your-path.md)).
**For the beta, exactly ONE of them is supported end-to-end by a documented,
receipted, clean-machine command list: path B, code-first, on the Flowbite
lane.** Everything else in the repo is real and runs, but it is not what this
page promises, and some of it needs a setup you do not have.

Two citations carry the honest numbers and neither is optional:
[24 — What Works](24-what-works.md) is what it delivers, measured;
[23 — Known Limitations](23-known-limitations.md) is what it costs.

> **How this page relates to [28 — Beta Tester Runbook](28-beta-runbook.md).**
> 28 is the *exploratory* document: it walks all three tracks, prices each one,
> names the walls before you hit them, and gives you somewhere to file what you
> find. **This page is the narrow one** — a single journey, a command list that
> was executed verbatim on a clean machine, and a receipt. Read this to see it
> work; read 28 to go looking for its edges. If the two disagree about a
> command, this page was run more recently and its commands carry a receipt.

A rehearsed command list for both hops (including dump → React as a
*recovery* preview) lives at
[parity/receipts/beta/LIVE-DEMO.md](../parity/receipts/beta/LIVE-DEMO.md).
That page is not a second product. The guarantees above still win.

---

## THE GOLDEN PATH — contracts → one JSON → your Figma canvas

**Why this lane.** It was chosen by measurement, not preference. Flowbite
promotes with **zero named refusals** in its minted token tree (Carbon, the
runner-up, has 14), it carries the highest visual pass rate of any foreign lane
(4 of 5 stems), and it is eight contracts rather than ten — small enough to read
in one sitting. Its full comparison is in the receipt below.

**What you need.** Node ≥ 20, a Figma account, and the Figma **desktop** app
(plugin import is desktop-only). That is all. You do **not** need the Console
MCP, a browser automation setup, an npm sandbox, or any Figma file key.

```bash
git clone https://github.com/southleft/ds-contracts-poc.git
cd ds-contracts-poc
npm install

# 1. Build the plugin. It is NOT in the clone — see "Beta limits" below.
npm run plugin:zip

# 2. Build the bundle. This one JSON is the only thing you ever paste.
npx tsx packages/cli/src/cli.ts figma bundle examples/tailwind/contracts \
  --out flowbite.bundle.json \
  --tokens examples/tailwind/tokens/tailwind.dtcg.json,examples/tailwind/tokens/tailwind-minted.dtcg.json \
  --icons examples/tailwind/assets/icons \
  --name Tailwind
```

`--name Tailwind` names the variable collection the paste creates; it is
also what the committed `examples/tailwind/figma/tailwind.bundle.json` was
built with, so the file you build and the file the tree checks are the same
bytes. `flowbite.bundle.json` is a local build artifact — gitignored, and rebuilt
byte-identically from the committed contracts whenever you need it.

`--tokens` on this lane is the flat two-file form (base, minted). Since
2026-08-22 `figma bundle` also takes the layered grammar `generate` already
had — a directory of `*.tokens.json`, `slot=file` entries
(`primitives=…,semantic=…,brand.aurora=…`), `--modes light,dark` — and
carries the layers in `tokenSet.layers`, so a first-party-shaped corpus
compiles in the plugin with native aliases instead of refusing one paste at
a time (`first-party-bundle:check`). A bundle whose contracts do not all
compile is refused with ONE named list before ✔ is ever printed.

Then, in the Figma **desktop** app:

1. **Plugins → Development → Import plugin from manifest…** and choose
   `figma-sync/plugin-dist/manifest.json` from the clone.
2. Open a new Figma file and run **DS Contracts Sync Runner**.
3. **Build** tab → paste the contents of `flowbite.bundle.json` → run it.

You get eight token-bound components (Alert, Badge, Button, Card, HelperText,
Kbd, Label, ToggleSwitch) and a `Tailwind` variable collection (the
`--name`). The plugin's run report lists, under each set, every code-only
fact the canvas could not carry — part, channel, value, reason
(`codeOnlyFacts`, 56 on these eight) — the same list `figma bundle` prints
on stdout.

The eight contracts carry the live demo sets' identity under
`bindings.figma.anchors` (`fileKey` `59mLQlOMiD5w5za6SUcoO5`, the set
`nodeId`, the set `componentSetKey`). That does not pin the paste to that file:
the plugin plans against the file you have open (it passes the open file's key,
overriding the contract's), so a new file works as above. The standalone
`examples/tailwind/figma/*.figma.js` console scripts are the exception — they
carry the demo file key as a hard guard and refuse any other file by name
(`WRONG FILE`). The anchors also sit inside the hashed spec, so the demo file's
sets will re-reconcile in place (same node id and key) on the next Apply.

**The code guarantee** — same authored contracts → typed React + CSS Modules
(this is *not* generate-from-a-Figma-dump):

```bash
npx tsx packages/cli/src/cli.ts generate examples/tailwind/contracts \
  --out ./out-react --target react \
  --tokens examples/tailwind/tokens/tailwind.dtcg.json,examples/tailwind/tokens/tailwind-minted.dtcg.json \
  --icons examples/tailwind/assets/icons
```

`--icons` is **required**, not optional: without it the run exits 1 by name
because `flowbite.alert` references a dismiss icon.

The output also carries `tokens.css` — every custom property the components
reference, `:root` for the default slot and `[data-theme="dark"]` /
`[data-brand=…]` for named slots — and the emitted `index.ts` and stories
import it, so `npm run storybook` over `./out-react` is styled with no token
build of your own. A reference the sheet cannot define is refused by name at
generate time (`css-vars:check` pins it); a `var(--x, fallback)` override
hook is allowed to stay undefined until a consumer sets it.

### Keeping the two surfaces in line

After a contract edit, a canvas amend, or a recovery dump, run:

```bash
npm run maintain          # token-free; every one of its steps is also a fast- or full-lane step
npm run maintain:visual   # catalog visual-parity; needs FIGMA_TOKEN and the Figma PNG cache
```

`maintain` is the adopter gate and needs nothing but the clone; `npm run
ci:lanes` expands it and refuses if any leaf is missing from a lane. The
visual half reads rendered Figma cells through the REST images API, so it
needs a `FIGMA_TOKEN` (env or `.env.local`); since 2026-08-22 it runs in
the **catalog-visual** lane with the repository's secret — it is no longer
excluded from CI.

`maintain` today is seventeen steps: leftover string→boolean emit
(`string-boolean-coercion:check`) + token-apply prune doors
(`token-set-prune:check`) + exact proposal (`exact-proposal:check`) + hop-2
bundle freshness (`flowbite-bundle-fresh:check` — the committed
`examples/tailwind/figma/tailwind.bundle.json` matches a fresh build and still
carries Alert `dismissable`/`onDismiss` and ToggleSwitch
`role=switch`/`onToggle`) + hop-2 Apply plugin (`plugin:check` vs the engine
receipt, incl. the verbatim dump-script embed) + hop-4 dump→propose
(`flowbite-dump-propose:check` — all eight pipeline-drawn Flowbite dumps
recover their props/host and stamped `imported.*` layout, paint, stroke,
type, dump `_degradations`, and Badge/Button State-preview paint names, and
do not invent `onClick`/`onDismiss`/`onToggle`) + catalog/live anchor
agreement (`extract:figma:visual:anchors`) + `functional:flowbite`
(clicks/dismiss still execute) + `parity:flowbite` (authored vs recovered,
named walls stay named) + the Phase 1 gates added 2026-08-22: root `attrs`
carried on every code target (`root-attrs:check`), every referenced custom
property defined in the emitted `tokens.css` (`css-vars:check`), every
canvas-dropped fact named where a person reads it (`code-only-facts:check`),
a root that IS the text node draws (`root-text:check`), the first-party
corpus bundles and compiles in the plugin as one plan
(`first-party-bundle:check`), and a prop named like a DOM attribute is
`Omit<>`-ed and named rather than colliding (`prop-collision:check`), and
the Playground walkthrough receipt added 2026-08-23
(`playground:flow-check` — every number the two guided tours print is
re-derived headless from the same engine calls over the same committed
inputs, and the tour's ToggleSwitch acceptance is pinned — since dump v1.32 the
`ds_contracts/semantics` stamp carries `semantics.roleException`, so the
referee accepts the stamped proposal, and the pin fails loudly if that
channel is ever dropped).

`maintain:visual` is the catalog visual-parity gate on Button / Badge /
Checkbox / Switch / Heading: every row's masked pixel score within ±0.1pp
of the platform's committed baseline (`baseline.darwin.json` /
`baseline.linux.json`) AND both content boxes — ours and Figma's — within
±4 device px of it. The pixel score alone provably missed a 39%-wider Badge
on 2026-08-22, which is why the geometry half exists; `-- --self-test` is
the gate's own red test. Eventz / CBDS / Shoelace rows stay on the full
`--summary` map; they are not the ship set. A green `maintain` is the beta
handoff bar. It is not v1.

### It is verified, and here is the proof

[`parity/receipts/beta/GOLDEN-PATH-RECEIPT.md`](../parity/receipts/beta/GOLDEN-PATH-RECEIPT.md)
records the whole list run on a **fresh clone of `main` on a clean machine**,
with exit codes. The claim it exists to support:

> the bundle a stranger builds is **byte-identical** to the one the
> development tree builds.

The sha moves whenever the component set — or the bundle grammar — changes,
and this page does not quote it. The receipt's last clean-clone run
(2026-08-22, branch `phase-0/one-truth` at `7066eb86`, eight stems) measured
`2714be61…` (109,841 bytes) and found it byte-identical to the committed
bundle of that commit. The committed `tailwind.bundle.json` has been
regenerated by its recipe several times since (the `codeOnlyFacts` sibling,
dump v1.31 fields, the schema-17 `bindings` spelling), and the clean-clone
run has **not** been repeated on the current commit. What holds between
receipts is `flowbite-bundle-fresh:check` — on every `maintain` and
fast-lane run the committed bytes must equal a fresh emit — so the
REPRODUCIBILITY is pinned continuously and the constant is read from the
file (`shasum -a 256 examples/tailwind/figma/tailwind.bundle.json`), never
from prose. During the kit climb components were added and removed three
times and the bundle returned byte-identical to `bb96f43e…` (the
five-component set) every time.

The bundle is a pure function of (contracts, tokens, icons) — no timestamp, no
machine id, no ordering nondeterminism.

---

## BETA LIMITS — the things that will trip you, stated up front

These are documented rather than fixed. Fixing them is not a beta blocker;
being surprised by them is.

1. **Two CLI entrypoints, and they are not the same version.** This repo's own
   `package.json` declares no `bin`, so from a clone every command is spelled
   `npx tsx packages/cli/src/cli.ts …`. There is *also* a published
   **`@ds-contracts/cli`**, currently **0.4.0**, while this source tree is
   `0.5.0-rc.2` — **the published CLI is behind the source.**
   When that was last checked (the FIVE-stem set, schema 16), `npx
   @ds-contracts/cli@0.4.0 figma bundle …` produced a bundle **byte-identical**
   to the source tree's, sha256 `bb96f43e…`, 92,764 bytes both ways. **That
   parity no longer describes this tree's inputs:** every contract here is
   schema 17 (the contract-level `bindings` hoist, 2026-08-22), and the
   published 0.4.0 carries schema 16, so it should be expected to refuse
   these contracts rather than reproduce the bundle — unverified, because
   re-running it reaches the network for a published package, which is a
   human step here (docs/27). From a clone, use `npx tsx
   packages/cli/src/cli.ts …` as written above; if you must use the published
   package, pin the version and expect the refusal until a schema-17 CLI is
   published.
2. **The plugin is not in the clone.** `playground/public/*.zip` and
   `figma-sync/plugin-dist/` are gitignored (`.gitignore:28,50`). You must run
   `npm run plugin:zip` before you have anything to import. A clean clone that
   skips it produces a bundle and nowhere to paste it.
3. **Plugin import is Figma DESKTOP only.** The browser app cannot import a
   plugin from a manifest.
4. **`extract` is NOT on the golden path.** Capturing a *new* library needs an
   npm sandbox outside the repo with that library installed, plus Chromium via
   playwright. That is the `onboard` flow, it is real, and it is not what this
   page promises. The golden path starts from the committed contracts.
5. **The internal visual loop needs things you do not have.** The freeze board
   (below) is driven from the Figma Console MCP against four specific Figma
   files owned by the maintainer. None of it is required to run the golden
   path, and none of it will work for you. Ignore it.

---

## WHAT IS AND IS NOT PROVEN

Read [24 — What Works](24-what-works.md) and
[23 — Known Limitations](23-known-limitations.md) in full before adopting.
The one-line version, from 24's own denominator: the measured components are
**a small, easy fraction** of the libraries they came from, and every
percentage on either page should be read as *"on the easy fraction."*

### The freeze board is INTERNAL. It is not a product claim.

`parity/receipts/console-loop/` and its `CONTINUE.md` are a maintainer's
visual-fidelity climb — pixel-scoring generated Figma cells against real
library renders. At the close of freeze wave 2 the board stands at **35/97
bridge, 31/133 headless scorecard passes, 33 claimed**. Those numbers describe
how close the *canvas output* gets to a *library screenshot* under a 5%
antialiased-pixel bar. **They are not a statement about whether the golden path
works**, and you should not read them as one. They exist so the maintainer
cannot quietly overstate fidelity.

### Three decisions you will see referenced, and why they are not bugs

**Option B — the geometry exclusion is deliberate and locked.**
`FC-GEOMETRY-EXCLUDED` (`extract/computed/fuse.ts`) keeps width/height/insets
out of fusion as environment-dependent, admitting them only for absolute
clusters, table cells and the block-root/overlay doors. This is a decision, not
an omission: relaxing it previously minted the capture *window* as design
tokens in four of six libraries. The obligation it carries is to **ledger**
each drop, never to fix it by relaxing the exclusion.

**Alpha compositing — both sides are flattened onto white before measurement.**
The scorer composites canvas and reference over opaque white before any ink
crop. Without it a translucent fill exported from Figma reads as invisible
while the same fact in an opaque reference reads as ink, so two encodings of
one design fact scored as a failure. It is red-tested in both directions
(`scripts/console-loop-alpha-composite-probe.mts`): the same fact under two
encodings now passes, a genuinely different translucent paint still fails, and
the legacy collapse is pinned so it cannot silently return.

**Composition fill pins — an operating rule, not a defect.**
The five first-party *composition* stems (bento-grid, grid-gallery, page-shell,
sidebar-layout, two-column) are slot components. The emitter builds slots
**empty** by design — no contract declares default content — while their scored
surface is the FILLED one, populated per
[`docs/composition-corpus/README.md`](composition-corpus/README.md) with one
pinned child per slot. So:

> **Never re-run a first-party composition script without re-applying its fill
> pin immediately afterwards.**

Forgetting is now caught by name (`FC-CELL-FRAMING` / `FC-CELL-INK-LOST`)
rather than surfacing later as a blank score. This only matters if you are
working on the internal loop; it does not affect the golden path.

### The eval suite on this branch

`npx tsx evals/run.ts` takes ~25 minutes and writes `evals/results.json`
stamped with the commit it measured and whether the tree was dirty. That
file is not a claim: the full CI lane re-measures the suite on every push
and `eval:record:check` fails the lane row-by-row if the committed record
disagrees with what CI saw, and refuses a dirty-tree or foreign-branch
record outright. Read the pass count from the record, not from this page.
`npm run visual-truth:check` still holds the astryx floor (1) above its
headless count (0) on purpose — that is a visual-truth ratchet, not an
eval-suite row; since 2026-08-22 it is printed as a named advisory warning
(`RATCHET.json` → `advisory.astryx`) rather than a standing red in the required
fast lane, and it fails again the moment the lane regresses or meets the floor
without the entry being removed.

A green suite is a guarantee that the *claims we make* still execute. It is
not a guarantee that inverted Storybook is a shipping component library.

## Applying upserts; pruning leftovers is opt-in and names what it keeps

Generating into a file CREATES and UPDATES variables and components. After
the token upsert, leftovers in **the collections that apply owns** (the
bundle `Tokens` collection, or first-party Primitives / Brand / Semantic)
are **counted and named, not removed** — the step result carries
`leftovers: [...]` with `pruned: 0`, and the plugin's Build log lists them
(`FC-APPLY-TOKENS-NOT-PRUNED`). Deleting them is a door you open on purpose:
set `globalThis.DS_PRUNE_TOKENS = true` in the plugin console before the
run. With the flag on, a leftover a scene node still binds, a local
paint/text/effect/grid style still binds, or any local variable still
aliases, stays; other collections are untouched; a runtime missing one of
the four style readers skips the prune and says so (`pruneSkipped`).

Why the door is closed by default: the Plugin API cannot see consumers in
OTHER files — an instance in a product file bound to a published library
variable looks exactly like an unreferenced leftover from inside the library.
The first close of this finding deleted such variables silently; see
[23 §B.23](23-known-limitations.md#b23-token-prune-does-not-see-style-bound-or-cross-file-consumers).

Measured on the reference file before this close: a 331-token bundle sat in
a 444-variable collection, and the 113 extras were exactly the token
subtrees of two components that had been applied earlier and then withdrawn.
Those 113 are now named on every run; they leave only when asked.

### Re-applying REWRITES a component you already have — unless you say otherwise

Applying is additive across *different* components, but for the *same* one it
is an **amend in place**. A set carrying this system's identity marker is
reconciled — same node id, same key, same page — so a re-run keeps a designer's
file in sync instead of littering it with copies. That is the intended
behaviour and it is why the loop works at all.

It also means **applying a bundle to a file that already carries these stems
rewrites those pages.** If that is not what you want — a first look, a spare
file, a run that must not touch shipped work — set the create-only flag before
the script runs:

```js
globalThis.DS_CREATE_ONLY = true;
```

A component that already exists is then **refused by name** and nothing is
written to it; components that do not exist yet are still created. So a
half-populated file fills in its gaps and leaves everything else alone.

Proven on `GnQnjSNBXtgtd2Ht0Hs1C8`, which already carried 5 of these 8 stems:
Badge refused (`create-only apply: "Badge" already exists …`) with its node id,
fingerprint, specHash and all 24 variants byte-identical afterwards, while
Label created fresh on a new page — one run, one file, both halves.

### Figma → contract is recovery

`extract/figma/dump.plugin.js` → `npm run extract:figma -- <dump.json>`
proposes contracts back from a set **this system drew**. The bar is recovered
props, stamped token identity, and host element — not a working app. Until
2026-08-16 that refused Badge and Button (`EXACT_MATRIX_RAGGED`); the emitter
now stamps the sparse State matrix it actually drew, and the reader holds the
dump to that declaration. A set nobody declared is still held to a full
Cartesian. Generating React from that proposal is a preview of the recovery.
The development output remains `generate` from the authored contracts above.

The no-plugin twin, `npm run extract:figma:rest -- <figma-url>` (a
`FIGMA_TOKEN`, REST GET only), writes the same dump shape — including the
mapper's receipts as `_degradations`, so propose surfaces every named loss
instead of leaving it on a terminal. One thing that route cannot read without
your help: variable names and modes need the token's **`file_variables:read`**
scope. A token minted without it gets a 403 that the CLI now reports as what
it is — a missing scope with a one-line fix (`regenerate the token with
file_variables:read`) — on stderr, in `_provenance.variables`, and in
`figma-proposals.md`; it is not an "Enterprise" limit, and a 403 naming no
scope (plan tier UNVERIFIED) or a network failure is named separately. With
the scope, the dump carries `_variables` and propose writes
`captured.dtcg.json` exactly as it does for a plugin dump.
