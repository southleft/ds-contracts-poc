# InlineNotification — carbon console-loop receipt

**Status:** completed  
**File:** `GnQnjSNBXtgtd2Ht0Hs1C8` (DS Contracts Testing)  
**contractId:** `carbon.inlinenotification`  
**Recorded:** 2026-08-06T05:47:05.837Z
**reSyncedAt:** 2026-08-07T16:37:22.237Z

## Generate

Uploaded `examples/carbon/figma/inline-notification.figma.js` via `ds_loop_script` clientStorage chunks (`/run-script` on bridge :9228), then eval’d.

- **nodeId:** `1:5824` (COMPONENT_SET on page **InlineNotification**, section `1:5825`)
- **variants:** 12
- **properties:** Kind, Contrast

## Screenshot

InlineNotification COMPONENT_SET 1:5824: 12 variant(s), 2 prop def(s) on page InlineNotification. Screenshot export of section/node 1:5825 ok (93178 bytes PNG@2x). First root fill bound to imported/inline-notification/root/background-color/error/high. Structure looks sane; slot placeholders OK.

## Fingerprint (v6)

- **hash:** `v6:1173442392`
- **lineCount:** 850

## Round-trip

Compared canvas props to `examples/carbon/contracts/inlinenotification.contract.json`.

- **MATCH axes:** Kind enum → Error/Info/Info Square/Success/Warning/Warning Alt, Contrast enum → High/Low, first-variant fill bound: imported/inline-notification/root/background-color/error/high
- **GAPS:** canvas-absent: no State axis (contract has empty/absent states)
- **MISMATCH:** none

## Acceptance

generatedOrFound ✓ · screenshotReviewed ✓ · zeroMismatch ✓

## Visual match (developed)

- reviewedAt: `2026-08-06T13:32:20.271Z`
- matchDeveloped: **false**
- note: Re-synced via clientStorage chunks (n=19, total=148301); amended nodeId=1:5824; rebuiltVariants=12. matchDeveloped left false.
- reference: extract/computed/out/carbon/inlinenotification/receipts/pair--error.high__default.png
- defect: Warning/status iconography fidelity and layout artifacts not match to computed pairs — fail closed.

## 2026-08-08 — Track-2 hill-climb round 1

- regenerated (nodeId=60:10344): details margin-left 13px now applied. Root hugs at 346px under the task-#37 hug-ceiling doctrine (showcase-width 428px is a harness fact) so the 428px-framed ref scores 25.31 — fail-closed; the earlier 6.67 near-miss was a stale canvas with the pre-wave baked width.
