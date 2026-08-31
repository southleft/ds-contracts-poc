# Post-v1 plan — the next phase of the proof of concept

> **Current state (2026-08-30).** This is the approved *next* plan. It does
> **not** mean product v1 shipped. Recipe-IR proved five live-minted,
> owner-signed archetypes; F1 is still unmet. See
> [docs/32](32-recipe-ir-pivot.md).

**Status:** approved by TJ, 2026-08-30. Written against merge head `4caebfc5b`; nothing here restamps evidence or invents a grade. Doctrine unchanged: named or carried, receipts for refusals, human gates where a human is the instrument.

---

## The recommendation in one paragraph

Prioritize **design→code** (TJ's third question), reshaped from "invert our own mints" into a **perturbation exam**: a designer edits the canvas, and the contract emits either a proposed source-fact change or a named receipt. The Button scene inversion just made this cheap — it is the substrate, not the destination. Reshape **breadth** (TJ's first question) from "more community sweeps" down to **one run**: the react-day-picker held-out exam, which simultaneously closes Calendar's named single-library refusal and is the only breadth run whose result is a *prediction test* rather than another confirmation. Treat TJ's second question (back-and-forth round trips) as the same lane as the third — the round-trip fixed point is the *mechanism* of design→code, not a separate workstream. **Defer new archetypes entirely.** Before any of it, spend one offline phase on lifecycle hardening, because the evidence says it cuts live-climb cost by most of an order of magnitude, and every subsequent phase is a climb.

---

## Where the PoC actually stands (measured, not asserted)

