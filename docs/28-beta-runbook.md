# 28 — Beta Tester Runbook

*You have never seen this repo. This page gets you through one full journey,
tells you exactly what you are supposed to see, names the walls you WILL hit
before you hit them, and gives you a structured place to file what you find.*

> **How this page relates to the others:** [docs/00 — Choose Your Path](00-choose-your-path.md)
> is the canonical statement of the three journeys; [docs/17 — Run the Gauntlet](17-run-the-gauntlet.md)
> is the engineer-facing stress-test sequence this page was forked from. If
> this page disagrees with docs/00 about what a path is, docs/00 wins and the
> disagreement is a bug — [report it](https://github.com/southleft/ds-contracts-poc/issues/new/choose).

## Pick your track

| Track | Your situation | Direction | Budget |
|---|---|---|---|
| **A — design-first** | components exist in **Figma**, you want typed React | canvas → contract → code | **minutes per set** to read; the real cost is reviewing the generated code |
| **B — code-first** | components exist in **code**, you want them in Figma | code → capture → contract → canvas | **hours per library** for recon + capture config (this is the honest price — see below), then machine time |
| **C — reconcile** | both exist, and they disagree | both → disagreement report | **minutes** for the scan and report; the arbitration is human and unassisted |

Two rules apply everywhere:

1. **Nothing writes silently.** No contract file changes without `--apply` or a
   PR; nothing lands on canvas without a human clicking Apply/Generate.
2. **Refusal is a feature.** If the tool stops with a named message, that is
   working as intended. The bug class this project cares about most is the
   opposite: **output that looks right but isn't**. If you find one of those,
   you have found the most valuable report you can file.

## Before anything: the two documents that price this tool

- [docs/24 — What Works](24-what-works.md) — every measured success, with the
  artifact each number was read from.
- [docs/23 — Known Limitations](23-known-limitations.md) — everything it cannot
  do, with a section ID per limitation (§A.x irreducible, §B.x not built yet,
  §C.x the measured price). **The bug form asks you to check this list first**
  — a named limitation is still worth a report (it tells us the docs did or
  did not prepare you), but it is filed differently than a defect.

## Prerequisites (all tracks)

- **Node ≥ 20.**
- **The Figma DESKTOP app** for any track that opens the plugin. This is a
  named constraint, not an oversight: the plugin is distributed as a
  development-plugin manifest import (an owner decision — it is *not* on the
  Figma Community), and **development plugins load only in the desktop app,
  never on figma.com** ([docs/23 §A.4](23-known-limitations.md)).
- **The Sync Runner plugin**, one of two ways:
  1. **No clone:** download
     [the packaged zip](https://ds-contracts-playground.pages.dev/ds-contracts-sync-runner-plugin.zip),
     unzip, then Figma desktop → **Plugins → Development → Import plugin from
     manifest…** → pick the `manifest.json` inside `ds-contracts-sync-runner/`.
  2. **From a clone:** `npm run plugin:zip`, then import
     `figma-sync/plugin-dist/manifest.json`. **Never import
     `figma-sync/plugin/manifest.json`** — that copy is an engine-less stub and
     will announce itself with "engine: NOT INJECTED" in the plugin header.
- **Track B only:** a Chromium via `playwright-core` for the computed capture.
  If none is found the capture verb — only that verb — stops with a named
  message and exit code 3 telling you the fix.

---

## Track A — design-first: a Figma set → typed React in your repo

**Prerequisites:** Node ≥ 20; Figma desktop + the plugin. No browser capture,
no channel key.

**The commands:**

1. In the plugin, open the **Send** tab, select a component set (or find one
   with *Scan this file*), click **Read the set & diff**. Variants become
   props, layers become anatomy, bound variables become token refs.
2. Get the proposal into a repo — any of three reviewable doors:
   - **GitHub PR** (fine-grained token, session-only), or
   - **Send to repo:** in a terminal, `npx @ds-contracts/cli figma receive
     --out contracts` prints a 6-character pairing code; enter it in the
     plugin's **Send** tab under **Send to repo**. The proposal arrives as a
     unified diff; nothing is written without `--apply`.
   - **Copy the JSON out** and commit it yourself.
3. Generate the code:

   ```bash
   npx @ds-contracts/cli generate <contract> --out src/generated \
     --target react --tokens <your.dtcg.json> --stories
   ```

**What success looks like:** a typed TSX component, a CSS Module, and CSF3
stories in your repo, plus the contract that produced them. Generation is
deterministic — run it twice, get identical bytes. The measured bar for this
direction on a real community kit is **92.7% mean over 537 scored variants**
([docs/24 §4](24-what-works.md)): a faithful *specification*, an *approximate*
drawing.

**Named limitations you WILL hit** (check before filing a bug):

| You observe | It is | ID |
|---|---|---|
| a hand-built set produces code with `imported.*` token names | provisional minted tokens — placeholders for your vocabulary; rename them | [docs/00 path A](00-choose-your-path.md) |
| text widths slightly off; long labels clip or overflow | webfonts load only where the library's capture config declares a `fonts` field (unconfigured libraries render fallback-font widths), and text wrapping is not implemented | [§C.5](23-known-limitations.md) · [§B.3](23-known-limitations.md) |
| no `useEffect`, keyboard handlers, or business logic in the output | a canvas cannot carry them — the contract holds canvas-expressible facts only | [§A.3](23-known-limitations.md), [docs/16](16-sync-boundary.md) |
| the round trip is not lossless | correct — it *closes* (every fact lands in a named bucket); the accounting is public | [docs/24 §6.3](24-what-works.md) |

**Time budget:** minutes per set for the read and generate. The real cost is
the code review — treat the output as new code entering your repo, because it
is.

---

## Track B — code-first: your components → native Figma sets

**Prerequisites:** Node ≥ 20; Chromium via `playwright-core`; Figma desktop +
the plugin on the receiving side.

**The commands** — the supported fast path (React + CSS Modules, or any CEM
library), from *your* repo, no clone needed:

```bash
npx @ds-contracts/cli init      # writes ds-contracts.config.json — point it at your src
npx @ds-contracts/cli extract   # → proposed contracts + a report of every unbound value
```

Read the extraction report before anything else: raw values that can't bind to
tokens are listed with nearest-token candidates, **never invented**. A noisy
report is a finding about the code, not a malfunction.

Then package and deliver:

```bash
npx @ds-contracts/cli figma bundle <your-contracts-dir> \
  --tokens <base.dtcg.json[,minted.dtcg.json]> \
  [--modes <light.json[,dark.json]>] --name <YourLibrary> --out ./my-library.bundle.json
```

Open a blank Figma file → plugin → **Build** tab → paste the bundle JSON →
**Generate in this file**. Re-running amends in place — same node ids, no
duplicates.

Or run the guided two-phase version, which drives the same pipeline and stops
for the one review a human must do:

```bash
npm i -g @ds-contracts/cli
ds-contracts onboard @your/package   # detect · sandbox · seed · draft · STOP
# …review the drafted capture config, then:
ds-contracts onboard --continue      # capture · promote · emit · bundle · publish
```

**What success looks like:** one variable collection plus one component set
per contract, each set in a labeled section; variant grids matching your prop
axes; fills/radii/spacing bound to variables (inspect a fill and follow the
alias). For the reference experience without your own code, paste
`examples/mui/figma/mui.bundle.json` from a clone into the **Build** tab —
5 sets, 121 variants, ~30 seconds. The measured bar per captured component is
**86.7% mean computed-style equality** against the original npm package
rendering ([docs/24 §3](24-what-works.md)).

**THE WALL YOU ARE MOST LIKELY TO HIT — blank frames ([§B.15](23-known-limitations.md)).**
Static extraction (no `--computed`) always yields your API surface; whether it
also yields **anatomy** depends on how your library is styled. React + CSS
Modules: best-effort anatomy. StyleX: structure only. **Tailwind, Emotion,
styled-components, any runtime styling, or any CEM library: API surface only**
— the anatomy is the stub `{"root": {}}`, which is schema-valid, so the set
builds as a correctly *named* component with the right variant axes and
**blank frames inside**. This is not silent anymore: `figma bundle`,
`publish`, and `receive --apply` **refuse** a stub contract by the name
`drawable-empty`, and the per-contract script emitter **warns** at emit time
listing each stub. The fix is the computed capture (`extract --computed`, or
`onboard`, which runs it for you).

**The second wall — the capture config is expert work ([§B.16](23-known-limitations.md)).**
The drafted config carries `__review:*` markers on every field static source
cannot infer (`classAllow`, `varPrefix`, `mount`, `fixedProps`), and
`onboard --continue` refuses an unreviewed config by name — there is no skip
flag, because these three judgment calls **fail silently when answered
wrong**. [docs/21](21-bring-your-own-design-system.md) is the recipe eight
library rounds actually followed, including the decision guide;
[examples/mui/PROVENANCE.md](../examples/mui/PROVENANCE.md) is the worked
template for a runtime-styled library.

**Honest time budget** ([docs/00 path B](00-choose-your-path.md),
[§B.19](23-known-limitations.md)): **hours per library** for the recon and the
capture config, before machine time. Seed contracts are authored per component
(roughly 65 lines each, hand-written, in the measured rounds; `seed:gen`
generates reviewable drafts from your library's types). Coverage will be
partial: the measured rounds committed between 5 and 31 components per
library. Budget for a *slice*, not your whole library, on a first pass.

**Other named limitations you may hit:**

| You observe | It is | ID |
|---|---|---|
| Dialog/Menu/Tooltip land with correct colors but no token names | overlays lose source token names | [§B.1](23-known-limitations.md) |
| an overlay set has a Default variant and no hover/focus/active, while Button has four | overlay contracts declare `states: []` **by design** — the state planes do not exist in the captured truth | [§B.2](23-known-limitations.md) |
| long labels clip; tab/button widths subtly wrong, tracking word length | text wrapping not implemented + fallback-font widths | [§B.3](23-known-limitations.md) · [§C.5](23-known-limitations.md) |

---

## Track C — reconcile: both exist, and they disagree

**Prerequisites:** Node ≥ 20; Figma desktop + the plugin. No browser capture.

**The commands:**

1. **Scan the canvas side** — plugin **Send → Scan this file**: read-only,
   over every local set, including ones this tool never made.
2. **Get the disagreement report** — `ds-contracts extract --reconcile`
   classifies every property: *agree*, *options-differ*, *code-only*,
   *design-only*.
3. **Hold the line** — `ds-contracts diff` in CI (exit `0` clean, `1` drift
   with findings named, `2` config error).

**What success looks like:** a per-property, mechanical disagreement report —
the artifact that ends the "which one is right" argument — and a CI gate that
stops the gap growing. There is **no fidelity number for this track**; nothing
is rendered to score.

**Named limitations — read these BEFORE choosing C:**

| Fact | ID |
|---|---|
| The reconciliation phase itself has **no tooling** — no merge view, no accept-left/accept-right. A human reads the report and hand-writes each contract. Measured shape of that work on Shoelace: 236 property decisions across 28 matched components — roughly 8 per component. | [docs/11](11-brownfield-adoption.md) |
| Reconciliation compares **API surfaces only** — props, variants, defaults. Token and anatomy disagreement is out of scope. | [§B.12](23-known-limitations.md) |
| **Adopting a hand-built Figma set is not a verb this tool has** — stamping an existing set as contract-backed so future syncs amend it in place does not exist. | [§B.11](23-known-limitations.md) |

**Time budget:** the scan and the report are minutes. The arbitration is the
real cost, it is human, and today it is unassisted.

---

## If you cloned this repo: the first `npm run parity` is red ON PURPOSE

A fresh clone's `npm run parity` will likely report `snapshot-stale` findings
and nothing else. The design-side inputs are committed Figma snapshots, and
the differ refuses to trust one older than 14 days (`MAX_SNAPSHOT_AGE_DAYS`)
— **by design**, because an untouched snapshot would otherwise report green
forever. The parity output itself now says so when staleness is the only
finding class. Contract↔code and contract↔token checks still run and should
be clean. Details: [README §Working in this repository](../README.md) ·
[docs/25 — Reading a Red CI](25-reading-a-red-ci.md).

---

## Reporting what you find

Defect-first, please: what you ran, what you expected, what happened, the
exact command, and — if the run produced one — the path to the receipt,
scorecard, or report file it wrote. Three structured forms:

- **[Bug report](https://github.com/southleft/ds-contracts-poc/issues/new?template=bug-report.yml)**
  — keyed to your journey and to the docs/23 limitation IDs, so a named gap
  and a new defect are distinguishable on arrival.
- **[Capture-config question](https://github.com/southleft/ds-contracts-poc/issues/new?template=capture-config-question.yml)**
  — Track B's expert-work wall (§B.16): stuck on `classAllow`, `varPrefix`,
  `mount`, axis-vs-state, or a refused review gate.
- **[Fidelity report](https://github.com/southleft/ds-contracts-poc/issues/new?template=fidelity-report.yml)**
  — "it generated, but it doesn't look right": carries the scorecard/receipt
  path so the number travels with the claim.

Remember the ranking: *"it refused and told me why"* is working as intended;
*"it produced output that looks right but isn't"* is the bug class
deterministic systems exist to kill — file that one first.
