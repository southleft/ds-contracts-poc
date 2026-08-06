# ChatMessage — console-loop receipt

**Status:** completed  
**File:** `GnQnjSNBXtgtd2Ht0Hs1C8` (DS Contracts Testing)  
**Recorded:** 2026-08-06T03:59:10.652Z

## Generate

Uploaded `13-chatmessage.js` via `ds_loop_script` clientStorage chunks, then eval’d.

- **nodeId:** `1:1778` (COMPONENT_SET on page **ChatMessage**, section `1:1779`)
- **variants:** 3
- **properties:** Name#1:665, Avatar#1:669, Show Avatar#1:673, Children#1:677, Metadata#1:681, Show Metadata#1:685, Sender

## Screenshot

Spot-check: three chat-message variants with Assistant label, slot placeholders for avatar/body/actions, left vs right alignment; slot anatomy readable; no layout defects.

Screenshot of section/node 1:1779 captured (ok). ChatMessage: 3 variant(s); type COMPONENT_SET; page ChatMessage. Props: Name, Avatar, Show Avatar, Children, Metadata, Show Metadata, Sender. Sample text: "Slot", "Assistant", "Slot", "Slot".

## Fingerprint (v6)

- **hash:** `v6:2328098173`
- **lineCount:** 200

## Round-trip

Compared canvas props to `contracts/chat-message.contract.json`.

- **MATCH axes:** Sender, Name
- **GAPS:** canvas-absent: no State axis (contract has empty/absent states) — OK; canvas-absent: anatomy token channels beyond exposed component properties may live on styles/bindings — OK to note
- **MISMATCH:** none

## Acceptance

generated ✓ · screenshotReviewed ✓ · zeroMismatch ✓
