# AGENTS.md

## Current product direction

Read [docs/CURRENT.md](docs/CURRENT.md) before choosing development work. It is
the active outcome-first architecture and work order, shared by the playground
and documentation site. Numbered plans and handoffs are historical context,
not competing current instructions. Preserve signed evidence and owner-only
grades; do not equate a rendering draft or a green internal gate with a complete
autonomous journey. Verify the actual checkout, source revision and PR state.

V1 targets React ↔ contracts ↔ Figma, including composed components and
two-way repair. Lit/Web Components integration is paused for planned V1.1;
preserve its implementation and evidence, but do not expand it as a V1
prerequisite. Prioritize shared conversion rules and complete user journeys
over component-specific converters. Existing regression gates remain required.

## Repository instructions

This is `ds-contracts-poc` ("Design System Contracts"), an npm-workspaces monorepo.
Use the Node version in `.nvmrc` (20.19.4, the version CI pins). `engines` in
`package.json` says `>=20`, but Vite 8.3.0 declares `^20.19.0 || >=22.12.0`. Install
with `npm ci`; `npm install` under npm 10.8.2 rewrites the tracked `package-lock.json`.
Standard commands live in `package.json` scripts and `CONTRIBUTING.md`; the notes below
are only the non-obvious things.

### Environment / setup gotchas
- **npm workspaces only cover `packages/*`.** `workers/assist/` has its own
  `package.json` and is not installed by the root `npm ci`. `npm run test:worker` and
  `npm run typecheck:worker` do not need that install: they resolve `tsx` and `tsc`
  from the root `node_modules`, and CI runs them with no separate install. Only the
  Worker's `wrangler` commands (`dev`, `deploy`) need
  `npm --prefix workers/assist install`.
- **`packages/schema/dist` is gitignored and must be built.** Anything importing
  `@ds-contracts/schema` (root `npm run typecheck`, the CLI package, `extract/*`)
  fails with `Cannot find module '@ds-contracts/schema'` until you run
  `npm run prep:schema` (compiles `packages/schema` → `dist`). The startup update
  script builds it; if you re-clone or wipe `packages/schema/dist`, re-run
  `npm run prep:schema`.
- **Playground startup needs schema and core builds.** Run `npm run prep:core`
  after `npm ci` on a fresh checkout; it builds both in order. Schema alone leaves
  Vite’s server config unable to resolve `@ds-contracts/core`. The client aliases
  in the Vite config do not cover dependencies while loading that config.
- **The gates need all four package builds on a cold tree**, in this order:
  `npm --prefix packages/schema run build`, `npm --prefix packages/core run build`,
  `npm --prefix packages/cli run build`,
  `npm --prefix packages/emitter-web-components run build`. Without them
  `npx tsc --noEmit` fails on `@ds-contracts/emitter-web-components`, the
  `paste-door-open` eval fails on the missing `packages/cli/dist/cli.js`, and
  `publish:check` refuses. `CONTRIBUTING.md` §"The gates" has the full cold-tree step.
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
  finding is not a code regression, but stale live-file evidence can still make a
  reconciliation gate red. Refresh the snapshots from Figma desktop before
  claiming a fully green lane. Any *other* parity finding is a product defect.
  See `CONTRIBUTING.md`.
