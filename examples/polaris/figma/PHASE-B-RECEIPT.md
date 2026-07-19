# Phase B receipt — live sync into "Polaris Contracts" (fileKey `W33Bzm5U58mcQHSCgEB7X8`)

Run date: 2026-07-18 (bridge session connected 2026-07-19T01:50Z UTC). Target file verified by
fileKey via `figma_get_status` before every write batch AND by an in-script guard
(`figma.fileKey`/`figma.root.name` check) prepended to every executed script. The bridge target
was pinned (`figma_navigate lock:true`) after one mid-session reconnect flipped the active file
to an unrelated file; no write ever ran while the wrong file was active.

Delivery channel: scripts served read-only over `http://localhost:9230` (a port the Desktop
Bridge plugin manifest allows) with CORS headers; each `figma_execute` call fetches the
committed script byte-for-byte and evaluates it. Committed scripts were NOT edited.

## Pre-state

Blank file confirmed by probe before any write: 1 page ("Page 1", 0 children), 0 variable
collections, 0 local variables.

## 00-tokens.figma.js — token variable upsert

| check | expected | actual |
|---|---|---|
| Primitives collection (mode "Value") | 403 variables | 403 |
| Brand collection | 0 variables (empty, emitted by script) | 0 |
| Semantic collection | 0 variables (empty, emitted by script) | 0 |
| Text styles | 0 | 0 |
| Total local variables | 403 | 403 |

403 = 453 wrapped tokens − 50 named exclusions (COMPILE-RECEIPT.md lists all 50 by name).

Spot-checks (resolved Figma value vs. `tokens/polaris-light.dtcg.json`, rem×16 per the
documented conversion):

| variable | tokens JSON value | Figma resolved | match |
|---|---|---|---|
| `p/border-radius-100` | `0.25rem` | FLOAT 4 | yes |
| `p/color-bg-fill` | `rgba(255, 255, 255, 1)` | COLOR {1,1,1,1} | yes |
| `p/color-backdrop-bg` | `rgba(0, 0, 0, 0.71)` | COLOR {0,0,0,0.71} | yes |
| `p/space-400` | `1rem` | FLOAT 16 | yes |
| `p/font-size-325` | `0.8125rem` | FLOAT 13 | yes |
| `p/height-2000` | `5rem` | FLOAT 80 | yes |

### NAMED DEVIATION — hexToRgb execution shim (engine bug, filed, script not edited)

The emitted script's `hexToRgb` parses only `#rrggbb`, but all 224 COLOR primitives in the
committed script carry Polaris values verbatim as `rgba(r, g, b, a)` strings. First live run
failed on `setValueForMode` with NaN r/b (the headless gates cover the referee and the canvas
compile of component scripts — the token upsert had never touched the real Variables API).
Fix applied as an **in-flight shim**: the execute wrapper string-replaces the `hexToRgb`
function in the fetched source with a parser accepting both `rgba()` and hex (alpha
preserved), verified-applied or the run aborts before eval. The committed file is untouched;
all 224 COLOR values parsed (validated locally against `rgba()`/hex regex, 0 unparseable).
**Engine finding to file**: `core/emit-figma-script.ts` `buildTokensScript` emits a hex-only
color parser while DTCG-wrapped sets may carry `rgba()` strings. (Engine is out of scope for
this run per owner instruction.)

The first (failed) run had already created 21 variables before throwing; the upsert is
idempotent by name and the successful re-run completed the set (created 382, total 403).

## Component sync runs

(appended per component below)
