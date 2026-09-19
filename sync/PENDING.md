<!-- GENERATED from sync/ledger.json by `npm run sync -- pending` (and by every sync:spine run). Do not hand-edit: sync:ledger:check refuses a PENDING.md that is not the current render. -->

# Sync decisions — pending Figma writes and human choices

Every row below carries a **recorded** decision in `sync/ledger.json`. The scheduled spine (`.github/workflows/sync-spine.yml`) stays **green with a warning** while these are listed; it goes **red only for a row with no recorded decision** (or a decision whose facts have since moved). A `pending-*` row is resolved by a human running the command shown — it is a Figma write to a non-scratch file, or a choice between two truths, and automation does not do either. After the write, record it: `npm run sync:observe -- --adopt <id>` (or `npm run sync -- record …`), which clears the decision.

**6 pending** (3 pending-reapply, 1 pending-restamp, 2 pending-reconcile) · **53 adopted**.

## Pending re-apply — the code is ahead; the canvas needs a publish+apply (Figma write) (3)

### `flowbite.alert`

- **row**: `flowbite.alert@GnQnjSNBXtgtd2Ht0Hs1C8` — contract `examples/tailwind/contracts/alert.contract.json`, set `1:2098`
- **kind**: pending-reapply (recorded 2026-09-19)
- **why**: code is ahead: the dismiss button became a declared event (968958cd, 2026-08-16) after the last canvas write (2026-08-08); re-applying is a Figma write to GnQnjSNBXtgtd2Ht0Hs1C8 [Re-recorded unchanged on 2026-09-18 because the dump grammar moved 1.32 → 1.34 (additive: letter spacing, per-side stroke weights) and again, the same day, 1.34 → 1.35 (additive: strokesIncludedInLayout), and on 2026-09-19 1.35 → 1.36 (additive: text textAutoResize) — grammar bump only. NOT REVIEWED: the contract hash had ALSO moved since this was recorded on 2026-08-23; this re-record keeps the marker pending and does not assess that change. Owner review still required.] [AGENT grammar migration 2026-09-19: fresh REST observation under 1.37 (explicit fixed manual-box capture). The previous pending decision is retained; no canvas write or reconciliation is authorized or claimed, and no historical unresolved issue is assessed as resolved.] [AGENT grammar migration 2026-09-19: fresh REST GET with geometry=paths under 1.38. Prior pending decision, unresolved drift and owner review remain; no canvas write or reconciliation authorized or claimed.]
- **command**: `Figma desktop → open file GnQnjSNBXtgtd2Ht0Hs1C8 → Sync Runner plugin → "Paste a script" tab → paste examples/tailwind/figma/alert.figma.js (amend-capable: reconciles set 1:2098 in place and restamps v6; byte-fresh per `npm run figma:fresh`) → Run script → then record: npm run sync:observe -- --adopt flowbite.alert --note "re-applied from 968958cd"`
- **writes to**: Figma file `GnQnjSNBXtgtd2Ht0Hs1C8`, set `1:2098` — not the scratch file; a human runs it
- **evidence**:
  - drift at decision time: conflict (canvas evidence stamp); contract hash sha256:f289220abd4398ce6ca7bdf15bfa123e2992e93a5e6fd6f7263aaf8ff5edd7ab; observed stamp v6:941557944, dump dumpv1:1149353556 (grammar 1.38), file version 2390537264651373038
  - AGENT: 1.38 re-observation only; the previous pending decision is retained without resolving it.

### `flowbite.toggleswitch`

- **row**: `flowbite.toggleswitch@GnQnjSNBXtgtd2Ht0Hs1C8` — contract `examples/tailwind/contracts/toggleswitch.contract.json`, set `1:2296`
- **kind**: pending-reapply (recorded 2026-09-19)
- **why**: genuine code-ahead: role=switch + onToggle event + root align landed in the contract (968958cd, 2026-08-16) and the canvas still carries the 2026-08-06 stamp; re-applying is a Figma write to GnQnjSNBXtgtd2Ht0Hs1C8 [Re-recorded unchanged on 2026-09-18 because the dump grammar moved 1.32 → 1.34 (additive: letter spacing, per-side stroke weights) and again, the same day, 1.34 → 1.35 (additive: strokesIncludedInLayout), and on 2026-09-19 1.35 → 1.36 (additive: text textAutoResize) — grammar bump only. NOT REVIEWED: the contract hash had ALSO moved since this was recorded on 2026-08-23; this re-record keeps the marker pending and does not assess that change. Owner review still required.] [AGENT grammar migration 2026-09-19: fresh REST observation under 1.37 (explicit fixed manual-box capture). The previous pending decision is retained; no canvas write or reconciliation is authorized or claimed, and no historical unresolved issue is assessed as resolved.] [AGENT grammar migration 2026-09-19: fresh REST GET with geometry=paths under 1.38. Prior pending decision, unresolved drift and owner review remain; no canvas write or reconciliation authorized or claimed.]
- **command**: `Figma desktop → open file GnQnjSNBXtgtd2Ht0Hs1C8 → Sync Runner plugin → "Paste a script" tab → paste examples/tailwind/figma/toggle-switch.figma.js (amend-capable: reconciles set 1:2296 in place and restamps v6; byte-fresh per `npm run figma:fresh`) → Run script → then record: npm run sync:observe -- --adopt flowbite.toggleswitch --note "re-applied from 968958cd"`
- **writes to**: Figma file `GnQnjSNBXtgtd2Ht0Hs1C8`, set `1:2296` — not the scratch file; a human runs it
- **evidence**:
  - drift at decision time: code-ahead (canvas evidence stamp); contract hash sha256:3eb8702c078996ace0456795c60c9f623e60be89180fd3ef6fc11b8017b18794; observed stamp v6:3468428338, dump dumpv1:1932270405 (grammar 1.38), file version 2390537264651373038
  - AGENT: 1.38 re-observation only; the previous pending decision is retained without resolving it.

### `mui.slider`

- **row**: `mui.slider@59mLQlOMiD5w5za6SUcoO5` — contract `examples/mui/contracts/slider.contract.json`, set `21:509`
- **kind**: pending-reapply (recorded 2026-09-19)
- **why**: code is ahead: the slider-thumb shadow-pseudo fold landed in the contract (01aa5243, 2026-08-11T17:28Z) 1 h 48 min after the last canvas write (2026-08-11T15:40Z); re-applying is a Figma write to 59mLQlOMiD5w5za6SUcoO5 [Re-recorded unchanged on 2026-09-18 because the dump grammar moved 1.32 → 1.34 (additive: letter spacing, per-side stroke weights) and again, the same day, 1.34 → 1.35 (additive: strokesIncludedInLayout), and on 2026-09-19 1.35 → 1.36 (additive: text textAutoResize) — grammar bump only. NOT REVIEWED: the contract hash had ALSO moved since this was recorded on 2026-08-23; this re-record keeps the marker pending and does not assess that change. Owner review still required.] [AGENT grammar migration 2026-09-19: fresh REST observation under 1.37 (explicit fixed manual-box capture). The previous pending decision is retained; no canvas write or reconciliation is authorized or claimed, and no historical unresolved issue is assessed as resolved.] [AGENT grammar migration 2026-09-19: fresh REST GET with geometry=paths under 1.38. Prior pending decision, unresolved drift and owner review remain; no canvas write or reconciliation authorized or claimed.]
- **command**: `Figma desktop → open file 59mLQlOMiD5w5za6SUcoO5 → Sync Runner plugin → "Paste a script" tab → paste examples/mui/figma/slider.figma.js (amend-capable: reconciles set 21:509 in place and restamps v6; byte-fresh per `npm run figma:fresh`) → Run script → then record: npm run sync:observe -- --adopt mui.slider --note "re-applied from 01aa5243"`
- **writes to**: Figma file `59mLQlOMiD5w5za6SUcoO5`, set `21:509` — not the scratch file; a human runs it
- **evidence**:
  - drift at decision time: conflict (canvas evidence stamp); contract hash sha256:1b2b04181f94513f19778a550508df0acbf2ff49bb79c96984fd6a111f97ddba; observed stamp v6:2972081627, dump dumpv1:2373807250 (grammar 1.38), file version 2389961688576685812
  - AGENT: 1.38 re-observation only; the previous pending decision is retained without resolving it.

## Pending restamp — the set lost its v6 stamp; re-run its sync script (Figma write) (1)

### `altitude.avatar`

- **row**: `altitude.avatar@GnQnjSNBXtgtd2Ht0Hs1C8` — contract `examples/altitude/contracts/avatar.contract.json`, set `1:10498`
- **kind**: pending-restamp (recorded 2026-09-19)
- **why**: the set carries no ds_contracts/canvasFingerprint stamp (content unchanged); restamping means re-running its sync script — a Figma write to GnQnjSNBXtgtd2Ht0Hs1C8 [Re-recorded unchanged on 2026-09-18 because the dump grammar moved 1.32 → 1.34 (additive: letter spacing, per-side stroke weights) and again, the same day, 1.34 → 1.35 (additive: strokesIncludedInLayout), and on 2026-09-19 1.35 → 1.36 (additive: text textAutoResize) — grammar bump only. NOT REVIEWED: the contract hash had ALSO moved since this was recorded on 2026-08-23; this re-record keeps the marker pending and does not assess that change. Owner review still required.] [AGENT grammar migration 2026-09-19: fresh REST observation under 1.37 (explicit fixed manual-box capture). The previous pending decision is retained; no canvas write or reconciliation is authorized or claimed, and no historical unresolved issue is assessed as resolved.] [AGENT grammar migration 2026-09-19: fresh REST GET with geometry=paths under 1.38. Prior pending decision, unresolved drift and owner review remain; no canvas write or reconciliation authorized or claimed.]
- **command**: `Figma desktop → open file GnQnjSNBXtgtd2Ht0Hs1C8 → Sync Runner plugin → "Paste a script" tab → paste examples/altitude/figma/avatar.figma.js (amend-capable: reconciles set 1:10498 in place and restamps v6; byte-fresh per `npm run figma:fresh`) → Run script → then record: npm run sync:observe -- --adopt altitude.avatar --note "restamped 2026-08-23"`
- **writes to**: Figma file `GnQnjSNBXtgtd2Ht0Hs1C8`, set `1:10498` — not the scratch file; a human runs it
- **evidence**:
  - drift at decision time: code-ahead (canvas evidence none); contract hash sha256:5e1612af536e12c4db88467ccf5912d3a8a991cbfbc39492ef69b4beec7eba66; observed stamp none, dump dumpv1:4186746087 (grammar 1.38), file version 2390537264651373038
  - AGENT: 1.38 re-observation only; the previous pending decision is retained without resolving it.

## Pending reconcile — both halves moved; a human chooses which wins (2)

### `mui.fab`

