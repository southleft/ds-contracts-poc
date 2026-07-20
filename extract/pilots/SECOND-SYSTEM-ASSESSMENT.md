# SECOND-SYSTEM ASSESSMENT — Astryx (Meta) · Fluent 2 · Nord Health · Spectrum, hands-on, for the second exhibit

> **What this document is.** The owner named four candidates for the next design-system
> exhibit — the generalization test beyond Polaris: *"Asterix by Meta, Fluent by Microsoft,
> Nord Health, Spectrum by Adobe — all available via NPM with fairly robust documentation."*
> All four were assessed hands-on on 2026-07-20: the two NEW candidates (Meta's system and
> Nord) were npm-installed into the session scratchpad and pushed through the REAL pipeline
> (`npm run extract:code`, the token wrap helper, and a Playwright shadow-DOM probe for
> Nord); Fluent and Spectrum were version-refreshed against the ENTERPRISE-GAUNTLET baseline.
> This file is the only repo write; nothing is committed. Scratchpad:
> `…/scratchpad/second-system/` (configs, outputs, probe scripts).

## 1. The "Asterix" truth

**"Asterix by Meta" does not exist under that name — but it is not a phantom.** The system
is **Astryx** (facebook/astryx, `@astryxdesign/*` on npm), Meta's internal design system of
the last ~8 years (150+ components, "13,000+ apps"), open-sourced **2026-06-18** under
**MIT**. `npm search asterix` returns radar-data parsers and comic-book ebook spam; the real
packages are `@astryxdesign/core@0.1.6`, `@astryxdesign/cli`, `@astryxdesign/theme-*` (10
themes). Docs: https://astryx.atmeta.com/components; repo: https://github.com/facebook/astryx.
React + StyleX, explicitly "agent-ready": every component ships a machine-readable
`.doc.mjs` (props table, examples, **an anatomy table**) plus a docs CLI/MCP server. It is
**beta** (0.1.x — pin the version in any exhibit). Nothing was substituted silently: the
owner's spelling maps to exactly one real system, and everything below used that system.

## 2. npm reality, versions, deltas vs the gauntlet

| System | Package(s) verified | Version (2026-07-20) | License | Delta vs gauntlet (2026-07-12) |
|---|---|---|---|---|
| Astryx | `@astryxdesign/core`, `@astryxdesign/theme-neutral`, `@astryxdesign/cli` | 0.1.6 | **MIT** | new — never run before |
| Nord Health | `@nordhealth/components` + `@nordhealth/css@5.2.3` + `@nordhealth/tokens@9.0.3` | 5.0.3 | **PROPRIETARY** (see §6 — this is disqualifying for a public exhibit) | new — never run before |
| Fluent 2 | `@fluentui/react-components` | 9.74.4 | MIT | version moved; the 23/23 census recovery is pinned in-repo by the `fluent-sibling-types-merge` eval (`evals/run.ts:655`) — no re-run performed, no regression signal |
| Spectrum SWC | `@spectrum-web-components/*` | **1.12.2 — identical to the gauntlet run** | Apache-2.0 | zero delta; 22/22 census stands as measured |

## 3. Hands-on extraction census (the two new systems, REAL runs)

Same 25-category census as ENTERPRISE-GAUNTLET §1, mapped to each system's names.
Configs: `{ code: { adapter, root|manifest }, idPrefix, out }`; unmodified pipeline at the
current working tree.

### Nord (`cem` adapter on the SHIPPED `custom-elements.json` — no clone needed)

Manifest: schemaVersion 1.0.0, 306 modules, 1,248 declarations, **118 custom elements**,
113 events with **0 nameless** (the class-G crash Spectrum hit cannot occur here — and the
adapter has since been hardened to receipt nameless events anyway).

- **Whole library: 187 extracted → 187 proposed (all schema-valid), 8 named skips** — every
  skip is a CEM `mixin` declaration, receipted as "not a custom element; its surface is
  carried by the classes that apply it". 43 of the 187 are 0-prop, but nearly all are
  controller/event/interface classes riding along in the manifest (the class-G phantom-class
  noise — a customElement filter would show ~118 real elements).
