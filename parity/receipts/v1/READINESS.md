# V1 readiness — every row of docs/26, run on this commit

Written by `npm run v1:readiness` (scripts/v1-readiness.ts). The rows, their commands and their evidence references are parsed from docs/26-v1-definition.md — nothing here is listed by hand. recordedAt is the UTC run start; durations and timestamps describe this measurement.

- **commit:** `b6e0dcbf6922dd0fa03f9f8d0944c103520c55c5`
- **recordedAt:** 2026-10-30T22:32:30.933Z
- **tree dirty at start:** YES
- **definition:** docs/26-v1-definition.md sha256 `e4476dc78e29c0a4`
- **flags:** --trust-lanes --pre-release
- **lane map:** benchmark, catalog-visual, cli-figma-to-react, deploy-check, fast, full, pin-on-linux, publish-rc, release-candidate, security, sync-spine (from .github/workflows via .github/scripts/lane-map.ts)
- **prep:** ✔ `npm --prefix packages/schema run build` 1s · ✔ `npm --prefix packages/core run build` 1s · ✔ `npm --prefix packages/cli run build` 1s · ✔ `npm --prefix packages/emitter-web-components run build` 0s · ✔ `npm run build:lib` 2s · ✔ `npm run plugin:zip` 0s

**Tally.** GREEN 16 · RED 8 — 24 rows.

