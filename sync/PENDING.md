<!-- GENERATED from sync/ledger.json by `npm run sync -- pending` (and by every sync:spine run). Do not hand-edit: sync:ledger:check refuses a PENDING.md that is not the current render. -->

# Sync decisions — pending Figma writes and human choices

Every row below carries a **recorded** decision in `sync/ledger.json`. The scheduled spine (`.github/workflows/sync-spine.yml`) stays **green with a warning** while these are listed; it goes **red only for a row with no recorded decision** (or a decision whose facts have since moved). A `pending-*` row is resolved by a human running the command shown — it is a Figma write to a non-scratch file, or a choice between two truths, and automation does not do either. After the write, record it: `npm run sync:observe -- --adopt <id>` (or `npm run sync -- record …`), which clears the decision.

**6 pending** (3 pending-reapply, 1 pending-restamp, 2 pending-reconcile) · **53 adopted**.

## Pending re-apply — the code is ahead; the canvas needs a publish+apply (Figma write) (3)

### `flowbite.alert`

- **row**: `flowbite.alert@GnQnjSNBXtgtd2Ht0Hs1C8` — contract `examples/tailwind/contracts/alert.contract.json`, set `1:2098`
- **kind**: pending-reapply (recorded 2026-08-23)
- **why**: code is ahead: the dismiss button became a declared event (968958cd, 2026-08-16) after the last canvas write (2026-08-08); re-applying is a Figma write to GnQnjSNBXtgtd2Ht0Hs1C8
- **command**: `Figma desktop → open file GnQnjSNBXtgtd2Ht0Hs1C8 → Sync Runner plugin → "Paste a script" tab → paste examples/tailwind/figma/alert.figma.js (amend-capable: reconciles set 1:2098 in place and restamps v6; byte-fresh per `npm run figma:fresh`) → Run script → then record: npm run sync:observe -- --adopt flowbite.alert --note "re-applied from 968958cd"`
- **writes to**: Figma file `GnQnjSNBXtgtd2Ht0Hs1C8`, set `1:2098` — not the scratch file; a human runs it
- **evidence**:
  - drift at decision time: conflict (canvas evidence stamp); contract hash sha256:88359167eacb3fb3104b1394021c79466a1999fdd4d0d722425a5e9593181fbb; observed stamp v6:941557944, dump dumpv1:4197814634 (grammar 1.31), file version 2390537264651373038
  - canvas (Figma versions API, read-only): set 1:2098 stamp last moved 2026-08-08T07:35:42Z (v6:941557944 = observed now, version 2385245229284424737, TJ Pitre); unchanged through every later version
  - code: the only semantic contract commit is 968958cd 2026-08-16T23:38:13Z (props, dismiss element/attrs/description, events: onDismiss); dbeb3575 + 763b0f86 are bookkeeping (codemod, anchors)
  - verdict: code is 8 days newer → canvas is behind → pending-reapply

### `flowbite.toggleswitch`

- **row**: `flowbite.toggleswitch@GnQnjSNBXtgtd2Ht0Hs1C8` — contract `examples/tailwind/contracts/toggleswitch.contract.json`, set `1:2296`
- **kind**: pending-reapply (recorded 2026-08-23)
- **why**: genuine code-ahead: role=switch + onToggle event + root align landed in the contract (968958cd, 2026-08-16) and the canvas still carries the 2026-08-06 stamp; re-applying is a Figma write to GnQnjSNBXtgtd2Ht0Hs1C8
- **command**: `Figma desktop → open file GnQnjSNBXtgtd2Ht0Hs1C8 → Sync Runner plugin → "Paste a script" tab → paste examples/tailwind/figma/toggle-switch.figma.js (amend-capable: reconciles set 1:2296 in place and restamps v6; byte-fresh per `npm run figma:fresh`) → Run script → then record: npm run sync:observe -- --adopt flowbite.toggleswitch --note "re-applied from 968958cd"`
- **writes to**: Figma file `GnQnjSNBXtgtd2Ht0Hs1C8`, set `1:2296` — not the scratch file; a human runs it
- **evidence**:
  - drift at decision time: code-ahead (canvas evidence stamp); contract hash sha256:3e9089a96a5287cf7d87fb82b82276d71def69bae78ca7de8e545f98f62da5f4; observed stamp v6:3468428338, dump dumpv1:327010899 (grammar 1.31), file version 2390537264651373038
  - canvas (Figma versions API, read-only): set 1:2296 stamp v6:3468428338 == ledger since 2026-08-06T15:14:25Z; dump last moved 2026-08-07T04:32:19Z (before the 08-08 seed; the 08-08 mapper reproduces the baseline) — the canvas has not moved since the receipt
  - code: the only semantic contract commit is 968958cd 2026-08-16T23:38:13Z (semantics.role, roleException, root layout align, events: onToggle); dbeb3575 + 763b0f86 are bookkeeping
  - verdict: code moved, canvas did not → pending-reapply

