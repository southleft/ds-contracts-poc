# V1 readiness — every row of docs/26, run on this commit

Written by `npm run v1:readiness` (scripts/v1-readiness.ts). The rows, their commands and their evidence references are parsed from docs/26-v1-definition.md — nothing here is listed by hand. recordedAt is the UTC run start; durations and timestamps describe this measurement.

- **commit:** `93e754d4d6d2e548ab449df36c8ff084b5e93d60`
- **recordedAt:** 2026-09-15T02:08:28.735Z
- **tree dirty at start:** no
- **definition:** docs/26-v1-definition.md sha256 `c4db41a3a80120ea`
- **flags:** --trust-lanes --pre-release
- **lane map:** catalog-visual, deploy-check, fast, full, pin-on-linux, publish-rc, release-candidate, security, sync-spine (from .github/workflows via .github/scripts/lane-map.ts)
- **prep:** ✔lane `npm --prefix packages/schema run build` 0s · ✔lane `npm --prefix packages/core run build` 0s · ✔lane `npm --prefix packages/cli run build` 0s · ✔lane `npm --prefix packages/emitter-web-components run build` 0s · ✔lane `npm run build:lib` 0s · ✔lane `npm run plugin:zip` 0s

**Tally.** GREEN-BY-LANE 17 · GREEN 7 — 24 rows.

