# 18 — User Flows

*The code↔design loop as two people actually live it: every step named,
every step marked as built or missing, and a ranked gap list that drives
the build phase.*

This document is the UX blueprint for the tool's two disciplines. It was
assembled from three persona walkthroughs (a senior product designer, a
React library owner, a design-system team lead running a 40-person
brownfield org) and then adversarially verified against the shipped code —
`figma-sync/plugin/ui.html`, `figma-sync/plugin/engine/entry.ts`,
`packages/cli/src/`, `examples/ci/`, `workers/assist/`. Where a persona's
optimism did not survive contact with the repo, the tag below reflects the
repo, not the optimism.

Legend: **[EXISTS — surface]** means built and verified on that surface
today. **[GAP → Gn]** points into the ranked gap list at the end.

---

## The one mental model

Two personas, one model, no exceptions:

- **The contract lives in the repo.** A JSON document carrying only
  canvas-expressible facts (props, anatomy, token bindings, layout,
  states — see doc 16). It is the single source of truth.
- **The canvas is a projection.** The plugin renders contracts into
  component sets deterministically — same input, same bytes, no AI in the
  conversion. Re-running is always safe.
- **Every change becomes a PR.** A designer's canvas edit and an
  engineer's code edit both land in the same place: a reviewable pull
  request against `contracts/`. Nothing writes to the repo outside review;
  nothing writes to the canvas except an Apply a human clicked.

The designer never opens a terminal. The engineer never opens Figma.
The contract is where they meet, and git is where they argue.

---

## Flow 1 — First hour: designer

*"From 'what is this' to 'our real button is on my canvas' — without a
terminal."*

1. Install the plugin from Figma Community (or the org's private plugin
   list) in one click. **[GAP → G0]** — the mechanics are ready
   (`figma-sync/plugin/GET-STARTED.md`, `PUBLISHING.md` checklist), but the
   plugin is **not published**. Today's path is a dev-zip installed from an
   engineer's laptop, which disqualifies this persona outright. Every other
   step in this document is unreachable until G0 closes.
2. Open the plugin in a scratch file and click **"Build the sample
   library"** — the baked reference contracts (Card, Badge, Avatar,
   Button) generate token-bound sets in about 30 seconds, no paste, no
   repo. **[GAP → G9]** — the generate path and the baked contracts both
   exist (`DSC.bakedContract` already ships in the bundle), but the
   Generate tab today greets a repo-less designer with an empty textarea
   whose placeholder is JSON and whose hint is a CLI incantation. She has
   nothing to paste and the first words she reads are code.
3. Click Generate a second time. Nothing duplicates, nothing moves — and
   the plugin says so: "Re-ran. Identical result, 0 changes."
   **[EXISTS mechanically — Generate tab re-run dedupe; narration is
   GAP → G12]** Determinism is invisible unless you narrate it.
4. Receive your real library. The designer opens the Receive panel, types
   a 6-character code, and the plugin polls; an engineer runs
   `ds-contracts figma push <bundle> --code <CODE>` with the same code
   within 15 minutes. **[EXISTS — pairing-code bridge, `workers/assist`]**
   Note the choreography precisely: the designer *types* the code and
   waits; the plugin never displays one. Two humans, online at the same
   time, one-time code, 15-minute TTL. Charming in hour one; the standing
   channel it must never become (see Flow 5).
5. "Generate in this file" with tokens-first sync. Real component sets
   appear, dependency-ordered, bound to variables with the team's token
   names. **[EXISTS — Generate tab, tokens-first, composite resolution]**