### `mui.slider`

- **row**: `mui.slider@59mLQlOMiD5w5za6SUcoO5` — contract `examples/mui/contracts/slider.contract.json`, set `21:509`
- **kind**: pending-reapply (recorded 2026-08-23)
- **why**: code is ahead: the slider-thumb shadow-pseudo fold landed in the contract (01aa5243, 2026-08-11T17:28Z) 1 h 48 min after the last canvas write (2026-08-11T15:40Z); re-applying is a Figma write to 59mLQlOMiD5w5za6SUcoO5
- **command**: `Figma desktop → open file 59mLQlOMiD5w5za6SUcoO5 → Sync Runner plugin → "Paste a script" tab → paste examples/mui/figma/slider.figma.js (amend-capable: reconciles set 21:509 in place and restamps v6; byte-fresh per `npm run figma:fresh`) → Run script → then record: npm run sync:observe -- --adopt mui.slider --note "re-applied from 01aa5243"`
- **writes to**: Figma file `59mLQlOMiD5w5za6SUcoO5`, set `21:509` — not the scratch file; a human runs it
- **evidence**:
  - drift at decision time: conflict (canvas evidence stamp); contract hash sha256:c91b6cf3cfe10ed0a1302557eebd4adbd2e913db56ac850d84bf6a51d6c5ee86; observed stamp v6:2972081627, dump dumpv1:1907087401 (grammar 1.31), file version 2389961688576685812
  - canvas (Figma versions API, read-only): set 21:509 stamp moved 2026-08-10T18:45:18Z (v5→v6:1845442048) and 2026-08-11T15:40:41Z (v6:2972081627 = observed now, version 2386493120203841936, TJ Pitre); unchanged since
  - code: the only semantic contract commit is 01aa5243 2026-08-11T17:28:31Z (slider-thumb literals/literalsByProp); dbeb3575 is bookkeeping
  - verdict: code is newer (by 1 h 48 min) → canvas is behind → pending-reapply

## Pending restamp — the set lost its v6 stamp; re-run its sync script (Figma write) (1)

### `altitude.avatar`

- **row**: `altitude.avatar@GnQnjSNBXtgtd2Ht0Hs1C8` — contract `examples/altitude/contracts/avatar.contract.json`, set `1:10498`
- **kind**: pending-restamp (recorded 2026-08-23)
- **why**: the set carries no ds_contracts/canvasFingerprint stamp (content unchanged); restamping means re-running its sync script — a Figma write to GnQnjSNBXtgtd2Ht0Hs1C8
- **command**: `Figma desktop → open file GnQnjSNBXtgtd2Ht0Hs1C8 → Sync Runner plugin → "Paste a script" tab → paste examples/altitude/figma/avatar.figma.js (amend-capable: reconciles set 1:10498 in place and restamps v6; byte-fresh per `npm run figma:fresh`) → Run script → then record: npm run sync:observe -- --adopt altitude.avatar --note "restamped 2026-08-23"`
- **writes to**: Figma file `GnQnjSNBXtgtd2Ht0Hs1C8`, set `1:10498` — not the scratch file; a human runs it
- **evidence**:
  - drift at decision time: code-ahead (canvas evidence none); contract hash sha256:1a68884844ea208e2967ff0f4e8437f226a97f4ca0cb653f7f8a1cfda7cfe64f; observed stamp none, dump dumpv1:3160575606 (grammar 1.31), file version 2390537264651373038
  - canvas (Figma versions API, read-only): set 1:10498 has NO canvasFingerprint at any of the 30 most recent versions (2026-08-06T14:01:14Z → now); the receipt's write (2026-08-06T05:49:25Z, v6:923243794) predates that window; the dump is identical across all 30 versions (dumpv1:3160575606) and the 08-08 mapper reproduces the baseline — content unchanged
  - code: only the schema-17 codemod dbeb3575 touched the contract (bookkeeping)
  - verdict: nothing to reconcile; the canvas merely needs its stamp back → pending-restamp, then --adopt

