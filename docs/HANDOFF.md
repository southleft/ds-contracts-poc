# Handoff — the steps a human has to take

> **Current state (2026-08-30).** Recipe-IR landed on main. Product v1 is
> incomplete (F1). The human-only leftovers that matter for the pivot are
> listed in [docs/32's merge execution](32-recipe-ir-pivot.md#merge-execution-2026-08-30)
> (Combobox chrome remint, Calendar page cleanup, npm deferred). The
> snapshot-refresh item below is the capture-path parity loop and is
> unchanged.

Everything in this repository is built and gated so that development never
waits on a person. This file is the exception list: the things that **cannot**
be done from CI or an agent session, why, and what already stands in for them
offline so nothing was blocked while they waited.

Ordered by what unblocks the most.

---

## 1. Refresh the parity snapshots · blocks `npm run parity`

**What:** open the live Figma file and run `parity/extract-figma.plugin.js`,
which rewrites `parity/snapshots/`.

**Why a human:** the plugin executes inside Figma's own sandbox against the
live document. There is no REST equivalent for the fields it reads.

**What it blocks:** `npm run parity` is EXCLUDED from every CI lane, by name,
with this reason — the differ refuses snapshots older than
`MAX_SNAPSHOT_AGE_DAYS` (14) and they are well past that. The refusal is
correct; a differ scoring a month-old snapshot would be reporting on a file
that no longer exists.

**What stands in:** the differ's logic is covered by the C3-detection eval
family in the full lane. Running it needs no snapshot. And since 2026-08-04
the **token half runs on every push** — `npm run tokens:snapshot:check` (fast
lane) derives the variable table `tokens/` implies and diffs it against the
extracted snapshot on name, every mode value and every alias target
(**282/282** today). It does not refuse on age, but it prints it on every run,
so the staleness is on the record instead of hidden:

```
  age          27.2 days — max 14 (MAX_SNAPSHOT_AGE_DAYS)  ⚠ STALE
```

That number only moves when someone does the step above. `--strict-age` turns
it into an exit code.

---

## 2. Widen `CONTROL_TAGS` · a capture change, needs a re-capture to land

**What:** `extract/computed/capture.ts` renders a control element per tag so
fusion can tell "the library styled this" from "the browser did". It renders
**four**: `button`, `span`, `a`, `div`. Every other tag falls back to the
`<span>` control.

**Measured (2026-08-04, `npm run ua-baseline:check`):** 147 of 403 captured
parts — **36.5%** — sit on one of 22 tags with no control:

```
<path> <svg> <input> <td> <label> <th> <li> <h2> <p> <tr> <ul> <img>
<progress> <fieldset> <legend> <h3> <table> <thead> <tbody> <text>
<hr> <al-badge>
```

138 of the 351 `no schema channel today` refusals sit on such a part, and the
top pairs are unmistakably user-agent facts, not authored ones:
`<td>` × {`border-collapse`, `unicode-bidi`, `vertical-align`} ×10 each,
`<th>` ×5 each, `<li> list-style-type`, `<svg> overflow-clip-margin` ×12.

**Why a human / a capture run:** the control must be rendered **inside the
harness page with the library's own CSS loaded**, so it subtracts the library's
reset as well as the UA's defaults. A separately-generated "bare element"
fixture is *not* equivalent and would agree with the bug. Two further
complications, both measured:

- hosted tags need a host context — `<td>`/`<th>`/`<tr>` need a `<table>`,
  `<li>` needs a `<ul>`, `<path>`/`<text>` need an `<svg>`, `<legend>` needs a
  `<fieldset>`;
- `captureJs` picks the container's **first rendering element child**
  (`shStageRoot`), so a hosted control also needs an inner-element selector or
  it will capture the host instead of the tag under test.

It cannot be priced offline: `regate` replays committed truth, and committed
truth has no control for a tag that was never rendered.

**What stands in:** the fallback is named twice — `control-fallback: no control
for <tag> — span control used` in `styledChannelReceipts` (146 occurrences
across 33 components), and, since `a2c4c19`'s successor, in the channel refusal
itself, which now says the baseline may be the user agent's. Nothing is
silently presented as a library fact.

---

## 3. Publish the CLI · `npm publish`

**What:** `cd packages/cli && npm publish`.

**Why a human:** it needs the owner's npm credentials and OTP.

**What stands in:** `npm run publish:check` (fast lane) downloads the registry
tarball and compares `dist/cli.js` **byte-for-byte** against the local build,
so the tree can never drift from the published artifact unnoticed. Currently
green at `@ds-contracts/cli@0.4.0`.

---

## 4. Live-canvas validation · Figma desktop

**What:** import the plugin from `figma-sync/plugin-dist/` and run a generate /
diagnose pass against a real file.

**Why a human:** the Figma Plugin API only exists inside the desktop app.

**What stands in:** `scripts/plugin-engine-mock-figma.mjs` models the real API
including its refusals — the throwing `layoutWrap` setter, real property
defaults, `absoluteBoundingBox`. It has caught bugs the live app would have
(the `column`+`wrap` crash). It is a model, not the app; treat a green mock as
"not obviously broken", never as "verified on canvas".

---

## 5. Figma Community submission

**What:** submit the plugin for Community review.

**Why a human:** it is a publishing act tied to the owner's account, and it is
deliberately held until last.

---

## 6. Mint a scoped PAT and run one curl · settles a claim two docs made for a year

**What:** create a Figma personal access token with **Variables: read**
(`file_variables:read`) ticked, then run exactly this:

```bash
curl -s -o /dev/null -w '%{http_code}\n' \
  -H "X-Figma-Token: $SCOPED_PAT" \
  https://api.figma.com/v1/files/8nim1d0IPnehMxA7B7SYxC/variables/local
```

**Why a human:** minting a PAT is an account action behind the owner's login.
No agent, and no CI secret, can do it.

**Why it matters — the measurement that made this necessary.** Two places in
this repo asserted the Variables REST API is *Enterprise-plan-only*
(`extract/figma/rest/fetch.ts:119-123`, `docs/internal/figma-sync.md:26`), and
`fetchVariables` degraded every 403 identically on that basis. On 2026-08-04
the call was actually made with this repo's existing PAT:

```
403 {"status":403,"error":true,"message":"Invalid scope(s): files:read,
 file_comments:write, file_dev_resources:read, file_dev_resources:write,
 webhooks:write. This endpoint requires the file_variables:read scope"}
```

Control on the same token: `GET /v1/files/:key` → **200**. So the refusal on
record is a **missing token scope**, not a plan tier — and nobody could have
learned that from the tool, because it swallowed the body. The code now
separates the two (`npm run figma:rest:refusal:check`).

**The fork.** This probe is the only thing that settles what the plan limit
actually is on this file:

- **200** → the "Enterprise-only" line was wrong outright. The REST import path
  can resolve variable NAMES on an ordinary plan, and `fetchVariables`'
  degraded path stops being the normal case. Delete the plan claim from both
  places and say "requires a token with `file_variables:read`".
- **403 again**, with a body that does *not* name a scope → the plan limit is
  real and now has evidence behind it for the first time. Quote that body next
  to the claim, and `classifyVariablesRefusal`'s `kind: 'unknown'` branch gets
  a third kind with the measured wording.

Either way the answer is one line of curl and it replaces an inherited belief
with a receipt. Until then the code says "UNVERIFIED" and names this file.

---

## Not on this list, and deliberately

**Deploying.** `npm run deploy` builds, publishes both Pages projects and then
re-verifies the **live bytes** against the local build, retrying while the CDN
propagates. It self-verifies, so it is not a human step.

**Pushing.** The repository is public and push is authorized.
