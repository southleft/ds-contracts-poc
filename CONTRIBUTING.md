# Contributing

This repo is a proof of concept with spec ambitions ([roadmap](docs/12-roadmap.md)). Its credibility rests on one norm above all others:

## The claims rule: no capability claim without an eval behind it

A statement of capability does not enter the README or docs until an adversarial check backs it in the eval suite (`npm run eval`). This rule exists because the project's own audits found the same failure class three times: confident claims written in the same voice whether or not they had been adversarially tested. Examples of the rule working: the cva-extraction claim in [docs/13](docs/13-try-it-with-your-system.md) cites `extract-foreign-library`; the "referee over surfaces we didn't generate" claim cites `diagnose-foreign-green-red-green`; the refusal claims in [docs/07](docs/07-validation.md) each name their eval.

If you're adding a capability: fixture first, eval second, claim last.

## The gates

Every change must leave these green:

```bash
npm run build     # tokens → schema → all components, contract-validated
npm run parity    # three-way differ: code, canvas, tokens vs contracts
npm run eval      # the full deterministic suite (see docs/07)
npx tsc --noEmit  # src, scripts, extract, parity, evals
```

Eval counts are quoted in README/docs — if you add or remove a case, update them (`grep -rn "N/N evals"`).

## What to edit (and what never to edit)

| Change | Where |
|---|---|
| Component API, anatomy, tokens bindings, events | `contracts/*.contract.json` — then `npm run build` |
| Design tokens | `tokens/*.tokens.json` |
| Schema capabilities | `scripts/contract-schema.ts` (add optional fields; never repurpose; bump docs/02) |
| Generator behavior | `scripts/generate-components.ts`, `scripts/generate-figma.ts` |
| Extraction / brownfield | `extract/` |
| **Never by hand** | `src/components/`, `figma-sync/*.js` (generated), `catalog/catalog.json`, `contracts/contract.schema.json` |

Hand-editing generated output is drift — the differ will flag it, which is the product working, not a bug to route around.

## Contract change policy

Semver semantics ([docs/02](docs/02-contract-spec.md)): added optional prop = minor; removed/renamed prop or value = major; widening a slot's `accepts` = minor, narrowing = major. The PR diff of a contract *is* the design-system change review — write descriptions for a designer and an engineer reading the same page.

## Honesty conventions

- Limits are documented where the capability is claimed, not in a footnote elsewhere.
- Extraction/inference marks every heuristic (`confidence: "inferred"`) and reports everything it can see but not read — silent omission is a bug of the highest severity here.
- If a check is skipped, the output must say it was skipped.
