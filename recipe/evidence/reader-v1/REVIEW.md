# Reader v1 / Phase 2 — side-by-side honesty sheet

> Open [`index.html`](index.html) for Chromium orig-shots beside Figma PNG exports.
> Scratch file `byMp6lt0Ij9b2QbkDGFwBh`. Figma access was **screenshots only** (no writes).
> No grade. `overallSuccess` stays false. Product **v1 remains INCOMPLETE**.

## Pages in this sheet

| page | node | export |
|---|---|---|
| Recipe Pivot / Checkbox v3 | `198:77718` | `figma-checkbox-v3-198-77718.png` |
| Recipe Pivot / Textarea v3 | `198:77456` | `figma-textarea-v3-198-77456.png` |

Machine verdicts: [`recipe/fixture-reader/out/DRIFT-REPORT.md`](../../fixture-reader/out/DRIFT-REPORT.md)
(gate: `npm run recipe:fixture-drift:check`).

## Critical honesty (do not remint these)

### 1 · Astryx `#262626` / Figtree / `#737373` — `capture-theme-unavailable`

Signed Calendar and the Astryx recipes use branded `#0064E0` from vendored
`astryx.css` / `@astryxdesign/core` `:root` fallbacks. The capture floor mounts
`<Theme theme={neutralTheme}>` because that is the **only** theme package on npm
that makes `@scope`'d tokens resolve (without it, the Times defect returns).
Under `neutralTheme` the same tokens resolve to dark-neutral `#262626`,
`#d4d4d4`, `#737373`, Figtree, radius 6/10.

**Do not adopt the dark-neutral palette.** Do not remint Astryx Checkbox /
Textarea / Switch / Alert / Chip to the captured values. Named receipt:
`capture-theme-unavailable` in `reviewed-drift.json`. Fix path (future): ship
or mount a brand theme that matches the recipe surface, then re-capture.

### 2 · AntD Checkbox `dash.height` 2 vs captured 8 — named refusal

v3 **named-refused** the library-true 8×8 CSS square and lowered it to an 8×2
dash so it looks like a dash (owner rejected the filled square).
**Do not adopt 8 and remint a square.** Cause:
`antd-indeterminate-dash-lowering`.

### 3 · MUI Checkbox and Textarea — 0 drift

Every mapped fact matches the ledger. **Do not remint them.**

## Remint decision (Phase 2)

After side-by-sides + extending the reader across the 13-archetype corpus:
**no honest remint.** All live drifts are either `capture-theme-unavailable`
(Astryx) or the AntD dash lowering. MUI/AntD mapped facts that are not those
named causes match.

## Reader coverage after Phase 2

Checkbox, Textarea, Radio, Switch, Alert, Chip, Badge, Avatar, Link, Tooltip,
Tabs, Menu, Dialog — across astryx / mui / antd (39 subjects). Where a library
has no capture-floor export (Astryx RadioList-only / Avatar / Link / Tooltip /
Tabs / Menu / Dialog; Astryx Badge overlay refused; AntD Typography.Link;
AntD Tabs/Menu/Dialog missing from configs), that is a **named receipt**, not
a fake component.
