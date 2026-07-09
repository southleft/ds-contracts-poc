# Contract Playground — Plan

**Goal**: a public, browser-only playground (in the spirit of json-render.dev/playground)
where anyone can experience the contract loop without cloning the repo:
import a design or code, watch a contract be proposed, edit it under schema
governance, and generate output for multiple targets — running the **actual
engine**, not a demo copy.

**Live URL**: Cloudflare Pages (deployed via Wrangler). Everything runs
client-side; user secrets (Figma token, Anthropic key) never leave the
browser. No backend, no analytics, no accounts.

---

## Principles

1. **Same engine.** The playground imports the repo's `core/` modules — the
   same code that generates the 51 shipping components. The golden manifest
   guards the refactor; if playground and CLI ever diverge, that's a bug.
2. **Honest tiers.** Full token-aware contracts when variable names resolve;
   resolved literals + nearest-token reporting when they don't; inline-style
   output when there's no token infrastructure at all. Every degradation is
   named on screen. Nothing is ever invented.
3. **The contract is the star.** The center pane is always the contract —
   editable, schema-validated, refusals shown by name. Inputs propose it;
   emitters consume it.
4. **Chrome stays Carbon-simple.** No decoration that upstages the artifact.

## Phases & workstreams

### Phase 0 — Foundations (IN FLIGHT)
- **W1 — Pure-core engine refactor + emitters** *(agent running)*:
  `core/` barrel importable in the browser (schema, both proposers, React
  emitter, Figma-script builder), byte-identical CLI output (golden-guarded),
  plus new emitters: plain HTML+CSS and React inline-style (token values
  resolved), behind a pluggable `Emitter` interface.
- **W2 — Figma REST → dump mapper** *(agent running)*: figma.com URL + user
  token → the dump format the proposer consumes; Enterprise-only variables
  endpoint degrades to resolved literals with named reports. Round-trip
  receipt on REST-shaped Badge.

### Phase 1 — MVP playground on a live URL

> **Launch gate (per TJ, 2026-07-08): the playground does not launch
> publicly until Figma URL import (W6) works end-to-end.** Paste-dump
> import is a power-user affordance, not the import story — visitors
> won't know where a dump comes from. W5 deploys are previews until W6
> lands. Domain: default *.pages.dev for now.
- **W3 — App shell + examples gallery**: `playground/` Vite app; routes
  `/playground` and `/examples`; gallery preloaded from repo contracts
  (atoms → Switch/Card molecules → Banner/ChatMessage compositions, plus the
  foreign-CSS Callout showing honest degradation); repo tokens bundled.
- **W4 — Pipeline UI**: input modes (example picker / paste Figma dump JSON /
  paste TSX+CSS); contract editor with live schema validation and named
  refusals; emitter output tabs (React CSS Modules · React inline · HTML+CSS ·
  Figma sync script); live rendered preview; unbound-value report panel.
- **W5 — Deploy**: `wrangler pages deploy`; project name, headers, SPA
  routing; deploy script committed. (Custom domain: TJ decision.)

### Phase 2 — Live imports & bring-your-own design system
- **W6 — Figma URL import UI**: token field (session-only), REST fetch in
  the browser, degradation ladder surfaced in the UI; CORS fallback via a
  Pages Function proxy ONLY if the browser-direct call fails (still no
  stored secrets).
- **W7 — Code import via URL**: fetch TSX+CSS from public GitHub raw URLs;
  auth'd repos later.
- **W8 — Bring-your-own tokens**: paste DTCG token JSON (or Figma variables
  when the plan allows) → proposals bind against *the user's* token tree;
  tier-2/tier-3 references preferred exactly as the extractor already does.

### Phase 3 — Start from nothing (generative) (LANDED)
- **W9 — Prompt-to-component**: user-supplied Anthropic key, browser-direct
  Claude call, schema-constrained generation (tool use against
  ContractSchema) → a valid contract, never freeform code — the governed-
  generation story, public.
- **W10 — Shareable permalinks + onboarding**: contract state encoded in the
  URL; guided example walkthroughs.

## Out of scope (deliberately)
- Parsing `.fig` files (not a public format — the REST API covers import).
- GitHub OAuth flows (raw-URL fetch first).
- Vue/Svelte/Angular emitters at launch (the `Emitter` interface makes each
  one a bounded contribution — roadmap, and part of the spec story).
- Any server-side state.

## Risks & mitigations
- **Bundle size** (TypeScript compiler for code-import parsing): lazy-load
  the code-import path; measure in W1's browser-bundle smoke.
