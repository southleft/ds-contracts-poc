# Normative rules — Spec draft v0.2 (schema 17)

Language: **MUST** / **MUST NOT** / **SHOULD** / **MAY** as in RFC 2119.

## 1. Contract identity

1. Every component contract MUST have a stable `id` that is never reused for a different component.
2. Display `name` MAY change; identity MUST follow `id` (and per-surface `bindings.<surface>.anchors` after first sync).
3. `version` MUST be semver and MUST bump when a contract change is published.

## 2. Dispositions (exact conversion grammar)

For every fact in the declared support grammar, conversion MUST return exactly one of:

| Disposition | Meaning |
|---|---|
| `CARRIED` | Preserved with measurable identity on the target surface |
| `LOWERED` | Represented with a named, lossy mapping |
| `REFUSED` | In grammar but not representable; named refusal required |
| `UNSUPPORTED` | Outside grammar; MUST NOT present as success |

Silent loss, silent invention, silent fallback, and silent overwrite are MUST NOT.

## 3. Compatibility (contract changes)

1. Adding an optional prop or widening accepted slot content SHOULD be a minor change.
2. Removing/renaming a prop or value, or narrowing accepted slot content, MUST be a major change.
3. Existing fields MUST NOT be repurposed to mean something else without a major bump and migration note.
4. The schema itself follows the same rule: removing or renaming a schema field is a schema MAJOR, and a schema major MUST refuse the old spelling by name (naming the new spelling) and MUST ship a codemod that rewrites a conforming document of the previous major. Silent acceptance of the old spelling is a MUST NOT — a document that validates only after an unrecorded rewrite is a document whose committed bytes lie.

(Working detail: [CONTRIBUTING.md](../CONTRIBUTING.md) contract change policy.)

## 4. Surfaces

1. A contract MAY bind any number of surfaces (`code`, `figma`, …). Every surface-specific fact MUST live under `bindings.<surface>` — on the contract (`bindings.<surface>.anchors`, plus the surface's own facts such as `bindings.figma.representation` / `bindings.figma.statePreviews`), on a prop (`bindings.<surface>.property` / `.prop`) and on a slot (`bindings.<surface>.property`). The vendor-neutral core of the document (`id`, `name`, `version`, `semantics`, `props`, `events`, `states`, `anatomy`, `a11y`) MUST NOT carry a tool name at any level.
2. A surface binding MUST NOT invent a canonical value absent from the contract prop enum/type.
3. An implementation MUST refuse an unknown surface key by name rather than accept it as a new surface.
4. Generated artifacts MUST be deterministic for the same supported inputs (byte-stable where the implementation claims determinism).

## 5. Anatomy

1. Styling decisions MUST live on named anatomy parts (token/layout/state bindings), not as unexplained literals on a single surface.
2. Nested component instances MUST preserve contract identity (`depContractId` / anchors) or be REFUSED by name.
3. Text style identity, when claimed, MUST bind a named style or REFUSE — never keep raw typography props silently.

## 6. Review before write

1. Tools that mutate contracts, source, or canvas MUST require an explicit confirmation step before write (or document an equivalent review gate).
2. Suggested write-backs (brownfield) MUST be propose-only unless the operator explicitly applies them.

## 7. Conformance

An implementation claiming conformance to this draft MUST:

1. Pass the packaged kit in [conformance/README.md](./conformance/README.md), or publish a mapped equivalent with equal coverage.
2. Disclose unsupported grammar rows rather than skipping them as green.

## Extension model

Vendors MAY add namespaced extension blocks (DTCG `$extensions` lesson) without forking required fields. Unknown extensions MUST be ignored by consumers that do not implement them, never cause silent reinterpretation of required fields.
