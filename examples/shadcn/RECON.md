# shadcn/ui round — RECON (pre-capture)

**Status: RECON ONLY.** The sandbox exists and is pinned, the static pass ran,
and the capture config is a **drafted, unreviewed proposal** —
`out/capture-config.draft.json` still carries `"__unreviewed-draft"` and every
`"__review:*"` marker, deliberately. This file records the proposed answers and
the reasoning; the config review gate (docs/21 §1) decides them. **No computed
capture has run.**

---

## 1 · Subject and pins

**shadcn/ui** — the most-installed "bring your own components" stack: Radix
primitives + Tailwind utility styling, distributed as **copy-in source via a
CLI**, not as an npm component package. That distribution model is the whole
recon story (§2).

Sandbox: `examples/shadcn/.shadcn-sandbox/` (git-ignored; recreate block below
is the source of truth, plus the sha256 ledger in §2.2 because a registry fetch
is not an npm pin).

| pin | value |
|---|---|
| shadcn CLI / `shadcn` pkg | **4.16.2** (`components.json` style **`radix-vega`**, baseColor `neutral`, cssVariables true, prefix `""`) |
| primitives | **`radix-ui` 1.6.7** (the unified package — shadcn 4.x imports `{ Slot, Switch, Dialog… } from "radix-ui"`, not per-primitive `@radix-ui/react-*`) |
| tailwindcss / @tailwindcss/cli / @tailwindcss/vite | **4.3.3** — same Tailwind pin as the Flowbite round (`extract/computed/configs/tailwind.json`), so every v4 reader lesson transfers verbatim |
| react / react-dom | 19.2.4 |
| class-variance-authority | 0.7.1 (cva variant maps) |
| tailwind-merge 3.6.0 · clsx 2.1.1 | the `cn()` class-merge pair |
| tw-animate-css | 1.4.0 (overlay open/close animations) |
| lucide-react | 1.30.0 (icon library) |
| @fontsource-variable/inter | 5.3.0 — **the webfont ships on npm**, so the capture `fonts` field can inline real Inter faces as `data:` URIs (docs/23 §C.5); no fallback-metrics caveat needed |
| vite 8.2.1 · typescript 7.0.2 · esbuild 0.27.3 | host app build; esbuild is what the capture harness invokes |

**Tailwind v4 vs v3: shadcn ships v4 today.** `components.json` has
`tailwind.config: ""` (no JS config file); the theme lives in
`src/index.css` (`@theme inline` + `:root` / `.dark` oklch variable blocks).
No config the capture needs beyond the deterministic CSS build in the
recreate block.

### Recreate (network-touching step; everything downstream is offline)

```bash
mkdir -p examples/shadcn/.shadcn-sandbox && cd examples/shadcn/.shadcn-sandbox
# minimal Vite/React host (the sandbox IS the host app shadcn installs into):
#   package.json, index.html, vite.config.ts (@tailwindcss/vite + "@"→./src alias),
#   tsconfig.json (baseUrl + "@/*" paths), src/{main.tsx,App.tsx,index.css}
npm i -E react@19.2.4 react-dom@19.2.4
npm i -E -D vite@8.2.1 @vitejs/plugin-react@6.0.5 tailwindcss@4.3.3 \
  @tailwindcss/vite@4.3.3 @tailwindcss/cli@4.3.3 typescript@7.0.2 \
  @types/react@19.2.18 @types/react-dom@19.2.4 esbuild@0.27.3
npx shadcn@4.16.2 init --yes --force -b radix -p vega --no-rtl --reinstall
npx shadcn@4.16.2 add button badge card alert checkbox switch input select \
  tabs tooltip dialog avatar --yes --overwrite
node -e "…re-pin every caret dep to its resolved version…" && npm install   # exact pins, committed-shape lockfile
npm i -E ./ui-pkg        # the barrel package — §2.1
# deterministic capture CSS (src/index.css with source(none) + @source "./src"):
npx @tailwindcss/cli -i capture-input.css -o tailwind.css
```

