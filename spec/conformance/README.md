# Conformance kit (draft packaging)

Phase 3 asks for the eval/conformance suite to run against **any** implementation, not only this repo's engine. This package is the first packaging step: one frozen subset, a foreign-runner harness, and honesty about what is still engine-coupled.

## Frozen subset (Wave 11-A)

| Artifact | Role |
|---|---|
| [subset-v0.1.json](./subset-v0.1.json) | 14 normative rule IDs + 11 fixtures covering CARRIED / LOWERED / REFUSED / UNSUPPORTED |
| [fixture-index-v0.1.json](./fixture-index-v0.1.json) | Case/seed paths for the frozen subset (no engine imports) |
| [harness.md](./harness.md) | JSON report shape for foreign runners |
| [check-subset.ts](./check-subset.ts) | Pin: subset + index dispositions still match `conformance/MANIFEST.json` |

**Revision `spec-conformance-subset-v0.1.1` (2026-08-08)** — `grid-2d` moved `REFUSED` → `CARRIED`. The frozen entry was staged for exactly this: the refusal was recorded against a Figma with no grid layout mode, the A1 recon probed the platform half live (P1/P8/P5/P9), and the G5 engine round taught auto-placement promotion, so the case now measures CARRIED. The move is recorded in `subset-v0.1.json`'s `changeLog` with its evidence — a widen of what "conforming" means is a declared act, never a silent one. `REFUSED` stays demonstrable through `display-out-of-vocab` and `svg-outside-grammar`.

```bash
npx tsx spec/conformance/check-subset.ts
# or:
npm run spec:conformance:subset:check
```

## What you can run today (this repo)

```bash
# CSS/DOM frontier fixtures (independent expected dispositions)
npm run conformance

# Deterministic eval suite (engine-coupled today)
npm run eval

# Accuracy grammar ratchets (Exact Conversion Finish)
npm run accuracy:check

# Anatomy / canvas fingerprint (Phase 1)
npm run variant-drift:check
npm run anatomy-diff:check
```

Primary fixture trees:

| Tree | Measures |
|---|---|
| `conformance/` | Synthetic CSS/DOM cases with authored expected dispositions |
| `evals/` | Engine behavior + refusal pins |
| `accuracy/` | Grammar + R1–R6 ratchets |
| `parity/fixtures/variant-drift/` | Hand-edit caught by the differ |

## What a second implementation must provide

1. Accept the same contract JSON Schema (`npm run schema` → `contracts/contract.schema.json`).
2. Emit dispositions for each grammar row (`CARRIED` / `LOWERED` / `REFUSED` / `UNSUPPORTED`).
3. Run the **frozen subset** and emit a [harness.md](./harness.md) report — without reading this engine's source.
4. Map each subset `caseId` to pass/fail; omitting a case is a fail (N-CONF-01).

## Honesty

- The CSS/DOM conformance fixture's **canvas half** is declared, not measured ("carried" means reached the contract, not necessarily painted).
- Many evals import this repo's modules directly — they are **not** yet a black-box kit.
- Pixel identity is out of scope for v0.1 conformance.
- Wave 11 remains **BLOCKED** on identifying a real second implementation (owner + language); packaging alone does not claim Candidate status.

## Next packaging steps

1. ~~`spec/conformance/harness.md`~~ — done
2. Split engine-coupled evals from schema/disposition-only cases (larger follow-on)
3. Publish a versioned fixture tarball independent of `ds-contracts-poc` git history
4. Wave 11-C: first foreign dry-run report with named gaps