6. Inspect a generated Button: real variants in the properties panel,
   fills bound to recognizable variables. Where token matching degraded,
   the plugin explains it in designer words ("3 colors couldn't match a
   token; they're plain values — here's why"), not in a refusal report.
   **[EXISTS for the mechanism — graceful degradation, correct pixels;
   the in-plugin per-node callout is GAP → G12]**
7. The hour ends on a "What's protected" card: "These 4 sets are
   contract-backed. Your edits are detected as drift, never silently
   overwritten." **[GAP → G12]** — genesis stamps exist; the plain-words
   safety promise does not. Nobody edits a component they think a robot
   might stomp.

**Honest summary:** the first hour is genuinely no-terminal *if* G0 is
closed and an engineer is live for step 4. Both caveats are load-bearing.

---

## Flow 2 — First hour: engineer (brownfield)

*Existing React + CSS Modules library, DTCG tokens in repo, ~40
components.*

1. `npx @ds-contracts/cli init` → `ds-contracts.config.json` appears; edit
   `code.root` / `code.adapter` to point at `src/components`.
   **[EXISTS — CLI `init`]** An `init --detect` that sniffs package.json
   and pre-fills the adapter would make this a confirmation, not
   authoring. **[GAP → G14]**
2. `ds-contracts extract --reconcile` → proposed contracts land in
   `ds-contracts/out/contracts/`, plus the unbound-value report with
   nearest-token candidates and named refusals. Source files untouched —
   `git status` is clean. **[EXISTS — `extract`; first trust checkpoint,
   and the tool passes it]**
3. Work the refusal report. On a real 40-component library this report
   runs to hundreds of items; grouped acceptance ("these 12 literals all
   resolve to `color.border.subtle` — accept all?") is the dominant
   day-one labor, not report polish. **[GAP → G14]**
4. `ds-contracts diff` → exit 0. A falsifiable, exit-coded baseline that
   goes into CI on day one. **[EXISTS — `diff` exit-code contract]**
5. Copy `examples/ci/code-led.yml` — and audit it, because today it
   **commits contracts directly to main** (`contents: write`, `git push`).
   The default must be a PR. **[EXISTS — the recipe, replayed by eval
   gates; PR-first default is GAP → G10]** Defaults are trust statements:
   a tool that auto-commits to main on first contact gets uninstalled.
6. First canvas generation: `ds-contracts figma contracts/*.json --tokens
   tokens.json --out figma-scripts/`, then either the Local runner against
   `npm run figma:serve` (solo, recommended) or a scheduled pairing
   session with the designer — the same synchronous courier from Flow 1
   step 4 appears at minute 45 of hour one. **[EXISTS — `figma` command,
   plugin Generate/Local runner; the courier constraint is G1]**
7. If the library is Emotion- or Tailwind-styled instead of CSS Modules:
   computed capture needs a hand-authored config with a per-library
   `classAllow` grammar, and historically new styling methods have needed
   core engine work, not just config (doc 17: "currently expert work";
   the MUI and Tailwind PROVENANCE files confirm multi-hour expert
   pipelines). For half of real-world libraries, first hour becomes first
   week. **[GAP → G6]**

**The lead's minute-5 version of the same cliff:** pasting a real
Emotion-styled component into the playground returns a wall of refusals
with no way to tell "honest refusal" from "doesn't support my library."
The playground should detect runtime-styling signatures and route to an
explicit "this library needs computed extraction — here is what it
costs" panel, and the coverage scorecard the lead wants for budgeting
must honestly report "N components unmeasurable without computed
capture" as its own top line. **[GAP → G6]**

---

## Flow 3 — Designer daily loop: canvas edit → PR

*Widen Button padding 12 → 16, add a `destructive` variant, directly on
the canvas, like a normal person.*

1. Edit the generated Button set. No special mode, no lock — sets are
   ordinary Figma nodes. **[EXISTS]**
2. Drift tab → "Check drift." Button flags as drifted, per-variant detail,
   click-to-focus on the changed node. **[EXISTS — Drift tab]** Detail
   today prints raw `nodeLabel · channel: was → now` truncated at 48
   chars; there is **no** reverse value→token lookup anywhere in the drift
   path ("12 → 16, candidate: space.400" is an engine feature with real
   ambiguity, not copy polish — interim: name a token only on exact value
   match, which is trivial and honest). **[GAP → G12; full reverse lookup
   is engine work]**
3. The drift language must be the designer's — "padding," "new variant,"
   "fill changed" — but the shipped Drift hint leads with "contract hash"
   and "canvas fingerprint" (`ui.html:297`). **[GAP → G12]**
4. "→ Propose this change" lands in the Propose tab with the set name and
   base contract pre-filled from baked contracts. **[EXISTS — Drift→
   Propose glue; this is the zero-ticket spine and it is built]**
5. "Read the set & diff" shows the change as a per-channel diff. The
   playground's read-only JSON | Spec toggle belongs here so the review
   is a spec sheet, not JSON. **[EXISTS in playground; in-plugin spec
   view is GAP → G12]**
6. "Open PR", dry-run default-on: the exact plan first ("will update
   contracts/button.json on branch ds/button-padding, PR to main"), then
   for real. A PR opens; engineering reviews it like any code change.
   Zero tickets filed. **[EXISTS — Propose GitHub PR section, dry-run
   default, session-only token]**
7. Except: step 6 requires the designer to provision a fine-grained
   GitHub token and know the owner/repo — a terminal in a text field. An
   admin should connect the repo once (GitHub App); the bundle should
   carry its repo coordinates so Propose pre-fills everything and the
   designer's only input is "propose this change." **[GAP → G5]**
8. After merge, the plugin says so on next open: "Your Button change
   merged Tuesday. Canvas and contract now agree," and Drift shows
   "resolved by PR #N." **[GAP → G13]** A PR you never hear back about
   decays into "I'll just Slack the engineer" — the failure state this
   tool exists to kill.

---

## Flow 4 — Engineer daily loop: code edit → bundle

1. Open a normal PR: change `Button.module.css` padding token, add a
   `size="xl"` variant. Nothing ds-contracts-specific in the editing
   workflow — contracts derive from code. **[EXISTS — by design]**
2. CI on the feature PR runs extract and posts the contract delta to the
   same PR as a human-readable summary ("Button: +variant size.xl;
   padding: space.300 → space.400") so code and contract review
   atomically. **[GAP → G10, G11]** — this is *not* just reordering CI
   pieces: fork PRs have no write token, bot commits need loop guards,
   concurrent PRs race on `contracts/`, and the English summarizer
   (`diff --summarize --base <ref>`) is new CLI surface — today's job
   summary is proposal/skip *counts* grepped from the extract log.
3. Merge. CI on main produces the CONTRACTS-BUNDLE artifact with
   proposal and skip counts in the job summary. **[EXISTS —
   code-led.yml]** Counted skips are auditable; silent skips are how DS
   tools rot.
4. The bundle reaches the designer. Today: a human runs `figma push`
   against a code the designer typed, both online at once, 15-minute
   TTL. Ideal: the designer's plugin shows "Atlas v2.14, CI run #482,
   published 2h ago" under a named, **signed** channel. **[Check/Apply
   half: EXISTS — Update tab. Delivery half: GAP → G1]** Any pipeline
   with a walk-to-the-designer's-desk step silently stops being run
   within a month, and then the no-drift promise dies of neglect, not of
   bugs.
5. Determinism spot-check: re-running Generate produces the same bytes;
   the deterministic-roundtrip gate proves contract→canvas twice is
   byte-identical. **[EXISTS — C1-determinism gate]** This is the
   property that makes automation safe.
6. Weekly hygiene: CI runs `diff` — but the canvas-side check lives in
   the plugin's Drift tab, one click by a human in Figma. A drift
   detector that requires the drifter to self-report under-reports
   exactly when drift happens. Headless fingerprint recompute off a REST
   file dump is the read half of the same missing channel as step 4.
   **[Drift check: EXISTS — plugin. Headless in CI: GAP → G1]**

---

## Flow 5 — Designer receives a code change

*Engineering renamed a token and added a `loading` state; CI produced a
bundle.*

1. Ideal: the plugin badge reads "1 library update waiting" — delivered
   asynchronously, provenance shown and verified before Apply enables.
   **[GAP → G1]** This is every persona's #1 gap. And the fix must be
   provenance-first: a persistent unauthenticated drop-box that designers
   habitually Apply from is a supply-chain injection point into the
   source of truth. CI signs the bundle; the plugin verifies and shows
   repo/run/commit; unsigned bundles keep today's pairing-code posture
   with a visible "unverified" badge.
2. Today's real path: Slack ping, designer types a code in the Update
   tab, engineer pushes under it. Workable for a demo. **[EXISTS —
   `figma push` + pairing code]**
3. "Check against this file" → a per-contract change report, nothing
   applied yet. **[EXISTS — Update tab]** But the report is prop-API
   granularity only: `+prop loading` is named, while **every** recolor,
   style change, and token rename collapses into the single phrase
   "interior/style changes (no API change)" (`entry.ts:532`) — which is
   engineer vocabulary for "nothing changed for you," and is precisely
   wrong for a recolor. Both compiled specs are already in hand at plan
   time; diff them per channel and reuse the Drift tab's pretty-printer
   so both reports speak one language. **[EXISTS at prop granularity;
   style detail is GAP → G8]**
4. Per-contract checkboxes: apply Button, hold Card. Nothing applied
   until "Apply selected." **[EXISTS — keep this forever]**
5. The report must also say: "You have unsaved drift on Button (your
   padding edit). Applying will overwrite it." Today `updatePlan` reads
   identity markers only and **never runs the drift check** — Apply on a
   canvas-edited set silently overwrites the designer's work, right now,
   in the shipped plugin. **[GAP → G2 — the live covenant violation, and
   a days-scale fix]**
6. Apply selected: sets update in place, variables re-sync, no
   duplicates, instances keep their overrides. **[EXISTS — deterministic
   apply; the apply-success line "Instances keep their overrides (same
   nodes, same property ids)" is the best designer-language sentence in
   the product and the style model for G12]**
7. After apply, a dismissible highlight on updated nodes for a 30-second
   visual audit. **[GAP → G12]**

---

## Flow 6 — Engineer receives a design change

1. Designer's Drift → Propose → PR lands in the repo touching
   `contracts/Badge.json` only. **[EXISTS — Flow 3]**
2. design-led.yml fires: generate --stories → `diff` exit-code gate →
   Storybook build → Playwright screenshots → PR comment with visuals.
   The engineer reviews a contract diff plus rendered pixels, not a
   Figma link. **[EXISTS — design-led.yml, validated by
   examples/ci/validate.mjs]** With one honest caveat: the gate runs
   after regeneration against `src/generated`, so it validates that
   *freshly generated* code satisfies the contract — near-true by
   construction — and the screenshots are of generated Storybook, not
   the hand-written component that ships. **[Caveat → G10]**
3. Config collision underneath: extract needs `code.root =
   src/components` (real code); design-led's gate assumes `code.root =
   src/generated`. One config file, two incompatible values. Split
   `code.root` from `generate.out`, and run a second diff against the
   real components posted as a named, *expected-red* status ("shipped
   component does not yet satisfy this contract — 3 channels behind") so
   the debt is tracked by the tool, not by memory. **[GAP → G10]**
4. Merge the contract PR. The brownfield gap: the reverse leg emits
   fresh generated code; it does not patch hand-written `Badge.tsx`
   (doc 16: bounded patch class via provenance anchors is the doctrine;
   doc 17: anchors-only today, named honest gap). Minimum acceptable:
   an anchor-derived **suggested diff on the PR** — "in
   `Badge.module.css:14`: `var(--radius-md)` → `var(--radius-lg)`" —
   human applies, never auto-written. **[GAP → G7]**
5. The trap the personas missed and the review caught: without a guard,
   the *next* code-led extract reads the unchanged source and re-commits
   the old value — **silently reverting the approved design change** by
   Wednesday's cron, with drift reading clean and nobody told. A green
   result hiding a lie. Extract must refuse (named, counted in the CI
   summary) to overwrite a contract whose last change came from a
   design-led PR until the anchored source actually changes — an
   "awaiting code adoption" state, consistent with the tool's refusal
   ethos. **[GAP → G4]**

---

## Flow 7 — The conflict moment

*Engineer changes Button padding in code Monday; designer edits the same
Button on canvas Tuesday; the bundle arrives Wednesday.*

1. Both detectors fire independently: Update check shows incoming Button
   changes; Drift check shows the canvas also diverged from genesis.
   **[EXISTS — both, in separate tabs, never cross-referenced]**
2. First, the cheap guard (before the expensive view): the update report
   opens with a conflict banner — "Button: incoming update AND local
   drift. Applying overwrites your edit to X" — with the checkbox
   default-unchecked. **[GAP → G2 — days, and it repairs the covenant
   immediately]** Without it, "Apply selected" against a drifted canvas
   is silent data loss, today.
3. Then, the real surface: one screen composing the three artifacts that
   already exist — genesis (the recorded base), incoming (theirs), canvas
   (mine) — per channel. Non-overlapping changes auto-merge ("your
   padding + their new Loading variant — these don't overlap, keep
   both"); true same-channel collisions get a named choice rendered as
   before/after swatches, never channel names. "Keep mine" flows into
   the existing Propose→PR path, pre-scoped, with the PR noting the
   conflicting bundle. No silent winner, ever; no tool-side
   auto-resolve, ever. **[GAP → G3]**
4. Staleness guard: a three-way merge fed a stale base can bless an
   accidental revert as a clean merge. If the canvas hasn't received the
   last main state (the G1 courier unrun for weeks), the designer's
   "drift" is actually the engineer's merged change, and her Propose PR
   becomes a revert that `diff` then blames on her. The merge — and the
   Propose tab before it — must verify the base is an ancestor of main
   and refuse otherwise: "canvas is 3 syncs behind — deliver before
   proposing." **[GAP → G3, downstream of G1]**
5. CI backstop: the `diff` exit-code gate blocks the contract PR until
   parity is restored. **[EXISTS — the right backstop; the gap is the
   merge experience in front of it]** Resolution lives in the PR, as a
   contract edit, human-decided.

---

## Trust moments

The specific instants each persona decides the tool is safe — or isn't.
These are the product; the gap list below exists to protect them.

**Won today (verified in the repo):**

- *Engineer, minute 10:* `extract` proposes into `ds-contracts/out/`,
  `git status` stays clean. The tool reads and never rewrites.
- *Engineer, minute 30:* `diff` exits 0. A falsifiable baseline with an
  exit code — claims are reproducible in CI, not vibes.
- *Everyone, minute 31:* re-run Generate → same bytes, zero duplicates.
  The idempotence demo is the single most persuasive 60 seconds
  available; the lead performs it live, twice, in front of the design
  team. Byte-identical re-runs are the precondition for automation.
- *Designer, Update tab:* "Change report — nothing applied yet," apply
  Button, hold Card. Review-before-write on the canvas.
- *Designer, Propose tab:* dry-run default-on shows the exact plan;
  token is session-only; the refusal copy offers the dry run instead of
  demanding the credential.
- *Lead, playground:* the degradation example in the gallery — a tool
  that demos its own failure mode before you hit it.
- *Lead, CI:* skip counts in job summaries; CI recipes replayed as eval
  gates so docs cannot diverge from reality.
- *Lead, docs:* anchors-only write-back disclosed up front. Acceptable
  if disclosed; a mutiny if discovered. Honesty is itself the trust win.
- *Everyone:* "prop left the contract (kept — retire by hand)" — the
  tool refuses to silently delete a designer-visible prop even when
  deleting would be convenient.

**Lost today (each maps to a gap):**

- *Designer:* Apply over a drifted set eats her edit with zero warning
  (G2). Her own words: "the first time an apply eats my work is the
  last time I use the tool." This state is reachable in the shipped
  plugin.
- *Designer:* a recolor reported as "interior/style changes (no API
  change)" (G8) — the one thing she needs to decide apply/hold is the
  one thing the report refuses to say.
- *Designer:* pasting a fine-grained GitHub token into a plugin field
  (G5); the empty-textarea cold start with CLI text (G9, G0); a Drift
  hint that speaks in hashes (G12).
- *Engineer:* the pairing-code courier as the only delivery channel
  (G1) — the loop dies of neglect, not of bugs.
- *Engineer / lead:* the silent-revert loop after a design-led merge
  (G4) — a green result hiding a lie, the lead's stated trust-killer.
- *Lead:* the Emotion capture-config cliff at minute 5 of evaluation
  (G6) — the brownfield library *is* the hard case, so the hard path is
  the default path.

**The decisive moment,** named identically by all three personas: two
writers touch the same component in the same week. Today the tool has no
screen for it. A tool whose answer to concurrent change is "last apply
wins" cannot be the source of truth for 40 people. G2 buys the covenant
back in days; G3 wins the moment for good.

---

## Ranked gap list

Merged and deduped across all three personas, corrected by the skeptic
reviews (five of the original [EXISTS] tags did not survive contact with
the code). Sizing: **SMALL** = glue over machinery that exists; **ENGINE**
= new engine surface, real design work. Order is build order.

| # | Gap | Blocks | Size |
|---|---|---|---|
| **G0** | **Plugin publish.** Not on Community; today's dev-zip path means a designer cannot start without an engineer's laptop. Mechanics ready (`GET-STARTED.md`, `PUBLISHING.md`); publish org-internal first to skip the review queue. | designer (everything downstream) | SMALL |
| **G1** | **Async CI↔Figma channel — deliver + verify, provenance-first.** **DELIVER HALF SHIPPED** (slices S1+S2): a standing channel on the assist worker (`workers/assist/src/channel.ts`) with a write-key/read-key split — `readKey = sha256(writeKey)`, so a leaked Figma-side key reads and can never inject. `ds-contracts figma claim-channel` mints the pair; `figma publish` posts a CONTRACTS-BUNDLE with a GitHub-Actions **provenance sibling** (never inside the bundle bytes, so `figma bundle` stays byte-deterministic); the plugin peeks non-consumingly (check-on-open + a "Check for updates" button — **no timer**, a plugin has no background execution) and renders "repo — CI run #N, commit abc1234, published 4 minutes ago" above the change report. Deliveries carry a monotonic `seq`, and the new **freshness guard** names an out-of-order delivery and starts every Apply box unchecked — closing a real silent-downgrade hole (`updatePlan` compared specHash for equality only; no ordering existed anywhere). The pairing-code bridge is untouched and is now the documented "unverified / ad-hoc" path. **STILL OPEN, named:** (a) deliveries are **not signed** — anyone with the write key can publish any provenance, so there is no "verified" badge yet (slice S3, excluded by name: the plugin sandbox has no WebCrypto for an end-to-end in-plugin signature); (b) the **read half** — a headless fingerprint drift recompute off a REST file dump so CI referees drift without a human clicking a tab — is not started. | all three; the daily loop dies here | ENGINE |
| **G2** | **Drift-aware update check + named overwrite warning.** `updatePlan` never runs the drift check, so Apply on a canvas-edited set silently overwrites the designer's work today. Join the existing drift check into `upd-check`; drifted rows warn ("applying overwrites your edit to X") and default-unchecked. Covenant repair, days not weeks. | designer, lead | SMALL |
| **G3** | **Three-way merge surface (genesis × incoming × canvas), per-channel resolution.** Auto-merge non-overlapping channels; true collisions get a named mine/theirs choice rendered as before/after swatches, never channel names; "keep mine" flows into Propose→PR. Must refuse a stale base ("canvas is 3 syncs behind — deliver before proposing"), so it ships after G1. | all three; the scale-breaker | ENGINE |
| **G4** | **Silent-revert guard ("awaiting code adoption" state).** After a design-led merge, the next code-led extract reads unchanged source and re-commits the old value — reverting the approved change with drift green. Extract must refuse (named, counted) to overwrite a design-led contract until the anchored source changes. | engineer, lead | ENGINE |
| **G5** | **Org-level GitHub App + bundle-carried repo coordinates.** Replaces designer-pasted fine-grained PATs and the owner/repo form. Admin installs once; PRs attribute to the person; Propose pre-fills everything from bundle provenance (falls out of G1's signing work). PR machinery already exists (`propose-pr`). | designer, lead | ENGINE |
| **G6** | **Runtime-styled onboarding: draft capture-config generation + coverage scorecard.** Emotion/MUI/Tailwind capture configs are expert work with a history of needing core engine changes per styling method. Propose a draft config from the extract pass; aggregate refusal reports into a library scorecard that honestly counts "N components unmeasurable without computed capture"; playground routes runtime-styled pastes to a cost explanation, not raw refusals. | engineer, lead (brownfield default path) | ENGINE (config gen) + SMALL (scorecard rollup) |
| **G7** | **Brownfield write-back suggested diffs.** Design-led merges leave hand-written components stale. Emit anchor-derived suggested patches on the PR ("`Badge.module.css:14`: `var(--radius-md)` → `var(--radius-lg)`") — human applies, ideally as GitHub suggested changes; never auto-write. | engineer | ENGINE |
| **G8** | **Plain-words style diffs in the update report.** Every recolor and token rename collapses into "interior/style changes (no API change)" — exactly what a designer needs to decide apply/hold. Both compiled specs are in hand at plan time; diff per channel and reuse the drift pretty-printer so both reports speak one language. | designer | SMALL |
| **G9** | **Sample-library cold start.** The Generate tab greets a repo-less designer with an empty textarea and CLI text. Add "Build the sample library" feeding the baked bundle straight into the existing generate path. Gates trust moments one and two for anyone without an engineer beside them. | designer | SMALL |
| **G10** | **PR-first CI defaults + config split.** code-led.yml commits contracts to main; default must open/append a PR. Split `code.root` (extract/diff = real components) from `generate.out`; after design-led merges, run a second diff against real components as a named expected-red status so brownfield debt is tracked by the tool. Defaults are trust statements. | engineer | SMALL (wiring) |
| **G11** | **Contract-diff English summarizer (`diff --summarize --base <ref>`).** Channel-level "Button: +variant size.xl; padding: space.300 → space.400" for PR comments and job summaries — new CLI surface, not reordering (plus the extract-on-PR walls: fork tokens, bot-loop guards, contract races). Feeds G8's language too. | engineer; feeds designer reports | ENGINE |
| **G12** | **Designer-language safety narration bundle.** "Re-ran: 0 changes"; the "What's protected" card; per-node degradation callouts; Drift hint rewritten without "hash"/"fingerprint"; spec-sheet (not JSON) diff in Propose; post-apply change highlights; token naming in drift detail on exact value match (full reverse lookup is ENGINE — do not budget it as copy). Style model: the shipped apply-success line. The engine is already safe; this makes it *believed* safe. | designer | SMALL |
| **G13** | **Audit trail + loop closure.** File-local apply-log in root `pluginData` (bundle hash, CI run, user, timestamp) with a viewer tab; audit block in design-led PR bodies so git is the durable log; merged PR → genesis re-stamp → Drift shows "resolved by PR #N"; merge status surfaced in-plugin (needs G1). Org-grade identity rides G5 — a hosted audit service is *not* small and is not proposed. | lead (governance), designer (loop closure) | SMALL (file-local + PR-body); in-plugin status after G1 |
| **G14** | **Extract refusal triage + `init --detect`.** Group the unbound-value report by fix-type with bulk acceptance (`--accept-candidates`) — on a 40-component brownfield library this is the dominant day-one labor, not polish. `init --detect` pre-fills adapter and token paths from package.json. | engineer | SMALL |

**Sequencing notes.** G0 and G9 unblock the designer's first hour and cost
almost nothing. G2 repairs the live covenant violation before anything
else ships. G1 is the hinge: G3's merge base, G13's in-plugin status, and
the "zero manual sync chores" claim are all downstream of it. **G1's
deliver half now stands** — the "zero manual sync chores" claim is true for
CI→designer delivery, and G3 has its ordering base (`seq`) and G13 its
record shape (the file-local apply log in root `pluginData`, capped at 50
entries, key names chosen for G13's viewer). What G1 still owes them is
signing (S3) and the read half; neither blocks G3's merge surface. G6 gates
brownfield adoption sequencing — for an Emotion-shop lead it comes before
G1/G3, which gate week-two scale-out, not day one. Nothing in this list
may break the byte-identical re-run property; it is the precondition for
every automation above.
