# 10 · Honest Generation — Catalog, Judge, and the A/B Number

Round 6 (July 3, 2026) built the consumption side of the thesis: a governed **catalog** every generating surface reads first, a deterministic **adherence judge** that enforces it, and the **A/B eval** that quantifies what governance is worth. This round produces the numbers and the narrative for the leadership demo. Figma Make is deliberately out of scope — this PoC models what a Make-class surface *becomes* when constrained to a governed source.

## The artifacts

| Artifact | Command | What it is |
|---|---|---|
| `catalog/catalog.json` | `npm run catalog` | The contract set + tokens + org rules compiled into one machine-readable, versioned (package version + git commit) generation constraint — the A2UI/json-render move, emitted from the same source that generates both component surfaces |
| `context/rules.json` | — | Org-authored rules (the **Figma Context stand-in**): tokens-only, one-primary-action, no raw equivalents, no style overrides, layout via primitives… Each tagged `judge` (deterministic) or `agent` (guidance) |
| `parity/judge.ts` | `npm run judge -- <screen.tsx>` | Scores ANY React screen against the catalog — unknown components, illegal props/enum values, missing required props, slot-acceptance, raw-element equivalents, style overrides, literal colors/dimensions, unknown tokens, primary-budget. No LLM, no rubric drift: **the catalog is the spec, so adherence is checked, not judged** |
| `Stack` / `Inline` | contracts | Layout primitives so screens are 100% catalog-composable. Marked `figmaRepresentation: "native"` — a new schema field acknowledging that some contracts map to native canvas capabilities (layout **is** auto-layout), not Figma components |

## The experiment

Five screen tasks (team settings, user directory, notification center, pricing, and a deliberately page-scale account overview), each generated twice by independent agents:

- **Arm A** — reads `catalog.json` + rules before generating (the proposal's "every surface reads the governed source first")
- **Arm B** — gets only the package name and component names, no APIs (today's reality: an AI that knows your design system *exists*)

Same model, same tasks. Every output scored by the deterministic judge. Results (`evals/adherence/results.json`):

| | **Arm A (governed)** | **Arm B (ungoverned)** |
|---|---|---|
| Mean adherence score | **100** | 69 |
| Fully adherent screens | **5 / 5** | 0 / 5 |
| Violations / checks | **0 / 253** | 91 / 283 |

Arm B's violation profile is exactly the pathology the proposal describes: **66** invented props/values/components (`components-from-catalog`), **22** literal colors and pixel values (`tokens-only`), **3** style overrides. Plausible-looking screens, every one a lookalike. Arm A produced zero violations *including on the full-page composition* — with the same model, the only variable being the governed source.

(Scoring footnote: the initial run scored arm B at 65 with 101 violations. After the TableHeaderCell gap below was promoted — widening the vocabulary — re-scoring against the current catalog gives 69/91, because compositions that were illegal became legal *for everyone*. The judge always scores against the current catalog; the promotion honestly improved both arms' world.)

Because this design system is private and novel, these numbers are free of the training-data contamination that flatters public-DS evals (Material, Atlassian) — the PoC doubles as a clean adherence instrument.

## Show the gaps, never fake it — observed, not staged

The page-scale task asked for a table with header columns. The governed agent discovered that **the contract set had no legal home for `TableHeaderCell`** (Table accepts only TableRow; TableRow accepted only TableCell) — and instead of faking it, emitted:

```jsx
{/* GAP: TableHeaderCell has no legal parent slot (Table accepts only TableRow,
    TableRow accepts only TableCell), so the header row uses TableCell. */}
```

That was a *real* defect in the vocabulary, found by the constraint, reported honestly, and **promoted through the standard loop**: `ds.table-row` v1.0.0 → v1.1.0 widened its cells slot to accept header cells (widening = minor version, per the spec's compatibility rule), catalog re-emitted, and the corrected composition became legal. The showcase screen (`src/screens/AccountOverview.tsx`, rendered in Storybook under **Screens/Account Overview**, judged 100/100 across 31 elements) uses the post-promotion form. The eval artifact keeps its GAP comment as evidence.

This is the proposal's trust principle — *when the system doesn't have what's needed, the tool says so instead of faking it* — captured in the wild, with the gap feeding the source of truth and re-entering the catalog.

## The scale question, answered

The concern: does the model break down as compositions grow? The architecture's answer, now demonstrated: **contracts are vocabulary; screens are sentences.** The contract set is small and closed (10 components); compositions are open-ended *instance documents* validated against it. The judge walks any JSX tree — the 31-element account overview is checked by the same rules as a single Button, and cost grows linearly with node count. What large compositions actually demand is not more contract machinery but *sufficient vocabulary* (hence Stack/Inline; a real system adds Heading, Text, Grid the same way) and, eventually, a **patterns/recipes layer** — governed compositions-of-compositions, which are themselves just catalog-validated documents. From primitive button to full page, it is, as suspected, a matter of the object model.

## What remains for the leadership demo package

- **Record the arc** (~3 min): arm-B lookalikes → arm-A governed assembly in Storybook → the GAP report → the promotion → the A/B table.
- **Formalize the gap protocol** — GAP comments work; a structured `gaps.json` (missing capability + proposed contract patch) makes it machine-routable.
- **The versioning beat** — pin a generator to `catalog@<tag>`, add a component, show the pinned surface refusing it until the version advances.
- **One-pager** mapping each demo beat to the proposal's claims, with docs/07's eval receipts as the credibility floor.
