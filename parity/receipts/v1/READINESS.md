# V1 readiness — every row of docs/26, run on this commit

Written by `npm run v1:readiness` (scripts/v1-readiness.ts). The rows, their commands and their evidence references are parsed from docs/26-v1-definition.md — nothing here is listed by hand. Seconds are measured and move run to run; nothing else in this file should.

- **commit:** `9553a6a5648b46a0b475cb60e53cec7f318b2532`
- **tree dirty at start:** no
- **definition:** docs/26-v1-definition.md sha256 `11df3102bf4f1579`
- **flags:** (none)
- **lane map:** catalog-visual, deploy-check, fast, full, publish-rc, release-candidate, security, sync-spine (from .github/workflows via .github/scripts/lane-map.ts)
- **prep:** ✔ `npm --prefix packages/schema run build` 1s · ✔ `npm --prefix packages/core run build` 1s · ✔ `npm --prefix packages/cli run build` 1s · ✔ `npm --prefix packages/emitter-web-components run build` 0s · ✔ `npm run build:lib` 1s · ✔ `npm run plugin:zip` 0s

**Tally.** GREEN 19 · RED 5 — 24 rows.

| row | state | command | seconds | evidence |
|---|---|---|---|---|
| V1-SCOPE-01 | **GREEN** | ✔ `npm run docs:check` | 0 | ✔ 23-known-limitations.md#a4-out-of-scope-by-decision--not-gaps<br>human: Known Limitations §A.4 remains linked from the release notes |
| V1-JOURNEY-01 | **GREEN** | ✔ `npm run plugin:ui-check` && ✔ `npm run extract:figma:roundtrip:uui` && ✔ `npm run ledger:fresh` && ✔ `npm run conformance:canvas` | 13 | ✔ parity/receipts/phase-2/FIGMA-DS-EXAM.md |
| V1-JOURNEY-02 | **GREEN** | ✔ `npm run test:onboarding` && ✔ `npm run paste:check` && ✔ `npm run plugin:check` && ✔ `npm run first-party-bundle:check` && ✔ `npm run maintain` | 69 | — |
| V1-JOURNEY-03 | **GREEN** | ✔ `npm run reconcile` && ✔ `npm run diagnose` && ✔ `npm run docs:check` ⟨reused V1-SCOPE-01⟩ | 2 | ✔ 23-known-limitations.md#b11-adopting-a-hand-built-figma-set-is-not-a-verb-this-tool-has<br>✔ 23-known-limitations.md#d32-the-two-acceptance-rows-that-were-red-on-the-commit-itself--closed<br>mentions (not run): `npm run reconcile && npm run diagnose`<br>mentions (not run): `npm run parity:snapshot:rest` |
| V1-JOURNEY-04 | **GREEN** | ✔ `npm run recipe:canvas-to-code:held-out:check` | 2 | ✔ 32-recipe-ir-pivot.md#merge-execution-2026-08-30 |
| V1-CLASS-01 | **GREEN** | ✔ `npm run capability:fresh` && ✔ `npm run extract:computed:drift` | 0 | ✔ 23-known-limitations.md#c11-which-component-archetypes-are-proven--the-actionable-cut<br>✔ 23-known-limitations.md#d32-the-two-acceptance-rows-that-were-red-on-the-commit-itself--closed |
| V1-CLASS-02 | **GREEN** | ✔ `npm run docs:check` ⟨reused V1-SCOPE-01⟩ | 0 | ✔ 23-known-limitations.md#c11-which-component-archetypes-are-proven--the-actionable-cut<br>human: the release notes reproduce or link the bounds in Known Limitations §C.1.1 |
| V1-CLASS-03 | **GREEN** | ✔ `npm run recipe:button:check` && ✔ `npm run recipe:input-field:check` && ✔ `npm run recipe:combobox:check` && ✔ `npm run recipe:table:check` && ✔ `npm run recipe:calendar:check` && ✔ `npm run recipe:pivot-status:check` | 18 | ✔ 32-recipe-ir-pivot.md#e4-applied-2026-08-30 |
| V1-COMPAT-01 | **GREEN** | ✔ `node -e "const r=require('./package.json'),c=require('./packages/cli/package.json');if(r.engines.node!=='>=20'\|\|c.engines.node!=='>=20'\|\|r.peerDependencies.react!=='>=18'\|\|r.peerDependencies['react-dom']!=='>=18')process.exit(1)"` | 0 | — |
| V1-COMPAT-02 | **GREEN** | ✔ `npm run schema` && ✔ `npm run schema:fresh` && ✔ `npm run contracts:migrate:check` && ✔ `npm run slot-constraints:check` | 7 | ✔ ../CONTRIBUTING.md#contract-change-policy<br>human: release PR includes a contract-change classification using CONTRIBUTING § Contract change policy |
| V1-COMPAT-03 | **RED** | ✖ `npm run eval` && · `npm run eval:record:check` && · `npm run generation:atomic:check` && · `npm run provenance:check` && · `npm run figma:fresh` && · `npm run verify:catalog` | 3242 | — |
| V1-COMPAT-04 | **GREEN** | ✔ `npm run plugin:zip` ⟨reused prep⟩ && ✔ `npm run plugin:ui-check` ⟨reused V1-JOURNEY-01⟩ | 0 | ✔ 23-known-limitations.md#a3-the-architecture-the-plugin-cannot-run-your-code<br>human: Known Limitations §§A.3–A.4 remains linked from release notes |
| V1-EVID-01 | **RED** | ✖ `npm run eval` ⟨reused V1-COMPAT-03⟩ && · `npm run docs:check` && · `npm run capability:fresh` && · `npm run generation:atomic:check` && · `npm run static:empty-content:check` && · `npm run code-only-facts:check` | 0 | — |
| V1-EVID-02 | **GREEN** | ✔ `npm run capability:fresh` ⟨reused V1-CLASS-01⟩ && ✔ `npm run docs:check` ⟨reused V1-SCOPE-01⟩ | 0 | ✔ 23-known-limitations.md#c1-coverage--how-much-of-a-library-is-actually-captured |
| V1-EVID-03 | **GREEN** | ✔ `npm run conformance` && ✔ `npm run conformance:roundtrip` && ✔ `npm run conformance:canvas` ⟨reused V1-JOURNEY-01⟩ && ✔ `npm run dagger:census` && ✔ `npm run closure:check` | 33 | — |
| V1-EVID-04 | **GREEN** | ✔ `npm run snapshot:schema:check` && ✔ `npm run canvas:binding:check` && ✔ `npm run variant-drift:check` | 10 | ✔ ../parity/receipts/live-figma-variant-drift.md |
| V1-EVID-05 | **GREEN** | ✔ `npm run catalog:visual:check` && ✔ `npm run maintain:visual` | 24 | — |
| V1-SEC-01 | **GREEN** | ✔ `npm run test:worker` && ✔ `npm run test:playground` && ✔ `npm run typecheck:worker` && ✔ `npm run plugin:check` ⟨reused V1-JOURNEY-02⟩ && ✔ `npm run plugin:ui-check` ⟨reused V1-JOURNEY-01⟩ | 2 | ✔ 23-known-limitations.md#b14-the-standing-cifigma-channel-is-half-a-channel<br>human: release security review records a clean secret scan and links Known Limitations §B.14. |
| V1-SEC-02 | **GREEN** | ✔ `npm audit --omit=dev --audit-level=high` | 1 | — |
| V1-CI-01 | **RED** | ✔ `npm run ci:lanes` && ✖ `npm run ci:lane fast` && · `npm run ci:lane full` && · `npm run ci:lane catalog-visual` && · `npm run test:v1-definition` && · `npm run v1:definition:check` && · `npm run provenance:check` && · `npm run eval:record:check` | 366 | — |
| V1-CI-02 | **GREEN** | ✔ `npm run prep:core` && ✔ `npm --prefix packages/schema run build` ⟨reused prep⟩ && ✔ `npm --prefix packages/cli run build` ⟨reused prep⟩ && ✔ `npm --prefix packages/emitter-web-components run build` ⟨reused prep⟩ && ✔ `npm run build:lib` ⟨reused prep⟩ && ✔ `npm run plugin:zip` ⟨reused prep⟩ && ✔ `npm run build:playground` && ✔ `npm run site:build` && ✔ `npm run publish:check` && ✔ `npm run verify:package` && ✔ `npm run verify:published` && ✔ `npm run schema:fresh` ⟨reused V1-COMPAT-02⟩ && ✔ `npm run figma:fresh` && ✔ `npm run generated:fresh` && ✔ `npm run verify:catalog` && ✔ `npm run catalog:visual:check` ⟨reused V1-EVID-05⟩ | 20 | — |
| V1-REL-01 | **RED** | — (evidence only) | 26 | human: the release PR contains a complete P0/P1 audit ledger with task ID, closing commit, acceptance command, and result<br>ledger: 60 rows — closed 56, refuted 2, open-human 2, red 0 ([AUDIT-LEDGER.md](AUDIT-LEDGER.md))<br>audit ledger: AUD-U17 OPEN-HUMAN, AUD-U22 OPEN-HUMAN |
| V1-REL-02 | **RED** | ✔ `npm --prefix packages/cli run build` ⟨reused prep⟩ && ✔ `npm run publish:check` ⟨reused V1-CI-02⟩ && ✔ `npm run verify:published` ⟨reused V1-CI-02⟩<br>after publish: ✔ `npm run plugin:zip` ⟨reused prep⟩ && ✔ `npm run build:playground` ⟨reused V1-CI-02⟩ && ✔ `npm run site:build` ⟨reused V1-CI-02⟩ && ✖ `npm run deploy:check` | 729 | — |
| V1-REL-03 | **GREEN** | ✔ `npm run docs:check` ⟨reused V1-SCOPE-01⟩ | 0 | ✔ 23-known-limitations.md<br>human: release PR checklist links every deferred audit task to one item below and links the complete Known Limitations |