- **Census: attempted 22 (no breadcrumb/stepper/link), proposed 22/22, hollow 0.**
- **Median facts-carried: 100%** (min 57%, `Input` 17/30) — **the best number any system has
  posted against this pipeline** (Carbon 78%, SWC 73%, Polaris 57%, Fluent post-fix ~90%).
  CEM-with-good-hygiene is exactly the adapter's sweet spot: `nord-button` carries
  variant(5 values)/size(s|m|l)/type/target as real enums WITH defaults.
- Untapped manifest channels, verified unread by `extract/adapters/cem.ts`: `nord-button`
  alone ships **14 cssProperties + 3 slots** (0 cssParts) — a styling/slot channel the
  adapter does not read today (delta item §7).

### Astryx (`react-tsx` adapter on `node_modules/@astryxdesign/core/src` — the npm package SHIPS its TSX source, 375 files; extraction runs against the exact shipped artifact, no clone)

- **Whole library: 216 extracted → 216 proposed (all schema-valid), 21 named skips** —
  every skip receipted (union-of-named-refs: Slider, Calendar, ContextMenu, DropdownMenu,
  NumberInput, Selector, ToggleButtonGroup; cross-file props: LazyXDSTooltip,
  PowerSearch internals, BaseTable row/cell renderers). **Zero silent-hollow**: the one
  0-prop census extraction (Table) carries the receipt "props type composes named
  reference(s) [TableProps<T>] whose members are outside module scope". The post-gauntlet
  legibility fixes visibly hold on a foreign system: what defeated the adapter is *named*,
  never dropped.
- **Census: attempted 24 (no stepper; slider attempted but named-skip), proposed 23, hollow
  1 (Table, receipted).** Judgment calls: menu→`MoreMenu` (ContextMenu/DropdownMenu are
  named skips), select→`Typeahead`, tag→`Token`, accordion→`CollapsibleGroup`.
- **Median facts-carried: 57%** (Polaris-level). The loss is concentrated and *diagnosed*:
  Astryx types its headline axes as `keyof` aliases — `type ButtonVariant = keyof
  ButtonVariantMap` (an in-file interface with keys primary/secondary/ghost/destructive,
  designed for module augmentation) and `type ButtonSize = keyof typeof sizeStyles` (keys of
  the in-file `stylex.create` object). Both land as kind `other`. This is a NEW but bounded
  enum-legibility class — the exact analog of Carbon's `(typeof X)[number]` (gauntlet
  change #4): the values are in the same file, one `keyof` resolution away.
- **Unique cross-check channel:** the shipped per-component `.doc.mjs` (e.g.
  `docs.mjs Button`) prints a props table AND an **anatomy table** (Icon/Label/End
  content/Spinner with required flags) — vendor-published ground truth this pipeline has
  never had. It can referee our extraction *and* seed the human-owned anatomy step.

## 4. Token publication + wrap-helper results (both run through `tokenCorpusFromJson`)

| | Format as published | DTCG? | Wrap result |
|---|---|---|---|
| Nord | `@nordhealth/tokens` Style Dictionary multi-format (`.json` flat `n_color_accent: "rgb(…)"` maps + `.custom-properties.css` + scss/less/android/ios); base = 188 tokens (60 color + 128 core); **2 brands (nord, vet) × light/dark/high-contrast mode files** | No | Mechanical `$value` wrap under root `n` → 60-token corpus loads; dot-paths hyphen-join to the LIVE `--n-*` vars (probe-confirmed). `rgb()` values hit the known `suggestFor` normalizer gap (gauntlet §4, unchanged) |
| Astryx | `tokens.stylex.ts` — 13 `*Defaults` object literals (**186 tokens**), values use **CSS `light-dark(#hex, #hex)`**; `@astryxdesign/theme-neutral/dist/theme.css` ships **178 literal custom properties** (`--color-accent`, `--spacing-2`, …) — stable names, not hashed | No | Mechanical wrap of the `*Defaults` literals → 186-token corpus loads. `light-dark()` needs a mode-splitting normalizer (new, small) — and is itself a THIRD mode architecture (value-encoded dual mode vs Carbon's parallel themes vs Nord's parallel files): excellent P17/§3 mode-corroboration material |

