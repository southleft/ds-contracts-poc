# 35 · The two-journey v1 plan — mechanical truth in both directions

> **Status: ACTIVE — adopted 2026-08-31 (owner-approved in session).**
> This supersedes the *sequencing* of [docs/34](34-boilerplate-v1-plan.md)
> (the boilerplate corpus itself is minted and under owner review) and
> governs everything from here to v1. Nothing in this document mints a
> grade or flips `overallSuccess`. Product **v1 remains INCOMPLETE**.
>
> **Owner decisions adopted 2026-08-31:**
>
> 1. **Freeze eyeball-driven remints.** After the Checkbox v3
>    (`198:77718`) and Textarea v3 (`198:77456`) stays, no new boilerplate
>    mints or remints until the reader (Phase 1) exists. The owner's eye
>    stops being the drift detector.
> 2. **npm packages become the mechanical source of truth.** The
>    hand-transcribed tables in `recipe/fixtures/library-*.ts` are the
>    named root cause of every visual miss the owner caught
>    (see `recipe/evidence/compile-source-of-truth-v1.md`, `cde0dfebb`).
>    Fixture values must be mechanically derived from — and continuously
>    diffed against — Chromium computed-style captures of the real
>    packages (the signed-Input precedent, generalized).
> 3. **v1 requires BOTH journeys.** Code→canvas alone is not v1.
>    Canvas→code (read a live page, bridge to contract, emit code,
>    re-render, mechanical diff) is a co-equal pillar with its own
>    held-out exam. A formal amendment to the
>    [docs/26](26-v1-definition.md) F-checklist adding the canvas→code
>    exam will be written and presented for explicit owner sign-off —
>    it is adopted in direction here, not silently stamped there.
> 4. **Cleanup is labeling, not moving.** Old universal-contract surfaces
>    (`core/`, `playground/`, `packages/`, site Journeys A–C) are
>    CI-load-bearing (~78 importers of `core/`). Quarantine = LEGACY
>    markers + docs banners + evidence-preserving Figma soft-archive;
>    physical relocation and lane splits only after labels land.
> 5. **New libraries only via the reader.** Two additional React
>    libraries with distinct styling methods join the corpus *after* the
>    reader works (recommended: shadcn/ui for Tailwind utilities, Chakra
>    UI for runtime Emotion). No new hand-authored tables, ever.

---

## 1 · Why this plan exists

The overnight boilerplate climb minted 13 archetypes in hours — and the
owner's review then caught missing check glyphs, mis-set switch travel,
radio label misalignment, a cramped textarea label, and a Badge minted
from an unfilled `color=default`. Every one of those was **transcription
drift**: the zero-silent gates prove nothing is lost *from the fixture
table*, but nothing checked the table against the real component except
the owner's eyes. That is the ceiling on velocity, and the reader removes
it.

The second gap is directional: the recipe path today is code→canvas only.
The pre-pivot engine (`core/propose-figma.ts` → contract →
`core/emitter.ts`) emits real React + CSS Modules but speaks the old
universal contract; the Button perturbation exam proposes reviewed-input
diffs offline for one archetype. v1's bidirectional claim needs the
canvas→code journey built on the recipe path and proven with the same
zero-silent bar.

## 2 · Phase 0 — Freeze and record (this commit)

- Checkbox v3 / Textarea v3 land as the last eyeball-driven remints.
- This document becomes the active roadmap; docs/34 keeps the corpus
  inventory and honesty constraints, which remain in force.
- Live protocol, Scratch-only writes (`byMp6lt0Ij9b2QbkDGFwBh`),
  do-not-touch signed pages, and named-or-carried doctrine all unchanged.

## 3 · Phase 1 — The reader (code→canvas truth)

Generalize the signed-Input precedent: `extract/computed/` capture →
enriched contract → **reviewed translation** into `library-*.ts`, plus a
drift gate.

1. Extend `extract/computed/configs/*.json` to the boilerplate archetypes
   across MUI / AntD / Astryx (capture machinery exists; configs, mounts,
   and state maps are the work).
2. Build the capture→fixture translation adapter and
   `recipe:fixture-drift:check`: every value in a fixture table must
   match the capture ledger or carry a named receipt. Prove the loop on
   Checkbox and Textarea first (the two the owner failed), then batch.
