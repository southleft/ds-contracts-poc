# Design-led clean-consumer evidence

MEASURED, NOT GRADED. `acceptedContract: null` everywhere; no owner grade is recorded here.

Each folder is one run of `npm run design:consumer:check` on a designer-drawn set: a read-only REST re-read of the set
(`inputs/rest-dump.json`), the proposed contract, the generated React (`inputs/generated/`), the clean consumer's
screenshots, Figma's own renders, the triptychs and `receipt.json`.

| folder | set | file (read-only) | within the 5 % limit | check | children (closure) |
|---|---|---|---:|---|---|
| `altitude-badge` | Badge `3538:35772`, 10 variants | Altitude `y83n4o9LOGs74oAoguFcGS` | 10 / 10 (0 / 3.25 / 4.82 %) | exit 0 | none referenced |
| `altitude-checkbox-group` | Checkbox Group `3570:2154`, 12 variants | Altitude | **12 / 12** (2.46 / 2.92 / 3.83 %; was 2 / 12, 4.85 / 6.45 / 7.47 % with stubs) | exit 1: `content-size-mismatch` × 12 (148 px high vs Figma's 142, row cells 383 vs 400 wide), `variant-axis-inert-ledgered:legend`, `variant-prop-discarded:state` — all present before the closure too | `Checkbox`, `Field Note` real |
| `altitude-tabs` | Tabs `3558:61955`, 2 variants | Altitude | 2 / 2 by the scorer (1.82 %, 1.44 %; was 1.80 %, 1.45 % before §D.44, 5.54 %, 5.19 % with stubs) — **a pass by the scorer with named content gaps, not a content pass** (see below) | exit 1: `content-size-mismatch` × 1 (441 vs 438 px, `variant-default`; `variant-stretch` is 441 vs 439, inside the 2 px slack). Before §D.44: `interactive-content-nested:…:button>button` × 2 and `content-size-mismatch` × 2 (453 vs 438) — both gone: `Tab Panel` is now a `<div>` | `Tab Panel`, `Button`, `Icon` real; `Tab` and `Text Passage` REFUSED → stubs, named `closure-child-refused`; `ArrowArcLeft` remote → stub |
| `cbds-badge` | Badge `277:822`, 72 variants | CBDS `WofZT8xaxXuc2Q6Je9S4XE` | 72 / 72 (0.96 / 3.12 / 4.43 %, every row identical to the stub run) | exit 0 | `Icon`, `Placeholder` real (Icon was a stub) |

Recorded 2026-09-19 under dump v1.36 with the REST import's dependency closure ON (the default since docs/23 §D.43):
each `inputs/rest-dump.json` now holds the requested set AND every same-file set its instances reference, `_provenance.closure` names what was requested, what was followed and what was not (with the reason), and `receipt.json` carries `inputs.closure` and `inputs.contractGraph` (every referenced component, real or stub, and whether the package holds it). Only the requested set is mounted and scored; its children render inside it. Altitude Badge and CBDS Badge render byte-identical PNGs to the stub run. The "was" numbers are the same pipeline with `--no-closure`, run the same day on the same file version.
Every contract the run proposed (children and stubs) and `minted.dtcg.json` ride `inputs/` beside the mounted contract, so a row reproduces from what is committed.

**Read the Tabs row with its caveat (adversarial review H1).** Almost all of the 0 / 2 → 2 / 2 gain is the real `Button` now drawing inside the panel. The tab labels are still bare text (the `Tab` child refuses and stays a stub) and the two `Text Passage` lines are still absent (that child refuses too). Figma draws that text near-white — `rgb(241, 240, 234)` — on a TRANSPARENT background, and the scorer flattens both images onto white, so text Figma draws and the consumer omits is nearly invisible to it: a **scorer blind spot**, named here and not changed. The ink coverage says what the percentage cannot: 6.79 % consumer against 12.72 % / 13.26 % Figma. The closure run also showed a defect it made reachable: the real `Tab Panel` was a `<button>` containing `Button`'s `<button>` — invalid HTML and a spurious tab stop — which the check fails by name (`interactive-content-nested`).

**Re-recorded 2026-09-19 after docs/23 §D.44** (same file version: every `inputs/rest-dump.json` is byte-identical to the previous run). Rule A: the proposer no longer infers `button` for a set whose drawing holds interactive content, so `Tab Panel` is a `<div>` and both `interactive-content-nested` rows and the 453 px width are gone. Rule B: an element the user agent pads gets `padding-<side>: 0` on every side its contract does not declare — Altitude `Button` (a `<button>` declaring only inline padding) now emits `padding-top: 0; padding-bottom: 0`. What remains on Tabs is one `content-size-mismatch`: the consumer is 441 px wide because the two `Text Passage` STUBS carry the 441 px box observed on `Tab Panel`'s main component, while the panel instance inside Tabs is 439 px and Figma's trimmed default render 438 px — the stub gap (`Text Passage` refuses), not either rule. Altitude Badge, Checkbox Group and CBDS Badge: every score identical to the digit, every problem unchanged, PNGs byte-identical; their receipts differ only in the consumer lockfile hash.

Reproduce one row (token from the environment, never printed; always pass `--out` and `--dump` outside committed paths):

```
npm run extract:figma:rest -- "<figma url>?node-id=<set id>" --out <work>/set.rest-dump.json   # closure on; --no-closure for the single set
npm run extract:figma -- <work>/set.rest-dump.json --out <work>/propose
npx ds-contracts generate <work>/propose/*.contract.proposed.json --out <work>/propose/generated --stories --tokens <repo token files>,<work>/propose/minted.dtcg.json
npm run design:consumer:check -- --dump <work>/set.rest-dump.json --contract <work>/propose/<set>.contract.proposed.json --generated <work>/propose/generated --component <Name> --out <work>/evidence
```