| row | state | command | seconds | evidence |
|---|---|---|---|---|
| V1-SCOPE-01 | **GREEN** | ✔ `npm run docs:check` | 1 | ✔ 23-known-limitations.md#a4-out-of-scope-by-decision--not-gaps<br>human: Known Limitations §A.4 remains linked from the release notes |
| V1-JOURNEY-01 | **GREEN** | ✔ `npm run plugin:ui-check` && ✔ `npm run extract:figma:roundtrip:uui` && ✔ `npm run ledger:fresh` && ✔ `npm run conformance:canvas` | 22 | ✔ parity/receipts/phase-2/FIGMA-DS-EXAM.md |
| V1-JOURNEY-02 | **GREEN** | ✔ `npm run test:onboarding` && ✔ `npm run paste:check` && ✔ `npm run plugin:check` && ✔ `npm run first-party-bundle:check` && ✔ `npm run maintain` | 321 | — |
| V1-JOURNEY-03 | **GREEN** | ✔ `npm run reconcile` && ✔ `npm run diagnose` && ✔ `npm run docs:check` ⟨reused V1-SCOPE-01⟩ | 2 | ✔ 23-known-limitations.md#b11-adopting-a-hand-built-figma-set-is-not-a-verb-this-tool-has<br>✔ 23-known-limitations.md#d32-the-two-acceptance-rows-that-were-red-on-the-commit-itself--closed<br>mentions (not run): `npm run reconcile && npm run diagnose`<br>mentions (not run): `npm run parity:snapshot:rest` |
| V1-JOURNEY-04 | **GREEN** | ✔ `npm run recipe:canvas-to-code:held-out:check` && ✔ `npm run recipe:canvas-to-code:held-out:v2:check` | 12 | ✔ 32-recipe-ir-pivot.md#merge-execution-2026-08-30<br>✔ ../parity/receipts/v1/CANVAS-TO-CODE-DESIGNER-EXAM.md |
| V1-CLASS-01 | **RED** | ✖ `npm run capability:fresh` && · `npm run extract:computed:drift` | 0 | ✔ 23-known-limitations.md#c11-which-component-archetypes-are-proven--the-actionable-cut<br>✔ 23-known-limitations.md#d32-the-two-acceptance-rows-that-were-red-on-the-commit-itself--closed |
| V1-CLASS-02 | **GREEN** | ✔ `npm run docs:check` ⟨reused V1-SCOPE-01⟩ | 0 | ✔ 23-known-limitations.md#c11-which-component-archetypes-are-proven--the-actionable-cut<br>human: the release notes reproduce or link the bounds in Known Limitations §C.1.1 |
| V1-CLASS-03 | **GREEN** | ✔ `npm run recipe:button:check` && ✔ `npm run recipe:input-field:check` && ✔ `npm run recipe:combobox:check` && ✔ `npm run recipe:table:check` && ✔ `npm run recipe:calendar:check` && ✔ `npm run recipe:pivot-status:check` | 12 | ✔ 32-recipe-ir-pivot.md#e4-applied-2026-08-30 |
| V1-COMPAT-01 | **GREEN** | ✔ `node -e "const r=require('./package.json'),c=require('./packages/cli/package.json');if(r.engines.node!=='>=20'\|\|c.engines.node!=='>=20'\|\|r.peerDependencies.react!=='>=18'\|\|r.peerDependencies['react-dom']!=='>=18')process.exit(1)"` | 0 | — |
| V1-COMPAT-02 | **GREEN** | ✔ `npm run schema` && ✔ `npm run schema:fresh` && ✔ `npm run contracts:migrate:check` && ✔ `npm run slot-constraints:check` | 14 | ✔ ../CONTRIBUTING.md#contract-change-policy<br>human: release PR includes a contract-change classification using CONTRIBUTING § Contract change policy |
| V1-COMPAT-03 | **RED** | ✖ `npm run eval:carried:check` && · `npm run eval:record:check` && · `npm run generation:atomic:check` && · `npm run provenance:check` && · `npm run figma:fresh` && · `npm run verify:catalog` | 2085 | mentions (not run): `npm run eval:carried:check` |
| V1-COMPAT-04 | **GREEN** | ✔ `npm run plugin:zip` ⟨reused prep⟩ && ✔ `npm run plugin:ui-check` ⟨reused V1-JOURNEY-01⟩ | 0 | ✔ 23-known-limitations.md#a3-the-architecture-the-plugin-cannot-run-your-code<br>human: Known Limitations §§A.3–A.4 remains linked from release notes |
| V1-EVID-01 | **RED** | ✖ `npm run eval:carried:check` ⟨reused V1-COMPAT-03⟩ && · `npm run docs:check` && · `npm run capability:fresh` && · `npm run generation:atomic:check` && · `npm run static:empty-content:check` && · `npm run code-only-facts:check` | 0 | mentions (not run): `npm run eval:carried:check` |
| V1-EVID-02 | **RED** | ✖ `npm run capability:fresh` ⟨reused V1-CLASS-01⟩ && · `npm run docs:check` | 0 | ✔ 23-known-limitations.md#c1-coverage--how-much-of-a-library-is-actually-captured |
| V1-EVID-03 | **GREEN** | ✔ `npm run conformance` && ✔ `npm run conformance:roundtrip` && ✔ `npm run conformance:canvas` ⟨reused V1-JOURNEY-01⟩ && ✔ `npm run dagger:census` && ✔ `npm run closure:check` | 14 | — |
| V1-EVID-04 | **GREEN** | ✔ `npm run snapshot:schema:check` && ✔ `npm run canvas:binding:check` && ✔ `npm run variant-drift:check` | 14 | ✔ ../parity/receipts/live-figma-variant-drift.md |
| V1-EVID-05 | **RED** | ✔ `npm run catalog:visual:check` && ✖ `npm run maintain:visual` | 24 | — |
| V1-SEC-01 | **GREEN** | ✔ `npm run test:worker` && ✔ `npm run test:playground` && ✔ `npm run typecheck:worker` && ✔ `npm run plugin:check` ⟨reused V1-JOURNEY-02⟩ && ✔ `npm run plugin:ui-check` ⟨reused V1-JOURNEY-01⟩ | 7 | ✔ 23-known-limitations.md#b14-the-standing-cifigma-channel-is-half-a-channel<br>human: release security review records a clean secret scan and links Known Limitations §B.14. |
| V1-SEC-02 | **GREEN** | ✔ `npm audit --omit=dev --audit-level=high` | 1 | — |
| V1-CI-01 | **RED** | ✔ `npm run ci:lanes` && ✖ `npm run ci:lane fast` && · `npm run ci:lane full` && · `npm run ci:lane catalog-visual` && · `npm run test:v1-definition` && · `npm run v1:definition:check` && · `npm run provenance:check` && · `npm run eval:record:check` | 1370 | — |
| V1-CI-02 | **RED** | ✔ `npm run prep:core` && ✔ `npm --prefix packages/schema run build` ⟨reused prep⟩ && ✔ `npm --prefix packages/cli run build` ⟨reused prep⟩ && ✔ `npm --prefix packages/emitter-web-components run build` ⟨reused prep⟩ && ✔ `npm run build:lib` ⟨reused prep⟩ && ✔ `npm run plugin:zip` ⟨reused prep⟩ && ✖ `npm run build:playground` && · `npm run site:build` && · `npm run publish:check` && · `npm run verify:package` && · `npm run verify:published` && · `npm run schema:fresh` && · `npm run figma:fresh` && · `npm run generated:fresh` && · `npm run verify:catalog` && · `npm run catalog:visual:check` | 5 | — |
| V1-REL-01 | **RED** | — (evidence only) | 355 | human: the release PR contains a complete P0/P1 audit ledger with task ID, closing commit, acceptance command, and result<br>ledger: 60 rows — closed 56, refuted 2, open-human 0, red 2 ([AUDIT-LEDGER.md](AUDIT-LEDGER.md))<br>audit ledger: AUD-V11 RED, AUD-U20 RED |
| V1-REL-02 | **GREEN** | ✔ `npm --prefix packages/cli run build` ⟨reused prep⟩ && ✔ `npm run publish:check` && ✔ `npm run verify:published` ⟨reused ledger:AUD-U27⟩<br>after publish: ⏸ `npm run plugin:zip` && ⏸ `npm run build:playground` && ⏸ `npm run site:build` && ⏸ `npm run deploy:check` | 3 | post-publish chain deferred (--pre-release): npm run plugin:zip && npm run build:playground && npm run site:build && npm run deploy:check |
| V1-REL-03 | **GREEN** | ✔ `npm run docs:check` ⟨reused V1-SCOPE-01⟩ | 0 | ✔ 23-known-limitations.md<br>human: release PR checklist links every deferred audit task to one item below and links the complete Known Limitations |

