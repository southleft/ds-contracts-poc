# Second implementation wanted — DS Contracts conformance subset v0.1

*One-page brief for an external engineer. Send as-is with the repo link.*

## The ask, in one paragraph

DS Contracts is a 100% open-source, never-monetized spec for component
contracts — the deterministic bridge between design tools and code
(https://github.com/southleft/ds-contracts-poc). The spec cannot graduate
past Draft on the strength of its own reference implementation: the
graduation table requires a **named second implementation, in any language,
that runs a small frozen conformance subset and files an honest report** —
even a partial one with gaps listed. We are asking you to be that
implementation.

## What the subset is

`spec/conformance/subset-v0.1.json` (frozen 2026-08-05):

- **14 normative rules** (MUST / MUST NOT) across 7 sections: contract
  identity, dispositions, compatibility, surfaces, anatomy, review-before-
  write, conformance honesty.
- **11 fixtures** covering all **4 dispositions** your implementation must be
  able to emit for a styling fact: `CARRIED`, `LOWERED`, `REFUSED`,
  `UNSUPPORTED` — e.g. `border-radius-px` → CARRIED, `calc-var` → LOWERED,
  `grid-2d` → REFUSED, `backdrop-filter` → UNSUPPORTED.
- The core rule under test is honesty, not coverage: **silent loss, silent
  invention, silent fallback, and silent overwrite are MUST NOT**
  (N-DISP-02), and skipping a case as green is itself a failure (N-CONF-01).

A minimal runner is roughly a **~200-line reader in any language**: parse the
subset JSON, load each fixture's `case.json` (and optionally its seed
contract), decide the disposition your implementation takes, compare to
`expect`, emit a JSON report. Our own pin script is 105 lines of TypeScript
— yours must not be TypeScript-shaped to count.

## What you may and may not read

| May read | Must NOT read |
|---|---|
| `spec/README.md` (spec + graduation table) | `extract/computed/**` (our capture engine) |
| `spec/conformance/*` — subset, fixture index, `harness.md` report schema | `core/**` (our emitters/differs) |
| `conformance/cases/<id>/case.json` + `conformance/seeds/<id>.contract.json` | `evals/**` (engine-coupled pins) |
| The contract JSON Schema (`contracts/contract.schema.json`, or `npm run schema`) | Any of our source as a template for your dispositions |

The whole point is independence: a report produced by re-reading our engine
measures nothing.

## The report format

Emit JSON per `spec/conformance/harness.md`: implementation name / version /
language, one `results[]` row per case (`caseId`, `expected`, `actual`,
`pass`), a summary, and a `disclosures[]` list naming every grammar row you
do not support — **"UNSUPPORTED, disclosed" passes; skipped-as-green fails.**
A partial run with honest gaps listed is an acceptable and useful first
report.

## Effort estimate

- Reading the subset + fixtures + report schema: **~1–2 hours** (the three
  files above total under 300 lines).
- A minimal runner over the 11 fixtures: **roughly a day**; **2–3 days** if
  you also validate seed contracts against the JSON Schema in your language.
- No browser, no Figma account, no npm publish, no CI integration required.

## What you get

- **Named in the spec's graduation record**: the Draft → **Candidate** step
  is, verbatim, "a second implementation reports against `harness.md` (even
  partially)" — your report, under your name/handle and language, is that
  record (`spec/README.md`, graduation table; report lands under
  `.agents/runs/post-exact-conversion-next-waves/wave11/`).
- Standing as one of the **two independent implementations** required for the
  subset to ever reach Normative 1.0.
- Direct influence on subset v0.2: every ambiguity you hit is a spec defect
  we owe you a fix for, credited.

## To start

```bash
git clone https://github.com/southleft/ds-contracts-poc
cat spec/conformance/subset-v0.1.json spec/conformance/harness.md
cat spec/conformance/fixture-index-v0.1.json   # case + seed paths, no engine imports
```

Questions / report delivery: open an issue on the repo or contact TJ Pitre
(repository owner). We will not ghost you — the release checklist literally
cannot advance without a real you.
