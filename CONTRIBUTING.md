# Contributing

This repo is a proof of concept with spec ambitions ([roadmap](docs/12-roadmap.md)). Its credibility rests on one norm above all others.

**The stance, first, because it decides whether you want to be here:** this project is and stays **100% open source, community-supported, and never monetized** — MIT, one license, no gated tier, no "enterprise edition" holding back the part that matters. The end state is a vendor-neutral component contract *specification* with this repository as its reference implementation and conformance suite ([docs/08](docs/08-composition-and-spec.md)). A spec the community can't fully use isn't a spec, so the schema, the engine, and every instrument that verifies them live here under the same terms. Contributions are welcome on exactly that basis.

## The claims rule: no capability claim without an eval behind it

A statement of capability does not enter the README or docs until an adversarial check backs it in the eval suite (`npm run eval`). This rule exists because the project's own audits found the same failure class three times: confident claims written in the same voice whether or not they had been adversarially tested. Examples of the rule working: the cva-extraction claim in [docs/13](docs/13-try-it-with-your-system.md) cites `extract-foreign-library`; the "referee over surfaces we didn't generate" claim cites `diagnose-foreign-green-red-green`; the refusal claims in [docs/07](docs/07-validation.md) each name their eval.

If you're adding a capability: fixture first, eval second, claim last.

## The doctrine a change has to respect

The claims rule is the first of seven. The others are what make it hold:

1. **Determinism.** Same input, byte-identical output — no LLM anywhere in the conversion path. AI is available as an *assistant* that writes proposals; only an explicit human ack writes anything load-bearing ([docs/16](docs/16-sync-boundary.md)). If your change makes an output depend on wall-clock time, iteration order, a random id, or model output, it is a defect regardless of how good the output looks.
2. **Named refusals over silent degradation.** When the pipeline cannot carry something, it must say so *by name*, on screen, at the point of failure. A plausible substituted value is the worst outcome in this repo — worse than a crash. Every refusal in the engine exists because something was once dropped on the floor quietly; read `loadConfig` in `extract/computed/capture.ts` for a dense example.
3. **Teach the gate every lesson.** A bug you fixed without a check is a bug you will ship again. When a round finds something, the same commit adds the eval, the receipt, or the mock behavior that makes it fail forever in Node. The composite-Modal quirks found on a live Figma canvas are modeled in the mock for exactly this reason.
4. **Defect-first reporting.** Lead with what is broken, then the green numbers. A commit message, a PROVENANCE file, and a PR description all put the named residuals *before* the wins. Green gates are not "it works" — they are "these specific things were checked."
5. **Byte-identity as a proof technique.** When you change the engine, prove the change is inert everywhere it should be inert: re-run an unrelated library's capture through the changed engine and compare artifacts byte-for-byte. Comparing against a *committed* artifact is not a valid proof if that artifact is stale — the valid proof is A/B on the same engine, changing only the one expression ([`examples/carbon/PROVENANCE.md` § "Byte-identity proof"](examples/carbon/PROVENANCE.md)).
6. **Documented limits live where the capability is claimed**, not in a footnote elsewhere.
7. **Docs describe what a person does, not what the machinery is.** The owner's own review (2026-07-27) found the docs explained the pipeline accurately and left a reader unable to say what they should type. A capability page that cannot be followed by someone who has never read this repo is not finished. Where a step can fail, name the failure and the fix; where a verb does not exist yet, say so instead of implying it.

## The gates

Every change must leave these green:

```bash
npm run build      # tokens → schema → all components, contract-validated
npm run eval       # the full deterministic suite (see docs/07)
npm run docs:check # every number the docs quote, re-derived from the repo
npx tsc --noEmit   # src, scripts, extract, parity, evals
```

Or run a whole CI lane locally, which reads the current workflow instead of a
second hard-coded command list: `npm run ci:lane fast`, `npm run ci:lane full`,
and `npm run ci:lane catalog-visual`. `npm run ci:lanes` derives current gate
coverage and refuses an unwired check. [docs/25](docs/25-reading-a-red-ci.md)
maps each lane and red gate to its local reproducer.

