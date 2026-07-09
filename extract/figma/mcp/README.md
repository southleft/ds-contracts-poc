# Desktop-MCP import — variable names without the Enterprise plan

The third rung of the design→contract import ladder: structure over REST,
variable **names** from the Figma **desktop app's Dev Mode MCP server**
(`http://127.0.0.1:3845/mcp`). The Enterprise-only
`GET /v1/files/:key/variables/local` endpoint is exactly what this path
replaces — any plan's PAT plus the user's own desktop app recovers the names
that would otherwise degrade to provisional `imported.*` mints.

```
npm run extract:figma:mcp -- <figma-node-url> [--out dir] [--target Name] [--fixture path]
```

Produces a dump v1 (`mcp-dump.json`), proposed contract(s) via the existing
proposer with `mintUnbound: true`, and the extraction report. The join receipt
(every id→name resolution, every ambiguity by name) prints to stderr.

## The fidelity ladder

| Rung | Needs | Variable names | When |
|---|---|---|---|
| **Plugin dump paste** (`extract/figma/dump.plugin.js` → `npm run extract:figma`) | Figma desktop, paste a script in the console | Native — the Plugin API reads each node's own bindings | The reference bar. Manual, but zero ambiguity by construction |
| **Desktop MCP** (this directory) | Figma desktop with the Dev Mode MCP server enabled, the file open as the ACTIVE tab, any-plan PAT | Recovered by value join against `get_variable_defs` — equal to the plugin path wherever the join lands (Badge: identical verdict table), ambiguities reported by name and minted | Semi-automatic local import; the file is yours to open |
| **REST + PAT + minting** (`extract/figma/rest`) | PAT only | Enterprise variables endpoint, else every name degrades to a provisional `imported.*` mint at literal fidelity | Fully headless; hosted playground; Enterprise orgs get names for free |

All three rungs land on the SAME dump v1, the SAME proposer, the SAME refusal
discipline — the receipts differ, never the vocabulary rules.

## How targeting actually works (verified live)

- Tools take a bare `nodeId` (`^\d+[:-]\d+$`) — **no file key parameter
  exists**. The server answers only for the document open in the desktop
  app's **active tab**; any other node id gets *"No node could be found …
  make sure the document containing the node is the active tab."* The CLI
  surfaces that with the fix (open the URL in the desktop app, keep the tab
  focused). `open 'figma://design/<key>/?node-id=…'` focuses the right tab
  from a terminal.
- No selection is required when a node id is passed; with no id, tools fall
  back to the current selection.
- The node-id grammar rejects instance-internal ids (`I123:4;5:6`) — which
  matches the dump's scope anyway: instance internals belong to the child
  contract.

## Why augmentation, not a second dump path

The Dev Mode MCP server exposes no per-node style/binding tree:

- `get_metadata` — id/name/type/position/size skeleton (XML). No layout,
  paints, or bindings.
- `get_design_context` — **generated** React+Tailwind with variant
  conditionals collapsed into one component. Variable names ride CSS custom
  properties (`var(--space-inset-x-sm,12px)`), but inverting generated code
  back into per-variant node trees would be guessing — out.
- `get_variable_defs` — a FLAT `name → resolved value` map (`"space/inset-x/sm":
  "12"`, `"color/…/background": "#dbeafe"`, `"badge": "Font(…)"`), scoped to
  the requested node's subtree. No ids, no per-node granularity.

So `import.ts` keeps the REST path's structure and joins its dangling
`VARIABLE_ALIAS` ids to MCP names **by value**: whole-set scope first, then —
for ids the set scope leaves ambiguous (Badge's danger vs error both resolve
`#fee2e2`/`#b91c1c`) — per-node `get_variable_defs` calls, whose subtree
scoping shrinks the candidate set to what that node actually uses. An id
resolves only when exactly ONE name survives every occurrence's candidate
intersection; two ids landing on one name demote both. Everything else is an
unresolved receipt with the candidate names listed, degrades exactly as the
REST path does, and ships at literal fidelity through `mintUnbound`.

Known residual ambiguity (documented tier, not a bug): two same-valued
variables bound to different fields of the SAME node, and same-valued
variables where one aliases the other and both appear in the node's subtree.

## Receipt

`npm run extract:figma:mcp:receipt` replays the committed live recordings in
`fixtures/` (REST nodes response + every `get_variable_defs` answer, captured
via `--fixture`) through the exact live code path — no network, no desktop
app — and writes [RECEIPT.md](./RECEIPT.md):

- **Badge** (contract-generated): all 13 variable ids name-resolved with the
  Enterprise endpoint 403'ing, zero degradations, zero minted, and the
  existing comparator reports **zero mismatch** against
  `contracts/badge.contract.json` — the same `11 / 4 / 0` verdict as the
  plugin-dump path.
- **Eventz Alert** (foreign, hand-built): `spacing/1…4`,
  `component/border/radius/rounded-md`, `color/content/inverse` recovered by
  name and bound; the U+2024 variable (`spacing/0․5`, ONE DOT LEADER)
  recovered by name and then **refused** by the token-ref grammar; the two
  facts the join couldn't name ship as `imported.*` mints.

## Modules

- `client.ts` — minimal streamable-HTTP MCP client (initialize →
  notifications/initialized → tools/call; parses both JSON and SSE response
  framings; session via the `mcp-session-id` header). Browser-pure: the
  desktop server's CORS posture blocks hosted pages today, but a local
  bridge/extension can reuse it unchanged.
- `import.ts` — occurrence collection (mirrors exactly what
  `rest/map.ts` consumes), the value join, orchestration
  (`importFromUrlViaMcp`), and fixture replay (`replayImport`).
- `cli.ts` — argv/env/fs wrapper; friendly errors for "server not running"
  and "file not the active tab".
- `receipt.ts` — the fixture-replay receipt above.
