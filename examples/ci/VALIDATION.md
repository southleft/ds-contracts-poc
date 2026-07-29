# CI recipe validation — local execution receipt

_Produced by `node examples/ci/validate.mjs` on 2026-07-29. Regenerate any time; network required (published CLI + consumer install)._

Published CLI under test: `@ds-contracts/cli@0.3.0` (npm answers `--version` → `0.3.0`).

`act` is not assumed. Every `run:` step below was parsed out of the workflow YAML and executed
verbatim with GitHub's own step shell (`bash --noprofile --norc -e -o pipefail`) in a scratch
consumer repo — **code-led**: the committed foreign-sibling extraction fixture as the component
library; **design-led**: the committed `evals/fixtures/storybook-skeleton` + the repo's own
`ds.button` contract/tokens/icons/tokens.css (see Findings for why not the Polaris Badge).
Steps that need live GitHub context are CI-ONLY by name (shell still
`bash -n`-checked); `uses:` steps have no shell to run — the YAML lint covers them.

Step-level `if:` is EVALUATED, not ignored: each step gets its own `$GITHUB_OUTPUT` and a
`skipped-by-if` row means GitHub would skip that step in this consumer too. An `if:` shape the
evaluator does not understand fails the validation rather than being assumed true.

## code-led.yml

| Step | Mode | Result | Note |
| --- | --- | --- | --- |
| (whole file) | yaml-lint | ✔ pass | parsed: name=contracts-code-led, 1 job(s) |
| actions/checkout@v4 | action | ✔ pass | uses: actions/checkout@v4 — no run block; YAML lint covers it |
| actions/setup-node@v4 | action | ✔ pass | uses: actions/setup-node@v4 — no run block; YAML lint covers it |
| Extract contracts from code | executed | ✔ pass | ⚠ 2 component(s) seen but not extractable — listed in ds-contracts/out/proposals.md ⏎ ✔ Review notes → ds-contracts/out/proposals.md ⏎ Next: dump your design library with extract/figma-dump.js, then npm run reconcile |
| Adopt the proposed contracts (code-led — extraction is the new truth) | executed | ✔ pass |  |
| GATE: is this library's anatomy real, or a stub? | executed | ✔ pass |   - acme.pill (Pill) — pill.contract.json ⏎   - acme.plain-box (PlainBox) — plain-box.contract.json ⏎   - acme.widget (Widget) — widget.contract.json [outputs: canvas_ready=false, total=5, stub_count=5] |
| Build the CONTRACTS-BUNDLE artifact (the plugin-bridge envelope) | skipped-by-if | ✔ pass | if: ${{ steps.anatomy.outputs.canvas_ready == 'true' }} → false in this consumer; GitHub would skip this step (shell still bash -n-checked) |
| Commit the refreshed contracts back to the branch | ci-only | ✔ pass | pushes with the workflow GITHUB_TOKEN — the scratch consumer is not a git remote; shell syntax-checked (bash -n) |
| Upload the CONTRACTS-BUNDLE artifact | skipped-by-if | ✔ pass | if: ${{ steps.anatomy.outputs.canvas_ready == 'true' }} → false in this consumer; GitHub would skip this step |
| Publish to the standing CI→Figma channel | skipped-by-if | ✔ pass | if: ${{ steps.anatomy.outputs.canvas_ready == 'true' && env.DS_CONTRACTS_CHANNEL_KEY != '' }} → false in this consumer; GitHub would skip this step (shell still bash -n-checked) |
| Job summary — proposal / skip counts + the anatomy verdict | executed | ✔ pass |  |

## design-led.yml

| Step | Mode | Result | Note |
| --- | --- | --- | --- |
| (whole file) | yaml-lint | ✔ pass | parsed: name=contracts-design-led, 1 job(s) |
| actions/checkout@v4 | action | ✔ pass | uses: actions/checkout@v4 — no run block; YAML lint covers it |
| actions/setup-node@v4 | action | ✔ pass | uses: actions/setup-node@v4 — no run block; YAML lint covers it |
| Install consumer-repo dependencies (Storybook, React) | executed | ✔ pass |   run `npm fund` for details ⏎  ⏎ found 0 vulnerabilities |
| Regenerate code + stories from the contracts | executed | ✔ pass | ✔ Generated 1 component(s) → /private/var/folders/dx/kt5qryjx605f2md58m5cg3n80000gn/T/ds-contracts-ci-validate-DYwMVE/design-led-consumer/src/generated: Button |
| GATE: contracts ⟷ regenerated code parity (exit 0 clean · 1 drift · 2 config error) | executed | ✔ pass | Config: /private/var/folders/dx/kt5qryjx605f2md58m5cg3n80000gn/T/ds-contracts-ci-validate-DYwMVE/design-led-consumer/ds-contracts.config.json ⏎ ℹ design surface not provided — design checks SKIPPED (set design.source to include them) ⏎ ✔ Diagnostic clean — 1 contract(s) hold on the checked surface(s). Report → ds-contracts/out/diagnose-report.json |
| Build Storybook (static — no dev server) | executed | ✔ pass | │  /private/var/folders/dx/kt5qryjx605f2md58m5cg3n80000gn/T/ds-contracts-ci-validate-DYwMVE/design-led-consumer/storybook-static ⏎ │ ⏎ └  Storybook build completed successfully |
| Name the changed contracts | executed | ✔ pass | Changed contracts: ⏎ contracts/button.contract.json |
| Install playwright (pinned — matches the browser revision cache) | executed | ✔ pass | \|■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■        \|  90% of 93.5 MiB ⏎ \|■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■\| 100% of 93.5 MiB ⏎ Chrome Headless Shell 149.0.7827.55 (playwright chromium-headless-shell v1228) downloaded to /Users/tjpitre/Library/Caches/ms-playwright/chromium_headless_shell-1228 |
| Screenshot the changed stories | executed | ✔ pass | screenshots/components-button--ghost.png ⏎ screenshots/components-button--disabled.png ⏎ screenshots/components-button--matrix.png |
| Upload the story screenshots | action | ✔ pass | uses: actions/upload-artifact@v4 — no run block; YAML lint covers it |
| Compose the PR comment | executed | ✔ pass | - `components-button--secondary.png` ⏎  ⏎ _Review the stories against the Figma frames, then merge — the generated code IS the contract._ |
| Post the PR comment (plain GITHUB_TOKEN — no external services) | ci-only | ✔ pass | POSTs to the GitHub REST API for a live PR — no PR exists locally; shell syntax-checked (bash -n). The comment BODY construction is its own step and IS executed. |

