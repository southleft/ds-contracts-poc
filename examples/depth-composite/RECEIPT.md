# Depth Stage C — the dynamic child-collection composite emits on all four surfaces

Rebuild: `npx tsx examples/depth-composite/emit-composite-receipt.ts`

Stage C is the advanced-composition frontier on top of the multi-root emitter
path: a MULTI-ROOT Modal (`ds.composite-modal` = {dialog, backdrop}) whose
**body holds composed children**, not only static leaf parts —

- a **single composed child**: a fixed `ds.card` instance (a `component` ref);
- a **dynamic child-collection**: a `ds.badge` item template **repeated** over
  the arrayOf `items` prop (the `repeat` + `component` channel).

Both channels already live in every emitter (nested `parts` + `component`, and
`repeat` + `component`). This receipt drives them **together** on a real
composite and proves each surface by EXECUTION (green parse ≠ works).

## Per-surface rendering decision

| surface | composed child (`ds.card`) | dynamic collection (`ds.badge` × items) |
|---|---|---|
| emit-react | `<Card title="Order summary" />` in body | `{items?.map((item, i) => <Badge key={i}>{item.children}</Badge>)}` — the LIVE array (undefined renders nothing) |
| emit-react-inline | `<Card title="Order summary" />` | the OBSERVED `sample` as N fixed `<Badge>` instances (resolved literals) |
| emit-html | `<article class="card">…` | the OBSERVED `sample` as N `<span class="badge">` siblings |
| emit-figma-script | a `summary` INSTANCE node in the body frame | N repeated `tags`/`tags 2`/… INSTANCE nodes (the sample), children of the body frame |

Children render **in order** inside the body; the collection is REAL repeated
instances on every static surface (the sample), never a single placeholder.
A genuinely single-root contract, and every existing `repeat` user, takes the
untouched path — golden output is byte-for-byte unchanged.

## Proof (4/5 surfaces)

| surface | pass | what executed |
|---|---|---|
| emit-react | ✓ | rendered a real modal whose body holds a composed <Card> + the live items array mapped to 3 <Badge> children (order preserved), sibling backdrop, both root classes, no NaN |
| emit-react-inline | ✓ | resolved-literal variant renders the composed card + the observed sample as 3 fixed Badge instances, no NaN |
| emit-html | ✓ | static markup carries the composed card + 3 sampled badges inside the dialog body, backdrop sibling, no React syntax |
| emit-figma-script (referee) | ✓ | COMPONENTS payload parses — one variant frame; the dialog body holds the composed summary instance + 3 repeated tag instances [summary, tags, tags 2, tags 3] |
| emit-figma-script (headless) | ✘ | threw — Error: Dependency component not found in file: Card (sync it first) |

## Emitted artifacts (committed as receipts)

- `CompositeModal.tsx` + `CompositeModal.module.css` — CSS-module React component
- `CompositeModal.inline.tsx` — resolved-literal React component
- `CompositeModal.html` + `CompositeModal.html.css` — static HTML + CSS
- `CompositeModal.figma.js` — Figma Plugin API sync script (one frame; body holds the composed + repeated instances)
