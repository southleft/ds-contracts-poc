# 5 · Figma Sync (Phase 2 executed · Phase 3 planned)

How the same contracts that generate code also generate — and will continuously validate — the Figma side. **Phase 2 ran on July 3, 2026** (results below). All figma-console-mcp capabilities cited were verified against its source (v1.33.x, July 2026).

**Target file:** [DS Contracts POC](https://www.figma.com/design/8nim1d0IPnehMxA7B7SYxC/DS-Contracts-POC) (`fileKey: 8nim1d0IPnehMxA7B7SYxC`).

## Phase 2 results (executed July 3, 2026)

`npm run figma:plan` (`scripts/generate-figma.ts`) reads `tokens/` + `contracts/` and emits deterministic Plugin API scripts into `figma-sync/`. Those scripts are **transport-agnostic** — they run unchanged through any tool that executes Plugin API JS in the file. This run used the official Figma MCP's `use_figma` (the figma-console session had dropped); replaying them through figma-console's `figma_execute` is equivalent.

| Script | Result |
|---|---|
| `01-tokens.js` | **Primitives** collection (mode `Value`, 56 variables) + **Semantic** collection (modes `Light`/`Dark`, 36 variables), aliases mirroring the DTCG graph, scopes set per type, `codeSyntax.WEB` = the generated CSS custom property names |
| `02-badge.js` | `Badge` component set — 4 variants, properties `Variant`, `Label` (TEXT). nodeId `6:10`, key `89f1fb…` |
| `03-button.js` | `Button` component set — 9 variants (3×3), properties `Variant`, `Size`, `Label` (TEXT), `Disabled` (BOOLEAN). nodeId `5:21`, key `1b5d2a…` |

Node IDs and component-set keys were **written back into each contract's `anchors.figma`** — from here on, parity matches by anchor, not by name. Scripts are idempotent-safe: the token script upserts; component scripts skip (returning the existing id/key) if a set with the same name exists. To rebuild a set from a changed contract, delete it in Figma and re-run.

**Fidelity notes from the run (all deliberate):**
- `fontSize` is not variable-bindable in the Plugin API — set numerically from the resolved token value. Same for font family/weight (static Inter Medium).
- The `Disabled` BOOLEAN property is declared for API parity but not visually linked; interaction states (hover/focus/disabled) are CSS-side concerns, not represented as Figma variants.
- Visual verification: section screenshot matches the Storybook Matrix stories (colors, padding scale, radii, type scale) in light mode.

## Bridge setup for figma-console-mcp (one-time)

The MCP talks to Figma through a **companion plugin over WebSocket** (ports 9223–9232), not Chrome DevTools — writes execute Plugin API JavaScript inside Figma's sandbox. This deliberately avoids the Variables **REST** API, which is Enterprise-plan-only; the Plugin API path works on any plan.

1. Figma **Desktop** app (not web), with the target file open and edit access.
2. Run the local MCP server (`npx -y figma-console-mcp@latest` registered in your MCP client) with a `FIGMA_ACCESS_TOKEN` (File content: read, Variables: read, Comments: read/write).
3. In Figma: *Plugins → Development → Import plugin from manifest* → `~/.figma-console-mcp/plugin/manifest.json` (auto-copied on server start) → run **Figma Desktop Bridge**. Status should read `Local · ready`.
4. Use the **local** server mode. The hosted/remote variant is read-only-ish, has fewer tools, and can't write token files to disk.

⚠️ **Plan gate:** light + dark modes in one variable collection requires a **Professional+** file (Starter allows 1 mode per collection). Confirmed working on the target file.

## Phase 2 — contract → Figma generation (reference plan)

### Tokens → variables

| Step | Tool | Notes |
|---|---|---|
| Create **Primitives** collection (1 mode) + variables | `figma_setup_design_tokens` | Batches of ≤100 tokens; values keyed by mode *name*; hex colors auto-converted |
| Create **Semantic** collection (Light/Dark) | `figma_setup_design_tokens` / `figma_create_variable_collection` + `figma_add_mode` | ≤4 modes per call |
| Alias semantic → primitive per mode | `figma_execute` with `figma.variables.createVariableAlias()` | The alias graph must mirror the DTCG alias graph |
| Set `codeSyntax.WEB` to the generated CSS var names (`var(--color-action-primary-background)`) | `figma_execute` (`variable.setVariableCodeSyntax`) | **Not** handled by the token tools — script it |
| Set variable scopes | `figma_execute` (`variable.scopes`) | Also not round-tripped by the token pipeline |

Known MCP limitations to design around (verified in source):

- `figma_import_tokens` applies **value updates only** — creations, deletions, and alias re-targeting are *reported in its plan but not applied*. Creation must go through `figma_setup_design_tokens` / `figma_batch_create_variables`.
- The MCP's DTCG dialect is hex-string colors / unit-string dimensions — which is exactly why `tokens/` uses that dialect (see [token pipeline](../03-token-pipeline.md)).

### Contracts → component sets

No declarative "component set from contract" tool exists; the generator scripts the Plugin API via `figma_execute`:

1. For each combination in the contract's variant matrix (enum props × values, e.g. 3 variants × 3 sizes): create a `COMPONENT` node named `Variant=Primary, Size=Medium` (using the **Figma-side spellings from `bindings.figma.values`**), auto-layout, padding/fills **bound to the semantic variables** created above (`setBoundVariable`) — never raw values.
2. `figma.combineAsVariants(nodes, parent)` → the component set; variant property names come from the node names.
3. `figma_add_component_property` for BOOLEAN (`Disabled`) and TEXT (`Label`) props per `bindings.figma`.
4. `figma_arrange_component_set` for a readable grid; `figma_set_description` with the contract's `description`.
5. Screenshot-verify (`figma_capture_screenshot`) and iterate — max 3 passes, per the MCP's own guidance.
6. **Write back anchors:** the new component set key/nodeId → `anchors.figma` in the contract. From now on, parity matches by anchor, not name.

Execution constraints: `figma_execute` is capped at 30s per call — generate one component set per call, not the whole library. Batch variable creation exists for a reason; use it.

### Fidelity scope (say this out loud in demos)

Phase 2 targets **structural fidelity**: correct variant matrix, property definitions, token/variable bindings, auto-layout basics. It does not target pixel-perfect visual artistry. The parity claim is about *structure and bindings*, which is what drifts and what breaks AI generation — not about taste, which stays human.

## Phase 3 — the diagnostic loop

Three extractors normalize each surface into contract-shaped data, then a three-way diff:

| Extractor | Source | Via |
|---|---|---|
| `extract-figma` | Component set + variables | `figma_analyze_component_set` (variant axes, property definitions, per-variant diffs, slots) + `figma_get_component_for_development_deep` (bound variables resolved to token names) |
| `extract-code` | Generated/edited React source | TS type introspection + the story files; trivial in this repo because code was generated from the contract |
| the contract itself | `contracts/*.contract.json` | — |

**Diff semantics:** `figma ⟷ contract` and `code ⟷ contract` (never `figma ⟷ code` directly). Each discrepancy is classified: side ahead of contract (→ propose contract patch = the promotion flow) or side behind contract (→ regenerate that side).

The MCP's `figma_check_design_parity` tool is a useful accelerant here — note it takes a `codeSpec` you must construct (it does not read source files itself), compares spec-level structure (tokens, props/variants both directions, a11y, spacing/visuals vs the default variant), and returns scored discrepancies + per-side action items. Our contract makes constructing `codeSpec` nearly free.

**The demo that settles the argument:** hand-add a `loading` prop in `Button.tsx` → parity flags code-ahead → accept the generated contract patch (PR) → regeneration sprouts a `Loading` boolean on the Figma component set. Then reverse: change `color.action.primary.background` (dark mode) in Figma → parity flags → token PR → CSS custom properties rebuild → Storybook reflects it. Both directions, one arbitration door.

## Open items

- [ ] Confirm the target file's plan tier supports 2 modes per collection.
- [ ] Contract schema extension for composition/nesting (Card + Avatar) before generating container components.
- [ ] Decide where extraction artifacts live (`parity/` directory, gitignored snapshots vs committed baselines).
- [ ] Wire `figma_check_design_parity` scoring into CI once extraction is scripted.

## The Sync Runner plugin: paste mode + local runner

The dev plugin (`figma-sync/plugin/`, load once via **Plugins → Development → Import plugin from manifest…**; setup details in [its README](../../figma-sync/plugin/README.md)) opens a two-tab window. Nothing executes until a Run button is pressed.

### Paste a script — the designer trust round-trip

A playground user copies the **Figma script** output tab, pastes it into the plugin's *Paste a script* tab, and presses **Run script** — the contract builds (or amends) the component set in the file they have open, and the script's report renders in the window: created/amended/skipped status, variant count, node id, component key, added/extra variants. Errors show verbatim; scripts are atomic on throw by Figma's design, so a failed run never leaves a half-synced file.

Trust model, stated in the UI: pasted scripts run with **full plugin permissions in the open file** — paste only scripts you generated yourself. There is no manifest to verify a paste against; the SHA-256 integrity check below applies to the local-runner transport only.

### Local runner — full-library runs

For whole-library operations (fresh-file rebuild, mass re-sync), pasting scripts one-by-one is slow and size-capped. The *Local runner* tab is the from-disk transport:

1. `npm run figma:serve` — serves `figma-sync/` locally with the runner manifest (tokens → batches → arrange) and a result sink.
2. Press **Run all scripts** in the target file. The runner executes every script in dependency order (each SHA-256-verified against the manifest, refusing on mismatch), stops on first failure, streams per-script progress into the window, and POSTs per-script results to `figma-sync/.runner-result.json`.

To target a fresh file, regenerate scripts with the guard retargeted: `FIGMA_FILE_KEY=<newFileKey> npm run figma:plan`. The 2026-07-06 fresh-file rebuild ran this way end to end (see docs/07 live checks).