## Lane evidence notes

- fast: HEAD is not on origin/main — no lane run describes this tree
- full: HEAD is not on origin/main — no lane run describes this tree
- publish-rc: HEAD is not on origin/main — no lane run describes this tree
- deploy-check: HEAD is not on origin/main — no lane run describes this tree
- catalog-visual: HEAD is not on origin/main — no lane run describes this tree
- benchmark: HEAD is not on origin/main — no lane run describes this tree
- cli-figma-to-react: HEAD is not on origin/main — no lane run describes this tree
- pin-on-linux: HEAD is not on origin/main — no lane run describes this tree

## Tracked files a command rewrote

- V1-COMPAT-03: `npm run eval:carried:check` changed M core/stroke-svg-source.test.ts, M packages/core/src/validate.ts

## Red and unrun commands — captured tail

### V1-CLASS-01 — `npm run capability:fresh` (exit 1, 0s)

```
> ds-contracts-poc@1.0.0-rc.1 capability:fresh
> node scripts/build-capability-report.mjs --check

STALE: docs/24-what-works.md does not match a rebuild from its committed sources.
Every number in it is READ from an artifact; one of those artifacts moved.
Rebuild it and commit:  npm run capability:report
```

### V1-COMPAT-03 — `npm run eval:carried:check` (exit 1, 2085s)

