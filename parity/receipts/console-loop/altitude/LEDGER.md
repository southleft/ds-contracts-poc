# Console-loop ledger — altitude

File: https://www.figma.com/design/GnQnjSNBXtgtd2Ht0Hs1C8/DS-Contracts-Testing  
Transport: Figma Console MCP `figma_execute` + `clientStorage` chunk upload (bridge :9228)  
Recorded: 2026-08-06

| Result | Count |
|---|---|
| Tokens | **completed** |
| Completed receipts | **8** / 8 |
| Failed | 0 |

Per-component evidence: `components/<stem>.json` + `.md` (kind `console-loop-altitude-component`).

## Summary

| Stem | Status | nodeId | v6 |
|---|---|---|---|
| avatar | completed | 1:10498 | v6:923243794 |
| badge | completed | 1:2963 | v6:3342646333 |
| button | completed | 1:2990 | v6:3196882528 |
| chip | completed | 1:3017 | v6:2414831033 |
| divider | completed | 1:3020 | v6:3296776669 |
| heading | completed | 1:3047 | v6:3593476120 |
| icon-close | completed | 1:3071 | v6:163654327 |
| link | completed | 1:3092 | v6:2052539233 |

### Notes
- **avatar:** completed via manual rebuild after patched generator collapsed to ~0×0 (`size-0` min bindings + `strokeTopWeight` not-extensible). Final set `1:10498` is 24×24 `Variant=Sm` with Content + Show HasBadge.
- **divider:** completed with gap (standalone COMPONENT; Variant axis not on prop surface).

## 2026-08-08 — REFERENCE-TRUTH round: three of the six passes were artifacts

**Reference basis for this lane: LIBRARY RENDER.** Every stem now scores against
`extract/computed/out/altitude/<comp>/orig-shots/<combo>__default.png` — the
`altitude-web-components@1.0.2` screenshot committed by
`extract/computed/run.ts --keep-originals`.

What the basis was before, per stem, and what class it belonged to:

| stem | prior reference | class |
|---|---|---|
| avatar, badge | `gate-shots/<key>.png` | **CONTRACT RENDER** (enriched contract → emit-html) |
| chip, link | `refs/*.png`, byte-identical copies of `gate-shots/` | **CONTRACT RENDER** |
| button, heading, icon-close | `refs/*.png`, hand crops of `gate-shots/` | **CONTRACT RENDER** |
| divider | `refs/divider.png`, `synthetic-horizontal-rule-from-theme-border` | **SYNTHETIC** — a rule drawn from a token, not a render of anything |

### Honest before → after (pctAAMasked, bar 5)

| stem | before | after (library) | verdict |
|---|---|---|---|
| button | 4.23 | **4.70** | **survives** |
| chip | 0.67 | **0.67** | **survives** (contract render is byte-identical to the library render here) |
| divider | 0.00 | **0.00** | **survives**, and the basis is now a real library render instead of a synthetic rule |
| heading | 3.77 | **11.40** | **artifact** — `FC-REF-STALE-COPY` |
| icon-close | 4.69 | **17.28** | **artifact** — `FC-REF-CONTRACT-RENDER` |
| link | 2.01 | **15.63** | **artifact** — `FC-REF-CONTRACT-RENDER` |
| avatar | 0.13 (comp ✗) | 5.47 (comp ✗) | already fail-closed; still fails |
| badge | 15.44 | 15.44 | already fail-closed; fails identically on both bases |

**Scorecard passes: 6 → 3.** The `RATCHET.json` floor for this lane is **6** and
is now **unsound**: it was seeded (2026-08-07, raised 4→6 on 2026-08-08) entirely
against contract-render references. `console-loop:altitude:evidence:check`
therefore fails with `ratchet violated: altitude scorecard-passed count 3 <
committed floor 6`. The floor was deliberately **not** edited by this round —
lowering it silently is the one thing that file forbids. Recommended
re-derivation: **6 → 3** (button, chip, divider), with the reasoning recorded by
the owner.

### The three that fell, each with its own cause

- **link — 2.01 → 15.63.** The prior reference was a byte-identical copy of
  `link/gate-shots/lg__default.png`. The `FC-FONT-SUBSTRATE` closure that
  produced the 2.01 loaded IBM Plex Sans into the **contract render** — it fixed
  the emitter's font, not the gap to the library. Canvas content box 32×14 vs
  library 34×16.
- **icon-close — 4.69 → 17.28.** Same class. Canvas 16×16 vs library 18×18: the
  canvas is drawing the icon at the contract's box, and the contract's box is not
  the library's.
- **heading — 3.77 → 11.40, and this one is a SECOND class.** Its reference was
  `refs/heading.png`, a crop whose content box is **94×24** while the artifact its
  own `referenceSource` names (`heading/gate-shots/display-lg.bold__default.png`)
  has a **91×24** box. The copy had drifted from its declared source. Measured
  against the current contract render **and** against the library render — which
  are byte-identical to each other for this key — heading is **11.40 on both**.
  So heading was never passing under either basis; `FC-REF-STALE-COPY`.

### Gaps this lane still carries

- **There is no `parity/receipts/console-loop/altitude/framing.json`**, so the
  capture-framing pin (C1–C6) never ran on this lane. The three stale/contract
  references above are precisely what C3b/C5/C6 exist to catch. Naming it here so
  it is a known hole, not a silent one.
- Re-running the capture at HEAD reproduced every committed `gate-shots/` PNG
  byte-for-byte except **avatar**, where 4 of 16 differ.