`TokenCorpusInput` still hard-codes the repo's 4-tree layout (verified at
`core/token-corpus.ts:45–56`) — gauntlet named-limit #1 is unchanged; both wraps shoehorned
into `semantic`.

## 5. Styling architecture + computed-floor reachability

**Nord (probed in Playwright — 3 components mounted from the real npm bundle):**
`nord-button`, `nord-badge`, `nord-input` all render with **open shadow roots**; styles
arrive via **constructable `adoptedStyleSheets`** (2–4 per component, zero `<style>` tags);
`getComputedStyle` reads cleanly through the boundary — `nord-button[variant=primary]`'s
inner `<button>` reads `background rgb(53,89,199)` = exactly `--n-color-accent`, which also
resolves as a live custom property on the host. **The computed floor is physically
reachable.** What's missing is machinery, not access: the floor's mount adapter is
**React-only** (named limit in `extract/computed/README.md`: custom elements are "designed
(`extract/adapters/cem.ts` supplies the attribute space) but not built"), and capture's DOM
walk does not traverse shadow roots. No `::part` attributes (0 cssParts in the manifest), so
part naming would come from shadow-tree structure.

**Astryx:** React + StyleX = compile-time **atomic hashed classnames**, no CSS modules, no
shadow DOM. The static anatomy channel (css-module adapter) never opens — but the computed
floor **works today**: the React mount recipe is the one adapter that exists, and the
package ships `dist/astryx.css` + theme CSS for a two-import mount. One real friction:
`nameUnion` (`extract/computed/anatomy.ts:176`) falls back to **class stems** for part
names — StyleX hashes give it nothing, so atomic-CSS libraries need a tag/role-based
fallback (bounded change; root/icon/label heuristics already don't use classes).

**Fluent (griffel, runtime CSS-in-JS)** and **Spectrum SWC (Lit shadow CSS)**: unchanged
from gauntlet §3 — griffel needs the change-#7 style harvest; SWC needs the same
custom-elements mount work as Nord.

## 6. The four-way ranking

| Criterion | Astryx | Fluent 2 | Nord | Spectrum SWC |
|---|---|---|---|---|
| (a) Architectural difference from Polaris (React + CSS modules) | **Medium-high** — same framework, but StyleX compile-time atomic CSS (never exercised), `light-dark()` value-encoded modes, `keyof`-augmentable enum vocabularies, vendor-shipped machine-readable docs | Medium — React + griffel CSS-in-JS, slots maps | **High** — Lit shadow DOM, constructable sheets, attribute API, CEM, multi-brand tokens | **High** — Lit shadow DOM, CEM (same class as Nord) |
| (b) Extraction readiness TODAY (real numbers) | 216/216 proposed, census 23/24, 1 receipted hollow, median 57% (bounded `keyof` fix recovers headline axes) | 23/23 census (pinned by eval) | **22/22, 0 hollow, median 100%** — best ever measured | 22/22, median 73% |
| (c) Token architecture difference | **High** — StyleX defineVars + light-dark(), 10 theme packages | Medium — JS-module themes (wrapped in gauntlet) | **High** — 2 brands × 3 modes, multi-format SD | Medium-high — `sets` JSON, 2,469 tokens |
| (d) Docs for ground truth | **Strong** — 150+ component pages, "copy-ready examples for every variant, state", playground, PLUS shipped `.doc.mjs` props+anatomy tables; Figma kit is **unofficial community** (v0.14) | Strong — public storybook + official Figma kit | Strong — 60+ component pages, playground, official Figma Toolkit | Strong — docs site + storybook; community Figma kit only |
| (e) License cleanliness | **MIT** | MIT | **FAIL** — proprietary: use granted "solely for the purpose of performing your duties for and on behalf of Nordhealth" | Apache-2.0 |

**The Nord license, plainly:** `@nordhealth/components/LICENSE.md` grants a license only to
people working *for Nordhealth*, and forbids reproduction/publication otherwise. For a
project whose stated mission is 100%-open-source public exhibits, Nord is **disqualified as
a public showcase subject** regardless of posting the best extraction numbers ever measured
against this pipeline. (It remains legitimate as *private* generalization evidence, or with
explicit written permission from Nordhealth — an owner decision, not assumed here.)

## 7. Recommendation

**Full showcase treatment: Astryx.** The reasoning, in priority order:

1. **The whole showcase runs without building a new mount adapter.** Floor captures →
   contracts → both-surface gates → canvas build needs the computed floor, and the floor's
   mount recipe is React-only today. Astryx is the only license-clean candidate where phase
   A starts this week on config + bounded adapter fixes; both shadow-DOM candidates first
   need the custom-elements mount adapter built.
2. **It still genuinely generalizes**: StyleX atomic CSS (no styling channel Polaris
   exercised), `light-dark()` mode encoding, `keyof`-based enum vocabularies, and
   npm-shipped TSX source (extraction provenance = the exact shipped artifact) are all new
   to the pipeline — and the shipped `.doc.mjs` anatomy/props tables enable a
   **vendor-ground-truth referee** no other system offers.
3. **Story value is exceptional**: Meta open-sourced it four weeks ago as *the* AI-legible
   design system (manifest + MCP), press reports early adopters including Figma — an
   exhibit showing machine-readable *contracts* extracted from the system built to be
   machine-readable writes itself. Risk to name: it is beta (0.1.6) — pin the version and
   expect API churn.
4. Its census weakness (57% median) is not a wall but the showcase's *first act*: the
   `keyof` enum class is one bounded adapter change (gauntlet change-#4 analog), measured
   here with named examples, and the before/after is the kind of confidence artifact the
   refocus memo asks for.

**Runner-up: Spectrum SWC** — it adds the thing Astryx can't: the shadow-DOM/custom-elements
generalization (mount adapter + shadow traversal + CEM cssProperties/slots channels), with a
clean Apache-2.0 license, 22/22 census already banked, and official docs. Build the
custom-elements mount adapter against SWC later and the same machinery covers Nord (should
permission ever arrive), Shoelace, and every Lit/FAST shop. **Fluent** third (griffel
harvest, change #7). **Nord**: best numbers, blocked exhibit — keep the probe results as
internal evidence that CEM+shadow-DOM systems are within reach.

## 8. Delta work — Polaris-shaped vs general

**Already general (no changes needed):** `extract:code` adapters/propose/diagnose (both new
systems ran unmodified), the computed-floor engine (capture/fuse/replay/gate — all
config-driven), the eval harness, both-surface gate machinery.

**Polaris-shaped pieces exposed by this assessment (the named build list for Astryx):**

1. **`extract/computed/configs/astryx.json`** — the per-library mount recipe. Draft shape:
   `library: { package: "@astryxdesign/core", version: "0.1.6", framework: "react",
   classPrefix: "" }`; `mount.imports`: `import '@astryxdesign/core/dist/astryx.css'` +
   `import '@astryxdesign/theme-neutral/dist/theme.css'` + named component imports; wrapper
   likely none (verify whether `Theme`/provider is required — Next.js quick start suggests
   CSS-only). Prop-space source: the static contracts from §3's run.
2. **Part-naming fallback for atomic CSS** — `nameUnion`/`stems`
   (`extract/computed/anatomy.ts:176`) falls back to class stems; with StyleX hashes it
   needs a tag/role/aria-based fallback. Bounded.
3. **`react-tsx`: `keyof` enum resolution** — `keyof InterfaceLiteral` (in-file interface
   keys) and `keyof typeof objectLiteral` (in-file object keys) → enum values. Recovers
   Astryx's variant/size axes library-wide; direct analog of gauntlet change #4.
4. **Union-of-named-refs composition** (same-file unions like
   `SliderSingleProps | SliderRangeProps`) — converts 7 of the 21 named skips; the
   mutually-exclusive-API sibling of gauntlet change #3.
5. **Token side:** a StyleX-defaults/`theme.css` reader (the BYO-token adapter layer,
   gauntlet change #6 — both wraps above were mechanical) + `light-dark()` mode splitting in
   the normalizer; free the 4-tree `TokenCorpusInput` (unchanged named limit).
6. **`.doc.mjs` referee (optional, high showcase value):** parse the shipped docs manifest
   and diff it against our extraction — vendor ground truth as a second referee surface.

**For the runner-up track (SWC, later):** custom-elements mount adapter (designed, not
built — `extract/computed/README.md` names it), shadow-root traversal in capture's DOM walk,
CEM `cssProperties`/`slots`/`cssParts` channels (verified unread in
`extract/adapters/cem.ts`), customElement filter for manifest phantom classes.

## 9. Phase A — exact first commands (Astryx)

```bash
# 1. Harness sandbox OUTSIDE the repo (verify.ts pattern), version-pinned:
mkdir -p ~/exhibits/astryx && cd ~/exhibits/astryx
npm init -y
npm install @astryxdesign/core@0.1.6 @astryxdesign/theme-neutral@0.1.6 \
            react@18 react-dom@18 esbuild

# 2. Static extraction config — the npm package ships its TSX source:
cat > astryx.extract.config.json <<'EOF'
{
  "code": { "adapter": "react-tsx", "root": "node_modules/@astryxdesign/core/src" },
  "idPrefix": "astryx",
  "out": "extraction/out"
}
EOF

# 3. Run the loop from the repo:
cd /Users/tjpitre/Sites/ds-contracts-poc
npm run extract:code -- ~/exhibits/astryx/astryx.extract.config.json
npm run diagnose     -- ~/exhibits/astryx/astryx.extract.config.json

# 4. Vendor ground truth for the census set (the referee fixture):
node ~/exhibits/astryx/node_modules/@astryxdesign/core/docs.mjs --list
node ~/exhibits/astryx/node_modules/@astryxdesign/core/docs.mjs Button

# 5. First floor capture (after configs/astryx.json + the part-naming fallback land):
npm run extract:computed -- --harness ~/exhibits/astryx \
    --config extract/computed/configs/astryx.json --component Button
```

## Honesty appendix

- **Read-only run.** This file is the only repo write; nothing committed. All clones,
  installs, configs, outputs, probe scripts: session scratchpad `second-system/`.
- **Nord and Astryx numbers are from real, unmodified pipeline runs** (2026-07-20, repo
  working tree at `4fa5b02`). Fluent/Spectrum were NOT re-run: Fluent's 23/23 is the
  eval-pinned post-gauntlet state; SWC's 22/22 carries because the published version is
  byte-identical (1.12.2) to the gauntlet input.
- **Facts-carried here** = (contract props + events) / (extracted props minus platform
  props), median over the census set — same construction as the gauntlet, computed by
  script over the run outputs; platform-prop exclusion list applied uniformly.
- **The Nord shadow probe** mounted 3 components (button/badge/input) from an esbuild
  bundle of the shipped package with `@nordhealth/css` — not the full floor: it proves
  computed-style *reachability*, not capture/fuse/gate viability.
- **Astryx census mapping** judgment calls are named in §3; `Pagination`, `Breadcrumbs`,
  `Link` counted for Astryx but absent in Nord (and vice versa for slider) per each
  system's real inventory.
- **The "used by Figma" claim** for Astryx is press reporting (aidailypost, 2026-06),
  not verified from a primary source.
- Versions pinned throughout: `@astryxdesign/core@0.1.6`, `@nordhealth/components@5.0.3`,
  `@nordhealth/css@5.2.3`, `@nordhealth/tokens@9.0.3`, `@fluentui/react-components@9.74.4`,
  `@spectrum-web-components/*@1.12.2`.
