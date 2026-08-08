# J15 freeze-and-rehearse evidence — freeze candidate `9e6eb062`

Run driver: automation agent (J15), 2026-08-08, macOS arm64 (Darwin 25.3.0).
Scope: docs/27 §§1–4 and §6 rehearsed locally, build-only. **Nothing was
published, tagged, deployed, or pushed.** Human-approval boxes in
`RELEASE_CHECKLIST.md` remain untouched; the decision line remains
**release blocked**.

> **Supersession note:** this file supersedes the `RELEASE_CHECKLIST.md`
> "Immutable inputs" values frozen at `4fda3b3` (and the blocked first J15
> attempt at `fabaea84`, kept as Appendix A). The checklist's immutable-inputs
> block must be re-frozen on `9e6eb062`; in particular the lockfile SHA-256
> changed from `01c0f676…` (4fda3b3) to `caadfcc0…` (this tip).

## 1. Freeze record (docs/27 §1)

Recorded 2026-08-08T09:08:33Z:

- Branch: `feat/exact-conversion-wave0` · PR #13
- Tip SHA: `9e6eb06283335c289f79286f3c0a1777cb6f8ae5`
  ("the post-v1 entry-4 pin lagged its own doc edit — one normalized line,
  both v1-definition gates green; stray console-MCP chunk scripts disposed
  for freeze hygiene.")
- `git status --short`: clean except this run's own evidence file
  (`?? .agents/runs/v1-release-prep/FREEZE-EVIDENCE.md`). The 13 stray
  `.tmp-*.js` scripts flagged in the previous attempt were deleted in
  `9e6eb062` itself.
- Node `v20.19.4` · npm `10.8.2`
- `package-lock.json` SHA-256:
  `caadfcc0cee35d7a38db3c152787b2e0f017fcc8841e0f097a58bc86caf33f1a`
- Manifest versions verified in-tree: root `1.0.0-rc.1` ·
  `@ds-contracts/cli 0.5.0-rc.2` · `@ds-contracts/schema 16.1.0-rc.2` ·
  `@ds-contracts/emitter-web-components 0.4.0-rc.2`

Registry state (queried 2026-08-08T09:08Z):

```
npm view @ds-contracts/cli version dist-tags --json
  { "version": "0.4.0", "dist-tags": { "latest": "0.4.0", "next": "0.5.0-rc.1" } }
npm view @ds-contracts/schema version dist-tags --json
  { "version": "16.0.0", "dist-tags": { "latest": "16.0.0", "next": "16.1.0-rc.1" } }
npm view @ds-contracts/emitter-web-components version dist-tags --json
  { "version": "0.3.0", "dist-tags": { "latest": "0.3.0", "next": "0.4.0-rc.1" } }
```

**No collision:** the intended `-rc.2` versions do not exist on the registry;
`latest` remains the stable line on all three packages.

## 2. CI on `9e6eb062`

| Workflow | Event | Run | Conclusion |
| --- | --- | --- | --- |
| fast | pull_request | 31249897605 | success |
| fast | push | 31249895048 | success |
| release candidate | pull_request | 31249897599 | success (ubuntu + macos matrix) |
| security | pull_request | 31249897606 | success |
| catalog-visual | pull_request | 31249897604 | success |
| full | pull_request | 31249897620 | **FAILURE** — see §8 |

## 3. Clean-clone rehearsal (docs/27 §2)

Fresh `git clone file:///Users/tjpitre/Sites/ds-contracts-poc` → detached
checkout `9e6eb062` → `git clean -fdx` → `npm ci` in the session scratch dir
(`…/scratchpad/j15/clone`). Clone lockfile SHA-256 identical to source.
Playwright Chromium reused from the machine cache
(`~/Library/Caches/ms-playwright`, playwright-core 1.61.1).

| Command | Exit |
| --- | --- |
| `npm ci` (fresh, node_modules removed first) | 0 · "found 0 vulnerabilities" |
| `npm --prefix packages/schema run build` | 0 |
| `npm --prefix packages/cli run build` | 0 |
| `npm --prefix packages/emitter-web-components run build` | 0 |
| `npm run ci:lanes` | 0 |
| `npm run docs:check` | 0 |
| `npm run v1:definition:check` | 0 |
| `npm run test:v1-definition` | 0 (25/25) |
| `npm run audit:production` | 0 |
| `npm --prefix packages/schema run package:smoke` | 0 |
| `npm --prefix packages/emitter-web-components run package:smoke` | 0 |
| `npm run publish:check` | 0 |
| `npm run ci:lane fast` | 0 — **60/60 gates green** |
| `npm run ci:lane catalog-visual` | see §7 |
| `npm run ci:lane full` | see §7 |

## 4. Pack + tarball review (docs/27 §3)

`npm pack` from the clean clone into a disposable directory:

| Tarball | SHA-256 |
| --- | --- |
| `ds-contracts-cli-0.5.0-rc.2.tgz` | `c8c6ed51474cf43412f9440cc93f4c7d14fd13c54890bf8c33dfe7a6b4e32083` |
| `ds-contracts-schema-16.1.0-rc.2.tgz` | `1161ff0062311528f0893b2c997fbd9fce01b643d1163a481c311f8689b87c7d` |
| `ds-contracts-emitter-web-components-0.4.0-rc.2.tgz` | `ca4e2225e15bb70f8857d7892db117b1c30869d626221815c4e9c03a30855489` |

**Cross-platform determinism:** the `release candidate` workflow run
31249897599 uploaded `SHA256SUMS` from both `build RC (ubuntu-latest)` and
`build RC (macos-latest)`; both files list **exactly these three hashes** —
CI-Linux, CI-macOS, and this local macOS clean-clone pack are byte-identical.

`npm pack --dry-run --json` inspection:

- schema `16.1.0-rc.2` — 9 files: README, `contract.schema.json` (generated
  JSON schema), built `dist/` exports (`contract-schema`, `index`,
  `validate` + d.ts), package.json. Nothing else.
- cli `0.5.0-rc.2` — 4 files: README, `dist/cli.js`, `dist/computed.js`,
  package.json.
- emitter `0.4.0-rc.2` — 4 files: README, `dist/index.js`, `dist/index.d.ts`,
  package.json.
- No coverage, credentials, env files, local configuration, or unrelated
  workspace files in any manifest.

## 5. Consumer-install smoke (docs/27 §3)

Empty directory (`…/scratchpad/j15/consumer`), `npm init -y`, then
`npm i` of the three local tarballs → exit 0, 0 vulnerabilities.

- `ds-contracts --help` → exit 0, banner
  `ds-contracts 0.5.0-rc.2 — contracts as the deterministic bridge between
  design and code`, full verb set present (onboard, promote, init, extract,
  generate, figma …, diff, propose-pr).
- ESM imports work: `import * as s from '@ds-contracts/schema'` exposes
  `ContractSchema`, `ComponentRefSchema`, `CONTRACT_STATES`, …;
  `@ds-contracts/emitter-web-components` exposes `emitWebComponent`,
  `webComponentsEmitter`, `shadowCss`, …
  (Note: bare CommonJS `require()` of the schema fails with
  `ERR_PACKAGE_PATH_NOT_EXPORTED` — both packages are `"type": "module"`
  ESM-only by design; not a defect, but adopters on CJS should know.)
- Real generation with the packed CLI:
  `ds-contracts generate <clone>/examples/altitude/contracts/badge.contract.json
  --out ./gen-out --target react --tokens <clone>/examples/altitude/tokens/altitude-minted.dtcg.json`
  → exit 0, `✔ Generated 1 component(s) → …/gen-out: Badge`, emitting
  `Badge/Badge.tsx`, `Badge/Badge.module.css`, `Badge/index.ts`, `index.ts`.

## 6. Migration notes verification (docs/27 §4)

Checked read-only at `9e6eb062`:

- Package manifests match the notes exactly: cli `0.5.0-rc.2`, schema
  `16.1.0-rc.2`, emitter `0.4.0-rc.2`; registry `next` still holds the
  `-rc.1` line and `latest` the stable line (§1 queries).
- Worker rule intact: docs/27 §4 and `RELEASE-NOTES-DRAFT.md` both carry the
  "keep `ASSIST_ENABLED=false` through the next UTC-day boundary" requirement,
  and `workers/assist/src/index.ts:71` fails closed
  (`if (env.ASSIST_ENABLED !== 'true') return json(503, …)`).
- `RELEASE-NOTES-DRAFT.md` `<SHA256-AT-FREEZE>` slots are now filled with the
  §4 hashes; its owner-notes CI paragraph updated to the `9e6eb062` state.

## 7. Deployment rehearsal — build only, NO deploy (docs/27 §6)

All three artifacts built in the clean clone, exit 0:

| Artifact | Hash (SHA-256) |
| --- | --- |
| `playground/public/ds-contracts-sync-runner-plugin.zip` (851,960 bytes, 4 files; engine stamp `engine 0d5b4f5f1ebf · 639244B`) | `0091f20e7a580303a87ace713790da5096498599a56370fe5475610c7ed13a88` |
| `playground/dist/index.html` (playground entry) | `3068a2f41009d31eb35c4308b8cc9c4b9f153529a69762b265a19b6daa0f4b5c` |
| `site/dist/index.html` (spec-site entry) | `4886f731d6d1d94e558a7e207c3f3c5f5c81afc384c3bc08531d68fdbd1d519b` |

`npm run deploy:check` (pre-deploy, against live sites): **exit 1 — EXPECTED
pre-deploy drift, not a defect** (docs/27 §6: both Pages projects are direct
upload; live bytes are older than the local build until a human deploys).
Rows reported:

- plugin zip STALE: live 791,210 bytes (sha `60e0e93cae78…`) vs local build
  851,960 bytes (sha `0091f20e7a58…`)
- playground STALE: live index references `/assets/index-N7fZuQF7.js` vs
  local `/assets/index-H1etVZa-.js` (css + rolldown-runtime chunks identical)
- spec site STALE: `/get-started/` live 39,871 bytes (sha `a36034fbe47d…`)
  vs local 40,268 bytes (sha `7f14bd6a0f7c…`)

Linux/macOS deployment-artifact comparison: the Linux counterpart is the
manually dispatched `deploy-check` workflow (`.github/workflows/deploy-check.yml`),
which builds the same three artifacts and probes live bytes; it is
red-by-construction for any undeployed commit, so the cross-platform
comparison for deployment artifacts is performed at deploy time by the
deployment owner. Package tarballs are already proven byte-identical across
platforms (§4).

Local lane runs at `9e6eb062` (clean clone):

- `npm run ci:lane catalog-visual` → exit 0, **1/1 gates green**
  (`catalog:visual:check` 22.4s).
- `npm run ci:lane full` → **exit 1, 4/36 gates red** — see §8.

## 8. FULL-LANE RED at `9e6eb062` — the freeze is again blocked

CI run 31249897620 (`full gate sweep`, Linux) FAILED, and the local macOS
clean-clone `ci:lane full` reproduces the same defect set — this is a
cross-platform tip defect cluster, not an environment issue. `fast`
(60/60 local + green CI), `catalog-visual`, `security`, and the RC matrix are
all green on the same SHA; these gates live only in the full lane, which is
how the tip reached CI red-free on fast.

Failing gates (identical on CI-Linux and local macOS):

1. `npm run eval` — 4 red evals:
   - `C3-detection raw-text-root-projection`: `emit-html` now refuses
     `ds.eval-field` — "anatomy.root (semantics.element `input`) mounts 2
     child part(s), but children cannot mount inside void element `<input>`" —
     the eval fixture violates the (new) void-element refusal.
   - `C1-determinism promote-generalization`: tailwind
     `contracts/alert.contract.json` — the shared promote module does NOT
     reproduce the committed bytes.
   - `C8-journey tailwind-figma-genesis`: committed
     `examples/tailwind/figma/tailwind.bundle.json` is STALE vs a fresh
     `figma bundle` build.
   - `C8-journey altitude-shadow-dom-genesis`: committed
     `examples/altitude/figma/altitude.bundle.json` is STALE likewise.
2. `npm run dagger:census` — 13 drifts: tailwind and astryx bundles now
   `(bundle REFUSED): 0 → 1`, with the 11 per-component receipt rows
   (flowbite.alert/badge/button/card/toggleswitch;
   astryx.badge/button/card/dropdown-menu/slider/toast) going `1 → 0`
   because the whole-bundle refusal supersedes them.
3. `npm run ua-baseline:check` — control-baseline honesty: 1 component fails
   to re-fuse: `astryx.json/Switch: axis "value" is not an enum prop
   (booleans ride stateProps; text/number never enumerate — §1.4)`.

(Local-only: `verify:package` also red in the clone with
`ERR_MODULE_NOT_FOUND …/dist/index.js` — that is the missing `build:lib`
prep artifact the local lane runner deliberately does not build; CI's
`verify:package` step was green. Environmental, not a defect.)

Root-cause shape (diagnosis, not yet fixed): the recent behavior-changing
commits — the gradient wave (`fabaea84`, new oblique-gradient/void-element
refusals riding every surface) and the astryx switch contract rework — changed
emitter/promote/bundle behavior without regenerating the committed downstream
artifacts (tailwind alert contract, tailwind + astryx bundles), without
updating the `ds.eval-field` eval fixture to the new refusal, and without
re-recording the dagger census and ua-baseline pins. The fast lane does not
carry these gates, so the tip looked green until the full sweep ran.

**Disposition:** `9e6eb062` cannot be the release commit. Everything in
§§1–7 (freeze record, clean-clone gates, pack determinism, consumer smoke,
migration notes, build-only deployment rehearsal) is valid rehearsal evidence
for the process, but the required `full` check is red, the checklist's
"Required `full` check green" row is unchecked, and the decision line stays
**release blocked**. Next tip must fix/regenerate the artifacts above (or
revert the behavior change), then re-freeze and re-run J15.

## Appendix A — first attempt at `fabaea84` (blocked, historical)

The first J15 attempt (2026-08-08T09:03Z) froze on then-tip
`fabaea845a0b9…` and halted at step 1: CI `fast` (PR 31249711797, push
31249709096) and `release candidate` (31249711796, both matrix jobs) were
red. Diagnosis, reproduced in both the working tree and a clean clone:
commit `2d469f1c` reworded docs/26 post-v1 exclusion entry 4 without updating
the pinned normalized text `POST_V1_ENTRIES[3]` in
`scripts/v1-definition-check.mjs`, so `v1:definition:check` and
`test:v1-definition` failed. Also flagged: 13 untracked `.tmp-*.js` chunk
scripts at repo root, and the checklist lockfile-hash drift. All three
findings were fixed/disposed in `9e6eb062`, on which this file's evidence was
produced. (`ci:lanes`, `docs:check`, `audit:production`, `npm ci`, and the
three package builds were already green at `fabaea84`.)