## Findings — defects this validation caught by EXECUTING the recipes

### code-led: static extraction on this consumer produces STUB anatomy — the anatomy gate fires

The code-led consumer fixture (`extract/fixtures/foreign-sibling`) is a React library with **no
co-located CSS Modules**, which is the majority case in the wild. `ds-contracts extract` proposes
5 schema-valid contracts and every one of them carries `"anatomy": { "root": {} }` — a stub.

A stub does not refuse downstream. Emitted to the canvas it produces a component set with
correctly-named variant frames and nothing inside them (measured on a comparable stub: 10
variants, a 53,283-byte sync script, every variant spec a bare `{ type: root, name, layout }`
with no children, no fills, no text).

Before the gate, this validation executed the bundle step on exactly these five stub contracts
and recorded a pass — the receipt certified a recipe that ships hollow components. `code-led.yml`
now carries an **anatomy gate**: contracts are still extracted and committed (a stub contract is
a real, reviewable API surface), and only the CANVAS half is withheld, with the stub components
and the computed-capture fix named in the job summary. The rows above show that gate returning
`canvas_ready=false` and the downstream steps `skipped-by-if`, which is the recipe working.

### react emitter: hyphenated part names emit invalid JavaScript (found 2026-07-19, FIXED)

_Historical — fixed in the reference repo (`core/emit-react.ts` now emits bracket access) and
carried in the published 0.2.0. Kept here because it is why the design-led consumer below uses
`ds.button` rather than the Polaris Badge._

The first design-led validation run used the Polaris Badge v0.3.0 contract (round-4 DOM-anatomy
promotion: part names `label-2`, `icon-2`, `icon-3-incomplete`, …). `ds-contracts generate` (and
`npm run generate` — same engine) emits `className={styles.label-2}` /
`className={styles.icon - 3 - incomplete}`: **member access with a hyphenated identifier**, which
JavaScript parses as subtraction. Result at runtime: `NaN` class names on the default render and
`ReferenceError: incomplete is not defined` as soon as a story sets `progress` (the Matrix story
crashed; 15/16 Badge stories screenshotted, the 16th timed out on the Storybook error screen).
The SAME invalid code is already committed in `examples/polaris/generated/react/Badge.tsx` (round-4
stage 8, "76 files byte-stable" — byte-stability was gated, runtime execution was not).

- Repro (on 0.1.0, the version where it was found — 0.2.0 no longer reproduces it):
  `npx --yes @ds-contracts/cli@0.1.0 generate examples/polaris/contracts/badge.contract.json
  --out /tmp/x --tokens examples/polaris/tokens/polaris-light.dtcg.json,examples/polaris/tokens/polaris-minted.dtcg.json
  --icons examples/polaris/assets/icons --stories` → `grep "styles\." /tmp/x/Badge/Badge.tsx`
- Fix belongs in `core/emit-react.ts` (bracket access `styles['label-2']` for non-identifier part
  names) — outside this validation's scope; owned by the emitter workstream.
- This receipt therefore validates the design-led recipe against the repo's own `ds.button`
  contract (camelCase part names, sound output). The recipe itself is unchanged either way.

## Job summary produced by the code-led summary step (local stand-in file)

````markdown
## ds-contracts extract

- ✔ 5 proposed contract(s) → ds-contracts/out/contracts/ (all schema-valid)
- ⚠ 2 component(s) seen but not extractable — listed in ds-contracts/out/proposals.md

### Anatomy gate

⛔ **Canvas delivery SKIPPED — 5 of 5 contracts have STUB anatomy** (`"anatomy": { "root": {} }`).

Static extraction recovers anatomy only from **React + a co-located CSS Module**.
For every other styling system it proposes an empty root — and an empty root does
not refuse downstream, it **generates correctly-named, visually EMPTY component
sets** in the designer's Figma file. That is why this job stopped here.

Stub contracts:

- acme.banner (Banner) — banner.contract.json
- acme.pill-base (PillBase) — pill-base.contract.json
- acme.pill (Pill) — pill.contract.json
- acme.plain-box (PlainBox) — plain-box.contract.json
- acme.widget (Widget) — widget.contract.json

**The fix — measure the anatomy instead of guessing it** (real Chromium, computed styles):

```
npx @ds-contracts/cli onboard <your-package-or-path>   # stops at a review gate
npx @ds-contracts/cli onboard --continue               # capture → promote → publish
```

(`onboard` needs @ds-contracts/cli >= 0.3.0. The longhand it wraps:
`extract --draft-capture-config` → review → `extract --computed --config` → `promote`,
then re-run this workflow.)

The contracts themselves **were** committed — a stub contract is still a real,
reviewable API surface. Only the canvas half is withheld.
````