## Pending reconcile — both halves moved; a human chooses which wins (2)

### `mui.fab`

- **row**: `mui.fab@59mLQlOMiD5w5za6SUcoO5` — contract `examples/mui/contracts/fab.contract.json`, set `84:1743`
- **kind**: pending-reconcile (recorded 2026-08-23)
- **why**: both halves moved in the same minute on 2026-08-17 (canvas hand-edit without restamp 12:30:29Z; contract commit 16889547 12:30:08Z) — a human chooses whether the reviewed canvas or the authored contract is the truth
- **command**: `CHOOSE ONE — (a) the canvas is the truth (keep the 2026-08-17 hand-fix): npm run sync:observe -- --adopt mui.fab --note "canvas wins: 08-17 review fix kept"  |  (b) the contract is the truth: Figma desktop → open 59mLQlOMiD5w5za6SUcoO5 → Sync Runner plugin → "Paste a script" tab → paste examples/mui/figma/fab.figma.js (amends set 84:1743 in place, restamps v6) → Run script → npm run sync:observe -- --adopt mui.fab --note "re-applied from 16889547"`
- **writes to**: Figma file `59mLQlOMiD5w5za6SUcoO5`, set `84:1743` — not the scratch file; a human runs it
- **evidence**:
  - drift at decision time: code-ahead (canvas evidence stamp); contract hash sha256:0f83656df4db10b872279c3881c54afd8b5d923f2cee21d16d6e27f0df56f540; observed stamp v6:2082406472, dump dumpv1:527766217 (grammar 1.31), file version 2389961688576685812
  - canvas (Figma versions API, read-only): set 84:1743 stamp v6:2082406472 == ledger since 2026-08-06T05:07:02Z (never restamped); dump moved 2026-08-17T12:30:29Z (version 2388670813585618209, TJ Pitre) — VISUAL-REVIEW-2026-08-17.md: circles at 56/48/40, duplicate set 84:1954 deleted, grid reflowed; the 1.5-grammar baseline that first proved this move was dropped by the 08-23 re-baseline (sync/receipts/2026-08-23-spine-reconciliation.md, class D2, is the record)
  - code: the only semantic contract commit is 16889547 2026-08-17T12:30:08Z (anatomy.root.tokensByProp: authored 40/48/56 boxes); dbeb3575 is bookkeeping
  - what a human must choose: whether the reviewed canvas (hand-reflowed, unstamped) or the authored contract boxes are the truth; if (b), the re-apply overwrites the hand reflow

### `mui.link`

