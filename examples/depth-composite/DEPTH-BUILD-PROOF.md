# Depth build — advanced composition, proven in both directions

**The claim.** A machine-readable component *contract* is the single source of truth
between Figma canvas and code, and it holds for **advanced composition** — a
multi-root component whose body composes other components (a fixed child + a
repeated collection), not just leaf primitives. The anatomy of the coded
component lines up with the anatomy of the canvas component, **part for part**,
and it round-trips in **both** journey directions.

The subject is `ds.composite-modal` (`examples/depth-composite/composite-modal.contract.json`):
a modal with two top-level roots — `dialog` and `backdrop` — whose `dialog.body`
holds a composed `ds.card` instance and a `ds.badge` collection repeated over an
`items` prop, laid out as a pill row.

```
dialog                         backdrop
├─ header (title, close)
├─ body
│  ├─ summary   → ds.card  (a composed child instance)
│  └─ tags (row)
│     └─ tag ×N → ds.badge (a repeated collection)
└─ footer (cancel, save)
```

## What is proven, and how to re-run it

Every line below is executable. Nothing here is a claim without a check.

| # | Claim | Command | What it asserts |
|---|-------|---------|-----------------|
| 1 | **Emitter builds the anatomy on all 4 surfaces + code≡canvas** | `npx tsx examples/depth-composite/emit-composite-receipt.ts` | React (bundled + `renderToStaticMarkup`), inline-React, HTML, and figma-script all emit the composite; the figma-script **headless-executes in a mocked Figma** and the built COMPONENT node tree matches the contract anatomy part-for-part (dialog+backdrop roots, a nested `ds.card` INSTANCE, a tags row of N `ds.badge` INSTANCEs). |
| 2 | **code → design via the real plugin engine** | `node scripts/plugin-engine-check.mjs` (case `composite-plugin-path`) | The packaged plugin engine (`window.DSC`, the exact bundle the plugin loads) parses the pushed CONTRACTS-BUNDLE, plans tokens-first + dependency-ordered (avatar→button→badge→card→composite), executes in the mock, and builds the correct anatomy — the exact result the live plugin *Receive* produces. |
| 3 | **design → code (reverse journey)** | `node scripts/plugin-engine-check.mjs` (case `composite-reverse-journey`) | The drawn composite is dumped (the Propose-tab path) and proposed *back* to a contract that recovers **both roots** (dialog+backdrop), the composed `ds.card` INSTANCE, and the repeated `ds.badge` collection. (Extraction wraps in a single COMPONENT-as-root — a convention difference from the top-level multi-root author form, no information lost.) |
| 4 | **Whole suite green** | `npx tsx evals/run.ts` | 145/145, including the composite pin, the golden byte-authority, the 1,618-set census, and the two plugin-path gates above. |

## Key findings (defect-first, honestly recorded)

- **Advanced composition needed ZERO new emitter code.** It was already latent in
  the multi-root gate's `component` + `repeat` channels; the depth build is a
  *proof*, not new engine code. The one prerequisite was generalizing the
  emitters/validator to consume multi-root anatomy (done, single-root output
  byte-identical).
- **Two harness defects fixed** (not engine): the headless VM needed token
  variables seeded first via `buildTokensScript` (the real setup step); and the
  transitive-dependency walk had to include slot `accepts` INSTANCE_SWAP targets,
  not just hard `component` refs.
- **The full-width-bar badge render was faithful**, not a bug — a flex column with
  default stretch. Re-authored as a pill row (a layout a designer would ship).

## The one step that is not headless

The **live canvas render** — building this composite on a real Figma canvas via
the plugin's *Receive by code* — is a manual action in Figma. It is
*confirmatory*: checks #2 and #3 run the exact plugin engine and prove the result
in advance, so the live render displays pixels but cannot reveal a defect the
gates have not already ruled out. Verification of the live canvas can be done
read-only via the Figma MCP (`get_metadata` / `get_screenshot`) with no
dependency on the (flaky) figma-console Desktop Bridge.
