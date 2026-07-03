# 2 · Contract Specification

One contract per component, at `contracts/<component>.contract.json`. The authoritative schema is defined in Zod at `scripts/contract-schema.ts`; `npm run schema` emits `contracts/contract.schema.json` so editors validate contracts inline (every contract's `$schema` field points at it).

## Top-level fields

| Field | Type | Purpose |
|---|---|---|
| `id` | `ds.<kebab-name>` | **Stable canonical identity. Never renamed.** Display names can change on either side; the `id` is what survives. |
| `name` | string | Display/export name (`Button`). Drives the code export and the Figma component set name. |
| `version` | semver string | Bumped when the contract changes. The unit of change management. |
| `status` | `draft` \| `stable` \| `deprecated` | Governance lifecycle. |
| `description` | string | Usage intent. Flows into Storybook autodocs and (phase 2) the Figma component description — the same sentence in both surfaces, from one source. |
| `semantics` | `{ element, role? }` | The HTML element the code renderer uses, and the ARIA role if it differs. |
| `props` | `Prop[]` | The canonical API. See below. |
| `states` | `("hover" \| "focus-visible" \| "disabled")[]` | Interaction states the component must support. Drives CSS pseudo-class rules (code) and, in phase 2, variant pseudo-state frames (Figma). |
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
    "figma": {
      "kind": "VARIANT",                    // VARIANT | BOOLEAN | TEXT | INSTANCE_SWAP
      "property": "Variant",                // Figma component property name
      "values": { "primary": "Primary", "secondary": "Secondary", "danger": "Danger" }
    },                                      //  ^ canonical value → Figma variant value
    "code": { "prop": "variant" }           // React prop name
  }
}
```

Rules of thumb:

- **The canonical value set lives here and only here.** Figma spelling (`"Primary"`) and code spelling (`"primary"`) are *renderings* of the canonical value.
- `"text"` props map to `children` in code and a `TEXT` property in Figma.
- `"boolean"` props map to the native attribute where the element supports it (`disabled` on `<button>`), otherwise a `data-*` attribute.

## Anatomy & token bindings

Anatomy names the component's internal parts (CEM's slots/parts, Curtis's anatomy). The `root` part carries **token bindings**: CSS property → DTCG token reference. The CSS Module is generated from these; there is no handwritten style layer.

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

## Anchors

```jsonc
"anchors": {
  "figma": { "fileKey": "8nim1d0IPnehMxA7B7SYxC", "componentSetKey": null, "nodeId": null },
  "code":  { "importPath": "src/components/Button", "export": "Button" }
}
```

This is the DTCG `$extensions` dual-ID pattern applied to components. After phase 2 first generates the Figma component set, its key/nodeId are written back here. From then on, renames on either side never fork identity — parity checks match by anchor, not by name.

## Versioning & change policy

- Any change to `props`, `states`, `anatomy`, or `a11y` bumps `version` (semver semantics: added optional prop = minor; removed/renamed prop or value = major).
- Contract changes land as PRs. The PR diff *is* the design-system change review — one artifact, reviewable by designers and engineers alike.
- Phase 3's promotion flow generates these PRs from drift detected on either surface.

## Schema evolution

The schema itself will grow (composition/nesting, layout block, behavior/events, multi-placeholder substitution are known gaps — see [architecture doc](01-architecture.md)). Schema changes happen in `scripts/contract-schema.ts`, are reflected by `npm run schema`, and must keep existing contracts parsing (add optional fields; never repurpose existing ones).
