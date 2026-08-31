# 26 · Definition of v1

> **Current state (2026-08-30).** Recipe-IR landed. The capture-path class
> rows in the table below are not rewritten. The additive recipe-path row
> is the one that names a live mint plus an owner grade: five archetypes
> satisfy offline gate, stayed mint, and owner human grade;
> `overallSuccess: true` holds today only for table/data-grid. Product
> **v1 is incomplete** because F1 (whole-corpus / unseen-library on the
> recipe path) is unmet. Do not flip `overallSuccess`. Do not restamp
> hashed RECORDs. See [docs/32 §E4 applied](32-recipe-ir-pivot.md#e4-applied-2026-08-30)
> and the [merge execution record](32-recipe-ir-pivot.md#merge-execution-2026-08-30).

This document is the release contract for v1. It turns the release audit into
binary requirements: v1 is ready only when every requirement below has the
named evidence and every audit task ranked P0 or P1 is closed. A feature being
implemented, demonstrated, or documented is not enough.

V1 is a bounded reference implementation for teams evaluating or adopting
machine-readable design-system contracts for web components. It is not a claim
of exhaustive component coverage, lossless round trips, pixel identity, or
general correctness. Read the measured success and cost together:
[What Works](24-what-works.md) and [Known Limitations](23-known-limitations.md).

## Release decision

The release owner MUST evaluate the requirements on the exact release commit.
A requirement passes only when its command exits zero or its named evidence is
attached to the release PR. Any open audit P0/P1, missing evidence, skipped
check, or unautomated shipped surface is a **v1 blocker**.

Audit tasks below P1 may be deferred only when the release PR links the task to
an approved limitation in [the post-v1 register](#approved-post-v1-limitations).
An undocumented deferral is a blocker.

**Status note (2026-08-23).** This document does not declare v1. Each row
below now also says which CI lane runs its command as a direct step today
("Lanes today"); `npm run ci:lanes` is the authority for that mapping and
this prose is its transcription. A command with no lane is release evidence
only when a human runs it on the release commit and attaches the output;
`npm run v1:readiness` runs every row below — the command chains, the
evidence links and the P0/P1 audit ledger — on the current commit and writes
`parity/receipts/v1/READINESS.md`, so the attachment is one receipt.
The two acceptance commands that failed or misbehaved on the 2026-08-22
commit (`npm run diagnose` exited non-zero on the committed first-party
snapshot; `npm run extract:computed:drift` dirtied tracked files while it
ran) were closed on 2026-08-23 — [Known Limitations §D.32](23-known-limitations.md#d32-the-two-acceptance-rows-that-were-red-on-the-commit-itself--closed)
carries what was actually wrong and the lanes that now pin each.

## Requirements

### Audience, journeys, and supported component classes

| ID | Requirement | Exact acceptance command or evidence |
|---|---|---|
| **V1-SCOPE-01** | The supported audience is a design-system team working on web DOM components, using the contract as the reviewed source between code and Figma. Native mobile and non-DOM renderers are excluded. | Evidence: [Known Limitations §A.4](23-known-limitations.md#a4-out-of-scope-by-decision--not-gaps) remains linked from the release notes; `npm run docs:check`. |
| **V1-JOURNEY-01** | Journey A (Figma → proposed contract → generated code) MUST run through the shipped plugin and CLI, preserve review before write, and describe hand-built-set output as a reviewable starting point rather than a reproduction. | `npm run plugin:ui-check && npm run extract:figma:roundtrip:uui && npm run ledger:fresh && npm run conformance:canvas`; evidence: the held-out-kit receipt parity/receipts/phase-2/FIGMA-DS-EXAM.md (a hand-built kit through the REST path: silent facts re-measured to two, both pinned as RED-EXPECTED cases). Lanes today: fast (ledger:fresh), full (plugin:ui-check); the round trip and conformance:canvas are not direct lane steps. |
| **V1-JOURNEY-02** | Journey B (code → reviewed capture → contract → Figma bundle/update) MUST run for React and CEM inputs, refuse an unreviewed capture config, and exercise both bundle delivery and plugin application. | `npm run test:onboarding && npm run paste:check && npm run plugin:check && npm run first-party-bundle:check && npm run maintain`; maintain is the token-free team gate (every leaf also a lane step). Lanes today: fast (first-party-bundle:check and the other maintain leaves), full (paste:check, plugin:check); test:onboarding is not a direct lane step. |
| **V1-JOURNEY-03** | Journey C (existing code + existing Figma library) is supported as API-surface diagnosis and CI drift prevention only. It MUST NOT promise anatomy reconciliation, automatic conflict resolution, or adoption of a hand-built set in place. | `npm run reconcile && npm run diagnose && npm run docs:check`; evidence: [Known Limitations §§B.11–B.13](23-known-limitations.md#b11-adopting-a-hand-built-figma-set-is-not-a-verb-this-tool-has). Lanes today: fast (docs:check; `npm run reconcile && npm run diagnose` as one step). The chain exits 0 on the commit ([§D.32](23-known-limitations.md#d32-the-two-acceptance-rows-that-were-red-on-the-commit-itself--closed)); the diagnose step goes red by design once parity/snapshots/figma-components.json is older than 14 days, and `npm run parity:snapshot:rest` (REST, read-only, FIGMA_TOKEN) is the refresh. |
| **V1-CLASS-01** | V1 support claims are limited to the **PROVEN** archetypes in the committed coverage table: button; badge/tag/chip; checkbox/radio; toggle/switch; banner/alert/toast; input/field; card; avatar; tabs; accordion; progress/spinner; slider. Each claim MUST retain a committed contract and pinned evidence. | `npm run capability:fresh && npm run extract:computed:drift`; evidence: [Known Limitations §C.1.1](23-known-limitations.md#c11-which-component-archetypes-are-proven--the-actionable-cut). Lanes today: fast (capability:fresh; extract:computed:drift — the browser-free VERIFY of baseline ⟷ committed offline scorecards, ~0.1 s), full (extract:computed:drift:remeasure — the Chromium re-fuse scored against the baseline, ~37 min, writes nothing tracked) ([§D.32](23-known-limitations.md#d32-the-two-acceptance-rows-that-were-red-on-the-commit-itself--closed)). |
| **V1-CLASS-02** | “ATTEMPTED — BOUNDED” classes are experimental, not v1-supported: select/combobox, modal/dialog, tooltip/popover, menu/dropdown, pagination, and table/data-grid. Never-attempted or absent classes are unsupported. | Evidence: the release notes reproduce or link the bounds in [Known Limitations §C.1.1](23-known-limitations.md#c11-which-component-archetypes-are-proven--the-actionable-cut); `npm run docs:check`. |
| **V1-CLASS-03** | An archetype MAY additionally be claimed as v1-supported on the **recipe path** when all four are true on the release commit: (a) its offline recipe gate is green; (b) a live Scratch mint **stayed**, with the RECORD naming its page and set node ids; (c) an **attributable human grade** from the owner cites that page; and (d) the archetype's entry in recipe/evidence/status-index.json reports `overallSuccess: true`. Failing any of the four, the archetype stays experimental under the bounded class above. Recipe-path status as of 2026-08-30: button (page 183:69150), input/field (page 115:295378), select/combobox (page 163:35981), table/data-grid (page 173:48924), and calendar/date-picker (page 181:64873) each satisfy (a), (b), and (c) — bounded to its measured two-library proof, with the owner's signed grade under recipe/evidence/ and the applied reconciliation in [docs/32 §E4](32-recipe-ir-pivot.md#e4-applied-2026-08-30). Criterion (d) is true today only for table/data-grid (set at its v32 record); by this row's own failing-any-of-four rule the other four remain experimental until a true v1-completion record flips their entries — the F-checklist walk in [docs/32's merge execution record](32-recipe-ir-pivot.md#merge-execution-2026-08-30) names the unmet clause (F1's whole-corpus / unseen-library proof on the recipe path). This row is additive: it does not weaken or reword the capture-path classes above, and it demands a live mint plus a human grade neither of them requires. | `npm run recipe:button:check && npm run recipe:input-field:check && npm run recipe:combobox:check && npm run recipe:table:check && npm run recipe:calendar:check && npm run recipe:pivot-status:check`; evidence: the five owner-signed grade files named in [docs/32 §E4](32-recipe-ir-pivot.md#e4-applied-2026-08-30) (recipe/evidence/button-live-v5-human-signoff.json and the four earlier signoffs), each pinned by sha256 in the pivot-status gate. Lanes today: fast (all six gates). |

### Compatibility promises

| ID | Requirement | Exact acceptance command or evidence |
|---|---|---|
| **V1-COMPAT-01** | The CLI and reference implementation support Node 20 or newer; the generated React package supports React and React DOM 18 or newer. The CI verification environment remains pinned and recorded. | `node -e "const r=require('./package.json'),c=require('./packages/cli/package.json');if(r.engines.node!=='>=20'||c.engines.node!=='>=20'||r.peerDependencies.react!=='>=18'||r.peerDependencies['react-dom']!=='>=18')process.exit(1)"` |
| **V1-COMPAT-02** | Contract compatibility follows the documented rule: adding an optional prop or widening accepted slot content is minor; removing/renaming a prop or value, or narrowing accepted slot content, is major. Existing fields MUST NOT be repurposed. | Evidence: release PR includes a contract-change classification using [CONTRIBUTING § Contract change policy](../CONTRIBUTING.md#contract-change-policy); `npm run schema && npm run schema:fresh && npm run contracts:migrate:check && npm run slot-constraints:check` — schema 17 renamed the Figma-only fields under bindings (a MAJOR, with the ds-contracts migrate codemod; a v16 spelling is refused by name with the new spelling in the message). Lanes today: fast (schema:fresh, contracts:migrate:check, slot-constraints:check). |
| **V1-COMPAT-03** | Given the same supported inputs, generation MUST remain byte-deterministic and a refused batch MUST leave its destination untouched. No model output may participate in conversion. | `npm run eval && npm run eval:record:check && npm run generation:atomic:check && npm run provenance:check && npm run figma:fresh && npm run verify:catalog`; the committed eval record carries the commit it measured and eval:record:check refuses a dirty-tree or foreign record and, in the full lane, a record CI did not reproduce row by row. A refused contract in generate leaves no file and names itself; the rest of the batch is written. Lanes today: fast (eval:record:check, generation:atomic:check, provenance:check, verify:catalog), full (eval, figma:fresh). |
| **V1-COMPAT-04** | The supported Figma distribution is the desktop development-plugin manifest path. Community publication, background polling, and a plugin that installs npm packages are not promised. | Evidence: [Known Limitations §§A.3–A.4](23-known-limitations.md#a3-the-architecture-the-plugin-cannot-run-your-code) remains linked from release notes; `npm run plugin:zip && npm run plugin:ui-check`. Lanes today: full (both). |

### Coverage and evidence floors

| ID | Requirement | Exact acceptance command or evidence |
|---|---|---|
| **V1-EVID-01** | Every v1 capability claim MUST name an adversarial automated check or a committed measured receipt. A new claim without either blocks release, and a late refusal MUST leave generated output untouched. | `npm run eval && npm run docs:check && npm run capability:fresh && npm run generation:atomic:check && npm run static:empty-content:check && npm run code-only-facts:check`; every canvas-dropped fact is named per part, channel, value and reason (codeOnlyFacts) where a person reads it — the bundle, the plugin report, figma bundle stdout. Lanes today: fast (all but eval), full (eval). |
| **V1-EVID-02** | Coverage MUST be reported with its denominator, selection bias, component-class bounds, and `cellsCompared` where fidelity is quoted. V1 MUST NOT turn current foreign-library coverage into a whole-library claim. | `npm run capability:fresh && npm run docs:check`; evidence: [Known Limitations §§C.1 and C.6](23-known-limitations.md#c1-coverage--how-much-of-a-library-is-actually-captured). Lanes today: fast (both). |
| **V1-EVID-03** | Refused, unsupported, and dropped facts MUST remain distinct and countable; a green score may not imply that excluded facts were tested. | `npm run conformance && npm run conformance:roundtrip && npm run conformance:canvas && npm run dagger:census && npm run closure:check`; conformance:roundtrip measures the canvas half of every CARRIED/LOWERED CSS case through the plugin engine, the dump and propose on a decrease-only ratchet where a new SILENT row is red. Lanes today: fast (conformance:roundtrip), full (dagger:census, closure:check); conformance and conformance:canvas are not direct lane steps. |
| **V1-EVID-04** | Contract/code/canvas drift detection MUST reject malformed/future snapshots and catch a hand edit inside one variant, including part-tree, layout, and binding changes, using an offline CI fixture. The release commit MUST also carry the reversible live-Figma receipt showing the edit, finding, and restoration. | `npm run snapshot:schema:check && npm run canvas:binding:check && npm run variant-drift:check`; evidence: [live Figma canvas-variant drift receipt](../parity/receipts/live-figma-variant-drift.md). Lanes today: fast (all three). |
| **V1-EVID-05** | The generated code and canvas renderers MUST retain a cross-surface visual regression floor over every committed catalog variant, and the Figma-rendered floor MUST gate geometry as well as pixels; text-sensitive environment limits MUST remain reported. | `npm run catalog:visual:check && npm run maintain:visual`; maintain:visual holds every catalog row's masked pixel score within its platform baseline AND both content boxes within four device pixels per axis, with -- --self-test as its own red test. Lanes today: catalog-visual (both, with the FIGMA_TOKEN secret). |

### Security, CI, and release

| ID | Requirement | Exact acceptance command or evidence |
|---|---|---|
| **V1-SEC-01** | Conversion remains deterministic and local; credentials MUST NOT be committed, embedded in generated artifacts, or stored by the plugin. Public Worker transports MUST fail closed, enforce their capability boundaries, and keep model-spend reservation atomic. | `npm run test:worker && npm run test:playground && npm run typecheck:worker && npm run plugin:check && npm run plugin:ui-check`; lanes today: fast (test:playground), full (plugin:check, plugin:ui-check); the worker test and typecheck are not direct lane steps. Evidence: release security review records a clean secret scan and links [Known Limitations §B.14](23-known-limitations.md#b14-the-standing-cifigma-channel-is-half-a-channel). |
| **V1-SEC-02** | Release dependencies MUST contain no known high- or critical-severity production vulnerability. | `npm audit --omit=dev --audit-level=high` |
| **V1-CI-01** | Every gate-shaped package script MUST run in a CI lane or have a current, explicit exclusion reason. Fast, full, and catalog-visual lanes MUST be required on the release PR; no gate may be allowed to fail. The definition itself and stale-source protection MUST be tested in the release commit. | `npm run ci:lanes && npm run ci:lane fast && npm run ci:lane full && npm run ci:lane catalog-visual && npm run test:v1-definition && npm run v1:definition:check && npm run provenance:check && npm run eval:record:check`; ci:lanes expands composite scripts (maintain ≡ fast + full leaves; maintain:visual in catalog-visual) so a gate that runs only inside a composite cannot hide. Lanes today: fast (ci:lanes, test:v1-definition, v1:definition:check, provenance:check, eval:record:check). Evidence: all three lanes green on the release commit. |
| **V1-CI-02** | Every shipped surface MUST have automated build and freshness evidence: all four public npm packages (schema, core, web-components emitter, CLI), generated React package, plugin zip/UI, Worker, playground, spec site, and generated catalog/Figma artifacts; the published tarballs MUST be usable with no path back to this repository. | `npm run prep:core && npm --prefix packages/schema run build && npm --prefix packages/cli run build && npm --prefix packages/emitter-web-components run build && npm run build:lib && npm run plugin:zip && npm run build:playground && npm run site:build && npm run publish:check && npm run verify:package && npm run verify:published && npm run schema:fresh && npm run figma:fresh && npm run generated:fresh && npm run verify:catalog && npm run catalog:visual:check`; verify:published packs the four tarballs into a temp project and generates through a throwaway Vue emitter that depends on the tarballs alone. Lanes today: fast (publish:check, schema:fresh, verify:catalog), full (build:lib, plugin:zip, site:build, verify:package, verify:published, figma:fresh, generated:fresh), catalog-visual (catalog:visual:check); the package builds and build:playground are not direct lane steps. |
| **V1-REL-01** | Every release-audit P0 and P1 MUST be closed with a linked failing-before/passing-after check or a measured receipt. Severity cannot be lowered solely to make v1 pass. | Evidence: the release PR contains a complete P0/P1 audit ledger with task ID, closing commit, acceptance command, and result; zero rows may be open, waived, or missing. |
| **V1-REL-02** | Registry and live deployments MUST match the release commit. A source-only release candidate is acceptable before approval but is not final release evidence. Tagging, publication, GitHub release creation, dist-tag changes, and deployment each require a recorded human approval. | `npm --prefix packages/cli run build && npm run publish:check && npm run verify:published`; after publish: `npm run plugin:zip && npm run build:playground && npm run site:build && npm run deploy:check`. Lanes today: fast (publish:check), full (verify:published, plugin:zip, site:build); deploy:check is a dispatched post-deploy workflow, red by construction before a deploy. |
| **V1-REL-03** | The release record MUST name all approved post-v1 limitations and include no undocumented exclusions. | Evidence: release PR checklist links every deferred audit task to one item below and links the complete [Known Limitations](23-known-limitations.md); `npm run docs:check`. |

## V1 blockers

The following conditions block v1 regardless of how usable the happy path
appears:

- any open, waived, unverified, or unaccounted-for audit P0/P1;
- failure of a requirement command above on the release commit;
- a shipped surface without an automated build and freshness comparison;
- a supported-journey or supported-class claim that exceeds its measured
  denominator;
- silent loss, silent fallback, or a skipped check reported as success;
- registry or deployed bytes that do not match the release commit; or
- a deferral that is not explicitly approved and linked to the register below.

## Approved post-v1 limitations

These are explicit product boundaries or documented residuals, not evidence
that v1 implements them. They may remain after v1 only while they stay disclosed
at the point of the related claim:

1. **Medium and architecture boundaries:** irreducible CSS↔canvas mismatches,
   web DOM only, closed shadow roots, no behavior/motion beyond the declared
   interaction surface, no model in conversion, desktop development-plugin
   distribution, and no background polling
   ([Known Limitations §A](23-known-limitations.md#a--irreducible)).
2. **Experimental component classes:** overlays, portals, complex tables,
   comboboxes, menus, pagination, and every never-attempted/absent archetype;
   especially data grids, trees, virtualized lists, date pickers, rich text,
   and charts ([§§B.1–B.10 and C.1.1](23-known-limitations.md#b1-overlays-and-portals-lose-their-source-token-names-in-every-library)).
3. **Brownfield workflow gaps:** no in-place adoption of a hand-built Figma
   set, API-only reconciliation, and no general concurrent-change merge or
   write-back workflow ([§§B.11–B.13](23-known-limitations.md#b11-adopting-a-hand-built-figma-set-is-not-a-verb-this-tool-has)).
4. **Known fidelity and reader ceilings:** text wrapping and webfont metrics
   (per-library `fonts` loading exists; metrics stay fallback wherever
   unconfigured),
   multi-axis geometry/paint products, unopened pseudo-element channels,
   responsive/viewport constructs, shorthand and `calc()` token references,
   and the other measured residuals in [§§B and C](23-known-limitations.md#b--not-built-yet).
5. **Coverage beyond the measured slice:** no whole-library, primitives-only,
   or exhaustive-correctness promise. The unmeasured long tail remains post-v1
   research ([Known Limitations §C.1](23-known-limitations.md#c1-coverage--how-much-of-a-library-is-actually-captured)).

Entry 2 is the **capture-path** register and stays pinned. On the recipe
path, Combobox, Table, and Calendar have stayed live mints and owner-signed
grades ([docs/32](32-recipe-ir-pivot.md)) but are **not** product-v1: F1 is
unmet and `overallSuccess` is not flipped except Table's existing v32 pin.

An item leaves this register only when its new capability has an adversarial
check or committed receipt, the relevant docs are updated, and the release
audit explicitly reclassifies it. Otherwise it remains a limitation even if a
demo succeeds once.