**`npm run parity` is deliberately NOT in that list, and it used to be.** The
differ compares contracts against committed *snapshots* of the live Figma file,
and those snapshots expire by design (`MAX_SNAPSHOT_AGE_DAYS`, default 14). At
the time of writing they are 27 days old, so `parity` exits 1 with two
`snapshot-stale` findings on a completely healthy tree — which meant this
section instructed every contributor to reach a green that only the file's owner
could produce. **A `snapshot-stale` finding is not your change**; refreshing the
snapshots means running `parity/extract-figma.plugin.js` inside the live Figma
file, which needs Figma desktop and file access. Any OTHER parity finding *is* a
real three-way drift and should block. CI excludes `parity` by name for the same
reason (`.github/scripts/lane-coverage.ts` carries the exclusion and its
justification, so the exclusion itself cannot rot silently).

Depending on what you touched, also: `npm run plugin:check` (the plugin engine against the mocked canvas), `npm run core:browser-check` (the engine stays browser-safe), `npm run verify:package`, `npm run test:onboarding`.

If you touched `recipe/` or recipe-path docs: `npm run recipe:pivot-status:check`
and the archetype gate you changed (`recipe:button:check`,
`recipe:input-field:check`, `recipe:combobox:check`, `recipe:table:check`,
`recipe:calendar:check`). **Do not flip `overallSuccess`.** **Do not restamp
hashed RECORDs.** Product v1 is incomplete (F1) until a true v1-completion
record says otherwise. The playground still drives the pre-pivot
universal-contract path — do not treat a playground run as recipe-IR proof.

The active climb is `recipe/` plus
[docs/35 — The two-journey v1 plan](docs/35-two-journey-v1-plan.md)
(reader as mechanical source of truth; canvas→code as a co-equal pillar).
Old universal-contract surfaces (`core/`, `playground/`, `packages/`,
Journeys A–C) stay where they are and remain CI-load-bearing; they are
labeled LEGACY, not moved. Published `@ds-contracts/*` packages and GitHub
releases `v1.0.0-rc.1` (and earlier) are the **pre-pivot universal-contract**
envelope. Recipe-IR never shipped as an npm RC; the old RC publish path
remains deferred. The universal-contract release runbook is still
[docs/27 — Release Process](docs/27-release-process.md) — it is not a claim
that a recipe-IR RC is in flight. Record each result in
[RELEASE_CHECKLIST.md](RELEASE_CHECKLIST.md). A manifest version is not
evidence that npm, a GitHub release, a tag, or the deployed sites contain that
version. Contributors may prepare packs and evidence; only the designated
owners approve tags, GitHub releases, npm publication, dist-tag changes, and
Cloudflare deployment. Do not invent a new semver in a labeling commit.

**`npm run docs:check` is the anti-rot gate for prose.** Eval counts, the contract count, the token count, the capture-config count, and every relative link in `README.md` / `ROADMAP.md` / `CONTRIBUTING.md` / `docs/*.md` are re-derived from the repo and compared to what the docs say; a disagreement fails by name. It reads `evals/results.json` and never runs the suite, so it costs seconds. If you add or remove an eval case, run `npm run eval` (which rewrites `evals/results.json`) and then `npm run docs:check` will tell you exactly which lines to update. A number that is deliberately historical — "Round 5 shipped with 24/24 evals" — gets `<!-- docs-check:ignore -->` on its line, and nothing else does.

## What a good PR looks like

The commit log is this project's evidence trail; treat a message as a receipt, not a label. The exemplars to imitate are the recent ones — `git log --format='%s'` and read the top few in full. They share a shape:

