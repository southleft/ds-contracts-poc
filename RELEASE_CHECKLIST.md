# Coordinated RC release checklist

Release candidate: repository `1.0.0-rc.1` · CLI `0.5.0-rc.1` · schema
`16.1.0-rc.1` · emitter `0.4.0-rc.1`

Follow [docs/27 — Release Process](docs/27-release-process.md). Check a box only
when its evidence is linked or pasted into the release PR. Use `N/A` with an
owner-approved reason; a blank box is not an approval.

## Immutable inputs

- [ ] Release commit SHA:
- [ ] Release branch:
- [ ] Working-tree disposition:
- [ ] Node and npm versions:
- [ ] `package-lock.json` SHA-256:
- [ ] Manifest versions reviewed:
- [ ] npm registry/dist-tag query attached:
- [ ] Existing-version collision check passed:

## Clean macOS rehearsal

- [ ] `npm ci`
- [ ] `npm run ci:lanes`
- [ ] `npm run docs:check`
- [ ] `npm run test:v1-definition`
- [ ] `npm run v1:definition:check`
- [ ] `npm run ci:lane fast`
- [ ] `npm run ci:lane full`
- [ ] `npm run ci:lane catalog-visual`
- [ ] `npm run audit:production`
- [ ] Browser and font prerequisites recorded:

## Linux and GitHub evidence

- [ ] Required `fast` check green:
- [ ] Required `full` check green:
- [ ] Required `catalog-visual` check green:
- [ ] Required `security` checks green:
- [ ] macOS/Linux difference review complete:
- [ ] Security owner approval:

## Packages

- [ ] Schema build and package smoke:
- [ ] CLI build and `publish:check`:
- [ ] Emitter build and package smoke:
- [ ] Pack dry-run manifests reviewed:
- [ ] Tarball SHA-256 values attached:
- [ ] Empty-directory tarball consumer smoke:

## v1 and live evidence

- [ ] All definition-of-v1 requirement evidence attached:
- [ ] P0/P1 audit ledger has no open or waived row:
- [ ] Live Figma drift receipt linked:
- [ ] Figma owner repeated controlled edit and restoration:
- [ ] Final live Figma stamp/file state is clean:
- [ ] Migration notes reviewed:
- [ ] Worker Durable Object migration rehearsed with Node 22+:
- [ ] First Worker rollout keeps assist disabled through the UTC boundary:
- [ ] Known limitations linked:

## Deployment rehearsal

- [ ] Plugin zip built and hashed:
- [ ] Playground built and hashed:
- [ ] Spec site built and hashed:
- [ ] Pre-deploy `deploy:check` result/disposition:
- [ ] Linux/macOS artifact comparison disposition:

## Human approvals

- [ ] Exact release commit approved — owner/date:
- [ ] Signed RC tag approved — owner/date:
- [ ] GitHub prerelease approved — owner/date:
- [ ] npm schema publication approved — owner/date:
- [ ] npm emitter publication approved — owner/date:
- [ ] npm CLI publication approved — owner/date:
- [ ] npm provenance path approved — owner/date:
- [ ] If no registry attestation, exception approved and disclosed:
- [ ] Cloudflare deployment approved — owner/date:
- [ ] `v0.7.0` disposition approved:
  - [ ] signed historical tag at `cd886e97a2f45464d1b0883a2adce3efab6acdaa`; or
  - [ ] tag remains absent and GitHub release notes say so.

## Post-publication verification

- [ ] Schema exact RC exists and `next` resolves to it:
- [ ] Emitter exact RC exists and `next` resolves to it:
- [ ] CLI exact RC exists and `next` resolves to it:
- [ ] Schema `latest` still resolves to stable:
- [ ] Emitter `latest` still resolves to stable:
- [ ] CLI `latest` still resolves to stable:
- [ ] Registry integrity and attestation status recorded:
- [ ] Second clean registry install smoke:
- [ ] Signed tag verified:
- [ ] GitHub release is marked prerelease and links evidence:
- [ ] Deployment completed:
- [ ] Post-deploy `npm run deploy:check` green:
- [ ] Manually dispatched deploy check green on release commit:

## Rollback readiness

- [ ] Last approved npm dist-tags recorded:
- [ ] Last approved deploy commit recorded:
- [ ] Prior approved Figma bundle identified:
- [ ] Deprecation/withdrawal wording prepared:
- [ ] Release owner closed or invoked rollback:

Final decision: [ ] release approved · [ ] release blocked · [ ] release rolled
back

Decision owner/date:

Remaining conditions:
