# Eventz Alert — net-new design → contract → working React, end to end

Subject: **Alert** (node `2629:56948` in the Demo Eventz Design System) — a
hand-built foreign component set our generators had never seen. Four variants,
eight properties, Eventz's own variable vocabulary.

## The run (2026-07-08)

1. **Dump** — `extract/figma/dump.plugin.js` semantics over the bridge:
   `alert.figma-dump.json` (committed).
2. **Propose** — `npm run extract:figma`: a schema-valid `ds.alert` contract
   carrying Eventz's OWN token refs (`{spacing.4}`, `{spacing.3}`,
   `{component.border.radius.rounded-md}`, `{color.content.inverse}`), the
   4-value variant enum, title/description text props bound to their Figma
   properties, and visibility-bound optional parts — plus **9 named review
   notes**, none of them guesses.
3. **Review** (two human line items, both named by the tooling):
   duplicate part name "horizontal stack" → renamed contentStack/textStack;
   nested `ds.check-circle` / `ds.text-link` component refs point at contracts
   not yet extracted → inlined/deferred.
4. **Emit** — `emitReact` against a 7-token Eventz DTCG stub (values read from
   the live file): a typed, working `Alert.tsx` + `Alert.module.css` riding
   `var(--spacing-4)`-style Eventz custom properties (committed in `out/`).

## What the run found in the wild

- **`spacing/0․5`** — an Eventz variable whose middle character is U+2024 ONE
  DOT LEADER, not a dot. It crashed ref validation as a raw ZodError; the
  proposer now refuses it by name ("outside the token-ref grammar — rename the
  variable or map it manually"). Foreign vocabularies hold surprises;
  refusals must name them.
- **Unbound gradient backgrounds** — all four Alert variants paint their
  background with a raw `GRADIENT_LINEAR`, bound to no variable. Dump v1
  carries solid paints only (a declared limit, same taxonomy as the REST
  mapper's `paint-unsupported`); background styling lands on the reviewer.
- **Non-token text styles** (`body/md-bold`, `body/sm`) — named, typography
  not proposed.
- **Same icon on every variant** (`check circle` on success AND danger AND
  warning) — visible in the dump; kit-rot material for Eventz's own review.
- Core follow-up filed: an unknown component ref must refuse by name, not
  TypeError.

The pitch line this earns: *a component someone else drew became a governed
contract and a working React component in one sitting, and every gap in
between was named, not papered over.*
