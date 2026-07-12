# 8 · Composition & the Road to a Contributable Spec

Round 4 (July 3, 2026) stress-tested the contract model against the things that historically kill contract formats: **slots and nested components**. This doc records what was built, the concrete schema decisions and their rationale against the landscape (Google A2UI, Vercel json-render, CEM, the design tool's native slot property), and what it would take to publish the contract format as a contributable spec.

## What composition proved

`ds.card` exercises all three composition mechanisms in one contract, generated to both surfaces and parity-checked:

| Mechanism | Contract | Code output | Canvas output | Parity check |
|---|---|---|---|---|
| **Nested component ref** | `anatomy…avatar.component: { id: "ds.avatar", props: { size: "sm" } }` | `import { Avatar }` + `<Avatar size="sm">` | Avatar instance with `Size=Small` set | `nestedInstances` must include Avatar |
| **Bound text part** | `content: { prop: "title" }` on the header title part | `<span>{title}</span>`, `title: string` required | Text node linked to text property `Title` | text property present, default matches |
| **Default slot** | `slot: { name: "children", designProperty: "Body", required: true }` | `{children}` in the body wrapper | `Body` instance-swap slot property defaulting to the Slot utility component | slot property present |
| **Constrained optional slot** | `slot: { name: "actions", accepts: ["ds.button", "ds.badge"] }` + `optional: true` | `actions?: ReactNode`, conditional `<footer>` | `Actions` instance-swap property with **preferred values = Button's and Badge's component-set keys** + `Show Actions` boolean | preferred-value keys must equal the accepted contracts' component-set anchors |

That last row is the round's headline: **`accepts` is expressed once, in contract IDs, and resolves per-surface through each accepted contract's own anchors** — TypeScript's type system on one side, the canvas's swap-picker preferences on the other, and the parity differ verifies the canvas side against the anchors mechanically. Six new evals cover it (22/22 passing): circular-dependency and unknown-ref refusal, missing slot property, missing nested instance, `accepts` drift, and removed slot prop.

## The three concrete decisions (and why)

### 1. Anatomy is a nested tree — but that's an authoring choice, not a religion

A2UI and json-render both chose **flat adjacency lists** (components by ID, children by reference), and for good reasons: LLMs generate flat lists more reliably than perfectly-balanced nesting, streamed prefixes stay renderable, and any node is patchable by ID. But those are **instance-document/transport concerns**. A contract is a *source document* — authored, reviewed, and diffed by humans — and a tree reads like the component it describes.

The synthesis: **author nested, compile flat.** The generators already flatten the tree into ID-addressable node specs (see the canvas sync scripts), and the natural next artifact is a *catalog* emission — the contract set compiled into a JSON Schema of legal components/props/slots that constrains AI generation the way A2UI catalogs and json-render's `defineCatalog` do. One source, both shapes.

### 2. Slots follow Nathan Curtis's model, with the design tool's two-tier constraint semantics

A slot is `{ name, accepts?, acceptsMode?, min?, max?, required?, designProperty? }`:

- `accepts` lists **contract IDs**, resolved per-surface via anchors. CEM — the closest published contract standard — declares slots as name + prose only, with no constraints and no verification; that gap is exactly where this spec adds value.
- `acceptsMode` mirrors the design tool's own semantics: `prefer` (guidance — preferred values), `restrict` (hard — the canvas's only-preferred-values setting), `open` (explicitly anything — the escape hatch Subframe proves some slots need).
- `min`/`max` map to the canvas slot's min/max-children settings and, in code, to `ReactNode` vs arrays.
- **Compatibility rule (normative):** widening `accepts`, raising `max`, or lowering `min` is a *minor* version; narrowing anything is *major*.

Current generators implement `accepts` → instance-swap preferred values (soft tier). **The design tool's native slot property type is the upgrade target** — it accepts the same preferred values plus slot settings, and reports violations lint-style rather than blocking, which matches this project's diagnose-then-promote philosophy better than hard blocking would.

### 3. Composition never duplicates a child's definition

A `component` ref carries only the child's contract ID and fixed prop values **spelled canonically** (`size: "sm"`); each surface maps them through the *child's own* bindings (`size="sm"` in code, `Size=Small` on the canvas). The child's anatomy, tokens, and API live in exactly one place. Cycles and unknown refs are refused at build time (`sortByDependencies`), and sync scripts emit in dependency order.

## Landscape comparison (what we borrowed / rejected)

| Format | Borrowed | Rejected / N.A. |
|---|---|---|
| **A2UI** (v0.9.1, flat + catalogs + JSON Pointer binding) | Catalog-as-JSON-Schema enforcement stance ("trusted vocabulary or reject, never silently fall back"); envelope versioning; contract vs catalog versioned separately | Flat authoring (transport concern); positional-only children (no named slots) |
| **json-render** (catalog/registry/spec, Zod props) | One prop definition → generation schema + runtime validator + typed binding; catalog/registry separation (contract ≠ per-platform binding — our `anchors`) | Anonymous unconstrained `children` (the hole this spec fills) |
| **CEM** | The member-model shape; `deprecated: boolean | string` as a lifecycle primitive (worth adopting); interop positioning (publish slot constraints as a CEM superset) | Documentation-on-the-honor-system: CEM describes, never verifies — our differ exists precisely because described contracts drift |
| **The design tool's native slot / instance-swap properties** | preferred values keyed by stable component keys (≙ our anchors); two-tier prefer/restrict; component-set targeting ("any variant of Button" = one entry); lint-don't-block violations | — (native slot is the upgrade path once extraction support lands) |

## Toward a contributable spec

What exists today that a spec draft can be cut from:

1. **The format**: `contracts/contract.schema.json` (generated from the Zod source of truth) — props with per-surface bindings, nested anatomy with token bindings, slots, component refs, states, a11y, dual anchors.
2. **Reference implementations**: two generators (React/CSS Modules/CSF3 for code, and one targeting a commercial design tool's canvas) and a three-surface conformance checker (the parity differ) — a spec with a verifier is what separates this from CEM.
3. **A conformance suite**: the 99 evals are, in effect, the spec's test suite (refusal semantics, detection semantics, convergence semantics, judge semantics).

What a publishable draft still needs, in rough order:

- **Catalog compilation** (`contracts → catalog.schema.json`): the A2UI/json-render-shaped artifact that constrains AI generation. Mostly mechanical from what exists.
- **Naming + namespacing**: `ds.*` IDs work for one system; a spec needs reverse-domain or package-qualified IDs and a `$schema` URL convention.
- **Formalized versioning rules** (the widen-minor/narrow-major rule above, plus prop/variant addition-removal semantics — currently prose in docs/02).
- **The gaps below, closed or explicitly scoped out.**

## Known gaps (deliberate, next rounds)

- States (`hover`/`focus-visible`/`disabled`) are root-only; nested-part states and token substitution on nested parts are unsupported (build-time errors, not silent).
- Fixed dep props can't map *parent* props to child props (e.g. Card `size` → Avatar `size`) — values are static.
- `acceptsMode: 'restrict'` and `min`/`max` are recorded in the schema but not yet enforced by generators/differ (the instance-swap → native-slot migration is the natural moment).
- Slot default *content* (Curtis's fifth property) — currently always the Slot utility placeholder.
- Recursion depth is validated only against cycles; a 5-level-deep composition hasn't been exercised.