shadcn 4.x init facts worth recording: `-b` selects the **primitive library**
(`base` = Base UI, `radix`, `aria` = React Aria) and `-p` a named theme preset
(Vega/Maia/Lyra/Mira/Luma/Sera/Rhea/Custom). `radix + vega` is the 4.x
spelling of the classic default stack; the compiled `data-checked:` variants
target BOTH `[data-state="checked"]` (Radix) and `[data-checked]` (Base UI),
so the CSS is primitive-portable — we capture the Radix side.

---

## 2 · The distribution model — what "copy-in source" changes

### 2.1 docs/21 assumes `library.package`; shadcn has no installable package

The capture harness emits
`import { <importName> } from '<library.package>'` and bundles with the
**sandbox's own esbuild** (`extract/computed/capture.ts` — entry written to
`<harness>/computed-capture-page/`, built with `<harness>/node_modules/.bin/esbuild`).
shadcn's CLI vendors `.tsx` source into the host app (`src/components/ui/`);
there is nothing in `node_modules` to import.

**The sandbox IS the host app, so the sandbox provides the package**:
`.shadcn-sandbox/ui-pkg/` is a barrel (`@shadcn-sandbox/ui`, version 0.0.1)
re-exporting all 12 vendored modules, installed as an npm `file:` path
dependency (`npm i -E ./ui-pkg` → `node_modules/@shadcn-sandbox/ui` symlink —
survives `npm install`, unlike hand-created node_modules dirs).
**Smoke-proven**: an esbuild bundle of all 13 harness-shaped imports builds
clean; the components' internal `@/lib/utils` imports resolve because esbuild
reads the sandbox `tsconfig.json` paths. No engine change needed — this is a
sandbox-construction answer, same class as the Tailwind round's prebuilt
`tailwind.css`.

Consequence for `library.version`: the runner's version-drift refusal will pin
the **barrel's** 0.0.1, which is honest but weak — the real pin is §2.2.

### 2.2 The registry fetch is not reproducible — hash the vendored source

`npm i @carbon/react@1.112.0` is a pin. `npx shadcn add button` is a **fetch
from ui.shadcn.com's live registry** — no version, no determinable registry
commit (the CLI records nothing; `components.json` carries no lockfile).
Re-running the recreate block on a later day may vendor different bytes.
So the vendored sources get a ledger; a re-run that hashes differently is a
**named registry drift**, not a silent one (fetched 2026-08-08, CLI 4.16.2):

```
26142e6f255d291475046412fd47b6054294f244f531636e40e57d5fdd3bbbf3  src/components/ui/alert.tsx
fd03e439ae00bf718834132df24072b58a6019538329d4db47f874f247d428fc  src/components/ui/avatar.tsx
1b292cd64608eef62eab1e43621071b32f794988a8c4e40fd1086cfbf8d9ef5d  src/components/ui/badge.tsx
972808a00bd6fe16935206ec74197f724a31375731737d19694bbb3b6f265050  src/components/ui/button.tsx
3a84e2190990034c3e0c21dc432e7e978cfd62648e1c7af8e1fe8f103ac8ea7b  src/components/ui/card.tsx
2f5f0c90bce6753d7ba68534c006419be0f05758b913f0ea4c41c380a5cf6366  src/components/ui/checkbox.tsx
fd0f575f9b1568fc6a8b5b6cbb631e713392e5c87fd2d4368b925809480b2023  src/components/ui/dialog.tsx
b1bf46325d82506aa9cd60c32f5f93fa220643b7f1225671190a46b86ef9db69  src/components/ui/input.tsx
ac7816deba31a33839b80cd672528bfe88625b59646f7c39d846c3f384043cb7  src/components/ui/select.tsx
83e792b28bb04b1ac4dbde44ccdd38a918e1ddca1dcd90113f68f2905ab7311d  src/components/ui/switch.tsx
aaf120d89dc75b94b5647eda35573dbf5f800c04c9d91db4dd6503e013d86bf8  src/components/ui/tabs.tsx
81569280cdd3c9a60063b4391909922e08a8521fdbd1f2040589ef807be65833  src/components/ui/tooltip.tsx
7c8c3dfc0cdd370d44932828eb067ef771c8fe7996693221d5d4b90af6d54f2d  src/lib/utils.ts
5ad8b87c7bcaf1f71a9a751563648be6f85ba6dccb6071274781231fa5fd1d73  src/index.css
```

