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

### 2026-10-31: Figma's go-ahead is not needed

The owner, in chat: their employment agreement with Figma, negotiated when Figma
hired them, allows projects like this one and lets them keep all of their IP. Figma
knows about the project and supports it. So Step 1's item "Get Figma's written
go-ahead and settle the IP position" is closed with nothing to obtain, and "Until it
is in hand, nothing is published" no longer applies. Step 2's release to npm under
`next` waits only on the owner running it (AGENTS.md rule 13). Agents do not raise
Figma permission or IP again.

Signed: TJ Pitre (approved in chat). Date: 2026-10-31.

### 2026-10-31: Decision 1, continue to Step 2 now

The owner, in chat, after reading Step 1's numbers (A0: Figma to React headline
8.8%, raw 8 of 287 variants, 1 of 18 sets whole; React to Figma 0 of 127; the
earlier 1,344 variants classified by cause and against the grammar): continue to
Step 2. The decision is taken early, on 2026-10-31 instead of 2026-11-09, so Step 2
starts now. This is the deliberate reset this page describes: zero outside users and
$2,400 of AI spend through 2026-12-23. Every other date and every stop rule is
unchanged. The checker, the grammar classifier and the variant matrix rule freeze on
2026-11-20 and A1 is drawn after that freeze. A2 is drawn on 2026-12-04, code is
tagged on 2026-12-11, and B is drawn on 2026-12-14. No decision model is added
before 2026-12-23.

Signed: TJ Pitre (approved in chat). Date: 2026-10-31.

### 2026-11-01: Variants shown as separate stories count

The owner, in chat: when a library shows a component's variants as separate
stories, each story is one variant. The set's variant properties are the arguments
whose values differ across that component's stories, and the expected Figma set is
exactly those stories, with no combinations added, capped at 64 variants per set.
Option lists in a story's controls still form axes as before. This widens the React
to Figma counting rule ("the cartesian product of enumerated arguments") and freezes
with the variant matrix rule on 2026-11-20.

Signed: TJ Pitre (approved in chat). Date: 2026-11-01.

### 2026-11-08: A component with no options counts as one Figma component

The owner, in chat: "Yes, count it", to the question "Should a component with no
options count when it's written as one plain Figma component?" Figma always gives a
component set at least one variant property. A component whose stories list no
options (the variant matrix rule gives one variant with no properties) could
therefore never count as a real component set. That was 26 of A0's 62 in-grammar
components. Such a component now counts when it is written as one main component
outside any set, with no variant properties. A component set written for it still
fails, by name. Auto layout, editable text and every variant check are unchanged.
This widens React to Figma's counting rule ("counts only a real component set") and
freezes with the variant matrix rule on 2026-11-20.

Signed: TJ Pitre (approved in chat). Date: 2026-11-08.

### 2026-11-08: Paid work stops after the no-option fix

The owner, in chat: "Stop after the fix", choosing between stopping paid work after
the no-option fix and testing a Figma to React only version. The capped A0 AI test
(practice kit, decision input only, $39.67) found React to Figma at 27.3% after three
rounds with AI and the contract, under the 40% line set before the test, so the
approach is not worth funding as defined. Once the PR that carries this entry
merges, agents start no new work on this plan: no converter or checker changes, no
freeze, no draws and no sealed runs. The Step 2 checklist is on hold. Work resumes
only on a new signed entry. Owner-only actions are unchanged.

Signed: TJ Pitre (approved in chat). Date: 2026-11-08.

### 2026-11-08: The climb resumes

