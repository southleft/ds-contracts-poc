# Goal: prove the bidirectional contract (canvas ↔ code)

Owner decision, 2026-09-29. This extends [docs/GOAL.md](GOAL.md) (Beta 1).
Current state, evidence and every rule are in
[docs/HANDOFF-2026-09-29.md](HANDOFF-2026-09-29.md); read it first.

## The thesis

A contract carries a component both ways, Figma canvas → code and code →
Figma canvas, on real design systems nobody tuned for. Both directions are
required. Do not narrow the thesis to one direction.

## Finish line

First-pass success of **at least 80% on never-seen kits in both directions**,
measured by the real-design-systems scoreboards with unchanged thresholds (5%
image difference on white and black, every text and icon present, size within
2 px, text color and font matching) and every miss named.

Today (Milestone M1): Figma → React passes 55 of 879 variants (6.3%) on the
fixed 40-set test set. React → Figma has no scoreboard yet.

Milestones to report: **M2** 25% of variants on the 40-set test set, **M3**
50%, then the full 204-set sample, then 80% on both scoreboards.

## Work order

1. Land the finished work: the checker fixes (`claude/beta-measure`), then
   the npx CLI (`claude/beta-cli`), then the spike (`claude/spike-combined`)
   once its Chakra Progress regression and `sync:ledger:check` are fixed.
2. Re-run the full Figma → React scoreboard with kit fonts.
3. Build the React → Figma scoreboard on real open React libraries (shadcn/ui,
   Radix Themes and others), created in the owner's live-testing file and read
   back.
4. **Explore before climbing further** (report a recommendation to the owner,
   with evidence, before committing to a direction):
   - **Existing Figma technology.** Figma Code Connect (component → code
     import and prop mapping), the Figma MCP server's design context and Code
     Connect map, and Dev Mode. What can they supply that our importer drops or
     cannot know? The repo already has Code Connect support
     (`npm run code-connect:check`, `core/code-connect-check.ts`); start there.
   - **A component manifest.** A persistent inventory of components already
     generated or already in the codebase (name, Figma key, import path,
     props), kept by the plugin or the CLI, so that generating a Banner imports
     the existing Button and Header instead of re-creating stubs. Our contracts
     already carry `code.anchors` and `figma.anchors`; Code Connect files are a
     possible source. Every generation is judged against the manifest.
   - **Where AI fits.** The owner set a determinism rule in July (no AI filling
     gaps in conversion) and now expects AI may be needed for Figma → code.
     Evaluate a bounded role: AI proposes at authoring time, the result is frozen
     into the contract and manifest, every later run is deterministic, and the
     scoreboard judges it with the same thresholds. The owner decides.
   - **Nathan Curtis's Specs** (specsplugin.com). Its Figma → spec extraction is
     the direction we are weakest in. Compare what it captures against what our
     importer drops on the same kits. Its schema is CC BY 4.0 and its 61 public
     ADRs are an edge-case corpus; its extraction engine is closed, so learn from
     the published material only and do not copy closed code. The owner decided
     in July not to merge the projects.
5. Climb the root causes (handoff §1) in order of sets affected, measuring
   every fix on the 40-set test set before and after.

## Rules

All of handoff §6 applies. In short: never run `git stash`; load the Figma
token only in a subshell and never print it; write only to the three Figma
files named there; npm publish, tags and releases are the owner's; never
loosen a threshold or change a scorer to move a number; run
`npm run ci:lane -- fast` before every push; at most two parallel lanes unless
the owner raises it; American English.

## Reporting

Five lines each time: what landed, both scoreboard numbers, the top three
blockers, anything waiting on the owner, what's next.