3. Side-by-side review artifacts: Chromium render vs minted Figma
   screenshot, per archetype × library, so owner review is
   compare-two-images.

## 4 · Phase 2 — Mechanical re-validation of the boilerplate corpus

- Run the drift gate across all 13 archetypes; remint only where the
  table drifted from the ledger.
- Full variant matrices arranged on-page; where a recipe only compiles a
  2×2, the stay record says so plainly.
- One consolidated owner review package (all archetypes, side-by-sides,
  receipts) instead of a nightly drip.

## 5 · Phase 3 — Canvas→code: the second journey

Six stages, each with a mechanical gate; runs in parallel with Phases 1–2
(shared Chromium floor).

- **3a — Canvas facts.** Promote `recipe/scene-readback.ts` output
  (geometry, fills/strokes, text, bound variables, component-set axes)
  from internal verification artifact to a stable product surface.
- **3b — Bridge (main new work).** Adapter feeding canvas facts into
  `core/propose-figma.ts` (`proposeFromDump`), which already inverts
  Figma dumps into schema-valid contracts with round-trip receipts
  (`extract/figma/ROUNDTRIP.md`). Named fallback: recipe-native proposer.
  Proof archetypes: Button, Checkbox, Textarea.
- **3c — Emit.** Existing `core/emitter.ts` React + CSS Modules emitters,
  unchanged.
- **3d — Verification.** `recipe:canvas-to-code:check`: re-render emitted
  code in headless Chromium and diff computed styles against (1) canvas
  facts and (2) the npm capture ledger. Zero silent losses — named,
  carried, or receipted.
- **3e — Designer-edit journey.** Perturbation exam extends to Checkbox +
  one overlay archetype, then gains the missing **apply** step:
  owner-approved diffs land in fixtures, re-mint, fixed-point check.
  Review-before-write stays absolute.
  **Landed 2026-08-31 (ungraded):** Button `padding` approve-then-apply
  (`recipe:button:perturbation:apply:check`) writes the approved
  from→to onto the offline observe duplicate, re-runs canvas→code, and
  proves the second apply is a no-op. Unapproved proposals refuse.
  Checkbox gained a committed Astryx observe
  (`recipe/evidence/checkbox-scene-observe-v1/`, page `198:77718`) and
  one named `padding` exam (`recipe:checkbox:perturbation:check`).
  Overlay (Tooltip/Menu/Dialog) remains a named blocker — no observe.
- **3f — Held-out canvas→code exam.** A never-minted component set goes
  read → bridge → emit → re-render diff with zero hand-holding. The
  reverse-direction F1 analogue; enters docs/26 only by explicit owner
  sign-off.

## 6 · Phase 4 — New libraries and both held-out exams

- Two new React libraries join via the reader (no hand tables).
- **F1 (code→canvas):** reader + recipes pointed at react-day-picker or a
  held-out library, zero hand-authored fixtures, zero-silent extract,
  owner grade.
- **Canvas→code exam (3f)** runs in the same window.
- `overallSuccess` flips only when **both** exams pass and the owner has
  signed the docs/26 amendment. One journey alone does not make v1.

## 7 · Phase 5 — Cleanup and release

- LEGACY markers and docs/site banners on old surfaces; recipe path
  becomes the sole advertised product; `docs:check` updated in the same
  commits.
- Figma soft-archive of superseded pages (the five v1 boilerplate stays
  superseded by v2/v3, plus cleaned attempt pages). Never the signed
  pages: Input `115:295378`, Combobox `163:35981` / `183:70641`, Table
  `173:48924`, Calendar `181:64873`, Button `183:69150`, preserved
  `85:6781`.
- Lane split for universal gates only after labels land.
- Final honesty pass on README / site / CHANGELOG; version and npm
  publish remain owner decisions.

## 8 · What this plan refuses

- No invented grades, no Polar cosmetics, no `if (library)`, no fonts or
  FILL/FIXED/px facts that no source names.
- No flipping `overallSuccess` before both exams and the signed
  amendment.
- No deleting evidence, signed pages, or gate history to make cleanup
  easier.
- No new hand-authored fixture tables — if the reader cannot express a
  fact, that is a named receipt, not a transcription.
