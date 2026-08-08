# Pilot runbook — unaided persona acceptance (Wave 4 exit)

For the two pilots who **did not build this tool**: one designer, one
engineer. You run the numbered commands and clicks exactly as written, note
what you see, and sign the verdict. You are the measurement — if a step
confuses you, that confusion is a finding, not your failure.

Verdicts are recorded in
[`.agents/runs/exact-conversion-finish-wave4/PILOT-ACCEPTANCE.md`](../exact-conversion-finish-wave4/PILOT-ACCEPTANCE.md)
(the per-journey tables and the sign-off table at the bottom). Keep this file
open beside it and fill the tally sheet below as you go.

## Budgets (what "pass" means, from the plan)

| # | Budget | How it is measured |
|---|---|---|
| B1 | First supported component in **< 30 minutes** | Timer from setup step D1-1 / E1-1 to first success criterion |
| B2 | **≤ 1 documentation lookup** | Tally every time you open a doc/README beyond this runbook |
| B3 | **No unexplained refusal** | Every refusal/error you hit must name its cause; log any that don't |
| B4 | **No mutation before confirmation** | Nothing writes to your file/repo/canvas before an explicit review or `--apply`/Apply step |
| B5 | **Resumable recovery** | After a mid-run failure, resuming must not repeat expensive successful stages |

## Tally sheet (fill during the run)

| Journey | Start time | End time | Doc lookups (list) | Refusals seen (named? y/n) | Mutations before confirm? | Pass? |
|---|---|---|---|---|---|---|
| D1 | | | | | | |
| D2 | | | | | | |
| D3 | | | | | | |
| D4 | | | | | | |
| E1 | | | | | | |
| E2 | | | | | | |
| E3 | | | | | | |
| E4 | | | | | | |

---

## Shared setup (both personas, ~10 min, done before the timer starts)

Prereqs: Node 20+, git, and (designer) the Figma desktop app with a file you
can run development plugins in.

```bash
git clone https://github.com/southleft/ds-contracts-poc.git
cd ds-contracts-poc
npm ci
```

Define the CLI shorthand used everywhere below (run from the repo root):

```bash
alias dsc="npx tsx packages/cli/src/cli.ts"
dsc --help   # expected: command reference printing onboard / extract / generate / figma / diff / propose-pr
```

**Designer extra setup — install the plugin (one-time):**

1. Build the plugin bundle: `npm run plugin:zip` (also refreshes the unpacked
   `figma-sync/plugin-dist/` folder).
2. In Figma desktop: Menu → Plugins → Development → *Import plugin from
   manifest…* → pick `figma-sync/plugin-dist/manifest.json`.
   (Reference if stuck: `figma-sync/plugin/GET-STARTED.md` — opening it counts
   as your one doc lookup.)
3. Create a **new blank Figma file** for the pilot. Do not use a real file.

---

## Designer journeys

### D1 — Code→Figma: first component from a bundle paste

*Start the B1 timer now.*

1. In the blank Figma file, run the **DS Contracts** plugin (Plugins →
   Development → DS Contracts).
2. Open the **Build** tab.
3. On your machine, open `examples/mui/figma/mui.bundle.json`, select all,
   copy. (This is MUI's default theme packaged as one contracts bundle — the
   JSON is the only thing you ever paste.)
4. Paste into the Build tab's paste box → click **Generate in this file**.

**Expected output:** in ~30 seconds, one variable collection (Light/Dark
modes, ~982 variables, 61 Figma-native aliases) and **5 component sets / 121
variants**, each set on its own labeled section/page. Inspect any fill —
it should be **bound to a variable**, not a raw hex.
**Success criterion (stop B1 timer):** a component set exists with variants
matching prop axes and at least one fill/radius/spacing bound to a variable.
5. Paste the same bundle and click **Generate in this file** again.
   **Expected:** the library **amends in place** — same node ids, no
   duplicated sets (B4/B5: re-run is not a second copy).

### D2 — Figma→code proposal: Send to repo, review before write

1. Engineer (or you, in a terminal at the repo root):
   `dsc figma receive --out contracts`
   **Expected:** it prints a **6-character pairing code** and waits. It writes
   nothing yet.
2. In the plugin: **Send** tab → **Send to repo** → enter the pairing code.
   Pick the component you generated in D1 (or any contract-backed set),
   optionally nudge a value first (e.g. change a padding in one variant).
3. Watch the terminal.
   **Expected:** the proposal arrives as a **unified diff printed in the
   terminal** plus a saved artifact under `contracts/.proposals/`. The actual
   contract file is **unchanged** (`git status` shows no modified
   `contracts/*.contract.json`) — nothing lands without `--apply` (B4).
4. Do **not** re-run with `--apply` unless you want to see the apply half; if
   you do, expected: the contract updates **and** it either generates the
   component code named in `ds-contracts.config.json`'s `generate` section or
   says no target is recorded and writes no code rather than guessing.

### D3 — Concurrent edit: drift warning and held Apply

1. In the D1 file, hand-edit **one variant** of the generated set: select a
   single variant, change its fill to any obviously wrong color. You are now
   the "designer who edited the canvas after generation".
2. Re-open the plugin → **Changes** tab (drift). 
   **Expected:** the edited set is flagged, and the per-variant view names
   **which variant** changed (click-to-zoom), not just "Button was edited".
3. Attempt an update: paste the same D1 bundle in **Build** → Generate (or use
   the Update path in Changes).
   **Expected:** an explicit **overwrite warning** naming your canvas edit,
   with the Apply/overwrite checkbox **default-unchecked** — applying without
   reading requires you to actively check the box (B4).
   *Named gap, not a failure:* a full three-way merge **UI** does not exist
   yet (engine only — docs/23 §B.13, G3 PARTIAL). Warn-and-hold is the
   contracted behavior.

