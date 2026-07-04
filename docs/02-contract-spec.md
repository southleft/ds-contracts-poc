# 2 · Contract Specification

One contract per component, at `contracts/<component>.contract.json`. The authoritative schema is defined in Zod at `scripts/contract-schema.ts`; `npm run schema` emits `contracts/contract.schema.json` so editors validate contracts inline (every contract's `$schema` field points at it).

## Top-level fields

| Field | Type | Purpose |
|---|---|---|
| `id` | `ds.<kebab-name>` | **Stable canonical identity. Never renamed.** Display names can change on either side; the `id` is what survives. |
| `name` | string | Display/export name (`Button`). Drives the code export and the canvas component set name. |
| `version` | semver string | Bumped when the contract changes. The unit of change management. |
| `status` | `draft` \| `stable` \| `deprecated` | Governance lifecycle. |
| `description` | string | Usage intent. Flows into Storybook autodocs and (phase 2) the canvas component description — the same sentence in both surfaces, from one source. |
| `semantics` | `{ element, role? }` | The HTML element the code renderer uses, and the ARIA role if it differs. |
| `props` | `Prop[]` | The canonical API. See below. |
| `states` | `("hover" \| "focus-visible" \| "disabled")[]` | Interaction states the component must support. Drives CSS pseudo-class rules (code) and, in phase 2, variant pseudo-state frames (canvas). |
| `anatomy` | `Record<partName, Part>` | Named internal parts with **token bindings** — where all styling decisions live. |
| `a11y` | object | Executable accessibility requirements (`focusVisible`, `minHitArea`, `contrast`). Phase 1 records them; later phases enforce them. |
| `anchors` | object | Per-side identity anchors. See below. |

## Props

Each prop declares its canonical name, type, default — and **bindings**, which describe how the one canonical prop manifests on each side. This is the Code Connect idea folded into the source of truth:

```jsonc
{
  "name": "variant",
  "description": "Visual prominence of the action.",
  "type": { "enum": ["primary", "secondary", "danger"] },   // or "boolean" or "text"
  "default": "primary",
  "bindings": {
    "design": {
      "kind": "VARIANT",                    // variant | boolean | text | instance-swap
      "property": "Variant",                // canvas component property name
      "values": { "primary": "Primary", "secondary": "Secondary", "danger": "Danger" }
    },                                      //  ^ canonical value → canvas variant value
    "code": { "prop": "variant" }           // React prop name
  }
}
```

Rules of thumb:

- **The canonical value set lives here and only here.** Canvas spelling (`"Primary"`) and code spelling (`"primary"`) are *renderings* of the canonical value.
- `"text"` props map to `children` in code and a text property on the canvas.
- `"boolean"` props map to the native attribute where the element supports it (`disabled` on `<button>`), otherwise a `data-*` attribute.

## Anatomy & token bindings (v2 — composition)

Anatomy is a **nested tree** of named parts (CEM's slots/parts, Curtis's anatomy). Every part can carry **token bindings** (CSS property → DTCG token reference — the CSS Module and the canvas node styling are both generated from these; there is no handwritten style layer), a **layout** block (`display`/`direction`/`align`/`justify` → flexbox on the code side, auto-layout on the canvas side), and one of three composition roles:

| Part field | Meaning | Code output | Canvas output |
|---|---|---|---|
| `component: { id, props? }` | Fixed instance of another contract; `props` spelled canonically, mapped through the *child's* bindings | imported `<Child prop="…">` | nested instance with properties set |
| `slot: { name, accepts?, acceptsMode?, min?, max?, required?, designProperty? }` | Constrained insertion point; `accepts` lists contract IDs resolved via anchors | `children` / `ReactNode` prop | instance-swap slot property (Slot-utility default) whose preferred values are the accepted contracts' component keys; optional parts get a `Show X` boolean |
| `content: { prop }` | Text bound to a declared text prop | `{title}` in the part's element | text node linked to the text property |

Parts with none of these are structural (frames/elements containing `parts`). `optional: true` renders conditionally in code and toggles visibility on the canvas. Composition rules: part names are unique per contract; cycles and unknown contract refs **fail the build**; sync scripts emit in dependency order. See [docs/08](08-composition-and-spec.md) for the design rationale.

```jsonc
"anatomy": {
  "root": {
    "tokens": {
      "background-color": "{color.action.{variant}.background}",
      "padding-inline":  "{space.inset-x.{size}}",
      "border-radius":   "{radius.control}"
    },
    "states": {
      "hover":  { "background-color": "{color.action.{variant}.background-hover}" },
      "disabled": { "opacity": "{opacity.disabled}" }
    }
  },
  "icon": { "slot": true, "optional": true }
}
```

**Substitution:** a `{propName}` placeholder inside a token path expands over that enum prop's values. `{color.action.{variant}.background}` with `variant: primary|secondary|danger` produces three CSS rules (`.variant-primary { … }` etc.). One placeholder per reference in phase 1.

**The integrity gate:** at generation time, every reference — *after* expansion — must resolve to a real token in `tokens/`. A binding to a nonexistent token fails the build with the exact contract path and missing token named. The contract and the token set cannot silently disagree.

## Events (v6 — the interaction surface)

A contract can declare **what interactions exist** without ever describing how they're implemented:

```jsonc
"events": [{
  "name": "toggle",
  "bindings": { "code": { "prop": "onToggle" } },   // code-only, by declared fidelity limit
  "trigger": "trigger",                              // the anatomy part that fires it
  "toggles": {                                       // optional: a generatable toggle
    "prop": "state",                                 // enum prop being flipped
    "between": ["closed", "open"],                   // activation flips within this pair
    "aria": "expanded"                               // → aria-expanded on the trigger
  }
}]
```

What each surface does with this:

- **Code (generated):** an optional callback prop (`onToggle?: () => void`), and — when `toggles` is present — the complete toggle: an uncontrolled `useState` fallback (so the component is interactive out of the box), the controlled/uncontrolled resolution (`stateProp ?? internal`), a click handler on the trigger, and the ARIA state attribute. Values of the toggled enum *outside* the pair render `aria-*="mixed"` and resolve to the pair's second value on activation — exactly Checkbox's `indeterminate`.
- **Design (description only):** the canvas cannot run behavior, so events surface as component-description text (`Event (code): onToggle — …`) in the properties panel. A declared fidelity limit, like animation.
- **Differ:** the callback is contract API. Deleting `onToggle` from code is `code BEHIND` (eval: `detect-code-removed-event`); a handwritten `onX` prop the contract doesn't declare is `code AHEAD` like any other prop.

Guardrails, enforced at build time: a trigger part must be a `<button>` (keyboard activation comes from the platform, not a bolted-on handler), `toggles.prop` must be an enum containing both `between` values, and event prop names must be `on*` and collision-free.

**What events deliberately do NOT cover:** drag, typeahead, focus trapping, animation timing — behavior whose truth can't be verified on both surfaces. That stays a hand-written layer, and the contract refuses to pretend otherwise.

## Anchors

```jsonc
"anchors": {
  "design": { /* the design tool's stable file/component-set/node identifiers */ },
  "code":   { "importPath": "src/components/Button", "export": "Button" }
}
```

This is the DTCG `$extensions` dual-ID pattern applied to components. After phase 2 first generates the canvas component set, its stable identifiers are written back here. From then on, renames on either side never fork identity — parity checks match by anchor, not by name. (In the reference implementation the design-side keys — here and in prop bindings — are namespaced after the bound commercial design tool; the concrete key shapes are documented in docs/internal/figma-sync.md.)

## Versioning & change policy

- Any change to `props`, `states`, `anatomy`, or `a11y` bumps `version` (semver semantics: added optional prop = minor; removed/renamed prop or value = major).
- Contract changes land as PRs. The PR diff *is* the design-system change review — one artifact, reviewable by designers and engineers alike.
- Phase 3's promotion flow generates these PRs from drift detected on either surface.

## Schema evolution

The schema itself will grow (composition/nesting, layout block, behavior/events, multi-placeholder substitution are known gaps — see [architecture doc](01-architecture.md)). Schema changes happen in `scripts/contract-schema.ts`, are reflected by `npm run schema`, and must keep existing contracts parsing (add optional fields; never repurpose existing ones).
