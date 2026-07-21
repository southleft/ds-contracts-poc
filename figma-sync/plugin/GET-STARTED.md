# DS Contracts Sync Runner — get started

A Figma plugin that builds your component library **from contracts**, deterministically.
Paste a contract, click Generate — the plugin emits and runs the sync locally, so the
canvas is a pure, byte-reproducible function of the contract. **No AI is in the
conversion.** (AI may author contracts or build this tooling; it never runs the sync.)

---

## Install

### Option A — from the Figma Community (once published)
Search "DS Contracts Sync Runner" in Community → **Install**. Normal one-click install.
See [PUBLISHING.md](./PUBLISHING.md) to publish it.

### Option B — dev install (works today, no publishing needed)
1. Download/clone the packaged build (the `ds-contracts-sync-runner/` folder, or unzip
   `playground/public/ds-contracts-sync-runner-plugin.zip`).
2. In Figma desktop: **Plugins → Development → Import plugin from manifest…**
3. Select `ds-contracts-sync-runner/manifest.json`.
4. It now appears under **Plugins → Development → DS Contracts Sync Runner**.

---

## The deterministic path: contract → canvas (30 seconds)

1. Open a **blank** Figma design file (fresh files need token variables — the plugin
   seeds them).
2. Run **DS Contracts Sync Runner** → **Generate** tab.
3. Paste a contract into the box. Two to try:
   - **Simple:** paste `contracts/badge.contract.json` → builds a Badge variant set.
   - **Advanced:** paste `examples/depth-composite/composite-modal.contract.json` → builds
     a multi-root Modal whose body composes a Card instance and a repeated Badge row. The
     plugin resolves the child components (Card, Badge, Avatar, Button) from its baked
     repo contracts and builds them dependency-ordered, tokens first — **you paste one
     contract.**
4. Leave **"Sync token variables first"** checked. Click **Generate in this file.**

That's it. The set appears, token-bound, styled, identity-marked. Run it again → the same
bytes. Because it's a function of the contract, not a guess.

## The round-trip: canvas → contract (the other direction)

1. Edit a generated set on the canvas (add a variant, tweak a prop).
2. **Propose** tab → the plugin dumps the set and diffs it against its contract, in plain
   words, then exports the proposed contract diff (or opens a PR with a fine-grained
   token — session-only, never stored).

Both directions run the same deterministic engine (`window.DSC`) — the CLI
(`ds-contracts extract` / `generate`) runs the identical functions outside Figma.

---

## Why a plugin (and not an AI agent)?

The conversion must be deterministic. Running the emitter requires a runtime inside
Figma; the plugin **is** that runtime — it holds the engine and takes a small contract as
input. An AI agent shuttling the render would (a) reintroduce non-determinism and (b) hit
payload limits. The plugin keeps the whole conversion a pure function. That is the point.
