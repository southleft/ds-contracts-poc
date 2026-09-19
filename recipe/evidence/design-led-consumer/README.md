# Design-led clean-consumer evidence

MEASURED, NOT GRADED. `acceptedContract: null` everywhere; no owner grade is recorded here.

Each folder is one run of `npm run design:consumer:check` on a designer-drawn set: a read-only REST re-read of the set
(`inputs/rest-dump.json`), the proposed contract, the generated React (`inputs/generated/`), the clean consumer's
screenshots, Figma's own renders, the triptychs and `receipt.json`.

| folder | set | file (read-only) | within the 5 % limit | check | children (closure) |
|---|---|---|---:|---|---|
| `altitude-badge` | Badge `3538:35772`, 10 variants | Altitude `y83n4o9LOGs74oAoguFcGS` | 10 / 10 (0 / 3.25 / 4.82 %) | exit 0 | none referenced |
| `altitude-checkbox-group` | Checkbox Group `3570:2154`, 12 variants | Altitude | **12 / 12** (2.46 / 2.92 / 3.83 %; was 2 / 12, 4.85 / 6.45 / 7.47 % with stubs) | exit 1: `content-size-mismatch` × 12 (148 px high vs Figma's 142, row cells 383 vs 400 wide), `variant-axis-inert-ledgered:legend`, `variant-prop-discarded:state` — all present before the closure too | `Checkbox`, `Field Note` real |
| `altitude-tabs` | Tabs `3558:61955`, 2 variants | Altitude | **2 / 2** (1.80 %, 1.45 %; was 0 / 2, 5.54 %, 5.19 %) | exit 1: `content-size-mismatch` × 2 (453 vs 438 px wide — new: the real `Tab Panel` renders as a `<button>` whose user-agent 6 px inline padding the CSS never zeroes) | `Tab Panel`, `Button`, `Icon` real; `Tab` and `Text Passage` REFUSED → stubs, named `closure-child-refused`; `ArrowArcLeft` remote → stub |
| `cbds-badge` | Badge `277:822`, 72 variants | CBDS `WofZT8xaxXuc2Q6Je9S4XE` | 72 / 72 (0.96 / 3.12 / 4.43 %, every row identical to the stub run) | exit 0 | `Icon`, `Placeholder` real (Icon was a stub) |

Recorded 2026-09-19 under dump v1.36 with the REST import's dependency closure ON (the default since docs/23 §D.43):
each `inputs/rest-dump.json` now holds the requested set AND every same-file set its instances reference, `_provenance.closure` names what was requested, what was followed and what was not (with the reason), and `receipt.json` carries `inputs.closure` and `inputs.contractGraph` (every referenced component, real or stub, and whether the package holds it). Only the requested set is mounted and scored; its children render inside it. Altitude Badge and CBDS Badge render byte-identical PNGs to the stub run. The "was" numbers are the same pipeline with `--no-closure`, run the same day on the same file version.

Reproduce one row (token from the environment, never printed; always pass `--out` and `--dump` outside committed paths):

```
npm run extract:figma:rest -- "<figma url>?node-id=<set id>" --out <work>/set.rest-dump.json   # closure on; --no-closure for the single set
npm run extract:figma -- <work>/set.rest-dump.json --out <work>/propose
npx ds-contracts generate <work>/propose/*.contract.proposed.json --out <work>/propose/generated --stories --tokens <repo token files>,<work>/propose/minted.dtcg.json
npm run design:consumer:check -- --dump <work>/set.rest-dump.json --contract <work>/propose/<set>.contract.proposed.json --generated <work>/propose/generated --component <Name> --out <work>/evidence
```