- **What changed and why it was a defect**, stated first, in the user's or the owner's own words when the finding came from them.
- **The mechanism**, concretely — which file, which function, which refusal is now emitted by name.
- **The proof**, with numbers: the gate that now covers it, the byte-identity comparison, the counts before and after.
- **The honest gaps carried forward**, named individually — "threaded but only the Generate path is gate-covered", "the bundles for these two examples were not regenerated". Naming a gap in the commit is how it stays findable; omitting it is how it becomes a surprise.
- **The eval tally** at the end (`162/162` evals), so the log alone shows the suite never went backwards.

A PR that adds a capability without an eval will be asked for the eval. A PR that reports a gap it found and did not fix — clearly, by name — is welcome and is *not* a lesser contribution.

## Bringing a new design system through

If your contribution is a new library round (a capture config, seed contracts, and a promoted contract set), read [docs/21 — Bring Your Own Design System](docs/21-bring-your-own-design-system.md) first. The deliverable that matters is the **PROVENANCE file**: exact pins, a recreate block a stranger can run, the reader configuration with a *why* per knob, the token family split, the smoke probes (including the ones that came back fine), the verbatim pipeline, the per-component gate numbers, and the named residuals before the good news. §8 of that guide is the template.

Engine changes made for one library must be proven inert on the others (doctrine #5), and anything the round could not carry is deferred **by name** in the config's `__note` and the PROVENANCE, never dropped.

## What to edit (and what never to edit)

| Change | Where |
|---|---|
| Component API, anatomy, tokens bindings, events | `contracts/*.contract.json` — then `npm run build` |
| Design tokens | `tokens/*.tokens.json` |
| Schema capabilities | `scripts/contract-schema.ts` (add optional fields; never repurpose; bump docs/02) |
| Generator behavior | `scripts/generate-components.ts`, `scripts/generate-figma.ts` |
| Extraction / brownfield | `extract/` |
| A new library round | `extract/computed/configs/<lib>.json` + `examples/<lib>/` — see [docs/21](docs/21-bring-your-own-design-system.md) |
| Docs numbers | nowhere by hand — they are derived; `npm run docs:check` names every disagreement |
| **A CLI verb's shape or behavior** | four user-facing surfaces move together: `README.md` (the three journeys), `site/src/pages/get-started.ts`, `site/src/pages/cli.ts`, and — if the command line itself changes — `evals/fixtures/journey-commands.json`, which the site renders and the journey evals execute |
| **Never by hand** | `src/components/`, `figma-sync/*.js` (generated), `catalog/catalog.json`, `contracts/contract.schema.json` |

Hand-editing generated output is drift — the differ will flag it, which is the product working, not a bug to route around.

## Contract change policy

Semver semantics ([docs/02](docs/02-contract-spec.md)): added optional prop = minor; removed/renamed prop or value = major; widening a slot's `accepts` = minor, narrowing = major. The PR diff of a contract *is* the design-system change review — write descriptions for a designer and an engineer reading the same page.

The **schema** (`@ds-contracts/schema`) follows the same rule, and a schema major is a package, not a commit: removing or renaming a schema field ships (1) the old spelling refused *by name* with the new spelling in the message (a `z.never()` tombstone quoting `LEGACY_V<n>`, never a bare "unrecognized key"), (2) a codemod under `ds-contracts migrate` built on the one migration function the schema package exports, run over every committed contract dir in the same change (`npm run contracts:migrate`; `contracts:migrate:check` is the gate), (3) regeneration of every surface that embeds a contract (figma scripts, GENESIS batches, bundles, goldens, the plugin engine receipt — each per its documented recipe; generated CODE surfaces must stay byte-identical), and (4) a `BREAKING` CHANGELOG entry naming the rename table. Tool-specific facts live under `bindings.<surface>` at every level; a new top-level field that names a tool is a review refusal.

## Honesty conventions

- Limits are documented where the capability is claimed, not in a footnote elsewhere.
- Extraction/inference marks every heuristic (`confidence: "inferred"`) and reports everything it can see but not read — silent omission is a bug of the highest severity here.
- If a check is skipped, the output must say it was skipped.
