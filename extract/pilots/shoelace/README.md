# Pilot: Shoelace — a real library this repo does not own

The [roadmap](../../../docs/12-roadmap.md)'s Phase 2 pilot, **code half executed**. [Shoelace](https://shoelace.style) (v2.20.1, MIT) is a shipping Web Component library with no relationship to this project — extraction ran against its published Custom Elements Manifest exactly as any adopter would run it against theirs.

## Result

| | |
|---|---|
| Components extracted | **58 / 58** custom elements |
| Props proposed | **411** (79 enum axes with full option sets) |
| Events declared | **113** (CEM events → `on*` callbacks, e.g. `sl-blur` → `onBlur`) |
| Schema-valid proposals | **58 / 58** — every proposal parses against the contract schema |
| Diagnose, **code** surface | **0 findings** (baseline by construction; see honesty note) |
| Diagnose, **design** surface | **259 findings, exit 1** — the real drift against the community kit (breakdown below), +1 staleness finding when the local dump is old |

Reproduce:

```bash
curl -sL "https://cdn.jsdelivr.net/npm/@shoelace-style/shoelace@2.20.1/dist/custom-elements.json" \
  -o extract/pilots/shoelace/custom-elements.json
npm run extract:code -- extract/pilots/shoelace/extract.config.json
npm run reconcile    -- extract/pilots/shoelace/extract.config.json
npm run diagnose     -- extract/pilots/shoelace/extract.config.json   # exits 1 — by design, see below
```

`extract:code` and `reconcile` reproduce their committed artifacts byte-for-byte.
`diagnose` **exits 1 and is supposed to**: this config carries a design surface,
and the two surfaces genuinely disagree.

Read `out/proposals.md` for the per-component review notes (every inference and every skip), and e.g. `out/contracts/sl-button.contract.json` for a representative proposal: a 7-value `variant` axis, 3-value `size`, five booleans, and three declared events — extracted, not authored.

## Attribution

`custom-elements.json` is Shoelace's published manifest, © Cory LaViska, [MIT-licensed](https://github.com/shoelace-style/shoelace/blob/next/LICENSE.md), included here verbatim for reproducibility. The extracted proposals are derived metadata about Shoelace's public API. This pilot is not affiliated with or endorsed by the Shoelace project.

## The referee, corrected (2026-07-26)

**What this README claimed until today:** "Code-side diagnose ✔ clean." **What was
actually committed:** a `out/diagnose-report.json` with `"designChecked": false`
and zero findings — written at `595fe26`, *before* `design.source` was added to
this pilot's config at `cff0e91`. The row was never re-verified against the
config this directory ships, and running the documented command produced
something quite different from ✔:

| | findings | what they were |
|---|---|---|
| committed report (`595fe26`) | **0**, `designChecked: false` | design surface never loaded — the clean row describes a run that no longer matches the config |
| the command, run today, **before** the fix | **58**, all `[design BEHIND] Sl* — No design component set named like "Sl*"` | **28 of the 58 were false** (the kit set exists, under the unprefixed name), and because *every* match failed, **not one design property was ever compared** |
| the command, **after** the fix | **259** (+1) | the drift that was there all along (below) |

The defect: `extract/reconcile.ts` strips the vendor prefix when it joins the two
surfaces (`SlButton` ⇄ kit `Button`, read from the config's `idPrefix`), and
`parity/diagnose.ts` did not — so the referee over a prefixed library and an
unprefixed kit could not match a single component. Fixed by reading the same key
the same way, plus two rules the referee was missing: an **orphan sweep** (a kit
set no contract claims) and a **snapshot-staleness gate** (this dump is
hand-saved; nothing in CI can refresh it).

The findings, by class:

| class | count | cross-check |
|---|---|---|
| `[design BEHIND] Sl*` — no kit set at all | **30** | exactly the 30 `codeOnly` rows in `out/reconciliation.json` |
| `[design BEHIND] Sl*.<prop>` — property missing from a matched set | **178** | |
| `[design AHEAD] Sl*.<axis>` — kit axis no contract defines (`state`, `isPill`, …) | **41** | |
| `[design AHEAD] <Set>` — kit set **no contract claims** (orphan sweep) | **8** | exactly the 8 `designOnly` rows in `out/reconciliation.json`: `Slot`, `_Image Comparer Handler`, `Menu submenu`, `Menu title`, `radio group button`, `_ellipse`, `_demo / header`, `Color Swatch` |
| `[design MISMATCH]` — variant options differ (`SlTag.Variant`, `SlTextarea.Size`) | **2** | |
| **subtotal — findings about the two surfaces** | **259** | pinned by the eval `shoelace-diagnose-prefix-match` |
| `[design MISMATCH] design-snapshot` — the dump is older than `MAX_SNAPSHOT_AGE_DAYS` | **0 or 1** | **clock-dependent, deliberately** |
| `[code …]` — **any** finding on the code surface | **0** | the honest version of the old "✔ clean" row |

28 contracts now match a kit set only after the prefix strip, and diagnose
**prints every one of those matches by name** rather than resolving them
silently.

**Why the total is 259 here and 260 in the working tree it was recorded from.**
`design.json` carries no numeric extraction stamp, so the staleness gate falls
back to the file's mtime — which on a fresh clone is the *checkout* time, i.e.
0 days. So the committed report's `designSnapshot.ageDays` is the one number in
this directory that is **not** a function of the inputs, and the staleness
finding appears only on a tree where the dump has actually been sitting around.
Everything else — 30 / 178 / 41 / 8 / 2 and the zero-finding code surface —
reproduces on any clone, which is why those are what the eval pins.

## Honesty notes

- **The zero-finding CODE surface is by construction** — the proposals were extracted from the same manifest they're checked against, so the code half cannot disagree with itself. Its value is mechanical: the referee runs end-to-end on a foreign library. That row is now *verified with the design surface loaded*, which is the only thing that makes it a statement about this config rather than about a stale report file.
- **The design result is only as fresh as `design.json`.** Nothing in CI can re-dump a Figma file, so `diagnose` reports the dump's age and refuses to call a stale snapshot green (`MAX_SNAPSHOT_AGE_DAYS`, default 14 — the same gate and the same override as `parity/diff.ts`). This dump carries no numeric extraction stamp, so the age falls back to the file's mtime and is labelled `file-mtime` in the report: a floor on its true age, and it reads as 0 days on a fresh clone. Say the number, don't trust it as a measurement of when the Figma file was read.
- **CEM is trusted input.** The manifest describes Shoelace's API; it is not verified against Shoelace's TypeScript source. (CEM describes, contracts verify — [docs/08](../../../docs/08-composition-and-spec.md).)
- **`slot`-typed and complex props** are outside declared extraction scope and appear in `out/proposals.md` as review items, not silently dropped.

## The design half — COMPLETE (2026-07-06)

A copy of the community **Shoelace Figma kit** ("Shoelace interactive UI library") was dumped read-only (`design.json`) and reconciled against the CEM extraction. The dump carries **36 component sets** — 28 of which a contract matches; the other 8 are what the orphan sweep above reports, and several are private-by-convention (`_ellipse`, `_demo / header`) rather than components anyone would contract. (`node -e "console.log(require('./extract/pilots/shoelace/design.json').components.length)"`.)

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
