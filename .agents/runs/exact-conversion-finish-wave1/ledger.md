# Exact conversion finish — Wave 1

- Run ID: `exact-conversion-finish-wave1`
- Task type: conversion-core correctness
- Status: closed
- Current step: closed — conversion-core merge-ready; Wave 2 may start
- Branch: `feat/exact-conversion-wave0` (continued without committing Wave 0)
- Canonical measurement baseline: `accuracy/baseline.json` (R3 max 238)

## Intake

Targets:

- strict variant projection before design→contract proposal;
- nested component target identity through Figma emission;
- named text-style identity through capture, tokens, and emission;
- refusal of drawable-empty contracts;
- transactional `figma receive --apply`.

Acceptance:

1. Strict mode never reports a legacy, ragged, contradictory, or ambiguous set
   as exact.
2. A child reference resolves by contract ID, then anchor key; duplicate names
   cannot redirect it.
3. Named text styles survive by semantic identity or refuse by name.
4. Empty drawable anatomy cannot reach bundle publication or Apply as success.
5. Every receive/apply artifact commits atomically or none do.
6. R1–R6 decrease without shrinking denominators or weakening predicates.

## Triage

This wave changes shared conversion and filesystem-write seams. The receive/apply
slice is a `writes-mutations` seam and will receive independent security contract
review before closure. Conversion-core changes receive cold code review.

TRIAGE-SEAMS: writes-mutations@packages/cli/src/commands/figma.ts#commitReceiveWrites

## Checkpoints

- `intake-ready`: complete
- `plan-ready`: complete
- `implementation-ready`: complete
- `verified`: complete — remediations re-reviewed; CI drawable parity aligned
- `closed`: complete

## Progress (reconciled after chat recovery)

### Done

1. **Strict exact variant projection (core)**
   - Browser-safe `core/exact-projection.ts` + `core/figma-names.ts`
   - `proposeFromDump` defaults to `projectionMode: 'exact'`
   - Legacy journeys opt into `reviewable-inversion` explicitly
   - Gate: `npm run exact-proposal:check` → 7/7 pass

2. **Nested instance identity**
   - Emitter carries `depContractId` / `depAnchorKey`
   - Runtime `resolveComponentIdentity` is ID-first, then anchor key, then
     unambiguous name
   - Anchor contradiction / legacy ambiguity refuse by name

3. **Transactional receive/apply commit**
   - `commitReceiveWrites` stages all bodies, installs with rename, rolls back
     on late failure
   - Covered by `packages/cli/test/figma-receive.test.ts`

4. **Wave 0 accuracy contract remains green**
   - `npm run test:accuracy-contract` → 34/34
   - `npm run accuracy:check` → holds; R3 ratcheted 260 → 238

