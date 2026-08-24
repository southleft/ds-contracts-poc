# V1 readiness — every row of docs/26, run on this commit

Written by `npm run v1:readiness` (scripts/v1-readiness.ts). The rows, their commands and their evidence references are parsed from docs/26-v1-definition.md — nothing here is listed by hand. Seconds are measured and move run to run; nothing else in this file should.

- **commit:** `98860fde0276567378d14b3bc993676dd6edfa16`
- **tree dirty at start:** no
- **definition:** docs/26-v1-definition.md sha256 `e5d8eec9f151d493`
- **flags:** (none)
- **lane map:** catalog-visual, deploy-check, fast, full, publish-rc, release-candidate, security, sync-spine (from .github/workflows via .github/scripts/lane-map.ts)
- **prep:** ✔ `npm --prefix packages/schema run build` 1s · ✔ `npm --prefix packages/core run build` 1s · ✔ `npm --prefix packages/cli run build` 1s · ✔ `npm --prefix packages/emitter-web-components run build` 0s · ✔ `npm run build:lib` 1s · ✔ `npm run plugin:zip` 0s

**Tally.** GREEN 20 · RED 2 — 22 rows.

| row | state | command | seconds | evidence |
|---|---|---|---|---|
| V1-SCOPE-01 | **GREEN** | ✔ `npm run docs:check` | 0 | ✔ 23-known-limitations.md#a4-out-of-scope-by-decision--not-gaps<br>human: Known Limitations §A.4 remains linked from the release notes |
| V1-JOURNEY-01 | **GREEN** | ✔ `npm run plugin:ui-check` && ✔ `npm run extract:figma:roundtrip:uui` && ✔ `npm run ledger:fresh` && ✔ `npm run conformance:canvas` | 18 | ✔ parity/receipts/phase-2/FIGMA-DS-EXAM.md |
| V1-JOURNEY-02 | **GREEN** | ✔ `npm run test:onboarding` && ✔ `npm run paste:check` && ✔ `npm run plugin:check` && ✔ `npm run first-party-bundle:check` && ✔ `npm run maintain` | 79 | — |
| V1-JOURNEY-03 | **GREEN** | ✔ `npm run reconcile` && ✔ `npm run diagnose` && ✔ `npm run docs:check` ⟨reused V1-SCOPE-01⟩ | 2 | ✔ 23-known-limitations.md#b11-adopting-a-hand-built-figma-set-is-not-a-verb-this-tool-has<br>✔ 23-known-limitations.md#d32-the-two-acceptance-rows-that-were-red-on-the-commit-itself--closed<br>mentions (not run): `npm run reconcile && npm run diagnose`<br>mentions (not run): `npm run parity:snapshot:rest` |
| V1-CLASS-01 | **GREEN** | ✔ `npm run capability:fresh` && ✔ `npm run extract:computed:drift` | 0 | ✔ 23-known-limitations.md#c11-which-component-archetypes-are-proven--the-actionable-cut<br>✔ 23-known-limitations.md#d32-the-two-acceptance-rows-that-were-red-on-the-commit-itself--closed |
| V1-CLASS-02 | **GREEN** | ✔ `npm run docs:check` ⟨reused V1-SCOPE-01⟩ | 0 | ✔ 23-known-limitations.md#c11-which-component-archetypes-are-proven--the-actionable-cut<br>human: the release notes reproduce or link the bounds in Known Limitations §C.1.1 |
| V1-COMPAT-01 | **GREEN** | ✔ `node -e "const r=require('./package.json'),c=require('./packages/cli/package.json');if(r.engines.node!=='>=20'\|\|c.engines.node!=='>=20'\|\|r.peerDependencies.react!=='>=18'\|\|r.peerDependencies['react-dom']!=='>=18')process.exit(1)"` | 0 | — |
| V1-COMPAT-02 | **GREEN** | ✔ `npm run schema` && ✔ `npm run schema:fresh` && ✔ `npm run contracts:migrate:check` && ✔ `npm run slot-constraints:check` | 2 | ✔ ../CONTRIBUTING.md#contract-change-policy<br>human: release PR includes a contract-change classification using CONTRIBUTING § Contract change policy |
| V1-COMPAT-03 | **GREEN** | ✔ `npm run eval` && ✔ `npm run eval:record:check` && ✔ `npm run generation:atomic:check` && ✔ `npm run provenance:check` && ✔ `npm run figma:fresh` && ✔ `npm run verify:catalog` | 1332 | — |
| V1-COMPAT-04 | **GREEN** | ✔ `npm run plugin:zip` ⟨reused prep⟩ && ✔ `npm run plugin:ui-check` ⟨reused V1-JOURNEY-01⟩ | 0 | ✔ 23-known-limitations.md#a3-the-architecture-the-plugin-cannot-run-your-code<br>human: Known Limitations §§A.3–A.4 remains linked from release notes |
| V1-EVID-01 | **GREEN** | ✔ `npm run eval` ⟨reused V1-COMPAT-03⟩ && ✔ `npm run docs:check` ⟨reused V1-SCOPE-01⟩ && ✔ `npm run capability:fresh` ⟨reused V1-CLASS-01⟩ && ✔ `npm run generation:atomic:check` ⟨reused V1-COMPAT-03⟩ && ✔ `npm run static:empty-content:check` && ✔ `npm run code-only-facts:check` | 1 | — |
| V1-EVID-02 | **GREEN** | ✔ `npm run capability:fresh` ⟨reused V1-CLASS-01⟩ && ✔ `npm run docs:check` ⟨reused V1-SCOPE-01⟩ | 0 | ✔ 23-known-limitations.md#c1-coverage--how-much-of-a-library-is-actually-captured |
| V1-EVID-03 | **GREEN** | ✔ `npm run conformance` && ✔ `npm run conformance:roundtrip` && ✔ `npm run conformance:canvas` ⟨reused V1-JOURNEY-01⟩ && ✔ `npm run dagger:census` && ✔ `npm run closure:check` | 38 | — |
| V1-EVID-04 | **GREEN** | ✔ `npm run snapshot:schema:check` && ✔ `npm run canvas:binding:check` && ✔ `npm run variant-drift:check` | 21 | ✔ ../parity/receipts/live-figma-variant-drift.md |
| V1-EVID-05 | **GREEN** | ✔ `npm run catalog:visual:check` && ✔ `npm run maintain:visual` | 36 | — |
| V1-SEC-01 | **GREEN** | ✔ `npm run test:worker` && ✔ `npm run test:playground` && ✔ `npm run typecheck:worker` && ✔ `npm run plugin:check` ⟨reused V1-JOURNEY-02⟩ && ✔ `npm run plugin:ui-check` ⟨reused V1-JOURNEY-01⟩ | 3 | ✔ 23-known-limitations.md#b14-the-standing-cifigma-channel-is-half-a-channel<br>human: release security review records a clean secret scan and links Known Limitations §B.14. |
| V1-SEC-02 | **GREEN** | ✔ `npm audit --omit=dev --audit-level=high` | 1 | — |
| V1-CI-01 | **GREEN** | ✔ `npm run ci:lanes` && ✔ `npm run ci:lane fast` && ✔ `npm run ci:lane full` && ✔ `npm run ci:lane catalog-visual` && ✔ `npm run test:v1-definition` && ✔ `npm run v1:definition:check` && ✔ `npm run provenance:check` ⟨reused V1-COMPAT-03⟩ && ✔ `npm run eval:record:check` ⟨reused V1-COMPAT-03⟩ | 3910 | — |
| V1-CI-02 | **GREEN** | ✔ `npm run prep:core` && ✔ `npm --prefix packages/schema run build` ⟨reused prep⟩ && ✔ `npm --prefix packages/cli run build` ⟨reused prep⟩ && ✔ `npm --prefix packages/emitter-web-components run build` ⟨reused prep⟩ && ✔ `npm run build:lib` ⟨reused prep⟩ && ✔ `npm run plugin:zip` ⟨reused prep⟩ && ✔ `npm run build:playground` && ✔ `npm run site:build` && ✔ `npm run publish:check` && ✔ `npm run verify:package` && ✔ `npm run verify:published` && ✔ `npm run schema:fresh` ⟨reused V1-COMPAT-02⟩ && ✔ `npm run figma:fresh` ⟨reused V1-COMPAT-03⟩ && ✔ `npm run generated:fresh` && ✔ `npm run verify:catalog` ⟨reused V1-COMPAT-03⟩ && ✔ `npm run catalog:visual:check` ⟨reused V1-EVID-05⟩ | 13 | — |
| V1-REL-01 | **RED** | — (evidence only) | 19 | human: the release PR contains a complete P0/P1 audit ledger with task ID, closing commit, acceptance command, and result<br>ledger: 60 rows — closed 55, refuted 2, open-human 2, red 1 ([AUDIT-LEDGER.md](AUDIT-LEDGER.md))<br>audit ledger: AUD-U17 OPEN-HUMAN, AUD-U22 OPEN-HUMAN, AUD-U25 RED |
| V1-REL-02 | **RED** | ✔ `npm --prefix packages/cli run build` ⟨reused prep⟩ && ✔ `npm run publish:check` ⟨reused V1-CI-02⟩ && ✔ `npm run verify:published` ⟨reused V1-CI-02⟩<br>after publish: ✔ `npm run plugin:zip` ⟨reused prep⟩ && ✔ `npm run build:playground` ⟨reused V1-CI-02⟩ && ✔ `npm run site:build` ⟨reused V1-CI-02⟩ && ✖ `npm run deploy:check` | 730 | — |
| V1-REL-03 | **GREEN** | ✔ `npm run docs:check` ⟨reused V1-SCOPE-01⟩ | 0 | ✔ 23-known-limitations.md<br>human: release PR checklist links every deferred audit task to one item below and links the complete Known Limitations |