- **Figma REST CORS**: verified pattern in the wild; Pages Function proxy as
  fallback (W6).
- **Variables endpoint is Enterprise-only**: the degradation ladder IS the
  design (Principle 2); the MVP tier works for everyone.
- **Engine drift between CLI and playground**: impossible by construction —
  one `core/`, golden-guarded.

## Success criteria
- **Phase 1 (preview)**: a stranger with a URL can, in under a minute, pick
  Card from the gallery, change an enum value in the contract, watch the
  refusal/validation behavior, and copy working React + HTML output.
- **Launch**: Phase 1 + W6 — paste a figma.com component URL + token and get
  a proposed contract with real bindings or named degradations.
- **Phase 2**: paste a Figma component URL + token → proposed contract with
  real bindings (or named degradations) → working code.
- **Phase 3**: a prompt produces a schema-valid contract that renders in all
  emitters, with governance visible.

## Demo path (W3 + W4 + W6–W10 — landed)

`npx vite --config playground/vite.config.ts` → http://localhost:5181

1. `/examples` — gallery cards rendered live by the html emitter (iframe +
   the repo's token stylesheets); the Callout card is the foreign-code tier.
   Every card carries a one-line "What to notice" caption naming the
   specific thing it teaches (Badge: one enum fans out on both surfaces;
   ChatMessage: the layoutByProp row flip; Callout: raw values reported,
   never invented).
2. Pick **Badge** → `/playground?example=badge`: contract center-stage,
   emitter tabs from the registry (Preview · React · HTML+CSS · React inline
   · Figma script), copy per file, prettier behind a lazy "Format" toggle.
   The Preview defaults to **Single** — a controls strip derived from the
   active contract's props (enum → select, boolean → on/off, text/number →
   debounced inputs, arrayOf → a code-only tag) drives one live instance.
   Mechanism: the chosen values are written into a CLONE's prop defaults,
   so emitHtml's own "default" showcase item IS the requested state —
   core/ untouched, no second renderer to drift. A control whose toggle
   leaves the instance markup byte-identical says "no visible change — by
   design"; declared events list themselves with the same code-only tag.
   **All variants** (one segment away) is the classic showcase grid.
   The Contract pane header carries a **JSON | Spec** toggle: Spec renders
   the same contract as a read-only designer spec sheet (props table,
   variant axes + combination count + State-preview note, layoutByProp
   notes, slots with accepts, code-only events, token refs grouped by
   category, states, a11y). It tracks the last schema-valid parse — invalid
   text shows the last sheet with a stale banner, refusals stay listed in
   both views, and a refusal clicked from Spec flips to JSON and scrolls to
   its line. Editor text survives the round-trip byte-identically.
3. Break a token ref in the editor → the generator's refusal appears BY NAME
   under the editor AND the offending line gets a danger background (a
   dependency-free textarea-overlay backdrop; zod paths walked to their
   line, generator messages anchored on the value they quote, unresolvable
   refusals highlight nothing — never a guess); each resolved refusal is a
   click that scrolls to its line. Preview holds the last valid render and
   says so. A Reset in the pane header restores the pristine original
   whenever the text has diverged from what was loaded.
4. **Figma tab** — the W6 UI: URL + session-only token → `importFromUrl`
   (the same function the CLI runs) → proposal + Import-report receipts.
   No token? "Demo import" runs the identical code path over the committed
   REST fixture via the client's injectable fetch; the "non-Enterprise plan"
   checkbox answers variables with the 403 and shows the full degradation
   ladder (50 named `variable-unresolved` entries + unbound values with
   nearest-token candidates on the Badge fixture).
5. **Code tab** — paste TSX+CSS (or load the Callout example): the
   TypeScript compiler arrives as a lazy chunk, raw values are reported
   with candidates in the Receipts panel, nothing invented.
   **GitHub URL mode (W7)**: paste a public github.com file URL (blob, raw,
   or directory form) — e.g. this repo's own
   `src/components/Badge/Badge.tsx` — the TSX is fetched browser-direct,
   the co-located `*.module.css` is auto-discovered (the component's own
   import → same-name sibling → contents-API listing, each step receipted),
   and the same lazy propose path runs. Errors are named: 404 (with the
   private-repos-also-404 caveat), rate-limit with reset time, file too
   large, not-a-TSX.
6. **JSON tab** — paste a contract (straight to the editor, schema-refereed)
   or a dump v1 (runs the same proposer as the Figma import).
