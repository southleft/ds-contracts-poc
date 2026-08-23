# DS Contracts Sync Runner — get started

A Figma plugin that builds your component library **from contracts**, deterministically.
Paste a contract, click Generate in this file — the plugin emits and runs the sync locally, so the
canvas is a pure, byte-reproducible function of the contract. **No AI is in the
conversion.** (AI may author contracts or build this tooling; it never runs the sync.)

---

## Install

The plugin is **not on the Figma Community, by decision** (see docs/18, gap
G0 — Community publication may never happen; [PUBLISHING.md](./PUBLISHING.md)
stays as the checklist if that decision is ever revisited). There are exactly
two real routes, and both need the **Figma desktop app** — development
plugins never load on figma.com. Any plan works; no admin approval needed.

### Route A — download the zip from the playground (no clone)
1. Download
   [ds-contracts-playground.pages.dev/ds-contracts-sync-runner-plugin.zip](https://ds-contracts-playground.pages.dev/ds-contracts-sync-runner-plugin.zip)
   (also linked from the playground's plugin panel) and unzip it.
2. In Figma desktop: **Plugins → Development → Import plugin from manifest…**
3. Select the `manifest.json` inside the unzipped `ds-contracts-sync-runner/`
   folder.
4. It now appears under **Plugins → Development → DS Contracts Sync Runner**.
   Note: an unzipped copy goes stale when the repo's core changes —
   re-download after updates, or use Route B, whose import stays pointed at a
   folder `plugin:zip` refreshes in place.

### Route B — from a clone of this repo
1. In the repo: `npm run plugin:zip`. This packages the zip **and** refreshes the
   unpacked dev folder `figma-sync/plugin-dist/`.
2. In Figma desktop: **Plugins → Development → Import plugin from manifest…**
3. Select `figma-sync/plugin-dist/manifest.json`. **Import from this folder — never
   from `figma-sync/plugin/` directly** — that copy is a stub with no engine, and
   the plugin header will read **"engine: NOT INJECTED"**.
4. It now appears under **Plugins → Development → DS Contracts Sync Runner**.

**After any repo update: re-run `npm run plugin:zip`.** The import stays pointed at
`plugin-dist/`, so the refreshed engine is picked up the next time the plugin opens —
no re-import needed. The plugin header shows the running engine's build stamp
(`engine <hash> · <bytes>B`); it must match the `plugin:zip` output. If it reads
"NOT INJECTED", you imported the stub.

---

## The deterministic path: contract → canvas (30 seconds)

1. Open a **blank** Figma design file (fresh files need token variables — the plugin
   seeds them).
2. Run **DS Contracts Sync Runner** → **Build** tab.
3. Paste a contract into the box. Two to try:
   - **Simple:** paste `contracts/badge.contract.json` → builds a Badge variant set.
   - **Advanced:** paste `examples/depth-composite/composite-modal.contract.json` → builds
     a multi-root Modal whose body composes a Card instance and a repeated Badge row. The
     plugin resolves the child components (Card, Badge, Avatar, Button) from its baked
     repo contracts and builds them dependency-ordered, tokens first — **you paste one
     contract.**
4. Click **Generate in this file.** (Token variables always sync first — the old opt-out checkbox was removed.)

That's it. The set appears, token-bound, styled, identity-marked. Run it again → the same
bytes. Because it's a function of the contract, not a guess.

## Foreign libraries: one JSON bundle (contracts + tokens)

A foreign library (MUI, Tailwind, your own) doesn't use the repo's baked tokens — so its
bundle **carries its own token set**. The CLI packages everything into one file:

```bash
npx @ds-contracts/cli figma bundle <contracts-dir> \
  --tokens <base.dtcg.json[,minted.dtcg.json]> \
  [--modes <light.json[,dark.json]>] --name <Collection> --out my-library.bundle.json
```

Paste that single JSON into the **Build** tab. The plugin syncs the token set first —
one variable collection named after the library, Light/Dark modes, Figma-native
variable aliases for minted `{alias}` leaves — then builds every component set bound to
it. **JSON is the only thing you ever paste**; there is no script step. Try it:
`examples/mui/figma/mui.bundle.json` builds the MUI library (5 sets, 121 variants,
982 variables) on a blank file in one paste.

The bundle's `tokenSet` shape (the CLI writes it; refusals in the plugin restate it):

```jsonc
{
  "type": "CONTRACTS-BUNDLE",
  "version": 1,
  "tokenSet": {
    "name": "MUI",                                  // Figma variable-collection name
    "base": { "<token>": { "$type": "…", "$value": "…" } },   // flat DTCG
    "modes": { "light": { … }, "dark": { … } },     // optional per-mode overrides
    "minted": { … }                                 // optional nested DTCG tree;
  },                                                //   "{alias}" leaves alias base tokens
  "contracts": [ … ]
}
```

Contracts in such a bundle resolve their token refs against `base` + `minted` — a ref
outside both is refused by name, exactly like a repo contract referencing an unknown
repo token.

## The round-trip: canvas → contract (the other direction)

1. Edit a generated set on the canvas (add a variant, tweak a prop).
2. **Send** tab → the plugin dumps the set and diffs it against its contract, in plain
   words, then exports the proposed contract diff (or opens a PR with a fine-grained
   token — session-only, never stored).

Both directions run the same deterministic engine (`window.DSC`) — the CLI
(`ds-contracts extract` / `generate`) runs the identical functions outside Figma.

**Running the raw dump script instead of the Send tab.** `extract/figma/
dump.plugin.js` ships with `const TARGET_SETS = [];` — empty means every local
set/component on every page except the Slot utility, narrowed to your current
selection when you have sets selected. It prints the set names it dumped and
lists them in `_provenance.sets`. Put names in the array to scope it, and a
name the file does not have makes the dump **refuse by name** (it never
returns a quiet partial). The plugin's own **Send** flow rewrites that list at
runtime to the set you picked. (Until 2026-08-22 the shipped default was the
repo's three fixture names, so the pasted script dumped `Badge`/`Switch`/
`Card` and nothing of yours.)

---

## Why a plugin (and not an AI agent)?

The conversion must be deterministic. Running the emitter requires a runtime inside
Figma; the plugin **is** that runtime — it holds the engine and takes a small contract as
input. An AI agent shuttling the render would (a) reintroduce non-determinism and (b) hit
payload limits. The plugin keeps the whole conversion a pure function. That is the point.