| row | state | command | seconds | evidence |
|---|---|---|---|---|
| V1-SCOPE-01 | **GREEN-BY-LANE** | ✔lane `npm run docs:check` ⟨fast run 34913979865⟩ | 0 | ✔ 23-known-limitations.md#a4-out-of-scope-by-decision--not-gaps<br>human: Known Limitations §A.4 remains linked from the release notes |
| V1-JOURNEY-01 | **GREEN** | ✔lane `npm run plugin:ui-check` ⟨full run 34913979937⟩ && ✔ `npm run extract:figma:roundtrip:uui` && ✔lane `npm run ledger:fresh` ⟨fast run 34913979865⟩ && ✔ `npm run conformance:canvas` | 3 | ✔ parity/receipts/phase-2/FIGMA-DS-EXAM.md |
| V1-JOURNEY-02 | **GREEN-BY-LANE** | ✔lane `npm run test:onboarding` ⟨fast run 34913979865⟩ && ✔lane `npm run paste:check` ⟨full run 34913979937⟩ && ✔lane `npm run plugin:check` ⟨full run 34913979937⟩ && ✔lane `npm run first-party-bundle:check` ⟨fast run 34913979865⟩ && ✔lane `npm run maintain` ⟨fast run 34913979865 + full run 34913979937⟩ | 0 | — |
| V1-JOURNEY-03 | **GREEN-BY-LANE** | ✔lane `npm run reconcile` ⟨fast run 34913979865⟩ && ✔lane `npm run diagnose` ⟨fast run 34913979865⟩ && ✔lane `npm run docs:check` ⟨fast run 34913979865⟩ | 0 | ✔ 23-known-limitations.md#b11-adopting-a-hand-built-figma-set-is-not-a-verb-this-tool-has<br>✔ 23-known-limitations.md#d32-the-two-acceptance-rows-that-were-red-on-the-commit-itself--closed<br>mentions (not run): `npm run reconcile && npm run diagnose`<br>mentions (not run): `npm run parity:snapshot:rest` |
| V1-JOURNEY-04 | **GREEN-BY-LANE** | ✔lane `npm run recipe:canvas-to-code:held-out:check` ⟨fast run 34913979865⟩ && ✔lane `npm run recipe:canvas-to-code:held-out:v2:check` ⟨fast run 34913979865⟩ | 0 | ✔ 32-recipe-ir-pivot.md#merge-execution-2026-08-30<br>✔ ../parity/receipts/v1/CANVAS-TO-CODE-DESIGNER-EXAM.md |
| V1-CLASS-01 | **GREEN-BY-LANE** | ✔lane `npm run capability:fresh` ⟨fast run 34913979865⟩ && ✔lane `npm run extract:computed:drift` ⟨fast run 34913979865⟩ | 0 | ✔ 23-known-limitations.md#c11-which-component-archetypes-are-proven--the-actionable-cut<br>✔ 23-known-limitations.md#d32-the-two-acceptance-rows-that-were-red-on-the-commit-itself--closed |
| V1-CLASS-02 | **GREEN-BY-LANE** | ✔lane `npm run docs:check` ⟨fast run 34913979865⟩ | 0 | ✔ 23-known-limitations.md#c11-which-component-archetypes-are-proven--the-actionable-cut<br>human: the release notes reproduce or link the bounds in Known Limitations §C.1.1 |
| V1-CLASS-03 | **GREEN-BY-LANE** | ✔lane `npm run recipe:button:check` ⟨fast run 34913979865⟩ && ✔lane `npm run recipe:input-field:check` ⟨fast run 34913979865⟩ && ✔lane `npm run recipe:combobox:check` ⟨fast run 34913979865⟩ && ✔lane `npm run recipe:table:check` ⟨fast run 34913979865⟩ && ✔lane `npm run recipe:calendar:check` ⟨fast run 34913979865⟩ && ✔lane `npm run recipe:pivot-status:check` ⟨fast run 34913979865⟩ | 0 | ✔ 32-recipe-ir-pivot.md#e4-applied-2026-08-30 |
| V1-COMPAT-01 | **GREEN** | ✔ `node -e "const r=require('./package.json'),c=require('./packages/cli/package.json');if(r.engines.node!=='>=20'\|\|c.engines.node!=='>=20'\|\|r.peerDependencies.react!=='>=18'\|\|r.peerDependencies['react-dom']!=='>=18')process.exit(1)"` | 0 | — |
| V1-COMPAT-02 | **GREEN** | ✔ `npm run schema` && ✔lane `npm run schema:fresh` ⟨fast run 34913979865⟩ && ✔lane `npm run contracts:migrate:check` ⟨fast run 34913979865⟩ && ✔lane `npm run slot-constraints:check` ⟨fast run 34913979865⟩ | 0 | ✔ ../CONTRIBUTING.md#contract-change-policy<br>human: release PR includes a contract-change classification using CONTRIBUTING § Contract change policy |
| V1-COMPAT-03 | **GREEN-BY-LANE** | ✔lane `npm run eval:carried:check` ⟨full run 34913979937⟩ && ✔lane `npm run eval:record:check` ⟨fast run 34913979865⟩ && ✔lane `npm run generation:atomic:check` ⟨fast run 34913979865⟩ && ✔lane `npm run provenance:check` ⟨fast run 34913979865⟩ && ✔lane `npm run figma:fresh` ⟨full run 34913979937⟩ && ✔lane `npm run verify:catalog` ⟨fast run 34913979865⟩ | 0 | mentions (not run): `npm run eval:carried:check` |
| V1-COMPAT-04 | **GREEN-BY-LANE** | ✔lane `npm run plugin:zip` ⟨full run 34913979937⟩ && ✔lane `npm run plugin:ui-check` ⟨full run 34913979937⟩ | 0 | ✔ 23-known-limitations.md#a3-the-architecture-the-plugin-cannot-run-your-code<br>human: Known Limitations §§A.3–A.4 remains linked from release notes |
| V1-EVID-01 | **GREEN-BY-LANE** | ✔lane `npm run eval:carried:check` ⟨full run 34913979937⟩ && ✔lane `npm run docs:check` ⟨fast run 34913979865⟩ && ✔lane `npm run capability:fresh` ⟨fast run 34913979865⟩ && ✔lane `npm run generation:atomic:check` ⟨fast run 34913979865⟩ && ✔lane `npm run static:empty-content:check` ⟨fast run 34913979865⟩ && ✔lane `npm run code-only-facts:check` ⟨fast run 34913979865⟩ | 0 | mentions (not run): `npm run eval:carried:check` |
| V1-EVID-02 | **GREEN-BY-LANE** | ✔lane `npm run capability:fresh` ⟨fast run 34913979865⟩ && ✔lane `npm run docs:check` ⟨fast run 34913979865⟩ | 0 | ✔ 23-known-limitations.md#c1-coverage--how-much-of-a-library-is-actually-captured |
| V1-EVID-03 | **GREEN** | ✔ `npm run conformance` && ✔lane `npm run conformance:roundtrip` ⟨fast run 34913979865⟩ && ✔ `npm run conformance:canvas` ⟨reused V1-JOURNEY-01⟩ && ✔lane `npm run dagger:census` ⟨full run 34913979937⟩ && ✔lane `npm run closure:check` ⟨full run 34913979937⟩ | 1 | — |
| V1-EVID-04 | **GREEN-BY-LANE** | ✔lane `npm run snapshot:schema:check` ⟨fast run 34913979865⟩ && ✔lane `npm run canvas:binding:check` ⟨fast run 34913979865⟩ && ✔lane `npm run variant-drift:check` ⟨fast run 34913979865⟩ | 0 | ✔ ../parity/receipts/live-figma-variant-drift.md |
| V1-EVID-05 | **GREEN-BY-LANE** | ✔lane `npm run catalog:visual:check` ⟨catalog-visual run 34913979941⟩ && ✔lane `npm run maintain:visual` ⟨catalog-visual run 34913979941⟩ | 0 | — |
| V1-SEC-01 | **GREEN-BY-LANE** | ✔lane `npm run test:worker` ⟨fast run 34913979865⟩ && ✔lane `npm run test:playground` ⟨fast run 34913979865⟩ && ✔lane `npm run typecheck:worker` ⟨fast run 34913979865⟩ && ✔lane `npm run plugin:check` ⟨full run 34913979937⟩ && ✔lane `npm run plugin:ui-check` ⟨full run 34913979937⟩ | 0 | ✔ 23-known-limitations.md#b14-the-standing-cifigma-channel-is-half-a-channel<br>human: release security review records a clean secret scan and links Known Limitations §B.14. |
| V1-SEC-02 | **GREEN** | ✔ `npm audit --omit=dev --audit-level=high` | 1 | — |
| V1-CI-01 | **GREEN-BY-LANE** | ✔lane `npm run ci:lanes` ⟨fast run 34913979865⟩ && ✔lane `npm run ci:lane fast` ⟨fast run 34913979865⟩ && ✔lane `npm run ci:lane full` ⟨full run 34913979937⟩ && ✔lane `npm run ci:lane catalog-visual` ⟨catalog-visual run 34913979941⟩ && ✔lane `npm run test:v1-definition` ⟨fast run 34913979865⟩ && ✔lane `npm run v1:definition:check` ⟨fast run 34913979865⟩ && ✔lane `npm run provenance:check` ⟨fast run 34913979865⟩ && ✔lane `npm run eval:record:check` ⟨fast run 34913979865⟩ | 0 | — |
| V1-CI-02 | **GREEN** | ✔lane `npm run prep:core` ⟨fast run 34913979865⟩ && ✔lane `npm --prefix packages/schema run build` ⟨fast run 34913979865⟩ && ✔lane `npm --prefix packages/cli run build` ⟨fast run 34913979865⟩ && ✔lane `npm --prefix packages/emitter-web-components run build` ⟨fast run 34913979865⟩ && ✔lane `npm run build:lib` ⟨full run 34913979937⟩ && ✔lane `npm run plugin:zip` ⟨full run 34913979937⟩ && ✔ `npm run build:playground` && ✔lane `npm run site:build` ⟨full run 34913979937⟩ && ✔lane `npm run publish:check` ⟨fast run 34913979865⟩ && ✔lane `npm run verify:package` ⟨full run 34913979937⟩ && ✔lane `npm run verify:published` ⟨full run 34913979937⟩ && ✔lane `npm run schema:fresh` ⟨fast run 34913979865⟩ && ✔lane `npm run figma:fresh` ⟨full run 34913979937⟩ && ✔lane `npm run generated:fresh` ⟨full run 34913979937⟩ && ✔lane `npm run verify:catalog` ⟨fast run 34913979865⟩ && ✔lane `npm run catalog:visual:check` ⟨catalog-visual run 34913979941⟩ | 1 | — |
| V1-REL-01 | **GREEN** | — (evidence only) | 10 | human: the release PR contains a complete P0/P1 audit ledger with task ID, closing commit, acceptance command, and result<br>ledger: 60 rows — closed 58, refuted 2, open-human 0, red 0 ([AUDIT-LEDGER.md](AUDIT-LEDGER.md)) |
| V1-REL-02 | **GREEN-BY-LANE** | ✔lane `npm --prefix packages/cli run build` ⟨fast run 34913979865⟩ && ✔lane `npm run publish:check` ⟨fast run 34913979865⟩ && ✔lane `npm run verify:published` ⟨full run 34913979937⟩<br>after publish: ⏸ `npm run plugin:zip` && ⏸ `npm run build:playground` && ⏸ `npm run site:build` && ⏸ `npm run deploy:check` | 0 | post-publish chain deferred (--pre-release): npm run plugin:zip && npm run build:playground && npm run site:build && npm run deploy:check |
| V1-REL-03 | **GREEN-BY-LANE** | ✔lane `npm run docs:check` ⟨fast run 34913979865⟩ | 0 | ✔ 23-known-limitations.md<br>human: release PR checklist links every deferred audit task to one item below and links the complete Known Limitations |

## Lane evidence notes

- deploy-check: no completed successful run for 93e754d4 (no run found)

## Tracked files a command rewrote

- none

## Red and unrun commands — captured tail

- none