7. **Tokens tab (W8)** — bring your own tokens: paste DTCG JSON (a single
   tree or an array; session-only, sessionStorage) and every consumer
   rebinds — validation inventory, preview stylesheet (regenerated from the
   paste by token-css.ts, derived from scripts/build-tokens.mjs), code-import
   var() matching, Figma nearest-token suggestions, inline-emitter literals.
   The starter tree covers exactly ds.badge with values the repo never
   shipped; load any other contract and the generator refuses by name.
   A pasted tree is modeless — light and dark resolve identically.
8. **Describe tab (W9)** — prompt → contract, governed. One sentence + a
   user Anthropic key → a browser-direct claude-sonnet-5 call (the
   documented `anthropic-dangerous-direct-browser-access` CORS opt-in;
   the key is session-only, sent to api.anthropic.com and nowhere else)
   with a FORCED tool whose input_schema is a pruned hand-authored contract
   shape; the system prompt carries the authoring rules, the ACTIVE token
   inventory (user tokens when pasted), and the Badge exemplar. The output
   lands in the same governed editor as every source — a refused proposal
   shows its violations by name and offers "Ask the model to fix" (the
   refusal text goes back as an is_error tool_result; max 2 rounds, count
   shown; never a silent retry). No key? **Demo generate** replays
   recorded-shape responses through the injectable transport — identical
   code path; round 1 deliberately invents `{radius.tag}` so the refusal
   and the fix round demo in one click each. Receipts: model id, tokens
   in/out, rounds used.
9. **Share (W10)** — the button on the Contract pane copies a URL carrying
   the contract text + active output tab + theme in the hash
   (`#s=1.<base64url deflate-raw>`, plain-JSON `0.` fallback; a typical
   contract is ~1–1.5 KB; >8 KB refuses with a named warning). Secrets and
   user tokens never travel. First visit, a dismissible strip performs the
   loop for you: load Badge → break a token ref (named refusal, in the
   editor and the React tab) → open the React output → reset the example
   (pristine Badge back in one click).
10. **Workspace** — every successful import (Figma URL/demo, code paste or
    GitHub URL, Describe generation, JSON paste) lands in a session
    workspace (engine/workspace.ts: sessionStorage, this tab only). A
    Workspace tab appears FIRST in the rail with the first import: entries
    grouped by source with text tags (FIGMA/CODE/AI/JSON), name, time —
    click restores the contract AND its receipts; per-entry remove, Clear
    all; capped at 30 with the evicted entry named in a receipts line. The
    Figma and Code tabs list their own imports under their forms. Loading
    an entry sets workspace provenance and a dismissible one-line strip
    above the output tabs tells the switch story (imported from design →
    the React/HTML tabs are its code side; from code → the Figma script
    tab is its design side; generated → both sides below). "How do I use
    this?" in the topbar opens a plain help drawer — one short section per
    way in, plus a seven-term glossary (contract, anatomy, token binding,
    emitter, refusal, degradation, promotion — one plain sentence each).
    First-session jargon explains itself in place: output-tab tooltips say
    what each output IS ("Figma script" → the script that builds/updates
    the component in Figma), the Receipts header carries a clarifying
    sub-line, and "golden-guarded" expands on hover.

Bundle tiers (vite build, gzip): initial ≈ 153 KB · prettier chunk ≈ 339 KB ·
TypeScript chunk ≈ 985 KB · REST fixtures ≈ 3 KB — the lazy tiers load only
behind their actions. Live-path receipt: a browser-direct api.figma.com call
answers (403 with a bogus token — no CORS block), so URL import needs only a
real token; the Pages-Function proxy fallback remains unbuilt until needed.

**The designer validation loop** — to run the Figma script output for real,
copy it and paste it into the Sync Runner dev plugin's "Paste a script" tab
(figma-sync/plugin/README.md). Paste it back into the SOURCE file the import
came from: it builds the contract's version beside your original for A/B —
or, when the contract's component already exists there, the plugin says so
in plain words and offers to select it. A contract from a degraded import
(minted `imported.*` tokens) carries a preamble that first upserts those
tokens as variables in an 'Imported (provisional)' collection — the output
toolbar counts them ("includes N provisional variables") — so the script
runs in files that never synced them; rename the provisional variables
against your real tokens when you adopt the contract. On success the plugin
selects and zooms to the result automatically.

## Receipts discipline
Every phase lands with: gates green (52/52+), new eval cases where the
engine grew, MILESTONES.md entry, and a demo path documented in this file.