**Open question for the review**: whether to promote the vendored 14 files into
a committed `examples/shadcn/registry-snapshot/` so the round is byte-recreatable
without the live registry (the shadcn license is permissive; the sandbox rule
"git-ignored, PROVENANCE recreates it" was written for npm pins and this library
breaks its premise). Recommended: yes, at capture time.

### 2.3 A user's shadcn is not registry shadcn — scope the claim

Copy-in source is *designed to be edited*. This round captures the registry's
bytes at a pinned fetch; a real adopter's `button.tsx` may have drifted from
the registry. That is a **feature** for this pipeline (we capture *their* source
— the same recipe applies), but the coverage claim must say "shadcn registry
defaults as of the ledger above", never "shadcn users' components".

---

## 3 · Static extract — what the react-tsx adapter got

`npm run extract:code -- examples/shadcn/extract.config.json` →
`out/{code-extraction.json, contracts/*.contract.json, proposals.md}`.
Result: **10 extracted / 40 seen-but-not-extractable (all named)** — API
surface only, anatomy stubs everywhere (Tailwind classes, no CSS Modules), as
the Tailwind-round precedent predicts. The pleasant surprise: the adapter
**resolves cva `VariantProps` to declared enums with defaults** — the variant
vocabulary came back complete, confidence `declared`, on every cva component.

| target | extracted as | props recovered | note |
|---|---|---|---|
| button | `Button` | `variant` enum ×6 (default…link), `size` enum ×9 (default, xs, sm, lg, icon×4), `asChild` bool — all declared, defaults right | cva resolved fully |
| badge | `Badge` | `variant` enum ×6, `asChild` | cva resolved |
| alert | `Alert` | `variant` enum ×2 (default, destructive) | cva; `AlertTitle`/`AlertDescription`/`AlertAction` in the named-skip list |
| card | `Card` | `size` enum ×2 (default, sm) | inline literal type; Card family subcomponents skipped by name |
| avatar | `Avatar` | `size` enum ×3 (default, sm, lg) | `AvatarImage`/`AvatarFallback` skipped (Radix-typed) |
| switch | `Switch` | `size` enum ×2 (sm, default) | `checked` invisible — lives in `ComponentProps<typeof SwitchPrimitive.Root>` |
| select | `SelectTrigger` only | `size` enum ×2 | `Select` root, Content, Item… all Radix-typed → skipped by name |
| tabs | `TabsList` only | `variant` enum ×2 (default, line) | `Tabs` root / `TabsTrigger` / `TabsContent` skipped |
| dialog | `DialogContent`, `DialogFooter` | `showCloseButton` bool each (source-true: Content defaults true, Footer false) | `Dialog` root / overlay / trigger skipped |
| checkbox | — | none | 100% Radix-typed: zero local prop members → in the named-skip list |
| input | — | none | `React.ComponentProps<"input">` only → skipped |
| tooltip | — | none | all four exports Radix-typed → skipped |

The structural law this table shows: **local cva/type members extract; anything
typed purely by `React.ComponentProps<typeof RadixPrimitive.X>` does not**
(single-file extraction, refused by name — the hollow-extraction receipt
working). So the seed contracts for checkbox/input/tooltip/dialog-root/select
must be **hand-authored from the Radix prop surface** at capture-config time —
same as every prior round's seeds, just with a thinner static head start.

