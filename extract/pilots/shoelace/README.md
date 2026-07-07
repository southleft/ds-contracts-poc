# Pilot: Shoelace — a real library this repo does not own

The [roadmap](../../../docs/12-roadmap.md)'s Phase 2 pilot, **code half executed**. [Shoelace](https://shoelace.style) (v2.20.1, MIT) is a shipping Web Component library with no relationship to this project — extraction ran against its published Custom Elements Manifest exactly as any adopter would run it against theirs.

## Result

| | |
|---|---|
| Components extracted | **58 / 58** custom elements |
| Props proposed | **411** (79 enum axes with full option sets) |
| Events declared | **113** (CEM events → `on*` callbacks, e.g. `sl-blur` → `onBlur`) |
| Schema-valid proposals | **58 / 58** — every proposal parses against the contract schema |
| Code-side diagnose | ✔ clean (baseline by construction; see honesty note) |

Reproduce:

```bash
curl -sL "https://cdn.jsdelivr.net/npm/@shoelace-style/shoelace@2.20.1/dist/custom-elements.json" \
  -o extract/pilots/shoelace/custom-elements.json
npm run extract:code -- extract/pilots/shoelace/extract.config.json
npm run diagnose     -- extract/pilots/shoelace/extract.config.json
```

Read `out/proposals.md` for the per-component review notes (every inference and every skip), and e.g. `out/contracts/sl-button.contract.json` for a representative proposal: a 7-value `variant` axis, 3-value `size`, five booleans, and three declared events — extracted, not authored.

## Attribution

`custom-elements.json` is Shoelace's published manifest, © Cory LaViska, [MIT-licensed](https://github.com/shoelace-style/shoelace/blob/next/LICENSE.md), included here verbatim for reproducibility. The extracted proposals are derived metadata about Shoelace's public API. This pilot is not affiliated with or endorsed by the Shoelace project.

## Honesty notes

- **The clean diagnose baseline is by construction** — the proposals were extracted from the same manifest they're checked against. Its value is mechanical: the referee runs end-to-end on a foreign library. The *meaningful* red/green comes when the second surface lands (below), or when Shoelace ships a version whose manifest drifts from these committed proposals — at which point `npm run diagnose` here reports exactly what changed.
- **CEM is trusted input.** The manifest describes Shoelace's API; it is not verified against Shoelace's TypeScript source. (CEM describes, contracts verify — [docs/08](../../../docs/08-composition-and-spec.md).)
- **`slot`-typed and complex props** are outside declared extraction scope and appear in `out/proposals.md` as review items, not silently dropped.

## The design half — COMPLETE (2026-07-06)

A copy of the community **Shoelace Figma kit** ("Shoelace interactive UI library", 28 public component sets) was dumped read-only (`design.json`) and reconciled against the CEM extraction:

```
28/58 code components matched a design set · 42 properties agree · 236 need a human decision
```

**This is the roadmap's credibility artifact**: a true drift report between a shipping library and a real community kit, neither of which this project controls. Highlights (`out/reconciliation.md`):

- **The kit encodes interaction states as variant axes** (`state: default/hover/active/disabled/focus`) — a canvas-only convention the code API has no counterpart for. This is the single biggest structured-drift class between kits and libraries, and the report names every instance.
- **Real kit typos surface mechanically**: Button's state axis contains `deafult`, Radio's checked axis is `isCheched`, Breadcrumb has `showPrexix`, Input has `alignement` — exactly the kind of silent rot a reconciliation exists to find.
- **Booleans modeled as true/false variant axes** (`isPill`, `isOutline`) are auto-matched to code booleans (`pill`, `outline`) with the mapping flagged, not silently — two transparent conventions (is-prefix + bool-axis) recover most of the naming gap.
- **Coverage drift runs both ways**: 30 code components have no kit counterpart (Carousel, Tree, ColorPicker, …) and the kit's `show*` slot-visibility booleans have no code API — both are decisions for a reconciliation workshop, not defects in either artifact.
- Code-only form-association props (`form`, `formaction`, `name`, `value`) appear throughout — kits never model form participation; a real contract v1 would declare them code-only, the same way this repo declares events.

Every number above is reproducible: the dump JSON, config, and full report are committed beside this file.
