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

## The missing half: the design surface

The pilot completes when a community **Shoelace Figma kit** is dumped with `extract/figma-dump.js` and reconciled against this extraction (`npm run reconcile`). That produces the credibility artifact the roadmap names: a true drift report between a real library and a real design kit, neither of which this project controls. Blocked only on access to a copy of a community kit in a design file we can run the dump in.
