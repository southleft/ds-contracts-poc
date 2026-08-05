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

## Plugin bridge (`/bridge/*`) — the pairing-code transports

A second, Anthropic-free surface on the same Worker (`src/bridge.ts`): a
deliver-once mailbox keyed by a short-lived 6-character pairing code. Three
flows ride it today — the tab it was built for, *Send to Playground*, was
**killed** with the plugin's 2026-07-26 IA re-housing (docs/19), but the
transport outlived it in both directions:

- **`ds-contracts figma push <file> --code <CODE>`** — code → canvas, ad
  hoc. A developer POSTs a CONTRACTS-BUNDLE under the code; the designer's
  *Receive by code* (folded into "Other ways to receive" in the plugin's
  **Build** tab) polls the same code and imports on arrival. Both people,
  same fifteen minutes; the envelope (and only the envelope) is checked.
  For the standing route that needs neither person present — CI publishes
  on merge, the designer checks whenever — see the channel section below.
- **`ds-contracts figma receive --out <dir>`** — canvas → code, the dev
  door. The CLI mints the session, prints the code and waits; the designer
  types it into *Send to repo* in the plugin's **Send** tab, and the
  CONTRACT-PROPOSAL envelope lands as a reviewed local diff (the CLI writes
  nothing without `--apply`).
- **Playground dump import** — the original direction: a dump v1 JSON
  travels from the plugin to the playground's Figma tab. The plugin UI for
  it is gone; the route remains for the playground side, and because the
  Plugin API resolves bound variable **names** on any Figma plan, it still
  closes the Enterprise-only REST variables gap.

| Route | Who | What |
|---|---|---|
| `POST /bridge/session` | anyone, any origin (per-IP capped) — the code is minted where the human is looking, and that now includes the CLI's terminal | mints `{ code, readCapability, ttlSeconds: 900 }`; the code is 6 crypto-random chars and `readCapability` is an independent 192-bit secret used only for design-dump reads |
| `POST /bridge/:code` | the sender — **any** origin, including the plugin's `null` and the CLI's none | uploads the payload while the session is open; payload text and kind share one atomic KV envelope (`dump` / `contracts-bundle` / `proposal` — envelope checked, contents never inspected); last write wins; `404` on wrong/expired code, `413` over 4MB, `400` non-JSON or malformed envelope |
| `GET /bridge/:code` | the receiver; bundle/proposal reads need the pairing code, while design-dump reads additionally send `X-Bridge-Read-Capability` | `{ status: "waiting" }` until upload; then `{ status: "delivered", kind, dump }` **once** — all payload/session/capability keys are deleted on delivery; afterwards `410` |

The pairing code authorizes uploads and bundle/proposal reads. A design dump
has a separate 192-bit read capability returned only to the session creator;
the Worker stores only its SHA-256 digest. **Origin is CORS metadata, never
authorization**: a non-browser attacker can spoof it. Consequently, even a
spoofed playground Origin plus a disclosed short code cannot retrieve a dump.
Bundle/proposal flows remain code-only because their Figma/CLI receivers are
origin-less and already target a human-displayed one-time code.

Client integration requirement: the playground dump receiver must retain
`readCapability` from `POST /bridge/session` and send it as
`X-Bridge-Read-Capability` on `GET /bridge/:code`. This lane owns only
`workers/assist/**`, so the existing playground caller is not changed here;
deploying this Worker first intentionally fails closed with the named `403`.

Wrong-code and expired-code uploads share one code path (a single KV read,
one message), so the errors are not timing-distinguishable.

Privacy: dump contents are never logged, never inspected beyond "is JSON /
under 4MB", and never intentionally persisted past one delivery or the
15-minute TTL. Payload and kind are one KV value, preventing cross-generation
kind confusion on resend. Backward-compatible old-key reads infer the kind
from the payload; stale or unknown markers always take the capability-protected
dump path. **Low-severity residual:** KV has no compare-and-delete transaction,
so simultaneous authorized GETs can both observe a payload before either
best-effort delete becomes visible. The 15-minute TTL bounds residue, and both
callers already possess the required code/capability. Moving bridge mailboxes
to a second Durable Object would remove this availability/privacy edge but is
not justified for this short-lived transport. The bridge holds no secrets — the
plugin never sends a Figma token, the read capability is stored only as a
short-lived SHA-256 digest, and the Anthropic key is untouched by these routes.

Caps: its own fail-closed kill switch (`BRIDGE_ENABLED`, independent of
`ASSIST_ENABLED` — the bridge costs KV operations only, never model
tokens) and per-IP daily caps (`BRIDGE_IP_DAILY_LIMIT`, default 40, session
creation and uploads counted as separate classes). Receiver polls are capped
per active code + source IP (`BRIDGE_POLL_DAILY_LIMIT`, default 600): normal
2.5-second polling for the full 15-minute lifetime uses 360.