## Tracked files a command rewrote

- V1-COMPAT-03: `npm run eval` changed M evals/results.json

## Red and unrun commands — captured tail

### V1-COMPAT-03 — `npm run eval` (exit 1, 3242s)

```
e stroke, FC-PSEUDO-STROKE-GLYPH L→SVG, FC-VARIANT-BOOL-LBP, FC-CARBON-TABS-LABEL, FC-FIGMA-CLIP-DEFAULT, FC-ASTRYX-SLIDER-TOOLTIP, FC-SVG-VIEWBOX, FC-FLEX-BASIS, FC-SVG-ROTATION, FC-WIDTH-TOKEN, FC-CONTRAST-ICON, FC-ENUM-HOLE chip, FC-PSEUDO-OVERFLOW, FC-STATE-PREVIEW-NOISE — all green
  ✔ C3-detection  code-to-canvas-wave-a-emit-pins
trap-corpus-check: frozen adversarial stems structural/compile markers green
  ✔ C3-detection  trap-corpus-check
sync-ledger-lockfile: canvas-edit→canvas-ahead, hash-bump→code-ahead, both→conflict, recorded-amend echo→in-sync (unrecorded amend raises the named false alarm); a foreign-grammar or untagged baseline is incomparable, never drift; serialization deterministic; offline gate green over the committed ledger
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

227/230 evals passed — evals/results.json (commit 9553a6a5)
```

