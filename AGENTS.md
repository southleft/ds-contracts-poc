# AGENTS.md

## Cursor Cloud specific instructions

This is `ds-contracts-poc` ("Design System Contracts"), an npm-workspaces monorepo.
Node `>=20` is required (see `engines` in `package.json`). Standard commands live in
`package.json` scripts and `CONTRIBUTING.md`; the notes below are only the
non-obvious things.

### Environment / setup gotchas
- **npm workspaces only cover `packages/*`.** `workers/assist/` has its own
  `package.json` and is NOT installed by the root `npm install`. Run
  `npm --prefix workers/assist install` before `npm run test:worker` /
  `npm run typecheck:worker`. (The startup update script already does this.)
- **`packages/schema/dist` is gitignored and must be built.** Anything importing
  `@ds-contracts/schema` (root `npm run typecheck`, the CLI package, `extract/*`)
  fails with `Cannot find module '@ds-contracts/schema'` until you run
  `npm run prep:schema` (compiles `packages/schema` → `dist`). The startup update
  script builds it; if you re-clone or wipe `packages/schema/dist`, re-run
  `npm run prep:schema`.
- **`npm run build` is NOT required to run the apps.** The generated output it
  produces (`src/components/**`, `tokens/**` CSS, `catalog/`) is committed and
  regenerates byte-identically, so `git status` stays clean after a build. The
  dev apps read those committed files directly. Only run `npm run build` when you
  change a contract/token/generator.

### Running the apps (dev servers)
- Playground (flagship end-to-end demo): `npm run playground` → http://localhost:5181
- Dashboard ("Contract Hub"): `npm run dashboard` → http://localhost:5180
- Storybook (component gallery): `npm run storybook` → http://localhost:6006
- The dashboard's Vite config exposes dev-only POST endpoints (`/api/run`, etc.)
  that shell out to repo scripts, so it is interactive against the real engine.

### Testing / gates
- Fast local checks: `npm run lint` (oxlint), `npm run typecheck`, `npm run test:cli`,
  `npm run test:worker`, `npm run test:playground`. `CONTRIBUTING.md` §"The gates"
  is the source of truth for the full gate list and CI lanes (`npm run ci:lane fast|full`).
- **`npm run parity` is deliberately excluded from the gates and will exit 1 on a
  healthy tree** with `snapshot-stale` findings — the committed Figma snapshots
  expire by design and can only be refreshed from Figma desktop. A `snapshot-stale`
  finding is not a regression; any *other* parity finding is. See `CONTRIBUTING.md`.
