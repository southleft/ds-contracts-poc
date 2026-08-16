# WRAP — both journeys run, and the two holes the test named are closed

Branch `feat/font-slant-carry`, head `ae0838dc`. Not merged, not pushed.
Everything below was executed, not planned. The run-by-run receipt is
[TJ-TEST.md](TJ-TEST.md); this page is what you do with it.

---

## Open these tonight

**Canvas — code → design.** Figma file `59mLQlOMiD5w5za6SUcoO5` ("MUI Test 1"),
eight new pages, nothing pre-existing rebuilt:

| page | set | variants |
|---|---|---|
| `Button (flowbite.button)` | Button | 45 |
| `Badge (flowbite.badge)` | Badge | 24 |
| `ToggleSwitch` | ToggleSwitch | 6 |
| `HelperText` · `Label` | HelperText, Label | 5 each |
| `Alert (flowbite.alert)` | Alert | 4 |
| `Card (flowbite.card)` · `Kbd` | Card, Kbd | 1 each |

Start on `Button (flowbite.button)` — 45 cells, five colour rows, token-bound
to a `Tokens` collection with Light/Dark and 331 variables.

**Canvas — the non-destructive door.** Figma file `GnQnjSNBXtgtd2Ht0Hs1C8`,
page **`Label`** (node `85:12079`). It was created by a create-only apply on a
file that already held 5 of these 8 stems; Badge was refused and left
byte-identical in the same run.

**Code — design → code.** `/tmp/pathB2/generated/` — `BadgeFlowbiteBadge/` and
`ButtonFlowbiteButton/`, each `.tsx` + `.module.css` + `.stories.tsx` +
`index.ts`, inverted from the canvas sets above. `/tmp/pathA/generated/` holds
Alert, Label and ToggleSwitch from the first pass.

`/tmp` does not survive a reboot. To rebuild either, re-run the three Path A
verbs: dump → `npm run extract:figma -- <dump.json>` →
`generate --target react --stories`. The exact invocations are in TJ-TEST.md
§A5–A6.

---

## Closed

**W1 — the emitter and the inverter now agree on Badge and Button** (`8f879e14`).
`State` was never a contract prop; it is a Figma projection of the contract's
`states`, drawn sparsely (base grid at `Default`, plus one row per state per
primary-axis value). The reader demanded a full Cartesian, so Badge (24 vs 36)
and Button (45 vs 125) — the only two ragged stems, and the two you named —
were refused outright. The emitter now stamps the matrix it drew
(`ds_contracts/statePreviewAxis`), dump v1.21 carries it, and exact-projection
validates against that declaration.

`EXACT_MATRIX_RAGGED` was **not** weakened, and that was falsified rather than
asserted: a dropped row, an extra row, a wrong primary, a wrong pin, a
malformed marker and an absent marker all still refuse. A marker can only make
the reader stricter. A second wall behind it —
`EXACT_SEMANTIC_PROJECTION_AMBIGUOUS` — was closed the same way and stays armed
for any set that does not declare its axis.

Badge and Button now `propose` **exit 0** and `generate` **exit 0**. Badge's
proposed props come back as the source contract's props exactly.

**W2 — a create-only apply door** (`6bb874cb`). `globalThis.DS_CREATE_ONLY =
true` refuses an already-identified set by name instead of amending it, while
still creating stems the file lacks. No second identity scheme: the same
`resolveComponentIdentity` decides. Proven on `GnQnjSNBXtgtd2Ht0Hs1C8` — Badge
refused with node `1:2149`, fingerprint, specHash and all 24 variants identical
afterwards; Label created; 99 → 100 pages.

**W3 — the docs match the run** (`ae0838dc`). `docs/BETA.md` carries the eight
stems, the current bundle sha `af0a5dee245f036c…` (108,557 bytes), the
create-only door, and the canvas → code section. TJ-TEST.md got an addendum,
not a rewrite.

**W4 — no red this branch caused.** plugin:zip, figma:fresh (8/8 byte-fresh),
exact-projection:check, closure:check, font-slant, ledger:fresh,
capability:fresh, eval:registry:check, v1:definition:check, format:check and
lint all green. Touched evals green as `--only` subsets: 9/9 for the projection
and state lanes, 8/8 for the plugin and genesis lanes. The engine moved, so all
8 libraries were re-emitted, 8 GENESIS-BATCH files rebuilt, the dump re-embedded
and the engine receipt re-recorded (`eb0fafe60c07` → `28ee744d6133`).

---

## Named-left — human only

- **Publish, deploy, npm credentials.** Untouched. The source tree is ahead of
  the registry (`docs/27`).
- **Pilot, Wave 8 confirm, security.** Human rows.
- **W11-C — a foreign second implementation.** Not invented here, by direction.
- **The published-CLI bundle parity is now UNVERIFIED at eight stems.** It was
  byte-identical at five (`bb96f43e…`). Re-checking needs the network, so
  `docs/BETA.md` says unverified rather than restamping a number nobody proved.
- **`docs:check` has one failure and it is deliberate.** It fires while
  `evals/results.json` records 223/225, guarding every "N/N pass" claim.
  Closing it means fixing `mui-figma-genesis` and
  `child-wider-ratchet-and-script-freshness` — both out of scope all wave. The
  guard is correct; it was not softened to make a report green.
- **Pre-existing, not caused here:** `npm run typecheck` fails on
  `scripts/console-loop-alpha-composite-probe.mts:34` (missing `.d.ts` for
  `score-policy.mjs`). Verified red on a clean stash before any change.

---

## Do not expect

- **The inversion is not lossless.** Closing W1 made Path A *run* on stems it
  used to refuse. It did not make it faithful. Still lost, unchanged from
  TJ-TEST.md §A7: `font-weight`, `width`, `margin-left`/`margin-top`, `bottom`.
  Still degraded: real token refs come back as machine-minted provisional names
  (value survives, identity does not), `semantics.element` collapses to `div`
  so a generated ToggleSwitch is a `<div>`, `children` returns as `content`,
  and part names come back positional (`part-0`).
- **A set this system did not draw still refuses if it is ragged.** The
  declaration is what makes the sparse matrix legible; without it the full
  Cartesian remains the bar. That is correct — nothing can invert a matrix
  nobody declared.
- **`Y8Jhw6R49wTLuXZ0is2GmV` is unchanged.** It was never written to, in any
  commit this wave. Its eight shipped pages are exactly as you left them.
- **v1 is not shipped**, no kit climb, no seventh library, no Blockquote
  promote, nothing merged and nothing pushed.
- **Path B was not re-run from scratch** — the TJ-TEST.md receipt stands, and
  the only canvas writes this wave were the Badge/Button re-apply on
  `59mLQ…` (to carry the new marker) and the create-only proof on `GnQnjS…`.
