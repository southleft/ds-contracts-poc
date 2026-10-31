# Goal: prove the contract both ways on kits nobody tuned for

**Status:** signed by the owner.
Signed: TJ Pitre (approved in a Claude Code session). Date: 2026-10-31. AI provider for this time box: Claude Code.

Once signed, this page is the only work order until 2026-12-23. It replaces the
Beta 1 goal of 2026-09-28 and `docs/GOAL-BRIDGE.md` of 2026-09-29. Everything else
in `docs/` (CURRENT.md, HANDOFF files, numbered plans, TOPIC-8NN notes) is history.
Agents follow `AGENTS.md`. The one working folder is
`/Users/tjpitre/Sites/ds-contracts-poc`.

Agents working on this project, Claude included, described known-cohort results as
proof that the idea works. That was wrong. On kits nobody had tuned for, Figma to
React passed about 13% of variants (2026-10-31 audit), and React to Figma had never
been measured. That is why this page measures only on kits drawn after a freeze.

## North Star (unchanged)

A deterministic transition between Figma and code in both directions: Figma
component sets become React components, and React components become native,
editable Figma component sets with variants and variables. Both go through a JSON
contract, on real design systems nobody tuned for. The same input always gives the
same output. AI is never part of the conversion.

## The bar for this time box

At least **80% first pass in both directions** on the **in-grammar** component sets
of **sealed kits**, with at least **25% of each kit's component sets in-grammar**.
The checks never change: at most 5% image difference on white and on black, every
text and icon present, size within 2 px, matching text color and font.

80% on any community kit with no setup stays the long-term North Star. Nobody
claims it during this time box.

## The grammar (ACG-1)

What the contract must carry exactly, both ways: auto-layout rows and columns (no
grid, no absolutely placed children); gap and padding; hug, fill or fixed sizes;
solid fills and one stroke; corner radius, drop shadows and opacity; text in a
supplied font with fixed size, weight, line height and letter spacing; variant
options and true/false properties; show/hide toggles and text properties; icons and
vectors as SVG; instance swaps only to in-grammar components; interactive states
only when the Figma set draws them as variants. On the code side, the same facts
come from Storybook stories whose arguments are option lists, true/false values or
text. Context supplied by Storybook decorators (theme providers) is allowed.

Anything outside the grammar is refused once, by name, before work starts. The
grammar only widens, through a numbered decision the owner signs, and never between
a draw and its run.

## Three steps

**Step 1. Lock and measure (Nov 2 to Nov 6). Costs almost nothing.**
- Get Figma's written go-ahead for the project and settle the IP position under
  the owner's Figma employment. Until it is in hand, nothing is published.
- Stop every other agent session. End the Codex bridge goal before it resumes on
  2026-11-04. Close PR #286: it is 23,725 lines, too big to review, and its
  benchmark check is red. Its branch stays on GitHub.
- Classify the existing never-seen results (1,344 Figma to React variants from
  Semi, Arco, CollegeTown and Orbit) by cause (font missing, image framing,
  refused before measurement, real conversion miss) and against the grammar.
  Publish in-grammar coverage, the in-grammar pass rate and the top named misses.
- Run today's engine once, unchanged, on kit **A0**: one fresh Figma kit and one
  fresh React library, both directions. This is the first React to Figma reading
  on a library nobody tuned for.

**Decision 1 (2026-11-09, the existing checkpoint).** With those numbers, the owner
chooses one: continue to Step 2; move the engine into Figma Console MCP as a thin
adapter; or hand the ideas to Figma and archive. Zero outside users today means
continuing is a deliberate reset, recorded below with this budget.

**Step 2. Fix the ruler, then climb (Nov 9 to Dec 11).**
- Fonts are inputs: a font preflight refuses missing fonts by name, in their own
  column.
- New Figma captures and reference images come from the Figma plugin: a PNG per
  variant at whole-pixel bounds on a draft the owner duplicated, SVG for icons and
  vectors, the font list, and variables on any plan. Existing REST dumps stay as a
  frozen input format; no new REST parity work.
- The code side reads Storybook arguments, renders with the package's own fonts in
  pinned Chromium, and writes `ds-contracts.react.json` itself. The React version
  pin widens to a tested 18.3 and 19.x range.
- On **2026-11-20**, freeze the checker, the grammar classifier and the variant
  matrix rule by SHA-256. Then the owner draws **A1** and it runs once.
- Climb on practice kits only, one named miss class at a time, with shared rules:
  carry each variant's observed values (a full default plus per-variant
  differences) instead of refusing them.
- On **2026-12-04** the owner draws **A2** for a fresh progress reading.
- If the owner's Figma go-ahead is in hand, publish the CLI to npm under `next`.

**Step 3. Freeze, unseal, decide (Dec 14 to Dec 23).** Code is tagged on Dec 11.
On Dec 14 the owner draws **B** (3 Figma kits and 3 React libraries). Each runs once
on the frozen code. The scoreboard is published with every miss named and attached
to a GitHub release.

## How numbers are counted

- **Headline:** the mean of per-set pass rates, every component set weighted
  equally. Whole sets passing and the raw per-variant rate appear beside it.
- **Four numbers per direction, always together:** coverage (in-grammar sets as a
  share of the kit), in-grammar first pass (the headline), raw first pass (every
  variant, refusals counted as failures), and font-blocked variants (never passes).
- **Failures:** "unverified" results and any refusal of an in-grammar variant count
  as failures.
