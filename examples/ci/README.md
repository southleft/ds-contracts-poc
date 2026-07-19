# CI recipes — the "no burden" automation for the two journeys

Two GitHub Actions workflows that make contracts carry the design/code sync
so neither side has to. Both run the **published** CLI
(`npx --yes @ds-contracts/cli@0.1.0`) — they work in any repo today, no clone
of this reference repo required.

Every `run:` step in both files has been executed locally against the
published CLI — see [VALIDATION.md](./VALIDATION.md) (produced by
`node examples/ci/validate.mjs`).

## [`code-led.yml`](./code-led.yml) — code is truth

**Trigger:** push to `main`, or a published release.

```
extract (published CLI) → adopt proposals into contracts/ → commit
                        → CONTRACTS-BUNDLE artifact → job summary (proposal/skip counts)
```

- `ds-contracts extract ds-contracts.config.json` proposes contracts from the
  component source (react-tsx or CEM adapter). The job summary names the
  proposal count **and** the skip count — components the extractor saw but
  could not extract are never silently dropped.
- The refreshed `contracts/` directory is committed back to the branch:
  contracts-in-git are the canon; per-version history is the changelog.
- The **CONTRACTS-BUNDLE** artifact is the exact envelope the plugin bridge
  carries (`{ "type": "CONTRACTS-BUNDLE", "version": 1, "contracts": [...] }`
  — `workers/assist/src/bridge.ts`). The designer's update path today:

  ```
  # designer opens the Figma plugin's Receive panel → gets a 6-char code
  npx @ds-contracts/cli figma push contracts-bundle.json --code <CODE>
  ```

  Any machine can run the push — the pairing code (minted where the designer
  is looking, one-time, 15-minute TTL) is the auth.

**Roadmap (named, not v1): the async CI→designer channel.** v1 deliberately
keeps a human running `ds-contracts figma push` with the artifact — the
bridge's pairing-code design means delivery happens when the designer asks
for it. A fully-async channel (CI pushes, the plugin's Update tab finds the
bundle waiting, no human courier) is the named next step; it needs a
standing designer-scoped inbox on the bridge rather than an ephemeral
pairing session.

Consumer repo needs: `ds-contracts.config.json` (write one with
`npx @ds-contracts/cli init`, point `code.root`/`code.adapter` at your
library).

## [`design-led.yml`](./design-led.yml) — contracts changed; show the code

**Trigger:** pull request touching `contracts/**` (a design-side proposal —
e.g. one opened by `ds-contracts propose-pr`).

```
generate --stories (published CLI) → GATE: ds-contracts diff (exit 0/1/2)
→ storybook build → playwright screenshots of the changed stories
→ artifact + PR comment (plain GITHUB_TOKEN, no external services)
```

- `ds-contracts generate contracts --out src/generated --stories` regenerates
  React + CSS Modules + Storybook stories from the contracts.
- **The gate is `ds-contracts diff`** with its CI exit codes: `0` clean,
  `1` drift (fails the job, findings named), `2` configuration error. After
  regeneration the contracts ⟷ code parity must hold — a PR that would leave
  the surfaces disagreeing cannot merge.
- Storybook builds statically (the layout is
  `evals/fixtures/storybook-skeleton` — the smallest viable config our
  emitted stories render in), playwright screenshots every story of every
  changed component, and the PR gets:
  - a `story-screenshots` artifact (the images), and
  - a comment listing changed contracts + screenshots — posted with a plain
    `GITHUB_TOKEN` REST call. No marketplace comment action, no external
    screenshot host.

Consumer repo needs: `contracts/`, DTCG token files, the storybook-skeleton
layout (`.storybook/`, `src/generated/`), and a `ds-contracts.config.json`
whose `code.root` points at `src/generated` and `diagnose.contracts` at
`contracts/`.

## Local validation — `validate.mjs`

`act` is not assumed. `node examples/ci/validate.mjs` (from the repo root,
network required):

1. YAML-parses both workflows (the lint),
2. builds a scratch consumer repo per workflow from committed fixtures,
3. executes every `run:` step verbatim with GitHub's step shell
   (`bash --noprofile --norc -e -o pipefail`) against the published CLI,
4. names the CI-only steps (git push, PR-comment POST) and `bash -n`-checks
   their shells instead,
5. writes the receipt to [VALIDATION.md](./VALIDATION.md).

An unclassified `run:` step fails the validation — a recipe edit cannot
silently opt out of local execution.

## The standing gates (evals) that pin these journeys

The eval suite (`npm run eval`) carries `journey-engineer` and
`journey-designer` — network-free end-to-end replays of both journeys whose
command lines come from `evals/fixtures/journey-commands.json`, the same
manifest the docs render. Documented commands and tested commands cannot
diverge.