### D4 — Recovery: missing browser / unreviewed config / stale delivery

Three failure shapes; each must fail **by name** and resume without redoing
finished work (B3/B5).

1. **Unreviewed capture config:** at the repo root run
   `dsc onboard --continue` inside a workspace whose capture config still
   carries `__review:*` markers (any fresh `onboard <pkg>` output — see E1
   step 1 if none exists yet).
   **Expected:** a refusal that says the config is unreviewed and **which
   markers** need a human decision. There is no flag that skips this gate.
2. **Missing Chromium:** `dsc extract --computed --config <capture.json>`
   without Playwright browsers installed.
   **Expected:** a named degradation/refusal telling you what to install
   (playwright-core Chromium) — not a stack trace, not silent success.
3. **Stale delivery:** in the plugin, use **Check for updates** on a channel
   after an older-sequence bundle was published (engineer can trigger via
   `dsc figma publish` twice from an older artifact).
   **Expected:** the out-of-order delivery is **named** and its Apply box
   starts unchecked; a fresh delivery applies normally.

---

## Engineer journeys

Work in a scratch directory **outside** the repo clone for E1
(`mkdir ~/pilot-scratch && cd ~/pilot-scratch`), with the `dsc` alias still
pointing at the repo checkout.

### E1 — `onboard` → review gate → `--continue`

*Start the B1 timer now.*

1. `dsc onboard flowbite-react --components Badge --workspace ./ob`
   (any small React or CEM package you know is fine; `flowbite-react` is the
   reference). 
   **Expected:** adapter/styling detected, sandbox created (npm-installed for
   real), seed contracts from the static pass, a **DRAFT capture config** —
   then it **STOPS at the review gate** and prints exactly what a human must
   decide and why. Nothing has been captured yet (B4).
2. Open the printed capture config; resolve the `__review:*` markers it names
   (axis choices, class-identity grammar). This review is the deliberate
   human step — there is no flag that skips it.
3. `dsc onboard --continue --dry-run` then `dsc onboard --continue`
   **Expected:** capture → promote → emit → bundle stages run with per-stage
   receipts; the result includes a pasteable bundle JSON.
   **Success criterion (stop B1 timer):** a promoted contract + bundle exists
   for your component.
4. Kill the run mid-capture once (Ctrl-C), then rerun
   `dsc onboard --continue --from promote` (or the stage it names).
   **Expected:** it resumes **after** the completed stages — the expensive
   browser capture is not repeated (B5).

### E2 — `diff` on a known change

1. In the repo clone: `npm run cli -- diff 2>/dev/null || dsc diff`
   **Expected:** exit `0` (clean) on the untouched tree. Check with
   `echo $?`.
2. Make a known drift: edit one enum value or token ref in any
   `contracts/*.contract.json` (e.g. change a `{color.*}` ref), save.
3. `dsc diff` → **Expected:** exit `1` and a finding that names the contract,
   the property, and both sides of the disagreement — parity referee, not a
   wall of noise.
4. `dsc diff --summarize` → **Expected:** the same finding in plain English
   (G11 summarizer).
5. `git checkout -- contracts/` → `dsc diff` → exit `0` again.

### E3 — Concurrent resolution / awaiting-code-adoption refusal

The trap: a designer's approved contract change lands, code is never
regenerated, and the next code-side extract would silently revert it.

1. Apply a contract-side change without touching generated code (reuse the E2
   edit, or apply a `contracts/.proposals/` artifact from D2 with
   `dsc figma receive --out contracts --apply` in a config with no recorded
   target).
2. Run the extract/spine path over it (repo root):
   `npm run awaiting-adoption:check`
   **Expected:** the guard demonstrates **refuse-on-silent-revert** — the
   pending designer change is named as *awaiting code adoption* and the run
   refuses to overwrite it back, rather than quietly regressing (B3/B4).
3. Adopt the change (regenerate code per the contract, or revert the contract
   deliberately) and re-run — **Expected:** clean.

### E4 — Playground Emotion paste → cost panel, not a refusal wall

1. Repo root: `npm run playground` → open the printed local URL.
2. Paste a **runtime-styled** component source (Emotion/styled — e.g. any
   `styled.button` snippet with a template literal of CSS) into the import
   box and propose.
   **Expected:** instead of a raw refusal, a **cost panel** appears: the
   paste is detected as runtime-styled and the panel explains that this path
   needs the computed-capture floor (real browser), what that costs, and what
   your options are (G6). No garbage contract is invented (B3).
3. Paste a plain CSS Modules component.
   **Expected:** the normal propose path — no cost panel.

---

## Recording the verdict

1. Fill the per-journey `Pass? / Notes / time` cells in
   `PILOT-ACCEPTANCE.md`'s Designer and Engineer tables.
2. Copy your tally sheet totals into the notes column where a budget was
   exceeded (time > 30 min, lookups > 1, any unnamed refusal, any
   pre-confirmation mutation, any repeated expensive stage).
3. Sign the sign-off table (Role / Name / Date / Verdict). Verdict values:
   **PASS**, **PASS-with-findings** (list them), or **FAIL** (name the
   journey and budget that broke).
4. File every finding defect-first: what you ran, what you expected, what
   happened, exact command. "It refused and told me why" is working as
   intended; "it produced output that looks right but isn't" is the highest
   value bug you can report.

Wave 4 is not `READY`, and the release checklist's "Pilot persona sign-off"
row stays open, until **both** columns are signed.