- **Separate columns:** icon-only and glyph-only sets; a **declared** column for
  kits run with a conventions file of 20 lines or less that a person wrote from the
  kit alone before the run; after Dec 23, an **assisted** column for AI-drafted
  inputs. Neither ever adds to first pass.
- **React to Figma** counts only a real component set: variant properties match
  the story's options (the cartesian product of enumerated arguments, capped at 64
  variants per set), auto layout, editable text. The share of colors bound to
  variables is reported.
- **Not progress:** the fixed 40-set, the 204 corpus, Semi, Arco, CollegeTown,
  Orbit, Radix and shadcn cohorts (practice and regression only), repaired samples,
  green internal gates, and anything CI cannot replay.

## Sealed kits

The owner compiles the candidate list (about 20 Figma kits and 20 React libraries
with open fonts and public Storybooks, none in any repo corpus) and picks 7 per
side: A0, A1, A2, three for B, and one reserve. Commit only SHA-256(salt + sorted
list) and SHA-256(salt + picks), with a 32-byte salt kept offline. A kit is drawn
only after the freeze it is judged under. Agents never search for, open or study a
candidate.

## Stop rules (binding)

1. **Nov 20.** If grammar coverage on A1 is under 20% of sets in either direction,
   the owner chooses between stopping and publishing the grammar as file
   requirements. The grammar is never narrowed to raise a number.
2. **Dec 4.** If the A2 headline is under 40% in either direction, climbing stops
   and the numbers are published.
3. **Dec 23, on B.** At least 80% both ways with coverage at least 25%: continue,
   widening the grammar one decision at a time, each proven on a fresh sealed pair.
   60 to 79% both ways with coverage at least 20%: one extension, Jan 4 to Jan 22,
   2027, capped at $900 and judged on the reserve kit. Anything else: this approach
   does not reach the North Star. Publish, stop engine work, set no new finish line.
4. **Users are a separate outcome.** A score failure stops engine work. A score
   pass with no outside user keeps the published library, and the owner decides.
5. **Spend.** $2,400 of AI spend through Dec 23. Any week over $400 pauses work
   until the owner approves. Multi-agent runs need the owner's written approval and
   count against the cap.
6. **Discipline.** Revert any change that raises one practice kit but fails another.
   Revert any change to the checker or thresholds after Nov 20. If the repository
   grew in a week, shrink it before continuing.

## Definitions

- **First pass:** the first run after the draw, on frozen code, with no per-kit
  configuration and no edits.
- **Outside user:** someone not at Southleft. Figma affiliation is reported
  separately.
- **Completed journey:** a named journey finished from the published quickstart,
  with its output attached to a GitHub issue.

## Out of scope until the owner signs a new entry

Lit/Web Components, Recipe-IR, playground, dashboard, docs-site and Storybook
features, census work, new benchmark cells, new update channels, the edit catalog,
Console MCP integration, per-set "qualified" gates in `core/propose-figma.ts`,
token pipelines, breadth work on Figma to spec, new plan documents, and committed
evidence.

## Lessons taken from Spectacular (ideas, not code)

Spectacular (spectacular.systems, by Nathan Curtis) succeeds by solving a smaller
problem and shipping weekly. Borrowed ideas, in our own words and code: declare
library conventions instead of inferring them (the declared column); one reader
for all inputs (the plugin); variants as a full default plus differences; clear
written, incomplete and failed outcomes; numbered decision records for grammar or
schema changes; small, frequent releases. It publishes no accuracy rates, has no
reader for React code, and its render to Figma replaces components rather than
editing them. Deterministic React to editable, variable-bound Figma component sets
that update in place is the gap this project exists to fill.

## Budget and reporting

- AI spend: $2,400 through Dec 23, metered from the provider's usage page and
  pasted into the weekly note.
- CI: 15 minutes or less of waiting on a PR's critical path; the full regression
  set runs nightly. Red scheduled workflows are fixed or deleted.
- Owner time: about 4 to 6 hours a week: sign, compile and draw kits, run plugin
  captures on drafts, publish once cleared, recruit testers.
- One five-line weekly note, leading with what is broken: what reached users,
  outside users, the four numbers per direction, spend against the cap, the top
  three named misses.

## Changing this page

Only the owner changes this page, in a dated, signed entry appended below.
Thresholds, the checker and the stop rules are never loosened. Changing the AI
provider never changes this page.

## Signed entries

### 2026-10-31: the sealed pool is compiled by a separate sealing agent

The owner delegated compiling the candidate list and drawing the kits, in chat:
"just search the web and find the 20 that you think are best". A separate sealing
agent compiled the pool, checked every candidate against the kits this project
had already used, and drew the slots. The full list and the salt are in
`~/ds-contracts-sealed`, outside the repository. The agent working in this
repository never reads that folder, and it received only these hashes and kit A0.

- Pool: 22 React libraries and 20 Figma kits, all with open fonts. There are
  7 picks per side, in slots A0, A1, A2, B1, B2, B3 and R.
- SHA-256(salt + sorted eligible ids): `d5c50da1465d3412d56c33147329ac2d7691aa0251acbfbe2edbd299ca92294c`
- SHA-256(salt + picks): `52a5ba31c56b5d8d8dc35274c71e98debaf34005521578334e9184d69f54eb30`
- A0, revealed now on purpose: the Figma kit Sanity UI v2 (the owner's draft copy,
  file `gjBNQEgO5YWvl2G9BPHJQ4`), and the React library Agriculture Design System
  (`@ag.ds-next/react`).
- Every Figma pick is a Community file. The owner duplicates each one into drafts
  when it is drawn.

Signed: TJ Pitre (approved in chat). Date: 2026-10-31.
