# 26 · Definition of v1

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

## Requirements

### Audience, journeys, and supported component classes

| ID | Requirement | Exact acceptance command or evidence |
|---|---|---|
| **V1-SCOPE-01** | The supported audience is a design-system team working on web DOM components, using the contract as the reviewed source between code and Figma. Native mobile and non-DOM renderers are excluded. | Evidence: [Known Limitations §A.4](23-known-limitations.md#a4-out-of-scope-by-decision--not-gaps) remains linked from the release notes; `npm run docs:check`. |
| **V1-JOURNEY-01** | Journey A (Figma → proposed contract → generated code) MUST run through the shipped plugin and CLI, preserve review before write, and describe hand-built-set output as a reviewable starting point rather than a reproduction. | `npm run plugin:ui-check && npm run extract:figma:roundtrip:uui && npm run ledger:fresh` |
| **V1-JOURNEY-02** | Journey B (code → reviewed capture → contract → Figma bundle/update) MUST run for React and CEM inputs, refuse an unreviewed capture config, and exercise both bundle delivery and plugin application. | `npm run test:onboarding && npm run paste:check && npm run plugin:check` |
| **V1-JOURNEY-03** | Journey C (existing code + existing Figma library) is supported as API-surface diagnosis and CI drift prevention only. It MUST NOT promise anatomy reconciliation, automatic conflict resolution, or adoption of a hand-built set in place. | `npm run reconcile && npm run diagnose && npm run docs:check`; evidence: [Known Limitations §§B.11–B.13](23-known-limitations.md#b11-adopting-a-hand-built-figma-set-is-not-a-verb-this-tool-has). |
| **V1-CLASS-01** | V1 support claims are limited to the **PROVEN** archetypes in the committed coverage table: button; badge/tag/chip; checkbox/radio; toggle/switch; banner/alert/toast; input/field; card; avatar; tabs; accordion; progress/spinner; slider. Each claim MUST retain a committed contract and pinned evidence. | `npm run capability:fresh && npm run extract:computed:drift`; evidence: [Known Limitations §C.1.1](23-known-limitations.md#c11-which-component-archetypes-are-proven--the-actionable-cut). |
| **V1-CLASS-02** | “ATTEMPTED — BOUNDED” classes are experimental, not v1-supported: select/combobox, modal/dialog, tooltip/popover, menu/dropdown, pagination, and table/data-grid. Never-attempted or absent classes are unsupported. | Evidence: the release notes reproduce or link the bounds in [Known Limitations §C.1.1](23-known-limitations.md#c11-which-component-archetypes-are-proven--the-actionable-cut); `npm run docs:check`. |

### Compatibility promises

| ID | Requirement | Exact acceptance command or evidence |
|---|---|---|
| **V1-COMPAT-01** | The CLI and reference implementation support Node 20 or newer; the generated React package supports React and React DOM 18 or newer. The CI verification environment remains pinned and recorded. | `node -e "const r=require('./package.json'),c=require('./packages/cli/package.json');if(r.engines.node!=='>=20'||c.engines.node!=='>=20'||r.peerDependencies.react!=='>=18'||r.peerDependencies['react-dom']!=='>=18')process.exit(1)"` |
| **V1-COMPAT-02** | Contract compatibility follows the documented rule: adding an optional prop or widening accepted slot content is minor; removing/renaming a prop or value, or narrowing accepted slot content, is major. Existing fields MUST NOT be repurposed. | Evidence: release PR includes a contract-change classification using [CONTRIBUTING § Contract change policy](../CONTRIBUTING.md#contract-change-policy); `npm run schema && npm run slot-constraints:check`. |
| **V1-COMPAT-03** | Given the same supported inputs, generation MUST remain byte-deterministic and a refused batch MUST leave its destination untouched. No model output may participate in conversion. | `npm run eval && npm run generation:atomic:check && npm run provenance:check && npm run figma:fresh && npm run verify:catalog` |
| **V1-COMPAT-04** | The supported Figma distribution is the desktop development-plugin manifest path. Community publication, background polling, and a plugin that installs npm packages are not promised. | Evidence: [Known Limitations §§A.3–A.4](23-known-limitations.md#a3-the-architecture-the-plugin-cannot-run-your-code) remains linked from release notes; `npm run plugin:zip && npm run plugin:ui-check`. |

### Coverage and evidence floors

| ID | Requirement | Exact acceptance command or evidence |
|---|---|---|
| **V1-EVID-01** | Every v1 capability claim MUST name an adversarial automated check or a committed measured receipt. A new claim without either blocks release, and a late refusal MUST leave generated output untouched. | `npm run eval && npm run docs:check && npm run capability:fresh && npm run generation:atomic:check && npm run static:empty-content:check` |
| **V1-EVID-02** | Coverage MUST be reported with its denominator, selection bias, component-class bounds, and `cellsCompared` where fidelity is quoted. V1 MUST NOT turn current foreign-library coverage into a whole-library claim. | `npm run capability:fresh && npm run docs:check`; evidence: [Known Limitations §§C.1 and C.6](23-known-limitations.md#c1-coverage--how-much-of-a-library-is-actually-captured). |
| **V1-EVID-03** | Refused, unsupported, and dropped facts MUST remain distinct and countable; a green score may not imply that excluded facts were tested. | `npm run conformance && npm run dagger:census && npm run closure:check` |
| **V1-EVID-04** | Contract/code/canvas drift detection MUST reject malformed/future snapshots and catch a hand edit inside one variant, including part-tree, layout, and binding changes, using an offline CI fixture. The release commit MUST also carry the reversible live-Figma receipt showing the edit, finding, and restoration. | `npm run snapshot:schema:check && npm run canvas:binding:check && npm run variant-drift:check`; evidence: [live Figma canvas-variant drift receipt](../parity/receipts/live-figma-variant-drift.md). |
| **V1-EVID-05** | The generated code and canvas renderers MUST retain a cross-surface visual regression floor over every committed catalog variant; text-sensitive environment limits MUST remain reported. | `npm run catalog:visual:check` |

### Security, CI, and release

| ID | Requirement | Exact acceptance command or evidence |
|---|---|---|
| **V1-SEC-01** | Conversion remains deterministic and local; credentials MUST NOT be committed, embedded in generated artifacts, or stored by the plugin. Public Worker transports MUST fail closed, enforce their capability boundaries, and keep model-spend reservation atomic. | `npm run test:worker && npm run test:playground && npm run typecheck:worker && npm run plugin:check && npm run plugin:ui-check`; evidence: release security review records a clean secret scan and links [Known Limitations §B.14](23-known-limitations.md#b14-the-standing-cifigma-channel-is-half-a-channel). |
| **V1-SEC-02** | Release dependencies MUST contain no known high- or critical-severity production vulnerability. | `npm audit --omit=dev --audit-level=high` |
| **V1-CI-01** | Every gate-shaped package script MUST run in a CI lane or have a current, explicit exclusion reason. Fast, full, and catalog-visual lanes MUST be required on the release PR; no gate may be allowed to fail. The definition itself and stale-source protection MUST be tested in the release commit. | `npm run ci:lanes && npm run ci:lane fast && npm run ci:lane full && npm run ci:lane catalog-visual && npm run test:v1-definition && npm run v1:definition:check && npm run provenance:check`; evidence: all three checks are green on the release commit. |
| **V1-CI-02** | Every shipped surface MUST have automated build and freshness evidence: all three public npm packages, generated React package, plugin zip/UI, Worker, playground, spec site, and generated catalog/Figma artifacts. | `npm --prefix packages/schema run build && npm --prefix packages/cli run build && npm --prefix packages/emitter-web-components run build && npm run build:lib && npm run plugin:zip && npm run build:playground && npm run site:build && npm run publish:check && npm run verify:package && npm run figma:fresh && npm run verify:catalog && npm run catalog:visual:check` |
| **V1-REL-01** | Every release-audit P0 and P1 MUST be closed with a linked failing-before/passing-after check or a measured receipt. Severity cannot be lowered solely to make v1 pass. | Evidence: the release PR contains a complete P0/P1 audit ledger with task ID, closing commit, acceptance command, and result; zero rows may be open, waived, or missing. |
| **V1-REL-02** | Registry and live deployments MUST match the release commit. A source-only release candidate is acceptable before approval but is not final release evidence. Tagging, publication, GitHub release creation, dist-tag changes, and deployment each require a recorded human approval. | `npm --prefix packages/cli run build && npm run publish:check`; after publish: `npm run plugin:zip && npm run build:playground && npm run site:build && npm run deploy:check`. |
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
4. **Known fidelity and reader ceilings:** text wrapping and webfont metrics,
   multi-axis geometry/paint products, unopened pseudo-element channels,
   responsive/viewport constructs, shorthand and `calc()` token references,
   and the other measured residuals in [§§B and C](23-known-limitations.md#b--not-built-yet).
5. **Coverage beyond the measured slice:** no whole-library, primitives-only,
   or exhaustive-correctness promise. The unmeasured long tail remains post-v1
   research ([Known Limitations §C.1](23-known-limitations.md#c1-coverage--how-much-of-a-library-is-actually-captured)).

An item leaves this register only when its new capability has an adversarial
check or committed receipt, the relevant docs are updated, and the release
audit explicitly reclassifies it. Otherwise it remains a limitation even if a
demo succeeds once.
