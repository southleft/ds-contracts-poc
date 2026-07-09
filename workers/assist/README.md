# ds-contracts-assist

The playground's agentic-assist backend: a small Cloudflare Worker that lets
**anonymous visitors** borrow a **server-held Anthropic key** for four narrow,
tool-forced tasks. The owner funds it, so everything here is built around hard
caps — and around one governance rule that never bends:

> **Everything this Worker returns is a proposal.** The playground validates
> every response through the same contract schema and token referee that
> gate hand-written contracts. The Worker is not a bypass: it has zero
> side-effect capabilities (no repo writes, no fetching on the model's
> behalf, no tool loop), and the client labels its output `ai-proposed`.

All four endpoints run `claude-opus-4-8` — the owner's call: outputs people
can feel confident in, with cost contained by the caps below rather than by a
cheaper model.

## Endpoints

All JSON, all `POST`, all browser-only (see CORS below).

### `POST /v1/assist/fetch-plan`

Helps the code importer chase non-obvious style sources — the files a
deterministic import-tracer can't reach by following imports (theme files,
global stylesheets, tailwind configs).

```jsonc
// request
{
  "entryUrl": "https://github.com/acme/ui/tree/main/src/components/Button",
  "listing": [{ "path": "src/theme/tokens.css", "size": 4096 }],   // ≤ 2000 entries
  "alreadyFetched": ["src/components/Button/Button.tsx"],
  "gaps": ["hover background color source unknown"],               // required, non-empty
  "profile": { /* optional: a prior repo-profile result */ }
}
// response (proposal)
{
  "fetch": [{ "path": "src/theme/tokens.css", "reason": "…" }],    // hard cap 12
  "styleSystem": "css-modules" /* | styled-components | tailwind | scss | vanilla-extract | unknown */,
  "notes": [],
  "model": "claude-opus-4-8",
  "usage": { "input_tokens": 0, "output_tokens": 0 }
}
```

`max_tokens` 1024. When `profile` is present the system prompt treats it as
prior knowledge from an earlier pass over the same repo.

### `POST /v1/assist/name-tokens`

Proposes semantic names for provisional tokens the importer minted, consistent
with the existing token tree's conventions. Every rename is a suggestion.

```jsonc
// request
{
  "component": "Button",
  "entries": [{ "ref": "{provisional.button-1}", "value": "#3B5BDB", "usageSites": ["root/background"] }], // ≤ 200
  "existingTokenPaths": ["color.action.primary.background", "radius.control"]  // ≤ 3000
}
// response (proposal)
{ "renames": [{ "from": "…", "to": "…", "rationale": "…" }], "model": "…", "usage": { … } }
```

`max_tokens` 4096.

### `POST /v1/assist/repo-profile`

One Opus pass over a repository's shape — framework, styling system, token
sources, component locations, conventions — **remembered in KV for 7 days**.
This is the importer's memory: the profile from one component import feeds the
next one (`fetch-plan` accepts it as `profile`).

```jsonc
// request
{
  "repoUrl": "https://github.com/acme/ui",
  "ref": "main",                                       // branch or sha
  "tree": [{ "path": "package.json", "size": 900 }],   // ≤ 2000 entries, may be truncated
  "samples": [{ "path": "package.json", "content": "…" }] // ≤ 12 files, ≤ 200KB total content
}
// response
{
  "profile": {
    "framework": "react" /* | angular | web-components | vue | svelte | unknown */,
    "styleSystem": "css-modules" /* fetch-plan enum + design-tokens-package */,
    "tokenSources": [{ "path": "…", "kind": "css-custom-properties" /* dtcg | scss-vars | js-theme | tailwind-config */, "note": "…" }],
    "componentDirGlobs": ["src/components/**"],
    "conventions": ["co-located *.module.css per component"],
    "notes": []
  },
  "cached": false,          // true on a cache hit — zero tokens, no quota burned
  "model": "…", "usage": { … }   // present only on fresh (non-cached) responses
}
```

`max_tokens` 2048. Cache key: `profile:<repoUrl>@<ref>`. **Profiles are
shareable across visitors by design** — the playground only imports from
public repositories, so a profile contains nothing visitor-specific and the
next visitor importing from the same `repo@ref` gets it for free.

### `POST /v1/assist/fix-contract`

