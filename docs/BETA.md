# BETA — the one journey that is supported end-to-end

*Read this first if you just cloned the repo and want to see it work.*

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

---

## THE GOLDEN PATH — contracts → one JSON → your Figma canvas

**Why this lane.** It was chosen by measurement, not preference. Flowbite
promotes with **zero named refusals** in its minted token tree (Carbon, the
runner-up, has 14), it carries the highest visual pass rate of any foreign lane
(4 of 5 stems), and it is five contracts rather than ten — small enough to read
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
  --icons examples/tailwind/assets/icons
```

`flowbite.bundle.json` is a local build artifact — gitignored, and rebuilt
byte-identically from the committed contracts whenever you need it.

Then, in the Figma **desktop** app:

1. **Plugins → Development → Import plugin from manifest…** and choose
   `figma-sync/plugin-dist/manifest.json` from the clone.
2. Open a new Figma file and run **DS Contracts Sync Runner**.
3. **Build** tab → paste the contents of `flowbite.bundle.json` → run it.

You get eight token-bound components (Alert, Badge, Button, Card, HelperText,
Kbd, Label, ToggleSwitch) and a `Tokens` variable collection.

**The other direction**, contract → typed React + CSS Modules, from the same
contracts:

```bash
npx tsx packages/cli/src/cli.ts generate examples/tailwind/contracts \
  --out ./out-react --target react \
  --tokens examples/tailwind/tokens/tailwind.dtcg.json,examples/tailwind/tokens/tailwind-minted.dtcg.json \
  --icons examples/tailwind/assets/icons
```

`--icons` is **required**, not optional: without it the run exits 1 by name
because `flowbite.alert` references a dismiss icon.

### It is verified, and here is the proof

[`parity/receipts/beta/GOLDEN-PATH-RECEIPT.md`](../parity/receipts/beta/GOLDEN-PATH-RECEIPT.md)
records the whole list run on a **fresh clone of `main` on a clean machine**,
with exit codes. The claim it exists to support:

> the bundle a stranger builds is **byte-identical** to the one the
> development tree builds.

The sha moves whenever the component set changes — it is the value printed by
the command above at these eight. What the receipts pin is the REPRODUCIBILITY, not the constant: during the
kit climb components were added and removed three times and the bundle returned
byte-identical to `bb96f43e…` (the five-component set) every time.

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
   For the one command on this page that gap does not bite, and that was
   checked rather than assumed: `npx @ds-contracts/cli@0.4.0 figma bundle …`
   against these contracts produces a bundle **byte-identical** to the source
   tree's (sha256 `bb96f43e…`, 92,764 bytes both ways). Pin the version if you
   use it, and do not assume the same parity for other commands — the source is
   ahead and nothing verifies the rest of that surface here.
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

### Expected suite reds — three, and they are not regressions

`npx tsx evals/run.ts` takes ~25 minutes and currently reports **222/225**.
The three reds are known and named:

| eval | why it is red |
|---|---|
| `mui-figma-genesis` | Pre-existing. `switch.figma.js` headless execute: the `switch-track(medium)` pin expects 34x14 and finds 1x1. |
| `child-wider-ratchet-and-script-freshness` | Pre-existing. The astryx/fluent text-wrapping overflow ratchet — the corpus-wide gap named in [22](22-generality.md). |
| `astryx` floor in `npm run visual-truth:check` | **Deliberate.** The astryx lane has 0 headless passes against a ratchet floor of 1. Clearing it would mean claiming a stem that passes on one instrument and fails on the other — the exact discipline another stem was just *un*claimed under. It stays red on purpose. |
| `npm run docs:check` | Pre-existing on a clean clone of `main`, and verified as such rather than assumed. Two generators disagree about the same numbers: `capability:report` writes `docs/24` (e.g. "10.4% coverage") while `docs-numbers-check` re-derives 9.2 from the artifacts. Neither is lying; they read different denominators. Not on the golden path, and not touched here. |

A green suite is not the bar. A suite whose reds are all *named* is.

## Applying is additive — it never prunes

Generating into a file CREATES and UPDATES variables and components; it never
deletes. If you apply a component and later remove it from your library, its
tokens stay behind in the `Tokens` collection with nothing bound to them.

Measured on the reference file: a 331-token bundle sat in a 444-variable
collection, and the 113 extras were exactly the token subtrees of two
components that had been applied earlier and then withdrawn. They were verified
unreferenced — no node bound to them, no surviving variable aliased them — so
nothing rendered wrong; the collection was just carrying history.

Removing them is a manual step today (`FC-APPLY-TOKENS-NOT-PRUNED`).
