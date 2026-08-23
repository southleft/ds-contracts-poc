# 27 · Coordinated release process

This is the runbook for a coordinated release candidate. It separates source,
package, registry, GitHub, Figma, and deployment evidence so a green build is
never mistaken for a published release.

## Candidate inventory

| Surface | Candidate in source | Registry state checked 2026-08-07 | Release action |
| --- | --- | --- | --- |
| Repository/reference implementation | `1.0.0-rc.1` | private root package; not published to npm | signed Git tag and GitHub prerelease |
| `@ds-contracts/cli` | `0.5.0-rc.2` | `latest` is `0.4.0` · `next` is `0.5.0-rc.1` | publish exact RC under `next` |
| `@ds-contracts/schema` | `17.0.0-rc.1` | `latest` is `16.0.0` · `next` is `16.1.0-rc.1` | publish exact RC under `next` — a MAJOR (schema 17 `bindings` hoist; consumers run `ds-contracts migrate`) |
| `@ds-contracts/emitter-web-components` | `0.4.0-rc.2` | `latest` is `0.3.0` · `next` is `0.4.0-rc.1` | publish exact RC under `next` |

Manifest versions are source state only. The candidate is not released until
the release checklist records all applicable human approvals and post-release
checks.

## Roles and approval boundaries

- The release driver prepares evidence and records command output.
- The release owner approves the exact commit, signed tag, and GitHub
  prerelease.
- An npm owner approves each publication and dist-tag change.
- A Figma file owner performs and reverses the live drift probe.
- A deployment owner approves direct uploads to Cloudflare and verifies live
  bytes.
- The security owner disposes of dependency-review, audit, and secret-scan
  findings.

One person may hold multiple roles, but each approval remains a separate
checklist line. Preparation commands below are read-only or write only build
artifacts; tag, publish, release, and deploy commands must not be run before
their approval.

## 1. Freeze the exact commit

1. Confirm the working tree contains no unreviewed files. Generated coverage
   output is not release input.
2. Record `git rev-parse HEAD`, `git status --short`, Node/npm versions, and the
   lockfile hash in [the checklist](../RELEASE_CHECKLIST.md).
3. Verify the candidate versions from the four package manifests.
4. Query registry state rather than copying this document:

```bash
npm view @ds-contracts/cli version dist-tags --json
npm view @ds-contracts/schema version dist-tags --json
npm view @ds-contracts/emitter-web-components version dist-tags --json
```

If an intended RC version already exists, stop. npm package versions are
immutable; compare the published tarball with the candidate and either accept
the exact existing bytes or choose a new version.

## 2. Clean install and deterministic gates

Use a fresh clone or disposable worktree; do not clean a developer's active
tree. On macOS:

```bash
npm ci
npm run ci:lanes
npm run docs:check
npm run test:v1-definition
npm run v1:definition:check
npm run ci:lane fast
npm run ci:lane full
npm run ci:lane catalog-visual
npm run audit:production
```

Install the browser prerequisites printed by the lane runner. The
catalog-visual lane also requires Inter. Record exact command, platform, commit,
exit code, and artifact hashes; do not summarize a skipped prerequisite as
green.

Linux evidence comes from the required `fast`, `full`, `catalog-visual`, and
`security` checks on the same commit. Compare the Ubuntu results with the
macOS rehearsal. A platform-only difference must be explained and approved;
do not loosen a baseline merely to make both platforms green.

The manually dispatched `.github/workflows/release-candidate.yml` runs the
non-publishing package build on both Ubuntu and macOS and uploads tarballs,
`SHA256SUMS`, a manifest, and machine-readable provenance. It never tags,
publishes, or deploys; its artifacts are evidence for the human gates below.

## 3. Build and inspect packages

Build every package from the clean install:

```bash
npm --prefix packages/schema run build
npm --prefix packages/cli run build
npm --prefix packages/emitter-web-components run build
npm --prefix packages/schema run package:smoke
npm --prefix packages/emitter-web-components run package:smoke
npm run publish:check
```