```
ed false alarm); a foreign-grammar or untagged baseline is incomparable, never drift; serialization deterministic; offline gate green over the committed ledger
  ✔ C3-detection  sync-ledger-lockfile
sync-spine-drift: canvas-ahead fixture → plan carries proposal+diff+classification+marker PR body; in-sync scope plans nothing; cursor skips the already-PR-d drift by name (conflict sibling still pulls); decided-pending rows do not red the lane (Verdict: drift-decided, WARN + PENDING.md), an undecided row still does, a stale decision is undecided again, an untracked set is always red
  ✔ C3-detection  sync-spine-drift
rollup-only-package-refused-by-name: a package publishing only api-extractor `.d.ts` rollups (Fluent 2: 0 .tsx / 0 non-.d.ts .ts across 65 packages) walked ZERO candidate files and reported `No components found — check code.root` — a refusal naming nothing, indistinguishable from an empty directory and blaming the config for a fact about the package. The walker now keeps a skip ledger and refuses BY NAME: how many files, which rule dropped each, the files themselves, the ROLLUP-ONLY classification, and the next step. An empty tree names its OWN cause, and a tree whose files were opened but whose every component was skipped still carries the component-level ledger (which the old path discarded, proposals.md never being written).
  ✔ C2-refusal  rollup-only-package-refused-by-name
jsdoc-default-carried-and-disagreement-receipted: `@default` / `@defaultvalue` (both spellings ship in Fluent 2, 80 + 5 tags across the 12 probed rollups) are read into prop.default, so an axis documenting a default is no longer defaultless. Verified against the pinned sandbox: Badge.size documents `@defaultvalue medium` while the drafter pinned `tiny`, Avatar.active documents `@default unset` while the drafter pinned `active` — two of twelve components would have captured their whole variant grid around a base combo the library never renders, silently. An initializer that disagrees with the JSDoc WINS and the disagreement is receipted; a default outside its own enum, or written as prose, is refused by name rather than guessed; `@default undefined` documents the absence. The drafter now pins baseCombo only for the axis that is genuinely defaultless.
  ✔ C5-extraction  jsdoc-default-carried-and-disagreement-receipted
local-var-hop-recovers-token-name: with `varPrefix: "--"` the reader's one-hop `defs` branch was dead code — every custom property starts with a bare `--`, so a channel reading a component-local variable (`border-color: var(--fui-Checkbox__indicator--borderColor)`) offered only that variable, which names no DTCG leaf, and the theme token behind it was never a candidate. Measured on Fluent: 31 rules across 11 local variables, including ALL of Checkbox's indicator colours on all four interaction planes — a silent NAME loss with the pixels still right. A second half the recon did not name: the var-ident regex omitted `_`, so the name truncated at `--fui-Checkbox` and the hop key never matched, which also broke the branch for ORDINARY prefixes (the control fails pre-fix too). Hop targets are now offered as ADDITIONAL candidates flagged `1` and sorted after every direct candidate, so a recovered name can only fill a channel that bound nothing — it can never demote a semantic alias to the primitive behind it. Committed captures carry no 4th element and normalize byte-identically.
  ✔ C2-refusal  local-var-hop-recovers-token-name
painted-decoration-survives-control-equality: altitude Link's underline EQUALS the <a> control (`<a href="#c">`, :any-link) and was therefore dropped as "the emitted element inherits it for free" — false twice over, because core/emit-html writes the root <a> with no href (library ink 34x16 vs contract render 32x14 at Variant=Lg) and because Figma has no user agent at all. The library authors it outright (`.al-c-link { text-decoration: var(--al-link-text-decoration, underline) }`), so the equality was coincidence, not provenance. The door now re-admits a PAINTED decoration and still drops `none` (falsified here: forcing the capture to `none` carries nothing), font-family joins the round-5c clause that FC-FONT-SUBSTRATE needs, and the fact reaches the committed contract and 9 canvas node(s) — replacing two hand-edits (26f1a279 text-decoration-line, ac5e6181 Plex families) that promote() could not reproduce and the next re-promote would have erased.
  ✔ C2-refusal  painted-decoration-survives-control-equality
astryx-token-plane-is-the-render-substrate: 177 of 186 committed astryx tokens are comparable against the 11 committed capture(s)' own raw custom-property declarations, and ALL 177 agree (87 disagreed before the theme-neutral re-base — the DTCG was @astryxdesign/core's UNTHEMED defaults while every reference render was made under @astryxdesign/theme-neutral). CSS-keyword font families across 72 fontFamily declaration(s): 0 (allowance 0, was 148) — ZERO remain. The token-plane ones died with the re-base; the 28 that survived it were contract LITERALS and died to one missing alternation in firstFamily(), whose denylist covered the generic families but not the system-font keywords. The allowance was tightened 28 -> 0 in the same change, so the gain cannot be given back.
  ✔ C3-detection  astryx-token-plane-is-the-render-substrate

217/230 evals passed (v1 path 217/225; archive path 0/5) — evals/.carried/results.json (commit b6e0dcbf, DIRTY tree — this record cannot be committed as the suite result)
  ✖ evals/results.json: 217/230 — 8 red(s) NOT named in parity/receipts/v1/eval-reds.json: design-rest-roundtrip-zero-mismatch, design-rest-degraded-variables-never-fabricates, design-rest-degraded-minting-binds-styles, capability-report-is-fresh, plugin-engine-bundle, plugin-update-report, plugin-propose-dry-run, plugin-stale-base-guard — an unnamed red is a silent failure; add a row with its cause and what closes it
✖ eval:carried:check — 217/230; the reds above are NOT carried
```

### V1-EVID-05 — `npm run maintain:visual` (exit 1, 1s)

```
> ds-contracts-poc@1.0.0-rc.1 maintain:visual
> npm run extract:figma:visual:catalog


> ds-contracts-poc@1.0.0-rc.1 extract:figma:visual:catalog
> tsx extract/figma/visual-parity/run.ts --summary button badge checkbox switch heading

FIGMA_TOKEN not found (env or .env.local)
```

### V1-CI-01 — `npm run ci:lane fast` (exit 1, 1369s)

