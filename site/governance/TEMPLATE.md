# RFC-NNNN: <title>

- **Status:** draft <!-- draft | accepted | rejected | withdrawn | superseded by RFC-NNNN -->
- **Author(s):** <name / handle>
- **Date opened:** YYYY-MM-DD
- **Discussion:** <link to the GitHub issue or PR>
- **Schema round targeted:** <e.g. v14, or "none — process change">

## The field case

What real component, in what real system, cannot be expressed (or cannot be
expressed honestly) today? Name the file, the kit, or the fixture. A proposal
without a concrete field case is a speculation — the schema grows by
demonstrated need, never by anticipation (YAGNI is a design principle here).

## The proposal

The schema change, precisely: new fields, types, and where they attach
(contract / part / prop / event). Spell the shape the way
`scripts/contract-schema.ts` would.

## Projections — every surface, stated

How does each surface render the new vocabulary?

| Surface | Projection |
|---|---|
| React (emit-react) | |
| HTML (emit-html) | |
| React-inline (emit-react-inline) | |
| Canvas (emit-figma-script) | |

A surface that cannot represent the feature is a **declared fidelity limit**:
say so explicitly, and say what that surface renders instead. "The canvas
ignores it" is an acceptable answer; an unstated gap is not.

## Refusal rules

The illegal states, named. What must `validateContract` refuse, with what
message? New vocabulary that cannot be half-used silently is the bar.

## Compatibility

- Existing contracts must keep parsing (add optional fields; never repurpose
  existing ones).
- Is this widening (minor) or narrowing (major) for consuming contracts?
- Differ impact: what new drift classes exist, and how are they classified
  (`ahead` / `behind` / `mismatch`)?

## Receipts plan

The claims rule applies to proposals too: **fixture first, eval second,
claim last.**

- [ ] Committed fixture (a shipping contract that needs this, or a capture
      fixture that exercises it)
- [ ] Refusal evals for the named illegal states
- [ ] Round-trip / drift eval where applicable
- [ ] Reference page section (the site's coverage guard will force this
      mechanically — a new schema branch fails the site build until documented)

## Alternatives considered

Including "do nothing" and "carry it as a receipt instead of vocabulary" —
the receipt path is the default for anything below the expressiveness bar.
