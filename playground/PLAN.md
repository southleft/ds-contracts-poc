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

### Phase 3 — Start from nothing (generative)
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
- **Phase 1**: a stranger with a URL can, in under a minute, pick Card from
  the gallery, change an enum value in the contract, watch the refusal/
  validation behavior, and copy working React + HTML output. Deployed on a
  public URL.
- **Phase 2**: paste a Figma component URL + token → proposed contract with
  real bindings (or named degradations) → working code.
- **Phase 3**: a prompt produces a schema-valid contract that renders in all
  emitters, with governance visible.

## Receipts discipline
Every phase lands with: gates green (52/52+), new eval cases where the
engine grew, MILESTONES.md entry, and a demo path documented in this file.
