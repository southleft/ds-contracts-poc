# Astryx dev-journey — flagship × vendor `.doc.mjs` cross-check

Rebuild: `node examples/astryx/scripts/flagship-doc-crosscheck.mjs`

Meta's own `<Name>.doc.mjs` modules (shipped inside `@astryxdesign/core@0.1.6`)
are the independent witness of the API. Phase A ran that witness against the
whole census — **246 vendor-documented props, 0 silent losses**
(`../extraction/DOC-REFEREE.md`). This tail ties the 10 promoted flagship
contracts back to that witnessed extraction: every promoted prop is verbatim
from the `.doc.mjs`-witnessed proposal or a declared materialization; every
drop is named.

- **42 props promoted verbatim** from the witnessed proposals
- **3 declared materializations** (ReactNode child → text slot)
- **49 props dropped, all named** (the honest losses)
- **0 invented props** (the run refuses otherwise)

| contract | promoted | dropped (named) |
|---|---|---|
| `badge` | 1 verbatim + 1 materialized (children) | — |
| `banner` | 3 verbatim + 1 materialized (children) | `defaultIsExpanded` |
| `button` | 6 verbatim | `type`, `name`, `form`, `isInterruptible`, `tooltip`, `href`, `target`, `rel` |
| `card` | 1 verbatim + 1 materialized (children) | — |
| `checkbox-input` | 5 verbatim | `isLabelHidden`, `description`, `isLoading`, `htmlName`, `disabledMessage`, `isOptional` |
| `progress-bar` | 6 verbatim | `isLabelHidden`, `hasValueLabel` |
| `slider` | 5 verbatim | `value`, `isLabelHidden`, `description`, `disabledMessage`, `isOptional`, `labelTooltip`, `min`, `max`, `step`, `htmlName`, `minStepsBetweenThumbs` |
| `switch` | 4 verbatim | `isLabelHidden`, `description`, `isLoading`, `value`, `htmlName`, `disabledMessage`, `isOptional`, `labelTooltip`, `labelSpacing` |
| `text-input` | 7 verbatim | `isLabelHidden`, `description`, `isOptional`, `disabledMessage`, `isLoading`, `value`, `labelTooltip`, `hasAutoFocus`, `htmlName` |
| `token` | 4 verbatim | `href`, `description`, `isLabelHidden` |

The full per-prop vendor agreements/disagreements live in
`../extraction/DOC-REFEREE.md`.
