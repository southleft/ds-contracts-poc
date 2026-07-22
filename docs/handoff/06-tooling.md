---
title: "Tooling — concrete tools and commands"
doc_id: 06-tooling
audience: "Another AI platform with ZERO prior knowledge of this project"
status: authoritative
last_updated: 2026-07-21
reading_order: 6
prerequisites: [04-users-and-journeys, 05-architecture]
related: [09-testing-and-gates, 12-reference]
---

# Tooling and commands

All commands verified against `package.json` / `packages/cli` on 2026-07-21.
Every tool here is deterministic (no AI in the conversion).

## The CLI — `@ds-contracts/cli` (bin `ds-contracts`)

Run from the repo via `npx tsx packages/cli/src/cli.ts <verb> …`, or once
published, `npx @ds-contracts/cli` / a global install.

| Verb | Purpose |
|------|---------|
| `init` | write `ds-contracts.config.json` (the `ExtractConfig` shape + generate targets) |
| `extract` | code → contract (react-tsx + cem adapters); `extract --computed --harness <dir>` uses the computed-capture floor |
| `generate <contracts..> --out <dir> [--target react\|html\|<plugin>] [--stories]` | contract → code (+ optional Storybook story) |
| `figma <contracts..> --out <dir>` | emit Figma Plugin-API sync scripts |
| `figma push <bundle-or-contract.json> --code <CODE> [--bridge <url>]` | send a CONTRACTS-BUNDLE to the plugin over the pairing bridge |
| `diff` | parity differ (code/design vs contracts; CI exit codes) |
| `propose-pr <contract-diff> --repo --token` | open a GitHub PR (fine-grained token, session-only, never stored) |

## The plugin — DS Contracts Sync Runner (the `contract → canvas` vehicle)

The plugin **is** the deterministic Figma runtime: the engine (`window.DSC`) is
baked in, so you feed it a small contract and it emits + builds locally.

- **Install (dev):** Figma desktop → Plugins → Development → Import plugin from
  manifest → select `figma-sync/plugin/` (or the unzipped
  `playground/public/ds-contracts-sync-runner-plugin.zip`). A clean-install /
  publishing guide is at `figma-sync/plugin/GET-STARTED.md` and
  `figma-sync/plugin/PUBLISHING.md`.
- **The deterministic core path (Generate tab):** paste a contract JSON (or a
  CONTRACTS-BUNDLE) → "Sync token variables first" (checked) → **Generate in this
  file**. It resolves child components from the baked repo contracts, plans
  tokens-first + dependency-ordered, and builds the set. **No network, no AI.**
- **Other tabs:** *Update library* (receive a bundle, plain-words change report,
  amend in place), *Propose* (dump the drawn set → contract diff → export/PR),
  *Paste a script*, *Send to Playground*, *Local runner*.
- **Build the packaged zip:** `node scripts/build-plugin-zip.mjs` (add
  `--update-engine-receipt` only when core changed, deliberately).

## Key npm scripts (deterministic tooling)

| Script | What it does |
|--------|--------------|
| `npm run build` | `tokens` → `schema` → `generate` (the full deterministic build) |
| `npm run figma:plan` | emit all `figma-sync/*.js` scripts (contract → canvas scripts) |
| `npm run eval` | run the 146-check suite (`evals/run.ts`) |
| `npm run plugin:check` | headless plugin-engine gate (`plugin-engine-check.mjs`) |
| `npm run plugin:zip` | build the plugin package |
| `npm run golden:update` | regenerate the golden manifest (reviewed changes only) |
| `npm run emitters:check` | emitter registry/invariants gate |
| `npm run extract:code` / `roundtrip:code` | code → contract (+ round-trip) |
| `npm run extract:figma` / `extract:figma:roundtrip` | Figma dump → contract |
| `npm run extract:figma:gauntlet` | the 1,618-set census through the receive pipeline |
| `node scripts/deterministic-roundtrip.mjs` | the determinism proof (run twice → byte-identical) |
| `node scripts/core-browser-check.mjs` | proves the core barrel is browser-pure/bundleable |

There are many more `extract:figma:*:check` scripts — each is a receipt for a
specific extraction class (dialog, composite, cross-import, part-state, tooltip,
overlap, repeat, theme, canvas). See `package.json` for the full list.

## Pairing bridge (optional, for `figma push`)

A stateless Cloudflare worker (`ds-contracts-assist.southleft-llc.workers.dev`)
is a dumb pipe: the plugin mints/enters a 6-char code, the CLI `figma push`
POSTs a CONTRACTS-BUNDLE to it, the plugin polls and receives (deliver-once,
15-min TTL). Contract contents are never inspected by the bridge. This is only a
*transport* — the conversion still happens deterministically in the plugin.

## MCP tools available in the dev environment (for building/verifying only)

These are used to *build and verify* the tooling — never as the conversion:

- **figma-console** (`figma_execute`, `figma_capture_screenshot`, …) — runs
  Plugin-API JS in a connected desktop file via the Desktop Bridge plugin.
  Flaky (~3 calls before dropping); globals persist across calls; sandbox `fetch`
  is blocked; ~50KB payload ceiling. Good for *inspecting* live nodes, not for
  running the 288KB emitter.
- **claude.ai Figma MCP** (`use_figma`, `get_design_context`, `get_metadata`,
  `get_screenshot`) — hosted. `use_figma` is the same execution model as
  `figma_execute` (Plugin-API JS, 50KB cap, stateless). The read tools
  (`get_metadata`, `get_screenshot`) are a reliable way to *verify* a canvas.

Continue to `07-status-what-works.md` and `08-status-what-doesnt-work.md`.