5. **Named text-style identity (acceptance #3 / R3)** — see evidence section below

6. **Drawable-empty refusal + transactional apply confirmation (acceptance #4 / #5)**
   - Predicate matches CI anatomy gate (`examples/ci/code-led.yml`) + regate
     `empty anatomy table`: missing/empty anatomy, or root with no `parts` /
     `tokens` / `content` / `component`
   - Stable refusal: `drawable-empty`
   - Gated before mutation on `figma receive --apply`, `figma bundle`, and
     `toBundle` (publish/push)
   - Review-only receive (no `--apply`) may still save the proposal artifact
   - Apply path already commits proposal + contract + stubs + minted tokens +
     generated code via `commitReceiveWrites`; rollback left intact
   - Gate: `npx tsx --test test/figma-receive.test.ts` → 37/37 pass

### Still open (Wave 1 exit blockers)

1. **Integration debt from emitter changes**
   - Latest full eval failed at `child-wider-ratchet-and-script-freshness`
     because Polaris committed scripts are stale vs rebuild
   - Regenerate/check after identity emission changes settle

## Text-style identity slice (acceptance #3 / R3) — landed

### Loss path (traced)

1. Capture keeps `text.style` (+ `styleKey` when published).
2. Propose: **uniform** named styles mint under `imported.text.<style>` with
   `$extensions.dsContracts.textStyle`.
3. Propose: **axis-varying** styles (Avatar Size=xs/xl/2xl) previously minted
   under component paths with **no** metadata — silent sanitization.
4. Emit derived TEXT_STYLES only from `imported.text.*.font-size`, so
   component-path leaves never became canvas styles; `matchTextStyle` missed.
5. Round-trip compared `text.style` → R3.

### Fix

- `MintOccurrence.styleName` / `styleKey` + per-leaf claim in `mintTokens`
- Propose varying-typography path attaches per-occurrence identity (or
  `text-style-identity-refused` when minting is off)
- `deriveTextStyles` / `tokenSetTextStyles` recreate exact Figma names from
  any font-size leaf with metadata (dedupe by name; prefer `imported.text.*`)
- `byTokenPath` maps every binding path to the canonical style name

### Evidence

- Failing-before → passing-after: `mint:check` (per-variant leaf identity),
  `emitters:check` (component-path metadata → exact style names)
- `npm run mint:check` ✔ · `npm run emitters:check` ✔ ·
  `npm run exact-proposal:check` ✔ (7/7; exact mode not weakened)
- UUI pipeline `--write` → `minted.dtcg.json` + `NOTES.md` only
- `npm run extract:figma:roundtrip:uui` regenerated
- **R3: 260 → 238** (denominators unchanged: `originalFacts` 20928)
- `accuracy/baseline.json` ratcheted to max 238 (gate required for +1
  regression tests); `npm run accuracy:check` ✔ ·
  `npm run test:accuracy-contract` ✔

### Residual R3 (238) — not silent sanitization

| Bucket | Notes |
|--------|--------|
| Path restructure | Style survives at a different anatomy path (e.g. progress-circle `label` ↔ `group3/label`, tooltip `content/text` ↔ `…/textandsupportingtext/text`); R3 counts both loss + invent |
| `cartesian-fill` invent | Avatar styles correctly applied on filled rows original never drew |
| `interaction-states` | Hover (etc.) text.style facts tagged; canvas does not emit interaction states |

Named refusal code: `text-style-identity-refused` (mint off / cannot carry).

## Integration after text-style landing

- `npm run figma:fresh` → 6/6 libraries byte-fresh
- `npm run roundtrip:uui:fresh` → REPORT.md/report.json fresh
- `npm run accuracy:check` → R3 238, originalFacts 20928
- `npm run test:accuracy-contract` → 34/34
- `npm run plugin:embed-dump` + engine receipt update → `plugin:check` green

## Security disposition — writes-mutations seam

Independent review (`906a1790-2ce0-47ef-bae8-42653021a6e8`) found one medium
exposure: `figma receive --apply` committed `generateCodeFiles` destinations
without `assertSafeRepoPath` / generate.out containment.

Remediation landed:

- export + reuse `assertSafeRepoPath` / `assertUniqueDestinations`
- add `assertDestinationsUnderRoot` (resolve under trusted `generate.out`)
- call both guards in `receiveCommand` before `commitReceiveWrites`
- ATTACK pin in `figma-receive.test.ts` (38/38)
- record: `.agents/runs/exact-conversion-finish-wave1/disposition.json`

## Cold review (conversion-core) — not merge-ready

Reviewer `99391cf9-995f-43ab-9714-a916b58e3108`: AC1/AC2/AC5 largely met;
AC3 soft-refuse and AC4 hollow-parts false-green block merge.

### AC4 remediation (hollow parts) — landed

- `isDrawableEmptyContract` now requires drawable *substance* (non-empty
  tokens, component ref, non-empty content, or nested drawable part).
- Hollow `parts: { label: {} }` and `content: {}` refuse as `drawable-empty`.
- CLI receive suite updated and green.

### Cold-review AC3 remediation (text-style hard-refuse / identity) — landed

Owns text-style identity only (not CLI drawable gate).

| Code | Where | Behavior |
|------|--------|----------|
| `text-style-identity-refused` | `propose-figma` uniform size/weight, differing style names | Exact: throw `TextStyleIdentityError`. Reviewable: named note, no `styleNames[0]` pick |
| `text-style-identity-refused` | `propose-figma` mint-off + named styles | Exact: hard refuse. Reviewable: named note |
| `text-style-identity-refused` | `emit-figma-script` `buildNode` when `spec.textStyle` set | Missing style or `setTextStyleIdAsync` failure throws (no silent raw props) |
| `text-style-identity-refused` | `deriveTextStyles` / `tokenSetTextStyles` | Same name + conflicting size/weight fails closed |

Projection: reviewable structured success → `verified-exact` (or
`legacy-unverified` after promotions); never `source-matrix-verified`.

Evidence: `exact-proposal:check` 12/12 · `emitters:check` ✔ · `mint:check` ✔

Residual soft paths: reviewable still notes+continues; corpus-resolved
token-derived styles bind without minting; per-variant distinct names with
varying size/weight still mint per-leaf identity when `mintUnbound` is on.

## Integration after AC3 hard-refuse

- Regenerated all library Figma scripts + GENESIS batches + Polaris
- `npm run figma:fresh` → 6/6
- Plugin engine receipt updated → `plugin:check` green
- `roundtrip:uui:fresh` → green
- `exact-proposal:check` 12/12 · receive 38/38 · accuracy holds (R3 238)

Cold-review majors (AC3 soft-refuse, AC4 hollow parts, script freshness,
generated-path safety) are remediated with focused evidence.

## Spot re-review + CI parity

- Re-review `a33aa021-d76e-4a22-a9c4-8534bd97bbfe`: prior majors closed;
  conversion-core merge-ready; residual CI recipe hollow-parts gap named.
- `examples/ci/code-led.yml` anatomy gate now uses the same substance
  predicate as `isDrawableEmptyContract` (hollow parts/content refuse).
- CI↔CLI parity cases checked; receive suite 38/38.

## Close

Wave 1 acceptance criteria met with evidence. Residual intentional:
reviewable-inversion soft-notes; sync-script emit ungated for
drawable-empty; UUI still legacy-unverified for R1 exact counts.

**Next:** Wave 2 — MUI oracle / golden corpus.

## Evidence — drawable-empty / transactional slice

- Definition: `isDrawableEmptyContract` in `packages/cli/src/commands/figma.ts`
  (CI `drawable` + regate empty anatomy).
- Refusal constant: `DRAWABLE_EMPTY = "drawable-empty"`.
- Message:
  `drawable-empty: <id> — anatomy has nothing drawable (empty anatomy / empty root with no parts, tokens, content, or component); <surface> refuses rather than … blank frames. Run computed capture or carry real anatomy first.`
- Apply refuse-before-mutate: no `.proposals/`, contract, stub, or minted file
  lands when `--apply` carries stub anatomy.
- Bundle/publish refuse-before-write: `CliUsageError` starting with
  `drawable-empty:` and no bundle bytes.
- Transactional apply: `plannedReceiveWrites` already folds proposal, contract,
  stubs, minted tree, and generated code into one `commitReceiveWrites` map;
  late-install rollback test retained; additive pin covers all five classes.
- Remaining gaps: childStub files under a drawable main contract may still be
  empty placeholders (by design); `figma` sync-script emit is not gated;
  literals/text/shape-only roots still count as empty under the CI predicate.