- **row**: `mui.link@59mLQlOMiD5w5za6SUcoO5` — contract `examples/mui/contracts/link.contract.json`, set `84:1832`
- **kind**: pending-reconcile (recorded 2026-08-23)
- **why**: both halves moved in the same minute on 2026-08-17 (canvas hand-edit without restamp 12:30:29Z; contract commit 16889547 12:30:08Z) — a human chooses whether the reviewed canvas or the authored contract is the truth
- **command**: `CHOOSE ONE — (a) the canvas is the truth (keep the 2026-08-17 hand-fix): npm run sync:observe -- --adopt mui.link --note "canvas wins: 08-17 review fix kept"  |  (b) the contract is the truth: Figma desktop → open 59mLQlOMiD5w5za6SUcoO5 → Sync Runner plugin → "Paste a script" tab → paste examples/mui/figma/link.figma.js (amends set 84:1832 in place, restamps v6) → Run script → npm run sync:observe -- --adopt mui.link --note "re-applied from 16889547"`
- **writes to**: Figma file `59mLQlOMiD5w5za6SUcoO5`, set `84:1832` — not the scratch file; a human runs it
- **evidence**:
  - drift at decision time: code-ahead (canvas evidence stamp); contract hash sha256:53d3814ea6390478f606061835ce8a5a4073c8732ff5d4d26dc375db8f3084d2; observed stamp v6:3316422374, dump dumpv1:2837578434 (grammar 1.31), file version 2389961688576685812
  - canvas (Figma versions API, read-only): set 84:1832 stamp v6:3316422374 == ledger since 2026-08-06T05:07:02Z (never restamped); dump moved 2026-08-17T12:30:29Z (version 2388670813585618209, TJ Pitre) — root layout HORIZONTAL/CENTER → VERTICAL/MIN (reconciliation receipt D2 row); VISUAL-REVIEW-2026-08-17.md: 'Link' on one line (31×19); the 1.5-grammar baseline that first proved this move was dropped by the 08-23 re-baseline
  - code: the only semantic contract commit is 16889547 2026-08-17T12:30:08Z (anatomy.root.tokens.width dropped so the label hugs); dbeb3575 is bookkeeping
  - what a human must choose: whether the reviewed canvas (hand-edited root layout, unstamped) or the authored contract (width dropped) is the truth; if (b), the re-apply overwrites the hand edit

## Adopted (53) — canvas taken as the truth, row in-sync by construction

