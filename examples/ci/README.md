# CI recipes — the "no burden" automation for the two journeys

Two GitHub Actions workflows that make contracts carry the design/code sync
so neither side has to. Both run the **published** CLI
(`npx --yes @ds-contracts/cli@0.1.0`) — they work in any repo today, no clone
of this reference repo required.

Every `run:` step in both files has been executed locally against the
published CLI — see [VALIDATION.md](./VALIDATION.md) (produced by
`node examples/ci/validate.mjs`) — with two named exceptions that
`validate.mjs` classifies as CI-only: the git push, and the standing-channel
publish (it needs a live channel *and* a CLI newer than the published
`0.1.0` the other steps pin — `figma publish` ships in the next release).

## [`code-led.yml`](./code-led.yml) — code is truth

**Trigger:** push to `main`, or a published release.

```
extract (published CLI) → adopt proposals into contracts/ → commit
                        → CONTRACTS-BUNDLE artifact
                        → publish to the standing CI→Figma channel
                        → job summary (proposal/skip counts + delivery number)
```

- `ds-contracts extract ds-contracts.config.json` proposes contracts from the
  component source (react-tsx or CEM adapter). The job summary names the
  proposal count **and** the skip count — components the extractor saw but
  could not extract are never silently dropped.
- The refreshed `contracts/` directory is committed back to the branch:
  contracts-in-git are the canon; per-version history is the changelog.
- The **CONTRACTS-BUNDLE** artifact is the exact envelope both delivery
  routes carry (`{ "type": "CONTRACTS-BUNDLE", "version": 1,
  "contracts": [...] }`).

### Two ways the bundle reaches the designer

**1. The standing channel (`figma publish`) — the zero-chore route.**
Mint a channel once per repository:

```
npx @ds-contracts/cli figma claim-channel
```

It prints two keys with one-way derivation between them:

| key | who holds it | what it can do |
|---|---|---|
| `dscw_…` **write key** | CI — repository secret `DS_CONTRACTS_CHANNEL_KEY` | publish |
| `dscr_…` **read key** = `sha256(write key)` | the designer, pasted into the plugin | read only |

CI then publishes on every merge (the workflow step above) and the
designer's plugin finds it waiting — check-on-open when they open the
plugin, or the explicit **Check for updates** button. Nobody waits for
anybody. Because the read key is a hash of the write key, a shared Figma
file or a screenshotted plugin window leaks a key that can **read** the
contracts and can never **inject** into the repository.

Deliveries are numbered (`seq`), so the plugin can say "CI has an update
waiting (#12)" — and refuse to quietly roll the library backwards if a
lower-numbered delivery ever arrives (see *the freshness guard*, below).
Reads are non-consuming: checking twice is free.

**2. The pairing code (`figma push`) — the ad-hoc route.** Unchanged, and
not going away:

```
# designer opens the Figma plugin's Receive panel → gets a 6-char code
npx @ds-contracts/cli figma push contracts-bundle.json --code <CODE>
```

One-time, 15-minute TTL, both people in the same window. Use it for a repo
with no channel yet, or a one-off bundle from a laptop. It is the
**unverified** path: nothing about who published travels with it.

### Provenance and the freshness guard

`figma publish` auto-detects the GitHub Actions context
(`GITHUB_REPOSITORY`, `GITHUB_RUN_ID`, `GITHUB_SHA`, `GITHUB_REF`) and sends
it as a **sibling** of the bundle — never inside it, so `figma bundle`'s
byte-determinism is untouched. The worker stores and echoes it without ever
reading it; the plugin renders it above the change report:

```
acme/design-system — CI run #17654321, commit 9f1c2ab, branch main, published 4 minutes ago.
```

A publish with no CI context says **"Unattributed delivery"** rather than
showing blanks.

When a delivery arrives that is not newer than what this Figma file already
applied from that channel — the real case being a channel that expired after
30 idle days and was re-claimed, restarting at `#1` — the plugin names it and
starts every Apply box **unchecked**:

> this delivery (#1) is older than what this file last applied (#7) —
> applying it would roll this library BACKWARDS.

Warn and default-safe, never block: a deliberate rollback is still one tick
per component away. This closes a real hole — before it, `updatePlan`
compared spec hashes for equality only, with no ordering anywhere, so an
older bundle applied as an ordinary default-selected change.

**Still open, named:** deliveries are **not signed**. Anyone holding the
write key can publish any provenance they like, and the plugin shows it. An
HMAC-verified delivery with a "verified" badge is docs/18 G1's slice S3 and
is excluded from this round by name — as is the channel's read half (a
headless drift recompute off a REST file dump, so CI can referee drift
without a human clicking a tab).

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

`channel-round-trip` is the standing gate for everything on this page about
the channel: the CLI's own provenance detection and publish envelope, the
real worker pipeline in-process (claim → publish → non-consuming read, with
the write/read key split refused by name in both directions), and the
plugin-side freshness guard. It runs the 24-case
`workers/assist/test/channel.test.ts` suite alongside it — TTL asserted on
every write, caps by channel, kill-switch independence, every malformed
envelope refused by name. Zero network in all of it.