### V1-CI-01 — `npm run ci:lane fast` (exit 1, 365s)

```
  ✔    0.6s  npm run placeholder-ink:check
  ✔    3.1s  npm run first-party-bundle:check
  ✔    2.0s  npm run code-connect:check
  ✔    1.3s  npm run prop-collision:check
  ✔    0.6s  npm run playground:flow-check
  ✔    0.2s  npm run extract:figma:visual:anchors
  ✔    0.1s  npm run visual-truth:report:fresh
  ✔    0.2s  npm run tokens:snapshot:check
  ✔    0.2s  npm run figma:rest:refusal:check
  ✖   10.7s  npm run census:check -- --phase full --allow-red-verdicts
  ✖   11.7s  npm run census:check -- --self-test
  ✔    0.5s  npm run canvas:usable:check
  ✔    0.8s  npm run canvas:usable:self-test
  ✖   11.6s  npm run census:check -- --phase design-to-code
  ✔    0.5s  npm run first-pass:check
  ✔    1.1s  npm run first-pass:check -- --self-test
  ✔    2.5s  npm run render-browser:check
  ✔    1.4s  npm run mixed-browser:check
  ✔    9.2s  npm run door-register:check
  ✔   11.3s  npm run door-register:self-test
  ✔    0.3s  npm run lowering:check
  ✔    1.5s  npm run lowering:check -- --self-test
  ✔    0.2s  npm run grammar-coverage:check
  ✔    0.2s  npm run grammar-coverage:check -- --self-test
  ✔    1.1s  npm run corpus:reproducible:check
  ✔    0.2s  npm run corpus:reproducible:check -- --self-test
  ✔    0.9s  npm --prefix packages/cli run test
  ✔    1.5s  npm --prefix packages/cli run coverage

✖ 3/181 gate(s) failed in lane "fast".
```

### V1-REL-02 — `npm run deploy:check` (exit 1, 729s)

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
  - plugin zip STALE: live is 942148 bytes (sha af19cc985469…), local build is 1117430 bytes (sha 514d2263ec30…) — a designer downloading today gets a different engine than this repo builds
  - playground STALE: live index references [/assets/index-C1ojNmZG.js, /assets/index-oTRYTN6T.css, /assets/rolldown-runtime-aKtaBQYM.js], local build references [/assets/index-COkJOfDr.js, /assets/index-CfaJLxBU.css, /assets/rolldown-runtime-aKtaBQYM.js] — vite renames every chunk on any content change, so these are different builds
  - spec site STALE: /get-started/ live is 40276 bytes (sha fdf98969ffe6…), local build is 41936 bytes (sha 67474ff30be6…)

Redeploy with: npm run deploy   (builds, publishes both Pages projects, then re-runs this check)
```

