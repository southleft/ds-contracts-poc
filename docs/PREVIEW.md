# Preview: Figma components to a React package

**Status: preview, not V1.** This page describes the one journey the project
measures end to end today: turning a Figma component set into an installable
React package. It works from your own Figma file. Everything outside the
components listed below is unmeasured, and anything the engine cannot convert
is refused by name instead of guessed.

## What works today

These rows are the benchmark. Each is replayed from a frozen input (a Figma
capture, or the vendored React workspace in `benchmark/react-family`) on every
change to the repository, so a regression turns CI red instead of going
unnoticed. The **Figma → React** rows are what this preview's command does. The
**React → Figma** rows are measured through the local app and Figma, and are
shown so the whole benchmark is visible in one place; they are not part of the
preview command.

<!-- benchmark:begin -->
| Component | Direction | Result | Measured |
| --- | --- | --- | --- |
| CBDS Badge | Figma → React | **Pass** | 72/72 in scope within 5% (max 2.214% white, 4.557% black) — darwin-arm64, 2026-09-25. |
| Altitude Badge | Figma → React | **Pass** | 10/10 in scope within 5% (max 3.333% white, 3.333% black) — darwin-arm64, 2026-09-26. |
| CBDS CheckboxIcon | Figma → React | **Pass** | 30/30 in scope within 5% (max 0.000% white, 0.000% black) — darwin-arm64, 2026-09-25. Out of scope: keyboard focus is V1.1. |
| CBDS Checkbox | Figma → React | **Known failure** | 5/16 in scope within 5% (max 4.947% white, 3.048% black); 11 text-only partial; problems: variant-prop-discarded:state — darwin-arm64, 2026-09-25. Out of scope: keyboard focus is V1.1. |
| shadcn Alert (default) | React → Figma | **Pass** | native vs React source 3.068% white, 3.105% black, exact size — darwin-arm64, 2026-09-26. |
| shadcn Alert (destructive) | React → Figma | **Pass** | native vs React source 3.211% white, 3.248% black, exact size — darwin-arm64, 2026-09-26. |
| shadcn Switch | React → Figma | **Not yet re-scored** | plans match their pin, but no native comparison measured these exact plans yet. |

_Generated from `benchmark/pins` by `npm run benchmark:doc`. Every row is replayed from its frozen input on every push (`npm run benchmark:check`). Images are compared with the unchanged 5% limit on white and black; text-only overages are reported as partials, never as passes._
<!-- benchmark:end -->

What that means for your own components:

- Components shaped like these (a single frame or row with text, an icon,
  fills, strokes, radii and variant properties) are the best candidates.
- Your output is not scored automatically. The scores above come from the
  benchmark's own consumer check (`npm run design:consumer:check`), which you
  can run on your result the same way.
- Keyboard focus and screen-reader behaviour are not part of the preview.

## What you need

- macOS or Linux, Node.js 20.19.4 (the version in `.nvmrc`) and git.
- A Figma personal access token with **File content: read**. Without
  **Variables: read** (available only to some Figma plans), variable names are
  unavailable: the package uses the resolved values instead, under
  `imported.*` token names, and says so.
- A React 18+ app that builds CSS Modules (Vite works as is).

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

   The command prints the package it wrote, for example
   `out/your-team-badge-0.0.0-generated.tgz`, and keeps `out/dump.json` (what
   was read from Figma) and `out/result.json` (what was proposed, and every set
   that was not, with the reason).

3. In your app:

   ```bash
   npm install /path/to/ds-contracts-poc/out/your-team-badge-0.0.0-generated.tgz
   ```

   ```tsx
   import { Badge } from '@your-team/badge';

   export function Example() {
     return <Badge>Label</Badge>;
   }
   ```

   The package's root import includes its token stylesheet. It does not include
   font files: load the fonts your Figma design uses.

A saved capture works the same way: `npm run figma:to-react -- --dump
<dump.json> --out ./out`.

## When something is refused

The command stops with a named reason (for example
`figma-to-react-contract-not-valid: …` or a set listed as not proposed) rather
than producing a package that silently differs from the design. Please open an
issue with the reason and, if you can share it, `out/result.json`. The
capture `out/dump.json` contains your design data, so share it only if you
choose to.

## How this relates to the rest of the project

The local app (`npm run playground`) runs the same Figma-to-React engine, and
this command reproduces its output byte for byte on the benchmark. The other
directions (React to native Figma, and live two-way updates) are in progress
and not part of this preview; see [Current status](CURRENT.md).
