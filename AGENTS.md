# AGENTS.md

## Operating rules (owner, 2026-10-31)

These rules override anything older in this file, in `docs/`, in handoffs, or in
any agent's saved memory or notes.

1. **One goal.** [docs/GOAL.md](docs/GOAL.md) is the only work order. Everything
   else in `docs/` is history. Never edit `docs/GOAL.md`; only the owner changes it,
   in a signed entry.
2. **One folder.** Work only in `/Users/tjpitre/Sites/ds-contracts-poc`. Never
   create clones, copies or worktrees, and never copy the repository into
   `private/` for a run. Never run `git stash`.
3. **One lane.** One agent session and one open PR at a time, with the provider
   named on GOAL.md's signature line. One read-only reviewer session is allowed.
   Multi-agent runs need the owner's written approval.
4. **Every PR has a reason.** It cites a GOAL.md step, a named miss on a practice
   kit, a stop-rule item, an install failure or an outside user's report. Work on
   GOAL.md's out-of-scope list is refused.
5. **Never touch sealed kits.** Do not search for, fetch, open or study any
   candidate kit, and never read `~/ds-contracts-sealed`. Only the owner draws
   kits, or a separate sealing agent the owner asks to. No code changes between
   a draw and its run.
6. **The ruler is frozen.** From 2026-11-20, never change thresholds, scorers,
   denominators, reference images, the grammar classifier or the variant matrix
   rule. A PR that touches both the checker and the converter is reverted.
7. **Only sealed runs count.** The fixed 40-set, the 204 corpus and every
   practice kit are regression only. Never report them as progress, and never call
   a repaired sample a first pass.
8. **No overfitting.** A fix must also help a practice kit other than the one that
   motivated it and break no known cell. No component or kit names, per-set gates or
   new "-qualified" codes in conversion code.
9. **Fonts are inputs.** A missing font is refused up front by name and reported
   in its own column. It is never a pass and never a conversion failure.
10. **Deterministic only.** No model call in capture, contract, emitters, writer or
    checker. Same input, byte-identical output.
11. **Shrink, don't grow.** At most 300 net added lines per PR. The net count of
    npm scripts and CI jobs must fall. Evidence is never committed; final scoreboard
    inputs and outputs are attached to a GitHub release.
12. **Disk.** Runs reuse this checkout and the shared npm cache, delete their
    working files when the result is sealed, refuse to start with less than 50 GB
    free, and never write evidence to `/tmp`.
13. **Owner-only actions.** npm publish, tags, releases, sealed draws, deleting
    branches or folders outside the repository, and Figma writes outside the files
    the owner names. Load the Figma token only in a subshell and never print it.
14. **Verify before you claim.** Run the CI-invoked gate, read the commit and dirty
    state from the result file, and check every reported number against its
    receipt. Lead every report with what is broken.
15. **Weekly note.** [docs/STATUS.md](docs/STATUS.md), overwritten each week: five
    lines (what reached users; outside users; the four numbers per direction;
    spend against the cap; the top three named misses) and the current step's
    checklist. Read GOAL.md, then STATUS.md, before choosing work (in Claude Code,
    run `/next`). American English, plain words.

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
