# Handoff — the steps a human has to take

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
family in the full lane. Running it needs no snapshot.

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

## Not on this list, and deliberately

**Deploying.** `npm run deploy` builds, publishes both Pages projects and then
re-verifies the **live bytes** against the local build, retrying while the CDN
propagates. It self-verifies, so it is not a human step.

**Pushing.** The repository is public and push is authorized.
