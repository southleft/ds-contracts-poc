# 37 · Product repo manifest (step 5 of the 2026-09-01 audit)

> **Status: DRAFT for the owner, 2026-09-02.** Decision (6) of the audit —
> extract a small product repository and let this one become the archive —
> was endorsed. This page is the manifest of what moves, what stays, and
> what the cut costs, so the extraction is one reviewable operation rather
> than a judgement made file by file. Nothing here has been moved.

## What the product is, in files

The one command ([docs/36](36-point-it-at-your-library.md)) needs these and
nothing else. Counts are `git ls-files` on `main` today.

| moves | files | what |
|---|---|---|
| `recipe/fixture-reader/` | 85 | ledger, reader, the six role schemas, the drafters, the proposers, `point.ts`, their tests |
| `recipe/recipes/` | 33 | the thirteen archetype recipes (+ tests) |
| `recipe/adapters/` | 18 | reviewed-source adapters |
| `recipe/fixtures/` (incl. `generated/`) | 56 | canonical instances, hand tables, the proposed modules |
| `recipe/*.ts` core | 32 | `figma-writer-runtime.ts`, the thirteen `*-figma-writer.ts`, `fidelity-score.ts`, `fidelity-check.ts`, `live-proof-evidence.ts`, `css-box-shadow.ts`, `figma-vector-path.ts`, `recipe.ts`, `figma-ir.ts`, envelope |
| `recipe/fidelity-manifest.json`, `recipe/evidence/fidelity-v1/` | ~120 | the gate's manifest, shots, scorecards, `KNOWN-FAILURES.json` |
| `extract/computed/` engine + `configs/` | ~40 | `run.ts`, `capture.ts`, the drafter, the per-library configs |
| `figma-sync/` plugin | 71 | the plugin (Paste a script is the product verb) |
| `scripts/` subset | ~15 | `run-figma-writer.mjs`, `record-live-mint.mjs`, `capture-fidelity-shots.mjs`, `export-figma-variant.mjs`, `scaffold-live-version.mjs`, `docs-numbers-check.mjs` |
| `docs/` subset | ~12 | 36, 26, 23, 24, the plugin IA (19), the capture pages (21, 22), this page |
| **total** | **≈ 480** | |

## What stays in the archive

| stays | files | why |
|---|---|---|
| `recipe/build-*-live-proof-v*.ts` and `recipe/evidence/*-live-pivot-v*/` | ~4,000 + ~11,400 | every versioned mint and its receipt; hash-pinned history, not product |
| `extract/computed/out/` | 7,618 (225 MB) | the captures themselves. The product needs a capture per library the user brings; the corpus is evidence. The `orig-shots/` the fidelity gate scores against move with the manifest rows that cite them (~60 files) |
| the universal-contract path (`core/`, `packages/`, `contracts/`, the playground, the spec site) | — | still ships on npm; its own line |
| `parity/`, `evals/`, `conformance/` | — | receipts of the pre-pivot rounds |

## What the cut costs, named

- **The signed archetypes** (Button, Input, Combobox, Table, Calendar) stay
  behind: their writers are per-version programs, not the shared runtime,
  and they have no reader schema. v1 ships without them.
- **`pivot-status.ts`** (20k lines) hash-pins the versioned builds at
  runtime; it does not move, and the product repo needs no equivalent.
- **The eight `KNOWN-FAILURES` rows** move with the manifest: the ratchet is
  part of the gate.
- **History** does not move (decision H in [docs/33](33-post-v1-plan.md) stays
  the owner's).

## The mechanical part

```bash
# in a clean clone of the new repository
git filter-repo --path recipe/fixture-reader --path recipe/recipes --path recipe/adapters \\
  --path recipe/fixtures --path extract/computed/run.ts --path extract/computed/capture.ts \\
  --path extract/computed/configs --path figma-sync --path recipe/fidelity-manifest.json \\
  --path recipe/evidence/fidelity-v1 --path-glob 'recipe/*-figma-writer.ts' \\
  --path recipe/figma-writer-runtime.ts   # … the core list above
```

Then: one `package.json` with the six `recipe:*` scripts the README names,
one CI lane (`recipe:fidelity:check`, `recipe:fixture-drift:check`,
`test:recipe`), and the README's top section as the README.

## What the owner decides

1. Whether the product repo is public from the first commit (the mission says
   open source; nothing in the moved set carries a token or a private key —
   `.env.local`, `private/`, and the operator PEMs are not in the list).
2. The name.
3. Whether the `orig-shots/` the gate cites (~60 files, real-library renders)
   are acceptable in a public repository; they are screenshots of open-source
   packages' own demos.
