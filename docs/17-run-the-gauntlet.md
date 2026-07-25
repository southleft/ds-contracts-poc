# 17 — Run the Gauntlet

*The to-and-from sequence, packaged for someone who has never seen this repo —
run it against your own component codebase, then try to break it.*

This is the runbook for an outside tester (hi, Connor). It gives you the two
sequences that work **today**, the exact commands, what "working" is supposed
to look like, and — defect-first — the honest list of what is *not* ready, so
you know the difference between "you found a bug" (please report it!) and
"you found a named gap."

Prereqs: Node 20+, a Figma file you can run plugins in, and the DS Contracts
plugin (see [`plugin/GET-STARTED.md`](../plugin/GET-STARTED.md) for install —
it's a one-time manifest import).

---

## Sequence A — your code → contracts → a Figma library (one paste)

This is the direction that replaces agentic extract flows: your components
become schema-valid contracts, and the contracts build a real Figma library —
component sets, variants, bound variables — **deterministically. No model is
invoked anywhere in this sequence**; run it twice and you get the same bytes.

### A1. The supported fast path (React + CSS Modules, or any CEM library)

From *your* repo (no clone of this one needed):

```bash
npx @ds-contracts/cli init      # writes ds-contracts.config.json — point it at your src
npx @ds-contracts/cli extract   # → proposed contracts + a report of every unbound value
```

Read the report before anything else: extraction **proposes and refuses** —
raw values it can't bind to tokens are listed with nearest-token candidates,
never invented. That report is the tool telling you the truth about your own
codebase; if it's noisy, that's a finding about the code, not a malfunction.

Then emit the Figma sync scripts and paste:

```bash
npx @ds-contracts/cli figma <your-contracts-dir> --out ./figma-sync --tokens <your-dtcg.json>
```

Open a blank Figma file → DS Contracts plugin → **Paste a script** tab →
paste a generated `*.figma.js` → Run. Tokens script first if one was emitted
(variables must exist before components bind them). Re-running a script
amends in place — same node ids, no duplicates.

### A2. The advanced path (runtime styling: Emotion, StyleX, …)

If your components ship no static CSS, extraction runs through the
**computed-capture floor**: your package is rendered in a pinned headless
Chromium and the browser's computed truth becomes the contract, with a
per-styling-method *reader* upgrading anonymous values to your own token
names. This path works — it's how `examples/mui/` (Emotion) and
`examples/astryx/` (StyleX) were built, gates and all — but **authoring the
capture config is currently expert work** (axis selection, class-identity
grammar, state props). Follow `examples/mui/PROVENANCE.md` as the template;
budget real time; or hand me the repo and I'll write the config with you.

**What success looks like:** a variable collection + one component set per
contract, each set on its own page in a labeled section; variant grids
matching your prop axes; fills/radii/spacing bound to variables (inspect a
fill and follow the alias). For the reference experience without your own
code, paste `examples/mui/figma/GENESIS-BATCH.figma.js` into a blank file:
MUI's default theme, 5 sets, 121 variants, 912 variables, ~30 seconds.

## Sequence B — canvas → contract → code

The reverse leg, for a component that exists (or was just built) on canvas:

```bash
npm run extract:figma           # canvas dump → PROPOSED contract (in this repo)
npx @ds-contracts/cli generate <contract> --out ./generated --target react --stories   # contract → React + story
```

The emitted component imports the generated prop contract and stylesheet,
renders the anatomy tree, and binds `{token}` refs as custom properties from
the DTCG export. A Storybook story rides along. The round trip is gated:
`scripts/deterministic-roundtrip.mjs` chains contract→canvas→contract→code
and asserts byte-identical node trees across runs.

**The dev door (no GitHub):** a designer's proposed change can also land
straight in a developer's working tree. Run
`npx @ds-contracts/cli figma receive --out contracts` — it prints a
6-character pairing code; the designer enters it in the plugin's Propose tab
under **Send to repo**, and the proposal arrives as a unified diff in your
terminal plus a saved artifact in `contracts/.proposals/`. Nothing is
written to a contract file without `--apply`, and even then git stays
yours — every change enters the repo as a reviewed change
([doc 16](16-sync-boundary.md)).

## What to throw at it (the actual gauntlet)

In rough order of expected pain:

1. A clean React + CSS Modules component (should just work — baseline).
2. A component with a gnarly variant space (5+ enum axes; the emitter caps
   full-cartesian at 512 and switches to per-axis+pairwise with a receipt).
3. A web-component library with a CEM manifest.
4. Something Emotion- or vanilla-extract-styled (path A2 — config authoring).
5. Your worst component: wrapper-div soup, business logic mixed into render,
   inline styles. **Expected behavior is named refusal, not garbage output** —
   if it silently produces something wrong instead of refusing loudly,
   that's the most valuable bug report you can file.

## Honest gaps — known, named, not yet built

- **Brownfield write-back is v1-partial.** Canvas-edit → patch-your-real-repo
  exists as *provenance anchors* only (`contracts/*.anchors.json` — each
  source-bound fact knows its declaring CSS rule). The patch engine that
  consumes anchors, and file:line anchors from the static readers, are the
  next named rounds. Today the reverse leg emits fresh code (Sequence B), it
  does not patch existing files.
- **State fidelity is partial.** Default-state rendering is gated per
  library (73–100% computed equality, every residual named in the example
  PROVENANCE files); hover/active/focus rounds are captured but not fully
  carried into genesis.
- **Computed-floor config authoring is expert-level** (see A2). Making
  `config init` scaffold this from a package name is on the roadmap.
- **Styling readers cover 4 methods** (CSS Modules, StyleX, Emotion/CSS-vars,
  CEM). Anything else degrades gracefully — correct pixels, literal token
  names — per the sync-boundary rules ([doc 16](16-sync-boundary.md)).
- **Pixel-level AA parity** is a known open metric class; computed-equality
  is the current floor gate.

## Reporting findings

Defect-first, please: what you ran, what you expected, what happened, and
the exact command. "It refused and told me why" is working as intended;
"it produced output that looks right but isn't" is the bug class we care
about most — that's the one deterministic systems exist to kill.