- **Code→canvas is proven** for five archetypes: Button (Altitude + Fluent, page `183:69150`), Input (MUI + Polaris, `115:295378`), Combobox (MUI + AntD, `163:35981`), Table (first-party + MUI, `173:48924`), Calendar (Astryx only, `181:64873`). All five have zero-silent accounting and attributable human grades; docs/26 `V1-CLASS-03` was applied additively.
- **Canvas→code exists only for Button, and only against our own mint.** The v2 inversion is genuinely closed — 0 silent / 0 missing / 0 extra / 0 mismatched on both roots (8730 and 8778 facts), collapse↔compile two-cycle **byte-stable** — but it re-derived expected plans from *our* mint and observed *our* page. It proves the observe/canonicalize substrate is total and honest. It does not prove a designer's edit becomes a code change. That claim is unproven, and it is the PoC's most differentiating unproven claim (docs/01's own positioning — every competitor makes one side primary — is only demonstrated one-directionally today).
- **Calendar's cross-library leg is a named refusal**, deliberately: `react-day-picker@10.0.1` is held blind under its PROVENANCE rule so it can serve as the unseen-library exam, with a prediction recorded in advance ("should mint far more than it binds").
- **Live climbs are expensive but compressing, and we know why.** Input took 85 live versions, Calendar 50, Combobox 41. Table took 24 versions of one-refusal-per-cycle — then the offline tail census landed, predicted the v24 refusal exactly before the run, measured the remaining tail (23 differences in 6 classes) with zero Figma writes, and the climb finished in 8 more versions. The Button v5 remint burned 5 live attempts on **writer-side** classes (no `TextEncoder` in the plugin sandbox; `setBoundVariableForEffect` resetting shadow geometry; effect paint order) — precisely the class the census's own honesty note says it cannot catch.
- **The Combobox chrome remint is TJ-decided post-merge work** with a fully named scope (overlay fill/border/radius/shadow, `listPadding`, `optionPaddingX` from canonical-fixture values to MUI/AntD-named values). The V41 signoff stands until the remint earns its own grade.
- One correction to the framing: there is **no committed "≥95% cross-library bar"** on the recipe path. The 95% figures in docs/32 are the retired AI-rater calibration thresholds. The recipe path's real bar is zero-silent accounting on a non-zero denominator plus an attributable human grade.

---

## TJ's three questions, answered directly

**"Do we need more run-throughs of community-contributed design systems?"** — Mostly no. Reshape to one run: react-day-picker. Seven distinct real libraries already back the five archetypes across genuinely different substrates. The day-picker exam is different in kind: it's held blind, it has a pre-registered prediction, it closes Calendar's E1 refusal, and it tests the *tooling's* maturity via the first-pass metric. One run, maximum signal.

**"Run them back and forth — code→design AND design→code?"** — Yes, and this collapses into the design→code priority. The round-trip fixed point (code→canvas→code byte-stable) is already achieved for Button; extending it to the other four is 0-write offline work against pages that stayed.

**"Focus more on design-to-code?"** — Yes — but with honest scoping. It means: **a designer edits a governed canvas, and the system names every delta and classifies each one** as (a) expressible in the source vocabulary → an emitted, reviewable proposed change to the reviewed input, or (b) not expressible → a named receipt. Detection-plus-emission over a governed surface.

---

## 1 · Bidirectionality, honestly assessed

What Button's inversion proves today: the scene-derived envelope of a governed page can be canonicalized to *byte equality* with the compile. What it does not prove: that anything happens when the page changes.

**The perturbation exam (the new proof).** On a *duplicate* of the Button mint page (signed pages stay untouched):

1. TJ or a scripted session makes N designer edits spanning the interesting classes.
2. The scene-derived inversion runs (0-write observe). Each edit must surface as a **named delta against the fixed point** — never silently absorbed.
3. Each delta is classified: expressible → a generated **proposed diff to the reviewed input**; not expressible → a loss receipt.
4. Round-trip closure: apply the accepted proposal, recompile, and the new fixed point must absorb the edit.

Exit criterion: N/N edits either emitted a correct proposal or a correct receipt, zero silently absorbed — plus TJ's grade on the emission surface.

**Extending inversion to the other four** is deliberately second: the exam only needs Button, which is done.

---

## 2 · Breadth

Current coverage: no archetype has more than two libraries; Calendar has one. The one gap that is a *named refusal* is Calendar's second leg — react-day-picker is one-shot under the blindness rule. **Zero further adapters scheduled now.**

---

## 3 · New archetypes — defer

The five were chosen because each broke a different assumption. A sixth archetype would re-prove machinery while the differentiating claim sits unproven. Revisit only after design→code exists.

---

## 4 · Post-merge named debts — sequence

1. **CI lanes green on main** (merge checklist; F6).
2. **Scratch signed cleanup** of older Calendar pages — batch with the next live session.
3. **Combobox chrome remint** — after hardening phase; fresh mint, fresh human grade.
4. **npm publish — keep deferred** through Phase 4.

---

## 5 · Protocol and tooling hardening — do it first

- **H1 — archetype-generic replay census.** Generalize `recipe/table-tail-census.ts` to every archetype: replay persisted raw extracts (or committed observe substrates) through current host-normalize and enumerate every remaining difference. Validation: revert one known teaching, reproduce the named live refusal, restore it.
- **H2 — writer preflight against a measured-host ledger.** Plugin-sandbox simulator embodying only *measured* host behaviors; refuses unknown API surface.
- **H3 — consolidate taught classes** into shared host-normalize/observe with per-class provenance.

All offline, zero Figma writes, zero hills.

---

## 6 · The roadmap

*"Hill" = one live PREPARE→AUTHORIZE→attempt→cleanup cycle. Human gates marked **[TJ]**.*

| Phase | Goal | Exit criteria | Effort | Depends on |
|---|---|---|---|---|
| **0 — Land v1** | Merge completes; lanes green on main | F6 lane profile; completion record committed | 0 hills (done) | — |
| **1 — Harden** | H1 replay census generic; H2 writer preflight; H3 class consolidation | Census reproduces ≥1 named historical refusal per archetype; preflight retro-catches Button-v5 writer classes | 0 hills, ~days offline | 0 |
| **2 — Combobox remint + Scratch cleanup** | TJ-decided chrome remint; batch Calendar page cleanup | Mint stays; zero-silent; **[TJ] fresh grade** | 1–4 hills | 1 |
| **3 — Design→code** | Button perturbation exam; emission surface; extend inversion to other four | N/N edits named; **[TJ] grades emission**; fixed point per archetype | 0 hills for observes | 1 |
| **4 — Held-out exam** | react-day-picker calendar adapter (spends blindness — **[TJ] decision**) | Mint stays + grade, or named refusal; prediction scored | est. 5–15 hills | 1 |
| **5 — Decide** | Sixth archetype vs adapters vs npm vs productization | **[TJ] decision** | — | 3, 4 |

### TJ decisions (2026-08-30)

1. **Approve the perturbation-exam protocol** — emission target is a *proposed reviewed-input diff*, never automatic code write.
2. **Authorize spending the day-picker blindness** in Phase 4 (recommendation: yes, this phase).
3. **Combobox remint slots after hardening**, not immediately.
4. **npm publish stays deferred** through Phase 4.
5. **No sixth archetype this cycle.**

**Explicitly out of scope:** Nathan Curtis / component-specifications lane (docs/01). Nothing edits signed evidence or claims a grade that wasn't given.

**Product v1:** remains **INCOMPLETE** — F1's whole-corpus/unseen-library clause is not proven on the recipe path (what is proven is zero-silent inversion per archetype on its measured two-library pair).

---

## Next concrete action

Generalize `recipe/table-tail-census.ts` into an archetype-generic offline replay census (H1), validated by reproducing at least one named historical live refusal per archetype from its persisted substrate — the exact validation pattern the Table census already proved. Zero Figma writes.