Repairs a contract the playground's referee refused — changing **only** what
the refusals name. The system prompt forbids restructuring, renaming, or
"improving" anything a refusal does not mention (untouched fields come back
byte-stable wherever the schema allows), restricts every token ref to the
provided inventory (`imported.*` paths included; enum placeholders legal only
when every expansion exists), and tells the model to substitute dead token
paths by **role** at that CSS property, never by spelling similarity.

```jsonc
// request
{
  "contract": { /* the refused contract */ },        // object, ≤ 64KB serialized
  "refusals": ["anatomy root/background: …"],        // required, non-empty, ≤ 50
  "tokenPaths": ["imported.badge.background", "…"]   // required, non-empty, ≤ 3000
}
// response (proposal)
{ "contract": { /* minimally edited */ }, "model": "…", "usage": { … } }
```

`max_tokens` 8192. The forced tool (`propose_contract_fix`) wraps a
**hand-kept, non-strict mirror of the playground's `CONTRACT_TOOL` schema**
(`playground/src/engine/prompt-import.ts`): the contract shape needs
`oneOf`/`const`/`pattern`, which `strict: true` tool schemas refuse, so this
tool ships without the strict flag. **Divergence risk, named:** the mirror is
maintained by hand — if the playground's contract shape changes and this copy
lags, the model is aimed at a stale shape. The failure mode is contained:
the Worker shape-checks the output only (a non-object contract answers `502`),
and the client re-runs the exact same schema + generator referee over the
proposal, so a stale mirror produces refused proposals, never accepted bad
ones. Keep the two in sync when the contract shape changes.

## Hard caps & abuse resistance

| Layer | Default | Refusal |
|---|---|---|
| Kill switch (`ASSIST_ENABLED`) | ships `"false"` | `503` — "assist is switched off — the owner has not enabled the shared budget yet" |
| CORS | playground origin + `*.pages.dev` previews only; no-Origin (curl) refused | `403` |
| Per-IP daily cap (`ASSIST_IP_DAILY_LIMIT`) | 5/day per endpoint class (each endpoint is its own class) | `429` |
| Global daily token budget (`ASSIST_DAILY_TOKEN_BUDGET`) | 600,000 tokens/day (input+output, all visitors) | `429` — "daily assist budget spent — bring your own key in the Describe tab pattern, or try tomorrow" |
| Per-call output cap | `max_tokens` 1024 / 4096 / 2048 / 8192 | enforced by the API |
| Body size | 320KB (repo-profile samples cap separately at 200KB; fix-contract contracts at 64KB serialized) | `413` / `400` |

Ordering: CORS → kill switch → route → validation → **cache** (repo-profile
hits cost zero tokens and burn no quota) → per-IP → budget → one model call.
The per-IP slot is reserved *before* the call; the budget is checked before
and charged with *actual* usage after, so the worst overshoot is one request's
`max_tokens`. KV counters are read-modify-write (not atomic) and eventually
consistent — a parallel burst can slip a few requests past a line. Accepted:
these are abuse dampeners with bounded overshoot, not billing-grade metering.

### Budget math

`ASSIST_DAILY_TOKEN_BUDGET = 600000` is the **~$10/day equivalent the owner
approved**, at Opus 4.8 pricing ($5/MTok input, $25/MTok output), counting
input + output against one counter:

- Even input/output mix: 600K × $15/MTok ≈ **$9/day**.
- Typical assist traffic is input-heavy (listings and samples in, small
  forced-tool JSON out), so most days land nearer **$5–7**.
- Theoretical ceiling (every token an output token — impossible given the
  per-call `max_tokens` vs. large inputs): $15.

Per-request estimates at the same pricing:

| Endpoint | Typical | Worst case |
|---|---|---|
| fetch-plan | ~3–6K in + ≤1K out ≈ **$0.02–0.06** | 2000-entry listing ≈ $0.15 |
| name-tokens | ~4–10K in + ≤4K out ≈ **$0.05–0.15** | 200 entries + 3000 paths ≈ $0.30 |
| repo-profile | ~15–30K in + ≤2K out ≈ **$0.10–0.20** | 200KB samples + full tree ≈ $0.45 — then cached 7 days: **$0** |
| fix-contract | ~8–20K in + 2–6K out ≈ **$0.08–0.25** | 64KB contract + 3000 paths + 8K out ≈ **$0.45** |

At the defaults, the budget covers roughly 30–100 fresh Opus calls/day.

## Prompt-injection posture

- **Fetched repo content and Figma values are UNTRUSTED.** They enter the
  model as data inside the user message; every compiled system prompt names
  the boundary and instructs the model to treat instruction-shaped text in
  repo content as inert.
