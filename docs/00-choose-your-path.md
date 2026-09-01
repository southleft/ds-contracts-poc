# Choose Your Path — one truth, three situations

> **Current state (2026-08-31).** Journeys A–C below are the
> **universal-contract** adoption paths (plugin Send / `onboard` / reconcile).
> They still run. They are **not** the v1 proof. The active v1 plan is
> [docs/35](35-two-journey-v1-plan.md). Recipe-IR proved five
> archetypes live with owner grades; product v1 is incomplete (F1). See
> [docs/32](32-recipe-ir-pivot.md). Combobox, table, and calendar are
> live-proven on the recipe path — do not read the capture-path
> “ATTEMPTED — BOUNDED” table in [docs/23 §C.1.1](23-known-limitations.md#c11-which-component-archetypes-are-proven--the-actionable-cut)
> as “those archetypes have no proof.”

**This page is the canonical statement of the adoption paths.** Every other
document that mentions "the journeys" links here; if another page appears to
disagree with this one about how many paths there are or what a path is
called, this page wins and the other page has a bug — please report it.

> **Beta note.** Of the three paths below, exactly ONE is supported
> end-to-end for the beta by a documented, receipted, clean-machine
> command list: **path B on the Flowbite lane**. See
> [BETA.md](BETA.md) before you start. The other two paths are real and
> they run, but they are not what the beta promises.

Three situations bring people to this tool. They are genuinely different
amounts of work, they run different verbs, and they end in different places.
One rule spans all three: **the surfaces never sync side-to-side.** A
designer's change and an engineer's change both travel *through the
contract*, as a reviewable diff. Nothing writes to your repo without a pull
request or an explicit `--apply`, and nothing writes to the canvas without a
human clicking Apply.

| | Your situation | Direction | The verbs | Ends with |
|---|---|---|---|---|
| **A — design-first** | *"I have a component library in **Figma**. I want typed React in my repo."* | Figma library → contracts → React + Storybook | plugin **Send** tab → deliver (PR / `figma receive` / copy) → `generate` | A typed React component + CSS Modules + stories, in your repo, as a reviewable change |
| **B — code-first** | *"I have components in **code**. I want them in Figma."* | React/CSS → `onboard` / computed capture → contracts → Figma sets | `onboard` → review the draft config → `onboard --continue` → publish/paste | A designer clicks **Check for updates** (or pastes one JSON) and your components land on the canvas, token-bound |
| **C — reconcile** | *"I already have a mature Figma library **and** a mature codebase, and they disagree."* | both surfaces → disagreement report → CI referee | plugin **Send → Scan this file** · `extract --reconcile` · `diff`/`diagnose` in CI | A property-by-property disagreement report, and a gate that stops the gap growing |

**Every path below carries the same two citations, and neither is optional.**
[24 — What Works](24-what-works.md) is what the path *delivers*, measured, with
every number carrying the artifact it was read from.
[23 — Known Limitations](23-known-limitations.md) is what it *costs*. They
share one denominator — the 113 covered components are **11.1%** of the 1015 in
the seven libraries with a measured size ([24 §2](24-what-works.md)) — so read
every percentage on either page as *"on the easy 11.1%."*

---

## Prerequisites, by path

Nothing here is discovered mid-run; check it before you start.

- **Node ≥ 20** — every path, every verb.
- **A Chromium, via `playwright-core`** — **path B only**, and only for the
  computed capture (`extract --computed`, which `onboard --continue` runs for
  you). If no browser is found, that verb — and only that verb — stops with a
  named message and **exit code 3** telling you to
  `npm i playwright-core && npx playwright-core install chromium` (or point
  `PLAYWRIGHT_CHROMIUM_PATH` at a Chromium you already have). Every other
  verb works without a browser.
- **The Figma DESKTOP app** — any path that opens the plugin. Development
  plugins load only in the desktop app, never on figma.com. Any Figma plan
  works; no admin approval is needed.
- **The Sync Runner plugin**, installed one of two real ways (it is *not* on
  the Figma Community, by decision — [docs/18 G0](18-user-flows.md#ranked-gap-list)):
  1. **No clone:** download the packaged zip from the playground —
     [ds-contracts-playground.pages.dev/ds-contracts-sync-runner-plugin.zip](https://ds-contracts-playground.pages.dev/ds-contracts-sync-runner-plugin.zip)
     (also linked from the playground's plugin panel) — unzip it, then in
     Figma desktop: **Plugins → Development → Import plugin from manifest…**
     and pick the `manifest.json` inside the unzipped
     `ds-contracts-sync-runner/` folder.
  2. **From a clone:** `npm run plugin:zip`, then import
     `figma-sync/plugin-dist/manifest.json`. **Never import
     `figma-sync/plugin/manifest.json`** — that copy is a stub with no
     engine, and the plugin header will read "engine: NOT INJECTED".
     Full plugin guide: [figma-sync/plugin/GET-STARTED.md](../figma-sync/plugin/GET-STARTED.md).
- **A channel key** — only if you want the standing CI→Figma channel (path
  B's "designer clicks Check for updates" ending). `ds-contracts figma
  claim-channel` mints it once: a **write key** (a CI secret — it publishes)
  and a **read key** (the half you send the designer; it can never publish).
  Without a channel, the ad-hoc pairing code and the paste-the-JSON door
  both still work.

---

## Path A — design-first: Figma library → contracts → React/Storybook

**Situation.** A component set exists on the canvas — drawn by hand or built
by this tool — and you want real, typed code from it.

**Prerequisites.** Node ≥ 20; Figma desktop + the plugin. No browser
capture, no channel key.

*Without the plugin* (`npm run extract:figma:rest -- <figma-url>` with a
`FIGMA_TOKEN`): the REST route reads the same sets, but the kit's **variable
names and modes** come from `/v1/files/:key/variables/local`, which answers
only to a token minted with the **`file_variables:read`** scope ("Variables:
read" on the personal-access-token form — a token scope, *not* a plan tier).
Without it every binding degrades to its resolved literal, the proposals
mint `imported.*` tokens from those literals, and `captured.dtcg.json` is
not written. The CLI names the cause on stderr (`✖ variables: TOKEN SCOPE
MISSING … fix: regenerate the token with file_variables:read`), the dump
carries it in `_provenance.variables` and as a `variables-unavailable` row
in `_degradations`, and `figma-proposals.md` repeats it — a refusal naming no
scope, or a network failure, is named as exactly that instead. With the
scope, the dump carries `_variables` (values per collection mode, aliases
resolved) and propose writes `captured.dtcg.json` beside `minted.dtcg.json`,
the same as a plugin dump.

**The verbs.**

1. In the plugin, open the **Send** tab, select the set (or find it with
   *Scan this file*), and click **Read the set & diff**. The engine reads
   what is actually drawn: variants become props, layers become anatomy,
   bound variables become token refs.
2. Get the proposal into the repo — three doors, all reviewable: a **GitHub
   PR** (fine-grained token, session-only; the PR carries the full proposal
   envelope — the contract plus any auto-proposed stub contracts and minted
   token tree, under the same file names `propose-pr` writes, so `generate`
   accepts what lands; component code is emitted on the code side, by step 3
   or `ds-contracts propose-pr`), **Send to repo** (`ds-contracts figma
   receive --out contracts` prints a pairing code; nothing is written without
   `--apply`), or **copy the JSON out** and commit it yourself.
3. `ds-contracts generate <contract> --out src/generated --target react
   --tokens <your.dtcg.json> --stories` — deterministic; the same contract
   produces byte-identical output on any machine. `--tokens` takes flat
   files, a directory, or layered `slot=file` entries; a contract that
   fails to validate is refused by name while the rest are written.

**What lands where.** A typed TSX component, a CSS Module, and CSF3 stories
in your repo — plus `tokens.css` (every custom property the components
reference: `:root`, `[data-theme="dark"]`, `[data-brand=…]`), which the
emitted `index.ts` and stories import — plus the contract that produced them,
in the same change.

**Honest expectations.**

- **What it delivers, measured** ([24 §4](24-what-works.md), [§5](24-what-works.md)):
  **92.70% mean visual fidelity** over the 537 statically scorable variants of
  a 599-variant community kit (best set 98.0%, worst 81.2%); the
  canvas→code→canvas round trip **closes on 15 of 15** components with every
  one of 36,287 facts classified rather than dropped in silence; and the
  generate step is **byte-identical on any machine** — 291 generated files
  hashed against a golden manifest, no model in the path.
- **What it costs** ([23](23-known-limitations.md)): only the sets you import
  exist — the kit's un-imported sets do not appear as low scores, they do not
  appear; 62 of 599 rows are unscored and named as such (58 interaction-state,
  4 a carriage gap); and 31.4% of round-trip facts *matched* — "closes" is not
  "lossless", and the bucket-by-bucket accounting is
  [24 §6.3](24-what-works.md).
- **What "review" means here:** nothing writes without `--apply` or a PR.
  The PR body states the provenance — true round trip (a set this tool
  generated), inversion (a hand-built set), or no canvas provenance at all.
- **For a hand-built set, this is an inversion, not a reproduction.** A
  canvas cannot tell you about a `useEffect`, a keyboard handler, or *why* a
  value is what it is. Treat the output as a reviewable starting point and
  review it as new code.
- **"Provisional `imported.*` tokens" means: rename them.** Where the kit
  paints with unbound literals or non-token text styles, the proposal mints
  provisional tokens under `imported.*` names so the styling survives with
  mechanical names. They are placeholders for *your* vocabulary — rename
  them against your real token system; the proposal says so per token.
- **The measured round trip, on a real kit** ([the full report](../extract/figma/roundtrip-uui/REPORT.md)):
  all 15 Untitled UI sets that were run closed the loop, and the set-level
  fact diff across them is **11,400 matched · 1,857 diverged · 7,671 lost ·
  15,359 invented** — with 934 of the 954 `layout.mode` divergences
  reclassified as `auto-layout-inert` (a mode added to a frame whose
  children are all absolutely placed changes nothing that is drawn). Those
  are the honest proportions behind "reviewable starting point".
- **What will look broken but is a named limit:** absolute text widths are
  fallback-font widths wherever a library's capture config declares no
  `fonts` field (webfonts load only where configured — Altitude is, today);
  overlay components carry no hover/focus/active planes; a distinct row-gap
  is carried as a note, not a second gap. The inventory is
  [docs/23](23-known-limitations.md).

**The cost.** Minutes per set for the read; the real cost is the code
review, because the generated component is new code entering your repo.

**The end-to-end proof** that this path holds up against a design system
this project does not own: [examples/untitled-ui](../examples/untitled-ui/LEDGER.md)
— 15 sets driven through [uui-pipeline.mts](../examples/untitled-ui/uui-pipeline.mts),
with a pixel-fidelity score of **92.7% mean over 537 scored variants**
(best set 98.0%, worst 81.2%). Read its ledger's one-paragraph verdict: the
emitted React is a faithful *specification* and an *approximate* drawing.

---

## Path B — code-first: React/CSS → capture → contracts → Figma sets

**Situation.** Your components live in code; you want them in Figma as
native component sets — real variants, fills bound to variables — without
anyone redrawing them.

**Prerequisites.** Node ≥ 20; Chromium via `playwright-core` (for the
capture); Figma desktop + the plugin on the receiving side; optionally a
channel key for the standing publish channel.

**The verbs.**

```bash
npm i -g @ds-contracts/cli

ds-contracts onboard @acme/ui     # detect · sandbox · seed · draft · STOP
# …review the drafted capture config, then:
ds-contracts onboard --continue   # capture · promote · emit · bundle · publish
```

Delivery is any of: `figma publish` (standing channel; the designer clicks
**Check for updates** in the plugin's **Changes** tab), `figma push --code
<CODE>` (ad-hoc, both people online), or send the bundle JSON any way you
like — the designer pastes it into the **Build** tab and clicks *Generate in
this file*. The bundle is `ds-contracts figma bundle <contracts> --tokens …
--name <Collection>`, where `--tokens` is the same grammar `generate` uses
(flat files, a directory, or layered `primitives=…,semantic=…,brand.<name>=…`
with `--modes light,dark`); every contract is compiled before ✔ is printed
and a refusal is one named list. The run report on the designer's side lists
every code-only fact the canvas could not carry, per set.

**What lands where.** One variable collection plus one component set per
contract, on the designer's canvas, token-bound. Applying updates is
in-place: same node ids, same component keys, so placed instances keep
their component-property overrides.

**Honest expectations.**

- **What it delivers, measured** ([24 §3](24-what-works.md)): **86.6% mean
  computed-style equality** for a captured component, against the original npm
  package rendering in the same pinned Chromium — an exact string match over
  the browser's full longhand set, no tolerance, no whitelist, so a channel the
  pipeline never opened still counts against it. 116 components across nine
  libraries and six styling architectures: 85.9% cell-weighted over 737,162
  cells, 58 of 120 at ≥90%, 93 of 120 at ≥80%. Every one of the 116 is listed
  worst-first in [24 §3.1](24-what-works.md) — the worst is 50.0%.
- **What it costs** ([23](23-known-limitations.md)): hours of expert
  configuration per library (below), and breadth — see the coverage bullet.
- **The STOP is the design, not friction.** The drafted capture config
  carries `__review:*` markers on every field static source cannot infer —
  `classAllow`, `varPrefix`, `mount`, `fixedProps`. `onboard --continue`
  refuses an unreviewed config **by name**, and there is no flag that skips
  it, because a capture driven by a guessed mount measures the wrong thing
  and reports it with full confidence.
- **Static-only extraction may hand you blank components.** Without the
  browser capture, most styling methods yield API surface only; a stub
  anatomy is schema-valid and the emitter will faithfully build a correctly
  *named* set with **blank frames inside**. If your canvas sets come out
  empty, that is why, and the fix is the computed capture.
- **Coverage per library is partial, and it is the number that decides
  whether this is worth it.** Each foreign-library round in this repo
  committed between 5 and 31 components out of libraries of 46 to 243.
  On the *contracts committed* denominator that is about 4% to 23% per library
  ([docs/22 §8.3](22-generality.md)); on the stricter *components with a
  measured scorecard* denominator it is **2.3% to 23.0%**, and **8.0%** across
  all six libraries ([24 §2](24-what-works.md), which prints that table before
  any fidelity average, for exactly this reason). Data grid, tree, virtualized
  list, date picker, rich text and charts appear in **zero** committed
  contracts. Fidelity per *captured* component is high; breadth is the honest
  limit, and the 86.6% above describes only the tractable 11.1%.
- **What will look broken but is a named limit:** text wrapping is not
  implemented (a hugging text node inside a narrower fixed ancestor clips);
  webfonts load only where the library's capture config declares them
  (unconfigured libraries render fallback glyphs); overlay components
  declare `states: []` by design. Inventory:
  [docs/23](23-known-limitations.md).

**The cost.** Budget **hours per library** for the recon and the capture
config — the three judgment calls (`classAllow`, `varPrefix`,
axis-vs-state) fail *silently* when answered wrong, which is why the review
gate exists — then machine time for the capture itself. The recipe eight
library rounds actually followed is [docs/21](21-bring-your-own-design-system.md).

---

## Path C — reconcile: both exist, and they disagree

**Situation.** A mature Figma library your team drew by hand, a mature
codebase, and no idea how far apart they are.

**Prerequisites.** Node ≥ 20; Figma desktop + the plugin for the canvas
scan. No browser capture needed for the diagnostic loop.

**The verbs.**

1. **Scan the canvas side** — plugin **Send → Scan this file**: a read-only
   pass over every local component set, including ones this tool never
   made. Nothing is changed.
2. **Get the disagreement report** — `ds-contracts extract --reconcile`
   compares code-side contracts against a Figma dump and classifies every
   property: *agree*, *options-differ*, *code-only*, *design-only*.
3. **Hold the line** — `ds-contracts diff` in CI (exit `0` clean, `1` drift
   with findings named, `2` config error). The gap stops growing while you
   close it.

**What lands where.** A per-property, mechanical disagreement report — the
artifact that ends the "which one is right" argument — and a CI gate.

**Honest expectations — read this before choosing C.**

- **What it delivers:** a mechanical, per-property disagreement report and a CI
  referee — and **no fidelity number, because there is nothing rendered to
  score.** [24](24-what-works.md) carries no measurement for this path, and
  that is stated rather than filled in: its §7 is the list of questions no
  committed artifact answers. The one measured fact about path C is the *size*
  of the human work it hands you — see the next bullet.
- **What it costs** ([23](23-known-limitations.md)): the arbitration, and it is
  unassisted.
- **The reconciliation phase has NO tooling.** Stated plainly: there is no
  merge view, no CLI verb, no accept-left/accept-right surface — [docs/11's
  phase table](11-brownfield-adoption.md) marks Phase 2 as *NO TOOLING
  EXISTS*, and it is the phase you hit second. **Today, path C is "run A
  and B where each applies, and reconcile by hand":** a human reads
  `reconciliation.md` and hand-writes each contract from the decisions.
  The measured shape of that work on a real library: Shoelace's report is
  236 property decisions across 28 matched components — roughly 8 per
  component.
- **Reconciliation compares API surfaces only** — props, variants,
  defaults. Token and anatomy disagreement is out of its scope
  (the reconciliation-scope entry in
  [docs/23](23-known-limitations.md)).
- **Adopting a hand-built set is not a verb this tool has.** Stamping an
  existing Figma set as contract-backed so future syncs amend it in place
  does not exist; coexistence in a foreign kit is proven, amendment of
  hand-built sets is not (the adopting-a-hand-built-set entry in
  [docs/23](23-known-limitations.md)).

**The cost.** The scan and the report are minutes. The arbitration is the
real cost, it is human, and today it is unassisted.

---

## Where the other documents fit

- [README](../README.md) — the front door; its journey table points here.
- [docs/00-getting-started](00-getting-started.md) — the five-minute
  orientation.
- [docs/28 — Beta Tester Runbook](28-beta-runbook.md) — **if you are here to
  test this tool, start there**: all three paths with exact commands, success
  criteria, the named limitations each track will hit, honest time budgets,
  and the structured issue forms for reporting findings.
- [docs/17 — Run the Gauntlet](17-run-the-gauntlet.md) — paths B and A
  packaged as a runbook for an outside tester.
- [docs/21 — Bring Your Own Design System](21-bring-your-own-design-system.md)
  — the deep path-B recipe: capture configs, the decision guide, the
  troubleshooting table.
- [docs/13 — Try It With Your Own System](13-try-it-with-your-system.md) —
  the path-C walkthrough: extract, reconcile, diagnose.
- [docs/18 — User Flows](18-user-flows.md) — the same loop cut by
  *persona* (designer / engineer / lead), not by journey.
- [docs/29 — How It Flows](29-how-it-flows.md) — the mechanics under every
  path: the five hops, what each verb reads, writes and refuses, and how a
  fact ends up carried, named, or refused — never silently lost.
- [docs/24 — What Works](24-what-works.md) — the measured success side, every
  number carrying the artifact it was read from. Generated; `npm run
  capability:fresh` refuses it if it has gone stale.
- [docs/23 — Known Limitations](23-known-limitations.md) — its companion, and
  the longer of the two. Read it before committing to any path; read neither
  alone.