Also recorded: the drafter emitted `"unsetLabel": "unset"` — the docs/21 §5.1
"KNOWN BUG (drafter writes `__unset`)" appears **fixed at HEAD**; docs/21 §5.1
and docs/23 §B.16 should be re-verified and updated in whatever round touches
them next.

---

## 4 · Proposed capture config — answers + reasoning (markers stay until review)

`out/capture-config.draft.json` is untouched machine output. The proposal
below is what this recon would write after the gate; every §4-class decision
has its reasoning attached. **The `__review` markers and the
`__unreviewed-draft` key are still in place in the draft — the reviewing
session deletes them, not this one.**

### 4.1 The three that fail quietly

| field | proposed | reasoning |
|---|---|---|
| `library.classAllow` | **`"^$"` (keep none)** | Same doctrine as the Flowbite/Tailwind row in docs/21 §4.1: every class is a utility (styling), none is identity. shadcn adds two non-utility class families — `group/button`-style named groups and cva's merged blobs — both vary per combo or carry no part identity. Part identity in the DOM actually rides **`data-slot` attributes** (`data-slot="switch-thumb"` on every element — a shadcn 4.x invariant), which the signature grammar has no field for today; geometry/DOM identity sufficed for Flowbite and should here. If parts refuse to align, `data-slot` is the natural future signature key — noted, not needed yet. |
| `library.varPrefix` | **`"--"`** | Tailwind v4 IS a CSS-variables system (the tw round's load-bearing discovery). shadcn's `@theme inline` makes utilities reference the **semantic** variable directly: built CSS shows `.bg-primary { background-color: var(--primary) }` — one hop to `:root { --primary: oklch(…) }`. So bound names are shadcn's own semantic vocabulary (`primary`, `background`, `ring`, `radius-md`, `text-sm`…), which is exactly the token story we want on canvas. **Bind proof (recon-level)**: the semantic block is `:root`-scoped in the built `tailwind.css` (line ~1739), NOT class-scoped like Carbon's themes — no provider needed for variables to resolve. Browser-level `getComputedStyle` probe still runs at capture time per §4.2 discipline. |
| `mount` | `imports: ["import '../tailwind.css';"]` · `wrapperOpen: "<TooltipProvider>"` · `wrapperClose: "</TooltipProvider>"` | Prebuilt deterministic CSS, inlined by the harness (`file://` linked-sheet CSSOM opacity — the tw round's lesson). TooltipProvider is required by shadcn's own install note for Tooltip and is context-only (renders no DOM box), so wrapping **every** stage is safe — verify on the review screenshot that no wrapper box appears. |

### 4.2 Axis-vs-state and per-component proposals

Closed state vocabulary drives `hover/active/focus-visible/disabled` planes;
**every Radix `data-state` rendering is prop-selected → axis** (the
checked-is-an-axis doctrine, enforced by `loadConfig`).

| component | axes (× values) | stateProps | key fixedProps / drivers | portal | composition |
|---|---|---|---|---|---|
| Button | `variant`×6, `size`×9 = 54 combos | `disabled` | `asChild` pinned false (default) | — | text |
| Badge | `variant`×6 | — (no disabled surface) | `asChild` false | — | text |
| Card | `size`×2 | — | — | — | `childrenSpec`: CardHeader ⊃ (CardTitle, CardDescription), CardContent text |
| Alert | `variant`×2 | — | — | — | `childrenSpec`: AlertTitle + AlertDescription text |
| Checkbox | `checked` axis: `unchecked:false / checked:true / indeterminate:"indeterminate"` (one axis, tri-state — the MUI one-axis discipline, keeps the lucide CheckIcon svg-content promotion single-axis) | `disabled` | `callbackProps: ["onCheckedChange"]`, `fixedProps: {"id":"shadcn-checkbox"}` | — | none (Indicator is internal) |
| Switch | `size`×2, `checked`×2 = 4 | `disabled` | `onCheckedChange` stub, controlled `checked` via axis | — | thumb is a **real DOM child** (`SwitchPrimitive.Thumb`), not Flowbite's `::after` — the knob should finally promote (hazard H6) |
| Input | — (v1: default text input) | `disabled` | `fixedProps: {"placeholder":"Value","defaultValue":""}`; `type` deferred by name (attribute, not enum prop in source) | — | none |
| Select | `size`×2 on trigger | `disabled` | root `openDriver: {"open": true}` + controlled `value` + `onValueChange` stub | **yes** | Trigger+Value, Content ⊃ 3 × Item — needs a hand seed; **mount is the composed `Select` root**, and the axis prop `size` lives on the *child* Trigger → **child-axis limitation (docs/21 §7.3) — pin `size` and defer the axis by name**, or capture `SelectTrigger` closed as its own component (recommended v1: both — Trigger as a plain component for the closed surface, root as portalCapture for the open list) |
| Tabs | `variant`×2 (on TabsList) | — | controlled `value:"tab-1"` + `onValueChange` stub (the Carbon TabList double-run lesson) | — | Root ⊃ TabsList ⊃ 3 × TabsTrigger, TabsContent — same child-axis caveat as Select; v1 captures TabsList-with-children as the mount |
| Tooltip | — | — | `openDriver: {"open": true}` on Tooltip root; Provider in wrapper | **yes** | Trigger (Button) + Content text |
| Dialog | — | — | `openDriver: {"open": true}`, `showCloseButton` as `presenceProp` on Content | **yes** | Content ⊃ Header(Title, Description) + Footer |
| Avatar | `size`×3 | — | — | — | `childrenSpec`: AvatarFallback text ONLY — `AvatarImage` needs a remote/blob src, refused in a network-free harness **by name** (fallback-only capture is Radix-canonical anyway: Image renders nothing until load) |

`enumeration`: `cartesianLimit: 512` (Button's 54×state-planes is the max),
`unsetLabel: "unset"`. `browser`/`stage`: repo defaults; Dialog gets a taller
per-component `stage` and `blockStage` review at capture (Content is
`fixed`-positioned — portal reader handles it). `sampleText: ""` for
Checkbox/Switch/Input/Avatar (the Carbon empty-children engine fix already
landed). `fonts.faces`: Inter Variable from
`node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2`
(npm-shipped → data: URI, zero network).

`tokens`: build `examples/shadcn/tokens/shadcn.dtcg.json` from the built CSS's
`:root` blocks (retarget `examples/tailwind/scripts/build-tokens.mjs` — same
oklch→hex path): the ~30-leaf shadcn semantic block (`--background` …
`--sidebar-ring`, `--radius`) + the Tailwind theme vars the build emits
(`--text-sm`, `--spacing`, `--radius-md`, `--font-sans`…, ~63 declarations
total). `.dark` block → `modes/shadcn.dark.dtcg.json` for the bundle (capture
itself is single-mode light).

---

## 5 · Hazard ledger — predicted refusal classes, defect-first

- **H1 · oklch colors — supported, not a refusal.** v4 themes are oklch;
  Chromium keeps the space in computed values. The tw round's deterministic
  `oklchToRgba` (shared in `core/token-set.js`) already feeds minting,
  verification, and the token wrap. shadcn adds nothing new here.
- **H2 · Alpha-modified utilities will NOT bind token names.** Every `/NN`
  modifier (`hover:bg-primary/80`, `bg-destructive/10`, `ring-ring/50` —
  pervasive in shadcn, especially hover planes and destructive variants)
  compiles to `color-mix(in oklab, var(--primary) 80%, transparent)`. The
  computed value (oklab cartesian — `oklabToRgba` handles the *parse*, from
  the scrim round) can never equal any candidate var's resolved value, so the
  CSS-vars reader binds nothing → **minted literals with correct pixels, by
  design**. Predict: hover/destructive planes largely anonymous; base planes
  (`bg-primary`, `text-sm`, `border-input`) bind. Write the referenced-vs-
  bound family split into PROVENANCE (§4.4 idiom), don't "fix" the reader.
- **H3 · Portals (Select, Tooltip, Dialog) — docs/23 §B.1 + §B.2 apply
  verbatim.** `portalCapture` + `openDriver` gets the DOM; the standing
  `portalSweep`-takes-no-`varPrefix` defect means **zero source facts** for
  all three (anonymous literals where `--popover` has a name), and no state
  planes (`states: []`, pinned by contract). Also §B.1's read-boundary note:
  their receipts will say NOT READ. Budget: 3 of 12 components overlay-heavy —
  named degradation, already documented corpus-wide, do not re-litigate.
- **H4 · Radix `data-state` drives styling, props drive `data-state`.**
  `data-checked:bg-primary` etc. are prop-selected renderings → axes
  (§4.2), never `stateProps`. The compiled selectors also target Base UI's
  `[data-checked]` spelling — irrelevant at capture (Radix side mounted) but
  worth knowing when someone brings a `-b base` sandbox: same CSS, different
  state attributes → the axis story transfers, the config does not.
- **H5 · Dark mode is a class scope, not a mode the capture sees.**
  `@custom-variant dark (&:is(.dark *))` → every `dark:` rule needs a `.dark`
  ancestor; inert in the light capture (correct). Dark becomes
  `modes/shadcn.dark.dtcg.json` from the `.dark` block, Carbon-style, at
  bundle time. **Do not** mount `.dark` as a second capture — one mode is the
  floor's contract.
- **H6 · Switch thumb — better DOM than Flowbite, one new spelling risk.**
  The thumb is a real element (aligned part — the Flowbite `::after` blockers
  don't apply), but its checked offset is
  `translate-x-[calc(100%-2px)]` — the tw round's translate-longhand
  decomposition bakes plain `100%` against the element's own border box;
  whether it resolves a **`calc(% − px)` mix** is unverified. If not, that's a
  named refusal on `translate-x` (and the knob still promotes its box/color).
  Check `captured-truth.json` for the thumb part before promoting. The offset
  is again `Size × Checked`-shaped, but via group selectors on ONE property —
  if calc resolves, each combo captures a plain per-combo value and planes
  normally (unlike Flowbite: no pseudo synthesis needed).
- **H7 · tw-animate-css (open/close animations).** Dialog/Tooltip animate on
  `data-open` (100–150ms, `--default-transition-duration: 150ms`) — inside
  the steady-state probe's 1.5s budget, so no capture flake predicted; the
  fidelity gate's flat 30ms mid-transition sampling (docs/21 §7.6) may need a
  Carbon-style measured per-component `tolerance`.
- **H8 · `cn()` runtime class merging is an anatomy non-issue at capture**
  (we mount defaults; tailwind-merge only dedupes what cva emits) but it is
  why `classAllow` has no identity classes to keep: the merged blob is
  per-combo by construction. `^$` and geometry identity, per §4.1.
- **H9 · Random ids / double-run identity.** Radix uses React `useId`
  (deterministic per tree position) — no nanoid class of flake predicted;
  Checkbox/Switch still get pinned `id` fixedProps per house rule (witnessed
  pins only — if the double run passes without them, drop them and say so).
- **H10 · Container queries in Card** (`@container/card-header`) and
  `has-data-[slot=…]` relational selectors: computed truth captures their
  *outcome* at the mounted composition; the risk is anatomy that changes when
  a reviewer's composition differs from the canonical `childrenSpec`. Pin one
  canonical composition (§4.2) and name any others out of scope.

### Per-component captureability prediction (docs/22 matrix idiom)

| component | prediction | why |
|---|---|---|
| Button | **full** | 54 combos, 4 state planes, semantic vars bind; hover plane literals (H2) |
| Badge | **full** | tw-round Badge was the 100%-pixel row; same shape |
| Card | **good, spacing residue** | tw-round Card floor was 72.4%; shadcn Card adds container-query context (H10) |
| Alert | **full** | 2 variants, composed text children |
| Checkbox | **full incl. tri-state glyphs** | one-axis discipline keeps svg-content promotion legal |
| Switch | **full box/color; thumb offset = the H6 question** | real-DOM thumb is strictly better than the Flowbite counterpart |
| Input | **full** | single element, real `:disabled`/`:focus-visible` |
| Select | **split**: Trigger full · open list degraded (H3) | child-axis limitation on `size` if root-mounted |
| Tabs | **good** | controlled value pin mandatory (Carbon lesson) |
| Tooltip | **degraded by design** | portal: no states, no source names (H3) |
| Dialog | **degraded by design** | portal + full-bleed overlay; `showCloseButton` presenceProp |
| Avatar | **fallback-only, by name** | AvatarImage refused in a network-free harness |

---

## 6 · Capture-phase command sequence (after config approval)

```bash
# 0 · gate: reviewer edits examples/shadcn/out/capture-config.draft.json →
#     answers every "__review:*", deletes each marker, deletes "__unreviewed-draft",
#     saves as extract/computed/configs/shadcn.json; hand-author seed contracts
#     (examples/shadcn/contracts-seed/) for the Radix-typed components (§3)
# 1 · tokens (retargeted tw wrap: built-CSS :root vars → DTCG, oklch→hex, .dark → modes/)
node examples/shadcn/scripts/build-tokens.mjs
# 2 · bind probe before any sweep (docs/21 §4.2):
#     getComputedStyle(document.documentElement).getPropertyValue('--primary')  → oklch(…) not ''
# 3 · capture — full sweep, double-run byte-identity required
npm run extract:computed -- --harness examples/shadcn/.shadcn-sandbox \
  --config extract/computed/configs/shadcn.json --out extract/computed/out/shadcn
# 4 · promote (generalized verb + per-library manifest)
ds-contracts promote --config examples/shadcn/ds-library.json
# 5 · emit + receipts + genesis
npx tsx packages/cli/src/cli.ts figma examples/shadcn/contracts --out examples/shadcn/figma \
  --tokens examples/shadcn/tokens/shadcn.dtcg.json,examples/shadcn/tokens/shadcn-minted.dtcg.json
node examples/shadcn/scripts/build-figma-tokens.mjs
node examples/shadcn/scripts/figma-compile-receipt.mjs
node examples/shadcn/scripts/build-genesis-batch.mjs
# 6 · bundle — the ONE paste
npx tsx packages/cli/src/cli.ts figma bundle examples/shadcn/contracts \
  --tokens examples/shadcn/tokens/shadcn.dtcg.json,examples/shadcn/tokens/shadcn-minted.dtcg.json \
  --modes examples/shadcn/tokens/modes/shadcn.light.dtcg.json,examples/shadcn/tokens/modes/shadcn.dark.dtcg.json \
  --name Shadcn --out examples/shadcn/figma/shadcn.bundle.json
# 7 · gates
npm run extract:computed:scorecard -- --dir extract/computed/out/shadcn \
  --config extract/computed/configs/shadcn.json --write
npm run eval && npm run plugin:check && npx tsc --noEmit
```

Alternatively steps 3–7 are one `ds-contracts onboard --continue` once a
`ds-library.json` manifest exists (copy Carbon's, retarget).

## 7 · Coverage denominator (honest slice)

12 of ~50+ registry components, hand-picked for value density. The registry
also ships blocks/charts/sidebar organisms — out of scope for this round by
name.