The owner, in chat, after the no-option fix merged (PR #340): "I left caffeinate on
because I wanted my laptop to not go to sleep, so that way you can continue
hillclimbing on this project, which is what I would still like to continue doing."
The hold in "Paid work stops after the no-option fix" ends. The Step 2 checklist is
back in force as written: the React to Figma check merges by 2026-11-18; the
checker, the grammar classifier and the variant matrix rule freeze on 2026-11-20; A1
is drawn after that freeze; A2 is drawn on 2026-12-04 under stop rule 2; code is
tagged on 2026-12-11; and B is drawn on 2026-12-14. The conversion stays
deterministic, and AI is never part of it. The capped A0 AI test was decision input
on a practice kit and changes nothing on this page. Every other rule, date and stop
rule is unchanged, and spend counts against the same $2,400 cap.

Signed: TJ Pitre (approved in chat). Date: 2026-11-08.

### 2026-11-09: One design system at a time

The owner, in chat: "Yeah, I think we should stop hill climbing on the current plan and
pivot." The engine stops trying to convert any design system with no setup. It now converts
one named design system at a time, and the system's own knowledge is written down, not
guessed. The reason is in this page's own numbers: on kits the engine has been tuned on,
662 of 944 Figma to React variants pass today (about 70%). On A0, which it had never seen,
the unchanged engine passed 13.3% one way and converted nothing the other way.
Generalizing has been the hard part, not converting.

**From today, this entry replaces** the bar, the three steps, "Sealed kits", stop rules 1
to 3, and the definition of first pass above. The North Star stays as the long-term aim,
measured but no longer the bar. **Unchanged:** the grammar (ACG-1), the checks and their
thresholds, how numbers are counted (four numbers per direction), determinism, the $2,400
spend cap with its $400 weekly limit, budget and reporting, and the owner-only actions.

**One engine, one profile per system.**
- A profile is a versioned data file, checked against a schema, kept in the system's
  folder under `examples/`. It holds only what is specific to that system:
  - component, property and value names on each side;
  - token maps (Figma variables to CSS custom properties);
  - fonts, and how the stories are set up (decorators, themes);
  - which named conventions are on, chosen from a list the engine implements (for
    example, Figma's text trim to cap height).
- It grows from what the repository already has: each library's `ds-library.json`
  manifest and its capture config in `extract/computed/configs/`.
- Engine code never names a system or a component. A system-specific behavior lives
  in the engine as a general rule that a profile switches on.
- A run on a system writes that system's contracts. They are not expected to work for
  any other system.
- No model call in capture, contract, emitters, writer or checker. Same input and
  profile, byte-identical output.
- A person writes and reviews each profile, and commits it before any run that counts.
  If AI helps draft one, that is labeled, and AI never runs in a conversion.

**The honest test, inside the system.** Agents on this project once reported tuned results
as proof that the idea works. This entry must not repeat that.
- Before any tuning, the owner draws a held-out third of the system's in-grammar
  component sets in each direction. The draw comes only from components no prior work
  in this repository has touched: none in `examples/<system>/contracts`, and none in a
  practice cell. The owner may ask a separate sealing session to make the draw.
- The tuning list is committed. The held-out list stays outside the repository, and
  only SHA-256(salt + held-out list) is committed.
- Agents work only on components in the tuning list. They never run, check or study
  any other component of the system, and the profile may not name one, until the
  reading.
- Climbing happens only on the other two-thirds. Those numbers are labeled "tuned"
  and are never progress.
- **The reading:** once, on code the owner has tagged, on the held-out sets, both ways,
  with the same checks and the four numbers.

**Bar:** at least 80% first pass in both directions on the system's held-out in-grammar
sets, with at least 25% of the system's sets in-grammar. Users stay a separate outcome:
one outside user on that system completes a journey from the published quickstart, with
the output attached to a GitHub issue.

**Plan:**
- **Step 0 (Nov 9–10).** The universal climb stops.
  - The Figma snapshot refresh lands, so main stays green.
  - Two checker fixes found on the old plan apply to any system, and both land before
    Nov 20 under rule 6: a form field's box holding its text, and the grammar check
    refusing out-of-grammar components (14 A0 sets).
  - The A1, A2 and B draws are cancelled. `~/ds-contracts-sealed` stays sealed and
    unread, kept for a later North Star reading.
- **Step 1 (Nov 10–14). The first system is Carbon** (owner, in chat: "Approve, with
  Carbon").
  - Pin `@carbon/react` to a version, along with its public Storybook and the Carbon
    Figma kit (the owner's draft copy).
  - Inventory both sides and run the grammar classifier on both, with no conversion
    attempts. The ten components in `examples/carbon/contracts` (Accordion, Button,
    Checkbox, IconButton, InlineNotification, Modal, Tabs, Tag, TextInput, Toggle),
    and every Carbon set in a practice cell, count as touched. They go in the tuning
    list.
  - The owner draws the held-out third and commits its hash.
  - Write profile v0 and its schema from the system's existing manifest and config.
  - Take a tuned baseline reading with the unchanged engine.
- **Nov 20.** The checker, the grammar classifier and the variant matrix rule freeze by
  SHA-256, as before.
- **Step 2 (Nov 15 – Dec 4). Climb on the tuning sets.**
  - One named miss per PR, at most 300 net lines.
  - A profile change is data and is reviewed like code.
  - An engine rule that a profile switches on needs no second kit.
  - An engine change that applies to every system must still break no known cell on
    the regression set (the fixed 40-set, the 204 corpus, the practice kits and this
    repository's own components).
- **Dec 4.** The owner tags the code.
- **Dec 7. The held-out reading**, once.
- **Step 3 (Dec 7–21).** The owner publishes the CLI to npm under `next`, and an
  outside user on that system tries it.
- **Dec 23. Decide:**
  - The bar is met both ways: go on to a second system, with a new profile and a new
    held-out draw.
  - 60 to 79% both ways: one extension, Jan 4 to Jan 22, 2027, capped at $900.
  - Under 40% in either direction at the reading: stop engine work and publish the
    numbers.

**AGENTS.md follows this entry**, in the same PR:
- **Rule 5:** the held-out list replaces the sealed kits, under the same never-read rule.
- **Rule 7:** only the held-out reading counts.
- **Rule 8:** system knowledge goes in the profile, or in a general engine rule that a
  profile switches on. An engine default that applies to every system still needs a
  second kit. There are still no system or component names in conversion code.

Every other rule is unchanged.

Signed: TJ Pitre (approved in chat). Date: 2026-11-09.

### 2026-11-09: Grammar decision 1, an argument no story changes makes no variant

The owner, in chat: "Sign all four". On the code side, an argument whose type is outside
the grammar (an object, function, number, range or unknown type) no longer puts its
component outside the grammar, as long as no story of that component gives it a different
value. The component is drawn with the value its stories use, and every variant is judged
as before. An argument that any story varies still refuses the component, by name. On
Carbon 1.120.0, this puts 111 of 132 story titles in grammar instead of 38. It widens
ACG-1 and freezes with the grammar classifier on 2026-11-20.

Signed: TJ Pitre (approved in chat). Date: 2026-11-09.

### 2026-11-09: Grammar decision 2, a part pinned inside a row or column is in grammar

The owner, in chat: "Sign all four". A child placed absolutely inside a parent laid out in
a row or a column is now in grammar on both sides:
- **in Figma,** a child with absolute positioning inside an auto layout frame;
- **in code,** an absolutely positioned element whose containing block is laid out in a
  row or a column.

Its place is carried as offsets from the parent's edges. A hidden pinned layer is an
ordinary part, and a show/hide toggle on it is carried. Grid, wrapping rows, and
absolutely placed children of a free-form parent stay outside the grammar. "No absolutely
placed children" in ACG-1 now reads "no absolutely placed children, except a part pinned
inside a row or a column".

Two things follow from this decision. Step 0's classifier fix shrinks to refusing grid and
wrapping layouts. The step that turns Figma's data into the classifier's input must mark
every absolutely placed child; today it misses some, such as TextInput's background and
borders on Carbon. Both land before Nov 20. This decision freezes with the grammar
classifier on 2026-11-20.

Signed: TJ Pitre (approved in chat). Date: 2026-11-09.

### 2026-11-09: Grammar decision 3, at most 128 variants per set

The owner, in chat: "Sign all four". The cap on variants per component set rises from 64 to
128, in "How numbers are counted" and in the variant matrix rule (including the entry of
2026-11-01). On Carbon, this brings in Button (84 variants), PasswordInput (96) and the
feature-flag FileUploader (108). It freezes with the variant matrix rule on 2026-11-20.

Signed: TJ Pitre (approved in chat). Date: 2026-11-09.

### 2026-11-09: Grammar decision 4, a profile may say which stories make a component and which options are real

The owner, in chat: "Sign all four". A system's profile may assign stories to components,
for example when one story title holds several components, as Carbon's Tag holds Tag,
DismissibleTag, OperationalTag, SelectableTag and a skeleton. It may also list a
component's variant axes, leaving out a playground control that isn't a component
property, such as Modal's `numberOfButtons`. The variant matrix rule then reads that
declaration instead of guessing from the stories' controls.

A declaration may only select stories and axes the stories already have. It never adds a
value that no story renders. For every component of the system, these declarations are
written from the stories alone, before the held-out draw, with nothing converted. They are
fixed at the draw. Afterward, only tuning-list components' declarations may change. This
is the one exception to the pivot entry's rule that the profile may not name a held-out
component before the reading. This
decision changes the variant matrix rule and freezes with it on 2026-11-20.

Signed: TJ Pitre (approved in chat). Date: 2026-11-09.
