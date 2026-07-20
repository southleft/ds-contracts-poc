# The depth-capture spike — de-risking advanced-component capture

**Status: working spike (no engine edits).** Self-contained; nothing under `extract/computed/**`,
`core/**`, or the schema is touched. This spike is to advanced-component CAPTURE what
`extract/computed-spike/` was to the computed FLOOR: it proves the architecture on real Polaris
before productionization.

Read **DEPTH-BUILD.md** in this directory for the validated architecture, the numbers, the staged
productionization plan, and the risks. This README is just how to run it.

## What it proves

The reframe (thesis): contracts already EXPRESS composition (`repeat`, `component`-refs, `slot`);
the gap is that the code-side computed FLOOR cannot CAPTURE an advanced component. This spike closes
that gap with three mechanics, demonstrated on the real **Modal + Popover + ResourceList** (+
IndexTable for the Fragment multi-root and the N4 characterization):

- **M1 — whole-document, portal-aware capture** (N1, N7): mount with `open`/`active` driven; capture
  what the component adds to the WHOLE document (post-mount DOM minus a pre-mount baseline minus
  harness chrome), so portaled content in `document.body` is captured wherever React sends it.
- **M2 — root-descending, multi-root anatomy** (N3): normalize THROUGH transparent wrappers
  (ThemeProvider/anon/`display:contents`/single-child passthroughs) to the component's REAL root(s);
  support multi-root (a Fragment renders several top nodes — real, not an error).
- **M3 — sample-data composition → repeat + component-ref** (N2, N5, N6): the mount recipe gains a
  sample-data channel (representative `items` + a `renderItem` rendering `ResourceItem`); the anatomy
  reader detects the repeated `ResourceItem` subtree as a REPEAT part and recognizes `ResourceItem`
  as a composed child → a component-ref to its own contract (the EXISTING schema vocabulary).

## Run

```
npx tsx extract/depth-spike/run.ts --harness <dir>
```

`<dir>` = an npm sandbox OUTSIDE the repo with `@shopify/polaris@13.9.5`, `react@18`, `react-dom@18`,
and `esbuild` installed (the `examples/polaris/scripts/verify.ts` + `computed-spike` pattern). Needs
the repo's pinned Chromium (playwright-core cache or system Chrome — `visual-parity/render.ts`
discovery convention, copied so the spike has zero repo-module imports for browser discovery).
Network-free at run time. Double-run byte-identical (asserted below).

## Receipts (`receipts/`)

- `numbers.json` — the per-mechanic numbers per component (the summary table in DEPTH-BUILD.md).
- `capture.<component>.json` — the raw portal-aware capture: pre/post body bytes, what the CURRENT
  floor reader (`stage.firstElementChild`) sees, and every new root the component added (in-stage vs
  portaled, outerHTML bytes, the captured subtree with a focused computed-style subset).
- `anatomy.<component>.json` — the root-descended, multi-root anatomy tree (M2) with repeat parts
  (M3) collapsed and named.

Double-run byte-identity was verified (`numbers.json`, `anatomy.modal.json`, and
`capture.resourcelist.json` identical across two consecutive sweeps in one session).
