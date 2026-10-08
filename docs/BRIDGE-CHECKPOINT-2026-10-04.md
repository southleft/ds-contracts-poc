# Bridge measurement and pending qualification — October 4, 2026

The completed known-kit refresh at `5d25820b92c542d0337b67087771c96d5886ceb2` accounts for all 204 sets and 6,312 variants: **1,814 pass, 2,733 fail, 1,765 unverified (28.7%)**. The prior baseline was 1,228 pass, 2,688 fail, 2,396 unverified (19.5%). The net gain is 586 passes: 616 additions and 30 former passes now unverified. Radix Switch accounts for 29 losses and Assistive chip for one, all involving framing evidence. Source acquisition and framing qualification changed as well as generated output; the increase is not solely a code-generation gain.

This is not never-seen qualification. The independent reverse result remains 35 passing, four failing, and two source-refused cases out of 41 familiar Radix Button cases. The goal remains at least 80% first-pass on never-seen kits in both directions.

## Changes after the measured revision

- Accept implicit flex parents for cross-axis stretch when their declared layout already defaults to flex in both emitters. Absent layout and incompatible owners still refuse.
- Reuse text weight only from an already known style with the exact same source key and size when an axis token has no neighboring weight token. Explicit conflicts still refuse.
- Observe generated pseudo-element paint in consumer behavior checks. Unused CSS variables, absent pseudo-elements, and display-none pseudo-elements do not create visible transitions.
- Exercise declared sparse domains through legal directed transitions, with a complete source inventory and axis validation. Undrawn combinations remain outside the accepted runtime domain. Rectangular domains keep the existing path.
- Retain both raw Figma exports when their framing proof refuses, so diagnosis does not require another export. Image thresholds and framing rules remain unchanged.

These changes are not included in the completed refresh above. Public sparse import is still closed.

## Candidate evidence and remaining work

Input's isolated candidate meets saved-source image, text/icon, and size checks for all 315 declared variants. Its 3,712 legal transitions match fresh renders, its 441 undrawn combinations refuse, and native compilation preserves exactly 315 combinations. A missing file identity in the experimental child batch caused the earlier icon failures; the shipping wrapper already supplies that identity. Live native fidelity and shipping-path acceptance remain open.

ListItem's 197-row candidate completes 2,062 legal transitions, but all visual verdicts remain unverified: its source component set is hidden and all render bounds are null. Native compilation also refuses the divider's combined collapse-on-empty and live Boolean visibility. Neither refusal was bypassed.

Local evidence is retained in the private paired-regression-integration archive, including checkpoints 608, 609, 611–617. Full fast-lane validation remains required before any push. Nothing has been pushed or released; the review page reports a local measurement.