```
  ✔    0.2s  npm run extract:figma:visual:anchors
  ✔    0.2s  npm run visual-truth:report:fresh
  ✔    0.2s  npm run tokens:snapshot:check
  ✔    0.3s  npm run figma:rest:refusal:check
  ✔    2.4s  npm run figma:rest:closure:check
  ✔    4.5s  npm run census:check -- --phase full --allow-red-verdicts
  ✔    8.7s  npm run census:check -- --self-test
  ✔    0.9s  npm run canvas:usable:check
  ✔    1.1s  npm run canvas:usable:self-test
  ✔    6.2s  npm run census:check -- --phase design-to-code
  ✔    0.8s  npm run first-pass:check
  ✔    1.2s  npm run first-pass:check -- --self-test
  ✔    3.3s  npm run render-browser:check
  ✔    1.8s  npm run mixed-browser:check
  ✔   10.4s  npm run door-register:check
  ✔   14.0s  npm run door-register:self-test
  ✔    0.4s  npm run lowering:check
  ✔    2.8s  npm run lowering:check -- --self-test
  ✔    0.2s  npm run grammar-coverage:check
  ✔    0.2s  npm run grammar-coverage:check -- --self-test
  ✔    1.2s  npm run corpus:reproducible:check
  ✔    0.2s  npm run corpus:reproducible:check -- --self-test
  ✔    5.8s  npm --prefix packages/cli run test
  ✔   10.8s  npm --prefix packages/cli run coverage
  ✔  510.7s  npm run source:reference:check
  ✔  110.0s  npm run recipe:live:history:test

11 gate(s) skipped by workflow conditions.

✖ 1/203 gate(s) failed in lane "fast".
```

### V1-CI-02 — `npm run build:playground` (exit 1, 2s)

```
> ds-contracts-poc@1.0.0-rc.1 build:playground
> vite build --config playground/vite.config.ts

vite v8.3.5 building client environment for production...
✓ 0 modules transformed.
✗ Build failed in 344ms
error during build:
Build failed with 1 error:

[plugin ds-contracts-plugin-zip]
Error: plugin-zip: the plugin engine bundle is STALE vs core — a fresh bundle hashes 964a8d717e85… (2633463 bytes) but the committed receipt records 489cd892d1f9… (2633476 bytes). Core (or tokens/contracts/icons) changed without re-recording. Review the change, then run `node scripts/build-plugin-zip.mjs --update-engine-receipt` and commit engine.receipt.json.
    at verifyEngineReceipt (file:///Users/tjpitre/Sites/ds-contracts-poc-bisect/node_modules/.vite-temp/vite.config.ts.timestamp-1793403463292-5d2ff0edb065.mjs:203:104)
    at async buildPluginZip (file:///Users/tjpitre/Sites/ds-contracts-poc-bisect/node_modules/.vite-temp/vite.config.ts.timestamp-1793403463292-5d2ff0edb065.mjs:223:2)
    at async PluginContextImpl.buildStart (file:///Users/tjpitre/Sites/ds-contracts-poc-bisect/node_modules/.vite-temp/vite.config.ts.timestamp-1793403463292-5d2ff0edb065.mjs:103780:5)
    at async plugin (file:///Users/tjpitre/Sites/ds-contracts-poc-bisect/node_modules/rolldown/dist/shared/bindingify-input-options-BMZwyvQ7.mjs:1606:3)
    at async plugin.<computed> (file:///Users/tjpitre/Sites/ds-contracts-poc-bisect/node_modules/rolldown/dist/shared/bindingify-input-options-BMZwyvQ7.mjs:2284:12)
    at aggregateBindingErrorsIntoJsError (file:///Users/tjpitre/Sites/ds-contracts-poc-bisect/node_modules/rolldown/dist/shared/error-D0SD8_tL.mjs:49:18)
    at unwrapBindingResult (file:///Users/tjpitre/Sites/ds-contracts-poc-bisect/node_modules/rolldown/dist/shared/error-D0SD8_tL.mjs:19:128)
    at #build (file:///Users/tjpitre/Sites/ds-contracts-poc-bisect/node_modules/rolldown/dist/shared/rolldown-CMhwwZPA.mjs:145:34)
    at async buildEnvironment (file:///Users/tjpitre/Sites/ds-contracts-poc-bisect/node_modules/vite/dist/node/chunks/node.js:34849:66)
    at async Object.build (file:///Users/tjpitre/Sites/ds-contracts-poc-bisect/node_modules/vite/dist/node/chunks/node.js:35270:19)
    at async Object.buildApp (file:///Users/tjpitre/Sites/ds-contracts-poc-bisect/node_modules/vite/dist/node/chunks/node.js:35267:153)
    at async CAC.<anonymous> (file:///Users/tjpitre/Sites/ds-contracts-poc-bisect/node_modules/vite/dist/node/cli.js:790:3) {
  errors: [Getter/Setter]
}
```

