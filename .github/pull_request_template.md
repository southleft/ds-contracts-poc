<!--
Two lanes run automatically on this PR: `fast` (~10s of gate time) and `full`
(the 33-gate sweep, dominated by `npm run eval`). You do not have to wait for
them to find out — `npm run ci:lane fast` and `npm run ci:lane full` run the
same steps locally, straight out of the workflow files.

If a check goes red, docs/25-reading-a-red-ci.md maps every gate to what it is
asserting and the one command that reproduces it.
-->

## What was broken

<!-- Defect first. What was wrong, in whose words, before the good news. If
this is a new capability rather than a fix, say what could not be done. -->

## The mechanism

<!-- Which file, which function, which refusal is now emitted by name. -->

## The proof

<!-- Numbers. The gate that now covers it; the byte-identity comparison; the
counts before and after. CONTRIBUTING.md's claims rule: a capability claim does
not enter the README or docs until an adversarial check backs it in the eval
suite. Fixture first, eval second, claim last. -->

- [ ] A check exists that **fails when this change is reverted** — name it here:
- [ ] `npm run ci:lane fast` is green locally
- [ ] `npm run ci:lane full` is green locally, or the failing gates are named below with why

## Gaps carried forward

<!-- Named individually. "Threaded but only one path is gate-covered." "These
two bundles were not regenerated." A PR that reports a gap it found and did not
fix — clearly, by name — is welcome and is not a lesser contribution. -->

---

<details>
<summary>Which gate do I run for what I touched?</summary>

| You touched | Run |
| --- | --- |
| anything at all | `npm run ci:lane fast` |
| `core/`, an emitter, a contract | `npm run emitters:check`, `npm run mint:check`, `npm run core:browser-check`, `npm run eval` |
| `extract/figma/` | the fifteen `extract:figma:*:check` gates, `npm run closure:check`, `npm run dagger:census` |
| `extract/computed/` | `npm run extract:computed:ceiling:check`, `npm run eval` |
| `figma-sync/plugin/` | `npm run plugin:check`, then `npm run plugin:zip && npm run plugin:ui-check` |
| `packages/cli/` | `npm --prefix packages/cli run build`, `npm run test:onboarding`, `npm run publish:check`, `npm run eval` |
| a library's committed `figma/*.figma.js` | `npm run figma:fresh` |
| `docs/`, `README.md`, `ROADMAP.md`, `CONTRIBUTING.md` | `npm run docs:check`, `npm run capability:fresh`, `npm run plugin:ui-check` (its dead-name sweep reads `docs/*.md`) |
| `site/` | `npm run site:build` |
| a gate script or a workflow | `npm run ci:lanes` |

Four artifacts are gitignored, so a cold checkout has to build them before the
gate that reads them can run: `npm --prefix packages/cli run build`
(`publish:check`), `npm run build:lib` (`verify:package`), `npm run plugin:zip`
(`plugin:ui-check`), and the playground plus site builds (`deploy:check`).

`npm run deploy:check` is **not** part of these lanes — it asserts against the
live Cloudflare Pages surfaces and is red for any commit that has not been
deployed. It runs on a schedule instead. Details in
[docs/25](../docs/25-reading-a-red-ci.md).

</details>