- **row**: `mui.fab@59mLQlOMiD5w5za6SUcoO5` — contract `examples/mui/contracts/fab.contract.json`, set `84:1743`
- **kind**: pending-reconcile (recorded 2026-09-19)
- **why**: both halves moved in the same minute on 2026-08-17 (canvas hand-edit without restamp 12:30:29Z; contract commit 16889547 12:30:08Z) — a human chooses whether the reviewed canvas or the authored contract is the truth [Re-recorded unchanged on 2026-09-18 because the dump grammar moved 1.32 → 1.34 (additive: letter spacing, per-side stroke weights) and again, the same day, 1.34 → 1.35 (additive: strokesIncludedInLayout), and on 2026-09-19 1.35 → 1.36 (additive: text textAutoResize) — grammar bump only. NOT REVIEWED: the contract hash had ALSO moved since this was recorded on 2026-08-23; this re-record keeps the marker pending and does not assess that change. Owner review still required.] [AGENT grammar migration 2026-09-19: fresh REST observation under 1.37 (explicit fixed manual-box capture). The previous pending decision is retained; no canvas write or reconciliation is authorized or claimed, and no historical unresolved issue is assessed as resolved.] [AGENT grammar migration 2026-09-19: fresh REST GET with geometry=paths under 1.38. Prior pending decision, unresolved drift and owner review remain; no canvas write or reconciliation authorized or claimed.]
- **command**: `CHOOSE ONE — (a) the canvas is the truth (keep the 2026-08-17 hand-fix): npm run sync:observe -- --adopt mui.fab --note "canvas wins: 08-17 review fix kept"  |  (b) the contract is the truth: Figma desktop → open 59mLQlOMiD5w5za6SUcoO5 → Sync Runner plugin → "Paste a script" tab → paste examples/mui/figma/fab.figma.js (amends set 84:1743 in place, restamps v6) → Run script → npm run sync:observe -- --adopt mui.fab --note "re-applied from 16889547"`
- **writes to**: Figma file `59mLQlOMiD5w5za6SUcoO5`, set `84:1743` — not the scratch file; a human runs it
- **evidence**:
  - drift at decision time: code-ahead (canvas evidence stamp); contract hash sha256:42befa146883de73f556f4a13fb96a347f3f15245734d9053025e00935945166; observed stamp v6:2082406472, dump dumpv1:702901668 (grammar 1.38), file version 2389961688576685812
  - AGENT: 1.38 re-observation only; the previous pending decision is retained without resolving it.

### `mui.link`

- **row**: `mui.link@59mLQlOMiD5w5za6SUcoO5` — contract `examples/mui/contracts/link.contract.json`, set `84:1832`
- **kind**: pending-reconcile (recorded 2026-09-19)
- **why**: both halves moved in the same minute on 2026-08-17 (canvas hand-edit without restamp 12:30:29Z; contract commit 16889547 12:30:08Z) — a human chooses whether the reviewed canvas or the authored contract is the truth [Re-recorded unchanged on 2026-09-18 because the dump grammar moved 1.32 → 1.34 (additive: letter spacing, per-side stroke weights) and again, the same day, 1.34 → 1.35 (additive: strokesIncludedInLayout), and on 2026-09-19 1.35 → 1.36 (additive: text textAutoResize) — grammar bump only. Only the grammar had moved for this row.] [AGENT grammar migration 2026-09-19: fresh REST observation under 1.37 (explicit fixed manual-box capture). The previous pending decision is retained; no canvas write or reconciliation is authorized or claimed, and no historical unresolved issue is assessed as resolved.] [AGENT grammar migration 2026-09-19: fresh REST GET with geometry=paths under 1.38. Prior pending decision, unresolved drift and owner review remain; no canvas write or reconciliation authorized or claimed.]
- **command**: `CHOOSE ONE — (a) the canvas is the truth (keep the 2026-08-17 hand-fix): npm run sync:observe -- --adopt mui.link --note "canvas wins: 08-17 review fix kept"  |  (b) the contract is the truth: Figma desktop → open 59mLQlOMiD5w5za6SUcoO5 → Sync Runner plugin → "Paste a script" tab → paste examples/mui/figma/link.figma.js (amends set 84:1832 in place, restamps v6) → Run script → npm run sync:observe -- --adopt mui.link --note "re-applied from 16889547"`
- **writes to**: Figma file `59mLQlOMiD5w5za6SUcoO5`, set `84:1832` — not the scratch file; a human runs it
- **evidence**:
  - drift at decision time: code-ahead (canvas evidence stamp); contract hash sha256:53d3814ea6390478f606061835ce8a5a4073c8732ff5d4d26dc375db8f3084d2; observed stamp v6:3316422374, dump dumpv1:2553000615 (grammar 1.38), file version 2389961688576685812
  - AGENT: 1.38 re-observation only; the previous pending decision is retained without resolving it.

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