| row | recorded | why |
|---|---|---|
| `altitude.button` | 2026-08-23 | 2026-08-23 adopt: canvas = session write (TJ/plugin 08-09..21); code moved only by schema-17 codemod/anchor re-point |
| `altitude.heading` | 2026-08-23 | 2026-08-23 adopt: canvas = session write (TJ/plugin 08-09..21); code moved only by schema-17 codemod/anchor re-point |
| `astryx.badge` | 2026-08-23 | 2026-08-23 adopt: canvas = session write (TJ/plugin 08-09..21); code moved only by schema-17 codemod/anchor re-point |
| `astryx.banner` | 2026-08-23 | 2026-08-23 adopt (B3): canvas write 2026-08-11 is newer than the semantic contract commit 98cfa8f2 (2026-08-09) |
| `astryx.button` | 2026-08-23 | 2026-08-23 adopt: canvas = session write (TJ/plugin 08-09..21); code moved only by schema-17 codemod/anchor re-point |
| `astryx.card` | 2026-08-23 | 2026-08-23 adopt: canvas = session write (TJ/plugin 08-09..21); code moved only by schema-17 codemod/anchor re-point |
| `astryx.checkbox-input` | 2026-08-23 | 2026-08-23 adopt: canvas = session write (TJ/plugin 08-09..21); code moved only by schema-17 codemod/anchor re-point |
| `astryx.dropdown-menu-item` | 2026-08-23 | 2026-08-23 adopt: canvas = session write (TJ/plugin 08-09..21); code moved only by schema-17 codemod/anchor re-point |
| `astryx.dropdown-menu` | 2026-08-23 | 2026-08-23 adopt: canvas = session write (TJ/plugin 08-09..21); code moved only by schema-17 codemod/anchor re-point |
| `astryx.progress-bar` | 2026-08-23 | 2026-08-23 adopt: canvas = session write (TJ/plugin 08-09..21); code moved only by schema-17 codemod/anchor re-point |
| `astryx.slider` | 2026-08-23 | 2026-08-23 adopt: canvas = session write (TJ/plugin 08-09..21); code moved only by schema-17 codemod/anchor re-point |
| `astryx.switch` | 2026-08-23 | 2026-08-23 adopt: canvas = session write (TJ/plugin 08-09..21); code moved only by schema-17 codemod/anchor re-point |
| `astryx.text-input` | 2026-08-23 | 2026-08-23 adopt: canvas = session write (TJ/plugin 08-09..21); code moved only by schema-17 codemod/anchor re-point |
| `astryx.toast` | 2026-08-23 | 2026-08-23 adopt: canvas = session write (TJ/plugin 08-09..21); code moved only by schema-17 codemod/anchor re-point |
| `astryx.token` | 2026-08-23 | 2026-08-23 adopt: canvas = session write (TJ/plugin 08-09..21); code moved only by schema-17 codemod/anchor re-point |
| `carbon.accordion` | 2026-08-23 | 2026-08-23 adopt: canvas = session write (TJ/plugin 08-09..21); code moved only by schema-17 codemod/anchor re-point |
| `carbon.checkbox` | 2026-08-23 | 2026-08-23 adopt: canvas = session write (TJ/plugin 08-09..21); code moved only by schema-17 codemod/anchor re-point |
| `carbon.iconbutton` | 2026-08-23 | 2026-08-23 adopt: canvas = session write (TJ/plugin 08-09..21); code moved only by schema-17 codemod/anchor re-point |
| `carbon.inlinenotification` | 2026-08-23 | 2026-08-23 adopt: canvas = session write (TJ/plugin 08-09..21); code moved only by schema-17 codemod/anchor re-point |
| `carbon.modal` | 2026-08-23 | 2026-08-23 adopt: canvas = session write (TJ/plugin 08-09..21); code moved only by schema-17 codemod/anchor re-point |
| `carbon.tabs` | 2026-08-23 | 2026-08-23 adopt: canvas = session write (TJ/plugin 08-09..21); code moved only by schema-17 codemod/anchor re-point |
| `carbon.tag` | 2026-08-23 | 2026-08-23 adopt: canvas = session write (TJ/plugin 08-09..21); code moved only by schema-17 codemod/anchor re-point |
| `carbon.textinput` | 2026-08-23 | 2026-08-23 adopt: canvas = session write (TJ/plugin 08-09..21); code moved only by schema-17 codemod/anchor re-point |
| `carbon.toggle` | 2026-08-23 | 2026-08-23 adopt: canvas = session write (TJ/plugin 08-09..21); code moved only by schema-17 codemod/anchor re-point |
| `ds.banner` | 2026-08-23 | 2026-08-23 adopt: canvas = session write (TJ/plugin 08-09..21); code moved only by schema-17 codemod/anchor re-point |
| `ds.card` | 2026-08-23 | 2026-08-23 adopt: canvas = session write (TJ/plugin 08-09..21); code moved only by schema-17 codemod/anchor re-point |
| `ds.token` | 2026-08-23 | 2026-08-23 adopt: canvas = session write (TJ/plugin 08-09..21); code moved only by schema-17 codemod/anchor re-point |
| `flowbite.button` | 2026-08-23 | 2026-08-23 adopt: canvas = session write (TJ/plugin 08-09..21); code moved only by schema-17 codemod/anchor re-point |
| `mui.accordion` | 2026-08-23 | 2026-08-23 adopt (B3): canvas write 2026-08-17T12:30:29Z is newer than the semantic contract commit 16889547 (2026-08-17T12:30:08Z) — same session, 21 s apart |
| `mui.alert` | 2026-08-23 | 2026-08-23 adopt: canvas = session write (TJ/plugin 08-09..21); code moved only by schema-17 codemod/anchor re-point |
| `mui.avatar` | 2026-08-23 | 2026-08-23 adopt (B3): canvas write 2026-08-17T12:30:29Z is newer than the semantic contract commit 16889547 (2026-08-17T12:30:08Z) — same session, 21 s apart |
| `mui.badge` | 2026-08-23 | 2026-08-23 adopt: canvas = session write (TJ/plugin 08-09..21); code moved only by schema-17 codemod/anchor re-point |
| `mui.checkbox` | 2026-08-23 | 2026-08-23 adopt: canvas = session write (TJ/plugin 08-09..21); code moved only by schema-17 codemod/anchor re-point |
| `mui.divider` | 2026-08-23 | 2026-08-23 adopt: canvas = session write (TJ/plugin 08-09..21); code moved only by schema-17 codemod/anchor re-point |
| `mui.drawer` | 2026-08-23 | 2026-08-23 adopt: canvas = session write (TJ/plugin 08-09..21); code moved only by schema-17 codemod/anchor re-point |
| `mui.paper` | 2026-08-23 | 2026-08-23 adopt: canvas = session write (TJ/plugin 08-09..21); code moved only by schema-17 codemod/anchor re-point |
| `mui.radio` | 2026-08-23 | 2026-08-23 adopt: canvas = session write (TJ/plugin 08-09..21); code moved only by schema-17 codemod/anchor re-point |
| `mui.select` | 2026-08-23 | 2026-08-23 adopt: canvas = session write (TJ/plugin 08-09..21); code moved only by schema-17 codemod/anchor re-point |
| `mui.switch` | 2026-08-23 | 2026-08-23 adopt: canvas = session write (TJ/plugin 08-09..21); code moved only by schema-17 codemod/anchor re-point |
| `mui.table` | 2026-08-23 | 2026-08-23 adopt: canvas = session write (TJ/plugin 08-09..21); code moved only by schema-17 codemod/anchor re-point |
| `mui.tabs` | 2026-08-23 | 2026-08-23 adopt: canvas = session write (TJ/plugin 08-09..21); code moved only by schema-17 codemod/anchor re-point |
| `mui.text-field` | 2026-08-23 | 2026-08-23 adopt: canvas = session write (TJ/plugin 08-09..21); code moved only by schema-17 codemod/anchor re-point |
| `polaris.avatar` | 2026-08-23 | 2026-08-23 adopt: canvas = session write (TJ/plugin 08-09..21); code moved only by schema-17 codemod/anchor re-point |
| `polaris.badge` | 2026-08-23 | 2026-08-23 adopt: canvas = session write (TJ/plugin 08-09..21); code moved only by schema-17 codemod/anchor re-point |
| `polaris.banner` | 2026-08-23 | 2026-08-23 adopt: canvas = session write (TJ/plugin 08-09..21); code moved only by schema-17 codemod/anchor re-point |
| `polaris.button` | 2026-08-23 | 2026-08-23 adopt: canvas = session write (TJ/plugin 08-09..21); code moved only by schema-17 codemod/anchor re-point |
| `polaris.checkbox` | 2026-08-23 | 2026-08-23 adopt: canvas = session write (TJ/plugin 08-09..21); code moved only by schema-17 codemod/anchor re-point |
| `polaris.progress-bar` | 2026-08-23 | 2026-08-23 adopt: canvas = session write (TJ/plugin 08-09..21); code moved only by schema-17 codemod/anchor re-point |
| `polaris.radio-button` | 2026-08-23 | 2026-08-23 adopt: canvas = session write (TJ/plugin 08-09..21); code moved only by schema-17 codemod/anchor re-point |
| `polaris.spinner` | 2026-08-23 | 2026-08-23 adopt: canvas = session write (TJ/plugin 08-09..21); code moved only by schema-17 codemod/anchor re-point |
| `polaris.tag` | 2026-08-23 | 2026-08-23 adopt: canvas = session write (TJ/plugin 08-09..21); code moved only by schema-17 codemod/anchor re-point |
| `polaris.text-field` | 2026-08-23 | 2026-08-23 adopt: canvas = session write (TJ/plugin 08-09..21); code moved only by schema-17 codemod/anchor re-point |
| `polaris.thumbnail` | 2026-08-23 | 2026-08-23 adopt: canvas = session write (TJ/plugin 08-09..21); code moved only by schema-17 codemod/anchor re-point |
