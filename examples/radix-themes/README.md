# Radix Themes — held-out exam subject #1

> ## THE BLINDNESS RULE
>
> **This directory was authored blind, and it must stay blind until the exam
> runs.** Everything here comes from Radix Themes' own documentation and shipped
> source: the prop definitions in
> `node_modules/@radix-ui/themes/dist/esm/components/*.props.js`, the shipped
> `styles.css` / `tokens.css`, and the public docs at
> <https://www.radix-ui.com/themes>.
>
> **No capture, promote, emit or bundle stage of this repo has been run against
> Radix Themes. No output of ours for it has been read. Nothing here was tuned
> in response to our pipeline's behaviour.** If you find yourself wanting to
> change a value in this directory because "the capture would do X", stop — that
> is exactly the contamination this exam exists to detect. Change it only if the
> LIBRARY's own documentation says the mount is wrong.
>
> The exam's own rules and command list live in
> [`parity/receipts/v1/HELD-OUT-MANIFEST.md`](../../parity/receipts/v1/HELD-OUT-MANIFEST.md).

---

## 1 · Subject and pins

| pin | value |
|---|---|
| `@radix-ui/themes` | **3.3.0** |
| react / react-dom | 19.2.8 |
| esbuild | 0.28.2 (what the capture harness invokes) |
| sandbox mount barrel | `@radix-themes-sandbox/ui@0.0.1` (local, `file:./ui-pkg` — see §2) |

Radix Themes is the **pre-styled** layer on top of Radix Primitives: React
components with a `<Theme>` provider, `data-*` attributes for state, `rt-*`
classes for identity and variant, and **1,091 CSS custom properties** carrying
the whole visual vocabulary. It is the closest held-out analogue to the
committed shadcn round (CSS variables + Radix primitives) and to Carbon (one
prebuilt stylesheet), which is why it is the first subject: if the pipeline
generalises at all, this is where it should show.

**No webfont ships with the library**, so this config declares no `fonts` block.
`--default-font-family` is a system stack
(`-apple-system, BlinkMacSystemFont, 'Segoe UI (Custom)', …`) — the
FC-FONT-SUBSTRATE machinery exists for libraries that fetch a face over the
network, and Radix Themes fetches nothing. `styles.css` contains **zero `url()`
references**, so the harness stays network-free with no loader configuration.

## 2 · Recreate the sandbox (git-ignored; this block is the source of truth)

```bash
mkdir -p examples/radix-themes/.radix-themes-sandbox
cd examples/radix-themes/.radix-themes-sandbox
printf '{"name":"radix-themes-sandbox","private":true,"type":"module"}\n' > package.json
npm i -E @radix-ui/themes@3.3.0 react@19.2.8 react-dom@19.2.8 esbuild@0.28.2

# THE MOUNT BARREL — see the finding in §4.1. It re-exports the library's
# namespaced members under flat names and adds nothing else.
mkdir -p ui-pkg
cat > ui-pkg/package.json <<'JSON'
{
  "name": "@radix-themes-sandbox/ui",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "main": "./index.js",
  "exports": { ".": "./index.js" },
  "peerDependencies": { "@radix-ui/themes": "*", "react": "*" }
}
JSON
cat > ui-pkg/index.js <<'JS'
export * from '@radix-ui/themes';
import { Callout, TextField, Tabs } from '@radix-ui/themes';

export const CalloutRoot = Callout.Root;
export const CalloutIcon = Callout.Icon;
export const CalloutText = Callout.Text;

export const TextFieldRoot = TextField.Root;
export const TextFieldSlot = TextField.Slot;

export const TabsRoot = Tabs.Root;
export const TabsList = Tabs.List;
export const TabsTrigger = Tabs.Trigger;
export const TabsContent = Tabs.Content;
JS
npm i -E ./ui-pkg
```

Then, from the repo root:

```bash
node examples/radix-themes/scripts/build-tokens.mjs
```

## 3 · The ten components

Every axis value list below is copied **verbatim** from the library's own
`propDefs`; nothing was invented and nothing was pruned.

| component | mounted export | axes (source: `*.props.js`) | states | notes |
|---|---|---|---|---|
| Button | `Button` | `variant` classic/solid/soft/surface/outline/ghost (default solid) × `size` 1–4 (default 2) | disabled | `loading` pinned false |
| Badge | `Badge` | `variant` solid/soft/surface/outline (soft) × `size` 1–3 (1) | — | |
| Checkbox | `Checkbox` | `variant` classic/surface/soft (surface) × `size` 1–3 (2) × `checked` unchecked/checked/indeterminate | disabled | `checked` is a **variant axis**, not a state plane (docs/21 §4.3) — the tri-state rides `axisValueMap` |
| Switch | `Switch` | `variant` (surface) × `size` (2) × `checked` | disabled | |
| TextField | `TextFieldRoot` | `variant` (surface) × `size` (2) | disabled | `placeholder` pinned |
| Callout | `CalloutRoot` | `variant` soft/surface/outline (soft) × `size` 1–3 (2) | — | `childrenSpec`: `CalloutText` |
| Card | `Card` | `variant` surface/classic/ghost (surface) × `size` 1–5 (1) | — | `blockStage`, stage padding 48 (§4.4) |
| Avatar | `Avatar` | `variant` solid/soft (soft) × `size` 1–9 (3) | — | `fallback` pinned "TP"; own 224×224 stage |
| Progress | `Progress` | `variant` (surface) × `size` (2) | — | `value` pinned 60; `blockStage` |
| Tabs | `TabsRoot` | — | — | 2-deep `childrenSpec` (List → 3 Triggers); `defaultValue` pinned |

