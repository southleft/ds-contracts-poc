# Preview: Figma components to a React package

**Status: preview, not V1.** This page describes the one journey the project
measures end to end today: turning a Figma component set into an installable
React package. It works from your own Figma file. Everything outside the
components listed below is unmeasured, and anything the engine cannot convert
is refused by name instead of guessed.

## What works today

These rows are the benchmark. Each is replayed from a frozen input (a Figma
capture, or a vendored React workspace in `benchmark/react-family` or
`benchmark/shadcn-cohort`) on every
change to the repository, so a regression turns CI red instead of going
unnoticed. The **Figma → React** rows are what this preview's command does. The
**React → Figma** rows are measured through the local app and Figma, and are
shown so the whole benchmark is visible in one place; they are not part of the
preview command.

<!-- benchmark:begin -->
| Component | Direction | Result | Measured |
| --- | --- | --- | --- |
| CBDS Badge | Figma → React | **Pass** | 72/72 in scope within 5% (max 2.214% white, 4.557% black) — darwin-arm64, 2026-09-28. |
| Altitude Badge | Figma → React | **Pass** | 10/10 in scope within 5% (max 3.333% white, 3.333% black) — darwin-arm64, 2026-09-28. |
| CBDS CheckboxIcon | Figma → React | **Pass** | 30/30 in scope within 5% (max 0.000% white, 0.000% black) — darwin-arm64, 2026-09-28. Out of scope: keyboard focus is V1.1. |
| CBDS Checkbox | Figma → React | **Partial (text only)** | 5/16 in scope within 5% (max 4.947% white, 3.048% black); 11 text-only partial — darwin-arm64, 2026-09-28. Out of scope: keyboard focus is V1.1. |
| Altitude Tabs | Figma → React | **Pass** | 2/2 in scope within 5% (max 0.016% white, 3.240% black) — darwin-arm64, 2026-09-28. |
| shadcn Alert (native return) | Figma → React | **Not yet re-scored** | output matches its pin, but no receipt scored these exact generated files yet. |
| shadcn Badge (native return) | Figma → React | **Not yet re-scored** | output matches its pin, but no receipt scored these exact generated files yet. Out of scope: draws no paint without its caller label: nothing to compare (both sides 18 x 20). |
| shadcn Alert (default) | React → Figma | **Pass** | native vs React source 3.068% white, 3.105% black, exact size — darwin-arm64, 2026-09-27. |
| shadcn Alert (destructive) | React → Figma | **Pass** | native vs React source 3.211% white, 3.248% black, exact size — darwin-arm64, 2026-09-26. |
| shadcn Switch | React → Figma | **Pass** | native vs React source 0.000% white, 2.174% black, exact size (snap-outward-effects-included-v1) — darwin-arm64, 2026-09-27. |
| shadcn Badge (default) | React → Figma | **Partial (text only)** | native vs React source 6.250% white, 6.250% black, size differs (snap-outward-v1) — darwin-arm64, 2026-09-27. |
| shadcn Badge (secondary) | React → Figma | **Partial (text only)** | native vs React source 2.614% white, 2.614% black, size differs (snap-outward-v1) — darwin-arm64, 2026-09-27. |
| shadcn Card (composed) | React → Figma | **Pass** | native vs React source 1.331% white, 1.331% black, exact size (snap-outward-effects-included-v1) — darwin-arm64, 2026-09-27. |

_Generated from `benchmark/pins` by `npm run benchmark:doc`. Every row is replayed from its frozen input on every push (`npm run benchmark:check`). Images are compared with the unchanged 5% limit on white and black; text-only overages are reported as partials, never as passes._
<!-- benchmark:end -->

What that means for your own components:

- Components shaped like these (a single frame or row with text, an icon,
  fills, strokes, radii and variant properties) are the best candidates.