Create real tarballs in a disposable directory and preserve their SHA-256
hashes with the release evidence:

```bash
PACK_DIR="$(mktemp -d)"
npm pack ./packages/schema --pack-destination "$PACK_DIR"
npm pack ./packages/cli --pack-destination "$PACK_DIR"
npm pack ./packages/emitter-web-components --pack-destination "$PACK_DIR"
shasum -a 256 "$PACK_DIR"/*.tgz
```

Inspect `npm pack --dry-run --json` output for each package. The schema tarball
must contain its generated JSON schema and built exports; the CLI must contain
the executable bundle and README; the emitter must contain built exports and
README. No coverage, credentials, local configuration, or unrelated workspace
files may appear.

Install the tarballs into an empty consumer directory. Import the schema and
emitter, run `ds-contracts --help`, and run one contract generation using the
packed CLI. This verifies package exports rather than workspace resolution.

## 4. Migration review

Release notes must tell adopters:

- CLI `0.5.0-rc.2` is newer than the stable `0.4.0` and than the published
  `next` RC (`0.5.0-rc.1`); install it by exact version while it is an RC. Re-run dry-run/review stages before allowing
  `promote`, `figma receive --apply`, or PR-writing commands to change files.
- Promotion now carries and checks contract provenance. A stale capture may be
  refused instead of overwriting a newer approved contract. Preserve the
  provenance fields and anchor sidecars; do not strip them to bypass a
  refusal.
- Static extraction may refuse or leave geometry-only content empty instead of
  inventing visible text. Review proposals that previously depended on a
  placeholder.
- Schema `17.0.0-rc.1` is spec v17 — a BREAKING rename (`figmaRepresentation`,
  `figmaStatePreviews`, `anchors.*`, `slot.figmaProperty` → `bindings.<surface>.*`).
  A v16 document is refused by name; consumers run `ds-contracts migrate <dir>`
  over their contracts and test validation and generated types against the RC
  before changing their range.
- Emitter `0.4.0-rc.2` is newer than stable `0.3.0`. Consumers must install the
  exact RC, regenerate in a disposable output directory, and compare emitted
  Custom Elements, CSS, demos, and Custom Elements Manifest output before
  adopting it.
- npm `latest` remains the stable line during RC evaluation. Examples and
  automation must pin the exact RC or use the `next` tag intentionally.
- The assist Worker now reserves the global model budget through the
  `BudgetCoordinator` Durable Object and stores bridge kind+payload atomically.
  Its first rollout requires Node 22+ for Wrangler and must keep
  `ASSIST_ENABLED=false` through the next UTC-day boundary before enabling the
  new coordinator, so the legacy KV day's spend cannot be reset mid-day.

Any additional contract or CLI incompatibility discovered during rehearsal
must be added to the release notes before approval.

## 5. Figma live receipt

The offline gates are necessary but do not replace a live canvas probe:

```bash
npm run canvas:binding:check
npm run variant-drift:check
```

The release PR must link the committed
[live canvas-variant drift receipt](../parity/receipts/live-figma-variant-drift.md).
A Figma file owner verifies on the release commit that a controlled edit inside
one variant changes the fingerprint and reports the part/layout/binding delta,
then restores the value and variable binding. Record before/edit/after stamps
and confirm the final file is clean. Do not include credentials or private API
responses in the receipt.

## 6. Deployment rehearsal

Build all direct-upload artifacts without deploying:

```bash
npm run plugin:zip
npm run build:playground
npm run site:build
npm run deploy:check
```

Before deployment, `deploy:check` may correctly report that live sites contain
older bytes. Record that as expected drift, not a passing result. Preserve
hashes for the plugin zip, playground entry, and spec-site entry. The Linux
scheduled workflow and macOS rehearsal must either agree or carry an approved
platform-difference disposition.

## 7. Provenance and publication

The preferred npm path is a reviewed GitHub Actions publication job using npm
trusted publishing or an automation token, `id-token: write`, a protected
release environment, and `npm publish --provenance --tag next`. That produces
registry-verifiable build provenance tied to the release commit.

