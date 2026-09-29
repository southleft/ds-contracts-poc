# Beta 1: real Figma files and real codebases

**Owner-approved 2026-09-28. This page is the active goal.** It replaces the
six V1 acceptance criteria as the thing agents work toward. Only the owner
changes it, in writing. `docs/CURRENT.md` and the benchmark stay as regression
records; they are no longer targets.

## The goal

Anyone can use Design System Contracts on **their own Figma file and their own
React codebase**, and gets truthful output:

- **Figma → React.** `npx @ds-contracts/cli figma-to-react --url <component set link>`
  turns a component set from any Figma file the user can open into React
  (TSX, CSS Modules, tokens, Storybook stories) or an installable package.
- **React → Figma.** A user points the local app at their React workspace and
  the Sync Runner plugin at a Figma file they choose, and gets native,
  editable component sets.
- **Truthful.** No command prints success when its own check fails. Missing
  text, icons or parts fail the check. Everything the tool cannot carry is
  refused or listed by name.

## How we measure progress

1. **Beta smoke gate** (CI, Linux and macOS): packs the CLI into an empty
   directory, runs `figma-to-react` on a frozen dump and matches the pin,
   installs and builds the result in a clean Vite app, prepares a native plan
   for a Figma file that is not Southleft's, and builds the plugin zip.
2. **Real design systems scoreboard.** Whole real systems, not hand-picked
   cells. For each system, the share of component sets that come out correct
   (content check plus the 5% image limit on white and black), with every miss
   named. Figma side: Altitude, CBDS, and public community kits the owner
   duplicates into drafts. Code side: shadcn/ui, Radix Themes and other open
   React libraries. This is the number we hill-climb after launch.
3. **Outside users:** people outside Southleft who completed a journey on their
   own file or code and reported back.

## Beta 1 is done when

- The smoke gate is green at a tagged commit.
- A fresh agent runs the quickstart verbatim, from an empty directory.
- One live React → Figma run succeeds in a Figma file that is not Scratch or
  Evaluations.
- The real design systems scoreboard is published with its misses.
- The owner has published the release (npm, tag, plugin zip) after confirming
  Figma's go-ahead to publish.

Target launch: **2026-10-12**. Checkpoint: **2026-11-09**. Keep the standalone
tool if at least 3 people outside Southleft completed a journey; otherwise move
the engine into Figma Console MCP or hand the ideas to Figma and archive.

## Work order

1. **Truth before breadth:** escape emitted strings, add the content check to
   `design:consumer:check`, make `figma-to-react` run it and print per-variant
   results, stop leaking the repo's demo tokens into generated packages.
2. **Your file, your code:** a user-chosen Figma target replaces the two
   hard-coded files; the plugin accepts bundles from the published CLI; the
   supported React versions widen; a scaffolder drafts `ds-contracts.react.json`.
3. **One command:** `figma-to-react` in the published CLI, with core bundled.
4. **Front door:** a one-page quickstart linked first from the README, a
   known-limits page, the plugin zip attached to each release.
5. **Real design systems:** run the scoreboard, fix the misses that affect the
   most component sets first.

## Frozen until the owner says otherwise

- New V1 criteria, benchmark cells, update channels (sizes, strokes,
  backgrounds, text color), recovery proofs, Recipe-IR lineages, census work
  and new plan documents.
- New evidence types. Evidence counts only if CI can replay it.

## How agents work

- At most two lanes, one PR each, plus one coordinating session. No parallel
  Claude or Codex sessions on this repository.
- Every task cites a smoke-gate failure, a blocker from the cold-start test,
  a real-design-system miss, or an outside user's report.
- Agents merge when the fast lane and the smoke gate are green, delete the
  worktree on merge, and check free disk space before starting a lane.
- One weekly five-line note to the owner: what reached users, outside users,
  smoke gate, top three defects, real design systems score.
- American English everywhere.