- Your output is checked automatically. After it writes the package, the
  command runs the same consumer check the benchmark uses
  (`npm run design:consumer:check`) on it and reports every variant (see
  [Read the result](#read-the-result)).
- Keyboard focus and screen-reader behaviour are not part of the preview.

## What you need

- macOS or Linux, Node.js 20.19.4 (the version in `.nvmrc`) and git.
- A Figma personal access token with **File content: read**. Without
  **Variables: read** (available only to some Figma plans), variable names are
  unavailable: the package uses the resolved values instead, under
  `imported.*` token names, and says so.
- A React 18+ app that builds CSS Modules (Vite works as is).
- For the automatic check: a Chromium for Playwright
  (`npx playwright-core install chromium`) and network access to the npm
  registry (the check installs the package into a fresh Vite app). The token
  is also what lets the check fetch Figma's own images of your variants.

## Run it

1. Get the engine:

   ```bash
   git clone https://github.com/southleft/ds-contracts-poc.git
   cd ds-contracts-poc
   npm ci
   npm run prep:core
   ```

2. In Figma, select a component set, choose **Copy link to selection**, then
   run (the token is read from the environment, never from the command line):

   ```bash
   export FIGMA_TOKEN=<your token>
   npm run figma:to-react -- --url "<the copied link>" --out ./out --name @your-team/badge
   ```

   The command writes the package, for example
   `out/your-team-badge-0.0.0-generated.tgz`, and keeps `out/dump.json` (what
   was read from Figma) and `out/result.json` (what was proposed, every set
   that was not with the reason, and the check's verdict). It then checks the
   package against the design, which takes about a minute, and prints one line
   per Figma variant (see [Read the result](#read-the-result)).

3. In your app:

   ```bash
   npm install /path/to/ds-contracts-poc/out/your-team-badge-0.0.0-generated.tgz
   ```

   ```tsx
   import { Badge } from '@your-team/badge';

   export function Example() {
     return <Badge text="Label" />;
   }
   ```

   The props are your Figma component properties: a text property becomes a
   string prop (here `text`), a variant property an enum prop (`variant`,
   `shape`). The package ships TypeScript declarations, so your editor lists
   them; children are refused by type when the design has no slot. The
   package's root import includes its token stylesheet. It does not include
   font files: load the fonts your Figma design uses.

A saved capture works the same way: `npm run figma:to-react -- --dump
<dump.json> --out ./out`.

## Read the result

The check installs the package into a fresh Vite app, mounts every variant of
the set, and compares it with Figma's own image of that variant (the unchanged
5% limit, on white and on black). It also checks content: every text the
variant draws must be rendered, and every icon or vector it draws must have a
rendered graphic of about the same size. A missing text or icon fails the
variant whatever its image score. The output looks like this:

```text
consumer check (receipt: out/check/receipt.json):
  variant     result      image white/black   content (missing / drawn)
  Footer=No   FAIL        0.77% / 0.77%       1/2 text, 1/1 icons
                - content-missing:footer-no:text:"Dialog heading"
                - content-missing:footer-no:part:al-button/Icon After/X
  Footer=Yes  FAIL        0.61% / 0.61%       1/3 text, 1/1 icons
                - content-missing:footer-yes:text:"Dialog heading"
                - content-missing:footer-yes:part:al-button/Icon After/X
✖ figma:to-react Dialog: FAIL — 2 of 2 variant(s) fail; the package was written but does not match the design → out/your-team-dialog-0.0.0-generated.tgz
```

- **PASS**: within 5% on white and black, every text and icon rendered, no
  problem named. A `✔` line is printed only when every variant passes.
- **FAIL**: each reason is named under the variant, for example a missing
  text or icon (`content-missing:…`), an image over the limit
  (`layout-image-difference-above-limit:…`), a render of zero size, or a font
  your machine does not have (`font-unavailable-in-consumer:…`). Problems that
  belong to no single variant (a variant property the component ignores, for
  example) are listed under "set problems". The command exits 1. With
  `--allow-failures` it exits 0, but the report still says FAIL.
- **UNVERIFIED**: nothing failed, but something could not be measured, for
  example Figma's images without `FIGMA_TOKEN` (with `--dump`). Never shown as
  a pass; the command exits 0.
- **NOT CHECKED**: no Chromium was found, so nothing was verified; the package
  is still written and the command exits 0.

The receipt, Figma's images, the consumer screenshots and side-by-side diff
images are in `out/check`; `out/result.json` repeats the verdict per variant
under `check`.

What the content check does not judge: frames and rectangles (backgrounds,
borders, a radio's drawn circle) are left to the image comparison, and an icon
counts as present when a graphic of about its size is rendered anywhere in the
variant, so a misplaced icon is the image comparison's finding, not a missing
one. It reads what Figma draws with one read-only request per run, so without
`FIGMA_TOKEN` it reports UNVERIFIED instead of guessing.

## When something is refused

The command stops with a named reason (for example
`figma-to-react-contract-not-valid: …` or a set listed as not proposed) rather
than guessing. A package that was written but differs from the design is
reported FAIL, variant by variant, with the reasons named (see
[Read the result](#read-the-result)). Please open an issue with the reason and,
if you can share it, `out/result.json`. The capture `out/dump.json` and the
images in `out/check` contain your design data, so share them only if you
choose to.

## How this relates to the rest of the project

The local app (`npm run playground`) runs the same Figma-to-React engine, and
this command reproduces its output byte for byte on the benchmark. The other
directions (React to native Figma, and live two-way updates) are in progress
and not part of this preview; see [Current status](CURRENT.md).