Props deliberately **held fixed and receipted, not enumerated**: `color` (26
accent values — a Theme-level concern, and the whole point of the accent
indirection is that components do not carry it), `highContrast`, `radius`,
`asChild`. The Theme itself is mounted with **no props**, i.e. the library's
shipped defaults (accent indigo, gray auto→slate, radius medium, scaling 100%,
appearance light).

## 4 · What this subject costs the config grammar — named findings

These are **findings, not blockers**. Each one is a place where Radix Themes
says something our config grammar cannot say.

### 4.1 `importName` cannot name a compound export

`extract/computed/capture.ts` emits `importName` verbatim into
`import { <importName> } from '<library.package>'`. Radix Themes ships its
multi-part components as **namespace objects** — `TextField.Root`,
`Callout.Root`, `Tabs.Trigger` — and a dotted name is not a valid import
specifier. Three of the ten components (TextField, Callout, Tabs) are therefore
unmountable as written.

The sandbox barrel in §2 is the answer, and it is the shadcn round's own
precedent (`@shadcn-sandbox/ui`). It re-exports the library's component objects
**by reference** and adds no wrapper, no default props and no styling. The cost
is honest but real: `library.package`/`library.version` then describe the barrel
(`@radix-themes-sandbox/ui@0.0.1`) rather than the subject, so **the real pin is
`@radix-ui/themes@3.3.0` in the sandbox `package-lock.json`**, exactly as
shadcn's real pin is its sha256 ledger.

### 4.2 `<Theme>` is a real DOM box, and it is where every token lives

Unlike shadcn's `TooltipProvider` (context-only, no box), `<Theme>` renders
`<div class="radix-themes" data-accent-color="indigo" data-gray-color="slate"
data-radius="medium" data-scaling="100%" …>`, **and that div is the scope every
custom property is declared on**. Nothing is bound at `:root`.

This is the docs/21 §4.2 trap in its purest form: mount without the wrapper and
the page still renders (component rules carry no literal fallbacks here, so it
would actually render *wrong*), but a `:root`-scoped variable read would return
`''` for all 1,091 names and the round would yield zero source facts in silence.
`mount.wrapperOpen` puts the Theme **around every stage**, so the Theme div is an
ANCESTOR of each captured root rather than a wrapper around one, and the
properties reach components by inheritance.

**The bind proof was run before any capture**, against the library alone:
`getComputedStyle(document.querySelector('.radix-themes'))` returns
`--accent-9: #3e63dd`, `--gray-1: #fcfcfd`, `--space-3: calc(12px * 1)`,
`--radius-3: calc(6px * 1 * 1)` — all four matching this directory's committed
DTCG file byte for byte.

### 4.3 `varPrefix` has to be `--`

Radix Themes' vocabulary is **unprefixed**: `--accent-9`, `--gray-a3`,
`--space-3`, `--radius-3`, `--shadow-2`. There is no narrower prefix that keeps
it, so the config takes the whole-vocabulary reader (`"--"`) — the same setting
the shadcn round uses, and the same consequence: any non-Radix custom property
on the page is a candidate too.

### 4.4 The ghost Card bleeds out of its own stage

`components.css`'s `.rt-variant-ghost` gives Card `margin-inline: -48px` at size
5, so a block-filling ghost Card measures **stage-inner + 96px** and a 16px
stage clips it on both sides. Card therefore gets its own stage with **48px
padding** — the largest size-5 padding — so the widest combo lands exactly
inside the stage box. This is a library fact (measured in the sandbox at
480×240/48: card width 480, no clip), not a tuning of anything downstream.

### 4.5 Child-axis deferrals (docs/21 §7.3)

`Tabs.List` carries its own `size`/`wrap`/`justify` axes and `TextField.Slot`
carries `side`. The axis grammar drives the **root** mount only, so those are
pinned at their source defaults and **deferred by name** — the same deferral the
shadcn round records for Select `size` and Tabs `variant`.

## 5 · Verified before commit

Run in the sandbox, with the library mounting itself and nothing of ours in the
loop:

- **10 / 10 components mount and render a root element**, at their default combo
  and again at their largest enum combo. **0 zero-boxes, 0 console errors, 0
  React warnings.**
- Screenshots of every mounted component are written to the git-ignored
  `.radix-themes-sandbox/heldout-verify/shots/`.
- The committed DTCG file was checked name-by-name against
  `getComputedStyle` on the live `.radix-themes` element: **1,091 names ·
  1,066 byte-identical · 15 differ by whitespace inside multi-line box-shadow
  strings · 6 differ by CSS quote style inside font stacks · 0 differ in value
  · 4 report empty** (`code-font-weight`, `em-font-weight`,
  `quote-font-weight`, `strong-font-style`).
- `loadConfig()` — the engine's own config validator, which reads the config and
  runs no capture — accepts `extract/computed/configs/radix-themes.json`.

## 6 · What has NOT been done, on purpose

No capture has run. `extract/computed/out/radix-themes/` does not exist, there
are no scorecards, no `contracts/`, no `figma/`, no emitted React. The minted
tree `tokens/radix-themes-minted.dtcg.json` is a committed **zero-leaf stub**
riding the documented `tokens.mintedBootstrap` allowance — this is a genuine
first-ever pass, and the exam is what fills it. The moment it carries leaves,
`loadConfig` refuses the stale allowance by name and the flag must be deleted.