## Tracked files a command rewrote

- V1-COMPAT-03: `npm run eval` changed M evals/results.json

## Red and unrun commands — captured tail

### V1-REL-02 — `npm run deploy:check` (exit 1, 730s)

```
    … playground: still serving the previous deployment, re-checking (150s)
    … playground: still serving the previous deployment, re-checking (165s)
    … playground: still serving the previous deployment, re-checking (180s)
    … playground: still serving the previous deployment, re-checking (195s)
    … playground: still serving the previous deployment, re-checking (210s)
    … playground: still serving the previous deployment, re-checking (225s)
    … playground: still serving the previous deployment, re-checking (240s)
    … spec site: still serving the previous deployment, re-checking (15s)
    … spec site: still serving the previous deployment, re-checking (30s)
    … spec site: still serving the previous deployment, re-checking (45s)
    … spec site: still serving the previous deployment, re-checking (60s)
    … spec site: still serving the previous deployment, re-checking (75s)
    … spec site: still serving the previous deployment, re-checking (90s)
    … spec site: still serving the previous deployment, re-checking (105s)
    … spec site: still serving the previous deployment, re-checking (120s)
    … spec site: still serving the previous deployment, re-checking (135s)
    … spec site: still serving the previous deployment, re-checking (150s)
    … spec site: still serving the previous deployment, re-checking (165s)
    … spec site: still serving the previous deployment, re-checking (180s)
    … spec site: still serving the previous deployment, re-checking (195s)
    … spec site: still serving the previous deployment, re-checking (210s)
    … spec site: still serving the previous deployment, re-checking (225s)
    … spec site: still serving the previous deployment, re-checking (240s)

✘ 3 deployed surface(s) DIVERGE from the local build:
  - plugin zip STALE: live is 942148 bytes (sha af19cc985469…), local build is 1062580 bytes (sha 30af2532b82e…) — a designer downloading today gets a different engine than this repo builds
  - playground STALE: live index references [/assets/index-C1ojNmZG.js, /assets/index-oTRYTN6T.css, /assets/rolldown-runtime-aKtaBQYM.js], local build references [/assets/index-BzXvwWyP.js, /assets/index-oTRYTN6T.css, /assets/rolldown-runtime-aKtaBQYM.js] — vite renames every chunk on any content change, so these are different builds
  - spec site STALE: /get-started/ live is 40276 bytes (sha fdf98969ffe6…), local build is 40276 bytes (sha e7ee8033e470…)

Redeploy with: npm run deploy   (builds, publishes both Pages projects, then re-runs this check)
```