That path exists: `.github/workflows/publish-rc.yml` is the publication
workflow. It is `workflow_dispatch`-only, runs only from `main`, and refuses
to start unless the dispatcher types `PUBLISH_RC` into the confirmation input.
It builds and packs all three packages once into sealed tarballs (with a
`SHA256SUMS` receipt), then a separate `publish` job — gated by the protected
`npm-rc` GitHub environment and holding `id-token: write` — publishes each
tarball that is not already on the registry with
`npm publish --access public --tag next --provenance` via npm trusted
publishing (OIDC; no long-lived token). Every package, whether freshly
published or already present, is then re-downloaded from the registry and
**byte-compared against the sealed local tarball**; a mismatch fails the run.
The workflow also refuses any manifest that is not a `-rc.N` version.

Prerequisites before dispatching it:

- the release commit is merged to `main` (the workflow will not run from any
  other ref);
- the `npm-rc` GitHub environment exists and carries the intended required
  reviewers, so publication is an explicit human approval;
- npm trusted publishing is configured on the registry side for
  `@ds-contracts/cli`, `@ds-contracts/schema`, and
  `@ds-contracts/emitter-web-components`, pointing at this repository and
  workflow.

A local OTP-based `npm publish --tag next` remains possible but does not
create GitHub Actions provenance; do not describe it as attested. If the owner
accepts that exception, record the explicit disposition in the checklist and
release notes.

After the workflow completes, verify independently of it:

```bash
npm view @ds-contracts/schema@16.1.0-rc.2 version dist.tarball dist.integrity --json
npm view @ds-contracts/emitter-web-components@0.4.0-rc.2 version dist.tarball dist.integrity --json
npm view @ds-contracts/cli@0.5.0-rc.2 version dist.tarball dist.integrity --json
npm view @ds-contracts/schema dist-tags --json
npm view @ds-contracts/emitter-web-components dist-tags --json
npm view @ds-contracts/cli dist-tags --json
```

The RC publication must not move `latest`. Confirm each package's `next`
resolves to the RC and `latest` remains the stable version. Install all exact
RCs in a second empty directory and repeat the consumer smoke.

## 8. Tag, GitHub prerelease, and deploy

After release-owner approval, create a signed annotated tag on the verified
commit and push that exact tag. Create a GitHub **prerelease** from it. Attach
the changelog, migration notes, package names and hashes, registry links,
attestation status, live Figma receipt, CI links, deployment status, and all
known limitations.

The repository has no `v0.7.0` tag. Version `0.7.0` was introduced at
`cd886e97a2f45464d1b0883a2adce3efab6acdaa` on 2026-07-20. Do not fabricate or
move history. The owner must choose one disposition:

1. approve a signed annotated historical `v0.7.0` tag pointing to that exact
   commit, then publish it without changing the commit; or
2. leave the tag absent and state that disposition explicitly in the RC GitHub
   release notes.

Only after deployment-owner approval:

```bash
npm run deploy
npm run plugin:zip
npm run build:playground
npm run site:build
npm run deploy:check
```

The final `deploy:check` must be green and the manually dispatched
`deploy-check` workflow must point at the release commit.

## 9. Rollback

Tags and published package versions are immutable evidence. Never move or
overwrite them.

- **npm:** remove a bad RC from `next` by assigning `next` to the last approved
  prerelease or removing the tag. Deprecate the bad exact versions with a
  message pointing to the replacement. Prefer deprecation over unpublish.
- **GitHub:** mark the prerelease withdrawn and add the replacement/disposition
  without deleting evidence.
- **Deployments:** check out the last approved release commit, rebuild from its
  lockfile, deploy through the same human-approved path, then run
  `deploy:check`.
- **Figma:** do not apply a suspect bundle. If already applied, use the approved
  prior bundle through the normal drift-aware update path and verify identity
  and instance preservation.
- **Source:** fix forward with a new RC version. Do not republish an existing
  semver or retarget a signed tag.

Record the incident, affected surfaces, exact rollback commands, and final
registry/deployment state in the checklist and GitHub release.
