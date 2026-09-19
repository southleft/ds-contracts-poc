# Design-led clean-consumer evidence

MEASURED, NOT GRADED. `acceptedContract: null` everywhere; no owner grade is recorded here.

Each folder is one run of `npm run design:consumer:check` on a designer-drawn set: a read-only REST re-read of the set
(`inputs/rest-dump.json`), the proposed contract, the generated React (`inputs/generated/`), the clean consumer's
screenshots, Figma's own renders, the triptychs and `receipt.json`.

| folder | set | file (read-only) | within the 5 % limit | over-limit class |
|---|---|---|---:|---|
| `altitude-badge` | Badge `3538:35772`, 10 variants | Altitude `y83n4o9LOGs74oAoguFcGS` | 10 / 10, exit 0 (label box 57 px = Figma's 57; was 58) | — |
| `altitude-tabs` | Tabs `3558:61955`, 2 variants | Altitude | 0 / 2 (5.54 %, 5.19 %) | `text-only` (4.97 %, 4.66 % masked) |
| `cbds-badge` | Badge `277:822`, 72 variants | CBDS `WofZT8xaxXuc2Q6Je9S4XE` | 72 / 72, exit 0 (was 46 / 72; every rendered width exactly Figma's 61 / 48) | — |

Recorded 2026-09-19 under dump v1.36, after the whole-pixel text box was lowered (`Part.textAutoResize: WIDTH_AND_HEIGHT`, docs/23 §D.42) and the harness stopped placing roots on fractional x positions (see `docs/CURRENT.md` row 2). Tabs is unchanged to the digit: its text lives inside child instance stubs the dump does not capture.
Reproduce one row (token from the environment, never printed; always pass `--out` and `--dump` outside committed paths):

```
npm run extract:figma:rest -- "<figma url>?node-id=<set id>" --out <work>/set.rest-dump.json
npm run extract:figma -- <work>/set.rest-dump.json --out <work>/propose
npx ds-contracts generate <work>/propose/*.contract.proposed.json --out <work>/propose/generated --stories --tokens <repo token files>,<work>/propose/minted.dtcg.json
npm run design:consumer:check -- --dump <work>/set.rest-dump.json --contract <work>/propose/<set>.contract.proposed.json --generated <work>/propose/generated --component <Name> --out <work>/evidence
```