## Standing CI↔Figma channel (`/channel/*`) — the async delivery route

A third Anthropic-free surface on the same Worker (`src/channel.ts`),
answering the question the bridge structurally cannot: *"has CI published
anything since I last looked?"* The bridge is deliver-once, so asking is
destructive and can only be asked while both people are present. The channel
is a standing, non-consuming inbox — CI publishes on merge, the designer
checks whenever they open the plugin.

**The key split is the whole security story.** `POST /channel/claim` mints a
pair:

| key | shape | holder | can |
|---|---|---|---|
| write key | `dscw_` + 32 chars (160 bits) | CI, as a repository secret | publish |
| read key | `dscr_` + `sha256(writeKey)` hex | the designer, pasted into the plugin | read |

Derivation runs one way. Holding the write key you can compute the read key
(CI may read its own channel); holding the read key you cannot recover the
write key. So a leaked Figma file, a screenshotted plugin window, or a
compromised plugin `clientStorage` leaks a key that **reads** contracts and
can never **inject** into the repository's source of truth. Key *shape* is
refused by name on the wrong route (it is not a secret — the caller can read
its own prefix); key *existence* answers an indistinguishable `404`.

| Route | Who | What |
|---|---|---|
| `POST /channel/claim` | anyone (per-IP capped) | `{ writeKey, readKey, ttlSeconds: 2592000, maxBytes }` |
| `POST /channel/:writeKey` | CI — any origin, usually none | body `{ bundle: <CONTRACTS-BUNDLE>, provenance?: {…} }`; assigns the next `seq`; last write wins; `404` wrong/expired key, `413` over 4MB, `400` non-JSON or malformed envelope |
| `GET /channel/:readKey?since=N[&meta=1]` | the plugin — any origin, usually `null` | `{ status: "current", seq }` or `{ status: "update", seq, publishedAt, provenance?, bundle }`. **Non-consuming** — nothing is deleted, ever. `meta=1` returns the head without the bundle (the plugin's cheap check-on-open). |

`seq` is monotonic per channel. That is what lets the plugin say "CI has an
update waiting (#12)" — impossible under deliver-once — and it is the
ordering base G3's staleness refusal will need. KV is last-write-wins and
eventually consistent, so two racing publishes can land the same `seq` and a
read moments after a publish can serve the previous one. Accepted and
bounded, exactly as the counters are: this is a delivery channel with a human
pressing Apply at the end, not a ledger. The plugin-side **freshness guard**
(`figma-sync/plugin/engine/entry.ts`) is what makes a mis-ordered delivery
visible rather than silent — it compares against a file-local apply log in
the Figma file's root `pluginData` and starts every Apply box unchecked.

TTL is 30 days, **rolling on publish and never on read**: a channel CI has
abandoned dies on purpose; a channel touched weekly lives indefinitely.
Re-claiming after an expiry restarts `seq` at 1, which is precisely the case
the freshness guard names.

Origins: every channel route answers **any** origin including none — both
callers are origin-less by nature (a CI runner's fetch has no `Origin`, a
Figma plugin's sends `Origin: null`), so an origin gate would gate nothing.
The key is the auth, the same reasoning the bridge's upload route documents.

Privacy: bundle contents are never logged and never inspected past the
envelope. The `provenance` sibling is stored and echoed **without being read
at all** — this Worker cannot tell you which repo published.

Caps: its own kill switch (`CHANNEL_ENABLED`, independent of both
`ASSIST_ENABLED` and `BRIDGE_ENABLED` — the channel costs KV operations
only, never model tokens), `CHANNEL_CLAIM_IP_DAILY_LIMIT` (default 10, the
only IP-keyed channel counter — at claim time there is no channel to key
by), and `CHANNEL_PUBLISH_DAILY_LIMIT` (default 200, keyed **by channel**,
because CI runners churn IP addresses and an IP cap would not hold for the
one caller that matters). Reads are uncounted.

**Named exclusions.** Deliveries are **not signed**: possession of the write
key is the only authentication, so anyone holding it can publish any
`provenance` they like and the plugin will render it. HMAC-verified
deliveries with a "verified" badge are docs/18 G1 slice S3, excluded by name
(the Figma plugin sandbox has no WebCrypto for an end-to-end in-plugin
check). Also absent from the channel by design: no Durable Object coordination,
no cron, no server push, no webhook out, no multi-channel management or revoke endpoint (revoking =
stop publishing and let the 30 days run out, or claim a new pair).

## Hard caps & abuse resistance

| Layer | Default | Refusal |
|---|---|---|
| Kill switch (`ASSIST_ENABLED`) | ships `"false"` | `503` — "assist is switched off — the owner has not enabled the shared budget yet" |
| CORS | playground origin + `*.pages.dev` previews only; no-Origin (curl) refused | `403` |
| Per-IP daily cap (`ASSIST_IP_DAILY_LIMIT`) | 5/day per endpoint class (each endpoint is its own class) | `429` |
| Global daily token reservation budget (`ASSIST_DAILY_TOKEN_BUDGET`) | 600,000 conservative tokens/day (UTF-8 input bytes + endpoint `max_tokens`) | `429` — "daily assist budget spent — bring your own key in the Describe tab pattern, or try tomorrow" |
| Per-call output cap | `max_tokens` 1024 / 4096 / 2048 / 8192 | enforced by the API |
| Body size | 320KB (repo-profile samples cap separately at 200KB; fix-contract contracts at 64KB serialized) | `413` / `400` |
| Bridge kill switch (`BRIDGE_ENABLED`) | ships `"false"` — public payload transport is enabled deliberately | `503` |
| Bridge per-IP daily cap (`BRIDGE_IP_DAILY_LIMIT`) | 40/day, session + upload as separate classes | `429` |
| Bridge poll cap (`BRIDGE_POLL_DAILY_LIMIT`) | 600/day per active code + source IP | `429` |
| Channel kill switch (`CHANNEL_ENABLED`) | ships `"false"` — public payload transport is enabled deliberately | `503` |
| Channel claim cap (`CHANNEL_CLAIM_IP_DAILY_LIMIT`) | 10/day **per IP** — the only IP-keyed channel counter (no channel exists yet at claim time) | `429` |
| Channel publish cap (`CHANNEL_PUBLISH_DAILY_LIMIT`) | 200/day **per channel**, never per IP (CI runners churn addresses); reads uncounted | `429` |
| Bridge / channel body size | 4MB of JSON text each | `413` |

Ordering: CORS → kill switch → route → validation → **cache** (repo-profile
hits cost zero tokens and burn no quota) → per-IP → budget → one model call.
The per-IP slot and a conservative maximum request reservation are written
*before* the call. The reservation is UTF-8 bytes for the compiled prompt,
tool, and user data (one token per byte is deliberately conservative), plus
the endpoint's hard `max_tokens` and envelope headroom. Reservations are not
refunded, so accounting is monotonic and conservative. A per-UTC-day
`BudgetCoordinator` Durable Object admits each reservation inside a storage
transaction. Concurrent requests therefore cannot push admitted reservations
past `ASSIST_DAILY_TOKEN_BUDGET`. A missing binding, coordinator error, or
malformed response fails closed with the existing named budget refusal.

### Budget math

`ASSIST_DAILY_TOKEN_BUDGET = 600000` is the owner-approved ceiling in
**conservative reservation units**, not an exact usage meter. At Opus 4.8
pricing ($5/MTok input, $25/MTok output), 600K actual tokens would cost:

- Even input/output mix: 600K × $15/MTok ≈ **$9/day**.
- Typical assist traffic is input-heavy (listings and samples in, small
  forced-tool JSON out), so most days land nearer **$5–7**.
- Theoretical ceiling (every actual token an output token): $15.

Per-request estimates at the same pricing:

| Endpoint | Typical | Worst case |
|---|---|---|
| fetch-plan | ~3–6K in + ≤1K out ≈ **$0.02–0.06** | 2000-entry listing ≈ $0.15 |
| name-tokens | ~4–10K in + ≤4K out ≈ **$0.05–0.15** | 200 entries + 3000 paths ≈ $0.30 |
| repo-profile | ~15–30K in + ≤2K out ≈ **$0.10–0.20** | 200KB samples + full tree ≈ $0.45 — then cached 7 days: **$0** |
| fix-contract | ~8–20K in + 2–6K out ≈ **$0.08–0.25** | 64KB contract + 3000 paths + 8K out ≈ **$0.45** |

Because one UTF-8 byte is reserved as one token, admitted throughput is lower
than these actual-token estimates; that over-reservation is the safety margin.

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

# 3. First rollout only: keep ASSIST_ENABLED=false through the next UTC day
#    boundary. The old day's ephemeral `budget:<day>` KV counter is not copied
#    into Durable Object storage; waiting prevents a same-day budget reset.
#    Deploy. Wrangler applies the committed v1-budget-coordinator Durable
#    Object SQLite migration and creates the BUDGET_COORDINATOR binding.
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
| `BUDGET_COORDINATOR` | Durable Object binding | — | atomic per-day global model-budget reservations; migration tag `v1-budget-coordinator` |
| `ASSIST_ENABLED` | var | `"false"` | kill switch; only `"true"` serves |
| `ASSIST_IP_DAILY_LIMIT` | var | `"5"` | per-IP, per-endpoint-class, per UTC day |
| `ASSIST_DAILY_TOKEN_BUDGET` | var | `"600000"` | conservative reservation units/day (see budget math) |
| `ASSIST_DEV_ORIGIN` | var | unset | exact-match extra origin for local dev, e.g. `http://localhost:5173` |
| `BRIDGE_ENABLED` | var | `"false"` | pairing-bridge kill switch, independent of assist |
| `BRIDGE_IP_DAILY_LIMIT` | var | `"40"` | per-IP, per bridge class, per UTC day |
| `BRIDGE_POLL_DAILY_LIMIT` | var | `"600"` | GET polls per active code + source IP |
| `CHANNEL_ENABLED` | var | `"false"` | standing-channel kill switch, independent of both above |
| `CHANNEL_CLAIM_IP_DAILY_LIMIT` | var | `"10"` | per-IP channel MINTS per UTC day |
| `CHANNEL_PUBLISH_DAILY_LIMIT` | var | `"200"` | publishes per CHANNEL per UTC day (not per IP) |

After deploying, smoke the channel end to end without touching the plugin —
the only two calls that need no key:

```sh
BASE=https://ds-contracts-assist.southleft-llc.workers.dev
curl -sX POST "$BASE/channel/claim"            # → { writeKey, readKey, ttlSeconds }
curl -s "$BASE/channel/<readKey>?since=0"      # → { status: "current", seq: 0 }
```

A claim that answers `503` means `CHANNEL_ENABLED` is not `"true"` in the
deployed config; everything else is unaffected by that switch.

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
- Budget: pre-spent day → named 429 with no model call; missing/unavailable
  coordinator fails closed; parallel requests contend through a race-capable
  transactional fake and prove admitted reservations never exceed the budget.
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
  non-object-output 502 with its conservative reservation retained.
- Plugin bridge (`test/bridge.test.ts`): code shape/alphabet plus independent
  192-bit read-capability shape/uniqueness, the full
  session lifecycle (create → waiting → null-origin upload → delivered once
  → 410), lowercase-code normalization, last-write-wins re-send, wrong and
  malformed codes by name, expired-session refusal, the 15-minute
  `expirationTtl` on every write, the 4MB cap, non-JSON refusal, per-IP
  caps per class plus bounded per-code/IP polling, adversarial spoofed-Origin
  and missing/wrong-capability dump reads, code-only bundle/proposal reads,
  any-origin CORS and `*` preflight, atomic payload+kind envelopes,
  stale/unknown legacy kind downgrade guards, the kind-tagged deliveries
  (contracts-bundle and proposal envelopes checked, byte-identical arrival),
  the independent kill switch, and 405s. Bridge routes never touch the
  Anthropic transport (the mock throws if reached).
- Standing channel (`test/channel.test.ts`, 24 cases): write-key shape and
  uniqueness, `readKey === sha256(writeKey)` against node's own crypto, the
  **split asserted positively in both directions** (a write key cannot read,
  a read key cannot write — each refused 400 by name, with the channel
  provably unchanged afterwards), the claim → publish → read lifecycle
  including "claimed but never published" answering `current` at seq 0,
  **non-consuming reads** (ten reads, keys survive), `since` semantics
  (at-head and ahead-of-head both `current` with no payload; a garbage
  `since` treated as "I have nothing"), `meta=1` heads without the payload,
  seq monotonicity with last-write-wins, provenance echoed verbatim and
  **not inherited** by a later publish that omits it, wrong/expired keys
  indistinguishable on both routes, malformed keys refused by shape with no
  KV probe, the 30-day `expirationTtl` on **every** channel write plus the
  proof that reads perform no writes at all, the 4MB cap, all twelve
  malformed-envelope shapes refused by name, the publish cap holding across
  **churning IPs** while a second channel keeps its own budget, claim capped
  per IP with reads uncounted, kill-switch independence in both directions,
  any-origin answers, 405s, and a full bridge round trip proving the two
  surfaces share one KV without disturbing each other. Channel routes never
  touch the Anthropic transport (the mock throws if reached).

The configured model identifier is asserted from the mocked Anthropic request
shape (`claude-opus-4-8`); tests do not use or request a live secret.

**Not covered — needs live infra:** real workerd runtime behavior
(`wrangler dev` locally / `wrangler deploy` + smoke request are the check),
real KV consistency/TTL expiry, Cloudflare's actual `CF-Connecting-IP`
injection, and real Anthropic responses (model availability, tool-call
quality, actual token counts, real envelope behavior). Live model verification
is a manual deploy smoke requiring the owner's secret and is deliberately not
performed here.