- **No user-controlled system prompts.** System text is compiled into the
  Worker; visitors control data fields only.
- **The forced tool schema constrains output shape** (`tool_choice` forced,
  `strict: true`, thinking disabled), and the Worker re-clamps server-side
  (fetch list ≤ 12, enums fall back to `unknown`).
- **The client-side schema referee is the real gate.** A poisoned repo can at
  worst produce a bad *proposal*, which the contract schema and the human
  reviewing the diff refuse — the same path a bad hand-written contract takes.
- **Zero side-effect capabilities.** The Worker never fetches repo files
  itself, never writes anywhere but its own KV counters/cache, and holds no
  credentials besides the Anthropic key (header-only, never logged, never
  echoed; upstream error detail is not forwarded to visitors).

Residual risk worth naming: a malicious *public repo* could seed a poisoned
shared profile for its own `repo@ref`. The profile only ever feeds proposals
about that same repo, so the blast radius is the proposal itself — refereed as
above.

## Deploy runbook (orchestrator)

From `workers/assist/` (requires `wrangler` ≥ 4, `npm install` first):

```sh
# 1. Create the KV namespace and paste the printed id into wrangler.toml
npx wrangler kv namespace create ASSIST_KV

# 2. Put the server-held key (Worker secret — never in wrangler.toml or vars)
npx wrangler secret put ANTHROPIC_API_KEY

# 3. Deploy
npx wrangler deploy

# 4. Enable — owner has approved flipping this immediately at deploy time:
#    set ASSIST_ENABLED = "true" in wrangler.toml and redeploy (or set it in
#    the dashboard). The enabled path is the primary tested path; the kill
#    switch remains the instant off-lever (flip back + redeploy, no code).
```

Config surface, all optional except the first two:

| Name | Kind | Default | Meaning |
|---|---|---|---|
| `ANTHROPIC_API_KEY` | secret | — | server-held key |
| `ASSIST_KV` | KV binding | — | counters + profile cache |
| `ASSIST_ENABLED` | var | `"false"` | kill switch; only `"true"` serves |
| `ASSIST_IP_DAILY_LIMIT` | var | `"5"` | per-IP, per-endpoint-class, per UTC day |
| `ASSIST_DAILY_TOKEN_BUDGET` | var | `"600000"` | global tokens/day ≈ $10 (see budget math) |
| `ASSIST_DEV_ORIGIN` | var | unset | exact-match extra origin for local dev, e.g. `http://localhost:5173` |

Local dev: `npm run dev` (wrangler dev with a local KV simulator), with
`ASSIST_DEV_ORIGIN` set so the local playground origin passes CORS.

## Tests — what is and isn't covered

`npm test` runs plain `node:test` (via tsx) against the exported handler with
a Map-backed KV and a scripted Anthropic fetch — no vitest, no workerd, no
network. Covered:

- CORS: refusals (unlisted origin, missing origin/curl, suffix-lookalike
  domain), preview-subdomain allow, preflight headers.
- Kill switch: unset and `"false"` both answer the named 503.
- Routing/validation: 404, 405, non-JSON 400, named 400s, sample-size cap.
- Per-IP cap: N+1 → 429 (named), other IPs unaffected.
- Budget: pre-spent day → named 429 with no model call; usage accrual from
  mocked `usage`; the bounded-overshoot semantics.
- Happy paths for all four endpoints: exact Anthropic request shape (model,
  `max_tokens`, forced `tool_choice`, `thinking: disabled`, key in header
  only), response shape, the `{ wrapper }` tool-input envelope unwrapping,
  fetch-list clamp to 12 + enum fallback, profile caching (hit path, per-ref
  keys, no quota burn on hits), and upstream failure mapping (no tool_use →
  502, upstream 429/529 → retryable 429, no upstream detail leaked).
- fix-contract specifics: the non-strict forced tool, double-wrapped
  `{ contract: { contract } }` unwrapping and flat-contract salvage, the
  named-400/413 refusal table, per-IP class isolation from the other
  endpoints, the spent-budget short-circuit (zero model calls), and the
  non-object-output 502 with usage still charged.

**Not covered — needs live infra:** real workerd runtime behavior
(`wrangler dev` locally / `wrangler deploy` + smoke request are the check),
real KV consistency/TTL expiry, Cloudflare's actual `CF-Connecting-IP`
injection, and real Anthropic responses (tool-call quality, actual token
counts, real envelope behavior). The `usage`-driven budget accounting is
tested against mocked numbers only.
