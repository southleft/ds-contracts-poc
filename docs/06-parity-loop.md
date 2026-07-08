# 6 · The Parity Loop (Phase 3 — executed)

This is the piece that settles the source-of-truth argument: neither surface syncs to the other; **every change on either surface becomes a reviewable proposal to the contract**, and the contract regenerates the other side. Executed end-to-end in both directions on July 3, 2026.

## The tooling

| Piece | What it does |
|---|---|
| `parity/extract-code.ts` | Reads the **actual React source** (TypeScript compiler API) — props interface, enum unions, booleans, destructuring defaults, plus CSS custom properties consumed by the CSS Module. Reads code, not the contract, so hand edits are visible. |
| the canvas extraction script (in `parity/`) | Runs inside the design tool — reads component sets with their full property definitions, and all variables with per-mode values, alias targets, scopes, and code-syntax metadata. Output saved to `parity/snapshots/`. |
| `parity/diff.ts` (`npm run parity`) | Three-way diff: `code ⟷ contract`, `canvas ⟷ contract`, `canvas variables ⟷ tokens/`. Never side-to-side. Writes `parity/report.json`, exits 1 on drift (CI-able). |

**Classification model:**

- **`ahead`** — the surface has something the contract doesn't → the differ emits a **proposed contract/token patch**. A human reviews and applies it (the promotion flow). This is how a surface *legitimately* changes the system.
- **`behind`** — the contract has something the surface doesn't → regenerate that surface (`npm run generate`, the canvas sync scripts).
- **`mismatch`** — both define it, values disagree → contract is canonical; adopt (patch contract) or enforce (regenerate).

## What actually happened (the evidence)

### Finding 0 — organic drift, caught on the first baseline run
The very first `npm run parity` flagged that the canvas Button set's default `Size` was `Small` while the contract says `md`/`Medium`. Root cause: **the design tool's default variant is positional (top-left of the set)**, and the generator laid variants out in enum order. Fixed twice over: the live set was re-arranged so the contract-default combo occupies the top-left cell, and the canvas generator now orders each variant axis default-value-first. This was not staged — the loop caught a real gap on its first run.

### Direction 1 — code ahead (the product engineer)
1. Hand-added `loading?: boolean` to the generated `Button.tsx`.
2. `npm run parity` → `[code AHEAD] Button.loading` with a **complete proposed prop patch**, design-side binding included.
3. Promotion: patch applied to `contracts/button.contract.json`, version bumped **1.0.0 → 1.1.0**.
4. `npm run build` regenerated the code — the hand edit superseded by the contract-governed version (same API, now with JSDoc and stories).
5. The `Loading` boolean property was pushed to the live canvas component set (a set-level property addition), description bumped to v1.1.0.
6. Snapshot refreshed → `npm run parity` → **clean**.

### Direction 2 — canvas ahead (the designer)
1. Simulated a designer edit on the canvas: `color/surface/background` Dark-mode alias retargeted `gray/900 → gray/800`.
2. Snapshot refreshed → `npm run parity` → a canvas-tokens **MISMATCH** finding with a proposed patch: adopt the canvas value `{color/gray/800}` for `color.surface.background`, mode `Dark`.
3. Promotion: `tokens/modes/semantic.dark.tokens.json` updated.
4. `npm run tokens` → `tokens.dark.css` now emits `--color-surface-background: var(--color-gray-800)`; Storybook's dark mode reflects it immediately.
5. `npm run parity` → **clean**.

Same door in both directions: a diffable change to a JSON file in Git, reviewable by designers and engineers alike.

## Running the loop

```bash
# 1. Refresh canvas snapshots (agent step): run the canvas extraction script
#    in the design file and save the results to parity/snapshots/
# 2. Diff everything:
npm run parity          # exit 1 + parity/report.json on drift
# 3. For each finding: apply the proposed patch (promotion) or regenerate the
#    stale surface, then re-run until clean.
```

Snapshots are committed as point-in-time evidence; in CI you'd refresh them headlessly via the design tool's REST API (read-only file content is not plan-gated) or a scheduled agent session.

## Operational learnings (read before touching the bridge)

- **Multi-file routing can lie.** With several sync-bridge instances running, a write was observed executing in a file *not* reported as active (status said the target design file; the code ran in a whiteboard file). Re-navigating the bridge to the target URL repaired routing. Consequence: **every write script starts with a file guard** (asserting the target file's name/key) — the generator emits them automatically.
- **Bridge version skew breaks tools silently.** The bridge's token export returned empty while a direct script read all 92 variables on the same connection — root cause: the bridge's in-tool client was one version behind its server. Re-installing the client fixed it (the export then round-tripped losslessly — see docs/07). Check the bridge's client/server versions before debugging anything else.
- **The design tool's default variant is positional** (top-left), not declaration-ordered — hence the generator's default-first axis ordering.
- Set-level property addition works fine for adding boolean/text properties to an *existing* component set (initial authoring has stricter ordering rules, where text properties must be linked to nodes inside variants). (Bridge names, script paths, and command-level detail live in the internal appendix, docs/internal/figma-sync.md.)

## Known limitations (phase 3 scope)

- CSS-module token bindings are extracted but not yet diffed against contract anatomy (props and tokens are; the CSS is regenerated from the contract anyway).
- Visual/pixel parity is out of scope by design — the loop guards **structure and bindings** (what drifts, and what breaks AI generation). Taste stays human.
- Snapshot refresh is an agent step, not yet a headless script.
- Conflict case (both surfaces changed the same thing between runs) reports as two findings; resolution order is a human call.

## Pending first sync (v7)

The differ's report has a `pending` section: a contract with null design anchors was never synced — that is workflow state, not drift between surfaces that were once in sync. Pending contracts are visible in the report but never fail the exit code; once anchors exist, a missing set is a hard BEHIND again.
