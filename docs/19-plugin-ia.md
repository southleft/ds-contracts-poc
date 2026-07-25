# 19 — Plugin Information Architecture (proposal for owner markup)

*The plugin grew a tab per capability. Users don't think in capabilities —
they think in intents. This is the restructure proposal: what stays, what
folds, what hides. Nothing here is built; every item awaits the owner's
markup.*

The live finding that motivated this (owner, 2026-07-26): *"quite complex
and very confusing… a lot of superfluous utility in there that I'm not sure
why it's there or what it does"* — and, sharper: *"I thought we were
entering contracts as JSON but you keep giving me JavaScript."* Both are
right. The seven tabs mirror how the tool was BUILT, not how it is USED,
and two of them exist only because of a gap that is now being closed
(foreign-token-aware bundles make compiled-script pasting unnecessary for
users).

## The audit: what each tab is, who it serves, and its fate

| tab today | what it actually does | who needs it | proposed fate |
|---|---|---|---|
| **Generate** | paste contract JSON / bundle → build in file; sample library; receive by code | everyone | **KEEP** — becomes the "Build" home |
| **Update library** | check a bundle against the file, per-set apply with drift warnings | everyone | **FOLD into Build** — "update" is just generate-when-sets-exist; one surface, the report decides create vs amend |
| **Propose** | read a set back, diff vs contract, GitHub PR / send-to-repo | designers | **KEEP** — becomes "Send" (reached mainly FROM Drift, rarely opened cold) |
| **Paste a script** | run a raw compiled .figma.js | developers of THIS tool | **DEMOTE to advanced drawer** — with foreign-token bundles, no end user ever needs it; it is a debug surface |
| **Send to Playground** | POST a dump to the playground by code | tool developers / support | **DEMOTE to advanced drawer** |
| **Local runner** | fetch scripts from a localhost server | tool developers | **DEMOTE to advanced drawer** |
| **Drift** | fingerprint check, per-variant change details, propose link | everyone | **KEEP** — becomes "Watch", the default tab when marked sets exist |

## The three intents

```
┌─────────────────────────────────────────────┐
│  Build        Watch        Send      [⚙]    │   ⚙ = advanced drawer:
├─────────────────────────────────────────────┤       Paste a script,
│                                             │       Send to Playground,
│  (intent-specific surface)                  │       Local runner,
│                                             │       engine stamp + diagnostics
└─────────────────────────────────────────────┘
```

- **Build** — "I have contracts (or want the sample); put them on this
  canvas." Paste box + sample button + receive-by-code + the update report
  when sets already exist. One JSON in, components out. The word "bundle"
  never appears in copy; it's "your contracts file."
- **Watch** — "What changed since generation?" Today's Drift, unchanged in
  behavior; DEFAULT tab when the file has marked sets (the most common
  return visit is a check, not a build).
- **Send** — "Get my canvas change to the code side." Today's Propose,
  reached primarily from a Watch row ("Propose this change"); the PR and
  pairing-code doors side by side, dry-run first.

## Rules the restructure must keep (non-negotiables)

1. **JSON only, everywhere a user touches.** Compiled scripts are internal.
   (Blocked on the foreign-token bundle round; once landed, the MUI test is
   "paste mui.bundle.json into Build.")
2. Every existing behavior keeps its receipt-gated semantics — this is a
   re-housing, not a rewrite; plugin-engine-check pins must stay green
   untouched.
3. The "What's protected" card, drift warnings, and narration copy survive
   the move verbatim (they were just live-verified).
4. Advanced drawer is discoverable but honest: one line per tool saying who
   it's for ("debug surface — runs raw generated scripts").

## Open design questions for the owner

- Naming: Build / Watch / Send — or your words? (Alternatives considered:
  Generate / Drift / Propose kept as-is but regrouped; rejected as jargon.)
- Should Watch auto-run on plugin open when marked sets exist (one less
  click) or stay button-triggered (calmer)?
- Does the sample library belong on an EMPTY-file first-run screen instead
  of a button inside Build?
- Visual design: this doc is IA only — spacing/type/color is yours.

## Sizing

Re-housing + drawer + default-tab logic: SMALL (one focused pass, no engine
changes). Blocked only by the foreign-token bundle round for rule 1.
